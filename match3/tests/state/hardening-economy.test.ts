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
import { describe, expect, it, vi } from 'vitest';
import { createProfile } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { BoosterId, Reward, SaveData } from '../../src/state/types.ts';
import { DAY, MINUTE, T0, fromSave, harness, rng, sampleSave } from './harness.ts';
import type { Harness } from './harness.ts';

// Thousands of cases per test: quick on an idle machine, but allow for a busy one.
vi.setConfig({ testTimeout: 60_000 });

const IDS: BoosterId[] = ['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'];
const PRICE: Record<string, number> = { hammer: 650, freeSwap: 600, shuffle: 400, extraMoves: 500, prism: 800, beamNova: 650 };
const START: Record<string, number> = { hammer: 0, freeSwap: 0, shuffle: 0, extraMoves: 0, prism: 0, beamNova: 0 };
const COIN_CAP = 999_999_999;
const BOOSTER_CAP = 9_999;

// ───────────────────────────── ledger model ─────────────────────────────

class Ledger {
  coins = 2000;
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
  0, -0, 1, 2, 5, 59, 399, 400, 401, 650, 799, 800, 899, 900, 2000, 15_000, 0.1, 0.99, 1.5, 399.01, -1, -0.5, -150, -1e9,
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

/** Cheap in a hot loop: an assertion is only built when the values differ. */
function same<T>(actual: T, expected: T, where: string): void {
  if (actual !== expected) expect(actual, where).toBe(expected);
}

function expectLedger(h: Harness, ledger: Ledger, where: string): void {
  const p = h.profile;
  same(p.coins(), ledger.coins, where + ' coins');
  for (const id of IDS) same(p.boosterCount(id), ledger.boosters[id]!, where + ' ' + id);
  const data = p.data();
  same(Number.isInteger(data.coins) && data.coins >= 0 && data.coins <= COIN_CAP, true, where + ' coins are a whole number in range');
  same(Object.keys(data.boosters).sort().join(), IDS.slice().sort().join(), where + ' booster ids');
  for (const id of IDS) same(Number.isInteger(data.boosters[id]) && data.boosters[id] >= 0 && data.boosters[id] <= BOOSTER_CAP, true, where + ' ' + id + ' in range');
}

describe('hardening: the economy against a ledger model', () => {
  it('matches to the unit over 20 random histories with hostile arguments', () => {
    let refusedSpends = 0;
    let refusedBuys = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const random = rng(seed * 7919);
      let h = harness();
      const ledger = new Ledger();
      for (let step = 0; step < 1200; step++) {
        const where = `seed ${seed}, step ${step}`;
        const writes = h.storage.writes;
        const notes = h.notifications.count;
        let changed: boolean;
        const roll = random();
        const p = h.profile as unknown as Record<string, (...args: unknown[]) => unknown>;
        if (roll < 0.16) {
          const n = pick(random, ODD_NUMBERS);
          changed = ledger.add(n)[1];
          same(p.addCoins!(n), undefined, where);
        } else if (roll < 0.38) {
          const n = random() < 0.5 ? pick(random, ODD_NUMBERS) : Math.floor(random() * 2500);
          const [ok, did] = ledger.spend(n);
          changed = did;
          same(p.spendCoins!(n), ok, where + ' spendCoins');
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
          same(p.takeBooster!(id), ok, where + ' takeBooster');
        } else if (roll < 0.84) {
          const id = pick(random, ODD_IDS);
          const [ok, did] = ledger.buy(id);
          changed = did;
          same(p.buyBooster!(id), ok, where + ' buyBooster');
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
        same(h.storage.writes - writes, changed ? 1 : 0, where + ': stored');
        same(h.notifications.count - notes, changed ? 1 : 0, where + ': announced');
        if (changed && step % 7 === 0) same(h.saved().coins, ledger.coins, where + ': what is stored');
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
    const h = fromSave({ ...sampleSave(), coins: 899, lives: 2, lifeTimer: T0 });
    expect(h.profile.refillLives()).toBe(false);
    expect(h.profile.coins()).toBe(899);
    expect(h.profile.lives().count).toBe(2);
    h.profile.addCoins(1);
    expect(h.profile.refillLives()).toBe(true);
    expect(h.profile.coins()).toBe(0);
    expect(h.profile.lives().count).toBe(5);
    // The continue prices are charged through spendCoins: 900, then 1,900, then 2,900 — all or nothing.
    const c = fromSave({ ...sampleSave(), coins: 900 + 1900 + 2899 });
    expect([0, 1, 2, 3].map((n) => c.profile.continuePrice(n))).toEqual([900, 1900, 2900, null]);
    expect(c.profile.spendCoins(c.profile.continuePrice(0)!)).toBe(true);
    expect(c.profile.spendCoins(c.profile.continuePrice(1)!)).toBe(true);
    expect(c.profile.spendCoins(c.profile.continuePrice(2)!)).toBe(false);
    expect(c.profile.coins()).toBe(2899);
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
    profile.addCoins(8000); // 10,000 coins
    const random = rng(8);
    for (let i = 0; i < 400; i++) profile.buyBooster(IDS[Math.floor(random() * IDS.length)]!);
    expect(snapshots.length).toBeGreaterThan(10);
    for (const total of snapshots) expect(total).toBe(10_000);
    expect(profile.coins()).toBeLessThan(400); // everything affordable was bought
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
    expect(worth(profile.data())).toBe(3000 - 30);
    expect(profile.boosterCount('prism')).toBe(1);
    expect(profile.lastSaveOk()).toBe(false);
    // Storage still holds the last complete state; the next successful save brings it up to date.
    expect(worth(JSON.parse(storage.json!) as SaveData)).toBe(3000);
    failing = false;
    profile.addCoins(1);
    expect(profile.lastSaveOk()).toBe(true);
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
      if (reentered < 3 && h.profile.coins() >= 400) {
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
    expect(h.profile.coins()).toBe(2850 - 650 - 3 * 400);
    expect(h.profile.boosterCount('hammer')).toBe(1);
    expect(h.profile.boosterCount('shuffle')).toBe(3);
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
  });

  it('things that are not functions cannot be subscribed, and unsubscribing twice is harmless', () => {
    const h = harness();
    const errors = console.error;
    const logged: unknown[] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const offs = [undefined, null, 5, 'listener', {}, []].map((junk) => h.profile.subscribe(junk as unknown as () => void));
      h.profile.addCoins(1);
      h.profile.buyBooster('shuffle');
      for (const off of offs) {
        expect(typeof off).toBe('function');
        off();
        off();
      }
    } finally {
      console.error = errors;
    }
    expect(logged).toEqual([]); // nothing was called, so nothing failed
    expect(h.notifications.count).toBe(2);
    let calls = 0;
    const off = h.profile.subscribe(() => (calls += 1));
    h.profile.addCoins(1);
    off();
    off();
    h.profile.addCoins(1);
    expect(calls).toBe(1);
    expect(h.notifications.count).toBe(4); // the harness' own listener was not removed by the double call
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
    expect(h.profile.coins()).toBe(2000);
    expect(h.profile.boosterCount('shuffle')).toBe(0);
    expect(h.saved()).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
  });
});

// ───────────────────────────── exactly once ─────────────────────────────

describe('hardening: every mutation is stored once and announced once', () => {
  interface Case {
    name: string;
    setup?: (h: Harness) => void;
    act: (p: FullProfile) => unknown;
  }

  const CHANGES: Case[] = [
    { name: 'loseLife', act: (p) => p.loseLife() },
    { name: 'loseLife (last life)', setup: (h) => { for (let i = 0; i < 4; i++) h.profile.loseLife(); }, act: (p) => p.loseLife() },
    { name: 'refillLives', setup: (h) => h.profile.loseLife(), act: (p) => p.refillLives() },
    { name: 'addCoins', act: (p) => p.addCoins(1) },
    { name: 'spendCoins', act: (p) => p.spendCoins(150) },
    { name: 'spendCoins (fraction)', act: (p) => p.spendCoins(0.2) },
    { name: 'addBooster', act: (p) => p.addBooster('prism', 2) },
    { name: 'takeBooster', setup: (h) => h.profile.addBooster('prism', 1), act: (p) => p.takeBooster('prism') },
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
    { name: 'loseLife (no life left, but a Caravan to send home)', setup: (h) => { for (let i = 0; i < 5; i++) h.profile.loseLife(); for (let id = 1; id <= 20; id++) h.profile.recordWin(id, 1, 10, 0); }, act: (p) => p.loseLife() },
    { name: 'claimUnlocks', setup: (h) => { for (let id = 1; id <= 7; id++) h.profile.recordWin(id, 1, 10, 0); }, act: (p) => p.claimUnlocks() },
    { name: 'addLife', setup: (h) => h.profile.loseLife(), act: (p) => p.addLife() },
    { name: 'grantPurchase', act: (p) => p.grantPurchase('token-1', [{ kind: 'coins', amount: 1000 }, { kind: 'booster', id: 'hammer', amount: 3 }], 'starter_pack') },
    { name: 'grantPurchase (nothing to add but the record)', act: (p) => p.grantPurchase('token-2', [], 'remove_ads') },
    { name: 'setEntitlement (own)', act: (p) => p.setEntitlement('remove_ads', true) },
    { name: 'setEntitlement (clear)', setup: (h) => h.profile.setEntitlement('remove_ads', true), act: (p) => p.setEntitlement('remove_ads', false) },
    { name: 'noteRewarded (earned)', act: (p) => p.noteRewarded('freeCoins', true) },
    { name: 'noteRewarded (closed early)', act: (p) => p.noteRewarded('freeLife', false) },
    { name: 'noteInterstitial', act: (p) => p.noteInterstitial() },
    { name: 'noteLevelFinished', act: (p) => p.noteLevelFinished() },
  ];

  const NO_OPS: Case[] = [
    { name: 'loseLife without lives', setup: (h) => { for (let i = 0; i < 5; i++) h.profile.loseLife(); }, act: (p) => p.loseLife() },
    { name: 'refillLives when full', act: (p) => p.refillLives() },
    { name: 'refillLives without coins', setup: (h) => { h.profile.loseLife(); h.profile.spendCoins(1101); }, act: (p) => p.refillLives() },
    { name: 'addCoins(0)', act: (p) => p.addCoins(0) },
    { name: 'addCoins(-5)', act: (p) => p.addCoins(-5) },
    { name: 'spendCoins(0)', act: (p) => p.spendCoins(0) },
    { name: 'spendCoins too much', act: (p) => p.spendCoins(2001) },
    { name: 'spendCoins(-1)', act: (p) => p.spendCoins(-1) },
    { name: 'addBooster(0)', act: (p) => p.addBooster('prism', 0) },
    { name: 'addBooster unknown', act: (p) => p.addBooster('wand' as BoosterId, 1) },
    { name: 'takeBooster empty', act: (p) => p.takeBooster('prism') },
    { name: 'buyBooster too expensive', setup: (h) => h.profile.spendCoins(1601), act: (p) => p.buyBooster('shuffle') },
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
    { name: 'every getter of the extensions', act: (p) => [p.boosterUnlocked('prism'), p.featureUnlocked('daily'), p.featureUnlocked('shop'), p.caravan(), p.caravanBoosters(), p.continuePrice(0), p.shop(), p.lastSaveOk(), p.purchaseGranted('token-1'), p.purchaseSaved('token-1'), p.adsToday(), p.daysSinceFirstPlay()] },
    { name: 'claimUnlocks with nothing new', act: (p) => p.claimUnlocks() },
    { name: 'claimUnlocks twice', setup: (h) => { for (let id = 1; id <= 7; id++) h.profile.recordWin(id, 1, 10, 0); h.profile.claimUnlocks(); }, act: (p) => p.claimUnlocks() },
    { name: 'addLife when full', act: (p) => p.addLife() },
    { name: 'grantPurchase with a token already granted', setup: (h) => h.profile.grantPurchase('token-1', [{ kind: 'coins', amount: 1000 }]), act: (p) => p.grantPurchase('token-1', [{ kind: 'coins', amount: 1000 }], 'starter_pack') },
    { name: 'grantPurchase without a usable token', act: (p) => [p.grantPurchase('', [{ kind: 'coins', amount: 1000 }]), p.grantPurchase(null as unknown as string, [{ kind: 'coins', amount: 1000 }]), p.grantPurchase('x'.repeat(5000), [{ kind: 'coins', amount: 1000 }])] },
    { name: 'setEntitlement already owned', setup: (h) => h.profile.setEntitlement('remove_ads', true), act: (p) => p.setEntitlement('remove_ads', true) },
    { name: 'setEntitlement clearing what is not owned', act: (p) => p.setEntitlement('remove_ads', false) },
    { name: 'setEntitlement with a bad id', act: (p) => [p.setEntitlement('', true), p.setEntitlement('Remove Ads', true), p.setEntitlement(null as unknown as string, true)] },
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
          expect(h.profile.coins()).toBe(2000 + 20 + 10 * stars);
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
    expect(h.profile.coins()).toBe(2000 + 500);
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
    // (…and the day the player first played, which is not progress: a brand-new profile has none yet.)
    expect(after.firstDay).toBe(Math.floor(T0 / DAY));
    expect(brandNew.firstDay).toBe(-1);
    delete after.firstDay;
    delete brandNew.firstDay;
    expect(after).toEqual(brandNew);
    // …and it behaves like one.
    expect(h.profile.coins()).toBe(2000);
    expect(h.profile.caravan()).toBe(0);
    expect(h.profile.claimUnlocks()).toEqual([]);
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
    expect(again.coins()).toBe(2000);
    expect(again.highestUnlocked()).toBe(1);
  });

  it('a reset profile earns first-clear rewards again and its lives timer starts clean', () => {
    const h = played('ar');
    h.profile.reset();
    expect(h.profile.recordWin(1, 3, 100, 0)).toEqual({ firstClear: true, newStars: 3, coinsEarned: 50, newBest: true });
    expect(h.profile.loseLife()).toBe(true);
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 30 * MINUTE });
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

// ───────────────────────────── the list of seen ids ─────────────────────────────

describe('hardening: markSeen', () => {
  it('always remembers the id it was just given, even when the list is full', () => {
    const h = harness();
    for (let i = 0; i < 2500; i++) {
      h.profile.markSeen('id-' + i);
      expect(h.profile.hasSeen('id-' + i)).toBe(true);
    }
    const seen = h.profile.data().seen;
    expect(seen.length).toBe(2000);
    expect(seen[0]).toBe('id-500'); // the oldest were forgotten, in order
    expect(seen[1999]).toBe('id-2499');
    expect(h.profile.hasSeen('id-0')).toBe(false);
    expect(h.storage.writes).toBe(2500);
    expect(h.notifications.count).toBe(2500);
    // The same list comes back after a restart, and a re-marked old id is simply new again.
    const again = h.restart();
    expect(again.profile.data().seen).toEqual(seen);
    again.profile.markSeen('id-0');
    expect(again.profile.hasSeen('id-0')).toBe(true);
    expect(again.profile.hasSeen('id-500')).toBe(false);
    expect(again.profile.data().seen.length).toBe(2000);
  });

  it('the list is also bounded in total size, forgetting the oldest ids first', () => {
    const h = harness();
    const big = (i: number): string => ('big-' + i + '-').padEnd(1024, 'x');
    for (let i = 0; i < 200; i++) {
      h.profile.markSeen(big(i));
      expect(h.profile.hasSeen(big(i))).toBe(true);
    }
    const seen = h.profile.data().seen;
    const chars = seen.reduce((sum, id) => sum + id.length, 0);
    expect(chars).toBeLessThanOrEqual(60_000);
    expect(seen.length).toBe(58); // 58 × 1024 ≤ 60,000 < 59 × 1024
    expect(seen[seen.length - 1]).toBe(big(199));
    expect(seen[0]).toBe(big(142));
    // A small id fits into the room that is left: nothing is forgotten for it…
    h.profile.markSeen('tut.swap');
    expect(h.profile.data().seen.length).toBe(59);
    expect(h.profile.hasSeen(big(142))).toBe(true);
    // …and another big one pushes out exactly the oldest.
    h.profile.markSeen(big(200));
    expect(h.profile.data().seen.length).toBe(59);
    expect(h.profile.hasSeen(big(142))).toBe(false);
    expect(h.profile.hasSeen(big(143))).toBe(true);
    expect(h.profile.hasSeen('tut.swap')).toBe(true);
    // A restart keeps exactly this list, and a damaged save with too much in it is trimmed the same way.
    expect(h.restart().profile.data().seen).toEqual(h.profile.data().seen);
    const flooded = fromSave({ ...sampleSave(), seen: Array.from({ length: 400 }, (_, i) => big(i)) });
    expect(flooded.profile.data().seen.length).toBe(58);
    expect(flooded.profile.data().seen[57]).toBe(big(399));
  });

  it('the biggest save the profile can ever write stays far below one megabyte', () => {
    // Everything at its limit at once, with ids made of characters JSON must escape (6 bytes each).
    const levels: Record<string, { stars: number; best: number }> = {};
    for (let id = 1; id <= 20_000; id++) levels[String(id)] = { stars: 3, best: 1e15 };
    const h = fromSave({
      version: 1,
      levels,
      coins: 1e300,
      lives: 0,
      lifeTimer: 8.64e15,
      boosters: { hammer: 1e300, freeSwap: 1e300, shuffle: 1e300, extraMoves: 1e300, prism: 1e300, beamNova: 1e300 },
      settings: { sfx: false, music: false, haptics: false, lang: 'ar' },
      dailyDay: 1e300,
      dailyStreak: 1e300,
      seen: Array.from({ length: 300 }, (_, i) => String(i).padEnd(1024, '\u0000')),
      stats: { played: 1e300, won: 1e300, bestCascade: 1e300, totalScore: 1e300 },
      firstDay: 1e300,
      gifted: ['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'],
      caravan: 1e300,
      shop: {
        tokens: Array.from({ length: 500 }, (_, i) => String(i).padEnd(64, '\u0000')),
        owned: Array.from({ length: 50 }, (_, i) => 'entitlement_' + i),
        purchased: true,
        adDay: 1e300,
        rewarded: { extraMoves: 1e300, freeLife: 1e300, freeCoins: 1e300, doubleReward: 1e300 },
        interstitials: 1e300,
        finished: 1e300,
        lastInterstitial: 1e300,
        lastRewarded: 1e300,
      },
    });
    expect(h.profile.shop().tokens.length).toBe(200);
    expect(h.profile.shop().owned.length).toBe(16);
    for (let i = 0; i < 100; i++) h.profile.markSeen('\u0001'.repeat(1000) + i);
    h.profile.recordAttempt();
    const bytes = Buffer.byteLength(h.storage.json!, 'utf8');
    expect(bytes).toBeGreaterThan(300_000); // the test really is near the limits
    expect(bytes).toBeLessThan(900_000);
    expect(h.storage.json!.length).toBeLessThan(900_000);
    // …while an ordinary finished game is tiny.
    const real = harness();
    for (let level = 1; level <= 120; level++) real.profile.recordWin(level, 3, 99_999, 9);
    for (let i = 0; i < 60; i++) real.profile.markSeen('tutorial.step.' + i);
    expect(Buffer.byteLength(real.storage.json!, 'utf8')).toBeLessThan(8_000);
  });

  it('ids are plain text: nothing in them is special', () => {
    const h = harness();
    const ids = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'length', '0', ' ', 'a b', 'نصيحة', '💎', 'x'.repeat(1024)];
    for (const id of ids) {
      expect(h.profile.hasSeen(id)).toBe(false);
      h.profile.markSeen(id);
      expect(h.profile.hasSeen(id)).toBe(true);
    }
    expect(h.restart().profile.data().seen).toEqual(ids);
    for (const bad of ['', 'x'.repeat(1025), null, undefined, 5, {}, ['a'], true]) {
      h.profile.markSeen(bad as string);
      expect(h.profile.hasSeen(bad as string)).toBe(false);
    }
    expect(h.profile.data().seen).toEqual(ids);
  });
});
