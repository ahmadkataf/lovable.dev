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
 * The mix (docs/STRATEGY.md, audio-01 — every number is checked by tools/audio-check.cjs):
 *   - every effect belongs to a loudness tier and peaks at that tier's level: interface −18
 *     dBFS, land −16, select/swap −14, match −12, blockers −10, specials −8, praise and double
 *     blasts −6, jingles −5 (sfx.ts); the music's peak is held at −20 dBFS (output.ts) and
 *     dips a further 4 dB for about 0.6 s under specials, praise and jingles (mixer.ts);
 *   - sfx('match', { step }) climbs a twelve-rung ladder in the music's key, then holds its
 *     top note and adds sparkle (scale.ts); it has three alternating takes;
 *   - at most 12 effect voices sound at once, at most 3 of them 'match'; the oldest quiet
 *     voice is faded out to make room, 'land' starts at most once per 60 ms (limiter.ts);
 *   - nothing leaves the output above −1 dBFS (output.ts).
 *
 * Importing this module touches neither the DOM nor an AudioContext, so it loads under Node.
 */
import type { AudioApi, MusicTrack, SfxName, SfxOptions } from './types.ts';
import { SFX_MAX_VOICES } from './limiter.ts';
import { SfxMixer } from './mixer.ts';
import { createMusicPlayer, type MusicPlayer } from './music.ts';
import { LEVELS, createOutputChain, type OutputChain } from './output.ts';
import { isSfxName } from './sfx.ts';
import { lookaheadFor, type TransportStats } from './transport.ts';
import { LEAD_MIDI, killVoices, pluckBuffer, voiceCensus, type VoiceGroup } from './voices.ts';

export type { AudioApi, MusicTrack, SfxName, SfxOptions } from './types.ts';
export {
  MATCH_VARIANTS,
  SFX_NAMES,
  SFX_STEPS,
  SFX_TIERS,
  SFX_TIER_PEAK_DB,
  isPrioritySfx,
  isSfxName,
  renderSfx,
  sfxClass,
  sfxDucksMusic,
  sfxKey,
  sfxPeakDb,
  sfxRank,
  sfxRequest,
  sfxTier,
  sfxVariants,
  startSfx,
  type SfxClass,
  type SfxTier,
} from './sfx.ts';
export { LATE_MARGIN, MUSIC_DUCK_DB, MUSIC_DUCK_HOLD, STEAL_FADE, SfxMixer, type SfxMixerStats } from './mixer.ts';
export { MUSIC_MIX, createMusicPlayer, type MusicLayers, type MusicPlayer, type MusicPlayerOptions } from './music.ts';
export {
  GUARD_CEILING,
  GUARD_KNEE,
  LEVELS,
  LIMITER,
  LIMITER_MAKEUP,
  LIMITER_ONSET,
  MUSIC_CEILING,
  MUSIC_GLUE,
  MUSIC_KNEE,
  MUSIC_PEAK_DB,
  STARTUP_BYPASS,
  STARTUP_FADE,
  createOutputChain,
  guardCurve,
  type OutputChain,
  type OutputChainOptions,
} from './output.ts';
export { voiceCensus, type VoiceCensus } from './voices.ts';
export {
  SFX_LAND_INTERVAL,
  SFX_MATCH_VOICES,
  SFX_MAX_VOICES,
  SFX_MIN_INTERVAL,
  SfxGate,
  type SfxGateOptions,
  type SfxRequest,
  type SfxSlot,
} from './limiter.ts';
export { BASE_LOOKAHEAD, MAX_LOOKAHEAD, MIN_LEAD, Transport, lookaheadFor, type MusicEvent, type TransportStats } from './transport.ts';
export { TRACK_STYLES, createComposer, type Bar, type Composer, type LeadNote, type PercHit, type TrackStyle } from './phrase.ts';
export {
  HIJAZ,
  MATCH_DEGREES,
  MATCH_LADDER,
  MATCH_MAX_STEP,
  PRAISE_MOTIFS,
  TONIC_MIDI,
  degreeToMidi,
  isHijazPitch,
  isLadderPitch,
  matchStepFreq,
  matchStepMidi,
  matchStepSparkles,
  midiToFreq,
  praiseMotif,
  starStepMidi,
} from './scale.ts';

/** Scheduler timer period (ms). */
export const TICK_MS = 25;
/** Cross-fade between music tracks, and the music fade when it is switched on or off (s). */
export const CROSSFADE = 0.6;

/**
 * A new track begins this far ahead of "now" (s). Its first notes are scheduled by the next
 * scheduler tick, not by the call that asked for the track: a burst of track changes in one
 * frame then builds no notes at all, and one change spreads its work over two frames.
 */
const START_DELAY = 0.09;
/**
 * Effects start a little ahead of "now", so that their attack is never clipped by a render
 * that had already begun: one device buffer (the context's baseLatency) plus a margin,
 * within these bounds (s). The audio clock moves a whole device buffer at a time, so
 * anything aimed closer than that can find its start already in the past.
 */
export const SFX_LEAD_MIN = 0.008;
export const SFX_LEAD_MAX = 0.03;
const SFX_LEAD_MARGIN = 0.003;
/** Used when the context does not say how large its buffer is. */
const SFX_LEAD_DEFAULT = 0.013;
/** Effects fired while the context is still starting are queued for at most this long (ms). */
const PENDING_WINDOW_MS = 400;
/**
 * Seed of the first menu music of a session: the same opening every time the game is
 * launched gives it a tune of its own. Later starts move on to fresh material.
 */
export const MENU_SIGNATURE_SEED = 13;
/** Pause between two plucked-string buffers synthesised in the background (ms). */
const WARMUP_GAP_MS = 60;
/** This far into its fade-in (s) a new track is still inaudible (under 4 % of its level). */
const INAUDIBLE_FADE_IN = 0.02;
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
  /** 'match' voices sounding now (they have a cap of their own). */
  matchVoices: number;
  sfxPlayed: number;
  sfxDropped: number;
  /** Voices that were faded out to make room for a new effect. */
  sfxStolen: number;
  /** Voices built a second time because the main thread was held up while building them. */
  sfxRebuilt: number;
  /** How far ahead of the clock effects are started (s). */
  sfxLead: number;
  music: TransportStats | null;
  /** Current gain of the music bus (it dips while a jingle plays). */
  musicLevel: number;
  /** Old music players that are still fading out. */
  fading: number;
  /** Music players started so far (a redundant call must not add one). */
  musicStarts: number;
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
  let mixer: SfxMixer | null = null;
  /** Effects counted by the mixers of earlier contexts. */
  const before = { played: 0, dropped: 0, stolen: 0, rebuilt: 0 };
  let resumeAskedAt = -1;
  let pendingSince = -1;
  let listening = false;
  let watching = false;
  let warmup: Timer | null = null;
  let idleTimer: Timer | null = null;
  /** A ctx.suspend() has been asked for and has not settled yet (and when it was asked, ms). */
  let suspending = false;
  let suspendAskedAt = 0;
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

  /** The mixer of a context that is gone: stop its voices, keep its counts. */
  function retireMixer(): void {
    if (!mixer) return;
    mixer.killAll();
    before.played += mixer.stats.played;
    before.dropped += mixer.stats.dropped;
    before.stolen += mixer.stats.stolen;
    before.rebuilt += mixer.stats.rebuilt;
    mixer = null;
  }

  function ensureContext(): boolean {
    if (ctx && stateOf() !== 'closed') return true;
    dropPlayers();
    retireMixer();
    const made = makeContext();
    if (!made) {
      ctx = null;
      chain = null;
      return false;
    }
    try {
      chain = createOutputChain(made);
      mixer = new SfxMixer(made, chain);
    } catch {
      ctx = null;
      chain = null;
      mixer = null;
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
    pendingSince = -1;
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
      // An effect that was sounding is cut: its frozen remainder would otherwise play, out
      // of place, whenever the sound returns. (Effects queued for a context that is still
      // starting are another matter: they are waiting to be heard.)
      if (pendingSince < 0) cutSfx(true);
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
          player = createMusicPlayer(ctx, chain.musicIn, target, { seed, startAt: now + START_DELAY, fadeIn: CROSSFADE });
          lastTick = -1;
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
    // A player that was replaced before its fade-in had got anywhere is inaudible: drop it
    // on the spot, so a burst of track changes cannot stack up fading players.
    if (now <= old.startAt + INAUDIBLE_FADE_IN) {
      old.dispose();
      return;
    }
    try {
      // The fade starts a device buffer ahead, like everything else: a ramp that begins "now"
      // is already under way when the audio thread hears of it, and would start with a step.
      old.stop(now + sfxLead(), CROSSFADE);
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

  /** Silence every effect that is sounding by swapping in a fresh effects bus. */
  function cutSfx(immediately: boolean): void {
    pendingSince = -1;
    if (!ctx || !chain || !mixer) return;
    const old = chain.sfxBus;
    const cut: VoiceGroup = mixer.detach();
    const fresh = ctx.createGain();
    fresh.gain.value = LEVELS.sfx;
    fresh.connect(chain.master);
    chain.sfxBus = fresh;
    mixer.unduck(ctx.currentTime);
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
    // A 20 ms ramp instead of a hard cut, then everything that was sounding is stopped. The
    // ramp begins a device buffer ahead so that it is rendered from its first sample.
    const t = ctx.currentTime + sfxLead();
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + 0.02);
    background(setTimeout(finish, 90));
  }

  /** The audio clock, for the mixer to see whether it was overtaken while building a voice. */
  function clock(): number {
    return ctx ? ctx.currentTime : 0;
  }

  /** How far ahead of the clock an effect is started (s): one device buffer plus a margin. */
  function sfxLead(): number {
    const base = ctx ? (ctx as unknown as { baseLatency?: number }).baseLatency : undefined;
    if (typeof base !== 'number' || !isFinite(base) || base <= 0) return SFX_LEAD_DEFAULT;
    return Math.min(SFX_LEAD_MAX, Math.max(SFX_LEAD_MIN, base + SFX_LEAD_MARGIN));
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
        if (disposed || !sfxOn || paused() || !unlocked || !ctx || !chain || !mixer) return;
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
        mixer.play(name, opts, now, now + sfxLead(), clock);
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
        voices: ctx && mixer ? mixer.active(ctx.currentTime) : 0,
        maxVoices: mixer ? mixer.maxVoices : SFX_MAX_VOICES,
        matchVoices: ctx && mixer ? mixer.active(ctx.currentTime, 'match') : 0,
        sfxPlayed: before.played + (mixer ? mixer.stats.played : 0),
        sfxDropped: before.dropped + (mixer ? mixer.stats.dropped : 0),
        sfxStolen: before.stolen + (mixer ? mixer.stats.stolen : 0),
        sfxRebuilt: before.rebuilt + (mixer ? mixer.stats.rebuilt : 0),
        sfxLead: sfxLead(),
        music: stats ? { bars: stats.bars, events: stats.events, dropped: stats.dropped, resyncs: stats.resyncs } : null,
        musicLevel: chain ? chain.musicBus.gain.value : 0,
        fading: fading.length,
        musicStarts,
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
        retireMixer();
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
