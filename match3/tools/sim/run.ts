/**
 * Level simulator.
 *
 *   node tools/sim/run.ts --levels 1-120 --games 600 --bot casual
 *   node tools/sim/run.ts --report            (the full balance run; rewrites REPORT.md and report.json)
 *
 * Prints one row per level: pass rate, attempts, moves left when winning, how the star thresholds
 * split the wins, shuffles, valid moves per turn, how many losses a continue rescues, and every
 * acceptance gate the level breaks (bands and gates: ./stats.ts; they are defined for the casual
 * bot — for the expert bot the flag marks levels it wins less than 60 % of the time).
 *
 * Options:
 *   --levels  "1-120", "7", "1-5,10,20-25"      (default: all)
 *   --games   games per level                    (default 600; with --report 1000)
 *   --bot     random | novice | casual | expert  (default casual)
 *   --seed    base seed                          (default 1; with --report 2026)
 *   --workers worker threads, at most 3          (default 3)
 *   --report  the full run: casual bot on every level, expert bot on every level
 *             (--expert-games, default 500), random bot on levels 1–5 and novice bot on
 *             levels 1–10; writes tools/sim/REPORT.md and tools/sim/report.json. The level
 *             tests read report.json, so run this after every change to the levels or the bots.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHAPTERS, LEVELS, tierOf } from '../../src/levels/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { BOT_KINDS, type BotKind } from './bot.ts';
import { runJobs, workerCount } from './pool.ts';
import {
  EXPERT_MIN,
  NOVICE_EARLY_MIN,
  RANDOM_FIRST_MIN,
  bandFlag,
  bandFor,
  describeGoals,
  gateProblems,
  levelHash,
  parseRange,
  seedFor,
  summarise,
  type JobResult,
  type LevelStats,
  type SimJob,
} from './stats.ts';

interface Args {
  levels: number[];
  games: number | null;
  bot: BotKind;
  seed: number | null;
  workers: number;
  report: boolean;
  expertGames: number;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { levels: LEVELS.map((l) => l.id), games: null, bot: 'casual', seed: null, workers: workerCount(), report: false, expertGames: 500 };
  for (let k = 0; k < argv.length; k++) {
    const flag = argv[k]!;
    const value = (): string => {
      const v = argv[++k];
      if (v === undefined) throw new Error(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case '--levels':
        args.levels = parseRange(value(), LEVELS.length);
        break;
      case '--games':
        args.games = Math.max(1, Math.floor(Number(value())));
        break;
      case '--bot': {
        const bot = value() as BotKind;
        if (BOT_KINDS.indexOf(bot) < 0) throw new Error(`unknown bot "${bot}" (use ${BOT_KINDS.join(', ')})`);
        args.bot = bot;
        break;
      }
      case '--seed':
        args.seed = Math.floor(Number(value()));
        break;
      case '--workers':
        args.workers = workerCount(Number(value()));
        break;
      case '--report':
        args.report = true;
        break;
      case '--expert-games':
        args.expertGames = Math.max(1, Math.floor(Number(value())));
        break;
      default:
        throw new Error(`unknown option ${flag}`);
    }
  }
  if ((args.games !== null && !Number.isFinite(args.games)) || (args.seed !== null && !Number.isFinite(args.seed))) throw new Error('--games and --seed need numbers');
  return args;
}

function levelById(id: number): LevelDef {
  const level = LEVELS[id - 1];
  if (!level || level.id !== id) throw new Error(`no level ${id}`);
  return level;
}

function pad(text: string | number, width: number): string {
  const s = String(text);
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

function flagsFor(level: LevelDef, bot: BotKind, stats: LevelStats): string {
  if (bot === 'casual') return gateProblems(level, stats).join('; ');
  if (bot === 'expert') return stats.winRate < EXPERT_MIN ? `LOW −${(EXPERT_MIN - stats.winRate).toFixed(1)}` : '';
  return '';
}

function printTable(levels: readonly LevelDef[], bot: BotKind, stats: readonly LevelStats[]): number {
  console.log(` lvl  ${pad('band', 17)}  ${pad('pass%', 6)} ${pad('tries', 5)}  ${pad('left', 4)}  ${pad('1★/2★/3★ %', 13)}  ${pad('shuf', 5)} ${pad('moves', 5)}  ${pad('+5', 3)}  flags`);
  let flagged = 0;
  levels.forEach((level, k) => {
    const s = stats[k]!;
    const flags = flagsFor(level, bot, s);
    if (flags !== '') flagged++;
    const band = bot === 'expert' ? `≥${EXPERT_MIN}` : bot === 'casual' ? bandFor(level).label : '—';
    const stars = `${Math.round(s.star1)}/${Math.round(s.star2)}/${Math.round(s.star3)}`;
    console.log(
      `${pad(level.id, 4)}  ${pad(band, 17)}  ${pad(s.winRate.toFixed(1), 6)} ${pad(Number.isFinite(s.attempts) ? s.attempts.toFixed(2) : '∞', 5)}  ${pad(s.movesLeftMedian.toFixed(0), 4)}  ${pad(stars, 13)}  ${pad(s.shufflesPerGame.toFixed(2), 5)} ${pad(s.validMoves.toFixed(1), 5)}  ${pad(Math.round(s.rescued), 3)}  ${flags}`,
    );
  });
  return flagged;
}

// ───────────────────────────── the report ─────────────────────────────

interface ReportLevel {
  id: number;
  hash: string;
  casual: LevelStats;
  expert: number;
  /** Levels 1–5 only. */
  random?: number;
  /** Levels 1–10 only. */
  novice?: number;
}

export interface ReportFile {
  seed: number;
  casualGames: number;
  expertGames: number;
  levels: ReportLevel[];
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** The bands of the original brief (flat per range), kept in the report for comparison. */
function briefBand(level: LevelDef): [number, number] {
  if (level.hard) return [22, 40];
  if (level.id <= 5) return [97, 100];
  if (level.id <= 20) return [80, 95];
  if (level.id <= 40) return [65, 85];
  if (level.id <= 80) return [50, 75];
  return [40, 65];
}

function reportMarkdown(file: ReportFile, levels: readonly LevelDef[]): string {
  const rows = file.levels;
  const out: string[] = [];
  const problems = rows.map((r, k) => gateProblems(levels[k]!, r.casual));
  const inBand = rows.filter((r, k) => bandFlag(levels[k]!, r.casual.winRate) === '').length;
  const expertOk = rows.filter((r) => r.expert >= EXPERT_MIN).length;
  const gatesOk = problems.filter((p) => p.length === 0).length;
  const hard = levels.filter((l) => l.hard === true);

  out.push('# Level balance report');
  out.push('');
  out.push(`Generated by \`node tools/sim/run.ts --report\` (seed ${file.seed}): casual bot ${file.casualGames} games per level, expert bot ${file.expertGames} games per level, random bot on levels 1–5 and novice bot on levels 1–10. The tuner (\`tools/levelgen/tune.ts\`) uses other seeds, so these are fresh games.`);
  out.push('');
  out.push('The bots (`tools/sim/bot.ts`): **random** plays any valid move; **novice** plays a random move half the time; **casual** — the yardstick — ranks moves by what they do at first sight (goal progress, then specials, then matches beside the goal), plays the best one 60 % of the time, one of the best four 28 % and any move 12 %; **expert** tries every move on re-seeded copies of the game (it sees the board fall, not the gems that will drop in). Until real players calibrate it, the casual pass rate stands in for the human one: trust the order of the levels more than the absolute numbers. The casual bot does not plan, so it is weakest where planning pays most — lamp levels — and those are probably a little easier for people than the table says.');
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(`- Pass-rate band (by chapter and tier, see \`bandFor\` in tools/sim/stats.ts): **${inBand} of ${rows.length}** levels inside.`);
  out.push(`- Expert bot ≥ ${EXPERT_MIN} %: **${expertOk} of ${rows.length}** levels (lowest: ${Math.min(...rows.map((r) => r.expert)).toFixed(1)} %).`);
  out.push(`- All acceptance gates (band, shuffles < 0.2 per attempt and ≤ 2 % of attempts with two or more, ≥ 3 valid moves per turn, no dead board, star thresholds): **${gatesOk} of ${rows.length}** levels.`);
  const random = rows.filter((r) => r.random !== undefined);
  const novice = rows.filter((r) => r.novice !== undefined);
  if (random.length > 0) out.push(`- Random bot on levels 1–5 (gate ≥ ${RANDOM_FIRST_MIN} %): ${random.map((r) => `L${r.id} ${r.random!.toFixed(1)} %`).join(', ')}.`);
  if (novice.length > 0) out.push(`- Novice bot on levels 1–10 (gate ≥ ${NOVICE_EARLY_MIN} %): ${novice.map((r) => `L${r.id} ${r.novice!.toFixed(1)} %`).join(', ')}.`);
  out.push(`- Hard levels (${hard.length}): ${hard.map((l) => `L${l.id} ${rows[l.id - 1]!.casual.winRate.toFixed(1)} %`).join(', ')}. Hardest level of the game for the casual bot: ${Math.min(...rows.map((r) => r.casual.winRate)).toFixed(1)} %.`);
  out.push('');
  out.push('## The curve');
  out.push('');
  out.push('| chapter | levels | mean pass % | mean attempts per level | spikes → the breather after them |');
  out.push('|---|---|---:|---:|---|');
  for (const chapter of CHAPTERS) {
    const slice = rows.slice(chapter.from - 1, chapter.to);
    const spikes: string[] = [];
    for (let id = chapter.from; id < chapter.to; id++) {
      const tier = tierOf(levels[id - 1]!);
      if (tier !== 'spike' && tier !== 'hard') continue;
      const here = rows[id - 1]!.casual.winRate;
      const next = rows[id]!.casual.winRate;
      spikes.push(`${id}${tier === 'hard' ? '★' : ''} ${here.toFixed(0)} → ${next.toFixed(0)}`);
    }
    out.push(`| ${chapter.index + 1} ${chapter.theme} | ${chapter.from}–${chapter.to} | ${mean(slice.map((r) => r.casual.winRate)).toFixed(1)} | ${mean(slice.map((r) => r.casual.attempts)).toFixed(2)} | ${spikes.join(' · ')} |`);
  }
  out.push('');
  out.push('★ = marked hard on the map (first clear pays double).');
  out.push('');
  out.push('## Every level');
  out.push('');
  out.push('pass % and attempts: casual bot · left: median moves left over in a win · stars: share of wins reaching 1 / 2 / 3 stars · shuffles: automatic shuffles per attempt · moves/turn: valid moves the board offers per turn · +5 / +3: share of losses that the paid continue (+5 moves) / the ad continue (+3) turns into a win.');
  out.push('');
  out.push('| lvl | tier | col | moves | goals | band | pass % | attempts | expert % | left | stars % | thresholds | shuffles | moves/turn | +5 | +3 | flags |');
  out.push('|---:|---|---:|---:|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|');
  rows.forEach((r, k) => {
    const level = levels[k]!;
    const c = r.casual;
    const flags = problems[k]!.slice();
    if (r.expert < EXPERT_MIN) flags.push(`expert ${r.expert.toFixed(0)} %`);
    if (r.random !== undefined && r.random < RANDOM_FIRST_MIN) flags.push(`random bot ${r.random.toFixed(1)} %`);
    if (r.novice !== undefined && r.novice < NOVICE_EARLY_MIN) flags.push(`novice bot ${r.novice.toFixed(1)} %`);
    const tier = tierOf(level) + (level.tutorial !== undefined ? `: ${level.tutorial}` : '');
    out.push(
      `| ${level.id} | ${tier} | ${level.colors} | ${level.moves} | ${describeGoals(level)} | ${bandFor(level).label.replace(/^\S+ /, '')} | ${c.winRate.toFixed(1)} | ${c.attempts.toFixed(2)} | ${r.expert.toFixed(1)} | ${c.movesLeftMedian.toFixed(0)} | ${Math.round(c.star1)} / ${Math.round(c.star2)} / ${Math.round(c.star3)} | ${level.stars.join(' / ')} | ${c.shufflesPerGame.toFixed(2)} | ${c.validMoves.toFixed(1)} | ${Math.round(c.rescued)} | ${Math.round(c.rescuedByAd)} | ${flags.join('; ')} |`,
    );
  });
  out.push('');
  out.push('## Against the flat bands of the first brief');
  out.push('');
  out.push('The first brief asked for flat bands per range (1–5 ≥ 97 %, 6–20 80–95 %, 21–40 65–85 %, 41–80 50–75 %, 81–120 40–65 %, hard 22–40 %). The set now follows the sawtooth of docs/STRATEGY.md instead, so breathers sit above those bands on purpose, spikes at their lower edge, levels 6–10 above 95 %, and hard levels in 30–45 %.');
  out.push('');
  out.push('| range | levels | inside the flat band | above (breathers, tutorials, finales, early levels) | below |');
  out.push('|---|---:|---:|---:|---:|');
  const ranges: [string, (l: LevelDef) => boolean][] = [
    ['1–5', (l) => l.id <= 5],
    ['6–20', (l) => l.id >= 6 && l.id <= 20],
    ['21–40', (l) => l.id >= 21 && l.id <= 40 && !l.hard],
    ['41–80', (l) => l.id >= 41 && l.id <= 80 && !l.hard],
    ['81–120', (l) => l.id >= 81 && !l.hard],
    ['hard', (l) => l.hard === true],
  ];
  for (const [name, test] of ranges) {
    const members = levels.filter(test);
    let inside = 0;
    const above: number[] = [];
    const below: number[] = [];
    for (const level of members) {
      const rate = rows[level.id - 1]!.casual.winRate;
      const [lo, hi] = briefBand(level);
      if (rate < lo) below.push(level.id);
      else if (rate > hi) above.push(level.id);
      else inside++;
    }
    out.push(`| ${name} | ${members.length} | ${inside} | ${above.length}${above.length > 0 ? ` (${above.join(', ')})` : ''} | ${below.length}${below.length > 0 ? ` (${below.join(', ')})` : ''} |`);
  }
  out.push('');
  return out.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const levels = args.levels.map(levelById);
  const seed = args.seed ?? (args.report ? 2026 : 1);
  const games = args.games ?? (args.report ? 1000 : 600);
  const jobsFor = (bot: BotKind, n: number, subset: readonly LevelDef[] = levels): SimJob[] => subset.map((level) => ({ level, bot, games: n, seed: seedFor(level.id, seed) }));
  const progress = (label: string, total: number) => (_r: JobResult, done: number) => {
    if (process.stderr.isTTY) process.stderr.write(`\r${label}: ${done}/${total} levels`);
  };
  const run = async (bot: BotKind, n: number, subset: readonly LevelDef[] = levels): Promise<LevelStats[]> => {
    const results = await runJobs(jobsFor(bot, n, subset), args.workers, progress(bot, subset.length));
    if (process.stderr.isTTY) process.stderr.write('\r\x1b[K');
    return results.map((r, k) => summarise(r, subset[k]!));
  };

  const started = Date.now();
  const bot: BotKind = args.report ? 'casual' : args.bot;
  console.log(`${bot} bot · ${games} games per level · ${levels.length} levels · seed ${seed} · ${args.workers} worker(s)`);
  const stats = await run(bot, games);
  const flagged = printTable(levels, bot, stats);
  const meanRate = mean(stats.map((s) => s.winRate));
  const verdict = bot === 'casual' ? `${levels.length - flagged}/${levels.length} levels pass every gate · ` : bot === 'expert' ? `${levels.length - flagged}/${levels.length} levels at ≥ ${EXPERT_MIN} % · ` : '';
  console.log(`\n${verdict}mean pass rate ${meanRate.toFixed(1)} % · ${((Date.now() - started) / 1000).toFixed(1)} s`);
  if (!args.report) return;

  if (levels.length !== LEVELS.length) throw new Error('--report needs the whole level set (drop --levels)');
  const t1 = Date.now();
  console.log(`\nexpert bot · ${args.expertGames} games per level`);
  const expert = await run('expert', args.expertGames);
  const weak = printTable(levels, 'expert', expert);
  console.log(`\n${levels.length - weak}/${levels.length} levels with expert ≥ ${EXPERT_MIN} % · ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  const first = levels.filter((l) => l.id <= 5);
  const early = levels.filter((l) => l.id <= 10);
  const random = await run('random', games, first);
  const novice = await run('novice', games, early);
  console.log(`random bot on levels 1–5: ${random.map((s) => s.winRate.toFixed(1)).join(' ')} · novice bot on levels 1–10: ${novice.map((s) => s.winRate.toFixed(1)).join(' ')}`);

  const file: ReportFile = {
    seed,
    casualGames: games,
    expertGames: args.expertGames,
    levels: levels.map((level, k) => {
      const row: ReportLevel = { id: level.id, hash: levelHash(level), casual: stats[k]!, expert: Math.round(expert[k]!.winRate * 10) / 10 };
      if (level.id <= 5) row.random = Math.round(random[k]!.winRate * 10) / 10;
      if (level.id <= 10) row.novice = Math.round(novice[k]!.winRate * 10) / 10;
      row.casual = { ...row.casual, winRate: Math.round(row.casual.winRate * 10) / 10, attempts: Math.round(row.casual.attempts * 1000) / 1000, movesLeft: Math.round(row.casual.movesLeft * 10) / 10 };
      return row;
    }),
  };
  const dir = fileURLToPath(new URL('.', import.meta.url));
  writeFileSync(`${dir}report.json`, JSON.stringify(file, null, 1) + '\n');
  writeFileSync(`${dir}REPORT.md`, reportMarkdown(file, levels));
  console.log(`wrote ${dir}REPORT.md and ${dir}report.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
