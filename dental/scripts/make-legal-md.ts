// Writes docs/PRIVACY.md and docs/TERMS.md from the texts the app shows (src/features/legal/docs.ts) and their date
// (LEGAL_DATE in src/features/legal/lib.ts), with the seller's name and contacts of src/features/settings/seller.ts,
// so the copies kept for the store listings never drift from the app and the website. Run after editing docs.ts:
//   npx tsx scripts/make-legal-md.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const docs = (await import('../src/features/legal/docs')).default as Record<'ar' | 'en', Record<string, string>>
const lib = readFileSync(join(ROOT, 'src/features/legal/lib.ts'), 'utf8')
const seller = readFileSync(join(ROOT, 'src/features/settings/seller.ts'), 'utf8')
const LEGAL_DATE = /export const LEGAL_DATE = '(\d{4}-\d{2}-\d{2})'/.exec(lib)![1]
const name = /name: '([^']*)'/.exec(seller)![1]
const whatsapp = /whatsapp: '([^']*)'/.exec(seller)![1]
const email = /email: '([^']*)'/.exec(seller)![1]

const date = (lang: 'ar' | 'en') => {
  const d = new Date(`${LEGAL_DATE}T12:00:00Z`)
  if (lang === 'en') return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  // the app's Arabic dates: the Levantine month with its common name, Western digits ("18 تشرين الأول (أكتوبر) 2026")
  const LEVANT = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']
  const COMMON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  const m = d.getUTCMonth()
  return `${d.getUTCDate()} ${LEVANT[m]} (${COMMON[m]}) ${d.getUTCFullYear()}`
}
const contact = (lang: 'ar' | 'en') => [name, [whatsapp && `${lang === 'ar' ? 'واتساب' : 'WhatsApp'}: ${whatsapp}`, email && `${lang === 'ar' ? 'البريد' : 'E-mail'}: ${email}`].filter(Boolean).join(' · ')].join(' — ')
const body = (lang: 'ar' | 'en', key: string) => docs[lang][key].replace(/\{seller\}/g, name).replace(/\{contact\}/g, contact(lang))

const TITLES = {
  privacy: { file: 'PRIVACY.md', ar: 'سياسة الخصوصية', en: 'Privacy policy' },
  terms: { file: 'TERMS.md', ar: 'شروط الاستخدام', en: 'Terms of use' },
} as const

for (const [doc, t] of Object.entries(TITLES) as [keyof typeof TITLES, (typeof TITLES)[keyof typeof TITLES]][]) {
  const md = `<!-- Generated from src/features/legal/docs.ts (the text shown in the app: Settings → About) by scripts/make-legal-md.ts.
     Do not edit by hand: edit docs.ts and run npx tsx scripts/make-legal-md.ts. -->

# Dentora — ${t.ar} | ${t.en}

[العربية](#ar) · [English](#en)

<div dir="rtl" lang="ar" id="ar">

# ${t.ar}

آخر تحديث: ${date('ar')}

${body('ar', `${doc}.body`)}

</div>

---

<div dir="ltr" lang="en" id="en">

# ${t.en}

Last updated: ${date('en')}

${body('en', `${doc}.body`)}

</div>
`
  writeFileSync(join(ROOT, 'docs', t.file), md)
  console.log(`docs/${t.file}: ${LEGAL_DATE}`)
}
