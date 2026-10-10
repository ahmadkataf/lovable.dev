import { useState, type FormEvent } from 'react'
import { Building2, Eye, ImagePlus, Mail, MapPin, Phone, Globe, Trash2, Upload } from 'lucide-react'
import { Button, Card, CardBody, Input, Textarea, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { logActivity, updateClinic } from '@/db'
import { useClinicMaybe } from '@/app/hooks'
import { ToothIcon } from '@/app/ToothIcon'
import { imageToDataUrl, pickFile } from '@/platform'
import { fmtDate } from '@/lib/dates'
import { todayISO } from '@/db/ids'
import { SheetHeader } from '@/features/billing/shared'
import { clinicDraftFrom, clinicPatch, hasErrors, previewInvoiceNumber, validateClinic, type ClinicDraft, type FieldErrors } from './lib'
import { LockedNotice, SaveBar, SectionTitle, TabSkeleton, useAccess, useDraft, useErrText } from './parts'

export default function ClinicTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const access = useAccess()
  const clinic = useClinicMaybe()
  const { draft, patch, dirty, reset } = useDraft(clinic, clinicDraftFrom)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const errText = useErrText()

  if (!clinic || !draft) return <TabSkeleton cards={3} />
  const disabled = !access.canEdit

  const set = <K extends keyof ClinicDraft>(k: K, v: ClinicDraft[K]) => {
    patch({ [k]: v } as Partial<ClinicDraft>)
    if (errors[k]) setErrors(e => ({ ...e, [k]: validateClinic({ ...draft, [k]: v })[k] }))
  }
  const field = (k: keyof ClinicDraft) => ({ value: draft[k], onChange: (e: { target: { value: string } }) => set(k, e.target.value), error: errText(errors[k]), disabled })

  const pickLogo = async () => {
    const file = await pickFile('image/*')
    if (!file) return
    try { set('logo', await imageToDataUrl(file, 256)) } catch { toast.error(t('settings.clinic.logoError')) }
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (disabled || saving) return
    const errs = validateClinic(draft)
    setErrors(errs)
    if (hasErrors(errs)) { toast.error(t('settings.fixErrors')); return }
    setSaving(true)
    try {
      const next = await updateClinic(clinicPatch(draft))
      reset(next)
      toast.success(t('settings.savedToast'))
      void logActivity({ type: 'system', action: 'update', message: t('settings.act.clinic'), by: access.userId })
    } catch { toast.error(t('settings.saveFailed')) } finally { setSaving(false) }
  }
  const discard = () => { reset(); setErrors({}) }

  const preview = { ...clinic, ...clinicPatch(draft), name: draft.name.trim() || t('settings.clinic.name') }

  return (
    <form className="st-form" onSubmit={save} noValidate>
      <LockedNotice reason={access.reason} />

      <Card>
        <CardBody>
          <SectionTitle icon={<Building2 />} title={t('settings.clinic.identity')} sub={t('settings.clinic.identitySub')} />
          <div className="st-logo-row">
            <div className={`st-logo${draft.logo ? ' has' : ''}`} data-qa="logo-box">
              {draft.logo ? <img src={draft.logo} alt={t('settings.clinic.logo')} /> : <ToothIcon size={34} />}
            </div>
            <div className="st-logo-info">
              <div className="strong">{t('settings.clinic.logo')}</div>
              <div className="text-sm muted">{draft.logo ? t('settings.clinic.logoHint') : t('settings.clinic.noLogo')}</div>
              <div className="st-logo-actions">
                <Button size="sm" variant="secondary" icon={draft.logo ? <ImagePlus /> : <Upload />} onClick={pickLogo} disabled={disabled} data-qa="pick-logo">
                  {draft.logo ? t('settings.clinic.changeLogo') : t('settings.clinic.uploadLogo')}
                </Button>
                {draft.logo && <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => set('logo', '')} disabled={disabled} data-qa="remove-logo">{t('settings.clinic.removeLogo')}</Button>}
              </div>
            </div>
          </div>
          <div className="form-grid">
            <Input label={t('settings.clinic.name')} required dir="auto" placeholder={t('settings.clinic.namePh')} {...field('name')} data-qa="clinic-name" />
            <Input label={t('settings.clinic.nameEn')} placeholder={t('settings.clinic.nameEnPh')} dir="ltr" hint={errors.nameEn ? undefined : t('settings.clinic.nameEnHint')} {...field('nameEn')} />
            <div className="span-2"><Input label={t('settings.clinic.tagline')} dir="auto" placeholder={t('settings.clinic.taglinePh')} {...field('tagline')} /></div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<MapPin />} title={t('settings.clinic.contact')} sub={t('settings.clinic.contactSub')} />
          <div className="form-grid">
            <Input label={t('phone')} type="tel" inputMode="tel" dir="ltr" iconStart={<Phone />} placeholder="0944 123 456" {...field('phone')} data-qa="clinic-phone" />
            <Input label={t('phone2')} type="tel" inputMode="tel" dir="ltr" iconStart={<Phone />} placeholder="011 234 5678" {...field('phone2')} />
            <Input label={t('email')} type="email" inputMode="email" dir="ltr" iconStart={<Mail />} placeholder="info@clinic.com" {...field('email')} data-qa="clinic-email" />
            <Input label={t('settings.clinic.website')} dir="ltr" iconStart={<Globe />} placeholder="www.clinic.com" {...field('website')} />
            <div className="span-2">
              <Textarea label={t('address')} rows={2} dir="auto" placeholder={t('settings.clinic.addressPh')} value={draft.address} onChange={e => set('address', e.target.value)} disabled={disabled} className="st-textarea-short" />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<Eye />} title={t('settings.clinic.preview')} sub={t('settings.clinic.previewSub')} />
          <div className="st-sheet-frame" aria-hidden>
            <div className="bl-sheet st-sheet" data-qa="invoice-preview">
              <SheetHeader clinic={preview} title={t('billing.sheet.invoice')} number={previewInvoiceNumber(clinic.invoicePrefix, clinic.nextInvoiceNumber)}
                facts={[{ label: t('billing.issueDate'), value: fmtDate(todayISO(), lang, 'long') }]} />
              <div className="st-sheet-lines"><span /><span /><span /></div>
            </div>
          </div>
        </CardBody>
      </Card>

      <SaveBar dirty={dirty} saving={saving} disabled={disabled} hidden={!access.isAdmin} onDiscard={discard} />
    </form>
  )
}
