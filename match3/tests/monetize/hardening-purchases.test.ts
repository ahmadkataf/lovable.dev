/**
 * Purchases under attack: one test per way real money could go wrong. Every scenario here was
 * either a defect found while hardening the store or a line of defence that must never be lost.
 *
 *  - a purchase is finished only when its grant is REALLY on disk (a save function that returns
 *    without throwing proves nothing — the platform's never throws);
 *  - several units bought at once are granted several times;
 *  - "already owned" and "pending" are not ownership;
 *  - a purchase screen that closes without a word cannot block the shop for ten minutes;
 *  - a bridge that answers inside the call, throws, or does both;
 *  - events in the wrong order, listeners that call back in, enormous inputs, look-alike tokens.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUY_RESUME_GRACE_MS, BUY_WATCHDOG_MS, MAX_PURCHASE_QUANTITY, PRODUCTS, createCoreStore } from '../../src/monetize/index.ts';
import type { MonetizeBridge, PurchaseOutcome } from '../../src/monetize/types.ts';
import { MAX_PURCHASE_TOKENS, createProfile, purchaseKey } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { PlatformApi } from '../../src/platform/types.ts';
import { ADS_ON, ALL_PRICES, MINUTE, SECOND, T0, greet, newMachine, onDisk, promiseBook, startSession, veteranSave } from './hardening-kit.ts';
import type { Machine, Session, SessionOptions } from './hardening-kit.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function open(options: SessionOptions = {}, machine: Machine = newMachine({ save: veteranSave(29, 10) })): { machine: Machine; session: Session } {
  const session = startSession(machine, options);
  greet(session);
  return { machine, session };
}

const finishes = (session: Session): string[] => session.calls.filter((c) => c.indexOf('iapFinish:') === 0).map((c) => c.slice(10));
const count = (session: Session, call: string): number => session.calls.filter((c) => c === call).length;
const purchased = (id: string, token: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ type: 'purchase', id, state: 'purchased', token, ...extra });
const diskHas = (machine: Machine, token: string): boolean => {
  const save = onDisk(machine);
  return save !== null && save.shop.tokens.indexOf(purchaseKey(token)!) >= 0;
};

// ───────────────────────────── finished only when the grant is on disk ─────────────────────────────

describe('a purchase is finished only when its grant is really in storage', () => {
  it('DEFECT: a storage layer that fails WITHOUT throwing — the purchase must not be finished (it used to be consumed and lost)', async () => {
    const { machine, session } = open();
    machine.disk.mode = 'silent'; // storeSave returns normally and keeps nothing: what PlatformApi.storeSave does on failure
    const outcome = session.store.buy('coins_mega');
    session.send(purchased('coins_mega', 'tok-mega'));
    expect(await outcome).toBe('purchased');
    expect(session.profile.coins()).toBe(72_000); // granted — in memory
    expect(session.profile.lastSaveOk()).toBe(true); // …and the profile was told nothing went wrong
    expect(diskHas(machine, 'tok-mega')).toBe(false);
    expect(finishes(session)).toEqual([]); // so the store must find out by itself: NOT finished

    // the store delivers it again (it does at every return to the app): still not on disk, still not finished
    session.send(purchased('coins_mega', 'tok-mega'));
    expect(finishes(session)).toEqual([]);
    expect(session.profile.coins()).toBe(72_000);

    // the app dies. Nothing was lost: the unfinished purchase is delivered to the next session and granted there
    session.kill();
    machine.disk.mode = 'ok';
    const next = open({}, machine).session;
    expect(next.profile.coins()).toBe(2_000);
    next.send(purchased('coins_mega', 'tok-mega'));
    expect(next.profile.coins()).toBe(72_000);
    expect(diskHas(machine, 'tok-mega')).toBe(true);
    expect(finishes(next)).toEqual(['tok-mega']);
  });

  it('…and when storage recovers within the session: finished at the next delivery after a save went through', () => {
    const { machine, session } = open();
    machine.disk.mode = 'silent';
    session.send(purchased('coins_small', 'tok-1'));
    expect(finishes(session)).toEqual([]);
    machine.disk.mode = 'ok';
    session.send(purchased('coins_small', 'tok-1')); // delivered again, but nothing was saved since
    expect(finishes(session)).toEqual([]);
    session.profile.markSeen('anything'); // any ordinary save carries the grant along
    expect(diskHas(machine, 'tok-1')).toBe(true);
    session.send(purchased('coins_small', 'tok-1'));
    expect(finishes(session)).toEqual(['tok-1']);
    expect(session.profile.coins()).toBe(3_000); // once
  });

  it('a save that throws: the same — not finished until the grant is on disk', () => {
    const { machine, session } = open();
    machine.disk.mode = 'throws';
    session.send(purchased('starter_pack', 'tok-s'));
    expect(session.store.owns('starter_pack')).toBe(true);
    expect(finishes(session)).toEqual([]);
    machine.disk.mode = 'ok';
    session.send(purchased('starter_pack', 'tok-s'));
    expect(finishes(session)).toEqual([]); // the last save failed, and nothing was saved since
    session.profile.markSeen('x');
    session.send(purchased('starter_pack', 'tok-s'));
    expect(finishes(session)).toEqual(['tok-s']);
    expect(session.profile.coins()).toBe(6_000);
  });

  it('storage that cannot be read back (the read throws, or returns nothing): not finished', () => {
    const { machine, session } = open();
    machine.disk.readAs = () => {
      throw new Error('storage is gone');
    };
    session.send(purchased('coins_small', 'tok-1'));
    expect(finishes(session)).toEqual([]);
    machine.disk.readAs = () => null;
    session.send(purchased('coins_small', 'tok-1'));
    machine.disk.readAs = () => '';
    session.send(purchased('coins_small', 'tok-1'));
    machine.disk.readAs = () => '{"version":1,"coins":3000}'; // an older save, without the purchase
    session.send(purchased('coins_small', 'tok-1'));
    expect(finishes(session)).toEqual([]);
    machine.disk.readAs = null;
    session.send(purchased('coins_small', 'tok-1'));
    expect(finishes(session)).toEqual(['tok-1']);
  });

  it('a storage layer that re-encodes the save (byte-order mark, one more layer of JSON) still counts as saved', () => {
    for (const wrap of [(json: string) => '﻿' + json, (json: string) => JSON.stringify(json), (json: string) => JSON.stringify(JSON.parse(json), null, 2)]) {
      const { machine, session } = open();
      machine.disk.readAs = (json) => (json === null ? null : wrap(json));
      session.send(purchased('coins_small', 'tok-1'));
      expect(session.profile.coins()).toBe(3_000);
      expect(finishes(session)).toEqual(['tok-1']);
    }
  });

  it('the read-back is the only extra storage access, and only when a purchase is to be finished', () => {
    const { machine, session } = open();
    const reads = machine.disk.reads;
    session.send({ type: 'owned', ids: ['remove_ads'], complete: true });
    void session.store.maybeShowInterstitial();
    session.profile.addCoins(5);
    expect(machine.disk.reads).toBe(reads); // ordinary life: storage is never read
    session.send(purchased('coins_small', 'tok-1'));
    expect(machine.disk.reads).toBe(reads + 1);
    session.send(purchased('coins_small', 'tok-1'));
    expect(machine.disk.reads).toBe(reads + 2);
  });

  it('with the PLATFORM’s storage (storeSave never throws): an Android bridge that drops the save is found out', () => {
    // the wiring of src/main.ts: profile.save → platform.storeSave → AndroidBridge.storeSave
    const wrapper = { save: '', dropping: false };
    const calls: string[] = [];
    const platformLike = {
      loadSave: (): string | null => (wrapper.save.length > 0 ? wrapper.save : null),
      storeSave: (json: string): void => {
        if (!wrapper.dropping) wrapper.save = json; // a failing bridge: the call returns, nothing is kept
      },
    };
    const profile = createProfile({ load: () => platformLike.loadSave(), save: (json) => platformLike.storeSave(json), now: () => T0, levelCount: 120 });
    const bridge: MonetizeBridge = {
      storeCaps: () => '{"billing":true,"ads":false}',
      iapQuery: () => {},
      iapBuy: () => {},
      iapFinish: (token) => void calls.push(token),
      iapRestore: () => {},
      adShowRewarded: () => {},
      adShowInterstitial: () => {},
      adPrivacyOptions: () => {},
    };
    const platform = { onPause: () => {}, onResume: () => {} } as unknown as PlatformApi;
    const store = createCoreStore({ profile, platform, now: () => T0, bridge });
    store.start();
    wrapper.dropping = true;
    store.receive(JSON.stringify(purchased('coins_large', 'GPA.1')));
    expect(profile.coins()).toBe(14_000);
    expect(calls).toEqual([]); // never consumed: Google Play will deliver it again
    wrapper.dropping = false;
    profile.addCoins(1);
    store.receive(JSON.stringify(purchased('coins_large', 'GPA.1')));
    expect(calls).toEqual(['GPA.1']);
    expect(JSON.parse(wrapper.save).coins).toBe(14_001);
  });
});

// ───────────────────────────── quantity ─────────────────────────────

describe('several units in one purchase (multi-quantity)', () => {
  it('DEFECT: a coin pack bought three at a time grants three packs — one token, one save, one finish', async () => {
    const { machine, session } = open();
    const outcome = session.store.buy('coins_medium');
    const writes = machine.disk.writes;
    session.send(purchased('coins_medium', 'tok-q', { quantity: 3 }));
    expect(await outcome).toBe('purchased');
    expect(session.profile.coins()).toBe(2_000 + 3 * 5_500);
    expect(machine.disk.writes).toBe(writes + 1);
    expect(finishes(session)).toEqual(['tok-q']);
    // delivered again (with or without the quantity): nothing more
    session.send(purchased('coins_medium', 'tok-q', { quantity: 3 }));
    session.send(purchased('coins_medium', 'tok-q'));
    session.send(purchased('coins_medium', 'tok-q', { quantity: 50 }));
    expect(session.profile.coins()).toBe(18_500);
  });

  it('only a whole number of 2 or more multiplies; nonsense is one unit; the bound is ' + MAX_PURCHASE_QUANTITY, () => {
    const cases: [unknown, number][] = [
      [undefined, 1],
      [1, 1],
      [2, 2],
      [2.9, 2],
      [0, 1],
      [-4, 1],
      [NaN, 1],
      [Infinity, 1],
      ['3', 1],
      [true, 1],
      [null, 1],
      [[3], 1],
      [{ valueOf: () => 3 }, 1],
      [MAX_PURCHASE_QUANTITY, MAX_PURCHASE_QUANTITY],
      [MAX_PURCHASE_QUANTITY + 1, MAX_PURCHASE_QUANTITY],
      [1e12, MAX_PURCHASE_QUANTITY],
    ];
    cases.forEach(([quantity, units], i) => {
      const { session } = open();
      session.send(purchased('coins_small', 'tok-' + i, quantity === undefined ? {} : { quantity }));
      expect(session.profile.coins(), 'quantity ' + String(quantity)).toBe(2_000 + units * 1_000);
    });
  });

  it('an entitlement is owned once, whatever a quantity says', () => {
    const { session } = open();
    session.send(purchased('starter_pack', 'tok-s', { quantity: 5 }));
    expect(session.profile.coins()).toBe(6_000);
    expect(session.profile.boosterCount('hammer')).toBe(3);
    expect(session.profile.shop().owned).toEqual(['starter_pack']);
  });
});

// ───────────────────────────── "already owned" and "pending" ─────────────────────────────

describe('ownership comes only from a listing or a "purchased" event', () => {
  it('DEFECT: a pending payment, then "already owned" on a second attempt — nothing is owned, nobody counts as a payer', async () => {
    const { machine, session } = open();
    const first = session.store.buy('remove_ads');
    session.send({ type: 'purchase', id: 'remove_ads', state: 'pending' });
    expect(await first).toBe('pending');
    const second = session.store.buy('remove_ads');
    session.send({ type: 'purchase', id: 'remove_ads', state: 'alreadyOwned' }); // Google Play's answer while the payment is pending
    expect(await second).toBe('alreadyOwned');
    expect(session.store.owns('remove_ads')).toBe(false);
    expect(session.profile.shop().purchased).toBe(false);
    expect(session.profile.shop().owned).toEqual([]);
    expect(machine.disk.writes).toBe(0);
    expect(count(session, 'iapRestore')).toBe(2); // start-up + the listing that was asked for
    // the listing says: nothing owned (the payment is still pending)
    session.send({ type: 'owned', ids: [], complete: true });
    session.send({ type: 'purchase', id: 'remove_ads', state: 'pending' });
    expect(session.store.owns('remove_ads')).toBe(false);
    // …so interstitials are still shown to this player, who has paid nothing
    void session.store.maybeShowInterstitial();
    void session.store.maybeShowInterstitial();
    void session.store.maybeShowInterstitial();
    expect(count(session, 'adShowInterstitial')).toBe(1);
    session.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
    // the payment completes: now it is owned, and granted through the one grant path
    session.send(purchased('remove_ads', 'tok-r', { acknowledged: false }));
    expect(session.store.owns('remove_ads')).toBe(true);
    expect(finishes(session)).toEqual(['tok-r']);
  });

  it('unsolicited "alreadyOwned", "pending", "cancelled", "error" and "unavailable" events change nothing at all', () => {
    const { machine, session } = open();
    for (const id of PRODUCTS.map((p) => p.id)) {
      for (const state of ['alreadyOwned', 'pending', 'cancelled', 'error', 'unavailable']) {
        session.send({ type: 'purchase', id, state });
        session.send({ type: 'purchase', id, state, token: 'tok-' + id, acknowledged: true });
      }
    }
    expect(machine.disk.writes).toBe(0);
    expect(session.profile.coins()).toBe(2_000);
    expect(session.profile.shop().owned).toEqual([]);
    expect(finishes(session)).toEqual([]);
    expect(count(session, 'iapRestore')).toBe(1); // nobody was waiting, so nothing was asked either
  });

  it('a restore never brings the starter pack’s goodies — however often, in whatever form', () => {
    const { session } = open();
    for (let i = 0; i < 25; i++) {
      session.send({ type: 'owned', ids: ['starter_pack', 'remove_ads'], complete: i % 2 === 0 });
      session.send(purchased('starter_pack', 'restored-token', { acknowledged: true }));
      session.send(purchased('starter_pack', 'another-' + i, { acknowledged: true }));
      session.send({ type: 'purchase', id: 'starter_pack', state: 'alreadyOwned' });
    }
    expect(session.store.owns('starter_pack')).toBe(true);
    expect(session.store.owns('remove_ads')).toBe(true);
    expect(session.profile.coins()).toBe(2_000);
    expect(session.profile.boosterCount('hammer')).toBe(0);
    expect(session.profile.shop().tokens).toEqual([]);
    expect(finishes(session)).toEqual([]); // acknowledged already: nothing to finish
  });

  it('only `complete: true` — the boolean — takes ownership away', () => {
    const { session } = open();
    session.send({ type: 'owned', ids: ['remove_ads', 'starter_pack'] });
    for (const complete of [undefined, false, 'true', 1, {}, [], null]) {
      session.send(complete === undefined ? { type: 'owned', ids: [] } : { type: 'owned', ids: [], complete });
      expect(session.profile.shop().owned).toEqual(['remove_ads', 'starter_pack']);
    }
    session.send({ type: 'owned', ids: ['starter_pack'], complete: true });
    expect(session.profile.shop().owned).toEqual(['starter_pack']);
    expect(session.profile.shop().purchased).toBe(true); // once a payer, always a payer
  });

  it('a save whose list of entitlements is full of junk can still record a real one', () => {
    const save = veteranSave(29, 10);
    for (let i = 0; i < 40; i++) save.shop.owned.push('junk_' + i);
    const { machine, session } = open({}, newMachine({ save }));
    expect(session.profile.shop().owned.length).toBe(16);
    session.send({ type: 'owned', ids: ['remove_ads'] });
    session.send(purchased('starter_pack', 'tok-s'));
    expect(session.store.owns('remove_ads')).toBe(true);
    expect(session.store.owns('starter_pack')).toBe(true);
    expect(onDisk(machine)!.shop.owned.length).toBe(16);
    expect(onDisk(machine)!.shop.owned.slice(-2)).toEqual(['remove_ads', 'starter_pack']);
  });
});

// ───────────────────────────── a purchase screen that closes without a word ─────────────────────────────

describe('a purchase flow that goes silent', () => {
  it('DEFECT: back from the store’s screen with no answer — after ' + BUY_RESUME_GRACE_MS / 1000 + ' s the buyer is told, a listing is asked for, and the shop works again', async () => {
    const { session } = open();
    const book = promiseBook();
    void book.track('buy', session.store.buy('coins_small'));
    session.pause(); // Google Play's sheet covers the game
    await vi.advanceTimersByTimeAsync(3 * MINUTE); // …for as long as the player likes
    expect(book.open()).toEqual(['buy']);
    session.resume(); // the sheet has closed, and the wrapper says nothing
    await vi.advanceTimersByTimeAsync(BUY_RESUME_GRACE_MS - 1);
    expect(book.open()).toEqual(['buy']);
    expect(await session.store.buy('coins_medium')).toBe('error'); // one purchase at a time
    await vi.advanceTimersByTimeAsync(1);
    expect(book.values('buy')).toEqual(['error']);
    expect(count(session, 'iapRestore')).toBe(2);
    // the shop is usable at once
    const again = session.store.buy('coins_medium');
    expect(count(session, 'iapBuy:coins_medium')).toBe(1);
    session.send({ type: 'purchase', id: 'coins_medium', state: 'cancelled' });
    expect(await again).toBe('cancelled');
    // and if the first payment did go through after all, the listing delivers it: granted and finished
    session.send(purchased('coins_small', 'late-token'));
    expect(session.profile.coins()).toBe(3_000);
    expect(finishes(session)).toEqual(['late-token']);
  });

  it('an answer within the grace period is the answer; no extra listing is asked for', async () => {
    const { session } = open();
    const outcome = session.store.buy('coins_small');
    session.pause();
    session.resume();
    await vi.advanceTimersByTimeAsync(BUY_RESUME_GRACE_MS - 1);
    session.send(purchased('coins_small', 'tok-1'));
    expect(await outcome).toBe('purchased');
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(count(session, 'iapRestore')).toBe(1);
  });

  it('leaving again restarts the wait; a return that was never preceded by a leave says nothing', async () => {
    const { session } = open();
    const book = promiseBook();
    void book.track('buy', session.store.buy('coins_small'));
    session.resume(); // a stray "resume": the store's screen was never up
    await vi.advanceTimersByTimeAsync(BUY_RESUME_GRACE_MS * 3);
    expect(book.open()).toEqual(['buy']);
    session.pause();
    session.resume();
    await vi.advanceTimersByTimeAsync(BUY_RESUME_GRACE_MS - 1);
    session.pause(); // off to the banking app
    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(book.open()).toEqual(['buy']);
    session.resume();
    await vi.advanceTimersByTimeAsync(BUY_RESUME_GRACE_MS - 1);
    expect(book.open()).toEqual(['buy']);
    await vi.advanceTimersByTimeAsync(1);
    expect(book.values('buy')).toEqual(['error']);
  });

  it('where returning says nothing about the purchase (the test store draws its sheet in the page) only the long watchdog applies', async () => {
    const { session } = open({ buyResumeGraceMs: null });
    const book = promiseBook();
    void book.track('buy', session.store.buy('coins_small'));
    session.pause();
    session.resume();
    await vi.advanceTimersByTimeAsync(BUY_WATCHDOG_MS - 2 * SECOND);
    expect(book.open()).toEqual(['buy']);
    await vi.advanceTimersByTimeAsync(2 * SECOND);
    expect(book.values('buy')).toEqual(['error']);
    expect(count(session, 'iapRestore')).toBe(1);
  });

  it('a watchdog of an earlier purchase never ends a later one', async () => {
    const { session } = open();
    const first = session.store.buy('coins_small');
    await vi.advanceTimersByTimeAsync(BUY_WATCHDOG_MS - SECOND);
    session.send({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
    expect(await first).toBe('cancelled');
    const book = promiseBook();
    void book.track('buy', session.store.buy('coins_small')); // the same product again
    await vi.advanceTimersByTimeAsync(2 * SECOND); // the first one's ten minutes are over now
    expect(book.open()).toEqual(['buy']);
    session.send(purchased('coins_small', 'tok-2'));
    await vi.advanceTimersByTimeAsync(0);
    expect(book.values('buy')).toEqual(['purchased']);
  });
});

// ───────────────────────────── a bridge that answers inside the call, or throws ─────────────────────────────

describe('a bridge that misbehaves', () => {
  it('answers inside iapBuy — and then throws: the purchase stands, granted once, finished once', async () => {
    const { machine, session } = open();
    machine.onBridge = (s, name, id) => {
      if (name !== 'iapBuy') return;
      s.send(purchased(id!, 'sync-' + id));
      throw new Error('bridge fell over after answering');
    };
    expect(await session.store.buy('coins_large')).toBe('purchased');
    expect(session.profile.coins()).toBe(14_000);
    expect(finishes(session)).toEqual(['sync-coins_large']);
    // the next purchase is not blocked by a flow that is long over
    machine.onBridge = null;
    const next = session.store.buy('coins_small');
    session.send({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
    expect(await next).toBe('cancelled');
  });

  it('answers inside iapRestore: restore() counts what came back', async () => {
    const { machine, session } = open();
    machine.onBridge = (s, name) => {
      if (name !== 'iapRestore') return;
      s.send({ type: 'owned', ids: ['remove_ads'], complete: true });
      s.send(purchased('coins_small', 'stuck'));
    };
    const restored = session.store.restore();
    await vi.advanceTimersByTimeAsync(400);
    expect(await restored).toBe(2);
    expect(session.store.owns('remove_ads')).toBe(true);
    expect(session.profile.coins()).toBe(3_000);
  });

  it('re-delivers the purchase from inside iapFinish, again and again: one grant, no endless loop', () => {
    const { machine, session } = open();
    let rounds = 0;
    machine.onBridge = (s, name, token) => {
      if (name !== 'iapFinish' || rounds >= 50) return;
      rounds += 1;
      s.send(purchased('coins_small', token!));
    };
    session.send(purchased('coins_small', 'echo'));
    expect(session.profile.coins()).toBe(3_000);
    expect(rounds).toBe(50);
    expect(finishes(session)).toHaveLength(51);
  });

  it('every bridge method throws: nothing escapes, every promise answers, nothing is granted', async () => {
    const { machine, session } = open();
    machine.onBridge = () => {
      throw new Error('bridge is down');
    };
    expect(await session.store.buy('coins_small')).toBe('error');
    expect(await session.store.restore()).toBe(0);
    expect(await session.store.showRewarded('freeCoins')).toBe('unavailable');
    expect(await session.store.maybeShowInterstitial()).toBe(false);
    await session.store.showPrivacyOptions();
    session.pause();
    session.resume();
    // a purchase that arrives is still granted and saved; its finish fails and is asked again later
    session.send(purchased('coins_small', 'tok-1'));
    expect(session.profile.coins()).toBe(3_000);
    expect(finishes(session)).toEqual(['tok-1']);
    machine.onBridge = null;
    session.send(purchased('coins_small', 'tok-1'));
    expect(finishes(session)).toEqual(['tok-1', 'tok-1']);
    expect(session.profile.coins()).toBe(3_000);
  });

  it('DEFECT: a bridge that cannot even be asked whether it has storeSync still gets the product query and the restore', () => {
    const calls: string[] = [];
    const bridge = {
      storeCaps: () => '{"billing":true,"ads":true}',
      get storeSync(): () => void {
        throw new Error('no such member');
      },
      iapQuery: () => void calls.push('iapQuery'),
      iapBuy: () => {},
      iapFinish: () => {},
      iapRestore: () => void calls.push('iapRestore'),
      adShowRewarded: () => {},
      adShowInterstitial: () => {},
      adPrivacyOptions: () => {},
    } as unknown as MonetizeBridge;
    const profile = createProfile({ load: () => null, save: () => {}, now: () => T0, levelCount: 120 });
    const store = createCoreStore({ profile, platform: { onPause: () => {}, onResume: () => {} } as unknown as PlatformApi, now: () => T0, bridge });
    expect(() => store.start()).not.toThrow();
    expect(calls).toEqual(['iapQuery', 'iapRestore']);
  });

  it('capabilities in every broken form mean "nothing", never an exception', () => {
    for (const caps of ['', '{', 'null', '[]', '"billing"', '{"billing":"true","ads":1}', '{"billing":null}', 'true']) {
      const { session } = open({}, newMachine({ caps }));
      expect(session.store.iapAvailable()).toBe(false);
      expect(session.store.adsAvailable()).toBe(false);
      expect(session.calls.filter((c) => c !== 'storeSync')).toEqual([]);
    }
  });
});

// ───────────────────────────── order, re-entrancy, size ─────────────────────────────

describe('events out of order', () => {
  it('a result that arrives before the request, results for other products, results after the answer: every promise settles, every grant happens once', async () => {
    const { session } = open();
    const book = promiseBook();
    // the purchase completed before buy() was even called (a result that survived a page reload)
    session.send(purchased('coins_small', 'early'));
    expect(session.profile.coins()).toBe(3_000);
    void book.track('a', session.store.buy('coins_small'));
    // results for OTHER products do not answer it
    session.send(purchased('coins_medium', 'other'));
    session.send({ type: 'purchase', id: 'coins_large', state: 'cancelled' });
    await vi.advanceTimersByTimeAsync(0);
    expect(book.open()).toEqual(['a']);
    expect(session.profile.coins()).toBe(8_500);
    // its own result does — and the same result again changes nothing
    session.send(purchased('coins_small', 'mine'));
    session.send(purchased('coins_small', 'mine'));
    session.send({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
    await vi.advanceTimersByTimeAsync(0);
    expect(book.values('a')).toEqual(['purchased']);
    expect(session.profile.coins()).toBe(9_500);
    // 'owned' before restore(): the restore waits for its own answer, or for its watchdog
    session.send({ type: 'owned', ids: ['remove_ads'] });
    void book.track('r', session.store.restore());
    await vi.advanceTimersByTimeAsync(14 * SECOND);
    expect(book.open()).toEqual(['r']);
    await vi.advanceTimersByTimeAsync(SECOND);
    expect(book.values('r')).toEqual([0]);
    // a stale 'purchased' of an old token while a NEW purchase of the same pack is open
    void book.track('b', session.store.buy('coins_small'));
    session.send(purchased('coins_small', 'mine'));
    await vi.advanceTimersByTimeAsync(0);
    expect(book.values('b')).toEqual(['error']); // nothing new was paid: not "purchased"
    expect(session.profile.coins()).toBe(9_500);
    expect(book.rejected).toEqual([]);
  });

  it('twenty purchases delivered in one burst, each three times, in a scrambled order: twenty grants', () => {
    const { machine, session } = open();
    const events: Record<string, unknown>[] = [];
    for (let i = 0; i < 20; i++) for (let copy = 0; copy < 3; copy++) events.push(purchased('coins_small', 'burst-' + i));
    for (let i = events.length - 1; i > 0; i--) {
      const j = (i * 7919 + 13) % (i + 1);
      const tmp = events[i]!;
      events[i] = events[j]!;
      events[j] = tmp;
    }
    for (const ev of events) session.send(ev);
    expect(session.profile.coins()).toBe(22_000);
    expect(onDisk(machine)!.coins).toBe(22_000);
    expect(new Set(finishes(session)).size).toBe(20);
    expect(finishes(session)).toHaveLength(60);
  });
});

describe('listeners that call back into the store', () => {
  it('buying, restoring and delivering events from inside onChange never re-enters a listener and never loses a change', async () => {
    const { session } = open();
    let depth = 0;
    let deepest = 0;
    let calls = 0;
    const seen: number[] = [];
    const inner: Promise<PurchaseOutcome>[] = [];
    session.store.onChange(() => {
      depth += 1;
      deepest = Math.max(deepest, depth);
      calls += 1;
      seen.push(session.profile.coins());
      if (calls === 1) {
        inner.push(session.store.buy('coins_medium'));
        session.send(purchased('coins_medium', 'inner-1')); // answered from inside the listener
        void session.store.restore();
        session.send({ type: 'owned', ids: ['remove_ads'] });
      }
      depth -= 1;
    });
    session.send(purchased('coins_small', 'outer'));
    expect(deepest).toBe(1);
    expect(session.profile.coins()).toBe(8_500);
    expect(seen[0]).toBe(3_000);
    expect(seen[seen.length - 1]).toBe(8_500); // the last word a listener heard is the final state
    expect(session.store.owns('remove_ads')).toBe(true);
    expect(await inner[0]).toBe('purchased');
  });

  it('a listener that changes something every time it is told is cut off, not followed for ever', () => {
    const { session } = open();
    let calls = 0;
    let flip = false;
    session.store.onChange(() => {
      calls += 1;
      flip = !flip;
      session.send({ ...ADS_ON, rewardedReady: flip });
    });
    session.send({ ...ADS_ON, interstitialReady: false });
    expect(calls).toBeGreaterThan(1);
    expect(calls).toBeLessThanOrEqual(10);
    const before = calls;
    session.send({ ...ADS_ON, privacyOptionsRequired: true });
    expect(calls).toBeGreaterThan(before); // and the store still talks to it afterwards
  });

  it('listeners that throw, unsubscribe themselves or each other do not disturb a purchase', () => {
    const { session } = open();
    const heard: string[] = [];
    const offs: (() => void)[] = [];
    offs.push(
      session.store.onChange(() => {
        heard.push('a');
        throw new Error('listener a failed');
      }),
    );
    offs.push(
      session.store.onChange(() => {
        heard.push('b');
        offs[1]!();
        offs[2]!(); // removes c before it is called in this round
      }),
    );
    offs.push(session.store.onChange(() => void heard.push('c')));
    offs.push(session.store.onChange(() => void heard.push('d')));
    session.send(purchased('coins_small', 'tok-1'));
    expect(heard).toEqual(['a', 'b', 'd']);
    session.send(purchased('coins_small', 'tok-2'));
    expect(heard).toEqual(['a', 'b', 'd', 'a', 'd']);
    expect(session.profile.coins()).toBe(4_000);
    expect(finishes(session)).toEqual(['tok-1', 'tok-2']);
    // things that are not functions are refused politely
    expect(() => session.store.onChange(null as unknown as () => void)()).not.toThrow();
  });

  it('a PROFILE subscriber that delivers the same purchase again from inside the grant: still one grant', () => {
    const { session } = open();
    let nested = 0;
    session.profile.subscribe(() => {
      if (nested < 3) {
        nested += 1;
        session.send(purchased('coins_xl', 'nested'));
      }
    });
    session.send(purchased('coins_xl', 'nested'));
    expect(nested).toBe(1); // the copy changed nothing, so the subscriber was not told again
    expect(session.profile.coins()).toBe(28_000);
    expect(new Set(finishes(session))).toEqual(new Set(['nested']));
  });
});

describe('the last line of defence', () => {
  it('should the profile ever fail under the store, no call throws and every request answers', async () => {
    const machine = newMachine({ save: veteranSave(29, 10) });
    const real = startSession(machine).profile;
    let broken = false;
    const failing = new Proxy(real, {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]): unknown => {
          if (broken) throw new Error('profile.' + String(key) + ' failed');
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    }) as FullProfile;
    const bridge: MonetizeBridge = {
      storeCaps: () => '{"billing":true,"ads":true}',
      iapQuery: () => {},
      iapBuy: () => {},
      iapFinish: () => {},
      iapRestore: () => {},
      adShowRewarded: () => {},
      adShowInterstitial: () => {},
      adPrivacyOptions: () => {},
    };
    const listeners: (() => void)[] = [];
    const platform = { onPause: (fn: () => void) => void listeners.push(fn), onResume: (fn: () => void) => void listeners.push(fn) } as unknown as PlatformApi;
    const store = createCoreStore({ profile: failing, platform, now: () => T0, bridge });
    store.start();
    store.receive(JSON.stringify({ type: 'products', products: ALL_PRICES }));
    store.receive(JSON.stringify(ADS_ON));
    broken = true;
    expect(store.iapAvailable()).toBe(true);
    expect(store.owns('remove_ads')).toBe(false);
    expect(store.rewardedReady()).toBe(false);
    expect(store.freeCoinAdsLeft()).toBe(0);
    expect(store.rewardedLeft('freeLife')).toBe(0);
    expect(store.products()).toHaveLength(7);
    expect(await store.buy('starter_pack')).toBe('error'); // "do I own it?" could not be answered
    expect(await store.showRewarded('freeCoins')).toBe('unavailable');
    expect(await store.maybeShowInterstitial()).toBe(false);
    expect(() => store.receive(JSON.stringify(purchased('coins_small', 'tok-1')))).not.toThrow();
    expect(() => store.receive(JSON.stringify({ type: 'owned', ids: ['remove_ads'], complete: true }))).not.toThrow();
    expect(() => store.receive(JSON.stringify({ type: 'adResult', format: 'rewarded', result: 'earned' }))).not.toThrow();
    for (const fn of listeners) expect(fn).not.toThrow();
    broken = false;
    expect(real.coins()).toBe(2_000); // nothing was half-granted
  });
});

describe('enormous and look-alike inputs', () => {
  it('megabytes of event text are read or dropped — never an exception, never a grant', () => {
    const { machine, session } = open();
    const big = 'A'.repeat(2_000_000);
    const inputs: unknown[] = [
      big,
      '{"type":"purchase","id":"coins_small","state":"purchased","token":"' + big + '"}',
      { type: 'purchase', id: big, state: 'purchased', token: 'tok' },
      { type: 'products', products: new Array(50_000).fill({ id: 'coins_small', price: big }) },
      { type: 'owned', ids: new Array(100_000).fill('remove_adz'), complete: true },
      '['.repeat(100_000),
      '{"a":'.repeat(50_000),
      { type: 'purchase', id: 'coins_small', state: 'purchased', token: { toString: () => 'tok' } },
    ];
    for (const input of inputs) expect(() => session.store.receive(input)).not.toThrow();
    expect(machine.disk.writes).toBe(0);
    expect(session.profile.coins()).toBe(2_000);
    expect(finishes(session)).toEqual([]);
    // a price list in which not one price is usable is an empty price list: nothing is offered
    // (the store is asked again when the app returns)
    expect(session.store.products()).toEqual([]);
    expect(session.store.iapAvailable()).toBe(false);
    session.pause();
    session.resume();
    expect(session.calls.filter((c) => c.indexOf('iapQuery:') === 0)).toHaveLength(2);
  });

  it('a token of 4,096 characters is a purchase; one character more is not — and is never finished', () => {
    const { session } = open();
    const longest = 'L'.repeat(4096);
    session.send(purchased('coins_small', longest));
    expect(session.profile.coins()).toBe(3_000);
    expect(finishes(session)).toEqual([longest]);
    session.send(purchased('coins_small', longest + 'X'));
    expect(session.profile.coins()).toBe(3_000);
    expect(finishes(session)).toEqual([longest]);
    // remembered as a short key, not in full
    expect(session.profile.shop().tokens[0]!.length).toBeLessThanOrEqual(64);
  });

  it('tokens that differ in one character, in case, in white space or only at the far end are different purchases', () => {
    const { session } = open();
    const base = 'kfhgnmopalclobdkngbiafcj.AO-J1O' + 'x'.repeat(150);
    const tokens = [
      base,
      base + ' ',
      ' ' + base,
      base.toUpperCase(),
      base.slice(0, -1) + 'y',
      'y' + base.slice(1),
      base + base,
      'tok',
      'TOK',
      'tok ',
      '#tok',
      '#' + (3).toString(36) + '.' + '0'.repeat(32), // dressed up as one of the profile's own digest keys
      purchaseKey(base)!, // …or as the very key under which `base` is remembered
      'ٱلرمز-٣', // not ASCII
      'tok\u0000',
      '💎',
    ];
    expect(new Set(tokens).size).toBe(tokens.length);
    tokens.forEach((token, i) => {
      session.send(purchased('coins_small', token));
      expect(session.profile.coins(), 'token ' + i).toBe(2_000 + (i + 1) * 1_000);
    });
    for (const token of tokens) session.send(purchased('coins_small', token));
    expect(session.profile.coins()).toBe(2_000 + tokens.length * 1_000);
    expect(new Set(session.profile.shop().tokens).size).toBe(tokens.length);
  });

  it('a product id is matched exactly: look-alikes and inherited names are no products', () => {
    const { machine, session } = open();
    for (const id of ['Coins_small', 'coins_small ', ' coins_small', 'coins-small', 'coins_small\u0000', '__proto__', 'constructor', 'hasOwnProperty', 'toString', '', 0, null, ['coins_small'], { id: 'coins_small' }]) {
      session.send({ type: 'purchase', id, state: 'purchased', token: 'tok-' + String(id) });
      session.send({ type: 'owned', ids: [id], complete: false });
      session.send({ type: 'products', products: ALL_PRICES.concat([{ id: id as string, price: '1' }]) });
    }
    expect(machine.disk.writes).toBe(0);
    expect(finishes(session)).toEqual([]);
    expect(session.store.products().map((p) => p.def.id)).toEqual(PRODUCTS.map((p) => p.id));
  });
});

describe('what is kept does not grow without bound', () => {
  it('300 purchases: the save remembers the newest ' + MAX_PURCHASE_TOKENS + ' tokens in a few kilobytes, and every one was finished', () => {
    const { machine, session } = open();
    const long = 'kfhgnmopalclobdkngbiafcj.AO-J1O' + 'z'.repeat(300);
    for (let i = 0; i < 300; i++) session.send(purchased('coins_small', long + i));
    expect(session.profile.coins()).toBe(302_000);
    expect(session.profile.shop().tokens).toHaveLength(MAX_PURCHASE_TOKENS);
    expect(machine.disk.json!.length).toBeLessThan(12_000);
    expect(finishes(session)).toHaveLength(300);
    // the newest 200 are still refused
    for (let i = 100; i < 300; i++) session.send(purchased('coins_small', long + i));
    expect(session.profile.coins()).toBe(302_000);
  });
});

describe('prices', () => {
  it('the store code that serves Android holds no price: not a number with a currency, not the test store’s list', () => {
    const source = readFileSync(new URL('../../src/monetize/store.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/FAKE_PRICES/);
    expect(source).not.toMatch(/[$€£¥]\s?\d|\d[.,]\d\d\b/);
    const index = readFileSync(new URL('../../src/monetize/index.ts', import.meta.url), 'utf8');
    expect(index).not.toMatch(/[$€£¥]\s?\d/);
  });

  it('whatever the wrapper sends is shown verbatim (trimmed), or not at all', () => {
    const { session } = open();
    session.send({
      type: 'products',
      products: [
        { id: 'coins_small', price: '  ٣٫٩٩ ر.س  ' },
        { id: 'coins_medium', price: '' },
        { id: 'coins_large', price: '   ' },
        { id: 'coins_xl', price: 4.99 },
        { id: 'coins_mega', price: 'x'.repeat(41) },
        { id: 'starter_pack', price: 'x'.repeat(40) },
        { id: 'remove_ads' },
      ],
    });
    expect(session.store.products().map((p) => [p.info.id, p.info.price])).toEqual([
      ['coins_small', '٣٫٩٩ ر.س'],
      ['starter_pack', 'x'.repeat(40)],
    ]);
    // a product without a price cannot be bought, and the bridge is not asked
    const before = session.calls.length;
    void session.store.buy('coins_medium');
    expect(session.calls.length).toBe(before);
  });
});
