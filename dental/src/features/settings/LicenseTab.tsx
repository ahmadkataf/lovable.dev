import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BadgeCheck, CalendarClock, Copy, Crown, ExternalLink, Globe, Infinity as InfinityIcon, KeyRound, Lock, Mail, MessageCircle, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Store, Tag } from 'lucide-react'
import { Alert, Badge, Button, buttonClass, Card, CardBody, ProgressBar, Spinner, useConfirm, useToast, Textarea } from '@/ui'
import { useI18n } from '@/i18n'
import { getSetting, logActivity } from '@/db'
import { useClinic } from '@/app/hooks'
import { useLicense, type ActivateResult } from '@/license/useLicense'
import { checkCode, codeKind, extractCode, TRIAL_DAYS } from '@/license/core'
import { activationPageUrl, findKeys, isLicenceKey, redeemKey, type RedeemResult } from '@/license/online'
import { openExternal } from '@/platform'
import { fmtDate } from '@/lib/dates'
import { formatPhone, whatsappLink } from '@/lib/format'
import { CODE_CHARS, codeChars, codeDay, formatCodeInput, isCodeComplete, mailtoLink, renewSoon, trialEndsAt } from './lib'
import { SELLER, sellerShown } from './seller'
import { SectionTitle, TabSkeleton, copyText, useAccess, useSingleFlight } from './parts'

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
  const [contacting, setContacting] = useState(false)    // a licence key is on its way to the activation server
  const [offerBrowser, setOfferBrowser] = useState(false) // the server could not be reached: offer the activation page
  const [renewing, setRenewing] = useState(false)
  const once = useSingleFlight()

  if (lic.loading || (!lic.device && !lic.deviceError)) return <TabSkeleton cards={2} />
  const noDevice = !lic.device
  const { status } = lic
  const licenseEnded = status === 'expired' && lic.ended === 'license'
  const clinicName = pick(clinic.name, clinic.nameEn) || t('appName')
  const request = t('license.requestMsg', { clinic: clinicName, device: lic.device })
  const trialEnd = trialEndsAt(installedAt, TRIAL_DAYS)
  // A code's last day is stored as a UTC day: show that calendar day whatever the device's time zone.
  const untilText = lic.until ? fmtDate(codeDay(lic.until), lang, 'long') : ''
  const hasSeller = sellerShown() && !!(SELLER.whatsapp || SELLER.email)
  // only WhatsApp: the button below writes the message (device number and clinic) for them
  const step2 = !hasSeller ? 'license.buy.step2Neutral' : SELLER.email ? 'license.buy.step2' : 'license.buy.step2Wa'
  const showForm = status !== 'active' || renewing
  const isKey = isLicenceKey(code)

  const copyDevice = async () => {
    if (await copyText(lic.device)) toast.success(t('license.deviceCopied'))
    else toast.error(t('license.copyFailed'))
  }

  // the field takes a code or a key: a pasted message gives whichever it holds (a complete code wins); a text holding
  // several keys (a reseller's list) is shown as those keys, one per line, for the clinic to keep one
  const onCodeChange = (value: string) => {
    const pasted = extractCode(value)
    const keys = codeKind(pasted) ? [] : findKeys(value)
    setOfferBrowser(false)
    if (keys.length > 1) { setCode(keys.join('\n')); setError(t('license.key.err.many')); return }
    setCode(keys[0] || formatCodeInput(pasted))
    setError(null)
  }
  const keyError = (r: Extract<RedeemResult, { ok: false }>) =>
    r.reason === 'locked' ? (r.retryAfter ? t('license.key.err.locked', { n: Math.ceil(r.retryAfter / 60) }) : t('license.key.err.lockedSoon')) : t(`license.key.err.${r.reason}`)
  // what the server answered is not trusted: lic.activate() refuses a code for another device, a damaged one, or one
  // whose term is already over (the server refuses an ended code itself with 410 expired, so that last case only shows
  // when this device's clock is ahead of the server's)
  const keyCheckError = async (activation: string, r: ActivateResult) => {
    const c = r === 'expired' ? await checkCode(lic.device, activation, new Date(lic.now())) : null
    return c && !c.ok && c.reason === 'expired' ? t('license.key.err.ended', { date: fmtDate(codeDay(c.until), lang, 'long') }) : t('license.key.err.check')
  }

  const activate = (e?: FormEvent) => {
    e?.preventDefault()
    if (noDevice) { setError(t('license.deviceError')); return }
    const withKey = isLicenceKey(code)
    if (!withKey && findKeys(code).length > 1) { setError(t('license.key.err.many')); return }
    // 16 characters that are not a key hold a look-alike (0/O/1/I), which neither codes nor keys use: not "incomplete"
    if (!withKey && codeChars(code) === 16) { setError(t('license.key.err.key')); return }
    if (!withKey && !isCodeComplete(code)) { setError(t('license.err.incomplete')); return }
    void once(async () => {
      setBusy(true); setOfferBrowser(false)
      try {
        // a key is exchanged online for an ordinary code, which then goes through the same local check as any code
        let activation = code
        if (withKey) {
          setContacting(true)
          const got = await redeemKey(code, lic.device).finally(() => setContacting(false))
          // the website links to the price and to buying on WhatsApp, so a copy that hides the seller box (installed
          // from Google Play) does not offer it either
          if (!got.ok) { setError(keyError(got)); setOfferBrowser(sellerShown() && (got.reason === 'offline' || got.reason === 'server')); return }
          activation = got.code
        }
        const r = await lic.activate(activation)
        if (r !== 'ok') { setError(withKey ? await keyCheckError(activation, r) : t(`license.err.${r}`)); return }
        const c = await checkCode(lic.device, activation, new Date(lic.now()))
        const plan = c.ok ? t(`license.plan.${c.plan}`) : ''
        setCode(''); setError(null); setRenewing(false)
        toast.success(t('license.activated'), plan)
        void logActivity({ type: 'system', action: 'other', message: t(withKey ? 'license.act.activatedKey' : 'license.act.activated', { plan }), by: access.userId })
      } catch { setError(t(withKey ? 'license.key.err.check' : 'license.err.format')) } finally { setBusy(false) }
    })
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
      <Card className={`st-license-hero st-lic-${status}`} data-qa="license-status" data-status={status} data-ended={lic.ended ?? undefined}>
        <CardBody>
          <div className="st-hero">
            <span className="st-hero-icon">{status === 'active' ? <ShieldCheck /> : status === 'expired' ? <ShieldAlert /> : <Sparkles />}</span>
            <div className="grow">
              <div className="row wrap gap-2">
                <h2 className="st-hero-title">{licenseEnded ? t('license.status.licenseEnded') : t(`license.status.${status}`)}</h2>
                {status === 'active' && lic.plan && <Badge tone={lic.plan === 'pro' ? 'accent' : 'primary'} icon={lic.plan === 'pro' ? <Crown /> : <BadgeCheck />}>{t(`license.plan.${lic.plan}`)}</Badge>}
                {status === 'expired' && <Badge tone="danger" icon={<Lock />}>{t('license.readOnly')}</Badge>}
              </div>
              <p className="st-hero-desc">{status === 'active' ? t('license.activeDesc') : licenseEnded ? t('license.licenseEndedDesc', { date: untilText }) : status === 'expired' ? t('license.expiredDesc') : t('license.trialDesc')}</p>
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

          {/* the shortest way to a code, at the top of the screen: one tap writes the request (clinic and device
              number) to the seller on WhatsApp */}
          {hasSeller && SELLER.whatsapp && !noDevice && status !== 'active' && (
            <div className="st-device-ask">
              {(SELLER.priceText || SELLER.priceTextEn) && <div className="st-price-tag" data-qa="price-top"><Tag />{pick(SELLER.priceText, SELLER.priceTextEn)}</div>}
              <Button variant="success" block icon={<MessageCircle />} onClick={() => openExternal(whatsappLink(SELLER.whatsapp, request))} data-qa="ask-whatsapp">
                {t('license.askWhatsapp')}
              </Button>
              <span className="text-sm muted">{t('license.askWhatsappHint')}</span>
            </div>
          )}

          {status === 'active' && (
            <div className="st-license-facts">
              <div className="st-fact">
                <span className="st-fact-icon">{lic.until ? <CalendarClock /> : <InfinityIcon />}</span>
                <span><span className="st-fact-label">{lic.until ? t('license.validUntil') : t('license.lifetime')}</span>
                  <span className="st-fact-value" data-qa="license-until">{lic.until ? untilText : t('license.lifetimeDesc')}</span></span>
              </div>
              {lic.until && (
                <div className="st-fact">
                  <span className="st-fact-icon"><CalendarClock /></span>
                  <span><span className="st-fact-label">{t('license.daysLeft')}</span><span className="st-fact-value num">{lic.daysLeft}</span></span>
                </div>
              )}
            </div>
          )}
          {status === 'active' && renewSoon(lic.until, new Date(lic.now())) && lic.until && <Alert tone="warning" className="mt-4">{t('license.renewSoon', { date: untilText })}</Alert>}
          {lic.clockBehind && <Alert tone="warning" className="mt-4">{t('license.clockBehind')}</Alert>}
        </CardBody>
      </Card>

      <div className="st-grid-2">
        {/* ---- device number ---- */}
        <Card>
          <CardBody>
            <SectionTitle icon={<KeyRound />} title={t('license.device')} sub={t('license.deviceDesc')} />
            {noDevice ? (
              <div data-qa="device-error">
                <Alert tone="danger" title={t('license.deviceError')}>
                  {t('license.deviceErrorDesc')}
                  <div className="mt-3"><Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={lic.retryDevice} data-qa="device-retry">{t('license.deviceRetry')}</Button></div>
                </Alert>
              </div>
            ) : (
              <div className="st-device">
                <span className="st-device-no ltr" data-qa="device-number">{lic.device}</span>
                <Button variant="secondary" icon={<Copy />} onClick={copyDevice} data-qa="copy-device">{t('license.copyDevice')}</Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* ---- activation ---- */}
        <Card>
          <CardBody>
            <SectionTitle icon={<BadgeCheck />} title={status === 'active' ? t('license.renew') : t('license.activateTitle')} sub={status === 'active' ? t('license.renewHint') : t('license.activateDesc')} tone="success" />
            {showForm ? (
              <form className="st-activate" onSubmit={activate} noValidate>
                <Textarea label={t('license.codeLabel')} value={code} onChange={e => onCodeChange(e.target.value)} readOnly={contacting}
                  placeholder={t('license.codePlaceholder')} dir="ltr" autoComplete="off" autoCapitalize="characters" spellCheck={false} rows={7}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); activate() } }}
                  className="st-code-input" error={error ?? undefined} hint={error ? undefined : t(isKey ? 'license.key.hint' : 'license.codeHint')} data-qa="code-input" />
                <div className="st-activate-foot">
                  {isKey
                    ? <span className="st-code-kind" data-qa="key-detected"><Globe />{t('license.key.detected')}</span>
                    : <span className="st-code-count num" aria-live="polite">{codeChars(code)}/{CODE_CHARS}</span>}
                  {status === 'active' && <Button variant="ghost" disabled={busy} onClick={() => { setRenewing(false); setCode(''); setError(null); setOfferBrowser(false) }}>{t('cancel')}</Button>}
                  <Button type="submit" variant="primary" icon={<KeyRound />} loading={busy} disabled={noDevice} data-qa="activate">{t('license.activate')}</Button>
                </div>
                {contacting && <div className="st-key-progress" role="status" data-qa="key-contacting"><Spinner />{t('license.key.contacting')}</div>}
                {offerBrowser && (
                  <div className="st-key-browser" data-qa="key-browser-offer">
                    <Button variant="secondary" icon={<ExternalLink />} onClick={() => openExternal(activationPageUrl(lic.device, lang))} data-qa="key-browser">{t('license.key.browser')}</Button>
                    <span className="text-sm muted">{t('license.key.browserHint', { url: activationPageUrl('', lang).replace('https://', '') })}</span>
                  </div>
                )}
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
          <SectionTitle icon={<Store />} title={t('license.buyTitle')} sub={t(hasSeller ? 'license.buySub' : 'license.buySubNeutral')} />
          <ol className="st-buy-steps">
            <li><span className="st-step-no num">1</span>{t('license.buy.step1')}</li>
            <li><span className="st-step-no num">2</span>{t(step2)}</li>
            <li><span className="st-step-no num">3</span>{t('license.buy.step3')}</li>
          </ol>
          {hasSeller && <div className="st-seller">
            <div className="st-seller-info">
              <div>{SELLER.name && <><span className="muted text-sm">{t('license.seller')}</span><div className="strong">{SELLER.name}</div></>}
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
          </div>}
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
