import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Activity, CalendarDays, CalendarRange, Download, HandCoins, Printer, ShieldAlert, Users, Wallet } from 'lucide-react'
import { Button, Card, EmptyState, Input, PageHeader, Segmented, Select, Tabs, useToast, type TabItem } from '@/ui'
import { useI18n } from '@/i18n'
import { useClinic, useDoctors } from '@/app/hooks'
import { useSession } from '@/app/session'
import { print } from '@/platform'
import { fmtDate, today } from '@/lib/dates'
import { downloadCSV, fmtPeriod, ChartSkeleton } from './parts'
import { isISODate, PERIOD_PRESETS, resolvePeriod, type PeriodPreset } from './queries'
import { useReportData } from './useReportData'
import type { ExportSpec } from './tabs/common'
import FinancialTab from './tabs/FinancialTab'
import './reports.css'

const PatientsTab = lazy(() => import('./tabs/PatientsTab'))
const AppointmentsTab = lazy(() => import('./tabs/AppointmentsTab'))
const TreatmentsTab = lazy(() => import('./tabs/TreatmentsTab'))
const OutstandingTab = lazy(() => import('./tabs/OutstandingTab'))

type TabId = 'financial' | 'patients' | 'appointments' | 'treatments' | 'outstanding'
const TABS: TabId[] = ['financial', 'patients', 'appointments', 'treatments', 'outstanding']
const PREF_KEY = 'dentora.reports.preset'

function storedPreset(): PeriodPreset {
  try { const v = localStorage.getItem(PREF_KEY) as PeriodPreset | null; if (v && PERIOD_PRESETS.includes(v) && v !== 'custom') return v } catch { /* ignore */ }
  return 'month'
}

export default function ReportsPage() {
  const { t } = useI18n()
  const session = useSession()
  // the route itself is open to every signed-in user: clinic finances stay with the roles allowed to see reports
  if (!session.can('reports')) {
    return (
      <div className="page" data-testid="reports-denied">
        <Card><EmptyState icon={<ShieldAlert />} title={t('reports.noPermission')} description={t('reports.noPermissionSub')} actions={<Button variant="primary" to="/">{t('reports.backHome')}</Button>} /></Card>
      </div>
    )
  }
  return <Reports />
}

function Reports() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const clinic = useClinic()
  const doctors = useDoctors()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as TabId | null
  const tab: TabId = tabParam && TABS.includes(tabParam) ? tabParam : 'financial'
  const setTab = (id: TabId) => setParams(p => { const n = new URLSearchParams(p); n.set('tab', id); return n }, { replace: true })

  const [preset, setPresetState] = useState<PeriodPreset>(storedPreset)
  const [custom, setCustom] = useState(() => { const p = resolvePeriod('month', today()); return { from: p.from, to: today() } })
  const [doctorId, setDoctorId] = useState('')
  const setPreset = useCallback((p: PeriodPreset) => {
    setPresetState(p)
    if (p !== 'custom') { try { localStorage.setItem(PREF_KEY, p) } catch { /* ignore */ } }
  }, [])
  const period = useMemo(() => resolvePeriod(preset, today(), custom), [preset, custom])
  const fromErr = preset === 'custom' && !isISODate(custom.from) ? t('v.date') : undefined
  const toErr = preset === 'custom' && !isISODate(custom.to) ? t('v.date') : undefined
  const swapped = preset === 'custom' && !fromErr && !toErr && custom.from > custom.to

  const data = useReportData(period, tab === 'outstanding' ? '' : doctorId)
  const [exp, setExp] = useState<ExportSpec | null>(null)
  const setExport = useCallback((e: ExportSpec | null) => setExp(e), [])
  const showYear = useCallback(() => setPreset('year'), [setPreset])

  const range = fmtPeriod(period, lang)
  // on a phone the tab strip scrolls: keep the active tab in view
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.rp-tabs .tab.active')
    const strip = el?.parentElement
    if (el && strip && strip.scrollWidth > strip.clientWidth) el.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [tab])
  const doctor = doctors.find(d => d.id === doctorId)
  const exportCsv = async () => {
    if (!exp) { toast.info(t('reports.csvNothing')); return }
    const ok = await downloadCSV(exp.name, exp.rows)
    if (ok) toast.success(t('reports.csvSaved'), exp.name)
  }

  const tabs: TabItem<TabId>[] = [
    { id: 'financial', label: t('reports.tab.financial'), icon: <Wallet /> },
    { id: 'patients', label: t('reports.tab.patients'), icon: <Users /> },
    { id: 'appointments', label: t('reports.tab.appointments'), icon: <CalendarDays /> },
    { id: 'treatments', label: t('reports.tab.treatments'), icon: <Activity /> },
    { id: 'outstanding', label: t('reports.tab.outstanding'), icon: <HandCoins /> },
  ]
  const tabProps = { period, data, setExport, onShowYear: preset === 'year' ? undefined : showYear }
  const periodless = tab === 'outstanding'

  return (
    <div className="page rp-page" data-testid="reports-page">
      <div className="rp-print-head">
        <div className="rp-ph-title">{clinic.name || t('appName')} — {t('reports.title')}: {t(`reports.tab.${tab}`)}</div>
        <div className="rp-ph-sub">{periodless ? t('reports.out.asOf', { date: fmtDate(today(), lang, 'long') }) : range}{doctor && !periodless ? ` · ${doctor.name}` : ''} · {t('reports.printedOn', { date: fmtDate(new Date(), lang) })}</div>
      </div>
      <PageHeader className="no-print"
        title={t('reports.title')}
        subtitle={<span className="row gap-2" style={{ alignItems: 'flex-start' }} data-testid="rp-range"><CalendarRange size={16} className="muted" style={{ flex: 'none', marginTop: 3 }} /><strong style={{ color: 'var(--text)' }}>{periodless ? t('reports.out.asOf', { date: fmtDate(today(), lang, 'long') }) : range}</strong>{doctor && !periodless && <span className="muted">· <bdi>{doctor.name}</bdi></span>}</span>}
        actions={<>
          <Button icon={<Printer />} onClick={() => print()}>{t('print')}</Button>
          <Button variant="primary" icon={<Download />} onClick={exportCsv} disabled={!exp} data-testid="rp-csv">{t('reports.exportCsv')}</Button>
        </>} />

      {!periodless && (
        <Card className="rp-periodbar no-print" data-testid="rp-periodbar">
          <div className="rp-seg-scroll">
            <Segmented value={preset} onChange={setPreset} options={PERIOD_PRESETS.map(p => ({ value: p, label: t(`reports.preset.${p}`) }))} />
          </div>
          {preset === 'custom' && (
            <div className="rp-range">
              <Input type="date" aria-label={t('reports.fromDate')} title={t('reports.fromDate')} value={custom.from} error={fromErr} data-testid="rp-from"
                onChange={e => { const v = e.target.value; setCustom(c => ({ ...c, from: v })) }} />
              <span className="muted" style={{ alignSelf: 'center' }}>–</span>
              <Input type="date" aria-label={t('reports.toDate')} title={t('reports.toDate')} value={custom.to} error={toErr} data-testid="rp-to"
                onChange={e => { const v = e.target.value; setCustom(c => ({ ...c, to: v })) }} />
            </div>
          )}
          {swapped && <span className="rp-range-err" role="status">{t('reports.rangeSwapped')}</span>}
          <Select className="rp-doctor" aria-label={t('reports.doctorFilter')} value={doctorId} onChange={e => setDoctorId(e.target.value)} data-testid="rp-doctor"
            options={[{ value: '', label: t('reports.allDoctors') }, ...doctors.map(d => ({ value: d.id, label: d.name }))]} />
        </Card>
      )}

      <Tabs className="rp-tabs" tabs={tabs} value={tab} onChange={setTab} />

      <Suspense fallback={<Card className="rp-card"><div className="card-body"><ChartSkeleton height={280} /></div></Card>}>
        {tab === 'financial' && <FinancialTab key={`f${doctorId}`} {...tabProps} />}
        {tab === 'patients' && <PatientsTab {...tabProps} />}
        {tab === 'appointments' && <AppointmentsTab {...tabProps} />}
        {tab === 'treatments' && <TreatmentsTab {...tabProps} />}
        {tab === 'outstanding' && <OutstandingTab {...tabProps} />}
      </Suspense>
    </div>
  )
}
