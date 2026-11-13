/**
 * Effects mixer: everything that happens between "the game asked for a sound" and the sound
 * being in the audio graph. It applies the admission rules (limiter.ts), makes room by
 * fading out a stolen voice, picks the next take of a sound that has several, starts the
 * voice, and dips the music under the big sounds.
 *
 * It only needs a context and an output chain, and every time is given by the caller, so the
 * live engine (index.ts) and the offline renders of the checker run exactly the same mix.
 */
import type { SfxName, SfxOptions } from './types.ts';
import { SfxGate } from './limiter.ts';
import { LEVELS, type OutputChain } from './output.ts';
import { isSfxName, sfxDucksMusic, sfxRequest, sfxTier, sfxVariants, sfxVolume, startSfx } from './sfx.ts';
import { killVoices, type Voice, type VoiceGroup } from './voices.ts';

/** While a special, a big moment or a jingle plays, the music drops by this much (dB) … */
export const MUSIC_DUCK_DB = -4;
/** … for this long (s); under a jingle, for as long as the jingle lasts if that is longer. */
export const MUSIC_DUCK_HOLD = 0.6;
/** Time constants of the dip and of the return (s). */
const DUCK_DOWN = 0.03;
const DUCK_UP = 0.15;
/** A stolen voice fades out over this long (s). */
export const STEAL_FADE = 0.012;
/**
 * A voice whose start is closer to the clock than this (s) once it has been built — or
 * already behind it — is built again: the main thread was held up in the middle of the
 * work (a garbage collection, a busy device), and a sound that starts in the past begins
 * in the middle of its attack, with a click.
 */
export const LATE_MARGIN = 0.002;

export interface SfxMixerStats {
  played: number;
  dropped: number;
  stolen: number;
  /** Voices built a second time because the clock had overtaken their start. */
  rebuilt: number;
}

export class SfxMixer {
  readonly stats: SfxMixerStats = { played: 0, dropped: 0, stolen: 0, rebuilt: 0 };
  /** Effect voices that are scheduled or sounding, so that a cut really stops them. */
  voices: VoiceGroup = new Set<Voice>();
  private ctx: BaseAudioContext;
  private chain: OutputChain;
  private gate: SfxGate<Voice> = new SfxGate<Voice>();
  private takes: { [name: string]: number } = {};
  /** Context time until which the music is held down. */
  private duckEnd = 0;

  constructor(ctx: BaseAudioContext, chain: OutputChain) {
    this.ctx = ctx;
    this.chain = chain;
  }

  get maxVoices(): number {
    return this.gate.maxVoices;
  }

  /** Effect voices sounding at `now` (all, or those of one sound that has its own budget). */
  active(now: number, group?: string): number {
    return this.gate.active(now, group);
  }

  /** Loudness ranks (positions in SFX_TIERS) of the voices sounding at `now`. */
  ranks(now: number): number[] {
    return this.gate.ranks(now);
  }

  /**
   * Play an effect. `now` is the clock the admission rules run on, `when` (≥ now) the context
   * time at which the sound starts. Returns its duration in seconds, 0 if it was not played.
   * On a live context pass `clock` (the context's current time): it is read again once the
   * voice is built, and a voice that the clock has overtaken meanwhile is built afresh.
   */
  play(name: SfxName, opts: SfxOptions | undefined, now: number, when: number, clock?: () => number): number {
    if (!isSfxName(name) || sfxVolume(opts) <= 0) return 0;
    const req = sfxRequest(name, opts);
    const steal = this.gate.admit(req, now);
    if (steal === null) {
      this.stats.dropped++;
      return 0;
    }
    for (let i = 0; i < steal.length; i++) {
      // The stolen voice fades as the new one begins.
      steal[i].handle.fadeOut(when, STEAL_FADE);
      this.stats.stolen++;
    }
    const take = this.takes[name] || 0;
    this.takes[name] = (take + 1) % Math.max(1, sfxVariants(name));
    let voice = startSfx(this.ctx, this.chain.sfxBus, name, when, opts, this.voices, take);
    if (!voice) return 0;
    if (clock) {
      const late = clock();
      if (late > when - LATE_MARGIN) {
        // Overtaken while it was being built: take it back and build it from where the clock is.
        voice.kill();
        when = late + (when - now);
        voice = startSfx(this.ctx, this.chain.sfxBus, name, when, opts, this.voices, take);
        this.stats.rebuilt++;
        if (!voice) return 0;
      }
    }
    this.gate.register(req, when, voice.endTime, voice);
    this.stats.played++;
    if (sfxDucksMusic(name)) {
      this.duck(when, sfxTier(name) === 'jingle' ? Math.max(MUSIC_DUCK_HOLD, voice.duration) : MUSIC_DUCK_HOLD);
    }
    return voice.duration;
  }

  /**
   * Let a big sound speak: pull the music down from `from` for `seconds`, then let it rise
   * again. A second sound that starts meanwhile never brings the music back early.
   */
  duck(from: number, seconds: number): void {
    const g = this.chain.musicBus.gain;
    const end = Math.max(this.duckEnd, from + seconds);
    this.duckEnd = end;
    g.cancelScheduledValues(from);
    g.setTargetAtTime(LEVELS.music * Math.pow(10, MUSIC_DUCK_DB / 20), from, DUCK_DOWN);
    g.setTargetAtTime(LEVELS.music, end, DUCK_UP);
  }

  /** The sound the music was making room for is gone: bring the music back now. */
  unduck(now: number): void {
    if (this.duckEnd <= 0) return;
    this.duckEnd = 0;
    const g = this.chain.musicBus.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(LEVELS.music, now, 0.08);
  }

  /**
   * Forget every voice: the caller is cutting the effects. Returns the voices that were
   * sounding, for the caller to kill once its fade has run.
   */
  detach(): VoiceGroup {
    const cut = this.voices;
    this.voices = new Set<Voice>();
    this.gate.reset();
    return cut;
  }

  /** Stop everything at once. */
  killAll(): void {
    killVoices(this.detach());
  }
}
