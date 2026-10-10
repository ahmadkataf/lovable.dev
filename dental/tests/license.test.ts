import { checkCode, cleanCode, deviceNumber, formatCode, makeCode } from '../src/license/core'

describe('license codes', () => {
  it('round-trips a lifetime code for the same device', async () => {
    const dev = await deviceNumber('raw-device-1')
    expect(dev).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
    const code = await makeCode(dev, 'pro', null)
    expect(cleanCode(code)).toHaveLength(16)
    const r = await checkCode(dev, code)
    expect(r).toEqual({ ok: true, plan: 'pro', until: null })
  })
  it('rejects the code on another device and after expiry', async () => {
    const a = await deviceNumber('a'), b = await deviceNumber('b')
    const until = new Date(Date.UTC(2027, 5, 30))
    const code = await makeCode(a, 'standard', until)
    expect((await checkCode(b, code)).ok).toBe(false)
    const ok = await checkCode(a, code, new Date(Date.UTC(2027, 5, 29)))
    expect(ok.ok && ok.plan).toBe('standard')
    const late = await checkCode(a, code, new Date(Date.UTC(2027, 7, 1)))
    expect(late).toEqual({ ok: false, reason: 'expired' })
  })
  it('rejects garbage', async () => {
    const dev = await deviceNumber('x')
    expect(await checkCode(dev, 'hello')).toEqual({ ok: false, reason: 'format' })
    expect(formatCode('ABCDEFGHJKLMNPQR')).toBe('ABCD-EFGH-JKLM-NPQR')
  })
})
