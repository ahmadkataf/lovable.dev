// The red notice shown wherever someone tries to add a tobacco product: the rule of the product, not a setting.
// `terms` is the same rule stated up front (activation / subscription): any tobacco product, under any name,
// description or keywords, is refused; whoever does not accept that should not subscribe.
import { Ban } from 'lucide-react'
import { useT } from '../i18n'

export function PolicyBanner({ compact, terms }: { compact?: boolean; terms?: boolean }) {
  const t = useT()
  if (terms) {
    return (
      <div className="policy-banner terms" role="note">
        <Ban size={22} />
        <div>
          <div className="policy-label">{t('policy.termsLabel')}</div>
          <strong>{t('policy.tobaccoTitle')}</strong>
          <div>{t('policy.termsText')}</div>
          <div className="policy-accept">{t('policy.termsAccept')}</div>
        </div>
      </div>
    )
  }
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
