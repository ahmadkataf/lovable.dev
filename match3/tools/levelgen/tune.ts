/**
 * Automatic balancing of the hand-designed levels in src/levels/data/.
 *
 *   node tools/levelgen/tune.ts --levels 1-120 --write
 *
 * The layouts, colours and goals are the designer's; this tool only fits the numbers to the
 * casual bot (tools/sim/bot.ts) so that every level lands in its pass-rate band (tools/sim/stats.ts):
 *
 *   1. moves — the level is played with a generous move cap; the number of moves each game
 *      needed to reach the goals gives the pass rate for every possible move count at once, and
 *      the count closest to the band's target is chosen.
 *      Score-only levels keep the designer's move count; instead the score target is set to the
 *      matching quantile of the scores reached when the moves run out.
 *   2. stars — the tuned level is played again with fresh seeds: stars[0] is a score practically
 *      every win reaches (for score-only levels it IS the target), stars[1] the median and
 *      stars[2] the 85th percentile of the winning games' final scores.
 *
 * The table also shows what the tool cannot fix: a tuned move count outside the level's window
 * (the goal is too small or too big for its place — change the goal or the layout), and a long
 * tail (p90 of the moves needed far above the median: the level is decided by luck).
 *
 * Options: --levels (range), --games N (default 1000), --seed N, --write (patch the data files;
 * without it the tool only prints what it would do), --stars-only (keep moves / targets),
 * --target-shift X (aim X points above the band target; negative = harder).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../../src/levels/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { runJobs } from '../sim/pool.ts';
import { bandFlag, bandFor, describeGoals, isScoreOnly, movesWindow, parseRange, quantile, seedFor, type SimJob } from '../sim/stats.ts';

/** Moves given to the bot while measuring how many it needs. */
const MOVE_CAP = 100;

interface Args {
  levels: number[];
  games: number;
  seed: number;
  write: boolean;
  starsOnly: boolean;
  shift: number;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { levels: LEVELS.map((l) => l.id), games: 1000, seed: 1000, write: false, starsOnly: false, shift: 0 };
  for (let k = 0; k < argv.length; k++) {
    const flag = argv[k]!;
    const value = (): string => {
      const v = argv[++k];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    if (flag === '--levels') args.levels = parseRange(value(), LEVELS.length);
    else if (flag === '--games') args.games = Math.max(50, Math.floor(Number(value())));
    else if (flag === '--seed') args.seed = Math.floor(Number(value()));
    else if (flag === '--write') args.write = true;
    else if (flag === '--stars-only') args.starsOnly = true;
    else if (flag === '--target-shift') args.shift = Number(value());
    else throw new Error(`unknown option ${flag}`);
  }
  return args;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * The three star thresholds from the final scores of winning games: one star for (practically)
 * every win, two at the median, three at the 85th percentile.
 */
export function starsFrom(level: LevelDef, winScores: readonly number[]): [number, number, number] {
  if (winScores.length === 0) return level.stars;
  let s1: number;
  if (isScoreOnly(level)) {
    s1 = (level.goals[0] as { kind: 'score'; target: number }).target;
  } else {
    // "every win reaches it": just under the lowest scores seen
    s1 = Math.max(100, Math.floor(quantile(winScores, 0.003) / 100) * 100);
  }
  let s2 = roundTo(quantile(winScores, 0.5), 100);
  let s3 = roundTo(quantile(winScores, 0.85), 100);
  if (s2 <= s1) s2 = s1 + 200;
  if (s3 <= s2) s3 = s2 + 300;
  return [s1, s2, s3];
}

const DATA_FILES = [1, 2, 3, 4, 5, 6].map((n) => fileURLToPath(new URL(`../../src/levels/data/chapter${n}.ts`, import.meta.url)));

/** Rewrite `moves`, `stars` and (score-only levels) the score target of one level literal. */
function patchLevel(source: string, level: LevelDef): string | null {
  const start = new RegExp(`\\bid: ${level.id},`).exec(source);
  if (!start) return null;
  const from = start.index;
  const nextId = /\bid: \d+,/g;
  nextId.lastIndex = from + 4;
  const next = nextId.exec(source);
  const to = next ? next.index : source.length;
  let block = source.slice(from, to);
  block = block.replace(/moves: \d+/, `moves: ${level.moves}`);
  block = block.replace(/stars: \[[^\]]*\]/, `stars: [${level.stars.join(', ')}]`);
  if (isScoreOnly(level)) {
    const target = (level.goals[0] as { kind: 'score'; target: number }).target;
    block = block.replace(/kind: 'score', target: \d+/, `kind: 'score', target: ${target}`);
  }
  return source.slice(0, from) + block + source.slice(to);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const levels = args.levels.map((id) => {
    const level = LEVELS[id - 1];
    if (!level || level.id !== id) throw new Error(`no level ${id}`);
    return level;
  });
  const started = Date.now();

  // ── pass 1: how many moves (or which score target) ──
  const tuned: LevelDef[] = levels.map((l) => ({ ...l, goals: l.goals.map((g) => ({ ...g })), stars: [l.stars[0], l.stars[1], l.stars[2]] }));
  const notes: string[] = levels.map(() => '');
  if (!args.starsOnly) {
    const jobs: SimJob[] = levels.map((level) =>
      isScoreOnly(level)
        ? { level: { ...level, goals: [{ kind: 'score', target: 1 }], stars: [1, 2, 3] }, bot: 'casual', games: args.games, seed: seedFor(level.id, args.seed), moves: level.moves }
        : { level, bot: 'casual', games: args.games, seed: seedFor(level.id, args.seed), moves: MOVE_CAP },
    );
    const results = await runJobs(jobs);
    levels.forEach((level, k) => {
      const res = results[k]!;
      const band = bandFor(level);
      const want = Math.min(99.8, band.target + args.shift) / 100;
      const out = tuned[k]!;
      if (isScoreOnly(level)) {
        const target = Math.max(100, Math.floor(quantile(res.endScores, 1 - want) / 50) * 50);
        out.goals = [{ kind: 'score', target }];
        out.stars = [target, target + 1, target + 2];
        notes[k] = `scores p10 ${quantile(res.endScores, 0.1).toFixed(0)} / p50 ${quantile(res.endScores, 0.5).toFixed(0)}`;
      } else {
        let best = MOVE_CAP;
        let bestGap = Infinity;
        for (let m = 3; m <= MOVE_CAP; m++) {
          let wins = 0;
          for (const at of res.winAt) if (at > 0 && at <= m) wins++;
          const gap = Math.abs(wins / res.games - want);
          if (gap < bestGap - 1e-9) {
            bestGap = gap;
            best = m;
          }
        }
        out.moves = best;
        const needed = res.winAt.filter((at) => at > 0);
        const p50 = quantile(needed, 0.5);
        const p90 = quantile(needed, 0.9);
        const [lo, hi] = movesWindow(level);
        const flags: string[] = [];
        if (best < lo) flags.push(`MOVES<${lo}`);
        if (best > hi) flags.push(`MOVES>${hi}`);
        if (p50 > 0 && p90 / p50 > 1.75) flags.push('TAIL');
        if (needed.length < res.games) flags.push(`${res.games - needed.length} unsolved in ${MOVE_CAP}`);
        notes[k] = `needs ${quantile(needed, 0.1).toFixed(0)}/${p50.toFixed(0)}/${p90.toFixed(0)} (×${(p50 > 0 ? p90 / p50 : 0).toFixed(2)})${flags.length > 0 ? '  ' + flags.join(' ') : ''}`;
      }
    });
  }

  // ── pass 2: verify with fresh seeds and derive the stars ──
  const verify = await runJobs(tuned.map((level) => ({ level, bot: 'casual', games: args.games, seed: seedFor(level.id, args.seed + 1) }) as SimJob));
  console.log(' lvl  moves     band               pass%  shuf  goals                               notes');
  let flagged = 0;
  tuned.forEach((level, k) => {
    const res = verify[k]!;
    level.stars = starsFrom(level, res.winScores);
    const rate = (100 * res.wins) / res.games;
    const flag = bandFlag(level, rate);
    if (flag !== '') flagged++;
    const before = levels[k]!;
    const moves = before.moves === level.moves ? `${level.moves}` : `${before.moves}→${level.moves}`;
    console.log(
      `${String(level.id).padStart(4)}  ${moves.padEnd(8)}  ${bandFor(level).label.padEnd(17)}  ${rate.toFixed(1).padStart(5)}  ${(res.shuffles / res.games).toFixed(2)}  ${describeGoals(level).padEnd(34)}  ${flag}${flag ? ' · ' : ''}${notes[k]}`,
    );
  });
  console.log(`\n${tuned.length - flagged}/${tuned.length} in band · ${((Date.now() - started) / 1000).toFixed(1)} s`);

  if (args.write) {
    for (const file of DATA_FILES) {
      let source = readFileSync(file, 'utf8');
      let changed = false;
      for (const level of tuned) {
        const patched = patchLevel(source, level);
        if (patched !== null && patched !== source) {
          source = patched;
          changed = true;
        }
      }
      if (changed) writeFileSync(file, source);
    }
    console.log('data files updated');
  } else {
    console.log('(dry run — pass --write to update src/levels/data/)');
  }
}

// Only when run as a script (the tests import `starsFrom`).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exit(1);
  });
}
