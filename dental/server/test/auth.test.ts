import { beforeAll, describe, expect, it } from 'vitest'
import {
  addressKey, clearAttempts, deriveSessionKey, MAX_OVERALL, MAX_PER_IP, passwordMatches, readCookie, readToken,
  sameOriginWrite, sessionCookie, signToken, takeAttempt, WINDOW_MS,
} from '../src/auth'
import { ensureSchema } from '../src/db'
import { b64url } from '../src/http'
import { memoryD1 } from './d1'

const now = Math.floor(Date.now() / 1000)

describe('tokens', () => {
  let key: CryptoKey
  beforeAll(async () => { key = await deriveSessionKey('a-long-admin-password', 'salt-1') })
  it('verifies a fresh token and gives its claims', async () => {
    const t = await signToken(key, 'session', now + 60, 'sid-1')
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(await readToken(key, 'session', t, now)).toEqual({ exp: now + 60, sid: 'sid-1' })
  })
  it('gives each token its own id', async () => {
    const [a, b] = await Promise.all([signToken(key, 'session', now + 60), signToken(key, 'session', now + 60)])
    expect((await readToken(key, 'session', a, now))?.sid).not.toBe((await readToken(key, 'session', b, now))?.sid)
  })
  it('refuses an expired token', async () => {
    const t = await signToken(key, 'session', now + 60)
    expect(await readToken(key, 'session', t, now + 61)).toBeNull()
    expect(await readToken(key, 'session', await signToken(key, 'session', now - 1), now)).toBeNull()
  })
  it('refuses a device token as a session, and the other way round', async () => {
    expect(await readToken(key, 'session', await signToken(key, 'device', now + 60), now)).toBeNull()
    expect(await readToken(key, 'device', await signToken(key, 'session', now + 60), now)).toBeNull()
  })
  it('refuses a token with a changed payload or signature', async () => {
    const t = await signToken(key, 'session', now + 60, 'sid-1')
    const [, sig] = t.split('.')
    const forged = `${b64url(new TextEncoder().encode(JSON.stringify({ exp: now + 999_999, sid: 'sid-1' })))}.${sig}`
    expect(await readToken(key, 'session', forged, now)).toBeNull()
    const flipped = t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA')
    expect(await readToken(key, 'session', flipped, now)).toBeNull()
    expect(await readToken(key, 'session', `${t}.extra`, now)).toBeNull()
    expect(await readToken(key, 'session', '', now)).toBeNull()
    expect(await readToken(key, 'session', 'garbage', now)).toBeNull()
  })
  it('refuses a token made with another password or salt (a new password signs everyone out)', async () => {
    const t = await signToken(key, 'session', now + 60)
    expect(await readToken(await deriveSessionKey('another-long-password', 'salt-1'), 'session', t, now)).toBeNull()
    expect(await readToken(await deriveSessionKey('a-long-admin-password', 'salt-2'), 'session', t, now)).toBeNull()
  })
})

describe('cookies', () => {
  it('sets the flags of SPEC.md, with the __Host- prefix', () => {
    expect(sessionCookie('abc')).toBe('__Host-dentora_admin=abc; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200')
  })
  it('reads the session cookie among others, and not the old unprefixed name', () => {
    const r = new Request('https://x/', { headers: { Cookie: 'a=1; dentora_admin=planted; __Host-dentora_admin=tok.sig; b=2' } })
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
  const t0 = 1_800_000_000_000
  it(`lets ${MAX_PER_IP} attempts through per address, the last one already saying how long to wait`, async () => {
    const db = memoryD1(); await ensureSchema(db)
    for (let i = 0; i < MAX_PER_IP - 1; i++) expect(await takeAttempt(db, '1.1.1.1', false, t0 + i * 1000)).toEqual({ allowed: true, retryAfter: 0 })
    expect(await takeAttempt(db, '1.1.1.1', false, t0 + 10_000)).toEqual({ allowed: true, retryAfter: Math.ceil((WINDOW_MS - 10_000) / 1000) })
    const refused = await takeAttempt(db, '1.1.1.1', false, t0 + 20_000)
    expect(refused.allowed).toBe(false)
    expect(refused.retryAfter).toBe(Math.ceil((WINDOW_MS - 20_000) / 1000))
    expect((await takeAttempt(db, '2.2.2.2', false, t0 + 20_000)).allowed).toBe(true)
    // Refused attempts are not recorded: the lock ends when the first attempt leaves the window.
    expect((await takeAttempt(db, '1.1.1.1', false, t0 + WINDOW_MS + 1)).allowed).toBe(true)
  })
  it(`pauses browsers that never signed in after ${MAX_OVERALL} attempts from anywhere, not a known device`, async () => {
    const db = memoryD1(); await ensureSchema(db)
    for (let i = 0; i < MAX_OVERALL; i++) expect((await takeAttempt(db, `10.0.0.${i}`, false, t0 + i)).allowed).toBe(true)
    const stranger = await takeAttempt(db, '9.9.9.9', false, t0 + 100)
    expect(stranger.allowed).toBe(false)
    expect(stranger.retryAfter).toBeGreaterThan(0)
    expect(await takeAttempt(db, '9.9.9.10', true, t0 + 100)).toEqual({ allowed: true, retryAfter: 0 })
  })
  it('forgets an address after a successful login', async () => {
    const db = memoryD1(); await ensureSchema(db)
    for (let i = 0; i < MAX_PER_IP; i++) await takeAttempt(db, '3.3.3.3', false, t0)
    expect((await takeAttempt(db, '3.3.3.3', false, t0)).allowed).toBe(false)
    await clearAttempts(db, '3.3.3.3')
    expect((await takeAttempt(db, '3.3.3.3', false, t0)).allowed).toBe(true)
  })
  it('counts IPv6 per /64 and IPv4 per address', () => {
    expect(addressKey('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64')
    expect(addressKey('2001:0db8:0001:0002:ffff:eeee:dddd:cccc')).toBe('2001:db8:1:2::/64')
    expect(addressKey('2001:DB8:1:2:3::')).toBe('2001:db8:1:2::/64')
    expect(addressKey('2001:db8::5')).toBe('2001:db8:0:0::/64')
    expect(addressKey('::1')).toBe('0:0:0:0::/64')
    expect(addressKey('::ffff:192.0.2.1')).toBe('192.0.2.1')
    expect(addressKey('192.0.2.1')).toBe('192.0.2.1')
    expect(addressKey('')).toBe('')
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
