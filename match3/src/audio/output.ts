/**
 * Output stage shared by the live engine and the offline checker:
 *
 *   sfx bus ─┐
 *            ├─► master gain ─► limiter (DynamicsCompressor) ─► guard ─► destination
 *   music bus┘
 *
 * The limiter catches the sum of many simultaneous effects. The guard is a wave shaper that
 * is exactly linear below {@link GUARD_KNEE} and bends smoothly towards {@link GUARD_CEILING}
 * above it; whatever gets past the limiter's attack therefore still cannot reach full scale.
 */

export const LEVELS = {
  /** Effects bus. */
  sfx: 1,
  /** Music bus — the music sits well under the effects. */
  music: 0.5,
  /** Master, ahead of the limiter. */
  master: 0.7,
};

export const GUARD_KNEE = 0.8;
export const GUARD_CEILING = 0.96;

export interface OutputChain {
  sfxBus: GainNode;
  musicBus: GainNode;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  guard: WaveShaperNode;
  /** Last node of the chain (already connected to the destination). */
  output: AudioNode;
}

/** Transfer curve of the guard: identity up to the knee, then a tanh bend to the ceiling. */
export function guardCurve(points: number = 4097, knee: number = GUARD_KNEE, ceiling: number = GUARD_CEILING): Float32Array {
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
  limiter.threshold.value = -10;
  limiter.knee.value = 6;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.18;

  const guard = ctx.createWaveShaper();
  guard.curve = guardCurve();
  guard.oversample = 'none';

  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(limiter);
  limiter.connect(guard);
  guard.connect(destination || ctx.destination);
  return { sfxBus, musicBus, master, limiter, guard, output: guard };
}
