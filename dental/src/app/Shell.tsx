import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CalendarPlus, ChevronDown, ChevronLeft, LayoutGrid, Lock, LogOut, Plus, Search, Settings as SettingsIcon, UserPlus, Wallet } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useSession } from './session'
import { useClinic, useIsDesktop } from './hooks'
import { useLicense } from '@/license/useLicense'
import { ALL_NAV_ITEMS, BOTTOM_NAV, NAV } from './nav'
import { Avatar, Button, Kbd, Loading, Menu, Modal, type MenuItemDef } from '@/ui'
import { ToothIcon } from './ToothIcon'

const PatientFormModal = lazy(() => import('@/features/patients/PatientFormModal'))
const AppointmentFormModal = lazy(() => import('@/features/appointments/AppointmentFormModal'))
const PaymentFormModal = lazy(() => import('@/features/billing/PaymentFormModal'))
const CommandPalette = lazy(() => import('@/features/search/CommandPalette'))
import NotificationsPanel, { useNotificationCount } from '@/features/search/NotificationsPanel'

const COLLAPSE_KEY = 'dentora.sidebar'

export default function Shell() {
  const { t } = useI18n()
  const session = useSession()
  const clinic = useClinic()
  const license = useLicense()
  const navigate = useNavigate()
  const location = useLocation()
  const desktop = useIsDesktop()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } })
  const [quick, setQuick] = useState<'patient' | 'appointment' | 'payment' | null>(null)
  const [search, setSearch] = useState(false)
  const [notifs, setNotifs] = useState(false)
  const [more, setMore] = useState(false)

  const toggleCollapse = () => setCollapsed(c => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ } return !c })

  // keyboard: Ctrl/⌘+K search, Ctrl/⌘+Shift+N new patient, Ctrl/⌘+Shift+A new appointment
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(s => !s) }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setQuick('patient') }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); setQuick('appointment') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  useEffect(() => { setMore(false) }, [location.pathname])

  const visible = useCallback((perm?: Parameters<typeof session.can>[0]) => !perm || session.can(perm), [session])
  const user = session.user!
  const roleLabel = t(`role.${user.role}`)

  const quickItems: MenuItemDef[] = [
    { label: t('nav.newPatient'), icon: <UserPlus />, onClick: () => setQuick('patient'), shortcut: '⌘⇧N' },
    { label: t('nav.newAppointment'), icon: <CalendarPlus />, onClick: () => setQuick('appointment'), shortcut: '⌘⇧A' },
    ...(session.can('billing') ? [{ label: t('nav.newPayment'), icon: <Wallet />, onClick: () => setQuick('payment') }] : []),
  ]
  const userItems: MenuItemDef[] = [
    { header: user.name },
    { label: t('nav.settings'), icon: <SettingsIcon />, onClick: () => navigate('/settings') },
    { label: t('nav.lock'), icon: <Lock />, onClick: session.lock },
    { sep: true },
    { label: t('nav.logout'), icon: <LogOut />, onClick: session.logout, danger: true },
  ]

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      {/* ---- sidebar (desktop) ---- */}
      <aside className="app-sidebar no-print">
        <div className="brand">
          <div className="brand-logo">{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon />}</div>
          <div className="brand-text grow truncate">
            <div className="brand-name truncate">{clinic.name || t('appName')}</div>
            <div className="brand-sub truncate">{clinic.name ? t('appName') : t('appTagline')}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((g, gi) => {
            const items = g.items.filter(i => visible(i.perm))
            if (!items.length) return null
            return (
              <div key={gi}>
                {g.label && <div className="nav-group">{t(g.label)}</div>}
                {items.map(i => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} data-label={t(i.label)}>
                    <i.icon /><span className="nav-label">{t(i.label)}</span>
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <Menu align="start" vertical="top" items={userItems} trigger={() => (
            <div className="sidebar-user grow">
              <Avatar name={user.name} color={user.color} size="sm" />
              <div className="grow truncate"><div className="u-name truncate">{user.name}</div><div className="u-role">{roleLabel}</div></div>
              <ChevronDown size={16} className="muted" />
            </div>
          )} />
          <Button variant="ghost" size="sm" className="collapse-btn" onClick={toggleCollapse} icon={<ChevronLeft />} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} title={collapsed ? t('nav.expand') : t('nav.collapse')} />
        </div>
      </aside>

      {/* ---- main ---- */}
      <div className="app-main">
        <header className="app-topbar no-print">
          <div className="topbar-mobile-brand">
            <div className="brand-logo">{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon />}</div>
            <span className="truncate" style={{ maxWidth: 160 }}>{clinic.name || t('appName')}</span>
          </div>
          <button type="button" className="topbar-search" onClick={() => setSearch(true)} aria-label={t('quickSearch')}>
            <Search /><span>{t('searchPlaceholder')}</span>{desktop && <Kbd>Ctrl K</Kbd>}
          </button>
          <div className="topbar-actions">
            {!license.readOnly && (
              <Menu items={quickItems} trigger={() => (
                <Button variant="primary" icon={<Plus />} className="hide-mobile" iconEnd={<ChevronDown size={16} />}>{t('new')}</Button>
              )} />
            )}
            {!license.readOnly && <Button variant="primary" icon={<Plus />} className="show-mobile btn-icon" aria-label={t('nav.quickAdd')} onClick={() => setQuick('appointment')} />}
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Button variant="ghost" icon={<Bell />} aria-label={t('nav.notifications')} onClick={() => setNotifs(true)} />
              <NotifDot />
            </span>
            <Menu className="hide-desktop" items={userItems} trigger={() => <span style={{ cursor: 'pointer' }}><Avatar name={user.name} color={user.color} size="sm" /></span>} />
          </div>
        </header>

        {license.status !== 'active' && !license.loading && (
          <div className={`trial-bar no-print${license.status === 'expired' ? ' expired' : ''}`}>
            <span>{license.status === 'expired' ? t('trial.expired') : t('trial.banner', { days: license.daysLeft })}</span>
            <Button size="sm" variant={license.status === 'expired' ? 'danger' : 'secondary'} onClick={() => navigate('/settings/license')}>{t('trial.activate')}</Button>
          </div>
        )}

        <main className="app-content">
          <Suspense fallback={<Loading />}><Outlet /></Suspense>
        </main>
      </div>

      {/* ---- bottom nav (phone / tablet) ---- */}
      <nav className="app-bottomnav no-print">
        {BOTTOM_NAV.filter(i => visible(i.perm)).map(i => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `bn-item${isActive && !more ? ' active' : ''}`}><i.icon /><span className="nav-label">{t(i.label)}</span></NavLink>
        ))}
        <button type="button" className={`bn-item${more ? ' active' : ''}`} onClick={() => setMore(true)}><LayoutGrid /><span className="nav-label">{t('nav.more')}</span></button>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title={t('nav.more')} size="sm">
        <div className="more-user">
          <Avatar name={user.name} color={user.color} />
          <div className="grow truncate"><div className="strong truncate">{user.name}</div><div className="text-sm muted">{roleLabel}</div></div>
          <Button variant="ghost" size="sm" icon={<Lock />} aria-label={t('nav.lock')} onClick={session.lock} />
          <Button variant="ghost" size="sm" icon={<LogOut />} aria-label={t('nav.logout')} onClick={session.logout} />
        </div>
        <div className="more-grid">
          {ALL_NAV_ITEMS.filter(i => visible(i.perm)).map(i => (
            <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `more-item${isActive ? ' active' : ''}`} onClick={() => setMore(false)}><i.icon /><span>{t(i.label)}</span></NavLink>
          ))}
        </div>
      </Modal>

      {/* ---- global overlays ---- */}
      <Suspense fallback={null}>
        {quick === 'patient' && <PatientFormModal open onClose={() => setQuick(null)} onSaved={id => { setQuick(null); navigate(`/patients/${id}`) }} />}
        {quick === 'appointment' && <AppointmentFormModal open onClose={() => setQuick(null)} />}
        {quick === 'payment' && <PaymentFormModal open onClose={() => setQuick(null)} />}
        {search && <CommandPalette open onClose={() => setSearch(false)} />}
        {notifs && <NotificationsPanel open onClose={() => setNotifs(false)} />}
      </Suspense>
    </div>
  )
}

function NotifDot() {
  const n = useNotificationCount()
  return n > 0 ? <span className="notif-dot" /> : null
}

export function PageWrap({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <div className={`page${narrow ? ' page-narrow' : ''}`}>{children}</div>
}
