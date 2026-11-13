import { describe, expect, it } from 'vitest';
import { validateLevel } from '../../src/engine/index.ts';
import { dice, genLevel, playAudited } from './hardening-kit.ts';

const stats: Record<string, number> = {};

describe('hardening fuzz', () => {
  it('audited games', () => {
    const d = dice(1);
    let games = 0;
    let turns = 0;
    const failures: string[] = [];
    for (let n = 0; n < 400; n++) {
      const level = genLevel(d, n + 1);
      const valid = validateLevel(level).length === 0;
      stats[valid ? 'level:valid' : 'level:invalid'] = (stats[valid ? 'level:valid' : 'level:invalid'] ?? 0) + 1;
      try {
        const out = playAudited(level, 1000 + n, 77 * n + 1, stats);
        turns += out.turns;
        games++;
      } catch (e) {
        failures.push(`game ${n}: ${(e as Error).message.split('\n').slice(0, 2).join(' | ')}`);
        if (failures.length <= 3) console.log(`game ${n} (valid=${valid}):\n${(e as Error).message.slice(0, 6000)}`);
      }
    }
    console.log(JSON.stringify({ games, turns, failures: failures.length }));
    console.log(failures.slice(0, 40).join('\n'));
    console.log(JSON.stringify(stats));
    expect(failures).toEqual([]);
  });
});
