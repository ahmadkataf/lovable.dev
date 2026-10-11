// The seller's contact details, shown in Settings → Licence under "How do I get an activation code?" and in the
// privacy policy and terms. Leave a field '' to hide it. Codes are made with the private generator:
//   node scripts/code-generator.mjs <device> <standard|pro> [YYYY-MM-DD | 1y | 2y | lifetime]
//   or the offline page built by: npx vite build --config vite.tools.config.ts  →  dist-tools/code-generator.html
import { installSource } from '@/platform'

export const SELLER = {
  /**
   * When the licence screen shows the seller box (contacts and the "Request on WhatsApp" button):
   * 'outside-play' (default): on Windows, the web build and an APK the seller shares, never in a copy installed from
   *   Google Play: Play does not allow steering users to pay outside its billing. Play's own test devices install
   *   without an installer name and do not see it either.
   * 'always' / 'never'.
   */
  showPurchaseInfo: 'outside-play' as 'outside-play' | 'always' | 'never',
  name: 'Dentora',
  /** International format, with the country code. */
  whatsapp: '+963 996 489 504',
  email: '',
  /** Shown as written; priceTextEn is used when the app is in English. '' = no price shown. */
  priceText: '',
  priceTextEn: '',
}

/** Whether this copy may show the seller box (see showPurchaseInfo). */
export function sellerShown(): boolean {
  if (SELLER.showPurchaseInfo === 'never') return false
  if (SELLER.showPurchaseInfo === 'always') return true
  return installSource() === 'direct'
}
