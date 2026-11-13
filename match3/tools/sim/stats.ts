/**
 * Shared pieces of the level simulator: the target win-rate bands, one simulation job (a batch of
 * games of one level with one bot — the unit of work handed to a worker thread), and the summary
 * statistics printed by run.ts and used by the tuner.
 */
import type { LevelDef } from '../../src/engine/index.ts';
import { playGame, type BotKind } from './bot.ts';

// ───────────────────────────── target bands ─────────────────────────────

export interface Band {
  /** Casual-bot win rate, per cent: lowest and highest acceptable value. */
  lo: number;
  hi: number;
  /** What the tuner aims for. */
  target: number;
  label: string;
}

/**
 * The difficulty curve, as casual-bot win rates:
 *   levels 1–5 ≥ 97 % · 6–20 80–95 % · 21–40 65–85 % · 41–80 50–75 % · 81–120 40–65 %
 *   `hard` levels 22–40 %
 *   the level that introduces a mechanic (it carries a `tutorial` id) must be nearly impossible
 *   to lose wherever it sits on the curve: ≥ 92 %.
 */
export function bandFor(level: LevelDef): Band {
  if (level.hard) return { lo: 22, hi: 40, target: 32, label: 'hard 22–40' };
  if (level.id <= 5) return { lo: 97, hi: 100, target: 99.5, label: '≥97' };
  if (level.tutorial !== undefined) return { lo: 92, hi: 100, target: 96.5, label: 'tutorial ≥92' };
  if (level.id <= 20) return { lo: 80, hi: 95, target: 88, label: '80–95' };
  if (level.id <= 40) return { lo: 65, hi: 85, target: 76, label: '65–85' };
  if (level.id <= 80) return { lo: 50, hi: 75, target: 63, label: '50–75' };
  return { lo: 40, hi: 65, target: 53, label: '40–65' };
}

/** The expert bot must win every level at least this often (per cent): no level is luck-only. */
export const EXPERT_MIN = 60;

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
  /** Sum of the moves left over in the games that were won. */
  movesLeftSum: number;
  shuffles: number;
  deadBoards: number;
  ms: number;
}

export function seedFor(levelId: number, base: number): number {
  return (base * 7919 + levelId * 100003) >>> 0;
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
    movesLeftSum: 0,
    shuffles: 0,
    deadBoards: 0,
    ms: 0,
  };
  const opts = job.moves !== undefined ? { moves: job.moves } : {};
  for (let g = 0; g < job.games; g++) {
    const res = playGame(job.level, job.seed + g, job.bot, opts);
    out.endScores.push(res.scoreBeforeBonus);
    out.shuffles += res.shuffles;
    if (res.deadBoard) out.deadBoards++;
    if (res.won) {
      out.wins++;
      out.winAt.push(res.movesUsed);
      out.winScores.push(res.score);
      out.movesLeftSum += res.movesLeft;
    } else {
      out.winAt.push(0);
    }
  }
  out.ms = Date.now() - start;
  return out;
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

export interface LevelStats {
  id: number;
  games: number;
  /** per cent */
  winRate: number;
  /** mean moves left over in the games that were won */
  movesLeft: number;
  /** final score of the wins (end bonus included) */
  p10: number;
  p50: number;
  p90: number;
  shufflesPerGame: number;
  deadBoards: number;
}

export function summarise(res: JobResult): LevelStats {
  return {
    id: res.id,
    games: res.games,
    winRate: res.games > 0 ? (100 * res.wins) / res.games : 0,
    movesLeft: res.wins > 0 ? res.movesLeftSum / res.wins : 0,
    p10: Math.round(quantile(res.winScores, 0.1)),
    p50: Math.round(quantile(res.winScores, 0.5)),
    p90: Math.round(quantile(res.winScores, 0.9)),
    shufflesPerGame: res.games > 0 ? res.shuffles / res.games : 0,
    deadBoards: res.deadBoards,
  };
}

/** '' when the casual win rate is inside the level's band, otherwise how far outside it is. */
export function bandFlag(level: LevelDef, winRate: number): string {
  const band = bandFor(level);
  if (winRate < band.lo) return `LOW −${(band.lo - winRate).toFixed(1)}`;
  if (winRate > band.hi) return `HIGH +${(winRate - band.hi).toFixed(1)}`;
  return '';
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
