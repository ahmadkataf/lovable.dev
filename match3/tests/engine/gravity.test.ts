import { describe, expect, it } from 'vitest';
import type { Snapshot, Step } from '../../src/engine/index.ts';
import { P, board, cellOf, checkTurn, pieceOf, stepsOf, unfilledReachable } from './helpers.ts';

// DESIGN §2.6 — gravity, diagonal feeding around blockers and holes, refill.

type Fall = Extract<Step, { type: 'fall' }>;
const C3 = { colors: 3 };
const empties = (s: Snapshot): string[] => {
  const out: string[] = [];
  s.cells.forEach((cell, i) => {
    if (cell.exists && cell.piece === null) out.push(`${i % s.cols},${Math.floor(i / s.cols)}`);
  });
  return out;
};
const firstFall = (steps: Step[]): Fall => stepsOf(steps, 'fall')[0]!;

describe('gravity and refill', () => {
  it('new pieces stack above the spawner: the first to enter starts lowest and lands lowest', () => {
    const g = board(['~ f ~', '~ f ~', 'f ~ ~', '~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.swap(P(0, 2), P(1, 2));
    const fall = firstFall(res.steps);
    expect(fall.moves).toEqual([]);
    expect(fall.spawns.map((s) => [s.from, s.to])).toEqual([
      [P(1, -1), P(1, 2)],
      [P(1, -2), P(1, 1)],
      [P(1, -3), P(1, 0)],
    ]);
    const ids = new Set(fall.spawns.map((s) => s.piece.id));
    expect(ids.size).toBe(3);
    for (const cell of before.cells) expect(cell.piece === null || !ids.has(cell.piece.id)).toBe(true);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('pieces above a cleared cell fall straight down and every moved piece is listed once with its final cell', () => {
    const g = board(['~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ ~', 'f f ~ ~', '~ ~ f ~'], C3);
    const before = g.snapshot();
    const res = g.swap(P(2, 4), P(2, 3));
    const fall = firstFall(res.steps);
    // three columns, three pieces each drop by one
    expect(fall.moves).toHaveLength(9);
    expect(new Set(fall.moves.map((m) => m.id)).size).toBe(9);
    for (const m of fall.moves) {
      expect(m.to).toEqual({ c: m.from.c, r: m.from.r + 1 });
      expect(pieceOf(before, m.from.c, m.from.r)?.id).toBe(m.id);
    }
    expect(fall.spawns.map((s) => [s.from, s.to])).toEqual([
      [P(0, -1), P(0, 0)],
      [P(1, -1), P(1, 0)],
      [P(2, -1), P(2, 0)],
    ]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a stone blocks its column: the cells under it are fed diagonally from the neighbours', () => {
    const g = board(['~ ~ ~', '~ 3 ~', '~ f ~', '~ f ~', 'f ~ ~'], C3);
    const before = g.snapshot();
    const onStone = pieceOf(before, 1, 0)!;
    const stone = pieceOf(before, 1, 1)!;
    const res = g.swap(P(0, 4), P(1, 4));
    const fall = firstFall(res.steps);
    // nothing in column 1 can come from above: every piece that lands there crossed over
    const intoColumn1 = [...fall.moves.filter((m) => m.to.c === 1), ...fall.spawns.filter((s) => s.to.c === 1)];
    expect(intoColumn1).toHaveLength(3);
    expect(intoColumn1.map((m) => m.to.r).sort()).toEqual([2, 3, 4]);
    for (const m of intoColumn1) expect(m.from.c).not.toBe(1);
    // the stone and the gem resting on it did not move; nothing spawned in column 1
    expect(fall.moves.some((m) => m.id === stone.id || m.id === onStone.id)).toBe(false);
    expect(fall.spawns.every((s) => s.from.c !== 1)).toBe(true);
    expect(fall.spawns).toHaveLength(3);
    expect(pieceOf(res.snapshot, 1, 0)?.id).toBe(onStone.id);
    expect(pieceOf(res.snapshot, 1, 1)?.id).toBe(stone.id);
    expect(empties(res.snapshot)).toEqual([]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a chained piece does not fall and blocks like a stone until its chain breaks', () => {
    const g = board(['~ ~ ~', '~ e* ~', '~ f ~', '~ f ~', 'f ~ ~'], C3);
    const before = g.snapshot();
    const chained = pieceOf(before, 1, 1)!;
    const res = g.swap(P(0, 4), P(1, 4));
    const fall = firstFall(res.steps);
    expect(fall.moves.some((m) => m.id === chained.id)).toBe(false);
    for (const m of [...fall.moves.filter((x) => x.to.c === 1), ...fall.spawns.filter((x) => x.to.c === 1)]) expect(m.from.c).not.toBe(1);
    expect(pieceOf(res.snapshot, 1, 1)).toEqual(chained); // same place, still chained
    expect(empties(res.snapshot)).toEqual([]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('an unchained piece falls again', () => {
    const g = board(['~ ~ ~', '3 e* 3', '3 0 3', '3 ~ 3'], { ...C3, keep: true });
    const before = g.snapshot();
    const chained = pieceOf(before, 1, 1)!;
    // the cell under the chained gem is empty and cannot be fed (stones on both diagonals)
    expect(empties(before)).toEqual(['1,2']);
    const res = g.useBooster('hammer', P(1, 1));
    const fall = firstFall(res.steps);
    expect(fall.moves.find((m) => m.id === chained.id)).toEqual({ id: chained.id, from: P(1, 1), to: P(1, 2) });
    expect(pieceOf(res.snapshot, 1, 2)).toEqual({ ...chained, chained: false });
    expect(empties(res.snapshot)).toEqual([]);
  });

  it('cells that nothing can reach stay empty, and that is fine', () => {
    const g = board(['~ ~ ~ ~ ~', '3 3 3 3 3', '~ ~ ~ ~ ~', '~ f f ~ ~', '~ ~ ~ f ~'], C3);
    const before = g.snapshot();
    const res = g.swap(P(3, 4), P(3, 3));
    const fall = firstFall(res.steps);
    expect(fall.spawns).toEqual([]);
    expect(fall.moves.map((m) => [m.from, m.to])).toEqual([
      [P(3, 2), P(3, 3)],
      [P(2, 2), P(2, 3)],
      [P(1, 2), P(1, 3)],
    ]);
    // sealed off by the wall: no spawner above, stones on both upper diagonals
    expect(empties(res.snapshot)).toEqual(['1,2', '2,2', '3,2']);
    expect(unfilledReachable(res.snapshot)).toEqual([]);
    expect(res.snapshot.status).toBe('playing');
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a column whose top is a hole spawns into its first existing cell', () => {
    const g = board(['~ _ ~ ~', '~ ~ ~ ~', '~ f f ~', 'f ~ ~ ~'], C3);
    const before = g.snapshot();
    expect(cellOf(before, 1, 0).exists).toBe(false);
    expect(cellOf(before, 1, 0).spawner).toBe(false);
    expect(cellOf(before, 1, 1).spawner).toBe(true);
    expect(cellOf(before, 0, 0).spawner).toBe(true);
    expect(cellOf(before, 0, 1).spawner).toBe(false);
    expect(before.cells.filter((c) => c.spawner)).toHaveLength(4);
    expect(before.cells.filter((c) => c.exit)).toHaveLength(4);
    expect(cellOf(before, 1, 3).exit).toBe(true);
    const res = g.swap(P(0, 3), P(0, 2));
    const fall = firstFall(res.steps);
    const spawn = fall.spawns.find((s) => s.from.c === 1)!;
    // one cell above the spawner cell (1,1) — `from.r` counts from the spawner, not from row 0
    expect(spawn.from).toEqual(P(1, -1));
    expect(spawn.to).toEqual(P(1, 1));
    expect(fall.moves.find((m) => m.from.c === 1)).toMatchObject({ from: P(1, 1), to: P(1, 2) });
    expect(empties(res.snapshot)).toEqual([]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('cells under a hole in the middle of a column are fed diagonally around it', () => {
    const g = board(['~ ~ ~ ~', '~ _ ~ ~', '~ f ~ ~', '~ f ~ ~', 'f ~ ~ ~'], C3);
    const before = g.snapshot();
    const above = pieceOf(before, 1, 0)!;
    const res = g.swap(P(0, 4), P(1, 4));
    const fall = firstFall(res.steps);
    const intoColumn1 = [...fall.moves.filter((m) => m.to.c === 1), ...fall.spawns.filter((s) => s.to.c === 1)];
    expect(intoColumn1.map((m) => m.to.r).sort()).toEqual([2, 3, 4]);
    for (const m of intoColumn1) expect(m.from.c).not.toBe(1);
    // the gem sitting above the hole cannot pass through it
    expect(pieceOf(res.snapshot, 1, 0)?.id).toBe(above.id);
    expect(empties(res.snapshot)).toEqual([]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('with one diagonal blocked the cell is fed from the other side', () => {
    const g = board(['3 ~ ~', '3 3 ~', '3 f ~', '3 f ~', 'f ~ ~'], C3);
    const before = g.snapshot();
    const res = g.swap(P(0, 4), P(1, 4));
    const fall = firstFall(res.steps);
    const intoColumn1 = [...fall.moves.filter((m) => m.to.c === 1), ...fall.spawns.filter((s) => s.to.c === 1)];
    expect(intoColumn1).toHaveLength(3);
    for (const m of intoColumn1) expect(m.from.c).toBe(2);
    expect(empties(res.snapshot)).toEqual([]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('straight falls win over diagonal slides', () => {
    // column 1 is open from the top: everything that lands in it comes from column 1
    const g = board(['~ ~ ~', '~ ~ ~', '~ f ~', '~ f ~', 'f ~ ~'], C3);
    const res = g.swap(P(0, 4), P(1, 4));
    const fall = firstFall(res.steps);
    for (const m of [...fall.moves, ...fall.spawns]) expect(m.from.c).toBe(m.to.c);
  });

  it('the cascade number grows by one after every fall step', () => {
    const g = board(['~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~'], { colors: 3, keep: false, seed: 11 });
    let checked = 0;
    for (let turn = 0; turn < 25; turn++) {
      const move = g.validMoves()[0]!;
      const res = g.swap(move.a, move.b);
      let falls = 0;
      for (const step of res.steps) {
        if (step.type === 'fall') falls++;
        if (step.type === 'clear') {
          expect(step.cascade).toBe(falls + 1);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});
