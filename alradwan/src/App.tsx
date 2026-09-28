import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { loadAll, useStore } from './db/store'
import { initSync } from './lib/sync'
import { ToastProvider } from './ui/toast'
import { ConfirmProvider } from './ui/modal'
import { Layout } from './ui/Layout'
import { Dashboard } from './screens/Dashboard'
import { POS } from './screens/POS'
import { Sales } from './screens/Sales'
import { Products } from './screens/Products'
import { Inventory } from './screens/Inventory'
import { Purchases } from './screens/Purchases'
import { Customers } from './screens/Customers'
import { Suppliers } from './screens/Suppliers'
import { Cash } from './screens/Cash'
import { Reports } from './screens/Reports'
import { SettingsScreen } from './screens/Settings'
import { Setup } from './screens/Setup'
import { Login } from './screens/Login'
import { PrintHost } from './print/PrintHost'

function applyTheme(theme: 'light' | 'dark' | 'auto') {
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b1220' : '#0f172a')
}

export function App() {
  const loaded = useStore(s => s.loaded)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadAll().then(initSync).catch(e => setError(String(e?.message ?? e)))
  }, [])
  const theme = useStore(s => s.cfg.theme)
  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => applyTheme(theme)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [theme])

  if (error) return <div className="splash"><img src="./icon.svg" alt="" /><h2>تعذّر فتح قاعدة البيانات</h2><p>{error}</p></div>
  if (!loaded) return <div className="splash"><img src="./icon.svg" alt="" /><p>جارٍ التحميل…</p></div>
  return (
    <ToastProvider>
      <ConfirmProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </ConfirmProvider>
    </ToastProvider>
  )
}

function Gate() {
  const setupDone = useStore(s => s.cfg.setupDone)
  const needsLogin = useStore(s => s.users.size > 0 && !s.currentUserId)
  const isAdmin = useStore(s => { if (s.users.size === 0) return true; const u = s.currentUserId ? s.users.get(s.currentUserId) : null; return u?.role === 'admin' })
  if (!setupDone) return <Setup />
  if (needsLogin) return <Login />
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/suppliers/:id" element={<Suppliers />} />
          <Route path="/cash" element={<Cash />} />
          <Route path="/reports" element={isAdmin ? <Reports /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <PrintHost />
    </>
  )
}
