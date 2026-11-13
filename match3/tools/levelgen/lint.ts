/**
 * Designer's lint: the things a level designer checks by eye, as code. Used by
 * `node tools/levelgen/check.ts` and by tests/levels.
 *
 * `errors` are layouts that are broken by geometry (the engine would still run them):
 *   - sand or a chained gem on a cell that can never be part of a match
 *   - a lamp column whose exit cell can never be part of a horizontal match
 *   - vines on or right under the spawners (they can seal the board for good)
 *   - a board region that is too small to ever hold a match
 * `warnings` are craft rules from docs/STRATEGY.md (levels-01, levels-06) that a level may break
 * on purpose — the test suite keeps a short, explicit list of the accepted ones.
 */
import { parseLevel } from '../../src/engine/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { movesWindow } from '../sim/stats.ts';

export interface Lint {
  errors: string[];
  warnings: string[];
}

export interface Geometry {
  cols: number;
  rows: number;
  /** existing cells */
  cells: number;
  /** For every cell: in how many horizontal / vertical lines of three existing cells it lies (0–3 each). */
  hTriples: Uint8Array;
  vTriples: Uint8Array;
}

function countChars(rows: readonly string[] | undefined, chars: string): number {
  let total = 0;
  for (const row of rows ?? []) for (const ch of row) if (chars.indexOf(ch) >= 0) total++;
  return total;
}

export function geometryOf(level: LevelDef): Geometry {
  const { cols, rows } = level;
  const exists = (c: number, r: number): boolean => c >= 0 && c < cols && r >= 0 && r < rows && level.pieces[r]!.charAt(c) !== '_';
  const hTriples = new Uint8Array(cols * rows);
  const vTriples = new Uint8Array(cols * rows);
  let cells = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!exists(c, r)) continue;
      cells++;
      for (let start = c - 2; start <= c; start++) if (exists(start, r) && exists(start + 1, r) && exists(start + 2, r)) hTriples[r * cols + c]!++;
      for (let start = r - 2; start <= r; start++) if (exists(c, start) && exists(c, start + 1) && exists(c, start + 2)) vTriples[r * cols + c]!++;
    }
  }
  return { cols, rows, cells, hTriples, vTriples };
}

/** The board's shape only: size and holes. */
export function maskOf(level: LevelDef): string {
  return `${level.cols}x${level.rows}|${level.pieces.map((row) => row.replace(/[^_]/g, '.')).join('/')}`;
}

/** Blocker / item kinds on the board: sand, stone, chain, vine, lamp. */
export function elementsOf(level: LevelDef): string[] {
  const out: string[] = [];
  if (countChars(level.floor, '12') > 0) out.push('sand');
  if (countChars(level.pieces, '123') > 0) out.push('stone');
  if (countChars(level.pieces, 'c') > 0) out.push('chain');
  if (countChars(level.pieces, 'v') > 0) out.push('vine');
  if (countChars(level.pieces, 'L') > 0 || level.lamps !== undefined) out.push('lamp');
  return out;
}

/**
 * The kind of level for the goal mix: 'lamp' / 'sand' when that is among the goals (in this
 * order), 'blocker' for stone / vine / chain goals, 'color' for colour-only, 'score' for score-only.
 */
export function goalClass(level: LevelDef): 'score' | 'color' | 'sand' | 'lamp' | 'blocker' {
  const kinds = level.goals.map((g) => g.kind);
  if (kinds.indexOf('lamp') >= 0) return 'lamp';
  if (kinds.indexOf('sand') >= 0) return 'sand';
  if (kinds.some((k) => k === 'stone' || k === 'vine' || k === 'chain')) return 'blocker';
  if (kinds.indexOf('color') >= 0) return 'color';
  return 'score';
}

/** Share (0..1) of the bounding box that is not a free cell at the start: holes, stones, vines, chains. */
export function clutterOf(level: LevelDef): number {
  return countChars(level.pieces, '_123vc') / (level.cols * level.rows);
}

/** Six colours only on open boards (docs/STRATEGY.md): at least 56 free cells and little clutter. */
export function isOpenBoard(level: LevelDef): boolean {
  const free = level.cols * level.rows - countChars(level.pieces, '_123vc');
  return free >= 56 && clutterOf(level) <= 0.16;
}

export function lintLevel(level: LevelDef): Lint {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { cols, rows } = level;
  const geo = geometryOf(level);
  const parsed = parseLevel(level);
  const at = (c: number, r: number): string => level.pieces[r]!.charAt(c);
  const where = (c: number, r: number): string => `column ${c}, row ${r}`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = at(c, r);
      if (ch === '_') continue;
      const i = r * cols + c;
      const lines = geo.hTriples[i]! + geo.vTriples[i]!;
      const sand = level.floor ? Number(level.floor[r]!.charAt(c)) : 0;
      if (lines === 0) {
        if (sand > 0) errors.push(`sand at ${where(c, r)} can never be part of a match`);
        else if (ch === 'c') errors.push(`the chained gem at ${where(c, r)} can never be part of a match`);
        else warnings.push(`cell ${where(c, r)} can never be part of a match`);
      } else if (lines === 1 && sand === 2) {
        warnings.push(`deep sand in a corner (${where(c, r)}): only one line of three reaches it`);
      }
      if (ch === 'v') {
        // rows 0 and 1 of the column's existing cells: the spawner and the cell it feeds
        let above = 0;
        for (let y = 0; y < r; y++) if (at(c, y) !== '_') above++;
        if (above < 2) errors.push(`vine at ${where(c, r)} sits on or right under the spawner`);
      }
    }
  }

  // Lamps: every column a lamp can travel must end on a cell that a horizontal match can clear.
  const hasLampGoal = level.goals.some((g) => g.kind === 'lamp');
  if (hasLampGoal || countChars(level.pieces, 'L') > 0) {
    const lampCols = new Set<number>();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === 'L') lampCols.add(c);
    if (level.lamps !== undefined && level.lamps.total > countChars(level.pieces, 'L')) {
      // drop-in columns: no gap between spawner and exit
      for (let c = 0; c < cols; c++) {
        let first = -1;
        let last = -1;
        let count = 0;
        for (let r = 0; r < rows; r++) {
          if (at(c, r) === '_') continue;
          if (first < 0) first = r;
          last = r;
          count++;
        }
        if (count > 0 && count === last - first + 1) lampCols.add(c);
      }
    }
    for (const c of lampCols) {
      let exit = -1;
      for (let r = rows - 1; r >= 0; r--) {
        if (parsed.exit[r * cols + c]) {
          exit = r;
          break;
        }
      }
      if (exit < 0) continue;
      const h = geo.hTriples[exit * cols + c]!;
      if (h === 0) errors.push(`lamp column ${c}: its exit cell (row ${exit}) can never be part of a horizontal match`);
      else if (h === 1) warnings.push(`lamp column ${c}: its exit cell (row ${exit}) is a corner — only one horizontal line reaches it`);
    }
  }

  const elements = elementsOf(level);
  if (elements.length > 4) warnings.push(`${elements.length} element types on one board (${elements.join(', ')})`);
  if (level.colors === 6 && !isOpenBoard(level)) warnings.push('six colours on a board that is not open');
  const [lo, hi] = movesWindow(level);
  if (level.moves < lo || level.moves > hi) warnings.push(`${level.moves} moves (window ${lo}–${hi})`);
  if (geo.cells < 30) warnings.push(`only ${geo.cells} cells`);
  return { errors, warnings };
}

/** Lint of the set as a whole: per-level lint plus the rules about neighbours. Keyed by level id. */
export function lintSet(levels: readonly LevelDef[]): Map<number, Lint> {
  const out = new Map<number, Lint>();
  levels.forEach((level, index) => {
    const lint = lintLevel(level);
    const previous = levels[index - 1];
    if (previous !== undefined && maskOf(previous) === maskOf(level)) lint.warnings.push(`same board shape as level ${previous.id}`);
    if (index >= 3) {
      const run = [levels[index - 3]!, levels[index - 2]!, levels[index - 1]!, level].map(goalClass);
      if (run.every((k) => k === run[0])) lint.warnings.push(`fourth '${run[0]}' level in a row`);
    }
    out.set(level.id, lint);
  });
  return out;
}
