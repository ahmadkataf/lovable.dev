// The red notice shown wherever someone tries to add a tobacco product: the rule of the product, not a setting.
import { Ban } from 'lucide-react'
import { useT } from '../i18n'

export function PolicyBanner({ compact }: { compact?: boolean }) {
  const t = useT()
  return (
    <div className={`policy-banner ${compact ? 'compact' : ''}`} role="alert">
      <Ban size={compact ? 18 : 22} />
      <div>
        <strong>{t('policy.tobaccoTitle')}</strong>
        {!compact && <div>{t('policy.tobaccoText')}</div>}
      </div>
    </div>
  )
}
