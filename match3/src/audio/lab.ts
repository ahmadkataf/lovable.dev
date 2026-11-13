/**
 * Audio lab — DEV ONLY (loaded by /audio-lab.html, never by the game).
 *
 * A button for every sound effect and music track, the engine's controls, and an offline
 * renderer that measures any sound and draws its spectrogram. tools/audio-check.cjs drives
 * this page through `window.__audioLab` to verify the whole audio module without ears.
 */
import {
  SFX_NAMES,
  SFX_STEPS,
  createAudio,
  createMusicPlayer,
  createOutputChain,
  lookaheadFor,
  matchStepFreq,
  midiToFreq,
  renderSfx,
  sfxClass,
  starStepMidi,
  voiceCensus,
  type AudioEngine,
  type MusicEvent,
  type MusicTrack,
  type OutputChain,
  type SfxName,
} from './index.ts';
import {
  analyze,
  detectOnsets,
  encodeWav,
  hardCutLevel,
  longestSilence,
  loudnessStats,
  maxStep,
  rmsTrack,
  sliceRmsDb,
  spectrogram,
  toDb,
  type LoudnessStats,
  type Metrics,
} from './analysis.ts';

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
}

export interface SoundReport {
  id: string;
  kind: 'sfx' | 'music' | 'storm';
  cls: string;
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
}

// ───────────────────────────── offline rendering ─────────────────────────────

async function renderOffline(seconds: number, build: (ctx: OfflineAudioContext, chain: OutputChain) => void): Promise<Float32Array> {
  const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
  const Ctor = w.OfflineAudioContext || w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext is not available');
  const ctx = new Ctor(1, Math.ceil(seconds * SR), SR);
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
    if (steps) {
      for (let k = 0; k < steps.length; k++) out.push({ id: name + '-' + steps[k], name, step: steps[k], cls: sfxClass(name) });
    } else {
      out.push({ id: name, name, cls: sfxClass(name) });
    }
  }
  return out;
}

async function sfxReport(name: SfxName, step?: number): Promise<SoundReport> {
  let nominal = 0;
  const full = await renderOffline(START + 3, (ctx, chain) => {
    nominal = renderSfx(ctx, chain.sfxBus, name, START, step === undefined ? undefined : { step });
  });
  const data = full.subarray(Math.floor((START - LEAD_IN) * SR));
  // The limiter delays its input by a few milliseconds; allow for that when cutting the tail.
  const cut = Math.min(data.length, Math.ceil((LEAD_IN + nominal + 0.03) * SR));
  let tailPeak = 0;
  for (let i = cut; i < data.length; i++) if (Math.abs(data[i]) > tailPeak) tailPeak = Math.abs(data[i]);
  const shown = data.subarray(0, Math.min(data.length, cut + Math.ceil(0.1 * SR)));
  const id = step === undefined ? name : name + '-' + step;
  const canvas = drawSpectrogram(shown, id + '  (' + nominal.toFixed(3) + ' s)', false);
  return {
    id,
    kind: 'sfx',
    cls: sfxClass(name),
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
  track: MusicTrack,
  seconds: number,
  seed: number,
  tick: number,
  layers?: { lead: boolean; pad: boolean; perc: boolean },
): Promise<SteppedMusic> {
  const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
  const Ctor = w.OfflineAudioContext || w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext is not available');
  const total = seconds + MUSIC_TAIL;
  const ctx = new Ctor(1, Math.ceil(total * SR), SR);
  const chain = createOutputChain(ctx);
  const events: MusicEvent[] = [];
  const player = createMusicPlayer(ctx, chain.musicBus, track, { seed, startAt: MUSIC_START, layers, onEvent: (e) => events.push(e) });
  const lookahead = lookaheadFor(tick);
  player.schedule(Math.min(seconds, MUSIC_START + lookahead));
  let maxVoices = 0;
  let maxNodes = 0;
  let firstMinuteNodes = 0;
  let lastMinuteNodes = 0;
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
        if (now < seconds) player.schedule(Math.min(seconds, now + lookahead));
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
  const st = player.stats();
  return {
    data: buffer.getChannelData(0).slice(0, Math.floor(seconds * SR)),
    events,
    barDuration: player.barDuration,
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
    createMusicPlayer(ctx, chain.musicBus, 'level', { seed: 7, startAt: 0.05 }).schedule(seconds);
    const all = variants();
    for (let i = 0; i < all.length; i++) {
      renderSfx(ctx, chain.sfxBus, all[i].name, 1, all[i].step === undefined ? undefined : { step: all[i].step });
      count++;
    }
    const heavy: SfxName[] = ['bigCombo', 'nova', 'beam', 'prism', 'stoneBreak', 'win'];
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

  const canvas = drawSpectrogram(data, 'music-' + track + '-long  (' + seconds + ' s, seed ' + seed + ', scheduled every ' + tick * 1000 + ' ms)', true);
  return {
    track,
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
  }
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
 * starts crowded into one instant are a burst.
 */
export interface ProbeReport {
  starts: number;
  /** Starts scheduled more than 5 ms in the past. */
  late: number;
  /** Smallest (start time − clock) seen, s. */
  worstLead: number;
  /** Start times (context seconds), in call order. */
  when: number[];
  /** Audio clock at each call. */
  at: number[];
}

let probeLog: { when: number; at: number }[] | null = null;
let probeInstalled = false;

function probeInstall(): void {
  if (probeInstalled) return;
  probeInstalled = true;
  const patch = (proto: { start: (...a: number[]) => void } | undefined): void => {
    if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'start')) return;
    const original = proto.start;
    proto.start = function (this: AudioScheduledSourceNode, ...a: number[]): void {
      const log = probeLog;
      const engineCtx = audio.debug().context;
      if (log && engineCtx && this.context === engineCtx) {
        const now = engineCtx.currentTime;
        log.push({ when: a.length > 0 && typeof a[0] === 'number' ? a[0] : now, at: now });
      }
      return original.apply(this, a);
    };
  };
  const w = window as unknown as { [name: string]: { prototype: { start: (...a: number[]) => void } } | undefined };
  for (const name of ['AudioScheduledSourceNode', 'AudioBufferSourceNode', 'OscillatorNode', 'ConstantSourceNode']) {
    const C = w[name];
    patch(C ? C.prototype : undefined);
  }
}

function probeStart(): void {
  probeInstall();
  probeLog = [];
}

function probeStop(): ProbeReport {
  const log = probeLog || [];
  probeLog = null;
  let late = 0;
  let worst = Infinity;
  for (let i = 0; i < log.length; i++) {
    const lead = log[i].when - log[i].at;
    if (lead < worst) worst = lead;
    if (lead < -0.005) late++;
  }
  return { starts: log.length, late, worstLead: log.length ? worst : 0, when: log.map((x) => x.when), at: log.map((x) => x.at) };
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
      for (let i = 0; i < 200; i++) audio.sfx(SFX_NAMES[i % SFX_NAMES.length], { step: 1 + (i % 11) });
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
  const stepInput = slider('step', 'step', 1, 12, 1, 1);
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
      '\neffects ' + (d.sfxEnabled ? 'on' : 'off') + ' · voices ' + d.voices + '/' + d.maxVoices + ' · played ' + d.sfxPlayed + ' · dropped ' + d.sfxDropped;
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
    sfxPlayed: d.sfxPlayed,
    sfxDropped: d.sfxDropped,
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

/** Frequencies the stepped effects are designed to sound (Hz). */
function expected(): { match: number[]; star: number[] } {
  const match: number[] = [];
  const steps = SFX_STEPS.match || [];
  for (let i = 0; i < steps.length; i++) match.push(matchStepFreq(steps[i]));
  return { match, star: [1, 2, 3].map((s) => midiToFreq(starStepMidi(s))) };
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
