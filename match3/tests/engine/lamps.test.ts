import { describe, expect, it } from 'vitest';
import { Game, type LevelDef, type Step } from '../../src/engine/index.ts';
import { P, board, cellOf, checkTurn, newTally, pieceOf, stepTypes, stepsOf } from './helpers.ts';

// DESIGN §2.2 (lamp swap rule is in swap.test.ts), §2.5, §2.6 — lamps.

const C3 = { colors: 3 };

describe('lamps', () => {
  it('a lamp that settles on an exit cell is collected, then gravity runs again', () => {
    const g = board(['~ ~ ~ ~', '~ L ~ ~', '~ f ~ ~', '~ f ~ ~', 'f ~ ~ ~'], {
      ...C3,
      goals: [{ kind: 'lamp', target: 1 }, { kind: 'score', target: 1e9 }],
    });
    const before = g.snapshot();
    const lamp = pieceOf(before, 1, 1)!;
    expect(cellOf(before, 1, 4).exit).toBe(true);
    expect(before.cells.filter((c) => c.exit)).toHaveLength(4);
    const res = g.swap(P(0, 4), P(1, 4));
    expect(stepTypes(res.steps).startsWith('swap clear fall collect fall')).toBe(true);
    // the lamp drops three cells onto the exit of its column …
    const fall = stepsOf(res.steps, 'fall')[0]!;
    expect(fall.moves.find((m) => m.id === lamp.id)).toEqual({ id: lamp.id, from: P(1, 1), to: P(1, 4) });
    // … is collected there for 500 points …
    const collect = stepsOf(res.steps, 'collect')[0]!;
    expect(collect).toEqual({ type: 'collect', lamps: [{ id: lamp.id, at: P(1, 4) }], score: 500 });
    // … and the column closes up
    const refill = stepsOf(res.steps, 'fall')[1]!;
    expect(refill.moves.every((m) => m.from.c === 1 && m.to.r === m.from.r + 1)).toBe(true);
    expect(refill.moves).toHaveLength(4);
    expect(refill.spawns).toHaveLength(1);
    expect(res.snapshot.cells.some((c) => c.piece?.id === lamp.id)).toBe(false);
    expect(res.snapshot.goals[0]).toMatchObject({ current: 1, target: 1, done: true });
    expect(res.snapshot.score).toBeGreaterThanOrEqual(60 + 500);
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('delivering the last lamp wins a lamp level', () => {
    const g = board(['~ ~ ~ ~', '~ L ~ ~', '~ f ~ ~', '~ f ~ ~', 'f ~ ~ ~'], { ...C3, goals: [{ kind: 'lamp', target: 1 }] });
    const res = g.swap(P(0, 4), P(1, 4));
    expect(res.snapshot.status).toBe('won');
    expect(res.steps[res.steps.length - 1]).toEqual({ type: 'status', status: 'won' });
  });

  it('lamps are never destroyed: matches ignore them and blasts leave them standing', () => {
    const g = board(['~ ~ ~ ~ ~', 'fH L ~ L ~', '~ ~ dN ~ ~', '~ ~ L ~ ~', '~ ~ ~ ~ ~', '~ ~ ~ ~ ~'], C3);
    const before = g.snapshot();
    const lamps = before.cells.filter((c) => c.piece?.kind === 'lamp').map((c) => c.piece!.id);
    expect(lamps).toHaveLength(3);
    const res = g.useBooster('hammer', P(0, 1));
    const lampHits = stepsOf(res.steps, 'clear').flatMap((c) => c.hits).filter((h) => h.kind === 'lamp');
    expect(lampHits.length).toBeGreaterThanOrEqual(2);
    for (const h of lampHits) expect(h).toMatchObject({ result: 'none', cause: 'blast' });
    // all three are still on the board (none of them reached the bottom row)
    for (const id of lamps) expect(res.snapshot.cells.some((c) => c.piece?.id === id)).toBe(true);
    checkTurn(g, before, res, 'booster', undefined, false);
  });

  it('a lamp is only collected on an exit cell: resting above a hole does not count', () => {
    const g = board(['~ ~ ~ ~', '~ L ~ ~', '~ _ ~ ~', '~ ~ f f', 'f f ~ ~', '~ ~ ~ ~'], { ...C3, goals: [{ kind: 'lamp', target: 1 }] });
    const before = g.snapshot();
    const lamp = pieceOf(before, 1, 1)!;
    expect(cellOf(before, 1, 1).exit).toBe(false);
    expect(cellOf(before, 1, 5).exit).toBe(true);
    const res = g.swap(P(1, 4), P(1, 3)); // f up: f f f in row 3
    expect(res.accepted).toBe(true);
    expect(stepsOf(res.steps, 'collect')).toEqual([]);
    expect(pieceOf(res.snapshot, 1, 1)?.id).toBe(lamp.id);
    expect(res.snapshot.status).toBe('playing');
    checkTurn(g, before, res, 'swap', undefined, false);
  });

  it('a hammer cannot hurt a lamp (and is refused when there is nothing else to hit)', () => {
    const g = board(['~ L ~', '~ L ~', '~ ~ ~'], { ...C3, floor: ['000', '010', '000'] });
    const before = g.snapshot();
    expect(g.useBooster('hammer', P(1, 0)).accepted).toBe(false);
    expect(g.snapshot()).toEqual(before);
    const res = g.useBooster('hammer', P(1, 1)); // sand under this one
    expect(res.accepted).toBe(true);
    expect(stepsOf(res.steps, 'clear')[0]!.hits).toEqual([
      { at: P(1, 1), cause: 'booster', result: 'none', pieceId: pieceOf(before, 1, 1)!.id, kind: 'lamp', color: -1, sandLeft: 0 },
    ]);
    expect(pieceOf(res.snapshot, 1, 1)?.kind).toBe('lamp');
  });

  const lampLevel = (lamps: LevelDef['lamps'], pieces?: string[], target = 4): LevelDef => {
    const level: LevelDef = {
      id: 7,
      cols: 7,
      rows: 7,
      colors: 5,
      moves: 400,
      pieces: pieces ?? new Array<string>(7).fill('.......'),
      goals: [{ kind: 'lamp', target }],
      stars: [1000, 2000, 3000],
    };
    if (lamps) level.lamps = lamps;
    return level;
  };

  it('lamps drop in per LevelDef.lamps: total, maxOnBoard and everyMoves are respected', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const cfg = { total: 4, maxOnBoard: 2, everyMoves: 3 };
      const g = new Game(lampLevel(cfg), { seed });
      const tally = newTally();
      let spawned = 0;
      let lastSpawnMove = -Infinity;
      let moves = 0;
      expect(g.snapshot().cells.some((c) => c.piece?.kind === 'lamp')).toBe(false);
      while (g.snapshot().status === 'playing') {
        const before = g.snapshot();
        const options = g.validMoves();
        // prefer moves low on the board so lamps keep sinking
        const move = options.reduce((best, m) => (Math.max(m.a.r, m.b.r) > Math.max(best.a.r, best.b.r) ? m : best), options[0]!);
        const res = g.swap(move.a, move.b);
        moves++;
        checkTurn(g, before, res, 'swap', tally);
        for (const step of res.steps as Step[]) {
          if (step.type !== 'fall') continue;
          for (const s of step.spawns) {
            if (s.piece.kind !== 'lamp') continue;
            spawned++;
            expect(s.piece.color).toBe(-1);
            // "at least everyMoves moves passed since the last one"
            expect(moves - lastSpawnMove).toBeGreaterThanOrEqual(cfg.everyMoves);
            lastSpawnMove = moves;
          }
        }
        expect(spawned).toBeLessThanOrEqual(cfg.total);
        expect(res.snapshot.cells.filter((c) => c.piece?.kind === 'lamp').length).toBeLessThanOrEqual(cfg.maxOnBoard);
        if (moves === 1) expect(spawned).toBe(1); // nothing placed at the start: the first lamp may come at once
      }
      const end = g.snapshot();
      expect(end.status).toBe('won');
      expect(spawned).toBe(4);
      expect(tally.lamps).toBe(4);
      expect(end.goals[0]).toMatchObject({ current: 4, target: 4, done: true });
    }
  });

  it('lamps placed in the level count towards `total`', () => {
    const pieces = ['.......', '..L.L..', '.......', '.......', '.......', '.......', '.......'];
    const g = new Game(lampLevel({ total: 2, maxOnBoard: 2, everyMoves: 0 }, pieces, 2), { seed: 3 });
    expect(g.snapshot().cells.filter((c) => c.piece?.kind === 'lamp')).toHaveLength(2);
    let spawned = 0;
    while (g.snapshot().status === 'playing') {
      const options = g.validMoves();
      const move = options.reduce((best, m) => (Math.max(m.a.r, m.b.r) > Math.max(best.a.r, best.b.r) ? m : best), options[0]!);
      const res = g.swap(move.a, move.b);
      for (const step of res.steps) if (step.type === 'fall') spawned += step.spawns.filter((s) => s.piece.kind === 'lamp').length;
    }
    expect(spawned).toBe(0);
    expect(g.snapshot().status).toBe('won');
  });

  it('with lamps on the board at the start, the first extra lamp waits `everyMoves` moves', () => {
    const pieces = ['.......', '...L...', '.......', '.......', '.......', '.......', '.......'];
    const g = new Game(lampLevel({ total: 5, maxOnBoard: 3, everyMoves: 4 }, pieces, 5), { seed: 9 });
    let moves = 0;
    let firstSpawnAt = -1;
    while (g.snapshot().status === 'playing' && firstSpawnAt < 0 && moves < 60) {
      const move = g.validMoves()[0]!;
      const res = g.swap(move.a, move.b);
      moves++;
      for (const step of res.steps) if (step.type === 'fall' && step.spawns.some((s) => s.piece.kind === 'lamp')) firstSpawnAt = moves;
    }
    expect(firstSpawnAt).toBeGreaterThanOrEqual(4);
  });

  it('spawned lamps enter through columns that run without a gap to their exit', () => {
    // columns 0 and 6 have a hole half-way down; lamps must never spawn there
    const pieces = ['.......', '.......', '_....._', '.......', '.......', '.......', '.......'];
    for (const seed of [1, 2, 3]) {
      const g = new Game(lampLevel({ total: 6, maxOnBoard: 3, everyMoves: 0 }, pieces, 6), { seed });
      for (let moves = 0; moves < 80 && g.snapshot().status === 'playing'; moves++) {
        const move = g.validMoves()[moves % g.validMoves().length]!;
        const res = g.swap(move.a, move.b);
        for (const step of res.steps) {
          if (step.type !== 'fall') continue;
          for (const s of step.spawns) if (s.piece.kind === 'lamp') expect([1, 2, 3, 4, 5]).toContain(s.from.c);
        }
      }
    }
  });
});
