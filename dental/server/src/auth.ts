// The control panel's sign-in: one password (the ADMIN_PASSWORD secret), a signed session cookie, login rate limits
// and the CSRF rule of every write. Sessions are stateless: `base64url({exp}).base64url(HMAC-SHA256(key, {exp}))`,
// the key derived from the password and a random salt kept in D1, so changing the password signs everyone out.
import { getOrInitValue } from './db'
import { b64url, fromB64url, timingSafeEqual } from './http'
import type { Env } from './types'

export const COOKIE = 'dentora_admin'
export const SESSION_SECONDS = 43_200
export const MIN_PASSWORD = 12
/** Login lock: 5 failures from one address, or 30 from anywhere, within 15 minutes. */
export const WINDOW_MS = 15 * 60_000
export const MAX_PER_IP = 5
export const MAX_OVERALL = 30

const enc = new TextEncoder()

/** Whether the password secret is set and long enough for the panel to open. */
export const passwordReady = (env: Env) => typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= MIN_PASSWORD

// ---- session tokens ----------------------------------------------------------------------------------------------
/** The HMAC key of the sessions: HKDF of the password with the salt (cheap enough to run on a Worker's CPU budget). */
export async function deriveSessionKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode('dentora-admin-session-v1') },
    base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'],
  )
}

// Per isolate: the salt never changes once stored, and the key only with the password (a new secret = a new isolate).
const salts = new WeakMap<D1Database, Promise<string>>()
let keyCache: { password: string; salt: string; key: Promise<CryptoKey> } | null = null
/** The session key of this deployment (its salt is made and stored on first use). */
export async function sessionKey(env: Env): Promise<CryptoKey> {
  let saltP = salts.get(env.DB)
  if (!saltP) {
    saltP = getOrInitValue(env.DB, 'session_salt', () => b64url(crypto.getRandomValues(new Uint8Array(16))))
    saltP.catch(() => salts.delete(env.DB))
    salts.set(env.DB, saltP)
  }
  const salt = await saltP
  const password = env.ADMIN_PASSWORD as string
  if (!keyCache || keyCache.password !== password || keyCache.salt !== salt) keyCache = { password, salt, key: deriveSessionKey(password, salt) }
  return keyCache.key
}

async function hmac(key: CryptoKey, data: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}
/** A session token valid until `exp` (seconds since 1970). */
export async function signSession(key: CryptoKey, exp: number): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ exp })))
  return `${payload}.${b64url(await hmac(key, payload))}`
}
/** Whether a token was made with this key and has not expired. */
export async function verifySession(key: CryptoKey, token: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const [payload, sig, extra] = (token || '').split('.')
  if (!payload || !sig || extra !== undefined) return false
  const given = fromB64url(sig)
  if (!given || !timingSafeEqual(given, await hmac(key, payload))) return false
  try {
    const bytes = fromB64url(payload)
    const { exp } = JSON.parse(new TextDecoder().decode(bytes ?? new Uint8Array()))
    return typeof exp === 'number' && exp > nowSeconds
  } catch { return false }
}

export function readCookie(request: Request, name = COOKIE): string | null {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}
export const sessionCookie = (token: string) => `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`
export const clearedCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

/** Whether the request carries a valid session cookie. */
export async function isSignedIn(request: Request, env: Env): Promise<boolean> {
  if (!passwordReady(env)) return false
  const token = readCookie(request)
  return !!token && verifySession(await sessionKey(env), token)
}

// ---- password ----------------------------------------------------------------------------------------------------
/** Compares digests, so the time taken says nothing about the password's length or its first matching characters. */
export async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([given, expected].map(async s => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))))
  return timingSafeEqual(a, b)
}

// ---- rate limit --------------------------------------------------------------------------------------------------
/** Seconds until the login opens again for this address (0 = open). Failures stop being recorded while locked. */
export async function lockedFor(db: D1Database, ip: string, now = Date.now()): Promise<number> {
  const since = now - WINDOW_MS
  const [mine, all] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n, MIN(at) AS first FROM login_attempts WHERE ip = ? AND at > ?').bind(ip, since),
    db.prepare('SELECT COUNT(*) AS n, MIN(at) AS first FROM login_attempts WHERE at > ?').bind(since),
  ])
  let wait = 0
  for (const [res, max] of [[mine, MAX_PER_IP], [all, MAX_OVERALL]] as const) {
    const r = res.results[0] as { n: number; first: number | null } | undefined
    if (r && Number(r.n) >= max && r.first != null) wait = Math.max(wait, Math.ceil((Number(r.first) + WINDOW_MS - now) / 1000))
  }
  return Math.max(0, wait)
}
export async function recordFailure(db: D1Database, ip: string, now = Date.now()): Promise<void> {
  await db.batch([
    db.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(ip, now),
    // Rows past any window are dropped as we go; the audit log keeps every failure anyway.
    db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(now - 86_400_000),
  ])
}
export async function clearFailures(db: D1Database, ip: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
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
