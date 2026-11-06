// Help on the Dentora website: the user guide (/guide) and the video course (/videos), each in the app's language,
// opened in the system browser from Settings → About and from the account menu. The guide explains how to buy a
// licence (its licence topic shows the price and the WhatsApp request, and every page links the home page, which
// sells), so a copy installed from Google Play shows no link to the website at all: Play's Payments policy forbids
// in-app links to pages that could lead to paying outside Google Play, as it does for the seller box (seller.ts).
import type { Lang } from '@/db/types'
import { openExternal } from '@/platform'
import { ACTIVATION_ORIGIN } from '@/license/online'
import { sellerShown } from './seller'

/** The website's origin (the same server answers the licence-key activation). */
export const SITE_ORIGIN = ACTIVATION_ORIGIN

export type HelpPage = 'guide' | 'videos'

/** https://dentora.raqeem.dev/guide and /videos; with the English UI /en/guide and /en/videos. */
export function helpUrl(page: HelpPage, lang: Lang): string {
  return `${SITE_ORIGIN}/${lang === 'en' ? 'en/' : ''}${page}`
}

/** Whether this copy links to the website's help (not in a copy installed from Google Play: see above). */
export const helpShown = (): boolean => sellerShown()

/** Opens the guide or the video course in the browser (Windows and Android shells open it outside the app). */
export function openHelp(page: HelpPage, lang: Lang): void {
  openExternal(helpUrl(page, lang))
}
