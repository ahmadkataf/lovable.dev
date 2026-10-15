// Codes are signed here with a throwaway key pair and checked with the app's own checkers against its public half,
// so the tests never need (or touch) the seller's real private key.
import { beforeAll, describe, expect, it } from 'vitest'
import { checkCode, checkResetCode } from '../../src/license/core.ts'
import {
  cleanKey, keyMessage, keyUntil, licenceMessage, loadSigner, makeActivation, makeReset, newKey, resetMessage, verifyCode,
  verifyKey, whatsappTo,
} from '../src/licence'
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
    const lic = { ...act, id: 'x', key: null, validity: null, activatedAt: null, customer: '', clinic: 'عيادة النور', phone: '', price: 59, note: '', status: 'active', createdAt: '' } as Licence
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
    id: '1', device: 'AB2C-D3EF', plan: 'standard', until: '2027-10-11', code: 'ABCD-EFGH', key: null, validity: null, activatedAt: null,
    customer: 'Dr. Sami', clinic: '', phone: '0996 489 504', price: 59, note: '', status: 'active', createdAt: '2026-10-11T00:00:00.000Z',
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

describe('licence keys', () => {
  const KEY = 'K2M4-P6R8-T9V3-X5Z7'
  const sold: Licence = {
    id: 'k', device: '', plan: 'pro', until: null, code: '', key: KEY, validity: 'lifetime', activatedAt: null,
    customer: 'Dr. Lina', clinic: 'عيادة النور', phone: '+963 996 489 504', price: 59, note: '', status: 'active', createdAt: '2026-10-11T00:00:00.000Z',
  }
  it('are 16 characters of the codes’ alphabet, grouped in fours, and never repeat', () => {
    const keys = Array.from({ length: 500 }, newKey)
    for (const k of keys) expect(k).toMatch(/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/)
    expect(new Set(keys).size).toBe(500)
  })
  it('are read in any case, with or without dashes and spaces, with Arabic-Indic digits', () => {
    expect(cleanKey('k2m4p6r8t9v3x5z7')).toBe(KEY)
    expect(cleanKey(' K2M4 P6R8 - T9V3 X5Z7 ')).toBe(KEY)
    expect(cleanKey('K٢M٤-P٦R٨-T٩V٣-X٥Z٧')).toBe(KEY)
    expect(cleanKey('K2M4-P6R8-T9V3-X5Z')).toBeNull()
    expect(cleanKey('K2M4-P6R8-T9V3-X5Z77')).toBeNull()
    expect(cleanKey('K0M4-P6R8-T9V3-X5Z7')).toBeNull()
    expect(cleanKey('KIM4-P6R8-T9V3-X5Z7')).toBeNull()
    expect(cleanKey('')).toBeNull()
  })
  it('get their last day on activation: 1y/2y from that day, a date as sold, refused after it', () => {
    const at = new Date(Date.UTC(2027, 1, 3, 22, 30))
    expect(keyUntil({ validity: 'lifetime', until: null }, at)).toBeNull()
    expect(keyUntil({ validity: '1y', until: null }, at)?.toISOString()).toBe('2028-02-03T00:00:00.000Z')
    expect(keyUntil({ validity: '2y', until: null }, at)?.toISOString()).toBe('2029-02-03T00:00:00.000Z')
    expect(keyUntil({ validity: 'date', until: '2027-02-03' }, at)?.toISOString()).toBe('2027-02-03T00:00:00.000Z')
    expect(keyUntil({ validity: 'date', until: '2027-02-02' }, at)).toBeUndefined()
  })
  it('have a message with the key, the term and both ways to activate, in Arabic and English', () => {
    const m = keyMessage(sold)
    expect(m.ar.split('\n')[2]).toBe(`\u200E${KEY}`)
    expect(m.en.split('\n')[2]).toBe(KEY)
    expect(m.ar).toContain('عيادة النور')
    expect(m.ar).toContain('الباقة الاحترافية — ترخيص دائم')
    expect(m.ar).toContain('https://dentora.raqeem.dev/activate')
    expect(m.ar).toContain('جهاز واحد فقط')
    expect(m.en).toContain('Pro plan — lifetime licence')
    expect(m.en).toContain('Settings → Licence')
    // the in-app route needs 1.1.0 (1.0.0 takes no key in that field); the page is for any version
    expect(m.en).toContain('To activate (Dentora 1.1.0 or later)')
    expect(m.en).toContain('Or, with any version,')
    expect(m.ar).toContain('في الإصدار 1.1.0 فما بعده')
    expect(m.ar).toContain('مع أي إصدار')
    expect(m.en).toContain('https://dentora.raqeem.dev/en/activate')
    expect(m.en).toContain('one device only')
    expect(m.en).not.toContain('undefined')
    expect(m.whatsappUrl).toMatch(/^https:\/\/wa\.me\/963996489504\?text=/)
    expect(keyMessage({ ...sold, validity: '1y', plan: 'standard' }).en).toContain('Standard plan — valid for one year from activation')
    expect(keyMessage({ ...sold, validity: '2y' }).ar).toContain('صالح لسنتين من يوم التفعيل')
    expect(keyMessage({ ...sold, validity: 'date', until: '2027-12-31' }).ar).toContain('صالح حتى \u200E2027-12-31')
  })
  it('send the key message while waiting, the code message once activated', async () => {
    expect(licenceMessage(sold).en).toContain(KEY)
    const act = await makeActivation(key, DEVICE, 'pro', null, pub)
    const done = licenceMessage({ ...sold, device: act.device, code: act.code, activatedAt: '2026-10-12T08:00:00.000Z' })
    expect(done.en).toContain(act.code)
    expect(done.en).not.toContain(KEY)
    expect((await verifyCode(DEVICE, done.ar, new Date(), pub)).ok).toBe(true)
  })
  it('say where they stand', () => {
    const now = new Date(Date.UTC(2027, 0, 10))
    expect(verifyKey(null, now)).toEqual({ kind: 'key', ok: false, status: 'unknown' })
    expect(verifyKey(sold, now)).toEqual({ kind: 'key', ok: true, status: 'pending', plan: 'pro', validity: 'lifetime', until: null })
    expect(verifyKey({ ...sold, validity: '1y' }, now)).toEqual({ kind: 'key', ok: true, status: 'pending', plan: 'pro', validity: '1y' })
    expect(verifyKey({ ...sold, validity: 'date', until: '2027-01-10' }, now)).toMatchObject({ ok: true, status: 'pending', until: '2027-01-10' })
    expect(verifyKey({ ...sold, validity: 'date', until: '2027-01-09' }, now)).toMatchObject({ ok: false, status: 'pending', reason: 'expired' })
    const bound = { ...sold, device: 'AB2C-D3EF', code: 'C', validity: '1y' as const, until: '2027-10-12', activatedAt: '2026-10-12T08:00:00.000Z' }
    expect(verifyKey(bound, now)).toEqual({ kind: 'key', ok: true, status: 'activated', plan: 'pro', validity: '1y', until: '2027-10-12', device: 'AB2C-D3EF', activatedAt: '2026-10-12T08:00:00.000Z' })
    expect(verifyKey(bound, new Date(Date.UTC(2027, 9, 13)))).toMatchObject({ ok: false, status: 'activated', reason: 'expired' })
    expect(verifyKey({ ...bound, status: 'refunded' }, now)).toMatchObject({ ok: false, status: 'refunded', device: 'AB2C-D3EF' })
    expect(verifyKey({ ...sold, status: 'void' }, now)).toMatchObject({ ok: false, status: 'void' })
    expect(verifyKey({ ...sold, key: null, device: 'AB2C-D3EF' }, now)).toEqual({ kind: 'key', ok: false, status: 'unknown' })
  })
})
