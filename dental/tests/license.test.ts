import { CODE_CHARS, PUBLIC_KEY, checkCode, cleanCode, crc16, deviceNumber, expiryDay, formatCode, fromBase32, packCode, signedMessage, toBase32, type Plan } from '../src/license/core'

// A throwaway key pair stands in for the seller's key: the real private key is never in the repository.
async function testKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return { priv: kp.privateKey, pub: await crypto.subtle.exportKey('jwk', kp.publicKey) }
}
async function sign(priv: CryptoKey, device: string, plan: Plan, until: Date | null) {
  const day = expiryDay(until)
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, signedMessage(device, plan, day)))
  return packCode(plan, day, sig)
}

describe('signed licence codes', () => {
  it('round-trips a lifetime code for the same device, pasted in any shape', async () => {
    const k = await testKeys()
    const dev = await deviceNumber('raw-device-1')
    expect(dev).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
    const code = await sign(k.priv, dev, 'pro', null)
    expect(cleanCode(code)).toHaveLength(CODE_CHARS)
    expect(await checkCode(dev, code, new Date(), k.pub)).toEqual({ ok: true, plan: 'pro', until: null })
    const pasted = `‎${code.toLowerCase().replace(/-/g, ' ').replace(/(.{40})/g, '$1\n')}`
    expect((await checkCode(dev, pasted, new Date(), k.pub)).ok).toBe(true)
  })
  it('rejects the code on another device and after its last day', async () => {
    const k = await testKeys()
    const a = await deviceNumber('a'), b = await deviceNumber('b')
    const code = await sign(k.priv, a, 'standard', new Date(Date.UTC(2027, 5, 30)))
    expect(await checkCode(b, code, new Date(), k.pub)).toEqual({ ok: false, reason: 'device' })
    const ok = await checkCode(a, code, new Date(Date.UTC(2027, 5, 29)), k.pub)
    expect(ok.ok && ok.plan).toBe('standard')
    expect(await checkCode(a, code, new Date(Date.UTC(2027, 7, 1)), k.pub)).toEqual({ ok: false, reason: 'expired' })
  })
  it('tells a typo (format) from a forged or foreign code (device)', async () => {
    const k = await testKeys()
    const dev = await deviceNumber('x')
    const code = cleanCode(await sign(k.priv, dev, 'pro', null))
    // one mistyped character anywhere is caught by the checksum
    for (const i of [0, 7, 50, 111]) {
      const typo = code.slice(0, i) + (code[i] === 'Z' ? 'Y' : 'Z') + code.slice(i + 1)
      expect(await checkCode(dev, typo, new Date(), k.pub)).toEqual({ ok: false, reason: 'format' })
    }
    // changing the plan or the date and fixing the checksum still fails: the signature covers them
    const bytes = fromBase32(code)!
    bytes[1] = 1                                                 // pro → standard
    const crc = crc16(bytes.subarray(0, 68)); bytes[68] = crc >> 8; bytes[69] = crc & 255
    expect(await checkCode(dev, toBase32(bytes), new Date(), k.pub)).toEqual({ ok: false, reason: 'device' })
    expect(await checkCode(dev, 'hello', new Date(), k.pub)).toEqual({ ok: false, reason: 'format' })
    expect(formatCode('ABCDEFGHJKLMNPQR')).toBe('ABCD-EFGH-JKLM-NPQR')
  })
  it('the app key accepts no code made with another key', async () => {
    const k = await testKeys()
    const dev = await deviceNumber('y')
    expect(PUBLIC_KEY.x).toBeTruthy()
    expect((PUBLIC_KEY as { d?: string }).d).toBeUndefined()   // the app ships the public half only
    expect(await checkCode(dev, await sign(k.priv, dev, 'pro', null))).toEqual({ ok: false, reason: 'device' })
  })
})
