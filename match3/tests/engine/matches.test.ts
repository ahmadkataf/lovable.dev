import { describe, expect, it } from 'vitest';
import type { Hit, Step } from '../../src/engine/index.ts';
import { P, board, checkTurn, pieceOf, refHasMatch, stepTypes, stepsOf } from './helpers.ts';

// DESIGN §2.3 — matches, groups and the specials they make.
// Boards use the filler token '~' and build their shapes from d / e / f (see helpers.ts), with
// `colors: 3`, so the first wave is exactly what is written here.

type Clear = Extract<Step, { type: 'clear' }>;
const cellsOf = (hits: Hit[]): string[] => hits.map((h) => `${h.at.c},${h.at.r}`).sort();
const C3 = { colors: 3 };

describe('matches', () => {
  it('exactly 3: three gems removed, no special, 60 points, one popup, refill from above', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~',
        '~ f f ~ ~',
        '~ ~ ~ f ~',
        '~ ~ ~ ~ ~',
      ],
      C3,
    );
    expect(refHasMatch(g.snapshot())).toBe(false);
    const before = g.snapshot();
    const moved = [pieceOf(before, 1, 0)?.id, pieceOf(before, 2, 0)?.id, pieceOf(before, 3, 0)?.id];
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.accepted).toBe(true);
    const clear = res.steps[1] as Clear;
    expect(clear.type).toBe('clear');
    expect(clear.cascade).toBe(1);
    expect(cellsOf(clear.hits)).toEqual(['1,1', '2,1', '3,1']);
    for (const h of clear.hits) {
      expect(h).toMatchObject({ cause: 'match', result: 'removed', kind: 'gem', color: 5 });
      expect(h.sandLeft).toBeUndefined();
    }
    expect(clear.created).toEqual([]);
    expect(clear.score).toBe(60);
    expect(clear.popups).toEqual([{ at: P(2, 1), value: 60 }]);

    const fall = res.steps[2] as Extract<Step, { type: 'fall' }>;
    expect(fall.type).toBe('fall');
    expect(fall.moves.map((m) => m.id).sort()).toEqual([...moved].sort());
    for (const m of fall.moves) {
      expect(m.from.r).toBe(0);
      expect(m.to).toEqual({ c: m.from.c, r: 1 });
    }
    expect(fall.spawns.map((s) => [s.from, s.to])).toEqual([
      [P(1, -1), P(1, 0)],
      [P(2, -1), P(2, 0)],
      [P(3, -1), P(3, 0)],
    ]);
    for (const s of fall.spawns) {
      expect(s.piece.kind).toBe('gem');
      expect(s.piece.color).toBeLessThan(3);
    }
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('exactly 4, vertical swap: a beamV of the group colour appears on the swapped cell', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~',
        '~ f f ~ f ~',
        '~ ~ ~ f ~ ~',
        '~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const before = g.snapshot();
    const res = g.swap(P(3, 2), P(3, 1));
    const clear = res.steps[1] as Clear;
    expect(cellsOf(clear.hits)).toEqual(['1,1', '2,1', '3,1', '4,1']);
    expect(clear.created).toHaveLength(1);
    const made = clear.created[0]!;
    expect(made.at).toEqual(P(3, 1));
    expect(made.piece).toMatchObject({ kind: 'beamV', color: 5, hp: 1, chained: false });
    expect(made.from.map((p) => `${p.c},${p.r}`).sort()).toEqual(['1,1', '2,1', '3,1', '4,1']);
    expect(clear.score).toBe(4 * 20 + 60);
    expect(clear.popups).toEqual([{ at: P(3, 1), value: 140 }]);
    // a brand-new id, not one of the matched gems
    expect(before.cells.some((c) => c.piece?.id === made.piece.id)).toBe(false);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('exactly 4, horizontal swap: the beam points along the swap (beamH)', () => {
    const g = board(
      [
        '~ ~ f ~',
        '~ ~ f ~',
        '~ f ~ ~',
        '~ ~ f ~',
        '~ ~ ~ ~',
      ],
      C3,
    );
    const res = g.swap(P(1, 2), P(2, 2));
    const clear = res.steps[1] as Clear;
    expect(cellsOf(clear.hits)).toEqual(['2,0', '2,1', '2,2', '2,3']);
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([[P(2, 2), 'beamH', 5]]);
  });

  it('the special goes to the swapped cell whichever way the player drags', () => {
    const rows = ['~ ~ ~ ~ ~ ~', '~ f f ~ f ~', '~ ~ ~ f ~ ~', '~ ~ ~ ~ ~ ~'];
    const down = board(rows, C3).swap(P(3, 1), P(3, 2)); // dragging the filler down instead
    const clear = down.steps[1] as Clear;
    expect(clear.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(3, 1), 'beamV']]);
  });

  it('exactly 5 in a line: a prism (colour -1) on the swapped cell, 300 points', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~ ~',
        '~ f f ~ f f ~',
        '~ ~ ~ f ~ ~ ~',
        '~ ~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const before = g.snapshot();
    const res = g.swap(P(3, 2), P(3, 1));
    const clear = res.steps[1] as Clear;
    expect(clear.hits).toHaveLength(5);
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([[P(3, 1), 'prism', -1]]);
    expect(clear.score).toBe(5 * 20 + 200);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('6 in a line (only possible in a cascade): one prism on the middle of the run', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~ ~ ~',
        '~ f f f f f f ~',
        '~ ~ ~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 2)); // anything that makes the board settle
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(cellsOf(clear.hits)).toEqual(['1,1', '2,1', '3,1', '4,1', '5,1', '6,1']);
    expect(clear.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(3, 1), 'prism']]);
    expect(clear.score).toBe(6 * 20 + 200);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('L shape: a nova of the group colour on the swapped corner, 220 points', () => {
    const g = board(
      [
        '~ ~ f ~ ~',
        '~ ~ f ~ ~',
        'f f ~ ~ ~',
        '~ ~ f ~ ~',
      ],
      C3,
    );
    const before = g.snapshot();
    const res = g.swap(P(2, 3), P(2, 2));
    const clear = res.steps[1] as Clear;
    expect(cellsOf(clear.hits)).toEqual(['0,2', '1,2', '2,0', '2,1', '2,2']);
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([[P(2, 2), 'nova', 5]]);
    expect(clear.score).toBe(5 * 20 + 120);
    expect(clear.popups).toHaveLength(1);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('T shape: a nova', () => {
    const g = board(
      [
        '~ ~ f ~ ~',
        '~ ~ f ~ ~',
        '~ f ~ f ~',
        '~ ~ f ~ ~',
      ],
      C3,
    );
    const res = g.swap(P(2, 3), P(2, 2));
    const clear = res.steps[1] as Clear;
    expect(cellsOf(clear.hits)).toEqual(['1,2', '2,0', '2,1', '2,2', '3,2']);
    expect(clear.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(2, 2), 'nova']]);
  });

  it('+ shape: one group, a nova on the crossing cell', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~',
        '~ ~ f ~ ~',
        '~ f f f ~',
        '~ ~ f ~ ~',
        '~ ~ ~ ~ ~',
      ],
      C3,
    );
    const res = g.useBooster('hammer', P(0, 4));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(cellsOf(clear.hits)).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2']);
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([[P(2, 2), 'nova', 5]]);
    expect(clear.popups).toHaveLength(1);
  });

  it('a run of 4 crossing a run of 3 is a nova, not a beam', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~',
        '~ f f f f ~',
        '~ ~ f ~ ~ ~',
        '~ ~ f ~ ~ ~',
        '~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const res = g.useBooster('hammer', P(0, 4));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(clear.hits).toHaveLength(6);
    expect(clear.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(2, 1), 'nova']]);
  });

  it('a run of 5 crossing a run of 3 is a prism (the best special wins)', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~ ~',
        '~ f f f f f ~',
        '~ ~ ~ f ~ ~ ~',
        '~ ~ ~ f ~ ~ ~',
        '~ ~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const res = g.useBooster('hammer', P(0, 4));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(clear.hits).toHaveLength(7);
    expect(clear.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(3, 1), 'prism']]);
  });

  it('same-coloured runs that do not share a cell are separate groups', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~ ~',
        '~ f f f ~ ~ ~',
        '~ ~ ~ ~ f f f',
        '~ ~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const res = g.useBooster('hammer', P(0, 3));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(clear.hits).toHaveLength(6);
    expect(clear.created).toEqual([]);
    expect(clear.popups.map((p) => p.value)).toEqual([60, 60]);
  });

  it('one swap, two groups: each swapped piece makes its own special', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~',
        'f f e f ~',
        'e e f e ~',
        '~ ~ ~ ~ ~',
      ],
      C3,
    );
    expect(refHasMatch(g.snapshot())).toBe(false);
    const before = g.snapshot();
    const res = g.swap(P(2, 1), P(2, 2));
    const clear = res.steps[1] as Clear;
    expect(clear.hits).toHaveLength(8);
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([
      [P(2, 1), 'beamV', 5],
      [P(2, 2), 'beamV', 4],
    ]);
    expect(clear.popups).toEqual([
      { at: P(2, 1), value: 140 },
      { at: P(2, 2), value: 140 },
    ]);
    expect(clear.score).toBe(280);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('two separate groups in one cascade wave: a beam (across its run) and a prism', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~ ~',
        '~ f f f f ~ ~',
        '~ ~ ~ ~ ~ ~ ~',
        '~ e e e e e ~',
        '~ ~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const res = g.useBooster('hammer', P(6, 0));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([
      [P(2, 1), 'beamV', 5], // horizontal run, not made by a swap → beam across it
      [P(3, 3), 'prism', -1],
    ]);
    expect(clear.popups.map((p) => p.value)).toEqual([4 * 20 + 60, 5 * 20 + 200]);
  });

  it('a vertical run of 4 in a cascade makes a beamH', () => {
    const g = board(
      [
        '~ ~ ~',
        '~ e ~',
        '~ e ~',
        '~ e ~',
        '~ e ~',
        '~ ~ ~',
      ],
      C3,
    );
    const res = g.useBooster('hammer', P(0, 0));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(clear.created.map((m) => [m.at, m.piece.kind, m.piece.color])).toEqual([[P(1, 2), 'beamH', 4]]);
  });

  it('a special inside a match fires in the next wave, before gravity; the new special survives it', () => {
    const g = board(
      [
        '~ ~ ~ ~ ~ ~',
        '~ fH f ~ f ~',
        '~ ~ ~ f ~ ~',
        '~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    const before = g.snapshot();
    const beamId = pieceOf(before, 1, 1)?.id;
    const res = g.swap(P(3, 2), P(3, 1));
    expect(stepTypes(res.steps).startsWith('swap clear activate clear fall')).toBe(true);

    const first = res.steps[1] as Clear;
    expect(first.hits.find((h) => h.pieceId === beamId)).toMatchObject({ at: P(1, 1), cause: 'match', result: 'activated', kind: 'beamH' });
    expect(first.hits.filter((h) => h.result === 'removed')).toHaveLength(3);
    expect(first.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(3, 1), 'beamV']]);
    expect(first.score).toBe(4 * 20 + 60);
    const newBeam = first.created[0]!.piece.id;

    const act = res.steps[2] as Extract<Step, { type: 'activate' }>;
    expect(act.fx).toHaveLength(1);
    expect(act.fx[0]).toMatchObject({ kind: 'beamH', at: P(1, 1), color: 5 });
    expect(act.fx[0]!.targets.map((p) => `${p.c},${p.r}`).sort()).toEqual(['0,1', '1,1', '2,1', '3,1', '4,1', '5,1']);

    const second = res.steps[3] as Clear;
    expect(second.cascade).toBe(1); // still the same cascade: no fall in between
    // the row: two fillers removed, the fresh beam shrugs the blast off, empty cells give no hit
    expect(second.hits.map((h) => [h.at.c, h.result, h.cause]).sort()).toEqual([
      [0, 'removed', 'blast'],
      [3, 'none', 'blast'],
      [5, 'removed', 'blast'],
    ]);
    expect(second.hits.find((h) => h.at.c === 3)?.pieceId).toBe(newBeam);
    expect(second.score).toBe(40);
    expect(second.popups).toEqual([{ at: P(1, 1), value: 40 }]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('cascades: pieces that fall into a new match score with a growing multiplier', () => {
    const g = board(
      [
        '~ ~ f ~ ~ ~',
        '~ ~ e ~ ~ ~',
        '~ ~ e ~ ~ ~',
        '~ f f e f ~',
        '~ ~ ~ ~ ~ ~',
      ],
      C3,
    );
    expect(refHasMatch(g.snapshot())).toBe(false);
    const before = g.snapshot();
    const res = g.swap(P(3, 3), P(2, 3));
    expect(stepTypes(res.steps).startsWith('swap clear fall clear')).toBe(true);
    const clears = stepsOf(res.steps, 'clear');
    // wave 1: the three e in column 2
    expect(cellsOf(clears[0]!.hits)).toEqual(['2,1', '2,2', '2,3']);
    expect(clears[0]!.cascade).toBe(1);
    expect(clears[0]!.score).toBe(60);
    // wave 2: the f from the top of column 2 has dropped into row 3 → f f f f
    const second = clears[1]!;
    expect(second.cascade).toBe(2);
    const fHits = second.hits.filter((h) => h.color === 5);
    expect(cellsOf(fHits)).toEqual(['1,3', '2,3', '3,3', '4,3']);
    const beam = second.created.find((m) => m.piece.color === 5)!;
    expect(beam.at).toEqual(P(2, 3)); // second cell of the run
    expect(beam.piece.kind).toBe('beamV'); // horizontal run in a cascade → beam across it
    const popup = second.popups.find((p) => p.at.c === 2 && p.at.r === 3)!;
    expect(popup.value).toBe(4 * 20 * 2 + 60);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('the cascade multiplier is capped at 8', async () => {
    const { cascadeMultiplier, SCORE } = await import('../../src/engine/index.ts');
    expect(SCORE.cascadeCap).toBe(8);
    expect([0, 1, 2, 7, 8, 9, 50].map(cascadeMultiplier)).toEqual([1, 1, 2, 7, 8, 8, 8]);
  });
});
