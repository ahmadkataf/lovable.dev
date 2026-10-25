// Booking logic shared by the customer screens: slots, durations, prices, labels.
import type { ApiContract, Booking, BookingStatus, PublicSettings, Room, RoomContents, RoomType } from '@shared/types'
import type { IconName } from '../ui'
import { addDays, todayLocal, toLocalParts } from '../format'

export type Availability = ApiContract['GET /v1/availability?date=YYYY-MM-DD']['res'][number]
export type BookingFull = ApiContract['GET /v1/bookings/:id']['res']
export interface Pick { date: string; time: string; minutes: number }

export const ROOM_TYPE: Record<RoomType, string> = { private: 'مكتب خاص', meeting: 'غرفة اجتماعات', desk: 'مكتب مشترك', hall: 'قاعة' }
export const ROOM_ICON: Record<RoomType, IconName> = { private: 'door', meeting: 'people', desk: 'chair', hall: 'grid' }

const BLOCKING: BookingStatus[] = ['pending_payment', 'awaiting_verification', 'confirmed']
export function isLive(status: BookingStatus): boolean { return BLOCKING.includes(status) }
export function blocks(a: Availability): boolean { return BLOCKING.includes(a.status) }

export function contentsList(c: RoomContents): { icon: IconName; label: string }[] {
  const out: { icon: IconName; label: string }[] = []
  if (c.chairs) out.push({ icon: 'chair', label: c.chairs === 1 ? 'كرسي' : c.chairs === 2 ? 'كرسيان' : `${c.chairs} كراسي` })
  if (c.tables) out.push({ icon: 'table', label: c.tables === 1 ? 'طاولة' : c.tables === 2 ? 'طاولتان' : `${c.tables} طاولات` })
  if (c.screen) out.push({ icon: 'screen', label: 'شاشة' })
  if (c.projector) out.push({ icon: 'projector', label: 'بروجكتر' })
  if (c.whiteboard) out.push({ icon: 'whiteboard', label: 'لوح أبيض' })
  if (c.wifi) out.push({ icon: 'wifi', label: 'إنترنت' })
  if (c.ac) out.push({ icon: 'ac', label: 'تكييف' })
  if (c.coffee) out.push({ icon: 'coffee', label: 'قهوة' })
  return out
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

/** Today, next slot, 2 hours — or the first slot tomorrow when the centre is closing. */
export function defaultPick(s: PublicSettings): Pick {
  let date = todayLocal()
  let slots = slotsFor(s, date)
  if (slots.length === 0) { date = addDays(date, 1); slots = slotsFor(s, date) }
  const time = slots[0] || s.open
  const ds = durationsFor(s, time)
  const minutes = ds.includes(120) ? 120 : (ds[ds.length - 1] ?? s.min_minutes)
  return { date, time, minutes }
}

export function priceFor(room: Room, minutes: number): number {
  const hourly = Math.round((room.price_hour * minutes) / 60)
  if (room.price_day && hourly > room.price_day) return room.price_day
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
