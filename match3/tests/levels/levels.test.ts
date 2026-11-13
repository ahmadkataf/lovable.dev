/**
 * The level set as data: 120 valid levels in 6 chapters, mechanics introduced in the planned
 * order, no two layouts alike.
 */
import { describe, expect, it } from 'vitest';
import { Game, validateLevel } from '../../src/engine/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { CHAPTERS, LEVELS, LEVELS_PER_CHAPTER, chapterOf, layoutKey, levelById } from '../../src/levels/index.ts';
import common from '../../src/i18n/strings/common.ts';
import { TUTORIALS, arrangedSpecial, countChars, hasAdjacentSpecials, mechanicsOf } from './helpers.ts';

const isScoreOnly = (level: LevelDef): boolean => level.goals.every((g) => g.kind === 'score');

describe('level set', () => {
  it('has exactly 120 levels with ids 1..120 in order', () => {
    expect(LEVELS.length).toBe(120);
    LEVELS.forEach((level, index) => expect(level.id).toBe(index + 1));
    expect(levelById(1)).toBe(LEVELS[0]);
    expect(levelById(120)).toBe(LEVELS[119]);
    expect(levelById(0)).toBeUndefined();
    expect(levelById(121)).toBeUndefined();
  });

  it('every level passes validateLevel()', () => {
    for (const level of LEVELS) expect({ id: level.id, problems: validateLevel(level) }).toEqual({ id: level.id, problems: [] });
  });

  it('boards are between 6×6 and 9×9, with 4–6 colours and at most three goals', () => {
    for (const level of LEVELS) {
      expect(level.cols, `level ${level.id} cols`).toBeGreaterThanOrEqual(6);
      expect(level.cols, `level ${level.id} cols`).toBeLessThanOrEqual(9);
      expect(level.rows, `level ${level.id} rows`).toBeGreaterThanOrEqual(6);
      expect(level.rows, `level ${level.id} rows`).toBeLessThanOrEqual(9);
      expect(level.colors, `level ${level.id} colours`).toBeGreaterThanOrEqual(4);
      expect(level.colors, `level ${level.id} colours`).toBeLessThanOrEqual(6);
      expect(level.goals.length, `level ${level.id} goals`).toBeGreaterThanOrEqual(1);
      expect(level.goals.length, `level ${level.id} goals`).toBeLessThanOrEqual(3);
      expect(level.moves, `level ${level.id} moves`).toBeGreaterThanOrEqual(8);
      expect(level.moves, `level ${level.id} moves`).toBeLessThanOrEqual(45);
    }
  });

  it('uses four colours for levels 1–5, mostly five in chapters 1–2 and six more and more often later', () => {
    for (const level of LEVELS.slice(0, 5)) expect(level.colors).toBe(4);
    const six = (from: number, to: number): number => LEVELS.slice(from - 1, to).filter((l) => l.colors === 6).length;
    expect(LEVELS.slice(5, 40).filter((l) => l.colors === 5).length).toBeGreaterThanOrEqual(28);
    expect(six(41, 80)).toBeGreaterThan(six(1, 40));
    expect(six(81, 120)).toBeGreaterThan(six(41, 80));
    expect(six(81, 120)).toBeGreaterThanOrEqual(24);
  });

  it('no two levels share a layout', () => {
    const seen = new Map<string, number>();
    for (const level of LEVELS) {
      const key = layoutKey(level);
      expect(seen.get(key), `level ${level.id} repeats the layout of level ${seen.get(key)}`).toBeUndefined();
      seen.set(key, level.id);
    }
  });

  it("score-only levels: the goal's target is the one-star score", () => {
    const scoreOnly = LEVELS.filter(isScoreOnly);
    expect(scoreOnly.length).toBeGreaterThanOrEqual(5);
    for (const level of scoreOnly) {
      expect(level.goals.length).toBe(1);
      const goal = level.goals[0]!;
      expect(goal.kind === 'score' && goal.target, `level ${level.id}`).toBe(level.stars[0]);
    }
  });

  it('stars are ascending and reachable-looking', () => {
    for (const level of LEVELS) {
      const [s1, s2, s3] = level.stars;
      expect(s1, `level ${level.id}`).toBeGreaterThan(0);
      expect(s2, `level ${level.id}`).toBeGreaterThan(s1);
      expect(s3, `level ${level.id}`).toBeGreaterThan(s2);
      expect(s3, `level ${level.id}`).toBeLessThan(100_000);
    }
  });

  it('marks every tenth level and a few surprises as hard', () => {
    const hard = LEVELS.filter((l) => l.hard === true).map((l) => l.id);
    for (let id = 10; id <= 120; id += 10) expect(hard).toContain(id);
    expect(hard.length).toBeGreaterThanOrEqual(15);
    expect(hard.length).toBeLessThanOrEqual(22);
    // never a hard level among the first five or on a level that introduces a mechanic
    for (const level of LEVELS) if (level.hard) expect(level.id > 5 && level.tutorial === undefined, `level ${level.id}`).toBe(true);
  });

  it('covers every kind of goal, alone and in combination', () => {
    const kinds = new Set<string>();
    const colourGoalCounts = new Set<number>();
    let combined = 0;
    for (const level of LEVELS) {
      for (const g of level.goals) kinds.add(g.kind);
      const colours = level.goals.filter((g) => g.kind === 'color').length;
      if (colours > 0) colourGoalCounts.add(colours);
      if (new Set(level.goals.map((g) => g.kind)).size > 1) combined++;
    }
    expect(Array.from(kinds).sort()).toEqual(['chain', 'color', 'lamp', 'sand', 'score', 'stone', 'vine']);
    expect(Array.from(colourGoalCounts).sort()).toEqual([1, 2, 3]);
    expect(combined).toBeGreaterThanOrEqual(40);
  });
});

describe('chapters', () => {
  it('six chapters of twenty, contiguous, themed in order', () => {
    expect(CHAPTERS.map((c) => c.theme)).toEqual(['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars']);
    expect(LEVELS_PER_CHAPTER).toBe(20);
    let next = 1;
    CHAPTERS.forEach((chapter, index) => {
      expect(chapter.index).toBe(index);
      expect(chapter.from).toBe(next);
      expect(chapter.to).toBe(chapter.from + 19);
      expect(chapter.nameKey).toBe(`chapter.${chapter.theme}`);
      next = chapter.to + 1;
    });
    expect(next).toBe(121);
  });

  it('chapter names exist in both languages', () => {
    for (const chapter of CHAPTERS) {
      expect(typeof common.en[chapter.nameKey], chapter.nameKey).toBe('string');
      expect(typeof common.ar[chapter.nameKey], chapter.nameKey).toBe('string');
    }
  });

  it('chapterOf maps every level to its chapter', () => {
    for (const level of LEVELS) {
      const chapter = chapterOf(level.id);
      expect(chapter.index).toBe(Math.floor((level.id - 1) / 20));
      expect(level.id >= chapter.from && level.id <= chapter.to).toBe(true);
    }
    expect(chapterOf(0).index).toBe(0);
    expect(chapterOf(-5).index).toBe(0);
    expect(chapterOf(999).index).toBe(5);
  });
});

describe('mechanic introduction', () => {
  it('each tutorial id appears exactly once, on the planned level', () => {
    const withTutorial = LEVELS.filter((l) => l.tutorial !== undefined).map((l) => [l.tutorial, l.id]);
    expect(withTutorial).toEqual(TUTORIALS.map(([id, level]) => [id, level]));
  });

  it('each tutorial sits on the first level that features its mechanic', () => {
    const first = new Map<string, number>();
    for (const level of LEVELS) for (const mechanic of mechanicsOf(level)) if (!first.has(mechanic)) first.set(mechanic, level.id);
    for (const [id, levelId] of TUTORIALS) expect(first.get(id), `first level with '${id}'`).toBe(levelId);
  });

  it('levels 3, 4 and 5 are arranged so that the hinted first move makes a beam, a nova and a prism', () => {
    expect(arrangedSpecial(LEVELS[2]!, 10)).toBe('beam');
    expect(arrangedSpecial(LEVELS[3]!, 10)).toBe('nova');
    expect(arrangedSpecial(LEVELS[4]!, 10)).toBe('prism');
    // the start position is fixed, so every player sees the same board
    for (const id of [3, 4, 5]) {
      const level = LEVELS[id - 1]!;
      expect(countChars(level.pieces, '.')).toBe(0);
      expect(new Game(level, { seed: 1 }).snapshot().cells).toEqual(new Game(level, { seed: 99 }).snapshot().cells);
    }
  });

  it('level 16 starts with two specials that can be swapped with each other', () => {
    const level = LEVELS[15]!;
    expect(hasAdjacentSpecials(level)).toBe(true);
    const game = new Game(level, { seed: 5 });
    expect(game.canSwap({ c: 2, r: 3 }, { c: 3, r: 3 })).toBe(true);
    const res = game.swap({ c: 2, r: 3 }, { c: 3, r: 3 });
    // beam + nova on the centre cell clears the whole cross of sand in one move
    expect(res.steps.some((s) => s.type === 'activate' && s.fx.some((fx) => fx.kind === 'bigCross'))).toBe(true);
    expect(res.snapshot.status).toBe('won');
  });

  it('early chapters hold back the later mechanics', () => {
    for (const level of LEVELS) {
      const m = mechanicsOf(level);
      if (level.id < 6) expect(m.has('sand') || m.has('stone'), `level ${level.id}`).toBe(false);
      if (level.id < 21) expect(m.has('lamp') || m.has('chain') || m.has('vine'), `level ${level.id}`).toBe(false);
      if (level.id < 31) expect(m.has('chain'), `level ${level.id}`).toBe(false);
      if (level.id < 41) expect(m.has('vine'), `level ${level.id}`).toBe(false);
    }
  });

  it('later chapters mix the mechanics', () => {
    const blockers = ['sand', 'stone', 'lamp', 'chain', 'vine'];
    for (const chapter of CHAPTERS.slice(2)) {
      const used = new Set<string>();
      let mixed = 0;
      for (let id = chapter.from; id <= chapter.to; id++) {
        const m = mechanicsOf(LEVELS[id - 1]!);
        const here = blockers.filter((b) => m.has(b));
        here.forEach((b) => used.add(b));
        if (here.length >= 2) mixed++;
      }
      expect(Array.from(used).sort(), `chapter ${chapter.theme}`).toEqual(blockers.slice().sort());
      expect(mixed, `chapter ${chapter.theme}`).toBeGreaterThanOrEqual(8);
    }
  });
});
