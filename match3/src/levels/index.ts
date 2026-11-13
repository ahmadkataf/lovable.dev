/**
 * The level set: 120 hand-designed levels in 6 chapters of 20.
 *
 * - The level literals live in ./data/chapter<N>.ts (one file per chapter). Layouts, colours and
 *   goals are designed by hand; `moves`, score targets and `stars` are fitted to the simulator's
 *   casual bot by `node tools/levelgen/tune.ts` (see tools/sim/REPORT.md for the balance table).
 * - `node tools/levelgen/check.ts` lints the set (validateLevel, duplicate layouts, inventory).
 * - Mechanics are introduced one at a time; the first level of each carries a `tutorial` id:
 *   1 match · 2 collect · 3 beam · 4 nova · 5 prism · 6 sand · 9 sand2 · 12 stone · 16 combo ·
 *   21 lamp · 31 chain · 41 vine.
 */
import type { LevelDef } from '../engine/types.ts';
import type { ChapterTheme } from '../art/types.ts';
import { CHAPTER_1 } from './data/chapter1.ts';
import { CHAPTER_2 } from './data/chapter2.ts';
import { CHAPTER_3 } from './data/chapter3.ts';
import { CHAPTER_4 } from './data/chapter4.ts';
import { CHAPTER_5 } from './data/chapter5.ts';
import { CHAPTER_6 } from './data/chapter6.ts';

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

export const LEVELS_PER_CHAPTER = 20;

const THEMES: readonly ChapterTheme[] = ['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars'];
const CHAPTER_DATA: readonly (readonly LevelDef[])[] = [CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6];

/** Every level, in order: `LEVELS[id - 1]` is level `id`. */
export const LEVELS: readonly LevelDef[] = CHAPTER_DATA.reduce<LevelDef[]>((all, chapter) => all.concat(chapter), []);

export const CHAPTERS: readonly Chapter[] = (() => {
  const chapters: Chapter[] = [];
  let from = 1;
  CHAPTER_DATA.forEach((levels, index) => {
    const theme = THEMES[index] as ChapterTheme;
    chapters.push({ index, theme, nameKey: `chapter.${theme}`, from, to: from + levels.length - 1 });
    from += levels.length;
  });
  return chapters;
})();

/** The chapter a level belongs to (ids outside the set map to the first / last chapter). */
export function chapterOf(levelId: number): Chapter {
  return CHAPTERS.find((c) => levelId >= c.from && levelId <= c.to) ?? (levelId < 1 ? CHAPTERS[0]! : CHAPTERS[CHAPTERS.length - 1]!);
}

/** The level with this id, or undefined. */
export function levelById(levelId: number): LevelDef | undefined {
  const level = LEVELS[levelId - 1];
  return level !== undefined && level.id === levelId ? level : undefined;
}

/** Identity of a level's layout (board shape, pieces and floor) — used to rule out duplicates. */
export function layoutKey(level: LevelDef): string {
  const floor = level.floor ?? level.pieces.map((row) => row.replace(/[^_]/g, '0').replace(/_/g, '0'));
  return `${level.cols}x${level.rows}|${level.pieces.join('/')}|${floor.join('/')}`;
}
