// /reports (admin only): the period bar with a previous-period comparison, the headline tiles, the sales chart
// and the breakdown cards. One DB read per period (sales, refunds, expenses by createdAt); everything else is
// aggregated in memory by lib/reports.ts, and useLiveQuery keeps it live while the shop sells.
import './i18n'
import './reports.css'
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ChartColumn, Download, Lock, ShoppingCart, Receipt, Calculator, Undo2, TrendingUp, Package, Coins, Wallet, PiggyBank, HandCoins, type LucideIcon } from 'lucide-react'
import { db } from '../../db'
import type { Sale, Product, Category, Customer, User, RateHistoryEntry } from '../../db/types'
import { useT, locale } from '../../i18n'
import { Button, Empty, Field, Input, Seg, Spinner, useIsMobile } from '../../components/ui'
import { formatMoney, round } from '../../lib/money'
import { formatDate, formatTime, formatMonth, periodRange, startOfMonth, toDateInput, fromDateInput, type Period } from '../../lib/format'
import { delta, previousPeriod, saleMethods, lowStockProducts, type ReportSummary } from '../../lib/reports'
import { loadRateHistory, rateAt, stockValueFx, type FxRowsRate } from '../../lib/fx'
import { useSettings, useUser, isAdmin } from '../../state/store'
import { buildReport, splitPeriods, type Granularity, type RawData, type TimeBucket } from './logic'
import { BarChart, type ChartBucket } from './BarChart'
import { ReportSections, exportCsv, methodLabel } from './Sections'

const PERIODS: Period[] = ['today', 'yesterday', 'week', 'month', 'year', 'custom']
const NO_PRODUCTS: Product[] = []
const NO_CATEGORIES: Category[] = []
const NO_USERS: User[] = []
const NO_CUSTOMERS: Customer[] = []
const NO_HISTORY: RateHistoryEntry[] = []
type ReportCurrency = 'primary' | 'secondary'
const CUR_KEY = 'kaseb.reports.cur'

/** The three period tables in one go, plus the receipts that refunds of the window point to. */
async function loadRaw(from: number, to: number): Promise<RawData> {
  const [sales, refunds, expenses] = await Promise.all([
    db.sales.where('createdAt').between(from, to, true, true).toArray(),
    db.refunds.where('createdAt').between(from, to, true, true).toArray(),
    db.expenses.where('createdAt').between(from, to, true, true).toArray(),
  ])
  const have = new Set<string>()
  for (const s of sales) have.add(s.id)
  const missing = [...new Set(refunds.map(r => r.saleId).filter(id => !have.has(id)))]
  const extra = missing.length ? (await db.sales.bulkGet(missing)).filter((s): s is Sale => !!s) : []
  return { sales, refunds, expenses, extra }
}

function toChartBucket(b: TimeBucket, g: Granularity): ChartBucket {
  const base = { total: b.total, count: b.count, refunds: b.refunds }
  if (g === 'hour') return { ...base, label: String(b.key), title: `${String(b.key).padStart(2, '0')}:00` }
  if (g === 'month') return { ...base, label: new Date(b.key).toLocaleDateString(locale(), { month: 'short' }), title: formatMonth(b.key) }
  return { ...base, label: String(new Date(b.key).getDate()), title: formatDate(b.key, 'long') }
}

export default function ReportsScreen() {
  const user = useUser()
  return isAdmin(user) ? <Reports /> : <AdminOnly />
}

function AdminOnly() {
  const t = useT()
  const nav = useNavigate()
  return (
    <div className="page">
      <div className="page-head"><h1>{t('nav.reports')}</h1></div>
      <div className="page-body">
        <div className="card pad rp-admin">
          <Empty icon={<Lock size={32} />} title={t('reports.adminOnly')} text={t('reports.adminOnlyText')} action={<Button variant="primary" onClick={() => nav('/')}>{t('reports.goSell')}</Button>} />
        </div>
      </div>
    </div>
  )
}

interface Tile { key: keyof ReportSummary; icon: LucideIcon; money?: boolean; bad?: boolean; hint?: string; primary?: boolean; signed?: boolean }

function Reports() {
  const t = useT()
  const settings = useSettings()
  const c2 = settings.currency2
  const [curMode, setCurMode] = useState<ReportCurrency>(() => { try { return localStorage.getItem(CUR_KEY) === 'secondary' ? 'secondary' : 'primary' } catch { return 'primary' } })
  const inFx = c2.enabled && curMode === 'secondary'
  const c = inFx ? c2 : settings.currency
  const d = c.decimals
  const mobile = useIsMobile()
  const [period, setPeriod] = useState<Period>('today')
  const [custom, setCustom] = useState(() => ({ from: startOfMonth(Date.now()), to: Date.now() }))
  const [compare, setCompare] = useState(false)
  const pickCurrency = (m: ReportCurrency) => { setCurMode(m); try { localStorage.setItem(CUR_KEY, m) } catch { /* ignore */ } }
  const range = periodRange(period, custom)
  const prev = previousPeriod(range)
  const loadFrom = compare ? prev.from : range.from

  const raw = useLiveQuery(() => loadRaw(loadFrom, range.to), [loadFrom, range.to])
  const products = useLiveQuery(() => db.products.toArray(), [], NO_PRODUCTS)
  const categories = useLiveQuery(() => db.categories.toArray(), [], NO_CATEGORIES)
  const users = useLiveQuery(() => db.users.toArray(), [], NO_USERS)
  const debtors = useLiveQuery(() => db.customers.where('balance').above(0).reverse().limit(10).toArray(), [], NO_CUSTOMERS)
  const history = useLiveQuery(() => loadRateHistory(), [], NO_HISTORY)
  // the $ view: every receipt at its own rate; pre-feature rows at the rate in force then (history), else today's
  const fx = useMemo<FxRowsRate | undefined>(() => (inFx ? { rateAt: ms => rateAt(history, ms), current: c2.rate, decimals: c2.decimals } : undefined), [inFx, history, c2.rate, c2.decimals])

  const report = useMemo(() => (raw ? buildReport(raw, { from: range.from, to: range.to }, period, compare, products, categories, d, fx) : null), [raw, range.from, range.to, period, compare, products, categories, d, fx])
  const stockValue = useMemo(() => {
    const pd = settings.currency.decimals
    const primary = round(products.reduce((s, p) => (p.trackStock && p.stock > 0 ? s + p.stock * p.cost : s), 0), pd)
    return { primary: formatMoney(primary, settings.currency), fx: c2.enabled && c2.pricing && c2.rate > 0 ? formatMoney(stockValueFx(products, c2), c2) : undefined }
  }, [products, settings.currency, c2])
  const lowStock = useMemo(() => lowStockProducts(products), [products])
  const chart = useMemo(() => (report ? report.buckets.map(b => toChartBucket(b, report.granularity)) : []), [report])
  const prevChart = useMemo(() => (report?.prevBuckets ? report.prevBuckets.map(b => toChartBucket(b, report.granularity)) : null), [report])

  const money = (n: number) => formatMoney(n, c)
  const userName = (s: Sale) => users.find(u => u.id === s.userId)?.name ?? s.userName
  const hasSales = !!report && report.cur.sales.length > 0

  const exportAll = async () => {
    if (!report || !raw) return
    // the CSV is always the receipts as recorded (primary currency), with each one's rate and total in the second currency
    const withFx = c2.enabled
    const rows: (string | number)[][] = [[
      t('reports.csv.number'), t('reports.csv.date'), t('reports.csv.time'), t('reports.csv.cashier'), t('reports.csv.customer'), t('reports.csv.items'),
      t('reports.csv.subtotal'), t('reports.csv.discount'), t('reports.csv.tax'), t('reports.csv.total'), t('reports.csv.paid'), t('reports.csv.credit'), t('reports.csv.methods'), t('reports.csv.status'),
      ...(withFx ? [t('reports.csv.rate'), t('reports.csv.totalFx', { cur: c2.code })] : []),
    ]]
    const recorded = splitPeriods(raw, { from: range.from, to: range.to }).cur
    const list = recorded.sales.slice().sort((a, b) => a.createdAt - b.createdAt)
    for (const s of list) {
      const rated = typeof s.rate === 'number' && s.rate > 0
      rows.push([s.number, formatDate(s.createdAt), formatTime(s.createdAt), userName(s), s.customerName ?? '', s.items.length, s.subtotal, s.discount, s.tax, s.total, s.paid, s.credit, saleMethods(s).map(methodLabel).join(' + '), t('reports.status.' + s.status),
        ...(withFx ? [rated ? s.rate! : '', rated ? round(s.total / s.rate!, c2.decimals) : ''] : [])])
    }
    const sm = inFx ? buildReport(raw, { from: range.from, to: range.to }, period, false, products, categories, settings.currency.decimals).summary : report.summary
    rows.push([], [t('common.total'), '', '', '', '', sm.items, '', sm.discount, sm.tax, sm.gross, '', sm.credit, '', t('reports.receipts', { n: sm.count })])
    await exportCsv(`sales-${toDateInput(range.from)}-${toDateInput(range.to)}.csv`, rows)
  }

  const tiles: Tile[] = [
    { key: 'gross', icon: ShoppingCart, money: true, primary: true },
    { key: 'count', icon: Receipt },
    { key: 'avg', icon: Calculator, money: true },
    { key: 'refunds', icon: Undo2, money: true, bad: true },
    { key: 'net', icon: TrendingUp, money: true, hint: t('reports.hint.net') },
    { key: 'cost', icon: Package, money: true, bad: true, hint: inFx ? t('reports.fxCostNote') : undefined },
    { key: 'profit', icon: Coins, money: true, hint: t('reports.hint.profit'), signed: true },
    { key: 'expenses', icon: Wallet, money: true, bad: true },
    { key: 'netProfit', icon: PiggyBank, money: true, hint: t('reports.hint.netProfit'), signed: true },
    { key: 'credit', icon: HandCoins, money: true, bad: true, hint: t('reports.hint.credit') },
  ]
  const fmtTile = (tile: Tile, n: number, signed = false) => (tile.money ? formatMoney(n, c, { sign: signed }) : `${signed && n > 0 ? '+' : ''}${n}`)
  const chartTitle = t(report?.granularity === 'hour' ? 'reports.chart.byHour' : report?.granularity === 'month' ? 'reports.chart.byMonth' : 'reports.chart.byDay')

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('nav.reports')}</h1>
        <div className="actions">
          <Button variant="outline" icon={<Download size={18} />} iconOnly={mobile} onClick={() => void exportAll()} disabled={!hasSales} title={t('reports.exportAll')} aria-label={t('reports.exportAll')}>{t('reports.exportAll')}</Button>
        </div>
      </div>
      <div className="page-body col">
        <div className="card pad col">
          <div className="rp-bar">
            <div className="rp-periods">
              <Seg value={period} onChange={setPeriod} options={PERIODS.map(p => ({ value: p, label: t('reports.period.' + p) }))} />
            </div>
            {c2.enabled && (
              <Seg value={curMode} onChange={pickCurrency} options={[{ value: 'primary', label: settings.currency.symbol }, { value: 'secondary', label: c2.symbol }]} />
            )}
            <button type="button" className="rp-compare" role="switch" aria-checked={compare} onClick={() => setCompare(!compare)}>
              <span className={`switch ${compare ? 'on' : ''}`} />
              <span>
                {t('reports.compare')}
                {compare && <span className="desc num">{formatDate(prev.from)} – {formatDate(prev.to)}</span>}
              </span>
            </button>
          </div>
          {inFx && (
            <p className="xs faint" style={{ margin: 0 }}>
              {t('reports.fxNote')}{report && report.estimated > 0 ? ` · ${t('reports.fxEstimated', { n: report.estimated })}` : ''}
            </p>
          )}
          {period === 'custom' && (
            <div className="rp-range">
              <Field label={t('common.from')}><Input type="date" ltr value={toDateInput(custom.from)} max={toDateInput(custom.to)} onChange={e => e.target.value && setCustom(r => ({ ...r, from: fromDateInput(e.target.value) }))} /></Field>
              <Field label={t('common.to')}><Input type="date" ltr value={toDateInput(custom.to)} min={toDateInput(custom.from)} onChange={e => e.target.value && setCustom(r => ({ ...r, to: fromDateInput(e.target.value) }))} /></Field>
            </div>
          )}
        </div>

        {!report ? <div className="empty"><Spinner /></div> : !hasSales ? (
          <Empty icon={<ChartColumn size={32} />} title={t('reports.empty')} text={t('reports.emptyText')} />
        ) : (
          <>
            <div className="stats rp-stats">
              {tiles.map(tile => {
                const v = report.summary[tile.key]
                const pv = report.prevSummary ? report.prevSummary[tile.key] : null
                const Icon = tile.icon
                const tone = tile.signed ? (v > 0 ? 'rp-pos' : v < 0 ? 'rp-neg' : '') : ''
                return (
                  <div key={tile.key} className={`stat ${tile.primary ? 'primary' : ''}`}>
                    <div className="stat-label"><Icon size={14} /> {t('reports.tile.' + tile.key)}</div>
                    <div className={`stat-value num ${tone}`}>{fmtTile(tile, v)}</div>
                    {pv !== null ? <DeltaLine cur={v} prev={pv} bad={tile.bad} decimals={d} fmt={(n, s) => fmtTile(tile, n, s)} /> : tile.hint ? <div className="stat-sub">{tile.hint}</div> : null}
                  </div>
                )
              })}
            </div>

            <div className="card pad rp-chart-card">
              <div className="card-title"><ChartColumn size={16} />{chartTitle}</div>
              <BarChart buckets={chart} prev={prevChart} format={money} labelWidth={report.granularity === 'month' ? 48 : 24} ariaLabel={chartTitle} />
              {prevChart && (
                <div className="rp-legend">
                  <span><span className="rp-dot cur" />{t('reports.chart.current')} · <span className="num">{formatDate(range.from)} – {formatDate(range.to)}</span></span>
                  <span><span className="rp-dot prev" />{t('reports.chart.previous')} · <span className="num">{formatDate(prev.from)} – {formatDate(prev.to)}</span></span>
                </div>
              )}
            </div>
          </>
        )}

        {report && <ReportSections report={report} range={range} debtors={debtors} lowStock={lowStock} currency={c} stockValue={stockValue} />}
      </div>
    </div>
  )
}

/** "▲ 12% · السابق: 1,200" under a tile; green when the change is welcome, red when it is not. */
function DeltaLine({ cur, prev, bad, decimals, fmt }: { cur: number; prev: number; bad?: boolean; decimals: number; fmt: (n: number, signed?: boolean) => string }) {
  const t = useT()
  const { diff, pct } = delta(cur, prev, decimals)
  const up = diff > 0, down = diff < 0
  const good = !up && !down ? null : bad ? down : up
  const text = pct === null ? (diff === 0 ? t('reports.deltaFlat') : fmt(diff, true)) : `${Math.abs(Math.round(pct * 100))}%`
  return (
    <div className={`stat-sub rp-delta ${good === null ? '' : good ? 'good' : 'bad'}`}>
      <span className="num">{up ? '▲' : down ? '▼' : '•'} {text}</span>
      <span className="prev">{t('reports.prevValue', { v: fmt(prev) })}</span>
    </div>
  )
}
