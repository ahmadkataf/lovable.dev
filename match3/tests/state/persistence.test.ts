import { describe, expect, it } from 'vitest';
import { createProfile, freshSave, parseSave, repairSave } from '../../src/state/index.ts';
import { MAX_BOOSTER_COUNT, MAX_COINS, START_BOOSTERS, START_COINS } from '../../src/state/econ.ts';
import { ALL_BOOSTERS } from '../../src/state/types.ts';
import type { SaveData } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, T0, fromSave, harness, sampleSave } from './harness.ts';

const FRESH = freshSave();

/** A sample save with one field replaced (or removed, with `undefined`). */
function withField(field: keyof SaveData, value: unknown): Record<string, unknown> {
  const save = sampleSave() as unknown as Record<string, unknown>;
  if (value === undefined) delete save[field];
  else save[field] = value;
  return save;
}

describe('persistence: round trip', () => {
  it('everything survives a restart', () => {
    const h = harness();
    const p = h.profile;
    p.addCoins(1234);
    p.buyBooster('prism');
    p.addBooster('shuffle', 3);
    p.takeBooster('shuffle');
    p.addBooster('beamNova', 4);
    p.recordAttempt();
    p.recordWin(1, 3, 5200, 4);
    p.recordAttempt();
    p.recordWin(2, 1, 900, 1);
    p.loseLife();
    p.claimDaily();
    p.setSetting('music', false);
    p.setSetting('lang', 'ar');
    p.markSeen('tut.swap');
    p.markSeen('tut.beam');
    h.clock.now += 3 * MINUTE;

    const before = JSON.parse(JSON.stringify(p.data())) as SaveData;
    const again = h.restart();
    expect(again.profile.data()).toEqual(before);
    // + 1234 added − 800 for the prism + 50 and 30 for the two wins + 100 for the daily reward
    expect(again.profile.coins()).toBe(START_COINS + 1234 - 800 + 50 + 30 + 100);
    expect(again.profile.boosterCount('prism')).toBe(START_BOOSTERS.prism + 1);
    expect(again.profile.boosterCount('shuffle')).toBe(START_BOOSTERS.shuffle + 2);
    expect(again.profile.boosterCount('beamNova')).toBe(START_BOOSTERS.beamNova + 4);
    expect(again.profile.record(1)).toEqual({ stars: 3, best: 5200 });
    expect(again.profile.record(2)).toEqual({ stars: 1, best: 900 });
    expect(again.profile.highestUnlocked()).toBe(3);
    expect(again.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 27 * MINUTE });
    expect(again.profile.daily()).toMatchObject({ canClaim: false, streak: 1 });
    expect(again.profile.settings()).toEqual({ sfx: true, music: false, haptics: true, lang: 'ar' });
    expect(again.profile.hasSeen('tut.beam')).toBe(true);
    expect(again.profile.data().stats).toEqual({ played: 2, won: 2, bestCascade: 4, totalScore: 6100 });
  });

  it('restarting many times changes nothing', () => {
    const h = fromSave(sampleSave());
    const first = JSON.stringify(h.profile.data());
    let current = h;
    for (let i = 0; i < 5; i++) {
      current = current.restart();
      current.profile.markSeen('probe-' + i); // forces a save in the profile's own format
    }
    const last = current.restart().profile.data();
    expect({ ...last, seen: sampleSave().seen }).toEqual(JSON.parse(first));
  });

  it('what is saved is plain JSON with version 1 and exactly the documented fields', () => {
    const h = harness();
    h.profile.addCoins(1);
    const saved = h.saved();
    expect(saved.version).toBe(1);
    expect(Object.keys(saved).sort()).toEqual(
      ['boosters', 'caravan', 'coins', 'dailyDay', 'dailyStreak', 'firstDay', 'gifted', 'levels', 'lifeTimer', 'lives', 'seen', 'settings', 'shop', 'stats', 'version'].sort(),
    );
    expect(Object.keys(saved.shop).sort()).toEqual(
      ['adDay', 'finished', 'interstitials', 'lastInterstitial', 'lastRewarded', 'owned', 'purchased', 'rewarded', 'tokens'].sort(),
    );
    expect(typeof h.storage.json).toBe('string');
    expect(h.storage.json!.length).toBeLessThan(700); // "saves are tiny"
  });

  it('a valid save is loaded exactly as it is', () => {
    const save = sampleSave();
    expect(parseSave(JSON.stringify(save))).toEqual(save);
    expect(repairSave(save)).toEqual(save);
    expect(repairSave(save)).not.toBe(save);
  });

  it('a save with a running life timer is loaded as it is', () => {
    const save = sampleSave();
    save.lives = 2;
    save.lifeTimer = T0 - 5 * MINUTE;
    const h = fromSave(save);
    expect(h.profile.data()).toEqual(save);
    expect(h.storage.writes).toBe(0);
  });

  it('loading does not write; the first change does', () => {
    const h = fromSave(sampleSave());
    const original = h.storage.json;
    h.profile.data();
    h.profile.lives();
    expect(h.storage.writes).toBe(0);
    expect(h.storage.json).toBe(original);
    h.profile.addCoins(1);
    expect(h.storage.writes).toBe(1);
    expect(h.saved().coins).toBe(778);
  });
});

describe('persistence: unreadable input gives a fresh profile', () => {
  const garbage: [string, string | null][] = [
    ['nothing saved', null],
    ['empty string', ''],
    ['whitespace', '   '],
    ['not JSON', 'hello world'],
    ['truncated JSON', '{"version":1,"coins":5'],
    ['JSON null', 'null'],
    ['a number', '12345'],
    ['a string', '"coins"'],
    ['a boolean', 'true'],
    ['an empty array', '[]'],
    ['an array', '[{"coins":999999}]'],
    ['binary noise', '\u0000\u0001\u0002￿'],
    ['a foreign object', '{"user":"someone","theme":"dark","items":[1,2,3]}'],
    ['an empty object', '{}'],
  ];

  for (const [name, json] of garbage) {
    it(name, () => {
      const h = harness({ json });
      expect(h.profile.data()).toEqual(FRESH);
      expect(h.storage.writes).toBe(0);
      // …and it is fully usable.
      h.profile.addCoins(1);
      expect(h.saved().coins).toBe(START_COINS + 1);
    });
  }

  it('parseSave never throws, whatever it is given', () => {
    const inputs: unknown[] = [undefined, null, 0, {}, [], '{"levels":null,"boosters":null,"settings":null,"stats":null,"seen":null}'];
    for (const input of inputs) {
      expect(() => parseSave(input as string)).not.toThrow();
      expect(parseSave(input as string)).toEqual(FRESH);
    }
  });

  it('repairSave copes with hostile shapes', () => {
    const hostile = {
      version: 'x',
      levels: { toString: 1, valueOf: { stars: 3, best: 1 }, '1': 'three', '2': null, '3': [3, 100] },
      coins: {},
      lives: [],
      lifeTimer: 'yesterday',
      boosters: 'many',
      settings: 7,
      dailyDay: true,
      dailyStreak: {},
      seen: { length: 3 },
      stats: [1, 2, 3],
    };
    expect(repairSave(hostile)).toEqual(FRESH);
  });

  it('a load() that throws gives a fresh profile', () => {
    const p = createProfile({
      load: () => {
        throw new Error('storage unavailable');
      },
      save: () => {},
      now: () => T0,
      levelCount: 10,
    });
    expect(p.data()).toEqual(FRESH);
  });

  it('a load() that returns something other than a string gives a fresh profile', () => {
    for (const value of [undefined, 42, {}, []]) {
      const p = createProfile({ load: () => value as unknown as string, save: () => {}, now: () => T0, levelCount: 10 });
      expect(p.data()).toEqual(FRESH);
    }
  });

  it('a save() that throws does not break the game: the change still applies and is announced', () => {
    let notified = 0;
    let attempts = 0;
    const p = createProfile({
      load: () => null,
      save: () => {
        attempts++;
        throw new Error('quota exceeded');
      },
      now: () => T0,
      levelCount: 10,
    });
    p.subscribe(() => notified++);
    expect(() => p.addCoins(10)).not.toThrow();
    expect(() => p.loseLife()).not.toThrow();
    expect(() => p.reset()).not.toThrow();
    expect(() => p.recordWin(1, 3, 100, 1)).not.toThrow();
    expect(p.coins()).toBe(START_COINS + 50);
    expect(notified).toBe(4);
    expect(attempts).toBe(4);
  });
});

describe('persistence: field-by-field repair', () => {
  it('coins', () => {
    const cases: [unknown, number][] = [
      [-500, 0],
      [-0.5, 0],
      [0, 0],
      [12.9, 12],
      [1e15, MAX_COINS],
      ['900', START_COINS],
      [null, START_COINS],
      [undefined, START_COINS],
      [[5], START_COINS],
      [true, START_COINS],
    ];
    for (const [stored, expected] of cases) {
      expect(fromSave(withField('coins', stored)).profile.coins(), String(stored)).toBe(expected);
    }
    // 1e999 is valid JSON text that parses to Infinity.
    const json = JSON.stringify(sampleSave()).replace('"coins":777', '"coins":1e999');
    expect(harness({ json }).profile.coins()).toBe(MAX_COINS);
    const negative = JSON.stringify(sampleSave()).replace('"coins":777', '"coins":-1e999');
    expect(harness({ json: negative }).profile.coins()).toBe(0);
  });

  it('the rest of a save survives one bad field', () => {
    const h = fromSave(withField('coins', 'lots'));
    const expected = sampleSave();
    expected.coins = START_COINS;
    expect(h.profile.data()).toEqual(expected);
  });

  it('lives', () => {
    const cases: [unknown, number][] = [
      [-3, 0],
      [0, 0],
      [3.7, 3],
      [5, 5],
      [6, 5],
      [1e9, 5],
      ['4', 5],
      [null, 5],
      [undefined, 5],
    ];
    for (const [stored, expected] of cases) {
      const save = withField('lives', stored);
      save.lifeTimer = T0; // a timer that started just now, so no life regenerates
      expect(fromSave(save).profile.lives().count, String(stored)).toBe(expected);
    }
  });

  it('lifeTimer', () => {
    const run = (timer: unknown, lives = 2): SaveData => {
      const save = withField('lifeTimer', timer);
      save.lives = lives;
      return JSON.parse(JSON.stringify(fromSave(save).profile.data())) as SaveData;
    };
    expect(run(T0 - 5 * MINUTE).lifeTimer).toBe(T0 - 5 * MINUTE); // valid: untouched
    expect(run(-100).lifeTimer).toBe(T0); // negative: restart now
    expect(run('soon').lifeTimer).toBe(T0);
    expect(run(null).lifeTimer).toBe(T0);
    expect(run(undefined).lifeTimer).toBe(T0);
    expect(run(T0 + HOUR).lifeTimer).toBe(T0); // in the future: restart now
    expect(run(1e300).lifeTimer).toBe(T0);
    expect(run(T0 - 0.5).lifeTimer).toBe(T0 - 1); // fractions are floored
    expect(run(T0 - HOUR, 5).lifeTimer).toBe(0); // full lives: no timer
    expect(run('soon', 5).lifeTimer).toBe(0);
    // a valid old timer regenerates lives as usual
    const old = run(T0 - 65 * MINUTE, 1);
    expect(old.lives).toBe(3);
    expect(old.lifeTimer).toBe(T0 - 5 * MINUTE);
  });

  it('boosters: negatives clamp to 0, absurd values are capped, fractions floored', () => {
    const h = fromSave(
      withField('boosters', { hammer: -4, freeSwap: 1e9, shuffle: 2.8, extraMoves: 0, prism: 7, beamNova: -0.1 }),
    );
    expect(h.profile.data().boosters).toEqual({
      hammer: 0,
      freeSwap: MAX_BOOSTER_COUNT,
      shuffle: 2,
      extraMoves: 0,
      prism: 7,
      beamNova: 0,
    });
  });

  it('boosters: unknown ones are dropped', () => {
    const h = fromSave(
      withField('boosters', { hammer: 1, freeSwap: 1, shuffle: 1, extraMoves: 1, prism: 1, beamNova: 1, rocket: 50, bomb: 3, constructor: 9 }),
    );
    expect(h.profile.data().boosters).toEqual({ hammer: 1, freeSwap: 1, shuffle: 1, extraMoves: 1, prism: 1, beamNova: 1 });
    h.profile.addCoins(1);
    expect(Object.keys(h.saved().boosters).sort()).toEqual([...ALL_BOOSTERS].sort());
    expect(h.storage.json).not.toContain('rocket');
  });

  it('boosters: missing or wrongly-typed entries get the starting amount', () => {
    const h = fromSave(withField('boosters', { hammer: 9, freeSwap: '3', shuffle: null }));
    expect(h.profile.data().boosters).toEqual({
      hammer: 9,
      freeSwap: START_BOOSTERS.freeSwap,
      shuffle: START_BOOSTERS.shuffle,
      extraMoves: START_BOOSTERS.extraMoves,
      prism: START_BOOSTERS.prism,
      beamNova: START_BOOSTERS.beamNova,
    });
  });

  it('boosters: a missing or non-object inventory becomes the starting inventory', () => {
    for (const bad of [undefined, null, 5, 'all', [1, 2, 3], true]) {
      expect(fromSave(withField('boosters', bad)).profile.data().boosters, String(bad)).toEqual({ ...START_BOOSTERS });
    }
  });

  it('levels: only canonical level ids with object records are kept', () => {
    const h = fromSave(
      withField('levels', {
        '1': { stars: 2, best: 100 },
        '0': { stars: 3, best: 1 },
        '-1': { stars: 3, best: 1 },
        '1.5': { stars: 3, best: 1 },
        '07': { stars: 3, best: 1 },
        '1e1': { stars: 3, best: 1 },
        ' 4': { stars: 3, best: 1 },
        abc: { stars: 3, best: 1 },
        __proto__x: { stars: 3, best: 1 },
        '10000': { stars: 3, best: 1 },
        '3': 'won',
        '4': null,
        '5': [3, 100],
        '6': 3,
        '12': { stars: 1, best: 7 },
      }),
    );
    expect(h.profile.data().levels).toEqual({ '1': { stars: 2, best: 100 }, '12': { stars: 1, best: 7 } });
  });

  it('levels: a "__proto__" key in the JSON cannot pollute anything', () => {
    const json = JSON.stringify(sampleSave()).replace('"levels":{', '"levels":{"__proto__":{"stars":3,"best":5},');
    const h = harness({ json });
    expect(h.profile.data().levels).toEqual(sampleSave().levels);
    expect(({} as Record<string, unknown>).stars).toBeUndefined();
  });

  it('levels: stars and best scores are brought into range', () => {
    const h = fromSave(
      withField('levels', {
        '1': { stars: 0, best: -10 },
        '2': { stars: 9, best: 1e30 },
        '3': { stars: 2.9, best: 55.5 },
        '4': { stars: 'three', best: 'high' },
        '5': {},
        '6': { stars: -1 },
        '7': { stars: 3, best: 4200, extra: 'ignored' },
      }),
    );
    expect(h.profile.data().levels).toEqual({
      '1': { stars: 1, best: 0 },
      '2': { stars: 3, best: 999_999_999 },
      '3': { stars: 2, best: 55 },
      '4': { stars: 1, best: 0 },
      '5': { stars: 1, best: 0 },
      '6': { stars: 1, best: 0 },
      '7': { stars: 3, best: 4200 },
    });
    expect(h.profile.totalStars()).toBe(12);
    expect(h.profile.highestUnlocked()).toBe(8);
  });

  it('levels: a missing or non-object table means no progress', () => {
    for (const bad of [undefined, null, 3, 'all', [{ stars: 3, best: 1 }]]) {
      const h = fromSave(withField('levels', bad));
      expect(h.profile.data().levels).toEqual({});
      expect(h.profile.highestUnlocked()).toBe(1);
    }
  });

  it('settings: wrong types fall back to the defaults, one by one', () => {
    expect(fromSave(withField('settings', { sfx: 'no', music: 0, haptics: false, lang: 'fr' })).profile.settings()).toEqual({
      sfx: true,
      music: true,
      haptics: false,
      lang: null,
    });
    expect(fromSave(withField('settings', { music: false })).profile.settings()).toEqual({
      sfx: true,
      music: false,
      haptics: true,
      lang: null,
    });
    expect(fromSave(withField('settings', { lang: 'AR' })).profile.settings().lang).toBeNull();
    expect(fromSave(withField('settings', { lang: 'en', volume: 11 })).profile.settings()).toEqual({
      sfx: true,
      music: true,
      haptics: true,
      lang: 'en',
    });
    for (const bad of [undefined, null, 'loud', 1, []]) {
      expect(fromSave(withField('settings', bad)).profile.settings()).toEqual({ sfx: true, music: true, haptics: true, lang: null });
    }
  });

  it('daily: the claim day', () => {
    const day = (stored: unknown): number => fromSave(withField('dailyDay', stored)).profile.data().dailyDay;
    expect(day(20_000)).toBe(20_000);
    expect(day(-1)).toBe(-1);
    expect(day(-7)).toBe(-1);
    expect(day(20_000.7)).toBe(20_000);
    expect(day('today')).toBe(-1);
    expect(day(null)).toBe(-1);
    expect(day(undefined)).toBe(-1);
    expect(day(1e300)).toBe(8_640_000_000_000_000 / DAY);
  });

  it('daily: the streak', () => {
    const streak = (stored: unknown, claimDay = 20_000): number => {
      const save = withField('dailyStreak', stored);
      save.dailyDay = claimDay;
      return fromSave(save).profile.data().dailyStreak;
    };
    expect(streak(3)).toBe(3);
    expect(streak(3.9)).toBe(3);
    expect(streak(-2)).toBe(1); // a claim exists, so at least one day
    expect(streak(0)).toBe(1);
    expect(streak('long')).toBe(1);
    expect(streak(undefined)).toBe(1);
    expect(streak(1e12)).toBe(1_000_000);
    expect(streak(5, -1)).toBe(0); // never claimed: no streak
    expect(streak(5, -50)).toBe(0);
  });

  it('seen: only distinct, non-empty strings are kept, in order', () => {
    const h = fromSave(withField('seen', ['a', 'b', 'a', '', 5, null, { id: 'x' }, ['y'], 'c', 'b', 'x'.repeat(2000)]));
    expect(h.profile.data().seen).toEqual(['a', 'b', 'c']);
    for (const bad of [undefined, null, 'a,b', { 0: 'a', length: 1 }, 7]) {
      expect(fromSave(withField('seen', bad)).profile.data().seen).toEqual([]);
    }
  });

  it('seen: an absurdly long list is capped', () => {
    const many: string[] = [];
    for (let i = 0; i < 10_000; i++) many.push('id-' + i);
    const seen = fromSave(withField('seen', many)).profile.data().seen;
    expect(seen.length).toBe(2000);
    // The newest ids survive (the same rule markSeen follows when the list is full).
    expect(seen[0]).toBe('id-8000');
    expect(seen[1999]).toBe('id-9999');
  });

  it('stats', () => {
    expect(
      fromSave(withField('stats', { played: -1, won: 2.5, bestCascade: 1e9, totalScore: 'huge' })).profile.data().stats,
    ).toEqual({ played: 0, won: 2, bestCascade: 9999, totalScore: 0 });
    expect(fromSave(withField('stats', { won: 4 })).profile.data().stats).toEqual({ played: 0, won: 4, bestCascade: 0, totalScore: 0 });
    expect(fromSave(withField('stats', { totalScore: 1e300 })).profile.data().stats.totalScore).toBe(9_000_000_000_000_000);
    for (const bad of [undefined, null, 9, 'x', [1]]) {
      expect(fromSave(withField('stats', bad)).profile.data().stats).toEqual({ played: 0, won: 0, bestCascade: 0, totalScore: 0 });
    }
  });

  it('the version field is always written as 1', () => {
    for (const version of [undefined, 0, 2, '1', null]) {
      const h = fromSave(withField('version', version));
      expect(h.profile.data().version).toBe(1);
      expect(h.profile.coins()).toBe(777); // the rest is still read
    }
  });

  it('unknown top-level fields are dropped on the next save', () => {
    const save = sampleSave() as unknown as Record<string, unknown>;
    save.cheats = { infinite: true };
    save.gems = 10_000;
    const h = fromSave(save);
    h.profile.addCoins(1);
    expect(h.storage.json).not.toContain('cheats');
    expect(h.storage.json).not.toContain('gems');
  });

  it('a partial save keeps what it has and defaults the rest', () => {
    const h = harness({ json: '{"coins":40,"levels":{"1":{"stars":2,"best":300}},"settings":{"lang":"ar"}}' });
    expect(h.profile.data()).toEqual({
      ...FRESH,
      coins: 40,
      levels: { '1': { stars: 2, best: 300 } },
      settings: { sfx: true, music: true, haptics: true, lang: 'ar' },
    });
    expect(h.profile.highestUnlocked()).toBe(2);
  });

  it('a repaired profile is saved in its repaired form', () => {
    const h = fromSave({ coins: -5, lives: 99, boosters: { hammer: -1, laser: 4 }, seen: 'x', stats: null, dailyStreak: 4 });
    h.profile.markSeen('tip');
    expect(h.saved()).toEqual({
      ...FRESH,
      coins: 0,
      boosters: { ...START_BOOSTERS, hammer: 0 },
      seen: ['tip'],
      firstDay: Math.floor(T0 / DAY), // stamped by the first save
    });
    expect(h.restart().profile.data()).toEqual(h.saved());
  });

  it('repairing is stable: repairing a repaired save changes nothing', () => {
    const messy = {
      coins: 12.5,
      lives: 2,
      lifeTimer: 5000.5,
      levels: { '3': { stars: 5, best: -1 }, bad: 1 },
      boosters: { hammer: 1e9, prism: -2 },
      settings: { sfx: false, lang: 'xx' },
      dailyDay: 12.2,
      dailyStreak: 0,
      seen: ['a', 'a', 3],
      stats: { played: 3.3 },
    };
    const once = repairSave(messy);
    expect(repairSave(once)).toEqual(once);
    expect(repairSave(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });
});
