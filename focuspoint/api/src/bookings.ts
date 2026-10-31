// Pure booking rules — no I/O, unit-tested in test/bookings.test.ts.
// Slot validation against the centre's hours, pricing, overlap detection, booking codes and the status machine.
import type { Booking, BookingStatus, Settings } from '../../shared/types'
import { addDays, localParts, timeToMinutes } from './tz'

export type SlotSettings = Pick<Settings, 'timezone' | 'open' | 'close' | 'slot_minutes' | 'min_minutes' | 'max_minutes'>

export type SlotCheck = { ok: true; minutes: number } | { ok: false; error: SlotError }
export type SlotError =
  | 'invalid_time'     // not parseable / end before start / not whole minutes
  | 'off_grid'         // start or end not on the slot grid (settings.slot_minutes)
  | 'not_same_day'     // a booking must start and end on the same local day
  | 'outside_hours'    // outside open–close
  | 'too_short' | 'too_long'
  | 'in_past'

export interface SlotOptions {
  now: Date
  /** Team walk-ins may start a little earlier than "now" (the customer is already in the room). */
  allowPast?: boolean
}

/** Validates a [start, end) window (ISO UTC) against the centre's hours in its local time zone. */
export function validateSlot(startIso: string, endIso: string, s: SlotSettings, opts: SlotOptions): SlotCheck {
  const start = new Date(startIso), end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { ok: false, error: 'invalid_time' }
  if (start.getTime() % 60000 !== 0 || end.getTime() % 60000 !== 0) return { ok: false, error: 'invalid_time' }
  const minutes = (end.getTime() - start.getTime()) / 60000
  if (minutes <= 0) return { ok: false, error: 'invalid_time' }

  const a = localParts(start, s.timezone), b = localParts(end, s.timezone)
  if (a.minutes % s.slot_minutes !== 0 || b.minutes % s.slot_minutes !== 0) return { ok: false, error: 'off_grid' }
  // The end may fall exactly on the next local midnight only if the centre closes at 24:00 — not supported; same day.
  if (a.date !== b.date) return { ok: false, error: 'not_same_day' }
  const open = timeToMinutes(s.open), close = timeToMinutes(s.close)
  if (a.minutes < open || b.minutes > close) return { ok: false, error: 'outside_hours' }
  if (minutes < s.min_minutes) return { ok: false, error: 'too_short' }
  if (minutes > s.max_minutes) return { ok: false, error: 'too_long' }
  if (!opts.allowPast && start.getTime() < opts.now.getTime()) return { ok: false, error: 'in_past' }
  if (opts.allowPast && end.getTime() <= opts.now.getTime()) return { ok: false, error: 'in_past' }
  return { ok: true, minutes }
}

/**
 * settings.booking_horizon_days: a customer may book today and the next (days − 1) local days — the /book date strip.
 * True when the booking starts on a later local day (→ 400 too_far_ahead). Team walk-ins are not limited.
 */
export function beyondHorizon(startIso: string, now: Date, tz: string, days: number): boolean {
  const last = addDays(localParts(now, tz).date, Math.max(1, Math.floor(days)) - 1)
  return localParts(new Date(startIso), tz).date > last
}

/** The cron runs every 5 minutes, so a reminder goes to bookings starting within ±5 minutes of settings.reminder_minutes from now. */
export const REMINDER_WINDOW_MINUTES = 5

/** [from, to) start window for reminders (ISO), or null when reminders are off (reminder_minutes = 0). 60 → 55–65 minutes ahead. */
export function reminderWindow(now: Date, reminderMinutes: number): { from: string; to: string } | null {
  if (!Number.isFinite(reminderMinutes) || reminderMinutes <= 0) return null
  const at = (m: number) => new Date(now.getTime() + m * 60000).toISOString()
  return { from: at(reminderMinutes - REMINDER_WINDOW_MINUTES), to: at(reminderMinutes + REMINDER_WINDOW_MINUTES) }
}

/** Price in Syrian pounds: hours × price_hour (half hours allowed); a full day (≥ 8h) takes the cheaper of price_day and hourly. */
export function price(minutes: number, room: { price_hour: number; price_day: number | null }): number {
  const hourly = Math.round((minutes / 60) * room.price_hour)
  if (room.price_day !== null && room.price_day !== undefined && minutes >= 8 * 60) return Math.min(room.price_day, hourly)
  return hourly
}

/** Two half-open windows [start, end) intersect. */
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(a.end) > Date.parse(b.start)
}

/** A booking that currently blocks its slot: a live hold, a submitted payment, or a confirmed booking. */
export function isBlocking(b: Pick<Booking, 'status' | 'hold_until'>, now: Date): boolean {
  switch (b.status) {
    case 'confirmed':
    case 'awaiting_verification':
      return true
    case 'pending_payment':
      return b.hold_until !== null && Date.parse(b.hold_until) > now.getTime()
    default:
      return false
  }
}

/** Active bookings of the same room that collide with the candidate (excluding the candidate itself). */
export function findConflicts<T extends Pick<Booking, 'id' | 'room_id' | 'start' | 'end' | 'status' | 'hold_until'>>(
  candidate: { id?: number; room_id: number; start: string; end: string }, others: T[], now: Date,
): T[] {
  return others.filter((o) =>
    o.room_id === candidate.room_id && o.id !== candidate.id && isBlocking(o, now) && overlaps(candidate, o))
}

/** SQL fragment matching the same "blocking" rule as isBlocking for table alias `t` (bind the ISO `now` for the placeholder). */
export const activeSql = (t: string): string =>
  `(${t}.status IN ('awaiting_verification','confirmed') OR (${t}.status = 'pending_payment' AND ${t}.hold_until > ?))`
export const ACTIVE_SQL = activeSql('b')

/**
 * "No live booking overlaps [start, end) in this room, other than id X" as a SQL predicate — used inside a conditional
 * UPDATE so confirm/edit are atomic against a racing booking (D1 runs one statement at a time; a single UPDATE … WHERE
 * NOT EXISTS cannot interleave with another insert). Bind, in order: room_id, end, start, excluded id, ISO now.
 */
export const NO_CONFLICT_SQL =
  `NOT EXISTS (SELECT 1 FROM bookings o WHERE o.room_id = ? AND o.start < ? AND o.end > ? AND o.id != ? AND ${activeSql('o')})`

/** Why a guarded UPDATE changed no row: the booking vanished, moved on, or (status unchanged) the slot is taken. */
export function zeroRowsError(fresh: Pick<Booking, 'status'> | null, expected: BookingStatus): 'booking_not_found' | 'illegal_transition' | 'slot_taken' {
  if (!fresh) return 'booking_not_found'
  return fresh.status === expected ? 'slot_taken' : 'illegal_transition'
}

// ---- payment holds ----
/** After hold_until the slot is free for others, but a reference that arrives within this window is still accepted if nobody took the slot. */
export const HOLD_GRACE_MINUTES = 10

export type HoldState = 'none' | 'live' | 'grace' | 'expired'
/** Where a pending_payment hold stands at `now`: live, in its grace window (slot free → still accept the reference), or over. */
export function holdState(holdUntil: string | null, now: Date): HoldState {
  if (holdUntil === null) return 'none'
  const until = Date.parse(holdUntil)
  if (Number.isNaN(until)) return 'none'
  if (now.getTime() < until) return 'live'
  if (now.getTime() < until + HOLD_GRACE_MINUTES * 60000) return 'grace'
  return 'expired'
}

/** The cron expires a hold only once its grace window is over, so a late reference is not refused by a race with the cron. */
export const holdExpiryCutoff = (now: Date): string => new Date(now.getTime() - HOLD_GRACE_MINUTES * 60000).toISOString()

// ---- payment references ----
/** Statuses whose reference is dead: a reference used by one of these may be typed again on a new booking. */
export const REF_FREE_STATUSES: readonly BookingStatus[] = ['rejected', 'expired', 'cancelled']
export const refBlocks = (status: BookingStatus): boolean => !REF_FREE_STATUSES.includes(status)
export const REF_BLOCKING_SQL = `status NOT IN (${REF_FREE_STATUSES.map((s) => `'${s}'`).join(',')})`

// ---- stale verifications ----
/** An awaiting_verification booking nobody checked until this long after its end is expired by the cron. */
export const VERIFICATION_GRACE_MINUTES = 30
export const STALE_VERIFICATION_NOTE = 'انتهت المهلة دون تحقق من الدفع (إغلاق تلقائي)'
export const staleVerificationCutoff = (now: Date): string => new Date(now.getTime() - VERIFICATION_GRACE_MINUTES * 60000).toISOString()
export const isStaleVerification = (b: Pick<Booking, 'status' | 'end'>, now: Date): boolean =>
  b.status === 'awaiting_verification' && Date.parse(b.end) <= Date.parse(staleVerificationCutoff(now))

/** Appends the system note to whatever the staff wrote. */
export const withSystemNote = (note: string | null, system: string): string => (note ? `${note}
${system}` : system)

// ---- offline replay ----
/**
 * The clock an offline op is validated against: the moment the device recorded it (op.at), never later than the server's
 * own clock. A walk-in typed at 14:00 and synced at 20:00 is judged at 14:00, so "in the past" does not reject it;
 * a device clock running ahead is clamped to the server.
 */
export function effectiveNow(opAt: unknown, serverNow: Date): Date {
  if (typeof opAt !== 'string') return serverNow
  const t = Date.parse(opAt)
  if (Number.isNaN(t)) return serverNow
  return t < serverNow.getTime() ? new Date(t) : serverNow
}

// Booking codes: 6 characters, no 0/O/1/I so they survive handwriting in a transfer note. 32 symbols → 2^30 codes.
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/

export function generateCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(6)
  let out = ''
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[(bytes[i] ?? 0) % 32]   // 256 % 32 === 0 → unbiased
  return out
}

/** Cleans a code typed by a customer: trim, upper-case, drop spaces/dashes. */
export const normaliseCode = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const c = v.trim().toUpperCase().replace(/[\s-]/g, '')
  return CODE_RE.test(c) ? c : null
}

// Status machine. Anything not listed is illegal (→ 409 illegal_transition).
export const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_payment: ['awaiting_verification', 'confirmed', 'expired', 'cancelled', 'rejected'],
  awaiting_verification: ['confirmed', 'rejected', 'cancelled', 'expired'],   // expired: by the cron, long after the slot ended
  confirmed: ['cancelled', 'completed'],
  rejected: [],
  expired: [],
  cancelled: [],
  completed: [],
}

export const canTransition = (from: BookingStatus, to: BookingStatus): boolean => TRANSITIONS[from].includes(to)

export const TERMINAL: readonly BookingStatus[] = ['rejected', 'expired', 'cancelled', 'completed']
export const isTerminal = (s: BookingStatus): boolean => TERMINAL.includes(s)
