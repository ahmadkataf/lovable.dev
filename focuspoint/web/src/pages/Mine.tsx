// /mine — bookings made on this device, and a way to adopt one made elsewhere (code + phone).
// Texts: content.booking.mine_empty_* and notify_prompt_mine. Works whatever the booking settings say now.
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Booking } from '@shared/types'
import { api, errorMessage } from '../api'
import { useCached, dropMemo } from '../lib/data'
import { fmtDate, fmtRange, normalisePhone, statusLabel } from '../format'
import { Badge, Button, Card, Empty, Field, Input, Spinner, Tabs } from '../ui'
import { isUpcoming } from '../lib/booking'
import { NotifyPrompt } from '../components/NotifyPrompt'
import { ContentEmpty, useBookingCopy } from '../components/ContentText'
import { Link } from 'react-router-dom'

export function Mine() {
  const navigate = useNavigate()
  const q = useCached<Booking[]>('/v1/bookings/mine')
  const copy = useBookingCopy()
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const list = useMemo(() => {
    const all = (q.data || []).slice().sort((a, b) => (a.start < b.start ? 1 : -1))
    const up = all.filter(isUpcoming).sort((a, b) => (a.start > b.start ? 1 : -1))
    const hist = all.filter((b) => !isUpcoming(b))
    return { up, hist }
  }, [q.data])
  const shown = tab === 'upcoming' ? list.up : list.hist

  return (
    <div className="stack">
      <div className="page-head"><h1 className="h1">حجوزاتي</h1></div>
      {q.fromCache && <div className="alert alert-info">تعرض نسخة محفوظة — سنحدّثها عند عودة الاتصال.</div>}
      {(q.data?.length ?? 0) > 0 && <NotifyPrompt where="mine" />}

      <Tabs tabs={[{ id: 'upcoming', label: `القادمة${list.up.length ? ` (${list.up.length})` : ''}` }, { id: 'history', label: 'السابقة' }]} value={tab} onChange={(id) => setTab(id as 'upcoming' | 'history')} />

      {q.loading && !q.data && <div className="center" style={{ padding: 32 }}><Spinner /></div>}
      {!q.loading && !q.data && !!q.error && <div className="alert alert-info">{errorMessage(q.error)} — ستظهر حجوزاتك عند عودة الاتصال.</div>}
      {!q.loading && !q.error && shown.length === 0 && (
        tab === 'upcoming'
          ? <ContentEmpty title={copy.text('mine_empty_title')} hint={copy.text('mine_empty_text')} vars={copy.vars} action={<Link to="/book" className="btn btn-primary">احجز الآن</Link>} />
          : <Empty title="لا حجوزات سابقة" />
      )}
      <div className="stack-sm">
        {shown.map((b) => {
          const st = statusLabel(b.status, b.method)
          return (
            <button key={b.id} type="button" className="booking-row" onClick={() => navigate(`/b/${b.id}`)}>
              <span>
                <span className="b-room">{b.room_name || 'غرفة'}</span>
                <div className="b-when">{fmtDate(b.start)} · {fmtRange(b.start, b.end)}</div>
              </span>
              <Badge tone={st.tone}>{st.text}</Badge>
            </button>
          )
        })}
      </div>

      <Lookup />
    </div>
  )
}

function Lookup() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    const p = normalisePhone(phone)
    if (c.length < 4) { setErr('أدخل رمز الحجز (6 أحرف)'); return }
    if (!p) { setErr('رقم الهاتف غير صحيح'); return }
    setErr(null)
    setBusy(true)
    try {
      const b = await api.get<Booking>(`/v1/bookings/lookup?code=${encodeURIComponent(c)}&phone=${encodeURIComponent(p)}`)
      dropMemo('/v1/bookings/mine')      // the server adopted the booking for this device: "my bookings" now includes it
      navigate(`/b/${b.id}`)
    } catch (e2) { setErr(errorMessage(e2) === 'غير موجود' ? 'ما لقينا حجزاً بهذا الرمز والرقم' : errorMessage(e2)) } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <div className="text-center mt">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>عندك حجز من جهاز ثاني؟</Button>
      </div>
    )
  }
  return (
    <Card>
      <h2 className="h3" style={{ marginBottom: 10 }}>ابحث عن حجزك</h2>
      <form onSubmit={submit} noValidate>
        <Field label="رمز الحجز">
          <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال: A7K2QZ" maxLength={8} autoCapitalize="characters" autoComplete="off" style={{ letterSpacing: '0.15em' }} />
        </Field>
        <Field label="رقم الهاتف المستخدم بالحجز" error={err ?? undefined}>
          <Input dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXX" />
        </Field>
        <div className="row gap mt">
          <Button type="submit" loading={busy}>بحث</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
        </div>
      </form>
    </Card>
  )
}
