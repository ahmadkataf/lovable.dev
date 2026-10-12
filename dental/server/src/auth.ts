// The control panel's sign-in: one password (the ADMIN_PASSWORD secret), a signed session cookie, login rate limits
// and the CSRF rule of every write; also the rate limit of the public key activation (POST /api/activate). Session
// tokens are `base64url({exp,sid}).base64url(HMAC-SHA256(key, 'session.' + payload))`, the key derived from the
// password and a random salt kept in D1, so changing the password signs everyone out; logging out puts the token's
// `sid` on a revoked list, so a copied cookie stops working too.
import { deploymentSalt } from './db'
import { b64url, fromB64url, timingSafeEqual } from './http'
import type { Env } from './types'

// __Host-: the browser accepts these only from this exact host (Secure, Path=/, no Domain), so a page on another
// raqeem.dev subdomain can neither set nor shadow them.
export const COOKIE = '__Host-dentora_admin'
/** Marks a browser that has signed in before: it skips the everyone-together login limit (see takeAttempt). */
export const DEVICE_COOKIE = '__Host-dentora_device'
export const SESSION_SECONDS = 43_200
export const DEVICE_SECONDS = 31_536_000
export const MIN_PASSWORD = 12
/** Login limits within 15 minutes: 5 attempts per address (IPv6: per /64), 30 from browsers that never signed in. */
export const WINDOW_MS = 15 * 60_000
export const MAX_PER_IP = 5
export const MAX_OVERALL = 30
/** Key activation limit within the same 15 minutes: 10 failed attempts per address (IPv6: per /64). */
export const MAX_ACTIVATION_FAILURES = 10

const enc = new TextEncoder()

/** Whether the password secret is set and long enough for the panel to open. */
export const passwordReady = (env: Env) => typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= MIN_PASSWORD

// ---- tokens ------------------------------------------------------------------------------------------------------
/** The HMAC key of the cookies: HKDF of the password with the salt (cheap enough to run on a Worker's CPU budget). */
export async function deriveSessionKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode('dentora-admin-session-v1') },
    base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'],
  )
}

// Per isolate: the key only changes with the password (a new secret = a new isolate).
let keyCache: { password: string; salt: string; key: Promise<CryptoKey> } | null = null
/** The cookie key of this deployment (its salt is made and stored on first use). */
export async function sessionKey(env: Env): Promise<CryptoKey> {
  const salt = await deploymentSalt(env.DB)
  const password = env.ADMIN_PASSWORD as string
  if (!keyCache || keyCache.password !== password || keyCache.salt !== salt) keyCache = { password, salt, key: deriveSessionKey(password, salt) }
  return keyCache.key
}

async function hmac(key: CryptoKey, data: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}
/** What a token is for is part of what is signed, so a device token can never pass as a session. */
export type TokenKind = 'session' | 'device'
export interface Claims { exp: number; sid: string }

/** A token of this kind valid until `exp` (seconds since 1970); `sid` names it, for revoking. */
export async function signToken(key: CryptoKey, kind: TokenKind, exp: number, sid = b64url(crypto.getRandomValues(new Uint8Array(16)))): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ exp, sid })))
  return `${payload}.${b64url(await hmac(key, `${kind}.${payload}`))}`
}
/** The claims of a token made with this key for this kind that has not expired, else null. */
export async function readToken(key: CryptoKey, kind: TokenKind, token: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<Claims | null> {
  const [payload, sig, extra] = (token || '').split('.')
  if (!payload || !sig || extra !== undefined) return null
  const given = fromB64url(sig)
  if (!given || !timingSafeEqual(given, await hmac(key, `${kind}.${payload}`))) return null
  try {
    const { exp, sid } = JSON.parse(new TextDecoder().decode(fromB64url(payload) ?? new Uint8Array()))
    return typeof exp === 'number' && exp > nowSeconds && typeof sid === 'string' && sid.length > 0 && sid.length <= 64 ? { exp, sid } : null
  } catch { return null }
}

export function readCookie(request: Request, name = COOKIE): string | null {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}
const cookieOf = (name: string, value: string, maxAge: number) => `${name}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
export const sessionCookie = (token: string) => cookieOf(COOKIE, token, SESSION_SECONDS)
export const clearedCookie = () => cookieOf(COOKIE, '', 0)
export const deviceCookie = (token: string) => cookieOf(DEVICE_COOKIE, token, DEVICE_SECONDS)

/** The session of the request: a valid, unexpired session cookie that was not logged out; else null. */
export async function currentSession(request: Request, env: Env): Promise<Claims | null> {
  if (!passwordReady(env)) return null
  const token = readCookie(request)
  const claims = token ? await readToken(await sessionKey(env), 'session', token) : null
  if (!claims) return null
  const revoked = await env.DB.prepare('SELECT 1 AS x FROM revoked_sessions WHERE sid = ?').bind(claims.sid).first()
  return revoked ? null : claims
}
/** Ends a session for good: its token is refused from now on, wherever a copy of it is. */
export async function revokeSession(db: D1Database, claims: Claims, nowSeconds = Math.floor(Date.now() / 1000)): Promise<void> {
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO revoked_sessions (sid, exp) VALUES (?, ?)').bind(claims.sid, claims.exp),
    // A revoked token past its expiry is refused anyway, so its row can go.
    db.prepare('DELETE FROM revoked_sessions WHERE exp < ?').bind(nowSeconds),
  ])
}
/** Whether the browser carries a device cookie from an earlier sign-in with the current password. */
export async function knownDevice(request: Request, env: Env): Promise<boolean> {
  const token = readCookie(request, DEVICE_COOKIE)
  return !!token && !!(await readToken(await sessionKey(env), 'device', token))
}

// ---- password ----------------------------------------------------------------------------------------------------
/** Compares digests, so the time taken says nothing about the password's length or its first matching characters. */
export async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([given, expected].map(async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))))
  return timingSafeEqual(a, b)
}

// ---- rate limit --------------------------------------------------------------------------------------------------
/**
 * Who an attempt counts against: the address itself for IPv4, its /64 for IPv6 (one connection gets a whole /64, so
 * counting single IPv6 addresses would give an attacker billions of fresh ones).
 */
export function addressKey(ip: string): string {
  const a = ip.trim().toLowerCase()
  if (!a.includes(':')) return a
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a)
  if (mapped) return mapped[1]
  const halves = a.split('::')
  if (halves.length > 2) return a
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const groups = halves.length === 2 ? [...head, ...Array<string>(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail] : head
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return a
  return `${groups.slice(0, 4).map(g => g.replace(/^0+(?=.)/, '')).join(':')}::/64`
}

export interface Gate {
  /** Whether this attempt may compare the password. */
  allowed: boolean
  /** Seconds until the next attempt would be let through (0 = open). */
  retryAfter: number
}
/**
 * Counts a sign-in attempt before its password is compared, in one transaction, so a burst of parallel requests
 * cannot all slip in under the limit: the attempt is recorded (and allowed) only while its address is under
 * MAX_PER_IP and, for a browser that has never signed in, everyone together is under MAX_OVERALL. A known device
 * skips that second limit, so strangers can slow down guessing but never lock the seller out of their own browser.
 * Refused attempts are not recorded, so hammering does not stretch a lock.
 */
export async function takeAttempt(db: D1Database, key: string, known: boolean, now = Date.now()): Promise<Gate> {
  const since = now - WINDOW_MS
  const [ins, mine, all] = await db.batch([
    db.prepare(`INSERT INTO login_attempts (ip, at) SELECT ?1, ?2
        WHERE (SELECT COUNT(*) FROM login_attempts WHERE ip = ?1 AND at > ?3) < ?4
          AND (?5 = 1 OR (SELECT COUNT(*) FROM login_attempts WHERE at > ?3) < ?6)
        RETURNING id`).bind(key, now, since, MAX_PER_IP, known ? 1 : 0, MAX_OVERALL),
    db.prepare('SELECT COUNT(*) AS n, MIN(at) AS first FROM login_attempts WHERE ip = ? AND at > ?').bind(key, since),
    db.prepare('SELECT COUNT(*) AS n, MIN(at) AS first FROM login_attempts WHERE at > ?').bind(since),
    // Rows past any window are dropped as we go; the audit log keeps every failure anyway.
    db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(now - 86_400_000),
  ])
  let wait = 0
  for (const [res, max, applies] of [[mine, MAX_PER_IP, true], [all, MAX_OVERALL, !known]] as const) {
    const r = res.results[0] as { n: number; first: number | null } | undefined
    if (applies && r && Number(r.n) >= max && r.first != null) wait = Math.max(wait, Math.ceil((Number(r.first) + WINDOW_MS - now) / 1000))
  }
  const allowed = ins.results.length > 0
  return { allowed, retryAfter: Math.max(allowed ? 0 : 1, wait) }
}
/** After a successful sign-in the address starts afresh. */
export async function clearAttempts(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(key).run()
}

/** An activation attempt let through holds a slot (`id`); a refused one says how long to wait. */
export type ActivationGate = { allowed: true; id: number } | { allowed: false; retryAfter: number }
/**
 * Takes a slot for a key activation before the key is looked up, in one transaction, the way takeAttempt does for
 * sign-ins: let through only while the address has fewer than MAX_ACTIVATION_FAILURES attempts in the window, so
 * parallel guesses cannot pass the limit. The caller gives the slot back (releaseActivationAttempt) unless the
 * attempt failed, so only failures stay counted; refused attempts are not recorded. Rows leave as soon as they are
 * out of the window: the addresses are kept no longer than they count.
 */
export async function takeActivationAttempt(db: D1Database, key: string, now = Date.now()): Promise<ActivationGate> {
  const since = now - WINDOW_MS
  const [ins, mine] = await db.batch([
    db.prepare(`INSERT INTO activation_attempts (ip, at) SELECT ?1, ?2
        WHERE (SELECT COUNT(*) FROM activation_attempts WHERE ip = ?1 AND at > ?3) < ?4
        RETURNING id`).bind(key, now, since, MAX_ACTIVATION_FAILURES),
    db.prepare('SELECT MIN(at) AS first FROM activation_attempts WHERE ip = ? AND at > ?').bind(key, since),
    db.prepare('DELETE FROM activation_attempts WHERE at <= ?').bind(since),
  ])
  const taken = ins.results[0] as { id: number } | undefined
  if (taken) return { allowed: true, id: Number(taken.id) }
  const first = (mine.results[0] as { first: number | null } | undefined)?.first
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((Number(first ?? now) + WINDOW_MS - now) / 1000)) }
}
/** Gives back the slot of an attempt that did not fail (a success, a broken request, a server problem). */
export async function releaseActivationAttempt(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM activation_attempts WHERE id = ?').bind(id).run()
}

// ---- CSRF --------------------------------------------------------------------------------------------------------
/**
 * Every write must carry `X-Dentora: 1` (a header a cross-site form cannot send, and a cross-site script cannot
 * without a CORS preflight this Worker never answers) and, when the browser sends an Origin, come from this origin.
 */
export function sameOriginWrite(request: Request): boolean {
  if (request.headers.get('X-Dentora') !== '1') return false
  const origin = request.headers.get('Origin')
  return origin === null || origin === new URL(request.url).origin
}
