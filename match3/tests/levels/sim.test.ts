/**
 * The level set in play: the simulator bots (tools/sim/bot.ts) run every level through the real
 * engine. Everything here is deterministic (seeded games, seeded bots).
 */
import { describe, expect, it } from 'vitest';
import { Game } from '../../src/engine/index.ts';
import type { LevelDef } from '../../src/engine/index.ts';
import { LEVELS } from '../../src/levels/index.ts';
import { BOT_KINDS, createBot, playGame, type SimGame } from '../../tools/sim/bot.ts';
import { EXPERT_MIN, bandFlag, bandFor, parseRange, quantile, runJob, seedFor, summarise } from '../../tools/sim/stats.ts';
import { TUTORIALS } from './helpers.ts';

const isScoreOnly = (level: LevelDef): boolean => level.goals.every((g) => g.kind === 'score');

describe('bots', () => {
  const level = LEVELS[56]!; // lamps, chains and sand

  it('every bot picks a move the engine accepts', () => {
    for (const kind of BOT_KINDS) {
      const game: SimGame = new Game(level, { seed: 4 });
      const bot = createBot(kind, 4);
      expect(bot.kind).toBe(kind);
      for (let k = 0; k < 8; k++) {
        const snap = game.snapshot();
        if (snap.status !== 'playing') break;
        const move = bot.pick(game, snap);
        expect(move).not.toBeNull();
        expect(game.canSwap(move!.a, move!.b)).toBe(true);
        expect(game.swap(move!.a, move!.b).accepted).toBe(true);
      }
    }
  });

  it('picking a move never changes the game (the expert looks ahead on clones)', () => {
    const game: SimGame = new Game(level, { seed: 9 });
    const before = game.snapshot();
    for (const kind of BOT_KINDS) createBot(kind, 1).pick(game, before);
    expect(game.snapshot()).toEqual(before);
  });

  it('is deterministic for a given seed', () => {
    for (const kind of BOT_KINDS) {
      const a = playGame(level, 123, kind);
      const b = playGame(level, 123, kind);
      expect(b).toEqual(a);
    }
    const scores = new Set<number>();
    for (let seed = 1; seed <= 6; seed++) scores.add(playGame(level, seed, 'casual').score);
    expect(scores.size).toBeGreaterThan(1);
  });

  it('skill shows: expert beats casual beats random', () => {
    const sample = [10, 27, 40, 55, 70, 96, 113].map((id) => LEVELS[id - 1]!);
    const wins = { random: 0, casual: 0, expert: 0 };
    for (const l of sample) {
      for (let seed = 1; seed <= 12; seed++) {
        for (const kind of BOT_KINDS) if (playGame(l, seed, kind).won) wins[kind]++;
      }
    }
    expect(wins.expert).toBeGreaterThan(wins.casual + 20);
    expect(wins.casual).toBeGreaterThan(wins.random);
  });

  it('reports a finished game faithfully', () => {
    const res = playGame(level, 77, 'casual', { trackScore: true });
    expect(res.movesUsed + res.movesLeft).toBe(level.moves);
    expect(res.scoreTrack?.length).toBe(res.movesUsed);
    expect(res.scoreTrack?.[res.movesUsed - 1]).toBe(res.scoreBeforeBonus);
    expect(res.score).toBeGreaterThanOrEqual(res.scoreBeforeBonus);
    if (res.won) expect(res.stars).toBeGreaterThanOrEqual(1);
    const longer = playGame(level, 77, 'casual', { moves: level.moves + 30 });
    expect(longer.movesUsed + longer.movesLeft).toBe(level.moves + 30);
  });
});

describe('every level in play', () => {
  it('the casual bot plays every level to the end on three seeds', () => {
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 3; seed++) {
        const res = playGame(level, seed * 1009 + level.id, 'casual');
        expect(res.movesUsed, `level ${level.id}`).toBeGreaterThan(0);
        expect(res.movesUsed, `level ${level.id}`).toBeLessThanOrEqual(level.moves);
        expect(res.score, `level ${level.id}`).toBeGreaterThan(0);
        expect(Number.isFinite(res.score), `level ${level.id}`).toBe(true);
        if (res.won) {
          // a won score-only level has used every move; any other win may leave some
          if (isScoreOnly(level)) expect(res.movesLeft, `level ${level.id}`).toBe(0);
          expect(res.stars, `level ${level.id}`).toBeGreaterThanOrEqual(1);
        } else if (!res.deadBoard) {
          expect(res.movesLeft, `level ${level.id}`).toBe(0);
        }
      }
    }
  });

  it('the expert bot wins every level at least once in 12 seeds', () => {
    for (const level of LEVELS) {
      let won = false;
      for (let seed = 1; seed <= 12 && !won; seed++) won = playGame(level, seed, 'expert').won;
      expect(won, `level ${level.id}`).toBe(true);
    }
  });

  it('levels that introduce a mechanic are nearly impossible to lose', () => {
    for (const [, id] of TUTORIALS) {
      const level = LEVELS[id - 1]!;
      let wins = 0;
      for (let seed = 201; seed <= 220; seed++) if (playGame(level, seed, 'casual').won) wins++;
      expect(wins, `level ${id}`).toBeGreaterThanOrEqual(17);
    }
  });

  it('the difficulty curve falls from the first chapters to the last', () => {
    const rate = (from: number, to: number): number => {
      let wins = 0;
      let games = 0;
      for (const level of LEVELS.slice(from - 1, to)) {
        for (let seed = 1; seed <= 10; seed++) {
          games++;
          if (playGame(level, seed + 500, 'casual').won) wins++;
        }
      }
      return wins / games;
    };
    const early = rate(1, 40);
    const middle = rate(41, 80);
    const late = rate(81, 120);
    expect(early).toBeGreaterThan(middle + 0.05);
    expect(middle).toBeGreaterThan(late + 0.02);
    expect(late).toBeGreaterThan(0.3);
    expect(early).toBeLessThan(0.95);
  });

  it('hard levels are clearly harder than their neighbours', () => {
    let hardWins = 0;
    let hardGames = 0;
    let normalWins = 0;
    let normalGames = 0;
    for (const level of LEVELS) {
      if (level.id <= 5 || level.tutorial !== undefined) continue;
      for (let seed = 1; seed <= 8; seed++) {
        const won = playGame(level, seed + 900, 'casual').won;
        if (level.hard) {
          hardGames++;
          if (won) hardWins++;
        } else {
          normalGames++;
          if (won) normalWins++;
        }
      }
    }
    expect(hardWins / hardGames).toBeLessThan(0.48);
    expect(hardWins / hardGames).toBeGreaterThan(0.15);
    expect(normalWins / normalGames).toBeGreaterThan(hardWins / hardGames + 0.15);
  });
});

describe('simulator statistics', () => {
  it('bands follow the difficulty curve', () => {
    expect(bandFor(LEVELS[0]!).lo).toBe(97);
    expect(bandFor(LEVELS[6]!)).toMatchObject({ lo: 80, hi: 95 });
    expect(bandFor(LEVELS[23]!)).toMatchObject({ lo: 65, hi: 85 });
    expect(bandFor(LEVELS[44]!)).toMatchObject({ lo: 50, hi: 75 });
    expect(bandFor(LEVELS[100]!)).toMatchObject({ lo: 40, hi: 65 });
    expect(bandFor(LEVELS[9]!)).toMatchObject({ lo: 22, hi: 40 });
    expect(bandFor(LEVELS[40]!).lo).toBeGreaterThanOrEqual(90); // introduces vines
    for (const level of LEVELS) {
      const band = bandFor(level);
      expect(band.target).toBeGreaterThanOrEqual(band.lo);
      expect(band.target).toBeLessThanOrEqual(band.hi);
    }
    expect(bandFlag(LEVELS[6]!, 88)).toBe('');
    expect(bandFlag(LEVELS[6]!, 70)).toContain('LOW');
    expect(bandFlag(LEVELS[6]!, 99)).toContain('HIGH');
    expect(EXPERT_MIN).toBe(60);
  });

  it('quantile, parseRange and seedFor behave', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([5], 0.9)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([4, 1, 3, 2], 0)).toBe(1);
    expect(quantile([4, 1, 3, 2], 1)).toBe(4);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(parseRange('1-3,7, 9-10', 120)).toEqual([1, 2, 3, 7, 9, 10]);
    expect(parseRange('118-130', 120)).toEqual([118, 119, 120]);
    expect(() => parseRange('x', 120)).toThrow();
    expect(seedFor(3, 1)).not.toBe(seedFor(4, 1));
    expect(seedFor(3, 1)).not.toBe(seedFor(3, 2));
  });

  it('a job is the sum of its games', () => {
    const level = LEVELS[7]!;
    const job = runJob({ level, bot: 'casual', games: 12, seed: 40 });
    expect(job.id).toBe(8);
    expect(job.winAt.length).toBe(12);
    expect(job.endScores.length).toBe(12);
    expect(job.winScores.length).toBe(job.wins);
    expect(job.winAt.filter((at) => at > 0).length).toBe(job.wins);
    let wins = 0;
    for (let g = 0; g < 12; g++) if (playGame(level, 40 + g, 'casual').won) wins++;
    expect(job.wins).toBe(wins);
    const stats = summarise(job);
    expect(stats.winRate).toBeCloseTo((100 * wins) / 12, 6);
    expect(stats.p10).toBeLessThanOrEqual(stats.p50);
    expect(stats.p50).toBeLessThanOrEqual(stats.p90);
  });
});
