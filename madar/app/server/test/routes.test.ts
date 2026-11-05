// Route tests: the real Hono app against schema.sql + seed.sql loaded into an in-memory SQLite (test/d1.ts).
import { beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import app from '../src/index'
import { fakeD1 } from './d1'
import { addDays, today, weekday } from '../src/util'
import { ADMIN_WINDOW, LOGIN_WINDOW, clearAttempts, ensureAttemptsTable, recordAttempt, type SqlLike } from '../src/ratelimit'

const db = fakeD1([resolve(__dirname, '../schema.sql'), resolve(__dirname, '../seed.sql')])
const count = (sql: string, ...p: unknown[]) => Number((db.raw.prepare(sql).get(...(p as never[])) as { n: number }).n)

// A stand-in for the MadarDB Durable Object: the rate-limit methods run the real SQL over node:sqlite, health counts rows.
const limiterDb = new DatabaseSync(':memory:')
const limiterSql: SqlLike = { exec: (sql, ...p) => ({ toArray: () => limiterDb.prepare(sql).all(...(p as never[])) as Record<string, unknown>[] }) }
ensureAttemptsTable(limiterSql)
const fakeStub = {
  loginAttempt: async (ip: string) => recordAttempt(limiterSql, `login:${ip}`, LOGIN_WINDOW),
  loginSucceeded: async (ip: string) => clearAttempts(limiterSql, `login:${ip}`),
  adminAttempt: async (ip: string) => recordAttempt(limiterSql, `admin:${ip}`, ADMIN_WINDOW),
  health: async () => ({ users: count('SELECT COUNT(*) AS n FROM users') }),
}
const MADAR_DO = { idFromName: (name: string) => name, get: () => fakeStub }

let assetHits = 0
const env = {
  DB: db, WEEKLY_CAP: '28', TOKEN_SECRET: 'test-secret', MADAR_DO,
  ASSETS: { fetch: async (req: Request) => { assetHits++; return new URL(req.url).pathname === '/index.html' ? new Response('<html>shell</html>', { headers: { 'content-type': 'text/html' } }) : new Response('nope', { status: 404 }) } },
}
const PHONE = /09[34]0{3,}\d{3}/   // seeded phones look like 0930000011 / 0940000401 — they must never appear in a response

async function call(method: string, path: string, token?: string, body?: unknown, extraHeaders: Record<string, string> = {}, customEnv: object = env) {
  const res = await app.request(path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
  }, customEnv)
  const text = await res.text()
  expect(text).not.toMatch(PHONE)
  expect(text).not.toContain('registry_no')   // the registry number is kept server-side
  let json: any = null
  try { json = JSON.parse(text) } catch { /* csv or html */ }
  return { status: res.status, json, text, headers: res.headers }
}
const login = async (code: string) => { const r = await call('POST', '/api/login', undefined, { code }); expect(r.status).toBe(200); return r.json.token as string }

const T = { dir: '', sch1: '', samer: '', rana: '', layan: '', khaled: '', sch2: '' }
const TODAY = today()
let thursday = addDays(TODAY, 1)
while (weekday(thursday) !== 4) thursday = addDays(thursday, 1)

beforeAll(async () => {
  T.dir = await login('DIR-DARAA'); T.sch1 = await login('SCH-1'); T.sch2 = await login('SCH-2'); T.samer = await login('T-SAMER')
  T.rana = await login('T-RANA'); T.layan = await login('S-LAYAN'); T.khaled = await login('P-KHALED')
})

describe('login and /me', () => {
  it('rejects a wrong or missing code in Arabic', async () => {
    expect((await call('POST', '/api/login', undefined, { code: 'NOPE' })).status).toBe(401)
    const r = await call('POST', '/api/login', undefined, {})
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/[؀-ۿ]/)
  })
  it('requires a token', async () => {
    expect((await call('GET', '/api/me')).status).toBe(401)
    expect((await call('GET', '/api/me', 'bad.token')).status).toBe(401)
  })
  it('refuses to start an https deployment without TOKEN_SECRET, and never caches API answers', async () => {
    const prod = { ...env, TOKEN_SECRET: undefined, APP_URL: 'https://app.madar.raqeem.dev' }
    const r = await call('POST', '/api/login', undefined, { code: 'SCH-1' }, {}, prod)
    expect(r.status).toBe(500)
    expect(r.json.error).toMatch(/[؀-ۿ]/)
    expect((await call('POST', '/api/login', undefined, { code: 'SCH-1' }, {}, { ...env, TOKEN_SECRET: undefined, APP_URL: 'http://localhost:8787' })).status).toBe(200)
    expect((await call('GET', '/api/me', T.samer)).headers.get('cache-control')).toBe('no-store')
  })
  it('the durable limiter blocks the 21st login attempt of an address even when this isolate has seen none', async () => {
    const ip = '203.0.113.9'
    for (let i = 0; i < 20; i++) expect((await fakeStub.loginAttempt(ip)).allowed).toBe(true)   // attempts seen by other isolates
    const r = await call('POST', '/api/login', undefined, { code: 'SCH-1' }, { 'cf-connecting-ip': ip })
    expect(r.status).toBe(429)
    expect(r.json.error).toMatch(/[؀-ۿ]/)
    expect((await call('POST', '/api/login', undefined, { code: 'SCH-1' }, { 'cf-connecting-ip': '203.0.113.10' })).status).toBe(200)
  })

  it('a correct code resets the address\'s failed-attempt count (shared school Wi-Fi never locks itself out)', async () => {
    const ip = '198.51.100.7'
    for (let i = 0; i < 19; i++) expect((await call('POST', '/api/login', undefined, { code: 'WRONG' }, { 'cf-connecting-ip': ip })).status).toBe(401)
    expect((await call('POST', '/api/login', undefined, { code: 'T-SAMER' }, { 'cf-connecting-ip': ip })).status).toBe(200)
    for (let i = 0; i < 19; i++) expect((await call('POST', '/api/login', undefined, { code: 'WRONG' }, { 'cf-connecting-ip': ip })).status).toBe(401)
    expect((await call('POST', '/api/login', undefined, { code: 'SCH-1' }, { 'cf-connecting-ip': ip })).status).toBe(200)
  })
  it('allows the app origins only, with Vary: Origin', async () => {
    const ok = await call('GET', '/api/me', T.samer, undefined, { origin: 'https://app.madar.raqeem.dev' })
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.madar.raqeem.dev')
    expect(ok.headers.get('vary')).toContain('Origin')
    const local = await call('GET', '/api/me', T.samer, undefined, { origin: 'http://localhost:5173' })
    expect(local.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    const evil = await call('GET', '/api/me', T.samer, undefined, { origin: 'https://evil.example' })
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
    expect(evil.headers.get('vary')).toContain('Origin')
    const preflight = await app.request('/api/login', { method: 'OPTIONS', headers: { origin: 'http://localhost:4173', 'access-control-request-method': 'POST' } }, env)
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:4173')
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST')
  })
})

describe('admin endpoints', () => {
  const withKey = { ...env, ADMIN_KEY: 'k-admin' }
  it('need the exact key (compared in constant time) and are never cached', async () => {
    expect((await call('GET', '/api/admin/health', undefined, undefined, { 'x-admin-key': 'k-admin' })).status).toBe(403)   // no ADMIN_KEY configured
    expect((await call('GET', '/api/admin/health', undefined, undefined, {}, withKey)).status).toBe(403)
    expect((await call('GET', '/api/admin/health', undefined, undefined, { 'x-admin-key': 'k-admi' }, withKey)).status).toBe(403)
    expect((await call('GET', '/api/admin/health', undefined, undefined, { 'x-admin-key': 'k-admin-' }, withKey)).status).toBe(403)
    const ok = await call('GET', '/api/admin/health', undefined, undefined, { 'x-admin-key': 'k-admin' }, withKey)
    expect(ok.status).toBe(200)
    expect(ok.json.users).toBeGreaterThan(10)
    expect(ok.headers.get('cache-control')).toBe('no-store')
    expect((await call('POST', '/api/admin/sql', undefined, undefined, { 'x-admin-key': 'k-admin' }, withKey)).status).toBe(400)   // empty script
  })
  it('allow ten calls per minute per address, key or no key', async () => {
    const ip = '198.51.100.7'
    for (let i = 0; i < 10; i++) expect((await call('GET', '/api/admin/health', undefined, undefined, { 'x-admin-key': 'wrong', 'cf-connecting-ip': ip }, withKey)).status).toBe(403)
    expect((await call('GET', '/api/admin/health', undefined, undefined, { 'x-admin-key': 'k-admin', 'cf-connecting-ip': ip }, withKey)).status).toBe(429)
  })
  it('returns role-specific context', async () => {
    const t = (await call('GET', '/api/me', T.samer)).json
    expect(t.user).toMatchObject({ role: 'teacher', name: 'سامر حسن', school_id: 1, school_name: 'مدرسة درعا النموذجية', subject: 'الرياضيات' })
    expect(t.context.sections.map((s: any) => s.label)).toEqual(['الخامس (أ)', 'الخامس (ب)', 'السادس (أ)'])
    const p = (await call('GET', '/api/me', T.khaled)).json
    expect(p.context.children).toHaveLength(2)
    expect(p.context.children[0]).toMatchObject({ name: 'محمد خالد', section_label: 'الخامس (ب)' })
    const s = (await call('GET', '/api/me', T.layan)).json
    expect(s.context.section.label).toBe('الخامس (ب)')
    const d = (await call('GET', '/api/me', T.dir)).json
    expect(d.context.schools).toHaveLength(3)
    expect((await call('GET', '/api/me', T.sch1)).json.context.school.complex).toBe('درعا المدينة')
  })
})

describe('scope', () => {
  it('a teacher cannot read another school (or a section they do not teach)', async () => {
    expect((await call('GET', '/api/homework?section_id=4', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/timetable?section_id=4', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/sections/4/roster', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/timetable?teacher_id=12', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/school/dashboard', T.samer)).status).toBe(403)   // wrong role
  })
  it('a school account only sees its own school', async () => {
    expect((await call('GET', '/api/sections/4/roster', T.sch1)).status).toBe(403)
    expect((await call('GET', '/api/sections/1/roster', T.sch2)).status).toBe(403)
    expect((await call('POST', '/api/absences', T.sch2, { teacher_id: 12, date: TODAY })).status).toBe(403)
  })
  it('a student sees only their section, a parent only their children', async () => {
    expect((await call('GET', '/api/homework/3', T.layan)).status).toBe(403)     // homework of الخامس (أ)
    expect((await call('GET', '/api/homework/1', T.layan)).status).toBe(200)
    expect((await call('GET', '/api/homework?section_id=1', T.khaled)).status).toBe(403)
    expect((await call('GET', '/api/homework?section_id=3', T.khaled)).status).toBe(200)   // سارة خالد is in السادس (أ)
    const detail = (await call('GET', '/api/homework/1', T.khaled)).json
    expect(detail.students.map((s: any) => s.student_id)).toEqual([13])                      // only her own child in that section
  })
})

describe('timetable', () => {
  it('lists the teacher\'s own week by default, with the §5 keys', async () => {
    const rows = (await call('GET', '/api/timetable', T.samer)).json
    expect(rows.length).toBe(count('SELECT COUNT(*) AS n FROM timetable WHERE teacher_id = 11'))
    expect(Object.keys(rows[0]).sort()).toEqual(['day', 'id', 'period', 'section_id', 'section_label', 'start', 'subject', 'subject_id', 'substitute', 'teacher', 'teacher_id'])
  })
  it('matches the pitch on Thursday for الخامس (ب)', async () => {
    const rows = (await call('GET', '/api/timetable?section_id=2&day=4', T.layan)).json
    expect(rows.map((r: any) => r.teacher)).toEqual(['هبة سليم', 'سامر حسن', 'رنا سعيد', 'لينا فارس', 'خالد نور', 'عمر سعد'])
    expect(rows.map((r: any) => r.start)).toEqual(['07:30', '08:20', '09:10', '10:15', '11:05', '11:55'])
  })
})

describe('homework', () => {
  it('creates homework and notifies every student and guardian of the section', async () => {
    const before = count('SELECT COUNT(*) AS n FROM notifications')
    const r = await call('POST', '/api/homework', T.samer, { section_id: 2, subject_id: 2, title: 'واجب تجريبي', book_page: '12', due_date: addDays(TODAY, 2), client_id: 'c-1' })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ notified_students: 12, notified_guardians: 8 })
    expect(count('SELECT COUNT(*) AS n FROM notifications') - before).toBe(20)
    // guardians are addressed with «ل» attached to the (compound-aware) first name, no tatweel; their link names the child
    const toGuardians = db.raw.prepare("SELECT body, link FROM notifications WHERE kind = 'homework' AND link LIKE ? AND user_id >= 400").all(`/homework/${r.json.id}%`) as { body: string; link: string }[]
    expect(toGuardians).toHaveLength(8)
    expect(toGuardians.find(x => x.link === `/homework/${r.json.id}?student_id=13`)?.body).toMatch(/^واجب جديد لمحمد في الرياضيات، يُسلَّم (اليوم|غداً|يوم \S+ [٠-٩]+ \S+( \S+)?)$/)
    expect(toGuardians.some(x => x.body.startsWith('واجب جديد لعبد الرحمن في الرياضيات'))).toBe(true)
    expect(toGuardians.map(x => x.body).join(' ')).not.toContain('لـ')
    expect(db.raw.prepare("SELECT link FROM notifications WHERE kind = 'homework' AND user_id = 114 AND link LIKE ?").get(`/homework/${r.json.id}%`)).toEqual({ link: `/homework/${r.json.id}` })   // the student's own link is plain
    expect(count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'homework.create' AND target = ?", String(r.json.id))).toBe(1)
    // replaying the same offline item is a no-op
    const again = await call('POST', '/api/homework', T.samer, { section_id: 2, subject_id: 2, title: 'واجب تجريبي', due_date: addDays(TODAY, 2), client_id: 'c-1' })
    expect(again.json).toMatchObject({ id: r.json.id, duplicate: true, notified_students: 0 })
    expect(count('SELECT COUNT(*) AS n FROM notifications') - before).toBe(20)
  })
  it('refuses homework for a section the teacher does not teach and validates the body', async () => {
    expect((await call('POST', '/api/homework', T.samer, { section_id: 4, title: 'x', due_date: TODAY })).status).toBe(403)
    expect((await call('POST', '/api/homework', T.samer, { section_id: 2, title: '', due_date: TODAY })).status).toBe(400)
    expect((await call('POST', '/api/homework', T.samer, { section_id: 2, title: 'x', due_date: 'tomorrow' })).status).toBe(400)
  })
  it('lets the student submit once and counts points', async () => {
    const r = await call('POST', '/api/homework/1/submit', T.layan)
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ done: true, already: false, points: 10 })
    expect((await call('POST', '/api/homework/1/submit', T.layan)).json.already).toBe(true)
    expect((await call('POST', '/api/homework/3/submit', T.layan)).status).toBe(404)   // other section
    const home = (await call('GET', '/api/student/home', T.layan)).json
    expect(home.homework.find((h: any) => h.id === 1).done).toBe(true)
    expect(home.points).toBe(10)
    expect(typeof home.notifications_unread).toBe('number')
  })
})

describe('attendance', () => {
  const date = addDays(thursday, 7)   // a future school day nobody has recorded yet
  it('upserts the roster and notifies guardians of new absences in-app only', async () => {
    const roster = (await call('GET', `/api/sections/2/roster?date=${date}&period=1`, T.samer)).json
    expect(roster.students).toHaveLength(12)
    // محمد خالد (13) and ليان أحمد (14) are absent — both have guardians; عبد الرحمن (15) is late.
    const records = roster.students.map((s: any) => ({ student_id: s.student_id, status: s.student_id <= 14 ? 'absent' : s.student_id === 15 ? 'late' : 'present' }))
    const r = await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ saved: 12, absent: 2, late: 1, present: 9, notified_guardians: 2 })
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'absence' AND sms = 0 AND link LIKE ?", `/attendance?date=${date}&%`)).toBe(2)
    // the same POST again (offline replay) does not notify twice
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records })).json.notified_guardians).toBe(0)
    expect((await call('GET', `/api/sections/2/roster?date=${date}&period=1`, T.samer)).json.students.filter((s: any) => s.status === 'absent')).toHaveLength(2)
  })
  it('rejects students outside the section and bad statuses', async () => {
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records: [{ student_id: 1, status: 'absent' }] })).status).toBe(400)
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records: [{ student_id: 13, status: 'sick' }] })).status).toBe(400)
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 4, date, period: 1, records: [{ student_id: 37, status: 'absent' }] })).status).toBe(403)
  })
  it('the school confirms the day and the absence notices get their SMS flag (logged)', async () => {
    expect((await call('GET', `/api/school/dashboard?date=${date}`, T.sch1)).json.attendance_confirmed).toBe(false)
    const r = await call('POST', '/api/attendance/confirm', T.sch1, { date })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ confirmed: 12, sms: 2 })
    expect((await call('GET', `/api/school/dashboard?date=${date}`, T.sch1)).json.attendance_confirmed).toBe(true)
    expect(count('SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND confirmed = 0', date)).toBe(0)
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'absence' AND sms = 1 AND link LIKE ?", `/attendance?date=${date}&%`)).toBe(2)
    expect((await call('POST', '/api/attendance/confirm', T.samer, { date })).status).toBe(403)
  })
})

describe('teacher absence → substitute suggestions → school decision', () => {
  let absenceId = 0, p3 = 0, p5 = 0
  it('runs the engine for رنا on a Thursday: ماهر for الخامس (ب) period 3', async () => {
    const r = await call('POST', '/api/absences', T.rana, { date: thursday, reason: 'ظرف عائلي' })
    expect(r.status).toBe(201)
    absenceId = r.json.absence_id
    expect(r.json.affected.map((a: any) => a.period)).toEqual([3, 5])
    const a3 = r.json.affected.find((a: any) => a.period === 3), a5 = r.json.affected.find((a: any) => a.period === 5)
    expect(a3.section_label).toBe('الخامس (ب)')
    expect(a3.candidates[0]).toMatchObject({ teacher_id: 13, name: 'ماهر عادل', subject: 'العلوم', tier: 1 })
    expect(a3.candidates[0].reason).toContain('المادّة نفسها')
    expect(a3.candidates.map((c: any) => c.reason).join(' ')).not.toMatch(/ًا|يدرّس الشعبة/)   // tanwīn after the alif, «من معلّمي الشعبة»
    expect(a3.candidates).toHaveLength(3)
    expect(a3.substitute_teacher_id).toBe(13)
    expect(a3.status).toBe('suggested')
    expect(a5.section_label).toBe('الخامس (أ)')
    expect(a5.candidates.map((c: any) => c.teacher_id)).not.toContain(13)   // ماهر teaches السادس (أ) then
    expect(a5.candidates.map((c: any) => c.teacher_id)).not.toContain(15)   // خالد teaches الخامس (ب) then
    expect(a5.candidates.every((c: any) => c.tier === 2)).toBe(true)        // all free teachers teach الخامس (أ)
    p3 = a3.substitution_id; p5 = a5.substitution_id
    // the school account was told how many periods need cover
    const told = db.raw.prepare("SELECT body FROM notifications WHERE user_id = 2 AND kind = 'absence_teacher' AND link = ?").all(`/absences/${absenceId}`) as { body: string }[]
    expect(told).toHaveLength(1)
    expect(told[0].body).toMatch(/^غياب أ\. رنا سعيد يوم الخميس .*: حصّتان بحاجة إلى تغطية$/)
    // reporting the same absence again is idempotent
    const again = await call('POST', '/api/absences', T.rana, { date: thursday })
    expect(again.status).toBe(200)
    expect(again.json).toMatchObject({ absence_id: absenceId, existing: true })
    expect(count('SELECT COUNT(*) AS n FROM substitutions WHERE absence_id = ?', absenceId)).toBe(2)
  })
  it('a teacher cannot report someone else\'s absence; the school can', async () => {
    expect((await call('POST', '/api/absences', T.samer, { teacher_id: 12, date: thursday })).status).toBe(403)
    const r = await call('POST', '/api/absences', T.sch1, { teacher_id: 17, date: addDays(thursday, 7), reason: 'دورة تدريبية' })
    expect(r.status).toBe(201)
    expect(r.json.affected.length).toBe(count('SELECT COUNT(*) AS n FROM timetable WHERE teacher_id = 17 AND day = 4'))
  })
  it('the school approves a substitute and the section is told without names', async () => {
    const before = count('SELECT COUNT(*) AS n FROM notifications')
    const r = await call('POST', `/api/substitutions/${p3}/approve`, T.sch1, { teacher_id: 13, lesson_note: 'متابعة درس الكسور ص ٤٠' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ substitution_id: p3, status: 'approved', substitute: 'ماهر عادل', lesson_note: 'متابعة درس الكسور ص ٤٠', notified: 21 })
    expect(count('SELECT COUNT(*) AS n FROM notifications') - before).toBe(21)
    const forSub = db.raw.prepare("SELECT body FROM notifications WHERE user_id = 13 AND kind = 'substitution' ORDER BY id DESC LIMIT 1").get() as { body: string }
    expect(forSub.body).toMatch(/^تكليفك بتغطية الحصّة الثالثة يوم الخميس [٠-٩]+ \S+( \S+)? — الخامس \(ب\) · العلوم · خطّة الدرس: متابعة درس الكسور ص ٤٠$/)
    const change = db.raw.prepare("SELECT body, link FROM notifications WHERE kind = 'change' ORDER BY id DESC LIMIT 1").get() as { body: string; link: string }
    expect(change.body).toMatch(/^تغيّر معلّم الحصّة الثالثة يوم الخميس [٠-٩]+ (كانون|شباط|آذار|نيسان|أيار|حزيران|تموز|آب|أيلول|تشرين)/)
    expect(change.link).toBe(`/timetable?date=${thursday}&section_id=2`)
    expect(change.body).not.toContain('رنا')
    expect(count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'substitution.approve'")).toBe(1)
    // the students' timetable for that day now shows the substitute
    const rows = (await call('GET', `/api/timetable?section_id=2&day=4&date=${thursday}`, T.layan)).json
    expect(rows.find((x: any) => x.period === 3).substitute).toEqual({ teacher: 'ماهر عادل', status: 'approved' })
    expect(rows.find((x: any) => x.period === 2).substitute).toBeNull()
    const home = (await call('GET', `/api/teacher/home?date=${thursday}`, await login('T-MAHER'))).json
    expect(home.substitutions_for_me).toHaveLength(1)
    expect(home.substitutions_for_me[0]).toMatchObject({ period: 3, section_label: 'الخامس (ب)', lesson_note: 'متابعة درس الكسور ص ٤٠' })
  })
  it('refuses approvals from other schools or for the absent teacher herself', async () => {
    expect((await call('POST', `/api/substitutions/${p5}/approve`, T.sch2, { teacher_id: 11 })).status).toBe(403)
    expect((await call('POST', `/api/substitutions/${p5}/approve`, T.sch1, { teacher_id: 12 })).status).toBe(400)
    expect((await call('POST', `/api/substitutions/${p5}/approve`, T.sch1, { teacher_id: 21 })).status).toBe(403)   // teacher of school 2
    expect((await call('POST', `/api/substitutions/${p5}/approve`, T.samer, { teacher_id: 11 })).status).toBe(403)
  })
  it('marks a period as guided self-study', async () => {
    expect((await call('POST', `/api/substitutions/${p5}/self-study`, T.sch1, {})).status).toBe(400)   // note required
    const r = await call('POST', `/api/substitutions/${p5}/self-study`, T.sch1, { lesson_note: 'حلّ تمارين الصفحة ٥٠' })
    expect(r.json).toMatchObject({ status: 'self_study', substitute: null, notified: 20 })
    const rows = (await call('GET', `/api/timetable?section_id=1&day=4&date=${thursday}`, T.sch1)).json
    expect(rows.find((x: any) => x.period === 5).substitute).toEqual({ teacher: null, status: 'self_study' })
  })
  it('the teacher home shows her own absence with its coverage', async () => {
    const home = (await call('GET', `/api/teacher/home?date=${thursday}`, T.rana)).json
    expect(home.absence_today).toMatchObject({ id: absenceId, reason: 'ظرف عائلي' })
    expect(home.absence_today.affected.map((a: any) => a.status)).toEqual(['approved', 'self_study'])
    expect(home.today.periods).toHaveLength(2)
    expect(home.today.periods[0]).toHaveProperty('attendance_taken', false)
  })
})

describe('dashboards', () => {
  it('school dashboard: the seeded absence of رنا gets its suggestions on first load', async () => {
    const r = await call('GET', '/api/school/dashboard', T.sch1)
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ students: 36, teachers: 7, teachers_present: 6, date: TODAY, attendance_confirmed: false })   // today is still in progress
    expect(r.json.attendance_by_grade.map((g: any) => g.grade)).toEqual([5, 6])
    const rana = r.json.absences.find((a: any) => a.teacher_id === 12)
    expect(rana).toMatchObject({ teacher: 'رنا سعيد', subject: 'العلوم' })
    const expected = weekday(TODAY) <= 4 ? count('SELECT COUNT(*) AS n FROM timetable WHERE teacher_id = 12 AND day = ?', weekday(TODAY)) : 0
    expect(rana.substitutions).toHaveLength(expected)
    for (const s of rana.substitutions) expect(s.candidates.length).toBeGreaterThan(0)
    if (weekday(TODAY) <= 4) {
      expect(r.json.attendance_uploaded).toBe(true)
      expect(r.json.present_pct).toBeGreaterThan(80)
      expect(r.json.uncovered_periods).toBe(expected)
    }
    expect((await call('GET', '/api/school/dashboard?school_id=1', T.dir)).status).toBe(200)   // the directorate may look
  })
  it('directorate dashboard: totals, alerts and the three-day absence', async () => {
    const r = await call('GET', '/api/directorate/dashboard', T.dir)
    expect(r.status).toBe(200)
    expect(r.json.schools).toHaveLength(3)
    expect(r.json.totals.schools_connected).toBe(3)
    expect(r.json.three_day_absences.map((t: any) => t.student_name)).toContain('يزن عماد')
    const three = r.json.alerts.find((a: any) => a.kind === 'three_days')
    expect(three.text).toMatch(/^يزن عماد \(الخامس \(أ\)\): غياب (ثلاثة|أربعة|خمسة) أيام متتالية$/)
    if (weekday(TODAY) <= 4) {
      expect(r.json.schools.find((s: any) => s.id === 3).attendance_uploaded).toBe(false)
      expect(r.json.alerts.some((a: any) => a.kind === 'no_attendance' && a.school === 'مدرسة (ج)')).toBe(true)
    }
    expect((await call('GET', '/api/directorate/dashboard', T.sch1)).status).toBe(403)
  })
  it('CSV report has a BOM and Arabic headers', async () => {
    const res = await app.request('/api/directorate/report.csv', { headers: { authorization: `Bearer ${T.dir}` } }, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain(`madar-report-${TODAY}.csv`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])   // UTF-8 BOM for Excel
    const text = new TextDecoder().decode(bytes)
    expect(text).not.toMatch(PHONE)
    expect(text).toContain('المدرسة,المجمّع')
    expect(text).toContain('مدرسة درعا النموذجية')
    expect(text.split('\r\n').length).toBeGreaterThan(5)
    // the token travels only in the Authorization header (the client downloads with fetch + Blob): ?token= is ignored everywhere
    expect((await app.request(`/api/directorate/report.csv?token=${T.dir}`, {}, env)).status).toBe(401)
    expect((await app.request(`/api/directorate/dashboard?token=${T.dir}`, {}, env)).status).toBe(401)
  })
  it('sections with students for attendance entry (ids and names only)', async () => {
    const all = (await call('GET', '/api/school/sections', T.sch1)).json
    expect(all).toHaveLength(3)
    expect(all[1]).toMatchObject({ label: 'الخامس (ب)', student_count: 12 })
    expect(all[1].students.some((s: any) => s.name === 'ليان أحمد')).toBe(true)
    // `id` and `student_id` carry the same value: the roster component keys on `id`, the attendance POST sends `student_id`
    expect(Object.keys(all[1].students[0]).sort()).toEqual(['has_guardian', 'id', 'name', 'student_id'])
    expect(all[1].students.every((s: any) => Number.isInteger(s.id) && s.id === s.student_id)).toBe(true)
    const roster = (await call('GET', '/api/sections/2/roster', T.sch1)).json
    expect(Object.keys(roster.students[0]).sort()).toEqual(['id', 'name', 'status', 'student_id'])
    expect(roster.students.every((s: any) => s.id === s.student_id)).toBe(true)
    expect((await call('GET', '/api/school/sections', T.samer)).json).toHaveLength(3)
    expect((await call('GET', '/api/school/teachers', T.sch1)).json).toHaveLength(7)
  })
})

describe('announcements, notifications and messages', () => {
  it('a school announcement reaches every guardian; an urgent one is flagged for SMS', async () => {
    const r = await call('POST', '/api/announcements', T.sch1, { title: 'عطلة غدًا', body: 'تعطّل المدرسة غدًا بسبب الأحوال الجوية.', urgent: true })
    expect(r.status).toBe(201)
    expect(r.json.notified).toBe(count("SELECT COUNT(DISTINCT guardian_user_id) AS n FROM students st JOIN sections sec ON sec.id = st.section_id WHERE sec.school_id = 1 AND guardian_user_id IS NOT NULL"))
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'announcement' AND sms = 1 AND link = ?", `/announcements/${r.json.id}`)).toBe(r.json.notified)
    const list = (await call('GET', '/api/announcements', T.khaled)).json
    expect(list[0]).toMatchObject({ title: 'عطلة غدًا', urgent: 1, scope: 'school' })
    expect(list.some((a: any) => a.scope === 'directorate')).toBe(true)
  })
  it('a directorate circular reaches every school account as kind «circular»; the directorate lists circulars only', async () => {
    const r = await call('POST', '/api/announcements', T.dir, { title: 'تعميم تجريبي', body: 'نصّ التعميم.' })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ school_id: null, notified: 3 })
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'circular' AND link = ?", `/announcements/${r.json.id}`)).toBe(3)
    expect((await call('POST', '/api/announcements', T.samer, { title: 'x', body: 'y' })).status).toBe(403)
    const mine = (await call('GET', '/api/announcements', T.dir)).json
    expect(mine.length).toBeGreaterThan(1)
    expect(mine.every((a: any) => a.scope === 'directorate' && a.school_id === null)).toBe(true)
    expect((await call('GET', '/api/announcements?school_id=1', T.dir)).json.some((a: any) => a.scope === 'school')).toBe(true)
  })
  it('lists and marks notifications read', async () => {
    const list = (await call('GET', '/api/notifications', T.khaled)).json
    expect(list.length).toBeGreaterThan(2)
    expect(Object.keys(list[0]).sort()).toEqual(['body', 'created_at', 'id', 'kind', 'link', 'read_at'])
    const r = await call('POST', '/api/notifications/read', T.khaled, { ids: [list[0].id, list[1].id] })
    expect(r.json.updated).toBe(2)
    expect((await call('GET', '/api/notifications', T.khaled)).json.filter((n: any) => n.read_at).length).toBe(2)
  })
  it('parent home: children with today status, homework due and notifications filed under the right child', async () => {
    const r = await call('GET', '/api/parent/home', T.khaled)
    expect(r.status).toBe(200)
    expect(r.json.children).toHaveLength(2)
    const m = r.json.children[0], sara = r.json.children[1]
    expect(m).toMatchObject({ student_id: 13, name: 'محمد خالد', section_id: 2, section_label: 'الخامس (ب)', school_name: 'مدرسة درعا النموذجية' })
    expect(['present', 'absent', 'late', 'none']).toContain(m.today.status)
    expect(m.homework.some((h: any) => h.id === 1)).toBe(true)
    expect(m.teachers.map((t: any) => t.name)).toContain('سامر حسن')
    expect(m.teachers[0]).not.toHaveProperty('phone')
    // the homework and the change of teacher concern محمد (section 2), not his sister in السادس (أ)
    expect(m.notifications.some((n: any) => n.kind === 'homework' && n.link?.includes('student_id=13'))).toBe(true)
    expect(sara.notifications.some((n: any) => n.link?.includes('student_id=13') || n.link?.includes('section_id=2'))).toBe(false)
    expect(m.notifications.some((n: any) => n.kind === 'change' && n.link?.includes('section_id=2'))).toBe(true)
    expect(sara.notifications.some((n: any) => n.kind === 'announcement')).toBe(true)   // school-wide notices appear under every child
    // /api/me names each child's section too (the messaging screen needs it)
    expect((await call('GET', '/api/me', T.khaled)).json.context.children.map((ch: any) => ch.section_id)).toEqual([2, 3])
  })
  it('a parent messages a teacher of the child\'s section only', async () => {
    const ok = await call('POST', '/api/messages', T.khaled, { to_user: 11, body: 'أستاذ سامر، هل يمكن تأجيل تسليم الواجب؟' })
    expect(ok.status).toBe(201)
    expect((await call('POST', '/api/messages', T.khaled, { to_user: 21, body: 'مرحبًا' })).status).toBe(403)   // teacher of another school
    expect((await call('POST', '/api/messages', await login('P-1'), { to_user: 13, body: 'مرحبًا' })).status).toBe(403)   // same school, but ماهر teaches none of this parent's children
    expect((await call('POST', '/api/messages', T.layan, { to_user: 11, body: 'مرحبًا' })).status).toBe(403)    // students do not message
    const threads = (await call('GET', '/api/messages', T.samer)).json
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({ with: { id: 409, role: 'parent' }, unread: 1 })
    expect(threads[0].messages[0].body).toContain('أستاذ سامر')
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 11 AND kind = 'message'")).toBe(1)
    expect((db.raw.prepare("SELECT body FROM notifications WHERE user_id = 11 AND kind = 'message'").get() as { body: string }).body).toBe('رسالة جديدة من خالد (وليّ أمر الطالب)')
    expect((await call('GET', '/api/messages', T.samer)).json[0].unread).toBe(0)   // read on fetch
  })
})

describe('static assets and errors', () => {
  it('unknown API paths are JSON 404s, other paths go to the client shell', async () => {
    const r = await call('GET', '/api/nothing', T.dir)
    expect(r.status).toBe(404)
    expect(r.json.error).toMatch(/[؀-ۿ]/)
    const before = assetHits
    const page = await app.request('/teacher/home', {}, env)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('shell')
    expect(assetHits - before).toBe(2)   // the path, then index.html
    // the shell carries the security headers; the CSP allows the bundle, the inline <style> and the blob: CSV
    expect(page.headers.get('x-frame-options')).toBe('DENY')
    expect(page.headers.get('x-content-type-options')).toBe('nosniff')
    expect(page.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(page.headers.get('content-security-policy')).toMatch(/^default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self' data:; manifest-src 'self'; worker-src 'self'/)
    const missing = await app.request('/assets/missing.js', {}, env)
    expect(missing.status).toBe(404)
    expect(missing.headers.get('x-content-type-options')).toBe('nosniff')
    expect(missing.headers.get('content-security-policy')).toBeNull()   // CSP only on HTML
    expect((await call('GET', '/api/nothing', T.dir)).headers.get('x-frame-options')).toBeNull()   // API answers are JSON, not framed pages
  })
})
