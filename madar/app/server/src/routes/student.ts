// Student routes: home and homework submission.
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../auth'
import { addDays, audit, bad, intParam, isDate, notFound, today, weekday } from '../util'
import { studentByUser } from '../scope'
import { ensureSubstitutions } from '../substitute'
import { timetableRows } from './common'

const r = new Hono<AppEnv>()
export const POINTS_PER_HOMEWORK = 10

r.get('/api/student/home', requireAuth('student'), async c => {
  const user = c.get('user'), db = c.env.DB
  const st = await studentByUser(db, user.id)
  if (!st) throw notFound('لا يوجد سجلّ طالب لهذا الحساب')
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  const day = weekday(date)
  await ensureSubstitutions(db, c.env, date, st.school_id)
  const [rows, homework, unread, done] = await Promise.all([
    day <= 4 ? timetableRows(db, { sectionId: st.section_id, day }, date) : Promise.resolve([]),
    db.prepare(`
      SELECT h.id, h.title, sj.name AS subject, h.book_page, h.details, h.due_date, u.name AS teacher,
             EXISTS(SELECT 1 FROM submissions s WHERE s.homework_id = h.id AND s.student_id = ?) AS done
      FROM homework h JOIN subjects sj ON sj.id = h.subject_id JOIN users u ON u.id = h.teacher_id
      WHERE h.section_id = ? AND h.due_date >= ? ORDER BY h.due_date, h.id LIMIT 30`).bind(st.student_id, st.section_id, addDays(date, -7)).all(),
    db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE student_id = ?').bind(st.student_id).first<{ n: number }>(),
  ])
  return c.json({
    date,
    section: { id: st.section_id, grade: st.grade, label: st.section_label }, school_name: st.school_name,
    today: rows,
    homework: homework.results.map(h => ({ ...h, done: !!(h as { done: number }).done })),
    notifications_unread: unread?.n ?? 0,
    points: (done?.n ?? 0) * POINTS_PER_HOMEWORK,
  })
})

r.post('/api/homework/:id/submit', requireAuth('student'), async c => {
  const user = c.get('user'), db = c.env.DB
  const id = intParam(c.req.param('id'))
  if (id === null) throw bad()
  const st = await studentByUser(db, user.id)
  if (!st) throw notFound('لا يوجد سجلّ طالب لهذا الحساب')
  const hw = await db.prepare('SELECT id, section_id FROM homework WHERE id = ?').bind(id).first<{ id: number; section_id: number }>()
  if (!hw || hw.section_id !== st.section_id) throw notFound('الواجب غير موجود في شعبتك')
  const res = await db.prepare("INSERT OR IGNORE INTO submissions (homework_id, student_id, status) VALUES (?, ?, 'done')").bind(id, st.student_id).run()
  if (res.meta.changes) await audit(db, user.id, 'homework.submit', id)
  const done = await db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE student_id = ?').bind(st.student_id).first<{ n: number }>()
  return c.json({ homework_id: id, done: true, already: !res.meta.changes, points: (done?.n ?? 0) * POINTS_PER_HOMEWORK })
})

export default r
