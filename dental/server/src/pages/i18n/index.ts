// The marketing pages' words in the languages after Arabic and English (one file per language, translated from the
// English in content.ts and compare-content.ts and checked by test/i18n.test.ts). A language is published only when
// it is also in SITE_LANGS (src/site-lang.ts).
import type { SiteLang } from '../../site-lang'
import type { CompareCopy } from '../compare-content'
import type { Copy } from '../content'
import * as es from './es'
import * as fr from './fr'
import * as id from './id'
import * as pt from './pt'
import * as tr from './tr'
import * as ur from './ur'

export const TRANSLATIONS: Partial<Record<SiteLang, { copy: Copy; compare: CompareCopy }>> = { fr, es, pt, tr, id, ur }
