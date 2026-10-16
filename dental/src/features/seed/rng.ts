// A small seeded PRNG (mulberry32) so the demo data comes out the same on every run: same patients, same
// schedule, same money — only the ids and the absolute dates (relative to today) differ.

export const DEMO_SEED = 0x0d3e70a

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next: () => number
  constructor(seed = DEMO_SEED) { this.next = mulberry32(seed) }
  /** [0, 1) */
  float(): number { return this.next() }
  /** Integer in [min, max], both included. */
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)) }
  /** Number in [min, max) rounded to `step`. */
  range(min: number, max: number, step = 1): number { return Math.round((min + this.next() * (max - min)) / step) * step }
  chance(p: number): boolean { return this.next() < p }
  pick<T>(list: readonly T[]): T { return list[Math.floor(this.next() * list.length)] }
  /** Picks by weight: [[value, weight], …]. */
  weighted<T>(pairs: readonly (readonly [T, number])[]): T {
    const total = pairs.reduce((a, [, w]) => a + w, 0)
    let r = this.next() * total
    for (const [v, w] of pairs) { r -= w; if (r < 0) return v }
    return pairs[pairs.length - 1][0]
  }
  shuffle<T>(list: readonly T[]): T[] {
    const a = [...list]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    return a
  }
  /** k distinct elements. */
  sample<T>(list: readonly T[], k: number): T[] { return this.shuffle(list).slice(0, Math.max(0, Math.min(k, list.length))) }
  /** A fresh, independent generator derived from this one (keeps sub-sequences stable when one part changes). */
  fork(): Rng { return new Rng(Math.floor(this.next() * 0xffffffff)) }
}
