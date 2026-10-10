// The seller's contact details, shown in Settings → License under "How do I get an activation code?".
// EDIT BEFORE SELLING: put your own name, WhatsApp number (international format, with the country code),
// email and prices. Nothing else in the app needs to change. Codes are made with the private generator:
//   node scripts/code-generator.mjs <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime]
//   or the offline page built by: npx vite build --config vite.tools.config.ts  →  dist-tools/code-generator.html
export const SELLER = {
  name: 'Dentora',
  whatsapp: '+963 944 000 000',
  email: 'sales@dentora.app',
  /** Shown as written; priceTextEn is used when the app is in English. */
  priceText: 'الباقة الأساسية 99$ سنوياً · الباقة الاحترافية 149$ سنوياً · ترخيص دائم 299$',
  priceTextEn: 'Standard $99 / year · Pro $149 / year · Lifetime $299',
}
