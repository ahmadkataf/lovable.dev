/**
 * Freeze a start position for a tutorial board.
 *
 *   node tools/levelgen/freeze.ts <level> <c1> <r1> <c2> <r2> [seeds]
 *
 * A level that teaches a special piece is pre-arranged so that one particular swap creates it.
 * Random gems around the arrangement could offer something even better, so this tool searches
 * start positions (by seed) for one where the intended swap is exactly what the engine's hint
 * points at, where no other move creates a special of the same or a higher rank (beam < nova <
 * prism) — preferably no other special at all — and where a few ordinary moves exist as well.
 * It prints that position as fixed-colour rows to paste into the level.
 */
import { Game } from '../../src/engine/index.ts';
import type { PieceKind, Snapshot } from '../../src/engine/index.ts';
import { LEVELS } from '../../src/levels/index.ts';

function createdBy(game: Game, a: { c: number; r: number }, b: { c: number; r: number }): PieceKind[] {
  const trial = game.clone();
  const res = trial.swap(a, b);
  for (const step of res.steps) if (step.type === 'clear') return step.created.map((c) => c.piece.kind);
  return [];
}

function rowsOf(snap: Snapshot): string[] {
  const letters = 'abCdef';
  const rows: string[] = [];
  for (let r = 0; r < snap.rows; r++) {
    let row = '';
    for (let c = 0; c < snap.cols; c++) {
      const cell = snap.cells[r * snap.cols + c]!;
      row += !cell.exists ? '_' : cell.piece && cell.piece.kind === 'gem' && cell.piece.color >= 0 ? letters[cell.piece.color] : '?';
    }
    rows.push(row);
  }
  return rows;
}

function main(): void {
  const [id, c1, r1, c2, r2, maxSeeds] = process.argv.slice(2).map(Number);
  const level = LEVELS[(id ?? 0) - 1];
  if (!level || [c1, r1, c2, r2].some((v) => v === undefined || !Number.isFinite(v))) {
    console.error('usage: node tools/levelgen/freeze.ts <level> <c1> <r1> <c2> <r2> [seeds]');
    process.exit(1);
  }
  const a = { c: c1!, r: r1! };
  const b = { c: c2!, r: r2! };
  const same = (m: { a: typeof a; b: typeof a }): boolean =>
    (m.a.c === a.c && m.a.r === a.r && m.b.c === b.c && m.b.r === b.r) || (m.a.c === b.c && m.a.r === b.r && m.b.c === a.c && m.b.r === a.r);

  const rank = (kind: PieceKind): number => (kind === 'prism' ? 3 : kind === 'nova' ? 2 : 1);
  // Keep the candidate with the fewest lesser specials elsewhere; stop at once on a perfect one.
  let best: { seed: number; lesser: number; moves: number; kind: PieceKind; rows: string[]; hint: string } | null = null;
  for (let seed = 1; seed <= (maxSeeds || 3000); seed++) {
    const game = new Game(level, { seed });
    const hint = game.hint();
    if (hint === null || !same(hint)) continue;
    const moves = game.validMoves();
    if (moves.length < 5) continue;
    const wanted = createdBy(game, hint.a, hint.b);
    if (wanted.length !== 1) continue;
    let rivals = 0;
    let lesser = 0;
    for (const move of moves) {
      if (same(move)) continue;
      for (const kind of createdBy(game, move.a, move.b)) {
        if (rank(kind) >= rank(wanted[0]!)) rivals++;
        else lesser++;
      }
    }
    if (rivals > 0) continue;
    if (best === null || lesser < best.lesser) {
      best = { seed, lesser, moves: moves.length, kind: wanted[0]!, rows: rowsOf(game.snapshot()), hint: `(${hint.a.c},${hint.a.r}) onto (${hint.b.c},${hint.b.r})` };
      if (lesser === 0) break;
    }
  }
  if (best === null) {
    console.log('no suitable start position found');
    return;
  }
  console.log(`level ${level.id}: seed ${best.seed} — the swap creates ${best.kind}, ${best.moves} moves available (${best.lesser} of them make a lesser special), hint drags ${best.hint}`);
  for (const row of best.rows) console.log(`      '${row}',`);
}

main();
