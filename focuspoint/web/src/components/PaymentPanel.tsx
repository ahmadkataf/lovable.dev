// pending_payment: everything the customer needs to pay with Sham Cash and tell us the transaction number.
import { useEffect, useState, type FormEvent } from 'react'
import type { Booking, PaymentInfo } from '@shared/types'
import { api, errorMessage } from '../api'
import { fmtSYP, fmtTime } from '../format'
import { Button, Card, Field, Icon, Input, useToast } from '../ui'

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

export function PaymentPanel({ booking, payment, onUpdated }: { booking: Booking; payment: PaymentInfo; onUpdated: (b: Booking) => void }) {
  const toast = useToast()
  const [ref, setRef] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { text, left } = useCountdown(payment.hold_until ?? booking.hold_until)
  const expired = left === 0

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
    } catch (e2) { setErr(errorMessage(e2)) } finally { setBusy(false) }
  }

  return (
    <div className="stack">
      <Card className="card-accent">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 className="h2">ادفع عبر شام كاش</h2>
          {payment.hold_until && (
            <span className={`countdown num ${left < 300 ? 'is-late' : ''}`} title="المهلة المتبقية"><Icon name="clock" size={16} />{text}</span>
          )}
        </div>
        <p className="muted small" style={{ marginBottom: 14 }}>
          {expired ? 'انتهت مهلة الحجز. إذا دفعت فعلاً أدخل رقم العملية وسنتحقق.' : `المكان محفوظ لك حتى ${fmtTime(payment.hold_until ?? booking.hold_until ?? booking.start)}.`}
        </p>
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

      <Card>
        <ol className="steps">
          <li><span>افتح تطبيق شام كاش وحوّل المبلغ إلى الرقم أعلاه.</span></li>
          <li><span>اكتب رمز الحجز <b className="num">{payment.code}</b> في ملاحظة التحويل.</span></li>
          <li><span>أدخل رقم العملية هنا — وبنأكد حجزك خلال دقائق.</span></li>
        </ol>
        {payment.instructions && <p className="muted small mt">{payment.instructions}</p>}
      </Card>

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
