// The seller's contact details, shown in Settings → Licence under "How do I get an activation code?" and in the
// privacy policy and terms. Leave a field '' to hide it. Codes are made with the private generator:
//   node scripts/code-generator.mjs <device>   (a lifetime code; or <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime])
//   or the offline page built by: npx vite build --config vite.tools.config.ts  →  dist-tools/code-generator.html
import { installSource } from '@/platform'

export const SELLER = {
  /**
   * When the licence screen shows the seller box (contacts and the "Request on WhatsApp" button):
   * 'outside-play' (default): everywhere except a copy installed from Google Play (Play does not allow steering users
   *   to pay outside its billing). An Android install whose installer the phone does not report (many phones, for an
   *   APK opened from a file) shows it: only a positive "installed by Google Play" hides it.
   * 'always' / 'never'.
   */
  showPurchaseInfo: 'outside-play' as 'outside-play' | 'always' | 'never',
  name: 'Dentora',
  /** International format, with the country code. */
  whatsapp: '+963 996 489 504',
  email: '',
  /** Shown as written; priceTextEn is used when the app is in English. '' = no price shown. */
  priceText: 'ترخيص مدى الحياة: \u206659$\u2069 فقط',   // \u2066…\u2069 keeps "59$" in that order inside Arabic text
  priceTextEn: 'Lifetime licence: just $59',
}

/** Whether this copy may show the seller box (see showPurchaseInfo). */
export function sellerShown(): boolean {
  if (SELLER.showPurchaseInfo === 'never') return false
  if (SELLER.showPurchaseInfo === 'always') return true
  return installSource() !== 'play'
}
