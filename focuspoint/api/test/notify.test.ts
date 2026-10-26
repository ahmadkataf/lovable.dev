// Notification texts now come from the admin-editable templates (content.messages). With the default content they must
// be IDENTICAL to the hard-coded texts used before the site editor: `legacy` below is that code, copied verbatim.
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTENT } from '../../shared/content'
import type { Booking } from '../../shared/types'
import { defaultMessageCtx, messageCtx, texts, type MessageCtx } from '../src/notify'
import { formatWhen } from '../src/tz'

// ---- the texts before the site editor (api/src/notify.ts at a2f5158), unchanged ----
type B = Pick<Booking, 'id' | 'code' | 'customer_name' | 'customer_phone' | 'room_name' | 'start' | 'end' | 'price' | 'method' | 'payment_ref' | 'reject_reason' | 'device_id'>
const PAY_ON_ARRIVAL = 'دفع عند الوصول'
const syp = (n: number) => `${n.toLocaleString('en-US')} ل.س`
const room = (b: B) => b.room_name ?? 'الغرفة'
const legacy = {
  booking_created: (b: B, tz: string) => ({
    kind: 'booking_created', booking_id: b.id, title: 'حجز جديد',
    body: `${b.customer_name} · ${room(b)} · ${formatWhen(b.start, b.end, tz)} · ${syp(b.price)} · الرمز ${b.code}`,
  }),
  payment_submitted: (b: B, tz: string) => ({
    kind: 'payment_submitted', booking_id: b.id, title: 'دفعة بانتظار التحقق',
    body: `${b.customer_name} · ${syp(b.price)} · ${b.method === 'cash' ? PAY_ON_ARRIVAL : `رقم العملية ${b.payment_ref ?? ''}`} · ${room(b)} ${formatWhen(b.start, b.end, tz)}`,
  }),
  booking_confirmed: (b: B, tz: string) => ({
    kind: 'booking_confirmed', booking_id: b.id, title: 'تم تأكيد حجزك',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)} · الرمز ${b.code}. نراك في فوكس بوينت!`,
  }),
  booking_rejected: (b: B, tz: string) => ({
    kind: 'booking_rejected', booking_id: b.id, title: 'لم يتم تأكيد الدفع',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)}${b.reject_reason ? ` · السبب: ${b.reject_reason}` : ''}. تواصل معنا إن كان هناك خطأ.`,
  }),
  booking_expired: (b: B, tz: string) => ({
    kind: 'booking_expired', booking_id: b.id, title: 'انتهت مهلة الحجز',
    body: `لم يصلنا رقم عملية الدفع لحجز ${room(b)} · ${formatWhen(b.start, b.end, tz)}. يمكنك الحجز من جديد.`,
  }),
  booking_cancelled: (b: B, tz: string, phone = '') => ({
    kind: 'booking_cancelled', booking_id: b.id, title: 'تم إلغاء حجزك',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)}. تواصل معنا${phone ? ` على ${phone}` : ''} لأي استفسار.`,
  }),
  booking_reminder: (b: B, tz: string) => ({
    kind: 'booking_reminder', booking_id: b.id, title: 'حجزك بعد ساعة',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)} · الرمز ${b.code}. ننتظرك!`,
  }),
}

const TZ = 'Asia/Damascus'
const base: B = {
  id: 42, code: 'A7K2QZ', customer_name: 'أحمد', customer_phone: '0944123456', room_name: 'قاعة الاجتماعات',
  start: '2026-10-30T07:00:00.000Z', end: '2026-10-30T09:30:00.000Z', price: 100000, method: 'shamcash',
  payment_ref: '123456789', reject_reason: 'لم يصل المبلغ', device_id: null,
}
// Every branch the old code had: cash / shamcash, a missing reference, no reason, no room name, small and large prices.
const bookings: B[] = [
  base,
  { ...base, method: 'cash', payment_ref: null },
  { ...base, payment_ref: null },
  { ...base, reject_reason: null },
  { ...base, reject_reason: '' },
  { ...base, room_name: undefined, price: 0, code: 'ZZZ222' },
  { ...base, price: 1234567, customer_name: 'Sara {code} $1 $&' },   // template-like text in data stays as typed
  { ...base, method: 'free', start: '2026-12-31T19:00:00.000Z', end: '2026-12-31T20:00:00.000Z' },
]
const ctx = defaultMessageCtx(TZ, '0985258963', 'فوكس بوينت')

describe('notification texts with the default content are identical to the old hard-coded texts', () => {
  const kinds = ['booking_created', 'payment_submitted', 'booking_confirmed', 'booking_rejected', 'booking_expired', 'booking_reminder'] as const
  for (const kind of kinds) {
    it(kind, () => {
      for (const b of bookings) expect(texts[kind](b, ctx), JSON.stringify(b)).toEqual(legacy[kind](b, TZ))
    })
  }
  it('booking_cancelled (with the centre phone, and without one)', () => {
    for (const b of bookings) {
      expect(texts.booking_cancelled(b, ctx)).toEqual(legacy.booking_cancelled(b, TZ, '0985258963'))
      expect(texts.booking_cancelled(b, defaultMessageCtx(TZ, ''))).toEqual(legacy.booking_cancelled(b, TZ, ''))
    }
  })
})

describe('notification texts follow the edited templates', () => {
  const edited: MessageCtx = {
    ...ctx,
    messages: {
      ...DEFAULT_CONTENT.messages,
      booking_confirmed: { title: 'أهلاً {customer_name}', body: '{name}: {room} {when} — {price} ({code}) {unknown}' },
      payment_submitted: { title: 'تحقق', body: 'ref={ref}', body_cash: 'cash {customer_name}' },
    },
  }
  it('fills every placeholder and keeps unknown ones as typed', () => {
    const m = texts.booking_confirmed(base, edited)
    expect(m.title).toBe('أهلاً أحمد')
    expect(m.body).toBe(`فوكس بوينت: قاعة الاجتماعات ${formatWhen(base.start, base.end, TZ)} — 100,000 ل.س (A7K2QZ) {unknown}`)
    expect(m).toMatchObject({ kind: 'booking_confirmed', booking_id: 42 })
  })
  it('pay on arrival uses body_cash', () => {
    expect(texts.payment_submitted(base, edited).body).toBe('ref=123456789')
    expect(texts.payment_submitted({ ...base, method: 'cash' }, edited).body).toBe('cash أحمد')
  })
})

describe('messageCtx', () => {
  const settings = { timezone: TZ, phone: '0985258963', centre_name: 'فوكس بوينت' }
  it('falls back to the default templates when the content cannot be read', async () => {
    const broken = { prepare: () => { throw new Error('D1 down') } } as unknown as D1Database
    const mc = await messageCtx(broken, settings)
    expect(mc).toEqual({ tz: TZ, phone: '0985258963', name: 'فوكس بوينت', messages: DEFAULT_CONTENT.messages })
  })
  it('uses the saved templates (merged over the defaults)', async () => {
    const saved = { messages: { ...DEFAULT_CONTENT.messages, booking_reminder: { title: 'قرّب موعدك', body: '{room}' } } }
    const db = {
      prepare: () => ({ first: async () => ({ data: JSON.stringify(saved), updated_at: '2026-10-26T08:00:00.000Z' }) }),
    } as unknown as D1Database
    const { dropContentCache } = await import('../src/content')
    dropContentCache()
    const mc = await messageCtx(db, settings)
    dropContentCache()
    expect(mc.messages.booking_reminder).toEqual({ title: 'قرّب موعدك', body: '{room}' })
    expect(mc.messages.booking_created).toEqual(DEFAULT_CONTENT.messages.booking_created)
  })
})
