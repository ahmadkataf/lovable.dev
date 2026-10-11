// Codes are signed here with a throwaway key pair and checked with the app's own checkers against its public half,
// so the tests never need (or touch) the seller's real private key.
import { beforeAll, describe, expect, it } from 'vitest'
import { checkCode, checkResetCode } from '../../src/license/core.ts'
import { licenceMessage, loadSigner, makeActivation, makeReset, resetMessage, verifyCode, whatsappTo } from '../src/licence'
import type { Licence, ResetCode } from '../src/types'

let key: CryptoKey
let pub: JsonWebKey
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  key = pair.privateKey
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey)
  pub = { kty, crv, x, y }
})

const DEVICE = 'ab2c-d3ef', OTHER = 'ZZZZ-9999'

describe('activation codes', () => {
  it('a lifetime code opens the app on its device only', async () => {
    const issued = await makeActivation(key, DEVICE, 'pro', null, pub)
    expect(issued.device).toBe('AB2C-D3EF')
    expect(issued.until).toBeNull()
    expect(issued.code.replace(/-/g, '')).toHaveLength(112)
    const ok = await checkCode('AB2CD3EF', issued.code, new Date(), pub)
    expect(ok).toEqual({ ok: true, plan: 'pro', until: null })
    expect(await checkCode(OTHER, issued.code, new Date(), pub)).toEqual({ ok: false, reason: 'device' })
  })
  it('a dated code carries its last day', async () => {
    const until = new Date(Date.UTC(2031, 4, 20))
    const issued = await makeActivation(key, DEVICE, 'standard', until, pub)
    expect(issued.until).toBe('2031-05-20')
    const r = await checkCode(DEVICE, issued.code, new Date(), pub)
    expect(r.ok && r.plan === 'standard' && r.until?.toISOString().slice(0, 10)).toBe('2031-05-20')
  })
  it('refuses a device number that is not one', async () => {
    await expect(makeActivation(key, 'AB1C-D3EF', 'pro', null, pub)).rejects.toThrow('device')
  })
})

describe('PIN reset codes', () => {
  it('works on its device today and tomorrow, not after', async () => {
    const now = new Date()
    const r = await makeReset(key, DEVICE, now, pub)
    expect(r.device).toBe('AB2C-D3EF')
    expect(r.day).toBe(now.toISOString().slice(0, 10))
    expect((await checkResetCode(DEVICE, r.code, now, pub)).ok).toBe(true)
    expect((await checkResetCode(OTHER, r.code, now, pub))).toEqual({ ok: false, reason: 'device' })
    expect((await checkResetCode(DEVICE, r.code, new Date(now.getTime() + 3 * 86_400_000), pub))).toEqual({ ok: false, reason: 'expired' })
    // An activation checker does not take a reset code (and the reverse).
    expect(await checkCode(DEVICE, r.code, now, pub)).toEqual({ ok: false, reason: 'kind' })
  })
})

describe('verifyCode', () => {
  it('tells the kind and the result', async () => {
    const act = await makeActivation(key, DEVICE, 'pro', new Date(Date.UTC(2030, 0, 1)), pub)
    expect(await verifyCode('ab2cd3ef', act.code, new Date(), pub)).toEqual({ kind: 'activation', ok: true, plan: 'pro', until: '2030-01-01' })
    expect(await verifyCode(OTHER, act.code, new Date(), pub)).toEqual({ kind: 'activation', ok: false, reason: 'device' })
    const late = new Date(Date.UTC(2030, 0, 5))
    expect(await verifyCode(DEVICE, act.code, late, pub)).toEqual({ kind: 'activation', ok: false, reason: 'expired', plan: 'pro', until: '2030-01-01' })
    const reset = await makeReset(key, DEVICE, new Date(), pub)
    expect(await verifyCode(DEVICE, reset.code, new Date(), pub)).toEqual({ kind: 'reset', ok: true, until: reset.lastDay })
    expect(await verifyCode(DEVICE, 'not a code', new Date(), pub)).toEqual({ kind: null, ok: false, reason: 'format' })
  })
  it('finds the code inside a whole pasted message', async () => {
    const act = await makeActivation(key, DEVICE, 'pro', null, pub)
    const lic = { ...act, id: 'x', customer: '', clinic: 'عيادة النور', phone: '', price: 59, note: '', status: 'active', createdAt: '' } as Licence
    const pasted = licenceMessage(lic).ar
    expect((await verifyCode(DEVICE, pasted, new Date(), pub)).ok).toBe(true)
  })
})

describe('the signing secret', () => {
  it('reports a missing, malformed or foreign key', async () => {
    expect(await loadSigner(undefined)).toEqual({ ok: false, error: 'missing' })
    expect(await loadSigner('   ')).toEqual({ ok: false, error: 'missing' })
    expect(await loadSigner('{not json')).toEqual({ ok: false, error: 'format' })
    expect(await loadSigner('{"kty":"RSA"}')).toEqual({ ok: false, error: 'format' })
    expect(await loadSigner(JSON.stringify(await crypto.subtle.exportKey('jwk', key)))).toEqual({ ok: false, error: 'mismatch' })
  })
})

describe('customer messages', () => {
  const lic: Licence = {
    id: '1', device: 'AB2C-D3EF', plan: 'standard', until: '2027-10-11', code: 'ABCD-EFGH', customer: 'Dr. Sami', clinic: '',
    phone: '0996 489 504', price: 59, note: '', status: 'active', createdAt: '2026-10-11T00:00:00.000Z',
  }
  it('carries the code in both languages and a wa.me link to the customer', () => {
    const m = licenceMessage(lic)
    expect(m.ar).toContain('ABCD-EFGH')
    expect(m.ar).toContain('Dr. Sami')
    expect(m.en).toContain('valid until 2027-10-11')
    expect(m.whatsappUrl).toMatch(/^https:\/\/wa\.me\/963996489504\?text=/)
  })
  it('has no link without a usable phone', () => {
    expect(licenceMessage({ ...lic, phone: '' }).whatsappUrl).toBeNull()
    expect(whatsappTo('12', 'x')).toBeNull()
  })
  it('makes reset messages too', () => {
    const r: ResetCode = { id: '1', device: 'AB2C-D3EF', code: 'WXYZ', day: '2026-10-11', lastDay: '2026-10-12', customer: '', phone: '+963 996 489 504', note: '', createdAt: '' }
    const m = resetMessage(r)
    expect(m.en).toContain('valid until 2026-10-12')
    expect(m.whatsappUrl).toMatch(/^https:\/\/wa\.me\/963996489504\?/)
  })
})
