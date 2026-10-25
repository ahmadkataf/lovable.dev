// /b/:id — the booking's single source of truth for the customer: pay, wait, celebrate, or start over.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Booking, PublicSettings, Room } from '@shared/types'
import { api, ApiError, errorMessage } from '../api'
import { cache, useOnline } from '../offline'
import { useCached, dropMemo } from '../lib/data'
import { fmtDate, fmtRange, statusLabel } from '../format'
import { Badge, Button, Card, Icon, Sheet, Spinner, useToast } from '../ui'
import { BookingSummary } from '../components/BookingSummary'
import { PaymentPanel } from '../components/PaymentPanel'
import { NotifyPrompt } from '../components/NotifyPrompt'
import { downloadIcs } from '../lib/ics'
import { flag } from '../lib/store'
import { onPushMessage } from '../lib/push'
import { setTimeZone } from '../format'
import { isCashAwaiting, isOpen, type BookingFull } from '../lib/booking'

const POLL_MS = 15_000

export function BookingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnline()
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  const roomsQ = useCached<Room[]>('/v1/rooms')
  const [b, setB] = useState<BookingFull | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const key = `booking:${id}`

  const load = useCallback(async () => {
    try {
      const data = await api.get<BookingFull>(`/v1/bookings/${id}`)
      setB(data)
      setFromCache(false)
      setError(null)
      void cache.set(key, { data, t: Date.now() })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) { setNotFound(true); return }
      const hit = await cache.get<{ data: BookingFull }>(key)
      if (hit) { setB(hit.data); setFromCache(true) } else setError(errorMessage(err))
    }
  }, [id, key])

  useEffect(() => { setB(null); setNotFound(false); setError(null); void load() }, [load])

  useEffect(() => { setTimeZone(settings?.timezone) }, [settings?.timezone])

  const live = !!b && isOpen(b)
  useEffect(() => {
    if (!live) return
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [live, load])
  // A push about this booking (confirmed / rejected / expired…) while the page is open: refresh at once.
  useEffect(() => onPushMessage((p) => { if (!p.booking_id || String(p.booking_id) === id) void load() }), [id, load])

  const room = useMemo(() => roomsQ.data?.find((r) => r.id === b?.room_id) ?? null, [roomsQ.data, b])

  function updated(nb: Booking) {
    setB((prev) => ({ ...(prev || ({} as BookingFull)), ...nb, payment: prev?.payment ?? null }))
    dropMemo('/v1/bookings/mine')
    void cache.set(key, { data: { ...(b || {}), ...nb }, t: Date.now() })
  }

  async function cancel() {
    if (!b) return
    setCancelling(true)
    try {
      const nb = await api.post<Booking>(`/v1/bookings/${b.id}/cancel`)
      updated(nb)
      setConfirmCancel(false)
      toast.show('تم إلغاء الحجز', 'ok')
    } catch (err) { toast.show(errorMessage(err), 'error') } finally { setCancelling(false) }
  }

  if (notFound) {
    return (
      <Card>
        <div className="status-hero">
          <span className="status-mark grey"><Icon name="search" size={30} /></span>
          <h1 className="h2">ما لقينا هذا الحجز على جهازك</h1>
          <p className="muted small mt-sm">إذا حجزت من جهاز ثاني، ابحث عنه برمز الحجز ورقم هاتفك.</p>
          <Link to="/mine" className="btn btn-soft mt">حجوزاتي</Link>
        </div>
      </Card>
    )
  }
  if (!b) {
    return error
      ? <Card><div className="alert alert-error">{error}</div><Button variant="soft" className="mt" onClick={load}>حاول مرة ثانية</Button></Card>
      : <div className="center" style={{ padding: 48 }}><Spinner /></div>
  }

  const st = statusLabel(b.status, b.method)
  const cashAwaiting = isCashAwaiting(b)
  const canCancel = isOpen(b)
  const showNotify = !!flag('fp_prompt_push')

  return (
    <div className="stack">
      <div className="page-head">
        <button type="button" className="icon-btn" onClick={() => navigate('/mine')} aria-label="حجوزاتي"><Icon name="back" /></button>
        <h1 className="h1 grow">حجزك</h1>
        <Badge tone={st.tone}>{st.text}</Badge>
      </div>

      {fromCache && <div className="alert alert-info">تعرض نسخة محفوظة — سنحدّثها عند عودة الاتصال.</div>}

      {b.status === 'pending_payment' && b.payment && !cashAwaiting && (
        <PaymentPanel booking={b} payment={b.payment} onUpdated={updated} onExpired={load} />
      )}

      {cashAwaiting && (
        <Card>
          <div className="status-hero">
            <span className="status-mark wait"><Icon name="clock" size={32} /></span>
            <h2 className="h2">استلمنا حجزك</h2>
            <p className="muted small mt-sm">سيؤكد الفريق حجزك قريباً، والدفع عند الوصول. بيصلك إشعار، ويظهر التأكيد هنا تلقائياً.</p>
          </div>
        </Card>
      )}

      {b.status === 'awaiting_verification' && !cashAwaiting && (
        <Card>
          <div className="status-hero">
            <span className="status-mark wait"><Icon name="clock" size={32} /></span>
            <h2 className="h2">وصلنا، عم نتحقق</h2>
            <p className="muted small mt-sm">
              سجّلنا رقم العملية <b className="num">{b.payment_ref}</b>. فريقنا يطابق التحويل الآن، وبنأكد حجزك خلال دقائق —
              بيصلك إشعار، ويظهر هنا تلقائياً.
            </p>
          </div>
        </Card>
      )}

      {b.status === 'confirmed' && (
        <Card className="card-accent">
          <div className="status-hero">
            <span className="status-mark ok"><Icon name="check" size={34} /></span>
            <h2 className="h2">حجزك مؤكد</h2>
            <p className="muted small mt-sm">{fmtDate(b.start)} · {fmtRange(b.start, b.end)}</p>
          </div>
        </Card>
      )}

      {(b.status === 'rejected' || b.status === 'expired' || b.status === 'cancelled') && (
        <Card>
          <div className="status-hero">
            <span className={`status-mark ${b.status === 'rejected' ? 'bad' : 'grey'}`}><Icon name="x" size={32} /></span>
            <h2 className="h2">{b.status === 'rejected' ? 'ما قدرنا نؤكد الحجز' : b.status === 'expired' ? 'انتهت مهلة الدفع' : 'الحجز ملغى'}</h2>
            <p className="muted small mt-sm">
              {b.status === 'rejected' && (b.reject_reason || 'لم نتمكن من مطابقة التحويل. تواصل معنا إذا كنت قد دفعت.')}
              {b.status === 'expired' && 'لم يصلنا رقم العملية ضمن المهلة، فعاد المكان متاحاً للجميع.'}
              {b.status === 'cancelled' && 'تم إلغاء هذا الحجز.'}
            </p>
            <Link to="/book" className="btn btn-primary btn-lg mt">احجز من جديد</Link>
          </div>
        </Card>
      )}

      {b.status === 'completed' && (
        <Card>
          <div className="status-hero">
            <span className="status-mark grey"><Icon name="check" size={32} /></span>
            <h2 className="h2">شكراً لزيارتك</h2>
            <p className="muted small mt-sm">نتمنى أن تكون قد أنجزت ما خططت له.</p>
            <Link to="/book" className="btn btn-soft mt">احجز مرة ثانية</Link>
          </div>
        </Card>
      )}

      {showNotify && (isOpen(b) || b.status === 'confirmed') && <NotifyPrompt />}

      <Card>
        <BookingSummary room={room} roomName={b.room_name} start={b.start} end={b.end} minutes={Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)} people={b.people} price={b.price} code={b.code} />
      </Card>

      {b.status === 'confirmed' && (
        <Card>
          <div className="info-list">
            <div><Icon name="pin" size={18} />{settings?.address || 'درعا، شارع المجمع الحكومي – بناء العايش'}</div>
            <a href={`tel:${settings?.phone || '0985258963'}`}><Icon name="phone" size={18} /><span dir="ltr">{settings?.phone || '0985258963'}</span></a>
          </div>
          <div className="row gap mt wrap">
            <Button variant="soft" onClick={() => downloadIcs(b, settings ?? null)}><Icon name="calendar" size={18} /> أضف إلى التقويم</Button>
          </div>
        </Card>
      )}

      {canCancel && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)} disabled={!online}><Icon name="trash" size={16} /> إلغاء الحجز</Button>
        </div>
      )}

      <Sheet open={confirmCancel} onClose={() => setConfirmCancel(false)} title="إلغاء الحجز؟">
        <p className="muted">سيعود المكان متاحاً للآخرين. {b.status === 'awaiting_verification' && !cashAwaiting && 'إذا كنت قد حوّلت المبلغ، تواصل معنا لاسترجاعه.'}</p>
        <div className="row gap mt">
          <Button variant="danger" block loading={cancelling} onClick={cancel}>نعم، ألغِ الحجز</Button>
          <Button variant="ghost" block onClick={() => setConfirmCancel(false)}>رجوع</Button>
        </div>
      </Sheet>
    </div>
  )
}
