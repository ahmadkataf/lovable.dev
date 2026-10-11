import { beforeAll, describe, expect, it } from 'vitest'
import {
  clearFailures, deriveSessionKey, lockedFor, MAX_OVERALL, MAX_PER_IP, passwordMatches, readCookie, recordFailure,
  sameOriginWrite, sessionCookie, signSession, verifySession, WINDOW_MS,
} from '../src/auth'
import { ensureSchema } from '../src/db'
import { b64url } from '../src/http'
import { memoryD1 } from './d1'

const now = Math.floor(Date.now() / 1000)

describe('session tokens', () => {
  let key: CryptoKey
  beforeAll(async () => { key = await deriveSessionKey('a-long-admin-password', 'salt-1') })
  it('verifies a fresh token', async () => {
    const t = await signSession(key, now + 60)
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(await verifySession(key, t, now)).toBe(true)
  })
  it('refuses an expired token', async () => {
    const t = await signSession(key, now + 60)
    expect(await verifySession(key, t, now + 61)).toBe(false)
    expect(await verifySession(key, await signSession(key, now - 1), now)).toBe(false)
  })
  it('refuses a token with a changed payload or signature', async () => {
    const t = await signSession(key, now + 60)
    const [, sig] = t.split('.')
    const forged = `${b64url(new TextEncoder().encode(JSON.stringify({ exp: now + 999_999 })))}.${sig}`
    expect(await verifySession(key, forged, now)).toBe(false)
    const flipped = t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA')
    expect(await verifySession(key, flipped, now)).toBe(false)
    expect(await verifySession(key, `${t}.extra`, now)).toBe(false)
    expect(await verifySession(key, '', now)).toBe(false)
    expect(await verifySession(key, 'garbage', now)).toBe(false)
  })
  it('refuses a token made with another password or salt (a new password signs everyone out)', async () => {
    const t = await signSession(key, now + 60)
    expect(await verifySession(await deriveSessionKey('another-long-password', 'salt-1'), t, now)).toBe(false)
    expect(await verifySession(await deriveSessionKey('a-long-admin-password', 'salt-2'), t, now)).toBe(false)
  })
})

describe('cookies', () => {
  it('sets the flags of SPEC.md', () => {
    expect(sessionCookie('abc')).toBe('dentora_admin=abc; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200')
  })
  it('reads the session cookie among others', () => {
    const r = new Request('https://x/', { headers: { Cookie: 'a=1; dentora_admin=tok.sig; b=2' } })
    expect(readCookie(r)).toBe('tok.sig')
    expect(readCookie(new Request('https://x/'))).toBeNull()
  })
})

describe('password', () => {
  it('matches only the exact password', async () => {
    expect(await passwordMatches('qa-dentora-pass-2026', 'qa-dentora-pass-2026')).toBe(true)
    expect(await passwordMatches('qa-dentora-pass-2025', 'qa-dentora-pass-2026')).toBe(false)
    expect(await passwordMatches('', 'qa-dentora-pass-2026')).toBe(false)
    expect(await passwordMatches('qa-dentora-pass-2026 ', 'qa-dentora-pass-2026')).toBe(false)
  })
})

describe('login rate limit', () => {
  it(`locks an address after ${MAX_PER_IP} failures for the rest of the window`, async () => {
    const db = memoryD1(); await ensureSchema(db)
    const t0 = 1_800_000_000_000
    for (let i = 0; i < MAX_PER_IP - 1; i++) await recordFailure(db, '1.1.1.1', t0 + i * 1000)
    expect(await lockedFor(db, '1.1.1.1', t0 + 10_000)).toBe(0)
    await recordFailure(db, '1.1.1.1', t0 + 10_000)
    const wait = await lockedFor(db, '1.1.1.1', t0 + 10_000)
    expect(wait).toBe(Math.ceil((t0 + WINDOW_MS - (t0 + 10_000)) / 1000))
    expect(await lockedFor(db, '2.2.2.2', t0 + 10_000)).toBe(0)
    // Open again once the first failure leaves the window.
    expect(await lockedFor(db, '1.1.1.1', t0 + WINDOW_MS + 1)).toBe(0)
  })
  it(`locks everyone after ${MAX_OVERALL} failures from anywhere`, async () => {
    const db = memoryD1(); await ensureSchema(db)
    const t0 = 1_800_000_000_000
    for (let i = 0; i < MAX_OVERALL; i++) await recordFailure(db, `10.0.0.${i}`, t0 + i)
    expect(await lockedFor(db, '9.9.9.9', t0 + 100)).toBeGreaterThan(0)
  })
  it('forgets an address after a successful login', async () => {
    const db = memoryD1(); await ensureSchema(db)
    const t0 = Date.now()
    for (let i = 0; i < MAX_PER_IP; i++) await recordFailure(db, '3.3.3.3', t0)
    expect(await lockedFor(db, '3.3.3.3', t0)).toBeGreaterThan(0)
    await clearFailures(db, '3.3.3.3')
    expect(await lockedFor(db, '3.3.3.3', t0)).toBe(0)
  })
})

describe('CSRF', () => {
  const req = (headers: Record<string, string>) => new Request('https://dentora.raqeem.dev/api/licences', { method: 'POST', headers })
  it('needs X-Dentora: 1', () => {
    expect(sameOriginWrite(req({}))).toBe(false)
    expect(sameOriginWrite(req({ 'X-Dentora': '0' }))).toBe(false)
    expect(sameOriginWrite(req({ 'X-Dentora': '1' }))).toBe(true)
  })
  it('refuses another origin', () => {
    expect(sameOriginWrite(req({ 'X-Dentora': '1', Origin: 'https://dentora.raqeem.dev' }))).toBe(true)
    expect(sameOriginWrite(req({ 'X-Dentora': '1', Origin: 'https://evil.example' }))).toBe(false)
    expect(sameOriginWrite(req({ 'X-Dentora': '1', Origin: 'null' }))).toBe(false)
  })
})
