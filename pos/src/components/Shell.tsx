import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, Package, Users, Warehouse, Receipt, BarChart3, Clock, Wallet, Settings, MoreHorizontal, Lock, PanelRightClose, PanelRightOpen, KeyRound, X, HelpCircle, ArrowLeftRight } from 'lucide-react'
import { db } from '../db'
import { hasFxAnchor } from '../db/types'
import { useStore } from '../state/store'
import { useT } from '../i18n'
import { Avatar, Badge, Button } from './ui'
import { daysBetween, toDateInput } from '../lib/format'
import { platform } from '../lib/platform'
import { allowed } from '../lib/audit'
import { rateAge, FX_PROMPTED_KEY } from '../lib/fx'
import { RateChip, RateDialog, canChangeRate, ratePricingOn, useRateAge } from './RateDialog'
import icon from '/icon.svg'

const NAV = [
  { to: '/', key: 'nav.sales', icon: ShoppingCart, end: true },
  { to: '/products', key: 'nav.products', icon: Package },
  { to: '/customers', key: 'nav.customers', icon: Users },
  { to: '/inventory', key: 'nav.inventory', icon: Warehouse },
  { to: '/history', key: 'nav.history', icon: Receipt },
  { to: '/reports', key: 'nav.reports', icon: BarChart3, admin: true },
  { to: '/shifts', key: 'nav.shifts', icon: Clock },
  { to: '/expenses', key: 'nav.expenses', icon: Wallet },
  { to: '/settings', key: 'nav.settings', icon: Settings, admin: true },
  { to: '/help', key: 'nav.help', icon: HelpCircle },
]
const MOBILE_MAIN = ['/', '/products', '/customers', '/history']

export function Shell({ children }: { children: ReactNode }) {
  const t = useT()
  const user = useStore(s => s.user)
  const logout = useStore(s => s.logout)
  const shift = useStore(s => s.shift)
  const license = useStore(s => s.license)
  const settings = useStore(s => s.settings)
  const mini = useStore(s => s.sidebarMini)
  const setMini = useStore(s => s.setSidebarMini)
  const [more, setMore] = useState(false)
  const [rateDialog, setRateDialog] = useState<'open' | 'prompt' | null>(null)
  const loc = useLocation()
  const nav = useNavigate()
  const items = NAV.filter(n => (!n.admin || user?.role === 'admin') && (n.to !== '/history' || allowed(user, settings, 'cashierSeeHistory')))
  const isSales = loc.pathname === '/'
  const current = items.find(n => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))

  useEffect(() => { setMore(false) }, [loc.pathname])
  useEffect(() => {
    if (!more) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [more])

  // auto-lock after a quiet spell
  useEffect(() => {
    const mins = settings.pos.lockAfterMinutes
    if (!mins || !settings.pos.requirePin) return
    let timer = window.setTimeout(logout, mins * 60000)
    const bump = () => { clearTimeout(timer); timer = window.setTimeout(logout, mins * 60000) }
    const evs = ['pointerdown', 'keydown', 'touchstart']
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }))
    return () => { clearTimeout(timer); evs.forEach(e => window.removeEventListener(e, bump)) }
  }, [settings.pos.lockAfterMinutes, settings.pos.requirePin, logout])

  // the daily rate: the chip, the stale banner and the morning prompt (only while products are priced in currency2)
  const c2 = settings.currency2
  const pricingOn = ratePricingOn(c2)
  const canRate = allowed(user, settings, 'cashierChangeRate')
  const age = useRateAge(c2)
  const openRate = () => { if (canChangeRate()) setRateDialog('open') }
  useEffect(() => {
    if (!user || !settings.onboarded || !pricingOn || !c2.askOnOpen || !canRate || rateAge(c2).updatedToday) return
    let alive = true
    void (async () => {
      try {
        const today = toDateInput(Date.now())
        const marker = await db.kv.get(FX_PROMPTED_KEY)
        if (marker?.value === today) return
        const anchored = await db.products.filter(p => hasFxAnchor(p)).count()
        if (alive && anchored > 0) setRateDialog(cur => cur ?? 'prompt')
      } catch { /* the prompt is a convenience */ }
    })()
    return () => { alive = false }
    // once per login / when the feature is switched on, not on every settings change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, settings.onboarded, pricingOn, c2.askOnOpen, canRate])

  const trialDays = license.state === 'trial' && license.expiresAt ? Math.max(0, daysBetween(Date.now(), license.expiresAt)) : null
  const offlineDays = license.state === 'active' && license.graceUntil && !license.online ? Math.max(0, daysBetween(Date.now(), license.graceUntil)) : null

  return (
    <div className="shell">
      <aside className={`sidebar ${mini ? 'mini' : ''}`}>
        <div className="brand"><img src={icon} alt="" /><span>{settings.store.name || t('app.name')}</span></div>
        <nav>
          {items.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} title={t(n.key)}><n.icon size={20} /><span>{t(n.key)}</span></NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user?.name ?? '?'} size={30} round />
            <div className="grow truncate"><div className="small bold truncate">{user?.name}</div><div className="xs faint">{t(user?.role === 'admin' ? 'common.admin' : 'common.cashier')}</div></div>
          </div>
          <div className="row" style={{ gap: 4 }}>
            <Button variant="ghost" size="sm" iconOnly icon={<Lock size={16} />} title={t('lock.logout')} onClick={logout} />
            {license.state === 'trial' && <Button variant="ghost" size="sm" iconOnly icon={<KeyRound size={16} />} title={t('license.activate')} onClick={() => nav('/activation')} />}
            <span className="grow" />
            <Button variant="ghost" size="sm" iconOnly icon={mini ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />} onClick={() => setMini(!mini)} />
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="title truncate">{current ? t(current.key) : t('app.name')}</div>
          {license.state === 'demo' && <Badge kind="info">DEMO</Badge>}
          {trialDays !== null && <Badge kind="warn">{trialDays === 0 ? t('license.trialLastDay') : t('license.trialBanner', { n: trialDays })}</Badge>}
          {shift ? <Badge kind="primary"><Clock size={12} /> {t('nav.shifts')}</Badge> : null}
          {pricingOn && <RateChip onClick={openRate} />}
          {platform.isDesktop && <span className="kbd">F1</span>}
        </header>
        {offlineDays !== null && (
          <div className="banner warn">{t('license.offlineBanner', { n: offlineDays })}<Button size="sm" variant="soft" onClick={() => nav('/activation')}>{t('license.activate')}</Button></div>
        )}
        {pricingOn && age.stale && (
          <div className="banner warn rate-stale">
            <ArrowLeftRight size={16} />
            <span className="grow">{Number.isFinite(age.days) ? t('fx.stale', { n: age.days }) : `${t('fx.title')}: ${t('fx.never')}`}</span>
            {canRate ? <Button size="sm" variant="soft" onClick={openRate}>{t('fx.update')}</Button> : <span className="small">{t('fx.tellAdmin')}</span>}
          </div>
        )}
        <main className={`content ${isSales ? 'fixed' : ''}`}>{children}</main>
      </div>

      <nav className="bottom-nav">
        {items.filter(n => MOBILE_MAIN.includes(n.to)).map(n => (
          <NavLink key={n.to} to={n.to} end={n.end}><n.icon size={22} /><span>{t(n.key)}</span></NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} className={items.some(n => !MOBILE_MAIN.includes(n.to) && loc.pathname.startsWith(n.to)) ? 'active' : ''}><MoreHorizontal size={22} /><span>{t('nav.more')}</span></button>
      </nav>

      {more && (
        <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setMore(false) }}>
          <div className="modal" role="dialog">
            <div className="modal-head"><h2>{t('nav.more')}</h2><Button variant="ghost" iconOnly icon={<X size={20} />} onClick={() => setMore(false)} /></div>
            <div className="modal-body">
              <div className="row" style={{ marginBottom: 12 }}>
                <Avatar name={user?.name ?? '?'} round />
                <div className="grow"><div className="bold">{user?.name}</div><div className="small faint">{t(user?.role === 'admin' ? 'common.admin' : 'common.cashier')}</div></div>
                <Button size="sm" icon={<Lock size={16} />} onClick={logout}>{t('lock.logout')}</Button>
              </div>
              {pricingOn && <div className="row" style={{ marginBottom: 12 }}><RateChip className="grow" onClick={() => { setMore(false); openRate() }} /></div>}
              <div className="list card flat">
                {items.filter(n => !MOBILE_MAIN.includes(n.to)).map(n => (
                  <NavLink key={n.to} to={n.to} className="list-row"><n.icon size={20} /><span className="title">{t(n.key)}</span></NavLink>
                ))}
                {license.state !== 'demo' && <NavLink to="/activation" className="list-row"><KeyRound size={20} /><span className="title">{t('nav.activation')}</span></NavLink>}
              </div>
            </div>
          </div>
        </div>
      )}
      {rateDialog && <RateDialog prompt={rateDialog === 'prompt'} onClose={() => setRateDialog(null)} />}
    </div>
  )
}
