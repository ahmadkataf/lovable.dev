// Phone bottom app nav (hidden from 768px): الرئيسية / احجز / حجوزاتي / الإشعارات (with the unread badge).
import { NavLink, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '../../ui'
import { useNotifications } from '../../lib/notifications'

const ITEMS: { to: string; label: string; icon: IconName; also?: RegExp }[] = [
  { to: '/', label: 'الرئيسية', icon: 'home' },
  { to: '/book', label: 'احجز', icon: 'calendar', also: /^\/b\// },
  { to: '/mine', label: 'حجوزاتي', icon: 'list' },
  { to: '/inbox', label: 'الإشعارات', icon: 'bell' },
]

export function BottomNav() {
  const { unread } = useNotifications()
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav" aria-label="التنقل">
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'}
          className={({ isActive }) => `nav-item${isActive || (it.also && it.also.test(pathname)) ? ' is-active' : ''}`}>
          <span className="nav-ico">
            <Icon name={it.icon} size={22} />
            {it.to === '/inbox' && unread > 0 && <span className="nav-badge" aria-label={`${unread} غير مقروء`}>{unread > 9 ? '9+' : unread}</span>}
          </span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
