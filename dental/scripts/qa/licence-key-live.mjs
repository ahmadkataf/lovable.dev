// A licence key end to end, for real: the seller issues keys through the control panel's API of the actual Worker
// (server/, `wrangler dev --local` on a fresh local D1, started here with server/.dev.vars), and the app (a QA build,
// under its own Content-Security-Policy from index.html) redeems one in Settings → Licence. The app's request to
// https://dentora.raqeem.dev/api/activate is handed to the local Worker as it is (method, headers, body) and the
// Worker's real status, headers and body come back to the page: only the address is changed. The code that comes back
// must pass the app's own lic.activate(): the app ends up activated with the device number it shows, and the server's
// sale holds that same number. The refusals (used, unknown, void) show their own sentences. Arabic on a desktop,
// English on a phone.
//   VITE_QA=1 npx vite build --outDir /tmp/dist-live
//   QA_DIST=/tmp/dist-live QA_PORT=4321 QA_SHOTS=qa-shots/licence-key-live node scripts/qa/licence-key-live.mjs
//   LIVE_PORT=8871   the Worker's port (and LIVE_PORT + 1000 for its inspector)
// Needs server/.dev.vars (ADMIN_PASSWORD, and LICENSE_PRIVATE_JWK: the seller's real key, else every activation
// answers 503) and server/public (built by `npm run build` in server/, or by an end-to-end run). The password and the
// key are read by the Worker; this script only uses the password to sign in and never prints either.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, openBrowser, seedAndLogin, shot, BASE, DIST } from './lib.mjs'
import { checkCode } from '../../src/license/core.ts'
import license from '../../src/i18n/modules/license.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SERVER = path.join(ROOT, 'server')
const ACTIVATION_URL = 'https://dentora.raqeem.dev/api/activate'          // src/license/online.ts
const PORT = Number(process.env.LIVE_PORT || 8871)
const WORKER = `http://localhost:${PORT}`
/** The address the Worker sees for the app's requests (its activation limit counts per address). */
const CLINIC_IP = '192.0.2.150'

let failures = 0
function ok(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg) } else console.log('ok  ', msg) }
async function snap(page, name) {
  await page.waitForTimeout(400)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(over <= 0, `${name}: no horizontal overflow (${over})`)
  await shot(page, name)
}

// ---- the Worker ------------------------------------------------------------------------------------------------------
function devVars() {
  const file = path.join(SERVER, '.dev.vars')
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if (v.length >= 2 && (v[0] === "'" || v[0] === '"') && v.endsWith(v[0])) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}
const vars = devVars()
const PASSWORD = vars.ADMIN_PASSWORD || ''
let secretD = ''
try { secretD = String(JSON.parse(vars.LICENSE_PRIVATE_JWK || '').d || '') } catch { /* checked below */ }
const scrub = s => (secretD ? String(s).split(secretD).join('[private key]') : String(s))
if (PASSWORD.length < 12 || !secretD) { console.error('server/.dev.vars needs ADMIN_PASSWORD (12+ characters) and LICENSE_PRIVATE_JWK'); process.exit(2) }
if (!fs.existsSync(path.join(SERVER, 'public'))) { console.error('server/public is missing: run `npm run build` in server/ first'); process.exit(2) }

async function startWorker() {
  try { await fetch(`${WORKER}/healthz`); throw new Error(`port ${PORT} is already in use: pick another LIVE_PORT`) } catch (e) { if (String(e.message).startsWith('port ')) throw e }
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-live-'))
  const child = spawn(path.join(SERVER, 'node_modules', '.bin', 'wrangler'), ['dev', '--local', '--port', String(PORT), '--inspector-port', String(PORT + 1000),
    '--persist-to', state, '--show-interactive-dev-session=false'], {
    cwd: SERVER, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  let log = '', exited = false
  child.stdout.on('data', d => { log += d })
  child.stderr.on('data', d => { log += d })
  child.on('exit', () => { exited = true })
  const stop = () => {
    if (!exited) try { process.kill(-child.pid, 'SIGKILL') } catch { /* gone */ }
    fs.rmSync(state, { recursive: true, force: true })
  }
  process.on('exit', stop)
  for (const deadline = Date.now() + 120_000; Date.now() < deadline;) {
    if (exited) throw new Error(`wrangler exited:\n${scrub(log).slice(-1500)}`)
    try { if ((await fetch(`${WORKER}/healthz`)).ok) return { stop } } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 400))
  }
  stop()
  throw new Error('wrangler did not start within 120 s')
}

/** The control panel's API, signed in, as the panel calls it (session cookie, X-Dentora, same Origin). */
async function panelApi() {
  const login = await fetch(`${WORKER}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dentora': '1', Origin: WORKER }, body: JSON.stringify({ password: PASSWORD }) })
  const cookie = (login.headers.getSetCookie().find(c => c.startsWith('__Host-dentora_admin=')) || '').split(';')[0]
  if (login.status !== 200 || !cookie) throw new Error(`could not sign in to the local Worker's panel (${login.status})`)
  return async (method, p, body) => {
    const res = await fetch(`${WORKER}${p}`, { method, headers: { 'Content-Type': 'application/json', 'X-Dentora': '1', Origin: WORKER, Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: res.status, json: await res.json().catch(() => null) }
  }
}
/** POST /api/activate straight to the Worker, as another clinic would. */
const activateDirect = (key, device) => fetch(`${WORKER}/api/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.151' }, body: JSON.stringify({ key, device }) })

// ---- the app -----------------------------------------------------------------------------------------------------------
/**
 * A browser on the QA build whose requests to the activation server go to the local Worker as they are, answered with
 * whatever the Worker answers. Every request handed over is kept in `seen`.
 */
async function open(opts) {
  const b = await openBrowser(opts)
  const seen = [], errors = []
  b.page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  b.page.on('console', m => {
    if (m.type() !== 'error') return
    // the Worker's refusals (404, 409, 410) show as failed loads of the activation URL: expected
    if (/^Failed to load resource: the server responded with a status of (404|409|410)/.test(m.text()) && (m.location()?.url || '').startsWith(ACTIVATION_URL)) return
    errors.push(`console: ${m.text()}`)
  })
  await b.ctx.route(ACTIVATION_URL, async route => {
    const rq = route.request()
    const headers = Object.fromEntries(Object.entries(await rq.allHeaders()).filter(([k]) => !k.startsWith(':') && !['host', 'connection', 'content-length', 'accept-encoding'].includes(k)))
    const res = await fetch(`${WORKER}/api/activate`, {
      method: rq.method(), headers: { ...headers, 'cf-connecting-ip': CLINIC_IP }, body: rq.method() === 'POST' ? rq.postDataBuffer() ?? undefined : undefined,
    })
    const body = Buffer.from(await res.arrayBuffer())
    const back = {}
    res.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) back[k] = v })
    seen.push({ method: rq.method(), headers, body: rq.postData(), status: res.status, answer: back })
    await route.fulfill({ status: res.status, headers: back, body })
  })
  return { ...b, seen, errors }
}
async function licenceTab(page) {
  await page.goto(`${BASE}/index.html#/settings/license`)
  await page.waitForSelector('[data-qa=device-number]')
  await page.waitForTimeout(300)
  return (await page.textContent('[data-qa=device-number]')).trim()
}
/** Pastes `text` into the field (cleared first), presses Activate, and answers the field's error ('' once active). */
async function attempt(page, text) {
  await page.fill('[data-qa=code-input]', '')
  await page.fill('[data-qa=code-input]', text)
  await page.click('[data-qa=activate]')
  await page.waitForFunction(() => document.querySelector('.field-error') || document.querySelector('[data-qa=license-status][data-status=active]'), null, { timeout: 30_000 })
  return ((await page.locator('.field-error').textContent().catch(() => '')) || '').trim()
}
const stored = page => page.evaluate(async () => (await window.__dentora.db.settings.get('license'))?.value ?? null)
const today = new Date()
const plusYears = n => new Date(Date.UTC(today.getUTCFullYear() + n, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10)

// the QA build carries the app's real Content-Security-Policy (index.html): it must let the activation request out
const indexHtml = fs.readFileSync(path.resolve(ROOT, DIST, 'index.html'), 'utf8')
const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(indexHtml)?.[1] ?? ''
ok(/connect-src [^;]*https:\/\/dentora\.raqeem\.dev/.test(csp), `${DIST}/index.html: connect-src allows https://dentora.raqeem.dev`)

const worker = await startWorker()
const server = await startServer()
try {
  const api = await panelApi()
  const me = await api('GET', '/api/me')
  if (!me.json?.signing) throw new Error(`the local Worker cannot sign codes (${me.json?.signingError}): LICENSE_PRIVATE_JWK in server/.dev.vars must be the seller's key`)
  const issue = async body => (await api('POST', '/api/keys', body)).json.items
  const [ar] = await issue({ plan: 'pro', validity: 'lifetime', customer: 'د. سامي الأحمد', clinic: 'عيادة النور', phone: '0944 123 456' })
  const [en] = await issue({ plan: 'standard', validity: '1y', customer: 'Dr. Lina Haddad', clinic: 'Smile Dental Clinic' })
  const [used, gone] = (await issue({ count: 2, plan: 'pro', validity: 'lifetime', customer: 'Reseller' })).map(x => x.licence)
  ok((await activateDirect(used.key, 'Z9XW-V8UT')).status === 200, 'a key already activated by another clinic (set up through the Worker)')
  ok((await api('PATCH', `/api/licences/${gone.id}`, { status: 'void' })).status === 200, 'a key the seller voided (set up through the panel API)')
  const unknown = 'QW2E-RT3Y-UP4A-SD5F'

  // ======================= Arabic · desktop =======================
  {
    const { browser, page, seen, errors } = await open({ lang: 'ar' })
    await seedAndLogin(page)
    const device = await licenceTab(page)
    const L = license.ar
    ok(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(device), `the app shows its device number (${device})`)

    let err = await attempt(page, unknown)
    ok(err === L['key.err.unknown'], `a key never issued → the Worker's 404 unknown → its sentence (${err})`)
    await snap(page, 'live-ar-1-unknown')
    err = await attempt(page, used.key)
    ok(err === L['key.err.used'], `a key activated on another device → 409 used → its sentence (${err})`)
    await snap(page, 'live-ar-2-used')
    err = await attempt(page, gone.key)
    ok(err === L['key.err.void'], `a voided key → 410 void → its sentence (${err})`)
    ok(await page.locator('[data-qa=key-browser-offer]').count() === 0, 'refusals: no "activate in the browser" offer')
    ok(await stored(page) === null, 'nothing stored after the refusals')

    // the seller's whole Arabic message, as the panel made it, pasted into the field
    err = await attempt(page, ar.message.ar)
    ok(err === '', `the key message pasted whole → activated (${err || 'no error'})`)
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 30_000 })
    const lic = await stored(page)
    ok(lic?.plan === 'pro' && lic?.until === null, `the app is activated: pro, lifetime (${JSON.stringify(lic && { plan: lic.plan, until: lic.until })})`)
    const check = await checkCode(device, lic?.code || '')
    ok(check.ok && check.plan === 'pro' && check.until === null, `the stored code passes checkCode for ${device}`)
    const sale = (await api('GET', `/api/licences?q=${encodeURIComponent(ar.licence.key)}`)).json?.items?.[0]
    ok(sale?.device === device && !!sale.activatedAt && sale.code === lic?.code, `the Worker's sale holds the app's device number (${sale?.device}) and the same code`)
    ok(await page.evaluate(async () => (await window.__dentora.db.activity.toArray()).some(a => a.message.startsWith('تفعيل الترخيص بمفتاح'))), 'activity log: activated with a key')
    await snap(page, 'live-ar-3-active')

    // the same key again on the same device (as after a reinstall): the same code, still active
    await page.click('[data-qa=renew]')
    await page.fill('[data-qa=code-input]', ar.licence.key.toLowerCase())
    await page.click('[data-qa=activate]')
    // the form closes once the code is accepted, or shows why not
    await page.waitForFunction(() => !document.querySelector('[data-qa=code-input]') || document.querySelector('.field-error'), null, { timeout: 30_000 })
    err = ((await page.locator('.field-error').textContent().catch(() => '')) || '').trim()
    ok(err === '' && (await stored(page))?.code === lic?.code && seen.length >= 5, `the same key again: the same code comes back, still active (${err || 'no error'})`)

    const posts = seen.filter(s => s.method === 'POST')
    ok(posts.length === 5 && posts.every(s => JSON.stringify(Object.keys(JSON.parse(s.body)).sort()) === '["device","key"]' && JSON.parse(s.body).device === device),
      `every request carried only { key, device } with this device number (${posts.length} requests)`)
    ok(posts.every(s => !s.headers.cookie && !s.headers.referer), 'no cookie and no referrer sent')
    ok(posts.every(s => s.answer['access-control-allow-origin'] === '*'), 'every answer of the Worker carried Access-Control-Allow-Origin: *')
    console.log(`     (the Worker answered: ${seen.map(s => `${s.method} ${s.status}`).join(', ')})`)
    // a request anywhere else is refused by the same policy before it leaves
    const elsewhere = await page.evaluate(() => fetch('https://example.com/', { method: 'POST', body: '{}' }).then(() => 'sent', () => 'blocked'))
    ok(elsewhere === 'blocked', `the same page cannot reach another server (${elsewhere})`)
    const realErrors = errors.filter(e => !/CSP|Content Security Policy|example\.com/i.test(e))
    ok(realErrors.length === 0, `no console errors (${realErrors.join(' | ')})`)
    await browser.close()
  }

  // ======================= English · phone =======================
  {
    const { browser, page, errors } = await open({ mobile: true, width: 390, height: 844, lang: 'en' })
    await seedAndLogin(page, { lang: 'en' })
    const device = await licenceTab(page)
    const L = license.en
    let err = await attempt(page, unknown.toLowerCase().replace(/-/g, ' '))
    ok(err === L['key.err.unknown'], `en: unknown → its sentence (${err})`)
    err = await attempt(page, used.key)
    ok(err === L['key.err.used'], `en: used → its sentence (${err})`)
    await page.locator('.st-activate').scrollIntoViewIfNeeded()
    await snap(page, 'live-en-1-used')
    err = await attempt(page, en.message.en)
    ok(err === '', `en: the English key message pasted whole → activated (${err || 'no error'})`)
    await page.waitForSelector('[data-qa=license-status][data-status=active]', { timeout: 30_000 })
    const lic = await stored(page)
    ok(lic?.plan === 'standard' && lic?.until?.slice(0, 10) === plusYears(1), `en: standard, one year from today (${lic?.until})`)
    const sale = (await api('GET', `/api/licences?q=${encodeURIComponent(en.licence.key)}`)).json?.items?.[0]
    ok(sale?.device === device && sale.until === plusYears(1), `en: the Worker's sale holds ${device} and the same last day`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await snap(page, 'live-en-2-active')
    ok(errors.length === 0, `en: no console errors (${errors.join(' | ')})`)
    await browser.close()
  }

  const audit = (await api('GET', '/api/audit?limit=100')).json?.items || []
  const keyEvents = audit.filter(a => a.action === 'key.activate' || a.action === 'key.used')
  ok(audit.filter(a => a.action === 'key.activate').length === 3 && audit.filter(a => a.action === 'key.used').length === 1 && keyEvents.every(a => a.ip === ''),
    'the Worker logged 3 activations and the used key once (tried twice the same day: one line per key and day), with no address')
} catch (e) {
  failures++
  console.error('FAIL:', scrub(e.stack || e.message))
} finally {
  server.kill()
  worker.stop()
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)
