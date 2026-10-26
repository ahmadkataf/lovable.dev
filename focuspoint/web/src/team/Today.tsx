// /team — اليوم: pending payment verifications first, three small counters, then today's timeline per room.
import { useEffect, useMemo, useState } from 'react'
import type { Booking } from '@shared/types'
import { fmtDate, fmtRange, fmtSYP, fmtTime, todayLocal } from '../format'
import { Badge, Button, Card, Empty, Icon, Sheet, Spinner, useToast } from '../ui'
import { BookingSheet } from './BookingSheet'
import { ManualBookingSheet } from './ManualBookingSheet'
import { PageHead, Section, roomColor } from './common'

/** Room dot colour when the owner has not picked one: the public site's space-type coding. */
const TYPE_DOT: Record<string, string> = { private: 'var(--blue)', meeting: 'var(--violet)', hall: 'var(--violet)', desk: 'var(--teal)' }
import { enableTeamPush, ensureTeamPush, pushErrorText, pushState, testPush, type PushState } from './push'
import { store, useFresh, useRooms, useStore } from './store'
import { describeError, isBlocking, isPendingVerification, localDate, sortByStart } from './util'

/** Phone makers whose battery saver is known to kill background push for Chrome. */
const AGGRESSIVE_OEM = /xiaomi|redmi|poco|miui|huawei|honor|oppo|realme|oneplus|vivo/i

export function Today() {
  const { ready, view, sync } = useStore()
  const rooms = useRooms()
  const fresh = useFresh()
  const toast = useToast()
  const [selected, setSelected] = useState<Booking | null>(null)
  const [manual, setManual] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t) }, [])

  const today = todayLocal()
  // Verifications still worth acting on (a booking whose end passed half an hour ago is expired by the server's cron).
  const pending = useMemo(() => view.bookings.filter((b) => isPendingVerification(b, now)).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)), [view.bookings, now])
  const todays = useMemo(() => view.bookings.filter((b) => localDate(b.start) === today).sort(sortByStart), [view.bookings, today])
  const liveToday = useMemo(() => todays.filter((b) => isBlocking(b, now) || b.status === 'completed'), [todays, now])
  const revenue = useMemo(() => todays.filter((b) => b.status === 'confirmed' || b.status === 'completed').reduce((s, b) => s + b.price, 0), [todays])
  // Keep the sheet's booking in sync with the store (status changes after confirm, etc.).
  const current = selected ? view.bookings.find((b) => b.id === selected.id) ?? null : null

  async function quick(b: Booking, action: 'confirm') {
    try { await store[action](b); toast.show(b.method === 'cash' ? 'تم تأكيد الحجز — أُعلم الزبون' : 'تم تأكيد الدفع — أُعلم الزبون', 'ok') } catch (err) { toast.show(describeError(err), 'error') }
  }

  if (!ready) return <div className="center center-pad"><Spinner /></div>

  return (
    <>
      <PageHead title="اليوم" sub={fmtDate(new Date().toISOString())}>
        <Button onClick={() => setManual(true)}><Icon name="plus" size={18} /> حجز</Button>
      </PageHead>

      {pending.length > 0 && (
        <Section title={`بانتظار التأكيد (${pending.length})`}>
          <div className="list">
            {pending.map((b) => {
              const cash = b.method === 'cash'
              return (
                <Card key={b.id} className={`verify${fresh.has(b.id) ? ' is-fresh' : ''}`}>
                  <div className="row between gap">
                    <div className="row gap-sm">
                      <span className="dot" style={{ background: roomColor(view.rooms.find((r) => r.id === b.room_id)?.color) }} />
                      <b>{b.customer_name}</b>
                      {fresh.has(b.id) && <Badge tone="wine"><span className="badge-new">جديد</span></Badge>}
                    </div>
                    <span className="muted small">{fmtTime(b.updated_at)}</span>
                  </div>
                  <dl className="verify-grid">
                    <div><dt>القاعة والوقت</dt><dd>{b.room_name} · {fmtDate(b.start)} · <span className="num">{fmtRange(b.start, b.end)}</span></dd></div>
                    <div><dt>المبلغ</dt><dd>{fmtSYP(b.price)}{cash && <span className="muted tiny"> · عند الوصول</span>}</dd></div>
                    <div><dt>{cash ? 'رمز الحجز' : 'رمز الحجز (في ملاحظة التحويل)'}</dt><dd><span className="code num">{b.code}</span></dd></div>
                    {cash
                      ? <div><dt>طريقة الدفع</dt><dd>الدفع عند الوصول — يؤكد الفريق الحجز</dd></div>
                      : <div><dt>رقم العملية</dt><dd><span className="num">{b.payment_ref ?? '—'}</span></dd></div>}
                  </dl>
                  <div className="verify-actions">
                    <Button onClick={() => quick(b, 'confirm')}><Icon name="check" size={18} /> {cash ? 'تأكيد الحجز' : 'تأكيد الدفع'}</Button>
                    <Button variant="danger" onClick={() => setSelected(b)}>رفض</Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </Section>
      )}

      <div className="stats mt">
        <div className="stat"><b>{liveToday.length}</b><span>حجوزات اليوم</span></div>
        <div className="stat"><b>{pending.length}</b><span>بانتظار التحقق</span></div>
        <div className="stat"><b className="money" style={{ fontSize: '1.05rem' }}>{fmtSYP(revenue)}</b><span>إيراد اليوم</span></div>
      </div>

      <PushCard />

      <Section title="جدول اليوم">
        {rooms.length === 0 ? (
          <Empty title="لا توجد قاعات بعد" hint={sync.online ? 'أضف القاعات من قسم القاعات.' : 'ستظهر القاعات بعد أول اتصال بالإنترنت.'} />
        ) : (
          <Card>
            {rooms.map((room) => {
              const items = liveToday.filter((b) => b.room_id === room.id)
              return (
                <div key={room.id} className="tl-room">
                  <div className="tl-room-name"><span className="dot" style={{ background: room.color ? roomColor(room.color) : TYPE_DOT[room.type] }} /><span>{room.name}</span></div>
                  <div className="tl-items">
                    {items.length === 0 && <div className="tl-free">فارغة اليوم</div>}
                    {items.map((b) => {
                      const isNow = Date.parse(b.start) <= now && now < Date.parse(b.end)
                      const past = Date.parse(b.end) <= now
                      return (
                        <button key={b.id} type="button" className={`tl-item${isNow ? ' is-now' : ''}${past ? ' is-dim' : ''}${fresh.has(b.id) ? ' is-fresh' : ''}`} style={{ borderInlineStartColor: roomColor(room.color) }} onClick={() => setSelected(b)}>
                          <span className="when num">{fmtRange(b.start, b.end)}</span>
                          <span className="who">{b.customer_name}</span>
                          {fresh.has(b.id) && <Badge tone="wine"><span className="badge-new">جديد</span></Badge>}
                          {b.status !== 'confirmed' && <Badge tone={b.status === 'completed' ? 'grey' : 'gold'}>{b.status === 'completed' ? 'انتهى' : b.status === 'awaiting_verification' ? (b.method === 'cash' ? 'تأكيد' : 'تحقق') : 'بانتظار الدفع'}</Badge>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </Section>

      <BookingSheet booking={current} onClose={() => setSelected(null)} />
      <ManualBookingSheet open={manual} onClose={() => setManual(false)} />
    </>
  )
}

/** "تفعيل إشعارات الفريق" — shown until push is granted on this device; afterwards a one-line battery hint for phones
 *  whose power saver silences Chrome (Xiaomi / Huawei / Oppo…), with a two-step "كيف؟" sheet. */
function PushCard() {
  const { view } = useStore()
  const toast = useToast()
  const [state, setState] = useState<PushState>(() => pushState())
  const [busy, setBusy] = useState(false)
  const [how, setHow] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const vapid = view.settings?.vapid_public_key
  const aggressiveOem = typeof navigator !== 'undefined' && AGGRESSIVE_OEM.test(navigator.userAgent)
  if (state === 'unsupported' || !vapid) return null

  async function enable() {
    setBusy(true); setProblem(null)
    try {
      const s = await enableTeamPush(vapid!)
      setState(s)
      if (s === 'granted') await sendTest(true)
      else toast.show(s === 'denied' ? 'الإشعارات مرفوضة — فعّلها من إعدادات الهاتف لهذا التطبيق' : 'هذا المتصفح لا يدعم الإشعارات', 'error')
    } catch (err) { setProblem(pushErrorText(err)) } finally { setBusy(false) }
  }
  async function sendTest(quiet = false) {
    setBusy(true); setProblem(null)
    try {
      await ensureTeamPush(vapid!)
      const r = await testPush()
      const ok = r.results.some((x) => x.status !== null && x.status >= 200 && x.status < 300)
      if (!r.configured) setProblem('مفاتيح الإشعارات غير مضبوطة على الخادم.')
      else if (r.subscriptions === 0) setProblem('هذا الجهاز غير مسجّل بعد — اضغط «تفعيل» مرة ثانية.')
      else if (ok) toast.show(quiet ? 'تم التفعيل — وصلك إشعار تجريبي؟' : 'أُرسل إشعار تجريبي — يجب أن يظهر خلال ثوانٍ', 'ok')
      else setProblem(`خدمة الإشعارات رفضت الإرسال (${r.results.map((x) => x.status ?? x.error).join('، ')}).`)
    } catch (err) { setProblem(pushErrorText(err)) } finally { setBusy(false) }
  }

  return (
    <>
      <Card className="mt push-card">
        <div className="row gap">
          <Icon name="bell" size={22} className="wine" />
          <div>
            <div className="strong">{state === 'granted' ? 'الإشعارات مفعّلة على هذا الجهاز' : 'إشعارات الفريق'}</div>
            <div className="muted small">
              {state === 'denied' ? 'الإشعارات مرفوضة — فعّلها من إعدادات الهاتف ← التطبيقات ← فوكس بوينت (أو Chrome) ← الإشعارات، ثم ارجع هنا.'
                : state === 'granted' ? 'تصلك تنبيهات الحجوزات الجديدة والدفعات حتى والتطبيق مغلق.'
                : 'تنبيه فوري عند كل حجز جديد أو دفعة بانتظار التحقق.'}
              {state === 'granted' && aggressiveOem && <>{' '}<button type="button" className="linkish" onClick={() => setHow(true)}>لا تصل والشاشة مقفلة؟</button></>}
            </div>
            {problem && <div className="small mt" style={{ color: 'var(--danger)' }}>{problem}</div>}
          </div>
        </div>
        {state === 'granted'
          ? <Button variant="ghost" size="sm" loading={busy} onClick={() => sendTest()}>أرسل إشعاراً تجريبياً</Button>
          : state !== 'denied' && <Button variant="soft" loading={busy} onClick={enable}>تفعيل إشعارات الفريق</Button>}
      </Card>
      <Sheet open={how} onClose={() => setHow(false)} title="استثناء التطبيق من توفير البطارية">
        <ol className="steps">
          <li><span>افتح <b>الإعدادات</b> ← <b>التطبيقات</b> ← <b>Chrome</b> (وفوكس بوينت) ← <b>البطارية</b> واختر <b>بلا قيود</b>.</span></li>
          <li><span>فعّل <b>التشغيل التلقائي</b> واسمح بـ<b>النشاط في الخلفية</b>؛ على شاومي: الإعدادات ← البطارية ← توفير البطارية في التطبيقات ← Chrome ← بلا قيود.</span></li>
        </ol>
        <div className="sheet-foot"><Button block onClick={() => setHow(false)}>تم</Button></div>
      </Sheet>
    </>
  )
}
