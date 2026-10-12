// QA for licence keys in Settings → Licence (docs/LICENCE-KEYS.md, src/license/online.ts): the key goes to
// https://dentora.raqeem.dev/api/activate, which this script routes to each answer the server can give (a real code
// signed for the page's device number, a code for another device, every refusal, no connection), and only a code the
// app's own check accepts activates it. Screenshots: Arabic and English, desktop and phone, and a Play-installed
// Android copy (no seller box, the key field still there).
//   VITE_QA=1 npx vite build --outDir /tmp/dist-licence-key
//   QA_DIST=/tmp/dist-licence-key QA_PORT=4311 QA_SHOTS=qa-shots/licence-key node scripts/qa/licence-key.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, openBrowser, seedAndLogin, setTrialStart, shot, BASE } from './lib.mjs'
import { makeCode as signCode, importSigningKey, parsePrivateKey } from '../../tools/generator-lib.ts'
import license from '../../src/i18n/modules/license.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ACTIVATION_URL = 'https://dentora.raqeem.dev/api/activate'          // src/license/online.ts
const PAGE = { ar: 'https://dentora.raqeem.dev/activate', en: 'https://dentora.raqeem.dev/en/activate' }
const KEY = '7QW3-HK9P-M2XD-R4TN'
const DAY = 86_400_000

// Codes are signed with the seller's private key (never in the repository): DENTORA_LICENSE_KEY or ../secrets-for-user.
const KEY_FILE = process.env.DENTORA_LICENSE_KEY || path.resolve(ROOT, '../secrets-for-user/dentora/license-private.jwk')
const signingKey = await (async () => {
  if (!fs.existsSync(KEY_FILE)) return null
  const p = parsePrivateKey(fs.readFileSync(KEY_FILE, 'utf8'))
  return p.ok ? importSigningKey(p.jwk) : null
})()
if (!signingKey) { console.error(`the licence private key is needed for these checks: ${KEY_FILE}`); process.exit(2) }
const makeCode = (device, plan, until) => signCode(device, plan, until, signingKey)

const errors = []
let failures = 0
function ok(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg) } else console.log('ok  ', msg) }
async function snap(page, name, opts) {
  await page.waitForTimeout(450)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(over <= 0, `${name}: no horizontal overflow (${over})`)
  await shot(page, name, opts)
}

/**
 * A browser whose requests to the activation server are answered by `server.next(body)`: { status, body }, 'abort'
 * (no connection), or a promise of either. Every request is kept in `server.seen` (its body and headers).
 */
async function open(opts = {}) {
  const b = await openBrowser(opts)
  const server = { next: null, seen: [] }
  b.page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  b.page.on('console', m => {
    if (m.type() !== 'error') return
    // the refusals and the cut connection routed below show as failed loads of the activation URL: expected
    if (/^Failed to load resource/.test(m.text()) && (m.location()?.url || '').startsWith(ACTIVATION_URL)) return
    errors.push(`console: ${m.text()}`)
  })
  await b.ctx.route(ACTIVATION_URL, async route => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } })
    }
    const body = req.postDataJSON()
    server.seen.push({ body, headers: await req.allHeaders() })
    const a = await server.next(body)
    if (a === 'abort') return route.abort('internetdisconnected')
    return route.fulfill({ status: a.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(a.body) })
  })
  // the public activation page itself (opened by "Activate in the browser"): a stand-in, nothing goes out
  await b.ctx.route(url => url.host === 'dentora.raqeem.dev' && url.pathname !== '/api/activate', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>activate</title>' }))
  return { ...b, server }
}

async function licenceTab(page) {
  await page.goto(`${BASE}/index.html#/settings/license`)
  await page.waitForSelector('[data-qa=device-number]')
  await page.waitForTimeout(300)
  return (await page.textContent('[data-qa=device-number]')).trim()
}
/** Enters `text` (cleared first, so the same key again still counts as an edit) and presses Activate. Answers the field's error. */
async function attempt(page, server, answer, text = KEY) {
  server.next = answer
  const before = server.seen.length
  await page.fill('[data-qa=code-input]', '')
  await page.fill('[data-qa=code-input]', text)
  await page.click('[data-qa=activate]')
  await page.waitForFunction(() => document.querySelector('.field-error') || document.querySelector('[data-qa=license-status][data-status=active]'), null, { timeout: 25000 })
  // a request blocked before it leaves (the page's Content-Security-Policy) never reaches the route: nothing else can be checked
  const reached = server.seen.length === before + 1
  ok(reached, `the key went to ${ACTIVATION_URL}`)
  if (!reached) throw new Error(`the request never left the page: does connect-src in ${process.env.QA_DIST || 'dist'}/index.html allow https://dentora.raqeem.dev?`)
  return ((await page.locator('.field-error').textContent().catch(() => '')) || '').trim()
}
const signed = (plan, until = null) => async body => ({ status: 200, body: { code: await makeCode(body.device, plan, until), device: body.device, plan, until: until ? until.toISOString().slice(0, 10) : null } })
const refusal = (status, body) => () => ({ status, body })
const offerShown = async page => (await page.locator('[data-qa=key-browser-offer]').count()) === 1
const stored = page => page.evaluate(async () => (await window.__dentora.db.settings.get('license'))?.value ?? null)
/** The URL "Activate in the browser" opens (a new tab in the browser build). */
async function browserPage(ctx, page) {
  const [tab] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-qa=key-browser]')])
  await tab.waitForLoadState().catch(() => undefined)
  const url = tab.url()
  await tab.close()
  return url
}

const server = await startServer()
try {
  // ======================= desktop · Arabic: every answer, then a key that works =======================
  {
    const { browser, ctx, page, server: api } = await open()
    await seedAndLogin(page)
    const device = await licenceTab(page)
    const L = license.ar
    ok(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(device), `device number shown (${device})`)
    ok((await page.locator('.st-activate .field-label').textContent()).includes('مفتاح الترخيص'), 'the field says it takes a licence key')
    await snap(page, 'd-ar-1-trial', { full: true })

    // the seller's whole message pasted: the key is picked out, and the screen says what will be sent
    await page.fill('[data-qa=code-input]', `مرحباً د. سامي،\nهذا مفتاح ترخيص برنامج Dentora الخاص بكم:\n‎${KEY.toLowerCase()}\nالباقة الاحترافية — ترخيص دائم\nhttps://dentora.raqeem.dev/activate`)
    ok(await page.inputValue('[data-qa=code-input]') === KEY, 'a key pasted inside the seller’s message is picked out')
    ok(await page.locator('[data-qa=key-detected]').count() === 1, 'the field shows it is a licence key')
    ok((await page.locator('.st-activate .field-hint').textContent()).includes('dentora.raqeem.dev'), 'the hint says only the key and the device number go to dentora.raqeem.dev')
    await snap(page, 'd-ar-2-key')

    // no connection: say so, and offer the activation page for this device
    let err = await attempt(page, api, () => 'abort')
    ok(err === L['key.err.offline'], `offline → its sentence (${err})`)
    ok(await offerShown(page), 'offline → "activate in the browser" offered')
    await snap(page, 'd-ar-3-offline')
    const url = await browserPage(ctx, page)
    ok(url === `${PAGE.ar}?device=${device}`, `the Arabic activation page opens with this device number (${url})`)

    // each refusal: its own sentence; the browser only when the server failed
    for (const [status, body, sentence, offer, name] of [
      [404, { error: 'unknown' }, L['key.err.unknown'], false, 'unknown'],
      [409, { error: 'used' }, L['key.err.used'], false, 'used'],
      [410, { error: 'void' }, L['key.err.void'], false, 'void'],
      [410, { error: 'expired' }, L['key.err.expired'], false, 'expired'],
      [503, { error: 'signing' }, L['key.err.server'], true, 'server'],
    ]) {
      err = await attempt(page, api, refusal(status, body))
      ok(err === sentence, `${status} ${body.error} → its sentence (${err})`)
      ok(await offerShown(page) === offer, `${status} ${body.error} → browser ${offer ? 'offered' : 'not offered'}`)
      if (name === 'used') await snap(page, 'd-ar-4-used')
    }
    err = await attempt(page, api, refusal(429, { error: 'locked', retryAfter: 840 }))
    ok(err.includes('انتظر 14 دقيقة'), `429 locked → wait 14 minutes (${err})`)
    await snap(page, 'd-ar-5-locked')

    // a lying server: a real code, but for another device
    err = await attempt(page, api, async () => ({ status: 200, body: { code: await makeCode('ZZZZ-ZZZZ', 'pro', null), device: 'ZZZZ-ZZZZ', plan: 'pro', until: null } }))
    ok(err === L['key.err.check'], `a code for another device is refused by the app’s own check (${err})`)
    ok(await stored(page) === null, 'nothing stored after the refused code')

    // the key that works: the progress line while the server is asked, then the app is active
    let release
    const held = new Promise(r => { release = r })
    api.next = async body => { await held; return signed('pro')(body) }
    await page.fill('[data-qa=code-input]', '')
    await page.fill('[data-qa=code-input]', KEY.toLowerCase().replace(/-/g, ' '))
    await page.click('[data-qa=activate]')
    await page.waitForSelector('[data-qa=key-contacting]')
    ok((await page.textContent('[data-qa=key-contacting]')).includes(L['key.contacting']), 'progress: "contacting the activation server"')
    ok(await page.locator('[data-qa=code-input]').getAttribute('readonly') !== null, 'progress: the field is locked')
    ok(await page.locator('[data-qa=activate]').isDisabled(), 'progress: the button is busy')
    await snap(page, 'd-ar-6-contacting')
    release()
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 25000 })
    const lic = await stored(page)
    ok(lic?.plan === 'pro' && lic?.until === null, `activated: pro, lifetime (${JSON.stringify(lic && { plan: lic.plan, until: lic.until })})`)
    ok(await page.locator('.trial-bar').count() === 0, 'activated: the trial bar is gone')
    ok(await page.evaluate(async () => (await window.__dentora.db.activity.toArray()).some(a => a.message.startsWith('تفعيل الترخيص بمفتاح'))), 'activity log: activated with a key')
    await snap(page, 'd-ar-7-active', { full: true })

    // what went out: the key and the device number, nothing else, no cookie, no referrer
    ok(api.seen.every(s => JSON.stringify(Object.keys(s.body).sort()) === '["device","key"]' && s.body.key === KEY && s.body.device === device), `every request carried only { key, device } (${api.seen.length} requests)`)
    ok(api.seen.every(s => !s.headers.cookie && !s.headers.referer), 'no cookie and no referrer sent')
    await browser.close()
  }

  // ======================= desktop · Arabic: read-only after the trial, a one-year key =======================
  {
    const { browser, page, server: api } = await open()
    await seedAndLogin(page)
    await setTrialStart(page, new Date(Date.now() - 30 * DAY).toISOString())
    await page.reload()
    await licenceTab(page)
    await page.waitForSelector('[data-qa=license-status][data-status=expired]')
    ok(await page.locator('[data-qa=code-input]').isEditable(), 'read-only: the key field still works')
    const now = new Date()
    const until = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()))
    await attempt(page, api, signed('standard', until))
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 25000 })
    const lic = await stored(page)
    ok(lic?.plan === 'standard' && lic?.until?.slice(0, 10) === until.toISOString().slice(0, 10), `read-only → active with a one-year key (${lic?.until})`)
    ok((await page.textContent('[data-qa=license-until]')).length > 0, 'the last day is shown')
    await snap(page, 'd-ar-8-expired-to-active', { full: true })
    await browser.close()
  }

  // ======================= desktop · English =======================
  {
    const { browser, ctx, page, server: api } = await open({ lang: 'en' })
    await seedAndLogin(page, { lang: 'en' })
    const device = await licenceTab(page)
    const L = license.en
    await page.fill('[data-qa=code-input]', KEY.toLowerCase())
    ok(await page.locator('[data-qa=key-detected]').count() === 1, 'en: the field shows it is a licence key')
    await snap(page, 'd-en-1-key')
    let err = await attempt(page, api, () => 'abort')
    ok(err === L['key.err.offline'], `en: offline → its sentence (${err})`)
    await snap(page, 'd-en-2-offline')
    const url = await browserPage(ctx, page)
    ok(url === `${PAGE.en}?device=${device}`, `en: the English activation page opens with this device number (${url})`)
    err = await attempt(page, api, refusal(409, { error: 'used' }))
    ok(err === L['key.err.used'], `en: used → its sentence (${err})`)
    await snap(page, 'd-en-3-used')
    err = await attempt(page, api, refusal(429, { error: 'locked', retryAfter: 30 }))
    ok(err.includes('Wait a minute'), `en: locked for 30 s → wait a minute (${err})`)
    await attempt(page, api, signed('pro'))
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 25000 })
    ok((await stored(page))?.plan === 'pro', 'en: activated with the key')
    await snap(page, 'd-en-4-active', { full: true })
    await browser.close()
  }

  // ======================= phone =======================
  for (const lang of ['ar', 'en']) {
    const { browser, page, server: api } = await open({ mobile: true, width: 390, height: 844, lang })
    await seedAndLogin(page, { lang })
    await licenceTab(page)
    await page.fill('[data-qa=code-input]', KEY)
    await page.locator('.st-activate').scrollIntoViewIfNeeded()
    await snap(page, `m-${lang}-1-key`)
    const err = await attempt(page, api, () => 'abort')
    ok(err === license[lang]['key.err.offline'], `${lang} phone: offline → its sentence`)
    await page.locator('[data-qa=key-browser-offer]').scrollIntoViewIfNeeded()
    await snap(page, `m-${lang}-2-offline`)
    await attempt(page, api, signed('pro'))
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 25000 })
    ok((await stored(page))?.plan === 'pro', `${lang} phone: activated with the key`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await snap(page, `m-${lang}-3-active`)
    await browser.close()
  }

  // ======================= Android, installed from Google Play =======================
  {
    const { browser, ctx, page, server: api } = await open({ mobile: true, width: 390, height: 844, lang: 'ar' })
    // the shell's bridge (src/platform AndroidBridge), as a Play-installed copy reports itself
    await ctx.addInitScript(() => {
      window.__opened = []
      window.DentoraAndroid = {
        deviceId: () => 'android-qa-id-7', appVersion: () => '1.1.0', installSource: () => 'com.android.vending',
        openExternal: url => { window.__opened.push(url) }, print: () => undefined,
        saveBegin: () => JSON.stringify({ error: 'io' }), saveChunk: () => 'io', saveEnd: () => 'io', saveAbort: () => undefined,
      }
    })
    await seedAndLogin(page)
    const device = await licenceTab(page)
    ok(await page.locator('[data-qa=ask-whatsapp], [data-qa=buy-whatsapp], [data-qa=price-top]').count() === 0, 'Play copy: no seller box, no price')
    ok(await page.locator('[data-qa=code-input]').count() === 1, 'Play copy: the code/key field is there')
    const err = await attempt(page, api, refusal(503, { error: 'signing' }))
    ok(err === license.ar['key.err.server'], `Play copy: server failure → its sentence (${err})`)
    await page.click('[data-qa=key-browser]')
    ok(JSON.stringify(await page.evaluate(() => window.__opened)) === JSON.stringify([`${PAGE.ar}?device=${device}`]), 'Play copy: the activation page opens through the shell (openExternal)')
    await page.locator('[data-qa=key-browser-offer]').scrollIntoViewIfNeeded()
    await snap(page, 'm-ar-4-play-server')
    await attempt(page, api, signed('standard'))
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 25000 })
    ok((await stored(page))?.plan === 'standard', 'Play copy: activated with the key')
    await browser.close()
  }
} finally {
  server.kill()
}
ok(errors.length === 0, `no console errors (${errors.length})`)
if (errors.length) console.error([...new Set(errors)].slice(0, 20).join('\n'))
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
