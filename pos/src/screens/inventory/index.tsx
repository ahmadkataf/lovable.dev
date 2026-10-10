// /inventory: stock · movements · purchases · suppliers · stock-take, plus the purchase / supplier sub pages.
import './i18n'
import './inventory.css'
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Boxes, ArrowLeftRight, ShoppingBag, Truck, ClipboardCheck, type LucideIcon } from 'lucide-react'
import { db } from '../../db'
import { useT } from '../../i18n'
import { useSettings, useUser } from '../../state/store'
import { allowed } from '../../lib/audit'
import { StockTab } from './StockTab'
import { MovesTab } from './MovesTab'
import { PurchasesTab } from './PurchasesTab'
import { PurchaseForm } from './PurchaseForm'
import { PurchaseDetail } from './PurchaseDetail'
import { SuppliersTab } from './SuppliersTab'
import { SupplierDetail } from './SupplierDetail'
import { StockTakeTab } from './StockTakeTab'

const TABS: { to: string; key: string; icon: LucideIcon }[] = [
  { to: '/inventory', key: 'inventory.tab.stock', icon: Boxes },
  { to: '/inventory/moves', key: 'inventory.tab.moves', icon: ArrowLeftRight },
  { to: '/inventory/purchases', key: 'inventory.tab.purchases', icon: ShoppingBag },
  { to: '/inventory/suppliers', key: 'inventory.tab.suppliers', icon: Truck },
  { to: '/inventory/count', key: 'inventory.tab.count', icon: ClipboardCheck },
]

function TabsLayout() {
  const t = useT()
  const loc = useLocation()
  const nav = useNavigate()
  const alerts = useLiveQuery(() => db.products.filter(p => p.active && p.trackStock && (p.stock <= 0 || (p.lowStock > 0 && p.stock <= p.lowStock))).count(), [], 0)
  const canCount = allowed(useUser(), useSettings(), 'cashierAdjustStock')
  const path = loc.pathname.replace(/\/$/, '') || '/inventory'
  return (
    <div className="page">
      <div className="page-head"><h1>{t('nav.inventory')}</h1></div>
      <div className="page-body">
        <div className="tabs inv-tabs" role="tablist">
          {TABS.filter(tab => tab.to !== '/inventory/count' || canCount).map(tab => (
            <button key={tab.to} type="button" role="tab" aria-selected={path === tab.to} className={path === tab.to ? 'on' : ''} onClick={() => nav(tab.to)}>
              <tab.icon size={17} />{t(tab.key)}
              {tab.to === '/inventory' && alerts > 0 && <span className="inv-tab-badge num" title={t('inventory.stock.alerts', { n: alerts })}>{alerts}</span>}
            </button>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  )
}

export default function InventoryScreen() {
  const canCount = allowed(useUser(), useSettings(), 'cashierAdjustStock')
  return (
    <Routes>
      <Route element={<TabsLayout />}>
        <Route index element={<StockTab />} />
        <Route path="moves" element={<MovesTab />} />
        <Route path="purchases" element={<PurchasesTab />} />
        <Route path="suppliers" element={<SuppliersTab />} />
        <Route path="count" element={canCount ? <StockTakeTab /> : <Navigate to="/inventory" replace />} />
      </Route>
      <Route path="purchases/new" element={<PurchaseForm />} />
      <Route path="purchases/:id" element={<PurchaseDetail />} />
      <Route path="suppliers/:id" element={<SupplierDetail />} />
      <Route path="*" element={<Navigate to="/inventory" replace />} />
    </Routes>
  )
}
