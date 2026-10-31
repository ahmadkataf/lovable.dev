// Booking & payment capabilities (shared/types.ts Settings, DESIGN §3): defaults keep today's behaviour, the admin's
// patch is range-checked, at least one way to pay stays on, the public settings expose them, and the pure rules the
// server enforces (horizon, reminder window) match what the code did before they existed.
import { describe, expect, it } from 'vitest'
import { HttpError } from '../src/http'
import { REMINDER_WINDOW_MINUTES, beyondHorizon, reminderWindow } from '../src/bookings'
import { validatePhotos } from '../src/service'
import { DEFAULT_SETTINGS, publicSettings, validateSettingsPatch } from '../src/settings'

const code = (fn: () => unknown): string | null => {
  try { fn(); return null } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : String(e) }
}
const patch = (body: Record<string, unknown>, current = DEFAULT_SETTINGS) => validateSettingsPatch(body, current)

describe('capability defaults are today\'s behaviour', () => {
  it('booking open, both rules as before', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      booking_enabled: true, booking_closed_message: '', shamcash_enabled: true, booking_horizon_days: 14,
      reminder_minutes: 60, max_open_holds_per_phone: 3, customer_can_cancel: true, allow_pay_on_arrival: false,
    })
  })
  it('the reminder window for 60 minutes is the old fixed 55–65 minutes', () => {
    const now = new Date('2026-10-26T08:00:00.000Z')
    expect(reminderWindow(now, 60)).toEqual({ from: '2026-10-26T08:55:00.000Z', to: '2026-10-26T09:05:00.000Z' })
    expect(REMINDER_WINDOW_MINUTES).toBe(5)
  })
})

describe('validateSettingsPatch: capability fields', () => {
  it('accepts valid values and returns only what was sent', () => {
    expect(patch({ booking_enabled: false, booking_closed_message: '  مسكّرين للصيانة  ' })).toEqual({ booking_enabled: false, booking_closed_message: 'مسكّرين للصيانة' })
    expect(patch({ booking_horizon_days: 1 })).toEqual({ booking_horizon_days: 1 })
    expect(patch({ booking_horizon_days: 365 })).toEqual({ booking_horizon_days: 365 })
    expect(patch({ reminder_minutes: 0 })).toEqual({ reminder_minutes: 0 })
    expect(patch({ reminder_minutes: 15 })).toEqual({ reminder_minutes: 15 })
    expect(patch({ reminder_minutes: 1440 })).toEqual({ reminder_minutes: 1440 })
    expect(patch({ max_open_holds_per_phone: 1 })).toEqual({ max_open_holds_per_phone: 1 })
    expect(patch({ max_open_holds_per_phone: 20 })).toEqual({ max_open_holds_per_phone: 20 })
    expect(patch({ customer_can_cancel: false })).toEqual({ customer_can_cancel: false })
    expect(patch({ booking_closed_message: '' })).toEqual({ booking_closed_message: '' })
  })
  it('rejects wrong types and out-of-range numbers', () => {
    expect(code(() => patch({ booking_enabled: 'no' }))).toBe('400 invalid_booking_enabled')
    expect(code(() => patch({ shamcash_enabled: 1 }))).toBe('400 invalid_shamcash_enabled')
    expect(code(() => patch({ customer_can_cancel: null }))).toBe('400 invalid_customer_can_cancel')
    expect(code(() => patch({ booking_closed_message: 'x'.repeat(501) }))).toBe('400 invalid_closed_message')
    expect(code(() => patch({ booking_closed_message: 5 }))).toBe('400 invalid_closed_message')
    expect(code(() => patch({ booking_horizon_days: 0 }))).toBe('400 invalid_horizon')
    expect(code(() => patch({ booking_horizon_days: 366 }))).toBe('400 invalid_horizon')
    expect(code(() => patch({ booking_horizon_days: 2.5 }))).toBe('400 invalid_horizon')
    expect(code(() => patch({ reminder_minutes: 10 }))).toBe('400 invalid_reminder')     // 1–14: neither off nor a real reminder
    expect(code(() => patch({ reminder_minutes: 1441 }))).toBe('400 invalid_reminder')
    expect(code(() => patch({ reminder_minutes: -5 }))).toBe('400 invalid_reminder')
    expect(code(() => patch({ max_open_holds_per_phone: 0 }))).toBe('400 invalid_max_holds')
    expect(code(() => patch({ max_open_holds_per_phone: 21 }))).toBe('400 invalid_max_holds')
  })
  it('keeps at least one way to pay on (on the merged result)', () => {
    expect(code(() => patch({ shamcash_enabled: false }))).toBe('400 no_payment_method')        // pay-on-arrival is off by default
    expect(patch({ shamcash_enabled: false, allow_pay_on_arrival: true })).toEqual({ shamcash_enabled: false, allow_pay_on_arrival: true })
    const cashOnly = { ...DEFAULT_SETTINGS, shamcash_enabled: false, allow_pay_on_arrival: true }
    expect(code(() => patch({ allow_pay_on_arrival: false }, cashOnly))).toBe('400 no_payment_method')
    expect(patch({ allow_pay_on_arrival: false, shamcash_enabled: true }, cashOnly)).toEqual({ allow_pay_on_arrival: false, shamcash_enabled: true })
  })
  it('older fields still validate as before', () => {
    expect(code(() => patch({ open: '23:00', close: '09:00' }))).toBe('400 invalid_hours')
    expect(patch({ hold_minutes: 45 })).toEqual({ hold_minutes: 45 })
  })
})

describe('publicSettings', () => {
  it('exposes every capability and nothing secret', () => {
    const pub = publicSettings({ ...DEFAULT_SETTINGS, vapid_public_key: 'k' }) as unknown as Record<string, unknown>
    for (const k of ['booking_enabled', 'booking_closed_message', 'shamcash_enabled', 'booking_horizon_days', 'reminder_minutes', 'max_open_holds_per_phone', 'customer_can_cancel']) {
      expect(pub[k], k).toEqual((DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k])
    }
    for (const k of ['shamcash_number', 'shamcash_name', 'shamcash_qr', 'payment_instructions']) expect(pub, k).not.toHaveProperty(k)
  })
})

describe('booking horizon (today + days − 1, centre time)', () => {
  const tz = 'Asia/Damascus'
  const now = new Date('2026-10-26T20:30:00.000Z')            // 23:30 local on the 26th
  it('14 days: up to the 8th of November local, not the 9th', () => {
    expect(beyondHorizon('2026-10-26T21:00:00.000Z', now, tz, 14)).toBe(false)   // 00:00 local on the 27th
    expect(beyondHorizon('2026-11-08T06:00:00.000Z', now, tz, 14)).toBe(false)   // 09:00 on day 14
    expect(beyondHorizon('2026-11-08T20:30:00.000Z', now, tz, 14)).toBe(false)   // 23:30 on day 14
    expect(beyondHorizon('2026-11-09T06:00:00.000Z', now, tz, 14)).toBe(true)    // day 15
  })
  it('1 day: today only (local midnight decides, not UTC)', () => {
    expect(beyondHorizon('2026-10-26T20:00:00.000Z', now, tz, 1)).toBe(false)    // 23:00 local today
    expect(beyondHorizon('2026-10-26T21:00:00.000Z', now, tz, 1)).toBe(true)     // 00:00 local tomorrow, still the 26th in UTC
  })
})

describe('reminder window', () => {
  const now = new Date('2026-10-26T08:00:00.000Z')
  it('off at 0, ±5 minutes around any other value', () => {
    expect(reminderWindow(now, 0)).toBeNull()
    expect(reminderWindow(now, 15)).toEqual({ from: '2026-10-26T08:10:00.000Z', to: '2026-10-26T08:20:00.000Z' })
    expect(reminderWindow(now, 1440)).toEqual({ from: '2026-10-27T07:55:00.000Z', to: '2026-10-27T08:05:00.000Z' })
  })
})

describe('room photos (Photo rules of the content contract, ≤ 8)', () => {
  const p = { src: '/media/0123456789abcdef.webp', alt: '  غرفة 1  ', w: 1600, h: 1200 }
  it('cleans valid photos and keeps the order', () => {
    expect(validatePhotos([p, { ...p, src: '/img/room-a.webp', small: '/img/room-a-720.webp', alt: undefined }])).toEqual([
      { src: '/media/0123456789abcdef.webp', alt: 'غرفة 1', w: 1600, h: 1200 },
      { src: '/img/room-a.webp', alt: '', w: 1600, h: 1200, small: '/img/room-a-720.webp' },
    ])
    expect(validatePhotos([])).toEqual([])
    expect(validatePhotos(null)).toEqual([])
    expect(validatePhotos(Array(8).fill(p))).toHaveLength(8)
  })
  it('refuses foreign or unsafe sources, bad sizes, long alt texts and more than 8', () => {
    const bad = (v: unknown) => code(() => validatePhotos(v))
    expect(bad(Array(9).fill(p))).toBe('400 invalid_photos')
    expect(bad([{ ...p, src: 'https://evil.example/x.png' }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, src: '/media/../secret' }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, src: 'javascript:alert(1)' }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, small: '//evil.example/x.png' }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, w: 0 }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, h: 1.5 }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, alt: 'x'.repeat(201) }])).toBe('400 invalid_photos')
    expect(bad([{ ...p, alt: 5 }])).toBe('400 invalid_photos')
    expect(bad('photo')).toBe('400 invalid_photos')
    expect(bad([null])).toBe('400 invalid_photos')
  })
})
