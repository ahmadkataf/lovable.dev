import { describe, expect, it } from 'vitest';
import { aWeight, analyze, detectOnsets, encodeWav, fftInPlace, longestSilence, sliceRmsDb, spectrogram } from '../../src/audio/analysis.ts';
import { attackTime, crestDb, loudness, pitchNear, strongestIn } from '../../src/audio/analysis.ts';
import {
  GUARD_CEILING,
  GUARD_KNEE,
  LEVELS,
  LIMITER,
  LIMITER_MAKEUP,
  LIMITER_ONSET,
  MUSIC_CEILING,
  MUSIC_KNEE,
  MUSIC_PEAK_DB,
  createOutputChain,
  guardCurve,
} from '../../src/audio/output.ts';
import { midiToFreq } from '../../src/audio/scale.ts';
import {
  MATCH_VARIANTS,
  SFX_NAMES,
  SFX_STEPS,
  SFX_TIERS,
  SFX_TIER_PEAK_DB,
  renderSfx,
  sfxClass,
  sfxPeakDb,
  sfxTier,
  sfxVariants,
  startSfx,
  type SfxTier,
} from '../../src/audio/sfx.ts';
import { Voice, pluckSeconds, synthPluck, tone } from '../../src/audio/voices.ts';
import { FakeAudioContext, type FakeNode } from './fake-context.ts';

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
      let finite = true;
      for (let i = 0; i < x.length; i++) {
        if (!Number.isFinite(x[i])) finite = false;
        peak = Math.max(peak, Math.abs(x[i]));
      }
      expect(finite).toBe(true);
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

describe('output chain', () => {
  it('guard: the identity below the knee, never above the −1 dBFS ceiling', () => {
    const n = 4097;
    const curve = guardCurve(n);
    expect(curve.length).toBe(n);
    expect(curve[(n - 1) / 2]).toBe(0);
    expect(GUARD_CEILING).toBeLessThanOrEqual(Math.pow(10, -1 / 20)); // −1 dBFS
    expect(GUARD_CEILING).toBeGreaterThan(Math.pow(10, -1.1 / 20));
    let bad = 0;
    for (let i = 0; i < n; i++) {
      const x = (2 * i) / (n - 1) - 1;
      const y = curve[i];
      if (Math.abs(x) <= GUARD_KNEE && Math.abs(y - x) > 1e-6) bad++;
      if (Math.abs(y) > GUARD_CEILING) bad++;
      if (Math.abs(curve[n - 1 - i] + y) > 1e-6) bad++; // odd symmetry: no DC is added
      if (i > 0 && y < curve[i - 1]) bad++; // monotonic
    }
    expect(bad).toBe(0);
    expect(curve[n - 1]).toBeGreaterThan(GUARD_KNEE + 0.1);
    // smooth at the knee: slope continues at ~1
    const k = Math.round(((GUARD_KNEE + 1) / 2) * (n - 1));
    const slope = (curve[k + 4] - curve[k]) / (8 / (n - 1));
    expect(slope).toBeGreaterThan(0.9);
    expect(slope).toBeLessThanOrEqual(1.0001);
  });

  it('is transparent from bus to output below the limiter', () => {
    // master × the limiter's own make-up gain × trim = exactly 1: tier levels are bus levels
    expect(LEVELS.master * LIMITER_MAKEUP * LEVELS.trim).toBeCloseTo(1, 12);
    expect(LIMITER_MAKEUP).toBeCloseTo(Math.pow(10, (0.6 * 5.7) / 20), 9);
    expect(LIMITER.threshold).toBe(-6);
    // one effect on its own never reaches the limiter: the loudest tier peaks under its onset
    const loudest = Math.max(...SFX_TIERS.map((t) => SFX_TIER_PEAK_DB[t]));
    expect(loudest).toBe(-5);
    expect(20 * Math.log10(LIMITER_ONSET)).toBeGreaterThan(loudest + 0.5);
    // … and what the limiter lets through at its onset is still under the guard's knee
    expect(LIMITER_ONSET).toBeLessThan(GUARD_KNEE);
  });

  it('holds the music 20 dB down, whatever it plays', () => {
    expect(MUSIC_PEAK_DB).toBe(-20);
    // the clipper's ceiling times the bus gain is the music's peak level
    expect(20 * Math.log10(MUSIC_CEILING * LEVELS.music)).toBeCloseTo(-20, 9);
    const curve = guardCurve(4097, MUSIC_KNEE, MUSIC_CEILING);
    let top = 0;
    for (let i = 0; i < curve.length; i++) top = Math.max(top, Math.abs(curve[i]));
    expect(top).toBeLessThanOrEqual(MUSIC_CEILING);
    expect(top).toBeGreaterThan(MUSIC_CEILING * 0.95);
  });

  it('builds on any context: buses, the music path, limiter, guard', () => {
    const ctx = new FakeAudioContext();
    const chain = createOutputChain(ctx as unknown as BaseAudioContext);
    expect((chain.sfxBus as unknown as FakeNode).gain.value).toBe(LEVELS.sfx);
    expect((chain.musicBus as unknown as FakeNode).gain.value).toBeCloseTo(LEVELS.music, 12);
    expect((chain.musicIn as unknown as FakeNode).gain.value).toBe(1);
    expect(chain.musicGlue).not.toBeNull();
    expect(chain.musicClip).not.toBeNull();
    expect((chain.limiter as unknown as FakeNode).threshold.value).toBe(LIMITER.threshold);
    const bare = createOutputChain(new FakeAudioContext() as unknown as BaseAudioContext, undefined, { musicGlue: false, musicClip: false });
    expect(bare.musicGlue).toBeNull();
    expect(bare.musicClip).toBeNull();
  });
});

/** Length window of each loudness tier (s) — the same numbers tools/audio-check.cjs enforces. */
const TIER_SECONDS: Record<SfxTier, [number, number]> = {
  ui: [0.04, 0.25],
  soft: [0.04, 0.4],
  handle: [0.08, 0.3],
  clear: [0.08, 0.25],
  board: [0.08, 0.7],
  special: [0.25, 0.9],
  big: [0.4, 1.2],
  jingle: [0.4, 2.2],
};

describe('effect recipes (structure, on a fake context)', () => {
  it('every effect builds, has the length of its tier and releases its nodes', () => {
    for (const name of SFX_NAMES) {
      const steps = SFX_STEPS[name] || [undefined];
      for (const step of steps) {
        for (let take = 0; take < sfxVariants(name); take++) {
          const ctx = new FakeAudioContext();
          const dest = ctx.createGain();
          const dur = renderSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, name, 1, step === undefined ? undefined : { step }, undefined, take);
          const [lo, hi] = TIER_SECONDS[sfxTier(name)];
          expect(dur, name).toBeGreaterThanOrEqual(lo);
          expect(dur, name).toBeLessThanOrEqual(hi);
          expect(ctx.started).toBeGreaterThan(0);
          expect(ctx.started).toBeLessThanOrEqual(64); // a handful of sources, not hundreds
          // every source has a stop time: nothing can sound forever
          expect(ctx.sources.length).toBe(ctx.started);
          let bad = 0;
          for (const s of ctx.sources) {
            if (!(s.startAt >= 1) || !(s.stopAt <= 1 + dur + 1e-9) || !(s.stopAt > s.startAt)) bad++;
          }
          expect(bad, name).toBe(0);
          const before = ctx.disconnects;
          ctx.advance(1 + dur + 0.01);
          expect(ctx.sources.length).toBe(0);
          expect(ctx.disconnects).toBeGreaterThan(before); // the voice disconnected itself
        }
      }
    }
  });

  it('the sounds heard all the time are short: 80–250 ms', () => {
    for (const name of ['button', 'select', 'swap', 'match', 'land'] as const) {
      for (const step of SFX_STEPS[name] || [undefined]) {
        const ctx = new FakeAudioContext();
        const dur = renderSfx(ctx as unknown as BaseAudioContext, ctx.createGain() as unknown as AudioNode, name, 0, step === undefined ? undefined : { step });
        expect(dur, name).toBeGreaterThanOrEqual(0.08);
        expect(dur, name).toBeLessThanOrEqual(0.25);
      }
    }
  });

  it('covers every name of the contract', () => {
    const contract = [
      'button', 'select', 'swap', 'invalid', 'match', 'land', 'createBeam', 'createNova', 'createPrism', 'beam', 'nova', 'prism',
      'bigCombo', 'sand', 'stone', 'stoneBreak', 'chain', 'vine', 'vineGrow', 'lamp', 'shuffle', 'booster', 'praise', 'goalDone',
      'star', 'win', 'lose', 'coin', 'reward', 'purchase', 'lifeLost', 'levelStart', 'popupOpen', 'popupClose', 'movesLow',
      // added with the strategy study
      'finale', 'chest', 'caravan', 'hint',
    ];
    expect(SFX_NAMES.slice().sort()).toEqual(contract.slice().sort());
  });

  it('puts every sound in a loudness tier of the strategy study', () => {
    expect(SFX_TIERS.map((t) => SFX_TIER_PEAK_DB[t])).toEqual([-18, -16, -14, -12, -10, -8, -6, -5]);
    const tierOf: { [name: string]: SfxTier } = {
      button: 'ui', popupOpen: 'ui', popupClose: 'ui',
      land: 'soft',
      select: 'handle', swap: 'handle',
      match: 'clear',
      sand: 'board', stone: 'board', stoneBreak: 'board', chain: 'board', vine: 'board', vineGrow: 'board',
      beam: 'special', nova: 'special', prism: 'special',
      bigCombo: 'big', praise: 'big',
      win: 'jingle', lose: 'jingle', star: 'jingle',
    };
    for (const name of Object.keys(tierOf)) expect(sfxTier(name as never), name).toBe(tierOf[name]);
    expect(sfxPeakDb('button')).toBe(-18);
    expect(sfxPeakDb('land')).toBe(-16);
    expect(sfxPeakDb('match')).toBe(-12);
    expect(sfxPeakDb('stone')).toBe(-10);
    expect(sfxPeakDb('beam')).toBe(-8);
    expect(sfxPeakDb('praise')).toBe(-6);
    expect(sfxPeakDb('win')).toBe(-5);
    // the coarse class the lab page uses follows from the tier
    expect(sfxClass('button')).toBe('ui');
    expect(sfxClass('match')).toBe('game');
    expect(sfxClass('win')).toBe('jingle');
  });

  it("'match' has three takes: ±6 cents, attacks of 4, 6 and 8 ms", () => {
    expect(sfxVariants('match')).toBe(3);
    expect(sfxVariants('beam')).toBe(1);
    expect(MATCH_VARIANTS.map((v) => v.cents)).toEqual([0, 6, -6]);
    expect(MATCH_VARIANTS.map((v) => v.attack)).toEqual([0.004, 0.006, 0.008]);
    // the take changes the pitch the body settles on by exactly its detune
    const settled = (take: number): number => {
      const ctx = new FakeAudioContext();
      const made: FakeNode[] = [];
      const original = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = () => {
        const o = original();
        made.push(o);
        return o;
      };
      startSfx(ctx as unknown as BaseAudioContext, ctx.createGain() as unknown as AudioNode, 'match', 0, { step: 4 }, undefined, take);
      // the first oscillator is the body's carrier; its last frequency event is the settled note
      const calls = made[0].frequency.calls;
      return calls[calls.length - 1].value;
    };
    const a4 = 440;
    expect(settled(0)).toBeCloseTo(a4, 6);
    expect(1200 * Math.log2(settled(1) / a4)).toBeCloseTo(6, 6);
    expect(1200 * Math.log2(settled(2) / a4)).toBeCloseTo(-6, 6);
    expect(settled(3)).toBeCloseTo(a4, 6); // takes wrap around
    expect(settled(-1)).toBeCloseTo(settled(2), 9);
  });

  it('volume scales the voice and zero volume builds nothing', () => {
    const ctx = new FakeAudioContext();
    const dest = ctx.createGain();
    expect(renderSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'match', 0, { volume: 0 })).toBe(0);
    expect(ctx.started).toBe(0);
    expect(renderSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'nope' as never, 0)).toBe(0);
    const full = startSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'beam', 0) as Voice;
    const half = startSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'beam', 0, { volume: 0.5 }) as Voice;
    const gainOf = (v: Voice): number => (v.out as unknown as FakeNode).gain.value;
    expect(gainOf(half)).toBeCloseTo(gainOf(full) * 0.5, 9);
    expect(gainOf(startSfx(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 'beam', 0, { volume: 7 }) as Voice)).toBeCloseTo(gainOf(full), 9);
  });
});

describe('a voice that is stolen', () => {
  function voiceWithTones(ctx: FakeAudioContext, t0: number): Voice {
    const v = new Voice(ctx as unknown as BaseAudioContext, ctx.createGain() as unknown as AudioNode, t0, 0.5);
    tone(v, { f: 440, dur: 0.5, peak: 0.5 });
    tone(v, { f: 880, at: 0.3, dur: 0.4, peak: 0.2 }); // a note that only starts later
    tone(v, { f: 660, dur: 0.05, peak: 0.2 }); // a short one that ends by itself
    return v;
  }

  it('fades out and stops every source, including the ones that had not started', () => {
    const ctx = new FakeAudioContext();
    const v = voiceWithTones(ctx, 1);
    expect(v.endTime).toBeCloseTo(1.72, 6);
    ctx.advance(1.1); // now 1.1: the short tone has ended, the late one has not begun
    v.fadeOut(1.1, 0.012);
    const out = (v.out as unknown as FakeNode).gain.calls;
    expect(out.map((c) => c.method)).toEqual(['cancel', 'set', 'linear']);
    expect(out[1].value).toBeCloseTo(0.5, 9);
    expect(out[2].value).toBe(0);
    expect(out[2].time).toBeCloseTo(1.112, 9);
    expect(v.endTime).toBeCloseTo(1.115, 9);
    for (const s of ctx.sources) expect(s.stopAt).toBeLessThanOrEqual(1.115 + 1e-9);
    expect(v.done).toBe(false);
    ctx.advance(0.02);
    expect(v.done).toBe(true); // every source ended: the voice gave its nodes back
    expect(ctx.sources.length).toBe(0);
    // a second call is harmless
    expect(() => v.fadeOut(2, 0.01)).not.toThrow();
  });

  it('is simply removed when it has not begun to sound', () => {
    const ctx = new FakeAudioContext();
    const v = voiceWithTones(ctx, 1);
    const before = ctx.disconnects;
    v.fadeOut(1, 0.012);
    expect(v.done).toBe(true);
    expect(ctx.disconnects).toBeGreaterThan(before);
    expect((v.out as unknown as FakeNode).gain.calls.length).toBe(0); // no fade was needed
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

describe('mix measurements', () => {
  it('programme loudness follows ITU-R BS.1770', () => {
    // a full-scale 997 Hz sine in one channel reads −3.01 LUFS; the same on two channels 0 LUFS
    const full = sine(997, 3, 1);
    expect(loudness(full, SR, 1).integrated).toBeCloseTo(-3.01, 1);
    expect(loudness(full, SR, 2).integrated).toBeCloseTo(0, 1);
    // 20 dB quieter reads 20 LU lower
    expect(loudness(sine(997, 3, 0.1), SR, 1).integrated).toBeCloseTo(-23.01, 1);
    // silence between bursts is gated out: half the time silent changes little
    const gated = new Float32Array(SR * 4);
    gated.set(sine(997, 2, 0.5), 0);
    const g = loudness(gated, SR, 1);
    expect(g.integrated).toBeCloseTo(-9.03, 0);
    expect(g.ungated).toBeLessThan(g.integrated - 2);
    expect(g.momentaryMax).toBeCloseTo(-9.03, 0);
    // K-weighting: bass counts less, presence a little more
    expect(loudness(sine(60, 3, 0.5), SR, 1).integrated).toBeLessThan(loudness(sine(997, 3, 0.5), SR, 1).integrated - 2);
    expect(loudness(sine(4000, 3, 0.5), SR, 1).integrated).toBeGreaterThan(loudness(sine(997, 3, 0.5), SR, 1).integrated + 2);
    expect(loudness(new Float32Array(SR), SR, 1).integrated).toBeLessThanOrEqual(-70);
  });

  it('measures attack time, crest factor and fine pitch', () => {
    // a tone that ramps up over 20 ms: 10 % → 70 % of the peak takes 12 ms
    const x = sine(1000, 0.3, 0.8);
    for (let i = 0; i < x.length; i++) x[i] *= Math.min(1, i / (0.02 * SR));
    expect(attackTime(x, SR)).toBeGreaterThan(0.009);
    expect(attackTime(x, SR)).toBeLessThan(0.015);
    // an abrupt start has (almost) none
    expect(attackTime(sine(1000, 0.3, 0.8), SR)).toBeLessThan(0.001);
    expect(crestDb(sine(500, 0.5, 0.5))).toBeCloseTo(3.01, 1);
    // six cents sharp of A4 is found to the cent
    const f = 440 * Math.pow(2, 6 / 1200);
    expect(1200 * Math.log2(pitchNear(sine(f, 0.4, 0.5), SR, 440, 0.05, 0.35) / 440)).toBeCloseTo(6, 0);
    // which of two notes sounds in which half
    const melody = new Float32Array(SR);
    melody.set(sine(880, 0.5, 0.5), 0);
    melody.set(sine(1175, 0.5, 0.5), SR / 2);
    expect(Math.abs(strongestIn(melody, SR, 0.05, 0.4, 500, 1700) - 880)).toBeLessThan(6);
    expect(Math.abs(strongestIn(melody, SR, 0.55, 0.9, 500, 1700) - 1175)).toBeLessThan(6);
  });
});
