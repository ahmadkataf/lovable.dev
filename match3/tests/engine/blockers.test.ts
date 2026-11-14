import { describe, expect, it, vi } from 'vitest';
import { applySteps, type Hit, type Pos, type Step } from '../../src/engine/index.ts';
import { P, board, cellOf, checkTurn, pieceOf, stepTypes, stepsOf } from './helpers.ts';

// Generous: these tests are fast, but the suite must not fail because the machine is busy with other work.
vi.setConfig({ testTimeout: 120_000 });

// DESIGN §2.5 (what a hit does, adjacent damage) and §2.7 (vines).

type Clear = Extract<Step, { type: 'clear' }>;
const key = (p: Pos): string => `${p.c},${p.r}`;
const summary = (hits: Hit[]): string[] => hits.map((h) => `${key(h.at)}:${h.kind}:${h.cause}:${h.result}`).sort();
const C3 = { colors: 3 };

describe('chains', () => {
  it('a chained piece inside a match is unchained and stays; the other members clear', () => {
    const g = board(['~ ~ ~ ~ ~', 'f* f ~ ~ ~', '~ ~ f ~ ~', '~ ~ ~ ~ ~'], { ...C3, goals: [{ kind: 'chain' }, { kind: 'score', target: 1e9 }] });
    const before = g.snapshot();
    const chained = pieceOf(before, 0, 1)!;
    expect(chained.chained).toBe(true);
    expect(before.goals[0]).toMatchObject({ current: 0, target: 1, done: false });
    const res = g.swap(P(2, 2), P(2, 1));
    const clear = res.steps[1] as Clear;
    expect(summary(clear.hits)).toEqual(['0,1:gem:match:unchained', '1,1:gem:match:removed', '2,1:gem:match:removed']);
    expect(clear.created).toEqual([]);
    expect(clear.score).toBe(40 + 20 + 20);
    // right after that wave the piece is still on its cell, without its chain
    const mid = applySteps(before, res.steps.slice(0, 2));
    expect(mid.cells[1 * 5 + 0]!.piece).toEqual({ ...chained, chained: false });
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a chained member does not merge: the special lands on the nearest member that leaves', () => {
    const g = board(['~ ~ ~ ~ ~ ~', '~ f f* f f ~', '~ ~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 2));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(summary(clear.hits)).toEqual(['1,1:gem:match:removed', '2,1:gem:match:unchained', '3,1:gem:match:removed', '4,1:gem:match:removed']);
    expect(clear.created).toHaveLength(1);
    expect(clear.created[0]!.at).toEqual(P(1, 1)); // the run's second cell is chained → nearest free member
    expect(clear.created[0]!.piece.kind).toBe('beamV');
    expect(clear.created[0]!.from.map(key).sort()).toEqual(['1,1', '3,1', '4,1']);
    expect(clear.score).toBe(3 * 20 + 40 + 60);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('a group of chained pieces only loses its chains; it clears in the next wave', () => {
    const g = board(['~ ~ ~ ~ ~', '~ f* f* f* ~', '~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 0));
    expect(stepTypes(res.steps).startsWith('booster clear clear fall clear')).toBe(true);
    const clears = stepsOf(res.steps, 'clear');
    expect(summary(clears[1]!.hits)).toEqual(['1,1:gem:match:unchained', '2,1:gem:match:unchained', '3,1:gem:match:unchained']);
    expect(clears[1]!.score).toBe(120);
    const third = clears[2]!;
    expect(third.cascade).toBe(2);
    expect(third.hits.filter((h) => h.color === 5).map((h) => h.result)).toEqual(['removed', 'removed', 'removed']);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('a blast breaks a chain but does not remove or fire the piece', () => {
    const g = board(['~ ~ ~ ~ ~', 'fH ~ eN* ~ d*', '~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 1));
    const blast = stepsOf(res.steps, 'clear')[1]!;
    expect(summary(blast.hits)).toEqual(['1,1:gem:blast:removed', '2,1:nova:blast:unchained', '3,1:gem:blast:removed', '4,1:gem:blast:unchained']);
    // the nova did not fire: the only effect before the first fall is the beam
    const firstFall = res.steps.findIndex((s) => s.type === 'fall');
    expect(res.steps.slice(0, firstFall).filter((s) => s.type === 'activate')).toHaveLength(1);
    checkTurn(g, before, res, 'booster', undefined, false);
  });
});

describe('stones and adjacent damage', () => {
  it('stones next to a match lose one layer each', () => {
    const g = board(['~ ~ ~ ~ ~', '~ f f ~ ~', '~ 2 3 f ~', '~ ~ 1 ~ ~'], { ...C3, goals: [{ kind: 'stone' }, { kind: 'score', target: 1e9 }] });
    const before = g.snapshot();
    expect(before.goals[0]).toMatchObject({ current: 0, target: 3 });
    const res = g.swap(P(3, 2), P(3, 1));
    const clear = res.steps[1] as Clear;
    expect(summary(clear.hits)).toEqual([
      '1,1:gem:match:removed',
      '1,2:stone:adjacent:damaged',
      '2,1:gem:match:removed',
      '2,2:stone:adjacent:damaged',
      '3,1:gem:match:removed',
    ]);
    expect(clear.hits.find((h) => h.at.c === 1 && h.at.r === 2)!.hpLeft).toBe(1);
    expect(clear.hits.find((h) => h.at.c === 2 && h.at.r === 2)!.hpLeft).toBe(2);
    expect(clear.score).toBe(60 + 40 + 40);
    // the stone at (2,3) is not adjacent to the match
    const mid = applySteps(before, res.steps.slice(0, 2));
    expect(mid.cells[3 * 5 + 2]!.piece).toMatchObject({ kind: 'stone', hp: 1 });
    expect(mid.cells[2 * 5 + 1]!.piece).toMatchObject({ kind: 'stone', hp: 1 });
    expect(mid.cells[2 * 5 + 2]!.piece).toMatchObject({ kind: 'stone', hp: 2 });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a one-layer stone is removed and counts for the stone goal', () => {
    const g = board(['~ ~ ~ ~', '~ f f 1', 'f ~ ~ ~', '~ ~ ~ ~'], { ...C3, goals: [{ kind: 'stone' }] });
    const before = g.snapshot();
    expect(before.status).toBe('playing');
    const res = g.swap(P(0, 2), P(0, 1));
    const clear = res.steps[1] as Clear;
    expect(summary(clear.hits)).toContain('3,1:stone:adjacent:removed');
    expect(clear.hits.find((h) => h.kind === 'stone')!.hpLeft).toBeUndefined();
    expect(clear.score).toBe(60 + 40);
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    expect(res.snapshot.status).toBe('won');
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a blocker touching two cells of one group is hit once', () => {
    const g = board(['~ ~ f ~', '~ 2 f ~', 'f f ~ ~', '~ ~ f ~'], C3);
    const res = g.swap(P(2, 3), P(2, 2));
    const clear = res.steps[1] as Clear;
    const stoneHits = clear.hits.filter((h) => h.kind === 'stone');
    expect(stoneHits).toHaveLength(1);
    expect(stoneHits[0]).toMatchObject({ at: P(1, 1), cause: 'adjacent', result: 'damaged', hpLeft: 1 });
  });

  it('a blocker touching two groups of the same wave is hit once', () => {
    const g = board(['~ ~ ~ ~', 'f f f ~', '~ 3 ~ ~', 'e e e ~', '~ ~ ~ ~'], C3);
    const res = g.useBooster('hammer', P(3, 0));
    const clear = stepsOf(res.steps, 'clear')[1]!;
    expect(clear.popups).toHaveLength(2);
    const stoneHits = clear.hits.filter((h) => h.kind === 'stone');
    expect(stoneHits).toHaveLength(1);
    expect(stoneHits[0]).toMatchObject({ at: P(1, 2), result: 'damaged', hpLeft: 2 });
    // the 40 points belong to exactly one of the two groups
    expect(clear.popups.map((p) => p.value).sort((x, y) => x - y)).toEqual([60, 100]);
    expect(clear.score).toBe(160);
  });

  it('blasts hit cells directly and cause no adjacent damage', () => {
    const g = board(['~ 3 ~ ~', 'fH ~ ~ 2', '~ 3 ~ ~'], C3);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 1));
    const blast = stepsOf(res.steps, 'clear')[1]!;
    expect(summary(blast.hits)).toEqual(['1,1:gem:blast:removed', '2,1:gem:blast:removed', '3,1:stone:blast:damaged']);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('stones never move and are never swapped', () => {
    const g = board(['~ ~ ~', '~ 3 ~', '~ f ~', '~ f ~', 'f ~ ~'], C3);
    const stone = pieceOf(g.snapshot(), 1, 1)!;
    const res = g.swap(P(0, 4), P(1, 4));
    expect(res.accepted).toBe(true);
    const now = pieceOf(res.snapshot, 1, 1)!;
    expect(now.id).toBe(stone.id);
    expect(now.hp).toBe(2); // adjacent to the match below it
    for (const fall of stepsOf(res.steps, 'fall')) expect(fall.moves.some((m) => m.id === stone.id)).toBe(false);
  });
});

describe('sand', () => {
  it('a cleared cell loses one sand layer (also the cell where the special appears)', () => {
    const g = board(['~ ~ ~ ~ ~ ~', '~ f f ~ f ~', '~ ~ ~ f ~ ~', '~ ~ ~ ~ ~ ~'], {
      ...C3,
      floor: ['000000', '021200', '000000', '000000'],
      goals: [{ kind: 'sand' }, { kind: 'score', target: 1e9 }],
    });
    const before = g.snapshot();
    expect(before.goals[0]).toMatchObject({ current: 0, target: 5 });
    const res = g.swap(P(3, 2), P(3, 1));
    const clear = res.steps[1] as Clear;
    const sand = new Map(clear.hits.map((h) => [key(h.at), h.sandLeft]));
    expect(sand.get('1,1')).toBe(1);
    expect(sand.get('2,1')).toBe(0);
    expect(sand.get('3,1')).toBe(1); // the beam is created here; the cell was still cleared
    expect(sand.get('4,1')).toBeUndefined();
    expect(clear.score).toBe(4 * 20 + 60 + 3 * 40);
    expect(cellOf(res.snapshot, 1, 1).sand).toBe(1);
    expect(cellOf(res.snapshot, 2, 1).sand).toBe(0);
    expect(res.snapshot.goals[0]).toMatchObject({ current: 3, target: 5, done: false });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('sand under a stone or a vine is protected: the blocker absorbs the hit', () => {
    const g = board(['~ ~ ~ ~ ~', '~ f f ~ ~', '~ 1 v f ~', '~ ~ ~ ~ ~'], { ...C3, floor: ['00000', '00000', '02200', '00000'] });
    const before = g.snapshot();
    const res = g.swap(P(3, 2), P(3, 1));
    const clear = res.steps[1] as Clear;
    const stoneHit = clear.hits.find((h) => h.kind === 'stone')!;
    const vineHit = clear.hits.find((h) => h.kind === 'vine')!;
    expect(stoneHit).toMatchObject({ result: 'removed', cause: 'adjacent' });
    expect(vineHit).toMatchObject({ result: 'removed', cause: 'adjacent' });
    expect(stoneHit.sandLeft).toBeUndefined();
    expect(vineHit.sandLeft).toBeUndefined();
    expect(clear.score).toBe(60 + 40 + 40);
    const mid = applySteps(before, res.steps.slice(0, 2));
    expect(mid.cells[2 * 5 + 1]).toMatchObject({ piece: null, sand: 2 });
    expect(mid.cells[2 * 5 + 2]).toMatchObject({ piece: null, sand: 2 });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a hit on a chained piece or a lamp still reaches the sand under it', () => {
    const g = board(['~ ~ ~ ~ ~', 'fH e* L ~ ~', '~ ~ ~ ~ ~'], { ...C3, floor: ['00000', '02100', '00000'] });
    const res = g.useBooster('hammer', P(0, 1));
    const blast = stepsOf(res.steps, 'clear')[1]!;
    expect(blast.hits.find((h) => h.at.c === 1)).toMatchObject({ result: 'unchained', sandLeft: 1 });
    expect(blast.hits.find((h) => h.at.c === 2)).toMatchObject({ kind: 'lamp', result: 'none', sandLeft: 0 });
    expect(blast.score).toBe(40 + 40 + 40 + 20 + 20);
  });

  it('clearing the last sand layer wins a sand level', () => {
    const g = board(['~ ~ ~ ~ ~', '~ f f ~ ~', '~ ~ ~ f ~', '~ ~ ~ ~ ~'], { ...C3, floor: ['00000', '01000', '00000', '00000'], goals: [{ kind: 'sand' }] });
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    expect(res.snapshot.status).toBe('won');
    expect(res.snapshot.cells.every((c) => c.sand === 0)).toBe(true);
  });
});

describe('vines', () => {
  it('a vine next to a match is cut and counts for the vine goal', () => {
    const g = board(['~ ~ ~ ~ ~', '~ f f ~ v', '~ ~ ~ f ~', 'v ~ ~ ~ ~'], { ...C3, goals: [{ kind: 'vine' }, { kind: 'score', target: 1e9 }] });
    const before = g.snapshot();
    expect(before.goals[0]).toMatchObject({ current: 0, target: 2 });
    const res = g.swap(P(3, 2), P(3, 1));
    const clear = res.steps[1] as Clear;
    expect(summary(clear.hits)).toContain('4,1:vine:adjacent:removed');
    expect(clear.score).toBe(60 + 40);
    // a vine was cut this turn: the other one does not spread
    expect(stepsOf(res.steps, 'grow')).toEqual([]);
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 2 });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('when no vine was cut, one vine spreads onto an adjacent plain gem after the board settles', () => {
    const g = board(['~ ~ ~ ~ ~', '~ f f ~ ~', '~ ~ ~ f ~', '~ ~ ~ ~ v'], { ...C3, goals: [{ kind: 'vine' }, { kind: 'score', target: 1e9 }] });
    const before = g.snapshot();
    const res = g.swap(P(3, 2), P(3, 1));
    const grows = stepsOf(res.steps, 'grow');
    expect(grows).toHaveLength(1);
    const grow = grows[0]!;
    expect(grow.from).toEqual(P(4, 3));
    expect(['3,3', '4,2']).toContain(key(grow.at));
    expect(grow.piece).toMatchObject({ kind: 'vine', color: -1, hp: 1, chained: false });
    expect(before.cells.some((c) => c.piece?.id === grow.piece.id)).toBe(false);
    expect(typeof grow.replacedId).toBe('number');
    // the grow step comes after every clear / fall of the turn
    const idx = res.steps.indexOf(grow);
    expect(res.steps.slice(idx + 1).every((s) => s.type === 'shuffle' || s.type === 'transform' || s.type === 'status')).toBe(true);
    expect(res.snapshot.cells.filter((c) => c.piece?.kind === 'vine')).toHaveLength(2);
    expect(pieceOf(res.snapshot, grow.at.c, grow.at.r)).toEqual(grow.piece);
    // the goal target is counted from the initial board and does not grow with the vines
    expect(res.snapshot.goals[0]).toMatchObject({ current: 0, target: 1 });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('vines never spread onto specials, lamps, stones or chained pieces', () => {
    const g = board(['fH v L ~ ~ ~', '~ e* ~ ~ ~ ~', '~ ~ ~ f f ~', '2 ~ ~ ~ ~ f', 'v dN ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const res = g.swap(P(5, 3), P(5, 2));
    expect(res.accepted).toBe(true);
    expect(stepsOf(res.steps, 'grow')).toEqual([]);
    expect(res.snapshot.cells.filter((c) => c.piece?.kind === 'vine')).toHaveLength(2);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('boosters are not moves: vines do not spread after them', () => {
    const g = board(['~ ~ ~ ~', '~ ~ ~ ~', '~ ~ ~ v'], C3);
    const res = g.useBooster('hammer', P(0, 0));
    expect(res.accepted).toBe(true);
    expect(stepsOf(res.steps, 'grow')).toEqual([]);
  });

  it('vines keep spreading turn after turn while they are left alone, one per turn', () => {
    const g = board(
      ['~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ ~ ~', 'v ~ ~ ~ ~ ~ ~'],
      { colors: 5, keep: false, seed: 4 },
    );
    let vines = 1;
    for (let turn = 0; turn < 12; turn++) {
      const before = g.snapshot();
      const move = g.validMoves()[0]!;
      const res = g.swap(move.a, move.b);
      const cut = stepsOf(res.steps, 'clear').flatMap((c) => c.hits).filter((h) => h.kind === 'vine').length;
      const grown = stepsOf(res.steps, 'grow').length;
      expect(grown).toBeLessThanOrEqual(1);
      if (cut > 0) expect(grown).toBe(0);
      vines += grown - cut;
      expect(res.snapshot.cells.filter((c) => c.piece?.kind === 'vine')).toHaveLength(vines);
      checkTurn(g, before, res, 'swap', undefined, false);
      if (vines === 0) break;
    }
  });
});
