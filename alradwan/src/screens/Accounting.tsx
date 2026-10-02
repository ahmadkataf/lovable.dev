import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, FileSpreadsheet, Printer, Plus, Trash2, Scale, TrendingUp, Landmark, Clock, PenLine, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useSettings, useStore } from '../db/store'
import type { JournalEntry, JournalLine } from '../db/types'
import { deleteJournal, saveJournal } from '../db/actions'
import { ACC, FIXED_ACCOUNTS, OPERATIONAL_ACCOUNTS, accountName, accountsOf, agingReport, balanceSheet, buildJournal, expenseAccount, incomeStatement, ledger, trialBalance, type Account, type Entry } from '../lib/accounting'
import { endOfDay, fmtDate, fromInputDate, matches, money, startOfMonth, toInputDate } from '../lib/format'
import { Chips, DateRange, Empty, Field, NumberInput, Stat, Tabs } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { exportSheet } from '../lib/excel'
import { printDocument } from '../print/PrintHost'
import type { ReportTable } from '../print/ReportPrint'

type Tab = 'journal' | 'ledger' | 'trial' | 'income' | 'balance' | 'aging' | 'manual'
type Range = 'month' | 'year' | 'all' | 'custom'

const M = (n: number) => money(n, { display: 'base' })
const Mc = (n: number) => money(n, { display: 'base', currency: false })

/** The books of the shop, derived from its records: nothing here is typed twice. */
export function Accounting() {
  const s = useStore()
  const settings = useSettings()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('income')
  const [range, setRange] = useState<Range>('month')
  const [from, setFrom] = useState(toInputDate(startOfMonth(Date.now())))
  const [to, setTo] = useState(toInputDate(Date.now()))
  const [account, setAccount] = useState<string>(ACC.cash)
  const [q, setQ] = useState('')
  const [newEntry, setNewEntry] = useState(false)
  const toast = useToast(); const confirm = useConfirm()

  const setR = (r: Range) => {
    setRange(r)
    const now = Date.now()
    if (r === 'month') { setFrom(toInputDate(startOfMonth(now))); setTo(toInputDate(now)) }
    if (r === 'year') { const d = new Date(now); d.setMonth(0, 1); setFrom(toInputDate(d.getTime())); setTo(toInputDate(now)) }
    if (r === 'all') { setFrom('2000-01-01'); setTo(toInputDate(now)) }
  }
  const f = fromInputDate(from), t = endOfDay(fromInputDate(to))
  const period = `${fmtDate(f)} — ${fmtDate(t)}`

  const entries = useMemo(() => buildJournal({ products: s.products, customers: s.customers, suppliers: s.suppliers, sales: s.sales, purchases: s.purchases, payments: s.payments, expenses: s.expenses, cash: s.cash, movements: s.movements, journal: s.journal }), [s.version])
  const accounts = useMemo(() => accountsOf(entries, settings.expenseCategories), [entries, settings.expenseCategories])
  const trial = useMemo(() => trialBalance(entries, accounts, f, t), [entries, accounts, f, t])
  const inc = useMemo(() => incomeStatement(entries, f, t), [entries, f, t])
  const bs = useMemo(() => balanceSheet(entries, t), [entries, t])
  const acc = accounts.find(a => a.code === account) ?? FIXED_ACCOUNTS[0]
  const led = useMemo(() => ledger(entries, acc, f, t), [entries, acc, f, t])
  const aging = useMemo(() => agingReport(s.customers, s.sales, s.payments), [s.version])
  const journalRows = useMemo(() => entries.filter(e => e.date >= f && e.date <= t && matches(q, e.memo, ...e.lines.map(l => accountName(l.account, accounts)))).reverse(), [entries, f, t, q, accounts])
  const manual = useMemo(() => Array.from(s.journal.values()).sort((a, b) => b.date - a.date), [s.version])

  const trialTotals = trial.reduce((x, r) => ({ d: x.d + r.debit, c: x.c + r.credit }), { d: 0, c: 0 })
  const agingTotals = aging.reduce((x, r) => { x.total += r.total; r.buckets.forEach((b, i) => (x.b[i] += b)); return x }, { total: 0, b: [0, 0, 0, 0] })

  // every tab can go to Excel or to the printer as the same table
  const table = (): { name: string; table: ReportTable; note?: string } => {
    switch (tab) {
      case 'journal': return { name: 'دفتر اليومية', table: { columns: [{ label: 'التاريخ' }, { label: 'البيان' }, { label: 'الحساب' }, { label: 'مدين', num: true }, { label: 'دائن', num: true }], rows: journalRows.flatMap(e => e.lines.map((l, i) => [i === 0 ? fmtDate(e.date) : '', i === 0 ? e.memo : '', accountName(l.account, accounts), l.debit ? Mc(l.debit) : '', l.credit ? Mc(l.credit) : ''])) } }
      case 'ledger': return { name: `دفتر الأستاذ — ${acc.name}`, table: { columns: [{ label: 'التاريخ' }, { label: 'البيان' }, { label: 'مدين', num: true }, { label: 'دائن', num: true }, { label: 'الرصيد', num: true }], rows: [['', 'رصيد أول المدة', '', '', Mc(led.opening)], ...led.rows.map(r => [fmtDate(r.entry.date), r.entry.memo, r.debit ? Mc(r.debit) : '', r.credit ? Mc(r.credit) : '', Mc(r.balance)])], footer: ['', 'رصيد آخر المدة', Mc(led.rows.reduce((x, r) => x + r.debit, 0)), Mc(led.rows.reduce((x, r) => x + r.credit, 0)), Mc(led.closing)] } }
      case 'trial': return { name: 'ميزان المراجعة', table: { columns: [{ label: 'الرمز' }, { label: 'الحساب' }, { label: 'مدين', num: true }, { label: 'دائن', num: true }, { label: 'الرصيد', num: true }], rows: trial.map(r => [r.account.code, r.account.name, Mc(r.debit), Mc(r.credit), Mc(r.balance)]), footer: ['', 'المجموع', Mc(trialTotals.d), Mc(trialTotals.c), ''] }, note: Math.abs(trialTotals.d - trialTotals.c) < 0.05 ? 'الميزان متوازن: مجموع المدين = مجموع الدائن.' : 'تنبيه: الميزان غير متوازن.' }
      case 'income': return { name: 'قائمة الدخل', table: { columns: [{ label: 'البند' }, { label: 'المبلغ', num: true }], rows: [['المبيعات', Mc(inc.sales)], ['(-) مرتجعات المبيعات', Mc(inc.returns)], ['صافي المبيعات', Mc(inc.netSales)], ['(-) تكلفة البضاعة المباعة', Mc(inc.cogs)], ['مجمل الربح', Mc(inc.grossProfit)], ...inc.expenses.map(e => [`(-) مصاريف: ${e.name}`, Mc(e.amount)]), ['(-) فروقات الجرد', Mc(inc.stockDiff)], ['(+) إيرادات أخرى', Mc(inc.otherIncome)]], footer: ['صافي الربح', Mc(inc.netProfit)] } }
      case 'balance': return { name: 'المركز المالي (الميزانية)', table: { columns: [{ label: 'البند' }, { label: 'المبلغ', num: true }], rows: [['— الأصول —', ''], ['الصندوق', Mc(bs.cash)], ['العملاء (ذمم مدينة)', Mc(bs.receivable)], ['المخزون (بالتكلفة)', Mc(bs.inventory)], ['مجموع الأصول', Mc(bs.totalAssets)], ['— الالتزامات —', ''], ['الموردون (ذمم دائنة)', Mc(bs.payable)], ['مصاريف مستحقة وقروض', Mc(bs.accrued)], ['— حقوق الملكية —', ''], ['رأس المال', Mc(bs.capital)], ['(-) المسحوبات', Mc(bs.drawings)], ['الأرباح المحتجزة', Mc(bs.retained)], ['مجموع حقوق الملكية', Mc(bs.totalEquity)]], footer: ['مجموع الالتزامات وحقوق الملكية', Mc(bs.totalLiabilities + bs.totalEquity)] } }
      case 'aging': return { name: 'أعمار ديون العملاء', table: { columns: [{ label: 'العميل' }, { label: 'الهاتف' }, { label: 'حتى 30 يوم', num: true }, { label: '31–60', num: true }, { label: '61–90', num: true }, { label: 'أكثر من 90', num: true }, { label: 'الإجمالي', num: true }], rows: aging.map(r => [r.name, r.phone ?? '', Mc(r.buckets[0]), Mc(r.buckets[1]), Mc(r.buckets[2]), Mc(r.buckets[3]), Mc(r.total)]), footer: ['المجموع', '', Mc(agingTotals.b[0]), Mc(agingTotals.b[1]), Mc(agingTotals.b[2]), Mc(agingTotals.b[3]), Mc(agingTotals.total)] } }
      case 'manual': return { name: 'القيود اليدوية', table: { columns: [{ label: 'التاريخ' }, { label: 'البيان' }, { label: 'الحساب' }, { label: 'مدين', num: true }, { label: 'دائن', num: true }], rows: manual.flatMap(e => e.lines.map((l, i) => [i === 0 ? fmtDate(e.date) : '', i === 0 ? e.memo : '', accountName(l.account, accounts), l.debit ? Mc(l.debit) : '', l.credit ? Mc(l.credit) : ''])) } }
    }
  }
  const exportExcel = () => { const { name, table: tb } = table(); exportSheet(`${name}-${from}-${to}`, tb.rows.map(r => Object.fromEntries(tb.columns.map((c, i) => [c.label, r[i]]))), name.slice(0, 30)) }
  const print = () => { const { name, table: tb, note } = table(); printDocument({ type: 'report', title: name, subtitle: tab === 'balance' ? `كما في ${fmtDate(t)}` : tab === 'aging' ? `كما في ${fmtDate(Date.now())}` : `الفترة ${period}`, tables: [tb], note }) }

  const delManual = async (j: JournalEntry) => { if (await confirm({ title: 'حذف هذا القيد؟', danger: true, okText: 'حذف' })) { await deleteJournal(j.id); toast.success('تم حذف القيد') } }
  const refOf = (e: Entry) => { if (e.ref?.type === 'sale') nav(`/sales?open=${e.ref.id}`) }

  return (
    <div className="stack">
      <div className="toolbar">
        <Chips value={range} onChange={setR} items={[{ id: 'month', label: 'هذا الشهر' }, { id: 'year', label: 'هذه السنة' }, { id: 'all', label: 'منذ البداية' }, { id: 'custom', label: 'فترة محددة' }]} />
        {range === 'custom' && <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />}
        <span className="spacer" />
        <button className="btn" onClick={exportExcel} title="تصدير إلى إكسل"><FileSpreadsheet /> <span className="hide-mobile">إكسل</span></button>
        <button className="btn" onClick={print} title="طباعة"><Printer /> <span className="hide-mobile">طباعة</span></button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'income', label: 'قائمة الدخل' }, { id: 'balance', label: 'المركز المالي' }, { id: 'trial', label: 'ميزان المراجعة' }, { id: 'ledger', label: 'دفتر الأستاذ' }, { id: 'journal', label: 'دفتر اليومية' }, { id: 'aging', label: 'أعمار الديون' }, { id: 'manual', label: 'قيود يدوية' }]} />

      {tab === 'income' && (
        <div className="stack">
          <div className="grid cols-4 keep2">
            <Stat label="صافي المبيعات" value={M(inc.netSales)} sub={inc.returns ? `بعد مرتجعات ${M(inc.returns)}` : period} icon={<TrendingUp />} />
            <Stat label="مجمل الربح" value={M(inc.grossProfit)} sub={`تكلفة البضاعة ${M(inc.cogs)}`} icon={<Scale />} tone="info" />
            <Stat label="المصاريف" value={M(inc.totalExpenses + inc.stockDiff)} sub={inc.stockDiff ? `منها فروقات جرد ${M(inc.stockDiff)}` : `${inc.expenses.length} بند`} icon={<Clock />} tone="warning" />
            <Stat label="صافي الربح" value={M(inc.netProfit)} sub={period} icon={<Landmark />} tone={inc.netProfit >= 0 ? 'success' : 'danger'} />
          </div>
          <div className="card"><div className="table-wrap"><table className="table">
            <tbody>
              <tr><td>المبيعات</td><td className="num">{M(inc.sales)}</td></tr>
              <tr><td className="muted">(-) مرتجعات المبيعات</td><td className="num">{M(inc.returns)}</td></tr>
              <tr className="bold"><td>صافي المبيعات</td><td className="num">{M(inc.netSales)}</td></tr>
              <tr><td className="muted">(-) تكلفة البضاعة المباعة</td><td className="num">{M(inc.cogs)}</td></tr>
              <tr className="bold"><td>مجمل الربح</td><td className="num">{M(inc.grossProfit)}</td></tr>
              {inc.expenses.map(e => <tr key={e.name}><td className="muted">(-) مصاريف: {e.name}</td><td className="num">{M(e.amount)}</td></tr>)}
              {inc.stockDiff !== 0 && <tr><td className="muted">(-) فروقات الجرد (نقص أو زيادة البضاعة)</td><td className="num">{M(inc.stockDiff)}</td></tr>}
              {inc.otherIncome !== 0 && <tr><td className="muted">(+) إيرادات أخرى</td><td className="num">{M(inc.otherIncome)}</td></tr>}
            </tbody>
            <tfoot><tr><td>صافي الربح</td><td className={`num ${inc.netProfit < 0 ? 'neg-txt' : ''}`} style={{ fontSize: 17 }}>{M(inc.netProfit)}</td></tr></tfoot>
          </table></div></div>
          <div className="small muted">تُحسب تكلفة البضاعة من سعر التكلفة المسجّل على كل قطعة وقت البيع. الفترة: {period}.</div>
        </div>
      )}

      {tab === 'balance' && (
        <div className="stack">
          <div className="small muted">كما في {fmtDate(t)}{bs.balanced ? <span className="badge tone-success" style={{ marginInlineStart: 8 }}><CheckCircle2 size={14} /> الميزانية متوازنة</span> : <span className="badge tone-danger" style={{ marginInlineStart: 8 }}><AlertTriangle size={14} /> غير متوازنة — راجع القيود اليدوية</span>}</div>
          <div className="grid cols-2">
            <div className="card"><div className="table-wrap"><table className="table">
              <thead><tr><th colSpan={2}>الأصول (ما يملكه المحل)</th></tr></thead>
              <tbody>
                <tr className="click" onClick={() => { setAccount(ACC.cash); setTab('ledger') }}><td>الصندوق</td><td className="num">{M(bs.cash)}</td></tr>
                <tr className="click" onClick={() => setTab('aging')}><td>العملاء (ديون لنا)</td><td className="num">{M(bs.receivable)}</td></tr>
                <tr className="click" onClick={() => { setAccount(ACC.inventory); setTab('ledger') }}><td>المخزون بالتكلفة</td><td className="num">{M(bs.inventory)}</td></tr>
              </tbody>
              <tfoot><tr><td>مجموع الأصول</td><td className="num">{M(bs.totalAssets)}</td></tr></tfoot>
            </table></div></div>
            <div className="card"><div className="table-wrap"><table className="table">
              <thead><tr><th colSpan={2}>الالتزامات وحقوق الملكية</th></tr></thead>
              <tbody>
                <tr className="click" onClick={() => nav('/suppliers')}><td>الموردون (ديون علينا)</td><td className="num">{M(bs.payable)}</td></tr>
                {bs.accrued !== 0 && <tr><td>مصاريف مستحقة وقروض</td><td className="num">{M(bs.accrued)}</td></tr>}
                <tr><td>رأس المال</td><td className="num">{M(bs.capital)}</td></tr>
                <tr><td className="muted">(-) مسحوبات صاحب المحل</td><td className="num">{M(bs.drawings)}</td></tr>
                <tr><td>الأرباح المحتجزة (منذ البداية)</td><td className={`num ${bs.retained < 0 ? 'neg-txt' : ''}`}>{M(bs.retained)}</td></tr>
              </tbody>
              <tfoot><tr><td>المجموع</td><td className="num">{M(bs.totalLiabilities + bs.totalEquity)}</td></tr></tfoot>
            </table></div></div>
          </div>
        </div>
      )}

      {tab === 'trial' && (
        <div className="card">
          {trial.length === 0 ? <Empty title="لا حركات في هذه الفترة" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>الرمز</th><th>الحساب</th><th className="num">مدين</th><th className="num">دائن</th><th className="num">الرصيد</th></tr></thead>
              <tbody>{trial.map(r => <tr key={r.account.code} className="click" onClick={() => { setAccount(r.account.code); setTab('ledger') }}><td className="muted mono">{r.account.code}</td><td>{r.account.name}</td><td className="num">{Mc(r.debit)}</td><td className="num">{Mc(r.credit)}</td><td className="num bold">{Mc(r.balance)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={2}>المجموع {Math.abs(trialTotals.d - trialTotals.c) < 0.05 ? <span className="badge tone-success">متوازن</span> : <span className="badge tone-danger">غير متوازن</span>}</td><td className="num">{Mc(trialTotals.d)}</td><td className="num">{Mc(trialTotals.c)}</td><td></td></tr></tfoot>
            </table></div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="stack">
          <div className="toolbar">
            <Field label="الحساب"><select className="input" value={account} onChange={e => setAccount(e.target.value)}>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select></Field>
            <span className="spacer" />
            <div className="row"><span className="muted small">رصيد أول المدة</span><b>{M(led.opening)}</b><span className="muted small">آخر المدة</span><b>{M(led.closing)}</b></div>
          </div>
          <div className="card">
            {led.rows.length === 0 ? <Empty title="لا حركات على هذا الحساب في الفترة" /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>التاريخ</th><th>البيان</th><th className="num">مدين</th><th className="num">دائن</th><th className="num">الرصيد</th></tr></thead>
                <tbody>{led.rows.map(r => <tr key={r.entry.id} className={r.entry.ref?.type === 'sale' ? 'click' : ''} onClick={() => refOf(r.entry)}><td className="muted small">{fmtDate(r.entry.date)}</td><td>{r.entry.memo}</td><td className="num">{r.debit ? Mc(r.debit) : ''}</td><td className="num">{r.credit ? Mc(r.credit) : ''}</td><td className="num bold">{Mc(r.balance)}</td></tr>)}</tbody>
                <tfoot><tr><td colSpan={2}>رصيد آخر المدة ({led.rows.length} حركة)</td><td className="num">{Mc(led.rows.reduce((x, r) => x + r.debit, 0))}</td><td className="num">{Mc(led.rows.reduce((x, r) => x + r.credit, 0))}</td><td className="num">{Mc(led.closing)}</td></tr></tfoot>
              </table></div>
            )}
          </div>
        </div>
      )}

      {tab === 'journal' && (
        <div className="stack">
          <div className="input-wrap"><input className="input" placeholder="بحث في البيان أو اسم الحساب…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="card">
            {journalRows.length === 0 ? <Empty title="لا قيود في هذه الفترة" /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>التاريخ</th><th>البيان</th><th>الحساب</th><th className="num">مدين</th><th className="num">دائن</th></tr></thead>
                <tbody>{journalRows.slice(0, 400).map(e => e.lines.map((l, i) => <tr key={`${e.id}-${i}`} className={e.ref?.type === 'sale' ? 'click' : ''} onClick={() => refOf(e)} style={i === 0 ? { borderTop: '2px solid var(--border)' } : undefined}><td className="muted small">{i === 0 ? fmtDate(e.date) : ''}</td><td>{i === 0 ? e.memo : ''}</td><td className={l.debit ? '' : 'muted'} style={l.debit ? undefined : { paddingInlineStart: 28 }}>{accountName(l.account, accounts)}</td><td className="num">{l.debit ? Mc(l.debit) : ''}</td><td className="num">{l.credit ? Mc(l.credit) : ''}</td></tr>))}</tbody>
              </table></div>
            )}
            {journalRows.length > 400 && <div className="small muted" style={{ padding: 10 }}>تُعرض أول 400 قيد؛ ضيّق الفترة أو استخدم البحث، أو صدّر إلى إكسل للكل.</div>}
          </div>
        </div>
      )}

      {tab === 'aging' && (
        <div className="card">
          {aging.length === 0 ? <Empty title="لا ديون على العملاء" text="كل الفواتير مسددة" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>العميل</th><th className="hide-mobile">الهاتف</th><th className="num">حتى 30 يوم</th><th className="num">31–60</th><th className="num">61–90</th><th className="num">أكثر من 90</th><th className="num">الإجمالي</th></tr></thead>
              <tbody>{aging.map(r => <tr key={r.id} className="click" onClick={() => nav(`/customers/${r.id}`)}><td className="bold">{r.name}<div className="small muted">أقدم دين منذ {r.oldestDays} يوم</div></td><td className="hide-mobile" dir="ltr">{r.phone}</td><td className="num">{r.buckets[0] ? Mc(r.buckets[0]) : ''}</td><td className="num">{r.buckets[1] ? Mc(r.buckets[1]) : ''}</td><td className={`num ${r.buckets[2] ? 'neg-txt' : ''}`}>{r.buckets[2] ? Mc(r.buckets[2]) : ''}</td><td className={`num ${r.buckets[3] ? 'neg-txt' : ''}`}>{r.buckets[3] ? Mc(r.buckets[3]) : ''}</td><td className="num bold">{Mc(r.total)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={2}>المجموع ({aging.length} عميل)</td><td className="num">{Mc(agingTotals.b[0])}</td><td className="num">{Mc(agingTotals.b[1])}</td><td className="num">{Mc(agingTotals.b[2])}</td><td className="num">{Mc(agingTotals.b[3])}</td><td className="num">{Mc(agingTotals.total)}</td></tr></tfoot>
            </table></div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="stack">
          <div className="card pad tone-info small" style={{ padding: '10px 14px' }}><PenLine size={14} style={{ verticalAlign: -2 }} /> القيود اليدوية لما لا تولّده الفواتير تلقائياً: مصروف دفعه صاحب المحل من جيبه، بضاعة تالفة، قرض، إيراد آخر. حركات الصندوق والعملاء والموردين تُسجَّل من شاشاتها.</div>
          <div><button className="btn primary" onClick={() => setNewEntry(true)}><Plus /> قيد جديد</button></div>
          <div className="card">
            {manual.length === 0 ? <Empty title="لا قيود يدوية" icon={<BookOpen />} /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>التاريخ</th><th>البيان</th><th>الحساب</th><th className="num">مدين</th><th className="num">دائن</th><th className="actions"></th></tr></thead>
                <tbody>{manual.map(j => j.lines.map((l, i) => <tr key={`${j.id}-${i}`} style={i === 0 ? { borderTop: '2px solid var(--border)' } : undefined}><td className="muted small">{i === 0 ? fmtDate(j.date) : ''}</td><td>{i === 0 ? j.memo : ''}</td><td className={l.debit ? '' : 'muted'} style={l.debit ? undefined : { paddingInlineStart: 28 }}>{accountName(l.account, accounts)}{l.note ? <div className="small muted">{l.note}</div> : null}</td><td className="num">{l.debit ? Mc(l.debit) : ''}</td><td className="num">{l.credit ? Mc(l.credit) : ''}</td><td className="actions">{i === 0 && <button className="btn sm ghost icon" onClick={() => delManual(j)}><Trash2 /></button>}</td></tr>))}</tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {newEntry && <JournalModal accounts={accounts} onClose={() => setNewEntry(false)} />}
    </div>
  )
}

const TEMPLATES: { label: string; memo: string; lines: (cats: string[]) => { account: string; side: 'debit' | 'credit' }[] }[] = [
  { label: 'مصروف دفعه صاحب المحل من جيبه', memo: 'مصروف مدفوع من جيب صاحب المحل', lines: cats => [{ account: expenseAccount(cats[0] ?? 'أخرى').code, side: 'debit' }, { account: ACC.equity, side: 'credit' }] },
  { label: 'بضاعة تالفة أو مفقودة', memo: 'شطب بضاعة تالفة', lines: () => [{ account: ACC.stockDiff, side: 'debit' }, { account: ACC.inventory, side: 'credit' }] },
  { label: 'مصروف مستحق لم يُدفع بعد', memo: 'مصروف مستحق', lines: cats => [{ account: expenseAccount(cats[0] ?? 'أخرى').code, side: 'debit' }, { account: ACC.accrued, side: 'credit' }] },
  { label: 'إيراد آخر (غير المبيعات)', memo: 'إيراد آخر', lines: () => [{ account: ACC.equity, side: 'debit' }, { account: ACC.otherIncome, side: 'credit' }] },
]

/** A manual entry: a date, a memo and balanced lines; the templates fill the common cases. */
function JournalModal({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const settings = useSettings()
  const toast = useToast()
  const [date, setDate] = useState(toInputDate(Date.now()))
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<JournalLine[]>([{ account: ACC.equity, debit: 0, credit: 0 }, { account: ACC.otherIncome, debit: 0, credit: 0 }])
  const [busy, setBusy] = useState(false)
  const allowed = accounts.filter(a => !OPERATIONAL_ACCOUNTS.includes(a.code))
  const totalD = lines.reduce((t, l) => t + l.debit, 0), totalC = lines.reduce((t, l) => t + l.credit, 0)
  const balanced = Math.abs(totalD - totalC) < 0.005 && totalD > 0
  const set = (i: number, patch: Partial<JournalLine>) => setLines(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const useTemplate = (ti: number) => { const tpl = TEMPLATES[ti]; setMemo(tpl.memo); setLines(tpl.lines(settings.expenseCategories).map(l => ({ account: l.account, debit: 0, credit: 0 }))) }
  const save = async () => {
    if (!memo.trim()) { toast.error('اكتب بيان القيد'); return }
    if (!balanced) { toast.error('القيد غير متوازن: مجموع المدين يجب أن يساوي مجموع الدائن'); return }
    const clean = lines.filter(l => l.debit > 0 || l.credit > 0).map(l => ({ ...l, debit: Math.round(l.debit * 100) / 100, credit: Math.round(l.credit * 100) / 100 }))
    setBusy(true)
    try { await saveJournal({ date: fromInputDate(date, Date.now()), memo: memo.trim(), lines: clean }); toast.success('تم حفظ القيد'); onClose() }
    catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title="قيد محاسبي يدوي" onClose={onClose} size="wide" footer={<><button className="btn primary" disabled={busy || !balanced} onClick={save}>حفظ القيد</button><button className="btn" onClick={onClose}>إلغاء</button><span className="grow" />{balanced ? <span className="badge tone-success">متوازن</span> : <span className="badge tone-warning">الفرق {Mc(Math.abs(totalD - totalC))}</span>}</>}>
      <div className="stack">
        <div className="chips">{TEMPLATES.map((t, i) => <button key={i} className="chip" onClick={() => useTemplate(i)}>{t.label}</button>)}</div>
        <div className="form-grid">
          <Field label="التاريخ"><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="البيان" required><input className="input" value={memo} onChange={e => setMemo(e.target.value)} placeholder="مثال: إيجار شهر آذار دفعه أبو أحمد من جيبه" /></Field>
        </div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>الحساب</th><th className="num">مدين</th><th className="num">دائن</th><th className="actions"></th></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={i}>
              <td><select className="input" value={l.account} onChange={e => set(i, { account: e.target.value })}>{allowed.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}</select></td>
              <td className="num" style={{ width: 150 }}><NumberInput value={l.debit} onChange={v => set(i, { debit: v, credit: v ? 0 : l.credit })} min={0} /></td>
              <td className="num" style={{ width: 150 }}><NumberInput value={l.credit} onChange={v => set(i, { credit: v, debit: v ? 0 : l.debit })} min={0} /></td>
              <td className="actions">{lines.length > 2 && <button className="btn sm ghost icon" onClick={() => setLines(ls => ls.filter((_, k) => k !== i))}><Trash2 /></button>}</td>
            </tr>
          ))}</tbody>
          <tfoot><tr><td>المجموع</td><td className="num">{Mc(totalD)}</td><td className="num">{Mc(totalC)}</td><td></td></tr></tfoot>
        </table></div>
        <div><button className="btn sm" onClick={() => setLines(ls => [...ls, { account: allowed[0]?.code ?? ACC.equity, debit: 0, credit: 0 }])}><Plus /> سطر</button></div>
        <div className="small muted">المدين = ما زاد أو ما صُرف، الدائن = مصدره. لا تُستخدم هنا حسابات الصندوق والعملاء والموردين؛ سجّلها من شاشاتها حتى تبقى الأرصدة متطابقة.</div>
      </div>
    </Modal>
  )
}
