/**
 * Which store `createStore` picks, and the browser test store end to end (with scripted answers in
 * place of its overlays): it must go through the very same grant path as the Android store — and
 * must be impossible to reach where the Android bridge exists.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProfile, fixedOffsetDayNumber, freshSave } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { PlatformApi } from '../../src/platform/types.ts';
import { FAKE_PRICES, PRODUCT_IDS, createFakeBridge, createStore } from '../../src/monetize/index.ts';
import type { FakePurchaseChoice, FakeStorage, FakeUi, StoreDeps } from '../../src/monetize/index.ts';
import type { FullStoreApi, StoreEvent } from '../../src/monetize/types.ts';
import { DAY, T0 } from './harness.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function platform(kind: 'web' | 'android' = 'web'): PlatformApi {
  return {
    info: () => ({ versionName: 'test', versionCode: 1, locale: 'en-US', platform: kind }),
    loadSave: () => null,
    storeSave: () => {},
    haptic: () => {},
    setBackHandler: () => {},
    setAtRoot: () => {},
    rateApp: () => {},
    onPause: () => {},
    onResume: () => {},
  };
}

function profileOn(storage: { json: string | null }, cleared = 29): FullProfile {
  if (storage.json === null && cleared > 0) {
    const save = freshSave();
    for (let id = 1; id <= cleared; id++) save.levels[String(id)] = { stars: 1, best: 0 };
    save.firstDay = Math.floor(T0 / DAY) - 10;
    storage.json = JSON.stringify(save);
  }
  return createProfile({ load: () => storage.json, save: (json) => (storage.json = json), now: () => T0, levelCount: 120, dayNumber: fixedOffsetDayNumber(0) });
}

/** Scripted answers for the fake store's overlays, and a record of what it asked. */
function scriptedUi(): FakeUi & { next: FakePurchaseChoice; watch: boolean; asked: string[] } {
  const ui = {
    next: 'buy' as FakePurchaseChoice,
    watch: true,
    asked: [] as string[],
    purchase(info: { id: string; price: string }): Promise<FakePurchaseChoice> {
      ui.asked.push('purchase ' + info.id + ' ' + info.price);
      return Promise.resolve(ui.next);
    },
    ad(format: 'rewarded' | 'interstitial', placement: string | null): Promise<boolean> {
      ui.asked.push('ad ' + format + (placement ? ' ' + placement : ''));
      return Promise.resolve(ui.watch);
    },
    privacy(): Promise<void> {
      ui.asked.push('privacy');
      return Promise.resolve();
    },
  };
  return ui;
}

function memory(): FakeStorage & { text: string | null } {
  const box = { text: null as string | null, read: (): string | null => box.text, write: (text: string): void => void (box.text = text) };
  return box;
}

/** Let the fake bridge's deferred events (setTimeout 0) and the promises around them run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(1);
}

function fakeStore(profile: FullProfile, ui: FakeUi, account: FakeStorage): FullStoreApi {
  return createStore({ profile, platform: platform(), now: () => T0, mode: 'fake', fakeUi: ui, fakeStorage: account });
}

describe('which store', () => {
  const deps = (extra: Partial<StoreDeps> = {}): StoreDeps => ({ profile: profileOn({ json: null }), platform: platform(), now: () => T0, ...extra });

  async function isOff(store: FullStoreApi): Promise<boolean> {
    await settle();
    return !store.iapAvailable() && !store.adsAvailable() && store.products().length === 0 && (await store.buy('coins_small')) === 'unavailable';
  }

  it('"off", and anywhere without a window (Node): everything unavailable and every promise answered', async () => {
    for (const store of [createStore(deps({ mode: 'off' })), createStore(deps())]) {
      expect(await isOff(store)).toBe(true);
      expect(await store.restore()).toBe(0);
      expect(store.owns('remove_ads')).toBe(false);
      expect(store.rewardedReady()).toBe(false);
      expect(store.freeCoinAdsLeft()).toBe(0);
      expect(store.rewardedLeft('freeLife')).toBe(0);
      expect(await store.showRewarded('freeCoins')).toBe('unavailable');
      expect(await store.maybeShowInterstitial()).toBe(false);
      expect(store.privacyOptionsRequired()).toBe(false);
      await store.showPrivacyOptions();
      store.onChange(() => {})();
    }
  });

  it('a profile without the store’s bookkeeping, or nonsense dependencies, give the "off" store instead of an error', async () => {
    const plain = { coins: () => 0 } as unknown as FullProfile;
    expect(await isOff(createStore({ profile: plain, platform: platform(), mode: 'fake', fakeUi: scriptedUi() }))).toBe(true);
    for (const bad of [undefined, null, {}, { profile: null }, { profile: profileOn({ json: null }) }]) {
      expect(await isOff(createStore(bad as unknown as StoreDeps))).toBe(true);
    }
  });

  it('in a browser: the test store with ?fakestore=1 or under the dev server, never with ?fakestore=0', async () => {
    const ui = scriptedUi();
    const open = (search: string): FullStoreApi => {
      vi.stubGlobal('window', { location: { search, hostname: 'localhost' } });
      return createStore(deps({ fakeUi: ui, fakeStorage: memory() }));
    };
    expect(await isOff(open('?fakestore=1'))).toBe(false);
    expect(await isOff(open('?lang=ar&fakestore=1&x=2'))).toBe(false);
    expect(await isOff(open('?fakestore=0'))).toBe(true);
    // No flag: only the dev server (vitest runs with DEV on, a production bundle with DEV off).
    expect(await isOff(open(''))).toBe(!import.meta.env.DEV);
    expect(await isOff(open('?notfakestore=1'))).toBe(!import.meta.env.DEV);
  });

  it('inside the Android wrapper: the real store through window.__native.store', async () => {
    const calls: string[] = [];
    const native: Record<string, unknown> = { back: () => {} };
    const bridge = {
      storeCaps: () => '{"billing":true,"ads":false}',
      iapQuery: () => void calls.push('iapQuery'),
      iapBuy: (id: string) => void calls.push('iapBuy:' + id),
      iapFinish: (token: string) => void calls.push('iapFinish:' + token),
      iapRestore: () => void calls.push('iapRestore'),
      adShowRewarded: () => {},
      adShowInterstitial: () => {},
      adPrivacyOptions: () => {},
      storeSync: () => void calls.push('storeSync'),
    };
    vi.stubGlobal('window', { AndroidBridge: bridge, __native: native, location: { search: '?fakestore=1', hostname: 'appassets.androidplatform.net' } });
    const profile = profileOn({ json: null });
    const store = createStore({ profile, platform: platform('android'), now: () => T0 });
    expect(calls).toEqual(['storeSync', 'iapQuery', 'iapRestore']);
    expect(typeof native.store).toBe('function');
    expect(typeof native.back).toBe('function'); // the platform's hooks are still there
    const emit = (event: StoreEvent): void => (native.store as (json: string) => void)(JSON.stringify(event));
    emit({ type: 'products', products: [{ id: 'coins_small', price: '٣٫٩٩ ر.س' }] });
    expect(store.products()).toEqual([{ def: expect.objectContaining({ id: 'coins_small' }), info: { id: 'coins_small', price: '٣٫٩٩ ر.س' } }]);
    const outcome = store.buy('coins_small');
    emit({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'tok-1' });
    expect(await outcome).toBe('purchased');
    expect(profile.coins()).toBe(3000);
    expect(calls.slice(3)).toEqual(['iapBuy:coins_small', 'iapFinish:tok-1']);
    expect(() => (native.store as (json: unknown) => void)('{{garbage')).not.toThrow();
  });

  it('the test store cannot be reached where the Android bridge exists — whatever is asked for', async () => {
    const ui = scriptedUi();
    const withoutStore = { loadSave: () => '', storeSave: () => {} }; // a wrapper built before purchases existed
    const cases: [string, Record<string, unknown>, 'web' | 'android'][] = [
      ['a bridge without monetisation', { AndroidBridge: withoutStore, location: { search: '?fakestore=1', hostname: 'appassets.androidplatform.net' } }, 'android'],
      ['…even if the platform were misdetected', { AndroidBridge: withoutStore, location: { search: '?fakestore=1', hostname: 'localhost' } }, 'web'],
      ['no bridge, but the platform says Android', { location: { search: '?fakestore=1', hostname: 'localhost' } }, 'android'],
      ['no bridge, but the wrapper’s asset host', { location: { search: '?fakestore=1', hostname: 'appassets.androidplatform.net' } }, 'web'],
    ];
    for (const [name, win, kind] of cases) {
      for (const mode of ['auto', 'fake'] as const) {
        vi.stubGlobal('window', win);
        const store = createStore({ profile: profileOn({ json: null }), platform: platform(kind), mode, fakeUi: ui, fakeStorage: memory() });
        expect(await isOff(store), name + ' / ' + mode).toBe(true);
      }
    }
    expect(ui.asked).toEqual([]);
  });

  it('a hostile window never makes createStore throw', async () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('no');
        },
      },
    );
    vi.stubGlobal('window', hostile);
    expect(await isOff(createStore(deps()))).toBe(true);
  });
});

describe('the test store', () => {
  it('lists every product with its test price, and ads are ready', async () => {
    const store = fakeStore(profileOn({ json: null }), scriptedUi(), memory());
    expect(store.iapAvailable()).toBe(false); // like the real one, it answers a moment later
    await settle();
    expect(store.products().map((p) => [p.def.id, p.info.price])).toEqual(PRODUCT_IDS.map((id) => [id, FAKE_PRICES[id]]));
    expect(FAKE_PRICES).toEqual({ coins_small: 'US$0.99', coins_medium: 'US$4.99', coins_large: 'US$9.99', coins_xl: 'US$19.99', coins_mega: 'US$49.99', starter_pack: 'US$1.99', remove_ads: 'US$2.99' });
    expect(store.adsAvailable()).toBe(true);
    expect(store.rewardedReady()).toBe(true);
    expect(store.privacyOptionsRequired()).toBe(true);
  });

  it('Buy grants through the normal path (token remembered, purchase finished); Cancel grants nothing', async () => {
    const storage = { json: null as string | null };
    const profile = profileOn(storage);
    const ui = scriptedUi();
    const account = memory();
    const store = fakeStore(profile, ui, account);
    await settle();
    const buying = store.buy('coins_medium');
    await settle();
    expect(await buying).toBe('purchased');
    expect(ui.asked).toEqual(['purchase coins_medium US$4.99']);
    expect(profile.coins()).toBe(7500);
    expect(profile.shop().tokens).toHaveLength(1);
    expect(JSON.parse(account.text!).open).toEqual([]); // finished ⇒ consumed in the pretend account
    ui.next = 'cancel';
    const cancelled = store.buy('coins_mega');
    await settle();
    expect(await cancelled).toBe('cancelled');
    expect(profile.coins()).toBe(7500);
  });

  it('an entitlement is sold once; after a "reinstall" a restore brings it back without the goodies', async () => {
    const account = memory();
    const first = profileOn({ json: null });
    const ui = scriptedUi();
    const store = fakeStore(first, ui, account);
    await settle();
    const buying = store.buy('starter_pack');
    await settle();
    expect(await buying).toBe('purchased');
    expect(first.coins()).toBe(6000);
    expect(first.boosterCount('hammer')).toBe(3);
    expect(await store.buy('starter_pack')).toBe('alreadyOwned');
    expect(ui.asked).toHaveLength(1);

    // a new install on the same store account: a fresh profile
    const second = profileOn({ json: null });
    const again = fakeStore(second, ui, account);
    await settle(); // the automatic restore at start
    expect(again.owns('starter_pack')).toBe(true);
    expect(second.coins()).toBe(2000);
    expect(second.boosterCount('hammer')).toBe(0);
    expect(second.shop()).toMatchObject({ owned: ['starter_pack'], purchased: true, tokens: [] });
    expect(await again.maybeShowInterstitial()).toBe(false);
    expect(await again.maybeShowInterstitial()).toBe(false);
    expect(await again.maybeShowInterstitial()).toBe(false); // an owner: never an interstitial
  });

  it('a prepared save that already owns an entitlement keeps it: the pretend account adopts it', async () => {
    const storage = { json: null as string | null };
    const prepared = freshSave();
    prepared.shop.owned = ['remove_ads'];
    prepared.shop.purchased = true;
    storage.json = JSON.stringify(prepared);
    const profile = profileOn(storage, 0);
    const store = fakeStore(profile, scriptedUi(), memory());
    await settle(); // the start-up restore answers with a complete list
    expect(store.owns('remove_ads')).toBe(true);
    expect(await store.buy('remove_ads')).toBe('alreadyOwned');
  });

  it('"Pay later" is a pending payment: granted when the store is asked again, e.g. at the next start', async () => {
    const storage = { json: null as string | null };
    const account = memory();
    const ui = scriptedUi();
    ui.next = 'pending';
    const profile = profileOn(storage);
    const store = fakeStore(profile, ui, account);
    await settle();
    const buying = store.buy('coins_large');
    await settle();
    expect(await buying).toBe('pending');
    expect(profile.coins()).toBe(2000);
    const next = profileOn(storage);
    fakeStore(next, ui, account);
    await settle();
    expect(next.coins()).toBe(14000);
    expect(JSON.parse(account.text!)).toMatchObject({ open: [], pending: [] });
    // and exactly once
    const third = profileOn(storage);
    fakeStore(third, ui, account);
    await settle();
    expect(third.coins()).toBe(14000);
  });

  it('a purchase that was paid but never finished is delivered again by the pretend account', async () => {
    const account = memory();
    const events: StoreEvent[] = [];
    const bridge = createFakeBridge({ emit: (json) => void events.push(JSON.parse(json) as StoreEvent), ui: scriptedUi(), storage: account });
    bridge.iapBuy('remove_ads');
    await settle();
    const bought = events.filter((e) => e.type === 'purchase')[0] as Extract<StoreEvent, { type: 'purchase' }>;
    expect(bought).toMatchObject({ id: 'remove_ads', state: 'purchased', acknowledged: false });
    // the game never calls iapFinish (it crashed): a new bridge on the same account re-delivers it
    events.length = 0;
    const next = createFakeBridge({ emit: (json) => void events.push(JSON.parse(json) as StoreEvent), ui: scriptedUi(), storage: account });
    next.iapRestore();
    await settle();
    // (the list is not marked complete while a paid entitlement still waits to be acknowledged)
    expect(events).toEqual([
      { type: 'owned', ids: [] },
      { type: 'purchase', id: 'remove_ads', state: 'purchased', token: bought.token, acknowledged: false },
    ]);
    next.iapBuy('remove_ads'); // paid for already
    next.iapFinish(bought.token!);
    events.length = 0;
    next.iapRestore();
    await settle();
    expect(events).toEqual([{ type: 'purchase', id: 'remove_ads', state: 'alreadyOwned' }, { type: 'owned', ids: ['remove_ads'], complete: true }]);
  });

  it('a damaged pretend account and odd requests are harmless', async () => {
    for (const text of ['{broken', 'null', '[]', '{"owned":"all","open":[{"id":"gems","token":5},null],"pending":7,"seq":-1}']) {
      const account = memory();
      account.text = text;
      const events: StoreEvent[] = [];
      const bridge = createFakeBridge({ emit: (json) => void events.push(JSON.parse(json) as StoreEvent), ui: scriptedUi(), storage: account });
      bridge.iapRestore();
      bridge.iapQuery('not json');
      bridge.iapBuy('gems');
      bridge.iapFinish('unknown');
      await settle();
      expect(events).toEqual([{ type: 'owned', ids: [], complete: true }, { type: 'products', products: [] }, { type: 'purchase', id: 'gems', state: 'unavailable' }]);
    }
  });

  it('test ads: watched to the end is earned, closed early is not; interstitials follow the real rules', async () => {
    const profile = profileOn({ json: null });
    const ui = scriptedUi();
    const store = fakeStore(profile, ui, memory());
    await settle();
    const earned = store.showRewarded('freeCoins');
    await settle();
    expect(await earned).toBe('earned');
    expect(store.freeCoinAdsLeft()).toBe(2);
    ui.watch = false;
    const closed = store.showRewarded('freeCoins');
    await settle();
    expect(await closed).toBe('dismissed');
    expect(store.freeCoinAdsLeft()).toBe(2);
    expect(ui.asked).toEqual(['ad rewarded freeCoins', 'ad rewarded freeCoins']);
    // a rewarded ad was just on screen: no interstitial for ten minutes, however many levels end
    for (let i = 0; i < 6; i++) expect(await store.maybeShowInterstitial()).toBe(false);
    expect(ui.asked).toHaveLength(2);
    const form = store.showPrivacyOptions();
    await settle();
    await form;
    expect(ui.asked[2]).toBe('privacy');
  });
});
