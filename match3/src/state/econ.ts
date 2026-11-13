/**
 * Every number of the in-game economy (docs/DESIGN.md §5) in one place.
 * Pure data + two tiny pure helpers; nothing here touches storage or the clock.
 *
 * NOTE: §5 has since been revised by the strategy study (docs/STRATEGY.md: 30-minute lives, 2,000
 * starting coins, new prices and daily cycle, booster unlocks, the Caravan). These are still the
 * numbers of the §5 before that revision; the new economy is implemented by the economy module
 * (contract: ./extensions.ts), which replaces them.
 */
import type { BoosterId, Reward } from './types.ts';

// ───────────────────────────── lives ─────────────────────────────

export const MAX_LIVES = 5;
/** One life regenerates every 20 minutes. */
export const LIFE_REGEN_MS = 20 * 60 * 1000;
/** Coins to refill all lives at once. */
export const REFILL_LIVES_PRICE = 120;

// ───────────────────────────── coins & level rewards ─────────────────────────────

export const START_COINS = 150;
/** First clear of a level: FIRST_CLEAR_COINS + FIRST_CLEAR_COINS_PER_STAR × stars. */
export const FIRST_CLEAR_COINS = 20;
export const FIRST_CLEAR_COINS_PER_STAR = 10;
/** Replaying a cleared level: this much per star gained beyond the previous best. */
export const REPLAY_COINS_PER_NEW_STAR = 10;

/**
 * Coins for winning a level. `previousStars` is 0 when the level was never cleared before.
 * First clear: 20 + 10 per star. Replay: 10 per newly gained star (0 when no improvement).
 */
export function levelReward(previousStars: number, stars: number): number {
  if (previousStars <= 0) return FIRST_CLEAR_COINS + FIRST_CLEAR_COINS_PER_STAR * stars;
  return REPLAY_COINS_PER_NEW_STAR * Math.max(0, stars - previousStars);
}

// ───────────────────────────── boosters ─────────────────────────────

/** Inventory of a brand-new profile. */
export const START_BOOSTERS: Readonly<Record<BoosterId, number>> = {
  hammer: 3,
  freeSwap: 3,
  shuffle: 3,
  extraMoves: 2,
  prism: 1,
  beamNova: 1,
};

/** Coin price of one booster. */
export const BOOSTER_PRICES: Readonly<Record<BoosterId, number>> = {
  hammer: 90,
  freeSwap: 80,
  shuffle: 60,
  extraMoves: 70,
  prism: 120,
  beamNova: 100,
};

// ───────────────────────────── continue after losing ─────────────────────────────

/** Moves granted by one continue. */
export const CONTINUE_MOVES = 5;
/** Price of the 1st, 2nd, 3rd continue within the same attempt. */
export const CONTINUE_PRICES: readonly number[] = [90, 150, 240];

/**
 * Price of the next continue when `used` continues were already bought in this attempt.
 * Further continues after the third stay at the last price.
 */
export function continuePrice(used: number): number {
  const i = Math.max(0, Math.min(CONTINUE_PRICES.length - 1, Math.floor(used) || 0));
  return CONTINUE_PRICES[i]!;
}

// ───────────────────────────── daily reward ─────────────────────────────

/** Length of the daily-reward cycle. */
export const DAILY_CYCLE_DAYS = 7;

/** Rewards of day 1..7 of the cycle (index 0 = day 1). Frozen: treat as read-only data. */
export const DAILY_CYCLE: Reward[][] = deepFreeze([
  [{ kind: 'coins', amount: 50 }],
  [{ kind: 'booster', id: 'hammer', amount: 1 }],
  [{ kind: 'coins', amount: 80 }],
  [
    { kind: 'booster', id: 'shuffle', amount: 1 },
    { kind: 'booster', id: 'freeSwap', amount: 1 },
  ],
  [{ kind: 'coins', amount: 120 }],
  [
    { kind: 'booster', id: 'extraMoves', amount: 1 },
    { kind: 'booster', id: 'beamNova', amount: 1 },
  ],
  [
    { kind: 'coins', amount: 250 },
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

// ───────────────────────────── world ─────────────────────────────

export const CHAPTER_COUNT = 6;
export const LEVELS_PER_CHAPTER = 20;
/** 120 levels in 6 chapters of 20. */
export const TOTAL_LEVELS = CHAPTER_COUNT * LEVELS_PER_CHAPTER;

// ───────────────────────────── sanity caps (not design numbers) ─────────────────────────────
// Upper bounds used when repairing a damaged save and to keep arithmetic far from overflow.

export const MAX_COINS = 999_999_999;
export const MAX_BOOSTER_COUNT = 9_999;
