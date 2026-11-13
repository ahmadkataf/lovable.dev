import { describe, expect, it } from 'vitest';
import { SFX_MAX_VOICES, SFX_MIN_INTERVAL, SFX_PRIORITY_EXTRA, SfxGate } from '../../src/audio/limiter.ts';
import { isPrioritySfx, sfxKey } from '../../src/audio/sfx.ts';

describe('SfxGate: rate limit', () => {
  it('has the documented defaults', () => {
    expect(SFX_MIN_INTERVAL).toBeCloseTo(0.03, 9);
    expect(SFX_MAX_VOICES).toBe(24);
    const gate = new SfxGate();
    expect(gate.minInterval).toBe(SFX_MIN_INTERVAL);
    expect(gate.maxVoices).toBe(SFX_MAX_VOICES);
    expect(gate.priorityExtra).toBe(SFX_PRIORITY_EXTRA);
  });

  it('drops an identical sound inside 30 ms and admits it afterwards', () => {
    const gate = new SfxGate();
    expect(gate.admit('match#1', 1.0)).toBe(true);
    expect(gate.admit('match#1', 1.0)).toBe(false);
    expect(gate.admit('match#1', 1.029)).toBe(false);
    expect(gate.admit('match#1', 1.031)).toBe(true);
    // the window restarts from the last ADMITTED start, not from rejected attempts
    expect(gate.admit('match#1', 1.05)).toBe(false);
    expect(gate.admit('match#1', 1.062)).toBe(true);
  });

  it('treats other sounds and other steps as different', () => {
    const gate = new SfxGate();
    expect(gate.admit(sfxKey('match', { step: 1 }), 2)).toBe(true);
    expect(gate.admit(sfxKey('match', { step: 2 }), 2)).toBe(true);
    expect(gate.admit(sfxKey('beam'), 2)).toBe(true);
    expect(gate.admit(sfxKey('match', { step: 1 }), 2.001)).toBe(false);
    expect(gate.admit(sfxKey('match', { step: 1.2 }), 2.002)).toBe(false); // rounds to the same step
  });

  it('never blocks when the clock restarts', () => {
    const gate = new SfxGate();
    expect(gate.admit('coin#0', 50)).toBe(true);
    expect(gate.admit('coin#0', 0.01)).toBe(true); // a new audio context starts again at 0
  });

  it('builds keys from name and rounded step', () => {
    expect(sfxKey('match')).toBe('match#0');
    expect(sfxKey('match', {})).toBe('match#0');
    expect(sfxKey('match', { step: 3 })).toBe('match#3');
    expect(sfxKey('star', { step: NaN })).toBe('star#0');
  });
});

describe('SfxGate: voice cap', () => {
  it('caps simultaneous voices and frees them as they end', () => {
    const gate = new SfxGate({ maxVoices: 4, priorityExtra: 2 });
    let started = 0;
    for (let i = 0; i < 50; i++) {
      if (gate.admit('s' + i, 1)) {
        gate.register(1 + 0.5);
        started++;
      }
    }
    expect(started).toBe(4);
    expect(gate.active(1)).toBe(4);
    expect(gate.active(1.49)).toBe(4);
    expect(gate.active(1.5)).toBe(0);
    expect(gate.admit('later', 1.5)).toBe(true);
  });

  it('lets priority sounds through a full house, up to the extra allowance', () => {
    const gate = new SfxGate({ maxVoices: 3, priorityExtra: 2 });
    for (let i = 0; i < 3; i++) {
      expect(gate.admit('n' + i, 0)).toBe(true);
      gate.register(1);
    }
    expect(gate.admit('normal', 0)).toBe(false);
    expect(gate.admit('jingle-a', 0, true)).toBe(true);
    gate.register(2);
    expect(gate.admit('jingle-b', 0, true)).toBe(true);
    gate.register(2);
    expect(gate.admit('jingle-c', 0, true)).toBe(false);
    expect(gate.active(0)).toBe(5);
    expect(gate.active(1.5)).toBe(2);
  });

  it('a storm of 200 calls in one instant stays within the cap', () => {
    const gate = new SfxGate();
    let started = 0;
    for (let i = 0; i < 200; i++) {
      const priority = i % 7 === 0;
      if (gate.admit('sound' + (i % 35) + '#' + (i % 11), 3, priority)) {
        gate.register(3 + 0.3);
        started++;
      }
    }
    expect(started).toBeLessThanOrEqual(SFX_MAX_VOICES + SFX_PRIORITY_EXTRA);
    expect(started).toBeGreaterThanOrEqual(SFX_MAX_VOICES);
    expect(gate.active(3)).toBe(started);
  });

  it('reset forgets voices and rate-limit history', () => {
    const gate = new SfxGate({ maxVoices: 1 });
    expect(gate.admit('a', 0)).toBe(true);
    gate.register(10);
    expect(gate.admit('b', 0)).toBe(false);
    gate.reset();
    expect(gate.active(0)).toBe(0);
    expect(gate.admit('a', 0)).toBe(true);
  });

  it('flags result jingles and warnings as priority', () => {
    for (const name of ['win', 'lose', 'reward', 'purchase', 'star', 'goalDone', 'movesLow', 'lifeLost', 'levelStart'] as const) {
      expect(isPrioritySfx(name)).toBe(true);
    }
    for (const name of ['match', 'land', 'button', 'beam', 'swap'] as const) expect(isPrioritySfx(name)).toBe(false);
  });
});
