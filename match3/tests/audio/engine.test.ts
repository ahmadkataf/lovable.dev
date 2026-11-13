import { afterEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE, SFX_MAX_VOICES, SFX_NAMES, SFX_PRIORITY_EXTRA, TICK_MS, createAudio, type AudioEngine } from '../../src/audio/index.ts';
import { FakeAudioContext, settle } from './fake-context.ts';

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
    expect(d.music!.events).toBeGreaterThan(0);
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
    const before = audio.debug();
    expect(() => {
      for (let i = 0; i < 200; i++) audio.sfx(SFX_NAMES[i % SFX_NAMES.length], { step: 1 + (i % 11) });
    }).not.toThrow();
    const after = audio.debug();
    expect(after.maxVoices).toBe(SFX_MAX_VOICES + SFX_PRIORITY_EXTRA);
    expect(after.voices).toBeLessThanOrEqual(after.maxVoices);
    expect(after.sfxPlayed - before.sfxPlayed).toBeLessThanOrEqual(after.maxVoices);
    expect(after.sfxPlayed - before.sfxPlayed + (after.sfxDropped - before.sfxDropped)).toBe(200);

    // every voice ends and gives its slot back
    fake.advance(3);
    expect(audio.debug().voices).toBe(0);
    expect(fake.sources.length).toBe(0);
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

    audio.music('menu');
    expect(audio.debug().music!.bars).toBe(bars); // not restarted

    audio.music('level');
    expect(audio.debug().playing).toBe('level');
    expect(audio.debug().music!.bars).toBeLessThanOrEqual(1); // a fresh player
    const disconnects = fake.disconnects;
    vi.advanceTimersByTime((CROSSFADE + 0.3) * 1000);
    expect(fake.disconnects).toBeGreaterThan(disconnects); // the old track was released after its fade

    audio.music(null);
    expect(audio.debug().playing).toBeNull();
    expect(audio.debug().schedulerRunning).toBe(false);
    expect(audio.debug().track).toBeNull();
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

  it('lets the context sleep when effects and music are both off', async () => {
    const { audio, fake } = await running();
    audio.music('menu');
    audio.setMusicEnabled(false);
    expect(fake.suspendCalls).toBe(0); // effects may still need it
    audio.setSfxEnabled(false);
    expect(fake.suspendCalls).toBe(1);
    await settle();
    expect(audio.debug().state).toBe('suspended');
    audio.setMusicEnabled(true);
    await settle();
    expect(audio.debug().state).toBe('running');
    expect(audio.debug().playing).toBe('menu');
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
