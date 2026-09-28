import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Save, Pencil, FileSpreadsheet, Eye } from 'lucide-react'
import { useCollection, useSettings, useIsAdmin } from '../db/store'
import type { Purchase, PurchaseItem } from '../db/types'
import { deletePurchase, savePurchase } from '../db/actions'
import { payStatus } from '../lib/calc'
import { addDays, endOfDay, fmtDate, fmtDateTime, fromInputDate, invoiceNo, matches, money, num, toInputDate } from '../lib/format'
import { DateRange, Empty, Field, NumberInput, PayBadge, SearchInput } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { PartyPicker, ProductSearch } from '../ui/pickers'
import { ProductForm, SupplierForm } from '../ui/forms'
import { exportSheet } from '../lib/excel'

export function Purchases() {
  const purchases = useCollection('purchases')
  const isAdmin = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState(toInputDate(addDays(Date.now(), -90)))
  const [to, setTo] = useState(toInputDate(Date.now()))
  const [form, setForm] = useState<Purchase | 'new' | null>(null)
  const [view, setView] = useState<Purchase | null>(null)
  const toast = useToast(); const confirm = useConfirm()
  useEffect(() => { if (params.get('new')) { setForm('new'); setParams({}) } }, [params])
  const list = useMemo(() => { const f = fromInputDate(from), t = endOfDay(fromInputDate(to)); return Array.from(purchases.values()).filter(p => p.date >= f && p.date <= t && matches(q, p.supplierName, String(p.number), p.reference, ...p.items.map(i => i.name))).sort((a, b) => b.date - a.date) }, [purchases, q, from, to])
  const total = list.reduce((s, p) => s + (p.type === 'return' ? -p.total : p.total), 0)
  const del = async (p: Purchase) => { if (await confirm({ title: `حذف فاتورة الشراء ${invoiceNo(p.number)}؟`, text: 'ستُخصم كمياتها من المخزون.', danger: true, okText: 'حذف' })) { await deletePurchase(p.id); toast.success('تم الحذف'); setView(null) } }
  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث بالمورد أو رقم الفاتورة أو القطعة…" /></div>
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
        <button className="btn primary" onClick={() => setForm('new')}><Plus /> فاتورة شراء</button>
        <button className="btn" onClick={() => exportSheet(`المشتريات-${from}-${to}`, list.map(p => ({ 'الرقم': invoiceNo(p.number), 'النوع': p.type === 'return' ? 'مرتجع' : 'شراء', 'التاريخ': fmtDateTime(p.date), 'المورد': p.supplierName, 'رقم فاتورة المورد': p.reference ?? '', 'الأصناف': p.items.map(i => `${i.name} ×${i.qty}`).join('، '), 'الإجمالي': p.total, 'المدفوع': p.paid, 'المتبقي': p.total - p.paid })), 'المشتريات')}><FileSpreadsheet /></button>
      </div>
      <div className="card">
        {list.length === 0 ? <Empty title="لا فواتير شراء في هذه الفترة" text="سجّل البضاعة التي تشتريها من الموردين لتدخل إلى المخزون تلقائياً" action={<button className="btn primary" onClick={() => setForm('new')}><Plus /> فاتورة شراء</button>} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>المورد</th><th className="hide-mobile">الأصناف</th><th className="num">الإجمالي</th><th>الحالة</th><th className="actions"></th></tr></thead>
            <tbody>{list.map(p => (
              <tr key={p.id} className="click" onClick={() => setView(p)}>
                <td className="bold">{invoiceNo(p.number)}{p.type === 'return' && <span className="badge tone-danger" style={{ marginInlineStart: 6 }}>مرتجع</span>}</td>
                <td className="small muted">{fmtDate(p.date)}</td><td>{p.supplierName}</td>
                <td className="hide-mobile small muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.items.map(i => `${i.name} ×${num(i.qty, 2)}`).join('، ')}</td>
                <td className="num bold">{money(p.total)}</td><td><PayBadge status={payStatus(p.total, p.paid)} /></td>
                <td className="actions" onClick={e => e.stopPropagation()}><button className="btn sm ghost icon" onClick={() => setView(p)}><Eye /></button><button className="btn sm ghost icon" onClick={() => setForm(p)}><Pencil /></button></td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={4}>المجموع ({list.length})</td><td className="num">{money(total)}</td><td colSpan={2}></td></tr></tfoot>
          </table></div>
        )}
      </div>
      {form && <PurchaseForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {view && (
        <Modal title={`فاتورة شراء ${invoiceNo(view.number)}`} onClose={() => setView(null)} size="wide" footer={<><button className="btn" onClick={() => { setForm(view); setView(null) }}><Pencil /> تعديل</button>{isAdmin && <><span className="grow" /><button className="btn danger" onClick={() => del(view)}><Trash2 /> حذف</button></>}</>}>
          <div className="kv mb"><dt>التاريخ</dt><dd>{fmtDateTime(view.date)}</dd><dt>المورد</dt><dd>{view.supplierName}</dd>{view.reference && <><dt>رقم فاتورة المورد</dt><dd>{view.reference}</dd></>}{view.notes && <><dt>ملاحظات</dt><dd>{view.notes}</dd></>}</div>
          <div className="table-wrap"><table className="table"><thead><tr><th>الصنف</th><th className="num">الكمية</th><th className="num">الكلفة</th><th className="num">المجموع</th></tr></thead>
            <tbody>{view.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="num">{num(i.qty, 2)}</td><td className="num">{money(i.cost)}</td><td className="num bold">{money(i.qty * i.cost)}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>الإجمالي</td><td className="num">{money(view.total)}</td></tr><tr><td colSpan={3}>المدفوع</td><td className="num">{money(view.paid)}</td></tr>{view.total > view.paid && <tr><td colSpan={3}>المتبقي للمورد</td><td className="num neg-txt">{money(view.total - view.paid)}</td></tr>}</tfoot></table></div>
        </Modal>
      )}
    </div>
  )
}

function PurchaseForm({ initial, onClose }: { initial?: Purchase; onClose: () => void }) {
  const settings = useSettings()
  const [type, setType] = useState<'purchase' | 'return'>(initial?.type ?? 'purchase')
  const [items, setItems] = useState<PurchaseItem[]>(initial?.items.map(i => ({ ...i })) ?? [])
  const [supplierId, setSupplierId] = useState(initial?.supplierId)
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? 'مورد غير مسجل')
  const [reference, setReference] = useState(initial?.reference ?? '')
  const [date, setDate] = useState(toInputDate(initial?.date ?? Date.now()))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [paid, setPaid] = useState<number | null>(initial ? initial.paid : null)
  const [addSupplier, setAddSupplier] = useState(false)
  const [addProduct, setAddProduct] = useState(false)
  const toast = useToast()
  const total = items.reduce((s, i) => s + i.qty * i.cost, 0)
  const paidValue = paid === null ? total : Math.min(paid, total)
  const update = (i: number, patch: Partial<PurchaseItem>) => setItems(l => l.map((x, k) => (k === i ? { ...x, ...patch } : x)))
  const save = async () => {
    if (items.length === 0) { toast.error('أضف قطعة واحدة على الأقل'); return }
    if (items.some(i => i.qty <= 0)) { toast.error('هناك سطر كميته صفر'); return }
    await savePurchase({ id: initial?.id, number: initial?.number, type, date: initial && toInputDate(initial.date) === date ? initial.date : fromInputDate(date), supplierId, supplierName, reference, items, paid: paidValue, notes })
    toast.success(initial ? 'تم حفظ التعديلات' : 'تم تسجيل الشراء وإضافة الكميات إلى المخزون'); onClose()
  }
  return (
    <Modal title={initial ? `تعديل فاتورة الشراء ${invoiceNo(initial.number)}` : 'فاتورة شراء جديدة'} onClose={onClose} size="wide" footer={<><button className="btn primary" onClick={save}><Save /> حفظ</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <div className="tabs small"><button className={type === 'purchase' ? 'active' : ''} onClick={() => setType('purchase')}>شراء (يدخل المخزون)</button><button className={type === 'return' ? 'active' : ''} onClick={() => setType('return')}>مرتجع للمورد (يخرج من المخزون)</button></div>
        <div className="form-grid">
          <Field label="المورد" className="full"><PartyPicker type="supplier" value={supplierId} onChange={(id, name) => { setSupplierId(id); setSupplierName(name) }} onAddNew={() => setAddSupplier(true)} /></Field>
          <Field label="رقم فاتورة المورد"><input className="input" value={reference} onChange={e => setReference(e.target.value)} /></Field>
          <Field label="التاريخ"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="إضافة قطعة"><div className="row"><div style={{ flex: 1 }}><ProductSearch allowServices={false} onPick={p => setItems(l => { const i = l.findIndex(x => x.productId === p.id); if (i >= 0) return l.map((x, k) => (k === i ? { ...x, qty: x.qty + 1 } : x)); return [...l, { productId: p.id, name: p.name, code: p.code, qty: 1, cost: p.cost }] })} placeholder="ابحث عن القطعة…" /></div><button className="btn icon" title="قطعة جديدة" onClick={() => setAddProduct(true)}><Plus /></button></div></Field>
        {items.length > 0 && (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الصنف</th><th className="num">الكمية</th><th className="num">سعر الشراء</th><th className="num">المجموع</th><th></th></tr></thead>
            <tbody>{items.map((it, i) => <tr key={i}><td>{it.name}<div className="small muted">{it.code}</div></td><td className="num" style={{ width: 100 }}><NumberInput value={it.qty} onChange={v => update(i, { qty: v })} /></td><td className="num" style={{ width: 140 }}><NumberInput value={it.cost} onChange={v => update(i, { cost: v })} /></td><td className="num bold">{money(it.qty * it.cost, { currency: false })}</td><td><button className="btn sm ghost icon" onClick={() => setItems(l => l.filter((_, k) => k !== i))}><Trash2 /></button></td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>الإجمالي</td><td className="num" style={{ fontSize: 17 }}>{money(total)}</td><td></td></tr></tfoot>
          </table></div>
        )}
        <div className="form-grid">
          <Field label="المدفوع للمورد الآن" help={paidValue < total ? `المتبقي ${money(total - paidValue)} يُسجَّل ديناً للمورد` : undefined}><NumberInput value={paidValue} onChange={setPaid} suffix={settings.currency} /></Field>
          <Field label="ملاحظات"><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
        </div>
        <div className="btn-row"><button className="btn sm" onClick={() => setPaid(null)}>دفع كامل</button><button className="btn sm" onClick={() => setPaid(0)}>آجل</button></div>
      </div>
      {addSupplier && <SupplierForm onClose={() => setAddSupplier(false)} onSaved={s => { setSupplierId(s.id); setSupplierName(s.name) }} />}
      {addProduct && <ProductForm onClose={() => setAddProduct(false)} onSaved={p => setItems(l => [...l, { productId: p.id, name: p.name, code: p.code, qty: 1, cost: p.cost }])} />}
    </Modal>
  )
}
