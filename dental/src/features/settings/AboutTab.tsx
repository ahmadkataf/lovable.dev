import { Activity, BarChart3, Boxes, CalendarDays, CloudOff, Heart, Keyboard, Monitor, Pill, Receipt, Sparkles, Users } from 'lucide-react'
import { Badge, Card, CardBody, Kbd } from '@/ui'
import { useI18n } from '@/i18n'
import { ToothIcon } from '@/app/ToothIcon'
import { useLicense } from '@/license/useLicense'
import { appVersion, platform } from '@/platform'
import { SectionTitle } from './parts'

const FEATURES = [
  { key: 'patients', icon: <Users /> }, { key: 'appointments', icon: <CalendarDays /> }, { key: 'treatments', icon: <Activity /> }, { key: 'billing', icon: <Receipt /> },
  { key: 'rx', icon: <Pill /> }, { key: 'inventory', icon: <Boxes /> }, { key: 'reports', icon: <BarChart3 /> }, { key: 'offline', icon: <CloudOff /> },
]
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'K'], label: 'about.sc.search' },
  { keys: ['Ctrl', 'Shift', 'N'], label: 'about.sc.patient' },
  { keys: ['Ctrl', 'Shift', 'A'], label: 'about.sc.appointment' },
  { keys: ['Esc'], label: 'about.sc.close' },
]
const CREDITS = ['React', 'Dexie.js', 'React Router', 'Lucide', 'Vite', 'Inter', 'Noto Kufi Arabic', 'Cairo', 'Tajawal', 'Almarai', 'Readex Pro', 'IBM Plex Sans Arabic']

export default function AboutTab() {
  const { t } = useI18n()
  const { device } = useLicense()
  const p = platform()

  return (
    <div className="st-form">
      <Card className="st-about-hero">
        <CardBody>
          <div className="st-about-brand">
            <span className="st-about-logo"><ToothIcon size={36} /></span>
            <div className="grow">
              <h2 className="st-about-name">{t('appName')}</h2>
              <div className="muted">{t('appTagline')}</div>
              <div className="row wrap gap-2 mt-2">
                <Badge tone="primary" size="lg"><span data-qa="app-version">{t('settings.about.version', { v: appVersion() })}</span></Badge>
                <Badge tone="outline" size="lg" icon={<Monitor />}>{t(`settings.platform.${p}`)}</Badge>
              </div>
            </div>
          </div>
          <dl className="st-about-kv">
            <div><dt>{t('settings.about.platform')}</dt><dd>{t(`settings.platform.${p}`)}</dd></div>
            <div><dt>{t('settings.about.storage')}</dt><dd>{t('settings.about.storageValue')}</dd></div>
            <div><dt>{t('settings.about.device')}</dt><dd><span className="ltr st-mono">{device || '—'}</span></dd></div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<Sparkles />} title={t('settings.about.features')} />
          <ul className="st-features">
            {FEATURES.map(f => <li key={f.key}><span className="st-feature-icon">{f.icon}</span><span>{t(`settings.about.f.${f.key}`)}</span></li>)}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<Keyboard />} title={t('settings.about.shortcuts')} sub={t('settings.about.shortcutsSub')} />
          <ul className="st-shortcuts">
            {SHORTCUTS.map(s => (
              <li key={s.label}>
                <span>{t(`settings.${s.label}`)}</span>
                <span className="st-keys ltr">{s.keys.map((k, i) => <span key={k} className="row gap-1">{i > 0 && <span className="subtle">+</span>}<Kbd>{k}</Kbd></span>)}</span>
              </li>
            ))}
          </ul>
          <div className="text-sm muted mt-3">{t('settings.about.macHint')}</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<Heart />} title={t('settings.about.credits')} />
          <p className="st-note">{t('settings.about.creditsDesc')}</p>
          <div className="st-credits">{CREDITS.map(c => <span key={c} className="st-credit ltr">{c}</span>)}</div>
          <div className="st-copyright">{t('settings.about.copyright', { year: new Date().getFullYear() })}</div>
        </CardBody>
      </Card>
    </div>
  )
}
