import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, TrendingUp, Wallet, AlertTriangle, Users, Package, Receipt, ArrowLeft, Truck, PlusCircle, Database, Clock } from 'lucide-react'
import { daysSinceBackup } from '../lib/backup'
import { isDesktop } from '../lib/platform'
import { useCanSeeCost, useIsAdmin, useStore } from '../db/store'
import { cashLines, customerBalance, saleProfit, stockMap, sumBetween } from '../lib/calc'
import { addDays, fmtTime, invoiceNo, money, startOfDay, startOfMonth, WEEKDAYS } from '../lib/format'
import { Bars, Empty, Price, Stat } from '../ui/components'

export function Dashboard() {
  const nav = useNavigate()
  const s = useStore()
  const seeCost = useCanSeeCost()
  const isAdmin = useIsAdmin()
  const backupAge = daysSinceBackup()
  const d = useMemo(() => {
    const today = startOfDay(Date.now())
    const monthStart = startOfMonth(Date.now())
    const sales = Array.from(s.sales.values()).filter(x => x.type !== 'quote')
    let todaySales = 0, todayProfit = 0, todayCount = 0, monthSales = 0, monthProfit = 0
    for (const x of sales) {
      const sign = x.type === 'return' ? -1 : 1
      if (x.date >= today) { todaySales += sign * x.total; todayProfit += saleProfit(x); todayCount++ }
      if (x.date >= monthStart) { monthSales += sign * x.total; monthProfit += saleProfit(x) }
    }
    const lines = cashLines(s.sales.values(), s.purchases.values(), s.payments.values(), s.expenses.values(), s.cash.values())
    const cashBalance = lines.reduce((t, l) => t + l.amount, 0)
    const todayCash = sumBetween(lines, today, Date.now())
    const stock = stockMap(s.products, s.movements)
    const low = Array.from(s.products.values()).filter(p => p.kind === 'product' && (stock.get(p.id) ?? 0) <= p.minStock).sort((a, b) => (stock.get(a.id)! - a.minStock) - (stock.get(b.id)! - b.minStock))
    let receivables = 0, overdue = 0
    const oldest = new Map<string, number>()
    for (const x of sales) if (x.type === 'sale' && x.customerId && x.total - x.paid > 0.001 && !(oldest.has(x.customerId) && oldest.get(x.customerId)! < x.date)) oldest.set(x.customerId, x.date)
    for (const c of s.customers.values()) { const b = customerBalance(c, s.sales.values(), s.payments.values()); if (b > 0) { receivables += b; const o = oldest.get(c.id); if (o && Date.now() - o > 30 * 86400000) overdue++ } }
    const week = Array.from({ length: 7 }, (_, i) => { const day = startOfDay(addDays(Date.now(), i - 6)); return { day, label: WEEKDAYS[new Date(day).getDay()], value: 0 } })
    for (const x of sales) { const idx = week.findIndex(w => x.date >= w.day && x.date < w.day + 86400000); if (idx >= 0) week[idx].value += (x.type === 'return' ? -1 : 1) * x.total }
    const recent = sales.sort((a, b) => b.date - a.date).slice(0, 6)
    return { todaySales, todayProfit, todayCount, monthSales, monthProfit, cashBalance, todayCash, low, receivables, overdue, week, recent, stockValue: Array.from(s.products.values()).reduce((t, p) => t + (stock.get(p.id) ?? 0) * p.cost, 0), stock }
  }, [s.version])

  return (
    <div className="stack" style={{ gap: 16 }}>
      {isAdmin && backupAge >= 7 && !isDesktop() && (
        <div className="card pad tone-warning" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Database size={18} />
          <span style={{ flex: 1 }}>{backupAge === Infinity ? 'لم تُؤخذ نسخة احتياطية من هذا الجهاز بعد.' : `آخر نسخة احتياطية قبل ${backupAge} يوماً.`} احفظ نسخة حتى لا تضيع بياناتك إن تعطّل الجهاز.</span>
          <button className="btn sm" onClick={() => nav('/settings?tab=backup')}>نسخة احتياطية الآن</button>
        </div>
      )}
      <div className="btn-row">
        <button className="btn primary lg" onClick={() => nav('/pos')}><ShoppingCart /> بيع جديد</button>
        <button className="btn lg" onClick={() => nav('/purchases?new=1')}><Truck /> شراء بضاعة</button>
        <button className="btn lg" onClick={() => nav('/products?new=1')}><PlusCircle /> إضافة قطعة</button>
      </div>
      <div className="grid cols-4 keep2">
        <Stat label="مبيعات اليوم" value={<Price value={d.todaySales} />} sub={`${d.todayCount} فاتورة`} icon={<ShoppingCart />} tone="accent" onClick={() => nav('/sales')} />
        {seeCost ? <Stat label="ربح اليوم" value={<Price value={d.todayProfit} />} sub={`ربح الشهر ${money(d.monthProfit, { display: 'base' })}`} icon={<TrendingUp />} tone="success" onClick={() => nav('/reports')} />
          : <Stat label="مبيعات الشهر" value={money(d.monthSales)} icon={<TrendingUp />} tone="success" />}
        <Stat label="رصيد الصندوق" value={<Price value={d.cashBalance} />} sub={`حركة اليوم ${d.todayCash >= 0 ? '+' : ''}${money(d.todayCash, { display: 'base' })}`} icon={<Wallet />} tone="info" onClick={() => nav('/cash')} />
        <Stat label="ديون العملاء" value={<Price value={d.receivables} />} sub={d.overdue ? <span className="neg-txt"><Clock size={12} style={{ verticalAlign: -2 }} /> {d.overdue} عميل متأخر أكثر من 30 يوماً</span> : 'مستحقة للمحل'} icon={<Users />} tone="warning" onClick={() => nav('/customers')} />
      </div>
      <div className="grid cols-2">
        <div className="card pad">
          <div className="card-title"><h2>مبيعات آخر 7 أيام</h2><span className="muted small">مبيعات الشهر {money(d.monthSales)}</span></div>
          <Bars data={d.week} format={v => money(v)} />
        </div>
        <div className="card pad">
          <div className="card-title"><h2><AlertTriangle size={18} style={{ verticalAlign: -3, color: 'var(--warning)' }} /> قطع قاربت على النفاد</h2><button className="btn sm ghost" onClick={() => nav('/inventory?low=1')}>الكل <ArrowLeft size={14} /></button></div>
          {d.low.length === 0 ? <Empty title="المخزون بخير" text="لا توجد قطع تحت حد التنبيه" icon={<Package />} /> : (
            <div className="list">
              {d.low.slice(0, 6).map(p => (
                <div key={p.id} className="list-item" style={{ padding: '8px 4px' }}>
                  <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.code}{p.location ? ` — ${p.location}` : ''}</div></div>
                  <span className={`badge ${(d.stock.get(p.id) ?? 0) <= 0 ? 'tone-danger' : 'tone-warning'}`}>{d.stock.get(p.id) ?? 0} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="card pad">
        <div className="card-title"><h2><Receipt size={18} style={{ verticalAlign: -3 }} /> آخر الفواتير</h2><button className="btn sm ghost" onClick={() => nav('/sales')}>الكل <ArrowLeft size={14} /></button></div>
        {d.recent.length === 0 ? <Empty title="لا فواتير بعد" text="ابدأ أول عملية بيع من زر «بيع جديد»" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الرقم</th><th>العميل</th><th>الوقت</th><th className="num">المبلغ</th><th className="hide-mobile">الحالة</th></tr></thead>
            <tbody>{d.recent.map(x => (
              <tr key={x.id} className="click" onClick={() => nav(`/sales?open=${x.id}`)}>
                <td>{invoiceNo(x.number)}{x.type === 'return' && <span className="badge tone-danger" style={{ marginInlineStart: 6 }}>مرتجع</span>}</td>
                <td>{x.customerName}</td><td className="muted">{fmtTime(x.date)}</td>
                <td className="num bold">{money(x.total)}</td>
                <td className="hide-mobile">{x.paid >= x.total ? <span className="badge tone-success">مدفوعة</span> : x.paid > 0 ? <span className="badge tone-warning">جزئي</span> : <span className="badge tone-danger">آجل</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {seeCost && <div className="muted small">قيمة البضاعة في المخزون (بسعر الشراء): <b>{money(d.stockValue)}</b></div>}
    </div>
  )
}
