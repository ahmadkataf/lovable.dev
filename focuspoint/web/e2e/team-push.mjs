// Browser test of the team notification card against the local server.
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const B = 'http://127.0.0.1:8799'
const login = await fetch(B + '/v1/team/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '0985258963', password: 'Admin123!' }) }).then((r) => r.json())
const token = login.token
let fails = 0
const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  → ' + JSON.stringify(x))); if (!c) fails++ }
const browser = await chromium.launch()

async function run(name, { permission, stubSubscribe = false, requestResult = null, path = '/team' }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' })
  if (permission === 'granted') await ctx.grantPermissions(['notifications'], { origin: B })
  await ctx.addInitScript(({ token, permission, stubSubscribe, requestResult }) => {
    localStorage.setItem('fp_team_token', token)
    window.__asks = 0
    Object.defineProperty(Notification, 'permission', { get: () => window.__perm ?? permission, configurable: true })
    if (permission !== 'granted') {
      Notification.requestPermission = () => { window.__asks++; return new Promise((r) => setTimeout(() => { if (requestResult) window.__perm = requestResult; r(requestResult ?? permission) }, 300)) }
    }
    if (stubSubscribe && window.PushManager) {
      const fake = { endpoint: 'https://push.example.test/sub/' + Math.random().toString(36).slice(2), toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'BOr' + 'x'.repeat(84), auth: 'y'.repeat(22) } } }, unsubscribe: async () => true }
      let current = null
      PushManager.prototype.getSubscription = async () => current
      PushManager.prototype.subscribe = async () => { current = fake; return fake }
    }
  }, { token, permission, stubSubscribe, requestResult })
  const page = await ctx.newPage()
  await page.goto(B + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(stubSubscribe ? 2500 : 4000)
  const read = () => page.evaluate(() => [...document.querySelectorAll('.push-card')].map((c) => ({ red: c.classList.contains('push-card--required'), text: c.innerText.replace(/\s+/g, ' ').trim() })))
  const cards = await read()
  await page.screenshot({ path: `${(process.env.OUT || '/tmp')}/push-${name}.png` })
  return { page, ctx, cards, read }
}

// 1) permission granted, the real push service is unreachable (headless Chromium has none) → red card with the reason
{
  const { cards, ctx } = await run('granted-fails', { permission: 'granted' })
  ok('granted + subscribe fails: exactly one card, red', cards.length === 1 && cards[0].red, cards)
  ok('…shows the reason and a retry button', /إعادة المحاولة/.test(cards[0]?.text) && /خدمة الإشعارات|لم يجهز|الخادم|الإنترنت/.test(cards[0]?.text), cards)
  ok('…never claims "enabled"', !cards.some((c) => /مفعّلة/.test(c.text)), cards)
  await ctx.close()
}
// 2) permission granted, subscription works → only the plain "enabled" card, and the server stored it
{
  const before = Date.now()
  const { cards, ctx } = await run('granted-ok', { permission: 'granted', stubSubscribe: true })
  ok('granted + subscribe ok: one plain card, not red', cards.length === 1 && !cards[0].red, cards)
  ok('…says enabled on this device', /الإشعارات مفعّلة على هذا الجهاز/.test(cards[0]?.text), cards)
  await ctx.close()
}
// 3) not asked yet → red card; the first tap asks once; tapping the button too does not ask a second time
{
  const { page, cards, ctx, read } = await run('default', { permission: 'default', requestResult: 'denied' })
  ok('default: red required card with allow button', cards.length === 1 && cards[0].red && /السماح بالإشعارات/.test(cards[0].text), cards)
  ok('…no prompt before any tap', (await page.evaluate(() => window.__asks)) === 0, await page.evaluate(() => window.__asks))
  await page.locator('.push-card--required button', { hasText: 'السماح بالإشعارات' }).click()
  await page.waitForTimeout(800)
  ok('…tap on the button = exactly one prompt (first-tap + button share one run)', (await page.evaluate(() => window.__asks)) === 1, await page.evaluate(() => window.__asks))
  await page.mouse.click(200, 700); await page.waitForTimeout(500)
  ok('…later taps do not re-prompt', (await page.evaluate(() => window.__asks)) === 1, await page.evaluate(() => window.__asks))
  const after = await read()
  ok('…after refusal: red card with settings help, no button', after.length === 1 && after[0].red && /رمز القفل/.test(after[0].text) && !/السماح بالإشعارات/.test(after[0].text), after)
  await ctx.close()
}
// 4) denied from the start
{
  const { cards, ctx } = await run('denied', { permission: 'denied' })
  ok('denied (browser): red card explains the padlock path, no prompt button', cards.length === 1 && cards[0].red && /رمز القفل/.test(cards[0].text) && !/السماح/.test(cards[0].text), cards)
  await ctx.close()
}
{
  const { cards, ctx } = await run('app-denied', { permission: 'denied', path: '/team?np=0' })
  ok('denied (in app): red card explains phone settings + reopen', cards.length === 1 && cards[0].red && /إعدادات الهاتف/.test(cards[0].text) && /أغلق التطبيق/.test(cards[0].text), cards)
  await ctx.close()
}
// 6) inside the Android app, allowed natively (?np=1) but Chrome still says "not asked": nothing at load, the first
//    tap anywhere asks through Chrome (answered by the app without a dialog) and the phone registers
{
  const { page, ctx, read } = await run('app-np1', { permission: 'default', requestResult: 'granted', stubSubscribe: true, path: '/team?np=1' })
  ok('app np=1: no request at load', (await page.evaluate(() => window.__asks)) === 0, await page.evaluate(() => window.__asks))
  await page.mouse.click(200, 760); await page.waitForTimeout(2500)
  ok('app np=1: the first tap asks exactly once (team + customer share it)', (await page.evaluate(() => window.__asks)) === 1, await page.evaluate(() => window.__asks))
  const cards = await read()
  ok('app np=1: one plain "enabled" card after that tap', cards.length === 1 && !cards[0].red && /مفعّلة على هذا الجهاز/.test(cards[0].text), cards)
  ok('app np=1: ?np removed from the address', !(await page.evaluate(() => location.search)).includes('np='), await page.evaluate(() => location.href))
  await ctx.close()
}
// 7) inside the app right after a native refusal (?np=0): never asks on its own, the button still works (once)
{
  const { page, cards, ctx } = await run('app-np0', { permission: 'default', requestResult: 'denied', path: '/team?np=0' })
  await page.mouse.click(200, 700); await page.waitForTimeout(500)
  ok('app np=0: no prompt on load or on a random tap', (await page.evaluate(() => window.__asks)) === 0, await page.evaluate(() => window.__asks))
  ok('app np=0: red card explains the settings path + button', cards.length === 1 && cards[0].red && /إعدادات الهاتف/.test(cards[0].text) && /السماح بالإشعارات/.test(cards[0].text), cards)
  await page.locator('.push-card--required button', { hasText: 'السماح بالإشعارات' }).click(); await page.waitForTimeout(800)
  ok('app np=0: the button asks exactly once', (await page.evaluate(() => window.__asks)) === 1, await page.evaluate(() => window.__asks))
  await ctx.close()
}
// 8) customer side in the app with np=1: registered after the first tap too
{
  const { page, ctx } = await run('customer-np1', { permission: 'default', requestResult: 'granted', stubSubscribe: true, path: '/?np=1' })
  ok('customer np=1: no request at load', (await page.evaluate(() => window.__asks)) === 0, await page.evaluate(() => window.__asks))
  await page.mouse.click(30, 400); await page.waitForTimeout(2500)
  ok('customer np=1: first tap asks once', (await page.evaluate(() => window.__asks)) === 1, await page.evaluate(() => window.__asks))
  globalThis.__custEndpoint = await page.evaluate(async () => (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription())?.endpoint)
  ok('customer np=1: subscribed', Boolean(globalThis.__custEndpoint), globalThis.__custEndpoint)
  await ctx.close()
}
// 5) sign out → this phone stops receiving the team's alerts (server row loses its user_id)
{
  const { page, cards, ctx } = await run('signout', { permission: 'granted', stubSubscribe: true })
  ok('signed in: registered (plain enabled card)', cards.length === 1 && !cards[0].red, cards)
  const endpoint = await page.evaluate(async () => (await (await navigator.serviceWorker.getRegistration()).pushManager.getSubscription())?.endpoint)
  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await page.waitForTimeout(800)
  const confirm = page.getByRole('button', { name: /تسجيل الخروج|خروج/ }).last()
  if (await confirm.isVisible().catch(() => false)) { await confirm.click().catch(() => {}); await page.waitForTimeout(1500) }
  const token = await page.evaluate(() => localStorage.getItem('fp_team_token'))
  ok('signed out (token cleared)', token === null, token)
  globalThis.__endpoint = endpoint
  await ctx.close()
}
await browser.close()
console.log('ENDPOINT ' + globalThis.__endpoint); console.log('CUST ' + globalThis.__custEndpoint)
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0)
