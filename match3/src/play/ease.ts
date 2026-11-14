/** Easing curves (t in 0..1 → 0..1). Pure. */

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const outQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const inQuad: Ease = (t) => t * t;
export const outCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const inCubic: Ease = (t) => t * t * t;
export const inOutQuad: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const inOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Overshoots a little past 1, then settles (bouncy pop-in). */
export const outBack: Ease = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};

/** A stronger overshoot for big pops (stars, praise). */
export const outBackBig: Ease = (t) => {
  const c1 = 2.6;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};

export const outElastic: Ease = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
};

/** 0 → 1 → 0, peaking in the middle (a single hop). */
export const hop: Ease = (t) => Math.sin(Math.PI * (t < 0 ? 0 : t > 1 ? 1 : t));

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
