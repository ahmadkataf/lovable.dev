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

describe('roundToStep', () => {
  it('rounds selling prices to the step, nearest or up', async () => {
    const { roundToStep } = await import('./money')
    expect(roundToStep(129870, 100, 'nearest', 0)).toBe(129900)
    expect(roundToStep(16250, 100, 'nearest', 0)).toBe(16300)
    expect(roundToStep(129870, 500, 'up', 0)).toBe(130000)
    expect(roundToStep(129870, 0, 'nearest', 0)).toBe(129870)       // no step: plain rounding
    expect(roundToStep(1234.56, 0, 'nearest', 2)).toBe(1234.56)
    expect(roundToStep(1234, 10, 'nearest', 0)).toBe(1230)
    expect(roundToStep(1235, 10, 'nearest', 0)).toBe(1240)
    expect(roundToStep(1231, 10, 'up', 0)).toBe(1240)
    expect(roundToStep(1230, 10, 'up', 0)).toBe(1230)               // already on the step: 'up' does not move it
  })
  it('shrinks the step for small prices so nothing moves by more than a quarter and never becomes 0', async () => {
    const { roundToStep } = await import('./money')
    expect(roundToStep(650, 500, 'nearest', 0)).toBe(650)            // step 500 → 10 for a 650 price
    expect(roundToStep(650, 500, 'up', 0)).toBe(650)
    expect(roundToStep(12, 100, 'nearest', 0)).toBe(12)
    expect(roundToStep(3, 100, 'nearest', 0)).toBe(3)
    expect(roundToStep(0.4, 100, 'nearest', 0)).toBe(0)              // below one unit of the currency: plain rounding
    expect(roundToStep(0.4, 100, 'nearest', 2)).toBe(0.4)
    expect(roundToStep(1.237, 1, 'nearest', 2)).toBe(1.2)            // step 1 on a 1.24 price shrinks to 0.1
    expect(roundToStep(0.237, 1, 'nearest', 2)).toBe(0.24)           // and on to 0.01
    for (const n of [1, 7, 49, 51, 99, 101, 149, 151, 249, 251, 499, 501, 999, 1001]) {
      const r = roundToStep(n, 100, 'nearest', 0)
      expect(r, String(n)).toBeGreaterThan(0)
      expect(Math.abs(r - n) / n, String(n)).toBeLessThanOrEqual(0.26)
    }
    expect(roundToStep(0, 100, 'nearest', 0)).toBe(0)
    expect(roundToStep(-5, 100, 'nearest', 0)).toBe(0)
    expect(roundToStep(NaN, 100, 'nearest', 0)).toBe(0)
  })
})
