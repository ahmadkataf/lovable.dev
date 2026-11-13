/**
 * Test double for the shell's own screenshots and end-to-end tests (loaded on demand, only with
 * the debug flags): a generated level list of any length. (A simulated store is not needed here:
 * src/monetize brings its own test store, `?fakestore=1`.)
 */
import type { ChapterTheme } from '../../art/types.ts';
import type { Goal, LevelDef } from '../../engine/types.ts';
import type { ChapterInfo, World } from '../types.ts';

const THEMES: readonly ChapterTheme[] = ['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars'];

/** `count` playable levels in 6 chapters (the last chapter takes the remainder). */
export function mockWorld(count: number): World {
  const n = Math.max(1, Math.floor(count));
  const row = '........';
  const board = [row, row, row, row, row, row, row, row];
  const levels: LevelDef[] = [];
  for (let id = 1; id <= n; id++) {
    const kind = id % 5;
    const goals: Goal[] =
      kind === 0
        ? [{ kind: 'sand' }]
        : kind === 1
          ? [{ kind: 'score', target: 1500 + id * 40 }]
          : kind === 2
            ? [
                { kind: 'color', color: ((id % 6) as 0 | 1 | 2 | 3 | 4 | 5), target: 12 + (id % 9) },
                { kind: 'color', color: (((id + 2) % 6) as 0 | 1 | 2 | 3 | 4 | 5), target: 10 },
              ]
            : kind === 3
              ? [{ kind: 'color', color: ((id % 6) as 0 | 1 | 2 | 3 | 4 | 5), target: 20 }, { kind: 'sand' }]
              : [{ kind: 'score', target: 2500 }];
    const level: LevelDef = {
      id,
      cols: 8,
      rows: 8,
      colors: 5,
      moves: 18 + (id % 10),
      pieces: board,
      goals,
      stars: [1500, 3000, 4500],
    };
    if (goals.some((g) => g.kind === 'sand')) level.floor = board.map(() => '00111100');
    if (id % 10 === 8 || id % 20 === 15) level.hard = true;
    levels.push(level);
  }
  const chapters: ChapterInfo[] = [];
  const per = Math.max(1, Math.ceil(n / THEMES.length));
  for (let i = 0, from = 1; i < THEMES.length && from <= n; i++, from += per) {
    const theme = THEMES[i]!;
    chapters.push({ index: i, theme, nameKey: 'chapter.' + theme, from, to: Math.min(n, from + per - 1) });
  }
  return { levels, chapters };
}
