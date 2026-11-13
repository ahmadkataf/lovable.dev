/**
 * Output stage shared by the live engine and the offline checker:
 *
 *   effects ───────────────────────────► sfx bus ──┐
 *                                                   ├─► master ─► limiter ─► trim ─► guard ─► out
 *   music ─► music in ─► glue ─► clip ─► music bus ─┘          └► start-up bypass ─┘
 *
 * The chain is transparent for anything that is not too loud: from a bus to the output the
 * gain is exactly 1, so a sound that peaks at −12 dB on the effects bus peaks at −12 dBFS in
 * the speaker. That is what makes the loudness tiers of the mix (sfx.ts, docs/STRATEGY.md
 * audio-01) plain numbers that can be measured.
 *
 * Loud sums are another matter. One effect on its own never reaches the limiter (the loudest
 * tier peaks at −5 dBFS, the limiter starts a little above −4); several at once do, and are
 * held just under the guard's knee. The guard is a wave shaper that is exactly linear below
 * {@link GUARD_KNEE} and bends smoothly towards {@link GUARD_CEILING} — −1 dBFS — above it,
 * so whatever slips past the limiter's attack still cannot go over the ceiling. In normal
 * play only the limiter ever works; the guard is a safety net.
 *
 * Start-up bypass: Chrome's DynamicsCompressor begins life with its gain held far down and
 * needs about 0.18 s to open (measured: −15 dB at first, whatever it is fed). On a live
 * context that is exactly when the tap that unlocked audio wants to be heard. For the first
 * {@link STARTUP_BYPASS} seconds the chain therefore goes round the limiter, at the gain the
 * limiter gives quiet signals, and then cross-fades onto it. The guard is in circuit all the
 * time, so the bypass cannot clip either.
 */

/** Limiter settings: a hard knee, a steep ratio, quick to grab and quick enough to let go. */
export const LIMITER = { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.18 };

/**
 * Gain the limiter gives signals under its threshold. A DynamicsCompressorNode adds make-up
 * gain by itself: (1 / the gain it would apply to a full-scale signal) ^ 0.6, which for the
 * settings above is 10^(0.6 × 5.7 / 20). The checker measures the end-to-end gain of the
 * chain (it must be 0.0 dB), so a browser that computed this differently would be noticed.
 */
export const LIMITER_MAKEUP = Math.pow(10, (0.6 * -LIMITER.threshold * (1 - 1 / LIMITER.ratio)) / 20);

/** Master gain ahead of the limiter. */
const MASTER = 0.8;

/**
 * The music's own dynamics, ahead of its bus gain. Plucked strings and drum hits are all
 * spike and little body: brought down to the music's peak level as they are, the tune itself
 * would be almost inaudible. A gentle compressor ("glue") evens the notes out, and a soft
 * clipper — linear below {@link MUSIC_KNEE}, bending towards {@link MUSIC_CEILING} — rounds
 * off the few spikes that are left. Whatever is played, the clipper's output never exceeds
 * MUSIC_CEILING, so the music's peak level in the mix is a fixed number.
 */
export const MUSIC_GLUE = { threshold: -20, knee: 12, ratio: 2.5, attack: 0.003, release: 0.14 };
export const MUSIC_KNEE = 0.32;
export const MUSIC_CEILING = 0.5;
/** The music's peak level at the output, dBFS: 20 dB down, under every effect. */
export const MUSIC_PEAK_DB = -20;

export const LEVELS = {
  /** Effects bus. The tiers of sfx.ts are peak levels on this bus. */
  sfx: 1,
  /** Music bus, after the music's clipper: brings its ceiling to {@link MUSIC_PEAK_DB}. */
  music: Math.pow(10, MUSIC_PEAK_DB / 20) / MUSIC_CEILING,
  /** Master, ahead of the limiter. */
  master: MASTER,
  /** After the limiter: makes the gain from bus to output exactly 1. */
  trim: 1 / (MASTER * LIMITER_MAKEUP),
};

/** Bus level (and so output level) at which the limiter starts to work: about −4 dBFS. */
export const LIMITER_ONSET = Math.pow(10, LIMITER.threshold / 20) / MASTER;

/** The guard is linear up to here (−3 dBFS) … */
export const GUARD_KNEE = 0.708;
/** … and never lets anything past this: −1 dBFS, the ceiling of the whole mix. */
export const GUARD_CEILING = 0.891;

/** The limiter is bypassed until this long after the chain was built (s) … */
export const STARTUP_BYPASS = 0.16;
/** … and the cross-fade onto it takes this long (s). */
export const STARTUP_FADE = 0.04;

export interface OutputChainOptions {
  /** Leave out the music's compressor and/or clipper (measurement only). */
  musicGlue?: boolean;
  musicClip?: boolean;
}

export interface OutputChain {
  sfxBus: GainNode;
  /** Where music players connect. */
  musicIn: GainNode;
  /** The music's level in the mix; the engine dips it while a big effect plays. */
  musicBus: GainNode;
  musicGlue: DynamicsCompressorNode | null;
  musicClip: WaveShaperNode | null;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  /** Limiter path and start-up bypass path into the trim (see the file comment). */
  wet: GainNode;
  dry: GainNode;
  trim: GainNode;
  guard: WaveShaperNode;
  /** Last node of the chain (already connected to the destination). */
  output: AudioNode;
}

/** Transfer curve of the guard: identity up to the knee, then a tanh bend to the ceiling. */
export function guardCurve(points: number = 4097, knee: number = GUARD_KNEE, ceiling: number = GUARD_CEILING): Float32Array<ArrayBuffer> {
  const n = points | 1;
  const curve = new Float32Array(n);
  const room = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = (2 * i) / (n - 1) - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = x < 0 ? -y : y;
  }
  curve[(n - 1) / 2] = 0;
  return curve;
}

export function createOutputChain(ctx: BaseAudioContext, destination?: AudioNode, options: OutputChainOptions = {}): OutputChain {
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = LEVELS.sfx;

  const musicIn = ctx.createGain();
  musicIn.gain.value = 1;
  let musicTail: AudioNode = musicIn;
  let musicGlue: DynamicsCompressorNode | null = null;
  if (options.musicGlue !== false) {
    musicGlue = ctx.createDynamicsCompressor();
    musicGlue.threshold.value = MUSIC_GLUE.threshold;
    musicGlue.knee.value = MUSIC_GLUE.knee;
    musicGlue.ratio.value = MUSIC_GLUE.ratio;
    musicGlue.attack.value = MUSIC_GLUE.attack;
    musicGlue.release.value = MUSIC_GLUE.release;
    musicTail.connect(musicGlue);
    musicTail = musicGlue;
  }
  let musicClip: WaveShaperNode | null = null;
  if (options.musicClip !== false) {
    musicClip = ctx.createWaveShaper();
    musicClip.curve = guardCurve(4097, MUSIC_KNEE, MUSIC_CEILING);
    musicClip.oversample = 'none';
    musicTail.connect(musicClip);
    musicTail = musicClip;
  }
  const musicBus = ctx.createGain();
  musicBus.gain.value = LEVELS.music;
  musicTail.connect(musicBus);
  const master = ctx.createGain();
  master.gain.value = LEVELS.master;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.threshold;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;

  const trim = ctx.createGain();
  trim.gain.value = LEVELS.trim;

  // Start-up bypass. Times are relative to the chain's creation, which for the engine is the
  // context's creation: a context that is still suspended has a frozen clock, so the bypass
  // covers the first moments of real running time.
  const born = ctx.currentTime;
  const wet = ctx.createGain();
  wet.gain.value = 0;
  wet.gain.setValueAtTime(0, born + STARTUP_BYPASS);
  wet.gain.linearRampToValueAtTime(1, born + STARTUP_BYPASS + STARTUP_FADE);
  const dry = ctx.createGain();
  dry.gain.value = LIMITER_MAKEUP;
  dry.gain.setValueAtTime(LIMITER_MAKEUP, born + STARTUP_BYPASS);
  dry.gain.linearRampToValueAtTime(0, born + STARTUP_BYPASS + STARTUP_FADE);

  const guard = ctx.createWaveShaper();
  guard.curve = guardCurve();
  guard.oversample = 'none';

  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(limiter);
  limiter.connect(wet);
  wet.connect(trim);
  master.connect(dry);
  dry.connect(trim);
  trim.connect(guard);
  guard.connect(destination || ctx.destination);
  return { sfxBus, musicIn, musicBus, musicGlue, musicClip, master, limiter, wet, dry, trim, guard, output: guard };
}
