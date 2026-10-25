// Sticky white site header: logo + wordmark, the site links, the inbox bell and «احجز الآن».
// On phones (< 900px) the links move into a full-height menu sheet opened by the menu button.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import logoUrl from '@shared/logo.svg'
import { Icon, type IconName } from '../../ui'
import { useNotifications } from '../../lib/notifications'
import { useCentre } from './centre'
import { shortClock } from '../../format'

export const SITE_LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '/spaces', label: 'المساحات', icon: 'grid' },
  { to: '/about', label: 'من نحن', icon: 'people' },
  { to: '/contact', label: 'تواصل', icon: 'phone' },
  { to: '/mine', label: 'حجوزاتي', icon: 'list' },
]

function Brand() {
  return (
    <Link to="/" className="site-brand" aria-label="فوكس بوينت — الصفحة الرئيسية">
      <img src={logoUrl} alt="" width={38} height={38} />
      <span>
        <span className="wordmark">Focus Point</span>
        <small>فوكس بوينت · درعا</small>
      </span>
    </Link>
  )
}

const UnreadBadge = ({ n }: { n: number }) =>
  n > 0 ? <span className="nav-badge" aria-label={`${n} غير مقروء`}>{n > 9 ? '9+' : n}</span> : null

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { unread } = useNotifications()
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Brand />
        <nav className="site-nav" aria-label="أقسام الموقع">
          {SITE_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `site-link${isActive ? ' is-active' : ''}`}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="site-tools">
          <Link to="/inbox" className="icon-btn site-bell" aria-label="الإشعارات" title="الإشعارات">
            <Icon name="bell" size={21} />
            <UnreadBadge n={unread} />
          </Link>
          <Link to="/book" className="btn btn-primary site-cta-desk">احجز الآن</Link>
          <Link to="/book" className="btn btn-primary btn-sm site-cta-phone">احجز</Link>
          <button type="button" className="icon-btn site-menu-btn" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" size={24} />
          </button>
        </div>
      </div>
      {open && <MobileMenu onClose={() => setOpen(false)} unread={unread} />}
    </header>
  )
}

function MobileMenu({ onClose, unread }: { onClose: () => void; unread: number }) {
  const c = useCentre()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const links: { to: string; label: string; icon: IconName }[] = [
    { to: '/', label: 'الرئيسية', icon: 'home' },
    ...SITE_LINKS,
    { to: '/inbox', label: 'الإشعارات', icon: 'bell' },
  ]
  return createPortal(
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="menu-sheet" role="dialog" aria-modal="true" aria-label="القائمة">
        <div className="menu-head">
          <Brand />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><Icon name="x" /></button>
        </div>
        <nav className="menu-links" aria-label="أقسام الموقع">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={onClose} className={({ isActive }) => `menu-link${isActive ? ' is-active' : ''}`}>
              <span className="tile-icon sm menu-ico"><Icon name={l.icon} size={20} /></span>
              <span>{l.label}</span>
              {l.to === '/inbox' && <UnreadBadge n={unread} />}
            </NavLink>
          ))}
        </nav>
        <Link to="/book" onClick={onClose} className="btn btn-primary btn-lg btn-block menu-cta">احجز الآن</Link>
        <div className="menu-contact">
          <a href={c.tel}><Icon name="phone" size={18} /><span className="num">{c.phone}</span></a>
          <a href={c.whatsapp} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={18} />واتساب</a>
          <a href={c.insta} target="_blank" rel="noreferrer"><Icon name="instagram" size={18} /><span dir="ltr">@{c.instagram}</span></a>
          <div><Icon name="clock" size={18} />يومياً {shortClock(c.open)} – {shortClock(c.close)}</div>
          <div><Icon name="pin" size={18} />{c.address}</div>
        </div>
      </div>
    </>,
    document.body,
  )
}
