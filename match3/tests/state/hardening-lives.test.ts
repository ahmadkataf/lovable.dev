/**
 * Hardening: lives regeneration checked against an independent reference model over long random
 * sequences of clock changes (forwards and backwards), lost lives, refills, life rewards and restarts.
 *
 * The model is deliberately written differently from the implementation: it keeps no timestamps at
 * all, only "how far the current interval has progressed", and is fed time DIFFERENCES.
 * Rules it encodes (DESIGN §5 and the profile's documented behaviour):
 *  - at most 5 lives; while fewer, 20 minutes of progress make one life; full ⇒ no progress is kept;
 *  - time is only noticed when the profile looks at its lives (it is lazy), so only the net change
 *    since the last look counts;
 *  - a clock that moved backwards takes progress away but never below zero and never takes a life;
 *  - refilling costs 120 coins and needs a missing life.
 */
import { describe, expect, it } from 'vitest';
import { createProfile, fixedOffsetDayNumber, freshSave } from '../../src/state/index.ts';
import type { ProfileApi, Reward } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, SECOND, harness, rng } from './harness.ts';
import type { Harness } from './harness.ts';

const INTERVAL = 20 * MINUTE;
const FULL = 5;
const REFILL_PRICE = 120;

class LivesModel {
  lives = FULL;
  progress = 0;
  coins = 150;
  private seenAt: number;

  constructor(now: number) {
    this.seenAt = now;
  }

  /** The profile looked at its lives at time `now`. */
  look(now: number): void {
    const elapsed = now - this.seenAt;
    this.seenAt = now;
    if (this.lives >= FULL) {
      this.progress = 0;
      return;
    }
    this.progress = Math.max(0, this.progress + elapsed);
    while (this.lives < FULL && this.progress >= INTERVAL) {
      this.lives += 1;
      this.progress -= INTERVAL;
    }
    if (this.lives >= FULL) this.progress = 0;
  }

  info(now: number): { count: number; max: number; nextInMs: number } {
    this.look(now);
    return { count: this.lives, max: FULL, nextInMs: this.lives >= FULL ? 0 : INTERVAL - this.progress };
  }

  lose(now: number): boolean {
    this.look(now);
    if (this.lives <= 0) return false;
    this.lives -= 1;
    return true;
  }

  refill(now: number): boolean {
    this.look(now);
    if (this.lives >= FULL || this.coins < REFILL_PRICE) return false;
    this.coins -= REFILL_PRICE;
    this.lives = FULL;
    this.progress = 0;
    return true;
  }

  /** `amount` undefined = refill everything. Returns whether anything changed. */
  reward(now: number, amount: number | undefined): boolean {
    this.look(now);
    if (this.lives >= FULL) return false;
    this.lives = Math.min(FULL, this.lives + (amount === undefined ? FULL : amount));
    if (this.lives >= FULL) this.progress = 0;
    return true;
  }
}

/** Clock steps that matter: around the interval, tiny, huge, and backwards. */
function clockStep(random: () => number): number {
  const roll = random();
  if (roll < 0.1) return Math.floor(random() * 10); // a few milliseconds
  if (roll < 0.35) return Math.floor(random() * 25 * MINUTE);
  if (roll < 0.45) return INTERVAL + Math.floor(random() * 3) - 1; // exactly on the edge
  if (roll < 0.55) return Math.floor(random() * 3 * HOUR);
  if (roll < 0.6) return Math.floor(random() * 3 * DAY);
  if (roll < 0.65) return 0;
  if (roll < 0.8) return -Math.floor(random() * 25 * MINUTE); // small backwards correction
  if (roll < 0.9) return -Math.floor(random() * 5 * HOUR);
  if (roll < 0.95) return -(INTERVAL + Math.floor(random() * 3) - 1);
  return -Math.floor(random() * 400 * DAY); // the clock was reset
}

function run(seed: number, steps: number): { regenerated: number; refills: number; backwards: number } {
  const random = rng(seed);
  let h: Harness = harness();
  const model = new LivesModel(h.clock.now);
  const count = { regenerated: 0, refills: 0, backwards: 0 };

  for (let step = 0; step < steps; step++) {
    const where = `seed ${seed}, step ${step}`;
    const writesBefore = h.storage.writes;
    const notesBefore = h.notifications.count;
    const livesBefore = model.lives;
    let mutated: boolean | null = null; // null = the step made no API call that could change anything

    const roll = random();
    if (roll < 0.34) {
      const dt = clockStep(random);
      if (dt < 0) count.backwards += 1;
      h.clock.now = Math.max(1_000, h.clock.now + dt);
    } else if (roll < 0.56) {
      mutated = model.lose(h.clock.now);
      expect(h.profile.loseLife(), where).toBe(mutated);
      if (model.lives + (mutated ? 1 : 0) > livesBefore) count.regenerated += 1;
    } else if (roll < 0.64) {
      mutated = model.refill(h.clock.now);
      expect(h.profile.refillLives(), where).toBe(mutated);
      if (mutated) count.refills += 1;
    } else if (roll < 0.7) {
      // Coins change without the profile looking at the clock.
      const amount = 40 + Math.floor(random() * 120);
      model.coins += amount;
      h.profile.addCoins(amount);
      mutated = true;
    } else if (roll < 0.78) {
      const amount = random() < 0.3 ? undefined : 1 + Math.floor(random() * 3);
      const reward: Reward = amount === undefined ? { kind: 'lives' } : { kind: 'lives', amount };
      mutated = model.reward(h.clock.now, amount);
      h.profile.grant([reward]);
    } else if (roll < 0.86) {
      model.look(h.clock.now);
      h = h.restart(); // loading looks at the lives once
    } else if (roll < 0.93) {
      expect(h.profile.lives(), where).toEqual(model.info(h.clock.now));
    } else {
      model.look(h.clock.now);
      const data = h.profile.data();
      expect(data.lives, where).toBe(model.lives);
      expect(data.lifeTimer, where).toBe(model.lives >= FULL ? 0 : h.clock.now - model.progress);
    }

    // The return values above are the main evidence; the raw state is compared without making the
    // profile look at the clock again (the stored copy is read instead of calling lives()).
    expect(h.profile.coins(), where).toBe(model.coins);
    if (mutated === true) {
      expect(h.storage.writes - writesBefore, where + ': a change is stored exactly once').toBe(1);
      expect(h.notifications.count - notesBefore, where + ': a change is announced exactly once').toBe(1);
      const saved = h.saved();
      expect(saved.lives, where).toBe(model.lives);
      expect(saved.coins, where).toBe(model.coins);
    } else if (mutated === false) {
      expect(h.storage.writes - writesBefore, where + ': a refused call stores at most once').toBeLessThanOrEqual(1);
      expect(h.notifications.count - notesBefore, where + ': a refused call is silent').toBe(0);
    } else {
      expect(h.storage.writes - writesBefore, where).toBeLessThanOrEqual(1);
    }
    if (h.storage.json !== null) {
      const saved = h.saved();
      expect(saved.lives >= 0 && saved.lives <= FULL, where).toBe(true);
      expect(saved.lives === FULL ? saved.lifeTimer === 0 : saved.lifeTimer > 0, where).toBe(true);
    }
  }
  // Final agreement, down to the millisecond.
  expect(h.profile.lives()).toEqual(model.info(h.clock.now));
  return count;
}

describe('hardening: lives against a reference model', () => {
  it('agrees over 40 random histories of 2,500 steps each', () => {
    const total = { regenerated: 0, refills: 0, backwards: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const c = run(seed, 2500);
      total.regenerated += c.regenerated;
      total.refills += c.refills;
      total.backwards += c.backwards;
    }
    // The histories really did exercise what they are meant to.
    expect(total.regenerated).toBeGreaterThan(500);
    expect(total.refills).toBeGreaterThan(100);
    expect(total.backwards).toBeGreaterThan(2000);
  });

  it('agrees when the clock only ever creeps (many looks inside one interval)', () => {
    const h = harness();
    const model = new LivesModel(h.clock.now);
    const random = rng(5);
    for (let step = 0; step < 4000; step++) {
      h.clock.now += Math.floor(random() * 2 * SECOND) - (random() < 0.2 ? 3 * SECOND : 0);
      if (random() < 0.02) expect(h.profile.loseLife()).toBe(model.lose(h.clock.now));
      expect(h.profile.lives()).toEqual(model.info(h.clock.now));
    }
  });
});

describe('hardening: lives — what a look may and may not do', () => {
  it('the total of lives handed out by regeneration never exceeds the time that really passed', () => {
    // Whatever the clock does in between, lives only come from forward time since the last look.
    for (let seed = 50; seed < 60; seed++) {
      const random = rng(seed);
      const h = harness();
      let credit = 0; // forward milliseconds the profile has seen
      let handedOut = 0;
      let known = 5;
      let lookedAt = h.clock.now;
      for (let step = 0; step < 1500; step++) {
        h.clock.now = Math.max(1_000, h.clock.now + clockStep(random));
        if (random() < 0.4) {
          const before = h.profile.lives().count;
          credit += Math.max(0, h.clock.now - lookedAt);
          lookedAt = h.clock.now;
          handedOut += before - known;
          known = before;
          if (random() < 0.7 && h.profile.loseLife()) known -= 1;
        }
        expect(handedOut * INTERVAL).toBeLessThanOrEqual(credit);
      }
    }
  });

  it('a mutation that coincides with a regenerated life is still stored exactly once', () => {
    const cases: [string, (h: Harness) => unknown, number][] = [
      ['loseLife', (h) => h.profile.loseLife(), 1],
      ['refillLives', (h) => h.profile.refillLives(), 1],
      ['grant', (h) => h.profile.grant([{ kind: 'coins', amount: 5 }]), 1],
      ['grant lives', (h) => h.profile.grant([{ kind: 'lives', amount: 1 }]), 1],
      ['claimDaily', (h) => h.profile.claimDaily(), 1],
    ];
    for (const [name, act, notes] of cases) {
      const h = harness();
      h.profile.loseLife();
      h.profile.loseLife();
      h.clock.now += 25 * MINUTE; // one life is back, unseen so far
      const writes = h.storage.writes;
      const notified = h.notifications.count;
      act(h);
      expect(h.storage.writes - writes, name).toBe(1);
      expect(h.notifications.count - notified, name).toBe(notes);
      expect(h.saved(), name).toEqual(JSON.parse(JSON.stringify(h.profile.data())));
    }
  });

  it('a refused call that noticed a regenerated life stores it once and stays silent', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) h.profile.loseLife();
    h.profile.spendCoins(h.profile.coins()); // cannot afford a refill
    h.clock.now += 45 * MINUTE; // two lives are back
    let writes = h.storage.writes;
    const notified = h.notifications.count;
    expect(h.profile.refillLives()).toBe(false);
    expect(h.storage.writes - writes).toBe(1);
    expect(h.saved().lives).toBe(2);
    writes = h.storage.writes;
    expect(h.profile.refillLives()).toBe(false);
    h.profile.grant([]);
    h.profile.grant([{ kind: 'lives', amount: 0 }]);
    expect(h.storage.writes - writes).toBe(0);
    expect(h.notifications.count).toBe(notified);
  });

  it('the countdown is always within one interval, whatever the clock claims', () => {
    const h = harness();
    h.profile.loseLife();
    for (const now of [1, 2, 1_000, h.clock.now - 400 * DAY, h.clock.now + 7, 8.64e15, 8.64e15 + 5, -5, 0, 1e300, -1e300]) {
      h.clock.now = now;
      const info = h.profile.lives();
      expect(info.count).toBeGreaterThanOrEqual(4);
      if (info.count < FULL) {
        expect(info.nextInMs).toBeGreaterThan(0);
        expect(info.nextInMs).toBeLessThanOrEqual(INTERVAL);
      } else expect(info.nextInMs).toBe(0);
      expect(Number.isInteger(h.profile.data().lifeTimer)).toBe(true);
      h.profile.loseLife();
      h.profile.grant([{ kind: 'lives' }]);
      h.profile.loseLife();
    }
  });
});

describe('hardening: lives — a clock that does not work yet', () => {
  const START = Date.UTC(2026, 5, 1);
  const BROKEN: unknown[] = [NaN, Infinity, -Infinity, undefined, null, '5', {}, 'throw'];

  function flaky(json: string | null): { profile: ProfileApi; clock: { value: unknown }; storage: { json: string | null; writes: number } } {
    const clock: { value: unknown } = { value: NaN };
    const storage = { json, writes: 0 };
    const profile = createProfile({
      load: () => storage.json,
      save: (text) => {
        storage.json = text;
        storage.writes += 1;
      },
      now: () => {
        if (clock.value === 'throw') throw new Error('no clock');
        return clock.value as number;
      },
      levelCount: 120,
      dayNumber: fixedOffsetDayNumber(0),
    });
    return { profile, clock, storage };
  }

  function twoLivesFiveMinutesIn(): string {
    const save = freshSave();
    save.lives = 2;
    save.lifeTimer = START - 5 * MINUTE;
    return JSON.stringify(save);
  }

  it('a clock failing at start does not hand out lives once it works', () => {
    for (const broken of BROKEN) {
      const h = flaky(twoLivesFiveMinutesIn());
      h.clock.value = broken;
      const fresh = flaky(twoLivesFiveMinutesIn()); // created while the clock is already broken
      fresh.clock.value = broken;
      for (const { profile, clock, storage } of [h, fresh]) {
        // While the clock is broken the profile still answers, never with more lives than saved.
        for (let i = 0; i < 3; i++) {
          const info = profile.lives();
          expect(info.count, String(broken)).toBe(2);
          expect(info.nextInMs).toBeGreaterThan(0);
          expect(info.nextInMs).toBeLessThanOrEqual(INTERVAL);
          expect(profile.data().lives).toBe(2);
        }
        expect(storage.writes).toBe(0);
        // The clock works now: 5 minutes of the interval had passed, nothing more.
        clock.value = START;
        expect(profile.lives(), String(broken)).toEqual({ count: 2, max: 5, nextInMs: 15 * MINUTE });
      }
    }
  });

  it('a life lost while the clock is broken starts its 20 minutes when the clock first works', () => {
    for (const broken of BROKEN) {
      const h = flaky(null);
      h.clock.value = broken;
      expect(h.profile.loseLife()).toBe(true);
      expect(h.profile.loseLife()).toBe(true);
      expect(h.profile.lives().count).toBe(3);
      // A restart in between changes nothing.
      const again = flaky(h.storage.json);
      again.clock.value = broken;
      expect(again.profile.lives().count).toBe(3);
      again.clock.value = START;
      expect(again.profile.lives(), String(broken)).toEqual({ count: 3, max: 5, nextInMs: INTERVAL });
      again.clock.value = START + INTERVAL;
      expect(again.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: INTERVAL });
    }
  });

  it('a clock that breaks later simply stands still', () => {
    const h = flaky(twoLivesFiveMinutesIn());
    h.clock.value = START;
    expect(h.profile.lives().nextInMs).toBe(15 * MINUTE);
    for (const broken of BROKEN) {
      h.clock.value = broken;
      expect(h.profile.lives()).toEqual({ count: 2, max: 5, nextInMs: 15 * MINUTE });
      expect(h.profile.loseLife()).toBe(true);
      h.profile.grant([{ kind: 'lives', amount: 1 }]);
    }
    h.clock.value = START + 16 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: 19 * MINUTE });
  });

  it('nothing can be claimed from the daily reward until the clock works', () => {
    for (const broken of BROKEN) {
      const h = flaky(null);
      h.clock.value = broken;
      expect(h.profile.daily().canClaim, String(broken)).toBe(false);
      expect(h.profile.claimDaily()).toBeNull();
      expect(h.storage.writes).toBe(0);
      h.clock.value = START;
      expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
      expect(h.profile.claimDaily()).toEqual([{ kind: 'coins', amount: 50 }]);
      // …and a clock that breaks afterwards cannot unlock a second claim.
      h.clock.value = broken;
      expect(h.profile.claimDaily()).toBeNull();
    }
  });
});
