import { describe, expect, it } from 'vitest'
import type { Booking, LedgerEntry } from '../../shared/types'
import { nextMonth, summarise, validateEntry } from '../src/routes/accounts'

const B = (o: Partial<Booking>): Booking => ({
  id: 1, code: 'X', customer_phone: '0911111111', customer_name: 'n', device_id: null, room_id: 6, room_name: 'المساحة المفتوحة',
  start: '2026-11-10T07:00:00.000Z', end: '2026-11-10T09:00:00.000Z', status: 'confirmed', price: 200, method: 'cash', currency: 'SYP',
  kind: 'hourly', seats: 1, tier: null, payment_ref: null, paid_at: '2026-11-10T07:00:00.000Z', verified_by: 1, note: null, reject_reason: null,
  people: 1, created_at: '', updated_at: '', hold_until: null, ...o,
})
const E = (o: Partial<LedgerEntry>): LedgerEntry => ({
  id: 1, kind: 'expense', category: 'rent', amount: 1000, currency: 'SYP', date: '2026-11-03', party: null, note: null, settled_at: null,
  created_by: 1, created_at: '', updated_at: '', ...o,
})
const FROM = '2026-10-31T21:00:00.000Z', TO = '2026-11-30T21:00:00.000Z'

describe('accounts month', () => {
  it('adds paid bookings by currency, other income and expenses, and the net', () => {
    const s = summarise('2026-11',
      [B({ price: 200 }), B({ id: 2, price: 30, currency: 'USD', tier: 'org', room_name: 'القاعة التدريبية', room_id: 5 }), B({ id: 3, price: 2500, kind: 'week' })],
      [E({ amount: 1500 }), E({ id: 2, kind: 'income', amount: 300, category: 'other' }), E({ id: 3, kind: 'expense', amount: 5, currency: 'USD', category: 'internet' }),
        E({ id: 4, kind: 'payable', amount: 400, date: '2026-10-20', settled_at: '2026-11-05T10:00:00.000Z', category: 'electricity' }),
        E({ id: 5, kind: 'receivable', amount: 50, currency: 'USD', date: '2026-10-01', settled_at: '2026-11-07T10:00:00.000Z' })],
      FROM, TO, [], [])
    expect(s.income.bookings).toEqual({ SYP: 2700, USD: 30 })
    expect(s.income.other).toEqual({ SYP: 300, USD: 50 })
    expect(s.expenses).toEqual({ SYP: 1900, USD: 5 })
    expect(s.net).toEqual({ SYP: 1100, USD: 75 })
    expect(s.by_kind.find((k) => k.key === 'subscription')?.amount.SYP).toBe(2500)
    expect(s.by_kind.find((k) => k.key === 'hall_org')?.amount.USD).toBe(30)
    expect(s.by_category.find((c) => c.category === 'electricity')?.amount.SYP).toBe(400)
  })
  it('lists what is owed to me and what I owe', () => {
    const s = summarise('2026-11', [], [], FROM, TO,
      [B({ paid_at: null, price: 20, currency: 'USD', tier: 'org' })],
      [E({ kind: 'receivable', amount: 100 }), E({ id: 2, kind: 'payable', amount: 700 })])
    expect(s.owed_to_me.total).toEqual({ SYP: 100, USD: 20 })
    expect(s.i_owe.total).toEqual({ SYP: 700, USD: 0 })
  })
  it('validates entries and month arithmetic', () => {
    expect(nextMonth('2026-12')).toBe('2027-01')
    expect(validateEntry({ kind: 'expense', amount: 5, date: '2026-11-01' }, 'create')).toMatchObject({ kind: 'expense', category: 'other', currency: 'SYP' })
    expect(() => validateEntry({ kind: 'gift', amount: 5, date: '2026-11-01' }, 'create')).toThrow()
  })
})
