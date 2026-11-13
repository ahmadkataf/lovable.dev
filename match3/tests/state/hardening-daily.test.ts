/**
 * Hardening: the daily reward checked against an independent reference model over random day
 * jumps, backwards clocks, restarts and changing time zones — first with fixed UTC offsets, then
 * with the profile's own default calendar under real IANA zones (daylight-saving shifts included).
 *
 * The model works on calendar days only and knows the rules from DESIGN §5:
 *  - one claim per local calendar day; a claim is possible only on a day later than the last claim
 *    (so a clock set back can never produce a second claim);
 *  - claiming on the day right after the last claim continues the streak, anything later restarts it;
 *  - the reward is the streak's place in the 7-day cycle.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createProfile, dayNumberAtOffset, fixedOffsetDayNumber, localDayNumber, msUntilNextLocalDay } from '../../src/state/index.ts';
import type { ProfileApi, Reward, SaveData } from '../../src/state/types.ts';
import { DAY, HOUR, MINUTE, rng } from './harness.ts';

/** DESIGN §5, written out again by hand (not imported from the implementation). */
const CYCLE: Reward[][] = [
  [{ kind: 'coins', amount: 50 }],
  [{ kind: 'booster', id: 'hammer', amount: 1 }],
  [{ kind: 'coins', amount: 80 }],
  [
    { kind: 'booster', id: 'shuffle', amount: 1 },
    { kind: 'booster', id: 'freeSwap', amount: 1 },
  ],
  [{ kind: 'coins', amount: 120 }],
  [
    { kind: 'booster', id: 'extraMoves', amount: 1 },
    { kind: 'booster', id: 'beamNova', amount: 1 },
  ],
  [
    { kind: 'coins', amount: 250 },
    { kind: 'booster', id: 'prism', amount: 1 },
  ],
];

class DailyModel {
  last: number | null = null;
  streak = 0;
  coins = 150;
  boosters: Record<string, number> = { hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 1, beamNova: 1 };
  claimedDays: number[] = [];

  status(today: number): { canClaim: boolean; cycleDay: number; streak: number } {
    if (this.last === null) return { canClaim: true, cycleDay: 0, streak: 0 };
    if (today <= this.last) return { canClaim: false, cycleDay: (this.streak - 1) % 7, streak: this.streak };
    if (today === this.last + 1) return { canClaim: true, cycleDay: this.streak % 7, streak: this.streak };
    return { canClaim: true, cycleDay: 0, streak: 0 };
  }

  claim(today: number): Reward[] | null {
    if (this.last !== null && today <= this.last) return null;
    this.streak = this.last !== null && today === this.last + 1 ? this.streak + 1 : 1;
    this.last = today;
    this.claimedDays.push(today);
    const rewards = CYCLE[(this.streak - 1) % 7]!;
    for (const r of rewards) {
      if (r.kind === 'coins') this.coins += r.amount;
      else if (r.kind === 'booster') this.boosters[r.id] = this.boosters[r.id]! + r.amount;
    }
    return rewards;
  }
}

/** Calendar day of an instant on a wall clock `offsetMinutes` ahead of UTC — via Date, not division. */
function dayAtOffset(ms: number, offsetMinutes: number): number {
  const d = new Date(ms + offsetMinutes * MINUTE);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY;
}

/** Calendar day of an instant in an IANA zone — via Intl, independent of the process time zone. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function dayInZone(ms: number, zone: string): number {
  let format = formatters.get(zone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' });
    formatters.set(zone, format);
  }
  const parts = format.formatToParts(new Date(ms));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / DAY;
}

/** Offsets that exist on real wall clocks, in minutes ahead of UTC. */
const OFFSETS = [-720, -660, -570, -480, -300, -210, -60, 0, 60, 180, 210, 270, 330, 345, 480, 525, 570, 720, 765, 780, 840];

function jump(random: () => number): number {
  const roll = random();
  if (roll < 0.15) return Math.floor(random() * 20 * MINUTE);
  if (roll < 0.35) return Math.floor(random() * 9 * HOUR);
  if (roll < 0.6) return 18 * HOUR + Math.floor(random() * 12 * HOUR); // about a day
  if (roll < 0.7) return 2 * DAY + Math.floor(random() * 3 * DAY);
  if (roll < 0.75) return Math.floor(random() * 90 * DAY);
  if (roll < 0.9) return -Math.floor(random() * 6 * HOUR); // the clock is corrected backwards
  if (roll < 0.97) return -Math.floor(random() * 3 * DAY);
  return -Math.floor(random() * 60 * DAY);
}

interface World {
  profile: ProfileApi;
  storage: { json: string | null; writes: number };
  notes: { count: number };
}

function start(storage: World['storage'], now: () => number, dayNumber?: (ms: number) => number): World {
  const profile = createProfile({
    load: () => storage.json,
    save: (json) => {
      storage.json = json;
      storage.writes += 1;
    },
    now,
    levelCount: 120,
    ...(dayNumber ? { dayNumber } : {}),
  });
  const notes = { count: 0 };
  profile.subscribe(() => (notes.count += 1));
  return { profile, storage, notes };
}

/**
 * One random history. `today()` is the model's calendar; `dayNumber` what the profile is given
 * (undefined = its built-in local calendar); `travel()` changes the zone now and then.
 */
function history(seed: number, steps: number, today: (ms: number) => number, dayNumber: ((ms: number) => number) | undefined, travel: (random: () => number) => void): DailyModel {
  const random = rng(seed);
  const clock = { now: Date.UTC(2026, 0, 1) + Math.floor(random() * 300 * DAY) };
  const storage = { json: null as string | null, writes: 0 };
  let world = start(storage, () => clock.now, dayNumber);
  const model = new DailyModel();

  for (let step = 0; step < steps; step++) {
    const where = `seed ${seed}, step ${step}, ${new Date(clock.now).toISOString()}`;
    const roll = random();
    if (roll < 0.5) clock.now = Math.max(DAY * 400, clock.now + jump(random));
    else if (roll < 0.58) travel(random);
    else if (roll < 0.65) world = start(storage, () => clock.now, dayNumber);
    else if (roll < 0.8) {
      const writes = storage.writes;
      const status = world.profile.daily();
      const expected = model.status(today(clock.now));
      expect({ canClaim: status.canClaim, cycleDay: status.cycleDay, streak: status.streak }, where).toEqual(expected);
      expect(status.cycle, where).toEqual(CYCLE);
      expect(storage.writes, where + ': looking does not write').toBe(writes);
    } else {
      const writes = storage.writes;
      const notes = world.notes.count;
      const expected = model.claim(today(clock.now));
      const got = world.profile.claimDaily();
      expect(got, where).toEqual(expected);
      expect(storage.writes - writes, where).toBe(expected ? 1 : 0);
      expect(world.notes.count - notes, where).toBe(expected ? 1 : 0);
      if (expected) {
        // Right after a claim: locked for today, and the status shows what was just claimed.
        expect(world.profile.daily(), where).toMatchObject({ canClaim: false, cycleDay: (model.streak - 1) % 7, streak: model.streak });
        expect(world.profile.claimDaily(), where).toBeNull();
        const saved = JSON.parse(storage.json!) as SaveData;
        expect(saved.dailyDay, where).toBe(model.last);
        expect(saved.dailyStreak, where).toBe(model.streak);
      }
    }
    expect(world.profile.coins(), where).toBe(model.coins);
  }
  for (const id of Object.keys(model.boosters)) expect(world.profile.boosterCount(id as 'hammer'), id).toBe(model.boosters[id]);
  // Each claim happened on a strictly later calendar day than every claim before it.
  for (let i = 1; i < model.claimedDays.length; i++) expect(model.claimedDays[i]!).toBeGreaterThan(model.claimedDays[i - 1]!);
  return model;
}

describe('hardening: daily reward against a reference model (fixed offsets)', () => {
  it('agrees in every offset over random day jumps, backwards clocks and restarts', () => {
    let claims = 0;
    let longest = 0;
    for (const offset of OFFSETS) {
      const model = history(1000 + offset, 700, (ms) => dayAtOffset(ms, offset), fixedOffsetDayNumber(offset), () => {});
      claims += model.claimedDays.length;
      longest = Math.max(longest, model.streak);
    }
    expect(claims).toBeGreaterThan(OFFSETS.length * 40);
    expect(longest).toBeGreaterThanOrEqual(2);
  });

  it('agrees while the player travels between time zones', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const zone = { offset: 180 };
      history(
        seed,
        800,
        (ms) => dayAtOffset(ms, zone.offset),
        (ms) => dayNumberAtOffset(ms, zone.offset),
        (random) => {
          zone.offset = OFFSETS[Math.floor(random() * OFFSETS.length)]!;
        },
      );
    }
  });

  it('long unbroken streaks pay exactly the designed cycle, week after week', () => {
    for (const offset of [-570, 0, 180, 765]) {
      const clock = { now: Date.UTC(2026, 1, 27, 9) };
      const world = start({ json: null, writes: 0 }, () => clock.now, fixedOffsetDayNumber(offset));
      const model = new DailyModel();
      const random = rng(offset + 9);
      for (let day = 0; day < 60; day++) {
        const got = world.profile.claimDaily();
        expect(got).toEqual(model.claim(dayAtOffset(clock.now, offset)));
        expect(got).toEqual(CYCLE[day % 7]);
        expect(world.profile.daily().streak).toBe(day + 1);
        // Next day at a random time of day: between 00:00 and 23:59 local.
        const midnight = (dayAtOffset(clock.now, offset) + 1) * DAY - offset * MINUTE;
        clock.now = midnight + Math.floor(random() * (DAY - 1));
      }
      // 60 days = 8 full cycles (500 coins each) + days 1–4 of the ninth (50 + 80).
      expect(world.profile.coins()).toBe(150 + 8 * 500 + 130);
      expect(world.profile.boosterCount('prism')).toBe(1 + 8);
      expect(world.profile.boosterCount('hammer')).toBe(3 + 9);
    }
  });

  it('a traveller can never claim twice on one local date, in either direction', () => {
    // Claim at 23:30 in UTC+3, then land in UTC−5 where it is still the same (or the previous) date.
    const zone = { offset: 180 };
    const clock = { now: Date.UTC(2026, 3, 10, 20, 30) }; // 23:30 local
    const world = start({ json: null, writes: 0 }, () => clock.now, (ms) => dayNumberAtOffset(ms, zone.offset));
    expect(world.profile.claimDaily()).toEqual(CYCLE[0]);
    clock.now += HOUR; // 00:30 next day in UTC+3 …
    zone.offset = -300; // … but 16:30 of the claim day in UTC−5
    expect(world.profile.claimDaily()).toBeNull();
    clock.now += 8 * HOUR; // 00:30 on the next date in UTC−5
    expect(world.profile.claimDaily()).toEqual(CYCLE[1]);
    clock.now += 8 * HOUR; // 08:30 the same date in UTC−5
    expect(world.profile.claimDaily()).toBeNull();
    // Flying east skips ahead on the calendar: the next date is claimable at once, the streak holds…
    zone.offset = 840; // 03:30 on the following date in UTC+14
    expect(dayAtOffset(clock.now, 840)).toBe(dayAtOffset(clock.now, -300) + 1);
    expect(world.profile.claimDaily()).toEqual(CYCLE[2]);
    // …and flying back west makes the calendar repeat dates that were already claimed.
    zone.offset = -300;
    expect(world.profile.claimDaily()).toBeNull();
    clock.now += 20 * HOUR; // 04:30 in UTC−5, on the date already claimed in UTC+14
    expect(world.profile.claimDaily()).toBeNull();
    clock.now += 24 * HOUR;
    expect(world.profile.claimDaily()).toEqual(CYCLE[3]);
  });
});

describe('hardening: daily reward with the built-in local calendar (real time zones)', () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  // Zones with daylight saving (both hemispheres), half- and quarter-hour offsets, the date line, and
  // zones whose daylight-saving switch happens AT midnight (no 00:00 on that date).
  const ZONES = [
    'UTC', 'Asia/Damascus', 'Asia/Riyadh', 'Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'America/New_York',
    'America/Los_Angeles', 'America/Santiago', 'America/Havana', 'America/Sao_Paulo', 'Asia/Beirut', 'Asia/Tehran', 'Asia/Kolkata', 'Asia/Kathmandu',
    'Australia/Lord_Howe', 'Australia/Sydney', 'Pacific/Chatham', 'Pacific/Kiritimati', 'Pacific/Apia', 'Pacific/Pago_Pago',
  ];

  it('localDayNumber is the zone’s calendar date, all day long, every day of four years', () => {
    for (const zone of ZONES) {
      process.env.TZ = zone;
      const random = rng(zone.length * 131 + zone.charCodeAt(5 % zone.length));
      let previous = localDayNumber(Date.UTC(2024, 0, 1) - DAY);
      for (let n = 0; n < 4 * 366; n++) {
        // The first instant of the local date (01:00 where the clocks skip midnight), the instant
        // before it, and three random instants later that day.
        const first = new Date(2024, 0, 1 + n).getTime();
        const instants = [first - 1, first, first + 1, first + Math.floor(random() * 8 * HOUR), first + 8 * HOUR + Math.floor(random() * 14 * HOUR)];
        for (const at of instants) {
          const day = localDayNumber(at);
          if (day !== dayInZone(at, zone)) expect(`${zone} ${new Date(at).toISOString()} → ${day}`).toBe(String(dayInZone(at, zone)));
          if (day !== previous && day !== previous + 1) expect(`${zone}: day went ${previous} → ${day}`).toBe('by one');
          previous = day;
        }
        expect(localDayNumber(first - 1), zone).toBe(localDayNumber(first) - 1);
      }
    }
  });

  it('msUntilNextLocalDay lands exactly on the next calendar date', () => {
    for (const zone of ZONES) {
      process.env.TZ = zone;
      const random = rng(zone.length);
      for (let i = 0; i < 1500; i++) {
        const at = Date.UTC(2024, 0, 1) + Math.floor(random() * 4 * 365 * DAY);
        const wait = msUntilNextLocalDay(at);
        const where = `${zone} ${new Date(at).toISOString()} wait ${wait}`;
        expect(wait > 0 && wait <= 25 * HOUR, where).toBe(true);
        if (localDayNumber(at + wait) !== localDayNumber(at) + 1 || localDayNumber(at + wait - 1) !== localDayNumber(at)) {
          expect(where).toBe('the first millisecond of the next date');
        }
      }
    }
  });

  it('the profile agrees with the reference model in every zone', () => {
    for (const zone of ZONES) {
      process.env.TZ = zone;
      history(zone.length * 7 + zone.charCodeAt(0), 500, (ms) => dayInZone(ms, zone), undefined, () => {});
    }
  });

  it('…and when the device’s zone changes under it', () => {
    const current = { zone: 'Asia/Damascus' };
    process.env.TZ = current.zone;
    for (let seed = 1; seed <= 10; seed++) {
      history(
        seed,
        600,
        (ms) => dayInZone(ms, current.zone),
        undefined,
        (random) => {
          current.zone = ZONES[Math.floor(random() * ZONES.length)]!;
          process.env.TZ = current.zone;
        },
      );
    }
  });

  it('claims on both sides of a daylight-saving switch are consecutive days', () => {
    // Europe/Berlin: clocks go forward on 2026-03-29 (a 23-hour day) and back on 2026-10-25 (25 hours).
    process.env.TZ = 'Europe/Berlin';
    for (const [y, m, d] of [[2026, 2, 28], [2026, 9, 24]] as const) {
      const clock = { now: new Date(y, m, d, 23, 59, 59).getTime() };
      const world = start({ json: null, writes: 0 }, () => clock.now);
      expect(world.profile.claimDaily()).toEqual(CYCLE[0]);
      clock.now = new Date(y, m, d + 1, 0, 0, 0).getTime();
      expect(world.profile.claimDaily()).toEqual(CYCLE[1]);
      clock.now = new Date(y, m, d + 1, 23, 59, 59).getTime();
      expect(world.profile.claimDaily()).toBeNull();
      clock.now = new Date(y, m, d + 2, 0, 0, 1).getTime();
      expect(world.profile.claimDaily()).toEqual(CYCLE[2]);
    }
  });
});
