// The legal documents' date and version, and the record of the clinic accepting the terms (a settings row, so it
// travels with backups and is cleared with "Delete all data").
import { getSetting, setSetting } from '@/db'
import { hasKey, registerStrings, translate } from '@/i18n'
import type { Lang } from '@/db/types'
import { SELLER } from '@/features/settings/seller'

/** Date of the current privacy policy and terms (shown as "Last updated"). Change it with the text. */
export const LEGAL_DATE = '2026-10-15'
/** Version of the terms the clinic accepts; raise it when the terms change in substance. */
export const TERMS_VERSION = 1
export const TERMS_KEY = 'termsAccepted'

export type LegalDoc = 'privacy' | 'terms' | 'notices'
export const LEGAL_DOCS: LegalDoc[] = ['privacy', 'terms', 'notices']

export interface TermsAcceptance { version: number; at: string; by?: string }
/** Records that the clinic accepted the current terms (the setup wizard calls it when the box is ticked). */
export async function acceptTerms(by?: string): Promise<TermsAcceptance> {
  const row: TermsAcceptance = { version: TERMS_VERSION, at: new Date().toISOString(), ...(by ? { by } : {}) }
  await setSetting(TERMS_KEY, row)
  return row
}
/** The recorded acceptance, or null (never accepted, or an older version of the terms). */
export async function termsAcceptance(): Promise<TermsAcceptance | null> {
  const v = await getSetting<TermsAcceptance | null>(TERMS_KEY, null)
  return v && typeof v === 'object' && typeof v.at === 'string' && Number(v.version) >= TERMS_VERSION ? v : null
}

let docsLoading: Promise<void> | null = null
/** Loads the documents' text (features/legal/docs.ts) into the "legal" strings, once. */
export function loadLegalDocs(): Promise<void> {
  if (hasKey('legal.privacy.body')) return Promise.resolve()
  docsLoading ??= import('./docs').then(m => registerStrings('legal', m.default))
  return docsLoading
}
/** The seller's contact line: the name and whichever contacts are set (an empty one is left out). */
export function sellerContact(lang: Lang): string {
  const ar = lang === 'ar'
  return [
    SELLER.name,
    SELLER.email && `${ar ? 'البريد الإلكتروني' : 'email'}: \u2066${SELLER.email}\u2069`,
    SELLER.whatsapp && `${ar ? 'واتساب' : 'WhatsApp'}: \u2066${SELLER.whatsapp}\u2069`,
  ].filter(Boolean).join(' — ')
}
/** A legal document's text in a language, with the seller's contact details filled in (after loadLegalDocs). */
export function legalText(doc: 'privacy' | 'terms', lang: Lang): string {
  return translate(lang, `legal.${doc}.body`, { seller: SELLER.name, contact: sellerContact(lang) })
}
