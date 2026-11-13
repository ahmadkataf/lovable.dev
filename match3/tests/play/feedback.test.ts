import { describe, expect, it } from 'vitest';
import { Game, createRng } from '../../src/engine/index.ts';
import type { LevelDef, Step, TurnResult } from '../../src/engine/index.ts';
import { FEEDBACK, PRAISE_CASCADES, PRAISE_KEYS, PRAISE_PIECES, createGoalTracker, createSound, fxSound, isComboFx, praiseTier, turnStats } from '../../src/play/feedback.ts';

describe('praise tiers', () => {
  it('thresholds: cascades 4 / 6 / 8 / 11 or pieces 12 / 18 / 24 / 30', () => {
    expect(PRAISE_CASCADES).toEqual([4, 6, 8, 11]);
    expect(PRAISE_PIECES).toEqual([12, 18, 24, 30]);
    expect(PRAISE_KEYS.length).toBe(4);
  });
  it('nothing for an ordinary move', () => {
    expect(praiseTier(1, 3)).toBe(0);
    expect(praiseTier(3, 11)).toBe(0);
  });
  it('by cascade', () => {
    expect(praiseTier(4, 0)).toBe(1);
    expect(praiseTier(5, 0)).toBe(1);
    expect(praiseTier(6, 0)).toBe(2);
    expect(praiseTier(8, 0)).toBe(3);
    expect(praiseTier(10, 0)).toBe(3);
    expect(praiseTier(11, 0)).toBe(4);
  });
  it('by pieces removed', () => {
    expect(praiseTier(1, 12)).toBe(1);
    expect(praiseTier(1, 18)).toBe(2);
    expect(praiseTier(1, 24)).toBe(3);
    expect(praiseTier(1, 30)).toBe(4);
  });
  it('the higher of the two wins', () => {
    expect(praiseTier(4, 24)).toBe(3);
    expect(praiseTier(8, 12)).toBe(3);
  });
});

describe('effects table', () => {
  it('limits', () => {
    expect(FEEDBACK.particlesPerGem).toBe(8);
    expect(FEEDBACK.particleLife).toBeLessThanOrEqual(400);
    expect(FEEDBACK.maxParticles).toBe(120);
    expect(FEEDBACK.shakeSmall).toBe(4);
    expect(FEEDBACK.shakeBig).toBe(8);
  });
  it('sounds', () => {
    expect(fxSound('beamH')).toBe('beam');
    expect(fxSound('beamV')).toBe('beam');
    expect(fxSound('nova')).toBe('nova');
    expect(fxSound('prism')).toBe('prism');
    expect(fxSound('cross')).toBe('bigCombo');
    expect(fxSound('prismAll')).toBe('bigCombo');
    expect(createSound('beamH')).toBe('createBeam');
    expect(createSound('nova')).toBe('createNova');
    expect(createSound('prism')).toBe('createPrism');
    expect(isComboFx('bigNova')).toBe(true);
    expect(isComboFx('nova')).toBe(false);
  });
});

describe('turnStats', () => {
  it('counts cascades, gem-like pieces, blasts and combos', () => {
    const steps: Step[] = [
      { type: 'swap', a: { c: 0, r: 0 }, b: { c: 1, r: 0 }, valid: true },
      {
        type: 'clear',
        cascade: 1,
        hits: [
          { at: { c: 0, r: 0 }, cause: 'match', result: 'removed', pieceId: 1, kind: 'gem', color: 0 },
          { at: { c: 1, r: 0 }, cause: 'match', result: 'activated', pieceId: 2, kind: 'beamH', color: 0 },
          { at: { c: 2, r: 0 }, cause: 'adjacent', result: 'removed', pieceId: 3, kind: 'stone', color: -1 },
          { at: { c: 3, r: 0 }, cause: 'match', result: 'unchained', pieceId: 4, kind: 'gem', color: 0 },
        ],
        created: [],
        score: 60,
        popups: [],
      },
      { type: 'activate', fx: [{ kind: 'beamH', at: { c: 1, r: 0 }, color: 0, targets: [] }] },
      { type: 'clear', cascade: 1, hits: [{ at: { c: 5, r: 0 }, cause: 'blast', result: 'removed', pieceId: 9, kind: 'prism', color: -1 }], created: [], score: 20, popups: [] },
      { type: 'fall', moves: [], spawns: [] },
      { type: 'activate', fx: [{ kind: 'cross', at: { c: 1, r: 0 }, color: 0, targets: [] }] },
      { type: 'clear', cascade: 3, hits: [], created: [], score: 0, popups: [] },
    ];
    expect(turnStats(steps)).toEqual({ maxCascade: 3, pieces: 3, combos: 1, blasts: 2 });
    expect(turnStats([])).toEqual({ maxCascade: 0, pieces: 0, combos: 0, blasts: 0 });
  });
});

// ───────────────────────────── the live goal counters equal the engine's ─────────────────────────────

const LEVELS: LevelDef[] = [
  {
    id: 1,
    cols: 8,
    rows: 8,
    colors: 4,
    moves: 30,
    pieces: ['........', '.H....N.', '..c..c..', '.1.2.3..', '...P....', 'v......v', '........', '........'],
    floor: ['00000000', '00000000', '00000000', '00000000', '00000000', '01111110', '12222221', '12222221'],
    goals: [{ kind: 'sand' }, { kind: 'stone' }, { kind: 'chain' }, { kind: 'vine' }],
    stars: [2000, 4000, 6000],
  },
  {
    id: 2,
    cols: 7,
    rows: 7,
    colors: 4,
    moves: 30,
    pieces: ['.L...L.', '.......', '.......', '.......', '.......', '.......', '.......'],
    goals: [
      { kind: 'lamp', target: 4 },
      { kind: 'color', color: 0, target: 40 },
      { kind: 'color', color: 2, target: 25 },
      { kind: 'score', target: 9000 },
    ],
    stars: [9000, 14000, 20000],
    lamps: { total: 4, maxOnBoard: 2, everyMoves: 2 },
  },
];

function replay(tracker: ReturnType<typeof createGoalTracker>, res: TurnResult): void {
  for (const step of res.steps) {
    if (step.type === 'clear') {
      for (const hit of step.hits) tracker.hit(hit);
      tracker.addScore(step.score);
    } else if (step.type === 'collect') {
      tracker.lamp(step.lamps.length);
      tracker.addScore(step.score);
    } else if (step.type === 'transform') {
      tracker.addScore(step.score);
    }
  }
}

describe('goal tracker', () => {
  it('replaying a turn hit by hit gives exactly the engine goals and score (random games, boosters, end bonus)', () => {
    let turns = 0;
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 12; seed++) {
        const game = new Game(level, { seed });
        const rng = createRng(seed * 977);
        let snap = game.snapshot();
        const tracker = createGoalTracker(snap.goals, snap.score);
        for (let i = 0; i < 60 && snap.status === 'playing'; i++) {
          let res: TurnResult;
          const roll = rng.int(10);
          if (roll === 0) res = game.useBooster('hammer', { c: rng.int(level.cols), r: rng.int(level.rows) });
          else if (roll === 1) res = game.useBooster('shuffle');
          else {
            const moves = game.validMoves();
            if (moves.length === 0) break;
            const m = moves[rng.int(moves.length)]!;
            res = game.swap(m.a, m.b);
          }
          replay(tracker, res);
          snap = res.snapshot;
          expect(tracker.score, `score, level ${level.id} seed ${seed} turn ${i}`).toBe(snap.score);
          expect(tracker.current, `goals, level ${level.id} seed ${seed} turn ${i}`).toEqual(snap.goals.map((g) => g.current));
          for (let g = 0; g < snap.goals.length; g++) expect(tracker.done(g)).toBe(snap.goals[g]!.done);
          turns++;
        }
        if (snap.status === 'won') {
          const res = game.endBonus();
          replay(tracker, res);
          expect(tracker.score).toBe(res.snapshot.score);
        }
      }
    }
    expect(turns).toBeGreaterThan(300);
  });

  it('never counts past the target and reports what changed', () => {
    const tracker = createGoalTracker([{ goal: { kind: 'color', color: 1, target: 2 }, current: 0, target: 2, done: false }], 0);
    const hit = { at: { c: 0, r: 0 }, cause: 'match' as const, result: 'removed' as const, pieceId: 1, kind: 'gem' as const, color: 1 as const };
    expect(Array.from(tracker.hit(hit))).toEqual([0]);
    expect(tracker.remaining(0)).toBe(1);
    expect(Array.from(tracker.hit(hit))).toEqual([0]);
    expect(tracker.done(0)).toBe(true);
    expect(Array.from(tracker.hit(hit))).toEqual([]);
    expect(tracker.current).toEqual([2]);
    expect(Array.from(tracker.hit({ ...hit, color: 3 }))).toEqual([]);
  });

  it('sync takes the engine numbers', () => {
    const tracker = createGoalTracker([{ goal: { kind: 'sand' }, current: 1, target: 9, done: false }], 100);
    tracker.sync([{ goal: { kind: 'sand' }, current: 7, target: 9, done: false }], 640);
    expect(tracker.current).toEqual([7]);
    expect(tracker.remaining(0)).toBe(2);
    expect(tracker.score).toBe(640);
  });
});
