/**
 * Real-money purchases against a scripted bridge (the Android implementation is the same code:
 * `createCoreStore` fed with the wrapper's StoreEvents). The money-safety rules of
 * src/monetize/types.ts are the subject: grant once per token, only when PURCHASED, saved before
 * finished, re-delivery and restore at every start.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS, PRODUCT_IDS, productDef } from '../../src/monetize/index.ts';
import type { ProductId } from '../../src/monetize/types.ts';
import { ALL_PRICES, MINUTE, SECOND, world } from './harness.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const NO_BOOSTERS = { hammer: 0, freeSwap: 0, shuffle: 0, extraMoves: 0, prism: 0, beamNova: 0 };

describe('the catalogue (DESIGN §7)', () => {
  it('ids, kinds, grants, badges and display order', () => {
    expect(PRODUCTS).toEqual([
      { id: 'coins_small', kind: 'consumable', grants: [{ kind: 'coins', amount: 1000 }], removesAds: false },
      { id: 'coins_medium', kind: 'consumable', grants: [{ kind: 'coins', amount: 5500 }], removesAds: false },
      { id: 'coins_large', kind: 'consumable', grants: [{ kind: 'coins', amount: 12000 }], removesAds: false, badge: 'popular' },
      { id: 'coins_xl', kind: 'consumable', grants: [{ kind: 'coins', amount: 26000 }], removesAds: false },
      { id: 'coins_mega', kind: 'consumable', grants: [{ kind: 'coins', amount: 70000 }], removesAds: false, badge: 'best' },
      {
        id: 'starter_pack',
        kind: 'entitlement',
        grants: [
          { kind: 'coins', amount: 4000 },
          { kind: 'booster', id: 'hammer', amount: 3 },
          { kind: 'booster', id: 'freeSwap', amount: 3 },
          { kind: 'booster', id: 'prism', amount: 2 },
        ],
        removesAds: true,
      },
      { id: 'remove_ads', kind: 'entitlement', grants: [], removesAds: true },
    ]);
    expect(productDef('coins_small')).toBe(PRODUCTS[0]);
    for (const bad of ['coins', 'toString', '', null, undefined, 5]) expect(productDef(bad)).toBeNull();
    // read-only data: nobody can change what a product grants
    expect(() => ((PRODUCTS[0]!.grants[0] as { amount: number }).amount = 1e9)).toThrow();
    expect(() => (PRODUCTS as unknown as unknown[]).push({})).toThrow();
  });

  it('the smallest pack buys one continue with a little left over; bigger packs give more per dollar', () => {
    const packs = PRODUCTS.filter((p) => p.kind === 'consumable').map((p) => (p.grants[0] as { amount: number }).amount);
    const dollars = [0.99, 4.99, 9.99, 19.99, 49.99];
    expect(packs[0]).toBeGreaterThan(900);
    const rate = packs.map((coins, i) => coins / dollars[i]!);
    for (let i = 1; i < rate.length; i++) expect(rate[i]).toBeGreaterThan(rate[i - 1]!);
  });
});

describe('start-up and prices', () => {
  it('asks for product details and a restore, and offers nothing until a price is known', () => {
    const w = world({ silent: true });
    expect(w.calls()).toEqual(['iapQuery', 'iapRestore']);
    const query = w.device.log.find((entry) => entry.indexOf('iapQuery:') === 0)!;
    expect(JSON.parse(query.slice('iapQuery:'.length))).toEqual(PRODUCTS.map((p) => ({ id: p.id, kind: p.kind })));
    expect(w.store.iapAvailable()).toBe(false);
    expect(w.store.products()).toEqual([]);
    w.send({ type: 'products', products: [{ id: 'coins_large', price: 'US$9.99' }] });
    expect(w.store.iapAvailable()).toBe(true);
    expect(w.store.products()).toEqual([{ def: PRODUCTS[2], info: { id: 'coins_large', price: 'US$9.99' } }]);
    expect(w.changes.count).toBe(1);
  });

  it('shows the store’s own price strings, in display order, and only for products of this game', () => {
    const w = world({ silent: true });
    w.send({
      type: 'products',
      products: [
        { id: 'remove_ads', price: ' ٩٫٩٩ ر.س ' },
        { id: 'coins_mega', price: '49,99 €' },
        { id: 'coins_small', price: 'US$0.99' },
        { id: 'gems_pack', price: 'US$1.00' },
        { id: 'coins_xl', price: '' },
        { id: 'coins_large', price: 12 },
        { id: 'starter_pack', price: 'x'.repeat(500) },
        null,
        'coins_medium',
      ],
    });
    expect(w.store.products().map((p) => [p.def.id, p.info.price])).toEqual([
      ['coins_small', 'US$0.99'],
      ['coins_mega', '49,99 €'],
      ['remove_ads', '٩٫٩٩ ر.س'],
    ]);
    // the newest answer replaces the previous one: a product the store no longer lists is gone
    w.send({ type: 'products', products: ALL_PRICES.slice(0, 2) });
    expect(w.store.products().map((p) => p.def.id)).toEqual(['coins_small', 'coins_medium']);
    w.send({ type: 'products', products: [] });
    expect(w.store.iapAvailable()).toBe(false);
  });

  it('products missing: nothing can be bought, and the bridge is not even asked', async () => {
    const w = world({ silent: true });
    expect(await w.store.buy('coins_small')).toBe('unavailable');
    w.send({ type: 'products', products: [{ id: 'coins_small', price: 'US$0.99' }] });
    expect(await w.store.buy('coins_medium')).toBe('unavailable'); // listed products only
    expect(await w.store.buy('gold_bar' as ProductId)).toBe('unavailable');
    expect(w.newCalls()).toEqual([]);
  });

  it('a build without billing asks nothing and offers nothing', async () => {
    const w = world({ caps: { billing: false, ads: true }, silent: true });
    expect(w.calls()).toEqual([]);
    w.send({ type: 'products', products: ALL_PRICES });
    expect(w.store.iapAvailable()).toBe(false);
    expect(w.store.products()).toEqual([]);
    expect(await w.store.buy('coins_small')).toBe('unavailable');
    expect(await w.store.restore()).toBe(0);
    expect(w.calls()).toEqual([]);
  });

  it('unreadable capabilities mean a build with nothing', () => {
    for (const caps of ['', 'null', '{"billing":"yes","ads":1}', '[true,true]', '{broken']) {
      const w = world({ caps, silent: true });
      w.send({ type: 'products', products: ALL_PRICES });
      expect(w.store.iapAvailable(), caps).toBe(false);
      expect(w.store.adsAvailable(), caps).toBe(false);
    }
    const throwing = world({ broken: ['storeCaps'], silent: true });
    expect(throwing.store.iapAvailable()).toBe(false);
  });
});

describe('buying', () => {
  it.each(PRODUCT_IDS.map((id) => [id] as const))('%s: the exact grant, once, saved and then finished', async (id) => {
    const w = world();
    const def = productDef(id)!;
    const outcome = w.store.buy(id);
    expect(w.newCalls()).toEqual(['iapBuy:' + id]);
    w.send({ type: 'purchase', id, state: 'purchased', token: 'tok-' + id });
    expect(await outcome).toBe('purchased');

    let coins = 2000;
    const boosters: Record<string, number> = { ...NO_BOOSTERS };
    for (const r of def.grants) {
      if (r.kind === 'coins') coins += r.amount;
      else if (r.kind === 'booster') boosters[r.id] += r.amount;
    }
    expect(w.profile.coins()).toBe(coins);
    expect(w.profile.data().boosters).toEqual(boosters);
    expect(w.saved().coins).toBe(coins);
    expect(w.saved().shop.tokens).toEqual(['tok-' + id]);
    expect(w.saved().shop.purchased).toBe(true);
    expect(w.store.owns(id)).toBe(def.kind === 'entitlement');
    expect(w.saved().shop.owned).toEqual(def.kind === 'entitlement' ? [id] : []);
    expect(w.newCalls()).toEqual(['iapFinish:tok-' + id]);
  });

  it('exact amounts: 1,000 / 5,500 / 12,000 / 26,000 / 70,000 coins; the starter pack 4,000 + 3 + 3 + 2', async () => {
    const w = world();
    const amounts: [ProductId, number][] = [['coins_small', 1000], ['coins_medium', 5500], ['coins_large', 12000], ['coins_xl', 26000], ['coins_mega', 70000], ['starter_pack', 4000], ['remove_ads', 0]];
    let n = 0;
    for (const [id, amount] of amounts) {
      const before = w.profile.coins();
      const outcome = w.store.buy(id);
      w.send({ type: 'purchase', id, state: 'purchased', token: 't' + n++ });
      expect(await outcome).toBe('purchased');
      expect(w.profile.coins() - before, id).toBe(amount);
    }
    expect(w.profile.data().boosters).toEqual({ ...NO_BOOSTERS, hammer: 3, freeSwap: 3, prism: 2 });
    expect(w.profile.coins()).toBe(2000 + 118_500);
  });

  it('the grant is in storage BEFORE the store is told to finish the purchase', async () => {
    const w = world();
    const before = w.device.log.length;
    const outcome = w.store.buy('starter_pack');
    w.send({ type: 'purchase', id: 'starter_pack', state: 'purchased', token: 'tok-S' });
    await outcome;
    // one save — rewards, token and ownership together — and only then the finish
    expect(w.device.log.slice(before)).toEqual(['iapBuy:starter_pack', 'save', 'iapFinish:tok-S']);
    expect(w.seenAtFinish).toHaveLength(1);
    const stored = w.seenAtFinish[0]!.saved!;
    expect(stored.coins).toBe(6000);
    expect(stored.boosters).toMatchObject({ hammer: 3, freeSwap: 3, prism: 2 });
    expect(stored.shop).toMatchObject({ tokens: ['tok-S'], owned: ['starter_pack'], purchased: true });
  });

  it('a purchase whose grant could not be saved is not finished — and is finished when it comes again', async () => {
    const w = world();
    w.device.storage.failing = true;
    const outcome = w.store.buy('coins_small');
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'tok-1' });
    expect(await outcome).toBe('purchased'); // the player has her coins…
    expect(w.profile.coins()).toBe(3000);
    expect(w.newCalls()).toEqual(['iapBuy:coins_small']); // …but the store keeps the purchase open
    // the app dies before anything could be saved: the next start grants it (once) and finishes it
    const next = w.restart();
    expect(next.profile.coins()).toBe(2000);
    w.device.storage.failing = false;
    next.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'tok-1' });
    expect(next.profile.coins()).toBe(3000);
    expect(next.newCalls()).toEqual(['iapFinish:tok-1']);
  });

  it('a save that failed and later succeeded: the re-delivered purchase is finished, not granted again', async () => {
    const w = world();
    w.device.storage.failing = true;
    const outcome = w.store.buy('coins_small');
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'tok-1' });
    await outcome;
    w.device.storage.failing = false;
    w.profile.addCoins(1); // any later save carries the grant and its token
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'tok-1' });
    expect(w.profile.coins()).toBe(3001);
    expect(w.newCalls()).toEqual(['iapBuy:coins_small', 'iapFinish:tok-1']);
  });

  it('the same token delivered twice (or ten times) grants once and finishes every time', async () => {
    const w = world();
    const outcome = w.store.buy('coins_medium');
    w.send({ type: 'purchase', id: 'coins_medium', state: 'purchased', token: 'tok-M' });
    w.send({ type: 'purchase', id: 'coins_medium', state: 'purchased', token: 'tok-M' });
    expect(await outcome).toBe('purchased');
    expect(w.profile.coins()).toBe(7500);
    expect(w.newCalls()).toEqual(['iapBuy:coins_medium', 'iapFinish:tok-M', 'iapFinish:tok-M']);
    for (let i = 0; i < 8; i++) w.send({ type: 'purchase', id: 'coins_medium', state: 'purchased', token: 'tok-M' });
    expect(w.profile.coins()).toBe(7500);
    expect(w.saved().shop.tokens).toEqual(['tok-M']);
    expect(w.newCalls()).toEqual(Array.from({ length: 8 }, () => 'iapFinish:tok-M'));
    // a different token for the same product IS another purchase
    w.send({ type: 'purchase', id: 'coins_medium', state: 'purchased', token: 'tok-M2' });
    expect(w.profile.coins()).toBe(13000);
  });

  it('real store tokens (hundreds of characters) are told apart and remembered across restarts', async () => {
    const w = world();
    const token = (n: number): string => 'kfnnpjhhgbncpmaefdjlhopi.AO-J1O' + 'y3pUDWZ8t5e9zQw7mXcVbNm1LkJhGfDsA2qWeRtYuIoP'.repeat(5) + n;
    for (const n of [1, 2]) w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: token(n) });
    expect(w.profile.coins()).toBe(4000);
    const next = w.restart();
    next.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: token(1) });
    next.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: token(3) });
    expect(next.profile.coins()).toBe(5000);
    expect(next.newCalls()).toEqual(['iapFinish:' + token(1), 'iapFinish:' + token(3)]);
  });

  it('cancelled, error and unavailable grant nothing', async () => {
    const w = world();
    for (const state of ['cancelled', 'error', 'unavailable'] as const) {
      const outcome = w.store.buy('coins_xl');
      w.send({ type: 'purchase', id: 'coins_xl', state });
      expect(await outcome).toBe(state);
    }
    expect(w.profile.coins()).toBe(2000);
    expect(w.saved()).toBeNull(); // nothing was ever written
    expect(w.newCalls()).toEqual(['iapBuy:coins_xl', 'iapBuy:coins_xl', 'iapBuy:coins_xl']);
    expect(w.profile.shop().purchased).toBe(false);
  });

  it('one purchase at a time: a second call while one is open resolves "error" without reaching the store', async () => {
    const w = world();
    const first = w.store.buy('coins_small');
    expect(await w.store.buy('coins_large')).toBe('error');
    expect(await w.store.buy('coins_small')).toBe('error');
    expect(w.newCalls()).toEqual(['iapBuy:coins_small']);
    // an event about another product does not answer the open purchase
    w.send({ type: 'purchase', id: 'coins_large', state: 'cancelled' });
    let settled = false;
    void first.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    w.send({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
    expect(await first).toBe('cancelled');
    // …and afterwards buying works again
    const again = w.store.buy('coins_large');
    w.send({ type: 'purchase', id: 'coins_large', state: 'purchased', token: 't' });
    expect(await again).toBe('purchased');
  });

  it('a "purchased" event without a usable token grants nothing', async () => {
    const w = world();
    for (const token of [undefined, '', null, 7, {}, 'x'.repeat(5000)]) {
      const outcome = w.store.buy('coins_mega');
      w.send({ type: 'purchase', id: 'coins_mega', state: 'purchased', token });
      expect(await outcome).toBe('error');
    }
    expect(w.profile.coins()).toBe(2000);
    expect(w.calls().filter((c) => c.indexOf('iapFinish') === 0)).toEqual([]);
  });

  it('a purchase flow that never answers is given up after ten minutes; a late result is still granted', async () => {
    const w = world();
    const outcome = w.store.buy('coins_small');
    vi.advanceTimersByTime(10 * MINUTE - SECOND);
    expect(await w.store.buy('coins_small')).toBe('error'); // still open
    vi.advanceTimersByTime(SECOND);
    expect(await outcome).toBe('error');
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'late' });
    expect(w.profile.coins()).toBe(3000);
    expect(w.newCalls()).toEqual(['iapBuy:coins_small', 'iapFinish:late']);
  });

  it('a bridge that throws never reaches the game', async () => {
    const w = world({ broken: ['iapBuy', 'iapFinish', 'iapRestore', 'iapQuery'] });
    expect(await w.store.buy('coins_small')).toBe('error');
    expect(await w.store.restore()).toBe(0);
    expect(() => w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 't1' })).not.toThrow();
    expect(w.profile.coins()).toBe(3000); // granted and saved; the finish will be retried when it is delivered again
    expect(w.saved().shop.tokens).toEqual(['t1']);
  });
});

describe('pending payments', () => {
  it('PENDING grants nothing; the grant happens when PURCHASED arrives — here in a later session', async () => {
    const w = world();
    const outcome = w.store.buy('coins_large');
    w.send({ type: 'purchase', id: 'coins_large', state: 'pending' });
    expect(await outcome).toBe('pending');
    expect(w.profile.coins()).toBe(2000);
    expect(w.saved()).toBeNull();
    expect(w.newCalls()).toEqual(['iapBuy:coins_large']);

    // days later, a new app start: the store re-delivers the completed purchase
    w.device.clock.now += 2 * 24 * 60 * MINUTE;
    const next = w.restart();
    expect(next.calls().slice(-2)).toEqual(['iapQuery', 'iapRestore']);
    next.send({ type: 'owned', ids: [] });
    next.send({ type: 'purchase', id: 'coins_large', state: 'purchased', token: 'tok-P' });
    expect(next.profile.coins()).toBe(14000);
    expect(next.saved().shop.tokens).toEqual(['tok-P']);
    expect(next.newCalls()).toEqual(['iapFinish:tok-P']);
    expect(next.changes.count).toBeGreaterThan(0);
  });

  it('…or in the same session, without anybody waiting for it', async () => {
    const w = world();
    const outcome = w.store.buy('starter_pack');
    w.send({ type: 'purchase', id: 'starter_pack', state: 'pending' });
    expect(await outcome).toBe('pending');
    expect(w.store.owns('starter_pack')).toBe(false);
    w.send({ type: 'purchase', id: 'starter_pack', state: 'purchased', token: 'tok-P' });
    expect(w.store.owns('starter_pack')).toBe(true);
    expect(w.profile.coins()).toBe(6000);
    expect(w.newCalls()).toEqual(['iapBuy:starter_pack', 'iapFinish:tok-P']);
  });

  it('a returning app asks the store for news (at most once a minute, never during a purchase)', async () => {
    const w = world();
    w.pause();
    w.device.clock.now += 30 * SECOND;
    w.resume();
    expect(w.newCalls()).toEqual([]); // asked half a minute ago, at start
    w.device.clock.now += 31 * SECOND;
    w.resume();
    expect(w.newCalls()).toEqual(['iapRestore']);
    w.device.clock.now += 5 * MINUTE;
    const outcome = w.store.buy('coins_small');
    w.pause(); // the store's own screen is in front
    w.resume();
    expect(w.newCalls()).toEqual(['iapBuy:coins_small']);
    w.send({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
    await outcome;
    // prices that never arrived are asked for again
    const quiet = world({ silent: true });
    quiet.device.clock.now += 2 * MINUTE;
    quiet.resume();
    expect(quiet.newCalls()).toEqual(['iapQuery', 'iapRestore']);
  });
});

describe('entitlements: already owned, restore, re-delivery', () => {
  it('an entitlement the player owns is not sold again: "alreadyOwned" without asking the store', async () => {
    const w = world();
    const outcome = w.store.buy('remove_ads');
    w.send({ type: 'purchase', id: 'remove_ads', state: 'purchased', token: 'tok-R' });
    expect(await outcome).toBe('purchased');
    w.newCalls();
    expect(await w.store.buy('remove_ads')).toBe('alreadyOwned');
    expect(w.newCalls()).toEqual([]);
    // consumables can always be bought again
    const more = w.store.buy('coins_small');
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'tok-C' });
    expect(await more).toBe('purchased');
  });

  it('the store says "alreadyOwned": nothing is recorded on that word alone — a listing is asked for, and IT restores ownership without the goodies', async () => {
    const w = world();
    const outcome = w.store.buy('starter_pack');
    w.send({ type: 'purchase', id: 'starter_pack', state: 'alreadyOwned' });
    expect(await outcome).toBe('alreadyOwned');
    // "already owned" is also what the store answers for a payment that is still pending: no proof
    expect(w.store.owns('starter_pack')).toBe(false);
    expect(w.profile.shop().purchased).toBe(false);
    expect(w.newCalls()).toEqual(['iapBuy:starter_pack', 'iapRestore']);
    w.send({ type: 'owned', ids: ['starter_pack'], complete: true }); // the listing that was asked for
    expect(w.store.owns('starter_pack')).toBe(true);
    expect(w.profile.coins()).toBe(2000);
    expect(w.profile.data().boosters).toEqual(NO_BOOSTERS);
    // a coin pack "already owned" is an earlier purchase that was never finished: nothing new was bought
    const pack = w.store.buy('coins_small');
    w.send({ type: 'purchase', id: 'coins_small', state: 'alreadyOwned' });
    expect(await pack).toBe('error');
    expect(w.newCalls()).toEqual(['iapBuy:coins_small', 'iapRestore']);
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'stuck' }); // the restore delivers it
    expect(w.profile.coins()).toBe(3000);
    expect(w.newCalls()).toEqual(['iapFinish:stuck']);
  });

  it('restore on a fresh profile brings back remove_ads and the starter pack WITHOUT its goodies', async () => {
    const w = world({ silent: true });
    w.send({ type: 'products', products: ALL_PRICES });
    const restored = w.store.restore();
    expect(w.newCalls()).toEqual(['iapRestore']);
    w.send({ type: 'owned', ids: ['remove_ads', 'starter_pack'] });
    vi.advanceTimersByTime(1000);
    expect(await restored).toBe(2);
    expect(w.store.owns('remove_ads')).toBe(true);
    expect(w.store.owns('starter_pack')).toBe(true);
    expect(w.profile.coins()).toBe(2000);
    expect(w.profile.data().boosters).toEqual(NO_BOOSTERS);
    expect(w.saved().shop).toMatchObject({ owned: ['remove_ads', 'starter_pack'], purchased: true, tokens: [] });
    expect(w.calls().filter((c) => c.indexOf('iapFinish') === 0)).toEqual([]);
    // asking again restores nothing new
    const again = w.store.restore();
    w.send({ type: 'owned', ids: ['remove_ads', 'starter_pack'] });
    vi.advanceTimersByTime(1000);
    expect(await again).toBe(0);
  });

  it('the automatic restore at start does the same, also when it arrives as acknowledged purchases', () => {
    const w = world({ silent: true });
    w.send({ type: 'purchase', id: 'starter_pack', state: 'purchased', token: 'old-S', acknowledged: true });
    w.send({ type: 'purchase', id: 'remove_ads', state: 'purchased', token: 'old-R', acknowledged: true });
    expect(w.store.owns('starter_pack')).toBe(true);
    expect(w.store.owns('remove_ads')).toBe(true);
    expect(w.profile.coins()).toBe(2000); // no second helping of the pack
    expect(w.profile.data().boosters).toEqual(NO_BOOSTERS);
    expect(w.saved().shop.tokens).toEqual([]);
    expect(w.calls()).toEqual(['iapQuery', 'iapRestore']); // already acknowledged: nothing to finish
    expect(w.changes.count).toBe(2);
  });

  it('a restore counts unfinished purchases that follow the list, and several callers share one answer', async () => {
    const w = world();
    const a = w.store.restore();
    const b = w.store.restore();
    expect(w.newCalls()).toEqual(['iapRestore']);
    w.send({ type: 'owned', ids: ['remove_ads'] });
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'unfinished' });
    vi.advanceTimersByTime(1000);
    expect(await a).toBe(2);
    expect(await b).toBe(2);
    expect(w.profile.coins()).toBe(3000);
  });

  it('a restore that gets no answer resolves by itself', async () => {
    const w = world();
    const restored = w.store.restore();
    vi.advanceTimersByTime(15 * SECOND);
    expect(await restored).toBe(0);
  });

  it('an unfinished purchase is delivered again at every start: granted before ⇒ only finished again', async () => {
    const w = world({ broken: ['iapFinish'] }); // the finish call is lost
    const outcome = w.store.buy('starter_pack');
    w.send({ type: 'purchase', id: 'starter_pack', state: 'purchased', token: 'tok-S' });
    await outcome;
    expect(w.profile.coins()).toBe(6000);

    const next = w.restart({ broken: [] });
    next.send({ type: 'owned', ids: [] }); // not acknowledged yet, so not listed
    next.send({ type: 'purchase', id: 'starter_pack', state: 'purchased', token: 'tok-S' });
    expect(next.profile.coins()).toBe(6000);
    expect(next.profile.data().boosters).toEqual({ ...NO_BOOSTERS, hammer: 3, freeSwap: 3, prism: 2 });
    expect(next.store.owns('starter_pack')).toBe(true);
    expect(next.newCalls()).toEqual(['iapFinish:tok-S']);
  });

  it('…never granted before (the app died between payment and grant) ⇒ granted now, then finished', () => {
    const w = world();
    w.send({ type: 'purchase', id: 'coins_xl', state: 'purchased', token: 'orphan' });
    expect(w.profile.coins()).toBe(28000);
    expect(w.device.log.slice(-2)).toEqual(['save', 'iapFinish:orphan']);
  });

  it('ownership is sticky: an empty list from a store that could not connect removes nothing', () => {
    const w = world({ save: { shop: { ...world().profile.shop(), owned: ['remove_ads', 'starter_pack'], purchased: true } } });
    expect(w.store.owns('remove_ads')).toBe(true);
    w.send({ type: 'owned', ids: [] });
    w.send({ type: 'owned', ids: ['starter_pack'] });
    w.send({ type: 'products', products: [] });
    expect(w.store.owns('remove_ads')).toBe(true);
    expect(w.store.owns('starter_pack')).toBe(true);
    expect(w.restart().store.owns('remove_ads')).toBe(true);
  });

  it('only a complete, successful listing clears what the store positively does not list', async () => {
    const w = world({ save: { shop: { ...world().profile.shop(), owned: ['remove_ads', 'starter_pack'], purchased: true } } });
    w.send({ type: 'owned', ids: ['starter_pack'], complete: true });
    expect(w.store.owns('remove_ads')).toBe(false); // e.g. refunded
    expect(w.store.owns('starter_pack')).toBe(true);
    expect(w.saved().shop.owned).toEqual(['starter_pack']);
    expect(w.saved().shop.purchased).toBe(true); // …but she is still someone who paid: no interstitials
    for (const complete of ['true', 1, {}, null]) w.send({ type: 'owned', ids: [], complete });
    expect(w.store.owns('starter_pack')).toBe(true);
    // bought a moment ago and not acknowledged yet: a listing that predates it must not undo it
    const outcome = w.store.buy('remove_ads');
    w.send({ type: 'purchase', id: 'remove_ads', state: 'purchased', token: 'new-R' });
    await outcome;
    w.send({ type: 'owned', ids: ['starter_pack'], complete: true });
    expect(w.store.owns('remove_ads')).toBe(true);
  });
});

describe('events the store cannot use', () => {
  it('garbage and unknown events are ignored: no throw, no grant, no bridge call, no notification', async () => {
    const w = world();
    const before = JSON.stringify(w.profile.data());
    const junk: unknown[] = [
      undefined, null, 0, 7, true, '', ' ', 'purchase', '{', '{"type":', '[]', '[{"type":"purchase"}]', 'null', '"text"', '{}',
      '{"type":5}', '{"type":"teleport","id":"coins_small"}', '{"type":"purchase"}', '{"type":"purchase","id":"coins_small"}',
      '{"type":"purchase","id":"coins_small","state":"refunded","token":"t"}', '{"type":"purchase","id":"gems","state":"purchased","token":"t"}',
      '{"type":"purchase","id":["coins_small"],"state":"purchased","token":"t"}', '{"type":"purchase","id":"__proto__","state":"purchased","token":"t"}',
      '{"type":"purchase","id":"constructor","state":"purchased","token":"t"}', '{"type":"products"}', '{"type":"products","products":"all"}',
      '{"type":"owned"}', '{"type":"owned","ids":"remove_ads"}', '{"type":"owned","ids":[5,null,"gems","coins_small",["remove_ads"]]}',
      '{"type":"adResult"}', '{"type":"adResult","format":"banner","result":"earned"}', '{"type":"adResult","format":"rewarded","result":"maybe"}',
      '{"__proto__":{"type":"purchase","id":"coins_small","state":"purchased","token":"t"}}', '\u0000', '{"type":"purchase","id":"coins_small","state":"purchased","token":"t"',
      { type: 'purchase', state: 'purchased', token: 't' }, ['purchase'], () => 'purchase', Symbol('event'), 10n,
    ];
    for (const event of junk) expect(() => w.store.receive(event), String(event)).not.toThrow();
    expect(JSON.stringify(w.profile.data())).toBe(before);
    expect(w.saved()).toBeNull();
    expect(w.newCalls()).toEqual([]);
    expect(w.changes.count).toBe(0);
    expect(w.store.products().length).toBe(7);
    // …and the store still works afterwards
    const outcome = w.store.buy('coins_small');
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'ok' });
    expect(await outcome).toBe('purchased');
  });

  it('an event that arrives as an object, or encoded twice, is understood all the same', () => {
    const w = world();
    w.store.receive({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'as-object' });
    w.store.receive(JSON.stringify(JSON.stringify({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'twice' })));
    expect(w.profile.coins()).toBe(4000);
  });

  it('a purchase of a product this game does not know is neither granted nor finished', () => {
    const w = world();
    w.send({ type: 'purchase', id: 'coins_galaxy', state: 'purchased', token: 'tok-X' });
    expect(w.profile.coins()).toBe(2000);
    expect(w.newCalls()).toEqual([]);
  });
});
