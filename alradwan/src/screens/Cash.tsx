import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Trash2, FileSpreadsheet, Receipt, Printer } from 'lucide-react'
import { printDocument } from '../print/PrintHost'
import { saleProfit } from '../lib/calc'
import { useCollection, useIsAdmin, useSettings, useCanSeeCost } from '../db/store'
import { addCashEntry, addExpense, deleteMoneyEntry } from '../db/actions'
import { cashLines, sumBetween } from '../lib/calc'
import { addDays, endOfDay, fmtDateTime, fromInputDate, money, startOfDay, startOfMonth, toInputDate } from '../lib/format'
import { DateRange, Empty, Field, NumberInput, Stat, Tabs } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { exportSheet } from '../lib/excel'

export function Cash() {
  const sales = useCollection('sales'); const purchases = useCollection('purchases'); const payments = useCollection('payments'); const expenses = useCollection('expenses'); const cash = useCollection('cash')
  const settings = useSettings()
  const isAdmin = useIsAdmin()
  const seeCost = useCanSeeCost()
  const users = useCollection('users')
  const nav = useNavigate()
  const [tab, setTab] = useState<'all' | 'expenses'>('all')
  const [from, setFrom] = useState(toInputDate(addDays(Date.now(), -7)))
  const [to, setTo] = useState(toInputDate(Date.now()))
  const [modal, setModal] = useState<'expense' | 'in' | 'out' | null>(null)
  const toast = useToast(); const confirm = useConfirm()

  const lines = useMemo(() => cashLines(sales.values(), purchases.values(), payments.values(), expenses.values(), cash.values()), [sales, purchases, payments, expenses, cash])
  const balance = lines.reduce((s, l) => s + l.amount, 0)
  const today = sumBetween(lines, startOfDay(Date.now()), Date.now())
  const monthExpenses = Array.from(expenses.values()).filter(e => e.date >= startOfMonth(Date.now())).reduce((s, e) => s + e.amount, 0)
  const f = fromInputDate(from), t = endOfDay(fromInputDate(to))
  const period = lines.filter(l => l.date >= f && l.date <= t).filter(l => tab === 'all' || l.kind === 'مصروف')
  const pin = period.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0)
  const pout = period.filter(l => l.amount < 0).reduce((s, l) => s - l.amount, 0)

  const del = async (l: (typeof period)[number]) => {
    if (!l.ref || (l.ref.type !== 'expense' && l.ref.type !== 'cash')) return
    if (await confirm({ title: 'حذف هذه الحركة؟', danger: true, okText: 'حذف' })) { await deleteMoneyEntry(l.ref.type === 'expense' ? 'expenses' : 'cash', l.ref.id); toast.success('تم الحذف') }
  }

  /** The closing sheet of the chosen period, printed. */
  const printDaily = () => {
    const S = Array.from(sales.values()).filter(s => s.date >= f && s.date <= t)
    const P = Array.from(purchases.values()).filter(p => p.date >= f && p.date <= t)
    const pay = Array.from(payments.values()).filter(p => p.date >= f && p.date <= t)
    const ex = Array.from(expenses.values()).filter(e => e.date >= f && e.date <= t)
    const cs = Array.from(cash.values()).filter(c => c.date >= f && c.date <= t)
    const sold = S.filter(s => s.type === 'sale'), returns = S.filter(s => s.type === 'return')
    const byExp = new Map<string, number>(); for (const e of ex) byExp.set(e.category, (byExp.get(e.category) ?? 0) + e.amount)
    const byUser = new Map<string, { name: string; count: number; total: number }>()
    for (const s of sold) { const k = s.userId ?? '_'; const u = byUser.get(k) ?? { name: k === '_' ? 'بدون مستخدم' : users.get(k)?.name ?? 'مستخدم محذوف', count: 0, total: 0 }; u.count++; u.total += s.total; byUser.set(k, u) }
    const items = new Map<string, { name: string; qty: number; total: number }>()
    for (const s of sold) for (const i of s.items) { const k = i.productId ?? i.name; const x = items.get(k) ?? { name: i.name, qty: 0, total: 0 }; x.qty += i.qty; x.total += i.qty * i.price - i.discount; items.set(k, x) }
    const opening = lines.filter(l => l.date < f).reduce((s, l) => s + l.amount, 0)
    const closing = lines.filter(l => l.date <= t).reduce((s, l) => s + l.amount, 0)
    printDocument({ type: 'daily', from: f, to: t,
      sales: { count: sold.length, total: sold.reduce((s, x) => s + x.total, 0), cash: sold.reduce((s, x) => s + x.paid, 0), credit: sold.reduce((s, x) => s + (x.total - x.paid), 0), returns: returns.reduce((s, x) => s + x.paid, 0), profit: seeCost ? S.reduce((s, x) => s + saleProfit(x), 0) : undefined },
      purchases: { count: P.filter(p => p.type === 'purchase').length, total: P.reduce((s, p) => s + (p.type === 'return' ? -p.total : p.total), 0), paid: P.reduce((s, p) => s + (p.type === 'return' ? -p.paid : p.paid), 0) },
      collected: pay.filter(p => p.partyType === 'customer').reduce((s, p) => s + p.amount, 0), paidOut: pay.filter(p => p.partyType === 'supplier').reduce((s, p) => s + p.amount, 0),
      expenses: Array.from(byExp.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      cashIn: cs.filter(c => c.direction === 'in').reduce((s, c) => s + c.amount, 0), cashOut: cs.filter(c => c.direction === 'out').reduce((s, c) => s + c.amount, 0),
      opening, closing, byUser: Array.from(byUser.values()).sort((a, b) => b.total - a.total), topItems: Array.from(items.values()).sort((a, b) => b.total - a.total).slice(0, 10) })
  }

  return (
    <div className="stack">
      <div className="grid cols-4 keep2">
        <Stat label="رصيد الصندوق الآن" value={money(balance)} icon={<Wallet />} tone="info" />
        <Stat label="حركة اليوم" value={`${today >= 0 ? '+' : ''}${money(today)}`} icon={today >= 0 ? <ArrowDownCircle /> : <ArrowUpCircle />} tone={today >= 0 ? 'success' : 'danger'} />
        <Stat label="مصاريف هذا الشهر" value={money(monthExpenses)} icon={<Receipt />} tone="warning" onClick={() => setTab('expenses')} />
        <Stat label="داخل / خارج (الفترة)" value={<span className="small"><span className="pos-txt">+{money(pin, { currency: false })}</span> / <span className="neg-txt">−{money(pout, { currency: false })}</span></span>} icon={<Wallet />} tone="accent" />
      </div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setModal('expense')}><Plus /> مصروف</button>
        <button className="btn" onClick={() => setModal('in')}><ArrowDownCircle /> إيداع في الصندوق</button>
        <button className="btn" onClick={() => setModal('out')}><ArrowUpCircle /> سحب من الصندوق</button>
        <button className="btn" onClick={printDaily} title="طباعة تقرير إغلاق الفترة"><Printer /> <span className="hide-mobile">تقرير الإغلاق</span></button>
        <span className="spacer" />
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
        <button className="btn" onClick={() => exportSheet(`حركة-الصندوق-${from}-${to}`, period.map(l => ({ 'التاريخ': fmtDateTime(l.date), 'النوع': l.kind, 'البيان': l.label, 'داخل': l.amount > 0 ? l.amount : '', 'خارج': l.amount < 0 ? -l.amount : '' })), 'الصندوق')}><FileSpreadsheet /></button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'كل الحركات' }, { id: 'expenses', label: 'المصاريف فقط' }]} />
      <div className="card">
        {period.length === 0 ? <Empty title="لا حركات في هذه الفترة" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th className="num">داخل</th><th className="num">خارج</th><th className="actions"></th></tr></thead>
            <tbody>{period.map((l, i) => (
              <tr key={i} className={l.ref?.type === 'sale' ? 'click' : ''} onClick={() => { if (l.ref?.type === 'sale') nav(`/sales?open=${l.ref.id}`) }}>
                <td className="small muted">{fmtDateTime(l.date)}</td><td><span className={`badge ${l.amount > 0 ? 'tone-success' : l.kind === 'مصروف' ? 'tone-warning' : 'tone-danger'}`}>{l.kind}</span></td><td>{l.label}</td>
                <td className="num pos-txt bold">{l.amount > 0 ? money(l.amount, { currency: false }) : ''}</td><td className="num neg-txt bold">{l.amount < 0 ? money(-l.amount, { currency: false }) : ''}</td>
                <td className="actions" onClick={e => e.stopPropagation()}>{isAdmin && (l.ref?.type === 'expense' || l.ref?.type === 'cash') && <button className="btn sm ghost icon" onClick={() => del(l)}><Trash2 /></button>}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={3}>المجموع</td><td className="num pos-txt">{money(pin, { currency: false })}</td><td className="num neg-txt">{money(pout, { currency: false })}</td><td></td></tr></tfoot>
          </table></div>
        )}
      </div>
      {modal && <CashModal kind={modal} categories={settings.expenseCategories} onClose={() => setModal(null)} />}
    </div>
  )
}

function CashModal({ kind, categories, onClose }: { kind: 'expense' | 'in' | 'out'; categories: string[]; onClose: () => void }) {
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState(categories[0] ?? 'أخرى')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(toInputDate(Date.now()))
  const toast = useToast()
  const titles = { expense: 'تسجيل مصروف', in: 'إيداع في الصندوق', out: 'سحب من الصندوق' }
  const save = async () => {
    if (amount <= 0) { toast.error('أدخل المبلغ'); return }
    const d = toInputDate(Date.now()) === date ? Date.now() : fromInputDate(date)
    if (kind === 'expense') await addExpense({ date: d, category, amount, note }); else await addCashEntry({ date: d, direction: kind, amount, note })
    toast.success('تم التسجيل'); onClose()
  }
  return (
    <Modal title={titles[kind]} onClose={onClose} size="narrow" footer={<><button className="btn primary" onClick={save}>حفظ</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        {kind === 'expense' && <Field label="نوع المصروف"><div className="chips">{categories.map(c => <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div></Field>}
        <Field label="المبلغ"><NumberInput value={amount} onChange={setAmount} lg autoFocus onEnter={save} /></Field>
        <Field label={kind === 'expense' ? 'البيان' : 'السبب'}><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder={kind === 'expense' ? 'مثال: فاتورة الكهرباء لشهر 5' : kind === 'in' ? 'مثال: رأس مال إضافي' : 'مثال: مصروف شخصي لصاحب المحل'} /></Field>
        <Field label="التاريخ"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
