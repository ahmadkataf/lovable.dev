// The licence clock: the latest time this installation has ever seen. The trial and dated codes are measured
// against it, so turning the device's clock back never gives back trial days or revives an expired code.
// It is kept in two places that are cleared separately (the database's settings and localStorage); the later
// of the two wins. A restore that brings back an older value cannot move it back either.

export const LAST_SEEN_SETTING = 'lastSeen'
const LS_KEY = 'dentora.lastSeen'
const HOUR = 3_600_000
/** Instants after this are not plausible device times (a corrupted value must not freeze the licence). */
const MAX_PLAUSIBLE = Date.UTC(2100, 0, 1)

/** Milliseconds of a stored value (ISO text or a number), or NaN. */
export function instantOf(v: unknown): number {
  const t = typeof v === 'number' ? v : typeof v === 'string' && v ? new Date(v).getTime() : NaN
  return Number.isFinite(t) && t > 0 && t < MAX_PLAUSIBLE ? t : NaN
}
/** The latest of the given instants (unreadable ones ignored), or 0. */
export function latestOf(values: unknown[]): number {
  return values.map(instantOf).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0)
}

let latest = 0
let savedToDb = 0

function readLocal(): number {
  try { return instantOf(Number(localStorage.getItem(LS_KEY))) || 0 } catch { return 0 }
}
function writeLocal(t: number): void {
  try { localStorage.setItem(LS_KEY, String(t)) } catch { /* private mode: the database copy still holds */ }
}

/** Takes in a remembered instant (from the database at start-up) and the device's clock now. */
export function noteTime(...values: unknown[]): number {
  const before = latest
  latest = Math.max(latest, readLocal(), latestOf(values), Date.now())
  if (latest - before >= 60_000 || !before) writeLocal(latest)
  return latest
}
/** The licence's "now": the device clock, or the latest time already seen when the clock has been set back. */
export function trustedNow(now = Date.now()): number {
  return Math.max(now, latest, readLocal())
}
/** How far the device clock is behind the latest time seen (0 when it is not). */
export function clockBehindBy(now = Date.now()): number {
  return Math.max(0, trustedNow(now) - now)
}
/** True when the database copy is more than an hour old: the caller then stores `latest` (rarely, to keep writes few). */
export function shouldPersist(storedInDb: unknown): boolean {
  const db = Math.max(instantOf(storedInDb) || 0, savedToDb)
  return latest - db >= HOUR
}
export function markPersisted(t: number): void { savedToDb = Math.max(savedToDb, t) }
export function currentLatest(): number { return latest }

/** For tests only: forget everything held in memory. */
export function resetClockForTests(): void { latest = 0; savedToDb = 0 }
