/**
 * Real-money purchases and ads (docs/DESIGN.md §7, contract: ./types.ts).
 *
 *   createStore({ profile, platform, now?, mode? }) → StoreApi (with rewardedLeft always present)
 *
 * Where the store comes from ('auto', the default):
 *  - inside the Android wrapper, when `window.AndroidBridge` has the monetisation methods
 *    (`storeCaps`): the real store, driven by StoreEvents the wrapper sends to `window.__native.store`;
 *  - in a plain browser with `?fakestore=1` in the URL, or under the Vite dev server (unless the
 *    URL says `?fakestore=0`): the test store of ./fake.ts, which simulates products and ads;
 *  - anywhere else: everything unavailable — the game simply hides its offers.
 * The test store can never appear in an Android build: wherever the Android bridge exists (or the
 * platform reports Android, or the page is served from the wrapper's asset host, or the browser is
 * an Android WebView at all) it is refused, also when 'fake' is asked for explicitly.
 *
 * The rules (grant once per purchase token, finish only after the save, ad frequency caps) are in
 * ./store.ts, the numbers in ./catalog.ts, the bookkeeping in the profile (ProfileShop).
 */
import type { PlatformApi } from '../platform/types.ts';
import type { FullProfile } from '../state/extensions.ts';
import type { ProfileApi } from '../state/types.ts';
import { parseSave, purchaseKey } from '../state/index.ts';
import type { FullStoreApi, MonetizeBridge } from './types.ts';
import { createCoreStore } from './store.ts';
import type { CoreStore } from './store.ts';
import { createFakeBridge, createFakeDomUi, fakeLocalStorage } from './fake.ts';
import type { FakeStorage, FakeUi } from './fake.ts';

export * from './catalog.ts';
export type { CoreStore } from './store.ts';
export { createCoreStore } from './store.ts';
export { createFakeBridge, createFakeDomUi, FAKE_ACCOUNT_KEY, FAKE_AD_MS } from './fake.ts';
export type { FakeBridgeDeps, FakePurchaseChoice, FakeStorage, FakeUi } from './fake.ts';

export type StoreMode = 'auto' | 'fake' | 'off';

export interface StoreDeps {
  /** The profile returned by `createProfile` (it carries the bookkeeping the store needs). */
  profile: ProfileApi;
  platform: PlatformApi;
  /** Epoch milliseconds. Default: Date.now. */
  now?(): number;
  mode?: StoreMode;
  /** Test hooks for the fake store: scripted answers instead of the overlays, and where its account is kept. */
  fakeUi?: FakeUi;
  fakeStorage?: FakeStorage;
}

/** The wrapper serves the bundled game from this host. */
const ANDROID_ASSET_HOST = 'appassets.androidplatform.net';

/** A store where nothing is available: no products, no ads, every request answered at once. */
export function createOffStore(): FullStoreApi {
  return {
    iapAvailable: () => false,
    products: () => [],
    buy: () => Promise.resolve('unavailable'),
    restore: () => Promise.resolve(0),
    owns: () => false,
    adsAvailable: () => false,
    rewardedReady: () => false,
    freeCoinAdsLeft: () => 0,
    rewardedLeft: () => 0,
    showRewarded: () => Promise.resolve('unavailable'),
    maybeShowInterstitial: () => Promise.resolve(false),
    privacyOptionsRequired: () => false,
    showPrivacyOptions: () => Promise.resolve(),
    onChange: () => () => {},
  };
}

const PROFILE_METHODS = [
  'subscribe',
  'shop',
  'lastSaveOk',
  'purchaseGranted',
  'purchaseSaved',
  'grantPurchase',
  'setEntitlement',
  'adsToday',
  'noteRewarded',
  'noteInterstitial',
  'noteLevelFinished',
  'daysSinceFirstPlay',
  'featureUnlocked',
  'highestUnlocked',
] as const;

/** The store keeps its books in the profile: without those methods there can be no store. */
function isFullProfile(profile: unknown): profile is FullProfile {
  if (typeof profile !== 'object' || profile === null) return false;
  const p = profile as Record<string, unknown>;
  for (const name of PROFILE_METHODS) if (typeof p[name] !== 'function') return false;
  return true;
}

function read<T>(get: () => T): T | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}

/** The Android bridge object if there is one — whether or not it can sell anything. */
function androidBridge(win: Window | undefined): Record<string, unknown> | null {
  const bridge: unknown = win ? read(() => win.AndroidBridge) : undefined;
  return typeof bridge === 'object' && bridge !== null ? (bridge as Record<string, unknown>) : null;
}

/** An Android System WebView says so in its user agent ("…; wv) …"): an app, not a browser. */
function isAndroidWebView(win: Window): boolean {
  const agent = read(() => win.navigator.userAgent);
  return typeof agent === 'string' && /Android/.test(agent) && /;\s*wv\)/.test(agent);
}

/**
 * Four independent signs, any one of which is enough: the bridge object, what the platform module
 * found, the wrapper's asset host, and the user agent of an Android WebView. The last two still
 * hold if the bridge was not injected for some reason — the test store stays out of the app.
 */
function isAndroid(win: Window | undefined, platform: PlatformApi): boolean {
  if (androidBridge(win)) return true;
  if (read(() => platform.info().platform) === 'android') return true;
  if (!win) return false;
  if (read(() => win.location.hostname) === ANDROID_ASSET_HOST) return true;
  return isAndroidWebView(win);
}

/** `fakestore` in the page URL: '1' asks for the test store, '0' forbids it, anything else says nothing. */
function fakeFlag(win: Window): '1' | '0' | null {
  const search = read(() => win.location.search);
  if (typeof search !== 'string') return null;
  const match = /[?&]fakestore=([^&#]*)/.exec(search);
  return match && (match[1] === '1' || match[1] === '0') ? match[1] : null;
}

function isDevServer(): boolean {
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false; // run directly by Node: no build-time environment
  }
}

/**
 * "Is the grant of this purchase in the WRAPPER's own storage?" — asked on top of the profile's own
 * read-back before a purchase is finished. The platform keeps a mirror copy of the save in the
 * WebView and reads it when the wrapper has nothing; that is right for playing on, but a mirror
 * must not vouch for a purchase while the wrapper holds a save of its own (the next launch would
 * load the wrapper's — older — copy, and the purchase would be gone). So:
 *  - the wrapper hands out a save: the token must be in it;
 *  - the wrapper hands out nothing: accepted only if it was never seen to hold a save in this
 *    session (a wrapper that never stored anything is a wrapper whose save lives in the mirror);
 *  - the wrapper cannot be asked: not proven.
 * Whether the wrapper holds a save is looked at when the store starts and after the profile's
 * saves, until one is seen.
 */
function wrapperHolds(bridge: Record<string, unknown>, profile: FullProfile): (token: string) => boolean {
  const ask = (): string | null => {
    if (typeof bridge.loadSave !== 'function') return null;
    const raw: unknown = (bridge as { loadSave(): unknown }).loadSave(); // called ON the bridge: injected objects insist
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  };
  let hadSave = false;
  const look = (): void => {
    try {
      if (ask() !== null) hadSave = true;
    } catch {
      // cannot be asked right now
    }
  };
  look();
  if (!hadSave) {
    const stop = profile.subscribe(() => {
      look();
      if (hadSave) stop();
    });
  }
  return (token: string): boolean => {
    let raw: string | null;
    try {
      raw = ask();
    } catch {
      return false;
    }
    if (raw === null) return !hadSave;
    hadSave = true;
    const key = purchaseKey(token);
    return key !== null && parseSave(raw).shop.tokens.indexOf(key) >= 0;
  };
}

function startAndroid(win: Window, bridge: MonetizeBridge, deps: StoreDeps, profile: FullProfile): FullStoreApi {
  const alsoSaved = wrapperHolds(bridge as unknown as Record<string, unknown>, profile);
  const core = createCoreStore({ profile, platform: deps.platform, now: clockOf(deps), bridge, alsoSaved });
  // `window.__native` is shared with the platform module, which created it: add our hook to it.
  try {
    let hooks = win.__native as unknown as Record<string, unknown> | undefined;
    if (typeof hooks !== 'object' || hooks === null) {
      hooks = {};
      (win as unknown as { __native: unknown }).__native = hooks;
    }
    hooks.store = (json: unknown): void => core.receive(json);
  } catch (err) {
    if (typeof console !== 'undefined') console.error('[store] cannot install the event hook', err);
  }
  core.start();
  return core;
}

function startFake(win: Window | undefined, deps: StoreDeps, profile: FullProfile): FullStoreApi {
  const doc = win ? read(() => win.document) : undefined;
  const ui = deps.fakeUi || (doc ? createFakeDomUi(doc) : null);
  if (!ui) return createOffStore(); // nowhere to show the test overlays
  let core: CoreStore | null = null;
  const bridge = createFakeBridge({
    emit: (json) => {
      if (core) core.receive(json);
    },
    ui,
    alreadyOwned: profile.shop().owned.slice(),
    ...(deps.fakeStorage ? { storage: deps.fakeStorage } : win ? { storage: fakeLocalStorage(win) } : {}),
  });
  // The test sheet lives inside the page: leaving and returning says nothing about a purchase.
  core = createCoreStore({ profile, platform: deps.platform, now: clockOf(deps), bridge, buyResumeGraceMs: null });
  core.start();
  return core;
}

function clockOf(deps: StoreDeps): () => number {
  return typeof deps.now === 'function' ? deps.now : () => Date.now();
}

/** Pick and start the store for where the game is running. Never throws. */
export function createStore(deps: StoreDeps): FullStoreApi {
  try {
    const mode: StoreMode = deps && (deps.mode === 'fake' || deps.mode === 'off') ? deps.mode : 'auto';
    if (!deps || mode === 'off' || !isFullProfile(deps.profile) || typeof deps.platform !== 'object' || deps.platform === null) return createOffStore();
    const profile = deps.profile;
    const win = typeof window !== 'undefined' ? window : undefined;

    if (isAndroid(win, deps.platform)) {
      // An Android build never shows the test store — whatever was asked for.
      const bridge = androidBridge(win);
      if (mode !== 'auto' || !win || !bridge || typeof bridge.storeCaps !== 'function') return createOffStore();
      return startAndroid(win, bridge as unknown as MonetizeBridge, deps, profile);
    }

    if (mode === 'fake') return startFake(win, deps, profile);
    if (!win) return createOffStore();
    const flag = fakeFlag(win);
    if (flag === '1' || (flag === null && isDevServer())) return startFake(win, deps, profile);
    return createOffStore();
  } catch (err) {
    if (typeof console !== 'undefined') console.error('[store] could not start', err);
    return createOffStore();
  }
}
