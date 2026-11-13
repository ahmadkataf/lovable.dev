import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CROSSFADE,
  IDLE_SUSPEND_MS,
  LEVELS,
  MUSIC_DUCK_DB,
  MUSIC_DUCK_HOLD,
  SFX_LEAD_MAX,
  SFX_LEAD_MIN,
  SFX_MATCH_VOICES,
  SFX_MAX_VOICES,
  SFX_NAMES,
  TICK_MS,
  createAudio,
  createMusicPlayer,
  type AudioEngine,
  type MusicEvent,
} from '../../src/audio/index.ts';
import { FakeAudioContext, settle, type FakeNode } from './fake-context.ts';

let engines: AudioEngine[] = [];

function make(fake: FakeAudioContext | null, seed = 1): { audio: AudioEngine; created: () => number } {
  let created = 0;
  const audio = createAudio({
    seed,
    autoUnlock: false,
    createContext: () => {
      created++;
      if (!fake) throw new Error('no audio here');
      return fake as unknown as AudioContext;
    },
  });
  engines.push(audio);
  return { audio, created: () => created };
}

/** The music bus of the output chain built on a fake context (its third gain node). */
function musicBus(fake: FakeAudioContext): FakeNode {
  return fake.gains[2];
}

/** Let the scheduler's timer tick (real time). */
function tickOnce(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, TICK_MS * 2 + 10));
}

/** An unlocked, running engine on a fake context. */
async function running(): Promise<{ audio: AudioEngine; fake: FakeAudioContext }> {
  const fake = new FakeAudioContext();
  const { audio } = make(fake);
  audio.unlock();
  await settle();
  expect(audio.debug().state).toBe('running');
  return { audio, fake };
}

afterEach(() => {
  for (const e of engines) e.dispose();
  engines = [];
  vi.useRealTimers();
});

describe('audio engine without Web Audio', () => {
  it('imports and runs under Node as a silent no-op', () => {
    expect(typeof (globalThis as { AudioContext?: unknown }).AudioContext).toBe('undefined');
    const audio = createAudio();
    engines.push(audio);
    expect(() => {
      audio.unlock();
      audio.sfx('match', { step: 3 });
      audio.sfx('win');
      audio.music('menu');
      audio.music('level');
      audio.music(null);
      audio.setSfxEnabled(false);
      audio.setMusicEnabled(false);
      audio.setSfxEnabled(true);
      audio.setMusicEnabled(true);
      audio.suspend();
      audio.resume();
      audio.unlock();
    }).not.toThrow();
    const d = audio.debug();
    expect(d.state).toBe('none');
    expect(d.playing).toBeNull();
    expect(d.context).toBeNull();
    expect(d.voices).toBe(0);
    expect(d.schedulerRunning).toBe(false);
  });

  it('survives a context that cannot be created', () => {
    const { audio, created } = make(null);
    expect(() => {
      audio.unlock();
      audio.sfx('beam');
      audio.music('menu');
      audio.suspend();
      audio.resume();
    }).not.toThrow();
    expect(created()).toBeGreaterThan(0);
    expect(audio.debug().state).toBe('none');
  });

  it('survives an audio stack that throws on every node', async () => {
    const fake = new FakeAudioContext();
    fake.broken = true;
    const { audio } = make(fake);
    expect(() => {
      audio.unlock();
      audio.sfx('beam');
      audio.music('menu');
    }).not.toThrow();
    await settle();
    expect(audio.debug().playing).toBeNull();
  });
});

describe('audio engine: unlocking', () => {
  it('creates no context before unlock, and ignores effects until then', () => {
    const fake = new FakeAudioContext();
    const { audio, created } = make(fake);
    audio.sfx('match');
    audio.music('menu');
    audio.setSfxEnabled(true);
    audio.suspend();
    audio.resume();
    expect(created()).toBe(0);
    expect(fake.started).toBe(0);
    expect(audio.debug().track).toBe('menu');
    expect(audio.debug().sfxPlayed).toBe(0);
  });

  it('unlock() creates and resumes the context; music requested earlier then starts', async () => {
    const fake = new FakeAudioContext();
    const { audio, created } = make(fake);
    audio.music('level');
    audio.unlock();
    expect(created()).toBe(1);
    expect(fake.resumeCalls).toBe(1);
    expect(audio.debug().playing).toBeNull(); // still starting
    await settle();
    const d = audio.debug();
    expect(d.state).toBe('running');
    expect(d.playing).toBe('level');
    expect(d.schedulerRunning).toBe(true);
    // the first notes are left to the scheduler's next tick, not built inside the call
    expect(d.music!.events).toBe(0);
    await tickOnce();
    expect(audio.debug().music!.events).toBeGreaterThan(0);
    expect(fake.started).toBeGreaterThan(0);
    // unlocking again changes nothing
    audio.unlock();
    audio.unlock();
    await settle();
    expect(created()).toBe(1);
    expect(audio.debug().playing).toBe('level');
  });

  it('handles the "interrupted" state like "suspended"', async () => {
    const { audio, fake } = await running();
    audio.music('menu');
    expect(audio.debug().playing).toBe('menu');
    const resumes = fake.resumeCalls;
    fake.setState('interrupted'); // e.g. a phone call took the audio session
    expect(audio.debug().playing).toBeNull();
    expect(fake.resumeCalls).toBeGreaterThan(resumes); // it asks to come back by itself
    await settle();
    expect(audio.debug().state).toBe('running');
    expect(audio.debug().playing).toBe('menu');
  });

  it('an effect fired in the same gesture as unlock() is queued, not lost', async () => {
    const fake = new FakeAudioContext();
    const { audio } = make(fake);
    audio.unlock();
    audio.sfx('button');
    expect(audio.debug().state).toBe('suspended');
    expect(audio.debug().sfxPlayed).toBe(1);
    await settle();
    expect(audio.debug().state).toBe('running');
  });

  it('does not pile effects up while a context is refused', async () => {
    vi.useFakeTimers();
    const fake = new FakeAudioContext();
    fake.allowResume = false; // no user gesture yet: resume() never settles
    const { audio } = make(fake);
    audio.unlock();
    audio.sfx('button');
    expect(audio.debug().sfxPlayed).toBe(1);
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 50; i++) audio.sfx(SFX_NAMES[i % SFX_NAMES.length]);
    expect(audio.debug().sfxPlayed).toBe(1); // nothing more was queued
    // when it finally starts, the stale effect is cut rather than played late
    const before = fake.disconnects;
    fake.allowResume = true;
    audio.unlock();
    await vi.advanceTimersByTimeAsync(10);
    expect(audio.debug().state).toBe('running');
    expect(fake.disconnects).toBeGreaterThan(before);
    expect(audio.debug().voices).toBe(0);
  });
});

describe('audio engine: effects', () => {
  it('plays effects, rate-limits identical ones and caps the voices', async () => {
    const { audio, fake } = await running();
    audio.sfx('coin');
    expect(audio.debug().sfxPlayed).toBe(1);
    expect(audio.debug().voices).toBe(1);
    for (let i = 0; i < 9; i++) audio.sfx('coin');
    expect(audio.debug().sfxPlayed).toBe(1);
    expect(audio.debug().sfxDropped).toBe(9);
    fake.advance(0.031);
    audio.sfx('coin');
    expect(audio.debug().sfxPlayed).toBe(2);

    // 200 calls in one frame
    fake.advance(1);
    const before = audio.debug();
    expect(() => {
      for (let i = 0; i < 200; i++) audio.sfx(SFX_NAMES[i % SFX_NAMES.length], { step: 1 + (i % 13) });
    }).not.toThrow();
    const after = audio.debug();
    expect(after.maxVoices).toBe(SFX_MAX_VOICES);
    expect(after.maxVoices).toBe(12);
    expect(after.voices).toBe(12);
    expect(after.matchVoices).toBeLessThanOrEqual(SFX_MATCH_VOICES);
    const played = after.sfxPlayed - before.sfxPlayed;
    const stolen = after.sfxStolen - before.sfxStolen;
    expect(played - stolen).toBe(12); // whatever was started beyond twelve pushed another voice out
    expect(played).toBeLessThan(80); // … and most of the flood was never built at all
    expect(played + (after.sfxDropped - before.sfxDropped)).toBe(200);

    // every voice ends and gives its slot back
    fake.advance(3);
    expect(audio.debug().voices).toBe(0);
    expect(fake.sources.length).toBe(0);
  });

  it("gives 'match' three voices of its own: the fourth fades the oldest out", async () => {
    const { audio, fake } = await running();
    for (let step = 1; step <= 3; step++) {
      audio.sfx('match', { step });
      fake.advance(0.04);
    }
    expect(audio.debug().matchVoices).toBe(3);
    expect(audio.debug().sfxStolen).toBe(0);
    audio.sfx('match', { step: 4 });
    expect(audio.debug().matchVoices).toBe(3);
    expect(audio.debug().sfxStolen).toBe(1);
    expect(audio.debug().voices).toBe(3);
    // other sounds are not held back by the match budget
    audio.sfx('beam');
    audio.sfx('stone');
    expect(audio.debug().voices).toBe(5);
    expect(audio.debug().sfxStolen).toBe(1);
    fake.advance(2);
    expect(audio.debug().voices).toBe(0);
    expect(fake.sources.length).toBe(0); // the stolen voice was stopped and released too
  });

  it("starts 'land' at most once per 60 ms", async () => {
    const { audio, fake } = await running();
    let started = 0;
    for (let i = 0; i < 13; i++) {
      const before = audio.debug().sfxPlayed;
      audio.sfx('land');
      started += audio.debug().sfxPlayed - before;
      fake.advance(0.011);
    }
    expect(started).toBe(3); // at 0, 66 and 132 ms: the calls in between are inside the 60 ms
  });

  it('starts effects one device buffer ahead of the clock', async () => {
    const lead = async (baseLatency: number | undefined): Promise<number> => {
      const fake = new FakeAudioContext();
      fake.baseLatency = baseLatency;
      const { audio } = make(fake);
      audio.unlock();
      await settle();
      fake.advance(2);
      const from = fake.started;
      audio.sfx('button');
      expect(fake.started).toBeGreaterThan(from);
      const starts = fake.sources.map((n) => n.startAt);
      const d = audio.debug().sfxLead;
      expect(Math.min(...starts)).toBeCloseTo(2 + d, 9);
      return d;
    };
    expect(await lead(0.01)).toBeCloseTo(0.013, 6);
    expect(await lead(0.02)).toBeCloseTo(0.023, 6);
    expect(await lead(0.0029)).toBe(SFX_LEAD_MIN); // a low-latency device: stays tight
    expect(await lead(0.2)).toBe(SFX_LEAD_MAX); // a huge buffer: still playable
    const unknown = await lead(undefined);
    expect(unknown).toBeGreaterThanOrEqual(SFX_LEAD_MIN);
    expect(unknown).toBeLessThanOrEqual(SFX_LEAD_MAX);
  });

  it('builds a voice again when the clock overtook it during the build', async () => {
    const { audio, fake } = await running();
    fake.advance(1);
    // the main thread is held up for 50 ms in the middle of building the first voice
    const original = fake.createOscillator.bind(fake);
    let stalls = 1;
    fake.createOscillator = () => {
      if (stalls > 0) {
        stalls--;
        fake.currentTime += 0.05;
      }
      return original();
    };
    audio.sfx('match', { step: 3 });
    const d = audio.debug();
    expect(d.sfxRebuilt).toBe(1);
    expect(d.sfxPlayed).toBe(1);
    expect(d.voices).toBe(1);
    // what is left to sound starts ahead of the clock, not 50 ms behind it
    const live = fake.sources.filter((n) => n.stopAt > fake.currentTime);
    expect(live.length).toBeGreaterThan(0);
    for (const n of live) expect(n.startAt).toBeGreaterThanOrEqual(fake.currentTime + d.sfxLead - 1e-9);
    // the voice that was taken back is stopped at once
    const dead = fake.sources.filter((n) => n.stopAt <= fake.currentTime);
    expect(dead.length).toBeGreaterThan(0);
    // an undisturbed build is not rebuilt
    fake.advance(0.5);
    audio.sfx('match', { step: 4 });
    expect(audio.debug().sfxRebuilt).toBe(1);
  });

  it('ducks the music 4 dB under specials, big moments and jingles — and under nothing else', async () => {
    const { audio, fake } = await running();
    const bus = musicBus(fake);
    expect(bus.gain.value).toBeCloseTo(LEVELS.music, 9);
    const ducked = LEVELS.music * Math.pow(10, MUSIC_DUCK_DB / 20);
    expect(MUSIC_DUCK_DB).toBe(-4);
    expect(MUSIC_DUCK_HOLD).toBeCloseTo(0.6, 9);
    fake.advance(1);

    for (const quiet of ['match', 'land', 'button', 'swap', 'stone', 'coin'] as const) audio.sfx(quiet);
    expect(bus.gain.calls.filter((c) => c.method === 'target').length).toBe(0);

    // a special: down at once, back after about 0.6 s
    audio.sfx('beam');
    let targets = bus.gain.calls.filter((c) => c.method === 'target');
    expect(targets.length).toBe(2);
    expect(targets[0].value).toBeCloseTo(ducked, 9);
    expect(targets[1].value).toBeCloseTo(LEVELS.music, 9);
    expect(targets[1].time - targets[0].time).toBeCloseTo(MUSIC_DUCK_HOLD, 6);

    // a jingle: for as long as it lasts
    fake.advance(2);
    bus.gain.calls.length = 0;
    audio.sfx('win');
    targets = bus.gain.calls.filter((c) => c.method === 'target');
    expect(targets[0].value).toBeCloseTo(ducked, 9);
    expect(targets[1].time - targets[0].time).toBeGreaterThan(1.5);
    const winEnd = targets[1].time;

    // a second big sound meanwhile never brings the music back before the first has ended
    fake.advance(0.1);
    bus.gain.calls.length = 0;
    audio.sfx('praise', { step: 2 });
    targets = bus.gain.calls.filter((c) => c.method === 'target');
    expect(targets[1].time).toBeCloseTo(winEnd, 9);

    // cutting the effects lets the music come back at once
    bus.gain.calls.length = 0;
    audio.setSfxEnabled(false);
    targets = bus.gain.calls.filter((c) => c.method === 'target');
    expect(targets.length).toBe(1);
    expect(targets[0].value).toBeCloseTo(LEVELS.music, 9);
  });

  it('ignores unknown names, zero volume and junk options', async () => {
    const { audio } = await running();
    expect(() => {
      audio.sfx('nope' as never);
      audio.sfx('match', { step: NaN, volume: NaN });
      audio.sfx('match', { step: -5 });
      audio.sfx('star', { step: 99 });
      audio.sfx('praise', { step: 0 });
      audio.sfx('beam', { volume: 0 });
      audio.sfx('nova', { volume: 7 });
      audio.sfx('win', undefined);
    }).not.toThrow();
    expect(audio.debug().sfxPlayed).toBeGreaterThan(0);
  });

  it('setSfxEnabled(false) cuts what is sounding and ignores new effects', async () => {
    const { audio } = await running();
    audio.sfx('win');
    expect(audio.debug().voices).toBe(1);
    audio.setSfxEnabled(false);
    expect(audio.debug().voices).toBe(0);
    audio.sfx('win');
    audio.sfx('match');
    expect(audio.debug().sfxPlayed).toBe(1);
    audio.setSfxEnabled(true);
    audio.sfx('match');
    expect(audio.debug().sfxPlayed).toBe(2);
  });
});

describe('audio engine: music', () => {
  it('switches tracks, treats the current track as a no-op and stops on null', async () => {
    vi.useFakeTimers();
    const fake = new FakeAudioContext();
    const { audio } = make(fake);
    audio.unlock();
    await vi.advanceTimersByTimeAsync(1);
    audio.music('menu');
    expect(audio.debug().playing).toBe('menu');
    // the scheduler keeps feeding events as the clock moves
    let events = audio.debug().music!.events;
    for (let i = 0; i < 400; i++) {
      fake.advance(TICK_MS / 1000);
      vi.advanceTimersByTime(TICK_MS);
    }
    expect(audio.debug().music!.events).toBeGreaterThan(events + 10);
    expect(audio.debug().music!.dropped).toBe(0);
    events = audio.debug().music!.events;
    const bars = audio.debug().music!.bars;
    const starts = audio.debug().musicStarts;

    audio.music('menu');
    expect(audio.debug().music!.bars).toBe(bars); // not restarted
    expect(audio.debug().musicStarts).toBe(starts);

    audio.music('level');
    expect(audio.debug().playing).toBe('level');
    expect(audio.debug().musicStarts).toBe(starts + 1);
    expect(audio.debug().music!.bars).toBe(0); // a fresh player; its first notes come with the next tick
    const before = fake.started;
    expect(before).toBeGreaterThan(0);
    fake.advance(TICK_MS / 1000);
    vi.advanceTimersByTime(TICK_MS);
    expect(audio.debug().music!.bars).toBe(1);
    expect(fake.started).toBeGreaterThan(before);
    const disconnects = fake.disconnects;
    vi.advanceTimersByTime((CROSSFADE + 0.3) * 1000);
    expect(fake.disconnects).toBeGreaterThan(disconnects); // the old track was released after its fade

    audio.music(null);
    expect(audio.debug().playing).toBeNull();
    expect(audio.debug().schedulerRunning).toBe(false);
    expect(audio.debug().track).toBeNull();
  });

  it('thirty track changes in one frame build one player and not a single note', async () => {
    const { audio, fake } = await running();
    audio.music('menu');
    await tickOnce();
    const started = fake.started;
    const starts = audio.debug().musicStarts;
    for (let i = 0; i < 30; i++) audio.music(i % 2 ? 'menu' : 'level');
    audio.music('level');
    expect(audio.debug().playing).toBe('level');
    expect(fake.started).toBe(started); // no source was started by any of those calls
    expect(audio.debug().fading).toBeLessThanOrEqual(1); // only the track that was really playing fades
    expect(audio.debug().musicStarts - starts).toBeLessThanOrEqual(31);
    await tickOnce();
    expect(fake.started).toBeGreaterThan(started);
    expect(audio.debug().playing).toBe('level');
  });

  it('setMusicEnabled turns the wanted track off and back on', async () => {
    const { audio } = await running();
    audio.music('level');
    audio.setMusicEnabled(false);
    expect(audio.debug().playing).toBeNull();
    expect(audio.debug().track).toBe('level');
    expect(audio.debug().schedulerRunning).toBe(false);
    audio.music('menu'); // remembered while disabled
    expect(audio.debug().playing).toBeNull();
    audio.setMusicEnabled(true);
    expect(audio.debug().playing).toBe('menu');
  });

  it('lets the context sleep when effects and music are both off — after the fades', async () => {
    vi.useFakeTimers();
    const fake = new FakeAudioContext();
    const { audio } = make(fake);
    audio.unlock();
    await vi.advanceTimersByTimeAsync(1);
    expect(audio.debug().state).toBe('running');
    audio.music('menu');
    audio.setMusicEnabled(false);
    expect(fake.suspendCalls).toBe(0); // effects may still need it
    audio.setSfxEnabled(false);
    // nothing left to play: the context sleeps, but only once the fades have been heard
    expect(fake.suspendCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(IDLE_SUSPEND_MS - 20);
    expect(fake.suspendCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(40);
    expect(fake.suspendCalls).toBe(1);
    expect(audio.debug().state).toBe('suspended');
    audio.setMusicEnabled(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(audio.debug().state).toBe('running');
    expect(audio.debug().playing).toBe('menu');
    // switching one of them back on before the timer fires cancels the sleep
    audio.setMusicEnabled(false);
    await vi.advanceTimersByTimeAsync(IDLE_SUSPEND_MS / 2);
    audio.setSfxEnabled(true);
    await vi.advanceTimersByTimeAsync(IDLE_SUSPEND_MS * 2);
    expect(fake.suspendCalls).toBe(1);
    expect(audio.debug().state).toBe('running');
  });
});

describe('audio engine: suspend / resume', () => {
  it('suspend() stops scheduling and suspends at once; resume() restores the track', async () => {
    const { audio, fake } = await running();
    audio.music('level');
    audio.sfx('reward');
    audio.suspend();
    let d = audio.debug();
    expect(d.suspended).toBe(true);
    expect(d.playing).toBeNull();
    expect(d.schedulerRunning).toBe(false);
    expect(d.voices).toBe(0);
    expect(fake.suspendCalls).toBe(1); // asked synchronously, inside suspend()
    await settle();
    expect(audio.debug().state).toBe('suspended');

    // nothing gets through while suspended, and unlock() does not wake it
    const started = fake.started;
    audio.sfx('win');
    audio.music('menu');
    audio.unlock();
    await settle();
    expect(fake.started).toBe(started);
    expect(audio.debug().state).toBe('suspended');

    audio.resume();
    await settle();
    d = audio.debug();
    expect(d.suspended).toBe(false);
    expect(d.state).toBe('running');
    expect(d.playing).toBe('menu'); // the track asked for most recently
    expect(d.schedulerRunning).toBe(true);
  });

  it('resume() does not start music that is disabled', async () => {
    const { audio } = await running();
    audio.music('menu');
    audio.setMusicEnabled(false);
    audio.suspend();
    await settle();
    audio.resume();
    await settle();
    expect(audio.debug().state).toBe('running');
    expect(audio.debug().playing).toBeNull();
  });

  it('cuts an effect when the system stops the context, so its remainder is not played later', async () => {
    const { audio, fake } = await running();
    audio.sfx('win');
    fake.advance(0.3);
    expect(audio.debug().voices).toBe(1);
    const disconnects = fake.disconnects;
    fake.setState('interrupted'); // a phone call, another app taking the audio focus …
    expect(audio.debug().voices).toBe(0);
    expect(fake.disconnects).toBeGreaterThan(disconnects);
    await settle();
    expect(audio.debug().state).toBe('running'); // the engine asked to come back by itself
    fake.advance(0.001);
    expect(fake.sources.length).toBe(0); // nothing of the jingle is left to sound
    // … and effects work as before
    audio.sfx('star', { step: 2 });
    expect(audio.debug().voices).toBe(1);
  });

  it('suspend() before unlock is remembered', async () => {
    const fake = new FakeAudioContext();
    const { audio } = make(fake);
    audio.music('menu');
    audio.suspend();
    audio.unlock(); // e.g. a tap lands while the app is going to the background
    await settle();
    expect(audio.debug().playing).toBeNull();
    expect(audio.debug().state).not.toBe('running');
    audio.resume();
    await settle();
    expect(audio.debug().state).toBe('running');
    expect(audio.debug().playing).toBe('menu');
  });

  it('dispose() closes the context and silences every call', async () => {
    const { audio, fake } = await running();
    audio.music('menu');
    audio.dispose();
    expect(fake.closeCalls).toBe(1);
    expect(() => {
      audio.unlock();
      audio.sfx('match');
      audio.music('level');
      audio.resume();
      audio.dispose();
    }).not.toThrow();
    expect(audio.debug().playing).toBeNull();
    expect(audio.debug().state).toBe('none');
  });
});

describe('music player on a busy main thread', () => {
  it('schedules every note ahead of the clock when nothing holds it up', () => {
    const fake = new FakeAudioContext();
    const heard: MusicEvent[] = [];
    const player = createMusicPlayer(fake as unknown as BaseAudioContext, fake.createGain() as unknown as AudioNode, 'level', { seed: 5, startAt: 0.1, onEvent: (e) => heard.push(e) });
    const n = player.schedule(3);
    expect(n).toBeGreaterThan(10);
    expect(heard.length).toBe(n);
    expect(player.stats().dropped).toBe(0);
    expect(player.stats().events).toBe(n);
    for (const s of fake.sources) expect(s.startAt).toBeGreaterThanOrEqual(0.1 - 1e-9);
    player.dispose();
    expect(player.liveVoices()).toBe(0);
  });

  it('leaves out the notes whose time has gone by while the batch was being built', () => {
    const fake = new FakeAudioContext();
    const heard: MusicEvent[] = [];
    const player = createMusicPlayer(fake as unknown as BaseAudioContext, fake.createGain() as unknown as AudioNode, 'level', { seed: 5, startAt: 0.1, onEvent: (e) => heard.push(e) });
    // the main thread is held up for a second while the third plucked note is being built
    const original = fake.createBufferSource.bind(fake);
    let builds = 0;
    let keptBefore = -1;
    let stopsBefore = 0;
    fake.createBufferSource = () => {
      builds++;
      if (builds === 3) {
        keptBefore = heard.length;
        stopsBefore = fake.sources.filter((sn) => sn.stopAt <= 1).length;
        fake.currentTime += 1;
      }
      return original();
    };
    player.schedule(3);
    expect(fake.currentTime).toBe(1);
    expect(keptBefore).toBeGreaterThan(0);
    const dropped = player.stats().dropped;
    expect(dropped).toBeGreaterThan(1);
    // every note kept after the hold-up lies ahead of the clock; the ones in between are gone
    const after = heard.slice(keptBefore).filter((e) => e.layer !== 'pad');
    expect(after.length).toBeGreaterThan(3);
    for (const e of after) expect(e.time).toBeGreaterThanOrEqual(1);
    // the note that was overtaken in the middle of its build was taken back at once
    expect(fake.sources.filter((sn) => sn.stopAt <= 1).length).toBeGreaterThan(stopsBefore);
    // what was kept and what was left out add up to what the composer wrote
    expect(player.stats().events).toBe(heard.length);
    player.dispose();
  });
});
