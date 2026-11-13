import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProfile } from '../../src/state/index.ts';
import {
  BOOSTER_PRICES,
  MAX_BOOSTER_COUNT,
  MAX_COINS,
  START_BOOSTERS,
  START_COINS,
} from '../../src/state/econ.ts';
import { ALL_BOOSTERS } from '../../src/state/types.ts';
import type { BoosterId, Reward, Settings } from '../../src/state/types.ts';
import { DAY, MINUTE, T0, fromSave, harness, sampleSave } from './harness.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a new profile', () => {
  it('starts with the designed defaults', () => {
    const h = harness();
    const p = h.profile;
    expect(p.coins()).toBe(150);
    expect(p.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    for (const id of ALL_BOOSTERS) expect(p.boosterCount(id)).toBe(START_BOOSTERS[id]);
    expect(p.highestUnlocked()).toBe(1);
    expect(p.totalStars()).toBe(0);
    expect(p.record(1)).toBeNull();
    expect(p.settings()).toEqual({ sfx: true, music: true, haptics: true, lang: null });
    expect(p.daily().canClaim).toBe(true);
    expect(p.hasSeen('anything')).toBe(false);
    expect(p.data()).toEqual({
      version: 1,
      levels: {},
      coins: 150,
      lives: 5,
      lifeTimer: 0,
      boosters: { hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 1, beamNova: 1 },
      settings: { sfx: true, music: true, haptics: true, lang: null },
      dailyDay: -1,
      dailyStreak: 0,
      seen: [],
      stats: { played: 0, won: 0, bestCascade: 0, totalScore: 0 },
    });
  });

  it('creating and reading it writes nothing', () => {
    const h = harness();
    const p = h.profile;
    p.data();
    p.lives();
    p.coins();
    p.daily();
    p.settings();
    p.highestUnlocked();
    p.totalStars();
    p.boosterPrice('hammer');
    expect(h.storage.writes).toBe(0);
    expect(h.storage.json).toBeNull();
    expect(h.notifications.count).toBe(0);
  });

  it('two new profiles do not share state', () => {
    const a = harness();
    const b = harness();
    a.profile.addCoins(10);
    a.profile.addBooster('hammer', 2);
    a.profile.markSeen('x');
    a.profile.setSetting('sfx', false);
    a.profile.recordWin(1, 3, 100, 1);
    expect(b.profile.coins()).toBe(START_COINS);
    expect(b.profile.boosterCount('hammer')).toBe(START_BOOSTERS.hammer);
    expect(b.profile.hasSeen('x')).toBe(false);
    expect(b.profile.settings().sfx).toBe(true);
    expect(b.profile.record(1)).toBeNull();
    expect(START_BOOSTERS.hammer).toBe(3);
  });
});

describe('coins', () => {
  it('addCoins adds, saves and notifies once', () => {
    const h = harness();
    h.profile.addCoins(25);
    expect(h.profile.coins()).toBe(175);
    expect(h.saved().coins).toBe(175);
    expect(h.storage.writes).toBe(1);
    expect(h.notifications.count).toBe(1);
  });

  it('addCoins ignores zero, negative and non-numeric amounts', () => {
    const h = harness();
    // Infinity included: an unbounded amount is a bug in the caller, never a jackpot.
    for (const bad of [0, -5, NaN, Infinity, -Infinity, 0.99, '10' as unknown as number, undefined as unknown as number]) {
      h.profile.addCoins(bad);
    }
    expect(h.profile.coins()).toBe(START_COINS);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });

  it('addCoins rounds fractions down and caps at the maximum', () => {
    const h = harness();
    h.profile.addCoins(10.9);
    expect(h.profile.coins()).toBe(160);
    h.profile.addCoins(1e300);
    expect(h.profile.coins()).toBe(MAX_COINS);
    const writes = h.storage.writes;
    h.profile.addCoins(5); // already at the cap: nothing changes
    expect(h.profile.coins()).toBe(MAX_COINS);
    expect(h.storage.writes).toBe(writes);
  });

  it('holds the largest coin pack many times over', () => {
    const h = harness();
    for (let i = 0; i < 100; i++) h.profile.addCoins(15_000);
    expect(h.profile.coins()).toBe(START_COINS + 1_500_000);
    expect(h.restart().profile.coins()).toBe(START_COINS + 1_500_000);
  });

  it('spendCoins takes the coins when there are enough', () => {
    const h = harness();
    expect(h.profile.spendCoins(90)).toBe(true);
    expect(h.profile.coins()).toBe(60);
    expect(h.saved().coins).toBe(60);
    expect(h.notifications.count).toBe(1);
    expect(h.profile.spendCoins(60)).toBe(true);
    expect(h.profile.coins()).toBe(0);
  });

  it('spendCoins refuses when there are not enough, and changes nothing', () => {
    const h = harness();
    expect(h.profile.spendCoins(151)).toBe(false);
    expect(h.profile.coins()).toBe(150);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });

  it('spendCoins refuses negative and non-numeric amounts (never a way to gain coins)', () => {
    const h = harness();
    for (const bad of [-1, -1000, NaN, Infinity, -Infinity, '5' as unknown as number]) {
      expect(h.profile.spendCoins(bad)).toBe(false);
    }
    expect(h.profile.coins()).toBe(150);
    expect(h.storage.writes).toBe(0);
  });

  it('spending nothing succeeds without saving', () => {
    const h = harness();
    expect(h.profile.spendCoins(0)).toBe(true);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });

  it('spendCoins rounds a fractional price up', () => {
    const h = harness();
    expect(h.profile.spendCoins(149.2)).toBe(true);
    expect(h.profile.coins()).toBe(0);
    expect(h.profile.spendCoins(0.1)).toBe(false);
  });

  it('the continue prices add up: 90 + 150 + 240', () => {
    const h = harness();
    h.profile.addCoins(480 - START_COINS);
    expect(h.profile.spendCoins(90)).toBe(true);
    expect(h.profile.spendCoins(150)).toBe(true);
    expect(h.profile.spendCoins(240)).toBe(true);
    expect(h.profile.coins()).toBe(0);
    expect(h.profile.spendCoins(1)).toBe(false);
  });
});

describe('boosters', () => {
  it('prices are the designed ones', () => {
    const p = harness().profile;
    expect(ALL_BOOSTERS.map((id) => p.boosterPrice(id))).toEqual([90, 80, 60, 70, 120, 100]);
  });

  it('takeBooster consumes one, down to zero', () => {
    const h = harness();
    expect(h.profile.takeBooster('prism')).toBe(true);
    expect(h.profile.boosterCount('prism')).toBe(0);
    expect(h.saved().boosters.prism).toBe(0);
    expect(h.notifications.count).toBe(1);
    expect(h.profile.takeBooster('prism')).toBe(false);
    expect(h.profile.boosterCount('prism')).toBe(0);
    expect(h.notifications.count).toBe(1);
    expect(h.storage.writes).toBe(1);
  });

  it('addBooster adds whole amounts only', () => {
    const h = harness();
    h.profile.addBooster('shuffle', 2);
    expect(h.profile.boosterCount('shuffle')).toBe(5);
    h.profile.addBooster('shuffle', 1.9);
    expect(h.profile.boosterCount('shuffle')).toBe(6);
    const writes = h.storage.writes;
    for (const bad of [0, -3, NaN, 0.5]) h.profile.addBooster('shuffle', bad);
    expect(h.profile.boosterCount('shuffle')).toBe(6);
    expect(h.storage.writes).toBe(writes);
  });

  it('addBooster caps the inventory', () => {
    const h = harness();
    h.profile.addBooster('hammer', 1e12);
    expect(h.profile.boosterCount('hammer')).toBe(MAX_BOOSTER_COUNT);
  });

  it('buyBooster charges the price and adds one', () => {
    for (const id of ALL_BOOSTERS) {
      const h = harness();
      h.profile.addCoins(1000);
      expect(h.profile.buyBooster(id)).toBe(true);
      expect(h.profile.coins()).toBe(1150 - BOOSTER_PRICES[id]);
      expect(h.profile.boosterCount(id)).toBe(START_BOOSTERS[id] + 1);
      expect(h.saved().coins).toBe(1150 - BOOSTER_PRICES[id]);
      expect(h.saved().boosters[id]).toBe(START_BOOSTERS[id] + 1);
      expect(h.notifications.count).toBe(2); // addCoins + one for the whole purchase
    }
  });

  it('buyBooster is refused without enough coins — nothing is charged or added', () => {
    const h = harness();
    h.profile.spendCoins(START_COINS - 119); // 119 left, prism costs 120
    const writes = h.storage.writes;
    expect(h.profile.buyBooster('prism')).toBe(false);
    expect(h.profile.coins()).toBe(119);
    expect(h.profile.boosterCount('prism')).toBe(START_BOOSTERS.prism);
    expect(h.storage.writes).toBe(writes);
    h.profile.addCoins(1);
    expect(h.profile.buyBooster('prism')).toBe(true);
    expect(h.profile.coins()).toBe(0);
  });

  it('buyBooster is refused (and free of charge) when the inventory is full', () => {
    const h = harness();
    h.profile.addBooster('shuffle', MAX_BOOSTER_COUNT);
    const coins = h.profile.coins();
    expect(h.profile.buyBooster('shuffle')).toBe(false);
    expect(h.profile.coins()).toBe(coins);
  });

  it('150 starting coins buy exactly what the prices allow', () => {
    const h = harness();
    expect(h.profile.buyBooster('shuffle')).toBe(true); // 60 → 90 left
    expect(h.profile.buyBooster('freeSwap')).toBe(true); // 80 → 10 left
    expect(h.profile.buyBooster('shuffle')).toBe(false);
    expect(h.profile.coins()).toBe(10);
  });

  it('unknown booster ids are harmless', () => {
    const h = harness();
    const ghost = 'rocket' as unknown as BoosterId;
    const proto = 'constructor' as unknown as BoosterId;
    for (const id of [ghost, proto, '__proto__' as unknown as BoosterId, undefined as unknown as BoosterId]) {
      expect(h.profile.boosterCount(id)).toBe(0);
      expect(h.profile.takeBooster(id)).toBe(false);
      expect(h.profile.buyBooster(id)).toBe(false);
      expect(h.profile.boosterPrice(id)).toBe(Infinity);
      h.profile.addBooster(id, 5);
    }
    expect(h.storage.writes).toBe(0);
    expect(h.profile.coins()).toBe(START_COINS);
    expect(Object.keys(h.profile.data().boosters).sort()).toEqual([...ALL_BOOSTERS].sort());
  });
});

describe('grant', () => {
  it('applies several rewards with a single save and a single notification', () => {
    const h = harness();
    h.profile.loseLife();
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    h.profile.grant([
      { kind: 'coins', amount: 1000 },
      { kind: 'booster', id: 'hammer', amount: 3 },
      { kind: 'booster', id: 'freeSwap', amount: 3 },
      { kind: 'booster', id: 'prism', amount: 2 },
      { kind: 'lives' },
    ]);
    expect(h.profile.coins()).toBe(1150);
    expect(h.profile.boosterCount('hammer')).toBe(6);
    expect(h.profile.boosterCount('freeSwap')).toBe(6);
    expect(h.profile.boosterCount('prism')).toBe(3);
    expect(h.profile.lives().count).toBe(5);
    expect(h.storage.writes).toBe(writes + 1);
    expect(h.notifications.count).toBe(notes + 1);
    expect(h.restart().profile.coins()).toBe(1150);
  });

  it('an empty list does nothing', () => {
    const h = harness();
    h.profile.grant([]);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });

  it('malformed rewards are skipped, valid ones in the same list still count', () => {
    const h = harness();
    const junk = [
      null,
      undefined,
      42,
      'coins',
      { kind: 'gold', amount: 5 },
      { kind: 'coins' },
      { kind: 'coins', amount: -50 },
      { kind: 'coins', amount: '50' },
      { kind: 'booster', id: 'rocket', amount: 1 },
      { kind: 'booster', id: 'hammer', amount: -1 },
      { kind: 'booster', id: 'hammer' },
      { kind: 'coins', amount: 7 },
    ] as unknown as Reward[];
    expect(() => h.profile.grant(junk)).not.toThrow();
    expect(h.profile.coins()).toBe(START_COINS + 7);
    expect(h.profile.boosterCount('hammer')).toBe(START_BOOSTERS.hammer);
    expect(() => h.profile.grant(null as unknown as Reward[])).not.toThrow();
    expect(() => h.profile.grant({ kind: 'coins', amount: 5 } as unknown as Reward[])).not.toThrow();
    expect(h.profile.coins()).toBe(START_COINS + 7);
  });

  it('does not modify the rewards it is given', () => {
    const h = harness();
    const rewards: Reward[] = [{ kind: 'coins', amount: 5 }, { kind: 'booster', id: 'prism', amount: 1 }];
    const copy = JSON.parse(JSON.stringify(rewards));
    h.profile.grant(rewards);
    expect(rewards).toEqual(copy);
  });
});

describe('progress', () => {
  it('first clear pays 20 + 10 per star and unlocks the next level', () => {
    for (const stars of [1, 2, 3] as const) {
      const h = harness();
      const summary = h.profile.recordWin(1, stars, 2500, 3);
      expect(summary).toEqual({ firstClear: true, newStars: stars, coinsEarned: 20 + 10 * stars, newBest: true });
      expect(h.profile.coins()).toBe(START_COINS + 20 + 10 * stars);
      expect(h.profile.record(1)).toEqual({ stars, best: 2500 });
      expect(h.profile.highestUnlocked()).toBe(2);
      expect(h.profile.totalStars()).toBe(stars);
      expect(h.saved().levels['1']).toEqual({ stars, best: 2500 });
      expect(h.notifications.count).toBe(1);
      expect(h.storage.writes).toBe(1);
    }
  });

  it('a replay pays 10 per newly gained star', () => {
    const h = harness();
    h.profile.recordWin(1, 1, 1000, 1); // +30
    expect(h.profile.recordWin(1, 3, 900, 1)).toEqual({ firstClear: false, newStars: 2, coinsEarned: 20, newBest: false });
    expect(h.profile.coins()).toBe(START_COINS + 30 + 20);
    expect(h.profile.record(1)).toEqual({ stars: 3, best: 1000 });
  });

  it('a replay without improvement pays nothing and keeps the best result', () => {
    const h = harness();
    h.profile.recordWin(1, 3, 5000, 4);
    expect(h.profile.recordWin(1, 2, 3000, 2)).toEqual({ firstClear: false, newStars: 0, coinsEarned: 0, newBest: false });
    expect(h.profile.recordWin(1, 3, 5000, 2)).toEqual({ firstClear: false, newStars: 0, coinsEarned: 0, newBest: false });
    expect(h.profile.record(1)).toEqual({ stars: 3, best: 5000 });
    expect(h.profile.coins()).toBe(START_COINS + 50);
  });

  it('a better score with the same stars is a new best but pays nothing', () => {
    const h = harness();
    h.profile.recordWin(1, 2, 3000, 2);
    expect(h.profile.recordWin(1, 2, 3001, 2)).toEqual({ firstClear: false, newStars: 0, coinsEarned: 0, newBest: true });
    expect(h.profile.record(1)).toEqual({ stars: 2, best: 3001 });
  });

  it('stars are worth the same whichever way they are earned', () => {
    const slow = harness();
    slow.profile.recordWin(1, 1, 100, 1);
    slow.profile.recordWin(1, 2, 200, 1);
    slow.profile.recordWin(1, 3, 300, 1);
    const fast = harness();
    fast.profile.recordWin(1, 3, 300, 1);
    expect(slow.profile.coins()).toBe(fast.profile.coins());
    expect(slow.profile.coins()).toBe(START_COINS + 50);
  });

  it('levels unlock one after another', () => {
    const h = harness({ levelCount: 5 });
    for (let level = 1; level <= 4; level++) {
      expect(h.profile.highestUnlocked()).toBe(level);
      h.profile.recordWin(level, 2, 1000, 1);
      expect(h.profile.highestUnlocked()).toBe(level + 1);
    }
    expect(h.profile.totalStars()).toBe(8);
  });

  it('replaying an earlier level does not change what is unlocked', () => {
    const h = harness();
    h.profile.recordWin(1, 1, 100, 1);
    h.profile.recordWin(2, 1, 100, 1);
    h.profile.recordWin(1, 3, 500, 1);
    expect(h.profile.highestUnlocked()).toBe(3);
  });

  it('highestUnlocked never exceeds the number of levels', () => {
    const h = harness({ levelCount: 3 });
    h.profile.recordWin(1, 3, 1, 1);
    h.profile.recordWin(2, 3, 1, 1);
    expect(h.profile.highestUnlocked()).toBe(3);
    h.profile.recordWin(3, 3, 1, 1);
    expect(h.profile.highestUnlocked()).toBe(3);
    expect(h.profile.totalStars()).toBe(9);
  });

  it('winning the whole game: 120 levels, 360 stars', () => {
    const h = harness({ levelCount: 120 });
    for (let level = 1; level <= 120; level++) h.profile.recordWin(level, 3, 1000 + level, 2);
    expect(h.profile.highestUnlocked()).toBe(120);
    expect(h.profile.totalStars()).toBe(360);
    expect(h.profile.coins()).toBe(START_COINS + 120 * 50);
    const again = h.restart();
    expect(again.profile.totalStars()).toBe(360);
    expect(again.profile.record(120)).toEqual({ stars: 3, best: 1120 });
  });

  it('wins outside the level range are ignored completely', () => {
    const h = harness({ levelCount: 10 });
    for (const bad of [0, -1, 11, 1.5, NaN, Infinity, '1' as unknown as number]) {
      expect(h.profile.recordWin(bad, 3, 1000, 1)).toEqual({ firstClear: false, newStars: 0, coinsEarned: 0, newBest: false });
    }
    expect(h.profile.coins()).toBe(START_COINS);
    expect(h.profile.data().levels).toEqual({});
    expect(h.profile.data().stats.won).toBe(0);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });

  it('odd star and score values are brought into range', () => {
    const h = harness();
    expect(h.profile.recordWin(1, 7 as unknown as 3, -50, -3).coinsEarned).toBe(50); // 7★ → 3★
    expect(h.profile.record(1)).toEqual({ stars: 3, best: 0 });
    expect(h.profile.recordWin(2, 0 as unknown as 1, NaN, NaN).coinsEarned).toBe(30); // 0★ → 1★ (a win is a win)
    expect(h.profile.record(2)).toEqual({ stars: 1, best: 0 });
    expect(h.profile.recordWin(3, 2.9 as unknown as 2, 1234.9, 2.5).coinsEarned).toBe(40);
    expect(h.profile.record(3)).toEqual({ stars: 2, best: 1234 });
    expect(h.profile.data().stats).toEqual({ played: 0, won: 3, bestCascade: 2, totalScore: 1234 });
  });

  it('record() answers null for anything that is not a cleared level', () => {
    const h = harness();
    h.profile.recordWin(1, 2, 100, 1);
    for (const id of [2, 0, -1, 1.5, NaN, 999, 'constructor' as unknown as number, '1' as unknown as number]) {
      expect(h.profile.record(id)).toBeNull();
    }
  });

  it('record() hands out a copy', () => {
    const h = harness();
    h.profile.recordWin(1, 2, 100, 1);
    const rec = h.profile.record(1)!;
    rec.stars = 3;
    rec.best = 999_999;
    expect(h.profile.record(1)).toEqual({ stars: 2, best: 100 });
    expect(h.profile.totalStars()).toBe(2);
  });

  it('statistics: attempts, wins, total score and the best cascade', () => {
    const h = harness();
    h.profile.recordAttempt();
    h.profile.recordAttempt();
    h.profile.recordWin(1, 2, 1500, 4);
    h.profile.recordAttempt();
    h.profile.recordWin(2, 1, 700, 2);
    h.profile.recordWin(1, 3, 2000, 6);
    expect(h.profile.data().stats).toEqual({ played: 3, won: 3, bestCascade: 6, totalScore: 4200 });
    expect(h.saved().stats).toEqual({ played: 3, won: 3, bestCascade: 6, totalScore: 4200 });
  });

  it('recordAttempt saves and notifies', () => {
    const h = harness();
    h.profile.recordAttempt();
    expect(h.saved().stats.played).toBe(1);
    expect(h.notifications.count).toBe(1);
  });

  it('a nonsense level count is treated as a single level', () => {
    for (const count of [0, -5, NaN, undefined as unknown as number]) {
      const p = createProfile({ load: () => null, save: () => {}, now: () => T0, levelCount: count });
      expect(p.highestUnlocked()).toBe(1);
      p.recordWin(1, 3, 10, 1);
      expect(p.highestUnlocked()).toBe(1);
      expect(p.recordWin(2, 3, 10, 1).coinsEarned).toBe(0);
    }
  });

  it('records beyond the current level count are kept but do not count', () => {
    const save = sampleSave();
    save.levels = { '1': { stars: 2, best: 10 }, '2': { stars: 3, best: 20 }, '8': { stars: 3, best: 30 } };
    const h = fromSave(save, { levelCount: 5 });
    expect(h.profile.highestUnlocked()).toBe(3);
    expect(h.profile.totalStars()).toBe(5);
    h.profile.addCoins(1); // force a save
    expect(h.saved().levels['8']).toEqual({ stars: 3, best: 30 });
    // With more levels available the same save unlocks further.
    const bigger = fromSave(save, { levelCount: 50 });
    expect(bigger.profile.highestUnlocked()).toBe(9);
    expect(bigger.profile.totalStars()).toBe(8);
  });
});

describe('settings', () => {
  it('each setting can be changed, is saved and notifies', () => {
    const h = harness();
    h.profile.setSetting('sfx', false);
    h.profile.setSetting('music', false);
    h.profile.setSetting('haptics', false);
    h.profile.setSetting('lang', 'ar');
    expect(h.profile.settings()).toEqual({ sfx: false, music: false, haptics: false, lang: 'ar' });
    expect(h.saved().settings).toEqual({ sfx: false, music: false, haptics: false, lang: 'ar' });
    expect(h.notifications.count).toBe(4);
    h.profile.setSetting('lang', 'en');
    h.profile.setSetting('lang', null);
    expect(h.profile.settings().lang).toBeNull();
    expect(h.restart().profile.settings()).toEqual({ sfx: false, music: false, haptics: false, lang: null });
  });

  it('setting the current value again does nothing', () => {
    const h = harness();
    h.profile.setSetting('sfx', true);
    h.profile.setSetting('lang', null);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });

  it('invalid keys and values are ignored', () => {
    const h = harness();
    const set = h.profile.setSetting as unknown as (key: string, value: unknown) => void;
    set('sfx', 'yes');
    set('music', 1);
    set('haptics', null);
    set('lang', 'fr');
    set('lang', true);
    set('volume', 11);
    set('__proto__', { polluted: true });
    expect(h.profile.settings()).toEqual({ sfx: true, music: true, haptics: true, lang: null });
    expect(Object.keys(h.profile.settings()).sort()).toEqual(['haptics', 'lang', 'music', 'sfx']);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(h.storage.writes).toBe(0);
  });

  it('settings() always reflects the latest values', () => {
    const h = harness();
    const before: Readonly<Settings> = h.profile.settings();
    h.profile.setSetting('music', false);
    expect(h.profile.settings().music).toBe(false);
    expect(before.music).toBe(false); // the same live object
  });
});

describe('tips already seen', () => {
  it('markSeen remembers an id, once', () => {
    const h = harness();
    expect(h.profile.hasSeen('tut.swap')).toBe(false);
    h.profile.markSeen('tut.swap');
    expect(h.profile.hasSeen('tut.swap')).toBe(true);
    expect(h.saved().seen).toEqual(['tut.swap']);
    expect(h.notifications.count).toBe(1);
    h.profile.markSeen('tut.swap');
    expect(h.saved().seen).toEqual(['tut.swap']);
    expect(h.notifications.count).toBe(1);
    expect(h.storage.writes).toBe(1);
    h.profile.markSeen('tut.beam');
    expect(h.restart().profile.hasSeen('tut.beam')).toBe(true);
    expect(h.restart().profile.hasSeen('tut.nova')).toBe(false);
  });

  it('ignores ids that are not usable strings', () => {
    const h = harness();
    for (const bad of ['', 'x'.repeat(5000), 5, null, undefined, {}]) h.profile.markSeen(bad as unknown as string);
    expect(h.profile.data().seen).toEqual([]);
    expect(h.storage.writes).toBe(0);
    expect(h.profile.hasSeen(undefined as unknown as string)).toBe(false);
  });
});

describe('subscribers', () => {
  it('are called after the change has been saved', () => {
    const h = harness();
    const seenInStorage: number[] = [];
    h.profile.subscribe(() => {
      seenInStorage.push(h.saved().coins);
    });
    h.profile.addCoins(5);
    h.profile.spendCoins(55);
    expect(seenInStorage).toEqual([155, 100]);
  });

  it('every mutating method notifies exactly once', () => {
    const h = harness();
    const p = h.profile;
    const steps: [string, () => unknown][] = [
      ['addCoins', () => p.addCoins(500)],
      ['spendCoins', () => p.spendCoins(1)],
      ['addBooster', () => p.addBooster('hammer', 1)],
      ['takeBooster', () => p.takeBooster('hammer')],
      ['buyBooster', () => p.buyBooster('shuffle')],
      ['grant', () => p.grant([{ kind: 'coins', amount: 1 }, { kind: 'booster', id: 'prism', amount: 1 }])],
      ['loseLife', () => p.loseLife()],
      ['refillLives', () => p.refillLives()],
      ['recordAttempt', () => p.recordAttempt()],
      ['recordWin', () => p.recordWin(1, 2, 100, 1)],
      ['claimDaily', () => p.claimDaily()],
      ['setSetting', () => p.setSetting('music', false)],
      ['markSeen', () => p.markSeen('tip')],
      ['reset', () => p.reset()],
    ];
    for (const [name, run] of steps) {
      const notes = h.notifications.count;
      const writes = h.storage.writes;
      run();
      expect(h.notifications.count, name).toBe(notes + 1);
      expect(h.storage.writes, name).toBe(writes + 1);
    }
  });

  it('getters never notify', () => {
    const h = harness();
    const p = h.profile;
    p.loseLife();
    const notes = h.notifications.count;
    h.clock.now += 3 * DAY;
    p.data();
    p.lives();
    p.coins();
    p.boosterCount('hammer');
    p.boosterPrice('hammer');
    p.highestUnlocked();
    p.record(1);
    p.totalStars();
    p.daily();
    p.settings();
    p.hasSeen('x');
    expect(h.notifications.count).toBe(notes);
  });

  it('unsubscribe stops the notifications for that listener only', () => {
    const h = harness();
    let a = 0;
    let b = 0;
    const offA = h.profile.subscribe(() => a++);
    h.profile.subscribe(() => b++);
    h.profile.addCoins(1);
    offA();
    offA(); // twice is fine
    h.profile.addCoins(1);
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('the same function subscribed twice is called twice and removed one at a time', () => {
    const h = harness();
    let calls = 0;
    const fn = (): void => {
      calls++;
    };
    const off1 = h.profile.subscribe(fn);
    h.profile.subscribe(fn);
    h.profile.addCoins(1);
    expect(calls).toBe(2);
    off1();
    h.profile.addCoins(1);
    expect(calls).toBe(3);
  });

  it('a listener may unsubscribe another one during a notification', () => {
    const h = harness();
    const calls: string[] = [];
    let offSecond: () => void = () => {};
    h.profile.subscribe(() => {
      calls.push('first');
      offSecond();
    });
    offSecond = h.profile.subscribe(() => calls.push('second'));
    h.profile.addCoins(1);
    h.profile.addCoins(1);
    expect(calls).toEqual(['first', 'first']);
  });

  it('a listener may change the profile again', () => {
    const h = harness();
    let rounds = 0;
    h.profile.subscribe(() => {
      rounds++;
      if (h.profile.coins() < START_COINS + 3) h.profile.addCoins(1);
    });
    h.profile.addCoins(1);
    expect(h.profile.coins()).toBe(START_COINS + 3);
    expect(rounds).toBe(3);
    expect(h.saved().coins).toBe(START_COINS + 3);
  });

  it('a throwing listener neither breaks the change nor the other listeners', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = harness();
    let reached = 0;
    h.profile.subscribe(() => {
      throw new Error('boom');
    });
    h.profile.subscribe(() => reached++);
    expect(() => h.profile.addCoins(10)).not.toThrow();
    expect(h.profile.coins()).toBe(START_COINS + 10);
    expect(h.saved().coins).toBe(START_COINS + 10);
    expect(reached).toBe(1);
    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe('reset', () => {
  it('wipes progress, coins, boosters, lives, daily streak, tips and statistics', () => {
    const h = harness();
    const p = h.profile;
    p.addCoins(5000);
    p.buyBooster('prism');
    p.takeBooster('hammer');
    p.recordAttempt();
    p.recordWin(1, 3, 4000, 5);
    p.recordWin(2, 2, 3000, 2);
    p.loseLife();
    p.loseLife();
    p.claimDaily();
    p.markSeen('tut.swap');
    h.clock.now += 5 * MINUTE;

    p.reset();

    expect(p.data()).toEqual({
      version: 1,
      levels: {},
      coins: 150,
      lives: 5,
      lifeTimer: 0,
      boosters: { hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 1, beamNova: 1 },
      settings: { sfx: true, music: true, haptics: true, lang: null },
      dailyDay: -1,
      dailyStreak: 0,
      seen: [],
      stats: { played: 0, won: 0, bestCascade: 0, totalScore: 0 },
    });
    expect(p.highestUnlocked()).toBe(1);
    expect(p.totalStars()).toBe(0);
    expect(p.record(1)).toBeNull();
    expect(p.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(p.hasSeen('tut.swap')).toBe(false);
    expect(p.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
    expect(h.saved()).toEqual(p.data());
    expect(h.restart().profile.data()).toEqual(p.data());
  });

  it('keeps the language setting', () => {
    for (const lang of ['ar', 'en', null] as const) {
      const h = harness();
      h.profile.setSetting('lang', lang);
      h.profile.addCoins(99);
      h.profile.reset();
      expect(h.profile.settings().lang).toBe(lang);
      expect(h.saved().settings.lang).toBe(lang);
      expect(h.profile.coins()).toBe(START_COINS);
    }
  });

  it('keeps the sound, music and vibration preferences as well', () => {
    const h = harness();
    h.profile.setSetting('sfx', false);
    h.profile.setSetting('music', false);
    h.profile.setSetting('haptics', false);
    h.profile.setSetting('lang', 'ar');
    h.profile.reset();
    expect(h.profile.settings()).toEqual({ sfx: false, music: false, haptics: false, lang: 'ar' });
  });

  it('objects handed out earlier stay live across a reset', () => {
    const h = harness();
    const data = h.profile.data();
    const settings = h.profile.settings();
    h.profile.addCoins(500);
    h.profile.setSetting('music', false);
    h.profile.reset();
    expect(h.profile.data()).toBe(data);
    expect(h.profile.settings()).toBe(settings);
    expect(data.coins).toBe(START_COINS);
    expect(settings.music).toBe(false);
    h.profile.addCoins(1);
    h.profile.setSetting('sfx', false);
    expect(data.coins).toBe(START_COINS + 1);
    expect(settings.sfx).toBe(false);
  });

  it('saves once and notifies once', () => {
    const h = harness();
    h.profile.addCoins(1);
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    h.profile.reset();
    expect(h.storage.writes).toBe(writes + 1);
    expect(h.notifications.count).toBe(notes + 1);
  });

  it('subscribers stay subscribed and the profile keeps working afterwards', () => {
    const h = harness();
    h.profile.reset();
    h.profile.addCoins(10);
    h.profile.recordWin(1, 1, 50, 1);
    expect(h.notifications.count).toBe(3);
    expect(h.profile.coins()).toBe(START_COINS + 10 + 30);
    expect(h.saved().levels['1']).toEqual({ stars: 1, best: 50 });
  });

  it('a fresh profile after reset does not share objects with the constants', () => {
    const h = harness();
    h.profile.reset();
    h.profile.addBooster('hammer', 5);
    h.profile.reset();
    expect(h.profile.boosterCount('hammer')).toBe(3);
    expect(START_BOOSTERS.hammer).toBe(3);
  });
});
