/**
 * Seeded pseudo-random numbers (mulberry32). The engine never calls Math.random: every random
 * decision goes through one Rng owned by the Game, so "same level + seed + inputs" always replays
 * to the same game (docs/DESIGN.md §2.12).
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). Returns 0 when n <= 1. */
  int(n: number): number;
  /** Uniform element of a non-empty array (throws on an empty one). */
  pick<T>(arr: readonly T[]): T;
  /** In-place Fisher–Yates shuffle. Returns the same array for chaining. */
  shuffle<T>(arr: T[]): T[];
  /** An independent generator that continues with exactly the same sequence (used by `Game.clone`). */
  clone(): Rng;
}

export function createRng(seed: number): Rng {
  // Any finite number is accepted; it is folded into an unsigned 32-bit state.
  let state = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (n: number): number => (n > 1 ? Math.floor(next() * n) : 0);

  return {
    next,
    int,
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[int(arr.length)] as T;
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const tmp = arr[i] as T;
        arr[i] = arr[j] as T;
        arr[j] = tmp;
      }
      return arr;
    },
    // The whole state is one unsigned 32-bit number, and createRng() folds its seed to exactly that.
    clone: (): Rng => createRng(state),
  };
}
