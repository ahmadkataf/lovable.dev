/**
 * Freeze the start position of a tutorial board.
 *
 *   node tools/levelgen/freeze.ts <level> [--seeds N] [--want beam|nova|prism|…]
 *
 * A level that introduces a mechanic shows a pointing hand on the engine's hinted move, so that
 * move must demonstrate the lesson on every start — the board cannot be left to chance. This
 * tool searches start positions for one where the hinted move does what the level teaches
 * (`teaches()` below, shared with the tests) and prints it as fixed-colour rows to paste into
 * the level. Blockers, lamps and specials stay where the level puts them; only gems are frozen.
 *
 * Chained gems cannot be frozen (their colour is always random), so the chain tutorial is built
 * differently: the tool looks for a colouring of the free gems in which NO move exists that does
 * not involve a chained gem. Whatever colours the chains get, every possible first move — and so
 * the hint — breaks a chain.
 */
import { fileURLToPath } from 'node:url';
import { Game, createRng } from '../../src/engine/index.ts';
import type { LevelDef, Move, PieceKind, Snapshot, Step } from '../../src/engine/index.ts';
import { LEVELS } from '../../src/levels/index.ts';

const LETTERS = 'abCdef';

// ───────────────────────────── what a move demonstrates ─────────────────────────────

export interface Demo {
  /** Special created by the first wave, if any. */
  created: 'beam' | 'nova' | 'prism' | null;
  /** Gems removed by the first wave, per colour. */
  cleared: number[];
  sandLayers: number;
  /** Sand layers removed from cells that were two deep. */
  deepSandLayers: number;
  stoneHits: number;
  chainsBroken: number;
  vinesCut: number;
  /** Lamps that sank at least one row, or left the board. */
  lampsLowered: number;
  combo: boolean;
}

/** Play `move` on a copy of the game and report what it shows the player. */
export function demoOf(game: Game, move: Move): Demo {
  const demo: Demo = { created: null, cleared: [0, 0, 0, 0, 0, 0], sandLayers: 0, deepSandLayers: 0, stoneHits: 0, chainsBroken: 0, vinesCut: 0, lampsLowered: 0, combo: false };
  const before = game.snapshot();
  const lampIds = new Set<number>();
  for (const cell of before.cells) if (cell.piece !== null && cell.piece.kind === 'lamp') lampIds.add(cell.piece.id);
  const a = before.cells[move.a.r * before.cols + move.a.c]!.piece;
  const b = before.cells[move.b.r * before.cols + move.b.c]!.piece;
  const special = (kind: PieceKind | undefined): boolean => kind === 'beamH' || kind === 'beamV' || kind === 'nova' || kind === 'prism';
  demo.combo = special(a?.kind) && special(b?.kind);
  const steps: Step[] = game.clone().swap(move.a, move.b).steps;
  let firstClear = true;
  const lowered = new Set<number>();
  for (const step of steps) {
    if (step.type === 'clear') {
      if (firstClear) {
        const made = step.created[0]?.piece.kind;
        demo.created = made === 'beamH' || made === 'beamV' ? 'beam' : made === 'nova' || made === 'prism' ? made : null;
      }
      for (const hit of step.hits) {
        if (hit.kind === 'stone' && (hit.result === 'damaged' || hit.result === 'removed')) demo.stoneHits++;
        if (hit.kind === 'vine' && hit.result === 'removed') demo.vinesCut++;
        if (hit.result === 'unchained') demo.chainsBroken++;
        if (hit.sandLeft !== undefined) {
          demo.sandLayers++;
          if (hit.sandLeft === 1) demo.deepSandLayers++;
        }
        if (firstClear && hit.result === 'removed' && hit.kind === 'gem' && hit.color >= 0) demo.cleared[hit.color]!++;
      }
      firstClear = false;
    } else if (step.type === 'fall') {
      for (const m of step.moves) if (lampIds.has(m.id) && m.to.r > m.from.r) lowered.add(m.id);
    } else if (step.type === 'collect') {
      for (const lamp of step.lamps) lowered.add(lamp.id);
    }
  }
  demo.lampsLowered = lowered.size;
  return demo;
}

/**
 * Does `demo` show what the tutorial `id` teaches? '' = yes, otherwise what is missing.
 * (The level is needed for the colour to collect.)
 */
export function teaches(id: string, level: LevelDef, demo: Demo): string {
  switch (id) {
    case 'match':
      return demo.created === null ? '' : 'the first move should be a plain match of three';
    case 'collect': {
      const goal = level.goals.find((g) => g.kind === 'color');
      if (goal === undefined || goal.kind !== 'color') return 'the level has no colour goal';
      if (demo.created !== null) return 'the first move should be a plain match';
      return demo.cleared[goal.color]! >= 3 ? '' : 'the hinted move does not collect the goal colour';
    }
    case 'beam':
    case 'nova':
    case 'prism':
      return demo.created === id ? '' : `the hinted move does not make a ${id}`;
    case 'sand':
      return demo.sandLayers >= 3 && demo.created === null ? '' : 'the hinted move does not sweep three tiles of sand';
    case 'sand2':
      return demo.deepSandLayers >= 2 ? '' : 'the hinted move does not sweep deep sand';
    case 'stone':
      return demo.stoneHits >= 1 ? '' : 'the hinted move does not crack a stone';
    case 'combo':
      return demo.combo ? '' : 'the hinted move is not a swap of two specials';
    case 'lamp':
      return demo.lampsLowered >= 1 ? '' : 'the hinted move does not lower a lamp';
    case 'chain':
      return demo.chainsBroken >= 1 ? '' : 'the hinted move does not break a chain';
    case 'vine':
      return demo.vinesCut >= 1 ? '' : 'the hinted move does not cut a vine';
    default:
      return `unknown tutorial '${id}'`;
  }
}

/**
 * Check a tutorial level on one seed: the hinted first move must teach the lesson, and on the
 * chain level every possible first move must. '' = fine.
 */
export function checkTutorialStart(level: LevelDef, seed: number): string {
  const id = level.tutorial;
  if (id === undefined) return 'not a tutorial level';
  const game = new Game(level, { seed });
  const hint = game.hint();
  if (hint === null) return 'no hint';
  const problem = teaches(id, level, demoOf(game, hint));
  if (problem !== '') return problem;
  if (id === 'chain') {
    for (const move of game.validMoves()) if (demoOf(game, move).chainsBroken < 1) return `the move (${move.a.c},${move.a.r})–(${move.b.c},${move.b.r}) breaks no chain`;
  }
  return '';
}

// ───────────────────────────── the search ─────────────────────────────

function isGemLetter(ch: string): boolean {
  return ch === '.' || (ch !== 'c' && LETTERS.toLowerCase().indexOf(ch.toLowerCase()) >= 0);
}

/** The level with every gem (fixed or not) turned back into a random one. */
function thawed(level: LevelDef): LevelDef {
  return { ...level, pieces: level.pieces.map((row) => row.split('').map((ch) => (isGemLetter(ch) ? '.' : ch)).join('')) };
}

/** The start position of `game` as level rows: gems become fixed letters, everything else is kept. */
function rowsOf(level: LevelDef, snap: Snapshot): string[] {
  const rows: string[] = [];
  for (let r = 0; r < snap.rows; r++) {
    let row = '';
    for (let c = 0; c < snap.cols; c++) {
      const original = level.pieces[r]!.charAt(c);
      const piece = snap.cells[r * snap.cols + c]!.piece;
      row += isGemLetter(original) && piece !== null && piece.kind === 'gem' && !piece.chained && piece.color >= 0 ? LETTERS[piece.color]! : original;
    }
    rows.push(row);
  }
  return rows;
}

function createdBy(game: Game, move: Move): Demo['created'] {
  return demoOf(game, move).created;
}

function sameMove(x: Move, y: Move): boolean {
  return (x.a.c === y.a.c && x.a.r === y.a.r && x.b.c === y.b.c && x.b.r === y.b.r) || (x.a.c === y.b.c && x.a.r === y.b.r && x.b.c === y.a.c && x.b.r === y.a.r);
}

const RANK: Record<string, number> = { beam: 1, nova: 2, prism: 3 };

/** Seed search: freeze the first start position whose hinted move teaches `id`. */
function freezeBySeed(level: LevelDef, id: string, maxSeeds: number): void {
  const open = thawed(level);
  let best: { seed: number; rows: string[]; rivals: number; moves: number } | null = null;
  for (let seed = 1; seed <= maxSeeds; seed++) {
    const game = new Game(open, { seed });
    const hint = game.hint();
    if (hint === null) continue;
    const demo = demoOf(game, hint);
    if (teaches(id, level, demo) !== '') continue;
    const moves = game.validMoves();
    if (moves.length < 5) continue;
    // Lessons about a special: no other move may make one of the same or a higher rank; fewer
    // lesser specials elsewhere is better. Every other lesson: no special anywhere on the board.
    let rivals = 0;
    let fatal = false;
    for (const move of moves) {
      if (sameMove(move, hint)) continue;
      const made = createdBy(game, move);
      if (made === null) continue;
      if (demo.created === null || RANK[made]! >= RANK[demo.created]!) fatal = true;
      else rivals++;
    }
    if (fatal) continue;
    const rows = rowsOf(level, game.snapshot());
    // The frozen board must behave the same on every seed.
    const frozen: LevelDef = { ...level, pieces: rows };
    let stable = true;
    for (let check = 1; check <= 12 && stable; check++) stable = checkTutorialStart(frozen, check * 7919) === '';
    if (!stable) continue;
    if (best === null || rivals < best.rivals) {
      best = { seed, rows, rivals, moves: moves.length };
      if (rivals === 0) break;
    }
  }
  if (best === null) {
    console.log('no suitable start position found');
    return;
  }
  console.log(`level ${level.id} (${id}): seed ${best.seed}, ${best.moves} moves available, ${best.rivals} of them make a lesser special`);
  for (const row of best.rows) console.log(`      '${row}',`);
}

/**
 * Chain tutorial: colour the free gems so that no move exists among them alone. Starts from a
 * diagonal stripe pattern (which has no moves) and wanders through neighbouring colourings that
 * keep that property, then keeps the candidate that offers the most first moves on average.
 */
function freezeMoveFree(level: LevelDef, tries: number): void {
  const { cols, rows, colors } = level;
  const free: boolean[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free.push(isGemLetter(level.pieces[r]!.charAt(c)));
  const at = (grid: Int8Array, c: number, r: number): number => (c < 0 || c >= cols || r < 0 || r >= rows ? -1 : grid[r * cols + c]!);
  /** Is there a run of three (free gems only) through (c, r)? */
  const runAt = (grid: Int8Array, c: number, r: number): boolean => {
    const k = at(grid, c, r);
    if (k < 0) return false;
    let h = 1;
    for (let x = c - 1; at(grid, x, r) === k; x--) h++;
    for (let x = c + 1; at(grid, x, r) === k; x++) h++;
    let v = 1;
    for (let y = r - 1; at(grid, c, y) === k; y--) v++;
    for (let y = r + 1; at(grid, c, y) === k; y++) v++;
    return h >= 3 || v >= 3;
  };
  const clean = (grid: Int8Array): boolean => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (runAt(grid, c, r)) return false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const [dc, dr] of [[1, 0], [0, 1]] as const) {
          const i = r * cols + c;
          const j = (r + dr) * cols + c + dc;
          if (c + dc >= cols || r + dr >= rows || grid[i]! < 0 || grid[j]! < 0) continue;
          const t = grid[i]!;
          grid[i] = grid[j]!;
          grid[j] = t;
          const move = runAt(grid, c, r) || runAt(grid, c + dc, r + dr);
          grid[j] = grid[i]!;
          grid[i] = t;
          if (move) return false;
        }
      }
    }
    return true;
  };

  const rng = createRng(level.id * 977);
  let best: { rows: string[]; moves: number } | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const grid = new Int8Array(cols * rows).fill(-1);
    const shift = rng.int(colors);
    const lean = rng.int(2) === 0 ? 1 : colors - 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (free[r * cols + c]) grid[r * cols + c] = (c + lean * r + shift) % colors;
    if (!clean(grid)) continue;
    for (let step = 0; step < 600; step++) {
      const i = rng.int(cols * rows);
      if (grid[i]! < 0) continue;
      const old = grid[i]!;
      grid[i] = rng.int(colors);
      if (!clean(grid)) grid[i] = old;
    }
    const frozen: LevelDef = {
      ...level,
      pieces: level.pieces.map((row, r) => row.split('').map((ch, c) => (grid[r * cols + c]! >= 0 ? LETTERS[grid[r * cols + c]!]! : ch)).join('')),
    };
    let ok = true;
    let moves = 0;
    const seeds = 60;
    for (let seed = 1; seed <= seeds && ok; seed++) {
      ok = checkTutorialStart(frozen, seed * 104729) === '';
      if (ok) moves += new Game(frozen, { seed: seed * 104729 }).validMoves().length;
    }
    if (!ok) continue;
    if (best === null || moves > best.moves) best = { rows: frozen.pieces, moves };
  }
  if (best === null) {
    console.log('no suitable colouring found');
    return;
  }
  console.log(`level ${level.id} (chain): every first move breaks a chain; ${(best.moves / 60).toFixed(1)} first moves on average`);
  for (const row of best.rows) console.log(`      '${row}',`);
}

function main(): void {
  const argv = process.argv.slice(2);
  const level = LEVELS[Number(argv[0]) - 1];
  if (!level) {
    console.error('usage: node tools/levelgen/freeze.ts <level> [--seeds N] [--want <tutorial id>]');
    process.exit(1);
  }
  const option = (name: string): string | undefined => {
    const k = argv.indexOf(name);
    return k >= 0 ? argv[k + 1] : undefined;
  };
  const id = option('--want') ?? level.tutorial;
  if (id === undefined) {
    console.error(`level ${level.id} has no tutorial id — pass --want`);
    process.exit(1);
  }
  const seeds = Number(option('--seeds') ?? 4000);
  if (id === 'chain') freezeMoveFree(level, Math.max(20, Math.floor(seeds / 20)));
  else freezeBySeed(level, id, seeds);
}

// Only when run as a script (the tests import `checkTutorialStart`).
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
