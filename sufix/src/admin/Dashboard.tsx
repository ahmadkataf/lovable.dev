import React, { useEffect, useState } from 'react'
import type { DashboardStats } from '@shared/types'
import { ORDER_STATUS, TICKET_STATUS } from '@shared/types'
import { Link } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { fmtDateTime, fmtMoney } from '../lib/format'
import { Icon } from '../components/Icons'
import { Confirm, Spinner, StatusBadge } from '../components/ui'

export function DemoBanner({ demoCount, onChanged }: { demoCount: number; onChanged: () => void }) {
  const { settings, reload, toast } = useStore()
  const [ask, setAsk] = useState<'clear' | 'restore' | null>(null)
  if (settings.demoCleared && demoCount === 0) return null
  return (
    <div className="demo-banner">
      <div>
        <b><Icon.Alert style={{ width: 16, height: 16, verticalAlign: -3 }} /> النسخة الافتراضية مفعّلة</b>
        <p className="small muted">الموقع يعرض الآن {demoCount} سجلاً تجريبياً (منتجات، طلبات، صيانة، قيود). احذفها دفعة واحدة لتبدأ بإضافة منتجاتك الحقيقية. إعدادات الموقع تبقى كما هي.</p>
      </div>
      <button className="btn btn-danger" onClick={() => setAsk('clear')}><Icon.Trash />حذف النسخة الافتراضية بالكامل</button>
      {ask === 'clear' && <Confirm title="حذف النسخة الافتراضية" danger confirmLabel="نعم، احذف كل البيانات التجريبية" onClose={() => setAsk(null)}
        text={<>سيتم حذف <b>كل</b> المنتجات والأقسام والطلبات وطلبات الصيانة وقيود الدفتر المعلّمة كبيانات تجريبية. البيانات التي أضفتها أنت لا تتأثر. يمكنك استعادة النسخة الافتراضية لاحقاً من صفحة التخصيص.</>}
        onConfirm={async () => { await api.admin.clearDemo(); await reload(); onChanged(); toast('تم حذف النسخة الافتراضية') }} />}
    </div>
  )
}

export function Dashboard() {
  const { settings } = useStore()
  const [s, setS] = useState<DashboardStats | null>(null)
  const load = () => api.admin.dashboard().then(setS).catch(() => {})
  useEffect(() => { load() }, [])
  if (!s) return <Spinner />
  const open = (s.ordersByStatus.new || 0) + (s.ordersByStatus.confirmed || 0) + (s.ordersByStatus.processing || 0)
  const openT = Object.entries(s.ticketsByStatus).filter(([k]) => !['delivered', 'cancelled'].includes(k)).reduce((a, [, v]) => a + v, 0)
  const net = s.incomeMonth - s.expenseMonth
  return (
    <>
      <div className="admin-top"><div><h1>لوحة التحكم</h1><p>نظرة سريعة على المتجر والصيانة والحسابات.</p></div><div className="row wrap"><Link to="/admin/tickets?new=1" className="btn btn-ghost btn-sm"><Icon.Plus />طلب صيانة</Link><Link to="/admin/products?new=1" className="btn btn-primary btn-sm"><Icon.Plus />منتج جديد</Link></div></div>
      <DemoBanner demoCount={s.demoCount} onChanged={load} />
      <div className="kpis">
        <div className="kpi"><span className="ico"><Icon.Dollar /></span><div className="l">مبيعات اليوم</div><div className="v">{fmtMoney(s.salesToday, settings)}</div><div className="s">هذا الشهر: {fmtMoney(s.salesMonth, settings)}</div></div>
        <div className="kpi amber"><span className="ico"><Icon.Package /></span><div className="l">طلبات تحتاج متابعة</div><div className="v">{open}</div><div className="s">{s.ordersByStatus.new || 0} جديد · {s.ordersByStatus.shipped || 0} في الشحن</div></div>
        <div className="kpi"><span className="ico"><Icon.Wrench /></span><div className="l">أجهزة قيد الصيانة</div><div className="v">{openT}</div><div className="s">{s.ticketsByStatus.ready || 0} جاهز للتسليم · {s.ticketsByStatus.quoted || 0} بانتظار الموافقة</div></div>
        <div className={`kpi ${net >= 0 ? 'green' : 'red'}`}><span className="ico">{net >= 0 ? <Icon.TrendUp /> : <Icon.TrendDown />}</span><div className="l">صافي الشهر</div><div className="v">{fmtMoney(net, settings)}</div><div className="s">وارد {fmtMoney(s.incomeMonth, settings)} · صادر {fmtMoney(s.expenseMonth, settings)}</div></div>
      </div>
      <div className="two-col">
        <div className="panel">
          <div className="row-between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>آخر الطلبات</h3><Link to="/admin/orders" className="small" style={{ color: 'var(--primary-text)' }}>عرض الكل</Link></div>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>#</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
            {s.recentOrders.map(o => <tr key={o.id} className="click" onClick={() => (window.location.href = `/admin/orders?open=${o.id}`)}><td className="num">{o.number}</td><td>{o.customer.name}<div className="hint">{o.customer.city}</div></td><td className="num">{fmtMoney(o.total, settings)}</td><td><StatusBadge status={o.status} kind="order" /></td><td className="hint num">{fmtDateTime(o.createdAt)}</td></tr>)}
            {!s.recentOrders.length && <tr><td colSpan={5} className="center muted">لا طلبات بعد</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel">
          <div className="row-between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>آخر طلبات الصيانة</h3><Link to="/admin/tickets" className="small" style={{ color: 'var(--primary-text)' }}>عرض الكل</Link></div>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>#</th><th>الجهاز</th><th>العميل</th><th>الحالة</th></tr></thead><tbody>
            {s.recentTickets.map(t => <tr key={t.id} className="click" onClick={() => (window.location.href = `/admin/tickets?open=${t.id}`)}><td className="num">{t.number}</td><td>{t.brand} {t.model}<div className="hint">{t.deviceType}</div></td><td>{t.customer.name}</td><td><StatusBadge status={t.status} kind="ticket" /></td></tr>)}
            {!s.recentTickets.length && <tr><td colSpan={4} className="center muted">لا طلبات صيانة بعد</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel">
          <h3>حالة الطلبات</h3>
          <div className="bar-list">{Object.entries(ORDER_STATUS).map(([k, m]) => { const v = s.ordersByStatus[k] || 0; const max = Math.max(1, ...Object.values(s.ordersByStatus)); return <div key={k} className="b"><span>{m.label}</span><span className="num">{v}</span><div className="track"><div className="fill" style={{ width: `${(v / max) * 100}%`, background: m.color }} /></div></div> })}</div>
        </div>
        <div className="panel">
          <h3>حالة الصيانة</h3>
          <div className="bar-list">{Object.entries(TICKET_STATUS).map(([k, m]) => { const v = s.ticketsByStatus[k] || 0; const max = Math.max(1, ...Object.values(s.ticketsByStatus)); return <div key={k} className="b"><span>{m.label}</span><span className="num">{v}</span><div className="track"><div className="fill" style={{ width: `${(v / max) * 100}%`, background: m.color }} /></div></div> })}</div>
        </div>
        {s.lowStock.length > 0 && (
          <div className="panel">
            <h3><Icon.Alert style={{ width: 16, height: 16, verticalAlign: -3, color: 'var(--warn)' }} /> مخزون منخفض</h3>
            <div className="stack">{s.lowStock.map(p => <div key={p.id} className="row-between small"><span>{p.name}</span><span className={`badge ${p.stock === 0 ? '' : 'badge-accent'}`} style={p.stock === 0 ? { color: 'var(--err)' } : {}}>{p.stock === 0 ? 'نفد' : `بقي ${p.stock}`}</span></div>)}</div>
          </div>
        )}
      </div>
    </>
  )
}
