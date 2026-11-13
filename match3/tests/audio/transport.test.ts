import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR, createComposer } from '../../src/audio/phrase.ts';
import {
  BASE_LOOKAHEAD,
  MAX_LOOKAHEAD,
  MIN_LEAD,
  RESYNC_AFTER,
  Transport,
  lookaheadFor,
  type MusicEvent,
} from '../../src/audio/transport.ts';

interface Emitted {
  ev: MusicEvent;
  /** audio time at which it was handed out */
  now: number;
}

/** Drive a transport with scheduler ticks at the given times. */
function run(transport: Transport, ticks: number[], lookahead: (gap: number) => number): Emitted[] {
  const out: Emitted[] = [];
  let last = -1;
  for (const now of ticks) {
    const gap = last < 0 ? 0 : now - last;
    last = now;
    for (const ev of transport.collect(now, now + lookahead(gap))) out.push({ ev, now });
  }
  return out;
}

function steady(from: number, to: number, period: number): number[] {
  const t: number[] = [];
  for (let x = from; x < to; x += period) t.push(x);
  return t;
}

/** Every event the composer writes for the first `bars` bars, with its ideal grid time. */
function planned(track: 'menu' | 'level', seed: number, start: number, bars: number): { time: number; layer: string }[] {
  const c = createComposer(track, seed);
  const step = 60 / c.style.bpm / 4;
  const out: { time: number; layer: string }[] = [];
  for (let b = 0; b < bars; b++) {
    const bar = c.nextBar();
    const t0 = start + b * step * STEPS_PER_BAR;
    if (bar.pad) out.push({ time: t0, layer: 'pad' });
    for (const n of bar.lead) out.push({ time: t0 + n.step * step, layer: 'lead' });
    for (const h of bar.perc) out.push({ time: t0 + h.step * step, layer: 'perc' });
  }
  return out;
}

/** How many values of `a` have no partner in `b` within `tolerance`. */
function unmatched(a: number[], b: number[], tolerance: number): number {
  const sorted = b.slice().sort((x, y) => x - y);
  let missing = 0;
  for (const x of a) {
    let lo = 0;
    let hi = sorted.length - 1;
    let found = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (Math.abs(sorted[mid] - x) < tolerance) {
        found = true;
        break;
      }
      if (sorted[mid] < x) lo = mid + 1;
      else hi = mid - 1;
    }
    if (!found) missing++;
  }
  return missing;
}

describe('lookaheadFor', () => {
  it('is 150 ms while the timer is healthy', () => {
    expect(BASE_LOOKAHEAD).toBeCloseTo(0.15, 9);
    expect(lookaheadFor(0)).toBe(BASE_LOOKAHEAD);
    expect(lookaheadFor(0.025)).toBe(BASE_LOOKAHEAD);
    expect(lookaheadFor(0.05)).toBe(BASE_LOOKAHEAD);
    expect(lookaheadFor(NaN)).toBe(BASE_LOOKAHEAD);
  });

  it('grows past the gap when ticks are late, up to a bound', () => {
    for (const gap of [0.1, 0.25, 0.5, 1]) {
      expect(lookaheadFor(gap)).toBeGreaterThan(gap);
      expect(lookaheadFor(gap)).toBeLessThanOrEqual(MAX_LOOKAHEAD);
    }
    expect(lookaheadFor(60)).toBe(MAX_LOOKAHEAD);
  });
});

describe('Transport with a healthy timer', () => {
  it('hands out every event once, on the grid, ahead of time and in order', () => {
    for (const track of ['menu', 'level'] as const) {
      const start = 0.06;
      const composer = createComposer(track, 31);
      const t = new Transport(composer, start, 31);
      const seconds = 60;
      const got = run(t, steady(0, seconds, 0.025), lookaheadFor);
      const bars = Math.floor((seconds - start) / t.barDur);
      const plan = planned(track, 31, start, bars);
      expect(t.stats.dropped).toBe(0);
      expect(t.stats.resyncs).toBe(0);
      expect(t.stats.events).toBe(got.length);
      // everything planned for the full bars was emitted (the last, partial bar may add more)
      expect(got.length).toBeGreaterThanOrEqual(plan.length);
      const sortedPlan = plan.map((p) => p.time).sort((a, b) => a - b);
      const sortedGot = got.map((g) => g.ev.time).sort((a, b) => a - b);
      for (let i = 0; i < sortedPlan.length; i++) {
        // humanised by a few milliseconds at most, never bunched
        expect(Math.abs(sortedGot[i] - sortedPlan[i])).toBeLessThan(0.0075);
      }
      let prev = -Infinity;
      for (const g of got) {
        expect(g.ev.time).toBeGreaterThanOrEqual(g.now + MIN_LEAD);
        expect(g.ev.time).toBeLessThan(g.now + BASE_LOOKAHEAD + 1e-9);
        expect(g.ev.time).toBeGreaterThanOrEqual(prev);
        prev = g.ev.time;
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = run(new Transport(createComposer('level', 8), 0.06, 8), steady(0, 20, 0.025), lookaheadFor);
    const b = run(new Transport(createComposer('level', 8), 0.06, 8), steady(0, 20, 0.025), lookaheadFor);
    expect(a.map((x) => x.ev)).toEqual(b.map((x) => x.ev));
  });

  it('gives durations in seconds from the tempo', () => {
    const t = new Transport(createComposer('menu', 1), 0.06);
    expect(t.stepDur).toBeCloseTo(60 / 90 / 4, 9);
    expect(t.barDur).toBeCloseTo((60 / 90) * 4, 9);
    const got = run(t, steady(0, 12, 0.025), lookaheadFor);
    expect(got.some((g) => g.ev.layer === 'pad')).toBe(true);
    for (const g of got) {
      if (g.ev.layer === 'pad') expect(g.ev.dur).toBeCloseTo(2 * t.barDur, 6);
      if (g.ev.layer === 'lead') expect(g.ev.dur).toBeGreaterThan(0);
    }
  });
});

describe('Transport with an unreliable timer', () => {
  it('a timer throttled to once a second still schedules every note in time', () => {
    const start = 0.06;
    const t = new Transport(createComposer('level', 12), start, 12);
    // healthy for 3 s, then the page is hidden: one tick per second
    const ticks = steady(0, 3, 0.025).concat(steady(3.9, 40, 1));
    const got = run(t, ticks, lookaheadFor);
    // only the very first long gap can cost notes (the window had not widened yet)
    const lateWindow = got.filter((g) => g.now > 3.5 && g.now < 4.5);
    expect(lateWindow.length).toBeGreaterThan(0);
    const before = planned('level', 12, start, 18);
    const lost = before.filter((p) => p.time > 3.1 && p.time < 3.9).length;
    expect(t.stats.dropped).toBeLessThanOrEqual(lost);
    expect(t.stats.resyncs).toBe(0);
    for (const g of got) expect(g.ev.time).toBeGreaterThanOrEqual(g.now + MIN_LEAD - 1e-9);
    // after the widening nothing else is lost: every note planned from 4.2 s on is there,
    // within its few milliseconds of humanisation, and nothing extra appears
    const planLater = before.filter((p) => p.time > 4.2 && p.time < 37.5 && p.layer !== 'pad').map((p) => p.time);
    const gotTimes = got.filter((g) => g.ev.layer !== 'pad').map((g) => g.ev.time);
    expect(planLater.length).toBeGreaterThan(100);
    expect(unmatched(planLater, gotTimes, 0.0075)).toBe(0);
    expect(unmatched(gotTimes.filter((x) => x > 4.2 && x < 37.5), before.map((p) => p.time), 0.0075)).toBe(0);
  });

  it('late notes are dropped, never played "now" in a bunch', () => {
    const start = 0.06;
    const t = new Transport(createComposer('level', 3), start, 3);
    // a fixed 150 ms window and a 250 ms hiccup: the notes in the gap are simply late
    const ticks = steady(0, 2, 0.025).concat(steady(2.25, 6, 0.025));
    const got = run(t, ticks, () => BASE_LOOKAHEAD);
    expect(t.stats.resyncs).toBe(0);
    const firstAfter = got.filter((g) => g.now >= 2.25 && g.now < 2.26);
    for (const g of firstAfter) expect(g.ev.time).toBeGreaterThanOrEqual(2.25 + MIN_LEAD - 1e-9);
    // no two notes of different grid positions end up at (nearly) the same time
    const lead = got.filter((g) => g.ev.layer === 'lead' && (g.ev as { kind: string }).kind === 'note').map((g) => g.ev.time);
    for (let i = 1; i < lead.length; i++) expect(lead[i] - lead[i - 1]).toBeGreaterThan(-1e-9);
    const plan = planned('level', 3, start, 2).filter((p) => p.layer !== 'pad');
    const expectedDrops = plan.filter((p) => p.time > 2.16 && p.time < 2.245).length;
    expect(t.stats.dropped).toBeGreaterThanOrEqual(expectedDrops);
    expect(t.stats.dropped).toBeLessThanOrEqual(expectedDrops + 3);
  });

  it('after a long stall the bar grid restarts just ahead of the clock', () => {
    const t = new Transport(createComposer('menu', 2), 0.06, 2);
    const ticks = steady(0, 4, 0.025).concat(steady(34, 40, 0.025));
    const got = run(t, ticks, () => BASE_LOOKAHEAD);
    expect(t.stats.resyncs).toBe(1);
    const after = got.filter((g) => g.now >= 34);
    expect(after.length).toBeGreaterThan(3);
    for (const g of after) expect(g.ev.time).toBeGreaterThanOrEqual(g.now + MIN_LEAD - 1e-9);
    // music resumes at once instead of skipping silently through thirty seconds of bars
    expect(after[0].ev.time).toBeLessThan(34 + 0.2);
    // and the stall did not make it "catch up" by emitting the missed bars
    expect(got.filter((g) => g.ev.time > 4.2 && g.ev.time < 33.9).length).toBe(0);
    expect(t.stats.bars).toBeLessThan(8);
    expect(RESYNC_AFTER).toBeGreaterThan(BASE_LOOKAHEAD);
  });

  it('a drone chord may still enter late; it is shortened, not dropped', () => {
    const t = new Transport(createComposer('menu', 2), 1, 2);
    // first tick comes 100 ms after the first bar should have begun
    const got = run(t, [1.1], () => BASE_LOOKAHEAD);
    const pad = got.filter((g) => g.ev.layer === 'pad');
    expect(pad.length).toBe(1);
    expect(pad[0].ev.time).toBeCloseTo(1.1 + MIN_LEAD, 9);
    const ev = pad[0].ev as { time: number; dur: number };
    expect(ev.time + ev.dur).toBeCloseTo(1 + 2 * t.barDur, 6);
  });
});
