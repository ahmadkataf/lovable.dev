/**
 * Measurement helpers for rendered audio (pure — arrays in, numbers out). Used by the dev-only
 * audio lab page and by tools/audio-check.cjs; not part of the game bundle.
 */

/** In-place radix-2 FFT. Lengths must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface Spectrogram {
  size: number;
  hop: number;
  sampleRate: number;
  /**
   * One array per frame, bins 0..size/2. Values are power, scaled so that the sum over the
   * bins of a frame is the frame's mean square (a full-scale sine sums to 0.5).
   */
  frames: Float32Array[];
}

/** Hann-windowed STFT power. Frame i is centred on sample i × hop. */
export function spectrogram(x: Float32Array, sampleRate: number, size: number, hop: number): Spectrogram {
  const window = new Float64Array(size);
  let w2 = 0;
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
    w2 += window[i] * window[i];
  }
  const scale = 2 / (size * w2);
  const count = Math.max(1, Math.ceil(x.length / hop) + 1);
  const frames: Float32Array[] = [];
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const half = size >> 1;
  for (let f = 0; f < count; f++) {
    const start = f * hop - half;
    for (let i = 0; i < size; i++) {
      const j = start + i;
      re[i] = j >= 0 && j < x.length ? x[j] * window[i] : 0;
      im[i] = 0;
    }
    fftInPlace(re, im);
    const p = new Float32Array(half + 1);
    for (let k = 0; k <= half; k++) p[k] = (re[k] * re[k] + im[k] * im[k]) * scale;
    frames.push(p);
  }
  return { size, hop, sampleRate, frames };
}

/** A-weighting as a linear amplitude factor (1 at 1 kHz). */
export function aWeight(f: number): number {
  if (f <= 0) return 0;
  const f2 = f * f;
  const num = 12194 * 12194 * f2 * f2;
  const den = (f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194);
  return (num / den) * 1.2589;
}

export function toDb(x: number): number {
  return 20 * Math.log10(Math.max(x, 1e-9));
}

export interface Metrics {
  /** Time of the last sample louder than −60 dB below the peak (s). */
  effective: number;
  peak: number;
  peakDb: number;
  /** RMS over the sound's own length (start … effective end). */
  rms: number;
  rmsDb: number;
  /** Loudest 50 ms window, RMS in dBFS. */
  loudDb: number;
  /** Loudest ~46 ms frame, A-weighted, in dB — closer to how loud it is perceived. */
  loudADb: number;
  /** Mean sample value. */
  dc: number;
  /** Power-weighted mean frequency (Hz): whole sound, its first third and its last third. */
  centroid: number;
  centroidStart: number;
  centroidEnd: number;
  /** Strongest spectral peak (Hz). */
  pitch: number;
  /** Share of the sound's energy above 6 kHz (0..1): a lot of it makes a sound harsh or hissy. */
  hfShare: number;
  /** Share of the energy below 150 Hz (0..1): boom that a phone speaker cannot even play. */
  lfShare: number;
  /** |sample| ≥ 0.99 anywhere. */
  clips: boolean;
  /** RMS < 0.003. */
  silent: boolean;
}

/** Energy above this frequency counts as "harsh" … */
export const HARSH_HZ = 6000;
/** … and below this one as "boom". */
export const BOOM_HZ = 150;

export function analyze(x: Float32Array, sampleRate: number): Metrics {
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
  }
  const floor = Math.max(peak * 0.001, 1e-4);
  let last = 0;
  let first = -1;
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) > floor) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) first = 0;
  const span = Math.max(1, last - first + 1);
  let sum = 0;
  let sq = 0;
  for (let i = first; i <= last && i < x.length; i++) {
    sum += x[i];
    sq += x[i] * x[i];
  }
  const rms = Math.sqrt(sq / span);

  // Loudest 50 ms window.
  const win = Math.max(1, Math.round(sampleRate * 0.05));
  const hopT = Math.max(1, Math.round(sampleRate * 0.01));
  let loud = 0;
  for (let s = 0; s < Math.max(1, x.length - win + 1); s += hopT) {
    let e = 0;
    const end = Math.min(x.length, s + win);
    for (let i = s; i < end; i++) e += x[i] * x[i];
    const r = Math.sqrt(e / win);
    if (r > loud) loud = r;
  }

  const size = 2048;
  const hop = 256;
  const sg = spectrogram(x, sampleRate, size, hop);
  const bins = size / 2 + 1;
  const binHz = sampleRate / size;
  const weights = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    const a = aWeight(k * binHz);
    weights[k] = a * a;
  }
  const avg = new Float64Array(bins);
  let loudA = 0;
  let cNum = 0;
  let cDen = 0;
  let sNum = 0;
  let sDen = 0;
  let eNum = 0;
  let eDen = 0;
  const firstFrame = Math.floor(first / hop);
  const lastFrame = Math.ceil(last / hop);
  const third = Math.max(1, (lastFrame - firstFrame) / 3);
  for (let f = 0; f < sg.frames.length; f++) {
    const p = sg.frames[f];
    let wsum = 0;
    let num = 0;
    let den = 0;
    for (let k = 1; k < bins; k++) {
      wsum += p[k] * weights[k];
      num += p[k] * k * binHz;
      den += p[k];
      avg[k] += p[k];
    }
    if (wsum > loudA) loudA = wsum;
    cNum += num;
    cDen += den;
    if (f >= firstFrame && f < firstFrame + third) {
      sNum += num;
      sDen += den;
    }
    if (f > lastFrame - third && f <= lastFrame) {
      eNum += num;
      eDen += den;
    }
  }
  // Where the energy sits: above 6 kHz (harshness) and below 150 Hz (boom).
  let total = 0;
  let high = 0;
  let low = 0;
  for (let k = 1; k < bins; k++) {
    total += avg[k];
    if (k * binHz >= HARSH_HZ) high += avg[k];
    if (k * binHz < BOOM_HZ) low += avg[k];
  }

  // Strongest peak of the average spectrum above 60 Hz, refined by parabolic interpolation.
  let best = 1;
  for (let k = Math.ceil(60 / binHz); k < bins - 1; k++) if (avg[k] > avg[best]) best = k;
  let pitch = best * binHz;
  if (best > 1 && best < bins - 1 && avg[best] > 0) {
    const a = Math.log(avg[best - 1] + 1e-30);
    const b = Math.log(avg[best] + 1e-30);
    const c = Math.log(avg[best + 1] + 1e-30);
    const d = a - 2 * b + c;
    if (d !== 0) pitch = (best + (0.5 * (a - c)) / d) * binHz;
  }

  return {
    effective: (last + 1) / sampleRate,
    peak,
    peakDb: toDb(peak),
    rms,
    rmsDb: toDb(rms),
    loudDb: toDb(loud),
    loudADb: 10 * Math.log10(Math.max(loudA, 1e-18)),
    dc: sum / span,
    centroid: cDen > 0 ? cNum / cDen : 0,
    centroidStart: sDen > 0 ? sNum / sDen : 0,
    centroidEnd: eDen > 0 ? eNum / eDen : 0,
    pitch,
    hfShare: total > 0 ? high / total : 0,
    lfShare: total > 0 ? low / total : 0,
    clips: peak >= 0.99,
    silent: rms < 0.003,
  };
}

export interface LoudnessStats {
  /** A-weighted level (dB) of the loudest ~46 ms frame — the measure used for effects. */
  max: number;
  /** Level exceeded by only 5 % of the frames: the loud moments, without the single worst one. */
  p95: number;
  /** Median frame: the typical level. */
  p50: number;
}

/**
 * Distribution of the A-weighted short-term level over a long sound (music). Its `max` is
 * measured exactly like an effect's `loudADb`, so music and effects can be compared like
 * for like instead of comparing an average with a peak.
 */
export function loudnessStats(x: Float32Array, sampleRate: number): LoudnessStats {
  const size = 2048;
  const hop = 1024;
  const sg = spectrogram(x, sampleRate, size, hop);
  const bins = size / 2 + 1;
  const binHz = sampleRate / size;
  const weights = new Float64Array(bins);
  for (let k = 0; k < bins; k++) {
    const a = aWeight(k * binHz);
    weights[k] = a * a;
  }
  const levels: number[] = [];
  for (let f = 0; f < sg.frames.length; f++) {
    const p = sg.frames[f];
    let w = 0;
    for (let k = 1; k < bins; k++) w += p[k] * weights[k];
    levels.push(10 * Math.log10(Math.max(w, 1e-18)));
  }
  levels.sort((a, b) => a - b);
  const at = (q: number): number => levels[Math.min(levels.length - 1, Math.max(0, Math.floor(q * (levels.length - 1))))];
  return { max: levels[levels.length - 1], p95: at(0.95), p50: at(0.5) };
}

/** Largest jump between two neighbouring samples in [from, to) seconds: a click shows up as one. */
export function maxStep(x: Float32Array, sampleRate: number, from: number = 0, to: number = Infinity): number {
  const a = Math.max(1, Math.floor(from * sampleRate));
  const b = Math.min(x.length, to === Infinity ? x.length : Math.floor(to * sampleRate));
  let worst = 0;
  for (let i = a; i < b; i++) {
    const d = Math.abs(x[i] - x[i - 1]);
    if (d > worst) worst = d;
  }
  return worst;
}

/**
 * Hard cuts: places where sound stops dead instead of fading. Looks for every stretch of at
 * least `minSilence` seconds of (near) digital silence and returns the largest level found in
 * the half millisecond just before one of them. A sound that was faded out, or that decayed by
 * itself, arrives at silence quietly; one that was chopped does not.
 */
export function hardCutLevel(x: Float32Array, sampleRate: number, minSilence: number = 0.004): number {
  const quiet = 2e-5;
  const need = Math.max(1, Math.round(minSilence * sampleRate));
  const edge = Math.max(2, Math.round(0.0005 * sampleRate));
  let worst = 0;
  let run = 0;
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) < quiet) {
      run++;
      if (run === need) {
        const start = i - need + 1;
        for (let j = Math.max(0, start - edge); j < start; j++) {
          const v = Math.abs(x[j]);
          if (v > worst) worst = v;
        }
      }
    } else {
      run = 0;
    }
  }
  return worst;
}

/** Largest |sample| in [from, to) seconds. */
export function slicePeak(x: Float32Array, sampleRate: number, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from * sampleRate));
  const b = Math.min(x.length, Math.floor(to * sampleRate));
  let peak = 0;
  for (let i = a; i < b; i++) {
    const v = Math.abs(x[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

/** RMS of consecutive windows (linear). */
export function rmsTrack(x: Float32Array, sampleRate: number, windowSec: number): Float32Array {
  const win = Math.max(1, Math.round(sampleRate * windowSec));
  const count = Math.floor(x.length / win);
  const out = new Float32Array(count);
  for (let w = 0; w < count; w++) {
    let e = 0;
    const s = w * win;
    for (let i = 0; i < win; i++) e += x[s + i] * x[s + i];
    out[w] = Math.sqrt(e / win);
  }
  return out;
}

/** Longest stretch (s) during which 50 ms windows stay below `threshold` RMS. */
export function longestSilence(x: Float32Array, sampleRate: number, threshold: number): number {
  const track = rmsTrack(x, sampleRate, 0.05);
  let run = 0;
  let longest = 0;
  for (let i = 0; i < track.length; i++) {
    if (track[i] < threshold) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return longest * 0.05;
}

/** RMS in dBFS of the slice [from, to) seconds. */
export function sliceRmsDb(x: Float32Array, sampleRate: number, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from * sampleRate));
  const b = Math.min(x.length, Math.floor(to * sampleRate));
  let e = 0;
  for (let i = a; i < b; i++) e += x[i] * x[i];
  return toDb(Math.sqrt(e / Math.max(1, b - a)));
}

/**
 * Note onsets by spectral flux: times (s) where energy rises across the spectrum clearly
 * above its local average. Good enough to confirm that scheduled notes are really audible.
 */
export function detectOnsets(x: Float32Array, sampleRate: number): number[] {
  const size = 1024;
  const hop = 256;
  const sg = spectrogram(x, sampleRate, size, hop);
  const n = sg.frames.length;
  const flux = new Float64Array(n);
  for (let f = 1; f < n; f++) {
    const p = sg.frames[f];
    const q = sg.frames[f - 1];
    let s = 0;
    for (let k = 2; k < p.length; k++) {
      const d = Math.log(1 + 3000 * Math.sqrt(p[k])) - Math.log(1 + 3000 * Math.sqrt(q[k]));
      if (d > 0) s += d;
    }
    flux[f] = s;
  }
  const radius = Math.round((0.12 * sampleRate) / hop);
  const minGap = Math.round((0.05 * sampleRate) / hop);
  const onsets: number[] = [];
  let lastOnset = -minGap;
  for (let f = 1; f < n - 1; f++) {
    let mean = 0;
    let c = 0;
    for (let j = Math.max(0, f - radius); j <= Math.min(n - 1, f + radius); j++) {
      mean += flux[j];
      c++;
    }
    mean /= c;
    if (flux[f] > mean * 1.5 + 4 && flux[f] >= flux[f - 1] && flux[f] > flux[f + 1] && f - lastOnset >= minGap) {
      onsets.push((f * hop) / sampleRate);
      lastOnset = f;
    }
  }
  return onsets;
}

/** 16-bit PCM mono WAV file. */
export function encodeWav(x: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + x.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + x.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return bytes;
}
