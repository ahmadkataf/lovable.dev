/**
 * The feedback ladder (docs/STRATEGY.md "feel-02-feedback-ladder"): how loud each event may be,
 * the praise tiers, and the live goal counters that keep the HUD in step with the animation.
 * Pure: no DOM, importable under Node.
 */
import type { FxKind, Goal, GoalProgress, Hit, PieceKind, Step } from '../engine/types.ts';
import type { SfxName } from '../audio/types.ts';
import type { HapticKind } from '../platform/types.ts';

// ───────────────────────────── limits ─────────────────────────────

export const FEEDBACK = {
  /** a gem under the finger or selected grows to this */
  pickScale: 1.12,
  /** shards per cleared gem */
  particlesPerGem: 8,
  /** particle lifetime ceiling, ms */
  particleLife: 400,
  /** score labels written out per wave at most (the largest ones) */
  maxPopups: 5,
  /** live particles at most (halved in low-end mode) */
  maxParticles: 120,
  maxParticlesLow: 60,
  /** shake amplitude in CSS px: a special fires / a combo or praise tier 3–4 */
  shakeSmall: 4,
  shakeBig: 8,
  /** mean frame time (ms) over 2 s above which low-end mode switches on */
  lowEndFrame: 22,
  lowEndWindow: 2000,
} as const;

// ───────────────────────────── praise ─────────────────────────────

export type PraiseTier = 0 | 1 | 2 | 3 | 4;

/** Highest cascade number needed for tier 1..4. */
export const PRAISE_CASCADES: readonly [number, number, number, number] = [4, 6, 8, 11];
/** Gem-like pieces removed in one move needed for tier 1..4. */
export const PRAISE_PIECES: readonly [number, number, number, number] = [12, 18, 24, 30];

/** i18n keys of the four praise words, weakest first, and of the finale phrase. */
export const PRAISE_KEYS: readonly [string, string, string, string] = ['play.praise.1', 'play.praise.2', 'play.praise.3', 'play.praise.4'];
export const FINALE_KEY = 'play.praise.finale';

/** The praise tier a finished move has earned: by its longest cascade or by the gems it removed. */
export function praiseTier(maxCascade: number, piecesRemoved: number): PraiseTier {
  let tier: PraiseTier = 0;
  for (let i = 0; i < 4; i++) {
    if (maxCascade >= (PRAISE_CASCADES[i] as number) || piecesRemoved >= (PRAISE_PIECES[i] as number)) tier = (i + 1) as PraiseTier;
  }
  return tier;
}

function isGemLike(kind: PieceKind | null): boolean {
  return kind === 'gem' || kind === 'beamH' || kind === 'beamV' || kind === 'nova' || kind === 'prism';
}

export interface TurnStats {
  maxCascade: number;
  /** gem-like pieces that left the board */
  pieces: number;
  /** special + special swap combos and whole-board prisms */
  combos: number;
  /** specials that fired */
  blasts: number;
}

/** What a turn's transcript amounts to (praise, haptics, statistics). */
export function turnStats(steps: readonly Step[]): TurnStats {
  const out: TurnStats = { maxCascade: 0, pieces: 0, combos: 0, blasts: 0 };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as Step;
    if (step.type === 'clear') {
      if (step.cascade > out.maxCascade) out.maxCascade = step.cascade;
      for (let k = 0; k < step.hits.length; k++) {
        const hit = step.hits[k] as Hit;
        if ((hit.result === 'removed' || hit.result === 'activated') && isGemLike(hit.kind)) out.pieces++;
      }
    } else if (step.type === 'activate') {
      for (let k = 0; k < step.fx.length; k++) {
        out.blasts++;
        if (isComboFx((step.fx[k] as { kind: FxKind }).kind)) out.combos++;
      }
    }
  }
  return out;
}

// ───────────────────────────── effects ─────────────────────────────

export function isComboFx(kind: FxKind): boolean {
  return kind === 'cross' || kind === 'bigCross' || kind === 'bigNova' || kind === 'prismAll';
}

/** The sound of a special firing. */
export function fxSound(kind: FxKind): SfxName {
  switch (kind) {
    case 'beamH':
    case 'beamV':
      return 'beam';
    case 'nova':
      return 'nova';
    case 'prism':
      return 'prism';
    default:
      return 'bigCombo';
  }
}

/** The sound of a special being made. */
export function createSound(kind: PieceKind): SfxName {
  if (kind === 'prism') return 'createPrism';
  if (kind === 'nova') return 'createNova';
  return 'createBeam';
}

/** Sparse haptics: nothing for plain matches or landings (docs/STRATEGY.md "feel-05"). */
export const HAPTICS: Readonly<Record<string, HapticKind>> = {
  swap: 'light',
  invalid: 'error',
  create: 'medium',
  blast: 'heavy',
  combo: 'heavy',
  win: 'success',
  cascade: 'light',
};

// ───────────────────────────── live goal counters ─────────────────────────────

/** Running progress of the level's goals while a transcript plays (the engine's rules, hit by hit). */
export interface GoalTracker {
  /** Current value of every goal, in the level's goal order, never above its target. */
  readonly current: number[];
  readonly target: number[];
  readonly goals: Goal[];
  score: number;
  /** Take the engine's numbers (start of a turn, and after it to correct any drift). */
  sync(progress: readonly GoalProgress[], score: number): void;
  /** Apply one hit; returns the indexes of goals that changed (a shared scratch array). */
  hit(hit: Hit): readonly number[];
  /** A lamp delivered. */
  lamp(count: number): readonly number[];
  addScore(points: number): readonly number[];
  done(index: number): boolean;
  remaining(index: number): number;
}

export function createGoalTracker(progress: readonly GoalProgress[], score: number): GoalTracker {
  const goals: Goal[] = [];
  const current: number[] = [];
  const target: number[] = [];
  const changed: number[] = [];

  function bump(i: number, by: number): void {
    const before = current[i] as number;
    const after = Math.min(target[i] as number, before + by);
    if (after !== before) {
      current[i] = after;
      changed.push(i);
    }
  }

  const tracker: GoalTracker = {
    current,
    target,
    goals,
    score,
    sync(p, s) {
      goals.length = 0;
      current.length = 0;
      target.length = 0;
      for (let i = 0; i < p.length; i++) {
        const g = p[i] as GoalProgress;
        goals.push(g.goal);
        current.push(g.current);
        target.push(g.target);
      }
      tracker.score = s;
    },
    hit(hit) {
      changed.length = 0;
      const gone = hit.result === 'removed' || hit.result === 'activated';
      for (let i = 0; i < goals.length; i++) {
        const goal = goals[i] as Goal;
        switch (goal.kind) {
          case 'color':
            if (gone && hit.color === goal.color) bump(i, 1);
            break;
          case 'sand':
            if (hit.sandLeft !== undefined) bump(i, 1);
            break;
          case 'stone':
            if (hit.kind === 'stone' && hit.result === 'removed') bump(i, 1);
            break;
          case 'vine':
            if (hit.kind === 'vine' && hit.result === 'removed') bump(i, 1);
            break;
          case 'chain':
            if (hit.result === 'unchained') bump(i, 1);
            break;
          default:
            break;
        }
      }
      return changed;
    },
    lamp(count) {
      changed.length = 0;
      for (let i = 0; i < goals.length; i++) if ((goals[i] as Goal).kind === 'lamp') bump(i, count);
      return changed;
    },
    addScore(points) {
      changed.length = 0;
      tracker.score += points;
      for (let i = 0; i < goals.length; i++) {
        if ((goals[i] as Goal).kind !== 'score') continue;
        const before = current[i] as number;
        const after = Math.min(target[i] as number, tracker.score);
        if (after !== before) {
          current[i] = after;
          changed.push(i);
        }
      }
      return changed;
    },
    done(i) {
      return (current[i] as number) >= (target[i] as number);
    },
    remaining(i) {
      return Math.max(0, (target[i] as number) - (current[i] as number));
    },
  };
  tracker.sync(progress, score);
  return tracker;
}
