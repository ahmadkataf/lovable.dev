import React, { useEffect, useState } from 'react'
import { Link, navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { offline } from '../lib/api'
import { waLink } from '../lib/format'
import { Icon } from './Icons'
import { Toasts } from './ui'

const NAV = [
  { to: '/', label: 'الرئيسية' },
  { to: '/shop', label: 'المتجر' },
  { to: '/dji', label: 'درونات DJI' },
  { to: '/repair', label: 'طلب صيانة' },
  { to: '/track', label: 'تتبّع الطلب' },
  { to: '/about', label: 'من نحن' },
  { to: '/contact', label: 'تواصل معنا' },
]

export function Logo({ className = 'logo' }: { className?: string }) {
  const { settings } = useStore()
  return (
    <Link to="/" className={className} aria-label={settings.siteName}>
      {settings.logoImage ? <img src={settings.logoImage} alt={settings.siteName} /> : <><span className="logo-mark">{settings.siteName.slice(0, 1).toUpperCase()}</span><span>{settings.siteName}</span></>}
    </Link>
  )
}

export function Header() {
  const { settings, cartCount } = useStore()
  const { path } = useRoute()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  useEffect(() => setOpen(false), [path])
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to))
  return (
    <>
      {settings.announcement.enabled && settings.announcement.text && <div className="announce">{settings.announcement.text}</div>}
      <header className="header">
        <div className="container header-inner">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="القائمة"><Icon.Menu /></button>
          <Logo />
          <nav className="nav">{NAV.map(n => <Link key={n.to} to={n.to} className={isActive(n.to) ? 'active' : ''}>{n.label}</Link>)}</nav>
          <form className="search-bar" onSubmit={e => { e.preventDefault(); navigate(`/shop?q=${encodeURIComponent(q)}`) }}>
            <Icon.Search />
            <input className="input" placeholder="ابحث عن منتج أو قطعة…" value={q} onChange={e => setQ(e.target.value)} />
          </form>
          <div className="header-actions">
            <a className="btn btn-wa btn-sm" href={waLink(settings.whatsapp, `مرحباً ${settings.siteName}، أريد الاستفسار عن`)} target="_blank" rel="noreferrer"><Icon.WhatsApp />واتساب</a>
            <Link to="/cart" className="icon-btn" aria-label="السلة"><Icon.Cart />{cartCount > 0 && <span className="cart-count">{cartCount}</span>}</Link>
          </div>
        </div>
      </header>
      {open && (
        <div className="mobile-nav">
          <div className="row-between" style={{ marginBottom: 12 }}><Logo /><button className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق"><Icon.X /></button></div>
          {NAV.map(n => <Link key={n.to} to={n.to} className={isActive(n.to) ? 'active' : ''}>{n.label}</Link>)}
          <Link to="/cart">السلة {cartCount > 0 && `(${cartCount})`}</Link>
          <div style={{ marginTop: 'auto' }} className="stack">
            <a className="btn btn-wa btn-block" href={waLink(settings.whatsapp, `مرحباً ${settings.siteName}`)} target="_blank" rel="noreferrer"><Icon.WhatsApp />تواصل عبر واتساب</a>
            <a className="btn btn-ghost btn-block" href={`tel:${settings.phone.replace(/\s/g, '')}`}><Icon.Phone />{settings.phone}</a>
          </div>
        </div>
      )}
    </>
  )
}

export function Footer() {
  const { settings, categories } = useStore()
  const s = settings.social
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo />
            <p className="about">{settings.footerText || settings.tagline}</p>
            <div className="social">
              {s.facebook && <a href={s.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Icon.Facebook /></a>}
              {s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Icon.Instagram /></a>}
              {s.telegram && <a href={s.telegram} target="_blank" rel="noreferrer" aria-label="Telegram"><Icon.Telegram /></a>}
              {s.tiktok && <a href={s.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok"><Icon.TikTok /></a>}
              {s.youtube && <a href={s.youtube} target="_blank" rel="noreferrer" aria-label="YouTube"><Icon.YouTube /></a>}
              <a href={waLink(settings.whatsapp, 'مرحباً')} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon.WhatsApp /></a>
            </div>
          </div>
          <div>
            <h4>المتجر</h4>
            {categories.slice(0, 6).map(c => <Link key={c.id} to={`/shop?category=${c.id}`}>{c.name}</Link>)}
            <Link to="/dji">كل طرازات DJI</Link>
          </div>
          <div>
            <h4>الخدمات</h4>
            <Link to="/repair">طلب صيانة</Link>
            <Link to="/track">تتبّع الطلب</Link>
            <Link to="/about">من نحن</Link>
            <Link to="/contact">تواصل معنا</Link>
            <Link to="/admin">لوحة الإدارة</Link>
          </div>
          <div>
            <h4>تواصل معنا</h4>
            <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="row"><Icon.Phone width={16} height={16} /> <span className="num" dir="ltr">{settings.phone}</span></a>
            <a href={`mailto:${settings.email}`} className="row"><Icon.Mail width={16} height={16} /> {settings.email}</a>
            <span className="row muted small" style={{ padding: '4px 0' }}><Icon.MapPin width={16} height={16} /> {settings.city}، {settings.address}</span>
            <span className="row muted small" style={{ padding: '4px 0' }}><Icon.Clock width={16} height={16} /> {settings.workingHours}</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {settings.siteName}. جميع الحقوق محفوظة.</span>
          <span>الدفع عند الاستلام · شحن لكل المحافظات</span>
        </div>
      </div>
    </footer>
  )
}

export function WhatsAppFloat() {
  const { settings } = useStore()
  return <a className="wa-float no-print" href={waLink(settings.whatsapp, `مرحباً ${settings.siteName}، أريد الاستفسار`)} target="_blank" rel="noreferrer" aria-label="واتساب"><Icon.WhatsApp /></a>
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <WhatsAppFloat />
      <Toasts />
      {offline && <div className="offline-note">وضع المعاينة: لا يوجد خادم متصل، البيانات تُحفظ في هذا المتصفح فقط.</div>}
    </>
  )
}
