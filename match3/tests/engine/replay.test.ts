import { describe, expect, it, vi } from 'vitest';
import { applySteps, type Snapshot, type Step } from '../../src/engine/index.ts';
import { P, board, pieceOf } from './helpers.ts';

// Generous: these tests are fast, but the suite must not fail because the machine is busy with other work.
vi.setConfig({ testTimeout: 120_000 });

// The reference replayer is what the fuzz suite uses to prove transcripts faithful, so it has to
// be strict itself: these tests make sure it notices a transcript that does not fit the board.

const C3 = { colors: 3 };
const start = () => board(['~ ~ ~ ~ ~', '~ f f ~ ~', '~ 2 ~ f ~', 'L ~ ~ ~ e*'], { ...C3, floor: ['00000', '02000', '00000', '00000'] });

describe('applySteps', () => {
  it('replays a real turn to the engine snapshot without touching its input', () => {
    const g = start();
    const before = g.snapshot();
    const frozen = JSON.stringify(before);
    const res = g.swap(P(3, 2), P(3, 1));
    const out = applySteps(before, res.steps);
    expect(out.cells).toEqual(res.snapshot.cells);
    expect(out.score).toBe(res.snapshot.score);
    expect(out.status).toBe(res.snapshot.status);
    expect(out.cols).toBe(5);
    expect(out.rows).toBe(4);
    expect(JSON.stringify(before)).toBe(frozen);
    // replaying a prefix gives the intermediate board
    const afterSwap = applySteps(before, res.steps.slice(0, 1));
    expect(afterSwap.cells[1 * 5 + 3]!.piece).toEqual(pieceOf(before, 3, 2));
    expect(afterSwap.cells[2 * 5 + 3]!.piece).toEqual(pieceOf(before, 3, 1));
  });

  it('no steps, a rejected swap and purely visual steps change nothing', () => {
    const before = start().snapshot();
    const steps: Step[] = [
      { type: 'swap', a: P(0, 0), b: P(1, 0), valid: false },
      { type: 'activate', fx: [{ kind: 'beamH', at: P(0, 0), color: 1, targets: [P(0, 0), P(1, 0)] }] },
      { type: 'booster', booster: 'hammer', at: P(2, 2) },
    ];
    expect(applySteps(before, []).cells).toEqual(before.cells);
    expect(applySteps(before, steps).cells).toEqual(before.cells);
    expect(applySteps(before, steps).score).toBe(before.score);
  });

  it('applies each step type as documented', () => {
    const before = start().snapshot();
    const a = pieceOf(before, 0, 0)!;
    const b = pieceOf(before, 1, 0)!;
    const stone = pieceOf(before, 1, 2)!;
    const chained = pieceOf(before, 4, 3)!;
    const lamp = pieceOf(before, 0, 3)!;
    const steps: Step[] = [
      { type: 'swap', a: P(0, 0), b: P(1, 0), valid: true },
      {
        type: 'clear',
        cascade: 1,
        hits: [
          { at: P(1, 1), cause: 'match', result: 'removed', pieceId: pieceOf(before, 1, 1)!.id, kind: 'gem', color: 5, sandLeft: 1 },
          { at: P(1, 2), cause: 'adjacent', result: 'damaged', pieceId: stone.id, kind: 'stone', color: -1, hpLeft: 1 },
          { at: P(4, 3), cause: 'blast', result: 'unchained', pieceId: chained.id, kind: 'gem', color: 4 },
          { at: P(0, 3), cause: 'blast', result: 'none', pieceId: lamp.id, kind: 'lamp', color: -1 },
        ],
        created: [{ piece: { id: 900, kind: 'nova', color: 5, hp: 1, chained: false }, at: P(1, 1), from: [P(1, 1)] }],
        score: 123,
        popups: [],
      },
      { type: 'transform', reason: 'prismCombo', changes: [{ at: P(0, 0), piece: { ...b, kind: 'beamH' } }], score: 7 },
      { type: 'collect', lamps: [{ id: lamp.id, at: P(0, 3) }], score: 500 },
      {
        type: 'fall',
        moves: [
          { id: pieceOf(before, 0, 2)!.id, from: P(0, 2), to: P(0, 3) },
          { id: pieceOf(before, 0, 1)!.id, from: P(0, 1), to: P(0, 2) },
          { id: b.id, from: P(0, 0), to: P(0, 1) },
        ],
        spawns: [{ piece: { id: 901, kind: 'gem', color: 2, hp: 1, chained: false }, from: P(0, -1), to: P(0, 0) }],
      },
      { type: 'grow', from: P(4, 2), at: P(4, 1), piece: { id: 902, kind: 'vine', color: -1, hp: 1, chained: false }, replacedId: pieceOf(before, 4, 1)!.id },
      { type: 'status', status: 'won' },
    ];
    // 'grow' needs a vine to grow from: put one there by hand
    const withVine: Snapshot = JSON.parse(JSON.stringify(before));
    withVine.cells[2 * 5 + 4]!.piece = { id: 800, kind: 'vine', color: -1, hp: 1, chained: false };
    const out = applySteps(withVine, steps);
    const at = (c: number, r: number) => out.cells[r * 5 + c]!;
    expect(at(1, 0).piece).toEqual(a); // swapped
    expect(at(1, 1)).toMatchObject({ piece: { id: 900, kind: 'nova' }, sand: 1 }); // removed, sand −1, special created
    expect(at(1, 2).piece).toEqual({ ...stone, hp: 1 });
    expect(at(4, 3).piece).toEqual({ ...chained, chained: false });
    expect(at(0, 1).piece).toEqual({ ...b, kind: 'beamH' }); // transformed, then fell
    expect(at(0, 3).piece!.id).toBe(pieceOf(before, 0, 2)!.id); // lamp collected, column closed up
    expect(at(0, 0).piece).toEqual({ id: 901, kind: 'gem', color: 2, hp: 1, chained: false });
    expect(at(4, 1).piece).toEqual({ id: 902, kind: 'vine', color: -1, hp: 1, chained: false });
    expect(out.score).toBe(before.score + 123 + 7 + 500);
    expect(out.status).toBe('won');
  });

  it('shuffle moves are simultaneous (pieces may trade places)', () => {
    const before = start().snapshot();
    const a = pieceOf(before, 0, 0)!;
    const b = pieceOf(before, 1, 0)!;
    const out = applySteps(before, [
      {
        type: 'shuffle',
        moves: [
          { id: a.id, from: P(0, 0), to: P(1, 0) },
          { id: b.id, from: P(1, 0), to: P(0, 0) },
        ],
      },
    ]);
    expect(out.cells[0]!.piece).toEqual(b);
    expect(out.cells[1]!.piece).toEqual(a);
  });

  it('throws on transcripts that do not fit the board', () => {
    const before = start().snapshot();
    const gem = pieceOf(before, 0, 0)!;
    const bad: Step[][] = [
      // hit names the wrong piece
      [{ type: 'clear', cascade: 1, hits: [{ at: P(0, 0), cause: 'match', result: 'removed', pieceId: gem.id + 1000, kind: 'gem', color: 0 }], created: [], score: 0, popups: [] }],
      // hit on an occupied cell claims it was empty
      [{ type: 'clear', cascade: 1, hits: [{ at: P(0, 0), cause: 'blast', result: 'none', pieceId: null, kind: null, color: -1 }], created: [], score: 0, popups: [] }],
      // 'damaged' on a gem
      [{ type: 'clear', cascade: 1, hits: [{ at: P(0, 0), cause: 'blast', result: 'damaged', pieceId: gem.id, kind: 'gem', color: 0, hpLeft: 1 }], created: [], score: 0, popups: [] }],
      // 'unchained' on a piece without a chain
      [{ type: 'clear', cascade: 1, hits: [{ at: P(0, 0), cause: 'blast', result: 'unchained', pieceId: gem.id, kind: 'gem', color: 0 }], created: [], score: 0, popups: [] }],
      // sand that is not there
      [{ type: 'clear', cascade: 1, hits: [{ at: P(0, 0), cause: 'match', result: 'removed', pieceId: gem.id, kind: 'gem', color: 0, sandLeft: 0 }], created: [], score: 0, popups: [] }],
      // special created on an occupied cell
      [{ type: 'clear', cascade: 1, hits: [], created: [{ piece: { id: 999, kind: 'nova', color: 1, hp: 1, chained: false }, at: P(0, 0), from: [] }], score: 0, popups: [] }],
      // fall onto an occupied cell
      [{ type: 'fall', moves: [{ id: gem.id, from: P(0, 0), to: P(0, 1) }], spawns: [] }],
      // fall of a piece that is not there
      [{ type: 'fall', moves: [{ id: 12345, from: P(0, 0), to: P(0, 1) }], spawns: [] }],
      // spawn onto an occupied cell / from inside the board
      [{ type: 'fall', moves: [], spawns: [{ piece: { id: 999, kind: 'gem', color: 1, hp: 1, chained: false }, from: P(0, -1), to: P(0, 0) }] }],
      [{ type: 'fall', moves: [], spawns: [{ piece: { id: 999, kind: 'gem', color: 1, hp: 1, chained: false }, from: P(0, 0), to: P(0, 0) }] }],
      // collecting something that is not a lamp, or a lamp that is not on an exit
      [{ type: 'collect', lamps: [{ id: gem.id, at: P(0, 0) }], score: 500 }],
      // transform of a piece that is not there
      [{ type: 'transform', reason: 'endBonus', changes: [{ at: P(0, 0), piece: { id: 4242, kind: 'beamH', color: 0, hp: 1, chained: false } }], score: 0 }],
      // vine growing from a gem / onto the wrong piece
      [{ type: 'grow', from: P(0, 0), at: P(1, 0), piece: { id: 999, kind: 'vine', color: -1, hp: 1, chained: false }, replacedId: pieceOf(before, 1, 0)!.id }],
      // outside the board
      [{ type: 'swap', a: P(4, 0), b: P(5, 0), valid: true }],
    ];
    for (const steps of bad) expect(() => applySteps(before, steps), JSON.stringify(steps)).toThrow(/^replay: step 0/);
    // a hole
    const holed = board(['~ _ ~', '~ ~ ~'], C3).snapshot();
    expect(() => applySteps(holed, [{ type: 'swap', a: P(0, 0), b: P(1, 0), valid: true }])).toThrow(/hole/);
  });
});
