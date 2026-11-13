/**
 * Tickers: the one clock of the meta screens. A ticker calls its function once at the start and
 * then right after every second boundary of the countdown the function reports (lives timer),
 * so a "mm:ss" text changes exactly when its second is over — no drift, no skipped or doubled
 * seconds as with a plain 1-second interval. While the app is paused nothing ticks; coming back
 * ticks at once, so whatever is on screen is fresh in the same frame.
 *
 * Pure apart from the injected timer functions (unit-tested under Node).
 */

export interface TimerHost {
  set(fn: () => void, ms: number): number;
  clear(handle: number): void;
}

/**
 * What a tick function returns: the milliseconds left on the countdown it displays (rounded UP
 * to whole seconds on screen), or nothing / 0 when no countdown is running.
 */
export type Tick = () => number | void;

export interface Tickers {
  /** Start a ticker (first call right away unless paused). Returns its stop function. */
  add(tick: Tick): () => void;
  /** Pause / resume every ticker. */
  setPaused(paused: boolean): void;
  paused(): boolean;
  /** Tickers currently registered (for tests). */
  count(): number;
}

/** A little past the boundary, so the value read there has really changed. */
const MARGIN_MS = 25;
const IDLE_MS = 1000;

/** Time until a countdown with `left` ms to go next shows a different second (see `Tick`). */
export function nextTickDelay(left: number | void): number {
  if (typeof left !== 'number' || !isFinite(left) || left <= 0) return IDLE_MS;
  const part = left % 1000;
  return (part > 0 ? part : 1000) + MARGIN_MS;
}

export function createTickers(host: TimerHost): Tickers {
  interface Entry {
    tick: Tick;
    timer: number;
    live: boolean;
  }
  const entries: Entry[] = [];
  let paused = false;

  function run(entry: Entry): void {
    entry.timer = 0;
    if (!entry.live || paused) return;
    let left: number | void = undefined;
    try {
      left = entry.tick();
    } catch (err) {
      if (typeof console !== 'undefined') console.error('[ui] ticker failed', err);
    }
    // the tick may have stopped its own ticker, or paused everything
    if (!entry.live || paused || entry.timer !== 0) return;
    entry.timer = host.set(() => run(entry), nextTickDelay(left));
  }

  function halt(entry: Entry): void {
    if (entry.timer !== 0) host.clear(entry.timer);
    entry.timer = 0;
  }

  return {
    add(tick: Tick): () => void {
      const entry: Entry = { tick, timer: 0, live: true };
      entries.push(entry);
      run(entry);
      return () => {
        if (!entry.live) return;
        entry.live = false;
        halt(entry);
        const i = entries.indexOf(entry);
        if (i >= 0) entries.splice(i, 1);
      };
    },

    setPaused(value: boolean): void {
      if (value === paused) return;
      paused = value;
      for (const entry of entries.slice()) {
        if (!entry.live) continue;
        halt(entry);
        if (!paused) run(entry);
      }
    },

    paused: () => paused,
    count: () => entries.length,
  };
}
