// Emar activation and content server.
//
// The app ships with the free unit only. Everything else lives here and is sent only to a phone
// whose code this server has checked, so taking the app apart gives nobody the paid lessons, and
// codes cannot be forged: they are random, stored here, and each one belongs to one phone.
//
//   POST /v1/activate   {book, code, device}      -> {token, until}     first use of a code on a phone
//   POST /v1/session    {book, token, device}     -> {token, until, version}   every time the app opens
//   GET  /v1/content/<book>/<file>   Bearer token + X-Device                   the book and its audio
//   /admin and /v1/admin/*          Bearer ADMIN_KEY                          the seller's control panel
import { ADMIN_PAGE } from './admin'
import { privacyPage } from './privacy'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  TOKEN_SECRET: string
  ADMIN_KEY: string
  CONTACT?: string
}

const BOOKS = ['g12', 'g11', 'g8']
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const TOKEN_TTL = 3 * 86400000       // a session lasts three days; the app renews it every time it opens
const FAIL_WINDOW = 15 * 60000        // wrong codes inside this window beyond these limits are refused:
const FAIL_LIMIT_DEVICE = 8           // from one phone
const FAIL_LIMIT_IP = 150             // from one address (loose: many Syrian subscribers share one address)
// A code is 12 random characters (60 bits), so guessing one is hopeless even without these limits.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-device',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '86400',
}

type CodeRow = {
  code: string; book: string; created_at: number; expires_at: number | null; note: string; seller: string
  device: string | null; bound_at: number | null; last_seen: number | null; revoked: number; moves: number
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const fail = (error: string, status = 400) => json({ error }, status)

// ---------- codes ----------
export function cleanCode(s: unknown): string | null {
  const c = String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return c.length === 12 && [...c].every(ch => ALPHABET.includes(ch)) ? c : null
}
export const formatCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return [...bytes].map(b => ALPHABET[b % 32]).join('')   // 32 divides 256: every character equally likely
}
const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[a-f0-9]{32,64}$/.test(d)
const validBook = (b: unknown): b is string => typeof b === 'string' && BOOKS.includes(b)

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
type Session = { c: string; d: string; b: string; x: number }
async function makeToken(env: Env, s: Session): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)))
  return `${body}.${b64url(await hmac(env.TOKEN_SECRET, body))}`
}
async function readToken(env: Env, token: unknown): Promise<Session | null> {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  try {
    if (!sameBytes(await hmac(env.TOKEN_SECRET, body), fromB64url(sig))) return null
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session
    return s.x > Date.now() ? s : null
  } catch { return null }
}

// ---------- helpers ----------
const ip = (req: Request) => req.headers.get('cf-connecting-ip') || 'local'
async function log(env: Env, kind: string, req: Request, code?: string | null, device?: string | null, detail = '') {
  await env.DB.prepare('INSERT INTO events (at, kind, code, device, ip, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(Date.now(), kind, code ?? null, device ?? null, ip(req), detail).run()
}
const getCode = (env: Env, code: string) => env.DB.prepare('SELECT * FROM codes WHERE code = ?').bind(code).first<CodeRow>()
async function body(req: Request): Promise<Record<string, unknown>> {
  try { return await req.json() } catch { return {} }
}

/** Why a code cannot be used on this phone right now, or null when it can. */
function refuse(row: CodeRow | null, book: string, device: string): string | null {
  if (!row) return 'invalid'
  if (row.book !== book) return 'book'
  if (row.revoked) return 'revoked'
  if (row.expires_at && row.expires_at < Date.now()) return 'expired'
  if (row.device && row.device !== device) return 'used'
  return null
}

// ---------- student endpoints ----------
async function activate(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const code = cleanCode(b.code)
  if (!validBook(b.book) || !validDevice(b.device)) return fail('bad-request')
  const since = Date.now() - FAIL_WINDOW
  const fails = await env.DB.prepare(`SELECT SUM(device = ?) AS dev, COUNT(*) AS addr FROM events
    WHERE kind = 'activate-fail' AND at > ? AND (ip = ? OR device = ?)`).bind(b.device, since, ip(req), b.device).first<{ dev: number | null; addr: number }>()
  if ((fails?.dev ?? 0) >= FAIL_LIMIT_DEVICE || (fails?.addr ?? 0) >= FAIL_LIMIT_IP) return fail('wait', 429)
  const row = code ? await getCode(env, code) : null
  const why = refuse(row, b.book, b.device)
  if (why) { await log(env, 'activate-fail', req, code, b.device, why); return fail(why, why === 'invalid' ? 404 : 403) }
  const now = Date.now()
  if (!row!.device) await env.DB.prepare('UPDATE codes SET device = ?, bound_at = ?, last_seen = ? WHERE code = ? AND device IS NULL').bind(b.device, now, now, code).run()
  // two phones racing for the same new code: only the one that got it may continue
  const after = await getCode(env, code!)
  if (after?.device !== b.device) return fail('used', 403)
  await log(env, 'activate', req, code, b.device)
  return json({ token: await makeToken(env, { c: code!, d: b.device, b: b.book, x: now + TOKEN_TTL }), until: after.expires_at, code: formatCode(code!) })
}

async function session(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const s = await readToken(env, b.token)
  if (!s || s.d !== b.device || s.b !== b.book) return fail('session', 401)
  const row = await getCode(env, s.c)
  const why = refuse(row, s.b, s.d)
  if (why) return fail(why, 403)
  const now = Date.now()
  if (!row!.last_seen || now - row!.last_seen > 3600000) {
    await env.DB.prepare('UPDATE codes SET last_seen = ? WHERE code = ?').bind(now, s.c).run()
    await log(env, 'session', req, s.c, s.d)
  }
  const v = await env.ASSETS.fetch(new Request(new URL(`/${s.b}/version.json`, req.url)))
  const version = v.ok ? ((await v.json()) as { version: string }).version : ''
  return json({ token: await makeToken(env, { ...s, x: now + TOKEN_TTL }), until: row!.expires_at, version, code: formatCode(s.c) })
}

async function content(req: Request, env: Env, book: string, file: string): Promise<Response> {
  if (!/^(full\.json|audio\/[a-z0-9]+\.mp3|audio\/index\.json)$/.test(file)) return fail('not-found', 404)
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const device = req.headers.get('x-device') || ''
  const s = await readToken(env, token)
  if (!s || s.d !== device || s.b !== book) return fail('session', 401)
  const row = await getCode(env, s.c)
  if (refuse(row, book, device)) return fail('session', 401)
  const res = await env.ASSETS.fetch(new Request(new URL(`/${book}/${file}`, req.url)))
  if (!res.ok) return fail('not-found', 404)
  const headers = { ...CORS, 'content-type': res.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'private, no-store' }
  if (file === 'full.json') {
    // every copy carries the code it was sent to, so a leaked copy leads back to its buyer
    const text = await res.text()
    return new Response(`{"licensedTo":"${formatCode(s.c)}",${text.slice(1)}`, { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } })
  }
  return new Response(res.body, { headers })
}

// ---------- the seller's control panel ----------
function isAdmin(req: Request, env: Env): boolean {
  const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!env.ADMIN_KEY || key.length !== env.ADMIN_KEY.length) return false
  return sameBytes(enc.encode(key), enc.encode(env.ADMIN_KEY))
}

async function admin(req: Request, env: Env, path: string): Promise<Response> {
  if (!isAdmin(req, env)) return fail('admin', 401)
  const url = new URL(req.url)
  if (path === 'codes' && req.method === 'POST') {
    const b = await body(req)
    const count = Math.max(1, Math.min(500, Number(b.count) || 1))
    if (!validBook(b.book)) return fail('book')
    const expires = b.expiresAt === null || b.expiresAt === undefined ? null : Number(b.expiresAt)
    const now = Date.now()
    const codes: string[] = []
    while (codes.length < count) { const c = newCode(); if (!codes.includes(c)) codes.push(c) }
    await env.DB.batch(codes.map(c => env.DB.prepare('INSERT INTO codes (code, book, created_at, expires_at, note, seller) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(c, b.book, now, expires, String(b.note ?? '').slice(0, 200), String(b.seller ?? '').slice(0, 80))))
    await log(env, 'admin', req, null, null, `created ${count} ${b.book}`)
    return json({ codes: codes.map(formatCode), book: b.book, expiresAt: expires })
  }
  if (path === 'codes' && req.method === 'GET') {
    const q = `%${(url.searchParams.get('q') || '').replace(/-/g, '').trim()}%`
    const book = url.searchParams.get('book') || ''
    const status = url.searchParams.get('status') || ''
    const where = ['(code LIKE ? OR note LIKE ? OR seller LIKE ? OR IFNULL(device, \'\') LIKE ?)']
    const args: unknown[] = [q.toUpperCase(), q, q, q.toLowerCase()]
    if (book) { where.push('book = ?'); args.push(book) }
    if (status === 'new') where.push('device IS NULL AND revoked = 0')
    if (status === 'used') where.push('device IS NOT NULL AND revoked = 0')
    if (status === 'revoked') where.push('revoked = 1')
    const rows = await env.DB.prepare(`SELECT * FROM codes WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 300`).bind(...args).all<CodeRow>()
    return json({ codes: rows.results.map(r => ({ ...r, code: formatCode(r.code) })) })
  }
  if (path === 'code' && req.method === 'POST') {
    const b = await body(req)
    const code = cleanCode(b.code)
    if (!code || !(await getCode(env, code))) return fail('invalid', 404)
    const act = String(b.action)
    if (act === 'revoke') await env.DB.prepare('UPDATE codes SET revoked = 1 WHERE code = ?').bind(code).run()
    else if (act === 'restore') await env.DB.prepare('UPDATE codes SET revoked = 0 WHERE code = ?').bind(code).run()
    else if (act === 'unbind') await env.DB.prepare('UPDATE codes SET device = NULL, bound_at = NULL, moves = moves + 1 WHERE code = ?').bind(code).run()
    else if (act === 'note') await env.DB.prepare('UPDATE codes SET note = ? WHERE code = ?').bind(String(b.note ?? '').slice(0, 200), code).run()
    else if (act === 'expiry') await env.DB.prepare('UPDATE codes SET expires_at = ? WHERE code = ?').bind(b.expiresAt === null ? null : Number(b.expiresAt), code).run()
    else return fail('action')
    await log(env, 'admin', req, code, null, act)
    return json({ ok: true, code: formatCode(code), row: await getCode(env, code) })
  }
  if (path === 'stats') {
    const week = Date.now() - 7 * 86400000
    const rows = await env.DB.prepare(`SELECT book, COUNT(*) AS total, SUM(device IS NOT NULL) AS activated, SUM(revoked) AS revoked,
      SUM(last_seen > ?) AS active7 FROM codes GROUP BY book`).bind(week).all()
    const recent = await env.DB.prepare('SELECT at, kind, code, detail FROM events ORDER BY id DESC LIMIT 40').all()
    return json({ books: rows.results, recent: recent.results })
  }
  return fail('not-found', 404)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    try {
      if (p === '/' || p === '/v1/ping') return json({ ok: true, service: 'emar' })
      if (p === '/privacy') return new Response(privacyPage(env.CONTACT || ''), { headers: { 'content-type': 'text/html; charset=utf-8' } })
      if (p === '/admin') return new Response(ADMIN_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
      if (p === '/v1/activate' && req.method === 'POST') return await activate(req, env)
      if (p === '/v1/session' && req.method === 'POST') return await session(req, env)
      const c = p.match(/^\/v1\/content\/([a-z0-9]+)\/(.+)$/)
      if (c && req.method === 'GET') return await content(req, env, c[1], c[2])
      const a = p.match(/^\/v1\/admin\/([a-z]+)$/)
      if (a) return await admin(req, env, a[1])
      return fail('not-found', 404)
    } catch (e) {
      return fail(`server: ${(e as Error).message}`, 500)
    }
  },
}
