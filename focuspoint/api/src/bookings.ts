// Pure booking rules — no I/O, unit-tested in test/bookings.test.ts.
// Slot validation against the centre's hours, pricing, overlap detection, booking codes and the status machine.
import type { Booking, BookingStatus, Settings } from '../../shared/types'
import { localParts, timeToMinutes } from './tz'

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

/** SQL fragment matching the same "blocking" rule as isBlocking (bind the ISO `now` for the placeholder). */
export const ACTIVE_SQL = `(b.status IN ('awaiting_verification','confirmed') OR (b.status = 'pending_payment' AND b.hold_until > ?))`

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
  awaiting_verification: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['cancelled', 'completed'],
  rejected: [],
  expired: [],
  cancelled: [],
  completed: [],
}

export const canTransition = (from: BookingStatus, to: BookingStatus): boolean => TRANSITIONS[from].includes(to)

export const TERMINAL: readonly BookingStatus[] = ['rejected', 'expired', 'cancelled', 'completed']
export const isTerminal = (s: BookingStatus): boolean => TERMINAL.includes(s)
