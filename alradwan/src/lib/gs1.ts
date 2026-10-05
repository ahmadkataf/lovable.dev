// What a scanned code means: product numbers (EAN/UPC/GTIN) with their check digit, GS1 codes that carry
// several fields (product number, batch, expiry, serial…) in Data Matrix, GS1-128, DataBar or QR "Digital
// Link" form, and where a product number was registered. All offline.

const GS = '\x1d'

/** GS1 modulo-10 check digit of the digits before it. */
export function gs1CheckDigit(body: string): number {
  let sum = 0
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w
  return (10 - (sum % 10)) % 10
}
export function validGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false
  return gs1CheckDigit(code.slice(0, -1)) === Number(code[code.length - 1])
}

/** UPC-E (8 digits, number system 0 or 1) to its UPC-A (12 digits); null when it is not a UPC-E. */
export function upcEtoA(e: string): string | null {
  if (!/^[01]\d{7}$/.test(e)) return null
  const ns = e[0], d = e.slice(1, 7), check = e[7]
  const last = d[5]
  let body: string
  if (last <= '2') body = d.slice(0, 2) + last + '0000' + d.slice(2, 5)
  else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5)
  else if (last === '4') body = d.slice(0, 4) + '00000' + d[4]
  else body = d.slice(0, 5) + '0000' + last
  const a = ns + body + check
  return validGtin(a) ? a : null
}

/** Every product-number key a code could stand for (an 8-digit code can be read as UPC-E or EAN-8). */
export function gtinKeys(code: string): string[] {
  const c = code.replace(/[\s-]/g, '')
  const keys = new Set<string>()
  const main = gtin14(c)
  if (main) keys.add(main)
  if (/^\d{8}$/.test(c) && validGtin(c)) keys.add(c.padStart(14, '0'))
  return [...keys]
}

/** One key for a product number whatever its length: GTIN-14 (EAN-8/13, UPC-A/E, ITF-14), else null. */
export function gtin14(code: string): string | null {
  const c = code.replace(/[\s-]/g, '')
  if (/^\d{8}$/.test(c)) {
    // UPC-E always starts with 0 or 1, and EAN-8 numbers starting with 0/1 are shop-internal: prefer UPC-E
    const a = upcEtoA(c)
    if (a) return a.padStart(14, '0')
    return validGtin(c) ? c.padStart(14, '0') : null
  }
  if (/^\d{12,14}$/.test(c) && validGtin(c)) return c.padStart(14, '0')
  return null
}

export interface Gs1Field { ai: string; label: string; value: string }
interface AiDef { len?: number; max: number; label: string; date?: boolean }

// Application Identifiers a parts shop may meet (GS1 General Specifications, section 3). Fixed-length ones
// carry `len`; the others end at the group separator.
const AI: Record<string, AiDef> = {
  '00': { len: 18, max: 18, label: 'رقم الشحنة SSCC' },
  '01': { len: 14, max: 14, label: 'رقم المنتج GTIN' },
  '02': { len: 14, max: 14, label: 'رقم المنتج داخل الكرتونة' },
  '10': { max: 20, label: 'رقم الدفعة (Batch/Lot)' },
  '11': { len: 6, max: 6, label: 'تاريخ الإنتاج', date: true },
  '12': { len: 6, max: 6, label: 'تاريخ الاستحقاق', date: true },
  '13': { len: 6, max: 6, label: 'تاريخ التعبئة', date: true },
  '15': { len: 6, max: 6, label: 'يُفضّل قبل', date: true },
  '16': { len: 6, max: 6, label: 'تاريخ البيع الأقصى', date: true },
  '17': { len: 6, max: 6, label: 'تاريخ الانتهاء', date: true },
  '20': { len: 2, max: 2, label: 'نوع المنتج' },
  '21': { max: 20, label: 'الرقم التسلسلي' },
  '22': { max: 20, label: 'رقم إضافي' },
  '240': { max: 30, label: 'رقم إضافي للمنتج' },
  '241': { max: 30, label: 'رقم القطعة عند الزبون' },
  '250': { max: 30, label: 'رقم تسلسلي ثانوي' },
  '30': { max: 8, label: 'العدد' },
  '37': { max: 8, label: 'عدد الوحدات' },
  '400': { max: 30, label: 'رقم طلب الشراء' },
  '401': { max: 30, label: 'رقم الشحنة' },
  '403': { max: 30, label: 'رمز التوجيه' },
  '410': { len: 13, max: 13, label: 'الشحن إلى (GLN)' },
  '414': { len: 13, max: 13, label: 'الموقع (GLN)' },
  '420': { max: 20, label: 'الرمز البريدي' },
  '422': { len: 3, max: 3, label: 'بلد المنشأ (رمز)' },
  '7003': { len: 10, max: 10, label: 'تاريخ الانتهاء والوقت' },
  '8008': { max: 12, label: 'تاريخ ووقت الإنتاج' },
  '90': { max: 30, label: 'معلومات داخلية' },
}
// 31nn–36nn: measures (weight, length…) with nn = unit and decimals, 6 digits each
for (let a = 310; a <= 369; a++) for (let d = 0; d <= 9; d++) AI[`${a}${d}`] = { len: 6, max: 6, label: `قياس (${a}${d})` }
for (let a = 91; a <= 99; a++) AI[String(a)] = { max: 90, label: 'معلومات الشركة' }

function aiAt(s: string, i: number): string | null {
  for (const n of [2, 3, 4]) { const k = s.slice(i, i + n); if (AI[k]) return k }
  return null
}
const fmtDate = (v: string) => (/^\d{6}$/.test(v) ? `20${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6) === '00' ? '28' : v.slice(4, 6)}` : v)

/** Reads a GS1 element string: "(01)…(17)…", raw with group separators, or a GS1 Digital Link URL. */
export function parseGs1(raw: string): Gs1Field[] | null {
  const s = raw.trim()
  const out: Gs1Field[] = []
  const push = (ai: string, value: string) => { const d = AI[ai]; out.push({ ai, label: d?.label ?? `AI ${ai}`, value: d?.date ? fmtDate(value) : value }) }
  // (01)09501101530003(17)271231
  if (/^\(\d{2,4}\)/.test(s)) {
    const re = /\((\d{2,4})\)([^(]*)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) push(m[1], m[2])
    return out.length ? out : null
  }
  // https://id.gs1.org/01/09501101530003/10/AB12?17=271231  (any domain)
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent)
      const at = parts.findIndex((p, i) => /^(00|01|8003|8004|8006|8010|8013|8017|8018|414|417)$/.test(p) && i + 1 < parts.length)
      if (at < 0) return null
      for (let i = at; i + 1 < parts.length; i += 2) if (/^\d{2,4}$/.test(parts[i])) push(parts[i], parts[i + 1])
      u.searchParams.forEach((v, k) => { if (/^\d{2,4}$/.test(k)) push(k, v) })
      return out.length ? out : null
    } catch { return null }
  }
  // raw: only when it starts with a known AI and the first field has the right shape
  const t = s.replace(/^\x1d/, '')
  if (!/^\d{2}/.test(t)) return null
  let i = 0
  while (i < t.length) {
    const ai = aiAt(t, i)
    if (!ai) return out.length ? out : null
    i += ai.length
    const d = AI[ai]
    let v: string
    if (d.len) { v = t.slice(i, i + d.len); if (v.length < d.len) return out.length ? out : null; i += d.len }
    else { const end = t.indexOf(GS, i); v = t.slice(i, end < 0 ? t.length : end); i = end < 0 ? t.length : end }
    if (t[i] === GS) i++
    // a product or shipment number with a wrong check digit means this is not GS1 data after all
    if ((ai === '01' || ai === '02') && !validGtin(v)) return null
    if (ai === '00' && gs1CheckDigit(v.slice(0, 17)) !== Number(v[17])) return null
    push(ai, v)
  }
  // a bare 14-digit number is a GTIN, not a GS1 element string
  return out.length >= 1 && (out.length > 1 || t.includes(GS) || t.length > 16) ? out : null
}

/** The product number inside any scanned code: GS1 (01), Digital Link, or the code itself. */
export function productNumber(text: string): string | null {
  const g = parseGs1(text)
  const v = g?.find(f => f.ai === '01' || f.ai === '02')?.value
  if (v) return gtin14(v)
  return gtin14(text)
}

// GS1 member organisations: who issued the company prefix (not always where the product was made).
const PREFIX: [number, number, string][] = [
  [0, 19, 'الولايات المتحدة وكندا'], [30, 39, 'الولايات المتحدة'], [60, 139, 'الولايات المتحدة وكندا'],
  [200, 299, 'رمز داخلي للمتجر'], [300, 379, 'فرنسا'], [380, 380, 'بلغاريا'], [383, 383, 'سلوفينيا'], [385, 385, 'كرواتيا'], [387, 387, 'البوسنة والهرسك'], [389, 389, 'الجبل الأسود'],
  [400, 440, 'ألمانيا'], [450, 459, 'اليابان'], [460, 469, 'روسيا'], [470, 470, 'قرغيزستان'], [471, 471, 'تايوان'], [474, 474, 'إستونيا'], [475, 475, 'لاتفيا'], [476, 476, 'أذربيجان'],
  [477, 477, 'ليتوانيا'], [478, 478, 'أوزبكستان'], [479, 479, 'سريلانكا'], [480, 480, 'الفلبين'], [481, 481, 'بيلاروسيا'], [482, 482, 'أوكرانيا'], [483, 483, 'تركمانستان'], [484, 484, 'مولدوفا'],
  [485, 485, 'أرمينيا'], [486, 486, 'جورجيا'], [487, 487, 'كازاخستان'], [488, 488, 'طاجيكستان'], [489, 489, 'هونغ كونغ'], [490, 499, 'اليابان'], [500, 509, 'المملكة المتحدة'], [520, 521, 'اليونان'],
  [528, 528, 'لبنان'], [529, 529, 'قبرص'], [530, 530, 'ألبانيا'], [531, 531, 'مقدونيا الشمالية'], [535, 535, 'مالطا'], [539, 539, 'إيرلندا'], [540, 549, 'بلجيكا ولوكسمبورغ'], [560, 560, 'البرتغال'],
  [569, 569, 'آيسلندا'], [570, 579, 'الدنمارك'], [590, 590, 'بولندا'], [594, 594, 'رومانيا'], [599, 599, 'المجر'], [600, 601, 'جنوب أفريقيا'], [603, 603, 'غانا'], [604, 604, 'السنغال'],
  [608, 608, 'البحرين'], [609, 609, 'موريشيوس'], [611, 611, 'المغرب'], [613, 613, 'الجزائر'], [615, 615, 'نيجيريا'], [616, 616, 'كينيا'], [618, 618, 'ساحل العاج'], [619, 619, 'تونس'],
  [620, 620, 'تنزانيا'], [621, 621, 'سوريا'], [622, 622, 'مصر'], [623, 623, 'بروناي'], [624, 624, 'ليبيا'], [625, 625, 'الأردن'], [626, 626, 'إيران'], [627, 627, 'الكويت'], [628, 628, 'السعودية'],
  [629, 629, 'الإمارات'], [630, 630, 'قطر'], [631, 631, 'ناميبيا'], [640, 649, 'فنلندا'], [690, 699, 'الصين'], [700, 709, 'النرويج'], [729, 729, 'إسرائيل'], [730, 739, 'السويد'],
  [740, 740, 'غواتيمالا'], [741, 741, 'السلفادور'], [742, 742, 'هندوراس'], [743, 743, 'نيكاراغوا'], [744, 744, 'كوستاريكا'], [745, 745, 'بنما'], [746, 746, 'الدومينيكان'], [750, 750, 'المكسيك'],
  [754, 755, 'كندا'], [759, 759, 'فنزويلا'], [760, 769, 'سويسرا'], [770, 771, 'كولومبيا'], [773, 773, 'الأوروغواي'], [775, 775, 'البيرو'], [777, 777, 'بوليفيا'], [778, 779, 'الأرجنتين'],
  [780, 780, 'تشيلي'], [784, 784, 'باراغواي'], [786, 786, 'الإكوادور'], [789, 790, 'البرازيل'], [800, 839, 'إيطاليا'], [840, 849, 'إسبانيا'], [850, 850, 'كوبا'], [858, 858, 'سلوفاكيا'],
  [859, 859, 'التشيك'], [860, 860, 'صربيا'], [865, 865, 'منغوليا'], [867, 867, 'كوريا الشمالية'], [868, 869, 'تركيا'], [870, 879, 'هولندا'], [880, 881, 'كوريا الجنوبية'], [883, 883, 'ميانمار'],
  [884, 884, 'كمبوديا'], [885, 885, 'تايلاند'], [888, 888, 'سنغافورة'], [890, 890, 'الهند'], [893, 893, 'فيتنام'], [894, 894, 'بنغلاديش'], [896, 896, 'باكستان'], [899, 899, 'إندونيسيا'],
  [900, 919, 'النمسا'], [930, 939, 'أستراليا'], [940, 949, 'نيوزيلندا'], [955, 955, 'ماليزيا'], [958, 958, 'ماكاو'], [977, 977, 'دوريات (ISSN)'], [978, 979, 'كتب (ISBN)'],
]
/** Who issued the number's company prefix (GS1 member organisation), for EAN-13/UPC/GTIN. */
export function gs1Country(code: string): string | null {
  const g = gtin14(code)
  if (!g) return null
  // a GTIN-12 (UPC) sits after two leading zeros; EAN-13 after one
  const thirteen = g.slice(1)
  const p = Number(thirteen.slice(0, 3))
  if (g.startsWith('00000')) return null
  const hit = PREFIX.find(([a, b]) => p >= a && p <= b)
  return hit ? hit[2] : null
}

/** A short description of a scan for the user: type, validity, origin, GS1 fields. */
export interface CodeFacts { gtin: string | null; validCheckDigit: boolean | null; country: string | null; gs1: Gs1Field[] | null; looksLikePartNumber: boolean }
export function codeFacts(text: string): CodeFacts {
  const gs1 = parseGs1(text)
  const gtin = productNumber(text)
  const digits = text.replace(/[\s-]/g, '')
  const validCheckDigit = /^\d{8}$|^\d{12,14}$/.test(digits) ? !!gtin14(digits) : gtin ? true : null
  return {
    gtin, validCheckDigit, gs1,
    country: gtin ? gs1Country(gtin) : null,
    // letters and digits with dashes/dots/slashes, not a product number: a manufacturer's part number
    looksLikePartNumber: !gtin && !gs1 && /^[A-Za-z0-9][A-Za-z0-9 .\-/]{3,30}$/.test(text.trim()) && /\d/.test(text) && !/^https?:/i.test(text),
  }
}
