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

export class Voice {
  readonly ctx: BaseAudioContext;
  /** Everything in the voice is mixed here; its gain is the voice's overall level. */
  readonly out: GainNode;
  /** Context time of the voice's start; all `at` offsets are relative to it. */
  readonly t0: number;
  private end: number;
  private nodes: AudioNode[] = [];
  private running = 0;
  private released = false;

  constructor(ctx: BaseAudioContext, dest: AudioNode, t0: number, gain: number) {
    this.ctx = ctx;
    this.t0 = t0;
    this.end = t0;
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    this.out.connect(dest);
    this.nodes.push(this.out);
  }

  /** Seconds from the voice's start until its last source stops. */
  get duration(): number {
    return this.end - this.t0;
  }

  /** Register a node so it is disconnected with the voice. */
  keep<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  /** Start and stop a source, and tie the voice's lifetime to it. */
  run(src: AudioScheduledSourceNode, start: number, stop: number, offset?: number): void {
    this.nodes.push(src);
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
      } catch (_e) {
        /* already disconnected */
      }
    }
    nodes.length = 0;
  }
}

// ───────────────────────────── envelopes ─────────────────────────────

/** 0 → peak (linear, `attack` s) → silence (exponential) at `t + dur`. */
export function adEnv(param: AudioParam, t: number, dur: number, peak: number, attack: number): void {
  const a = Math.min(Math.max(attack, 0.001), dur * 0.9);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
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
  adEnv(g.gain, t, o.dur, o.peak, o.attack === undefined ? 0.004 : o.attack);
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
  /** Carrier frequency (Hz), optional glide target reached at the end. */
  f: number;
  f2?: number;
  /** Modulator frequency as a multiple of the carrier. */
  ratio: number;
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
 * attack over a pure body — the basis of the bell, chime and clink sounds.
 */
export function fm(v: Voice, o: FmOpts): void {
  const ctx = v.ctx;
  const t = v.t0 + (o.at || 0);
  const carrier = ctx.createOscillator();
  carrier.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined && o.f2 !== o.f) carrier.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
  const mod = ctx.createOscillator();
  const fmod = o.f * o.ratio;
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

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
let noiseCursor = 0;

/** One shared buffer of white noise per context (generated, not sampled). */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * 1.5);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const rnd = mulberry32(0x5eed1e55);
    for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
    noiseBuffers.set(ctx, buf);
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
  noiseCursor = (noiseCursor + 0.173) % 1.2;
  v.run(src, t, t + o.dur + 0.02, noiseCursor);
}

/** A filter inside the voice that other blocks can be routed through (`to`). */
export function filter(
  v: Voice,
  type: BiquadFilterType,
  f: number,
  q: number,
  sweep?: { f2: number; at?: number; dur: number },
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
  node.connect(v.out);
  return node;
}

// ───────────────────────────── plucked string ─────────────────────────────

/**
 * Karplus–Strong plucked string, computed into a plain array: a burst of filtered noise
 * circulates in a delay line one period long, losing a little brightness on every pass.
 * Two strings a few cents apart are plucked a few milliseconds after each other, like the
 * paired courses of a lute-family instrument. Doing this ahead of time (rather than with a
 * DelayNode feedback loop, whose delay cannot be shorter than one render quantum) keeps the
 * tuning exact in every register and makes playback as cheap as a sample.
 */
export function synthPluck(sampleRate: number, freq: number, seconds: number, seed: number): Float32Array {
  const total = Math.max(1, Math.floor(seconds * sampleRate));
  const out = new Float32Array(total);
  const strings = [
    { f: freq * 0.9987, delay: 0, gain: 1, seed: seed * 2 + 1 },
    { f: freq * 1.0013, delay: Math.floor(sampleRate * 0.0045), gain: 0.85, seed: seed * 2 + 2 },
  ];
  // Higher strings ring shorter; low ones are damped a bit so they do not drone on.
  const t60 = Math.min(1.7, Math.max(0.7, 1.9 - freq / 700));
  for (let s = 0; s < strings.length; s++) {
    const st = strings[s];
    const period = sampleRate / st.f;
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
    const rnd = mulberry32(st.seed >>> 0);
    // Excitation: low-passed noise (a soft plectrum), zero mean …
    let lp = 0;
    let mean = 0;
    for (let i = 0; i < n; i++) {
      lp += 0.55 * (rnd() * 2 - 1 - lp);
      line[i] = lp;
      mean += lp;
    }
    mean /= n;
    // … with a comb notch for the plucking point, about a fifth of the way along the string.
    const pickAt = Math.max(1, Math.round(n * 0.19));
    const shaped = new Float32Array(n);
    let peak = 1e-9;
    for (let i = 0; i < n; i++) {
      const v = line[i] - mean - 0.8 * (line[(i + n - pickAt) % n] - mean);
      shaped[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    for (let i = 0; i < n; i++) line[i] = shaped[i] / peak;
    const rho = Math.pow(10, -3 / (t60 * st.f));
    let idx = 0;
    let prev = 0;
    let apIn = 0;
    let apOut = 0;
    for (let k = st.delay; k < total; k++) {
      const x = line[idx];
      out[k] += x * st.gain;
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
  // Normalise, then shape the two ends so the buffer starts and stops without a click.
  let peak = 1e-9;
  for (let i = 0; i < total; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i]);
  const norm = 0.9 / peak;
  const fadeIn = Math.min(total, Math.floor(sampleRate * 0.0008));
  const fadeOut = Math.min(total, Math.floor(sampleRate * 0.04));
  for (let i = 0; i < total; i++) {
    let g = norm;
    if (i < fadeIn) g *= i / fadeIn;
    if (i >= total - fadeOut) g *= (total - i) / fadeOut;
    out[i] *= g;
  }
  return out;
}

/** Length of a pluck buffer for a pitch (s): long enough for the string to die away. */
export function pluckSeconds(freq: number): number {
  return Math.min(1.6, Math.max(0.8, 1.75 - freq / 800));
}

const pluckData: { [key: string]: Float32Array } = {};
const pluckBuffers = new WeakMap<BaseAudioContext, { [midi: number]: AudioBuffer }>();

/** Cached pluck for a MIDI note, synthesised on first use. */
export function pluckBuffer(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const m = Math.round(midi);
  let table = pluckBuffers.get(ctx);
  if (!table) {
    table = {};
    pluckBuffers.set(ctx, table);
  }
  let buf = table[m];
  if (!buf) {
    const key = ctx.sampleRate + ':' + m;
    let data = pluckData[key];
    if (!data) {
      const f = midiToFreq(m);
      data = synthPluck(ctx.sampleRate, f, pluckSeconds(f), 1000 + m);
      pluckData[key] = data;
    }
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    table[m] = buf;
  }
  return buf;
}

export interface PluckOpts {
  midi: number;
  at?: number;
  /** How long the string is left to ring before it is damped (s). */
  dur: number;
  peak: number;
  /** Detune in cents. */
  cents?: number;
  to?: AudioNode;
}

export function pluck(v: Voice, o: PluckOpts): void {
  const ctx = v.ctx;
  const t = v.t0 + (o.at || 0);
  const buf = pluckBuffer(ctx, o.midi);
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
  tone(v, { f: 168, f2: 74, glide: 0.09, at, dur: 0.26, peak: 0.9 * vel, attack: 0.003, to });
  tone(v, { type: 'triangle', f: 336, f2: 150, glide: 0.07, at, dur: 0.12, peak: 0.26 * vel, attack: 0.002, to });
  noise(v, { type: 'lowpass', f: 1400, q: 0.7, at, dur: 0.03, peak: 0.24 * vel, attack: 0.001, to });
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
