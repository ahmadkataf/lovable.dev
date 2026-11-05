// Parent routes: children overview and the parent ↔ teacher messages (no phone numbers ever leave the server).
import { Hono } from 'hono'
import type { AppEnv, Role } from '../types'
import { requireAuth } from '../auth'
import { addDays, audit, firstName, forbidden, isDate, notFound, periodStart, placeholders, readBody, requireInt, requireText, today, weekday } from '../util'
import { parentChildren, teacherSections } from '../scope'
import { notify } from '../notify'
import { ensureSubstitutions } from '../substitute'

const r = new Hono<AppEnv>()

r.get('/api/parent/home', requireAuth('parent'), async c => {
  const user = c.get('user'), db = c.env.DB
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  const day = weekday(date)
  const children = await parentChildren(db, user.id)
  for (const schoolId of new Set(children.map(ch => ch.school_id))) await ensureSubstitutions(db, c.env, date, schoolId)
  const { results: notes } = await db.prepare('SELECT id, kind, body, link, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100')
    .bind(user.id).all<{ id: number; kind: string; body: string; link: string | null; created_at: string; read_at: string | null }>()
  const out = []
  for (const ch of children) {
    const [status, first, homework, teachers] = await Promise.all([
      db.prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ? ORDER BY period LIMIT 1').bind(ch.student_id, date).first<{ status: string }>(),
      db.prepare('SELECT MIN(period) AS p FROM timetable WHERE section_id = ? AND day = ?').bind(ch.section_id, day).first<{ p: number | null }>(),
      db.prepare(`
        SELECT h.id, h.title, sj.name AS subject, h.book_page, h.due_date, u.name AS teacher,
               EXISTS(SELECT 1 FROM submissions s WHERE s.homework_id = h.id AND s.student_id = ?) AS done
        FROM homework h JOIN subjects sj ON sj.id = h.subject_id JOIN users u ON u.id = h.teacher_id
        WHERE h.section_id = ? AND h.due_date BETWEEN ? AND ? ORDER BY h.due_date, h.id`).bind(ch.student_id, ch.section_id, date, addDays(date, 7)).all(),
      db.prepare(`SELECT DISTINCT u.id, u.name, sj.name AS subject FROM timetable t JOIN users u ON u.id = t.teacher_id LEFT JOIN subjects sj ON sj.id = u.subject_id
                  WHERE t.section_id = ? ORDER BY u.name`).bind(ch.section_id).all(),
    ])
    // Notifications about this child (link carries student_id) plus the general ones (homework, announcements...).
    const mine = notes.filter(n => !n.link || !/student_id=\d+/.test(n.link) || n.link.includes(`student_id=${ch.student_id}`)).slice(0, 10)
    out.push({
      student_id: ch.student_id, name: ch.name, section_id: ch.section_id, section_label: ch.section_label, school_name: ch.school_name,
      today: { date, status: status?.status ?? 'none', first_period_time: first?.p ? periodStart(ch.shift, first.p) : null },
      homework: homework.results.map(h => ({ ...h, done: !!(h as { done: number }).done })),
      notifications: mine,
      teachers: teachers.results,
    })
  }
  return c.json({ children: out })
})

/** Who may message whom: parents ↔ teachers of their children's sections and the school; school ↔ anyone in the school. */
async function canMessage(db: D1Database, from: { id: number; role: Role; school_id: number | null }, to: { id: number; role: Role; school_id: number | null }): Promise<boolean> {
  if (from.id === to.id) return false
  if (from.role === 'school') return to.school_id === from.school_id
  if (to.role === 'school') return to.school_id === from.school_id
  if (from.role === 'parent' && to.role === 'teacher') {
    const sections = (await parentChildren(db, from.id)).map(ch => ch.section_id)
    return (await teacherSections(db, to.id)).some(s => sections.includes(s.id))
  }
  if (from.role === 'teacher' && to.role === 'parent') {
    const sections = (await teacherSections(db, from.id)).map(s => s.id)
    return (await parentChildren(db, to.id)).some(ch => sections.includes(ch.section_id))
  }
  return false
}

r.post('/api/messages', requireAuth('parent', 'teacher', 'school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const b = await readBody(c)
  const toId = requireInt(b.to_user, 'المستلم')
  const body = requireText(b.body, 'نصّ الرسالة', 2000)
  const to = await db.prepare('SELECT id, role, name, school_id FROM users WHERE id = ?').bind(toId).first<{ id: number; role: Role; name: string; school_id: number | null }>()
  if (!to) throw notFound('المستلم غير موجود')
  if (!(await canMessage(db, user, to))) throw forbidden('لا يمكنك مراسلة هذا المستخدم')
  const res = await db.prepare('INSERT INTO messages (from_user, to_user, body) VALUES (?, ?, ?)').bind(user.id, to.id, body).run()
  const id = res.meta.last_row_id as number
  await audit(db, user.id, 'message.send', id)
  const who = user.role === 'teacher' ? `أ. ${firstName(user.name)}` : user.role === 'school' ? 'إدارة المدرسة' : `${firstName(user.name)} (وليّ أمر الطالب)`
  await notify(db, [{ user_id: to.id, kind: 'message', body: `رسالة جديدة من ${who}`, link: `/messages/${user.id}` }])
  return c.json({ id, to_user: to.id, created_at: new Date().toISOString() }, 201)
})

/** My conversations, one thread per other user, newest first; messages to me are marked read. */
r.get('/api/messages', requireAuth('parent', 'teacher', 'school'), async c => {
  const user = c.get('user'), db = c.env.DB
  const { results } = await db.prepare(`
    SELECT id, from_user, to_user, body, created_at, read_at FROM messages WHERE from_user = ? OR to_user = ? ORDER BY id DESC LIMIT 300`)
    .bind(user.id, user.id).all<{ id: number; from_user: number; to_user: number; body: string; created_at: string; read_at: string | null }>()
  const others = [...new Set(results.map(m => (m.from_user === user.id ? m.to_user : m.from_user)))]
  const names = new Map<number, { id: number; name: string; role: Role }>()
  if (others.length) {
    const { results: us } = await db.prepare(`SELECT id, name, role FROM users WHERE id IN (${placeholders(others.length)})`).bind(...others).all<{ id: number; name: string; role: Role }>()
    for (const u of us) names.set(u.id, u)
  }
  const threads = others.map(o => {
    const msgs = results.filter(m => m.from_user === o || m.to_user === o).reverse()
    return { with: names.get(o) ?? { id: o, name: '—', role: 'parent' as Role }, unread: msgs.filter(m => m.to_user === user.id && !m.read_at).length, last_at: msgs[msgs.length - 1].created_at, messages: msgs }
  })
  await db.prepare("UPDATE messages SET read_at = datetime('now') WHERE to_user = ? AND read_at IS NULL").bind(user.id).run()
  return c.json(threads)
})

export default r
