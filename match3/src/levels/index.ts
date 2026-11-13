// PLACEHOLDER — replaced by the level-design module. Three trivial levels so the app can run meanwhile.
import type { LevelDef } from '../engine/types.ts';
import type { ChapterTheme } from '../art/types.ts';

export interface Chapter {
  /** 0-based chapter index */
  index: number;
  theme: ChapterTheme;
  /** i18n key of the chapter name */
  nameKey: string;
  /** first and last level id (inclusive) */
  from: number;
  to: number;
}

const row = '........';
const board = [row, row, row, row, row, row, row, row];

export const LEVELS: readonly LevelDef[] = [
  { id: 1, cols: 8, rows: 8, colors: 4, moves: 20, pieces: board, goals: [{ kind: 'score', target: 1500 }], stars: [1500, 3000, 4500] },
  { id: 2, cols: 8, rows: 8, colors: 5, moves: 22, pieces: board, goals: [{ kind: 'color', color: 0, target: 15 }], stars: [1500, 3000, 4500] },
  { id: 3, cols: 8, rows: 8, colors: 5, moves: 24, pieces: board, floor: board.map(() => '00111100'), goals: [{ kind: 'sand' }], stars: [2000, 4000, 6000] },
];

export const CHAPTERS: readonly Chapter[] = [{ index: 0, theme: 'oasis', nameKey: 'chapter.oasis', from: 1, to: 3 }];

export function chapterOf(levelId: number): Chapter {
  return CHAPTERS.find((c) => levelId >= c.from && levelId <= c.to) ?? CHAPTERS[CHAPTERS.length - 1]!;
}
