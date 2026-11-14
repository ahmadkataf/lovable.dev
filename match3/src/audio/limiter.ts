/**
 * Admission control and voice allocation for sound effects (pure logic; times are seconds on
 * any monotonic clock, the handle of a voice is opaque).
 *
 * Four rules keep a big cascade from flooding the mix (docs/STRATEGY.md, audio-01):
 *  1. the same sound (same key) is not started twice within its minimum interval — 30 ms by
 *     default, longer for sounds that ask for it ('land': 60 ms);
 *  2. a group of sounds has its own small budget ('match': three voices). When the budget is
 *     used up the oldest voice of the group makes room for the new one;
 *  3. no more than {@link SFX_MAX_VOICES} effects sound at once. When all are in use the
 *     quietest voice is stolen — among equally quiet ones the oldest — unless everything that
 *     is sounding is louder than the newcomer, in which case the newcomer is dropped;
 *  4. a voice that started less than the minimum interval ago is never stolen by a sound of
 *     its own loudness rank: a burst of calls in one frame keeps the voices it already has
 *     instead of building and throwing away hundreds.
 * "Quiet" and "loud" are the ranks of the loudness tiers (sfx.ts): a result jingle can always
 * take the place of a landing tick, never the other way round.
 */

export interface SfxGateOptions {
  minInterval?: number;
  maxVoices?: number;
}

/** Same sound twice: not within this many seconds. */
export const SFX_MIN_INTERVAL = 0.03;
/** Effect voices sounding at once. */
export const SFX_MAX_VOICES = 12;
/** 'match' voices sounding at once. */
export const SFX_MATCH_VOICES = 3;
/** 'land' starts at most once per this many seconds. */
export const SFX_LAND_INTERVAL = 0.06;

/** What the gate needs to know about a sound that wants to start. */
export interface SfxRequest {
  /** Identity for the rate limit (name plus audible step). */
  key: string;
  /** Loudness rank: larger = louder / more important. */
  rank: number;
  /** Budget group and its size, if the sound belongs to one. */
  group?: string;
  groupLimit?: number;
  /** Minimum interval between two starts of this key (default: the gate's). */
  minInterval?: number;
}

/** A voice the gate is counting. */
export interface SfxSlot<H> {
  key: string;
  rank: number;
  group: string | undefined;
  start: number;
  end: number;
  handle: H;
}

export class SfxGate<H = unknown> {
  readonly minInterval: number;
  readonly maxVoices: number;
  private lastStart: Map<string, number> = new Map();
  private slots: SfxSlot<H>[] = [];

  constructor(options: SfxGateOptions = {}) {
    this.minInterval = options.minInterval ?? SFX_MIN_INTERVAL;
    this.maxVoices = Math.max(1, options.maxVoices ?? SFX_MAX_VOICES);
  }

  /** Forget the voices that have ended by `now`. */
  private prune(now: number): void {
    const slots = this.slots;
    let kept = 0;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].end > now) slots[kept++] = slots[i];
    }
    slots.length = kept;
  }

  /** Voices still sounding at `now` (all of them, or those of one group). */
  active(now: number, group?: string): number {
    this.prune(now);
    if (group === undefined) return this.slots.length;
    let n = 0;
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i].group === group) n++;
    return n;
  }

  /** Loudness ranks of the voices sounding at `now`, in the order they started. */
  ranks(now: number): number[] {
    this.prune(now);
    return this.slots.map((s) => s.rank);
  }

  /**
   * May this sound start at `now`? `null`: no, drop it. Otherwise the voices that have to
   * make room for it (usually none) — the caller fades them out — and the start is recorded
   * for the rate limit. The caller then reports the new voice with {@link register}.
   */
  admit(req: SfxRequest, now: number): SfxSlot<H>[] | null {
    const interval = req.minInterval === undefined ? this.minInterval : req.minInterval;
    const prev = this.lastStart.get(req.key);
    // `now < prev` means the clock restarted (new audio context): never block on that.
    if (prev !== undefined && now >= prev && now - prev < interval) return null;
    this.prune(now);
    const slots = this.slots;
    const steal: SfxSlot<H>[] = [];

    // The group's own budget: the oldest voice of the group gives way.
    if (req.group !== undefined && req.groupLimit !== undefined) {
      let count = 0;
      let oldest: SfxSlot<H> | null = null;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.group !== req.group) continue;
        count++;
        if (!oldest || s.start < oldest.start) oldest = s;
      }
      if (count >= req.groupLimit && oldest) {
        if (now - oldest.start < this.minInterval) return null;
        steal.push(oldest);
      }
    }

    // The overall budget: the quietest voice gives way, the oldest among equals.
    if (slots.length - steal.length >= this.maxVoices) {
      let victim: SfxSlot<H> | null = null;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (steal.length > 0 && s === steal[0]) continue;
        if (!victim || s.rank < victim.rank || (s.rank === victim.rank && s.start < victim.start)) victim = s;
      }
      if (!victim || victim.rank > req.rank) return null;
      if (victim.rank === req.rank && now - victim.start < this.minInterval) return null;
      steal.push(victim);
    }

    for (let i = 0; i < steal.length; i++) {
      const at = slots.indexOf(steal[i]);
      if (at >= 0) slots.splice(at, 1);
    }
    this.lastStart.set(req.key, now);
    return steal;
  }

  /** Count an admitted voice from `start` until it falls silent at `end`. */
  register(req: SfxRequest, start: number, end: number, handle: H): SfxSlot<H> {
    const slot: SfxSlot<H> = { key: req.key, rank: req.rank, group: req.group, start, end, handle };
    this.slots.push(slot);
    return slot;
  }

  /** Forget everything (voices were cut, or the clock changed). */
  reset(): void {
    this.lastStart.clear();
    this.slots.length = 0;
  }
}
