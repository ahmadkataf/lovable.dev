// The team panel (/team/*): side nav on desktop, bottom tabs on phones. Signed-in team only (RequireTeam shows the
// login screen inline). Everything renders from the offline store; the sync loop runs while the panel is open.
import { useCallback, useEffect, useMemo } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import logoUrl from '@shared/logo.svg'
import { RequireTeam, useTeam } from '../team'
import { Icon, OfflineBar, type IconName } from '../ui'
import { SyncPill } from './common'
import { store, useStore, useSyncLoop } from './store'
import { ensureTeamPush } from './push'
import { Today } from './Today'
import { Bookings } from './Bookings'
import { Rooms } from './Rooms'
import { PlanEditor } from './PlanEditor'
import { Customers } from './Customers'
import { Settings } from './Settings'
import './team.css'

interface NavItem { to: string; label: string; icon: IconName; admin?: boolean; phone?: boolean }
const NAV: NavItem[] = [
  { to: '/team', label: 'اليوم', icon: 'home', phone: true },
  { to: '/team/bookings', label: 'الحجوزات', icon: 'calendar', phone: true },
  { to: '/team/rooms', label: 'القاعات', icon: 'door', phone: true },
  { to: '/team/plan', label: 'المخطط', icon: 'grid', admin: true },
  { to: '/team/customers', label: 'الزبائن', icon: 'people', admin: true },
  { to: '/team/settings', label: 'الإعدادات', icon: 'settings', admin: true, phone: true },
]

function Nav({ items, pending }: { items: NavItem[]; pending: number }) {
  return (
    <>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/team'} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}>
          <span className="nav-ico">
            <Icon name={it.icon} size={22} />
            {it.to === '/team' && pending > 0 && <span className="nav-badge" aria-label={`${pending} بانتظار التحقق`}>{pending > 9 ? '9+' : pending}</span>}
          </span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </>
  )
}

function Shell() {
  const { user, isAdmin, logout, refresh } = useTeam()
  const onUnauthorized = useCallback(() => { void refresh() }, [refresh])
  useSyncLoop(onUnauthorized)
  const { view } = useStore()
  const pending = useMemo(() => view.bookings.filter((b) => b.status === 'awaiting_verification').length, [view.bookings])
  const items = useMemo(() => NAV.filter((n) => isAdmin || !n.admin), [isAdmin])
  const phoneItems = useMemo(() => items.filter((n) => n.phone), [items])

  // Permission already granted on this device → make sure the team account receives push here too.
  const vapid = view.settings?.vapid_public_key
  useEffect(() => { if (vapid) ensureTeamPush(vapid).catch(() => { /* best effort */ }) }, [vapid])

  function signOut() {
    void store.clearBase()
    logout()
  }

  return (
    <div className="tp">
      <OfflineBar />
      <header className="tp-head">
        <div className="tp-brand">
          <img src={logoUrl} alt="" />
          <div>
            <span className="wordmark">Focus Point</span>
            <small>لوحة الفريق</small>
          </div>
        </div>
        <div className="tp-headtools">
          <SyncPill />
          <span className="tp-user"><Icon name="user" size={16} />{user?.name}</span>
          <button type="button" className="icon-btn" onClick={signOut} aria-label="تسجيل الخروج" title="تسجيل الخروج"><Icon name="logout" /></button>
        </div>
      </header>
      <div className="tp-body">
        <nav className="tp-side" aria-label="أقسام اللوحة">
          <Nav items={items} pending={pending} />
          <div className="tp-side-foot">{user?.name} · {isAdmin ? 'مدير' : 'موظف'}</div>
        </nav>
        <main className="tp-main">
          <div className="tp-page">
            <Routes>
              <Route index element={<Today />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="rooms" element={<Rooms />} />
              <Route path="plan" element={<RequireTeam adminOnly><PlanEditor /></RequireTeam>} />
              <Route path="customers" element={<RequireTeam adminOnly><Customers /></RequireTeam>} />
              <Route path="settings/*" element={<RequireTeam adminOnly><Settings /></RequireTeam>} />
              <Route path="*" element={<Navigate to="/team" replace />} />
            </Routes>
          </div>
        </main>
      </div>
      <nav className="tp-tabs" aria-label="أقسام اللوحة"><Nav items={phoneItems} pending={pending} /></nav>
    </div>
  )
}

export default function TeamApp() {
  return (
    <RequireTeam>
      <Shell />
    </RequireTeam>
  )
}
