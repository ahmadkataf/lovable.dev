// Step 2: who is booking. Name + phone (remembered), people, optional note, one button.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Booking, PublicSettings, Room } from '@shared/types'
import { api, errorMessage } from '../api'
import { useCached } from '../lib/data'
import { cache, useOnline } from '../offline'
import { addMinutes, fromLocal, normalisePhone } from '../format'
import { Button, Card, Field, Icon, Input, Stepper, Textarea, useToast } from '../ui'
import { BookingSummary } from '../components/BookingSummary'
import { getCustomer, setCustomer, setFlag } from '../lib/store'
import { priceFor } from '../lib/booking'

export function Book() {
  const { roomId } = useParams()
  const [q] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  const roomsQ = useCached<Room[]>('/v1/rooms')
  const room = useMemo(() => roomsQ.data?.find((r) => r.id === Number(roomId)) ?? null, [roomsQ.data, roomId])

  const date = q.get('date') || ''
  const time = q.get('start') || ''
  const minutes = Number(q.get('minutes') || 0)
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && minutes > 0
  const start = valid ? fromLocal(date, time) : ''
  const end = valid ? addMinutes(start, minutes) : ''

  const remembered = useMemo(() => getCustomer(), [])
  const [name, setName] = useState(remembered.name)
  const [phone, setPhone] = useState(remembered.phone)
  const [people, setPeople] = useState(1)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!valid) navigate('/', { replace: true }) }, [valid, navigate])
  useEffect(() => { if (room && people > room.capacity) setPeople(room.capacity) }, [room, people])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!room) return
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
        room_id: room.id, start, end, name: cleanName, phone: cleanPhone, people,
        ...(note.trim() ? { note: note.trim().slice(0, 300) } : {}),
      })
      setCustomer({ name: cleanName, phone: cleanPhone })
      setFlag('fp_prompt_push')
      void cache.set(`booking:${b.id}`, { data: b, t: Date.now() })
      navigate(`/b/${b.id}`, { replace: true })
    } catch (err) {
      const msg = errorMessage(err)
      setErrors({ form: msg })
      toast.show(msg, 'error')
    } finally { setBusy(false) }
  }

  if (!valid) return null
  if (roomsQ.loading && !room) return <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
  if (!room) {
    return <Card><p className="text-center muted">ما لقينا هذه الغرفة.</p><div className="center mt"><Link to="/" className="btn btn-soft">رجوع</Link></div></Card>
  }

  return (
    <div className="stack">
      <div className="page-head">
        <Link to="/" className="icon-btn" aria-label="رجوع"><Icon name="back" /></Link>
        <h1 className="h1">تأكيد التفاصيل</h1>
      </div>

      <Card><BookingSummary room={room} start={start} end={end} minutes={minutes} price={priceFor(room, minutes)} /></Card>

      <Card>
        <form onSubmit={submit} noValidate>
          <Field label="الاسم" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="اسمك الكريم" maxLength={60} />
          </Field>
          <Field label="رقم الهاتف" hint="نتواصل معك عليه إذا احتجنا" error={errors.phone}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="09XXXXXXXX" />
          </Field>
          <div className="field">
            <span className="field-label">عدد الأشخاص</span>
            <div className="row between">
              <Stepper value={people} onChange={setPeople} min={1} max={Math.max(1, room.capacity)} />
              <span className="muted small">الحد الأقصى {room.capacity}</span>
            </div>
          </div>
          <Field label="ملاحظة (اختياري)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="أي طلب خاص؟" rows={2} />
          </Field>
          {!online && <div className="alert alert-info mt">الحجز يحتاج اتصالاً بالإنترنت.</div>}
          {errors.form && <div className="alert alert-error mt" role="alert">{errors.form}</div>}
          <Button type="submit" block size="lg" className="mt" loading={busy} disabled={!online}>تأكيد الحجز</Button>
          {settings && <p className="muted tiny text-center mt-sm">بعد التأكيد يُحفَظ المكان لك {settings.hold_minutes} دقيقة لإتمام الدفع عبر شام كاش.</p>}
        </form>
      </Card>
    </div>
  )
}
