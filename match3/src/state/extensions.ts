/**
 * Additive profile features introduced by the strategy study (docs/DESIGN.md §5, docs/STRATEGY.md):
 * booster unlocks with gifts, feature gating, the Caravan win streak, single-life grants and the
 * continue price ladder. They are implemented inside src/state by the economy module.
 *
 * Until that lands, every method may be missing at runtime: the app context types the profile as
 * `ProfileApi & Partial<ProfileExtensions>`, so callers write `ctx.profile.caravan?.() ?? 0`.
 */
import type { StartBoosters } from '../engine/types.ts';
import type { BoosterId } from './types.ts';

export type FeatureId =
  /** lives counter shown (L6) */
  | 'lives'
  /** shop button shown (L10) */
  | 'shop'
  /** rewarded-ad offers shown (L11) */
  | 'rewardedAds'
  /** Caravan win streak active (L20) */
  | 'caravan'
  /** daily reward offered (from the player's second local calendar day) */
  | 'daily';

export interface ProfileExtensions {
  /** True once the player has reached the booster's unlock level (DESIGN §5). Locked boosters are hidden. */
  boosterUnlocked(id: BoosterId): boolean;
  /**
   * Boosters whose unlock level has been reached but whose introduction gift has not been given yet.
   * Calling it grants the gifts and marks them as given, so each is returned exactly once.
   */
  claimUnlocks(): { id: BoosterId; amount: number }[];
  featureUnlocked(feature: FeatureId): boolean;
  /** Consecutive wins since the last failed/abandoned level; always 0 before the Caravan unlocks. */
  caravan(): number;
  /** The free start boosters the current Caravan grants for the next level (empty object when none). */
  caravanBoosters(): StartBoosters;
  /** Grant one life (rewarded ad). False when lives are already full. */
  addLife(): boolean;
  /** Coin price of the nth continue within one attempt (n = 0, 1, 2). Returns null when no more continues are allowed. */
  continuePrice(n: number): number | null;
}
