import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, CalendarCheck2, CalendarDays, CalendarPlus, ChartPie, DatabaseBackup, FlaskConical, HandCoins, Receipt, TrendingUp, Trophy, UserCheck, UserPlus, Wallet } from 'lucide-react'
import { Button, PageHeader } from '@/ui'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useMoney, useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { APPOINTMENT_STATUSES } from '@/db/types'
import { addDays, addMonths, dateOf, daysInMonth, endOfMonth, fmtDate, fmtMonth, startOfMonth, toISODate } from '@/lib/dates'
import { ensureReconciled } from '@/features/billing/actions'
import { formatNumber } from '@/lib/format'
import { AreaChart, DonutChart, HorizontalBars, Sparkline } from '@/features/reports/charts'
import { CardEmpty, ChartCard, KpiCard, iso, useBucketText, usePlural } from '@/features/reports/parts'
import {
  backupAgeDays, backupOverdue, delta, greetingKey, handoverCount, inRange, labDue, lowStock, outstandingTotal, overdueInvoices, patientsSeen, revenueByDay, topProcedures, totalOf,
  unconfirmedTomorrow,
} from '@/features/reports/queries'
import { useDashboardData } from './useDashboardData'
import { Schedule } from './Schedule'
import { ActivityFeed, AlertsCard, type AlertItem } from './Panels'
import './dashboard.css'

const AppointmentFormModal = lazy(() => import('@/features/appointments/AppointmentFormModal'))
const PatientFormModal = lazy(() => import('@/features/patients/PatientFormModal'))
const PaymentFormModal = lazy(() => import('@/features/billing/PaymentFormModal'))

const EMPTY = new Map<string, never>()

/** Re-renders every minute so "now", greetings and today's date stay true on a screen left open all day. */
function useClock(ms = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), ms); return () => window.clearInterval(id) }, [ms])
  return now
}

export default function DashboardPage() {
  const { t, lang } = useI18n()
  const session = useSession()
  const license = useLicense()
  const money = useMoney()
  const plural = usePlural()
  const navigate = useNavigate()
  const users = useUsers(false)
  const clock = useClock()
  const [modal, setModal] = useState<'appointment' | 'patient' | 'payment' | null>(null)

  const today = toISODate(clock)
  const nowIso = clock.toISOString()
  const canMoney = session.can('billing')
  const canApts = session.can('appointments')
  const canReports = session.can('reports')
  const raw = useDashboardData(today, canMoney)
  // records made outside billing (older versions, a restored backup, the demo clinic) are put in line once
  useEffect(() => { if (canMoney && raw.money) void ensureReconciled() }, [canMoney, raw.money])

  const c = useMemo(() => {
    const { schedule, month, money, stock } = raw
    if (!schedule || !month || !money || !stock) return null
    const monthStart = startOfMonth(today)
    const lastStart = addMonths(monthStart, -1)
    // the month's revenue is every payment dated in the calendar month, as Reports → this month counts it;
    // the change compares the month so far with the same days of last month
    const sameDay = Math.min(Number(today.slice(8, 10)), daysInMonth(lastStart))
    const thisMtd = { from: monthStart, to: today }
    const lastMtd = { from: lastStart, to: addDays(lastStart, sameDay - 1) }
    const thisMonth = { from: monthStart, to: endOfMonth(today) }
    const monthApts = month.monthApts.filter(a => inRange(a.date, thisMonth))
    const lastApts = month.monthApts.filter(a => inRange(a.date, lastMtd))
    const from30 = addDays(today, -29)
    const todayLive = schedule.todayApts.filter(a => a.status !== 'cancelled')
    const revMonth = totalOf(money.payments.filter(p => inRange(p.date, thisMonth)))
    const revMtd = totalOf(money.payments.filter(p => inRange(p.date, thisMtd)))
    const revLast = totalOf(money.payments.filter(p => inRange(p.date, lastMtd)))
    const revToday = money.payments.filter(p => p.date === today)
    const statusCounts = APPOINTMENT_STATUSES.map(s => ({ s, n: monthApts.filter(a => a.status === s).length }))
    return {
      todayCount: todayLive.length,
      todayDone: schedule.todayApts.filter(a => a.status === 'completed').length,
      seen: patientsSeen(monthApts.filter(a => a.date <= today)),
      seenLast: patientsSeen(lastApts),
      seenDone: monthApts.filter(a => a.status === 'completed').length,
      newNow: month.newNow,
      newLast: month.newLast,
      revToday: totalOf(revToday), revTodayCount: handoverCount(revToday),
      revMonth, revMtd, revLast,
      rev30: revenueByDay(money.payments, from30, today),
      outstanding: outstandingTotal(money.openInvoices),
      overdue: overdueInvoices(money.openInvoices, today),
      low: lowStock(stock.inventory),
      lab: labDue(stock.labs, today),
      unconfirmed: unconfirmedTomorrow(month.tomorrowApts, today).length,
      statusCounts, monthTotal: monthApts.length,
      top: topProcedures(month.doneThisMonth.filter(x => x.completedAt && inRange(dateOf(x.completedAt), thisMonth)), { by: 'count', limit: 6 }),
    }
  }, [raw, today])
  const backupAge = raw.backup ? backupAgeDays(raw.backup.at, clock) : undefined
  const backupDue = raw.backup !== undefined && backupOverdue(backupAge)

  const revText = useBucketText(c?.rev30 ?? [], 'day')
  const user = session.user
  const firstName = user?.name ?? ''
  const vsLast = t('dashboard.stat.vsLastMonth')
  const loading = !c
  const readOnly = license.readOnly
  const monthName = fmtMonth(today, lang)

  const backupAlert: AlertItem[] = backupDue ? [{
    id: 'backup', to: session.isAdmin ? '/settings/backup' : undefined, icon: DatabaseBackup, tone: 'warning' as const,
    title: backupAge === null ? t('dashboard.alerts.backupNever') : plural('dashboard.alerts.backupOld', backupAge ?? 0),
    sub: session.isAdmin ? t('dashboard.alerts.backupSub') : t('dashboard.alerts.backupAskAdmin'), count: 1, hideCount: true, wrap: true,
  }] : []
  const alerts: AlertItem[] = c ? [
    ...backupAlert,
    ...(canMoney ? [{ id: 'overdue', to: '/invoices', icon: Receipt, tone: 'danger' as const, title: t('dashboard.alerts.overdue'), sub: t('dashboard.alerts.overdueSub', { amount: iso(money(c.overdue.total)) }), count: c.overdue.count }] : []),
    ...(session.can('inventory') ? [{ id: 'stock', to: '/inventory', icon: Boxes, tone: 'warning' as const, title: t('dashboard.alerts.lowStock'), sub: t('dashboard.alerts.lowStockSub'), count: c.low.length }] : []),
    ...(session.can('clinical') ? [{ id: 'lab', to: '/lab', icon: FlaskConical, tone: 'accent' as const, title: t('dashboard.alerts.lab'), sub: t('dashboard.alerts.labSub', { late: formatNumber(c.lab.late, lang), today: formatNumber(c.lab.today, lang) }), count: c.lab.late + c.lab.today }] : []),
    ...(canApts ? [{ id: 'unconfirmed', to: `/appointments?view=day&date=${addDays(today, 1)}`, icon: CalendarDays, tone: 'info' as const, title: t('dashboard.alerts.unconfirmed'), sub: t('dashboard.alerts.unconfirmedSub'), count: c.unconfirmed }] : []),
  ] : []

  const revData = (c?.rev30 ?? []).map((p, i) => ({ label: revText[i]?.label ?? '', title: revText[i]?.title, values: [p.value] }))
  const rev30Total = c ? c.rev30.reduce((a, p) => a + p.value, 0) : 0
  const statusData = (c?.statusCounts ?? []).map(({ s, n }) => ({ id: s, label: t(`apt.${s}`), value: n, color: `var(--st-${s})` }))
  const disabledTitle = readOnly ? t('trial.readonly') : undefined

  return (
    <div className="page rp-dashboard" data-testid="dashboard">
      <PageHeader
        title={<span data-testid="dash-greeting">{t('dashboard.greeting', { hello: t(greetingKey(clock.getHours())), name: `\u2068${firstName}\u2069` })}</span>}
        subtitle={<span className="row gap-2"><CalendarCheck2 size={16} className="muted" style={{ flex: 'none' }} />{fmtDate(today, lang, 'weekday')}</span>}
        actions={<>
          {canApts && <Button variant="primary" icon={<CalendarPlus />} onClick={() => setModal('appointment')} disabled={readOnly} title={disabledTitle} data-testid="dash-new-apt">{t('nav.newAppointment')}</Button>}
          {session.can('patients') && <Button icon={<UserPlus />} onClick={() => setModal('patient')} disabled={readOnly} title={disabledTitle} data-testid="dash-new-patient">{t('nav.newPatient')}</Button>}
          {canMoney && <Button icon={<Wallet />} onClick={() => setModal('payment')} disabled={readOnly} title={disabledTitle} data-testid="dash-new-payment">{t('nav.newPayment')}</Button>}
        </>} />

      <div className={`rp-kpis rp-dash-kpis${canMoney ? '' : ' cols-3'}`}>
        <KpiCard testId="stat-today" loading={loading} to={`/appointments?view=day&date=${today}`} tone="primary" icon={<CalendarDays />} label={t('dashboard.stat.today')}
          value={c && <span className="num">{formatNumber(c.todayCount, lang)}</span>}
          sub={c ? (c.todayCount ? t('dashboard.stat.todayDone', { n: formatNumber(c.todayDone, lang) }) : t('dashboard.stat.todayNone')) : undefined} />
        <KpiCard testId="stat-seen" loading={loading} to="/patients" tone="accent" icon={<UserCheck />} label={t('dashboard.stat.seen')}
          value={c && <span className="num">{formatNumber(c.seen, lang)}</span>} delta={c ? delta(c.seen, c.seenLast) : undefined} deltaLabel={vsLast} />
        <KpiCard testId="stat-new" loading={loading} to="/patients" tone="pink" icon={<UserPlus />} label={t('dashboard.stat.new')}
          value={c && <span className="num">{formatNumber(c.newNow, lang)}</span>} delta={c ? delta(c.newNow, c.newLast) : undefined} deltaLabel={vsLast} />
        {canMoney && <>
          <KpiCard testId="stat-rev-today" loading={loading} to="/payments" tone="success" icon={<Wallet />} label={t('dashboard.stat.revenueToday')}
            value={c && <span className="money">{money(c.revToday)}</span>} sub={c ? (c.revTodayCount ? plural('dashboard.n.payments', c.revTodayCount) : t('dashboard.stat.noPaymentsToday')) : undefined} />
          <KpiCard testId="stat-rev-month" loading={loading} to={canReports ? '/reports' : '/payments'} tone="info" icon={<TrendingUp />} label={t('dashboard.stat.revenueMonth')}
            value={c && <span className="money">{money(c.revMonth)}</span>} delta={c ? delta(c.revMtd, c.revLast) : undefined} deltaLabel={vsLast}
            spark={c && c.rev30.some(p => p.value) && <Sparkline values={c.rev30.map(p => p.value)} labels={revText.map(x => x.title)} format={n => money(n)} title={t('dashboard.rev.title')} height={38} color="var(--rp-c5)" />} />
          <KpiCard testId="stat-outstanding" loading={loading} to={canReports ? '/reports?tab=outstanding' : '/invoices'} tone="danger" icon={<HandCoins />} label={t('dashboard.stat.outstanding')}
            value={c && <span className="money">{money(c.outstanding.total)}</span>} sub={c && c.outstanding.patients ? plural('dashboard.n.patients', c.outstanding.patients) : undefined} />
        </>}
      </div>

      <div className="rp-dash">
        <div className="rp-dash-main">
          <Schedule apts={raw.schedule?.todayApts} patients={raw.schedule?.schedulePatients ?? EMPTY} users={users} now={nowIso} readOnly={readOnly} canWrite={canApts}
            onAdd={() => setModal('appointment')} />
          {canMoney && (
            <div style={{ order: 3 }}>
              <ChartCard testId="dash-revenue" loading={loading} icon={<TrendingUp />} title={t('dashboard.rev.title')} subtitle={c ? t('dashboard.rev.sub', { amount: iso(money(rev30Total)) }) : undefined} height={220}
                actions={canReports ? <Button size="sm" variant="ghost" className="rp-hide-phone" onClick={() => navigate('/reports')}>{t('dashboard.openReports')}</Button> : undefined}
                empty={c && !c.rev30.some(p => p.value) ? <CardEmpty icon={<Wallet />}>{t('dashboard.rev.empty')}</CardEmpty> : undefined}
                table={{ columns: [{ key: 'd', header: t('date') }, { key: 'v', header: t('reports.fin.revenue'), num: true }], rows: revData.filter(d => d.values[0]).reverse().map(d => ({ d: d.title, v: <span className="money">{money(d.values[0])}</span> })) }}>
                <AreaChart data={revData} series={[{ id: 'rev', label: t('reports.fin.revenue'), color: 'var(--rp-c1)' }]} height={220} format={n => money(n)} title={t('dashboard.rev.title')} />
              </ChartCard>
            </div>
          )}
          <div style={{ order: 5 }}>
            <ChartCard testId="dash-top" loading={loading} icon={<Trophy />} title={t('dashboard.top.title')} subtitle={monthName} height={180}
              empty={c && !c.top.length ? <CardEmpty icon={<Trophy />}>{t('dashboard.top.empty')}</CardEmpty> : undefined}>
              <HorizontalBars data={(c?.top ?? []).map(r => ({ id: r.key, label: r.name, value: r.count, sub: canMoney ? money(r.value) : undefined }))} format={n => formatNumber(n, lang)} title={t('dashboard.top.title')} tipLabel={t('dashboard.top.times')} />
            </ChartCard>
          </div>
        </div>
        <div className="rp-dash-side">
          <AlertsCard items={alerts} loading={loading} style={{ order: 2 }} />
          <div style={{ order: 4 }}>
            <ChartCard testId="dash-status" loading={loading} icon={<ChartPie />} title={t('dashboard.status.title')} subtitle={monthName} height={180}
              empty={c && !c.monthTotal ? <CardEmpty icon={<CalendarDays />}>{t('dashboard.status.empty')}</CardEmpty> : undefined}>
              <DonutChart data={statusData} format={n => formatNumber(n, lang)} centerValue={c ? formatNumber(c.monthTotal, lang) : ''} centerLabel={t('dashboard.status.center')} title={t('dashboard.status.title')} size={156} />
            </ChartCard>
          </div>
          <ActivityFeed items={raw.activity} users={users} style={{ order: 6 }} />
        </div>
      </div>

      <Suspense fallback={null}>
        {modal === 'appointment' && <AppointmentFormModal open onClose={() => setModal(null)} defaults={{ date: today }} />}
        {modal === 'patient' && <PatientFormModal open onClose={() => setModal(null)} onSaved={id => { setModal(null); navigate(`/patients/${id}`) }} />}
        {modal === 'payment' && <PaymentFormModal open onClose={() => setModal(null)} />}
      </Suspense>
    </div>
  )
}
