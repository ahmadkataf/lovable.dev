// One booking: details, contact links, and every team action (confirm / reject / cancel / edit) — all through the store.
import { useEffect, useMemo, useState } from 'react'
import type { Booking } from '@shared/types'
import { addMinutes, durationLabel, fmtDate, fmtRange, fmtSYP, fromLocal, statusLabel, toLocalParts } from '../format'
import { Badge, Button, Field, Icon, Input, Select, Sheet, Textarea, useToast } from '../ui'
import { Confirm } from './common'
import { store, useRooms, useSettings } from './store'
import { describeError, durationOptions, findConflict, isTemp, METHOD, minutesBetween, parseInt10, priceFor, startOptions, telHref, whatsappHref } from './util'

export function BookingSheet({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const [mode, setMode] = useState<'view' | 'reject' | 'edit'>('view')
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => { setMode('view'); setConfirmCancel(false) }, [booking?.id])
  const toast = useToast()
  const b = booking

  async function run(label: string, fn: () => Promise<void>) {
    try { await fn(); toast.show(label, 'ok'); onClose() } catch (err) { toast.show(describeError(err), 'error') }
  }

  if (!b) return null
  const st = statusLabel(b.status, b.method)
  const canConfirm = b.status === 'awaiting_verification' || b.status === 'pending_payment'
  const canReject = canConfirm
  const canCancel = canConfirm || b.status === 'confirmed'
  const canEdit = canCancel
  const title = mode === 'edit' ? 'تعديل الحجز' : mode === 'reject' ? 'رفض الحجز' : `حجز ${b.customer_name}`

  return (
    <Sheet open onClose={onClose} title={title}>
      {mode === 'edit' ? (
        <EditForm booking={b} onCancel={() => setMode('view')} onDone={onClose} />
      ) : mode === 'reject' ? (
        <RejectForm booking={b} onCancel={() => setMode('view')} onDone={onClose} />
      ) : (
        <>
          <div className="row between gap">
            <Badge tone={st.tone}>{st.text}</Badge>
            <span className="muted small">{fmtDate(b.start)}</span>
          </div>
          <dl className="detail-grid">
            <div><dt>القاعة</dt><dd>{b.room_name ?? '—'}</dd></div>
            <div><dt>الوقت</dt><dd><span className="num">{fmtRange(b.start, b.end)}</span></dd></div>
            <div><dt>المدة</dt><dd>{durationLabel(minutesBetween(b.start, b.end))}</dd></div>
            <div><dt>المبلغ</dt><dd>{fmtSYP(b.price)} <span className="muted tiny">· {METHOD[b.method]}</span></dd></div>
            <div><dt>رمز الحجز</dt><dd><span className="num" style={{ letterSpacing: '0.12em', color: 'var(--wine)' }}>{b.code}</span></dd></div>
            <div><dt>الهاتف</dt><dd><span className="num">{b.customer_phone}</span></dd></div>
            {b.payment_ref && <div className="span2"><dt>رقم عملية شام كاش</dt><dd><span className="num">{b.payment_ref}</span></dd></div>}
            {b.people ? <div><dt>عدد الأشخاص</dt><dd>{b.people}</dd></div> : null}
            {b.note && <div className="span2"><dt>ملاحظة</dt><dd>{b.note}</dd></div>}
            {b.reject_reason && <div className="span2"><dt>سبب الرفض</dt><dd>{b.reject_reason}</dd></div>}
            {isTemp(b.id) && <div className="span2"><dt>الحالة</dt><dd className="muted small">حُفظ على هذا الجهاز — سيُرسَل إلى السحابة عند الاتصال</dd></div>}
          </dl>
          <div className="contact">
            <Button variant="soft" onClick={() => { location.href = telHref(b.customer_phone) }}><Icon name="phone" size={18} /> اتصال</Button>
            <Button variant="soft" onClick={() => window.open(whatsappHref(b.customer_phone, `مرحباً ${b.customer_name}، بخصوص حجزك ${b.code} في فوكس بوينت`), '_blank', 'noopener')}><Icon name="whatsapp" size={18} /> واتساب</Button>
          </div>
          {(canConfirm || canReject || canEdit || canCancel) && (
            <div className="action-grid">
              {canConfirm && (
                <Button className="span2" size="lg" onClick={() => run(b.status === 'awaiting_verification' ? 'تم تأكيد الدفع' : 'تم تأكيد الحجز', () => store.confirm(b))}>
                  <Icon name="check" size={18} /> {b.method === 'cash' ? 'تأكيد الحجز (الدفع عند الوصول)' : b.status === 'awaiting_verification' ? 'تأكيد الدفع' : 'تأكيد الحجز (دُفع)'}
                </Button>
              )}
              {canEdit && <Button variant="soft" onClick={() => setMode('edit')}><Icon name="edit" size={18} /> تعديل</Button>}
              {canReject && <Button variant="danger" onClick={() => setMode('reject')}><Icon name="x" size={18} /> رفض</Button>}
              {canCancel && !canReject && <Button variant="danger" onClick={() => setConfirmCancel(true)}><Icon name="trash" size={18} /> إلغاء الحجز</Button>}
              {canCancel && canReject && <Button variant="ghost" className="span2" onClick={() => setConfirmCancel(true)}>إلغاء الحجز</Button>}
            </div>
          )}
          <Confirm
            open={confirmCancel} title="إلغاء الحجز؟" danger confirmLabel="نعم، إلغاء"
            body={<>سيُلغى حجز <b>{b.customer_name}</b> في {b.room_name} ({fmtRange(b.start, b.end)}) ويُعلَم الزبون.</>}
            onClose={() => setConfirmCancel(false)}
            onConfirm={() => { setConfirmCancel(false); void run('تم إلغاء الحجز', () => store.cancel(b)) }}
          />
        </>
      )}
    </Sheet>
  )
}

function RejectForm({ booking, onCancel, onDone }: { booking: Booking; onCancel: () => void; onDone: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const quick = ['لم يصل المبلغ', 'المبلغ غير مطابق', 'رقم العملية غير صحيح']
  async function submit() {
    const r = reason.trim()
    if (r.length < 2) { setErr('اكتب سبباً مختصراً — يصل الزبون'); return }
    try { await store.reject(booking, r); toast.show('تم رفض الحجز', 'ok'); onDone() } catch (e) { toast.show(describeError(e), 'error') }
  }
  return (
    <>
      <p className="muted small" style={{ marginBottom: 12 }}>يصل السبب إلى الزبون مع إشعار الرفض.</p>
      <div className="chips" style={{ marginBottom: 10 }}>
        {quick.map((q) => <button key={q} type="button" className={`chip${reason === q ? ' is-active' : ''}`} onClick={() => setReason(q)}>{q}</button>)}
      </div>
      <Field label="السبب" error={err ?? undefined}>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onCancel}>رجوع</Button>
        <Button variant="danger" onClick={submit}>رفض الحجز</Button>
      </div>
    </>
  )
}

function EditForm({ booking, onCancel, onDone }: { booking: Booking; onCancel: () => void; onDone: () => void }) {
  const toast = useToast()
  const settings = useSettings()
  const rooms = useRooms()
  const { bookings } = store.getSnapshot().view
  const parts = toLocalParts(booking.start)
  const [roomId, setRoomId] = useState(booking.room_id)
  const [date, setDate] = useState(parts.date)
  const [time, setTime] = useState(parts.time)
  const [minutes, setMinutes] = useState(minutesBetween(booking.start, booking.end))
  const [price, setPrice] = useState(String(booking.price))
  const [priceTouched, setPriceTouched] = useState(false)
  const [note, setNote] = useState(booking.note ?? '')
  const [err, setErr] = useState<string | null>(null)

  const room = rooms.find((r) => r.id === roomId)
  const starts = settings ? startOptions(settings) : []
  const durations = settings ? durationOptions(settings, time) : []
  const auto = room ? priceFor(room, minutes) : booking.price
  useEffect(() => { if (!priceTouched) setPrice(String(auto)) }, [auto, priceTouched])
  const start = fromLocal(date, time), end = addMinutes(start, minutes)
  const conflict = useMemo(() => findConflict(bookings, roomId, start, end, booking.id), [bookings, booking.id, roomId, start, end])

  async function submit() {
    const p = parseInt10(price)
    if (p === null) { setErr('أدخل السعر'); return }
    if (!room) { setErr('اختر القاعة'); return }
    if (conflict) { setErr(`يتداخل مع حجز ${conflict.customer_name} (${fmtRange(conflict.start, conflict.end)})`); return }
    setErr(null)
    try {
      await store.editBooking(booking, { start, end, room_id: roomId, price: p, note: note.trim() || undefined })
      toast.show('تم تعديل الحجز', 'ok')
      onDone()
    } catch (e) { toast.show(describeError(e), 'error') }
  }

  return (
    <>
      <Field label="القاعة">
        <Select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>
      <div className="two">
        <Field label="التاريخ"><Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="البداية">
          <Select value={time} onChange={(e) => setTime(e.target.value)}>
            {!starts.includes(time) && <option value={time}>{time}</option>}
            {starts.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>
      <div className="two">
        <Field label="المدة">
          <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {!durations.includes(minutes) && <option value={minutes}>{durationLabel(minutes)}</option>}
            {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
          </Select>
        </Field>
        <Field label="السعر (ل.س)" hint={priceTouched && p(price) !== auto ? `المحسوب: ${fmtSYP(auto)}` : undefined}>
          <Input dir="ltr" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value); setPriceTouched(true) }} />
        </Field>
      </div>
      <Field label="ملاحظة" error={err ?? undefined}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {conflict && !err && <div className="alert alert-error mt-sm">يتداخل مع حجز {conflict.customer_name} ({fmtRange(conflict.start, conflict.end)})</div>}
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onCancel}>رجوع</Button>
        <Button onClick={submit}>حفظ التعديل</Button>
      </div>
    </>
  )
}
const p = (s: string) => parseInt10(s) ?? -1
