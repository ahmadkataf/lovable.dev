import { useMemo } from 'react'
import { CalendarCheck2, CalendarDays, CalendarX2, ChartPie, Stethoscope, UserX } from 'lucide-react'
import { Button, Card, CardHeader, DataTable, ProgressBar, type Column } from '@/ui'
import { useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { APPOINTMENT_STATUSES } from '@/db/types'
import { formatNumber } from '@/lib/format'
import { timeToMinutes } from '@/lib/dates'
import { BarChart, DonutChart } from '../charts'
import { CardEmpty, ChartCard, KpiCard, fmtPeriod, iso, useBucketText } from '../parts'
import { appointmentStats, appointmentsByDoctor, appointmentsSeries, chooseUnit, delta, workingMinutes, type DoctorAptRow } from '../queries'
import { EmptyTab, rangeSlug, useExport, type TabProps } from './common'

export default function AppointmentsTab({ period, data, setExport, onShowYear }: TabProps) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  const range = fmtPeriod(period, lang)
  const num = (n: number, d = 0) => formatNumber(n, lang, d)
  const pct = (v: number) => `${num(v, Number.isInteger(v) ? 0 : 1)}%`

  const c = useMemo(() => {
    if (!data) return null
    const work = workingMinutes(period, clinic)
    const docs = data.users.filter(u => u.active && (u.role === 'doctor' || u.role === 'admin') && (!data.doctorId || u.id === data.doctorId))
    const unit = chooseUnit(period, { dayUpTo: 31, weekUpTo: 190 })
    return {
      work, unit,
      stats: appointmentStats(data.appointments, work),
      prev: appointmentStats(data.prevAppointments),
      series: appointmentsSeries(data.appointments, period, unit),
      rows: appointmentsByDoctor(data.appointments, docs, work),
    }
  }, [data, period, clinic])
  const text = useBucketText(c?.series ?? [], c?.unit ?? 'day')
  const docName = (r: DoctorAptRow) => r.name || t('reports.unassigned')

  useExport(setExport, c && data?.appointments.length ? {
    name: `appointments-by-doctor_${rangeSlug(period)}.csv`,
    rows: [[t('doctor'), t('reports.apt.booked'), t('reports.apt.done'), t('reports.apt.noShow'), t('reports.apt.cancel'), t('reports.apt.hours'), t('reports.apt.utilisation')],
      ...c.rows.map(r => [docName(r), r.booked, r.completed, r.noShows, r.cancelled, Math.round(r.minutes / 6) / 10, r.utilisation === null ? '' : `${r.utilisation}%`])],
  } : null)

  if (c && data && !data.appointments.length) {
    return <EmptyTab icon={<CalendarDays />} title={t('reports.apt.emptyTitle')} desc={t('reports.apt.emptyDesc', { range })} period={period} onShowYear={onShowYear}
      action={<Button to="/appointments" icon={<CalendarDays />}>{t('reports.apt.goCalendar')}</Button>} />
  }
  const loading = !c
  const vs = t('reports.vsPrevious')
  const seriesData = (c?.series ?? []).map((p, i) => ({ label: text[i]?.label ?? '', title: text[i]?.title, values: [p.value] }))
  const statusData = c ? APPOINTMENT_STATUSES.map(s => ({ id: s, label: t(`apt.${s}`), value: c.stats.byStatus[s], color: `var(--st-${s})` })) : []
  const perTitle = c?.unit === 'month' ? t('reports.apt.perMonth') : c?.unit === 'week' ? t('reports.apt.perWeek') : t('reports.apt.perDay')
  const dayHours = Math.max(0, timeToMinutes(clinic.workEnd) - timeToMinutes(clinic.workStart)) / 60
  const totalHours = c ? Math.round(c.work / 60) : 0

  const cols: Column<DoctorAptRow>[] = [
    { key: 'd', header: t('doctor'), render: r => <span className="row gap-2" style={{ minWidth: 0 }}><span className="status-dot" style={{ background: r.color || 'var(--text-4)' }} /><span className="strong truncate">{docName(r)}</span></span> },
    { key: 'b', header: t('reports.apt.booked'), className: 'num', render: r => <span className="num">{num(r.booked)}</span> },
    { key: 'c', header: t('reports.apt.done'), className: 'num', render: r => <span className="num">{num(r.completed)}</span> },
    { key: 'n', header: t('reports.apt.noShow'), className: 'num', hideBelow: 'sm', render: r => <span className={`num${r.noShows ? ' strong' : ' muted'}`} style={r.noShows ? { color: 'var(--danger-text)' } : undefined}>{num(r.noShows)}</span> },
    { key: 'x', header: t('reports.apt.cancel'), className: 'num', hideBelow: 'md', render: r => <span className="num muted">{num(r.cancelled)}</span> },
    { key: 'h', header: t('reports.apt.hours'), className: 'num', hideBelow: 'md', render: r => <span className="num">{num(Math.round(r.minutes / 6) / 10, r.minutes % 60 ? 1 : 0)}</span> },
    { key: 'u', header: t('reports.apt.utilisation'), render: r => r.utilisation === null ? <span className="subtle">—</span> : (
      <div className="rp-util"><ProgressBar value={Math.min(100, r.utilisation)} tone={r.utilisation > 90 ? 'var(--warning)' : 'var(--rp-c1)'} /><span className="num">{pct(r.utilisation)}</span></div>) },
  ]

  return (
    <div className="rp-section" data-testid="rp-appointments">
      <div className="rp-kpis">
        <KpiCard testId="kpi-apt-total" loading={loading} tone="primary" icon={<CalendarDays />} label={t('reports.apt.total')} value={c && <span className="num">{num(c.stats.total)}</span>} delta={c ? delta(c.stats.total, c.prev.total) : undefined} deltaLabel={vs} />
        <KpiCard loading={loading} tone="success" icon={<CalendarCheck2 />} label={t('reports.apt.completed')} value={c && <span className="num">{num(c.stats.completed)}</span>}
          sub={c ? t('reports.apt.completionRate', { pct: iso(pct(c.stats.completionRate)) }) : undefined} />
        <KpiCard loading={loading} tone="orange" icon={<CalendarX2 />} label={t('reports.apt.cancelled')} value={c && <span className="num">{num(c.stats.cancelled)}</span>} delta={c ? delta(c.stats.cancelled, c.prev.cancelled) : undefined} deltaLabel={vs} upIsGood={false} />
        <KpiCard testId="kpi-noshow" loading={loading} tone="danger" icon={<UserX />} label={t('reports.apt.noShowRate')} value={c && <span className="num">{pct(c.stats.noShowRate)}</span>}
          sub={c ? t('reports.apt.noShows', { n: num(c.stats.noShow) }) : undefined} />
      </div>

      <div className="rp-row">
        <ChartCard testId="chart-apt-series" loading={loading} icon={<CalendarDays />} title={perTitle} subtitle={t('reports.apt.perSub')} height={250}
          table={{ columns: [{ key: 'd', header: t('date') }, { key: 'n', header: t('reports.apt.booked'), num: true }], rows: seriesData.filter(d => d.values[0]).map(d => ({ d: d.title, n: <span className="num">{d.values[0]}</span> })) }}>
          <BarChart fill data={seriesData} series={[{ id: 'apt', label: t('reports.apt.booked'), color: 'var(--rp-c1)' }]} height={250} integer format={num} title={perTitle} desc={range} />
        </ChartCard>
        <ChartCard testId="chart-apt-status" loading={loading} icon={<ChartPie />} title={t('reports.apt.byStatus')} subtitle={t('reports.apt.byStatusSub')} height={200}
          table={{ columns: [{ key: 's', header: t('status') }, { key: 'n', header: t('reports.count'), num: true }], rows: statusData.filter(s => s.value).map(s => ({ s: s.label, n: <span className="num">{s.value}</span> })) }}>
          <DonutChart data={statusData} format={num} centerValue={c ? num(c.stats.total) : ''} centerLabel={t('reports.apt.total')} title={t('reports.apt.byStatus')} desc={range} />
        </ChartCard>
      </div>

      <Card className="rp-card" data-testid="table-doctors">
        <CardHeader icon={<Stethoscope />} title={t('reports.apt.perDoctor')} subtitle={t('reports.apt.perDoctorSub', { hours: num(totalHours) })}
          actions={dayHours ? <span className="text-xs muted hide-mobile num">{clinic.workStart}–{clinic.workEnd}</span> : undefined} />
        <div className="card-body">
          {c && !c.rows.length ? <CardEmpty icon={<Stethoscope />}>{t('reports.noDataPeriod')}</CardEmpty>
            : <DataTable compact columns={cols} rows={c?.rows ?? []} rowKey={r => r.doctorId || '_none'} />}
        </div>
      </Card>
    </div>
  )
}
