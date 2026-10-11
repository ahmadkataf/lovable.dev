// "Privacy policy · Terms of use · Open-source licences" links that open the legal dialog, and the checkbox the setup
// wizard shows to accept the terms. Both work offline: the texts are inside the app.
import { useState, type ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { LegalDialog } from './LegalDialog'
import type { LegalDoc } from './lib'
import './legal.css'

export function LegalLinks({ docs = ['privacy', 'terms', 'notices'], className }: { docs?: LegalDoc[]; className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState<LegalDoc | null>(null)
  return (
    <span className={['lg-links', className].filter(Boolean).join(' ')}>
      {/* every link carries its separator in front; the row is pulled back by one separator and clipped, so a line
          that wraps never starts with a dangling "·" */}
      <span className="lg-links-row">
        {docs.map(d => (
          <span key={d} className="lg-links-item">
            <span className="sep" aria-hidden>·</span>
            <button type="button" className="lg-link" onClick={() => setOpen(d)} data-qa={`legal-link-${d}`}>{t(`legal.${d}`)}</button>
          </span>
        ))}
      </span>
      <LegalDialog open={!!open} doc={open ?? 'privacy'} onClose={() => setOpen(null)} />
    </span>
  )
}

/**
 * "I have read and accept the terms of use and the privacy policy", with both documents one tap away. The setup
 * wizard keeps its own state (checked) and calls acceptTerms() when the clinic is created.
 */
export function AcceptTerms({ checked, onChange, error, links = ['terms', 'privacy'] }: {
  checked: boolean; onChange: (v: boolean) => void; error?: ReactNode
  /** The documents linked under the box (the setup wizard adds the open-source notices). */
  links?: LegalDoc[]
}) {
  const { t } = useI18n()
  return (
    <div className="col gap-2 lg-accept-box">
      <label className="lg-accept">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-invalid={!!error || undefined} data-qa="accept-terms" />
        <span>{t('legal.acceptLabel')}</span>
      </label>
      <LegalLinks docs={links} />
      {error && <div className="field-error" role="alert">{error}</div>}
    </div>
  )
}
