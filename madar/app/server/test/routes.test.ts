// Route tests: the real Hono app against schema.sql + seed.sql loaded into an in-memory SQLite (test/d1.ts).
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import app from '../src/index'
import { fakeD1 } from './d1'
import { SMS_SIMULATED, addDays, reportDate, today, weekStart, weekday } from '../src/util'
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
  DB: db, WEEKLY_CAP: '28', TOKEN_SECRET: 'test-secret', MADAR_DO, SUPPORT_PHONE: '', SUPPORT_HOURS: '٧:٣٠–١٤:٠٠', APP_URL: 'http://localhost:8787',
  ASSETS: { fetch: async (req: Request) => { assetHits++; return new URL(req.url).pathname === '/index.html' ? new Response('<html>shell</html>', { headers: { 'content-type': 'text/html' } }) : new Response('nope', { status: 404 }) } },
}
const PHONE = /09[34]0\d{6}/   // seeded personal phones look like 0930000011 / 0940000401 / 0940020053 — they must never appear in a response

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
const REPORT = reportDate()   // the demo day: today, or on the weekend the Thursday before (the seed anchors to it)
let thursday = addDays(TODAY, 1)
while (weekday(thursday) !== 4) thursday = addDays(thursday, 1)
// guardians of a section, and those among them who have never opened the app (the pilot's SMS recipients)
const guardiansOf = (sectionId: number) => count('SELECT COUNT(DISTINCT guardian_user_id) AS n FROM students WHERE section_id = ? AND guardian_user_id IS NOT NULL', sectionId)
const noAppGuardians = (sectionId: number) => (db.raw.prepare(`
  SELECT st.id AS student_id FROM students st JOIN users g ON g.id = st.guardian_user_id WHERE st.section_id = ? AND g.phone IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.user_id = st.guardian_user_id AND al.action = 'login') ORDER BY st.id`).all(sectionId) as { student_id: number }[]).map(r => r.student_id)

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
    expect((await call('GET', '/api/notifications', T.samer)).headers.get('cache-control')).toBe('no-store')
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

describe('public config', () => {
  it('needs no token, names the support line and the demo, and may be cached for five minutes', async () => {
    const r = await call('GET', '/api/config')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ support_phone: '', support_hours: '٧:٣٠–١٤:٠٠', demo: true, reseed_hour: '06:00', app_url: 'http://localhost:8787' })
    expect(r.headers.get('cache-control')).toBe('public, max-age=300')
    const withPhone = await call('GET', '/api/config', undefined, undefined, {}, { ...env, SUPPORT_PHONE: '0955000000' })
    expect(withPhone.json.support_phone).toBe('0955000000')
    expect((await call('GET', '/api/config', undefined, undefined, {}, { ...env, SUPPORT_PHONE: undefined, SUPPORT_HOURS: undefined })).json).toMatchObject({ support_phone: '', support_hours: '' })
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
    expect(ok.json.users).toBeGreaterThan(4000)
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
    expect(d.context.schools).toHaveLength(10)
    expect(d.context.schools.map((x: any) => x.name)).toContain('مدرسة بصرى الشام الأولى')
    expect((await call('GET', '/api/me', T.sch1)).json.context.school.complex).toBe('درعا المدينة')
    expect((await call('GET', '/api/me', T.sch2)).json.user.school_name).toBe('مدرسة إزرع الأولى')
  })
})

describe('scope', () => {
  it('a teacher cannot read another school (or a section they do not teach)', async () => {
    expect((await call('GET', '/api/homework?section_id=4', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/timetable?section_id=4', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/sections/4/roster', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/timetable?teacher_id=12', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/school/dashboard', T.samer)).status).toBe(403)   // wrong role
    expect((await call('GET', '/api/sections/21/roster', T.samer)).status).toBe(403)   // same school, a block section he does not teach
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
    const guardians = guardiansOf(2)
    expect(guardians).toBeGreaterThan(8)
    const r = await call('POST', '/api/homework', T.samer, { section_id: 2, subject_id: 2, title: 'واجب تجريبي', book_page: '12', due_date: addDays(TODAY, 2), client_id: 'c-1' })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ notified_students: 28, notified_guardians: guardians })
    expect(count('SELECT COUNT(*) AS n FROM notifications') - before).toBe(28 + guardians)
    // guardians are addressed with «ل» attached to the (compound-aware) first name, no tatweel; their link names the child
    const toGuardians = db.raw.prepare("SELECT body, link FROM notifications WHERE kind = 'homework' AND link LIKE ?").all(`/homework/${r.json.id}?student_id=%`) as { body: string; link: string }[]
    expect(toGuardians).toHaveLength(guardians)
    expect(toGuardians.find(x => x.link === `/homework/${r.json.id}?student_id=13`)?.body).toMatch(/^واجب جديد لمحمد في الرياضيات، يُسلَّم (اليوم|غداً|يوم \S+ [٠-٩]+ \S+( \S+)?)$/)
    expect(toGuardians.some(x => x.body.startsWith('واجب جديد لعبد الرحمن في الرياضيات'))).toBe(true)
    expect(toGuardians.map(x => x.body).join(' ')).not.toContain('لـ')
    expect(db.raw.prepare("SELECT link FROM notifications WHERE kind = 'homework' AND user_id = 114 AND link LIKE ?").get(`/homework/${r.json.id}%`)).toEqual({ link: `/homework/${r.json.id}` })   // the student's own link is plain
    expect(count("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'homework.create' AND target = ?", String(r.json.id))).toBe(1)
    // replaying the same offline item is a no-op
    const again = await call('POST', '/api/homework', T.samer, { section_id: 2, subject_id: 2, title: 'واجب تجريبي', due_date: addDays(TODAY, 2), client_id: 'c-1' })
    expect(again.json).toMatchObject({ id: r.json.id, duplicate: true, notified_students: 0 })
    expect(count('SELECT COUNT(*) AS n FROM notifications') - before).toBe(28 + guardians)
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
  const noApp = noAppGuardians(2).slice(0, 2)   // two students of الخامس (ب) whose guardians never opened the app
  it('upserts the roster and notifies guardians of new absences in-app only', async () => {
    expect(noApp).toHaveLength(2)
    const roster = (await call('GET', `/api/sections/2/roster?date=${date}&period=1`, T.samer)).json
    expect(roster.students).toHaveLength(28)
    // محمد خالد (13, his father has the app) and two students whose guardians have no app are absent; عبد الرحمن (15) is late.
    const absent = new Set([13, ...noApp])
    const records = roster.students.map((s: any) => ({ student_id: s.student_id, status: absent.has(s.student_id) ? 'absent' : s.student_id === 15 ? 'late' : 'present' }))
    const r = await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ saved: 28, absent: 3, late: 1, present: 24, notified_guardians: 3 })
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'absence' AND sms = 0 AND link LIKE ?", `/attendance?date=${date}&%`)).toBe(3)
    // the same POST again (offline replay) does not notify twice
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records })).json.notified_guardians).toBe(0)
    expect((await call('GET', `/api/sections/2/roster?date=${date}&period=1`, T.samer)).json.students.filter((s: any) => s.status === 'absent')).toHaveLength(3)
  })
  it('rejects students outside the section and bad statuses', async () => {
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records: [{ student_id: 1, status: 'absent' }] })).status).toBe(400)
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 2, date, period: 1, records: [{ student_id: 13, status: 'sick' }] })).status).toBe(400)
    expect((await call('POST', '/api/attendance', T.samer, { section_id: 4, date, period: 1, records: [{ student_id: 37, status: 'absent' }] })).status).toBe(403)
  })
  it('the school confirms the day: in-app notices are counted, SMS only for guardians without the app, and labelled as simulated', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect((await call('GET', `/api/school/dashboard?date=${date}`, T.sch1)).json.attendance_confirmed).toBe(false)
      const r = await call('POST', '/api/attendance/confirm', T.sch1, { date })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ confirmed: 28, in_app: 3, sms: 2, sms_simulated: true })
      expect(r.json.message).toBe(`ثُبّت حضور يوم ${['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'][weekday(date)]} ${r.json.message.split(' ')[4]} ${r.json.message.split(' — ')[0].split(' ').slice(5).join(' ')} — إشعارات داخل التطبيق: ٣ · رسائل نصّية (${SMS_SIMULATED}): ٢`)
      expect(r.json.message).not.toMatch(/ًا/)
      expect(log.mock.calls.filter(a => a[0] === '[SMS]')).toHaveLength(2)   // the simulated messages are logged, one per guardian without the app
      expect((await call('GET', `/api/school/dashboard?date=${date}`, T.sch1)).json.attendance_confirmed).toBe(true)
      expect(count('SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND confirmed = 0', date)).toBe(0)
      expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'absence' AND sms = 1 AND link LIKE ?", `/attendance?date=${date}&%`)).toBe(3)   // all flagged; the app user simply needs no SMS
      expect((await call('POST', '/api/attendance/confirm', T.sch1, { date })).json).toMatchObject({ confirmed: 0, in_app: 3, sms: 0 })   // confirming twice sends nothing again
      expect((await call('POST', '/api/attendance/confirm', T.samer, { date })).status).toBe(403)
    } finally { log.mockRestore() }
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
    expect(a3.note).toBeNull()   // a same-subject teacher heads the list: nothing to explain
    expect(a5.section_label).toBe('الخامس (أ)')
    expect(a5.candidates).toHaveLength(3)
    expect(a5.candidates.map((c: any) => c.teacher_id)).not.toContain(13)   // ماهر teaches السادس (أ) then
    expect(a5.candidates.map((c: any) => c.teacher_id)).not.toContain(15)   // خالد teaches الخامس (ب) then
    for (const cand of a5.candidates) expect(count('SELECT COUNT(*) AS n FROM timetable WHERE teacher_id = ? AND day = 4 AND period = 5', cand.teacher_id)).toBe(0)   // every candidate is free
    // the list is explained when no science teacher is free in that period
    if (a5.candidates[0].tier === 1) expect(a5.note).toBeNull()
    else expect(a5.note).toBe('لا معلّم العلوم متاحاً في هذه الحصّة، فاقتُرح معلّمون من مواد أخرى')
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
    const audience = 28 + guardiansOf(2)
    const r = await call('POST', `/api/substitutions/${p3}/approve`, T.sch1, { teacher_id: 13, lesson_note: 'متابعة درس الكسور ص ٤٠' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ substitution_id: p3, status: 'approved', substitute: 'ماهر عادل', lesson_note: 'متابعة درس الكسور ص ٤٠', notified: audience + 1, note: null })
    expect(count('SELECT COUNT(*) AS n FROM notifications') - before).toBe(audience + 1)
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
  it('marks a period as guided self-study; a long note is shortened at a word boundary with «…»', async () => {
    expect((await call('POST', `/api/substitutions/${p5}/self-study`, T.sch1, {})).status).toBe(400)   // note required
    const note = 'حلّ تمارين الصفحة ٥٠ ' + 'ثمّ مراجعة قواعد الجمع والطرح مع كتابة الخطوات كاملة في الدفتر '.repeat(4)
    const r = await call('POST', `/api/substitutions/${p5}/self-study`, T.sch1, { lesson_note: note })
    expect(r.json).toMatchObject({ status: 'self_study', substitute: null, notified: 28 + guardiansOf(1) })
    const change = db.raw.prepare("SELECT body FROM notifications WHERE kind = 'change' ORDER BY id DESC LIMIT 1").get() as { body: string }
    expect(change.body).toMatch(/تعلّم ذاتي موجَّه: حلّ تمارين الصفحة ٥٠ .*[^ ]…$/)
    expect(change.body.length).toBeLessThan(note.length)
    const kept = change.body.split('تعلّم ذاتي موجَّه: ')[1].slice(0, -1)   // what survived of the note, without the «…»
    expect(kept.length).toBeLessThanOrEqual(120)
    expect(note.startsWith(kept)).toBe(true)
    expect(note.charAt(kept.length)).toBe(' ')   // the cut falls on a word boundary of the original note
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

describe('dashboards (the demo day)', () => {
  it('school dashboard: رنا\'s absence is decided (ماهر approved), the second absence has its last periods open for decision', async () => {
    const r = await call('GET', '/api/school/dashboard', T.sch1)
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ students: 328, teachers: 18, teachers_present: 16, date: REPORT, attendance_uploaded: true, attendance_confirmed: false })   // the day is in progress
    expect(r.json.attendance_by_grade.map((g: any) => g.grade)).toEqual([1, 2, 3, 4, 5, 6])
    expect(r.json.present_pct).toBeGreaterThan(85)
    expect(r.json.absences).toHaveLength(2)
    const rana = r.json.absences.find((a: any) => a.teacher_id === 12)
    expect(rana).toMatchObject({ teacher: 'رنا سعيد', subject: 'العلوم' })
    expect(rana.substitutions).toHaveLength(count('SELECT COUNT(*) AS n FROM timetable WHERE teacher_id = 12 AND day = ?', weekday(REPORT)))
    expect(rana.substitutions.some((s: any) => s.status === 'approved' && s.substitute === 'ماهر عادل' && s.candidates[0]?.tier === 1)).toBe(true)
    expect(rana.substitutions.every((s: any) => s.status !== 'suggested')).toBe(true)
    const other = r.json.absences.find((a: any) => a.teacher_id !== 12)
    expect(other.subject).toBe('اللغة العربية')
    const pending = other.substitutions.filter((s: any) => s.status === 'suggested')
    expect(pending).toHaveLength(2)                                                     // the live decisions
    expect(pending.map((s: any) => s.period)).toEqual(other.substitutions.map((s: any) => s.period).slice(-2))   // the day's last two periods
    for (const s of pending) {
      expect(s.candidates.length).toBeGreaterThan(0)
      expect(s).toHaveProperty('note')
      if (s.candidates[0].tier !== 1) expect(s.note).toBe('لا معلّم اللغة العربية متاحاً في هذه الحصّة، فاقتُرح معلّمون من مواد أخرى')
      else expect(s.note).toBeNull()
    }
    expect(other.substitutions.filter((s: any) => s.status === 'approved' || s.status === 'self_study').length).toBe(other.substitutions.length - 2)
    expect(r.json.uncovered_periods).toBe(2)
    expect(r.json.coverage_pct).toBeGreaterThanOrEqual(60)
    expect((await call('GET', '/api/school/dashboard?school_id=1', T.dir)).status).toBe(200)   // the directorate may look
  })
  it('directorate dashboard: ten schools with contacts, realistic totals, the alerts of the day — and the alerts land in the bell once', async () => {
    const r = await call('GET', '/api/directorate/dashboard', T.dir)
    expect(r.status).toBe(200)
    expect(r.json.date).toBe(REPORT)
    expect(r.json.schools).toHaveLength(10)
    expect(r.json.totals.schools_connected).toBe(10)
    expect(r.json.totals.present_pct).toBeGreaterThanOrEqual(86)
    expect(r.json.totals.present_pct).toBeLessThanOrEqual(94)
    expect(r.json.totals.coverage_pct).toBeGreaterThanOrEqual(80)
    expect(r.json.totals.coverage_pct).toBeLessThanOrEqual(92)
    for (const s of r.json.schools) {
      expect(Object.keys(s).sort()).toEqual(['attendance_confirmed', 'attendance_uploaded', 'complex', 'coverage_pct', 'homework_today', 'id', 'name', 'phone', 'present_pct', 'principal', 'students', 'teachers', 'teachers_present', 'three_days', 'uncovered_periods', 'uploaded_at'])
      expect(s.students).toBeGreaterThanOrEqual(200)
      expect(s.teachers).toBeGreaterThanOrEqual(10)
      expect(s.principal).toMatch(/\S+ \S+/)
      expect(s.phone).toMatch(/^0955\d{6}$/)
      expect(s.complex.startsWith('مجمّع')).toBe(false)   // the client prefixes the word
    }
    const busra = r.json.schools.find((s: any) => s.name === 'مدرسة بصرى الشام الأولى')
    expect(busra).toMatchObject({ attendance_uploaded: false, uploaded_at: null, present_pct: null })
    const jasim = r.json.schools.find((s: any) => s.name === 'مدرسة جاسم الثانية')
    expect(jasim.present_pct).toBeGreaterThanOrEqual(76)
    expect(jasim.present_pct).toBeLessThanOrEqual(84)
    expect(r.json.schools.find((s: any) => s.id === 1)).toMatchObject({ three_days: 1, uncovered_periods: 2 })
    expect(r.json.schools.find((s: any) => s.id === 1).uploaded_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(r.json.schools.filter((s: any) => !s.attendance_uploaded)).toHaveLength(1)
    expect(r.json.three_day_absences.map((t: any) => t.student_name)).toEqual(['يزن عماد'])
    const three = r.json.alerts.find((a: any) => a.kind === 'three_days')
    expect(three.text).toMatch(/^يزن عماد \(الخامس \(أ\)\): غياب (ثلاثة|أربعة|خمسة) أيام متتالية$/)
    expect(r.json.alerts.filter((a: any) => a.kind === 'no_attendance').map((a: any) => a.school)).toEqual(['مدرسة بصرى الشام الأولى'])
    const uncovered = r.json.alerts.filter((a: any) => a.kind === 'uncovered')
    expect(uncovered.map((a: any) => a.school_id)).toEqual([1, 4, 5, 6])
    expect(uncovered.map((a: any) => a.text)).toEqual(['حصّتان من دون تغطية', 'حصّة واحدة من دون تغطية', 'حصّة واحدة من دون تغطية', 'حصّتان من دون تغطية'])
    expect(r.json.totals.alerts_count).toBe(r.json.alerts.length)
    expect(r.json.alerts.length).toBe(6)
    // the bell: one notification per alert, with a link to the school page; a second load adds nothing
    const bell = (await call('GET', '/api/notifications', T.dir)).json
    const alerts = bell.filter((n: any) => ['no_attendance', 'uncovered', 'three_days'].includes(n.kind))
    expect(alerts).toHaveLength(6)
    expect(alerts.find((n: any) => n.kind === 'no_attendance').link).toBe(`/directorate/school/8?date=${REPORT}`)
    expect(alerts.find((n: any) => n.kind === 'no_attendance').body).toMatch(/^مدرسة بصرى الشام الأولى: لم يُرفع حضور (اليوم|يوم \S+ [٠-٩]+ \S+( \S+)?) بعد$/)
    expect(alerts.find((n: any) => n.kind === 'uncovered' && n.link === `/directorate/school/1?date=${REPORT}`).body).toMatch(/^مدرسة درعا النموذجية: حصص من دون تغطية (اليوم|يوم )/)
    expect(alerts.find((n: any) => n.kind === 'three_days').body).toMatch(/^مدرسة درعا النموذجية — يزن \(الخامس \(أ\)\): غياب (ثلاثة|أربعة|خمسة) أيام متتالية$/)
    expect(alerts.find((n: any) => n.kind === 'three_days').link).toBe(`/directorate/school/1?date=${REPORT}`)
    await call('GET', '/api/directorate/dashboard', T.dir)
    await call('GET', `/api/directorate/dashboard?date=${REPORT}`, T.dir)
    expect((await call('GET', '/api/notifications', T.dir)).json.filter((n: any) => ['no_attendance', 'uncovered', 'three_days'].includes(n.kind))).toHaveLength(6)
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 1 AND kind IN ('no_attendance', 'uncovered', 'three_days')")).toBe(6)
    expect((await call('GET', '/api/directorate/dashboard', T.sch1)).status).toBe(403)
  })
  it('the school page: contacts, the day, every absence with its periods, early warnings and a 7-day trend', async () => {
    const r = await call('GET', `/api/directorate/school/1?date=${REPORT}`, T.dir)
    expect(r.status).toBe(200)
    expect(Object.keys(r.json).sort()).toEqual(['absences', 'date', 'day', 'school', 'three_days', 'trend', 'uncovered'])
    expect(r.json.school).toMatchObject({ id: 1, name: 'مدرسة درعا النموذجية', complex: 'درعا المدينة', principal: 'عماد الحوراني', students: 328, teachers: 18 })
    expect(r.json.school.phone).toMatch(/^0955\d{6}$/)
    expect(Object.keys(r.json.day).sort()).toEqual(['absent', 'attendance_pct', 'confirmed', 'coverage_pct', 'homework_today', 'late', 'present', 'teachers_present', 'uploaded_at'])
    expect(r.json.day.present + r.json.day.absent + r.json.day.late).toBe(328)
    expect(r.json.day).toMatchObject({ confirmed: false, teachers_present: 16 })
    expect(r.json.day.uploaded_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(r.json.absences).toHaveLength(2)
    const rana = r.json.absences.find((a: any) => a.teacher === 'رنا سعيد')
    expect(rana).toMatchObject({ subject: 'العلوم', reason: 'إجازة صحيّة' })
    expect(rana.periods[0]).toMatchObject({ status: expect.stringMatching(/^(approved|self_study)$/) })
    expect(Object.keys(rana.periods[0]).sort()).toEqual(['lesson_note', 'note', 'period', 'section', 'status', 'subject', 'substitute'])
    expect(rana.periods.some((p: any) => p.status === 'approved' && p.substitute === 'ماهر عادل')).toBe(true)
    const other = r.json.absences.find((a: any) => a.teacher !== 'رنا سعيد')
    expect(other.periods.filter((p: any) => p.status === 'pending')).toHaveLength(2)
    expect(r.json.uncovered).toHaveLength(2)
    expect(r.json.uncovered[0]).toMatchObject({ teacher: other.teacher, subject: 'اللغة العربية' })
    expect(r.json.three_days).toEqual([{ student: 'يزن عماد', section: 'الخامس (أ)', days: expect.any(Number) }])
    expect(r.json.trend).toHaveLength(7)
    expect(r.json.trend[6].date).toBe(REPORT)
    expect(r.json.trend.filter((t: any) => t.attendance_pct !== null)).toHaveLength(5)   // five school days of data
    expect(r.json.trend.map((t: any) => t.date)).toEqual([...r.json.trend.map((t: any) => t.date)].sort())
    // the school that has not uploaded, and a wrong id
    const busra = (await call('GET', `/api/directorate/school/8?date=${REPORT}`, T.dir)).json
    expect(busra.day).toMatchObject({ attendance_pct: null, present: 0, uploaded_at: null })
    expect(busra.school.name).toBe('مدرسة بصرى الشام الأولى')
    expect((await call('GET', '/api/directorate/school/999', T.dir)).status).toBe(404)
    expect((await call('GET', '/api/directorate/school/abc', T.dir)).status).toBe(400)
    // other roles may not look
    expect((await call('GET', '/api/directorate/school/1', T.sch1)).status).toBe(403)
    expect((await call('GET', '/api/directorate/school/1', T.samer)).status).toBe(403)
    expect((await call('GET', '/api/directorate/school/1', T.khaled)).status).toBe(403)
    expect((await call('GET', '/api/directorate/school/1')).status).toBe(401)
  })
  it('the weekly report: Sunday–Thursday per school with governorate totals', async () => {
    const r = await call('GET', `/api/directorate/report?week=${REPORT}`, T.dir)
    expect(r.status).toBe(200)
    const from = weekStart(REPORT)
    expect(r.json).toMatchObject({ from, to: addDays(from, 4), school_days: 5 })
    expect(r.json.schools).toHaveLength(10)
    const keys = ['absences', 'attendance_avg_pct', 'days_uploaded', 'self_study', 'substitutions_approved', 'three_days', 'uncovered']
    expect(Object.keys(r.json.schools[0]).sort()).toEqual([...keys, 'complex', 'id', 'name', 'phone', 'principal', 'students', 'teachers'].sort())
    expect(Object.keys(r.json.totals).sort()).toEqual(keys)
    const s1 = r.json.schools.find((s: any) => s.id === 1)
    expect(s1).toMatchObject({ name: 'مدرسة درعا النموذجية', students: 328, teachers: 18, three_days: 1 })
    expect(s1.days_uploaded).toBeGreaterThanOrEqual(1)
    expect(s1.days_uploaded).toBeLessThanOrEqual(5)
    expect(s1.attendance_avg_pct).toBeGreaterThan(85)
    expect(s1.absences).toBeGreaterThanOrEqual(2)
    expect(s1.uncovered).toBeGreaterThanOrEqual(2)
    expect(r.json.totals.absences).toBe(r.json.schools.reduce((n: number, s: any) => n + s.absences, 0))
    expect(r.json.totals.days_uploaded).toBe(r.json.schools.reduce((n: number, s: any) => n + s.days_uploaded, 0))
    expect(r.json.totals.attendance_avg_pct).toBeGreaterThanOrEqual(85)
    expect(r.json.totals.three_days).toBe(1)
    // any date of the week gives the same week; the default is the current week; other roles are refused
    expect((await call('GET', `/api/directorate/report?week=${addDays(from, 4)}`, T.dir)).json.from).toBe(from)
    expect((await call('GET', '/api/directorate/report', T.dir)).json.from).toBe(from)
    expect((await call('GET', '/api/directorate/report', T.sch1)).status).toBe(403)
    expect((await call('GET', '/api/directorate/report', T.layan)).status).toBe(403)
  })
  it('CSV reports (daily and weekly) have a BOM and Arabic headers, and carry the principal and the phone', async () => {
    const res = await app.request('/api/directorate/report.csv', { headers: { authorization: `Bearer ${T.dir}` } }, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain(`madar-report-${REPORT}.csv`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])   // UTF-8 BOM for Excel
    const text = new TextDecoder().decode(bytes)
    expect(text).not.toMatch(PHONE)
    expect(text).toContain('المدرسة,المجمّع,المدير,الهاتف')
    expect(text).toContain('مدرسة درعا النموذجية,درعا المدينة,عماد الحوراني,0955')
    expect(text.split('\r\n').length).toBeGreaterThan(12)
    const weekly = await app.request(`/api/directorate/report.csv?week=${REPORT}`, { headers: { authorization: `Bearer ${T.dir}` } }, env)
    expect(weekly.headers.get('content-disposition')).toContain(`madar-week-${weekStart(REPORT)}.csv`)
    const wtext = await weekly.text()
    expect(wtext).toContain('التقرير الأسبوعي')
    expect(wtext).toContain('متوسّط الحضور %')
    expect(wtext.split('\r\n').filter(l => l.startsWith('مدرسة'))).toHaveLength(10)
    expect(wtext).toContain('\r\nالمجموع,')
    // the token travels only in the Authorization header (the client downloads with fetch + Blob): ?token= is ignored everywhere
    expect((await app.request(`/api/directorate/report.csv?token=${T.dir}`, {}, env)).status).toBe(401)
    expect((await app.request(`/api/directorate/dashboard?token=${T.dir}`, {}, env)).status).toBe(401)
  })
  it('sections with students for attendance entry (ids and names only)', async () => {
    const all = (await call('GET', '/api/school/sections', T.sch1)).json
    expect(all).toHaveLength(11)
    expect(all.map((s: any) => s.grade)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6])
    const fiveB = all.find((s: any) => s.label === 'الخامس (ب)')
    expect(fiveB).toMatchObject({ id: 2, student_count: 28 })
    expect(fiveB.students.some((s: any) => s.name === 'ليان أحمد')).toBe(true)
    // `id` and `student_id` carry the same value: the roster component keys on `id`, the attendance POST sends `student_id`
    expect(Object.keys(fiveB.students[0]).sort()).toEqual(['has_guardian', 'id', 'name', 'student_id'])
    expect(fiveB.students.every((s: any) => Number.isInteger(s.id) && s.id === s.student_id)).toBe(true)
    const roster = (await call('GET', '/api/sections/2/roster', T.sch1)).json
    expect(Object.keys(roster.students[0]).sort()).toEqual(['id', 'name', 'status', 'student_id'])
    expect(roster.students.every((s: any) => s.id === s.student_id)).toBe(true)
    expect((await call('GET', '/api/school/sections', T.samer)).json).toHaveLength(3)   // سامر teaches the three pitch sections only
    expect((await call('GET', '/api/school/teachers', T.sch1)).json).toHaveLength(18)
  })
})

describe('announcements, notifications and messages', () => {
  it('a school announcement reaches every guardian in the app; an urgent one is flagged for SMS, simulated for guardians without the app', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const guardians = count("SELECT COUNT(DISTINCT guardian_user_id) AS n FROM students st JOIN sections sec ON sec.id = st.section_id WHERE sec.school_id = 1 AND guardian_user_id IS NOT NULL")
      const withoutApp = count(`SELECT COUNT(DISTINCT st.guardian_user_id) AS n FROM students st JOIN sections sec ON sec.id = st.section_id JOIN users g ON g.id = st.guardian_user_id
        WHERE sec.school_id = 1 AND g.phone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.user_id = g.id AND al.action = 'login')`)
      expect(withoutApp).toBeGreaterThan(20)
      expect(withoutApp).toBeLessThan(guardians)
      const r = await call('POST', '/api/announcements', T.sch1, { title: 'عطلة غداً', body: 'تعطّل المدرسة غداً بسبب الأحوال الجوية.', urgent: true })
      expect(r.status).toBe(201)
      expect(r.json).toMatchObject({ notified: guardians, sms: withoutApp, sms_simulated: true })
      expect(r.json.message).toMatch(new RegExp(`^أُرسل الإعلان داخل التطبيق إلى [٠-٩]+ وليّ أمر · يصل أيضاً برسالة نصّية لمن لا يملك التطبيق \\(${SMS_SIMULATED}\\): [٠-٩]+$`))
      expect(log.mock.calls.filter(a => a[0] === '[SMS]')).toHaveLength(withoutApp)
      expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'announcement' AND sms = 1 AND link = ?", `/announcements/${r.json.id}`)).toBe(guardians)
      const list = (await call('GET', '/api/announcements', T.khaled)).json
      expect(list[0]).toMatchObject({ title: 'عطلة غداً', urgent: 1, scope: 'school' })
      expect(list.some((a: any) => a.scope === 'directorate')).toBe(true)
      // a calm one: nothing is sent by SMS, and the message says so by not claiming any
      const calm = await call('POST', '/api/announcements', T.sch1, { title: 'معرض الرسم', body: 'يُقام معرض الرسم يوم الأربعاء.', urgent: false })
      expect(calm.json).toMatchObject({ sms: 0, notified: guardians })
      expect(calm.json.message).not.toContain('نصّية')
    } finally { log.mockRestore() }
  })
  it('a directorate circular reaches every school account as kind «circular»; the directorate lists circulars only', async () => {
    const r = await call('POST', '/api/announcements', T.dir, { title: 'تعميم تجريبي', body: 'نصّ التعميم.' })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ school_id: null, notified: 10, sms: 0, message: 'أُرسل التعميم إلى ١٠ مدارس' })
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'circular' AND link = ?", `/announcements/${r.json.id}`)).toBe(10)
    expect((await call('POST', '/api/announcements', T.samer, { title: 'x', body: 'y' })).status).toBe(403)
    const mine = (await call('GET', '/api/announcements', T.dir)).json
    expect(mine.length).toBeGreaterThan(1)
    expect(mine.every((a: any) => a.scope === 'directorate' && a.school_id === null)).toBe(true)
    expect((await call('GET', '/api/announcements?school_id=1', T.dir)).json.some((a: any) => a.scope === 'school')).toBe(true)
    // a long title is shortened for the bell at a word boundary
    const long = await call('POST', '/api/announcements', T.dir, { title: 'تعميم بشأن ' + 'تحديث بيانات الطلاب وأولياء الأمور '.repeat(5), body: 'نصّ.' })
    const body = (db.raw.prepare("SELECT body FROM notifications WHERE kind = 'circular' AND link = ? LIMIT 1").get(`/announcements/${long.json.id}`) as { body: string }).body
    expect(body.length).toBeLessThan(120)
    expect(body).toMatch(/^تعميم من المديرية: تعميم بشأن .*[^ ]…$/)
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
    expect((await call('POST', '/api/messages', T.khaled, { to_user: 21, body: 'مرحباً' })).status).toBe(403)   // teacher of another school
    expect((await call('POST', '/api/messages', await login('P-1'), { to_user: 13, body: 'مرحباً' })).status).toBe(403)   // same school, but ماهر teaches none of this parent's children
    expect((await call('POST', '/api/messages', T.layan, { to_user: 11, body: 'مرحباً' })).status).toBe(403)    // students do not message
    const threads = (await call('GET', '/api/messages', T.samer)).json
    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({ with: { id: 409, role: 'parent' }, unread: 1 })
    expect(threads[0].messages[0].body).toContain('أستاذ سامر')
    expect(count("SELECT COUNT(*) AS n FROM notifications WHERE user_id = 11 AND kind = 'message'")).toBe(1)
    expect((db.raw.prepare("SELECT body FROM notifications WHERE user_id = 11 AND kind = 'message'").get() as { body: string }).body).toBe('رسالة جديدة من خالد (وليّ أمر الطالب)')
    expect((await call('GET', '/api/messages', T.samer)).json[0].unread).toBe(0)   // read on fetch
  })
  it('the demo bells are not empty: the school account, the substitute, the student and the parent all have the day\'s notices', async () => {
    const sch = (await call('GET', '/api/notifications', T.sch1)).json
    expect(sch.some((n: any) => n.kind === 'absence_teacher' && n.body === 'غياب أ. رنا سعيد اليوم: حصّتان بحاجة إلى تغطية')).toBe(true)
    expect(sch.some((n: any) => n.kind === 'absence_teacher' && /^غياب أ\. \S+ \S+ (اليوم|يوم .*): حصّتان بحاجة إلى تغطية$/.test(n.body) && !n.body.includes('رنا'))).toBe(true)   // the engine's notice for the pending absence
    const maher = (await call('GET', '/api/notifications', await login('T-MAHER'))).json
    expect(maher.some((n: any) => n.kind === 'substitution' && /^تكليفك بتغطية الحصّة \S+ اليوم — الخامس \((أ|ب)\) · العلوم/.test(n.body))).toBe(true)
    const layan = (await call('GET', '/api/notifications', T.layan)).json
    expect(layan.some((n: any) => n.kind === 'change' && /^تغيّر معلّم الحصّة \S+ اليوم$/.test(n.body))).toBe(true)
    expect(layan.some((n: any) => n.kind === 'homework')).toBe(true)
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
