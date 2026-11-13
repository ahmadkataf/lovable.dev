/**
 * Output stage shared by the live engine and the offline checker:
 *
 *   sfx bus ─┐
 *            ├─► master gain ─► limiter (DynamicsCompressor) ─► trim ─► guard ─► destination
 *   music bus┘
 *
 * The limiter catches the sum of many simultaneous effects. Its make-up gain lets a heavy
 * overload settle a little under full scale; the trim brings that ceiling down to just below
 * the guard's knee. The guard is a wave shaper that is exactly linear below
 * {@link GUARD_KNEE} and bends smoothly towards {@link GUARD_CEILING} above it, so whatever
 * slips past the limiter's attack still cannot reach full scale. In normal play only the
 * limiter ever works; the guard is a safety net.
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

export interface OutputChain {
  sfxBus: GainNode;
  musicBus: GainNode;
  master: GainNode;
  limiter: DynamicsCompressorNode;
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

  const guard = ctx.createWaveShaper();
  guard.curve = guardCurve();
  guard.oversample = 'none';

  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(limiter);
  limiter.connect(trim);
  trim.connect(guard);
  guard.connect(destination || ctx.destination);
  return { sfxBus, musicBus, master, limiter, trim, guard, output: guard };
}
