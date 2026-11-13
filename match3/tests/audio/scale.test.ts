import { describe, expect, it } from 'vitest';
import {
  HIJAZ,
  MATCH_MAX_STEP,
  PRAISE_MIDI,
  STAR_MIDI,
  degreeToMidi,
  degreeToSemitones,
  isHijazPitch,
  matchStepFreq,
  matchStepIndex,
  matchStepMidi,
  midiToFreq,
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
  it('starts on D5 and climbs D F♯ G A C, then wraps an octave up', () => {
    const names = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => matchStepMidi(s));
    expect(names).toEqual([74, 78, 79, 81, 84, 86, 90, 91, 93, 96, 98]);
    expect(matchStepFreq(1)).toBeCloseTo(587.33, 1);
    expect(matchStepFreq(6)).toBeCloseTo(2 * matchStepFreq(1), 6);
  });

  it('rises strictly up to the cap and stays there', () => {
    for (let s = 2; s <= MATCH_MAX_STEP; s++) expect(matchStepFreq(s)).toBeGreaterThan(matchStepFreq(s - 1));
    expect(matchStepMidi(MATCH_MAX_STEP + 1)).toBe(matchStepMidi(MATCH_MAX_STEP));
    expect(matchStepMidi(500)).toBe(98);
    expect(matchStepFreq(500)).toBeLessThan(2400); // D7: bright but not piercing
  });

  it('uses only scale tones and avoids both semitone steps', () => {
    for (let s = 1; s <= MATCH_MAX_STEP; s++) {
      const midi = matchStepMidi(s);
      expect(isHijazPitch(midi)).toBe(true);
      const pc = (midi - 62) % 12;
      expect([0, 4, 5, 7, 10]).toContain(pc);
    }
  });

  it('tolerates missing and junk steps', () => {
    expect(matchStepMidi()).toBe(74);
    expect(matchStepMidi(0)).toBe(74);
    expect(matchStepMidi(-3)).toBe(74);
    expect(matchStepMidi(NaN)).toBe(74);
    expect(matchStepMidi(Infinity)).toBe(74);
    expect(matchStepMidi(2.4)).toBe(78);
    expect(matchStepIndex(3)).toBe(2);
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

  it('praise adds a note per intensity level', () => {
    expect([1, 2, 3, 4].map((s) => praiseNoteCount(s))).toEqual([3, 4, 5, 6]);
    expect(praiseNoteCount(0)).toBe(3);
    expect(praiseNoteCount(99)).toBe(6);
    expect(praiseNoteCount()).toBe(3);
    expect(PRAISE_MIDI.length).toBeGreaterThanOrEqual(6);
    expect(PRAISE_MIDI.every((m) => isHijazPitch(m))).toBe(true);
    for (let i = 1; i < PRAISE_MIDI.length; i++) expect(PRAISE_MIDI[i]).toBeGreaterThan(PRAISE_MIDI[i - 1]);
  });
});
