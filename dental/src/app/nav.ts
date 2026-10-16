import type { LucideIcon } from 'lucide-react'
import { Activity, BarChart3, Boxes, CalendarDays, ClipboardList, FileText, FlaskConical, LayoutDashboard, ListChecks, Pill, Receipt, Settings, Users, Wallet, UsersRound } from 'lucide-react'
import type { Permission } from './session'

export interface NavItem { to: string; label: string; icon: LucideIcon; perm?: Permission; end?: boolean }
export interface NavGroup { label?: string; items: NavItem[] }

/** Sidebar structure. Labels are i18n keys. */
export const NAV: NavGroup[] = [
  { items: [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true }] },
  { label: 'nav.clinical', items: [
    { to: '/appointments', label: 'nav.appointments', icon: CalendarDays, perm: 'appointments' },
    { to: '/patients', label: 'nav.patients', icon: Users, perm: 'patients' },
    { to: '/treatments', label: 'nav.treatments', icon: Activity, perm: 'clinical' },
    { to: '/prescriptions', label: 'nav.prescriptions', icon: Pill, perm: 'clinical' },
    { to: '/lab', label: 'nav.lab', icon: FlaskConical, perm: 'clinical' },
  ] },
  { label: 'nav.finance', items: [
    { to: '/invoices', label: 'nav.billing', icon: Receipt, perm: 'billing' },
    { to: '/payments', label: 'nav.payments', icon: Wallet, perm: 'billing' },
    { to: '/expenses', label: 'nav.expenses', icon: FileText, perm: 'manage' },
    { to: '/reports', label: 'nav.reports', icon: BarChart3, perm: 'reports' },
  ] },
  { label: 'nav.management', items: [
    { to: '/inventory', label: 'nav.inventory', icon: Boxes, perm: 'inventory' },
    { to: '/procedures', label: 'nav.procedures', icon: ListChecks, perm: 'manage' },
    { to: '/staff', label: 'nav.staff', icon: UsersRound, perm: 'staff' },
    { to: '/settings', label: 'nav.settings', icon: Settings },
  ] },
]
/** The four tabs of the phone's bottom bar; everything else sits behind "More". */
export const BOTTOM_NAV: NavItem[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/appointments', label: 'nav.appointments', icon: CalendarDays, perm: 'appointments' },
  { to: '/patients', label: 'nav.patients', icon: Users, perm: 'patients' },
  { to: '/invoices', label: 'nav.billing', icon: Receipt, perm: 'billing' },
]
export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap(g => g.items)
export { ClipboardList }
