import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/state/index.ts';
import { ALL_BOOSTERS } from '../../src/state/types.ts';
import { TESTER_BOOSTERS, TESTER_COINS, topUpTester } from '../../src/ui/dev/tester.ts';

const T0 = Date.UTC(2026, 10, 14, 9, 0, 0);

function newProfile(saved: string | null = null) {
  let json = saved;
  const profile = createProfile({ load: () => json, save: (s) => { json = s; }, now: () => T0, levelCount: 120 });
  return { profile, saved: () => json };
}

describe('tester mode top-up', () => {
  it('gives a new profile the tester balance and full lives', () => {
    const { profile } = newProfile();
    topUpTester(profile);
    expect(profile.coins()).toBe(TESTER_COINS);
    for (const id of ALL_BOOSTERS) expect(profile.boosterCount(id)).toBe(TESTER_BOOSTERS);
    expect(profile.lives().count).toBe(profile.lives().max);
  });

  it('tops up again after spending, never lowers a larger balance, and is saved', () => {
    const a = newProfile();
    topUpTester(a.profile);
    expect(a.profile.buyBooster('hammer')).toBe(true);
    const spent = a.profile.coins();
    expect(spent).toBeLessThan(TESTER_COINS);
    topUpTester(a.profile);
    expect(a.profile.coins()).toBe(TESTER_COINS);
    expect(a.profile.boosterCount('hammer')).toBe(TESTER_BOOSTERS + 1); // the bought one stays
    // the balance is part of the real save: the next start loads it
    const b = newProfile(a.saved());
    expect(b.profile.coins()).toBe(TESTER_COINS);
    expect(b.profile.boosterCount('hammer')).toBe(TESTER_BOOSTERS + 1);
  });
});
