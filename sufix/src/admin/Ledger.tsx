import React, { useEffect, useMemo, useState } from 'react'
import type { LedgerEntry, LedgerType } from '@shared/types'
import { LEDGER_CATEGORIES } from '@shared/types'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { daysAgo, fmtDate, fmtMoney, today } from '../lib/format'
import { Icon } from '../components/Icons'
import { Confirm, Empty, Field, Modal, Spinner } from '../components/ui'

function EntryEditor({ initial, onClose, onSaved }: { initial: Partial<LedgerEntry>; onClose: () => void; onSaved: (e: LedgerEntry) => void }) {
  const { toast } = useStore()
  const [e, setE] = useState<Partial<LedgerEntry>>({ type: 'income', amount: 0, category: LEDGER_CATEGORIES.income[0], note: '', date: today(), ...initial })
  const [busy, setBusy] = useState(false)
  const type = (e.type || 'income') as LedgerType
  const save = async () => {
    if (!(Number(e.amount) > 0)) return toast('أدخل المبلغ', 'err')
    setBusy(true)
    try { onSaved(await api.admin.saveLedger({ ...e, amount: Number(e.amount) })); toast('تم الحفظ') } catch (er) { toast((er as Error).message, 'err') } finally { setBusy(false) }
  }
  return (
    <Modal title={e.id ? 'تعديل القيد' : 'قيد جديد'} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={busy} onClick={save}><Icon.Check />حفظ</button></>}>
      <div className="form-grid">
        <div className="field span-2"><label>النوع</label><div className="pill-tabs"><button className={type === 'income' ? 'on' : ''} onClick={() => setE(x => ({ ...x, type: 'income', category: LEDGER_CATEGORIES.income[0] }))}>وارد (إيراد)</button><button className={type === 'expense' ? 'on' : ''} onClick={() => setE(x => ({ ...x, type: 'expense', category: LEDGER_CATEGORIES.expense[0] }))}>صادر (مصروف)</button></div></div>
        <Field label="المبلغ *"><input className="input num" type="number" min={0} step="0.01" value={e.amount || ''} onChange={ev => setE(x => ({ ...x, amount: Number(ev.target.value) }))} autoFocus /></Field>
        <Field label="التاريخ"><input className="input num" type="date" value={e.date} onChange={ev => setE(x => ({ ...x, date: ev.target.value }))} /></Field>
        <Field label="التصنيف"><input className="input" list="lcats" value={e.category || ''} onChange={ev => setE(x => ({ ...x, category: ev.target.value }))} /><datalist id="lcats">{LEDGER_CATEGORIES[type].map(c => <option key={c}>{c}</option>)}</datalist></Field>
        <Field label="البيان" span2><input className="input" value={e.note || ''} onChange={ev => setE(x => ({ ...x, note: ev.target.value }))} placeholder="مثال: شراء 10 بطاريات Mini 4 Pro من المورد" /></Field>
      </div>
    </Modal>
  )
}

export function LedgerPage() {
  const { settings, toast } = useStore()
  const [list, setList] = useState<LedgerEntry[] | null>(null)
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const [type, setType] = useState('')
  const [editing, setEditing] = useState<Partial<LedgerEntry> | null>(null)
  const [del, setDel] = useState<LedgerEntry | null>(null)
  const load = () => api.admin.ledger(from, to, type || undefined).then(setList).catch(e => toast((e as Error).message, 'err'))
  useEffect(() => { load() }, [from, to, type])
  const totals = useMemo(() => (list || []).reduce((a, l) => { a[l.type] += l.amount; return a }, { income: 0, expense: 0 }), [list])
  const quick = (d: number) => { setFrom(daysAgo(d)); setTo(today()) }
  const exportCsv = () => {
    const rows = [['التاريخ', 'النوع', 'التصنيف', 'البيان', 'المبلغ', 'العملة'], ...(list || []).map(l => [l.date, l.type === 'income' ? 'وارد' : 'صادر', l.category, l.note.replace(/"/g, '""'), String(l.amount), l.currency])]
    const csv = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `sufix-ledger-${from}_${to}.csv`; a.click()
  }
  return (
    <>
      <div className="admin-top"><div><h1>دفتر الصادر والوارد</h1><p>كل إيراد ومصروف. تُضاف المبيعات وإيرادات الصيانة تلقائياً عند التسليم.</p></div><div className="row wrap"><button className="btn btn-ghost btn-sm" onClick={exportCsv}><Icon.Download />تصدير CSV</button><button className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Icon.Plus />قيد جديد</button></div></div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="kpi green"><span className="ico"><Icon.TrendUp /></span><div className="l">الوارد</div><div className="v">{fmtMoney(totals.income, settings)}</div></div>
        <div className="kpi red"><span className="ico"><Icon.TrendDown /></span><div className="l">الصادر</div><div className="v">{fmtMoney(totals.expense, settings)}</div></div>
        <div className={`kpi ${totals.income - totals.expense >= 0 ? 'green' : 'red'}`}><span className="ico"><Icon.Dollar /></span><div className="l">الصافي</div><div className="v">{fmtMoney(totals.income - totals.expense, settings)}</div><div className="s">{list?.length ?? 0} قيد في الفترة</div></div>
      </div>
      <div className="toolbar">
        <div className="pill-tabs"><button onClick={() => quick(6)}>7 أيام</button><button onClick={() => quick(29)}>30 يوم</button><button onClick={() => quick(89)}>3 أشهر</button><button onClick={() => { setFrom(today().slice(0, 4) + '-01-01'); setTo(today()) }}>هذه السنة</button></div>
        <input className="input input-sm num" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} />
        <span className="muted">→</span>
        <input className="input input-sm num" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
        <select className="select input-sm" style={{ width: 'auto' }} value={type} onChange={e => setType(e.target.value)}><option value="">وارد وصادر</option><option value="income">الوارد فقط</option><option value="expense">الصادر فقط</option></select>
      </div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty icon={<Icon.Book />} title="لا قيود في هذه الفترة" action={<button className="btn btn-primary" onClick={() => setEditing({})}><Icon.Plus />قيد جديد</button>} /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr><th>التاريخ</th><th>البيان</th><th>التصنيف</th><th>وارد</th><th>صادر</th><th></th></tr></thead><tbody>
          {list.map(l => (
            <tr key={l.id}>
              <td className="num hint">{fmtDate(l.date)}</td>
              <td>{l.note || '—'}{l.ref && <div className="hint">{l.ref.kind === 'order' ? 'طلب' : 'صيانة'} #{l.ref.number}</div>}</td>
              <td><span className="badge">{l.category}</span></td>
              <td className="num" style={{ color: 'var(--ok)', fontWeight: 600 }}>{l.type === 'income' ? fmtMoney(l.amount, settings) : ''}</td>
              <td className="num" style={{ color: 'var(--err)', fontWeight: 600 }}>{l.type === 'expense' ? fmtMoney(l.amount, settings) : ''}</td>
              <td><div className="actions"><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditing(l)}><Icon.Edit /></button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDel(l)}><Icon.Trash /></button></div></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      {editing && <EntryEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {del && <Confirm title="حذف القيد" danger confirmLabel="حذف" text={`حذف «${del.note || del.category}» بمبلغ ${fmtMoney(del.amount, settings)}؟`} onClose={() => setDel(null)} onConfirm={async () => { await api.admin.deleteLedger(del.id); load(); toast('تم الحذف') }} />}
    </>
  )
}
