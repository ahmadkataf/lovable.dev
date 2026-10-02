import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { loadAll, logout, userCan, useStore } from './db/store'
import { dbBlocked } from './db/db'
import { downloadBackup } from './lib/backup'
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
import { Trash } from './screens/Trash'
import { Activity } from './screens/Activity'
import { Cars } from './screens/Cars'
import { Accounting } from './screens/Accounting'
import { Activate } from './screens/Activate'
import { licenseAllows, startLicenseChecks, useLicense } from './lib/license'
import { autoBackupIfDue } from './lib/backup'

function applyTheme(theme: 'light' | 'dark' | 'auto') {
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b1220' : '#ffffff')
}

/** If a screen ever throws, the shop sees a message and a backup button, never a blank page. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('screen error', error, info.componentStack) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="splash" style={{ padding: 20, textAlign: 'center' }}>
        <img src="./icon.svg" alt="" />
        <h2>حدث خطأ غير متوقع</h2>
        <p className="muted">بياناتك محفوظة. أعد فتح البرنامج، وإن تكرر الخطأ أرسل صورة لهذه الرسالة إلى الدعم.</p>
        <pre dir="ltr" style={{ fontSize: 11, maxWidth: 600, whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>{String(this.state.error?.message)}</pre>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => { location.hash = '#/'; location.reload() }}>إعادة فتح البرنامج</button>
          <button className="btn" onClick={() => downloadBackup().catch(() => {})}>نسخة احتياطية الآن</button>
        </div>
      </div>
    )
  }
}

/** Locks the screen after the chosen minutes without a touch or a key. */
function useAutoLock() {
  const minutes = useStore(s => s.cfg.autoLockMinutes)
  const active = useStore(s => s.users.size > 0 && !!s.currentUserId)
  useEffect(() => {
    if (!minutes || !active) return
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, touch, { passive: true }))
    const t = setInterval(() => { if (Date.now() - last > minutes * 60000) logout('auto') }, 5000)
    return () => { events.forEach(e => window.removeEventListener(e, touch)); clearInterval(t) }
  }, [minutes, active])
}

export function App() {
  const loaded = useStore(s => s.loaded)
  const [error, setError] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    loadAll().then(initSync).then(() => { startLicenseChecks(); return autoBackupIfDue().catch(() => {}) }).catch(e => setError(String(e?.message ?? e)))
    const t = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(t)
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
  if (!loaded) return (
    <div className="splash"><img src="./icon.svg" alt="" /><p>جارٍ التحميل…</p>
      {slow && <div className="card pad" style={{ maxWidth: 420, textAlign: 'center' }}><p>{dbBlocked ? 'نافذة أخرى من البرنامج ما زالت مفتوحة بنسخة أقدم. أغلقها ثم أعد المحاولة.' : 'التحميل يأخذ وقتاً أطول من المعتاد.'}</p><button className="btn primary mt" onClick={() => location.reload()}>إعادة المحاولة</button></div>}
    </div>
  )
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <HashRouter>
            <Gate />
          </HashRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

function Gate() {
  useAutoLock()
  const setupDone = useStore(s => s.cfg.setupDone)
  const needsLogin = useStore(s => s.users.size > 0 && !s.currentUserId)
  const shopName = useStore(s => s.cfg.shopName)
  const licState = useLicense(l => l.state)
  const isAdmin = useStore(s => { if (s.users.size === 0) return true; const u = s.currentUserId ? s.users.get(s.currentUserId) : null; return u?.role === 'admin' })
  // one string, not an object: a selector returning a fresh object re-renders on every store change
  const permKeys = ['sell', 'purchases', 'cars', 'reports', 'accounting', 'activity'] as const
  const permStr = useStore(s => { const u = s.currentUserId ? s.users.get(s.currentUserId) : null; const none = s.users.size === 0; return permKeys.map(k => userCan(u, k, s.cfg, none)).join(',') })
  const perms = Object.fromEntries(permKeys.map((k, i) => [k, permStr.split(',')[i] === 'true'])) as Record<typeof permKeys[number], boolean>
  if (!setupDone) return <Setup />
  // a sold build: after the trial (or when the subscription ends) the app waits for a code; the data stays
  if (!licenseAllows(licState)) return <Activate shopName={shopName} />
  if (needsLogin) return <Login />
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={perms.sell ? <POS /> : <Navigate to="/" replace />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchases" element={perms.purchases ? <Purchases /> : <Navigate to="/" replace />} />
          <Route path="/cars" element={perms.cars ? <Cars /> : <Navigate to="/" replace />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/suppliers/:id" element={<Suppliers />} />
          <Route path="/cash" element={<Cash />} />
          <Route path="/reports" element={perms.reports ? <Reports /> : <Navigate to="/" replace />} />
          <Route path="/accounting" element={perms.accounting ? <Accounting /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/activity" element={perms.activity ? <Activity /> : <Navigate to="/" replace />} />
          <Route path="/trash" element={isAdmin ? <Trash /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <PrintHost />
    </>
  )
}
