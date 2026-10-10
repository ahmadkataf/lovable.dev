import { useMemo, type ReactNode } from 'react'
import { BadgePercent, Coins, CreditCard, Info, Layers, PiggyBank, Receipt, Stethoscope, TrendingUp, Wallet } from 'lucide-react'
import { Button, Card, CardHeader, DataTable, type Column } from '@/ui'
import { useI18n } from '@/i18n'
import { useMoney } from '@/app/hooks'
import { PAYMENT_METHODS } from '@/db/types'
import { today } from '@/lib/dates'
import { formatNumber, round2, sum } from '@/lib/format'
import { AreaChart, BarChart, DonutChart, HorizontalBars } from '../charts'
import { share } from '../chartMath'
import { CardEmpty, ChartCard, KpiCard, SLOTS, fmtPeriod, iso, useBucketText, usePlural } from '../parts'
import {
  avgInvoice, byCategory, byDoctor, byMethod, chooseUnit, delta, expensesByCategory, invoicedTotal, profit, revenueByDay, revenueByMonth, totalOf, untilToday,
} from '../queries'
import { EmptyTab, rangeSlug, useExport, type TabProps } from './common'

interface ExpRow { key: string; label: ReactNode; amount: number; ofExp: number | null; ofRev: number | null; kind: 'item' | 'total' | 'revenue' | 'net'; text: string }

export default function FinancialTab({ period, data, setExport, onShowYear }: TabProps) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const plural = usePlural()
  const pct = (v: number) => `${formatNumber(v, lang, Number.isInteger(v) ? 0 : 1)}%`
  const range = fmtPeriod(period, lang)

  const c = useMemo(() => {
    if (!data) return null
    const revenue = totalOf(data.payments), prevRevenue = totalOf(data.prevPayments)
    const expenses = round2(sum(data.expenses, e => e.amount)), prevExpenses = round2(sum(data.prevExpenses, e => e.amount))
    const pr = profit(revenue, expenses), prevPr = profit(prevRevenue, prevExpenses)
    const issued = data.invoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled').length
    const prevIssued = data.prevInvoices.filter(i => i.status !== 'draft' && i.status !== 'cancelled').length
    const unit = chooseUnit(period, { dayUpTo: 62 })
    // the trend stops at today: days that have not happened yet are not "zero revenue"
    const { to } = untilToday(period, today())
    const trend = unit === 'day' ? revenueByDay(data.payments, period.from, to) : revenueByMonth(data.payments, period.from, to)
    return {
      revenue, prevRevenue, expenses, prevExpenses, pr, prevPr, issued, prevIssued, unit, trend,
      invoiced: invoicedTotal(data.invoices), prevInvoiced: invoicedTotal(data.prevInvoices),
      avg: avgInvoice(data.invoices), prevAvg: avgInvoice(data.prevInvoices),
      methods: byMethod(data.payments),
      doctors: byDoctor(data.refInvoices, data.payments, data.users, period),
      cats: byCategory(data.invoices, data.procedures, data.treatments),
      exp: expensesByCategory(data.expenses),
    }
  }, [data, period])

  const trendText = useBucketText(c?.trend ?? [], c?.unit ?? 'day')
  const doctorMode = !!data?.doctorId
  const expRows: ExpRow[] = useMemo(() => {
    if (!c) return []
    const rows: ExpRow[] = c.exp.map(e => ({ key: e.category, label: t(`exp.${e.category}`), text: t(`exp.${e.category}`), amount: e.value, ofExp: share(e.value, c.expenses), ofRev: c.revenue > 0 ? share(e.value, c.revenue) : null, kind: 'item' }))
    rows.push({ key: '_total', label: t('reports.fin.totalExpenses'), text: t('reports.fin.totalExpenses'), amount: c.expenses, ofExp: c.expenses > 0 ? 100 : null, ofRev: c.revenue > 0 ? share(c.expenses, c.revenue) : null, kind: 'total' })
    rows.push({ key: '_rev', label: t('reports.fin.revenue'), text: t('reports.fin.revenue'), amount: c.revenue, ofExp: null, ofRev: c.revenue > 0 ? 100 : null, kind: 'revenue' })
    rows.push({ key: '_net', label: t('reports.fin.netProfit'), text: t('reports.fin.netProfit'), amount: c.pr.profit, ofExp: null, ofRev: c.pr.margin, kind: 'net' })
    return rows
  }, [c, t])

  const empty = !!data && !data.payments.length && !data.invoices.length && !data.expenses.length
  useExport(setExport, !c || empty ? null : doctorMode
    ? { name: `revenue-by-doctor_${rangeSlug(period)}.csv`, rows: [[t('doctor'), t('reports.fin.invoiced'), t('reports.fin.collected')], ...c.doctors.map(d => [d.name || t('reports.unassigned'), d.invoiced, d.collected])] }
    : { name: `expenses-vs-revenue_${rangeSlug(period)}.csv`, rows: [[t('category'), t('amount'), t('reports.fin.ofExpenses'), t('reports.fin.ofRevenue')], ...expRows.map(r => [r.text, r.amount, r.ofExp === null ? '' : `${r.ofExp}%`, r.ofRev === null ? '' : `${r.ofRev}%`])] })

  if (c && empty) {
    return <EmptyTab icon={<Wallet />} title={t('reports.fin.emptyTitle')} desc={t('reports.fin.emptyDesc', { range })} period={period} onShowYear={onShowYear}
      action={<Button to="/payments" icon={<Receipt />}>{t('reports.fin.goPayments')}</Button>} />
  }
  const loading = !c
  const vs = t('reports.vsPrevious')

  const methodData = (c?.methods ?? []).map(m => ({ id: m.method, label: t(`pay.${m.method}`), value: Math.max(0, m.value), color: SLOTS[PAYMENT_METHODS.indexOf(m.method)] }))
  const trendData = (c?.trend ?? []).map((p, i) => ({ label: trendText[i]?.label ?? '', title: trendText[i]?.title, values: [p.value] }))
  const revSeries = [{ id: 'rev', label: t('reports.fin.revenue'), color: 'var(--rp-c1)' }]
  const expCols: Column<ExpRow>[] = [
    { key: 'label', header: t('category'), render: r => <span className={r.kind === 'item' ? undefined : 'strong'}>{r.label}</span> },
    { key: 'amount', header: t('amount'), className: 'num', render: r => <span className={`money${r.kind === 'net' ? (r.amount >= 0 ? ' pos' : ' neg') : ''}`}>{money(r.amount)}</span> },
    { key: 'ofExp', header: t('reports.fin.ofExpenses'), className: 'num', hideBelow: 'sm', render: r => (r.ofExp === null ? <span className="subtle">—</span> : <span className="num">{pct(r.ofExp)}</span>) },
    { key: 'ofRev', header: t('reports.fin.ofRevenue'), className: 'num', render: r => (r.ofRev === null ? <span className="subtle">—</span> : <span className="num">{pct(r.ofRev)}</span>) },
  ]

  return (
    <div className="rp-section" data-testid="rp-financial">
      <div className="rp-kpis">
        <KpiCard testId="kpi-revenue" loading={loading} tone="primary" icon={<Wallet />} label={t('reports.fin.revenue')} value={c && <span className="money">{money(c.revenue)}</span>} delta={c ? delta(c.revenue, c.prevRevenue) : undefined} deltaLabel={vs} />
        {doctorMode ? <>
          <KpiCard loading={loading} tone="accent" icon={<Receipt />} label={t('reports.fin.invoiced')} value={c && <span className="money">{money(c.invoiced)}</span>} delta={c ? delta(c.invoiced, c.prevInvoiced) : undefined} deltaLabel={vs} />
          <KpiCard loading={loading} tone="info" icon={<Layers />} label={t('reports.fin.invoiceCount')} value={c && <span className="num">{formatNumber(c.issued, lang)}</span>} delta={c ? delta(c.issued, c.prevIssued) : undefined} deltaLabel={vs} />
        </> : <>
          <KpiCard testId="kpi-expenses" loading={loading} tone="orange" icon={<Coins />} label={t('reports.fin.expenses')} value={c && <span className="money">{money(c.expenses)}</span>} delta={c ? delta(c.expenses, c.prevExpenses) : undefined} deltaLabel={vs} upIsGood={false} />
          <KpiCard testId="kpi-profit" loading={loading} tone={c && c.pr.profit < 0 ? 'danger' : 'success'} icon={<PiggyBank />} label={t('reports.fin.profit')} value={c && <span className="money">{money(c.pr.profit)}</span>}
            delta={c ? delta(c.pr.profit, c.prevPr.profit) : undefined} deltaLabel={vs}
            sub={c && c.pr.margin !== null ? <span className="row gap-1"><BadgePercent size={14} />{c.pr.profit < 0 ? t('reports.fin.loss') : t('reports.fin.margin', { pct: iso(pct(c.pr.margin)) })}</span> : undefined} />
        </>}
        <KpiCard loading={loading} tone="purple" icon={<TrendingUp />} label={t('reports.fin.avgInvoice')} value={c && <span className="money">{money(c.avg)}</span>} delta={c ? delta(c.avg, c.prevAvg) : undefined} deltaLabel={vs}
          sub={c && !doctorMode ? plural('reports.n.invoices', c.issued) : undefined} />
      </div>

      <div className="rp-row">
        <ChartCard testId="chart-revenue" loading={loading} icon={<TrendingUp />} title={c?.unit === 'month' ? t('reports.fin.monthlyRevenue') : t('reports.fin.dailyRevenue')} subtitle={t('reports.fin.revenueSub', { range })} height={260}
          table={{ columns: [{ key: 'd', header: t('date') }, { key: 'v', header: t('reports.fin.revenue'), num: true }], rows: trendData.filter(d => d.values[0] !== 0).map(d => ({ d: d.title, v: <span className="money">{money(d.values[0])}</span> })) }}>
          {c?.unit === 'month'
            ? <BarChart fill data={trendData} series={revSeries} height={260} format={n => money(n)} title={t('reports.fin.monthlyRevenue')} desc={range} />
            : <AreaChart fill data={trendData} series={revSeries} height={260} format={n => money(n)} title={t('reports.fin.dailyRevenue')} desc={range} />}
        </ChartCard>
        <ChartCard testId="chart-methods" loading={loading} icon={<CreditCard />} title={t('reports.fin.byMethod')} subtitle={t('reports.fin.byMethodSub')} height={200}
          empty={c && !methodData.some(m => m.value > 0) ? <CardEmpty icon={<CreditCard />}>{t('reports.noDataPeriod')}</CardEmpty> : undefined}
          table={{ columns: [{ key: 'm', header: t('reports.fin.byMethod') }, { key: 'n', header: t('reports.count'), num: true }, { key: 'v', header: t('amount'), num: true }], rows: (c?.methods ?? []).map(m => ({ m: t(`pay.${m.method}`), n: <span className="num">{m.count}</span>, v: <span className="money">{money(m.value)}</span> })) }}>
          <DonutChart data={methodData} format={n => money(n)} centerValue={c ? money(c.revenue, { compact: true }) : ''} centerLabel={t('reports.fin.totalCollected')} title={t('reports.fin.byMethod')} desc={range} />
        </ChartCard>
      </div>

      <div className="rp-row even">
        <ChartCard testId="chart-doctors" loading={loading} icon={<Stethoscope />} title={t('reports.fin.byDoctor')} subtitle={t('reports.fin.byDoctorSub')} height={200}
          empty={c && !c.doctors.length ? <CardEmpty icon={<Stethoscope />}>{t('reports.noDataPeriod')}</CardEmpty> : undefined}
          table={{ columns: [{ key: 'd', header: t('doctor') }, { key: 'i', header: t('reports.fin.invoiced'), num: true }, { key: 'c', header: t('reports.fin.collected'), num: true }], rows: (c?.doctors ?? []).map(d => ({ d: d.name || t('reports.unassigned'), i: <span className="money">{money(d.invoiced)}</span>, c: <span className="money">{money(d.collected)}</span> })) }}>
          <HorizontalBars data={(c?.doctors ?? []).map(d => ({ id: d.doctorId || '_none', label: d.name || t('reports.unassigned'), value: d.collected, dot: d.color, sub: plural('reports.n.invoices', d.invoices) }))}
            format={n => money(n)} title={t('reports.fin.byDoctor')} tipLabel={t('reports.fin.collected')} />
        </ChartCard>
        <ChartCard testId="chart-categories" loading={loading} icon={<Layers />} title={t('reports.fin.byCategory')} subtitle={t('reports.fin.byCategorySub')} height={200}
          empty={c && !c.cats.length ? <CardEmpty icon={<Layers />}>{t('reports.noDataPeriod')}</CardEmpty> : undefined}
          table={{ columns: [{ key: 'c', header: t('category') }, { key: 'v', header: t('amount'), num: true }], rows: (c?.cats ?? []).map(x => ({ c: t(`cat.${x.category}`), v: <span className="money">{money(x.value)}</span> })) }}>
          <HorizontalBars data={(c?.cats ?? []).map(x => ({ id: x.category, label: t(`cat.${x.category}`), value: x.value, sub: plural('reports.n.procedures', x.count) }))} color="var(--rp-c2)"
            format={n => money(n)} title={t('reports.fin.byCategory')} tipLabel={t('reports.fin.invoiced')} />
        </ChartCard>
      </div>

      {doctorMode ? (
        <div className="rp-scope-note"><Info />{t('reports.clinicWide')}</div>
      ) : (
        <Card className="rp-card" data-testid="table-expenses">
          <CardHeader icon={<Coins />} title={t('reports.fin.expVsRev')} subtitle={t('reports.fin.expVsRevSub')} />
          {c && !c.exp.length && <div className="card-body" style={{ paddingBottom: 0 }}><div className="rp-scope-note"><Info />{t('reports.fin.noExpenses')}</div></div>}
          <div className="card-body">
            <DataTable compact columns={expCols} rows={expRows} rowKey={r => r.key} rowClassName={r => (r.kind === 'item' ? undefined : 'rp-table-total')} />
          </div>
        </Card>
      )}
    </div>
  )
}
