import React, { useEffect, useState } from 'react'
import type { Order, OrderStatus } from '@shared/types'
import { ORDER_FLOW, ORDER_STATUS } from '@shared/types'
import { navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { fmtDateTime, fmtMoney, waLink } from '../lib/format'
import { Icon } from '../components/Icons'
import { Confirm, Empty, Field, Spinner, StatusBadge } from '../components/ui'
import { Timeline } from '../pages/Track'

const ALL_STATUSES = [...ORDER_FLOW, 'cancelled'] as OrderStatus[]

function OrderDrawer({ order, onClose, onChange }: { order: Order; onClose: () => void; onChange: (o: Order | null) => void }) {
  const { settings, toast, reload } = useStore()
  const [o, setO] = useState(order)
  const [notes, setNotes] = useState(order.adminNotes || '')
  const [shipping, setShipping] = useState(String(order.shipping))
  const [del, setDel] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setO(order); setNotes(order.adminNotes || ''); setShipping(String(order.shipping)) }, [order])
  const patch = async (p: Record<string, unknown>, msg = 'تم الحفظ') => {
    setBusy(true)
    try { const n = await api.admin.updateOrder(o.id, p); setO(n); onChange(n); toast(msg); if (p.status) reload() } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const customerMsg = `مرحباً ${o.customer.name}، بخصوص طلبك رقم #${o.number} من ${settings.siteName}: `
  return (
    <div className="drawer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="pane">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div><span className="muted small">طلب</span><h2 className="num" style={{ fontSize: 26 }}>#{o.number}</h2></div>
          <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon.Printer />طباعة</button><button className="icon-btn" onClick={onClose}><Icon.X /></button></div>
        </div>
        <div className="row wrap" style={{ marginBottom: 14 }}><StatusBadge status={o.status} kind="order" /><span className="hint">{fmtDateTime(o.createdAt)}</span>{o.whatsappSent && <span className="badge" style={{ color: 'var(--wa)' }}>أرسل عبر واتساب</span>}{o.demo && <span className="badge">تجريبي</span>}</div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>تغيير الحالة</h3>
          <div className="status-select">{ALL_STATUSES.map(s => <button key={s} className={o.status === s ? 'on' : ''} style={o.status === s ? { background: ORDER_STATUS[s].color } : {}} disabled={busy} onClick={() => o.status !== s && patch({ status: s }, `الحالة: ${ORDER_STATUS[s].label}`)}>{ORDER_STATUS[s].label}</button>)}</div>
          <p className="hint" style={{ marginTop: 10 }}>التأكيد يخصم الكمية من المخزون، والإلغاء يعيدها. التسليم يسجّل الإيراد في الدفتر تلقائياً.</p>
          <Timeline flow={ORDER_FLOW} labels={ORDER_STATUS} current={o.status} history={o.history} cancelled={o.status === 'cancelled'} />
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>العميل</h3>
          <div className="stack small" style={{ gap: 6 }}>
            <div className="row-between"><span className="muted">الاسم</span><b>{o.customer.name}</b></div>
            <div className="row-between"><span className="muted">الهاتف</span><a className="num" dir="ltr" href={`tel:${o.customer.phone}`} style={{ color: 'var(--primary)' }}>{o.customer.phone}</a></div>
            <div className="row-between"><span className="muted">المحافظة</span><span>{o.customer.city}</span></div>
            <div className="row-between"><span className="muted">العنوان</span><span style={{ textAlign: 'end' }}>{o.customer.address}</span></div>
            {o.customer.notes && <div className="row-between"><span className="muted">ملاحظات العميل</span><span style={{ textAlign: 'end' }}>{o.customer.notes}</span></div>}
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <a className="btn btn-wa btn-sm" target="_blank" rel="noreferrer" href={waLink(o.customer.phone.replace(/^0/, '963'), customerMsg)}><Icon.WhatsApp />مراسلة العميل</a>
            <a className="btn btn-ghost btn-sm" href={`tel:${o.customer.phone}`}><Icon.Phone />اتصال</a>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>المنتجات</h3>
          {o.items.map((it, i) => <div key={i} className="row-between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span>{it.name} <span className="muted">× {it.qty}</span></span><span className="num">{fmtMoney(it.price * it.qty, settings)}</span></div>)}
          <div className="row-between small" style={{ padding: '8px 0' }}><span className="muted">المجموع</span><span className="num">{fmtMoney(o.subtotal, settings)}</span></div>
          <div className="row-between small" style={{ padding: '4px 0' }}>
            <span className="muted">الشحن</span>
            <span className="row"><input className="input input-sm num" type="number" min={0} style={{ width: 90 }} value={shipping} onChange={e => setShipping(e.target.value)} onBlur={() => Number(shipping) !== o.shipping && patch({ shipping: Number(shipping) })} /></span>
          </div>
          <div className="row-between" style={{ paddingTop: 10, fontWeight: 800, fontSize: 18 }}><span>الإجمالي</span><span className="num">{fmtMoney(o.total, settings)}</span></div>
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <Field label="ملاحظات داخلية (لا يراها العميل)"><textarea className="textarea" style={{ minHeight: 70 }} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (o.adminNotes || '') && patch({ adminNotes: notes })} /></Field>
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => setDel(true)}><Icon.Trash />حذف الطلب</button>
        {del && <Confirm title="حذف الطلب" danger confirmLabel="حذف" text="حذف الطلب نهائياً؟ لا يمكن التراجع." onClose={() => setDel(false)} onConfirm={async () => { await api.admin.deleteOrder(o.id); onChange(null); toast('تم الحذف') }} />}
      </div>
    </div>
  )
}

export function OrdersPage() {
  const { search } = useRoute()
  const { settings, toast } = useStore()
  const [list, setList] = useState<Order[] | null>(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Order | null>(null)
  const load = () => api.admin.orders(q || undefined, status || undefined).then(l => { setList(l); const id = search.get('open'); if (id) { const o = l.find(x => x.id === id); if (o) setOpen(o); navigate('/admin/orders', { replace: true, scroll: false }) } }).catch(e => toast((e as Error).message, 'err'))
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [q, status])
  const counts = (list || []).reduce<Record<string, number>>((m, o) => { m[o.status] = (m[o.status] || 0) + 1; return m }, {})
  return (
    <>
      <div className="admin-top"><div><h1>الطلبات</h1><p>كل طلب يصل من الموقع يظهر هنا فوراً مع بيانات العميل.</p></div><button className="btn btn-ghost btn-sm" onClick={load}><Icon.Refresh />تحديث</button></div>
      <div className="toolbar">
        <div className="pill-tabs"><button className={!status ? 'on' : ''} onClick={() => setStatus('')}>الكل</button>{ALL_STATUSES.map(s => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{ORDER_STATUS[s].label}{!status && counts[s] ? ` (${counts[s]})` : ''}</button>)}</div>
        <div className="search-bar" style={{ display: 'block', maxWidth: 280, marginInlineStart: 'auto' }}><Icon.Search /><input className="input input-sm" placeholder="رقم الطلب، الاسم، الهاتف" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty icon={<Icon.Package />} title="لا طلبات" text="عندما يطلب عميل من الموقع سيظهر طلبه هنا." /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr><th>#</th><th>العميل</th><th>المنتجات</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
          {list.map(o => (
            <tr key={o.id} className="click" onClick={() => setOpen(o)}>
              <td className="num">{o.number}</td>
              <td><b style={{ fontWeight: 600 }}>{o.customer.name}</b><div className="hint num" dir="ltr" style={{ textAlign: 'end' }}>{o.customer.phone} · {o.customer.city}</div></td>
              <td className="small">{o.items.slice(0, 2).map(i => i.name).join('، ')}{o.items.length > 2 ? ` +${o.items.length - 2}` : ''}</td>
              <td className="num">{fmtMoney(o.total, settings)}</td>
              <td><StatusBadge status={o.status} kind="order" /></td>
              <td className="hint num">{fmtDateTime(o.createdAt)}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      {open && <OrderDrawer order={open} onClose={() => setOpen(null)} onChange={n => { if (!n) { setList(l => l!.filter(x => x.id !== open.id)); setOpen(null) } else { setList(l => l!.map(x => (x.id === n.id ? n : x))); setOpen(n) } }} />}
    </>
  )
}
