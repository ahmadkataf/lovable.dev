// Focus Point — UI smoke with Playwright (headless Chromium) against the Worker on :8799 (web/dist + API). See docs/SMOKE.md.
// Usage: UI_DAY=<home day chip, fresh per run> node docs/smoke/ui-smoke.mjs   (needs the admin from api-smoke.mjs)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')   // focuspoint/
const { chromium } = createRequire(resolve(ROOT, 'web', 'package.json'))('playwright')
const BASE = 'http://127.0.0.1:8799'
const SHOTS = resolve(ROOT, 'docs', 'screens')
const ADMIN = { phone: '0985258963', password: 'Admin123!' }
let passed = 0, failed = 0
const ok = (c, label, extra = '') => { if (c) { passed++; console.log('PASS', label) } else { failed++; console.log('FAIL', label, extra) } }
const errors = []
function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console.error: ${m.text()}`) })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const api = async (path, opts = {}) => { const r = await fetch(BASE + path, opts); return { status: r.status, data: await r.json().catch(() => null) } }
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const DAY = Number(process.env.UI_DAY || 2)   // chip index on the home screen (0 = today); each run must use a fresh day

const browser = await chromium.launch()
try {
  // ---------- customer (phone) ----------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-SY' })
  const c = await phone.newPage(); watch(c, 'customer')
  await c.goto(BASE + '/', { waitUntil: 'networkidle' })
  await c.waitForSelector('svg.plan g.plan-room rect', { timeout: 15000 })
  const rects = await c.locator('svg.plan g.plan-room rect').count()
  ok(rects === 6, `home: plan renders ${rects} room rects`)
  ok(await c.locator('.room-card').count() === 6, 'home: 6 room cards')
  ok((await c.title()).length > 0 && await c.locator('text=احجز مكانك بدرعا').count() === 1, 'home: hero title')
  await c.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: true })

  // pick day +2 and 16:00 for 2 hours, then room 1 from the plan
  await c.locator('.chip').nth(DAY).click()
  await c.locator('select').nth(0).selectOption('16:00')
  await c.locator('select').nth(1).selectOption('120')
  await c.locator('svg.plan g.plan-room').first().click()
  await c.waitForSelector('.sheet', { timeout: 5000 })
  ok(await c.locator('.sheet-title').innerText() === 'غرفة 1', 'room sheet opens for غرفة 1')
  ok(await c.locator('.sheet .price-line b').innerText().then((t) => t.includes('30')), 'room sheet shows 2h price (30,000)')
  await c.screenshot({ path: `${SHOTS}/02-room-sheet.png` })
  await c.locator('.sheet button:has-text("احجز هالغرفة")').click()
  await c.waitForURL(/\/book\/\d+/)
  ok(/\/book\/1\?date=.*&start=16:00&minutes=120/.test(c.url()), 'navigates to /book/1 with the pick')

  await c.fill('input[autocomplete="name"]', 'ليلى')
  await c.fill('input[type="tel"]', '0944555666')
  await c.screenshot({ path: `${SHOTS}/03-book-form.png`, fullPage: true })
  await c.locator('button:has-text("تأكيد الحجز")').click()
  await c.waitForURL(/\/b\/\d+/, { timeout: 15000 })
  const bookingId = Number(c.url().split('/b/')[1])
  await c.waitForSelector('text=ادفع عبر شام كاش', { timeout: 10000 })
  const values = await c.locator('.copy-value').allInnerTexts()
  ok(values[0] === '0985258963', 'payment panel: Sham Cash number', JSON.stringify(values))
  ok(values[1].includes('30'), 'payment panel: amount 30,000', values[1])
  ok(/^[A-Z0-9]{6}$/.test(values[2]), 'payment panel: 6-char code', values[2])
  ok(await c.locator('.countdown').count() === 1, 'payment panel: countdown')
  await c.screenshot({ path: `${SHOTS}/04-payment.png`, fullPage: true })
  const bookingCode = values[2]

  await c.fill('input[placeholder="مثال: 123456789"]', 'UI' + Date.now().toString().slice(-8))
  await c.locator('button:has-text("أرسلت المبلغ")').click()
  await c.waitForSelector('text=وصلنا، عم نتحقق', { timeout: 10000 })
  ok(true, 'payment ref submitted → awaiting verification screen')
  await c.screenshot({ path: `${SHOTS}/05-awaiting.png`, fullPage: true })

  await c.goto(BASE + '/mine', { waitUntil: 'networkidle' })
  await c.waitForSelector('.booking-row', { timeout: 10000 })
  ok(await c.locator('.booking-row').filter({ hasText: 'غرفة 1' }).filter({ hasText: 'عم نتحقق من الدفع' }).count() === 1, '/mine lists the booking (room + status)')
  await c.screenshot({ path: `${SHOTS}/06-mine.png`, fullPage: true })

  // ---------- team (desktop) ----------
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-SY' })
  const t = await desk.newPage(); watch(t, 'team')
  await t.goto(BASE + '/team', { waitUntil: 'networkidle' })
  await t.waitForSelector('.login-card', { timeout: 15000 })
  await t.screenshot({ path: `${SHOTS}/10-team-login.png` })
  await t.fill('.login-card input[type="tel"]', ADMIN.phone)
  await t.fill('.login-card input[type="password"]', ADMIN.password)
  await t.locator('.login-card button[type="submit"]').click()
  await t.waitForSelector('.tp-head', { timeout: 15000 })
  await t.waitForSelector('.verify', { timeout: 15000 })
  ok(await t.locator('.verify').filter({ hasText: 'ليلى' }).count() === 1, 'team today: pending verification for ليلى')
  ok(await t.locator('.verify').filter({ hasText: bookingCode }).count() === 1, 'team today: shows the booking code')
  await t.waitForFunction(() => document.querySelector('.sync-pill')?.textContent?.includes('متصل'), null, { timeout: 15000 })
  await t.screenshot({ path: `${SHOTS}/11-team-today.png`, fullPage: true })
  await t.locator('.verify').filter({ hasText: 'ليلى' }).locator('button:has-text("تأكيد")').click()
  await t.waitForFunction((code) => !document.querySelector('.verify')?.textContent?.includes(code), bookingCode, { timeout: 10000 })
  ok(true, 'team: confirm removes the pending card (optimistic)')
  await t.waitForFunction(() => { const p = document.querySelector('.sync-pill')?.textContent || ''; return p.includes('متصل') && !p.includes('بانتظار') }, null, { timeout: 15000 })
  const after = await api(`/v1/bookings/${bookingId}`, { headers: { Authorization: 'Bearer ' + (await api('/v1/team/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) })).data.token } })
  ok(after.data?.status === 'confirmed', 'server: booking confirmed after team click', JSON.stringify(after.data?.status))

  // customer sees it (poll or reload)
  await c.goto(BASE + `/b/${bookingId}`, { waitUntil: 'networkidle' })
  await c.waitForSelector('text=حجزك مؤكد', { timeout: 10000 })
  ok(true, 'customer: booking page shows حجزك مؤكد')
  await c.screenshot({ path: `${SHOTS}/07-confirmed.png`, fullPage: true })
  await c.goto(BASE + '/inbox', { waitUntil: 'networkidle' })
  ok(await c.locator('text=تأكيد').count() >= 1 || await c.locator('text=مؤكد').count() >= 1, 'customer: inbox has the confirmation')
  await c.screenshot({ path: `${SHOTS}/08-inbox.png`, fullPage: true })

  // ---------- plan editor: drag + save ----------
  await t.goto(BASE + '/team/plan', { waitUntil: 'networkidle' })
  await t.waitForSelector('svg.pe-svg g rect.room', { timeout: 15000 })
  const roomRect = t.locator('svg.pe-svg g rect.room').first()
  const before = await roomRect.evaluate((el) => ({ x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')) }))
  const box = await roomRect.boundingBox()
  await t.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await t.mouse.down()
  for (let i = 1; i <= 8; i++) await t.mouse.move(box.x + box.width / 2 + i * 10, box.y + box.height / 2 + i * 6)
  await t.mouse.up()
  const afterDrag = await roomRect.evaluate((el) => ({ x: Number(el.getAttribute('x')), y: Number(el.getAttribute('y')) }))
  ok(afterDrag.x !== before.x || afterDrag.y !== before.y, `plan: drag moved room ${JSON.stringify(before)} → ${JSON.stringify(afterDrag)}`)
  ok(afterDrag.x % 20 === 0 && afterDrag.y % 20 === 0, 'plan: snapped to 20-unit grid')
  await t.screenshot({ path: `${SHOTS}/12-team-plan.png`, fullPage: true })
  const saveBtn = t.locator('.tp-pagehead button', { hasText: /^\s*حفظ\s*$/ })
  ok(await saveBtn.isEnabled(), 'plan: save enabled after drag')
  await saveBtn.click()
  await t.waitForFunction(() => { const p = document.querySelector('.sync-pill')?.textContent || ''; return p.includes('متصل') && !p.includes('بانتظار') && !p.includes('جارٍ') }, null, { timeout: 15000 })
  await sleep(500)
  const rooms = (await api('/v1/rooms')).data
  const r1 = rooms.find((r) => r.name === 'غرفة 1')
  ok(r1.plan.x === afterDrag.x && r1.plan.y === afterDrag.y, 'server: room plan saved via sync', JSON.stringify(r1.plan))
  ok(await saveBtn.isDisabled(), 'plan: save disabled again (clean)')

  // ---------- offline ----------
  await t.goto(BASE + '/team', { waitUntil: 'networkidle' })
  await t.waitForSelector('.tl-room', { timeout: 15000 })
  await t.evaluate(() => navigator.serviceWorker.ready)
  await sleep(1500)   // let the SW finish precaching the shell
  await desk.setOffline(true)
  await t.reload({ waitUntil: 'domcontentloaded' })
  await t.waitForSelector('.tp-head', { timeout: 15000 }).catch(() => {})
  ok(await t.locator('.tp-head').count() === 1, 'offline: team shell loads from the service worker cache')
  await t.waitForSelector('.tl-room', { timeout: 10000 }).catch(() => {})
  const offlineRooms = await t.locator('.tl-room').count()
  ok(offlineRooms === 6, `offline: today shows ${offlineRooms} rooms from IndexedDB`)
  await t.waitForFunction(() => document.querySelector('.sync-pill')?.textContent?.includes('دون اتصال'), null, { timeout: 10000 })
  ok(true, 'offline: pill says دون اتصال')
  await t.goto(BASE + '/team/bookings', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await t.waitForSelector('.tp-page', { timeout: 10000 })
  await t.locator('.tp-pagehead button:has-text("قائمة")').click()
  await t.fill('input[aria-label="بحث"]', 'ليلى')
  await sleep(300)
  const hasBookings = await t.locator('.brow').filter({ hasText: 'ليلى' }).count()
  ok(hasBookings >= 1, 'offline: bookings list shows cached bookings (ليلى)', String(hasBookings))
  await t.screenshot({ path: `${SHOTS}/13-team-offline-bookings.png`, fullPage: true })
  await t.goto(BASE + '/team', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await t.waitForSelector('.tp-pagehead button:has-text("حجز")', { timeout: 10000 })
  await t.locator('.tp-pagehead button:has-text("حجز")').click()
  await t.waitForSelector('.sheet', { timeout: 5000 })
  await t.locator('.sheet input[type="date"]').fill(day(DAY + 1))
  await t.locator('.sheet select').nth(0).selectOption({ index: 2 })
  await t.locator('.sheet select').nth(1).selectOption('11:00')
  await t.locator('.sheet label.field:has-text("اسم الزبون") input').fill('زائر دون اتصال')
  await t.locator('.sheet input[type="tel"]').fill('0933777888')
  await t.locator('.sheet button:has-text("تأكيد الحجز")').click()
  await t.waitForSelector('.sheet', { state: 'detached', timeout: 10000 })
  await t.waitForFunction(() => (document.querySelector('.sync-pill')?.textContent || '').includes('دون اتصال · 1'), null, { timeout: 10000 })
  ok(true, 'offline: manual booking queued → pill "دون اتصال · 1"')
  await t.screenshot({ path: `${SHOTS}/14-team-offline-queued.png`, fullPage: true })
  // survives reload
  await t.reload({ waitUntil: 'domcontentloaded' })
  await t.waitForFunction(() => (document.querySelector('.sync-pill')?.textContent || '').includes('دون اتصال · 1'), null, { timeout: 15000 })
  ok(true, 'offline: queued op survives a reload (IndexedDB)')
  // back online
  await desk.setOffline(false)
  await t.waitForFunction(() => { const p = document.querySelector('.sync-pill')?.textContent || ''; return p.includes('متصل') && !p.includes('دون') && !p.includes('بانتظار') && !p.includes('جارٍ') }, null, { timeout: 30000 })
  ok(true, 'online again: queue flushed, pill "متصل"')
  await sleep(500)
  const token = (await api('/v1/team/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) })).data.token
  const list = (await api(`/v1/team/bookings?from=${day(DAY + 1)}&to=${day(DAY + 1)}&q=0933777888`, { headers: { Authorization: 'Bearer ' + token } })).data
  ok(Array.isArray(list) && list.length === 1 && list[0].status === 'confirmed' && list[0].method === 'cash', 'server: offline walk-in booking synced and confirmed', JSON.stringify(list).slice(0, 200))
  ok(await t.locator('.tp-page').count() === 1, 'team page still rendered after sync')
  await t.screenshot({ path: `${SHOTS}/15-team-synced.png`, fullPage: true })

  // a few more screens for the record
  await t.goto(BASE + '/team/bookings', { waitUntil: 'networkidle' }); await t.screenshot({ path: `${SHOTS}/16-team-bookings.png`, fullPage: true })
  await t.goto(BASE + '/team/rooms', { waitUntil: 'networkidle' }); await t.screenshot({ path: `${SHOTS}/17-team-rooms.png`, fullPage: true })
  await t.goto(BASE + '/team/settings', { waitUntil: 'networkidle' }); await t.screenshot({ path: `${SHOTS}/18-team-settings.png`, fullPage: true })
  const p2 = await phone.newPage(); watch(p2, 'team-phone')
  await p2.goto(BASE + '/team', { waitUntil: 'networkidle' })
  await p2.fill('.login-card input[type="tel"]', ADMIN.phone); await p2.fill('.login-card input[type="password"]', ADMIN.password)
  await p2.locator('.login-card button[type="submit"]').click()
  await p2.waitForSelector('.tl-room', { timeout: 15000 })
  await p2.screenshot({ path: `${SHOTS}/19-team-phone.png`, fullPage: true })
  ok(await p2.locator('.tp-tabs').isVisible(), 'team on phone: bottom tabs visible')
} catch (e) {
  failed++; console.log('FAIL (exception)', e.stack || e.message)
} finally {
  await browser.close()
}
const realErrors = errors.filter((e) => !/favicon|manifest|net::ERR_INTERNET_DISCONNECTED|Failed to load resource|the server responded with a status of 4/.test(e))
console.log('\nconsole/page errors:', realErrors.length ? realErrors.join('\n') : 'none')
console.log('all errors:', errors.length); for (const e of errors) console.log('  ', e.slice(0, 160))
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
