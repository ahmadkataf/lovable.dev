// Content policy: tobacco/smoking products and alcoholic drinks are not sold through Kaseb. The seller's rule, enforced
// wherever a product or a custom sale line gets its name (product form, quick add, purchases, CSV import, backup restore,
// onboarding) and on category names. Matching is forgiving about spelling (Arabic diacritics, alef forms, prefixes like
// ال/و/ب) but stays precise: words that merely resemble a brand (كامل, كنت, الحمراء, المازة) are matched only as Latin
// brand names or in their cigarette phrasing, a term can be cancelled by context words (كحول طبي, beer without alcohol,
// fruit cocktail, apple cider vinegar), and a few phrases are explicit exceptions (كاشف دخان, camel milk, مزيل عرق).

export type PolicyKind = 'tobacco' | 'alcohol'
interface Rule {
  term: string
  /** Arabic: no suffix letters allowed (فيب but not فيبر). Latin terms are always whole words (plural s allowed). */
  exact?: boolean
  /** When any of these words appears anywhere in the text, this term does not count. */
  unless?: string[]
}

/* ---------- tobacco ---------- */
const TOBACCO_AR: Rule[] = [
  { term: 'دخان' }, { term: 'دخاخين' }, { term: 'سجائر' }, { term: 'سجاير' }, { term: 'سكاير' }, { term: 'سكائر' }, { term: 'سيجار' }, { term: 'سيكار' }, { term: 'سيغار' },
  { term: 'تبغ' }, { term: 'تتن', exact: true }, { term: 'تنباك' }, { term: 'تمباك' }, { term: 'معسل' }, { term: 'جراك' }, { term: 'غليون' }, { term: 'سيجارة الكترونية' },
  { term: 'ارجيله' }, { term: 'اركيله' }, { term: 'نرجيله' }, { term: 'نارجيله' }, { term: 'ارجيل' }, { term: 'اركيل' }, { term: 'شيشه' }, { term: 'شيش', exact: true },
  { term: 'نيكوتين' }, { term: 'فيب', exact: true }, { term: 'فايب', exact: true }, { term: 'فيبات', exact: true }, { term: 'فيبر', exact: false, unless: ['زجاج', 'جلاس', 'الياف', 'كابل', 'انترنت', 'بصري'] },
  { term: 'ايكوس' }, { term: 'هيتس' }, { term: 'تيريا', exact: true }, { term: 'ورق لف' }, { term: 'ورق سجائر' }, { term: 'لفافه تبغ' }, { term: 'سالت نيكوتين' }, { term: 'نيك سالت' },
  { term: 'بود فيب' }, { term: 'بف بار' }, { term: 'جيك بار' }, { term: 'لوست ماري' }, { term: 'فوزول' }, { term: 'سموك', exact: true },
  // brands (Arabic spellings that are not ordinary words)
  { term: 'مارلبورو' }, { term: 'مالبورو' }, { term: 'مارلبرو' }, { term: 'مارلبورا' }, { term: 'وينستون' }, { term: 'ونستون' }, { term: 'جيتان' }, { term: 'جيتانز' },
  { term: 'دافيدوف' }, { term: 'روثمانز' }, { term: 'روثمان' }, { term: 'دنهل' }, { term: 'دانهل' }, { term: 'بارلمنت' }, { term: 'بارليمنت' }, { term: 'بارلامنت' },
  { term: 'لاكي سترايك' }, { term: 'تشيسترفيلد' }, { term: 'فيليب موريس' }, { term: 'غولواز' }, { term: 'جولواز' }, { term: 'كابتن بلاك' }, { term: 'كوهيبا' }, { term: 'مونتكريستو' },
  { term: 'حمرا طويل' }, { term: 'حمراء طويل' }, { term: 'حمرا قصير' }, { term: 'حمراء قصير' }, { term: 'الف بار' }, { term: 'ايلف بار' },
  { term: 'الفاخر معسل' }, { term: 'معسل الفاخر' }, { term: 'نخله معسل' }, { term: 'معسل نخله' }, { term: 'مزايا معسل' }, { term: 'معسل مزايا' }, { term: 'عدالية' }, { term: 'ادالية' }, { term: 'فيوماري' }, { term: 'ستاربز' },
]
const TOBACCO_LAT: Rule[] = [
  'cigarette', 'cigar', 'cigarillo', 'tobacco', 'tabac', 'shisha', 'sheesha', 'hookah', 'hooka', 'hubbly', 'nargile', 'narghile', 'narguile', 'nargileh',
  'argileh', 'arguileh', 'argila', 'vape', 'vaping', 'vaper', 'vapor pen', 'e-cig', 'ecig', 'e-cigarette', 'e-liquid', 'eliquid', 'nicotine', 'nic salt', 'salt nic',
  'juul', 'iqos', 'heets', 'terea', 'elfbar', 'elf bar', 'geek bar', 'geekbar', 'lost mary', 'vozol', 'smok', 'vaporesso', 'puff bar', 'rolling paper', 'snus', 'snuff',
  'marlboro', 'winston', 'gauloises', 'gitanes', 'davidoff', 'rothmans', 'dunhill', 'parliament', 'pall mall', 'lucky strike', 'chesterfield', 'camel', 'kent',
  'philip morris', 'silk cut', 'viceroy', 'kool', 'captain black', 'al capone', 'cohiba', 'montecristo', 'romeo y julieta', 'l&m', 'benson & hedges', 'benson and hedges',
  'esse', 'al fakher', 'alfakher', 'al-fakher', 'nakhla', 'mazaya', 'adalya', 'fumari', 'starbuzz', 'tangiers', 'serbetli', 'social smoke', 'alhamra', 'al-hamra', 'al hamra',
].map(term => ({ term }))
/* ---------- alcohol ---------- */
const NO_ALCOHOL = ['بدون كحول', 'خالي', 'خاليه', 'بلا كحول', 'غير كحولي', 'غير كحوليه', 'شعير', '0%', '0 %', 'non-alcoholic', 'non alcoholic', 'alcohol-free', 'alcohol free', 'malt', '0.0']
const MEDICAL = ['طبي', 'طبيه', 'معقم', 'تعقيم', 'مطهر', 'تطهير', 'جروح', 'سبيرتو', 'ايزوبروبيل', 'ايزو', 'جل', 'مسحات', 'مسحه', '70', '90', '95', '99',
  'medical', 'rubbing', 'isopropyl', 'antiseptic', 'disinfect', 'disinfectant', 'sanitizer', 'sanitiser', 'swab', 'pad', 'wipe', 'gel', 'ethanol', 'denatured', 'surgical', 'free', 'perfume', 'cologne', 'عطر']
const ALCOHOL_AR: Rule[] = [
  { term: 'خمر' }, { term: 'خمور' }, { term: 'خمره' }, { term: 'مسكر' }, { term: 'مسكرات' }, { term: 'مشروبات روحيه' }, { term: 'مشروب روحي' }, { term: 'كحوليه', unless: [...MEDICAL, ...NO_ALCOHOL] }, { term: 'كحولي', unless: [...MEDICAL, ...NO_ALCOHOL] },
  { term: 'كحول', unless: [...MEDICAL, ...NO_ALCOHOL] },
  { term: 'نبيذ', unless: ['خل'] }, { term: 'بيره', unless: NO_ALCOHOL }, { term: 'بيرا', unless: NO_ALCOHOL }, { term: 'جعه', exact: true, unless: NO_ALCOHOL },
  { term: 'ويسكي' }, { term: 'ويسكى' }, { term: 'فودكا' }, { term: 'تكيلا' }, { term: 'تيكيلا' }, { term: 'شمبانيا' }, { term: 'شامبانيا' }, { term: 'كونياك' }, { term: 'براندي' }, { term: 'ليكور' },
  { term: 'ابسنت' }, { term: 'سانغريا' }, { term: 'ساكي', exact: true }, { term: 'فيرموث' }, { term: 'بوربون' }, { term: 'سايدر', unless: ['خل'] },
  { term: 'عرق', exact: true, unless: ['سوس', 'مزيل', 'مضاد', 'مانع', 'عرقسوس', 'تعرق'] },
  // brands
  { term: 'هاينكن' }, { term: 'هاينيكن' }, { term: 'بدوايزر' }, { term: 'كارلسبرغ' }, { term: 'كارلسبيرغ' }, { term: 'ستيلا ارتوا' }, { term: 'امستل' }, { term: 'توبورغ' },
  { term: 'جوني ووكر' }, { term: 'جاك دانيلز' }, { term: 'شيفاس' }, { term: 'ابسولوت' }, { term: 'سميرنوف' }, { term: 'غراي غوس' }, { term: 'باكاردي' }, { term: 'كابتن مورغان' },
  { term: 'بيليز' }, { term: 'مارتيني' }, { term: 'كامباري' }, { term: 'هينيسي' }, { term: 'ريمي مارتن' }, { term: 'جيغرمايستر' }, { term: 'ياغرمايستر' },
]
const ALCOHOL_LAT: Rule[] = [
  { term: 'alcohol', unless: [...MEDICAL, ...NO_ALCOHOL] }, { term: 'alcoholic', unless: NO_ALCOHOL }, { term: 'liquor' }, { term: 'liqueur' }, { term: 'booze' },
  { term: 'wine', unless: ['vinegar', 'خل'] }, { term: 'beer', unless: [...NO_ALCOHOL, 'root', 'ginger'] }, { term: 'lager', unless: NO_ALCOHOL }, { term: 'ale', unless: NO_ALCOHOL }, { term: 'stout' },
  { term: 'cider', unless: ['vinegar', 'خل'] }, { term: 'whisky' }, { term: 'whiskey' }, { term: 'bourbon' }, { term: 'vodka' }, { term: 'gin' }, { term: 'rum' }, { term: 'tequila' },
  { term: 'mezcal' }, { term: 'brandy' }, { term: 'cognac' }, { term: 'champagne' }, { term: 'prosecco' }, { term: 'sake' }, { term: 'soju' }, { term: 'baijiu' }, { term: 'arak' }, { term: 'araq' },
  { term: 'absinthe' }, { term: 'vermouth' }, { term: 'sangria' }, { term: 'schnapps' }, { term: 'mead' }, { term: 'hard seltzer' }, { term: 'alcopop' }, { term: 'breezer' },
  { term: 'cocktail', unless: ['fruit', 'juice', 'عصير', 'فواكه', 'شرمب', 'shrimp', 'nut'] },
  // brands
  { term: 'heineken' }, { term: 'budweiser' }, { term: 'carlsberg' }, { term: 'stella artois' }, { term: 'amstel' }, { term: 'tuborg' }, { term: 'guinness' }, { term: 'almaza' }, { term: 'efes pilsen' },
  { term: 'johnnie walker' }, { term: 'johnny walker' }, { term: 'jack daniels' }, { term: "jack daniel's" }, { term: 'chivas' }, { term: 'absolut' }, { term: 'smirnoff' }, { term: 'grey goose' },
  { term: 'bacardi' }, { term: 'captain morgan' }, { term: 'jagermeister' }, { term: 'jägermeister' }, { term: 'baileys' }, { term: 'martini' }, { term: 'campari' }, { term: 'aperol' },
  { term: 'hennessy' }, { term: 'remy martin' }, { term: 'rémy martin' }, { term: 'moet' }, { term: 'moët' }, { term: 'dom perignon' }, { term: 'glenfiddich' }, { term: 'ballantines' }, { term: "ballantine's" },
]
/** Phrases that are fine even though they contain a term above (removed from the text before matching). */
const EXCEPTIONS = ['كاشف دخان', 'كاشف الدخان', 'انذار دخان', 'انذار الدخان', 'جهاز دخان', 'ماكينه دخان', 'camel milk', 'camel meat', 'camel wool', 'camel hair', 'kentucky',
  'عرق سوس', 'عرقسوس', 'عرق السوس', 'مزيل عرق', 'مزيل العرق', 'مضاد عرق', 'مضاد العرق', 'مانع عرق', 'خل نبيذ', 'خل النبيذ', 'wine vinegar', 'cider vinegar', 'root beer', 'ginger beer', 'ginger ale',
  'fruit cocktail', 'كوكتيل فواكه', 'كوكتيل فاكهه', 'rum raisin']

const ARABIC = '\\u0600-\\u06FF'
const PREFIX = '(?:ال|وال|بال|كال|فال|لل|و|ب|ك|ف|ل)?'

/** Lower-case, no diacritics, one alef, ه for ة, ي for ى, single spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
    .replace(/[^\p{L}\p{N}&\-'%.]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s)
function compile(rules: Rule[], kind: PolicyKind) {
  return rules.map(r => {
    const t = normalizeText(r.term).replace(/[-&'.]/g, m => `\\${m}`).replace(/ /g, '\\s+')
    const re = isArabic(r.term)
      ? new RegExp(`(?:^|[^${ARABIC}])${PREFIX}${t}${r.exact ? '' : `[${ARABIC}]*`}(?=[^${ARABIC}]|$)`)
      : new RegExp(`(?:^|[^a-z])${t}s?(?=[^a-z]|$)`)
    return { kind, term: r.term, re, unless: (r.unless ?? []).map(normalizeText) }
  })
}
const RULES = [...compile(TOBACCO_AR, 'tobacco'), ...compile(TOBACCO_LAT, 'tobacco'), ...compile(ALCOHOL_AR, 'alcohol'), ...compile(ALCOHOL_LAT, 'alcohol')]
const EXC = EXCEPTIONS.map(normalizeText)

/** The matched term and its kind, or null when the text is fine. */
export function policyMatch(text: string | undefined | null): { kind: PolicyKind; term: string } | null {
  if (!text) return null
  const n = normalizeText(text)
  if (!n) return null
  const clean = EXC.reduce((acc, ex) => acc.split(ex).join(' '), n)
  for (const r of RULES) {
    if (!r.re.test(clean)) continue
    if (r.unless.length && r.unless.some(u => clean.includes(u))) continue
    return { kind: r.kind, term: r.term }
  }
  return null
}
/** The matched term, or null. */
export const forbiddenMatch = (text: string | undefined | null): string | null => policyMatch(text)?.term ?? null
/** The term that makes this product forbidden (name, notes, SKU), or null. */
export function forbiddenProduct(p: { name?: string; notes?: string; sku?: string }): string | null {
  return forbiddenMatch(p.name) ?? forbiddenMatch(p.notes) ?? forbiddenMatch(p.sku)
}
export const isForbiddenProduct = (p: { name?: string; notes?: string; sku?: string }): boolean => forbiddenProduct(p) !== null
