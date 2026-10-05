import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Phone, Printer, HandCoins, FileSpreadsheet, MessageCircle, Trash2, Upload } from 'lucide-react'
import { can, putMany, useCollection, useIsAdmin, useSettings, usePerm } from '../db/store'
import { CustomerVehicles } from '../ui/vehicles'
import type { Base, Customer, CurrencyCode, Supplier, Payment } from '../db/types'
import { addPayment, deleteMoneyEntry } from '../db/actions'
import { customerBalance, supplierBalance } from '../lib/calc'
import { convert, CURRENCY_DECIMALS, CURRENCY_SYMBOL, fmtDate, invoiceNo, matches, money, norm, otherCurrency, toInputDate, fromInputDate } from '../lib/format'
import { Empty, Field, NumberInput, SearchInput, Stat, Tabs } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { CustomerForm, SupplierForm } from '../ui/forms'
import { printDocument } from '../print/PrintHost'
import { amountsLookLike, exportSheet, readPartiesFile, type ImportedParty } from '../lib/excel'
import { pickFile } from '../lib/platform'
import { newId } from '../lib/id'

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
  const [imp, setImp] = useState<{ rows: ImportedParty[]; guessed?: string; signKnown: boolean } | null>(null)
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
    for (const pm of payments.values()) if (pm.partyType === type && pm.partyId === p.id) lines.push({ date: pm.date, label: `${pm.amount < 0 ? (isC ? 'رد مبلغ للعميل' : 'استرداد من المورد') : isC ? 'دفعة مستلمة' : 'دفعة مسددة'}${pm.note ? ` — ${pm.note}` : ''}`, debit: pm.amount < 0 ? -pm.amount : 0, credit: pm.amount < 0 ? 0 : pm.amount, refType: 'payment', id: pm.id })
    return lines.sort((a, b) => b.date - a.date)
  }

  const importFile = async () => {
    const f = await pickFile('.xlsx,.xls,.csv')
    if (!f) return
    try {
      const r = await readPartiesFile(f)
      if (!r.rows.length) { toast.error(`لم أجد في الملف أي ${isC ? 'عميل' : 'مورد'}: يجب أن يكون فيه عمود للأسماء`); return }
      setImp(r)
    } catch (e) { toast.error('تعذّر قراءة الملف: ' + (e as Error).message) }
  }

  return (
    <div className="stack">
      {imp && <PartiesImport type={type} {...imp} onClose={() => setImp(null)} />}
      <div className="grid cols-2">
        <Stat label={isC ? 'إجمالي ديون العملاء' : 'إجمالي ما علينا للموردين'} value={money(totalDebt)} icon={<HandCoins />} tone={isC ? 'warning' : 'danger'} />
        <Stat label={isC ? 'عدد العملاء' : 'عدد الموردين'} value={isC ? customers.size : suppliers.size} sub={`${rows.filter(r => r.balance > 0.001).length} عليهم رصيد`} icon={<Phone />} tone="info" />
      </div>
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو الهاتف أو السيارة…" /></div>
        {canEditParty && <button className="btn primary" onClick={() => setForm('new')}><Plus /> {isC ? 'عميل جديد' : 'مورد جديد'}</button>}
        {canEditParty && <button className="btn" onClick={importFile} title={`استيراد ${isC ? 'العملاء' : 'الموردين'} وأرصدتهم من إكسل (من برنامج آخر)`}><Upload /> <span className="hide-mobile">استيراد</span></button>}
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
            {canEditParty && <button className="btn" onClick={() => setForm(selected)}><Pencil /> تعديل</button>}
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
            {isC && <div className="mt"><CustomerVehicles customerId={selected.id} onOpenSale={id => nav(`/sales?open=${id}`)} /></div>}
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

/** Customers or suppliers with their balances from another program's list (exported to Excel). */
function PartiesImport({ type, rows, guessed, signKnown, onClose }: { type: 'customer' | 'supplier'; rows: ImportedParty[]; guessed?: string; signKnown: boolean; onClose: () => void }) {
  const isC = type === 'customer'
  const customers = useCollection('customers')
  const suppliers = useCollection('suppliers')
  const settings = useSettings()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'skip' | 'update'>('skip')
  // a list of suppliers with plain positive balances means what the shop owes them; customers' what they owe
  const [flip, setFlip] = useState(() => !isC && !signKnown && rows.filter(r => r.balance > 0).length >= rows.filter(r => r.balance < 0).length)
  const base = settings.baseCurrency ?? 'SYP'
  const other = otherCurrency(base)
  const [cur, setCur] = useState<CurrencyCode>(() => (amountsLookLike(rows.map(r => r.balance), other) ? other : base))
  const d = 10 ** CURRENCY_DECIMALS[base]
  const toBase = (n: number) => (n ? Math.round(convert(n, cur, base, settings.rate) * d) / d : 0)
  // what the party owes the shop, in the shop's currency (negative: the shop owes them)
  const owes = (r: ImportedParty) => toBase(flip ? -r.balance : r.balance)
  const list = Array.from((isC ? customers : suppliers).values()) as (Customer | Supplier)[]
  const byName = new Map(list.map(p => [norm(p.name), p]))
  const phoneKey = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-9)
  const byPhone = new Map(list.filter(p => phoneKey(p.phone).length === 9).map(p => [phoneKey(p.phone), p]))
  const match = (r: ImportedParty) => byName.get(norm(r.name)) ?? (phoneKey(r.phone).length === 9 ? byPhone.get(phoneKey(r.phone)) : undefined)
  const existing = rows.filter(r => match(r)).length
  const toUs = rows.reduce((t, r) => t + Math.max(0, owes(r)), 0)
  const toThem = rows.reduce((t, r) => t + Math.max(0, -owes(r)), 0)
  // n: what they owe the shop
  const side = (n: number) => (n > 0 ? 'عليه' : n < 0 ? 'له' : '')
  const run = async () => {
    if (!can('customers')) { toast.error('ليس لديك صلاحية'); return }
    if (cur !== base && !(settings.rate > 0)) { toast.error('أدخل سعر الدولار أولاً (من الزر أعلى الشاشة)'); return }
    setBusy(true)
    try {
      const entries: { collection: 'customers' | 'suppliers'; record: Base }[] = []
      const seen = new Map<string, Customer | Supplier>()
      let added = 0, updated = 0
      for (const r of rows) {
        // the shop's own sign: a customer's opening balance is what they owe, a supplier's what the shop owes them
        const opening = isC ? owes(r) : -owes(r)
        const old = seen.get(norm(r.name)) ?? match(r)
        if (old) {
          if (mode === 'skip') continue
          const rec = { ...old, phone: old.phone || r.phone, address: old.address || r.address, notes: old.notes || r.notes, openingBalance: opening, ...(isC ? { car: (old as Customer).car || r.car } : {}) }
          entries.push({ collection: isC ? 'customers' : 'suppliers', record: rec }); seen.set(norm(r.name), rec); updated++
        } else {
          const rec = { id: newId(), updatedAt: 0, name: r.name, phone: r.phone ?? '', address: r.address ?? '', notes: r.notes ?? '', openingBalance: opening, createdAt: Date.now(), ...(isC ? { car: r.car ?? '' } : {}) }
          entries.push({ collection: isC ? 'customers' : 'suppliers', record: rec }); seen.set(norm(r.name), rec as Customer); added++
        }
      }
      await putMany(entries)
      toast.success(`تم الاستيراد: ${added} جديد، ${updated} محدَّث`)
      onClose()
    } catch (e) { toast.error('فشل الاستيراد: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title={`استيراد ${isC ? 'العملاء' : 'الموردين'} وأرصدتهم`} onClose={onClose} size="wide" footer={<><button className="btn primary" onClick={run} disabled={busy || (cur !== base && !(settings.rate > 0))}><Upload /> استيراد {rows.length}</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      {guessed && <div className="card pad tone-warning mb" style={{ padding: '10px 14px' }}>{guessed}</div>}
      <p className="mb">وجدت <b>{rows.length}</b> {isC ? 'عميلاً' : 'مورداً'}، منهم <b>{existing}</b> موجود سابقاً (بنفس الاسم أو الهاتف).
        {' '}{isC ? 'ديون العملاء' : 'ما علينا للموردين'}: <b>{money(isC ? toUs : toThem)}</b>{(isC ? toThem : toUs) > 0 ? <> · {isC ? 'لعملاء عندنا' : 'لنا عند موردين'}: <b>{money(isC ? toThem : toUs)}</b></> : null}</p>
      {existing > 0 && <div className="tabs small mb"><button className={mode === 'skip' ? 'active' : ''} onClick={() => setMode('skip')}>تجاهل الموجودين</button><button className={mode === 'update' ? 'active' : ''} onClick={() => setMode('update')}>تحديث رصيدهم الافتتاحي</button></div>}
      <div className="row mb" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>المبالغ في الملف بـ</span>
        <div className="tabs small">{[base, other].map(c => <button key={c} className={cur === c ? 'active' : ''} onClick={() => setCur(c)}>{CURRENCY_SYMBOL[c]}</button>)}</div>
        {cur !== base && !(settings.rate > 0) && <span className="small" style={{ color: 'var(--danger)' }}>أدخل سعر الدولار أولاً</span>}
        <span className="grow" />
        <label className="row small" style={{ gap: 6, alignItems: 'center' }}><input type="checkbox" checked={flip} onChange={e => setFlip(e.target.checked)} /> عكس الإشارة (إن ظهرت الديون معكوسة)</label>
      </div>
      <p className="help mb">يُسجَّل الرصيد كـ«دين سابق» لكل {isC ? 'عميل' : 'مورد'}، ويظهر في كشف حسابه. راجع أن «عليه» و«له» صحيحان قبل الاستيراد.</p>
      <div className="table-wrap" style={{ maxHeight: 300 }}><table className="table">
        <thead><tr><th>الاسم</th><th>الهاتف</th><th className="num">الرصيد</th><th></th></tr></thead>
        <tbody>{rows.slice(0, 50).map((r, i) => { const n = owes(r); return <tr key={i}><td>{r.name}{match(r) ? <span className="badge tone-muted" style={{ marginInlineStart: 6 }}>موجود</span> : null}</td><td className="mono small" dir="ltr">{r.phone}</td><td className="num">{money(Math.abs(n), { currency: false })}</td><td className="small">{side(n)}</td></tr> })}</tbody>
      </table>{rows.length > 50 && <div className="muted small" style={{ padding: 8 }}>… و{rows.length - 50} آخرين</div>}</div>
    </Modal>
  )
}
