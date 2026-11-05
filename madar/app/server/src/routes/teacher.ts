// Teacher routes (and the writes the school shares with teachers: homework, attendance, absences).
import { Hono } from 'hono'
import { ApiError, type AppEnv } from '../types'
import { requireAuth } from '../auth'
import { ORDINALS, addDays, audit, bad, dayPhrase, firstName, forbidden, intParam, isDate, li, notFound, optText, placeholders, readBody, requireInt, requireText, today, weekday } from '../util'
import { requireSection, requireTeacherOfSchool, studentByUser, parentChildren, teacherSections } from '../scope'
import { notify, type Notice } from '../notify'
import { affectedRows, ensureSubstitutions, runEngine } from '../substitute'
import { timetableRows } from './common'

const r = new Hono<AppEnv>()

/** «اليوم» / «غداً» / «يوم الخميس ٦ تشرين الثاني» for a due date. */
const dueText = (due: string) => due === today() ? 'اليوم' : due === addDays(today(), 1) ? 'غداً' : dayPhrase(due)

const HOMEWORK_SQL = `
  SELECT h.id, h.section_id, sec.label AS section_label, h.subject_id, sj.name AS subject, h.teacher_id, u.name AS teacher, h.title, h.details, h.book_page, h.due_date, h.created_at,
         (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = h.id) AS submitted_count,
         (SELECT COUNT(*) FROM students st WHERE st.section_id = h.section_id) AS student_count
  FROM homework h JOIN sections sec ON sec.id = h.section_id JOIN subjects sj ON sj.id = h.subject_id JOIN users u ON u.id = h.teacher_id`

r.get('/api/teacher/home', requireAuth('teacher'), async c => {
  const user = c.get('user'), db = c.env.DB
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  const day = weekday(date)
  await ensureSubstitutions(db, c.env, date, user.school_id)
  const rows = day <= 4 ? await timetableRows(db, { teacherId: user.id, day }, date) : []
  const taken = new Set<string>()
  if (rows.length) {
    const { results } = await db.prepare(`
      SELECT DISTINCT st.section_id, a.period FROM attendance a JOIN students st ON st.id = a.student_id
      WHERE a.date = ? AND st.section_id IN (${placeholders(new Set(rows.map(x => x.section_id)).size)})`)
      .bind(date, ...new Set(rows.map(x => x.section_id))).all<{ section_id: number; period: number }>()
    for (const t of results) taken.add(`${t.section_id}:${t.period}`)
  }
  const [homework, absence, forMe] = await Promise.all([
    db.prepare(`${HOMEWORK_SQL} WHERE h.teacher_id = ? ORDER BY h.created_at DESC, h.id DESC LIMIT 10`).bind(user.id).all(),
    db.prepare('SELECT id, teacher_id, date, reason, reported_by, created_at FROM absences WHERE teacher_id = ? AND date = ?').bind(user.id, date)
      .first<{ id: number; teacher_id: number; date: string; reason: string | null; reported_by: number; created_at: string }>(),
    db.prepare(`
      SELECT s.id, t.period, sec.label AS section_label, t.section_id, sj.name AS subject, s.lesson_note, u.name AS absent_teacher
      FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN timetable t ON t.id = s.timetable_id
      JOIN sections sec ON sec.id = t.section_id JOIN subjects sj ON sj.id = t.subject_id JOIN users u ON u.id = a.teacher_id
      WHERE a.date = ? AND s.substitute_teacher_id = ? AND s.status = 'approved' ORDER BY t.period`).bind(date, user.id).all(),
  ])
  return c.json({
    date,
    today: { day, periods: rows.map(x => ({ ...x, attendance_taken: taken.has(`${x.section_id}:${x.period}`) })) },
    homework: homework.results,
    absence_today: absence ? { ...absence, affected: await affectedRows(db, absence.id) } : null,
    substitutions_for_me: forMe.results,
  })
})

/** Homework of a section (teacher: any of their sections; student/parent: their own section). */
r.get('/api/homework', requireAuth(), async c => {
  const user = c.get('user'), db = c.env.DB
  let sectionId = intParam(c.req.query('section_id'))
  if (sectionId === null) {
    if (user.role === 'student') sectionId = (await studentByUser(db, user.id))?.section_id ?? null
    else if (user.role === 'parent') sectionId = (await parentChildren(db, user.id))[0]?.section_id ?? null
    else if (user.role === 'teacher') {
      const sections = await teacherSections(db, user.id)
      if (!sections.length) return c.json([])
      const { results } = await db.prepare(`${HOMEWORK_SQL} WHERE h.section_id IN (${placeholders(sections.length)}) ORDER BY h.due_date DESC, h.id DESC LIMIT 100`)
        .bind(...sections.map(s => s.id)).all()
      return c.json(results)
    }
    if (sectionId === null) throw bad('يلزم تحديد الشعبة')
  }
  await requireSection(db, user, sectionId)
  const { results } = await db.prepare(`${HOMEWORK_SQL} WHERE h.section_id = ? ORDER BY h.due_date DESC, h.id DESC LIMIT 100`).bind(sectionId).all()
  return c.json(results)
})

r.get('/api/homework/:id', requireAuth(), async c => {
  const user = c.get('user'), db = c.env.DB
  const id = intParam(c.req.param('id'))
  if (id === null) throw bad()
  const hw = await db.prepare(`${HOMEWORK_SQL} WHERE h.id = ?`).bind(id).first<{ section_id: number }>()
  if (!hw) throw notFound('الواجب غير موجود')
  await requireSection(db, user, hw.section_id)
  const { results } = await db.prepare(`
    SELECT st.id AS student_id, u.name, s.status, s.submitted_at FROM students st JOIN users u ON u.id = st.user_id
    LEFT JOIN submissions s ON s.homework_id = ? AND s.student_id = st.id WHERE st.section_id = ? ORDER BY u.name`).bind(id, hw.section_id)
    .all<{ student_id: number; name: string; status: string | null; submitted_at: string | null }>()
  // Students see only their own flag; parents only their children's; teachers and the school see the whole roster.
  const mine = user.role === 'student' ? (await studentByUser(db, user.id))?.student_id ?? null : null
  let visible = results
  if (user.role === 'student') visible = results.filter(x => x.student_id === mine)
  else if (user.role === 'parent') { const kids = new Set((await parentChildren(db, user.id)).map(ch => ch.student_id)); visible = results.filter(x => kids.has(x.student_id)) }
  return c.json({
    ...hw,
    done: mine === null ? undefined : visible.some(x => x.status !== null),
    students: visible.map(x => ({ student_id: x.student_id, name: x.name, done: !!x.status, submitted_at: x.submitted_at })),
    submissions: visible.filter(x => x.status).map(x => ({ student_id: x.student_id, name: x.name, status: x.status, submitted_at: x.submitted_at })),
  })
})

r.post('/api/homework', requireAuth('teacher', 'school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const b = await readBody(c)
  const sectionId = requireInt(b.section_id, 'الشعبة')
  const section = await requireSection(db, user, sectionId)
  const subjectId = b.subject_id === undefined || b.subject_id === null ? user.subject_id : requireInt(b.subject_id, 'المادّة')
  if (subjectId === null) throw bad('يلزم تحديد المادّة')
  const subject = await db.prepare('SELECT id, name FROM subjects WHERE id = ?').bind(subjectId).first<{ id: number; name: string }>()
  if (!subject) throw bad('المادّة غير موجودة')
  const title = requireText(b.title, 'عنوان الواجب', 200)
  const details = optText(b.details), bookPage = optText(b.book_page, 20)
  if (!isDate(b.due_date)) throw bad('تاريخ التسليم غير صالح')
  const clientId = optText(b.client_id, 64)
  if (clientId) {   // offline outbox replay: the same homework must not be created twice
    const dup = await db.prepare('SELECT id FROM homework WHERE client_id = ?').bind(clientId).first<{ id: number }>()
    if (dup) return c.json({ id: dup.id, notified_students: 0, notified_guardians: 0, duplicate: true })
  }
  const res = await db.prepare('INSERT INTO homework (section_id, subject_id, teacher_id, title, details, book_page, due_date, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(sectionId, subject.id, user.id, title, details, bookPage, b.due_date, clientId).run()
  const id = res.meta.last_row_id as number
  await audit(db, user.id, 'homework.create', id)
  // Notify every student of the section and each guardian (first names only).
  const { results: pupils } = await db.prepare('SELECT st.user_id, st.guardian_user_id, u.name FROM students st JOIN users u ON u.id = st.user_id WHERE st.section_id = ?')
    .bind(sectionId).all<{ user_id: number; guardian_user_id: number | null; name: string }>()
  const when = dueText(b.due_date), link = `/homework/${id}`
  const notices: Notice[] = pupils.map(p => ({ user_id: p.user_id, kind: 'homework', body: `واجب جديد في ${subject.name}: ${title} — يُسلَّم ${when}`, link }))
  const guardians = pupils.filter(p => p.guardian_user_id !== null)
  for (const p of guardians) notices.push({ user_id: p.guardian_user_id!, kind: 'homework', body: `واجب جديد ${li(firstName(p.name))} في ${subject.name}، يُسلَّم ${when}`, link })
  await notify(db, notices)
  return c.json({ id, notified_students: pupils.length, notified_guardians: guardians.length, section_label: section.label }, 201)
})

const STATUSES = new Set(['present', 'absent', 'late'])

r.post('/api/attendance', requireAuth('teacher', 'school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const b = await readBody(c)
  const sectionId = requireInt(b.section_id, 'الشعبة')
  const section = await requireSection(db, user, sectionId)
  const date = isDate(b.date) ? b.date : today()
  const period = requireInt(b.period, 'الحصّة')
  if (period < 1 || period > 7) throw bad('رقم الحصّة غير صالح')
  if (!Array.isArray(b.records) || !b.records.length) throw bad('لا توجد سجلّات حضور')
  const { results: pupils } = await db.prepare('SELECT st.id, st.guardian_user_id, u.name FROM students st JOIN users u ON u.id = st.user_id WHERE st.section_id = ?')
    .bind(sectionId).all<{ id: number; guardian_user_id: number | null; name: string }>()
  const byId = new Map(pupils.map(p => [p.id, p]))
  const records = new Map<number, string>()
  for (const rec of b.records as unknown[]) {
    const o = (rec ?? {}) as Record<string, unknown>
    const sid = intParam(o.student_id), status = String(o.status ?? '')
    if (sid === null || !byId.has(sid)) throw bad('طالب خارج الشعبة')
    if (!STATUSES.has(status)) throw bad('حالة الحضور غير صالحة')
    records.set(sid, status)
  }
  const ids = [...records.keys()]
  const { results: existing } = await db.prepare(`SELECT student_id, status FROM attendance WHERE date = ? AND period = ? AND student_id IN (${placeholders(ids.length)})`)
    .bind(date, period, ...ids).all<{ student_id: number; status: string }>()
  const before = new Map(existing.map(e => [e.student_id, e.status]))
  const confirmedDay = await db.prepare(`SELECT 1 AS x FROM attendance a JOIN students st ON st.id = a.student_id JOIN sections sec ON sec.id = st.section_id
                                          WHERE a.date = ? AND sec.school_id = ? AND a.confirmed = 1 LIMIT 1`).bind(date, section.school_id).first()
  await db.batch(ids.map(sid => db.prepare(`
    INSERT INTO attendance (student_id, date, period, status, recorded_by, confirmed) VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(student_id, date, period) DO UPDATE SET status = excluded.status, recorded_by = excluded.recorded_by, confirmed = 0`)
    .bind(sid, date, period, records.get(sid)!, user.id)))
  await audit(db, user.id, 'attendance.save', `${sectionId}/${date}/${period}`)
  // A guardian hears about a new absence (in-app now; SMS flag only once the school has confirmed the day).
  const notices: Notice[] = []
  for (const sid of ids) {
    const p = byId.get(sid)!
    if (records.get(sid) === 'absent' && before.get(sid) !== 'absent' && p.guardian_user_id !== null) {
      notices.push({ user_id: p.guardian_user_id, kind: 'absence', body: `غياب ${firstName(p.name)} ${dayPhrase(date)} — الحصّة ${ORDINALS[period]}`,
        link: `/attendance?date=${date}&student_id=${sid}`, sms: confirmedDay ? 1 : 0 })
    }
  }
  await notify(db, notices)
  const count = (s: string) => [...records.values()].filter(v => v === s).length
  return c.json({ saved: ids.length, present: count('present'), absent: count('absent'), late: count('late'), notified_guardians: notices.length, date, period, section_id: sectionId })
})

/** A teacher reports their own absence; a school account records one for a teacher. Runs the engine (§6). */
r.post('/api/absences', requireAuth('teacher', 'school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const b = await readBody(c)
  const date = b.date === undefined || b.date === null || b.date === '' ? today() : b.date
  if (!isDate(date)) throw bad('التاريخ غير صالح')
  let teacherId = user.id
  if (user.role === 'school') teacherId = (await requireTeacherOfSchool(db, requireInt(b.teacher_id, 'المعلّم'), user.school_id)).id
  else if (b.teacher_id !== undefined && b.teacher_id !== null && Number(b.teacher_id) !== user.id) throw forbidden('لا يُبلَّغ هنا إلّا عن غيابك أنت')
  const reason = optText(b.reason, 300)
  const existing = await db.prepare('SELECT id FROM absences WHERE teacher_id = ? AND date = ?').bind(teacherId, date).first<{ id: number }>()
  let id = existing?.id
  if (id === undefined) {
    const res = await db.prepare('INSERT INTO absences (teacher_id, date, reason, reported_by) VALUES (?, ?, ?, ?)').bind(teacherId, date, reason, user.id).run()
    id = res.meta.last_row_id as number
    await audit(db, user.id, 'absence.create', id)
  }
  const result = await runEngine(db, c.env, id)
  if (!result) throw new ApiError(500, 'تعذّر تشغيل محرّك التعويض')
  return c.json({ ...result, existing: existing !== null }, existing ? 200 : 201)
})

export default r
