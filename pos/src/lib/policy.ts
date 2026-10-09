// Content policy: tobacco and smoking products are not sold through Kaseb. The seller's rule, enforced wherever a product
// or a custom sale line gets its name (product form, quick add, purchases, CSV import, backup restore, onboarding) and on
// category names. Matching is forgiving about spelling (Arabic diacritics, alef forms, prefixes like ال/و/ب) but stays
// precise: generic words that merely resemble a brand (كامل, كنت, الحمراء) are matched only as Latin brand names or in
// their cigarette phrasing, and a few phrases are explicit exceptions (كاشف دخان, camel milk).

/** Arabic terms, matched as whole words with the usual prefixes (ال، و، ب، ك، ف، ل) and, unless `exact`, any suffix. */
const AR: { term: string; exact?: boolean }[] = [
  { term: 'دخان' }, { term: 'سجائر' }, { term: 'سجاير' }, { term: 'سكاير' }, { term: 'سيجار' }, { term: 'سيكار' }, { term: 'سيغار' },
  { term: 'تبغ' }, { term: 'تنباك' }, { term: 'تمباك' }, { term: 'معسل' }, { term: 'جراك' },
  { term: 'ارجيله' }, { term: 'اركيله' }, { term: 'نرجيله' }, { term: 'نارجيله' }, { term: 'ارجيل' }, { term: 'شيشه' },
  { term: 'نيكوتين' }, { term: 'فيب', exact: true }, { term: 'فايب', exact: true }, { term: 'فيبات', exact: true },
  { term: 'ايكوس' }, { term: 'هيتس' }, { term: 'تيريا', exact: true }, { term: 'ورق لف' }, { term: 'لفافه تبغ' },
  // brands (Arabic spellings that are not ordinary words)
  { term: 'مارلبورو' }, { term: 'مالبورو' }, { term: 'مارلبرو' }, { term: 'وينستون' }, { term: 'ونستون' }, { term: 'جيتان' },
  { term: 'دافيدوف' }, { term: 'روثمانز' }, { term: 'روثمان' }, { term: 'دنهل' }, { term: 'دانهل' }, { term: 'بارلمنت' }, { term: 'بارليمنت' },
  { term: 'لاكي سترايك' }, { term: 'تشيسترفيلد' }, { term: 'فيليب موريس' }, { term: 'غولواز' }, { term: 'جولواز' },
  { term: 'حمرا طويل' }, { term: 'حمراء طويل' }, { term: 'حمرا قصير' }, { term: 'حمراء قصير' }, { term: 'الف بار' }, { term: 'ايلف بار' },
]
/** Latin terms, matched as whole words (an optional plural s). */
const LAT = [
  'cigarette', 'cigar', 'cigarillo', 'tobacco', 'shisha', 'sheesha', 'hookah', 'hooka', 'hubbly', 'nargile', 'narghile', 'narguile',
  'argileh', 'arguileh', 'vape', 'vaping', 'vaper', 'e-cig', 'ecig', 'e-cigarette', 'nicotine', 'juul', 'iqos', 'heets', 'terea',
  'elfbar', 'elf bar', 'rolling paper', 'snus',
  'marlboro', 'winston', 'gauloises', 'gitanes', 'davidoff', 'rothmans', 'dunhill', 'parliament', 'pall mall', 'lucky strike',
  'chesterfield', 'camel', 'kent', 'philip morris', 'al fakher', 'alfakher', 'al-fakher', 'nakhla', 'mazaya', 'adalya', 'fumari',
  'starbuzz', 'alhamra', 'al-hamra', 'al hamra', 'esse', 'l&m', 'benson & hedges', 'benson and hedges',
]
/** Phrases that are fine even though they contain a term above. */
const EXCEPTIONS = ['كاشف دخان', 'كاشف الدخان', 'انذار دخان', 'انذار الدخان', 'جهاز دخان', 'ماكينه دخان', 'camel milk', 'camel meat', 'camel wool', 'camel hair', 'kentucky']

const ARABIC = '\\u0600-\\u06FF'
const PREFIX = '(?:ال|وال|بال|كال|فال|لل|و|ب|ك|ف|ل)?'

/** Lower-case, no diacritics, one alef, ه for ة, ي for ى, single spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
    .replace(/[^\p{L}\p{N}&\-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const AR_RE = AR.map(({ term, exact }) => ({
  term,
  re: new RegExp(`(?:^|[^${ARABIC}])${PREFIX}${normalizeText(term).replace(/ /g, '\\s+')}${exact ? '' : `[${ARABIC}]*`}(?=[^${ARABIC}]|$)`),
}))
const LAT_RE = LAT.map(term => ({ term, re: new RegExp(`(?:^|[^a-z])${normalizeText(term).replace(/[-&]/g, m => `\\${m}`).replace(/ /g, '\\s+')}s?(?=[^a-z]|$)`) }))

/** The matched tobacco term, or null when the text is fine. */
export function forbiddenMatch(text: string | undefined | null): string | null {
  if (!text) return null
  const n = normalizeText(text)
  if (!n) return null
  const clean = EXCEPTIONS.reduce((acc, ex) => acc.split(normalizeText(ex)).join(' '), n)
  for (const { term, re } of AR_RE) if (re.test(clean)) return term
  for (const { term, re } of LAT_RE) if (re.test(clean)) return term
  return null
}

/** The term that makes this product forbidden (name, notes, SKU), or null. */
export function forbiddenProduct(p: { name?: string; notes?: string; sku?: string }): string | null {
  return forbiddenMatch(p.name) ?? forbiddenMatch(p.notes) ?? forbiddenMatch(p.sku)
}
export const isForbiddenProduct = (p: { name?: string; notes?: string; sku?: string }): boolean => forbiddenProduct(p) !== null
