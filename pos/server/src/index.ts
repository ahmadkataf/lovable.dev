// Kaseb license server: online activation, periodic verification and the seller's codes page.
//
//   GET  /api/info                                   price, WhatsApp, trial days… for the activation screen
//   GET  /api/public-key                             the Ed25519 public key the app is built with
//   POST /api/activate  {code, device, …, nonce}     bind a code to this device → signed token
//   POST /api/trial     {device, …, nonce}           one free trial per device → signed token
//   POST /api/check     {token, device, …, nonce}    every 6 hours: still valid? → fresh token
//   POST /api/release   {token, device}              unbind this device so the code can move
//   POST /api/backup    (gzip body + x-kaseb-* headers) store a cloud backup (yearly plan)
//   POST /api/backups   {token, device}              the stored snapshots;  POST /api/backup/get {token, device, id} → the file
//   GET  /admin  +  /admin/api/*  (Bearer ADMIN_KEY) the seller's control panel and its API (see admin())
//   GET  /privacy, GET /
// Every error is { error: '<key>', message?: '<Arabic>' } with status 400 / 403 / 429.
import { ADMIN_PAGE } from './admin'
import { LANDING_PAGE } from './landing'
import {
  DAY, SRV, type TokenPayload, cleanCode, formatCode, newCode, validDevice, validNonce, validPlatform, deviceCodeOf, clip,
  sameText, publicKeyHex, signToken, verifyToken, compareVersions,
} from './license'

export interface Env {
  DB: D1Database
  BACKUPS?: KVNamespace   // absent when the deploy had no KV access: cloud endpoints answer cloud_unavailable
  LICENSE_SECRET: string
  ADMIN_KEY: string
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-kaseb-token, x-kaseb-device, x-kaseb-meta',
  'access-control-expose-headers': 'x-kaseb-at',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
}
const RATE_WINDOW = 10 * 60000   // per address, per 10 minutes: 30 activate/trial requests, 120 token calls (check/release/backup)
const RATE: Record<'activate' | 'token', { kinds: string[]; limit: number }> = {
  activate: { kinds: ['activate', 'activate-fail', 'trial', 'trial-fail'], limit: 30 },
  token: { kinds: ['check', 'check-fail', 'release', 'backup', 'backup-fail', 'restore'], limit: 120 },
}
const EVENTS_KEEP = 365 * 86400000   // the privacy page promises security logs are deleted after a year
const MAX_BODY = 8 * 1024
const MAX_SELF_MOVES = 3
const MAX_BACKUP = 20 * 1024 * 1024      // one compressed backup
const BACKUPS_PER_DAY = 12               // uploads per code per day

export type CodeRow = {
  code: string; plan: string; created_at: number; expires_at: number | null; max_devices: number
  note: string; seller: string; revoked: number; moves: number; cloud_until: number | null
}
export type BackupRow = { id: string; code: string; device: string; at: number; size: number; meta: string }
export type DeviceRow = {
  device: string; device_code: string; name: string; platform: string; version: string; build: string; sig: string
  code: string | null; bound_at: number | null; trial_started: number | null; trial_ends: number | null
  first_seen: number; last_seen: number; ip: string | null
  blocked?: number   // undefined on a database that predates the column (ensureSchema adds it)
}
type Settings = { price: string; whatsapp: string; trial_days: number; grace_days: number; min_version: string; android_signature: string; message: string; cloud_price: string; cloud_days: number; cloud_keep: number; web_trial: number; apk_url: string; win_url: string }
const DEFAULTS: Settings = { price: '35$', whatsapp: '963996489504', trial_days: 7, grace_days: 10, min_version: '', android_signature: '', message: '', cloud_price: '35$', cloud_days: 365, cloud_keep: 3, web_trial: 0, apk_url: '', win_url: '' }
/** Download links the seller may point elsewhere (a GitHub release, a drive): https only, else the built-in file / WhatsApp. */
const safeUrl = (v: unknown): string => { const s = clip(v, 400).trim(); return /^https:\/\/[^\s<>"']+$/i.test(s) ? s : '' }

// Arabic sentences for the app (it has its own; these help when the app is older than the server)
const MESSAGES: Record<string, string> = {
  invalid_code: 'الكود غير صحيح. تأكد من كتابته كما وصلك من البائع.',
  revoked: 'تم إلغاء هذا الترخيص. تواصل مع البائع.',
  expired: 'انتهت صلاحية الترخيص.',
  device_limit: 'هذا الكود مستخدم على جهاز آخر. اطلب من البائع نقله.',
  tampered: 'هذه النسخة من التطبيق معدّلة ولا يمكن تفعيلها.',
  rate_limited: 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
  min_version: 'حدّث التطبيق إلى آخر إصدار للمتابعة.',
  no_trial: 'التجربة المجانية غير متاحة لهذا الجهاز.',
  no_trial_web: 'التجربة المجانية متاحة في تطبيق أندرويد أو ويندوز فقط.',
  cloud_unavailable: 'التخزين السحابي غير مفعّل على السيرفر حالياً.',
  invalid_token: 'بيانات الترخيص غير صالحة. فعّل التطبيق من جديد.',
  device_mismatch: 'الترخيص مرتبط بجهاز آخر.',
  move_limit: 'استُنفدت مرات النقل الذاتي. اطلب من البائع نقل الترخيص.',
  bad_request: 'طلب غير مفهوم.',
  not_configured: 'الخادم غير مهيّأ بعد (LICENSE_SECRET).',
  cloud_inactive: 'التخزين السحابي غير مفعّل لهذا الترخيص. اشترك من البائع.',
  too_large: 'النسخة الاحتياطية أكبر من الحد المسموح.',
  backup_limit: 'وصلت إلى الحد اليومي للنسخ السحابي. حاول غداً.',
  not_found: 'غير موجود.',
  blocked: 'أوقف البائع هذا الجهاز. تواصل معه لمعرفة السبب.',
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
/** A WhatsApp chat link with a prefilled message. */
const waLink = (whatsapp: string, text: string): string => `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
/** The public page with the seller's price and contact filled in (HTML-escaped). */
function renderLanding(s: Settings): string {
  const esc = (v: string) => v.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
  const wa = s.whatsapp.replace(/\D/g, '')
  const pretty = wa.startsWith('963') ? '0' + wa.slice(3) : '+' + wa
  return LANDING_PAGE
    .replace(/\{\{WHATSAPP\}\}/g, esc(pretty))
    .replace(/\{\{WA_LINK\}\}/g, esc(waLink(wa, 'مرحباً، أريد الاستفسار عن برنامج كاسب')))
    .replace(/\{\{PRICE\}\}/g, esc(s.price || DEFAULTS.price))
    .replace(/\{\{CLOUD_PRICE\}\}/g, esc(s.cloud_price || DEFAULTS.cloud_price))
}
const fail = (error: string, status = 400, message?: string): Response => json({ error, message: message ?? MESSAGES[error] }, status)
const html = (s: string): Response => new Response(s, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })

// ---------- helpers ----------
const ip = (req: Request): string => req.headers.get('cf-connecting-ip') || 'local'
async function log(env: Env, kind: string, req: Request, code?: string | null, device?: string | null, detail = ''): Promise<void> {
  await env.DB.prepare('INSERT INTO events (at, kind, code, device, ip, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(Date.now(), kind, code || null, device || null, ip(req), detail.slice(0, 200)).run()
}
/** The JSON body as an object, or null when it is not JSON / too big. */
async function body(req: Request): Promise<Record<string, unknown> | null> {
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_BODY) return null
  try {
    const text = await req.text()
    if (text.length > MAX_BODY) return null
    const v: unknown = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch { return null }
}
const getCode = (env: Env, code: string) => env.DB.prepare('SELECT * FROM codes WHERE code = ?').bind(code).first<CodeRow>()
const getDevice = (env: Env, device: string) => env.DB.prepare('SELECT * FROM devices WHERE device = ?').bind(device).first<DeviceRow>()
const boundCount = async (env: Env, code: string): Promise<number> =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM devices WHERE code = ?').bind(code).first<{ n: number }>())?.n ?? 0

let schemaReady: Promise<void> | null = null
/** Columns added after the first release. SQLite has no ADD COLUMN IF NOT EXISTS, so the error on a database that
 *  already has the column is the expected outcome; tried once per isolate. The deploy workflow runs the same statement. */
function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) schemaReady = env.DB.prepare('ALTER TABLE devices ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0').run().then(() => undefined, () => undefined)
    .then(() => env.DB.prepare('CREATE INDEX IF NOT EXISTS events_kind_at ON events(kind, at)').run()).then(() => undefined, () => undefined)
  return schemaReady
}

async function settings(env: Env): Promise<Settings> {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const s: Settings = { ...DEFAULTS }
  for (const r of rows.results) {
    if (r.key === 'trial_days' || r.key === 'grace_days' || r.key === 'cloud_days' || r.key === 'cloud_keep' || r.key === 'web_trial') { const n = Number(r.value); if (Number.isFinite(n)) s[r.key] = Math.max(0, Math.round(n)) }
    else if (r.key in s) (s as unknown as Record<string, string>)[r.key] = r.value
  }
  s.grace_days = Math.max(1, s.grace_days)   // 0 would issue tokens that are locked the moment they arrive (gr = now)
  return s
}
const info = (s: Settings) => ({ price: s.price || DEFAULTS.price, whatsapp: s.whatsapp.replace(/\D/g, ''), trialDays: s.trial_days, message: s.message, minVersion: s.min_version, graceDays: s.grace_days, cloudPrice: s.cloud_price || DEFAULTS.cloud_price })

/** What the app said about itself with this request. */
type Client = { device: string; name: string; platform: string; version: string; build: string; sig: string; nonce: string }
function client(b: Record<string, unknown>, needNonce = true): Client | null {
  if (!validDevice(b.device)) return null
  if (needNonce && !validNonce(b.nonce)) return null
  return {
    device: b.device, name: clip(b.name, 60), platform: validPlatform(b.platform) ? b.platform : 'web',
    version: clip(b.version, 20), build: clip(b.build, 40), sig: clip(b.sig, 128), nonce: needNonce ? (b.nonce as string) : '',
  }
}

/** Keeps the devices row current (name, version, last seen…) without touching its code or trial. */
async function touchDevice(env: Env, req: Request, c: Client, now: number): Promise<void> {
  await env.DB.prepare(`INSERT INTO devices (device, device_code, name, platform, version, build, sig, first_seen, last_seen, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device) DO UPDATE SET device_code = excluded.device_code, name = CASE WHEN excluded.name = '' THEN devices.name ELSE excluded.name END,
      platform = excluded.platform, version = excluded.version, build = excluded.build, sig = excluded.sig, last_seen = excluded.last_seen, ip = excluded.ip`)
    .bind(c.device, deviceCodeOf(c.device), c.name, c.platform, c.version, c.build, c.sig, now, now, ip(req)).run()
}

/** min_version and the Android signature allow-list: the error key, or null when the build is welcome. */
function refuseBuild(s: Settings, c: Client): 'min_version' | 'tampered' | null {
  if (s.min_version && compareVersions(c.version || '0', s.min_version) < 0) return 'min_version'
  if (c.platform === 'android' && s.android_signature.trim()) {
    const allowed = s.android_signature.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
    if (allowed.length && !allowed.includes(c.sig.toLowerCase())) return 'tampered'
  }
  return null
}

/** Too many calls of this kind from this address lately (counted in the events table; a refused call is not logged, so it costs no write). */
async function rateLimited(env: Env, req: Request, which: keyof typeof RATE = 'activate'): Promise<boolean> {
  const { kinds, limit } = RATE[which]
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE ip = ? AND at > ? AND kind IN (${kinds.map(() => '?').join(', ')})`)
    .bind(ip(req), Date.now() - RATE_WINDOW, ...kinds).first<{ n: number }>()
  return (r?.n ?? 0) >= limit
}

/** Why a code cannot be used right now, or null. */
function refuseCode(row: CodeRow | null, now: number): 'invalid_code' | 'revoked' | 'expired' | null {
  if (!row) return 'invalid_code'
  if (row.revoked) return 'revoked'
  if (row.expires_at !== null && row.expires_at <= now) return 'expired'
  return null
}

async function issue(env: Env, s: Settings, c: Client, plan: 'full' | 'trial', code: string, exp: number | null, now: number, cloudUntil: number | null = null) {
  const payload: TokenPayload = { v: 1, code, d: c.device, p: plan, iat: now, exp, gr: now + s.grace_days * DAY, n: c.nonce, srv: SRV, cl: cloudUntil }
  const token = await signToken(env.LICENSE_SECRET, payload)
  return json({ token, status: { plan, expiresAt: exp, graceUntil: payload.gr, serverTime: now, code: code ? formatCode(code) : '', cloudUntil } })
}

// ---------- app endpoints ----------
async function activate(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const c = b && client(b)
  if (!b || !c) return fail('bad_request')
  if (await rateLimited(env, req)) return fail('rate_limited', 429)
  const code = cleanCode(b.code)
  const now = Date.now()
  const s = await settings(env)
  const bad = refuseBuild(s, c)
  if (bad) { await log(env, 'activate-fail', req, code, c.device, bad); return fail(bad, 403) }
  const row = code ? await getCode(env, code) : null
  const why = refuseCode(row, now)
  if (why || !row) { await log(env, 'activate-fail', req, code, c.device, why ?? 'invalid_code'); return fail(why ?? 'invalid_code', why === 'invalid_code' || !why ? 400 : 403) }
  await touchDevice(env, req, c, now)
  const me = await getDevice(env, c.device)
  if (me?.blocked) { await log(env, 'activate-fail', req, row.code, c.device, 'blocked'); return fail('blocked', 403) }
  if (me?.code !== row.code) {
    // bind: there must be a free slot; two devices racing for the last one are caught by the recount
    if ((await boundCount(env, row.code)) >= row.max_devices) { await log(env, 'activate-fail', req, row.code, c.device, 'device_limit'); return fail('device_limit', 403) }
    await env.DB.prepare('UPDATE devices SET code = ?, bound_at = ? WHERE device = ?').bind(row.code, now, c.device).run()
    if ((await boundCount(env, row.code)) > row.max_devices) {
      await env.DB.prepare('UPDATE devices SET code = NULL, bound_at = NULL WHERE device = ? AND code = ?').bind(c.device, row.code).run()
      await log(env, 'activate-fail', req, row.code, c.device, 'device_limit')
      return fail('device_limit', 403)
    }
    await log(env, 'activate', req, row.code, c.device, 'bind')
  } else await log(env, 'activate', req, row.code, c.device, 'refresh')
  return issue(env, s, c, 'full', row.code, row.expires_at, now, row.cloud_until)
}

async function trial(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const c = b && client(b)
  if (!b || !c) return fail('bad_request')
  if (await rateLimited(env, req)) return fail('rate_limited', 429)
  const now = Date.now()
  const s = await settings(env)
  const bad = refuseBuild(s, c)
  if (bad) { await log(env, 'trial-fail', req, null, c.device, bad); return fail(bad, 403) }
  if (s.trial_days <= 0) { await log(env, 'trial-fail', req, null, c.device, 'disabled'); return fail('no_trial', 403) }
  // a browser identity is whatever the page says (clear the site data → a new device): trials there are off unless the seller turns them on
  if (c.platform === 'web' && !s.web_trial) { await log(env, 'trial-fail', req, null, c.device, 'web'); return fail('no_trial_web', 403) }
  await touchDevice(env, req, c, now)
  const me = await getDevice(env, c.device)
  if (me?.blocked) { await log(env, 'trial-fail', req, null, c.device, 'blocked'); return fail('blocked', 403) }
  if (me?.trial_started) { await log(env, 'trial-fail', req, null, c.device, 'used'); return fail('no_trial', 403) }
  const ends = now + s.trial_days * DAY
  const r = await env.DB.prepare('UPDATE devices SET trial_started = ?, trial_ends = ? WHERE device = ? AND trial_started IS NULL').bind(now, ends, c.device).run()
  if (!r.meta.changes) { await log(env, 'trial-fail', req, null, c.device, 'used'); return fail('no_trial', 403) }
  await log(env, 'trial', req, null, c.device, `${s.trial_days}d`)
  return issue(env, s, c, 'trial', '', ends, now)
}

async function check(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const c = b && client(b)
  if (!b || !c) return fail('bad_request')
  const t = await verifyToken(env.LICENSE_SECRET, b.token)
  if (!t) return fail('invalid_token', 403)
  // a token presented with another device's hash only comes from a modified client: refused without a log row
  // (the row could be written without limit, with any device value), unlike the real "code moved" case below
  if (t.d !== c.device) return fail('device_mismatch', 403)
  if (await rateLimited(env, req, 'token')) return fail('rate_limited', 429)
  const now = Date.now()
  const s = await settings(env)
  const bad = refuseBuild(s, c)
  if (bad) { await log(env, 'check-fail', req, t.code, c.device, bad); return fail(bad, 403) }
  await touchDevice(env, req, c, now)
  const me = await getDevice(env, c.device)
  if (!me) return fail('invalid_token', 403)
  if (me.blocked) { await log(env, 'check-fail', req, t.code || null, c.device, 'blocked'); return fail('blocked', 403) }
  // the code bound to this device right now wins (the one the seller sees in the panel): the same code is refreshed,
  // a trial device the seller granted a code upgrades itself, and a device the seller re-bound to a new code follows it
  if (me.code) {
    const row = await getCode(env, me.code)
    if (row && !refuseCode(row, now)) {
      await log(env, 'check', req, row.code, c.device, me.code === t.code ? '' : 'upgrade')
      return issue(env, s, c, 'full', row.code, row.expires_at, now, row.cloud_until)
    }
  }
  // a licensed device whose code is no longer usable here: say why
  if (t.p === 'full') {
    const row = await getCode(env, t.code)
    const why = refuseCode(row, now)
    if (why || !row) { await log(env, 'check-fail', req, t.code, c.device, why ?? 'invalid_code'); return fail(why === 'invalid_code' || !why ? 'invalid_token' : why, 403) }
    await log(env, 'check-fail', req, t.code, c.device, 'device_mismatch')   // usable, but bound to another device now
    return fail('device_mismatch', 403)
  }
  if (!me.trial_started || !me.trial_ends) { await log(env, 'check-fail', req, null, c.device, 'no_trial'); return fail('invalid_token', 403) }
  if (me.trial_ends <= now) { await log(env, 'check-fail', req, null, c.device, 'expired'); return fail('expired', 403) }
  await log(env, 'check', req, null, c.device, 'trial')
  return issue(env, s, c, 'trial', '', me.trial_ends, now)
}

async function release(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const c = b && client(b, false)
  if (!b || !c) return fail('bad_request')
  const t = await verifyToken(env.LICENSE_SECRET, b.token)
  if (!t) return fail('invalid_token', 403)
  if (t.d !== c.device) return fail('device_mismatch', 403)
  if (t.p !== 'full' || !t.code) return fail('invalid_token', 403)
  const me = await getDevice(env, c.device)
  if (!me || me.code !== t.code) return json({ ok: true })   // already free: nothing to do
  const row = await getCode(env, t.code)
  if (!row) return fail('invalid_token', 403)
  if (await rateLimited(env, req, 'token')) return fail('rate_limited', 429)
  if (row.moves >= MAX_SELF_MOVES) { await log(env, 'release', req, t.code, c.device, 'move_limit'); return fail('move_limit', 403) }
  await env.DB.batch([
    env.DB.prepare('UPDATE devices SET code = NULL, bound_at = NULL WHERE device = ? AND code = ?').bind(c.device, t.code),
    env.DB.prepare('UPDATE codes SET moves = moves + 1 WHERE code = ?').bind(t.code),
  ])
  await log(env, 'release', req, t.code, c.device, 'self')
  return json({ ok: true })
}

// ---------- cloud backups (the yearly plan) ----------
const cloudActive = (row: CodeRow, now: number): boolean => row.cloud_until !== null && row.cloud_until > now
/** The licensed device behind a token, or an error key. Cloud calls need a full license bound to this device. */
async function cloudAuth(env: Env, token: unknown, device: unknown): Promise<{ t: TokenPayload; row: CodeRow } | string> {
  if (!validDevice(device)) return 'bad_request'
  const t = await verifyToken(env.LICENSE_SECRET, token)
  if (!t) return 'invalid_token'
  if (t.d !== device) return 'device_mismatch'
  if (t.p !== 'full' || !t.code) return 'cloud_inactive'
  const row = await getCode(env, t.code)
  if (!row || refuseCode(row, Date.now())) return 'invalid_token'
  const me = await getDevice(env, device)
  if (!me || me.code !== row.code) return 'device_mismatch'
  if (me.blocked) return 'blocked'
  return { t, row }
}
const backupKey = (code: string, id: string) => `b:${code}:${id}`
const publicBackup = (b: BackupRow) => {
  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(b.meta) } catch { /* old row */ }
  return { id: b.id, at: b.at, size: b.size, device: deviceCodeOf(b.device), ...meta }
}
async function listBackups(env: Env, code: string): Promise<BackupRow[]> {
  return (await env.DB.prepare('SELECT * FROM backups WHERE code = ? ORDER BY at DESC').bind(code).all<BackupRow>()).results
}
async function deleteBackup(env: Env, b: BackupRow): Promise<void> {
  if (env.BACKUPS) await env.BACKUPS.delete(backupKey(b.code, b.id))
  await env.DB.prepare('DELETE FROM backups WHERE id = ?').bind(b.id).run()
}

/** POST /api/backup — the compressed backup as the body; token, device and meta in headers. */
async function backupUpload(req: Request, env: Env): Promise<Response> {
  if (!env.BACKUPS) return fail('cloud_unavailable', 503)
  const auth = await cloudAuth(env, req.headers.get('x-kaseb-token'), req.headers.get('x-kaseb-device'))
  if (typeof auth === 'string') return fail(auth, auth === 'bad_request' ? 400 : 403)
  const { row, t } = auth
  const now = Date.now()
  if (await rateLimited(env, req, 'token')) return fail('rate_limited', 429)
  if (!cloudActive(row, now)) { await log(env, 'backup-fail', req, row.code, t.d, 'inactive'); return fail('cloud_inactive', 403) }
  const len = Number(req.headers.get('content-length') || 0)
  if (len > MAX_BACKUP) return fail('too_large', 413)
  const today = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE kind = 'backup' AND code = ? AND at > ?`).bind(row.code, now - DAY).first<{ n: number }>()
  if ((today?.n ?? 0) >= BACKUPS_PER_DAY) return fail('backup_limit', 429)
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.length === 0) return fail('bad_request')
  if (bytes.length > MAX_BACKUP) return fail('too_large', 413)
  // gzip magic: the app always compresses
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return fail('bad_request', 400, 'الملف ليس مضغوطاً.')
  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(req.headers.get('x-kaseb-meta') || '{}') } catch { meta = {} }
  const safeMeta = {
    counts: meta.counts && typeof meta.counts === 'object' ? meta.counts : {},
    appVersion: clip(meta.appVersion, 20), exportedAt: Number(meta.exportedAt) || now, name: clip(meta.name, 60),
  }
  const id = `${now}-${newCode().slice(0, 6)}`
  await env.BACKUPS.put(backupKey(row.code, id), bytes, { metadata: { at: now, size: bytes.length, device: t.d } })
  await env.DB.prepare('INSERT INTO backups (id, code, device, at, size, meta) VALUES (?, ?, ?, ?, ?, ?)').bind(id, row.code, t.d, now, bytes.length, JSON.stringify(safeMeta)).run()
  // keep only the newest cloud_keep snapshots of this code
  const s = await settings(env)
  const all = await listBackups(env, row.code)
  for (const old of all.slice(Math.max(1, s.cloud_keep))) await deleteBackup(env, old)
  await log(env, 'backup', req, row.code, t.d, `${bytes.length}`)
  return json({ id, at: now, size: bytes.length, kept: Math.min(all.length, Math.max(1, s.cloud_keep)), cloudUntil: row.cloud_until })
}

/** POST /api/backups {token, device} — the snapshots of this license (any of its devices). */
async function backupList(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  if (!b) return fail('bad_request')
  const auth = await cloudAuth(env, b.token, b.device)
  if (typeof auth === 'string') return fail(auth, auth === 'bad_request' ? 400 : 403)
  const rows = await listBackups(env, auth.row.code)
  return json({ backups: rows.map(publicBackup), cloudUntil: auth.row.cloud_until, serverTime: Date.now() })
}

/** POST /api/backup/get {token, device, id} — the compressed file. Allowed after the subscription ended too: the data is the shop's. */
async function backupGet(req: Request, env: Env): Promise<Response> {
  if (!env.BACKUPS) return fail('cloud_unavailable', 503)
  const b = await body(req)
  if (!b) return fail('bad_request')
  const auth = await cloudAuth(env, b.token, b.device)
  if (typeof auth === 'string') return fail(auth, auth === 'bad_request' ? 400 : 403)
  if (await rateLimited(env, req, 'token')) return fail('rate_limited', 429)
  const id = clip(b.id, 40)
  const row = await env.DB.prepare('SELECT * FROM backups WHERE id = ? AND code = ?').bind(id, auth.row.code).first<BackupRow>()
  if (!row) return fail('not_found', 404)
  const bytes = await env.BACKUPS.get(backupKey(row.code, row.id), 'arrayBuffer')
  if (!bytes) return fail('not_found', 404)
  await log(env, 'restore', req, row.code, auth.t.d, row.id)
  return new Response(bytes, { headers: { ...CORS, 'content-type': 'application/octet-stream', 'cache-control': 'no-store', 'x-kaseb-at': String(row.at) } })
}

// ---------- the seller's control panel ----------
//   GET  dashboard                               KPIs, 84 days of activations (30-day bars + 12-week trend), platform split, latest events
//   GET  codes?q&status&plan&cloud&from&to&sort&dir&page&limit     paginated list;  POST codes {count, plan, days, maxDevices, cloudDays, note, seller | device}
//   GET  codes/:code                              the code, its devices, events and backups
//   POST codes/:code/{revoke,unrevoke,extend,note,devices,cloud,backups-delete}
//   GET  devices?q&state&platform&sort&page&limit;  GET devices/:device;  POST devices/:device/{release,grant,block}
//   GET  cloud?status&q&page&limit                subscribers with their backups
//   GET  events?kind&code&device&from&to&page&limit[&format=csv]
//   GET|POST settings;  GET stats (the first panel's summary, kept)
function isAdmin(req: Request, env: Env): boolean {
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return !!env.ADMIN_KEY && key.length === env.ADMIN_KEY.length && sameText(key, env.ADMIN_KEY)
}
const publicCode = <T extends CodeRow>(r: T) => ({ ...r, code: formatCode(r.code) })
const publicDevice = <T extends DeviceRow>(d: T) => ({ ...d, ip: undefined, code: d.code ? formatCode(d.code) : null, blocked: d.blocked ? 1 : 0 })
const expiresArg = (v: unknown): number | null | undefined => {
  if (v === null || v === '' || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}
const intArg = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && v !== null && v !== '' ? Math.max(min, Math.min(max, n)) : fallback
}
/** A query-string time: ms since 1970 or an ISO date; null when absent or unreadable. */
const timeArg = (v: string | null): number | null => {
  if (!v) return null
  const n = Number(v)
  if (Number.isFinite(n) && n > 0) return Math.round(n)
  const d = Date.parse(v)
  return Number.isFinite(d) ? d : null
}
/** The allow-listed SQL for a query-string key; a prototype name ('constructor', '__proto__'…) is not a hit. */
const pick = (table: Record<string, string>, key: string, fallback: string): string => Object.prototype.hasOwnProperty.call(table, key) ? table[key] : fallback
const pageArgs = (url: URL, max = 200, def = 50) => {
  const limit = intArg(url.searchParams.get('limit'), 1, max, def)
  const page = intArg(url.searchParams.get('page'), 1, 100000, 1)
  return { limit, page, offset: (page - 1) * limit }
}
/** CSV with a BOM (Excel opens Arabic correctly); cells that a spreadsheet would run as a formula are prefixed. */
const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csvResponse = (name: string, rows: unknown[][]): Response =>
  new Response('﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), {
    headers: { ...CORS, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' },
  })
const EVENT_KINDS = ['activate', 'activate-fail', 'trial', 'trial-fail', 'check', 'check-fail', 'release', 'admin', 'backup', 'backup-fail', 'restore']
const CODE_STATUS = `CASE WHEN c.revoked = 1 THEN 'revoked' WHEN c.expires_at IS NOT NULL AND c.expires_at <= ? THEN 'expired'
  WHEN EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code) THEN 'active' ELSE 'unused' END`

async function admin(req: Request, env: Env, path: string, url: URL): Promise<Response> {
  if (!isAdmin(req, env)) return fail('unauthorized', 401, 'مفتاح الإدارة غير صحيح.')
  const now = Date.now()
  const seg = path.split('/').filter(Boolean)   // e.g. ['codes', 'ABCD…', 'revoke']
  const qs = (k: string) => (url.searchParams.get(k) || '').trim()

  if (seg[0] === 'dashboard' && req.method === 'GET') {
    const d = new Date(now)
    const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    const today = Math.floor(now / DAY) * DAY
    const from = today - 83 * DAY              // 12 weeks of days: the 30-day bars and the 12-week trend come from one query
    const soon = now + 30 * DAY
    type Codes = { total: number; active: number | null; unused: number | null; revoked: number | null; expired: number | null; cloud_active: number | null; cloud_soon: number | null; cloud_ended: number | null }
    type Devices = { total: number; seen24: number | null; seen7: number | null; trials: number | null; trial_total: number | null; converted: number | null; blocked: number | null; licensed: number | null }
    type Month = { sold: number; fails24: number }
    type Day = { day: number; binds: number; trials: number }
    type Plat = { platform: string; n: number; licensed: number | null; trials: number | null }
    type Storage = { n: number; bytes: number }
    const [codes, devices, month, byDay, plats, recent, cloudSoon, storage] = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) AS total,
        SUM(c.revoked = 0 AND (c.expires_at IS NULL OR c.expires_at > ?1) AND EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code)) AS active,
        SUM(c.revoked = 0 AND (c.expires_at IS NULL OR c.expires_at > ?1) AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code)) AS unused,
        SUM(c.revoked) AS revoked, SUM(c.revoked = 0 AND c.expires_at IS NOT NULL AND c.expires_at <= ?1) AS expired,
        SUM(c.cloud_until > ?1) AS cloud_active, SUM(c.cloud_until > ?1 AND c.cloud_until <= ?2) AS cloud_soon,
        SUM(c.cloud_until IS NOT NULL AND c.cloud_until <= ?1) AS cloud_ended FROM codes c`).bind(now, soon),
      env.DB.prepare(`SELECT COUNT(*) AS total, SUM(last_seen > ?1) AS seen24, SUM(last_seen > ?2) AS seen7,
        SUM(code IS NULL AND trial_started IS NOT NULL AND trial_ends > ?3) AS trials, SUM(trial_started IS NOT NULL) AS trial_total,
        SUM(trial_started IS NOT NULL AND code IS NOT NULL) AS converted, SUM(blocked = 1) AS blocked, SUM(code IS NOT NULL) AS licensed FROM devices`).bind(now - DAY, now - 7 * DAY, now),
      env.DB.prepare(`SELECT (SELECT COUNT(DISTINCT code) FROM events WHERE kind = 'activate' AND detail = 'bind' AND at >= ?1) AS sold,
        (SELECT COUNT(*) FROM events WHERE kind IN ('activate-fail', 'trial-fail', 'check-fail') AND at > ?2) AS fails24`).bind(monthStart, now - DAY),
      env.DB.prepare(`SELECT (at / ${DAY}) * ${DAY} AS day, SUM(kind = 'activate' AND detail = 'bind') AS binds, SUM(kind = 'trial') AS trials
        FROM events WHERE at >= ? AND kind IN ('activate', 'trial') GROUP BY day`).bind(from),
      env.DB.prepare(`SELECT platform, COUNT(*) AS n, SUM(code IS NOT NULL) AS licensed, SUM(code IS NULL AND trial_ends > ?) AS trials FROM devices GROUP BY platform`).bind(now),
      env.DB.prepare(`SELECT e.id, e.at, e.kind, e.code, e.device, e.detail, d.device_code, d.name, d.platform FROM events e LEFT JOIN devices d ON d.device = e.device
        WHERE e.kind != 'check' ORDER BY e.id DESC LIMIT 30`),
      env.DB.prepare(`SELECT code, note, cloud_until FROM codes WHERE cloud_until > ?1 AND cloud_until <= ?2 ORDER BY cloud_until ASC LIMIT 8`).bind(now, soon),
      env.DB.prepare('SELECT COUNT(*) AS n, IFNULL(SUM(size), 0) AS bytes FROM backups'),
    ])
    const c = (codes.results[0] ?? {}) as Partial<Codes>, dv = (devices.results[0] ?? {}) as Partial<Devices>, m = (month.results[0] ?? {}) as Partial<Month>
    const dayRows = byDay.results as Day[]
    const days = Array.from({ length: 84 }, (_, i) => { const day = from + i * DAY; const r = dayRows.find(x => x.day === day); return { day, binds: r?.binds ?? 0, trials: r?.trials ?? 0 } })
    const weeks = Array.from({ length: 12 }, (_, i) => { const part = days.slice(i * 7, i * 7 + 7); return { from: part[0].day, binds: part.reduce((s, x) => s + x.binds, 0), trials: part.reduce((s, x) => s + x.trials, 0) } })
    const trialTotal = dv.trial_total ?? 0
    return json({
      now,
      kpis: {
        active: c.active ?? 0, unused: c.unused ?? 0, revoked: c.revoked ?? 0, expired: c.expired ?? 0, codes: c.total ?? 0,
        soldMonth: m.sold ?? 0, trials: dv.trials ?? 0, conversion: trialTotal ? Math.round(((dv.converted ?? 0) / trialTotal) * 100) : null, trialTotal, converted: dv.converted ?? 0,
        seen24: dv.seen24 ?? 0, seen7: dv.seen7 ?? 0, devices: dv.total ?? 0, licensed: dv.licensed ?? 0, blocked: dv.blocked ?? 0,
        cloud: c.cloud_active ?? 0, cloudSoon: c.cloud_soon ?? 0, cloudEnded: c.cloud_ended ?? 0, fails24: m.fails24 ?? 0,
        backups: (storage.results[0] as Storage | undefined)?.n ?? 0, bytes: (storage.results[0] as Storage | undefined)?.bytes ?? 0,
      },
      days: days.slice(-30), weeks,
      platforms: (plats.results as Plat[]).map(p => ({ platform: p.platform || 'web', n: p.n, licensed: p.licensed ?? 0, trials: p.trials ?? 0 })),
      recent: (recent.results as Record<string, unknown>[]).map(r => ({ ...r, code: r.code ? formatCode(String(r.code)) : null, device: undefined })),
      cloudSoon: (cloudSoon.results as { code: string; note: string; cloud_until: number }[]).map(r => ({ ...r, code: formatCode(r.code) })),
    })
  }

  if (seg[0] === 'stats' && req.method === 'GET') {
    const week = now - 7 * DAY
    const codes = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(revoked) AS revoked,
      SUM(EXISTS (SELECT 1 FROM devices d WHERE d.code = codes.code)) AS activated FROM codes`).first<{ total: number; revoked: number | null; activated: number | null }>()
    const devices = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(last_seen > ?) AS active7, SUM(code IS NOT NULL) AS licensed,
      SUM(code IS NULL AND trial_started IS NOT NULL AND trial_ends > ?) AS trials FROM devices`).bind(week, now).first<{ total: number; active7: number | null; licensed: number | null; trials: number | null }>()
    const weekAct = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE kind = 'activate' AND detail = 'bind' AND at > ?`).bind(week).first<{ n: number }>()
    const cloud = await env.DB.prepare(`SELECT SUM(cloud_until > ?) AS active, SUM(cloud_until IS NOT NULL AND cloud_until <= ?) AS ended FROM codes`).bind(now, now).first<{ active: number | null; ended: number | null }>()
    const storage = await env.DB.prepare('SELECT COUNT(*) AS n, IFNULL(SUM(size), 0) AS bytes FROM backups').first<{ n: number; bytes: number }>()
    return json({
      codes: { total: codes?.total ?? 0, activated: codes?.activated ?? 0, revoked: codes?.revoked ?? 0 },
      devices: { total: devices?.total ?? 0, active7: devices?.active7 ?? 0, licensed: devices?.licensed ?? 0, trials: devices?.trials ?? 0 },
      cloud: { active: cloud?.active ?? 0, ended: cloud?.ended ?? 0, backups: storage?.n ?? 0, bytes: storage?.bytes ?? 0 },
      activationsWeek: weekAct?.n ?? 0,
    })
  }

  if (seg[0] === 'codes' && seg.length === 1 && req.method === 'POST') {
    const b = await body(req)
    if (!b) return fail('bad_request')
    const count = intArg(b.count, 1, 200, 1)
    const maxDevices = intArg(b.maxDevices, 1, 5, 1)
    // plan: 'lifetime' (default) or 'subscription' with {days} (or an explicit expiresAt, the first panel's way)
    let expires: number | null | undefined
    if (b.plan === 'subscription') {
      const days = intArg(b.days, 0, 3650, 0)
      expires = days ? now + days * DAY : expiresArg(b.expiresAt)
      if (!expires) return fail('bad_request', 400, 'مدة الاشتراك غير صحيحة.')
    } else expires = expiresArg(b.expiresAt)
    if (expires === undefined) return fail('bad_request', 400, 'تاريخ الانتهاء غير صحيح.')
    const note = clip(b.note, 200), seller = clip(b.seller, 80)
    const device = validDevice(b.device) ? b.device : null   // "منح كود": the code is made for one device and bound to it at once
    if (device) {
      const me = await getDevice(env, device)
      if (!me) return fail('not_found', 404, 'الجهاز غير موجود.')
    }
    const cloudDays = intArg(b.cloudDays, 0, 3650, 0)
    const cloudUntil = cloudDays ? now + cloudDays * DAY : null
    const codes: string[] = []
    while (codes.length < (device ? 1 : count)) { const c = newCode(); if (!codes.includes(c)) codes.push(c) }
    const plan = expires ? 'sub' : 'full'
    const stmts = codes.map(c => env.DB.prepare('INSERT INTO codes (code, plan, created_at, expires_at, max_devices, note, seller, cloud_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(c, plan, now, expires, maxDevices, note, seller, cloudUntil))
    if (device) stmts.push(env.DB.prepare('UPDATE devices SET code = ?, bound_at = ? WHERE device = ?').bind(codes[0], now, device))
    await env.DB.batch(stmts)
    await log(env, 'admin', req, device ? codes[0] : null, device, device ? 'grant' : `created ${codes.length}`)
    return json({ codes: codes.map(formatCode), expiresAt: expires, maxDevices, cloudUntil, note, seller, createdAt: now })
  }

  if (seg[0] === 'codes' && seg.length === 1 && req.method === 'GET') {
    const raw = qs('q')
    const where: string[] = [], args: unknown[] = []
    if (raw) {
      const q = `%${raw}%`, qCode = `%${raw.replace(/[-\s]/g, '').toUpperCase()}%`
      where.push(`(c.code LIKE ? OR c.note LIKE ? OR c.seller LIKE ? OR EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code AND (REPLACE(d.device_code, '-', '') LIKE ? OR d.name LIKE ?)))`)
      args.push(qCode, q, q, qCode, q)
    }
    const status = qs('status')
    if (status === 'unused' || status === 'new') { where.push('c.revoked = 0 AND (c.expires_at IS NULL OR c.expires_at > ?) AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code)'); args.push(now) }
    if (status === 'active' || status === 'used') { where.push('c.revoked = 0 AND (c.expires_at IS NULL OR c.expires_at > ?) AND EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code)'); args.push(now) }
    if (status === 'revoked') where.push('c.revoked = 1')
    if (status === 'expired') { where.push('c.revoked = 0 AND c.expires_at IS NOT NULL AND c.expires_at <= ?'); args.push(now) }
    const plan = qs('plan')
    if (plan === 'lifetime') where.push('c.expires_at IS NULL')
    if (plan === 'subscription') where.push('c.expires_at IS NOT NULL')
    const cloud = qs('cloud')
    if (cloud === 'active') { where.push('c.cloud_until > ?'); args.push(now) }
    if (cloud === 'expired') { where.push('c.cloud_until IS NOT NULL AND c.cloud_until <= ?'); args.push(now) }
    if (cloud === 'none') where.push('c.cloud_until IS NULL')
    const from = timeArg(url.searchParams.get('from')), to = timeArg(url.searchParams.get('to'))
    if (from) { where.push('c.created_at >= ?'); args.push(from) }
    if (to) { where.push('c.created_at <= ?'); args.push(to) }
    const SORT: Record<string, string> = { created: 'c.created_at', expires: 'c.expires_at', cloud: 'c.cloud_until', devices: 'devices', last_seen: 'last_seen', note: 'c.note', code: 'c.code' }
    const sort = pick(SORT, qs('sort'), 'c.created_at')
    const dir = qs('dir') === 'asc' ? 'ASC' : 'DESC'
    const { limit, page, offset } = pageArgs(url)
    const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [rows, total] = await env.DB.batch([
      env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM devices d WHERE d.code = c.code) AS devices,
        (SELECT MAX(last_seen) FROM devices d WHERE d.code = c.code) AS last_seen, ${CODE_STATUS} AS status FROM codes c ${cond}
        ORDER BY ${sort} ${dir} NULLS LAST, c.created_at DESC LIMIT ? OFFSET ?`).bind(now, ...args, limit, offset),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM codes c ${cond}`).bind(...args),
    ])
    return json({ codes: (rows.results as (CodeRow & { devices: number; last_seen: number | null; status: string })[]).map(publicCode), total: (total.results[0] as { n: number } | undefined)?.n ?? 0, page, limit, now })
  }

  if (seg[0] === 'codes' && seg.length >= 2) {
    const code = cleanCode(seg[1])
    const row = code ? await getCode(env, code) : null
    if (!code || !row) return fail('not_found', 404, 'الكود غير موجود.')
    if (seg.length === 2 && req.method === 'GET') {
      const devices = await env.DB.prepare('SELECT * FROM devices WHERE code = ? ORDER BY bound_at DESC').bind(code).all<DeviceRow>()
      const events = await env.DB.prepare(`SELECT e.id, e.at, e.kind, e.detail, d.device_code, d.name, d.platform FROM events e LEFT JOIN devices d ON d.device = e.device
        WHERE e.code = ? ORDER BY e.id DESC LIMIT 80`).bind(code).all()
      const backups = (await listBackups(env, code)).map(publicBackup)
      return json({ code: publicCode(row), devices: devices.results.map(publicDevice), events: events.results, backups, now })
    }
    if (seg.length === 3 && req.method === 'POST') {
      const act = seg[2]
      const b = (await body(req)) ?? {}
      if (act === 'revoke') await env.DB.prepare('UPDATE codes SET revoked = 1 WHERE code = ?').bind(code).run()
      else if (act === 'unrevoke') await env.DB.prepare('UPDATE codes SET revoked = 0 WHERE code = ?').bind(code).run()
      else if (act === 'extend') {
        // { expiresAt: ms | null } sets the expiry (null = lifetime); { addDays: n } extends from today or from the current expiry
        let expires: number | null | undefined
        if (b.addDays !== undefined) {
          const days = intArg(b.addDays, 0, 3650, 0)
          if (!days) return fail('bad_request', 400, 'عدد الأيام غير صحيح.')
          expires = (row.expires_at && row.expires_at > now ? row.expires_at : now) + days * DAY
        } else expires = expiresArg(b.expiresAt)
        if (expires === undefined) return fail('bad_request', 400, 'تاريخ الانتهاء غير صحيح.')
        await env.DB.prepare('UPDATE codes SET expires_at = ?, plan = ? WHERE code = ?').bind(expires, expires ? 'sub' : 'full', code).run()
      }
      else if (act === 'note') {
        const n = b.maxDevices === undefined ? row.max_devices : intArg(b.maxDevices, 1, 5, 0)
        if (!n) return fail('bad_request', 400, 'عدد الأجهزة بين 1 و5.')
        await env.DB.prepare('UPDATE codes SET note = ?, seller = ?, max_devices = ? WHERE code = ?').bind(clip(b.note ?? row.note, 200), clip(b.seller ?? row.seller, 80), n, code).run()
      }
      else if (act === 'devices') {
        const n = intArg(b.maxDevices, 1, 5, 0)
        if (!n) return fail('bad_request', 400, 'عدد الأجهزة بين 1 و5.')
        await env.DB.prepare('UPDATE codes SET max_devices = ? WHERE code = ?').bind(n, code).run()
      }
      else if (act === 'cloud') {
        // { until: ms } sets the end of the cloud subscription; { addDays: n } extends it from today or from its current end; { until: null } stops it
        let until: number | null
        if (b.until === null) until = null
        else if (b.addDays !== undefined) {
          const days = intArg(b.addDays, 0, 3650, 0)
          if (!days) return fail('bad_request', 400, 'عدد الأيام غير صحيح.')
          const base = row.cloud_until && row.cloud_until > now ? row.cloud_until : now
          until = base + days * DAY
        } else {
          const u = expiresArg(b.until)
          if (u === undefined) return fail('bad_request', 400, 'التاريخ غير صحيح.')
          until = u
        }
        await env.DB.prepare('UPDATE codes SET cloud_until = ? WHERE code = ?').bind(until, code).run()
      }
      else if (act === 'backups-delete') {
        for (const bk of await listBackups(env, code)) await deleteBackup(env, bk)
      }
      else return fail('not_found', 404)
      await log(env, 'admin', req, code, null, act)
      return json({ ok: true, code: publicCode((await getCode(env, code))!) })
    }
  }

  if (seg[0] === 'devices' && seg.length === 1 && req.method === 'GET') {
    const raw = qs('q')
    const where: string[] = [], args: unknown[] = []
    if (raw) {
      const q = `%${raw}%`, qCode = `%${raw.replace(/[-\s]/g, '').toUpperCase()}%`
      where.push(`(REPLACE(d.device_code, '-', '') LIKE ? OR d.name LIKE ? OR IFNULL(d.code, '') LIKE ? OR d.version LIKE ?)`)
      args.push(qCode, q, qCode, q)
    }
    const state = qs('state')
    if (state === 'licensed') where.push('d.code IS NOT NULL')
    if (state === 'trial') { where.push('d.code IS NULL AND d.trial_ends > ?'); args.push(now) }
    if (state === 'expired') { where.push('d.code IS NULL AND d.trial_started IS NOT NULL AND d.trial_ends <= ?'); args.push(now) }
    if (state === 'free') where.push('d.code IS NULL AND d.trial_started IS NULL')
    if (state === 'blocked') where.push('d.blocked = 1')
    const platform = qs('platform')
    if (validPlatform(platform)) { where.push('d.platform = ?'); args.push(platform) }
    const SORT: Record<string, string> = { last_seen: 'd.last_seen', first_seen: 'd.first_seen', name: 'd.name', trial_ends: 'd.trial_ends' }
    const sort = pick(SORT, qs('sort'), 'd.last_seen')
    const dir = qs('dir') === 'asc' ? 'ASC' : 'DESC'
    const { limit, page, offset } = pageArgs(url)
    const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [rows, total] = await env.DB.batch([
      env.DB.prepare(`SELECT d.*, c.revoked AS code_revoked, c.expires_at AS code_expires, c.cloud_until AS code_cloud FROM devices d LEFT JOIN codes c ON c.code = d.code
        ${cond} ORDER BY ${sort} ${dir} NULLS LAST, d.last_seen DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM devices d ${cond}`).bind(...args),
    ])
    return json({ devices: (rows.results as (DeviceRow & { code_revoked: number | null; code_expires: number | null; code_cloud: number | null })[]).map(publicDevice), total: (total.results[0] as { n: number } | undefined)?.n ?? 0, page, limit, now })
  }

  if (seg[0] === 'devices' && seg.length >= 2) {
    const device = seg[1]
    const me = validDevice(device) ? await getDevice(env, device) : null
    if (!me) return fail('not_found', 404, 'الجهاز غير موجود.')
    if (seg.length === 2 && req.method === 'GET') {
      const row = me.code ? await getCode(env, me.code) : null
      const events = await env.DB.prepare('SELECT id, at, kind, code, detail FROM events WHERE device = ? ORDER BY id DESC LIMIT 80').bind(device).all()
      return json({ device: publicDevice(me), code: row ? publicCode(row) : null, events: events.results.map(r => ({ ...r, code: r.code ? formatCode(String(r.code)) : null })), now })
    }
    if (seg.length === 3 && req.method === 'POST') {
      const act = seg[2]
      const b = (await body(req)) ?? {}
      if (act === 'release') {
        await env.DB.prepare('UPDATE devices SET code = NULL, bound_at = NULL WHERE device = ?').bind(device).run()
        await log(env, 'admin', req, me.code, device, 'release')
        return json({ ok: true })
      }
      if (act === 'grant') {
        // bind an existing code to this device: it must be usable and have a free slot (the device's current code is released first)
        const code = cleanCode(b.code)
        const row = code ? await getCode(env, code) : null
        const why = refuseCode(row, now)
        if (!code || !row || why) return fail(why ?? 'invalid_code', 400, why ? MESSAGES[why] : 'الكود غير موجود.')
        if (me.code !== code && (await boundCount(env, code)) >= row.max_devices) return fail('device_limit', 400, 'لا يوجد مكان شاغر في هذا الكود. زد عدد الأجهزة أو حرّر جهازاً.')
        await env.DB.prepare('UPDATE devices SET code = ?, bound_at = ? WHERE device = ?').bind(code, now, device).run()
        await log(env, 'admin', req, code, device, 'grant')
        return json({ ok: true, code: formatCode(code) })
      }
      if (act === 'block') {
        const blocked = b.blocked ? 1 : 0
        await env.DB.prepare('UPDATE devices SET blocked = ? WHERE device = ?').bind(blocked, device).run()
        await log(env, 'admin', req, me.code, device, blocked ? 'block' : 'unblock')
        return json({ ok: true, blocked })
      }
      return fail('not_found', 404)
    }
  }

  if (seg[0] === 'cloud' && seg.length === 1 && req.method === 'GET') {
    const raw = qs('q')
    const where: string[] = ['c.cloud_until IS NOT NULL'], args: unknown[] = []
    if (raw) {
      const q = `%${raw}%`, qCode = `%${raw.replace(/[-\s]/g, '').toUpperCase()}%`
      where.push('(c.code LIKE ? OR c.note LIKE ? OR c.seller LIKE ?)'); args.push(qCode, q, q)
    }
    const status = qs('status') || 'active'
    if (status === 'active') { where.push('c.cloud_until > ?'); args.push(now) }
    if (status === 'expiring') { where.push('c.cloud_until > ? AND c.cloud_until <= ?'); args.push(now, now + 30 * DAY) }
    if (status === 'ended') { where.push('c.cloud_until <= ?'); args.push(now) }
    const { limit, page, offset } = pageArgs(url)
    const cond = `WHERE ${where.join(' AND ')}`
    const [rows, total, summary] = await env.DB.batch([
      env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM backups b WHERE b.code = c.code) AS backups, (SELECT MAX(at) FROM backups b WHERE b.code = c.code) AS last_backup,
        (SELECT IFNULL(SUM(size), 0) FROM backups b WHERE b.code = c.code) AS bytes, (SELECT COUNT(*) FROM devices d WHERE d.code = c.code) AS devices
        FROM codes c ${cond} ORDER BY c.cloud_until ${status === 'ended' ? 'DESC' : 'ASC'} LIMIT ? OFFSET ?`).bind(...args, limit, offset),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM codes c ${cond}`).bind(...args),
      env.DB.prepare(`SELECT SUM(cloud_until > ?1) AS active, SUM(cloud_until > ?1 AND cloud_until <= ?2) AS soon, SUM(cloud_until IS NOT NULL AND cloud_until <= ?1) AS ended,
        (SELECT COUNT(*) FROM backups) AS backups, (SELECT IFNULL(SUM(size), 0) FROM backups) AS bytes FROM codes`).bind(now, now + 30 * DAY),
    ])
    const s = (summary.results[0] ?? {}) as { active?: number | null; soon?: number | null; ended?: number | null; backups?: number; bytes?: number }
    return json({
      rows: (rows.results as (CodeRow & { backups: number; last_backup: number | null; bytes: number; devices: number })[]).map(publicCode),
      total: (total.results[0] as { n: number } | undefined)?.n ?? 0, page, limit, now,
      summary: { active: s.active ?? 0, soon: s.soon ?? 0, ended: s.ended ?? 0, backups: s.backups ?? 0, bytes: s.bytes ?? 0, available: !!env.BACKUPS },
    })
  }

  if (seg[0] === 'events' && req.method === 'GET') {
    const where: string[] = [], args: unknown[] = []
    const kind = qs('kind')
    if (EVENT_KINDS.includes(kind)) { where.push('e.kind = ?'); args.push(kind) }
    else if (kind === 'fail') where.push(`e.kind IN ('activate-fail', 'trial-fail', 'check-fail', 'backup-fail')`)
    else if (kind === 'nocheck') where.push(`e.kind != 'check'`)
    const code = cleanCode(qs('code'))
    if (qs('code') && !code) return json({ events: [], total: 0, page: 1, limit: 50, now })
    if (code) { where.push('e.code = ?'); args.push(code) }
    const dev = qs('device'), short = dev.replace(/[-\s]/g, '').toUpperCase()   // a device hash, or the short code the customer reads out
    if (dev) {
      if (validDevice(dev)) { where.push('e.device = ?'); args.push(dev) }
      else { where.push(`e.device IN (SELECT device FROM devices WHERE REPLACE(device_code, '-', '') = ?)`); args.push(short) }
    }
    const from = timeArg(url.searchParams.get('from')), to = timeArg(url.searchParams.get('to'))
    if (from) { where.push('e.at >= ?'); args.push(from) }
    if (to) { where.push('e.at <= ?'); args.push(to) }
    const cond = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const select = `SELECT e.id, e.at, e.kind, e.code, e.detail, d.device_code, d.name, d.platform FROM events e LEFT JOIN devices d ON d.device = e.device ${cond} ORDER BY e.id DESC`
    if (qs('format') === 'csv') {
      const rows = await env.DB.prepare(`${select} LIMIT 5000`).bind(...args).all<{ id: number; at: number; kind: string; code: string | null; detail: string | null; device_code: string | null; name: string | null; platform: string | null }>()
      return csvResponse(`kaseb-events-${new Date(now).toISOString().slice(0, 10)}.csv`, [
        ['id', 'time', 'kind', 'code', 'device', 'name', 'platform', 'detail'],
        ...rows.results.map(r => [r.id, new Date(r.at).toISOString(), r.kind, r.code ? formatCode(r.code) : '', r.device_code ?? '', r.name ?? '', r.platform ?? '', r.detail ?? '']),
      ])
    }
    const { limit, page, offset } = pageArgs(url)
    const [rows, total] = await env.DB.batch([
      env.DB.prepare(`${select} LIMIT ? OFFSET ?`).bind(...args, limit, offset),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM events e ${cond}`).bind(...args),
    ])
    return json({ events: (rows.results as Record<string, unknown>[]).map(r => ({ ...r, code: r.code ? formatCode(String(r.code)) : null })), total: (total.results[0] as { n: number } | undefined)?.n ?? 0, page, limit, now })
  }

  if (seg[0] === 'settings') {
    if (req.method === 'POST') {
      const b = await body(req)
      if (!b) return fail('bad_request')
      const cur = await settings(env)
      const v = (k: keyof Settings): unknown => (b[k] === undefined ? cur[k] : b[k])   // a key the body leaves out keeps its value
      const put = (k: string, v: string) => env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v)
      const num = (v: unknown, max: number, fallback: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? String(Math.max(0, Math.min(max, n))) : String(fallback) }
      await env.DB.batch([
        put('price', clip(v('price'), 40) || DEFAULTS.price),
        put('whatsapp', clip(v('whatsapp'), 20).replace(/\D/g, '')),
        put('trial_days', num(v('trial_days'), 365, DEFAULTS.trial_days)),
        put('grace_days', num(v('grace_days'), 365, DEFAULTS.grace_days)),
        put('min_version', clip(v('min_version'), 20).replace(/[^0-9.]/g, '')),
        // one or more SHA-256 fingerprints: anything that is not 64 hex digits is dropped (a stray entry would refuse every Android build)
        put('android_signature', clip(v('android_signature'), 2000).toLowerCase().split(',').map(x => x.replace(/[^0-9a-f]/g, '')).filter(x => x.length === 64).join(',')),
        put('message', clip(v('message'), 400)),
        put('cloud_price', clip(v('cloud_price'), 40) || DEFAULTS.cloud_price),
        put('cloud_days', num(v('cloud_days'), 3650, DEFAULTS.cloud_days)),
        put('cloud_keep', num(v('cloud_keep'), 10, DEFAULTS.cloud_keep)),
        put('apk_url', safeUrl(v('apk_url'))),
        put('win_url', safeUrl(v('win_url'))),
        put('web_trial', v('web_trial') ? '1' : '0'),
      ])
      await log(env, 'admin', req, null, null, 'settings')
    }
    return json({ ...(await settings(env)), cloudAvailable: !!env.BACKUPS })
  }

  return fail('not_found', 404)
}

// ---------- pages ----------
const PRIVACY = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>الخصوصية — كاسب</title><style>body{margin:0;background:#f3f5f9;color:#0f172a;font:16px/1.8 system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:24px 18px}
section{background:#fff;border:1px solid #e3e8f0;border-radius:14px;padding:16px 18px;margin-bottom:14px}h1{font-size:22px}h2{font-size:17px;margin:0 0 6px}
@media (prefers-color-scheme:dark){body{background:#0b1220;color:#e8eef8}section{background:#121b2d;border-color:#243149}}</style></head><body><main>
<h1>سياسة الخصوصية — كاسب</h1>
<section><h2>ما الذي يصل إلى الخادم</h2><p>كاسب يعمل بالكامل على جهازك: المنتجات والفواتير والعملاء والورديات تبقى على الجهاز ولا تُرسل إلى أي مكان.
الاتصال الوحيد بالإنترنت هو التحقق من الترخيص، ويُرسل فيه: معرّف مشفّر للجهاز (لا يمكن الرجوع منه إلى المعرّف الأصلي)، واسم الجهاز ونوعه، وإصدار التطبيق، وكود التفعيل الذي أدخلته، وعنوان IP ووقت الطلب.</p></section>
<section><h2>لماذا</h2><p>لربط كود التفعيل بجهازك، والتحقق دورياً من أن الترخيص ما زال سارياً، ونقله إلى جهاز آخر عند الحاجة، ومنع التلاعب.</p></section>
<section><h2>المشاركة</h2><p>لا نبيع البيانات ولا نشاركها مع أي جهة، ولا توجد إعلانات ولا أدوات تتبّع. الخادم مستضاف لدى Cloudflare، وتُحذف سجلات الأمان بعد سنة على الأكثر.</p></section>
</main></body></html>`

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname.replace(/\/+$/, '') || '/'
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    try {
      if (p === '/') return html(renderLanding(await settings(env)))
      if (p === '/privacy') return html(PRIVACY)
      if (p === '/admin') return html(ADMIN_PAGE)
      if (p === '/panel' || p === '/login' || p === '/dashboard') return Response.redirect(new URL('/admin', url).toString(), 302)
      if (p === '/download/android' || p === '/download/apk') { const s = await settings(env); return Response.redirect(s.apk_url || new URL('/download/Kaseb.apk', url).toString(), 302) }
      if (p === '/download/windows' || p === '/download/win') {
        const s = await settings(env)
        return Response.redirect(s.win_url || waLink(s.whatsapp, 'مرحباً، أريد نسخة ويندوز من برنامج كاسب'), 302)
      }
      await ensureSchema(env)
      if (p.startsWith('/admin/api/')) return await admin(req, env, p.slice('/admin/api/'.length), url)
      if (p.startsWith('/api/')) {
        if (p === '/api/info' && req.method === 'GET') return json(info(await settings(env)))
        if (!env.LICENSE_SECRET) return fail('not_configured', 500)
        if (p === '/api/public-key' && req.method === 'GET') return json({ publicKey: await publicKeyHex(env.LICENSE_SECRET) })
        if (req.method !== 'POST') return fail('not_found', 404)
        if (p === '/api/backup') return await backupUpload(req, env)      // binary body
        if (!/^application\/json/i.test(req.headers.get('content-type') || '')) return fail('bad_request', 400, 'JSON only.')
        if (p === '/api/backups') return await backupList(req, env)
        if (p === '/api/backup/get') return await backupGet(req, env)
        if (p === '/api/activate') return await activate(req, env)
        if (p === '/api/trial') return await trial(req, env)
        if (p === '/api/check') return await check(req, env)
        if (p === '/api/release') return await release(req, env)
      }
      return fail('not_found', 404, 'لا يوجد.')
    } catch (e) {
      // the exception text (SQL, binding names…) is for the seller's panel only; an anonymous caller gets the key alone
      return fail('server_error', 500, isAdmin(req, env) ? `خطأ في الخادم: ${(e as Error).message}` : 'خطأ في الخادم.')
    }
  },

  /** Nightly (wrangler.toml [triggers]): drops events older than a year, as the privacy page promises. */
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await env.DB.prepare('DELETE FROM events WHERE at < ?').bind(Date.now() - EVENTS_KEEP).run()
  },
}
