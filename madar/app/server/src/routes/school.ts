// School (principal / deputy) routes: dashboard, sections, substitution decisions, attendance confirmation, announcements.
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../auth'
import { ORDINALS, audit, bad, dayPhrase, forbidden, intParam, isDate, notFound, optText, placeholders, readBody, requireInt, requireText, today } from '../util'
import { requireTeacherOfSchool, teacherSections } from '../scope'
import { fanOut, logSms, notify, schoolAccounts, schoolGuardians, sectionAudience, type Notice } from '../notify'
import { affectedRows, ensureSubstitutions } from '../substitute'
import { schoolStats } from '../stats'

const r = new Hono<AppEnv>()

/** The school a school account works on (the directorate may look at any school with ?school_id=). */
function schoolOf(c: { get(k: 'user'): AppEnv['Variables']['user']; req: { query(k: string): string | undefined } }): number {
  const user = c.get('user')
  if (user.role === 'directorate') {
    const id = intParam(c.req.query('school_id'))
    if (id === null) throw bad('حدّد المدرسة')
    return id
  }
  if (user.school_id === null) throw forbidden('هذا الحساب غير مرتبط بمدرسة')
  return user.school_id
}

r.get('/api/school/dashboard', requireAuth('school', 'directorate'), async c => {
  const db = c.env.DB
  const schoolId = schoolOf(c)
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  await ensureSubstitutions(db, c.env, date, schoolId)
  const stats = await schoolStats(db, schoolId, date)
  if (!stats) throw notFound('المدرسة غير موجودة')
  const { results: absences } = await db.prepare(`
    SELECT a.id AS absence_id, a.teacher_id, u.name AS teacher, sj.name AS subject, a.reason, a.date
    FROM absences a JOIN users u ON u.id = a.teacher_id LEFT JOIN subjects sj ON sj.id = u.subject_id
    WHERE a.date = ? AND u.school_id = ? ORDER BY u.name`).bind(date, schoolId)
    .all<{ absence_id: number; teacher_id: number; teacher: string; subject: string | null; reason: string | null; date: string }>()
  const withSubs = []
  for (const a of absences) {
    const rows = await affectedRows(db, a.absence_id)
    withSubs.push({ ...a, substitutions: rows.map(s => ({ id: s.substitution_id, period: s.period, section_id: s.section_id, section_label: s.section_label, subject: s.subject,
      status: s.status, substitute: s.substitute, substitute_teacher_id: s.substitute_teacher_id, lesson_note: s.lesson_note, candidates: s.candidates, no_candidate: s.no_candidate })) })
  }
  return c.json({ date, ...stats, absences: withSubs })
})

/** Sections with their students (teachers: only the sections they teach). */
r.get('/api/school/sections', requireAuth('school', 'teacher', 'directorate'), async c => {
  const user = c.get('user'), db = c.env.DB
  const schoolId = user.role === 'teacher' ? user.school_id : schoolOf(c)
  const { results: sections } = await db.prepare('SELECT id, grade, label, shift FROM sections WHERE school_id = ? ORDER BY grade, label').bind(schoolId)
    .all<{ id: number; grade: number; label: string; shift: number }>()
  const allowed = user.role === 'teacher' ? new Set((await teacherSections(db, user.id)).map(s => s.id)) : null
  const visible = sections.filter(s => !allowed || allowed.has(s.id))
  if (!visible.length) return c.json([])
  const { results: pupils } = await db.prepare(`
    SELECT st.id AS student_id, st.section_id, u.name, st.registry_no, st.guardian_user_id IS NOT NULL AS has_guardian
    FROM students st JOIN users u ON u.id = st.user_id WHERE st.section_id IN (${placeholders(visible.length)}) ORDER BY u.name`)
    .bind(...visible.map(s => s.id)).all<{ student_id: number; section_id: number; name: string; registry_no: string | null; has_guardian: number }>()
  return c.json(visible.map(s => {
    const students = pupils.filter(p => p.section_id === s.id).map(p => ({ student_id: p.student_id, name: p.name, registry_no: p.registry_no, has_guardian: !!p.has_guardian }))
    return { ...s, student_count: students.length, students }
  }))
})

/** Teachers of the school (for the «تسجيل غياب معلّم» form and explicit approvals). No phone numbers. */
r.get('/api/school/teachers', requireAuth('school', 'directorate'), async c => {
  const schoolId = schoolOf(c)
  const { results } = await c.env.DB.prepare(`
    SELECT u.id, u.name, u.subject_id, sj.name AS subject, (SELECT COUNT(*) FROM timetable t WHERE t.teacher_id = u.id) AS weekly_periods
    FROM users u LEFT JOIN subjects sj ON sj.id = u.subject_id WHERE u.role = 'teacher' AND u.school_id = ? ORDER BY u.name`).bind(schoolId).all()
  return c.json(results)
})

type SubRow = { id: number; absence_id: number; timetable_id: number; status: string; candidates: string; absent_teacher_id: number; absent_teacher: string
  date: string; school_id: number; period: number; section_id: number; section_label: string; subject: string }

async function loadSubstitution(db: D1Database, id: number, schoolId: number): Promise<SubRow> {
  const row = await db.prepare(`
    SELECT s.id, s.absence_id, s.timetable_id, s.status, s.candidates, a.teacher_id AS absent_teacher_id, u.name AS absent_teacher, a.date, u.school_id,
           t.period, t.section_id, sec.label AS section_label, sj.name AS subject
    FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN users u ON u.id = a.teacher_id
    JOIN timetable t ON t.id = s.timetable_id JOIN sections sec ON sec.id = t.section_id JOIN subjects sj ON sj.id = t.subject_id WHERE s.id = ?`).bind(id).first<SubRow>()
  if (!row) throw notFound('الحصّة غير موجودة')
  if (row.school_id !== schoolId) throw forbidden('هذه الحصّة ليست في مدرستك')
  return row
}

/** Tell the section's students and guardians about a change (no names, no reasons). */
async function tellSection(db: D1Database, sectionId: number, body: string, link: string): Promise<number> {
  const aud = await sectionAudience(db, sectionId)
  const notices: Notice[] = [...fanOut(aud.students, 'change', body, link), ...fanOut(aud.guardians, 'change', body, link)]
  return notify(db, notices)
}

r.post('/api/substitutions/:id/approve', requireAuth('school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const id = intParam(c.req.param('id'))
  if (id === null) throw bad()
  const sub = await loadSubstitution(db, id, user.school_id!)
  const b = await readBody(c)
  const teacher = await requireTeacherOfSchool(db, requireInt(b.teacher_id, 'المعلّم البديل'), user.school_id)
  if (teacher.id === sub.absent_teacher_id) throw bad('لا يمكن تعيين المعلّم الغائب بديلًا')
  const note = optText(b.lesson_note, 1000)
  await db.prepare(`UPDATE substitutions SET status = 'approved', substitute_teacher_id = ?, lesson_note = ?, approved_by = ?, approved_at = datetime('now') WHERE id = ?`)
    .bind(teacher.id, note, user.id, id).run()
  await audit(db, user.id, 'substitution.approve', `${id}:${teacher.id}`)
  const when = dayPhrase(sub.date), period = ORDINALS[sub.period]
  const forSub = `تكليفك بتغطية الحصّة ${period} ${when} — ${sub.section_label} (${sub.subject})` + (note ? ` · خطّة الدرس: ${note}` : '')
  await notify(db, [{ user_id: teacher.id, kind: 'substitution', body: forSub, link: `/substitutions/${id}` }])
  const told = await tellSection(db, sub.section_id, `تغيّر معلّم الحصّة ${period} ${when}`, `/timetable?date=${sub.date}`)
  const rows = await affectedRows(db, sub.absence_id)
  return c.json({ ...rows.find(x => x.substitution_id === id), notified: told + 1 })
})

r.post('/api/substitutions/:id/self-study', requireAuth('school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const id = intParam(c.req.param('id'))
  if (id === null) throw bad()
  const sub = await loadSubstitution(db, id, user.school_id!)
  const b = await readBody(c)
  const note = requireText(b.lesson_note, 'خطّة التعلّم الذاتي', 1000)
  await db.prepare(`UPDATE substitutions SET status = 'self_study', substitute_teacher_id = NULL, lesson_note = ?, approved_by = ?, approved_at = datetime('now') WHERE id = ?`)
    .bind(note, user.id, id).run()
  await audit(db, user.id, 'substitution.self_study', id)
  const told = await tellSection(db, sub.section_id, `الحصّة ${ORDINALS[sub.period]} ${dayPhrase(sub.date)} تعلّم ذاتي موجَّه: ${note}`, `/timetable?date=${sub.date}`)
  const rows = await affectedRows(db, sub.absence_id)
  return c.json({ ...rows.find(x => x.substitution_id === id), notified: told })
})

/** Confirms the day's attendance; the guardians' absence notices of that day are then flagged for SMS (logged only). */
r.post('/api/attendance/confirm', requireAuth('school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const b = await readBody(c)
  const date = isDate(b.date) ? b.date : today()
  const schoolId = user.school_id!
  const res = await db.prepare(`
    UPDATE attendance SET confirmed = 1 WHERE date = ? AND confirmed = 0
      AND student_id IN (SELECT st.id FROM students st JOIN sections sec ON sec.id = st.section_id WHERE sec.school_id = ?)`).bind(date, schoolId).run()
  const guardians = await schoolGuardians(db, schoolId)
  let sms = 0
  if (guardians.length) {
    const { results } = await db.prepare(`
      SELECT id, user_id, body FROM notifications WHERE kind = 'absence' AND sms = 0 AND link LIKE ? AND user_id IN (${placeholders(guardians.length)})`)
      .bind(`/attendance?date=${date}&%`, ...guardians).all<{ id: number; user_id: number; body: string }>()
    if (results.length) {
      await db.prepare(`UPDATE notifications SET sms = 1 WHERE id IN (${placeholders(results.length)})`).bind(...results.map(n => n.id)).run()
      await logSms(db, results.map(n => ({ user_id: n.user_id, kind: 'absence', body: n.body, sms: 1 })))
      sms = results.length
    }
  }
  await audit(db, user.id, 'attendance.confirm', date)
  return c.json({ date, confirmed: res.meta.changes ?? 0, sms })
})

/** School announcement → every guardian of the school; directorate circular (school_id NULL) → every school account. */
r.post('/api/announcements', requireAuth('school', 'directorate'), async c => {
  const user = c.get('user'), db = c.env.DB
  const b = await readBody(c)
  const title = requireText(b.title, 'العنوان', 200), body = requireText(b.body, 'نصّ الإعلان', 4000)
  const urgent = b.urgent === true || b.urgent === 1 || b.urgent === '1' || b.urgent === 'true' ? 1 : 0
  const schoolId = user.role === 'school' ? user.school_id : null
  if (user.role === 'school' && schoolId === null) throw forbidden('هذا الحساب غير مرتبط بمدرسة')
  const res = await db.prepare('INSERT INTO announcements (school_id, title, body, urgent, created_by) VALUES (?, ?, ?, ?, ?)').bind(schoolId, title, body, urgent, user.id).run()
  const id = res.meta.last_row_id as number
  await audit(db, user.id, schoolId === null ? 'circular.create' : 'announcement.create', id)
  const link = `/announcements/${id}`
  const notified = schoolId === null
    ? await notify(db, fanOut(await schoolAccounts(db, null), 'announcement', `${urgent ? 'تعميم عاجل' : 'تعميم'} من المديرية: ${title}`, link, urgent ? 1 : 0))
    : await notify(db, fanOut(await schoolGuardians(db, schoolId), 'announcement', `${urgent ? 'إعلان عاجل' : 'إعلان'} من المدرسة: ${title}`, link, urgent ? 1 : 0))
  return c.json({ id, school_id: schoolId, title, body, urgent, notified }, 201)
})

export default r
