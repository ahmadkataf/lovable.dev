#!/usr/bin/env node
// Focus Point — one-command deployment to Cloudflare (Workers + D1), safe to run again at any time.
//
//   cd focuspoint && node deploy.mjs
//
// What it does, skipping whatever is already done:
//   1. installs the dependencies of api/ and web/
//   2. signs in to Cloudflare (opens the browser once; or uses CLOUDFLARE_API_TOKEN if set)
//   3. creates the D1 database "focuspoint" if missing and writes its id into api/wrangler.toml
//   4. applies the schema (idempotent) and seeds the six rooms on an empty database
//   5. builds the web app and deploys the Worker (API + app + custom domain from wrangler.toml)
//   6. sets the secrets that are missing (generated once and kept in ~/.focuspoint/secrets.json —
//      keep that file: moving the system to another account must reuse the same VAPID keys)
//   7. creates the first admin account (asks for phone, name and password) and, optionally,
//      a Google Play reviewer account + "pay on arrival"
//
// Another Cloudflare account: export CLOUDFLARE_ACCOUNT_ID=<id> (overrides wrangler.toml) before running.
import { spawnSync } from 'node:child_process'
import { webcrypto, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const API = path.join(ROOT, 'api'), WEB = path.join(ROOT, 'web')
const TOML = path.join(API, 'wrangler.toml')
const isWin = process.platform === 'win32'
const WRANGLER = process.env.FP_WRANGLER || path.join(API, 'node_modules', '.bin', isWin ? 'wrangler.cmd' : 'wrangler')   // FP_WRANGLER: tests only
const STORE_DIR = path.join(os.homedir(), '.focuspoint')
const SECRETS_FILE = path.join(STORE_DIR, 'secrets.json')

const c = { b: s => `\x1b[1m${s}\x1b[0m`, g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m` }
let stepNo = 0
const step = (en, ar) => console.log(`\n${c.b(`[${++stepNo}/7]`)} ${c.b(ar)}  ${c.d(en)}`)
const ok = s => console.log(`    ${c.g('✓')} ${s}`)
const info = s => console.log(`    ${s}`)
function die(ar, detail = '') {
  console.error(`\n${c.r('✗ ' + ar)}`)
  if (detail) console.error(c.d(detail.trim().split('\n').slice(-25).join('\n')))
  process.exit(1)
}

// ---------- process helpers ----------
function run(cmd, args, { cwd = API, capture = false, interactive = false, env = {} } = {}) {
  const r = spawnSync(cmd, args, {
    cwd, shell: isWin, encoding: 'utf8', env: { ...process.env, ...env },
    // stdin 'ignore' keeps wrangler non-interactive (no prompts) except where we want the browser login
    stdio: interactive ? 'inherit' : ['ignore', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.error) die(`تعذّر تشغيل ${cmd}`, String(r.error))
  return { code: r.status ?? 1, out: r.stdout || '', err: r.stderr || '', all: `${r.stdout || ''}\n${r.stderr || ''}` }
}
const wr = (args, opts = {}) => run(WRANGLER, args, { capture: true, ...opts })
/** The JSON value inside a command's output (wrangler may print banners/warnings around it). */
function parseJsonOut(text) {
  const starts = ['[', '{'].map(ch => text.indexOf(ch)).filter(i => i >= 0)
  if (!starts.length) return null
  const from = Math.min(...starts), open = text[from], close = open === '[' ? ']' : '}'
  const to = text.lastIndexOf(close)
  try { return JSON.parse(text.slice(from, to + 1)) } catch { return null }
}
const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const randomSecret = (bytes = 32) => b64url(randomBytes(bytes))

// ---------- prompts: one readline for the whole run; lines are queued so typed-ahead or piped answers are never lost.
// Hidden input (passwords) mutes readline's echo while the prompt itself stays visible.
let rl = null, muted = false, closed = false
const lines = [], waiters = []
function prompt() {
  if (rl) return rl
  rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const write = rl._writeToOutput?.bind(rl)
  if (write) rl._writeToOutput = (s) => { if (!muted) write(s) }
  rl.on('line', l => { const w = waiters.shift(); w ? w(l) : lines.push(l) })
  rl.on('close', () => { closed = true; while (waiters.length) waiters.shift()(null) })
  return rl
}
function nextLine() {
  if (lines.length) return Promise.resolve(lines.shift())
  if (closed) return Promise.resolve(null)
  return new Promise(r => waiters.push(r))
}
async function readAnswer(text, hidden) {
  const i = prompt()
  i.setPrompt(text); i.prompt()
  if (hidden) muted = true
  const a = await nextLine()
  if (hidden) { muted = false; process.stdout.write('\n') }
  if (a === null) die('انتهى الإدخال قبل الإجابة')
  return a
}
async function ask(q, def = '') {
  return (await readAnswer(`    ${q}${def ? c.d(` [${def}]`) : ''}: `, false)).trim() || def
}
async function yes(q, def = true) {
  const a = (await ask(`${q} ${def ? '(Y/n)' : '(y/N)'}`)).toLowerCase()
  return a ? a.startsWith('y') || a.startsWith('ن') : def
}
const askHidden = (q) => readAnswer(`    ${q}: `, true)

// ---------- config ----------
const tomlText = () => fs.readFileSync(TOML, 'utf8')
const tomlVar = (name) => (tomlText().match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, 'm')) || [])[1] || ''
const WORKER = tomlVar('name') || 'focuspoint-api'
const PUBLIC_URL = tomlVar('PUBLIC_URL').replace(/\/$/, '')

async function main() {
  console.log(c.b('\nFocus Point — النشر على Cloudflare'))
  const major = Number(process.versions.node.split('.')[0])
  if (major < 18) die(`يلزم Node.js 18 أو أحدث (الموجود ${process.versions.node}). ثبّت النسخة LTS من nodejs.org`)

  // 1. dependencies
  step('dependencies', 'تثبيت المكتبات')
  for (const dir of [API, WEB]) {
    const r = run('npm', ['install', '--no-fund', '--no-audit', '--loglevel=error'], { cwd: dir })
    if (r.code) die(`فشل npm install في ${path.basename(dir)}`)
  }
  if (!fs.existsSync(WRANGLER)) die('wrangler غير موجود بعد التثبيت', WRANGLER)
  ok('api و web جاهزان')

  // 2. sign in
  step('Cloudflare sign-in', 'تسجيل الدخول إلى Cloudflare')
  let who = wr(['whoami'])
  if (/not authenticated|wrangler login/i.test(who.all) || who.code) {
    info('سيُفتح المتصفح لتسجيل الدخول؛ اضغط Allow ثم ارجع إلى هذه النافذة.')
    const r = run(WRANGLER, ['login'], { interactive: true })
    if (r.code) die('لم يكتمل تسجيل الدخول')
    who = wr(['whoami'])
  }
  const email = (who.all.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [])[0]
  ok(`مسجّل الدخول${email ? ` (${email})` : ''}`)

  // 3. database
  step('D1 database', 'قاعدة البيانات')
  let dbId = tomlVar('database_id')
  if (!dbId || dbId === 'REPLACE_ME') {
    const find = () => {
      const r = wr(['d1', 'list', '--json'])
      if (r.code) die('تعذّرت قراءة قواعد البيانات في الحساب', r.all)
      const list = parseJsonOut(r.out) || []
      const db = (Array.isArray(list) ? list : []).find(d => d.name === 'focuspoint')
      return db && (db.uuid || db.id || db.database_id)
    }
    dbId = find()
    if (!dbId) {
      const r = wr(['d1', 'create', 'focuspoint'])
      if (r.code) die('تعذّر إنشاء قاعدة البيانات', r.all)
      dbId = find() || (r.all.match(/database_id\s*=\s*"([0-9a-f-]{36})"/) || [])[1]
      if (!dbId) die('أُنشئت القاعدة لكن لم أجد رقمها', r.all)
      ok('أُنشئت قاعدة البيانات focuspoint')
    }
    fs.writeFileSync(TOML, tomlText().replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${dbId}"`))
    ok(`رقم القاعدة كُتب في wrangler.toml (${dbId})`)
  } else ok(`القاعدة موجودة (${dbId})`)

  let r = wr(['d1', 'execute', 'focuspoint', '--remote', '--file=./schema.sql', '--yes'])
  if (r.code) die('فشل تطبيق مخطط قاعدة البيانات', r.all)
  ok('المخطط مطبّق')
  r = wr(['d1', 'execute', 'focuspoint', '--remote', '--command', 'SELECT COUNT(*) AS n FROM rooms', '--json', '--yes'])
  const rooms = Number(parseJsonOut(r.out)?.[0]?.results?.[0]?.n ?? NaN)
  if (r.code || Number.isNaN(rooms)) die('تعذّر فحص جدول القاعات', r.all)
  if (rooms === 0) {
    r = wr(['d1', 'execute', 'focuspoint', '--remote', '--file=./seed.sql', '--yes'])
    if (r.code) die('فشل إدخال القاعات الافتراضية', r.all)
    ok('أُدخلت القاعات الست الافتراضية (تُعدَّل من لوحة الفريق)')
  } else ok(`القاعات موجودة (${rooms}) — لم يُمسّ شيء`)

  // 4. build + deploy
  step('build + deploy', 'بناء التطبيق ونشره')
  r = run('npm', ['run', 'build'], { cwd: WEB, capture: true })
  if (r.code) die('فشل بناء تطبيق الويب', r.all)
  ok('بُني التطبيق')
  r = wr(['deploy'])
  if (r.code) {
    const hint = /already has externally managed DNS|DNS record/i.test(r.all)
      ? `\nيوجد سجل DNS قديم باسم ${new URL(PUBLIC_URL).hostname} في Cloudflare → DNS. احذفه ثم أعد تشغيل الأمر.`
      : /Authentication|not authorized|10000|account/i.test(r.all) ? '\nالحساب المسجّل لا يملك صلاحية على account_id في wrangler.toml (أو استخدم CLOUDFLARE_ACCOUNT_ID).' : ''
    die('فشل النشر' + hint, r.all)
  }
  const devUrl = (r.all.match(/https:\/\/[\w.-]+\.workers\.dev/) || [])[0]
  ok(`نُشر الخادم${devUrl ? ` (${devUrl})` : ''}`)

  // 5. secrets
  step('secrets', 'الأسرار (مفاتيح الإشعارات والتوقيع)')
  fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 })
  const store = fs.existsSync(SECRETS_FILE) ? JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')) : {}
  const mine = store[WORKER] || {}
  if (!mine.VAPID_PUBLIC_KEY || !mine.VAPID_PRIVATE_KEY) {
    const key = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwk = await webcrypto.subtle.exportKey('jwk', key.privateKey)
    mine.VAPID_PUBLIC_KEY = b64url(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]))
    mine.VAPID_PRIVATE_KEY = jwk.d
  }
  mine.VAPID_SUBJECT ||= PUBLIC_URL || 'mailto:owner@example.com'
  mine.TOKEN_SECRET ||= randomSecret(48)
  mine.WEBHOOK_SECRET ||= randomSecret(24)
  mine.ADMIN_SETUP_KEY ||= randomSecret(18)
  store[WORKER] = mine
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(store, null, 2), { mode: 0o600 })
  try { fs.chmodSync(SECRETS_FILE, 0o600) } catch {}
  r = wr(['secret', 'list', '--format', 'json'])
  const existing = new Set((parseJsonOut(r.out) || []).map(s => s.name))
  const missing = Object.fromEntries(Object.entries(mine).filter(([k]) => !existing.has(k)))
  // the setup key is only needed to create the first admin, so it is safe to (re)set it to the local value
  if (existing.has('ADMIN_SETUP_KEY')) missing.ADMIN_SETUP_KEY = mine.ADMIN_SETUP_KEY
  if (Object.keys(missing).length) {
    const tmp = path.join(STORE_DIR, `.bulk-${process.pid}.json`)
    fs.writeFileSync(tmp, JSON.stringify(missing), { mode: 0o600 })
    r = wr(['secret', 'bulk', tmp])
    fs.rmSync(tmp, { force: true })
    if (r.code) die('فشل حفظ الأسرار في Cloudflare', r.all)
    ok(`حُفظت: ${Object.keys(missing).join(', ')}`)
  } else ok('كل الأسرار موجودة')
  info(c.d(`نسخة منها في ${SECRETS_FILE} — احتفظ بها (يلزم نفس مفاتيح VAPID عند نقل النظام).`))

  // 6. wait until it answers
  step('health check', 'التأكد من أن النظام يعمل')
  let base = null
  for (let i = 0; i < 40 && !base; i++) {
    for (const u of [PUBLIC_URL, devUrl].filter(Boolean)) {
      try {
        const res = await fetch(`${u}/v1/health`, { signal: AbortSignal.timeout(8000) })
        if (res.ok) { base = u; break }
      } catch {}
    }
    if (!base) { if (i === 0) info('ننتظر شهادة HTTPS للدومين (قد تأخذ دقيقة أو اثنتين)…'); await new Promise(r => setTimeout(r, 5000)) }
  }
  if (!base) die(`النظام نُشر لكن ${PUBLIC_URL} لا يردّ بعد. انتظر بضع دقائق ثم أعد تشغيل الأمر.`)
  ok(`يعمل على ${base}`)

  // 7. first admin
  step('first admin', 'حساب المدير')
  const post = async (p, body, token, method = 'POST') => {
    const res = await fetch(`${base}${p}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
    return { status: res.status, data: await res.json().catch(() => ({})) }
  }
  const probe = await post('/v1/admin/bootstrap', { setup_key: mine.ADMIN_SETUP_KEY })
  let token = null
  if (probe.status === 409) ok('حساب المدير موجود مسبقاً — سجّل الدخول من /team')
  else {
    const phone = await ask('رقم هاتف المدير', '0985258963')
    const name = await ask('اسم المدير', 'المدير')
    let pass = ''
    for (;;) {
      pass = await askHidden('كلمة مرور المدير (6 أحرف على الأقل)')
      if (pass.length < 6) { info(c.y('قصيرة جداً')); continue }
      if ((await askHidden('أعد كتابتها')) === pass) break
      info(c.y('غير متطابقة، حاول مجدداً'))
    }
    const res = await post('/v1/admin/bootstrap', { setup_key: mine.ADMIN_SETUP_KEY, phone, name, password: pass })
    if (res.status !== 201) die(`تعذّر إنشاء المدير (${res.data.error || res.status})`)
    token = res.data.token
    ok(`أُنشئ المدير ${res.data.user?.name} (${res.data.user?.phone})`)
  }

  let reviewer = null
  if (token && await yes('إنشاء حساب موظف تجريبي لمراجعي Google Play؟')) {
    const rpass = randomSecret(8).replace(/[-_]/g, 'x')
    const res = await post('/v1/admin/team', { phone: '0999000111', name: 'Google Reviewer', password: rpass, role: 'staff' }, token)
    if (res.status === 201 || res.status === 200) {
      reviewer = { phone: '0999000111', password: rpass }
      fs.writeFileSync(path.join(STORE_DIR, 'play-reviewer.txt'), `Focus Point — Google Play reviewer (staff)\nURL: ${base}/team\nphone: 0999000111\npassword: ${rpass}\n`, { mode: 0o600 })
      ok('أُنشئ حساب المراجع')
    } else info(c.y(`لم يُنشأ حساب المراجع (${res.data.error || res.status})`))
    if (await yes('تفعيل «الدفع عند الوصول» ليقدر المراجع (والزبائن) الحجز دون تحويل؟ يُطفأ من الإعدادات')) {
      const s = await post('/v1/admin/settings', { allow_pay_on_arrival: true }, token, 'PATCH')
      s.status === 200 ? ok('فُعّل الدفع عند الوصول') : info(c.y(`لم يُفعَّل (${s.data.error || s.status})`))
    }
  }

  console.log(`\n${c.g(c.b('✓ تم النشر'))}`)
  console.log(`    الموقع والتطبيق:   ${base}`)
  console.log(`    لوحة الفريق:       ${base}/team`)
  console.log(`    سياسة الخصوصية:    ${base}/privacy`)
  if (reviewer) console.log(`    مراجع Google Play:  الهاتف ${reviewer.phone} · كلمة المرور ${reviewer.password}  (محفوظة في ${path.join(STORE_DIR, 'play-reviewer.txt')})`)
  console.log(c.d('\n    لإعادة النشر بعد أي تعديل: node deploy.mjs (لا يمسّ البيانات ولا الأسرار الموجودة)\n'))
}

main().then(() => rl?.close()).catch(e => die('خطأ غير متوقع', e?.stack || String(e)))
