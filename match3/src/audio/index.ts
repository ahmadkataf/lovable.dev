/**
 * Audio engine: every sound of the game, synthesised at runtime with the Web Audio API.
 * No audio files, no samples. See docs/DESIGN.md §4 and ./types.ts for the contract.
 *
 *   createAudio()            the AudioApi used by the game
 *   renderSfx(), createMusicPlayer(), createOutputChain()
 *                            the same synthesis against any BaseAudioContext, which is how
 *                            tools/audio-check.cjs renders and measures every sound offline
 *
 * Using it from the app shell:
 *   const audio = createAudio();
 *   audio.setSfxEnabled(...); audio.setMusicEnabled(...);   // from the saved settings
 *   audio.music('menu');                                     // may be asked before unlocking
 *   audio.unlock();                                          // from any tap handler; the
 *                                                            // engine also unlocks itself on
 *                                                            // the first gesture on the page
 *   platform.onPause(() => audio.suspend());                 // app hidden: silence at once
 *   platform.onResume(() => audio.resume());                 // shown again: music returns
 * The engine also pauses by itself while the page is hidden (visibilitychange), so music can
 * never play on in the background even if the shell's pause hook does not fire.
 * No call ever throws; without Web Audio everything is a silent no-op.
 *
 * Importing this module touches neither the DOM nor an AudioContext, so it loads under Node.
 */
import type { AudioApi, MusicTrack, SfxName, SfxOptions } from './types.ts';
import { SfxGate } from './limiter.ts';
import { createMusicPlayer, type MusicPlayer } from './music.ts';
import { LEVELS, createOutputChain, type OutputChain } from './output.ts';
import { isPrioritySfx, isSfxName, renderSfx, sfxClass, sfxKey } from './sfx.ts';
import { BASE_LOOKAHEAD, lookaheadFor, type TransportStats } from './transport.ts';
import { LEAD_MIDI, killVoices, pluckBuffer, voiceCensus, type Voice, type VoiceGroup } from './voices.ts';

export type { AudioApi, MusicTrack, SfxName, SfxOptions } from './types.ts';
export { SFX_NAMES, SFX_STEPS, isPrioritySfx, isSfxName, renderSfx, sfxClass, sfxKey, type SfxClass } from './sfx.ts';
export { MUSIC_MIX, createMusicPlayer, type MusicLayers, type MusicPlayer, type MusicPlayerOptions } from './music.ts';
export {
  GUARD_CEILING,
  GUARD_KNEE,
  LEVELS,
  LIMITER_MAKEUP,
  STARTUP_BYPASS,
  STARTUP_FADE,
  createOutputChain,
  guardCurve,
  type OutputChain,
} from './output.ts';
export { voiceCensus, type VoiceCensus } from './voices.ts';
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
/**
 * Seed of the first menu music of a session: the same opening every time the game is
 * launched gives it a tune of its own. Later starts move on to fresh material.
 */
export const MENU_SIGNATURE_SEED = 13;
/** While a jingle (win, lose, reward …) plays, the music bus drops to this share of its level. */
const JINGLE_DUCK = 0.4;
/** Pause between two plucked-string buffers synthesised in the background (ms). */
const WARMUP_GAP_MS = 60;
/** A ctx.suspend() is given this long (ms) to settle before it is assumed not to have happened. */
const SUSPEND_SETTLE_MS = 1000;
/**
 * With effects and music both switched off the context is put to sleep — but only after this
 * long (ms), so the music's fade-out and the effects' cut-off ramp are heard to the end
 * instead of being chopped by the suspension.
 */
export const IDLE_SUSPEND_MS = Math.round((CROSSFADE + 0.25) * 1000);

export interface AudioOptions {
  /**
   * Seed of the generative music. Default: the menu opens with its signature phrase, and
   * everything after that varies from session to session.
   */
  seed?: number;
  /**
   * Also unlock on the first user gesture anywhere on the page (default true). The game still
   * calls unlock() itself; this is a safety net so sound never depends on one particular tap.
   */
  autoUnlock?: boolean;
  /**
   * Also pause while the page is hidden and come back when it is shown (default true), in
   * addition to suspend()/resume(). A safety net: music must never play on in the background.
   */
  autoPause?: boolean;
  /** Supplies the context (tests). */
  createContext?: () => AudioContext;
}

export interface AudioDebugInfo {
  /** 'none' until a context exists, then the context's state. */
  state: string;
  unlocked: boolean;
  /** suspend() is in effect. */
  suspended: boolean;
  /** The page is hidden (and autoPause is on), which pauses just like suspend(). */
  hidden: boolean;
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
  /** Current gain of the music bus (it dips while a jingle plays). */
  musicLevel: number;
  /** Old music players that are still fading out. */
  fading: number;
  /** Voices (effects, notes, drum hits, drone chords) alive on the context, and their nodes. */
  liveVoices: number;
  liveNodes: number;
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
  let pageHidden = false;
  let disposed = false;
  let sfxOn = true;
  let musicOn = true;
  let wanted: MusicTrack | null = null;
  let player: MusicPlayer | null = null;
  const fading: { player: MusicPlayer; timer: Timer }[] = [];
  let ticker: Timer | null = null;
  let lastTick = -1;
  let musicStarts = 0;
  let menuPlayed = false;
  let sfxPlayed = 0;
  let sfxDropped = 0;
  let resumeAskedAt = -1;
  let pendingSince = -1;
  let listening = false;
  let watching = false;
  let warmup: Timer | null = null;
  let idleTimer: Timer | null = null;
  /** A ctx.suspend() has been asked for and has not settled yet (and when it was asked, ms). */
  let suspending = false;
  let suspendAskedAt = 0;
  /** Context time until which the music is held down for a jingle. */
  let duckEnd = 0;
  const gate = new SfxGate();
  /** Effect voices that are scheduled or sounding, so that a cut really stops them. */
  let sfxVoices: VoiceGroup = new Set<Voice>();
  const baseSeed = options.seed === undefined ? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0 : options.seed >>> 0;

  function wall(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  }

  function stateOf(): string {
    return ctx ? (ctx.state as string) : 'none';
  }

  /** Running, and not about to stop: the only state in which anything is scheduled. */
  function live(): boolean {
    // A suspend() that neither settles nor changes the state within a second did not happen.
    if (suspending && wall() - suspendAskedAt > SUSPEND_SETTLE_MS) suspending = false;
    return stateOf() === 'running' && !suspending;
  }

  /** The app is in the background (told by the shell, or seen from the page's visibility). */
  function paused(): boolean {
    return appSuspended || pageHidden;
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
    killVoices(sfxVoices);
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
      try {
        const p = made.close();
        if (p && typeof p.then === 'function') p.then(undefined, () => undefined);
      } catch {
        /* nothing more to do with it */
      }
      return false;
    }
    ctx = made;
    suspending = false;
    duckEnd = 0;
    pendingSince = -1;
    gate.reset();
    try {
      made.onstatechange = onState;
    } catch {
      /* not supported: state is re-checked on every call instead */
    }
    warmUp(made, 0);
    return true;
  }

  /** Synthesise the lead's string buffers one by one, between frames. */
  function warmUp(target: AudioContext, index: number): void {
    if (warmup !== null) clearTimeout(warmup);
    warmup = null;
    if (index >= LEAD_MIDI.length) return;
    warmup = background(
      setTimeout(() => {
        warmup = null;
        if (disposed || ctx !== target) return;
        try {
          pluckBuffer(target, LEAD_MIDI[index]);
        } catch {
          return;
        }
        warmUp(target, index + 1);
      }, WARMUP_GAP_MS),
    );
  }

  /** The context only runs while there is something it could play. */
  function shouldRun(): boolean {
    return unlocked && !paused() && !disposed && (sfxOn || musicOn);
  }

  function tryResume(): void {
    if (!ctx) return;
    resumeAskedAt = wall();
    const target = ctx;
    try {
      const p = target.resume();
      if (p && typeof p.then === 'function') {
        p.then(
          () => {
            if (ctx === target && stateOf() === 'running') onState();
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
    const target = ctx;
    suspending = true;
    suspendAskedAt = wall();
    const settled = (): void => {
      if (ctx !== target || !suspending) return;
      suspending = false;
      onState();
    };
    try {
      const p = target.suspend();
      if (p && typeof p.then === 'function') p.then(settled, settled);
      else settled();
    } catch {
      suspending = false;
    }
  }

  function cancelIdle(): void {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
  }

  function onState(): void {
    if (disposed || !ctx) return;
    const st = stateOf();
    if (st !== 'running') suspending = false;
    if (live()) {
      // Effects queued while the context was starting are stale if that took long: drop them.
      if (pendingSince >= 0 && wall() - pendingSince > PENDING_WINDOW_MS) cutSfx(true);
      pendingSince = -1;
      unlisten();
    } else if (st !== 'closed' && shouldRun()) {
      // Stopped by the system (an interruption, an autoplay rule): resume() is asked for
      // below, and in case that needs a user gesture the next tap brings the sound back.
      listen();
    }
    sync();
  }

  /** Bring the context and the music in line with what the game currently wants. */
  function sync(): void {
    if (disposed || !ctx) return;
    const st = stateOf();
    if (st === 'closed') return;
    if (shouldRun()) {
      cancelIdle();
      // A suspend() that is still in flight is overtaken by this resume().
      if (st !== 'running' || suspending) tryResume();
    } else if (live()) {
      if (paused()) {
        // Going to the background: at once.
        cancelIdle();
        trySuspend();
      } else if (idleTimer === null) {
        // Nothing left to play: sleep, but only once the fades have been heard.
        idleTimer = background(
          setTimeout(() => {
            idleTimer = null;
            if (!disposed && ctx && !shouldRun() && live()) trySuspend();
          }, IDLE_SUSPEND_MS),
        );
      }
    }
    syncMusic();
  }

  function syncMusic(): void {
    if (!ctx || !chain) return;
    const target = musicOn && unlocked && !paused() && live() ? wanted : null;
    const current = player ? player.track : null;
    if (target !== current) {
      const now = ctx.currentTime;
      if (player) {
        retire(player, now);
        player = null;
      }
      if (target) {
        let seed = (baseSeed + musicStarts * 7919) >>> 0;
        musicStarts++;
        if (target === 'menu' && !menuPlayed && options.seed === undefined) seed = MENU_SIGNATURE_SEED;
        if (target === 'menu') menuPlayed = true;
        try {
          player = createMusicPlayer(ctx, chain.musicBus, target, { seed, startAt: now + START_DELAY, fadeIn: CROSSFADE });
          lastTick = -1;
          player.schedule(now + START_DELAY + BASE_LOOKAHEAD);
        } catch {
          // A player that could not be built or started must not be left half-connected.
          if (player) player.dispose();
          player = null;
        }
      }
    }
    updateTicker();
  }

  /** Timers of this module must not keep a Node process (tests) alive. */
  function background<T extends Timer>(timer: T): T {
    const t = timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
    return timer;
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
      timer: background(
        setTimeout(
          () => {
            old.dispose();
            const i = fading.indexOf(entry);
            if (i >= 0) fading.splice(i, 1);
          },
          (CROSSFADE + 0.15) * 1000,
        ),
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
      ticker = background(setInterval(tick, TICK_MS));
    } else if (!player && ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function tick(): void {
    if (!ctx || !player) return;
    const w = wall();
    const gap = lastTick >= 0 ? (w - lastTick) / 1000 : 0;
    lastTick = w;
    if (!live()) return;
    try {
      player.schedule(ctx.currentTime + lookaheadFor(gap));
    } catch {
      /* a failed tick must not stop the timer */
    }
  }

  /**
   * Let a jingle speak: pull the music down for its length, then let it rise again. A second
   * jingle that starts meanwhile never brings the music back before the first has finished.
   */
  function duckMusic(from: number, seconds: number): void {
    if (!chain) return;
    const g = chain.musicBus.gain;
    const end = Math.max(duckEnd, from + seconds);
    duckEnd = end;
    g.cancelScheduledValues(from);
    g.setTargetAtTime(LEVELS.music * JINGLE_DUCK, from, 0.05);
    g.setTargetAtTime(LEVELS.music, end, 0.25);
  }

  /** The jingle the music was making room for is gone: bring the music back now. */
  function unduckMusic(): void {
    if (!ctx || !chain || duckEnd <= 0) return;
    duckEnd = 0;
    const g = chain.musicBus.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(LEVELS.music, now, 0.08);
  }

  /** Silence every effect that is sounding by swapping in a fresh effects bus. */
  function cutSfx(immediately: boolean): void {
    gate.reset();
    pendingSince = -1;
    if (!ctx || !chain) return;
    const old = chain.sfxBus;
    const cut = sfxVoices;
    sfxVoices = new Set<Voice>();
    const fresh = ctx.createGain();
    fresh.gain.value = LEVELS.sfx;
    fresh.connect(chain.master);
    chain.sfxBus = fresh;
    unduckMusic();
    const finish = (): void => {
      try {
        old.disconnect();
      } catch {
        /* already gone */
      }
      killVoices(cut);
    };
    if (immediately || cut.size === 0) {
      finish();
      return;
    }
    // A 20 ms ramp instead of a hard cut, then everything that was sounding is stopped.
    const t = ctx.currentTime;
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + 0.02);
    background(setTimeout(finish, 80));
  }

  function gesture(): void {
    api.unlock();
  }

  function listen(): void {
    if (listening || disposed || options.autoUnlock === false) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    listening = true;
    for (let i = 0; i < GESTURES.length; i++) window.addEventListener(GESTURES[i], gesture, true);
  }

  function unlisten(): void {
    if (!listening) return;
    listening = false;
    for (let i = 0; i < GESTURES.length; i++) window.removeEventListener(GESTURES[i], gesture, true);
  }

  function isHidden(): boolean {
    return typeof document !== 'undefined' && (document.hidden === true || document.visibilityState === 'hidden');
  }

  /** The page was hidden or shown. Hidden behaves exactly like suspend(). */
  function onVisibility(): void {
    if (disposed) return;
    const hidden = isHidden();
    if (hidden === pageHidden) return;
    pageHidden = hidden;
    try {
      if (hidden) silenceNow();
      sync();
    } catch {
      /* audio must never break the game */
    }
  }

  function watch(): void {
    if (watching || options.autoPause === false) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    watching = true;
    pageHidden = isHidden();
    document.addEventListener('visibilitychange', onVisibility);
  }

  function unwatch(): void {
    if (!watching) return;
    watching = false;
    document.removeEventListener('visibilitychange', onVisibility);
  }

  /** Stop all output at once: music players dropped, effects cut, nothing left scheduled. */
  function silenceNow(): void {
    dropPlayers();
    cutSfx(true);
  }

  const api: AudioEngine = {
    unlock(): void {
      try {
        if (disposed || !ensureContext()) return;
        unlocked = true;
        sync();
        if (live()) unlisten();
      } catch {
        /* audio must never break the game */
      }
    },

    setSfxEnabled(on: boolean): void {
      try {
        const next = !!on;
        if (!next && sfxOn) cutSfx(false);
        sfxOn = next;
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
        if (disposed || !sfxOn || paused() || !unlocked || !ctx || !chain) return;
        if (!isSfxName(name)) return;
        if (stateOf() === 'closed') return;
        if (!live()) {
          // unlock() was called a moment ago and the context is still starting: queue the
          // effect on its (frozen) clock so the tap that unlocked audio is heard too.
          const w = wall();
          if (resumeAskedAt < 0 || w - resumeAskedAt > PENDING_WINDOW_MS) return;
          // Whatever was queued long ago is stale by now and must not play with this one.
          if (pendingSince >= 0 && w - pendingSince > PENDING_WINDOW_MS) cutSfx(true);
          if (pendingSince < 0) pendingSince = w;
        }
        const now = ctx.currentTime;
        if (!gate.admit(sfxKey(name, opts), now, isPrioritySfx(name))) {
          sfxDropped++;
          return;
        }
        const dur = renderSfx(ctx, chain.sfxBus, name, now + SFX_DELAY, opts, sfxVoices);
        if (dur > 0) {
          gate.register(now + SFX_DELAY + dur);
          sfxPlayed++;
          if (sfxClass(name) === 'jingle') duckMusic(now, dur);
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
        silenceNow();
        sync();
      } catch {
        /* ignore */
      }
    },

    resume(): void {
      try {
        appSuspended = false;
        // A resume() from the shell is also the moment to look at the page again, in case
        // its visibility event was missed.
        if (watching) pageHidden = isHidden();
        sync();
      } catch {
        /* ignore */
      }
    },

    debug(): AudioDebugInfo {
      const stats = player ? player.stats() : null;
      const census = ctx ? voiceCensus(ctx) : null;
      return {
        state: stateOf(),
        unlocked,
        suspended: appSuspended,
        hidden: pageHidden,
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
        musicLevel: chain ? chain.musicBus.gain.value : 0,
        fading: fading.length,
        liveVoices: census ? census.voices : 0,
        liveNodes: census ? census.nodes : 0,
        context: ctx,
        output: chain ? chain.output : null,
      };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      unlisten();
      unwatch();
      cancelIdle();
      if (warmup !== null) clearTimeout(warmup);
      warmup = null;
      try {
        dropPlayers();
        killVoices(sfxVoices);
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
  watch();
  return api;
}
