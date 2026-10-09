import React, { useEffect, useState } from 'react'
import type { Order, RepairTicket } from '@shared/types'
import { ORDER_FLOW, ORDER_STATUS, TICKET_FLOW, TICKET_STATUS } from '@shared/types'
import { useRoute, Link } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import type { TrackResult } from '../lib/backend'
import { fmtDateTime, fmtMoney, waLink } from '../lib/format'
import { Icon } from '../components/Icons'
import { Field, StatusBadge } from '../components/ui'

export function Timeline<T extends string>({ flow, labels, current, history, cancelled }: { flow: T[]; labels: Record<T, { label: string }>; current: T; history: { status: T; at: number; note?: string }[]; cancelled: boolean }) {
  const idx = flow.indexOf(current)
  const at = (s: T) => history.filter(h => h.status === s).pop()?.at
  if (cancelled) return <div className="badge" style={{ color: 'var(--err)' }}>تم إلغاء هذا الطلب{at(current) ? ` — ${fmtDateTime(at(current)!)}` : ''}</div>
  return (
    <div className="timeline">
      {flow.map((s, i) => (
        <div key={s} className={`t ${i < idx ? 'done' : i === idx ? 'now' : ''}`}>
          <span className="dot">{i < idx && <Icon.Check />}</span>
          <div><div className="lbl">{labels[s].label}</div>{at(s) && i <= idx && <div className="tm">{fmtDateTime(at(s)!)}</div>}</div>
        </div>
      ))}
    </div>
  )
}

export function OrderView({ o }: { o: Order }) {
  const { settings } = useStore()
  return (
    <div className="card card-pad">
      <div className="row-between wrap"><div><span className="muted small">طلب</span><h2 className="num" style={{ fontSize: 26 }}>#{o.number}</h2></div><StatusBadge status={o.status} kind="order" /></div>
      <p className="muted small">{fmtDateTime(o.createdAt)} · {o.customer.name} · {o.customer.city}</p>
      <div className="divider" />
      <Timeline flow={ORDER_FLOW} labels={ORDER_STATUS} current={o.status} history={o.history} cancelled={o.status === 'cancelled'} />
      <div className="divider" />
      {o.items.map((it, i) => <div key={i} className="row-between small" style={{ padding: '6px 0' }}><span>{it.name} × {it.qty}</span><span className="num">{fmtMoney(it.price * it.qty, settings)}</span></div>)}
      <div className="row-between small muted" style={{ padding: '6px 0' }}><span>الشحن</span><span className="num">{o.shipping ? fmtMoney(o.shipping, settings) : 'مجاني'}</span></div>
      <div className="row-between" style={{ paddingTop: 10, fontWeight: 800, fontSize: 18 }}><span>الإجمالي</span><span className="num">{fmtMoney(o.total, settings)}</span></div>
      {!o.whatsappSent && o.status === 'new' && <a className="btn btn-wa btn-block" style={{ marginTop: 14 }} href={waLink(settings.whatsapp, `مرحباً، أريد تأكيد طلبي رقم #${o.number}`)} target="_blank" rel="noreferrer" onClick={() => api.orderWhatsapp(o.id).catch(() => {})}><Icon.WhatsApp />تأكيد الطلب عبر واتساب</a>}
    </div>
  )
}

export function TicketView({ t }: { t: RepairTicket }) {
  const { settings } = useStore()
  return (
    <div className="card card-pad">
      <div className="row-between wrap"><div><span className="muted small">طلب صيانة</span><h2 className="num" style={{ fontSize: 26 }}>#{t.number}</h2></div><StatusBadge status={t.status} kind="ticket" /></div>
      <p className="muted small">{fmtDateTime(t.createdAt)} · {t.deviceType} {t.brand} {t.model}</p>
      <div className="divider" />
      <Timeline flow={TICKET_FLOW} labels={TICKET_STATUS} current={t.status} history={t.history} cancelled={t.status === 'cancelled'} />
      <div className="divider" />
      <p className="small"><b>العطل:</b> {t.issue}</p>
      {t.estimate !== undefined && <p className="small" style={{ marginTop: 8 }}><b>التكلفة التقديرية:</b> <span className="num">{fmtMoney(t.estimate, settings)}</span></p>}
      {t.finalCost !== undefined && <p className="small" style={{ marginTop: 4 }}><b>التكلفة النهائية:</b> <span className="num">{fmtMoney(t.finalCost, settings)}</span></p>}
      {t.status === 'quoted' && <a className="btn btn-wa btn-block" style={{ marginTop: 14 }} href={waLink(settings.whatsapp, `مرحباً، أوافق على تكلفة صيانة الجهاز رقم #${t.number}`)} target="_blank" rel="noreferrer"><Icon.WhatsApp />الموافقة على التكلفة عبر واتساب</a>}
    </div>
  )
}

export function TrackPage() {
  const { search } = useRoute()
  const [number, setNumber] = useState(search.get('number') || '')
  const [phone, setPhone] = useState(search.get('phone') || '')
  const [res, setRes] = useState<TrackResult | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (n = number, p = phone) => {
    setErr(''); setRes(null)
    if (!n || !p) return setErr('أدخل رقم الطلب ورقم الهاتف')
    setBusy(true)
    try { setRes(await api.track(n.replace(/\D/g, ''), p)) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  useEffect(() => { if (search.get('number') && search.get('phone')) run(search.get('number')!, search.get('phone')!) }, [])
  return (
    <div className="page container" style={{ maxWidth: 720 }}>
      <div className="page-head"><h1>تتبّع الطلب</h1><p>أدخل رقم الطلب أو رقم طلب الصيانة مع رقم الهاتف الذي سجّلت به.</p></div>
      <form className="card card-pad" onSubmit={e => { e.preventDefault(); run() }}>
        <div className="form-grid">
          <Field label="رقم الطلب"><input className="input num" dir="ltr" placeholder="1001" value={number} onChange={e => setNumber(e.target.value)} inputMode="numeric" /></Field>
          <Field label="رقم الهاتف"><input className="input num" dir="ltr" placeholder="09xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" /></Field>
        </div>
        {err && <p className="error-text" style={{ marginTop: 10 }}>{err}</p>}
        <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy}><Icon.Search />{busy ? '…' : 'بحث'}</button>
      </form>
      <div style={{ marginTop: 20 }}>
        {res?.kind === 'order' && <OrderView o={res.order} />}
        {res?.kind === 'ticket' && <TicketView t={res.ticket} />}
      </div>
      <p className="muted small center" style={{ marginTop: 20 }}>لم تطلب بعد؟ <Link to="/shop" style={{ color: 'var(--primary-text)' }}>تصفّح المتجر</Link> أو <Link to="/repair" style={{ color: 'var(--primary-text)' }}>اطلب صيانة</Link>.</p>
    </div>
  )
}
