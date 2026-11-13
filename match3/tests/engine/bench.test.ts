import { describe, expect, it } from 'vitest';
import { Game, createRng, type LevelDef } from '../../src/engine/index.ts';

// Micro-benchmarks. The limits are deliberately loose (many times the measured cost on a slow
// machine) so they only trip on a real regression, e.g. an accidental quadratic loop.

const nineByNine: LevelDef = {
  id: 1,
  cols: 9,
  rows: 9,
  colors: 6,
  moves: 1_000_000,
  pieces: new Array<string>(9).fill('.........'),
  goals: [{ kind: 'score', target: 1e12 }],
  stars: [1e12, 2e12, 3e12],
};

describe('engine speed', () => {
  it('2,000 random turns on a 9×9 six-colour board take well under 2 seconds', () => {
    const game = new Game(nineByNine, { seed: 2024 });
    const bot = createRng(1);
    // warm-up so the JIT does not dominate the measurement
    for (let k = 0; k < 100; k++) {
      const move = bot.pick(game.validMoves());
      game.swap(move.a, move.b);
    }
    const start = performance.now();
    let steps = 0;
    for (let k = 0; k < 2000; k++) {
      const moves = game.validMoves();
      const move = bot.pick(moves);
      const res = game.swap(move.a, move.b);
      expect(res.accepted).toBe(true);
      steps += res.steps.length;
    }
    const elapsed = performance.now() - start;
    expect(steps).toBeGreaterThan(6000);
    expect(game.snapshot().status).toBe('playing');
    expect(elapsed).toBeLessThan(1000);
  });

  it('validMoves() and hint() are cheap enough to call every frame', () => {
    const game = new Game(nineByNine, { seed: 7 });
    let total = 0;
    const start = performance.now();
    for (let k = 0; k < 5000; k++) {
      total += game.validMoves().length;
      if (game.hint() === null) total--;
    }
    const elapsed = performance.now() - start;
    expect(total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000); // 5,000 × (validMoves + hint): under 0.2 ms per pair
  });

  it('a heavy board (three colours, long cascades) still settles quickly', () => {
    const level: LevelDef = { ...nineByNine, colors: 3 };
    const game = new Game(level, { seed: 5 });
    const bot = createRng(3);
    const start = performance.now();
    let longest = 0;
    for (let k = 0; k < 300; k++) {
      const move = bot.pick(game.validMoves());
      const res = game.swap(move.a, move.b);
      const falls = res.steps.filter((s) => s.type === 'fall').length;
      if (falls > longest) longest = falls;
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1500);
    // the calm-refill valve keeps even this board's cascades finite and modest
    expect(longest).toBeLessThan(120);
  });
});
