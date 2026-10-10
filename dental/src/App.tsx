import { lazy, Suspense, useEffect } from 'react'
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom'
import { I18nProvider, useI18n } from '@/i18n'
import { ToastProvider, ConfirmProvider, Loading } from '@/ui'
import { SessionProvider, useSession } from '@/app/session'
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
          { path: '/patients', element: <PatientsPage /> },
          { path: '/patients/:id', element: <PatientPage /> },
          { path: '/appointments', element: <AppointmentsPage /> },
          { path: '/treatments', element: <TreatmentsPage /> },
          { path: '/procedures', element: <ProceduresPage /> },
          { path: '/prescriptions', element: <PrescriptionsPage /> },
          { path: '/lab', element: <LabPage /> },
          { path: '/invoices', element: <InvoicesPage /> },
          { path: '/invoices/:id', element: <InvoicePage /> },
          { path: '/payments', element: <PaymentsPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/expenses', element: <ExpensesPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/staff', element: <StaffPage /> },
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
