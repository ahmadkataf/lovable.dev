/**
 * Sound effects. Each one is a small recipe of oscillators, FM pairs, filtered noise and
 * plucked strings, built on voices.ts so it renders into any BaseAudioContext.
 *
 * All pitched material uses notes of D Hijaz (scale.ts), so effects sit inside the music's
 * key. The designs are this game's own; nothing is sampled and nothing quotes an existing
 * sound or tune.
 */
import type { SfxName, SfxOptions } from './types.ts';
import { clamp } from './rng.ts';
import { PRAISE_MIDI, matchStepIndex, matchStepMidi, midiToFreq, praiseNoteCount, starStepMidi, stepInRange } from './scale.ts';
import { Voice, dum, filter, fm, ka, noise, pluck, tek, tone } from './voices.ts';

/**
 * Loudness class. 'ui' covers interface taps and the constant small sounds of handling gems
 * (select, swap, land): deliberately quiet. 'game' sounds share one loudness; jingles are
 * 'game' sounds that may run long.
 */
export type SfxClass = 'ui' | 'game' | 'jingle';

interface SfxDef {
  /** Output level, tuned by measurement (tools/audio-check.cjs) so effects are balanced. */
  gain: number;
  cls: SfxClass;
  /** Result jingles and warnings: never dropped just because many gem sounds are playing. */
  priority?: boolean;
  build(v: Voice, step: number | undefined): void;
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

const SFX: Record<SfxName, SfxDef> = {
  // ── interface ──────────────────────────────────────────────────────────
  button: {
    gain: 0.6,
    cls: 'ui',
    build(v) {
      tone(v, { f: 620, f2: 440, glide: 0.04, dur: 0.07, peak: 0.5, attack: 0.002 });
      noise(v, { type: 'bandpass', f: 2600, q: 1.2, dur: 0.02, peak: 0.25, attack: 0.001 });
    },
  },
  popupOpen: {
    gain: 0.77,
    cls: 'ui',
    build(v) {
      tone(v, { f: 330, f2: 660, glide: 0.09, dur: 0.14, peak: 0.45, attack: 0.012 });
      noise(v, { type: 'bandpass', f: 900, f2: 2600, q: 1.5, dur: 0.12, peak: 0.15, attack: 0.05 });
    },
  },
  popupClose: {
    gain: 0.6,
    cls: 'ui',
    build(v) {
      tone(v, { f: 620, f2: 310, glide: 0.08, dur: 0.12, peak: 0.45, attack: 0.008 });
      noise(v, { type: 'bandpass', f: 2400, f2: 900, q: 1.5, dur: 0.1, peak: 0.12, attack: 0.02 });
    },
  },

  // ── moving gems ────────────────────────────────────────────────────────
  select: {
    gain: 0.64,
    cls: 'ui',
    build(v) {
      tone(v, { type: 'triangle', f: hz(D5), f2: hz(A5), glide: 0.06, dur: 0.12, peak: 0.5, attack: 0.004 });
      tone(v, { f: hz(A6), at: 0.03, dur: 0.06, peak: 0.1, attack: 0.004 });
    },
  },
  swap: {
    gain: 0.83,
    cls: 'ui',
    build(v) {
      noise(v, { type: 'bandpass', f: 500, f2: 2400, q: 1.4, dur: 0.2, peak: 1.3, attack: 0.07 });
      tone(v, { f: 300, f2: 520, glide: 0.14, dur: 0.18, peak: 0.25, attack: 0.05 });
    },
  },
  invalid: {
    gain: 1.24,
    cls: 'game',
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
    gain: 0.8,
    cls: 'ui',
    build(v) {
      // A soft tap. The body sits high enough to be heard on a phone speaker.
      tone(v, { type: 'triangle', f: 330, f2: 190, glide: 0.05, dur: 0.08, peak: 0.5, attack: 0.002 });
      tone(v, { f: 760, f2: 480, glide: 0.03, dur: 0.04, peak: 0.25, attack: 0.001 });
      noise(v, { type: 'bandpass', f: 1500, q: 0.8, dur: 0.03, peak: 0.6, attack: 0.001 });
    },
  },

  // ── clears ─────────────────────────────────────────────────────────────
  match: {
    gain: 0.68,
    cls: 'game',
    build(v, step) {
      // A chime that climbs D F♯ G A C through two octaves with the cascade number.
      const midi = matchStepMidi(step);
      const rung = matchStepIndex(step);
      chime(v, midi, 0, 0.34, 0.6, 0.2 + rung * 0.012);
      // From the second octave on, a faint third harmonic adds sparkle.
      if (rung >= 5) tone(v, { f: hz(midi) * 3, at: 0.035, dur: 0.14, peak: 0.06, attack: 0.003 });
    },
  },
  sand: {
    gain: 0.57,
    cls: 'game',
    build(v) {
      // A short hiss of grains.
      noise(v, { type: 'bandpass', f: 4200, f2: 2600, q: 0.9, dur: 0.16, peak: 1.4, attack: 0.012 });
      noise(v, { type: 'highpass', f: 6000, q: 0.7, at: 0.05, dur: 0.12, peak: 0.7, attack: 0.02 });
      tone(v, { f: 520, f2: 380, dur: 0.07, peak: 0.12, attack: 0.004 });
    },
  },
  stone: {
    gain: 0.84,
    cls: 'game',
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
    gain: 0.92,
    cls: 'game',
    build(v) {
      // The block gives way: a crack, a thud, and pieces tumbling after it.
      tone(v, { f: 560, f2: 260, glide: 0.08, dur: 0.15, peak: 0.55, attack: 0.001 });
      tone(v, { f: 840, f2: 420, glide: 0.06, dur: 0.1, peak: 0.25, attack: 0.001 });
      tone(v, { type: 'triangle', f: 160, f2: 62, glide: 0.12, dur: 0.3, peak: 0.3, attack: 0.003 });
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
    gain: 1.24,
    cls: 'game',
    build(v) {
      // Two links knocking: clangorous FM pairs.
      fm(v, { f: 1720, ratio: 1.41, index: 1.7, indexEnd: 0.25, modDur: 0.08, dur: 0.14, peak: 0.35, attack: 0.001 });
      fm(v, { f: 2090, ratio: 1.41, index: 1.7, indexEnd: 0.25, modDur: 0.08, at: 0.075, dur: 0.17, peak: 0.35, attack: 0.001 });
      noise(v, { type: 'highpass', f: 5000, q: 0.7, dur: 0.03, peak: 0.2, attack: 0.001 });
    },
  },
  vine: {
    gain: 0.92,
    cls: 'game',
    build(v) {
      // A snip and a rustle of leaves.
      tone(v, { type: 'triangle', f: 740, f2: 260, glide: 0.09, dur: 0.13, peak: 0.5, attack: 0.003 });
      noise(v, { type: 'bandpass', f: 2400, f2: 1200, q: 1.2, dur: 0.12, peak: 1, attack: 0.004 });
      noise(v, { type: 'bandpass', f: 3600, q: 1.5, at: 0.06, dur: 0.07, peak: 0.6, attack: 0.004 });
    },
  },
  vineGrow: {
    gain: 1.01,
    cls: 'game',
    build(v) {
      // A creeping semitone rise, D → E♭, with a wobble.
      tone(v, { type: 'triangle', f: hz(D5), f2: hz(Eb5), glide: 0.25, dur: 0.36, peak: 0.4, attack: 0.06, vib: 9, vibDepth: 8 });
      tone(v, { type: 'triangle', f: hz(A4), f2: hz(Bb4), glide: 0.25, dur: 0.34, peak: 0.3, attack: 0.06 });
      tone(v, { f: hz(D4), f2: hz(Eb4), glide: 0.25, dur: 0.34, peak: 0.2, attack: 0.06 });
      noise(v, { type: 'bandpass', f: 1200, f2: 2600, q: 1.5, dur: 0.3, peak: 0.5, attack: 0.15 });
    },
  },
  lamp: {
    gain: 0.84,
    cls: 'game',
    build(v) {
      bell(v, A5, 0, 0.3, 0.4);
      bell(v, D6, 0.11, 0.48, 0.45);
      tone(v, { type: 'triangle', f: hz(D5), at: 0.11, dur: 0.4, peak: 0.2, attack: 0.01 });
      tone(v, { f: hz(Fs6), at: 0.16, dur: 0.3, peak: 0.08, attack: 0.004 });
    },
  },

  // ── specials ───────────────────────────────────────────────────────────
  createBeam: {
    gain: 1.72,
    cls: 'game',
    build(v) {
      // A quick upward zip ending in a glint.
      const lp = filter(v, 'lowpass', 1200, 2, { f2: 5200, dur: 0.2 });
      tone(v, { type: 'sawtooth', f: hz(D5), f2: hz(D6), glide: 0.18, dur: 0.26, peak: 0.3, attack: 0.01, to: lp });
      noise(v, { type: 'bandpass', f: 1500, f2: 6000, q: 2, dur: 0.2, peak: 0.12, attack: 0.1 });
      fm(v, { f: hz(A6), ratio: 2, index: 0.6, at: 0.17, dur: 0.22, peak: 0.25 });
    },
  },
  createNova: {
    gain: 1.11,
    cls: 'game',
    build(v) {
      // A swelling charge that settles on a bell.
      tone(v, { type: 'triangle', f: hz(A3), f2: hz(A4), glide: 0.22, dur: 0.3, peak: 0.45, attack: 0.16, vib: 14, vibDepth: 6 });
      tone(v, { f: hz(D4), f2: hz(D5), glide: 0.22, dur: 0.3, peak: 0.3, attack: 0.16 });
      noise(v, { type: 'bandpass', f: 400, f2: 1800, q: 1.2, dur: 0.26, peak: 0.15, attack: 0.18 });
      bell(v, Fs5, 0.22, 0.3, 0.4);
    },
  },
  createPrism: {
    gain: 1.15,
    cls: 'game',
    build(v) {
      // A run up the scale, each note a small bell; the last one rings.
      const run = [D5, Eb5, Fs5, G5, A5, D6];
      for (let k = 0; k < run.length; k++) {
        const lastNote = k === run.length - 1;
        fm(v, { f: hz(run[k]), ratio: 2, index: 0.7, indexEnd: 0.02, at: k * 0.04, dur: lastNote ? 0.42 : 0.16, peak: lastNote ? 0.42 : 0.3 });
      }
      tone(v, { f: hz(D7), at: 0.2, dur: 0.36, peak: 0.07, attack: 0.01 });
      noise(v, { type: 'highpass', f: 6000, q: 0.7, at: 0.05, dur: 0.3, peak: 0.07, attack: 0.15 });
    },
  },
  beam: {
    gain: 0.68,
    cls: 'game',
    build(v) {
      // Line blast: noise swept downwards over a falling tone.
      noise(v, { type: 'bandpass', f: 5200, f2: 420, q: 1.1, dur: 0.34, peak: 1.3, attack: 0.008 });
      const lp = filter(v, 'lowpass', 2600, 1, { f2: 500, dur: 0.3 });
      tone(v, { type: 'sawtooth', f: hz(D5), f2: hz(D3), glide: 0.26, dur: 0.32, peak: 0.3, attack: 0.005, to: lp });
      tone(v, { f: hz(D6), f2: hz(D4), glide: 0.2, dur: 0.24, peak: 0.2, attack: 0.004 });
    },
  },
  nova: {
    gain: 0.67,
    cls: 'game',
    build(v) {
      // Area blast: a soft boom under a burst of noise that closes down quickly.
      tone(v, { f: 170, f2: 46, glide: 0.3, dur: 0.48, peak: 0.2, attack: 0.004 });
      tone(v, { type: 'triangle', f: hz(A4), f2: hz(A3), glide: 0.3, dur: 0.4, peak: 0.5, attack: 0.004 });
      noise(v, { type: 'lowpass', f: 5000, f2: 400, q: 0.9, dur: 0.44, peak: 0.7, attack: 0.005 });
      fm(v, { f: hz(D5), f2: hz(D4), ratio: 1.41, index: 1.2, indexEnd: 0.05, dur: 0.36, peak: 0.4 });
    },
  },
  prism: {
    gain: 1.51,
    cls: 'game',
    build(v) {
      // Rays: a swirl of air with bright notes darting about above a rising tone.
      noise(v, { type: 'bandpass', f: 900, f2: 7000, q: 2.5, dur: 0.3, peak: 0.25, attack: 0.12 });
      noise(v, { type: 'bandpass', f: 7000, f2: 1500, q: 2.5, at: 0.25, dur: 0.36, peak: 0.2, attack: 0.02 });
      const rays = [D6, Fs6, A6, G6, C7, D7, A6];
      for (let k = 0; k < rays.length; k++) {
        fm(v, { f: hz(rays[k]), ratio: 2, index: 0.5, at: 0.03 + k * 0.055, dur: 0.2, peak: 0.26 });
      }
      tone(v, { type: 'triangle', f: hz(D4), f2: hz(D5), glide: 0.4, dur: 0.55, peak: 0.2, attack: 0.1 });
    },
  },
  bigCombo: {
    gain: 0.78,
    cls: 'game',
    build(v) {
      // Two specials at once: a bright impact that falls away under a chord that mellows.
      tone(v, { f: 150, f2: 42, glide: 0.4, dur: 0.7, peak: 0.22, attack: 0.004 });
      noise(v, { type: 'lowpass', f: 7000, f2: 320, q: 0.9, dur: 0.6, peak: 0.65, attack: 0.005 });
      noise(v, { type: 'bandpass', f: 4200, f2: 700, q: 1.2, at: 0.04, dur: 0.5, peak: 0.5, attack: 0.03 });
      const lp = filter(v, 'lowpass', 3600, 1.2, { f2: 480, at: 0.02, dur: 0.55 });
      const chord = [D4, A4, D5, Fs5];
      for (let k = 0; k < chord.length; k++) {
        tone(v, { type: 'sawtooth', f: hz(chord[k]), at: 0.02, dur: 0.66, peak: 0.2, attack: 0.012, to: lp });
      }
      bell(v, D5, 0.02, 0.5, 0.36);
    },
  },

  // ── tools ──────────────────────────────────────────────────────────────
  shuffle: {
    gain: 1.37,
    cls: 'game',
    build(v) {
      const seq = [D5, G5, Eb5, A5, Fs5, C6, A5, D6];
      for (let k = 0; k < seq.length; k++) {
        fm(v, { f: hz(seq[k]), ratio: 3, index: 0.6, indexEnd: 0.02, modDur: 0.04, at: k * 0.05, dur: 0.11, peak: 0.3 });
      }
      noise(v, { type: 'bandpass', f: 800, f2: 3200, q: 1.2, dur: 0.24, peak: 0.6, attack: 0.1 });
      noise(v, { type: 'bandpass', f: 3200, f2: 900, q: 1.2, at: 0.22, dur: 0.26, peak: 0.6, attack: 0.1 });
    },
  },
  booster: {
    gain: 1.06,
    cls: 'game',
    build(v) {
      tone(v, { type: 'triangle', f: hz(D4), f2: hz(D6), glide: 0.26, dur: 0.32, peak: 0.4, attack: 0.03 });
      noise(v, { type: 'bandpass', f: 700, f2: 5000, q: 2, dur: 0.3, peak: 0.2, attack: 0.2 });
      bell(v, D6, 0.26, 0.26, 0.4);
      bell(v, A6, 0.3, 0.22, 0.25);
    },
  },

  // ── feedback ───────────────────────────────────────────────────────────
  praise: {
    gain: 1.04,
    cls: 'game',
    build(v, step) {
      // Sparkle: three to six quick high notes; stronger praise adds notes, air and weight.
      const level = stepInRange(step, 1, 4, 1);
      const count = praiseNoteCount(step);
      for (let k = 0; k < count; k++) {
        const lastNote = k === count - 1;
        fm(v, { f: hz(PRAISE_MIDI[k]), ratio: 2, index: 0.5, at: k * 0.05, dur: lastNote ? 0.32 : 0.18, peak: 0.28 });
      }
      if (level >= 3) noise(v, { type: 'highpass', f: 7000, q: 0.7, dur: 0.3, peak: 0.05 * level, attack: 0.1 });
      if (level >= 4) tone(v, { type: 'triangle', f: hz(D5), dur: 0.4, peak: 0.16, attack: 0.02 });
    },
  },
  goalDone: {
    gain: 1.06,
    cls: 'game',
    priority: true,
    build(v) {
      const notes = [D5, A5, D6];
      for (let k = 0; k < notes.length; k++) {
        chime(v, notes[k], k * 0.09, k === 2 ? 0.36 : 0.18, 0.42, 0.18);
      }
      tone(v, { type: 'triangle', f: hz(D4), at: 0.18, dur: 0.3, peak: 0.2, attack: 0.01 });
    },
  },
  star: {
    gain: 0.81,
    cls: 'game',
    priority: true,
    build(v, step) {
      // One bright bell per star, each higher than the last, with more glitter.
      const s = stepInRange(step, 1, 3, 1);
      const midi = starStepMidi(step);
      bell(v, midi, 0, 0.45, 0.5);
      tone(v, { f: hz(midi + 12), at: 0.02, dur: 0.3, peak: 0.14, attack: 0.003 });
      tone(v, { type: 'triangle', f: hz(midi - 12), dur: 0.25, peak: 0.2, attack: 0.006 });
      noise(v, { type: 'highpass', f: 7000, q: 0.7, dur: 0.1 + 0.04 * s, peak: 0.1, attack: 0.004 });
      const glitter = [D7, D7 + 4, D7 + 7];
      for (let k = 0; k < s; k++) {
        tone(v, { f: hz(glitter[k]), at: 0.06 + k * 0.045, dur: 0.12, peak: 0.06, attack: 0.003 });
      }
    },
  },
  movesLow: {
    gain: 1.12,
    cls: 'game',
    priority: true,
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
    gain: 1.43,
    cls: 'game',
    priority: true,
    build(v) {
      // A falling sigh: A, then E♭ sinking onto D while the tone darkens.
      const lp = filter(v, 'lowpass', 2600, 0.7, { f2: 900, dur: 0.48 });
      tone(v, { type: 'triangle', f: hz(A4), dur: 0.17, peak: 0.36, attack: 0.005, to: lp });
      tone(v, { f: hz(A5), dur: 0.14, peak: 0.2, attack: 0.005 });
      tone(v, { type: 'triangle', f: hz(Eb4), f2: hz(D4), glide: 0.25, at: 0.15, dur: 0.36, peak: 0.36, attack: 0.005, to: lp });
      tone(v, { f: hz(Eb5), f2: hz(D5), glide: 0.25, at: 0.15, dur: 0.32, peak: 0.24, attack: 0.005 });
    },
  },
  levelStart: {
    gain: 0.87,
    cls: 'jingle',
    priority: true,
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

  // ── rewards ────────────────────────────────────────────────────────────
  coin: {
    gain: 0.77,
    cls: 'game',
    build(v) {
      // One struck metal ring with shimmering overtones.
      fm(v, { f: hz(Fs6), ratio: 2.76, index: 1, indexEnd: 0.1, modDur: 0.15, dur: 0.3, peak: 0.45, attack: 0.001 });
      tone(v, { f: hz(Fs6) * 2, dur: 0.18, peak: 0.12, attack: 0.002 });
      noise(v, { type: 'highpass', f: 6000, q: 0.7, dur: 0.025, peak: 0.2, attack: 0.001 });
    },
  },
  purchase: {
    gain: 1.2,
    cls: 'jingle',
    priority: true,
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
    gain: 0.87,
    cls: 'jingle',
    priority: true,
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
      noise(v, { type: 'highpass', f: 7000, q: 0.7, at: 0.36, dur: 0.5, peak: 0.06, attack: 0.1 });
    },
  },
  win: {
    gain: 0.97,
    cls: 'jingle',
    priority: true,
    build(v) {
      // A short original flourish: up the scale to the octave, a drum roll into a ringing chord.
      const line = [D5, Fs5, A5, G5, A5, C6];
      for (let k = 0; k < line.length; k++) {
        const at = k * 0.12;
        pluck(v, { midi: line[k] - 12, at, dur: 0.36, peak: 0.36 });
        chime(v, line[k], at, 0.22, 0.3, 0.15);
      }
      const land = 0.72;
      pluck(v, { midi: D5, at: land, dur: 0.95, peak: 0.3 });
      bell(v, D6, land, 0.95, 0.32);
      // The chord is strummed: each string a few milliseconds after the one below.
      const chord = [D4, A4, Fs5];
      for (let k = 0; k < chord.length; k++) pluck(v, { midi: chord[k], at: land + 0.018 * (k + 1), dur: 0.95, peak: 0.2 });
      tone(v, { type: 'triangle', f: hz(D4), at: land, dur: 0.9, peak: 0.12, attack: 0.03 });
      dum(v, 0, 0.45);
      tek(v, 0.36, 0.45);
      ka(v, 0.6, 0.4);
      ka(v, 0.66, 0.5);
      dum(v, land, 0.5);
      const glitter = [Fs6, A6, D7];
      for (let k = 0; k < glitter.length; k++) tone(v, { f: hz(glitter[k]), at: land + 0.2 + k * 0.1, dur: 0.3, peak: 0.07, attack: 0.004 });
    },
  },
  lose: {
    gain: 0.78,
    cls: 'jingle',
    priority: true,
    build(v) {
      // A slow walk down to the tonic through the scale's flat second.
      const lp = filter(v, 'lowpass', 1300, 0.7);
      const line = [A4, G4, Fs4, Eb4, D4];
      for (let k = 0; k < line.length; k++) {
        const at = k * 0.26;
        const lastNote = k === line.length - 1;
        const level = 0.5 - k * 0.04;
        pluck(v, { midi: line[k], at, dur: lastNote ? 0.7 : 0.4, peak: level });
        tone(v, { type: 'triangle', f: hz(line[k]), at, dur: lastNote ? 0.62 : 0.3, peak: level * 0.5, attack: 0.02, to: lp });
      }
      dum(v, 1.04, 0.6);
    },
  },
};

export const SFX_NAMES: readonly SfxName[] = Object.keys(SFX) as SfxName[];

/** Sounds whose character depends on `opts.step`, with the range of steps that make a difference. */
export const SFX_STEPS: { [K in SfxName]?: readonly number[] } = {
  match: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  star: [1, 2, 3],
  praise: [1, 2, 3, 4],
};

export function sfxClass(name: SfxName): SfxClass {
  return SFX[name].cls;
}

export function isPrioritySfx(name: SfxName): boolean {
  return SFX[name].priority === true;
}

/** Identity used by the rate limiter: the same name and step count as the same sound. */
export function sfxKey(name: SfxName, opts?: SfxOptions): string {
  const step = opts && typeof opts.step === 'number' && isFinite(opts.step) ? Math.round(opts.step) : 0;
  return name + '#' + step;
}

/**
 * Build one sound effect on `ctx`, feeding `dest`, starting at context time `when`.
 * Returns the sound's duration in seconds. Works on live and offline contexts alike.
 */
export function renderSfx(ctx: BaseAudioContext, dest: AudioNode, name: SfxName, when: number, opts?: SfxOptions): number {
  const def = SFX[name];
  if (!def) return 0;
  const volume = opts && typeof opts.volume === 'number' && isFinite(opts.volume) ? clamp(opts.volume, 0, 1) : 1;
  if (volume <= 0) return 0;
  const v = new Voice(ctx, dest, when, def.gain * volume);
  def.build(v, opts ? opts.step : undefined);
  return v.duration;
}
