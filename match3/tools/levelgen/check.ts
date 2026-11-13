/**
 * Designer's lint for the level set:
 *
 *   node tools/levelgen/check.ts               one line per level + every problem and warning
 *   node tools/levelgen/check.ts --show 17     the board of one level (pieces and floor side by side)
 *   node tools/levelgen/check.ts --show 41-60  several boards, four abreast
 *   node tools/levelgen/check.ts --mix         the goal mix and the tier map of the set
 *
 * Problems (exit code 1): the engine's validateLevel(), duplicate layouts, and the geometry
 * errors of ./lint.ts. Warnings are craft rules a level may break on purpose.
 */
import { validateLevel } from '../../src/engine/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { CHAPTERS, LEVELS, layoutKey, tierOf } from '../../src/levels/index.ts';
import { describeGoals, parseRange } from '../sim/stats.ts';
import { goalClass, lintSet } from './lint.ts';

function count(rows: readonly string[] | undefined, chars: string): number {
  let total = 0;
  for (const row of rows ?? []) for (const ch of row) if (chars.indexOf(ch) >= 0) total++;
  return total;
}

function inventory(level: LevelDef): string {
  const cells = level.cols * level.rows - count(level.pieces, '_');
  const parts: string[] = [];
  const sand = count(level.floor, '1') + 2 * count(level.floor, '2');
  if (sand > 0) parts.push(`sand ${sand}`);
  const stoneHp = count(level.pieces, '1') + 2 * count(level.pieces, '2') + 3 * count(level.pieces, '3');
  if (stoneHp > 0) parts.push(`stone ${count(level.pieces, '123')}/${stoneHp}hp`);
  for (const [ch, name] of [['c', 'chain'], ['v', 'vine'], ['L', 'lamp']] as const) {
    const k = count(level.pieces, ch);
    if (k > 0) parts.push(`${name} ${k}`);
  }
  if (level.lamps) parts.push(`lamps ${level.lamps.total}`);
  const specials = count(level.pieces, 'HVNP');
  if (specials > 0) parts.push(`specials ${specials}`);
  const tier = tierOf(level);
  return `${String(level.id).padStart(3)} ${tier.padEnd(8)} ${level.cols}×${level.rows} ${String(cells).padStart(2)} cells  ${level.colors} col  ${String(level.moves).padStart(2)} mv  ${describeGoals(level).padEnd(34)} ${parts.join(', ')}${level.tutorial ? `  [tut:${level.tutorial}]` : ''}`;
}

function show(levels: readonly LevelDef[]): void {
  const perRow = 4;
  for (let k = 0; k < levels.length; k += perRow) {
    const blocks = levels.slice(k, k + perRow).map((l) => {
      const lines: string[] = [];
      lines.push(`#${l.id} ${tierOf(l)} · ${l.colors} colours · ${l.moves} moves`);
      lines.push(describeGoals(l) + (l.lamps ? ` [lamps ${l.lamps.total}/${l.lamps.maxOnBoard}/${l.lamps.everyMoves}]` : ''));
      for (let r = 0; r < l.rows; r++) lines.push(`${l.pieces[r]!}  ${l.floor ? l.floor[r]!.replace(/0/g, '·') : ''}`);
      return lines;
    });
    const height = Math.max(...blocks.map((b) => b.length));
    for (let i = 0; i < height; i++) console.log(blocks.map((b) => (b[i] ?? '').padEnd(36)).join(' | '));
    console.log('');
  }
}

function mix(): void {
  const classes: Record<string, number> = {};
  let twoGoal = 0;
  for (const level of LEVELS) {
    const k = goalClass(level);
    classes[k] = (classes[k] ?? 0) + 1;
    if (new Set(level.goals.map((g) => g.kind)).size > 1) twoGoal++;
  }
  console.log('goal mix: ' + Object.keys(classes).map((k) => `${k} ${classes[k]} (${Math.round((100 * classes[k]!) / LEVELS.length)} %)`).join(' · ') + ` · levels with two kinds of goal: ${twoGoal}`);
  for (const chapter of CHAPTERS) {
    const row = LEVELS.slice(chapter.from - 1, chapter.to).map((l) => `${l.id}:${tierOf(l).slice(0, 2)}/${goalClass(l).slice(0, 2)}/${l.colors}`);
    console.log(`${chapter.theme.padEnd(8)} ${row.join(' ')}`);
  }
}

function main(): void {
  const argv = process.argv.slice(2);
  const showAt = argv.indexOf('--show');
  if (showAt >= 0) {
    const ids = parseRange(argv[showAt + 1] ?? '', LEVELS.length);
    if (ids.length === 0) throw new Error('no such level');
    show(ids.map((id) => LEVELS[id - 1]!));
    return;
  }
  if (argv.indexOf('--mix') >= 0) {
    mix();
    return;
  }

  let problems = 0;
  let warnings = 0;
  const lint = lintSet(LEVELS);
  const seen = new Map<string, number>();
  LEVELS.forEach((level, index) => {
    console.log(inventory(level));
    const bad: string[] = [];
    if (level.id !== index + 1) bad.push(`expected id ${index + 1}`);
    for (const problem of validateLevel(level)) bad.push(problem);
    const key = layoutKey(level);
    const twin = seen.get(key);
    if (twin !== undefined) bad.push(`same layout as level ${twin}`);
    else seen.set(key, level.id);
    const own = lint.get(level.id)!;
    for (const problem of bad.concat(own.errors)) {
      problems++;
      console.log(`     ✗ ${problem}`);
    }
    for (const warning of own.warnings) {
      warnings++;
      console.log(`     · ${warning}`);
    }
  });
  console.log(`\n${LEVELS.length} levels, ${CHAPTERS.length} chapters, ${problems} problem(s), ${warnings} warning(s)`);
  if (problems > 0) process.exit(1);
}

main();
