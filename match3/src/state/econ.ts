/**
 * Every number of the in-game economy (docs/DESIGN.md §5, after the strategy study) in one place.
 * Pure data + a few tiny pure helpers; nothing here touches storage or the clock.
 * Real-money products and the ad frequency rules live in src/monetize/catalog.ts (DESIGN §7).
 */
import type { BoosterId, Reward } from './types.ts';
import type { FeatureId } from './extensions.ts';

// ───────────────────────────── lives ─────────────────────────────

export const MAX_LIVES = 5;
/** One life regenerates every 30 minutes. */
export const LIFE_REGEN_MS = 30 * 60 * 1000;
/** Coins to refill all lives at once. */
export const REFILL_LIVES_PRICE = 900;

// ───────────────────────────── coins & level rewards ─────────────────────────────

export const START_COINS = 2000;
/** First clear of a level: FIRST_CLEAR_COINS + FIRST_CLEAR_COINS_PER_STAR × stars. */
export const FIRST_CLEAR_COINS = 20;
export const FIRST_CLEAR_COINS_PER_STAR = 10;
/** The first clear of a level marked `hard` pays this many times the normal amount. */
export const HARD_LEVEL_MULTIPLIER = 2;
/** Replaying a cleared level: this much per star gained beyond the previous best. */
export const REPLAY_COINS_PER_NEW_STAR = 10;

/**
 * Coins for winning a level. `previousStars` is 0 when the level was never cleared before.
 * First clear: 20 + 10 per star, doubled on a hard level. Replay: 10 per newly gained star
 * (0 when no improvement), hard or not.
 */
export function levelReward(previousStars: number, stars: number, hard: boolean = false): number {
  if (previousStars <= 0) {
    const base = FIRST_CLEAR_COINS + FIRST_CLEAR_COINS_PER_STAR * stars;
    return hard === true ? base * HARD_LEVEL_MULTIPLIER : base;
  }
  return REPLAY_COINS_PER_NEW_STAR * Math.max(0, stars - previousStars);
}

// ───────────────────────────── boosters ─────────────────────────────

/** Inventory of a brand-new profile: nothing. Each booster arrives as a gift at its unlock level. */
export const START_BOOSTERS: Readonly<Record<BoosterId, number>> = {
  hammer: 0,
  freeSwap: 0,
  shuffle: 0,
  extraMoves: 0,
  prism: 0,
  beamNova: 0,
};

/** Coin price of one booster. */
export const BOOSTER_PRICES: Readonly<Record<BoosterId, number>> = {
  hammer: 650,
  freeSwap: 600,
  shuffle: 400,
  extraMoves: 500,
  prism: 800,
  beamNova: 650,
};

/** The level the player must have reached (`highestUnlocked() >= level`) for a booster to exist for her. */
export const BOOSTER_UNLOCK_LEVEL: Readonly<Record<BoosterId, number>> = {
  beamNova: 7,
  hammer: 8,
  freeSwap: 12,
  prism: 14,
  shuffle: 16,
  extraMoves: 19,
};

/** How many of a booster are given, once, when it unlocks. */
export const BOOSTER_UNLOCK_GIFT: Readonly<Record<BoosterId, number>> = {
  beamNova: 2,
  hammer: 3,
  freeSwap: 3,
  prism: 2,
  shuffle: 3,
  extraMoves: 2,
};

/** All boosters in the order they unlock. */
export const BOOSTER_UNLOCK_ORDER: readonly BoosterId[] = ['beamNova', 'hammer', 'freeSwap', 'prism', 'shuffle', 'extraMoves'];

// ───────────────────────────── feature gating ─────────────────────────────

/**
 * The level the player must have reached for a feature to appear. ('daily' is gated by the
 * calendar instead: see DAILY_UNLOCK_AFTER_DAYS. Interstitial eligibility: src/monetize/catalog.ts.)
 */
export const FEATURE_UNLOCK_LEVEL: Readonly<Record<Exclude<FeatureId, 'daily'>, number>> = {
  lives: 6,
  shop: 10,
  rewardedAds: 11,
  caravan: 20,
};

/** The daily reward is first offered this many local calendar days after the first play (1 = the second day). */
export const DAILY_UNLOCK_AFTER_DAYS = 1;

// ───────────────────────────── Caravan (win streak) ─────────────────────────────

/** Consecutive wins needed for each free start booster of the Caravan. */
export const CARAVAN_BEAM_NOVA_WINS = 1;
export const CARAVAN_PRISM_WINS = 2;
export const CARAVAN_EXTRA_MOVES_WINS = 3;

// ───────────────────────────── continue after losing ─────────────────────────────

/** Moves granted by one paid continue. */
export const CONTINUE_MOVES = 5;
/** Price of the 1st, 2nd, 3rd continue within the same attempt. There is no fourth. */
export const CONTINUE_PRICES: readonly number[] = [900, 1900, 2900];
/** Continues that can be bought within one attempt. */
export const MAX_CONTINUES = CONTINUE_PRICES.length;

/**
 * Price of the next continue when `used` continues were already bought in this attempt.
 * Always a number (beyond the third it repeats the last price) — for callers that only want a
 * price to show. Whether another continue is ALLOWED is answered by `continuePriceOrNull` /
 * `profile.continuePrice`, which return null after the third.
 */
export function continuePrice(used: number): number {
  const i = Math.max(0, Math.min(CONTINUE_PRICES.length - 1, Math.floor(used) || 0));
  return CONTINUE_PRICES[i]!;
}

/** Price of continue number `used` (0, 1, 2) within one attempt, or null when no more are allowed. */
export function continuePriceOrNull(used: number): number | null {
  if (typeof used !== 'number' || used !== used) return null;
  const i = Math.floor(used);
  return i >= 0 && i < CONTINUE_PRICES.length ? CONTINUE_PRICES[i]! : null;
}

// ───────────────────────────── rewarded-ad amounts (DESIGN §7) ─────────────────────────────

/** Moves granted by the rewarded-ad continue in the lose dialog (fewer than the paid one). */
export const AD_CONTINUE_MOVES = 3;
/** Coins granted by one "free coins" rewarded ad in the shop. */
export const FREE_COINS_AD_REWARD = 50;

// ───────────────────────────── daily reward ─────────────────────────────

/** Length of the daily-reward cycle. */
export const DAILY_CYCLE_DAYS = 7;

/** A daily reward for a booster that is still locked is paid as this many coins instead. */
export const DAILY_LOCKED_BOOSTER_COINS = 150;

/** Rewards of day 1..7 of the cycle (index 0 = day 1). Frozen: treat as read-only data. */
export const DAILY_CYCLE: Reward[][] = deepFreeze([
  [{ kind: 'coins', amount: 100 }],
  [{ kind: 'booster', id: 'hammer', amount: 1 }],
  [{ kind: 'coins', amount: 150 }],
  [
    { kind: 'booster', id: 'shuffle', amount: 1 },
    { kind: 'booster', id: 'freeSwap', amount: 1 },
  ],
  [{ kind: 'coins', amount: 200 }],
  [{ kind: 'booster', id: 'beamNova', amount: 1 }],
  [
    { kind: 'coins', amount: 500 },
    { kind: 'booster', id: 'prism', amount: 1 },
  ],
]);

function deepFreeze(cycle: Reward[][]): Reward[][] {
  for (const day of cycle) {
    for (const reward of day) Object.freeze(reward);
    Object.freeze(day);
  }
  return Object.freeze(cycle) as Reward[][];
}

/**
 * The rewards of one cycle day as they are really paid to a player: every reward for a booster
 * that `unlocked` rejects becomes DAILY_LOCKED_BOOSTER_COINS coins, and all coins of the day are
 * shown as one amount (first). Returns fresh objects.
 */
export function dailyRewardsFor(day: readonly Reward[], unlocked: (id: BoosterId) => boolean): Reward[] {
  let coins = 0;
  const rest: Reward[] = [];
  for (const r of day) {
    if (r.kind === 'coins') coins += r.amount;
    else if (r.kind === 'booster' && !unlocked(r.id)) coins += DAILY_LOCKED_BOOSTER_COINS;
    else rest.push({ ...r });
  }
  return coins > 0 ? [{ kind: 'coins', amount: coins } as Reward].concat(rest) : rest;
}

// ───────────────────────────── world ─────────────────────────────

export const CHAPTER_COUNT = 6;
export const LEVELS_PER_CHAPTER = 20;
/** 120 levels in 6 chapters of 20. */
export const TOTAL_LEVELS = CHAPTER_COUNT * LEVELS_PER_CHAPTER;

// ───────────────────────────── sanity caps (not design numbers) ─────────────────────────────
// Upper bounds used when repairing a damaged save and to keep arithmetic far from overflow.

export const MAX_COINS = 999_999_999;
export const MAX_BOOSTER_COUNT = 9_999;
