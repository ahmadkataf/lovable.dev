import { describe, expect, it } from 'vitest';
import {
  HIJAZ,
  MATCH_DEGREES,
  MATCH_LADDER,
  MATCH_MAX_STEP,
  PRAISE_MOTIFS,
  STAR_MIDI,
  TONIC_MIDI,
  degreeToMidi,
  degreeToSemitones,
  isHijazPitch,
  isLadderPitch,
  matchStepFreq,
  matchStepIndex,
  matchStepMidi,
  matchStepSparkles,
  midiToFreq,
  praiseMotif,
  praiseNoteCount,
  starStepMidi,
} from '../../src/audio/scale.ts';

describe('audio scale: D Hijaz', () => {
  it('maps MIDI notes to equal-tempered frequencies', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(62)).toBeCloseTo(293.665, 2);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });

  it('spells D E♭ F♯ G A B♭ C', () => {
    // D4 = 62: D E♭ F♯ G A B♭ C D
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((d) => degreeToMidi(d))).toEqual([62, 63, 66, 67, 69, 70, 72, 74]);
    expect(HIJAZ).toEqual([0, 1, 4, 5, 7, 8, 10]);
  });

  it('wraps degrees through octaves in both directions', () => {
    expect(degreeToSemitones(7)).toBe(12);
    expect(degreeToSemitones(9)).toBe(16);
    expect(degreeToSemitones(-1)).toBe(-2); // C below D
    expect(degreeToSemitones(-7)).toBe(-12);
    expect(degreeToMidi(-7)).toBe(50); // D3, the open low string
    expect(degreeToMidi(-4)).toBe(55); // G3
  });

  it('recognises scale members in any octave', () => {
    for (let d = -14; d <= 14; d++) expect(isHijazPitch(degreeToMidi(d))).toBe(true);
    expect(isHijazPitch(64)).toBe(false); // E natural
    expect(isHijazPitch(65)).toBe(false); // F natural
    expect(isHijazPitch(71)).toBe(false); // B natural
  });
});

describe('audio scale: match ladder', () => {
  it('is the ladder of the strategy study: 0 4 5 7 10 12 16 17 19 22 24 28 semitones above D4', () => {
    expect(MATCH_LADDER).toEqual([0, 4, 5, 7, 10, 12, 16, 17, 19, 22, 24, 28]);
    expect(MATCH_MAX_STEP).toBe(12);
    expect(TONIC_MIDI).toBe(62); // D4
    const midis = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => matchStepMidi(s));
    // D4 F♯4 G4 A4 C5 D5 F♯5 G5 A5 C6 D6 F♯6
    expect(midis).toEqual([62, 66, 67, 69, 72, 74, 78, 79, 81, 84, 86, 90]);
    expect(matchStepFreq(1)).toBeCloseTo(293.66, 1);
    expect(matchStepFreq(6)).toBeCloseTo(2 * matchStepFreq(1), 6);
    expect(matchStepFreq(11)).toBeCloseTo(4 * matchStepFreq(1), 6);
    for (let s = 1; s <= 12; s++) {
      expect(12 * Math.log2(matchStepFreq(s) / matchStepFreq(1))).toBeCloseTo(MATCH_LADDER[s - 1], 9);
    }
  });

  it('rises strictly up to step 12 and holds the top note after it', () => {
    for (let s = 2; s <= MATCH_MAX_STEP; s++) expect(matchStepFreq(s)).toBeGreaterThan(matchStepFreq(s - 1));
    expect(matchStepMidi(13)).toBe(matchStepMidi(12));
    expect(matchStepMidi(500)).toBe(90);
    expect(matchStepFreq(500)).toBeLessThan(1500); // F♯6: bright but not piercing
    // … and beyond the ladder a sparkle layer is added instead of more pitch
    for (let s = 1; s <= 12; s++) expect(matchStepSparkles(s)).toBe(false);
    expect(matchStepSparkles(13)).toBe(true);
    expect(matchStepSparkles(99)).toBe(true);
    expect(matchStepSparkles()).toBe(false);
    expect(matchStepSparkles(NaN)).toBe(false);
  });

  it('uses degrees 1-3-4-5-7 of D Hijaz only: no flat second, no flat sixth', () => {
    expect(MATCH_DEGREES).toEqual([0, 2, 3, 4, 6]);
    const allowed = MATCH_DEGREES.map((d) => HIJAZ[d]);
    expect(allowed).toEqual([0, 4, 5, 7, 10]);
    for (let s = 1; s <= MATCH_MAX_STEP; s++) {
      const midi = matchStepMidi(s);
      expect(isHijazPitch(midi)).toBe(true);
      expect(isLadderPitch(midi)).toBe(true);
      expect(allowed).toContain((midi - TONIC_MIDI) % 12);
    }
    expect(isLadderPitch(63)).toBe(false); // E♭
    expect(isLadderPitch(70)).toBe(false); // B♭
    expect(isLadderPitch(50)).toBe(true); // D3
  });

  it('tolerates missing and junk steps', () => {
    expect(matchStepMidi()).toBe(62);
    expect(matchStepMidi(0)).toBe(62);
    expect(matchStepMidi(-3)).toBe(62);
    expect(matchStepMidi(NaN)).toBe(62);
    expect(matchStepMidi(Infinity)).toBe(62);
    expect(matchStepMidi(2.4)).toBe(66);
    expect(matchStepIndex(3)).toBe(2);
    expect(matchStepIndex(40)).toBe(11);
  });
});

describe('audio scale: stars and praise', () => {
  it('stars rise through a D major arpeggio', () => {
    expect([1, 2, 3].map((s) => starStepMidi(s))).toEqual([78, 81, 86]);
    expect(starStepMidi(0)).toBe(78);
    expect(starStepMidi(9)).toBe(86);
    expect(starStepMidi()).toBe(78);
    expect(STAR_MIDI.every((m) => isHijazPitch(m))).toBe(true);
  });

  it('praise tiers are rising motifs of 2, 3, 4 and 5 ladder notes', () => {
    expect(PRAISE_MOTIFS.length).toBe(4);
    expect([1, 2, 3, 4].map((s) => praiseNoteCount(s))).toEqual([2, 3, 4, 5]);
    for (let tier = 1; tier <= 4; tier++) {
      const motif = praiseMotif(tier);
      expect(motif.length).toBe(tier + 1);
      for (let i = 0; i < motif.length; i++) {
        expect(isLadderPitch(motif[i])).toBe(true);
        if (i > 0) expect(motif[i]).toBeGreaterThan(motif[i - 1]);
      }
    }
    // every motif of the first three tiers lands on the same note; the fourth goes one further
    expect(praiseMotif(1)[1]).toBe(86);
    expect(praiseMotif(2)[2]).toBe(86);
    expect(praiseMotif(3)[3]).toBe(86);
    expect(praiseMotif(4)[4]).toBe(90);
    // junk input gives the first tier
    expect(praiseMotif()).toBe(PRAISE_MOTIFS[0]);
    expect(praiseMotif(0)).toBe(PRAISE_MOTIFS[0]);
    expect(praiseMotif(99)).toBe(PRAISE_MOTIFS[3]);
    expect(praiseMotif(NaN)).toBe(PRAISE_MOTIFS[0]);
    expect(midiToFreq(praiseMotif(1)[0])).toBeCloseTo(880, 6);
  });
});
