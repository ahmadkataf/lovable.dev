import { describe, it, expect } from 'vitest'
import * as ed from '@noble/ed25519'
import {
  type TokenPayload, cleanCode, formatCode, formatTyping, deviceCodeOf, hexToBytes, bytesToHex, b64url, fromB64url, parseToken, verifyToken,
  deriveState, clockRolledBack, errorMessageKey, stateForCheckError, newNonce, HOUR,
} from './crypto'

const enc = new TextEncoder()
const DAY = 86400000
const device = 'a'.repeat(64)
const seed = ed.utils.randomSecretKey()
const pubHex = bytesToHex(await ed.getPublicKeyAsync(seed))
async function token(p: Partial<TokenPayload> = {}, key: Uint8Array = seed): Promise<string> {
  const now = Date.now()
  const payload: TokenPayload = { v: 1, code: 'ABCDEFGHJKLM', d: device, p: 'full', iat: now, exp: null, gr: now + 10 * DAY, n: 'nonce-1', srv: 'kaseb', ...p }
  const bytes = enc.encode(JSON.stringify(payload))
  return `${b64url(bytes)}.${b64url(await ed.signAsync(bytes, key))}`
}

describe('codes', () => {
  it('cleans and formats', () => {
    expect(cleanCode(' abcd-efgh-jklm ')).toBe('ABCDEFGHJKLM')
    expect(cleanCode('ABCD EFGH JKLM')).toBe('ABCDEFGHJKLM')
    expect(cleanCode('ABCD-EFGH-JKL')).toBeNull()          // too short
    expect(cleanCode('ABCD-EFGH-JKL0')).toBeNull()         // 0 is not in the alphabet
    expect(cleanCode('ABCD-EFGH-JKLMN')).toBeNull()        // too long
    expect(cleanCode(null)).toBeNull()
    expect(formatCode('ABCDEFGHJKLM')).toBe('ABCD-EFGH-JKLM')
  })
  it('formats while typing', () => {
    expect(formatTyping('ab')).toBe('AB')
    expect(formatTyping('abcd')).toBe('ABCD')
    expect(formatTyping('abcde')).toBe('ABCD-E')
    expect(formatTyping('abcd-efgh-jklm-xyz')).toBe('ABCD-EFGH-JKLM')
    expect(formatTyping('a b c d e f g h j k l m')).toBe('ABCD-EFGH-JKLM')
  })
})

describe('device code', () => {
  it('is base32 of the first 40 bits in our alphabet', () => {
    expect(deviceCodeOf('00'.repeat(32))).toBe('2222-2222')
    expect(deviceCodeOf('ff'.repeat(32))).toBe('ZZZZ-ZZZZ')
    expect(deviceCodeOf('0044321 4c7'.replace(' ', '') + '00'.repeat(27))).toBe('2345-6789')
  })
  it('is stable and never contains 0 O 1 I', () => {
    const c = deviceCodeOf('9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0')
    expect(c).toBe(deviceCodeOf('9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0'))
    expect(c).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
  })
})

describe('bytes', () => {
  it('hex and base64url round-trip', () => {
    const b = new Uint8Array([0, 1, 2, 250, 251, 255])
    expect(hexToBytes(bytesToHex(b))).toEqual(b)
    expect(fromB64url(b64url(b))).toEqual(b)
    expect(b64url(b)).not.toMatch(/[+/=]/)
    expect(hexToBytes('zz')).toEqual(new Uint8Array(0))
    expect(hexToBytes('abc')).toEqual(new Uint8Array(0))
  })
})

describe('tokens', () => {
  it('parses a well-formed token and rejects junk', async () => {
    const t = parseToken(await token())
    expect(t?.payload.code).toBe('ABCDEFGHJKLM')
    expect(parseToken('')).toBeNull()
    expect(parseToken('abc')).toBeNull()
    expect(parseToken('a.b.c')).toBeNull()
    expect(parseToken(`${b64url(enc.encode('{"v":1}'))}.${b64url(new Uint8Array(64))}`)).toBeNull()
  })
  it('verifies a good signature for this device', async () => {
    const p = await verifyToken(await token(), pubHex, device)
    expect(p?.d).toBe(device)
    expect(p?.p).toBe('full')
  })
  it('rejects a bad signature, another key, another device, another service and a wrong nonce', async () => {
    const good = await token()
    expect(await verifyToken(good.slice(0, -6) + 'AAAAAA', pubHex, device)).toBeNull()
    expect(await verifyToken(await token({}, ed.utils.randomSecretKey()), pubHex, device)).toBeNull()
    expect(await verifyToken(good, pubHex, 'b'.repeat(64))).toBeNull()
    expect(await verifyToken(await token({ srv: 'other' as 'kaseb' }), pubHex, device)).toBeNull()
    expect(await verifyToken(good, pubHex, device, 'another-nonce')).toBeNull()
    expect(await verifyToken(good, pubHex, device, 'nonce-1')).not.toBeNull()
    expect(await verifyToken(good, '', device)).toBeNull()       // built without a public key: nothing is trusted
  })
})

describe('state', () => {
  const now = 1_800_000_000_000
  const base: TokenPayload = { v: 1, code: 'ABCDEFGHJKLM', d: device, p: 'full', iat: now, exp: null, gr: now + 10 * DAY, n: 'n', srv: 'kaseb' }
  it('derives active / trial / expired / locked', () => {
    expect(deriveState(base, now)).toBe('active')
    expect(deriveState({ ...base, p: 'trial', exp: now + DAY }, now)).toBe('trial')
    expect(deriveState({ ...base, exp: now - 1 }, now)).toBe('expired')
    expect(deriveState({ ...base, p: 'trial', exp: now - 1 }, now)).toBe('expired')
    expect(deriveState(base, now + 10 * DAY)).toBe('locked')
    expect(deriveState(base, now, true)).toBe('locked')
    expect(deriveState({ ...base, exp: now - 1 }, now, true)).toBe('expired')   // expiry wins over the clock guard
  })
  it('spots a clock rollback with an hour of slack', () => {
    expect(clockRolledBack(now, undefined)).toBe(false)
    expect(clockRolledBack(now, now - 5 * DAY)).toBe(false)
    expect(clockRolledBack(now, now + HOUR - 1)).toBe(false)
    expect(clockRolledBack(now, now + HOUR + 1)).toBe(true)
  })
  it('maps errors to message keys and states', () => {
    expect(errorMessageKey('revoked')).toBe('license.err.revoked')
    expect(errorMessageKey('whatever')).toBe('license.err.unknown')
    expect(stateForCheckError('revoked')).toBe('revoked')
    expect(stateForCheckError('device_mismatch')).toBe('revoked')
    expect(stateForCheckError('expired')).toBe('expired')
    expect(stateForCheckError('tampered')).toBe('tampered')
    expect(stateForCheckError('invalid_token')).toBe('none')
    expect(stateForCheckError('min_version')).toBeUndefined()
    expect(stateForCheckError('network')).toBeUndefined()
  })
  it('makes distinct nonces', () => {
    expect(newNonce()).toMatch(/^[0-9a-f]{24}$/)
    expect(newNonce()).not.toBe(newNonce())
  })
})
