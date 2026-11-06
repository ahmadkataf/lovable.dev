import { describe, expect, it } from 'vitest'
import { RateLimiter, newPayload, safeEqual, secretOf, signToken, verifyToken } from '../src/auth'

describe('token secret', () => {
  it('uses the configured secret, refuses to run an https deployment without one, and keeps the dev default locally', () => {
    expect(secretOf({ TOKEN_SECRET: 's3cret', APP_URL: 'https://app.madar.raqeem.dev' })).toBe('s3cret')
    expect(() => secretOf({ APP_URL: 'https://app.madar.raqeem.dev' })).toThrow('TOKEN_SECRET unset')
    expect(() => secretOf({ TOKEN_SECRET: '', APP_URL: 'https://madar-app.almutafawiqin.workers.dev' })).toThrow('TOKEN_SECRET unset')
    expect(secretOf({ APP_URL: 'http://localhost:8787' })).toBe('dev-secret')
    expect(secretOf({})).toBe('dev-secret')
  })

  it('compares secrets in constant time and never matches an empty or missing key', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
    expect(safeEqual(undefined, 'abc')).toBe(false)
    expect(safeEqual('abc', undefined)).toBe(false)
  })
})

describe('login tokens', () => {
  const secret = 'test-secret'

  it('round-trips a payload', async () => {
    const payload = newPayload(42, 'teacher')
    const token = await signToken(payload, secret)
    expect(token.split('.')).toHaveLength(2)
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)   // base64url, no padding
    expect(await verifyToken(token, secret)).toEqual(payload)
  })

  it('lasts 30 days', () => {
    const now = Date.UTC(2026, 0, 1)
    expect(newPayload(1, 'student', now).exp).toBe(now / 1000 + 30 * 86400)
  })

  it('rejects a tampered payload, a tampered signature and the wrong secret', async () => {
    const token = await signToken(newPayload(42, 'teacher'), secret)
    const [body, sig] = token.split('.')
    const forgedBody = btoa(JSON.stringify({ uid: 1, role: 'directorate', exp: 9e9 })).replace(/=+$/, '')
    expect(await verifyToken(`${forgedBody}.${sig}`, secret)).toBeNull()
    expect(await verifyToken(`${body}.${sig.slice(0, -2)}AA`, secret)).toBeNull()
    expect(await verifyToken(token, 'other-secret')).toBeNull()
    expect(await verifyToken('garbage', secret)).toBeNull()
    expect(await verifyToken(undefined, secret)).toBeNull()
  })

  it('rejects an expired token and an unknown role', async () => {
    const expired = await signToken({ uid: 1, role: 'parent', exp: Math.floor(Date.now() / 1000) - 1 }, secret)
    expect(await verifyToken(expired, secret)).toBeNull()
    const weird = await signToken({ uid: 1, role: 'admin' as never, exp: 9e9 }, secret)
    expect(await verifyToken(weird, secret)).toBeNull()
  })
})

describe('login rate limit', () => {
  it('allows 20 attempts per window and resets afterwards', () => {
    const rl = new RateLimiter(20, 10 * 60 * 1000)
    const t0 = 1_000_000
    for (let i = 0; i < 20; i++) expect(rl.hit('1.2.3.4', t0 + i)).toBe(true)
    expect(rl.hit('1.2.3.4', t0 + 21)).toBe(false)
    expect(rl.hit('5.6.7.8', t0 + 21)).toBe(true)                 // another address is unaffected
    expect(rl.hit('1.2.3.4', t0 + 10 * 60 * 1000 + 1)).toBe(true)  // window over
  })
})
