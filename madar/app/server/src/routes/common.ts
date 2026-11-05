// Routes shared by every role: login, /me, notifications, timetable, announcements list, section roster.
import { Hono } from 'hono'
import { ApiError, type AppEnv, type User } from '../types'
import { clientIp, loginLimiter, newPayload, requireAuth, secretOf, signToken } from '../auth'
import { audit, bad, intParam, isDate, periodStart, placeholders, readBody, today, weekday } from '../util'
import { parentChildren, requireSection, requireTeacherOfSchool, studentByUser, teacherSections } from '../scope'
import { doStub } from '../dbshim'

const r = new Hono<AppEnv>()

/** `{user, context}` as in §5 — the same object is returned by /api/login and /api/me. */
export async function meResponse(db: D1Database, user: User) {
  const school = user.school_id === null ? null
    : await db.prepare('SELECT id, name, complex FROM schools WHERE id = ?').bind(user.school_id).first<{ id: number; name: string; complex: string }>()
  const subject = user.subject_id === null ? null
    : (await db.prepare('SELECT name FROM subjects WHERE id = ?').bind(user.subject_id).first<{ name: string }>())?.name ?? null
  let context: unknown
  switch (user.role) {
    case 'teacher': context = { sections: await teacherSections(db, user.id), subject }; break
    case 'student': {
      const st = await studentByUser(db, user.id)
      context = { section: st ? { id: st.section_id, grade: st.grade, label: st.section_label } : null, school_name: st?.school_name ?? school?.name ?? null }
      break
    }
    case 'parent':
      context = { children: (await parentChildren(db, user.id)).map(ch => ({ student_id: ch.student_id, name: ch.name, section_label: ch.section_label, school_name: ch.school_name })) }
      break
    case 'school': context = { school }; break
    case 'directorate':
      context = { schools: (await db.prepare('SELECT id, name, complex FROM schools ORDER BY id').all<{ id: number; name: string; complex: string }>()).results }
      break
  }
  return {
    user: { id: user.id, role: user.role, name: user.name, school_id: user.school_id, school_name: school?.name ?? null, subject, demo: true },
    context,
  }
}

const TOO_MANY = 'محاولات كثيرة، يُرجى المحاولة مجدّداً بعد قليل'

r.post('/api/login', async c => {
  const ip = clientIp(c)
  // First line: the isolate's own memory (cheap). Second line: the database object, which every isolate shares and
  // which survives restarts, so the 20-per-10-minutes limit holds in production too.
  if (!loginLimiter.hit(ip)) throw new ApiError(429, TOO_MANY)
  const stub = doStub(c.env)
  if (stub && !(await stub.loginAttempt(ip)).allowed) throw new ApiError(429, TOO_MANY)
  const body = await readBody(c)
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!code) throw bad('يلزم إدخال رمز الدخول')
  const user = await c.env.DB.prepare('SELECT id, role, name, school_id, subject_id FROM users WHERE code = ?').bind(code).first<User>()
  if (!user) throw new ApiError(401, 'رمز الدخول غير صحيح')
  const token = await signToken(newPayload(user.id, user.role), secretOf(c.env))
  await audit(c.env.DB, user.id, 'login')
  return c.json({ token, ...(await meResponse(c.env.DB, user)) })
})

r.get('/api/me', requireAuth(), async c => c.json(await meResponse(c.env.DB, c.get('user'))))

r.get('/api/notifications', requireAuth(), async c => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, kind, body, link, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').bind(c.get('user').id).all()
  return c.json(results)
})

r.post('/api/notifications/read', requireAuth(), async c => {
  const user = c.get('user')
  const body = await readBody(c)
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 200) : []
  if (!ids.length && body.all !== true) throw bad('يلزم تحديد الإشعارات المقروءة')
  const sql = ids.length
    ? `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders(ids.length)})`
    : "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL"
  const res = await c.env.DB.prepare(sql).bind(user.id, ...ids).run()
  await audit(c.env.DB, user.id, 'notifications.read', ids.join(',') || 'all')
  return c.json({ updated: res.meta.changes ?? 0 })
})

export interface TimetableRow {
  id: number; day: number; period: number; subject: string; subject_id: number; teacher: string; teacher_id: number
  section_id: number; section_label: string; shift: number
}
export interface SubstituteInfo { teacher: string | null; status: string }

/** Approved / self-study substitutions of `date`, keyed by timetable row id. */
export async function substituteOverlay(db: D1Database, date: string, timetableIds: number[]): Promise<Map<number, SubstituteInfo>> {
  const out = new Map<number, SubstituteInfo>()
  for (let i = 0; i < timetableIds.length; i += 90) {
    const part = timetableIds.slice(i, i + 90)
    const { results } = await db.prepare(`
      SELECT s.timetable_id, s.status, u.name AS teacher FROM substitutions s JOIN absences a ON a.id = s.absence_id
      LEFT JOIN users u ON u.id = s.substitute_teacher_id
      WHERE a.date = ? AND s.status IN ('approved', 'self_study') AND s.timetable_id IN (${placeholders(part.length)})`)
      .bind(date, ...part).all<{ timetable_id: number; status: string; teacher: string | null }>()
    for (const s of results) out.set(s.timetable_id, { teacher: s.teacher, status: s.status })
  }
  return out
}

/** Timetable rows with the §5 shape; `date` decides which day's substitutions are overlaid. */
export async function timetableRows(db: D1Database, where: { sectionId?: number | null; teacherId?: number | null; day?: number | null; schoolId?: number | null }, date: string) {
  const { results } = await db.prepare(`
    SELECT t.id, t.day, t.period, sj.name AS subject, t.subject_id, u.name AS teacher, t.teacher_id, t.section_id, sec.label AS section_label, sec.shift
    FROM timetable t JOIN subjects sj ON sj.id = t.subject_id JOIN users u ON u.id = t.teacher_id JOIN sections sec ON sec.id = t.section_id
    WHERE (? IS NULL OR t.section_id = ?) AND (? IS NULL OR t.teacher_id = ?) AND (? IS NULL OR t.day = ?) AND (? IS NULL OR sec.school_id = ?)
    ORDER BY t.day, t.period, sec.grade, sec.label`)
    .bind(where.sectionId ?? null, where.sectionId ?? null, where.teacherId ?? null, where.teacherId ?? null,
      where.day ?? null, where.day ?? null, where.schoolId ?? null, where.schoolId ?? null).all<TimetableRow>()
  const d = weekday(date)
  const overlay = await substituteOverlay(db, date, results.filter(x => x.day === d).map(x => x.id))
  return results.map(({ shift, ...x }) => ({ ...x, start: periodStart(shift, x.period), substitute: x.day === d ? overlay.get(x.id) ?? null : null }))
}

r.get('/api/timetable', requireAuth(), async c => {
  const user = c.get('user'), db = c.env.DB
  let sectionId = intParam(c.req.query('section_id')), teacherId = intParam(c.req.query('teacher_id'))
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  const day = intParam(c.req.query('day'))
  if (day !== null && day > 6) throw bad('اليوم غير صالح')
  let schoolId: number | null = null
  if (sectionId !== null) await requireSection(db, user, sectionId)
  if (teacherId !== null) {
    if (user.role === 'teacher' && teacherId !== user.id) throw new ApiError(403, 'لا يمكنك عرض جدول معلّم آخر')
    if (user.role === 'school') await requireTeacherOfSchool(db, teacherId, user.school_id)
    if (user.role === 'student' || user.role === 'parent') throw new ApiError(403, 'تُحدَّد الشعبة بدلاً من المعلّم')
  }
  if (sectionId === null && teacherId === null) {
    switch (user.role) {
      case 'teacher': teacherId = user.id; break
      case 'student': sectionId = (await studentByUser(db, user.id))?.section_id ?? null; break
      case 'parent': sectionId = (await parentChildren(db, user.id))[0]?.section_id ?? null; break
      case 'school': schoolId = user.school_id; break
      case 'directorate': throw bad('يلزم تحديد الشعبة أو المعلّم')
    }
    if (user.role !== 'school' && sectionId === null && teacherId === null) return c.json([])
  }
  return c.json(await timetableRows(db, { sectionId, teacherId, day, schoolId }, date))
})

/** Announcements visible to the user: their school's plus the directorate's circulars (school_id NULL). */
r.get('/api/announcements', requireAuth(), async c => {
  const user = c.get('user')
  const schoolId = user.role === 'directorate' ? intParam(c.req.query('school_id')) : user.school_id
  const { results } = await c.env.DB.prepare(`
    SELECT a.id, a.school_id, a.title, a.body, a.urgent, a.created_at, CASE WHEN a.school_id IS NULL THEN 'directorate' ELSE 'school' END AS scope
    FROM announcements a WHERE a.school_id IS NULL OR (? IS NOT NULL AND a.school_id = ?) OR ? = 'directorate'
    ORDER BY a.created_at DESC, a.id DESC LIMIT 50`).bind(schoolId, schoolId, user.role).all()
  return c.json(results)
})

/** The students of a section with their attendance status for one date/period — for attendance entry.
 *  The registry number stays server-side: the roster needs only ids and names. */
r.get('/api/sections/:id/roster', requireAuth('teacher', 'school', 'directorate'), async c => {
  const sectionId = intParam(c.req.param('id'))
  if (sectionId === null) throw bad()
  const section = await requireSection(c.env.DB, c.get('user'), sectionId)
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  const period = intParam(c.req.query('period'))
  const { results } = await c.env.DB.prepare(`
    SELECT st.id AS student_id, u.name,
           (SELECT a.status FROM attendance a WHERE a.student_id = st.id AND a.date = ? AND (? IS NULL OR a.period = ?) ORDER BY a.period LIMIT 1) AS status
    FROM students st JOIN users u ON u.id = st.user_id WHERE st.section_id = ? ORDER BY u.name`).bind(date, period, period, sectionId).all()
  return c.json({ section: { id: section.id, grade: section.grade, label: section.label, shift: section.shift }, date, period, students: results })
})

export default r
