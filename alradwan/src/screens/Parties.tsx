import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Phone, Printer, HandCoins, FileSpreadsheet, MessageCircle, Trash2 } from 'lucide-react'
import { useCollection, useIsAdmin, useSettings } from '../db/store'
import type { Customer, Supplier, Payment } from '../db/types'
import { addPayment, remove } from '../db/actions'
import { customerBalance, supplierBalance } from '../lib/calc'
import { fmtDate, invoiceNo, matches, money } from '../lib/format'
import { Empty, Field, NumberInput, SearchInput, Stat, Tabs } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { CustomerForm, SupplierForm } from '../ui/forms'
import { printDocument } from '../print/PrintHost'
import { exportSheet } from '../lib/excel'

// Customers and suppliers are the same screen with the signs flipped: what they owe us / what we owe them.
export function Parties({ type }: { type: 'customer' | 'supplier' }) {
  const { id } = useParams()
  const nav = useNavigate()
  const customers = useCollection('customers')
  const suppliers = useCollection('suppliers')
  const sales = useCollection('sales')
  const purchases = useCollection('purchases')
  const payments = useCollection('payments')
  const settings = useSettings()
  const isAdmin = useIsAdmin()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'debt'>('all')
  const [form, setForm] = useState<Customer | Supplier | 'new' | null>(null)
  const [pay, setPay] = useState<Customer | Supplier | null>(null)
  const toast = useToast(); const confirm = useConfirm()
  const isC = type === 'customer'
  const base = `/${isC ? 'customers' : 'suppliers'}`

  const rows = useMemo(() => {
    const src = isC ? Array.from(customers.values()) : Array.from(suppliers.values())
    return src.map(p => ({ p, balance: isC ? customerBalance(p as Customer, sales.values(), payments.values()) : supplierBalance(p as Supplier, purchases.values(), payments.values()) }))
      .filter(r => matches(q, r.p.name, r.p.phone, (r.p as Customer).car, r.p.notes)).filter(r => tab === 'all' || r.balance > 0.001)
      .sort((a, b) => b.balance - a.balance || a.p.name.localeCompare(b.p.name, 'ar'))
  }, [customers, suppliers, sales, purchases, payments, q, tab, isC])
  const totalDebt = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const selected = id ? (isC ? customers.get(id) : suppliers.get(id)) : undefined

  const statement = (p: Customer | Supplier) => {
    const lines: { date: number; label: string; debit: number; credit: number; ref?: string; refType?: 'sale' | 'purchase' | 'payment'; id: string }[] = []
    if (isC) for (const s of sales.values()) { if (s.customerId !== p.id) continue; lines.push({ date: s.date, label: `${s.type === 'return' ? 'مرتجع' : 'فاتورة'} ${invoiceNo(s.number)}${s.paid ? ` (مدفوع ${money(s.paid, { currency: false })})` : ''}`, debit: s.type === 'return' ? 0 : s.total - s.paid, credit: s.type === 'return' ? s.total - s.paid : 0, refType: 'sale', id: s.id }) }
    else for (const s of purchases.values()) { if (s.supplierId !== p.id) continue; lines.push({ date: s.date, label: `${s.type === 'return' ? 'مرتجع' : 'شراء'} ${invoiceNo(s.number)}${s.paid ? ` (مدفوع ${money(s.paid, { currency: false })})` : ''}`, debit: s.type === 'return' ? 0 : s.total - s.paid, credit: s.type === 'return' ? s.total - s.paid : 0, refType: 'purchase', id: s.id }) }
    for (const pm of payments.values()) if (pm.partyType === type && pm.partyId === p.id) lines.push({ date: pm.date, label: `${isC ? 'دفعة مستلمة' : 'دفعة مسددة'}${pm.note ? ` — ${pm.note}` : ''}`, debit: 0, credit: pm.amount, refType: 'payment', id: pm.id })
    return lines.sort((a, b) => b.date - a.date)
  }

  return (
    <div className="stack">
      <div className="grid cols-2">
        <Stat label={isC ? 'إجمالي ديون العملاء' : 'إجمالي ما علينا للموردين'} value={money(totalDebt)} icon={<HandCoins />} tone={isC ? 'warning' : 'danger'} />
        <Stat label={isC ? 'عدد العملاء' : 'عدد الموردين'} value={isC ? customers.size : suppliers.size} sub={`${rows.filter(r => r.balance > 0.001).length} عليهم رصيد`} icon={<Phone />} tone="info" />
      </div>
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو الهاتف أو السيارة…" /></div>
        <button className="btn primary" onClick={() => setForm('new')}><Plus /> {isC ? 'عميل جديد' : 'مورد جديد'}</button>
        <button className="btn" onClick={() => exportSheet(isC ? 'العملاء' : 'الموردون', rows.map(r => ({ 'الاسم': r.p.name, 'الهاتف': r.p.phone ?? '', ...(isC ? { 'السيارة': (r.p as Customer).car ?? '' } : {}), 'العنوان': r.p.address ?? '', 'الرصيد': r.balance, 'ملاحظات': r.p.notes ?? '' })))}><FileSpreadsheet /></button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'الكل' }, { id: 'debt', label: isC ? 'عليهم دين' : 'لهم رصيد علينا' }]} />
      <div className="card">
        {rows.length === 0 ? <Empty title={isC ? 'لا عملاء بعد' : 'لا موردين بعد'} text={isC ? 'يمكنك إضافة العميل من هنا أو أثناء البيع' : 'أضف الموردين الذين تشتري منهم البضاعة'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الاسم</th><th className="hide-mobile">الهاتف</th>{isC && <th className="hide-mobile">السيارة</th>}<th className="num">{isC ? 'عليه' : 'له'}</th><th className="actions"></th></tr></thead>
            <tbody>{rows.map(({ p, balance }) => (
              <tr key={p.id} className="click" onClick={() => nav(`${base}/${p.id}`)}>
                <td><div className="bold">{p.name}</div>{p.notes && <div className="small muted">{p.notes}</div>}</td>
                <td className="hide-mobile mono small">{p.phone}</td>
                {isC && <td className="hide-mobile small">{(p as Customer).car}</td>}
                <td className="num">{balance > 0.001 ? <span className="badge tone-danger">{money(balance)}</span> : balance < -0.001 ? <span className="badge tone-success">رصيد له {money(-balance)}</span> : <span className="muted">—</span>}</td>
                <td className="actions" onClick={e => e.stopPropagation()}>{balance > 0.001 && <button className="btn sm" onClick={() => setPay(p)}><HandCoins /> {isC ? 'تحصيل' : 'دفع'}</button>}<button className="btn sm ghost icon" onClick={() => setForm(p)}><Pencil /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {form && (isC ? <CustomerForm initial={form === 'new' ? undefined : (form as Customer)} onClose={() => setForm(null)} /> : <SupplierForm initial={form === 'new' ? undefined : (form as Supplier)} onClose={() => setForm(null)} />)}
      {pay && <PaymentModal type={type} party={pay} balance={rows.find(r => r.p.id === pay.id)?.balance ?? 0} onClose={() => setPay(null)} />}

      {selected && (() => {
        const lines = statement(selected)
        const balance = rows.find(r => r.p.id === selected.id)?.balance ?? (isC ? customerBalance(selected as Customer, sales.values(), payments.values()) : supplierBalance(selected as Supplier, purchases.values(), payments.values()))
        const doPrint = () => printDocument({ type: 'statement', title: isC ? 'كشف حساب عميل' : 'كشف حساب مورد', party: { name: selected.name, phone: selected.phone }, opening: selected.openingBalance, lines: lines.map(l => ({ date: l.date, label: l.label, debit: l.debit, credit: l.credit })), closingLabel: isC ? 'الرصيد المستحق على العميل' : 'الرصيد المستحق للمورد' })
        return (
          <Modal title={selected.name} onClose={() => nav(base)} size="wide" footer={<>
            {balance > 0.001 && <button className="btn primary" onClick={() => setPay(selected)}><HandCoins /> {isC ? 'تحصيل دفعة' : 'تسديد دفعة'}</button>}
            <button className="btn" onClick={doPrint}><Printer /> كشف حساب</button>
            {selected.phone && <a className="btn" href={`https://wa.me/${selected.phone.replace(/\D/g, '').replace(/^0/, '963')}?text=${encodeURIComponent(`مرحباً ${selected.name}،\n${isC ? 'الرصيد المستحق عليكم' : 'الرصيد المستحق لكم'} لدى ${settings.shopName}: ${money(balance)}`)}`} target="_blank" rel="noreferrer"><MessageCircle /></a>}
            <button className="btn" onClick={() => setForm(selected)}><Pencil /> تعديل</button>
          </>}>
            <div className="kv mb">
              {selected.phone && <><dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{selected.phone}</dd></>}
              {(selected as Customer).car && <><dt>السيارة</dt><dd>{(selected as Customer).car}</dd></>}
              {selected.address && <><dt>العنوان</dt><dd>{selected.address}</dd></>}
              <dt>{isC ? 'الرصيد عليه' : 'الرصيد له'}</dt><dd className={balance > 0 ? 'neg-txt bold' : 'pos-txt bold'} style={{ fontSize: 18 }}>{money(balance)}</dd>
            </div>
            {lines.length === 0 ? <Empty title="لا حركات بعد" /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>التاريخ</th><th>البيان</th><th className="num">{isC ? 'عليه' : 'له'}</th><th className="num">{isC ? 'له' : 'عليه'}</th><th></th></tr></thead>
                <tbody>{lines.map(l => (
                  <tr key={l.id} className={l.refType !== 'payment' ? 'click' : ''} onClick={() => { if (l.refType === 'sale') nav(`/sales?open=${l.id}`) }}>
                    <td className="small muted">{fmtDate(l.date)}</td><td>{l.label}</td>
                    <td className="num neg-txt">{l.debit ? money(l.debit, { currency: false }) : ''}</td><td className="num pos-txt">{l.credit ? money(l.credit, { currency: false }) : ''}</td>
                    <td className="actions" onClick={e => e.stopPropagation()}>{l.refType === 'payment' && isAdmin && <button className="btn sm ghost icon" title="حذف الدفعة" onClick={async () => { if (await confirm({ title: 'حذف هذه الدفعة؟', danger: true, okText: 'حذف' })) { await remove('payments', l.id); toast.success('تم الحذف') } }}><Trash2 /></button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
            {selected.openingBalance !== 0 && <div className="small muted mt">رصيد سابق قبل البرنامج: {money(selected.openingBalance)}</div>}
          </Modal>
        )
      })()}
    </div>
  )
}

function PaymentModal({ type, party, balance, onClose }: { type: 'customer' | 'supplier'; party: Customer | Supplier; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState(Math.max(0, balance))
  const [note, setNote] = useState('')
  const [date, setDate] = useState(Date.now())
  const toast = useToast()
  const isC = type === 'customer'
  const save = async () => {
    if (amount <= 0) { toast.error('أدخل المبلغ'); return }
    await addPayment({ date, partyType: type, partyId: party.id, partyName: party.name, amount, note } as Omit<Payment, 'id' | 'updatedAt' | 'userId'>)
    toast.success(isC ? `تم تسجيل تحصيل ${money(amount)}` : `تم تسجيل دفع ${money(amount)}`); onClose()
  }
  return (
    <Modal title={isC ? `تحصيل دفعة من ${party.name}` : `تسديد دفعة إلى ${party.name}`} onClose={onClose} size="narrow" footer={<><button className="btn primary" onClick={save}><HandCoins /> تسجيل</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <div className="between"><span className="muted">{isC ? 'الدين الحالي' : 'المستحق له'}</span><b>{money(balance)}</b></div>
        <Field label="المبلغ"><NumberInput value={amount} onChange={setAmount} lg autoFocus onEnter={save} /></Field>
        <div className="btn-row"><button className="btn sm" onClick={() => setAmount(Math.max(0, balance))}>المبلغ كاملاً</button><button className="btn sm" onClick={() => setAmount(Math.round(Math.max(0, balance) / 2))}>النصف</button></div>
        {amount > balance + 0.001 && <div className="badge tone-info" style={{ alignSelf: 'flex-start' }}>سيصبح له رصيد {money(amount - balance)}</div>}
        <Field label="ملاحظة"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="نقداً، حوالة…" /></Field>
        <Field label="التاريخ"><input type="date" className="input" value={new Date(date).toISOString().slice(0, 10)} onChange={e => { const [y, m, d] = e.target.value.split('-').map(Number); setDate(new Date(y, m - 1, d, 12).getTime()) }} /></Field>
      </div>
    </Modal>
  )
}
