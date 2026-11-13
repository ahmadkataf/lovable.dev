import { describe, expect, it } from 'vitest';
import { createTickers, nextTickDelay } from '../../src/ui/ticker.ts';

/** A hand-driven clock: timers fire when `advance` passes their due time, in order. */
function fakeHost() {
  let now = 0;
  let seq = 0;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  return {
    host: {
      set(fn: () => void, ms: number): number {
        const id = ++seq;
        timers.push({ id, at: now + ms, fn });
        return id;
      },
      clear(id: number): void {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
    },
    now: () => now,
    pending: () => timers.length,
    advance(ms: number): void {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

describe('tickers', () => {
  it('the next tick falls just after the countdown shows a new second', () => {
    expect(nextTickDelay(4321)).toBe(321 + 25);
    expect(nextTickDelay(4000)).toBe(1000 + 25); // exactly on a boundary: "00:04" stays for a whole second
    expect(nextTickDelay(1)).toBe(1 + 25);
    expect(nextTickDelay(0)).toBe(1000);
    expect(nextTickDelay(undefined)).toBe(1000);
    expect(nextTickDelay(-5)).toBe(1000);
    expect(nextTickDelay(NaN)).toBe(1000);
    expect(nextTickDelay(Infinity)).toBe(1000);
  });

  it('a countdown is shown second by second without drift, skips or repeats', () => {
    const clock = fakeHost();
    const tickers = createTickers(clock.host);
    const until = 5400; // a countdown that ends at t = 5400
    const shown: number[] = [];
    const stop = tickers.add(() => {
      const left = Math.max(0, until - clock.now());
      const seconds = Math.ceil(left / 1000);
      if (shown[shown.length - 1] !== seconds) shown.push(seconds);
      return left;
    });
    expect(shown).toEqual([6]); // ticks at once
    clock.advance(6000);
    expect(shown).toEqual([6, 5, 4, 3, 2, 1, 0]);
    stop();
    expect(clock.pending()).toBe(0);
    expect(tickers.count()).toBe(0);
  });

  it('nothing ticks while paused; resuming ticks at once', () => {
    const clock = fakeHost();
    const tickers = createTickers(clock.host);
    let calls = 0;
    tickers.add(() => {
      calls++;
    });
    expect(calls).toBe(1);
    clock.advance(3000);
    expect(calls).toBe(4);
    tickers.setPaused(true);
    expect(clock.pending()).toBe(0);
    clock.advance(60000);
    expect(calls).toBe(4);
    tickers.setPaused(true); // twice is once
    tickers.setPaused(false);
    expect(calls).toBe(5);
    clock.advance(1000);
    expect(calls).toBe(6);
  });

  it('a ticker added while paused waits for the resume', () => {
    const clock = fakeHost();
    const tickers = createTickers(clock.host);
    tickers.setPaused(true);
    let calls = 0;
    const stop = tickers.add(() => {
      calls++;
    });
    clock.advance(5000);
    expect(calls).toBe(0);
    tickers.setPaused(false);
    expect(calls).toBe(1);
    stop();
    stop(); // twice is once
    clock.advance(5000);
    expect(calls).toBe(1);
  });

  it('a tick may stop its own ticker, and a failing tick does not stop the clock', () => {
    const clock = fakeHost();
    const tickers = createTickers(clock.host);
    let once = 0;
    const stopOnce: { fn: (() => void) | null } = { fn: null };
    let pendingStop = false;
    stopOnce.fn = tickers.add(() => {
      once++;
      if (stopOnce.fn) stopOnce.fn();
      else pendingStop = true;
    });
    if (pendingStop && stopOnce.fn) stopOnce.fn(); // the very first tick ran before add() returned
    clock.advance(3000);
    expect(once).toBe(1);

    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };
    try {
      let bad = 0;
      tickers.add(() => {
        bad++;
        throw new Error('boom');
      });
      clock.advance(2000);
      expect(bad).toBe(3);
      expect(errors.length).toBe(3);
    } finally {
      console.error = original;
    }
  });
});
