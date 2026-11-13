/**
 * Test harness for the profile: a fake clock, in-memory storage and a fixed-offset calendar,
 * so every test is deterministic and independent of the machine's time zone.
 */
import { createProfile, fixedOffsetDayNumber, freshSave } from '../../src/state/index.ts';
import type { FullProfile } from '../../src/state/index.ts';
import type { SaveData } from '../../src/state/types.ts';

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 2026-03-10 12:00:00 UTC — an arbitrary, ordinary instant. */
export const T0 = Date.UTC(2026, 2, 10, 12, 0, 0);

export interface HarnessOptions {
  /** Initial content of the storage (null = nothing saved yet). */
  json?: string | null;
  now?: number;
  levelCount?: number;
  /** Minutes ahead of UTC for the calendar; `null` uses the profile's default (device time zone). */
  utcOffsetMinutes?: number | null;
  /**
   * Start from an otherwise new profile that has already cleared this many levels (one star each,
   * nothing else earned) — e.g. 18 to have every booster unlocked. Ignored when `json` is given.
   */
  cleared?: number;
  /** Which levels are marked hard (their first clear pays double). */
  isHardLevel?: (levelId: number) => boolean;
}

export interface Harness {
  profile: FullProfile;
  clock: { now: number };
  storage: { json: string | null; writes: number };
  /** Number of subscriber notifications so far. */
  notifications: { count: number };
  /** What is currently in storage, parsed. */
  saved(): SaveData;
  /** A new profile over the same storage and clock — "the app was restarted". */
  restart(): Harness;
}

export function harness(options: HarnessOptions = {}): Harness {
  const clock = { now: options.now ?? T0 };
  const storage = { json: options.json ?? null, writes: 0 };
  if (options.json === undefined && options.cleared !== undefined && options.cleared > 0) {
    storage.json = JSON.stringify(progressSave(options.cleared));
  }
  return attach(clock, storage, options);
}

function attach(clock: Harness['clock'], storage: Harness['storage'], options: HarnessOptions): Harness {
  const offset = options.utcOffsetMinutes === undefined ? 0 : options.utcOffsetMinutes;
  const profile = createProfile({
    load: () => storage.json,
    save: (json) => {
      storage.json = json;
      storage.writes += 1;
    },
    now: () => clock.now,
    levelCount: options.levelCount ?? 120,
    ...(options.isHardLevel ? { isHardLevel: options.isHardLevel } : {}),
    ...(offset === null ? {} : { dayNumber: fixedOffsetDayNumber(offset) }),
  });
  const notifications = { count: 0 };
  profile.subscribe(() => {
    notifications.count += 1;
  });
  return {
    profile,
    clock,
    storage,
    notifications,
    saved: () => JSON.parse(storage.json ?? 'null') as SaveData,
    restart: () => attach(clock, storage, options),
  };
}

/** A new profile's save, except that levels 1..`cleared` are already won with one star. */
export function progressSave(cleared: number): SaveData {
  const save = freshSave();
  for (let id = 1; id <= cleared; id++) save.levels[String(id)] = { stars: 1, best: 0 };
  return save;
}

/** Levels cleared at which every booster is unlocked (the last one unlocks on reaching level 19). */
export const ALL_BOOSTERS_CLEARED = 18;

/** A profile loaded from the given object (anything JSON can express). */
export function fromSave(save: unknown, options: HarnessOptions = {}): Harness {
  return harness({ ...options, json: JSON.stringify(save) });
}

/** A valid, mid-game save to start repair tests from. */
export function sampleSave(): SaveData {
  return {
    version: 1,
    levels: { '1': { stars: 3, best: 4200 }, '2': { stars: 1, best: 1800 } },
    coins: 777,
    lives: 5,
    lifeTimer: 0,
    boosters: { hammer: 4, freeSwap: 0, shuffle: 2, extraMoves: 1, prism: 0, beamNova: 3 },
    settings: { sfx: false, music: true, haptics: false, lang: 'ar' },
    dailyDay: 20_000,
    dailyStreak: 3,
    seen: ['tut.swap', 'tut.beam'],
    stats: { played: 9, won: 2, bestCascade: 5, totalScore: 6000 },
    firstDay: 19_990,
    gifted: [],
    caravan: 0,
    shop: {
      tokens: ['tok-1'],
      owned: ['remove_ads'],
      purchased: true,
      adDay: 20_000,
      rewarded: { extraMoves: 1, freeLife: 0, freeCoins: 2, doubleReward: 0 },
      interstitials: 1,
      finished: 2,
      lastInterstitial: 1_700_000_000_000,
      lastRewarded: 1_700_000_100_000,
    },
  };
}

/** Deterministic pseudo-random numbers in [0, 1) for the fuzz tests. */
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
