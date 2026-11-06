import { describe, expect, it } from 'vitest'
import { capacityUnits, fmtMoney, peakUnits, quote, unitsOf } from '../../shared/pricing'
import { subscriptionWindow } from '../src/bookings'

const S = { sub_week_price: 2500, sub_month_price: 5000, hall_org_usd_hour: 10, hall_gov_hour: 1000 }
const desk = { type: 'desk' as const, price_hour: 100, price_day: null, capacity: 8 }
const room = { type: 'private' as const, price_hour: 100, price_day: null, capacity: 4 }
const hall = { type: 'meeting' as const, price_hour: 1000, price_day: null, capacity: 10 }

describe('quote (the centre price list)', () => {
  it('open space: 100 per person per hour', () => {
    expect(quote({ room: desk, kind: 'hourly', minutes: 60, seats: 1, tier: null }, S)).toEqual({ ok: true, price: 100, currency: 'SYP' })
    expect(quote({ room: desk, kind: 'hourly', minutes: 150, seats: 3, tier: null }, S)).toEqual({ ok: true, price: 750, currency: 'SYP' })
  })
  it('private room: 100 per person per hour (the room stays one booking)', () => {
    expect(quote({ room, kind: 'hourly', minutes: 120, seats: 1, tier: null }, S)).toEqual({ ok: true, price: 200, currency: 'SYP' })
    expect(quote({ room, kind: 'hourly', minutes: 120, seats: 3, tier: null }, S)).toEqual({ ok: true, price: 600, currency: 'SYP' })
    expect(unitsOf(room, 3)).toBe(1)
  })
  it('training hall: $10/h for organisations, 1,000/h for government, group required', () => {
    expect(quote({ room: hall, kind: 'hourly', minutes: 180, seats: 1, tier: 'org' }, S)).toEqual({ ok: true, price: 30, currency: 'USD' })
    expect(quote({ room: hall, kind: 'hourly', minutes: 90, seats: 1, tier: 'gov' }, S)).toEqual({ ok: true, price: 1500, currency: 'SYP' })
    expect(quote({ room: hall, kind: 'hourly', minutes: 60, seats: 1, tier: null }, S)).toEqual({ ok: false, error: 'tier_required' })
  })
  it('subscriptions: open space only, flat week / month price', () => {
    expect(quote({ room: desk, kind: 'week', minutes: 0, seats: 1, tier: null }, S)).toEqual({ ok: true, price: 2500, currency: 'SYP' })
    expect(quote({ room: desk, kind: 'month', minutes: 0, seats: 1, tier: null }, S)).toEqual({ ok: true, price: 5000, currency: 'SYP' })
    expect(quote({ room, kind: 'week', minutes: 0, seats: 1, tier: null }, S)).toEqual({ ok: false, error: 'not_subscribable' })
  })
  it('money format', () => {
    expect(fmtMoney(2500)).toBe('2,500 ل.س')
    expect(fmtMoney(10, 'USD')).toBe('10 $')
  })
})

describe('seats', () => {
  const at = (h: number) => `2026-11-10T${String(h).padStart(2, '0')}:00:00.000Z`
  it('units and capacity: seats in the open space, the whole room elsewhere', () => {
    expect(unitsOf(desk, 3)).toBe(3); expect(unitsOf(room, 3)).toBe(1)
    expect(capacityUnits(desk)).toBe(8); expect(capacityUnits(room)).toBe(1)
  })
  it('peak counts only what overlaps at the same moment', () => {
    // 2 seats 8–9 and 3 seats 9–10 never overlap: a 8–10 request sees a peak of 3, not 5
    const others = [{ start: at(8), end: at(9), units: 2 }, { start: at(9), end: at(10), units: 3 }]
    expect(peakUnits(at(8), at(10), others)).toBe(3)
    expect(peakUnits(at(8), at(10), others, 5)).toBe(8)            // fits exactly in 8 seats
    expect(peakUnits(at(8), at(10), [...others, { start: at(7), end: at(11), units: 4 }], 1)).toBe(8)
    expect(peakUnits(at(10), at(11), others)).toBe(0)               // touching windows do not overlap
  })
})

describe('subscriptionWindow', () => {
  const s = { timezone: 'Asia/Damascus', open: '09:00', close: '23:00' }
  it('week: first day 09:00 to the 7th day 23:00 (local)', () => {
    const w = subscriptionWindow('2026-11-10', 'week', s)
    expect(w.start).toBe('2026-11-10T06:00:00.000Z')
    expect(w.end).toBe('2026-11-16T20:00:00.000Z')
  })
  it('month: 30 days', () => {
    expect(subscriptionWindow('2026-11-10', 'month', s).end).toBe('2026-12-09T20:00:00.000Z')
  })
})

import { convertOldPounds } from '../src/routes/sync'
import { formatWhen } from '../src/tz'
describe('offline ops recorded before the move to new pounds', () => {
  const cutoff = '2026-11-06T12:00:00.000Z'
  it('drops a queued walk-in price (re-priced) and divides edit / room prices by 100', () => {
    const mb = convertOldPounds({ client_id: 'a', at: '2026-11-06T11:00:00.000Z', op: 'manual_booking', data: { room_id: 1, start: 's', end: 'e', phone: 'p', name: 'n', method: 'cash', price: 30000 } }, cutoff)
    expect('price' in (mb as { data: object }).data).toBe(false)
    const eb = convertOldPounds({ client_id: 'b', at: '2026-11-06T11:00:00.000Z', op: 'edit_booking', booking_id: 3, data: { price: 45000 } }, cutoff)
    expect((eb as { data: { price: number } }).data.price).toBe(450)
    const ru = convertOldPounds({ client_id: 'c', at: '2026-11-06T11:00:00.000Z', op: 'room_upsert', room: { id: 1, price_hour: 15000, price_day: null } }, cutoff)
    expect((ru as { room: { price_hour: number; price_day: null } }).room).toEqual({ id: 1, price_hour: 150, price_day: null })
  })
  it('leaves newer ops and fresh databases alone', () => {
    const op = { client_id: 'd', at: '2026-11-06T13:00:00.000Z', op: 'edit_booking' as const, booking_id: 3, data: { price: 450 } }
    expect(convertOldPounds(op, cutoff)).toBe(op)
    expect(convertOldPounds({ ...op, at: '2026-11-01T00:00:00.000Z' }, null)).toEqual({ ...op, at: '2026-11-01T00:00:00.000Z' })
  })
})
describe('formatWhen for a subscription', () => {
  it('prints the days', () => {
    expect(formatWhen('2026-11-10T06:00:00.000Z', '2026-11-16T20:00:00.000Z', 'Asia/Damascus')).toBe('من 10/11 إلى 16/11 · 09:00–23:00 يومياً')
  })
})
