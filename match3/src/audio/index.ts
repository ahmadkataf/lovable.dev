/**
 * Audio engine: every sound of the game, synthesised at runtime with the Web Audio API.
 * No audio files, no samples. See docs/DESIGN.md §4 and ./types.ts for the contract.
 *
 *   createAudio()            the AudioApi used by the game
 *   renderSfx(), createMusicPlayer(), createOutputChain()
 *                            the same synthesis against any BaseAudioContext, which is how
 *                            tools/audio-check.cjs renders and measures every sound offline
 *
 * Importing this module touches neither the DOM nor an AudioContext, so it loads under Node.
 */
import type { AudioApi, MusicTrack, SfxName, SfxOptions } from './types.ts';
import { SfxGate } from './limiter.ts';
import { createMusicPlayer, type MusicPlayer } from './music.ts';
import { LEVELS, createOutputChain, type OutputChain } from './output.ts';
import { isPrioritySfx, renderSfx, sfxKey } from './sfx.ts';
import { BASE_LOOKAHEAD, lookaheadFor, type TransportStats } from './transport.ts';

export type { AudioApi, MusicTrack, SfxName, SfxOptions } from './types.ts';
export { SFX_NAMES, SFX_STEPS, isPrioritySfx, renderSfx, sfxClass, sfxKey, type SfxClass } from './sfx.ts';
export { MUSIC_MIX, createMusicPlayer, type MusicLayers, type MusicPlayer, type MusicPlayerOptions } from './music.ts';
export { GUARD_CEILING, GUARD_KNEE, LEVELS, createOutputChain, guardCurve, type OutputChain } from './output.ts';
export { SFX_MAX_VOICES, SFX_MIN_INTERVAL, SFX_PRIORITY_EXTRA, SfxGate, type SfxGateOptions } from './limiter.ts';
export { BASE_LOOKAHEAD, MAX_LOOKAHEAD, Transport, lookaheadFor, type MusicEvent, type TransportStats } from './transport.ts';
export { TRACK_STYLES, createComposer, type Bar, type Composer, type LeadNote, type PercHit, type TrackStyle } from './phrase.ts';
export {
  HIJAZ,
  MATCH_DEGREES,
  MATCH_MAX_STEP,
  TONIC_MIDI,
  degreeToMidi,
  isHijazPitch,
  matchStepFreq,
  matchStepMidi,
  midiToFreq,
  starStepMidi,
} from './scale.ts';

/** Scheduler timer period (ms). */
export const TICK_MS = 25;
/** Cross-fade between music tracks, and the music fade when it is switched on or off (s). */
export const CROSSFADE = 0.6;

/** A new track begins this far ahead of "now" (s). */
const START_DELAY = 0.06;
/** Effects start this far ahead of "now" so their attack is never clipped by a late render (s). */
const SFX_DELAY = 0.005;
/** Effects fired while the context is still starting are queued for at most this long (ms). */
const PENDING_WINDOW_MS = 400;

export interface AudioOptions {
  /** Seed of the generative music (default: varies per session). */
  seed?: number;
  /**
   * Also unlock on the first user gesture anywhere on the page (default true). The game still
   * calls unlock() itself; this is a safety net so sound never depends on one particular tap.
   */
  autoUnlock?: boolean;
  /** Supplies the context (tests). */
  createContext?: () => AudioContext;
}

export interface AudioDebugInfo {
  /** 'none' until a context exists, then the context's state. */
  state: string;
  unlocked: boolean;
  suspended: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  /** Track asked for by the game. */
  track: MusicTrack | null;
  /** Track that is actually being scheduled right now. */
  playing: MusicTrack | null;
  schedulerRunning: boolean;
  /** Effect voices sounding now / the cap. */
  voices: number;
  maxVoices: number;
  sfxPlayed: number;
  sfxDropped: number;
  music: TransportStats | null;
  context: AudioContext | null;
  /** Final node of the output chain (for meters). */
  output: AudioNode | null;
}

/** The game-facing API plus inspection hooks for the lab page and tests. */
export interface AudioEngine extends AudioApi {
  debug(): AudioDebugInfo;
  /** Stop everything and release the context. */
  dispose(): void;
}

type Timer = ReturnType<typeof setTimeout>;

const GESTURES = ['pointerup', 'touchend', 'mousedown', 'keydown', 'click'];

export function createAudio(options: AudioOptions = {}): AudioEngine {
  let ctx: AudioContext | null = null;
  let chain: OutputChain | null = null;
  let unlocked = false;
  let appSuspended = false;
  let disposed = false;
  let sfxOn = true;
  let musicOn = true;
  let wanted: MusicTrack | null = null;
  let player: MusicPlayer | null = null;
  const fading: { player: MusicPlayer; timer: Timer }[] = [];
  let ticker: Timer | null = null;
  let lastTick = 0;
  let musicStarts = 0;
  let sfxPlayed = 0;
  let sfxDropped = 0;
  let resumeAskedAt = 0;
  let pendingSince = 0;
  let listening = false;
  const gate = new SfxGate();
  const baseSeed = options.seed === undefined ? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0 : options.seed >>> 0;

  function wall(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }

  function stateOf(): string {
    return ctx ? (ctx.state as string) : 'none';
  }

  function makeContext(): AudioContext | null {
    try {
      if (options.createContext) return options.createContext();
      if (typeof window === 'undefined') return null;
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext || w.webkitAudioContext;
      return Ctor ? new Ctor() : null;
    } catch {
      return null;
    }
  }

  function ensureContext(): boolean {
    if (ctx && stateOf() !== 'closed') return true;
    dropPlayers();
    const made = makeContext();
    if (!made) {
      ctx = null;
      chain = null;
      return false;
    }
    try {
      chain = createOutputChain(made);
    } catch {
      ctx = null;
      chain = null;
      return false;
    }
    ctx = made;
    gate.reset();
    try {
      made.onstatechange = onState;
    } catch {
      /* not supported: state is re-checked on every call instead */
    }
    return true;
  }

  /** The context only runs while there is something it could play. */
  function shouldRun(): boolean {
    return unlocked && !appSuspended && !disposed && (sfxOn || musicOn);
  }

  function tryResume(): void {
    if (!ctx) return;
    resumeAskedAt = wall();
    try {
      const p = ctx.resume();
      if (p && typeof p.then === 'function') {
        p.then(
          () => {
            if (stateOf() === 'running') onState();
          },
          () => undefined,
        );
      }
    } catch {
      /* stays suspended until the next gesture */
    }
  }

  function trySuspend(): void {
    if (!ctx) return;
    try {
      const p = ctx.suspend();
      if (p && typeof p.then === 'function') p.then(undefined, () => undefined);
    } catch {
      /* nothing to do */
    }
  }

  function onState(): void {
    if (disposed || !ctx) return;
    if (stateOf() === 'running') {
      // Effects queued while the context was starting are stale if that took long: drop them.
      if (pendingSince && wall() - pendingSince > PENDING_WINDOW_MS) cutSfx(true);
      pendingSince = 0;
      unlisten();
    }
    sync();
  }

  /** Bring the context and the music in line with what the game currently wants. */
  function sync(): void {
    if (disposed || !ctx) return;
    const st = stateOf();
    if (st === 'closed') return;
    if (shouldRun()) {
      if (st !== 'running') tryResume();
    } else if (st === 'running') {
      trySuspend();
    }
    syncMusic();
  }

  function syncMusic(): void {
    if (!ctx || !chain) return;
    const target = musicOn && unlocked && !appSuspended && stateOf() === 'running' ? wanted : null;
    const current = player ? player.track : null;
    if (target !== current) {
      const now = ctx.currentTime;
      if (player) {
        retire(player, now);
        player = null;
      }
      if (target) {
        const seed = (baseSeed + musicStarts * 7919) >>> 0;
        musicStarts++;
        player = createMusicPlayer(ctx, chain.musicBus, target, { seed, startAt: now + START_DELAY, fadeIn: CROSSFADE });
        lastTick = 0;
        player.schedule(now + START_DELAY + BASE_LOOKAHEAD);
      }
    }
    updateTicker();
  }

  /** Fade a player out and disconnect it once it is silent. */
  function retire(old: MusicPlayer, now: number): void {
    try {
      old.stop(now, CROSSFADE);
    } catch {
      /* disposed below regardless */
    }
    const entry = {
      player: old,
      timer: setTimeout(
        () => {
          old.dispose();
          const i = fading.indexOf(entry);
          if (i >= 0) fading.splice(i, 1);
        },
        (CROSSFADE + 0.15) * 1000,
      ),
    };
    fading.push(entry);
  }

  /** Disconnect all music at once (no fade). */
  function dropPlayers(): void {
    if (player) {
      player.dispose();
      player = null;
    }
    while (fading.length > 0) {
      const entry = fading.pop() as { player: MusicPlayer; timer: Timer };
      clearTimeout(entry.timer);
      entry.player.dispose();
    }
    updateTicker();
  }

  function updateTicker(): void {
    if (player && ticker === null) {
      ticker = setInterval(tick, TICK_MS);
      // Under Node (tests) the scheduler must not keep the process alive.
      const t = ticker as unknown as { unref?: () => void };
      if (typeof t.unref === 'function') t.unref();
    } else if (!player && ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function tick(): void {
    if (!ctx || !player) return;
    const w = wall();
    const gap = lastTick ? (w - lastTick) / 1000 : 0;
    lastTick = w;
    if (stateOf() !== 'running') return;
    try {
      player.schedule(ctx.currentTime + lookaheadFor(gap));
    } catch {
      /* a failed tick must not stop the timer */
    }
  }

  /** Silence every effect that is sounding by swapping in a fresh effects bus. */
  function cutSfx(immediately: boolean): void {
    gate.reset();
    if (!ctx || !chain) return;
    const old = chain.sfxBus;
    const fresh = ctx.createGain();
    fresh.gain.value = LEVELS.sfx;
    fresh.connect(chain.master);
    chain.sfxBus = fresh;
    if (immediately) {
      old.disconnect();
      return;
    }
    const t = ctx.currentTime;
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + 0.02);
    setTimeout(() => {
      try {
        old.disconnect();
      } catch {
        /* already gone */
      }
    }, 80);
  }

  function gesture(): void {
    api.unlock();
  }

  function listen(): void {
    if (listening || options.autoUnlock === false) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    listening = true;
    for (let i = 0; i < GESTURES.length; i++) window.addEventListener(GESTURES[i], gesture, true);
  }

  function unlisten(): void {
    if (!listening) return;
    listening = false;
    for (let i = 0; i < GESTURES.length; i++) window.removeEventListener(GESTURES[i], gesture, true);
  }

  const api: AudioEngine = {
    unlock(): void {
      try {
        if (disposed || !ensureContext()) return;
        unlocked = true;
        sync();
        if (stateOf() === 'running') unlisten();
      } catch {
        /* audio must never break the game */
      }
    },

    setSfxEnabled(on: boolean): void {
      try {
        sfxOn = !!on;
        if (!sfxOn) cutSfx(false);
        sync();
      } catch {
        /* ignore */
      }
    },

    setMusicEnabled(on: boolean): void {
      try {
        musicOn = !!on;
        sync();
      } catch {
        /* ignore */
      }
    },

    sfx(name: SfxName, opts?: SfxOptions): void {
      try {
        if (disposed || !sfxOn || appSuspended || !unlocked || !ctx || !chain) return;
        const st = stateOf();
        if (st === 'closed') return;
        if (st !== 'running') {
          // unlock() was called a moment ago and the context is still starting: queue the
          // effect on its (frozen) clock so the tap that unlocked audio is heard too.
          const w = wall();
          if (!resumeAskedAt || w - resumeAskedAt > PENDING_WINDOW_MS) return;
          if (!pendingSince) pendingSince = w;
        }
        const now = ctx.currentTime;
        if (!gate.admit(sfxKey(name, opts), now, isPrioritySfx(name))) {
          sfxDropped++;
          return;
        }
        const dur = renderSfx(ctx, chain.sfxBus, name, now + SFX_DELAY, opts);
        if (dur > 0) {
          gate.register(now + SFX_DELAY + dur);
          sfxPlayed++;
        }
      } catch {
        /* audio must never break the game */
      }
    },

    music(track: MusicTrack | null): void {
      try {
        wanted = track === 'menu' || track === 'level' ? track : null;
        sync();
      } catch {
        /* ignore */
      }
    },

    suspend(): void {
      try {
        appSuspended = true;
        dropPlayers();
        cutSfx(true);
        sync();
      } catch {
        /* ignore */
      }
    },

    resume(): void {
      try {
        appSuspended = false;
        sync();
      } catch {
        /* ignore */
      }
    },

    debug(): AudioDebugInfo {
      const stats = player ? player.stats() : null;
      return {
        state: stateOf(),
        unlocked,
        suspended: appSuspended,
        sfxEnabled: sfxOn,
        musicEnabled: musicOn,
        track: wanted,
        playing: player ? player.track : null,
        schedulerRunning: ticker !== null,
        voices: ctx ? gate.active(ctx.currentTime) : 0,
        maxVoices: gate.maxVoices + gate.priorityExtra,
        sfxPlayed,
        sfxDropped,
        music: stats ? { bars: stats.bars, events: stats.events, dropped: stats.dropped, resyncs: stats.resyncs } : null,
        context: ctx,
        output: chain ? chain.output : null,
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      unlisten();
      try {
        dropPlayers();
        if (ctx) {
          ctx.onstatechange = null;
          if (stateOf() !== 'closed') {
            const p = ctx.close();
            if (p && typeof p.then === 'function') p.then(undefined, () => undefined);
          }
        }
      } catch {
        /* ignore */
      }
      ctx = null;
      chain = null;
    },
  };

  listen();
  return api;
}
