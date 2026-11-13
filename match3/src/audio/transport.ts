/**
 * Music timing (pure). Pulls bars from the composer and hands out their events with absolute
 * times on the audio clock, a little ahead of "now" (lookahead scheduling).
 *
 * The caller ticks from a timer. Timers are unreliable — a busy frame delays them, a hidden
 * page throttles them to once a second or worse — so two things keep the music intact:
 *   - {@link lookaheadFor} widens the scheduling window when ticks arrive late, so a slow but
 *     regular timer still gets every note scheduled before it is due;
 *   - an event that is already in the past when it is reached is dropped, never played "now",
 *     and after a long stall the bar grid restarts just ahead of the clock. Late notes
 *     therefore cannot bunch up into a burst.
 */
import { STEPS_PER_BAR, type Composer, type LeadKind, type PercKind } from './phrase.ts';
import { mulberry32, type Rng } from './rng.ts';

export type MusicEvent =
  | { layer: 'lead'; time: number; bar: number; midi: number; dur: number; vel: number; kind: LeadKind }
  | { layer: 'perc'; time: number; bar: number; hit: PercKind; vel: number }
  | { layer: 'pad'; time: number; bar: number; midis: number[]; dur: number; vel: number };

/** Scheduling window with a healthy timer (seconds). */
export const BASE_LOOKAHEAD = 0.15;
/** Upper bound of the window when the timer is throttled. */
export const MAX_LOOKAHEAD = 1.6;
/**
 * Events closer to "now" than this are treated as late. The audio clock advances a whole
 * device buffer at a time (10–20 ms on phones), so a note aimed nearer than that may find its
 * start already in the past and come in clipped.
 */
export const MIN_LEAD = 0.02;
/** Falling further behind than this restarts the bar grid instead of skipping note by note. */
export const RESYNC_AFTER = 0.35;
/** After a restart the next bar begins this far ahead. */
export const RESTART_LEAD = 0.06;

/** How far ahead to schedule, given the time (s) since the previous scheduler tick. */
export function lookaheadFor(gap: number): number {
  if (!(gap > 0.06)) return BASE_LOOKAHEAD;
  return Math.min(MAX_LOOKAHEAD, gap * 1.5 + BASE_LOOKAHEAD);
}

export interface TransportStats {
  bars: number;
  events: number;
  dropped: number;
  resyncs: number;
}

export class Transport {
  readonly stepDur: number;
  readonly barDur: number;
  readonly stats: TransportStats = { bars: 0, events: 0, dropped: 0, resyncs: 0 };
  private composer: Composer;
  private human: Rng;
  private queue: MusicEvent[] = [];
  private cursor = 0;
  private nextBarTime: number;

  constructor(composer: Composer, startTime: number, seed: number = 1) {
    this.composer = composer;
    this.stepDur = 60 / composer.style.bpm / 4;
    this.barDur = this.stepDur * STEPS_PER_BAR;
    this.nextBarTime = startTime;
    this.human = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  }

  /** Start time of the next bar that has not been loaded yet. */
  get upcomingBarTime(): number {
    return this.nextBarTime;
  }

  /**
   * Events due before `until`, in time order. `now` is the current audio time; anything that
   * should already have sounded is skipped.
   */
  collect(now: number, until: number): MusicEvent[] {
    const out: MusicEvent[] = [];
    for (;;) {
      if (this.cursor >= this.queue.length) {
        if (this.nextBarTime >= until) break;
        if (this.nextBarTime < now - RESYNC_AFTER) {
          this.nextBarTime = now + RESTART_LEAD;
          this.stats.resyncs++;
        }
        this.loadBar();
        continue;
      }
      const ev = this.queue[this.cursor];
      if (ev.time >= until) break;
      this.cursor++;
      if (ev.time < now + MIN_LEAD) {
        // A sustained drone may still come in late; a note or a drum hit may not.
        if (ev.layer === 'pad' && ev.time + ev.dur > now + 1) {
          const start = now + MIN_LEAD;
          out.push({ layer: 'pad', time: start, bar: ev.bar, midis: ev.midis, dur: ev.time + ev.dur - start, vel: ev.vel });
          this.stats.events++;
        } else {
          this.stats.dropped++;
        }
        continue;
      }
      out.push(ev);
      this.stats.events++;
    }
    return out;
  }

  private loadBar(): void {
    const bar = this.composer.nextBar();
    const t0 = this.nextBarTime;
    const step = this.stepDur;
    const events: MusicEvent[] = [];
    if (bar.pad) {
      events.push({ layer: 'pad', time: t0, bar: bar.index, midis: bar.pad.midis, dur: bar.pad.bars * this.barDur, vel: bar.pad.vel });
    }
    for (let i = 0; i < bar.lead.length; i++) {
      const n = bar.lead[i];
      // A few milliseconds of looseness, like a hand; ornaments stay tight to their note.
      const loose = n.kind === 'note' || n.kind === 'bass' ? (this.human() - 0.5) * 0.01 : (this.human() - 0.5) * 0.004;
      events.push({
        layer: 'lead',
        time: Math.max(t0, t0 + n.step * step + loose),
        bar: bar.index,
        midi: n.midi,
        dur: n.len * step,
        vel: n.vel,
        kind: n.kind,
      });
    }
    for (let i = 0; i < bar.perc.length; i++) {
      const h = bar.perc[i];
      events.push({
        layer: 'perc',
        time: Math.max(t0, t0 + h.step * step + (this.human() - 0.5) * 0.006),
        bar: bar.index,
        hit: h.kind,
        vel: h.vel,
      });
    }
    events.sort((a, b) => a.time - b.time);
    this.queue = events;
    this.cursor = 0;
    this.nextBarTime = t0 + this.barDur;
    this.stats.bars++;
  }
}
