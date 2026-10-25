// /team/customers — الزبائن (admin): search by phone or name, bookings count, block toggle. Online for the search
// (with the last result cached for offline viewing); blocking needs the network.
import { useEffect, useState } from 'react'
import type { Customer } from '@shared/types'
import { api, ApiError } from '../api'
import { fmtDate } from '../format'
import { cachedGet } from '../offline'
import { Badge, Card, Empty, Icon, Input, Spinner, Toggle, useToast } from '../ui'
import { Confirm, PageHead } from './common'
import { useStore } from './store'
import { cx, describeError, telHref, whatsappHref } from './util'

export function Customers() {
  const toast = useToast()
  const { sync } = useStore()
  const [q, setQ] = useState('')
  const [list, setList] = useState<Customer[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [toBlock, setToBlock] = useState<Customer | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const t = window.setTimeout(async () => {
      setLoading(true)
      try {
        const r = await cachedGet<Customer[]>(`/v1/team/customers?q=${encodeURIComponent(q.trim())}`)
        if (!alive) return
        setList(r.data)
        setFromCache(r.fromCache)
        setError(null)
      } catch (err) {
        if (!alive) return
        setError(describeError(err))
      } finally { if (alive) setLoading(false) }
    }, 300)
    return () => { alive = false; window.clearTimeout(t) }
  }, [q, sync.online])

  async function setBlocked(c: Customer, blocked: 0 | 1) {
    setBusy(c.phone)
    try {
      const updated = await api.post<Customer>(`/v1/team/customers/${c.phone}/block`, { blocked })
      setList((l) => (l ? l.map((x) => (x.phone === c.phone ? { ...x, ...updated } : x)) : l))
      toast.show(blocked ? 'تم حظر الزبون — لن يستطيع الحجز' : 'تم رفع الحظر', 'ok')
    } catch (err) {
      toast.show(err instanceof ApiError && err.offline ? 'الحظر يحتاج اتصالاً بالإنترنت' : describeError(err), 'error')
    } finally { setBusy(null); setToBlock(null) }
  }

  return (
    <>
      <PageHead title="الزبائن" sub="كل من حجز مرة — بالاسم ورقم الهاتف" />
      <div className="mb" style={{ position: 'relative' }}>
        <Input placeholder="ابحث برقم الهاتف أو الاسم" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" autoFocus />
      </div>
      {fromCache && <div className="alert alert-info mb">تعرض نتائج محفوظة — لا يوجد اتصال.</div>}
      {loading && !list ? <div className="center center-pad"><Spinner /></div>
        : error && !list ? <Empty title="تعذّر تحميل الزبائن" hint={error} />
        : !list || list.length === 0 ? <Empty title="لا نتائج" hint={q ? 'جرّب رقماً أو اسماً آخر.' : 'سيظهر الزبائن هنا بعد أول حجز.'} />
        : (
          <div className="list">
            {list.map((c) => (
              <div key={c.phone} className={cx('crow', c.blocked === 1 && 'is-blocked')}>
                <div className="grow">
                  <div className="row gap-sm wrap">
                    <span className="name">{c.name || 'بدون اسم'}</span>
                    <span className="muted small num">{c.phone}</span>
                    {c.blocked === 1 && <Badge tone="red">محظور</Badge>}
                  </div>
                  <div className="meta">{c.bookings} {c.bookings === 1 ? 'حجز' : c.bookings === 2 ? 'حجزان' : c.bookings <= 10 ? 'حجوزات' : 'حجزاً'}{c.last_booking && ` · آخر حجز ${fmtDate(c.last_booking)}`}</div>
                  <div className="row gap-sm mt-sm">
                    <a className="btn btn-ghost btn-sm" href={telHref(c.phone)}><Icon name="phone" size={16} /> اتصال</a>
                    <a className="btn btn-ghost btn-sm" href={whatsappHref(c.phone)} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={16} /> واتساب</a>
                  </div>
                </div>
                <Toggle label="حظر" checked={c.blocked === 1} onChange={(v) => (v ? setToBlock(c) : void setBlocked(c, 0))} />
              </div>
            ))}
          </div>
        )}
      <Card className="mt"><div className="inline-note"><Icon name="people" size={16} />الزبون المحظور لا يستطيع إنشاء حجز جديد من التطبيق؛ حجوزاته القائمة لا تتأثر.</div></Card>
      <Confirm open={!!toBlock} title="حظر الزبون؟" danger confirmLabel="حظر" loading={busy === toBlock?.phone}
        body={<>لن يستطيع <b>{toBlock?.name || toBlock?.phone}</b> الحجز من التطبيق حتى ترفع الحظر.</>}
        onClose={() => setToBlock(null)} onConfirm={() => toBlock && void setBlocked(toBlock, 1)} />
    </>
  )
}
