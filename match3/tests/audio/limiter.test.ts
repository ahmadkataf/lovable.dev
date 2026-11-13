import { describe, expect, it } from 'vitest';
import { SFX_LAND_INTERVAL, SFX_MATCH_VOICES, SFX_MAX_VOICES, SFX_MIN_INTERVAL, SfxGate, type SfxRequest } from '../../src/audio/limiter.ts';
import { SFX_NAMES, SFX_TIERS, isPrioritySfx, sfxDucksMusic, sfxKey, sfxRank, sfxRequest, sfxTier } from '../../src/audio/sfx.ts';

/** A plain request: a sound of its own key and a loudness rank. */
function req(key: string, rank = 3, extra: Partial<SfxRequest> = {}): SfxRequest {
  return { key, rank, ...extra };
}

/** Admit and register in one go; returns what happened. */
function start(gate: SfxGate<string>, r: SfxRequest, now: number, length = 0.5): { ok: boolean; stolen: string[] } {
  const steal = gate.admit(r, now);
  if (steal === null) return { ok: false, stolen: [] };
  gate.register(r, now, now + length, r.key);
  return { ok: true, stolen: steal.map((s) => s.handle) };
}

describe('SfxGate: rate limit', () => {
  it('has the numbers of the strategy study', () => {
    expect(SFX_MIN_INTERVAL).toBeCloseTo(0.03, 9);
    expect(SFX_MAX_VOICES).toBe(12);
    expect(SFX_MATCH_VOICES).toBe(3);
    expect(SFX_LAND_INTERVAL).toBeCloseTo(0.06, 9);
    const gate = new SfxGate();
    expect(gate.minInterval).toBe(SFX_MIN_INTERVAL);
    expect(gate.maxVoices).toBe(SFX_MAX_VOICES);
  });

  it('drops an identical sound inside 30 ms and admits it afterwards', () => {
    const gate = new SfxGate<string>();
    expect(gate.admit(req('match#1'), 1.0)).toEqual([]);
    expect(gate.admit(req('match#1'), 1.0)).toBeNull();
    expect(gate.admit(req('match#1'), 1.029)).toBeNull();
    expect(gate.admit(req('match#1'), 1.031)).toEqual([]);
    // the window restarts from the last ADMITTED start, not from rejected attempts
    expect(gate.admit(req('match#1'), 1.05)).toBeNull();
    expect(gate.admit(req('match#1'), 1.062)).toEqual([]);
  });

  it('a sound may ask for a longer interval of its own', () => {
    const gate = new SfxGate<string>();
    const land = req('land', 1, { minInterval: 0.06 });
    expect(gate.admit(land, 2)).toEqual([]);
    expect(gate.admit(land, 2.04)).toBeNull(); // past 30 ms, but not past its own 60
    expect(gate.admit(land, 2.059)).toBeNull();
    expect(gate.admit(land, 2.061)).toEqual([]);
  });

  it('treats other sounds and other steps as different', () => {
    const gate = new SfxGate<string>();
    expect(gate.admit(req(sfxKey('match', { step: 1 })), 2)).toEqual([]);
    expect(gate.admit(req(sfxKey('match', { step: 2 })), 2)).toEqual([]);
    expect(gate.admit(req(sfxKey('beam')), 2)).toEqual([]);
    expect(gate.admit(req(sfxKey('match', { step: 1 })), 2.001)).toBeNull();
    expect(gate.admit(req(sfxKey('match', { step: 1.2 })), 2.002)).toBeNull(); // rounds to the same step
  });

  it('never blocks when the clock restarts', () => {
    const gate = new SfxGate<string>();
    expect(gate.admit(req('coin'), 50)).toEqual([]);
    expect(gate.admit(req('coin'), 0.01)).toEqual([]); // a new audio context starts again at 0
  });

  it('builds keys from name and audible step', () => {
    // a stepped sound without a step falls back to its lowest valid step
    expect(sfxKey('match')).toBe('match#1');
    expect(sfxKey('match', {})).toBe('match#1');
    expect(sfxKey('match', { step: 3 })).toBe('match#3');
    expect(sfxKey('match', { step: 12 })).toBe('match#12');
    // everything beyond the ladder is one and the same sound: the top note with sparkle
    expect(sfxKey('match', { step: 13 })).toBe('match#13');
    expect(sfxKey('match', { step: 40 })).toBe('match#13');
    expect(sfxKey('star', { step: NaN })).toBe('star#1');
    expect(sfxKey('beam', { step: 7 })).toBe('beam');
  });
});

describe('SfxGate: voice budget', () => {
  it('counts voices and frees them as they end', () => {
    const gate = new SfxGate<string>({ maxVoices: 4 });
    for (let i = 0; i < 4; i++) expect(start(gate, req('s' + i), 1).ok).toBe(true);
    expect(gate.active(1)).toBe(4);
    expect(gate.active(1.49)).toBe(4);
    expect(gate.active(1.5)).toBe(0);
    expect(start(gate, req('later'), 1.5).ok).toBe(true);
  });

  it('a full house in one instant keeps the voices it has (no churn among equals)', () => {
    const gate = new SfxGate<string>({ maxVoices: 4 });
    let started = 0;
    let stolen = 0;
    for (let i = 0; i < 50; i++) {
      const r = start(gate, req('s' + i), 1);
      if (r.ok) started++;
      stolen += r.stolen.length;
    }
    expect(started).toBe(4);
    expect(stolen).toBe(0);
    expect(gate.active(1)).toBe(4);
  });

  it('steals the oldest voice among equals once it has sounded for a moment', () => {
    const gate = new SfxGate<string>({ maxVoices: 3 });
    start(gate, req('a'), 0, 2);
    start(gate, req('b'), 0.1, 2);
    start(gate, req('c'), 0.2, 2);
    const r = start(gate, req('d'), 0.3, 2);
    expect(r.ok).toBe(true);
    expect(r.stolen).toEqual(['a']);
    expect(gate.active(0.3)).toBe(3);
    // 'b' is the oldest now
    expect(start(gate, req('e'), 0.4, 2).stolen).toEqual(['b']);
  });

  it('steals the quietest voice first, whatever its age', () => {
    const gate = new SfxGate<string>({ maxVoices: 3 });
    start(gate, req('jingle', 7), 0, 2);
    start(gate, req('tick', 1), 0.5, 2);
    start(gate, req('blast', 5), 0.6, 2);
    // a new mid-rank sound pushes out the tick, not the older jingle
    expect(start(gate, req('pop', 3), 1, 2).stolen).toEqual(['tick']);
    expect(gate.ranks(1).slice().sort()).toEqual([3, 5, 7]);
  });

  it('drops a newcomer that is quieter than everything sounding', () => {
    const gate = new SfxGate<string>({ maxVoices: 2 });
    start(gate, req('win', 7), 0, 1.01);
    start(gate, req('beam', 5), 0, 1.01);
    const r = start(gate, req('land', 1), 1, 0.1);
    expect(r.ok).toBe(false);
    expect(gate.active(1)).toBe(2);
    // … and a dropped sound does not arm its own rate limit: 11 ms later the two voices
    // have ended and the same sound is let in at once
    expect(start(gate, req('land', 1), 1.011, 0.1).ok).toBe(true);
  });

  it('a louder newcomer may take a voice that has only just started', () => {
    const gate = new SfxGate<string>({ maxVoices: 2 });
    start(gate, req('tick-a', 1), 1, 1);
    start(gate, req('tick-b', 1), 1, 1);
    expect(start(gate, req('tick-c', 1), 1, 1).ok).toBe(false); // equal rank, same instant: kept as it is
    const r = start(gate, req('jingle', 7), 1, 1);
    expect(r.ok).toBe(true);
    expect(r.stolen.length).toBe(1);
  });

  it('a storm of 500 calls in one instant ends with the loudest twelve', () => {
    const gate = new SfxGate<string>();
    let started = 0;
    let stolen = 0;
    for (let i = 0; i < 500; i++) {
      const rank = i % 8;
      const r = start(gate, req('sound' + (i % 40) + '#' + (i % 13), rank), 3, 0.3);
      if (r.ok) started++;
      stolen += r.stolen.length;
    }
    expect(gate.active(3)).toBe(SFX_MAX_VOICES);
    expect(started - stolen).toBe(SFX_MAX_VOICES);
    // work is bounded: far fewer voices were built than calls were made
    expect(started).toBeLessThan(120);
    const ranks = gate.ranks(3);
    expect(Math.min(...ranks)).toBeGreaterThanOrEqual(6);
  });

  it('reset forgets voices and rate-limit history', () => {
    const gate = new SfxGate<string>({ maxVoices: 1 });
    expect(start(gate, req('a', 5), 0, 10).ok).toBe(true);
    expect(start(gate, req('b', 1), 0, 10).ok).toBe(false);
    gate.reset();
    expect(gate.active(0)).toBe(0);
    expect(start(gate, req('a', 5), 0, 10).ok).toBe(true);
  });
});

describe('SfxGate: a group with a budget of its own', () => {
  const match = (step: number): SfxRequest => req('match#' + step, 3, { group: 'match', groupLimit: 3 });

  it('allows three voices of the group; the fourth takes the place of the oldest', () => {
    const gate = new SfxGate<string>();
    expect(start(gate, match(1), 0).stolen).toEqual([]);
    expect(start(gate, match(2), 0.05).stolen).toEqual([]);
    expect(start(gate, match(3), 0.1).stolen).toEqual([]);
    expect(gate.active(0.1, 'match')).toBe(3);
    expect(start(gate, match(4), 0.15).stolen).toEqual(['match#1']);
    expect(start(gate, match(5), 0.2).stolen).toEqual(['match#2']);
    expect(gate.active(0.2, 'match')).toBe(3);
    expect(gate.active(0.2)).toBe(3);
  });

  it('does not count other sounds against the group, nor the group against itself once ended', () => {
    const gate = new SfxGate<string>();
    for (let i = 0; i < 6; i++) start(gate, req('other' + i, 4), 0, 1);
    for (let s = 1; s <= 3; s++) expect(start(gate, match(s), 0.01 * s, 0.2).stolen).toEqual([]);
    expect(gate.active(0.05, 'match')).toBe(3);
    expect(gate.active(0.05)).toBe(9);
    // the three have ended: three more fit without stealing
    for (let s = 4; s <= 6; s++) expect(start(gate, match(s), 0.5 + 0.01 * s, 0.2).stolen).toEqual([]);
  });

  it('four of the group in one instant: the fourth is dropped rather than churned', () => {
    const gate = new SfxGate<string>();
    for (let s = 1; s <= 3; s++) expect(start(gate, match(s), 1).ok).toBe(true);
    expect(start(gate, match(4), 1).ok).toBe(false);
    expect(gate.active(1, 'match')).toBe(3);
  });

  it('with the house full of louder voices the group still obeys the overall budget', () => {
    const gate = new SfxGate<string>({ maxVoices: 4 });
    for (let i = 0; i < 4; i++) start(gate, req('jingle' + i, 7), 0, 3);
    expect(start(gate, match(1), 1).ok).toBe(false);
  });
});

describe('effects and the gate', () => {
  it('every sound has a tier, and its rank is the tier\'s position', () => {
    for (const name of SFX_NAMES) {
      const tier = sfxTier(name);
      expect(SFX_TIERS).toContain(tier);
      expect(sfxRank(name)).toBe(SFX_TIERS.indexOf(tier));
    }
    expect(sfxRank('button')).toBeLessThan(sfxRank('land'));
    expect(sfxRank('land')).toBeLessThan(sfxRank('swap'));
    expect(sfxRank('swap')).toBeLessThan(sfxRank('match'));
    expect(sfxRank('match')).toBeLessThan(sfxRank('stone'));
    expect(sfxRank('stone')).toBeLessThan(sfxRank('beam'));
    expect(sfxRank('beam')).toBeLessThan(sfxRank('praise'));
    expect(sfxRank('praise')).toBeLessThan(sfxRank('win'));
  });

  it("'match' asks for its own three voices and 'land' for its own 60 ms", () => {
    const m = sfxRequest('match', { step: 4 });
    expect(m.key).toBe('match#4');
    expect(m.group).toBe('match');
    expect(m.groupLimit).toBe(SFX_MATCH_VOICES);
    expect(m.minInterval).toBeUndefined();
    const l = sfxRequest('land');
    expect(l.minInterval).toBe(SFX_LAND_INTERVAL);
    expect(l.group).toBeUndefined();
    expect(sfxRequest('beam').group).toBeUndefined();
  });

  it('flags big moments and jingles as priority, and they are what the music ducks under', () => {
    for (const name of ['win', 'lose', 'reward', 'purchase', 'star', 'goalDone', 'levelStart', 'praise', 'bigCombo', 'finale', 'chest', 'caravan'] as const) {
      expect(isPrioritySfx(name)).toBe(true);
      expect(sfxDucksMusic(name)).toBe(true);
    }
    for (const name of ['beam', 'nova', 'prism'] as const) {
      expect(isPrioritySfx(name)).toBe(false);
      expect(sfxDucksMusic(name)).toBe(true); // specials duck the music too
    }
    for (const name of ['match', 'land', 'button', 'swap', 'stone', 'coin', 'hint'] as const) {
      expect(isPrioritySfx(name)).toBe(false);
      expect(sfxDucksMusic(name)).toBe(false);
    }
  });
});
