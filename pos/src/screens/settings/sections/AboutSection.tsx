import { Link } from 'react-router-dom'
import { Copy, Info, KeyRound, ShieldCheck } from 'lucide-react'
import { useStore, toast } from '../../../state/store'
import { useT } from '../../../i18n'
import { Button } from '../../../components/ui'
import { platform } from '../../../lib/platform'
import { formatDate } from '../../../lib/format'
import type { LicenseStatus } from '../../../license/types'
import { SectionCard } from '../shared'
import icon from '/icon.svg'

function licenseLine(l: LicenseStatus, t: (k: string, v?: Record<string, string | number>) => string): string {
  switch (l.state) {
    case 'demo': return t('settings.about.lic.demo')
    case 'none': return t('settings.about.lic.none')
    case 'trial': return l.expiresAt ? t('settings.about.lic.trialUntil', { date: formatDate(l.expiresAt) }) : t('settings.about.lic.trial')
    case 'active': return l.expiresAt ? t('settings.about.lic.activeUntil', { date: formatDate(l.expiresAt) }) : t('settings.about.lic.lifetime')
    case 'expired': return t('settings.about.lic.expired')
    case 'revoked': return t('settings.about.lic.revoked')
    case 'locked': return t('settings.about.lic.locked')
    case 'tampered': return t('settings.about.lic.tampered')
  }
}

export default function AboutSection() {
  const t = useT()
  const license = useStore(s => s.license)
  const version = platform.appVersion()
  const build = __POS_BUILD__ || 'dev'
  const copyCode = async () => {
    const ok = await platform.copy(license.deviceCode)
    toast(ok ? t('settings.about.copied') : t('common.error'), ok ? 'success' : 'error')
  }
  return (
    <>
      <SectionCard>
        <div className="about-hero">
          <img src={icon} alt="" />
          <div>
            <h2>{t('app.name')}</h2>
            <div className="small muted">{t('app.tagline')}</div>
          </div>
        </div>
        <div className="about-rows">
          <div className="row"><span className="k">{t('settings.about.version')}</span><span className="v num">{version}</span></div>
          <div className="row"><span className="k">{t('settings.about.build')}</span><span className="v ltr mono small">{build}</span></div>
          <div className="row"><span className="k">{t('settings.about.platform')}</span><span className="v">{t(`settings.about.platform.${platform.kind}`)}</span></div>
          <div className="row">
            <span className="k">{t('settings.about.device')}<br /><span className="xs faint" style={{ fontWeight: 400 }}>{t('settings.about.deviceHint')}</span></span>
            <span className="v"><span className="ltr mono">{license.deviceCode || '—'}</span>
              {license.deviceCode && <Button size="sm" variant="ghost" iconOnly icon={<Copy size={16} />} onClick={() => void copyCode()} aria-label={t('common.copy')} />}
            </span>
          </div>
          <div className="row">
            <span className="k">{t('settings.about.license')}</span>
            <span className="v">{licenseLine(license, t)}<Link to="/activation" className="btn sm soft"><KeyRound size={14} /> {t('settings.about.lic.manage')}</Link></span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.about.terms.title')} icon={<ShieldCheck size={16} />}>
        <p className="small muted" style={{ lineHeight: 1.7 }}>{t('settings.about.terms.text')}</p>
      </SectionCard>

      <div className="row" style={{ justifyContent: 'center', gap: 6 }}><Info size={14} className="faint" /><span className="xs faint">{t('settings.about.credits')}</span></div>
    </>
  )
}
