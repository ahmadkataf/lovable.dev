import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  createProfile,
  dayNumberAtOffset,
  fixedOffsetDayNumber,
  localDayNumber,
  msUntilNextLocalDay,
} from '../../src/state/index.ts';
import { DAILY_CYCLE, START_BOOSTERS, START_COINS } from '../../src/state/econ.ts';
import type { Reward } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, SECOND, T0, fromSave, harness, sampleSave } from './harness.ts';

/** Midnight (UTC) at the start of the day containing T0. */
const MIDNIGHT = Math.floor(T0 / DAY) * DAY;

describe('daily reward: first claim', () => {
  it('a new profile can claim day 1', () => {
    const h = harness();
    const status = h.profile.daily();
    expect(status.canClaim).toBe(true);
    expect(status.cycleDay).toBe(0);
    expect(status.streak).toBe(0);
    expect(status.cycle).toEqual(DAILY_CYCLE);
  });

  it('claiming grants the reward, saves and notifies once', () => {
    const h = harness();
    const rewards = h.profile.claimDaily();
    expect(rewards).toEqual([{ kind: 'coins', amount: 50 }]);
    expect(h.profile.coins()).toBe(START_COINS + 50);
    expect(h.notifications.count).toBe(1);
    expect(h.storage.writes).toBe(1);
    expect(h.saved().coins).toBe(START_COINS + 50);
    expect(h.saved().dailyStreak).toBe(1);
    expect(h.saved().dailyDay).toBe(Math.floor(T0 / DAY));
  });

  it('after claiming: nothing more today, and the status shows what was claimed', () => {
    const h = harness();
    h.profile.claimDaily();
    expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 0, streak: 1 });
    const writes = h.storage.writes;
    expect(h.profile.claimDaily()).toBeNull();
    h.clock.now += 3 * HOUR;
    expect(h.profile.claimDaily()).toBeNull();
    expect(h.profile.coins()).toBe(START_COINS + 50);
    expect(h.storage.writes).toBe(writes);
    expect(h.notifications.count).toBe(1);
  });

  it('the status hands out copies: changing them does not change the game', () => {
    const h = harness();
    const status = h.profile.daily();
    (status.cycle[0]![0] as { amount: number }).amount = 9_999_999;
    status.cycle.length = 0;
    expect(h.profile.daily().cycle).toEqual(DAILY_CYCLE);
    const rewards = h.profile.claimDaily()!;
    (rewards[0] as { amount: number }).amount = 5;
    expect(DAILY_CYCLE[0]).toEqual([{ kind: 'coins', amount: 50 }]);
    expect(h.profile.coins()).toBe(START_COINS + 50);
  });
});

describe('daily reward: the streak', () => {
  it('consecutive days walk through the 7-day cycle with the designed rewards', () => {
    const h = harness();
    const claimed: Reward[][] = [];
    for (let day = 0; day < 7; day++) {
      const status = h.profile.daily();
      expect(status).toMatchObject({ canClaim: true, cycleDay: day, streak: day });
      claimed.push(h.profile.claimDaily()!);
      expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: day, streak: day + 1 });
      h.clock.now += DAY;
    }
    expect(claimed).toEqual(DAILY_CYCLE);
    // 50 + 80 + 120 + 250 coins; hammer, shuffle, freeSwap, extraMoves, beamNova, prism +1 each
    expect(h.profile.coins()).toBe(START_COINS + 500);
    expect(h.profile.data().boosters).toEqual({
      hammer: START_BOOSTERS.hammer + 1,
      freeSwap: START_BOOSTERS.freeSwap + 1,
      shuffle: START_BOOSTERS.shuffle + 1,
      extraMoves: START_BOOSTERS.extraMoves + 1,
      prism: START_BOOSTERS.prism + 1,
      beamNova: START_BOOSTERS.beamNova + 1,
    });
  });

  it('day 8 starts the cycle again while the streak keeps counting', () => {
    const h = harness();
    for (let day = 0; day < 7; day++) {
      h.profile.claimDaily();
      h.clock.now += DAY;
    }
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 7 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
    expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 0, streak: 8 });
    h.clock.now += DAY;
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 8 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[1]);
  });

  it('three weeks in a row pay three full cycles', () => {
    const h = harness();
    for (let day = 0; day < 21; day++) {
      expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[day % 7]);
      h.clock.now += DAY;
    }
    expect(h.profile.coins()).toBe(START_COINS + 3 * 500);
    expect(h.profile.data().dailyStreak).toBe(21);
  });

  it('missing a day resets to day 1', () => {
    const h = harness();
    h.profile.claimDaily();
    h.clock.now += DAY;
    h.profile.claimDaily();
    h.clock.now += DAY;
    h.profile.claimDaily(); // streak 3
    h.clock.now += 2 * DAY; // one day skipped
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
    expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 0, streak: 1 });
    h.clock.now += DAY;
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
  });

  it('a long absence also resets to day 1', () => {
    const h = harness();
    for (let day = 0; day < 5; day++) {
      h.profile.claimDaily();
      h.clock.now += DAY;
    }
    h.clock.now += 200 * DAY;
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
  });

  it('the streak survives a restart', () => {
    const h = harness();
    h.profile.claimDaily();
    h.clock.now += DAY;
    h.profile.claimDaily();
    const again = h.restart();
    expect(again.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 1, streak: 2 });
    h.clock.now += DAY;
    expect(h.restart().profile.daily()).toMatchObject({ canClaim: true, cycleDay: 2, streak: 2 });
  });
});

describe('daily reward: midnight', () => {
  it('the last millisecond of a day and the first of the next are different days', () => {
    const h = harness({ now: MIDNIGHT + DAY - 1 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
    h.clock.now += 1; // midnight
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[1]);
  });

  it('the whole day counts as one: 00:00:00.000 and 23:59:59.999', () => {
    const h = harness({ now: MIDNIGHT });
    h.profile.claimDaily();
    h.clock.now = MIDNIGHT + DAY - 1;
    expect(h.profile.daily().canClaim).toBe(false);
    expect(h.profile.claimDaily()).toBeNull();
  });

  it('claims almost two days apart are still consecutive calendar days', () => {
    const h = harness({ now: MIDNIGHT + SECOND });
    h.profile.claimDaily();
    h.clock.now = MIDNIGHT + 2 * DAY - SECOND; // 47h59m58s later, but "tomorrow"
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
  });

  it('claims barely more than a day apart can still skip a calendar day', () => {
    const h = harness({ now: MIDNIGHT + DAY - MINUTE }); // 23:59
    h.profile.claimDaily();
    h.clock.now = MIDNIGHT + 2 * DAY + MINUTE; // 00:01 two days later — only 24h02m passed
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
  });
});

describe('daily reward: time zones (fixed offsets)', () => {
  // 21:30 UTC on 10 March 2026
  const EVENING_UTC = Date.UTC(2026, 2, 10, 21, 30, 0);

  it('the day changes at LOCAL midnight — UTC+3', () => {
    // 21:30 UTC is 00:30 on the 11th at UTC+3.
    const h = harness({ now: EVENING_UTC - HOUR, utcOffsetMinutes: 180 }); // 23:30 local on the 10th
    h.profile.claimDaily();
    h.clock.now = EVENING_UTC - 30 * MINUTE - 1; // 23:59:59.999 local
    expect(h.profile.daily().canClaim).toBe(false);
    h.clock.now += 1; // 00:00 local on the 11th — still the 10th in UTC
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
    expect(new Date(h.clock.now).getUTCDate()).toBe(10);
  });

  it('the day changes at LOCAL midnight — UTC−8', () => {
    // Local midnight at UTC−8 is 08:00 UTC.
    const localMidnight = Date.UTC(2026, 2, 11, 8, 0, 0);
    const h = harness({ now: localMidnight - 1, utcOffsetMinutes: -480 });
    h.profile.claimDaily();
    // UTC midnight has long passed, yet it is still the same local day:
    expect(new Date(h.clock.now).getUTCDate()).toBe(11);
    expect(h.profile.daily().canClaim).toBe(false);
    h.clock.now = localMidnight;
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
  });

  it('half-hour and extreme offsets work the same way', () => {
    for (const offset of [330, 345, 840, -720, -570, 0]) {
      // local midnight = UTC midnight − offset
      const localMidnight = Date.UTC(2026, 5, 1, 0, 0, 0) - offset * MINUTE;
      const h = harness({ now: localMidnight - 1, utcOffsetMinutes: offset });
      expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
      expect(h.profile.daily().canClaim).toBe(false);
      h.clock.now = localMidnight;
      expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
      expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[1]);
      h.clock.now = localMidnight + DAY - 1;
      expect(h.profile.daily().canClaim).toBe(false);
      h.clock.now = localMidnight + 2 * DAY; // skipped a local day
      expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
    }
  });

  it('the same instants give different answers in different zones', () => {
    // Claim at 20:00 UTC, look again at 22:00 UTC.
    const first = Date.UTC(2026, 2, 10, 20, 0, 0);
    const utc = harness({ now: first, utcOffsetMinutes: 0 });
    const east = harness({ now: first, utcOffsetMinutes: 180 }); // 23:00 → 01:00 next day
    utc.profile.claimDaily();
    east.profile.claimDaily();
    utc.clock.now += 2 * HOUR;
    east.clock.now += 2 * HOUR;
    expect(utc.profile.daily().canClaim).toBe(false);
    expect(east.profile.daily().canClaim).toBe(true);
  });
});

describe('daily reward: a clock that jumps backwards', () => {
  it('cannot grant a second claim for the same day', () => {
    const h = harness();
    h.profile.claimDaily();
    for (const back of [HOUR, DAY, 2 * DAY, 30 * DAY, 3650 * DAY]) {
      h.clock.now = T0 - back;
      expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 0, streak: 1 });
      expect(h.profile.claimDaily()).toBeNull();
    }
    expect(h.profile.coins()).toBe(START_COINS + 50);
    expect(h.notifications.count).toBe(1);
  });

  it('going back and forth across days never yields more than one claim per real day reached', () => {
    const h = harness();
    h.profile.claimDaily(); // day D
    h.clock.now = T0 - DAY; // D−1
    expect(h.profile.claimDaily()).toBeNull();
    h.clock.now = T0; // D again
    expect(h.profile.claimDaily()).toBeNull();
    h.clock.now = T0 - 5 * DAY;
    expect(h.profile.claimDaily()).toBeNull();
    h.clock.now = T0 + DAY; // D+1: the streak simply continues
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[1]);
    h.clock.now = T0; // back to D
    expect(h.profile.claimDaily()).toBeNull();
    expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 1, streak: 2 });
  });

  it('a save claimed "in the future" stays locked until that day has passed', () => {
    const save = sampleSave();
    save.dailyDay = Math.floor(T0 / DAY) + 3;
    save.dailyStreak = 4;
    const h = fromSave(save);
    expect(h.profile.daily()).toMatchObject({ canClaim: false, cycleDay: 3, streak: 4 });
    h.clock.now += 3 * DAY;
    expect(h.profile.daily().canClaim).toBe(false);
    h.clock.now += DAY;
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 4, streak: 4 });
  });
});

describe('daily reward: robustness', () => {
  it('a calendar function that throws or returns nonsense never grants anything', () => {
    let mode: 'throw' | 'nan' | 'inf' = 'throw';
    const profile = createProfile({
      load: () => null,
      save: () => {},
      now: () => T0,
      levelCount: 10,
      dayNumber: () => {
        if (mode === 'throw') throw new Error('no calendar');
        return mode === 'nan' ? NaN : Infinity;
      },
    });
    for (const m of ['throw', 'nan', 'inf'] as const) {
      mode = m;
      expect(profile.daily().canClaim).toBe(false);
      expect(profile.claimDaily()).toBeNull();
    }
    expect(profile.coins()).toBe(START_COINS);
  });

  it('a fractional day number is treated as its whole day', () => {
    let day = 100.2;
    const profile = createProfile({ load: () => null, save: () => {}, now: () => T0, levelCount: 10, dayNumber: () => day });
    expect(profile.claimDaily()).not.toBeNull();
    day = 100.9;
    expect(profile.claimDaily()).toBeNull();
    day = 101.01;
    expect(profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
  });

  it('a claim day without a streak (damaged save) counts as a streak of one', () => {
    const save = sampleSave();
    save.dailyDay = Math.floor(T0 / DAY) - 1;
    save.dailyStreak = 0;
    const h = fromSave(save);
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
  });

  it('a streak without a claim day (damaged save) is dropped', () => {
    const save = sampleSave();
    save.dailyDay = -1;
    save.dailyStreak = 6;
    const h = fromSave(save);
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 0, streak: 0 });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
  });

  it('daily() itself never saves or notifies', () => {
    const h = harness();
    h.profile.daily();
    h.clock.now += DAY;
    h.profile.daily();
    expect(h.storage.writes).toBe(0);
    expect(h.notifications.count).toBe(0);
  });
});

describe('calendar helpers', () => {
  it('dayNumberAtOffset counts whole local days since the epoch', () => {
    expect(dayNumberAtOffset(0, 0)).toBe(0);
    expect(dayNumberAtOffset(DAY - 1, 0)).toBe(0);
    expect(dayNumberAtOffset(DAY, 0)).toBe(1);
    expect(dayNumberAtOffset(-1, 0)).toBe(-1);
    // 1970-01-01 22:00 UTC is already 2 January at UTC+3 …
    expect(dayNumberAtOffset(22 * HOUR, 180)).toBe(1);
    // … and 1970-01-02 03:00 UTC is still 1 January at UTC−8.
    expect(dayNumberAtOffset(DAY + 3 * HOUR, -480)).toBe(0);
    expect(DAY_MS).toBe(DAY);
  });

  it('fixedOffsetDayNumber changes exactly at local midnight', () => {
    for (const offset of [0, 60, 180, 330, 345, 765, 840, -60, -210, -480, -720]) {
      const day = fixedOffsetDayNumber(offset);
      const localMidnight = Date.UTC(2027, 0, 1) - offset * MINUTE;
      expect(day(localMidnight) - day(localMidnight - 1)).toBe(1);
      expect(day(localMidnight + DAY - 1)).toBe(day(localMidnight));
      expect(day(localMidnight + DAY)).toBe(day(localMidnight) + 1);
    }
  });

  it('localDayNumber follows the local calendar of the machine', () => {
    const instants = [0, T0, Date.UTC(2026, 0, 1), Date.UTC(2026, 5, 30, 23, 59, 59), Date.UTC(2031, 11, 31, 12)];
    for (const ms of instants) {
      const d = new Date(ms);
      // Same day number ⇔ same local calendar date.
      expect(localDayNumber(ms)).toBe(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
      // And it agrees with the offset arithmetic for the offset in force at that instant.
      expect(localDayNumber(ms)).toBe(dayNumberAtOffset(ms, -d.getTimezoneOffset()));
    }
  });

  it('localDayNumber steps by one at each local midnight', () => {
    for (let i = 0; i < 400; i += 7) {
      const midnight = new Date(2026, 0, 1 + i).getTime(); // local midnight
      expect(localDayNumber(midnight) - localDayNumber(midnight - 1)).toBe(1);
      expect(localDayNumber(midnight + 60 * 1000)).toBe(localDayNumber(midnight));
    }
  });

  it('msUntilNextLocalDay leads exactly to the next day', () => {
    for (const ms of [T0, T0 + 5 * HOUR + 123, Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 2, 29, 1, 0)]) {
      const wait = msUntilNextLocalDay(ms);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(25 * HOUR);
      expect(localDayNumber(ms + wait)).toBe(localDayNumber(ms) + 1);
      expect(localDayNumber(ms + wait - 1)).toBe(localDayNumber(ms));
    }
    expect(msUntilNextLocalDay(NaN)).toBe(DAY);
  });

  it('without an injected calendar the profile uses the local one', () => {
    const h = harness({ utcOffsetMinutes: null });
    expect(h.profile.claimDaily()).toEqual(DAILY_CYCLE[0]);
    expect(h.saved().dailyDay).toBe(localDayNumber(T0));
    expect(h.profile.claimDaily()).toBeNull();
    h.clock.now += msUntilNextLocalDay(h.clock.now); // local midnight
    expect(h.profile.daily()).toMatchObject({ canClaim: true, cycleDay: 1, streak: 1 });
    h.clock.now -= 1;
    expect(h.profile.daily().canClaim).toBe(false);
  });
});
