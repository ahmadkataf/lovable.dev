import { describe, expect, it } from 'vitest';
import { ATTEMPT_KEY, createJournal, settleOpenAttempt } from '../../src/play/journal.ts';
import type { NoteStorage } from '../../src/play/journal.ts';

function memory(initial?: Record<string, string>): NoteStorage & { data: Record<string, string>; writes: number } {
  const data: Record<string, string> = { ...(initial || {}) };
  const store = {
    data,
    writes: 0,
    getItem: (k: string) => (k in data ? (data[k] as string) : null),
    setItem: (k: string, v: string) => {
      store.writes++;
      data[k] = v;
    },
    removeItem: (k: string) => {
      store.writes++;
      delete data[k];
    },
  };
  return store;
}

function profile(played: number, lives = 5) {
  const p = {
    lives,
    lost: 0,
    data: () => ({ stats: { played } }),
    loseLife: () => {
      p.lost++;
      if (p.lives > 0) p.lives--;
      return true;
    },
  };
  return p;
}

describe('open-attempt note (a level abandoned by closing the app costs its life at the next start)', () => {
  it('keeps the note of a costly attempt across a restart and charges it exactly once', () => {
    const disk = memory();
    createJournal(disk).open(12, 7);
    expect(JSON.parse(disk.data[ATTEMPT_KEY] as string)).toEqual({ level: 12, played: 7 });

    // the app was killed; a new journal reads the same storage
    const p = profile(7);
    expect(settleOpenAttempt(createJournal(disk), p)).toBe(true);
    expect(p.lost).toBe(1);
    expect(disk.data[ATTEMPT_KEY]).toBeUndefined();

    // and the start after that finds nothing
    expect(settleOpenAttempt(createJournal(disk), p)).toBe(false);
    expect(p.lost).toBe(1);
  });

  it('charges nothing when the attempt was settled (won, life taken, left before a move)', () => {
    const disk = memory();
    const j = createJournal(disk);
    j.open(3, 1);
    j.close();
    expect(disk.data[ATTEMPT_KEY]).toBeUndefined();
    const p = profile(1);
    expect(settleOpenAttempt(createJournal(disk), p)).toBe(false);
    expect(p.lost).toBe(0);
  });

  it('ignores a note that belongs to another save (reset, restored backup, a later attempt)', () => {
    for (const played of [0, 6, 8]) {
      const disk = memory();
      createJournal(disk).open(12, 7);
      const p = profile(played);
      expect(settleOpenAttempt(createJournal(disk), p)).toBe(false);
      expect(p.lost).toBe(0);
      // the stale note is gone all the same
      expect(disk.data[ATTEMPT_KEY]).toBeUndefined();
    }
  });

  it('survives missing, failing and corrupted storage without charging', () => {
    const p = profile(7);
    expect(settleOpenAttempt(createJournal(null), p)).toBe(false);
    const j = createJournal(null);
    j.open(1, 7);
    expect(j.pending()).toEqual({ level: 1, played: 7 }); // remembered for this session only
    j.close();
    expect(j.pending()).toBeNull();

    const broken: NoteStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const b = createJournal(broken);
    expect(() => b.open(1, 7)).not.toThrow();
    expect(() => b.close()).not.toThrow();
    expect(settleOpenAttempt(createJournal(broken), p)).toBe(false);

    for (const junk of ['', 'null', '{', '[]', '{"level":"x","played":7}', '{"level":1}', '{"level":1,"played":null}', '"7"']) {
      const disk = memory({ [ATTEMPT_KEY]: junk });
      expect(settleOpenAttempt(createJournal(disk), p)).toBe(false);
    }
    expect(p.lost).toBe(0);
  });

  it('does not touch storage when there is nothing to close', () => {
    const disk = memory();
    const j = createJournal(disk);
    j.close();
    j.close();
    expect(disk.writes).toBe(0);
    j.open(2, 4);
    j.close();
    j.close();
    expect(disk.writes).toBe(2);
  });

  it('a profile that throws is not charged and does not break the start', () => {
    const disk = memory();
    createJournal(disk).open(12, 7);
    const bad = {
      data: () => {
        throw new Error('boom');
      },
      loseLife: () => true,
    };
    expect(settleOpenAttempt(createJournal(disk), bad)).toBe(false);
  });
});
