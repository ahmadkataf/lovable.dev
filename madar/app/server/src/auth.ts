// Login tokens (docs/mvp-spec.md §4): base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, secret)).
// Web Crypto only, so the same code runs in the Worker and in vitest.
import { createMiddleware } from 'hono/factory'
import { ApiError, type AppEnv, type Env, type Role, type User } from './types'

export interface TokenPayload { uid: number; role: Role; exp: number }   // exp: unix seconds

export const TOKEN_DAYS = 30
export const ROLES: Role[] = ['directorate', 'school', 'teacher', 'student', 'parent']

const enc = new TextEncoder()
const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string): Uint8Array => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0))

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}
/** Constant-time string comparison for secrets (the admin key); only the length may leak. */
export const safeEqual = (a: string | undefined | null, b: string | undefined | null): boolean =>
  typeof a === 'string' && typeof b === 'string' && a.length > 0 && sameBytes(enc.encode(a), enc.encode(b))

/**
 * The HMAC secret. A deployment that serves https (APP_URL) must have TOKEN_SECRET set; the 'dev-secret' default is
 * only for `wrangler dev`, the smoke test and vitest, where APP_URL is http://localhost or unset.
 */
export function secretOf(env: Pick<Env, 'TOKEN_SECRET' | 'APP_URL'>): string {
  if (env.TOKEN_SECRET) return env.TOKEN_SECRET
  if ((env.APP_URL ?? '').startsWith('https://')) throw new Error('TOKEN_SECRET unset')
  return 'dev-secret'
}

export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${b64url(await hmac(secret, body))}`
}

/** The payload of a valid, unexpired token, or null. */
export async function verifyToken(token: unknown, secret: string, now = Date.now()): Promise<TokenPayload | null> {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  try {
    if (!sameBytes(await hmac(secret, parts[0]), fromB64url(parts[1]))) return null
    const p = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]))) as Partial<TokenPayload>
    if (typeof p.uid !== 'number' || typeof p.exp !== 'number' || !ROLES.includes(p.role as Role)) return null
    return p.exp * 1000 > now ? (p as TokenPayload) : null
  } catch { return null }
}

export const newPayload = (uid: number, role: Role, now = Date.now()): TokenPayload =>
  ({ uid, role, exp: Math.floor(now / 1000) + TOKEN_DAYS * 86400 })

/** Fixed-window rate limiter kept in memory (per isolate) — enough for the pilot's login endpoint. */
export class RateLimiter {
  private hits = new Map<string, { n: number; start: number }>()
  constructor(private limit: number, private windowMs: number) {}
  /** Records one attempt and tells whether it is still allowed. */
  hit(key: string, now = Date.now()): boolean {
    if (this.hits.size > 10000) for (const [k, v] of this.hits) if (now - v.start > this.windowMs) this.hits.delete(k)
    const h = this.hits.get(key)
    if (!h || now - h.start > this.windowMs) { this.hits.set(key, { n: 1, start: now }); return true }
    h.n++
    return h.n <= this.limit
  }
  /** Forgets a key (after a successful login only failed attempts should count). */
  clear(key: string): void { this.hits.delete(key) }
}
export const loginLimiter = new RateLimiter(20, 10 * 60 * 1000)
export const adminLimiter = new RateLimiter(10, 60 * 1000)

/** The caller's address for rate limiting (Cloudflare sets cf-connecting-ip; local runs share one bucket). */
export const clientIp = (c: { req: { header(name: string): string | undefined } }): string => c.req.header('cf-connecting-ip') ?? 'local'

/** Reads the Bearer token, loads the user and (optionally) restricts the roles allowed on the route. */
export const requireAuth = (...roles: Role[]) => createMiddleware<AppEnv>(async (c, next) => {
  // The token travels only in the Authorization header (the client downloads the CSV with fetch + Blob, never as a
  // plain link), so it never lands in access logs, browser history or referrers.
  const token = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const payload = await verifyToken(token, secretOf(c.env))
  if (!payload) throw new ApiError(401, 'يلزم تسجيل الدخول')
  const user = await c.env.DB.prepare('SELECT id, role, name, school_id, subject_id FROM users WHERE id = ?').bind(payload.uid).first<User>()
  if (!user || user.role !== payload.role) throw new ApiError(401, 'انتهت صلاحية الجلسة، يلزم تسجيل الدخول مجدّداً')
  if (roles.length && !roles.includes(user.role)) throw new ApiError(403, 'غير مصرّح بهذا الإجراء لهذا الدور')
  c.set('user', user)
  await next()
})
