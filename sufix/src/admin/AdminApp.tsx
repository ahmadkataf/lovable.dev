import React, { useEffect, useState } from 'react'
import { Link, navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { api, offline } from '../lib/api'
import { Icon } from '../components/Icons'
import { Toasts } from '../components/ui'
import { Logo } from '../components/Layout'
import { Dashboard } from './Dashboard'
import { ProductsPage } from './Products'
import { OrdersPage } from './Orders'
import { TicketsPage } from './Tickets'
import { LedgerPage } from './Ledger'
import { ReportsPage } from './Reports'
import { SettingsPage } from './Settings'

const NAV = [
  { to: '/admin', label: 'لوحة التحكم', icon: Icon.Home },
  { to: '/admin/orders', label: 'الطلبات', icon: Icon.Package },
  { to: '/admin/tickets', label: 'الصيانة', icon: Icon.Wrench },
  { to: '/admin/products', label: 'المنتجات والأقسام', icon: Icon.Grid },
  { to: '/admin/ledger', label: 'دفتر الصادر والوارد', icon: Icon.Book },
  { to: '/admin/reports', label: 'التقارير', icon: Icon.Chart },
  { to: '/admin/settings', label: 'تخصيص الموقع', icon: Icon.Palette },
]

function Login({ setup, onDone }: { setup: boolean; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    if (setup && pw !== pw2) return setErr('كلمتا المرور غير متطابقتين')
    if (pw.length < 6) return setErr('كلمة المرور 6 أحرف على الأقل')
    setBusy(true)
    try { if (setup) await api.admin.setup(pw); else await api.admin.login(pw); onDone() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="login-wrap">
      <form className="card login-box stack" onSubmit={submit}>
        <div className="center"><Logo /></div>
        <h2 className="center" style={{ fontSize: 20 }}>{setup ? 'إعداد لوحة الإدارة' : 'تسجيل الدخول'}</h2>
        {setup && <p className="muted small center">هذه أول مرة تفتح فيها اللوحة. اختر كلمة مرور قوية للإدارة.</p>}
        <div className="field"><label>كلمة المرور</label><input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} autoFocus autoComplete={setup ? 'new-password' : 'current-password'} /></div>
        {setup && <div className="field"><label>تأكيد كلمة المرور</label><input className="input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></div>}
        {err && <p className="error-text">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}><Icon.Lock />{busy ? '…' : setup ? 'إنشاء وبدء' : 'دخول'}</button>
        <Link to="/" className="btn btn-ghost btn-block btn-sm">العودة للموقع</Link>
      </form>
      <Toasts />
    </div>
  )
}

export function AdminApp() {
  const { path } = useRoute()
  const { settings } = useStore()
  const [status, setStatus] = useState<{ setup: boolean; authed: boolean } | null>(null)
  const [side, setSide] = useState(false)
  const refresh = () => api.admin.status().then(setStatus).catch(() => setStatus({ setup: false, authed: false }))
  useEffect(() => { refresh() }, [])
  useEffect(() => setSide(false), [path])
  useEffect(() => {
    // a 401 from any admin call clears the token; re-check so the login shows up
    const onErr = () => refresh()
    window.addEventListener('sufix-unauthorized', onErr)
    return () => window.removeEventListener('sufix-unauthorized', onErr)
  }, [])

  if (!status) return <div className="login-wrap muted">جارٍ التحميل…</div>
  if (!status.authed) return <Login setup={status.setup} onDone={refresh} />

  let page: React.ReactNode
  if (path === '/admin') page = <Dashboard />
  else if (path.startsWith('/admin/orders')) page = <OrdersPage />
  else if (path.startsWith('/admin/tickets')) page = <TicketsPage />
  else if (path.startsWith('/admin/products')) page = <ProductsPage />
  else if (path.startsWith('/admin/ledger')) page = <LedgerPage />
  else if (path.startsWith('/admin/reports')) page = <ReportsPage />
  else if (path.startsWith('/admin/settings')) page = <SettingsPage />
  else page = <Dashboard />

  return (
    <div className="admin">
      <aside className={`admin-side ${side ? 'open' : ''}`}>
        <div className="row-between"><Logo />{side && <button className="icon-btn" onClick={() => setSide(false)}><Icon.X /></button>}</div>
        <span className="sec-label">الإدارة</span>
        {NAV.map(n => { const A = n.icon; const active = n.to === '/admin' ? path === '/admin' : path.startsWith(n.to); return <Link key={n.to} to={n.to} className={active ? 'active' : ''}><A />{n.label}</Link> })}
        <span className="sec-label">الموقع</span>
        <Link to="/"><Icon.Eye />عرض الموقع</Link>
        <button className="side-btn" onClick={async () => { await api.admin.logout(); navigate('/admin'); refresh() }}><Icon.Logout />تسجيل الخروج</button>
        <div style={{ marginTop: 'auto', padding: 12 }} className="hint">{settings.siteName} · لوحة الإدارة{offline ? ' · وضع المعاينة' : ''}</div>
      </aside>
      {side && <div onClick={() => setSide(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.5)' }} />}
      <main className="admin-main">
        <div className="row" style={{ marginBottom: 14 }}>
          <button className="icon-btn menu-btn" onClick={() => setSide(true)} aria-label="القائمة"><Icon.Menu /></button>
          <span className="muted small" style={{ display: 'none' }}>—</span>
        </div>
        {page}
      </main>
      <Toasts />
    </div>
  )
}
