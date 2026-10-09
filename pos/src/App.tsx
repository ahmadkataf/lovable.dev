import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './state/store'
import { isBlocked } from './license/types'
import { Shell } from './components/Shell'
import { ToastHost, ConfirmHost } from './components/ui'
import { LockScreen } from './components/LockScreen'
import Onboarding from './components/Onboarding'
import SalesScreen from './screens/sales'
import ProductsScreen from './screens/products'
import CustomersScreen from './screens/customers'
import InventoryScreen from './screens/inventory'
import HistoryScreen from './screens/history'
import ReportsScreen from './screens/reports'
import ShiftsScreen from './screens/shifts'
import ExpensesScreen from './screens/expenses'
import SettingsScreen from './screens/settings'
import ActivationScreen from './screens/activation'
import { useT } from './i18n'

export default function App() {
  const ready = useStore(s => s.ready)
  const boot = useStore(s => s.boot)
  const user = useStore(s => s.user)
  const license = useStore(s => s.license)
  const t = useT()
  useEffect(() => { void boot() }, [boot])

  if (!ready) {
    return (
      <div className="lock-screen"><div className="col center" style={{ alignItems: 'center' }}><span className="spinner" /><span className="muted small">{t('common.loading')}</span></div></div>
    )
  }
  if (isBlocked(license)) {
    return <><ActivationScreen /><ToastHost /><ConfirmHost /></>
  }
  if (!user) return <><LockScreen /><ToastHost /><ConfirmHost /></>
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<SalesScreen />} />
          <Route path="/products/*" element={<ProductsScreen />} />
          <Route path="/customers/*" element={<CustomersScreen />} />
          <Route path="/inventory/*" element={<InventoryScreen />} />
          <Route path="/history/*" element={<HistoryScreen />} />
          <Route path="/reports/*" element={<ReportsScreen />} />
          <Route path="/shifts/*" element={<ShiftsScreen />} />
          <Route path="/expenses/*" element={<ExpensesScreen />} />
          <Route path="/settings/*" element={<SettingsScreen />} />
          <Route path="/activation" element={<ActivationScreen embedded />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <ToastHost />
      <ConfirmHost />
      <Onboarding />
    </HashRouter>
  )
}
