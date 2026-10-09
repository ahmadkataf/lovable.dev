import { describe, it, expect } from 'vitest'
import { round, parseNumber, formatMoney, quickAmounts, formatQty } from './money'

describe('money', () => {
  it('rounds the way a cashier expects', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(2.5, 0)).toBe(3)
    expect(round(1234.5678, 0)).toBe(1235)
    expect(round(NaN, 2)).toBe(0)
  })
  it('reads Arabic digits and separators', () => {
    expect(parseNumber('١٬٢٥٠')).toBe(1250)
    expect(parseNumber('1,250.50')).toBe(1250.5)
    expect(parseNumber('12٫5')).toBe(12.5)
    expect(parseNumber('-40')).toBe(-40)
    expect(parseNumber('abc')).toBe(0)
  })
  it('formats with the symbol on the right side', () => {
    expect(formatMoney(1250, { code: 'SYP', symbol: 'ل.س', decimals: 0, symbolAfter: true })).toBe('1,250 ل.س')
    expect(formatMoney(12.5, { code: 'USD', symbol: '$', decimals: 2, symbolAfter: false })).toBe('$12.50')
    expect(formatMoney(-5, { code: 'USD', symbol: '$', decimals: 2, symbolAfter: false })).toBe('-$5.00')
  })
  it('suggests quick cash amounts above the total', () => {
    const q = quickAmounts(1250, 0)
    expect(q[0]).toBe(1250)
    expect(q.every(v => v >= 1250)).toBe(true)
    expect(new Set(q).size).toBe(q.length)
  })
  it('formats quantities', () => {
    expect(formatQty(1)).toBe('1'); expect(formatQty(0.25)).toBe('0.25'); expect(formatQty(1.5)).toBe('1.5')
  })
})

describe('second currency', () => {
  it('converts both ways at the rate', async () => {
    const { toSecondary, toPrimary, secondaryQuickAmounts } = await import('./money')
    expect(toSecondary(130000, 13000, 2)).toBe(10)
    expect(toSecondary(14000, 13000, 2)).toBe(1.08)
    expect(toPrimary(1.5, 13000, 0)).toBe(19500)
    expect(toSecondary(100, 0, 2)).toBe(0)
    const q = secondaryQuickAmounts(14000, 13000, 2)
    expect(q[0]).toBe(1.08)
    expect(q).toEqual([1.08, 2, 5, 10])
  })
})
