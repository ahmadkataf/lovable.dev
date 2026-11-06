// Pricing rules shared by the Worker and the web app (one formula, so the price on screen is the price recorded).
// Amounts are whole numbers in the booking's currency: new Syrian pounds (SYP) or US dollars (USD, the training hall
// for private organisations).
//
// - Open space (room type 'desk'): booked by the seat — price_hour × seats × hours. Several bookings share the room up
//   to its capacity (seats).
// - Private rooms ('private'): the whole room — price_hour × hours (a full day ≥ 8 h takes price_day when cheaper).
// - Training hall ('meeting' / 'hall'): by who books — private organisations & NGOs pay settings.hall_org_usd_hour
//   in USD per hour, government bodies settings.hall_gov_hour in SYP per hour. Personal courses are arranged with the
//   team (settings.course_share_percent of the course value), so they are not booked online.
// - Subscriptions (open space only): one seat every day during opening hours for 7 days (week) or 30 days (month),
//   at settings.sub_week_price / sub_month_price.
import type { BookingKind, Currency, HallTier, Room, Settings } from './types'

export type PricingSettings = Pick<Settings, 'sub_week_price' | 'sub_month_price' | 'hall_org_usd_hour' | 'hall_gov_hour'>

export const SUB_DAYS: Record<Exclude<BookingKind, 'hourly'>, number> = { week: 7, month: 30 }

export const isHall = (room: Pick<Room, 'type'>): boolean => room.type === 'meeting' || room.type === 'hall'
export const isSeats = (room: Pick<Room, 'type'>): boolean => room.type === 'desk'

/** Units a booking takes from its room: seats in the open space, the whole room (1 of 1) elsewhere. */
export const unitsOf = (room: Pick<Room, 'type'>, seats: number | null | undefined): number =>
  isSeats(room) ? Math.max(1, Math.floor(seats ?? 1)) : 1
/** Units a room offers at the same time. */
export const capacityUnits = (room: Pick<Room, 'type' | 'capacity'>): number => (isSeats(room) ? Math.max(1, room.capacity) : 1)

export interface QuoteInput {
  room: Pick<Room, 'type' | 'price_hour' | 'price_day'>
  kind: BookingKind
  minutes: number          // hourly bookings; ignored for subscriptions
  seats: number            // open space; 1 elsewhere
  tier: HallTier | null    // training hall only
}
export type Quote = { ok: true; price: number; currency: Currency } | { ok: false; error: 'tier_required' | 'not_subscribable' | 'invalid_seats' }

export function quote(q: QuoteInput, s: PricingSettings): Quote {
  const hours = q.minutes / 60
  if (q.kind !== 'hourly') {
    if (!isSeats(q.room)) return { ok: false, error: 'not_subscribable' }
    return { ok: true, price: q.kind === 'week' ? s.sub_week_price : s.sub_month_price, currency: 'SYP' }
  }
  if (isHall(q.room)) {
    if (q.tier === 'org') return { ok: true, price: Math.round(hours * s.hall_org_usd_hour), currency: 'USD' }
    if (q.tier === 'gov') return { ok: true, price: Math.round(hours * s.hall_gov_hour), currency: 'SYP' }
    return { ok: false, error: 'tier_required' }
  }
  if (isSeats(q.room)) {
    if (!Number.isInteger(q.seats) || q.seats < 1) return { ok: false, error: 'invalid_seats' }
    return { ok: true, price: Math.round(hours * q.room.price_hour * q.seats), currency: 'SYP' }
  }
  const hourly = Math.round(hours * q.room.price_hour)
  if (q.room.price_day !== null && q.room.price_day !== undefined && q.minutes >= 8 * 60) return { ok: true, price: Math.min(q.room.price_day, hourly), currency: 'SYP' }
  return { ok: true, price: hourly, currency: 'SYP' }
}

/** "2,500 ل.س" / "10 $". */
export function fmtMoney(amount: number, currency: Currency = 'SYP'): string {
  const n = Math.round(amount).toLocaleString('en-US')
  return currency === 'USD' ? `${n} $` : `${n} ل.س`
}

/**
 * Peak number of units in use at any moment of [start, end) by `others` (their own windows and units), plus `add`.
 * The peak of a step function over an interval is reached at the interval start or at one of the others' starts.
 */
export function peakUnits(start: string, end: string, others: { start: string; end: string; units: number }[], add = 0): number {
  const s = Date.parse(start), e = Date.parse(end)
  const live = others.filter((o) => Date.parse(o.start) < e && Date.parse(o.end) > s)
  const points = [s, ...live.map((o) => Date.parse(o.start)).filter((t) => t > s && t < e)]
  let peak = 0
  for (const t of points) {
    let used = 0
    for (const o of live) if (Date.parse(o.start) <= t && Date.parse(o.end) > t) used += o.units
    peak = Math.max(peak, used)
  }
  return peak + add
}
