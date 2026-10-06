// Emar activation and content server.
//
// The app ships with the free unit only. Everything else lives here and is sent only to a phone
// whose code this server has checked, so taking the app apart gives nobody the paid lessons, and
// codes cannot be forged: they are random, stored here, and each one belongs to one phone.
//
//   POST /v1/activate   {book, code, device}      -> {token, until}     first use of a code on a phone
//   POST /v1/session    {book, token, device}     -> {token, until, version}   every time the app opens
//   GET  /v1/content/<book>/<file>   Bearer token + X-Device                   the book and its audio
//   POST /v1/request    {book, device, name, phone, payRef, invite, price} -> {id}   "I paid, send my code"
//   POST /v1/request-status {book, device, id} -> {status, code?}   the app asks until the seller approves
//   GET  /v1/invite-check?invite=     -> {discount}            a friend's invite code is valid
//   POST /v1/invite     {book, token, device} -> {invite, joined, gifts…}   the subscriber's own invite code
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

const BOOKS = ['g12', 'g11', 'g9', 'g8', 'g5']
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
  if (file === 'full.json' && res.body) {
    // every copy carries the code it was sent to, so a leaked copy leads back to its buyer; the file is
    // streamed through (its opening "{" replaced), never read into memory, to stay within the CPU limit
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const stamp = async () => {
      const w = writable.getWriter(), r = res.body!.getReader()
      await w.write(enc.encode(`{"licensedTo":"${formatCode(s.c)}",`))
      for (let first = true; ; first = false) {
        const { done, value } = await r.read()
        if (done) break
        await w.write(first ? value.subarray(1) : value)
      }
      await w.close()
    }
    stamp()
    return new Response(readable, { headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } })
  }
  return new Response(res.body, { headers })
}


// ---------- payment requests and invites ----------
const INVITE_LEN = 6
function newInvite(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_LEN))
  return [...bytes].map(b => ALPHABET[b % 32]).join('')
}
export function cleanInvite(s: unknown): string | null {
  const c = String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return c.length === INVITE_LEN && [...c].every(ch => ALPHABET.includes(ch)) ? c : null
}
/** The end of the school year a code bought today should last to: 31 August (from September on, next year's). */
export function yearEnd(now = Date.now()): number {
  const d = new Date(now)
  const y = d.getUTCMonth() >= 8 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
  return Date.UTC(y, 7, 31, 23, 59)
}
type Settings = { discount: number; giftEvery: number }
const DEFAULTS: Settings = { discount: 10, giftEvery: 5 }   // 10% off for the invited friend; a free code per 5 friends
async function settings(env: Env): Promise<Settings> {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  const s = { ...DEFAULTS }
  for (const r of rows.results) if (r.key in s) (s as Record<string, number>)[r.key] = Number(r.value)
  return s
}
const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n)
type RequestRow = { id: number; book: string; device: string; name: string; phone: string; pay_ref: string; invite: string | null
  price: string; created_at: number; status: string; decided_at: number | null; code: string | null }

async function inviteOwner(env: Env, invite: string) {
  return env.DB.prepare('SELECT i.invite, c.code, c.book, c.device, c.note FROM invites i JOIN codes c ON c.code = i.code WHERE i.invite = ?')
    .bind(invite).first<{ invite: string; code: string; book: string; device: string | null; note: string }>()
}

async function request(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  if (!validBook(b.book) || !validDevice(b.device)) return fail('bad-request')
  const name = clip(b.name, 60), phone = clip(b.phone, 24).replace(/[^\d+ ]/g, ''), payRef = clip(b.payRef, 60), price = clip(b.price, 20)
  if (name.length < 2) return fail('name')
  if (phone.replace(/\D/g, '').length < 7) return fail('phone')
  // one open request per phone is enough: asking again returns it
  const open = await env.DB.prepare("SELECT id FROM requests WHERE device = ? AND book = ? AND status = 'pending' ORDER BY id DESC").bind(b.device, b.book).first<{ id: number }>()
  if (open) return json({ id: open.id, again: true })
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM requests WHERE ip = ? AND created_at > ?').bind(ip(req), Date.now() - 86400000).first<{ n: number }>()
  if ((day?.n ?? 0) >= 30) return fail('wait', 429)
  let invite: string | null = null
  if (b.invite) {
    invite = cleanInvite(b.invite)
    const owner = invite ? await inviteOwner(env, invite) : null
    if (!owner) return fail('invite', 404)
    if (owner.device === b.device) return fail('self-invite')
  }
  const r = await env.DB.prepare('INSERT INTO requests (book, device, name, phone, pay_ref, invite, price, created_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(b.book, b.device, name, phone, payRef, invite, price, Date.now(), ip(req)).first<{ id: number }>()
  await log(env, 'request', req, null, b.device, `#${r!.id} ${b.book}`)
  return json({ id: r!.id })
}

async function requestStatus(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  if (!validBook(b.book) || !validDevice(b.device)) return fail('bad-request')
  const row = await env.DB.prepare('SELECT * FROM requests WHERE id = ? AND device = ? AND book = ?').bind(Number(b.id) || 0, b.device, b.book).first<RequestRow>()
  if (!row) return fail('not-found', 404)
  return json({ id: row.id, status: row.status, code: row.status === 'approved' && row.code ? formatCode(row.code) : undefined })
}

async function inviteCheck(env: Env, url: URL): Promise<Response> {
  const invite = cleanInvite(url.searchParams.get('invite'))
  if (!invite || !(await inviteOwner(env, invite))) return fail('invite', 404)
  return json({ invite, discount: (await settings(env)).discount })
}

async function myInvite(req: Request, env: Env): Promise<Response> {
  const b = await body(req)
  const s = await readToken(env, b.token)
  if (!s || s.d !== b.device || s.b !== b.book) return fail('session', 401)
  if (refuse(await getCode(env, s.c), s.b, s.d)) return fail('session', 401)
  let row = await env.DB.prepare('SELECT invite FROM invites WHERE code = ?').bind(s.c).first<{ invite: string }>()
  for (let i = 0; !row && i < 5; i++) {
    await env.DB.prepare('INSERT OR IGNORE INTO invites (invite, code, created_at) VALUES (?, ?, ?)').bind(newInvite(), s.c, Date.now()).run()
    row = await env.DB.prepare('SELECT invite FROM invites WHERE code = ?').bind(s.c).first<{ invite: string }>()
  }
  if (!row) return fail('server', 500)
  const counts = await env.DB.prepare("SELECT SUM(status = 'approved') AS joined, SUM(status = 'pending') AS waiting FROM requests WHERE invite = ?").bind(row.invite).first<{ joined: number | null; waiting: number | null }>()
  const gifts = await env.DB.prepare('SELECT g.code, c.device FROM gifts g JOIN codes c ON c.code = g.code WHERE g.invite = ? ORDER BY g.created_at').bind(row.invite).all<{ code: string; device: string | null }>()
  const set = await settings(env)
  return json({ invite: row.invite, joined: counts?.joined ?? 0, waiting: counts?.waiting ?? 0, discount: set.discount, giftEvery: set.giftEvery,
    gifts: gifts.results.map(g => ({ code: formatCode(g.code), used: !!g.device })) })
}

async function insertCode(env: Env, book: string, expires: number | null, note: string, seller: string): Promise<string> {
  for (;;) {
    const c = newCode()
    const r = await env.DB.prepare('INSERT OR IGNORE INTO codes (code, book, created_at, expires_at, note, seller) VALUES (?, ?, ?, ?, ?, ?)').bind(c, book, Date.now(), expires, note.slice(0, 200), seller.slice(0, 80)).run()
    if (r.meta.changes) return c
  }
}

/** Approve a paid request: make its code and, when the request came through an invite, reward the friend. */
async function approve(req: Request, env: Env, row: RequestRow): Promise<Record<string, unknown>> {
  const code = await insertCode(env, row.book, yearEnd(), `طلب #${row.id} · ${row.name} · ${row.phone}`, row.invite ? `دعوة ${row.invite}` : 'طلب مباشر')
  const done = await env.DB.prepare("UPDATE requests SET status = 'approved', code = ?, decided_at = ? WHERE id = ? AND status = 'pending'").bind(code, Date.now(), row.id).run()
  if (!done.meta.changes) { await env.DB.prepare('DELETE FROM codes WHERE code = ?').bind(code).run(); throw new Error('done') }
  await log(env, 'admin', req, code, null, `approve #${row.id}`)
  let gift: string | null = null
  if (row.invite) {
    const set = await settings(env)
    const owner = await inviteOwner(env, row.invite)
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE invite = ? AND status = 'approved'").bind(row.invite).first<{ n: number }>())?.n ?? 0
    if (owner && set.giftEvery > 0 && n % set.giftEvery === 0) {
      gift = await insertCode(env, owner.book, yearEnd(), `هدية دعوة ${row.invite} (${n} أصدقاء)`, 'هدية دعوة')
      await env.DB.prepare('INSERT INTO gifts (code, invite, created_at) VALUES (?, ?, ?)').bind(gift, row.invite, Date.now()).run()
      await log(env, 'admin', req, gift, null, `gift ${row.invite}`)
    }
  }
  return { ok: true, code: formatCode(code), gift: gift ? formatCode(gift) : null }
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
  if (path === 'requests' && req.method === 'GET') {
    const st = url.searchParams.get('status') || 'pending'
    const sql = `SELECT r.*, c.note AS ref_note FROM requests r LEFT JOIN invites i ON i.invite = r.invite
      LEFT JOIN codes c ON c.code = i.code ${st === 'all' ? '' : 'WHERE r.status = ?'} ORDER BY r.id DESC LIMIT 200`
    const rows = await (st === 'all' ? env.DB.prepare(sql) : env.DB.prepare(sql).bind(st)).all<RequestRow & { ref_note: string | null }>()
    return json({ requests: rows.results.map(r => ({ ...r, device: undefined, ip: undefined, code: r.code ? formatCode(r.code) : null })) })
  }
  if (path === 'request' && req.method === 'POST') {
    const b = await body(req)
    const row = await env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(Number(b.id) || 0).first<RequestRow>()
    if (!row) return fail('not-found', 404)
    if (row.status !== 'pending') return fail('done')
    if (b.action === 'approve') { try { return json(await approve(req, env, row)) } catch { return fail('done') } }
    if (b.action === 'reject') {
      await env.DB.prepare("UPDATE requests SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'pending'").bind(Date.now(), row.id).run()
      await log(env, 'admin', req, null, null, `reject #${row.id}`)
      return json({ ok: true })
    }
    return fail('action')
  }
  if (path === 'settings') {
    if (req.method === 'POST') {
      const b = await body(req)
      const discount = Math.round(Number(b.discount)), giftEvery = Math.round(Number(b.giftEvery))
      if (!Number.isFinite(discount) || !Number.isFinite(giftEvery)) return fail('bad-request')
      const put = (k: string, v: number) => env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, String(v))
      await env.DB.batch([put('discount', Math.max(0, Math.min(50, discount))), put('giftEvery', Math.max(0, Math.min(50, giftEvery)))])
      await log(env, 'admin', req, null, null, `settings ${discount}% / ${giftEvery}`)
    }
    return json(await settings(env))
  }
  if (path === 'stats') {
    const week = Date.now() - 7 * 86400000
    const rows = await env.DB.prepare(`SELECT book, COUNT(*) AS total, SUM(device IS NOT NULL) AS activated, SUM(revoked) AS revoked,
      SUM(last_seen > ?) AS active7 FROM codes GROUP BY book`).bind(week).all()
    const recent = await env.DB.prepare('SELECT at, kind, code, detail FROM events ORDER BY id DESC LIMIT 40').all()
    // for the panel's dashboard: who sold what, activations per day over two weeks, and today's count
    const sellers = await env.DB.prepare('SELECT seller, COUNT(*) AS total, SUM(device IS NOT NULL) AS activated FROM codes GROUP BY seller ORDER BY total DESC LIMIT 50').all()
    const day = 86400000, today = Math.floor(Date.now() / day) * day, from = today - 13 * day
    // the day length is written into the SQL: a bound number arrives as a decimal, and the division would then not round down
    const byDay = await env.DB.prepare(`SELECT (bound_at / ${day}) * ${day} AS day, COUNT(*) AS n FROM codes WHERE bound_at >= ? GROUP BY day`).bind(from).all<{ day: number; n: number }>()
    const days = Array.from({ length: 14 }, (_, i) => ({ day: from + i * day, n: byDay.results.find(r => r.day === from + i * day)?.n ?? 0 }))
    const pending = (await env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'pending'").first<{ n: number }>())?.n ?? 0
    const inviters = await env.DB.prepare(`SELECT r.invite, COUNT(*) AS joined, c.note, (SELECT COUNT(*) FROM gifts g WHERE g.invite = r.invite) AS gifts
      FROM requests r JOIN invites i ON i.invite = r.invite JOIN codes c ON c.code = i.code WHERE r.status = 'approved' GROUP BY r.invite ORDER BY joined DESC LIMIT 20`).all()
    return json({ books: rows.results, recent: recent.results, sellers: sellers.results, days, today: days[13].n, pending, inviters: inviters.results })
  }
  return fail('not-found', 404)
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const p = url.pathname
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    try {
      if (p === '/v1/ping') return json({ ok: true, service: 'emar' })
      // the web versions of the apps (for iPhone and computers): public, they hold the free unit only.
      // /app/ is the Baccalaureate app, /app<grade>/ the others (/app5/, /app8/, /app9/, /app11/).
      if (p === '/') return Response.redirect(new URL('/app/', req.url).toString(), 302)
      if (/^\/app\d*$/.test(p)) return Response.redirect(new URL(`${p}/`, req.url).toString(), 302)
      // HEAD too: link previews (WhatsApp, Telegram) check a link with HEAD before opening it
      if (/^\/app\d*\//.test(p) && (req.method === 'GET' || req.method === 'HEAD')) {
        const res = await env.ASSETS.fetch(new Request(new URL(p.endsWith('/') ? `${p}index.html` : p, req.url), { method: req.method }))
        if (res.status === 404) return fail('not-found', 404)
        const h = new Headers(res.headers)
        // the page itself always fresh, so an update reaches everyone; its hashed files cached for long
        h.set('cache-control', p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
        return new Response(res.body, { status: res.status, headers: h })
      }
      if (p === '/privacy') return new Response(privacyPage(env.CONTACT || ''), { headers: { 'content-type': 'text/html; charset=utf-8' } })
      if (p === '/admin') return new Response(ADMIN_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
      if (p === '/v1/activate' && req.method === 'POST') return await activate(req, env)
      if (p === '/v1/session' && req.method === 'POST') return await session(req, env)
      if (p === '/v1/request' && req.method === 'POST') return await request(req, env)
      if (p === '/v1/request-status' && req.method === 'POST') return await requestStatus(req, env)
      if (p === '/v1/invite-check' && req.method === 'GET') return await inviteCheck(env, url)
      if (p === '/v1/invite' && req.method === 'POST') return await myInvite(req, env)
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
