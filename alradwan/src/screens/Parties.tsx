import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Phone, Printer, HandCoins, FileSpreadsheet, MessageCircle, Trash2 } from 'lucide-react'
import { useCollection, useIsAdmin, useSettings, usePerm } from '../db/store'
import type { Customer, Supplier, Payment } from '../db/types'
import { addPayment, deleteMoneyEntry } from '../db/actions'
import { customerBalance, supplierBalance } from '../lib/calc'
import { fmtDate, invoiceNo, matches, money, toInputDate, fromInputDate } from '../lib/format'
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
  const canPay = usePerm('payments'), canEditParty = usePerm('customers')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'debt' | 'overdue'>('all')
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState<Customer | Supplier | 'new' | null>(null)
  const [vinNew, setVinNew] = useState<string | null>(null)
  useEffect(() => { const v = params.get('vin'); if (v) { setVinNew(v); setForm('new'); setParams({}) } }, [params])
  const [pay, setPay] = useState<Customer | Supplier | null>(null)
  const toast = useToast(); const confirm = useConfirm()
  const isC = type === 'customer'
  const base = `/${isC ? 'customers' : 'suppliers'}`

  // the oldest unpaid invoice of each party: a debt older than 30 days is overdue
  const oldestDue = useMemo(() => {
    const m = new Map<string, number>()
    const note = (id: string | undefined, date: number) => { if (id && !(m.has(id) && m.get(id)! < date)) m.set(id, date) }
    if (isC) for (const s of sales.values()) { if (s.type === 'sale' && s.total - s.paid > 0.001) note(s.customerId, s.date) }
    else for (const p of purchases.values()) { if (p.type === 'purchase' && p.total - p.paid > 0.001) note(p.supplierId, p.date) }
    return m
  }, [sales, purchases, isC])
  const overdueDays = (id: string) => { const d = oldestDue.get(id); return d ? Math.floor((Date.now() - d) / 86400000) : 0 }
  const rows = useMemo(() => {
    const src = isC ? Array.from(customers.values()) : Array.from(suppliers.values())
    return src.map(p => ({ p, balance: isC ? customerBalance(p as Customer, sales.values(), payments.values()) : supplierBalance(p as Supplier, purchases.values(), payments.values()) }))
      .filter(r => matches(q, r.p.name, r.p.phone, (r.p as Customer).car, (r.p as Customer).plate, r.p.notes)).filter(r => tab === 'all' || (r.balance > 0.001 && (tab === 'debt' || overdueDays(r.p.id) >= 30)))
      .sort((a, b) => (tab === 'overdue' ? overdueDays(b.p.id) - overdueDays(a.p.id) : b.balance - a.balance) || a.p.name.localeCompare(b.p.name, 'ar'))
  }, [customers, suppliers, sales, purchases, payments, q, tab, isC, oldestDue])
  const totalDebt = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const selected = id ? (isC ? customers.get(id) : suppliers.get(id)) : undefined

  const statement = (p: Customer | Supplier) => {
    const lines: { date: number; label: string; debit: number; credit: number; ref?: string; refType?: 'sale' | 'purchase' | 'payment'; id: string }[] = []
    if (isC) for (const s of sales.values()) { if (s.customerId !== p.id || s.type === 'quote') continue; lines.push({ date: s.date, label: `${s.type === 'return' ? 'مرتجع' : 'فاتورة'} ${invoiceNo(s.number)}${s.paid ? ` (مدفوع ${money(s.paid, { currency: false })})` : ''}`, debit: s.type === 'return' ? 0 : s.total - s.paid, credit: s.type === 'return' ? s.total - s.paid : 0, refType: 'sale', id: s.id }) }
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
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'الكل' }, { id: 'debt', label: isC ? 'عليهم دين' : 'لهم رصيد علينا' }, { id: 'overdue', label: 'ديون متأخرة (+30 يوم)' }]} />
      <div className="card">
        {rows.length === 0 ? <Empty title={isC ? 'لا عملاء بعد' : 'لا موردين بعد'} text={isC ? 'يمكنك إضافة العميل من هنا أو أثناء البيع' : 'أضف الموردين الذين تشتري منهم البضاعة'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الاسم</th><th className="hide-mobile">الهاتف</th>{isC && <th className="hide-mobile">السيارة</th>}<th className="num">{isC ? 'عليه' : 'له'}</th><th className="actions"></th></tr></thead>
            <tbody>{rows.map(({ p, balance }) => (
              <tr key={p.id} className="click" onClick={() => nav(`${base}/${p.id}`)}>
                <td><div className="bold">{p.name}</div>{p.notes && <div className="small muted">{p.notes}</div>}</td>
                <td className="hide-mobile mono small">{p.phone}</td>
                {isC && <td className="hide-mobile small">{(p as Customer).car}</td>}
                <td className="num">{balance > 0.001 ? <span className="badge tone-danger">{money(balance)}</span> : balance < -0.001 ? <span className="badge tone-success">رصيد له {money(-balance)}</span> : <span className="muted">—</span>}{balance > 0.001 && overdueDays(p.id) >= 30 && <div className="small neg-txt">متأخر {overdueDays(p.id)} يوم</div>}</td>
                <td className="actions" onClick={e => e.stopPropagation()}>{balance > 0.001 && canPay && <button className="btn sm" onClick={() => setPay(p)}><HandCoins /> {isC ? 'تحصيل' : 'دفع'}</button>}{balance < -0.001 && canPay && <button className="btn sm ghost" onClick={() => setPay(p)} title={isC ? 'رد الرصيد الزائد للعميل نقداً' : 'استرداد الرصيد الزائد من المورد'}>{isC ? 'رد رصيد' : 'استرداد'}</button>}{canEditParty && <button className="btn sm ghost icon" aria-label="تعديل" onClick={() => setForm(p)}><Pencil /></button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {form && (isC ? <CustomerForm initial={form === 'new' ? (vinNew ? { vin: vinNew } : undefined) : (form as Customer)} onClose={() => { setForm(null); setVinNew(null) }} /> : <SupplierForm initial={form === 'new' ? undefined : (form as Supplier)} onClose={() => setForm(null)} />)}
      {pay && <PaymentModal type={type} party={pay} balance={rows.find(r => r.p.id === pay.id)?.balance ?? 0} onClose={() => setPay(null)} />}

      {selected && (() => {
        const lines = statement(selected)
        const balance = rows.find(r => r.p.id === selected.id)?.balance ?? (isC ? customerBalance(selected as Customer, sales.values(), payments.values()) : supplierBalance(selected as Supplier, purchases.values(), payments.values()))
        const doPrint = () => printDocument({ type: 'statement', title: isC ? 'كشف حساب عميل' : 'كشف حساب مورد', party: { name: selected.name, phone: selected.phone }, opening: selected.openingBalance, lines: lines.map(l => ({ date: l.date, label: l.label, debit: l.debit, credit: l.credit })), closingLabel: isC ? 'الرصيد المستحق على العميل' : 'الرصيد المستحق للمورد' })
        return (
          <Modal title={selected.name} onClose={() => nav(base)} size="wide" footer={<>
            {balance > 0.001 && canPay && <button className="btn primary" onClick={() => setPay(selected)}><HandCoins /> {isC ? 'تحصيل دفعة' : 'تسديد دفعة'}</button>}
            {balance < -0.001 && canPay && <button className="btn" onClick={() => setPay(selected)}><HandCoins /> {isC ? 'رد الرصيد للعميل' : 'استرداد من المورد'}</button>}
            <button className="btn" onClick={doPrint}><Printer /> كشف حساب</button>
            {selected.phone && <a className="btn" href={`https://wa.me/${selected.phone.replace(/\D/g, '').replace(/^0/, '963')}?text=${encodeURIComponent(`مرحباً ${selected.name}،\n${isC ? 'الرصيد المستحق عليكم' : 'الرصيد المستحق لكم'} لدى ${settings.shopName}: ${money(balance)}`)}`} target="_blank" rel="noreferrer"><MessageCircle /></a>}
            <button className="btn" onClick={() => setForm(selected)}><Pencil /> تعديل</button>
          </>}>
            <div className="kv mb">
              {selected.phone && <><dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{selected.phone}</dd></>}
              {(selected as Customer).car && <><dt>السيارة</dt><dd>{(selected as Customer).car}{(selected as Customer).plate ? ` — ${(selected as Customer).plate}` : ''}</dd></>}
              {(selected as Customer).vin && <><dt>الشاصي</dt><dd className="mono">{(selected as Customer).vin}</dd></>}
              {!!(selected as Customer).discountPct && <><dt>خصم دائم</dt><dd>{(selected as Customer).discountPct}%</dd></>}
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
                    <td className="actions" onClick={e => e.stopPropagation()}>{l.refType === 'payment' && isAdmin && <button className="btn sm ghost icon" title="حذف الدفعة" onClick={async () => { if (await confirm({ title: 'حذف هذه الدفعة؟', danger: true, okText: 'حذف' })) { await deleteMoneyEntry('payments', l.id); toast.success('تم الحذف') } }}><Trash2 /></button>}</td>
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
  // a negative balance is money owed back: the same dialog records the refund (stored as a negative payment)
  const refund = balance < -0.001
  const [amount, setAmount] = useState(Math.abs(balance))
  const [note, setNote] = useState('')
  const [date, setDate] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const isC = type === 'customer'
  const save = async () => {
    if (amount <= 0) { toast.error('أدخل المبلغ'); return }
    setBusy(true)
    try {
      await addPayment({ date, partyType: type, partyId: party.id, partyName: party.name, amount: refund ? -amount : amount, note } as Omit<Payment, 'id' | 'updatedAt' | 'userId'>)
      toast.success(refund ? `تم تسجيل رد ${money(amount)}` : isC ? `تم تسجيل تحصيل ${money(amount)}` : `تم تسجيل دفع ${money(amount)}`); onClose()
    } catch (e) { toast.error('تعذّر التسجيل: ' + (e as Error).message) } finally { setBusy(false) }
  }
  const title = refund ? (isC ? `رد رصيد إلى ${party.name}` : `استرداد من ${party.name}`) : isC ? `تحصيل دفعة من ${party.name}` : `تسديد دفعة إلى ${party.name}`
  return (
    <Modal title={title} onClose={onClose} size="narrow" footer={<><button className="btn primary" onClick={save} disabled={busy}><HandCoins /> تسجيل</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <div className="between"><span className="muted">{refund ? (isC ? 'رصيد له عندنا' : 'رصيد لنا عنده') : isC ? 'الدين الحالي' : 'المستحق له'}</span><b>{money(Math.abs(balance))}</b></div>
        <Field label="المبلغ"><NumberInput value={amount} onChange={setAmount} lg autoFocus onEnter={save} /></Field>
        <div className="btn-row"><button className="btn sm" onClick={() => setAmount(Math.abs(balance))}>المبلغ كاملاً</button><button className="btn sm" onClick={() => setAmount(Math.round(Math.max(0, balance) / 2))}>النصف</button></div>
        {!refund && amount > balance + 0.001 && <div className="badge tone-info" style={{ alignSelf: 'flex-start' }}>سيصبح له رصيد {money(amount - balance)}</div>}
        <Field label="ملاحظة"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="نقداً، حوالة…" /></Field>
        <Field label="التاريخ"><input type="date" className="input" value={toInputDate(date)} onChange={e => { if (e.target.value) setDate(fromInputDate(e.target.value, date)) }} /></Field>
      </div>
    </Modal>
  )
}
