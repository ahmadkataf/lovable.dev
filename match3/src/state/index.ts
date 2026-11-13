/**
 * Player profile: progress, coins, boosters, lives, daily reward, settings.
 * Pure logic — the clock, the storage and the calendar are injected, so everything is unit-testable
 * under Node. Numbers live in ./econ.ts (docs/DESIGN.md §5).
 *
 * Behaviour worth knowing when you use it:
 *  - Every mutation is saved synchronously and THEN subscribers are notified. Calls that change
 *    nothing (spending 0 coins, re-setting a setting to its current value, …) neither save nor notify.
 *  - Lives regenerate lazily: they are a function of (lives, lifeTimer, now). Reading them
 *    (`lives()`, `data()`) brings the stored pair up to date and may persist it, but NEVER notifies —
 *    a life coming back is the passage of time, not a mutation. Anything that shows lives or the
 *    countdown should poll `lives()` on a ticker (it needs one for the countdown anyway).
 *  - Loading never throws: unreadable or foreign data yields a fresh profile, damaged fields are
 *    repaired one by one (see `repairSave`).
 *  - `data()` and `settings()` return the live objects (the same ones for the profile's whole life,
 *    reset() included): read them, never write to them.
 */
import type {
  BoosterId,
  DailyStatus,
  LevelRecord,
  LevelResultSummary,
  LivesInfo,
  ProfileApi,
  Reward,
  SaveData,
  Settings,
} from './types.ts';
import { ALL_BOOSTERS } from './types.ts';
import {
  BOOSTER_PRICES,
  DAILY_CYCLE,
  DAILY_CYCLE_DAYS,
  LIFE_REGEN_MS,
  MAX_BOOSTER_COUNT,
  MAX_COINS,
  MAX_LIVES,
  REFILL_LIVES_PRICE,
  START_BOOSTERS,
  START_COINS,
  levelReward,
} from './econ.ts';

export * from './econ.ts';

export interface ProfileDeps {
  /** Raw save string, or null when nothing was saved yet. */
  load(): string | null;
  save(json: string): void;
  /** Epoch milliseconds. */
  now(): number;
  /** Number of levels in the game; `highestUnlocked()` never exceeds it. Read once, at creation. */
  levelCount: number;
  /**
   * Local-calendar day number of an instant (whole days since the epoch in local time).
   * Defaults to `localDayNumber` (the device's time zone). Injectable for tests.
   */
  dayNumber?(ms: number): number;
}

// ───────────────────────────── calendar helpers ─────────────────────────────

export const DAY_MS = 86_400_000;

/** Day number of `ms` on a wall clock running `utcOffsetMinutes` ahead of UTC (e.g. 180 for UTC+3). */
export function dayNumberAtOffset(ms: number, utcOffsetMinutes: number): number {
  return Math.floor((ms + utcOffsetMinutes * 60_000) / DAY_MS);
}

/** A `dayNumber` function for a fixed UTC offset — for tests and tools. */
export function fixedOffsetDayNumber(utcOffsetMinutes: number): (ms: number) => number {
  return (ms) => dayNumberAtOffset(ms, utcOffsetMinutes);
}

/**
 * Day number of `ms` on the device's local calendar: it changes exactly at local midnight and
 * consecutive calendar dates differ by exactly 1, whatever the time zone or daylight-saving shifts.
 */
export function localDayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Milliseconds from `ms` until the next local midnight (when the next daily reward unlocks). Always > 0. */
export function msUntilNextLocalDay(ms: number): number {
  const d = new Date(ms);
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const wait = next - ms;
  // NaN for an invalid date; non-positive cannot happen on a sane calendar, but never return it.
  return wait > 0 ? wait : DAY_MS;
}

// ───────────────────────────── save repair ─────────────────────────────

/** Bounds used only to keep a damaged or hand-edited save sane. */
const MAX_LEVEL_ID = 9_999;
const MAX_SCORE = 999_999_999;
const MAX_TOTAL_SCORE = 9_000_000_000_000_000; // below Number.MAX_SAFE_INTEGER
const MAX_COUNTER = 999_999_999;
const MAX_CASCADE = 9_999;
const MAX_TIME = 8_640_000_000_000_000; // largest valid Date
const MAX_DAY = MAX_TIME / DAY_MS;
const MAX_STREAK = 1_000_000;
const MAX_SEEN = 2_000;
const MAX_SEEN_ID_LENGTH = 1_024;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A number is clamped into [min, max] and floored; anything that is not a number becomes `fallback`. */
function int(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || v !== v) return fallback;
  if (v <= min) return min;
  if (v >= max) return max;
  return Math.floor(v);
}

function isBooster(id: unknown): id is BoosterId {
  return typeof id === 'string' && (ALL_BOOSTERS as readonly string[]).indexOf(id) >= 0;
}

/** A brand-new profile. */
export function freshSave(): SaveData {
  return {
    version: 1,
    levels: {},
    coins: START_COINS,
    lives: MAX_LIVES,
    lifeTimer: 0,
    boosters: { ...START_BOOSTERS },
    settings: { sfx: true, music: true, haptics: true, lang: null },
    dailyDay: -1,
    dailyStreak: 0,
    seen: [],
    stats: { played: 0, won: 0, bestCascade: 0, totalScore: 0 },
  };
}

function repairLevels(v: unknown): Record<string, LevelRecord> {
  const out: Record<string, LevelRecord> = {};
  if (!isObject(v)) return out;
  for (const key of Object.keys(v)) {
    const id = Number(key);
    // Only canonical positive integer ids ("7", not "07", "7.0", "__proto__" …).
    if (!Number.isInteger(id) || id < 1 || id > MAX_LEVEL_ID || String(id) !== key) continue;
    const rec = v[key];
    if (!isObject(rec)) continue;
    out[key] = { stars: int(rec.stars, 1, 3, 1) as 1 | 2 | 3, best: int(rec.best, 0, MAX_SCORE, 0) };
  }
  return out;
}

function repairBoosters(v: unknown): Record<BoosterId, number> {
  const out: Record<BoosterId, number> = { ...START_BOOSTERS };
  if (!isObject(v)) return out;
  // Only the known boosters are copied; anything else in the object is dropped.
  for (const id of ALL_BOOSTERS) out[id] = int(v[id], 0, MAX_BOOSTER_COUNT, START_BOOSTERS[id]);
  return out;
}

function repairSettings(v: unknown): Settings {
  const o = isObject(v) ? v : {};
  const bool = (x: unknown): boolean => (typeof x === 'boolean' ? x : true);
  return {
    sfx: bool(o.sfx),
    music: bool(o.music),
    haptics: bool(o.haptics),
    lang: o.lang === 'en' || o.lang === 'ar' ? o.lang : null,
  };
}

function repairSeen(v: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(v)) return out;
  const known = new Set<string>();
  for (let i = 0; i < v.length && out.length < MAX_SEEN; i++) {
    const s: unknown = v[i];
    if (typeof s !== 'string' || s.length === 0 || s.length > MAX_SEEN_ID_LENGTH || known.has(s)) continue;
    known.add(s);
    out.push(s);
  }
  return out;
}

function repairStats(v: unknown): SaveData['stats'] {
  const o = isObject(v) ? v : {};
  return {
    played: int(o.played, 0, MAX_COUNTER, 0),
    won: int(o.won, 0, MAX_COUNTER, 0),
    bestCascade: int(o.bestCascade, 0, MAX_CASCADE, 0),
    totalScore: int(o.totalScore, 0, MAX_TOTAL_SCORE, 0),
  };
}

/**
 * Turn any parsed JSON value into a valid SaveData without ever throwing.
 * Not an object ⇒ a fresh profile. Otherwise every field is checked on its own: a missing or
 * wrongly-typed field gets the fresh-profile default, a number out of range is clamped
 * (negatives to the minimum, absurd values to a cap), unknown boosters / level keys are dropped.
 * The lives timer is only range-checked here; `createProfile` reconciles it with the clock.
 */
export function repairSave(raw: unknown): SaveData {
  if (!isObject(raw)) return freshSave();
  const lives = int(raw.lives, 0, MAX_LIVES, MAX_LIVES);
  const dailyDay = int(raw.dailyDay, -1, MAX_DAY, -1);
  let dailyStreak = int(raw.dailyStreak, 0, MAX_STREAK, 0);
  // Keep the pair consistent: no claim ⇒ no streak; a claim ⇒ a streak of at least one day.
  if (dailyDay < 0) dailyStreak = 0;
  else if (dailyStreak < 1) dailyStreak = 1;
  return {
    version: 1,
    levels: repairLevels(raw.levels),
    coins: int(raw.coins, 0, MAX_COINS, START_COINS),
    lives,
    lifeTimer: lives >= MAX_LIVES ? 0 : int(raw.lifeTimer, 0, MAX_TIME, 0),
    boosters: repairBoosters(raw.boosters),
    settings: repairSettings(raw.settings),
    dailyDay,
    dailyStreak,
    seen: repairSeen(raw.seen),
    stats: repairStats(raw.stats),
  };
}

/** Parse a raw save string. Null, empty, corrupt or foreign input ⇒ a fresh profile. Never throws. */
export function parseSave(json: string | null | undefined): SaveData {
  if (typeof json !== 'string' || json.length === 0) return freshSave();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return freshSave();
  }
  try {
    return repairSave(raw);
  } catch {
    return freshSave();
  }
}

// ───────────────────────────── the profile ─────────────────────────────

export function createProfile(deps: ProfileDeps): ProfileApi {
  const levelCount = int(deps.levelCount, 1, MAX_LEVEL_ID, 1);
  const dayOf = typeof deps.dayNumber === 'function' ? deps.dayNumber : localDayNumber;
  const listeners: { fn: () => void }[] = [];

  let lastClock = 1;
  /** The injected clock, made safe: a whole number ≥ 1; a broken clock repeats its last good value. */
  function clock(): number {
    let t: number;
    try {
      t = deps.now();
    } catch {
      return lastClock;
    }
    if (typeof t !== 'number' || !isFinite(t)) return lastClock;
    lastClock = Math.min(MAX_TIME, Math.max(1, Math.floor(t)));
    return lastClock;
  }

  let raw: string | null = null;
  try {
    raw = deps.load();
  } catch {
    raw = null;
  }
  const data: SaveData = parseSave(raw);

  function persist(): void {
    try {
      deps.save(JSON.stringify(data));
    } catch {
      // Storage full or unavailable: keep playing from memory, the next save may succeed.
    }
  }

  function notify(): void {
    for (const entry of listeners.slice()) {
      if (listeners.indexOf(entry) < 0) continue; // unsubscribed by an earlier listener of this round
      try {
        entry.fn();
      } catch (err) {
        // One faulty listener must not break the others, nor the mutation that triggered it.
        if (typeof console !== 'undefined') console.error('[profile] listener failed', err);
      }
    }
  }

  function commit(): void {
    persist();
    notify();
  }

  // ── lives ──

  /**
   * Bring (lives, lifeTimer) up to date for the instant `t`. Returns true when the pair changed.
   * Rules: full ⇒ no timer. Not full ⇒ a timer runs; each whole interval elapsed grants one life.
   * A timer that is missing or lies in the future (damaged save, device clock moved backwards) is
   * restarted from `t`: that can only cost the player the partly-elapsed interval, never grant a
   * life, and the wait is never longer than one interval.
   */
  function syncLives(t: number): boolean {
    const d = data;
    if (d.lives >= MAX_LIVES) {
      if (d.lives === MAX_LIVES && d.lifeTimer === 0) return false;
      d.lives = MAX_LIVES;
      d.lifeTimer = 0;
      return true;
    }
    if (d.lifeTimer <= 0 || d.lifeTimer > t) {
      d.lifeTimer = t;
      return true;
    }
    const gained = Math.floor((t - d.lifeTimer) / LIFE_REGEN_MS);
    if (gained <= 0) return false;
    d.lives = Math.min(MAX_LIVES, d.lives + gained);
    d.lifeTimer = d.lives >= MAX_LIVES ? 0 : d.lifeTimer + gained * LIFE_REGEN_MS;
    return true;
  }

  /**
   * Sync and quietly persist the normalised pair (no notification — see file header). Called at the
   * start of every operation that looks at lives, so memory and storage never disagree about them.
   */
  function readLives(t: number): void {
    if (syncLives(t)) persist();
  }

  function addLives(n: number): boolean {
    const d = data;
    if (d.lives >= MAX_LIVES || n <= 0) return false;
    d.lives = Math.min(MAX_LIVES, d.lives + n);
    if (d.lives >= MAX_LIVES) d.lifeTimer = 0; // otherwise the running interval simply continues
    return true;
  }

  // ── raw mutations (no save / notify; return whether anything changed) ──

  /** Whole coins/boosters only: grants round down, so nothing is ever given for a fraction. */
  function wholeAmount(n: unknown): number {
    return typeof n === 'number' && n >= 1 ? Math.floor(Math.min(n, MAX_COINS)) : 0;
  }

  function addCoinsRaw(n: unknown): boolean {
    const amount = wholeAmount(n);
    const next = Math.min(MAX_COINS, data.coins + amount);
    if (next === data.coins) return false;
    data.coins = next;
    return true;
  }

  function addBoosterRaw(id: unknown, n: unknown): boolean {
    if (!isBooster(id)) return false;
    const amount = wholeAmount(n);
    const next = Math.min(MAX_BOOSTER_COUNT, data.boosters[id] + amount);
    if (next === data.boosters[id]) return false;
    data.boosters[id] = next;
    return true;
  }

  function applyReward(r: Reward): boolean {
    if (!isObject(r)) return false;
    switch (r.kind) {
      case 'coins':
        return addCoinsRaw(r.amount);
      case 'booster':
        return addBoosterRaw(r.id, r.amount);
      case 'lives':
        return addLives(r.amount === undefined ? MAX_LIVES : wholeAmount(r.amount));
      default:
        return false;
    }
  }

  // ── progress ──

  function clearedTop(): number {
    let top = 0;
    for (const key of Object.keys(data.levels)) {
      const id = Number(key);
      if (id > top && id <= levelCount) top = id;
    }
    return top;
  }

  // ── daily reward ──

  interface DailyState {
    canClaim: boolean;
    cycleDay: number;
    streak: number;
    today: number;
    /** Streak after claiming now. */
    nextStreak: number;
  }

  function dailyState(t: number): DailyState {
    let today: number;
    try {
      // Days before the epoch are folded into day 0, so a claim day can never look like "never claimed" (-1).
      today = Math.max(0, Math.floor(dayOf(t)));
    } catch {
      today = NaN;
    }
    const last = data.dailyDay;
    const streak = data.dailyStreak;
    const claimedSlot = streak > 0 ? (streak - 1) % DAILY_CYCLE_DAYS : 0;
    if (!isFinite(today)) return { canClaim: false, cycleDay: claimedSlot, streak, today: last, nextStreak: streak };
    if (last < 0) return { canClaim: true, cycleDay: 0, streak: 0, today, nextStreak: 1 };
    // Same day — or an earlier one, when the device clock was moved back: nothing to claim.
    if (today <= last) return { canClaim: false, cycleDay: claimedSlot, streak, today, nextStreak: streak };
    if (today === last + 1) {
      return { canClaim: true, cycleDay: streak % DAILY_CYCLE_DAYS, streak, today, nextStreak: Math.min(MAX_STREAK, streak + 1) };
    }
    // At least one whole day was missed: the streak starts over.
    return { canClaim: true, cycleDay: 0, streak: 0, today, nextStreak: 1 };
  }

  function copyRewards(rewards: readonly Reward[]): Reward[] {
    return rewards.map((r) => ({ ...r }));
  }

  // Reconcile the loaded lives with the clock right away, and store the result if it differs:
  // a timer that had to be restarted (clock moved backwards) must not restart again at every
  // launch. A fresh or already-normalised profile writes nothing here.
  readLives(clock());

  const api: ProfileApi = {
    data(): Readonly<SaveData> {
      readLives(clock());
      return data;
    },

    subscribe(listener: () => void): () => void {
      const entry = { fn: listener };
      listeners.push(entry);
      return () => {
        const i = listeners.indexOf(entry);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    // ── lives ──

    lives(): LivesInfo {
      const t = clock();
      readLives(t);
      if (data.lives >= MAX_LIVES) return { count: MAX_LIVES, max: MAX_LIVES, nextInMs: 0 };
      // After syncing, 0 ≤ t − lifeTimer < LIFE_REGEN_MS, so the wait is within (0, LIFE_REGEN_MS].
      return { count: data.lives, max: MAX_LIVES, nextInMs: data.lifeTimer + LIFE_REGEN_MS - t };
    },

    loseLife(): boolean {
      const t = clock();
      readLives(t);
      if (data.lives <= 0) return false;
      if (data.lives >= MAX_LIVES) data.lifeTimer = t; // dropping from full starts the timer
      data.lives -= 1;
      commit();
      return true;
    },

    refillLives(): boolean {
      readLives(clock());
      if (data.lives >= MAX_LIVES || data.coins < REFILL_LIVES_PRICE) return false;
      data.coins -= REFILL_LIVES_PRICE;
      data.lives = MAX_LIVES;
      data.lifeTimer = 0;
      commit();
      return true;
    },

    // ── economy ──

    coins(): number {
      return data.coins;
    },

    addCoins(n: number): void {
      if (addCoinsRaw(n)) commit();
    },

    spendCoins(n: number): boolean {
      if (typeof n !== 'number' || !isFinite(n) || n < 0) return false;
      const price = Math.ceil(n); // never charge less than asked
      if (price > data.coins) return false;
      if (price === 0) return true;
      data.coins -= price;
      commit();
      return true;
    },

    boosterCount(id: BoosterId): number {
      return isBooster(id) ? data.boosters[id] : 0;
    },

    addBooster(id: BoosterId, n: number): void {
      if (addBoosterRaw(id, n)) commit();
    },

    takeBooster(id: BoosterId): boolean {
      if (!isBooster(id) || data.boosters[id] <= 0) return false;
      data.boosters[id] -= 1;
      commit();
      return true;
    },

    boosterPrice(id: BoosterId): number {
      return isBooster(id) ? BOOSTER_PRICES[id] : Infinity;
    },

    buyBooster(id: BoosterId): boolean {
      if (!isBooster(id)) return false;
      const price = BOOSTER_PRICES[id];
      // Refuse (without charging) when the purchase could not be delivered.
      if (data.coins < price || data.boosters[id] >= MAX_BOOSTER_COUNT) return false;
      data.coins -= price;
      data.boosters[id] += 1;
      commit();
      return true;
    },

    grant(rewards: Reward[]): void {
      if (!Array.isArray(rewards)) return;
      readLives(clock());
      let changed = false;
      for (const r of rewards) changed = applyReward(r) || changed;
      if (changed) commit();
    },

    // ── progress ──

    highestUnlocked(): number {
      return Math.min(levelCount, clearedTop() + 1);
    },

    record(levelId: number): LevelRecord | null {
      if (!Number.isInteger(levelId) || levelId < 1) return null;
      const rec = data.levels[String(levelId)];
      return rec ? { stars: rec.stars, best: rec.best } : null;
    },

    totalStars(): number {
      let sum = 0;
      for (const key of Object.keys(data.levels)) {
        if (Number(key) <= levelCount) sum += data.levels[key]!.stars;
      }
      return sum;
    },

    recordWin(levelId: number, stars: 1 | 2 | 3, score: number, bestCascade: number): LevelResultSummary {
      if (!Number.isInteger(levelId) || levelId < 1 || levelId > levelCount) {
        return { firstClear: false, newStars: 0, coinsEarned: 0, newBest: false };
      }
      const won = int(stars, 1, 3, 1) as 1 | 2 | 3;
      const points = int(score, 0, MAX_SCORE, 0);
      const key = String(levelId);
      const prev = data.levels[key];
      const prevStars = prev ? prev.stars : 0;
      const summary: LevelResultSummary = {
        firstClear: !prev,
        newStars: Math.max(0, won - prevStars),
        coinsEarned: levelReward(prevStars, won),
        // The first score on a level is its best by definition; later ones must beat it.
        newBest: !prev || points > prev.best,
      };
      data.levels[key] = {
        stars: Math.max(prevStars, won) as 1 | 2 | 3,
        best: prev ? Math.max(prev.best, points) : points,
      };
      addCoinsRaw(summary.coinsEarned);
      const s = data.stats;
      s.won = Math.min(MAX_COUNTER, s.won + 1);
      s.totalScore = Math.min(MAX_TOTAL_SCORE, s.totalScore + points);
      s.bestCascade = Math.max(s.bestCascade, int(bestCascade, 0, MAX_CASCADE, 0));
      commit();
      return summary;
    },

    recordAttempt(): void {
      data.stats.played = Math.min(MAX_COUNTER, data.stats.played + 1);
      commit();
    },

    // ── daily reward ──

    daily(): DailyStatus {
      const s = dailyState(clock());
      return { canClaim: s.canClaim, cycleDay: s.cycleDay, streak: s.streak, cycle: DAILY_CYCLE.map(copyRewards) };
    },

    claimDaily(): Reward[] | null {
      const t = clock();
      const s = dailyState(t);
      if (!s.canClaim) return null;
      const rewards = copyRewards(DAILY_CYCLE[s.cycleDay]!);
      readLives(t);
      data.dailyDay = s.today;
      data.dailyStreak = s.nextStreak;
      for (const r of rewards) applyReward(r);
      commit();
      return rewards;
    },

    // ── settings & tips ──

    settings(): Readonly<Settings> {
      return data.settings;
    },

    setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
      if (key === 'lang') {
        if (value !== null && value !== 'en' && value !== 'ar') return;
      } else if (key === 'sfx' || key === 'music' || key === 'haptics') {
        if (typeof value !== 'boolean') return;
      } else {
        return;
      }
      if (data.settings[key] === value) return;
      data.settings[key] = value;
      commit();
    },

    hasSeen(id: string): boolean {
      return data.seen.indexOf(id) >= 0;
    },

    markSeen(id: string): void {
      if (typeof id !== 'string' || id.length === 0 || id.length > MAX_SEEN_ID_LENGTH) return;
      if (data.seen.indexOf(id) >= 0 || data.seen.length >= MAX_SEEN) return;
      data.seen.push(id);
      commit();
    },

    reset(): void {
      // Progress, coins, boosters, lives, daily streak, tips and stats start over. The player's
      // device preferences (language, sound, music, vibration) are not progress and stay as they are.
      const fresh = freshSave();
      fresh.settings = data.settings;
      Object.assign(data, fresh); // in place: objects handed out by data() / settings() stay valid
      commit();
    },
  };

  return api;
}
