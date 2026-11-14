/**
 * The open-attempt note.
 *
 * "A life is lost when a level is failed or abandoned after the first move" (docs/DESIGN.md §5) —
 * also when the app is simply closed in the middle of the level. The profile only learns about
 * the ways out that go through a dialog, so while an attempt that would cost a life is open the
 * play screen keeps a tiny note in web storage, and whoever finds the note at the next start takes
 * the life then (`settleOpenAttempt`).
 *
 * The note names the attempt by the profile's own attempt counter (`stats.played`): it only counts
 * when that counter still stands where the note left it — after a reset, with another save, or
 * with no storage at all, nothing is charged. Every access is guarded: a missing or failing
 * storage means "no note".
 *
 * Pure apart from the storage it is handed: unit-tested under Node.
 */

export interface NoteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AttemptNote {
  /** level id of the open attempt */
  level: number;
  /** the profile's attempt counter when the attempt became costly */
  played: number;
}

export interface AttemptJournal {
  /** An attempt has become costly (first move made). */
  open(level: number, played: number): void;
  /** The attempt was settled: won, or its life was taken, or the level was left before any move. */
  close(): void;
  /** The note left by an attempt that was never settled, if any. */
  pending(): AttemptNote | null;
}

export const ATTEMPT_KEY = 'match3.attempt.v1';

export function createJournal(storage: NoteStorage | null): AttemptJournal {
  let cached: AttemptNote | null | undefined;

  function read(): AttemptNote | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(ATTEMPT_KEY);
      if (!raw) return null;
      const o: unknown = JSON.parse(raw);
      if (typeof o !== 'object' || o === null) return null;
      const level = (o as { level?: unknown }).level;
      const played = (o as { played?: unknown }).played;
      if (typeof level !== 'number' || typeof played !== 'number' || !isFinite(level) || !isFinite(played)) return null;
      return { level: Math.floor(level), played: Math.floor(played) };
    } catch {
      return null;
    }
  }

  return {
    open(level, played) {
      cached = { level, played };
      if (!storage) return;
      try {
        storage.setItem(ATTEMPT_KEY, JSON.stringify(cached));
      } catch {
        // storage full or disabled: the attempt is simply not remembered
      }
    },
    close() {
      const had = cached === undefined ? read() : cached;
      cached = null;
      if (!storage || !had) return;
      try {
        storage.removeItem(ATTEMPT_KEY);
      } catch {
        // nothing to remove
      }
    },
    pending() {
      if (cached === undefined) cached = read();
      return cached;
    },
  };
}

/** Web storage, or null where there is none (Node, privacy modes that throw on touch). */
export function webStorage(): NoteStorage | null {
  try {
    const store = typeof window !== 'undefined' ? window.localStorage : null;
    return store || null;
  } catch {
    return null;
  }
}

/** The part of the profile the settlement needs. */
export interface AttemptProfile {
  data(): { stats: { played: number } };
  loseLife(): boolean;
}

/**
 * Settle an attempt that was left open by closing the app: it costs its life now. Safe to call at
 * every start (it does nothing when there is no note, or when the note belongs to another save).
 * Returns true when a life was charged.
 */
export function settleOpenAttempt(journal: AttemptJournal, profile: AttemptProfile): boolean {
  const note = journal.pending();
  if (!note) return false;
  journal.close();
  let played = -1;
  try {
    played = profile.data().stats.played;
  } catch {
    return false;
  }
  if (played !== note.played) return false;
  try {
    profile.loseLife();
  } catch {
    return false;
  }
  return true;
}
