// "+ حجز": a walk-in booking made by the team (cash or free) — confirmed immediately, works offline.
import { useEffect, useMemo, useState } from 'react'
import type { PaymentMethod } from '@shared/types'
import { addMinutes, durationLabel, fmtRange, fmtSYP, fromLocal, normalisePhone, todayLocal, toLocalParts } from '../format'
import { Button, Empty, Field, Input, Segmented, Select, Sheet, Textarea, useToast } from '../ui'
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
  const [minutes, setMinutes] = useState(settings ? Math.max(settings.min_minutes, Math.min(120, settings.max_minutes)) : 60)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const room = rooms.find((r) => r.id === roomId)
  const starts = settings ? startOptions(settings) : []
  const durations = settings ? durationOptions(settings, time) : []
  useEffect(() => { if (durations.length && !durations.includes(minutes)) setMinutes(durations[durations.length - 1]) }, [durations, minutes])
  const auto = room ? (method === 'free' ? 0 : priceFor(room, minutes)) : 0
  useEffect(() => { if (!priceTouched) setPrice(String(auto)) }, [auto, priceTouched])

  const start = fromLocal(date, time), end = addMinutes(start, minutes)
  // Same rule as the server: confirmed, awaiting verification, or a hold that has not run out block the slot.
  const conflict = useMemo(() => findConflict(view.bookings, roomId, start, end), [view.bookings, roomId, start, end])

  if (!settings || rooms.length === 0) return <Empty title="لا توجد قاعات بعد" hint="أضف قاعة من قسم القاعات أولاً." />

  async function submit() {
    const e: Record<string, string> = {}
    const p = normalisePhone(phone)
    if (name.trim().length < 2) e.name = 'اكتب اسم الزبون'
    if (!p) e.phone = 'رقم الهاتف غير صحيح (09XXXXXXXX)'
    const pr = parseInt10(price)
    if (pr === null) e.price = 'أدخل السعر'
    if (!room) e.room = 'اختر القاعة'
    if (conflict) e.time = `يتداخل مع حجز ${conflict.customer_name} (${fmtRange(conflict.start, conflict.end)})`
    if (Date.parse(end) <= Date.now()) e.time = 'هذا الوقت انتهى'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      await store.manualBooking({ room_id: roomId, start, end, name: name.trim(), phone: p!, method, price: pr!, note: note.trim() || undefined })
      toast.show(`تم حجز ${room!.name} لـ${name.trim()}`, 'ok')
      onClose()
    } catch (err) { toast.show(describeError(err), 'error') } finally { setBusy(false) }
  }

  return (
    <>
      <Field label="القاعة" error={errors.room}>
        <Select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} — {fmtSYP(r.price_hour)}/ساعة</option>)}
        </Select>
      </Field>
      <div className="two">
        <Field label="التاريخ"><Input type="date" dir="ltr" value={date} min={todayLocal()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="البداية">
          <Select value={time} onChange={(e) => setTime(e.target.value)}>
            {!starts.includes(time) && <option value={time}>{time}</option>}
            {starts.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="المدة" error={errors.time}>
        <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
        </Select>
      </Field>
      {conflict && !errors.time && <div className="alert alert-error mt-sm">يتداخل مع حجز {conflict.customer_name} ({fmtRange(conflict.start, conflict.end)})</div>}
      <div className="two">
        <Field label="اسم الزبون" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
        <Field label="رقم الهاتف" error={errors.phone}><Input type="tel" inputMode="tel" dir="ltr" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" /></Field>
      </div>
      <Field label="الدفع">
        <Segmented<PaymentMethod> options={[{ value: 'cash', label: 'نقداً' }, { value: 'free', label: 'مجاني' }]} value={method} onChange={(m) => { setMethod(m); setPriceTouched(false) }} />
      </Field>
      <Field label="السعر (ل.س)" error={errors.price} hint={priceTouched && parseInt10(price) !== auto ? `السعر المحسوب: ${fmtSYP(auto)}` : room ? `${fmtSYP(room.price_hour)}/ساعة${room.price_day ? ` · ${fmtSYP(room.price_day)}/يوم` : ''}` : undefined}>
        <Input dir="ltr" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value); setPriceTouched(true) }} />
      </Field>
      <Field label="ملاحظة (اختياري)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="pricebox mt">
        <span className="muted small">{room?.name} · {fmtRange(start, end)}</span>
        <b>{fmtSYP(parseInt10(price) ?? 0)}</b>
      </div>
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button size="lg" loading={busy} onClick={submit}>تأكيد الحجز</Button>
      </div>
    </>
  )
}
