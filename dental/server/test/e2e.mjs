// End-to-end test of the whole Worker as Cloudflare runs it: builds public/, starts `wrangler dev --local` on an empty
// database and checks the landing page, the legal pages, the downloads, every API route, the control panel, licence
// keys (issued in the panel, activated on the public page /activate and through POST /api/activate, with its CORS and
// its limit) and the Windows installer served in parts, with fetch and with Chromium (Playwright). One "ok"/"FAIL"
// line per check; the exit code is 1 when any check failed.
//
//   npm run e2e                  the main Worker on E2E_PORT (default 8831); the next two ports run a Worker whose
//                                password is too short (setup screen) and one with the wrong signing key; the third
//                                one, at the end, serves a 45 MiB stand-in installer
//   E2E_OUT=<dir>                screenshots, Worker logs and results.json (default .wrangler/e2e, git-ignored)
//   E2E_ONLY=site,api,admin,keys,windows   run some parts only (the Workers start anyway)
//
// public/ is built without the Windows installer (WINDOWS_SETUP=none), so /download/windows falls back to the
// settings' link or WhatsApp, which the main run checks; the "windows" part then publishes the stand-in and checks
// that /download/windows gives back exactly its bytes, and leaves public/ built without an installer again.
//
// Needs .dev.vars (ADMIN_PASSWORD and LICENSE_PRIVATE_JWK, see .dev.vars.example) and the app's node_modules, which
// is where Playwright comes from (dental/package.json). The private key is read here only to prove that no response
// and no log line ever contains it: it is never printed, and every printed detail is scrubbed of it.
import { execFileSync, spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { checkCode, checkResetCode } from '../../tools/generator-lib.ts'
import { DEFAULT_SETTINGS } from '../src/types.ts'

const SERVER = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = resolve(SERVER, '..')
const PORT = Number(process.env.E2E_PORT || 8831)
const BASE = `http://localhost:${PORT}`
const OUT = resolve(process.env.E2E_OUT || join(SERVER, '.wrangler', 'e2e'))
const SHOTS = join(OUT, 'shots')
const ONLY = new Set((process.env.E2E_ONLY || 'site,api,admin,keys,windows').split(',').map(s => s.trim()))
/** The canonical address the pages point search engines to (src/index.ts). */
const ORIGIN = 'https://dentora.raqeem.dev'
const APK_VERSION = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).version
const APK = readFileSync(join(APP, 'releases', `Dentora-${APK_VERSION}.apk`))

// SPEC.md → Security, written out here rather than imported, so a change in src/http.ts that breaks the spec fails.
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; " +
  "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
const SECURITY = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': CSP,
}
// the public pages may also allow Cloudflare Web Analytics; the panel, the API and the files never
const PUBLIC_CSP = CSP.replace("script-src 'self'", "script-src 'self' https://static.cloudflareinsights.com")
  .replace("connect-src 'self'", "connect-src 'self' https://cloudflareinsights.com")
const publicPage = (headers, path) => !!path && (headers.get('content-type') || '').startsWith('text/html') && !path.startsWith('/admin') && !path.startsWith('/api/')
const missingSecurity = (headers, path = '') => Object.entries(SECURITY)
  .filter(([k, v]) => !(headers.get(k) === v || (k === 'content-security-policy' && publicPage(headers, path) && headers.get(k) === PUBLIC_CSP)))
  .map(([k]) => k)

// ---- secrets (.dev.vars) -----------------------------------------------------------------------------------------
function readDevVars() {
  const file = join(SERVER, '.dev.vars')
  if (!existsSync(file)) return {}
  const out = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let v = m[2].trim()
    if (v.length >= 2 && (v[0] === "'" || v[0] === '"') && v.endsWith(v[0])) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}
const vars = readDevVars()
const PASSWORD = vars.ADMIN_PASSWORD || ''
let keyD = ''
try { keyD = String(JSON.parse(vars.LICENSE_PRIVATE_JWK || '').d || '') } catch { /* reported below */ }
const SECRETS = keyD.length >= 32 ? [keyD] : []
const scrub = s => SECRETS.reduce((t, k) => t.split(k).join('[private key]'), String(s))

// ---- results -----------------------------------------------------------------------------------------------------
const results = []
function check(what, ok, detail = '') {
  const d = scrub(typeof detail === 'string' ? detail : JSON.stringify(detail))
  results.push({ what, ok: !!ok, detail: d })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${d ? ` — ${d}` : ''}`)
}
const section = name => console.log(`\n## ${name}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Every response body, header block and log the test sees is searched for the private key (never printed). */
let scanned = 0
const leaks = []
function scan(where, data) {
  if (!SECRETS.length || data == null) return
  scanned++
  const buf = typeof data === 'string' ? null : Buffer.isBuffer(data) ? data : Buffer.from(data)
  const hit = SECRETS.some(k => (buf ? buf.includes(k) : data.includes(k)))
  if (hit) leaks.push(where)
}

// ---- Workers -----------------------------------------------------------------------------------------------------
/** Builds public/ with scripts/build-public.mjs; `setup` is its WINDOWS_SETUP: 'none' (no installer) or a file. */
function buildPublic(setup) {
  execFileSync(process.execPath, [join(SERVER, 'scripts', 'build-public.mjs')], { cwd: SERVER, stdio: 'inherit', env: { ...process.env, WINDOWS_SETUP: setup } })
}
const workers = []
/** `wrangler dev --local` on its own empty database; resolves once /healthz answers. */
async function startWorker(name, port, extra = []) {
  try { await fetch(`http://localhost:${port}/healthz`); throw new Error(`port ${port} is already in use (set E2E_PORT)`) } catch (e) { if (/already in use/.test(e.message)) throw e }
  const persist = join(OUT, `state-${name}`)
  rmSync(persist, { recursive: true, force: true })
  const args = ['dev', '--local', '--port', String(port), '--inspector-port', String(port + 1000), '--persist-to', persist,
    '--show-interactive-dev-session=false', ...extra]
  const child = spawn(join(SERVER, 'node_modules', '.bin', 'wrangler'), args, {
    cwd: SERVER, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  const w = { name, port, base: `http://localhost:${port}`, persist, child, log: '', exited: false }
  const take = d => { w.log += d }
  child.stdout.on('data', take)
  child.stderr.on('data', take)
  child.on('exit', () => { w.exited = true })
  workers.push(w)
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (w.exited) throw new Error(`wrangler (${name}) exited:\n${scrub(w.log).slice(-2000)}`)
    try { if ((await fetch(`${w.base}/healthz`)).ok) return w } catch { /* not up yet */ }
    await sleep(400)
  }
  throw new Error(`wrangler (${name}) did not start within 120 s`)
}
async function stopWorker(w) {
  if (w.exited) return
  try { process.kill(-w.child.pid, 'SIGTERM') } catch { /* gone */ }
  for (let i = 0; i < 40 && !w.exited; i++) await sleep(100)
  if (!w.exited) try { process.kill(-w.child.pid, 'SIGKILL') } catch { /* gone */ }
  writeFileSync(join(OUT, `wrangler-${w.name}.log`), scrub(w.log))
}
const stopAllNow = () => { for (const w of workers) if (!w.exited) try { process.kill(-w.child.pid, 'SIGKILL') } catch { /* gone */ } }
process.on('exit', stopAllNow)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopAllNow(); process.exit(130) })

// ---- fetch -------------------------------------------------------------------------------------------------------
const IP = '198.51.100.7'
/** Every response of the main Worker, for the header audit at the end. */
const seen = []
/**
 * One request. Writes carry the CSRF header and this origin unless `csrf: false` / `origin` say otherwise
 * (`origin: null` = no Origin header, as a same-origin fetch from some browsers).
 */
async function req(method, path, { base = BASE, body, raw, cookie, headers = {}, ip = IP, csrf, origin, redirect = 'manual' } = {}) {
  const h = { 'CF-Connecting-IP': ip, ...headers }
  if (csrf ?? (method !== 'GET' && method !== 'HEAD')) h['X-Dentora'] = '1'
  const o = origin === undefined ? (method !== 'GET' && method !== 'HEAD' ? base : null) : origin
  if (o) h.Origin = o
  if (cookie) h.Cookie = cookie
  let payload
  if (raw !== undefined) payload = raw
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(base + path, { method, headers: h, body: payload, redirect })
  const buf = Buffer.from(await res.arrayBuffer())
  scan(`${method} ${path}`, buf)
  scan(`${method} ${path} (headers)`, [...res.headers].map(([k, v]) => `${k}: ${v}`).join('\n'))
  let json = null
  if ((res.headers.get('content-type') || '').includes('json')) try { json = JSON.parse(buf.toString('utf8')) } catch { /* not JSON */ }
  const r = { method, path, status: res.status, headers: res.headers, buf, text: buf.toString('utf8'), json }
  if (base === BASE) seen.push({ method, path, status: r.status, headers: res.headers })
  return r
}
const COOKIE = '__Host-dentora_admin', DEVICE_COOKIE = '__Host-dentora_device'
/** name=value of one Set-Cookie of a response ('' when absent). */
const setCookieOf = (r, name) => (r.headers.getSetCookie().find(c => c.startsWith(`${name}=`)) || '').split(';')[0]
async function login(ip = IP, base = BASE, password = PASSWORD, headers = {}) {
  const r = await req('POST', '/api/login', { base, ip, body: { password }, headers })
  return { r, cookie: setCookieOf(r, COOKIE), device: setCookieOf(r, DEVICE_COOKIE) }
}
/**
 * A GET with the path exactly as written (fetch would turn "\\" into "/" before sending) and only the headers given:
 * no Sec-Fetch-Mode, as from curl or a download manager. Node's fetch always sends "Sec-Fetch-Mode: cors", which the
 * Worker rightly does not count as a download (a page fetching the link), so counted downloads go through here.
 */
const rawGet = (path, { base = BASE, ip = IP, headers = {} } = {}) => new Promise((resolve, reject) => {
  const u = new URL(base)
  const rq = httpRequest({ host: u.hostname, port: u.port, path, method: 'GET', headers: { 'CF-Connecting-IP': ip, ...headers } }, res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location || '' })) })
  rq.on('error', reject)
  rq.end()
})
const b64url = bytes => Buffer.from(bytes).toString('base64url')
/** A session token made the way src/auth.ts makes them (HKDF of the password and the stored salt, then HMAC). */
async function forgeToken(password, salt, exp) {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'HKDF', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode('dentora-admin-session-v1') },
    base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'])
  const payload = b64url(enc.encode(JSON.stringify({ exp, sid: 'e2e-forged' })))
  return `${payload}.${b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`session.${payload}`))))}`
}
/** The rows of a read-only query on the Worker's local D1 file (null when no database file answers it). */
async function queryD1(persist, sql) {
  const { DatabaseSync } = await import('node:sqlite')
  const dir = join(persist, 'v3', 'd1', 'miniflare-D1DatabaseObject')
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith('.sqlite') || f === 'metadata.sqlite') continue
    const db = new DatabaseSync(join(dir, f), { readOnly: true })
    try { return db.prepare(sql).all() } catch { /* another file */ } finally { db.close() }
  }
  return null
}
/** The session salt the Worker stored in its local D1 file. */
async function readSalt(persist) {
  return (await queryD1(persist, "SELECT value FROM settings WHERE key = 'session_salt'"))?.[0]?.value ?? null
}

/** RFC 4180: quoted cells with doubled quotes, commas and line breaks inside; CRLF between records. */
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false, bareLf = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++ }
    else if (c === '\n') { bareLf++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return { rows, bareLf }
}

const isoDay = d => d.toISOString().slice(0, 10)
const plusYears = n => { const t = new Date(); return isoDay(new Date(Date.UTC(t.getUTCFullYear() + n, t.getUTCMonth(), t.getUTCDate()))) }
const TODAY = isoDay(new Date())
const priceShown = p => (Number.isInteger(p) ? String(p) : p.toFixed(2))
const digits = s => String(s).replace(/\D/g, '')

// ---- browser -----------------------------------------------------------------------------------------------------
/** A page that records console errors and warnings, CSP violations, failed and 4xx/5xx requests, and dialogs. */
async function newPage(browser, { width, height, mobile = false, dsf = 1, base = BASE, lang } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dsf, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile,
    acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'],
  })
  await ctx.addInitScript(l => {
    window.__csp = []
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`))
    // The panel's language, set once per context so the panel's own switch still works afterwards.
    try { if (l && !sessionStorage.getItem('e2e-lang')) { localStorage.setItem('dentora.admin.lang', l); sessionStorage.setItem('e2e-lang', '1') } } catch { /* no storage */ }
  }, lang || '')
  const page = await ctx.newPage()
  const p = { ctx, page, console: [], http: [], failed: [], dialogs: [], pending: [] }
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') p.console.push(`${m.type()}: ${m.text()}`) })
  page.on('pageerror', e => p.console.push(`pageerror: ${e.message}`))
  page.on('requestfailed', r => p.failed.push(`${r.url().replace(base, '')} ${r.failure()?.errorText || ''}`))
  page.on('dialog', d => { p.dialogs.push(d.message()); d.dismiss().catch(() => {}) })
  page.on('response', r => {
    if (r.status() >= 400) p.http.push(`${r.status()} ${r.url().replace(base, '')}`)
    scan(`browser ${r.url()} (headers)`, JSON.stringify(r.headers()))
    // a download or a request the page cancelled may never yield a body: give up on it after a while
    p.pending.push(Promise.race([r.body().then(b => scan(`browser ${r.request().method()} ${r.url()}`, b)), sleep(5000)]).catch(() => {}))
  })
  p.csp = () => page.evaluate(() => window.__csp || [])
  p.close = async () => { await Promise.allSettled(p.pending); await ctx.close() }
  return p
}
const overflowOf = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
/** Scrolls through the page so lazy pictures load, then loads the rest eagerly (the phone row scrolls sideways). */
async function loadAllImages(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 600) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(30) }
  await page.evaluate(() => { document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager' }); window.scrollTo(0, 0) })
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 20_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
}
const shotDir = sub => { const d = join(SHOTS, sub); mkdirSync(d, { recursive: true }); return d }

// ==== the site ====================================================================================================
async function siteBasics() {
  section('robots, sitemap, health, 404, redirects')
  let r = await req('GET', '/healthz')
  check('GET /healthz → 200 "ok", no-store', r.status === 200 && r.text === 'ok' && r.headers.get('cache-control') === 'no-store')
  r = await req('GET', '/robots.txt')
  check('GET /robots.txt → disallows /admin, /api/, /download/; names the sitemap', r.status === 200 && /^text\/plain/.test(r.headers.get('content-type'))
    && /^Disallow: \/admin$/m.test(r.text) && /^Disallow: \/api\/$/m.test(r.text) && /^Disallow: \/download\/$/m.test(r.text)
    && r.text.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), r.text.replace(/\n/g, ' | '))
  r = await req('GET', '/sitemap.xml')
  const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  check('GET /sitemap.xml → 8 pages (home, activation, privacy, terms × ar/en), each with ar/en/x-default alternates', r.status === 200 && r.headers.get('content-type') === 'application/xml; charset=utf-8'
    && locs.length === 8 && locs.includes(`${ORIGIN}/activate`) && locs.includes(`${ORIGIN}/en/activate`)
    && (r.text.match(/hreflang="x-default"/g) || []).length === 8 && (r.text.match(/hreflang="ar"/g) || []).length === 8, locs.join(' '))
  const locStatus = []
  for (const loc of locs) locStatus.push(`${loc.replace(ORIGIN, '')}:${(await req('GET', loc.replace(ORIGIN, '') || '/')).status}`)
  check('every sitemap URL answers 200 here', locStatus.every(s => s.endsWith(':200')), locStatus.join(' '))
  r = await req('GET', '/no-such-page')
  check('unknown path → 404 page in Arabic and English', r.status === 404 && /^text\/html/.test(r.headers.get('content-type'))
    && r.text.includes('الصفحة غير موجودة') && r.text.includes('Page not found') && r.text.includes('noindex'))
  r = await req('GET', '/files/dentora.apk')
  check('/files/dentora.apk is not served directly (404: only /download/android counts)', r.status === 404)
  r = await req('GET', '/files/meta.json')
  check('/files/meta.json is not served directly (404)', r.status === 404)
  r = await req('GET', '/en/')
  check('/en/ → 301 /en', r.status === 301 && r.headers.get('location') === '/en')
  r = await req('GET', '/privacy/?x=1')
  check('/privacy/?x=1 → 301 /privacy?x=1', r.status === 301 && r.headers.get('location') === '/privacy?x=1')
  // Open-redirect guard: a path starting with two slashes (or a backslash) must never become a "//host" Location.
  const sameSite = loc => !/^[/\\]{2}/.test(loc) && new URL(loc, BASE).origin === new URL(BASE).origin
  const redirects = []
  for (const path of ['//evil.example/', '/\\evil.example/', '/////evil.example//', '/\\/evil.example/', '//evil.example/?next=1']) {
    const x = await rawGet(path)
    redirects.push(`${path} → ${x.status} ${x.location}`)
    if (x.status === 301 && !sameSite(x.location)) redirects.push('OFF-SITE')
  }
  check('trailing-slash redirect never leaves the site (//evil.example/, /\\evil.example/, /////evil.example//)', !redirects.includes('OFF-SITE'), redirects.join(' | '))
  r = await req('GET', '//evil.example/')
  check('//evil.example/ → 301 to /evil.example (then a 404 here)', r.status === 301 && r.headers.get('location') === '/evil.example', r.headers.get('location'))
  r = await req('POST', '/', { csrf: false })
  check('POST / → 405 with Allow', r.status === 405 && r.headers.get('allow') === 'GET, HEAD')
  r = await req('HEAD', '/')
  check('HEAD / → 200 without a body', r.status === 200 && r.buf.length === 0)

  section('/admin')
  for (const path of ['/admin', '/admin/']) {
    r = await req('GET', path)
    check(`GET ${path} → panel page, no-store, noindex`, r.status === 200 && r.headers.get('content-type') === 'text/html; charset=utf-8'
      && r.headers.get('cache-control') === 'no-store, no-transform' && /noindex/.test(r.headers.get('x-robots-tag') || '') && r.text.includes('src="/admin/admin.js"'),
    `${r.status} ${r.headers.get('cache-control')} ${r.headers.get('x-robots-tag')}`)
  }
  r = await req('GET', '/admin/index.html')
  check('static /admin/index.html → no-cache + noindex (public/_headers)', r.status === 200 && r.headers.get('cache-control') === 'no-cache, no-transform' && /noindex/.test(r.headers.get('x-robots-tag') || ''),
    `${r.status} ${r.headers.get('cache-control')} ${r.headers.get('x-robots-tag')}`)
  for (const path of ['/admin/admin.js', '/admin/admin.css', '/admin/logo.svg']) {
    r = await req('GET', path)
    check(`GET ${path} → 200, noindex, security headers`, r.status === 200 && /noindex/.test(r.headers.get('x-robots-tag') || '') && !missingSecurity(r.headers).length,
      `${r.status} ${r.headers.get('content-type')}`)
  }

  section('static files')
  for (const [path, type, cache] of [
    ['/css/site.css', 'text/css', 'public, max-age=600'], ['/css/landing.css', 'text/css', 'public, max-age=600'],
    ['/js/landing.js', 'javascript', 'public, max-age=600'], ['/img/og-ar.jpg', 'image/jpeg', 'public, max-age=86400'],
    ['/fonts/inter-latin-wght.woff2', 'font/woff2', 'public, max-age=31536000, immutable'], ['/favicon.svg', 'image/svg+xml', null],
    ['/site.webmanifest', 'manifest', null],
  ]) {
    r = await req('GET', path)
    const miss = missingSecurity(r.headers)
    check(`GET ${path} → 200 ${type}${cache ? `, ${cache}` : ''}, security headers`, r.status === 200 && (r.headers.get('content-type') || '').includes(type)
      && (!cache || r.headers.get('cache-control') === cache) && !miss.length, `${r.status} ${r.headers.get('content-type')} | ${r.headers.get('cache-control')}${miss.length ? ` | missing ${miss}` : ''}`)
  }
}

async function legalPages(s, label) {
  section(`legal pages${label}`)
  const pages = [['/privacy', 'ar', 'سياسة الخصوصية'], ['/terms', 'ar', 'شروط الاستخدام'], ['/en/privacy', 'en', 'Privacy policy'], ['/en/terms', 'en', 'Terms of use']]
  for (const [path, lang, title] of pages) {
    const r = await req('GET', path)
    const wa = `https://wa.me/${digits(s.whatsapp)}`
    const ok = r.status === 200 && r.text.includes(`<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`) && r.text.includes(`<h1`) && r.text.includes(title)
      && r.text.includes(`href="${wa}"`) && r.text.includes(`>${s.whatsapp}</a>`) && (!s.email || r.text.includes(`mailto:${s.email}`))
      && !/\{(contact|seller)\}/.test(r.text) && r.text.includes(`<link rel="canonical" href="${ORIGIN}${path}">`)
      && r.headers.get('cache-control') === 'public, max-age=300' && !/\sstyle="/.test(r.text) && !/<style/.test(r.text)
      && !/<script(?![^>]*type="application\/ld\+json")/.test(r.text)
    check(`GET ${path} → 200, "${title}", seller contact ${s.whatsapp}${s.email ? ` + ${s.email}` : ''}, canonical, nothing inline`, ok, `${r.status}`)
  }
}

/** Every rendered page at phone and desktop width: no sideways scroll, nothing broken, no console or CSP error. */
async function pageRenders(browser) {
  section('legal and 404 pages in Chromium')
  const dir = shotDir('pages')
  for (const path of ['/privacy', '/en/terms', '/no-such-page']) {
    for (const width of [360, 1440]) {
      const p = await newPage(browser, { width, height: 800 })
      const res = await p.page.goto(BASE + path, { waitUntil: 'networkidle' })
      await loadAllImages(p.page)
      const o = await overflowOf(p.page)
      const broken = await p.page.evaluate(() => [...document.images].filter(i => i.naturalWidth === 0).map(i => i.src))
      const csp = await p.csp()
      const expected = path === '/no-such-page' ? 404 : 200
      // the 404 page's own status is the one 4xx allowed here
      const http = p.http.filter(x => !(expected === 404 && x === `404 ${path}`))
      const consoleIssues = p.console.filter(x => !(expected === 404 && /status of 404/.test(x)))
      check(`${path} at ${width}px: ${expected}, no overflow, images, console, CSP`, res.status() === expected && o.sw <= o.cw && !broken.length && !csp.length && !consoleIssues.length && !http.length && !p.failed.length,
        `status ${res.status()}, ${o.sw}/${o.cw}px ${[...broken, ...csp, ...consoleIssues, ...http, ...p.failed].join(' | ')}`)
      await p.page.screenshot({ path: join(dir, `${path.replace(/\//g, '_').replace(/^_/, '') || 'home'}-${width}.png`), fullPage: true })
      await p.close()
    }
  }
}

async function landingAt(browser, lang, width) {
  const path = lang === 'ar' ? '/' : '/en'
  const tag = `landing ${path} at ${width}px`
  const p = await newPage(browser, { width, height: width < 700 ? 800 : 900 })
  const res = await p.page.goto(BASE + path, { waitUntil: 'networkidle' })
  check(`${tag}: HTTP 200 text/html`, res?.status() === 200 && /^text\/html/.test(res.headers()['content-type'] || ''), res?.status())
  await loadAllImages(p.page)
  const m = await p.page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    images: document.images.length,
    broken: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.currentSrc || i.src),
    // what sticks out past the viewport (the phone row scrolls inside its own box, so it is left out)
    wide: [...document.querySelectorAll('body *')].filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.right > document.documentElement.clientWidth + 1 || b.left < -1) && !el.closest('.phones') && getComputedStyle(el).position !== 'fixed' }).slice(0, 4).map(el => `${el.tagName}.${el.className}`),
  }))
  check(`${tag}: no horizontal overflow`, m.sw <= m.cw, `scrollWidth ${m.sw} / ${m.cw}${m.wide.length ? ` (${m.wide.join(', ')})` : ''}`)
  check(`${tag}: all ${m.images} images load (naturalWidth > 0)`, m.images >= 8 && m.broken.length === 0, m.broken.join(' '))
  const csp = await p.csp()
  check(`${tag}: no console errors or warnings`, p.console.length === 0, p.console.join(' | '))
  check(`${tag}: no CSP violations`, csp.length === 0, csp.join(' | '))
  check(`${tag}: no failed or 4xx/5xx requests`, p.failed.length === 0 && p.http.length === 0, [...p.failed, ...p.http].join(' | '))
  await p.page.screenshot({ path: join(shotDir('landing'), `${lang}-${width}.png`), fullPage: true })
  await p.close()
}

/** What the landing page shows of the settings, its head tags and structured data, and (once) every link on it. */
async function landingContent(browser, lang, s, label, { links = false, shot = '' } = {}) {
  const path = lang === 'ar' ? '/' : '/en'
  const tag = `landing ${path}${label}`
  const p = await newPage(browser, { width: 390, height: 844, mobile: true, dsf: 2 })
  const res = await p.page.goto(BASE + path, { waitUntil: 'networkidle' })
  const d = await p.page.evaluate(() => {
    const urls = new Set()
    const add = v => { if (v) urls.add(v.trim()) }
    document.querySelectorAll('a[href]').forEach(a => add(a.getAttribute('href')))
    document.querySelectorAll('link[href]').forEach(l => add(l.getAttribute('href')))
    document.querySelectorAll('script[src]').forEach(s => add(s.getAttribute('src')))
    document.querySelectorAll('img[src]').forEach(i => add(i.getAttribute('src')))
    document.querySelectorAll('img[srcset], source[srcset]').forEach(i => i.getAttribute('srcset').split(',').forEach(part => add(part.trim().split(/\s+/)[0])))
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:url"]').forEach(m => add(m.getAttribute('content')))
    document.querySelectorAll('use').forEach(u => add(u.getAttribute('href')))
    const ids = [...document.querySelectorAll('[id]')].map(e => e.id)
    const meta = sel => document.querySelector(sel)?.getAttribute('content') ?? null
    return {
      lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.title,
      urls: [...urls], ids, dupIds: ids.filter((id, i) => ids.indexOf(id) !== i),
      h1: document.querySelectorAll('h1').length,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
      scripts: document.querySelectorAll('script').length, inline: document.querySelectorAll('[style], style').length,
      canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
      hreflang: Object.fromEntries([...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l => [l.getAttribute('hreflang'), l.getAttribute('href')])),
      og: { title: meta('meta[property="og:title"]'), description: meta('meta[property="og:description"]'), url: meta('meta[property="og:url"]'), image: meta('meta[property="og:image"]'), locale: meta('meta[property="og:locale"]'), type: meta('meta[property="og:type"]') },
      twitter: { card: meta('meta[name="twitter:card"]'), image: meta('meta[name="twitter:image"]') },
      description: meta('meta[name="description"]'),
      priceNum: document.querySelector('.price-num')?.textContent ?? null,
      priceText: document.querySelector('.price-text')?.textContent ?? null,
      announce: document.querySelector('.announce p')?.textContent ?? null,
      announceHtml: document.querySelector('.announce p')?.innerHTML ?? null,
      wa: [...document.querySelectorAll('a[href^="https://wa.me/"]')].map(a => a.getAttribute('href')),
      footerWa: document.querySelector('.site-footer a[href^="https://wa.me/"] bdi')?.textContent ?? null,
      download: document.querySelector('#download')?.textContent.replace(/\s+/g, ' ') ?? '',
      injected: document.querySelectorAll('img[src="x"], .announce script, .price-card script').length,
    }
  })
  const csp = await p.csp()
  check(`${tag}: 200, lang/dir, one h1, no duplicate ids, nothing inline, 2 scripts (JSON-LD + landing.js)`,
    res.status() === 200 && d.lang === lang && d.dir === (lang === 'ar' ? 'rtl' : 'ltr') && d.h1 === 1 && !d.dupIds.length && d.inline === 0 && d.scripts === 2,
    `${res.status()} ${d.lang}/${d.dir} h1=${d.h1} dup=${d.dupIds.join(',')} inline=${d.inline} scripts=${d.scripts}`)
  const price = priceShown(s.priceUsd), priceText = (lang === 'ar' ? s.priceTextAr : s.priceTextEn).trim()
  check(`${tag}: price $${price} and price line from settings`, d.priceNum === price && (priceText ? d.priceText === priceText : d.priceText === null), `${d.priceNum} | ${d.priceText}`)
  const waDigits = new Set(d.wa.map(u => /^https:\/\/wa\.me\/(\d+)\?text=./.exec(u)?.[1] || 'bad'))
  check(`${tag}: every WhatsApp link (${d.wa.length}) goes to ${s.whatsapp} with a message; footer shows it`,
    d.wa.length >= 5 && waDigits.size === 1 && waDigits.has(digits(s.whatsapp)) && d.footerWa === s.whatsapp.trim(), `${[...waDigits].join(',')} | ${d.footerWa}`)
  const announcement = (lang === 'ar' ? s.announcementAr : s.announcementEn).trim()
  check(`${tag}: announcement bar ${announcement ? 'shows the settings text, as text' : 'hidden'}`, announcement ? d.announce === announcement && d.injected === 0 : d.announce === null, `${d.announce}`)
  check(`${tag}: no script ran from the settings (no dialog, no injected element)`, p.dialogs.length === 0 && d.injected === 0, p.dialogs.join(' | '))
  check(`${tag}: no console errors, no CSP violations`, !p.console.length && !csp.length, [...p.console, ...csp].join(' | '))

  // structured data
  let graph = null
  try { graph = JSON.parse(d.ld[0])['@graph'] } catch { /* checked next */ }
  const app = graph?.find(x => x['@type'] === 'SoftwareApplication'), faq = graph?.find(x => x['@type'] === 'FAQPage')
  const canonical = `${ORIGIN}${path}`
  check(`${tag}: JSON-LD parses: SoftwareApplication (offer $${price} USD, version ${APK_VERSION}) + FAQPage`,
    d.ld.length === 1 && app && app.name === 'Dentora' && app.url === canonical && app.offers?.price === price && app.offers?.priceCurrency === 'USD'
    && app.softwareVersion === APK_VERSION && faq?.mainEntity?.length >= 5 && faq.mainEntity.every(q => q.name && q.acceptedAnswer?.text)
    && faq.mainEntity.some(q => q.acceptedAnswer.text.includes(s.whatsapp.trim())), JSON.stringify(app?.offers || null))
  check(`${tag}: canonical, hreflang ar/en/x-default, Open Graph and Twitter tags`,
    d.canonical === canonical && d.hreflang.ar === `${ORIGIN}/` && d.hreflang.en === `${ORIGIN}/en` && d.hreflang['x-default'] === `${ORIGIN}/`
    && d.og.title && d.og.description && d.og.url === canonical && d.og.image === `${ORIGIN}/img/og-${lang}.jpg` && d.og.type === 'website'
    && d.og.locale === (lang === 'ar' ? 'ar_AR' : 'en_US') && d.twitter.card === 'summary_large_image' && d.twitter.image === d.og.image && d.description && d.title,
    JSON.stringify({ c: d.canonical, h: d.hreflang, og: d.og.image, locale: d.og.locale }))
  check(`${tag}: download section shows Android ${APK_VERSION} and its size`, d.download.includes(APK_VERSION) && /2\.5 (MB|ميغابايت|م\.ب)/.test(d.download), d.download.slice(0, 200))

  if (links) {
    const local = new Map(), anchors = [], external = [], wa = [], bad = []
    for (const u of d.urls) {
      if (u.startsWith('#')) anchors.push(u)
      else if (u.startsWith(ORIGIN)) local.set(u.slice(ORIGIN.length) || '/', u)
      else if (u.startsWith('/') && !u.startsWith('//')) local.set(u, u)
      else if (u.startsWith('https://wa.me/')) wa.push(u)
      else if (u.startsWith('mailto:')) { /* checked with the settings */ }
      else external.push(u)
    }
    const missingAnchors = anchors.filter(a => a.length > 1 && !d.ids.includes(a.slice(1)))
    check(`${tag}: all ${anchors.length} #anchors and <use> references resolve`, anchors.length > 10 && !missingAnchors.length, missingAnchors.join(' '))
    check(`${tag}: no links to other sites besides wa.me`, !external.length, external.join(' '))
    for (const [path] of local) {
      // HEAD for the downloads: a HEAD is never counted, so the download counts stay exact
      const isDl = path.startsWith('/download/')
      const r = await req(isDl ? 'HEAD' : 'GET', path)
      const want = path === '/download/windows' ? 302 : 200
      if (r.status !== want) bad.push(`${path} → ${r.status}`)
      else if (/\.(webp|avif|jpg|png|svg|ico)$/.test(path) && !/^image\//.test(r.headers.get('content-type') || '')) bad.push(`${path} type ${r.headers.get('content-type')}`)
      else if (/\.woff2$/.test(path) && r.headers.get('content-type') !== 'font/woff2') bad.push(`${path} type ${r.headers.get('content-type')}`)
    }
    check(`${tag}: all ${local.size} internal links and files resolve (pages, images, fonts, css, js, downloads)`, local.size > 20 && !bad.length, bad.join(' | '))
  }
  if (shot) await p.page.screenshot({ path: join(shotDir('landing'), `${shot}.png`), fullPage: false })
  await p.close()
}

async function site(browser, cookie) {
  await siteBasics()
  await legalPages(DEFAULT_SETTINGS, ' (default settings)')
  await pageRenders(browser)

  section('landing page at 360, 390, 768 and 1440 px')
  for (const lang of ['ar', 'en']) for (const w of [360, 390, 768, 1440]) await landingAt(browser, lang, w)
  section('landing page content (default settings)')
  for (const lang of ['ar', 'en']) await landingContent(browser, lang, DEFAULT_SETTINGS, '', { links: true })

  section('settings changed in the API show on the next load')
  const changed = {
    ...DEFAULT_SETTINGS, priceUsd: 49.5, priceTextAr: 'عرض الافتتاح: ترخيص مدى الحياة بـ ⁦49.50$⁩', priceTextEn: 'Launch offer: lifetime licence for $49.50',
    whatsapp: '+963 944 111 222', email: 'sales@raqeem.dev', announcementAr: 'خصم الافتتاح حتى نهاية الشهر', announcementEn: 'Launch discount until the end of the month',
  }
  let r = await req('PUT', '/api/settings', { cookie, body: changed })
  check('PUT /api/settings (price, price lines, WhatsApp, e-mail, announcements) → 200', r.status === 200 && r.json?.priceUsd === 49.5 && r.json.whatsapp === changed.whatsapp, JSON.stringify(r.json))
  for (const lang of ['ar', 'en']) await landingContent(browser, lang, changed, ' after the change', { shot: `settings-${lang}-390` })
  await legalPages(changed, ' (changed contact)')
  r = await req('GET', '/download/windows', { redirect: 'manual', headers: { Referer: `${BASE}/en` } })
  check('/download/windows asks the new WhatsApp number', r.status === 302 && r.headers.get('location').startsWith('https://wa.me/963944111222?text='), r.headers.get('location'))

  section('settings values are shown escaped')
  const hostile = { ...changed, announcementAr: '<script>alert(1)</script> عرض', announcementEn: '<script>alert(1)</script><img src=x onerror=alert(2)>', priceTextEn: '"><script>alert(3)</script>' }
  r = await req('PUT', '/api/settings', { cookie, body: hostile })
  check('PUT /api/settings with <script>alert(1)</script> values → 200 (stored as text)', r.status === 200 && r.json?.announcementAr === hostile.announcementAr)
  for (const lang of ['ar', 'en']) {
    r = await req('GET', lang === 'ar' ? '/' : '/en')
    check(`GET ${lang === 'ar' ? '/' : '/en'}: the markup arrives entity-escaped, never raw`, !r.text.includes('<script>alert(') && !r.text.includes('<img src=x') && r.text.includes('&lt;script&gt;alert('))
    await landingContent(browser, lang, hostile, ' with markup in the settings', { shot: `escaped-${lang}-390` })
  }
  r = await req('PUT', '/api/settings', { cookie, body: DEFAULT_SETTINGS })
  check('settings back to the defaults', r.status === 200 && JSON.stringify(r.json) === JSON.stringify(DEFAULT_SETTINGS))
}

// ==== API ==========================================================================================================
/** Who the Worker should have counted: one download per address (IPv6: /64), platform and day. */
const counted = new Set()
const countedOf = platform => [...counted].filter(k => k.startsWith(`${platform}|`)).length
const DEV_A = 'AB2C-D3EF', DEV_B = 'XY7K-M4PQ', DEV_C = 'K9MN-P2QR', DEV_X = 'ZZZZ-9999'

async function api(browser, mainWorker) {
  section('API: sign-in, CSRF, session')
  const PROTECTED = [
    ['POST', '/api/logout'], ['GET', '/api/me'], ['GET', '/api/stats'], ['GET', '/api/licences'], ['POST', '/api/licences', { device: DEV_A, plan: 'pro', validity: 'lifetime' }],
    ['GET', '/api/licences.csv'], ['GET', '/api/licences/abc'], ['PATCH', '/api/licences/abc', { note: 'x' }], ['POST', '/api/resets', { device: DEV_A }],
    ['GET', '/api/resets'], ['POST', '/api/verify', { device: DEV_A, code: 'x' }], ['GET', '/api/settings'], ['PUT', '/api/settings', { priceUsd: 1 }], ['GET', '/api/audit'],
    ['POST', '/api/keys', { plan: 'pro', validity: 'lifetime' }],
  ]
  const no401 = []
  for (const [m, path, body] of PROTECTED) {
    const r = await req(m, path, { body })
    if (r.status !== 401 || r.json?.error !== 'auth') no401.push(`${m} ${path} → ${r.status} ${r.text}`)
  }
  check(`all ${PROTECTED.length} protected routes → 401 {error:"auth"} without a cookie`, !no401.length, no401.join(' | '))
  let r = await req('POST', '/api/login', { body: { password: PASSWORD }, csrf: false })
  check('POST /api/login without X-Dentora → 403 origin', r.status === 403 && r.json?.error === 'origin')
  r = await req('POST', '/api/login', { body: { password: PASSWORD }, origin: 'https://evil.example' })
  check('POST /api/login from a foreign Origin → 403 origin', r.status === 403 && r.json?.error === 'origin')
  r = await req('POST', '/api/login', { body: { password: PASSWORD }, origin: null })
  check('POST /api/login without Origin but with X-Dentora → allowed (200)', r.status === 200)
  r = await req('POST', '/api/login', { body: { password: 'not-the-password' } })
  check('POST /api/login wrong password → 401 password', r.status === 401 && r.json?.error === 'password')
  r = await req('POST', '/api/login', { raw: 'not json', headers: { 'Content-Type': 'application/json' } })
  check('POST /api/login with a body that is not JSON → 401 password (counted as a failure)', r.status === 401 && r.json?.error === 'password')
  const { r: ok, cookie, device } = await login()
  const [setCookie = '', setDevice = ''] = ok.headers.getSetCookie()
  check('POST /api/login right password → 200 {ok:true}', ok.status === 200 && ok.json?.ok === true)
  check('session cookie: __Host- prefix; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200 (no Domain)', /^__Host-dentora_admin=[\w-]+\.[\w-]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=43200$/.test(setCookie),
    setCookie.replace(/=[\w-]+\.[\w-]+;/, '=<token>;'))
  check('device cookie: __Host-dentora_device, HttpOnly; Secure; SameSite=Strict; Path=/; one year', /^__Host-dentora_device=[\w-]+\.[\w-]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=31536000$/.test(setDevice),
    setDevice.replace(/=[\w-]+\.[\w-]+;/, '=<token>;'))
  r = await req('GET', '/api/me', { cookie: `${COOKIE}=${device.split('=')[1]}` })
  check('the device token does not work as a session (401)', r.status === 401)
  r = await req('GET', '/api/me', { cookie: `dentora_admin=planted; ${cookie}` })
  check('a planted cookie under the old unprefixed name does not shadow the session (200)', r.status === 200)
  r = await req('PATCH', '/api/licences/abc', { cookie, body: { note: 'x' }, csrf: false })
  check('PATCH with a session but without X-Dentora → 403 origin', r.status === 403 && r.json?.error === 'origin')
  r = await req('PUT', '/api/settings', { cookie, body: { priceUsd: 1 }, origin: 'https://evil.example' })
  check('PUT /api/settings with a session from a foreign Origin → 403 origin', r.status === 403 && r.json?.error === 'origin')
  r = await req('POST', '/api/logout', { cookie, csrf: false })
  check('POST /api/logout without X-Dentora → 403 (a cross-site page cannot sign the seller out)', r.status === 403)

  const token = cookie.split('=')[1]
  const [payload, sig] = token.split('.')
  const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)   // the first character: the last one carries padding bits
  const longer = b64url(Buffer.from(JSON.stringify({ exp: 9_999_999_999 })))
  const tampered = [
    ['a changed signature', `${payload}.${flipped}`], ['a later expiry with the old signature', `${longer}.${sig}`],
    ['a third part', `${token}.x`], ['an empty value', ''], ['garbage', 'not-a-token'],
  ]
  const accepted = []
  for (const [what, t] of tampered) { const x = await req('GET', '/api/me', { cookie: `${COOKIE}=${t}` }); if (x.status !== 401) accepted.push(`${what}: ${x.status}`) }
  check('tampered session cookies → 401 (signature, expiry, extra part, empty, garbage)', !accepted.length, accepted.join(' | '))
  const salt = await readSalt(mainWorker.persist)
  if (salt) {
    const now = Math.floor(Date.now() / 1000)
    const fresh = await req('GET', '/api/me', { cookie: `${COOKIE}=${await forgeToken(PASSWORD, salt, now + 600)}` })
    const expired = await req('GET', '/api/me', { cookie: `${COOKIE}=${await forgeToken(PASSWORD, salt, now - 5)}` })
    const otherSalt = await req('GET', '/api/me', { cookie: `${COOKIE}=${await forgeToken(PASSWORD, `${salt}x`, now + 600)}` })
    check('a session signed with the real key is accepted (control), the same token expired 5 s ago → 401, another salt → 401',
      fresh.status === 200 && expired.status === 401 && otherSalt.status === 401, `${fresh.status} ${expired.status} ${otherSalt.status}`)
  } else check('session salt readable from the local D1 file (for the expiry test)', false, mainWorker.persist)

  section('API: lock after 5 wrong passwords')
  const LOCK_IP = '203.0.113.9'
  const codes = []
  let last
  for (let i = 0; i < 5; i++) { last = await req('POST', '/api/login', { ip: LOCK_IP, body: { password: `wrong-${i}` } }); codes.push(last.status) }
  check('5 wrong passwords from one address → 401 ×4, then 429 locked with retryAfter', codes.join() === '401,401,401,401,429' && last.json?.error === 'locked' && last.json.retryAfter > 850 && last.json.retryAfter <= 900,
    `${codes.join()} ${JSON.stringify(last.json)}`)
  r = await req('POST', '/api/login', { ip: LOCK_IP, body: { password: PASSWORD } })
  check('the right password from the locked address → still 429 with retryAfter', r.status === 429 && r.json?.error === 'locked' && r.json.retryAfter > 0, JSON.stringify(r.json))
  r = await req('POST', '/api/login', { ip: '198.51.100.99', body: { password: PASSWORD } })
  check('another address can still sign in', r.status === 200)

  section('API: login limits hold under parallel requests, per IPv6 /64, and for oversized bodies')
  const RACE_IP = '203.0.113.40'
  const burst = await Promise.all(Array.from({ length: 60 }, (_, i) => req('POST', '/api/login', { ip: RACE_IP, body: { password: `wrong-burst-${i}` } })))
  const burstCodes = {}
  for (const x of burst) burstCodes[x.status] = (burstCodes[x.status] || 0) + 1
  let auditNow = (await req('GET', '/api/audit?limit=500', { cookie })).json?.items || []
  const compared = auditNow.filter(i => i.action === 'login.fail' && i.ip === RACE_IP).length
  check('60 wrong passwords at once from one address → only 5 compared (4×401, the rest 429)', compared === 5 && burstCodes[401] === 4 && burstCodes[429] === 56,
    `${JSON.stringify(burstCodes)}, compared ${compared}`)
  for (let i = 1; i <= 5; i++) await req('POST', '/api/login', { ip: `2001:db8:77:1::${i}`, body: { password: 'wrong-v6' } })
  r = await req('POST', '/api/login', { ip: '2001:db8:77:1:abcd::99', body: { password: PASSWORD } })
  check('5 wrong passwords from addresses in one IPv6 /64 lock the whole /64 (429 for a 6th address)', r.status === 429 && r.json?.error === 'locked', `${r.status}`)
  r = await req('POST', '/api/login', { ip: '2001:db8:77:2::1', body: { password: PASSWORD } })
  check('the next /64 can still sign in (200)', r.status === 200)
  const big = new ReadableStream({ start(c) { const part = new Uint8Array(1 << 16).fill(97); for (let i = 0; i < 16; i++) c.enqueue(part); c.close() } })
  const t0 = Date.now()
  const bigRes = await fetch(`${BASE}/api/login`, { method: 'POST', body: big, duplex: 'half', headers: { 'X-Dentora': '1', 'CF-Connecting-IP': '203.0.113.41', 'Content-Type': 'application/json' } })
  const bigBody = await bigRes.text()
  check('a 1 MB chunked login body (no Content-Length) is cut at 16 KB → 401 password', bigRes.status === 401 && bigBody.includes('password'), `${bigRes.status} ${bigBody.slice(0, 60)} in ${Date.now() - t0} ms`)

  section('API: me, licences')
  r = await req('GET', '/api/me', { cookie })
  check('GET /api/me → {ok:true, signing:true, signingError:null}', r.status === 200 && r.json?.ok === true && r.json.signing === true && r.json.signingError === null, JSON.stringify(r.json))
  const sale = { device: 'ab2c d3ef', plan: 'pro', validity: 'lifetime', customer: 'سامي الأحمد', clinic: 'عيادة النور', phone: '0996 489 504', price: 59, note: 'أول عميل' }
  const invalid = []
  for (const [bad, code, field] of [
    [{ device: 'AB1C-D3EF' }, 'device'], [{ device: 'AB2C-D3E' }, 'device'], [{ plan: 'gold' }, 'plan'], [{ validity: '5y' }, 'validity'],
    [{ validity: 'date', until: '2020-01-01' }, 'until'], [{ validity: 'date', until: '2031-02-30' }, 'until'], [{ price: -3 }, 'price'], [{ price: 100001 }, 'price'],
    [{ customer: 'x'.repeat(201) }, 'field', 'customer'], [{ note: 'x'.repeat(1001) }, 'field', 'note'], [{ clinic: 42 }, 'field', 'clinic'],
  ]) {
    r = await req('POST', '/api/licences', { cookie, body: { ...sale, ...bad } })
    if (r.status !== 400 || r.json?.error !== code || (field && r.json.field !== field)) invalid.push(`${JSON.stringify(bad).slice(0, 40)} → ${r.status} ${r.text}`)
  }
  r = await req('POST', '/api/licences', { cookie, raw: '[1,2]', headers: { 'Content-Type': 'application/json' } })
  if (r.status !== 400 || r.json?.field !== 'body') invalid.push(`array body → ${r.status} ${r.text}`)
  check('POST /api/licences validation: 400 device|plan|validity|until|price|field (+field), body', !invalid.length, invalid.join(' | '))

  r = await req('POST', '/api/licences', { cookie, body: sale })
  const L1 = r.json?.licence
  check('POST /api/licences lifetime pro → 201 {licence, message, existing:[]}', r.status === 201 && L1?.device === DEV_A && L1.plan === 'pro' && L1.until === null && L1.status === 'active'
    && L1.price === 59 && r.json.existing.length === 0 && /^[\dA-Z]{4}(-[\dA-Z]{4}){27}$/.test(L1.code), `${r.status} ${L1?.code?.length}`)
  let c = await checkCode(DEV_A, L1.code)
  check('the lifetime code passes the app\'s checkCode for its device (pro, lifetime)', c.ok && c.plan === 'pro' && c.until === null, JSON.stringify(c))
  c = await checkCode(DEV_X, L1.code)
  check('the same code is refused on another device (reason "device")', !c.ok && c.reason === 'device', JSON.stringify(c))
  c = await checkCode(DEV_A, r.json.message.ar)
  check('the whole Arabic customer message, pasted into the app, activates', c.ok)
  check('customer message: Arabic + English with the code, wa.me link to the customer\'s number', r.json.message.ar.includes(L1.code) && r.json.message.en.includes(L1.code)
    && /^https:\/\/wa\.me\/963996489504\?text=/.test(r.json.message.whatsappUrl), r.json.message.whatsappUrl?.slice(0, 40))

  r = await req('POST', '/api/licences', { cookie, body: { ...sale, plan: 'standard', validity: '1y', price: '' } })
  const L2 = r.json?.licence
  c = await checkCode(DEV_A, L2?.code || '')
  check(`1y standard licence → 201, until ${plusYears(1)}, price from the settings, existing lists the first licence; checkCode agrees`,
    r.status === 201 && L2.until === plusYears(1) && L2.price === DEFAULT_SETTINGS.priceUsd && r.json.existing.length === 1 && r.json.existing[0].id === L1.id
    && c.ok && c.plan === 'standard' && isoDay(c.until) === plusYears(1), `${r.status} ${L2?.until} ${L2?.price} ${JSON.stringify(c)}`)
  r = await req('POST', '/api/licences', { cookie, body: { device: 'xy7km4pq', plan: 'pro', validity: 'date', until: '2031-12-31', customer: 'Dr. Lina Haddad', clinic: '', phone: '', price: 45 } })
  const L3 = r.json?.licence
  c = await checkCode(DEV_B, L3?.code || '')
  check('dated licence (2031-12-31) → 201, checkCode agrees, no WhatsApp link without a phone', r.status === 201 && L3.until === '2031-12-31' && L3.device === DEV_B && c.ok && isoDay(c.until) === '2031-12-31' && r.json.message.whatsappUrl === null,
    `${r.status} ${L3?.until}`)
  // Cells a spreadsheet would run as formulas, and cells that need quoting.
  const csvNasty = { device: DEV_C, plan: 'standard', validity: 'lifetime', customer: '=HYPERLINK("http://evil.example","click")', clinic: 'Smile, "Dental" Clinic', phone: '+963 944 123 456', price: 30, note: 'line one\nline two, with comma' }
  r = await req('POST', '/api/licences', { cookie, body: csvNasty })
  const L4 = r.json?.licence
  check('licence with spreadsheet-hostile text → 201 (text kept as typed)', r.status === 201 && L4.customer === csvNasty.customer && L4.note === csvNasty.note, `${r.status}`)
  r = await req('POST', '/api/licences', { cookie, body: { device: DEV_C, plan: 'pro', validity: '2y', customer: '@SUM(A1:A9)', clinic: '-2+3', phone: '', price: 20, note: '' } })
  const L5 = r.json?.licence
  c = await checkCode(DEV_C, L5?.code || '')
  check(`2y licence → until ${plusYears(2)}, checkCode agrees; existing lists the other licence of the device`, r.status === 201 && L5.until === plusYears(2) && c.ok && isoDay(c.until) === plusYears(2)
    && r.json.existing.length === 1 && r.json.existing[0].id === L4.id, `${r.status} ${L5?.until}`)
  const created = [L1, L2, L3, L4, L5]

  section('API: list, search, pages, edit')
  r = await req('GET', '/api/licences', { cookie })
  check('GET /api/licences → newest first, total 5', r.status === 200 && r.json.total === 5 && r.json.items.map(i => i.id).join() === [...created].reverse().map(l => l.id).join())
  const pages = []
  for (const offset of [0, 2, 4]) pages.push(...(await req('GET', `/api/licences?limit=2&offset=${offset}`, { cookie })).json.items.map(i => i.id))
  check('pages of 2 (offset 0, 2, 4) cover all 5 licences once, in order', pages.join() === [...created].reverse().map(l => l.id).join(), pages.length)
  const search = async q => (await req('GET', `/api/licences?q=${encodeURIComponent(q)}`, { cookie })).json
  let s = await search('ab2cd3ef')
  check('search by device without its dash → 2', s.total === 2 && s.items.every(i => i.device === DEV_A))
  s = await search('النور')
  check('search by Arabic clinic name → 2', s.total === 2)
  s = await search('DR. LINA')
  check('search by customer, any case → 1', s.total === 1 && s.items[0].id === L3.id)
  s = await search('0944 123 456')
  check('search by a local phone number finds the +963 one', s.total === 1 && s.items[0].id === L4.id)
  s = await search('100%_')
  check('search treats % and _ literally', s.total === 0)
  r = await req('GET', '/api/licences?status=bogus', { cookie })
  check('?status=bogus → 400 field status', r.status === 400 && r.json?.error === 'field' && r.json.field === 'status')
  r = await req('GET', `/api/licences/${L1.id}`, { cookie })
  check('GET /api/licences/:id → licence + message', r.status === 200 && r.json.licence.code === L1.code && r.json.message.ar.includes('عيادة النور'))
  r = await req('GET', '/api/licences/00000000-0000-0000-0000-000000000000', { cookie })
  check('GET /api/licences/:unknown → 404 not_found', r.status === 404 && r.json?.error === 'not_found')
  r = await req('PATCH', `/api/licences/${L2.id}`, { cookie, body: { status: 'refunded', note: 'استرداد', device: 'ZZZZ-ZZZZ', code: 'x' } })
  check('PATCH status refunded + note → 200; device and code cannot be changed', r.status === 200 && r.json.licence.status === 'refunded' && r.json.licence.note === 'استرداد' && r.json.licence.device === DEV_A && r.json.licence.code === L2.code)
  r = await req('PATCH', `/api/licences/${L5.id}`, { cookie, body: { status: 'void' } })
  check('PATCH status void → 200', r.status === 200 && r.json.licence.status === 'void')
  r = await req('PATCH', `/api/licences/${L3.id}`, { cookie, body: { phone: '+963 955 222 333', price: '45.5' } })
  check('PATCH phone + price "45.5" → 200 (45.5)', r.status === 200 && r.json.licence.price === 45.5 && r.json.licence.phone === '+963 955 222 333')
  r = await req('GET', `/api/licences/${L3.id}`, { cookie })
  check('the message follows the edit: wa.me link to the new phone', r.json?.message?.whatsappUrl?.startsWith('https://wa.me/963955222333?text='))
  const patchBad = []
  for (const [body, code, field] of [[{ status: 'deleted' }, 'field', 'status'], [{ price: 'abc' }, 'price'], [{ customer: 'x'.repeat(201) }, 'field', 'customer']]) {
    r = await req('PATCH', `/api/licences/${L1.id}`, { cookie, body })
    if (r.status !== 400 || r.json?.error !== code || (field && r.json.field !== field)) patchBad.push(`${JSON.stringify(body).slice(0, 30)} → ${r.status} ${r.text}`)
  }
  r = await req('PATCH', '/api/licences/nope', { cookie, body: { note: 'x' } })
  if (r.status !== 404) patchBad.push(`unknown id → ${r.status}`)
  check('PATCH errors: 400 field status, 400 price, 400 field customer, 404 unknown', !patchBad.length, patchBad.join(' | '))
  for (const [st, n] of [['active', 3], ['refunded', 1], ['void', 1]]) {
    r = await req('GET', `/api/licences?status=${st}`, { cookie })
    check(`?status=${st} → ${n}`, r.json?.total === n && r.json.items.every(i => i.status === st), r.json?.total)
  }

  section('API: CSV export')
  r = await req('GET', '/api/licences.csv', { cookie })
  const csvText = r.buf.subarray(3).toString('utf8')
  const { rows, bareLf } = parseCsv(csvText)
  check('GET /api/licences.csv → text/csv, UTF-8 BOM, attachment with the date, no-store', r.status === 200 && r.headers.get('content-type') === 'text/csv; charset=utf-8'
    && r.buf[0] === 0xef && r.buf[1] === 0xbb && r.buf[2] === 0xbf && r.headers.get('content-disposition') === `attachment; filename="dentora-licences-${TODAY}.csv"` && r.headers.get('cache-control') === 'no-store',
  `${r.headers.get('content-type')} | ${r.headers.get('content-disposition')}`)
  const head = rows[0] || []
  const col = name => head.indexOf(name)
  const row = id => rows.find(x => x[col('id')] === id) || []
  check('CSV: header + 5 rows, every record ends in CRLF (line breaks only inside quotes)', rows.length === 6 && bareLf === 0 && csvText.endsWith('\r\n') && rows.every(x => x.length === head.length), `${rows.length} rows, ${bareLf} bare LF`)
  const r4 = row(L4.id), r5 = row(L5.id)
  check('CSV: commas, quotes and line breaks survive quoting (RFC 4180)', r4[col('clinic')] === csvNasty.clinic && r4[col('note')] === csvNasty.note && csvText.includes('"Smile, ""Dental"" Clinic"'),
    `${r4[col('clinic')]} | ${JSON.stringify(r4[col('note')])}`)
  check('CSV: cells starting with = + - @ get a leading apostrophe (no formula runs)', r4[col('customer')] === `'${csvNasty.customer}` && r4[col('phone')] === "'+963 944 123 456"
    && r5[col('customer')] === "'@SUM(A1:A9)" && r5[col('clinic')] === "'-2+3", `${r4[col('customer')]} | ${r4[col('phone')]} | ${r5[col('customer')]} | ${r5[col('clinic')]}`)
  check('CSV: codes, statuses, Arabic text and lifetime', row(L1.id)[col('code')] === L1.code && row(L2.id)[col('status')] === 'refunded' && row(L1.id)[col('clinic')] === 'عيادة النور' && row(L1.id)[col('valid_until')] === 'lifetime')

  section('API: PIN reset codes, verify')
  r = await req('POST', '/api/resets', { cookie, body: { device: 'nope' } })
  check('POST /api/resets bad device → 400 device', r.status === 400 && r.json?.error === 'device')
  r = await req('POST', '/api/resets', { cookie, body: { device: 'ab2c-d3ef', customer: 'سامي', phone: '+963 996 489 504', note: 'نسي الرمز' } })
  const reset = r.json?.reset
  const tomorrow = isoDay(new Date(Date.now() + 86_400_000))
  check(`POST /api/resets → 201, valid ${TODAY} to ${tomorrow}, message with wa.me`, r.status === 201 && reset.device === DEV_A && reset.day === TODAY && reset.lastDay === tomorrow
    && r.json.message.whatsappUrl?.startsWith('https://wa.me/963996489504?text=') && r.json.message.ar.includes(reset.code), `${r.status} ${reset?.day} ${reset?.lastDay}`)
  let rc = await checkResetCode(DEV_A, reset.code)
  check('the reset code passes the app\'s checkResetCode for its device', rc.ok, JSON.stringify(rc))
  rc = await checkResetCode(DEV_X, reset.code)
  check('the reset code is refused on another device', !rc.ok && rc.reason === 'device', JSON.stringify(rc))
  r = await req('GET', '/api/resets', { cookie })
  check('GET /api/resets → the code', r.status === 200 && r.json.items.length === 1 && r.json.items[0].id === reset.id && r.json.items[0].code === reset.code)
  const verify = async (device, code) => (await req('POST', '/api/verify', { cookie, body: { device, code } }))
  r = await verify('xy7k-m4pq', L3.code)
  check('verify a dated activation code → ok, pro, until 2031-12-31', r.json?.kind === 'activation' && r.json.ok && r.json.plan === 'pro' && r.json.until === '2031-12-31', JSON.stringify(r.json))
  r = await verify(DEV_A, `مرحباً\n${L1.code}\nشكراً`)
  check('verify a code pasted inside a message → ok, lifetime (until null)', r.json?.kind === 'activation' && r.json.ok && r.json.until === null, JSON.stringify(r.json))
  r = await verify(DEV_A, L3.code)
  check('verify another device\'s code → activation, not ok, reason device', r.json?.kind === 'activation' && !r.json.ok && r.json.reason === 'device', JSON.stringify(r.json))
  r = await verify(DEV_A, reset.code)
  check(`verify the reset code → reset, ok, until ${tomorrow}`, r.json?.kind === 'reset' && r.json.ok && r.json.until === tomorrow, JSON.stringify(r.json))
  r = await verify(DEV_A, 'hello')
  check('verify text without a code → kind null, reason format', r.json?.kind === null && !r.json.ok && r.json.reason === 'format', JSON.stringify(r.json))
  r = await verify('12', L1.code)
  check('verify with a bad device → 400 device', r.status === 400 && r.json?.error === 'device')

  section('API: settings')
  r = await req('GET', '/api/settings', { cookie })
  check('GET /api/settings → the defaults', r.status === 200 && JSON.stringify(r.json) === JSON.stringify(DEFAULT_SETTINGS), JSON.stringify(r.json))
  const settingsBad = []
  for (const [body, field] of [[{ whatsapp: '123' }, 'whatsapp'], [{ whatsapp: '+963 abc 489' }, 'whatsapp'], [{ windowsUrl: 'http://insecure.example/x.exe' }, 'windowsUrl'],
    [{ windowsUrl: 'javascript:alert(1)' }, 'windowsUrl'], [{ priceUsd: 100001 }, 'priceUsd'], [{ priceUsd: -1 }, 'priceUsd'], [{ email: 'nope' }, 'email'],
    [{ announcementAr: 'x'.repeat(301) }, 'announcementAr'], [{ priceTextEn: 5 }, 'priceTextEn']]) {
    r = await req('PUT', '/api/settings', { cookie, body })
    if (r.status !== 400 || r.json?.error !== 'field' || r.json.field !== field) settingsBad.push(`${JSON.stringify(body).slice(0, 40)} → ${r.status} ${r.text}`)
  }
  check('PUT /api/settings validation → 400 field + the field (WhatsApp, https URL, price, e-mail, length, type)', !settingsBad.length, settingsBad.join(' | '))
  r = await req('PUT', '/api/settings', { cookie, body: { email: 'sales@raqeem.dev', unknown: 'ignored' } })
  check('PUT /api/settings partial → 200 merged, unknown keys ignored', r.status === 200 && r.json.email === 'sales@raqeem.dev' && r.json.priceUsd === DEFAULT_SETTINGS.priceUsd && !('unknown' in r.json))
  r = await req('PUT', '/api/settings', { cookie, body: { email: '' } })

  section('downloads')
  r = await req('GET', '/download/android')
  check(`GET /download/android → 200, the bytes of releases/Dentora-${APK_VERSION}.apk`, r.status === 200 && Buffer.compare(r.buf, APK) === 0,
    `${r.buf.length} bytes, sha256 ${createHash('sha256').update(r.buf).digest('hex').slice(0, 16)}…`)
  check('/download/android headers: APK type, attachment with the version, length, no-store, security', r.headers.get('content-type') === 'application/vnd.android.package-archive'
    && r.headers.get('content-disposition') === `attachment; filename="Dentora-${APK_VERSION}.apk"` && r.headers.get('content-length') === String(APK.length)
    && r.headers.get('cache-control') === 'no-store' && !missingSecurity(r.headers).length, `${r.headers.get('content-type')} | ${r.headers.get('content-disposition')}`)
  r = await req('HEAD', '/download/android')
  check('HEAD /download/android → 200, no body (not counted)', r.status === 200 && r.buf.length === 0)
  r = await req('GET', '/download/android', { headers: { Range: 'bytes=100-199' } })
  // the local asset server answers a range with the whole file
  check('resumed /download/android (Range) → 206 with that part, or the whole file', (r.status === 206 && Buffer.compare(r.buf, APK.subarray(100, 200)) === 0) || (r.status === 200 && Buffer.compare(r.buf, APK) === 0), `status ${r.status}`)
  r = await req('GET', '/download/windows')
  const loc = decodeURIComponent(r.headers.get('location') || '')
  check('GET /download/windows, no installer URL → 302 to the seller\'s WhatsApp with an Arabic request', r.status === 302 && loc.startsWith('https://wa.me/963996489504?text=') && loc.includes('ويندوز'), loc)
  r = await req('GET', '/download/windows', { headers: { Referer: `${BASE}/en` } })
  check('GET /download/windows from the English page → English request', r.status === 302 && decodeURIComponent(r.headers.get('location') || '').includes('Windows version'))
  r = await req('PUT', '/api/settings', { cookie, body: { windowsUrl: 'https://downloads.raqeem.dev/Dentora-Setup-1.0.0.exe' } })
  r = await req('GET', '/download/windows')
  check('GET /download/windows with an installer URL in the settings → 302 there', r.status === 302 && r.headers.get('location') === 'https://downloads.raqeem.dev/Dentora-Setup-1.0.0.exe', r.headers.get('location'))
  r = await req('GET', '/en')
  check('the landing page names the Windows download once a URL is set', r.text.includes('Download for Windows'))
  await req('PUT', '/api/settings', { cookie, body: { windowsUrl: '' } })
  r = await req('HEAD', '/download/windows')
  check('HEAD /download/windows → 302 (not counted)', r.status === 302)

  section('downloads are counted once per visitor and day')
  await sleep(500)
  const before = (await req('GET', '/api/stats', { cookie })).json.downloads
  check('the fetch()es above (Sec-Fetch-Mode: cors, as a page fetching the link) were not counted', before.android === 0 && before.windows === 0, JSON.stringify(before))
  const many = await Promise.all(Array.from({ length: 40 }, () => rawGet('/download/windows', { ip: '192.0.2.60' })))
  counted.add('windows|192.0.2.60')
  await rawGet('/download/windows', { ip: '192.0.2.61', headers: { 'Sec-Fetch-Mode': 'no-cors' } })
  await rawGet('/download/windows', { ip: '192.0.2.62', headers: { 'Sec-Purpose': 'prefetch' } })
  await rawGet('/download/windows', { ip: '192.0.2.63', headers: { 'Sec-Fetch-Mode': 'navigate' } })
  counted.add('windows|192.0.2.63')
  await rawGet('/download/windows', { ip: '2001:db8:99:1::1' })
  await rawGet('/download/windows', { ip: '2001:db8:99:1::2' })
  counted.add('windows|2001:db8:99:1::/64')
  await rawGet('/download/android', { ip: '192.0.2.60', headers: { 'Sec-Fetch-Mode': 'navigate' } })
  await rawGet('/download/android', { ip: '192.0.2.60' })
  counted.add('android|192.0.2.60')
  await sleep(800)
  const after = (await req('GET', '/api/stats', { cookie })).json.downloads
  check('40 GETs from one address count once; a no-cors fetch and a prefetch do not; a navigation does; one IPv6 /64 counts once; Android apart (+3 Windows, +1 Android)',
    many.every(x => x.status === 302) && after.windows - before.windows === 3 && after.windows30 - before.windows30 === 3 && after.android - before.android === 1,
    `windows ${before.windows} → ${after.windows}, android ${before.android} → ${after.android}`)

  section('API: stats, audit, logout')
  await sleep(500)   // downloads are counted after the response (waitUntil)
  r = await req('GET', '/api/stats', { cookie })
  const st = r.json
  // L1 59 + L3 45.5 + L4 30 active; L2 refunded (counted, no revenue); L5 void (neither)
  const expected = {
    licences: { total: 4, month: 4, revenue: 134.5, revenueMonth: 134.5, pending: 0 }, resets: { total: 1 },
    downloads: { android: countedOf('android'), windows: countedOf('windows'), android30: countedOf('android'), windows30: countedOf('windows') },
  }
  check('GET /api/stats matches what was done (void excluded; revenue = active only; downloads GET only)',
    JSON.stringify({ licences: st?.licences, resets: st?.resets, downloads: st?.downloads }) === JSON.stringify(expected), JSON.stringify({ got: { l: st?.licences, d: st?.downloads }, expected }))
  check('stats.recent = the last 10 audit entries', st?.recent?.length === 10 && st.recent[0].id > st.recent[9].id)
  r = await req('GET', '/api/audit?limit=500', { cookie })
  const items = r.json?.items || []
  const byAction = a => items.filter(i => i.action === a)
  check('audit: login.ok, login.fail (with the address), licence.create ×5, licence.update, licences.csv, reset.create, settings.update',
    byAction('login.ok').length >= 3 && byAction('login.fail').filter(i => i.ip === LOCK_IP).length === 5 && byAction('licence.create').length === 5
    && byAction('licence.update').length === 3 && byAction('licences.csv').length === 1 && byAction('reset.create').length === 1 && byAction('settings.update').length >= 4,
  [...new Set(items.map(i => i.action))].map(a => `${a}×${byAction(a).length}`).join(' '))
  check('audit details: the device, plan and price of a sale; the changed fields of an edit', byAction('licence.create').some(i => i.detail.includes(DEV_B) && i.detail.includes('$45'))
    && byAction('licence.update').some(i => i.detail.includes('status: active → void')), byAction('licence.update').map(i => i.detail).join(' | '))
  r = await req('GET', '/api/audit?limit=2', { cookie })
  check('GET /api/audit?limit=2 → 2 entries', r.json?.items?.length === 2)
  r = await req('GET', '/api/whatever', { cookie })
  check('unknown /api route → 404 not_found', r.status === 404 && r.json?.error === 'not_found')
  r = await req('DELETE', `/api/licences/${L1.id}`, { cookie })
  check('DELETE /api/licences/:id → 404 (codes are never deleted)', r.status === 404)
  const { cookie: c2 } = await login()
  r = await req('POST', '/api/logout', { cookie: c2 })
  check('POST /api/logout → 200, cookie cleared (Max-Age=0), audited', r.status === 200 && r.json?.ok && /^__Host-dentora_admin=; .*Max-Age=0$/.test(r.headers.get('set-cookie') || ''))
  r = await req('GET', '/api/me', { cookie: c2 })
  const other = await req('GET', '/api/me', { cookie })
  check('after logout the old cookie no longer works (401), another session still does (200)', r.status === 401 && other.status === 200, `${r.status} ${other.status}`)
  r = await req('POST', '/api/logout')
  check('POST /api/logout without a cookie → 401', r.status === 401)
  return { cookie, L1 }
}

/** The Workers that cannot sign in (password under 12 characters) and cannot sign codes (the wrong key). */
async function otherWorkers(browser, setupW, keyW, codeFromMain) {
  section('Worker with ADMIN_PASSWORD under 12 characters')
  let r = await req('POST', '/api/login', { base: setupW.base, body: { password: PASSWORD } })
  check('POST /api/login → 503 setup (even with the usual password)', r.status === 503 && r.json?.error === 'setup', `${r.status} ${r.text}`)
  r = await req('POST', '/api/login', { base: setupW.base, body: { password: 'short-pass' } })
  check('POST /api/login with the short password itself → 503 setup', r.status === 503 && r.json?.error === 'setup')
  r = await req('GET', '/api/me', { base: setupW.base })
  check('GET /api/me → 401 (no session can exist)', r.status === 401)
  r = await req('GET', '/', { base: setupW.base })
  check('the public site still works without a password (GET / → 200)', r.status === 200)
  const dir = shotDir('admin')
  for (const lang of ['ar', 'en']) {
    const p = await newPage(browser, { width: 390, height: 844, mobile: true, dsf: 2, base: setupW.base, lang })
    await p.page.goto(`${setupW.base}/admin`)
    await p.page.fill('#login-pw', 'anything-at-all')
    await p.page.click('.login-form button[type=submit]')
    const ok = await p.page.waitForSelector('.setup', { timeout: 8000 }).then(() => true, () => false)
    const text = ok ? await p.page.locator('.setup').textContent() : ''
    await p.page.screenshot({ path: join(dir, `${lang}-phone-real-setup.png`), fullPage: true })
    const csp = await p.csp()
    const consoleIssues = p.console.filter(x => !/status of 503/.test(x))
    check(`panel (${lang}) on that Worker explains how to set ADMIN_PASSWORD`, ok && text.includes('ADMIN_PASSWORD') && !csp.length && !consoleIssues.length, [...csp, ...consoleIssues].join(' | '))
    await p.close()
  }

  section('Worker with a signing key that is not the app\'s')
  const { r: lr, cookie } = await login(IP, keyW.base)
  check('sign-in works without a usable key', lr.status === 200)
  r = await req('GET', '/api/me', { base: keyW.base, cookie })
  check('GET /api/me → signing false, signingError "mismatch"', r.json?.signing === false && r.json.signingError === 'mismatch', JSON.stringify(r.json))

  r = await req('POST', '/api/licences', { base: keyW.base, cookie, body: { device: DEV_A, plan: 'pro', validity: 'lifetime' } })
  check('POST /api/licences → 503 signing (no code from a wrong key)', r.status === 503 && r.json?.error === 'signing')
  r = await req('POST', '/api/resets', { base: keyW.base, cookie, body: { device: DEV_A } })
  check('POST /api/resets → 503 signing', r.status === 503 && r.json?.error === 'signing')
  r = await req('POST', '/api/verify', { base: keyW.base, cookie, body: { device: DEV_A, code: codeFromMain } })
  check('POST /api/verify still works (it needs only the public key)', r.json?.kind === 'activation' && r.json.ok === true)
  for (const lang of ['ar', 'en']) {
    const p = await newPage(browser, { width: 1440, height: 900, base: keyW.base, lang })
    await p.page.goto(`${keyW.base}/admin`)
    await p.page.fill('#login-pw', PASSWORD)
    await p.page.click('.login-form button[type=submit]')
    await p.page.waitForSelector('.kpis:not([aria-busy])')
    const banner = await p.page.waitForSelector('.banner', { timeout: 5000 }).then(() => true, () => false)
    await p.page.screenshot({ path: join(dir, `${lang}-desktop-real-signing-off.png`), fullPage: true })
    await p.page.goto(`${keyW.base}/admin#/new`)
    await p.page.waitForSelector('form button[type=submit]')
    const disabled = await p.page.locator('form button[type=submit]').isDisabled()
    const csp = await p.csp()
    check(`panel (${lang}) shows the signing banner and disables issuing`, banner && disabled && !csp.length && !p.console.length, [...csp, ...p.console].join(' | '))
    await p.close()
  }

  section('licence keys on that Worker: sold without signing, refused at activation (503 signing)')
  r = await req('POST', '/api/keys', { base: keyW.base, cookie, body: { plan: 'pro', validity: 'lifetime', clinic: 'Signing test' } })
  const waiting = r.json?.items?.[0]?.licence
  check('POST /api/keys → 201 (a key needs no signing until it is activated)', r.status === 201 && KEY_RE.test(waiting?.key || ''), `${r.status}`)
  const unsigned = []
  for (let i = 0; i < 11; i++) {
    const x = await activateReq({ key: waiting?.key, device: 'H7KQ-2MXD' }, { base: keyW.base, ip: '198.51.100.40' })
    unsigned.push(`${x.status} ${x.json?.error}${x.headers.get('access-control-allow-origin') === '*' ? '' : ' (no CORS)'}`)
  }
  check('POST /api/activate ×11 → 503 signing every time (with CORS), never 429: a fault on the server is not counted against the clinic',
    unsigned.every(x => x === '503 signing'), [...new Set(unsigned)].join(' | '))
  r = await req('POST', '/api/verify', { base: keyW.base, cookie, body: { code: waiting?.key } })
  check('…and the key is still waiting (verify → pending)', r.json?.status === 'pending' && r.json.ok === true, JSON.stringify(r.json))

  // Last on this Worker: it leaves new browsers locked out of it for 15 minutes.
  section('strangers cannot lock the seller out (30 failures from 30 addresses, on that Worker)')
  const { device } = await login('198.51.100.120', keyW.base)
  for (let i = 0; i < 30; i++) await req('POST', '/api/login', { base: keyW.base, ip: `192.0.2.${100 + i}`, body: { password: `stranger-${i}` } })
  r = await req('POST', '/api/login', { base: keyW.base, ip: '198.51.100.121', body: { password: PASSWORD } })
  check('a browser that never signed in → 429 locked (even with the right password)', r.status === 429 && r.json?.error === 'locked' && r.json.retryAfter > 0, `${r.status} ${r.text}`)
  r = await req('POST', '/api/login', { base: keyW.base, ip: '198.51.100.122', body: { password: PASSWORD }, headers: { Cookie: device } })
  check('the seller\'s browser (device cookie from an earlier sign-in) still signs in (200)', r.status === 200, `${r.status} ${r.text}`)
  r = await req('POST', '/api/login', { base: keyW.base, ip: '198.51.100.123', body: { password: 'wrong' }, headers: { Cookie: device } })
  check('…and a wrong password from it is still only a wrong password (401)', r.status === 401)
}

// ==== control panel ================================================================================================
const SIZES = { phone: { width: 390, height: 844, dsf: 2, mobile: true }, desktop: { width: 1440, height: 900, dsf: 1, mobile: false } }
const DEVICE = '7KQ4-M2XD'

/** The seller's whole day in the panel: sign in, sell, look up, edit, reset a PIN, verify, settings, log out. */
async function panelFlow(browser, lang, sizeName) {
  const size = SIZES[sizeName]
  const tag = `panel ${lang} ${sizeName}`
  const dir = shotDir('admin')
  const p = await newPage(browser, { width: size.width, height: size.height, dsf: size.dsf, mobile: size.mobile, lang })
  const { page } = p
  // Chromium logs every 4xx answer as a console error; allowed only where the test asks for one.
  let probe = false
  const unexpected4xx = []
  page.on('response', r => {
    const u = r.url().replace(BASE, '')
    if (r.status() >= 400 && !probe && !(u === '/api/login' && r.status() === 401)) unexpected4xx.push(`${r.status()} ${u}`)
  })
  const apiLog = []
  page.on('request', r => { if (r.url().includes('/api/')) apiLog.push({ m: r.method(), x: r.headers()['x-dentora'] || '' }) })
  const shot = async (name, full = true) => {
    await page.waitForTimeout(150)
    const file = join(dir, `${lang}-${sizeName}-${name}.png`)
    if (full) {
      // a viewport as tall as the page, so the sticky bars sit where a phone shows them
      const hgt = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: size.width, height: Math.max(size.height, hgt) })
      await page.waitForTimeout(120)
      await page.screenshot({ path: file })
      await page.setViewportSize({ width: size.width, height: size.height })
    } else await page.screenshot({ path: file })
    const o = await overflowOf(page)
    const missing = await page.evaluate(() => [...document.querySelectorAll('use')].map(u => u.getAttribute('href')).filter(h => !document.querySelector(h)))
    check(`${tag} ${name}: no horizontal overflow, icons resolve`, o.sw <= o.cw && !missing.length, `${o.sw}/${o.cw}px ${missing.join(' ')}`)
  }

  await page.goto(`${BASE}/admin`)
  await page.waitForSelector('.login-card')
  check(`${tag} login: lang/dir`, await page.evaluate(l => document.documentElement.lang === l && document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr'), lang))
  await shot('01-login')
  for (let i = 0; i < 3; i++) {
    await page.fill('#login-pw', `wrong-password-${i}`)
    await page.click('.login-form button[type=submit]')
    await page.waitForSelector('.login-msg .err')
  }
  const wrong = await page.locator('.login-msg .err').textContent()
  check(`${tag} wrong password message`, /غير صحيحة|Wrong password/.test(wrong), wrong)
  await shot('02-login-wrong')
  await page.fill('#login-pw', PASSWORD)
  await page.click('.login-form button[type=submit]')
  await page.waitForSelector('.kpis:not([aria-busy])')
  await page.waitForSelector('.feed, .empty')
  const kpi = await page.evaluate(async () => {
    const s = await (await fetch('/api/stats', { credentials: 'same-origin' })).json()
    return { s, shown: [...document.querySelectorAll('.kpis .kpi-value')].map(e => Number(e.textContent.replace(/[^\d.]/g, ''))) }
  })
  const want = [kpi.s.licences.revenue, kpi.s.licences.total, kpi.s.resets.total, kpi.s.downloads.android, kpi.s.downloads.windows]
  check(`${tag} dashboard shows the /api/stats numbers (revenue, licences, resets, downloads)`, JSON.stringify(kpi.shown) === JSON.stringify(want), `${kpi.shown} vs ${want}`)
  await shot('03-dashboard')
  await page.focus('#skip')
  await page.keyboard.press('Enter')
  const skip = await page.evaluate(() => ({ hash: location.hash, active: document.activeElement?.id }))
  check(`${tag} skip link focuses the content and keeps the route`, skip.active === 'main' && (skip.hash === '' || skip.hash === '#/'), JSON.stringify(skip))

  // ---- new licence
  await page.goto(`${BASE}/admin#/new`)
  await page.waitForSelector('input[name=device]')
  await page.click('input[name=device]')
  await page.keyboard.type('7kq4m2xd')
  check(`${tag} device number formats itself`, (await page.inputValue('input[name=device]')) === DEVICE)
  await page.waitForFunction(() => document.querySelector('input[name=price]').value !== '')
  check(`${tag} price defaults to the settings price`, (await page.inputValue('input[name=price]')) === String(DEFAULT_SETTINGS.priceUsd))
  check(`${tag} defaults: pro + lifetime`, (await page.locator('fieldset:has(legend) input[value=pro]').first().isChecked()) && (await page.locator('input[value=lifetime]').isChecked()))
  await page.fill('input[name=customer]', lang === 'ar' ? 'د. سامر الحلبي' : 'Dr. Samer Halabi')
  await page.fill('input[name=clinic]', lang === 'ar' ? 'عيادة الابتسامة' : 'Smile Dental Clinic')
  await page.fill('input[name=phone]', '0944 123 456')
  await page.fill('textarea[name=note]', lang === 'ar' ? 'دفع عبر شام كاش' : 'Paid by bank transfer')
  await page.locator('label', { hasText: lang === 'ar' ? 'حتى تاريخ' : 'Until a date' }).click()
  check(`${tag} "until a date" shows the date field`, await page.locator('input[name=until]').isVisible())
  await page.locator('label', { hasText: lang === 'ar' ? 'سنة' : '1 year' }).first().click()
  const preview = await page.locator('.validity-note').textContent()
  check(`${tag} 1 year shows the last day`, /20\d\d/.test(preview), preview)
  await page.locator('label', { hasText: lang === 'ar' ? 'مدى الحياة' : 'Lifetime' }).first().click()
  await shot('04-new-form')
  await page.fill('input[name=device]', '7KQ4-M2X')
  await page.click('form button[type=submit]')
  check(`${tag} a short device number is refused in the form`, ((await page.locator('input[name=device] ~ .err').textContent()) || '').length > 5)
  await page.fill('input[name=device]', '')
  await page.click('input[name=device]')
  await page.keyboard.type('7kq4 m2xd')
  await page.click('form button[type=submit]')
  await page.waitForSelector('.codebox')
  await page.waitForTimeout(300)
  const code = (await page.locator('.codebox').first().textContent()).trim()
  const verdict = await checkCode(DEVICE, code)
  check(`${tag} the code shown passes the app's checkCode for ${DEVICE} (pro, lifetime)`, verdict.ok && verdict.plan === 'pro' && verdict.until === null, JSON.stringify(verdict))
  check(`${tag} WhatsApp button goes to the customer`, (await page.locator('a.btn-wa').getAttribute('href')).startsWith('https://wa.me/963944123456?text='))
  check(`${tag} message (Arabic) contains the code`, (await page.locator('.bubble').textContent()).includes(code))
  await page.locator('.block-label label', { hasText: 'English' }).click()
  const bubbleEn = await page.locator('.bubble').textContent()
  check(`${tag} message switches to English, and so does the WhatsApp text`, bubbleEn.startsWith('Hello') && decodeURIComponent(await page.locator('a.btn-wa').getAttribute('href')).includes('Here is your Dentora activation code'))
  await page.locator('.block-label label', { hasText: 'العربية' }).click()
  await page.locator('.block-label .chip-btn').first().click()
  check(`${tag} copy button copies the code`, (await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')) === code)
  await shot('05-new-result')

  await page.locator('.form-actions .btn-outline').last().click()
  await page.waitForSelector('input[name=device]')
  await page.click('input[name=device]')
  await page.keyboard.type(DEVICE)
  await page.locator('label', { hasText: lang === 'ar' ? 'أساسية' : 'Standard' }).click()
  await page.locator('label', { hasText: lang === 'ar' ? 'سنتان' : '2 years' }).click()
  const XSS = '<img src=x onerror="window.__xss=1">"\'&'
  await page.fill('input[name=customer]', lang === 'ar' ? 'مخبر النور' : 'Al Noor Lab')
  await page.fill('textarea[name=note]', XSS)
  await page.fill('input[name=clinic]', sizeName === 'desktop' && lang === 'en' ? XSS : '')
  await page.fill('input[name=price]', '49.5')
  await page.click('form button[type=submit]')
  await page.waitForSelector('.result-head')
  check(`${tag} markup typed into customer data stays text`, await page.evaluate(() => !window.__xss && !document.querySelector('img[src="x"]')))
  check(`${tag} warning about the device's other active licence`, (await page.locator('.callout--warn').count()) === 1)
  await shot('06-new-existing')

  // ---- licences
  await page.goto(`${BASE}/admin#/licences`)
  await page.waitForSelector('.lic-row')
  check(`${tag} list shows markup as text`, await page.evaluate(() => !window.__xss && !document.querySelector('img[src="x"]')))
  await shot('07-licences')
  await page.fill('#lic-q', 'm2xd')
  await page.waitForTimeout(700)
  check(`${tag} search by part of a device number`, (await page.locator('.lic-row').count()) >= 2)
  await page.fill('#lic-q', 'zzzz-nothing')
  await page.waitForSelector('.lic-list .empty')
  await shot('08-licences-nomatch')
  await page.fill('#lic-q', '')
  await page.waitForSelector('.lic-row')
  await page.locator('.lic-row').first().focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('dialog.sheet .codebox')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog.sheet'))
  check(`${tag} keyboard: Enter opens a licence, Escape closes it, focus back on the row`, await page.evaluate(() => document.activeElement?.classList.contains('lic-row')))
  await page.selectOption('.toolbar select', 'active')
  await page.waitForTimeout(500)
  await page.locator('.lic-row').first().click()
  await page.waitForSelector('dialog.sheet .codebox')
  check(`${tag} a licence opens at its own address`, /#\/licences\/[\w-]+$/.test(page.url()), page.url())
  await shot('09-licence-sheet', false)
  await page.fill('dialog.sheet input[name=clinic]', lang === 'ar' ? 'مخبر النور للأسنان' : 'Al Noor Dental Lab')
  await page.fill('dialog.sheet input[name=phone]', '+963 955 222 333')
  await page.fill('dialog.sheet input[name=price]', '45')
  await page.click('dialog.sheet form button[type=submit]')
  const saved = await page.locator('.toast p', { hasText: /حفظ التعديلات|saved/ }).textContent({ timeout: 6000 }).catch(() => '')
  check(`${tag} edit saved`, /حفظ|saved/i.test(saved), saved)
  const refreshed = await page.waitForFunction(() => document.querySelector('dialog.sheet a.btn-wa')?.href.includes('963955222333'), null, { timeout: 6000 }).then(() => true, () => false)
  check(`${tag} the message follows the new phone`, refreshed)
  await page.locator('dialog.sheet .seg--status label').nth(1).click()
  await page.waitForSelector('dialog.confirm[open]')
  await shot('10-confirm', false)
  await page.locator('dialog.confirm .btn-warn').click()
  const refunded = await page.waitForFunction(() => document.querySelector('dialog.sheet .sheet-head .badge')?.className.includes('refunded'), null, { timeout: 6000 }).then(() => true, () => false)
  check(`${tag} status changed to refunded after confirming`, refunded)
  await page.locator('dialog.sheet .seg--status label').nth(2).click()
  await page.waitForSelector('dialog.confirm[open]')
  await page.locator('dialog.confirm .btn-outline').click()
  await page.waitForTimeout(200)
  check(`${tag} cancelling a status change keeps the status`, await page.locator('dialog.sheet .seg--status input[value=refunded]').isChecked())
  await shot('11-licence-sheet-edited', false)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog.sheet'))
  check(`${tag} closing the licence returns to the list`, page.url().endsWith('#/licences'), page.url())
  await page.selectOption('.toolbar select', 'refunded')
  await page.waitForSelector('.lic-row')
  check(`${tag} status filter`, (await page.locator('.lic-row .badge--refunded').count()) >= 1)
  await page.selectOption('.toolbar select', '')
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.page-actions a[download]').click()])
  const csvPath = await download.path()
  const csvBytes = csvPath ? readFileSync(csvPath) : Buffer.alloc(0)
  scan(`${tag} CSV download`, csvBytes)
  check(`${tag} CSV export downloads the file with the BOM`, /^dentora-licences-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()) && csvBytes[0] === 0xef && csvBytes.includes(DEVICE),
    download.suggestedFilename())

  // ---- PIN reset
  await page.goto(`${BASE}/admin#/reset`)
  await page.waitForSelector('input[name=device]')
  await page.click('input[name=device]')
  await page.keyboard.type('7kq4-m2xd')
  await page.fill('input[name=customer]', lang === 'ar' ? 'عيادة الابتسامة' : 'Smile Dental Clinic')
  await page.fill('input[name=phone]', '0944123456')
  await page.click('form button[type=submit]')
  await page.waitForSelector('.codebox')
  await page.waitForSelector('.mini-list .mini-row')
  const resetCode = (await page.locator('.codebox').first().textContent()).trim()
  check(`${tag} the PIN reset code passes the app's checkResetCode`, (await checkResetCode(DEVICE, resetCode)).ok)
  await shot('12-reset')

  // ---- verify
  await page.goto(`${BASE}/admin#/verify`)
  await page.waitForSelector('textarea[name=code]')
  await shot('13-verify-empty')
  await page.click('input[name=device]')
  await page.keyboard.type(DEVICE)
  await page.fill('textarea[name=code]', `Hello,\n${code}\nthanks`)
  await page.click('form button[type=submit]')
  await page.waitForSelector('.result-head')
  const vOk = await page.locator('.result-head h2').textContent()
  check(`${tag} verify: valid activation`, /صالح|Valid activation/.test(vOk), vOk)
  await shot('14-verify-ok')
  await page.fill('input[name=device]', '')
  await page.click('input[name=device]')
  await page.keyboard.type('2345ABCD')
  await page.click('form button[type=submit]')
  await page.waitForSelector('.result-ico--bad')
  await shot('15-verify-bad')
  await page.fill('input[name=device]', DEVICE)
  await page.fill('textarea[name=code]', resetCode)
  await page.click('form button[type=submit]')
  const resetOk = await page.waitForFunction(() => /إعادة تعيين صالح|Valid PIN reset/.test(document.querySelector('.result-head h2')?.textContent || ''), null, { timeout: 6000 }).then(() => true, () => false)
  check(`${tag} verify: valid PIN reset code`, resetOk)

  // ---- settings
  await page.goto(`${BASE}/admin#/settings`)
  await page.waitForSelector('input[name=whatsapp]')
  await shot('16-settings')
  await page.fill('input[name=whatsapp]', '12ab')
  await page.fill('input[name=windowsUrl]', 'http://example.com/setup.exe')
  await page.click('.save-bar button')
  const errs = await page.locator('.field .err:not([hidden])').count()
  check(`${tag} settings: the form refuses a bad WhatsApp number and an http URL`, errs === 2, `${errs} errors`)
  await shot('17-settings-errors')
  await page.fill('input[name=whatsapp]', '+963 996 489 504')
  await page.fill('input[name=windowsUrl]', 'https://downloads.raqeem.dev/Dentora-Setup-1.0.0.exe')
  await page.fill('input[name=email]', 'sales@raqeem.dev')
  await page.fill('textarea[name=announcementAr]', 'خصم 10% حتى نهاية الشهر')
  await page.fill('textarea[name=announcementEn]', '10% off until the end of the month')
  await page.click('.save-bar button')
  const sv = await page.locator('.toast p', { hasText: /حفظ الإعدادات|Settings saved/ }).textContent({ timeout: 6000 }).catch(() => '')
  check(`${tag} settings saved`, /حفظ الإعدادات|Settings saved/.test(sv), sv)
  const landing = await req('GET', '/en')
  check(`${tag} the saved announcement is on the landing page at once`, landing.text.includes('10% off until the end of the month'))
  probe = true
  const srv = await page.evaluate(async () => {
    const r = await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Dentora': '1' }, body: JSON.stringify({ email: 'nope' }) })
    return { status: r.status, body: await r.json() }
  })
  probe = false
  check(`${tag} the server checks settings too (400 field email)`, srv.status === 400 && srv.body.error === 'field' && srv.body.field === 'email', JSON.stringify(srv))
  await page.evaluate(async () => {
    await fetch('/api/settings', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Dentora': '1' }, body: JSON.stringify({ windowsUrl: '', email: '', announcementAr: '', announcementEn: '' }) })
  })
  await page.reload()
  await page.waitForSelector('input[name=whatsapp]')

  // ---- activity
  await page.goto(`${BASE}/admin#/activity`)
  await page.waitForSelector('.feed-item')
  await shot('18-activity')
  await page.selectOption('.act-tools select', 'auth')
  check(`${tag} activity filter (sign-in events)`, (await page.locator('.feed-item').count()) >= 4)
  await page.goto(`${BASE}/admin#/`)
  await page.waitForSelector('.kpis:not([aria-busy])')
  await shot('19-dashboard-after')
  if (sizeName === 'phone') {
    await page.click('[data-more]')
    await page.waitForSelector('dialog.menu-sheet[open]')
    await shot('20-menu', false)
    await page.keyboard.press('Escape')
  }

  // ---- language
  await page.goto(`${BASE}/admin#/licences`)
  await page.waitForSelector('.lic-row')
  const langBtn = () => (sizeName === 'phone' ? page.locator('.topbar .lang-btn') : page.locator('.sidebar .side-foot button').first())
  await langBtn().click()
  const other = lang === 'ar' ? 'en' : 'ar'
  await page.waitForFunction(o => document.documentElement.lang === o, other)
  await page.waitForSelector('.lic-row')
  await shot('21-licences-other-lang')
  check(`${tag} language switch is remembered`, (await page.evaluate(() => localStorage.getItem('dentora.admin.lang'))) === other)
  await page.reload()
  await page.waitForSelector('.lic-row')
  check(`${tag} language survives a reload`, await page.evaluate(o => document.documentElement.lang === o, other))
  await langBtn().click()
  await page.waitForFunction(l => document.documentElement.lang === l, lang)

  // ---- log out
  if (sizeName === 'phone') {
    await page.click('[data-more]')
    await page.waitForSelector('dialog.menu-sheet[open]')
    await page.click('dialog.menu-sheet .menu-item--bad')
  } else await page.locator('.sidebar .side-foot button').last().click()
  await page.waitForSelector('.login-card')
  await shot('22-logged-out')
  probe = true
  const me = await page.evaluate(async () => (await fetch('/api/me', { credentials: 'same-origin' })).status)
  await page.waitForTimeout(200)
  probe = false
  check(`${tag} logged out (GET /api/me → 401)`, me === 401, me)

  const writes = apiLog.filter(r => r.m !== 'GET')
  check(`${tag} every write sends X-Dentora: 1`, writes.length > 5 && writes.every(r => r.x === '1'), `${writes.length} writes`)
  const csp = await p.csp()
  check(`${tag} no CSP violations`, !csp.length, csp.join(' | '))
  const consoleIssues = p.console.filter(x => !/^error: Failed to load resource: the server responded with a status of 4\d\d/.test(x))
  check(`${tag} no console errors or warnings`, !consoleIssues.length, consoleIssues.join(' | '))
  // ERR_ABORTED = a request the test's own reload or navigation cancelled
  const failed = p.failed.filter(x => !/net::ERR_ABORTED/.test(x))
  check(`${tag} no 4xx/5xx or failed requests besides wrong passwords and the test's own probes`, !unexpected4xx.length && !failed.length, [...unexpected4xx, ...failed].join(' | '))
  await p.close()
}

/** Answers the real server gives only with other secrets or after many failures, produced by intercepting them. */
async function panelMocked(browser, lang, sizeName) {
  const size = SIZES[sizeName]
  const tag = `panel ${lang} ${sizeName} (intercepted)`
  const dir = shotDir('admin')
  const p = await newPage(browser, { width: size.width, height: size.height, dsf: size.dsf, mobile: size.mobile, lang })
  const { page } = p
  const ov = async name => { const o = await overflowOf(page); check(`${tag} ${name}: no horizontal overflow`, o.sw <= o.cw, `${o.sw}/${o.cw}`) }
  await page.route('**/api/login', r => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'locked', retryAfter: 754 }) }))
  await page.goto(`${BASE}/admin`)
  await page.waitForSelector('.login-card')
  await page.fill('#login-pw', 'whatever-it-is')
  await page.click('.login-form button[type=submit]')
  await page.waitForSelector('.lock-time')
  const t1 = await page.locator('.lock-time').textContent()
  await page.waitForTimeout(1200)
  const t2 = await page.locator('.lock-time').textContent()
  check(`${tag} lock countdown ticks, submit disabled`, t1 !== t2 && /^\d+:\d\d$/.test(t2) && (await page.locator('.login-form button[type=submit]').isDisabled()), `${t1} → ${t2}`)
  await page.screenshot({ path: join(dir, `${lang}-${sizeName}-m1-login-locked.png`), fullPage: true })
  await ov('locked')
  await page.unroute('**/api/login')
  await page.reload()
  await page.fill('#login-pw', PASSWORD)
  await page.click('.login-form button[type=submit]')
  await page.waitForSelector('.kpis')
  // Signed in (the panel remembers it), then the server cannot be reached: a retry screen, not the sign-in form.
  await page.route('**/api/me', r => r.abort())
  await page.reload()
  const offline = await page.waitForSelector('.login-card .btn-primary', { timeout: 8000 }).then(async () => (await page.locator('#login-pw').count()) === 0, () => false)
  await page.screenshot({ path: join(dir, `${lang}-${sizeName}-m6-offline.png`), fullPage: true })
  check(`${tag} server unreachable on load → retry screen (no sign-in form)`, offline)
  await page.unroute('**/api/me')
  await page.click('.login-card .btn-primary')
  const back = await page.waitForSelector('.kpis:not([aria-busy])', { timeout: 8000 }).then(() => true, () => false)
  check(`${tag} retry once the server answers → dashboard`, back)
  await page.route('**/api/stats', r => r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'auth' }) }))
  await page.reload()
  const expired = await page.waitForSelector('.login-card .callout--info', { timeout: 8000 }).then(async () => (await page.locator('#login-pw').count()) === 1, () => false)
  await page.screenshot({ path: join(dir, `${lang}-${sizeName}-m5-session-expired.png`), fullPage: true })
  check(`${tag} a 401 mid-session returns to sign-in with a notice`, expired)
  await page.unroute('**/api/stats')
  const issues = p.console.filter(s => !/Failed to load resource|net::ERR_FAILED/.test(s))
  check(`${tag} no console errors (besides the intercepted failures), no CSP violations`, !issues.length && !(await p.csp()).length, issues.join(' | '))
  await p.close()
}

/** Every page of the panel at 360 px, the narrowest phone the site supports. */
async function panelNarrow(browser) {
  const dir = shotDir('admin')
  for (const lang of ['ar', 'en']) {
    const p = await newPage(browser, { width: 360, height: 740, dsf: 2, mobile: true, lang })
    const { page } = p
    await page.goto(`${BASE}/admin`)
    await page.fill('#login-pw', PASSWORD)
    await page.click('.login-form button[type=submit]')
    await page.waitForSelector('.kpis:not([aria-busy])')
    const wide = []
    for (const r of ['', 'new', 'licences', 'reset', 'verify', 'settings', 'activity']) {
      await page.goto(`${BASE}/admin#/${r}`)
      await page.waitForTimeout(600)
      const o = await overflowOf(page)
      if (o.sw > o.cw) wide.push(`${r || 'dashboard'} ${o.sw}`)
      // the top 6000 px at most: the activity log grows with the run, and a picture tens of thousands of pixels tall
      // can bring the headless browser down
      const hgt = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.screenshot({ path: join(dir, `${lang}-360-${r || 'dashboard'}.png`), fullPage: true, clip: { x: 0, y: 0, width: 360, height: Math.min(hgt, 6000) } })
    }
    await page.goto(`${BASE}/admin#/licences`)
    await page.waitForSelector('.lic-row')
    await page.locator('.lic-row').first().click()
    await page.waitForSelector('dialog.sheet .codebox')
    const s = await page.evaluate(() => { const d = document.querySelector('dialog.sheet .sheet-body'); return { sw: d.scrollWidth, cw: d.clientWidth } })
    if (s.sw > s.cw) wide.push(`licence panel ${s.sw}`)
    await page.screenshot({ path: join(dir, `${lang}-360-licence.png`) })
    const csp = await p.csp()
    check(`panel ${lang} at 360px: all 7 pages and the licence panel fit, no console or CSP errors`, !wide.length && !p.console.length && !csp.length, [...wide, ...p.console, ...csp].join(' | '))
    await p.close()
  }
}

// ==== licence keys (docs/LICENCE-KEYS.md) ==========================================================================
const KEY_RE = /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/
const CODE_RE = /^[\dA-Z]{4}(-[\dA-Z]{4}){27}$/
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const randomChars = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ALPHABET[b % 32]).join('')
/** A key in the right shape that was never issued (80 random bits: it cannot be one of the Worker's). */
const randomKey = () => [4, 4, 4, 4].map(randomChars).join('-')
const randomDevice = () => `${randomChars(4)}-${randomChars(4)}`
const arabicDigits = s => s.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
/**
 * POST /api/activate as the app or another site's page sends it: no session, no X-Dentora, its own Origin
 * (`origin: 'null'` as the Windows app's file:// page, null for none). `raw` sends a body as it is.
 */
function activateReq(body, { base = BASE, ip = '198.51.100.30', origin = 'https://clinic.example', cookie, raw } = {}) {
  return raw === undefined
    ? req('POST', '/api/activate', { base, ip, origin, cookie, csrf: false, body })
    : req('POST', '/api/activate', { base, ip, origin, cookie, csrf: false, raw, headers: { 'Content-Type': 'application/json' } })
}
const cors = r => r.headers.get('access-control-allow-origin') === '*'

/** Selling keys through the API, then the public activation: answers, CORS, cookies, audit, and its limit. */
async function keysApi(mainWorker) {
  const { cookie } = await login()
  const priceNow = (await req('GET', '/api/settings', { cookie })).json.priceUsd
  const statsOf = async () => (await req('GET', '/api/stats', { cookie })).json.licences
  const before = await statsOf()

  section('licence keys: issuing (POST /api/keys)')
  const invalid = []
  for (const [bad, code, field] of [
    [{ count: 0 }, 'count'], [{ count: 51 }, 'count'], [{ count: 1.5 }, 'count'], [{ count: 'three' }, 'count'], [{ count: -2 }, 'count'],
    [{ plan: 'gold' }, 'plan'], [{ validity: '3y' }, 'validity'], [{ validity: 'date', until: '2020-01-01' }, 'until'], [{ validity: 'date' }, 'until'],
    [{ price: -1 }, 'price'], [{ customer: 'x'.repeat(201) }, 'field', 'customer'], [{ note: 7 }, 'field', 'note'],
  ]) {
    const r = await req('POST', '/api/keys', { cookie, body: { plan: 'pro', validity: 'lifetime', ...bad } })
    if (r.status !== 400 || r.json?.error !== code || (field && r.json.field !== field)) invalid.push(`${JSON.stringify(bad).slice(0, 40)} → ${r.status} ${r.text}`)
  }
  let r = await req('POST', '/api/keys', { cookie, raw: '[1]', headers: { 'Content-Type': 'application/json' } })
  if (r.status !== 400 || r.json?.field !== 'body') invalid.push(`array body → ${r.status} ${r.text}`)
  check('POST /api/keys validation: 400 count (0, 51, 1.5, text, negative) | plan | validity | until | price | field (+field), body', !invalid.length, invalid.join(' | '))
  r = await req('POST', '/api/keys', { cookie, body: { plan: 'pro', validity: 'lifetime' }, csrf: false })
  const foreign = await req('POST', '/api/keys', { cookie, body: { plan: 'pro', validity: 'lifetime' }, origin: 'https://evil.example' })
  check('POST /api/keys without X-Dentora, or from a foreign Origin → 403 origin, nothing made', r.status === 403 && foreign.status === 403 && foreign.json?.error === 'origin'
    && (await statsOf()).total === before.total)

  const sale = { plan: 'pro', validity: 'lifetime', customer: 'د. هالة الشامي', clinic: 'عيادة الشفاء', phone: '0944 765 432', note: 'دفع نقداً' }
  r = await req('POST', '/api/keys', { cookie, body: sale })
  const K1 = r.json?.items?.[0]?.licence, m1 = r.json?.items?.[0]?.message
  check(`one key (no count) → 201 {items:[{licence, message}]}: XXXX-XXXX-XXXX-XXXX, waiting (device and code ''), pro, lifetime, $${priceNow} from the settings`,
    r.status === 201 && r.json.items.length === 1 && KEY_RE.test(K1?.key || '') && K1.device === '' && K1.code === '' && K1.plan === 'pro' && K1.validity === 'lifetime'
    && K1.until === null && K1.activatedAt === null && K1.status === 'active' && K1.price === priceNow, `${r.status} ${JSON.stringify(K1 && { ...K1, key: KEY_RE.test(K1.key) })}`)
  check('its message: the key, Settings → Licence, the activation page (/activate in Arabic, /en/activate in English), wa.me to the customer',
    !!m1 && m1.ar.includes(K1.key) && m1.ar.includes('الإعدادات ← الترخيص') && m1.ar.includes(`${ORIGIN}/activate`) && m1.en.includes(K1.key)
    && m1.en.includes('Settings → Licence') && m1.en.includes(`${ORIGIN}/en/activate`) && /^https:\/\/wa\.me\/963944765432\?text=/.test(m1.whatsappUrl), m1?.whatsappUrl?.slice(0, 40))
  r = await req('POST', '/api/keys', { cookie, body: { count: 3, plan: 'standard', validity: '1y', customer: 'Homs reseller', price: 40 } })
  const batch = (r.json?.items || []).map(x => x.licence)
  check('a batch of 3 (standard, 1 year, $40 each) → 3 different keys, waiting, no last day yet (it counts from activation), no wa.me without a phone',
    r.status === 201 && batch.length === 3 && new Set(batch.map(l => l.key)).size === 3
    && batch.every(l => KEY_RE.test(l.key) && l.plan === 'standard' && l.validity === '1y' && l.until === null && l.price === 40 && l.device === '')
    && r.json.items.every(x => x.message.whatsappUrl === null && x.message.ar.includes(x.licence.key)), `${r.status} ${batch.length}`)
  r = await req('POST', '/api/keys', { cookie, body: { count: '2', plan: 'pro', validity: 'date', until: '2031-12-31', customer: 'Dr. Lina Haddad', price: '45.5' } })
  const dated = (r.json?.items || []).map(x => x.licence)
  check('2 dated keys (count and price as text) → until 2031-12-31 already, $45.5 each', r.status === 201 && dated.length === 2
    && dated.every(l => l.until === '2031-12-31' && l.validity === 'date' && l.price === 45.5), `${r.status}`)
  r = await req('POST', '/api/keys', { cookie, body: { plan: 'pro', validity: '2y', clinic: 'Two-year clinic' } })
  const K2y = r.json?.items?.[0]?.licence
  check('a 2-year key → 201, no last day yet', r.status === 201 && K2y?.validity === '2y' && K2y.until === null)
  const keys = [K1, ...batch, ...dated, K2y]

  section('licence keys: list, search, verify, stats, CSV, audit while they wait')
  r = await req('GET', '/api/licences?status=pending&limit=200', { cookie })
  check(`?status=pending → the ${keys.length} keys among ${before.pending + keys.length}, every one a waiting active key`, r.json?.total === before.pending + keys.length
    && keys.every(k => r.json.items.some(i => i.id === k.id)) && r.json.items.every(i => i.key && i.device === '' && i.status === 'active'), `${r.json?.total}`)
  const search = async q => (await req('GET', `/api/licences?q=${encodeURIComponent(q)}`, { cookie })).json
  const s1 = await search(batch[1].key.replace(/-/g, '').toLowerCase()), s2 = await search(batch[1].key.slice(5, 14))
  check('search finds a key without its dashes in lower case, and by a part with a dash', s1.total === 1 && s1.items[0].id === batch[1].id && s2.total === 1 && s2.items[0].id === batch[1].id,
    `${s1.total} ${s2.total}`)
  r = await req('GET', `/api/licences/${K1.id}`, { cookie })
  check('GET /api/licences/:id of a waiting key → its key message', r.status === 200 && r.json.licence.key === K1.key && r.json.licence.code === '' && r.json.message.ar.includes(K1.key))
  let st = await statsOf()
  const sold = priceNow + 3 * 40 + 2 * 45.5 + priceNow
  check(`stats: pending +${keys.length}, total +${keys.length}, revenue +$${sold}`, st.pending === before.pending + keys.length && st.total === before.total + keys.length
    && Math.abs(st.revenue - before.revenue - sold) < 0.001, JSON.stringify({ before, now: st }))
  const verify = async code => (await req('POST', '/api/verify', { cookie, body: { code, device: '' } })).json
  let v = await verify(K1.key.toLowerCase().replace(/-/g, ' '))
  check('verify a waiting key (lower case, spaces, no device) → kind key, ok, pending, pro, lifetime', v?.kind === 'key' && v.ok === true && v.status === 'pending' && v.plan === 'pro'
    && v.validity === 'lifetime' && v.until === null && !('device' in v), JSON.stringify(v))
  v = await verify(batch[0].key)
  check('verify a waiting 1-year key → pending, validity 1y, no last day', v?.status === 'pending' && v.validity === '1y' && !('until' in v), JSON.stringify(v))
  v = await verify(dated[0].key)
  check('verify a waiting dated key → pending, until 2031-12-31', v?.status === 'pending' && v.ok && v.until === '2031-12-31', JSON.stringify(v))
  v = await verify(randomKey())
  check('verify a key never issued → kind key, unknown, not ok', v?.kind === 'key' && v.status === 'unknown' && v.ok === false, JSON.stringify(v))
  r = await req('GET', '/api/licences.csv', { cookie })
  const { rows } = parseCsv(r.buf.subarray(3).toString('utf8'))
  const head = rows[0] || [], col = name => head.indexOf(name), row = id => rows.find(x => x[col('id')] === id) || []
  check('CSV: key, validity, activated_at as the last three columns', head.slice(-3).join() === 'key,validity,activated_at', head.join())
  check('CSV: a waiting key: no device, its key and rule; valid_until lifetime, empty for 1 year (set on activation), or its day',
    row(K1.id)[col('key')] === K1.key && row(K1.id)[col('device')] === '' && row(K1.id)[col('valid_until')] === 'lifetime' && row(K1.id)[col('activated_at')] === ''
    && row(batch[0].id)[col('valid_until')] === '' && row(batch[0].id)[col('validity')] === '1y' && row(dated[0].id)[col('valid_until')] === '2031-12-31',
    JSON.stringify([row(K1.id)[col('valid_until')], row(batch[0].id)[col('valid_until')], row(dated[0].id)[col('valid_until')]]))

  section('licence keys: public activation (POST /api/activate)')
  const DEV_K = 'H7KQ-2MXD', DEV_K2 = 'P3RT-9WZC'
  r = await req('OPTIONS', '/api/activate', { csrf: false, origin: 'https://clinic.example', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })
  check('CORS preflight from another site → 204: Allow-Origin *, Allow-Methods "POST, OPTIONS", Allow-Headers Content-Type, Max-Age 86400, no-store, no cookie',
    r.status === 204 && r.buf.length === 0 && cors(r) && r.headers.get('access-control-allow-methods') === 'POST, OPTIONS' && r.headers.get('access-control-allow-headers') === 'Content-Type'
    && r.headers.get('access-control-max-age') === '86400' && r.headers.get('cache-control') === 'no-store' && !r.headers.get('set-cookie'),
    [...r.headers].filter(([k]) => /^access-control|^cache|^set-cookie/.test(k)).map(([k, x]) => `${k}: ${x}`).join(' | '))
  r = await activateReq({ key: K1.key, device: DEV_K }, { cookie })
  const act1 = r.json
  check('a lifetime key from another site (no X-Dentora, foreign Origin, the panel\'s session cookie sent along) → 200 {code, device, plan, until}',
    r.status === 200 && CODE_RE.test(act1?.code || '') && act1.device === DEV_K && act1.plan === 'pro' && act1.until === null && JSON.stringify(Object.keys(act1).sort()) === '["code","device","plan","until"]',
    `${r.status} ${r.text.slice(0, 80)}`)
  check('…with Access-Control-Allow-Origin: *, JSON, no-store, and no Set-Cookie', cors(r) && r.headers.get('content-type') === 'application/json; charset=utf-8'
    && r.headers.get('cache-control') === 'no-store' && !r.headers.get('set-cookie'))
  let c = await checkCode(DEV_K, act1?.code || '')
  check(`…the code passes the app's own checkCode (src/license/core.ts, the app's public key) for ${DEV_K}: pro, lifetime`, c.ok && c.plan === 'pro' && c.until === null, JSON.stringify(c))
  c = await checkCode(DEV_K2, act1?.code || '')
  check('…and is refused for any other device (reason "device")', !c.ok && c.reason === 'device', JSON.stringify(c))
  const again = []
  for (const [what, key, device, origin] of [
    ['the same key and device', K1.key, DEV_K, 'https://clinic.example'],
    ['lower case without dashes, the device too', K1.key.toLowerCase().replace(/-/g, ''), DEV_K.toLowerCase().replace('-', ''), 'https://clinic.example'],
    ['spaces and Arabic-Indic digits', arabicDigits(K1.key.replace(/-/g, ' ')), arabicDigits(DEV_K), 'https://clinic.example'],
    ['from the Windows app (Origin: null)', K1.key, DEV_K, 'null'],
    ['with no Origin', K1.key, DEV_K, null],
  ]) {
    const x = await activateReq({ key, device }, { origin })
    if (x.status !== 200 || x.json?.code !== act1?.code || !cors(x)) again.push(`${what}: ${x.status} ${x.text.slice(0, 60)}`)
  }
  check('the same device again (a reinstall): the same code, however the key and the number are typed, from any origin', !again.length, again.join(' | '))
  r = await activateReq({ key: K1.key, device: DEV_K2 }, { ip: '198.51.100.31' })
  check('another device → 409 used (with CORS)', r.status === 409 && r.json?.error === 'used' && cors(r), `${r.status} ${r.text}`)
  r = await req('GET', `/api/licences/${K1.id}`, { cookie })
  const bound = r.json?.licence
  check('the sale now holds the device, the code and the activation time; its message is the code\'s', bound?.device === DEV_K && bound.code === act1?.code && bound.until === null
    && Math.abs(Date.now() - Date.parse(bound.activatedAt)) < 600_000 && r.json.message.ar.includes(act1.code), JSON.stringify({ device: bound?.device, activatedAt: bound?.activatedAt }))
  v = await verify(K1.key)
  check('verify → activated, ok, on that device, at that time', v?.status === 'activated' && v.ok && v.device === DEV_K && v.activatedAt === bound?.activatedAt, JSON.stringify(v))

  const terms = []
  for (const [l, device, until] of [[batch[0], 'Q8WE-R4TY', plusYears(1)], [K2y, 'Z5XC-V7BN', plusYears(2)], [dated[0], 'M2NB-V3CX', '2031-12-31']]) {
    const x = await activateReq({ key: l.key, device })
    const cc = await checkCode(device, x.json?.code || '')
    if (x.status !== 200 || x.json.until !== until || x.json.plan !== l.plan || !cc.ok || cc.plan !== l.plan || isoDay(cc.until) !== until) terms.push(`${l.validity}: ${x.status} ${x.json?.until} ${JSON.stringify(cc)}`)
  }
  check(`1 year → until ${plusYears(1)}, 2 years → ${plusYears(2)} (counted from the activation day), a dated key → its day; checkCode agrees`, !terms.length, terms.join(' | '))

  await req('PATCH', `/api/licences/${batch[1].id}`, { cookie, body: { status: 'void' } })
  await req('PATCH', `/api/licences/${batch[2].id}`, { cookie, body: { status: 'refunded' } })
  const voided = await activateReq({ key: batch[1].key, device: 'J4KL-5MNP' }, { ip: '198.51.100.32' })
  const refunded = await activateReq({ key: batch[2].key, device: 'J4KL-5MNP' }, { ip: '198.51.100.32' })
  check('a waiting key the seller voided, or refunded → 410 void', voided.status === 410 && voided.json?.error === 'void' && refunded.status === 410 && refunded.json?.error === 'void' && cors(voided),
    `${voided.status} ${voided.text} | ${refunded.status} ${refunded.text}`)
  v = await verify(batch[1].key)
  check('…verify says void, and the key is bound to no device', v?.status === 'void' && !v.ok && !('device' in v), JSON.stringify(v))
  await req('PATCH', `/api/licences/${batch[2].id}`, { cookie, body: { status: 'active' } })
  r = await activateReq({ key: batch[2].key, device: 'J4KL-5MNP' }, { ip: '198.51.100.32' })
  check('…set back to active, the refunded key activates (200)', r.status === 200 && (await checkCode('J4KL-5MNP', r.json?.code || '')).ok, `${r.status}`)
  await req('PATCH', `/api/licences/${K1.id}`, { cookie, body: { status: 'void' } })
  const own = await activateReq({ key: K1.key, device: DEV_K }), other = await activateReq({ key: K1.key, device: DEV_K2 }, { ip: '198.51.100.31' })
  check('a key voided after activation: its own device still gets its code (it works offline anyway), another device 409 used',
    own.status === 200 && own.json?.code === act1?.code && other.status === 409, `${own.status} ${other.status}`)
  await req('PATCH', `/api/licences/${K1.id}`, { cookie, body: { status: 'active' } })

  const wrong = []
  for (const [what, body, status, error] of [
    ['a key never issued', { key: randomKey(), device: DEV_K }, 404, 'unknown'],
    ['a key of 15 characters', { key: K2y.key.slice(0, -1), device: DEV_K }, 400, 'key'],
    ['a key with O and 1', { key: 'O1O1-O1O1-O1O1-O1O1', device: DEV_K }, 400, 'key'],
    ['no key', { device: DEV_K }, 400, 'key'],
    ['a device number of 7 characters', { key: K2y.key, device: 'Z5XC-V7B' }, 400, 'device'],
    ['no device number', { key: K2y.key }, 400, 'device'],
  ]) {
    const x = await activateReq(body, { ip: '198.51.100.33' })
    if (x.status !== status || x.json?.error !== error || !cors(x)) wrong.push(`${what}: ${x.status} ${x.text}`)
  }
  r = await activateReq(null, { ip: '198.51.100.33', raw: 'not json' })
  if (r.status !== 400 || r.json?.error !== 'field' || r.json.field !== 'body' || !cors(r)) wrong.push(`not JSON: ${r.status} ${r.text}`)
  for (const m of ['GET', 'PUT', 'DELETE']) {
    const x = await req(m, '/api/activate', { csrf: false, origin: 'https://clinic.example', ip: '198.51.100.33' })
    if (x.status !== 404 || x.json?.error !== 'not_found' || !cors(x)) wrong.push(`${m}: ${x.status} ${x.text}`)
  }
  check('errors, each with CORS: 404 unknown, 400 key (short, O/1, missing), 400 device (short, missing), 400 field body; GET/PUT/DELETE → 404 not_found', !wrong.length, wrong.join(' | '))
  const noCors = []
  for (const [m, path, o] of [
    ['GET', '/api/me', {}], ['GET', '/api/me', { cookie }], ['POST', '/api/login', { body: { password: 'x' }, origin: 'https://clinic.example' }],
    ['OPTIONS', '/api/licences', { csrf: false, origin: 'https://clinic.example', headers: { 'Access-Control-Request-Method': 'GET' } }],
    ['GET', '/api/licences', { cookie, origin: 'https://clinic.example' }], ['GET', '/activate', {}], ['GET', '/', {}],
  ]) {
    const x = await req(m, path, o)
    if ([...x.headers.keys()].some(k => k.startsWith('access-control-'))) noCors.push(`${m} ${path} ${x.status}`)
  }
  check('no other route answers with CORS headers (/api/me, /api/login, a preflight of /api/licences, the pages)', !noCors.length, noCors.join(' | '))

  const audit = (await req('GET', '/api/audit?limit=500', { cookie })).json.items
  const made = audit.filter(i => i.action === 'keys.create'), activated = audit.filter(i => i.action === 'key.activate'), used = audit.filter(i => i.action === 'key.used')
  check('audit: keys.create per sale ("3 × standard 1y · $40 · Homs reseller"), with the seller\'s address', made.some(i => i.detail === '3 × standard 1y · $40 · Homs reseller' && i.ip === IP)
    && made.some(i => i.detail === '2 × pro 2031-12-31 · $45.5 · Dr. Lina Haddad') && made.some(i => i.detail === `1 × pro lifetime · $${priceNow} · عيادة الشفاء`), made.map(i => i.detail).join(' | '))
  check('audit: key.activate "…<last 4> · <device>" once per key (a repeat by the same device is not logged), with no address',
    activated.filter(i => i.detail === `…${K1.key.slice(-4)} · ${DEV_K}`).length === 1 && activated.some(i => i.detail === `…${batch[0].key.slice(-4)} · Q8WE-R4TY`) && activated.every(i => i.ip === ''),
    activated.map(i => `${i.detail} [${i.ip}]`).join(' | '))
  check('audit: key.used names the key\'s own device, never the device that tried, and no address', used.length >= 2 && used.every(i => i.ip === '' && !i.detail.includes(DEV_K2))
    && used.some(i => i.detail === `…${K1.key.slice(-4)} · ${DEV_K}`), used.map(i => i.detail).join(' | '))
  check('audit: a waiting key is named by its last 4 characters ("…XXXX · status: active → void")', audit.some(i => i.action === 'licence.update' && i.detail === `…${batch[1].key.slice(-4)} · status: active → void`))
  check('audit: no entry holds a whole key', !audit.some(i => keys.some(k => i.detail.includes(k.key) || i.detail.includes(k.key.replace(/-/g, '')))))
  st = await statsOf()
  check('stats: pending counts the active keys still waiting (5 activated, 1 void)', st.pending === before.pending + keys.length - 6, JSON.stringify(st))

  section('licence keys: the activation limit (10 failures per address in 15 minutes)')
  const RL = '203.0.113.80'
  const statuses = []
  let last
  for (let i = 0; i < 11; i++) { last = await activateReq({ key: randomKey(), device: DEV_K }, { ip: RL }); statuses.push(last.status) }
  check('11 unknown keys from one address → 404 ×10, then 429 locked with retryAfter (seconds, at most 15 minutes), with CORS',
    statuses.join() === '404,404,404,404,404,404,404,404,404,404,429' && last.json?.error === 'locked' && last.json.retryAfter > 850 && last.json.retryAfter <= 900 && cors(last),
    `${statuses.join()} ${JSON.stringify(last.json)}`)
  r = await activateReq({ key: dated[1].key, device: 'N6MP-Q2RS' }, { ip: RL })
  v = await verify(dated[1].key)
  check('…a real key from that address is refused before it is looked up (429), and stays waiting', r.status === 429 && v?.status === 'pending', `${r.status} ${v?.status}`)
  r = await activateReq({ key: dated[1].key, device: 'N6MP-Q2RS' }, { ip: '203.0.113.81' })
  check('…another address activates it (200)', r.status === 200)
  const burst = await Promise.all(Array.from({ length: 30 }, () => activateReq({ key: randomKey(), device: DEV_K }, { ip: '203.0.113.82' })))
  const n = {}
  for (const x of burst) n[x.status] = (n[x.status] || 0) + 1
  check('30 guesses at once from one address → exactly 10 looked up (404), 20 refused (429)', n[404] === 10 && n[429] === 20, JSON.stringify(n))
  const OK_IP = '203.0.113.83', oks = []
  for (let i = 0; i < 12; i++) oks.push((await activateReq({ key: K1.key, device: DEV_K }, { ip: OK_IP })).status)
  for (let i = 0; i < 12; i++) oks.push((await activateReq(null, { ip: OK_IP, raw: '{oops' })).status)
  r = await activateReq({ key: randomKey(), device: DEV_K }, { ip: OK_IP })
  check('12 successes and 12 broken bodies from one address are not counted: its next failure is still a 404', oks.slice(0, 12).every(x => x === 200) && oks.slice(12).every(x => x === 400) && r.status === 404,
    `${[...new Set(oks)].join()} → ${r.status}`)
  for (let i = 1; i <= 10; i++) await activateReq({ key: randomKey(), device: DEV_K }, { ip: `2001:db8:aa:1::${i}` })
  const v6a = await activateReq({ key: randomKey(), device: DEV_K }, { ip: '2001:db8:aa:1:ffff::9' }), v6b = await activateReq({ key: randomKey(), device: DEV_K }, { ip: '2001:db8:aa:2::1' })
  check('IPv6: 10 failures across one /64 lock the whole /64 (429); the next /64 is not locked (404)', v6a.status === 429 && v6b.status === 404, `${v6a.status} ${v6b.status}`)
  const attempts = await queryD1(mainWorker.persist, 'SELECT * FROM activation_attempts')
  const columns = attempts?.length ? Object.keys(attempts[0]).sort().join() : ''
  const per = ip => (attempts || []).filter(a => a.ip === ip).length
  check('D1 activation_attempts: only id, ip (IPv6 as its /64) and time; the failures alone (10 per locked address, 1 after the successes)',
    columns === 'at,id,ip' && per(RL) === 10 && per('203.0.113.82') === 10 && per(OK_IP) === 1 && per('2001:db8:aa:1::/64') === 10 && per('203.0.113.81') === 0,
    `${columns} ${RL}:${per(RL)} ok:${per(OK_IP)} v6:${per('2001:db8:aa:1::/64')}`)
  return { cookie }
}

/** The landing page's links to the activation page and the legal pages' footer link. */
async function keyLinks() {
  section('licence keys: links to the activation page')
  for (const [path, base] of [['/', ''], ['/en', '/en']]) {
    const r = await req('GET', path)
    const n = (r.text.match(new RegExp(`href="${base}/activate"`, 'g')) || []).length
    check(`${path}: links to ${base}/activate from step 3, the FAQ and the footer`, r.text.includes(`class="step-link" href="${base}/activate"`) && n >= 3, `${n} links`)
  }
  for (const path of ['/privacy', '/en/terms', '/no-such-page']) {
    const r = await req('GET', path)
    const base = path.startsWith('/en') ? '/en' : ''
    check(`${path}: the footer links to ${base}/activate`, r.text.includes(`<a href="${base}/activate">`))
  }
  for (const [path, lang] of [['/activate', 'ar'], ['/en/activate', 'en'], ['/activate?device=h7kq2mxd', 'ar']]) {
    const r = await req('GET', path)
    check(`GET ${path} → 200 HTML, Content-Language ${lang}, PUBLIC_CSP, security headers, cacheable 5 minutes, no inline style or script`,
      r.status === 200 && r.headers.get('content-language') === lang && r.headers.get('content-security-policy') === PUBLIC_CSP && !missingSecurity(r.headers, path).length
      && r.headers.get('cache-control') === 'public, max-age=300' && !/\sstyle="|<style|\son[a-z]+=/i.test(r.text)
      && (r.text.match(/<script\b[^>]*>/g) || []).join() === '<script src="/js/activate.js" defer>,<script type="application/json" id="act-text">', `${r.status}`)
  }
  let r = await req('GET', '/activate?device=h7kq2mxd')
  const r2 = await req('GET', `/en/activate?device=${encodeURIComponent('"><script>alert(1)</script>')}`)
  check('?device= fills in a valid device number (formatted), and nothing else', r.text.includes('value="H7KQ-2MXD"') && r2.text.includes('id="act-device" name="device" type="text" dir="ltr" value=""') && !r2.text.includes('<script>alert'))
  for (const path of ['/js/activate.js', '/css/activate.css']) {
    r = await req('GET', path)
    check(`GET ${path} → 200, cached 10 minutes, security headers`, r.status === 200 && r.headers.get('cache-control') === 'public, max-age=600' && !missingSecurity(r.headers).length, `${r.status} ${r.headers.get('content-type')}`)
  }
  r = await req('GET', '/robots.txt')
  check('robots.txt does not block /activate', !/^Disallow: \/(en\/)?activate/m.test(r.text))
}

const ACT_WORDS = {
  ar: { done: 'رمز التفعيل جاهز', keyErr: 'المفتاح غير مكتمل', used: 'مُفعَّل على جهاز آخر', unknown: 'لم نجد هذا المفتاح', void: 'مُلغى أو استُرِدّ ثمنه',
    plans: { pro: 'الباقة الاحترافية', standard: 'الباقة الأساسية' }, lifetime: 'ترخيص دائم', until: 'صالح حتى' },
  en: { done: 'Your activation code is ready', keyErr: 'incomplete or has a typo', used: 'already activated on another device', unknown: 'could not find this key', void: 'cancelled or refunded',
    plans: { pro: 'Pro plan', standard: 'Standard plan' }, lifetime: 'Lifetime licence', until: 'Valid until' },
}
/** Signs in to the panel in this page's browser (its session cookie then sits in the same cookie store). */
async function panelLogin(page) {
  await page.goto(`${BASE}/admin`)
  await page.waitForSelector('.login-card')
  await page.fill('#login-pw', PASSWORD)
  await page.click('.login-form button[type=submit]')
  await page.waitForSelector('.kpis:not([aria-busy])')
}

/**
 * The public activation page as a clinic uses it, at one size: the device number from ?device=, a key typed loosely,
 * the code checked with the app's own checkCode, copy, the same key again, then a used, an unknown and a voided key.
 */
async function activationPage(browser, cookie, lang, sizeName, ip) {
  const size = SIZES[sizeName], w = ACT_WORDS[lang], tag = `/activate ${lang} ${sizeName}`
  const plan = lang === 'ar' ? 'pro' : 'standard', validity = lang === 'ar' ? 'lifetime' : '1y'
  const made = (await req('POST', '/api/keys', { cookie, body: { count: 2, plan, validity, clinic: `Activation page ${lang} ${sizeName}` } })).json.items.map(x => x.licence)
  const [good, gone] = made
  await req('PATCH', `/api/licences/${gone.id}`, { cookie, body: { status: 'void' } })
  const device = randomDevice(), otherDevice = randomDevice()
  const p = await newPage(browser, { width: size.width, height: size.height, dsf: size.dsf, mobile: size.mobile, lang })
  const { page, ctx } = p
  await ctx.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip })
  const dir = shotDir('activate')
  const shot = async name => {
    // from the top: a full-page picture of a scrolled page draws the sticky header halfway down
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(150)
    await page.screenshot({ path: join(dir, `${lang}-${sizeName}-${name}.png`), fullPage: true })
    const o = await overflowOf(page)
    check(`${tag} ${name}: no horizontal overflow`, o.sw <= o.cw, `${o.sw}/${o.cw}px`)
  }
  await panelLogin(page)
  const hasSession = (await ctx.cookies()).some(x => x.name === COOKIE)
  const sent = [], answered = []
  page.on('request', rq => { if (rq.url().endsWith('/api/activate')) sent.push(rq) })
  page.on('response', rs => { if (rs.url().endsWith('/api/activate')) answered.push(rs) })
  const path = lang === 'ar' ? '/activate' : '/en/activate'
  const res = await page.goto(`${BASE}${path}?device=${device.toLowerCase().replace('-', '')}`, { waitUntil: 'networkidle' })
  const d = await page.evaluate(() => ({
    lang: document.documentElement.lang, dir: document.documentElement.dir, h1: document.querySelectorAll('h1').length,
    device: document.querySelector('#act-device')?.value, title: document.title, script: !!document.querySelector('script[src="/js/activate.js"]'),
  }))
  check(`${tag}: 200 with PUBLIC_CSP, lang/dir, one h1, the device number from ?device= (formatted)`, res.status() === 200 && res.headers()['content-security-policy'] === PUBLIC_CSP
    && d.lang === lang && d.dir === (lang === 'ar' ? 'rtl' : 'ltr') && d.h1 === 1 && d.device === device && d.script, JSON.stringify(d))
  await shot('1-form')

  await page.fill('#act-key', good.key.slice(0, 17))
  await page.click('.act-submit')
  const keyErr = await page.locator('#act-key-err:not([hidden])').textContent({ timeout: 4000 }).catch(() => '')
  check(`${tag}: a short key → its sentence under the field, focus there, nothing sent`, keyErr.includes(w.keyErr) && sent.length === 0
    && await page.evaluate(() => document.activeElement?.id === 'act-key' && document.querySelector('#act-key').getAttribute('aria-invalid') === 'true'), keyErr)
  await shot('2-key-error')

  await page.fill('#act-key', good.key.toLowerCase().replace(/-/g, ' '))
  await page.click('.act-submit')
  await page.waitForSelector('#act-done:not([hidden])', { timeout: 20_000 })
  const code = (await page.locator('#act-code').textContent()).replace(/\s+/g, '')
  const verdict = await checkCode(device, code)
  const lastDay = validity === '1y' ? plusYears(1) : null
  check(`${tag}: the code shown passes the app's checkCode for ${device} (${plan}, ${validity})`, CODE_RE.test(code) && verdict.ok && verdict.plan === plan
    && (lastDay ? isoDay(verdict.until) === lastDay : verdict.until === null), JSON.stringify(verdict))
  const facts = await page.evaluate(() => ({ plan: document.querySelector('#act-plan')?.textContent, validity: document.querySelector('#act-validity')?.textContent, device: document.querySelector('#act-done-device')?.textContent, focus: document.activeElement?.id }))
  check(`${tag}: plan, validity and device shown; focus on the result`, facts.plan === w.plans[plan] && (lastDay ? facts.validity.includes(w.until) && facts.validity.includes(lastDay.slice(0, 4)) : facts.validity === w.lifetime)
    && facts.device === device && facts.focus === 'act-done-title', JSON.stringify(facts))
  await page.click('#act-copy')
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check(`${tag}: "copy" copies the code`, clip === code, `${clip.length} characters`)
  await shot('3-code')
  const first = sent[0]
  const firstBody = first ? JSON.parse(first.postData() || '{}') : {}
  const firstHeaders = first ? await first.allHeaders() : {}
  const firstAnswer = answered[0] ? await answered[0].allHeaders() : {}
  check(`${tag}: one POST with JSON {key, device} only, and no cookie although the panel's session cookie is in this browser; none set back`,
    hasSession && sent.length === 1 && first.method() === 'POST' && JSON.stringify(Object.keys(firstBody).sort()) === '["device","key"]' && firstBody.device === device.replace('-', '')
    && !firstHeaders.cookie && !firstAnswer['set-cookie'], `${sent.length} ${JSON.stringify(Object.keys(firstHeaders))}`)

  await page.click('#act-again')
  await page.waitForSelector('#act-start:not([hidden])')
  check(`${tag}: "activate another key": the form again, the device number kept, the key emptied`, (await page.inputValue('#act-device')) === device && (await page.inputValue('#act-key')) === '')
  await page.fill('#act-key', good.key)
  await page.click('.act-submit')
  await page.waitForSelector('#act-done:not([hidden])', { timeout: 20_000 })
  check(`${tag}: the same key and device again → the same code`, (await page.locator('#act-code').textContent()).replace(/\s+/g, '') === code)
  await page.click('#act-again')
  await page.waitForSelector('#act-start:not([hidden])')

  const alertFor = async (key, dev, word) => {
    await page.fill('#act-device', dev)
    await page.fill('#act-key', key)
    await page.click('.act-submit')
    return page.waitForFunction(t => (document.querySelector('#act-alert .act-alert:not([hidden]) span')?.textContent || '').includes(t), word, { timeout: 20_000 })
      .then(async () => (await page.locator('#act-alert .act-alert span').textContent()) || '', () => page.locator('#act-alert').textContent())
  }
  let msg = await alertFor(good.key, otherDevice, w.used)
  check(`${tag}: the key on another device → the "used" sentence`, msg.includes(w.used), msg)
  await shot('4-used')
  msg = await alertFor(randomKey(), device, w.unknown)
  check(`${tag}: a key never issued → the "unknown" sentence`, msg.includes(w.unknown), msg)
  msg = await alertFor(gone.key, device, w.void)
  check(`${tag}: a key the seller voided → the "void" sentence`, msg.includes(w.void), msg)
  const help = decodeURIComponent(await page.getAttribute('#act-wa', 'href'))
  check(`${tag}: the WhatsApp help link names the device number and the key typed`, help.startsWith('https://wa.me/963996489504?text=') && help.includes(device) && help.includes(gone.key))

  const expected4xx = x => /\/api\/activate$/.test(x.split(' ').slice(1).join(' ')) && /^(404|409|410) /.test(x)
  const consoleIssues = p.console.filter(x => !/^error: Failed to load resource: the server responded with a status of (404|409|410)/.test(x))
  const csp = await p.csp()
  check(`${tag}: no console errors or CSP violations; no failed requests; 4xx only the refusals asked for`, !consoleIssues.length && !csp.length && !p.failed.length && p.http.every(expected4xx),
    [...consoleIssues, ...csp, ...p.failed, ...p.http.filter(x => !expected4xx(x))].join(' | '))
  await p.close()
}

/** The narrowest phone: the form and a code fit at 360 px. */
async function activationNarrow(browser, cookie, lang, ip) {
  const [key] = (await req('POST', '/api/keys', { cookie, body: { plan: 'pro', validity: 'date', until: '2031-12-31', clinic: `360 ${lang}` } })).json.items.map(x => x.licence)
  const p = await newPage(browser, { width: 360, height: 740, dsf: 2, mobile: true, lang })
  await p.ctx.setExtraHTTPHeaders({ 'CF-Connecting-IP': ip })
  const { page } = p
  const device = randomDevice()
  await page.goto(`${BASE}${lang === 'ar' ? '/activate' : '/en/activate'}?device=${device}`, { waitUntil: 'networkidle' })
  const form = await overflowOf(page)
  await page.screenshot({ path: join(shotDir('activate'), `${lang}-360-form.png`), fullPage: true })
  await page.fill('#act-key', key.key)
  await page.click('.act-submit')
  await page.waitForSelector('#act-done:not([hidden])', { timeout: 20_000 })
  const done = await overflowOf(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  const rows = await page.evaluate(() => { const g = [...document.querySelectorAll('#act-code > span')].map(s => Math.round(s.getBoundingClientRect().top)); return new Set(g).size })
  await page.screenshot({ path: join(shotDir('activate'), `${lang}-360-code.png`), fullPage: true })
  const verdict = await checkCode(device, (await page.locator('#act-code').textContent()).replace(/\s+/g, ''))
  check(`/activate ${lang} at 360px: form and code fit (no sideways scroll), the code in 7 rows of 4, a dated key → until 2031-12-31`, form.sw <= form.cw && done.sw <= done.cw && rows === 7
    && verdict.ok && isoDay(verdict.until) === '2031-12-31' && !p.console.length && !(await p.csp()).length, `${form.sw}/${done.sw}/${done.cw}px, ${rows} rows ${JSON.stringify(verdict)} ${p.console.join(' | ')}`)
  await p.close()
}

const PANEL_WORDS = {
  ar: { keyMode: 'مفتاح ترخيص', oneYear: 'سنة', issue3: 'إصدار 3 مفاتيح', vPending: 'مفتاح صالح بانتظار التفعيل', vActive: 'مفتاح مفعّل', keysCreate: 'إصدار مفاتيح ترخيص', keyActivate: 'تفعيل مفتاح ترخيص', copyAll: 'نسخ الكل' },
  en: { keyMode: 'Licence key', oneYear: '1 year', issue3: 'Issue 3 keys', vPending: 'Valid key, waiting for activation', vActive: 'Activated key', keysCreate: 'Licence keys issued', keyActivate: 'Licence key activated', copyAll: 'Copy all' },
}
/**
 * The seller sells keys in the panel against the real Worker: one key, then a batch of 3; the list shows them
 * waiting; a clinic activates one (POST /api/activate) and the list, the licence and verify follow; a waiting key
 * voided in the panel is then refused; the activity log names it all.
 */
async function panelKeys(browser, lang, sizeName) {
  const size = SIZES[sizeName], w = PANEL_WORDS[lang], tag = `panel keys ${lang} ${sizeName}`
  const p = await newPage(browser, { width: size.width, height: size.height, dsf: size.dsf, mobile: size.mobile, lang })
  const { page } = p
  const dir = shotDir('keys')
  const unexpected4xx = []
  page.on('response', r => { if (r.status() >= 400 && !(r.url().endsWith('/api/login') && r.status() === 401)) unexpected4xx.push(`${r.status()} ${r.url().replace(BASE, '')}`) })
  const shot = async (name, full = true) => {
    await page.waitForTimeout(150)
    const file = join(dir, `${lang}-${sizeName}-${name}.png`)
    if (full) {
      // as tall as the page (the sticky bars where a phone shows them), up to 5000 px: the activity log grows with the run
      const hgt = await page.evaluate(() => document.documentElement.scrollHeight)
      await page.setViewportSize({ width: size.width, height: Math.min(5000, Math.max(size.height, hgt)) })
      await page.waitForTimeout(120)
      await page.screenshot({ path: file })
      await page.setViewportSize({ width: size.width, height: size.height })
    } else await page.screenshot({ path: file })
    const o = await overflowOf(page)
    const missing = await page.evaluate(() => [...document.querySelectorAll('use')].map(u => u.getAttribute('href')).filter(h => !document.querySelector(h)))
    check(`${tag} ${name}: no horizontal overflow, icons resolve`, o.sw <= o.cw && !missing.length, `${o.sw}/${o.cw}px ${missing.join(' ')}`)
  }
  const api = (path, init) => page.evaluate(async ([path, init]) => (await fetch(path, { credentials: 'same-origin', ...init })).json(), [path, init || {}])
  const text = sel => page.locator(sel).first().textContent().then(s => (s || '').replace(/\s+/g, ' ').trim())
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText()).catch(() => '')

  await panelLogin(page)
  const st = (await api('/api/stats')).licences
  const pill = await page.locator('.kpi-link .pill').textContent().catch(() => '')
  check(`${tag} dashboard: "keys waiting for activation: ${st.pending}"`, pill === String(st.pending), pill)

  // ---- one key
  await page.goto(`${BASE}/admin#/new`)
  await page.waitForSelector('input[name=device]')
  await page.locator('.choice label', { hasText: w.keyMode }).click()
  check(`${tag} new: key mode hides the device number and asks how many (1)`, !(await page.locator('input[name=device]').isVisible()) && (await page.inputValue('input[name=count]')) === '1')
  const clinic = lang === 'ar' ? 'عيادة الياسمين' : 'Jasmine Dental'
  await page.fill('input[name=customer]', lang === 'ar' ? 'د. ليلى حداد' : 'Dr. Layla Haddad')
  await page.fill('input[name=clinic]', clinic)
  await page.fill('input[name=phone]', '0944 765 432')
  await shot('01-new-key')
  await page.click('form button[type=submit]')
  await page.waitForSelector('.keybox')
  const key1 = (await page.locator('.keybox').first().textContent()).trim()
  const listed = await api(`/api/licences?q=${encodeURIComponent(key1)}`)
  check(`${tag} the key shown is the one stored, waiting (no device, no code), pro, lifetime`, KEY_RE.test(key1) && listed.total === 1 && listed.items[0].device === ''
    && listed.items[0].code === '' && listed.items[0].plan === 'pro' && listed.items[0].validity === 'lifetime' && listed.items[0].clinic === clinic, key1)
  await page.locator('.block-label .chip-btn').first().click()
  check(`${tag} copy copies the key`, (await clipboard()) === key1)
  check(`${tag} the key message and WhatsApp to the customer`, (await page.locator('.bubble').textContent()).includes(key1) && (await page.getAttribute('a.btn-wa', 'href')).startsWith('https://wa.me/963944765432?text='))
  await shot('02-key-result')

  // ---- a batch of 3, one year
  await page.locator('.form-actions .btn-outline').last().click()
  await page.waitForSelector('input[name=count]')
  await page.click('.step-btn >> nth=1')
  await page.click('.step-btn >> nth=1')
  await page.locator('label', { hasText: w.oneYear }).first().click()
  check(`${tag} batch: the stepper counts to 3, the button says so`, (await page.inputValue('input[name=count]')) === '3' && (await text('form button[type=submit]')) === w.issue3, await text('form button[type=submit]'))
  await page.fill('input[name=customer]', lang === 'ar' ? 'موزّع حمص' : 'Homs reseller')
  await page.fill('input[name=clinic]', '')
  await page.fill('input[name=phone]', '')
  await page.fill('input[name=price]', '40')
  await page.click('form button[type=submit]')
  await page.waitForSelector('.key-list')
  const three = (await page.locator('.key-list .keybox').allTextContents()).map(x => x.trim())
  const stored = await Promise.all(three.map(k => api(`/api/licences?q=${encodeURIComponent(k)}`)))
  check(`${tag} batch: 3 different keys shown, each stored waiting (pro, 1 year, $40)`, three.length === 3 && new Set(three).size === 3 && three.every(k => KEY_RE.test(k))
    && stored.every(x => x.total === 1 && x.items[0].device === '' && x.items[0].plan === 'pro' && x.items[0].validity === '1y' && x.items[0].price === 40), three.join(' '))
  await page.locator('.block-label .chip-btn', { hasText: w.copyAll }).click()
  check(`${tag} batch: "copy all" = one key per line`, (await clipboard()) === three.join('\n'))
  await shot('03-batch')

  // ---- the list: waiting keys
  await page.goto(`${BASE}/admin#/licences`)
  await page.waitForSelector('.lic-row')
  await page.selectOption('.toolbar select', 'pending')
  await page.waitForFunction(() => document.querySelectorAll('.lic-row').length && [...document.querySelectorAll('.lic-row')].every(r => r.querySelector('.badge--pending')), null, { timeout: 8000 }).catch(() => {})
  const pendingRows = await page.locator('.lic-row').allTextContents()
  check(`${tag} list "waiting for activation": only waiting keys, ours among them`, (await page.locator('.lic-row').count()) === (await page.locator('.lic-row .badge--pending').count())
    && [key1, ...three].every(k => pendingRows.some(r => r.includes(k))), `${pendingRows.length} rows`)
  await shot('04-list-pending')
  await page.locator('.lic-row', { hasText: three[0] }).click()
  await page.waitForSelector('dialog.sheet .keybox')
  check(`${tag} a waiting key's sheet: the key, its message, no code yet`, (await page.locator('dialog.sheet .codebox').count()) === 0 && (await page.locator('dialog.sheet .bubble').textContent()).includes(three[0]))
  await shot('05-sheet-waiting', false)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog.sheet'))

  // ---- a clinic activates one of them
  const device = randomDevice()
  const act = await activateReq({ key: three[0], device }, { ip: '198.51.100.50' })
  check(`${tag} the clinic activates a key of the batch (200)`, act.status === 200, `${act.status} ${act.text.slice(0, 60)}`)
  await page.selectOption('.toolbar select', '')
  await page.fill('#lic-q', three[0])
  await page.waitForFunction(k => document.querySelectorAll('.lic-row').length === 1 && document.querySelector('.lic-row').textContent.includes(k), three[0], { timeout: 8000 }).catch(() => {})
  check(`${tag} the list shows it "activated on" ${device}`, (await page.locator('.lic-row .badge--on').textContent().catch(() => '')).includes(device))
  await page.locator('.lic-row').first().click()
  await page.waitForSelector('dialog.sheet .codebox')
  check(`${tag} its sheet now holds the device and the code the clinic received`, (await page.locator('dialog.sheet .codebox').textContent()).replace(/\s+/g, '') === act.json?.code
    && (await page.locator('dialog.sheet .facts').textContent()).includes(device))
  await shot('06-sheet-activated', false)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog.sheet'))
  await page.fill('#lic-q', '')

  // ---- verify
  await page.goto(`${BASE}/admin#/verify`)
  await page.waitForSelector('textarea[name=code]')
  await page.fill('textarea[name=code]', key1.toLowerCase())
  await page.click('form button[type=submit]')
  const vp = await page.waitForFunction(t => document.querySelector('.result-head h2')?.textContent === t, w.vPending, { timeout: 8000 }).then(() => true, () => false)
  check(`${tag} verify a waiting key → "${w.vPending}"`, vp, await text('.result-head'))
  await shot('07-verify-pending')
  await page.fill('textarea[name=code]', three[0])
  await page.click('form button[type=submit]')
  const va = await page.waitForFunction(t => document.querySelector('.result-head h2')?.textContent === t, w.vActive, { timeout: 8000 }).then(() => true, () => false)
  check(`${tag} verify the activated key → "${w.vActive}" on ${device}`, va && (await text('.result-head')).includes(device), await text('.result-head'))
  await shot('08-verify-activated')

  // ---- void a waiting key in its sheet: activation is then refused
  await page.goto(`${BASE}/admin#/licences`)
  await page.waitForSelector('.lic-row')
  await page.fill('#lic-q', three[1])
  await page.waitForFunction(k => document.querySelectorAll('.lic-row').length === 1 && document.querySelector('.lic-row').textContent.includes(k), three[1], { timeout: 8000 }).catch(() => {})
  await page.locator('.lic-row').first().click()
  await page.waitForSelector('dialog.sheet .keybox')
  await page.locator('dialog.sheet .seg--status label').nth(2).click()
  await page.waitForSelector('dialog.confirm[open]')
  await shot('09-confirm-void', false)
  await page.locator('dialog.confirm .btn-danger').click()
  const isVoid = await page.waitForFunction(() => document.querySelector('dialog.sheet .sheet-head .badge')?.className.includes('void'), null, { timeout: 6000 }).then(() => true, () => false)
  const refused = await activateReq({ key: three[1], device: randomDevice() }, { ip: '198.51.100.51' })
  check(`${tag} a waiting key voided in the panel → its activation is refused (410 void)`, isVoid && refused.status === 410 && refused.json?.error === 'void', `${isVoid} ${refused.status}`)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog.sheet'))

  // ---- activity, dashboard
  await page.goto(`${BASE}/admin#/activity`)
  await page.waitForSelector('.feed-item')
  const feed = await page.locator('.feed-item').allTextContents()
  check(`${tag} activity: keys issued and activated in words, a key by its last 4 characters only`, feed.some(x => x.includes(w.keysCreate)) && feed.some(x => x.includes(w.keyActivate) && x.includes(three[0].slice(-4)) && x.includes(device))
    && !feed.some(x => /keys\.create|key\.activate/.test(x) || [key1, ...three].some(k => x.includes(k))), feed.slice(0, 3).join(' | '))
  await shot('10-activity')
  await page.goto(`${BASE}/admin#/`)
  await page.waitForSelector('.kpis:not([aria-busy])')
  await shot('11-dashboard')

  const csp = await p.csp()
  check(`${tag} no CSP violations, no console errors or warnings, no 4xx/5xx or failed requests`, !csp.length && !p.console.length && !unexpected4xx.length && !p.failed.filter(x => !/net::ERR_ABORTED/.test(x)).length,
    [...csp, ...p.console, ...unexpected4xx, ...p.failed].join(' | '))
  await p.close()
}

/** /download/windows with an installer published: a 45 MiB stand-in in 3 parts on a Worker of its own. */
async function windowsInstaller() {
  section('/download/windows with an installer published (a 45 MiB stand-in, 3 parts)')
  const size = 45 * 1024 * 1024
  const bytes = Buffer.alloc(size)
  for (let at = 0; at < size; at += 65_536) crypto.getRandomValues(bytes.subarray(at, at + 65_536))
  const file = join(OUT, 'stand-in-setup.exe')
  writeFileSync(file, bytes)
  const sha = createHash('sha256').update(bytes).digest('hex')
  buildPublic(file)
  const meta = JSON.parse(readFileSync(join(SERVER, 'public', 'files', 'windows.json'), 'utf8'))
  check('build-public: 3 parts of at most 20 MiB adding up to the file, its sha256 and the app\'s version', meta.parts.length === 3 && meta.parts.every(x => x.size <= 20 * 1024 * 1024)
    && meta.parts.reduce((a, x) => a + x.size, 0) === size && meta.sizeBytes === size && meta.sha256 === sha && meta.version === APK_VERSION, JSON.stringify(meta.parts))
  const w = await startWorker('windows', PORT + 3)
  try {
    let r = await req('GET', '/download/windows', { base: w.base, ip: '192.0.2.90' })
    const got = createHash('sha256').update(r.buf).digest('hex')
    check('GET /download/windows → 200, exactly the installer\'s bytes (sha256), streamed from its parts', r.status === 200 && r.buf.length === size && got === sha,
      `${r.status} ${r.buf.length} bytes, sha256 ${got.slice(0, 16)}… (the file: ${sha.slice(0, 16)}…)`)
    check('…as Dentora-Setup-<version>.exe: exe type, the whole length, no ranges, no-store, security headers', r.headers.get('content-type') === 'application/vnd.microsoft.portable-executable'
      && r.headers.get('content-disposition') === `attachment; filename="Dentora-Setup-${APK_VERSION}.exe"` && r.headers.get('content-length') === String(size)
      && r.headers.get('accept-ranges') === 'none' && r.headers.get('cache-control') === 'no-store' && !missingSecurity(r.headers).length,
    `${r.headers.get('content-type')} | ${r.headers.get('content-disposition')} | ${r.headers.get('content-length')}`)
    r = await req('GET', '/download/windows', { base: w.base, headers: { Range: 'bytes=100-199' } })
    check('a Range request gets the whole file from the start (200, same sha256)', r.status === 200 && createHash('sha256').update(r.buf).digest('hex') === sha, `${r.status} ${r.buf.length}`)
    r = await req('HEAD', '/download/windows', { base: w.base })
    check('HEAD → 200 with the length, no body', r.status === 200 && r.buf.length === 0 && r.headers.get('content-length') === String(size))
    const [en, ar] = [await req('GET', '/en', { base: w.base }), await req('GET', '/', { base: w.base })]
    check('the landing page offers the installer with its version and size (45 MB)', en.text.includes('Download for Windows') && en.text.includes(`Installer · version <bdi dir="ltr">${APK_VERSION}</bdi> · 45 MB`)
      && ar.text.includes('تحميل لويندوز') && ar.text.includes(`<bdi dir="ltr">${APK_VERSION}</bdi>`))
  } finally {
    await stopWorker(w)
    // public/ as the rest of the run had it
    buildPublic('none')
    rmSync(file, { force: true })
  }
}

// ==== run ==========================================================================================================
async function main() {
  mkdirSync(OUT, { recursive: true })
  rmSync(SHOTS, { recursive: true, force: true })
  if (PASSWORD.length < 12 || !SECRETS.length) {
    check('.dev.vars has ADMIN_PASSWORD (12+ characters) and LICENSE_PRIVATE_JWK (see .dev.vars.example)', false)
    return
  }
  section('build and start')
  buildPublic('none')
  // A throwaway P-256 key: well-formed, but not the key the app trusts.
  const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const wrongKey = JSON.stringify(await crypto.subtle.exportKey('jwk', privateKey))
  const [main, setupW, keyW] = await Promise.all([
    startWorker('main', PORT),
    startWorker('setup', PORT + 1, ['--var', 'ADMIN_PASSWORD:short-pass']),
    startWorker('wrongkey', PORT + 2, ['--var', `LICENSE_PRIVATE_JWK:${wrongKey}`]),
  ])
  check(`3 Workers up (${main.base}, ${setupW.base}, ${keyW.base}), each on an empty local D1`, true)
  const browser = await chromium.launch()
  try {
    const { cookie } = await login()
    if (ONLY.has('site')) await site(browser, cookie)
    let firstCode = ''
    if (ONLY.has('api')) { const a = await api(browser, main); firstCode = a.L1.code }
    if (ONLY.has('api') && firstCode) await otherWorkers(browser, setupW, keyW, firstCode)
    if (ONLY.has('admin')) {
      section('control panel: the full flow at 390 and 1440 px, Arabic and English')
      for (const lang of ['ar', 'en']) for (const size of ['phone', 'desktop']) {
        try { await panelFlow(browser, lang, size) } catch (e) { check(`panel ${lang} ${size} flow`, false, e.message.split('\n')[0]) }
        try { await panelMocked(browser, lang, size) } catch (e) { check(`panel ${lang} ${size} intercepted states`, false, e.message.split('\n')[0]) }
      }
      section('control panel at 360 px')
      await panelNarrow(browser)
    }
    if (ONLY.has('keys')) {
      const { cookie: c } = await keysApi(main)
      await keyLinks()
      section('the activation page in Chromium: Arabic and English, phone and desktop, then 360 px')
      let n = 0
      for (const lang of ['ar', 'en']) for (const size of ['phone', 'desktop']) {
        try { await activationPage(browser, c, lang, size, `198.51.100.${60 + n++}`) } catch (e) { check(`/activate ${lang} ${size}`, false, e.message.split('\n')[0]) }
      }
      for (const lang of ['ar', 'en']) await activationNarrow(browser, c, lang, `198.51.100.${60 + n++}`)
      section('licence keys in the control panel: Arabic and English, phone and desktop')
      for (const lang of ['ar', 'en']) for (const size of ['phone', 'desktop']) {
        try { await panelKeys(browser, lang, size) } catch (e) { check(`panel keys ${lang} ${size}`, false, e.message.split('\n')[0]) }
      }
    }
    if (ONLY.has('admin') || ONLY.has('keys')) {
      section('stats after everything')
      const { cookie: c } = await login()
      const st = (await req('GET', '/api/stats', { cookie: c })).json
      const all = (await req('GET', '/api/licences?limit=200', { cookie: c })).json.items
      const live = all.filter(l => l.status !== 'void'), active = all.filter(l => l.status === 'active')
      const revenue = Math.round(active.reduce((a, l) => a + l.price, 0) * 100) / 100
      const pending = all.filter(l => l.status === 'active' && l.key && !l.device).length
      check('stats agree with the licences list (total = not void, revenue = active, pending = active keys not activated)', st.licences.total === live.length
        && st.licences.revenue === revenue && st.licences.revenueMonth === revenue && st.licences.pending === pending,
        `${st.licences.total}/${live.length} ${st.licences.revenue}/${revenue} ${st.licences.pending}/${pending}`)
    }
  } finally {
    await browser.close()
  }

  section('headers on every response')
  const apiSeen = seen.filter(x => x.path.startsWith('/api/'))
  // the CSV and the CORS preflight of /api/activate (204, no body) are the API answers that are not JSON
  const apiBad = apiSeen.filter(x => !(x.path === '/api/licences.csv' && x.status === 200) && !(x.method === 'OPTIONS' && x.status === 204))
    .filter(x => x.headers.get('content-type') !== 'application/json; charset=utf-8' || x.headers.get('cache-control') !== 'no-store')
  check(`all ${apiSeen.length} API responses: JSON (CSV and the preflight aside) and no-store`, apiSeen.length > 0 && !apiBad.length, apiBad.slice(0, 5).map(x => `${x.method} ${x.path} ${x.status} ${x.headers.get('content-type')} ${x.headers.get('cache-control')}`).join(' | '))
  const insecure = seen.filter(x => missingSecurity(x.headers, x.path).length)
  const html = seen.filter(x => (x.headers.get('content-type') || '').startsWith('text/html'))
  check(`security headers on all ${seen.length} responses (${html.length} HTML, ${apiSeen.length} API, the rest files, redirects, downloads)`, seen.length > 0 && !insecure.length,
    insecure.slice(0, 5).map(x => `${x.method} ${x.path} ${x.status}: ${missingSecurity(x.headers, x.path)}`).join(' | '))

  // the local trace store keeps the Worker's console lines (offered by recent wranglers only)
  let logStore = 'not offered by this wrangler'
  try {
    const r = await fetch(`${BASE}/cdn-cgi/local/explorer/api/local/observability/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: 'SELECT * FROM logs' }) })
    if (r.ok) { const t = await r.text(); scan('local Worker console log store', t); logStore = `searched, ${t.length} bytes` }
  } catch { /* not offered */ }
  for (const w of workers) await stopWorker(w)
  // after the main Workers stopped: it rebuilds public/ and runs a Worker of its own
  if (ONLY.has('windows')) await windowsInstaller()

  section('the private key stays in the Worker')
  for (const w of workers) scan(`wrangler output (${w.name})`, w.log)
  const walk = dir => existsSync(dir) ? readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p] }) : []
  const files = [...workers.flatMap(w => walk(w.persist)), ...walk(join(SERVER, 'public'))]
  for (const f of files) scan(f.replace(SERVER, '.').replace(OUT, '<out>'), readFileSync(f))
  check(`the private key ("d") is in none of ${scanned} responses, headers, Worker logs, D1 files and public/ files`, scanned > 100 && !leaks.length,
    leaks.length ? leaks.slice(0, 5).join(' | ') : `console log store: ${logStore}`)
}

try {
  await main()
} catch (e) {
  check('e2e run', false, e.stack || e.message)
} finally {
  for (const w of workers) await stopWorker(w)
}
const failed = results.filter(r => !r.ok)
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(`\n${results.length - failed.length}/${results.length} checks passed — screenshots in ${SHOTS}`)
if (failed.length) console.log(`FAILED:\n${failed.map(f => `  ${f.what}${f.detail ? ` — ${f.detail}` : ''}`).join('\n')}`)
process.exit(failed.length ? 1 : 0)
