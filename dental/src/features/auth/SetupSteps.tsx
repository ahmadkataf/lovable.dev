// The five steps of the first-run wizard. Each step is a controlled view of the wizard's drafts; validation lives in ./lib.
import { useState } from 'react'
import {
  Building2, CalendarDays, Check, Coins, History, ImagePlus, Mail, MapPin, Pencil, Phone, ShieldCheck, Stethoscope, Trash2, UploadCloud, UserRound,
} from 'lucide-react'
import { Alert, Avatar, Badge, Chip, Field, IconBox, Input, NumberInput, Segmented, Select, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import type { Lang } from '@/db/types'
import { formatMoney } from '@/lib/format'
import { fmtTime, weekdayName } from '@/lib/dates'
import { imageToDataUrl, pickFile } from '@/platform'
import { ToothIcon } from '@/app/ToothIcon'
import { TRIAL_DAYS } from '@/license/core'
import {
  CURRENCIES, CUSTOM_CURRENCY, SLOT_OPTIONS, WEEK_ORDER, cleanCurrencyCode, currencyPreset, defaultDecimals, displayName, orderedDays, plainName, resolveCurrency, toggleDay,
  type ClinicDraft, type MoneyDraft, type OwnerDraft,
} from './lib'
import { PinField } from './PinField'

/** field → translated error, or undefined while errors are hidden. */
export type ErrFn = (field: string) => string | undefined
export const OWNER_COLOR = '#0E8F86'

// ---- 1. language -------------------------------------------------------------------------------
export function LanguageStep({ lang, onPick, onRestore, restoring }: { lang: Lang; onPick: (l: Lang) => void; onRestore: () => void; restoring: boolean }) {
  const { t } = useI18n()
  const card = (l: Lang, mark: string, name: string, sub: string, dir: 'rtl' | 'ltr') => (
    <button type="button" className="au-lang-card" aria-pressed={lang === l} onClick={() => onPick(l)} data-lang={l}>
      <span className="au-lang-mark" dir={dir}>{mark}</span>
      <span className="au-lang-name" dir={dir}>{name}</span>
      <span className="au-lang-sub" dir={dir}>{sub}</span>
      {lang === l && <span className="au-lang-check"><Check /></span>}
    </button>
  )
  return (
    <>
      <div className="au-step-sub">{t('auth.lang.title')}</div>
      <div className="au-lang-grid">
        {card('ar', t('auth.lang.arMark'), t('auth.lang.arName'), t('auth.lang.arSub'), 'rtl')}
        {card('en', t('auth.lang.enMark'), t('auth.lang.enName'), t('auth.lang.enSub'), 'ltr')}
      </div>
      <div className="muted text-sm mt-3">{t('auth.lang.desc')}</div>
      <div className="au-restore">
        <History />
        <span>{t('auth.restore.q')}</span>
        <button type="button" className="au-link" onClick={onRestore} disabled={restoring} data-qa="restore">
          {restoring ? <span className="spinner" /> : <UploadCloud />}{restoring ? t('auth.restore.busy') : t('auth.restore.link')}
        </button>
      </div>
    </>
  )
}

// ---- 2. clinic --------------------------------------------------------------------------------
export function ClinicStep({ value, onChange, err }: { value: ClinicDraft; onChange: (v: ClinicDraft) => void; err: ErrFn }) {
  const { t } = useI18n()
  const toast = useToast()
  const [loadingLogo, setLoadingLogo] = useState(false)
  const set = <K extends keyof ClinicDraft>(k: K, v: ClinicDraft[K]) => onChange({ ...value, [k]: v })
  const pickLogo = async () => {
    const f = await pickFile('image/*')
    if (!f) return
    setLoadingLogo(true)
    try { set('logo', await imageToDataUrl(f, 256)) } catch { toast.error(t('auth.clinic.logoFailed')) } finally { setLoadingLogo(false) }
  }
  return (
    <div className="form-grid">
      <Input className="span-2" label={t('auth.clinic.name')} required autoFocus value={value.name} onChange={e => set('name', e.target.value)} placeholder={t('auth.clinic.namePh')}
        iconStart={<Building2 />} error={err('name')} name="clinicName" maxLength={80} />
      <Input label={t('phone')} value={value.phone} onChange={e => set('phone', e.target.value)} placeholder={t('auth.clinic.phonePh')} iconStart={<Phone />}
        dir="ltr" inputMode="tel" type="tel" error={err('phone')} name="clinicPhone" maxLength={24} />
      <Input label={t('email')} value={value.email} onChange={e => set('email', e.target.value)} placeholder={t('auth.clinic.emailPh')} iconStart={<Mail />}
        dir="ltr" inputMode="email" type="email" error={err('email')} name="clinicEmail" maxLength={80} />
      <Input className="span-2" label={t('address')} value={value.address} onChange={e => set('address', e.target.value)} placeholder={t('auth.clinic.addressPh')}
        iconStart={<MapPin />} name="clinicAddress" maxLength={140} />
      <Field className="span-2" label={t('auth.clinic.logo')} hint={t('auth.clinic.logoHint')}>
        <div className="au-logo-field">
          <div className="au-logo-preview">{value.logo ? <img src={value.logo} alt="" /> : <ImagePlus />}</div>
          <div className="au-logo-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={pickLogo} disabled={loadingLogo}>
              {loadingLogo ? <span className="spinner" /> : <UploadCloud />}<span>{value.logo ? t('auth.clinic.logoChange') : t('auth.clinic.logoUpload')}</span>
            </button>
            {value.logo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('logo', undefined)}><Trash2 /><span>{t('auth.clinic.logoRemove')}</span></button>}
          </div>
        </div>
      </Field>
    </div>
  )
}

// ---- 3. money & time --------------------------------------------------------------------------
export function MoneyStep({ value, onChange, err }: { value: MoneyDraft; onChange: (v: MoneyDraft) => void; err: ErrFn }) {
  const { t, lang } = useI18n()
  const set = <K extends keyof MoneyDraft>(k: K, v: MoneyDraft[K]) => onChange({ ...value, [k]: v })
  const custom = value.currency === CUSTOM_CURRENCY
  const options = [
    ...CURRENCIES.map(c => ({ value: c.code, label: `${t(`auth.cur.${c.code}`)} (${c.symbol})` })),
    { value: CUSTOM_CURRENCY, label: t('auth.money.custom') },
  ]
  const onCurrency = (code: string) => onChange({ ...value, currency: code, decimals: code === CUSTOM_CURRENCY ? value.decimals : defaultDecimals(code) })
  const resolved = resolveCurrency(value)
  const sample = formatMoney(1250, { ...resolved, currencySymbol: resolved.currencySymbol || '¤', currency: resolved.currency || '' }, lang)

  return (
    <>
      <div className="form-section">
        <div className="form-section-title"><Coins />{t('auth.money.secBilling')}</div>
        <div className="form-grid">
          <Select label={t('auth.money.currency')} value={value.currency} onChange={e => onCurrency(e.target.value)} options={options} name="currency" />
          <Field label={t('auth.money.decimals')} className="au-dec">
            <Segmented block value={String(value.decimals) as '0' | '2'} onChange={v => set('decimals', v === '0' ? 0 : 2)}
              options={[{ value: '0', label: <><span>{t('auth.money.dec0')}</span><span className="num muted">1,250</span></> }, { value: '2', label: <><span>{t('auth.money.dec2')}</span><span className="num muted">1,250.00</span></> }]} />
          </Field>
          {custom && <>
            <Input label={t('auth.money.customCode')} required value={value.customCode} onChange={e => set('customCode', cleanCurrencyCode(e.target.value))} placeholder={t('auth.money.customCodePh')}
              dir="ltr" error={err('customCode')} name="customCode" autoFocus />
            <Input label={t('auth.money.customSymbol')} required value={value.customSymbol} onChange={e => set('customSymbol', e.target.value.slice(0, 6))} placeholder={t('auth.money.customSymbolPh')}
              error={err('customSymbol')} name="customSymbol" />
          </>}
          <div className="span-2 au-money-preview"><Coins /><span>{t('auth.money.preview')}</span><strong className="num">{sample}</strong></div>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title"><CalendarDays />{t('auth.money.hours')}</div>
        <div className="form-grid">
          <Field className="span-2" label={t('auth.money.days')} error={err('workingDays')}>
            <div className="au-days" role="group" aria-label={t('auth.money.days')}>
              {WEEK_ORDER.map(d => (
                <Chip key={d} active={value.workingDays.includes(d)} onClick={() => set('workingDays', toggleDay(value.workingDays, d))}>
                  <span className="au-day-long">{weekdayName(d, lang)}</span><span className="au-day-short">{weekdayName(d, lang, 'short')}</span>
                </Chip>
              ))}
            </div>
          </Field>
          <Input label={t('auth.money.start')} type="time" value={value.workStart} onChange={e => set('workStart', e.target.value)} error={err('workStart')} name="workStart" />
          <Input label={t('auth.money.end')} type="time" value={value.workEnd} onChange={e => set('workEnd', e.target.value)} error={err('workEnd')} name="workEnd" />
          <Select label={t('auth.money.slot')} value={String(value.slotMinutes)} onChange={e => set('slotMinutes', Number(e.target.value))}
            options={SLOT_OPTIONS.map(n => ({ value: String(n), label: t('auth.money.slotN', { n }) }))} name="slot" />
          <Field label={t('auth.money.tax')} hint={t('auth.money.taxHint')} error={err('taxPercent')} htmlFor="setup-tax">
            <NumberInput id="setup-tax" value={value.taxPercent} onChange={n => set('taxPercent', n)} decimals={2} addon="%" min={0} max={100} placeholder="0" name="tax" invalid={!!err('taxPercent')} />
          </Field>
        </div>
      </div>
    </>
  )
}

// ---- 4. owner account -------------------------------------------------------------------------
export function OwnerStep({ value, onChange, err, onTitleTouched }: { value: OwnerDraft; onChange: (v: OwnerDraft) => void; err: ErrFn; onTitleTouched: () => void }) {
  const { t } = useI18n()
  const set = <K extends keyof OwnerDraft>(k: K, v: OwnerDraft[K]) => onChange({ ...value, [k]: v })
  const shown = value.name.trim() ? displayName(value) : ''
  return (
    <>
      <div className="au-owner-hero">
        <Avatar name={plainName(value.name) || '?'} color={OWNER_COLOR} size="lg" />
        <div className="grow">
          <div className={`au-owner-name truncate${shown ? '' : ' au-owner-placeholder'}`}>{shown || t('auth.owner.name')}</div>
          <Badge tone="primary" icon={<ShieldCheck />} className="mt-1">{t('auth.owner.fullAccess')}</Badge>
        </div>
      </div>
      <div className="form-grid">
        <div className="au-name-row">
          <Select label={t('auth.owner.titleLabel')} value={value.title} onChange={e => { onTitleTouched(); set('title', e.target.value) }} name="ownerTitle"
            options={[{ value: '', label: t('auth.owner.noTitle') }, { value: t('auth.owner.titleAr'), label: t('auth.owner.titleAr') }, { value: t('auth.owner.titleEn'), label: t('auth.owner.titleEn') }]} />
          <Input label={t('auth.owner.name')} required autoFocus value={value.name} onChange={e => set('name', e.target.value)} placeholder={t('auth.owner.namePh')}
            iconStart={<UserRound />} error={err('name')} name="ownerName" maxLength={60} />
        </div>
        <Input label={t('auth.owner.specialty')} value={value.specialty} onChange={e => set('specialty', e.target.value)} placeholder={t('auth.owner.specialtyPh')} iconStart={<Stethoscope />} name="ownerSpecialty" maxLength={60} />
        <Input label={t('phone')} value={value.phone} onChange={e => set('phone', e.target.value)} placeholder={t('auth.clinic.phonePh')} iconStart={<Phone />}
          dir="ltr" inputMode="tel" type="tel" error={err('phone')} name="ownerPhone" maxLength={24} />
        <PinField label={t('auth.pin.label')} required hint={t('auth.pin.hint')} error={err('pin')} value={value.pin} onChange={v => set('pin', v)} id="owner-pin" />
        <PinField label={t('auth.pin.confirm')} required error={err('pin2')} value={value.pin2} onChange={v => set('pin2', v)} id="owner-pin2" />
      </div>
    </>
  )
}

// ---- 5. review --------------------------------------------------------------------------------
export function ReviewStep({ lang, clinic, money, owner, onEdit }: { lang: Lang; clinic: ClinicDraft; money: MoneyDraft; owner: OwnerDraft; onEdit: (step: number) => void }) {
  const { t } = useI18n()
  const cur = resolveCurrency(money)
  const preset = currencyPreset(cur.currency)
  const curName = money.currency !== CUSTOM_CURRENCY && preset ? `${t(`auth.cur.${preset.code}`)} (${preset.symbol})` : `${cur.currency} (${cur.currencySymbol})`
  const head = (icon: React.ReactNode, title: string, step: number) => (
    <div className="au-review-head">
      <IconBox>{icon}</IconBox><span>{title}</span>
      <button type="button" className="au-link" onClick={() => onEdit(step)}><Pencil />{t('auth.review.edit')}</button>
    </div>
  )
  return (
    <>
      <div className="au-review">
        <div className="au-review-card">
          {head(<Building2 />, t('auth.review.clinic'), 1)}
          <div className="au-review-who">
            <div className="au-review-logo">{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon />}</div>
            <div className="grow"><div className="strong truncate">{clinic.name}</div><div className="text-sm muted">{lang === 'ar' ? t('arabic') : t('english')}</div></div>
          </div>
          <dl className="kv">
            {clinic.phone.trim() && <><dt>{t('phone')}</dt><dd><span className="ltr">{clinic.phone.trim()}</span></dd></>}
            {clinic.email.trim() && <><dt>{t('email')}</dt><dd><span className="ltr">{clinic.email.trim()}</span></dd></>}
            {clinic.address.trim() && <><dt>{t('address')}</dt><dd>{clinic.address.trim()}</dd></>}
          </dl>
        </div>
        <div className="au-review-card">
          {head(<UserRound />, t('auth.review.owner'), 3)}
          <div className="au-review-who">
            <Avatar name={plainName(owner.name) || '?'} color={OWNER_COLOR} />
            <div className="grow"><div className="strong truncate">{displayName(owner)}</div><div className="text-sm muted">{t('role.admin')}</div></div>
          </div>
          <dl className="kv">
            {owner.specialty.trim() && <><dt>{t('auth.owner.specialty')}</dt><dd>{owner.specialty.trim()}</dd></>}
            {owner.phone.trim() && <><dt>{t('phone')}</dt><dd><span className="ltr">{owner.phone.trim()}</span></dd></>}
            <dt>{t('auth.review.pinSet')}</dt><dd><span className="ltr">{'•'.repeat(owner.pin.length)}</span> <span className="muted">· {t('auth.review.pinDigits', { n: owner.pin.length })}</span></dd>
          </dl>
        </div>
        <div className="au-review-card wide">
          {head(<Coins />, t('auth.review.money'), 2)}
          <dl className="kv">
            <dt>{t('currency')}</dt><dd>{curName} · <span className="num">{formatMoney(1250, cur, lang)}</span></dd>
            <dt>{t('auth.review.workDays')}</dt><dd><span className="au-day-list">{orderedDays(money.workingDays).map(d => <Badge key={d} size="sm">{weekdayName(d, lang)}</Badge>)}</span></dd>
            <dt>{t('auth.review.hours')}</dt><dd><bdi>{fmtTime(money.workStart, lang)}</bdi> – <bdi>{fmtTime(money.workEnd, lang)}</bdi></dd>
            <dt>{t('auth.review.slot')}</dt><dd>{t('auth.money.slotN', { n: money.slotMinutes })}</dd>
            <dt>{t('tax')}</dt><dd>{money.taxPercent ? <span className="num">{money.taxPercent}%</span> : t('auth.review.noTax')}</dd>
          </dl>
        </div>
      </div>
      <Alert tone="info" className="au-trial">{t('auth.setup.trial', { days: TRIAL_DAYS })}</Alert>
    </>
  )
}
