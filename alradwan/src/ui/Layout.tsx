import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Receipt, Package, Boxes, Truck, Users, Factory, Wallet, BarChart3, Settings, Menu, LogOut, RefreshCw, CloudOff, Cloud, AlertTriangle, User, DollarSign, History, Trash2, Car, BookOpen, Sun, Moon, Lock } from 'lucide-react'
import { logout, saveSettings, useCurrentUser, useIsAdmin, useSettings, useStore, userCan } from '../db/store'
import type { Permission } from '../db/types'
import { onSyncStatus, syncNow, type SyncStatus } from '../lib/sync'
import { fmtTime } from '../lib/format'
import { useToast } from './toast'
import { RateModal } from './RateModal'
import { useLicense } from '../lib/license'
import { Activate } from '../screens/Activate'

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; admin?: boolean; perm?: Permission }[] = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/pos', label: 'بيع جديد', icon: ShoppingCart, perm: 'sell' },
  { to: '/sales', label: 'فواتير المبيعات', icon: Receipt },
  { to: '/products', label: 'المنتجات', icon: Package },
  { to: '/inventory', label: 'المخزون', icon: Boxes },
  { to: '/purchases', label: 'المشتريات', icon: Truck, perm: 'purchases' },
  { to: '/cars', label: 'دليل السيارات', icon: Car, perm: 'cars' },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/suppliers', label: 'الموردون', icon: Factory },
  { to: '/cash', label: 'الصندوق والمصاريف', icon: Wallet },
  { to: '/reports', label: 'التقارير', icon: BarChart3, perm: 'reports' },
  { to: '/accounting', label: 'المحاسبة', icon: BookOpen, perm: 'accounting' },
  { to: '/activity', label: 'سجل النشاط', icon: History, perm: 'activity' },
  { to: '/trash', label: 'المحذوفات', icon: Trash2, admin: true },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

const TITLES: Record<string, string> = {
  '/': 'الرئيسية', '/pos': 'بيع جديد', '/sales': 'فواتير المبيعات', '/products': 'المنتجات', '/inventory': 'المخزون', '/purchases': 'المشتريات',
  '/customers': 'العملاء', '/suppliers': 'الموردون', '/cash': 'الصندوق والمصاريف', '/reports': 'التقارير', '/accounting': 'المحاسبة', '/settings': 'الإعدادات', '/activity': 'سجل النشاط', '/trash': 'المحذوفات', '/cars': 'دليل السيارات',
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [rate, setRate] = useState(false)
  const [activateOpen, setActivateOpen] = useState(false)
  const lic = useLicense()
  const trialDays = lic.state === 'trial' ? Math.max(0, Math.ceil((lic.trialEnds - Date.now()) / 86400000)) : 0
  const expiringDays = lic.state === 'active' && lic.until ? Math.ceil((lic.until - Date.now()) / 86400000) : 999
  const loc = useLocation()
  const settings = useSettings()
  const user = useCurrentUser()
  const isAdmin = useIsAdmin()
  const hasUsers = useStore(s => s.users.size > 0)
  useEffect(() => { setOpen(false) }, [loc.pathname])
  const title = TITLES[loc.pathname] ?? Object.entries(TITLES).find(([k]) => k !== '/' && loc.pathname.startsWith(k))?.[1] ?? settings.shopName
  const perms = useStore(s => { const u = s.currentUserId ? s.users.get(s.currentUserId) : null; const none = s.users.size === 0; return NAV.map(n => (n.admin ? isAdmin : n.perm ? userCan(u, n.perm, s.cfg, none) : true)).join(',') })
  const nav = NAV.filter((_, i) => perms.split(',')[i] === 'true')
  const canSell = nav.some(n => n.to === '/pos')
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  return (
    <div className="app">
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="./icon.svg" alt="" />
          <div style={{ minWidth: 0 }}><b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settings.shopName}</b><small>نظام إدارة قطع الغيار</small></div>
        </div>
        <nav>
          {nav.map(n => <NavLink key={n.to} to={n.to} end={n.end}><n.icon />{n.label}</NavLink>)}
        </nav>
        <div className="foot">
          <User size={16} />
          <span style={{ flex: 1 }}>{user ? `${user.name}${user.role === 'admin' ? ' (مدير)' : ''}` : 'بدون تسجيل دخول'}</span>
          {hasUsers && <button className="btn ghost icon" title="تسجيل الخروج" aria-label="تسجيل الخروج" onClick={() => logout()} style={{ color: 'var(--side-muted)' }}><LogOut size={16} /></button>}
        </div>
      </aside>
      <div className="main">
        <header className="header">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="القائمة"><Menu /></button>
          <h1>{title}</h1>
          <button className="rate-pill" onClick={() => setRate(true)} title="تغيير سعر الدولار وطريقة عرض الأسعار">
            <DollarSign />
            <span dir="ltr">{settings.rate ? <>1 $ = <b>{settings.rate.toLocaleString('en-US')}</b> <span className="hide-mobile">ل.س</span></> : 'سعر الدولار'}</span>
          </button>
          {hasUsers && <button className="btn ghost icon" title="قفل الشاشة (تبديل المستخدم)" aria-label="قفل الشاشة" onClick={() => logout()}><Lock /></button>}
          <button className="btn ghost icon" title={dark ? 'التبديل إلى المظهر الفاتح' : 'التبديل إلى المظهر الداكن'} aria-label="المظهر" onClick={() => saveSettings({ theme: dark ? 'light' : 'dark' })}>{dark ? <Sun /> : <Moon />}</button>
          <SyncPill />
        </header>
        {rate && <RateModal onClose={() => setRate(false)} />}
        {activateOpen && <div className="modal-backdrop" style={{ padding: 0 }}><Activate shopName={settings.shopName} onClose={() => setActivateOpen(false)} /></div>}
        {(lic.state === 'trial' || lic.state === 'grace' || expiringDays <= 7) && <div className="card pad tone-warning" style={{ margin: '10px 20px 0', padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ flex: 1 }}>{lic.state === 'trial' ? `نسخة تجريبية — متبقٍ ${trialDays} يوم` : lic.state === 'grace' ? lic.notice : `الاشتراك ينتهي خلال ${Math.max(0, expiringDays)} يوم`}</span><button className="btn sm primary" onClick={() => setActivateOpen(true)}>تفعيل / تجديد</button></div>}
        <main className="content" key={`${settings.baseCurrency}|${settings.rate}|${settings.display}|${settings.currency}|${settings.decimals}`}>{children}</main>
      </div>
      <nav className="bottom-nav">
        <NavLink to="/" end><LayoutDashboard /><span>الرئيسية</span></NavLink>
        <NavLink to="/products"><Package /><span>المنتجات</span></NavLink>
        {canSell ? <NavLink to="/pos" className="pos"><span className="ic"><ShoppingCart /></span><span style={{ color: 'var(--muted)' }}>بيع</span></NavLink> : <NavLink to="/inventory"><Boxes /><span>المخزون</span></NavLink>}
        <NavLink to="/sales"><Receipt /><span>الفواتير</span></NavLink>
        <NavLink to="/customers"><Users /><span>العملاء</span></NavLink>
      </nav>
    </div>
  )
}

function SyncPill() {
  const [s, setS] = useState<SyncStatus>({ state: 'off', lastSync: null, pending: 0 })
  const toast = useToast()
  useEffect(() => onSyncStatus(setS), [])
  if (s.state === 'off') return null
  const click = () => syncNow().then(r => toast.success(r.received ? `تمت المزامنة — وصل ${r.received} تغيير` : 'تمت المزامنة')).catch(e => toast.error((e as Error).message))
  const cls = s.state === 'error' || s.clockSkew ? 'err' : s.state === 'idle' && s.pending === 0 ? 'ok' : ''
  const title = s.clockSkew ? `ساعة هذا الجهاز تختلف عن الخادم بنحو ${Math.round(Math.abs(s.clockSkew) / 60000)} دقيقة — اضبط التاريخ والوقت حتى لا تُحفظ التعديلات بترتيب خاطئ` : s.error ?? (s.lastSync ? `آخر مزامنة ${fmtTime(s.lastSync)}` : '')
  return (
    <button className={`sync-pill ${cls}`} onClick={click} title={title}>
      {s.state === 'syncing' ? <RefreshCw className="spin" /> : s.state === 'error' || s.clockSkew ? <AlertTriangle /> : s.state === 'offline' ? <CloudOff /> : <Cloud />}
      <span className="hide-mobile">{s.state === 'syncing' ? 'جارٍ المزامنة…' : s.state === 'error' ? 'خطأ في المزامنة' : s.clockSkew ? 'ساعة الجهاز غير مضبوطة' : s.state === 'offline' ? 'بلا إنترنت' : s.pending ? `${s.pending} بانتظار الإرسال` : 'متزامن'}</span>
    </button>
  )
}
