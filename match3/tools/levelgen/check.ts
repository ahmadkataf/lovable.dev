/**
 * Designer's lint for the level set:  node tools/levelgen/check.ts [--show 17]
 * Runs the engine's validateLevel() on every level, looks for duplicate layouts and prints a
 * one-line inventory per level (size, cells, colours, blockers, goals). `--show N` prints the
 * board of one level with its floor layer side by side.
 */
import { validateLevel } from '../../src/engine/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { CHAPTERS, LEVELS, layoutKey } from '../../src/levels/index.ts';
import { describeGoals } from '../sim/stats.ts';

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
  return `${String(level.id).padStart(3)} ${level.hard ? 'H' : ' '} ${level.cols}×${level.rows} ${String(cells).padStart(2)} cells  ${level.colors} col  ${String(level.moves).padStart(2)} mv  ${describeGoals(level).padEnd(34)} ${parts.join(', ')}${level.tutorial ? `  [tut:${level.tutorial}]` : ''}`;
}

function main(): void {
  const argv = process.argv.slice(2);
  const showAt = argv.indexOf('--show');
  if (showAt >= 0) {
    const level = LEVELS[Number(argv[showAt + 1]) - 1];
    if (!level) throw new Error('no such level');
    console.log(inventory(level));
    level.pieces.forEach((row, r) => console.log(`  ${row.split('').join(' ')}     ${(level.floor?.[r] ?? '').split('').join(' ')}`));
    return;
  }

  let problems = 0;
  const seen = new Map<string, number>();
  LEVELS.forEach((level, index) => {
    console.log(inventory(level));
    if (level.id !== index + 1) {
      problems++;
      console.log(`     ✗ expected id ${index + 1}`);
    }
    for (const problem of validateLevel(level)) {
      problems++;
      console.log(`     ✗ ${problem}`);
    }
    const key = layoutKey(level);
    const twin = seen.get(key);
    if (twin !== undefined) {
      problems++;
      console.log(`     ✗ same layout as level ${twin}`);
    } else seen.set(key, level.id);
  });
  console.log(`\n${LEVELS.length} levels, ${CHAPTERS.length} chapters, ${problems} problem(s)`);
  if (problems > 0) process.exit(1);
}

main();
