import { describe, expect, it, vi } from 'vitest';
import { createRng } from '../../src/engine/index.ts';

// Generous: these tests are fast, but the suite must not fail because the machine is busy with other work.
vi.setConfig({ testTimeout: 120_000 });

describe('createRng', () => {
  it('is deterministic per seed and different across seeds', () => {
    const take = (seed: number): number[] => {
      const rng = createRng(seed);
      return Array.from({ length: 20 }, () => rng.next());
    };
    expect(take(123)).toEqual(take(123));
    expect(take(123)).not.toEqual(take(124));
    expect(take(0)).not.toEqual(take(1));
  });

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const rng = createRng(99);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 100000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]!++;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9300);
      expect(count).toBeLessThan(10700);
    }
  });

  it('int(n) returns integers in [0, n) and covers the range', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(rng.int(1)).toBe(0);
    expect(rng.int(0)).toBe(0);
    expect(rng.int(-3)).toBe(0);
  });

  it('pick() returns elements of the array and throws on an empty one', () => {
    const rng = createRng(7);
    const items = ['a', 'b', 'c'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(rng.pick(items));
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
    expect(() => rng.pick([])).toThrow();
  });

  it('shuffle() permutes in place, returns the same array, and actually mixes', () => {
    const rng = createRng(11);
    const arr = Array.from({ length: 30 }, (_, i) => i);
    const out = rng.shuffle(arr);
    expect(out).toBe(arr);
    expect(arr.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(arr).not.toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle([1])).toEqual([1]);
    // every position can receive every element
    const firsts = new Set<number>();
    for (let i = 0; i < 300; i++) firsts.add(createRng(i).shuffle([0, 1, 2, 3])[0]!);
    expect(firsts.size).toBe(4);
  });

  it('accepts any number as a seed', () => {
    for (const seed of [-1, 1.5, 2 ** 40, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER]) {
      const rng = createRng(seed);
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(createRng(Number.NaN).next()).toBe(createRng(0).next());
  });
});
