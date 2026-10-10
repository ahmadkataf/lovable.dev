import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Cake, Crown, Megaphone, UserCheck, UserPlus, Users, UsersRound, VenusAndMars } from 'lucide-react'
import { Avatar, Button, Card, CardHeader, DataTable, type Column } from '@/ui'
import { useI18n } from '@/i18n'
import { useMoney } from '@/app/hooks'
import { ageFrom, dateOf, today } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { BarChart, DonutChart } from '../charts'
import { share } from '../chartMath'
import { CardEmpty, ChartCard, KpiCard, ORDINAL, SLOTS, fmtPeriod, useBucketText, usePlural } from '../parts'
import {
  ageBands, chooseUnit, delta, genderSplit, inRange, newPatientsSeries, patientsInScope, patientsSeen, referralSources, topSpenders, untilToday, VISIT_STATUSES,
} from '../queries'
import { EmptyTab, rangeSlug, useExport, type TabProps } from './common'

export default function PatientsTab({ period, data, setExport, onShowYear }: TabProps) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const plural = usePlural()
  const range = fmtPeriod(period, lang)
  const num = (n: number) => formatNumber(n, lang)

  const c = useMemo(() => {
    if (!data) return null
    const visitedNow = new Set(data.appointments.filter(a => VISIT_STATUSES.includes(a.status)).map(a => a.patientId))
    const mine = (ids: Set<string>) => (data.doctorId ? data.patients.filter(p => p.doctorId === data.doctorId || ids.has(p.id)) : data.patients)
    const registered = (p: typeof period) => mine(new Set()).filter(x => inRange(x.createdAt ? dateOf(x.createdAt) : undefined, p))
    const scope = patientsInScope(mine(visitedNow), data.appointments, period)
    const newNow = registered(period), newPrev = registered(data.prev)
    const unit = chooseUnit(period, { dayUpTo: 0, weekUpTo: 92 })
    const ages = scope.map(p => ageFrom(p.birthDate)).filter((a): a is number => a !== null)
    return {
      scope, newNow, newPrev, unit,
      seen: patientsSeen(data.appointments), prevSeen: patientsSeen(data.prevAppointments),
      files: data.patients.filter(p => !p.archived && (!data.doctorId || p.doctorId === data.doctorId)).length,
      avgAge: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
      series: newPatientsSeries(mine(new Set()), untilToday(period, today()), unit),
      gender: genderSplit(scope),
      ages: ageBands(scope),
      refs: referralSources(newNow, 8),
      spenders: topSpenders(data.payments, 10),
    }
  }, [data, period])

  const text = useBucketText(c?.series ?? [], c?.unit ?? 'week')
  const spendRows = c?.spenders ?? []
  useExport(setExport, c && spendRows.length ? {
    name: `top-patients_${rangeSlug(period)}.csv`,
    rows: [[t('fileNo'), t('patient'), t('phone'), t('reports.pat.payments'), t('paid')], ...spendRows.map(s => { const p = data?.patientMap.get(s.patientId); return [p?.fileNo ?? '', p?.name ?? '', p?.phone ?? '', s.payments, s.paid] })],
  } : null)

  if (c && !c.scope.length && !c.newNow.length && !spendRows.length) {
    return <EmptyTab icon={<Users />} title={t('reports.pat.emptyTitle')} desc={t('reports.pat.emptyDesc', { range })} period={period} onShowYear={onShowYear}
      action={<Button to="/patients" icon={<Users />}>{t('reports.pat.goPatients')}</Button>} />
  }
  const loading = !c
  const vs = data?.partial ? t('reports.vsSameDays') : t('reports.vsPrevious')
  const seriesData = (c?.series ?? []).map((p, i) => ({ label: text[i]?.label ?? '', title: text[i]?.title, values: [p.value] }))
  const genderData = c ? [
    { id: 'male', label: t('male'), value: c.gender.male, color: SLOTS[0] },
    { id: 'female', label: t('female'), value: c.gender.female, color: SLOTS[1] },
  ] : []
  const ageData = (c?.ages.bands ?? []).map(b => ({ label: b.id.replace('-', '–'), title: `${t('reports.pat.ageGroup')}: ${b.id.replace('-', '–')}`, values: [b.count] }))
  const refTotal = c ? c.refs.rows.reduce((a, r) => a + r.count, 0) + c.refs.none : 0

  const spendCols: Column<(typeof spendRows)[number]>[] = [
    { key: 'p', header: t('patient'), render: s => { const p = data?.patientMap.get(s.patientId); return (
      <div className="row gap-3" style={{ minWidth: 0 }}>
        <Avatar name={p?.name ?? '?'} src={p?.photo} size="sm" />
        <div className="grow"><Link to={`/patients/${s.patientId}`} className="cell-main truncate" style={{ display: 'block', color: 'var(--text)' }}><bdi>{p?.name ?? t('unknown')}</bdi></Link>
          {p && <div className="cell-sub">{t('fileNo')} <span className="num">{p.fileNo}</span></div>}</div>
      </div>) } },
    { key: 'n', header: t('reports.pat.payments'), className: 'num', hideBelow: 'sm', render: s => <span className="num">{num(s.payments)}</span> },
    { key: 'v', header: t('paid'), className: 'num', render: s => <span className="money">{money(s.paid)}</span> },
  ]

  return (
    <div className="rp-section" data-testid="rp-patients">
      <div className="rp-kpis">
        <KpiCard testId="kpi-new" loading={loading} tone="primary" icon={<UserPlus />} label={t('reports.pat.new')} value={c && <span className="num">{num(c.newNow.length)}</span>} delta={c ? delta(c.newNow.length, c.newPrev.length) : undefined} deltaLabel={vs} />
        <KpiCard loading={loading} tone="accent" icon={<UserCheck />} label={t('reports.pat.seen')} value={c && <span className="num">{num(c.seen)}</span>} delta={c ? delta(c.seen, c.prevSeen) : undefined} deltaLabel={vs} />
        <KpiCard loading={loading} tone="info" icon={<UsersRound />} label={t('reports.pat.files')} value={c && <span className="num">{num(c.files)}</span>} />
        <KpiCard loading={loading} tone="pink" icon={<Cake />} label={t('reports.pat.avgAge')} value={c && (c.avgAge === null ? '—' : t('reports.pat.years', { n: num(c.avgAge) }))}
          sub={c && c.ages.unknown > 0 ? t('reports.pat.ageUnknown', { n: num(c.ages.unknown) }) : undefined} />
      </div>

      <div className="rp-row">
        <ChartCard testId="chart-newpatients" loading={loading} icon={<UserPlus />} title={t('reports.pat.newChart')} subtitle={t('reports.pat.newChartSub', { range })} height={240}
          table={{ columns: [{ key: 'd', header: t('period') }, { key: 'n', header: t('reports.pat.new'), num: true }], rows: seriesData.map(d => ({ d: d.title, n: <span className="num">{num(d.values[0])}</span> })) }}>
          <BarChart fill data={seriesData} series={[{ id: 'new', label: t('reports.pat.new'), color: 'var(--rp-c1)' }]} height={240} integer format={num} title={t('reports.pat.newChart')} desc={range} />
        </ChartCard>
        <ChartCard testId="chart-gender" loading={loading} icon={<VenusAndMars />} title={t('reports.pat.gender')} subtitle={t('reports.pat.genderSub')} height={200}
          empty={c && !c.gender.male && !c.gender.female ? <CardEmpty icon={<VenusAndMars />}>{t('reports.noDataPeriod')}</CardEmpty> : undefined}>
          <DonutChart data={genderData} format={num} centerValue={c ? num(c.gender.male + c.gender.female) : ''} centerLabel={t('patients')} title={t('reports.pat.gender')} desc={range} />
        </ChartCard>
      </div>

      <div className="rp-row even">
        <ChartCard testId="chart-ages" loading={loading} icon={<Cake />} title={t('reports.pat.ages')} subtitle={t('reports.pat.agesSub')} height={220}
          actions={c && c.ages.unknown > 0 ? <span className="text-xs muted hide-mobile">{t('reports.pat.ageUnknown', { n: num(c.ages.unknown) })}</span> : undefined}
          empty={c && !c.ages.bands.some(b => b.count) ? <CardEmpty icon={<Cake />}>{t('reports.noDataPeriod')}</CardEmpty> : undefined}
          table={{ columns: [{ key: 'a', header: t('reports.pat.ageGroup') }, { key: 'n', header: t('patients'), num: true }], rows: ageData.map(d => ({ a: <span className="num">{d.label}</span>, n: <span className="num">{num(d.values[0])}</span> })) }}>
          <BarChart fill data={ageData} series={[{ id: 'age', label: t('patients'), color: 'var(--rp-o3)' }]} barColors={ORDINAL} mirror height={220} integer format={num} title={t('reports.pat.ages')} desc={range} />
        </ChartCard>
        <Card className="rp-card" data-testid="table-referrals">
          <CardHeader icon={<Megaphone />} title={t('reports.pat.referrals')} subtitle={t('reports.pat.referralsSub')} />
          {c && !c.refs.rows.length ? <div className="card-body"><CardEmpty icon={<Megaphone />}>{t('reports.pat.noReferrals')}</CardEmpty></div> : (
            <div className="card-body">
              <DataTable compact rows={c?.refs.rows ?? []} rowKey={r => r.source}
                columns={[
                  { key: 's', header: t('reports.pat.source'), render: r => <span className="strong">{r.source}</span> },
                  { key: 'n', header: t('patients'), className: 'num', render: r => <span className="num">{num(r.count)}</span> },
                  { key: 'p', header: t('reports.share'), className: 'num', render: r => <span className="num muted">{formatNumber(share(r.count, refTotal), lang, 1)}%</span> },
                ]} />
              {c && c.refs.none > 0 && <div className="rp-scope-note mt-3">{t('reports.pat.noSource', { n: num(c.refs.none) })}</div>}
            </div>
          )}
        </Card>
      </div>

      <Card className="rp-card" data-testid="table-spenders">
        <CardHeader icon={<Crown />} title={t('reports.pat.topSpend')} subtitle={t('reports.pat.topSpendSub')} actions={c ? <span className="text-sm muted">{plural('reports.n.patients', spendRows.length)}</span> : undefined} />
        <div className="card-body">
          {c && !spendRows.length ? <CardEmpty icon={<Crown />}>{t('reports.pat.noSpend')}</CardEmpty>
            : <DataTable compact columns={spendCols} rows={spendRows} rowKey={s => s.patientId} />}
        </div>
      </Card>
    </div>
  )
}
