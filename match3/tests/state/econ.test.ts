import { describe, expect, it } from 'vitest';
import {
  AD_CONTINUE_MOVES,
  BOOSTER_PRICES,
  BOOSTER_UNLOCK_GIFT,
  BOOSTER_UNLOCK_LEVEL,
  BOOSTER_UNLOCK_ORDER,
  CHAPTER_COUNT,
  CONTINUE_MOVES,
  CONTINUE_PRICES,
  DAILY_CYCLE,
  DAILY_CYCLE_DAYS,
  DAILY_LOCKED_BOOSTER_COINS,
  FEATURE_UNLOCK_LEVEL,
  FIRST_CLEAR_COINS,
  FIRST_CLEAR_COINS_PER_STAR,
  FREE_COINS_AD_REWARD,
  HARD_LEVEL_MULTIPLIER,
  LEVELS_PER_CHAPTER,
  LIFE_REGEN_MS,
  MAX_BOOSTER_COUNT,
  MAX_COINS,
  MAX_CONTINUES,
  MAX_LIVES,
  REFILL_LIVES_PRICE,
  REPLAY_COINS_PER_NEW_STAR,
  START_BOOSTERS,
  START_COINS,
  TOTAL_LEVELS,
  continuePrice,
  continuePriceOrNull,
  dailyRewardsFor,
  levelReward,
} from '../../src/state/econ.ts';
import { ALL_BOOSTERS } from '../../src/state/types.ts';
import type { Reward } from '../../src/state/types.ts';

// The numbers below are copied from docs/DESIGN.md §5 on purpose: this file fails when the code
// and the design drift apart.
describe('economy numbers (DESIGN §5)', () => {
  it('lives: max 5, one every 30 minutes, refill for 900 coins', () => {
    expect(MAX_LIVES).toBe(5);
    expect(LIFE_REGEN_MS).toBe(30 * 60 * 1000);
    expect(REFILL_LIVES_PRICE).toBe(900);
  });

  it('coins: start with 2,000; first clear 20 + 10 per star, double on hard levels; replays 10 per new star', () => {
    expect(START_COINS).toBe(2000);
    expect(FIRST_CLEAR_COINS).toBe(20);
    expect(FIRST_CLEAR_COINS_PER_STAR).toBe(10);
    expect(HARD_LEVEL_MULTIPLIER).toBe(2);
    expect(REPLAY_COINS_PER_NEW_STAR).toBe(10);
  });

  it('boosters: none at install', () => {
    expect(START_BOOSTERS).toEqual({ hammer: 0, freeSwap: 0, shuffle: 0, extraMoves: 0, prism: 0, beamNova: 0 });
  });

  it('boosters: prices', () => {
    expect(BOOSTER_PRICES).toEqual({ hammer: 650, freeSwap: 600, shuffle: 400, extraMoves: 500, prism: 800, beamNova: 650 });
  });

  it('boosters: unlock levels and introduction gifts', () => {
    expect(BOOSTER_UNLOCK_LEVEL).toEqual({ beamNova: 7, hammer: 8, freeSwap: 12, prism: 14, shuffle: 16, extraMoves: 19 });
    expect(BOOSTER_UNLOCK_GIFT).toEqual({ beamNova: 2, hammer: 3, freeSwap: 3, prism: 2, shuffle: 3, extraMoves: 2 });
    expect([...BOOSTER_UNLOCK_ORDER].sort()).toEqual([...ALL_BOOSTERS].sort());
    const levels = BOOSTER_UNLOCK_ORDER.map((id) => BOOSTER_UNLOCK_LEVEL[id]);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('feature gating: lives L6, shop L10, rewarded ads L11, Caravan L20', () => {
    expect(FEATURE_UNLOCK_LEVEL).toEqual({ lives: 6, shop: 10, rewardedAds: 11, caravan: 20 });
  });

  it('rewarded ads: +3 moves for the continue, 50 free coins', () => {
    expect(AD_CONTINUE_MOVES).toBe(3);
    expect(AD_CONTINUE_MOVES).toBeLessThan(CONTINUE_MOVES);
    expect(FREE_COINS_AD_REWARD).toBe(50);
  });

  it('every booster has a starting amount and a positive whole price', () => {
    expect(Object.keys(START_BOOSTERS).sort()).toEqual([...ALL_BOOSTERS].sort());
    expect(Object.keys(BOOSTER_PRICES).sort()).toEqual([...ALL_BOOSTERS].sort());
    for (const id of ALL_BOOSTERS) {
      expect(Number.isInteger(BOOSTER_PRICES[id]) && BOOSTER_PRICES[id] > 0).toBe(true);
      expect(Number.isInteger(START_BOOSTERS[id]) && START_BOOSTERS[id] >= 0).toBe(true);
    }
  });

  it('continue: +5 moves for 900, then 1,900, then 2,900 — three at most', () => {
    expect(CONTINUE_MOVES).toBe(5);
    expect(CONTINUE_PRICES).toEqual([900, 1900, 2900]);
    expect(MAX_CONTINUES).toBe(3);
  });

  it('daily reward: the 7-day cycle', () => {
    const expected: Reward[][] = [
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
    ];
    expect(DAILY_CYCLE_DAYS).toBe(7);
    expect(DAILY_CYCLE).toEqual(expected);
    expect(DAILY_LOCKED_BOOSTER_COINS).toBe(150);
  });

  it('daily reward: a locked booster is paid as 150 coins, and the coins of a day are one amount', () => {
    const none = (): boolean => false;
    const all = (): boolean => true;
    expect(DAILY_CYCLE.map((day) => dailyRewardsFor(day, all))).toEqual(DAILY_CYCLE);
    expect(DAILY_CYCLE.map((day) => dailyRewardsFor(day, none))).toEqual(
      [100, 150, 150, 300, 200, 150, 650].map((amount) => [{ kind: 'coins', amount }]),
    );
    // only freeSwap unlocked: the shuffle of day 4 becomes coins, the freeSwap stays
    expect(dailyRewardsFor(DAILY_CYCLE[3]!, (id) => id === 'freeSwap')).toEqual([
      { kind: 'coins', amount: 150 },
      { kind: 'booster', id: 'freeSwap', amount: 1 },
    ]);
    // fresh objects, never the frozen table's own
    const copy = dailyRewardsFor(DAILY_CYCLE[0]!, all);
    expect(copy[0]).not.toBe(DAILY_CYCLE[0]![0]);
  });

  it('world: 120 levels in 6 chapters of 20', () => {
    expect(CHAPTER_COUNT).toBe(6);
    expect(LEVELS_PER_CHAPTER).toBe(20);
    expect(TOTAL_LEVELS).toBe(120);
  });
});

describe('economy helpers', () => {
  it('levelReward: first clear pays 20 + 10 per star', () => {
    expect(levelReward(0, 1)).toBe(30);
    expect(levelReward(0, 2)).toBe(40);
    expect(levelReward(0, 3)).toBe(50);
  });

  it('levelReward: the first clear of a hard level pays double, replays never do', () => {
    expect(levelReward(0, 1, true)).toBe(60);
    expect(levelReward(0, 2, true)).toBe(80);
    expect(levelReward(0, 3, true)).toBe(100);
    expect(levelReward(0, 3, false)).toBe(50);
    expect(levelReward(1, 3, true)).toBe(20);
    expect(levelReward(3, 3, true)).toBe(0);
  });

  it('levelReward: a replay pays 10 per newly gained star and nothing otherwise', () => {
    expect(levelReward(1, 1)).toBe(0);
    expect(levelReward(1, 2)).toBe(10);
    expect(levelReward(1, 3)).toBe(20);
    expect(levelReward(2, 3)).toBe(10);
    expect(levelReward(3, 3)).toBe(0);
    expect(levelReward(3, 1)).toBe(0);
    expect(levelReward(2, 1)).toBe(0);
  });

  it('levelReward: the stars of a level are worth the same however they are collected, minus the clear bonus', () => {
    // 1★ first, then 2★, then 3★  ==  3★ straight away
    expect(levelReward(0, 1) + levelReward(1, 2) + levelReward(2, 3)).toBe(levelReward(0, 3));
    expect(levelReward(0, 2) + levelReward(2, 3)).toBe(levelReward(0, 3));
  });

  it('continuePrice: 900 → 1,900 → 2,900, then stays at 2,900 (a price to show)', () => {
    expect(continuePrice(0)).toBe(900);
    expect(continuePrice(1)).toBe(1900);
    expect(continuePrice(2)).toBe(2900);
    expect(continuePrice(3)).toBe(2900);
    expect(continuePrice(50)).toBe(2900);
  });

  it('continuePrice: nonsense input is treated as the first continue', () => {
    expect(continuePrice(-1)).toBe(900);
    expect(continuePrice(NaN)).toBe(900);
    expect(continuePrice(0.9)).toBe(900);
    expect(continuePrice(1.9)).toBe(1900);
  });

  it('continuePriceOrNull: three continues per attempt, then no more', () => {
    expect([0, 1, 2].map(continuePriceOrNull)).toEqual([900, 1900, 2900]);
    expect(continuePriceOrNull(3)).toBeNull();
    expect(continuePriceOrNull(50)).toBeNull();
    expect(continuePriceOrNull(-1)).toBeNull();
    expect(continuePriceOrNull(NaN)).toBeNull();
    expect(continuePriceOrNull(1.9)).toBe(1900);
    // the smallest coin pack (1,000 coins) buys the first continue with a little left over
    expect(continuePriceOrNull(0)!).toBeLessThan(1000);
  });

  it('the daily cycle cannot be modified by accident', () => {
    expect(Object.isFrozen(DAILY_CYCLE)).toBe(true);
    expect(Object.isFrozen(DAILY_CYCLE[0])).toBe(true);
    expect(Object.isFrozen(DAILY_CYCLE[0]![0])).toBe(true);
    expect(() => DAILY_CYCLE.push([])).toThrow();
    expect(() => {
      (DAILY_CYCLE[0]![0] as { amount: number }).amount = 1_000_000;
    }).toThrow();
  });

  it('caps leave plenty of room for anything the game can grant', () => {
    expect(MAX_COINS).toBeGreaterThanOrEqual(100_000_000);
    expect(MAX_BOOSTER_COUNT).toBeGreaterThanOrEqual(999);
    expect(Number.isSafeInteger(MAX_COINS * 2)).toBe(true);
  });
});
