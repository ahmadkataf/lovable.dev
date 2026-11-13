/** Small seeded random helpers (pure). The music must be reproducible for a given seed. */

export type Rng = () => number;

/** mulberry32: fast 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index chosen with probability proportional to its weight. Zero/negative weights are never picked. */
export function pickWeighted(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i]);
  if (!(total > 0)) return 0;
  let r = rng() * total;
  let last = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, weights[i]);
    if (w <= 0) continue;
    last = i;
    r -= w;
    if (r < 0) return i;
  }
  return last;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
