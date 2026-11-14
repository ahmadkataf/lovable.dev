/**
 * The ONE timing table of the play screen (docs/STRATEGY.md "feel-01-responsiveness").
 * Every duration is in milliseconds of game time. Nothing else in src/play hard-codes a duration.
 * Pure data + pure helpers: safe to import under Node (unit tests, tools).
 */

export const T = {
  // ── touch ──
  /** selected gem grows to 112 % */
  touchResponse: 80,
  /** a drag released below the commit threshold glides home */
  snapBack: 100,

  // ── swap ──
  swap: 160,
  invalidOut: 130,
  invalidBack: 130,
  invalidWobble: 80,

  // ── clear ──
  /** grow to 115 % … */
  popGrow: 60,
  /** … then shrink to nothing */
  popShrink: 120,
  /** gems of a 4 / 5 / L match slide into the cell of the new special */
  converge: 140,
  /** white flash on a freshly made special */
  createFlash: 80,
  /** pop-in of the new special: 0 → 110 % → 100 % */
  createPop: 200,
  /** delay between two hits of one plain match wave (a tiny ripple) */
  matchRipple: 14,

  // ── specials ──
  specialWindup: 80,
  beamSweep: 220,
  novaBlast: 260,
  bigBlast: 340,
  prismRay: 30,
  prismRaysMax: 420,
  /** flight of one prism ray */
  prismFlight: 180,
  prismAllWave: 520,
  /** stagger between pieces of a prism + special transform */
  transformStagger: 26,
  transformMax: 220,
  transformPop: 180,

  // ── gravity ──
  /** fall(n cells) = fallBase × n^fallPower */
  fallBase: 90,
  fallPower: 0.6,
  columnStagger: 20,
  columnStaggerMax: 100,
  /** touch-down: squash, a small rebound, rest (cosmetic — control is back at touch-down) */
  landSquash: 150,

  // ── other steps ──
  scorePopup: 560,
  scorePopupFade: 200,
  collectSlide: 260,
  flyToChip: 350,
  grow: 320,
  shuffle: 520,
  hammer: 300,
  recolor: 260,

  // ── cascade pacing ──
  /** every duration × this per cascade above the first … */
  cascadeFactor: 0.92,
  /** … but never below this */
  cascadeFloor: 0.6,

  // ── feedback ──
  shakeSmall: 200,
  shakeBig: 300,
  /** at most one full-board flash per this long */
  flashGap: 1000,
  flash: 140,
  slowMo: 120,
  praiseIn: 220,
  praiseHold: 700,
  praiseOut: 200,
  chainBadge: 700,

  // ── hint ──
  idleHint: 5000,
  /** levels 1–10 */
  idleHintEarly: 3000,
  hintRepeat: 5000,
  /** two bounces toward each other */
  hintBounce: 600,
  /** the hint halo stays this long (it stays up until the next hint: hintRepeat) */
  hintShow: 5000,
  /** while a hint is up, a swell of light and a nudge of the two pieces toward each other every … */
  hintCue: 1600,
  /** … taking this long (out and back) */
  hintNudge: 440,

  // ── input ──
  /** a swap made while the board resolves waits at most this long (real time) */
  bufferExpiry: 1500,

  // ── level flow ──
  dropIn: 600,
  goalBannerIn: 240,
  goalBannerHold: 800,
  goalBannerOut: 200,
  shuffleBanner: 1100,
  finaleBanner: 700,
  /** first end-bonus flight; each next one × finaleFlightFactor, never below finaleFlightFloor */
  finaleFlight: 200,
  finaleFlightFactor: 0.9,
  finaleFlightFloor: 60,
  /** the whole finale (banner excluded) is compressed to this */
  finaleMax: 5000,
  /** win dialog: one star */
  star: 300,
  scoreCount: 600,
  loseDim: 300,
  /** result-dialog buttons ignore input this long */
  dialogLock: 600,
  movesPulse: 500,
  hudScore: 350,
} as const;

/** Moves left at which the low-moves cue starts. */
export const LOW_MOVES = 5;
/** Levels up to this one get the early idle hint and the engine's best move as the hint. */
export const EARLY_LEVELS = 10;
/** Invalid swaps in a row that bring the hint up at once. */
export const INVALID_FOR_HINT = 3;
/** A drag commits on release at this share of a cell. */
export const DRAG_COMMIT = 0.45;
/** The dragged gem follows the finger for at most this many cells. */
export const DRAG_MAX = 1;
/** `fast=1`: everything runs this many times faster (automated play). */
export const FAST_FACTOR = 6;

/** Speed factor of a cascade: 1 for the first wave, × 0.92 per further cascade, floor 0.6. */
export function cascadeScale(cascade: number): number {
  if (!(cascade > 1)) return 1;
  const k = Math.pow(T.cascadeFactor, cascade - 1);
  return k < T.cascadeFloor ? T.cascadeFloor : k;
}

/** Duration of a fall over `cells` cells (1 → 90, 3 → 174, 6 → 264, 8 → 313). */
export function fallDuration(cells: number): number {
  const n = cells > 0 ? cells : 0;
  if (n === 0) return 0;
  return Math.round(T.fallBase * Math.pow(n, T.fallPower));
}

/** Start delay of a falling column: 20 ms per column step, 100 ms in total at most. */
export function columnDelay(order: number, columns: number): number {
  if (!(order > 0)) return 0;
  const step = columns > 1 ? Math.min(T.columnStagger, T.columnStaggerMax / (columns - 1)) : 0;
  return Math.round(order * step);
}

/** Delay of the nth prism ray so that all rays leave within `prismRaysMax`. */
export function prismRayDelay(index: number, count: number): number {
  if (!(index > 0)) return 0;
  const step = count > 1 ? Math.min(T.prismRay, T.prismRaysMax / (count - 1)) : 0;
  return Math.round(index * step);
}

/** Delay of the nth piece of a staggered transform. */
export function transformDelay(index: number, count: number): number {
  if (!(index > 0)) return 0;
  const step = count > 1 ? Math.min(T.transformStagger, T.transformMax / (count - 1)) : 0;
  return Math.round(index * step);
}

/**
 * Flight times of the end-bonus pieces: 200, 180, 162 … never below 60, then the whole list is
 * compressed so that it sums to at most `budget` ms.
 */
export function finaleFlights(count: number, budget: number): number[] {
  const out: number[] = [];
  let d: number = T.finaleFlight;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const v = d < T.finaleFlightFloor ? T.finaleFlightFloor : d;
    out.push(v);
    sum += v;
    d *= T.finaleFlightFactor;
  }
  if (sum > budget && sum > 0) {
    const k = budget / sum;
    for (let i = 0; i < out.length; i++) out[i] = Math.max(16, Math.round((out[i] as number) * k));
  }
  return out;
}

/** Idle-hint delay for a level. */
export function hintDelay(levelId: number): number {
  return levelId <= EARLY_LEVELS ? T.idleHintEarly : T.idleHint;
}
