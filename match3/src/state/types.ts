/**
 * Player profile contract: progress, economy, lives, daily reward, settings. Pure logic with an
 * injectable clock and storage so it is fully unit-testable. Numbers/prices: docs/DESIGN.md §5.
 */
import type { InLevelBooster } from '../engine/types.ts';
import type { Lang } from '../i18n/types.ts';

export type StartBoosterId = 'extraMoves' | 'prism' | 'beamNova';
export type BoosterId = InLevelBooster | StartBoosterId;

export const ALL_BOOSTERS: readonly BoosterId[] = ['hammer', 'freeSwap', 'shuffle', 'extraMoves', 'prism', 'beamNova'];

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  /** null = follow the device language */
  lang: Lang | null;
}

export interface LevelRecord {
  stars: 1 | 2 | 3;
  best: number;
}

export interface SaveData {
  version: 1;
  /** keyed by level id */
  levels: Record<string, LevelRecord>;
  coins: number;
  lives: number;
  /** Epoch ms at which the current life started regenerating; 0 when lives are full. */
  lifeTimer: number;
  boosters: Record<BoosterId, number>;
  settings: Settings;
  /** Local-calendar day number (days since epoch in local time) of the last claimed daily reward; -1 = never. */
  dailyDay: number;
  /** Consecutive days claimed (1..), position in the 7-day cycle = (streak-1) % 7. */
  dailyStreak: number;
  /** Ids of tutorials / tips already shown. */
  seen: string[];
  stats: { played: number; won: number; bestCascade: number; totalScore: number };
}

export type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: 'booster'; id: BoosterId; amount: number }
  /** Without `amount`: refill all lives. With `amount`: add that many lives (never beyond the maximum). */
  | { kind: 'lives'; amount?: number };

export interface LivesInfo {
  count: number;
  max: number;
  /** ms until the next life, 0 when full */
  nextInMs: number;
}

export interface LevelResultSummary {
  firstClear: boolean;
  /** stars gained beyond the previous best for this level (0..3) */
  newStars: number;
  coinsEarned: number;
  newBest: boolean;
}

export interface DailyStatus {
  canClaim: boolean;
  /** 0..6 — which day of the 7-day cycle would be claimed next / was claimed today */
  cycleDay: number;
  streak: number;
  /** the 7 rewards of the cycle, for display */
  cycle: Reward[][];
}

export interface ProfileApi {
  data(): Readonly<SaveData>;
  /** Called after every change (already persisted). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  // lives
  lives(): LivesInfo;
  /** Returns false when there was no life to take. */
  loseLife(): boolean;
  /** Spend coins to refill all lives. False if not enough coins or already full. */
  refillLives(): boolean;

  // economy
  coins(): number;
  addCoins(n: number): void;
  spendCoins(n: number): boolean;
  boosterCount(id: BoosterId): number;
  addBooster(id: BoosterId, n: number): void;
  /** Consume one booster from the inventory. */
  takeBooster(id: BoosterId): boolean;
  boosterPrice(id: BoosterId): number;
  /** Buy one booster with coins. */
  buyBooster(id: BoosterId): boolean;
  grant(rewards: Reward[]): void;

  // progress
  /** Highest level id the player may play (1 at the start; last cleared + 1, capped to levelCount). */
  highestUnlocked(): number;
  record(levelId: number): LevelRecord | null;
  totalStars(): number;
  /** Register a won level; returns what changed and the coins granted. */
  recordWin(levelId: number, stars: 1 | 2 | 3, score: number, bestCascade: number): LevelResultSummary;
  recordAttempt(): void;

  // daily reward
  daily(): DailyStatus;
  claimDaily(): Reward[] | null;

  // settings & tips
  settings(): Readonly<Settings>;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  hasSeen(id: string): boolean;
  markSeen(id: string): void;

  /** Wipe all progress (keeps the language setting). */
  reset(): void;
}
