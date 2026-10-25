import { describe, expect, it } from 'vitest'
import {
  canTransition, findConflicts, generateCode, isBlocking, normaliseCode, overlaps, price, validateSlot, CODE_RE, TRANSITIONS,
} from '../src/bookings'
import type { BookingStatus } from '../../shared/types'

// Damascus is UTC+3 (no DST since 2022). 2026-10-24 is a Saturday.
const S = { timezone: 'Asia/Damascus', open: '09:00', close: '23:00', slot_minutes: 30 as const, min_minutes: 60, max_minutes: 720 }
const now = new Date('2026-10-24T05:00:00.000Z')           // 08:00 local
const local = (h: string) => `2026-10-24T${h}:00.000Z`      // helper: UTC string; local = +3h

describe('validateSlot', () => {
  it('accepts a normal slot inside opening hours', () => {
    // 10:00–12:00 local = 07:00–09:00Z
    expect(validateSlot(local('07:00'), local('09:00'), S, { now })).toEqual({ ok: true, minutes: 120 })
  })
  it('accepts half-hour steps and the closing edge', () => {
    expect(validateSlot(local('18:30'), local('20:00'), S, { now })).toEqual({ ok: true, minutes: 90 })  // 21:30–23:00 local
  })
  it('rejects end before start or garbage', () => {
    expect(validateSlot(local('09:00'), local('07:00'), S, { now })).toEqual({ ok: false, error: 'invalid_time' })
    expect(validateSlot('nope', local('07:00'), S, { now })).toEqual({ ok: false, error: 'invalid_time' })
    expect(validateSlot(local('07:00'), local('07:00'), S, { now })).toEqual({ ok: false, error: 'invalid_time' })
  })
  it('rejects times off the slot grid', () => {
    expect(validateSlot('2026-10-24T07:10:00.000Z', local('09:00'), S, { now })).toEqual({ ok: false, error: 'off_grid' })
    expect(validateSlot(local('07:00'), local('08:15'), { ...S, slot_minutes: 60 }, { now })).toEqual({ ok: false, error: 'off_grid' })
    expect(validateSlot(local('07:30'), local('09:00'), { ...S, slot_minutes: 60 }, { now })).toEqual({ ok: false, error: 'off_grid' })
  })
  it('rejects slots outside opening hours (local time)', () => {
    expect(validateSlot(local('05:00'), local('07:00'), S, { now })).toEqual({ ok: false, error: 'outside_hours' })   // 08:00 local
    expect(validateSlot(local('19:00'), local('20:30'), S, { now })).toEqual({ ok: false, error: 'outside_hours' })   // ends 23:30 local
  })
  it('rejects slots crossing the local midnight', () => {
    const late = { ...S, close: '23:59' }
    expect(validateSlot(local('20:00'), '2026-10-24T21:30:00.000Z', late, { now })).toEqual({ ok: false, error: 'not_same_day' })
  })
  it('enforces min and max duration', () => {
    expect(validateSlot(local('07:00'), local('07:30'), S, { now })).toEqual({ ok: false, error: 'too_short' })
    expect(validateSlot(local('06:00'), local('19:00'), S, { now })).toEqual({ ok: false, error: 'too_long' })   // 13h
    expect(validateSlot(local('06:00'), local('18:00'), S, { now })).toEqual({ ok: true, minutes: 720 })
  })
  it('rejects the past for customers but lets the team book a walk-in that already started', () => {
    const later = new Date('2026-10-24T07:20:00.000Z')   // 10:20 local
    expect(validateSlot(local('07:00'), local('09:00'), S, { now: later })).toEqual({ ok: false, error: 'in_past' })
    expect(validateSlot(local('07:00'), local('09:00'), S, { now: later, allowPast: true })).toEqual({ ok: true, minutes: 120 })
    expect(validateSlot(local('06:00'), local('07:00'), S, { now: later, allowPast: true })).toEqual({ ok: false, error: 'in_past' })
  })
})

describe('price', () => {
  const room = { price_hour: 15000, price_day: 100000 }
  it('charges hours × price_hour, half hours allowed', () => {
    expect(price(60, room)).toBe(15000)
    expect(price(90, room)).toBe(22500)
    expect(price(150, { price_hour: 8000, price_day: null })).toBe(20000)
  })
  it('uses the day price only from 8 hours and only when cheaper', () => {
    expect(price(7 * 60, room)).toBe(105000)        // 7h hourly, no cap
    expect(price(8 * 60, room)).toBe(100000)        // min(100000, 120000)
    expect(price(12 * 60, room)).toBe(100000)
    expect(price(8 * 60, { price_hour: 1000, price_day: 50000 })).toBe(8000)   // hourly cheaper than the day price
    expect(price(8 * 60, { price_hour: 15000, price_day: null })).toBe(120000)
  })
})

describe('overlaps / isBlocking / findConflicts', () => {
  const w = (s: string, e: string) => ({ start: local(s), end: local(e) })
  it('detects intersecting windows, touching edges are fine', () => {
    expect(overlaps(w('07:00', '09:00'), w('08:00', '10:00'))).toBe(true)
    expect(overlaps(w('07:00', '09:00'), w('09:00', '10:00'))).toBe(false)
    expect(overlaps(w('07:00', '09:00'), w('05:00', '07:00'))).toBe(false)
    expect(overlaps(w('07:00', '09:00'), w('07:30', '08:00'))).toBe(true)
  })
  it('blocks on confirmed, awaiting_verification and live holds only', () => {
    expect(isBlocking({ status: 'confirmed', hold_until: null }, now)).toBe(true)
    expect(isBlocking({ status: 'awaiting_verification', hold_until: null }, now)).toBe(true)
    expect(isBlocking({ status: 'pending_payment', hold_until: '2026-10-24T05:30:00.000Z' }, now)).toBe(true)
    expect(isBlocking({ status: 'pending_payment', hold_until: '2026-10-24T04:30:00.000Z' }, now)).toBe(false)
    expect(isBlocking({ status: 'pending_payment', hold_until: null }, now)).toBe(false)
    for (const s of ['expired', 'cancelled', 'rejected', 'completed'] as BookingStatus[]) {
      expect(isBlocking({ status: s, hold_until: null }, now)).toBe(false)
    }
  })
  it('finds conflicts in the same room, ignoring itself and dead bookings', () => {
    const others = [
      { id: 1, room_id: 1, ...w('07:00', '09:00'), status: 'confirmed' as BookingStatus, hold_until: null },
      { id: 2, room_id: 2, ...w('07:00', '09:00'), status: 'confirmed' as BookingStatus, hold_until: null },
      { id: 3, room_id: 1, ...w('08:00', '10:00'), status: 'expired' as BookingStatus, hold_until: null },
      { id: 4, room_id: 1, ...w('09:00', '10:00'), status: 'confirmed' as BookingStatus, hold_until: null },
    ]
    expect(findConflicts({ room_id: 1, ...w('08:00', '09:00') }, others, now).map((b) => b.id)).toEqual([1])
    expect(findConflicts({ id: 1, room_id: 1, ...w('08:00', '09:00') }, others, now)).toEqual([])
    expect(findConflicts({ room_id: 3, ...w('08:00', '09:00') }, others, now)).toEqual([])
  })
})

describe('codes', () => {
  it('generates 6 chars from the safe alphabet, unbiased mapping', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(CODE_RE)
    expect(generateCode(() => new Uint8Array([0, 1, 31, 32, 255, 100]))).toBe('23Z2Z6')
  })
  it('normalises typed codes', () => {
    expect(normaliseCode(' ab-cd ef ')).toBe('ABCDEF')
    expect(normaliseCode('ABC0EF')).toBeNull()      // 0 is not in the alphabet
    expect(normaliseCode('ABCDE')).toBeNull()
    expect(normaliseCode(42)).toBeNull()
  })
})

describe('status transitions', () => {
  it('allows the documented moves', () => {
    expect(canTransition('pending_payment', 'awaiting_verification')).toBe(true)
    expect(canTransition('pending_payment', 'expired')).toBe(true)
    expect(canTransition('awaiting_verification', 'confirmed')).toBe(true)
    expect(canTransition('awaiting_verification', 'rejected')).toBe(true)
    expect(canTransition('confirmed', 'completed')).toBe(true)
    expect(canTransition('confirmed', 'cancelled')).toBe(true)
  })
  it('refuses illegal moves and anything out of a terminal state', () => {
    expect(canTransition('confirmed', 'awaiting_verification')).toBe(false)
    expect(canTransition('awaiting_verification', 'completed')).toBe(false)   // → expired is allowed (cron closes stale verifications)
    expect(canTransition('completed', 'confirmed')).toBe(false)
    for (const t of ['rejected', 'expired', 'cancelled', 'completed'] as BookingStatus[]) expect(TRANSITIONS[t]).toEqual([])
  })
})
