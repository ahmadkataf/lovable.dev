// /videos and /videos/<slug> (and /en/…): the video course's home and chapter pages (docs/VIDEOS.md → Course pages).
// Built on the legal pages' shell (header, footer, fonts, colours) with /css/videos.css and /js/videos.js on top;
// the chapters come from index.ts, the recorded files from site/videos/manifest.json (a chapter missing there is
// "coming", with its transcript when the manifest has scenes). Nothing inline, per the CSP: the script reads what it
// needs from data- attributes. Without the script the pages still work: native controls, plain links, and a time
// link reloads the page at ?t=, which the router may pass on as the video's start.
import { escapeHtml } from '../src/http'
import { OG_LOCALE } from '../src/site-lang'
import type { IconName } from '../src/pages/content'
import { APP_ID, ICONS, jsonForScript, organization } from '../src/pages/landing'
import { langPath, sellerWa, shell, type PageAssets } from '../src/pages/legal'
import { DEFAULT_SETTINGS, type Lang, type SiteSettings } from '../src/types'
import { videoKey, type VideoChapter, type VideoManifest, type VideoRecord } from './types'

export const VIDEOS_PATH = '/videos'
/** Where the recorded files are served from (site/videos/, static assets): /videos/<lang>/<slug>.mp4 | .vtt | .jpg */
export const VIDEO_FILES = '/videos'

const T = {
  ar: {
    kicker: 'Dentora · دورة الفيديو', course: 'دورة الفيديو', courseLong: 'دورة فيديو Dentora', home: 'الصفحة الرئيسية',
    crumbs: 'مسار الصفحة',
    h1: 'تعلّم Dentora خطوة بخطوة',
    lead: 'شروحات مصوّرة قصيرة من داخل البرنامج نفسه، فصل لكل قسم، بالترتيب الذي تحتاجه: من التثبيت إلى النسخ الاحتياطي. شاهدها بالترتيب، أو اذهب مباشرة إلى ما يهمّك.',
    metaTitle: 'دورة الفيديو: تعلّم Dentora خطوة بخطوة',
    metaDesc: 'دورة فيديو مجانية لتعلّم برنامج Dentora لإدارة عيادات الأسنان: {n} بشرح صوتي وترجمة، من التثبيت إلى النسخ الاحتياطي.',
    metaDescOther: 'دورة فيديو Dentora: {n} مسجّلة من داخل البرنامج بشرح صوتي بالإنجليزية وترجمة؛ والتسجيلات العربية قريباً.',
    chapters: 'الفصول', chapterN: 'الفصل {n}', chapterOf: 'الفصل {n} من {total}',
    inCourse: 'في الدورة', totalLength: 'المدة الإجمالية', published: 'منشور حتى الآن', allPublished: 'كل الفصول منشورة', of: '{a} من {n}',
    recording: 'الفصول الأولى قيد التسجيل وستُنشر هنا تباعاً.',
    start: 'شاهد من البداية', guide: 'دليل الاستخدام', soon: 'قريباً',
    soonTitle: 'هذا الفصل قيد التسجيل', soonText: 'سيظهر الفيديو هنا فور نشره. إلى ذلك الحين يمكنك قراءة الموضوع نفسه في دليل الاستخدام.',
    otherLang: 'هذا الفصل متاح بالإنجليزية', watch: 'مشاهدة',
    noPlay: 'متصفحك لا يشغّل هذا الفيديو.', download: 'تنزيل الفيديو', captions: 'العربية',
    transcript: 'النص الكامل', transcriptHint: 'انقر على التوقيت للانتقال إلى تلك اللحظة من الفيديو.', time: 'الانتقال إلى {t}',
    readGuide: 'اقرأ هذا الموضوع في الدليل', help: 'تحتاج مساعدة؟', helpText: 'راسلنا على واتساب وسنجيبك.', whatsapp: 'واتساب',
    wa: 'مرحباً، لدي سؤال عن Dentora بعد مشاهدة فصل «{title}».', waHome: 'مرحباً، لدي سؤال عن برنامج Dentora.',
    prev: 'الفصل السابق', next: 'الفصل التالي', pager: 'الفصل السابق والتالي',
    playAll: 'تشغيل متواصل', playAllHint: 'ينتقل إلى الفصل التالي تلقائياً عند انتهاء الفيديو', watched: 'شوهد', current: 'الفصل الحالي',
    keys: 'اختصارات لوحة المفاتيح',
    keyList: [['Space / K', 'تشغيل أو إيقاف'], ['J / L', 'عشر ثوانٍ إلى الخلف أو الأمام'], ['F', 'ملء الشاشة'], ['C', 'إظهار الترجمة أو إخفاؤها']],
    duration: 'المدة', size: 'الحجم',
    helpStripTitle: 'تفضّل القراءة؟', helpStripText: 'دليل الاستخدام يشرح الموضوعات نفسها بالصور، خطوة خطوة.',
  },
  en: {
    kicker: 'Dentora · Video course', course: 'Video course', courseLong: 'Dentora video course', home: 'Home',
    crumbs: 'Breadcrumb',
    h1: 'Learn Dentora step by step',
    lead: 'Short narrated recordings from inside the app itself, one chapter per area, in the order you need them: from installing to backups. Watch them in order, or go straight to what you need.',
    metaTitle: 'Video course: learn Dentora step by step',
    metaDesc: 'A free video course for Dentora, the dental clinic software: {n} with narration and captions, from installing to backups.',
    metaDescOther: 'The Dentora video course: {n} recorded inside the app, narrated in Arabic with captions; the English recordings are coming soon.',
    chapters: 'Chapters', chapterN: 'Chapter {n}', chapterOf: 'Chapter {n} of {total}',
    inCourse: 'in the course', totalLength: 'Total length', published: 'published so far', allPublished: 'All chapters published', of: '{a} of {n}',
    recording: 'The first chapters are being recorded and will appear here one by one.',
    start: 'Watch from the start', guide: 'The user guide', soon: 'Coming soon',
    soonTitle: 'This chapter is being recorded', soonText: 'The video will appear here as soon as it is published. Until then, you can read the same topic in the user guide.',
    otherLang: 'This chapter is available in Arabic', watch: 'Watch',
    noPlay: 'Your browser cannot play this video.', download: 'Download the video', captions: 'English',
    transcript: 'Transcript', transcriptHint: 'Click a time to jump to that moment in the video.', time: 'Jump to {t}',
    readGuide: 'Read this topic in the guide', help: 'Need help?', helpText: 'Message us on WhatsApp and we will answer.', whatsapp: 'WhatsApp',
    wa: 'Hello, I have a question about Dentora after watching the chapter “{title}”.', waHome: 'Hello, I have a question about Dentora.',
    prev: 'Previous chapter', next: 'Next chapter', pager: 'Previous and next chapter',
    playAll: 'Play all', playAllHint: 'Moves on to the next chapter when the video ends', watched: 'Watched', current: 'Current chapter',
    keys: 'Keyboard shortcuts',
    keyList: [['Space / K', 'Play or pause'], ['J / L', 'Ten seconds back or forward'], ['F', 'Full screen'], ['C', 'Captions on or off']],
    duration: 'Duration', size: 'Size',
    helpStripTitle: 'Prefer reading?', helpStripText: 'The user guide covers the same topics with pictures, step by step.',
  },
} as const

// ---- icons: Lucide (ISC), the landing page's set plus the few the course needs --------------------------------
const EXTRA_ICONS = {
  play: '<path d="M6 3 20 12 6 21 6 3z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  bookOpen: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  layoutDashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  flaskConical: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  panelsTopLeft: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  keyboard: '<path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M6 8h.01"/><path d="M7 16h10"/><path d="M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  listVideo: '<path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 5 3-5 3v-6Z"/>',
} as const
type Icon = keyof typeof EXTRA_ICONS | IconName
function icon(name: Icon, cls = ''): string {
  const paths = name in EXTRA_ICONS ? EXTRA_ICONS[name as keyof typeof EXTRA_ICONS] : ICONS[name as IconName]
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`
}
/** The mark of a chapter on its placeholder card and its "coming" panel. */
const CHAPTER_ICON: Record<string, Icon> = {
  'getting-started': 'rocket', interface: 'panelsTopLeft', dashboard: 'layoutDashboard', patients: 'users', chart: 'tooth',
  appointments: 'calendarCheck', treatments: 'clipboardList', billing: 'receipt', prescriptions: 'pill', lab: 'flaskConical',
  inventory: 'package', expenses: 'wallet', reports: 'chartColumn', settings: 'settings', staff: 'userCog', backup: 'databaseBackup',
  licence: 'keyRound',
}
const chapterIcon = (c: VideoChapter) => icon(CHAPTER_ICON[c.slug] ?? 'video')

// ---- words and numbers (Latin digits, like the rest of the site) ---------------------------------------------
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

/** Arabic counted nouns: 1 and 2 have their own forms, 3–10 take the plural, 11 and up the singular. */
function arCount(n: number, f: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return f.one
  if (n === 2) return f.two
  return `${n} ${n >= 3 && n <= 10 ? f.few : f.many}`
}
export function chaptersCount(n: number, lang: Lang): string {
  if (lang === 'en') return n === 1 ? '1 chapter' : `${n} chapters`
  return arCount(n, { one: 'فصل واحد', two: 'فصلان', few: 'فصول', many: 'فصلاً' })
}
/** "3:07", "1:02:30": the player's clock (whole seconds, rounded down like a player's own). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}
/** "25 min", "1 h 05 min" / "25 دقيقة", "ساعة و5 دقائق": a length written out. */
export function lengthText(seconds: number, lang: Lang): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600), m = Math.round((total % 3600) / 60)
  if (lang === 'en') {
    if (total < 60) return `${total} s`
    return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')} min` : ''}` : `${m} min`
  }
  if (total < 60) return arCount(total, { one: 'ثانية واحدة', two: 'ثانيتان', few: 'ثوانٍ', many: 'ثانية' })
  const mins = arCount(m, { one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' })
  if (!h) return mins
  const hours = arCount(h, { one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' })
  return m ? `${hours} و${mins}` : hours
}
/** "18 MB" / "18 م.ب" (whole megabytes; under one, one decimal). */
export function sizeText(bytes: number, lang: Lang): string {
  const mb = bytes / 1048576
  const n = mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1).replace(/\.0$/, '')
  return lang === 'en' ? `${n} MB` : `${n} م.ب`
}
/** ISO 8601 duration for schema.org: "PT3M7S". */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${sec || (!h && !m) ? `${sec}S` : ''}`
}

// ---- addresses ---------------------------------------------------------------------------------------------------
const cleanOrigin = (origin: string) => String(origin || '').replace(/\/+$/, '')
export const chapterPath = (slug: string, lang: Lang) => langPath(`${VIDEOS_PATH}/${slug}`, lang)
export const guidePath = (topic: string, lang: Lang) => langPath(`/guide/${topic}`, lang)
/** The recorded files of a chapter in a language; ?v= is the recording's hash, so a new recording is never served stale. */
export function videoFiles(lang: Lang, slug: string, rec: VideoRecord | undefined) {
  const base = `${VIDEO_FILES}/${lang}/${slug}`
  const v = rec?.sha256 ? `?v=${String(rec.sha256).slice(0, 12)}` : ''
  return { mp4: `${base}.mp4${v}`, vtt: `${base}.vtt${v}`, jpg: `${base}.jpg${v}` }
}
/** The seller's WhatsApp link with a message, falling back to the default number when the setting is not a number. */
function waLink(s: SiteSettings, text: string): string {
  const digits = String(s.whatsapp ?? '').replace(/\D/g, '')
  const number = digits.length >= 8 && digits.length <= 15 ? s.whatsapp : DEFAULT_SETTINGS.whatsapp
  return `${sellerWa(number)}?text=${encodeURIComponent(text)}`
}

/** A recorded chapter's entry in the manifest, only when it is whole enough to show (a duration and a file). */
export function recordOf(manifest: VideoManifest | null | undefined, lang: Lang, slug: string): VideoRecord | undefined {
  const rec = manifest?.[videoKey(lang, slug)]
  if (!rec || typeof rec !== 'object') return undefined
  return Number.isFinite(rec.durationSeconds) && rec.durationSeconds > 0 ? rec : undefined
}
/** The scenes of a chapter in a language (a chapter being recorded may have its transcript before its file). */
function scenesOf(manifest: VideoManifest | null | undefined, lang: Lang, slug: string) {
  const rec = manifest?.[videoKey(lang, slug)]
  const scenes = Array.isArray(rec?.scenes) ? rec.scenes : []
  return scenes.filter(s => s && typeof s.text === 'string' && s.text.trim() && Number.isFinite(s.start) && s.start >= 0)
}

/** The page with extra head elements (stylesheet, Open Graph, structured data, script) the shell has no slot for. */
function withHead(page: string, extra: string): string {
  const at = page.indexOf('</head>')
  if (at < 0) throw new Error('shell(): no </head>')
  return `${page.slice(0, at)}${extra}\n${page.slice(at)}`
}
interface HeadExtra {
  lang: Lang; url: string; title: string; description: string; image: string
  video?: { url: string; width: number; height: number; duration: number }
  ld: unknown
}
function headExtra(h: HeadExtra): string {
  const og = [
    '<link rel="stylesheet" href="/css/videos.css">',
    `<meta property="og:type" content="${h.video ? 'video.other' : 'website'}">`,
    '<meta property="og:site_name" content="Dentora">',
    `<meta property="og:title" content="${escapeHtml(h.title)}">`,
    `<meta property="og:description" content="${escapeHtml(h.description)}">`,
    `<meta property="og:url" content="${escapeHtml(h.url)}">`,
    `<meta property="og:image" content="${escapeHtml(h.image)}">`,
    `<meta property="og:locale" content="${OG_LOCALE[h.lang]}">`,
    `<meta property="og:locale:alternate" content="${OG_LOCALE[h.lang === 'ar' ? 'en' : 'ar']}">`,
    h.video ? `<meta property="og:video" content="${escapeHtml(h.video.url)}">` : '',
    h.video ? `<meta property="og:video:secure_url" content="${escapeHtml(h.video.url)}">` : '',
    h.video ? '<meta property="og:video:type" content="video/mp4">' : '',
    h.video ? `<meta property="og:video:width" content="${h.video.width}">` : '',
    h.video ? `<meta property="og:video:height" content="${h.video.height}">` : '',
    h.video ? `<meta property="video:duration" content="${Math.round(h.video.duration)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(h.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(h.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(h.image)}">`,
    `<script type="application/ld+json">${jsonForScript(h.ld)}</script>`,
    '<script src="/js/videos.js" defer></script>',
  ]
  return og.filter(Boolean).join('\n')
}
function breadcrumbs(origin: string, lang: Lang, items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${origin}${langPath(it.path, lang)}` })),
  }
}
// The maker and the app as the home page describes them (same @ids), so every page names the same publisher.
const publisher = (_origin: string) => organization()
const aboutApp = { '@type': 'SoftwareApplication', '@id': APP_ID, name: 'Dentora', applicationCategory: 'BusinessApplication', operatingSystem: 'Windows 10, Windows 11, Android 7.0 or later' }

// ---- the course home ------------------------------------------------------------------------------------------
export function renderVideosHome(lang: Lang, s: SiteSettings, origin: string, assets: PageAssets, chapters: readonly VideoChapter[], manifest: VideoManifest | null | undefined): string {
  const t = T[lang]
  origin = cleanOrigin(origin)
  const list = [...chapters].sort((a, b) => a.order - b.order)
  const recorded = list.map(c => recordOf(manifest, lang, c.slug))
  const published = recorded.filter(Boolean).length
  const total = recorded.reduce((sum, r) => sum + (r?.durationSeconds ?? 0), 0)
  const first = list[recorded.findIndex(Boolean)] ?? list[0]
  const url = `${origin}${langPath(VIDEOS_PATH, lang)}`
  const image = `${origin}/img/og-${lang}.jpg`
  // nothing recorded in this language yet, but in the other: say so (the chapters play in the other language)
  const other: Lang = lang === 'ar' ? 'en' : 'ar'
  const otherFirst = list.find(c => recordOf(manifest, other, c.slug))
  const onlyOther = !published && !!otherFirst
  const description = fill(onlyOther ? t.metaDescOther : t.metaDesc, { n: chaptersCount(list.length, lang) })

  const stats = [
    `<li><strong>${escapeHtml(chaptersCount(list.length, lang))}</strong><span>${t.inCourse}</span></li>`,
    published ? `<li><strong>${escapeHtml(lengthText(total, lang))}</strong><span>${t.totalLength}</span></li>` : '',
    published && published < list.length ? `<li><strong>${fill(t.of, { a: published, n: list.length })}</strong><span>${t.published}</span></li>` : '',
    published && published === list.length ? `<li><strong>${icon('badgeCheck')}${t.allPublished}</strong></li>` : '',
  ].filter(Boolean).join('')

  const cards = list.map((c, i) => {
    const rec = recorded[i]
    const files = videoFiles(lang, c.slug, rec)
    const href = chapterPath(c.slug, lang)
    const thumb = rec
      ? `<img src="${escapeHtml(files.jpg)}" alt="" width="1280" height="720" loading="lazy" decoding="async"><span class="vc-dur">${icon('clock')}${clock(rec.durationSeconds)}</span><span class="vc-play">${icon('play')}</span>`
      : `<span class="vc-thumb-icon">${chapterIcon(c)}</span><span class="vc-soon">${t.soon}</span>`
    return `<li class="vc-card${rec ? '' : ' vc-card-soon'}" data-slug="${escapeHtml(c.slug)}">
<div class="vc-thumb" aria-hidden="true">${thumb}</div>
<div class="vc-card-body">
<p class="vc-card-num"><span>${fill(t.chapterN, { n: c.order })}</span>${icon('check', 'vc-tick')}</p>
<h3 class="vc-card-title"><a href="${escapeHtml(href)}">${escapeHtml(c.title[lang])}</a></h3>
<p class="vc-card-sum">${escapeHtml(c.summary[lang])}</p>
</div>
</li>`
  }).join('\n')

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList', name: t.courseLong, description, url, numberOfItems: list.length,
        itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.title[lang], url: `${origin}${chapterPath(c.slug, lang)}` })),
      },
      breadcrumbs(origin, lang, [{ name: t.home, path: '/' }, { name: t.course, path: VIDEOS_PATH }]),
    ],
  }
  const body = `<main id="main" class="legal-main vc vc-home">
<div class="legal-hero vc-hero"><div class="container legal-wrap vc-hero-in">
<div class="vc-hero-copy">
<p class="legal-kicker">${t.kicker}</p>
<h1>${t.h1}</h1>
<p class="vc-lead">${t.lead}</p>
<div class="vc-hero-actions">
<a class="btn btn-primary legal-btn vc-btn" href="${escapeHtml(onlyOther ? chapterPath(otherFirst!.slug, other) : chapterPath(first.slug, lang))}"${onlyOther ? ` hreflang="${other}"` : ''}>${icon('play')}<span>${t.start}</span></a>
<a class="btn btn-outline legal-btn legal-btn-ghost vc-btn" href="${escapeHtml(langPath('/guide', lang))}">${icon('bookOpen')}<span>${t.guide}</span></a>
</div>
${published ? '' : `<p class="vc-recording">${icon('clock')}<span>${t.recording}</span></p>`}
</div>
<ul class="vc-stats" aria-label="${escapeHtml(t.course)}">${stats}</ul>
</div></div>
<div class="container legal-wrap vc-home-body">
<h2 class="vc-h2" id="chapters">${t.chapters}</h2>
<ol class="vc-cards" data-watched-label="${escapeHtml(t.watched)}">
${cards}
</ol>
<div class="vc-strip">
<div class="vc-strip-card"><span class="vc-strip-icon">${icon('bookOpen')}</span><div><h2>${t.helpStripTitle}</h2><p>${t.helpStripText}</p></div><a class="btn btn-outline legal-btn legal-btn-ghost vc-btn" href="${escapeHtml(langPath('/guide', lang))}">${t.guide}</a></div>
<div class="vc-strip-card vc-strip-help"><span class="vc-strip-icon">${icon('messageCircle')}</span><div><h2>${t.help}</h2><p>${t.helpText}</p></div><a class="btn btn-wa legal-btn vc-btn" href="${escapeHtml(waLink(s, t.waHome))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${t.whatsapp}</span></a></div>
</div>
</div>
</main>`
  const page = shell({ lang, title: `${t.metaTitle} — Dentora`, description, origin, assets, path: VIDEOS_PATH, body })
  return withHead(page, headExtra({ lang, url, title: t.metaTitle, description, image, ld }))
}

// ---- a chapter ---------------------------------------------------------------------------------------------------
export interface ChapterOptions {
  /** Start the video at this many seconds (?t= of a time link used without the script, or a shared link). */
  t?: number
}
export function renderVideoChapter(
  lang: Lang, s: SiteSettings, origin: string, assets: PageAssets, chapter: VideoChapter, chapters: readonly VideoChapter[],
  manifest: VideoManifest | null | undefined, opts: ChapterOptions = {},
): string {
  const t = T[lang], other: Lang = lang === 'ar' ? 'en' : 'ar'
  origin = cleanOrigin(origin)
  const list = [...chapters].sort((a, b) => a.order - b.order)
  const at = list.findIndex(c => c.slug === chapter.slug)
  const prev = at > 0 ? list[at - 1] : null, next = at >= 0 && at < list.length - 1 ? list[at + 1] : null
  const rec = recordOf(manifest, lang, chapter.slug)
  const scenes = scenesOf(manifest, lang, chapter.slug)
  const files = videoFiles(lang, chapter.slug, rec)
  const path = `${VIDEOS_PATH}/${chapter.slug}`
  const url = `${origin}${langPath(path, lang)}`
  const title = chapter.title[lang], summary = chapter.summary[lang]
  const startAt = Number.isFinite(opts.t) && (opts.t as number) > 0 ? Math.floor(opts.t as number) : 0
  const image = rec ? `${origin}${files.jpg}` : `${origin}/img/og-${lang}.jpg`
  const otherRec = recordOf(manifest, other, chapter.slug)

  // the player, or the "coming" panel
  const player = rec
    ? `<video controls playsinline preload="metadata" poster="${escapeHtml(files.jpg)}" width="${rec.width || 1920}" height="${rec.height || 1080}" lang="${lang}">
<source src="${escapeHtml(files.mp4)}${startAt ? `#t=${startAt}` : ''}" type="video/mp4">
<track kind="subtitles" src="${escapeHtml(files.vtt)}" srclang="${lang}" label="${t.captions}" default>
<p class="vc-noplay">${t.noPlay} <a href="${escapeHtml(files.mp4)}" download>${t.download}</a></p>
</video>`
    : `<div class="vc-soon-panel" role="status">
<span class="vc-soon-icon">${chapterIcon(chapter)}</span>
<p class="vc-soon-title">${t.soonTitle}</p>
<p class="vc-soon-text">${t.soonText}</p>
<p class="vc-soon-links"><a class="btn btn-white legal-btn vc-btn" href="${escapeHtml(guidePath(chapter.guide, lang))}">${icon('bookOpen')}<span>${t.readGuide}</span></a>${otherRec ? `<a class="vc-soon-other" href="${escapeHtml(chapterPath(chapter.slug, other))}" hreflang="${other}">${t.otherLang}</a>` : ''}</p>
</div>`

  const meta = [
    fill(t.chapterOf, { n: chapter.order, total: list.length }),
    rec ? `<span class="vc-meta-dur">${icon('clock')}<span class="sr-only">${t.duration}: </span>${clock(rec.durationSeconds)}</span>` : `<span class="vc-meta-soon">${t.soon}</span>`,
    rec && rec.sizeBytes > 0 ? `<span><span class="sr-only">${t.size}: </span>${escapeHtml(sizeText(rec.sizeBytes, lang))}</span>` : '',
  ].filter(Boolean).map(x => `<span>${x}</span>`).join('')

  const items = list.map(c => {
    const r = recordOf(manifest, lang, c.slug), current = c.slug === chapter.slug
    return `<li class="vc-item${current ? ' is-current' : ''}${r ? '' : ' vc-item-soon'}" data-slug="${escapeHtml(c.slug)}"><a href="${escapeHtml(chapterPath(c.slug, lang))}"${current ? ' aria-current="page"' : ''}>
<span class="vc-item-num" aria-hidden="true"><span>${c.order}</span>${icon('check', 'vc-tick')}</span>
<span class="vc-item-body"><span class="vc-item-title">${escapeHtml(c.title[lang])}</span><span class="vc-item-dur">${r ? clock(r.durationSeconds) : t.soon}</span></span>
</a></li>`
  }).join('\n')

  const lines = scenes.map((sc, i) => {
    const time = clock(sc.start), end = scenes[i + 1]?.start ?? rec?.durationSeconds
    return `<li class="vc-line" id="${escapeHtml(`scene-${sc.id}`)}" data-start="${sc.start}"${end !== undefined ? ` data-end="${end}"` : ''}>
<a class="vc-time" href="${escapeHtml(`?t=${Math.floor(sc.start)}#player`)}" data-t="${sc.start}" aria-label="${escapeHtml(fill(t.time, { t: time }))}"><time datetime="${isoDuration(sc.start)}">${time}</time></a>
<span class="vc-line-text">${escapeHtml(sc.text)}</span>
</li>`
  }).join('\n')
  const transcript = scenes.length
    ? `<section class="vc-transcript" aria-labelledby="transcript-title">
<div class="vc-transcript-head"><h2 id="transcript-title">${t.transcript}</h2>${rec ? `<p class="vc-transcript-hint">${t.transcriptHint}</p>` : ''}</div>
<ol class="vc-lines">
${lines}
</ol>
</section>`
    : ''

  const arrowBack = icon(lang === 'ar' ? 'arrowRight' : 'arrowLeft'), arrowOn = icon(lang === 'ar' ? 'arrowLeft' : 'arrowRight')
  const pagerLink = (c: VideoChapter | null, kind: 'prev' | 'next') => c
    ? `<a class="vc-pager-${kind}" href="${escapeHtml(chapterPath(c.slug, lang))}" rel="${kind}">${kind === 'prev' ? arrowBack : ''}<span class="vc-pager-body"><span class="vc-pager-k">${t[kind]}</span><span class="vc-pager-t">${escapeHtml(c.title[lang])}</span></span>${kind === 'next' ? arrowOn : ''}</a>`
    : `<span class="vc-pager-${kind} vc-pager-none" aria-hidden="true"></span>`

  const keys = `<details class="vc-keys" hidden data-js><summary>${icon('keyboard')}<span>${t.keys}</span></summary><dl>${t.keyList.map(([k, v]) => `<div><dt><kbd>${k}</kbd></dt><dd>${v}</dd></div>`).join('')}</dl></details>`

  const videoLd = rec ? {
    '@type': 'VideoObject', name: title, description: summary, url,
    thumbnailUrl: [image],
    ...(rec.recordedAt ? { uploadDate: rec.recordedAt } : {}),
    duration: isoDuration(rec.durationSeconds),
    contentUrl: `${origin}${files.mp4}`,
    inLanguage: lang,
    width: rec.width || 1920, height: rec.height || 1080,
    isFamilyFriendly: true,
    publisher: publisher(origin),
    about: aboutApp,
    ...(scenes.length > 1 ? {
      hasPart: scenes.map((sc, i) => ({
        '@type': 'Clip', name: sc.text, startOffset: sc.start,
        ...(scenes[i + 1] ? { endOffset: scenes[i + 1].start } : { endOffset: rec.durationSeconds }),
        url: `${url}?t=${Math.floor(sc.start)}`,
      })),
    } : {}),
  } : null
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      ...(videoLd ? [videoLd] : []),
      breadcrumbs(origin, lang, [{ name: t.home, path: '/' }, { name: t.course, path: VIDEOS_PATH }, { name: title, path }]),
    ],
  }

  const body = `<main id="main" class="legal-main vc vc-chapter">
<div class="container legal-wrap vc-grid">
<nav class="vc-crumbs" aria-label="${escapeHtml(t.crumbs)}"><ol><li><a href="${escapeHtml(langPath('/', lang))}">${t.home}</a></li><li><a href="${escapeHtml(langPath(VIDEOS_PATH, lang))}">${t.course}</a></li><li aria-current="page">${fill(t.chapterN, { n: chapter.order })}</li></ol></nav>
<div class="vc-player${rec ? '' : ' vc-player-soon'}" id="player" data-slug="${escapeHtml(chapter.slug)}" data-lang="${lang}"${next ? ` data-next="${escapeHtml(chapterPath(next.slug, lang))}"` : ''}${startAt ? ` data-start="${startAt}"` : ''}>
${player}
</div>
<header class="vc-head">
<p class="vc-meta">${meta}</p>
<h1>${escapeHtml(title)}</h1>
<p class="vc-lead">${escapeHtml(summary)}</p>
</header>
<aside class="vc-aside">
<div class="vc-list">
<div class="vc-list-head">
<h2 class="vc-list-title">${icon('listVideo')}<span>${t.chapters}</span><span class="vc-list-count">${fill(t.of, { a: chapter.order, n: list.length })}</span></h2>
<label class="vc-switch" hidden data-js title="${escapeHtml(t.playAllHint)}"><input type="checkbox" id="vc-playall" class="vc-switch-input"><span class="vc-switch-track" aria-hidden="true"></span><span class="vc-switch-label">${t.playAll}</span></label>
</div>
<nav aria-label="${escapeHtml(t.chapters)}"><ol class="vc-items" data-watched-label="${escapeHtml(t.watched)}" data-current-label="${escapeHtml(t.current)}">
${items}
</ol></nav>
</div>
</aside>
<div class="vc-actions">
<a class="vc-action" href="${escapeHtml(guidePath(chapter.guide, lang))}">${icon('bookOpen')}<span>${t.readGuide}</span></a>
<a class="vc-action vc-action-wa" href="${escapeHtml(waLink(s, fill(t.wa, { title })))}" rel="noopener" target="_blank">${icon('messageCircle')}<span>${t.help} ${t.whatsapp}</span></a>
${rec ? `<a class="vc-action" href="${escapeHtml(files.mp4)}" download>${icon('download')}<span>${t.download}</span></a>` : ''}
${rec ? keys : ''}
</div>
<nav class="vc-pager" aria-label="${escapeHtml(t.pager)}">${pagerLink(prev, 'prev')}${pagerLink(next, 'next')}</nav>
${transcript}
</div>
</main>`
  // a chapter not recorded in this language is a placeholder: not indexed; a recorded one lists the languages it
  // is recorded in as its hreflang alternates
  const page = shell({
    lang, title: `${title} — ${t.courseLong}`, description: summary, origin, assets, path, body,
    noindex: !rec, alternates: (['ar', 'en'] as Lang[]).filter(l => l === lang || (l === other && otherRec)),
  })
  const video = rec ? { url: `${origin}${files.mp4}`, width: rec.width || 1920, height: rec.height || 1080, duration: rec.durationSeconds } : undefined
  return withHead(page, headExtra({ lang, url, title: `${title} — ${t.courseLong}`, description: summary, image, video, ld }))
}
