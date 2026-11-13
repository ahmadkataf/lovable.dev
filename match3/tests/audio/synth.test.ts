import { describe, expect, it } from 'vitest';
import { aWeight, analyze, detectOnsets, encodeWav, fftInPlace, longestSilence, sliceRmsDb, spectrogram } from '../../src/audio/analysis.ts';
import { GUARD_CEILING, GUARD_KNEE, guardCurve } from '../../src/audio/output.ts';
import { midiToFreq } from '../../src/audio/scale.ts';
import { SFX_NAMES, SFX_STEPS, renderSfx, sfxClass } from '../../src/audio/sfx.ts';
import { pluckSeconds, synthPluck } from '../../src/audio/voices.ts';
import { FakeAudioContext } from './fake-context.ts';

const SR = 44100;

function sine(freq: number, seconds: number, amp = 1): Float32Array {
  const x = new Float32Array(Math.floor(seconds * SR));
  for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return x;
}

/** Offset (cents) of the strongest component near `freq`. */
function centsOff(x: Float32Array, freq: number): number {
  const a = Math.floor(0.05 * SR);
  const b = Math.min(x.length, Math.floor(0.5 * SR));
  let best = 0;
  let at = 0;
  for (let c = -15; c <= 15; c += 0.5) {
    const f = freq * Math.pow(2, c / 1200);
    let re = 0;
    let im = 0;
    for (let i = a; i < b; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - a)) / (b - a));
      const ph = (2 * Math.PI * f * i) / SR;
      re += x[i] * w * Math.cos(ph);
      im -= x[i] * w * Math.sin(ph);
    }
    const p = re * re + im * im;
    if (p > best) {
      best = p;
      at = c;
    }
  }
  return at;
}

describe('plucked string synthesis', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = synthPluck(SR, 293.66, 0.5, 1062);
    const b = synthPluck(SR, 293.66, 0.5, 1062);
    const c = synthPluck(SR, 293.66, 0.5, 1063);
    expect(Array.from(a.subarray(0, 4000))).toEqual(Array.from(b.subarray(0, 4000)));
    let differs = false;
    for (let i = 0; i < 4000; i++) if (a[i] !== c[i]) differs = true;
    expect(differs).toBe(true);
  });

  it('is in tune across the lead register', () => {
    for (const midi of [50, 55, 62, 69, 74, 79, 86]) {
      const f = midiToFreq(midi);
      const x = synthPluck(SR, f, pluckSeconds(f), 1000 + midi);
      expect(Math.abs(centsOff(x, f))).toBeLessThanOrEqual(3);
    }
  });

  it('is bounded, starts and ends at zero, and decays', () => {
    for (const midi of [50, 62, 74, 86]) {
      const f = midiToFreq(midi);
      const x = synthPluck(SR, f, pluckSeconds(f), 1000 + midi);
      let peak = 0;
      for (let i = 0; i < x.length; i++) {
        expect(Number.isFinite(x[i])).toBe(true);
        peak = Math.max(peak, Math.abs(x[i]));
      }
      expect(peak).toBeLessThanOrEqual(0.9001);
      expect(peak).toBeGreaterThan(0.6);
      expect(Math.abs(x[0])).toBe(0);
      expect(Math.abs(x[x.length - 1])).toBeLessThan(1e-3);
      const early = sliceRmsDb(x, SR, 0.02, 0.12);
      const late = sliceRmsDb(x, SR, 0.5, 0.7);
      expect(early - late).toBeGreaterThan(12); // a pluck, not a drone
      expect(early).toBeGreaterThan(-16); // with a body, not just a click
      // no DC build-up
      let mean = 0;
      for (let i = 0; i < x.length; i++) mean += x[i];
      expect(Math.abs(mean / x.length)).toBeLessThan(0.01);
    }
  });

  it('gives longer buffers to lower strings, within bounds', () => {
    expect(pluckSeconds(midiToFreq(50))).toBeGreaterThan(pluckSeconds(midiToFreq(86)));
    for (let m = 40; m <= 100; m++) {
      const s = pluckSeconds(midiToFreq(m));
      expect(s).toBeGreaterThanOrEqual(0.8);
      expect(s).toBeLessThanOrEqual(1.7);
    }
  });
});

describe('output guard curve', () => {
  it('is the identity below the knee and never reaches full scale', () => {
    const n = 4097;
    const curve = guardCurve(n);
    expect(curve.length).toBe(n);
    expect(curve[(n - 1) / 2]).toBe(0);
    for (let i = 0; i < n; i++) {
      const x = (2 * i) / (n - 1) - 1;
      const y = curve[i];
      if (Math.abs(x) <= GUARD_KNEE) expect(y).toBeCloseTo(x, 6);
      expect(Math.abs(y)).toBeLessThanOrEqual(GUARD_CEILING);
      expect(Math.abs(y)).toBeLessThan(0.99);
      expect(curve[n - 1 - i]).toBeCloseTo(-y, 6); // odd symmetry: no DC is added
      if (i > 0) expect(y).toBeGreaterThanOrEqual(curve[i - 1]); // monotonic
    }
    expect(curve[n - 1]).toBeGreaterThan(0.9);
    // smooth at the knee: slope continues at ~1
    const k = Math.round(((GUARD_KNEE + 1) / 2) * (n - 1));
    const slope = (curve[k + 4] - curve[k]) / (8 / (n - 1));
    expect(slope).toBeGreaterThan(0.9);
    expect(slope).toBeLessThanOrEqual(1.0001);
  });
});

describe('effect recipes (structure, on a fake context)', () => {
  it('every effect builds, reports a sensible duration and releases its nodes', () => {
    for (const name of SFX_NAMES) {
      const steps = SFX_STEPS[name] || [undefined];
      for (const step of steps) {
        const ctx = new FakeAudioContext();
        const dest = ctx.createGain();
        const dur = renderSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, name, 1, step === undefined ? undefined : { step });
        const cls = sfxClass(name);
        expect(dur).toBeGreaterThan(cls === 'jingle' ? 0.4 : 0.04);
        expect(dur).toBeLessThan(cls === 'ui' ? 0.25 : cls === 'jingle' ? 2.2 : 0.9);
        expect(ctx.started).toBeGreaterThan(0);
        expect(ctx.started).toBeLessThanOrEqual(48); // a handful of sources, not hundreds
        // every source has a stop time: nothing can sound forever
        expect(ctx.sources.length).toBe(ctx.started);
        for (const s of ctx.sources) {
          expect(s.startAt).toBeGreaterThanOrEqual(1);
          expect(s.stopAt).toBeLessThanOrEqual(1 + dur + 1e-9);
          expect(s.stopAt).toBeGreaterThan(s.startAt);
        }
        const before = ctx.disconnects;
        ctx.advance(1 + dur + 0.01);
        expect(ctx.sources.length).toBe(0);
        expect(ctx.disconnects).toBeGreaterThan(before); // the voice disconnected itself
      }
    }
  });

  it('covers every name of the contract', () => {
    const contract = [
      'button', 'select', 'swap', 'invalid', 'match', 'land', 'createBeam', 'createNova', 'createPrism', 'beam', 'nova', 'prism',
      'bigCombo', 'sand', 'stone', 'stoneBreak', 'chain', 'vine', 'vineGrow', 'lamp', 'shuffle', 'booster', 'praise', 'goalDone',
      'star', 'win', 'lose', 'coin', 'reward', 'purchase', 'lifeLost', 'levelStart', 'popupOpen', 'popupClose', 'movesLow',
    ];
    expect(SFX_NAMES.slice().sort()).toEqual(contract.slice().sort());
  });

  it('volume scales the voice and zero volume builds nothing', () => {
    const ctx = new FakeAudioContext();
    const dest = ctx.createGain();
    expect(renderSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'match', 0, { volume: 0 })).toBe(0);
    expect(ctx.started).toBe(0);
    expect(renderSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'nope' as never, 0)).toBe(0);
  });
});

describe('measurement helpers', () => {
  it('FFT finds a sine where it is', () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 37 * i) / n);
    fftInPlace(re, im);
    let best = 0;
    for (let k = 1; k < n / 2; k++) if (Math.hypot(re[k], im[k]) > Math.hypot(re[best], im[best])) best = k;
    expect(best).toBe(37);
    expect(Math.hypot(re[37], im[37])).toBeCloseTo(n / 2, 3);
  });

  it('measures level, pitch, DC and clipping of known signals', () => {
    const m = analyze(sine(1000, 0.5, 0.5), SR);
    expect(m.peak).toBeCloseTo(0.5, 2);
    expect(m.rmsDb).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 0);
    expect(m.loudADb).toBeCloseTo(m.rmsDb, 0); // A-weighting is 0 dB at 1 kHz
    expect(Math.abs(m.pitch - 1000)).toBeLessThan(3);
    expect(Math.abs(m.centroid - 1000)).toBeLessThan(30);
    expect(Math.abs(m.dc)).toBeLessThan(1e-3);
    expect(m.clips).toBe(false);
    expect(m.silent).toBe(false);
    expect(analyze(sine(440, 0.2, 1), SR).clips).toBe(true);
    expect(analyze(new Float32Array(SR / 2), SR).silent).toBe(true);
    const low = analyze(sine(100, 0.5, 0.5), SR);
    expect(low.loudADb).toBeLessThan(low.rmsDb - 15); // bass counts for little on a small speaker
    const offset = sine(500, 0.3, 0.2);
    for (let i = 0; i < offset.length; i++) offset[i] += 0.1;
    expect(analyze(offset, SR).dc).toBeCloseTo(0.1, 2);
  });

  it('sees a sweep move, finds onsets and silence', () => {
    const x = new Float32Array(SR);
    let ph = 0;
    for (let i = 0; i < x.length; i++) {
      const f = 4000 * Math.pow(400 / 4000, i / x.length);
      ph += (2 * Math.PI * f) / SR;
      x[i] = 0.5 * Math.sin(ph);
    }
    const m = analyze(x, SR);
    expect(m.centroidStart).toBeGreaterThan(m.centroidEnd * 2);

    const clicks = new Float32Array(SR * 2);
    for (const t of [0.25, 0.75, 1.25, 1.75]) {
      const at = Math.floor(t * SR);
      for (let i = 0; i < 2000; i++) clicks[at + i] = 0.5 * Math.sin((2 * Math.PI * 880 * i) / SR) * Math.exp(-i / 400);
    }
    const onsets = detectOnsets(clicks, SR);
    expect(onsets.length).toBe(4);
    onsets.forEach((t, i) => expect(Math.abs(t - (0.25 + i * 0.5))).toBeLessThan(0.03));
    expect(longestSilence(clicks, SR, 0.002)).toBeGreaterThan(0.3);
    expect(longestSilence(sine(300, 1, 0.1), SR, 0.002)).toBe(0);
    expect(aWeight(1000)).toBeCloseTo(1, 2);
    expect(spectrogram(clicks, SR, 1024, 256).frames.length).toBeGreaterThan(300);
  });

  it('writes a valid 16-bit mono WAV', () => {
    const wav = encodeWav(sine(440, 0.1, 0.5), SR);
    const text = (o: number, n: number): string => String.fromCharCode(...wav.subarray(o, o + n));
    const view = new DataView(wav.buffer);
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 8)).toBe('WAVEfmt ');
    expect(text(36, 4)).toBe('data');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(SR);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(wav.length - 44);
    expect(wav.length).toBe(44 + 4410 * 2);
  });
});
