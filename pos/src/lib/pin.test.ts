import { describe, it, expect } from 'vitest'
import { knownPinLength, pinStep, pinDots } from './pin'
import { hashPin, checkPin } from './hash'

describe('PIN lengths on the lock screen', () => {
  it('a PIN of known length is checked exactly when all its digits are in', () => {
    expect(pinStep(3, 4)).toBe('type')
    expect(pinStep(4, 4)).toBe('check')
    expect(pinStep(4, 6)).toBe('type')     // the bug: a 6-digit PIN was checked (and refused) after 4 digits
    expect(pinStep(5, 6)).toBe('type')
    expect(pinStep(6, 6)).toBe('check')
    expect(pinStep(5, 5)).toBe('check')
  })

  it('a PIN set before its length was kept is tried after 4, 5 and 6 digits, and only the 6th try is final', () => {
    expect(pinStep(3)).toBe('type')
    expect(pinStep(4)).toBe('try')
    expect(pinStep(5)).toBe('try')
    expect(pinStep(6)).toBe('check')
  })

  it('shows as many dots as the PIN has, or 4 growing to 6 when the length is unknown', () => {
    expect(pinDots(0, 6)).toBe(6)
    expect(pinDots(2, 4)).toBe(4)
    expect(pinDots(0)).toBe(4)
    expect(pinDots(5)).toBe(5)
    expect(pinDots(6)).toBe(6)
  })

  it('only trusts a stored length of 4 to 6', () => {
    expect(knownPinLength({ pinLen: 6 })).toBe(6)
    expect(knownPinLength({ pinLen: 4 })).toBe(4)
    expect(knownPinLength({})).toBeUndefined()
    expect(knownPinLength({ pinLen: 3 })).toBeUndefined()
    expect(knownPinLength({ pinLen: '6' })).toBeUndefined()
    expect(knownPinLength(null)).toBeUndefined()
  })

  it('a 6-digit PIN matches only in full (its first 4 digits are not the PIN)', async () => {
    const h = await hashPin('123456')
    expect(await checkPin('1234', h)).toBe(false)
    expect(await checkPin('12345', h)).toBe(false)
    expect(await checkPin('123456', h)).toBe(true)
  })
})
