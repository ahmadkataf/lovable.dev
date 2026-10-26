// Booking logic shared by the customer screens: slots, durations, prices, labels.
import type { ApiContract, Booking, BookingStatus, Photo, PublicSettings, Room, RoomContents, RoomType } from '@shared/types'
import { isSafeImageSrc } from '@shared/content'
import type { IconName } from '../ui'
import { addDays, todayLocal, toLocalParts } from '../format'

export type Availability = ApiContract['GET /v1/availability?date=YYYY-MM-DD']['res'][number]
export type BookingFull = ApiContract['GET /v1/bookings/:id']['res']
export interface Pick { date: string; time: string; minutes: number }

export const ROOM_TYPE: Record<RoomType, string> = { private: 'غرفة خاصة', meeting: 'قاعة اجتماعات', desk: 'مساحة مفتوحة', hall: 'قاعة' }
export const ROOM_ICON: Record<RoomType, IconName> = { private: 'door', meeting: 'people', desk: 'chair', hall: 'grid' }

const BLOCKING: BookingStatus[] = ['pending_payment', 'awaiting_verification', 'confirmed']
export function isLive(status: BookingStatus): boolean { return BLOCKING.includes(status) }
export function blocks(a: Availability): boolean { return BLOCKING.includes(a.status) }
/** The server's "live booking" rule: confirmed, awaiting verification, or a hold that has not run out. */
export function isBlocking(b: { status: BookingStatus; hold_until: string | null }, now = Date.now()): boolean {
  if (b.status === 'confirmed' || b.status === 'awaiting_verification') return true
  if (b.status === 'pending_payment') return b.hold_until !== null && Date.parse(b.hold_until) > now
  return false
}
/** A customer booking that still waits for something (pay, or the team's confirmation). */
export function isOpen(b: { status: BookingStatus }): boolean {
  return b.status === 'pending_payment' || b.status === 'awaiting_verification'
}
/** Awaiting the team at the desk: a "pay on arrival" booking. */
export function isCashAwaiting(b: { status: BookingStatus; method: Booking['method'] }): boolean {
  return b.method === 'cash' && isOpen(b)
}

export function contentsList(c: RoomContents): { icon: IconName; label: string }[] {
  const out: { icon: IconName; label: string }[] = []
  if (c.chairs) out.push({ icon: 'chair', label: c.chairs === 1 ? 'كرسي' : c.chairs === 2 ? 'كرسيان' : `${c.chairs} كراسي` })
  if (c.tables) out.push({ icon: 'table', label: c.tables === 1 ? 'طاولة' : c.tables === 2 ? 'طاولتان' : `${c.tables} طاولات` })
  if (c.screen) out.push({ icon: 'screen', label: 'شاشة' })
  if (c.projector) out.push({ icon: 'projector', label: 'بروجكتر' })
  if (c.whiteboard) out.push({ icon: 'whiteboard', label: 'سبورة' })
  if (c.wifi) out.push({ icon: 'wifi', label: 'إنترنت' })
  if (c.ac) out.push({ icon: 'ac', label: 'تكييف' })
  if (c.coffee) out.push({ icon: 'coffee', label: 'قهوة' })
  return out
}
/** The room's own photos (Room.photos, in order); [] when it has none — the screens then show today's icon visuals. */
export function roomPhotos(room: Pick<Room, 'photos'> | null | undefined): Photo[] {
  const list: unknown = room?.photos
  if (!Array.isArray(list)) return []
  return list.filter((p): p is Photo => !!p && typeof p === 'object' && typeof (p as Photo).src === 'string' && isSafeImageSrc((p as Photo).src))
}

export function contentsIcons(c: RoomContents): IconName[] {
  return contentsList(c).map((i) => i.icon).filter((i) => i !== 'chair' && i !== 'table')
}

export const toMin = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export const toHHMM = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Start times ("HH:MM") offered for a date: from opening to the last start that fits min_minutes; today only from the next slot. */
export function slotsFor(s: PublicSettings, date: string): string[] {
  const open = toMin(s.open)
  const close = toMin(s.close) <= open ? toMin(s.close) + 24 * 60 : toMin(s.close)
  const step = s.slot_minutes || 30
  const out: string[] = []
  let floor = open
  if (date === todayLocal()) {
    const now = toMin(toLocalParts(new Date().toISOString()).time) + 5   // a few minutes of grace to finish the form
    floor = Math.max(open, Math.ceil(now / step) * step)
  }
  for (let t = Math.ceil(open / step) * step; t + s.min_minutes <= close; t += step) {
    if (t >= floor) out.push(toHHMM(t % (24 * 60)))
  }
  return out
}

/** Durations (minutes) that fit between the start time and closing. */
export function durationsFor(s: PublicSettings, time: string): number[] {
  const open = toMin(s.open)
  let close = toMin(s.close)
  if (close <= open) close += 24 * 60
  const step = s.slot_minutes || 30
  const start = toMin(time)
  const max = Math.min(s.max_minutes, close - start)
  const all: number[] = []
  for (let m = s.min_minutes; m <= max; m += step) all.push(m)
  if (all.length <= 8) return all
  const curated = new Set([s.min_minutes, 60, 90, 120, 180, 240, 300, 360, 480, 600, max])
  return all.filter((m) => curated.has(m))
}

// ---- booking & payment capabilities (PublicSettings). A field missing from an older cached settings object keeps
// today's behaviour. ----

/** Online booking is open (settings.booking_enabled, default true). */
export function bookingOpen(s: Partial<PublicSettings> | null | undefined): boolean {
  return s?.booking_enabled !== false
}
/** How many days ahead (today included) a customer may book: settings.booking_horizon_days, 1–365, default 14. */
export function horizonDays(s: Partial<PublicSettings> | null | undefined): number {
  const n = s?.booking_horizon_days
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(365, Math.floor(n)) : 14
}
/** The last date a customer may book (the server's too_far_ahead rule). */
export function lastBookableDate(s: Partial<PublicSettings> | null | undefined, today = todayLocal()): string {
  return addDays(today, horizonDays(s) - 1)
}
/**
 * Which payment methods a new booking may use. Sham Cash: settings.shamcash_enabled (default true); pay on arrival:
 * settings.allow_pay_on_arrival (default false). The server keeps at least one on; should both read off, Sham Cash is
 * offered (today's default) and the server's answer explains.
 */
export function paymentMethods(s: Partial<PublicSettings> | null | undefined): { shamcash: boolean; cash: boolean } {
  const cash = s?.allow_pay_on_arrival === true
  return { shamcash: s?.shamcash_enabled !== false || !cash, cash }
}
/** Customers may cancel their own booking before confirmation (settings.customer_can_cancel, default true). */
export function customerCanCancel(s: Partial<PublicSettings> | null | undefined): boolean {
  return s?.customer_can_cancel !== false
}
/** Minutes before the start for the reminder (settings.reminder_minutes, default 60); 0 = no reminders. */
export function reminderMinutes(s: Partial<PublicSettings> | null | undefined): number {
  const n = s?.reminder_minutes
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.round(n)) : 60
}

/** The first date from `from` (inclusive) that still has a bookable start time, within the booking horizon. */
export function firstBookableDate(s: PublicSettings, from = todayLocal()): string {
  let date = from
  for (let i = 0; i < horizonDays(s) && slotsFor(s, date).length === 0; i++) date = addDays(date, 1)
  return date
}
/** Pick a time + duration for a date: the first slot (2 hours when possible). */
export function pickFor(s: PublicSettings, date: string): Pick {
  const slots = slotsFor(s, date)
  const time = slots[0] || s.open
  const ds = durationsFor(s, time)
  const minutes = ds.includes(120) ? 120 : (ds[ds.length - 1] ?? s.min_minutes)
  return { date, time, minutes }
}
/** Today, next slot, 2 hours — or the first slot tomorrow when the centre is closing. */
export function defaultPick(s: PublicSettings): Pick {
  return pickFor(s, firstBookableDate(s))
}
/** True when the pick names a start time still offered for its date (within the booking horizon) and a duration that fits. */
export function isValidPick(s: PublicSettings, p: Pick): boolean {
  return p.date <= lastBookableDate(s) && slotsFor(s, p.date).includes(p.time) && durationsFor(s, p.time).includes(p.minutes)
}

/** Same formula as the server (api/src/bookings.ts price): hourly = round(minutes/60 × price_hour); from 8 hours the
 *  cheaper of price_day and hourly. */
export function priceFor(room: { price_hour: number; price_day: number | null }, minutes: number): number {
  const hourly = Math.round((minutes / 60) * room.price_hour)
  if (room.price_day !== null && room.price_day !== undefined && minutes >= 8 * 60) return Math.min(room.price_day, hourly)
  return hourly
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function peopleLabel(n: number): string {
  if (n === 1) return 'شخص واحد'
  if (n === 2) return 'شخصين'
  if (n <= 10) return `${n} أشخاص`
  return `${n} شخص`
}

export function isUpcoming(b: Booking): boolean {
  return isLive(b.status) && new Date(b.end).getTime() > Date.now()
}
