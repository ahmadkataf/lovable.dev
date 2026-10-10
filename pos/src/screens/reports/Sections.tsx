// The breakdown cards of the report: top products, categories, payment methods, cashiers, customers, debts,
// low stock, expenses by category and the peak-hours heat table. Each card exports its rows as CSV.
import { useState, type ReactNode } from 'react'
import { Download, Trophy, Layers, UserRound, Users, HandCoins, CreditCard, TriangleAlert, Wallet, Flame, ChevronDown, ChevronUp } from 'lucide-react'
import type { Customer, CurrencySettings, PaymentMethod, Product } from '../../db/types'
import { t, useT } from '../../i18n'
import { Badge, Button, Seg, colorFor } from '../../components/ui'
import { formatMoney, formatQty } from '../../lib/money'
import { formatWeekday, toDateInput, addDays } from '../../lib/format'
import { saveCsv } from '../../lib/csv'
import { shortNumber, type MethodStat, type Range } from '../../lib/reports'
import { toast, useSettings } from '../../state/store'
import { isBuiltinCategory } from '../expenses/logic'
import '../expenses/i18n'
import type { Report } from './logic'

type CsvRows = (string | number | null | undefined)[][]

/** Saves a CSV and tells the user; a cancelled picker is silent. */
export async function exportCsv(name: string, rows: CsvRows): Promise<void> {
  try { if (await saveCsv(name, rows)) toast(t('reports.exported'), 'success') } catch { toast(t('reports.exportFailed'), 'error') }
}

export function methodLabel(m: PaymentMethod): string {
  return t(m === 'cash' ? 'common.cash' : m === 'card' ? 'common.card' : m === 'transfer' ? 'common.transfer' : 'common.credit')
}
/** 'kg' → 'كغ'; free text stays as typed. */
function unitLabel(unit: string): string {
  if (!unit) return ''
  const v = t('unit.' + unit)
  return v === 'unit.' + unit ? unit : v
}
const expenseCatLabel = (cat: string): string => (isBuiltinCategory(cat) ? t('expenses.cat.' + cat) : cat)
const pct = (share: number): string => `${Math.round(share * 100)}%`
const SUNDAY = new Date(2023, 0, 1).getTime()
const WEEK = [6, 0, 1, 2, 3, 4, 5]        // Saturday starts the week (lib/format.startOfWeek)
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/* ---------- building blocks ---------- */

function Section({ title, icon, onExport, children, wide, action }: { title: string; icon: ReactNode; onExport?: () => Promise<void>; children: ReactNode; wide?: boolean; action?: ReactNode }) {
  const tt = useT()
  return (
    <div className={`card pad rp-section ${wide ? 'wide' : ''}`}>
      <div className="rp-section-head">
        <h3>{icon}<span className="truncate">{title}</span></h3>
        {action}
        {onExport && <Button variant="ghost" iconOnly icon={<Download size={18} />} onClick={() => void onExport()} title={tt('common.export')} aria-label={tt('common.export')} />}
      </div>
      {children}
    </div>
  )
}

function NoData({ text }: { text?: string }) {
  const tt = useT()
  return <p className="faint small center rp-none">{text ?? tt('reports.noData')}</p>
}

export interface RankRow { key: string; label: ReactNode; sub?: ReactNode; value: string; valueSub?: ReactNode; bar: number; color?: string }

/** Ranked rows: #, a name over a share bar, the value at the end; long lists fold after `limit`. */
export function RankList({ rows, limit = 10 }: { rows: RankRow[]; limit?: number }) {
  const tt = useT()
  const [all, setAll] = useState(false)
  if (!rows.length) return <NoData />
  let max = 0
  for (const r of rows) if (r.bar > max) max = r.bar
  const shown = all ? rows : rows.slice(0, limit)
  return (
    <div className="rp-rank">
      {shown.map((r, i) => (
        <div key={r.key} className="rp-rank-row">
          <span className="rp-rank-n num">{i + 1}</span>
          <span className="rp-rank-main">
            <span className="rp-rank-label truncate">{r.label}</span>
            <span className="rp-rank-bar"><span style={{ width: `${max > 0 ? Math.max(2, (r.bar / max) * 100) : 2}%`, background: r.color }} /></span>
            {r.sub && <span className="rp-rank-sub">{r.sub}</span>}
          </span>
          <span className="rp-rank-val"><span className="num">{r.value}</span>{r.valueSub && <span className="sub">{r.valueSub}</span>}</span>
        </div>
      ))}
      {rows.length > limit && (
        <Button variant="ghost" size="sm" icon={all ? <ChevronUp size={16} /> : <ChevronDown size={16} />} onClick={() => setAll(!all)}>
          {all ? tt('reports.showLess') : tt('reports.showMore', { n: rows.length - limit })}
        </Button>
      )}
    </div>
  )
}

function MethodRows({ methods, money }: { methods: MethodStat[]; money: (n: number) => string }) {
  const tt = useT()
  const used = methods.filter(m => m.amount > 0 || m.refunds > 0)
  if (!used.length) return <NoData />
  return (
    <>
      <div className="rp-stack" dir="ltr" role="img" aria-label={tt('reports.methods')}>
        {used.filter(m => m.amount > 0).map(m => <span key={m.method} className={`m-${m.method}`} style={{ flexGrow: m.amount }} title={`${methodLabel(m.method)}: ${money(m.amount)} (${pct(m.share)})`} />)}
      </div>
      <div className="rp-method-rows">
        {used.map(m => (
          <div key={m.method} className="rp-method-row">
            <span className="lbl"><span className={`rp-dot m-${m.method}`} />{methodLabel(m.method)}</span>
            <span className="xs faint">
              {tt('reports.receipts', { n: m.count })}
              {m.refunds > 0 && <> · {tt('reports.tile.refunds')}: <span className="num rp-neg">{money(m.refunds)}</span></>}
            </span>
            <span className="val"><span className="num">{money(m.amount)}</span><span className="pct num">{pct(m.share)}</span></span>
          </div>
        ))}
      </div>
    </>
  )
}

function HeatTable({ matrix, metric, money }: { matrix: number[][]; metric: 'count' | 'total'; money: (n: number) => string }) {
  const tt = useT()
  let max = 0
  for (const row of matrix) for (const v of row) if (v > max) max = v
  const dayName = (dow: number) => formatWeekday(addDays(SUNDAY, dow))
  const cellText = (v: number) => (metric === 'count' ? tt('reports.receipts', { n: v }) : money(v))
  return (
    <>
      <div className="rp-heat-wrap">
        <table className="rp-heat">
          <thead><tr><th className="day" />{HOURS.map(h => <th key={h} className="num">{h}</th>)}</tr></thead>
          <tbody>
            {WEEK.map(dow => (
              <tr key={dow}>
                <th className="day">{dayName(dow)}</th>
                {HOURS.map(h => {
                  const v = matrix[dow][h]
                  const k = max > 0 ? v / max : 0
                  return (
                    <td key={h} className={k > 0.55 ? 'hot' : ''} title={`${dayName(dow)} ${String(h).padStart(2, '0')}:00 — ${cellText(v)}`}>
                      {v > 0 && <span className="bg" style={{ opacity: 0.15 + 0.85 * k }} />}
                      <span className="v num">{v > 0 ? (metric === 'count' ? v : shortNumber(v)) : ''}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rp-heat-foot">
        <span>{tt('reports.peakHint')}</span>
        <span className="rp-heat-scale">{[0.15, 0.4, 0.65, 1].map(o => <span key={o} style={{ opacity: o }} />)}</span>
      </div>
    </>
  )
}

/* ---------- the cards ---------- */

export function ReportSections({ report, range, debtors, lowStock, currency, stockValue }: {
  report: Report; range: Range; debtors: Customer[]; lowStock: Product[]
  /** The currency every figure of `report` is in (the second one in the $ view). */
  currency?: CurrencySettings
  /** What the stock is worth at cost (admin): in the primary currency, and ≈ in the second one when products are priced in it. */
  stockValue?: { primary: string; fx?: string }
}) {
  const tt = useT()
  const settings = useSettings()
  const c = currency ?? settings.currency
  const money = (n: number) => formatMoney(n, c)
  // debts stay in the primary currency whatever the view
  const debt = (n: number) => formatMoney(n, settings.currency)
  const [metric, setMetric] = useState<'count' | 'total'>('count')
  const suffix = `${toDateInput(range.from)}-${toDateInput(range.to)}`
  const hasSales = report.cur.sales.length > 0
  const file = (what: string) => `report-${what}-${suffix}.csv`

  const exportProducts = () => exportCsv(file('products'), [
    [tt('reports.csv.product'), tt('reports.csv.qty'), tt('reports.csv.revenue'), tt('reports.csv.cost'), tt('reports.csv.profit'), tt('reports.csv.refundedQty'), tt('reports.csv.refunds'), tt('reports.csv.share')],
    ...report.products.map(p => [p.name, p.qty, p.revenue, p.cost, p.profit, p.refundedQty, p.refunded, Math.round(p.share * 100)]),
  ])
  const exportCategories = () => exportCsv(file('categories'), [
    [tt('reports.csv.category'), tt('reports.csv.qty'), tt('reports.csv.revenue'), tt('reports.csv.cost'), tt('reports.csv.profit'), tt('reports.csv.share')],
    ...report.categories.map(x => [x.name || tt('reports.noCategory'), x.qty, x.revenue, x.cost, x.profit, Math.round(x.share * 100)]),
  ])
  const exportMethods = () => exportCsv(file('methods'), [
    [tt('reports.csv.method'), tt('reports.csv.amount'), tt('reports.csv.count'), tt('reports.csv.refunds'), tt('reports.csv.net'), tt('reports.csv.share')],
    ...report.methods.map(m => [methodLabel(m.method), m.amount, m.count, m.refunds, m.net, Math.round(m.share * 100)]),
  ])
  const exportCashiers = () => exportCsv(file('cashiers'), [
    [tt('reports.csv.cashier'), tt('reports.csv.count'), tt('reports.csv.total'), tt('reports.csv.avg'), tt('reports.csv.refunds'), tt('reports.csv.net')],
    ...report.cashiers.map(x => [x.name, x.count, x.total, x.avg, x.refunds, x.net]),
  ])
  const exportCustomers = () => exportCsv(file('customers'), [
    [tt('reports.csv.customer'), tt('reports.csv.count'), tt('reports.csv.total'), tt('reports.csv.avg'), tt('reports.csv.credit')],
    ...report.customers.map(x => [x.name, x.count, x.total, x.avg, x.credit]),
  ])
  const exportDebts = () => exportCsv(`report-debts-${toDateInput(Date.now())}.csv`, [
    [tt('reports.csv.name'), tt('reports.csv.phone'), tt('reports.csv.balance')],
    ...debtors.map(x => [x.name, x.phone ?? '', x.balance]),
  ])
  const exportLowStock = () => exportCsv(`report-low-stock-${toDateInput(Date.now())}.csv`, [
    [tt('reports.csv.product'), tt('reports.csv.sku'), tt('reports.csv.barcode'), tt('reports.csv.stock'), tt('reports.csv.minStock'), tt('reports.csv.unit')],
    ...lowStock.map(p => [p.name, p.sku ?? '', p.barcodes[0] ?? '', p.stock, p.lowStock, unitLabel(p.unit)]),
  ])
  const exportExpenses = () => exportCsv(file('expenses'), [
    [tt('reports.csv.category'), tt('reports.csv.amount'), tt('reports.csv.count'), tt('reports.csv.share')],
    ...report.expenseCats.map(x => [expenseCatLabel(x.category), x.total, x.count, Math.round(x.share * 100)]),
  ])
  const exportPeak = () => {
    const m = metric === 'count' ? report.peakCount : report.peakTotal
    return exportCsv(file(`peak-${metric}`), [
      [tt('reports.csv.weekday'), ...HOURS.map(h => `${String(h).padStart(2, '0')}:00`)],
      ...WEEK.map(dow => [formatWeekday(addDays(SUNDAY, dow)), ...m[dow]]),
    ])
  }

  const productRows: RankRow[] = report.products.map(p => ({
    key: p.productId ?? 'name:' + p.name, label: p.name, value: money(p.revenue), valueSub: <span className="num">{pct(p.share)}</span>, bar: p.revenue,
    sub: (
      <>
        <span>{tt('reports.qty')}: <span className="num">{formatQty(p.qty)}</span></span>
        <span>{tt('reports.profit')}: <span className={`num ${p.profit < 0 ? 'rp-neg' : ''}`}>{money(p.profit)}</span></span>
        {p.refundedQty > 0 && <span className="rp-neg">{tt('reports.tile.refunds')}: <span className="num">{formatQty(p.refundedQty)}</span></span>}
      </>
    ),
  }))
  const categoryRows: RankRow[] = report.categories.map(x => ({
    key: x.categoryId ?? '', label: x.name || tt('reports.noCategory'), value: money(x.revenue), valueSub: <span className="num">{pct(x.share)}</span>, bar: x.revenue,
    color: x.color ?? colorFor(x.name || '?'),
    sub: <><span>{tt('reports.qty')}: <span className="num">{formatQty(x.qty)}</span></span><span>{tt('reports.profit')}: <span className={`num ${x.profit < 0 ? 'rp-neg' : ''}`}>{money(x.profit)}</span></span></>,
  }))
  const cashierRows: RankRow[] = report.cashiers.map(x => ({
    key: x.userId, label: x.name, value: money(x.total), valueSub: <span className="num">{pct(x.share)}</span>, bar: x.total, color: colorFor(x.userId),
    sub: (
      <>
        <span>{tt('reports.receipts', { n: x.count })}</span>
        <span>{tt('reports.avg')}: <span className="num">{money(x.avg)}</span></span>
        {x.refundCount > 0 && <span className="rp-neg">{tt('reports.refundsN', { n: x.refundCount })}: <span className="num">{money(x.refunds)}</span></span>}
      </>
    ),
  }))
  const customerRows: RankRow[] = report.customers.map(x => ({
    key: x.customerId, label: x.name || tt('common.customer'), value: money(x.total), valueSub: <span className="num">{pct(x.share)}</span>, bar: x.total, color: colorFor(x.customerId),
    sub: <><span>{tt('reports.receipts', { n: x.count })}</span>{x.credit > 0 && <span className="rp-neg">{tt('reports.credit')}: <span className="num">{money(x.credit)}</span></span>}</>,
  }))
  const expenseRows: RankRow[] = report.expenseCats.map(x => ({
    key: x.category, label: expenseCatLabel(x.category), value: money(x.total), valueSub: <span className="num">{pct(x.share)}</span>, bar: x.total, color: colorFor(x.category),
    sub: <span>{tt('common.items', { n: x.count })}</span>,
  }))

  return (
    <div className="rp-grid">
      {hasSales && (
        <Section title={tt('reports.topProducts')} icon={<Trophy size={18} />} onExport={exportProducts}>
          <RankList rows={productRows} limit={10} />
        </Section>
      )}
      {hasSales && (
        <Section title={tt('reports.byCategory')} icon={<Layers size={18} />} onExport={exportCategories}>
          <RankList rows={categoryRows} />
        </Section>
      )}
      {hasSales && (
        <Section title={tt('reports.methods')} icon={<CreditCard size={18} />} onExport={exportMethods}>
          <MethodRows methods={report.methods} money={money} />
        </Section>
      )}
      {hasSales && (
        <Section title={tt('reports.byCashier')} icon={<UserRound size={18} />} onExport={exportCashiers}>
          <RankList rows={cashierRows} />
        </Section>
      )}
      {hasSales && (
        <Section title={tt('reports.topCustomers')} icon={<Users size={18} />} onExport={exportCustomers}>
          <RankList rows={customerRows} />
        </Section>
      )}
      <Section title={tt('reports.topDebts')} icon={<HandCoins size={18} />} onExport={debtors.length ? exportDebts : undefined}>
        {debtors.length === 0 ? <NoData text={tt('reports.noDebts')} /> : (
          <div className="list">
            {debtors.map(cu => (
              <div key={cu.id} className="list-row">
                <span className="grow truncate"><span className="title truncate">{cu.name}</span>{cu.phone && <span className="sub num">{cu.phone}</span>}</span>
                <span className="end"><span className="num rp-neg">{debt(cu.balance)}</span></span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title={tt('reports.lowStock')} icon={<TriangleAlert size={18} />} onExport={lowStock.length ? exportLowStock : undefined}>
        {stockValue && <p className="xs faint rp-stock-value">{tt('reports.stockValue', { v: stockValue.primary })}{stockValue.fx ? <>{' ≈ '}<span className="num">{stockValue.fx}</span></> : null}</p>}
        {lowStock.length === 0 ? <NoData text={tt('reports.lowStockOk')} /> : (
          <div className="list">
            {lowStock.slice(0, 30).map(p => (
              <div key={p.id} className="list-row">
                <span className="grow truncate">
                  <span className="title truncate">{p.name}</span>
                  <span className="sub">{tt('reports.stockLeft', { n: formatQty(p.stock) })} {unitLabel(p.unit)}{p.lowStock > 0 ? ` · ${tt('reports.minStock', { n: formatQty(p.lowStock) })}` : ''}</span>
                </span>
                <span className="end">{p.stock <= 0 ? <Badge kind="danger">{tt('reports.out')}</Badge> : <Badge kind="warn">{tt('reports.low')}</Badge>}</span>
              </div>
            ))}
            {lowStock.length > 30 && <p className="faint xs center rp-none">+{lowStock.length - 30}</p>}
          </div>
        )}
      </Section>
      <Section title={tt('reports.expensesByCat')} icon={<Wallet size={18} />} onExport={report.expenseCats.length ? exportExpenses : undefined}>
        <RankList rows={expenseRows} />
      </Section>
      {hasSales && (
        <Section
          wide
          title={tt('reports.peakHours')}
          icon={<Flame size={18} />}
          onExport={exportPeak}
          action={<Seg value={metric} onChange={setMetric} options={[{ value: 'count', label: tt('reports.metric.count') }, { value: 'total', label: tt('reports.metric.total') }]} />}
        >
          <HeatTable matrix={metric === 'count' ? report.peakCount : report.peakTotal} metric={metric} money={money} />
        </Section>
      )}
    </div>
  )
}
