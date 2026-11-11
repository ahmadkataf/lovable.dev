import { describe, it, expect } from 'vitest'
import { pointsEarned, redeemPlan } from './loyalty'

describe('loyalty', () => {
  it('earns one point per earnPer spent', () => {
    expect(pointsEarned(25000, { enabled: true, earnPer: 1000 })).toBe(25)
    expect(pointsEarned(999, { enabled: true, earnPer: 1000 })).toBe(0)
    expect(pointsEarned(25000, { enabled: false, earnPer: 1000 })).toBe(0)
  })
  it('redeems only above the minimum and never more than the subtotal', () => {
    const s = { enabled: true, pointValue: 50, minRedeem: 100 }
    expect(redeemPlan(99, s, 100000, 0)).toEqual({ points: 0, value: 0 })
    expect(redeemPlan(250, s, 100000, 0)).toEqual({ points: 250, value: 12500 })
    expect(redeemPlan(250, s, 6000, 0)).toEqual({ points: 120, value: 6000 })
    expect(redeemPlan(250, s, 3000, 0)).toEqual({ points: 0, value: 0 })   // 60 points would fit but the minimum is 100
  })
})
