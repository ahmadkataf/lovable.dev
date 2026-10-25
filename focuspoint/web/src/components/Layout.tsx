// Customer shell: offline bar, desktop top bar, page, footer, phone bottom nav.
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Icon, OfflineBar, type IconName } from '../ui'
import { useNotifications } from '../lib/notifications'
import { useCached } from '../lib/data'
import type { PublicSettings } from '@shared/types'
import logoUrl from '@shared/logo.svg'

const ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'الرئيسية', icon: 'home' },
  { to: '/mine', label: 'حجوزاتي', icon: 'list' },
  { to: '/inbox', label: 'الإشعارات', icon: 'bell' },
]

function NavItems() {
  const { unread } = useNotifications()
  return (
    <>
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}>
          <span className="nav-ico">
            <Icon name={it.icon} size={22} />
            {it.to === '/inbox' && unread > 0 && <span className="nav-badge" aria-label={`${unread} غير مقروء`}>{unread > 9 ? '9+' : unread}</span>}
          </span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  return (
    <div className="app">
      <OfflineBar />
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="topbar-brand">
            <img src={logoUrl} alt="" width={36} height={36} style={{ borderRadius: '50%' }} />
            <span className="wordmark">Focus Point</span>
          </Link>
          <nav className="topbar-nav" aria-label="التنقل"><NavItems /></nav>
        </div>
      </header>
      <main className="page container">
        <Outlet />
      </main>
      <footer className="footer">
        <div>{settings?.centre_name || 'فوكس بوينت'} — {settings?.address || 'درعا، شارع المجمع الحكومي – بناء العايش'}</div>
        <div className="row center gap wrap" style={{ marginTop: 4 }}>
          <a href={`tel:${settings?.phone || '0985258963'}`} dir="ltr">{settings?.phone || '0985258963'}</a>
          <span aria-hidden="true">·</span>
          <a href={`https://instagram.com/${settings?.instagram || 'its_focus_point'}`} target="_blank" rel="noreferrer" dir="ltr">@{settings?.instagram || 'its_focus_point'}</a>
        </div>
        <Link to="/team" className="footer-team"><Icon name="user" size={14} /> فريق العمل</Link>
      </footer>
      <nav className="bottom-nav" aria-label="التنقل"><NavItems /></nav>
    </div>
  )
}
