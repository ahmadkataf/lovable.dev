/**
 * Hardening, part 1 — hand-built boards for docs/DESIGN.md §2.2 – §2.5 (swaps, matches and
 * specials, special effects and combos, what a hit does). Every expectation below was derived
 * from the design text, not from the engine's output; every call additionally runs through the
 * independent Referee of ./hardening-kit.ts.
 *
 * Board notation: see `build()` in the kit. '~' is a three-colour background that never matches
 * and never offers a move; shapes under test use D / E / F, which never drop in (the levels spawn
 * A / B / C only). Where a test needs a transcript without accidental matches among the random
 * refill gems, `quietRun` picks the first seed that gives one.
 */
import { describe, expect, it } from 'vitest';
import { SCORE } from '../../src/engine/index.ts';
import type { Pos, Snapshot, Step, TurnResult } from '../../src/engine/index.ts';
import { at, audit, build, cellsOf, clearsOf, hitCells, hitList, keysOf, pieceAt, quietRun, stepTypes, stepsOf } from './hardening-kit.ts';

const D = 3;
const E = 4;

function expectUnchanged(before: Snapshot, res: TurnResult): void {
  expect(res.accepted).toBe(false);
  expect(JSON.stringify(res.snapshot)).toBe(JSON.stringify(before));
}

/** Both directions of a swap must agree with `want`. */
function expectCanSwap(t: { game: { canSwap(a: Pos, b: Pos): boolean } }, a: Pos, b: Pos, want: boolean): void {
  expect(t.game.canSwap(a, b), `canSwap ${a.c},${a.r} -> ${b.c},${b.r}`).toBe(want);
  expect(t.game.canSwap(b, a), `canSwap ${b.c},${b.r} -> ${a.c},${a.r}`).toBe(want);
}

describe('§2.2 swaps', () => {
  it('stones, vines and chained pieces cannot be swapped, even when the swap would complete a match', () => {
    const t = audit([
      'D  D  S1 ~  ~',
      '~  ~  D  ~  ~',
      'E  E  V  ~  ~',
      '~  ~  E  ~  ~',
      'F  F  ~  ~  ~',
      '~  ~  F# ~  ~',
    ]);
    expect(t.game.validMoves()).toEqual([]);
    const pairs: [Pos, Pos][] = [
      [at(2, 1), at(2, 0)], // the D under the stone would complete D D D in row 0
      [at(2, 3), at(2, 2)], // the E under the vine would complete E E E in row 2
      [at(2, 5), at(2, 4)], // the chained F would complete F F F in row 4
    ];
    for (const [a, b] of pairs) {
      expectCanSwap(t, a, b, false);
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const before = t.snap;
        const res = t.swap(x, y);
        expectUnchanged(before, res);
        expect(res.steps).toEqual([{ type: 'swap', a: x, b: y, valid: false }]);
      }
    }
    expect(t.snap.movesLeft).toBe(30);
  });

  it('a lamp swaps only when the other piece makes a match on the cell the lamp leaves', () => {
    const rows = [
      '~  ~  D  ~  ~',
      'D  D  L  D  ~',
      '~  ~  ~  ~  ~',
      '~  ~  L  ~  ~',
      '~  ~  ~  P  L',
      '~  L  L  ~  ~',
    ];
    const t = audit(rows);
    expectCanSwap(t, at(2, 0), at(2, 1), true);
    // a lamp with nothing to gain for its neighbours
    for (const n of [at(1, 3), at(3, 3), at(2, 2), at(2, 4)]) expectCanSwap(t, at(2, 3), n, false);
    // "(a) … the other is a gem / beam / nova / prism": a lamp is none of those
    expectCanSwap(t, at(3, 4), at(4, 4), false);
    // two lamps
    expectCanSwap(t, at(1, 5), at(2, 5), false);
    // the D to the right of the lamp may step onto the lamp's cell too: it completes D D D there
    expectCanSwap(t, at(3, 1), at(2, 1), true);
    // …but the background gem under the lamp gains nothing by moving up
    expectCanSwap(t, at(2, 2), at(2, 1), false);
    const keys = t.game.validMoves().map((m) => `${m.a.c},${m.a.r}-${m.b.c},${m.b.r}`);
    expect(keys).toContain('2,0-2,1');
    expect(keys).toContain('2,1-3,1');
    for (const key of keys) if (key !== '2,0-2,1' && key !== '2,1-3,1') expect(key.includes('3,4'), `only the prism offers other moves, got ${key}`).toBe(true);

    // dragging the lamp up: the D lands on the lamp's cell and completes D D D D
    const res = t.swap(at(2, 1), at(2, 0));
    expect(res.accepted).toBe(true);
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('0,1 1,1 2,1 3,1'));
    expect(first.hits.every((h) => h.cause === 'match' && h.result === 'removed')).toBe(true);
    // the special goes to the swapped cell that belongs to the group; a vertical swap gives beamV
    expect(first.created.length).toBe(1);
    expect(first.created[0].at).toEqual(at(2, 1));
    expect(first.created[0].piece.kind).toBe('beamV');
    expect(first.created[0].piece.color).toBe(D);
    expect(res.snapshot.movesLeft).toBe(29);

    // the same swap from the other side is the same move
    const u = audit(rows);
    const res2 = u.swap(at(2, 0), at(2, 1));
    expect(res2.accepted).toBe(true);
    expect(clearsOf(res2)[0].created[0].at).toEqual(at(2, 1));
    expect(clearsOf(res2)[0].created[0].piece.kind).toBe('beamV');
  });

  it('(a) a prism combines with gem / beam / nova / prism and with nothing else', () => {
    const t = audit([
      '~  D  ~  E- ~  F* ~',
      '~  P  ~  P  ~  P  ~',
      '~  S1 ~  V  ~  D# ~',
      '~  ~  ~  ~  ~  ~  ~',
      'P  P  ~  P  L  ~  P',
      '~  ~  ~  0  ~  ~  _',
    ]);
    expectCanSwap(t, at(1, 1), at(1, 0), true); // gem
    expectCanSwap(t, at(1, 1), at(0, 1), true); // background gem
    expectCanSwap(t, at(1, 1), at(1, 2), false); // stone
    expectCanSwap(t, at(3, 1), at(3, 0), true); // beam
    expectCanSwap(t, at(3, 1), at(3, 2), false); // vine
    expectCanSwap(t, at(5, 1), at(5, 0), true); // nova
    expectCanSwap(t, at(5, 1), at(5, 2), false); // chained gem
    expectCanSwap(t, at(0, 4), at(1, 4), true); // prism
    expectCanSwap(t, at(3, 4), at(4, 4), false); // lamp
    expectCanSwap(t, at(3, 4), at(3, 5), false); // empty cell
    expectCanSwap(t, at(6, 4), at(6, 5), false); // hole
    expectCanSwap(t, at(6, 4), at(7, 4), false); // outside the board
    expectCanSwap(t, at(6, 4), at(6, 3), true);
  });

  it('(b) two specials always combine; a special and a plain gem need a match', () => {
    const t = audit([
      'D- E| ~  D* E* ~  D- E*',
      '~  ~  ~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~  ~  ~',
    ]);
    expectCanSwap(t, at(0, 0), at(1, 0), true); // beam + beam
    expectCanSwap(t, at(3, 0), at(4, 0), true); // nova + nova
    expectCanSwap(t, at(6, 0), at(7, 0), true); // beam + nova
    expectCanSwap(t, at(1, 0), at(2, 0), false);
    expectCanSwap(t, at(0, 0), at(0, 1), false);
    expectCanSwap(t, at(4, 0), at(5, 0), false);
    expectCanSwap(t, at(2, 0), at(3, 0), false);
    expect(t.game.validMoves().length).toBe(3);
  });

  it('(c) a special moves like a gem when the swap gives it (or its partner) a match', () => {
    const t = audit([
      '~  ~  D| ~  ~',
      'D  D  ~  ~  ~',
      '~  ~  ~  ~  ~',
    ]);
    expectCanSwap(t, at(2, 0), at(2, 1), true);
    expectCanSwap(t, at(2, 0), at(1, 0), false);
    expectCanSwap(t, at(2, 0), at(3, 0), false);
    const res = t.swap(at(2, 0), at(2, 1));
    // the beam is part of the match: it fires (next wave), the two gems are removed
    expect(hitList(clearsOf(res)[0]).sort()).toEqual(['0,1:match:removed', '1,1:match:removed', '2,1:match:activated']);
    const act = stepsOf(res.steps, 'activate')[0];
    expect(act.fx.length).toBe(1);
    expect(act.fx[0].kind).toBe('beamV');
    expect(act.fx[0].at).toEqual(at(2, 1));
    expect(keysOf(act.fx[0].targets)).toEqual(cellsOf('2,0 2,1 2,2'));
  });

  it('an invalid swap costs nothing and changes nothing; a request that is not a swap returns no step', () => {
    const t = audit([
      '~  ~  D  ~  ~',
      'D  D  ~  ~  ~',
      '~  ~  ~  ~  _',
    ]);
    const start = t.snap;
    // adjacent, but no match: the there-and-back step
    const res = t.swap(at(0, 0), at(1, 0));
    expectUnchanged(start, res);
    expect(res.steps).toEqual([{ type: 'swap', a: at(0, 0), b: at(1, 0), valid: false }]);
    // not a swap at all: no step
    const bogus: [Pos, Pos][] = [
      [at(0, 0), at(0, 0)],
      [at(0, 0), at(1, 1)],
      [at(0, 0), at(2, 0)],
      [at(4, 0), at(5, 0)],
      [at(4, 1), at(4, 2)],
      [at(0, 0), at(0, -1)],
      [at(0, 0), at(0.5, 0)],
      [at(Number.NaN, 0), at(0, 0)],
      [at(4, 0), at(0, 1)], // end of one row / start of the next: adjacent indices, not adjacent cells
    ];
    for (const [a, b] of bogus) {
      expect(t.game.canSwap(a, b)).toBe(false);
      const r = t.swap(a, b);
      expectUnchanged(start, r);
      expect(r.steps).toEqual([]);
    }
    for (const bad of [undefined, null, {}, 'x', 7] as unknown[]) {
      const r = t.game.swap(bad as Pos, at(0, 0));
      expectUnchanged(start, r);
      expect(r.steps).toEqual([]);
      expect(t.game.canSwap(at(0, 0), bad as Pos)).toBe(false);
    }
  });

  it('a valid swap costs exactly one move — plain match, combo and long cascade alike', () => {
    const t = audit(['~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  ~  ~  ~  ~'], { moves: 7 });
    expect(t.swap(at(2, 0), at(2, 1)).snapshot.movesLeft).toBe(6);
    const u = audit(['~  ~  ~  ~  ~', '~  D- E* ~  ~', '~  ~  ~  ~  ~'], { moves: 7 });
    expect(u.swap(at(1, 1), at(2, 1)).snapshot.movesLeft).toBe(6);
    const v = audit(['~  ~  ~  ~  ~', '~  P  P  ~  ~', '~  ~  ~  ~  ~'], { moves: 7 });
    const res = v.swap(at(1, 1), at(2, 1));
    expect(res.snapshot.movesLeft).toBe(6);
    expect(stepsOf(res.steps, 'fall').length).toBeGreaterThan(0);
  });
});

describe('§2.3 matches and the special each group makes', () => {
  it('a run of three: three match hits, no special, 3 × 20 points', () => {
    const t = audit(['~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  ~  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 1), at(2, 2));
    const first = clearsOf(res)[0];
    expect(res.steps[0]).toEqual({ type: 'swap', a: at(2, 1), b: at(2, 2), valid: true });
    expect(res.steps[1]).toBe(first);
    expect(first.cascade).toBe(1);
    expect(hitList(first).sort()).toEqual(['0,2:match:removed', '1,2:match:removed', '2,2:match:removed']);
    expect(first.created).toEqual([]);
    expect(first.score).toBe(60);
    expect(first.popups.length).toBe(1);
    expect(first.popups[0].value).toBe(60);
  });

  it('a run of four made by a vertical swap: beamV on the swapped cell, 4 × 20 + 60', () => {
    const t = audit(['~  ~  D  ~  ~', 'D  D  ~  D  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    const first = clearsOf(res)[0];
    expect(hitCells(first, { cause: 'match', result: 'removed' })).toEqual(cellsOf('0,1 1,1 2,1 3,1'));
    expect(first.created.length).toBe(1);
    const made = first.created[0];
    expect(made.at).toEqual(at(2, 1));
    expect(made.piece.kind).toBe('beamV');
    expect(made.piece.color).toBe(D);
    expect(made.piece.chained).toBe(false);
    expect(made.piece.hp).toBe(1);
    expect(keysOf(made.from)).toEqual(cellsOf('0,1 1,1 2,1 3,1'));
    expect(first.score).toBe(4 * SCORE.gem + SCORE.beam);
    expect(first.score).toBe(140);
  });

  it('a run of four made by a horizontal swap: beamH on the swapped cell', () => {
    const t = audit(['~  D  ~', '~  D  ~', 'D  ~  ~', '~  D  ~', '~  ~  ~']);
    const res = t.swap(at(0, 2), at(1, 2));
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('1,0 1,1 1,2 1,3'));
    expect(first.created[0].at).toEqual(at(1, 2));
    expect(first.created[0].piece.kind).toBe('beamH');
    // dragging the other way round is the same move with the same result
    const u = audit(['~  D  ~', '~  D  ~', 'D  ~  ~', '~  D  ~', '~  ~  ~']);
    const res2 = u.swap(at(1, 2), at(0, 2));
    expect(clearsOf(res2)[0].created[0].at).toEqual(at(1, 2));
    expect(clearsOf(res2)[0].created[0].piece.kind).toBe('beamH');
  });

  it('a run of four formed by a cascade makes a beam across the run, on a middle cell (horizontal run → beamV)', () => {
    const rows = [
      '~  ~  ~  ~  ~  ~',
      '~  ~  E  ~  ~  ~',
      '~  ~  F  ~  ~  ~',
      '~  F  ~  ~  ~  ~',
      'E  E  F  E  ~  ~',
      '~  ~  ~  ~  ~  ~',
    ];
    const { res } = quietRun(rows, {}, { op: 'swap', a: at(1, 3), b: at(2, 3) }, (r) => {
      const c = clearsOf(r);
      return c.length === 2 && c[0].hits.length === 3 && c[1].hits.length === 4;
    });
    const [first, second] = clearsOf(res);
    expect(hitCells(first)).toEqual(cellsOf('2,2 2,3 2,4'));
    expect(first.created).toEqual([]);
    expect(first.score).toBe(60);
    expect(second.cascade).toBe(2);
    expect(hitCells(second)).toEqual(cellsOf('0,4 1,4 2,4 3,4'));
    expect(second.created.length).toBe(1);
    expect(second.created[0].piece.kind).toBe('beamV');
    expect(second.created[0].piece.color).toBe(E);
    expect(['1,4', '2,4']).toContain(`${second.created[0].at.c},${second.created[0].at.r}`);
    expect(second.score).toBe(4 * SCORE.gem * 2 + SCORE.beam);
    expect(second.score).toBe(220);
    expect(res.snapshot.score).toBe(280);
  });

  it('a vertical run of four formed by a cascade makes a beamH', () => {
    const rows = [
      '~  ~  ~  ~  ~',
      '~  E  ~  ~  ~',
      '~  E  ~  F  ~',
      '~  F  F  ~  ~',
      '~  E  ~  ~  ~',
      '~  E  ~  ~  ~',
    ];
    const { res } = quietRun(rows, {}, { op: 'swap', a: at(3, 2), b: at(3, 3) }, (r) => {
      const c = clearsOf(r);
      return c.length === 2 && c[0].hits.length === 3 && c[1].hits.length === 4;
    });
    const [first, second] = clearsOf(res);
    expect(hitCells(first)).toEqual(cellsOf('1,3 2,3 3,3'));
    expect(hitCells(second)).toEqual(cellsOf('1,2 1,3 1,4 1,5'));
    expect(second.created[0].piece.kind).toBe('beamH');
    expect(['1,3', '1,4']).toContain(`${second.created[0].at.c},${second.created[0].at.r}`);
    expect(second.score).toBe(220);
  });

  it('a run of five: prism (no colour) on the swapped cell, 5 × 20 + 200', () => {
    const t = audit(['~  ~  D  ~  ~', 'D  D  ~  D  D', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('0,1 1,1 2,1 3,1 4,1'));
    expect(first.created.length).toBe(1);
    expect(first.created[0].at).toEqual(at(2, 1));
    expect(first.created[0].piece.kind).toBe('prism');
    expect(first.created[0].piece.color).toBe(-1);
    expect(first.score).toBe(300);
  });

  it('a run of six formed by a cascade: one prism on a middle cell', () => {
    const rows = [
      '~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~',
      '~  ~  D  D  ~  ~',
      '~  ~  F  E  ~  ~',
      '~  ~  E  F  ~  ~',
      'D  D  F  E  D  D',
      '~  ~  ~  ~  ~  ~',
    ];
    const { res } = quietRun(rows, {}, { op: 'swap', a: at(2, 5), b: at(3, 5) }, (r) => {
      const c = clearsOf(r);
      return c.length === 2 && c[0].hits.length === 6 && c[1].hits.length === 6;
    });
    const [first, second] = clearsOf(res);
    // two groups (F in column 2, E in column 3), three each: no special, two popups
    expect(hitCells(first)).toEqual(cellsOf('2,4 2,5 2,6 3,4 3,5 3,6'));
    expect(first.created).toEqual([]);
    expect(first.popups.length).toBe(2);
    expect(first.score).toBe(120);
    expect(hitCells(second)).toEqual(cellsOf('0,6 1,6 2,6 3,6 4,6 5,6'));
    expect(second.created.length).toBe(1);
    expect(second.created[0].piece.kind).toBe('prism');
    expect(['2,6', '3,6']).toContain(`${second.created[0].at.c},${second.created[0].at.r}`);
    expect(second.score).toBe(6 * SCORE.gem * 2 + SCORE.prism);
  });

  it('L shape: one nova of the group colour on the swapped (corner) cell, 5 × 20 + 120', () => {
    const t = audit(['~  ~  D  ~', '~  ~  D  ~', 'D  D  ~  D', '~  ~  ~  ~']);
    const res = t.swap(at(3, 2), at(2, 2));
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('0,2 1,2 2,2 2,0 2,1'));
    expect(first.created.length).toBe(1);
    expect(first.created[0].at).toEqual(at(2, 2));
    expect(first.created[0].piece.kind).toBe('nova');
    expect(first.created[0].piece.color).toBe(D);
    expect(first.score).toBe(220);
  });

  it('T shape: nova on the swapped cell', () => {
    const t = audit(['~  ~  D  ~  ~', '~  D  ~  D  ~', '~  ~  D  ~  ~', '~  ~  D  ~  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('1,1 2,1 3,1 2,2 2,3'));
    expect(first.created.length).toBe(1);
    expect(first.created[0].at).toEqual(at(2, 1));
    expect(first.created[0].piece.kind).toBe('nova');
  });

  it('+ shape (only a cascade can make one): nova on the intersection cell', () => {
    const rows = ['~  ~  ~  ~  ~', '~  ~  D  ~  ~', '~  ~  D  ~  ~', '~  D  E  D  ~', '~  ~  D  ~  ~', '~  ~  ~  ~  ~'];
    const { res } = quietRun(rows, {}, { op: 'hammer', at: at(2, 3) }, (r) => clearsOf(r).length === 2 && clearsOf(r)[1].hits.length === 5);
    const [first, second] = clearsOf(res);
    expect(hitList(first)).toEqual(['2,3:booster:removed']);
    expect(first.score).toBe(20);
    expect(second.cascade).toBe(2);
    expect(hitCells(second)).toEqual(cellsOf('2,2 2,3 2,4 1,3 3,3'));
    expect(second.created.length).toBe(1);
    expect(second.created[0].at).toEqual(at(2, 3));
    expect(second.created[0].piece.kind).toBe('nova');
    expect(second.created[0].piece.color).toBe(D);
    expect(second.score).toBe(5 * 40 + 120);
  });

  it('best one wins: an L with a four-arm makes a nova (not a beam), with a five-arm a prism', () => {
    const t = audit(['~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D  ~  D  ~', '~  ~  D  ~  ~', '~  ~  D  ~  ~']);
    const res = t.swap(at(2, 1), at(2, 2));
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('0,2 1,2 2,2 3,2 2,3 2,4'));
    expect(first.created.length).toBe(1);
    expect(first.created[0].piece.kind).toBe('nova');
    expect(first.created[0].at).toEqual(at(2, 2));
    expect(first.score).toBe(6 * 20 + 120);

    const u = audit(['~  ~  D  ~  ~', 'D  D  ~  D  D', '~  ~  D  ~  ~', '~  ~  D  ~  ~']);
    const res2 = u.swap(at(2, 0), at(2, 1));
    const first2 = clearsOf(res2)[0];
    expect(hitCells(first2)).toEqual(cellsOf('0,1 1,1 2,1 3,1 4,1 2,2 2,3'));
    expect(first2.created.length).toBe(1);
    expect(first2.created[0].piece.kind).toBe('prism');
    expect(first2.created[0].at).toEqual(at(2, 1));
    expect(first2.score).toBe(7 * 20 + 200);
  });

  it('both swapped pieces match: two groups, two specials, each on its own swapped cell', () => {
    const t = audit(['~  ~  ~  ~  ~  ~', '~  ~  E  D  ~  ~', '~  ~  D  E  ~  ~', '~  ~  E  D  ~  ~', '~  ~  E  D  ~  ~', '~  ~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 2), at(3, 2));
    const first = clearsOf(res)[0];
    expect(hitCells(first)).toEqual(cellsOf('2,1 2,2 2,3 2,4 3,1 3,2 3,3 3,4'));
    expect(first.created.length).toBe(2);
    const made = first.created.map((m) => `${m.at.c},${m.at.r}:${m.piece.kind}:${m.piece.color}`).sort();
    // horizontal swap → both beams are beamH
    expect(made).toEqual([`2,2:beamH:${E}`, `3,2:beamH:${D}`]);
    expect(first.score).toBe(8 * 20 + 2 * 60);
    expect(first.popups.length).toBe(2);
    expect(first.popups.map((p) => p.value)).toEqual([140, 140]);
  });

  it('two runs of the same colour that only touch (no shared cell) are two groups', () => {
    const rows = [
      '~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~',
      '~  D  D  ~  ~',
      '~  D  D  ~  ~',
      'E- ~  ~  ~  ~',
      '~  D  D  ~  ~',
      '~  D  D  ~  ~',
      '~  ~  ~  ~  ~',
    ];
    const { res } = quietRun(rows, {}, { op: 'hammer', at: at(0, 4) }, (r) => clearsOf(r).length === 3 && clearsOf(r)[2].hits.length === 8);
    const third = clearsOf(res)[2];
    expect(third.cascade).toBe(2);
    expect(hitCells(third)).toEqual(cellsOf('1,3 1,4 1,5 1,6 2,3 2,4 2,5 2,6'));
    // side by side they would be a 2 × 4 block — but a group needs a shared cell, so: two beams
    expect(third.created.length).toBe(2);
    expect(third.created.map((m) => m.piece.kind)).toEqual(['beamH', 'beamH']);
    expect(third.score).toBe(8 * 40 + 2 * 60);
  });

  it('chained members are unchained and stay; the others are hit; the special still appears on the swapped cell', () => {
    const t = audit(['~  ~  D  ~  ~', 'D# D  ~  D  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    const first = clearsOf(res)[0];
    expect(hitList(first).sort()).toEqual(['0,1:match:unchained', '1,1:match:removed', '2,1:match:removed', '3,1:match:removed']);
    expect(first.created.length).toBe(1);
    expect(first.created[0].at).toEqual(at(2, 1));
    expect(first.created[0].piece.kind).toBe('beamV');
    // chained members do not merge
    expect(keysOf(first.created[0].from)).toEqual(cellsOf('1,1 2,1 3,1'));
    expect(first.score).toBe(3 * 20 + SCORE.chain + SCORE.beam);
    // right after the wave the unchained gem is still on its cell
    const stay = first.hits.find((h) => h.result === 'unchained');
    expect(stay?.kind).toBe('gem');
    expect(stay?.color).toBe(D);
  });

  it('when the ideal cell is chained the special goes to the nearest member that leaves', () => {
    const rows = ['~  ~  ~  ~  ~', '~  ~  ~  ~  ~', '~  ~  D  ~  ~', 'D  D# ~  D  ~', '~  ~  ~  ~  ~'];
    const { res } = quietRun(rows, {}, { op: 'hammer', at: at(2, 3) }, (r) => clearsOf(r).length === 2 && clearsOf(r)[1].hits.length === 4);
    const second = clearsOf(res)[1];
    expect(hitList(second).sort()).toEqual(['0,3:match:removed', '1,3:match:unchained', '2,3:match:removed', '3,3:match:removed']);
    expect(second.created.length).toBe(1);
    expect(second.created[0].piece.kind).toBe('beamV');
    expect(['0,3', '2,3']).toContain(`${second.created[0].at.c},${second.created[0].at.r}`);
    expect(second.score).toBe(3 * 40 + SCORE.chain + SCORE.beam);
  });

  it('a group whose members are all chained makes no special: the chains break, the gems stay and match afterwards', () => {
    // Not reachable in play (a run needs one free piece to arrive) — a robustness check.
    const rows = ['~  ~  ~  ~  D  D  ~', 'D# D# D# D# ~  ~  D', '~  ~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~  ~'];
    const { res } = quietRun(rows, {}, { op: 'swap', a: at(6, 1), b: at(6, 0) }, (r) => clearsOf(r).length === 2 && clearsOf(r)[0].hits.length === 7 && clearsOf(r)[1].hits.length === 4);
    const [first, second] = clearsOf(res);
    const chained = first.hits.filter((h) => h.at.r === 1);
    expect(chained.map((h) => h.result)).toEqual(['unchained', 'unchained', 'unchained', 'unchained']);
    expect(first.created).toEqual([]);
    expect(first.score).toBe(3 * 20 + 4 * SCORE.chain);
    // the next wave then clears them as a normal run of four (a cascade: beam across the run)
    expect(second.cascade).toBe(2);
    expect(hitList(second).sort()).toEqual(['0,1:match:removed', '1,1:match:removed', '2,1:match:removed', '3,1:match:removed']);
    expect(second.created.length).toBe(1);
    expect(second.created[0].piece.kind).toBe('beamV');
    expect(second.score).toBe(4 * 40 + SCORE.beam);
  });

  it('a special that is part of a match fires its effect in the next wave, before gravity', () => {
    const t = audit(['~  ~  D  ~  ~', 'D- D  ~  ~  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    expect(stepTypes(res.steps.slice(0, 5))).toBe('swap clear activate clear fall');
    const [first, second] = clearsOf(res);
    expect(hitList(first).sort()).toEqual(['0,1:match:activated', '1,1:match:removed', '2,1:match:removed']);
    expect(first.score).toBe(60);
    const act = stepsOf(res.steps, 'activate')[0];
    expect(act.fx.length).toBe(1);
    expect(act.fx[0].kind).toBe('beamH');
    expect(act.fx[0].at).toEqual(at(0, 1));
    expect(act.fx[0].color).toBe(D);
    expect(keysOf(act.fx[0].targets)).toEqual(cellsOf('0,1 1,1 2,1 3,1 4,1'));
    // only the two cells that still hold something are reported
    expect(hitList(second).sort()).toEqual(['3,1:blast:removed', '4,1:blast:removed']);
    expect(second.cascade).toBe(1);
    expect(second.score).toBe(40);
  });

  it('a chained special in a match is only unchained: it stays and does not fire', () => {
    const t = audit(['~  ~  D  ~  ~', 'D-# D  ~  ~  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    const first = clearsOf(res)[0];
    expect(hitList(first).sort()).toEqual(['0,1:match:unchained', '1,1:match:removed', '2,1:match:removed']);
    expect(res.steps[2].type).toBe('fall');
    expect(first.score).toBe(40 + SCORE.chain);
    const beam = first.hits.find((h) => h.result === 'unchained');
    expect(beam?.kind).toBe('beamH');
  });

  it('engine decision: a special made by a match shrugs off blasts of the same cascade', () => {
    const t = audit(['~  ~  D  ~  ~', 'D- D  ~  D  ~', '~  ~  ~  ~  ~']);
    const res = t.swap(at(2, 0), at(2, 1));
    const [first, second] = clearsOf(res);
    expect(first.created.length).toBe(1);
    const made = first.created[0];
    expect(made.at).toEqual(at(2, 1));
    // the old beam (part of the match) fires along the row and reaches the new beam
    const onNew = second.hits.filter((h) => h.at.c === 2 && h.at.r === 1);
    expect(onNew.length).toBe(1);
    expect(onNew[0].result).toBe('none');
    expect(onNew[0].pieceId).toBe(made.piece.id);
    expect(hitList(second).sort()).toEqual(['2,1:blast:none', '4,1:blast:removed']);
    // it is still there for the fall that follows
    const fall = stepsOf(res.steps, 'fall')[0];
    expect(fall.moves.some((m) => m.id === made.piece.id)).toBe(false);
  });
});

describe('§2.4 special effects', () => {
  const fire = (rows: string[], where: Pos): { res: TurnResult; fx: Extract<Step, { type: 'activate' }>['fx'] } => {
    const t = audit(rows);
    const res = t.hammer(where);
    expect(res.accepted).toBe(true);
    return { res, fx: stepsOf(res.steps, 'activate')[0].fx };
  };

  it('beamH reaches every cell of its row, straight through holes', () => {
    const { res, fx } = fire(['~  ~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~  ~', 'D- _  ~  _  _  ~  ~', '~  ~  ~  ~  ~  ~  ~'], at(0, 2));
    expect(fx.length).toBe(1);
    expect(fx[0].kind).toBe('beamH');
    expect(keysOf(fx[0].targets)).toEqual(cellsOf('0,2 2,2 5,2 6,2'));
    const [first, second] = clearsOf(res);
    expect(hitList(first)).toEqual(['0,2:booster:activated']);
    expect(hitList(second).sort()).toEqual(['2,2:blast:removed', '5,2:blast:removed', '6,2:blast:removed']);
    expect(second.score).toBe(60);
  });

  it('beamV reaches every cell of its column, straight through holes', () => {
    const { res, fx } = fire(['~  ~  ~', '~  _  ~', '~  E| ~', '~  ~  ~', '~  _  ~', '~  ~  ~'], at(1, 2));
    expect(fx[0].kind).toBe('beamV');
    expect(keysOf(fx[0].targets)).toEqual(cellsOf('1,0 1,2 1,3 1,5'));
    expect(hitList(clearsOf(res)[1]).sort()).toEqual(['1,0:blast:removed', '1,3:blast:removed', '1,5:blast:removed']);
  });

  it('nova: the 13 cells with |dc| + |dr| <= 2', () => {
    const rows = new Array<string>(7).fill('~  ~  ~  ~  ~  ~  ~');
    rows[3] = '~  ~  ~  D* ~  ~  ~';
    const { res, fx } = fire(rows, at(3, 3));
    expect(fx[0].kind).toBe('nova');
    expect(fx[0].targets.length).toBe(13);
    expect(keysOf(fx[0].targets)).toEqual(cellsOf('3,1 2,2 3,2 4,2 1,3 2,3 3,3 4,3 5,3 2,4 3,4 4,4 3,5'));
    expect(clearsOf(res)[1].hits.length).toBe(12);
    expect(clearsOf(res)[1].score).toBe(240);
  });

  it('nova clipped by a corner (6 cells), an edge (9 cells) and holes', () => {
    const blank = (): string[] => new Array<string>(7).fill('~  ~  ~  ~  ~  ~  ~');
    let rows = blank();
    rows[0] = 'D* ~  ~  ~  ~  ~  ~';
    expect(keysOf(fire(rows, at(0, 0)).fx[0].targets)).toEqual(cellsOf('0,0 1,0 2,0 0,1 1,1 0,2'));
    rows = blank();
    rows[6] = '~  ~  ~  ~  ~  ~  D*';
    expect(keysOf(fire(rows, at(6, 6)).fx[0].targets)).toEqual(cellsOf('6,6 5,6 4,6 6,5 5,5 6,4'));
    rows = blank();
    rows[3] = 'D* ~  ~  ~  ~  ~  ~';
    expect(keysOf(fire(rows, at(0, 3)).fx[0].targets)).toEqual(cellsOf('0,1 0,2 0,3 0,4 0,5 1,2 1,3 1,4 2,3'));
    rows = blank();
    rows[0] = '~  ~  ~  D* ~  ~  ~';
    expect(keysOf(fire(rows, at(3, 0)).fx[0].targets)).toEqual(cellsOf('1,0 2,0 3,0 4,0 5,0 2,1 3,1 4,1 3,2'));
    rows = blank();
    rows[1] = '~  ~  ~  _  ~  ~  ~';
    rows[3] = '~  ~  ~  D* ~  ~  ~';
    rows[4] = '~  ~  ~  ~  _  ~  ~';
    const holed = fire(rows, at(3, 3));
    expect(holed.fx[0].targets.length).toBe(11);
    expect(keysOf(holed.fx[0].targets)).toEqual(cellsOf('2,2 3,2 4,2 1,3 2,3 3,3 4,3 5,3 2,4 3,4 3,5'));
  });

  it('a prism set off by a hit clears the most common colour — every gem-like piece of it', () => {
    const { res, fx } = fire(['D  E  D  E  F', 'E  D  E  F  E', 'D  E  P  E  D', 'E  F  E  D  E', 'F  E  D  E  D'], at(2, 2));
    // E × 12, D × 8, F × 4
    expect(fx.length).toBe(1);
    expect(fx[0].kind).toBe('prism');
    expect(fx[0].at).toEqual(at(2, 2));
    expect(fx[0].color).toBe(E);
    expect(keysOf(fx[0].targets)).toEqual(cellsOf('1,0 3,0 0,1 2,1 4,1 1,2 3,2 0,3 2,3 4,3 1,4 3,4'));
    const [first, second] = clearsOf(res);
    expect(hitList(first)).toEqual(['2,2:booster:activated']);
    expect(first.score).toBe(20);
    expect(second.hits.length).toBe(12);
    expect(second.hits.every((h) => h.cause === 'blast' && h.result === 'removed' && h.color === E)).toBe(true);
    expect(second.score).toBe(240);
  });

  it('"most common" counts chained pieces and specials too, and they are all hit', () => {
    //  D: 8 plain.  E: 5 plain + 2 chained + 2 specials = 9  → E
    const rows = ['D  E  D  E# F', 'F  D  E  F  E-', 'D  F  P  E  D', 'E# F  E* D  F', 'F  E  D  E  D'];
    const counts = [0, 0, 0, 0, 0, 0];
    for (const cell of build(rows).snapshot().cells) if (cell.piece && cell.piece.color >= 0) counts[cell.piece.color]++;
    expect(counts).toEqual([0, 0, 0, 8, 9, 7]);
    const { res, fx } = fire(rows, at(2, 2));
    expect(fx[0].color).toBe(E);
    expect(keysOf(fx[0].targets)).toEqual(cellsOf('1,0 3,0 2,1 4,1 3,2 0,3 2,3 1,4 3,4'));
    const second = clearsOf(res)[1];
    expect(hitList(second).sort()).toEqual(
      ['1,0:blast:removed', '3,0:blast:unchained', '2,1:blast:removed', '4,1:blast:activated', '3,2:blast:removed', '0,3:blast:unchained', '2,3:blast:activated', '1,4:blast:removed', '3,4:blast:removed'].sort(),
    );
    // the two specials fire together in the following wave
    const next = stepsOf(res.steps, 'activate')[1];
    expect(next.fx.map((f) => f.kind).sort()).toEqual(['beamH', 'nova']);
  });

  it('a prism with a tie picks one of the most common colours (the engine: the lowest)', () => {
    const rows = ['D  E  D  E', 'E  D  E  D', 'D  E  P  E', 'E  D  F  D'];
    const counts = [0, 0, 0, 0, 0, 0];
    for (const cell of build(rows).snapshot().cells) if (cell.piece && cell.piece.color >= 0) counts[cell.piece.color]++;
    expect(counts).toEqual([0, 0, 0, 7, 7, 1]);
    const tie = fire(rows, at(2, 2));
    expect([D, E]).toContain(tie.fx[0].color);
    // documented engine choice: the lower colour index
    expect(tie.fx[0].color).toBe(D);
    expect(tie.fx[0].targets.length).toBe(7);
  });

  it('chain reactions: specials hit by a blast fire together in the next wave, all before gravity', () => {
    const t = audit([
      '~  ~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~  ~',
      'D- ~  ~  E| ~  F* ~',
      '~  ~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~  ~',
    ]);
    const res = t.hammer(at(0, 2));
    expect(stepTypes(res.steps.slice(0, 7))).toBe('booster clear activate clear activate clear fall');
    const acts = stepsOf(res.steps, 'activate');
    expect(acts[0].fx.map((f) => f.kind)).toEqual(['beamH']);
    expect(acts[1].fx.map((f) => `${f.kind}@${f.at.c},${f.at.r}`).sort()).toEqual(['beamV@3,2', 'nova@5,2']);
    const [, second, third] = clearsOf(res);
    expect(hitList(second).sort()).toEqual(['1,2:blast:removed', '2,2:blast:removed', '3,2:blast:activated', '4,2:blast:removed', '5,2:blast:activated', '6,2:blast:removed']);
    // third wave: column 3 (5 cells left) and the nova's diamond around (5,2) minus what is gone
    const want = new Set<string>();
    for (let r = 0; r < 6; r++) if (r !== 2) want.add(`3,${r}`);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (Math.abs(c - 5) + Math.abs(r - 2) <= 2 && r !== 2) want.add(`${c},${r}`);
    expect(hitCells(third)).toEqual([...want].sort());
    expect(third.hits.every((h) => h.result === 'removed')).toBe(true);
    // all three waves belong to cascade 1
    expect([clearsOf(res)[0].cascade, second.cascade, third.cascade]).toEqual([1, 1, 1]);
  });

  it('each special fires at most once, even when blasts keep crossing its cell', () => {
    const t = audit([
      'D- ~  E| ~  ~  ~',
      '~  ~  ~  ~  ~  ~',
      '~  ~  ~  ~  ~  ~',
      'F| ~  D- ~  ~  ~',
      '~  ~  ~  ~  ~  ~',
    ]);
    // hammer E| (2,0): column 2 → D- (2,3): row 3 → F| (0,3): column 0 → D- (0,0): row 0 → (2,0) is long gone
    const res = t.hammer(at(2, 0));
    const acts = stepsOf(res.steps, 'activate');
    const fired = acts.slice(0, 4).map((a) => a.fx.map((f) => `${f.kind}@${f.at.c},${f.at.r}`).join('+'));
    expect(fired).toEqual(['beamV@2,0', 'beamH@2,3', 'beamV@0,3', 'beamH@0,0']);
    expect(stepTypes(res.steps.slice(0, 10))).toBe('booster clear activate clear activate clear activate clear activate clear');
    expect(res.steps[10].type).toBe('fall');
    const ids = new Set<number>();
    for (const c of clearsOf(res).slice(0, 5)) for (const h of c.hits) if (h.result === 'activated') {
      expect(ids.has(h.pieceId as number)).toBe(false);
      ids.add(h.pieceId as number);
    }
    expect(ids.size).toBe(4);
  });
});

describe('§2.4 swap combos: both pieces are used up, the effect is centred on the destination cell', () => {
  const blank9 = (): string[] => new Array<string>(9).fill('~  ~  ~  ~  ~  ~  ~  ~  ~');
  const put = (rows: string[], c: number, r: number, token: string): void => {
    const cells = rows[r].trim().split(/\s+/);
    cells[c] = token;
    rows[r] = cells.join('  ');
  };
  const want = (inside: (dc: number, dr: number) => boolean, centre: Pos, cols = 9, rows = 9): string[] => {
    const out: string[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (inside(Math.abs(c - centre.c), Math.abs(r - centre.r))) out.push(`${c},${r}`);
    return out.sort();
  };
  const shapes = {
    cross: (dc: number, dr: number): boolean => dc === 0 || dr === 0,
    bigCross: (dc: number, dr: number): boolean => dc <= 1 || dr <= 1,
    bigNova: (dc: number, dr: number): boolean => (dc <= 2 && dr <= 2) || (dc === 0 && dr === 3) || (dr === 0 && dc === 3),
  };
  const cases: { name: string; a: string; b: string; kind: 'cross' | 'bigCross' | 'bigNova'; cells: number }[] = [
    { name: 'beam + beam → cross (row and column)', a: 'D-', b: 'E|', kind: 'cross', cells: 17 },
    { name: 'beam + beam (both horizontal) → still a cross', a: 'D-', b: 'E-', kind: 'cross', cells: 17 },
    { name: 'beam + nova → bigCross (three rows and three columns)', a: 'D|', b: 'E*', kind: 'bigCross', cells: 45 },
    { name: 'nova + beam → bigCross', a: 'D*', b: 'E-', kind: 'bigCross', cells: 45 },
    { name: 'nova + nova → bigNova (5 × 5 plus four tips)', a: 'D*', b: 'E*', kind: 'bigNova', cells: 29 },
  ];
  for (const cc of cases) {
    it(cc.name, () => {
      for (const reverse of [false, true]) {
        const rows = blank9();
        put(rows, 3, 4, cc.a);
        put(rows, 4, 4, cc.b);
        const t = audit(rows);
        const from = reverse ? at(4, 4) : at(3, 4);
        const to = reverse ? at(3, 4) : at(4, 4);
        const res = t.swap(from, to);
        expect(res.accepted).toBe(true);
        expect(stepTypes(res.steps.slice(0, 4))).toBe('swap activate clear fall');
        const act = stepsOf(res.steps, 'activate')[0];
        expect(act.fx.length).toBe(1);
        expect(act.fx[0].kind).toBe(cc.kind);
        expect(act.fx[0].at).toEqual(to);
        const cells = want(shapes[cc.kind], to);
        expect(cells.length).toBe(cc.cells);
        expect(keysOf(act.fx[0].targets)).toEqual(cells);
        const clear = clearsOf(res)[0];
        // every target cell is hit exactly once; the two combo pieces are used up ('activated')
        expect(hitCells(clear)).toEqual(cells);
        expect(hitCells(clear, { result: 'activated' })).toEqual(cellsOf('3,4 4,4'));
        expect(clear.hits.filter((h) => h.result === 'removed').length).toBe(cc.cells - 2);
        expect(clear.score).toBe(cc.cells * 20);
        expect(res.snapshot.movesLeft).toBe(29);
      }
    });
  }

  it('combos are clipped at the board edge', () => {
    const corner = (a: string, b: string): Extract<Step, { type: 'activate' }>['fx'][number] => {
      const rows = blank9();
      put(rows, 1, 0, a);
      put(rows, 0, 0, b);
      const res = audit(rows).swap(at(1, 0), at(0, 0));
      return stepsOf(res.steps, 'activate')[0].fx[0];
    };
    const cross = corner('D-', 'E|');
    expect(cross.at).toEqual(at(0, 0));
    expect(cross.targets.length).toBe(17);
    const big = corner('D-', 'E*');
    expect(keysOf(big.targets)).toEqual(want(shapes.bigCross, at(0, 0)));
    expect(big.targets.length).toBe(32);
    const nova = corner('D*', 'E*');
    expect(keysOf(nova.targets)).toEqual(want(shapes.bigNova, at(0, 0)));
    expect(nova.targets.length).toBe(11);
  });

  it('prism + gem: every gem-like piece of the gem\'s colour is hit, whichever of the two is dragged', () => {
    for (const reverse of [false, true]) {
      const t = audit([
        'D  ~  ~  ~  D#',
        '~  ~  ~  ~  ~',
        '~  P  D  ~  ~',
        '~  ~  ~  D- ~',
        'D  ~  S1 ~  D*',
      ]);
      const from = reverse ? at(2, 2) : at(1, 2);
      const to = reverse ? at(1, 2) : at(2, 2);
      const res = t.swap(from, to);
      expect(stepTypes(res.steps.slice(0, 3))).toBe('swap activate clear');
      const act = stepsOf(res.steps, 'activate')[0];
      expect(act.fx.length).toBe(1);
      expect(act.fx[0].kind).toBe('prism');
      expect(act.fx[0].at).toEqual(to);
      expect(act.fx[0].color).toBe(D);
      const first = clearsOf(res)[0];
      const got = hitList(first).sort();
      // whichever is dragged, the two trade places: the prism is used up on (2,2), the gem is hit on (1,2)
      const prismCell = at(2, 2);
      const gemCell = at(1, 2);
      expect(got).toContain(`${prismCell.c},${prismCell.r}:blast:activated`);
      expect(got).toContain(`${gemCell.c},${gemCell.r}:blast:removed`);
      const prismHit = first.hits.find((h) => h.at.c === prismCell.c && h.at.r === prismCell.r);
      expect(prismHit?.kind).toBe('prism');
      expect(got.filter((h) => h.endsWith(':activated')).length).toBe(3); // the prism + D- + D*
      expect(got).toContain('0,0:blast:removed');
      expect(got).toContain('4,0:blast:unchained');
      expect(got).toContain('0,4:blast:removed');
      expect(got).toContain('3,3:blast:activated');
      expect(got).toContain('4,4:blast:activated');
      expect(first.hits.length).toBe(7);
      // the stone is not touched (a prism hits pieces of one colour only)
      expect(first.hits.some((h) => h.kind === 'stone')).toBe(false);
      // targets: exactly the D-coloured pieces as they stand after the swap
      expect(act.fx[0].targets.length).toBe(6);
      const next = stepsOf(res.steps, 'activate')[1];
      expect(next.fx.map((f) => f.kind).sort()).toEqual(['beamH', 'nova']);
    }
  });

  for (const partner of ['beam', 'nova'] as const) {
    it(`prism + ${partner}: every plain gem of that colour becomes a ${partner}, then they all fire`, () => {
      const token = partner === 'beam' ? 'D|' : 'D*';
      const t = audit([
        'D  ~  ~  ~  ~  ~  D#',
        '~  ~  ~  ~  ~  ~  ~',
        '~  ~  P  ' + token + ' ~  ~  ~',
        '~  ~  ~  ~  ~  ~  ~',
        '~  D  ~  ~  ~  ~  E',
        '~  ~  ~  ~  ~  D  ~',
        '~  ~  ~  ~  ~  ~  ~',
      ]);
      const res = t.swap(at(2, 2), at(3, 2));
      expect(stepTypes(res.steps.slice(0, 6))).toBe('swap transform activate clear activate clear');
      const tr = stepsOf(res.steps, 'transform')[0];
      expect(tr.reason).toBe('prismCombo');
      expect(tr.score).toBe(0);
      // the three plain, unchained D gems — not the chained one, not the E
      expect(keysOf(tr.changes.map((c) => c.at))).toEqual(cellsOf('0,0 1,4 5,5'));
      for (const ch of tr.changes) {
        expect(ch.piece.color).toBe(D);
        if (partner === 'nova') expect(ch.piece.kind).toBe('nova');
        else expect(['beamH', 'beamV']).toContain(ch.piece.kind);
      }
      const acts = stepsOf(res.steps, 'activate');
      expect(acts[0].fx.length).toBe(1);
      expect(acts[0].fx[0].kind).toBe('prism');
      expect(acts[0].fx[0].at).toEqual(at(3, 2));
      expect(acts[0].fx[0].color).toBe(D);
      const first = clearsOf(res)[0];
      // prism used up; the partner and the three new specials are set off; the chained D is unchained
      expect(hitList(first).sort()).toEqual(['0,0:blast:activated', '1,4:blast:activated', '2,2:blast:activated', '3,2:blast:activated', '5,5:blast:activated', '6,0:blast:unchained'].sort());
      // …and they all fire together in the next wave
      expect(acts[1].fx.length).toBe(4);
      expect(keysOf(acts[1].fx.map((f) => f.at))).toEqual(cellsOf('0,0 1,4 2,2 5,5'));
      for (const f of acts[1].fx) {
        if (partner === 'nova') expect(f.kind).toBe('nova');
        else expect(['beamH', 'beamV']).toContain(f.kind);
      }
    });
  }

  it('prism + prism: every cell of the board is hit exactly once', () => {
    const t = audit(
      [
        '~  ~  ~  ~  ~  _',
        '~  S2 V  L  D# ~',
        '~  ~  P  P  ~  ~',
        '~  0  ~  ~  E- ~',
        '~  ~  ~  ~  ~  ~',
      ],
      { floor: ['000000', '011110', '002200', '010000', '000000'] },
    );
    const res = t.swap(at(2, 2), at(3, 2));
    expect(stepTypes(res.steps.slice(0, 3))).toBe('swap activate clear');
    const act = stepsOf(res.steps, 'activate')[0];
    expect(act.fx.length).toBe(1);
    expect(act.fx[0].kind).toBe('prismAll');
    expect(act.fx[0].at).toEqual(at(3, 2));
    expect(act.fx[0].targets.length).toBe(29); // 30 cells minus the hole
    const first = clearsOf(res)[0];
    // one hit per cell that holds something (28 pieces: 29 cells minus the empty one) + the empty sand cell
    const perCell = new Map<string, number>();
    for (const h of first.hits) perCell.set(`${h.at.c},${h.at.r}`, (perCell.get(`${h.at.c},${h.at.r}`) ?? 0) + 1);
    expect([...perCell.values()].every((n) => n === 1)).toBe(true);
    expect(perCell.size).toBe(29);
    const by = (c: number, r: number): string => {
      const h = first.hits.find((x) => x.at.c === c && x.at.r === r);
      return h ? `${h.result}${h.hpLeft !== undefined ? `/hp${h.hpLeft}` : ''}${h.sandLeft !== undefined ? `/sand${h.sandLeft}` : ''}` : 'no hit';
    };
    expect(by(2, 2)).toBe('activated/sand1'); // prism (used up), sand 2 → 1
    expect(by(3, 2)).toBe('activated/sand1');
    expect(by(1, 1)).toBe('damaged/hp1'); // stone absorbs the hit: its sand stays
    expect(by(2, 1)).toBe('removed'); // vine absorbs the hit: its sand stays
    expect(by(3, 1)).toBe('none/sand0'); // lamp shrugs it off, the sand under it does not
    expect(by(4, 1)).toBe('unchained/sand0');
    expect(by(1, 3)).toBe('none/sand0'); // empty cell with sand
    expect(by(4, 3)).toBe('activated'); // the beam is set off…
    expect(stepsOf(res.steps, 'activate')[1].fx.map((f) => f.kind)).toEqual(['beamH']); // …and fires next
    // score: 2 prisms + beam + 21 gems = 24 × 20; stone 40; vine 40; chain 40; sand layers 2 + 1 + 1 + 1 = 5 × 40
    expect(first.score).toBe(24 * 20 + 40 + 40 + 40 + 5 * 40);
  });
});

describe('§2.5 what a hit does', () => {
  it('a stone loses one layer per hit: damaged, damaged, removed — 40 points each', () => {
    const t = audit(['~  ~  ~', '~  S3 ~', '~  ~  ~'], { goals: [{ kind: 'stone' }, { kind: 'score', target: 1e9 }] });
    const a = t.hammer(at(1, 1));
    expect(clearsOf(a)[0].hits).toEqual([{ at: at(1, 1), cause: 'booster', result: 'damaged', pieceId: pieceAt(a.snapshot, 1, 1)?.id, kind: 'stone', color: -1, hpLeft: 2 }]);
    expect(a.snapshot.score).toBe(40);
    expect(pieceAt(a.snapshot, 1, 1)?.hp).toBe(2);
    const b = t.hammer(at(1, 1));
    expect(clearsOf(b)[0].hits[0].result).toBe('damaged');
    expect(clearsOf(b)[0].hits[0].hpLeft).toBe(1);
    expect(b.snapshot.goals[0].current).toBe(0);
    const c = t.hammer(at(1, 1));
    expect(clearsOf(c)[0].hits[0].result).toBe('removed');
    expect(clearsOf(c)[0].hits[0].hpLeft).toBeUndefined();
    expect(clearsOf(c)[0].score).toBe(40);
    expect(c.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    expect(a.snapshot.movesLeft).toBe(30);
    expect(c.snapshot.movesLeft).toBe(30);
  });

  it('sand: a hit cell loses one layer — but a stone or vine standing on it absorbs the hit', () => {
    const t = audit(['~  ~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~  ~', 'E- S2 V  L  D# 0  ~', '~  ~  ~  ~  ~  ~  ~', '~  ~  ~  ~  ~  ~  ~'], {
      floor: ['0000000', '0000000', '2222222', '0000000', '0000000'],
      goals: [{ kind: 'sand' }, { kind: 'score', target: 1e9 }],
    });
    expect(t.snap.goals[0]).toMatchObject({ current: 0, target: 14 });
    const res = t.hammer(at(0, 2));
    const [first, second] = clearsOf(res);
    // the hammer's hit: the beam fires, and the cell loses a layer
    expect(first.hits.length).toBe(1);
    expect(first.hits[0]).toMatchObject({ result: 'activated', sandLeft: 1 });
    expect(first.score).toBe(20 + 40);
    const by = (c: number): string => {
      const h = second.hits.filter((x) => x.at.c === c && x.at.r === 2);
      expect(h.length).toBe(1);
      return `${h[0].pieceId === null ? 'empty' : h[0].kind}:${h[0].result}${h[0].hpLeft !== undefined ? `/hp${h[0].hpLeft}` : ''}${h[0].sandLeft !== undefined ? `/sand${h[0].sandLeft}` : ''}`;
    };
    expect(by(0)).toBe('empty:none/sand0'); // the beam's own (now empty) cell is in its row
    expect(by(1)).toBe('stone:damaged/hp1'); // sand under the stone untouched
    expect(by(2)).toBe('vine:removed'); // sand under the vine untouched
    expect(by(3)).toBe('lamp:none/sand1');
    expect(by(4)).toBe('gem:unchained/sand1');
    expect(by(5)).toBe('empty:none/sand1');
    expect(by(6)).toBe('gem:removed/sand1');
    expect(second.score).toBe(40 + 40 + 40 + 40 + (40 + 40) + 40 + (20 + 40));
    expect(res.snapshot.goals[0]).toMatchObject({ current: 6, target: 14, done: false });
    const sand = [0, 1, 2, 3, 4, 5, 6].map((c) => res.snapshot.cells[2 * 7 + c].sand);
    expect(sand).toEqual([0, 2, 2, 1, 1, 1, 1]);
  });

  it('adjacent damage: one hit per blocker per wave, however many cells of the group touch it', () => {
    const t = audit(['~  ~  ~  ~', 'D  D  ~  D', '~  S3 D  ~', '~  V  D  ~', '~  ~  ~  ~']);
    const res = t.swap(at(3, 1), at(2, 1));
    const first = clearsOf(res)[0];
    // L: (0,1) (1,1) (2,1) + (2,2) (2,3). The stone at (1,2) touches (1,1) and (2,2); the vine at (1,3) touches (2,3).
    expect(hitCells(first, { cause: 'match' })).toEqual(cellsOf('0,1 1,1 2,1 2,2 2,3'));
    const adjacent = first.hits.filter((h) => h.cause === 'adjacent').map((h) => `${h.at.c},${h.at.r}:${h.kind}:${h.result}${h.hpLeft !== undefined ? `/hp${h.hpLeft}` : ''}`);
    expect(adjacent.sort()).toEqual(['1,2:stone:damaged/hp2', '1,3:vine:removed']);
    expect(first.score).toBe(5 * 20 + 120 + 40 + 40);
  });

  it('adjacent damage: a blocker between two groups of one wave is still hit once', () => {
    const t = audit(['~  ~  ~  D  ~', '~  ~  S3 D  ~', '~  ~  D  E  ~', '~  ~  E  ~  ~', '~  ~  E  ~  ~']);
    const res = t.swap(at(2, 2), at(3, 2));
    const first = clearsOf(res)[0];
    expect(hitCells(first, { cause: 'match' })).toEqual(cellsOf('3,0 3,1 3,2 2,2 2,3 2,4'));
    const stone = first.hits.filter((h) => h.kind === 'stone');
    expect(stone.length).toBe(1);
    expect(stone[0]).toMatchObject({ cause: 'adjacent', result: 'damaged', hpLeft: 2 });
    expect(first.score).toBe(6 * 20 + 40);
  });

  it('blasts do not cause adjacent damage', () => {
    const t = audit(['~  S1 V  S2 ~', 'D- ~  ~  ~  ~', '~  S1 V  S2 ~']);
    const res = t.hammer(at(0, 1));
    for (const clear of clearsOf(res).slice(0, 2)) {
      expect(clear.hits.some((h) => h.cause === 'adjacent')).toBe(false);
      expect(clear.hits.some((h) => h.kind === 'stone' || h.kind === 'vine')).toBe(false);
    }
    expect(hitList(clearsOf(res)[1]).sort()).toEqual(['1,1:blast:removed', '2,1:blast:removed', '3,1:blast:removed', '4,1:blast:removed']);
  });

  it('two effects of one wave on the same cell are two hits: chain broken then removed, stone damaged twice', () => {
    const t = audit([
      '~  ~  ~  ~  ~  ~',
      '~  D* ~  E| ~  ~',
      'F- ~  ~  D# ~  ~',
      '~  ~  ~  S2 ~  ~',
      '~  ~  ~  ~  ~  ~',
      'F- ~  ~  ~  ~  ~',
    ]);
    // nova (1,1) sets off E| (3,1) and F- (0,2): the column and the row cross on the chained D at (3,2)
    const res = t.hammer(at(1, 1));
    const acts = stepsOf(res.steps, 'activate');
    expect(acts[1].fx.map((f) => f.kind).sort()).toEqual(['beamH', 'beamV']);
    const third = clearsOf(res)[2];
    const onChain = third.hits.filter((h) => h.at.c === 3 && h.at.r === 2).map((h) => h.result);
    expect(onChain).toEqual(['unchained', 'removed']);
    // the stone at (3,3) is only in the column: one hit
    const onStone = third.hits.filter((h) => h.at.c === 3 && h.at.r === 3);
    expect(onStone.length).toBe(1);
    expect(onStone[0]).toMatchObject({ result: 'damaged', hpLeft: 1 });
  });

  it('a lamp is never destroyed, whatever hits it', () => {
    const t = audit(['~  ~  ~  ~  ~', 'D- L  ~  E* ~', '~  ~  ~  ~  ~', '~  ~  ~  ~  ~']);
    const lampId = pieceAt(t.snap, 1, 1)?.id;
    const res = t.hammer(at(0, 1));
    const hitsOnLamp = clearsOf(res).flatMap((c) => c.hits).filter((h) => h.pieceId === lampId);
    expect(hitsOnLamp.length).toBeGreaterThan(0);
    expect(hitsOnLamp.every((h) => h.result === 'none' && h.kind === 'lamp')).toBe(true);
    expect(res.snapshot.cells.some((cell) => cell.piece?.id === lampId)).toBe(true);
    // a hammer on a lamp has nothing to hit: refused, booster not used
    const lampCell = res.snapshot.cells.findIndex((cell) => cell.piece?.id === lampId);
    const before = t.snap;
    const refused = t.hammer(at(lampCell % 5, Math.floor(lampCell / 5)));
    expectUnchanged(before, refused);
    expect(refused.steps).toEqual([]);
  });
});
