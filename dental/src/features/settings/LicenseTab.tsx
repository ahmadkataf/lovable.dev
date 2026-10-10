import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BadgeCheck, CalendarClock, Copy, Crown, Infinity as InfinityIcon, KeyRound, Lock, Mail, MessageCircle, ShieldAlert, ShieldCheck, Sparkles, Store } from 'lucide-react'
import { Alert, Badge, Button, buttonClass, Card, CardBody, Input, ProgressBar, useConfirm, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { getSetting, logActivity } from '@/db'
import { useClinic } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { checkCode, TRIAL_DAYS } from '@/license/core'
import { openExternal } from '@/platform'
import { addDays, fmtDate } from '@/lib/dates'
import { formatPhone, whatsappLink } from '@/lib/format'
import { CODE_CHARS, codeChars, formatCodeInput, isCodeComplete, mailtoLink, renewSoon } from './lib'
import { SELLER } from './seller'
import { SectionTitle, TabSkeleton, copyText, useAccess } from './parts'

export default function LicenseTab() {
  const { t, lang, pick } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const access = useAccess()
  const lic = useLicense()
  const clinic = useClinic()
  const installedAt = useLiveQuery(() => getSetting<string | null>('installedAt', null), [])
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renewing, setRenewing] = useState(false)

  if (lic.loading || !lic.device) return <TabSkeleton cards={2} />
  const { status } = lic
  const clinicName = pick(clinic.name, clinic.nameEn) || t('appName')
  const request = t('license.requestMsg', { clinic: clinicName, device: lic.device })
  const trialEnd = installedAt ? addDays(installedAt.slice(0, 10), TRIAL_DAYS) : null
  const showForm = status !== 'active' || renewing

  const copyDevice = async () => {
    if (await copyText(lic.device)) toast.success(t('license.deviceCopied'))
    else toast.error(t('license.copyFailed'))
  }

  const activate = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    if (!isCodeComplete(code)) { setError(t('license.err.format')); return }
    setBusy(true)
    try {
      const r = await lic.activate(code)
      if (r !== 'ok') { setError(t(`license.err.${r}`)); return }
      const c = await checkCode(lic.device, code)
      const plan = c.ok ? t(`license.plan.${c.plan}`) : ''
      setCode(''); setError(null); setRenewing(false)
      toast.success(t('license.activated'), plan)
      void logActivity({ type: 'system', action: 'other', message: t('license.act.activated', { plan }), by: access.userId })
    } finally { setBusy(false) }
  }

  const deactivate = async () => {
    const ok = await confirm({ title: t('license.deactivateTitle'), description: t('license.deactivateDesc'), danger: true, confirmLabel: t('license.deactivateBtn') })
    if (!ok) return
    await lic.deactivate()
    toast.success(t('license.deactivated'))
    void logActivity({ type: 'system', action: 'other', message: t('license.act.deactivated'), by: access.userId })
  }

  return (
    <div className="st-form">
      {/* ---- status ---- */}
      <Card className={`st-license-hero st-lic-${status}`} data-qa="license-status" data-status={status}>
        <CardBody>
          <div className="st-hero">
            <span className="st-hero-icon">{status === 'active' ? <ShieldCheck /> : status === 'expired' ? <ShieldAlert /> : <Sparkles />}</span>
            <div className="grow">
              <div className="row wrap gap-2">
                <h2 className="st-hero-title">{t(`license.status.${status}`)}</h2>
                {status === 'active' && lic.plan && <Badge tone={lic.plan === 'pro' ? 'accent' : 'primary'} icon={lic.plan === 'pro' ? <Crown /> : <BadgeCheck />}>{t(`license.plan.${lic.plan}`)}</Badge>}
                {status === 'expired' && <Badge tone="danger" icon={<Lock />}>{t('license.readOnly')}</Badge>}
              </div>
              <p className="st-hero-desc">{status === 'active' ? t('license.activeDesc') : status === 'expired' ? t('license.expiredDesc') : t('license.trialDesc')}</p>
            </div>
          </div>

          {status === 'trial' && (
            <div className="st-trial" data-qa="trial-progress">
              <div className="st-trial-row">
                <span className="strong">{t('license.trialLeft', { n: lic.daysLeft, total: TRIAL_DAYS })}</span>
                {trialEnd && <span className="text-sm muted">{t('license.trialEnds', { date: fmtDate(trialEnd, lang, 'long') })}</span>}
              </div>
              <ProgressBar value={lic.daysLeft} max={TRIAL_DAYS} tone={lic.daysLeft <= 2 ? 'var(--danger)' : 'var(--warning)'} />
            </div>
          )}

          {status === 'active' && (
            <div className="st-license-facts">
              <div className="st-fact">
                <span className="st-fact-icon">{lic.until ? <CalendarClock /> : <InfinityIcon />}</span>
                <span><span className="st-fact-label">{lic.until ? t('license.validUntil') : t('license.lifetime')}</span>
                  <span className="st-fact-value" data-qa="license-until">{lic.until ? fmtDate(lic.until, lang, 'long') : t('license.lifetimeDesc')}</span></span>
              </div>
              {lic.until && (
                <div className="st-fact">
                  <span className="st-fact-icon"><CalendarClock /></span>
                  <span><span className="st-fact-label">{t('license.daysLeft')}</span><span className="st-fact-value num">{lic.daysLeft}</span></span>
                </div>
              )}
            </div>
          )}
          {status === 'active' && renewSoon(lic.until) && lic.until && <Alert tone="warning" className="mt-4">{t('license.renewSoon', { date: fmtDate(lic.until, lang, 'long') })}</Alert>}
        </CardBody>
      </Card>

      <div className="st-grid-2">
        {/* ---- device number ---- */}
        <Card>
          <CardBody>
            <SectionTitle icon={<KeyRound />} title={t('license.device')} sub={t('license.deviceDesc')} />
            <div className="st-device">
              <span className="st-device-no ltr" data-qa="device-number">{lic.device}</span>
              <Button variant="secondary" icon={<Copy />} onClick={copyDevice} data-qa="copy-device">{t('license.copyDevice')}</Button>
            </div>
          </CardBody>
        </Card>

        {/* ---- activation ---- */}
        <Card>
          <CardBody>
            <SectionTitle icon={<BadgeCheck />} title={status === 'active' ? t('license.renew') : t('license.activateTitle')} sub={status === 'active' ? t('license.renewHint') : t('license.activateDesc')} tone="success" />
            {showForm ? (
              <form className="st-activate" onSubmit={activate} noValidate>
                <Input label={t('license.codeLabel')} value={code} onChange={e => { setCode(formatCodeInput(e.target.value)); setError(null) }}
                  placeholder="XXXX-XXXX-XXXX-XXXX" dir="ltr" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={19}
                  className="st-code-input" error={error ?? undefined} hint={error ? undefined : t('license.codeHint')} data-qa="code-input" />
                <div className="st-activate-foot">
                  <span className="st-code-count num" aria-live="polite">{codeChars(code)}/{CODE_CHARS}</span>
                  {status === 'active' && <Button variant="ghost" onClick={() => { setRenewing(false); setCode(''); setError(null) }}>{t('cancel')}</Button>}
                  <Button type="submit" variant="primary" icon={<KeyRound />} loading={busy} data-qa="activate">{t('license.activate')}</Button>
                </div>
              </form>
            ) : (
              <Button variant="secondary" icon={<KeyRound />} onClick={() => setRenewing(true)} data-qa="renew">{t('license.renew')}</Button>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ---- how to buy ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Store />} title={t('license.buyTitle')} sub={t('license.buySub')} />
          <ol className="st-buy-steps">
            <li><span className="st-step-no num">1</span>{t('license.buy.step1')}</li>
            <li><span className="st-step-no num">2</span>{t('license.buy.step2')}</li>
            <li><span className="st-step-no num">3</span>{t('license.buy.step3')}</li>
          </ol>
          <div className="st-seller">
            <div className="st-seller-info">
              <div><span className="muted text-sm">{t('license.seller')}</span><div className="strong">{SELLER.name}</div>
                <div className="st-seller-contacts">
                  {SELLER.whatsapp && <span className="ltr">{formatPhone(SELLER.whatsapp)}</span>}
                  {SELLER.email && <span className="ltr">{SELLER.email}</span>}
                </div>
              </div>
              {(SELLER.priceText || SELLER.priceTextEn) && <div><span className="muted text-sm">{t('license.price')}</span><div className="strong" data-qa="price">{pick(SELLER.priceText, SELLER.priceTextEn)}</div></div>}
            </div>
            <div className="st-seller-actions">
              {SELLER.whatsapp && (
                <Button variant="success" icon={<MessageCircle />} onClick={() => openExternal(whatsappLink(SELLER.whatsapp, request))} data-qa="buy-whatsapp">
                  {t('license.whatsapp')}
                </Button>
              )}
              {SELLER.email && (
                <a className={buttonClass({ variant: 'secondary' })} href={mailtoLink(SELLER.email, t('license.requestSubject', { device: lic.device }), request)} data-qa="buy-email">
                  <Mail /><span>{t('license.email')}</span>
                </a>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {status === 'active' && access.isAdmin && (
        <div className="st-deactivate">
          <Button variant="ghost" size="sm" onClick={deactivate} data-qa="deactivate">{t('license.deactivate')}</Button>
        </div>
      )}
    </div>
  )
}
