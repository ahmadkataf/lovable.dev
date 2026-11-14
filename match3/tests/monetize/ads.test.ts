/**
 * Ads against a scripted bridge: availability, rewarded ads with their daily limits and watchdog,
 * the interstitial frequency rules of DESIGN §7 over long simulated sessions, the consent entry,
 * and change notifications.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTERSTITIALS_PER_DAY,
  INTERSTITIAL_AFTER_REWARDED_MS,
  INTERSTITIAL_EVERY_LEVELS,
  INTERSTITIAL_MIN_DAYS_PLAYED,
  INTERSTITIAL_MIN_GAP_MS,
  INTERSTITIAL_MIN_LEVEL,
  REWARDED_PER_DAY,
  REWARDED_PER_DAY_TOTAL,
  adContinueMoves,
  freeCoinsAmount,
} from '../../src/monetize/index.ts';
import type { AdPlacement, RewardedOutcome } from '../../src/monetize/types.ts';
import { ADS_READY, DAY, HOUR, MINUTE, SECOND, T0, world } from './harness.ts';
import type { World, WorldOptions } from './harness.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const TODAY = Math.floor(T0 / DAY);

/** A player far enough for everything: level 30 reached, first played ten days ago. */
function veteran(options: WorldOptions = {}): World {
  return world({ cleared: 29, save: { firstDay: TODAY - 10 }, ...options });
}

/** Watch one rewarded ad to the given end. */
async function watch(w: World, placement: AdPlacement, result: 'earned' | 'dismissed' | 'failed' = 'earned'): Promise<RewardedOutcome> {
  const outcome = w.store.showRewarded(placement);
  w.send({ type: 'adResult', format: 'rewarded', result });
  return outcome;
}

/** One level ends; if an interstitial is requested it is shown and closed. Returns whether one was shown. */
async function finishLevel(w: World): Promise<boolean> {
  const before = w.calls().length;
  const outcome = w.store.maybeShowInterstitial();
  if (w.calls().length > before) w.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
  return outcome;
}

describe('the numbers (DESIGN §7)', () => {
  it('rewarded: +3 moves, 50 coins, 3 lives and 3 coin ads a day, 8 a day in total', () => {
    expect(adContinueMoves).toBe(3);
    expect(freeCoinsAmount).toBe(50);
    expect(REWARDED_PER_DAY).toEqual({ extraMoves: null, freeLife: 3, freeCoins: 3, doubleReward: null });
    expect(REWARDED_PER_DAY_TOTAL).toBe(8);
  });

  it('interstitials: from level 25 and the 3rd day, one per 3 levels, 180 s apart, 10 min after a rewarded ad, 5 a day', () => {
    expect(INTERSTITIAL_MIN_LEVEL).toBe(25);
    expect(INTERSTITIAL_MIN_DAYS_PLAYED).toBe(3);
    expect(INTERSTITIAL_EVERY_LEVELS).toBe(3);
    expect(INTERSTITIAL_MIN_GAP_MS).toBe(180 * SECOND);
    expect(INTERSTITIAL_AFTER_REWARDED_MS).toBe(10 * MINUTE);
    expect(INTERSTITIALS_PER_DAY).toBe(5);
  });
});

describe('availability', () => {
  it('ads are available when the build has them AND consent allows requesting them', () => {
    const w = veteran({ silent: true });
    expect(w.store.adsAvailable()).toBe(false);
    expect(w.store.rewardedReady()).toBe(false);
    w.send({ type: 'ads', canRequestAds: false, rewardedReady: true, interstitialReady: true, privacyOptionsRequired: true });
    expect(w.store.adsAvailable()).toBe(false);
    expect(w.store.rewardedReady()).toBe(false);
    w.send(ADS_READY);
    expect(w.store.adsAvailable()).toBe(true);
    expect(w.store.rewardedReady()).toBe(true);
    w.send({ ...ADS_READY, rewardedReady: false });
    expect(w.store.adsAvailable()).toBe(true);
    expect(w.store.rewardedReady()).toBe(false);
    // only real booleans count
    w.send({ type: 'ads', canRequestAds: 'yes', rewardedReady: 1, interstitialReady: {}, privacyOptionsRequired: 'true' });
    expect(w.store.adsAvailable()).toBe(false);
    expect(w.store.privacyOptionsRequired()).toBe(false);
  });

  it('a build without the ad SDK never has ads, whatever events say', async () => {
    const w = veteran({ caps: { billing: true, ads: false } });
    expect(w.store.adsAvailable()).toBe(false);
    expect(w.store.rewardedReady()).toBe(false);
    expect(w.store.privacyOptionsRequired()).toBe(false);
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable');
    for (let i = 0; i < 10; i++) expect(await w.store.maybeShowInterstitial()).toBe(false);
    await w.store.showPrivacyOptions();
    expect(w.newCalls()).toEqual([]);
    expect(w.device.log).not.toContain('save'); // nothing to count, nothing written
  });

  it('rewarded ads start at level 11', async () => {
    const early = world({ cleared: 9 }); // reached level 10
    expect(early.store.adsAvailable()).toBe(true);
    expect(early.store.rewardedReady()).toBe(false);
    expect(await early.store.showRewarded('extraMoves')).toBe('unavailable');
    expect(early.newCalls()).toEqual([]);
    early.profile.recordWin(10, 1, 100, 0); // reaches level 11
    expect(early.store.rewardedReady()).toBe(true);
    expect(await watch(early, 'extraMoves')).toBe('earned');
  });
});

describe('rewarded ads', () => {
  it('earned / dismissed / failed, and the books: the store counts, the caller rewards', async () => {
    const w = veteran();
    const coins = w.profile.coins();
    expect(await watch(w, 'freeCoins', 'earned')).toBe('earned');
    expect(w.profile.coins()).toBe(coins); // the caller applies the reward
    expect(w.profile.adsToday()).toMatchObject({ rewardedTotal: 1, rewarded: { freeCoins: 1 } });
    expect(w.profile.shop().lastRewarded).toBe(T0);
    w.device.clock.now += MINUTE;
    expect(await watch(w, 'freeCoins', 'dismissed')).toBe('dismissed');
    expect(w.profile.adsToday().rewardedTotal).toBe(1); // closed early: no reward, not counted…
    expect(w.profile.shop().lastRewarded).toBe(T0 + MINUTE); // …but an ad was on screen
    w.device.clock.now += MINUTE;
    expect(await watch(w, 'freeCoins', 'failed')).toBe('unavailable');
    expect(w.profile.shop().lastRewarded).toBe(T0 + MINUTE);
    expect(w.newCalls()).toEqual(['adShowRewarded:freeCoins', 'adShowRewarded:freeCoins', 'adShowRewarded:freeCoins']);
  });

  it('refused without asking the bridge: unknown placement, no ad loaded, no consent', async () => {
    const w = veteran();
    expect(await w.store.showRewarded('banner' as AdPlacement)).toBe('unavailable');
    w.send({ ...ADS_READY, rewardedReady: false });
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable');
    w.send({ ...ADS_READY, canRequestAds: false });
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable');
    expect(w.newCalls()).toEqual([]);
  });

  it('only one full-screen ad at a time', async () => {
    const w = veteran();
    const first = w.store.showRewarded('extraMoves');
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable');
    for (let i = 0; i < 5; i++) expect(await w.store.maybeShowInterstitial()).toBe(false);
    expect(w.newCalls()).toEqual(['adShowRewarded:extraMoves']);
    // a result for the other format does not end it
    w.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
    w.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(await first).toBe('earned');
    expect(w.profile.adsToday().interstitials).toBe(0);
    // a stray result with no ad open changes nothing
    w.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(w.profile.adsToday().rewardedTotal).toBe(1);
  });

  it('free coins: three a day, counted only when earned, back on the next local day', async () => {
    const w = veteran({ now: T0 }); // 12:00 UTC
    expect(w.store.freeCoinAdsLeft()).toBe(3);
    expect(await watch(w, 'freeCoins', 'dismissed')).toBe('dismissed');
    expect(await watch(w, 'freeCoins', 'failed')).toBe('unavailable');
    expect(w.store.freeCoinAdsLeft()).toBe(3);
    for (let left = 2; left >= 0; left--) {
      expect(await watch(w, 'freeCoins')).toBe('earned');
      expect(w.store.freeCoinAdsLeft()).toBe(left);
      expect(w.store.rewardedLeft('freeCoins')).toBe(left);
    }
    w.newCalls();
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable'); // used up: the bridge is not asked
    expect(w.newCalls()).toEqual([]);
    expect(w.store.rewardedReady()).toBe(true); // other placements still have ads today
    expect(await watch(w, 'extraMoves')).toBe('earned');
    // the last millisecond of the day, a restart, and a clock set back change nothing…
    w.device.clock.now = T0 + 12 * HOUR - 1;
    expect(w.store.freeCoinAdsLeft()).toBe(0);
    expect(w.restart().store.freeCoinAdsLeft()).toBe(0);
    w.device.clock.now = T0 - 3 * DAY;
    expect(w.store.freeCoinAdsLeft()).toBe(0);
    // …local midnight does
    w.device.clock.now = T0 + 12 * HOUR;
    expect(w.store.freeCoinAdsLeft()).toBe(3);
    expect(await watch(w, 'freeCoins')).toBe('earned');
    expect(w.store.freeCoinAdsLeft()).toBe(2);
  });

  it('a free life: three a day; at most eight rewarded ads a day over all placements', async () => {
    const w = veteran();
    for (let i = 0; i < 3; i++) expect(await watch(w, 'freeLife')).toBe('earned');
    expect(w.store.rewardedLeft('freeLife')).toBe(0);
    expect(await w.store.showRewarded('freeLife')).toBe('unavailable');
    expect(w.store.rewardedLeft('doubleReward')).toBe(5);
    for (let i = 0; i < 2; i++) expect(await watch(w, 'doubleReward')).toBe('earned');
    for (let i = 0; i < 2; i++) expect(await watch(w, 'extraMoves')).toBe('earned');
    // seven so far: one more of anything that still has its own allowance
    expect(w.store.rewardedLeft('freeCoins')).toBe(1);
    expect(w.store.rewardedLeft('extraMoves')).toBe(1);
    expect(await watch(w, 'freeCoins')).toBe('earned');
    for (const placement of ['extraMoves', 'freeLife', 'freeCoins', 'doubleReward'] as const) {
      expect(w.store.rewardedLeft(placement)).toBe(0);
      expect(await w.store.showRewarded(placement)).toBe('unavailable');
    }
    expect(w.store.rewardedReady()).toBe(false); // nothing left today: no offer anywhere
    expect(w.store.adsAvailable()).toBe(true);
    expect(w.calls().filter((c) => c.indexOf('adShowRewarded') === 0)).toHaveLength(8);
    w.device.clock.now += DAY;
    expect(w.store.rewardedReady()).toBe(true);
    expect(w.store.rewardedLeft('freeLife')).toBe(3);
    expect(w.store.rewardedLeft('banner' as AdPlacement)).toBe(0);
  });

  it('watchdog: no result within 120 s resolves "unavailable" — never a dangling promise', async () => {
    const w = veteran();
    const outcome = w.store.showRewarded('extraMoves');
    let settled: string | null = null;
    void outcome.then((o) => (settled = o));
    vi.advanceTimersByTime(120 * SECOND - 1);
    await Promise.resolve();
    expect(settled).toBeNull();
    vi.advanceTimersByTime(1);
    expect(await outcome).toBe('unavailable');
    expect(w.profile.adsToday().rewardedTotal).toBe(0);
    // the next ad can start
    expect(await watch(w, 'extraMoves')).toBe('earned');
    // same for an interstitial
    w.device.clock.now += HOUR;
    w.store.maybeShowInterstitial();
    w.store.maybeShowInterstitial();
    const shown = w.store.maybeShowInterstitial();
    expect(w.newCalls().slice(-1)).toEqual(['adShowInterstitial']);
    vi.advanceTimersByTime(120 * SECOND);
    expect(await shown).toBe(false);
  });

  it('a result that arrives after the watchdog is booked as "an ad was on screen", without a reward', async () => {
    const w = veteran();
    const outcome = w.store.showRewarded('freeCoins');
    vi.advanceTimersByTime(120 * SECOND);
    expect(await outcome).toBe('unavailable');
    w.device.clock.now += 5 * MINUTE;
    w.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(w.profile.adsToday().rewardedTotal).toBe(0); // the caller gave nothing, so nothing is counted
    expect(w.profile.shop().lastRewarded).toBe(T0 + 5 * MINUTE);
    w.send({ type: 'adResult', format: 'rewarded', result: 'earned' }); // only once
    expect(w.device.log.filter((e) => e === 'save')).toHaveLength(1);
  });

  it('time in the background does not count against an open ad; back in front the result is due within 15 s', async () => {
    const w = veteran();
    const outcome = w.store.showRewarded('doubleReward');
    w.pause(); // the ad covers the game
    vi.advanceTimersByTime(10 * MINUTE); // a long ad, a visit to the advertiser's page…
    w.resume();
    vi.advanceTimersByTime(5 * SECOND);
    w.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(await outcome).toBe('earned');
    // …but silence after the return is answered
    const silent = w.store.showRewarded('doubleReward');
    w.pause();
    vi.advanceTimersByTime(HOUR);
    w.resume();
    vi.advanceTimersByTime(15 * SECOND);
    expect(await silent).toBe('unavailable');
  });

  it('a bridge that throws is "unavailable", and the next ad can still start', async () => {
    const w = veteran({ broken: ['adShowRewarded', 'adShowInterstitial', 'adPrivacyOptions'] });
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable');
    expect(await w.store.showRewarded('freeCoins')).toBe('unavailable');
    for (let i = 0; i < 4; i++) expect(await w.store.maybeShowInterstitial()).toBe(false);
    await w.store.showPrivacyOptions();
    expect(w.calls().filter((c) => c === 'adShowRewarded:freeCoins')).toHaveLength(2);
  });
});

describe('interstitials', () => {
  it('at most one per three finished levels — every call counts one level', async () => {
    const w = veteran();
    const shown: boolean[] = [];
    for (let level = 0; level < 12; level++) {
      shown.push(await finishLevel(w));
      w.device.clock.now += 4 * MINUTE; // a level takes a while: the 180 s gap is never the limit here
    }
    expect(shown).toEqual([false, false, true, false, false, true, false, false, true, false, false, true]);
    expect(w.profile.adsToday().interstitials).toBe(4);
    expect(w.calls().filter((c) => c === 'adShowInterstitial')).toHaveLength(4);
  });

  it('resolves false at once when no ad is shown, true only when one was shown and closed', async () => {
    const w = veteran();
    expect(await w.store.maybeShowInterstitial()).toBe(false);
    expect(await w.store.maybeShowInterstitial()).toBe(false);
    const third = w.store.maybeShowInterstitial();
    let settled = false;
    void third.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false); // the ad is on screen
    w.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
    expect(await third).toBe(true);
    expect(w.saved().shop).toMatchObject({ finished: 0, interstitials: 1, lastInterstitial: T0 });
    // an ad that failed to show is not an ad: the level count stays, the next level end tries again
    w.device.clock.now += HOUR;
    await w.store.maybeShowInterstitial();
    await w.store.maybeShowInterstitial();
    const failed = w.store.maybeShowInterstitial();
    w.send({ type: 'adResult', format: 'interstitial', result: 'failed' });
    expect(await failed).toBe(false);
    expect(w.profile.adsToday().interstitials).toBe(1);
    expect(await finishLevel(w)).toBe(true);
  });

  it('none before level 25 has been reached', async () => {
    const w = world({ cleared: 22, save: { firstDay: TODAY - 30 } }); // reached level 23
    for (let i = 0; i < 9; i++) expect(await finishLevel(w)).toBe(false);
    w.profile.recordWin(23, 1, 100, 0); // reached level 24
    for (let i = 0; i < 3; i++) expect(await finishLevel(w)).toBe(false);
    w.profile.recordWin(24, 1, 100, 0); // reached level 25
    expect(await finishLevel(w)).toBe(true);
    expect(w.calls().filter((c) => c === 'adShowInterstitial')).toHaveLength(1);
  });

  it('none until the third local calendar day after the first play', async () => {
    const w = world({ cleared: 40, now: T0 }); // a fast player on her first day
    w.profile.recordAttempt(); // the first save stamps the day
    for (let i = 0; i < 6; i++) expect(await finishLevel(w)).toBe(false);
    w.device.clock.now = T0 + 2 * DAY + 11 * HOUR; // day 3 (two days later), 23:00
    for (let i = 0; i < 6; i++) expect(await finishLevel(w)).toBe(false);
    w.device.clock.now += HOUR; // the next local midnight: three days after the first
    expect(await finishLevel(w)).toBe(true);
  });

  it('at least 180 s after the previous interstitial', async () => {
    const w = veteran();
    await finishLevel(w);
    await finishLevel(w);
    expect(await finishLevel(w)).toBe(true); // at T0
    w.device.clock.now += 60 * SECOND;
    expect(await finishLevel(w)).toBe(false);
    expect(await finishLevel(w)).toBe(false);
    expect(await finishLevel(w)).toBe(false); // three levels done, but only a minute passed
    w.device.clock.now = T0 + 180 * SECOND - 1;
    expect(await finishLevel(w)).toBe(false);
    w.device.clock.now = T0 + 180 * SECOND;
    expect(await finishLevel(w)).toBe(true);
  });

  it('never within ten minutes of a rewarded ad — earned or closed early', async () => {
    const w = veteran();
    await finishLevel(w);
    await finishLevel(w);
    expect(await watch(w, 'extraMoves', 'earned')).toBe('earned'); // at T0
    expect(await finishLevel(w)).toBe(false);
    w.device.clock.now = T0 + 10 * MINUTE - 1;
    expect(await finishLevel(w)).toBe(false);
    w.device.clock.now = T0 + 10 * MINUTE;
    expect(await finishLevel(w)).toBe(true);
    // a rewarded ad that was closed early was a full-screen ad all the same
    w.device.clock.now += HOUR;
    const mark = w.device.clock.now;
    expect(await watch(w, 'doubleReward', 'dismissed')).toBe('dismissed');
    for (let i = 0; i < 3; i++) expect(await finishLevel(w)).toBe(false);
    w.device.clock.now = mark + 10 * MINUTE;
    expect(await finishLevel(w)).toBe(true);
    // one that failed to load was no ad
    w.device.clock.now += HOUR;
    expect(await watch(w, 'doubleReward', 'failed')).toBe('unavailable');
    for (let i = 0; i < 2; i++) expect(await finishLevel(w)).toBe(false);
    expect(await finishLevel(w)).toBe(true);
  });

  it('at most five a day; the count starts again on the next local day', async () => {
    const w = veteran({ now: T0 - 12 * HOUR }); // local midnight
    let shown = 0;
    for (let level = 0; level < 60; level++) {
      if (await finishLevel(w)) shown++;
      w.device.clock.now += 5 * MINUTE;
    }
    expect(shown).toBe(5);
    expect(w.profile.adsToday().interstitials).toBe(5);
    w.device.clock.now = T0 + 12 * HOUR; // next midnight
    expect(await finishLevel(w)).toBe(true);
    expect(w.profile.adsToday().interstitials).toBe(1);
  });

  it('only when an interstitial is loaded, and never without consent', async () => {
    const w = veteran();
    w.send({ ...ADS_READY, interstitialReady: false });
    for (let i = 0; i < 5; i++) expect(await finishLevel(w)).toBe(false);
    w.send({ ...ADS_READY, canRequestAds: false });
    expect(await finishLevel(w)).toBe(false);
    expect(w.newCalls()).toEqual([]);
    w.send(ADS_READY);
    expect(await finishLevel(w)).toBe(true); // the levels were counted meanwhile
  });

  it('never for anyone who has bought anything with real money — a coin pack is enough', async () => {
    const w = veteran();
    const buying = w.store.buy('coins_small');
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 't1' });
    await buying;
    for (let i = 0; i < 30; i++) {
      expect(await finishLevel(w)).toBe(false);
      w.device.clock.now += 5 * MINUTE;
    }
    w.device.clock.now += 3 * DAY;
    const next = w.restart();
    for (let i = 0; i < 9; i++) expect(await finishLevel(next)).toBe(false);
    expect(next.calls().filter((c) => c === 'adShowInterstitial')).toEqual([]);
  });

  it('never for owners of remove_ads or the starter pack — bought or restored — and rewarded ads stay', async () => {
    for (const id of ['remove_ads', 'starter_pack'] as const) {
      const bought = veteran();
      const buying = bought.store.buy(id);
      bought.send({ type: 'purchase', id, state: 'purchased', token: 'tok-' + id });
      await buying;
      const restored = veteran();
      restored.send({ type: 'owned', ids: [id] });
      for (const w of [bought, restored]) {
        expect(w.store.owns(id)).toBe(true);
        for (let i = 0; i < 12; i++) {
          expect(await finishLevel(w)).toBe(false);
          w.device.clock.now += 5 * MINUTE;
        }
        expect(w.calls().filter((c) => c === 'adShowInterstitial')).toEqual([]);
        // removing ads never removes the optional, rewarded ones
        expect(w.store.adsAvailable()).toBe(true);
        expect(w.store.rewardedReady()).toBe(true);
        expect(w.store.rewardedLeft('freeCoins')).toBe(3);
        expect(await watch(w, 'freeCoins')).toBe('earned');
        expect(await watch(w, 'extraMoves')).toBe('earned');
      }
    }
  });

  it('a refund that takes remove_ads away does not bring the interstitials back', async () => {
    const w = veteran({ save: { firstDay: TODAY - 10, shop: { ...world().profile.shop(), owned: ['remove_ads'], purchased: true } } });
    w.send({ type: 'owned', ids: [], complete: true });
    expect(w.store.owns('remove_ads')).toBe(false);
    for (let i = 0; i < 9; i++) expect(await finishLevel(w)).toBe(false);
  });

  it('a long session: every rule at once', async () => {
    // Day 1 of a new player who races to level 30, then plays 200 levels over a week with a
    // rewarded ad now and then. Every interstitial that is shown is checked against every rule.
    const w = world({ cleared: 29, now: T0 - 12 * HOUR });
    w.profile.recordAttempt();
    const firstDay = Math.floor(w.device.clock.now / DAY);
    let lastInterstitial = -Infinity;
    let lastRewarded = -Infinity;
    let sinceInterstitial = 0;
    const perDay: Record<number, number> = {};
    let total = 0;
    for (let level = 0; level < 200; level++) {
      w.device.clock.now += (level % 7 === 0 ? 40 : 2) * MINUTE + (level % 5) * 13 * SECOND;
      if (level % 20 === 19) w.device.clock.now += 20 * HOUR; // sleep
      if (level % 9 === 4 && w.store.rewardedReady()) {
        const outcome = await watch(w, 'extraMoves', level % 2 ? 'earned' : 'dismissed');
        if (outcome !== 'unavailable') lastRewarded = w.device.clock.now;
        w.device.clock.now += 30 * SECOND;
      }
      sinceInterstitial += 1;
      const now = w.device.clock.now;
      if (await finishLevel(w)) {
        const day = Math.floor(now / DAY);
        expect(day - firstDay, 'day ' + day).toBeGreaterThanOrEqual(3);
        expect(sinceInterstitial).toBeGreaterThanOrEqual(3);
        expect(now - lastInterstitial).toBeGreaterThanOrEqual(180 * SECOND);
        expect(now - lastRewarded).toBeGreaterThanOrEqual(10 * MINUTE);
        perDay[day] = (perDay[day] ?? 0) + 1;
        expect(perDay[day]).toBeLessThanOrEqual(5);
        lastInterstitial = now;
        sinceInterstitial = 0;
        total++;
      }
    }
    expect(total).toBeGreaterThan(15); // the rules allow a fair number…
    expect(total).toBeLessThanOrEqual(200 / 3); // …and never more than one per three levels
    expect(Object.keys(perDay).length).toBeGreaterThan(3);
  });
});

describe('privacy options', () => {
  it('the entry follows the consent SDK; the form resolves when the wrapper reports back', async () => {
    const w = veteran();
    expect(w.store.privacyOptionsRequired()).toBe(false);
    w.send({ ...ADS_READY, privacyOptionsRequired: true });
    expect(w.store.privacyOptionsRequired()).toBe(true);
    expect(w.changes.count).toBe(1);
    const form = w.store.showPrivacyOptions();
    expect(w.newCalls()).toEqual(['adPrivacyOptions']);
    let closed = false;
    void form.then(() => (closed = true));
    await Promise.resolve();
    expect(closed).toBe(false);
    w.send({ ...ADS_READY, canRequestAds: false, privacyOptionsRequired: true }); // consent withdrawn
    await form;
    expect(w.store.adsAvailable()).toBe(false);
    // a wrapper that never reports back does not leave the promise open
    const silent = w.store.showPrivacyOptions();
    vi.advanceTimersByTime(120 * SECOND);
    await silent;
  });
});

describe('onChange', () => {
  it('fires once per event that changed something, and not for events that changed nothing', () => {
    const w = veteran({ silent: true });
    w.send({ type: 'products', products: [{ id: 'coins_small', price: 'US$0.99' }, { id: 'remove_ads', price: 'US$2.99' }, { id: 'coins_xl', price: 'US$19.99' }] });
    expect(w.changes.count).toBe(1); // three products, one notification
    w.send({ type: 'products', products: [{ id: 'coins_xl', price: 'US$19.99' }, { id: 'coins_small', price: 'US$0.99' }, { id: 'remove_ads', price: 'US$2.99' }] });
    expect(w.changes.count).toBe(1); // the same answer again
    w.send(ADS_READY);
    w.send(ADS_READY);
    expect(w.changes.count).toBe(2);
    w.send({ type: 'owned', ids: ['remove_ads', 'starter_pack'] });
    expect(w.changes.count).toBe(3); // two entitlements, one notification
    w.send({ type: 'owned', ids: ['remove_ads', 'starter_pack'] });
    expect(w.changes.count).toBe(3);
    w.send({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
    expect(w.changes.count).toBe(3);
    w.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 't' });
    expect(w.changes.count).toBe(4);
  });

  it('listeners see the finished state, are never re-entered, and may unsubscribe or throw', async () => {
    const w = veteran({ silent: true });
    const seen: string[] = [];
    let inside = 0;
    let deepest = 0;
    let nested = 2;
    const off = w.store.onChange(() => {
      inside += 1;
      deepest = Math.max(deepest, inside);
      seen.push(w.store.products().length + ' products, ads ' + w.store.adsAvailable());
      if (nested > 0) {
        nested -= 1;
        // a listener that itself causes changes: announced afterwards, in a further round
        w.send(nested === 1 ? ADS_READY : { ...ADS_READY, privacyOptionsRequired: true });
      }
      inside -= 1;
    });
    w.store.onChange(() => {
      throw new Error('listener bug');
    });
    let later = 0;
    w.store.onChange(() => (later += 1));
    w.send({ type: 'products', products: [{ id: 'coins_small', price: 'US$0.99' }] });
    expect(seen).toEqual(['1 products, ads false', '1 products, ads true', '1 products, ads true']);
    expect(deepest).toBe(1);
    expect(later).toBe(3); // a throwing listener does not stop the others
    off();
    off();
    w.send({ type: 'products', products: [] });
    expect(seen).toHaveLength(3);
    expect(later).toBe(4);
    for (const junk of [undefined, null, 5, 'x', {}]) expect(typeof w.store.onChange(junk as unknown as () => void)).toBe('function');
    w.send({ type: 'products', products: [{ id: 'coins_small', price: 'US$0.99' }] });
    expect(later).toBe(5);
  });

  it('ad results notify too (the remaining counts changed)', async () => {
    const w = veteran();
    const before = w.changes.count;
    await watch(w, 'freeCoins');
    expect(w.changes.count).toBe(before + 1);
  });
});
