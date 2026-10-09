import React, { useEffect, useState } from 'react'
import type { RepairTicket, TicketStatus } from '@shared/types'
import { TICKET_FLOW, TICKET_STATUS } from '@shared/types'
import { DJI_DRONES } from '@shared/dji'
import { navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { fmtDateTime, fmtMoney, waLink } from '../lib/format'
import { Icon } from '../components/Icons'
import { Confirm, Empty, Field, Modal, Spinner, StatusBadge } from '../components/ui'
import { Timeline } from '../pages/Track'

const ALL = [...TICKET_FLOW, 'cancelled'] as TicketStatus[]

function NewTicket({ onClose, onSaved }: { onClose: () => void; onSaved: (t: RepairTicket) => void }) {
  const { settings, toast } = useStore()
  const [f, setF] = useState({ name: '', phone: '', city: settings.shipping.zones[0]?.name || '', deviceType: settings.repair.deviceTypes[0] || 'درون', brand: 'DJI', model: '', issue: '', accessories: '', estimate: '' })
  const [busy, setBusy] = useState(false)
  const u = (k: string, v: string) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, '').length < 7 || f.issue.trim().length < 5) return toast('الاسم والهاتف ووصف العطل مطلوبة', 'err')
    setBusy(true)
    try { onSaved(await api.admin.createTicket({ customer: { name: f.name, phone: f.phone, city: f.city, address: '' }, deviceType: f.deviceType, brand: f.brand, model: f.model, issue: f.issue, accessories: f.accessories, estimate: f.estimate ? Number(f.estimate) : undefined })); toast('تم تسجيل الجهاز') } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title="استلام جهاز للصيانة" onClose={onClose} wide footer={<><button className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={busy} onClick={save}><Icon.Check />تسجيل</button></>}>
      <div className="form-grid">
        <Field label="اسم العميل *"><input className="input" value={f.name} onChange={e => u('name', e.target.value)} /></Field>
        <Field label="الهاتف *"><input className="input num" dir="ltr" value={f.phone} onChange={e => u('phone', e.target.value)} /></Field>
        <Field label="نوع الجهاز"><select className="select" value={f.deviceType} onChange={e => u('deviceType', e.target.value)}>{settings.repair.deviceTypes.map(d => <option key={d}>{d}</option>)}</select></Field>
        <Field label="الماركة"><input className="input" value={f.brand} onChange={e => u('brand', e.target.value)} list="rbrands" /><datalist id="rbrands">{settings.repair.brands.map(b => <option key={b}>{b}</option>)}</datalist></Field>
        <Field label="الطراز"><input className="input" value={f.model} onChange={e => u('model', e.target.value)} list="models" /><datalist id="models">{DJI_DRONES.map(d => <option key={d.id}>{d.name}</option>)}</datalist></Field>
        <Field label="المحافظة"><select className="select" value={f.city} onChange={e => u('city', e.target.value)}>{settings.shipping.zones.map(z => <option key={z.name}>{z.name}</option>)}</select></Field>
        <Field label="وصف العطل *" span2><textarea className="textarea" style={{ minHeight: 80 }} value={f.issue} onChange={e => u('issue', e.target.value)} /></Field>
        <Field label="الملحقات المستلمة"><input className="input" value={f.accessories} onChange={e => u('accessories', e.target.value)} /></Field>
        <Field label="تقدير مبدئي للتكلفة"><input className="input num" type="number" min={0} value={f.estimate} onChange={e => u('estimate', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function TicketDrawer({ ticket, onClose, onChange }: { ticket: RepairTicket; onClose: () => void; onChange: (t: RepairTicket | null) => void }) {
  const { settings, toast, reload } = useStore()
  const [t, setT] = useState(ticket)
  const [f, setF] = useState({ estimate: ticket.estimate ?? '', finalCost: ticket.finalCost ?? '', partsCost: ticket.partsCost ?? '', technicianNotes: ticket.technicianNotes || '' })
  const [del, setDel] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setT(ticket); setF({ estimate: ticket.estimate ?? '', finalCost: ticket.finalCost ?? '', partsCost: ticket.partsCost ?? '', technicianNotes: ticket.technicianNotes || '' }) }, [ticket])
  const patch = async (p: Record<string, unknown>, msg = 'تم الحفظ') => {
    setBusy(true)
    try { const n = await api.admin.updateTicket(t.id, p); setT(n); onChange(n); toast(msg); if (p.status) reload() } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const saveCosts = () => patch({ estimate: f.estimate === '' ? 0 : Number(f.estimate), finalCost: f.finalCost === '' ? 0 : Number(f.finalCost), partsCost: f.partsCost === '' ? 0 : Number(f.partsCost), technicianNotes: f.technicianNotes })
  const waPhone = t.customer.phone.replace(/\D/g, '').replace(/^0/, '963')
  const msgFor = (s: TicketStatus) => {
    const base = `مرحباً ${t.customer.name}، بخصوص جهازك ${t.brand} ${t.model} (طلب #${t.number}) في ${settings.siteName}:\n`
    if (s === 'quoted') return base + `بعد الفحص، تكلفة الإصلاح ${f.estimate || t.estimate || '…'} ${settings.currency.symbol}. هل توافق على البدء؟`
    if (s === 'ready') return base + `جهازك جاهز للاستلام 🎉 التكلفة النهائية ${f.finalCost || t.finalCost || t.estimate || '…'} ${settings.currency.symbol}.`
    return base + `الحالة الآن: ${TICKET_STATUS[s].label}.`
  }
  return (
    <div className="drawer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="pane">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div><span className="muted small">طلب صيانة</span><h2 className="num" style={{ fontSize: 26 }}>#{t.number}</h2></div>
          <div className="row"><button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon.Printer />إيصال</button><button className="icon-btn" onClick={onClose}><Icon.X /></button></div>
        </div>
        <div className="row wrap" style={{ marginBottom: 14 }}><StatusBadge status={t.status} kind="ticket" /><span className="hint">{fmtDateTime(t.createdAt)}</span>{t.demo && <span className="badge">تجريبي</span>}</div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>الحالة</h3>
          <div className="status-select">{ALL.map(s => <button key={s} className={t.status === s ? 'on' : ''} style={t.status === s ? { background: TICKET_STATUS[s].color } : {}} disabled={busy} onClick={() => t.status !== s && patch({ status: s }, `الحالة: ${TICKET_STATUS[s].label}`)}>{TICKET_STATUS[s].label}</button>)}</div>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <a className="btn btn-wa btn-sm" target="_blank" rel="noreferrer" href={waLink(waPhone, msgFor(t.status))}><Icon.WhatsApp />إبلاغ العميل بالحالة</a>
            <a className="btn btn-ghost btn-sm" href={`tel:${t.customer.phone}`}><Icon.Phone />{t.customer.phone}</a>
          </div>
          <Timeline flow={TICKET_FLOW} labels={TICKET_STATUS} current={t.status} history={t.history} cancelled={t.status === 'cancelled'} />
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>الجهاز</h3>
          <div className="stack small" style={{ gap: 6 }}>
            <div className="row-between"><span className="muted">العميل</span><b>{t.customer.name} · {t.customer.city}</b></div>
            <div className="row-between"><span className="muted">الجهاز</span><span>{t.deviceType} — {t.brand} {t.model}</span></div>
            <div><span className="muted">العطل: </span>{t.issue}</div>
            {t.accessories && <div><span className="muted">الملحقات: </span>{t.accessories}</div>}
          </div>
          {t.photos.length > 0 && <div className="thumbs-row" style={{ marginTop: 10 }}>{t.photos.map((p, i) => <a key={i} className="th" href={p} target="_blank" rel="noreferrer"><img src={p} alt="" /></a>)}</div>}
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>التكلفة وملاحظات الفني</h3>
          <div className="form-grid">
            <Field label="التقدير المبدئي" hint="يراه العميل في صفحة التتبّع"><input className="input num" type="number" min={0} value={f.estimate} onChange={e => setF(x => ({ ...x, estimate: e.target.value }))} /></Field>
            <Field label="التكلفة النهائية" hint="تُسجَّل كإيراد عند التسليم"><input className="input num" type="number" min={0} value={f.finalCost} onChange={e => setF(x => ({ ...x, finalCost: e.target.value }))} /></Field>
            <Field label="كلفة القطع (مصروف)" hint="تُسجَّل كمصروف عند التسليم"><input className="input num" type="number" min={0} value={f.partsCost} onChange={e => setF(x => ({ ...x, partsCost: e.target.value }))} /></Field>
            <Field label="الربح المتوقع"><div className="input num" style={{ background: 'var(--surface)' }}>{fmtMoney((Number(f.finalCost) || 0) - (Number(f.partsCost) || 0), settings)}</div></Field>
            <Field label="ملاحظات الفني (داخلية)" span2><textarea className="textarea" style={{ minHeight: 70 }} value={f.technicianNotes} onChange={e => setF(x => ({ ...x, technicianNotes: e.target.value }))} /></Field>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={busy} onClick={saveCosts}><Icon.Check />حفظ</button>
        </div>
        <button className="btn btn-danger btn-sm" onClick={() => setDel(true)}><Icon.Trash />حذف</button>
        {del && <Confirm title="حذف طلب الصيانة" danger confirmLabel="حذف" text="حذف نهائي؟" onClose={() => setDel(false)} onConfirm={async () => { await api.admin.deleteTicket(t.id); onChange(null); toast('تم الحذف') }} />}
      </div>
    </div>
  )
}

export function TicketsPage() {
  const { search } = useRoute()
  const { settings, toast } = useStore()
  const [list, setList] = useState<RepairTicket[] | null>(null)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<RepairTicket | null>(null)
  const [creating, setCreating] = useState(!!search.get('new'))
  const load = () => api.admin.tickets(q || undefined, status || undefined).then(l => { setList(l); const id = search.get('open'); if (id) { const t = l.find(x => x.id === id); if (t) setOpen(t) } if (search.get('open') || search.get('new')) navigate('/admin/tickets', { replace: true, scroll: false }) }).catch(e => toast((e as Error).message, 'err'))
  useEffect(() => { const h = setTimeout(load, q ? 300 : 0); return () => clearTimeout(h) }, [q, status])
  const counts = (list || []).reduce<Record<string, number>>((m, t) => { m[t.status] = (m[t.status] || 0) + 1; return m }, {})
  return (
    <>
      <div className="admin-top"><div><h1>الصيانة</h1><p>طلبات الصيانة من الموقع والأجهزة المستلمة في المركز.</p></div><button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon.Plus />استلام جهاز</button></div>
      <div className="toolbar">
        <div className="pill-tabs"><button className={!status ? 'on' : ''} onClick={() => setStatus('')}>الكل</button>{ALL.map(s => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{TICKET_STATUS[s].label}{!status && counts[s] ? ` (${counts[s]})` : ''}</button>)}</div>
        <div className="search-bar" style={{ display: 'block', maxWidth: 280, marginInlineStart: 'auto' }}><Icon.Search /><input className="input input-sm" placeholder="رقم، اسم، هاتف، طراز" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty icon={<Icon.Wrench />} title="لا طلبات صيانة" /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr><th>#</th><th>العميل</th><th>الجهاز</th><th>التكلفة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
          {list.map(t => (
            <tr key={t.id} className="click" onClick={() => setOpen(t)}>
              <td className="num">{t.number}</td>
              <td><b style={{ fontWeight: 600 }}>{t.customer.name}</b><div className="hint num" dir="ltr" style={{ textAlign: 'end' }}>{t.customer.phone}</div></td>
              <td className="small">{t.brand} {t.model}<div className="hint">{t.issue.slice(0, 50)}{t.issue.length > 50 ? '…' : ''}</div></td>
              <td className="num">{t.finalCost ? fmtMoney(t.finalCost, settings) : t.estimate ? <span className="muted">~{fmtMoney(t.estimate, settings)}</span> : '—'}</td>
              <td><StatusBadge status={t.status} kind="ticket" /></td>
              <td className="hint num">{fmtDateTime(t.createdAt)}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      {creating && <NewTicket onClose={() => setCreating(false)} onSaved={t => { setList(l => [t, ...(l || [])]); setCreating(false); setOpen(t) }} />}
      {open && <TicketDrawer ticket={open} onClose={() => setOpen(null)} onChange={n => { if (!n) { setList(l => l!.filter(x => x.id !== open.id)); setOpen(null) } else { setList(l => l!.map(x => (x.id === n.id ? n : x))); setOpen(n) } }} />}
    </>
  )
}
