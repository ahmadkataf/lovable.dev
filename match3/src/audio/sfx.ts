/**
 * Sound effects. Each one is a small recipe of oscillators, FM pairs, filtered noise and
 * plucked strings, built on voices.ts so it renders into any BaseAudioContext.
 *
 * All pitched material uses notes of D Hijaz (scale.ts), so effects sit inside the music's
 * key. The designs are this game's own; nothing is sampled and nothing quotes an existing
 * sound or tune.
 *
 * The mix is a ladder of loudness tiers (docs/STRATEGY.md, audio-01): every sound belongs to
 * a tier, and its `gain` is tuned by measurement (tools/audio-check.cjs, `--calibrate`) so
 * that its sample peak at the output is the tier's level — interface taps quietest, result
 * jingles loudest, the music under all of them.
 */
import type { SfxName, SfxOptions } from './types.ts';
import { SFX_LAND_INTERVAL, SFX_MATCH_VOICES, type SfxRequest } from './limiter.ts';
import { clamp } from './rng.ts';
import { matchStepIndex, matchStepMidi, matchStepSparkles, midiToFreq, praiseMotif, starStepMidi, stepInRange } from './scale.ts';
import { Voice, dum, filter, fm, ka, noise, pluck, saturator, tek, tone, type VoiceGroup } from './voices.ts';

/**
 * Loudness tier, quietest first:
 *   ui      interface taps and pop-ups
 *   soft    the constant small sounds of the board settling (land, hint)
 *   handle  picking up and moving a gem (select, swap, invalid)
 *   clear   gems clearing — the 'match' ladder — and coin ticks
 *   board   blockers and everything else that happens on the board
 *   special the blasts of special pieces and boosters
 *   big     double blasts, praise and reached goals
 *   jingle  results and rewards
 */
export type SfxTier = 'ui' | 'soft' | 'handle' | 'clear' | 'board' | 'special' | 'big' | 'jingle';

/** Tiers from quietest to loudest; the position is the tier's rank when voices are stolen. */
export const SFX_TIERS: readonly SfxTier[] = ['ui', 'soft', 'handle', 'clear', 'board', 'special', 'big', 'jingle'];

/** Peak level of each tier at the output, dB relative to full scale. */
export const SFX_TIER_PEAK_DB: Record<SfxTier, number> = {
  ui: -18,
  soft: -16,
  handle: -14,
  clear: -12,
  board: -10,
  special: -8,
  big: -6,
  jingle: -5,
};

/** Coarse class kept for the lab page: the three quiet tiers are 'ui', jingles are 'jingle'. */
export type SfxClass = 'ui' | 'game' | 'jingle';

/** Different takes of a sound that is heard again and again ('match'): detune and attack. */
export const MATCH_VARIANTS: readonly { cents: number; attack: number }[] = [
  { cents: 0, attack: 0.004 },
  { cents: 6, attack: 0.006 },
  { cents: -6, attack: 0.008 },
];

interface SfxDef {
  /** Voice gain; brings the recipe's peak to the tier's level. Set by `audio-check --calibrate`. */
  gain: number;
  /**
   * For a stepped sound: a level correction in dB for each step of SFX_STEPS — and, when the
   * sound has several takes, for each take of each step (step by step, take after take) — so
   * that every one of them peaks at the tier's level: the recipes differ from step to step,
   * and a faster attack lets more of the first wave through. Also set by `--calibrate`.
   */
  trimDb?: readonly number[];
  tier: SfxTier;
  /** Number of round-robin takes (default 1). */
  variants?: number;
  /** At most this many voices of the sound at once; the oldest one gives way (default: no own limit). */
  voices?: number;
  /** Not started twice within this many seconds (default: the gate's 30 ms). */
  interval?: number;
  build(v: Voice, step: number | undefined, variant: number): void;
}

const hz = midiToFreq;

// MIDI notes of D Hijaz used below.
const D3 = 50;
const G3 = 55;
const A3 = 57;
const Bb3 = 58;
const D4 = 62;
const Eb4 = 63;
const Fs4 = 66;
const G4 = 67;
const A4 = 69;
const Bb4 = 70;
const D5 = 74;
const Eb5 = 75;
const Fs5 = 78;
const G5 = 79;
const A5 = 81;
const C6 = 84;
const D6 = 86;
const Fs6 = 90;
const G6 = 91;
const A6 = 93;
const C7 = 96;
const D7 = 98;
const Fs7 = 102;

/** Struck chime: pure body with a brief metallic "tine" at the attack. */
function chime(v: Voice, midi: number, at: number, dur: number, peak: number, shimmer: number = 0.2): void {
  const f = hz(midi);
  fm(v, { f, ratio: 5.02, index: 0.85, indexEnd: 0.01, modDur: 0.05, at, dur, peak, attack: 0.002 });
  if (shimmer > 0) tone(v, { f: f * 2, at, dur: dur * 0.6, peak: peak * shimmer, attack: 0.002 });
}

/** Small bell with inharmonic overtones that ring out. */
function bell(v: Voice, midi: number, at: number, dur: number, peak: number): void {
  fm(v, { f: hz(midi), ratio: 3.5, index: 0.8, indexEnd: 0.04, modDur: dur * 0.5, at, dur, peak, attack: 0.002 });
}

/**
 * The weight of a blast: a sine that drops fast through the 150–400 Hz range a phone speaker
 * can still play, with a triangle an octave above so the hit is felt on small speakers too.
 */
function thump(v: Voice, at: number, from: number, to: number, dur: number, peak: number, dest?: AudioNode): void {
  tone(v, { f: from, f2: to, glide: dur * 0.35, at, dur, peak, attack: 0.002, to: dest });
  tone(v, { type: 'triangle', f: from * 2, f2: to * 2, glide: dur * 0.3, at, dur: dur * 0.5, peak: peak * 0.34, attack: 0.002, to: dest });
}

/** A soft chord of triangles through a low-pass that opens a little: warmth under a jingle. */
function bloom(v: Voice, midis: readonly number[], at: number, dur: number, peak: number, attack: number = 0.04): void {
  const lp = filter(v, 'lowpass', 1400, 0.6, { f2: 3200, at, dur: dur * 0.5 });
  for (let k = 0; k < midis.length; k++) {
    tone(v, { type: 'triangle', f: hz(midis[k]), at, dur, peak, attack, hold: dur * 0.25, to: lp });
  }
}

/** High, quick sine twinkles, one after another. */
function glitter(v: Voice, midis: readonly number[], at: number, spacing: number, peak: number, dur: number = 0.28): void {
  for (let k = 0; k < midis.length; k++) {
    tone(v, { f: hz(midis[k]), at: at + k * spacing, dur, peak, attack: 0.004 });
  }
}

const SFX: Record<SfxName, SfxDef> = {
  // ── interface ──────────────────────────────────────────────────────────
  button: {
    gain: 0.225,
    tier: 'ui',
    build(v) {
      tone(v, { f: 620, f2: 440, glide: 0.04, dur: 0.07, peak: 0.5, attack: 0.002 });
      tone(v, { type: 'triangle', f: 1240, f2: 880, glide: 0.03, dur: 0.035, peak: 0.12, attack: 0.001 });
      noise(v, { type: 'bandpass', f: 2600, q: 1.2, dur: 0.02, peak: 0.25, attack: 0.001 });
    },
  },
  popupOpen: {
    gain: 0.27,
    tier: 'ui',
    build(v) {
      tone(v, { f: 330, f2: 660, glide: 0.09, dur: 0.14, peak: 0.45, attack: 0.008 });
      tone(v, { type: 'triangle', f: 660, f2: 1320, glide: 0.09, dur: 0.1, peak: 0.08, attack: 0.008 });
      noise(v, { type: 'bandpass', f: 900, f2: 2600, q: 1.5, dur: 0.12, peak: 0.15, attack: 0.04 });
    },
  },
  popupClose: {
    gain: 0.285,
    tier: 'ui',
    build(v) {
      tone(v, { f: 620, f2: 310, glide: 0.08, dur: 0.12, peak: 0.45, attack: 0.008 });
      noise(v, { type: 'bandpass', f: 2400, f2: 900, q: 1.5, dur: 0.1, peak: 0.12, attack: 0.02 });
    },
  },

  // ── moving gems ────────────────────────────────────────────────────────
  select: {
    gain: 0.407,
    tier: 'handle',
    build(v) {
      // A small bright "pick": a rising fifth with a glint on top.
      tone(v, { type: 'triangle', f: hz(D5), f2: hz(A5), glide: 0.06, dur: 0.12, peak: 0.5, attack: 0.004 });
      tone(v, { f: hz(A6), at: 0.03, dur: 0.06, peak: 0.1, attack: 0.004 });
    },
  },
  swap: {
    gain: 0.317,
    tier: 'handle',
    build(v) {
      // A quick "fwip": the tone speaks at once, the air sweeps up behind it.
      tone(v, { f: 300, f2: 560, glide: 0.11, dur: 0.16, peak: 0.5, attack: 0.006 });
      tone(v, { type: 'triangle', f: 600, f2: 1120, glide: 0.11, dur: 0.1, peak: 0.1, attack: 0.006 });
      noise(v, { type: 'bandpass', f: 700, f2: 2800, q: 1.3, dur: 0.17, peak: 0.6, attack: 0.008 });
    },
  },
  invalid: {
    gain: 0.497,
    tier: 'handle',
    build(v) {
      // Two dull, slightly buzzy bumps stepping down: "uh-uh".
      const lp = filter(v, 'lowpass', 1500, 0.7);
      tone(v, { type: 'square', f: hz(Bb4), dur: 0.09, hold: 0.03, peak: 0.26, attack: 0.004, to: lp });
      tone(v, { type: 'square', f: hz(G4), at: 0.1, dur: 0.13, hold: 0.04, peak: 0.26, attack: 0.004, to: lp });
      tone(v, { type: 'triangle', f: hz(Bb3), dur: 0.08, hold: 0.03, peak: 0.1, attack: 0.004 });
      tone(v, { type: 'triangle', f: hz(G3), at: 0.1, dur: 0.11, hold: 0.04, peak: 0.1, attack: 0.004 });
    },
  },
  land: {
    gain: 0.306,
    tier: 'soft',
    interval: SFX_LAND_INTERVAL,
    build(v) {
      // A soft tap. The body sits high enough to be heard on a phone speaker.
      tone(v, { type: 'triangle', f: 330, f2: 190, glide: 0.05, dur: 0.08, peak: 0.5, attack: 0.002 });
      tone(v, { f: 760, f2: 480, glide: 0.03, dur: 0.04, peak: 0.25, attack: 0.001 });
      noise(v, { type: 'bandpass', f: 1500, q: 0.8, dur: 0.03, peak: 0.6, attack: 0.001 });
    },
  },
  hint: {
    gain: 0.346,
    tier: 'soft',
    build(v) {
      // "Over here": two soft notes, a fourth apart, the second left to ring a little.
      tone(v, { f: hz(A5), dur: 0.15, peak: 0.4, attack: 0.008 });
      tone(v, { f: hz(D6), at: 0.11, dur: 0.22, peak: 0.42, attack: 0.008 });
      tone(v, { type: 'triangle', f: hz(D5), at: 0.11, dur: 0.16, peak: 0.1, attack: 0.01 });
    },
  },

  // ── clears ─────────────────────────────────────────────────────────────
  match: {
    gain: 0.317,
    trimDb: [
      -2.2, -0.3, 0.1,
      -1.2, -0.9, -0.3,
      -0.7, -0.8, -0.3,
      -1, -0.3, 0.1,
      -1.5, -0.4, 0.9,
      -1.2, 0.2, 1.5,
      1, 0.9, 0.3,
      1, 0.7, 0.6,
      0.9, 0.5, 0.5,
      0.9, 0.3, 0,
      0.7, 0.6, 0.3,
      0.1, -0.1, -0.4,
      0.1, -0.1, -0.4,
    ],
    tier: 'clear',
    variants: MATCH_VARIANTS.length,
    voices: SFX_MATCH_VOICES,
    build(v, step, variant) {
      // A gem pops: a woody pluck that chirps up into its note, a glassy octave above it and
      // a tick of air at the very front. The note climbs the cascade ladder (scale.ts).
      const take = MATCH_VARIANTS[((variant % MATCH_VARIANTS.length) + MATCH_VARIANTS.length) % MATCH_VARIANTS.length];
      const rung = matchStepIndex(step);
      const f = hz(matchStepMidi(step)) * Math.pow(2, take.cents / 1200);
      // The low rungs lean on their overtones, which is where a phone speaker can follow
      // them; towards the top the note is left purer so that it stays sweet, not shrill.
      const low = Math.max(0, 1 - rung / 7);
      fm(v, { f: f * 0.89, f2: f, glide: 0.016, ratio: 2, modOf: f, index: 1.05, indexEnd: 0.02, modDur: 0.05, dur: 0.21, peak: 0.6 - 0.1 * low, attack: take.attack });
      tone(v, { f: f * 2, dur: 0.14, peak: 0.2 + 0.16 * low, attack: take.attack });
      tone(v, { f: f * 3, dur: 0.09, peak: 0.05 + 0.13 * low, attack: take.attack });
      tone(v, { f: f * 4, dur: 0.045, peak: 0.07, attack: 0.002 });
      noise(v, { type: 'bandpass', f: 3800, q: 1, dur: 0.014, peak: 0.16, attack: 0.001 });
      // Beyond the top of the ladder the note holds and a sparkle layer joins: 2× and 3×, −12 dB.
      if (matchStepSparkles(step)) {
        tone(v, { f: f * 2, at: 0.03, dur: 0.19, peak: 0.15, attack: 0.004 });
        tone(v, { f: f * 3, at: 0.045, dur: 0.17, peak: 0.15, attack: 0.004 });
      }
    },
  },
  coin: {
    gain: 0.414,
    tier: 'clear',
    build(v) {
      // One struck metal ring with shimmering overtones.
      fm(v, { f: hz(Fs6), ratio: 2.76, index: 1, indexEnd: 0.1, modDur: 0.12, dur: 0.22, peak: 0.45, attack: 0.001 });
      tone(v, { f: hz(Fs6) * 2, dur: 0.14, peak: 0.12, attack: 0.002 });
      tone(v, { type: 'triangle', f: hz(Fs5), dur: 0.08, peak: 0.1, attack: 0.002 });
      noise(v, { type: 'bandpass', f: 5200, q: 1, dur: 0.02, peak: 0.18, attack: 0.001 });
    },
  },

  // ── blockers and the board ─────────────────────────────────────────────
  sand: {
    gain: 0.382,
    tier: 'board',
    build(v) {
      // A soft "pff" of grains: mid-band hiss that settles, with a little air above it.
      noise(v, { type: 'bandpass', f: 2300, f2: 1300, q: 0.8, dur: 0.17, peak: 1.3, attack: 0.01 });
      noise(v, { type: 'bandpass', f: 4300, q: 1.2, at: 0.03, dur: 0.11, peak: 0.45, attack: 0.02 });
      tone(v, { f: 480, f2: 340, dur: 0.08, peak: 0.2, attack: 0.004 });
    },
  },
  stone: {
    gain: 0.322,
    tier: 'board',
    build(v) {
      // A knock on rock: pitched tock, grit, and a little weight underneath.
      tone(v, { f: 640, f2: 420, glide: 0.05, dur: 0.11, peak: 0.6, attack: 0.001 });
      tone(v, { f: 970, f2: 640, glide: 0.04, dur: 0.07, peak: 0.26, attack: 0.001 });
      tone(v, { type: 'triangle', f: 230, f2: 150, glide: 0.05, dur: 0.11, peak: 0.22, attack: 0.002 });
      noise(v, { type: 'bandpass', f: 1500, q: 0.9, dur: 0.07, peak: 0.55, attack: 0.002 });
      noise(v, { type: 'highpass', f: 3500, q: 0.7, dur: 0.02, peak: 0.25, attack: 0.001 });
    },
  },
  stoneBreak: {
    gain: 0.313,
    tier: 'board',
    build(v) {
      // The block gives way: a crack, a thud, and pieces tumbling after it.
      tone(v, { f: 560, f2: 260, glide: 0.08, dur: 0.15, peak: 0.55, attack: 0.001 });
      tone(v, { f: 840, f2: 420, glide: 0.06, dur: 0.1, peak: 0.25, attack: 0.001 });
      tone(v, { type: 'triangle', f: 240, f2: 130, glide: 0.1, dur: 0.26, peak: 0.34, attack: 0.003 });
      noise(v, { type: 'bandpass', f: 1300, q: 0.8, dur: 0.1, peak: 0.9, attack: 0.001 });
      const bits = [900, 1700, 1200, 2100];
      const pebbles = [700, 560, 470, 390];
      for (let k = 0; k < bits.length; k++) {
        const at = 0.07 + k * 0.065;
        noise(v, { type: 'bandpass', f: bits[k], q: 1.5, at, dur: 0.07, peak: 0.9 - k * 0.15, attack: 0.002 });
        tone(v, { f: pebbles[k], f2: pebbles[k] * 0.8, at, dur: 0.06, peak: 0.3 - k * 0.04, attack: 0.001 });
      }
    },
  },
  chain: {
    gain: 0.679,
    tier: 'board',
    build(v) {
      // Two links knocking: clangorous FM pairs.
      fm(v, { f: 1720, ratio: 1.41, index: 1.7, indexEnd: 0.25, modDur: 0.08, dur: 0.14, peak: 0.35, attack: 0.001 });
      fm(v, { f: 2090, ratio: 1.41, index: 1.7, indexEnd: 0.25, modDur: 0.08, at: 0.075, dur: 0.17, peak: 0.35, attack: 0.001 });
      tone(v, { type: 'triangle', f: 430, f2: 320, dur: 0.06, peak: 0.16, attack: 0.002 });
      noise(v, { type: 'bandpass', f: 4600, q: 1, dur: 0.03, peak: 0.2, attack: 0.001 });
    },
  },
  vine: {
    gain: 0.442,
    tier: 'board',
    build(v) {
      // A snip and a rustle of leaves.
      tone(v, { type: 'triangle', f: 740, f2: 260, glide: 0.09, dur: 0.13, peak: 0.5, attack: 0.003 });
      noise(v, { type: 'bandpass', f: 2400, f2: 1200, q: 1.2, dur: 0.12, peak: 1, attack: 0.004 });
      noise(v, { type: 'bandpass', f: 3600, q: 1.5, at: 0.06, dur: 0.07, peak: 0.6, attack: 0.004 });
    },
  },
  vineGrow: {
    gain: 0.453,
    tier: 'board',
    build(v) {
      // A creeping semitone rise, D → E♭, with a wobble.
      tone(v, { type: 'triangle', f: hz(D5), f2: hz(Eb5), glide: 0.25, dur: 0.36, peak: 0.4, attack: 0.06, vib: 9, vibDepth: 8 });
      tone(v, { type: 'triangle', f: hz(A4), f2: hz(Bb4), glide: 0.25, dur: 0.34, peak: 0.3, attack: 0.06 });
      tone(v, { f: hz(D4), f2: hz(Eb4), glide: 0.25, dur: 0.34, peak: 0.2, attack: 0.06 });
      noise(v, { type: 'bandpass', f: 1200, f2: 2600, q: 1.5, dur: 0.3, peak: 0.5, attack: 0.15 });
    },
  },
  lamp: {
    gain: 0.524,
    tier: 'board',
    build(v) {
      // The lamp arrives: two brass bells, the second one warm and ringing.
      bell(v, A5, 0, 0.3, 0.4);
      bell(v, D6, 0.11, 0.48, 0.45);
      tone(v, { type: 'triangle', f: hz(D5), at: 0.11, dur: 0.4, peak: 0.2, attack: 0.01 });
      tone(v, { type: 'triangle', f: hz(A4), at: 0.11, dur: 0.3, peak: 0.1, attack: 0.02 });
      tone(v, { f: hz(Fs6), at: 0.16, dur: 0.3, peak: 0.08, attack: 0.004 });
    },
  },
  createBeam: {
    gain: 1.137,
    tier: 'board',
    build(v) {
      // A quick upward zip ending in a glint.
      const lp = filter(v, 'lowpass', 1200, 2, { f2: 5200, dur: 0.2 });
      tone(v, { type: 'sawtooth', f: hz(D5), f2: hz(D6), glide: 0.18, dur: 0.26, peak: 0.3, attack: 0.01, to: lp });
      noise(v, { type: 'bandpass', f: 1500, f2: 6000, q: 2, dur: 0.2, peak: 0.12, attack: 0.1 });
      fm(v, { f: hz(A6), ratio: 2, index: 0.6, at: 0.17, dur: 0.22, peak: 0.25 });
    },
  },
  createNova: {
    gain: 0.422,
    tier: 'board',
    build(v) {
      // A swelling charge that settles on a bell.
      tone(v, { type: 'triangle', f: hz(A3), f2: hz(A4), glide: 0.22, dur: 0.3, peak: 0.45, attack: 0.16, vib: 14, vibDepth: 6 });
      tone(v, { f: hz(D4), f2: hz(D5), glide: 0.22, dur: 0.3, peak: 0.3, attack: 0.16 });
      noise(v, { type: 'bandpass', f: 400, f2: 1800, q: 1.2, dur: 0.26, peak: 0.15, attack: 0.18 });
      bell(v, Fs5, 0.22, 0.3, 0.4);
    },
  },
  createPrism: {
    gain: 0.636,
    tier: 'board',
    build(v) {
      // A run up the scale, each note a small bell; the last one rings.
      const run = [D5, Eb5, Fs5, G5, A5, D6];
      for (let k = 0; k < run.length; k++) {
        const lastNote = k === run.length - 1;
        fm(v, { f: hz(run[k]), ratio: 2, index: 0.7, indexEnd: 0.02, at: k * 0.04, dur: lastNote ? 0.42 : 0.16, peak: lastNote ? 0.42 : 0.3 });
      }
      tone(v, { f: hz(D7), at: 0.2, dur: 0.36, peak: 0.07, attack: 0.01 });
      noise(v, { type: 'bandpass', f: 5200, q: 0.8, at: 0.05, dur: 0.3, peak: 0.07, attack: 0.15 });
    },
  },
  shuffle: {
    gain: 0.555,
    tier: 'board',
    build(v) {
      const seq = [D5, G5, Eb5, A5, Fs5, C6, A5, D6];
      for (let k = 0; k < seq.length; k++) {
        fm(v, { f: hz(seq[k]), ratio: 3, index: 0.6, indexEnd: 0.02, modDur: 0.04, at: k * 0.05, dur: 0.11, peak: 0.3 });
      }
      noise(v, { type: 'bandpass', f: 800, f2: 3200, q: 1.2, dur: 0.24, peak: 0.6, attack: 0.1 });
      noise(v, { type: 'bandpass', f: 3200, f2: 900, q: 1.2, at: 0.22, dur: 0.26, peak: 0.6, attack: 0.1 });
    },
  },
  movesLow: {
    gain: 0.47,
    tier: 'board',
    build(v) {
      // A gentle nudge: E♭ E♭ D, the scale's leaning tone resolving home.
      const notes = [Eb5, Eb5, D5];
      for (let k = 0; k < notes.length; k++) {
        const at = k * 0.14;
        fm(v, { f: hz(notes[k]), ratio: 4, index: 0.5, indexEnd: 0.01, modDur: 0.03, at, dur: k === 2 ? 0.22 : 0.12, peak: 0.5 });
        tone(v, { type: 'triangle', f: hz(notes[k] - 12), at, dur: 0.1, peak: 0.2, attack: 0.004 });
      }
    },
  },
  lifeLost: {
    gain: 0.579,
    tier: 'board',
    build(v) {
      // A falling sigh: A, then E♭ sinking onto D while the tone darkens.
      const lp = filter(v, 'lowpass', 2600, 0.7, { f2: 900, dur: 0.48 });
      tone(v, { type: 'triangle', f: hz(A4), dur: 0.17, peak: 0.36, attack: 0.005, to: lp });
      tone(v, { f: hz(A5), dur: 0.14, peak: 0.2, attack: 0.005 });
      tone(v, { type: 'triangle', f: hz(Eb4), f2: hz(D4), glide: 0.25, at: 0.15, dur: 0.36, peak: 0.36, attack: 0.005, to: lp });
      tone(v, { f: hz(Eb5), f2: hz(D5), glide: 0.25, at: 0.15, dur: 0.32, peak: 0.24, attack: 0.005 });
    },
  },

  // ── specials ───────────────────────────────────────────────────────────
  beam: {
    gain: 0.333,
    tier: 'special',
    build(v) {
      // Line blast: a crack, a streak of noise tearing down the line, and a thump of weight,
      // driven into saturation so that the blast is dense rather than spiky.
      const sat = saturator(v, 1.1);
      noise(v, { type: 'highpass', f: 2500, q: 0.7, dur: 0.02, peak: 0.4, attack: 0.001 });
      noise(v, { type: 'bandpass', f: 5200, f2: 420, q: 1.1, dur: 0.34, peak: 1.1, attack: 0.006, to: sat });
      thump(v, 0, 340, 150, 0.28, 0.85, sat);
      const lp = filter(v, 'lowpass', 2600, 1, { f2: 500, dur: 0.3 }, sat);
      tone(v, { type: 'sawtooth', f: hz(D5), f2: hz(D3), glide: 0.26, dur: 0.32, peak: 0.34, attack: 0.005, to: lp });
      tone(v, { f: hz(D6), f2: hz(D4), glide: 0.2, dur: 0.24, peak: 0.2, attack: 0.004, to: sat });
    },
  },
  nova: {
    gain: 0.332,
    tier: 'special',
    build(v) {
      // Area blast: a punch you can feel, a burst of air that closes down, a ring that sinks —
      // saturated, so the whole of it is heavy and not just its first instant.
      const sat = saturator(v, 1.1);
      noise(v, { type: 'bandpass', f: 1800, q: 0.8, dur: 0.03, peak: 0.4, attack: 0.001 });
      thump(v, 0, 300, 110, 0.44, 0.9, sat);
      tone(v, { f: 150, f2: 52, glide: 0.3, dur: 0.46, peak: 0.2, attack: 0.004 });
      tone(v, { type: 'triangle', f: hz(A4), f2: hz(A3), glide: 0.3, dur: 0.4, peak: 0.4, attack: 0.004, to: sat });
      noise(v, { type: 'lowpass', f: 5000, f2: 400, q: 0.9, dur: 0.44, peak: 0.7, attack: 0.005, to: sat });
      fm(v, { f: hz(D5), f2: hz(D4), ratio: 1.41, index: 1.2, indexEnd: 0.05, dur: 0.36, peak: 0.4, to: sat });
    },
  },
  prism: {
    gain: 0.698,
    tier: 'special',
    build(v) {
      // Rays: a soft thud, a swirl of air, bright notes darting about above a rising chord.
      thump(v, 0, 260, 150, 0.2, 0.5);
      noise(v, { type: 'bandpass', f: 900, f2: 6000, q: 2.5, dur: 0.3, peak: 0.25, attack: 0.12 });
      noise(v, { type: 'bandpass', f: 6000, f2: 1500, q: 2.5, at: 0.25, dur: 0.36, peak: 0.2, attack: 0.02 });
      const rays = [D6, Fs6, A6, G6, C7, D7, A6];
      for (let k = 0; k < rays.length; k++) {
        fm(v, { f: hz(rays[k]), ratio: 2, index: 0.5, at: 0.03 + k * 0.055, dur: 0.2, peak: 0.26 });
      }
      tone(v, { type: 'triangle', f: hz(D4), f2: hz(D5), glide: 0.4, dur: 0.55, peak: 0.22, attack: 0.08 });
      tone(v, { type: 'triangle', f: hz(A4), f2: hz(A5), glide: 0.4, dur: 0.55, peak: 0.14, attack: 0.1 });
      bell(v, D6, 0.42, 0.3, 0.24);
    },
  },
  booster: {
    gain: 0.812,
    tier: 'special',
    build(v) {
      tone(v, { type: 'triangle', f: hz(D4), f2: hz(D6), glide: 0.26, dur: 0.32, peak: 0.4, attack: 0.03 });
      noise(v, { type: 'bandpass', f: 700, f2: 5000, q: 2, dur: 0.3, peak: 0.2, attack: 0.2 });
      bell(v, D6, 0.26, 0.26, 0.4);
      bell(v, A6, 0.3, 0.22, 0.25);
      tone(v, { type: 'triangle', f: hz(D5), at: 0.26, dur: 0.2, peak: 0.14, attack: 0.006 });
    },
  },

  // ── big moments ────────────────────────────────────────────────────────
  bigCombo: {
    gain: 0.337,
    tier: 'big',
    build(v) {
      // Two specials at once: a heavy, saturated impact that falls away under a chord that
      // mellows and a bell that rings on.
      const sat = saturator(v, 1.1);
      noise(v, { type: 'highpass', f: 2200, q: 0.7, dur: 0.025, peak: 0.4, attack: 0.001 });
      thump(v, 0, 320, 105, 0.5, 0.9, sat);
      tone(v, { f: 150, f2: 46, glide: 0.4, dur: 0.66, peak: 0.2, attack: 0.004 });
      noise(v, { type: 'lowpass', f: 7000, f2: 320, q: 0.9, dur: 0.6, peak: 0.65, attack: 0.005, to: sat });
      noise(v, { type: 'bandpass', f: 4200, f2: 700, q: 1.2, at: 0.04, dur: 0.5, peak: 0.5, attack: 0.03, to: sat });
      const lp = filter(v, 'lowpass', 3600, 1.2, { f2: 480, at: 0.02, dur: 0.55 }, sat);
      const chord = [D4, A4, D5, Fs5];
      for (let k = 0; k < chord.length; k++) {
        tone(v, { type: 'sawtooth', f: hz(chord[k]), at: 0.02, dur: 0.66, peak: 0.2, attack: 0.012, to: lp });
      }
      bell(v, D5, 0.02, 0.5, 0.36);
      bell(v, A5, 0.05, 0.44, 0.16);
    },
  },
  praise: {
    gain: 0.86,
    trimDb: [0.3, 0.9, 1, -2.5],
    tier: 'big',
    build(v, step) {
      // A rising motif of two to five ladder notes, each a bell with a warm octave under it;
      // the last note rings, and bigger praise brings a soft chord, glitter and a drum.
      const level = stepInRange(step, 1, 4, 1);
      const motif = praiseMotif(step);
      const spacing = 0.085;
      const last = motif.length - 1;
      for (let k = 0; k <= last; k++) {
        const at = k * spacing;
        const ring = k === last ? 0.46 : 0.22;
        chime(v, motif[k], at, ring, k === last ? 0.42 : 0.32, 0.22);
        tone(v, { type: 'triangle', f: hz(motif[k] - 12), at, dur: ring * 0.7, peak: 0.13, attack: 0.004 });
      }
      const land = last * spacing;
      tone(v, { f: hz(motif[last] + 12), at: land + 0.02, dur: 0.3, peak: 0.07 + 0.015 * level, attack: 0.004 });
      if (level >= 2) bloom(v, level >= 3 ? [D4, A4, D5] : [D5, A5], land, 0.4, 0.07);
      if (level >= 3) glitter(v, level >= 4 ? [A6, D7, Fs7] : [A6, D7], land + 0.09, 0.06, 0.06, 0.22);
      if (level >= 4) dum(v, land, 0.22);
    },
  },
  goalDone: {
    gain: 0.778,
    tier: 'big',
    build(v) {
      const notes = [D5, A5, D6];
      for (let k = 0; k < notes.length; k++) {
        chime(v, notes[k], k * 0.09, k === 2 ? 0.4 : 0.18, 0.42, 0.18);
      }
      tone(v, { type: 'triangle', f: hz(D4), at: 0.18, dur: 0.32, peak: 0.2, attack: 0.01 });
      tone(v, { type: 'triangle', f: hz(A4), at: 0.18, dur: 0.3, peak: 0.12, attack: 0.01 });
      tek(v, 0.18, 0.4);
    },
  },
  finale: {
    gain: 0.601,
    tier: 'big',
    build(v) {
      // The bonus begins: the ladder itself runs up in a hurry and lands on a ringing octave.
      noise(v, { type: 'bandpass', f: 500, f2: 5200, q: 1.5, dur: 0.36, peak: 0.3, attack: 0.26 });
      const run = [D5, Fs5, G5, A5, C6];
      for (let k = 0; k < run.length; k++) {
        const at = k * 0.05;
        chime(v, run[k], at, 0.16, 0.26, 0.15);
        pluck(v, { midi: run[k] - 12, at, dur: 0.2, peak: 0.26 });
      }
      const land = 0.27;
      bell(v, D6, land, 0.5, 0.4);
      bell(v, Fs6, land + 0.03, 0.44, 0.2);
      bloom(v, [D4, A4, D5], land, 0.5, 0.09);
      dum(v, land, 0.5);
      tek(v, land + 0.11, 0.45);
      glitter(v, [A6, D7], land + 0.12, 0.07, 0.06, 0.24);
    },
  },

  // ── results and rewards ────────────────────────────────────────────────
  star: {
    gain: 0.869,
    trimDb: [-0.4, 0.5, 0],
    tier: 'jingle',
    build(v, step) {
      // One bright bell per star, each higher than the last, with more glitter.
      const s = stepInRange(step, 1, 3, 1);
      const midi = starStepMidi(step);
      bell(v, midi, 0, 0.45, 0.5);
      tone(v, { f: hz(midi + 12), at: 0.02, dur: 0.3, peak: 0.14, attack: 0.003 });
      tone(v, { type: 'triangle', f: hz(midi - 12), dur: 0.25, peak: 0.2, attack: 0.006 });
      noise(v, { type: 'bandpass', f: 5600, q: 0.8, dur: 0.1 + 0.04 * s, peak: 0.1, attack: 0.004 });
      const sparks = [D7, D7 + 4, D7 + 7];
      for (let k = 0; k < s; k++) {
        tone(v, { f: hz(sparks[k]), at: 0.06 + k * 0.045, dur: 0.12, peak: 0.06, attack: 0.003 });
      }
    },
  },
  levelStart: {
    gain: 0.655,
    tier: 'jingle',
    build(v) {
      dum(v, 0, 0.6);
      const notes = [D4, A4, D5];
      for (let k = 0; k < notes.length; k++) {
        pluck(v, { midi: notes[k], at: k * 0.09, dur: 0.42, peak: 0.4 });
        chime(v, notes[k] + 12, k * 0.09, 0.2, 0.2, 0);
      }
      tek(v, 0.18, 0.6);
      tone(v, { f: hz(Fs6), at: 0.27, dur: 0.26, peak: 0.07, attack: 0.004 });
    },
  },
  purchase: {
    gain: 0.98,
    tier: 'jingle',
    build(v) {
      // Two metal rings, then a warm chord of confirmation.
      fm(v, { f: hz(Fs6), ratio: 2.76, index: 1, indexEnd: 0.1, modDur: 0.1, dur: 0.16, peak: 0.36, attack: 0.001 });
      fm(v, { f: hz(A6), ratio: 2.76, index: 1, indexEnd: 0.1, modDur: 0.1, at: 0.07, dur: 0.2, peak: 0.36, attack: 0.001 });
      ka(v, 0, 0.35);
      const chord = [D5, Fs5, A5];
      for (let k = 0; k < chord.length; k++) {
        tone(v, { type: 'triangle', f: hz(chord[k]), at: 0.17, dur: 0.56, peak: 0.2, attack: 0.012 });
        bell(v, chord[k] + 12, 0.17 + k * 0.03, 0.4, 0.14);
      }
    },
  },
  reward: {
    gain: 0.809,
    tier: 'jingle',
    build(v) {
      // A rising arpeggio that blooms into a held, shimmering fifth.
      const arp = [D5, G5, A5, D6, Fs6];
      for (let k = 0; k < arp.length; k++) {
        const at = k * 0.07;
        bell(v, arp[k], at, 0.3, 0.32);
        pluck(v, { midi: arp[k] - 12, at, dur: 0.3, peak: 0.3 });
      }
      tone(v, { type: 'triangle', f: hz(D5), at: 0.38, dur: 0.85, peak: 0.16, attack: 0.03 });
      bell(v, D6, 0.4, 0.85, 0.26);
      bell(v, A6, 0.44, 0.8, 0.2);
      noise(v, { type: 'bandpass', f: 5600, q: 0.8, at: 0.36, dur: 0.5, peak: 0.06, attack: 0.1 });
    },
  },
  chest: {
    gain: 0.735,
    tier: 'jingle',
    build(v) {
      // A latch knocks open, the lid swings up and light spills out as a strummed chord.
      tone(v, { type: 'triangle', f: 230, f2: 130, glide: 0.05, dur: 0.1, peak: 0.5, attack: 0.002 });
      noise(v, { type: 'bandpass', f: 950, q: 0.9, dur: 0.05, peak: 0.5, attack: 0.001 });
      ka(v, 0.07, 0.5);
      tone(v, { type: 'triangle', f: hz(D4), f2: hz(A4), glide: 0.16, at: 0.1, dur: 0.2, peak: 0.22, attack: 0.05, vib: 11, vibDepth: 5 });
      noise(v, { type: 'bandpass', f: 600, f2: 3000, q: 1.4, at: 0.1, dur: 0.22, peak: 0.2, attack: 0.14 });
      const open = 0.26;
      const chord = [D5, Fs5, A5, D6];
      for (let k = 0; k < chord.length; k++) {
        const at = open + k * 0.035;
        bell(v, chord[k], at, k === chord.length - 1 ? 0.62 : 0.5, 0.3);
        pluck(v, { midi: chord[k] - 12, at, dur: 0.5, peak: 0.22 });
      }
      bloom(v, [D4, A4, D5], open, 0.66, 0.08);
      glitter(v, [A6, D7, Fs7, D7], open + 0.2, 0.07, 0.06, 0.26);
      noise(v, { type: 'bandpass', f: 5600, q: 0.8, at: open + 0.05, dur: 0.5, peak: 0.05, attack: 0.12 });
    },
  },
  caravan: {
    gain: 0.594,
    tier: 'jingle',
    build(v) {
      // The caravan sets off: a walking hand-drum figure under two swinging brass bells.
      const beat = 0.12;
      dum(v, 0, 0.6);
      ka(v, beat, 0.4);
      tek(v, beat * 2, 0.5);
      dum(v, beat * 3, 0.5);
      tek(v, beat * 4, 0.55);
      const bells = [A5, D6, A5, D6];
      for (let k = 0; k < bells.length; k++) {
        fm(v, { f: hz(bells[k]), ratio: 2.76, index: 0.9, indexEnd: 0.08, modDur: 0.1, at: k * beat, dur: 0.2, peak: 0.3, attack: 0.001 });
        pluck(v, { midi: bells[k] - 24, at: k * beat, dur: 0.24, peak: 0.26 });
      }
      const land = beat * 4;
      bell(v, Fs6, land, 0.55, 0.36);
      bell(v, D6, land + 0.02, 0.5, 0.2);
      pluck(v, { midi: D5, at: land, dur: 0.6, peak: 0.3 });
      bloom(v, [D4, A4], land, 0.5, 0.09);
    },
  },
  win: {
    gain: 0.64,
    tier: 'jingle',
    build(v) {
      // A short original flourish: up the scale to the octave, a drum roll into a ringing,
      // strummed chord that blooms and glitters as it fades.
      const line = [D5, Fs5, A5, G5, A5, C6];
      for (let k = 0; k < line.length; k++) {
        const at = k * 0.12;
        pluck(v, { midi: line[k] - 12, at, dur: 0.36, peak: 0.36 });
        chime(v, line[k], at, 0.22, 0.3, 0.15);
      }
      const land = 0.72;
      pluck(v, { midi: D5, at: land, dur: 0.95, peak: 0.3 });
      bell(v, D6, land, 0.95, 0.32);
      bell(v, A6, land + 0.05, 0.8, 0.14);
      // The chord is strummed: each string a few milliseconds after the one below.
      const chord = [D4, A4, Fs5];
      for (let k = 0; k < chord.length; k++) pluck(v, { midi: chord[k], at: land + 0.018 * (k + 1), dur: 0.95, peak: 0.2 });
      bloom(v, [D4, A4, D5, Fs5], land, 0.95, 0.06);
      dum(v, 0, 0.45);
      tek(v, 0.36, 0.45);
      ka(v, 0.6, 0.4);
      ka(v, 0.66, 0.5);
      dum(v, land, 0.5);
      tek(v, land + 0.24, 0.3);
      glitter(v, [Fs6, A6, D7, Fs7], land + 0.2, 0.09, 0.06, 0.3);
    },
  },
  lose: {
    gain: 0.756,
    tier: 'jingle',
    build(v) {
      // A slow walk down to the tonic through the scale's flat second, soft and unhurried.
      const lp = filter(v, 'lowpass', 1300, 0.7);
      const strings = filter(v, 'lowpass', 2600, 0.6);
      const line = [A4, G4, Fs4, Eb4, D4];
      for (let k = 0; k < line.length; k++) {
        const at = k * 0.26;
        const lastNote = k === line.length - 1;
        const level = 0.5 - k * 0.04;
        pluck(v, { midi: line[k], at, dur: lastNote ? 0.7 : 0.4, peak: level, to: strings });
        tone(v, { type: 'triangle', f: hz(line[k]), at, dur: lastNote ? 0.62 : 0.3, peak: level * 0.5, attack: 0.02, to: lp });
      }
      tone(v, { type: 'triangle', f: hz(D3), at: 1.04, dur: 0.6, peak: 0.16, attack: 0.03, to: lp });
      dum(v, 1.04, 0.45);
    },
  },
};

export const SFX_NAMES: readonly SfxName[] = Object.keys(SFX) as SfxName[];

/**
 * Sounds whose character depends on `opts.step`, with the range of steps that make a
 * difference. For 'match' that is the twelve rungs of the ladder plus one step beyond it,
 * which holds the top note and adds the sparkle layer.
 */
export const SFX_STEPS: { [K in SfxName]?: readonly number[] } = {
  match: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  star: [1, 2, 3],
  praise: [1, 2, 3, 4],
};

/** The recipe of a sound, or null for a name that is not a sound (junk input must not throw). */
function defOf(name: SfxName): SfxDef | null {
  return Object.prototype.hasOwnProperty.call(SFX, name) ? SFX[name] : null;
}

/** True for the names of the contract. */
export function isSfxName(name: unknown): name is SfxName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SFX, name);
}

/** The loudness tier of a sound ('board' for anything unknown). */
export function sfxTier(name: SfxName): SfxTier {
  const def = defOf(name);
  return def ? def.tier : 'board';
}

/** Rank of a sound when voices are stolen: the position of its tier, quietest = 0. */
export function sfxRank(name: SfxName): number {
  return SFX_TIERS.indexOf(sfxTier(name));
}

/** The peak level the sound is tuned to at the output, dBFS (at volume 1). */
export function sfxPeakDb(name: SfxName): number {
  return SFX_TIER_PEAK_DB[sfxTier(name)];
}

/** How many round-robin takes a sound has (1 for most). */
export function sfxVariants(name: SfxName): number {
  const def = defOf(name);
  return def && def.variants ? def.variants : 1;
}

export function sfxClass(name: SfxName): SfxClass {
  const tier = sfxTier(name);
  return tier === 'jingle' ? 'jingle' : tier === 'ui' || tier === 'soft' || tier === 'handle' ? 'ui' : 'game';
}

/** Specials, big moments and jingles: the music makes room for these (see index.ts). */
export function sfxDucksMusic(name: SfxName): boolean {
  return sfxRank(name) >= SFX_TIERS.indexOf('special');
}

/** Result jingles and big moments: the last sounds that would ever be dropped or stolen. */
export function isPrioritySfx(name: SfxName): boolean {
  return sfxRank(name) >= SFX_TIERS.indexOf('big');
}

/**
 * Identity used by the rate limiter: the same name and the same audible step count as the
 * same sound. The step is brought into the range that changes the sound first, so step 13
 * and step 40 of 'match' (both the top note with sparkle), or a step passed to a sound that
 * ignores it, cannot slip past the limiter as "different" sounds.
 */
export function sfxKey(name: SfxName, opts?: SfxOptions): string {
  const step = audibleStep(name, opts);
  return step === null ? String(name) : name + '#' + step;
}

/**
 * The step of a stepped sound as it is heard: brought into the range of SFX_STEPS (a missing
 * or junk step counts as the lowest). Null for a sound that has no steps.
 */
function audibleStep(name: SfxName, opts?: SfxOptions): number | null {
  const steps = isSfxName(name) ? SFX_STEPS[name] : undefined;
  if (!steps) return null;
  const lo = steps[0];
  const hi = steps[steps.length - 1];
  const raw = opts && typeof opts.step === 'number' && isFinite(opts.step) ? Math.round(opts.step) : lo;
  return Math.min(hi, Math.max(lo, raw));
}

/** The volume asked for, 0..1 (1 when none or junk was given). */
export function sfxVolume(opts?: SfxOptions): number {
  return opts && typeof opts.volume === 'number' && isFinite(opts.volume) ? clamp(opts.volume, 0, 1) : 1;
}

/** What the voice allocator (limiter.ts) needs to know about a sound that wants to start. */
export function sfxRequest(name: SfxName, opts?: SfxOptions): SfxRequest {
  const def = defOf(name);
  const req: SfxRequest = { key: sfxKey(name, opts), rank: sfxRank(name) };
  if (def && def.voices !== undefined) {
    req.group = String(name);
    req.groupLimit = def.voices;
  }
  if (def && def.interval !== undefined) req.minInterval = def.interval;
  return req;
}

/**
 * Build one sound effect on `ctx`, feeding `dest`, starting at context time `when`, and
 * return its voice — or null when there is nothing to play (unknown name, zero volume).
 * `variant` picks the take of a sound that has several (see {@link sfxVariants}).
 * With a `group`, the voice is listed there until it ends (see killVoices).
 */
export function startSfx(
  ctx: BaseAudioContext,
  dest: AudioNode,
  name: SfxName,
  when: number,
  opts?: SfxOptions,
  group?: VoiceGroup,
  variant: number = 0,
): Voice | null {
  const def = defOf(name);
  if (!def) return null;
  const volume = sfxVolume(opts);
  if (volume <= 0) return null;
  let trim = 1;
  const steps = SFX_STEPS[name];
  const step = audibleStep(name, opts);
  if (def.trimDb && steps && step !== null) {
    const takes = Math.max(1, def.variants || 1);
    const take = (((variant | 0) % takes) + takes) % takes;
    const db = def.trimDb[(step - steps[0]) * takes + take];
    if (typeof db === 'number') trim = Math.pow(10, db / 20);
  }
  const v = new Voice(ctx, dest, when, def.gain * trim * volume, group);
  try {
    def.build(v, opts ? opts.step : undefined, variant | 0);
  } catch (e) {
    // A half-built voice must not be left connected.
    v.kill();
    throw e;
  }
  if (v.duration <= 0) {
    v.kill();
    return null;
  }
  return v;
}

/**
 * Like {@link startSfx}, returning the sound's duration in seconds (0 when nothing plays).
 * Works on live and offline contexts alike.
 */
export function renderSfx(
  ctx: BaseAudioContext,
  dest: AudioNode,
  name: SfxName,
  when: number,
  opts?: SfxOptions,
  group?: VoiceGroup,
  variant: number = 0,
): number {
  const v = startSfx(ctx, dest, name, when, opts, group, variant);
  return v ? v.duration : 0;
}
