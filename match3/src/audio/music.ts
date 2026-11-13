/**
 * Generative music player. Turns the composer's bars (phrase.ts), timed by the transport
 * (transport.ts), into sound on any BaseAudioContext:
 *
 *   lead  — plucked double string (voices.ts), through a body EQ and a soft tempo echo
 *   pad   — a quiet drone of triangle/sine tones that swell in and out under the lead
 *   perc  — synthesised hand drum: dum, tek, ka and a shaker tick
 *
 * The player only schedules; the caller decides when ({@link MusicPlayer.schedule} from a
 * timer when live, once up front when rendering offline).
 */
import type { MusicTrack } from './types.ts';
import { createComposer } from './phrase.ts';
import { midiToFreq } from './scale.ts';
import { Transport, type MusicEvent, type TransportStats } from './transport.ts';
import { Voice, dum, ka, killVoices, pluck, shake, tek, type VoiceGroup } from './voices.ts';

export interface MusicLayers {
  lead?: boolean;
  pad?: boolean;
  perc?: boolean;
}

export interface MusicPlayerOptions {
  /** Same seed ⇒ same music. */
  seed?: number;
  /** Context time of the first bar (default: now + 0.06 s). */
  startAt?: number;
  /** Fade-in time in seconds (default 0.6). */
  fadeIn?: number;
  /** Mute layers (for measurement). */
  layers?: MusicLayers;
  /** Called for every event that is scheduled (for measurement). */
  onEvent?: (ev: MusicEvent) => void;
}

export interface MusicPlayer {
  readonly track: MusicTrack;
  /** The player's own output gain (fades), connected to the destination passed in. */
  readonly output: GainNode;
  readonly barDuration: number;
  /** Schedule every event that starts before context time `until`. Returns how many were scheduled. */
  schedule(until: number): number;
  /** Fade out over `fade` seconds starting at `at`; nothing more is scheduled. */
  stop(at: number, fade: number): void;
  /** Disconnect at once and stop every note that is still sounding or scheduled. */
  dispose(): void;
  /** Voices (notes, drum hits, drone chords) that are scheduled or sounding. */
  liveVoices(): number;
  stats(): TransportStats;
}

/** Relative layer levels inside the music mix. */
export const MUSIC_MIX = { lead: 0.45, pad: 0.075, perc: 1, echo: 0.2 };

export function createMusicPlayer(
  ctx: BaseAudioContext,
  dest: AudioNode,
  track: MusicTrack,
  options: MusicPlayerOptions = {},
): MusicPlayer {
  const seed = options.seed === undefined ? 1 : options.seed >>> 0;
  const startAt = options.startAt === undefined ? ctx.currentTime + 0.06 : options.startAt;
  const fadeIn = options.fadeIn === undefined ? 0.6 : Math.max(0, options.fadeIn);
  const layers = options.layers || {};
  const composer = createComposer(track, seed);
  const transport = new Transport(composer, startAt, seed);
  let stopped = false;
  let disposed = false;

  // ── buses ──
  const output = ctx.createGain();
  const trackGain = composer.style.gain;
  if (fadeIn > 0) {
    output.gain.value = 0;
    output.gain.setValueAtTime(0, startAt);
    output.gain.linearRampToValueAtTime(trackGain, startAt + fadeIn);
  } else {
    output.gain.value = trackGain;
  }
  output.connect(dest);

  // Lead: body resonance, a gentle top roll-off, and an echo three sixteenths behind.
  const leadBus = ctx.createGain();
  leadBus.gain.value = MUSIC_MIX.lead;
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 260;
  body.Q.value = 1;
  body.gain.value = 3.5;
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = 5200;
  top.Q.value = 0.5;
  leadBus.connect(body);
  body.connect(top);
  top.connect(output);
  const echoSend = ctx.createGain();
  echoSend.gain.value = MUSIC_MIX.echo;
  const echo = ctx.createDelay(1);
  echo.delayTime.value = Math.min(0.9, transport.stepDur * 3);
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2200;
  echoTone.Q.value = 0.5;
  const echoBack = ctx.createGain();
  echoBack.gain.value = 0.3;
  top.connect(echoSend);
  echoSend.connect(echo);
  echo.connect(echoTone);
  echoTone.connect(output);
  echoTone.connect(echoBack);
  echoBack.connect(echo);

  const padBus = ctx.createGain();
  padBus.gain.value = MUSIC_MIX.pad;
  const padTone = ctx.createBiquadFilter();
  padTone.type = 'lowpass';
  padTone.frequency.value = 1200;
  padTone.Q.value = 0.6;
  padBus.connect(padTone);
  padTone.connect(output);

  const percBus = ctx.createGain();
  percBus.gain.value = MUSIC_MIX.perc;
  percBus.connect(output);

  const busNodes: AudioNode[] = [leadBus, body, top, echoSend, echo, echoTone, echoBack, padBus, padTone, percBus, output];

  // ── voices ──
  // Every voice of this player, so that dispose() can stop them: a drone chord lasts for
  // seconds and would otherwise keep running, unheard, after the player is gone.
  const voices: VoiceGroup = new Set<Voice>();
  let strokes = 0;
  function playLead(ev: Extract<MusicEvent, { layer: 'lead' }>): void {
    const v = new Voice(ctx, leadBus, ev.time, 1, voices);
    // The melody is played as on one string: a note is stopped as the next one begins, with
    // a short overlap. The open low string is left to ring.
    const ring = ev.kind === 'bass' ? ev.dur + 0.5 : ev.kind === 'grace' ? ev.dur + 0.03 : ev.dur + 0.07;
    // Tremolo alternates two takes of the note, like down- and up-strokes of the plectrum.
    const alt = ev.kind === 'trem' && (strokes++ & 1) === 1;
    pluck(v, { midi: ev.midi, dur: ring, peak: ev.vel * (ev.kind === 'bass' ? 0.85 : 1), alt, cents: alt ? 3 : 0 });
  }

  function playPerc(ev: Extract<MusicEvent, { layer: 'perc' }>): void {
    const v = new Voice(ctx, percBus, ev.time, 1, voices);
    if (ev.hit === 'dum') dum(v, 0, 0.44 * ev.vel);
    else if (ev.hit === 'tek') tek(v, 0, 0.34 * ev.vel);
    else if (ev.hit === 'ka') ka(v, 0, 0.3 * ev.vel);
    else shake(v, 0, 0.22 * ev.vel);
  }

  function playPad(ev: Extract<MusicEvent, { layer: 'pad' }>): void {
    // Each chord swells in, holds, and overlaps the next one while it fades.
    const attack = 1.1;
    const release = 1.6;
    const hold = Math.max(0.2, ev.dur - attack + 0.4);
    const t = ev.time;
    const end = t + attack + hold + release;
    const v = new Voice(ctx, padBus, t, 1, voices);
    for (let i = 0; i < ev.midis.length; i++) {
      const f = midiToFreq(ev.midis[i]);
      // Lower tones carry the weight; the upper ones are softer and purer, but they are what
      // a phone speaker can actually reproduce, so they are not left too faint.
      const level = (i === 0 ? 0.42 : i === 1 ? 0.34 : i === 2 ? 0.3 : i === 3 ? 0.22 : 0.15) * ev.vel;
      const g = v.keep(ctx.createGain());
      g.gain.value = 0;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + attack);
      g.gain.setValueAtTime(level, t + attack + hold);
      g.gain.linearRampToValueAtTime(0, end);
      g.connect(v.out);
      const osc = ctx.createOscillator();
      osc.type = i < 3 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      osc.detune.value = i % 2 === 0 ? -4 : 5;
      osc.connect(g);
      v.run(osc, t, end + 0.02);
      if (i === 0) {
        // A second, slightly sharp root makes the drone breathe.
        const twin = ctx.createOscillator();
        twin.type = 'sine';
        twin.frequency.value = f * 2;
        twin.detune.value = 2;
        const tg = v.keep(ctx.createGain());
        tg.gain.value = 0;
        tg.gain.setValueAtTime(0, t);
        tg.gain.linearRampToValueAtTime(level * 0.35, t + attack);
        tg.gain.setValueAtTime(level * 0.35, t + attack + hold);
        tg.gain.linearRampToValueAtTime(0, end);
        twin.connect(tg);
        tg.connect(v.out);
        v.run(twin, t, end + 0.02);
      }
    }
  }

  return {
    track,
    output,
    barDuration: transport.barDur,
    schedule(until: number): number {
      if (stopped || disposed) return 0;
      const events = transport.collect(ctx.currentTime, until);
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.layer === 'lead') {
          if (layers.lead !== false) playLead(ev);
        } else if (ev.layer === 'perc') {
          if (layers.perc !== false) playPerc(ev);
        } else if (layers.pad !== false) {
          playPad(ev);
        }
        if (options.onEvent) options.onEvent(ev);
      }
      return events.length;
    },
    stop(at: number, fade: number): void {
      if (stopped) return;
      stopped = true;
      const g = output.gain;
      if (typeof g.cancelAndHoldAtTime === 'function') {
        g.cancelAndHoldAtTime(at);
      } else {
        const from = g.value;
        g.cancelScheduledValues(at);
        g.setValueAtTime(from, at);
      }
      g.linearRampToValueAtTime(0, at + Math.max(0.01, fade));
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopped = true;
      killVoices(voices);
      for (let i = 0; i < busNodes.length; i++) {
        try {
          busNodes[i].disconnect();
        } catch {
          /* already disconnected */
        }
      }
    },
    stats(): TransportStats {
      return transport.stats;
    },
    liveVoices(): number {
      return voices.size;
    },
  };
}
