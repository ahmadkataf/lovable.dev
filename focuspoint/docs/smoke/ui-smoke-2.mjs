// Focus Point — UI smoke #2 (Playwright, headless Chromium, phone 390×844) against the Worker on :8799. See docs/SMOKE.md §8.
// Covers the 2026-10-25 additions: pay on arrival (customer → team live panel via the 5-second ping poll, no reload),
// /privacy, the install banner, and (bonus, via CDP) a Web Push delivered to the team service worker → «جديد» badge.
// Usage: UI_DAY=<home day chip, fresh per run> node docs/smoke/ui-smoke-2.mjs   (needs the admin from api-smoke.mjs)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')   // focuspoint/
const { chromium } = createRequire(resolve(ROOT, 'web', 'package.json'))('playwright')
const BASE = 'http://127.0.0.1:8799'
const SHOTS = resolve(ROOT, 'docs', 'screens')
const ADMIN = { phone: '0985258963', password: 'Admin123!' }
const DAY = Number(process.env.UI_DAY || 4)   // chip index on the home screen (0 = today); each run must use a fresh day
const CUSTOMER = { name: 'نور', phone: '0944777999' }
let passed = 0, failed = 0
const ok = (c, label, extra = '') => { if (c) { passed++; console.log('PASS', label) } else { failed++; console.log('FAIL', label, extra) } }
const soft = (c, label, extra = '') => console.log(c ? 'PASS' : 'INFO', label + (c ? '' : ' (bonus, not counted)'), c ? '' : extra)
const errors = []
function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console.error: ${m.text()}`) })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const api = async (path, { token, body, method } = {}) => {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(BASE + path, { method: method || (body !== undefined ? 'POST' : 'GET'), headers, body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-SY' }
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (Version/17.4 Mobile/15E148 Safari/604.1'

// admin token + enable pay on arrival for this run (restored at the end)
const login = await api('/v1/team/login', { body: ADMIN })
if (!login.data?.token) { console.log('FAIL no admin — run api-smoke.mjs first'); process.exit(1) }
const token = login.data.token
const settingsBefore = (await api('/v1/admin/settings', { token })).data
const enabled = await api('/v1/admin/settings', { token, method: 'PATCH', body: { allow_pay_on_arrival: true } })
ok(enabled.status === 200 && enabled.data.allow_pay_on_arrival === true, 'setup: admin enables pay on arrival (PATCH /v1/admin/settings)')

const browser = await chromium.launch()
let bookingId = 0
try {
  // ---------- team panel, open first, on a phone (390 px) ----------
  const teamCtx = await browser.newContext(PHONE)
  const t = await teamCtx.newPage(); watch(t, 'team')
  const pings = []
  t.on('request', (req) => { if (req.url().includes('/v1/team/ping')) pings.push(Date.now()) })
  await t.goto(BASE + '/team', { waitUntil: 'networkidle' })
  await t.waitForSelector('.login-card', { timeout: 15000 })
  await t.fill('.login-card input[type="tel"]', ADMIN.phone)
  await t.fill('.login-card input[type="password"]', ADMIN.password)
  await t.locator('.login-card button[type="submit"]').click()
  await t.waitForSelector('.tl-room', { timeout: 15000 })
  await t.waitForFunction(() => document.querySelector('.sync-pill')?.textContent?.includes('متصل'), null, { timeout: 15000 })
  const pendingBefore = await t.locator('.verify').count()
  const badgeBefore = await t.locator('.tp-tabs .nav-badge').count() ? await t.locator('.tp-tabs .nav-badge').innerText() : '0'
  ok(await t.locator('.tp-tabs').isVisible(), `team on phone: logged in, bottom tabs visible (pending cards: ${pendingBefore}, badge: ${badgeBefore})`)
  await sleep(11000)
  ok(pings.length >= 2, `team: GET /v1/team/ping polled while visible (${pings.length} in 11 s)`)
  const gaps = pings.slice(1).map((v, i) => v - pings[i])
  ok(gaps.length >= 1 && gaps.every((g) => g > 4000 && g < 11000), `team: ping interval ≈ 5 s (gaps: ${gaps.join(', ')} ms; a tick is skipped while a sync is running)`)

  // ---------- customer books with pay on arrival ----------
  const custCtx = await browser.newContext(PHONE)
  const c = await custCtx.newPage(); watch(c, 'customer')
  await c.goto(BASE + '/', { waitUntil: 'networkidle' })
  await c.waitForSelector('svg.plan g.plan-room rect', { timeout: 15000 })
  await c.locator('.chip').nth(DAY).click()
  await c.locator('select').nth(0).selectOption('16:00')
  await c.locator('select').nth(1).selectOption('60')
  await c.locator('svg.plan g.plan-room').first().click()
  await c.waitForSelector('.sheet', { timeout: 5000 })
  await c.locator('.sheet button:has-text("احجز هالغرفة")').click()
  await c.waitForURL(/\/book\/\d+/)
  await c.fill('input[autocomplete="name"]', CUSTOMER.name)
  await c.fill('input[type="tel"]', CUSTOMER.phone)
  const seg = c.locator('.segmented[role="radiogroup"]')
  ok(await seg.count() === 1 && await seg.locator('.segment').count() === 2, 'book form: «طريقة الدفع» segmented control shown when pay on arrival is enabled')
  await seg.locator('button:has-text("الدفع عند الوصول")').click()
  ok(await seg.locator('button:has-text("الدفع عند الوصول")').getAttribute('aria-checked') === 'true', 'book form: «الدفع عند الوصول» selected')
  ok(await c.locator('text=يؤكد الفريق حجزك، وتدفع عند وصولك').count() === 1, 'book form: cash hint text shown')
  await c.screenshot({ path: `${SHOTS}/2x-01-book-cash.png`, fullPage: true })
  const submittedAt = Date.now()
  await c.locator('button:has-text("تأكيد الحجز")').click()
  await c.waitForURL(/\/b\/\d+/, { timeout: 15000 })
  bookingId = Number(c.url().split('/b/')[1])
  await c.waitForSelector('text=استلمنا حجزك', { timeout: 10000 })
  ok(await c.locator('text=سيؤكد الفريق حجزك قريباً، والدفع عند الوصول').count() === 1, 'customer: cash awaiting screen «استلمنا حجزك … الدفع عند الوصول»')
  ok(await c.locator('.badge:has-text("بانتظار تأكيد الفريق")').count() === 1, 'customer: status badge «بانتظار تأكيد الفريق»')
  ok(await c.locator('.countdown').count() === 0 && await c.locator('text=ادفع عبر شام كاش').count() === 0, 'customer: no Sham Cash panel / countdown for a cash booking')
  await c.screenshot({ path: `${SHOTS}/2x-02-awaiting-cash.png`, fullPage: true })
  const srv = await api(`/v1/bookings/${bookingId}`, { token })
  ok(srv.data?.status === 'awaiting_verification' && srv.data.method === 'cash' && srv.data.hold_until === null, 'server: booking awaiting_verification / cash / no hold', JSON.stringify(srv.data))

  // ---------- team panel receives it live (ping poll → sync), no reload ----------
  const card = t.locator('.verify').filter({ hasText: CUSTOMER.name })
  await card.waitFor({ timeout: 12000 })
  const arrivedMs = Date.now() - submittedAt
  ok(arrivedMs < 9000, `team: pending card for ${CUSTOMER.name} appeared without reload after ${(arrivedMs / 1000).toFixed(1)} s (ping poll)`)
  ok(await t.locator('.verify').count() === pendingBefore + 1, 'team: pending list grew by one')
  ok(await card.locator('text=الدفع عند الوصول').count() >= 1, 'team: card says «الدفع عند الوصول»')
  ok(await card.locator('button:has-text("تأكيد الحجز")').count() === 1, 'team: action is «تأكيد الحجز» (not «تأكيد الدفع»)')
  const badge = t.locator('.tp-tabs .nav-badge')
  await badge.waitFor({ timeout: 5000 })
  ok(await badge.isVisible() && Number(await badge.innerText()) === Number(badgeBefore) + 1, `team: bottom-tab badge shows ${await badge.innerText()}`)
  await t.screenshot({ path: `${SHOTS}/2x-03-team-live.png`, fullPage: true })

  // ---------- bonus: a Web Push delivered to the team SW via CDP → «جديد» badge ----------
  try {
    const cdp = await teamCtx.newCDPSession(t)
    const regsP = new Promise((res) => { cdp.once('ServiceWorker.workerRegistrationUpdated', (e) => res(e.registrations)); setTimeout(() => res([]), 3000) })
    await cdp.send('ServiceWorker.enable')      // the registration list arrives as an event right after enable
    const reg = await t.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active ? 'active' : 'none' })
    const regs = await regsP
    const regId = regs.find((r) => r.scopeURL.startsWith(BASE))?.registrationId
    if (regId && reg === 'active') {
      const payload = JSON.stringify({ kind: 'payment_submitted', booking_id: bookingId, url: `${BASE}/team/bookings?id=${bookingId}`, title: 'دفعة بانتظار التحقق', body: 'test', tag: `booking-${bookingId}` })
      await cdp.send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId: regId, data: payload })
      const fresh = await t.locator('.verify.is-fresh').filter({ hasText: CUSTOMER.name }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
      soft(fresh && await card.locator('.badge-new:has-text("جديد")').count() === 1, 'team: CDP-delivered push → card highlighted with «جديد»')
      if (fresh) await t.screenshot({ path: `${SHOTS}/2x-04-team-push-new.png`, fullPage: true })
    } else soft(false, 'team: CDP push skipped (no active SW registration)', JSON.stringify({ reg, regs: regs.length }))
  } catch (e) { soft(false, 'team: CDP push not available', e.message) }

  // ---------- team confirms at the desk; the customer sees it ----------
  await card.locator('button:has-text("تأكيد الحجز")').click()
  await t.waitForFunction((name) => ![...document.querySelectorAll('.verify')].some((el) => el.textContent.includes(name)), CUSTOMER.name, { timeout: 10000 })
  await t.waitForFunction(() => { const p = document.querySelector('.sync-pill')?.textContent || ''; return p.includes('متصل') && !p.includes('بانتظار') && !p.includes('جارٍ') }, null, { timeout: 15000 })
  await sleep(300)
  const after = await api(`/v1/bookings/${bookingId}`, { token })
  ok(after.data?.status === 'confirmed' && after.data.method === 'cash', 'server: cash booking confirmed by the team', JSON.stringify(after.data?.status))
  await c.goto(BASE + `/b/${bookingId}`, { waitUntil: 'networkidle' })
  await c.waitForSelector('text=حجزك مؤكد', { timeout: 10000 })
  ok(true, 'customer: booking page shows «حجزك مؤكد»')
  await c.screenshot({ path: `${SHOTS}/2x-05-confirmed-cash.png`, fullPage: true })

  // ---------- /privacy ----------
  await c.goto(BASE + '/', { waitUntil: 'networkidle' })
  const link = c.locator('footer a[href="/privacy"]')
  ok(await link.count() === 1, 'home footer has the «سياسة الخصوصية» link')
  await link.click()
  await c.waitForURL(/\/privacy$/, { timeout: 10000 })
  await c.waitForSelector('h1:has-text("سياسة الخصوصية")', { timeout: 10000 })
  ok((await c.title()).includes('سياسة الخصوصية') && await c.locator('h2').count() >= 2, '/privacy opens the static policy page (title + sections)')
  await c.screenshot({ path: `${SHOTS}/2x-06-privacy.png`, fullPage: true })

  // ---------- install banner ----------
  // iOS Safari: the banner shows the share-sheet instructions (real code path, UA-driven).
  const iosCtx = await browser.newContext({ ...PHONE, userAgent: IOS_UA })
  const i = await iosCtx.newPage(); watch(i, 'ios')
  await i.goto(BASE + '/', { waitUntil: 'networkidle' })
  await i.waitForSelector('.prompt-card', { timeout: 15000 })
  ok(await i.locator('.prompt-card:has-text("ثبّت فوكس بوينت على جهازك")').isVisible(), 'install banner (iOS UA): «ثبّت فوكس بوينت على جهازك» visible on Home')
  ok(await i.locator('.prompt-card:has-text("إضافة إلى الشاشة الرئيسية")').count() === 1, 'install banner (iOS UA): Safari share-sheet instructions')
  await i.screenshot({ path: `${SHOTS}/2x-07-install-ios.png`, fullPage: true })
  await i.locator('.prompt-card button:has-text("فهمت")').click()
  ok(await i.locator('.prompt-card').count() === 0, 'install banner: «فهمت» dismisses it (snoozed in localStorage)')
  await iosCtx.close()
  // Android/Chrome: headless Chromium never fires beforeinstallprompt, so the event is dispatched synthetically to
  // exercise the «تثبيت» path (the real prompt is shown by Chrome itself on a phone).
  const a = await custCtx.newPage(); watch(a, 'android')
  await a.goto(BASE + '/', { waitUntil: 'networkidle' })
  await a.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e) })
  await a.waitForSelector('.prompt-card', { timeout: 5000 })
  ok(await a.locator('.prompt-card button:has-text("تثبيت")').isVisible() && await a.locator('.prompt-card:has-text("يفتح كتطبيق")').count() === 1, 'install banner (Android, synthetic beforeinstallprompt): «تثبيت» + «لاحقاً» visible')
  await a.screenshot({ path: `${SHOTS}/2x-08-install-android.png`, fullPage: true })
} catch (e) {
  failed++; console.log('FAIL (exception)', e.stack || e.message)
} finally {
  await browser.close()
  // restore the setting as it was before the run
  await api('/v1/admin/settings', { token, method: 'PATCH', body: { allow_pay_on_arrival: !!settingsBefore?.allow_pay_on_arrival } })
}
const realErrors = errors.filter((e) => !/favicon|manifest|Failed to load resource|the server responded with a status of 4/.test(e))
console.log('\nconsole/page errors:', realErrors.length ? realErrors.join('\n') : 'none')
console.log('all errors:', errors.length); for (const e of errors) console.log('  ', e.slice(0, 160))
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
