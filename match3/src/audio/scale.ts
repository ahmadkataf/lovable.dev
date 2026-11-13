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
 * Scale degrees used by the gem-clear tone: D F♯ G A C. Leaving out E♭ and B♭ removes both
 * semitone steps, so consecutive cascade tones always sound consonant against each other.
 */
export const MATCH_DEGREES: readonly number[] = [0, 2, 3, 4, 6];

/** Step 1 sounds D5. */
export const MATCH_BASE_MIDI = 74;

/** Steps above this keep the top note (D7, two octaves above step 1). */
export const MATCH_MAX_STEP = 11;

/** 0-based rung of the ladder for a cascade step; tolerant of junk input. */
export function matchStepIndex(step?: number): number {
  const s = typeof step === 'number' && isFinite(step) ? Math.round(step) : 1;
  return Math.min(MATCH_MAX_STEP, Math.max(1, s)) - 1;
}

export function matchStepMidi(step?: number): number {
  const i = matchStepIndex(step);
  const octave = Math.floor(i / MATCH_DEGREES.length);
  return MATCH_BASE_MIDI + 12 * octave + HIJAZ[MATCH_DEGREES[i % MATCH_DEGREES.length]];
}

export function matchStepFreq(step?: number): number {
  return midiToFreq(matchStepMidi(step));
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

/** Sparkle notes for the praise sound, lowest first (D6 F♯6 G6 A6 C7 D7). */
export const PRAISE_MIDI: readonly number[] = [86, 90, 91, 93, 96, 98];

/** Number of sparkle notes for a praise intensity of 1..4. */
export function praiseNoteCount(step?: number): number {
  return 2 + stepInRange(step, 1, 4, 1);
}
