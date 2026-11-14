/**
 * Musical vocabulary shared by the sound effects and the music (pure, no audio objects).
 * Everything is tuned to D Hijaz — D E♭ F♯ G A B♭ C — so effects never clash with the music.
 */

/** D4. Scale degree 0 of the lead register. */
export const TONIC_MIDI = 62;

/** Semitone offsets of the seven Hijaz degrees above the tonic. */
export const HIJAZ: readonly number[] = [0, 1, 4, 5, 7, 8, 10];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Semitones above the tonic for a (possibly negative or > 6) scale degree. */
export function degreeToSemitones(degree: number): number {
  const d = Math.round(degree);
  const octave = Math.floor(d / 7);
  return HIJAZ[d - octave * 7] + 12 * octave;
}

export function degreeToMidi(degree: number, tonicMidi: number = TONIC_MIDI): number {
  return tonicMidi + degreeToSemitones(degree);
}

export function degreeToFreq(degree: number, tonicMidi: number = TONIC_MIDI): number {
  return midiToFreq(degreeToMidi(degree, tonicMidi));
}

/** True when the MIDI note belongs to D Hijaz in any octave. */
export function isHijazPitch(midi: number): boolean {
  const pc = (((Math.round(midi) - TONIC_MIDI) % 12) + 12) % 12;
  return HIJAZ.indexOf(pc) >= 0;
}

// ───────────────────────── 'match' ladder ─────────────────────────

/**
 * The cascade ladder (docs/STRATEGY.md, audio-01): semitones above D4 for cascade steps
 * 1…12 — D F♯ G A C through two octaves and on to the F♯ above. These are degrees 1, 3, 4, 5
 * and 7 of D Hijaz, so every step is in tune with the music, and leaving out E♭ and B♭ keeps
 * the flat second and flat sixth from grinding against the drone.
 */
export const MATCH_LADDER: readonly number[] = [0, 4, 5, 7, 10, 12, 16, 17, 19, 22, 24, 28];

/** Scale degrees the ladder is made of: D F♯ G A C. */
export const MATCH_DEGREES: readonly number[] = [0, 2, 3, 4, 6];

/** Step 1 sounds D4 (293.66 Hz). */
export const MATCH_BASE_MIDI = TONIC_MIDI;

/** Steps above this hold the top note (F♯6) and gain a sparkle layer instead. */
export const MATCH_MAX_STEP = MATCH_LADDER.length;

/** A cascade step as a whole number ≥ 1; tolerant of junk input. */
function wholeStep(step?: number): number {
  const s = typeof step === 'number' && isFinite(step) ? Math.round(step) : 1;
  return Math.max(1, s);
}

/** 0-based rung of the ladder for a cascade step; tolerant of junk input. */
export function matchStepIndex(step?: number): number {
  return Math.min(MATCH_MAX_STEP, wholeStep(step)) - 1;
}

export function matchStepMidi(step?: number): number {
  return MATCH_BASE_MIDI + MATCH_LADDER[matchStepIndex(step)];
}

export function matchStepFreq(step?: number): number {
  return midiToFreq(matchStepMidi(step));
}

/** Beyond the top of the ladder the note holds and a sparkle layer is added. */
export function matchStepSparkles(step?: number): boolean {
  return wholeStep(step) > MATCH_MAX_STEP;
}

// ───────────────────────── stars / praise ─────────────────────────

/** F♯5, A5, D6 — a rising D-major arpeggio for stars one to three. */
export const STAR_MIDI: readonly number[] = [78, 81, 86];

export function stepInRange(step: number | undefined, lo: number, hi: number, fallback: number): number {
  const s = typeof step === 'number' && isFinite(step) ? Math.round(step) : fallback;
  return Math.min(hi, Math.max(lo, s));
}

export function starStepMidi(step?: number): number {
  return STAR_MIDI[stepInRange(step, 1, 3, 1) - 1];
}

/**
 * Praise motifs for tiers 1…4: two, three, four and five notes of the cascade ladder, each
 * rising to its last note (A5 D6 · F♯5 A5 D6 · D5 F♯5 A5 D6 · D5 F♯5 A5 D6 F♯6).
 */
export const PRAISE_MOTIFS: readonly (readonly number[])[] = [
  [81, 86],
  [78, 81, 86],
  [74, 78, 81, 86],
  [74, 78, 81, 86, 90],
];

/** The motif of a praise tier (1..4; junk input gives tier 1). */
export function praiseMotif(step?: number): readonly number[] {
  return PRAISE_MOTIFS[stepInRange(step, 1, 4, 1) - 1];
}

/** Number of notes in the motif of a praise tier: 2, 3, 4, 5. */
export function praiseNoteCount(step?: number): number {
  return praiseMotif(step).length;
}

/** True when the MIDI note is a rung of the cascade ladder in some octave (D F♯ G A C). */
export function isLadderPitch(midi: number): boolean {
  const pc = (((Math.round(midi) - TONIC_MIDI) % 12) + 12) % 12;
  return pc === 0 || pc === 4 || pc === 5 || pc === 7 || pc === 10;
}
