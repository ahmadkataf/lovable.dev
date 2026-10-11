// Clinic country (WhatsApp code, month names), three-decimal currencies, the tax number and the counted settings labels.
import { DEFAULT_CLINIC } from '../src/db'
import type { Clinic } from '../src/db/types'
import {
  COUNTRY_CODES, asDecimals, billingDraftFrom, billingPatch, clinicDraftFrom, clinicPatch, effectiveArabicMonths, effectiveCountry, sampleTotals,
  validateBilling, withCurrency,
} from '../src/features/settings/lib'
import { translate } from '../src/i18n'

const clinic = (p: Partial<Clinic> = {}): Clinic => ({ ...DEFAULT_CLINIC, name: 'عيادة', setupDone: true, ...p })
const used = { lastInvoiceSeq: 0, lastFileNo: 0 }

describe('clinic country', () => {
  it('defaults from the currency, and a picked country wins', () => {
    expect(effectiveCountry({ currency: 'SAR' })).toBe('966')
    expect(effectiveCountry({ currency: 'EGP' })).toBe('20')
    expect(effectiveCountry({ currency: 'USD' })).toBe('963')
    expect(effectiveCountry({ currency: 'USD', countryCode: '962' })).toBe('962')
    expect(effectiveCountry({ currency: 'SAR', countryCode: 'x' })).toBe('966')
  })
  it('month names follow the country unless the clinic picked them', () => {
    expect(effectiveArabicMonths({ currency: 'SYP' })).toBe('levant')
    expect(effectiveArabicMonths({ currency: 'IQD' })).toBe('levant')
    expect(effectiveArabicMonths({ currency: 'SAR' })).toBe('standard')
    expect(effectiveArabicMonths({ currency: 'USD', countryCode: '20' })).toBe('standard')
    expect(effectiveArabicMonths({ currency: 'SAR', arabicMonths: 'levant' })).toBe('levant')
  })
  it('is saved with the clinic form ("" = automatic)', () => {
    const d = clinicDraftFrom(clinic({ countryCode: '971' }))
    expect(d.countryCode).toBe('971')
    expect(clinicPatch({ ...d, countryCode: '' }).countryCode).toBe('')
    expect(clinicPatch({ ...d, countryCode: '966' }).countryCode).toBe('966')
    expect(clinicDraftFrom(clinic()).countryCode).toBe('')
  })
  it('every country has a name in both languages', () => {
    for (const c of COUNTRY_CODES) for (const lang of ['ar', 'en'] as const) expect(translate(lang, `settings.country.${c}`)).not.toBe(`country.${c}`)
  })
})

describe('three-decimal currencies and the tax number', () => {
  it('keeps 3 decimals end to end in the billing form', () => {
    expect(asDecimals(3)).toBe(3); expect(asDecimals(0)).toBe(0); expect(asDecimals(7)).toBe(2)
    const kwd = withCurrency(billingDraftFrom(clinic()), 'KWD')
    expect(kwd.decimals).toBe(3)
    expect(billingPatch(kwd).currencyDecimals).toBe(3)
    expect(billingDraftFrom(clinic({ currency: 'BHD', currencySymbol: 'د.ب', currencyDecimals: 3 })).decimals).toBe(3)
  })
  it('the preview totals round VAT at the currency decimals (5% on 12.250 OMR = 0.613)', () => {
    expect(sampleTotals(5, 3, [12.25])).toEqual({ subtotal: 12.25, tax: 0.613, total: 12.863 })
    expect(sampleTotals(5, 2, [12.25])).toEqual({ subtotal: 12.25, tax: 0.61, total: 12.86 })
    expect(sampleTotals(10, 0, [655])).toEqual({ subtotal: 655, tax: 66, total: 721 })
  })
  it('validates and saves the tax number', () => {
    const d = billingDraftFrom(clinic())
    expect(validateBilling({ ...d, taxNumber: '300123456700003' }, used).taxNumber).toBeUndefined()
    expect(validateBilling({ ...d, taxNumber: '٣٠٠ ١٢٣' }, used).taxNumber).toBeUndefined()
    expect(validateBilling({ ...d, taxNumber: 'رقم؟' }, used).taxNumber?.key).toBe('settings.bill.err.taxNumber')
    expect(billingPatch({ ...d, taxNumber: ' ٣٠٠  123 ' }).taxNumber).toBe('300 123')
    expect(billingPatch({ ...d, taxNumber: '  ' }).taxNumber).toBeUndefined()
    expect(billingDraftFrom(clinic({ taxNumber: '123' })).taxNumber).toBe('123')
  })
})

describe('counted settings labels', () => {
  const ar = (k: string, n: number) => translate('ar', `settings.${k}`, { n })
  it('uses the right Arabic form for each number', () => {
    expect(ar('pref.lockMin', 5)).toBe('بعد 5 دقائق')
    expect(ar('pref.lockMin', 15)).toBe('بعد 15 دقيقة')
    expect(ar('pref.minutesOpt', 20)).toBe('20 دقيقة')
    expect(ar('pref.minutesOpt', 2)).toBe('دقيقتان')
    expect(ar('bk.oldTitle', 8)).toBe('آخر نسخة احتياطية أُخذت قبل 8 أيام')
    expect(ar('bk.oldTitle', 11)).toBe('آخر نسخة احتياطية أُخذت قبل 11 يوماً')
    expect(translate('en', 'settings.bk.oldTitle', { n: 1 })).toBe('Your last backup is 1 day old')
    expect(translate('en', 'settings.pref.lockMin', { n: 5 })).toBe('After 5 minutes')
  })
})
