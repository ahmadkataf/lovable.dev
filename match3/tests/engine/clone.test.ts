import { describe, expect, it, vi } from 'vitest';
import { Game, createRng, type LevelDef } from '../../src/engine/index.ts';

// Generous: these tests are fast, but the suite must not fail because the machine is busy with other work.
vi.setConfig({ testTimeout: 120_000 });

// Game.clone() — the look-ahead primitive of the level simulator (tools/sim).

const level: LevelDef = {
  id: 1,
  cols: 8,
  rows: 8,
  colors: 5,
  moves: 40,
  pieces: ['..L..L..', '........', '.c....c.', '..2vv2..', '........', '.1....1.', '........', '........'],
  floor: ['00000000', '00000000', '00000000', '00111100', '00122100', '00111100', '00000000', '00000000'],
  goals: [{ kind: 'sand' }, { kind: 'lamp', target: 3 }, { kind: 'color', color: 1, target: 20 }],
  stars: [1000, 2000, 3000],
  lamps: { total: 4, maxOnBoard: 2, everyMoves: 3 },
};

describe('Game.clone', () => {
  it('copies the full state', () => {
    const game = new Game(level, { seed: 11 });
    const bot = createRng(5);
    for (let k = 0; k < 6; k++) {
      const move = bot.pick(game.validMoves());
      game.swap(move.a, move.b);
    }
    const copy = game.clone();
    expect(copy).toBeInstanceOf(Game);
    expect(copy.level).toBe(game.level);
    expect(copy.snapshot()).toEqual(game.snapshot());
    expect(copy.validMoves()).toEqual(game.validMoves());
    expect(copy.hint()).toEqual(game.hint());
  });

  it('continues with the same random sequence: same inputs give the same steps', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = new Game(level, { seed });
      const bot = createRng(seed * 31);
      for (let k = 0; k < 4 && game.snapshot().status === 'playing'; k++) {
        const move = bot.pick(game.validMoves());
        game.swap(move.a, move.b);
      }
      const copy = game.clone();
      for (let k = 0; k < 60 && game.snapshot().status === 'playing'; k++) {
        const move = bot.pick(game.validMoves());
        const a = game.swap(move.a, move.b);
        const b = copy.swap(move.a, move.b);
        expect(b).toEqual(a);
      }
      expect(copy.snapshot()).toEqual(game.snapshot());
      if (game.snapshot().status === 'won') expect(copy.endBonus()).toEqual(game.endBonus());
    }
  });

  it('is independent: playing the copy never changes the original', () => {
    const game = new Game(level, { seed: 3 });
    const before = game.snapshot();
    const copy = game.clone();
    const bot = createRng(9);
    for (let k = 0; k < 25 && copy.snapshot().status === 'playing'; k++) {
      const move = bot.pick(copy.validMoves());
      copy.swap(move.a, move.b);
    }
    copy.useBooster('shuffle');
    expect(copy.snapshot()).not.toEqual(before);
    expect(game.snapshot()).toEqual(before);

    // …and the original still plays exactly like a fresh game with the same seed.
    const fresh = new Game(level, { seed: 3 });
    const moves = fresh.validMoves();
    expect(game.validMoves()).toEqual(moves);
    const move = moves[0]!;
    expect(game.swap(move.a, move.b)).toEqual(fresh.swap(move.a, move.b));
  });

  it('a clone of a clone, and a clone of a finished game, work too', () => {
    const game = new Game({ ...level, moves: 2 }, { seed: 8 });
    const second = game.clone().clone();
    while (second.snapshot().status === 'playing') {
      const move = second.validMoves()[0]!;
      second.swap(move.a, move.b);
    }
    const done = second.clone();
    expect(done.snapshot()).toEqual(second.snapshot());
    expect(done.validMoves()).toEqual([]);
    expect(done.addMoves(5).accepted).toBe(second.addMoves(5).accepted);
    expect(game.snapshot().movesLeft).toBe(2);
  });
});
