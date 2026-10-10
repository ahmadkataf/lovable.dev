import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, DatabaseBackup, Info, KeyRound, Receipt, SlidersHorizontal } from 'lucide-react'
import { Badge, PageHeader, Tabs } from '@/ui'
import { useI18n } from '@/i18n'
import { getSetting } from '@/db'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { backupHealth, resolveTab, visibleTabs, type SettingsTab } from './lib'
import { TabSkeleton } from './parts'
import './settings.css'

const ClinicTab = lazy(() => import('./ClinicTab'))
const PreferencesTab = lazy(() => import('./PreferencesTab'))
const BillingTab = lazy(() => import('./BillingTab'))
const BackupTab = lazy(() => import('./BackupTab'))
const LicenseTab = lazy(() => import('./LicenseTab'))
const AboutTab = lazy(() => import('./AboutTab'))

const ICONS: Record<SettingsTab, ReactNode> = {
  clinic: <Building2 />, preferences: <SlidersHorizontal />, billing: <Receipt />, backup: <DatabaseBackup />, license: <KeyRound />, about: <Info />,
}

export default function SettingsPage() {
  const { t } = useI18n()
  const { tab } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const license = useLicense()
  const isAdmin = session.can('settings')
  const tabs = visibleTabs(isAdmin)
  const current = resolveTab(tab, tabs)
  const lastBackup = useLiveQuery(() => getSetting<string | null>('lastBackupAt', null), [])

  useEffect(() => { if (tab !== undefined && tab !== current) navigate(`/settings/${current}`, { replace: true }) }, [tab, current, navigate])
  const go = (id: SettingsTab) => { if (id !== current) navigate(`/settings/${id}`) }

  const badge = (id: SettingsTab): ReactNode => {
    if (id === 'license' && !license.loading && license.status !== 'active') {
      return <Badge tone={license.status === 'expired' ? 'danger' : 'warning'} size="sm">{t(license.status === 'expired' ? 'settings.badge.expired' : 'settings.badge.trial')}</Badge>
    }
    if (id === 'backup' && lastBackup !== undefined && backupHealth(lastBackup) !== 'ok') return <span className="st-nav-dot" title={t('settings.badge.backupDue')} />
    return null
  }

  const content: Record<SettingsTab, ReactNode> = {
    clinic: <ClinicTab />, preferences: <PreferencesTab />, billing: <BillingTab />, backup: <BackupTab />, license: <LicenseTab />, about: <AboutTab />,
  }

  return (
    <div className="page st-page">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="st-mobile-tabs">
        <Tabs<SettingsTab> pills value={current} onChange={go} tabs={tabs.map(id => ({ id, icon: ICONS[id], label: t(`settings.tab.${id}`) }))} />
      </div>
      <div className="st-layout">
        <nav className="card st-nav" aria-label={t('settings.title')}>
          {tabs.map(id => (
            <button key={id} type="button" className={`st-nav-item${id === current ? ' active' : ''}`} onClick={() => go(id)} aria-current={id === current ? 'page' : undefined} data-tab={id}>
              <span className="st-nav-icon">{ICONS[id]}</span>
              <span className="st-nav-text">
                <span className="st-nav-label">{t(`settings.tab.${id}`)}</span>
                <span className="st-nav-desc">{t(`settings.tab.${id}Desc`)}</span>
              </span>
              {badge(id)}
            </button>
          ))}
        </nav>
        <div className="st-content" key={current} data-qa={`tab-${current}`}>
          <Suspense fallback={<TabSkeleton />}>{content[current]}</Suspense>
        </div>
      </div>
    </div>
  )
}
