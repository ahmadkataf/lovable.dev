/**
 * Test harness for the store: one fake clock shared by the profile and the store, in-memory
 * storage, a scripted bridge, and ONE log in which saves and bridge calls appear in the order they
 * happened — so "saved before finished" is an assertion about that log.
 */
import { createProfile, fixedOffsetDayNumber, freshSave } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { SaveData } from '../../src/state/types.ts';
import type { PlatformApi } from '../../src/platform/types.ts';
import { createCoreStore } from '../../src/monetize/index.ts';
import type { CoreStore } from '../../src/monetize/index.ts';
import type { MonetizeBridge, StoreEvent } from '../../src/monetize/types.ts';

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 2026-03-10 12:00:00 UTC. The calendar of every test is UTC. */
export const T0 = Date.UTC(2026, 2, 10, 12, 0, 0);

export const ALL_PRICES: { id: string; price: string }[] = [
  { id: 'coins_small', price: 'US$0.99' },
  { id: 'coins_medium', price: 'US$4.99' },
  { id: 'coins_large', price: 'US$9.99' },
  { id: 'coins_xl', price: 'US$19.99' },
  { id: 'coins_mega', price: 'US$49.99' },
  { id: 'starter_pack', price: 'US$1.99' },
  { id: 'remove_ads', price: 'US$2.99' },
];

export const ADS_READY: StoreEvent = { type: 'ads', canRequestAds: true, rewardedReady: true, interstitialReady: true, privacyOptionsRequired: false };

/** What a device keeps between app starts: the save, the clock and the shared log. */
export interface Device {
  clock: { now: number };
  storage: { json: string | null; failing: boolean };
  /** 'save', then every bridge call as 'name:argument', in order. */
  log: string[];
}

export interface WorldOptions {
  /** Levels already cleared in a new profile (ignored when the device already has a save). */
  cleared?: number;
  /** Replace fields of the initial save. */
  save?: Partial<SaveData>;
  caps?: { billing?: boolean; ads?: boolean } | string;
  /** Do not answer the start-up query with prices / ad readiness. */
  silent?: boolean;
  /** Bridge methods that throw. */
  broken?: string[];
  now?: number;
}

export interface World {
  device: Device;
  profile: FullProfile;
  store: CoreStore;
  /** Deliver a StoreEvent the way the wrapper does: as JSON text. */
  send(event: StoreEvent | Record<string, unknown>): void;
  /** Bridge calls only (without the saves), e.g. ['iapQuery', 'iapRestore', 'iapBuy:coins_small']. */
  calls(): string[];
  /** Bridge calls made since the last time this was asked. */
  newCalls(): string[];
  /** What is in storage right now. */
  saved(): SaveData;
  /** How often onChange fired. */
  changes: { count: number };
  /** The app goes to the background / returns. */
  pause(): void;
  resume(): void;
  /** A new profile and store on the same device: "the app was restarted". */
  restart(options?: WorldOptions): World;
  /** What the bridge saw in storage at the moment of each iapFinish call. */
  seenAtFinish: { token: string; saved: SaveData | null }[];
}

export function newDevice(now: number = T0): Device {
  return { clock: { now }, storage: { json: null, failing: false }, log: [] };
}

export function world(options: WorldOptions = {}, device: Device = newDevice(options.now)): World {
  if (device.storage.json === null && (options.cleared !== undefined || options.save !== undefined)) {
    const save = freshSave();
    for (let id = 1; id <= (options.cleared ?? 0); id++) save.levels[String(id)] = { stars: 1, best: 0 };
    device.storage.json = JSON.stringify({ ...save, ...options.save });
  }
  const profile = createProfile({
    load: () => device.storage.json,
    save: (json) => {
      if (device.storage.failing) throw new Error('storage is full');
      device.storage.json = json;
      device.log.push('save');
    },
    now: () => device.clock.now,
    levelCount: 120,
    dayNumber: fixedOffsetDayNumber(0),
  });

  const pauseListeners: (() => void)[] = [];
  const resumeListeners: (() => void)[] = [];
  const platform: PlatformApi = {
    info: () => ({ versionName: 'test', versionCode: 1, locale: 'en-US', platform: 'android' }),
    loadSave: () => device.storage.json,
    storeSave: () => {},
    haptic: () => {},
    setBackHandler: () => {},
    setAtRoot: () => {},
    rateApp: () => {},
    onPause: (listener) => void pauseListeners.push(listener),
    onResume: (listener) => void resumeListeners.push(listener),
  };

  const caps = typeof options.caps === 'string' ? options.caps : JSON.stringify({ billing: options.caps?.billing ?? true, ads: options.caps?.ads ?? true });
  const broken = options.broken ?? [];
  const seenAtFinish: World['seenAtFinish'] = [];
  const call = (name: string, argument?: string): void => {
    device.log.push(argument === undefined ? name : name + ':' + argument);
    if (broken.indexOf(name) >= 0) throw new Error(name + ' is broken');
  };
  const bridge: MonetizeBridge = {
    storeCaps: () => {
      if (broken.indexOf('storeCaps') >= 0) throw new Error('storeCaps is broken');
      return caps;
    },
    iapQuery: (idsJson) => call('iapQuery', idsJson),
    iapBuy: (id) => call('iapBuy', id),
    iapFinish: (token) => {
      seenAtFinish.push({ token, saved: device.storage.json === null ? null : (JSON.parse(device.storage.json) as SaveData) });
      call('iapFinish', token);
    },
    iapRestore: () => call('iapRestore'),
    adShowRewarded: (placement) => call('adShowRewarded', placement),
    adShowInterstitial: () => call('adShowInterstitial'),
    adPrivacyOptions: () => call('adPrivacyOptions'),
  };

  const store = createCoreStore({ profile, platform, now: () => device.clock.now, bridge });
  const changes = { count: 0 };
  store.onChange(() => {
    changes.count += 1;
  });
  store.start();

  let read = 0;
  const bridgeCalls = (): string[] => device.log.filter((entry) => entry !== 'save').map((entry) => (entry.indexOf('iapQuery:') === 0 ? 'iapQuery' : entry));
  const api: World = {
    device,
    profile,
    store,
    send: (event) => store.receive(JSON.stringify(event)),
    calls: bridgeCalls,
    newCalls: () => {
      const all = bridgeCalls();
      const fresh = all.slice(read);
      read = all.length;
      return fresh;
    },
    saved: () => JSON.parse(device.storage.json ?? 'null') as SaveData,
    changes,
    pause: () => pauseListeners.forEach((fn) => fn()),
    resume: () => resumeListeners.forEach((fn) => fn()),
    restart: (next = {}) => world({ ...options, ...next }, device),
    seenAtFinish,
  };
  read = bridgeCalls().length; // the start-up calls are not "new"
  if (!options.silent) {
    api.send({ type: 'products', products: ALL_PRICES });
    api.send(ADS_READY);
    changes.count = 0;
  }
  return api;
}
