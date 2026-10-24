import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './state/store'
import { isBlocked } from './license/types'
import { Shell } from './components/Shell'
import { ToastHost, ConfirmHost } from './components/ui'
import { LockScreen } from './components/LockScreen'
import { BootScreen } from './components/BootScreen'
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
import HelpScreen from './screens/help'
import { startCloudScheduler } from './lib/cloud'
import { setRestartGuard } from './lib/recovery'
import { t } from './i18n'

export default function App() {
  const ready = useStore(s => s.ready)
  const boot = useStore(s => s.boot)
  const user = useStore(s => s.user)
  const license = useStore(s => s.license)
  useEffect(() => { void boot() }, [boot])
  useEffect(() => { if (ready) startCloudScheduler() }, [ready])
  // a restart offered by a stuck screen asks first when the open cart would be lost
  useEffect(() => {
    setRestartGuard(async () => {
      const st = useStore.getState()
      if (!st.ready || !st.cart.lines.length) return true
      return st.confirm({ title: t('restart.cartTitle'), text: t('restart.cartText'), okLabel: t('boot.restart'), danger: true })
    })
    return () => setRestartGuard(null)
  }, [])

  if (!ready) return <BootScreen />
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
          <Route path="/help" element={<HelpScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <ToastHost />
      <ConfirmHost />
      <Onboarding />
    </HashRouter>
  )
}
