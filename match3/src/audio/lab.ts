/**
 * Audio lab — DEV ONLY (loaded by /audio-lab.html, never by the game).
 *
 * A button for every sound effect and music track, the engine's controls, and an offline
 * renderer that measures any sound and draws its spectrogram. tools/audio-check.cjs drives
 * this page through `window.__audioLab` to verify the whole audio module without ears.
 */
import {
  GUARD_CEILING,
  LEVELS,
  LIMITER_ONSET,
  MATCH_VARIANTS,
  MUSIC_CEILING,
  MUSIC_KNEE,
  MUSIC_DUCK_DB,
  MUSIC_DUCK_HOLD,
  MUSIC_PEAK_DB,
  SFX_LAND_INTERVAL,
  SFX_MATCH_VOICES,
  SFX_MAX_VOICES,
  SFX_NAMES,
  SFX_STEPS,
  SFX_TIERS,
  SFX_TIER_PEAK_DB,
  SfxMixer,
  createAudio,
  createMusicPlayer,
  createOutputChain,
  lookaheadFor,
  matchStepFreq,
  midiToFreq,
  praiseMotif,
  renderSfx,
  sfxClass,
  sfxDucksMusic,
  sfxPeakDb,
  sfxTier,
  sfxVariants,
  starStepMidi,
  voiceCensus,
  type AudioEngine,
  type MusicEvent,
  type MusicTrack,
  type OutputChain,
  type OutputChainOptions,
  type SfxName,
} from './index.ts';
import {
  analyze,
  attackTime,
  crestDb,
  detectOnsets,
  encodeWav,
  hardCutLevel,
  longestSilence,
  loudness,
  loudnessStats,
  maxStep,
  pitchNear,
  rmsTrack,
  slicePeak,
  sliceRmsDb,
  spectrogram,
  strongestIn,
  toDb,
  type Loudness,
  type LoudnessStats,
  type Metrics,
} from './analysis.ts';
import { mulberry32 } from './rng.ts';

const SR = 44100;
/**
 * Effects are rendered starting here. Chrome's DynamicsCompressor holds its gain down for
 * the first ~150 ms of a context's life, which would shave the attack off anything rendered
 * at time zero; a live context is long past that, so the measurement must be too.
 */
const START = 0.6;
/** Silence kept in front of the sound in the analysed/saved audio. */
const LEAD_IN = 0.02;

export interface SfxVariant {
  id: string;
  name: SfxName;
  step?: number;
  cls: string;
  /** Loudness tier and the peak level (dBFS) it is tuned to. */
  tier: string;
  targetDb: number;
}

export interface SoundReport {
  id: string;
  kind: 'sfx' | 'music' | 'storm';
  cls: string;
  tier?: string;
  /** Peak level the sound is tuned to (dBFS). */
  targetDb?: number;
  /** Time from 10 % to 70 % of the peak (s). */
  attack?: number;
  /** Duration reported by the synthesis code (s). */
  nominal: number;
  /** Peak of whatever still sounds after the nominal end (should be ~0). */
  tailPeak: number;
  metrics: Metrics;
  /** WAV file, base64. */
  wav: string;
  /** Spectrogram PNG as a data URL. */
  png: string;
}

export interface MusicReport extends SoundReport {
  bpm: number;
  barDuration: number;
  bars: number;
  /** Scheduled events per full bar. */
  leadPerBar: number[];
  percPerBar: number[];
  /** Onsets found in the rendered audio, per full bar. */
  heardPerBar: number[];
  scheduled: number;
  heard: number;
  firstHalfDb: number;
  secondHalfDb: number;
  longestSilence: number;
  /** RMS (dBFS) of each layer rendered on its own. */
  layerDb: { lead: number; pad: number; perc: number };
  /** A-weighted short-term level: loudest frame, 95th percentile, median (dB). */
  loudness: LoudnessStats;
  /** Peak above RMS (dB), after the fade-in. */
  crest: number;
  /** Gain reduction of the music's compressor (dB, ≤ 0): strongest and mean. */
  glueMax: number;
  glueMean: number;
}

// ───────────────────────────── offline rendering ─────────────────────────────

function offlineContext(seconds: number): OfflineAudioContext {
  const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
  const Ctor = w.OfflineAudioContext || w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext is not available');
  return new Ctor(1, Math.ceil(seconds * SR), SR);
}

async function renderOffline(seconds: number, build: (ctx: OfflineAudioContext, chain: OutputChain) => void): Promise<Float32Array> {
  const ctx = offlineContext(seconds);
  const chain = createOutputChain(ctx);
  build(ctx, chain);
  const buffer = await ctx.startRendering();
  return buffer.getChannelData(0).slice();
}

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes.subarray(i, i + 0x8000)) as number[]);
  }
  return btoa(s);
}

function variants(): SfxVariant[] {
  const out: SfxVariant[] = [];
  for (let i = 0; i < SFX_NAMES.length; i++) {
    const name = SFX_NAMES[i];
    const steps = SFX_STEPS[name];
    const tier = sfxTier(name);
    const targetDb = sfxPeakDb(name);
    if (steps) {
      for (let k = 0; k < steps.length; k++) out.push({ id: name + '-' + steps[k], name, step: steps[k], cls: sfxClass(name), tier, targetDb });
    } else {
      out.push({ id: name, name, cls: sfxClass(name), tier, targetDb });
    }
  }
  return out;
}

/**
 * One effect rendered alone and measured. `volume` (default 1) plays it quieter — the
 * calibration measures that way, so that even a sound whose gain is still far too high stays
 * clear of the limiter and its true peak is seen.
 */
async function sfxReport(name: SfxName, step?: number, variant: number = 0, volume: number = 1): Promise<SoundReport> {
  let nominal = 0;
  const full = await renderOffline(START + 3, (ctx, chain) => {
    nominal = renderSfx(ctx, chain.sfxBus, name, START, { step, volume }, undefined, variant);
  });
  const data = full.subarray(Math.floor((START - LEAD_IN) * SR));
  // The limiter delays its input by a few milliseconds; allow for that when cutting the tail.
  const cut = Math.min(data.length, Math.ceil((LEAD_IN + nominal + 0.03) * SR));
  let tailPeak = 0;
  for (let i = cut; i < data.length; i++) if (Math.abs(data[i]) > tailPeak) tailPeak = Math.abs(data[i]);
  const shown = data.subarray(0, Math.min(data.length, cut + Math.ceil(0.1 * SR)));
  const id = (step === undefined ? name : name + '-' + step) + (variant ? '-take' + (variant + 1) : '');
  const canvas = drawSpectrogram(shown, id + '  (' + nominal.toFixed(3) + ' s, ' + sfxTier(name) + ' tier, tuned to ' + sfxPeakDb(name) + ' dBFS)', false);
  return {
    id,
    kind: 'sfx',
    cls: sfxClass(name),
    tier: sfxTier(name),
    targetDb: sfxPeakDb(name),
    attack: attackTime(shown, SR),
    nominal,
    tailPeak,
    metrics: analyze(shown, SR),
    wav: base64(encodeWav(shown, SR)),
    png: canvas.toDataURL('image/png'),
  };
}

/** What a stepped offline render of a music track gives back. */
interface SteppedMusic {
  /** The first `seconds` of audio (the render itself runs a little longer, see `tail`). */
  data: Float32Array;
  events: MusicEvent[];
  barDuration: number;
  stats: { bars: number; events: number; dropped: number; resyncs: number };
  /** Live voices / nodes, sampled at every scheduler tick. */
  maxVoices: number;
  maxNodes: number;
  firstMinuteNodes: number;
  lastMinuteNodes: number;
  /** Still alive after the tail, when every scheduled note has ended. */
  endVoices: number;
  endNodes: number;
  /** Gain reduction of the music's compressor, sampled at every tick (dB, ≤ 0): strongest and mean. */
  glueMax: number;
  glueMean: number;
}

/** A sound event of a scripted piece of gameplay. */
export interface ScriptEvent {
  t: number;
  name: SfxName;
  step?: number;
  volume?: number;
}

/** Start of the first bar in the offline music renders (s). */
const MUSIC_START = 0.05;
/** Extra time rendered after the music stops being scheduled, so every voice can end (s). */
const MUSIC_TAIL = 10;

/**
 * Music rendered offline, scheduled the way the live engine does it: the render is paused at
 * every scheduler tick, the player is asked for the next lookahead window, and the render
 * continues. That exercises the transport, the voices' clean-up and the output chain exactly
 * as in play — and it is far quicker than scheduling minutes of notes up front, which makes
 * the browser carry every future note through every render quantum.
 */
async function steppedMusic(
  track: MusicTrack | null,
  seconds: number,
  seed: number,
  tick: number,
  layers?: { lead: boolean; pad: boolean; perc: boolean },
  options?: {
    chain?: OutputChainOptions;
    script?: ScriptEvent[];
    onMixer?: (mixer: SfxMixer, now: number) => void;
    tail?: number;
    /** A steady test tone fed into the music path alongside the music (frequency in Hz, amplitude). */
    probe?: { hz: number; level: number };
  },
): Promise<SteppedMusic & { mixer: SfxMixer }> {
  const total = seconds + (options && options.tail !== undefined ? options.tail : MUSIC_TAIL);
  const ctx = offlineContext(total);
  const chain = createOutputChain(ctx, undefined, options && options.chain);
  if (options && options.probe) {
    const osc = ctx.createOscillator();
    osc.frequency.value = options.probe.hz;
    const g = ctx.createGain();
    g.gain.value = options.probe.level;
    osc.connect(g);
    g.connect(chain.musicIn);
    osc.start(0);
  }
  const mixer = new SfxMixer(ctx, chain);
  const script = options && options.script ? options.script.slice().sort((a, b) => a.t - b.t) : [];
  let scriptAt = 0;
  // Effects of the script that fall into the next tick, started the way the engine starts
  // them: admitted on the clock of the call, sounding a device buffer later.
  const playScript = (until: number): void => {
    while (scriptAt < script.length && script[scriptAt].t < until) {
      const e = script[scriptAt++];
      const opts = e.step === undefined && e.volume === undefined ? undefined : { step: e.step, volume: e.volume };
      mixer.play(e.name, opts, e.t, e.t + 0.013);
    }
  };
  const events: MusicEvent[] = [];
  const player = track ? createMusicPlayer(ctx, chain.musicIn, track, { seed, startAt: MUSIC_START, layers, onEvent: (e) => events.push(e) }) : null;
  const lookahead = lookaheadFor(tick);
  if (player) player.schedule(Math.min(seconds, MUSIC_START + lookahead));
  playScript(tick);
  let maxVoices = 0;
  let maxNodes = 0;
  let firstMinuteNodes = 0;
  let lastMinuteNodes = 0;
  let glueMax = 0;
  let glueSum = 0;
  let glueCount = 0;
  let failure: unknown = null;
  const yieldTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  for (let t = tick; t < total - 0.01; t += tick) {
    ctx.suspend(t).then(async () => {
      try {
        // Let the "ended" events of finished notes arrive, as they would between live ticks.
        await yieldTask();
        const now = ctx.currentTime;
        const c = voiceCensus(ctx);
        if (c.voices > maxVoices) maxVoices = c.voices;
        if (c.nodes > maxNodes) maxNodes = c.nodes;
        if (now <= 60 && c.nodes > firstMinuteNodes) firstMinuteNodes = c.nodes;
        if (now >= seconds - 60 && now <= seconds && c.nodes > lastMinuteNodes) lastMinuteNodes = c.nodes;
        if (chain.musicGlue && now > 1 && now < seconds) {
          const r = chain.musicGlue.reduction;
          if (r < glueMax) glueMax = r;
          glueSum += r;
          glueCount++;
        }
        if (player && now < seconds) player.schedule(Math.min(seconds, now + lookahead));
        if (now < seconds) playScript(now + tick);
        if (options && options.onMixer) options.onMixer(mixer, now);
      } catch (e) {
        failure = e;
      }
      ctx.resume();
    });
  }
  const buffer = await ctx.startRendering();
  if (failure) throw failure;
  await new Promise((resolve) => setTimeout(resolve, 30));
  const left = voiceCensus(ctx);
  const st = player ? player.stats() : { bars: 0, events: 0, dropped: 0, resyncs: 0 };
  return {
    data: buffer.getChannelData(0).slice(0, Math.floor(seconds * SR)),
    events,
    barDuration: player ? player.barDuration : 0,
    mixer,
    glueMax,
    glueMean: glueCount ? glueSum / glueCount : 0,
    stats: { bars: st.bars, events: st.events, dropped: st.dropped, resyncs: st.resyncs },
    maxVoices,
    maxNodes,
    firstMinuteNodes,
    lastMinuteNodes,
    endVoices: left.voices,
    endNodes: left.nodes,
  };
}

async function layerLevels(track: MusicTrack, seconds: number, seed: number, tick: number): Promise<{ lead: number; pad: number; perc: number }> {
  const solo = async (layers: { lead: boolean; pad: boolean; perc: boolean }): Promise<number> => {
    const r = await steppedMusic(track, seconds, seed, tick, layers);
    return sliceRmsDb(r.data, SR, 1, seconds);
  };
  return {
    lead: await solo({ lead: true, pad: false, perc: false }),
    pad: await solo({ lead: false, pad: true, perc: false }),
    perc: await solo({ lead: false, pad: false, perc: true }),
  };
}

async function musicReport(track: MusicTrack, seconds: number, seed: number): Promise<MusicReport> {
  const start = MUSIC_START;
  const render = await steppedMusic(track, seconds, seed, 0.1);
  const data = render.data;
  const events = render.events;
  const barDuration = render.barDuration;
  const layerDb = await layerLevels(track, seconds, seed, 0.1);

  const bars = Math.max(1, Math.floor((seconds - start) / barDuration));
  const leadPerBar: number[] = [];
  const percPerBar: number[] = [];
  const heardPerBar: number[] = [];
  for (let b = 0; b < bars; b++) {
    leadPerBar.push(0);
    percPerBar.push(0);
    heardPerBar.push(0);
  }
  let scheduled = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.layer === 'pad') continue;
    const b = Math.floor((e.time - start + 0.02) / barDuration);
    if (b < 0 || b >= bars) continue;
    scheduled++;
    if (e.layer === 'lead') leadPerBar[b]++;
    else percPerBar[b]++;
  }
  const onsets = detectOnsets(data, SR);
  let heard = 0;
  for (let i = 0; i < onsets.length; i++) {
    const b = Math.floor((onsets[i] - start + 0.02) / barDuration);
    if (b < 0 || b >= bars) continue;
    heard++;
    heardPerBar[b]++;
  }
  const afterFade = data.subarray(Math.floor(0.8 * SR));
  const id = 'music-' + track;
  const canvas = drawSpectrogram(data, id + '  (' + seconds + ' s, seed ' + seed + ')', true);
  return {
    id,
    kind: 'music',
    cls: 'music',
    nominal: seconds,
    tailPeak: 0,
    metrics: analyze(data, SR),
    wav: base64(encodeWav(data, SR)),
    png: canvas.toDataURL('image/png'),
    bpm: Math.round(60 / (barDuration / 4)),
    barDuration,
    bars,
    leadPerBar,
    percPerBar,
    heardPerBar,
    scheduled,
    heard,
    firstHalfDb: sliceRmsDb(data, SR, 1, seconds / 2),
    secondHalfDb: sliceRmsDb(data, SR, seconds / 2, seconds),
    longestSilence: longestSilence(afterFade, SR, 0.002),
    layerDb,
    loudness: loudnessStats(data.subarray(SR), SR),
    crest: crestDb(data.subarray(SR)),
    glueMax: render.glueMax,
    glueMean: render.glueMean,
  };
}

/**
 * Worst case for the output stage: music playing, then every effect at once, then a second
 * and third wall of the loudest ones. The result must stay below full scale.
 */
async function stormReport(): Promise<SoundReport> {
  const seconds = 4;
  let count = 0;
  const data = await renderOffline(seconds, (ctx, chain) => {
    createMusicPlayer(ctx, chain.musicIn, 'level', { seed: 7, startAt: 0.05 }).schedule(seconds);
    const all = variants();
    for (let i = 0; i < all.length; i++) {
      renderSfx(ctx, chain.sfxBus, all[i].name, 1, all[i].step === undefined ? undefined : { step: all[i].step });
      count++;
    }
    const heavy: SfxName[] = ['bigCombo', 'nova', 'beam', 'prism', 'stoneBreak', 'win', 'chest', 'finale'];
    for (let r = 0; r < 4; r++) {
      for (let i = 0; i < heavy.length; i++) {
        renderSfx(ctx, chain.sfxBus, heavy[i], 2, undefined);
        renderSfx(ctx, chain.sfxBus, heavy[i], 2.6 + r * 0.004, undefined);
        count += 2;
      }
    }
  });
  const canvas = drawSpectrogram(data, 'storm  (' + count + ' effects over music)', true);
  return {
    id: 'storm',
    kind: 'storm',
    cls: 'storm',
    nominal: seconds,
    tailPeak: 0,
    metrics: analyze(data, SR),
    wav: base64(encodeWav(data, SR)),
    png: canvas.toDataURL('image/png'),
  };
}

/** Steady-state response of the output chain to a 1 kHz sine fed into the effects bus. */
async function chainTransfer(): Promise<{ inDb: number; outPeakDb: number; outRmsDb: number }[]> {
  const out: { inDb: number; outPeakDb: number; outRmsDb: number }[] = [];
  const levels = [-30, -20, -12, -6, 0, 6, 12, 20];
  for (let i = 0; i < levels.length; i++) {
    const amp = Math.pow(10, levels[i] / 20);
    const data = await renderOffline(1, (ctx, chain) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = 1000;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g);
      g.connect(chain.sfxBus);
      osc.start(0);
    });
    let peak = 0;
    for (let k = 0; k < data.length; k++) if (Math.abs(data[k]) > peak) peak = Math.abs(data[k]);
    out.push({ inDb: levels[i], outPeakDb: toDb(peak), outRmsDb: sliceRmsDb(data, SR, 0.5, 1) });
  }
  return out;
}

// ───────────────────────────── long-form music ─────────────────────────────

export interface LongMusicReport {
  track: MusicTrack;
  seconds: number;
  seed: number;
  tick: number;
  peak: number;
  clips: boolean;
  rmsDb: number;
  /** A-weighted short-term level: loudest frame, 95th percentile, median (dB). */
  loudness: LoudnessStats;
  /** RMS (dBFS) of each layer on its own over the whole render. */
  layerDb: { lead: number; pad: number; perc: number };
  /** Longest stretch below −54 dBFS (50 ms windows) after the fade-in (s). */
  longestSilence: number;
  /** RMS (dBFS) of each whole minute. */
  minuteDb: number[];
  /** RMS (dBFS) of every 10 s. */
  tenSecondDb: number[];
  /**
   * How different the first and the last minute are as waveforms: Σ(a−b)² / Σ(a²+b²).
   * 0 = the same samples (a loop); about 1 = unrelated audio.
   */
  firstLastDifference: number;
  /** Bars of the last minute whose lead line is note-for-note the bar at the same place in the first minute. */
  repeatedBars: number;
  barsPerMinute: number;
  /** Distinct lead lines among all bars / bars with a lead line. */
  distinctBars: number;
  leadBars: number;
  events: number;
  bars: number;
  dropped: number;
  resyncs: number;
  /** Live voices / nodes, sampled at every scheduler tick. */
  maxVoices: number;
  maxNodes: number;
  /** The same maxima within the first and within the last minute (a leak would make the last one larger). */
  firstMinuteNodes: number;
  lastMinuteNodes: number;
  /** Still alive when the render had finished and every note had ended. */
  endVoices: number;
  endNodes: number;
  /** Peak above RMS (dB), and the same without the music's compressor and clipper. */
  crest: number;
  rawCrest: number;
  /** What the compressor and the clipper change: RMS and peak (dB) with them minus without. */
  densityGainDb: number;
  /** Gain reduction of the music's compressor (dB, ≤ 0): strongest and mean. */
  glueMax: number;
  glueMean: number;
  /** Share of the samples (0..1) on which the clipper is bending the waveform at all. */
  clipShare: number;
  wav: string;
  png: string;
}

/**
 * Minutes of music, rendered with the stepped scheduler (see steppedMusic): shows what a 20 s
 * clip cannot — drift, repetition, silence gaps and whether finished notes are cleaned up.
 */
async function longMusicReport(track: MusicTrack, seconds: number, seed: number, tick: number = 0.1): Promise<LongMusicReport> {
  const render = await steppedMusic(track, seconds, seed, tick);
  const data = render.data;
  const events = render.events;
  const start = MUSIC_START;

  let peak = 0;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
  const minutes = Math.floor(seconds / 60);
  const minuteDb: number[] = [];
  for (let m = 0; m < minutes; m++) minuteDb.push(sliceRmsDb(data, SR, m * 60 + (m === 0 ? 1 : 0), (m + 1) * 60));
  const tenSecondDb: number[] = [];
  for (let t = 0; t + 10 <= seconds; t += 10) tenSecondDb.push(sliceRmsDb(data, SR, t === 0 ? 1 : t, t + 10));

  // First against last minute, sample for sample.
  const n = Math.min(60 * SR, data.length);
  const lastStart = data.length - n;
  let diff = 0;
  let energy = 0;
  for (let i = SR; i < n; i++) {
    const a = data[i];
    const b = data[lastStart + i];
    diff += (a - b) * (a - b);
    energy += a * a + b * b;
  }

  // … and note for note.
  const barDur = render.barDuration;
  const barsPerMinute = Math.floor(60 / barDur);
  const lines: { [bar: number]: string } = {};
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.layer !== 'lead' || e.kind === 'bass') continue;
    const pos = Math.round(((e.time - start) / barDur - e.bar) * 32);
    lines[e.bar] = (lines[e.bar] || '') + pos + ':' + e.midi + ' ';
  }
  const lastBar0 = Math.ceil((seconds - 60 - start) / barDur);
  let repeatedBars = 0;
  for (let b = 0; b < barsPerMinute; b++) {
    if (lines[b] !== undefined && lines[b] === lines[lastBar0 + b]) repeatedBars++;
  }
  const seen: { [line: string]: boolean } = {};
  let distinctBars = 0;
  let leadBars = 0;
  for (const key in lines) {
    leadBars++;
    if (!seen[lines[key]]) {
      seen[lines[key]] = true;
      distinctBars++;
    }
  }

  // The same minute without the music's compressor and clipper: what do they change?
  const probe = Math.min(seconds, 60);
  const raw = (await steppedMusic(track, probe, seed, tick, undefined, { chain: { musicGlue: false, musicClip: false }, tail: 3 })).data.subarray(SR);
  const cooked = data.subarray(SR, Math.floor(probe * SR));
  const rawRms = sliceRmsDb(raw, SR, 0, probe);
  const cookedRms = sliceRmsDb(cooked, SR, 0, probe);
  let rawPeak = 0;
  for (let i = 0; i < raw.length; i++) if (Math.abs(raw[i]) > rawPeak) rawPeak = Math.abs(raw[i]);
  let cookedPeak = 0;
  for (let i = 0; i < cooked.length; i++) if (Math.abs(cooked[i]) > cookedPeak) cookedPeak = Math.abs(cooked[i]);
  // Samples above the clipper's knee, seen from the output: knee × music bus gain.
  const kneeOut = MUSIC_KNEE * LEVELS.music;
  let bent = 0;
  for (let i = SR; i < data.length; i++) if (Math.abs(data[i]) > kneeOut) bent++;

  const canvas = drawSpectrogram(data, 'music-' + track + '-long  (' + seconds + ' s, seed ' + seed + ', scheduled every ' + tick * 1000 + ' ms)', true);
  return {
    track,
    crest: crestDb(data.subarray(SR)),
    rawCrest: toDb(rawPeak) - rawRms,
    densityGainDb: cookedRms - toDb(cookedPeak) - (rawRms - toDb(rawPeak)),
    glueMax: render.glueMax,
    glueMean: render.glueMean,
    clipShare: bent / Math.max(1, data.length - SR),
    seconds,
    seed,
    tick,
    peak,
    clips: peak >= 0.99,
    rmsDb: sliceRmsDb(data, SR, 1, seconds),
    loudness: loudnessStats(data.subarray(SR), SR),
    layerDb: await layerLevels(track, Math.min(seconds, 60), seed, tick),
    longestSilence: longestSilence(data.subarray(Math.floor(1.5 * SR)), SR, 0.002),
    minuteDb,
    tenSecondDb,
    firstLastDifference: energy > 0 ? diff / energy : 0,
    repeatedBars,
    barsPerMinute,
    distinctBars,
    leadBars,
    events: render.stats.events,
    bars: render.stats.bars,
    dropped: render.stats.dropped,
    resyncs: render.stats.resyncs,
    maxVoices: render.maxVoices,
    maxNodes: render.maxNodes,
    firstMinuteNodes: render.firstMinuteNodes,
    lastMinuteNodes: render.lastMinuteNodes,
    endVoices: render.endVoices,
    endNodes: render.endNodes,
    wav: base64(encodeWav(data.subarray(0, Math.min(data.length, 30 * SR)), SR)),
    png: canvas.toDataURL('image/png'),
  };
}

/**
 * The first sound of a brand-new context against the same sound later on. The limiter starts
 * life half shut; the output chain's start-up bypass must hide that.
 */
async function startupReport(name: SfxName, step?: number): Promise<{ earlyDb: number; lateDb: number; earlyPeak: number; latePeak: number }> {
  const measure = async (at: number): Promise<{ db: number; peak: number }> => {
    const data = await renderOffline(at + 1.2, (ctx, chain) => {
      renderSfx(ctx, chain.sfxBus, name, at, step === undefined ? undefined : { step });
    });
    const m = analyze(data.subarray(Math.max(0, Math.floor((at - 0.005) * SR))), SR);
    return { db: m.loudDb, peak: m.peak };
  };
  const early = await measure(0.005);
  const late = await measure(START);
  return { earlyDb: early.db, lateDb: late.db, earlyPeak: early.peak, latePeak: late.peak };
}

// ───────────────────────────── live instruments ─────────────────────────────

/**
 * Recorder for the engine's real output: an AudioWorklet copies every sample that leaves the
 * output chain and posts it to the page, so a test can look at exactly what was played —
 * also across a blocked main thread, which a polling meter would miss.
 */
const RECORDER_SOURCE = `
class LabRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.n = 0;
    this.t = 0;
    this.port.onmessage = (e) => { if (e.data === 'flush') this.flush(); };
  }
  flush() {
    if (this.n > 0) {
      this.port.postMessage({ t: this.t, data: this.buf.slice(0, this.n) });
      this.n = 0;
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    const len = ch ? ch.length : 128;
    if (this.n + len > this.buf.length) this.flush();
    if (this.n === 0) this.t = currentTime;
    if (ch) this.buf.set(ch, this.n); else this.buf.fill(0, this.n, this.n + len);
    this.n += len;
    return true;
  }
}
registerProcessor('lab-recorder', LabRecorder);
`;

interface Chunk {
  t: number;
  data: Float32Array;
}

export interface Recording {
  sampleRate: number;
  /** Context time of the first sample. */
  t0: number;
  seconds: number;
  /** Samples missing between chunks (should be 0: the context clock and the audio agree). */
  holes: number;
  peak: number;
  rmsDb: number;
  /** RMS of consecutive 20 ms windows (linear). */
  rms20: number[];
  /** Largest sample-to-sample jump. */
  maxStep: number;
  /** Largest level right before a stretch of digital silence (a hard cut). */
  hardCut: number;
  /** Largest |sample| in the last 3 ms of the recording. */
  tailEdge: number;
  /** Onset times (s from the start of the recording). */
  onsets: number[];
}

let recNode: AudioWorkletNode | null = null;
let recContext: BaseAudioContext | null = null;
let recChunks: Chunk[] = [];
let recOn = false;
let recLast: { data: Float32Array; sampleRate: number } | null = null;

async function recStart(engine: AudioEngine): Promise<number> {
  const d = engine.debug();
  if (!d.context || !d.output) throw new Error('recorder: the engine has no context yet');
  if (!recNode || recContext !== d.context) {
    const url = URL.createObjectURL(new Blob([RECORDER_SOURCE], { type: 'application/javascript' }));
    await d.context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(d.context, 'lab-recorder', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    node.port.onmessage = (e: MessageEvent) => {
      if (recOn) recChunks.push(e.data as Chunk);
    };
    d.output.connect(node);
    // Keep the recorder in the rendered graph without adding anything to the output.
    const mute = d.context.createGain();
    mute.gain.value = 0;
    node.connect(mute);
    mute.connect(d.context.destination);
    recNode = node;
    recContext = d.context;
    // A worklet node that has just joined the graph is not called for the first few render
    // quanta after its very first one; let that pass before anything is recorded.
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  // Whatever was captured so far is thrown away: the recording begins with the next sample.
  recNode.port.postMessage('flush');
  await new Promise((resolve) => setTimeout(resolve, 20));
  recChunks = [];
  recOn = true;
  return d.context.currentTime;
}

async function recStop(): Promise<Recording> {
  if (!recNode || !recContext) throw new Error('recorder: not started');
  recNode.port.postMessage('flush');
  await new Promise((resolve) => setTimeout(resolve, 80));
  recOn = false;
  const sr = recContext.sampleRate;
  const chunks = recChunks;
  recChunks = [];
  let total = 0;
  for (let i = 0; i < chunks.length; i++) total += chunks[i].data.length;
  const data = new Float32Array(total);
  let at = 0;
  let holes = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      const expected = chunks[i - 1].t + chunks[i - 1].data.length / sr;
      const gap = Math.round((chunks[i].t - expected) * sr);
      if (gap !== 0) holes += Math.abs(gap);
    }
    data.set(chunks[i].data, at);
    at += chunks[i].data.length;
  }
  recLast = { data, sampleRate: sr };
  let peak = 0;
  let sq = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > peak) peak = v;
    sq += v * v;
  }
  let tailEdge = 0;
  for (let i = Math.max(0, data.length - Math.round(0.003 * sr)); i < data.length; i++) if (Math.abs(data[i]) > tailEdge) tailEdge = Math.abs(data[i]);
  return {
    sampleRate: sr,
    t0: chunks.length ? chunks[0].t : 0,
    seconds: data.length / sr,
    holes,
    peak,
    rmsDb: toDb(Math.sqrt(sq / Math.max(1, data.length))),
    rms20: Array.prototype.slice.call(rmsTrack(data, sr, 0.02)) as number[],
    maxStep: maxStep(data, sr),
    hardCut: hardCutLevel(data, sr),
    tailEdge,
    onsets: data.length > 4096 ? detectOnsets(data, sr) : [],
  };
}

/** WAV and spectrogram of the last recording, for the files the checker writes. */
function recFiles(title: string): { wav: string; png: string } | null {
  if (!recLast) return null;
  // The drawing code assumes the lab's 44.1 kHz; a live context may run at another rate, which
  // only shifts the frequency labels slightly, so resample by picking samples.
  const src = recLast.data;
  const ratio = recLast.sampleRate / SR;
  const out = new Float32Array(Math.floor(src.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = src[Math.min(src.length - 1, Math.round(i * ratio))];
  const canvas = drawSpectrogram(out, title, out.length > 3 * SR);
  return { wav: base64(encodeWav(src, recLast.sampleRate)), png: canvas.toDataURL('image/png') };
}

/**
 * Probe: notes every source the engine starts on its context — when it was asked to start
 * and what the audio clock said at that moment. A start time in the past is a late note; many
 * starts crowded into one instant are a burst. A source that is stopped again at once (a
 * voice the engine took back before it could sound) is noted as cancelled and not counted.
 */
export interface ProbeReport {
  starts: number;
  /** Starts scheduled more than 5 ms in the past and left to sound. */
  late: number;
  /** Sources started and taken back at once. */
  cancelled: number;
  /** Smallest (start time − clock) among the sources left to sound, s. */
  worstLead: number;
  /** Start times (context seconds) of the sources left to sound, in call order. */
  when: number[];
  /** Audio clock at each of those calls. */
  at: number[];
}

interface ProbeEntry {
  when: number;
  at: number;
  cancelled: boolean;
}

let probeLog: ProbeEntry[] | null = null;
let probeEntries: WeakMap<object, ProbeEntry> = new WeakMap();
let probeInstalled = false;

function probeInstall(): void {
  if (probeInstalled) return;
  probeInstalled = true;
  type Proto = { start: (...a: number[]) => void; stop: (...a: number[]) => void };
  const patch = (proto: Proto | undefined): void => {
    if (!proto) return;
    if (Object.prototype.hasOwnProperty.call(proto, 'start')) {
      const original = proto.start;
      proto.start = function (this: AudioScheduledSourceNode, ...a: number[]): void {
        const log = probeLog;
        const engineCtx = audio.debug().context;
        if (log && engineCtx && this.context === engineCtx) {
          const now = engineCtx.currentTime;
          const entry = { when: a.length > 0 && typeof a[0] === 'number' ? a[0] : now, at: now, cancelled: false };
          log.push(entry);
          probeEntries.set(this, entry);
        }
        return original.apply(this, a);
      };
    }
    if (Object.prototype.hasOwnProperty.call(proto, 'stop')) {
      const original = proto.stop;
      proto.stop = function (this: AudioScheduledSourceNode, ...a: number[]): void {
        const entry = probeEntries.get(this);
        const engineCtx = audio.debug().context;
        // Stopped no later than the clock stood when it was started: it never sounds.
        if (entry && engineCtx && (a.length === 0 || typeof a[0] !== 'number' || a[0] <= Math.max(entry.at, entry.when))) {
          if (engineCtx.currentTime <= Math.max(entry.at, entry.when) + 0.05) entry.cancelled = true;
        }
        return original.apply(this, a);
      };
    }
  };
  const w = window as unknown as { [name: string]: { prototype: Proto } | undefined };
  for (const name of ['AudioScheduledSourceNode', 'AudioBufferSourceNode', 'OscillatorNode', 'ConstantSourceNode']) {
    const C = w[name];
    patch(C ? C.prototype : undefined);
  }
}

function probeStart(): void {
  probeInstall();
  probeLog = [];
  probeEntries = new WeakMap();
}

function probeStop(): ProbeReport {
  const all = probeLog || [];
  probeLog = null;
  const log = all.filter((x) => !x.cancelled);
  let late = 0;
  let worst = Infinity;
  for (let i = 0; i < log.length; i++) {
    const lead = log[i].when - log[i].at;
    if (lead < worst) worst = lead;
    if (lead < -0.005) late++;
  }
  return { starts: log.length, late, cancelled: all.length - log.length, worstLead: log.length ? worst : 0, when: log.map((x) => x.when), at: log.map((x) => x.at) };
}

/** Block the main thread (and with it the scheduler's timer) for `ms` milliseconds. */
function stall(ms: number): { before: number; after: number } {
  const ctx = audio.debug().context;
  const before = ctx ? ctx.currentTime : 0;
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    /* busy */
  }
  return { before, after: ctx ? ctx.currentTime : 0 };
}

/** Pretend the page was hidden or shown (the engine's own safety net listens for this). */
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}

// ───────────────────────────── spectrogram drawing ─────────────────────────────

const STOPS: number[][] = [
  [0, 10, 8, 34],
  [0.25, 58, 22, 112],
  [0.5, 168, 40, 112],
  [0.75, 245, 134, 44],
  [1, 255, 246, 205],
];

function heat(t: number, out: number[]): void {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i][0]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const u = (x - a[0]) / (b[0] - a[0]);
      out[0] = a[1] + (b[1] - a[1]) * u;
      out[1] = a[2] + (b[2] - a[2]) * u;
      out[2] = a[3] + (b[3] - a[3]) * u;
      return;
    }
  }
  out[0] = 255;
  out[1] = 246;
  out[2] = 205;
}

let lastCanvas: HTMLCanvasElement | null = null;

/**
 * Log-frequency spectrogram (50 Hz … 18 kHz, −90 … −10 dB) with the waveform underneath.
 * `long` picks a coarser time grid suited to many seconds of music.
 */
function drawSpectrogram(data: Float32Array, title: string, long: boolean): HTMLCanvasElement {
  const size = long ? 4096 : 1024;
  const hop = long ? 1024 : 128;
  const sg = spectrogram(data, SR, size, hop);
  const frames = sg.frames.length;
  const plotW = long ? 1280 : Math.max(420, Math.min(1100, frames * 3));
  const plotH = 300;
  const waveH = 70;
  const left = 54;
  const top = 28;
  const canvas = document.createElement('canvas');
  canvas.width = left + plotW + 12;
  canvas.height = top + plotH + 10 + waveH + 26;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#14123a';
  g.fillRect(0, 0, canvas.width, canvas.height);

  const fMin = 50;
  const fMax = 18000;
  const binHz = SR / size;
  const img = g.createImageData(plotW, plotH);
  const rgb = [0, 0, 0];
  const binOf = new Float64Array(plotH);
  for (let y = 0; y < plotH; y++) binOf[y] = (fMin * Math.pow(fMax / fMin, 1 - y / (plotH - 1))) / binHz;
  for (let x = 0; x < plotW; x++) {
    // Several frames may fall on one pixel column: keep the strongest so short events survive.
    const f0 = Math.floor((x / plotW) * frames);
    const f1 = Math.max(f0 + 1, Math.floor(((x + 1) / plotW) * frames));
    for (let y = 0; y < plotH; y++) {
      const b = binOf[y];
      const k = Math.floor(b);
      const u = b - k;
      let p = 0;
      for (let f = f0; f < f1 && f < frames; f++) {
        const fr = sg.frames[f];
        const v = k + 1 < fr.length ? fr[k] * (1 - u) + fr[k + 1] * u : 0;
        if (v > p) p = v;
      }
      heat((10 * Math.log10(p + 1e-12) + 90) / 80, rgb);
      const o = (y * plotW + x) * 4;
      img.data[o] = rgb[0];
      img.data[o + 1] = rgb[1];
      img.data[o + 2] = rgb[2];
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, left, top);

  g.font = '12px monospace';
  g.fillStyle = '#ffe7a3';
  g.textBaseline = 'middle';
  g.fillText(title, left, 13);
  g.fillStyle = '#c9c2e6';
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1;
  const marks = [100, 200, 500, 1000, 2000, 5000, 10000];
  g.textAlign = 'right';
  for (let i = 0; i < marks.length; i++) {
    const y = top + (1 - Math.log(marks[i] / fMin) / Math.log(fMax / fMin)) * (plotH - 1);
    g.fillText(marks[i] >= 1000 ? marks[i] / 1000 + 'k' : String(marks[i]), left - 6, y);
    g.beginPath();
    g.moveTo(left, Math.round(y) + 0.5);
    g.lineTo(left + plotW, Math.round(y) + 0.5);
    g.stroke();
  }
  // Time axis.
  const seconds = data.length / SR;
  const tick = seconds > 8 ? 2 : seconds > 2 ? 0.5 : seconds > 0.8 ? 0.2 : seconds > 0.3 ? 0.1 : 0.05;
  g.textAlign = 'center';
  const baseY = top + plotH + 10 + waveH;
  for (let t = 0; t <= seconds + 1e-6; t += tick) {
    const x = left + (t / seconds) * plotW;
    g.fillText(t.toFixed(tick < 0.1 ? 2 : tick < 1 ? 1 : 0) + 's', x, baseY + 14);
    g.beginPath();
    g.moveTo(Math.round(x) + 0.5, top);
    g.lineTo(Math.round(x) + 0.5, baseY);
    g.stroke();
  }
  // Waveform (full scale = strip height).
  const wy = top + plotH + 10;
  g.fillStyle = '#231f5c';
  g.fillRect(left, wy, plotW, waveH);
  g.fillStyle = '#f5c95a';
  for (let x = 0; x < plotW; x++) {
    const a = Math.floor((x / plotW) * data.length);
    const b = Math.max(a + 1, Math.floor(((x + 1) / plotW) * data.length));
    let lo = 0;
    let hi = 0;
    for (let i = a; i < b && i < data.length; i++) {
      if (data[i] < lo) lo = data[i];
      if (data[i] > hi) hi = data[i];
    }
    const y0 = wy + waveH / 2 - (hi * waveH) / 2;
    const y1 = wy + waveH / 2 - (lo * waveH) / 2;
    g.fillRect(left + x, y0, 1, Math.max(1, y1 - y0));
  }
  lastCanvas = canvas;
  return canvas;
}

// ───────────────────────────── page ─────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function fmt(x: number, digits: number = 1): string {
  return isFinite(x) ? x.toFixed(digits) : '—';
}

function mount(audio: AudioEngine): void {
  const root = document.getElementById('lab');
  if (!root) return;

  const status = el('pre', '', 'status');
  status.id = 'status';
  root.appendChild(el('h1', 'Audio lab'));
  root.appendChild(el('p', 'Development page: every sound of the game, synthesised live. Not part of the build.', 'note'));
  root.appendChild(status);

  // Engine controls.
  const controls = el('div', undefined, 'row');
  const button = (label: string, id: string, onClick: () => void, cls?: string): HTMLButtonElement => {
    const b = el('button', label, cls);
    b.id = id;
    b.addEventListener('click', onClick);
    return b;
  };
  const check = (label: string, id: string, onChange: (on: boolean) => void): HTMLLabelElement => {
    const wrap = el('label', undefined, 'check');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = true;
    box.id = id;
    box.addEventListener('change', () => onChange(box.checked));
    wrap.appendChild(box);
    wrap.appendChild(document.createTextNode(' ' + label));
    return wrap;
  };
  controls.appendChild(button('Unlock audio', 'unlock', () => audio.unlock(), 'primary'));
  controls.appendChild(check('Effects', 'toggle-sfx', (on) => audio.setSfxEnabled(on)));
  controls.appendChild(check('Music', 'toggle-music', (on) => audio.setMusicEnabled(on)));
  controls.appendChild(button('Suspend', 'suspend', () => audio.suspend()));
  controls.appendChild(button('Resume', 'resume', () => audio.resume()));
  controls.appendChild(
    button('Storm ×200', 'storm', () => {
      for (let i = 0; i < 200; i++) audio.sfx(SFX_NAMES[i % SFX_NAMES.length], { step: 1 + (i % 13) });
    }),
  );
  root.appendChild(controls);

  // Step / volume.
  const sliders = el('div', undefined, 'row');
  const slider = (label: string, id: string, min: number, max: number, step: number, value: number): HTMLInputElement => {
    const wrap = el('label', label + ' ', 'slider');
    const input = el('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const shown = el('span', String(value));
    input.addEventListener('input', () => {
      shown.textContent = input.value;
    });
    wrap.appendChild(input);
    wrap.appendChild(shown);
    sliders.appendChild(wrap);
    return input;
  };
  const stepInput = slider('step', 'step', 1, 13, 1, 1);
  const volumeInput = slider('volume', 'volume', 0, 1, 0.05, 1);
  root.appendChild(sliders);

  // Music.
  root.appendChild(el('h2', 'Music'));
  const music = el('div', undefined, 'row');
  music.appendChild(button('menu', 'music-menu', () => audio.music('menu')));
  music.appendChild(button('level', 'music-level', () => audio.music('level')));
  music.appendChild(button('stop', 'music-stop', () => audio.music(null)));
  root.appendChild(music);

  // Effects.
  root.appendChild(el('h2', 'Effects'));
  const grid = el('div', undefined, 'grid');
  for (let i = 0; i < SFX_NAMES.length; i++) {
    const name = SFX_NAMES[i];
    const b = button(name + (SFX_STEPS[name] ? ' ·step' : ''), 'sfx-' + name, () => {
      audio.sfx(name, { step: Number(stepInput.value), volume: Number(volumeInput.value) });
    });
    b.className = 'sfx ' + sfxClass(name);
    b.title = sfxTier(name) + ' tier, ' + sfxPeakDb(name) + ' dBFS';
    grid.appendChild(b);
  }
  root.appendChild(grid);

  // Offline render.
  root.appendChild(el('h2', 'Offline render'));
  const off = el('div', undefined, 'row');
  const select = el('select');
  select.id = 'render-select';
  const all = variants();
  for (let i = 0; i < all.length; i++) {
    const o = el('option', all[i].id);
    o.value = String(i);
    select.appendChild(o);
  }
  const tracks: MusicTrack[] = ['menu', 'level'];
  for (let i = 0; i < tracks.length; i++) {
    const o = el('option', 'music-' + tracks[i] + ' (20 s)');
    o.value = 'm' + i;
    select.appendChild(o);
  }
  const result = el('div', undefined, 'result');
  result.id = 'render-result';
  off.appendChild(select);
  off.appendChild(
    button('Render + measure', 'render', () => {
      result.textContent = 'rendering…';
      const v = select.value;
      const job: Promise<SoundReport> = v.charAt(0) === 'm' ? musicReport(tracks[Number(v.slice(1))], 20, 1) : sfxReport(all[Number(v)].name, all[Number(v)].step);
      job.then(
        (r) => {
          result.textContent = '';
          const m = r.metrics;
          result.appendChild(
            el(
              'pre',
              r.id +
                '\nduration ' + fmt(r.nominal, 3) + ' s (audible ' + fmt(m.effective, 3) + ' s)' +
                '\npeak ' + fmt(m.peakDb) + ' dBFS · rms ' + fmt(m.rmsDb) + ' dBFS · loudest 50 ms ' + fmt(m.loudDb) + ' dBFS · A-weighted ' + fmt(m.loudADb) + ' dB' +
                '\ncentroid ' + fmt(m.centroid, 0) + ' Hz (' + fmt(m.centroidStart, 0) + ' → ' + fmt(m.centroidEnd, 0) + ') · strongest ' + fmt(m.pitch, 0) + ' Hz' +
                '\nDC ' + m.dc.toExponential(1) + ' · clips ' + m.clips + ' · silent ' + m.silent,
            ),
          );
          if (lastCanvas) result.appendChild(lastCanvas);
        },
        (e) => {
          result.textContent = 'failed: ' + String(e);
        },
      );
    }),
  );
  root.appendChild(off);
  root.appendChild(result);

  const refresh = (): void => {
    const d = audio.debug();
    status.textContent =
      'context ' + d.state + ' · unlocked ' + d.unlocked + ' · suspended ' + d.suspended +
      '\nmusic wanted ' + d.track + ' · playing ' + d.playing + ' · scheduler ' + (d.schedulerRunning ? 'on' : 'off') +
      (d.music ? ' · bars ' + d.music.bars + ' · events ' + d.music.events + ' · dropped ' + d.music.dropped + ' · resyncs ' + d.music.resyncs : '') +
      '\neffects ' + (d.sfxEnabled ? 'on' : 'off') + ' · voices ' + d.voices + '/' + d.maxVoices + ' (match ' + d.matchVoices + ') · played ' + d.sfxPlayed + ' · dropped ' + d.sfxDropped + ' · stolen ' + d.sfxStolen;
  };
  refresh();
  setInterval(refresh, 250);
}

// ───────────────────────────── live meter ─────────────────────────────

let meter: AnalyserNode | null = null;
let meterData: Float32Array<ArrayBuffer> | null = null;

/** Loudest RMS and largest sample seen at the engine's output during `ms` milliseconds. */
function listen(audio: AudioEngine, ms: number): Promise<{ rms: number; peak: number }> {
  return new Promise((resolve) => {
    const d = audio.debug();
    if (!d.context || !d.output) {
      resolve({ rms: 0, peak: 0 });
      return;
    }
    if (!meter || meter.context !== d.context) {
      meter = d.context.createAnalyser();
      meter.fftSize = 2048;
      meterData = new Float32Array(meter.fftSize);
      d.output.connect(meter);
    }
    const m = meter;
    const buf = meterData as Float32Array<ArrayBuffer>;
    let loudest = 0;
    let peak = 0;
    const started = performance.now();
    const poll = (): void => {
      m.getFloatTimeDomainData(buf);
      let e = 0;
      for (let i = 0; i < buf.length; i++) {
        e += buf[i] * buf[i];
        if (Math.abs(buf[i]) > peak) peak = Math.abs(buf[i]);
      }
      const r = Math.sqrt(e / buf.length);
      if (r > loudest) loudest = r;
      if (performance.now() - started >= ms) resolve({ rms: loudest, peak });
      else setTimeout(poll, 30);
    };
    poll();
  });
}

function snapshot(audio: AudioEngine): { [key: string]: unknown } {
  const d = audio.debug();
  return {
    state: d.state,
    unlocked: d.unlocked,
    suspended: d.suspended,
    sfxEnabled: d.sfxEnabled,
    musicEnabled: d.musicEnabled,
    track: d.track,
    playing: d.playing,
    schedulerRunning: d.schedulerRunning,
    voices: d.voices,
    maxVoices: d.maxVoices,
    matchVoices: d.matchVoices,
    sfxPlayed: d.sfxPlayed,
    sfxDropped: d.sfxDropped,
    sfxStolen: d.sfxStolen,
    sfxRebuilt: d.sfxRebuilt,
    sfxLead: d.sfxLead,
    music: d.music,
    musicLevel: d.musicLevel,
    hidden: d.hidden,
    fading: d.fading,
    musicStarts: d.musicStarts,
    liveVoices: d.liveVoices,
    liveNodes: d.liveNodes,
    time: d.context ? d.context.currentTime : 0,
  };
}

const audio = createAudio();

/** What the stepped effects and the mix are designed to be: pitches (Hz), levels (dB), limits. */
function expected(): {
  match: number[];
  star: number[];
  praise: number[][];
  tiers: { name: string; peakDb: number }[];
  variants: { cents: number; attack: number }[];
  musicPeakDb: number;
  duckDb: number;
  duckHold: number;
  ceiling: number;
  limiterOnset: number;
  maxVoices: number;
  matchVoices: number;
  landInterval: number;
  musicLevel: number;
  ducking: string[];
} {
  const match: number[] = [];
  const steps = SFX_STEPS.match || [];
  for (let i = 0; i < steps.length; i++) match.push(matchStepFreq(steps[i]));
  return {
    match,
    star: [1, 2, 3].map((s) => midiToFreq(starStepMidi(s))),
    praise: [1, 2, 3, 4].map((s) => praiseMotif(s).map((m) => midiToFreq(m))),
    tiers: SFX_TIERS.map((t) => ({ name: t, peakDb: SFX_TIER_PEAK_DB[t] })),
    variants: MATCH_VARIANTS.map((v) => ({ cents: v.cents, attack: v.attack })),
    musicPeakDb: MUSIC_PEAK_DB,
    duckDb: MUSIC_DUCK_DB,
    duckHold: MUSIC_DUCK_HOLD,
    ceiling: GUARD_CEILING,
    limiterOnset: LIMITER_ONSET,
    maxVoices: SFX_MAX_VOICES,
    matchVoices: SFX_MATCH_VOICES,
    landInterval: SFX_LAND_INTERVAL,
    musicLevel: LEVELS.music,
    ducking: SFX_NAMES.filter((n) => sfxDucksMusic(n)),
  };
}

// ───────────────────────────── the mix ─────────────────────────────

/**
 * A minute of typical play as a list of sound calls: moves with cascades of different
 * lengths, blockers, specials, praise, then the goal, the finale and the result. Written to
 * exercise the mix the way a level does; the numbers are the game's own timings.
 */
function gameplayScript(seconds: number, seed: number): ScriptEvent[] {
  const rnd = mulberry32(seed >>> 0);
  const out: ScriptEvent[] = [];
  const blockers: SfxName[] = ['sand', 'stone', 'chain', 'vine', 'stoneBreak'];
  out.push({ t: 0.8, name: 'levelStart' });
  const end = seconds - 7.5;
  let t = 2.4;
  while (t < end) {
    out.push({ t, name: 'select' });
    out.push({ t: t + 0.18, name: 'swap' });
    if (rnd() < 0.08) {
      // a swap that does not match
      out.push({ t: t + 0.36, name: 'invalid' });
      t += 1.4 + rnd() * 0.8;
      continue;
    }
    let at = t + 0.42;
    let gap = 0.52;
    let step = 1;
    for (;;) {
      out.push({ t: at, name: 'match', step });
      if (rnd() < 0.3) out.push({ t: at + 0.02, name: blockers[Math.floor(rnd() * blockers.length)] });
      if (rnd() < 0.14) out.push({ t: at + 0.05, name: rnd() < 0.6 ? 'createBeam' : rnd() < 0.7 ? 'createNova' : 'createPrism', volume: 0.6 });
      if (rnd() < 0.16) {
        const r = rnd();
        out.push({ t: at + 0.1, name: r < 0.5 ? 'beam' : r < 0.85 ? 'nova' : 'prism' });
        if (rnd() < 0.2) out.push({ t: at + 0.3, name: 'bigCombo', volume: 0.7 });
      }
      out.push({ t: at + gap * 0.62, name: 'land' });
      if (rnd() < 0.5) out.push({ t: at + gap * 0.62 + 0.07, name: 'land' });
      if (step >= 9 || rnd() > 0.5) break;
      at += gap;
      gap = Math.max(0.31, gap * 0.92);
      step++;
    }
    if (step >= 4) out.push({ t: at + 0.12, name: 'praise', step: step >= 8 ? 3 : step >= 6 ? 2 : 1 });
    if (rnd() < 0.06) out.push({ t: at + 0.5, name: 'lamp' });
    t = at + gap + 0.9 + rnd() * 1.1;
  }
  // The level is won: goal, finale (conversions continue the ladder), result.
  let f = end + 0.4;
  out.push({ t: f, name: 'goalDone' });
  f += 0.7;
  out.push({ t: f, name: 'finale' });
  f += 0.9;
  for (let k = 0; k < 7; k++) out.push({ t: f + k * 0.16, name: 'match', step: 2 + k });
  f += 7 * 0.16 + 0.1;
  out.push({ t: f, name: 'beam' });
  out.push({ t: f + 0.12, name: 'nova' });
  out.push({ t: f + 0.24, name: 'beam' });
  f += 0.9;
  out.push({ t: f, name: 'win' });
  for (let k = 0; k < 3; k++) out.push({ t: f + 1.75 + k * 0.3, name: 'star', step: k + 1 });
  return out.filter((e) => e.t < seconds - 0.2);
}

export interface MixReport {
  seconds: number;
  events: number;
  played: number;
  dropped: number;
  stolen: number;
  /** Most effect voices / 'match' voices sounding at once (sampled every tick). */
  maxVoices: number;
  maxMatchVoices: number;
  peak: number;
  peakDb: number;
  rmsDb: number;
  /** Programme loudness of the capture as a phone plays it (the same signal on both channels). */
  loudness: Loudness;
  /** The same script without music, and the music without the effects. */
  sfxOnly: Loudness;
  musicOnly: Loudness;
  musicOnlyPeakDb: number;
  /** Lowest and resting gain of the music bus seen during the capture (dB re its normal level). */
  duckDeepestDb: number;
  wav: string;
  png: string;
}

/**
 * The whole mix at work: a minute of scripted play over the level music, rendered offline
 * through the same mixer and output chain as the live engine.
 */
async function mixReport(seconds: number = 60, seed: number = 7): Promise<MixReport> {
  const script = gameplayScript(seconds, seed);
  let maxVoices = 0;
  let maxMatch = 0;
  const watch = (mixer: SfxMixer, now: number): void => {
    maxVoices = Math.max(maxVoices, mixer.active(now));
    maxMatch = Math.max(maxMatch, mixer.active(now, 'match'));
  };
  const full = await steppedMusic('level', seconds, 20240521, 0.05, undefined, { script, onMixer: watch, tail: 2.5 });
  const sfxOnly = await steppedMusic(null, seconds, 20240521, 0.05, undefined, { script, tail: 2.5 });
  const musicOnly = await steppedMusic('level', seconds, 20240521, 0.05, undefined, { tail: 2.5 });
  const data = full.data;
  const m = analyze(data, SR);
  // How far the music really dips: compare the music-only render with (mix − effects).
  let deepest = 0;
  const win = Math.round(0.2 * SR);
  for (let s = SR * 3; s + win < data.length; s += win) {
    let a = 0;
    let b = 0;
    for (let i = s; i < s + win; i++) {
      const d = data[i] - sfxOnly.data[i];
      a += d * d;
      b += musicOnly.data[i] * musicOnly.data[i];
    }
    if (b > 1e-9) {
      const db = 10 * Math.log10(Math.max(a, 1e-12) / b);
      if (db < deepest) deepest = db;
    }
  }
  const canvas = drawSpectrogram(data, 'mix  (' + seconds + ' s of scripted play over level music, ' + script.length + ' sound calls)', true);
  return {
    seconds,
    events: script.length,
    played: full.mixer.stats.played,
    dropped: full.mixer.stats.dropped,
    stolen: full.mixer.stats.stolen,
    maxVoices,
    maxMatchVoices: maxMatch,
    peak: m.peak,
    peakDb: m.peakDb,
    rmsDb: sliceRmsDb(data, SR, 0, seconds),
    loudness: loudness(data, SR, 2),
    sfxOnly: loudness(sfxOnly.data, SR, 2),
    musicOnly: loudness(musicOnly.data.subarray(SR), SR, 2),
    musicOnlyPeakDb: toDb(slicePeak(musicOnly.data, SR, 1, seconds)),
    duckDeepestDb: deepest,
    wav: base64(encodeWav(data, SR)),
    png: canvas.toDataURL('image/png'),
  };
}

export interface FloodReport {
  calls: number;
  played: number;
  dropped: number;
  stolen: number;
  /** Voices counted by the mixer right after the flood, and the 'match' voices among them. */
  voices: number;
  matchVoices: number;
  /** Voices really alive in the audio graph right after the flood. */
  liveVoices: number;
  /** Tiers of the voices that survived. */
  survivors: string[];
  peak: number;
  rmsDb: number;
  /** Alive after everything had ended. */
  endVoices: number;
  endNodes: number;
}

/** Five hundred effects in one instant through the mixer, offline: the caps must hold. */
async function floodReport(calls: number = 500): Promise<FloodReport> {
  const seconds = 3.5;
  const ctx = offlineContext(seconds);
  const chain = createOutputChain(ctx);
  const mixer = new SfxMixer(ctx, chain);
  const before = voiceCensus(ctx).voices;
  const at = 0.5;
  for (let i = 0; i < calls; i++) {
    mixer.play(SFX_NAMES[i % SFX_NAMES.length], { step: 1 + (i % 13), volume: 0.5 + (i % 5) * 0.125 }, at, at + 0.013);
  }
  const voices = mixer.active(at + 0.014);
  const matchVoices = mixer.active(at + 0.014, 'match');
  const liveVoices = voiceCensus(ctx).voices - before;
  const survivors = mixer.ranks(at + 0.014).map((r) => SFX_TIERS[r]);
  const buffer = await ctx.startRendering();
  await new Promise((resolve) => setTimeout(resolve, 30));
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
  const left = voiceCensus(ctx);
  return {
    calls,
    played: mixer.stats.played,
    dropped: mixer.stats.dropped,
    stolen: mixer.stats.stolen,
    voices,
    matchVoices,
    liveVoices,
    survivors,
    peak,
    rmsDb: sliceRmsDb(data, SR, at, at + 1),
    endVoices: left.voices,
    endNodes: left.nodes,
  };
}

export interface StealReport {
  /** Level of the stolen voice just before it was taken, and 30 ms after (linear). */
  before: number;
  after: number;
  /** What the voice would have been at that later moment had it been left alone. */
  untouched: number;
  /** Largest level right before a stretch of digital silence: a hard cut would show here. */
  hardCut: number;
  /** Voices stolen / effects started in that scenario (expected: 1 of 13). */
  stolen: number;
  played: number;
  /** The 'match' budget: four in a row — voices stolen, voices started, most at once. */
  matchStolen: number;
  matchPlayed: number;
  matchMost: number;
}

/**
 * A voice is stolen: is it faded, or chopped? A long jingle sounds; eleven more jingles
 * arrive at a volume too low to hear, which fills every voice; the next one takes the place
 * of the oldest — the audible one. What is left in the render is that voice alone, and how
 * it ends. A second scenario counts what four 'match' sounds in a row do to their budget.
 */
async function stealReport(): Promise<StealReport> {
  const seconds = 3;
  const t0 = 0.5;
  const steal = t0 + 0.32;
  const whisper = 0.0005;
  const fill: { name: SfxName; step?: number }[] = [
    { name: 'win' }, { name: 'reward' }, { name: 'chest' }, { name: 'caravan' }, { name: 'levelStart' }, { name: 'purchase' },
    { name: 'star', step: 1 }, { name: 'star', step: 2 }, { name: 'star', step: 3 }, { name: 'win' }, { name: 'reward' },
  ];
  const run = async (thieves: boolean): Promise<{ data: Float32Array; stolen: number; played: number }> => {
    const ctx = offlineContext(seconds);
    const chain = createOutputChain(ctx);
    const mixer = new SfxMixer(ctx, chain);
    mixer.play('lose', undefined, t0, t0);
    if (thieves) {
      for (let i = 0; i < fill.length; i++) {
        const at = t0 + 0.02 + i * 0.02;
        mixer.play(fill[i].name, { step: fill[i].step, volume: whisper }, at, at);
      }
      mixer.play('chest', { volume: whisper }, steal, steal);
    }
    const buffer = await ctx.startRendering();
    return { data: buffer.getChannelData(0).slice(), stolen: mixer.stats.stolen, played: mixer.stats.played };
  };
  const a = await run(true);
  const b = await run(false);

  // Four 'match' sounds 40 ms apart: the fourth must push out the first.
  const ctx = offlineContext(1.5);
  const mixer = new SfxMixer(ctx, createOutputChain(ctx));
  let most = 0;
  for (let i = 0; i < 4; i++) {
    const at = 0.3 + i * 0.04;
    mixer.play('match', { step: 1 + i }, at, at + 0.013);
    most = Math.max(most, mixer.active(at + 0.014, 'match'));
  }
  await ctx.startRendering();

  return {
    before: slicePeak(a.data, SR, steal - 0.02, steal),
    after: slicePeak(a.data, SR, steal + 0.03, steal + 0.08),
    untouched: slicePeak(b.data, SR, steal + 0.03, steal + 0.08),
    hardCut: hardCutLevel(a.data, SR),
    stolen: a.stolen,
    played: a.played,
    matchStolen: mixer.stats.stolen,
    matchPlayed: mixer.stats.played,
    matchMost: most,
  };
}

export interface DuckReport {
  name: string;
  /** Music level (dB re normal) 0.25 s into the sound, and 0.5 s after the hold has ended. */
  duringDb: number;
  afterDb: number;
  /** How long the music stayed more than 2 dB down (s). */
  held: number;
}

/** The music's dip under a sound, measured on a steady test tone fed into the music bus. */
async function duckReport(name: SfxName): Promise<DuckReport> {
  const seconds = 5;
  const at = 1;
  const ctx = offlineContext(seconds);
  // The tone goes round the music's compressor and clipper: only the bus gain is measured.
  const chain = createOutputChain(ctx, undefined, { musicGlue: false, musicClip: false });
  const mixer = new SfxMixer(ctx, chain);
  const osc = ctx.createOscillator();
  osc.frequency.value = 9000;
  const g = ctx.createGain();
  g.gain.value = 0.25;
  osc.connect(g);
  g.connect(chain.musicIn);
  osc.start(0);
  // The effect itself is played at a whisper so that it does not disturb the measurement.
  mixer.play(name, { volume: 0.001 }, at, at + 0.013);
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  const level = (from: number, to: number): number => sliceRmsDb(data, SR, from, to);
  const rest = level(0.5, 0.9);
  let held = 0;
  for (let t = at; t < seconds - 0.05; t += 0.01) if (level(t, t + 0.01) < rest - 2) held += 0.01;
  return { name, duringDb: level(at + 0.25, at + 0.3) - rest, afterDb: level(seconds - 0.4, seconds - 0.1) - rest, held };
}

/** One effect rendered alone, as samples that begin exactly at the sound's start. */
async function soloSfx(name: SfxName, step?: number, variant: number = 0): Promise<Float32Array> {
  const full = await renderOffline(START + 2.5, (ctx, chain) => {
    renderSfx(ctx, chain.sfxBus, name, START, step === undefined ? undefined : { step }, undefined, variant);
  });
  return full.subarray(Math.floor(START * SR));
}

/**
 * Tuning of the settled note of an effect: the strongest component near `near` (Hz) between
 * `from` and `to` seconds after the sound's start.
 */
async function tuningOf(name: SfxName, step: number | undefined, variant: number, near: number, from: number, to: number): Promise<number> {
  return pitchNear(await soloSfx(name, step, variant), SR, near, from, to);
}

/** The notes of a melody inside an effect: strongest pitch (lo..hi Hz) in each time slot. */
async function notesOf(name: SfxName, step: number | undefined, slots: { from: number; to: number }[], lo: number, hi: number): Promise<number[]> {
  const data = await soloSfx(name, step, 0);
  return slots.map((s) => strongestIn(data, SR, s.from, s.to, lo, hi));
}

export interface PumpReport {
  track: MusicTrack;
  /** Level of a steady tone riding through the music's dynamics, in dB relative to its median. */
  deepest: number;
  /** Dip that is exceeded only 5 % / 1 % of the time (dB, ≤ 0). */
  p5: number;
  p1: number;
  /** Share of the time (0..1) the tone is more than 3 dB / 6 dB under its median. */
  below3: number;
  below6: number;
}

/**
 * Pumping: how much the music's compressor and clipper push the quiet, sustained part of the
 * music around whenever a note or a drum hits. A faint steady tone (in a band the music hardly
 * uses) is sent through the music path together with the lead and the percussion; what
 * happens to its level is what happens to the drone under them.
 */
async function pumpReport(track: MusicTrack, seconds: number = 40, seed: number = 20240521, chain?: OutputChainOptions): Promise<PumpReport> {
  const hz = 9500;
  const render = await steppedMusic(track, seconds, seed, 0.1, { lead: true, pad: false, perc: true }, { probe: { hz, level: 0.012 }, tail: 2, chain });
  const x = render.data;
  // The tone's level in 10 ms windows (Goertzel), from 2 s on.
  const win = Math.round(0.01 * SR);
  const w = (2 * Math.PI * hz) / SR;
  const levels: number[] = [];
  for (let s = 2 * SR; s + win <= x.length; s += win) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < win; i++) {
      const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win);
      re += x[s + i] * h * Math.cos(w * i);
      im -= x[s + i] * h * Math.sin(w * i);
    }
    levels.push(10 * Math.log10(re * re + im * im + 1e-20));
  }
  const sorted = levels.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] - median;
  let below3 = 0;
  let below6 = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] < median - 3) below3++;
    if (levels[i] < median - 6) below6++;
  }
  return { track, deepest: sorted[0] - median, p5: at(0.05), p1: at(0.01), below3: below3 / levels.length, below6: below6 / levels.length };
}

/** The takes of 'match': each rendered alone, with its pitch and attack. */
async function variantReport(step: number = 5): Promise<{ take: number; pitch: number; cents: number; attack: number; peakDb: number }[]> {
  const out: { take: number; pitch: number; cents: number; attack: number; peakDb: number }[] = [];
  const base = matchStepFreq(step);
  for (let k = 0; k < sfxVariants('match'); k++) {
    const r = await sfxReport('match', step, k);
    const pitch = await tuningOf('match', step, k, base, 0.04, 0.16);
    out.push({ take: k, pitch, cents: 1200 * Math.log2(pitch / base), attack: r.attack || 0, peakDb: r.metrics.peakDb });
  }
  return out;
}

/** Tuning aid: the music's level, crest and pumping for other dynamics settings. */
async function dynamicsTrial(
  track: MusicTrack,
  chain: OutputChainOptions,
  seconds: number = 40,
): Promise<{ peakDb: number; rmsDb: number; crest: number; glueMean: number; glueMax: number; clipShare: number; hardShare: number; loudness: LoudnessStats; pump: PumpReport }> {
  const render = await steppedMusic(track, seconds, 20240521, 0.1, undefined, { chain, tail: 2 });
  const data = render.data.subarray(SR);
  let peak = 0;
  let bent = 0;
  let hard = 0;
  const knee = (chain.clipKnee === undefined ? MUSIC_KNEE : chain.clipKnee) * LEVELS.music;
  // "hard": within half a decibel of the ceiling, where the curve is nearly flat
  const flat = MUSIC_CEILING * LEVELS.music * 0.944;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
    if (a > knee) bent++;
    if (a > flat) hard++;
  }
  return {
    peakDb: toDb(peak),
    rmsDb: sliceRmsDb(data, SR, 0, seconds),
    crest: crestDb(data),
    glueMean: render.glueMean,
    glueMax: render.glueMax,
    clipShare: bent / data.length,
    hardShare: hard / data.length,
    loudness: loudnessStats(data, SR),
    pump: await pumpReport(track, seconds, 20240521, chain),
  };
}

const lab = {
  ready: true,
  audio,
  names: SFX_NAMES,
  variants,
  expected,
  sfxReport,
  musicReport,
  stormReport,
  chainTransfer,
  longMusicReport,
  startupReport,
  mixReport,
  floodReport,
  stealReport,
  duckReport,
  pumpReport,
  dynamicsTrial,
  variantReport,
  tuningOf,
  notesOf,
  snapshot: () => snapshot(audio),
  listen: (ms: number) => listen(audio, ms),
  rec: { start: () => recStart(audio), stop: recStop, files: recFiles },
  probe: { start: probeStart, stop: probeStop },
  stall,
  setHidden,
};

export type AudioLab = typeof lab;

(window as unknown as { __audioLab: AudioLab }).__audioLab = lab;
mount(audio);
