// /llms.txt and /llms-full.txt (https://llmstxt.org): what Dentora is, in plain Markdown, for AI assistants and the
// crawlers that feed them. Both are built from the same words as the pages (content.ts, compare-content.ts, the
// guide's topics and the video course), so they never say more than the site, and they follow the seller's settings
// (price, WhatsApp) like the pages do.
//   /llms.txt       the name, a one-paragraph summary, the key facts and links to every page
//   /llms-full.txt  the same facts, then the home page's full text (features, privacy, pricing, downloads, how to
//                   start, the FAQ with its answers) and the comparison page, in English
import { TOPICS } from '../../guide/index'
import { CHAPTERS } from '../../videos/index'
import { recordOf } from '../../videos/render'
import type { VideoManifest } from '../../videos/types'
import { HREFLANG, sitePath, SITE_LANGS, LANG_NAME } from '../site-lang'
import { ORIGIN, type LandingContext, type SiteSettings } from '../types'
import { COMPARE, COMPARE_DATE } from './compare-content'
import { faqText, fillText, makeView, type View } from './landing'

export interface LlmsContext {
  s: SiteSettings
  ctx: LandingContext
  videos: VideoManifest | null
}

const url = (path: string) => `${ORIGIN}${path}`
const link = (label: string, path: string, note = '') => `- [${label}](${url(path)})${note ? `: ${note}` : ''}`

/** The facts, one line each: the same as the pages' summary, trust strip, pricing and requirements. */
function keyFacts(v: View): string[] {
  const s = v.s
  return [
    'What it is: dental clinic management software (practice management) for dentists, assistants and receptionists.',
    'Platforms: Windows 10 and Windows 11 (64-bit) computers; Android 7.0 or later phones and tablets.',
    'Internet: works fully offline. The internet is needed only to download the app and once to activate the licence key (or activate it from any other device on the activation page).',
    'Interface languages: Arabic (right-to-left, with Arabic-aware search) and English, switchable at any time.',
    `Price: ${v.priceInline}, paid once, for a lifetime licence on one device, with every feature. No subscription and no yearly renewal. Each additional device needs its own licence.`,
    'Free trial: 7 days with every feature, no sign-up and no account. Nothing is deleted when the trial ends; adding and editing pause until you activate.',
    "Data: all clinic and patient data stays on the device. No account, no cloud sync, no ads, no tracking; the maker never receives the clinic's or patients' data. Activating a key sends only the key and the device number, once.",
    'Backup: the whole clinic in one file, saved wherever you choose (USB stick, Google Drive, e-mail), verified after saving, optionally password-protected with AES-256 encryption; restore it on the same device or a new one.',
    'Features: patient files with medical alerts; interactive dental chart with FDI numbering (permanent and primary teeth, every surface, full history); appointments for several doctors with conflict detection and WhatsApp reminders; treatments and treatment plans with printable estimates; invoices, part payments, numbered receipts and statements; prescriptions; lab orders; inventory with low-stock and expiry alerts; expenses; reports with CSV export; staff roles and permissions with PIN sign-in.',
    'Limits: one device per licence, and devices do not sync with each other (each keeps its own records).',
    `Buying and support: on WhatsApp, ${s.whatsapp}${s.email ? `, or by e-mail at ${s.email}` : ''}. After paying you receive a 16-character licence key.`,
    'Maker: Raqeem (https://raqeem.dev).',
  ]
}

/** The video course's chapters that are published, in either language, with the page that plays each one. */
function publishedChapters(videos: VideoManifest | null) {
  return [...CHAPTERS].sort((a, b) => a.order - b.order).flatMap(c => {
    const en = recordOf(videos, 'en', c.slug), ar = recordOf(videos, 'ar', c.slug)
    if (!en && !ar) return []
    const narration = en && ar ? 'Arabic and English' : en ? 'English' : 'Arabic'
    const path = en ? `/en/videos/${c.slug}` : `/videos/${c.slug}`
    const seconds = (en ?? ar)!.durationSeconds
    return [{ c, path, narration, minutes: Math.max(1, Math.round(seconds / 60)) }]
  })
}

export function renderLlmsTxt(o: LlmsContext): string {
  const v = makeView('en', o.s, o.ctx, '/')
  const summary = fillText(v.t.summary.text, { price: v.priceInline })
  const chapters = publishedChapters(o.videos)
  const otherHomes = SITE_LANGS.filter(l => l !== 'en' && l !== 'ar')
  const lines = [
    '# Dentora',
    '',
    `> ${summary}`,
    '',
    'Key facts:',
    '',
    ...keyFacts(v).map(f => `- ${f}`),
    '',
    'The website is in Arabic (at the root) and English (under /en); the user guide, the video course, the activation page and the legal pages exist in both.',
    '',
    '## Website',
    '',
    link('Dentora home page (English)', '/en', 'what Dentora does, screenshots, the price, downloads for Android and Windows, and the FAQ'),
    link('Dentora home page (Arabic)', '/', 'the same page in Arabic (الصفحة الرئيسية بالعربية)'),
    ...otherHomes.map(l => link(`Dentora home page (${LANG_NAME[l]})`, sitePath('/', l), `the same page in ${LANG_NAME[l]} (${HREFLANG[l]}); the app itself is in Arabic and English`)),
    link(COMPARE.en.meta.h1, '/en/compare', 'offline desktop and mobile software, cloud subscriptions and server-based desktop systems compared, with a checklist and who Dentora is and is not for'),
    link(COMPARE.ar.meta.h1, '/compare', 'the comparison in Arabic'),
    '',
    '## User guide',
    '',
    link('User guide (English)', '/en/guide', 'every screen of the app explained step by step, with pictures'),
    link('User guide (Arabic)', '/guide', 'دليل الاستخدام بالعربية'),
    ...[...TOPICS].sort((a, b) => a.order - b.order).map(t => link(t.title.en, `/en/guide/${t.slug}`, `${t.summary.en} (Arabic: ${url(`/guide/${t.slug}`)})`)),
    '',
    '## Video course',
    '',
    link('Video course (Arabic)', '/videos', `${chapters.length} narrated chapters recorded inside the app, with captions and transcripts`),
    link('Video course (English page)', '/en/videos', 'the course home in English'),
    ...chapters.map(x => link(x.c.title.en, x.path, `${x.c.summary.en} (${x.minutes} min, ${x.narration} narration)`)),
    '',
    '## Licence and legal',
    '',
    link('Activate a licence key', '/en/activate', 'turn a licence key and a device number into an activation code, from any device (Arabic: ' + url('/activate') + ')'),
    link('Privacy policy', '/en/privacy', 'what the app and the website collect: the app sends nothing but the key and device number on activation (Arabic: ' + url('/privacy') + ')'),
    link('Terms of use', '/en/terms', 'the licence terms (Arabic: ' + url('/terms') + ')'),
    '',
    '## Optional',
    '',
    link('llms-full.txt', '/llms-full.txt', 'the home page and the comparison page in full, with every FAQ answer, in English'),
    link('Sitemap', '/sitemap.xml', 'every page with its languages and last change'),
    '- [Raqeem](https://raqeem.dev): the maker of Dentora',
    '',
  ]
  return lines.join('\n')
}

export function renderLlmsFull(o: LlmsContext): string {
  const v = makeView('en', o.s, o.ctx, '/')
  const t = v.t
  const c = COMPARE.en
  const summary = fillText(t.summary.text, { price: v.priceInline })
  const fill = (s: string) => fillText(s, { price: v.priceInline })
  const lines: string[] = [
    '# Dentora',
    '',
    `> ${summary}`,
    '',
    `Source: ${url('/en')} (Arabic: ${url('/')}). Also see ${url('/llms.txt')} for the list of pages.`,
    '',
    '## Key facts',
    '',
    ...keyFacts(v).map(f => `- ${f}`),
    '',
    `## ${t.features.title}`,
    '',
    t.features.lead,
    '',
    ...t.features.items.flatMap(f => [`### ${f.title}`, '', f.text, '']),
    `## ${t.privacy.title}`,
    '',
    t.privacy.lead,
    '',
    ...t.privacy.points.map(p => `- ${p.title}: ${p.text}`),
    '',
    `## ${t.pricing.title}`,
    '',
    fill(t.pricing.lead),
    '',
    `- Price: ${v.priceInline} (${t.pricing.terms.replace(/ · /g, ', ')})`,
    ...t.pricing.points.map(p => `- ${p.title}: ${p.text}`),
    `- ${t.pricing.includedTitle}: ${t.pricing.included.join('; ')}.`,
    '',
    `## ${t.download.title}`,
    '',
    fill(t.download.lead),
    '',
    `- ${t.download.android.name} (${t.download.android.for.toLowerCase()}): ${t.download.android.req}. Download: ${url('/download/android')}${v.ctx.apk ? ` (version ${v.ctx.apk.version})` : ''}`,
    `- ${t.download.windows.name} (${t.download.windows.for.toLowerCase()}): ${t.download.windows.req}. Download: ${url('/download/windows')}${v.ctx.windows ? ` (version ${v.ctx.windows.version})` : ''}`,
    `- ${t.download.reqTitle}: ${t.download.reqs.join('; ')}.`,
    '',
    `## ${t.steps.title}`,
    '',
    ...t.steps.items.map((x, i) => `${i + 1}. ${x.title}: ${x.text}`),
    '',
    `## ${t.faq.title}`,
    '',
    ...t.faq.items.flatMap(f => [`### ${f.q}`, '', faqText(v, f.a), '']),
    `## ${c.meta.h1}`,
    '',
    `Source: ${url('/en/compare')} (Arabic: ${url('/compare')}). Last reviewed: ${COMPARE_DATE}.`,
    '',
    ...c.intro.map(fill),
    '',
    ...c.approaches.flatMap(a => [
      `### ${a.name}`,
      '',
      fill(a.summary),
      '',
      ...c.columns.map((col, i) => `- ${col}: ${fill(a.cells[i])}`),
      ...(a.examples.length ? [`- ${c.examplesLabel}: ${a.examples.map(e => `${e.name} (${e.url})`).join(', ')}`] : []),
      '',
    ]),
    `### ${c.choose.title}`,
    '',
    ...c.choose.items.map(x => `- ${x}`),
    '',
    `### ${c.fit.forTitle}`,
    '',
    ...c.fit.for.map(x => `- ${fill(x)}`),
    '',
    `### ${c.fit.notTitle}`,
    '',
    ...c.fit.not.map(x => `- ${x}`),
    '',
    ...c.faq.flatMap(f => [`### ${f.q}`, '', fill(f.a), '']),
    `### ${c.sources.title}`,
    '',
    ...c.sources.items.map(x => `- ${x.label}: ${x.url}`),
    '',
  ]
  return lines.join('\n')
}
