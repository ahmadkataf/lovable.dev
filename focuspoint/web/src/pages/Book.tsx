// Step 2: who is booking. Name + phone (remembered), people, optional note, one button.
// The payment choice follows the settings (Sham Cash and/or pay on arrival); with online booking switched off the
// page sends the customer back to /book, which explains (content.booking.closed_*).
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Booking, BookingKind, HallTier, PublicSettings, Room } from '@shared/types'
import { quote, SUB_DAYS } from '@shared/pricing'
import { intlPhone, whatsappLink } from '@shared/content'
type Method = 'shamcash' | 'cash'
import { api, errorCode, errorMessage } from '../api'
import { useCached } from '../lib/data'
import { cache, useOnline } from '../offline'
import { addDays, addMinutes, fromLocal, normalisePhone } from '../format'
import { Button, Card, Field, Icon, Input, Segmented, Stepper, Textarea, useToast } from '../ui'
import { BookingSummary } from '../components/BookingSummary'
import { getCustomer, setCustomer, setFlag } from '../lib/store'
import { bookingOpen, paymentMethods, pricing, roomPhotos, TIER_LABEL } from '../lib/booking'
import { ContentText, hasText, useBookTitle, useBookingCopy } from '../components/ContentText'
import { RoomPhotos } from '../components/RoomPhotos'

/** Server answers that mean the cached settings are out of date: re-read them so the page shows the new options. */
const SETTINGS_CHANGED = new Set(['booking_closed', 'shamcash_disabled', 'cash_not_allowed', 'too_far_ahead', 'subscriptions_closed', 'tier_required'])

export function Book() {
  const { roomId } = useParams()
  const [q] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const settingsQ = useCached<PublicSettings>('/v1/settings')
  const settings = settingsQ.data
  const roomsQ = useCached<Room[]>('/v1/rooms')
  const copy = useBookingCopy()
  useBookTitle()
  const room = useMemo(() => roomsQ.data?.find((r) => r.id === Number(roomId)) ?? null, [roomsQ.data, roomId])

  const date = q.get('date') || ''
  const kindQ = q.get('kind')
  const kind: BookingKind = kindQ === 'week' || kindQ === 'month' ? kindQ : 'hourly'
  const time = q.get('start') || ''
  const minutes = kind === 'hourly' ? Number(q.get('minutes') || 0) : 0
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const valid = validDate && (kind !== 'hourly' || (/^\d{2}:\d{2}$/.test(time) && minutes > 0))
  // A subscription runs from the first day's opening to the last day's closing (the server computes the same).
  const start = !valid ? '' : kind === 'hourly' ? fromLocal(date, time) : settings ? fromLocal(date, settings.open) : ''
  const end = !valid ? '' : kind === 'hourly' ? addMinutes(start, minutes) : settings ? fromLocal(addDays(date, SUB_DAYS[kind] - 1), settings.close) : ''

  const remembered = useMemo(() => getCustomer(), [])
  const [name, setName] = useState(remembered.name)
  const [phone, setPhone] = useState(remembered.phone)
  const [people, setPeople] = useState(1)
  const [tier, setTier] = useState<HallTier | null>(null)
  const [note, setNote] = useState('')
  const [method, setMethod] = useState<Method>('shamcash')
  const methods = paymentMethods(settings)
  const choice = methods.shamcash && methods.cash          // both on: the customer picks (else the only method is used)
  const payCash = methods.cash && (!methods.shamcash || method === 'cash')
  const closed = !!settings && !bookingOpen(settings)
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!valid || closed) navigate('/book', { replace: true }) }, [valid, closed, navigate])
  useEffect(() => { if (room && people > room.capacity) setPeople(room.capacity) }, [room, people])

  const desk = room?.type === 'desk', hall = room?.type === 'meeting' || room?.type === 'hall'
  const seats = desk && kind === 'hourly' ? people : 1
  const priced = room && settings ? quote({ room, kind, minutes, seats, tier: hall ? tier : null }, pricing(settings)) : null
  const price = priced && priced.ok ? priced.price : null
  const currency = priced && priced.ok ? priced.currency : 'SYP'
  const p = pricing(settings)
  const wa = (() => { const n = copy.content.brand.whatsapp || settings?.phone || ''; return intlPhone(n) ? whatsappLink(n) : '' })()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!room) return
    if (hall && !tier) { setErrors({ form: 'اختر نوع الجهة لنحسب السعر' }); return }
    const errs: typeof errors = {}
    const cleanName = name.trim()
    const cleanPhone = normalisePhone(phone)
    if (cleanName.length < 2) errs.name = 'اكتب اسمك'
    if (!cleanPhone) errs.phone = 'رقم سوري مثل 09XXXXXXXX'
    setErrors(errs)
    if (errs.name || errs.phone || !cleanPhone) return
    setBusy(true)
    try {
      const b = await api.post<Booking>('/v1/bookings', {
        room_id: room.id, name: cleanName, phone: cleanPhone, people: desk ? seats : people,
        ...(kind === 'hourly' ? { start, end } : { kind, date }),
        ...(desk ? { seats } : {}),
        ...(hall && tier ? { tier } : {}),
        ...(note.trim() ? { note: note.trim().slice(0, 300) } : {}),
        ...(methods.cash ? { method: payCash ? 'cash' : 'shamcash' } : {}),     // only sent when the centre offers pay on arrival (older servers ignore unknown keys anyway)
      })
      setCustomer({ name: cleanName, phone: cleanPhone })
      setFlag('fp_prompt_push')
      void cache.set(`booking:${b.id}`, { data: b, t: Date.now() })
      navigate(`/b/${b.id}`, { replace: true })
    } catch (err) {
      const msg = errorMessage(err)
      setErrors({ form: msg })
      toast.show(msg, 'error')
      if (SETTINGS_CHANGED.has(errorCode(err) ?? '')) void settingsQ.reload()
    } finally { setBusy(false) }
  }

  if (!valid || closed) return null
  if (roomsQ.loading && !room) return <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
  if (!room) {
    return <Card><p className="text-center muted">ما لقينا هذه الغرفة.</p><div className="center mt"><Link to="/book" className="btn btn-soft">رجوع</Link></div></Card>
  }

  return (
    <div className="stack">
      <div className="page-head">
        <Link to="/book" className="icon-btn" aria-label="رجوع"><Icon name="back" /></Link>
        <h1 className="h1">تأكيد التفاصيل</h1>
      </div>

      <Card>
        <RoomPhotos key={room.id} photos={roomPhotos(room)} />
        {start && end && <BookingSummary room={room} start={start} end={end} minutes={minutes} kind={kind} seats={desk ? seats : undefined}
          price={price} currency={currency} priceHint={hall && !tier ? 'اختر نوع الجهة تحت' : undefined} />}
      </Card>

      <Card>
        <form onSubmit={submit} noValidate>
          <Field label="الاسم" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="اسمك الكريم" maxLength={60} />
          </Field>
          <Field label="رقم الهاتف" hint="نتواصل معك عليه إذا احتجنا" error={errors.phone}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09XXXXXXXX" />
          </Field>
          {hall && (
            <div className="field">
              <span className="field-label">نوع الجهة</span>
              <Segmented<HallTier> options={[{ value: 'org', label: TIER_LABEL.org }, { value: 'gov', label: TIER_LABEL.gov }]} value={tier as HallTier} onChange={setTier} />
              <span className="field-hint">
                {tier === 'org' ? `${p.hall_org_usd_hour} دولار بالساعة` : tier === 'gov' ? `${p.hall_gov_hour.toLocaleString('en-US')} ل.س بالساعة` : 'السعر بيختلف حسب الجهة'}
                {' · '}كورس شخصي؟ {p.course_share_percent}% من قيمة الكورس بالاتفاق{wa && <> — <a className="link" href={wa} target="_blank" rel="noopener noreferrer">راسلنا واتساب</a></>}
              </span>
            </div>
          )}
          {kind === 'hourly' && (
            <div className="field">
              <span className="field-label">{desk ? 'عدد المقاعد (لكل شخص طاولة)' : 'عدد الأشخاص'}</span>
              <div className="row between">
                <Stepper value={people} onChange={setPeople} min={1} max={Math.max(1, room.capacity)} />
                <span className="muted small">{desk ? `${room.price_hour.toLocaleString('en-US')} ل.س للشخص بالساعة` : `الحد الأقصى ${room.capacity}`}</span>
              </div>
            </div>
          )}
          <Field label="ملاحظة (اختياري)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="أي طلب خاص؟" rows={2} />
          </Field>
          {choice && (
            <div className="field">
              <span className="field-label">طريقة الدفع</span>
              <Segmented<Method> options={[{ value: 'shamcash', label: copy.plain('method_shamcash') }, { value: 'cash', label: copy.plain('method_cash') }]} value={method} onChange={setMethod} />
              {hasText(copy.text(payCash ? 'method_hint_cash' : 'method_hint_shamcash')) && (
                <span className="field-hint"><ContentText text={copy.text(payCash ? 'method_hint_cash' : 'method_hint_shamcash')} vars={copy.vars} /></span>
              )}
            </div>
          )}
          {!online && <div className="alert alert-info mt">الحجز يحتاج اتصالاً بالإنترنت.</div>}
          {errors.form && <div className="alert alert-error mt" role="alert">{errors.form}</div>}
          <Button type="submit" block size="lg" className="mt" loading={busy} disabled={!online}>تأكيد الحجز</Button>
          {settings && hasText(copy.text(payCash ? 'note_cash' : 'note_shamcash')) && (
            <p className="muted tiny text-center mt-sm"><ContentText text={copy.text(payCash ? 'note_cash' : 'note_shamcash')} vars={copy.vars} /></p>
          )}
        </form>
      </Card>
    </div>
  )
}
