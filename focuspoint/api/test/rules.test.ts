// Pure rules added with the booking/offline review fixes: offline replay clock (A), atomic confirm/edit outcome (F),
// payment-reference reuse (G), stale verifications + the new transition (I), and the hold grace window (D).
import { describe, expect, it } from 'vitest'
import {
  HOLD_GRACE_MINUTES, NO_CONFLICT_SQL, REF_BLOCKING_SQL, STALE_VERIFICATION_NOTE, VERIFICATION_GRACE_MINUTES,
  canTransition, effectiveNow, holdExpiryCutoff, holdState, isStaleVerification, refBlocks, staleVerificationCutoff,
  validateSlot, withSystemNote, zeroRowsError,
} from '../src/bookings'
import { assetLinks } from '../src/assetlinks'
import type { BookingStatus } from '../../shared/types'

const S = { timezone: 'Asia/Damascus', open: '09:00', close: '23:00', slot_minutes: 30 as const, min_minutes: 60, max_minutes: 720 }
const local = (h: string) => `2026-10-24T${h}:00.000Z`      // UTC string; Damascus = +3h

describe('A · offline replay is judged at the time the device recorded the op', () => {
  const server = new Date('2026-10-24T17:00:00.000Z')        // 20:00 local: sync happens in the evening
  it('uses op.at when it is earlier than the server clock, and clamps a clock running ahead', () => {
    expect(effectiveNow('2026-10-24T11:00:00.000Z', server).toISOString()).toBe('2026-10-24T11:00:00.000Z')
    expect(effectiveNow('2026-10-24T18:30:00.000Z', server)).toBe(server)
  })
  it('falls back to the server clock for a missing or garbage op.at', () => {
    expect(effectiveNow(undefined, server)).toBe(server)
    expect(effectiveNow('yesterday', server)).toBe(server)
    expect(effectiveNow(42, server)).toBe(server)
  })
  it('a walk-in 14:00–16:00 recorded at 14:05 and synced at 20:00 is accepted; judged at 20:00 it would be in the past', () => {
    const slot = [local('11:00'), local('13:00')] as const
    expect(validateSlot(slot[0], slot[1], S, { now: server, allowPast: true })).toEqual({ ok: false, error: 'in_past' })
    const at = effectiveNow('2026-10-24T11:05:00.000Z', server)
    expect(validateSlot(slot[0], slot[1], S, { now: at, allowPast: true })).toEqual({ ok: true, minutes: 120 })
  })
})

describe('F · atomic confirm/edit', () => {
  it('the conditional UPDATE excludes overlapping live bookings with the same rule as the read path', () => {
    expect(NO_CONFLICT_SQL).toContain('NOT EXISTS')
    expect(NO_CONFLICT_SQL).toContain(`o.status IN ('awaiting_verification','confirmed')`)
    expect(NO_CONFLICT_SQL).toContain(`o.status = 'pending_payment' AND o.hold_until > ?`)
    expect(NO_CONFLICT_SQL.match(/\?/g)).toHaveLength(5)     // room_id, end, start, excluded id, now
  })
  it('explains a zero-row update: status moved on → illegal_transition, unchanged → slot_taken, gone → not found', () => {
    expect(zeroRowsError({ status: 'awaiting_verification' }, 'awaiting_verification')).toBe('slot_taken')
    expect(zeroRowsError({ status: 'cancelled' }, 'awaiting_verification')).toBe('illegal_transition')
    expect(zeroRowsError(null, 'confirmed')).toBe('booking_not_found')
  })
})

describe('G · payment reference reuse', () => {
  it('a reference on a cancelled/expired/rejected booking is free again; live and done bookings keep theirs', () => {
    for (const s of ['cancelled', 'expired', 'rejected'] as BookingStatus[]) expect(refBlocks(s)).toBe(false)
    for (const s of ['pending_payment', 'awaiting_verification', 'confirmed', 'completed'] as BookingStatus[]) expect(refBlocks(s)).toBe(true)
    expect(REF_BLOCKING_SQL).toBe(`status NOT IN ('rejected','expired','cancelled')`)
  })
})

describe('I · stale verifications', () => {
  const now = new Date('2026-10-24T15:00:00.000Z')
  it('allows awaiting_verification → expired (cron) and nothing else new', () => {
    expect(canTransition('awaiting_verification', 'expired')).toBe(true)
    expect(canTransition('confirmed', 'expired')).toBe(false)
    expect(canTransition('expired', 'awaiting_verification')).toBe(false)
  })
  it('is stale only 30 minutes after the end, and only while awaiting verification', () => {
    expect(VERIFICATION_GRACE_MINUTES).toBe(30)
    expect(staleVerificationCutoff(now)).toBe('2026-10-24T14:30:00.000Z')
    expect(isStaleVerification({ status: 'awaiting_verification', end: '2026-10-24T14:30:00.000Z' }, now)).toBe(true)
    expect(isStaleVerification({ status: 'awaiting_verification', end: '2026-10-24T14:31:00.000Z' }, now)).toBe(false)
    expect(isStaleVerification({ status: 'confirmed', end: '2026-10-24T12:00:00.000Z' }, now)).toBe(false)
  })
  it('appends the Arabic system note after whatever the staff wrote', () => {
    expect(withSystemNote(null, STALE_VERIFICATION_NOTE)).toBe(STALE_VERIFICATION_NOTE)
    expect(withSystemNote('زبون دائم', STALE_VERIFICATION_NOTE)).toBe(`زبون دائم\n${STALE_VERIFICATION_NOTE}`)
  })
})

describe('D · hold grace window', () => {
  const holdUntil = '2026-10-24T12:00:00.000Z'
  it('live before hold_until, grace for 10 minutes after, expired beyond', () => {
    expect(HOLD_GRACE_MINUTES).toBe(10)
    expect(holdState(holdUntil, new Date('2026-10-24T11:59:59.000Z'))).toBe('live')
    expect(holdState(holdUntil, new Date('2026-10-24T12:00:00.000Z'))).toBe('grace')
    expect(holdState(holdUntil, new Date('2026-10-24T12:09:59.000Z'))).toBe('grace')
    expect(holdState(holdUntil, new Date('2026-10-24T12:10:00.000Z'))).toBe('expired')
    expect(holdState(null, new Date())).toBe('none')
  })
  it('the cron expires a hold only once its grace is over', () => {
    expect(holdExpiryCutoff(new Date('2026-10-24T12:10:00.000Z'))).toBe('2026-10-24T12:00:00.000Z')
  })
})

describe('assetlinks.json from ASSETLINKS_FINGERPRINTS', () => {
  const fp = '25:82:9F:6A:05:E3:39:97:36:30:8B:F5:44:53:C9:42:B7:9B:DB:E4:31:FD:8F:90:C7:D5:10:B4:66:24:78:65'
  it('builds one statement with every valid fingerprint, upper-cased', () => {
    const out = assetLinks(` ${fp.toLowerCase()} , junk `) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[]
    expect(out).toHaveLength(1)
    expect(out[0]?.target.package_name).toBe('com.focuspoint.app')
    expect(out[0]?.target.sha256_cert_fingerprints).toEqual([fp])
  })
  it('is an empty list when unset', () => {
    expect(assetLinks(undefined)).toEqual([])
    expect(assetLinks('')).toEqual([])
  })
})
