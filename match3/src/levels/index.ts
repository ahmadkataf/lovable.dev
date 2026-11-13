/**
 * The level set: 120 hand-designed levels in 6 chapters of 20.
 *
 * - The level literals live in ./data/chapter<N>.ts (one file per chapter). Layouts, colours and
 *   goals are designed by hand; `moves` and `stars` are fitted to the simulator's casual bot by
 *   `node tools/levelgen/tune.ts` (see tools/sim/REPORT.md for the balance table).
 * - `node tools/levelgen/check.ts` lints the set (validateLevel, duplicate layouts, geometry,
 *   inventory) and prints boards.
 * - Mechanics are introduced one at a time; the first level of each carries a `tutorial` id:
 *   1 match · 2 collect · 3 beam · 4 nova · 5 prism · 6 sand · 9 sand2 · 12 stone · 16 combo ·
 *   21 lamp · 31 chain · 41 vine.
 * - Difficulty follows a sawtooth (docs/STRATEGY.md, levels-01): every chapter is four waves of
 *   five levels — normal, normal, build-up, spike, breather — see `tierOf`. From chapter 2 on the
 *   last spike of a chapter is marked `hard`, later chapters mark more of them; the level after a
 *   spike is always a breather and the last level of a chapter is a generous one.
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

/** Levels per difficulty wave: normal, normal, build-up, spike, breather. */
export const WAVE_LENGTH = 5;

/**
 * Where a level sits on the difficulty sawtooth:
 *   tutorial  introduces a mechanic — nearly impossible to lose
 *   breather  relief: the level after a spike, and every level of the first ten
 *   normal    the chapter's everyday difficulty
 *   buildup   a little harder than normal — the climb towards the spike
 *   spike     the top of a wave, not marked on the map
 *   hard      a spike that is marked on the map (`LevelDef.hard`; its first clear pays double)
 */
export type LevelTier = 'tutorial' | 'breather' | 'normal' | 'buildup' | 'spike' | 'hard';

/** The tier of a level, derived from its number, its `tutorial` id and its `hard` mark. */
export function tierOf(level: Pick<LevelDef, 'id' | 'hard' | 'tutorial'>): LevelTier {
  if (level.hard === true) return 'hard';
  if (level.tutorial !== undefined) return 'tutorial';
  if (level.id <= 10) return 'breather';
  const slot = (level.id - 1) % WAVE_LENGTH;
  return slot === 4 ? 'breather' : slot === 3 ? 'spike' : slot === 2 ? 'buildup' : 'normal';
}

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
