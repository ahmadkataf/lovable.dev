// Activation codes for the shops that buy the app (mirrors the Emar licensing server).
//
//   POST /api/license/activate  {code, device, name}   -> {token, until, code, devices, maxDevices}   first use on a device
//   POST /api/license/session   {token, device}        -> {token, until, code}                        every time the app opens
//   /admin and /api/admin/*     Bearer ADMIN_KEY                                                       the seller's control panel
//
// A code is random (12 characters, 60 bits) and stored here, so it cannot be forged; it belongs to the
// devices it was activated on (a shop usually has a computer and a phone, so up to `max_devices`).
// The app checks in whenever it opens; offline it keeps working for a grace period, then asks for internet.

export interface LicenseEnv { DB: D1Database; TOKEN_SECRET?: string; ADMIN_KEY?: string }

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const TOKEN_TTL = 400 * 86400000      // a session is a device/code binding re-checked against the row on every call, so it may live long
const FAIL_WINDOW = 15 * 60000
const FAIL_LIMIT_DEVICE = 8
const FAIL_LIMIT_IP = 150
export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' }

type Row = { code: string; plan: string; created_at: number; expires_at: number | null; note: string; seller: string; shop_name: string; max_devices: number; revoked: number; moves: number; last_seen: number | null }
type Device = { code: string; device: string; name: string; bound_at: number; last_seen: number | null }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
const fail = (error: string, status = 400) => json({ error }, status)

export function cleanCode(s: unknown): string | null {
  const c = String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return c.length === 12 && [...c].every(ch => ALPHABET.includes(ch)) ? c : null
}
export const formatCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`
function newCode(): string { return [...crypto.getRandomValues(new Uint8Array(12))].map(b => ALPHABET[b % 32]).join('') }
const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[a-f0-9]{32,64}$/.test(d)

// ---------- signed sessions ----------
const enc = new TextEncoder()
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}
type Session = { c: string; d: string; x: number }
async function makeToken(secret: string, s: Session): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)))
  return `${body}.${b64url(await hmac(secret, body))}`
}
async function readToken(secret: string, token: unknown): Promise<Session | null> {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  try {
    if (!sameBytes(await hmac(secret, body), fromB64url(sig))) return null
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session
    return s.x > Date.now() ? s : null
  } catch { return null }
}

// ---------- helpers ----------
const ip = (req: Request) => req.headers.get('cf-connecting-ip') || 'local'
async function log(env: LicenseEnv, kind: string, req: Request, code?: string | null, device?: string | null, detail = '') {
  await env.DB.prepare('INSERT INTO license_events (at, kind, code, device, ip, detail) VALUES (?, ?, ?, ?, ?, ?)').bind(Date.now(), kind, code ?? null, device ?? null, ip(req), detail.slice(0, 200)).run()
}
const getCode = (env: LicenseEnv, code: string) => env.DB.prepare('SELECT * FROM licenses WHERE code = ?').bind(code).first<Row>()
const getDevices = async (env: LicenseEnv, code: string) => (await env.DB.prepare('SELECT * FROM license_devices WHERE code = ? ORDER BY bound_at').bind(code).all<Device>()).results
async function body(req: Request): Promise<Record<string, unknown>> { try { return await req.json() } catch { return {} } }

/** Why a code cannot be used on this device right now, or null when it can. */
function refuse(row: Row | null, devices: Device[], device: string): string | null {
  if (!row) return 'invalid'
  if (row.revoked) return 'revoked'
  if (row.expires_at && row.expires_at < Date.now()) return 'expired'
  if (!devices.some(d => d.device === device) && devices.length >= row.max_devices) return 'used'
  return null
}

// ---------- the shop's endpoints ----------
async function activate(req: Request, env: LicenseEnv): Promise<Response> {
  const b = await body(req)
  const code = cleanCode(b.code)
  if (!validDevice(b.device)) return fail('bad-request')
  const since = Date.now() - FAIL_WINDOW
  const fails = await env.DB.prepare(`SELECT SUM(device = ?) AS dev, COUNT(*) AS addr FROM license_events WHERE kind = 'activate-fail' AND at > ? AND (ip = ? OR device = ?)`).bind(b.device, since, ip(req), b.device).first<{ dev: number | null; addr: number }>()
  if ((fails?.dev ?? 0) >= FAIL_LIMIT_DEVICE || (fails?.addr ?? 0) >= FAIL_LIMIT_IP) return fail('wait', 429)
  const row = code ? await getCode(env, code) : null
  const devices = code ? await getDevices(env, code) : []
  const why = refuse(row, devices, b.device)
  if (why) { await log(env, 'activate-fail', req, code, b.device, why); return fail(why, why === 'invalid' ? 404 : 403) }
  const now = Date.now()
  const name = String(b.name ?? '').slice(0, 60)
  if (!devices.some(d => d.device === b.device)) {
    // the insert itself counts the seats, so two devices racing for the last one cannot both get it
    const r = await env.DB.prepare('INSERT INTO license_devices (code, device, name, bound_at, last_seen) SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM license_devices WHERE code = ?) < ?').bind(code, b.device, name, now, now, code, row!.max_devices).run()
    if (!r.meta.changes) { await log(env, 'activate-fail', req, code, b.device, 'used'); return fail('used', 403) }
  }
  await env.DB.prepare('UPDATE licenses SET last_seen = ? WHERE code = ?').bind(now, code).run()
  await log(env, 'activate', req, code, b.device, name)
  return json({ token: await makeToken(env.TOKEN_SECRET!, { c: code!, d: b.device, x: now + TOKEN_TTL }), until: row!.expires_at, code: formatCode(code!), devices: (await getDevices(env, code!)).length, maxDevices: row!.max_devices, shopName: row!.shop_name })
}

async function session(req: Request, env: LicenseEnv): Promise<Response> {
  const b = await body(req)
  const s = await readToken(env.TOKEN_SECRET!, b.token)
  if (!s || s.d !== b.device) return fail('session', 401)
  const row = await getCode(env, s.c)
  const devices = await getDevices(env, s.c)
  if (row?.revoked) return fail('revoked', 403)
  if (row?.expires_at && row.expires_at < Date.now()) return fail('expired', 403)
  if (!devices.some(d => d.device === s.d)) return fail('moved', 403)
  const why = refuse(row, devices, s.d)
  if (why) return fail(why, 403)
  const now = Date.now()
  const me = devices.find(d => d.device === s.d)!
  if (!me.last_seen || now - me.last_seen > 3600000) {
    await env.DB.batch([
      env.DB.prepare('UPDATE license_devices SET last_seen = ? WHERE code = ? AND device = ?').bind(now, s.c, s.d),
      env.DB.prepare('UPDATE licenses SET last_seen = ? WHERE code = ?').bind(now, s.c),
    ])
  }
  return json({ token: await makeToken(env.TOKEN_SECRET!, { ...s, x: now + TOKEN_TTL }), until: row!.expires_at, code: formatCode(s.c), devices: devices.length, maxDevices: row!.max_devices, shopName: row!.shop_name })
}

// ---------- the seller's control panel ----------
function isAdmin(req: Request, env: LicenseEnv): boolean {
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!env.ADMIN_KEY || key.length !== env.ADMIN_KEY.length) return false
  return sameBytes(enc.encode(key), enc.encode(env.ADMIN_KEY))
}

async function admin(req: Request, env: LicenseEnv, path: string): Promise<Response> {
  if (!env.ADMIN_KEY) return fail('not-configured', 503)
  if (!isAdmin(req, env)) {
    const since = Date.now() - FAIL_WINDOW
    const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM license_events WHERE kind = 'admin-fail' AND at > ? AND ip = ?`).bind(since, ip(req)).first<{ n: number }>()
    if ((n?.n ?? 0) >= 20) return fail('wait', 429)
    await log(env, 'admin-fail', req)
    return fail('admin', 401)
  }
  const url = new URL(req.url)
  if (path === 'codes' && req.method === 'POST') {
    const b = await body(req)
    const count = Math.max(1, Math.min(200, Number(b.count) || 1))
    const expires = b.expiresAt === null || b.expiresAt === undefined ? null : Number(b.expiresAt)
    if (expires !== null && !(Number.isFinite(expires) && expires > 0)) return fail('expiry')   // a mistyped date must not mean "forever"
    const maxDevices = Math.max(1, Math.min(10, Number(b.maxDevices) || 2))
    const plan = String(b.plan ?? 'year').slice(0, 20)
    const now = Date.now()
    const codes: string[] = []
    while (codes.length < count) { const c = newCode(); if (!codes.includes(c)) codes.push(c) }
    await env.DB.batch(codes.map(c => env.DB.prepare('INSERT INTO licenses (code, plan, created_at, expires_at, note, seller, shop_name, max_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(c, plan, now, expires, String(b.note ?? '').slice(0, 200), String(b.seller ?? '').slice(0, 80), String(b.shopName ?? '').slice(0, 80), maxDevices)))
    await log(env, 'admin', req, null, null, `created ${count} (${plan})`)
    return json({ codes: codes.map(formatCode), expiresAt: expires, maxDevices, plan })
  }
  if (path === 'codes' && req.method === 'GET') {
    const q = `%${(url.searchParams.get('q') || '').replace(/-/g, '').trim()}%`
    const status = url.searchParams.get('status') || ''
    const where = ['(l.code LIKE ? OR l.note LIKE ? OR l.seller LIKE ? OR l.shop_name LIKE ? OR EXISTS (SELECT 1 FROM license_devices d WHERE d.code = l.code AND (d.device LIKE ? OR d.name LIKE ?)))']
    const args: unknown[] = [q.toUpperCase(), q, q, q, q.toLowerCase().replace(/^%/, '').replace(/%$/, '') + '%', q]
    if (status === 'new') where.push('l.revoked = 0 AND (SELECT COUNT(*) FROM license_devices d WHERE d.code = l.code) = 0')
    if (status === 'used') where.push('l.revoked = 0 AND (SELECT COUNT(*) FROM license_devices d WHERE d.code = l.code) > 0')
    if (status === 'revoked') where.push('l.revoked = 1')
    if (status === 'expired') where.push('l.expires_at IS NOT NULL AND l.expires_at < ?'), args.push(Date.now())
    if (status === 'soon') where.push('l.revoked = 0 AND l.expires_at IS NOT NULL AND l.expires_at BETWEEN ? AND ?'), args.push(Date.now(), Date.now() + 30 * 86400000)
    const rows = await env.DB.prepare(`SELECT l.*, (SELECT COUNT(*) FROM license_devices d WHERE d.code = l.code) AS devices FROM licenses l WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 300`).bind(...args).all<Row & { devices: number }>()
    return json({ codes: rows.results.map(r => ({ ...r, code: formatCode(r.code) })) })
  }
  if (path === 'devices' && req.method === 'GET') {
    const code = cleanCode(url.searchParams.get('code'))
    if (!code) return fail('invalid', 404)
    return json({ devices: await getDevices(env, code) })
  }
  if (path === 'code' && req.method === 'POST') {
    const b = await body(req)
    const code = cleanCode(b.code)
    if (!code || !(await getCode(env, code))) return fail('invalid', 404)
    const act = String(b.action)
    if (act === 'revoke') await env.DB.prepare('UPDATE licenses SET revoked = 1 WHERE code = ?').bind(code).run()
    else if (act === 'restore') await env.DB.prepare('UPDATE licenses SET revoked = 0 WHERE code = ?').bind(code).run()
    else if (act === 'unbind') {
      // one device (the old computer) or all of them
      if (typeof b.device === 'string' && b.device) await env.DB.prepare('DELETE FROM license_devices WHERE code = ? AND device = ?').bind(code, b.device).run()
      else await env.DB.prepare('DELETE FROM license_devices WHERE code = ?').bind(code).run()
      await env.DB.prepare('UPDATE licenses SET moves = moves + 1 WHERE code = ?').bind(code).run()
    }
    else if (act === 'note') await env.DB.prepare('UPDATE licenses SET note = ?, shop_name = ? WHERE code = ?').bind(String(b.note ?? '').slice(0, 200), String(b.shopName ?? '').slice(0, 80), code).run()
    else if (act === 'expiry') { const e = b.expiresAt === null ? null : Number(b.expiresAt); if (e !== null && !(Number.isFinite(e) && e > 0)) return fail('expiry'); await env.DB.prepare('UPDATE licenses SET expires_at = ? WHERE code = ?').bind(e, code).run() }
    else if (act === 'devices') await env.DB.prepare('UPDATE licenses SET max_devices = ? WHERE code = ?').bind(Math.max(1, Math.min(10, Number(b.maxDevices) || 2)), code).run()
    else return fail('action')
    await log(env, 'admin', req, code, null, act)
    return json({ ok: true, code: formatCode(code), row: await getCode(env, code) })
  }
  if (path === 'stats') {
    const week = Date.now() - 7 * 86400000, now = Date.now()
    await env.DB.prepare('DELETE FROM license_events WHERE at < ?').bind(now - 180 * 86400000).run()
    const s = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(revoked) AS revoked, SUM(expires_at IS NOT NULL AND expires_at < ?) AS expired, SUM(last_seen > ?) AS active7,
      (SELECT COUNT(DISTINCT code) FROM license_devices) AS activated, (SELECT COUNT(*) FROM license_devices) AS devices FROM licenses`).bind(now, week).first()
    const soon = await env.DB.prepare('SELECT code, shop_name, expires_at FROM licenses WHERE revoked = 0 AND expires_at IS NOT NULL AND expires_at BETWEEN ? AND ? ORDER BY expires_at LIMIT 30').bind(now, now + 30 * 86400000).all<{ code: string; shop_name: string; expires_at: number }>()
    const recent = await env.DB.prepare('SELECT at, kind, code, detail FROM license_events ORDER BY at DESC, id DESC LIMIT 40').all()
    // activations per UTC day over the last two weeks (the day length is written into the SQL: integer division)
    const days = await env.DB.prepare(`SELECT at / 86400000 AS d, COUNT(*) AS n FROM license_events WHERE kind = 'activate' AND at > ? GROUP BY d`).bind(now - 15 * 86400000).all<{ d: number; n: number }>()
    const sellers = await env.DB.prepare(`SELECT seller, COUNT(*) AS total, SUM(EXISTS (SELECT 1 FROM license_devices d WHERE d.code = l.code)) AS activated, SUM(revoked) AS revoked
      FROM licenses l GROUP BY seller ORDER BY total DESC LIMIT 30`).all<{ seller: string; total: number; activated: number; revoked: number }>()
    return json({ stats: s, soon: soon.results.map(r => ({ ...r, code: formatCode(r.code) })), recent: recent.results.map(r => ({ ...r, code: r.code ? formatCode(String(r.code)) : null })), days: days.results, sellers: sellers.results, now })
  }
  return fail('not-found', 404)
}

/** Routes the licensing paths; returns null for anything else. */
export async function handleLicense(req: Request, env: LicenseEnv, path: string): Promise<Response | null> {
  if (path === '/api/license/activate' && req.method === 'POST') { if (!env.TOKEN_SECRET) return fail('not-configured', 503); return activate(req, env) }
  if (path === '/api/license/session' && req.method === 'POST') { if (!env.TOKEN_SECRET) return fail('not-configured', 503); return session(req, env) }
  const a = path.match(/^\/api\/admin\/([a-z]+)$/)
  if (a) return admin(req, env, a[1])
  return null
}
