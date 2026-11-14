/**
 * The profile extensions of the strategy study (src/state/extensions.ts, DESIGN §5): booster
 * unlocks and their gifts, feature gating, the first-play day, the Caravan, single lives, the
 * continue ladder and double pay on hard levels. Numbers are written out from the design.
 */
import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/state/index.ts';
import type { BoosterId } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, T0, fromSave, harness, progressSave, sampleSave } from './harness.ts';
import type { Harness } from './harness.ts';

const TODAY = Math.floor(T0 / DAY);

/** Win levels `from`..`to` for the first time, one star each. */
function win(h: Harness, from: number, to: number = from): void {
  for (let id = from; id <= to; id++) h.profile.recordWin(id, 1, 100, 0);
}

describe('booster unlocks', () => {
  const UNLOCK: [BoosterId, number, number][] = [
    ['beamNova', 7, 2],
    ['hammer', 8, 3],
    ['freeSwap', 12, 3],
    ['prism', 14, 2],
    ['shuffle', 16, 3],
    ['extraMoves', 19, 2],
  ];

  it('each booster unlocks exactly when its level is reached (the level before it is won)', () => {
    for (const [id, level] of UNLOCK) {
      const before = harness({ cleared: level - 2 }); // highest unlocked = level − 1
      expect(before.profile.highestUnlocked()).toBe(level - 1);
      expect(before.profile.boosterUnlocked(id), id).toBe(false);
      win(before, level - 1);
      expect(before.profile.boosterUnlocked(id), id).toBe(true);
    }
    const fresh = harness();
    for (const [id] of UNLOCK) expect(fresh.profile.boosterUnlocked(id)).toBe(false);
    expect(fresh.profile.boosterUnlocked('wand' as BoosterId)).toBe(false);
    expect(fresh.profile.boosterUnlocked(undefined as unknown as BoosterId)).toBe(false);
  });

  it('claimUnlocks gives each introduction gift exactly once, with one save and one notification', () => {
    const h = harness();
    expect(h.profile.claimUnlocks()).toEqual([]);
    win(h, 1, 5);
    expect(h.profile.claimUnlocks()).toEqual([]);
    win(h, 6); // reaches level 7
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    expect(h.profile.claimUnlocks()).toEqual([{ id: 'beamNova', amount: 2 }]);
    expect(h.storage.writes - writes).toBe(1);
    expect(h.notifications.count - notes).toBe(1);
    expect(h.profile.boosterCount('beamNova')).toBe(2);
    expect(h.saved().gifted).toEqual(['beamNova']);
    expect(h.profile.claimUnlocks()).toEqual([]);
    expect(h.storage.writes - writes).toBe(1);
    // …also after a restart, and after the gift has been used up
    h.profile.takeBooster('beamNova');
    h.profile.takeBooster('beamNova');
    const again = h.restart();
    expect(again.profile.claimUnlocks()).toEqual([]);
    expect(again.profile.boosterCount('beamNova')).toBe(0);
    win(again, 7); // reaches level 8
    expect(again.profile.claimUnlocks()).toEqual([{ id: 'hammer', amount: 3 }]);
    expect(again.profile.boosterCount('hammer')).toBe(3);
  });

  it('a player who walks through all levels gets every gift once: 2, 3, 3, 2, 3, 2', () => {
    const h = harness();
    const got: { id: BoosterId; amount: number }[] = [];
    for (let level = 1; level <= 40; level++) {
      win(h, level);
      got.push(...h.profile.claimUnlocks());
    }
    expect(got).toEqual(UNLOCK.map(([id, , amount]) => ({ id, amount })));
    expect(h.profile.data().boosters).toEqual({ beamNova: 2, hammer: 3, freeSwap: 3, prism: 2, shuffle: 3, extraMoves: 2 });
  });

  it('several unlocks reached at once are all given, in unlock order', () => {
    const h = harness({ cleared: 13 }); // reached level 14
    expect(h.profile.claimUnlocks()).toEqual([
      { id: 'beamNova', amount: 2 },
      { id: 'hammer', amount: 3 },
      { id: 'freeSwap', amount: 3 },
      { id: 'prism', amount: 2 },
    ]);
    expect(h.storage.writes).toBe(1);
    expect(h.profile.claimUnlocks()).toEqual([]);
  });

  it('after a reset the gifts are given again as the levels are reached again', () => {
    const h = harness({ cleared: 7 });
    expect(h.profile.claimUnlocks()).toHaveLength(2);
    h.profile.reset();
    expect(h.profile.data().gifted).toEqual([]);
    expect(h.profile.claimUnlocks()).toEqual([]);
    win(h, 1, 6);
    expect(h.profile.claimUnlocks()).toEqual([{ id: 'beamNova', amount: 2 }]);
  });

  it('a damaged list of given gifts is repaired: known ids, once each', () => {
    const save = { ...progressSave(18), gifted: ['hammer', 'hammer', 'wand', 5, null, 'prism', ['shuffle']] };
    const h = fromSave(save);
    expect(h.profile.data().gifted).toEqual(['hammer', 'prism']);
    expect(h.profile.claimUnlocks().map((g) => g.id)).toEqual(['beamNova', 'freeSwap', 'shuffle', 'extraMoves']);
    for (const bad of [undefined, null, 'hammer', { 0: 'hammer', length: 1 }, 7]) {
      expect(fromSave({ ...progressSave(1), gifted: bad }).profile.data().gifted).toEqual([]);
    }
  });
});

describe('feature gating', () => {
  it('lives L6, shop L10, rewarded ads L11, Caravan L20', () => {
    for (const [feature, level] of [['lives', 6], ['shop', 10], ['rewardedAds', 11], ['caravan', 20]] as const) {
      expect(harness({ cleared: level - 2 }).profile.featureUnlocked(feature), feature).toBe(false);
      expect(harness({ cleared: level - 1 }).profile.featureUnlocked(feature), feature).toBe(true);
      expect(harness({ cleared: 119 }).profile.featureUnlocked(feature), feature).toBe(true);
    }
    const fresh = harness().profile;
    for (const unknown of ['interstitials', '', 'toString', '__proto__', undefined, null, 5]) {
      expect(fresh.featureUnlocked(unknown as 'shop')).toBe(false);
    }
  });

  it('a game with fewer levels than a gate never opens it', () => {
    const h = harness({ levelCount: 8 });
    win(h, 1, 8);
    expect(h.profile.featureUnlocked('lives')).toBe(true);
    expect(h.profile.featureUnlocked('shop')).toBe(false);
    expect(h.profile.boosterUnlocked('hammer')).toBe(true);
    expect(h.profile.boosterUnlocked('freeSwap')).toBe(false);
  });

  it('the daily reward opens on the second local calendar day, never on the first', () => {
    const h = harness({ now: T0 }); // 12:00
    expect(h.profile.featureUnlocked('daily')).toBe(false);
    expect(h.profile.daysSinceFirstPlay()).toBe(0);
    h.profile.recordAttempt(); // the first save stamps the day
    expect(h.saved().firstDay).toBe(TODAY);
    h.clock.now = T0 + 12 * HOUR - 1; // 23:59:59.999 of the first day
    expect(h.profile.featureUnlocked('daily')).toBe(false);
    h.clock.now += 1; // midnight
    expect(h.profile.featureUnlocked('daily')).toBe(true);
    expect(h.profile.daysSinceFirstPlay()).toBe(1);
    h.clock.now += 9 * DAY;
    expect(h.restart().profile.featureUnlocked('daily')).toBe(true);
    expect(h.restart().profile.daysSinceFirstPlay()).toBe(10);
  });

  it('the first-play day is stamped once, kept across restarts and reset, and follows the local calendar', () => {
    const h = harness({ now: Date.UTC(2026, 2, 10, 21, 30), utcOffsetMinutes: 180 }); // already the 11th at UTC+3
    expect(h.profile.data().firstDay).toBe(-1);
    expect(h.storage.writes).toBe(0); // looking never stamps
    h.profile.addCoins(1);
    const first = h.saved().firstDay;
    expect(first).toBe(Math.floor(Date.UTC(2026, 2, 11) / DAY));
    h.clock.now += 5 * DAY;
    h.profile.addCoins(1);
    const again = h.restart();
    again.profile.reset();
    expect(again.saved().firstDay).toBe(first);
    expect(again.profile.daysSinceFirstPlay()).toBe(5);
    expect(again.profile.featureUnlocked('daily')).toBe(true);
  });

  it('a clock moved back hides nothing for good, and a first day in the future is pulled back', () => {
    const h = harness();
    h.profile.addCoins(1);
    h.clock.now += 2 * DAY;
    expect(h.profile.featureUnlocked('daily')).toBe(true);
    h.clock.now -= 5 * DAY; // before the first day
    expect(h.profile.featureUnlocked('daily')).toBe(false);
    expect(h.profile.daysSinceFirstPlay()).toBe(0);
    h.clock.now += 5 * DAY;
    expect(h.profile.featureUnlocked('daily')).toBe(true);
    // the device clock was wrong (years ahead) on the first day: the next start corrects the day
    const wrong = fromSave({ ...sampleSave(), firstDay: TODAY + 2000 });
    expect(wrong.profile.data().firstDay).toBe(TODAY);
    expect(wrong.storage.writes).toBe(0);
    wrong.profile.addCoins(1);
    expect(wrong.saved().firstDay).toBe(TODAY);
    wrong.clock.now += DAY;
    expect(wrong.profile.featureUnlocked('daily')).toBe(true);
  });

  it('without a working clock or calendar the daily reward stays closed', () => {
    let now = NaN;
    let calendar = true;
    const profile = createProfile({
      load: () => JSON.stringify({ ...sampleSave(), firstDay: 3 }),
      save: () => {},
      now: () => now,
      levelCount: 120,
      dayNumber: (ms) => {
        if (!calendar) throw new Error('no calendar');
        return Math.floor(ms / DAY);
      },
    });
    expect(profile.featureUnlocked('daily')).toBe(false);
    expect(profile.daysSinceFirstPlay()).toBe(0);
    now = T0;
    expect(profile.featureUnlocked('daily')).toBe(true);
    calendar = false;
    expect(profile.featureUnlocked('daily')).toBe(false);
    expect(profile.daysSinceFirstPlay()).toBe(0);
  });

  it('repair: the first-play day is a whole day number or "none"', () => {
    const day = (stored: unknown): number => fromSave({ ...sampleSave(), firstDay: stored }).profile.data().firstDay;
    expect(day(19_990)).toBe(19_990);
    expect(day(19_990.8)).toBe(19_990);
    for (const bad of [-1, -50, 'today', null, undefined, [3]]) expect(day(bad)).toBe(-1);
    expect(day(1e300)).toBe(TODAY); // capped, then pulled back to today
  });
});

describe('the Caravan', () => {
  it('counts first-time wins from level 20 on; the win that unlocks it is not part of it', () => {
    const h = harness({ cleared: 17 });
    win(h, 18);
    expect(h.profile.caravan()).toBe(0);
    win(h, 19); // reaches level 20: the Caravan unlocks, empty
    expect(h.profile.featureUnlocked('caravan')).toBe(true);
    expect(h.profile.caravan()).toBe(0);
    expect(h.profile.caravanBoosters()).toEqual({});
    win(h, 20);
    expect(h.profile.caravan()).toBe(1);
    expect(h.profile.caravanBoosters()).toEqual({ beamNova: true });
    win(h, 21);
    expect(h.profile.caravanBoosters()).toEqual({ beamNova: true, prism: true });
    win(h, 22);
    expect(h.profile.caravan()).toBe(3);
    expect(h.profile.caravanBoosters()).toEqual({ beamNova: true, prism: true, extraMoves: true });
    win(h, 23, 30);
    expect(h.profile.caravan()).toBe(11);
    expect(h.profile.caravanBoosters()).toEqual({ beamNova: true, prism: true, extraMoves: true });
    expect(h.restart().profile.caravan()).toBe(11);
    expect(h.saved().caravan).toBe(11);
  });

  it('replaying cleared levels neither adds to it nor resets it', () => {
    const h = harness({ cleared: 19 });
    win(h, 20, 21);
    for (let i = 0; i < 5; i++) h.profile.recordWin(1, 3, 9000, 2); // more stars on an old level
    h.profile.recordWin(20, 3, 9000, 2);
    expect(h.profile.caravan()).toBe(2);
    h.profile.recordWin(999, 3, 1, 1); // not a level
    expect(h.profile.caravan()).toBe(2);
  });

  it('every lost life sends it home — also when there was no life left to take', () => {
    const h = harness({ cleared: 19 });
    win(h, 20, 22);
    const writes = h.storage.writes;
    expect(h.profile.loseLife()).toBe(true);
    expect(h.storage.writes - writes).toBe(1); // the life and the Caravan in one save
    expect(h.profile.caravan()).toBe(0);
    expect(h.saved().caravan).toBe(0);
    expect(h.profile.caravanBoosters()).toEqual({});
    win(h, 23);
    expect(h.profile.caravan()).toBe(1);
    for (let i = 0; i < 4; i++) h.profile.loseLife();
    win(h, 24, 25);
    expect(h.profile.lives().count).toBe(0);
    const notes = h.notifications.count;
    expect(h.profile.loseLife()).toBe(false);
    expect(h.profile.caravan()).toBe(0);
    expect(h.notifications.count - notes).toBe(1);
    // nothing left to reset: a refused call is silent again
    expect(h.profile.loseLife()).toBe(false);
    expect(h.notifications.count - notes).toBe(1);
  });

  it('is always 0 before it unlocks, whatever a save claims, and is repaired like any counter', () => {
    const early = fromSave({ ...progressSave(5), caravan: 7 });
    expect(early.profile.caravan()).toBe(0);
    expect(early.profile.caravanBoosters()).toEqual({});
    const value = (stored: unknown): number => fromSave({ ...progressSave(25), caravan: stored }).profile.caravan();
    expect(value(2)).toBe(2);
    expect(value(2.9)).toBe(2);
    expect(value(1e300)).toBe(1_000_000);
    for (const bad of [-3, '3', null, undefined, [3]]) expect(value(bad)).toBe(0);
  });
});

describe('single lives and the continue ladder', () => {
  it('addLife gives one life, keeps the running countdown, and is refused when full', () => {
    const h = harness();
    expect(h.profile.addLife()).toBe(false);
    expect(h.storage.writes).toBe(0);
    h.profile.loseLife();
    h.profile.loseLife();
    h.clock.now += 10 * MINUTE;
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    expect(h.profile.addLife()).toBe(true);
    expect(h.storage.writes - writes).toBe(1);
    expect(h.notifications.count - notes).toBe(1);
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 20 * MINUTE });
    expect(h.profile.addLife()).toBe(true);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.saved().lifeTimer).toBe(0);
    expect(h.profile.addLife()).toBe(false);
    expect(h.restart().profile.lives().count).toBe(5);
  });

  it('addLife counts a life that regenerated in the meantime', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now += 30 * MINUTE;
    expect(h.profile.addLife()).toBe(false); // already full again
    expect(h.profile.lives().count).toBe(5);
  });

  it('continuePrice: 900, 1,900, 2,900 — then no more', () => {
    const p = harness().profile;
    expect([0, 1, 2].map((n) => p.continuePrice(n))).toEqual([900, 1900, 2900]);
    for (const n of [3, 4, 100, -1, NaN, Infinity, '0' as unknown as number, undefined as unknown as number]) {
      expect(p.continuePrice(n), String(n)).toBeNull();
    }
  });
});

describe('hard levels pay double on the first clear', () => {
  const hard = (levelId: number): boolean => levelId % 5 === 0;

  it('60 / 80 / 100 for one, two, three stars; replays pay the ordinary 10 per new star', () => {
    const h = harness({ isHardLevel: hard });
    expect(h.profile.recordWin(4, 3, 100, 0).coinsEarned).toBe(50);
    expect(h.profile.recordWin(5, 1, 100, 0)).toEqual({ firstClear: true, newStars: 1, coinsEarned: 60, newBest: true });
    expect(h.profile.recordWin(5, 3, 200, 0)).toEqual({ firstClear: false, newStars: 2, coinsEarned: 20, newBest: true });
    expect(h.profile.recordWin(10, 2, 100, 0).coinsEarned).toBe(80);
    expect(h.profile.recordWin(15, 3, 100, 0).coinsEarned).toBe(100);
    expect(h.profile.coins()).toBe(2000 + 50 + 60 + 20 + 80 + 100);
    expect(h.saved().coins).toBe(h.profile.coins());
  });

  it('without the hook, or with one that fails or answers nonsense, levels pay the ordinary amount', () => {
    expect(harness().profile.recordWin(5, 3, 100, 0).coinsEarned).toBe(50);
    const throwing = harness({
      isHardLevel: () => {
        throw new Error('no level data');
      },
    });
    expect(throwing.profile.recordWin(5, 3, 100, 0).coinsEarned).toBe(50);
    const vague = harness({ isHardLevel: (() => 'yes') as unknown as (id: number) => boolean });
    expect(vague.profile.recordWin(5, 3, 100, 0).coinsEarned).toBe(50);
  });
});
