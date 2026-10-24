// Loyalty points: earned on what a customer spends, redeemed as a discount on a later sale.
import { round } from './money'

export interface LoyaltySettings { enabled: boolean; earnPer: number; pointValue: number; minRedeem: number }

/** Points for a sale total: one point per `earnPer` of currency (floored). */
export function pointsEarned(total: number, s: Pick<LoyaltySettings, 'enabled' | 'earnPer'>): number {
  if (!s.enabled || !(s.earnPer > 0) || !(total > 0)) return 0
  return Math.floor(total / s.earnPer)
}

/** How many points to redeem and what they are worth, never more than `cap` (the subtotal) and only above the minimum. */
export function redeemPlan(points: number, s: Pick<LoyaltySettings, 'enabled' | 'pointValue' | 'minRedeem'>, cap: number, decimals: number): { points: number; value: number } {
  if (!s.enabled || !(s.pointValue > 0) || points < Math.max(1, s.minRedeem) || !(cap > 0)) return { points: 0, value: 0 }
  const usable = Math.min(points, Math.floor(cap / s.pointValue))
  if (usable < Math.max(1, s.minRedeem)) return { points: 0, value: 0 }
  return { points: usable, value: round(usable * s.pointValue, decimals) }
}
