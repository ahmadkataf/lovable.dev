import { describe, expect, it } from 'vitest';
import { Scheduler, Timers } from '../../src/play/anim.ts';

describe('Scheduler', () => {
  it('runs a tween from 0 to 1 in game time and resolves once', async () => {
    const s = new Scheduler();
    const seen: number[] = [];
    let done = 0;
    void s.tween(100, (k) => seen.push(k)).then(() => done++);
    s.step(25);
    s.step(25);
    expect(seen).toEqual([0.25, 0.5]);
    s.step(100);
    await Promise.resolve();
    expect(seen[seen.length - 1]).toBe(1);
    expect(done).toBe(1);
    expect(s.active()).toBe(false);
  });

  it('honours the start delay', () => {
    const s = new Scheduler();
    const seen: number[] = [];
    s.run(100, (k) => seen.push(k), undefined, 50);
    s.step(40);
    expect(seen).toEqual([]);
    s.step(20);
    expect(seen).toEqual([0.1]);
  });

  it('fires callbacks in the order they were scheduled when they fall due together', () => {
    const s = new Scheduler();
    const order: string[] = [];
    s.after(30, () => order.push('a'));
    s.after(30, () => order.push('b'));
    s.after(10, () => order.push('c'));
    s.step(100);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('starts tweens added during a step on the next step', () => {
    const s = new Scheduler();
    const seen: number[] = [];
    s.after(10, () => s.run(100, (k) => seen.push(k)));
    s.step(50);
    expect(seen).toEqual([]);
    s.step(50);
    expect(seen).toEqual([0.5]);
  });

  it('tells its owner whenever something is scheduled', () => {
    const s = new Scheduler();
    let wakes = 0;
    s.onSchedule = () => wakes++;
    s.run(10, () => undefined);
    void s.wait(10);
    s.after(10, () => undefined);
    expect(wakes).toBe(3);
  });

  it('clear() drops everything without finishing it', async () => {
    const s = new Scheduler();
    let updates = 0;
    let resolved = false;
    void s.tween(100, () => updates++).then(() => (resolved = true));
    s.step(10);
    s.clear();
    s.step(1000);
    await Promise.resolve();
    expect(updates).toBe(1);
    expect(resolved).toBe(false);
    expect(s.count()).toBe(0);
  });

  it('clear() from inside a callback is safe', () => {
    const s = new Scheduler();
    let later = 0;
    s.after(10, () => s.clear());
    s.after(10, () => later++);
    s.step(20);
    s.step(20);
    expect(later).toBe(0);
    expect(s.active()).toBe(false);
  });
});

function fakeHost() {
  let now = 0;
  let nextHandle = 1;
  const pending = new Map<number, { fn: () => void; at: number }>();
  return {
    host: {
      set: (fn: () => void, ms: number) => {
        const h = nextHandle++;
        pending.set(h, { fn, at: now + ms });
        return h;
      },
      clear: (h: unknown) => {
        pending.delete(h as number);
      },
      now: () => now,
    },
    advance(ms: number) {
      now += ms;
      for (const [h, entry] of Array.from(pending.entries())) {
        if (entry.at <= now) {
          pending.delete(h);
          entry.fn();
        }
      }
    },
    pending: () => pending.size,
  };
}

describe('Timers', () => {
  it('fires after the delay', () => {
    const f = fakeHost();
    const t = new Timers(f.host);
    let fired = 0;
    t.after(100, () => fired++);
    f.advance(99);
    expect(fired).toBe(0);
    f.advance(1);
    expect(fired).toBe(1);
    expect(t.count()).toBe(0);
  });

  it('pause keeps the time left, resume continues', () => {
    const f = fakeHost();
    const t = new Timers(f.host);
    let fired = 0;
    t.after(100, () => fired++);
    f.advance(60);
    t.pause();
    expect(f.pending()).toBe(0);
    f.advance(1000);
    expect(fired).toBe(0);
    t.resume();
    f.advance(39);
    expect(fired).toBe(0);
    f.advance(1);
    expect(fired).toBe(1);
  });

  it('a timer added while paused starts on resume', () => {
    const f = fakeHost();
    const t = new Timers(f.host);
    let fired = 0;
    t.pause();
    t.after(50, () => fired++);
    f.advance(500);
    expect(fired).toBe(0);
    t.resume();
    f.advance(50);
    expect(fired).toBe(1);
  });

  it('advance() lets time pass by hand while paused, firing in due order, and is ignored while running', () => {
    const f = fakeHost();
    const t = new Timers(f.host);
    const fired: string[] = [];
    t.after(100, () => fired.push('late'));
    t.after(40, () => {
      fired.push('early');
      t.after(10, () => fired.push('chained'));
    });
    const gone = t.after(50, () => fired.push('cancelled'));
    t.advance(1000); // running on the real clock: nothing happens
    expect(fired).toEqual([]);
    t.pause();
    t.cancel(gone);
    t.advance(39);
    expect(fired).toEqual([]);
    t.advance(1);
    expect(fired).toEqual(['early']);
    t.advance(200);
    expect(fired).toEqual(['early', 'chained', 'late']);
    expect(t.count()).toBe(0);
    // what is left after a hand-advance is what resume() arms
    t.after(100, () => fired.push('resumed'));
    t.advance(70);
    t.resume();
    f.advance(29);
    expect(fired.length).toBe(3);
    f.advance(1);
    expect(fired[3]).toBe('resumed');
  });

  it('cancel and clear stop timers', () => {
    const f = fakeHost();
    const t = new Timers(f.host);
    let fired = 0;
    const id = t.after(10, () => fired++);
    t.after(10, () => fired++);
    t.cancel(id);
    f.advance(10);
    expect(fired).toBe(1);
    t.after(10, () => fired++);
    t.after(20, () => fired++);
    t.clear();
    f.advance(100);
    expect(fired).toBe(1);
    expect(t.count()).toBe(0);
    expect(f.pending()).toBe(0);
  });
});
