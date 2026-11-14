/**
 * Additive profile features introduced by the strategy study (docs/DESIGN.md §5, docs/STRATEGY.md):
 * booster unlocks with gifts, feature gating, the Caravan win streak, single-life grants and the
 * continue price ladder — plus the bookkeeping the monetisation module needs (ProfileShop).
 * All of it is implemented by `createProfile` (src/state/index.ts), which returns a `FullProfile`.
 *
 * The app context still types the profile as `ProfileApi & Partial<ProfileExtensions>` (callers
 * write `ctx.profile.caravan?.() ?? 0`); with the real profile every method is present.
 */
import type { StartBoosters } from '../engine/types.ts';
import type { BoosterId, ProfileApi, Reward, RewardedPlacement, ShopSave } from './types.ts';

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
  /**
   * Consecutive wins since the last failed/abandoned level; always 0 before the Caravan unlocks.
   * A win counts when it is the first clear of a level played with the Caravan unlocked (replaying
   * cleared levels neither adds nor resets); every `loseLife()` resets it.
   */
  caravan(): number;
  /** The free start boosters the current Caravan grants for the next level (empty object when none). */
  caravanBoosters(): StartBoosters;
  /** Grant one life (rewarded ad). False when lives are already full. */
  addLife(): boolean;
  /** Coin price of the nth continue within one attempt (n = 0, 1, 2). Returns null when no more continues are allowed. */
  continuePrice(n: number): number | null;
}

/** What today's ad counters say (all zero on a new local day). */
export interface AdsToday {
  /** Rewarded ads earned today, per placement. */
  rewarded: Record<RewardedPlacement, number>;
  /** Rewarded ads earned today over all placements. */
  rewardedTotal: number;
  /** Interstitials shown today. */
  interstitials: number;
}

/**
 * Storage for the monetisation module (src/monetize), which owns the rules. Every mutation is one
 * complete save followed by one notification, like the rest of the profile; calls that change
 * nothing neither save nor notify.
 */
export interface ProfileShop {
  /** The monetisation section of the save (live object: read it, never write to it). */
  shop(): Readonly<ShopSave>;
  /**
   * False while the most recent save could not be written (the storage function threw): what
   * changed last exists in memory only. A cheap hint — it cannot see a storage layer that fails
   * silently. Before finishing a purchase with the store ask `purchaseSaved(token)` instead.
   */
  lastSaveOk(): boolean;
  /** True when a purchase with this token was already granted. */
  purchaseGranted(token: string): boolean;
  /**
   * True when the grant of this purchase is in STORAGE: the token was granted, and the save that
   * `ProfileDeps.load()` hands out right now — what the next launch would start from — holds it.
   * This reads the save back, because a storage layer may fail without throwing (then
   * `lastSaveOk()` knows nothing). A purchase may be finished with the store only when this says so.
   */
  purchaseSaved(token: string): boolean;
  /**
   * Complete one real-money purchase in ONE save: apply `rewards`, remember the token, mark
   * `entitlement` (when given) as owned and set the purchased flag. Returns false — and changes
   * nothing — when the token is unusable or was granted before. Only when this has returned may
   * the purchase be finished with the store.
   */
  grantPurchase(token: string, rewards: Reward[], entitlement?: string | null): boolean;
  /**
   * Set or clear ownership of an entitlement WITHOUT granting anything (a restore). Owning one also
   * sets the purchased flag (which is never cleared). Returns true when ownership changed.
   * A valid id can always be recorded: should the list be full, its oldest entry makes room.
   */
  setEntitlement(id: string, owned: boolean): boolean;
  /** Today's ad counters (zero when the local day has changed since they were written). */
  adsToday(): AdsToday;
  /** A rewarded ad ended now: remembers the time, and counts it for today when it was earned. */
  noteRewarded(placement: RewardedPlacement, earned: boolean): void;
  /** An interstitial was shown now: remembers the time, counts it for today, restarts the level count. */
  noteInterstitial(): void;
  /**
   * One more level was finished. Returns how many were finished since the last interstitial.
   * Also pulls back ad times that lie in the future (the device clock was set back since): they
   * then count as "just now", so a rule that waits for time to pass after an ad waits one full
   * interval from now — never for ever, and never not at all.
   */
  noteLevelFinished(): number;
  /** Whole local calendar days since the first day the game was played (0 on that day, or without a clock). */
  daysSinceFirstPlay(): number;
}

/** What `createProfile` returns: the base contract plus every extension. */
export type FullProfile = ProfileApi & ProfileExtensions & ProfileShop;
