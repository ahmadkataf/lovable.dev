// /guide and /guide/<slug> (and /en/…): the user guide's home and topic pages, one full HTML document per request.
// The topics are data (topics/<slug>.ts, listed in index.ts; see types.ts), the pictures are WebP files of the real
// app with their sizes in site/img/guide/manifest.json (store/scripts/guide-shots.mjs makes both).
// Built on the legal pages' shell (header, footer, fonts, colours, src/pages/legal.ts) with /css/guide.css and
// /js/guide.js on top. Nothing inline, per the CSP: no <style>, no style="", no event attributes, and the only
// <script> elements are the JSON-LD data block and /js/guide.js. Without the script everything is still there:
// the table of contents is plain links, a picture opens its large file, the search box (useless without it) stays
// hidden.
//
// Text markup in every string of a topic (types.ts): **label** → <strong>, `key` → <kbd>, [text](slug#block) → a
// link to that topic (and block) in the page's language. Everything is escaped first, then only these three are
// turned into markup. A link to a topic that is not published is shown as plain text, and a link to a block the
// topic does not have goes to the top of that topic. A topic that has a chapter in the video course (videos/index.ts)
// links it under its title, and the home has a strip for the course; the course pages link the guide back.
import { escapeHtml } from '../src/http'
import { ICONS as SITE_ICONS, jsonForScript } from '../src/pages/landing'
import { langPath, sellerWa, shell, type PageAssets } from '../src/pages/legal'
import { DEFAULT_SETTINGS, type Lang, type SiteSettings } from '../src/types'
import { CHAPTERS } from '../videos/index'
import type { BiList, GuideBlock, GuideShot, GuideTopic } from './types'

export const GUIDE_PATH = '/guide'
/** Where the pictures are served from (site/img/guide/): /img/guide/<lang>/<id>-<width>.webp */
export const GUIDE_IMG = '/img/guide'

// ---- the pictures' manifest (site/img/guide/manifest.json) -------------------------------------------------------
/** One picture in one language, as store/scripts/guide-shots.mjs records it. */
export interface GuideImage {
  /** The widths of the files written, e.g. [1600, 900] (desktop) or [780, 390] (phone). */
  widths: number[]
  /** Width and height of the largest file, in pixels. */
  width: number
  height: number
  /** The capture's width in the app's CSS pixels: a crop is never shown wider than that. */
  cssWidth?: number
}
/** site/img/guide/manifest.json: "<lang>/<shot id>" → the picture. A shot not made yet is simply absent. */
export type GuideImages = Record<string, GuideImage>

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const posInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 100000

/** The picture of a shot in a language when the manifest has a usable entry for it (else the page shows a placeholder). */
export function imageOf(images: GuideImages | null | undefined, lang: Lang, id: string): GuideImage | undefined {
  if (!ID.test(id)) return undefined
  const img = images?.[`${lang}/${id}`]
  if (!img || typeof img !== 'object' || !posInt(img.width) || !posInt(img.height) || !Array.isArray(img.widths)) return undefined
  const widths = [...new Set(img.widths.filter(posInt))].sort((a, b) => b - a)
  if (!widths.length) return undefined
  return { widths, width: img.width, height: img.height, ...(posInt(img.cssWidth) ? { cssWidth: img.cssWidth } : {}) }
}
export const imageUrl = (lang: Lang, id: string, width: number) => `${GUIDE_IMG}/${lang}/${id}-${width}.webp`

// ---- words -------------------------------------------------------------------------------------------------------
const T = {
  ar: {
    kicker: 'Dentora · دليل الاستخدام', guide: 'دليل الاستخدام', guideLong: 'دليل استخدام Dentora', home: 'الصفحة الرئيسية',
    crumbs: 'مسار الصفحة',
    h1: 'دليل استخدام Dentora',
    lead: 'شرح مكتوب ومصوَّر لكل ما في البرنامج، من التثبيت وأول تشغيل حتى النسخ الاحتياطي. لكل قسم صفحة بخطوات مرقّمة وصور من البرنامج نفسه، فابدأ من الموضوع الذي تحتاجه.',
    metaTitle: 'دليل استخدام Dentora: شرح البرنامج خطوة بخطوة',
    metaDesc: 'دليل استخدام برنامج Dentora لإدارة عيادات الأسنان في {n}: شرح بالصور خطوة بخطوة، من التثبيت إلى المرضى والمواعيد والفواتير والتقارير والنسخ الاحتياطي.',
    topics: 'الموضوعات', allTopics: 'كل الموضوعات', startHere: 'ابدأ من هنا',
    search: 'ابحث في الدليل', searchPh: 'ابحث: فاتورة، موعد، نسخة احتياطية…', clear: 'مسح البحث',
    results: ['موضوع واحد', 'موضوعان', 'موضوعات', 'موضوعاً'], noResults: 'لا يوجد موضوع يطابق بحثك. جرّب كلمة أخرى، أو اسألنا على واتساب.',
    sections: 'أقسام هذا الموضوع', matches: 'أقسام مطابقة',
    inPage: 'في هذه الصفحة', toTop: 'العودة إلى الأعلى', print: 'اطبع هذه الصفحة',
    prev: 'الموضوع السابق', next: 'الموضوع التالي', pager: 'الموضوع السابق والتالي',
    steps: 'الخطوات', tip: 'من المفيد أن تعرف', anchor: 'رابط هذا القسم', copied: 'نُسخ رابط القسم',
    zoom: 'تكبير الصورة', close: 'إغلاق', prevImg: 'الصورة السابقة', nextImg: 'الصورة التالية',
    soon: 'الصورة قيد الإعداد',
    help: 'تحتاج مساعدة؟', helpText: 'إن لم تجد جوابك هنا، راسلنا على واتساب وسنساعدك.', whatsapp: 'واتساب',
    helpHome: 'لم تجد ما تبحث عنه؟', helpHomeText: 'اكتب لنا سؤالك على واتساب، وسنرشدك خطوة بخطوة.',
    watch: 'شاهد هذا الموضوع بالفيديو',
    videosTitle: 'تفضّل المشاهدة؟', videosText: 'الفيديوهات التعليمية تشرح الموضوعات نفسها بتسجيلات من البرنامج، فصلاً فصلاً.', videosBtn: 'الفيديوهات التعليمية',
    wa: 'مرحباً، لدي سؤال عن Dentora بخصوص «{title}» في دليل الاستخدام.', waHome: 'مرحباً، لدي سؤال عن برنامج Dentora.',
    sectionsCount: ['قسم واحد', 'قسمان', 'أقسام', 'قسماً'],
  },
  en: {
    kicker: 'Dentora · User guide', guide: 'User guide', guideLong: 'Dentora user guide', home: 'Home',
    crumbs: 'Breadcrumb',
    h1: 'Dentora user guide',
    lead: 'Everything in the app, explained in words and pictures, from installing it to backing up your data. Each area has its own page with numbered steps and pictures of the app itself, so start with the topic you need.',
    metaTitle: 'Dentora user guide: the app explained step by step',
    metaDesc: 'The user guide of Dentora, the dental clinic software: {n} explained step by step with pictures, from installing to patients, appointments, invoices, reports and backups.',
    topics: 'Topics', allTopics: 'All topics', startHere: 'Start here',
    search: 'Search the guide', searchPh: 'Search: invoice, appointment, backup…', clear: 'Clear the search',
    results: ['1 topic', '', '', '{n} topics'], noResults: 'No topic matches your search. Try another word, or ask us on WhatsApp.',
    sections: 'Sections of this topic', matches: 'Matching sections',
    inPage: 'On this page', toTop: 'Back to top', print: 'Print this page',
    prev: 'Previous topic', next: 'Next topic', pager: 'Previous and next topic',
    steps: 'Steps', tip: 'Good to know', anchor: 'Link to this section', copied: 'Link to the section copied',
    zoom: 'Enlarge the picture', close: 'Close', prevImg: 'Previous picture', nextImg: 'Next picture',
    soon: 'Picture coming soon',
    help: 'Need help?', helpText: 'If you did not find your answer here, message us on WhatsApp and we will help.', whatsapp: 'WhatsApp',
    helpHome: 'Did not find what you need?', helpHomeText: 'Send us your question on WhatsApp and we will guide you step by step.',
    watch: 'Watch this topic on video',
    videosTitle: 'Prefer watching?', videosText: 'The video course covers the same topics with recordings of the app, chapter by chapter.', videosBtn: 'Video course',
    wa: 'Hello, I have a question about Dentora: “{title}” in the user guide.', waHome: 'Hello, I have a question about Dentora.',
    sectionsCount: ['1 section', '', '', '{n} sections'],
  },
} as const

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
/** A counted noun: Arabic has its own forms for 1 and 2, the plural for 3–10 and the singular from 11 on. */
export function countText(n: number, lang: Lang, forms: readonly string[]): string {
  if (lang === 'en') return n === 1 ? forms[0] : fill(forms[3], { n })
  if (n === 1) return forms[0]
  if (n === 2) return forms[1]
  return `${n} ${n >= 3 && n <= 10 ? forms[2] : forms[3]}`
}

// ---- icons: Lucide (ISC), the names the app itself uses, in camelCase (the tooth is the landing page's) ---------
const ICONS: Record<string, string> = {
  rocket: '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/><path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>',
  layoutGrid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  layoutDashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  panelsTopLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  usersRound: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  userRound: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
  userCog: '<path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="m14.305 16.53.923-.382"/><path d="m15.228 13.852-.923-.383"/><path d="m16.852 12.228-.383-.923"/><path d="m16.852 17.772-.383.924"/><path d="m19.148 12.228.383-.923"/><path d="m19.53 18.696-.382-.924"/><path d="m20.772 13.852.924-.383"/><path d="m20.772 16.148.924.383"/><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/>',
  smile: '<path d="M15 10V9"/><path d="M16.472 15a6 6 0 01-8.943 0"/><path d="M9 10V9"/><circle cx="12" cy="12" r="10"/>',
  calendarCheck: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  calendarDays: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>',
  calendar: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  calendarClock: '<path d="M16 14v2.2l1.6 1"/><path d="M16 2v3"/><path d="M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338"/><path d="M3 9h5.859"/><path d="M8 2v3"/><circle cx="16" cy="16" r="6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  clipboardList: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  clipboardCheck: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  stethoscope: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  receipt: '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  receiptText: '<path d="M13 16H8"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 14h2"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  coins: '<path d="M13.744 17.736a6 6 0 1 1-7.48-7.48"/><path d="M15 6h1v4"/><path d="m6.134 14.768.866-.5 2 3.464"/><circle cx="16" cy="8" r="6"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  flaskConical: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  microscope: '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  boxes: '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  fileText: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  files: '<path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z"/><path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1"/>',
  chartColumn: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  barChart3: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  chartBar: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16h8"/><path d="M7 11h12"/><path d="M7 6h3"/>',
  chartLine: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  chartPie: '<path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
  trendingUp: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  settings: '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  settings2: '<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  slidersHorizontal: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  lockKeyhole: '<circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/>',
  keyRound: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  key: '<path d="m2 21 9.6-9.6"/><path d="m7.5 15.5 2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19"/><circle cx="15.5" cy="7.5" r="5.5"/>',
  databaseBackup: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 12a9 3 0 0 0 5 2.69"/><path d="M21 9.3V5"/><path d="M3 5v14a9 3 0 0 0 6.47 2.88"/><path d="M12 12v4h4"/><path d="M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  hardDrive: '<path d="M10 16h.01"/><path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M21.946 12.013H2.054"/><path d="M6 16h.01"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  circleHelp: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  messageCircleQuestion: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  lifeBuoy: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
  playCircle: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  bookOpen: '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  monitorSmartphone: '<path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-3.96 3.15"/><path d="M7 19h5"/><rect width="6" height="10" x="16" y="12" rx="2"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  building2: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
  hospital: '<path d="M12 7v4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M14 9h-4"/><path d="M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/><path d="M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/>',
  heartPulse: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  syringe: '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  notebookPen: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
  fileSpreadsheet: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  messageCircle: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  hash: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  zoomIn: '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
  listOrdered: '<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>',
  list: '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
  circleAlert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  triangleAlert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/>',
  tooth: SITE_ICONS.tooth,
}
/** The icon names the guide knows (a topic's `icon`); any other name gets the open book. */
export const ICON_NAMES: readonly string[] = Object.keys(ICONS)
const iconKey = (name: string) => {
  const camel = String(name || '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  return camel in ICONS ? camel : 'bookOpen'
}

/** Each page carries the icons it uses once, as <symbol>s, and every icon is a <use> of one. */
class IconSet {
  private used = new Set<string>()
  use(name: string, cls = ''): string {
    const key = iconKey(name)
    this.used.add(key)
    return `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#gi-${key}"/></svg>`
  }
  sprite(): string {
    const symbols = [...this.used].map(k => `<symbol id="gi-${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`).join('')
    return `<svg class="gd-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">${symbols}</svg>`
  }
}

// ---- addresses ---------------------------------------------------------------------------------------------------
const cleanOrigin = (origin: string) => String(origin || '').replace(/\/+$/, '')
export const guideHomePath = (lang: Lang) => langPath(GUIDE_PATH, lang)
export const topicPath = (slug: string, lang: Lang) => langPath(`${GUIDE_PATH}/${slug}`, lang)
/** The seller's WhatsApp link with a message, falling back to the default number when the setting is not a number. */
function waLink(s: SiteSettings, text: string): string {
  const digits = String(s?.whatsapp ?? '').replace(/\D/g, '')
  const number = digits.length >= 8 && digits.length <= 15 ? s.whatsapp : DEFAULT_SETTINGS.whatsapp
  return `${sellerWa(number)}?text=${encodeURIComponent(text)}`
}
function waNumber(s: SiteSettings): string {
  const digits = String(s?.whatsapp ?? '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? String(s.whatsapp).trim() : DEFAULT_SETTINGS.whatsapp
}

// ---- text markup -------------------------------------------------------------------------------------------------
/** What a link in a topic's text may point to: the published topics and their block ids. */
export type LinkTargets = ReadonlyMap<string, ReadonlySet<string>>
export function linkTargets(topics: readonly GuideTopic[]): LinkTargets {
  return new Map(topics.map(t => [t.slug, new Set((t.blocks || []).map(b => b.id))]))
}

// `key` | **label** | [text](target). Runs on escaped text: none of * ` [ ] ( ) # is touched by escaping.
const MARKUP = /`([^`\n]+)`|\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]*)\)/g
const LINK_TARGET = /^([a-z0-9]+(?:-[a-z0-9]+)*)?(?:#([a-z0-9]+(?:-[a-z0-9]+)*))?$/

function keys(escapedKey: string): string {
  // "Ctrl+Shift+N" → each key in its own cap; "+" or "-" alone is one key
  const parts = escapedKey.split('+')
  if (parts.length > 1 && parts.every(p => p.trim())) return `<kbd class="gd-keys" dir="ltr">${parts.map(p => `<kbd>${p.trim()}</kbd>`).join('<span>+</span>')}</kbd>`
  return `<kbd dir="ltr">${escapedKey}</kbd>`
}
function markup(escaped: string, lang: Lang, targets: LinkTargets, current: string): string {
  return escaped.replace(MARKUP, (_m, code: string | undefined, bold: string | undefined, text: string | undefined, target: string | undefined) => {
    if (code !== undefined) return keys(code)
    if (bold !== undefined) return `<strong>${markup(bold, lang, targets, current)}</strong>`
    const inner = markup(text as string, lang, targets, current)
    const m = LINK_TARGET.exec(target || '')
    if (!m || (!m[1] && !m[2])) return inner
    const slug = m[1] || current, block = m[2]
    const blocks = targets.get(slug)
    if (!blocks) return `<span class="gd-xref">${inner}</span>`          // a topic not published (yet)
    const hash = block && blocks.has(block) ? `#${block}` : ''
    if (slug === current) return `<a href="${hash || '#main'}">${inner}</a>`
    return `<a href="${escapeHtml(topicPath(slug, lang))}${hash}">${inner}</a>`
  })
}
/**
 * A string of a topic as HTML: escaped, then **label** → <strong>, `key` → <kbd>, [text](slug#block) → a link in
 * `lang` (only to a topic in `targets`; `current` is the page's own topic, linked by its anchor alone).
 */
export function inlineMarkup(src: string, lang: Lang, targets: LinkTargets = new Map(), current = ''): string {
  return markup(escapeHtml(src), lang, targets, current)
}
/** The same string as plain text (titles in <title>, structured data, the search index): markup characters removed. */
export function plainText(src: string): string {
  return String(src ?? '').replace(MARKUP, (_m, code?: string, bold?: string, text?: string) => code ?? (bold !== undefined ? plainText(bold) : plainText(text ?? '')))
}

// ---- the page's head extras (the shell has no slot for Open Graph and structured data) ----------------------------
function withHead(page: string, extra: string): string {
  const at = page.indexOf('</head>')
  if (at < 0) throw new Error('shell(): no </head>')
  return `${page.slice(0, at)}${extra}\n${page.slice(at)}`
}
interface HeadExtra { lang: Lang; origin: string; url: string; title: string; description: string; type: 'website' | 'article'; ld: unknown }
function headExtra(h: HeadExtra): string {
  // the site's own sharing picture (JPEG, 1200×630: what WhatsApp and the others show for a link)
  const image = `${h.origin}/img/og-${h.lang}.jpg`
  return [
    '<link rel="stylesheet" href="/css/guide.css">',
    `<meta property="og:type" content="${h.type}">`,
    '<meta property="og:site_name" content="Dentora">',
    `<meta property="og:title" content="${escapeHtml(h.title)}">`,
    `<meta property="og:description" content="${escapeHtml(h.description)}">`,
    `<meta property="og:url" content="${escapeHtml(h.url)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:locale" content="${h.lang === 'ar' ? 'ar_SY' : 'en_US'}">`,
    `<meta property="og:locale:alternate" content="${h.lang === 'ar' ? 'en_US' : 'ar_SY'}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(h.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(h.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<script type="application/ld+json">${jsonForScript(h.ld)}</script>`,
    '<script src="/js/guide.js" defer></script>',
  ].join('\n')
}
function breadcrumbs(origin: string, lang: Lang, items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${origin}${langPath(it.path, lang)}` })),
  }
}
const publisher = (origin: string) => ({ '@type': 'Organization', name: 'Dentora', url: `${origin}/`, logo: { '@type': 'ImageObject', url: `${origin}/icon-512.png` } })

const byOrder = (topics: readonly GuideTopic[]) => [...topics].filter(t => t && typeof t.slug === 'string' && ID.test(t.slug)).sort((a, b) => a.order - b.order)
/** The chapter of the video course that covers a topic, if the course has one (videos/index.ts). */
const chapterOf = (slug: string) => CHAPTERS.find(c => c.guide === slug)
const list = (l: BiList | undefined, lang: Lang): string[] => (Array.isArray(l?.[lang]) ? l[lang].filter(x => typeof x === 'string' && x.trim()) : [])

// ---- the guide's home ----------------------------------------------------------------------------------------------
export function renderGuideHome(lang: Lang, s: SiteSettings, origin: string, assets: PageAssets, topics: readonly GuideTopic[]): string {
  const t = T[lang]
  origin = cleanOrigin(origin)
  const icons = new IconSet()
  const all = byOrder(topics)
  const url = `${origin}${guideHomePath(lang)}`
  const description = fill(t.metaDesc, { n: countText(all.length, lang, t.results) })

  const cards = all.map((topic, i) => {
    const href = topicPath(topic.slug, lang)
    const blocks = (topic.blocks || []).filter(b => b && ID.test(b.id))
    const secs = blocks.map(b => `<li><a href="${escapeHtml(href)}#${b.id}">${escapeHtml(plainText(b.title?.[lang] ?? ''))}</a></li>`).join('')
    return `<li class="gd-card" data-slug="${escapeHtml(topic.slug)}">
<span class="gd-card-icon">${icons.use(topic.icon)}</span>
<div class="gd-card-body">
<h3 class="gd-card-title"><a href="${escapeHtml(href)}">${escapeHtml(plainText(topic.title[lang]))}</a></h3>
<p class="gd-card-sum">${escapeHtml(plainText(topic.summary[lang]))}</p>
<p class="gd-card-meta">${i === 0 ? `<span class="gd-badge">${t.startHere}</span>` : ''}<span>${escapeHtml(countText(blocks.length, lang, t.sectionsCount))}</span></p>
${secs ? `<div class="gd-card-secs" hidden><p class="gd-card-secs-k">${t.matches}</p><ul aria-label="${escapeHtml(t.sections)}">${secs}</ul></div>` : ''}
</div>
<span class="gd-card-go">${icons.use(lang === 'ar' ? 'arrowLeft' : 'arrowRight')}</span>
</li>`
  }).join('\n')

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', name: t.guideLong, description, url, inLanguage: lang, publisher: publisher(origin),
        about: { '@type': 'SoftwareApplication', name: 'Dentora', applicationCategory: 'BusinessApplication', operatingSystem: 'Windows, Android' },
        mainEntity: {
          '@type': 'ItemList', numberOfItems: all.length,
          itemListElement: all.map((topic, i) => ({ '@type': 'ListItem', position: i + 1, name: plainText(topic.title[lang]), url: `${origin}${topicPath(topic.slug, lang)}` })),
        },
      },
      breadcrumbs(origin, lang, [{ name: t.home, path: '/' }, { name: t.guide, path: GUIDE_PATH }]),
    ],
  }
  const resultForms = t.results.join('|')
  const body = `<main id="main" class="legal-main gd gd-home">
<div class="legal-hero gd-hero"><div class="container legal-wrap gd-hero-in">
<nav class="gd-crumbs" aria-label="${escapeHtml(t.crumbs)}"><ol><li><a href="${escapeHtml(langPath('/', lang))}">${t.home}</a></li><li aria-current="page">${t.guide}</li></ol></nav>
<h1>${t.h1}</h1>
<p class="gd-lead">${t.lead}</p>
<form class="gd-search" role="search" action="${escapeHtml(guideHomePath(lang))}" hidden data-js>
<label class="sr-only" for="gd-q">${t.search}</label>
<span class="gd-search-icon">${icons.use('search')}</span>
<input id="gd-q" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="${escapeHtml(t.searchPh)}" aria-describedby="gd-status" aria-controls="gd-cards">
<button class="gd-search-clear" type="button" hidden aria-label="${escapeHtml(t.clear)}">${icons.use('x')}</button>
<kbd class="gd-search-key" aria-hidden="true">/</kbd>
</form>
</div></div>
<div class="container legal-wrap gd-home-body">
<div class="gd-home-head"><h2 class="gd-h2" id="gd-topics-title">${t.topics}</h2><p class="gd-status" id="gd-status" role="status" aria-live="polite" data-forms="${escapeHtml(resultForms)}"></p></div>
<ol class="gd-cards" id="gd-cards" aria-labelledby="gd-topics-title">
${cards}
</ol>
<p class="gd-empty" hidden>${icons.use('circleHelp')}<span>${t.noResults}</span></p>
<aside class="gd-videos" aria-labelledby="gd-videos-title">
<span class="gd-videos-icon">${icons.use('playCircle')}</span>
<div class="gd-videos-body"><h2 id="gd-videos-title">${t.videosTitle}</h2><p>${t.videosText}</p></div>
<a class="btn btn-outline legal-btn legal-btn-ghost gd-videos-btn" href="${escapeHtml(langPath('/videos', lang))}">${icons.use('playCircle')}<span>${t.videosBtn}</span></a>
</aside>
${helpBox(lang, s, t.helpHome, t.helpHomeText, t.waHome, icons)}
</div>
</main>`
  const page = shell({ lang, title: `${t.metaTitle} — Dentora`, description, origin, assets, path: GUIDE_PATH, body: `${icons.sprite()}\n${body}` })
  return withHead(page, headExtra({ lang, origin, url, title: t.metaTitle, description, type: 'website', ld }))
}

function helpBox(lang: Lang, s: SiteSettings, title: string, text: string, message: string, icons: IconSet): string {
  const t = T[lang]
  return `<aside class="gd-help" aria-labelledby="gd-help-title">
<span class="gd-help-icon">${icons.use('lifeBuoy')}</span>
<div class="gd-help-body"><h2 id="gd-help-title">${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div>
<a class="btn btn-wa legal-btn gd-help-btn" href="${escapeHtml(waLink(s, message))}" rel="noopener" target="_blank">${icons.use('messageCircle')}<span>${t.whatsapp}</span><bdi dir="ltr" class="gd-help-num">${escapeHtml(waNumber(s))}</bdi></a>
</aside>`
}

// ---- a topic -----------------------------------------------------------------------------------------------------
interface Ctx { lang: Lang; t: typeof T[Lang]; icons: IconSet; targets: LinkTargets; slug: string; images: GuideImages | null | undefined; shots: Map<string, GuideShot>; first: { done: boolean } }

/** The `sizes` of a picture `w` CSS px wide at most, for the article column of guide.css at each width. */
function sizesFor(device: GuideShot['device'], w: number): string {
  if (device === 'phone') return '(max-width: 359px) calc(100vw - 72px), 280px'
  // the article column: 872 px from 1440 px on, the window less the two side columns from 1280, less the table of
  // contents from 1024, less the gutters below
  const cols: [number, string, number][] = [[1440, '872px', 872], [1280, 'calc(100vw - 568px)', 712], [1024, 'calc(100vw - 340px)', 684]]
  const out: string[] = []
  for (const [min, col, colAtMin] of cols) {
    if (w <= colAtMin) { out.push(`(min-width: ${min}px) ${w}px`); return [...out, `(min-width: ${w + 40}px) ${w}px`, 'calc(100vw - 40px)'].join(', ') }
    out.push(`(min-width: ${min}px) ${col}`)
  }
  return [...out, `(min-width: ${w + 40}px) ${w}px`, 'calc(100vw - 40px)'].join(', ')
}

function figure(shot: GuideShot, ctx: Ctx): string {
  const { lang, t } = ctx
  const alt = plainText(shot.alt?.[lang] ?? '')
  const caption = shot.caption?.[lang] ? `<figcaption>${inlineMarkup(shot.caption[lang], lang, ctx.targets, ctx.slug)}</figcaption>` : ''
  const device = shot.device === 'phone' ? 'phone' : 'desktop'
  const img = imageOf(ctx.images, lang, shot.id)
  if (!img) {
    return `<figure class="gd-fig gd-fig-${device} gd-fig-missing" id="shot-${escapeHtml(shot.id)}">
<div class="gd-ph gd-ph-${device}" role="img" aria-label="${escapeHtml(alt)}">${ctx.icons.use('image')}<span class="gd-ph-alt">${escapeHtml(alt)}</span><span class="gd-ph-note">${t.soon}</span></div>
${caption}
</figure>`
  }
  // shown at the capture's CSS width at most (a crop is not blown up), in the page's column otherwise
  const scale = img.cssWidth ? Math.min(1, img.cssWidth / img.width) : device === 'phone' ? 1 / 3 : img.width >= 1600 ? 1 : 1 / 2
  const w = device === 'phone' ? img.width : Math.max(1, Math.round(img.width * scale))
  const h = device === 'phone' ? img.height : Math.max(1, Math.round(img.height * scale))
  const srcset = img.widths.map(x => `${imageUrl(lang, shot.id, x)} ${x}w`).join(', ')
  const large = imageUrl(lang, shot.id, img.widths[0])
  const small = imageUrl(lang, shot.id, img.widths[img.widths.length - 1])
  const lazy = ctx.first.done ? ' loading="lazy"' : ''
  ctx.first.done = true
  const ratio = img.height / img.width
  const shape = device === 'phone' ? (ratio >= 1.75 ? ' gd-fig-screen' : ' gd-fig-crop') : ''
  return `<figure class="gd-fig gd-fig-${device}${shape}" id="shot-${escapeHtml(shot.id)}">
<a class="gd-zoom" href="${escapeHtml(large)}" data-w="${img.width}" data-h="${img.height}"><span class="gd-frame"><picture><img src="${escapeHtml(device === 'phone' ? large : small)}" srcset="${escapeHtml(srcset)}" sizes="${sizesFor(device, w)}" width="${w}" height="${h}" alt="${escapeHtml(alt)}"${lazy} decoding="async"></picture></span><span class="gd-zoom-hint">${ctx.icons.use('zoomIn')}<span class="sr-only">${t.zoom}</span></span></a>
${caption}
</figure>`
}

function paragraphs(items: string[], ctx: Ctx): string {
  // a run of two or more "**Label**: what it is" paragraphs reads better as a list
  const DEF = /^\*\*[^*\n]+\*\*\s?[:：]/
  const out: string[] = []
  for (let i = 0; i < items.length;) {
    if (DEF.test(items[i]) && i + 1 < items.length && DEF.test(items[i + 1])) {
      const run: string[] = []
      while (i < items.length && DEF.test(items[i])) run.push(items[i++])
      out.push(`<ul class="gd-defs">${run.map(x => `<li>${inlineMarkup(x, ctx.lang, ctx.targets, ctx.slug)}</li>`).join('')}</ul>`)
    } else out.push(`<p>${inlineMarkup(items[i++], ctx.lang, ctx.targets, ctx.slug)}</p>`)
  }
  return out.join('\n')
}

function block(b: GuideBlock, ctx: Ctx): string {
  const { lang, t } = ctx
  const title = inlineMarkup(b.title?.[lang] ?? '', lang, ctx.targets, ctx.slug)
  const text = list(b.text, lang), steps = list(b.steps, lang), tips = list(b.tips, lang)
  const shots = (b.shots || []).map(id => ctx.shots.get(id)).filter((x): x is GuideShot => !!x)
  // pictures: phone shots next to each other in a row, desktop shots one under the other
  const figs: string[] = []
  for (let i = 0; i < shots.length;) {
    if (shots[i].device === 'phone' && shots[i + 1]?.device === 'phone') {
      const row: string[] = []
      while (i < shots.length && shots[i].device === 'phone') row.push(figure(shots[i++], ctx))
      figs.push(`<div class="gd-figrow">${row.join('\n')}</div>`)
    } else figs.push(figure(shots[i++], ctx))
  }
  return `<section class="gd-block" id="${b.id}" aria-labelledby="${b.id}-h">
<h2 id="${b.id}-h"><span>${title}</span><a class="gd-anchor" href="#${b.id}" aria-label="${escapeHtml(`${t.anchor}: ${plainText(b.title?.[lang] ?? '')}`)}">${ctx.icons.use('link')}</a></h2>
${text.length ? paragraphs(text, ctx) : ''}
${steps.length ? `<ol class="gd-steps" aria-label="${escapeHtml(t.steps)}">${steps.map(x => `<li>${inlineMarkup(x, lang, ctx.targets, ctx.slug)}</li>`).join('')}</ol>` : ''}
${figs.join('\n')}
${tips.length ? `<aside class="gd-tip" aria-label="${escapeHtml(t.tip)}"><p class="gd-tip-title">${ctx.icons.use('lightbulb')}<span>${t.tip}</span></p>${tips.length === 1 ? `<p>${inlineMarkup(tips[0], lang, ctx.targets, ctx.slug)}</p>` : `<ul>${tips.map(x => `<li>${inlineMarkup(x, lang, ctx.targets, ctx.slug)}</li>`).join('')}</ul>`}</aside>` : ''}
</section>`.replace(/\n{2,}/g, '\n')
}

export function renderGuideTopic(
  lang: Lang, s: SiteSettings, origin: string, assets: PageAssets, topic: GuideTopic, topics: readonly GuideTopic[],
  images?: GuideImages | null,
): string {
  if (!ID.test(String(topic?.slug))) throw new Error(`renderGuideTopic: bad topic slug ${JSON.stringify(topic?.slug)}`)
  const t = T[lang]
  origin = cleanOrigin(origin)
  const icons = new IconSet()
  const all = byOrder(topics.some(x => x.slug === topic.slug) ? topics : [...topics, topic])
  const at = all.findIndex(x => x.slug === topic.slug)
  const prev = at > 0 ? all[at - 1] : null, next = at >= 0 && at < all.length - 1 ? all[at + 1] : null
  const blocks = (topic.blocks || []).filter(b => b && ID.test(b.id))
  const ctx: Ctx = {
    lang, t, icons, targets: linkTargets(all), slug: topic.slug, images,
    shots: new Map((topic.shots || []).filter(x => x && typeof x.id === 'string').map(x => [x.id, x])), first: { done: false },
  }
  const path = `${GUIDE_PATH}/${topic.slug}`
  const url = `${origin}${langPath(path, lang)}`
  const title = plainText(topic.title[lang]), summary = plainText(topic.summary[lang])
  const chapter = chapterOf(topic.slug)

  const tocItems = blocks.map(b => `<li><a href="#${b.id}">${escapeHtml(plainText(b.title?.[lang] ?? ''))}</a></li>`).join('')
  const toc = `<ol class="gd-toc-list">${tocItems}</ol>`
  const topicsNav = all.map(x => {
    const current = x.slug === topic.slug
    return `<li${current ? ' class="is-current"' : ''}><a href="${escapeHtml(topicPath(x.slug, lang))}"${current ? ' aria-current="page"' : ''}>${icons.use(x.icon)}<span>${escapeHtml(plainText(x.title[lang]))}</span></a></li>`
  }).join('')
  const arrowBack = icons.use(lang === 'ar' ? 'arrowRight' : 'arrowLeft'), arrowOn = icons.use(lang === 'ar' ? 'arrowLeft' : 'arrowRight')
  const pagerLink = (x: GuideTopic | null, kind: 'prev' | 'next') => x
    ? `<a class="gd-pager-${kind}" href="${escapeHtml(topicPath(x.slug, lang))}" rel="${kind}">${kind === 'prev' ? arrowBack : ''}<span class="gd-pager-body"><span class="gd-pager-k">${t[kind]}</span><span class="gd-pager-t">${escapeHtml(plainText(x.title[lang]))}</span></span>${kind === 'next' ? arrowOn : ''}</a>`
    : '<span class="gd-pager-none" aria-hidden="true"></span>'

  const html = blocks.map(b => block(b, ctx)).join('\n')
  const firstImage = (topic.shots || []).map(x => imageOf(images, lang, x.id) && x).find(Boolean)
  const firstImg = firstImage ? imageOf(images, lang, firstImage.id) : undefined
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle', headline: title, name: title, description: summary, url, mainEntityOfPage: url, inLanguage: lang,
        ...(firstImage && firstImg ? { image: `${origin}${imageUrl(lang, firstImage.id, firstImg.widths[0])}` } : {}),
        proficiencyLevel: 'Beginner',
        articleSection: blocks.map(b => plainText(b.title?.[lang] ?? '')),
        about: { '@type': 'SoftwareApplication', name: 'Dentora', applicationCategory: 'BusinessApplication', operatingSystem: 'Windows, Android' },
        isPartOf: { '@type': 'CollectionPage', name: t.guideLong, url: `${origin}${guideHomePath(lang)}` },
        author: publisher(origin), publisher: publisher(origin),
      },
      breadcrumbs(origin, lang, [{ name: t.home, path: '/' }, { name: t.guide, path: GUIDE_PATH }, { name: title, path }]),
    ],
  }

  const body = `<main id="main" class="legal-main gd gd-topic">
<div class="container legal-wrap gd-layout">
<nav class="gd-crumbs" aria-label="${escapeHtml(t.crumbs)}"><ol><li><a href="${escapeHtml(langPath('/', lang))}">${t.home}</a></li><li><a href="${escapeHtml(guideHomePath(lang))}">${t.guide}</a></li><li aria-current="page">${escapeHtml(title)}</li></ol></nav>
<article class="gd-article" data-copied="${escapeHtml(t.copied)}">
<header class="gd-head">
<span class="gd-head-icon">${icons.use(topic.icon)}</span>
<h1>${escapeHtml(title)}</h1>
<p class="gd-lead">${inlineMarkup(topic.summary[lang], lang, ctx.targets, ctx.slug)}</p>
${chapter ? `<a class="gd-watch" href="${escapeHtml(langPath(`/videos/${chapter.slug}`, lang))}">${icons.use('playCircle')}<span>${t.watch}</span></a>` : ''}
</header>
${blocks.length ? `<details class="gd-toc-m"><summary>${icons.use('list')}<span>${t.inPage}</span>${icons.use('chevronDown', 'gd-chev')}</summary><nav aria-label="${escapeHtml(t.inPage)}">${toc}</nav></details>` : ''}
${html}
<nav class="gd-pager" aria-label="${escapeHtml(t.pager)}">${pagerLink(prev, 'prev')}${pagerLink(next, 'next')}</nav>
${helpBox(lang, s, t.help, t.helpText, fill(t.wa, { title }), icons)}
</article>
${blocks.length ? `<aside class="gd-toc-side"><nav class="gd-toc" aria-label="${escapeHtml(t.inPage)}"><p class="gd-side-title">${t.inPage}</p>${toc}</nav><p class="gd-side-actions"><a class="gd-totop" href="#main">${icons.use('arrowUp')}<span>${t.toTop}</span></a><button class="gd-print" type="button" hidden data-js>${icons.use('printer')}<span>${t.print}</span></button></p></aside>` : ''}
<aside class="gd-side"><nav class="gd-topics" aria-labelledby="gd-topics-title"><p class="gd-side-title" id="gd-topics-title"><a href="${escapeHtml(guideHomePath(lang))}">${t.allTopics}</a></p><ol>${topicsNav}</ol></nav></aside>
</div>
<div class="gd-lb-strings" hidden data-close="${escapeHtml(t.close)}" data-prev="${escapeHtml(t.prevImg)}" data-next="${escapeHtml(t.nextImg)}" data-zoom="${escapeHtml(t.zoom)}"></div>
</main>`
  const page = shell({ lang, title: `${title} — ${t.guideLong}`, description: summary, origin, assets, path, body: `${icons.sprite()}\n${body}` })
  return withHead(page, headExtra({ lang, origin, url, title: `${title} — ${t.guideLong}`, description: summary, type: 'article', ld }))
}

// ---- the sitemap -------------------------------------------------------------------------------------------------
export interface GuideSitemapEntry { loc: string; lang: Lang; alternates: Record<Lang, string>; changefreq: 'weekly' | 'monthly'; priority: string }
/** The guide's home and every topic page, in both languages, for the router's sitemap. */
export function guideSitemapEntries(origin: string, topics: readonly GuideTopic[]): GuideSitemapEntry[] {
  origin = cleanOrigin(origin)
  const paths: [string, GuideSitemapEntry['changefreq'], string][] = [[GUIDE_PATH, 'weekly', '0.8'], ...byOrder(topics).map(x => [`${GUIDE_PATH}/${x.slug}`, 'monthly', '0.6'] as [string, GuideSitemapEntry['changefreq'], string])]
  return paths.flatMap(([path, changefreq, priority]) => (['ar', 'en'] as Lang[]).map(lang => ({
    loc: `${origin}${langPath(path, lang)}`, lang,
    alternates: { ar: `${origin}${langPath(path, 'ar')}`, en: `${origin}${langPath(path, 'en')}` },
    changefreq, priority,
  })))
}
/** The same as <url> elements in the sitemap's format (xhtml:link alternates, x-default = Arabic), one per line. */
export function guideSitemapXml(origin: string, topics: readonly GuideTopic[]): string {
  return guideSitemapEntries(origin, topics).map(e => {
    const alt = (['ar', 'en'] as Lang[]).map(l => `<xhtml:link rel="alternate" hreflang="${l}" href="${e.alternates[l]}"/>`).join('')
    return `<url><loc>${e.loc}</loc>${alt}<xhtml:link rel="alternate" hreflang="x-default" href="${e.alternates.ar}"/><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
  }).join('\n')
}

// ---- checks of the topics (the preview and the test print them; nothing here stops a page from rendering) ---------
/** Topics that may be linked before they exist (written later); none today: every planned topic is written. */
export const PLANNED_TOPICS: readonly string[] = []
/** Ids the page itself uses: a block must not take one of them. */
const RESERVED = new Set(['main', 'gd-q', 'gd-status', 'gd-cards', 'gd-topics-title', 'gd-help-title', 'gd-videos-title'])

/** Problems in the topics' data: duplicate or bad ids, missing shots, links to nothing, ar/en lists of unequal length. */
export function guideProblems(topics: readonly GuideTopic[], images?: GuideImages | null): string[] {
  const out: string[] = []
  const slugs = new Set<string>(), orders = new Map<number, string>(), shotIds = new Map<string, string>()
  const targets = linkTargets(topics)
  for (const topic of topics) {
    const where = `topic ${topic.slug}`
    if (!ID.test(topic.slug)) out.push(`${where}: the slug is not kebab-case`)
    if (slugs.has(topic.slug)) out.push(`${where}: duplicate slug`)
    slugs.add(topic.slug)
    if (orders.has(topic.order)) out.push(`${where}: order ${topic.order} is also ${orders.get(topic.order)}'s`)
    orders.set(topic.order, topic.slug)
    if (iconKey(topic.icon) !== String(topic.icon).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())) out.push(`${where}: unknown icon '${topic.icon}' (shown as bookOpen; known: render.ts ICONS)`)
    for (const lang of ['ar', 'en'] as Lang[]) {
      if (!topic.title?.[lang]?.trim()) out.push(`${where}: no ${lang} title`)
      if (!topic.summary?.[lang]?.trim()) out.push(`${where}: no ${lang} summary`)
    }
    const blockIds = new Set<string>(), used = new Set<string>()
    const ownShots = new Map((topic.shots || []).map(x => [x.id, x]))
    for (const b of topic.blocks || []) {
      const w = `${where} block ${b.id}`
      if (!ID.test(b.id)) out.push(`${w}: the id is not kebab-case`)
      if (RESERVED.has(b.id) || /^shot-/.test(b.id)) out.push(`${w}: the id is one the page uses itself`)
      if (blockIds.has(b.id)) out.push(`${w}: duplicate block id`)
      blockIds.add(b.id)
      for (const key of ['text', 'steps', 'tips'] as const) {
        const l = b[key]
        if (l && (l.ar?.length ?? 0) !== (l.en?.length ?? 0)) out.push(`${w}: ${key} has ${l.ar?.length ?? 0} Arabic and ${l.en?.length ?? 0} English items`)
      }
      for (const id of b.shots || []) {
        if (!ownShots.has(id)) out.push(`${w}: shot ${id} is not in the topic's shots`)
        if (used.has(id)) out.push(`${w}: shot ${id} is shown twice`)
        used.add(id)
      }
    }
    for (const shot of topic.shots || []) {
      const w = `${where} shot ${shot.id}`
      if (!ID.test(shot.id)) out.push(`${w}: the id is not kebab-case`)
      if (!shot.id.startsWith(`${topic.slug}-`)) out.push(`${w}: the id does not start with '${topic.slug}-'`)
      if (shotIds.has(shot.id)) out.push(`${w}: id also used in topic ${shotIds.get(shot.id)}`)
      shotIds.set(shot.id, topic.slug)
      if (!used.has(shot.id)) out.push(`${w}: not shown in any block`)
      if (shot.device !== 'desktop' && shot.device !== 'phone') out.push(`${w}: device must be desktop or phone`)
      for (const lang of ['ar', 'en'] as Lang[]) {
        if (!shot.alt?.[lang]?.trim()) out.push(`${w}: no ${lang} alt text`)
        if (images && !imageOf(images, lang, shot.id)) out.push(`${w}: no ${lang} picture in the manifest`)
      }
    }
    // every string of the topic: links to topics and blocks that exist
    const strings: string[] = []
    const add = (v: unknown) => { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(add); else if (v && typeof v === 'object') Object.values(v).forEach(add) }
    add(topic.title); add(topic.summary)
    for (const b of topic.blocks || []) { add(b.title); add(b.text); add(b.steps); add(b.tips) }
    for (const shot of topic.shots || []) { add(shot.alt); add(shot.caption) }
    for (const str of strings) {
      for (const m of str.matchAll(/\[([^\]\n]+)\]\(([^)\s]*)\)/g)) {
        const lt = LINK_TARGET.exec(m[2])
        if (!lt || (!lt[1] && !lt[2])) { out.push(`${where}: link "${m[0]}" has a bad target (slug or slug#block)`); continue }
        const slug = lt[1] || topic.slug
        const blocks = targets.get(slug)
        if (!blocks) { if (!PLANNED_TOPICS.includes(slug)) out.push(`${where}: link "${m[0]}" goes to a topic that does not exist`); continue }
        if (lt[2] && !blocks.has(lt[2])) out.push(`${where}: link "${m[0]}" goes to a block that ${slug} does not have`)
      }
      const stars = (str.replace(MARKUP, '').match(/\*\*/g) || []).length
      if (stars) out.push(`${where}: unmatched ** in "${str.slice(0, 60)}…"`)
      if ((str.replace(MARKUP, '').match(/`/g) || []).length) out.push(`${where}: unmatched \` in "${str.slice(0, 60)}…"`)
    }
  }
  return out
}
