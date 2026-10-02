import { useMemo, useState } from 'react'
import { TrendingUp, ShoppingCart, Receipt, Package, FileSpreadsheet, Users, Wallet } from 'lucide-react'
import { useCollection } from '../db/store'
import { customerBalance, saleProfit, stockMap, supplierBalance } from '../lib/calc'
import { addDays, endOfDay, fmtDate, fromInputDate, money, num, startOfMonth, toInputDate, MONTHS } from '../lib/format'
import { Bars, Chips, DateRange, Empty, Stat, Tabs } from '../ui/components'
import { exportSheet } from '../lib/excel'

type Range = 'today' | 'week' | 'month' | 'year' | 'custom'

export function Reports() {
  const sales = useCollection('sales'); const purchases = useCollection('purchases'); const expenses = useCollection('expenses'); const products = useCollection('products'); const movements = useCollection('movements'); const customers = useCollection('customers'); const suppliers = useCollection('suppliers'); const payments = useCollection('payments'); const users = useCollection('users')
  const [range, setRange] = useState<Range>('month')
  const [from, setFrom] = useState(toInputDate(startOfMonth(Date.now())))
  const [to, setTo] = useState(toInputDate(Date.now()))
  const [tab, setTab] = useState<'summary' | 'products' | 'customers' | 'expenses' | 'months'>('summary')

  const setR = (r: Range) => {
    setRange(r)
    const now = Date.now()
    if (r === 'today') { setFrom(toInputDate(now)); setTo(toInputDate(now)) }
    if (r === 'week') { setFrom(toInputDate(addDays(now, -6))); setTo(toInputDate(now)) }
    if (r === 'month') { setFrom(toInputDate(startOfMonth(now))); setTo(toInputDate(now)) }
    if (r === 'year') { const d = new Date(now); d.setMonth(0, 1); setFrom(toInputDate(d.getTime())); setTo(toInputDate(now)) }
  }
  const f = fromInputDate(from), t = endOfDay(fromInputDate(to))

  const r = useMemo(() => {
    const inRange = (d: number) => d >= f && d <= t
    const S = Array.from(sales.values()).filter(s => inRange(s.date) && s.type !== 'quote')
    let revenue = 0, profit = 0, returns = 0, count = 0, discount = 0
    const byProduct = new Map<string, { name: string; code?: string; qty: number; revenue: number; profit: number }>()
    const byCustomer = new Map<string, { name: string; count: number; revenue: number }>()
    const byUser = new Map<string, { count: number; revenue: number }>()
    for (const s of S) {
      const sign = s.type === 'return' ? -1 : 1
      if (s.type === 'return') returns += s.total; else { revenue += s.total; count++; discount += s.discount }
      profit += saleProfit(s)
      for (const it of s.items) {
        const k = it.productId ?? it.name
        const e = byProduct.get(k) ?? { name: it.name, code: it.code, qty: 0, revenue: 0, profit: 0 }
        e.qty += sign * it.qty; e.revenue += sign * (it.qty * it.price - it.discount); e.profit += sign * ((it.price - it.cost) * it.qty - it.discount)
        byProduct.set(k, e)
      }
      const ck = s.customerId ?? '_walkin'
      const c = byCustomer.get(ck) ?? { name: s.customerId ? s.customerName : 'زبائن نقديون', count: 0, revenue: 0 }
      c.count += sign; c.revenue += sign * s.total; byCustomer.set(ck, c)
      const uk = s.userId ?? '_'
      const u = byUser.get(uk) ?? { count: 0, revenue: 0 }; u.count += sign; u.revenue += sign * s.total; byUser.set(uk, u)
    }
    const P = Array.from(purchases.values()).filter(p => inRange(p.date))
    const purchaseTotal = P.reduce((s, p) => s + (p.type === 'return' ? -p.total : p.total), 0)
    const E = Array.from(expenses.values()).filter(e => inRange(e.date))
    const expenseTotal = E.reduce((s, e) => s + e.amount, 0)
    const byExpense = new Map<string, number>()
    for (const e of E) byExpense.set(e.category, (byExpense.get(e.category) ?? 0) + e.amount)
    const stock = stockMap(products, movements)
    let stockValue = 0, stockRetail = 0
    for (const p of products.values()) { const q = stock.get(p.id) ?? 0; stockValue += q * p.cost; stockRetail += q * p.price }
    let receivables = 0, payables = 0
    for (const c of customers.values()) { const b = customerBalance(c, sales.values(), payments.values()); if (b > 0) receivables += b }
    for (const s of suppliers.values()) { const b = supplierBalance(s, purchases.values(), payments.values()); if (b > 0) payables += b }
    // sales by day inside the range (up to 31 bars) or by month
    const days = Math.round((t - f) / 86400000) + 1
    const series: { label: string; value: number }[] = []
    if (days <= 31) for (let i = 0; i < days; i++) { const d0 = fromInputDate(from) + i * 86400000; series.push({ label: String(new Date(d0).getDate()), value: S.filter(s => s.date >= d0 && s.date < d0 + 86400000).reduce((x, s) => x + (s.type === 'return' ? -s.total : s.total), 0) }) }
    else { const m = new Map<string, number>(); for (const s of S) { const d = new Date(s.date); const k = `${d.getFullYear()}-${d.getMonth()}`; m.set(k, (m.get(k) ?? 0) + (s.type === 'return' ? -s.total : s.total)) } for (const [k, v] of Array.from(m.entries()).sort()) series.push({ label: MONTHS[Number(k.split('-')[1])].split(' ')[0], value: v }) }
    // last 12 months table
    const months: { label: string; sales: number; profit: number; expenses: number; purchases: number }[] = []
    for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); const a = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); const b = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); const ms = Array.from(sales.values()).filter(s => s.date >= a && s.date < b && s.type !== 'quote'); months.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, sales: ms.reduce((x, s) => x + (s.type === 'return' ? -s.total : s.total), 0), profit: ms.reduce((x, s) => x + saleProfit(s), 0), expenses: Array.from(expenses.values()).filter(e => e.date >= a && e.date < b).reduce((x, e) => x + e.amount, 0), purchases: Array.from(purchases.values()).filter(p => p.date >= a && p.date < b).reduce((x, p) => x + (p.type === 'return' ? -p.total : p.total), 0) }) }
    return { revenue, profit, returns, count, discount, purchaseTotal, expenseTotal, net: profit - expenseTotal, byProduct: Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue), byCustomer: Array.from(byCustomer.values()).sort((a, b) => b.revenue - a.revenue), byExpense: Array.from(byExpense.entries()).sort((a, b) => b[1] - a[1]), byUser, stockValue, stockRetail, receivables, payables, series, months }
  }, [sales, purchases, expenses, products, movements, customers, suppliers, payments, f, t, from])

  const title = `${fmtDate(f)} — ${fmtDate(t)}`
  return (
    <div className="stack">
      <div className="toolbar">
        <Chips value={range} onChange={setR} items={[{ id: 'today', label: 'اليوم' }, { id: 'week', label: 'آخر 7 أيام' }, { id: 'month', label: 'هذا الشهر' }, { id: 'year', label: 'هذه السنة' }, { id: 'custom', label: 'فترة محددة' }]} />
        {range === 'custom' && <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />}
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'summary', label: 'الملخص' }, { id: 'products', label: 'الأكثر مبيعاً' }, { id: 'customers', label: 'العملاء' }, { id: 'expenses', label: 'المصاريف' }, { id: 'months', label: 'شهرياً' }]} />

      {tab === 'summary' && <>
        <div className="grid cols-4 keep2">
          <Stat label="المبيعات" value={money(r.revenue)} sub={`${r.count} فاتورة${r.returns ? ` · مرتجعات ${money(r.returns)}` : ''}`} icon={<ShoppingCart />} tone="accent" />
          <Stat label="ربح المبيعات" value={money(r.profit)} sub={r.revenue ? `هامش ${num((r.profit / r.revenue) * 100, 1)}%` : undefined} icon={<TrendingUp />} tone="success" />
          <Stat label="المصاريف" value={money(r.expenseTotal)} icon={<Receipt />} tone="warning" />
          <Stat label="صافي الربح" value={money(r.net)} sub="ربح المبيعات − المصاريف" icon={<Wallet />} tone={r.net >= 0 ? 'info' : 'danger'} />
        </div>
        <div className="card pad"><div className="card-title"><h2>المبيعات — {title}</h2></div>{r.series.length ? <Bars data={r.series} format={v => money(v)} /> : <Empty title="لا مبيعات" />}</div>
        <div className="grid cols-2">
          <div className="card pad"><div className="card-title"><h2>الوضع الحالي</h2></div>
            <dl className="kv">
              <dt>قيمة المخزون (بالكلفة)</dt><dd>{money(r.stockValue)}</dd>
              <dt>قيمة المخزون (بسعر البيع)</dt><dd>{money(r.stockRetail)}</dd>
              <dt>ديون العملاء (لنا)</dt><dd className="neg-txt">{money(r.receivables)}</dd>
              <dt>ديون الموردين (علينا)</dt><dd className="neg-txt">{money(r.payables)}</dd>
              <dt>مشتريات الفترة</dt><dd>{money(r.purchaseTotal)}</dd>
              <dt>خصومات ممنوحة</dt><dd>{money(r.discount)}</dd>
            </dl>
          </div>
          <div className="card pad"><div className="card-title"><h2>المبيعات حسب الموظف</h2></div>
            {r.byUser.size === 0 ? <Empty title="لا مبيعات" /> : <dl className="kv">{Array.from(r.byUser.entries()).map(([k, v]) => <><dt key={k + 'a'}>{k === '_' ? 'بدون مستخدم' : users.get(k)?.name ?? 'مستخدم محذوف'}</dt><dd key={k + 'b'}>{money(v.revenue)} <span className="muted small">({v.count} فاتورة)</span></dd></>)}</dl>}
          </div>
        </div>
      </>}

      {tab === 'products' && <div className="card">
        <div className="card-title" style={{ padding: '14px 14px 0' }}><h2><Package size={18} style={{ verticalAlign: -3 }} /> الأكثر مبيعاً — {title}</h2><button className="btn sm" onClick={() => exportSheet('الأكثر-مبيعاً', r.byProduct.map(p => ({ 'الكود': p.code ?? '', 'القطعة': p.name, 'الكمية': p.qty, 'المبيعات': p.revenue, 'الربح': p.profit })))}><FileSpreadsheet /> إكسل</button></div>
        {r.byProduct.length === 0 ? <Empty title="لا مبيعات في هذه الفترة" /> : <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>القطعة</th><th className="num">الكمية</th><th className="num">المبيعات</th><th className="num">الربح</th></tr></thead>
          <tbody>{r.byProduct.slice(0, 100).map((p, i) => <tr key={i}><td className="muted">{i + 1}</td><td><div className="bold">{p.name}</div><div className="small muted">{p.code}</div></td><td className="num">{num(p.qty, 2)}</td><td className="num bold">{money(p.revenue)}</td><td className={`num ${p.profit >= 0 ? 'pos-txt' : 'neg-txt'}`}>{money(p.profit)}</td></tr>)}</tbody></table></div>}
      </div>}

      {tab === 'customers' && <div className="card">
        <div className="card-title" style={{ padding: '14px 14px 0' }}><h2><Users size={18} style={{ verticalAlign: -3 }} /> أفضل العملاء — {title}</h2></div>
        {r.byCustomer.length === 0 ? <Empty title="لا مبيعات" /> : <div className="table-wrap"><table className="table"><thead><tr><th>#</th><th>العميل</th><th className="num">الفواتير</th><th className="num">المبيعات</th></tr></thead>
          <tbody>{r.byCustomer.slice(0, 100).map((c, i) => <tr key={i}><td className="muted">{i + 1}</td><td className="bold">{c.name}</td><td className="num">{c.count}</td><td className="num bold">{money(c.revenue)}</td></tr>)}</tbody></table></div>}
      </div>}

      {tab === 'expenses' && <div className="card pad">
        <div className="card-title"><h2>المصاريف حسب النوع — {title}</h2><b>{money(r.expenseTotal)}</b></div>
        {r.byExpense.length === 0 ? <Empty title="لا مصاريف" /> : <div className="stack">{r.byExpense.map(([k, v]) => <div key={k}><div className="between"><span>{k}</span><b>{money(v)}</b></div><div className="progress"><i style={{ width: `${(v / r.expenseTotal) * 100}%` }} /></div></div>)}</div>}
      </div>}

      {tab === 'months' && <div className="card">
        <div className="card-title" style={{ padding: '14px 14px 0' }}><h2>آخر 12 شهراً</h2><button className="btn sm" onClick={() => exportSheet('تقرير-شهري', r.months.map(m => ({ 'الشهر': m.label, 'المبيعات': m.sales, 'ربح المبيعات': m.profit, 'المشتريات': m.purchases, 'المصاريف': m.expenses, 'صافي الربح': m.profit - m.expenses })))}><FileSpreadsheet /> إكسل</button></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>الشهر</th><th className="num">المبيعات</th><th className="num">ربح المبيعات</th><th className="num hide-mobile">المشتريات</th><th className="num">المصاريف</th><th className="num">الصافي</th></tr></thead>
          <tbody>{r.months.map(m => <tr key={m.label}><td>{m.label}</td><td className="num">{money(m.sales, { currency: false })}</td><td className="num pos-txt">{money(m.profit, { currency: false })}</td><td className="num hide-mobile">{money(m.purchases, { currency: false })}</td><td className="num neg-txt">{money(m.expenses, { currency: false })}</td><td className={`num bold ${m.profit - m.expenses >= 0 ? 'pos-txt' : 'neg-txt'}`}>{money(m.profit - m.expenses, { currency: false })}</td></tr>)}</tbody></table></div>
      </div>}
    </div>
  )
}
