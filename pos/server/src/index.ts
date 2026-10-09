// Kaseb license server: online activation, periodic verification and the seller's codes page.
//
//   GET  /api/info                                   price, WhatsApp, trial days… for the activation screen
//   GET  /api/public-key                             the Ed25519 public key the app is built with
//   POST /api/activate  {code, device, …, nonce}     bind a code to this device → signed token
//   POST /api/trial     {device, …, nonce}           one free trial per device → signed token
//   POST /api/check     {token, device, …, nonce}    every 6 hours: still valid? → fresh token
//   POST /api/release   {token, device}              unbind this device so the code can move
//   GET  /admin  +  /admin/api/*  (Bearer ADMIN_KEY) the seller's codes page and its API
//   GET  /privacy, GET /
// Every error is { error: '<key>', message?: '<Arabic>' } with status 400 / 403 / 429.
import { ADMIN_PAGE } from './admin'
import {
  DAY, SRV, type TokenPayload, cleanCode, formatCode, newCode, validDevice, validNonce, validPlatform, deviceCodeOf, clip,
  sameText, publicKeyHex, signToken, verifyToken, compareVersions,
} from './license'

export interface Env {
  DB: D1Database
  LICENSE_SECRET: string
  ADMIN_KEY: string
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
}
const RATE_WINDOW = 10 * 60000   // 30 activate/trial requests per 10 minutes per address
const RATE_LIMIT = 30
const MAX_BODY = 8 * 1024
const MAX_SELF_MOVES = 3

export type CodeRow = {
  code: string; plan: string; created_at: number; expires_at: number | null; max_devices: number
  note: string; seller: string; revoked: number; moves: number
}
export type DeviceRow = {
  device: string; device_code: string; name: string; platform: string; version: string; build: string; sig: string
  code: string | null; bound_at: number | null; trial_started: number | null; trial_ends: number | null
  first_seen: number; last_seen: number; ip: string | null
}
type Settings = { price: string; whatsapp: string; trial_days: number; grace_days: number; min_version: string; android_signature: string; message: string }
const DEFAULTS: Settings = { price: '35$', whatsapp: '', trial_days: 7, grace_days: 10, min_version: '', android_signature: '', message: '' }

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
  invalid_token: 'بيانات الترخيص غير صالحة. فعّل التطبيق من جديد.',
  device_mismatch: 'الترخيص مرتبط بجهاز آخر.',
  move_limit: 'استُنفدت مرات النقل الذاتي. اطلب من البائع نقل الترخيص.',
  bad_request: 'طلب غير مفهوم.',
  not_configured: 'الخادم غير مهيّأ بعد (LICENSE_SECRET).',
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
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

async function settings(env: Env): Promise<Settings> {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const s: Settings = { ...DEFAULTS }
  for (const r of rows.results) {
    if (r.key === 'trial_days' || r.key === 'grace_days') { const n = Number(r.value); if (Number.isFinite(n)) s[r.key] = Math.max(0, Math.round(n)) }
    else if (r.key in s) (s as unknown as Record<string, string>)[r.key] = r.value
  }
  return s
}
const info = (s: Settings) => ({ price: s.price || DEFAULTS.price, whatsapp: s.whatsapp.replace(/\D/g, ''), trialDays: s.trial_days, message: s.message, minVersion: s.min_version, graceDays: s.grace_days })

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

async function rateLimited(env: Env, req: Request): Promise<boolean> {
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE ip = ? AND at > ? AND kind IN ('activate', 'activate-fail', 'trial', 'trial-fail')`)
    .bind(ip(req), Date.now() - RATE_WINDOW).first<{ n: number }>()
  return (r?.n ?? 0) >= RATE_LIMIT
}

/** Why a code cannot be used right now, or null. */
function refuseCode(row: CodeRow | null, now: number): 'invalid_code' | 'revoked' | 'expired' | null {
  if (!row) return 'invalid_code'
  if (row.revoked) return 'revoked'
  if (row.expires_at !== null && row.expires_at <= now) return 'expired'
  return null
}

async function issue(env: Env, s: Settings, c: Client, plan: 'full' | 'trial', code: string, exp: number | null, now: number) {
  const payload: TokenPayload = { v: 1, code, d: c.device, p: plan, iat: now, exp, gr: now + s.grace_days * DAY, n: c.nonce, srv: SRV }
  const token = await signToken(env.LICENSE_SECRET, payload)
  return json({ token, status: { plan, expiresAt: exp, graceUntil: payload.gr, serverTime: now, code: code ? formatCode(code) : '' } })
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
  return issue(env, s, c, 'full', row.code, row.expires_at, now)
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
  await touchDevice(env, req, c, now)
  const me = await getDevice(env, c.device)
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
  if (t.d !== c.device) { await log(env, 'check-fail', req, t.code, c.device, 'device_mismatch'); return fail('device_mismatch', 403) }
  const now = Date.now()
  const s = await settings(env)
  const bad = refuseBuild(s, c)
  if (bad) { await log(env, 'check-fail', req, t.code, c.device, bad); return fail(bad, 403) }
  await touchDevice(env, req, c, now)
  const me = await getDevice(env, c.device)
  if (!me) return fail('invalid_token', 403)
  // a licensed device: the code must still be bound to it and usable
  if (t.p === 'full') {
    const row = await getCode(env, t.code)
    const why = refuseCode(row, now)
    if (why || !row) { await log(env, 'check-fail', req, t.code, c.device, why ?? 'invalid_code'); return fail(why === 'invalid_code' || !why ? 'invalid_token' : why, 403) }
    if (me.code !== row.code) { await log(env, 'check-fail', req, t.code, c.device, 'device_mismatch'); return fail('device_mismatch', 403) }
    await log(env, 'check', req, row.code, c.device)
    return issue(env, s, c, 'full', row.code, row.expires_at, now)
  }
  // a trial device: if the seller granted it a code meanwhile, the code wins and the app upgrades itself
  if (me.code) {
    const row = await getCode(env, me.code)
    if (row && !refuseCode(row, now)) { await log(env, 'check', req, row.code, c.device, 'upgrade'); return issue(env, s, c, 'full', row.code, row.expires_at, now) }
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
  if (row.moves >= MAX_SELF_MOVES) { await log(env, 'release', req, t.code, c.device, 'move_limit'); return fail('move_limit', 403) }
  await env.DB.batch([
    env.DB.prepare('UPDATE devices SET code = NULL, bound_at = NULL WHERE device = ? AND code = ?').bind(c.device, t.code),
    env.DB.prepare('UPDATE codes SET moves = moves + 1 WHERE code = ?').bind(t.code),
  ])
  await log(env, 'release', req, t.code, c.device, 'self')
  return json({ ok: true })
}

// ---------- the seller's codes page ----------
function isAdmin(req: Request, env: Env): boolean {
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return !!env.ADMIN_KEY && key.length === env.ADMIN_KEY.length && sameText(key, env.ADMIN_KEY)
}
const publicCode = (r: CodeRow) => ({ ...r, code: formatCode(r.code) })
const expiresArg = (v: unknown): number | null | undefined => {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

async function admin(req: Request, env: Env, path: string, url: URL): Promise<Response> {
  if (!isAdmin(req, env)) return fail('unauthorized', 401, 'مفتاح الإدارة غير صحيح.')
  const now = Date.now()
  const seg = path.split('/').filter(Boolean)   // e.g. ['codes', 'ABCD…', 'revoke']

  if (seg[0] === 'stats' && req.method === 'GET') {
    const week = now - 7 * DAY
    const codes = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(revoked) AS revoked,
      SUM(EXISTS (SELECT 1 FROM devices d WHERE d.code = codes.code)) AS activated FROM codes`).first<{ total: number; revoked: number | null; activated: number | null }>()
    const devices = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(last_seen > ?) AS active7, SUM(code IS NOT NULL) AS licensed,
      SUM(code IS NULL AND trial_started IS NOT NULL AND trial_ends > ?) AS trials FROM devices`).bind(week, now).first<{ total: number; active7: number | null; licensed: number | null; trials: number | null }>()
    const weekAct = await env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE kind = 'activate' AND detail = 'bind' AND at > ?`).bind(week).first<{ n: number }>()
    const from = Math.floor(now / DAY) * DAY - 13 * DAY
    const byDay = await env.DB.prepare(`SELECT (at / ${DAY}) * ${DAY} AS day, COUNT(*) AS n FROM events WHERE kind = 'activate' AND detail = 'bind' AND at >= ? GROUP BY day`).bind(from).all<{ day: number; n: number }>()
    const days = Array.from({ length: 14 }, (_, i) => ({ day: from + i * DAY, n: byDay.results.find(r => r.day === from + i * DAY)?.n ?? 0 }))
    const recent = await env.DB.prepare(`SELECT e.id, e.at, e.kind, e.code, e.device, e.detail, d.device_code, d.name FROM events e LEFT JOIN devices d ON d.device = e.device
      WHERE e.kind != 'check' ORDER BY e.id DESC LIMIT 40`).all()
    return json({
      codes: { total: codes?.total ?? 0, activated: codes?.activated ?? 0, revoked: codes?.revoked ?? 0 },
      devices: { total: devices?.total ?? 0, active7: devices?.active7 ?? 0, licensed: devices?.licensed ?? 0, trials: devices?.trials ?? 0 },
      activationsWeek: weekAct?.n ?? 0, days, recent: recent.results.map(r => ({ ...r, code: r.code ? formatCode(String(r.code)) : null })),
    })
  }

  if (seg[0] === 'codes' && seg.length === 1 && req.method === 'POST') {
    const b = await body(req)
    if (!b) return fail('bad_request')
    const count = Math.max(1, Math.min(100, Math.round(Number(b.count)) || 1))
    const maxDevices = Math.max(1, Math.min(5, Math.round(Number(b.maxDevices)) || 1))
    const expires = expiresArg(b.expiresAt)
    if (expires === undefined) return fail('bad_request', 400, 'تاريخ الانتهاء غير صحيح.')
    const note = clip(b.note, 200), seller = clip(b.seller, 80)
    const device = validDevice(b.device) ? b.device : null   // "منح كود": the code is made for one device and bound to it at once
    const codes: string[] = []
    while (codes.length < (device ? 1 : count)) { const c = newCode(); if (!codes.includes(c)) codes.push(c) }
    const stmts = codes.map(c => env.DB.prepare('INSERT INTO codes (code, plan, created_at, expires_at, max_devices, note, seller) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(c, 'full', now, expires, maxDevices, note, seller))
    if (device) stmts.push(env.DB.prepare('UPDATE devices SET code = ?, bound_at = ? WHERE device = ?').bind(codes[0], now, device))
    await env.DB.batch(stmts)
    await log(env, 'admin', req, device ? codes[0] : null, device, device ? 'grant' : `created ${codes.length}`)
    return json({ codes: codes.map(formatCode), expiresAt: expires, maxDevices })
  }

  if (seg[0] === 'codes' && seg.length === 1 && req.method === 'GET') {
    const raw = (url.searchParams.get('q') || '').trim()
    const q = `%${raw}%`, qCode = `%${raw.replace(/[-\s]/g, '').toUpperCase()}%`
    const status = url.searchParams.get('status') || ''
    const where = [`(c.code LIKE ? OR c.note LIKE ? OR c.seller LIKE ? OR EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code AND (d.device_code LIKE ? OR d.name LIKE ?)))`]
    const args: unknown[] = [qCode, q, q, qCode.replace(/^%|%$/g, '%'), q]
    if (status === 'new') where.push('c.revoked = 0 AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code)')
    if (status === 'used') where.push('c.revoked = 0 AND EXISTS (SELECT 1 FROM devices d WHERE d.code = c.code)')
    if (status === 'revoked') where.push('c.revoked = 1')
    if (status === 'expired') { where.push('c.expires_at IS NOT NULL AND c.expires_at <= ?'); args.push(now) }
    const rows = await env.DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM devices d WHERE d.code = c.code) AS devices,
      (SELECT MAX(last_seen) FROM devices d WHERE d.code = c.code) AS last_seen FROM codes c WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT 300`).bind(...args).all<CodeRow & { devices: number; last_seen: number | null }>()
    return json({ codes: rows.results.map(publicCode) })
  }

  if (seg[0] === 'codes' && seg.length >= 2) {
    const code = cleanCode(seg[1])
    const row = code ? await getCode(env, code) : null
    if (!code || !row) return fail('not_found', 404, 'الكود غير موجود.')
    if (seg.length === 2 && req.method === 'GET') {
      const devices = await env.DB.prepare('SELECT * FROM devices WHERE code = ? ORDER BY bound_at DESC').bind(code).all<DeviceRow>()
      const events = await env.DB.prepare('SELECT id, at, kind, device, detail FROM events WHERE code = ? ORDER BY id DESC LIMIT 60').bind(code).all()
      return json({ code: publicCode(row), devices: devices.results.map(d => ({ ...d, ip: undefined })), events: events.results })
    }
    if (seg.length === 3 && req.method === 'POST') {
      const act = seg[2]
      const b = (await body(req)) ?? {}
      if (act === 'revoke') await env.DB.prepare('UPDATE codes SET revoked = 1 WHERE code = ?').bind(code).run()
      else if (act === 'unrevoke') await env.DB.prepare('UPDATE codes SET revoked = 0 WHERE code = ?').bind(code).run()
      else if (act === 'extend') {
        const expires = expiresArg(b.expiresAt)
        if (expires === undefined) return fail('bad_request', 400, 'تاريخ الانتهاء غير صحيح.')
        await env.DB.prepare('UPDATE codes SET expires_at = ? WHERE code = ?').bind(expires, code).run()
      }
      else if (act === 'note') await env.DB.prepare('UPDATE codes SET note = ?, seller = ? WHERE code = ?').bind(clip(b.note ?? row.note, 200), clip(b.seller ?? row.seller, 80), code).run()
      else if (act === 'devices') {
        const n = Math.round(Number(b.maxDevices))
        if (!(n >= 1 && n <= 5)) return fail('bad_request')
        await env.DB.prepare('UPDATE codes SET max_devices = ? WHERE code = ?').bind(n, code).run()
      }
      else return fail('not_found', 404)
      await log(env, 'admin', req, code, null, act)
      return json({ ok: true, code: publicCode((await getCode(env, code))!) })
    }
  }

  if (seg[0] === 'devices' && seg.length === 1 && req.method === 'GET') {
    const raw = (url.searchParams.get('q') || '').trim()
    const q = `%${raw}%`, qCode = `%${raw.replace(/[-\s]/g, '').toUpperCase()}%`
    const rows = await env.DB.prepare(`SELECT d.*, c.revoked AS code_revoked, c.expires_at AS code_expires FROM devices d LEFT JOIN codes c ON c.code = d.code
      WHERE (REPLACE(d.device_code, '-', '') LIKE ? OR d.name LIKE ? OR IFNULL(d.code, '') LIKE ? OR d.version LIKE ? OR d.platform LIKE ?) ORDER BY d.last_seen DESC LIMIT 300`)
      .bind(qCode, q, qCode, q, q).all<DeviceRow & { code_revoked: number | null; code_expires: number | null }>()
    return json({ devices: rows.results.map(d => ({ ...d, ip: undefined, code: d.code ? formatCode(d.code) : null })), now })
  }

  if (seg[0] === 'devices' && seg.length === 3 && req.method === 'POST' && seg[2] === 'release') {
    const device = seg[1]
    const me = validDevice(device) ? await getDevice(env, device) : null
    if (!me) return fail('not_found', 404, 'الجهاز غير موجود.')
    await env.DB.prepare('UPDATE devices SET code = NULL, bound_at = NULL WHERE device = ?').bind(device).run()
    await log(env, 'admin', req, me.code, device, 'release')
    return json({ ok: true })
  }

  if (seg[0] === 'settings') {
    if (req.method === 'POST') {
      const b = await body(req)
      if (!b) return fail('bad_request')
      const put = (k: string, v: string) => env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v)
      const num = (v: unknown, max: number, fallback: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? String(Math.max(0, Math.min(max, n))) : String(fallback) }
      await env.DB.batch([
        put('price', clip(b.price, 40) || DEFAULTS.price),
        put('whatsapp', clip(b.whatsapp, 20).replace(/\D/g, '')),
        put('trial_days', num(b.trial_days, 365, DEFAULTS.trial_days)),
        put('grace_days', num(b.grace_days, 365, DEFAULTS.grace_days)),
        put('min_version', clip(b.min_version, 20).replace(/[^0-9.]/g, '')),
        put('android_signature', clip(b.android_signature, 2000).replace(/[^0-9a-fA-F,:\s]/g, '').replace(/:/g, '').toLowerCase()),
        put('message', clip(b.message, 400)),
      ])
      await log(env, 'admin', req, null, null, 'settings')
    }
    return json(await settings(env))
  }

  if (seg[0] === 'events' && req.method === 'GET') {
    const code = cleanCode(url.searchParams.get('code'))
    const device = url.searchParams.get('device') || ''
    const rows = code
      ? await env.DB.prepare('SELECT * FROM events WHERE code = ? ORDER BY id DESC LIMIT 100').bind(code).all()
      : validDevice(device)
        ? await env.DB.prepare('SELECT * FROM events WHERE device = ? ORDER BY id DESC LIMIT 100').bind(device).all()
        : await env.DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all()
    return json({ events: rows.results.map(r => ({ ...r, ip: undefined, code: r.code ? formatCode(String(r.code)) : null })) })
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
      if (p === '/') return new Response('Kaseb license server — كاسب', { headers: { 'content-type': 'text/plain; charset=utf-8' } })
      if (p === '/privacy') return html(PRIVACY)
      if (p === '/admin') return html(ADMIN_PAGE)
      if (p.startsWith('/admin/api/')) return await admin(req, env, p.slice('/admin/api/'.length), url)
      if (p.startsWith('/api/')) {
        if (p === '/api/info' && req.method === 'GET') return json(info(await settings(env)))
        if (!env.LICENSE_SECRET) return fail('not_configured', 500)
        if (p === '/api/public-key' && req.method === 'GET') return json({ publicKey: await publicKeyHex(env.LICENSE_SECRET) })
        if (req.method !== 'POST') return fail('not_found', 404)
        if (!/^application\/json/i.test(req.headers.get('content-type') || '')) return fail('bad_request', 400, 'JSON only.')
        if (p === '/api/activate') return await activate(req, env)
        if (p === '/api/trial') return await trial(req, env)
        if (p === '/api/check') return await check(req, env)
        if (p === '/api/release') return await release(req, env)
      }
      return fail('not_found', 404, 'لا يوجد.')
    } catch (e) {
      return fail('server_error', 500, `خطأ في الخادم: ${(e as Error).message}`)
    }
  },
}
