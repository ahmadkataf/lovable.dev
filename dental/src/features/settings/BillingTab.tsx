import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Banknote, Eye, FileSignature, FileText, Hash, Percent, Receipt } from 'lucide-react'
import { Alert, Card, CardBody, Field, Input, NumberInput, Segmented, Select, Textarea, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { db, logActivity, updateClinic } from '@/db'
import { useClinicMaybe } from '@/app/hooks'
import { formatMoney } from '@/lib/format'
import { CURRENCIES, CUSTOM_CURRENCY, cleanCurrencyCode } from '@/features/auth/lib'
import {
  SAMPLE_LINES, billingDraftFrom, billingPatch, hasErrors, lastInvoiceSeq, previewInvoiceNumber, sampleTotals, validateBilling, withCurrency,
  type BillingDraft, type FieldErrors,
} from './lib'
import { LockedNotice, SaveBar, SectionTitle, TabSkeleton, useAccess, useDraft, useErrText } from './parts'

export default function BillingTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const access = useAccess()
  const clinic = useClinicMaybe()
  const { draft, setDraft, dirty, reset } = useDraft(clinic, billingDraftFrom)
  const numbers = useLiveQuery(() => db.invoices.orderBy('number').keys(), []) as string[] | undefined
  const lastFileNo = useLiveQuery(async () => (await db.patients.orderBy('fileNo').last())?.fileNo ?? 0, [])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const errText = useErrText()

  if (!clinic || !draft || numbers === undefined || lastFileNo === undefined) return <TabSkeleton cards={3} />
  const disabled = !access.canEdit
  const used = { lastInvoiceSeq: lastInvoiceSeq(numbers.map(String), draft.invoicePrefix.trim()), lastFileNo }

  const update = (next: BillingDraft) => {
    setDraft(next)
    if (hasErrors(errors)) setErrors(validateBilling(next, used))
  }
  const set = <K extends keyof BillingDraft>(k: K, v: BillingDraft[K]) => update({ ...draft, [k]: v })

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (disabled || saving) return
    const errs = validateBilling(draft, used)
    setErrors(errs)
    if (hasErrors(errs)) { toast.error(t('settings.fixErrors')); return }
    setSaving(true)
    try {
      const next = await updateClinic(billingPatch(draft))
      reset(next)
      toast.success(t('settings.savedToast'))
      void logActivity({ type: 'system', action: 'update', message: t('settings.act.billing'), by: access.userId })
    } catch { toast.error(t('settings.saveFailed')) } finally { setSaving(false) }
  }
  const discard = () => { reset(); setErrors({}) }

  const p = billingPatch(draft)
  const moneyOpts = { currency: p.currency || '', currencySymbol: draft.symbol.trim() || p.currency || '', currencyDecimals: draft.decimals }
  const fmt = (n: number) => formatMoney(n, moneyOpts, lang)
  const totals = sampleTotals(draft.taxPercent)
  const currencyChanged = p.currency !== clinic.currency
  const lowered = (draft.nextInvoiceNumber ?? 0) < clinic.nextInvoiceNumber && !errors.nextInvoiceNumber
  const currencyOptions = [
    ...CURRENCIES.map(c => ({ value: c.code, label: `${t(`auth.cur.${c.code}`)} — ${c.code} (${c.symbol})` })),
    { value: CUSTOM_CURRENCY, label: t('auth.money.custom') },
  ]

  return (
    <form className="st-form" onSubmit={save} noValidate>
      <LockedNotice reason={access.reason} />

      <Card className="st-preview-card" data-qa="billing-preview">
        <CardBody>
          <SectionTitle icon={<Eye />} title={t('settings.bill.preview')} sub={t('settings.bill.previewSub')} />
          <div className="st-preview-grid">
            <div className="st-money-hero">
              <span className="st-money-label">{t('settings.bill.previewAmount')}</span>
              <span className="money st-money-big" data-qa="preview-money">{fmt(1250)}</span>
            </div>
            <dl className="st-preview-kv">
              <div><dt><FileText />{t('settings.bill.previewNumber')}</dt><dd className="num" data-qa="preview-number">{previewInvoiceNumber(draft.invoicePrefix.trim(), draft.nextInvoiceNumber ?? 1)}</dd></div>
              <div><dt><Hash />{t('settings.bill.previewFile')}</dt><dd className="num">{Math.max(1, Math.floor(draft.nextFileNumber ?? 1))}</dd></div>
            </dl>
            <div className="st-mini-invoice">
              <div className="st-mini-title">{t('settings.bill.previewSample')}</div>
              <div className="st-mini-row"><span>{t('settings.bill.previewItem1')}</span><span className="money">{fmt(SAMPLE_LINES[0])}</span></div>
              <div className="st-mini-row"><span>{t('settings.bill.previewItem2')}</span><span className="money">{fmt(SAMPLE_LINES[1])}</span></div>
              <div className="st-mini-row sub"><span>{t('subtotal')}</span><span className="money">{fmt(totals.subtotal)}</span></div>
              {totals.tax > 0 && <div className="st-mini-row sub"><span>{t('settings.bill.previewTax', { n: draft.taxPercent ?? 0 })}</span><span className="money">{fmt(totals.tax)}</span></div>}
              <div className="st-mini-row total"><span>{t('total')}</span><span className="money">{fmt(totals.total)}</span></div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<Banknote />} title={t('settings.bill.currency')} sub={t('settings.bill.currencySub')} />
          <div className="form-grid">
            <div className="span-2">
              <Select label={t('settings.bill.currencyLabel')} value={draft.currency} onChange={e => update(withCurrency(draft, e.target.value))} options={currencyOptions} disabled={disabled} data-qa="currency" />
            </div>
            {draft.currency === CUSTOM_CURRENCY && (
              <Input label={t('auth.money.customCode')} placeholder={t('auth.money.customCodePh')} dir="ltr" value={draft.customCode} maxLength={4}
                onChange={e => set('customCode', cleanCurrencyCode(e.target.value))} error={errText(errors.customCode)} disabled={disabled} data-qa="currency-code" />
            )}
            <Input label={t('settings.bill.symbol')} hint={errors.symbol ? undefined : t('settings.bill.symbolHint')} value={draft.symbol} maxLength={6}
              onChange={e => set('symbol', e.target.value)} error={errText(errors.symbol)} disabled={disabled} data-qa="currency-symbol" />
            <div className="field">
              <span className="field-label">{t('settings.bill.decimals')}</span>
              <Segmented<'0' | '2'> block value={String(draft.decimals) as '0' | '2'} onChange={v => !disabled && set('decimals', v === '0' ? 0 : 2)}
                options={[{ value: '0', label: t('settings.bill.dec0') }, { value: '2', label: t('settings.bill.dec2') }]} />
            </div>
          </div>
          {currencyChanged && <Alert tone="warning" className="mt-4">{t('settings.bill.changeWarn')}</Alert>}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<Receipt />} title={t('settings.bill.invoices')} sub={t('settings.bill.invoicesSub')} />
          <div className="form-grid">
            <Field label={t('settings.bill.tax')} hint={t('settings.bill.taxHint')} error={errText(errors.taxPercent)}>
              <NumberInput value={draft.taxPercent} onChange={v => set('taxPercent', v)} addon={<Percent size={16} />} invalid={!!errors.taxPercent}
                disabled={disabled} min={0} max={100} aria-label={t('settings.bill.tax')} data-qa="tax" />
            </Field>
            <Input label={t('settings.bill.prefix')} hint={errors.invoicePrefix ? undefined : t('settings.bill.prefixHint')} dir="ltr" value={draft.invoicePrefix} maxLength={10}
              onChange={e => set('invoicePrefix', e.target.value.toUpperCase())} error={errText(errors.invoicePrefix)} disabled={disabled} data-qa="prefix" />
            <NumberInput label={t('settings.bill.nextInvoice')} decimals={0} value={draft.nextInvoiceNumber} onChange={v => set('nextInvoiceNumber', v)}
              hint={errors.nextInvoiceNumber ? undefined : t('settings.bill.nextInvoiceHint')} error={errText(errors.nextInvoiceNumber)} disabled={disabled} min={1} data-qa="next-invoice" />
            <NumberInput label={t('settings.bill.nextFile')} decimals={0} value={draft.nextFileNumber} onChange={v => set('nextFileNumber', v)}
              hint={errors.nextFileNumber ? undefined : t('settings.bill.nextFileHint')} error={errText(errors.nextFileNumber)} disabled={disabled} min={1} data-qa="next-file" />
          </div>
          {lowered && <Alert tone="warning" className="mt-4">{t('settings.bill.decreaseWarn', { n: clinic.nextInvoiceNumber })}</Alert>}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle icon={<FileSignature />} title={t('settings.bill.print')} sub={t('settings.bill.printSub')} />
          <div className="form-grid">
            <Textarea label={t('settings.bill.invoiceFooter')} placeholder={t('settings.bill.invoiceFooterPh')} rows={3} dir="auto" value={draft.invoiceFooter} onChange={e => set('invoiceFooter', e.target.value)} disabled={disabled} />
            <Textarea label={t('settings.bill.rxFooter')} placeholder={t('settings.bill.rxFooterPh')} rows={3} dir="auto" value={draft.prescriptionFooter} onChange={e => set('prescriptionFooter', e.target.value)} disabled={disabled} />
          </div>
        </CardBody>
      </Card>

      <SaveBar dirty={dirty} saving={saving} disabled={disabled} hidden={!access.isAdmin} onDiscard={discard} />
    </form>
  )
}
