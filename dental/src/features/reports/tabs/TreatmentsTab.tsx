import { useMemo } from 'react'
import { Activity, BadgeCheck, ClipboardList, Gem, Hourglass, ListChecks, Trophy } from 'lucide-react'
import { Button } from '@/ui'
import { useI18n } from '@/i18n'
import { useMoney } from '@/app/hooks'
import { dateOf, today } from '@/lib/dates'
import { formatNumber, round2 } from '@/lib/format'
import { BarChart, HorizontalBars } from '../charts'
import { CardEmpty, ChartCard, KpiCard, fmtPeriod, useBucketText, usePlural } from '../parts'
import { chooseUnit, delta, inRange, topProcedures, treatmentValue, treatmentsOverTime, untilToday, type Period } from '../queries'
import type { TreatmentItem } from '@/db/types'
import { EmptyTab, rangeSlug, useExport, type TabProps } from './common'

const completedIn = (list: TreatmentItem[], p: Period) => list.filter(t => t.status === 'completed' && inRange(t.completedAt ? dateOf(t.completedAt) : undefined, p))
const createdIn = (list: TreatmentItem[], p: Period) => list.filter(t => t.status !== 'cancelled' && inRange(t.createdAt ? dateOf(t.createdAt) : undefined, p))

export default function TreatmentsTab({ period, data, setExport, onShowYear }: TabProps) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const plural = usePlural()
  const range = fmtPeriod(period, lang)
  const num = (n: number) => formatNumber(n, lang)

  const c = useMemo(() => {
    if (!data) return null
    const done = completedIn(data.treatments, period), prevDone = completedIn(data.prevTreatments, data.prev)
    const added = createdIn(data.treatments, period), prevAdded = createdIn(data.prevTreatments, data.prev)
    const unit = chooseUnit(period, { dayUpTo: 31, weekUpTo: 190 })
    const value = (l: TreatmentItem[]) => round2(l.reduce((a, x) => a + treatmentValue(x), 0))
    const pending = added.filter(x => x.status === 'planned' || x.status === 'in_progress')
    return {
      done, prevDone, added, prevAdded, unit, pending,
      doneValue: value(done), prevDoneValue: value(prevDone), pendingValue: value(pending),
      byCount: topProcedures(done, { by: 'count', limit: 8 }),
      byValue: topProcedures(done, { by: 'value', limit: 8 }),
      allRanks: topProcedures(done, { by: 'count', limit: 1000 }),
      over: treatmentsOverTime(data.treatments, untilToday(period, today()), unit),
    }
  }, [data, period])
  const text = useBucketText(c?.over ?? [], c?.unit ?? 'day')

  useExport(setExport, c && c.allRanks.length ? {
    name: `procedures_${rangeSlug(period)}.csv`,
    rows: [[t('reports.tr.procedure'), t('reports.tr.times'), t('reports.value')], ...c.allRanks.map(r => [r.name, r.count, r.value])],
  } : null)

  if (c && !c.done.length && !c.added.length) {
    return <EmptyTab icon={<Activity />} title={t('reports.tr.emptyTitle')} desc={t('reports.tr.emptyDesc', { range })} period={period} onShowYear={onShowYear}
      action={<Button to="/treatments" icon={<Activity />}>{t('reports.tr.goTreatments')}</Button>} />
  }
  const loading = !c
  const vs = data?.partial ? t('reports.vsSameDays') : t('reports.vsPrevious')
  const overData = (c?.over ?? []).map((p, i) => ({ label: text[i]?.label ?? '', title: text[i]?.title, values: [p.planned, p.completed] }))
  const overSeries = [{ id: 'planned', label: t('reports.tr.planned'), color: 'var(--rp-c2)' }, { id: 'completed', label: t('reports.tr.completed'), color: 'var(--rp-c1)' }]
  const noDone = c && !c.done.length ? <CardEmpty icon={<Trophy />}>{t('reports.noDataPeriod')}</CardEmpty> : undefined

  return (
    <div className="rp-section" data-testid="rp-treatments">
      <div className="rp-kpis">
        <KpiCard testId="kpi-tr-done" loading={loading} tone="success" icon={<BadgeCheck />} label={t('reports.tr.completedCount')} value={c && <span className="num">{num(c.done.length)}</span>} delta={c ? delta(c.done.length, c.prevDone.length) : undefined} deltaLabel={vs} />
        <KpiCard loading={loading} tone="primary" icon={<Gem />} label={t('reports.tr.completedValue')} value={c && <span className="money">{money(c.doneValue)}</span>} delta={c ? delta(c.doneValue, c.prevDoneValue) : undefined} deltaLabel={vs} />
        <KpiCard loading={loading} tone="accent" icon={<ClipboardList />} label={t('reports.tr.added')} value={c && <span className="num">{num(c.added.length)}</span>} delta={c ? delta(c.added.length, c.prevAdded.length) : undefined} deltaLabel={vs} />
        <KpiCard loading={loading} tone="warning" icon={<Hourglass />} label={t('reports.tr.pendingValue')} value={c && <span className="money">{money(c.pendingValue)}</span>}
          sub={c ? `${t('reports.tr.pendingSub')} · ${plural('reports.n.procedures', c.pending.length)}` : undefined} />
      </div>

      <div className="rp-row even">
        <ChartCard testId="chart-top-count" loading={loading} icon={<Trophy />} title={t('reports.tr.topCount')} subtitle={t('reports.tr.topCountSub')} height={220} empty={noDone}
          table={{ columns: [{ key: 'p', header: t('reports.tr.procedure') }, { key: 'n', header: t('reports.tr.times'), num: true }], rows: (c?.byCount ?? []).map(r => ({ p: r.name, n: <span className="num">{num(r.count)}</span> })) }}>
          <HorizontalBars data={(c?.byCount ?? []).map(r => ({ id: r.key, label: r.name, value: r.count, sub: money(r.value) }))} format={num} title={t('reports.tr.topCount')} tipLabel={t('reports.tr.times')} />
        </ChartCard>
        <ChartCard testId="chart-top-value" loading={loading} icon={<Gem />} title={t('reports.tr.topValue')} subtitle={t('reports.tr.topValueSub')} height={220} empty={noDone}
          table={{ columns: [{ key: 'p', header: t('reports.tr.procedure') }, { key: 'v', header: t('reports.value'), num: true }], rows: (c?.byValue ?? []).map(r => ({ p: r.name, v: <span className="money">{money(r.value)}</span> })) }}>
          <HorizontalBars data={(c?.byValue ?? []).map(r => ({ id: r.key, label: r.name, value: r.value, sub: plural('reports.n.procedures', r.count) }))} color="var(--rp-c2)" format={n => money(n)} title={t('reports.tr.topValue')} tipLabel={t('reports.value')} />
        </ChartCard>
      </div>

      <ChartCard testId="chart-planned" loading={loading} icon={<ListChecks />} title={t('reports.tr.plannedVsDone')} subtitle={t('reports.tr.plannedVsDoneSub')} height={250}
        table={{ columns: [{ key: 'd', header: t('date') }, { key: 'p', header: t('reports.tr.planned'), num: true }, { key: 'c', header: t('reports.tr.completed'), num: true }], rows: overData.filter(d => d.values[0] || d.values[1]).map(d => ({ d: d.title, p: <span className="num">{num(d.values[0])}</span>, c: <span className="num">{num(d.values[1])}</span> })) }}>
        <BarChart data={overData} series={overSeries} height={250} integer format={num} title={t('reports.tr.plannedVsDone')} desc={range} labelPeak={false} />
      </ChartCard>
    </div>
  )
}
