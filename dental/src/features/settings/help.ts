// Help on the Dentora website: the user guide (/guide) and the video course (/videos), each in the app's language,
// opened in the system browser from Settings → About and from the account menu. Neither page sells anything, so a copy
// installed from Google Play may link to them too (the site's landing page shows prices; these pages do not).
import type { Lang } from '@/db/types'
import { openExternal } from '@/platform'
import { ACTIVATION_ORIGIN } from '@/license/online'

/** The website's origin (the same server answers the licence-key activation). */
export const SITE_ORIGIN = ACTIVATION_ORIGIN

export type HelpPage = 'guide' | 'videos'

/** https://dentora.raqeem.dev/guide and /videos; with the English UI /en/guide and /en/videos. */
export function helpUrl(page: HelpPage, lang: Lang): string {
  return `${SITE_ORIGIN}/${lang === 'en' ? 'en/' : ''}${page}`
}

/** Opens the guide or the video course in the browser (Windows and Android shells open it outside the app). */
export function openHelp(page: HelpPage, lang: Lang): void {
  openExternal(helpUrl(page, lang))
}
