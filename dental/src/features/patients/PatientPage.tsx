import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity, Archive, ArchiveRestore, ArrowLeft, ArrowRight, CalendarClock, CalendarDays, CalendarPlus, Cake, ClipboardCheck, Ellipsis, FlaskConical, FolderOpen, HandCoins,
  HeartPulse, LayoutDashboard, Mail, MapPin, Pencil, Pill, Receipt, ShieldAlert, Stethoscope, Trash, TriangleAlert, UserX, Wallet,
} from 'lucide-react'
import { db, logActivity } from '@/db'
import { nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDoctors, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { ToothIcon } from '@/app/ToothIcon'
import { Avatar, Badge, Button, Card, EmptyState, Menu, Skeleton, Tabs, useConfirmDelete, useToast, type MenuItemDef, type TabItem } from '@/ui'
import { dateOf, fmtDate, fmtTime, relativeDay, timeAgo } from '@/lib/dates'
import { colorFor } from '@/lib/format'
import { latestOf, lastVisitsByPatient, nextAppointment, patientBalance } from './lib'
import { ContactButtons, PatientAvatar, PhoneText, useGenderAge, usePlural } from './parts'
import { deletePatientCascade } from './data'
import PatientOverview from './PatientOverview'

const PatientFormModal = lazy(() => import('./PatientFormModal'))
const AppointmentFormModal = lazy(() => import('@/features/appointments/AppointmentFormModal'))
const PaymentFormModal = lazy(() => import('@/features/billing/PaymentFormModal'))
const DentalChartTab = lazy(() => import('@/features/chart/DentalChartTab'))
const PatientTreatmentsTab = lazy(() => import('@/features/treatments/PatientTreatmentsTab'))
const PatientAppointmentsTab = lazy(() => import('@/features/appointments/PatientAppointmentsTab'))
const PatientBillingTab = lazy(() => import('@/features/billing/PatientBillingTab'))
const PatientPrescriptionsTab = lazy(() => import('@/features/prescriptions/PatientPrescriptionsTab'))
const PatientLabTab = lazy(() => import('@/features/lab/PatientLabTab'))
const PatientFilesTab = lazy(() => import('@/features/files/PatientFilesTab'))

type TabId = 'overview' | 'chart' | 'treatments' | 'appointments' | 'billing' | 'prescriptions' | 'lab' | 'files'

export default function PatientPage() {
  const { id = '' } = useParams()
  const { t, lang, isRTL } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const money = useMoney()
  const doctors = useDoctors()
  const session = useSession()
  const { readOnly } = useLicense()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()
  const plural = usePlural()
  const genderAge = useGenderAge()
  const [modal, setModal] = useState<'edit' | 'appointment' | 'payment' | null>(null)

  // null = not found, undefined = still loading
  const patient = useLiveQuery(async () => (await db.patients.get(id)) ?? null, [id])
  const facts = useLiveQuery(async () => {
    const [invoices, payments, appointments, completed, treatments, prescriptions, labOrders, files, notes] = await Promise.all([
      db.invoices.where('patientId').equals(id).toArray(),
      db.payments.where('patientId').equals(id).toArray(),
      db.appointments.where('patientId').equals(id).toArray(),
      db.treatments.where('[patientId+status]').equals([id, 'completed']).count(),
      db.treatments.where('patientId').equals(id).filter(x => x.status !== 'cancelled').count(),
      db.prescriptions.where('patientId').equals(id).count(),
      db.labOrders.where('patientId').equals(id).count(),
      db.files.where('patientId').equals(id).count(),
      db.notes.where('patientId').equals(id).count(),
    ])
    const now = nowISO()
    return {
      balance: patientBalance(invoices, payments), invoices: invoices.length, appointments, completed, treatments, prescriptions, labOrders, files: files + notes,
      next: nextAppointment(appointments, now), lastVisit: lastVisitsByPatient(appointments, now).get(id),
    }
  }, [id])

  const can = session.can
  const tabs = useMemo(() => {
    const list: (TabItem<TabId> & { show: boolean })[] = [
      { id: 'overview', label: t('patients.tab.overview'), icon: <LayoutDashboard />, show: true },
      { id: 'chart', label: t('patients.tab.chart'), icon: <span className="pt-tab-tooth"><ToothIcon size={17} /></span>, show: can('clinical') },
      { id: 'treatments', label: t('patients.tab.treatments'), icon: <Activity />, count: facts?.treatments || undefined, show: can('clinical') },
      { id: 'appointments', label: t('patients.tab.appointments'), icon: <CalendarDays />, count: facts?.appointments.length || undefined, show: can('appointments') },
      { id: 'billing', label: t('patients.tab.billing'), icon: <Receipt />, count: facts?.invoices || undefined, show: can('billing') },
      { id: 'prescriptions', label: t('patients.tab.prescriptions'), icon: <Pill />, count: facts?.prescriptions || undefined, show: can('clinical') },
      { id: 'lab', label: t('patients.tab.lab'), icon: <FlaskConical />, count: facts?.labOrders || undefined, show: can('clinical') },
      { id: 'files', label: t('patients.tab.files'), icon: <FolderOpen />, count: facts?.files || undefined, show: true },
    ]
    return list.filter(x => x.show).map(({ show: _s, ...x }) => x)
  }, [t, can, facts])
  const requested = params.get('tab') as TabId | null
  const tab: TabId = requested && tabs.some(x => x.id === requested) ? requested : 'overview'
  const setTab = (next: TabId) => setParams(p => { const n = new URLSearchParams(p); if (next === 'overview') n.delete('tab'); else n.set('tab', next); return n }, { replace: true })

  // phones scroll the tab bar sideways: keep the active tab in view (deep links, key-figure shortcuts, counts arriving)
  const tabsRef = useRef<HTMLDivElement>(null)
  const loaded = !!patient
  useLayoutEffect(() => {
    const bar = tabsRef.current?.querySelector<HTMLElement>('.tabs')
    const active = bar?.querySelector<HTMLElement>('.tab.active')
    if (!bar || !active || bar.scrollWidth <= bar.clientWidth) return
    const b = bar.getBoundingClientRect(), a = active.getBoundingClientRect(), pad = 24
    if (a.left < b.left + pad) bar.scrollLeft -= b.left + pad - a.left
    else if (a.right > b.right - pad) bar.scrollLeft += a.right - (b.right - pad)
  }, [tab, tabs, loaded])

  const Back = isRTL ? ArrowRight : ArrowLeft
  if (patient === undefined) return <ProfileSkeleton />
  if (patient === null) {
    return (
      <div className="page">
        <Card><EmptyState icon={<UserX />} title={t('patients.notFound.title')} description={t('patients.notFound.desc')} actions={<Button variant="primary" icon={<Back />} to="/patients">{t('patients.backToList')}</Button>} /></Card>
      </div>
    )
  }

  const doctor = doctors.find(d => d.id === patient.doctorId)
  const age = genderAge(patient)
  const lastVisit = latestOf(patient.lastVisit, facts?.lastVisit)
  const next = facts?.next
  const balance = facts?.balance ?? 0
  const allergies = patient.allergies ?? [], chronic = patient.chronicDiseases ?? [], meds = patient.medications ?? []
  const hasMedical = allergies.length + chronic.length + meds.length > 0

  const toggleArchive = async () => {
    await db.patients.update(patient.id, { archived: !patient.archived, updatedAt: nowISO() })
    void logActivity({ type: 'patient', action: 'status', entityId: patient.id, patientId: patient.id, message: `${patient.name} — ${patient.archived ? t('restore') : t('archive')}`, by: session.user?.id })
    toast.success(t(patient.archived ? 'patients.restoredToast' : 'patients.archivedToast'), patient.name)
  }
  const remove = async () => {
    if (!(await confirmDelete(t('patients.deleteConfirm')))) return
    const { id: pid, name } = patient
    // leave first: the live query would otherwise flash "patient not found" between the delete and the navigation
    navigate('/patients', { replace: true })
    try {
      await deletePatientCascade(pid)
      void logActivity({ type: 'patient', action: 'delete', entityId: pid, message: name, by: session.user?.id })
      toast.success(t('patients.deletedToast'), name)
    } catch {
      toast.error(t('patients.deleteFailed'))
    }
  }
  const moreItems: MenuItemDef[] = [
    { label: patient.archived ? t('restore') : t('archive'), icon: patient.archived ? <ArchiveRestore /> : <Archive />, onClick: () => void toggleArchive(), disabled: readOnly },
    ...(can('manage') ? [{ sep: true }, { label: t('patients.deletePatient'), icon: <Trash />, danger: true, onClick: () => void remove(), disabled: readOnly }] : []),
  ]

  const tabBody: Record<TabId, ReactNode> = {
    overview: <PatientOverview patient={patient} appointments={facts?.appointments} onEdit={readOnly ? undefined : () => setModal('edit')} onBook={can('appointments') && !readOnly ? () => setModal('appointment') : undefined} />,
    chart: <DentalChartTab patientId={patient.id} />,
    treatments: <PatientTreatmentsTab patientId={patient.id} />,
    appointments: <PatientAppointmentsTab patientId={patient.id} />,
    billing: <PatientBillingTab patientId={patient.id} />,
    prescriptions: <PatientPrescriptionsTab patientId={patient.id} />,
    lab: <PatientLabTab patientId={patient.id} />,
    files: <PatientFilesTab patientId={patient.id} />,
  }

  return (
    <div className="page pt-profile">
      <nav className="breadcrumbs pt-crumbs no-print">
        <a href="#/patients" onClick={e => { e.preventDefault(); navigate('/patients') }} className="row gap-1"><Back className="pt-back" />{t('patients.title')}</a>
      </nav>

      <Card className="pt-hero">
        <div className="pt-hero-main">
          <PatientAvatar patient={patient} size="xl" className="pt-hero-avatar" />
          <div className="pt-hero-info">
            <div className="pt-hero-titlebar">
              <h1 className="pt-hero-name">{patient.name}</h1>
              <span className="pt-fileno num">#{patient.fileNo}</span>
              {patient.archived && <Badge icon={<Archive />}>{t('patients.archivedBadge')}</Badge>}
            </div>
            <div className="pt-hero-meta">
              <span className="pt-meta-item">{age}</span>
              {patient.birthDate && <span className="pt-meta-item"><Cake />{fmtDate(patient.birthDate, lang, 'long')}</span>}
              {patient.bloodType && <span className="pt-meta-item"><HeartPulse /><span className="ltr">{patient.bloodType}</span></span>}
              {doctor && <span className="pt-meta-item"><Stethoscope /><Avatar name={doctor.name} size="xs" color={doctor.color || colorFor(doctor.name)} />{doctor.name}</span>}
            </div>
            <div className="pt-hero-contact">
              {patient.phone && <span className="pt-contact-pill"><PhoneText phone={patient.phone} /><ContactButtons phone={patient.phone} /></span>}
              {patient.phone2 && <span className="pt-contact-pill"><PhoneText phone={patient.phone2} /><ContactButtons phone={patient.phone2} /></span>}
              {patient.email && <a className="pt-meta-item pt-link" href={`mailto:${patient.email}`}><Mail /><span className="ltr">{patient.email}</span></a>}
              {patient.address && <span className="pt-meta-item"><MapPin />{patient.address}</span>}
            </div>
            {(patient.tags ?? []).length > 0 && <div className="pt-tags">{patient.tags.map(tg => <Badge key={tg} tone="primary">{tg}</Badge>)}</div>}
          </div>
          <div className={`pt-hero-actions no-print${can('appointments') && can('billing') ? ' compact' : ''}`}>
            <Button className="pt-act-edit" icon={<Pencil />} onClick={() => setModal('edit')} disabled={readOnly} title={t('edit')}>{t('edit')}</Button>
            {can('appointments') && <Button variant="primary" icon={<CalendarPlus />} onClick={() => setModal('appointment')} disabled={readOnly}>{t('patients.newAppointment')}</Button>}
            {can('billing') && <Button variant="soft" icon={<HandCoins />} onClick={() => setModal('payment')} disabled={readOnly}>{t('patients.addPayment')}</Button>}
            <Menu items={moreItems} trigger={() => <Button icon={<Ellipsis />} aria-label={t('more')} title={t('more')} />} />
          </div>
        </div>

        <div className="pt-kpis">
          <Kpi icon={<Wallet />} tone={balance > 0.004 ? 'danger' : balance < -0.004 ? 'success' : 'muted'} label={t('patients.balanceDue')}
            value={facts === undefined ? <Skeleton w={80} h={20} /> : Math.abs(balance) < 0.005 ? <span className="pt-kpi-muted">{t('patients.noBalance')}</span> : <span className={`money ${balance > 0 ? 'neg' : 'pos'}`}>{money(Math.abs(balance))}</span>}
            sub={balance < -0.004 ? t('patients.credit') : undefined} onClick={can('billing') ? () => setTab('billing') : undefined} />
          <Kpi icon={<CalendarClock />} tone={next ? 'primary' : 'muted'} label={t('patients.nextAppointment')}
            value={facts === undefined ? <Skeleton w={80} h={20} /> : next ? relativeDay(dateOf(next.start), lang) : <span className="pt-kpi-muted">{t('patients.noUpcoming')}</span>}
            sub={next ? <bdi className="tnum">{fmtTime(next.start, lang)}</bdi> : undefined} onClick={can('appointments') ? () => setTab('appointments') : undefined} />
          <Kpi icon={<CalendarDays />} tone={lastVisit ? 'info' : 'muted'} label={t('patients.lastVisit')}
            value={facts === undefined ? <Skeleton w={80} h={20} /> : lastVisit ? fmtDate(dateOf(lastVisit), lang) : <span className="pt-kpi-muted">{t('patients.noVisits')}</span>}
            sub={lastVisit ? timeAgo(lastVisit, lang) : undefined} />
          <Kpi icon={<ClipboardCheck />} tone="success" label={t('patients.completedTreatments')}
            value={facts === undefined ? <Skeleton w={40} h={20} /> : <span className="num">{facts.completed}</span>}
            sub={facts && facts.treatments > facts.completed ? plural('pendingTreatments', facts.treatments - facts.completed) : undefined} onClick={can('clinical') ? () => setTab('treatments') : undefined} />
        </div>
      </Card>

      {hasMedical && (
        <div className={`pt-alert${allergies.length ? '' : ' warn'}`} role="alert">
          <span className="pt-alert-icon">{allergies.length ? <ShieldAlert /> : <TriangleAlert />}</span>
          <div className="grow">
            <div className="pt-alert-title">{t('patients.medicalAlert')} <span className="pt-alert-desc">— {t('patients.medicalAlertDesc')}</span></div>
            <div className="pt-alert-groups">
              {allergies.length > 0 && <AlertGroup label={t('patients.allergies')} tone="danger" items={allergies} />}
              {chronic.length > 0 && <AlertGroup label={t('patients.chronicDiseases')} tone="warning" items={chronic} />}
              {meds.length > 0 && <AlertGroup label={t('patients.medications')} tone="info" items={meds} />}
            </div>
          </div>
        </div>
      )}

      <div className="pt-tabs no-print" ref={tabsRef}>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      <div className="pt-tab-body" key={tab}>
        <Suspense fallback={<TabSkeleton />}>{tabBody[tab]}</Suspense>
      </div>

      {modal === 'edit' && <Suspense fallback={null}><PatientFormModal open patient={patient} onClose={() => setModal(null)} /></Suspense>}
      {modal === 'appointment' && <Suspense fallback={null}><AppointmentFormModal open defaults={{ patientId: patient.id }} onClose={() => setModal(null)} /></Suspense>}
      {modal === 'payment' && <Suspense fallback={null}><PaymentFormModal open patientId={patient.id} onClose={() => setModal(null)} /></Suspense>}
    </div>
  )
}

function Kpi({ icon, label, value, sub, tone, onClick }: { icon: ReactNode; label: ReactNode; value: ReactNode; sub?: ReactNode; tone: 'primary' | 'danger' | 'success' | 'info' | 'muted'; onClick?: () => void }) {
  const body = (
    <>
      <span className={`pt-kpi-icon tone-${tone}`}>{icon}</span>
      <span className="grow pt-kpi-text">
        <span className="pt-kpi-label">{label}</span>
        <span className="pt-kpi-value">{value}</span>
        {sub && <span className="pt-kpi-sub">{sub}</span>}
      </span>
    </>
  )
  return onClick ? <button type="button" className="pt-kpi clickable" onClick={onClick}>{body}</button> : <div className="pt-kpi">{body}</div>
}

function AlertGroup({ label, tone, items }: { label: string; tone: 'danger' | 'warning' | 'info'; items: string[] }) {
  return (
    <div className="pt-alert-group">
      <span className="pt-alert-label">{label}:</span>
      {items.map(x => <Badge key={x} tone={tone} size="lg">{x}</Badge>)}
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="grid grid-2">
      {[0, 1].map(i => <Card key={i} pad><Skeleton w="40%" h={16} /><Skeleton className="mt-4" h={12} /><Skeleton className="mt-2" w="80%" h={12} /><Skeleton className="mt-2" w="60%" h={12} /></Card>)}
    </div>
  )
}
function ProfileSkeleton() {
  return (
    <div className="page pt-profile">
      <Skeleton w={90} h={14} className="mb-4" />
      <Card className="pt-hero">
        <div className="pt-hero-main">
          <Skeleton w={88} h={88} r={44} />
          <div className="grow col gap-2"><Skeleton w="35%" h={26} /><Skeleton w="50%" h={14} /><Skeleton w="40%" h={14} /></div>
        </div>
        <div className="pt-kpis">{[0, 1, 2, 3].map(i => <div key={i} className="pt-kpi"><Skeleton w={40} h={40} r={12} /><div className="grow col gap-2"><Skeleton w="60%" h={10} /><Skeleton w="40%" h={18} /></div></div>)}</div>
      </Card>
      <div className="pt-tabs"><Skeleton h={44} /></div>
      <TabSkeleton />
    </div>
  )
}
