import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/state/index.ts';
import { LIFE_REGEN_MS, MAX_LIVES, REFILL_LIVES_PRICE, START_COINS } from '../../src/state/econ.ts';
import { DAY, HOUR, MINUTE, SECOND, T0, fromSave, harness, rng, sampleSave } from './harness.ts';

const REGEN = LIFE_REGEN_MS;

describe('lives: basics', () => {
  it('a new profile has full lives and no countdown', () => {
    const h = harness();
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.profile.data().lifeTimer).toBe(0);
  });

  it('losing a life from full starts the 20-minute timer', () => {
    const h = harness();
    expect(h.profile.loseLife()).toBe(true);
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 20 * MINUTE });
    expect(h.profile.data().lifeTimer).toBe(T0);
    expect(h.saved().lives).toBe(4);
    expect(h.saved().lifeTimer).toBe(T0);
  });

  it('the countdown runs down with the clock', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now += 1;
    expect(h.profile.lives().nextInMs).toBe(REGEN - 1);
    h.clock.now += 7 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: REGEN - 1 - 7 * MINUTE });
    h.clock.now = T0 + REGEN - 1;
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 1 });
  });

  it('the life comes back exactly when the interval ends, and the timer stops at full', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now = T0 + REGEN;
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.profile.data().lifeTimer).toBe(0);
    h.clock.now += 3 * DAY;
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
  });

  it('losing further lives does not restart the running timer', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now += 12 * MINUTE;
    h.profile.loseLife();
    expect(h.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: 8 * MINUTE });
    expect(h.profile.data().lifeTimer).toBe(T0);
  });

  it('a regenerated life keeps the progress already made towards the next one', () => {
    const h = harness();
    h.profile.loseLife();
    h.profile.loseLife();
    h.clock.now += 25 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 15 * MINUTE });
    expect(h.profile.data().lifeTimer).toBe(T0 + REGEN);
  });

  it('all five lives can be lost, a sixth cannot', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) expect(h.profile.loseLife()).toBe(true);
    expect(h.profile.lives().count).toBe(0);
    const writes = h.storage.writes;
    const notes = h.notifications.count;
    expect(h.profile.loseLife()).toBe(false);
    expect(h.profile.lives().count).toBe(0);
    expect(h.storage.writes).toBe(writes);
    expect(h.notifications.count).toBe(notes);
  });

  it('loseLife counts a life that has regenerated in the meantime', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) h.profile.loseLife();
    h.clock.now += REGEN + 5 * MINUTE;
    expect(h.profile.loseLife()).toBe(true); // the regenerated one
    expect(h.profile.lives()).toEqual({ count: 0, max: 5, nextInMs: 15 * MINUTE });
  });
});

describe('lives: long absences', () => {
  it('grants several lives at once', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) h.profile.loseLife();
    h.clock.now += 45 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 2, max: 5, nextInMs: 15 * MINUTE });
    h.clock.now += 15 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: 20 * MINUTE });
  });

  it('never exceeds the maximum, however long the absence', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) h.profile.loseLife();
    h.clock.now += 99 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 1 * MINUTE });
    h.clock.now += 1 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    h.clock.now += 400 * DAY;
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.profile.data().lifeTimer).toBe(0);
  });

  it('a long absence stores exactly the maximum, whichever way it is first read', () => {
    const viaData = harness();
    for (let i = 0; i < 5; i++) viaData.profile.loseLife();
    viaData.clock.now += 30 * DAY;
    expect(viaData.profile.data().lives).toBe(5);
    expect(viaData.saved().lives).toBe(5);
    expect(viaData.saved().lifeTimer).toBe(0);

    const viaRestart = harness();
    for (let i = 0; i < 3; i++) viaRestart.profile.loseLife();
    viaRestart.clock.now += 30 * DAY;
    const again = viaRestart.restart();
    expect(again.saved().lives).toBe(5);
    expect(again.profile.data().lives).toBe(5);
  });

  it('works across restarts: the absence is measured from the saved timer', () => {
    const h = harness();
    for (let i = 0; i < 4; i++) h.profile.loseLife();
    h.clock.now += 50 * MINUTE;
    const again = h.restart();
    expect(again.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: 10 * MINUTE });
    h.clock.now += 5 * HOUR;
    expect(h.restart().profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
  });

  it('lives regenerated while the app was closed are stored at start, without notifying', () => {
    const save = sampleSave();
    save.lives = 1;
    save.lifeTimer = T0 - 50 * MINUTE;
    const h = fromSave(save);
    expect(h.storage.writes).toBe(1);
    expect(h.saved().lives).toBe(3);
    expect(h.saved().lifeTimer).toBe(T0 - 10 * MINUTE);
    expect(h.notifications.count).toBe(0);
    expect(h.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: 10 * MINUTE });
    expect(h.storage.writes).toBe(1);
  });

  it('after a full regeneration the next loss starts a fresh timer', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now += 2 * HOUR;
    expect(h.profile.lives().count).toBe(5);
    h.profile.loseLife();
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: REGEN });
    expect(h.profile.data().lifeTimer).toBe(T0 + 2 * HOUR);
  });

  it('data() shows the regenerated lives too', () => {
    const h = harness();
    for (let i = 0; i < 3; i++) h.profile.loseLife();
    h.clock.now += 41 * MINUTE;
    expect(h.profile.data().lives).toBe(4);
    expect(h.profile.data().lifeTimer).toBe(T0 + 2 * REGEN);
  });
});

describe('lives: regeneration is silent', () => {
  it('reading lives never notifies subscribers, even when a life came back', () => {
    const h = harness();
    h.profile.loseLife();
    h.profile.loseLife();
    const before = h.notifications.count;
    h.clock.now += REGEN;
    expect(h.profile.lives().count).toBe(4);
    h.clock.now += REGEN;
    expect(h.profile.data().lives).toBe(5);
    expect(h.notifications.count).toBe(before);
  });

  it('but the normalised state is stored, so it survives a restart as it is', () => {
    const h = harness();
    h.profile.loseLife();
    h.profile.loseLife();
    h.clock.now += REGEN + MINUTE;
    h.profile.lives();
    expect(h.saved().lives).toBe(4);
    expect(h.saved().lifeTimer).toBe(T0 + REGEN);
  });

  it('reading lives when nothing changed does not write', () => {
    const h = harness();
    h.profile.loseLife();
    const writes = h.storage.writes;
    h.clock.now += 5 * MINUTE;
    h.profile.lives();
    h.profile.data();
    h.profile.lives();
    expect(h.storage.writes).toBe(writes);
  });
});

describe('lives: refill', () => {
  it('costs 120 coins, fills up and stops the timer', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) h.profile.loseLife();
    expect(h.profile.refillLives()).toBe(true);
    expect(h.profile.coins()).toBe(START_COINS - REFILL_LIVES_PRICE);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.saved().lifeTimer).toBe(0);
    expect(h.saved().coins).toBe(30);
  });

  it('is refused when lives are already full (no charge)', () => {
    const h = harness();
    const writes = h.storage.writes;
    expect(h.profile.refillLives()).toBe(false);
    expect(h.profile.coins()).toBe(START_COINS);
    expect(h.storage.writes).toBe(writes);
    expect(h.notifications.count).toBe(0);
  });

  it('is refused when lives became full by waiting', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now += REGEN;
    expect(h.profile.refillLives()).toBe(false);
    expect(h.profile.coins()).toBe(START_COINS);
  });

  it('is refused without enough coins', () => {
    const h = harness();
    h.profile.spendCoins(START_COINS - REFILL_LIVES_PRICE + 1); // 119 left
    h.profile.loseLife();
    expect(h.profile.refillLives()).toBe(false);
    expect(h.profile.coins()).toBe(119);
    expect(h.profile.lives().count).toBe(4);
    h.profile.addCoins(1);
    expect(h.profile.refillLives()).toBe(true);
    expect(h.profile.coins()).toBe(0);
  });

  it('notifies once', () => {
    const h = harness();
    h.profile.loseLife();
    const before = h.notifications.count;
    h.profile.refillLives();
    expect(h.notifications.count).toBe(before + 1);
  });
});

describe('lives: rewards', () => {
  it('a lives reward without an amount refills everything', () => {
    const h = harness();
    for (let i = 0; i < 4; i++) h.profile.loseLife();
    h.profile.grant([{ kind: 'lives' }]);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.saved().lifeTimer).toBe(0);
  });

  it('a lives reward with an amount adds that many and leaves the timer running', () => {
    const h = harness();
    for (let i = 0; i < 5; i++) h.profile.loseLife();
    h.clock.now += 8 * MINUTE;
    h.profile.grant([{ kind: 'lives', amount: 1 }]);
    expect(h.profile.lives()).toEqual({ count: 1, max: 5, nextInMs: 12 * MINUTE });
    h.profile.grant([{ kind: 'lives', amount: 2 }]);
    expect(h.profile.lives().count).toBe(3);
  });

  it('never goes beyond the maximum and stops the timer when it reaches it', () => {
    const h = harness();
    h.profile.loseLife();
    h.profile.loseLife();
    h.profile.grant([{ kind: 'lives', amount: 10 }]);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.profile.data().lifeTimer).toBe(0);
  });

  it('does nothing (and does not notify) when lives are full or the amount is nonsense', () => {
    const h = harness();
    h.profile.grant([{ kind: 'lives' }]);
    h.profile.grant([{ kind: 'lives', amount: 3 }]);
    expect(h.notifications.count).toBe(0);
    h.profile.loseLife();
    const before = h.notifications.count;
    h.profile.grant([{ kind: 'lives', amount: 0 }]);
    h.profile.grant([{ kind: 'lives', amount: -2 }]);
    h.profile.grant([{ kind: 'lives', amount: NaN }]);
    expect(h.profile.lives().count).toBe(4);
    expect(h.notifications.count).toBe(before);
  });
});

describe('lives: a clock that jumps backwards', () => {
  it('never grants a life and never makes the wait longer than one interval', () => {
    const h = harness();
    h.profile.loseLife();
    h.profile.loseLife();
    h.clock.now += 10 * MINUTE;
    expect(h.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: 10 * MINUTE });

    h.clock.now = T0 - 3 * HOUR; // the clock is now before the timer started
    const info = h.profile.lives();
    expect(info.count).toBe(3);
    expect(info.nextInMs).toBe(REGEN); // not 3h20m, not negative
    expect(h.profile.data().lifeTimer).toBe(T0 - 3 * HOUR);
  });

  it('after the jump, lives regenerate normally from the new time', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now = T0 - DAY;
    h.profile.lives();
    h.clock.now += REGEN - 1;
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 1 });
    h.clock.now += 1;
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
  });

  it('a small backwards correction inside the interval only delays the life', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now += 15 * MINUTE;
    h.clock.now -= 5 * MINUTE; // still after the timer start
    expect(h.profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 10 * MINUTE });
  });

  it('a save whose timer lies in the future is clamped at load, and stays clamped across restarts', () => {
    const save = sampleSave();
    save.lives = 1;
    save.lifeTimer = T0 + 10 * DAY;
    const h = fromSave(save);
    expect(h.profile.lives()).toEqual({ count: 1, max: 5, nextInMs: REGEN });
    // The corrected timer was stored, so restarting later continues the wait instead of restarting it.
    expect(h.saved().lifeTimer).toBe(T0);
    h.clock.now += 12 * MINUTE;
    expect(h.restart().profile.lives()).toEqual({ count: 1, max: 5, nextInMs: 8 * MINUTE });
    h.clock.now += 8 * MINUTE;
    expect(h.restart().profile.lives()).toEqual({ count: 2, max: 5, nextInMs: REGEN });
  });

  it('losing a life while the clock is wrong keeps everything consistent', () => {
    const h = harness();
    h.profile.loseLife();
    h.clock.now = T0 - HOUR;
    expect(h.profile.loseLife()).toBe(true);
    expect(h.profile.lives()).toEqual({ count: 3, max: 5, nextInMs: REGEN });
    expect(h.saved().lifeTimer).toBe(T0 - HOUR);
  });

  it('a refused loseLife still stores the corrected timer', () => {
    const save = sampleSave();
    save.lives = 0;
    save.lifeTimer = T0 + HOUR; // ahead of the clock
    const h = fromSave(save);
    h.storage.json = JSON.stringify(save); // as if the correction made at load had not been stored
    h.clock.now += MINUTE;
    const again = h.restart();
    expect(again.profile.loseLife()).toBe(false);
    expect(again.saved().lifeTimer).toBe(T0 + MINUTE);
    expect(again.notifications.count).toBe(0);
  });

  it('with full lives a backwards clock changes nothing', () => {
    const h = harness();
    h.clock.now = T0 - 100 * DAY;
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.storage.writes).toBe(0);
  });
});

describe('lives: damaged timers', () => {
  it('a missing timer while lives are missing starts now', () => {
    const save = sampleSave();
    save.lives = 2;
    save.lifeTimer = 0;
    const h = fromSave(save);
    expect(h.profile.lives()).toEqual({ count: 2, max: 5, nextInMs: REGEN });
    expect(h.profile.data().lifeTimer).toBe(T0);
  });

  it('a timer left over while lives are full is cleared', () => {
    const save = sampleSave();
    save.lives = 5;
    save.lifeTimer = T0 - HOUR;
    const h = fromSave(save);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
    expect(h.profile.data().lifeTimer).toBe(0);
  });

  it('a very old timer simply fills the lives', () => {
    const save = sampleSave();
    save.lives = 0;
    save.lifeTimer = 1;
    const h = fromSave(save);
    expect(h.profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
  });
});

describe('lives: a broken clock', () => {
  it('a clock that returns NaN or throws does not break anything', () => {
    let mode: 'ok' | 'nan' | 'throw' | 'inf' = 'ok';
    let now = T0;
    const profile = createProfile({
      load: () => null,
      save: () => {},
      now: () => {
        if (mode === 'nan') return NaN;
        if (mode === 'inf') return Infinity;
        if (mode === 'throw') throw new Error('no clock');
        return now;
      },
      levelCount: 10,
    });
    profile.loseLife();
    now += 5 * MINUTE;
    expect(profile.lives().nextInMs).toBe(15 * MINUTE);
    for (const broken of ['nan', 'throw', 'inf'] as const) {
      mode = broken;
      // The last good time is reused: same answer, no exception.
      expect(profile.lives()).toEqual({ count: 4, max: 5, nextInMs: 15 * MINUTE });
      expect(profile.loseLife()).toBe(true);
      expect(() => profile.daily()).not.toThrow();
      profile.grant([{ kind: 'lives', amount: 1 }]);
    }
    mode = 'ok';
    now += 15 * MINUTE;
    expect(profile.lives().count).toBe(5);
  });

  it('works with a clock that starts at zero', () => {
    let now = 0;
    const profile = createProfile({ load: () => null, save: () => {}, now: () => now, levelCount: 10 });
    expect(profile.loseLife()).toBe(true);
    const first = profile.lives();
    expect(first.count).toBe(4);
    expect(first.nextInMs).toBeGreaterThan(0);
    expect(first.nextInMs).toBeLessThanOrEqual(REGEN);
    now = REGEN + 1;
    expect(profile.lives()).toEqual({ count: 5, max: 5, nextInMs: 0 });
  });
});

describe('lives: invariants under random play and clock changes', () => {
  it('holds for thousands of random steps', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = rng(seed);
      const h = harness();
      let forward = 0; // total time the clock really moved forwards
      let regenerated = 0;
      let expected = h.profile.lives().count;
      for (let step = 0; step < 2000; step++) {
        const roll = random();
        if (roll < 0.45) {
          const dt = Math.floor(random() * 50 * MINUTE);
          h.clock.now += dt;
          forward += dt;
        } else if (roll < 0.55) {
          h.clock.now -= Math.floor(random() * 3 * HOUR); // backwards
        } else if (roll < 0.85) {
          const had = h.profile.lives().count;
          regenerated += had - expected;
          expect(h.profile.loseLife()).toBe(had > 0);
          expected = had > 0 ? had - 1 : 0;
        } else if (roll < 0.9) {
          h.restart(); // loading must not change anything observable
        }
        const info = h.profile.lives();
        regenerated += info.count - expected;
        expected = info.count;

        expect(info.count).toBeGreaterThanOrEqual(0);
        expect(info.count).toBeLessThanOrEqual(MAX_LIVES);
        expect(info.max).toBe(MAX_LIVES);
        if (info.count === MAX_LIVES) {
          expect(info.nextInMs).toBe(0);
          expect(h.profile.data().lifeTimer).toBe(0);
        } else {
          expect(info.nextInMs).toBeGreaterThan(0);
          expect(info.nextInMs).toBeLessThanOrEqual(REGEN);
          expect(h.profile.data().lifeTimer).toBeLessThanOrEqual(h.clock.now);
        }
        // Lives only ever come from time that really passed.
        expect(regenerated).toBeLessThanOrEqual(Math.floor(forward / REGEN));
      }
      expect(regenerated).toBeGreaterThan(0); // the test did exercise regeneration
    }
  });

  it('a second profile over the same storage always agrees with the first', () => {
    const random = rng(99);
    const h = harness();
    for (let step = 0; step < 300; step++) {
      if (random() < 0.5) h.profile.loseLife();
      h.clock.now += Math.floor(random() * 30 * MINUTE) + SECOND;
      const live = h.profile.lives();
      const reloaded = h.restart().profile.lives();
      expect(reloaded).toEqual(live);
    }
  });
});
