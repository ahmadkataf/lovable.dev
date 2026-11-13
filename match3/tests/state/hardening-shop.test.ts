/**
 * Hardening of the profile's newer parts against docs/DESIGN.md §5 and §7, number by number, and of
 * the bookkeeping real money depends on:
 *
 *  - `purchaseSaved`: "is this grant in storage?" answered by reading storage back, under every
 *    kind of failing storage — the one question that decides whether a purchase may be finished;
 *  - the Caravan against a tiny model, over random runs of wins, replays and lost lives;
 *  - the daily reward's substitution for locked boosters at every level, and its unlock on the
 *    second local calendar day in any time zone;
 *  - reset(): progress goes, everything about real money and ads stays;
 *  - the design's numbers, restated here without importing a single one of them.
 */
import { describe, expect, it } from 'vitest';
import { createProfile, fixedOffsetDayNumber, freshSave, parseSave, purchaseKey } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { BoosterId, Reward, SaveData } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, T0, fromSave, harness, progressSave, rng } from './harness.ts';

// ───────────────────────────── the design's numbers, restated ─────────────────────────────

describe('DESIGN §5, number by number', () => {
  it('lives, coins, level rewards, the continue ladder', () => {
    const h = harness({ isHardLevel: (id) => id === 3 });
    const p = h.profile;
    expect(p.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(p.coins()).toBe(2000);
    for (const id of ['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'] as BoosterId[]) expect(p.boosterCount(id)).toBe(0);
    // first clear: 20 + 10 per star; replays: 10 per newly gained star; hard levels pay double
    expect(p.recordWin(1, 1, 100, 1).coinsEarned).toBe(30);
    expect(p.recordWin(1, 3, 100, 1).coinsEarned).toBe(20);
    expect(p.recordWin(1, 3, 100, 1).coinsEarned).toBe(0);
    expect(p.recordWin(2, 3, 100, 1).coinsEarned).toBe(50);
    expect(p.recordWin(3, 2, 100, 1).coinsEarned).toBe(80);
    expect(p.recordWin(3, 3, 100, 1).coinsEarned).toBe(10);
    expect(p.coins()).toBe(2000 + 30 + 20 + 50 + 80 + 10);
    // one life every 30 minutes; refill for 900
    p.loseLife();
    expect(p.lives().nextInMs).toBe(30 * MINUTE);
    h.clock.now += 30 * MINUTE - 1;
    expect(p.lives().count).toBe(4);
    h.clock.now += 1;
    expect(p.lives().count).toBe(5);
    p.loseLife();
    const coins = p.coins();
    expect(p.refillLives()).toBe(true);
    expect(p.coins()).toBe(coins - 900);
    // continue: 900, 1,900, 2,900, then no more
    expect([0, 1, 2, 3, 4].map((n) => p.continuePrice(n))).toEqual([900, 1900, 2900, null, null]);
  });

  it('booster prices, unlock levels and introduction gifts', () => {
    const price: Record<BoosterId, number> = { hammer: 650, freeSwap: 600, shuffle: 400, extraMoves: 500, prism: 800, beamNova: 650 };
    const unlock: [BoosterId, number, number][] = [
      ['beamNova', 7, 2],
      ['hammer', 8, 3],
      ['freeSwap', 12, 3],
      ['prism', 14, 2],
      ['shuffle', 16, 3],
      ['extraMoves', 19, 2],
    ];
    const fresh = harness().profile;
    for (const id of Object.keys(price) as BoosterId[]) expect(fresh.boosterPrice(id)).toBe(price[id]);
    for (const [id, level, gift] of unlock) {
      const before = harness({ cleared: level - 2 }).profile; // has reached level − 1
      expect(before.boosterUnlocked(id), id + ' before L' + level).toBe(false);
      expect(before.claimUnlocks().some((g) => g.id === id)).toBe(false);
      const at = harness({ cleared: level - 1 }).profile; // has reached the level
      expect(at.boosterUnlocked(id), id + ' at L' + level).toBe(true);
      expect(at.claimUnlocks().filter((g) => g.id === id)).toEqual([{ id, amount: gift }]);
      expect(at.boosterCount(id)).toBe(gift);
      expect(at.claimUnlocks()).toEqual([]);
    }
  });

  it('feature gates: lives L6, shop L10, rewarded ads L11, Caravan L20', () => {
    const gates: ['lives' | 'shop' | 'rewardedAds' | 'caravan', number][] = [
      ['lives', 6],
      ['shop', 10],
      ['rewardedAds', 11],
      ['caravan', 20],
    ];
    for (const [feature, level] of gates) {
      expect(harness({ cleared: level - 2 }).profile.featureUnlocked(feature), feature).toBe(false);
      expect(harness({ cleared: level - 1 }).profile.featureUnlocked(feature), feature).toBe(true);
    }
  });

  it('the daily cycle: 100 · hammer · 150 · shuffle + freeSwap · 200 · beamNova · 500 + prism', () => {
    const cycle = harness({ cleared: 30 }).profile.daily().cycle;
    expect(cycle).toEqual([
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
  });
});

// ───────────────────────────── daily reward: locked boosters, second day ─────────────────────────────

describe('daily reward', () => {
  /** DESIGN §5 once more: what each cycle day pays to a player who has reached `level`. */
  function expected(level: number): { coins: number; boosters: Partial<Record<BoosterId, number>> }[] {
    const unlockedAt: Record<string, number> = { beamNova: 7, hammer: 8, freeSwap: 12, prism: 14, shuffle: 16, extraMoves: 19 };
    const days: { coins: number; boosters: BoosterId[] }[] = [
      { coins: 100, boosters: [] },
      { coins: 0, boosters: ['hammer'] },
      { coins: 150, boosters: [] },
      { coins: 0, boosters: ['shuffle', 'freeSwap'] },
      { coins: 200, boosters: [] },
      { coins: 0, boosters: ['beamNova'] },
      { coins: 500, boosters: ['prism'] },
    ];
    return days.map((d) => {
      const out = { coins: d.coins, boosters: {} as Partial<Record<BoosterId, number>> };
      for (const id of d.boosters) {
        if (level >= unlockedAt[id]!) out.boosters[id] = 1;
        else out.coins += 150; // "a reward for a booster that is still locked is given as 150 coins instead"
      }
      return out;
    });
  }

  function totals(rewards: Reward[]): { coins: number; boosters: Partial<Record<BoosterId, number>> } {
    const out = { coins: 0, boosters: {} as Partial<Record<BoosterId, number>> };
    for (const r of rewards) {
      if (r.kind === 'coins') out.coins += r.amount;
      else if (r.kind === 'booster') out.boosters[r.id] = (out.boosters[r.id] || 0) + r.amount;
      else throw new Error('a daily reward of an unexpected kind');
    }
    return out;
  }

  it('at every level 1…30: a locked booster is paid as 150 coins — shown, and really granted, exactly so', () => {
    for (let level = 1; level <= 30; level++) {
      const want = expected(level);
      const h = harness({ cleared: level - 1 });
      expect(h.profile.daily().cycle.map(totals), 'shown at level ' + level).toEqual(want);
      // claim a whole week, one day after the other, and compare what really arrives
      for (let day = 0; day < 7; day++) {
        const coins = h.profile.coins();
        const boosters = { ...h.profile.data().boosters };
        const got = h.profile.claimDaily();
        expect(got, 'level ' + level + ' day ' + (day + 1)).not.toBeNull();
        expect(totals(got!)).toEqual(want[day]);
        expect(h.profile.coins() - coins).toBe(want[day]!.coins);
        for (const id of Object.keys(boosters) as BoosterId[]) expect(h.profile.boosterCount(id) - boosters[id]).toBe(want[day]!.boosters[id] || 0);
        expect(h.profile.claimDaily()).toBeNull(); // once per local day
        h.clock.now += DAY;
      }
    }
  });

  it('is offered from the second local calendar day — in any time zone, however the first day is cut', () => {
    for (const offset of [-720, -480, -210, 0, 180, 345, 540, 840]) {
      for (const hourOfDay of [0, 1, 11, 23]) {
        // the first save happens at local time hourOfDay:30
        const localMidnight = Math.floor((T0 + offset * 60_000) / DAY) * DAY - offset * 60_000;
        const first = localMidnight + hourOfDay * HOUR + 30 * MINUTE;
        const h = harness({ now: first, utcOffsetMinutes: offset });
        expect(h.profile.featureUnlocked('daily')).toBe(false); // nothing saved yet: today is the first day
        h.profile.markSeen('first-session');
        const nextMidnight = localMidnight + DAY;
        h.clock.now = nextMidnight - 1;
        expect(h.profile.featureUnlocked('daily'), 'offset ' + offset + ' hour ' + hourOfDay).toBe(false);
        expect(h.restart().profile.featureUnlocked('daily')).toBe(false);
        h.clock.now = nextMidnight;
        expect(h.profile.featureUnlocked('daily'), 'offset ' + offset + ' hour ' + hourOfDay).toBe(true);
        expect(h.restart().profile.featureUnlocked('daily')).toBe(true);
        expect(h.profile.daysSinceFirstPlay()).toBe(1);
        h.clock.now = nextMidnight + 2 * DAY;
        expect(h.profile.daysSinceFirstPlay()).toBe(3); // the day interstitials may begin
      }
    }
  });
});

// ───────────────────────────── the Caravan against a model ─────────────────────────────

describe('the Caravan against a tiny model', () => {
  it('40 random runs of first clears, replays and lost lives', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = rng(seed);
      const cleared = Math.floor(random() * 26); // 0…25 levels already won
      const h = harness({ cleared });
      let top = cleared; // highest level won
      let caravan = 0; // the model: consecutive first clears since the last lost life, with the Caravan open
      for (let step = 0; step < 300; step++) {
        const r = random();
        if (r < 0.45 && top < 120) {
          // the next level is won for the first time
          const open = top + 1 >= 20; // "from L20": the level reached BEFORE this win
          h.profile.recordWin(top + 1, (1 + Math.floor(random() * 3)) as 1 | 2 | 3, 100, 1);
          top += 1;
          if (open) caravan += 1;
        } else if (r < 0.7 && top > 0) {
          // an old level is replayed and won: neither adds nor resets
          h.profile.recordWin(1 + Math.floor(random() * top), 3, 500, 1);
        } else if (r < 0.9) {
          h.profile.loseLife(); // failed or abandoned: the Caravan goes home, life or no life
          caravan = 0;
        } else if (r < 0.95) {
          h.clock.now += HOUR;
          h.profile.refillLives();
        } else {
          Object.assign(h, h.restart());
        }
        const shown = top + 1 >= 20 ? caravan : 0;
        expect(h.profile.caravan(), 'seed ' + seed + ' step ' + step).toBe(shown);
        expect(h.profile.caravanBoosters()).toEqual({
          ...(shown >= 1 ? { beamNova: true } : {}),
          ...(shown >= 2 ? { prism: true } : {}),
          ...(shown >= 3 ? { extraMoves: true } : {}),
        });
      }
    }
  });

  it('a damaged save cannot smuggle a Caravan in from before it unlocks', () => {
    const h = fromSave({ ...progressSave(17), caravan: 9 });
    expect(h.profile.caravan()).toBe(0);
    h.profile.recordWin(18, 1, 100, 1); // still before level 20
    expect(h.saved().caravan).toBe(0);
    h.profile.recordWin(19, 1, 100, 1); // reaches level 20: the Caravan opens, empty
    expect(h.profile.featureUnlocked('caravan')).toBe(true);
    expect(h.profile.caravan()).toBe(0);
    h.profile.recordWin(20, 1, 100, 1);
    expect(h.profile.caravan()).toBe(1);
  });
});

// ───────────────────────────── purchaseSaved ─────────────────────────────

type Mode = 'ok' | 'throws' | 'silent';

function device(): { disk: { json: string | null; mode: Mode; readFails: boolean }; start(): FullProfile } {
  const disk = { json: null as string | null, mode: 'ok' as Mode, readFails: false };
  return {
    disk,
    start: () =>
      createProfile({
        load: () => {
          if (disk.readFails) throw new Error('unreadable');
          return disk.json;
        },
        save: (json) => {
          if (disk.mode === 'throws') throw new Error('disk full');
          if (disk.mode === 'ok') disk.json = json;
        },
        now: () => T0,
        levelCount: 120,
        dayNumber: fixedOffsetDayNumber(0),
      }),
  };
}

/** Independently of the profile: is the token's key in what is on the disk? */
function onDisk(json: string | null, token: string): boolean {
  if (json === null) return false;
  const tokens = (JSON.parse(json) as SaveData).shop.tokens;
  return tokens.indexOf(purchaseKey(token)!) >= 0;
}

describe('purchaseSaved: is the grant in storage?', () => {
  const PACK: Reward[] = [{ kind: 'coins', amount: 1000 }];

  it('true only for a granted token that storage hands back', () => {
    const d = device();
    const p = d.start();
    expect(p.purchaseSaved('tok')).toBe(false); // never granted
    expect(p.grantPurchase('tok', PACK)).toBe(true);
    expect(p.purchaseSaved('tok')).toBe(true);
    expect(p.purchaseSaved('TOK')).toBe(false);
    for (const bad of ['', null, undefined, 5, {}, 'x'.repeat(5000)]) expect(p.purchaseSaved(bad as string)).toBe(false);
    // it changes nothing and writes nothing
    const before = d.disk.json;
    for (let i = 0; i < 5; i++) p.purchaseSaved('tok');
    expect(d.disk.json).toBe(before);
  });

  it('a save that was accepted and lost: lastSaveOk is fooled, purchaseSaved is not', () => {
    const d = device();
    const p = d.start();
    d.disk.mode = 'silent';
    expect(p.grantPurchase('tok', PACK)).toBe(true);
    expect(p.lastSaveOk()).toBe(true);
    expect(p.purchaseSaved('tok')).toBe(false);
    d.disk.mode = 'ok';
    expect(p.purchaseSaved('tok')).toBe(false); // nothing was written since
    p.addCoins(1);
    expect(p.purchaseSaved('tok')).toBe(true);
  });

  it('a save that threw, a storage that cannot be read back, a storage that holds something older', () => {
    const d = device();
    const p = d.start();
    p.grantPurchase('first', PACK);
    const older = d.disk.json;
    d.disk.mode = 'throws';
    p.grantPurchase('second', PACK);
    expect(p.purchaseSaved('second')).toBe(false);
    expect(p.purchaseSaved('first')).toBe(false); // the latest save failed: nothing is vouched for right now
    d.disk.mode = 'ok';
    p.addCoins(1);
    expect(p.purchaseSaved('first')).toBe(true);
    expect(p.purchaseSaved('second')).toBe(true);
    d.disk.readFails = true;
    expect(p.purchaseSaved('second')).toBe(false);
    d.disk.readFails = false;
    d.disk.json = older; // storage rolled back behind the profile's back
    expect(p.purchaseSaved('second')).toBe(false);
    expect(p.purchaseSaved('first')).toBe(true);
    for (const junk of ['', 'not json', '[]', 'null', '{"shop":{"tokens":"second"}}']) {
      d.disk.json = junk;
      expect(p.purchaseSaved('second')).toBe(false);
    }
  });

  it('storage that re-encodes the text still vouches for it — as long as the token is in there', () => {
    const d = device();
    const p = d.start();
    p.grantPurchase('tok', PACK);
    const plain = d.disk.json!;
    for (const stored of ['﻿' + plain, JSON.stringify(plain), JSON.stringify(JSON.parse(plain), null, 1), plain.replace('"coins":3000', '"coins":3000,"extra":true')]) {
      d.disk.json = stored;
      expect(p.purchaseSaved('tok')).toBe(true);
      expect(parseSave(stored).shop.tokens).toEqual(['tok']);
    }
  });

  it('60 random runs: purchaseSaved(token) ⇔ the token is on the disk, through failing disks and restarts', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = rng(seed * 31);
      const d = device();
      let p = d.start();
      const tokens: string[] = [];
      for (let step = 0; step < 200; step++) {
        const r = random();
        if (r < 0.35) {
          const token = (random() < 0.5 ? 'short-' : 'long-token-'.repeat(8)) + seed + '-' + tokens.length;
          tokens.push(token);
          p.grantPurchase(token, PACK, random() < 0.2 ? 'remove_ads' : null);
        } else if (r < 0.55) {
          d.disk.mode = (['ok', 'ok', 'throws', 'silent'] as Mode[])[Math.floor(random() * 4)]!;
        } else if (r < 0.7) {
          p.addCoins(1); // an ordinary save
        } else if (r < 0.8) {
          p = d.start(); // the app restarts: memory is what the disk had
        } else if (r < 0.85) {
          p.reset();
        }
        const failed = d.disk.mode === 'throws' && !p.lastSaveOk();
        for (const token of tokens.slice(-12)) {
          const saved = p.purchaseSaved(token);
          const there = onDisk(d.disk.json, token);
          if (saved) expect(there, 'seed ' + seed + ' step ' + step + ': vouched for a token that is not on the disk').toBe(true);
          // the other direction: on the disk, known to this profile, and the last save did not fail ⇒ vouched for
          if (there && p.purchaseGranted(token) && !failed && p.lastSaveOk()) expect(saved, 'seed ' + seed + ' step ' + step).toBe(true);
        }
      }
    }
  });
});

// ───────────────────────────── reset, entitlements, ad times ─────────────────────────────

describe('reset(): progress goes, real money and ad bookkeeping stay', () => {
  it('30 random profiles: after reset the shop section, the first-play day and the settings are untouched; the rest is new', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const random = rng(seed * 101);
      const h = harness({ cleared: Math.floor(random() * 40) });
      const p = h.profile;
      p.markSeen('tip');
      for (let i = 0; i < 1 + Math.floor(random() * 5); i++) p.grantPurchase('tok-' + seed + '-' + i, [{ kind: 'coins', amount: 1000 }], random() < 0.5 ? 'starter_pack' : null);
      if (random() < 0.5) p.setEntitlement('remove_ads', true);
      for (let i = 0; i < Math.floor(random() * 4); i++) p.noteRewarded('freeCoins', true);
      for (let i = 0; i < Math.floor(random() * 4); i++) p.noteLevelFinished();
      if (random() < 0.5) p.noteInterstitial();
      p.setSetting('music', false);
      p.claimUnlocks();
      p.loseLife();
      const shop = JSON.stringify(p.shop());
      const firstDay = p.data().firstDay;
      const ads = p.adsToday();
      p.reset();
      expect(JSON.stringify(p.shop())).toBe(shop);
      expect(p.data().firstDay).toBe(firstDay);
      expect(p.adsToday()).toEqual(ads);
      expect(p.settings().music).toBe(false);
      // …and everything else is a new game
      const fresh = freshSave();
      const now = p.data();
      expect(now.coins).toBe(fresh.coins);
      expect(now.levels).toEqual({});
      expect(now.boosters).toEqual(fresh.boosters);
      expect(now.gifted).toEqual([]);
      expect(now.caravan).toBe(0);
      expect(now.lives).toBe(5);
      expect(now.seen).toEqual([]);
      expect(p.highestUnlocked()).toBe(1);
      // the granted tokens are still refused after the reset — and after a restart
      const again = h.restart().profile;
      expect(JSON.stringify(again.shop())).toBe(shop);
      expect(again.grantPurchase('tok-' + seed + '-0', [{ kind: 'coins', amount: 1000 }])).toBe(false);
      expect(again.coins()).toBe(fresh.coins);
    }
  });
});

describe('ad times and a clock that was set back', () => {
  it('noteLevelFinished pulls an ad time that lies in the future back to now — never forwards, never without a clock', () => {
    const h = harness({ cleared: 30 });
    const p = h.profile;
    p.noteInterstitial();
    p.noteRewarded('freeCoins', false);
    expect(p.shop().lastInterstitial).toBe(T0);
    // time passes: nothing to repair
    h.clock.now = T0 + HOUR;
    expect(p.noteLevelFinished()).toBe(1);
    expect(p.shop().lastInterstitial).toBe(T0);
    expect(p.shop().lastRewarded).toBe(T0);
    // the clock is set back by a day: both times are ahead of it now
    h.clock.now = T0 - DAY;
    expect(p.noteLevelFinished()).toBe(2);
    expect(p.shop().lastInterstitial).toBe(T0 - DAY);
    expect(p.shop().lastRewarded).toBe(T0 - DAY);
    expect(h.saved().shop.lastInterstitial).toBe(T0 - DAY);
    // a clock that stopped working changes nothing
    const broken = harness({ cleared: 30 });
    broken.profile.noteInterstitial();
    broken.clock.now = NaN;
    broken.profile.noteLevelFinished();
    expect(broken.profile.shop().lastInterstitial).toBe(T0);
  });
});
