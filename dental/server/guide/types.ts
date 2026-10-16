// The user guide on the website (/guide, /guide/<topic>, /en/guide, /en/guide/<topic>): every topic is data in
// topics/<slug>.ts, written from the app's real screens and texts (src/i18n/modules/*.ts), and illustrated with
// pictures of the real app with the demo clinic, made by store/scripts/guide-shots.mjs.

export interface Bi { ar: string; en: string }
/** Paragraphs or list items in both languages (the same number of items in each). */
export interface BiList { ar: string[]; en: string[] }

/**
 * A picture of the real app. Files: site/img/guide/<lang>/<id>-<width>.webp (widths chosen by the shooter).
 * Text markup in every string of the guide: **label** = a button, tab or field exactly as the app names it
 * (rendered bold), `Ctrl+K` = a key (rendered as <kbd>), [text](slug) or [text](slug#block-id) = a link to another
 * topic of the guide (or a block of it), in the same language. Nothing else is interpreted; the renderer escapes the
 * rest.
 */
export interface GuideShot {
  /** Unique across the whole guide, kebab-case, starts with the topic slug: 'patients-new-form'. */
  id: string
  device: 'desktop' | 'phone'
  /** What the picture shows, for screen readers and when it does not load. */
  alt: Bi
  /** An optional line under the picture. */
  caption?: Bi
  /**
   * How to make it, for the shooter (English): the screen (hash route, e.g. #/patients), the steps to reach the
   * state shown (open a patient, click **New appointment**…), what to crop to (the whole window, the dialog, a card),
   * and the numbered markers to draw on it ("1 on the **Save** button") matching the numbered steps of the block.
   */
  recipe: string
}

export interface GuideBlock {
  /** Anchor inside the topic page, kebab-case, unique in the topic. */
  id: string
  title: Bi
  text?: BiList
  /** Numbered steps. */
  steps?: BiList
  /** "Good to know" notes. */
  tips?: BiList
  /** GuideShot ids shown in this block, in order. */
  shots?: string[]
}

export interface GuideTopic {
  /** URL part: /guide/<slug>. */
  slug: string
  /** Position on the guide's home page and in the side menu. */
  order: number
  /** An icon name the renderer knows (lucide names in camelCase, e.g. 'calendarCheck'). */
  icon: string
  title: Bi
  /** One or two sentences: the card on the guide's home page and the page's meta description. */
  summary: Bi
  blocks: GuideBlock[]
  shots: GuideShot[]
}
