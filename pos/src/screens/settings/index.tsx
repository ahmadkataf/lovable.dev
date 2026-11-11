// Settings: admin only. Wide screens show the section list beside the content; phones show the list, then the section.
import './i18n'
import './settings.css'
import type { ComponentType } from 'react'
import { Routes, Route, Navigate, NavLink, Link } from 'react-router-dom'
import { Store, Coins, Percent, Printer, SlidersHorizontal, Users, Palette, DatabaseBackup, Info, ChevronLeft, ShieldAlert, type LucideIcon, ClipboardList } from 'lucide-react'
import { useStore, isAdmin } from '../../state/store'
import { useT } from '../../i18n'
import { Empty, useIsMobile } from '../../components/ui'
import { SectionFrame } from './shared'
import StoreSection from './sections/StoreSection'
import CurrencySection from './sections/CurrencySection'
import TaxSection from './sections/TaxSection'
import ReceiptSection from './sections/ReceiptSection'
import PosSection from './sections/PosSection'
import UsersSection from './sections/UsersSection'
import AppearanceSection from './sections/AppearanceSection'
import BackupSection from './sections/BackupSection'
import AboutSection from './sections/AboutSection'
import ActivitySection from './sections/ActivitySection'
import PermissionsCard from './sections/PermissionsCard'

export type SectionKey = 'store' | 'currency' | 'tax' | 'receipt' | 'pos' | 'users' | 'activity' | 'appearance' | 'backup' | 'about'
const UsersAndPermissions = () => <><UsersSection /><PermissionsCard /></>
interface Section { key: SectionKey; icon: LucideIcon; el: ComponentType }
export const SECTIONS: Section[] = [
  { key: 'store', icon: Store, el: StoreSection },
  { key: 'currency', icon: Coins, el: CurrencySection },
  { key: 'tax', icon: Percent, el: TaxSection },
  { key: 'receipt', icon: Printer, el: ReceiptSection },
  { key: 'pos', icon: SlidersHorizontal, el: PosSection },
  { key: 'users', icon: Users, el: UsersAndPermissions },
  { key: 'activity', icon: ClipboardList, el: ActivitySection },
  { key: 'appearance', icon: Palette, el: AppearanceSection },
  { key: 'backup', icon: DatabaseBackup, el: BackupSection },
  { key: 'about', icon: Info, el: AboutSection },
]

export default function SettingsScreen() {
  const t = useT()
  const user = useStore(s => s.user)
  const mobile = useIsMobile()

  if (!isAdmin(user)) {
    return (
      <div className="page"><div className="page-body">
        <Empty icon={<ShieldAlert size={32} />} title={t('settings.adminOnly.title')} text={t('settings.adminOnly.text')} action={<Link to="/" className="btn primary">{t('settings.adminOnly.back')}</Link>} />
      </div></div>
    )
  }

  const routes = (
    <Routes>
      <Route index element={mobile ? <SectionList /> : <Navigate to="store" replace />} />
      {SECTIONS.map(s => (
        <Route key={s.key} path={s.key} element={<SectionFrame title={t(`settings.sec.${s.key}`)} desc={t(`settings.sec.${s.key}.desc`)}><s.el /></SectionFrame>} />
      ))}
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  )

  if (mobile) return <div className="page">{routes}</div>
  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label={t('nav.settings')}>
        {SECTIONS.map(s => <NavLink key={s.key} to={s.key}><s.icon size={18} /><span>{t(`settings.sec.${s.key}`)}</span></NavLink>)}
      </nav>
      <div className="settings-content page">{routes}</div>
    </div>
  )
}

/** Phones: the list of sections. */
function SectionList() {
  const t = useT()
  return (
    <>
      <div className="page-head"><h1>{t('nav.settings')}</h1></div>
      <div className="page-body">
        <div className="card list settings-list">
          {SECTIONS.map(s => (
            <Link key={s.key} to={s.key} className="list-row">
              <span className="ico"><s.icon size={20} /></span>
              <div className="grow"><div className="title">{t(`settings.sec.${s.key}`)}</div><div className="sub">{t(`settings.sec.${s.key}.desc`)}</div></div>
              <ChevronLeft size={18} className="chev" />
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
