import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Trash2, FileSpreadsheet, Receipt } from 'lucide-react'
import { useCollection, useIsAdmin, useSettings } from '../db/store'
import { addCashEntry, addExpense, remove } from '../db/actions'
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
    if (await confirm({ title: 'حذف هذه الحركة؟', danger: true, okText: 'حذف' })) { await remove(l.ref.type === 'expense' ? 'expenses' : 'cash', l.ref.id); toast.success('تم الحذف') }
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
