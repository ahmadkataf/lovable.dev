// Team authentication only (customers are guests): PBKDF2-SHA256 password hashes, HS256 bearer tokens,
// and login rate limiting backed by the login_attempts table.
import type { Role, User } from '../../shared/types'
import type { Env } from './env'
import { HttpError } from './http'
import { toUser, type UserRow } from './db'

const PBKDF2_ITERATIONS = 100_000
const TOKEN_TTL_SECONDS = 30 * 24 * 3600
export const MIN_PASSWORD = 6
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_PER_PHONE = 5
const LOGIN_MAX_PER_IP = 20

const enc = new TextEncoder()

const b64 = {
  encode: (bytes: ArrayBuffer | Uint8Array): string => btoa(String.fromCharCode(...new Uint8Array(bytes))),
  decode: (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
  urlEncode: (bytes: ArrayBuffer | Uint8Array): string =>
    btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  urlDecode: (s: string): Uint8Array => {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  },
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
}

/** → "pbkdf2$<iterations>$<salt b64>$<hash b64>" */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64.encode(salt)}$${b64.encode(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iter || !saltB64 || !hashB64) return false
  const expected = b64.decode(hashB64)
  const actual = new Uint8Array(await pbkdf2(password, b64.decode(saltB64), Number(iter)))
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0)
  return diff === 0
}

export function validatePassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < MIN_PASSWORD || v.length > 128) throw new HttpError(400, 'weak_password')
  return v
}

// ---- tokens: compact HS256 JWT (header.payload.signature), 30 days ----
interface TokenPayload { sub: number; role: Role; iat: number; exp: number }

async function hmacKey(env: Env): Promise<CryptoKey> {
  if (!env.TOKEN_SECRET || env.TOKEN_SECRET.length < 16) throw new HttpError(500, 'server_misconfigured')
  return crypto.subtle.importKey('raw', enc.encode(env.TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signToken(env: Env, user: User, now = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000)
  const payload: TokenPayload = { sub: user.id, role: user.role, iat, exp: iat + TOKEN_TTL_SECONDS }
  const head = b64.urlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = b64.urlEncode(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(`${head}.${body}`))
  return `${head}.${body}.${b64.urlEncode(sig)}`
}

async function verifyToken(env: Env, token: string, now = new Date()): Promise<TokenPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [head, body, sig] = parts as [string, string, string]
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), b64.urlDecode(sig) as BufferSource, enc.encode(`${head}.${body}`))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(b64.urlDecode(body))) as Partial<TokenPayload>
    if (typeof payload.sub !== 'number' || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < now.getTime()) return null
    return payload as TokenPayload
  } catch {
    return null
  }
}

/**
 * Resolves the team account behind "Authorization: Bearer …". Returns null when there is no header.
 * Throws 401 for an invalid/expired token or a disabled account. The user row is re-read on every request,
 * so a disabled account or a changed role takes effect immediately (the token's role is never trusted).
 */
export async function authenticate(req: Request, env: Env): Promise<User | null> {
  const header = req.headers.get('Authorization')
  if (!header) return null
  const m = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!m) throw new HttpError(401, 'invalid_token')
  const payload = await verifyToken(env, m[1] as string)
  if (!payload) throw new HttpError(401, 'invalid_token')
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.sub).first<UserRow>()
  if (!row || row.disabled) throw new HttpError(401, 'account_disabled')
  return toUser(row)
}

// ---- login rate limiting (per phone and per IP, fixed 15-minute window) ----
interface AttemptRow { key: string; count: number; window_start: string }

async function attempts(db: D1Database, key: string, now: Date): Promise<number> {
  const row = await db.prepare('SELECT * FROM login_attempts WHERE key = ?').bind(key).first<AttemptRow>()
  if (!row || Date.parse(row.window_start) + LOGIN_WINDOW_MS < now.getTime()) return 0
  return row.count
}

export async function assertLoginAllowed(db: D1Database, phone: string, ip: string, now = new Date()): Promise<void> {
  const [byPhone, byIp] = await Promise.all([attempts(db, `phone:${phone}`, now), attempts(db, `ip:${ip}`, now)])
  if (byPhone >= LOGIN_MAX_PER_PHONE || byIp >= LOGIN_MAX_PER_IP) throw new HttpError(429, 'too_many_attempts')
}

export async function recordLoginFailure(db: D1Database, phone: string, ip: string, now = new Date()): Promise<void> {
  const iso = now.toISOString()
  const cutoff = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString()
  const stmt = db.prepare(
    `INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN login_attempts.window_start < ? THEN 1 ELSE login_attempts.count + 1 END,
       window_start = CASE WHEN login_attempts.window_start < ? THEN excluded.window_start ELSE login_attempts.window_start END`)
  await db.batch([stmt.bind(`phone:${phone}`, iso, cutoff, cutoff), stmt.bind(`ip:${ip}`, iso, cutoff, cutoff)])
}

export async function clearLoginFailures(db: D1Database, phone: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(`phone:${phone}`).run()
}
