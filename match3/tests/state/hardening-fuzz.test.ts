/**
 * Hardening: the save loader under attack. Thousands of mutated, hostile and outright garbage
 * documents go through `parseSave` / `repairSave` / `createProfile`; whatever comes in, loading must
 * never throw and must always produce a SaveData that passes the strict validator below — which is
 * written from the contract (src/state/types.ts) and DESIGN §5, not from the implementation.
 */
import { describe, expect, it } from 'vitest';
import { createProfile, fixedOffsetDayNumber, parseSave, repairSave } from '../../src/state/index.ts';
import type { BoosterId, ProfileApi, Reward, SaveData } from '../../src/state/types.ts';
import { MINUTE, T0, rng, sampleSave } from './harness.ts';

// ───────────────────────────── a strict, independent validator ─────────────────────────────

const BOOSTER_IDS = ['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'];
const SAVE_KEYS = ['boosters', 'coins', 'dailyDay', 'dailyStreak', 'levels', 'lifeTimer', 'lives', 'seen', 'settings', 'stats', 'version'];
const LIFE_MS = 20 * MINUTE;

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
}

/** A whole number ≥ min that JSON can carry without loss (no NaN, ±Infinity, −0, fractions). */
function isCount(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number {
  return typeof v === 'number' && Number.isInteger(v) && !Object.is(v, -0) && v >= min && v <= max;
}

function sameKeys(o: Record<string, unknown>, keys: string[]): boolean {
  return JSON.stringify(Object.keys(o).sort()) === JSON.stringify(keys.slice().sort());
}

/** Everything that is wrong with `d` as a SaveData (empty when it is valid). */
function saveProblems(d: unknown): string[] {
  const out: string[] = [];
  if (!isPlain(d)) return ['not a plain object'];
  if (!sameKeys(d, SAVE_KEYS)) out.push('top-level keys: ' + Object.keys(d).sort().join(','));
  if (d.version !== 1) out.push('version');

  if (!isPlain(d.levels)) out.push('levels is not a plain object');
  else {
    for (const key of Object.keys(d.levels)) {
      const rec = d.levels[key];
      if (!/^[1-9][0-9]*$/.test(key)) out.push('level key ' + JSON.stringify(key));
      if (!isPlain(rec) || !sameKeys(rec, ['best', 'stars'])) out.push('level record ' + key);
      else {
        if (rec.stars !== 1 && rec.stars !== 2 && rec.stars !== 3) out.push('stars of ' + key);
        if (!isCount(rec.best)) out.push('best of ' + key);
      }
    }
  }

  if (!isCount(d.coins)) out.push('coins ' + String(d.coins));
  if (!isCount(d.lives, 0, 5)) out.push('lives ' + String(d.lives));
  if (!isCount(d.lifeTimer)) out.push('lifeTimer ' + String(d.lifeTimer));
  if (d.lives === 5 && d.lifeTimer !== 0) out.push('a timer runs although lives are full');

  if (!isPlain(d.boosters) || !sameKeys(d.boosters, BOOSTER_IDS)) out.push('boosters shape');
  else for (const id of BOOSTER_IDS) if (!isCount(d.boosters[id])) out.push('booster ' + id);

  const s = d.settings;
  if (!isPlain(s) || !sameKeys(s, ['haptics', 'lang', 'music', 'sfx'])) out.push('settings shape');
  else {
    for (const key of ['sfx', 'music', 'haptics']) if (typeof s[key] !== 'boolean') out.push('setting ' + key);
    if (s.lang !== null && s.lang !== 'en' && s.lang !== 'ar') out.push('setting lang');
  }

  if (!isCount(d.dailyDay, -1)) out.push('dailyDay ' + String(d.dailyDay));
  if (!isCount(d.dailyStreak)) out.push('dailyStreak ' + String(d.dailyStreak));
  if (d.dailyDay === -1 && d.dailyStreak !== 0) out.push('a streak without a claim');
  if (isCount(d.dailyDay, 0) && d.dailyStreak === 0) out.push('a claim without a streak');

  if (!Array.isArray(d.seen)) out.push('seen is not an array');
  else {
    const distinct: Record<string, true> = Object.create(null);
    for (const id of d.seen as unknown[]) {
      if (typeof id !== 'string' || id.length === 0) out.push('seen entry');
      else if (distinct[id]) out.push('seen twice: ' + id.slice(0, 20));
      else distinct[id] = true;
    }
  }

  const st = d.stats;
  if (!isPlain(st) || !sameKeys(st, ['bestCascade', 'played', 'totalScore', 'won'])) out.push('stats shape');
  else for (const key of Object.keys(st)) if (!isCount(st[key])) out.push('stat ' + key);

  // What is written must be what is read back: no value JSON would silently change.
  if (out.length === 0 && JSON.stringify(JSON.parse(JSON.stringify(d))) !== JSON.stringify(d)) out.push('not JSON-stable');
  return out;
}

/** Additional rules that hold once a profile has reconciled the save with the clock `now`. */
function liveProblems(d: Readonly<SaveData>, now: number): string[] {
  const out = saveProblems(d);
  if (d.lives < 5) {
    if (!(d.lifeTimer > 0 && d.lifeTimer <= now)) out.push('timer not in (0, now]: ' + d.lifeTimer);
    if (now - d.lifeTimer >= LIFE_MS) out.push('a whole interval elapsed without granting a life');
  }
  return out;
}

// ───────────────────────────── generators ─────────────────────────────

/** JSON text for values JSON.stringify cannot write: ±Infinity become overflowing literals. */
function toJson(v: unknown): string {
  if (typeof v === 'number') {
    if (v === Infinity) return '1e999';
    if (v === -Infinity) return '-1e999';
    if (v !== v) return 'null';
    return Object.is(v, -0) ? '-0' : String(v);
  }
  if (Array.isArray(v)) return '[' + v.map(toJson).join(',') + ']';
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).map((k) => JSON.stringify(k) + ':' + toJson(o[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

/** An object with a real own key called "__proto__" (what JSON.parse produces). */
function withOwnProto(value: unknown, rest: Record<string, unknown> = {}): Record<string, unknown> {
  const o: Record<string, unknown> = { ...rest };
  Object.defineProperty(o, '__proto__', { value, enumerable: true, writable: true, configurable: true });
  return o;
}

const LONG = 'x'.repeat(200_000);
/** Long enough to be far beyond any limit, short enough to appear in thousands of random documents. */
const LONGISH = 'y'.repeat(12_000);

const NUMBERS = [
  0, -0, 1, -1, 2, 3, 4, 5, 6, 7, 0.5, -0.5, 2.5, 4.999, 1e-7, 5e-324, 99, 120, 121, 9999, 10000, 1e9, 1e10,
  2 ** 31, 2 ** 32, 2 ** 53, 2 ** 53 + 2, -(2 ** 53), 1e21, 1e100, 1.7976931348623157e308, -1.7976931348623157e308,
  Infinity, -Infinity, T0, T0 - 1, T0 + 1, T0 - 19 * MINUTE, T0 - 20 * MINUTE, T0 - 3 * 60 * MINUTE, T0 + 1e9, 8.64e15, 8.64e15 + 1,
  -1e9, 20_000, 20_522, 20_523, 20_524,
];

const STRINGS = [
  '', ' ', '0', '1', '-1', '3', '1e3', '0x10', 'NaN', 'Infinity', 'null', 'true', 'false', 'undefined', '{}', '[]',
  '__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'length', 'en', 'ar', 'AR', 'fr',
  'hammer', 'tut.swap', '\u0000', '\uD800', '\uFEFF', '\u202E', 'مرحبا', '💎', LONGISH,
];

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

/** A random hostile JSON-expressible value. */
function hostile(random: () => number, depth = 0): unknown {
  const roll = random();
  if (roll < 0.3) return pick(random, NUMBERS);
  if (roll < 0.5) return pick(random, STRINGS);
  if (roll < 0.58) return pick(random, [null, true, false]);
  if (depth > 3) return null;
  if (roll < 0.72) {
    const list: unknown[] = [];
    for (let i = Math.floor(random() * 5); i > 0; i--) list.push(hostile(random, depth + 1));
    return list;
  }
  if (roll < 0.76) return withOwnProto(hostile(random, depth + 1), { constructor: hostile(random, depth + 1) });
  if (roll < 0.8) return { length: pick(random, NUMBERS), 0: 'a', 1: 'b' };
  const o: Record<string, unknown> = {};
  for (let i = Math.floor(random() * 6); i > 0; i--) {
    const key = random() < 0.6 ? pick(random, STRINGS) : pick(random, SAVE_KEYS.concat(BOOSTER_IDS, ['stars', 'best', 'sfx', 'lang', 'played']));
    if (key === '__proto__') Object.defineProperty(o, key, { value: hostile(random, depth + 1), enumerable: true, writable: true, configurable: true });
    else o[key] = hostile(random, depth + 1);
  }
  return o;
}

/** A random but perfectly valid save. */
function validSave(random: () => number): SaveData {
  const save = sampleSave();
  save.levels = {};
  for (let id = 1, top = Math.floor(random() * 30); id <= top; id++) {
    save.levels[String(id)] = { stars: (1 + Math.floor(random() * 3)) as 1 | 2 | 3, best: Math.floor(random() * 90_000) };
  }
  save.coins = Math.floor(random() * 5000);
  save.lives = Math.floor(random() * 6);
  save.lifeTimer = save.lives === 5 ? 0 : T0 - Math.floor(random() * 19 * MINUTE);
  for (const id of BOOSTER_IDS) save.boosters[id as BoosterId] = Math.floor(random() * 12);
  save.settings = { sfx: random() < 0.5, music: random() < 0.5, haptics: random() < 0.5, lang: pick(random, [null, 'en', 'ar'] as const) };
  save.dailyDay = random() < 0.2 ? -1 : 20_523 - Math.floor(random() * 4);
  save.dailyStreak = save.dailyDay < 0 ? 0 : 1 + Math.floor(random() * 20);
  save.seen = ['tut.swap', 'tut.beam', 'tip.' + Math.floor(random() * 100)];
  save.stats = { played: 40, won: 31, bestCascade: 7, totalScore: 123_456 };
  return save;
}

/** Every path into a (plain JSON) value, as key lists. */
function paths(v: unknown, prefix: string[] = [], into: string[][] = []): string[][] {
  if (typeof v === 'object' && v !== null) {
    for (const key of Object.keys(v)) {
      const next = prefix.concat(key);
      into.push(next);
      paths((v as Record<string, unknown>)[key], next, into);
    }
  }
  return into;
}

/** A valid save with a few random places damaged: replaced, removed, renamed or duplicated elsewhere. */
function mutated(random: () => number): unknown {
  const save = JSON.parse(JSON.stringify(validSave(random))) as Record<string, unknown>;
  for (let hits = 1 + Math.floor(random() * 4); hits > 0; hits--) {
    const path = pick(random, paths(save));
    let parent: Record<string, unknown> = save;
    for (let i = 0; i < path.length - 1; i++) parent = parent[path[i]!] as Record<string, unknown>;
    if (typeof parent !== 'object' || parent === null) continue; // an earlier hit replaced it
    const key = path[path.length - 1]!;
    const roll = random();
    if (roll < 0.7) parent[key] = hostile(random);
    else if (roll < 0.85 || Array.isArray(parent)) delete parent[key];
    else {
      const other = pick(random, STRINGS.slice(0, STRINGS.length - 1)); // any key but the long one
      const value = parent[key];
      if (other === '__proto__') Object.defineProperty(parent, other, { value, enumerable: true, writable: true, configurable: true });
      else parent[other] = value;
      if (random() < 0.5) delete parent[key];
    }
  }
  return save;
}

// ───────────────────────────── the checks every document goes through ─────────────────────────────

const PROTOTYPE_KEYS = Object.getOwnPropertyNames(Object.prototype).sort().join(',');
const ARRAY_PROTOTYPE_KEYS = Object.getOwnPropertyNames(Array.prototype).sort().join(',');

function expectCleanPrototypes(): void {
  expect(Object.getOwnPropertyNames(Object.prototype).sort().join(',')).toBe(PROTOTYPE_KEYS);
  expect(Object.getOwnPropertyNames(Array.prototype).sort().join(',')).toBe(ARRAY_PROTOTYPE_KEYS);
  const probe = {} as Record<string, unknown>;
  for (const key of ['coins', 'lives', 'stars', 'best', 'polluted', 'hammer', 'sfx', 'lang']) expect(probe[key]).toBeUndefined();
}

const REWARDS: Reward[] = [
  { kind: 'coins', amount: 25 },
  { kind: 'booster', id: 'prism', amount: 2 },
  { kind: 'lives', amount: 1 },
];

/** Call every method of the API once, with ordinary arguments. Returns what was stored last. */
function exercise(profile: ProfileApi, clock: { now: number }): void {
  profile.lives();
  profile.loseLife();
  clock.now += 7 * MINUTE;
  profile.refillLives();
  profile.addCoins(10);
  profile.spendCoins(5);
  profile.buyBooster('hammer');
  profile.takeBooster('shuffle');
  profile.addBooster('freeSwap', 1);
  profile.boosterCount('beamNova');
  profile.boosterPrice('prism');
  profile.grant(REWARDS);
  profile.recordAttempt();
  profile.recordWin(1, 3, 1000, 4);
  profile.recordWin(profile.highestUnlocked(), 2, 2500, 2);
  profile.record(1);
  profile.totalStars();
  profile.daily();
  profile.claimDaily();
  clock.now += 26 * 60 * MINUTE;
  profile.claimDaily();
  profile.markSeen('tut.fuzz');
  profile.hasSeen('tut.fuzz');
  profile.setSetting('lang', 'ar');
  profile.setSetting('music', false);
  profile.settings();
  profile.coins();
}

interface Loaded {
  profile: ProfileApi;
  clock: { now: number };
  storage: { json: string | null; writes: number };
}

function load(json: string | null, now = T0): Loaded {
  const clock = { now };
  const storage = { json, writes: 0 };
  const profile = createProfile({
    load: () => storage.json,
    save: (text) => {
      storage.json = text;
      storage.writes += 1;
    },
    now: () => clock.now,
    levelCount: 120,
    dayNumber: fixedOffsetDayNumber(180),
  });
  return { profile, clock, storage };
}

/** The whole gauntlet for one raw save string. Returns problems instead of asserting (cheap in a hot loop). */
function gauntlet(json: string): string[] {
  let parsed: SaveData;
  try {
    parsed = parseSave(json);
  } catch (err) {
    return ['parseSave threw: ' + String(err)];
  }
  const out = saveProblems(parsed).map((p) => 'parseSave: ' + p);
  // Repairing is a projection: what it produced is accepted unchanged the second time.
  const again = parseSave(JSON.stringify(parsed));
  if (JSON.stringify(again) !== JSON.stringify(parsed)) out.push('repair is not idempotent');
  try {
    const h = load(json);
    out.push(...liveProblems(h.profile.data(), h.clock.now).map((p) => 'loaded: ' + p));
    // What a profile shows right after loading is what the pure parser said, except for the lives clockwork.
    const shown = JSON.parse(JSON.stringify(h.profile.data())) as SaveData;
    for (const key of ['levels', 'coins', 'boosters', 'settings', 'dailyDay', 'dailyStreak', 'seen', 'stats'] as const) {
      if (JSON.stringify(shown[key]) !== JSON.stringify(parsed[key])) out.push('profile and parser disagree on ' + key);
    }
    exercise(h.profile, h.clock);
    out.push(...liveProblems(h.profile.data(), h.clock.now).map((p) => 'after play: ' + p));
    if (h.storage.json === null) out.push('nothing was stored after playing');
    else {
      out.push(...saveProblems(JSON.parse(h.storage.json)).map((p) => 'stored: ' + p));
      const reloaded = load(h.storage.json, h.clock.now);
      if (JSON.stringify(reloaded.profile.data()) !== JSON.stringify(h.profile.data())) out.push('a restart changed the profile');
      if (reloaded.storage.writes !== 0) out.push('loading its own save made the profile write');
    }
  } catch (err) {
    out.push('profile threw: ' + String(err));
  }
  return out;
}

function report(failures: string[]): string {
  return failures.slice(0, 5).join('\n');
}

// ───────────────────────────── tests ─────────────────────────────

describe('hardening: the validator itself', () => {
  it('accepts a fresh and a mid-game save, and rejects damaged ones', () => {
    expect(saveProblems(parseSave(null))).toEqual([]);
    expect(saveProblems(sampleSave())).toEqual([]);
    const bad: [string, (s: Record<string, unknown>) => void][] = [
      ['coins', (s) => (s.coins = -1)],
      ['coins', (s) => (s.coins = 1.5)],
      ['coins', (s) => (s.coins = NaN)],
      ['lives', (s) => (s.lives = 6)],
      ['timer', (s) => (s.lifeTimer = 5)],
      ['dailyDay', (s) => (s.dailyDay = -0)],
      ['streak', (s) => (s.dailyStreak = 0)],
      ['stars', (s) => ((s.levels as Record<string, unknown>)['1'] = { stars: 4, best: 1 })],
      ['level key', (s) => ((s.levels as Record<string, unknown>)['01'] = { stars: 1, best: 1 })],
      ['booster', (s) => delete (s.boosters as Record<string, unknown>).prism],
      ['seen', (s) => (s.seen = ['a', 'a'])],
      ['keys', (s) => (s.extra = 1)],
      ['lang', (s) => ((s.settings as Record<string, unknown>).lang = 'fr')],
    ];
    for (const [name, damage] of bad) {
      const save = sampleSave() as unknown as Record<string, unknown>;
      damage(save);
      expect(saveProblems(save), name).not.toEqual([]);
    }
  });
});

describe('hardening: fuzzing the save loader', () => {
  it('6,000 valid saves with random damage always load into a valid profile', () => {
    const random = rng(20260310);
    const failures: string[] = [];
    for (let i = 0; i < 6000 && failures.length < 5; i++) {
      const json = toJson(mutated(random));
      const problems = gauntlet(json);
      if (problems.length) failures.push(problems.join('; ') + '  ← ' + json.slice(0, 600));
    }
    expect(report(failures)).toBe('');
    expectCleanPrototypes();
  });

  it('3,000 documents of pure random JSON always load into a valid profile', () => {
    const random = rng(777);
    const failures: string[] = [];
    for (let i = 0; i < 3000 && failures.length < 5; i++) {
      const json = toJson(hostile(random));
      const problems = gauntlet(json);
      if (problems.length) failures.push(problems.join('; ') + '  ← ' + json.slice(0, 600));
    }
    expect(report(failures)).toBe('');
    expectCleanPrototypes();
  });

  it('3,000 save-shaped documents made only of hostile values always load into a valid profile', () => {
    const random = rng(4242);
    const failures: string[] = [];
    for (let i = 0; i < 3000 && failures.length < 5; i++) {
      const doc: Record<string, unknown> = {};
      for (const key of SAVE_KEYS) if (random() < 0.9) doc[key] = hostile(random);
      const json = toJson(doc);
      const problems = gauntlet(json);
      if (problems.length) failures.push(problems.join('; ') + '  ← ' + json.slice(0, 600));
    }
    expect(report(failures)).toBe('');
    expectCleanPrototypes();
  });

  it('2,000 valid save strings cut, spliced and scrambled as text always load into a valid profile', () => {
    const random = rng(31337);
    const failures: string[] = [];
    const junk = ['', '\u0000', '{', '}', '[', ']', '"', ':', ',', '\\', '\\u', 'null', '1e999', '-', '\uFEFF', '"__proto__":{"coins":9}', '/*x*/', '\n'];
    for (let i = 0; i < 2000 && failures.length < 5; i++) {
      let text = JSON.stringify(validSave(random));
      for (let hits = 1 + Math.floor(random() * 3); hits > 0; hits--) {
        const at = Math.floor(random() * (text.length + 1));
        const roll = random();
        if (roll < 0.3) text = text.slice(0, at);
        else if (roll < 0.5) text = text.slice(at);
        else if (roll < 0.8) text = text.slice(0, at) + pick(random, junk) + text.slice(at);
        else text = text.slice(0, at) + text.slice(at + 1 + Math.floor(random() * 8));
      }
      const problems = gauntlet(text);
      if (problems.length) failures.push(problems.join('; ') + '  ← ' + text.slice(0, 600));
    }
    expect(report(failures)).toBe('');
  });

  it('every single field survives every hostile value, one at a time', () => {
    const base = JSON.parse(JSON.stringify(sampleSave())) as Record<string, unknown>;
    const values: unknown[] = [...NUMBERS, ...STRINGS, LONG, null, true, false, [], [1], [[]], {}, { a: 1 }, withOwnProto({ coins: 1 }), [LONG, LONG]];
    const failures: string[] = [];
    for (const path of paths(base)) {
      for (const value of values) {
        const save = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
        let parent = save;
        for (let i = 0; i < path.length - 1; i++) parent = parent[path[i]!] as Record<string, unknown>;
        parent[path[path.length - 1]!] = value;
        const problems = gauntlet(toJson(save));
        if (problems.length && failures.length < 5) failures.push(path.join('.') + ' = ' + toJson(value).slice(0, 60) + ': ' + problems.join('; '));
      }
    }
    expect(report(failures)).toBe('');
    expectCleanPrototypes();
  });
});

describe('hardening: hand-picked hostile saves', () => {
  it('prototype-pollution keys at every level change nothing outside the save', () => {
    const docs = [
      '{"__proto__":{"coins":999999,"lives":5,"polluted":true}}',
      '{"constructor":{"prototype":{"polluted":true}}}',
      '{"levels":{"__proto__":{"stars":3,"best":9},"constructor":{"stars":3,"best":9},"prototype":{"stars":3,"best":9}}}',
      '{"levels":{"1":{"__proto__":{"stars":3,"best":9}}}}',
      '{"boosters":{"__proto__":{"hammer":99},"constructor":5,"toString":7,"hasOwnProperty":1}}',
      '{"settings":{"__proto__":{"lang":"ar","sfx":false}}}',
      '{"stats":{"__proto__":{"won":5}},"seen":{"__proto__":["a"],"length":2,"0":"a","1":"b"}}',
      '{"seen":["__proto__","constructor","toString","hasOwnProperty","valueOf"]}',
      '[{"__proto__":{"polluted":true}}]',
    ];
    for (const json of docs) {
      expect(gauntlet(json), json).toEqual([]);
      const save = parseSave(json);
      expect(Object.getPrototypeOf(save.levels)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(save.boosters)).toBe(Object.prototype);
      expect(save.coins).toBe(150);
      expect(save.boosters.hammer).toBe(3);
      expect(save.settings.lang).toBeNull();
    }
    expectCleanPrototypes();
    // Ids that happen to be property names are ordinary tips.
    const h = load('{"seen":["__proto__","constructor"]}');
    expect(h.profile.hasSeen('__proto__')).toBe(true);
    expect(h.profile.hasSeen('constructor')).toBe(true);
    expect(h.profile.hasSeen('toString')).toBe(false);
    h.profile.markSeen('toString');
    expect(h.profile.hasSeen('toString')).toBe(true);
    expect(h.profile.hasSeen('valueOf')).toBe(false);
  });

  it('overflowing and extreme numbers are clamped, never stored as null', () => {
    const json =
      '{"version":1e999,"coins":1e999,"lives":1e999,"lifeTimer":-1e999,"dailyDay":1e999,"dailyStreak":1e999,' +
      '"boosters":{"hammer":1e999,"prism":-1e999,"shuffle":1e-320},"levels":{"3":{"stars":1e999,"best":1e999},"4":{"stars":-1e999,"best":-1e999}},' +
      '"stats":{"played":1e999,"won":-1e999,"bestCascade":1e999,"totalScore":1e999}}';
    expect(gauntlet(json)).toEqual([]);
    const save = parseSave(json);
    expect(save.coins).toBe(999_999_999);
    expect(save.lives).toBe(5);
    expect(save.boosters).toMatchObject({ hammer: 9_999, prism: 0, shuffle: 0 });
    expect(save.levels).toEqual({ '3': { stars: 3, best: 999_999_999 }, '4': { stars: 1, best: 0 } });
    expect(Number.isSafeInteger(save.stats.totalScore)).toBe(true);
    expect(JSON.stringify(save)).not.toContain('null,');
  });

  it('enormous documents are handled: huge strings, huge arrays, huge tables, deep nesting', () => {
    const big = {
      seen: Array.from({ length: 50_000 }, (_, i) => (i % 3 === 0 ? LONG.slice(0, 5000) : 'tip.' + i)),
      levels: Object.fromEntries(Array.from({ length: 30_000 }, (_, i) => [String(i), { stars: 2, best: i }])),
      boosters: Object.fromEntries(Array.from({ length: 5_000 }, (_, i) => ['b' + i, i])),
      settings: { lang: LONG, sfx: LONG },
      coins: LONG,
    };
    const json = JSON.stringify(big);
    expect(gauntlet(json)).toEqual([]);
    const save = parseSave(json);
    expect(save.seen.length).toBeLessThanOrEqual(2_000);
    expect(Object.keys(save.levels).length).toBeLessThanOrEqual(9_999);
    expect(JSON.stringify(save).length).toBeLessThan(1_000_000);

    const deep = '{"levels":'.repeat(3000) + '1' + '}'.repeat(3000);
    expect(gauntlet(deep)).toEqual([]);
    const deepArray = '['.repeat(100_000) + ']'.repeat(100_000); // may overflow the JSON parser's stack: still no throw
    expect(gauntlet(deepArray)).toEqual([]);
    const longKey = JSON.stringify({ levels: { [LONG]: { stars: 3, best: 1 }, ['9'.repeat(400)]: { stars: 3, best: 1 } }, seen: [LONG] });
    expect(gauntlet(longKey)).toEqual([]);
    expect(parseSave(longKey).levels).toEqual({});
    expect(parseSave(longKey).seen).toEqual([]);
  });

  it('a save wrapped by a sloppy bridge (BOM, padding, encoded twice) is still recognised', () => {
    const good = JSON.stringify(sampleSave());
    for (const json of ['\uFEFF' + good, '  \n' + good + '\n\n', JSON.stringify(good), '\uFEFF' + JSON.stringify(good)]) {
      expect(gauntlet(json)).toEqual([]);
      expect(parseSave(json), JSON.stringify(json.slice(0, 12))).toEqual(sampleSave());
    }
    // …but only one extra layer is unwrapped, and a string that is not a save stays garbage.
    expect(parseSave(JSON.stringify(JSON.stringify(good))).coins).toBe(150);
    expect(parseSave(JSON.stringify('hello')).coins).toBe(150);
  });

  it('repairSave never throws, even on things JSON cannot express', () => {
    const cyclic: Record<string, unknown> = { coins: 5 };
    cyclic.levels = cyclic;
    cyclic.seen = [cyclic];
    const explosive = {
      get coins(): number {
        throw new Error('boom');
      },
    };
    const trap = new Proxy(
      {},
      {
        get() {
          throw new Error('trap');
        },
        ownKeys() {
          throw new Error('trap');
        },
      },
    );
    const frozen = Object.freeze({ coins: 7, levels: Object.freeze({ '1': Object.freeze({ stars: 2, best: 10 }) }), seen: Object.freeze(['a']) });
    const exotic: unknown[] = [
      undefined, NaN, Infinity, -Infinity, 10n, Symbol('s'), () => 1, new Date(0), new Map([['coins', 1]]), new Set([1]), /x/, new Error('e'),
      Object.create(null), new (class Save { coins = 3; })(), new Proxy({ coins: 4 }, {}), cyclic, explosive, trap, frozen,
      { coins: NaN, lives: NaN, lifeTimer: NaN, dailyDay: NaN, dailyStreak: NaN },
      { coins: Infinity, lives: -Infinity, lifeTimer: Infinity, dailyDay: Infinity, dailyStreak: -Infinity },
      { coins: 10n, lives: Symbol('x'), boosters: new Map(), levels: new Date(), seen: new Set(['a']), stats: () => 1, settings: /x/ },
      { coins: undefined, levels: { '1': undefined, '2': { stars: undefined, best: NaN } }, seen: [undefined, NaN, {}, ['a']] },
      { levels: { '1': explosive, '2': trap }, boosters: trap, settings: explosive, stats: trap, seen: [trap] },
      { seen: Object.assign([], { length: 3 }) },
      { coins: { valueOf: () => 5 }, lives: { valueOf: () => 3 } },
      { coins: new Number(5), lives: new Number(3), seen: [new String('a')] },
    ];
    for (const value of exotic) {
      let save: SaveData | null = null;
      expect(() => {
        save = repairSave(value);
      }).not.toThrow();
      expect(saveProblems(save)).toEqual([]);
    }
    expect(repairSave(frozen).coins).toBe(7);
    expect(repairSave(frozen).levels).toEqual({ '1': { stars: 2, best: 10 } });
    // Nothing handed in is kept by reference or modified.
    const source = sampleSave();
    const copy = JSON.parse(JSON.stringify(source)) as SaveData;
    const repaired = repairSave(source);
    repaired.levels['1']!.best = 1;
    repaired.boosters.hammer = 99;
    repaired.seen.push('x');
    repaired.settings.sfx = !repaired.settings.sfx;
    repaired.stats.won = 0;
    expect(source).toEqual(copy);
  });

  it('a load() that returns non-strings or throws odd things gives a fresh, working profile', () => {
    const answers: (() => unknown)[] = [
      () => undefined,
      () => 0,
      () => ({ coins: 5 }),
      () => ['{}'],
      () => new String(JSON.stringify(sampleSave())),
      () => {
        throw null;
      },
      () => {
        throw 'text';
      },
      () => Promise.resolve('{}'),
    ];
    for (const answer of answers) {
      const storage = { json: '' };
      const clock = { now: T0 };
      const profile = createProfile({
        load: answer as () => string | null,
        save: (json) => (storage.json = json),
        now: () => clock.now,
        levelCount: 120,
      });
      expect(profile.coins()).toBe(150);
      exercise(profile, clock);
      expect(saveProblems(JSON.parse(storage.json))).toEqual([]);
    }
  });
});
