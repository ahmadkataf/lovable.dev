import { describe, expect, it, vi } from 'vitest';
import { Game, type LevelDef, type Snapshot } from '../../src/engine/index.ts';
import { P, board, checkTurn, picture, playRandomGame, refHasMatch, refValidMoves, stepTypes, stepsOf } from './helpers.ts';

// Generous: these tests are fast, but the suite must not fail because the machine is busy with other work.
vi.setConfig({ testTimeout: 120_000 });

// DESIGN §2.9 (goals, winning, losing, end bonus), §2.8 (shuffles), §2.11 (start boosters),
// §2.12 (determinism), plus hint().

const C3 = { colors: 3 };
const twoMatches = ['~ ~ ~ ~ ~ ~', '~ f f ~ ~ ~', '~ ~ ~ f ~ ~', '~ e e ~ ~ ~', '~ ~ ~ e ~ ~'];
const colourCounts = (s: Snapshot): number[] => {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const cell of s.cells) if (cell.piece && cell.piece.color >= 0) counts[cell.piece.color]!++;
  return counts;
};
const idsOf = (s: Snapshot): number[] => s.cells.filter((c) => c.piece).map((c) => c.piece!.id).sort((a, b) => a - b);

describe('goals and status', () => {
  it('a score-only level is decided only when the moves run out — won', () => {
    const g = board(twoMatches, { ...C3, moves: 2, goals: [{ kind: 'score', target: 60 }], stars: [60, 100000, 200000] });
    const first = g.swap(P(3, 2), P(3, 1));
    expect(first.snapshot.score).toBeGreaterThanOrEqual(60);
    expect(first.snapshot.goals[0]).toMatchObject({ current: 60, target: 60, done: true }); // capped at the target
    expect(first.snapshot.status).toBe('playing');
    expect(first.snapshot.stars).toBeGreaterThanOrEqual(1);
    expect(first.steps.some((s) => s.type === 'status')).toBe(false);
    const before = g.snapshot();
    const move = g.validMoves()[0]!;
    const second = g.swap(move.a, move.b);
    expect(second.snapshot.movesLeft).toBe(0);
    expect(second.snapshot.status).toBe('won');
    expect(second.steps[second.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    checkTurn(g, before, second, 'swap', undefined, false);
  });

  it('a score-only level that misses its target is lost; addMoves() resumes it', () => {
    const g = board(twoMatches, { ...C3, moves: 1, goals: [{ kind: 'score', target: 500000 }], stars: [500000, 600000, 700000] });
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.snapshot.status).toBe('lost');
    expect(res.snapshot.stars).toBe(0);
    expect(res.snapshot.canContinue).toBe(true);
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'lost' });
    for (const bad of [0, -2, 1.5, Number.NaN]) expect(g.addMoves(bad).accepted).toBe(false);
    const before = g.snapshot();
    const more = g.addMoves(3);
    expect(more.accepted).toBe(true);
    expect(more.steps).toEqual([{ type: 'status', status: 'playing' }]);
    expect(more.snapshot.movesLeft).toBe(3);
    expect(more.snapshot.status).toBe('playing');
    expect('canContinue' in more.snapshot).toBe(false); // only present while lost
    expect(more.snapshot.cells).toEqual(before.cells);
    expect(g.validMoves().length).toBeGreaterThan(0);
    // and it can be lost again
    for (let k = 0; k < 3; k++) {
      const move = g.validMoves()[0]!;
      g.swap(move.a, move.b);
    }
    expect(g.snapshot().status).toBe('lost');
  });

  it('a level with other goals is won as soon as they are all done, with moves left', () => {
    const g = board(twoMatches, { ...C3, moves: 5, goals: [{ kind: 'color', color: 5, target: 3 }], stars: [50, 5000, 9000] });
    const before = g.snapshot();
    expect(before.goals).toEqual([{ goal: { kind: 'color', color: 5, target: 3 }, current: 0, target: 3, done: false }]);
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.snapshot.goals[0]).toMatchObject({ current: 3, done: true });
    expect(res.snapshot.status).toBe('won');
    expect(res.snapshot.movesLeft).toBe(4);
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('colour goals count every way of clearing that colour, specials included', () => {
    const g = board(['~ ~ ~ ~ ~ ~', '~ fH f ~ f ~', '~ ~ ~ f ~ ~', '~ ~ ~ ~ ~ ~'], {
      ...C3,
      goals: [{ kind: 'color', color: 5, target: 50 }, { kind: 'score', target: 1e9 }],
    });
    const res = g.swap(P(3, 2), P(3, 1));
    // three gems and the beam itself; the newly made beam is still on the board
    expect(res.snapshot.goals[0]).toMatchObject({ current: 4, target: 50 });
  });

  it('several goals: all must be done; a mixed score goal is checked together with the others', () => {
    const g = board(twoMatches, {
      ...C3,
      moves: 6,
      goals: [
        { kind: 'color', color: 5, target: 3 },
        { kind: 'color', color: 4, target: 3 },
        { kind: 'score', target: 100 },
      ],
      stars: [100, 5000, 9000],
    });
    const first = g.swap(P(3, 2), P(3, 1));
    expect(first.snapshot.status).toBe('playing');
    expect(first.snapshot.goals.map((x) => x.done)).toEqual([true, false, false]);
    expect(g.canSwap(P(3, 4), P(3, 3))).toBe(true);
    const second = g.swap(P(3, 4), P(3, 3));
    expect(second.snapshot.goals.map((x) => x.done)).toEqual([true, true, true]);
    expect(second.snapshot.status).toBe('won');
    expect(second.snapshot.movesLeft).toBe(4);
  });

  it('out of moves with goals unmet is lost — after the turn has fully settled', () => {
    const g = board(twoMatches, { ...C3, moves: 1, goals: [{ kind: 'color', color: 4, target: 3 }] });
    const before = g.snapshot();
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.snapshot.status).toBe('lost');
    expect(res.snapshot.movesLeft).toBe(0);
    expect(res.steps.filter((s) => s.type === 'status')).toEqual([{ type: 'status', status: 'lost' }]);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('the last move can still win', () => {
    const g = board(twoMatches, { ...C3, moves: 1, goals: [{ kind: 'color', color: 5, target: 3 }] });
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.snapshot.movesLeft).toBe(0);
    expect(res.snapshot.status).toBe('won');
  });

  it('stars follow the score; a won level has at least one', () => {
    const g = board(twoMatches, { ...C3, moves: 5, goals: [{ kind: 'color', color: 5, target: 3 }], stars: [100000, 200000, 300000] });
    expect(g.snapshot().stars).toBe(0);
    const res = g.swap(P(3, 2), P(3, 1));
    expect(res.snapshot.status).toBe('won');
    expect(res.snapshot.score).toBeLessThan(100000);
    expect(res.snapshot.stars).toBe(1);
    const h = board(twoMatches, { ...C3, moves: 5, stars: [50, 55, 60] });
    expect(h.swap(P(3, 2), P(3, 1)).snapshot.stars).toBe(3);
  });

  it('calls in the wrong status are refused and change nothing', () => {
    // playing: addMoves / endBonus are refused
    const g = board(twoMatches, { ...C3, moves: 1, goals: [{ kind: 'color', color: 4, target: 3 }] });
    let before = g.snapshot();
    for (const res of [g.addMoves(5), g.endBonus()]) {
      expect(res.accepted).toBe(false);
      expect(res.steps).toEqual([]);
      expect(res.snapshot).toEqual(before);
    }
    // lost: everything but addMoves is refused
    g.swap(P(3, 2), P(3, 1));
    before = g.snapshot();
    expect(before.status).toBe('lost');
    expect(g.canSwap(P(3, 4), P(3, 3))).toBe(false);
    expect(g.validMoves()).toEqual([]);
    expect(g.hint()).toBeNull();
    for (const res of [
      g.swap(P(3, 4), P(3, 3)),
      g.useBooster('hammer', P(0, 0)),
      g.useBooster('freeSwap', P(0, 0), P(1, 0)),
      g.useBooster('shuffle'),
      g.endBonus(),
    ]) {
      expect(res.accepted).toBe(false);
      expect(res.steps).toEqual([]);
      expect(res.snapshot).toEqual(before);
    }
    expect(g.snapshot()).toEqual(before);

    // won: everything but endBonus is refused
    const w = board(twoMatches, { ...C3, moves: 5, goals: [{ kind: 'color', color: 5, target: 3 }] });
    w.swap(P(3, 2), P(3, 1));
    before = w.snapshot();
    expect(before.status).toBe('won');
    for (const res of [w.swap(P(3, 4), P(3, 3)), w.useBooster('hammer', P(0, 0)), w.useBooster('shuffle'), w.addMoves(5)]) {
      expect(res.accepted).toBe(false);
      expect(res.steps).toEqual([]);
      expect(res.snapshot).toEqual(before);
    }
  });
});

describe('end bonus', () => {
  it('turns each remaining move into a beam (250 points each), then fires every special until the board is calm', () => {
    const g = board(twoMatches, { ...C3, moves: 5, goals: [{ kind: 'color', color: 5, target: 3 }], stars: [50, 5000, 9000] });
    g.swap(P(3, 2), P(3, 1));
    const before = g.snapshot();
    expect(before.movesLeft).toBe(4);
    const res = g.endBonus();
    expect(res.accepted).toBe(true);
    expect(stepTypes(res.steps).startsWith('transform activate clear')).toBe(true);
    const transform = stepsOf(res.steps, 'transform')[0]!;
    expect(transform.reason).toBe('endBonus');
    expect(transform.score).toBe(4 * 250);
    expect(transform.changes).toHaveLength(4);
    const seen = new Set<number>();
    for (const change of transform.changes) {
      const old = before.cells[change.at.r * before.cols + change.at.c]!.piece!;
      expect(old.kind).toBe('gem');
      expect(old.chained).toBe(false);
      expect(change.piece).toEqual({ ...old, kind: change.piece.kind });
      expect(['beamH', 'beamV']).toContain(change.piece.kind);
      seen.add(old.id);
    }
    expect(seen.size).toBe(4);
    // the first activate fires exactly the four new beams
    const fx = stepsOf(res.steps, 'activate')[0]!.fx;
    expect(fx.map((f) => `${f.at.c},${f.at.r}`).sort()).toEqual(transform.changes.map((c) => `${c.at.c},${c.at.r}`).sort());
    const firstClear = stepsOf(res.steps, 'clear')[0]!;
    for (const change of transform.changes) {
      expect(firstClear.hits.find((h) => h.pieceId === change.piece.id)).toMatchObject({ result: 'activated' });
    }
    const after = res.snapshot;
    expect(after.movesLeft).toBe(0);
    expect(after.status).toBe('won');
    expect(res.steps.some((s) => s.type === 'status')).toBe(false);
    expect(after.score).toBeGreaterThanOrEqual(before.score + 1000 + 4 * 20);
    // nothing left to fire, nothing left to match
    expect(after.cells.some((c) => c.piece && !c.piece.chained && ['beamH', 'beamV', 'nova', 'prism'].includes(c.piece.kind))).toBe(false);
    expect(refHasMatch(after)).toBe(false);
    checkTurn(g, before, res, 'endBonus', undefined, false);
    // only once
    const again = g.endBonus();
    expect(again.accepted).toBe(false);
    expect(again.snapshot).toEqual(after);
  });

  it('with no moves left it still fires the specials that are on the board', () => {
    const g = board(['~ ~ ~ ~ ~ ~', '~ f f ~ ~ ~', '~ ~ ~ f ~ ~', '~ ~ ~ ~ ~ ~', '~ ~ ~ ~ ~ dN', 'P ~ ~ ~ ~ ~'], {
      ...C3,
      moves: 1,
      goals: [{ kind: 'color', color: 5, target: 3 }],
    });
    const won = g.swap(P(3, 2), P(3, 1));
    expect(won.snapshot.status).toBe('won');
    expect(won.snapshot.movesLeft).toBe(0);
    const specials = won.snapshot.cells.filter((c) => c.piece && (c.piece.kind === 'nova' || c.piece.kind === 'prism')).length;
    expect(specials).toBeGreaterThanOrEqual(2);
    const before = g.snapshot();
    const res = g.endBonus();
    expect(res.accepted).toBe(true);
    expect(stepsOf(res.steps, 'transform')).toEqual([]);
    expect(stepsOf(res.steps, 'activate')[0]!.fx.map((f) => f.kind).sort()).toContain('nova');
    expect(stepsOf(res.steps, 'activate')[0]!.fx.map((f) => f.kind)).toContain('prism');
    expect(res.snapshot.score).toBeGreaterThan(before.score);
    checkTurn(g, before, res, 'endBonus', undefined, false);
  });

  it('pays every remaining move even when there are fewer plain gems than moves', () => {
    const g = board(['3 3 3 3', 'f f ~ f', '3 3 f 3'], { colors: 3, moves: 9, goals: [{ kind: 'color', color: 5, target: 3 }] });
    const won = g.swap(P(2, 2), P(2, 1));
    expect(won.snapshot.status).toBe('won');
    const before = g.snapshot();
    const freeGems = before.cells.filter((c) => c.piece?.kind === 'gem' && !c.piece.chained).length;
    expect(freeGems).toBeLessThan(8);
    const res = g.endBonus();
    const transform = stepsOf(res.steps, 'transform')[0]!;
    expect(transform.score).toBe(8 * 250);
    expect(transform.changes).toHaveLength(freeGems);
    expect(res.snapshot.movesLeft).toBe(0);
    checkTurn(g, before, res, 'endBonus', undefined, false);
  });
});

describe('shuffles (§2.8)', () => {
  it('when a turn leaves no valid move the free gems are rearranged: same pieces, no match, a move exists', () => {
    const g = board(['~ ~ ~ ~ ~', '~ ~ 3 ~ fH', '~ e* ~ ~ ~', '~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    expect(refValidMoves(before)).toEqual([]);
    const res = g.useBooster('hammer', P(2, 1));
    expect(stepTypes(res.steps)).toBe('booster clear shuffle');
    const shuffle = stepsOf(res.steps, 'shuffle')[0]!;
    expect(shuffle.moves.length).toBeGreaterThan(1);
    const after = res.snapshot;
    expect(after.status).toBe('playing');
    expect(refHasMatch(after)).toBe(false);
    expect(refValidMoves(after).length).toBeGreaterThan(0);
    expect(idsOf(after)).toEqual(idsOf(before));
    expect(colourCounts(after)).toEqual(colourCounts(before));
    // only free gems move: the stone, the chained gem and the beam stay put
    for (const m of shuffle.moves) {
      const piece = before.cells[m.from.r * before.cols + m.from.c]!.piece!;
      expect(piece.id).toBe(m.id);
      expect(piece.kind).toBe('gem');
      expect(piece.chained).toBe(false);
    }
    expect(picture(after)[1]!.split(' ')[2]).toBe('2');
    expect(picture(after)[1]!.split(' ')[4]).toBe('fH');
    expect(picture(after)[2]!.split(' ')[1]).toBe('e*');
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('when no rearrangement can work the gems are recoloured in place (shuffle + transform "recolor")', () => {
    const g = board(['3 3 3 3 3', '3 a b d 3', '3 3 e 3 3', '3 3 3 3 3']);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 0));
    expect(stepTypes(res.steps)).toBe('booster clear shuffle transform');
    expect(stepsOf(res.steps, 'shuffle')[0]!.moves).toEqual([]);
    const transform = stepsOf(res.steps, 'transform')[0]!;
    expect(transform.reason).toBe('recolor');
    expect(transform.score).toBe(0);
    expect(transform.changes).toHaveLength(2); // two of the three gems of the planted move change
    for (const change of transform.changes) {
      const old = before.cells[change.at.r * before.cols + change.at.c]!.piece!;
      expect(change.piece.id).toBe(old.id);
      expect(change.piece.kind).toBe('gem');
      expect(change.piece.color).not.toBe(old.color);
    }
    const after = res.snapshot;
    expect(after.status).toBe('playing');
    expect(refHasMatch(after)).toBe(false);
    // the only possible move on this board: the bottom gem steps up between the other two
    expect(refValidMoves(after)).toEqual(['2,1-2,2']);
    expect(g.canSwap(P(2, 2), P(2, 1))).toBe(true);
    expect(idsOf(after)).toEqual(idsOf(before));
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('recolouring respects pieces whose colour is fixed (specials, chained gems)', () => {
    const g = board(['3 3 3 3 3', '3 aH b d* 3', '3 3 e 3 3', '3 3 3 3 3']);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 0));
    // aH and d* cannot both be part of the planted move, so nothing can ever match here
    expect(res.snapshot.status).toBe('lost');
    expect(res.snapshot.cells).toEqual(g.snapshot().cells);
    expect(stepsOf(res.steps, 'transform')).toEqual([]);
    checkTurn(g, before, res, 'booster', undefined, false);

    const h = board(['3 3 3 3 3', '3 aH b a* 3', '3 3 e 3 3', '3 3 3 3 3']);
    const res2 = h.useBooster('hammer', P(0, 0));
    expect(res2.snapshot.status).toBe('playing');
    // only the one gem that has to change is recoloured — to the colour the fixed pieces dictate
    const change = stepsOf(res2.steps, 'transform')[0]!.changes;
    expect(change.map((c) => [c.at, c.piece.color])).toEqual([[P(2, 2), 0]]);
    expect(h.canSwap(P(2, 2), P(2, 1))).toBe(true);
  });

  it('a board on which no move can ever exist ends the level as lost (never loops); addMoves cannot resume it', () => {
    const g = board(['3 3 3', '3 a 3', '3 3 3']);
    const before = g.snapshot();
    const res = g.useBooster('hammer', P(0, 0));
    expect(stepTypes(res.steps)).toBe('booster clear status');
    expect(res.snapshot.status).toBe('lost');
    expect(res.snapshot.canContinue).toBe(false); // the lose dialog must not offer a continue
    expect(res.snapshot.movesLeft).toBe(before.movesLeft);
    checkTurn(g, before, res, 'booster', undefined, false);
    const lost = g.snapshot();
    const more = g.addMoves(5);
    expect(more.accepted).toBe(false);
    expect(more.snapshot).toEqual(lost);
  });

  it('a score-only level whose board dies is decided on the spot: won if the target is reached', () => {
    // after d d d clears, two gems are left under a wall — no move can ever exist again
    const rows = ['3 3 3 3 3', 'd d ~ d ~'];
    const won = board(rows, { colors: 3, moves: 5, goals: [{ kind: 'score', target: 60 }], stars: [60, 600, 6000] });
    const a = won.swap(P(3, 1), P(2, 1));
    expect(a.snapshot.score).toBe(60 + 3 * 40); // the match also chips the three stones above it
    expect(a.snapshot.movesLeft).toBe(4);
    expect(a.snapshot.status).toBe('won');
    expect(a.steps[a.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
    const lost = board(rows, { colors: 3, moves: 5, goals: [{ kind: 'score', target: 500 }], stars: [500, 600, 6000] });
    const b = lost.swap(P(3, 1), P(2, 1));
    expect(b.snapshot.status).toBe('lost');
    expect(b.snapshot.movesLeft).toBe(4);
    expect(lost.addMoves(5).accepted).toBe(false);
  });

  it('the turn that uses up the last move still leaves a playable board, so addMoves() can always resume', () => {
    // Nothing can drop in under the wall. After d d d clears, the gems that are left have no
    // move (e a e c e), but a rearrangement has one — so the board is shuffled before 'lost'.
    const rows = ['3 3 3 3 3', 'd d ~ d ~', 'e a e c e'];
    for (let seed = 1; seed <= 20; seed++) {
      const g = board(rows, { colors: 3, moves: 1, goals: [{ kind: 'stone' }], seed });
      const before = g.snapshot();
      expect(before.canContinue).toBeUndefined();
      const res = g.swap(P(3, 1), P(2, 1));
      const types = stepTypes(res.steps);
      expect(types.startsWith('swap clear shuffle')).toBe(true);
      expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'lost' });
      expect(res.snapshot.status).toBe('lost');
      expect(res.snapshot.movesLeft).toBe(0);
      expect(res.snapshot.canContinue).toBe(true);
      expect(refValidMoves(res.snapshot).length).toBeGreaterThan(0);
      expect(refHasMatch(res.snapshot)).toBe(false);
      checkTurn(g, before, res, 'swap', undefined, false);
      const lost = g.snapshot();
      const more = g.addMoves(5);
      expect(more.accepted).toBe(true);
      expect(more.steps).toEqual([{ type: 'status', status: 'playing' }]); // nothing left to shuffle
      expect(more.snapshot.cells).toEqual(lost.cells);
      expect(more.snapshot.movesLeft).toBe(5);
      expect(g.validMoves().length).toBeGreaterThan(0);
    }
  });

  it('a level that starts without a valid move is shuffled before play begins', () => {
    const level: LevelDef = {
      id: 3,
      cols: 6,
      rows: 5,
      colors: 3,
      moves: 10,
      pieces: ['abCabC', 'bCabCa', 'CabCab', 'abCabC', 'bCabCa'],
      goals: [{ kind: 'score', target: 500 }],
      stars: [500, 1000, 1500],
    };
    const g = new Game(level, { seed: 5 });
    const s = g.snapshot();
    expect(s.status).toBe('playing');
    expect(refHasMatch(s)).toBe(false);
    expect(refValidMoves(s).length).toBeGreaterThan(0);
    expect(colourCounts(s)).toEqual([10, 10, 10, 0, 0, 0]);
    expect(g.hint()).not.toBeNull();
  });

  it('a level that can never have a move starts as lost instead of hanging', () => {
    const level: LevelDef = { id: 3, cols: 2, rows: 1, colors: 3, moves: 10, pieces: ['..'], goals: [{ kind: 'score', target: 500 }], stars: [500, 1000, 1500] };
    const g = new Game(level, { seed: 5 });
    expect(g.snapshot().status).toBe('lost');
    expect(g.snapshot().canContinue).toBe(false);
    expect(g.addMoves(5).accepted).toBe(false);
    expect(g.validMoves()).toEqual([]);
    expect(g.swap(P(0, 0), P(1, 0)).accepted).toBe(false);
  });
});

describe('level start and start boosters (§2.1, §2.11)', () => {
  const level: LevelDef = {
    id: 12,
    cols: 8,
    rows: 8,
    colors: 5,
    moves: 20,
    pieces: ['........', '..c..c..', '...22...', '........', '.v....v.', '........', '..H..N..', '....P...'],
    floor: ['00000000', '00000000', '00011000', '00022000', '00000000', '00000000', '00000000', '11111111'],
    goals: [{ kind: 'sand' }, { kind: 'stone' }, { kind: 'chain' }, { kind: 'vine' }],
    stars: [1000, 3000, 6000],
  };

  it('fills the board with the level colours: no match, a valid move, fixed pieces as given, goals counted', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = new Game(level, { seed }).snapshot();
      expect(s.status).toBe('playing');
      expect(s.movesLeft).toBe(20);
      expect(s.score).toBe(0);
      expect(s.stars).toBe(0);
      expect(refHasMatch(s)).toBe(false);
      expect(refValidMoves(s).length).toBeGreaterThan(0);
      const rows = picture(s);
      expect(rows[2]!.split(' ').slice(3, 5)).toEqual(['2', '2']);
      expect(rows[4]!.split(' ')[1]).toBe('v');
      expect(rows[7]!.split(' ')[4]).toBe('P');
      expect(rows[1]!.split(' ')[2]).toMatch(/^[a-e]\*$/);
      expect(rows[6]!.split(' ')[2]).toMatch(/^[a-e]H$/);
      expect(rows[6]!.split(' ')[5]).toMatch(/^[a-e]N$/);
      for (const cell of s.cells) {
        if (cell.piece && cell.piece.color >= 0) expect(cell.piece.color).toBeLessThan(5);
      }
      expect(s.goals.map((x) => [x.goal.kind, x.current, x.target, x.done])).toEqual([
        ['sand', 0, 14, false],
        ['stone', 0, 2, false],
        ['chain', 0, 2, false],
        ['vine', 0, 2, false],
      ]);
      expect(new Set(s.cells.map((c) => c.piece!.id)).size).toBe(64);
    }
  });

  it('different seeds give different boards, the same seed the same board', () => {
    const a = JSON.stringify(new Game(level, { seed: 1 }).snapshot());
    const b = JSON.stringify(new Game(level, { seed: 1 }).snapshot());
    const c = JSON.stringify(new Game(level, { seed: 2 }).snapshot());
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('extraMoves adds 3 moves; prism and beamNova turn random plain gems into specials', () => {
    const plain: LevelDef = { ...level, pieces: new Array<string>(8).fill('........'), goals: [{ kind: 'score', target: 1000 }] };
    delete plain.floor;
    const kinds = (s: Snapshot): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const cell of s.cells) out[cell.piece!.kind] = (out[cell.piece!.kind] ?? 0) + 1;
      return out;
    };
    for (let seed = 0; seed < 20; seed++) {
      const none = new Game(plain, { seed }).snapshot();
      expect(kinds(none)).toEqual({ gem: 64 });
      expect(none.movesLeft).toBe(20);

      const extra = new Game(plain, { seed, boosters: { extraMoves: true } }).snapshot();
      expect(extra.movesLeft).toBe(23);
      expect(extra.cells).toEqual(none.cells);

      const prism = new Game(plain, { seed, boosters: { prism: true } }).snapshot();
      expect(kinds(prism)).toEqual({ gem: 63, prism: 1 });
      expect(prism.cells.find((c) => c.piece!.kind === 'prism')!.piece!.color).toBe(-1);

      const both = new Game(plain, { seed, boosters: { beamNova: true } }).snapshot();
      const k = kinds(both);
      expect((k.beamH ?? 0) + (k.beamV ?? 0)).toBe(1);
      expect(k.nova).toBe(1);
      expect(k.gem).toBe(62);

      const all = new Game(plain, { seed, boosters: { extraMoves: true, prism: true, beamNova: true } }).snapshot();
      expect(kinds(all).gem).toBe(61);
      expect(all.movesLeft).toBe(23);
      for (const s of [prism, both, all]) {
        expect(refHasMatch(s)).toBe(false);
        expect(refValidMoves(s).length).toBeGreaterThan(0);
        expect(s.status).toBe('playing');
      }
    }
  });
});

describe('determinism and snapshots (§2.12)', () => {
  const level: LevelDef = {
    id: 5,
    cols: 8,
    rows: 8,
    colors: 4,
    moves: 15,
    pieces: ['........', '.c....c.', '...33...', '........', 'v......v', '........', '..L..L..', '........'],
    floor: ['00000000', '00000000', '00000000', '00122100', '00122100', '00000000', '00000000', '00000000'],
    goals: [{ kind: 'sand' }, { kind: 'lamp', target: 3 }],
    lamps: { total: 4, maxOnBoard: 2, everyMoves: 2 },
    stars: [2000, 6000, 12000],
  };

  it('same level + seed + inputs ⇒ byte-identical steps; another seed ⇒ another game', () => {
    const a = playRandomGame(level, 42, 7);
    const b = playRandomGame(level, 42, 7);
    const c = playRandomGame(level, 43, 7);
    expect(a.turns).toBeGreaterThan(10);
    expect(a.transcript).toBe(b.transcript);
    expect(JSON.stringify(a.game.snapshot())).toBe(JSON.stringify(b.game.snapshot()));
    expect(a.transcript).not.toBe(c.transcript);
  });

  it('snapshots and results are deep copies: changing them does not change the game', () => {
    const g = new Game(level, { seed: 1 });
    const s = g.snapshot();
    const copy = JSON.parse(JSON.stringify(s)) as Snapshot;
    s.cells[0]!.piece!.color = 5;
    s.cells[1]!.piece = null;
    s.cells[2]!.sand = 2;
    s.goals[0]!.current = 99;
    (s.goals[1]!.goal as { target: number }).target = 1;
    s.movesLeft = 0;
    expect(g.snapshot()).toEqual(copy);
    const move = g.validMoves()[0]!;
    move.a.c = 99;
    const fresh = g.validMoves()[0]!;
    const res = g.swap(fresh.a, fresh.b);
    const frozen = JSON.stringify(res);
    const next = g.validMoves()[0]!;
    g.swap(next.a, next.b);
    expect(JSON.stringify(res)).toBe(frozen); // an old result is not touched by later turns
    expect(level.goals).toEqual([{ kind: 'sand' }, { kind: 'lamp', target: 3 }]);
  });
});

describe('hint()', () => {
  const rows = [
    '~ ~ ~ ~ ~ ~ ~ ~ ~',
    '~ f f ~ f ~ ~ ~ ~', // run of 4 with the f from (3,2)
    '~ ~ ~ f ~ ~ e ~ ~',
    '~ ~ ~ ~ ~ ~ e ~ ~', // L with the e from (6,5)
    '~ ~ ~ ~ e e ~ ~ ~',
    '~ ~ ~ ~ ~ ~ e ~ ~',
    '~ d d ~ ~ ~ ~ ~ ~', // plain 3 with the d from (3,7)
    '~ ~ ~ d ~ ~ ~ ~ ~',
    '~ ~ ~ ~ ~ ~ ~ ~ ~',
  ];
  const withCell = (source: string[], c: number, r: number, token: string): string[] => {
    const copy = source.slice();
    const cells = copy[r]!.split(' ');
    cells[c] = token;
    copy[r] = cells.join(' ');
    return copy;
  };

  /** The same board without the shapes of one colour. */
  const without = (source: string[], letter: string): string[] => source.map((row) => row.split(' ').map((t) => (t.startsWith(letter) ? '~' : t)).join(' '));

  it('prefers the move that makes the best special: prism > nova > beam > plain match', () => {
    // nova (L) beats beam (4) beats plain 3
    expect(board(rows, C3).hint()).toEqual({ a: P(6, 5), b: P(6, 4) });
    expect(board(without(rows, 'e'), C3).hint()).toEqual({ a: P(3, 2), b: P(3, 1) });
    expect(board(without(without(rows, 'e'), 'f'), C3).hint()).toEqual({ a: P(3, 7), b: P(3, 6) });
    // a run of 5 beats the L
    const five = withCell(rows, 5, 1, 'f');
    expect(board(five, C3).hint()).toEqual({ a: P(3, 2), b: P(3, 1) });
    // the hint names the piece to drag first: dragging it must be the same move
    const g = board(rows, C3);
    const hint = g.hint()!;
    expect(g.canSwap(hint.a, hint.b)).toBe(true);
  });

  it('prefers combos: prism combos > special + special > any match', () => {
    const five = withCell(rows, 5, 1, 'f');
    const beams = withCell(withCell(five, 0, 8, 'dH'), 1, 8, 'eV');
    expect(board(beams, C3).hint()).toEqual({ a: P(0, 8), b: P(1, 8) });
    const prism = withCell(beams, 8, 8, 'P');
    const hint = board(prism, C3).hint()!;
    expect([hint.a, hint.b]).toContainEqual(P(8, 8));
  });

  it('ranks the combos themselves', () => {
    const hintOf = (row: string) => board(['~ ~ ~ ~ ~ ~', row, '~ ~ ~ ~ ~ ~'], C3).hint();
    expect(hintOf('eN P P fH ~ ~')).toEqual({ a: P(1, 1), b: P(2, 1) }); // prism + prism
    expect(hintOf('eN P d fH ~ ~')).toEqual({ a: P(0, 1), b: P(1, 1) }); // prism + nova
    expect(hintOf('~ dH P eN ~ ~')).toEqual({ a: P(2, 1), b: P(3, 1) }); // prism + nova over prism + beam
    expect(hintOf('d P fH ~ ~ ~')).toEqual({ a: P(1, 1), b: P(2, 1) }); // prism + beam over prism + gem
    expect(hintOf('fN eN dH eV ~ ~')).toEqual({ a: P(0, 1), b: P(1, 1) }); // nova + nova
    expect(hintOf('~ eN dH eV ~ ~')).toEqual({ a: P(1, 1), b: P(2, 1) }); // nova + beam over beam + beam
    expect(hintOf('~ ~ dH eV ~ ~')).toEqual({ a: P(2, 1), b: P(3, 1) });
  });

  it('with a prism and only gems around, it picks the colour with the most pieces', () => {
    const g = board(['d e d', 'e P e', 'd f d', 'e d e']);
    // neighbours of the prism: e (5 on the board), e, e, f (1) → an e
    const hint = g.hint()!;
    expect([hint.a, hint.b]).toContainEqual(P(1, 1));
    const other = hint.a.c === 1 && hint.a.r === 1 ? hint.b : hint.a;
    expect(other).not.toEqual(P(1, 2));
  });

  it('among plain matches prefers the one that clears most, then the first in reading order', () => {
    const twoGroups = ['~ ~ ~ ~ ~', 'f f e ~ ~', 'e e f ~ ~', '~ ~ ~ ~ ~', 'd d ~ ~ ~', '~ ~ d ~ ~'];
    const hint = board(twoGroups, C3).hint()!;
    expect([hint.a, hint.b]).toContainEqual(P(2, 1));
    expect([hint.a, hint.b]).toContainEqual(P(2, 2));
    // two equal matches: the upper one wins, every time
    const equal = ['~ ~ ~ ~ ~', '~ f f ~ ~', '~ ~ ~ f ~', '~ e e ~ ~', '~ ~ ~ e ~'];
    const g = board(equal, C3);
    expect(g.hint()).toEqual({ a: P(3, 2), b: P(3, 1) });
    expect(g.hint()).toEqual(g.hint());
  });

  it('is always one of validMoves(), and null when there is none', () => {
    const g = board(rows, C3);
    const hint = g.hint()!;
    expect(g.canSwap(hint.a, hint.b)).toBe(true);
    expect(board(['~ ~ ~', '~ ~ ~', '~ ~ ~'], C3).hint()).toBeNull();
    expect(board(['~ ~ ~', '~ ~ ~', '~ ~ ~'], C3).validMoves()).toEqual([]);
  });
});
