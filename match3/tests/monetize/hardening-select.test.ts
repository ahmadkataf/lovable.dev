/**
 * Which store a page gets — and that the browser test store can never be the one inside the app —
 * plus the test store itself under random use: page reloads at any moment, a save that fails
 * loudly or silently, purchases bought, cancelled or left pending. Its pretend account is the
 * ledger: in the end the player holds exactly what the account was charged for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProfile, fixedOffsetDayNumber } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { PlatformApi } from '../../src/platform/types.ts';
import { createPlatform } from '../../src/platform/index.ts';
import { createFakeBridge, createStore } from '../../src/monetize/index.ts';
import type { FakePurchaseChoice, FakeStorage, FakeUi, StoreDeps, StoreMode } from '../../src/monetize/index.ts';
import type { FullStoreApi, ProductId, StoreEvent } from '../../src/monetize/types.ts';
import { T0, promiseBook, rng, veteranSave } from './hardening-kit.ts';

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

function profile(): FullProfile {
  const disk = { json: JSON.stringify(veteranSave(29, 10)) };
  return createProfile({ load: () => disk.json, save: (json) => void (disk.json = json), now: () => T0, levelCount: 120, dayNumber: fixedOffsetDayNumber(0) });
}

const quietUi: FakeUi & { asked: number } = {
  asked: 0,
  purchase: () => {
    quietUi.asked += 1;
    return Promise.resolve<FakePurchaseChoice>('buy');
  },
  ad: () => {
    quietUi.asked += 1;
    return Promise.resolve(true);
  },
  privacy: () => {
    quietUi.asked += 1;
    return Promise.resolve();
  },
};

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(1);
}

async function isOff(store: FullStoreApi): Promise<boolean> {
  await settle();
  return !store.iapAvailable() && !store.adsAvailable() && store.products().length === 0 && (await store.buy('coins_small')) === 'unavailable' && (await store.showRewarded('freeCoins')) === 'unavailable';
}

const WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
const CHROME_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

describe('the test store cannot be reached inside the app', () => {
  function open(win: Record<string, unknown>, mode: StoreMode, kind: 'web' | 'android' = 'web'): FullStoreApi {
    vi.stubGlobal('window', win);
    const deps: StoreDeps = { profile: profile(), platform: platform(kind), now: () => T0, mode, fakeUi: quietUi, fakeStorage: { read: () => null, write: () => {} } };
    return createStore(deps);
  }

  it('an Android WebView is an app, not a browser: no test store even if the bridge were missing, the host different and the flag set', async () => {
    quietUi.asked = 0;
    const location = { search: '?fakestore=1', hostname: 'localhost' };
    for (const mode of ['auto', 'fake'] as const) {
      expect(await isOff(open({ location, navigator: { userAgent: WEBVIEW } }, mode)), mode).toBe(true);
      expect(await isOff(open({ location, navigator: { userAgent: WEBVIEW.replace('; wv)', ';wv)') } }, mode)), mode).toBe(true);
    }
    expect(quietUi.asked).toBe(0);
  });

  it('a real browser — on a phone or a desktop — still gets it with ?fakestore=1', async () => {
    const location = { search: '?fakestore=1', hostname: 'localhost' };
    for (const userAgent of [CHROME_ANDROID, CHROME_DESKTOP, '', undefined]) {
      expect(await isOff(open({ location, navigator: { userAgent } }, 'auto')), String(userAgent)).toBe(false);
    }
    expect(await isOff(open({ location }, 'auto'))).toBe(false); // no navigator at all
  });

  it('every other sign of the app is enough on its own, and nothing about the page can argue with it', async () => {
    quietUi.asked = 0;
    const flag = { search: '?fakestore=1&debug=1', hostname: 'localhost' };
    const bridgeWithoutStore = { loadSave: () => '', storeSave: () => {} };
    const bridgeWhoseCapsThrow = { storeCaps: () => { throw new Error('no'); } };
    const windows: [string, Record<string, unknown>, 'web' | 'android'][] = [
      ['the bridge object', { AndroidBridge: bridgeWithoutStore, location: flag }, 'web'],
      ['the platform module', { location: flag }, 'android'],
      ['the asset host', { location: { search: '?fakestore=1', hostname: 'appassets.androidplatform.net' } }, 'web'],
      ['the user agent', { location: flag, navigator: { userAgent: WEBVIEW } }, 'web'],
      ['an empty bridge object', { AndroidBridge: {}, location: flag }, 'web'],
      ['a bridge whose members cannot be read', { AndroidBridge: new Proxy({}, { get: () => { throw new Error('no'); } }), location: flag }, 'web'],
    ];
    for (const [name, win, kind] of windows) {
      for (const mode of ['auto', 'fake'] as const) expect(await isOff(open(win, mode, kind)), name + ' / ' + mode).toBe(true);
    }
    expect(quietUi.asked).toBe(0);
    // a bridge that has storeCaps but fails at it: the real store path, with nothing available — still no test store
    const store = open({ AndroidBridge: bridgeWhoseCapsThrow, location: flag }, 'auto', 'android');
    expect(await isOff(store)).toBe(true);
    expect(quietUi.asked).toBe(0);
  });

  it('a window whose every property throws gives the "off" store', async () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('no'); }, has: () => { throw new Error('no'); } });
    for (const mode of ['auto', 'fake', 'off'] as const) {
      vi.stubGlobal('window', hostile);
      const store = createStore({ profile: profile(), platform: platform(), mode });
      expect(await isOff(store)).toBe(true);
    }
  });

  it('?fakestore must be exactly 1: look-alikes do not open the test store in a production page', async () => {
    // (under vitest the dev-server default applies, so only the explicit "0" and the parsing can be told apart here)
    for (const search of ['?fakestore=0', '?x=1&fakestore=0', '?fakestore=0&fakestore=1']) {
      expect(await isOff(open({ location: { search, hostname: 'localhost' } }, 'auto')), search).toBe(true);
    }
  });
});

// ───────────────────────────── Android: the real platform module underneath ─────────────────────────────

describe('the Android store on the real platform module (the wiring of src/main.ts)', () => {
  /** A pretend wrapper: its own save, and switches for the ways its storage can fail. */
  function wrapper(initialSave: string = ''): {
    win: Record<string, unknown>;
    state: { save: string; dropWrites: boolean; throwOnWrite: boolean; emptyReads: boolean; throwOnRead: boolean };
    mirror: { text: string | null; failing: boolean };
    finishes: string[];
    start(): { profile: FullProfile; store: FullStoreApi; emit(event: Record<string, unknown>): void };
  } {
    const state = { save: initialSave, dropWrites: false, throwOnWrite: false, emptyReads: false, throwOnRead: false };
    const mirror = { text: null as string | null, failing: false };
    const finishes: string[] = [];
    const native: Record<string, unknown> = {};
    const bridge = {
      loadSave: (): string => {
        if (state.throwOnRead) throw new Error('Java exception');
        return state.emptyReads ? '' : state.save;
      },
      storeSave: (json: string): void => {
        if (state.throwOnWrite) throw new Error('Java exception');
        if (!state.dropWrites) state.save = json;
      },
      haptic: () => {},
      setAtRoot: () => {},
      info: () => '{"versionName":"1.0.0","versionCode":1,"locale":"en-US"}',
      rate: () => {},
      storeCaps: () => '{"billing":true,"ads":false}',
      iapQuery: () => {},
      iapBuy: () => {},
      iapFinish: (token: string) => void finishes.push(token),
      iapRestore: () => {},
      adShowRewarded: () => {},
      adShowInterstitial: () => {},
      adPrivacyOptions: () => {},
    };
    const localStorage = {
      getItem: (): string | null => {
        if (mirror.failing) throw new Error('storage disabled');
        return mirror.text;
      },
      setItem: (_key: string, value: string): void => {
        if (mirror.failing) throw new Error('quota');
        mirror.text = value;
      },
    };
    const win: Record<string, unknown> = { AndroidBridge: bridge, __native: native, localStorage, location: { search: '', hostname: 'appassets.androidplatform.net' }, navigator: { language: 'en-US', userAgent: WEBVIEW } };
    return {
      win,
      state,
      mirror,
      finishes,
      start: () => {
        vi.stubGlobal('window', win);
        const device = createPlatform();
        expect(device.info().platform).toBe('android');
        const player = createProfile({ load: () => device.loadSave(), save: (json) => device.storeSave(json), now: () => T0, levelCount: 120, dayNumber: fixedOffsetDayNumber(0) });
        const store = createStore({ profile: player, platform: device, now: () => T0 });
        const emit = (event: Record<string, unknown>): void => (win.__native as { store(json: string): void }).store(JSON.stringify(event));
        return { profile: player, store, emit };
      },
    };
  }
  const bought = (token: string): Record<string, unknown> => ({ type: 'purchase', id: 'coins_large', state: 'purchased', token });
  const inWrapper = (w: { state: { save: string } }, token: string): boolean => w.state.save.length > 0 && (JSON.parse(w.state.save) as { shop: { tokens: string[] } }).shop.tokens.indexOf(token) >= 0;

  it('a healthy wrapper: saved through the bridge, found in the wrapper’s copy, then finished', () => {
    const w = wrapper();
    const app = w.start();
    app.emit(bought('GPA.1'));
    expect(app.profile.coins()).toBe(14_000);
    expect(inWrapper(w, 'GPA.1')).toBe(true);
    expect(w.finishes).toEqual(['GPA.1']);
  });

  it('DEFECT: the wrapper has a save and silently drops the new one — the mirror copy in the WebView must not vouch for the purchase', () => {
    const w = wrapper();
    const app = w.start();
    app.profile.markSeen('played-a-bit'); // the wrapper holds a save of its own now
    expect(w.state.save.length).toBeGreaterThan(0);
    w.state.dropWrites = true;
    app.emit(bought('GPA.1'));
    expect(app.profile.coins()).toBe(14_000);
    expect(JSON.parse(w.mirror.text!).shop.tokens).toEqual(['GPA.1']); // the mirror did get it…
    expect(inWrapper(w, 'GPA.1')).toBe(false); // …the wrapper did not
    expect(w.finishes).toEqual([]); // so: not finished
    // what the next launch would really load is the wrapper's older copy: the purchase must still be deliverable
    const next = w.start();
    expect(next.profile.coins()).toBe(2_000);
    w.state.dropWrites = false;
    next.emit(bought('GPA.1'));
    expect(next.profile.coins()).toBe(14_000);
    expect(inWrapper(w, 'GPA.1')).toBe(true);
    expect(w.finishes).toEqual(['GPA.1']);
  });

  it('the same when the wrapper’s storeSave throws', () => {
    const w = wrapper();
    const app = w.start();
    app.profile.markSeen('played-a-bit');
    w.state.throwOnWrite = true;
    app.emit(bought('GPA.1'));
    expect(w.finishes).toEqual([]);
    w.state.throwOnWrite = false;
    app.emit(bought('GPA.1'));
    expect(w.finishes).toEqual([]); // nothing was saved since
    app.profile.markSeen('x');
    app.emit(bought('GPA.1'));
    expect(w.finishes).toEqual(['GPA.1']);
    expect(app.profile.coins()).toBe(14_000);
  });

  it('a double failure — the write is dropped AND the wrapper answers the read-back with nothing: not finished either', () => {
    const w = wrapper();
    const app = w.start();
    app.profile.markSeen('played-a-bit');
    w.state.dropWrites = true;
    w.state.emptyReads = true; // the platform now falls back to the mirror, which has the purchase…
    app.emit(bought('GPA.1'));
    expect(JSON.parse(w.mirror.text!).shop.tokens).toEqual(['GPA.1']);
    expect(w.finishes).toEqual([]); // …but a wrapper that HAD a save and now shows none proves nothing
    w.state.emptyReads = false;
    w.state.throwOnRead = true;
    app.emit(bought('GPA.1'));
    expect(w.finishes).toEqual([]);
    w.state.throwOnRead = false;
    w.state.dropWrites = false;
    app.profile.markSeen('y');
    app.emit(bought('GPA.1'));
    expect(w.finishes).toEqual(['GPA.1']);
  });

  it('a wrapper that never stored anything: the mirror IS the save — finished, and still there after a restart', () => {
    const w = wrapper();
    w.state.dropWrites = true; // from the very first launch
    const app = w.start();
    app.emit(bought('GPA.1'));
    expect(w.state.save).toBe('');
    expect(w.finishes).toEqual(['GPA.1']);
    const next = w.start(); // the next launch loads the mirror
    expect(next.profile.coins()).toBe(14_000);
    next.emit(bought('GPA.1'));
    expect(next.profile.coins()).toBe(14_000);
  });

  it('neither the wrapper nor the mirror keeps the save: granted in memory, never finished', () => {
    const w = wrapper();
    w.state.dropWrites = true;
    w.mirror.failing = true;
    const app = w.start();
    app.emit(bought('GPA.1'));
    app.emit(bought('GPA.1'));
    expect(app.profile.coins()).toBe(14_000);
    expect(w.finishes).toEqual([]);
    const next = w.start();
    expect(next.profile.coins()).toBe(2_000); // nothing survived — and nothing was consumed
  });
});

// ───────────────────────────── the test store under random use ─────────────────────────────

const GRANT: Record<string, number> = { coins_small: 1000, coins_medium: 5500, coins_large: 12000, coins_xl: 26000, coins_mega: 70000, starter_pack: 4000, remove_ads: 0 };
const IDS = Object.keys(GRANT) as ProductId[];

describe('the test store under random use', () => {
  it('25 runs: reloads, failing saves, bought / pending / cancelled — in the end coins == 2,000 + everything the account was charged for', async () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = rng(seed * 977);
      const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
      const disk = { json: JSON.stringify(veteranSave(29, 10)), mode: 'ok' as 'ok' | 'throws' | 'silent' };
      const account = { text: null as string | null };
      const book = promiseBook();
      /** What the tester answered in the purchase sheet, per product: the account was charged for these. */
      const charged: string[] = [];
      let nextChoice: FakePurchaseChoice = 'buy';
      let alive = { yes: true };
      let store!: FullStoreApi;
      let player!: FullProfile;

      const load = (): void => {
        alive.yes = false; // the old page is gone: it writes nothing any more
        const mine = { yes: true };
        alive = mine;
        player = createProfile({
          load: () => disk.json,
          save: (json) => {
            if (!mine.yes) return;
            if (disk.mode === 'throws') throw new Error('disk full');
            if (disk.mode === 'ok') disk.json = json;
          },
          now: () => T0,
          levelCount: 120,
          dayNumber: fixedOffsetDayNumber(0),
        });
        const ui: FakeUi = {
          purchase: (info) => {
            if (!mine.yes) return new Promise<FakePurchaseChoice>(() => {}); // a sheet of a dead page is never answered
            const choice = nextChoice;
            if (choice !== 'cancel') charged.push(info.id);
            return Promise.resolve(choice);
          },
          ad: () => Promise.resolve(random() < 0.7),
          privacy: () => Promise.resolve(),
        };
        const storage: FakeStorage = { read: () => account.text, write: (text) => void (mine.yes ? (account.text = text) : 0) };
        store = createStore({ profile: player, platform: platform(), now: () => T0, mode: 'fake', fakeUi: ui, fakeStorage: storage });
      };

      const paidFor = (): number => charged.reduce((sum, id) => sum + GRANT[id]!, 0);

      load();
      await settle();
      for (let step = 0; step < 120; step++) {
        const r = random();
        if (r < 0.45) {
          nextChoice = pick<FakePurchaseChoice>(['buy', 'buy', 'pending', 'cancel']);
          void book.track('buy', store.buy(pick(IDS)));
          // the tester's click and the account being charged are one step (a click handler runs to
          // its end before a page can go away); the EVENT about it travels later and may be lost
          for (let i = 0; i < 4; i++) await Promise.resolve();
        } else if (r < 0.55) {
          void book.track('restore', store.restore());
        } else if (r < 0.65) {
          if (random() < 0.5) void book.track('ad', store.showRewarded('freeCoins'));
          else void book.track('ad', store.maybeShowInterstitial());
        } else if (r < 0.8) {
          disk.mode = pick(['ok', 'ok', 'throws', 'silent'] as const);
        } else if (r < 0.92) {
          load(); // the page is reloaded — possibly with a purchase half done
        }
        if (random() < 0.7) await settle();
        // never more than was paid for
        expect(player.coins(), 'seed ' + seed + ' step ' + step).toBeLessThanOrEqual(2000 + paidFor());
      }

      // the end: storage works, the page is loaded once more, and the store is asked what is owned
      disk.mode = 'ok';
      await settle();
      load();
      await settle();
      void book.track('restore', store.restore());
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(player.coins(), 'seed ' + seed).toBe(2000 + paidFor());
      expect(JSON.parse(disk.json).coins).toBe(2000 + paidFor());
      for (const id of ['starter_pack', 'remove_ads'] as const) expect(store.owns(id), 'seed ' + seed + ' ' + id).toBe(charged.indexOf(id) >= 0);
      expect(charged.filter((id) => id === 'starter_pack').length).toBeLessThanOrEqual(1); // sold once
      expect(player.boosterCount('hammer')).toBe(charged.indexOf('starter_pack') >= 0 ? 3 : 0);
      // nothing is left open in the pretend account: every purchase was finished
      const left = JSON.parse(account.text || '{"open":[],"pending":[]}') as { open: unknown[]; pending: unknown[] };
      expect(left.open).toEqual([]);
      expect(left.pending).toEqual([]);
      await vi.advanceTimersByTimeAsync(3 * 3_600_000);
      expect(book.rejected).toEqual([]);
      // (promises of pages that were reloaded away with a sheet open belong to dead pages; the live ones all settled)
    }
  }, 120_000);

  it('the pretend account marks a listing complete only when no paid entitlement is still waiting to be acknowledged', async () => {
    const account = { text: null as string | null };
    const storage: FakeStorage = { read: () => account.text, write: (text) => void (account.text = text) };
    const events: StoreEvent[] = [];
    const ui: FakeUi = { purchase: () => Promise.resolve<FakePurchaseChoice>('buy'), ad: () => Promise.resolve(true), privacy: () => Promise.resolve() };
    const bridge = createFakeBridge({ emit: (json) => void events.push(JSON.parse(json) as StoreEvent), ui, storage });
    bridge.iapBuy('coins_small');
    await settle();
    events.length = 0;
    bridge.iapRestore();
    await settle();
    expect(events[0]).toEqual({ type: 'owned', ids: [], complete: true }); // an unfinished coin pack does not matter
    bridge.iapBuy('remove_ads');
    await settle();
    events.length = 0;
    bridge.iapRestore();
    await settle();
    expect(events[0]).toEqual({ type: 'owned', ids: [] }); // paid, not acknowledged yet: not the whole truth
    const token = (events.filter((e) => e.type === 'purchase' && e.id === 'remove_ads')[0] as { token: string }).token;
    bridge.iapFinish(token);
    events.length = 0;
    bridge.iapRestore();
    await settle();
    expect(events[0]).toEqual({ type: 'owned', ids: ['remove_ads'], complete: true });
  });

  it('an overlay that cannot even be opened counts as closed: the next purchase and the next ad still work', async () => {
    const events: StoreEvent[] = [];
    let broken = true;
    const ui: FakeUi = {
      purchase: () => {
        if (broken) throw new Error('no document');
        return Promise.resolve<FakePurchaseChoice>('buy');
      },
      ad: () => {
        if (broken) throw new Error('no document');
        return Promise.resolve(true);
      },
      privacy: () => {
        throw new Error('no document');
      },
    };
    const bridge = createFakeBridge({ emit: (json) => void events.push(JSON.parse(json) as StoreEvent), ui });
    expect(() => {
      bridge.iapBuy('coins_small');
      bridge.adShowRewarded('freeCoins');
      bridge.adShowInterstitial();
      bridge.adPrivacyOptions();
    }).not.toThrow();
    await settle();
    expect(events.filter((e) => e.type === 'purchase')).toEqual([{ type: 'purchase', id: 'coins_small', state: 'cancelled' }]);
    expect(events.filter((e) => e.type === 'adResult').map((e) => (e as { result: string }).result)).toEqual(['dismissed', 'dismissed']);
    broken = false;
    events.length = 0;
    bridge.iapBuy('coins_small');
    bridge.adShowRewarded('freeCoins');
    await settle();
    expect(events.some((e) => e.type === 'purchase' && e.state === 'purchased')).toBe(true);
    expect(events.some((e) => e.type === 'adResult' && e.result === 'earned')).toBe(true);
  });
});
