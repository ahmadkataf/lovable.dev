// The client against a fake server (globalThis.fetch) and a fake platform (storage in memory).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as ed from '@noble/ed25519'
import { b64url, bytesToHex, type TokenPayload } from './crypto'
import type { LicenseStatus } from './types'

const h = vi.hoisted(() => ({ store: { v: null as string | null }, kind: 'web' as 'web' | 'android' | 'electron' }))
vi.mock('../lib/platform', () => ({
  platform: {
    get kind() { return h.kind }, isDesktop: false, isAndroid: false, isWeb: true, isTouch: false,
    deviceId: async () => 'device-1', deviceName: async () => 'Test PC', appSignature: async () => 'web', appVersion: () => '1.0.0',
    openUrl: () => undefined, copy: async () => true,
    license: { get: async () => h.store.v, set: async (v: string | null) => { h.store.v = v } },
  },
}))

const enc = new TextEncoder()
const DAY = 86400000
const seed = ed.utils.randomSecretKey()
const pubHex = bytesToHex(await ed.getPublicKeyAsync(seed))
const sha = async (s: string) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))))
const device = await sha('kaseb:web:device-1')

async function makeToken(p: Partial<TokenPayload> = {}, key = seed): Promise<string> {
  const now = Date.now()
  const payload: TokenPayload = { v: 1, code: 'ABCDEFGHJKLM', d: device, p: 'full', iat: now, exp: null, gr: now + 10 * DAY, n: 'stored', srv: 'kaseb', ...p }
  const bytes = enc.encode(JSON.stringify(payload))
  return `${b64url(bytes)}.${b64url(await ed.signAsync(bytes, key))}`
}
const stored = () => (h.store.v ? JSON.parse(h.store.v) : null)
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const issued = async (nonce: string, p: Partial<TokenPayload> = {}) => {
  const now = Date.now()
  const exp = p.exp === undefined ? null : p.exp
  return reply({ token: await makeToken({ n: nonce, iat: now, gr: now + 10 * DAY, ...p }), status: { plan: p.p ?? 'full', expiresAt: exp, graceUntil: now + 10 * DAY, serverTime: now } })
}
type Handler = (path: string, body: Record<string, unknown>) => Promise<Response> | Response
let handler: Handler = () => reply({ error: 'unknown' }, 500)
const calls: { path: string; body: Record<string, unknown> }[] = []

async function load(api = 'https://api.test', key = pubHex) {
  vi.resetModules()
  vi.stubGlobal('__POS_API__', api)
  vi.stubGlobal('__POS_PUBLIC_KEY__', key)
  vi.stubGlobal('__POS_VERSION__', '1.0.0')
  vi.stubGlobal('__POS_BUILD__', 'test')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('https://api.test', '')
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    calls.push({ path, body })
    return handler(path, body)
  }))
  return (await import('./index')).license
}

beforeEach(() => { h.store.v = null; h.kind = 'web'; calls.length = 0; handler = () => reply({ error: 'unknown' }, 500) })
afterEach(() => { vi.unstubAllGlobals() })

describe('init', () => {
  it('is demo without a server', async () => {
    const license = await load('')
    const s = await license.init()
    expect(s.state).toBe('demo')
    expect(s.deviceCode).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
    expect(calls.length).toBe(0)
  })
  it('is none with nothing stored, and never waits for the network', async () => {
    handler = () => new Promise(() => undefined)   // a server that never answers
    const license = await load()
    const s = await license.init()
    expect(s.state).toBe('none')
    expect(s.deviceCode.length).toBe(9)
    expect(s.checking).toBe(false)
  })
  it('valid token → active with the code and dates', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now(), maxSeenTime: Date.now() })
    const license = await load()
    const s = await license.init()
    expect(s.state).toBe('active')
    expect(s.code).toBe('ABCD-EFGH-JKLM')
    expect(s.plan).toBe('full')
    expect(s.expiresAt).toBeNull()
    expect(s.graceUntil).toBeGreaterThan(Date.now())
  })
  it('bad signature → none and the token is thrown away', async () => {
    h.store.v = JSON.stringify({ token: await makeToken({}, ed.utils.randomSecretKey()) })
    const license = await load()
    expect((await license.init()).state).toBe('none')
    expect(stored().token).toBeNull()
  })
  it('a token for another device → none', async () => {
    h.store.v = JSON.stringify({ token: await makeToken({ d: await sha('kaseb:web:someone-else') }) })
    const license = await load()
    expect((await license.init()).state).toBe('none')
  })
  it('grace passed → locked; expired → expired; trial → trial', async () => {
    const now = Date.now()
    h.store.v = JSON.stringify({ token: await makeToken({ iat: now - 20 * DAY, gr: now - DAY }) })
    expect((await (await load()).init()).state).toBe('locked')
    h.store.v = JSON.stringify({ token: await makeToken({ exp: now - 1 }) })
    expect((await (await load()).init()).state).toBe('expired')
    h.store.v = JSON.stringify({ token: await makeToken({ p: 'trial', code: '', exp: now + 3 * DAY }) })
    const s = await (await load()).init()
    expect(s.state).toBe('trial')
    expect(s.code).toBeUndefined()
    expect(s.expiresAt).toBe(now + 3 * DAY)
  })
  it('a clock rolled back by more than an hour → locked until a check succeeds', async () => {
    const now = Date.now()
    h.store.v = JSON.stringify({ token: await makeToken(), maxSeenTime: now + 2 * 3600000 })
    const license = await load()
    expect((await license.init()).state).toBe('locked')
    handler = (_p, b) => issued(String(b.nonce))
    expect((await license.check()).state).toBe('active')
    expect(stored().maxSeenTime).toBeGreaterThanOrEqual(now + 2 * 3600000)   // never lowered
  })
  it('remembers a refusal across restarts', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), denied: { state: 'revoked', at: Date.now() } })
    const license = await load()
    const s = await license.init()
    expect(s.state).toBe('revoked')
    expect(s.code).toBe('ABCD-EFGH-JKLM')
  })
  it('loads the cached seller info', async () => {
    h.store.v = JSON.stringify({ token: null, info: { price: '40$', whatsapp: '963912345678', trialDays: 5 } })
    const s = await (await load()).init()
    expect(s.info?.price).toBe('40$')
    expect(s.info?.whatsapp).toBe('963912345678')
  })
})

describe('activate', () => {
  it('rejects a malformed code without touching the network', async () => {
    const license = await load()
    await license.init()
    const s = await license.activate('ABCD-EF')
    expect(s.state).toBe('none')
    expect(s.error).toBe('license.err.invalid_code')
    expect(calls.length).toBe(0)
  })
  it('stores the token and becomes active', async () => {
    handler = (p, b) => (p === '/api/activate' ? issued(String(b.nonce)) : reply({ error: 'not_found' }, 404))
    const license = await load()
    await license.init()
    const seen: LicenseStatus[] = []
    license.subscribe(s => seen.push(s))
    const s = await license.activate('abcd efgh jklm')
    expect(s.state).toBe('active')
    expect(s.code).toBe('ABCD-EFGH-JKLM')
    expect(s.error).toBeUndefined()
    expect(s.online).toBe(true)
    expect(stored().token).toBeTruthy()
    expect(stored().lastCheck).toBeGreaterThan(0)
    expect(calls[0].path).toBe('/api/activate')
    expect(calls[0].body.code).toBe('ABCDEFGHJKLM')
    expect(calls[0].body.device).toBe(device)
    expect(calls[0].body.platform).toBe('web')
    expect(seen.some(x => x.checking)).toBe(true)
    expect(seen[seen.length - 1].state).toBe('active')
  })
  it('a token with the wrong nonce is refused', async () => {
    handler = () => issued('not-the-nonce')
    const license = await load()
    await license.init()
    const s = await license.activate('ABCD-EFGH-JKLM')
    expect(s.state).toBe('none')
    expect(s.error).toBe('license.err.invalid_token')
    expect(stored()?.token ?? null).toBeNull()
  })
  it('shows the server error and keeps the state', async () => {
    handler = () => reply({ error: 'device_limit', message: 'مستخدم' }, 403)
    const license = await load()
    await license.init()
    const s = await license.activate('ABCD-EFGH-JKLM')
    expect(s.state).toBe('none')
    expect(s.error).toBe('license.err.device_limit')
    expect(s.errorText).toBe('مستخدم')
    expect(s.online).toBe(true)
  })
  it('network failure → online false, error network', async () => {
    handler = () => { throw new TypeError('fetch failed') }
    const license = await load()
    await license.init()
    const s = await license.activate('ABCD-EFGH-JKLM')
    expect(s.state).toBe('none')
    expect(s.online).toBe(false)
    expect(s.error).toBe('license.err.network')
  })
  it('tampered build → tampered', async () => {
    handler = () => reply({ error: 'tampered' }, 403)
    const license = await load()
    await license.init()
    expect((await license.activate('ABCD-EFGH-JKLM')).state).toBe('tampered')
  })
})

describe('trial', () => {
  it('starts a trial', async () => {
    handler = (p, b) => (p === '/api/trial' ? issued(String(b.nonce), { p: 'trial', code: '', exp: Date.now() + 7 * DAY }) : reply({ error: 'not_found' }, 404))
    const license = await load()
    await license.init()
    const s = await license.startTrial()
    expect(s.state).toBe('trial')
    expect(s.plan).toBe('trial')
    expect(s.expiresAt).toBeGreaterThan(Date.now())
    expect(stored().token).toBeTruthy()
  })
  it('no_trial keeps none with the error', async () => {
    handler = () => reply({ error: 'no_trial' }, 403)
    const license = await load()
    await license.init()
    const s = await license.startTrial()
    expect(s.state).toBe('none')
    expect(s.error).toBe('license.err.no_trial')
  })
})

describe('check', () => {
  it('refreshes the token', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: 1 })
    handler = (p, b) => (p === '/api/check' ? issued(String(b.nonce), { exp: Date.now() + 365 * DAY }) : reply({ error: 'not_found' }, 404))
    const license = await load()
    await license.init()
    const s = await license.check()
    expect(s.state).toBe('active')
    expect(s.expiresAt).toBeGreaterThan(Date.now())
    expect(s.lastCheck).toBeGreaterThan(1)
    expect(calls[0].body.token).toBeTruthy()
    expect(stored().lastCheck).toBe(s.lastCheck)
  })
  it('server says revoked → revoked (and after a restart too)', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now() })
    handler = () => reply({ error: 'revoked' }, 403)
    const license = await load()
    await license.init()
    const s = await license.check()
    expect(s.state).toBe('revoked')
    expect(s.error).toBe('license.err.revoked')
    expect(stored().denied.state).toBe('revoked')
    const again = await (await load()).init()
    expect(again.state).toBe('revoked')
  })
  it('device_mismatch → revoked, expired → expired, invalid_token → none, min_version keeps the state', async () => {
    for (const [err, state] of [['device_mismatch', 'revoked'], ['expired', 'expired'], ['invalid_token', 'none'], ['min_version', 'active']] as const) {
      h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now() })
      handler = () => reply({ error: err }, 403)
      const license = await load()
      await license.init()
      const s = await license.check()
      expect(s.state, err).toBe(state)
      expect(s.error).toBe(`license.err.${err}`)
    }
    expect(stored().token).toBeTruthy()   // min_version: the token is kept
  })
  it('network failure keeps the state and sets online=false', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now() })
    handler = () => { throw new TypeError('offline') }
    const license = await load()
    expect((await license.init()).state).toBe('active')
    const s = await license.check()
    expect(s.state).toBe('active')
    expect(s.online).toBe(false)
    expect(s.error).toBe('license.err.network')
    expect(stored().token).toBeTruthy()
  })
  it('a 15 s timeout counts as a network failure', async () => {
    vi.useFakeTimers()
    try {
      h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now() })
      handler = (_p, _b) => new Promise<Response>((_, reject) => { /* only the abort ends it */ void _b; void reject })
      vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))) })))
      vi.resetModules(); vi.stubGlobal('__POS_API__', 'https://api.test'); vi.stubGlobal('__POS_PUBLIC_KEY__', pubHex); vi.stubGlobal('__POS_VERSION__', '1'); vi.stubGlobal('__POS_BUILD__', 't')
      const license = (await import('./index')).license
      await license.init()
      const p = license.check()
      await vi.advanceTimersByTimeAsync(16000)
      const s = await p
      expect(s.state).toBe('active')
      expect(s.online).toBe(false)
    } finally { vi.useRealTimers() }
  })
  it('without a token it only refreshes the seller info', async () => {
    handler = p => (p === '/api/info' ? reply({ price: '50$', whatsapp: '+963 9', trialDays: 3, message: 'hi', graceDays: 10 }) : reply({ error: 'x' }, 400))
    const license = await load()
    await license.init()
    const s = await license.check()
    expect(s.state).toBe('none')
    expect(s.info?.price).toBe('50$')
    expect(s.info?.whatsapp).toBe('9639')
    expect(s.info?.trialDays).toBe(3)
    expect(stored().info.price).toBe('50$')
    expect(calls.every(c => c.path === '/api/info')).toBe(true)
  })
})

describe('release', () => {
  it('frees the device: back to none', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now() })
    handler = p => (p === '/api/release' ? reply({ ok: true }) : reply({ error: 'x' }, 400))
    const license = await load()
    await license.init()
    const s = await license.release()
    expect(s.state).toBe('none')
    expect(s.code).toBeUndefined()
    expect(stored().token).toBeNull()
  })
  it('move_limit keeps the license', async () => {
    h.store.v = JSON.stringify({ token: await makeToken(), lastCheck: Date.now() })
    handler = () => reply({ error: 'move_limit' }, 403)
    const license = await load()
    await license.init()
    const s = await license.release()
    expect(s.state).toBe('active')
    expect(s.error).toBe('license.err.move_limit')
  })
})

describe('subscribe', () => {
  it('publishes every status change and can unsubscribe', async () => {
    handler = (p, b) => (p === '/api/activate' ? issued(String(b.nonce)) : reply({ error: 'x' }, 400))
    const license = await load()
    const seen: string[] = []
    const off = license.subscribe(s => seen.push(`${s.state}:${s.checking}`))
    await license.init()
    await license.activate('ABCD-EFGH-JKLM')
    expect(seen).toContain('none:false')
    expect(seen).toContain('none:true')
    expect(seen).toContain('active:true')
    expect(seen[seen.length - 1]).toBe('active:false')
    off()
    const n = seen.length
    await license.check()
    expect(seen.length).toBe(n)
  })
})
