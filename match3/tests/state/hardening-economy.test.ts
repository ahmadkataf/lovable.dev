/**
 * Hardening: coins, boosters, progress, persistence and reset.
 *  - a ledger model replays long random sequences of economy calls with ordinary AND hostile
 *    arguments: coins and boosters must match to the unit, never go negative, never become fractional;
 *  - spending and buying are atomic, also when storage or a subscriber fails mid-way;
 *  - every mutation is stored exactly once and announced exactly once, every no-op not at all;
 *  - progress: replays, star upgrades, out-of-range level ids, highestUnlocked;
 *  - reset keeps the language (and only wipes progress).
 * Numbers are written out from DESIGN §5 instead of being imported from the implementation.
 */
import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/state/index.ts';
import type { BoosterId, ProfileApi, Reward, SaveData } from '../../src/state/types.ts';
import { DAY, MINUTE, T0, fromSave, harness, rng, sampleSave } from './harness.ts';
import type { Harness } from './harness.ts';

const IDS: BoosterId[] = ['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'];
const PRICE: Record<string, number> = { hammer: 90, freeSwap: 80, shuffle: 60, extraMoves: 70, prism: 120, beamNova: 100 };
const START: Record<string, number> = { hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 1, beamNova: 1 };
const COIN_CAP = 999_999_999;
const BOOSTER_CAP = 9_999;

// ───────────────────────────── ledger model ─────────────────────────────

class Ledger {
  coins = 150;
  boosters: Record<string, number> = { ...START };

  private static whole(n: unknown): number {
    return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0;
  }

  /** Each method returns [result, changed]. */
  add(n: unknown): [undefined, boolean] {
    const before = this.coins;
    this.coins = Math.min(COIN_CAP, this.coins + Ledger.whole(n));
    return [undefined, this.coins !== before];
  }

  spend(n: unknown): [boolean, boolean] {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return [false, false];
    const price = Math.ceil(n);
    if (price > this.coins) return [false, false];
    this.coins -= price;
    return [true, price > 0];
  }

  addBooster(id: unknown, n: unknown): [undefined, boolean] {
    if (typeof id !== 'string' || !(IDS as string[]).includes(id)) return [undefined, false];
    const before = this.boosters[id]!;
    this.boosters[id] = Math.min(BOOSTER_CAP, before + Ledger.whole(n));
    return [undefined, this.boosters[id] !== before];
  }

  take(id: unknown): [boolean, boolean] {
    if (typeof id !== 'string' || !(IDS as string[]).includes(id) || this.boosters[id]! <= 0) return [false, false];
    this.boosters[id] = this.boosters[id]! - 1;
    return [true, true];
  }

  buy(id: unknown): [boolean, boolean] {
    if (typeof id !== 'string' || !(IDS as string[]).includes(id)) return [false, false];
    if (this.coins < PRICE[id]! || this.boosters[id]! >= BOOSTER_CAP) return [false, false];
    this.coins -= PRICE[id]!;
    this.boosters[id] = this.boosters[id]! + 1;
    return [true, true];
  }

  grant(rewards: unknown): [undefined, boolean] {
    let changed = false;
    if (!Array.isArray(rewards)) return [undefined, false];
    for (const r of rewards as unknown[]) {
      if (typeof r !== 'object' || r === null || Array.isArray(r)) continue;
      const reward = r as { kind?: unknown; id?: unknown; amount?: unknown };
      if (reward.kind === 'coins') changed = this.add(reward.amount)[1] || changed;
      else if (reward.kind === 'booster') changed = this.addBooster(reward.id, reward.amount)[1] || changed;
      // 'lives' rewards change nothing here: lives stay full throughout this test.
    }
    return [undefined, changed];
  }
}

const ODD_NUMBERS: unknown[] = [
  0, -0, 1, 2, 5, 59, 60, 61, 90, 119, 120, 150, 500, 15_000, 0.1, 0.99, 1.5, 59.01, -1, -0.5, -150, -1e9,
  NaN, Infinity, -Infinity, 1e9, 1e18, 1e300, Number.MAX_VALUE, Number.MIN_VALUE, 2 ** 53,
  '5', '', null, undefined, true, [], [5], {}, { valueOf: () => 5 }, 10n, Symbol('n'),
];
const ODD_IDS: unknown[] = [...IDS, ...IDS, 'Hammer', 'hammer ', '', '__proto__', 'constructor', 'toString', 'length', 0, null, undefined, {}, ['hammer'], Symbol('id')];

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

function oddReward(random: () => number): unknown {
  const roll = random();
  if (roll < 0.3) return { kind: 'coins', amount: pick(random, ODD_NUMBERS) };
  if (roll < 0.6) return { kind: 'booster', id: pick(random, ODD_IDS), amount: pick(random, ODD_NUMBERS) };
  if (roll < 0.7) return { kind: 'lives', amount: pick(random, ODD_NUMBERS) };
  return pick(random, [null, undefined, 5, 'coins', [], {}, { kind: 'gems', amount: 5 }, { kind: 'coins' }, { kind: 'booster', amount: 2 }, { amount: 5 }, [{ kind: 'coins', amount: 5 }]]);
}

function expectLedger(h: Harness, ledger: Ledger, where: string): void {
  const p = h.profile;
  expect(p.coins(), where).toBe(ledger.coins);
  for (const id of IDS) expect(p.boosterCount(id), where + ' ' + id).toBe(ledger.boosters[id]);
  const data = p.data();
  expect(Number.isInteger(data.coins) && data.coins >= 0 && data.coins <= COIN_CAP, where).toBe(true);
  expect(Object.keys(data.boosters).sort(), where).toEqual(IDS.slice().sort());
  for (const id of IDS) expect(Number.isInteger(data.boosters[id]) && data.boosters[id] >= 0 && data.boosters[id] <= BOOSTER_CAP, where).toBe(true);
}

describe('hardening: the economy against a ledger model', () => {
  it('matches to the unit over 30 random histories with hostile arguments', () => {
    let refusedSpends = 0;
    let refusedBuys = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const random = rng(seed * 7919);
      let h = harness();
      const ledger = new Ledger();
      for (let step = 0; step < 1500; step++) {
        const where = `seed ${seed}, step ${step}`;
        const writes = h.storage.writes;
        const notes = h.notifications.count;
        let changed: boolean;
        const roll = random();
        const p = h.profile as unknown as Record<string, (...args: unknown[]) => unknown>;
        if (roll < 0.16) {
          const n = pick(random, ODD_NUMBERS);
          changed = ledger.add(n)[1];
          expect(p.addCoins!(n), where).toBeUndefined();
        } else if (roll < 0.38) {
          const n = random() < 0.5 ? pick(random, ODD_NUMBERS) : Math.floor(random() * 400);
          const [ok, did] = ledger.spend(n);
          changed = did;
          expect(p.spendCoins!(n), where + ` spend ${String(n)}`).toBe(ok);
          if (!ok) refusedSpends += 1;
        } else if (roll < 0.5) {
          const id = pick(random, ODD_IDS);
          const n = pick(random, ODD_NUMBERS);
          changed = ledger.addBooster(id, n)[1];
          p.addBooster!(id, n);
        } else if (roll < 0.64) {
          const id = pick(random, ODD_IDS);
          const [ok, did] = ledger.take(id);
          changed = did;
          expect(p.takeBooster!(id), where).toBe(ok);
        } else if (roll < 0.84) {
          const id = pick(random, ODD_IDS);
          const [ok, did] = ledger.buy(id);
          changed = did;
          expect(p.buyBooster!(id), where).toBe(ok);
          if (!ok) refusedBuys += 1;
        } else if (roll < 0.94) {
          const rewards = random() < 0.1 ? pick(random, [null, undefined, 5, 'x', {}]) : Array.from({ length: Math.floor(random() * 5) }, () => oddReward(random));
          changed = ledger.grant(rewards)[1];
          p.grant!(rewards);
        } else {
          h = h.restart();
          changed = false;
          expectLedger(h, ledger, where + ' (after restart)');
          continue;
        }
        expectLedger(h, ledger, where);
        expect(h.storage.writes - writes, where + ': stored').toBe(changed ? 1 : 0);
        expect(h.notifications.count - notes, where + ': announced').toBe(changed ? 1 : 0);
        if (changed) expect(h.saved().coins, where).toBe(ledger.coins);
      }
    }
    expect(refusedSpends).toBeGreaterThan(1000);
    expect(refusedBuys).toBeGreaterThan(1000);
  });

  it('coins can never go negative: every way of paying is refused one coin short', () => {
    for (const id of IDS) {
      const h = fromSave({ ...sampleSave(), coins: PRICE[id]! - 1 });
      const before = JSON.stringify(h.profile.data());
      expect(h.profile.buyBooster(id)).toBe(false);
      expect(h.profile.spendCoins(PRICE[id]!)).toBe(false);
      expect(JSON.stringify(h.profile.data())).toBe(before);
      expect(h.storage.writes).toBe(0);
      expect(h.notifications.count).toBe(0);
      // With exactly the price it works and leaves exactly zero.
      h.profile.addCoins(1);
      expect(h.profile.buyBooster(id)).toBe(true);
      expect(h.profile.coins()).toBe(0);
      expect(h.profile.buyBooster(id)).toBe(false);
      expect(h.profile.spendCoins(1)).toBe(false);
      expect(h.profile.spendCoins(0.001)).toBe(false);
      expect(h.profile.coins()).toBe(0);
    }
    // The refill, one coin short and exact.
    const h = fromSave({ ...sampleSave(), coins: 119, lives: 2, lifeTimer: T0 });
    expect(h.profile.refillLives()).toBe(false);
    expect(h.profile.coins()).toBe(119);
    expect(h.profile.lives().count).toBe(2);
    h.profile.addCoins(1);
    expect(h.profile.refillLives()).toBe(true);
    expect(h.profile.coins()).toBe(0);
    expect(h.profile.lives().count).toBe(5);
    // The continue prices are charged through spendCoins: 90, then 150, then 240 — all or nothing.
    const c = fromSave({ ...sampleSave(), coins: 90 + 150 + 239 });
    expect(c.profile.spendCoins(90)).toBe(true);
    expect(c.profile.spendCoins(150)).toBe(true);
    expect(c.profile.spendCoins(240)).toBe(false);
    expect(c.profile.coins()).toBe(239);
  });

  it('a purchase at the inventory cap is refused without taking coins', () => {
    const h = fromSave({ ...sampleSave(), coins: 5000, boosters: { ...START, prism: BOOSTER_CAP } });
    expect(h.profile.buyBooster('prism')).toBe(false);
    expect(h.profile.coins()).toBe(5000);
    expect(h.profile.boosterCount('prism')).toBe(BOOSTER_CAP);
    expect(h.storage.writes).toBe(0);
  });
});

// ───────────────────────────── atomicity ─────────────────────────────

describe('hardening: spending and buying are atomic', () => {
  /** What must hold at every instant anyone can observe: coins + what was bought add up. */
  function worth(data: Readonly<SaveData>): number {
    let total = data.coins;
    for (const id of IDS) total += (data.boosters[id] - START[id]!) * PRICE[id]!;
    return total;
  }

  it('whatever is stored and whatever subscribers see is always a complete transaction', () => {
    const storage = { json: null as string | null };
    const clock = { now: T0 };
    const snapshots: number[] = [];
    const profile = createProfile({
      load: () => storage.json,
      save: (json) => {
        storage.json = json;
        snapshots.push(worth(JSON.parse(json) as SaveData)); // what a crash right now would leave behind
      },
      now: () => clock.now,
      levelCount: 120,
    });
    profile.subscribe(() => snapshots.push(worth(profile.data())));
    profile.addCoins(850); // 1000 coins
    const random = rng(8);
    for (let i = 0; i < 400; i++) profile.buyBooster(IDS[Math.floor(random() * IDS.length)]!);
    expect(snapshots.length).toBeGreaterThan(10);
    for (const total of snapshots) expect(total).toBe(1000);
    expect(profile.coins()).toBeLessThan(60); // everything affordable was bought
    expect(profile.coins()).toBeGreaterThanOrEqual(0);
  });

  it('a save that fails does not leave half a purchase in memory', () => {
    let failing = false;
    const storage = { json: null as string | null };
    const profile = createProfile({
      load: () => storage.json,
      save: (json) => {
        if (failing) throw new Error('QuotaExceededError');
        storage.json = json;
      },
      now: () => T0,
      levelCount: 120,
    });
    profile.addCoins(1000);
    failing = true;
    expect(profile.buyBooster('prism')).toBe(true);
    expect(profile.spendCoins(30)).toBe(true);
    expect(worth(profile.data())).toBe(1150 - 30);
    expect(profile.boosterCount('prism')).toBe(2);
    // Storage still holds the last complete state; the next successful save brings it up to date.
    expect(worth(JSON.parse(storage.json!) as SaveData)).toBe(1150);
    failing = false;
    profile.addCoins(1);
    expect(JSON.parse(storage.json!)).toEqual(JSON.parse(JSON.stringify(profile.data())));
  });

  it('subscribers that throw or spend during a notification cannot corrupt a transaction', () => {
    const h = harness();
    h.profile.addCoins(850);
    let reentered = 0;
    h.profile.subscribe(() => {
      throw new Error('listener bug');
    });
    h.profile.subscribe(() => {
      // A greedy listener: reacts to every change by buying more (re-entrant mutation).
      if (reentered < 3 && h.profile.coins() >= 60) {
        reentered += 1;
        h.profile.buyBooster('shuffle');
      }
    });
    const errors = console.error;
    console.error = () => {};
    try {
      expect(h.profile.buyBooster('hammer')).toBe(true);
    } finally {
      console.error = errors;
    }
    expect(reentered).toBe(3);
    expect(h.profile.coins()).toBe(1000 - 90 - 3 * 60);
    expect(h.profile.boosterCount('hammer')).toBe(4);
    expect(h.profile.boosterCount('shuffle')).toBe(6);
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
  });

  it('a subscriber that resets the profile during a purchase leaves a consistent fresh profile', () => {
    const h = harness();
    let once = true;
    h.profile.subscribe(() => {
      if (once) {
        once = false;
        h.profile.reset();
      }
    });
    expect(h.profile.buyBooster('shuffle')).toBe(true);
    expect(h.profile.coins()).toBe(150);
    expect(h.profile.boosterCount('shuffle')).toBe(3);
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
  });
});

// ───────────────────────────── exactly once ─────────────────────────────

describe('hardening: every mutation is stored once and announced once', () => {
  interface Case {
    name: string;
    setup?: (h: Harness) => void;
    act: (p: ProfileApi) => unknown;
  }

  const CHANGES: Case[] = [
    { name: 'loseLife', act: (p) => p.loseLife() },
    { name: 'loseLife (last life)', setup: (h) => { for (let i = 0; i < 4; i++) h.profile.loseLife(); }, act: (p) => p.loseLife() },
    { name: 'refillLives', setup: (h) => h.profile.loseLife(), act: (p) => p.refillLives() },
    { name: 'addCoins', act: (p) => p.addCoins(1) },
    { name: 'spendCoins', act: (p) => p.spendCoins(150) },
    { name: 'spendCoins (fraction)', act: (p) => p.spendCoins(0.2) },
    { name: 'addBooster', act: (p) => p.addBooster('prism', 2) },
    { name: 'takeBooster', act: (p) => p.takeBooster('prism') },
    { name: 'buyBooster', act: (p) => p.buyBooster('shuffle') },
    { name: 'grant (one)', act: (p) => p.grant([{ kind: 'coins', amount: 1 }]) },
    { name: 'grant (many)', act: (p) => p.grant([{ kind: 'coins', amount: 500 }, { kind: 'booster', id: 'hammer', amount: 3 }, { kind: 'booster', id: 'prism', amount: 2 }, { kind: 'lives' }]) },
    { name: 'grant (life)', setup: (h) => h.profile.loseLife(), act: (p) => p.grant([{ kind: 'lives', amount: 1 }]) },
    { name: 'grant (mixed with junk)', act: (p) => p.grant([null as unknown as Reward, { kind: 'coins', amount: -5 }, { kind: 'coins', amount: 5 }]) },
    { name: 'recordWin (first clear)', act: (p) => p.recordWin(1, 2, 1000, 3) },
    { name: 'recordWin (replay, better)', setup: (h) => h.profile.recordWin(1, 1, 500, 1), act: (p) => p.recordWin(1, 3, 900, 2) },
    { name: 'recordWin (replay, worse)', setup: (h) => h.profile.recordWin(1, 3, 500, 1), act: (p) => p.recordWin(1, 1, 100, 0) },
    { name: 'recordAttempt', act: (p) => p.recordAttempt() },
    { name: 'claimDaily', act: (p) => p.claimDaily() },
    { name: 'setSetting sfx', act: (p) => p.setSetting('sfx', false) },
    { name: 'setSetting music', act: (p) => p.setSetting('music', false) },
    { name: 'setSetting haptics', act: (p) => p.setSetting('haptics', false) },
    { name: 'setSetting lang', act: (p) => p.setSetting('lang', 'ar') },
    { name: 'setSetting lang back to device', setup: (h) => h.profile.setSetting('lang', 'en'), act: (p) => p.setSetting('lang', null) },
    { name: 'markSeen', act: (p) => p.markSeen('tut.swap') },
    { name: 'reset (of a played profile)', setup: (h) => { h.profile.recordWin(1, 3, 10, 1); h.profile.loseLife(); }, act: (p) => p.reset() },
  ];

  const NO_OPS: Case[] = [
    { name: 'loseLife without lives', setup: (h) => { for (let i = 0; i < 5; i++) h.profile.loseLife(); }, act: (p) => p.loseLife() },
    { name: 'refillLives when full', act: (p) => p.refillLives() },
    { name: 'refillLives without coins', setup: (h) => { h.profile.loseLife(); h.profile.spendCoins(100); }, act: (p) => p.refillLives() },
    { name: 'addCoins(0)', act: (p) => p.addCoins(0) },
    { name: 'addCoins(-5)', act: (p) => p.addCoins(-5) },
    { name: 'spendCoins(0)', act: (p) => p.spendCoins(0) },
    { name: 'spendCoins too much', act: (p) => p.spendCoins(151) },
    { name: 'spendCoins(-1)', act: (p) => p.spendCoins(-1) },
    { name: 'addBooster(0)', act: (p) => p.addBooster('prism', 0) },
    { name: 'addBooster unknown', act: (p) => p.addBooster('wand' as BoosterId, 1) },
    { name: 'takeBooster empty', setup: (h) => h.profile.takeBooster('prism'), act: (p) => p.takeBooster('prism') },
    { name: 'buyBooster too expensive', setup: (h) => h.profile.spendCoins(100), act: (p) => p.buyBooster('shuffle') },
    { name: 'grant([])', act: (p) => p.grant([]) },
    { name: 'grant lives when full', act: (p) => p.grant([{ kind: 'lives' }, { kind: 'lives', amount: 2 }]) },
    { name: 'grant junk only', act: (p) => p.grant([{ kind: 'coins', amount: 0 }, { kind: 'booster', id: 'x' as BoosterId, amount: 1 }]) },
    { name: 'recordWin out of range', act: (p) => p.recordWin(121, 3, 1000, 1) },
    { name: 'claimDaily twice', setup: (h) => h.profile.claimDaily(), act: (p) => p.claimDaily() },
    { name: 'setSetting same value', act: (p) => p.setSetting('sfx', true) },
    { name: 'setSetting invalid', act: (p) => p.setSetting('lang', 'fr' as 'en') },
    { name: 'markSeen again', setup: (h) => h.profile.markSeen('a'), act: (p) => p.markSeen('a') },
    { name: 'markSeen("")', act: (p) => p.markSeen('') },
    { name: 'every getter', act: (p) => [p.data(), p.lives(), p.coins(), p.boosterCount('prism'), p.boosterPrice('prism'), p.highestUnlocked(), p.record(1), p.totalStars(), p.daily(), p.settings(), p.hasSeen('a')] },
  ];

  it.each(CHANGES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const h = harness();
    if (c.setup) c.setup(h);
    const before = JSON.stringify(h.profile.data());
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    const order: string[] = [];
    h.profile.subscribe(() => order.push(h.storage.json === JSON.stringify(h.profile.data()) ? 'saved-first' : 'NOT-saved'));
    c.act(h.profile);
    expect(JSON.stringify(h.profile.data())).not.toBe(before);
    expect(h.storage.writes - writes).toBe(1);
    expect(h.notifications.count - notes).toBe(1);
    expect(order).toEqual(['saved-first']);
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
    // And the stored state is what a restart shows.
    expect(JSON.stringify(h.restart().profile.data())).toBe(JSON.stringify(h.profile.data()));
  });

  it.each(NO_OPS.map((c) => [c.name, c] as const))('nothing for: %s', (_name, c) => {
    const h = harness();
    if (c.setup) c.setup(h);
    const before = JSON.stringify(h.profile.data());
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    c.act(h.profile);
    expect(JSON.stringify(h.profile.data())).toBe(before);
    expect(h.storage.writes - writes).toBe(0);
    expect(h.notifications.count - notes).toBe(0);
  });

  it('the list above covers every method of the API', () => {
    const covered = (CHANGES.concat(NO_OPS).map((c) => c.act.toString()).join(' ').match(/p\.(\w+)\(/g) || []).map((m) => m.slice(2, -1));
    const api = Object.keys(harness().profile).filter((name) => name !== 'subscribe');
    expect(api.filter((name) => covered.indexOf(name) < 0)).toEqual([]);
  });
});

// ───────────────────────────── progress ─────────────────────────────

describe('hardening: progress', () => {
  it('replays and star upgrades pay exactly the design, for every pair of results', () => {
    for (const first of [1, 2, 3] as const) {
      for (const second of [1, 2, 3] as const) {
        for (const third of [1, 2, 3] as const) {
          const h = harness();
          const a = h.profile.recordWin(7, first, 1000, 1);
          expect(a).toEqual({ firstClear: true, newStars: first, coinsEarned: 20 + 10 * first, newBest: true });
          const b = h.profile.recordWin(7, second, 900, 1);
          const gainB = Math.max(0, second - first);
          expect(b).toEqual({ firstClear: false, newStars: gainB, coinsEarned: 10 * gainB, newBest: false });
          const bestStars = Math.max(first, second);
          const c = h.profile.recordWin(7, third, 1001, 1);
          const gainC = Math.max(0, third - bestStars);
          expect(c).toEqual({ firstClear: false, newStars: gainC, coinsEarned: 10 * gainC, newBest: true });
          const stars = Math.max(first, second, third);
          expect(h.profile.record(7)).toEqual({ stars, best: 1001 });
          // However the stars were collected, the level paid 20 + 10 per star in total.
          expect(h.profile.coins()).toBe(150 + 20 + 10 * stars);
          expect(h.profile.totalStars()).toBe(stars);
          expect(h.profile.data().stats).toMatchObject({ won: 3, totalScore: 2901 });
        }
      }
    }
  });

  it('a level can never pay more than 50 coins in total, however often it is replayed', () => {
    const random = rng(3);
    const h = harness({ levelCount: 10 });
    let paid = 0;
    for (let i = 0; i < 2000; i++) {
      const level = 1 + Math.floor(random() * 10);
      paid += h.profile.recordWin(level, (1 + Math.floor(random() * 3)) as 1 | 2 | 3, Math.floor(random() * 5000), 0).coinsEarned;
    }
    expect(paid).toBe(10 * 50);
    expect(h.profile.coins()).toBe(150 + 500);
    expect(h.profile.totalStars()).toBe(30);
  });

  it('level ids outside the game are refused without a trace', () => {
    const h = harness({ levelCount: 12 });
    const before = JSON.stringify(h.profile.data());
    const bad: unknown[] = [0, -1, -12, 13, 14, 120, 1e9, 2 ** 53, 1.5, 0.9999, 12.0000001, NaN, Infinity, -Infinity, '1', '12', '', null, undefined, true, [1], { valueOf: () => 1 }, 1n];
    for (const id of bad) {
      const summary = h.profile.recordWin(id as number, 3, 5000, 4);
      expect(summary, String(id)).toEqual({ firstClear: false, newStars: 0, coinsEarned: 0, newBest: false });
      expect(h.profile.record(id as number), String(id)).toBeNull();
    }
    expect(JSON.stringify(h.profile.data())).toBe(before);
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
    expect(h.profile.highestUnlocked()).toBe(1);
    // The boundaries themselves are fine.
    expect(h.profile.recordWin(1, 1, 10, 0).firstClear).toBe(true);
    expect(h.profile.recordWin(12, 1, 10, 0).firstClear).toBe(true);
    expect(Object.keys(h.profile.data().levels).sort()).toEqual(['1', '12']);
  });

  it('highestUnlocked: starts at 1, follows the highest cleared level, stops at the last level', () => {
    const h = harness({ levelCount: 6 });
    expect(h.profile.highestUnlocked()).toBe(1);
    h.profile.recordWin(1, 1, 10, 0);
    expect(h.profile.highestUnlocked()).toBe(2);
    h.profile.recordWin(1, 3, 99, 0); // replay with more stars
    h.profile.recordWin(1, 1, 5, 0); // replay with fewer
    expect(h.profile.highestUnlocked()).toBe(2);
    h.profile.recordWin(2, 2, 10, 0);
    h.profile.recordWin(3, 2, 10, 0);
    expect(h.profile.highestUnlocked()).toBe(4);
    h.profile.recordWin(2, 3, 10, 0); // replaying an earlier level
    expect(h.profile.highestUnlocked()).toBe(4);
    h.profile.recordWin(4, 1, 10, 0);
    h.profile.recordWin(5, 1, 10, 0);
    expect(h.profile.highestUnlocked()).toBe(6);
    h.profile.recordWin(6, 1, 10, 0);
    expect(h.profile.highestUnlocked()).toBe(6); // nothing beyond the last level
    h.profile.recordWin(7, 3, 10, 0);
    expect(h.profile.highestUnlocked()).toBe(6);
    expect(h.restart().profile.highestUnlocked()).toBe(6);
    expect(h.profile.totalStars()).toBe(3 + 3 + 2 + 1 + 1 + 1);
  });

  it('highestUnlocked with a save from a bigger or damaged game', () => {
    const levels: Record<string, { stars: number; best: number }> = {};
    for (const id of [1, 2, 3, 9, 50, 119, 120, 121, 500]) levels[String(id)] = { stars: 3, best: 1 };
    // 120 levels: 121 and 500 do not exist — they neither unlock nor count.
    const full = fromSave({ ...sampleSave(), levels });
    expect(full.profile.highestUnlocked()).toBe(120);
    expect(full.profile.totalStars()).toBe(7 * 3);
    // A smaller game (e.g. a demo build with 8 levels) only sees what it has.
    const demo = fromSave({ ...sampleSave(), levels }, { levelCount: 8 });
    expect(demo.profile.highestUnlocked()).toBe(4);
    expect(demo.profile.totalStars()).toBe(9);
    // The records it cannot use survive untouched for the full game.
    demo.profile.addCoins(1);
    expect(Object.keys(demo.saved().levels)).toHaveLength(9);
    // Gaps (a damaged save) unlock up to the highest cleared level + 1; a replay of a gap pays a first clear.
    const gaps = fromSave({ ...sampleSave(), levels: { '5': { stars: 1, best: 1 } } });
    expect(gaps.profile.highestUnlocked()).toBe(6);
    expect(gaps.profile.recordWin(2, 2, 10, 0)).toMatchObject({ firstClear: true, coinsEarned: 40 });
    expect(gaps.profile.highestUnlocked()).toBe(6);
  });

  it('odd level counts never break highestUnlocked', () => {
    for (const levelCount of [0, -5, NaN, Infinity, 1.9, '120' as unknown as number, undefined as unknown as number]) {
      const h = harness({ levelCount });
      expect(h.profile.highestUnlocked()).toBeGreaterThanOrEqual(1);
      h.profile.recordWin(1, 3, 10, 0);
      const top = h.profile.highestUnlocked();
      expect(Number.isInteger(top) && top >= 1, String(levelCount)).toBe(true);
    }
  });

  it('wins keep the statistics whole numbers, whatever score and cascade are reported', () => {
    const h = harness();
    for (const [score, cascade] of [[1234.9, 3.7], [-50, -2], [NaN, NaN], [Infinity, Infinity], ['9' as unknown as number, null as unknown as number], [1e300, 1e300]] as [number, number][]) {
      h.profile.recordWin(1, 3, score, cascade);
    }
    const stats = h.profile.data().stats;
    for (const value of Object.values(stats)) expect(Number.isSafeInteger(value) && value >= 0).toBe(true);
    expect(stats.won).toBe(6);
    const rec = h.profile.record(1)!;
    expect(Number.isSafeInteger(rec.best) && rec.best >= 0).toBe(true);
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
  });
});

// ───────────────────────────── reset ─────────────────────────────

describe('hardening: reset', () => {
  function played(lang: 'en' | 'ar' | null): Harness {
    const h = harness();
    const p = h.profile;
    p.setSetting('lang', 'en');
    p.setSetting('lang', lang);
    p.addCoins(5000);
    for (let level = 1; level <= 30; level++) p.recordWin(level, 3, 4000, 5);
    for (const id of IDS) p.buyBooster(id);
    p.loseLife();
    p.loseLife();
    p.claimDaily();
    h.clock.now += DAY;
    p.claimDaily();
    p.markSeen('tut.swap');
    p.recordAttempt();
    h.clock.now += 3 * MINUTE;
    return h;
  }

  it.each([['ar'], ['en'], [null]] as const)('keeps the language (%s) and wipes the progress', (lang) => {
    const h = played(lang);
    const fresh = harness({ now: h.clock.now }).profile;
    h.profile.reset();
    expect(h.profile.settings().lang).toBe(lang);
    expect(h.saved().settings.lang).toBe(lang);
    // Everything except the settings equals a brand-new profile…
    const after = JSON.parse(JSON.stringify(h.profile.data())) as Record<string, unknown>;
    const brandNew = JSON.parse(JSON.stringify(fresh.data())) as Record<string, unknown>;
    delete after.settings;
    delete brandNew.settings;
    expect(after).toEqual(brandNew);
    // …and it behaves like one.
    expect(h.profile.coins()).toBe(150);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.profile.highestUnlocked()).toBe(1);
    expect(h.profile.totalStars()).toBe(0);
    expect(h.profile.record(1)).toBeNull();
    expect(h.profile.hasSeen('tut.swap')).toBe(false);
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
    for (const id of IDS) expect(h.profile.boosterCount(id)).toBe(START[id]);
    // After a restart too: the wipe reached storage.
    const again = h.restart().profile;
    expect(again.settings().lang).toBe(lang);
    expect(again.coins()).toBe(150);
    expect(again.highestUnlocked()).toBe(1);
  });

  it('a reset profile earns first-clear rewards again and its lives timer starts clean', () => {
    const h = played('ar');
    h.profile.reset();
    expect(h.profile.recordWin(1, 3, 100, 0)).toEqual({ firstClear: true, newStars: 3, coinsEarned: 50, newBest: true });
    expect(h.profile.loseLife()).toBe(true);
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 20 * MINUTE });
  });

  it('resetting twice, or resetting a new profile, stays consistent (and is stored once each time)', () => {
    const h = harness();
    h.profile.reset(); // nothing to wipe, but an explicit reset is always written and announced
    expect(h.storage.writes).toBe(1);
    expect(h.notifications.count).toBe(1);
    h.profile.setSetting('lang', 'ar');
    h.profile.reset();
    h.profile.reset();
    expect(h.storage.writes).toBe(4);
    expect(h.notifications.count).toBe(4);
    expect(h.profile.settings().lang).toBe('ar');
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
    expect(h.restart().profile.settings().lang).toBe('ar');
  });
});
