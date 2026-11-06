import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, hashPin, isEncrypted, verifyPin, sha256Hex } from '../lib/crypto'
import { code128, barcodeSvg } from '../lib/barcode'

describe('pins', () => {
  it('salted hashes differ per user and verify', async () => {
    const a = await hashPin('1234', undefined, 1000), b = await hashPin('1234', undefined, 1000)
    expect(a.hash).not.toBe(b.hash)
    expect(await verifyPin('1234', { pinHash: a.hash, pinSalt: a.salt, pinIterations: 1000 })).toBe(true)
    expect(await verifyPin('1235', { pinHash: a.hash, pinSalt: a.salt, pinIterations: 1000 })).toBe(false)
  })
  it('still accepts the old unsalted records', async () => {
    expect(await verifyPin('4321', { pinHash: await sha256Hex('4321') })).toBe(true)
    expect(await verifyPin('0000', { pinHash: await sha256Hex('4321') })).toBe(false)
  })
})

describe('encrypted backups', () => {
  it('round-trips and refuses a wrong password', async () => {
    const env = await encryptText('{"hello":"مرحبا"}', 'pw-1')
    expect(isEncrypted(env)).toBe(true)
    expect(isEncrypted('{"app":"alradwan-garage"}')).toBe(false)
    expect(await decryptText(env, 'pw-1')).toBe('{"hello":"مرحبا"}')
    await expect(decryptText(env, 'pw-2')).rejects.toThrow()
  })
})

describe('code 128', () => {
  it('encodes with a valid checksum (known vector)', () => {
    // "ABC" in set B: start B (104) + 33 34 35 → checksum (104 + 33*1 + 34*2 + 35*3) % 103 = 5
    const bits = code128('ABC')!
    const stop = '1100011101011'
    expect(bits.endsWith(stop)).toBe(true)
    expect(bits.startsWith('11010010000')).toBe(true) // start B
    expect(bits.length).toBe(11 * 5 + 13)              // start, A, B, C, checksum, stop
  })
  it('switches to set C for digit runs and rejects non-ascii', () => {
    expect(code128('123456')!.startsWith('11010011100')).toBe(true) // start C
    expect(code128('فلتر')).toBeNull()
    expect(barcodeSvg('FLT-001')).toContain('<rect')
  })
})
