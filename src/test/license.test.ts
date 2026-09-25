import { describe, expect, it } from 'vitest'
import { checkCode, deviceNumber, makeCode } from '../engine/license'

describe('activation codes', () => {
  it('opens the app and phone it was made for, and nothing else', async () => {
    const dev = await deviceNumber('g12', 'android-id-1')
    const other = await deviceNumber('g12', 'android-id-2')
    expect(dev).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
    expect(dev).toBe(await deviceNumber('g12', 'android-id-1'))
    const code = await makeCode('g12', dev, null)
    expect(code).toMatch(/^([2-9A-Z]{4}-){3}[2-9A-Z]{4}$/)
    expect((await checkCode('g12', dev, code)).ok).toBe(true)
    expect((await checkCode('g12', dev, code.toLowerCase().replace(/-/g, ' '))).ok).toBe(true)
    expect(await checkCode('g12', other, code)).toEqual({ ok: false, reason: 'device' })
    expect(await checkCode('g11', dev, code)).toEqual({ ok: false, reason: 'device' })
    expect(await checkCode('g12', dev, 'ABCD')).toEqual({ ok: false, reason: 'format' })
    const typo = code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A')
    expect((await checkCode('g12', dev, typo)).ok).toBe(false)
  })
  it('stops working after its date', async () => {
    const dev = await deviceNumber('g8', 'x')
    const code = await makeCode('g8', dev, new Date(Date.UTC(2026, 7, 31)))
    const r = await checkCode('g8', dev, code, new Date(Date.UTC(2026, 5, 1)))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.until?.toISOString().slice(0, 10)).toBe('2026-08-31')
    expect(await checkCode('g8', dev, code, new Date(Date.UTC(2026, 8, 5)))).toEqual({ ok: false, reason: 'expired' })
  })
})
