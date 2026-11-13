/**
 * Admission control for sound effects (pure logic, times in seconds on any monotonic clock).
 *
 * Two rules keep a big cascade from flooding the audio thread:
 *  1. the same sound (same key) is not started twice within `minInterval`;
 *  2. no more than `maxVoices` effects sound at once. Sounds flagged as priority (result
 *     jingles and the like) may use `priorityExtra` additional voices so they are never
 *     the ones dropped behind a wall of gem clears.
 */

export interface SfxGateOptions {
  minInterval?: number;
  maxVoices?: number;
  priorityExtra?: number;
}

export const SFX_MIN_INTERVAL = 0.03;
export const SFX_MAX_VOICES = 24;
export const SFX_PRIORITY_EXTRA = 4;

export class SfxGate {
  readonly minInterval: number;
  readonly maxVoices: number;
  readonly priorityExtra: number;
  private lastStart: Map<string, number> = new Map();
  private ends: number[] = [];

  constructor(options: SfxGateOptions = {}) {
    this.minInterval = options.minInterval ?? SFX_MIN_INTERVAL;
    this.maxVoices = options.maxVoices ?? SFX_MAX_VOICES;
    this.priorityExtra = options.priorityExtra ?? SFX_PRIORITY_EXTRA;
  }

  /** Voices still sounding at `now`. */
  active(now: number): number {
    const ends = this.ends;
    let kept = 0;
    for (let i = 0; i < ends.length; i++) {
      if (ends[i] > now) ends[kept++] = ends[i];
    }
    ends.length = kept;
    return kept;
  }

  /**
   * May a sound with this key start at `now`? A `true` answer records the start for the
   * rate limit; the caller then reports the voice's end with {@link register}.
   */
  admit(key: string, now: number, priority: boolean = false): boolean {
    const prev = this.lastStart.get(key);
    // `now < prev` means the clock restarted (new audio context): never block on that.
    if (prev !== undefined && now >= prev && now - prev < this.minInterval) return false;
    const limit = this.maxVoices + (priority ? this.priorityExtra : 0);
    if (this.active(now) >= limit) return false;
    this.lastStart.set(key, now);
    return true;
  }

  /** Record when an admitted voice will fall silent. */
  register(endTime: number): void {
    this.ends.push(endTime);
  }

  /** Forget everything (voices were cut, or the clock changed). */
  reset(): void {
    this.lastStart.clear();
    this.ends.length = 0;
  }
}
