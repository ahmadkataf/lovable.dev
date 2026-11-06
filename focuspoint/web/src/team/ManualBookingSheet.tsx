// "+ حجز": a walk-in booking made by the team (cash or free) — confirmed immediately, works offline.
import { useEffect, useMemo, useState } from 'react'
import type { BookingKind, HallTier, PaymentMethod } from '@shared/types'
import { fmtMoney, isHall, isSeats, SUB_DAYS } from '@shared/pricing'
import { addDays, addMinutes, durationLabel, fmtDate, fmtRange, fromLocal, normalisePhone, todayLocal, toLocalParts } from '../format'
import { Button, Empty, Field, Input, Segmented, Select, Sheet, Stepper, Textarea, useToast } from '../ui'
import { store, useRooms, useSettings, useStore } from './store'
import { describeError, durationOptions, findConflict, parseInt10, priceFor, startOptions, toHHMM, toMin } from './util'

export interface ManualPreset { room_id?: number; date?: string; time?: string }

export function ManualBookingSheet({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: ManualPreset }) {
  return (
    <Sheet open={open} onClose={onClose} title="حجز جديد">
      {open && <Form onClose={onClose} preset={preset} />}
    </Sheet>
  )
}

/** Next slot from now (or opening time), snapped to the slot grid. */
function nextSlot(open: string, close: string, step: number): string {
  const now = toMin(toLocalParts(new Date().toISOString()).time)
  const t = Math.max(toMin(open), Math.ceil(now / step) * step)
  return t < toMin(close) ? toHHMM(t) : open
}

function Form({ onClose, preset }: { onClose: () => void; preset?: ManualPreset }) {
  const toast = useToast()
  const settings = useSettings()
  const rooms = useRooms()
  const { view } = useStore()
  const step = settings?.slot_minutes ?? 30
  const [roomId, setRoomId] = useState<number>(preset?.room_id ?? rooms[0]?.id ?? 0)
  const [date, setDate] = useState(preset?.date ?? todayLocal())
  const [time, setTime] = useState(preset?.time ?? (settings ? nextSlot(settings.open, settings.close, step) : '09:00'))
  const [minutes, setMinutes] = useState(settings ? Math.max(settings.min_minutes, Math.min(60, settings.max_minutes)) : 60)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [payLater, setPayLater] = useState(false)
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [note, setNote] = useState('')
  const [kind, setKind] = useState<BookingKind>('hourly')
  const [seats, setSeats] = useState(1)
  const [tier, setTier] = useState<HallTier | null>(null)   // no default: an organisation's $ booking must not slip in as government pounds
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const room = rooms.find((r) => r.id === roomId)
  const desk = !!room && isSeats(room), hall = !!room && isHall(room)
  useEffect(() => { if (!desk && kind !== 'hourly') setKind('hourly') }, [desk, kind])
  useEffect(() => { if (room && seats > room.capacity) setSeats(room.capacity) }, [room, seats])
  const perHead = !!room && (desk || room.type === 'private') && kind === 'hourly'
  const useSeats = perHead ? seats : 1
  const starts = settings ? startOptions(settings) : []
  const durations = settings ? durationOptions(settings, time) : []
  useEffect(() => { if (durations.length && !durations.includes(minutes)) setMinutes(durations[durations.length - 1]) }, [durations, minutes])
  const computed = room ? priceFor(room, minutes, settings ?? undefined, { seats: useSeats, tier: hall ? (tier ?? 'gov') : null, kind }) : { price: 0, currency: 'SYP' as const }
  const auto = method === 'free' || (hall && !tier) ? 0 : computed.price
  const currency = computed.currency
  useEffect(() => { if (!priceTouched) setPrice(String(auto)) }, [auto, priceTouched])

  // A subscription: the first day's opening to the last day's closing (the server computes the same from `date`).
  const start = kind === 'hourly' ? fromLocal(date, time) : fromLocal(date, settings?.open ?? '09:00')
  const end = kind === 'hourly' ? addMinutes(start, minutes) : fromLocal(addDays(date, SUB_DAYS[kind] - 1), settings?.close ?? '23:00')
  // Same rule as the server: confirmed, awaiting verification, or a hold that has not run out block the slot (seats in the open space).
  const conflict = useMemo(() => findConflict(view.bookings, roomId, start, end, null, Date.now(), room ? { room, seats: useSeats } : undefined),
    [view.bookings, roomId, start, end, room, useSeats])

  if (!settings || rooms.length === 0) return <Empty title="لا توجد قاعات بعد" hint="أضف قاعة من قسم القاعات أولاً." />

  async function submit() {
    const e: Record<string, string> = {}
    const p = normalisePhone(phone)
    if (name.trim().length < 2) e.name = 'اكتب اسم الزبون'
    if (!p) e.phone = 'رقم الهاتف غير صحيح (09XXXXXXXX)'
    const pr = parseInt10(price)
    if (pr === null) e.price = 'أدخل السعر'
    if (!room) e.room = 'اختر القاعة'
    if (hall && !tier) e.tier = 'اختر الجهة'
    if (conflict) e.time = desk ? 'المقاعد ممتلئة بهذا الوقت' : `يتداخل مع حجز ${conflict.customer_name} (${fmtRange(conflict.start, conflict.end)})`
    if (Date.parse(end) <= Date.now()) e.time = 'هذا الوقت انتهى'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await store.manualBooking({
        room_id: roomId, start, end, name: name.trim(), phone: p!, method, price: pr!, note: note.trim() || undefined, ...(payLater ? { pay_later: true } : {}),
        ...(perHead ? { seats: useSeats } : {}), ...(hall && tier ? { tier } : {}), ...(kind !== 'hourly' ? { kind, date } : {}),
      })
      toast.show(`تم حجز ${room!.name} لـ${name.trim()}`, 'ok')
      onClose()
    } catch (err) { toast.show(describeError(err), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <Field label="القاعة" error={errors.room}>
        <Select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{isHall(r) ? ' — حسب الجهة' : ` — ${fmtMoney(r.price_hour)} للشخص/ساعة`}</option>)}
        </Select>
      </Field>
      {desk && (
        <Field label="النوع">
          <Segmented<BookingKind> options={[{ value: 'hourly', label: 'بالساعة' }, { value: 'week', label: 'أسبوعي' }, { value: 'month', label: 'شهري' }]} value={kind} onChange={(k) => { setKind(k); setPriceTouched(false) }} />
        </Field>
      )}
      {hall && (
        <Field label="الجهة" error={errors.tier} hint={!tier && !errors.tier ? 'اختر الجهة حتى ينحسب السعر' : undefined}>
          <Segmented<HallTier> options={[{ value: 'org', label: 'خاصة / منظمة ($)' }, { value: 'gov', label: 'حكومية (ل.س)' }]} value={tier as HallTier} onChange={(t) => { setTier(t); setPriceTouched(false) }} />
        </Field>
      )}
      {perHead && (
        <div className="field">
          <span className="field-label">{desk ? 'عدد المقاعد' : 'عدد الأشخاص'} ({fmtMoney(room!.price_hour)} للشخص بالساعة)</span>
          <Stepper value={seats} onChange={(n) => { setSeats(n); setPriceTouched(false) }} min={1} max={Math.max(1, room!.capacity)} />
        </div>
      )}
      <div className="two">
        <Field label="التاريخ"><Input type="date" dir="ltr" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)} /></Field>
        {kind === 'hourly' ? (
          <Field label="البداية">
            <Select value={time} onChange={(e) => setTime(e.target.value)}>
              {!starts.includes(time) && <option value={time}>{time}</option>}
              {starts.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        ) : <Field label="ينتهي"><Input readOnly value={fmtDate(end)} /></Field>}
      </div>
      {kind === 'hourly' ? (
        <Field label="المدة" error={errors.time}>
          <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
          </Select>
        </Field>
      ) : errors.time ? <div className="alert alert-error mt-sm">{errors.time}</div> : null}
      {conflict && !errors.time && <div className="alert alert-error mt-sm">{desk ? 'المقاعد ممتلئة بهذا الوقت' : <>يتداخل مع حجز {conflict.customer_name} ({fmtRange(conflict.start, conflict.end)})</>}</div>}
      <div className="two">
        <Field label="اسم الزبون" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
        <Field label="رقم الهاتف" error={errors.phone}><Input type="tel" inputMode="tel" dir="ltr" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" /></Field>
      </div>
      <Field label="الدفع">
        <Segmented<'cash' | 'later' | 'free'> options={[{ value: 'cash', label: 'نقداً' }, { value: 'later', label: 'على الحساب' }, { value: 'free', label: 'مجاني' }]}
          value={payLater ? 'later' : (method as 'cash' | 'free')} onChange={(m) => { setPayLater(m === 'later'); setMethod(m === 'free' ? 'free' : 'cash'); setPriceTouched(false) }} />
        {payLater && <span className="field-hint">الحجز بيتأكد هلق والمبلغ بيضل بقائمة «إلي» بالحسابات لحد ما يوصل.</span>}
      </Field>
      <Field label={currency === 'USD' ? 'السعر (دولار)' : 'السعر (ل.س)'} error={errors.price} hint={priceTouched && parseInt10(price) !== auto ? `السعر المحسوب: ${fmtMoney(auto, currency)}` : undefined}>
        <Input dir="ltr" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value); setPriceTouched(true) }} />
      </Field>
      <Field label="ملاحظة (اختياري)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="pricebox mt">
        <span className="muted small">{room?.name} · {kind === 'hourly' ? fmtRange(start, end) : `${fmtDate(start)} – ${fmtDate(end)}`}</span>
        <b>{fmtMoney(parseInt10(price) ?? 0, currency)}</b>
      </div>
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button size="lg" loading={busy} onClick={submit}>تأكيد الحجز</Button>
      </div>
    </>
  )
}
