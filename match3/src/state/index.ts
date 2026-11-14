/**
 * Player profile: progress, coins, boosters, lives, daily reward, settings.
 * Pure logic — the clock, the storage and the calendar are injected, so everything is unit-testable
 * under Node. Numbers live in ./econ.ts (docs/DESIGN.md §5).
 *
 * Behaviour worth knowing when you use it:
 *  - Every mutation is saved synchronously — exactly once, as one complete JSON document — and THEN
 *    subscribers are notified, exactly once. Calls that change nothing (spending 0 coins, re-setting
 *    a setting to its current value, a refused purchase, …) neither save nor notify. So storage never
 *    holds half a transaction: a purchase is either stored with its price paid, or not at all.
 *  - Coins and boosters are whole numbers within [0, cap]. Amounts are rounded in the game's favour
 *    (grants down, prices up); negative, NaN and infinite amounts do nothing.
 *  - Lives regenerate lazily: they are a function of (lives, lifeTimer, now). Reading them
 *    (`lives()`, `data()`) brings the stored pair up to date and may persist it, but NEVER notifies —
 *    a life coming back is the passage of time, not a mutation. Anything that shows lives or the
 *    countdown should poll `lives()` on a ticker (it needs one for the countdown anyway).
 *  - The device clock is not trusted to run forwards. Moved back, it restarts the current life
 *    interval (never grants a life, never makes the wait longer than one interval) and cannot unlock
 *    a second daily reward. A clock that does not work at all freezes both until it does.
 *  - Loading never throws: unreadable or foreign data yields a fresh profile, damaged fields are
 *    repaired one by one (see `repairSave`).
 *  - `data()` and `settings()` return the live objects (the same ones for the profile's whole life,
 *    reset() included): read them, never write to them.
 *  - The profile also implements the extensions of ./extensions.ts: booster unlocks and their gifts,
 *    feature gating, the Caravan, and the storage the monetisation module needs (`ProfileShop`).
 *    Gating is information for the screens — `buyBooster`, `claimDaily` & co. do not enforce it.
 *  - reset() wipes the player's progress but never what belongs to her real-money purchases
 *    (granted purchase tokens, owned entitlements) nor the ad counters and the first-play day.
 *  - Storage is not trusted to have kept what it was given: `purchaseSaved(token)` reads the save
 *    back before a real-money purchase may be finished with the store (see ProfileShop).
 */
import type { StartBoosters } from '../engine/types.ts';
import type {
  BoosterId,
  DailyStatus,
  LevelRecord,
  LevelResultSummary,
  LivesInfo,
  Reward,
  RewardedPlacement,
  SaveData,
  Settings,
  ShopSave,
} from './types.ts';
import { ALL_BOOSTERS, REWARDED_PLACEMENTS } from './types.ts';
import type { AdsToday, FeatureId, FullProfile } from './extensions.ts';
import {
  BOOSTER_PRICES,
  BOOSTER_UNLOCK_GIFT,
  BOOSTER_UNLOCK_LEVEL,
  BOOSTER_UNLOCK_ORDER,
  CARAVAN_BEAM_NOVA_WINS,
  CARAVAN_EXTRA_MOVES_WINS,
  CARAVAN_PRISM_WINS,
  DAILY_CYCLE,
  DAILY_CYCLE_DAYS,
  DAILY_UNLOCK_AFTER_DAYS,
  FEATURE_UNLOCK_LEVEL,
  LIFE_REGEN_MS,
  MAX_BOOSTER_COUNT,
  MAX_COINS,
  MAX_LIVES,
  REFILL_LIVES_PRICE,
  START_BOOSTERS,
  START_COINS,
  continuePriceOrNull,
  dailyRewardsFor,
  levelReward,
} from './econ.ts';

export * from './econ.ts';
export type { AdsToday, FeatureId, FullProfile, ProfileExtensions, ProfileShop } from './extensions.ts';

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
  /**
   * Whether a level is marked hard (LevelDef.hard): its first clear pays double. Defaults to "no".
   * Asked at the moment a win is recorded.
   */
  isHardLevel?(levelId: number): boolean;
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
/**
 * All seen ids together. With the other bounds this keeps the whole save far below one megabyte
 * even in the worst case (every character escaped in JSON) — storage layers may refuse more.
 */
const MAX_SEEN_CHARS = 60_000;
/** Granted purchase tokens remembered (the newest stay). */
export const MAX_PURCHASE_TOKENS = 200;
/** Longest purchase token the profile accepts; the stores' real ones are far shorter. */
const MAX_TOKEN_LENGTH = 4_096;
/** Tokens up to this length are remembered verbatim, longer ones as a digest. */
const RAW_TOKEN_LENGTH = 40;
const MAX_TOKEN_KEY_LENGTH = 64;
const MAX_OWNED = 16;
const MAX_AD_COUNT = 9_999;
/** What the profile's clock reads until the injected one has produced a usable value. */
const NO_CLOCK = 0;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A number is clamped into [min, max] and floored; anything that is not a number becomes `fallback`. */
function int(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || v !== v) return fallback;
  if (v <= min) return min;
  if (v >= max) return max;
  return Math.floor(v) + 0; // "+ 0": never −0, which JSON would write as 0 (memory and storage must agree)
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
    firstDay: -1,
    gifted: [],
    caravan: 0,
    shop: freshShop(),
  };
}

/** The monetisation section of a profile that never bought or watched anything. */
export function freshShop(): ShopSave {
  return {
    tokens: [],
    owned: [],
    purchased: false,
    adDay: -1,
    rewarded: { extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 },
    interstitials: 0,
    finished: 0,
    lastInterstitial: 0,
    lastRewarded: 0,
  };
}

// ───────────────────────────── purchase tokens ─────────────────────────────

/** 128-bit non-cryptographic digest (four chained 32-bit mixers) as 32 hex digits. Stable for ever: it is stored. */
function digest128(text: string): string {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 19), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  let out = '';
  for (const h of [h1, h2, h3, h4]) out += ('0000000' + (h >>> 0).toString(16)).slice(-8);
  return out;
}

/**
 * The key under which a purchase token is remembered in the save, or null when the value cannot be
 * a token. Short tokens are kept verbatim; long ones (the stores' real tokens are hundreds of
 * characters) as `#<length>.<digest>`, so 200 of them stay a few kilobytes in a save that is
 * rewritten on every change.
 */
export function purchaseKey(token: unknown): string | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  if (token.length <= RAW_TOKEN_LENGTH && token.charCodeAt(0) !== 35 /* '#' marks a digest */) return token;
  return '#' + token.length.toString(36) + '.' + digest128(token);
}

/** Product ids as the stores allow them: lower-case letters, digits, '_' and '.'. */
function isEntitlementId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9_.]{0,39}$/.test(id);
}

function isPlacement(p: unknown): p is RewardedPlacement {
  return typeof p === 'string' && (REWARDED_PLACEMENTS as readonly string[]).indexOf(p) >= 0;
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
  for (let i = 0; i < v.length; i++) {
    const s: unknown = v[i];
    if (typeof s !== 'string' || s.length === 0 || s.length > MAX_SEEN_ID_LENGTH || known.has(s)) continue;
    known.add(s);
    out.push(s);
  }
  trimSeen(out);
  return out;
}

/** Drop the OLDEST ids until the list fits its bounds (count and total size). The newest always stay. */
function trimSeen(seen: string[]): void {
  let chars = 0;
  let keepFrom = seen.length;
  while (keepFrom > 0 && seen.length - keepFrom < MAX_SEEN && chars + seen[keepFrom - 1]!.length <= MAX_SEEN_CHARS) {
    keepFrom -= 1;
    chars += seen[keepFrom]!.length;
  }
  if (keepFrom > 0) seen.splice(0, keepFrom);
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

function repairGifted(v: unknown): BoosterId[] {
  const out: BoosterId[] = [];
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < v.length && out.length < ALL_BOOSTERS.length; i++) {
    const id: unknown = v[i];
    if (isBooster(id) && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

/** Unique strings accepted by `ok`, in order; when there are more than `max`, the LAST `max` stay. */
function repairStrings(v: unknown, ok: (s: unknown) => boolean, max: number): string[] {
  const out: string[] = [];
  if (!Array.isArray(v)) return out;
  const known = new Set<string>();
  // Newest first, so that a flood of entries cannot push the newest out before the cap applies.
  for (let i = v.length - 1; i >= 0 && out.length < max; i--) {
    const s: unknown = v[i];
    if (!ok(s) || known.has(s as string)) continue;
    known.add(s as string);
    out.push(s as string);
  }
  return out.reverse();
}

function isTokenKey(s: unknown): boolean {
  return typeof s === 'string' && s.length > 0 && s.length <= MAX_TOKEN_KEY_LENGTH;
}

function repairShop(v: unknown): ShopSave {
  const shop = freshShop();
  if (!isObject(v)) return shop;
  shop.tokens = repairStrings(v.tokens, isTokenKey, MAX_PURCHASE_TOKENS);
  shop.owned = repairStrings(v.owned, isEntitlementId, MAX_OWNED);
  // Sticky and self-evident: whoever holds a granted token or an entitlement has paid.
  shop.purchased = v.purchased === true || shop.tokens.length > 0 || shop.owned.length > 0;
  shop.adDay = int(v.adDay, -1, MAX_DAY, -1);
  const counts = isObject(v.rewarded) ? v.rewarded : {};
  for (const p of REWARDED_PLACEMENTS) shop.rewarded[p] = int(counts[p], 0, MAX_AD_COUNT, 0);
  shop.interstitials = int(v.interstitials, 0, MAX_AD_COUNT, 0);
  shop.finished = int(v.finished, 0, MAX_COUNTER, 0);
  shop.lastInterstitial = int(v.lastInterstitial, 0, MAX_TIME, 0);
  shop.lastRewarded = int(v.lastRewarded, 0, MAX_TIME, 0);
  return shop;
}

/**
 * Turn any parsed JSON value into a valid SaveData without ever throwing.
 * Not an object ⇒ a fresh profile. Otherwise every field is checked on its own: a missing or
 * wrongly-typed field gets the fresh-profile default, a number out of range is clamped
 * (negatives to the minimum, absurd values to a cap), unknown boosters / level keys are dropped.
 * The lives timer is only range-checked here; `createProfile` reconciles it with the clock.
 */
export function repairSave(raw: unknown): SaveData {
  try {
    return repairObject(raw);
  } catch {
    // Only reachable with things JSON cannot produce (throwing getters, proxies): treat as unreadable.
    return freshSave();
  }
}

function repairObject(raw: unknown): SaveData {
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
    firstDay: int(raw.firstDay, -1, MAX_DAY, -1),
    gifted: repairGifted(raw.gifted),
    caravan: int(raw.caravan, 0, MAX_STREAK, 0),
    shop: repairShop(raw.shop),
  };
}

function withoutBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parse a raw save string. Null, empty, corrupt or foreign input ⇒ a fresh profile. Never throws.
 * Two harmless wrappings a storage layer may add are undone, because the alternative is to throw a
 * good save away: a leading byte-order mark, and one extra layer of JSON string encoding.
 */
export function parseSave(json: string | null | undefined): SaveData {
  if (typeof json !== 'string' || json.length === 0) return freshSave();
  try {
    let raw: unknown = JSON.parse(withoutBom(json));
    if (typeof raw === 'string') raw = JSON.parse(withoutBom(raw));
    return repairSave(raw);
  } catch {
    return freshSave();
  }
}

// ───────────────────────────── the profile ─────────────────────────────

export function createProfile(deps: ProfileDeps): FullProfile {
  const levelCount = int(deps.levelCount, 1, MAX_LEVEL_ID, 1);
  const dayOf = typeof deps.dayNumber === 'function' ? deps.dayNumber : localDayNumber;
  const hardOf = typeof deps.isHardLevel === 'function' ? deps.isHardLevel : null;
  const listeners: { fn: () => void }[] = [];

  let lastClock = NO_CLOCK;
  /**
   * The injected clock, made safe: a whole number ≥ 1. A clock that throws or returns nonsense
   * repeats its last good value (time stands still); one that never worked yields NO_CLOCK, and
   * then nothing that depends on time happens — no life regenerates, no daily reward is claimable.
   */
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
  /** Whether the most recent save reached the storage function (see `ProfileShop.lastSaveOk`). */
  let saveOk = true;
  /** The text most recently accepted by the storage function (null before the first save). */
  let lastJson: string | null = null;

  /**
   * Local-calendar day of the instant `t`, or NaN when there is no usable clock or calendar.
   * Days before the epoch are folded into day 0 (a stored day can never look like "never", -1).
   */
  function dayAt(t: number): number {
    if (t === NO_CLOCK) return NaN;
    try {
      const day = Math.max(0, Math.floor(dayOf(t)));
      return isFinite(day) ? Math.min(MAX_DAY, day) : NaN;
    } catch {
      return NaN;
    }
  }

  function persist(): void {
    // The first change that is saved marks the day the player started (see SaveData.firstDay).
    if (data.firstDay < 0) {
      const today = dayAt(clock());
      if (today === today) data.firstDay = today;
    }
    try {
      const json = JSON.stringify(data);
      deps.save(json);
      saveOk = true;
      lastJson = json;
    } catch {
      // Storage full or unavailable: keep playing from memory, the next save may succeed.
      saveOk = false;
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

  /**
   * End of an operation that first brought the lives up to date: a real change is saved and
   * announced; otherwise a life that merely regenerated is saved quietly. Never two saves.
   */
  function finish(changed: boolean, livesSynced: boolean): void {
    if (changed) commit();
    else if (livesSynced) persist();
  }

  // ── lives ──

  /**
   * Bring (lives, lifeTimer) up to date for the instant `t`. Returns true when the pair changed.
   * Rules: full ⇒ no timer. Not full ⇒ a timer runs; each whole interval elapsed grants one life.
   * A timer that is missing or lies in the future (damaged save, device clock moved backwards) is
   * restarted from `t`: that can only cost the player the partly-elapsed interval, never grant a
   * life, and the wait is never longer than one interval.
   * Without a clock (NO_CLOCK) nothing is touched; a life lost meanwhile leaves the timer at 0,
   * which is exactly the "missing timer" case above once the clock works.
   */
  function syncLives(t: number): boolean {
    const d = data;
    if (t === NO_CLOCK) return false;
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
   * Sync and quietly persist the normalised pair (no notification — see file header), so memory
   * and storage never disagree about lives. For the read-only operations; mutating ones call
   * `syncLives` themselves and end with `finish`, which saves once for both.
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

  /**
   * Whole coins/boosters only: grants round down, so nothing is ever given for a fraction.
   * NaN and ±Infinity are a bug in the caller, not an amount: they give nothing.
   */
  function wholeAmount(n: unknown): number {
    return typeof n === 'number' && isFinite(n) && n >= 1 ? Math.floor(Math.min(n, MAX_COINS)) : 0;
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
    const today = dayAt(t);
    const last = data.dailyDay;
    const streak = data.dailyStreak;
    const claimedSlot = streak > 0 ? (streak - 1) % DAILY_CYCLE_DAYS : 0;
    // No usable calendar or clock: nothing can be claimed (and nothing is lost) until there is one.
    if (today !== today) return { canClaim: false, cycleDay: claimedSlot, streak, today: last, nextStreak: streak };
    if (last < 0) return { canClaim: true, cycleDay: 0, streak: 0, today, nextStreak: 1 };
    // Same day — or an earlier one, when the device clock was moved back: nothing to claim.
    if (today <= last) return { canClaim: false, cycleDay: claimedSlot, streak, today, nextStreak: streak };
    if (today === last + 1) {
      return { canClaim: true, cycleDay: streak % DAILY_CYCLE_DAYS, streak, today, nextStreak: Math.min(MAX_STREAK, streak + 1) };
    }
    // At least one whole day was missed: the streak starts over.
    return { canClaim: true, cycleDay: 0, streak: 0, today, nextStreak: 1 };
  }

  // ── unlocks, gating, Caravan ──

  function reached(level: number): boolean {
    return Math.min(levelCount, clearedTop() + 1) >= level;
  }

  function boosterOpen(id: BoosterId): boolean {
    return isBooster(id) && reached(BOOSTER_UNLOCK_LEVEL[id]);
  }

  /** The cycle day's rewards as this player gets them (locked boosters are paid in coins). */
  function dailyRewards(cycleDay: number): Reward[] {
    return dailyRewardsFor(DAILY_CYCLE[cycleDay]!, boosterOpen);
  }

  function isHard(levelId: number): boolean {
    if (!hardOf) return false;
    try {
      return hardOf(levelId) === true;
    } catch {
      return false;
    }
  }

  // ── monetisation bookkeeping ──

  /** Start today's ad counters when the local day has moved on (never back: see the header on clocks). */
  function rollAdDay(t: number): void {
    const shop = data.shop;
    const today = dayAt(t);
    if (today !== today || today <= shop.adDay) return;
    shop.adDay = today;
    for (const p of REWARDED_PLACEMENTS) shop.rewarded[p] = 0;
    shop.interstitials = 0;
  }

  /**
   * Record ownership of an entitlement (no save). True when it was not owned before. The list only
   * ever holds this game's few products; a full one comes from a damaged save, and then its oldest
   * entry makes room — what the store reports as owned can always be recorded.
   */
  function addOwned(id: string): boolean {
    const owned = data.shop.owned;
    if (owned.indexOf(id) >= 0) return false;
    owned.push(id);
    if (owned.length > MAX_OWNED) owned.splice(0, owned.length - MAX_OWNED);
    return true;
  }

  // Reconcile the loaded lives with the clock right away, and store the result if it differs:
  // a timer that had to be restarted (clock moved backwards) must not restart again at every
  // launch. A fresh or already-normalised profile writes nothing here.
  {
    const t = clock();
    readLives(t);
    // Nobody started playing in the future: a first-play day ahead of today (the device clock was
    // wrong back then) is pulled back, in memory; the next save stores it.
    const today = dayAt(t);
    if (today === today && data.firstDay > today) data.firstDay = today;
  }

  const api: FullProfile = {
    data(): Readonly<SaveData> {
      readLives(clock());
      return data;
    },

    subscribe(listener: () => void): () => void {
      if (typeof listener !== 'function') return () => {};
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
      // Without a clock the timer cannot be read: report a full interval rather than nonsense.
      const wait = t === NO_CLOCK || data.lifeTimer <= 0 ? LIFE_REGEN_MS : data.lifeTimer + LIFE_REGEN_MS - t;
      return { count: data.lives, max: MAX_LIVES, nextInMs: Math.min(LIFE_REGEN_MS, Math.max(1, wait)) };
    },

    loseLife(): boolean {
      const t = clock();
      const synced = syncLives(t);
      const ok = data.lives > 0;
      if (ok) {
        if (data.lives >= MAX_LIVES) data.lifeTimer = t; // dropping from full starts the timer
        data.lives -= 1;
      }
      // A failed or abandoned level sends the Caravan home, whether or not a life was left to take.
      const hadCaravan = data.caravan > 0;
      data.caravan = 0;
      finish(ok || hadCaravan, synced);
      return ok;
    },

    refillLives(): boolean {
      const synced = syncLives(clock());
      const ok = data.lives < MAX_LIVES && data.coins >= REFILL_LIVES_PRICE;
      if (ok) {
        data.coins -= REFILL_LIVES_PRICE;
        data.lives = MAX_LIVES;
        data.lifeTimer = 0;
      }
      finish(ok, synced);
      return ok;
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
      const synced = syncLives(clock());
      let changed = false;
      for (const r of rewards) changed = applyReward(r) || changed;
      finish(changed, synced);
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
      // Judged before this win is written: the win that unlocks the Caravan is not yet part of it.
      const caravanOn = reached(FEATURE_UNLOCK_LEVEL.caravan);
      const summary: LevelResultSummary = {
        firstClear: !prev,
        newStars: Math.max(0, won - prevStars),
        coinsEarned: levelReward(prevStars, won, isHard(levelId)),
        // The first score on a level is its best by definition; later ones must beat it.
        newBest: !prev || points > prev.best,
      };
      data.levels[key] = {
        stars: Math.max(prevStars, won) as 1 | 2 | 3,
        best: prev ? Math.max(prev.best, points) : points,
      };
      addCoinsRaw(summary.coinsEarned);
      // Only a first clear moves the Caravan on: replaying cleared levels cannot farm it.
      // Before it unlocks there is no Caravan: whatever a damaged save claims is dropped here.
      if (!caravanOn) data.caravan = 0;
      else if (!prev) data.caravan = Math.min(MAX_STREAK, data.caravan + 1);
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
      return { canClaim: s.canClaim, cycleDay: s.cycleDay, streak: s.streak, cycle: DAILY_CYCLE.map((_, i) => dailyRewards(i)) };
    },

    claimDaily(): Reward[] | null {
      const t = clock();
      const s = dailyState(t);
      if (!s.canClaim) return null;
      const rewards = dailyRewards(s.cycleDay);
      syncLives(t); // a reward may hold lives; the commit below stores the synced pair as well
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
      if (data.seen.indexOf(id) >= 0) return;
      data.seen.push(id);
      // A full list forgets its oldest ids rather than refusing the new one: `hasSeen(id)` is always
      // true right after `markSeen(id)`, however long the game has been played.
      trimSeen(data.seen);
      commit();
    },

    reset(): void {
      // Progress, coins, boosters, lives, daily streak, tips and stats start over. The player's
      // device preferences (language, sound, music, vibration) are not progress and stay as they are.
      // What was paid for with real money (tokens, entitlements), the ad counters and the day the
      // player first played are not progress either: a reset must never undo a purchase record.
      const fresh = freshSave();
      fresh.settings = data.settings;
      fresh.shop = data.shop;
      fresh.firstDay = data.firstDay;
      Object.assign(data, fresh); // in place: objects handed out by data() / settings() stay valid
      commit();
    },

    // ── extensions: unlocks, gating, Caravan (./extensions.ts) ──

    boosterUnlocked(id: BoosterId): boolean {
      return boosterOpen(id);
    },

    claimUnlocks(): { id: BoosterId; amount: number }[] {
      const out: { id: BoosterId; amount: number }[] = [];
      for (const id of BOOSTER_UNLOCK_ORDER) {
        if (!boosterOpen(id) || data.gifted.indexOf(id) >= 0) continue;
        const amount = BOOSTER_UNLOCK_GIFT[id];
        data.gifted.push(id);
        addBoosterRaw(id, amount);
        out.push({ id, amount });
      }
      if (out.length > 0) commit();
      return out;
    },

    featureUnlocked(feature: FeatureId): boolean {
      if (feature === 'daily') {
        const today = dayAt(clock());
        if (today !== today) return false;
        // Before the first save there is no first day yet: today is the first day.
        const first = data.firstDay < 0 ? today : data.firstDay;
        return today - first >= DAILY_UNLOCK_AFTER_DAYS;
      }
      const level = Object.prototype.hasOwnProperty.call(FEATURE_UNLOCK_LEVEL, feature) ? FEATURE_UNLOCK_LEVEL[feature] : NaN;
      return typeof level === 'number' && reached(level); // an unknown feature is never unlocked
    },

    caravan(): number {
      return reached(FEATURE_UNLOCK_LEVEL.caravan) ? data.caravan : 0;
    },

    caravanBoosters(): StartBoosters {
      const wins = api.caravan();
      const out: StartBoosters = {};
      if (wins >= CARAVAN_BEAM_NOVA_WINS) out.beamNova = true;
      if (wins >= CARAVAN_PRISM_WINS) out.prism = true;
      if (wins >= CARAVAN_EXTRA_MOVES_WINS) out.extraMoves = true;
      return out;
    },

    addLife(): boolean {
      const synced = syncLives(clock());
      const ok = addLives(1);
      finish(ok, synced);
      return ok;
    },

    continuePrice(n: number): number | null {
      return continuePriceOrNull(n);
    },

    // ── extensions: monetisation bookkeeping (./extensions.ts, rules in src/monetize) ──

    shop(): Readonly<ShopSave> {
      return data.shop;
    },

    lastSaveOk(): boolean {
      return saveOk;
    },

    purchaseGranted(token: string): boolean {
      const key = purchaseKey(token);
      return key !== null && data.shop.tokens.indexOf(key) >= 0;
    },

    purchaseSaved(token: string): boolean {
      const key = purchaseKey(token);
      // Not granted at all, or the save that should hold the grant is known to have failed.
      if (key === null || data.shop.tokens.indexOf(key) < 0 || !saveOk) return false;
      // Read back what the next launch would load: only that proves the grant is stored.
      let stored: unknown;
      try {
        stored = deps.load();
      } catch {
        return false;
      }
      if (typeof stored !== 'string' || stored.length === 0) return false;
      if (stored === lastJson) return true; // exactly what was written last, which holds the token
      // Not the same text (a storage layer may re-encode it): what counts is that the token is in it.
      return parseSave(stored).shop.tokens.indexOf(key) >= 0;
    },

    grantPurchase(token: string, rewards: Reward[], entitlement?: string | null): boolean {
      const shop = data.shop;
      const key = purchaseKey(token);
      if (key === null || shop.tokens.indexOf(key) >= 0) return false;
      syncLives(clock()); // a reward may hold lives; the commit below stores the synced pair as well
      if (Array.isArray(rewards)) for (const r of rewards) applyReward(r);
      shop.tokens.push(key);
      if (shop.tokens.length > MAX_PURCHASE_TOKENS) shop.tokens.splice(0, shop.tokens.length - MAX_PURCHASE_TOKENS);
      if (isEntitlementId(entitlement)) addOwned(entitlement);
      shop.purchased = true;
      commit();
      return true;
    },

    setEntitlement(id: string, owned: boolean): boolean {
      const shop = data.shop;
      if (!isEntitlementId(id)) return false;
      if (owned === true) {
        if (!addOwned(id)) return false;
        shop.purchased = true;
      } else {
        const at = shop.owned.indexOf(id);
        if (at < 0) return false;
        shop.owned.splice(at, 1);
      }
      commit();
      return true;
    },

    adsToday(): AdsToday {
      const shop = data.shop;
      const today = dayAt(clock());
      const stale = today === today && today > shop.adDay; // counters of an earlier day
      const rewarded = { extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 };
      let total = 0;
      if (!stale) {
        for (const p of REWARDED_PLACEMENTS) {
          rewarded[p] = shop.rewarded[p];
          total += shop.rewarded[p];
        }
      }
      return { rewarded, rewardedTotal: total, interstitials: stale ? 0 : shop.interstitials };
    },

    noteRewarded(placement: RewardedPlacement, earned: boolean): void {
      const shop = data.shop;
      const t = clock();
      rollAdDay(t);
      if (earned === true && isPlacement(placement)) shop.rewarded[placement] = Math.min(MAX_AD_COUNT, shop.rewarded[placement] + 1);
      if (t !== NO_CLOCK) shop.lastRewarded = t;
      commit();
    },

    noteInterstitial(): void {
      const shop = data.shop;
      const t = clock();
      rollAdDay(t);
      shop.interstitials = Math.min(MAX_AD_COUNT, shop.interstitials + 1);
      shop.finished = 0;
      if (t !== NO_CLOCK) shop.lastInterstitial = t;
      commit();
    },

    noteLevelFinished(): number {
      const shop = data.shop;
      shop.finished = Math.min(MAX_COUNTER, shop.finished + 1);
      // An ad time ahead of the clock (it was set back since) counts as "just now": see ProfileShop.
      const t = clock();
      if (t !== NO_CLOCK) {
        if (shop.lastInterstitial > t) shop.lastInterstitial = t;
        if (shop.lastRewarded > t) shop.lastRewarded = t;
      }
      commit();
      return shop.finished;
    },

    daysSinceFirstPlay(): number {
      const today = dayAt(clock());
      return today === today && data.firstDay >= 0 ? Math.max(0, today - data.firstDay) : 0;
    },
  };

  return api;
}
