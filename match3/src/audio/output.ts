/**
 * Output stage shared by the live engine and the offline checker:
 *
 *   sfx bus ─┐
 *            ├─► master gain ─► limiter (DynamicsCompressor) ─► trim ─► guard ─► destination
 *   music bus┘               └► start-up bypass (first 0.2 s only) ─┘
 *
 * The limiter catches the sum of many simultaneous effects. Its make-up gain lets a heavy
 * overload settle a little under full scale; the trim brings that ceiling down to just below
 * the guard's knee. The guard is a wave shaper that is exactly linear below
 * {@link GUARD_KNEE} and bends smoothly towards {@link GUARD_CEILING} above it, so whatever
 * slips past the limiter's attack still cannot reach full scale. In normal play only the
 * limiter ever works; the guard is a safety net.
 *
 * Start-up bypass: Chrome's DynamicsCompressor begins life with its gain held far down and
 * needs about 0.18 s to open (measured: −15 dB at first, whatever it is fed). On a live
 * context that is exactly when the tap that unlocked audio wants to be heard. For the first
 * {@link STARTUP_BYPASS} seconds the chain therefore goes round the limiter, at the gain the
 * limiter gives quiet signals, and then cross-fades onto it. The guard is in circuit all the
 * time, so the bypass cannot clip either.
 */

export const LEVELS = {
  /** Effects bus. */
  sfx: 1,
  /** Music bus — the music sits well under the effects. */
  music: 0.72,
  /** Master, ahead of the limiter. */
  master: 0.7,
  /** After the limiter: keeps its ceiling under the guard's knee. */
  trim: 0.86,
};

export const GUARD_KNEE = 0.8;
export const GUARD_CEILING = 0.96;

/** The limiter is bypassed until this long after the chain was built (s) … */
export const STARTUP_BYPASS = 0.16;
/** … and the cross-fade onto it takes this long (s). */
export const STARTUP_FADE = 0.04;
/**
 * Gain of the limiter for signals under its threshold (its make-up gain for the settings
 * below; measured −2.1 dB end to end = 0.7 × 0.86 × this). The bypass uses the same gain so
 * levels do not step at the hand-over.
 */
export const LIMITER_MAKEUP = 1.304;

export interface OutputChain {
  sfxBus: GainNode;
  musicBus: GainNode;
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

export function createOutputChain(ctx: BaseAudioContext, destination?: AudioNode): OutputChain {
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = LEVELS.sfx;
  const musicBus = ctx.createGain();
  musicBus.gain.value = LEVELS.music;
  const master = ctx.createGain();
  master.gain.value = LEVELS.master;

  const limiter = ctx.createDynamicsCompressor();
  // A hard knee just under full scale: one effect on its own passes untouched (the chain is
  // linear up to a bus level of about 0.9); only sums of several are held back.
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.18;

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
  return { sfxBus, musicBus, master, limiter, wet, dry, trim, guard, output: guard };
}
