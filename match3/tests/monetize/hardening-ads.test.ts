/**
 * The ad rules of DESIGN §7 against a tiny reference model, over long random lives of a player —
 * and the corners around them: a clock that runs backwards or not at all, ads that never report
 * back, results that arrive late, twice, or for the wrong format.
 *
 * The reference model below is the design text written down a second time, on purpose without
 * importing a single number from src/monetize: if the two disagree, one of them is wrong.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADS_ON, DAY, HOUR, MINUTE, SECOND, T0, greet, newMachine, promiseBook, rng, startSession, veteranSave } from './hardening-kit.ts';
import type { Machine, Session } from './hardening-kit.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ───────────────────────────── the reference model (DESIGN §7) ─────────────────────────────

type Placement = 'extraMoves' | 'freeLife' | 'freeCoins' | 'doubleReward';
const PLACEMENTS: Placement[] = ['extraMoves', 'freeLife', 'freeCoins', 'doubleReward'];

interface Ref {
  /** the level the player has reached */
  level: number;
  firstDay: number;
  /** has bought anything with real money, ever */
  paid: boolean;
  consent: boolean;
  rewardedLoaded: boolean;
  interstitialLoaded: boolean;
  /** levels finished since the last interstitial */
  finished: number;
  lastInterstitial: number | null;
  lastRewarded: number | null;
  /** the local day the two counters below belong to */
  day: number;
  interstitialsToday: number;
  earnedToday: Record<Placement, number>;
}

const dayOf = (ms: number): number => Math.floor(ms / DAY);

function today(ref: Ref, now: number): { interstitials: number; earned: Record<Placement, number>; total: number } {
  const fresh = dayOf(now) !== ref.day;
  const earned = fresh ? { extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 } : ref.earnedToday;
  return { interstitials: fresh ? 0 : ref.interstitialsToday, earned, total: earned.extraMoves + earned.freeLife + earned.freeCoins + earned.doubleReward };
}

function turnDay(ref: Ref, now: number): void {
  if (dayOf(now) === ref.day) return;
  ref.day = dayOf(now);
  ref.interstitialsToday = 0;
  ref.earnedToday = { extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 };
}

/** "None until the player has reached L25 and first played at least 3 local calendar days ago; then at most one per 3 finished levels, at least 180 s after the previous interstitial, never within 10 minutes of a rewarded ad, and at most 5 per local day. Never for anyone who has bought anything." */
function interstitialDue(ref: Ref, now: number): boolean {
  return (
    ref.consent &&
    ref.interstitialLoaded &&
    !ref.paid &&
    ref.level >= 25 &&
    dayOf(now) - ref.firstDay >= 3 &&
    ref.finished >= 3 &&
    (ref.lastInterstitial === null || now - ref.lastInterstitial >= 180 * SECOND) &&
    (ref.lastRewarded === null || now - ref.lastRewarded >= 10 * MINUTE) &&
    today(ref, now).interstitials < 5
  );
}

/** "Offered from L11; +1 life up to 3 per day; +50 coins up to 3 per day; at most 8 rewarded ads per local day in total." */
function rewardedLeft(ref: Ref, placement: Placement, now: number): number {
  const t = today(ref, now);
  const own = placement === 'freeLife' || placement === 'freeCoins' ? 3 - t.earned[placement] : Infinity;
  return Math.max(0, Math.min(8 - t.total, own));
}

function rewardedOffered(ref: Ref, now: number): boolean {
  return ref.consent && ref.rewardedLoaded && ref.level >= 11 && today(ref, now).total < 8;
}

// ───────────────────────────── the property ─────────────────────────────

interface LifeStats {
  interstitials: number;
  refusedInterstitials: number;
  rewardedEarned: number;
  refusedRewarded: number;
  steps: number;
  days: number;
}

async function life(seed: number, steps: number): Promise<LifeStats> {
  const rand = rng(seed);
  const chance = (p: number): boolean => rand() < p;
  const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

  const cleared = pick([0, 5, 9, 10, 22, 23, 24, 26, 40]);
  const daysAgo = pick([0, 1, 2, 3, 10]);
  const machine: Machine = newMachine({ save: veteranSave(cleared, daysAgo) });
  const ref: Ref = {
    level: cleared + 1,
    firstDay: dayOf(T0) - daysAgo,
    paid: false,
    consent: true,
    rewardedLoaded: true,
    interstitialLoaded: true,
    finished: 0,
    lastInterstitial: null,
    lastRewarded: null,
    day: dayOf(T0),
    interstitialsToday: 0,
    earnedToday: { extraMoves: 0, freeLife: 0, freeCoins: 0, doubleReward: 0 },
  };
  const stats: LifeStats = { interstitials: 0, refusedInterstitials: 0, rewardedEarned: 0, refusedRewarded: 0, steps: 0, days: 0 };
  const startDay = dayOf(T0);
  const book = promiseBook();
  let session: Session = startSession(machine);
  greet(session);
  let tokens = 0;
  const where = (): string => 'seed ' + seed + ' step ' + stats.steps;

  const pass = (ms: number): void => {
    machine.clock.now += ms;
    vi.advanceTimersByTime(ms);
  };
  const sendAds = (): void => session.send({ type: 'ads', canRequestAds: ref.consent, rewardedReady: ref.rewardedLoaded, interstitialReady: ref.interstitialLoaded, privacyOptionsRequired: false });
  /**
   * A full-screen ad is on screen for a while: the game is covered, then returns. (Now and then the
   * cover is not reported; such an ad must answer within the two minutes the store waits in front.)
   */
  const adPlays = (): void => {
    const covered = chance(0.8);
    if (covered) session.pause();
    pass(covered ? pick([0, 1, 5 * SECOND, 31 * SECOND, 3 * MINUTE, 40 * MINUTE]) : pick([0, 1, 5 * SECOND, 31 * SECOND, 119 * SECOND]));
    if (covered) {
      session.resume();
      pass(int(0, 14) * SECOND);
    }
  };

  for (stats.steps = 1; stats.steps <= steps; stats.steps++) {
    const r = rand();
    const now = (): number => machine.clock.now;
    if (r < 0.2) {
      pass(pick([1, 30 * SECOND, 180 * SECOND - 1, 180 * SECOND - 1, 180 * SECOND, 181 * SECOND, 10 * MINUTE - 1, 10 * MINUTE, HOUR, 5 * HOUR, DAY, 3 * DAY]));
    } else if (r < 0.55) {
      // a level ends
      ref.finished += 1;
      const due = interstitialDue(ref, now());
      const before = session.calls.length;
      const outcome = book.track('interstitial', session.store.maybeShowInterstitial());
      const asked = session.calls.slice(before).filter((c) => c === 'adShowInterstitial').length;
      expect(asked, where() + ': interstitial requested? ' + JSON.stringify(ref)).toBe(due ? 1 : 0);
      if (due) {
        adPlays();
        const shown = chance(0.85);
        session.send({ type: 'adResult', format: 'interstitial', result: shown ? 'dismissed' : 'failed' });
        if (shown) {
          turnDay(ref, now());
          ref.interstitialsToday += 1;
          ref.lastInterstitial = now();
          ref.finished = 0;
          stats.interstitials += 1;
        }
        expect(await outcome, where()).toBe(shown);
      } else {
        stats.refusedInterstitials += 1;
        expect(await outcome, where()).toBe(false);
      }
    } else if (r < 0.8) {
      // the player asks for a rewarded ad
      const placement = pick(PLACEMENTS);
      const allowed = rewardedOffered(ref, now()) && rewardedLeft(ref, placement, now()) > 0;
      const before = session.calls.length;
      const outcome = book.track('rewarded', session.store.showRewarded(placement));
      const asked = session.calls.slice(before).filter((c) => c === 'adShowRewarded:' + placement).length;
      expect(asked, where() + ': rewarded ' + placement + ' requested? ' + JSON.stringify(ref)).toBe(allowed ? 1 : 0);
      if (allowed) {
        adPlays();
        const result = pick(['earned', 'earned', 'earned', 'dismissed', 'failed'] as const);
        session.send({ type: 'adResult', format: 'rewarded', result });
        if (result !== 'failed') ref.lastRewarded = now();
        if (result === 'earned') {
          turnDay(ref, now());
          ref.earnedToday[placement] += 1;
          stats.rewardedEarned += 1;
        }
        expect(await outcome, where()).toBe(result === 'failed' ? 'unavailable' : result);
      } else {
        stats.refusedRewarded += 1;
        expect(await outcome, where()).toBe('unavailable');
      }
    } else if (r < 0.88) {
      // the next level is won
      if (ref.level <= 120) {
        session.profile.recordWin(ref.level, 1, 100, 1);
        ref.level = Math.min(120, ref.level + 1);
      }
    } else if (r < 0.93) {
      ref.consent = chance(0.85);
      ref.rewardedLoaded = chance(0.85);
      ref.interstitialLoaded = chance(0.85);
      sendAds();
    } else if (r < 0.96) {
      // the app is restarted: everything the rules need is in the save
      session.kill();
      session = startSession(machine);
      greet(session);
      sendAds();
    } else if (r < 0.975) {
      // real money: a coin pack, a restored entitlement — or a refund, which changes nothing
      // (only in some lives, and late: whoever has paid never sees an interstitial again)
      if (seed % 3 !== 0 || stats.steps < 250) continue;
      const which = rand();
      if (which < 0.4) {
        tokens += 1;
        session.send({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'life-' + seed + '-' + tokens });
        ref.paid = true;
      } else if (which < 0.7) {
        session.send({ type: 'owned', ids: [pick(['remove_ads', 'starter_pack'])] });
        ref.paid = true;
      } else {
        session.send({ type: 'owned', ids: [], complete: true });
      }
    } else if (r < 0.985) {
      // "reset progress": back to level 1 — the first-play day, the ad counters and the purchases stay
      if (seed % 5 !== 0) continue;
      session.profile.reset();
      ref.level = 1;
    } else {
      session.pause();
      pass(pick([SECOND, HOUR]));
      session.resume();
    }

    // what the screens are told must match the model after every step
    const t = machine.clock.now;
    expect(session.store.adsAvailable(), where()).toBe(ref.consent);
    expect(session.store.rewardedReady(), where() + ' rewardedReady ' + JSON.stringify(ref)).toBe(rewardedOffered(ref, t));
    for (const p of PLACEMENTS) expect(session.store.rewardedLeft(p), where() + ' left ' + p).toBe(rewardedLeft(ref, p, t));
    expect(session.store.freeCoinAdsLeft(), where()).toBe(rewardedLeft(ref, 'freeCoins', t));
  }
  stats.days = dayOf(machine.clock.now) - startDay;
  expect(book.open()).toEqual([]);
  expect(book.rejected).toEqual([]);
  return stats;
}

describe('property: the ad rules follow the reference model through whole lives of a player', () => {
  it('80 lives × 500 steps: every interstitial and every rewarded ad is requested exactly when DESIGN §7 allows it', async () => {
    const sum: LifeStats = { interstitials: 0, refusedInterstitials: 0, rewardedEarned: 0, refusedRewarded: 0, steps: 0, days: 0 };
    for (let seed = 1; seed <= 80; seed++) {
      const s = await life(seed, 500);
      for (const key of Object.keys(sum) as (keyof LifeStats)[]) sum[key] += s[key];
    }
    // the lives were long and varied enough to mean something
    expect(sum.interstitials).toBeGreaterThan(300);
    expect(sum.refusedInterstitials).toBeGreaterThan(5_000);
    expect(sum.rewardedEarned).toBeGreaterThan(1_000);
    expect(sum.refusedRewarded).toBeGreaterThan(1_000);
    expect(sum.days).toBeGreaterThan(1_000);
  }, 120_000);

  // A soak for whoever changes the ad rules: ADS_SOAK=1000 npx vitest run tests/monetize/hardening-ads.test.ts
  const soak = typeof process !== 'undefined' ? Math.floor(Number(process.env.ADS_SOAK)) || 0 : 0;
  it.skipIf(soak <= 0)('soak: ADS_SOAK more lives × 500 steps on fresh seeds', async () => {
    for (let i = 0; i < soak; i++) await life(50_000 + i, 500);
  }, 3_600_000);

  it('a clock that jumps backwards never brings an ad forward: the waiting times hold in real elapsed time', async () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = rng(seed * 7919);
      const chance = (p: number): boolean => rand() < p;
      const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
      const machine = newMachine({ save: veteranSave(30, 400) });
      const session = startSession(machine);
      greet(session);
      /** Real time, which only ever moves forward — unlike the device clock. */
      let real = 0;
      let lastInterstitialReal = -Infinity;
      let lastRewardedReal = -Infinity;
      const perDay: Record<number, number> = {};
      let shown = 0;
      for (let step = 0; step < 600; step++) {
        const r = rand();
        if (r < 0.3) {
          const ms = pick([SECOND, 60 * SECOND, 170 * SECOND, 4 * MINUTE, 11 * MINUTE, 2 * HOUR]);
          real += ms;
          machine.clock.now += ms;
          vi.advanceTimersByTime(ms);
        } else if (r < 0.4) {
          // somebody sets the device clock back (never forward)
          machine.clock.now -= pick([SECOND, 3 * MINUTE, 20 * MINUTE, 5 * HOUR, DAY, 30 * DAY]);
        } else if (r < 0.85) {
          const before = session.calls.length;
          const outcome = session.store.maybeShowInterstitial();
          if (session.calls.length > before) {
            const where = 'seed ' + seed + ' step ' + step;
            expect(real - lastInterstitialReal, where + ': less than 180 s after the previous interstitial').toBeGreaterThanOrEqual(180 * SECOND);
            expect(real - lastRewardedReal, where + ': less than 10 min after a rewarded ad').toBeGreaterThanOrEqual(10 * MINUTE);
            session.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
            lastInterstitialReal = real;
            const day = dayOf(machine.clock.now);
            perDay[day] = (perDay[day] || 0) + 1;
            expect(perDay[day], where + ': more than 5 on one local day').toBeLessThanOrEqual(5);
            shown += 1;
          }
          await outcome;
        } else {
          const outcome = session.store.showRewarded('doubleReward');
          session.send({ type: 'adResult', format: 'rewarded', result: chance(0.5) ? 'earned' : 'dismissed' });
          if ((await outcome) !== 'unavailable') lastRewardedReal = real;
        }
      }
      expect(shown, 'seed ' + seed + ': the rules must not block for ever either').toBeGreaterThan(0);
    }
  }, 120_000);
});

// ───────────────────────────── clocks ─────────────────────────────

/** A player for whom every rule except the one under test is satisfied: 2 levels finished, the 3rd is next. */
function ready(options: { storeNow?: () => number } = {}): { machine: Machine; session: Session; next(): Promise<boolean>; asked(): number } {
  const machine = newMachine({ save: veteranSave(30, 400) });
  const session = startSession(machine, options);
  greet(session);
  void session.store.maybeShowInterstitial();
  void session.store.maybeShowInterstitial();
  return {
    machine,
    session,
    next: () => session.store.maybeShowInterstitial(),
    asked: () => session.calls.filter((c) => c === 'adShowInterstitial').length,
  };
}

describe('clocks that cannot be trusted', () => {
  it('without a working clock the waiting times cannot be kept — so there is no interstitial at all', async () => {
    for (const broken of [() => NaN, () => Infinity, () => 0, () => -5, () => 'now' as unknown as number, (): number => { throw new Error('no clock'); }]) {
      const w = ready({ storeNow: broken });
      for (let i = 0; i < 5; i++) expect(await w.next()).toBe(false);
      expect(w.asked()).toBe(0);
    }
    // the same player with a clock gets one
    const w = ready();
    void w.next();
    expect(w.asked()).toBe(1);
  });

  it('an ad time that lies in the future (the clock was set back) blocks for one full waiting time from now — not for ever', async () => {
    const w = ready();
    const shown = w.next();
    w.session.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
    expect(await shown).toBe(true);
    const stamp = w.machine.clock.now;
    // the clock goes back a whole week
    w.machine.clock.now -= 7 * DAY;
    void w.next();
    void w.next();
    expect(await w.next()).toBe(false); // three levels later, "a week before" the last ad: no
    expect(w.session.profile.shop().lastInterstitial).toBe(w.machine.clock.now); // pulled back to now
    expect(w.session.profile.shop().lastInterstitial).toBeLessThan(stamp);
    w.machine.clock.now += 180 * SECOND - 1;
    expect(await w.next()).toBe(false);
    w.machine.clock.now += 1;
    // (the day counter still belongs to the "future" day, where one ad was counted: 4 are left)
    void w.next();
    expect(w.asked()).toBe(2);
  });

  it('the same after a rewarded ad: ten minutes from the moment the clock was found to be behind', async () => {
    const w = ready();
    const watched = w.session.store.showRewarded('extraMoves');
    w.session.send({ type: 'adResult', format: 'rewarded', result: 'dismissed' });
    expect(await watched).toBe('dismissed');
    w.machine.clock.now -= 30 * DAY;
    expect(await w.next()).toBe(false);
    expect(w.session.profile.shop().lastRewarded).toBe(w.machine.clock.now);
    w.machine.clock.now += 10 * MINUTE - 1;
    expect(await w.next()).toBe(false);
    w.machine.clock.now += 1;
    void w.next();
    expect(w.asked()).toBe(1);
  });

  it('a returning app still asks the store for news after the clock was set back', () => {
    const machine = newMachine({ save: veteranSave(30, 10) });
    const session = startSession(machine);
    greet(session);
    const restores = (): number => session.calls.filter((c) => c === 'iapRestore').length;
    expect(restores()).toBe(1);
    machine.clock.now -= 5 * DAY;
    session.pause();
    session.resume();
    expect(restores()).toBe(2);
  });
});

// ───────────────────────────── ads that do not behave ─────────────────────────────

describe('full-screen ads that do not report back', () => {
  function veteran(): { machine: Machine; session: Session } {
    const machine = newMachine({ save: veteranSave(30, 10) });
    const session = startSession(machine);
    greet(session);
    return { machine, session };
  }

  it('an ad that covered the game and then stayed silent counts as shown (no reward) — the frequency rules never err towards more ads', async () => {
    const { machine, session } = veteran();
    // rewarded
    const watched = session.store.showRewarded('freeCoins');
    session.pause(); // the ad is in front
    machine.clock.now += 40 * SECOND;
    vi.advanceTimersByTime(40 * SECOND);
    session.resume();
    machine.clock.now += 15 * SECOND;
    vi.advanceTimersByTime(15 * SECOND);
    expect(await watched).toBe('unavailable');
    expect(session.profile.shop().lastRewarded).toBe(machine.clock.now); // an ad was on screen
    expect(session.profile.adsToday().rewardedTotal).toBe(0); // …but nothing was earned
    expect(session.store.freeCoinAdsLeft()).toBe(3);
    // a result that still arrives afterwards changes nothing any more
    const saved = machine.disk.writes;
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(machine.disk.writes).toBe(saved);
    expect(session.profile.adsToday().rewardedTotal).toBe(0);

    // interstitial: three levels later and ten minutes on
    machine.clock.now += 11 * MINUTE;
    void session.store.maybeShowInterstitial();
    void session.store.maybeShowInterstitial();
    const shown = session.store.maybeShowInterstitial();
    expect(session.calls.filter((c) => c === 'adShowInterstitial')).toHaveLength(1);
    session.pause();
    session.resume();
    machine.clock.now += 15 * SECOND;
    vi.advanceTimersByTime(15 * SECOND);
    expect(await shown).toBe(false);
    expect(session.profile.adsToday().interstitials).toBe(1);
    expect(session.profile.shop().finished).toBe(0);
    expect(session.profile.shop().lastInterstitial).toBe(machine.clock.now);
  });

  it('an ad that never covered the game and stayed silent was not shown: nothing is booked', async () => {
    const { machine, session } = veteran();
    const watched = session.store.showRewarded('freeLife');
    machine.clock.now += 120 * SECOND;
    vi.advanceTimersByTime(120 * SECOND);
    expect(await watched).toBe('unavailable');
    expect(session.profile.shop().lastRewarded).toBe(0);
    expect(machine.disk.writes).toBe(0);
  });

  it('a return to the app that is never reported cannot leave the caller waiting for ever', async () => {
    const { session } = veteran();
    const book = promiseBook();
    void book.track('rewarded', session.store.showRewarded('extraMoves'));
    session.pause(); // …and no resume, ever
    await vi.advanceTimersByTimeAsync(119 * MINUTE);
    expect(book.open()).toEqual(['rewarded']); // a long ad is given its time
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(book.open()).toEqual([]);
    expect(book.values('rewarded')).toEqual(['unavailable']);
    // and the next ad can start
    session.resume();
    const again = session.store.showRewarded('extraMoves');
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(await again).toBe('earned');
  });

  it('results for the wrong format, results nobody asked for and doubled results reward nobody', async () => {
    const { session } = veteran();
    const saves = (): number => session.machine.disk.writes;
    // nobody asked
    for (const result of ['earned', 'dismissed', 'failed']) {
      session.send({ type: 'adResult', format: 'rewarded', result });
      session.send({ type: 'adResult', format: 'interstitial', result });
    }
    expect(saves()).toBe(0);
    // the wrong format does not end a rewarded ad
    let outcome: string | null = null;
    void session.store.showRewarded('freeCoins').then((o) => (outcome = o));
    session.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
    await Promise.resolve();
    expect(outcome).toBeNull();
    expect(session.profile.adsToday().interstitials).toBe(0);
    // the right one does, exactly once
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    await Promise.resolve();
    expect(outcome).toBe('earned');
    expect(session.profile.adsToday().rewarded.freeCoins).toBe(1);
    expect(session.store.freeCoinAdsLeft()).toBe(2);
  });

  it('a bridge that answers inside the call — and then throws — leaves no ad open and breaks no later ad', async () => {
    const { machine, session } = veteran();
    let mode: 'answer' | 'answerAndThrow' | 'throw' = 'answer';
    machine.onBridge = (s, name) => {
      if (name !== 'adShowRewarded' && name !== 'adShowInterstitial') return;
      const format = name === 'adShowRewarded' ? 'rewarded' : 'interstitial';
      if (mode !== 'throw') s.send({ type: 'adResult', format, result: format === 'rewarded' ? 'earned' : 'dismissed' });
      if (mode !== 'answer') throw new Error('bridge fell over');
    };
    expect(await session.store.showRewarded('doubleReward')).toBe('earned');
    mode = 'answerAndThrow';
    expect(await session.store.showRewarded('doubleReward')).toBe('earned'); // it WAS answered
    mode = 'throw';
    expect(await session.store.showRewarded('doubleReward')).toBe('unavailable');
    mode = 'answer';
    expect(await session.store.showRewarded('doubleReward')).toBe('earned');
    expect(session.profile.adsToday().rewarded.doubleReward).toBe(3);
    // a listener that starts the next ad from inside the answer of the previous one
    machine.onBridge = null;
    let chained: Promise<string> | null = null;
    const off = session.store.onChange(() => {
      if (!chained && session.profile.adsToday().rewarded.extraMoves === 1) chained = session.store.showRewarded('freeLife');
    });
    const first = session.store.showRewarded('extraMoves');
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(await first).toBe('earned');
    expect(chained).not.toBeNull();
    session.send({ type: 'adResult', format: 'rewarded', result: 'dismissed' });
    expect(await chained).toBe('dismissed');
    off();
  });

  it('DEFECT: the bridge answers inside the call, a listener starts the NEXT ad from that answer, then the call throws — the new ad must survive', async () => {
    const { machine, session } = veteran();
    const book = promiseBook();
    let calls = 0;
    machine.onBridge = (s, name) => {
      if (name !== 'adShowRewarded') return;
      calls += 1;
      if (calls > 1) return; // the second ad opens normally
      s.send({ type: 'adResult', format: 'rewarded', result: 'earned' }); // …the first is answered at once
      throw new Error('bridge fell over');
    };
    let started = false;
    session.store.onChange(() => {
      if (started || session.profile.adsToday().rewarded.extraMoves !== 1) return;
      started = true;
      void book.track('second', session.store.showRewarded('freeLife'));
    });
    void book.track('first', session.store.showRewarded('extraMoves'));
    await vi.advanceTimersByTimeAsync(0);
    expect(book.values('first')).toEqual(['earned']);
    expect(calls).toBe(2);
    expect(book.open()).toEqual(['second']); // open, with its watchdog intact
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    await vi.advanceTimersByTimeAsync(0);
    expect(book.values('second')).toEqual(['earned']);
    // and had the second one stayed silent, its watchdog would have answered
    void book.track('third', session.store.showRewarded('doubleReward'));
    await vi.advanceTimersByTimeAsync(120 * SECOND);
    expect(book.values('third')).toEqual(['unavailable']);
  });

  it('an interstitial is never requested while another full-screen ad is open, and never twice for one level', async () => {
    const { machine, session } = veteran();
    const rewarded = session.store.showRewarded('extraMoves'); // open, unanswered
    for (let i = 0; i < 6; i++) expect(await session.store.maybeShowInterstitial()).toBe(false);
    expect(session.calls.filter((c) => c === 'adShowInterstitial')).toHaveLength(0);
    session.send({ type: 'adResult', format: 'rewarded', result: 'failed' }); // it never showed: no ten-minute wait
    expect(await rewarded).toBe('unavailable');
    const first = session.store.maybeShowInterstitial();
    const second = session.store.maybeShowInterstitial(); // the same instant: one is already open
    expect(await second).toBe(false);
    expect(session.calls.filter((c) => c === 'adShowInterstitial')).toHaveLength(1);
    session.send({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
    expect(await first).toBe(true);
    machine.clock.now += HOUR;
    expect(session.profile.adsToday().interstitials).toBe(1);
  });

  it('a build with ads but without consent, without a loaded ad or without the level never reaches the bridge', async () => {
    const machine = newMachine({ save: veteranSave(9, 10) }); // level 10: rewarded ads start at 11
    const session = startSession(machine);
    greet(session);
    expect(await session.store.showRewarded('freeCoins')).toBe('unavailable');
    session.profile.recordWin(10, 1, 100, 1);
    session.send({ ...ADS_ON, canRequestAds: false });
    expect(await session.store.showRewarded('freeCoins')).toBe('unavailable');
    session.send({ ...ADS_ON, rewardedReady: false });
    expect(await session.store.showRewarded('freeCoins')).toBe('unavailable');
    expect(session.calls.filter((c) => c.indexOf('adShow') === 0)).toEqual([]);
    session.send(ADS_ON);
    const ok = session.store.showRewarded('freeCoins');
    expect(session.calls.filter((c) => c.indexOf('adShow') === 0)).toEqual(['adShowRewarded:freeCoins']);
    session.send({ type: 'adResult', format: 'rewarded', result: 'earned' });
    expect(await ok).toBe('earned');
  });
});
