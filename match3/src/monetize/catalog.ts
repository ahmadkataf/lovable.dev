/**
 * The real-money catalogue and every number of the ad rules (docs/DESIGN.md §7) in one place.
 * Pure data: nothing here touches the bridge, the profile or the clock.
 *
 * The product ids are fixed: the same ids must exist in Play Console. Prices are NOT here — the
 * app only ever shows the store's own localised price strings (FAKE_PRICES below belong to the
 * browser-only test store).
 */
import { AD_CONTINUE_MOVES, FREE_COINS_AD_REWARD } from '../state/econ.ts';
import type { Reward } from '../state/types.ts';
import type { AdPlacement, ProductDef, ProductId } from './types.ts';

// ───────────────────────────── products ─────────────────────────────

function coins(amount: number): Reward[] {
  return [{ kind: 'coins', amount }];
}

function freeze(def: ProductDef): ProductDef {
  for (const reward of def.grants) Object.freeze(reward);
  Object.freeze(def.grants);
  return Object.freeze(def);
}

/** Every product, in display order. Frozen: treat as read-only data. */
export const PRODUCTS: readonly ProductDef[] = Object.freeze(
  (
    [
      { id: 'coins_small', kind: 'consumable', grants: coins(1000), removesAds: false },
      { id: 'coins_medium', kind: 'consumable', grants: coins(5500), removesAds: false },
      { id: 'coins_large', kind: 'consumable', grants: coins(12000), removesAds: false, badge: 'popular' },
      { id: 'coins_xl', kind: 'consumable', grants: coins(26000), removesAds: false },
      { id: 'coins_mega', kind: 'consumable', grants: coins(70000), removesAds: false, badge: 'best' },
      {
        id: 'starter_pack',
        kind: 'entitlement',
        grants: [
          { kind: 'coins', amount: 4000 },
          { kind: 'booster', id: 'hammer', amount: 3 },
          { kind: 'booster', id: 'freeSwap', amount: 3 },
          { kind: 'booster', id: 'prism', amount: 2 },
        ],
        removesAds: true,
      },
      { id: 'remove_ads', kind: 'entitlement', grants: [], removesAds: true },
    ] as ProductDef[]
  ).map(freeze),
);

export const PRODUCT_IDS: readonly ProductId[] = Object.freeze(PRODUCTS.map((p) => p.id));

/** The catalogue entry for an id, or null when the id is not one of ours. */
export function productDef(id: unknown): ProductDef | null {
  if (typeof id !== 'string') return null;
  for (const def of PRODUCTS) if (def.id === id) return def;
  return null;
}

// ───────────────────────────── rewarded ads ─────────────────────────────

export const AD_PLACEMENTS: readonly AdPlacement[] = Object.freeze(['extraMoves', 'freeLife', 'freeCoins', 'doubleReward'] as AdPlacement[]);

/** Moves granted by the rewarded-ad continue in the lose dialog (the paid continue gives 5). */
export const adContinueMoves: number = AD_CONTINUE_MOVES;
/** Coins granted by one "free coins" ad in the shop. */
export const freeCoinsAmount: number = FREE_COINS_AD_REWARD;

/**
 * Rewarded ads a player may EARN per local day, per placement; null = only the daily total limits it
 * ('extraMoves' is also limited to once per attempt, which the play screen enforces).
 */
export const REWARDED_PER_DAY: Readonly<Record<AdPlacement, number | null>> = Object.freeze({
  extraMoves: null,
  freeLife: 3,
  freeCoins: 3,
  doubleReward: null,
});

/** Rewarded ads a player may earn per local day over all placements. */
export const REWARDED_PER_DAY_TOTAL = 8;

// ───────────────────────────── interstitial ads ─────────────────────────────

/** No interstitial before the player has reached this level… */
export const INTERSTITIAL_MIN_LEVEL = 25;
/** …and first played at least this many local calendar days ago. */
export const INTERSTITIAL_MIN_DAYS_PLAYED = 3;
/** At most one interstitial per this many finished levels. */
export const INTERSTITIAL_EVERY_LEVELS = 3;
/** At least this long after the previous interstitial. */
export const INTERSTITIAL_MIN_GAP_MS = 180_000;
/** Never within this long of a rewarded ad. */
export const INTERSTITIAL_AFTER_REWARDED_MS = 600_000;
/** At most this many interstitials per local day. */
export const INTERSTITIALS_PER_DAY = 5;

// ───────────────────────────── safety nets ─────────────────────────────

/** A full-screen ad that has not reported a result after this long (in the foreground) counts as not shown. */
export const AD_WATCHDOG_MS = 120_000;
/** After the app returned from the background with an ad still open, its result must arrive within this long. */
export const AD_RESUME_GRACE_MS = 15_000;
/** A purchase flow that never reports back is given up after this long (a late result is still granted). */
export const BUY_WATCHDOG_MS = 600_000;
/** A restore that gets no answer resolves after this long. */
export const RESTORE_WATCHDOG_MS = 15_000;
/** After the store's list of owned products arrives, unfinished purchases may follow for this long. */
export const RESTORE_SETTLE_MS = 400;
/** The privacy-options form is considered closed after this long without news. */
export const PRIVACY_WATCHDOG_MS = 120_000;
/** A returning app asks the store for news at most this often. */
export const RESUME_RESTORE_GAP_MS = 60_000;

// ───────────────────────────── browser test store ─────────────────────────────

/** Price strings of the fake store (`?fakestore=1` / dev server). Never shown by a real build. */
export const FAKE_PRICES: Readonly<Record<ProductId, string>> = Object.freeze({
  coins_small: 'US$0.99',
  coins_medium: 'US$4.99',
  coins_large: 'US$9.99',
  coins_xl: 'US$19.99',
  coins_mega: 'US$49.99',
  starter_pack: 'US$1.99',
  remove_ads: 'US$2.99',
});
