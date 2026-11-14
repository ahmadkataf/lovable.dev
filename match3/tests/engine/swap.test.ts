import { describe, expect, it, vi } from 'vitest';
import { P, board, checkTurn, pieceOf, refHasMatch, stepTypes } from './helpers.ts';

// Generous: these tests are fast, but the suite must not fail because the machine is busy with other work.
vi.setConfig({ testTimeout: 120_000 });

// DESIGN §2.2 — which swaps are legal, and what an illegal one does.

describe('swaps', () => {
  const plain = () =>
    board([
      'a b a d e',
      'b a b e d',
      'd e d f e',
      'e d e d f',
    ]);

  it('accepts a swap that makes a match and charges exactly one move', () => {
    const g = plain();
    expect(refHasMatch(g.snapshot())).toBe(false);
    expect(g.canSwap(P(1, 0), P(1, 1))).toBe(true);
    const before = g.snapshot();
    const res = g.swap(P(1, 0), P(1, 1));
    expect(res.accepted).toBe(true);
    expect(res.steps[0]).toEqual({ type: 'swap', a: P(1, 0), b: P(1, 1), valid: true });
    expect(res.snapshot.movesLeft).toBe(before.movesLeft - 1);
    expect(res.snapshot.score).toBeGreaterThan(0);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('rejects a swap that makes no match: one rejected swap step, nothing changes, no move spent', () => {
    const g = plain();
    const before = g.snapshot();
    expect(g.canSwap(P(3, 0), P(4, 0))).toBe(false);
    const res = g.swap(P(3, 0), P(4, 0));
    expect(res.accepted).toBe(false);
    expect(res.steps).toEqual([{ type: 'swap', a: P(3, 0), b: P(4, 0), valid: false }]);
    expect(res.snapshot).toEqual(before);
    expect(g.snapshot()).toEqual(before);
  });

  it('rejects cells that are not orthogonal neighbours, outside the board, or garbage', () => {
    const g = plain();
    const before = g.snapshot();
    const tries: [unknown, unknown][] = [
      [P(0, 0), P(2, 0)],
      [P(0, 0), P(1, 1)],
      [P(0, 0), P(0, 0)],
      [P(4, 0), P(5, 0)],
      [P(0, -1), P(0, 0)],
      [P(4, 0), P(0, 1)], // neighbours in index space only (row wrap)
      [P(0.5, 0), P(1.5, 0)],
      [undefined, P(0, 0)],
      [null, null],
    ];
    for (const [a, b] of tries) {
      expect(g.canSwap(a as never, b as never)).toBe(false);
      const res = g.swap(a as never, b as never);
      expect(res.accepted).toBe(false);
      expect(res.steps).toEqual([]);
    }
    expect(g.snapshot()).toEqual(before);
  });

  it('never swaps stones, vines, chained pieces or holes — even when the swap would match', () => {
    const g = board([
      'd d 1 d ~',
      'e e v e ~',
      'f f ~ f* ~',
      'd d _ d ~',
      '~ ~ ~ ~ ~',
    ]);
    const before = g.snapshot();
    // stone / vine sitting where a third gem would complete the run
    expect(g.canSwap(P(2, 0), P(3, 0))).toBe(false);
    expect(g.canSwap(P(2, 1), P(3, 1))).toBe(false);
    // the chained f would complete f f f if it could move
    expect(g.canSwap(P(2, 2), P(3, 2))).toBe(false);
    // hole
    expect(g.canSwap(P(2, 3), P(3, 3))).toBe(false);
    expect(g.swap(P(2, 2), P(3, 2)).steps).toEqual([{ type: 'swap', a: P(2, 2), b: P(3, 2), valid: false }]);
    expect(g.swap(P(2, 3), P(3, 3)).steps).toEqual([]);
    expect(g.snapshot()).toEqual(before);
  });

  it('lets a chained piece take part in a match made by a free piece', () => {
    const g = board(
      [
        '~ ~ ~ ~',
        'f* f ~ ~',
        '~ ~ f ~',
      ],
      { colors: 3 },
    );
    expect(g.canSwap(P(2, 2), P(2, 1))).toBe(true);
  });

  it('swaps a lamp only when the other piece makes a match', () => {
    const g = board([
      'a a L a',
      'b d e b',
      'd L d e',
      'e b b d',
      'L L a b',
    ]);
    expect(refHasMatch(g.snapshot())).toBe(false);
    // the gem from (3,0) lands on the lamp's cell and completes a a a
    expect(g.canSwap(P(2, 0), P(3, 0))).toBe(true);
    expect(g.canSwap(P(3, 0), P(2, 0))).toBe(true);
    // no match for the other piece
    expect(g.canSwap(P(2, 0), P(2, 1))).toBe(false);
    expect(g.canSwap(P(1, 2), P(0, 2))).toBe(false);
    expect(g.canSwap(P(1, 2), P(2, 2))).toBe(false);
    // lamp with lamp
    expect(g.canSwap(P(0, 4), P(1, 4))).toBe(false);

    const before = g.snapshot();
    const lampId = pieceOf(before, 2, 0)?.id;
    const res = g.swap(P(3, 0), P(2, 0));
    expect(res.accepted).toBe(true);
    // the lamp moved to (3,0) and nothing destroyed it
    const clear = res.steps[1];
    expect(clear?.type).toBe('clear');
    if (clear?.type === 'clear') {
      expect(clear.hits.map((h) => `${h.at.c},${h.at.r}`).sort()).toEqual(['0,0', '1,0', '2,0']);
      expect(clear.hits.every((h) => h.kind === 'gem')).toBe(true);
    }
    expect(res.snapshot.cells.some((c) => c.piece?.id === lampId)).toBe(true);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a prism combines with gem / beam / nova / prism, but not with lamps, blockers or chained pieces', () => {
    const g = board([
      'P a b* P',
      'a 1 L P',
      'P P d aH',
      'v P dN e',
    ]);
    expect(g.canSwap(P(0, 0), P(1, 0))).toBe(true); // prism + gem
    expect(g.canSwap(P(1, 0), P(0, 0))).toBe(true); // either direction
    expect(g.canSwap(P(0, 0), P(0, 1))).toBe(true);
    expect(g.canSwap(P(0, 2), P(1, 2))).toBe(true); // prism + prism
    expect(g.canSwap(P(3, 1), P(3, 2))).toBe(true); // prism + beam
    expect(g.canSwap(P(1, 3), P(2, 3))).toBe(true); // prism + nova
    expect(g.canSwap(P(3, 0), P(2, 0))).toBe(false); // prism + chained piece
    expect(g.canSwap(P(3, 1), P(2, 1))).toBe(false); // prism + lamp
    expect(g.canSwap(P(1, 2), P(1, 1))).toBe(false); // prism + stone
    expect(g.canSwap(P(1, 3), P(0, 3))).toBe(false); // prism + vine
    const before = g.snapshot();
    expect(g.swap(P(3, 0), P(2, 0)).accepted).toBe(false);
    expect(g.snapshot()).toEqual(before);
  });

  it('two specials always combine; a special and a plain gem need a match', () => {
    const g = board([
      'aH bV d',
      'dN e f',
      'e f d',
    ]);
    expect(g.canSwap(P(0, 0), P(1, 0))).toBe(true); // beam + beam
    expect(g.canSwap(P(0, 0), P(0, 1))).toBe(true); // beam + nova
    expect(g.canSwap(P(1, 0), P(2, 0))).toBe(false); // beam + gem, no match
    expect(g.canSwap(P(0, 1), P(1, 1))).toBe(false); // nova + gem, no match
  });

  it('a special swapped into a match is a normal matching move', () => {
    const g = board(
      [
        '~ ~ ~ ~',
        'f f ~ ~',
        '~ ~ fV ~',
      ],
      { colors: 3 },
    );
    expect(g.canSwap(P(2, 2), P(2, 1))).toBe(true);
    const res = g.swap(P(2, 2), P(2, 1));
    expect(stepTypes(res.steps).startsWith('swap clear activate clear')).toBe(true);
  });

  it('validMoves() lists exactly the legal swaps, each once', () => {
    const g = plain();
    const moves = g.validMoves();
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(g.canSwap(m.a, m.b)).toBe(true);
    const keys = new Set(moves.map((m) => `${m.a.c},${m.a.r}-${m.b.c},${m.b.r}`));
    expect(keys.size).toBe(moves.length);
    // brute force over every neighbour pair
    let count = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        if (c + 1 < 5 && g.canSwap(P(c, r), P(c + 1, r))) count++;
        if (r + 1 < 4 && g.canSwap(P(c, r), P(c, r + 1))) count++;
      }
    }
    expect(moves.length).toBe(count);
  });
});
