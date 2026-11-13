import { describe, expect, it } from 'vitest';
import { createRng, validateLevel, type LevelDef } from '../../src/engine/index.ts';
import { checkTurn, playRandomGame, randomLevel } from './helpers.ts';

describe('fuzz (preliminary)', () => {
  it('plays random games', () => {
    const rng = createRng(12345);
    let games = 0, turns = 0, valid = 0, won = 0, lost = 0;
    const t0 = Date.now();
    for (let n = 0; n < 400; n++) {
      const level: LevelDef = randomLevel(rng, n + 1);
      const ok = validateLevel(level).length === 0;
      if (ok) valid++;
      try {
        const out = playRandomGame(level, 1000 + n, 77 + n, { onTurn: (g, b, r, a, t) => checkTurn(g, b, r, a, t) });
        games++; turns += out.turns;
        const st = out.game.snapshot().status;
        if (st === 'won') won++; else if (st === 'lost') lost++;
      } catch (e) {
        throw new Error(`game ${n} valid=${ok} level=${JSON.stringify(level)}\n${(e as Error).message}`);
      }
    }
    console.log({ games, turns, valid, won, lost, ms: Date.now() - t0 });
    expect(games).toBe(400);
  });
});
