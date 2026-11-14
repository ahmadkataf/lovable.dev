import { describe, expect, it } from 'vitest';
import {
  BARS_PER_PHRASE,
  BASS_DEGREE,
  LEAD_HIGH,
  LEAD_LOW,
  RHYTHM_CELLS,
  STEPS_PER_BAR,
  TRACK_STYLES,
  createComposer,
  leadSignature,
  rhythmSignature,
  type Bar,
} from '../../src/audio/phrase.ts';
import { mulberry32, pickWeighted } from '../../src/audio/rng.ts';
import { degreeToMidi, isHijazPitch } from '../../src/audio/scale.ts';
import type { MusicTrack } from '../../src/audio/types.ts';

const TRACKS: MusicTrack[] = ['menu', 'level'];

function take(track: MusicTrack, seed: number, count: number): Bar[] {
  const c = createComposer(track, seed);
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) bars.push(c.nextBar());
  return bars;
}

function mainNotes(bar: Bar): number {
  return bar.lead.filter((n) => n.kind === 'note').length;
}

describe('seeded random helpers', () => {
  it('mulberry32 is deterministic and uniform enough', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 2000).toBeGreaterThan(0.45);
    expect(sum / 2000).toBeLessThan(0.55);
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });

  it('pickWeighted follows the weights and never picks a zero weight', () => {
    const rng = mulberry32(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[pickWeighted(rng, [1, 0, 3, 0])]++;
    expect(counts[1]).toBe(0);
    expect(counts[3]).toBe(0);
    expect(counts[2] / counts[0]).toBeGreaterThan(2.4);
    expect(counts[2] / counts[0]).toBeLessThan(3.6);
    expect(pickWeighted(rng, [0, 0])).toBe(0);
  });
});

describe('composer: determinism', () => {
  it('the same seed writes the same music, bar for bar', () => {
    for (const track of TRACKS) {
      expect(take(track, 20240521, 96)).toEqual(take(track, 20240521, 96));
    }
  });

  it('different seeds and different tracks write different music', () => {
    const a = take('level', 1, 16).map(leadSignature).join('|');
    const b = take('level', 2, 16).map(leadSignature).join('|');
    const c = take('menu', 1, 16).map(leadSignature).join('|');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('is independent of how the bars are pulled', () => {
    const c1 = createComposer('menu', 5);
    const c2 = createComposer('menu', 5);
    const first = [c1.nextBar(), c1.nextBar(), c1.nextBar()];
    // another composer in between must not disturb the stream (no shared state)
    take('level', 99, 40);
    expect([c2.nextBar(), c2.nextBar(), c2.nextBar()]).toEqual(first);
  });
});

describe('composer: every bar is well formed', () => {
  /**
   * Everything that is wrong with a bar, as text. The bars are checked with plain
   * comparisons and the test asserts once on the list: 2000 bars hold about 40 000 notes, and
   * one expect() per property of each (as this test used to do) took several seconds — long
   * enough to hit the test time-out whenever the machine was busy.
   */
  function problemsOf(bar: Bar, i: number): string[] {
    const bad: string[] = [];
    const at = 'bar ' + i + ': ';
    if (bar.index !== i) bad.push(at + 'index ' + bar.index);
    if (bar.phrase !== Math.floor(i / BARS_PER_PHRASE)) bad.push(at + 'phrase ' + bar.phrase);
    if (bar.barInPhrase !== i % BARS_PER_PHRASE) bad.push(at + 'barInPhrase ' + bar.barInPhrase);
    let prevStep = -1;
    for (const n of bar.lead) {
      const note = at + n.kind + ' degree ' + n.degree + ' at step ' + n.step + ': ';
      if (!isHijazPitch(n.midi)) bad.push(note + 'not in the scale (midi ' + n.midi + ')');
      if (n.midi !== degreeToMidi(n.degree)) bad.push(note + 'midi ' + n.midi + ' does not match its degree');
      if (n.kind === 'bass') {
        if (n.degree !== BASS_DEGREE) bad.push(note + 'bass off the open string');
      } else if (n.degree < LEAD_LOW || n.degree > LEAD_HIGH + 2) {
        bad.push(note + 'out of range');
      }
      if (!(n.step >= 0 && n.step < STEPS_PER_BAR)) bad.push(note + 'off the grid');
      if (!(n.len > 0)) bad.push(note + 'length ' + n.len);
      if (!(n.step + n.len <= STEPS_PER_BAR + 1e-9)) bad.push(note + 'runs over the bar line');
      if (!(n.vel > 0 && n.vel <= 1)) bad.push(note + 'velocity ' + n.vel);
      if (n.step < prevStep) bad.push(note + 'out of order');
      prevStep = n.step;
    }
    const hits = ['dum', 'tek', 'ka', 'shake'];
    for (const h of bar.perc) {
      const hit = at + h.kind + ' at step ' + h.step + ': ';
      if (!Number.isInteger(h.step) || h.step < 0 || h.step >= STEPS_PER_BAR) bad.push(hit + 'off the grid');
      if (hits.indexOf(h.kind) < 0) bad.push(hit + 'unknown stroke');
      if (!(h.vel > 0 && h.vel <= 1.1)) bad.push(hit + 'velocity ' + h.vel);
    }
    if (bar.percMode === 'off') {
      if (bar.perc.length !== 0) bad.push(at + 'drum hits while the drum rests');
    } else if (!bar.perc.some((h) => h.kind === 'dum' && h.step === 0)) {
      bad.push(at + 'no dum on the downbeat');
    }
    // the drone: a new chord every two bars, always with D3 in the bass
    if (bar.barInPhrase % 2 === 0) {
      if (!bar.pad) bad.push(at + 'no drone chord');
      else {
        if (bar.pad.midis[0] !== 50) bad.push(at + 'drone bass is not D3');
        if (bar.pad.bars !== 2) bad.push(at + 'drone lasts ' + bar.pad.bars + ' bars');
        for (const m of bar.pad.midis) if (!isHijazPitch(m)) bad.push(at + 'drone tone ' + m + ' not in the scale');
      }
    } else if (bar.pad) {
      bad.push(at + 'drone chord on an odd bar');
    }
    return bad;
  }

  for (const track of TRACKS) {
    it(track + ': 2000 bars stay in key, in range and on the grid', () => {
      for (const seed of [1, 77, 20240521]) {
        const bars = take(track, seed, 2000);
        const bad: string[] = [];
        let emptyRun = 0;
        let notes = 0;
        for (let i = 0; i < bars.length; i++) {
          const found = problemsOf(bars[i], i);
          for (const f of found) if (bad.length < 20) bad.push(f);
          notes += bars[i].lead.length;
          emptyRun = bars[i].lead.length === 0 ? emptyRun + 1 : 0;
          if (emptyRun > 1 && bad.length < 20) bad.push('bar ' + i + ': second empty bar in a row');
        }
        expect(bad).toEqual([]);
        expect(bars.length).toBe(2000);
        expect(notes).toBeGreaterThan(4000); // the checks above did look at something
      }
    });
  }

  it('the bar check itself notices what is wrong', () => {
    const good = take('level', 1, 4)[0];
    expect(problemsOf(good, 0)).toEqual([]);
    const off = { ...good, lead: good.lead.map((n, k) => (k === 0 ? { ...n, midi: n.midi + 1 } : n)) };
    expect(problemsOf(off, 0).length).toBeGreaterThan(0);
    expect(problemsOf(good, 3).length).toBeGreaterThan(0); // wrong running number
    expect(problemsOf({ ...good, pad: null }, 0)).toContain('bar 0: no drone chord');
  });

  it('never plays the same main note three times running inside a bar', () => {
    for (const track of TRACKS) {
      for (const bar of take(track, 3, 800)) {
        const d = bar.lead.filter((n) => n.kind === 'note').map((n) => n.degree);
        for (let i = 2; i < d.length; i++) expect(d[i] === d[i - 1] && d[i] === d[i - 2]).toBe(false);
      }
    }
  });

  it('rhythm cells are valid half bars', () => {
    for (const cell of RHYTHM_CELLS) {
      for (let i = 0; i < cell.length; i++) {
        expect(cell[i]).toBeGreaterThanOrEqual(0);
        expect(cell[i]).toBeLessThan(8);
        if (i > 0) expect(cell[i]).toBeGreaterThan(cell[i - 1]);
      }
    }
    for (const track of TRACKS) expect(TRACK_STYLES[track].cellWeights.length).toBe(RHYTHM_CELLS.length);
  });
});

describe('composer: musical shape', () => {
  it('menu is 90 BPM and calmer; level is 108 BPM and busier', () => {
    expect(TRACK_STYLES.menu.bpm).toBe(90);
    expect(TRACK_STYLES.level.bpm).toBe(108);
    const density = (track: MusicTrack): number => {
      const bars = take(track, 11, 400);
      return bars.reduce((a, b) => a + mainNotes(b), 0) / bars.length;
    };
    const menu = density('menu');
    const level = density('level');
    expect(menu).toBeGreaterThan(2);
    expect(menu).toBeLessThan(6);
    expect(level).toBeGreaterThan(3.5);
    expect(level).toBeLessThan(9);
    expect(level).toBeGreaterThan(menu);
  });

  it('phrases come in pairs: the second one closes on the tonic', () => {
    for (const track of TRACKS) {
      const bars = take(track, 5, 400);
      for (let p = 0; p < 100; p++) {
        const last = bars[p * 4 + 3];
        const notes = last.lead.filter((n) => n.kind !== 'bass' && n.kind !== 'grace');
        expect(notes.length).toBeGreaterThan(0);
        const final = notes[notes.length - 1];
        const pc = ((final.degree % 7) + 7) % 7;
        if (p % 2 === 1) expect(pc).toBe(0); // D
        else expect([2, 3, 4]).toContain(pc); // F♯, G or A: an open ending
        // a cadence breathes: its last note is held
        expect(final.len).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('motifs return — stated, varied, recalled — while new ones keep arriving', () => {
    for (const track of TRACKS) {
      const bars = take(track, 20240521, 400);
      const phrases = 100;
      const ids = new Set<number>();
      let withMotif = 0;
      const phraseSigs = new Map<string, number>();
      const barSigs = new Map<string, number>();
      const rhythmSigs = new Map<string, number>();
      let identicalNeighbours = 0;
      let prevSig = '';
      for (let p = 0; p < phrases; p++) {
        const four = bars.slice(p * 4, p * 4 + 4);
        if (four[0].motifId >= 0) {
          ids.add(four[0].motifId);
          withMotif++;
        }
        const sig = four.map(leadSignature).join('|');
        phraseSigs.set(sig, (phraseSigs.get(sig) || 0) + 1);
        if (sig === prevSig) identicalNeighbours++;
        prevSig = sig;
        for (const b of four) {
          if (mainNotes(b) < 3) continue;
          const s = leadSignature(b);
          barSigs.set(s, (barSigs.get(s) || 0) + 1);
          const r = rhythmSignature(b);
          rhythmSigs.set(r, (rhythmSigs.get(r) || 0) + 1);
        }
      }
      // families are reused …
      expect(ids.size).toBeLessThan(withMotif * 0.75);
      // … but material keeps being invented
      expect(ids.size).toBeGreaterThanOrEqual(12);
      // literal repetition of a bar happens (that is what makes it sound composed) …
      const repeatedBars = [...barSigs.values()].filter((n) => n > 1).length;
      expect(repeatedBars).toBeGreaterThan(5);
      // … rhythms recur more than exact pitches do …
      expect(rhythmSigs.size).toBeLessThan(barSigs.size);
      // … yet no whole phrase is looped: 100 phrases are (almost) all different
      expect(Math.max(...phraseSigs.values())).toBeLessThanOrEqual(2);
      expect(phraseSigs.size).toBeGreaterThanOrEqual(97);
      expect(identicalNeighbours).toBe(0);
    }
  });

  it('uses all four phrase forms and never two free phrases in a row', () => {
    for (const track of TRACKS) {
      const bars = take(track, 9, 800);
      const forms = new Set(bars.map((b) => b.form));
      expect(forms.size).toBe(4);
      for (let p = 1; p < 200; p++) {
        expect(bars[p * 4].form === 'breath' && bars[(p - 1) * 4].form === 'breath').toBe(false);
      }
    }
  });

  it('percussion comes and goes in the menu, and never rests for long', () => {
    const bars = take('menu', 4, 800);
    const modes = new Set(bars.map((b) => b.percMode));
    expect(modes.has('off')).toBe(true);
    expect(modes.has('light')).toBe(true);
    expect(bars[0].percMode).toBe('off'); // the lead opens alone over the drone
    expect(bars[4].percMode).not.toBe('off'); // the drum joins for the second phrase
    let offRun = 0;
    for (let p = 0; p < 200; p++) {
      offRun = bars[p * 4].percMode === 'off' ? offRun + 1 : 0;
      expect(offRun).toBeLessThanOrEqual(2);
      // one mode per phrase
      for (let b = 1; b < 4; b++) expect(bars[p * 4 + b].percMode).toBe(bars[p * 4].percMode);
    }
    const level = take('level', 4, 800);
    expect(level.every((b) => b.percMode !== 'off')).toBe(true);
    expect(new Set(level.map((b) => b.percMode)).size).toBe(2);
  });

  it('ornaments are used, sparingly', () => {
    for (const track of TRACKS) {
      const bars = take(track, 21, 800);
      const all = bars.reduce((a, b) => a + b.lead.length, 0);
      const count = (kind: string): number => bars.reduce((a, b) => a + b.lead.filter((n) => n.kind === kind).length, 0);
      expect(count('grace')).toBeGreaterThan(10);
      expect(count('trem')).toBeGreaterThan(10);
      expect(count('bass')).toBeGreaterThan(50);
      expect(count('grace') / all).toBeLessThan(0.15);
      expect(count('note') / all).toBeGreaterThan(0.5);
    }
  });
});
