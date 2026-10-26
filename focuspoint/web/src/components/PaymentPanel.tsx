// pending_payment: everything the customer needs to pay with Sham Cash and tell us the transaction number.
// After hold_until the form disappears (the server would answer 409 hold_expired) and the customer is sent back
// to book again; the page keeps polling, so a cron expiry or a late acceptance shows up by itself.
// Texts: content.booking.pay_* ({code} bold, {time} = the end of the hold). An already-held booking can always be paid,
// even after the admin switched Sham Cash or online booking off.
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Booking, PaymentInfo } from '@shared/types'
import { api, errorCode, errorMessage } from '../api'
import { fmtSYP, fmtTime } from '../format'
import { Button, Card, Field, Icon, Input, useToast } from '../ui'
import { ContentText, hasText, useBookingCopy } from './ContentText'

function useCountdown(until: string | null): { text: string; left: number } {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t) }, [])
  if (!until) return { text: '', left: Infinity }
  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000))
  const m = Math.floor(left / 60), s = left % 60
  return { text: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, left }
}

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export function PaymentPanel({ booking, payment, onUpdated, onExpired }: {
  booking: Booking; payment: PaymentInfo; onUpdated: (b: Booking) => void
  /** The server said the hold is over (409 hold_expired): the page re-reads the booking. */
  onExpired?: () => void
}) {
  const toast = useToast()
  const copy = useBookingCopy()
  const [ref, setRef] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [serverExpired, setServerExpired] = useState(false)
  const holdUntil = payment.hold_until ?? booking.hold_until
  const { text, left } = useCountdown(holdUntil)
  const expired = serverExpired || (holdUntil !== null && left === 0)
  const vars = { ...copy.vars, code: payment.code, time: fmtTime(holdUntil ?? booking.start) }
  const steps = copy.booking.pay_steps.filter((s) => hasText(s.text))

  async function copyValue(v: string, what: string) {
    toast.show((await copy(v)) ? `تم نسخ ${what}` : 'ما قدرنا ننسخ — انسخه يدوياً', 'ok')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = ref.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim()
    if (clean.length < 4) { setErr('أدخل رقم العملية كما يظهر في تطبيق شام كاش'); return }
    setErr(null)
    setBusy(true)
    try {
      const b = await api.post<Booking>(`/v1/bookings/${booking.id}/payment`, { ref: clean })
      onUpdated(b)
      toast.show('وصلنا رقم العملية — عم نتحقق', 'ok')
    } catch (e2) {
      if (errorCode(e2) === 'hold_expired') { setServerExpired(true); onExpired?.() }
      setErr(errorMessage(e2))
    } finally { setBusy(false) }
  }

  if (expired) {
    return (
      <Card>
        <div className="status-hero">
          <span className="status-mark grey"><Icon name="clock" size={32} /></span>
          <h2 className="h2"><ContentText text={copy.text('pay_expired_title')} vars={vars} /></h2>
          {hasText(copy.text('pay_expired_text')) && <p className="muted small mt-sm"><ContentText text={copy.text('pay_expired_text')} vars={vars} /></p>}
          <Link to="/book" className="btn btn-primary btn-lg mt">احجز من جديد</Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="stack">
      <Card className="card-accent">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 className="h2"><ContentText text={copy.text('pay_title')} vars={vars} /></h2>
          {holdUntil && (
            <span className={`countdown num ${left < 300 ? 'is-late' : ''}`} title="المهلة المتبقية"><Icon name="clock" size={16} />{text}</span>
          )}
        </div>
        {hasText(copy.text('pay_held_until')) && (
          <p className="muted small" style={{ marginBottom: 14 }}>
            <ContentText text={copy.text('pay_held_until')} vars={vars} />
          </p>
        )}
        <div className="stack-sm">
          <div className="copy-box">
            <div className="grow">
              <div className="tiny muted">رقم شام كاش {payment.shamcash_name ? `— ${payment.shamcash_name}` : ''}</div>
              <div className="copy-value">{payment.shamcash_number}</div>
            </div>
            <button type="button" className="icon-btn" onClick={() => copyValue(payment.shamcash_number, 'الرقم')} aria-label="نسخ الرقم"><Icon name="copy" /></button>
          </div>
          <div className="copy-box">
            <div className="grow">
              <div className="tiny muted">المبلغ</div>
              <div className="copy-value rtl">{fmtSYP(payment.amount)}</div>
            </div>
            <button type="button" className="icon-btn" onClick={() => copyValue(String(payment.amount), 'المبلغ')} aria-label="نسخ المبلغ"><Icon name="copy" /></button>
          </div>
          <div className="copy-box">
            <div className="grow">
              <div className="tiny muted">اكتب هذا الرمز في ملاحظة التحويل</div>
              <div className="copy-value code">{payment.code}</div>
            </div>
            <button type="button" className="icon-btn" onClick={() => copyValue(payment.code, 'الرمز')} aria-label="نسخ الرمز"><Icon name="copy" /></button>
          </div>
        </div>
        {payment.shamcash_qr && <img src={payment.shamcash_qr} alt="رمز QR لشام كاش" className="qr mt" />}
      </Card>

      {(steps.length > 0 || !!payment.instructions) && (
        <Card>
          {steps.length > 0 && (
            <ol className="steps">
              {steps.map((st, i) => <li key={i}><span><ContentText text={st.text} vars={vars} /></span></li>)}
            </ol>
          )}
          {payment.instructions && <p className={`muted small${steps.length > 0 ? ' mt' : ''}`}>{payment.instructions}</p>}
        </Card>
      )}

      <Card>
        <form onSubmit={submit} noValidate>
          <Field label="رقم العملية" hint="يظهر في تطبيق شام كاش بعد التحويل" error={err ?? undefined}>
            <Input dir="ltr" inputMode="numeric" autoComplete="off" placeholder="مثال: 123456789" value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Button type="submit" block size="lg" className="mt" loading={busy} disabled={!ref.trim()}>أرسلت المبلغ — تأكيد</Button>
        </form>
      </Card>
    </div>
  )
}
