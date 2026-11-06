// What a scanned code means: product numbers (EAN/UPC/GTIN) with their check digit, GS1 codes that carry
// several fields (product number, batch, expiry, serial…) in Data Matrix, GS1-128, DataBar or QR "Digital
// Link" form, where a product number was registered, and which parts maker it belongs to. All offline.

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

/** One GS1 field. `value` is ready to show (dates as YYYY-MM-DD, measures with their decimal point,
 *  countries by name); `raw` keeps the digits as scanned when they differ. */
export interface Gs1Field { ai: string; label: string; value: string; raw?: string }
type Kind = 'date' | 'datetime' | 'dates' | 'measure' | 'amount' | 'amountCcy' | 'country' | 'countries' | 'postal'
interface AiDef { min?: number; max: number; num?: boolean; label: string; kind?: Kind }

// Application Identifiers a parts shop may meet (GS1 General Specifications, section 3). `min`/`max` are the
// data length, `num` means digits only. Where a field ends is not taken from here but from PREDEFINED.
const AI: Record<string, AiDef> = {
  '00': { max: 18, num: true, label: 'رقم الشحنة SSCC' },
  '01': { max: 14, num: true, label: 'رقم المنتج GTIN' },
  '02': { max: 14, num: true, label: 'رقم المنتج داخل الكرتونة' },
  '03': { max: 14, num: true, label: 'رقم المنتج المصنوع حسب الطلب' },
  '10': { max: 20, label: 'رقم الدفعة (Batch/Lot)' },
  '11': { max: 6, num: true, label: 'تاريخ الإنتاج', kind: 'date' },
  '12': { max: 6, num: true, label: 'تاريخ الاستحقاق', kind: 'date' },
  '13': { max: 6, num: true, label: 'تاريخ التعبئة', kind: 'date' },
  '15': { max: 6, num: true, label: 'يُفضّل قبل', kind: 'date' },
  '16': { max: 6, num: true, label: 'تاريخ البيع الأقصى', kind: 'date' },
  '17': { max: 6, num: true, label: 'تاريخ الانتهاء', kind: 'date' },
  '20': { max: 2, num: true, label: 'نوع المنتج' },
  '21': { max: 20, label: 'الرقم التسلسلي' },
  '22': { max: 20, label: 'متغيّر المنتج (CPV)' },
  '235': { max: 28, label: 'رقم منتج من طرف آخر (TPX)' },
  '240': { max: 30, label: 'رقم إضافي للمنتج (رقم القطعة)' },
  '241': { max: 30, label: 'رقم القطعة عند الزبون' },
  '242': { max: 6, num: true, label: 'رقم نوع الطلب الخاص' },
  '243': { max: 20, label: 'رقم مكوّن التغليف' },
  '250': { max: 30, label: 'رقم تسلسلي ثانوي' },
  '251': { max: 30, label: 'مرجع إلى المصدر' },
  '253': { min: 13, max: 30, label: 'رقم المستند (GDTI)' },
  '254': { max: 20, label: 'امتداد رقم الموقع' },
  '255': { min: 13, max: 25, num: true, label: 'رقم القسيمة (GCN)' },
  '30': { max: 8, num: true, label: 'العدد' },
  '37': { max: 8, num: true, label: 'عدد الوحدات' },
  '400': { max: 30, label: 'رقم طلب الشراء' },
  '401': { max: 30, label: 'رقم الشحنة (GINC)' },
  '402': { min: 17, max: 17, num: true, label: 'رقم الإرسالية (GSIN)' },
  '403': { max: 30, label: 'رمز التوجيه' },
  '410': { max: 13, num: true, label: 'الشحن إلى (GLN)' },
  '411': { max: 13, num: true, label: 'إرسال الفاتورة إلى (GLN)' },
  '412': { max: 13, num: true, label: 'المورّد (GLN)' },
  '413': { max: 13, num: true, label: 'الشحن لصالح (GLN)' },
  '414': { max: 13, num: true, label: 'الموقع (GLN)' },
  '415': { max: 13, num: true, label: 'مُصدر الفاتورة (GLN)' },
  '416': { max: 13, num: true, label: 'موقع الإنتاج (GLN)' },
  '417': { max: 13, num: true, label: 'الجهة (GLN)' },
  '420': { max: 20, label: 'الرمز البريدي' },
  '421': { min: 4, max: 12, label: 'الرمز البريدي مع البلد', kind: 'postal' },
  '422': { min: 3, max: 3, num: true, label: 'بلد المنشأ', kind: 'country' },
  '423': { min: 3, max: 15, num: true, label: 'بلد المعالجة الأولية', kind: 'countries' },
  '424': { min: 3, max: 3, num: true, label: 'بلد المعالجة', kind: 'country' },
  '425': { min: 3, max: 15, num: true, label: 'بلد التفكيك', kind: 'countries' },
  '426': { min: 3, max: 3, num: true, label: 'بلد المعالجة الكاملة', kind: 'country' },
  '427': { max: 3, label: 'منطقة المنشأ' },
  '7001': { min: 13, max: 13, num: true, label: 'رقم الناتو للمواد (NSN)' },
  '7002': { max: 30, label: 'تصنيف اللحوم' },
  '7003': { min: 10, max: 10, num: true, label: 'تاريخ ووقت الانتهاء', kind: 'datetime' },
  '7004': { max: 4, num: true, label: 'الفعالية' },
  '7005': { max: 12, label: 'منطقة الصيد' },
  '7006': { min: 6, max: 6, num: true, label: 'تاريخ أول تجميد', kind: 'date' },
  '7007': { min: 6, max: 12, num: true, label: 'تاريخ الحصاد', kind: 'dates' },
  '7008': { max: 3, label: 'نوع الأسماك' },
  '7009': { max: 10, label: 'أداة الصيد' },
  '7010': { max: 2, label: 'طريقة الإنتاج' },
  '7020': { max: 20, label: 'رقم دفعة التجديد' },
  '7021': { max: 20, label: 'الحالة الوظيفية' },
  '7022': { max: 20, label: 'حالة المراجعة' },
  '7023': { max: 30, label: 'رقم التجميعة (GIAI)' },
  '8001': { min: 14, max: 14, num: true, label: 'أبعاد اللفّة' },
  '8002': { max: 20, label: 'رقم الهاتف الخلوي' },
  '8003': { min: 14, max: 30, label: 'رقم الأصل القابل للإرجاع (GRAI)' },
  '8004': { max: 30, label: 'رقم الأصل (GIAI)' },
  '8005': { min: 6, max: 6, num: true, label: 'سعر وحدة القياس' },
  '8006': { min: 18, max: 18, num: true, label: 'رقم مكوّن المنتج (ITIP)' },
  '8007': { max: 34, label: 'رقم الحساب المصرفي (IBAN)' },
  '8008': { min: 8, max: 12, num: true, label: 'تاريخ ووقت الإنتاج', kind: 'datetime' },
  '8010': { max: 30, label: 'رقم المكوّن (CPID)' },
  '8011': { max: 12, num: true, label: 'الرقم التسلسلي للمكوّن' },
  '8012': { max: 20, label: 'إصدار البرنامج' },
  '8013': { max: 25, label: 'رقم الطراز (GMN)' },
  '8017': { min: 18, max: 18, num: true, label: 'رقم علاقة الخدمة (GSRN)' },
  '8018': { min: 18, max: 18, num: true, label: 'رقم علاقة الخدمة (GSRN)' },
  '8019': { max: 10, num: true, label: 'رقم حالة الخدمة' },
  '8020': { max: 25, label: 'رقم مرجع الدفع' },
  '8200': { max: 70, label: 'رابط المنتج' },
  '90': { max: 30, label: 'معلومات متفق عليها' },
}
// 31nn–36nn: measures, 6 digits; the first three digits give what and in which unit, the 4th the decimals
const MEASURE: Record<string, string> = {
  '310': 'الوزن الصافي (كغ)', '311': 'الطول (م)', '312': 'العرض (م)', '313': 'الارتفاع (م)', '314': 'المساحة (م²)', '315': 'الحجم الصافي (لتر)', '316': 'الحجم الصافي (م³)',
  '320': 'الوزن الصافي (رطل)', '321': 'الطول (إنش)', '322': 'الطول (قدم)', '323': 'الطول (ياردة)', '324': 'العرض (إنش)', '325': 'العرض (قدم)', '326': 'العرض (ياردة)',
  '327': 'الارتفاع (إنش)', '328': 'الارتفاع (قدم)', '329': 'الارتفاع (ياردة)', '330': 'الوزن الإجمالي (كغ)', '331': 'طول الطرد (م)', '332': 'عرض الطرد (م)', '333': 'ارتفاع الطرد (م)',
  '334': 'مساحة الطرد (م²)', '335': 'الحجم الإجمالي (لتر)', '336': 'الحجم الإجمالي (م³)', '337': 'كغ لكل م²', '340': 'الوزن الإجمالي (رطل)', '341': 'طول الطرد (إنش)', '342': 'طول الطرد (قدم)',
  '343': 'طول الطرد (ياردة)', '344': 'عرض الطرد (إنش)', '345': 'عرض الطرد (قدم)', '346': 'عرض الطرد (ياردة)', '347': 'ارتفاع الطرد (إنش)', '348': 'ارتفاع الطرد (قدم)', '349': 'ارتفاع الطرد (ياردة)',
  '350': 'المساحة (إنش²)', '351': 'المساحة (قدم²)', '352': 'المساحة (ياردة²)', '353': 'مساحة الطرد (إنش²)', '354': 'مساحة الطرد (قدم²)', '355': 'مساحة الطرد (ياردة²)', '356': 'الوزن الصافي (أونصة تروي)',
  '357': 'الوزن أو الحجم الصافي (أونصة)', '360': 'الحجم الصافي (كوارت)', '361': 'الحجم الصافي (غالون)', '362': 'الحجم الإجمالي (كوارت)', '363': 'الحجم الإجمالي (غالون)', '364': 'الحجم الصافي (إنش³)',
  '365': 'الحجم الصافي (قدم³)', '366': 'الحجم الصافي (ياردة³)', '367': 'الحجم الإجمالي (إنش³)', '368': 'الحجم الإجمالي (قدم³)', '369': 'الحجم الإجمالي (ياردة³)',
}
for (const [a, label] of Object.entries(MEASURE)) for (let d = 0; d <= 5; d++) AI[`${a}${d}`] = { max: 6, num: true, label, kind: 'measure' }
// 390n/392n: amount payable and price; 391n/393n start with the ISO 4217 currency number. n = decimals
for (let d = 0; d <= 9; d++) {
  AI[`390${d}`] = { max: 15, num: true, label: 'المبلغ المستحق', kind: 'amount' }
  AI[`391${d}`] = { min: 4, max: 18, num: true, label: 'المبلغ المستحق', kind: 'amountCcy' }
  AI[`392${d}`] = { max: 15, num: true, label: 'السعر', kind: 'amount' }
  AI[`393${d}`] = { min: 4, max: 18, num: true, label: 'السعر', kind: 'amountCcy' }
}
for (let a = 91; a <= 99; a++) AI[String(a)] = { max: 90, label: 'معلومات الشركة' }

// GS1 Table 7-6: only AIs starting with these two digits have a predefined length (here AI + data) and need no
// separator. Every other AI ends at <GS> or at the end, even when its format is fixed (422, 7003, 8006…).
const PREDEFINED: Record<string, number> = {
  '00': 20, '01': 16, '02': 16, '03': 16, '04': 18, '11': 8, '12': 8, '13': 8, '14': 8, '15': 8, '16': 8, '17': 8, '18': 8, '19': 8,
  '20': 4, '31': 10, '32': 10, '33': 10, '34': 10, '35': 10, '36': 10, '41': 16,
}
const predefinedLength = (ai: string) => (PREDEFINED[ai.slice(0, 2)] ? PREDEFINED[ai.slice(0, 2)] - ai.length : 0)

function aiAt(s: string, i: number): string | null {
  for (const n of [2, 3, 4]) { const k = s.slice(i, i + n); if (AI[k]) return k }
  return null
}
/** Whether a value has the length and characters its AI allows. */
function fits(ai: string, v: string): boolean {
  const d = AI[ai], n = predefinedLength(ai)
  if (n) return v.length === n && /^\d+$/.test(v)
  return v.length >= (d.min ?? 1) && v.length <= d.max && (!d.num || /^\d+$/.test(v))
}

// ISO 3166-1 numeric codes (AI 421–426) of the countries parts usually come from
const ISO_COUNTRY: Record<string, string> = {
  '760': 'سوريا', '792': 'تركيا', '156': 'الصين', '276': 'ألمانيا', '410': 'كوريا الجنوبية', '392': 'اليابان', '250': 'فرنسا', '380': 'إيطاليا',
  '840': 'الولايات المتحدة', '784': 'الإمارات', '682': 'السعودية', '818': 'مصر', '364': 'إيران', '356': 'الهند', '158': 'تايوان', '764': 'تايلاند',
  '400': 'الأردن', '422': 'لبنان', '368': 'العراق', '724': 'إسبانيا', '826': 'المملكة المتحدة', '203': 'التشيك', '616': 'بولندا', '528': 'هولندا',
  '056': 'بلجيكا', '752': 'السويد', '643': 'روسيا', '076': 'البرازيل', '484': 'المكسيك', '036': 'أستراليا', '360': 'إندونيسيا', '458': 'ماليزيا',
  '704': 'فيتنام', '040': 'النمسا', '756': 'سويسرا', '348': 'المجر', '642': 'رومانيا', '703': 'سلوفاكيا', '705': 'سلوفينيا', '620': 'البرتغال',
  '124': 'كندا', '586': 'باكستان', '710': 'جنوب أفريقيا', '414': 'الكويت', '634': 'قطر', '512': 'عُمان', '048': 'البحرين', '788': 'تونس', '504': 'المغرب',
}
/** Arabic name of an ISO 3166-1 numeric country code (as in GS1 AI 422 "country of origin"), or null. */
export function isoCountryName(code: string): string | null {
  return /^\d{1,3}$/.test(code) ? ISO_COUNTRY[code.padStart(3, '0')] ?? null : null
}
const CURRENCY: Record<string, string> = {
  '760': 'SYP', '840': 'USD', '978': 'EUR', '949': 'TRY', '784': 'AED', '682': 'SAR', '400': 'JOD', '422': 'LBP', '818': 'EGP', '368': 'IQD', '826': 'GBP', '156': 'CNY',
}

const two = (n: number) => String(n).padStart(2, '0')
/** A GS1 YYMMDD date as YYYY-MM-DD, or null when it is not a date. The century follows GS1 General
 *  Specifications §7.12 (49 years back to 50 ahead of `now`); day 00 means the last day of the month. */
export function gs1Date(yymmdd: string, now: Date = new Date()): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null
  const yy = Number(yymmdd.slice(0, 2)), mm = Number(yymmdd.slice(2, 4)), dd = Number(yymmdd.slice(4, 6))
  if (mm < 1 || mm > 12) return null
  const year = now.getFullYear(), diff = yy - (year % 100)
  const y = (Math.floor(year / 100) + (diff >= 51 ? -1 : diff <= -50 ? 1 : 0)) * 100 + yy
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate()
  if (dd > last) return null
  return `${y}-${two(mm)}-${two(dd || last)}`
}
/** YYMMDD followed by HH, MM and SS (as many as there are) as "YYYY-MM-DD HH:MM[:SS]". */
function gs1DateTime(v: string): string | null {
  const date = gs1Date(v.slice(0, 6)), t: string[] = v.slice(6).match(/\d\d/g) ?? []
  if (!date || v.length % 2 || !t[0] || +t[0] > 24 || t.slice(1).some(x => +x > 59)) return null
  return `${date} ${t.length === 1 ? `${t[0]}:00` : t.join(':')}`
}
/** Digits with the last `d` of them after the decimal point: ('001234', 2) → '12.34'. */
function decimal(v: string, d: number): string {
  const p = v.padStart(d + 1, '0')
  const whole = p.slice(0, p.length - d).replace(/^0+(?=\d)/, '')
  return d ? `${whole}.${p.slice(p.length - d)}` : whole
}
/** The value to show for a field, or null when it does not have the shape its AI needs. */
function format(ai: string, v: string): string | null {
  switch (AI[ai]?.kind) {
    case 'date': return gs1Date(v)
    case 'datetime': return gs1DateTime(v)
    case 'dates': {
      if (v.length !== 6 && v.length !== 12) return null
      const a = gs1Date(v.slice(0, 6)), b = v.length === 12 ? gs1Date(v.slice(6)) : a
      return a && b ? (a === b ? a : `${a} – ${b}`) : null
    }
    case 'measure': case 'amount': return decimal(v, Number(ai[3]))
    case 'amountCcy': return `${decimal(v.slice(3), Number(ai[3]))} ${CURRENCY[v.slice(0, 3)] ?? v.slice(0, 3)}`
    case 'country': return isoCountryName(v) ?? v
    case 'countries': return /^(\d{3})+$/.test(v) ? v.match(/\d{3}/g)!.map(c => isoCountryName(c) ?? c).join('، ') : null
    case 'postal': return /^\d{3}/.test(v) ? `${isoCountryName(v.slice(0, 3)) ?? v.slice(0, 3)} ${v.slice(3)}` : null
    default: return v
  }
}
// a value without the shape its AI needs (bracketed or Digital Link) is shown as it was written
function field(ai: string, raw: string, value = (AI[ai] && fits(ai, raw) ? format(ai, raw) : null) ?? raw): Gs1Field {
  return { ai, label: AI[ai]?.label ?? `AI ${ai}`, value, ...(value !== raw ? { raw } : {}) }
}

// Digital Link primary keys: the first of these in the path (after any prefix) starts the AI/value pairs
const DL_KEYS = new Set(['00', '01', '253', '255', '401', '402', '414', '415', '417', '8003', '8004', '8006', '8010', '8013', '8017', '8018'])
const decode = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }
/** A Digital Link primary key's value as it should be stored (GTIN padded to 14), or null when it is not one. */
function dlKey(ai: string, v: string): string | null {
  if (ai === '01') return /^\d{8}$|^\d{12,14}$/.test(v) && validGtin(v) ? v.padStart(14, '0') : null
  if (ai === '00') return /^\d{18}$/.test(v) && gs1CheckDigit(v.slice(0, 17)) === Number(v[17]) ? v : null
  return fits(ai, v) ? v : null
}
function parseDigitalLink(s: string): Gs1Field[] | null {
  let u: URL
  try { u = new URL(s) } catch { return null }
  const parts = u.pathname.split('/').filter(Boolean).map(decode)
  const at = parts.findIndex((p, i) => DL_KEYS.has(p) && i + 1 < parts.length && dlKey(p, parts[i + 1]) !== null)
  if (at < 0) return null
  const out = [field(parts[at], dlKey(parts[at], parts[at + 1])!)]
  for (let i = at + 2; i + 1 < parts.length && /^\d{2,4}$/.test(parts[i]); i += 2) out.push(field(parts[i], parts[i + 1]))
  // attributes: ?17=271231&10=AB12 (";" also separates them); other parameters such as linkType are not AIs
  for (const pair of u.search.slice(1).split(/[&;]/)) {
    const eq = pair.indexOf('=')
    const k = decode(pair.slice(0, eq)), v = decode(pair.slice(eq + 1).replace(/\+/g, ' '))
    if (eq > 0 && /^\d{2,4}$/.test(k) && v) out.push(field(k, v))
  }
  return out
}

/** A GS1 reading: its fields, and whether all of it was understood (false when an unknown AI or a malformed
 *  field stopped the reading, so later fields may be missing). */
export interface Gs1Parse { fields: Gs1Field[]; complete: boolean }

/** Reads a GS1 element string: "(01)…(17)…", raw with group separators, or a GS1 Digital Link URL. */
export function parseGs1Detailed(raw: string): Gs1Parse | null {
  let s = raw.trim()
  // a reader's GS1 symbology identifier; GS1 QR Code may use "%" as the separator
  const aim = /^\](C1|e0|d2|Q3|J1|d1|Q1)/.exec(s)
  if (aim) s = s.slice(3)
  // (01)09501101530003(17)271231
  if (/^\(\d{2,4}\)/.test(s)) {
    const out: Gs1Field[] = []
    const re = /\((\d{2,4})\)([^(]*)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) out.push(field(m[1], m[2]))
    return out.length ? { fields: out, complete: true } : null
  }
  // https://id.gs1.org/01/09501101530003/10/AB12?17=271231  (any domain, any path before the key)
  if (/^https?:\/\//i.test(s)) {
    const out = parseDigitalLink(s)
    return out ? { fields: out, complete: true } : null
  }
  // raw: only when it starts with a known AI and the first field has the right shape
  const t = s.replace(/^\x1d+/, '')
  if (!/^\d{2}/.test(t)) return null
  // a bare EAN/UPC/GTIN is a product number, not a GS1 element string
  if (/^\d{8,14}$/.test(t) && validGtin(t)) return null
  const out: Gs1Field[] = []
  let complete = true, i = 0
  while (i < t.length) {
    const ai = aiAt(t, i)
    if (!ai) { complete = false; break }
    i += ai.length
    const n = predefinedLength(ai)
    let v: string
    if (n) { v = t.slice(i, i + n); i += n; if (t[i] === GS) i++ }
    else { const end = t.indexOf(GS, i); v = t.slice(i, end < 0 ? t.length : end); i = end < 0 ? t.length : end + 1 }
    // a product or shipment number with a wrong check digit means this is not GS1 data after all
    if (/^0[123]$/.test(ai) && /^\d{14}$/.test(v) && !validGtin(v)) return null
    if (ai === '00' && /^\d{18}$/.test(v) && gs1CheckDigit(v.slice(0, 17)) !== Number(v[17])) return null
    const value = fits(ai, v) ? format(ai, v) : null
    if (value === null) { complete = false; break }
    out.push(field(ai, v, value))
  }
  if (!out.length) return null
  // a short run of digits that happens to start like an AI is not GS1 data either; a lone (01)/(02)/(03) with
  // a right check digit is (GS1 DataBar, or a carton label carrying only the product number)
  return out.length > 1 || t.includes(GS) || t.length > 16 || (complete && /^0[123]$/.test(out[0].ai)) ? { fields: out, complete } : null
}
/** The fields of a GS1 code (see parseGs1Detailed), or null when the code is not GS1 data. */
export function parseGs1(raw: string): Gs1Field[] | null {
  return parseGs1Detailed(raw)?.fields ?? null
}

/** The product number inside any scanned code: GS1 (01), Digital Link, or the code itself. */
export function productNumber(text: string): string | null {
  const g = parseGs1(text)
  const v = g?.find(f => f.ai === '01' || f.ai === '02')?.value
  if (v) return gtin14(v)
  return gtin14(text)
}

// GS1 member organisations: who issued the company prefix (not where the product was made; GS1 says so
// itself). Official GS1 list, October 2026. null: a shop's or region's own numbers, coupons, refund receipts,
// numbers kept by GS1 Global Office, reserved.
const US = 'الولايات المتحدة'
const PREFIX: [number, number, string | null][] = [
  [0, 19, US], [20, 29, null], [30, 39, US], [40, 49, null], [50, 59, null], [60, 139, US], [200, 299, null],
  [300, 379, 'فرنسا'], [380, 380, 'بلغاريا'], [381, 381, 'كوسوفو'], [383, 383, 'سلوفينيا'], [385, 385, 'كرواتيا'], [387, 387, 'البوسنة والهرسك'], [389, 389, 'الجبل الأسود'],
  [400, 440, 'ألمانيا'], [450, 459, 'اليابان'], [460, 469, 'روسيا'], [470, 470, 'قرغيزستان'], [471, 471, 'تايوان'], [474, 474, 'إستونيا'], [475, 475, 'لاتفيا'], [476, 476, 'أذربيجان'],
  [477, 477, 'ليتوانيا'], [478, 478, 'أوزبكستان'], [479, 479, 'سريلانكا'], [480, 480, 'الفلبين'], [481, 481, 'بيلاروسيا'], [482, 482, 'أوكرانيا'], [483, 483, 'تركمانستان'], [484, 484, 'مولدوفا'],
  [485, 485, 'أرمينيا'], [486, 486, 'جورجيا'], [487, 487, 'كازاخستان'], [488, 488, 'طاجيكستان'], [489, 489, 'هونغ كونغ'], [490, 499, 'اليابان'], [500, 509, 'المملكة المتحدة'], [520, 521, 'اليونان'],
  [528, 528, 'لبنان'], [529, 529, 'قبرص'], [530, 530, 'ألبانيا'], [531, 531, 'مقدونيا الشمالية'], [535, 535, 'مالطا'], [539, 539, 'إيرلندا'], [540, 549, 'بلجيكا ولوكسمبورغ'], [560, 560, 'البرتغال'],
  [569, 569, 'آيسلندا'], [570, 579, 'الدنمارك'], [590, 590, 'بولندا'], [594, 594, 'رومانيا'], [599, 599, 'المجر'], [600, 601, 'جنوب أفريقيا'], [603, 603, 'غانا'], [604, 604, 'السنغال'],
  [605, 605, 'أوغندا'], [606, 606, 'أنغولا'], [607, 607, 'عُمان'], [608, 608, 'البحرين'], [609, 609, 'موريشيوس'], [610, 610, null], [611, 611, 'المغرب'], [613, 613, 'الجزائر'], [614, 614, null],
  [615, 615, 'نيجيريا'], [616, 616, 'كينيا'], [617, 617, 'الكاميرون'], [618, 618, 'ساحل العاج'], [619, 619, 'تونس'], [620, 620, 'تنزانيا'], [621, 621, 'سوريا'], [622, 622, 'مصر'], [623, 623, null],
  [624, 624, 'ليبيا'], [625, 625, 'الأردن'], [626, 626, 'إيران'], [627, 627, 'الكويت'], [628, 628, 'السعودية'], [629, 629, 'الإمارات'], [630, 630, 'قطر'], [631, 631, 'ناميبيا'], [632, 632, 'رواندا'],
  [640, 649, 'فنلندا'], [680, 681, 'الصين'], [690, 699, 'الصين'], [700, 709, 'النرويج'], [729, 729, 'إسرائيل'], [730, 739, 'السويد'],
  [740, 740, 'غواتيمالا'], [741, 741, 'السلفادور'], [742, 742, 'هندوراس'], [743, 743, 'نيكاراغوا'], [744, 744, 'كوستاريكا'], [745, 745, 'بنما'], [746, 746, 'الدومينيكان'], [750, 750, 'المكسيك'],
  [754, 755, 'كندا'], [758, 758, null], [759, 759, 'فنزويلا'], [760, 769, 'سويسرا'], [770, 771, 'كولومبيا'], [773, 773, 'الأوروغواي'], [775, 775, 'البيرو'], [777, 777, 'بوليفيا'], [778, 779, 'الأرجنتين'],
  [780, 780, 'تشيلي'], [784, 784, 'باراغواي'], [786, 786, 'الإكوادور'], [789, 790, 'البرازيل'], [800, 839, 'إيطاليا'], [840, 849, 'إسبانيا'], [850, 850, 'كوبا'], [858, 858, 'سلوفاكيا'],
  [859, 859, 'التشيك'], [860, 860, 'صربيا'], [865, 865, 'منغوليا'], [867, 867, 'كوريا الشمالية'], [868, 869, 'تركيا'], [870, 879, 'هولندا'], [880, 881, 'كوريا الجنوبية'], [883, 883, 'ميانمار'],
  [884, 884, 'كمبوديا'], [885, 885, 'تايلاند'], [887, 887, 'لاوس'], [888, 888, 'سنغافورة'], [890, 890, 'الهند'], [893, 893, 'فيتنام'], [894, 894, null], [896, 896, 'باكستان'], [899, 899, 'إندونيسيا'],
  [900, 919, 'النمسا'], [930, 939, 'أستراليا'], [940, 949, 'نيوزيلندا'], [950, 952, null], [955, 955, 'ماليزيا'], [958, 958, 'ماكاو'], [960, 969, null],
  [977, 977, 'دوريات (ISSN)'], [978, 979, 'كتب (ISBN)'], [980, 980, null], [981, 983, null], [990, 999, null],
]
/** Who issued the number's company prefix (GS1 member organisation), for EAN-8/13, UPC and GTIN-14; null
 *  for numbers that belong to no country (a shop's own, coupons, GS1 Global Office). */
export function gs1Country(code: string): string | null {
  const g = gtin14(code)
  if (!g) return null
  // a GTIN-12 (UPC) sits after two leading zeros, EAN-13 after one, and EAN-8 after six
  const thirteen = g.slice(1)
  let p = Number(thirteen.slice(0, 3))
  if (thirteen.startsWith('00000')) {
    // EAN-8 has its own three-digit prefix; those starting with 0 or 2 are a shop's own numbers
    const eight = thirteen.slice(5)
    if (/^[02]/.test(eight)) return null
    p = Number(eight.slice(0, 3))
  }
  const hit = PREFIX.find(([a, b]) => p >= a && p <= b)
  return hit ? hit[2] : null
}

/** The GTIN-14 of a number that names the same product everywhere, or null for a shop's own numbers
 *  (restricted circulation: 2xx, UPC 2/4/5, coupons 98/99, EAN-8 starting 0 or 2) and anything not a GTIN. */
export function publicGtin(code: string): string | null {
  const g = productNumber(code.trim())
  if (!g) return null
  const t = g.slice(1) // the 13-digit form
  // an EAN-8 sits after five zeros
  if (t.startsWith('00000')) return /^[02]/.test(t.slice(5)) ? null : g
  if (/^(2|02|04|05|98|99)/.test(t)) return null
  return g
}

// Company prefixes of parts makers seen on their boxes (13-digit form), and where some of them put their own
// part number inside the barcode: [start, end) in the 13 digits.
const BRAND_PREFIX: [string, string, [number, number]?][] = [
  ['4011558', 'Mann-Filter'], ['4009026', 'Mahle'], ['3165143', 'Bosch'],
  ['4027816', 'febi bilstein', [7, 12]], ['4054224', 'febi bilstein'],
  ['327642', 'Valeo', [6, 12]],
  ['0087295', 'NGK', [8, 12]], // UPC 0-87295-x-SSSS-c: the 4-digit stock number
]
/** The parts maker of an EAN/UPC product number, and its part number when the maker puts it in the barcode.
 *  `learned` maps 7- or 8-digit prefixes of the 13-digit form to the shop's own brand names
 *  (learnBrandPrefixes); the longer match wins, and the shop's name wins over the built-in one. */
export function brandHint(code: string, learned?: Map<string, string>): { brand: string; partNumber?: string } | null {
  const g = publicGtin(code)
  if (!g) return null
  const t = g.slice(1)
  if (t.startsWith('00000')) return null // EAN-8: too short to carry a company prefix we know
  const seed = BRAND_PREFIX.find(([p]) => t.startsWith(p))
  const mine = learned?.get(t.slice(0, 8)) ?? learned?.get(t.slice(0, 7))
  if (!mine && !seed) return null
  const hint: { brand: string; partNumber?: string } = { brand: mine || seed![1] }
  if (seed?.[2]) hint.partNumber = t.slice(...seed[2])
  return hint
}
/** Company prefix (first 8 and first 7 digits of the 13-digit form) → brand, from the shop's own products:
 *  for each prefix the brand most of its products carry. Only numbers shared between shops count. */
export function learnBrandPrefixes(products: Iterable<{ barcode?: string; brand?: string }>): Map<string, string> {
  const counts = new Map<string, Map<string, { brand: string; n: number }>>()
  for (const p of products) {
    const brand = p.brand?.trim()
    if (!brand || !p.barcode) continue
    // a product may carry several barcodes, separated like OEM numbers
    for (const code of p.barcode.split(/[,\n;،؛]+/)) {
      const g = code.trim() ? publicGtin(code) : null
      if (!g || g.startsWith('000000')) continue
      const t = g.slice(1)
      for (const key of [t.slice(0, 8), t.slice(0, 7)]) {
        const byBrand = counts.get(key) ?? new Map<string, { brand: string; n: number }>()
        const c = byBrand.get(brand.toLowerCase()) ?? { brand, n: 0 }
        c.n++
        byBrand.set(brand.toLowerCase(), c)
        counts.set(key, byBrand)
      }
    }
  }
  const out = new Map<string, string>()
  for (const [key, byBrand] of counts) {
    let best: { brand: string; n: number } | undefined
    for (const c of byBrand.values()) if (!best || c.n > best.n) best = c
    out.set(key, best!.brand)
  }
  return out
}

/** A short description of a scan for the user: type, validity, origin, GS1 fields. `country` is where the
 *  number was registered; `origin` where the product was made (only GS1 data says that, AI 422/426);
 *  `partNumber` the maker's or customer's part number in GS1 data (AI 240/241). */
export interface CodeFacts {
  gtin: string | null; validCheckDigit: boolean | null; country: string | null; gs1: Gs1Field[] | null; looksLikePartNumber: boolean
  origin: string | null; partNumber: string | null
}
export function codeFacts(text: string): CodeFacts {
  const gs1 = parseGs1(text)
  const gtin = productNumber(text)
  const digits = text.replace(/[\s-]/g, '')
  const validCheckDigit = /^\d{8}$|^\d{12,14}$/.test(digits) ? !!gtin14(digits) : gtin ? true : null
  const first = (...ais: string[]) => ais.map(a => gs1?.find(f => f.ai === a)).find(Boolean)
  return {
    gtin, validCheckDigit, gs1,
    country: gtin ? gs1Country(gtin) : null,
    // 422 when it names a country we know, else 426
    origin: ['422', '426'].map(a => gs1?.find(f => f.ai === a)).map(f => f && isoCountryName(f.raw ?? f.value)).find(Boolean) ?? null,
    partNumber: first('240', '241')?.value ?? null,
    // letters and digits with dashes/dots/slashes, not a product number: a manufacturer's part number
    looksLikePartNumber: !gtin && !gs1 && /^[A-Za-z0-9][A-Za-z0-9 .\-/]{3,30}$/.test(text.trim()) && /\d/.test(text) && !/^https?:/i.test(text),
  }
}
