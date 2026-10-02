import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Receipt, Package, Boxes, Truck, Users, Factory, Wallet, BarChart3, Settings, Menu, LogOut, RefreshCw, CloudOff, Cloud, AlertTriangle, User, DollarSign, History, Trash2, Car, BookOpen } from 'lucide-react'
import { setCurrentUser, useCurrentUser, useIsAdmin, useSettings, useStore } from '../db/store'
import { onSyncStatus, syncNow, type SyncStatus } from '../lib/sync'
import { fmtTime } from '../lib/format'
import { useToast } from './toast'
import { RateModal } from './RateModal'

const NAV = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/pos', label: 'بيع جديد', icon: ShoppingCart },
  { to: '/sales', label: 'فواتير المبيعات', icon: Receipt },
  { to: '/products', label: 'المنتجات', icon: Package },
  { to: '/inventory', label: 'المخزون', icon: Boxes },
  { to: '/purchases', label: 'المشتريات', icon: Truck },
  { to: '/cars', label: 'دليل السيارات', icon: Car },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/suppliers', label: 'الموردون', icon: Factory },
  { to: '/cash', label: 'الصندوق والمصاريف', icon: Wallet },
  { to: '/reports', label: 'التقارير', icon: BarChart3, admin: true },
  { to: '/accounting', label: 'المحاسبة', icon: BookOpen, admin: true },
  { to: '/activity', label: 'سجل النشاط', icon: History, admin: true },
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
  const loc = useLocation()
  const settings = useSettings()
  const user = useCurrentUser()
  const isAdmin = useIsAdmin()
  const hasUsers = useStore(s => s.users.size > 0)
  useEffect(() => { setOpen(false) }, [loc.pathname])
  const title = TITLES[loc.pathname] ?? Object.entries(TITLES).find(([k]) => k !== '/' && loc.pathname.startsWith(k))?.[1] ?? settings.shopName
  const nav = NAV.filter(n => !n.admin || isAdmin)
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
          {hasUsers && <button className="btn ghost icon" title="تسجيل الخروج" onClick={() => setCurrentUser(null)} style={{ color: '#94a3b8' }}><LogOut size={16} /></button>}
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
          <SyncPill />
        </header>
        {rate && <RateModal onClose={() => setRate(false)} />}
        <main className="content" key={`${settings.baseCurrency}|${settings.rate}|${settings.display}|${settings.currency}|${settings.decimals}`}>{children}</main>
      </div>
      <nav className="bottom-nav">
        <NavLink to="/" end><LayoutDashboard /><span>الرئيسية</span></NavLink>
        <NavLink to="/products"><Package /><span>المنتجات</span></NavLink>
        <NavLink to="/pos" className="pos"><span className="ic"><ShoppingCart /></span><span style={{ color: 'var(--muted)' }}>بيع</span></NavLink>
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
