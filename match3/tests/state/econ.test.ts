import { describe, expect, it } from 'vitest';
import {
  BOOSTER_PRICES,
  CHAPTER_COUNT,
  CONTINUE_MOVES,
  CONTINUE_PRICES,
  DAILY_CYCLE,
  DAILY_CYCLE_DAYS,
  FIRST_CLEAR_COINS,
  FIRST_CLEAR_COINS_PER_STAR,
  LEVELS_PER_CHAPTER,
  LIFE_REGEN_MS,
  MAX_BOOSTER_COUNT,
  MAX_COINS,
  MAX_LIVES,
  REFILL_LIVES_PRICE,
  REPLAY_COINS_PER_NEW_STAR,
  START_BOOSTERS,
  START_COINS,
  TOTAL_LEVELS,
  continuePrice,
  levelReward,
} from '../../src/state/econ.ts';
import { ALL_BOOSTERS } from '../../src/state/types.ts';
import type { Reward } from '../../src/state/types.ts';

// The numbers below are copied from docs/DESIGN.md §5 on purpose: this file fails when the code
// and the design drift apart.
describe('economy numbers (DESIGN §5)', () => {
  it('lives: max 5, one every 20 minutes, refill for 120 coins', () => {
    expect(MAX_LIVES).toBe(5);
    expect(LIFE_REGEN_MS).toBe(20 * 60 * 1000);
    expect(REFILL_LIVES_PRICE).toBe(120);
  });

  it('coins: start with 150; first clear 20 + 10 per star; replays 10 per new star', () => {
    expect(START_COINS).toBe(150);
    expect(FIRST_CLEAR_COINS).toBe(20);
    expect(FIRST_CLEAR_COINS_PER_STAR).toBe(10);
    expect(REPLAY_COINS_PER_NEW_STAR).toBe(10);
  });

  it('boosters: starting inventory', () => {
    expect(START_BOOSTERS).toEqual({ hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 1, beamNova: 1 });
  });

  it('boosters: prices', () => {
    expect(BOOSTER_PRICES).toEqual({ hammer: 90, freeSwap: 80, shuffle: 60, extraMoves: 70, prism: 120, beamNova: 100 });
  });

  it('every booster has a starting amount and a positive whole price', () => {
    expect(Object.keys(START_BOOSTERS).sort()).toEqual([...ALL_BOOSTERS].sort());
    expect(Object.keys(BOOSTER_PRICES).sort()).toEqual([...ALL_BOOSTERS].sort());
    for (const id of ALL_BOOSTERS) {
      expect(Number.isInteger(BOOSTER_PRICES[id]) && BOOSTER_PRICES[id] > 0).toBe(true);
      expect(Number.isInteger(START_BOOSTERS[id]) && START_BOOSTERS[id] >= 0).toBe(true);
    }
  });

  it('continue: +5 moves for 90, then 150, then 240', () => {
    expect(CONTINUE_MOVES).toBe(5);
    expect(CONTINUE_PRICES).toEqual([90, 150, 240]);
  });

  it('daily reward: the 7-day cycle', () => {
    const expected: Reward[][] = [
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
    ];
    expect(DAILY_CYCLE_DAYS).toBe(7);
    expect(DAILY_CYCLE).toEqual(expected);
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

  it('continuePrice: 90 → 150 → 240, then stays at 240', () => {
    expect(continuePrice(0)).toBe(90);
    expect(continuePrice(1)).toBe(150);
    expect(continuePrice(2)).toBe(240);
    expect(continuePrice(3)).toBe(240);
    expect(continuePrice(50)).toBe(240);
  });

  it('continuePrice: nonsense input is treated as the first continue', () => {
    expect(continuePrice(-1)).toBe(90);
    expect(continuePrice(NaN)).toBe(90);
    expect(continuePrice(0.9)).toBe(90);
    expect(continuePrice(1.9)).toBe(150);
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
