// Pictures of the guide's topic "licence" (server/guide/topics/licence.ts); the shot API is documented at the top of
// store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin, on a
// fresh 7-day trial (the trial started at the fixed clock). In a browser the device number is a random one kept in
// localStorage, the same for a whole lane (the runner puts localStorage back after every shot), and the seller box
// shows (a copy not installed from Google Play).
//
// The activated, refused and website pictures need the real activation server: a local copy of the Worker
// (server/, `wrangler dev --local` on a throwaway D1, started here when LIVE_PORT, default 4882, does not answer;
// needs server/.dev.vars with ADMIN_PASSWORD and LICENSE_PRIVATE_JWK, and server/public built by `npm run build` in
// server/). Keys are issued through its control panel API exactly as the seller's panel does (POST /api/login, then
// POST /api/keys with X-Dentora: 1), and the app's request to https://dentora.raqeem.dev/api/activate is handed to
// that Worker as it is (scripts/qa/licence-key-live.mjs does the same). The password is read only to sign in and is
// never printed; the keys in the pictures belong to the throwaway database. The runner's Target API photographs the
// lane's page, so the website pictures navigate that very page to the local Worker's /activate (the runner brings it
// back to the app and restores the database before the next shot).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { NOW, ROOT, tmpDir } from './_helpers.mjs'

const SERVER = path.join(ROOT, 'server')
const ACTIVATION_URL = 'https://dentora.raqeem.dev/api/activate'          // src/license/online.ts
const PORT = Number(process.env.LIVE_PORT || 4882)
const WORKER = `http://localhost:${PORT}`
/** The address the Worker sees for the app's requests (its activation limit counts per address). */
const CLINIC_IP = '192.0.2.150'
/** A well-formed key (the codes' alphabet, no 0/O/1/I) that was never issued: the Worker answers 404 unknown. */
const UNKNOWN_KEY = 'QW2E-RT3Y-UP4A-SD5F'
const DAY = 86_400_000

/**
 * The pointer to a spot where it hovers nothing (desktop: the empty band under the page title; phone: the top edge).
 * The page keeps the pointer where the last shot left it, and a card or button under it shows its hover style.
 */
const rest = page => {
  const { width } = page.viewportSize()
  return width > 600 ? page.mouse.move(720, 150) : page.mouse.move(Math.round(width / 2), 2)
}
/** Every shot starts with the pointer at rest. */
const atRest = shots => Object.fromEntries(Object.entries(shots).map(([id, s]) => {
  const run = typeof s === 'function' ? s : s.run
  const wrapped = async ctx => { await rest(ctx.page); return run(ctx) }
  return [id, typeof s === 'function' ? wrapped : { ...s, run: wrapped }]
}))
const blur = page => page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())

// ---- the local Worker ------------------------------------------------------------------------------------------------
/** server/.dev.vars as wrangler reads it (KEY=value lines, quotes stripped); nothing of it is ever printed. */
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
const up = async () => { try { return (await fetch(`${WORKER}/healthz`)).ok } catch { return false } }

/** Starts `wrangler dev --local` on PORT with a throwaway database (stopped when this process exits). */
async function startWorker() {
  const vars = devVars()
  if (!vars.ADMIN_PASSWORD || !vars.LICENSE_PRIVATE_JWK) throw new Error(`no Worker on ${WORKER} and server/.dev.vars lacks ADMIN_PASSWORD or LICENSE_PRIVATE_JWK: start one with cd server && npx wrangler dev --port ${PORT} --local`)
  if (!fs.existsSync(path.join(SERVER, 'public'))) throw new Error('server/public is missing: run `npm run build` in server/ first')
  const state = path.join(tmpDir(), 'wrangler-state')
  fs.rmSync(state, { recursive: true, force: true })
  fs.mkdirSync(state, { recursive: true })
  const child = spawn(path.join(SERVER, 'node_modules', '.bin', 'wrangler'), ['dev', '--local', '--port', String(PORT), '--inspector-port', String(PORT + 1000),
    '--persist-to', state, '--show-interactive-dev-session=false'], {
    cwd: SERVER, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  let exited = false
  child.stdout.on('data', () => {})
  child.stderr.on('data', () => {})
  child.on('exit', () => { exited = true })
  const stop = () => {
    if (!exited) try { process.kill(-child.pid, 'SIGKILL') } catch { /* gone */ }
    fs.rmSync(state, { recursive: true, force: true })
  }
  process.on('exit', stop)
  for (const deadline = Date.now() + 120_000; Date.now() < deadline;) {
    if (exited) throw new Error('wrangler exited before it was ready')
    if (await up()) return
    await new Promise(r => setTimeout(r, 400))
  }
  stop()
  throw new Error('wrangler did not start within 120 s')
}

let worker = null
/** The Worker on PORT: the one already running there (started by hand), else one started here. Once per run. */
function ensureWorker() {
  if (!worker) worker = (async () => { if (!(await up())) await startWorker() })()
  return worker
}

let panel = null
/** The control panel's API, signed in, as the panel calls it (session cookie, X-Dentora, same Origin). Once per run. */
function panelApi() {
  if (panel) return panel
  panel = (async () => {
    await ensureWorker()
    const password = devVars().ADMIN_PASSWORD || ''
    const login = await fetch(`${WORKER}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dentora': '1', Origin: WORKER }, body: JSON.stringify({ password }) })
    const cookie = (login.headers.getSetCookie().find(c => c.startsWith('__Host-dentora_admin=')) || '').split(';')[0]
    if (login.status !== 200 || !cookie) throw new Error(`could not sign in to the local Worker's panel (${login.status}): is ADMIN_PASSWORD in server/.dev.vars the one the Worker on ${WORKER} runs with?`)
    const api = async (method, p, body) => {
      const res = await fetch(`${WORKER}${p}`, { method, headers: { 'Content-Type': 'application/json', 'X-Dentora': '1', Origin: WORKER, Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
      return { status: res.status, json: await res.json().catch(() => null) }
    }
    const me = await api('GET', '/api/me')
    if (!me.json?.signing) throw new Error(`the local Worker cannot sign codes (${me.json?.signingError || 'signing not ready'}): LICENSE_PRIVATE_JWK in server/.dev.vars must be the seller's key`)
    return api
  })()
  return panel
}
/** Issues one key as the seller's panel does; returns { licence, message } (message.ar / message.en: the text the clinic gets). */
async function issueKey({ plan, validity, customer, clinic, phone = '' }) {
  const api = await panelApi()
  const r = await api('POST', '/api/keys', { plan, validity, customer, clinic, phone })
  if (r.status !== 201 || !r.json?.items?.[0]) throw new Error(`POST /api/keys answered ${r.status}`)
  return r.json.items[0]
}

// ---- the app -----------------------------------------------------------------------------------------------------------
const routed = new WeakSet()
/**
 * Hands the app's requests to the activation server over to the local Worker, as they are (method, headers, body),
 * answered with whatever the Worker answers; once per browser context (the runner keeps one per lane).
 */
async function routeActivation(page) {
  await ensureWorker()
  const ctx = page.context()
  if (routed.has(ctx)) return
  routed.add(ctx)
  await ctx.route(ACTIVATION_URL, async route => {
    const rq = route.request()
    const headers = Object.fromEntries(Object.entries(await rq.allHeaders()).filter(([k]) => !k.startsWith(':') && !['host', 'connection', 'content-length', 'accept-encoding'].includes(k)))
    const res = await fetch(`${WORKER}/api/activate`, {
      method: rq.method(), headers: { ...headers, 'cf-connecting-ip': CLINIC_IP }, body: rq.method() === 'POST' ? rq.postDataBuffer() ?? undefined : undefined,
    })
    const body = Buffer.from(await res.arrayBuffer())
    const back = {}
    res.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) back[k] = v })
    await route.fulfill({ status: res.status, headers: back, body })
  })
}

/** Opens Settings → Licence and answers the device number the screen shows. */
async function open(page, helpers) {
  await helpers.goto('/settings/license')
  const device = page.locator('[data-qa="device-number"]')
  await device.waitFor()
  await helpers.settle(400)
  return (await device.textContent()).trim()
}
/** The label of the field that holds the control `selector`, for a marker just after its text (on the field it would cover what is typed). */
const labelOf = (page, selector) => page.locator('.field', { has: page.locator(selector) }).locator('.field-label').first()
/** The settings card (.card of the open section) holding `selector`. */
const cardWith = (page, selector) => page.locator('.st-form .card', { has: page.locator(selector) }).first()
const statusCard = page => page.locator('[data-qa="license-status"]')
/** Makes the window as tall as the page, so a whole-window capture shows the licence screen down to its last card. */
async function fitWindow(page, helpers) {
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight))
  const { width } = page.viewportSize()
  await helpers.viewport({ width, height: Math.min(Math.max(height, 900), 1400) })
  await helpers.scrollTop()
}

/** Pastes `text` into the field (cleared first), presses Activate and waits for the field's error or the active state. */
async function attempt(page, text) {
  await page.fill('[data-qa="code-input"]', '')
  await page.fill('[data-qa="code-input"]', text)
  await page.click('[data-qa="activate"]')
  await page.waitForFunction(() => document.querySelector('.field-error') || document.querySelector('[data-qa="license-status"][data-status="active"]'), null, { timeout: 30_000 })
}
/**
 * Ends the trial: moves its start 8 days back (in one transaction over every table, as a restore does: outside one
 * the licence guard only lets the start move earlier anyway) and reloads. The runner restores the database after.
 */
async function endTrial(page, helpers) {
  await helpers.db(async (db, iso) => db.transaction('rw', db.tables, () => db.settings.put({ key: 'installedAt', value: iso })), new Date(NOW.getTime() - 8 * DAY).toISOString())
  helpers.changedData()
  await page.reload()
  await helpers.settle(500)
}
/** The Worker's activation page for `device` in the lane's language, opened in the lane's own page (the runner brings it back). */
async function openActivationPage(page, helpers, device) {
  await ensureWorker()
  await page.goto(`${WORKER}${helpers.lang === 'en' ? '/en' : ''}/activate?device=${encodeURIComponent(device)}`)
  await page.locator('#act-start').waitFor()
  // the site's header sticks to the top of the window and would cover the top of a card scrolled into view (the
  // page's Content-Security-Policy refuses a style sheet added by a script; a style set through the CSSOM is fine)
  await page.locator('.legal-top').evaluate(el => { el.style.position = 'static' })
  await page.evaluate(() => document.fonts.ready)
  await helpers.settle(500)
}

export const shots = atRest({
  'licence-expired': async ({ page, helpers }) => {
    await endTrial(page, helpers)
    await open(page, helpers)
    await rest(page)
    return { el: statusCard(page), pad: 0 }
  },

  'licence-trial': async ({ page, helpers }) => {
    await open(page, helpers)
    await fitWindow(page, helpers)
    return {
      markers: [
        { n: 1, target: page.locator('.st-nav-item[data-tab="license"]') },
        { n: 2, target: statusCard(page) },
        { n: 3, target: page.locator('[data-qa="device-number"]') },
        { n: 4, target: labelOf(page, '[data-qa="code-input"]'), place: 'after-content' },
      ],
    }
  },

  'licence-key-phone': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.fill('[data-qa="code-input"]', UNKNOWN_KEY)
    await page.locator('[data-qa="key-detected"]').waitFor()
    await blur(page)
    await helpers.scrollTo(cardWith(page, '[data-qa="code-input"]'))
    await rest(page)
    await helpers.settle(300)
    return {
      markers: [
        { n: 2, target: labelOf(page, '[data-qa="code-input"]'), place: 'after-content' },
        { n: 3, target: page.locator('[data-qa="activate"]') },
      ],
    }
  },

  'licence-buy': async ({ page, helpers }) => {
    await open(page, helpers)
    const card = cardWith(page, '[data-qa="buy-whatsapp"]')
    return { el: card, pad: 0, markers: [{ n: 1, target: page.locator('[data-qa="buy-whatsapp"]') }] }
  },

  'licence-website': async ({ page, helpers }) => {
    const device = await open(page, helpers)
    await openActivationPage(page, helpers, device)
    return {
      el: '#act-start', pad: 0,
      markers: [
        { n: 3, target: page.locator('label[for="act-device"]'), place: 'after-content' },
        { n: 3, target: page.locator('label[for="act-key"]'), place: 'after-content' },
        { n: 4, target: page.locator('.act-submit') },
      ],
    }
  },

  'licence-website-done': async ({ page, helpers }) => {
    const device = await open(page, helpers)
    const { licence } = await issueKey({ plan: 'standard', validity: '1y', customer: helpers.pick('د. أحمد الخطيب', 'Dr. Ahmad Al-Khatib'), clinic: helpers.pick('عيادة الابتسامة لطب الأسنان', 'Smile Dental Clinic') })
    await openActivationPage(page, helpers, device)
    await page.fill('#act-key', licence.key)
    await page.click('.act-submit')
    await page.locator('#act-done').waitFor({ state: 'visible', timeout: 30_000 })
    await page.locator('#act-code').waitFor()
    await blur(page)
    await rest(page)
    await helpers.settle(400)
    return { el: '#act-done', pad: 0, markers: [{ n: 4, target: page.locator('#act-copy') }] }
  },

  'licence-error': async ({ page, helpers }) => {
    await routeActivation(page)
    await open(page, helpers)
    await attempt(page, UNKNOWN_KEY)
    await page.locator('.field-error').waitFor()
    await blur(page)
    await rest(page)
    await helpers.settle(300)
    return { el: cardWith(page, '[data-qa="code-input"]'), pad: 0 }
  },

  'licence-active': {
    timeout: 120000,
    run: async ({ page, helpers }) => {
      await routeActivation(page)
      const sale = helpers.pick({ plan: 'pro', validity: 'lifetime' }, { plan: 'standard', validity: '1y' })
      const { message } = await issueKey({ ...sale, customer: helpers.pick('د. أحمد الخطيب', 'Dr. Ahmad Al-Khatib'), clinic: helpers.pick('عيادة الابتسامة لطب الأسنان', 'Smile Dental Clinic'), phone: '0944 123 456' })
      await open(page, helpers)
      await helpers.noToasts()
      // the seller's whole message, as the panel made it in this language, pasted into the field
      await attempt(page, helpers.pick(message.ar, message.en))
      await page.locator('[data-qa="license-status"][data-status="active"]').waitFor({ timeout: 30_000 })
      await page.locator('[data-qa="deactivate"]').waitFor()
      await fitWindow(page, helpers)
      await rest(page)
      await helpers.settle(600)
      // the whole page: the state card at the top and the Deactivate link at the bottom
      return {
        markers: [
          { n: 1, target: statusCard(page) },
          { n: 2, target: page.locator('[data-qa="renew"]') },
          { n: 3, target: page.locator('[data-qa="deactivate"]') },
        ],
      }
    },
  },
})
