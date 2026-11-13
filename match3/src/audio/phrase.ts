/**
 * Generative composer (pure — no audio objects, no timers, no Math.random).
 *
 * It writes an endless stream of bars for a track from a seed. To sound composed rather than
 * random, the music is organised the way a player would improvise a taqsim-like line over a
 * drone:
 *   - time is grouped in four-bar phrases; phrases come in pairs — the first rests on an
 *     open degree (F♯, G or A), the second closes on the tonic D;
 *   - a phrase is built from a one-bar motif (a rhythm made of two half-bar cells plus a
 *     melodic contour) that is stated, then answered, varied, or moved through the scale as
 *     a sequence, and finally led stepwise into a cadence;
 *   - a small memory of recent motifs is recalled — sometimes exactly, sometimes varied —
 *     so material returns across phrases while the stream keeps evolving;
 *   - an energy value drifts slowly and decides how busy the hand percussion is.
 * Everything is original material in D Hijaz (see scale.ts).
 */
import type { MusicTrack } from './types.ts';
import { clamp, mulberry32, pickWeighted } from './rng.ts';
import { degreeToMidi } from './scale.ts';

export const STEPS_PER_BAR = 16;
export const BARS_PER_PHRASE = 4;

/** Range of the lead in scale degrees above D4: G3 … F♯5 (grace notes may touch G5). */
export const LEAD_LOW = -4;
export const LEAD_HIGH = 9;
/** The open low string, D3. */
export const BASS_DEGREE = -7;

export type LeadKind = 'note' | 'grace' | 'trem' | 'bass';
export type PercKind = 'dum' | 'tek' | 'ka' | 'shake';
export type PhraseForm = 'statement' | 'callAnswer' | 'sequence' | 'breath';
export type PercMode = 'off' | 'light' | 'full';

export interface LeadNote {
  /** Position in the bar in sixteenth-note steps (0..16, halves allowed for ornaments). */
  step: number;
  /** Length in steps. */
  len: number;
  /** Scale degree relative to D4 (see scale.ts). */
  degree: number;
  midi: number;
  /** 0..1 */
  vel: number;
  kind: LeadKind;
}

export interface PercHit {
  step: number;
  kind: PercKind;
  vel: number;
}

export interface PadChord {
  midis: number[];
  /** Length in bars. */
  bars: number;
  vel: number;
}

export interface Bar {
  /** Running bar number, 0-based. */
  index: number;
  phrase: number;
  barInPhrase: number;
  form: PhraseForm;
  percMode: PercMode;
  /** Family id of the motif this phrase is built on, -1 for a free ("breath") phrase. */
  motifId: number;
  lead: LeadNote[];
  perc: PercHit[];
  pad: PadChord | null;
}

export interface TrackStyle {
  bpm: number;
  /** Weight of each entry of RHYTHM_CELLS when a motif is invented. */
  cellWeights: readonly number[];
  /** Weights for statement, callAnswer, sequence, breath. */
  formWeights: readonly number[];
  introForm: PhraseForm;
  introPerc: PercMode;
  energyStart: number;
  /** Energy below which the percussion rests / above which it plays the full pattern. */
  percOff: number;
  percFull: number;
  percModes: readonly PercMode[];
  /** Probability of recalling a remembered motif instead of inventing one. */
  recall: number;
  /** Per-note ornament probabilities. */
  grace: number;
  tremolo: number;
  /** Probability of a low open-string note under bars 1 and 3 of a phrase. */
  bass: number;
  /** Probability of a soft extra tap on an empty off-beat step. */
  ghost: number;
  /** Probability of a fill at the end of a phrase. */
  fill: number;
  /** Probability that a cadence is spread over quarter notes instead of eighths. */
  slowCadence: number;
  shaker: boolean;
  leadVel: number;
}

/**
 * Half-bar rhythm cells: onsets in sixteenth steps (0..7). A motif joins two of them.
 * 0 half · 1 two quarters · 2 quarter+2 eighths · 3 2 eighths+quarter · 4 four eighths ·
 * 5 3+3+2 · 6 dotted quarter+eighth · 7 rest+3 eighths · 8 with a sixteenth pair ·
 * 9 quarter rest+2 eighths · 10 syncopated · 11 rest
 */
export const RHYTHM_CELLS: readonly (readonly number[])[] = [
  [0],
  [0, 4],
  [0, 4, 6],
  [0, 2, 4],
  [0, 2, 4, 6],
  [0, 3, 6],
  [0, 6],
  [2, 4, 6],
  [0, 2, 3, 4, 6],
  [4, 6],
  [0, 3, 4, 6],
  [],
];

export const TRACK_STYLES: Record<MusicTrack, TrackStyle> = {
  menu: {
    bpm: 90,
    cellWeights: [3, 4, 2.5, 2.5, 1, 2.5, 3, 1.2, 0.3, 1.2, 0.6, 1],
    formWeights: [3, 3, 1.5, 2],
    introForm: 'breath',
    introPerc: 'off',
    energyStart: 0.35,
    percOff: 0.28,
    percFull: 0.8,
    percModes: ['off', 'light', 'full'],
    recall: 0.6,
    grace: 0.1,
    tremolo: 0.12,
    bass: 0.45,
    ghost: 0.05,
    fill: 0.3,
    slowCadence: 0.5,
    shaker: false,
    leadVel: 0.82,
  },
  level: {
    bpm: 104,
    cellWeights: [1, 2.5, 3, 3, 3, 3, 2, 2, 1.5, 1, 2, 0.4],
    formWeights: [3.5, 2.5, 3, 0.9],
    introForm: 'statement',
    introPerc: 'light',
    energyStart: 0.55,
    percOff: 0,
    percFull: 0.42,
    percModes: ['light', 'full'],
    recall: 0.55,
    grace: 0.14,
    tremolo: 0.16,
    bass: 0.5,
    ghost: 0.12,
    fill: 0.55,
    slowCadence: 0.2,
    shaker: true,
    leadVel: 0.9,
  },
};

/**
 * Hand-drum patterns on a sixteenth grid: D dum (low), T tek (rim), t soft tek, k ka (light
 * tap), . rest. Written for this game from the generic dum/tek vocabulary of frame and goblet
 * drums; the last four steps of a phrase may be replaced by a fill.
 */
const PERC_PATTERNS: Record<MusicTrack, { light: string[]; full: string[]; fills: string[] }> = {
  menu: {
    light: ['D.......t.....k.', 'D.....t...D...t.', 'D..k..t.D.....t.'],
    full: ['D.....T...D.T...', 'D..k..T.D...T.k.'],
    fills: ['T.kk', 'k.T.', '..kk'],
  },
  level: {
    light: ['D.....T...D.T...', 'D...T.....D.T.k.', 'D..T....D...T...'],
    full: ['D..T..T.D.D.T...', 'D.T...T.D.D.T.k.', 'D..T.kT.D..T..T.'],
    fills: ['T.kk', 'kTkk', 'D.TT', 'k.Tk'],
  },
};

const FORMS: readonly PhraseForm[] = ['statement', 'callAnswer', 'sequence', 'breath'];

interface Motif {
  id: number;
  cells: [number, number];
  /** Scale-degree offset from the phrase anchor for each onset. */
  contour: number[];
}

export interface Composer {
  readonly track: MusicTrack;
  readonly style: TrackStyle;
  /** The next bar of the endless stream. */
  nextBar(): Bar;
}

export function createComposer(track: MusicTrack, seed: number): Composer {
  const style = TRACK_STYLES[track];
  const rng = mulberry32(((seed >>> 0) ^ (track === 'menu' ? 0x01f3a5c7 : 0x07c5a3f1)) >>> 0);
  const memory: Motif[] = [];
  let motifSerial = 0;
  let phraseNo = 0;
  let barNo = 0;
  let energy = style.energyStart;
  let lastAnchor = -99;
  let lastForm: PhraseForm | null = null;
  let percMode: PercMode = 'off';
  let percRun = 0;
  let percPattern = 0;
  let queue: Bar[] = [];

  const chance = (p: number): boolean => rng() < p;
  const int = (n: number): number => Math.min(n - 1, Math.floor(rng() * n));

  function note(step: number, len: number, degree: number, vel: number, kind: LeadKind = 'note'): LeadNote {
    return { step, len, degree, midi: degreeToMidi(degree), vel: clamp(vel, 0.05, 1), kind };
  }

  function onsetsOf(m: Motif): number[] {
    const a = RHYTHM_CELLS[m.cells[0]];
    const b = RHYTHM_CELLS[m.cells[1]];
    const out: number[] = [];
    for (let i = 0; i < a.length; i++) out.push(a[i]);
    for (let i = 0; i < b.length; i++) out.push(b[i] + 8);
    return out;
  }

  /** A mostly stepwise line with momentum: it keeps its direction and turns now and then. */
  function walk(count: number, start: number): number[] {
    const out: number[] = [start];
    let cur = start;
    let dir = chance(0.5) ? 1 : -1;
    for (let i = 1; i < count; i++) {
      if (chance(0.3)) dir = -dir;
      const r = rng();
      const size = r < 0.07 ? 0 : r < 0.86 ? 1 : 2;
      cur += dir * size;
      if (cur > 5) {
        cur = 10 - cur;
        dir = -1;
      } else if (cur < -3) {
        cur = -6 - cur;
        dir = 1;
      }
      out.push(cur);
    }
    return out;
  }

  function newMotif(): Motif {
    let a = 2;
    let b = 1;
    for (let tries = 0; tries < 24; tries++) {
      const ca = pickWeighted(rng, style.cellWeights);
      const cb = pickWeighted(rng, style.cellWeights);
      if (RHYTHM_CELLS[ca].length + RHYTHM_CELLS[cb].length >= 3) {
        a = ca;
        b = cb;
        break;
      }
    }
    const count = RHYTHM_CELLS[a].length + RHYTHM_CELLS[b].length;
    const start = [0, 0, 0, 2, 4, -1][int(6)];
    const m: Motif = { id: motifSerial++, cells: [a, b], contour: walk(count, start) };
    memory.push(m);
    if (memory.length > 4) memory.shift();
    return m;
  }

  /** A recognisable relative of a motif: same family id, one aspect changed. */
  function vary(m: Motif): Motif {
    const cells: [number, number] = [m.cells[0], m.cells[1]];
    let contour = m.contour.slice();
    const kind = int(4);
    if (kind === 0) {
      // new ending
      const keep = Math.max(1, contour.length - Math.max(1, Math.ceil(contour.length / 3)));
      const tail = walk(contour.length - keep + 1, contour[keep - 1]);
      contour = contour.slice(0, keep).concat(tail.slice(1));
    } else if (kind === 1) {
      // the second half takes another rhythm
      for (let tries = 0; tries < 12; tries++) {
        const cb = pickWeighted(rng, style.cellWeights);
        if (cb !== cells[1] && RHYTHM_CELLS[cb].length > 0) {
          cells[1] = cb;
          break;
        }
      }
      const count = RHYTHM_CELLS[cells[0]].length + RHYTHM_CELLS[cells[1]].length;
      if (count <= contour.length) {
        contour = contour.slice(0, count);
      } else {
        const ext = walk(count - contour.length + 1, contour.length ? contour[contour.length - 1] : 0);
        contour = contour.concat(ext.slice(1));
      }
    } else if (kind === 2) {
      // mirrored around its first note
      const c0 = contour.length ? contour[0] : 0;
      contour = contour.map((d) => clamp(2 * c0 - d, -3, 5));
    } else {
      // inner notes nudged to a neighbour
      for (let i = 1; i < contour.length - 1; i++) {
        if (chance(0.5)) contour[i] = clamp(contour[i] + (chance(0.5) ? 1 : -1), -3, 5);
      }
    }
    return { id: m.id, cells, contour };
  }

  function recallOrInvent(): Motif {
    if (memory.length > 0 && chance(style.recall)) {
      const m = memory[int(memory.length)];
      return chance(0.4) ? m : vary(m);
    }
    return newMotif();
  }

  function accent(step: number): number {
    if (step % 16 === 0) return 1;
    if (step % 8 === 0) return 0.9;
    if (step % 4 === 0) return 0.82;
    if (step % 2 === 0) return 0.74;
    return 0.66;
  }

  /** Turn a motif into the notes of one bar, shifted by octaves so it fits the lead's range. */
  function realize(m: Motif, anchor: number, level: number): LeadNote[] {
    const onsets = onsetsOf(m);
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < onsets.length; i++) {
      const c = i < m.contour.length ? m.contour[i] : 0;
      if (i === 0 || c < lo) lo = c;
      if (i === 0 || c > hi) hi = c;
    }
    let a = anchor;
    while (a + hi > LEAD_HIGH) a -= 7;
    while (a + lo < LEAD_LOW) a += 7;
    const out: LeadNote[] = [];
    for (let i = 0; i < onsets.length; i++) {
      const step = onsets[i];
      const next = i + 1 < onsets.length ? onsets[i + 1] : STEPS_PER_BAR;
      const c = i < m.contour.length ? m.contour[i] : 0;
      out.push(note(step, Math.min(8, next - step), a + c, level * accent(step) * (0.94 + rng() * 0.12)));
    }
    return out;
  }

  /** Stepwise approach to a resting degree, landing on beat 3 (or 4 for the slow form). */
  function cadence(from: number, target: number, level: number): LeadNote[] {
    const slow = chance(style.slowCadence);
    const landing = slow ? 12 : 8;
    const spacing = slow ? 4 : 2;
    let count = Math.min(Math.floor(landing / spacing), 2 + int(3));
    const fromAbove = from >= target ? chance(0.85) : chance(0.35);
    if (fromAbove) count = Math.max(1, Math.min(count, LEAD_HIGH - target));
    else count = Math.max(1, Math.min(count, target - LEAD_LOW));
    const out: LeadNote[] = [];
    for (let k = count; k >= 1; k--) {
      const step = landing - spacing * k;
      out.push(note(step, spacing, target + (fromAbove ? k : -k), level * accent(step) * 0.95));
    }
    out.push(note(landing, Math.min(8, STEPS_PER_BAR - landing), target, level));
    return out;
  }

  /** A calm reply: one long note, sometimes with a short tail that turns around it. */
  function answer(anchor: number, level: number): LeadNote[] {
    const r = rng();
    if (r < 0.35) return [note(0, 8, anchor, level), note(8, 2, anchor + 1, level * 0.8), note(10, 6, anchor, level * 0.86)];
    if (r < 0.6) {
      return [
        note(0, 8, anchor, level),
        note(8, 2, anchor - 1, level * 0.78),
        note(10, 2, anchor + 1, level * 0.8),
        note(12, 4, anchor, level * 0.86),
      ];
    }
    if (r < 0.8) return [note(0, 6, anchor, level), note(6, 2, anchor + 2, level * 0.76), note(8, 8, anchor + 1, level * 0.86)];
    return [note(0, 8, anchor, level)];
  }

  function lastDegree(notes: LeadNote[], fallback: number): number {
    for (let i = notes.length - 1; i >= 0; i--) if (notes[i].kind === 'note') return notes[i].degree;
    return fallback;
  }

  /** Grace notes from the upper neighbour and tremolo on long notes, as a plectrum player would. */
  function ornament(notes: LeadNote[]): LeadNote[] {
    const out: LeadNote[] = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const prevStep = i > 0 ? notes[i - 1].step : -9;
      if (n.kind === 'note' && n.len >= 6 && chance(style.tremolo)) {
        const span = Math.min(4, n.len - 2);
        const hits = span * 2;
        for (let k = 0; k < hits; k++) {
          const swell = 0.55 + 0.3 * Math.sin((Math.PI * (k + 1)) / (hits + 1));
          out.push(note(n.step + k * 0.5, 0.5, n.degree, n.vel * (k === 0 ? 0.9 : swell), k === 0 ? 'note' : 'trem'));
        }
        out.push(note(n.step + span, n.len - span, n.degree, n.vel * 0.95, 'trem'));
        continue;
      }
      if (n.kind === 'note' && n.step >= 1 && n.step - prevStep >= 2 && chance(style.grace)) {
        out.push(note(n.step - 0.5, 0.5, n.degree + 1, n.vel * 0.6, 'grace'));
      }
      out.push(n);
    }
    return out;
  }

  function percBar(mode: 'light' | 'full', lastOfPhrase: boolean): PercHit[] {
    const set = PERC_PATTERNS[track];
    const list = mode === 'full' ? set.full : set.light;
    let pattern = list[percPattern % list.length];
    if (lastOfPhrase && chance(style.fill)) pattern = pattern.slice(0, 12) + set.fills[int(set.fills.length)];
    const hits: PercHit[] = [];
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const ch = pattern.charAt(s);
      const human = 0.92 + rng() * 0.16;
      if (ch === 'D') hits.push({ step: s, kind: 'dum', vel: (s === 0 ? 1 : 0.86) * human });
      else if (ch === 'T') hits.push({ step: s, kind: 'tek', vel: 0.85 * human });
      else if (ch === 't') hits.push({ step: s, kind: 'tek', vel: 0.5 * human });
      else if (ch === 'k') hits.push({ step: s, kind: 'ka', vel: 0.5 * human });
      else if ((s & 1) === 1 && chance(mode === 'full' ? style.ghost : style.ghost * 0.5)) {
        hits.push({ step: s, kind: 'ka', vel: 0.28 * human });
      }
      if (style.shaker && mode === 'full' && s % 4 === 2) hits.push({ step: s, kind: 'shake', vel: 0.5 * human });
    }
    return hits;
  }

  /** Drone voicing for two bars: always D in the bass, with a fifth, fourth or a colour tone above. */
  function padChord(barInPhrase: number, anchor: number, closing: boolean): PadChord {
    let midis: number[];
    if (barInPhrase === 0) {
      midis = anchor === 3 ? [50, 55, 62] : [50, 57, 62];
    } else {
      const r = rng();
      if (r < 0.14) midis = [50, 57, 60];
      else if (r < 0.22 && !closing) midis = [50, 57, 63];
      else if (anchor === 3 && r < 0.6) midis = [50, 55, 62];
      else midis = [50, 57, 62];
    }
    if (midis[2] === 62 && energy > 0.55 && chance(0.6)) midis = midis.concat(66);
    return { midis, bars: 2, vel: 0.9 + energy * 0.1 };
  }

  function makePhrase(): Bar[] {
    const first = phraseNo === 0;
    energy = clamp(energy + (rng() - 0.5) * 0.5, 0, 1);

    // Where the phrase sits, and where it comes to rest.
    const anchors = [0, 2, 3, 4, 7];
    const anchorWeights = [3, 1.5, 2, 2.5, 1.5];
    for (let i = 0; i < anchors.length; i++) if (anchors[i] === lastAnchor) anchorWeights[i] *= 0.25;
    const anchor = first ? 0 : anchors[pickWeighted(rng, anchorWeights)];
    lastAnchor = anchor;
    const closing = phraseNo % 2 === 1;
    const target = closing ? (anchor >= 4 && chance(0.3) ? 7 : 0) : [4, 3, 2, 4][int(4)];
    const level = style.leadVel * (0.85 + energy * 0.15);

    // Form.
    let form: PhraseForm;
    if (first) {
      form = style.introForm;
    } else {
      const weights = style.formWeights.slice();
      if (lastForm) weights[FORMS.indexOf(lastForm)] *= lastForm === 'breath' ? 0 : 0.35;
      form = FORMS[pickWeighted(rng, weights)];
    }

    const lead: LeadNote[][] = [[], [], [], []];
    let motifId = -1;
    if (form === 'breath') {
      lead[0] = chance(0.5)
        ? [note(0, 8, anchor, level)]
        : [note(0, 8, anchor, level), note(10, 2, anchor + 1, level * 0.78), note(12, 4, anchor, level * 0.84)];
      const pickup: Motif = { id: -1, cells: [11, [7, 9, 1][int(3)]], contour: [] };
      pickup.contour = walk(RHYTHM_CELLS[pickup.cells[1]].length, chance(0.5) ? 0 : 2);
      lead[2] = realize(pickup, anchor, level * 0.92);
      lead[3] = cadence(lastDegree(lead[2], anchor), target, level);
    } else {
      const m = recallOrInvent();
      motifId = m.id;
      if (form === 'statement') {
        lead[0] = realize(m, anchor, level);
        lead[1] = realize(chance(0.35) ? m : vary(m), anchor + [0, 0, 1, -1, 2][int(5)], level * 0.95);
        lead[2] = realize(chance(0.5) ? newMotif() : vary(m), anchor + 2 + int(3), level * 1.05);
      } else if (form === 'callAnswer') {
        lead[0] = realize(m, anchor, level);
        lead[1] = answer(clamp(anchor + [-1, 0, 2, 4][int(4)], LEAD_LOW + 1, LEAD_HIGH - 2), level * 0.9);
        lead[2] = realize(chance(0.5) ? m : vary(m), anchor, level);
      } else {
        const dir = chance(0.7) ? -1 : 1;
        const from = dir < 0 ? Math.max(anchor, 3) : Math.min(anchor, 3);
        lead[0] = realize(m, from, level);
        lead[1] = realize(m, from + dir, level * 0.97);
        lead[2] = realize(chance(0.5) ? m : vary(m), from + 2 * dir, level * 1.03);
      }
      lead[3] = cadence(lastDegree(lead[2], anchor), target, level);
    }

    for (let b = 0; b < BARS_PER_PHRASE; b++) lead[b] = ornament(lead[b]);

    // Low open string under the strong bars, and under a closing cadence.
    for (let b = 0; b < BARS_PER_PHRASE; b += 2) {
      let lowAlready = false;
      for (let i = 0; i < lead[b].length; i++) if (lead[b][i].step === 0 && lead[b][i].degree <= -2) lowAlready = true;
      if (!lowAlready && chance(style.bass)) lead[b].push(note(0, 8, BASS_DEGREE, level * 0.72, 'bass'));
    }
    if (form === 'breath' && chance(0.7)) lead[1].push(note(0, 8, BASS_DEGREE, level * 0.66, 'bass'));
    if (closing && lead[3].length > 0 && chance(0.6)) {
      const land = lead[3][lead[3].length - 1];
      lead[3].push(note(land.step, STEPS_PER_BAR - land.step, BASS_DEGREE, level * 0.74, 'bass'));
    }

    // Percussion follows the energy; it never stays in one mode for long.
    let mode: PercMode;
    if (first) {
      mode = style.introPerc;
    } else {
      mode = energy < style.percOff ? 'off' : energy < style.percFull ? 'light' : 'full';
      if (style.percModes.indexOf(mode) < 0) mode = style.percModes[0];
      if (mode === percMode && percRun >= 3) {
        const others: PercMode[] = [];
        for (let i = 0; i < style.percModes.length; i++) if (style.percModes[i] !== mode) others.push(style.percModes[i]);
        if (others.length > 0) {
          mode = others[int(others.length)];
          energy = mode === 'full' ? 0.85 : mode === 'off' ? 0.12 : (style.percOff + style.percFull) / 2;
        }
      }
    }
    if (form === 'breath' && mode === 'off' && !first) mode = 'light';
    percRun = mode === percMode ? percRun + 1 : 1;
    percMode = mode;
    if (first || chance(0.45)) percPattern = int(997);

    const bars: Bar[] = [];
    for (let b = 0; b < BARS_PER_PHRASE; b++) {
      const notes = lead[b].slice().sort((x, y) => x.step - y.step);
      bars.push({
        index: barNo++,
        phrase: phraseNo,
        barInPhrase: b,
        form,
        percMode: mode,
        motifId,
        lead: notes,
        perc: mode === 'off' ? [] : percBar(mode, b === BARS_PER_PHRASE - 1),
        pad: b % 2 === 0 ? padChord(b, anchor, closing) : null,
      });
    }
    phraseNo++;
    lastForm = form;
    return bars;
  }

  return {
    track,
    style,
    nextBar(): Bar {
      if (queue.length === 0) queue = makePhrase();
      return queue.shift() as Bar;
    },
  };
}

/** Compact, order-sensitive description of a bar's lead line (used to compare bars). */
export function leadSignature(bar: Bar): string {
  let s = '';
  for (let i = 0; i < bar.lead.length; i++) {
    const n = bar.lead[i];
    if (n.kind === 'note') s += n.step + ':' + n.degree + ' ';
  }
  return s;
}

/** Rhythm only (onset steps of the main notes). */
export function rhythmSignature(bar: Bar): string {
  let s = '';
  for (let i = 0; i < bar.lead.length; i++) if (bar.lead[i].kind === 'note') s += bar.lead[i].step + ' ';
  return s;
}
