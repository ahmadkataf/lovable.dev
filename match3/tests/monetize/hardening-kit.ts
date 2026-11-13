/**
 * Kit for the adversarial store tests (hardening*.test.ts).
 *
 * Unlike ./harness.ts it models a whole DEVICE across app restarts, with the things that go wrong
 * on one: a disk that refuses writes loudly ('throws') or silently ('silent' — the save call
 * returns, nothing is kept), a bridge whose every call is handed to the test (which may throw,
 * answer inside the call, or never answer), and sessions that die: after `kill()` an old session
 * can no longer write to the disk or reach the bridge, exactly like a JavaScript context that was
 * torn down — but its timers and promises live on in the test, so "every promise settles" can be
 * checked for them too.
 */
import { createProfile, fixedOffsetDayNumber, freshSave } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { SaveData } from '../../src/state/types.ts';
import type { PlatformApi } from '../../src/platform/types.ts';
import { createCoreStore } from '../../src/monetize/index.ts';
import type { CoreStore } from '../../src/monetize/index.ts';
import type { MonetizeBridge } from '../../src/monetize/types.ts';

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 2026-03-10 12:00:00 UTC. The calendar of every test is UTC. */
export const T0 = Date.UTC(2026, 2, 10, 12, 0, 0);

export type DiskMode = 'ok' | 'throws' | 'silent';

export interface Machine {
  clock: { now: number };
  disk: {
    /** What the next app start would load. */
    json: string | null;
    mode: DiskMode;
    /** Writes that reached the disk. */
    writes: number;
    /** Called after every write that reached the disk. */
    onWrite: (() => void) | null;
  };
  /** Every bridge call of a LIVE session goes here; it may throw, and may deliver events at once. */
  onBridge: ((session: Session, name: string, argument: string | undefined) => void) | null;
  caps: string;
  /** Number of sessions started on this machine. */
  sessions: number;
}

export interface Session {
  machine: Machine;
  profile: FullProfile;
  store: CoreStore;
  alive: boolean;
  /** 1 for the first app start, 2 after the first restart, … */
  serial: number;
  /** Bridge calls this session made while alive, as 'name' or 'name:argument'. */
  calls: string[];
  /** Deliver a StoreEvent the way the wrapper does: as JSON text (objects are encoded). */
  send(event: unknown): void;
  pause(): void;
  resume(): void;
  /** The JavaScript context is gone: no more disk writes, no more bridge calls. */
  kill(): void;
}

export function newMachine(options: { now?: number; save?: SaveData | null; caps?: string } = {}): Machine {
  return {
    clock: { now: options.now ?? T0 },
    disk: { json: options.save ? JSON.stringify(options.save) : null, mode: 'ok', writes: 0, onWrite: null },
    onBridge: null,
    caps: options.caps ?? '{"billing":true,"ads":true}',
    sessions: 0,
  };
}

/** A new profile's save with levels 1..`cleared` won and the first play `daysAgo` days before `now`. */
export function veteranSave(cleared: number, daysAgo: number, now: number = T0): SaveData {
  const save = freshSave();
  for (let id = 1; id <= cleared; id++) save.levels[String(id)] = { stars: 1, best: 0 };
  save.firstDay = Math.floor(now / DAY) - daysAgo;
  return save;
}

export interface SessionOptions {
  /** Passed to createCoreStore (default: the store's own default). */
  buyResumeGraceMs?: number | null;
  /** Give the bridge a storeSync method (default true). */
  storeSync?: boolean;
  /** A clock for the STORE that differs from the machine's (the profile always uses the machine's). */
  storeNow?: () => number;
  /** Do not call store.start() yet (the test does, after it has hooked up what it needs). */
  deferStart?: boolean;
}

/** Start the app on the machine: a profile loaded from its disk and a store on a scripted bridge. */
export function startSession(machine: Machine, options: SessionOptions = {}): Session {
  const pauseListeners: (() => void)[] = [];
  const resumeListeners: (() => void)[] = [];
  machine.sessions += 1;

  const session = { machine, alive: true, serial: machine.sessions, calls: [] as string[] } as Session;

  session.profile = createProfile({
    load: () => machine.disk.json,
    save: (json) => {
      if (!session.alive) return;
      if (machine.disk.mode === 'throws') throw new Error('disk full');
      if (machine.disk.mode === 'silent') return; // accepted, and lost
      machine.disk.json = json;
      machine.disk.writes += 1;
      if (machine.disk.onWrite) machine.disk.onWrite();
    },
    now: () => machine.clock.now,
    levelCount: 120,
    dayNumber: fixedOffsetDayNumber(0),
  });

  const platform: PlatformApi = {
    info: () => ({ versionName: 'test', versionCode: 1, locale: 'en-US', platform: 'android' }),
    loadSave: () => machine.disk.json,
    storeSave: () => {},
    haptic: () => {},
    setBackHandler: () => {},
    setAtRoot: () => {},
    rateApp: () => {},
    onPause: (listener) => void pauseListeners.push(listener),
    onResume: (listener) => void resumeListeners.push(listener),
  };

  const call = (name: string, argument?: string): void => {
    if (!session.alive) return;
    session.calls.push(argument === undefined ? name : name + ':' + argument);
    if (machine.onBridge) machine.onBridge(session, name, argument);
  };
  const bridge: MonetizeBridge = {
    storeCaps: () => machine.caps,
    iapQuery: (idsJson) => call('iapQuery', idsJson),
    iapBuy: (id) => call('iapBuy', id),
    iapFinish: (token) => call('iapFinish', token),
    iapRestore: () => call('iapRestore'),
    adShowRewarded: (placement) => call('adShowRewarded', placement),
    adShowInterstitial: () => call('adShowInterstitial'),
    adPrivacyOptions: () => call('adPrivacyOptions'),
  };
  if (options.storeSync !== false) bridge.storeSync = () => call('storeSync');

  session.store = createCoreStore({
    profile: session.profile,
    platform,
    now: options.storeNow ?? (() => machine.clock.now),
    bridge,
    ...(options.buyResumeGraceMs !== undefined ? { buyResumeGraceMs: options.buyResumeGraceMs } : {}),
  });
  session.send = (event) => session.store.receive(typeof event === 'string' ? event : JSON.stringify(event));
  session.pause = () => pauseListeners.slice().forEach((fn) => fn());
  session.resume = () => resumeListeners.slice().forEach((fn) => fn());
  session.kill = () => {
    session.alive = false;
  };
  if (options.deferStart !== true) session.store.start();
  return session;
}

export const ALL_PRICES: { id: string; price: string }[] = [
  { id: 'coins_small', price: 'US$0.99' },
  { id: 'coins_medium', price: 'US$4.99' },
  { id: 'coins_large', price: 'US$9.99' },
  { id: 'coins_xl', price: 'US$19.99' },
  { id: 'coins_mega', price: 'US$49.99' },
  { id: 'starter_pack', price: 'US$1.99' },
  { id: 'remove_ads', price: 'US$2.99' },
];

export const ADS_ON = { type: 'ads', canRequestAds: true, rewardedReady: true, interstitialReady: true, privacyOptionsRequired: false };

/** Prices and ad readiness, as a healthy wrapper reports them right after start. */
export function greet(session: Session): void {
  session.send({ type: 'products', products: ALL_PRICES });
  session.send(ADS_ON);
}

/** What is on the disk, parsed (null when nothing was ever written). */
export function onDisk(machine: Machine): SaveData | null {
  return machine.disk.json === null ? null : (JSON.parse(machine.disk.json) as SaveData);
}

/** Deterministic pseudo-random numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Keeps every promise a test starts, to prove at the end that each one settled. */
export interface PromiseBook {
  track<T>(label: string, promise: Promise<T>): Promise<T>;
  /** Labels of the promises that have not settled yet. */
  open(): string[];
  count(): number;
  /** Labels of promises that rejected (no store promise ever should). */
  rejected: string[];
  /** Resolved values by label prefix, e.g. values('buy'). */
  values(prefix: string): unknown[];
}

export function promiseBook(): PromiseBook {
  const entries: { label: string; done: boolean; value: unknown }[] = [];
  const rejected: string[] = [];
  return {
    track<T>(label: string, promise: Promise<T>): Promise<T> {
      const entry = { label, done: false, value: undefined as unknown };
      entries.push(entry);
      if (!promise || typeof promise.then !== 'function') {
        rejected.push(label + ' (not a promise)');
        entry.done = true;
        return promise;
      }
      promise.then(
        (value) => {
          entry.done = true;
          entry.value = value;
        },
        () => {
          entry.done = true;
          rejected.push(label);
        },
      );
      return promise;
    },
    open: () => entries.filter((e) => !e.done).map((e) => e.label),
    count: () => entries.length,
    rejected,
    values: (prefix) => entries.filter((e) => e.done && e.label.indexOf(prefix) === 0).map((e) => e.value),
  };
}
