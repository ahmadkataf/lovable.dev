// A background sync (every 30 s, or a new booking) must never wipe what the admin is typing in Settings or a room.
// Run against a local API (see README): node web/e2e/live-form.mjs
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const B = process.env.BASE || 'http://127.0.0.1:8799'
const j = async (m, p, body, h = {}) => { const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, b: await r.json().catch(() => null) } }
let fails = 0
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  → ' + JSON.stringify(x))); if (!c) fails++ }
const login = await j('POST', '/v1/team/login', { phone: '0985258963', password: 'Admin123!' })
const auth = { Authorization: `Bearer ${login.b.token}` }
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript((t) => localStorage.setItem('fp_team_token', t), login.b.token)
const page = await ctx.newPage()
const forceSync = async () => { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(2500) }

// 1) Settings › المركز: typed address survives a sync whose settings object is new but has the same values
await page.goto(B + '/team/settings', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
const addr = page.getByLabel('العنوان').first()
await addr.fill('عنوان قيد الكتابة'); await forceSync()
ok('typed address kept after a background sync', (await addr.inputValue()) === 'عنوان قيد الكتابة', await addr.inputValue())
// a booking arrives (sync + push path) while typing
const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
await j('POST', '/v1/bookings', { room_id: 1, start: `${day}T10:00:00.000Z`, end: `${day}T11:00:00.000Z`, name: 'زبون أثناء الكتابة', phone: '0944000777', method: 'cash' }, { 'X-Device': crypto.randomUUID() })
await forceSync()
ok('typed address kept after a new booking synced', (await addr.inputValue()) === 'عنوان قيد الكتابة', await addr.inputValue())

// 2) A form with no edits shows a value changed elsewhere
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
await j('PATCH', '/v1/admin/settings', { address: 'عنوان من جهاز ثاني' }, auth)
await forceSync()
ok('untouched form shows a change saved elsewhere', (await page.getByLabel('العنوان').first().inputValue()) === 'عنوان من جهاز ثاني', await page.getByLabel('العنوان').first().inputValue())
await j('PATCH', '/v1/admin/settings', { address: 'درعا، شارع المجمع الحكومي – بناء العايش' }, auth)

// 3) Room sheet: typed name survives a sync
await page.goto(B + '/team/rooms', { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
await page.getByText('غرفة 2').first().click(); await page.waitForTimeout(600)
const nameInput = page.locator('.sheet input').first()
await nameInput.fill('غرفة 2 قيد التعديل'); await forceSync()
ok('typed room name kept after a background sync', (await nameInput.inputValue()) === 'غرفة 2 قيد التعديل', await nameInput.inputValue())
await b.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0)
