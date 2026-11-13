/**
 * Animation clock of the play screen.
 *
 *  - `Scheduler`: tweens and delays in GAME time. It only advances when the frame loop calls
 *    `step(dt)`, so pausing the loop pauses every animation, and `fast=1` simply feeds it more
 *    time per frame. `clear()` drops everything (pending promises are simply never resolved —
 *    the async code awaiting them is garbage-collected with them).
 *  - `Timers`: wall-clock timeouts that can be paused / resumed / cancelled together (idle hint,
 *    banner removal). They do not keep the frame loop alive.
 *
 * No DOM access here; `Timers` takes the timeout functions as parameters so it runs under Node.
 */
import type { Ease } from './ease.ts';
import { linear } from './ease.ts';

interface Tween {
  /** elapsed time, negative while the start delay runs */
  t: number;
  dur: number;
  ease: Ease;
  update: ((k: number) => void) | null;
  resolve: (() => void) | null;
  dead: boolean;
}

export class Scheduler {
  private readonly tweens: Tween[] = [];
  /** Game time in ms since creation / the last clear. */
  time = 0;
  private stepping = false;
  /**
   * Called whenever something is scheduled, so the owner can make sure frames are running. (Code
   * that awaits one tween and then starts the next does so in a microtask — after the frame that
   * finished the first one may already have decided there is nothing left to animate.)
   */
  onSchedule: (() => void) | null = null;

  private add(tween: Tween): void {
    this.tweens.push(tween);
    if (this.onSchedule) this.onSchedule();
  }

  /** Run `update(k)` with k from 0 to 1 over `dur` ms (after `delay`). Resolves when it is done. */
  tween(dur: number, update: ((k: number) => void) | null, ease?: Ease, delay?: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.add({ t: -(delay || 0), dur: dur > 0 ? dur : 0, ease: ease || linear, update, resolve, dead: false });
    });
  }

  /** Fire-and-forget tween (no promise allocated). */
  run(dur: number, update: (k: number) => void, ease?: Ease, delay?: number): void {
    this.add({ t: -(delay || 0), dur: dur > 0 ? dur : 0, ease: ease || linear, update, resolve: null, dead: false });
  }

  wait(ms: number): Promise<void> {
    return this.tween(ms, null);
  }

  /** Call `fn` after `ms` of game time. */
  after(ms: number, fn: () => void): void {
    this.add({ t: 0, dur: ms > 0 ? ms : 0, ease: linear, update: null, resolve: fn, dead: false });
  }

  active(): boolean {
    return this.tweens.length > 0;
  }

  count(): number {
    return this.tweens.length;
  }

  step(dt: number): void {
    if (this.stepping) return;
    this.stepping = true;
    this.time += dt;
    const list = this.tweens;
    // Tweens added during this step (by an update or a resolve) start on the next frame.
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const tw = list[i] as Tween;
      if (tw.dead) continue;
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = tw.dur <= 0 ? 1 : tw.t >= tw.dur ? 1 : tw.t / tw.dur;
      if (tw.update) tw.update(k >= 1 ? 1 : tw.ease(k));
      if (k >= 1) {
        tw.dead = true;
        const done = tw.resolve;
        tw.resolve = null;
        tw.update = null;
        if (done) done();
      }
    }
    // compact
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i] as Tween;
      if (!tw.dead) list[w++] = tw;
    }
    list.length = w;
    this.stepping = false;
  }

  /** Drop every tween without finishing it. */
  clear(): void {
    const list = this.tweens;
    for (let i = 0; i < list.length; i++) {
      const tw = list[i] as Tween;
      tw.dead = true;
      tw.update = null;
      tw.resolve = null;
    }
    if (!this.stepping) list.length = 0;
  }
}

interface TimerEntry {
  id: number;
  fn: () => void;
  /** ms left when paused */
  left: number;
  /** wall-clock time at which it fires while running */
  due: number;
  handle: unknown;
}

export interface TimerHost {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}

/** Wall-clock timeouts that pause, resume and cancel as a group. */
export class Timers {
  private readonly host: TimerHost;
  private readonly entries: TimerEntry[] = [];
  private nextId = 1;
  private paused = false;

  constructor(host: TimerHost) {
    this.host = host;
  }

  after(ms: number, fn: () => void): number {
    const entry: TimerEntry = { id: this.nextId++, fn, left: ms > 0 ? ms : 0, due: 0, handle: null };
    this.entries.push(entry);
    if (!this.paused) this.arm(entry);
    return entry.id;
  }

  cancel(id: number): void {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i] as TimerEntry;
      if (entry.id !== id) continue;
      if (entry.handle !== null) this.host.clear(entry.handle);
      this.entries.splice(i, 1);
      return;
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = this.host.now();
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i] as TimerEntry;
      if (entry.handle !== null) {
        this.host.clear(entry.handle);
        entry.handle = null;
      }
      entry.left = Math.max(0, entry.due - now);
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (let i = 0; i < this.entries.length; i++) this.arm(this.entries[i] as TimerEntry);
  }

  clear(): void {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i] as TimerEntry;
      if (entry.handle !== null) this.host.clear(entry.handle);
    }
    this.entries.length = 0;
  }

  /**
   * While paused: let `ms` pass by hand and fire what falls due, oldest first (frame-by-frame
   * review and tests). Does nothing while the timers run on the real clock.
   */
  advance(ms: number): void {
    if (!this.paused || !(ms > 0)) return;
    const due: TimerEntry[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i] as TimerEntry;
      entry.left -= ms;
      if (entry.left <= 0) due.push(entry);
    }
    due.sort((a, b) => a.left - b.left || a.id - b.id);
    for (let i = 0; i < due.length; i++) {
      const entry = due[i] as TimerEntry;
      const at = this.entries.indexOf(entry);
      if (at < 0) continue; // cancelled by an earlier one
      this.entries.splice(at, 1);
      entry.fn();
    }
  }

  count(): number {
    return this.entries.length;
  }

  private arm(entry: TimerEntry): void {
    entry.due = this.host.now() + entry.left;
    entry.handle = this.host.set(() => {
      entry.handle = null;
      const at = this.entries.indexOf(entry);
      if (at < 0) return;
      this.entries.splice(at, 1);
      entry.fn();
    }, entry.left);
  }
}
