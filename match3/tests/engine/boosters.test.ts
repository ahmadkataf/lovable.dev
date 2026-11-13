import { describe, expect, it } from 'vitest';
import { Game, type LevelDef, type Snapshot } from '../../src/engine/index.ts';
import { P, board, cellOf, checkTurn, pieceOf, refHasMatch, refValidMoves, stepTypes, stepsOf } from './helpers.ts';

// DESIGN §2.11 — in-level boosters: hammer, freeSwap, shuffle. None of them costs a move.

// A wall of stones on top means nothing can drop in, so these turns have no random part.
// Row 3 offers one valid move (d d _ d), so no end-of-turn shuffle interferes either.
const HAMMER_ROWS = ['3 3 3 3 3 3', '0 0 ~ ~ ~ ~', 'fH e* 2 1 L v', 'd d ~ d ~ _'];
const HAMMER_FLOOR = ['000000', '100000', '000010', '000000'];
const hammerBoard = () => board(HAMMER_ROWS, { colors: 3, floor: HAMMER_FLOOR });

describe('hammer', () => {
  it('the test board is settled and has a move', () => {
    const s = hammerBoard().snapshot();
    expect(refHasMatch(s)).toBe(false);
    expect(refValidMoves(s)).toEqual(['2,3-3,3']);
  });

  it('on a gem: removes it (cause "booster"), 20 points, no move spent', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    const target = pieceOf(before, 5, 1)!;
    const res = g.useBooster('hammer', P(5, 1));
    expect(res.accepted).toBe(true);
    expect(res.steps).toEqual([
      { type: 'booster', booster: 'hammer', at: P(5, 1) },
      {
        type: 'clear',
        cascade: 1,
        hits: [{ at: P(5, 1), cause: 'booster', result: 'removed', pieceId: target.id, kind: 'gem', color: target.color }],
        created: [],
        score: 20,
        popups: [{ at: P(5, 1), value: 20 }],
      },
    ]);
    expect(res.snapshot.movesLeft).toBe(before.movesLeft);
    expect(res.snapshot.score).toBe(20);
    expect(pieceOf(res.snapshot, 5, 1)).toBeNull();
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('on a special: it fires', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 2));
    expect(stepTypes(res.steps)).toBe('booster clear activate clear fall');
    const [first, blast] = stepsOf(res.steps, 'clear');
    expect(first!.hits).toHaveLength(1);
    expect(first!.hits[0]).toMatchObject({ cause: 'booster', result: 'activated', kind: 'beamH' });
    expect(stepsOf(res.steps, 'activate')[0]!.fx[0]).toMatchObject({ kind: 'beamH', at: P(0, 2) });
    expect(blast!.hits.map((h) => `${h.at.c}:${h.kind}:${h.result}`)).toEqual(['1:gem:unchained', '2:stone:damaged', '3:stone:removed', '4:lamp:none', '5:vine:removed']);
    expect(blast!.hits[1]!.hpLeft).toBe(1);
    expect(blast!.hits[3]!.sandLeft).toBe(0);
    expect(blast!.score).toBe(5 * 40);
    // the gems that rested on the destroyed stone and vine drop one cell; nothing spawns
    const fall = stepsOf(res.steps, 'fall')[0]!;
    expect(fall.spawns).toEqual([]);
    expect(fall.moves.map((m) => [m.from, m.to])).toEqual([
      [P(5, 1), P(5, 2)],
      [P(3, 1), P(3, 2)],
    ]);
    expect(res.snapshot.movesLeft).toBe(before.movesLeft);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('on a stone: one layer; the last layer removes it', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    const two = g.useBooster('hammer', P(2, 2));
    expect(stepTypes(two.steps)).toBe('booster clear');
    expect(stepsOf(two.steps, 'clear')[0]!.hits).toEqual([
      { at: P(2, 2), cause: 'booster', result: 'damaged', pieceId: pieceOf(before, 2, 2)!.id, kind: 'stone', color: -1, hpLeft: 1 },
    ]);
    expect(two.snapshot.score).toBe(40);
    expect(pieceOf(two.snapshot, 2, 2)).toMatchObject({ kind: 'stone', hp: 1 });
    checkTurn(g, before, two, 'booster', undefined, false);

    const mid = g.snapshot();
    const gone = g.useBooster('hammer', P(3, 2));
    expect(stepTypes(gone.steps)).toBe('booster clear fall');
    expect(stepsOf(gone.steps, 'clear')[0]!.hits[0]).toMatchObject({ kind: 'stone', result: 'removed' });
    expect(stepsOf(gone.steps, 'fall')[0]!.moves).toEqual([{ id: pieceOf(mid, 3, 1)!.id, from: P(3, 1), to: P(3, 2) }]);
    expect(gone.snapshot.score).toBe(80);
    checkTurn(g, mid, gone, 'booster', undefined, false);
  });

  it('on a chained piece: breaks the chain, the piece stays', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    const piece = pieceOf(before, 1, 2)!;
    const res = g.useBooster('hammer', P(1, 2));
    expect(stepTypes(res.steps)).toBe('booster clear');
    expect(stepsOf(res.steps, 'clear')[0]!.hits).toEqual([{ at: P(1, 2), cause: 'booster', result: 'unchained', pieceId: piece.id, kind: 'gem', color: 4 }]);
    expect(pieceOf(res.snapshot, 1, 2)).toEqual({ ...piece, chained: false });
    expect(res.snapshot.score).toBe(40);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('on a vine: removes it', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(5, 2));
    expect(stepTypes(res.steps)).toBe('booster clear fall');
    expect(stepsOf(res.steps, 'clear')[0]!.hits[0]).toMatchObject({ kind: 'vine', result: 'removed', cause: 'booster' });
    expect(res.snapshot.score).toBe(40);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('on an empty cell with sand: removes one sand layer', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    expect(cellOf(before, 0, 1)).toMatchObject({ exists: true, piece: null, sand: 1 });
    const res = g.useBooster('hammer', P(0, 1));
    expect(res.accepted).toBe(true);
    expect(stepTypes(res.steps)).toBe('booster clear');
    expect(stepsOf(res.steps, 'clear')[0]!.hits).toEqual([{ at: P(0, 1), cause: 'booster', result: 'none', pieceId: null, kind: null, color: -1, sandLeft: 0 }]);
    expect(cellOf(res.snapshot, 0, 1).sand).toBe(0);
    expect(res.snapshot.score).toBe(40);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('on a lamp standing on sand: the lamp shrugs, the sand goes', () => {
    const g = hammerBoard();
    const res = g.useBooster('hammer', P(4, 2));
    expect(res.accepted).toBe(true);
    expect(stepsOf(res.steps, 'clear')[0]!.hits[0]).toMatchObject({ kind: 'lamp', result: 'none', sandLeft: 0 });
    expect(pieceOf(res.snapshot, 4, 2)?.kind).toBe('lamp');
  });

  it('is refused on an empty cell without sand, a hole, outside the board, or without a target', () => {
    const g = hammerBoard();
    const before = g.snapshot();
    expect(cellOf(before, 1, 1)).toMatchObject({ exists: true, piece: null, sand: 0 });
    expect(cellOf(before, 5, 3).exists).toBe(false);
    for (const target of [P(1, 1), P(5, 3), P(9, 9), P(-1, 0), undefined]) {
      const res = g.useBooster('hammer', target);
      expect(res.accepted).toBe(false);
      expect(res.steps).toEqual([]);
      expect(res.snapshot).toEqual(before);
    }
    expect(g.snapshot()).toEqual(before);
  });

  it('can finish a level', () => {
    const g = board(['3 3 3', '~ 1 ~', 'd ~ d', '~ d ~'], { colors: 3, goals: [{ kind: 'stone' }, { kind: 'color', color: 3, target: 99 }] });
    const res = g.useBooster('hammer', P(1, 1));
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 4 });
    expect(res.snapshot.status).toBe('playing');
    const h = board(['~ 1 ~', 'd ~ d', '~ d ~'], { colors: 3, goals: [{ kind: 'stone' }] });
    const won = h.useBooster('hammer', P(1, 0));
    expect(won.snapshot.status).toBe('won');
    expect(won.steps[won.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
  });
});

describe('freeSwap', () => {
  const rows = ['3 3 3 3 3', '~ ~ ~ ~ ~', 'd d ~ d ~', '~ ~ ~ ~ e*'];
  const fs = () => board(rows, { colors: 3 });

  it('swaps two neighbours that make no match: they simply trade places', () => {
    const g = fs();
    const before = g.snapshot();
    expect(g.canSwap(P(0, 1), P(1, 1))).toBe(false); // not a legal normal move
    const res = g.useBooster('freeSwap', P(0, 1), P(1, 1));
    expect(res.accepted).toBe(true);
    expect(res.steps).toEqual([
      { type: 'booster', booster: 'freeSwap', at: P(0, 1) },
      { type: 'swap', a: P(0, 1), b: P(1, 1), valid: true },
    ]);
    expect(pieceOf(res.snapshot, 0, 1)).toEqual(pieceOf(before, 1, 1));
    expect(pieceOf(res.snapshot, 1, 1)).toEqual(pieceOf(before, 0, 1));
    expect(res.snapshot.movesLeft).toBe(before.movesLeft);
    expect(res.snapshot.score).toBe(0);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('resolves a match like a normal swap, without spending a move', () => {
    const g = fs();
    const before = g.snapshot();
    const res = g.useBooster('freeSwap', P(3, 2), P(2, 2));
    expect(stepTypes(res.steps).startsWith('booster swap clear fall')).toBe(true);
    const clear = stepsOf(res.steps, 'clear')[0]!;
    expect(clear.hits.map((h) => `${h.at.c},${h.at.r}`).sort()).toEqual(['0,2', '1,2', '2,2']);
    expect(res.snapshot.movesLeft).toBe(before.movesLeft);
    expect(res.snapshot.score).toBeGreaterThanOrEqual(60);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('moves a lamp too (and a lamp dropped onto an exit is collected)', () => {
    const g = board(['3 3 3', '~ L ~', '~ ~ ~'], { colors: 3 });
    const before = g.snapshot();
    const lamp = pieceOf(before, 1, 1)!;
    const res = g.useBooster('freeSwap', P(1, 1), P(1, 2));
    expect(stepTypes(res.steps).startsWith('booster swap collect fall')).toBe(true);
    expect(stepsOf(res.steps, 'collect')[0]).toEqual({ type: 'collect', lamps: [{ id: lamp.id, at: P(1, 2) }], score: 500 });
    expect(res.snapshot.score).toBe(500);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('triggers combos', () => {
    const g = board(['3 3 3 3', '~ P d ~', '~ ~ ~ d'], { colors: 3 });
    const before = g.snapshot();
    const res = g.useBooster('freeSwap', P(1, 1), P(2, 1));
    expect(stepTypes(res.steps).startsWith('booster swap activate clear')).toBe(true);
    expect(stepsOf(res.steps, 'activate')[0]!.fx[0]).toMatchObject({ kind: 'prism', at: P(2, 1), color: 3 });
    expect(res.snapshot.movesLeft).toBe(before.movesLeft);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('a 4-run made by a free swap gives a beam along the swap direction', () => {
    const g = board(['3 3 3 3 3', '~ ~ d ~ ~', 'd d ~ d ~', '~ ~ ~ ~ ~'], { colors: 3 });
    const res = g.useBooster('freeSwap', P(2, 1), P(2, 2));
    const clear = stepsOf(res.steps, 'clear')[0]!;
    expect(clear.created.map((m) => [m.at, m.piece.kind])).toEqual([[P(2, 2), 'beamV']]);
  });

  it('is refused for blockers, chained pieces, empty cells, non-neighbours, identical gems and missing cells', () => {
    const g = fs();
    const before = g.snapshot();
    const tries: [unknown, unknown][] = [
      [P(0, 0), P(0, 1)], // stone
      [P(4, 3), P(4, 2)], // chained
      [P(4, 3), P(3, 3)],
      [P(0, 1), P(2, 1)], // not neighbours
      [P(0, 1), P(1, 2)],
      [P(0, 2), P(1, 2)], // two d gems: nothing would change
      [P(0, 1), undefined],
      [undefined, undefined],
      [P(0, 3), P(0, 4)], // outside
    ];
    for (const [a, b] of tries) {
      const res = g.useBooster('freeSwap', a as never, b as never);
      expect(res.accepted).toBe(false);
      expect(res.steps).toEqual([]);
    }
    expect(g.snapshot()).toEqual(before);
  });
});

describe('shuffle booster', () => {
  const level: LevelDef = {
    id: 9,
    cols: 8,
    rows: 8,
    colors: 5,
    moves: 20,
    pieces: ['........', '.c....c.', '...22...', '..H.....', '.v....v.', '.....N..', '..L.....', '....P...'],
    goals: [{ kind: 'score', target: 1000 }],
    stars: [1000, 3000, 6000],
  };
  const layout = (s: Snapshot): string => s.cells.map((c) => (c.piece ? `${c.piece.kind}${c.piece.color}` : '-')).join(',');

  it('rearranges the plain gems: same pieces, different layout, no match, a move exists, no move spent', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = new Game(level, { seed });
      const before = g.snapshot();
      const res = g.useBooster('shuffle');
      expect(res.accepted).toBe(true);
      expect(stepTypes(res.steps)).toBe('booster shuffle');
      expect(res.steps[0]).toEqual({ type: 'booster', booster: 'shuffle', at: null });
      const shuffle = stepsOf(res.steps, 'shuffle')[0]!;
      const after = res.snapshot;
      expect(layout(after)).not.toBe(layout(before));
      expect(after.movesLeft).toBe(before.movesLeft);
      expect(after.score).toBe(before.score);
      expect(refHasMatch(after)).toBe(false);
      expect(refValidMoves(after).length).toBeGreaterThan(0);
      // ids are kept, and only plain unchained gems moved
      const where = new Map(after.cells.flatMap((c, i) => (c.piece ? [[c.piece.id, i] as const] : [])));
      before.cells.forEach((cell, i) => {
        const p = cell.piece!;
        const movable = p.kind === 'gem' && !p.chained;
        if (!movable) expect(where.get(p.id)).toBe(i);
        expect(after.cells[where.get(p.id)!]!.piece).toEqual(p);
      });
      expect(shuffle.moves.length).toBeGreaterThan(10);
      expect(new Set(shuffle.moves.map((m) => m.id)).size).toBe(shuffle.moves.length);
      checkTurn(g, before, res, 'booster');
    }
  });

  it('is refused when nothing can be rearranged', () => {
    const g = board(['3 3 3', '3 a 3', '3 3 3']);
    const before = g.snapshot();
    const res = g.useBooster('shuffle');
    expect(res.accepted).toBe(false);
    expect(res.steps).toEqual([]);
    expect(g.snapshot()).toEqual(before);
  });

  it('is refused when every possible result would look the same', () => {
    // the only free gems are two of the same colour; the prism keeps the board playable
    const g = board(['3 3 3 3', 'P d d 3']);
    const before = g.snapshot();
    expect(refValidMoves(before)).toEqual(['0,1-1,1']);
    const res = g.useBooster('shuffle');
    expect(res.accepted).toBe(false);
    expect(g.snapshot()).toEqual(before);
  });

  it('an unknown booster name is refused', () => {
    const g = new Game(level, { seed: 1 });
    const before = g.snapshot();
    expect(g.useBooster('laser' as never).accepted).toBe(false);
    expect(g.snapshot()).toEqual(before);
  });
});
