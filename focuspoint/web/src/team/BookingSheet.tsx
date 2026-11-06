// One booking: details, contact links, and every team action (confirm / reject / cancel / edit) — all through the store.
import { useEffect, useMemo, useState } from 'react'
import type { Booking, HallTier } from '@shared/types'
import { addMinutes, durationLabel, fmtDate, fmtRange, fromLocal, statusLabel, toLocalParts } from '../format'
import { fmtMoney, isHall, isSeats } from '@shared/pricing'
import { KIND_LABEL, TIER_LABEL } from '../lib/booking'
import { Badge, Button, Field, Icon, Input, Segmented, Select, Sheet, Stepper, Textarea, useToast } from '../ui'
import { Confirm } from './common'
import { api } from '../api'
import { useTeam } from '../team'
import { store, useRooms, useSettings } from './store'
import { describeError, durationOptions, findConflict, isTemp, METHOD, minutesBetween, parseInt10, priceFor, startOptions, telHref, whatsappHref } from './util'

export function BookingSheet({ booking, onClose, initialMode }: { booking: Booking | null; onClose: () => void; initialMode?: 'view' | 'reject' }) {
  const [mode, setMode] = useState<'view' | 'reject' | 'edit'>(initialMode ?? 'view')
  const [confirmCancel, setConfirmCancel] = useState(false)
  useEffect(() => { setMode(initialMode ?? 'view'); setConfirmCancel(false) }, [booking?.id, initialMode])
  const toast = useToast()
  const { isAdmin } = useTeam()
  const b = booking

  async function run(label: string, fn: () => Promise<void>) {
    try { await fn(); toast.show(label, 'ok'); onClose() } catch (err) { toast.show(describeError(err), 'error') }
  }

  const [paying, setPaying] = useState(false)
  async function markPaid() {
    if (!b) return
    setPaying(true)
    try { await api.post(`/v1/team/bookings/${b.id}/paid`, { paid: true }); toast.show('تم تسجيل الدفع', 'ok'); void store.refetch(); onClose() }
    catch (e) { toast.show(describeError(e), 'error') } finally { setPaying(false) }
  }

  async function undoPaid() {
    if (!b) return
    try { await api.post(`/v1/team/bookings/${b.id}/paid`, { paid: false }); toast.show('رجع «على الحساب»', 'ok'); void store.refetch(); onClose() }
    catch (e) { toast.show(describeError(e), 'error') }
  }

  if (!b) return null
  const st = statusLabel(b.status, b.method)
  const canConfirm = b.status === 'awaiting_verification' || b.status === 'pending_payment'
  const canReject = canConfirm
  // Booked «على الحساب» (confirmed, not paid yet): record the payment when it comes (online; it feeds the accounts).
  const unpaid = (b.status === 'confirmed' || b.status === 'completed') && !b.paid_at && b.price > 0 && b.method !== 'free' && !isTemp(b.id)
  const paidConfirmed = (b.status === 'confirmed' || b.status === 'completed') && !!b.paid_at && b.price > 0 && b.method !== 'free'
  // A finished booking that was never paid = the customer didn't come: cancelling clears it from «إلي» without fake income.
  const noShow = unpaid && b.status === 'completed'
  const canCancel = canConfirm || b.status === 'confirmed' || noShow

  const canEdit = canConfirm || b.status === 'confirmed'
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
            {b.kind && b.kind !== 'hourly' ? (
              <div className="span2"><dt>{KIND_LABEL[b.kind]}</dt><dd>من {fmtDate(b.start)} إلى {fmtDate(b.end)} · كل يوم طول الدوام</dd></div>
            ) : (
              <>
                <div><dt>الوقت</dt><dd><span className="time">{fmtRange(b.start, b.end)}</span></dd></div>
                <div><dt>المدة</dt><dd>{durationLabel(minutesBetween(b.start, b.end))}</dd></div>
              </>
            )}
            <div><dt>المبلغ</dt><dd>{fmtMoney(b.price, b.currency ?? 'SYP')} <span className="muted tiny">· {METHOD[b.method]}</span></dd></div>
            {b.tier && <div><dt>الجهة</dt><dd>{TIER_LABEL[b.tier]}</dd></div>}
            
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
          {paidConfirmed && isAdmin && !isTemp(b.id) && (
            <p className="muted tiny mt-sm">مدفوع {b.paid_at ? fmtDate(b.paid_at) : ''} · <button type="button" className="link" onClick={() => void undoPaid()}>تسجيل الدفع غلط؟ رجّعه «على الحساب»</button></p>
          )}
          {unpaid && (
            <div className="alert alert-info mt-sm row between gap wrap">
              <span><b>لسا ما اندفع</b> — {fmtMoney(b.price, b.currency ?? 'SYP')} على الحساب</span>
              <span className="row gap">
                {noShow && <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>ما إجا / إلغاء</Button>}
                <Button size="sm" loading={paying} onClick={markPaid}>وصل المبلغ</Button>
              </span>
            </div>
          )}
          {(canConfirm || canReject || canEdit || (canCancel && !noShow)) && (
            <div className="action-grid">
              {canConfirm && (
                <Button className="span2" size="lg" onClick={() => run(b.status === 'awaiting_verification' ? 'تم تأكيد الدفع' : 'تم تأكيد الحجز', () => store.confirm(b))}>
                  <Icon name="check" size={18} /> {b.method === 'cash' ? 'تأكيد الحجز (الدفع عند الوصول)' : b.status === 'awaiting_verification' ? 'تأكيد الدفع' : 'تأكيد الحجز (دُفع)'}
                </Button>
              )}
              {canEdit && <Button variant="soft" onClick={() => setMode('edit')}><Icon name="edit" size={18} /> تعديل</Button>}
              {canReject && <Button variant="danger" onClick={() => setMode('reject')}><Icon name="x" size={18} /> رفض</Button>}
              {canCancel && !canReject && !noShow && <Button variant="danger" onClick={() => setConfirmCancel(true)}><Icon name="trash" size={18} /> إلغاء الحجز</Button>}
              {canCancel && canReject && <Button variant="ghost" className="span2" onClick={() => setConfirmCancel(true)}>إلغاء الحجز</Button>}
            </div>
          )}
          <Confirm
            open={confirmCancel} title={noShow ? 'الزبون ما إجا؟' : 'إلغاء الحجز؟'} danger confirmLabel={paidConfirmed ? 'إلغاء — المبلغ بيضل عنّا' : 'نعم، إلغاء'}
            body={noShow ? <>بيتلغى حجز <b>{b.customer_name}</b> ({fmtDate(b.start)}) وبينشال المبلغ من «إلي» بالحسابات. ما بيوصل الزبون إشعار.</>
              : <>سيُلغى حجز <b>{b.customer_name}</b> في {b.room_name} ({fmtRange(b.start, b.end)}) ويُعلَم الزبون.
              {paidConfirmed && <div className="mt-sm">
                <p className="small">هالحجز مدفوع ({fmtMoney(b.price, b.currency ?? 'SYP')}). إذا رجّعت المبلغ للزبون بينسجّل «استرجاع» بمصاريف اليوم.</p>
                <Button variant="soft" block className="mt-sm" onClick={() => { setConfirmCancel(false); void run('تم الإلغاء وتسجيل الاسترجاع', () => store.cancel(b, true)) }}>إلغاء ورجّعت المبلغ</Button>
              </div>}</>}
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

  const [seats, setSeats] = useState(Math.max(1, booking.seats ?? 1))
  const sub = !!booking.kind && booking.kind !== 'hourly'
  const room = rooms.find((r) => r.id === roomId)
  const desk = !!room && isSeats(room)
  const hall = !!room && isHall(room)
  const [tier, setTier] = useState<HallTier>(booking.tier ?? 'gov')
  const perHead = !!room && (desk || room.type === 'private')
  const starts = settings ? startOptions(settings) : []
  const durations = settings ? durationOptions(settings, time) : []
  const quoted = room ? priceFor(room, minutes, settings ?? undefined, { seats: perHead ? seats : 1, tier: hall ? tier : null, kind: booking.kind }) : null
  const auto = quoted ? quoted.price : booking.price
  const currency = quoted ? quoted.currency : (booking.currency ?? 'SYP')
  // Re-price only when something that sets the price changes; a note-only edit keeps the recorded price.
  const repriced = roomId !== booking.room_id || minutes !== minutesBetween(booking.start, booking.end) || (perHead && seats !== Math.max(1, booking.seats ?? 1))
    || (hall && tier !== (booking.tier ?? 'gov'))
  useEffect(() => { if (!priceTouched && !sub) setPrice(String(repriced ? auto : booking.price)) }, [auto, repriced, priceTouched, sub, booking.price])
  const start = sub ? booking.start : fromLocal(date, time), end = sub ? booking.end : addMinutes(start, minutes)
  const conflict = useMemo(() => findConflict(bookings, roomId, start, end, booking.id, Date.now(), room ? { room, seats: desk ? seats : 1 } : undefined),
    [bookings, booking.id, roomId, start, end, room, desk, seats])

  async function submit() {
    const p = parseInt10(price)
    if (p === null) { setErr('أدخل السعر'); return }
    if (!room) { setErr('اختر القاعة'); return }
    if (conflict) { setErr(desk ? 'المقاعد ممتلئة بهذا الوقت' : `يتداخل مع حجز ${conflict.customer_name} (${fmtRange(conflict.start, conflict.end)})`); return }
    setErr(null)
    try {
      const sendPrice = priceTouched || repriced ? { price: p } : {}
      await store.editBooking(booking, sub ? { ...sendPrice, note: note.trim() || undefined, ...(desk ? { seats: 1 } : {}) }
        : { start, end, room_id: roomId, ...sendPrice, note: note.trim() || undefined, ...(perHead ? { seats } : {}), ...(hall ? { tier } : {}) })
      toast.show('تم تعديل الحجز', 'ok')
      onDone()
    } catch (e) { toast.show(describeError(e), 'error') }
  }

  return (
    <>
      {sub && <div className="alert alert-info">{KIND_LABEL[booking.kind]}: من {fmtDate(booking.start)} إلى {fmtDate(booking.end)}. أيام الاشتراك ما بتتغير — بتقدر تعدّل السعر والملاحظة.</div>}
      {!sub && <Field label="القاعة">
        <Select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>}
      {!sub && hall && (
        <Field label="الجهة">
          <Segmented<HallTier> options={[{ value: 'org', label: 'خاصة / منظمة ($)' }, { value: 'gov', label: 'حكومية (ل.س)' }]} value={tier} onChange={(t) => { setTier(t); setPriceTouched(false) }} />
        </Field>
      )}
      {!sub && perHead && (
        <div className="field">
          <span className="field-label">{desk ? 'عدد المقاعد' : 'عدد الأشخاص'}</span>
          <Stepper value={seats} onChange={(n) => { setSeats(n); setPriceTouched(false) }} min={1} max={Math.max(1, room!.capacity)} />
        </div>
      )}
      {!sub && <div className="two">
        <Field label="التاريخ"><Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="البداية">
          <Select value={time} onChange={(e) => setTime(e.target.value)}>
            {!starts.includes(time) && <option value={time}>{time}</option>}
            {starts.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>}
      <div className="two">
        {!sub && <Field label="المدة">
          <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {!durations.includes(minutes) && <option value={minutes}>{durationLabel(minutes)}</option>}
            {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
          </Select>
        </Field>}
        <Field label={currency === 'USD' ? 'السعر (دولار)' : 'السعر (ل.س)'} hint={priceTouched && p(price) !== auto ? `المحسوب: ${fmtMoney(auto, currency)}` : undefined}>
          <Input dir="ltr" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value); setPriceTouched(true) }} />
        </Field>
      </div>
      <Field label="ملاحظة" error={err ?? undefined}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {conflict && !err && <div className="alert alert-error mt-sm">{desk ? 'المقاعد ممتلئة بهذا الوقت' : <>يتداخل مع حجز {conflict.customer_name} ({fmtRange(conflict.start, conflict.end)})</>}</div>}
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onCancel}>رجوع</Button>
        <Button onClick={submit}>حفظ التعديل</Button>
      </div>
    </>
  )
}
const p = (s: string) => parseInt10(s) ?? -1
