import React, { lazy, Suspense, useEffect } from 'react'
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { I18nProvider, useI18n } from '@/i18n'
import { ToastProvider, ConfirmProvider, Loading, EmptyState, Button } from '@/ui'
import { SessionProvider, useSession, type Permission } from '@/app/session'
import { ShieldAlert } from 'lucide-react'
import { useClinicMaybe } from '@/app/hooks'
import Shell from '@/app/Shell'
import { ensureClinic } from '@/db'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const PatientsPage = lazy(() => import('@/features/patients/PatientsPage'))
const PatientPage = lazy(() => import('@/features/patients/PatientPage'))
const AppointmentsPage = lazy(() => import('@/features/appointments/AppointmentsPage'))
const TreatmentsPage = lazy(() => import('@/features/treatments/TreatmentsPage'))
const ProceduresPage = lazy(() => import('@/features/treatments/ProceduresPage'))
const PrescriptionsPage = lazy(() => import('@/features/prescriptions/PrescriptionsPage'))
const LabPage = lazy(() => import('@/features/lab/LabPage'))
const InvoicesPage = lazy(() => import('@/features/billing/InvoicesPage'))
const InvoicePage = lazy(() => import('@/features/billing/InvoicePage'))
const PaymentsPage = lazy(() => import('@/features/billing/PaymentsPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const StaffPage = lazy(() => import('@/features/staff/StaffPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const SetupPage = lazy(() => import('@/features/auth/SetupPage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))

/** Applies the clinic's language and theme to the document, and routes to setup / login when needed. */
function Gate() {
  const clinic = useClinicMaybe()
  const session = useSession()
  const { setLang } = useI18n()
  const location = useLocation()
  useEffect(() => { if (clinic?.setupDone) setLang(clinic.lang) }, [clinic?.lang, clinic?.setupDone, setLang])
  useEffect(() => { document.documentElement.dataset.theme = clinic?.theme === 'dark' ? 'dark' : 'light' }, [clinic?.theme])
  if (!clinic || !session.ready) return <Loading />
  if (!clinic.setupDone || session.users.length === 0) return location.pathname === '/setup' ? <Outlet /> : <Navigate to="/setup" replace />
  if (location.pathname === '/setup') return <Navigate to="/" replace />
  if (!session.user) return location.pathname === '/login' ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (location.pathname === '/login') return <Navigate to={(location.state as any)?.from || '/'} replace />
  return <Outlet />
}

/** A page the signed-in role may not open shows a calm explanation instead of the page. */
function Guard({ perm, children }: { perm: Permission; children: React.ReactNode }) {
  const session = useSession()
  const { t } = useI18n()
  if (session.can(perm)) return <>{children}</>
  return <div className="page"><EmptyState icon={<ShieldAlert />} title={t('noPermission')} description={t('noPermissionDesc')} actions={<Button variant="primary" to="/">{t('nav.dashboard')}</Button>} /></div>
}
const g = (perm: Permission, el: React.ReactNode) => <Guard perm={perm}>{el}</Guard>

const router = createHashRouter([
  {
    element: <Gate />,
    children: [
      { path: '/setup', element: <SetupPage /> },
      { path: '/login', element: <LoginPage /> },
      {
        element: <Shell />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/patients', element: g('patients', <PatientsPage />) },
          { path: '/patients/:id', element: g('patients', <PatientPage />) },
          { path: '/appointments', element: g('appointments', <AppointmentsPage />) },
          { path: '/treatments', element: g('clinical', <TreatmentsPage />) },
          { path: '/procedures', element: g('manage', <ProceduresPage />) },
          { path: '/prescriptions', element: g('clinical', <PrescriptionsPage />) },
          { path: '/lab', element: g('clinical', <LabPage />) },
          { path: '/invoices', element: g('billing', <InvoicesPage />) },
          { path: '/invoices/:id', element: g('billing', <InvoicePage />) },
          { path: '/payments', element: g('billing', <PaymentsPage />) },
          { path: '/inventory', element: g('inventory', <InventoryPage />) },
          { path: '/expenses', element: g('manage', <ExpensesPage />) },
          { path: '/reports', element: g('reports', <ReportsPage />) },
          { path: '/staff', element: g('staff', <StaffPage />) },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/settings/:tab', element: <SettingsPage /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
])

export default function App() {
  useEffect(() => { void ensureClinic() }, [])
  return (
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <SessionProvider>
            <Suspense fallback={<Loading />}><RouterProvider router={router} /></Suspense>
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
