/**
 * Tester mode (`?debug=1&tester=1`): what the owner's tester APK starts with (see
 * android/app/build.gradle.kts, -PtesterBuild=true). At every start the balance is topped up, so
 * that every part of the game can be tried at once: plenty of coins, plenty of every booster and
 * full lives. Together with the flag itself (every feature unlocked, every level open on the map)
 * this is the whole of tester mode. It never runs in a build that can be published: such a build
 * has no way to set the flag.
 */
import { ALL_BOOSTERS } from '../../state/types.ts';
import type { BoosterId } from '../../state/types.ts';

/** The balance a tester starts every session with (below the profile's own caps). */
export const TESTER_COINS = 99999;
export const TESTER_BOOSTERS = 50;

/** The few profile calls the top-up needs. */
export interface TesterProfile {
  coins(): number;
  addCoins(n: number): void;
  boosterCount(id: BoosterId): number;
  addBooster(id: BoosterId, n: number): void;
  addLife?: () => boolean;
}

/** Raise coins, boosters and lives to the tester's balance. Never lowers anything. */
export function topUpTester(profile: TesterProfile): void {
  const coins = profile.coins();
  if (coins < TESTER_COINS) profile.addCoins(TESTER_COINS - coins);
  for (const id of ALL_BOOSTERS) {
    const have = profile.boosterCount(id);
    if (have < TESTER_BOOSTERS) profile.addBooster(id, TESTER_BOOSTERS - have);
  }
  if (typeof profile.addLife === 'function') {
    // addLife() answers false once the lives are full
    for (let i = 0; i < 10 && profile.addLife(); i++);
  }
}
