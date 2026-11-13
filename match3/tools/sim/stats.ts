/**
 * Shared pieces of the level simulator: the target pass-rate bands, the acceptance gates, one
 * simulation job (a batch of games of one level with one bot — the unit of work handed to a
 * worker thread), and the summary statistics printed by run.ts and used by the tuner.
 */
import type { LevelDef } from '../../src/engine/index.ts';
import { LEVELS_PER_CHAPTER, tierOf, type LevelTier } from '../../src/levels/index.ts';
import { playGame, type BotKind } from './bot.ts';

// ───────────────────────────── target bands ─────────────────────────────

export interface Band {
  /** Casual-bot pass rate, per cent: lowest and highest acceptable value. */
  lo: number;
  hi: number;
  /** What the tuner aims for. */
  target: number;
  tier: LevelTier;
  label: string;
}

type Range = readonly [lo: number, hi: number, target: number];

/**
 * Pass-rate bands of the casual bot by chapter and tier (docs/STRATEGY.md, levels-01: a sawtooth
 * inside every chapter, and more attempts per level from chapter to chapter).
 *
 *   chapter        normal   build-up   spike    breather   mean attempts per level
 *   1  (11–20)     87–96    85–94      78–88    ≥ 93       ≈ 1.1
 *   2  (21–40)     72–86    66–80      56–68    ≥ 84       ≈ 1.3
 *   3  (41–60)     62–76    56–70      48–60    ≥ 78       ≈ 1.6
 *   4  (61–80)     58–72    52–66      46–58    ≥ 75       ≈ 1.7
 *   5  (81–100)    54–68    49–62      46–56    ≥ 72       ≈ 1.8
 *   6  (101–120)   50–64    46–58      —        ≥ 70       ≈ 2.0
 *
 * Unmarked levels never go below 46 %: anything harder must carry the `hard` mark.
 */
const CHAPTER_BANDS: readonly Record<'normal' | 'buildup' | 'spike' | 'breather', Range>[] = [
  { normal: [87, 96, 92], buildup: [85, 94, 89], spike: [78, 88, 83], breather: [93, 100, 97] },
  { normal: [72, 86, 79], buildup: [66, 80, 73], spike: [56, 68, 62], breather: [84, 100, 90] },
  { normal: [62, 76, 69], buildup: [56, 70, 63], spike: [48, 60, 54], breather: [78, 100, 85] },
  { normal: [58, 72, 65], buildup: [52, 66, 59], spike: [46, 58, 52], breather: [75, 100, 82] },
  { normal: [54, 68, 61], buildup: [49, 62, 55], spike: [46, 56, 50], breather: [72, 100, 80] },
  { normal: [50, 64, 56], buildup: [46, 58, 51], spike: [46, 56, 50], breather: [70, 100, 78] },
];

/** Levels marked hard: 30–45 % — the chapter's last spike sits in the lower half. */
export const HARD_BAND: Range = [30, 45, 40];
const HARD_FINALE_TARGET = 35;
/** Nothing in the game may be harder than this for the casual bot. */
export const PASS_FLOOR = 15;

function label(lo: number, hi: number): string {
  return hi >= 100 ? `≥${lo}` : `${lo}–${hi}`;
}

/**
 * The band a level must land in:
 *   levels 1–5 ≥ 97 % · levels 6–10 ≥ 95 % · a level that introduces a mechanic ≥ 92 %
 *   the last level of a chapter is a generous breather: ≥ 95 % in chapter 1, ≥ 90 % later
 *   `hard` levels 30–45 % · everything else by chapter and tier (see CHAPTER_BANDS)
 */
export function bandFor(level: LevelDef): Band {
  const tier = tierOf(level);
  const make = (range: Range, name: string): Band => ({ lo: range[0], hi: range[1], target: range[2], tier, label: `${name} ${label(range[0], range[1])}` });
  if (tier === 'hard') return make([HARD_BAND[0], HARD_BAND[1], level.id % LEVELS_PER_CHAPTER === LEVELS_PER_CHAPTER - 1 ? HARD_FINALE_TARGET : HARD_BAND[2]], 'hard');
  if (level.id <= 5) return make([97, 100, 99.5], 'first');
  if (level.id <= 10) return make([95, 100, 98], 'early');
  if (tier === 'tutorial') return make([92, 100, 96.5], 'tutorial');
  if (level.id % LEVELS_PER_CHAPTER === 0) return make(level.id <= LEVELS_PER_CHAPTER ? [95, 100, 98] : [90, 100, 95], 'finale');
  const chapter = Math.min(CHAPTER_BANDS.length - 1, Math.floor((level.id - 1) / LEVELS_PER_CHAPTER));
  return make(CHAPTER_BANDS[chapter]![tier], tier);
}

// ───────────────────────────── acceptance gates ─────────────────────────────

/** The expert bot must win every level at least this often (per cent): no level is luck-only. */
export const EXPERT_MIN = 60;
/** The random bot must win the first five levels at least this often (per cent). */
export const RANDOM_FIRST_MIN = 99;
/** The novice bot must win the first ten levels at least this often (per cent). */
export const NOVICE_EARLY_MIN = 90;
/** Automatic shuffles per attempt (mean) must stay below this … */
export const SHUFFLES_MAX = 0.2;
/** … and at most this share (per cent) of attempts may see two or more of them. */
export const MULTI_SHUFFLE_MAX = 2;
/** The board must offer at least this many valid moves per turn on average … */
export const VALID_MOVES_MIN = 3;
/** … and at most this share (per cent) of turns may offer fewer than three. */
export const TIGHT_TURNS_MAX = 20;
/** Stars: share (per cent) of winning games that must reach one star (the threshold `stars[0]`). */
export const ONE_STAR_MIN = 99;
/** Stars: share (per cent) of winning games with two stars or more — the median, give or take. */
export const TWO_STAR_RANGE: readonly [number, number] = [35, 65];
/** Stars: share (per cent) of winning games with three stars. */
export const THREE_STAR_RANGE: readonly [number, number] = [10, 25];
/** Extra moves of the paid continue and of the rewarded-ad continue (docs/DESIGN.md §5, §7). */
export const CONTINUE_MOVES = 5;
export const AD_MOVES = 3;

/**
 * How many moves a level may have, by where it sits (docs/STRATEGY.md gives 30–38 / 25–30 / 20–27
 * and 20–24 for hard levels; these windows keep that shape but leave the designer some room —
 * a level far outside its window needs a bigger or smaller goal, not just more or fewer moves).
 */
export function movesWindow(level: LevelDef): readonly [min: number, max: number] {
  if (level.id <= 5) return [12, 24];
  if (level.tutorial !== undefined) return [12, 30];
  if (level.id <= 10) return [16, 30];
  if (level.hard === true) return [18, 28];
  if (level.id <= 20) return [18, 36];
  if (level.id <= 100) return [20, 32];
  return [18, 30];
}

// ───────────────────────────── jobs ─────────────────────────────

export interface SimJob {
  level: LevelDef;
  bot: BotKind;
  games: number;
  /** Game g of the job uses seed `seed + g`. */
  seed: number;
  /** Play with this many moves instead of the level's own. */
  moves?: number;
}

export interface JobResult {
  id: number;
  bot: BotKind;
  games: number;
  wins: number;
  /** Per game: moves used when the game was won, 0 when it was lost. */
  winAt: number[];
  /** Per game: score when the level was decided (before any end bonus). */
  endScores: number[];
  /** Final scores (end bonus included) of the games that were won. */
  winScores: number[];
  /** Moves left over in the games that were won. */
  winMovesLeft: number[];
  /** Automatic shuffles, all games together. */
  shuffles: number;
  /** Games with two or more automatic shuffles. */
  multiShuffleGames: number;
  /** Games whose first automatic shuffle came within the first three moves. */
  earlyShuffleGames: number;
  deadBoards: number;
  /** Turns played and the valid moves they offered, all games together. */
  turns: number;
  validMoves: number;
  tightTurns: number;
  /** Lost games that a continue of CONTINUE_MOVES moves turned into a win … */
  rescued: number;
  /** … and those among them that needed at most AD_MOVES of the extra moves. */
  rescuedByAd: number;
  ms: number;
}

export function seedFor(levelId: number, base: number): number {
  return (base * 7919 + levelId * 100003) >>> 0;
}

export function isScoreOnly(level: LevelDef): boolean {
  return level.goals.length > 0 && level.goals.every((g) => g.kind === 'score');
}

export function runJob(job: SimJob): JobResult {
  const start = Date.now();
  const out: JobResult = {
    id: job.level.id,
    bot: job.bot,
    games: job.games,
    wins: 0,
    winAt: [],
    endScores: [],
    winScores: [],
    winMovesLeft: [],
    shuffles: 0,
    multiShuffleGames: 0,
    earlyShuffleGames: 0,
    deadBoards: 0,
    turns: 0,
    validMoves: 0,
    tightTurns: 0,
    rescued: 0,
    rescuedByAd: 0,
    ms: 0,
  };
  // With a move cap (the tuner) there is no loss to continue from.
  const opts = job.moves !== undefined ? { moves: job.moves } : { continueWith: CONTINUE_MOVES };
  for (let g = 0; g < job.games; g++) {
    const res = playGame(job.level, job.seed + g, job.bot, opts);
    out.endScores.push(res.scoreBeforeBonus);
    out.shuffles += res.shuffles;
    if (res.shuffles >= 2) out.multiShuffleGames++;
    if (res.firstShuffleAt > 0 && res.firstShuffleAt <= 3) out.earlyShuffleGames++;
    if (res.deadBoard) out.deadBoards++;
    out.turns += res.movesUsed;
    out.validMoves += res.validMoves;
    out.tightTurns += res.tightTurns;
    if (res.won) {
      out.wins++;
      out.winAt.push(res.movesUsed);
      out.winScores.push(res.score);
      out.winMovesLeft.push(res.movesLeft);
    } else {
      out.winAt.push(0);
      if (res.rescuedAt > 0) {
        out.rescued++;
        if (res.rescuedAt <= AD_MOVES) out.rescuedByAd++;
      }
    }
  }
  out.ms = Date.now() - start;
  return out;
}

/** Add the games of `more` to `into` (same level, same bot) and return `into`. */
export function mergeJobs(into: JobResult, more: JobResult): JobResult {
  into.games += more.games;
  into.wins += more.wins;
  into.winAt = into.winAt.concat(more.winAt);
  into.endScores = into.endScores.concat(more.endScores);
  into.winScores = into.winScores.concat(more.winScores);
  into.winMovesLeft = into.winMovesLeft.concat(more.winMovesLeft);
  into.shuffles += more.shuffles;
  into.multiShuffleGames += more.multiShuffleGames;
  into.earlyShuffleGames += more.earlyShuffleGames;
  into.deadBoards += more.deadBoards;
  into.turns += more.turns;
  into.validMoves += more.validMoves;
  into.tightTurns += more.tightTurns;
  into.rescued += more.rescued;
  into.rescuedByAd += more.rescuedByAd;
  into.ms += more.ms;
  return into;
}

// ───────────────────────────── statistics ─────────────────────────────

/** Quantile (0..1) of a list by linear interpolation; 0 for an empty list. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const percent = (part: number, whole: number): number => (whole > 0 ? round1((100 * part) / whole) : 0);

export interface LevelStats {
  id: number;
  games: number;
  /** per cent */
  winRate: number;
  /** mean attempts until the level is passed = 100 / winRate (Infinity when never won) */
  attempts: number;
  /** moves left over in the games that were won: mean and median */
  movesLeft: number;
  movesLeftMedian: number;
  /** final score of the wins (end bonus included) */
  p10: number;
  p50: number;
  p85: number;
  p90: number;
  /** share (per cent) of the wins whose final score reaches the level's star thresholds */
  star1: number;
  star2: number;
  star3: number;
  shufflesPerGame: number;
  /** share (per cent) of the games with two or more shuffles / with a shuffle in the first three moves */
  multiShuffle: number;
  earlyShuffle: number;
  deadBoards: number;
  /** valid moves offered per turn (mean) and share (per cent) of turns that offered fewer than three */
  validMoves: number;
  tightTurns: number;
  /** share (per cent) of the losses that the paid continue (+5 moves) / the ad continue (+3) rescues */
  rescued: number;
  rescuedByAd: number;
}

export function summarise(res: JobResult, level: LevelDef): LevelStats {
  const losses = res.games - res.wins;
  const reach = (threshold: number): number => percent(res.winScores.filter((s) => s >= threshold).length, res.wins);
  return {
    id: res.id,
    games: res.games,
    winRate: res.games > 0 ? (100 * res.wins) / res.games : 0,
    attempts: res.wins > 0 ? res.games / res.wins : Infinity,
    movesLeft: res.wins > 0 ? res.winMovesLeft.reduce((a, b) => a + b, 0) / res.wins : 0,
    movesLeftMedian: quantile(res.winMovesLeft, 0.5),
    p10: Math.round(quantile(res.winScores, 0.1)),
    p50: Math.round(quantile(res.winScores, 0.5)),
    p85: Math.round(quantile(res.winScores, 0.85)),
    p90: Math.round(quantile(res.winScores, 0.9)),
    star1: reach(level.stars[0]),
    star2: reach(level.stars[1]),
    star3: reach(level.stars[2]),
    shufflesPerGame: res.games > 0 ? round2(res.shuffles / res.games) : 0,
    multiShuffle: percent(res.multiShuffleGames, res.games),
    earlyShuffle: percent(res.earlyShuffleGames, res.games),
    deadBoards: res.deadBoards,
    validMoves: res.turns > 0 ? round1(res.validMoves / res.turns) : 0,
    tightTurns: percent(res.tightTurns, res.turns),
    rescued: percent(res.rescued, losses),
    rescuedByAd: percent(res.rescuedByAd, losses),
  };
}

/** '' when the casual pass rate is inside the level's band, otherwise how far outside it is. */
export function bandFlag(level: LevelDef, winRate: number): string {
  const band = bandFor(level);
  if (winRate < band.lo) return `LOW −${(band.lo - winRate).toFixed(1)}`;
  if (winRate > band.hi) return `HIGH +${(winRate - band.hi).toFixed(1)}`;
  return '';
}

/**
 * Everything about a level's casual-bot statistics that breaks an acceptance gate (pass-rate
 * band, shuffles, valid moves, dead boards, star thresholds). Empty = accepted.
 */
export function gateProblems(level: LevelDef, stats: LevelStats): string[] {
  const out: string[] = [];
  const band = bandFlag(level, stats.winRate);
  if (band !== '') out.push(`pass ${band}`);
  if (stats.winRate < PASS_FLOOR) out.push(`pass rate below the ${PASS_FLOOR} % floor`);
  if (stats.shufflesPerGame >= SHUFFLES_MAX) out.push(`shuffles ${stats.shufflesPerGame.toFixed(2)}/game`);
  if (stats.multiShuffle > MULTI_SHUFFLE_MAX) out.push(`${stats.multiShuffle}% of games with 2+ shuffles`);
  if (stats.deadBoards > 0) out.push(`dead board ×${stats.deadBoards}`);
  if (stats.validMoves < VALID_MOVES_MIN) out.push(`only ${stats.validMoves} valid moves per turn`);
  if (stats.tightTurns > TIGHT_TURNS_MAX) out.push(`${stats.tightTurns}% of turns with fewer than 3 moves`);
  if (stats.star1 < ONE_STAR_MIN) out.push(`1★ in only ${stats.star1}% of wins`);
  if (stats.star2 < TWO_STAR_RANGE[0] || stats.star2 > TWO_STAR_RANGE[1]) out.push(`2★ in ${stats.star2}% of wins`);
  if (stats.star3 < THREE_STAR_RANGE[0] || stats.star3 > THREE_STAR_RANGE[1]) out.push(`3★ in ${stats.star3}% of wins`);
  return out;
}

/** A short description of a level's goals for tables, e.g. "sand + amber×30". */
export function describeGoals(level: LevelDef): string {
  const names = ['ruby', 'amber', 'emerald', 'sapphire', 'amethyst', 'moonstone'];
  return level.goals
    .map((g) => {
      if (g.kind === 'score') return `score ${g.target}`;
      if (g.kind === 'color') return `${names[g.color]}×${g.target}`;
      if (g.kind === 'lamp') return `lamp×${g.target}`;
      return g.kind;
    })
    .join(' + ');
}

/** Parse "1-120", "7", "1-5,10,20-25" into a sorted list of ids. */
export function parseRange(spec: string, max: number): number[] {
  const ids = new Set<number>();
  for (const part of spec.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) throw new Error(`bad level range "${part}"`);
    const from = Number(m[1]);
    const to = m[2] !== undefined ? Number(m[2]) : from;
    for (let id = from; id <= to && id <= max; id++) if (id >= 1) ids.add(id);
  }
  return Array.from(ids).sort((a, b) => a - b);
}
