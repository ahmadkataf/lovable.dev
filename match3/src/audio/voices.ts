/**
 * Voice building blocks. Everything here works against a BaseAudioContext, so the very same
 * code renders live (AudioContext) and offline (OfflineAudioContext, used by the checker).
 *
 * A {@link Voice} is one sound event: a handful of sources feeding one gain node. It counts
 * its running sources and disconnects every node it created once the last one has ended, so
 * finished sounds leave nothing behind in the audio graph.
 */
import { mulberry32 } from './rng.ts';
import { midiToFreq } from './scale.ts';

/** Live voices of a sound source (all effects, or one music player) that can be cut together. */
export type VoiceGroup = Set<Voice>;

export interface VoiceCensus {
  /** Voices that have not released their nodes yet. */
  voices: number;
  /** Audio nodes those voices hold. */
  nodes: number;
  /** Voices ever created on the context. */
  created: number;
}

const censuses = new WeakMap<BaseAudioContext, VoiceCensus>();

function censusOf(ctx: BaseAudioContext): VoiceCensus {
  let c = censuses.get(ctx);
  if (!c) {
    c = { voices: 0, nodes: 0, created: 0 };
    censuses.set(ctx, c);
  }
  return c;
}

/** How many voices and nodes are alive on a context right now (leak checks, debug read-outs). */
export function voiceCensus(ctx: BaseAudioContext): VoiceCensus {
  const c = censusOf(ctx);
  return { voices: c.voices, nodes: c.nodes, created: c.created };
}

export class Voice {
  readonly ctx: BaseAudioContext;
  /** Everything in the voice is mixed here; its gain is the voice's overall level. */
  readonly out: GainNode;
  /** Context time of the voice's start; all `at` offsets are relative to it. */
  readonly t0: number;
  private end: number;
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  /** Stop time of each source, in step with `sources`. */
  private stops: number[] = [];
  private running = 0;
  private released = false;
  private fading = false;
  private noiseCount = 0;
  private census: VoiceCensus;
  private group: VoiceGroup | null;
  /** Position of the voice among all voices of its context: keeps simultaneous noises apart. */
  private serial: number;

  constructor(ctx: BaseAudioContext, dest: AudioNode, t0: number, gain: number, group?: VoiceGroup) {
    this.ctx = ctx;
    this.t0 = t0;
    this.end = t0;
    this.census = censusOf(ctx);
    this.serial = this.census.created;
    this.census.created++;
    this.census.voices++;
    this.group = group || null;
    if (this.group) this.group.add(this);
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    this.out.connect(dest);
    this.track(this.out);
  }

  /** Seconds from the voice's start until its last source stops. */
  get duration(): number {
    return this.end - this.t0;
  }

  /** Context time at which the last source of the voice stops. */
  get endTime(): number {
    return this.end;
  }

  /** True once the voice has given its nodes back (ended, cut or killed). */
  get done(): boolean {
    return this.released;
  }

  /**
   * Where the next noise burst of this voice starts reading the shared noise buffer (s).
   * It depends only on the voice's start time, its number on the context and the burst's
   * position in the recipe: an offline render is reproducible, live repeats of a sound differ
   * slightly, and two voices that start at the same instant never read the same noise (which
   * would add up coherently instead of as noise).
   */
  noiseOffset(): number {
    const x = this.t0 * 7.31 + this.noiseCount++ * 0.173 + (this.serial % 89) * 0.0619;
    return (x - Math.floor(x / 1.2) * 1.2 + 1.2) % 1.2;
  }

  private track(node: AudioNode): void {
    this.nodes.push(node);
    this.census.nodes++;
  }

  /** Register a node so it is disconnected with the voice. */
  keep<T extends AudioNode>(node: T): T {
    this.track(node);
    return node;
  }

  /** Start and stop a source, and tie the voice's lifetime to it. */
  run(src: AudioScheduledSourceNode, start: number, stop: number, offset?: number): void {
    this.track(src);
    this.sources.push(src);
    this.stops.push(stop);
    this.running++;
    src.onended = () => {
      src.onended = null;
      this.running--;
      if (this.running <= 0) this.release();
    };
    if (offset !== undefined) (src as AudioBufferSourceNode).start(start, offset);
    else src.start(start);
    src.stop(stop);
    if (stop > this.end) this.end = stop;
  }

  /** Disconnect every node of the voice. Safe to call more than once. */
  release(): void {
    if (this.released) return;
    this.released = true;
    const nodes = this.nodes;
    for (let i = 0; i < nodes.length; i++) {
      try {
        nodes[i].disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.census.voices--;
    this.census.nodes -= nodes.length;
    nodes.length = 0;
    this.sources.length = 0;
    this.stops.length = 0;
    if (this.group) this.group.delete(this);
  }

  /**
   * Take the voice away without a click: from context time `at` its output fades to nothing
   * over `fade` seconds, then every source is stopped — also those that would only have
   * started later. A voice that has not begun to sound at `at` is simply removed. This is how
   * a voice is stolen when too many effects want to sound at once; it works on a live context
   * and, with a future `at`, in an offline render.
   */
  fadeOut(at: number, fade: number = 0.012): void {
    if (this.released || this.fading) return;
    if (at <= this.t0) {
      this.kill();
      return;
    }
    this.fading = true;
    const f = Math.max(0.002, fade);
    const g = this.out.gain;
    try {
      const level = g.value;
      g.cancelScheduledValues(at);
      g.setValueAtTime(level, at);
      g.linearRampToValueAtTime(0, at + f);
    } catch {
      /* the stop below still ends the voice */
    }
    const stopAt = at + f + 0.003;
    const sources = this.sources;
    for (let i = 0; i < sources.length; i++) {
      if (this.stops[i] <= stopAt) continue;
      try {
        sources[i].stop(stopAt);
        this.stops[i] = stopAt;
      } catch {
        /* already ended */
      }
    }
    if (stopAt < this.end) this.end = stopAt;
  }

  /**
   * Cut the voice now: stop its sources (also those that have not started yet) and release
   * everything. Used when sound is cut — effects switched off, the app going to the
   * background, a music player thrown away — so nothing keeps running unheard.
   */
  kill(): void {
    if (this.released) return;
    const sources = this.sources;
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* never started, or already stopped */
      }
    }
    this.release();
  }
}

/** Kill every voice of a group. */
export function killVoices(group: VoiceGroup): void {
  if (group.size === 0) return;
  const all: Voice[] = [];
  group.forEach((v) => all.push(v));
  for (let i = 0; i < all.length; i++) all[i].kill();
  group.clear();
}

// ───────────────────────────── envelopes ─────────────────────────────

/**
 * 0 → peak (linear, `attack` s) → held for `hold` s → silence (exponential) at `t + dur`.
 * Without a hold the sound is percussive: it starts dying away as soon as it has spoken.
 */
export function adEnv(param: AudioParam, t: number, dur: number, peak: number, attack: number, hold: number = 0): void {
  const a = Math.min(Math.max(attack, 0.001), dur * 0.9);
  const h = Math.min(Math.max(hold, 0), Math.max(0, dur * 0.95 - a));
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  if (h > 0) param.setValueAtTime(peak, t + a + h);
  param.exponentialRampToValueAtTime(Math.max(peak * 0.001, 1e-5), t + dur);
  param.setValueAtTime(0, t + dur);
}

// ───────────────────────────── oscillators ─────────────────────────────

export interface ToneOpts {
  type?: OscillatorType;
  /** Start frequency (Hz) and optional glide target reached after `glide` s (default: `dur`). */
  f: number;
  f2?: number;
  glide?: number;
  /** Offset from the voice start (s). */
  at?: number;
  dur: number;
  peak: number;
  attack?: number;
  /** Time held at the peak before the decay starts (s). */
  hold?: number;
  /** Vibrato rate (Hz) and depth (Hz). */
  vib?: number;
  vibDepth?: number;
  /** Destination inside the voice (default: the voice output). */
  to?: AudioNode;
}

export function tone(v: Voice, o: ToneOpts): void {
  const ctx = v.ctx;
  const t = v.t0 + (o.at || 0);
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined && o.f2 !== o.f) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || o.dur));
  }
  const g = v.keep(ctx.createGain());
  g.gain.value = 0;
  adEnv(g.gain, t, o.dur, o.peak, o.attack === undefined ? 0.004 : o.attack, o.hold);
  osc.connect(g);
  g.connect(o.to || v.out);
  const stop = t + o.dur + 0.02;
  if (o.vib && o.vibDepth) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib;
    const depth = v.keep(ctx.createGain());
    depth.gain.value = o.vibDepth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    v.run(lfo, t, stop);
  }
  v.run(osc, t, stop);
}

export interface FmOpts {
  /** Carrier frequency (Hz), optional glide target reached after `glide` s (default: `dur`). */
  f: number;
  f2?: number;
  glide?: number;
  /** Modulator frequency as a multiple of the carrier … */
  ratio: number;
  /** … of this carrier frequency (default: `f`; give the settled pitch when `f` glides). */
  modOf?: number;
  /** Modulation index at the start (peak deviation = index × modulator frequency) … */
  index: number;
  /** … decaying to this index after `modDur` s (default: 60 % of `dur`). */
  indexEnd?: number;
  modDur?: number;
  at?: number;
  dur: number;
  peak: number;
  attack?: number;
  to?: AudioNode;
}

/**
 * Two-operator FM tone. A modulation index that dies away quickly gives a struck or plucked
 * attack over a pure body — the basis of the bell, chime, pop and clink sounds.
 */
export function fm(v: Voice, o: FmOpts): void {
  const ctx = v.ctx;
  const t = v.t0 + (o.at || 0);
  const carrier = ctx.createOscillator();
  carrier.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined && o.f2 !== o.f) carrier.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.glide || o.dur));
  const mod = ctx.createOscillator();
  const fmod = (o.modOf === undefined ? o.f : o.modOf) * o.ratio;
  mod.frequency.value = fmod;
  const depth = v.keep(ctx.createGain());
  const d0 = Math.max(0.01, o.index * fmod);
  const d1 = Math.max(0.01, (o.indexEnd === undefined ? 0.02 : o.indexEnd) * fmod);
  depth.gain.setValueAtTime(d0, t);
  depth.gain.exponentialRampToValueAtTime(d1, t + (o.modDur || o.dur * 0.6));
  mod.connect(depth);
  depth.connect(carrier.frequency);
  const g = v.keep(ctx.createGain());
  g.gain.value = 0;
  adEnv(g.gain, t, o.dur, o.peak, o.attack === undefined ? 0.003 : o.attack);
  carrier.connect(g);
  g.connect(o.to || v.out);
  const stop = t + o.dur + 0.02;
  v.run(mod, t, stop);
  v.run(carrier, t, stop);
}

// ───────────────────────────── noise ─────────────────────────────

const noiseBuffers: { [rate: string]: AudioBuffer } = {};

/**
 * One shared buffer of white noise per sample rate (generated, not sampled). An AudioBuffer
 * does not belong to the context that made it, so every context of that rate reuses it.
 */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const key = String(ctx.sampleRate);
  let buf = noiseBuffers[key];
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * 1.5);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = mulberry32(0x5eed1e55);
    for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
    noiseBuffers[key] = buf;
  }
  return buf;
}

export interface NoiseOpts {
  type?: BiquadFilterType;
  /** Filter frequency (Hz) and optional sweep target reached after `sweep` s (default: `dur`). */
  f: number;
  f2?: number;
  sweep?: number;
  q?: number;
  at?: number;
  dur: number;
  peak: number;
  attack?: number;
  to?: AudioNode;
}

/** Filtered noise burst; with `f2` the filter sweeps, which is what makes a whoosh or a blast. */
export function noise(v: Voice, o: NoiseOpts): void {
  const ctx = v.ctx;
  const t = v.t0 + (o.at || 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = v.keep(ctx.createBiquadFilter());
  filter.type = o.type || 'bandpass';
  filter.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined && o.f2 !== o.f) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.sweep || o.dur));
  filter.Q.value = o.q === undefined ? 1 : o.q;
  const g = v.keep(ctx.createGain());
  g.gain.value = 0;
  adEnv(g.gain, t, o.dur, o.peak, o.attack === undefined ? 0.003 : o.attack);
  src.connect(filter);
  filter.connect(g);
  g.connect(o.to || v.out);
  v.run(src, t, t + o.dur + 0.02, v.noiseOffset());
}

const saturationCurves: { [hardness: string]: Float32Array<ArrayBuffer> } = {};

/**
 * Soft saturation inside a voice: whatever is routed into the returned node is pushed by
 * `drive` into a tanh curve and can never come out larger than ±1. Quiet parts gain up to
 * `hardness / tanh(hardness)` on the loud ones, so a blast becomes dense and heavy instead of
 * one spike with a thin tail — more weight for the same peak level.
 */
export function saturator(v: Voice, drive: number, hardness: number = 2, to?: AudioNode): GainNode {
  const key = String(hardness);
  let curve = saturationCurves[key];
  if (!curve) {
    const n = 2049;
    curve = new Float32Array(n);
    const top = Math.tanh(hardness);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(hardness * ((2 * i) / (n - 1) - 1)) / top;
    curve[(n - 1) / 2] = 0;
    saturationCurves[key] = curve;
  }
  const input = v.keep(v.ctx.createGain());
  input.gain.value = drive;
  const shaper = v.keep(v.ctx.createWaveShaper());
  shaper.curve = curve;
  shaper.oversample = 'none';
  input.connect(shaper);
  shaper.connect(to || v.out);
  return input;
}

/** A filter inside the voice that other blocks can be routed through (`to`). */
export function filter(
  v: Voice,
  type: BiquadFilterType,
  f: number,
  q: number,
  sweep?: { f2: number; at?: number; dur: number },
  to?: AudioNode,
): BiquadFilterNode {
  const node = v.keep(v.ctx.createBiquadFilter());
  node.type = type;
  node.Q.value = q;
  if (sweep) {
    const t = v.t0 + (sweep.at || 0);
    node.frequency.setValueAtTime(f, t);
    node.frequency.exponentialRampToValueAtTime(Math.max(20, sweep.f2), t + sweep.dur);
  } else {
    node.frequency.value = f;
  }
  node.connect(to || v.out);
  return node;
}

// ───────────────────────────── plucked string ─────────────────────────────

/**
 * Karplus–Strong plucked string, computed into a plain array: a burst of filtered noise
 * circulates in a delay line one period long, losing a little brightness on every pass.
 * Two strings a fraction of a hertz apart are plucked together, like the paired courses of a
 * lute-family instrument; their slow beating lets the overtones fade before the fundamental.
 * Doing this ahead of time (rather than with a DelayNode feedback loop, whose delay cannot be
 * shorter than one render quantum) keeps the tuning exact in every register and makes
 * playback as cheap as a sample.
 */
export function synthPluck(sampleRate: number, freq: number, seconds: number, seed: number): Float32Array {
  const total = Math.max(1, Math.floor(seconds * sampleRate));
  const out = new Float32Array(total);
  // Higher strings ring shorter; low ones are damped a bit so they do not drone on.
  const t60 = Math.min(1.8, Math.max(0.8, 1.95 - freq / 700));
  const detune = [-0.17, 0.17];
  for (let s = 0; s < detune.length; s++) {
    const f = freq + detune[s];
    const period = sampleRate / f;
    // Loop delay = n (line) + 0.5 (two-point average) + frac (all-pass) samples.
    let n = Math.floor(period - 0.5);
    let frac = period - 0.5 - n;
    if (frac < 0.15) {
      n -= 1;
      frac += 1;
    }
    if (n < 2) continue;
    const c = (1 - frac) / (1 + frac);
    const line = new Float32Array(n);
    // Excitation (the same pluck for both strings): low-passed noise — a soft plectrum …
    const rnd = mulberry32(seed >>> 0);
    let lp1 = 0;
    let lp2 = 0;
    let mean = 0;
    for (let i = 0; i < n; i++) {
      lp1 += 0.5 * (rnd() * 2 - 1 - lp1);
      lp2 += 0.6 * (lp1 - lp2);
      line[i] = lp2;
      mean += lp2;
    }
    mean /= n;
    // … with a comb notch for the plucking point, about a fifth of the way along the string.
    const pickAt = Math.max(1, Math.round(n * 0.19));
    const shaped = new Float32Array(n);
    let top = 1e-9;
    for (let i = 0; i < n; i++) {
      const v = line[i] - mean - 0.7 * (line[(i + n - pickAt) % n] - mean);
      shaped[i] = v;
      if (Math.abs(v) > top) top = Math.abs(v);
    }
    for (let i = 0; i < n; i++) line[i] = shaped[i] / top;
    const rho = Math.pow(10, -3 / (t60 * f));
    let idx = 0;
    let prev = 0;
    let apIn = 0;
    let apOut = 0;
    for (let k = 0; k < total; k++) {
      const x = line[idx];
      out[k] += x;
      const avg = rho * 0.5 * (x + prev);
      prev = x;
      const y = c * avg + apIn - c * apOut;
      apIn = avg;
      apOut = y;
      line[idx] = y;
      idx++;
      if (idx === n) idx = 0;
    }
  }
  // Round off the pluck's first spike (it would otherwise dictate the level of the whole
  // note), normalise, and shape the two ends so the buffer starts and stops without a click.
  let peak = 1e-9;
  for (let i = 0; i < total; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i]);
  const drive = 2.2 / peak;
  const norm = 0.9 / Math.tanh(2.2);
  const fadeIn = Math.min(total, Math.floor(sampleRate * 0.0008));
  const fadeOut = Math.min(total, Math.floor(sampleRate * 0.04));
  for (let i = 0; i < total; i++) {
    let g = norm;
    if (i < fadeIn) g *= i / fadeIn;
    if (i >= total - fadeOut) g *= (total - i) / fadeOut;
    out[i] = Math.tanh(out[i] * drive) * g;
  }
  return out;
}

/** Length of a pluck buffer for a pitch (s): long enough for the string to die away. */
export function pluckSeconds(freq: number): number {
  return Math.min(1.7, Math.max(0.8, 1.85 - freq / 800));
}

const pluckBuffers: { [key: string]: AudioBuffer } = {};

/**
 * Cached pluck for a MIDI note, synthesised on first use. `alt` selects a second take of the
 * same note (another pluck of the string), so quick repeats do not sound stamped out.
 * The cache is per sample rate, not per context: the samples are kept once, in the
 * AudioBuffer itself, and every context of that rate plays from it.
 */
export function pluckBuffer(ctx: BaseAudioContext, midi: number, alt: boolean = false): AudioBuffer {
  const m = Math.round(midi);
  const key = ctx.sampleRate + ':' + (m * 2 + (alt ? 1 : 0));
  let buf = pluckBuffers[key];
  if (!buf) {
    const f = midiToFreq(m);
    const data = synthPluck(ctx.sampleRate, f, pluckSeconds(f), 1000 + m + (alt ? 5000 : 0));
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    pluckBuffers[key] = buf;
  }
  return buf;
}

/**
 * The notes the music's lead can play, most likely first: every scale tone from G3 to A5 and
 * the open low D. The engine synthesises these in the background after unlocking, one at a
 * time, so that a new pitch never costs a frame in the middle of play.
 */
export const LEAD_MIDI: readonly number[] = [62, 69, 67, 66, 63, 74, 72, 70, 60, 50, 58, 57, 55, 75, 78, 79, 81];

export interface PluckOpts {
  midi: number;
  at?: number;
  /** How long the string is left to ring before it is damped (s). */
  dur: number;
  peak: number;
  /** Detune in cents. */
  cents?: number;
  /** Use the second take of the note (see pluckBuffer). */
  alt?: boolean;
  to?: AudioNode;
}

export function pluck(v: Voice, o: PluckOpts): void {
  const ctx = v.ctx;
  const t = v.t0 + (o.at || 0);
  const buf = pluckBuffer(ctx, o.midi, o.alt === true);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  if (o.cents) src.detune.value = o.cents;
  const ring = Math.max(0.06, Math.min(o.dur, buf.duration - 0.01));
  const damp = Math.min(0.09, ring * 0.5);
  const g = v.keep(ctx.createGain());
  g.gain.value = 0;
  g.gain.setValueAtTime(o.peak, t);
  g.gain.setValueAtTime(o.peak, t + ring - damp);
  g.gain.linearRampToValueAtTime(0, t + ring);
  src.connect(g);
  g.connect(o.to || v.out);
  v.run(src, t, t + ring + 0.01);
}

// ───────────────────────────── hand drum ─────────────────────────────

/** "Dum": the low open stroke — a sine that drops in pitch, with a soft skin thump. */
export function dum(v: Voice, at: number, vel: number, to?: AudioNode): void {
  tone(v, { f: 168, f2: 74, glide: 0.09, at, dur: 0.26, peak: 0.8 * vel, attack: 0.003, to });
  // The upper layers keep the stroke audible where a small speaker has no bass.
  tone(v, { type: 'triangle', f: 336, f2: 150, glide: 0.07, at, dur: 0.14, peak: 0.42 * vel, attack: 0.002, to });
  noise(v, { type: 'lowpass', f: 1400, q: 0.7, at, dur: 0.035, peak: 0.6 * vel, attack: 0.001, to });
}

/** "Tek": the bright rim stroke — a short band of noise with a ringing partial. */
export function tek(v: Voice, at: number, vel: number, to?: AudioNode): void {
  noise(v, { type: 'bandpass', f: 3400, q: 1.4, at, dur: 0.07, peak: 0.62 * vel, attack: 0.001, to });
  tone(v, { f: 1180, f2: 1050, at, dur: 0.06, peak: 0.24 * vel, attack: 0.001, to });
  tone(v, { type: 'triangle', f: 590, at, dur: 0.05, peak: 0.14 * vel, attack: 0.001, to });
}

/** "Ka": a lighter, drier tap. */
export function ka(v: Voice, at: number, vel: number, to?: AudioNode): void {
  noise(v, { type: 'bandpass', f: 2300, q: 2.2, at, dur: 0.045, peak: 0.5 * vel, attack: 0.001, to });
  tone(v, { f: 820, f2: 760, at, dur: 0.04, peak: 0.18 * vel, attack: 0.001, to });
}

/** A soft jingle/shaker tick. */
export function shake(v: Voice, at: number, vel: number, to?: AudioNode): void {
  noise(v, { type: 'highpass', f: 6500, q: 0.7, at, dur: 0.055, peak: 0.3 * vel, attack: 0.008, to });
}
