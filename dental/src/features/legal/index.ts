// Legal documents of the app: the privacy policy, the terms of use (EULA) and the open-source notices.
//   <LegalLinks />                     links that open the documents (Settings → About, the setup wizard)
//   <LegalDialog open doc onClose />   the dialog itself
//   <AcceptTerms checked onChange />   the setup wizard's acceptance checkbox; then acceptTerms(userId)
export { LegalDialog, type LegalDialogProps } from './LegalDialog'
export { AcceptTerms, LegalLinks } from './LegalLinks'
export { LEGAL_DATE, TERMS_VERSION, acceptTerms, legalText, loadLegalDocs, termsAcceptance, type LegalDoc, type TermsAcceptance } from './lib'
