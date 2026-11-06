// The default catalogue a new clinic starts with: procedures with prices and the drugs dentists prescribe most (the
// consumables list below is only used by the demo clinic: a real clinic starts with an empty stock). Prices are typical
// Levant private-clinic prices in USD; pegged currencies are scaled on insert.
//
// Procedure codes: the default list carries no billing codes. Code sets such as the ADA's CDT are licensed, so a
// clinic that holds a licence types its own codes in the procedure list. `key` below is only an internal name the
// demo data uses to find a procedure; it is never stored or shown.
import type { ProcedureCategory } from '@/db/types'

export interface ProcedureDef {
  key: string              // internal, never stored
  /** Always empty: the default list carries no billing codes (kept so older callers that copy it still compile). */
  code?: undefined
  name: string
  nameEn: string
  category: ProcedureCategory
  price: number            // USD
  durationMin: number
  toothSpecific: boolean
}

const P = (key: string, name: string, nameEn: string, category: ProcedureCategory, price: number, durationMin: number, toothSpecific = false): ProcedureDef =>
  ({ key, name, nameEn, category, price, durationMin, toothSpecific })
/** The catalogue entry a stored procedure came from (matched by its English, then Arabic name), if any. */
export function catalogueEntry(p: { name?: string; nameEn?: string }): ProcedureDef | undefined {
  const en = (p.nameEn ?? '').trim().toLowerCase(), ar = (p.name ?? '').trim()
  return DEFAULT_PROCEDURES.find(d => (en && d.nameEn.toLowerCase() === en)) ?? DEFAULT_PROCEDURES.find(d => ar && d.name === ar)
}

export const DEFAULT_PROCEDURES: ProcedureDef[] = [
  // diagnostic
  P('exam-full', 'فحص شامل وخطة علاج', 'Comprehensive oral exam', 'diagnostic', 15, 30),
  P('exam-periodic', 'فحص دوري', 'Periodic oral exam', 'diagnostic', 10, 15),
  P('exam-emergency', 'فحص إسعافي', 'Emergency (limited) exam', 'diagnostic', 10, 15),
  P('consult', 'استشارة', 'Consultation', 'diagnostic', 15, 30),
  P('xray-pa', 'صورة شعاعية ذروية', 'Periapical X-ray', 'diagnostic', 5, 10, true),
  P('xray-bitewing', 'صور مجنّحة (عضّة)', 'Bitewing X-rays', 'diagnostic', 10, 10),
  P('xray-opg', 'صورة بانورامية (OPG)', 'Panoramic X-ray', 'diagnostic', 20, 15),
  P('cbct', 'تصوير مقطعي CBCT', 'CBCT scan', 'diagnostic', 70, 20),
  // preventive
  P('scaling', 'تقليح وتلميع', 'Scaling and polishing', 'preventive', 40, 45),
  P('debridement', 'تقليح عميق لكامل الفم', 'Full-mouth debridement', 'preventive', 60, 60),
  P('fluoride-varnish', 'تطبيق فلورايد (ورنيش)', 'Fluoride varnish', 'preventive', 15, 15),
  P('sealant', 'سادّ شقوق وميازيب', 'Fissure sealant', 'preventive', 15, 15, true),
  P('desensitize', 'علاج حساسية الأسنان', 'Desensitizing treatment', 'preventive', 20, 20),
  // restorative
  P('comp-1', 'حشوة كومبوزيت — سطح واحد', 'Composite filling — 1 surface', 'restorative', 35, 30, true),
  P('comp-2', 'حشوة كومبوزيت — سطحان', 'Composite filling — 2 surfaces', 'restorative', 50, 45, true),
  P('comp-3', 'حشوة كومبوزيت — ثلاثة سطوح', 'Composite filling — 3 surfaces', 'restorative', 65, 60, true),
  P('comp-4', 'حشوة كومبوزيت — أربعة سطوح أو أكثر', 'Composite filling — 4+ surfaces', 'restorative', 80, 60, true),
  P('comp-anterior', 'حشوة كومبوزيت أمامية', 'Anterior composite filling', 'restorative', 40, 30, true),
  P('amalgam-1', 'حشوة أملغم — سطح واحد', 'Amalgam filling — 1 surface', 'restorative', 25, 30, true),
  P('gic', 'حشوة زجاجية شاردية (GIC)', 'Glass-ionomer filling', 'restorative', 25, 20, true),
  P('temp-filling', 'حشوة مؤقتة', 'Temporary filling', 'restorative', 10, 15, true),
  P('core-buildup', 'بناء جذع بالكومبوزيت', 'Core build-up', 'restorative', 45, 45, true),
  P('fiber-post', 'وتد ليفي جاهز', 'Prefabricated fiber post', 'restorative', 40, 30, true),
  P('onlay', 'حشوة مخبرية خزفية (أونليه)', 'Ceramic onlay', 'restorative', 180, 60, true),
  // endodontic
  P('pulp-debride', 'فتح وتفريغ إسعافي للعصب', 'Emergency pulpal debridement', 'endodontic', 30, 30, true),
  P('rct-anterior', 'معالجة لبية — سن أمامي', 'Root canal — anterior', 'endodontic', 100, 60, true),
  P('rct-premolar', 'معالجة لبية — ضاحك', 'Root canal — premolar', 'endodontic', 150, 60, true),
  P('rct-molar', 'معالجة لبية — رحى', 'Root canal — molar', 'endodontic', 200, 90, true),
  P('rct-retreat', 'إعادة معالجة لبية', 'Root canal retreatment', 'endodontic', 250, 90, true),
  // periodontic
  P('srp-quadrant', 'تجريف وتسوية جذور (ربع فك)', 'Scaling and root planing (quadrant)', 'periodontic', 50, 45),
  P('perio-maint', 'صيانة لثوية دورية', 'Periodontal maintenance', 'periodontic', 45, 45),
  P('gingivectomy', 'قطع لثة', 'Gingivectomy', 'periodontic', 40, 30, true),
  P('crown-lengthening', 'إطالة تاج سريري', 'Crown lengthening', 'periodontic', 150, 60, true),
  // prosthodontic
  P('crown-zirconia', 'تاج زيركون', 'Zirconia crown', 'prosthodontic', 280, 60, true),
  P('crown-emax', 'تاج إيماكس (خزف زجاجي)', 'E.max crown', 'prosthodontic', 330, 60, true),
  P('crown-pfm', 'تاج خزف على معدن', 'Porcelain-fused-to-metal crown', 'prosthodontic', 180, 60, true),
  P('crown-temp', 'تاج مؤقت', 'Temporary crown', 'prosthodontic', 25, 30, true),
  P('bridge-zirconia', 'وحدة جسر زيركون', 'Zirconia bridge unit', 'prosthodontic', 260, 45, true),
  P('denture-full', 'طقم كامل (فك واحد)', 'Complete denture (one arch)', 'prosthodontic', 350, 45),
  P('denture-cast-partial', 'طقم جزئي هيكلي', 'Cast partial denture', 'prosthodontic', 400, 45),
  P('denture-acrylic-partial', 'طقم جزئي أكريلي', 'Acrylic partial denture', 'prosthodontic', 180, 45),
  P('denture-adjust', 'تعديل طقم', 'Denture adjustment', 'prosthodontic', 15, 20),
  // surgical
  P('ext-simple', 'قلع بسيط', 'Simple extraction', 'surgical', 30, 30, true),
  P('ext-surgical', 'قلع جراحي', 'Surgical extraction', 'surgical', 70, 45, true),
  P('ext-wisdom', 'قلع ضرس عقل منطمر', 'Impacted wisdom tooth removal', 'surgical', 120, 60, true),
  P('ext-root', 'قلع بقايا جذر', 'Root remnant removal', 'surgical', 45, 30, true),
  P('abscess-drain', 'شق وتفجير خراج', 'Abscess incision and drainage', 'surgical', 30, 20, true),
  P('socket-graft', 'طعم عظمي للسنخ', 'Socket bone graft', 'surgical', 150, 30, true),
  P('postop-review', 'مراجعة بعد الجراحة وفك القطب', 'Post-operative review and suture removal', 'surgical', 10, 15),
  // implant
  P('implant', 'زرعة سنية', 'Dental implant', 'implant', 650, 90, true),
  P('implant-premium', 'زرعة سنية (فئة ممتازة)', 'Premium dental implant', 'implant', 850, 90, true),
  P('implant-uncover', 'كشف الزرعة وتركيب دعامة الشفاء', 'Implant uncovering and healing abutment', 'implant', 40, 30, true),
  P('implant-crown', 'تاج زيركون على زرعة', 'Zirconia implant crown', 'implant', 320, 45, true),
  P('sinus-lift', 'رفع جيب فكي', 'Sinus lift', 'implant', 400, 90, true),
  P('implant-maint', 'تنظيف وصيانة الزرعات', 'Implant maintenance', 'implant', 40, 30),
  // orthodontic
  P('ortho-consult', 'استشارة تقويم مع السجلات', 'Orthodontic consultation and records', 'orthodontic', 30, 45),
  P('braces-metal', 'تقويم ثابت معدني (فكان)', 'Fixed metal braces (both arches)', 'orthodontic', 1200, 90),
  P('braces-ceramic', 'تقويم ثابت خزفي (فكان)', 'Fixed ceramic braces (both arches)', 'orthodontic', 1600, 90),
  P('aligners', 'تقويم شفاف (Aligners)', 'Clear aligners', 'orthodontic', 1900, 45),
  P('ortho-adjust', 'جلسة شد تقويم شهرية', 'Monthly orthodontic adjustment', 'orthodontic', 25, 30),
  P('retainer', 'مثبّت بعد التقويم', 'Retainer after orthodontics', 'orthodontic', 80, 30),
  P('ortho-removable', 'جهاز تقويم متحرك للأطفال', 'Removable appliance (child)', 'orthodontic', 250, 45),
  // pediatric
  P('child-exam', 'فحص أسنان الطفل', "Child's dental exam", 'pediatric', 10, 20),
  P('child-cleaning', 'تنظيف أسنان الأطفال', 'Child prophylaxis', 'pediatric', 25, 30),
  P('child-filling', 'حشوة سن لبني', 'Primary tooth filling', 'pediatric', 25, 30, true),
  P('pulpotomy', 'بتر لب سن لبني', 'Pulpotomy (primary tooth)', 'pediatric', 40, 30, true),
  P('pulpectomy', 'معالجة لبية لسن لبني', 'Pulpectomy (primary tooth)', 'pediatric', 60, 45, true),
  P('ssc', 'تاج ستانلس ستيل للأطفال', 'Stainless steel crown', 'pediatric', 50, 30, true),
  P('child-ext', 'قلع سن لبني', 'Primary tooth extraction', 'pediatric', 20, 20, true),
  P('space-maintainer', 'حافظ مسافة', 'Space maintainer', 'pediatric', 90, 30, true),
  // cosmetic
  P('whitening-office', 'تبييض الأسنان في العيادة', 'In-office whitening', 'cosmetic', 220, 90),
  P('whitening-home', 'تبييض منزلي (قوالب وجل)', 'Take-home whitening kit', 'cosmetic', 150, 30),
  P('veneer-porcelain', 'قشرة خزفية (فينير)', 'Porcelain veneer', 'cosmetic', 320, 60, true),
  P('veneer-composite', 'فينير كومبوزيت مباشر', 'Direct composite veneer', 'cosmetic', 120, 60, true),
  P('diastema', 'إغلاق فراغ أمامي بالكومبوزيت', 'Diastema closure (composite)', 'cosmetic', 60, 45, true),
  P('smile-design', 'تصميم ابتسامة رقمي', 'Digital smile design', 'cosmetic', 100, 45),
  // other
  P('night-guard', 'واقٍ ليلي للصرير', 'Night guard', 'other', 120, 30),
  P('palliative', 'معالجة إسعافية للألم', 'Palliative emergency treatment', 'other', 20, 20, true),
  P('report', 'تقرير طبي', 'Medical report', 'other', 10, 15),
]

/** Defaults in English, for a clinic that works in English (the prescription prints them as they are). */
export interface DrugDefaultsEn { form: string; dose: string; frequency: string; duration: string; instructions: string; strength?: string }
export interface DrugDef {
  name: string
  nameEn: string
  form: string
  strength: string
  dose: string
  frequency: string
  duration: string
  instructions: string
  en: DrugDefaultsEn
}
const D = (name: string, nameEn: string, form: string, strength: string, dose: string, frequency: string, duration: string, instructions: string, en: DrugDefaultsEn): DrugDef =>
  ({ name, nameEn, form, strength, dose, frequency, duration, instructions, en })

export const DEFAULT_DRUGS: DrugDef[] = [
  // antibiotics
  D('أموكسيسيلين', 'Amoxicillin', 'كبسولات', '500 mg', 'كبسولة واحدة', 'كل 8 ساعات', '5 أيام', 'بعد الطعام، ويُكمل العلاج كاملاً ولو زال الألم', { form: 'Capsules', dose: '1 capsule', frequency: 'Every 8 hours', duration: '5 days', instructions: 'After meals; finish the whole course even if the pain goes' }),
  D('أموكسيسيلين + حمض الكلافولانيك (أوغمنتين)', 'Amoxicillin + Clavulanate (Augmentin)', 'أقراص', '1 g', 'حبة واحدة', 'كل 12 ساعة', '7 أيام', 'في بداية الطعام', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 12 hours', duration: '7 days', instructions: 'At the start of a meal' }),
  D('أموكسيسيلين + حمض الكلافولانيك (أوغمنتين)', 'Amoxicillin + Clavulanate (Augmentin)', 'أقراص', '625 mg', 'حبة واحدة', 'كل 8 ساعات', '5 أيام', 'في بداية الطعام', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 8 hours', duration: '5 days', instructions: 'At the start of a meal' }),
  D('أموكسيسيلين معلّق للأطفال', 'Amoxicillin suspension', 'معلّق فموي', '250 mg / 5 ml', '5 مل', 'كل 8 ساعات', '5 أيام', 'تُرجّ العبوة قبل الاستعمال وتُحفظ في البراد، والجرعة حسب وزن الطفل', { form: 'Oral suspension', dose: '5 ml', frequency: 'Every 8 hours', duration: '5 days', instructions: 'Shake before use and keep in the fridge; the dose follows the child’s weight' }),
  D('ميترونيدازول (فلاجيل)', 'Metronidazole (Flagyl)', 'أقراص', '500 mg', 'حبة واحدة', 'كل 8 ساعات', '5 أيام', 'بعد الطعام، ويُمنع تناول الكحول أثناء العلاج', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 8 hours', duration: '5 days', instructions: 'After meals; no alcohol during the course' }),
  D('كليندامايسين', 'Clindamycin', 'كبسولات', '300 mg', 'كبسولة واحدة', 'كل 8 ساعات', '7 أيام', 'مع كوب ماء كامل، ويُراجع الطبيب عند حدوث إسهال شديد', { form: 'Capsules', dose: '1 capsule', frequency: 'Every 8 hours', duration: '7 days', instructions: 'With a full glass of water; see the doctor if severe diarrhoea occurs' }),
  D('أزيثرومايسين', 'Azithromycin', 'أقراص', '500 mg', 'حبة واحدة', 'مرة يومياً', '3 أيام', 'قبل الطعام بساعة أو بعده بساعتين', { form: 'Tablets', dose: '1 tablet', frequency: 'Once daily', duration: '3 days', instructions: 'One hour before or two hours after a meal' }),
  D('سيفالكسين', 'Cephalexin', 'كبسولات', '500 mg', 'كبسولة واحدة', 'كل 6 ساعات', '5 أيام', 'قبل الطعام أو بعده', { form: 'Capsules', dose: '1 capsule', frequency: 'Every 6 hours', duration: '5 days', instructions: 'With or without food' }),
  D('دوكسيسيكلين', 'Doxycycline', 'كبسولات', '100 mg', 'كبسولة واحدة', 'مرة يومياً', '10 أيام', 'مع كوب ماء كامل، وعدم الاستلقاء بعدها مباشرة', { form: 'Capsules', dose: '1 capsule', frequency: 'Once daily', duration: '10 days', instructions: 'With a full glass of water; do not lie down straight after' }),
  // analgesics and anti-inflammatories
  D('إيبوبروفين', 'Ibuprofen', 'أقراص', '400 mg', 'حبة واحدة', 'كل 8 ساعات عند الألم', '3 أيام', 'بعد الطعام', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 8 hours for pain', duration: '3 days', instructions: 'After meals' }),
  D('إيبوبروفين', 'Ibuprofen', 'أقراص', '600 mg', 'حبة واحدة', 'كل 8 ساعات', '3 أيام', 'بعد الطعام مباشرة', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 8 hours', duration: '3 days', instructions: 'Straight after meals' }),
  D('إيبوبروفين شراب للأطفال', 'Ibuprofen syrup', 'شراب', '100 mg / 5 ml', '5 مل', 'كل 8 ساعات عند الألم', '3 أيام', 'بعد الطعام، والجرعة حسب وزن الطفل', { form: 'Syrup', dose: '5 ml', frequency: 'Every 8 hours for pain', duration: '3 days', instructions: 'After meals; the dose follows the child’s weight' }),
  D('باراسيتامول', 'Paracetamol', 'أقراص', '500 mg', 'حبة أو حبتان', 'كل 6 ساعات عند اللزوم', 'عند اللزوم', 'لا تتجاوز 8 حبات في اليوم', { form: 'Tablets', dose: '1 or 2 tablets', frequency: 'Every 6 hours as needed', duration: 'As needed', instructions: 'No more than 8 tablets a day' }),
  D('باراسيتامول', 'Paracetamol', 'أقراص فوّارة', '1 g', 'قرص واحد', 'كل 8 ساعات عند الألم', '3 أيام', 'يُذاب في كأس ماء', { form: 'Effervescent tablets', dose: '1 tablet', frequency: 'Every 8 hours for pain', duration: '3 days', instructions: 'Dissolve in a glass of water' }),
  D('باراسيتامول شراب للأطفال', 'Paracetamol syrup', 'شراب', '120 mg / 5 ml', '5–10 مل', 'كل 6 ساعات عند الحرارة أو الألم', 'عند اللزوم', 'حسب وزن الطفل', { form: 'Syrup', dose: '5–10 ml', frequency: 'Every 6 hours for fever or pain', duration: 'As needed', instructions: 'According to the child’s weight' }),
  D('ديكلوفيناك الصوديوم', 'Diclofenac sodium', 'أقراص', '50 mg', 'حبة واحدة', 'كل 8 ساعات', '3 أيام', 'بعد الطعام', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 8 hours', duration: '3 days', instructions: 'After meals' }),
  D('ديكلوفيناك البوتاسيوم', 'Diclofenac potassium', 'أقراص', '50 mg', 'حبة واحدة', 'كل 12 ساعة', '3 أيام', 'بعد الطعام', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 12 hours', duration: '3 days', instructions: 'After meals' }),
  D('كيتوبروفين', 'Ketoprofen', 'كبسولات', '100 mg', 'كبسولة واحدة', 'مرتين يومياً', '3 أيام', 'بعد الطعام مباشرة', { form: 'Capsules', dose: '1 capsule', frequency: 'Twice daily', duration: '3 days', instructions: 'Straight after meals' }),
  D('نابروكسين', 'Naproxen', 'أقراص', '500 mg', 'حبة واحدة', 'مرتين يومياً', '3 أيام', 'بعد الطعام', { form: 'Tablets', dose: '1 tablet', frequency: 'Twice daily', duration: '3 days', instructions: 'After meals' }),
  D('حمض الميفيناميك', 'Mefenamic acid', 'كبسولات', '500 mg', 'كبسولة واحدة', 'كل 8 ساعات', '3 أيام', 'بعد الطعام', { form: 'Capsules', dose: '1 capsule', frequency: 'Every 8 hours', duration: '3 days', instructions: 'After meals' }),
  D('ديكساميثازون', 'Dexamethasone', 'أقراص', '4 mg', 'حبة واحدة', 'صباحاً', '3 أيام', 'بعد الفطور — لتخفيف الوذمة بعد الجراحة', { form: 'Tablets', dose: '1 tablet', frequency: 'In the morning', duration: '3 days', instructions: 'After breakfast — reduces swelling after surgery' }),
  D('أوميبرازول', 'Omeprazole', 'كبسولات', '20 mg', 'كبسولة واحدة', 'مرة يومياً', 'طوال مدة المسكّن', 'قبل الفطور بنصف ساعة، لحماية المعدة', { form: 'Capsules', dose: '1 capsule', frequency: 'Once daily', duration: 'While taking the painkiller', instructions: 'Half an hour before breakfast, to protect the stomach' }),
  D('حمض الترانيكساميك', 'Tranexamic acid', 'أقراص', '500 mg', 'حبة واحدة', 'كل 8 ساعات', 'يومان', 'لضبط النزف بعد القلع', { form: 'Tablets', dose: '1 tablet', frequency: 'Every 8 hours', duration: '2 days', instructions: 'To control bleeding after an extraction' }),
  // mouthwashes and topical
  D('كلورهيكسيدين غسول فموي', 'Chlorhexidine mouthwash', 'غسول فموي', '0.12%', 'مضمضة 15 مل لمدة 30 ثانية', 'مرتين يومياً', '7 أيام', 'بعد تفريش الأسنان بنصف ساعة، دون بلع، ولا يُؤكل ولا يُشرب نصف ساعة بعدها', { form: 'Mouthwash', dose: 'Rinse with 15 ml for 30 seconds', frequency: 'Twice daily', duration: '7 days', instructions: 'Half an hour after brushing, do not swallow; no food or drink for half an hour after' }),
  D('كلورهيكسيدين جل', 'Chlorhexidine gel', 'جل فموي', '1%', 'كمية صغيرة على اللثة', 'مرتين يومياً', '10 أيام', 'بعد تنظيف الأسنان', { form: 'Oral gel', dose: 'A small amount on the gums', frequency: 'Twice daily', duration: '10 days', instructions: 'After cleaning the teeth' }),
  D('بنزيدامين غسول فموي', 'Benzydamine mouthwash', 'غسول فموي', '0.15%', 'مضمضة 15 مل', '3 مرات يومياً', '5 أيام', 'يُستعمل دون تمديد ودون بلع', { form: 'Mouthwash', dose: 'Rinse with 15 ml', frequency: '3 times daily', duration: '5 days', instructions: 'Use undiluted, do not swallow' }),
  D('بنزيدامين بخاخ فموي', 'Benzydamine oral spray', 'بخاخ فموي', '0.15%', '4 بخات', '3 مرات يومياً', '5 أيام', 'على المنطقة المؤلمة', { form: 'Oral spray', dose: '4 sprays', frequency: '3 times daily', duration: '5 days', instructions: 'On the painful area' }),
  D('نيستاتين', 'Nystatin', 'معلّق فموي', '100,000 IU / ml', '1 مل', '4 مرات يومياً', '14 يوماً', 'يُبقى في الفم أطول مدة ممكنة ثم يُبلع', { form: 'Oral suspension', dose: '1 ml', frequency: '4 times daily', duration: '14 days', instructions: 'Keep in the mouth as long as possible, then swallow' }),
  D('ميكونازول جل فموي', 'Miconazole oral gel', 'جل فموي', '2%', 'نصف ملعقة صغيرة', '4 مرات يومياً', '7 أيام', 'بعد الطعام، ويُوضع على الآفات', { form: 'Oral gel', dose: 'Half a teaspoon', frequency: '4 times daily', duration: '7 days', instructions: 'After meals, on the lesions' }),
  D('أسيكلوفير كريم', 'Acyclovir cream', 'كريم', '5%', 'طبقة رقيقة', '5 مرات يومياً', '5 أيام', 'على الحويصلات عند أول ظهورها', { form: 'Cream', dose: 'A thin layer', frequency: '5 times daily', duration: '5 days', instructions: 'On the blisters as soon as they appear' }),
  D('أسيكلوفير', 'Acyclovir', 'أقراص', '400 mg', 'حبة واحدة', '3 مرات يومياً', '5 أيام', 'مع كمية وافرة من الماء', { form: 'Tablets', dose: '1 tablet', frequency: '3 times daily', duration: '5 days', instructions: 'With plenty of water' }),
  D('تريامسينولون معجون فموي', 'Triamcinolone oral paste', 'معجون فموي', '0.1%', 'كمية صغيرة على القرحة', '3 مرات يومياً', '5 أيام', 'بعد الطعام وقبل النوم دون فرك', { form: 'Oral paste', dose: 'A small amount on the ulcer', frequency: '3 times daily', duration: '5 days', instructions: 'After meals and at bedtime, without rubbing' }),
  D('حمض الهيالورونيك جل', 'Hyaluronic acid gel', 'جل فموي', '0.2%', 'كمية صغيرة على اللثة', '3 مرات يومياً', '7 أيام', 'بعد الطعام، وعدم الأكل نصف ساعة بعدها', { form: 'Oral gel', dose: 'A small amount on the gums', frequency: '3 times daily', duration: '7 days', instructions: 'After meals; no food for half an hour after' }),
  D('ليدوكائين جل موضعي', 'Lidocaine gel', 'جل موضعي', '2%', 'كمية صغيرة', 'عند اللزوم', 'عند اللزوم', 'على المنطقة المؤلمة، لا يُستعمل قبل الأكل مباشرة', { form: 'Topical gel', dose: 'A small amount', frequency: 'As needed', duration: 'As needed', instructions: 'On the painful area; not just before eating' }),
  D('جل فلورايد الصوديوم للاستعمال المنزلي', 'Sodium fluoride gel (home use)', 'جل فموي', '1.1% (5000 ppm)', 'طبقة رقيقة بالفرشاة أو في القالب', 'مرة يومياً قبل النوم بدل المعجون', '3 أشهر', 'يُترك دقيقتين ثم يُبصق دون مضمضة، ولا يُؤكل ولا يُشرب بعده 30 دقيقة. لا يُعطى للأطفال دون 6 سنوات', { form: 'Oral gel', dose: 'A thin layer with the brush or in the tray', frequency: 'Once daily at bedtime instead of toothpaste', duration: '3 months', instructions: 'Leave for two minutes, then spit without rinsing; no food or drink for 30 minutes. Not for children under 6' }),
  D('معجون فلورايد عالي التركيز', 'High-fluoride toothpaste', 'معجون أسنان', '5000 ppm', 'بحجم حبة البازلاء', 'مرتين يومياً', '3 أشهر', 'يُبصق دون مضمضة بعد التفريش', { form: 'Toothpaste', dose: 'A pea-sized amount', frequency: 'Twice daily', duration: '3 months', instructions: 'Spit without rinsing after brushing' }),
  D('معجون أسنان للأسنان الحساسة', 'Sensitivity toothpaste', 'معجون أسنان', '5% نترات البوتاسيوم', 'بحجم حبة البازلاء', 'مرتين يومياً', '4 أسابيع', 'يُترك على الأسنان دقيقة قبل البصق', { form: 'Toothpaste', dose: 'A pea-sized amount', frequency: 'Twice daily', duration: '4 weeks', instructions: 'Leave on the teeth for a minute before spitting', strength: '5% potassium nitrate' }),
]

export interface InventoryDef {
  name: string
  category: string          // inventory presets: consumables, instruments, materials, medications, office, equipment
  unit: string              // piece, box, pack, ml, g, other
  quantity: number
  minQuantity: number
  costPrice: number         // USD per unit
  supplier: string
  sku?: string
  expiryDays?: number       // from today; one item is close to expiry
  location?: string
  notes?: string
}
const SUP_A = 'مستودع الشفاء للمواد السنية'
const SUP_B = 'شركة الرازي للتجهيزات الطبية'
const SUP_C = 'مكتبة النور'
const I = (name: string, category: string, unit: string, quantity: number, minQuantity: number, costPrice: number, supplier: string, extra: Partial<InventoryDef> = {}): InventoryDef =>
  ({ name, category, unit, quantity, minQuantity, costPrice, supplier, ...extra })

export const DEFAULT_INVENTORY: InventoryDef[] = [
  I('قفازات لاتكس — مقاس M', 'consumables', 'box', 18, 8, 6, SUP_A, { sku: 'GLV-LX-M', location: 'خزانة المستهلكات' }),
  I('قفازات نتريل بدون بودرة — مقاس S', 'consumables', 'box', 3, 6, 7, SUP_A, { sku: 'GLV-NT-S', location: 'خزانة المستهلكات' }),
  I('كمامات طبية ثلاثية الطبقات', 'consumables', 'box', 12, 5, 3, SUP_A, { sku: 'MSK-3P', location: 'خزانة المستهلكات' }),
  I('أمبولات مخدر ليدوكائين 2% مع أدرينالين (50 أمبولة)', 'medications', 'box', 6, 3, 25, SUP_B, { sku: 'ANS-LID', expiryDays: 420, location: 'درج الأدوية' }),
  I('أمبولات مخدر أرتيكائين 4% (50 أمبولة)', 'medications', 'box', 2, 3, 38, SUP_B, { sku: 'ANS-ART', expiryDays: 300, location: 'درج الأدوية' }),
  I('إبر تخدير قصيرة 30G', 'consumables', 'box', 5, 3, 7, SUP_B, { sku: 'NDL-30S', location: 'درج الأدوية' }),
  I('كومبوزيت ضوئي — طقم ألوان A1–A3.5', 'materials', 'pack', 3, 2, 90, SUP_A, { sku: 'CMP-KIT', expiryDays: 540, location: 'خزانة المواد' }),
  I('كومبوزيت سيّال A2', 'materials', 'piece', 5, 3, 12, SUP_A, { sku: 'CMP-FLW-A2', expiryDays: 480, location: 'خزانة المواد' }),
  I('مادة رابطة (بوندينغ) الجيل الخامس', 'materials', 'piece', 2, 2, 28, SUP_A, { sku: 'BND-5G', expiryDays: 260, location: 'خزانة المواد' }),
  I('حمض التخريش 37%', 'materials', 'piece', 6, 3, 4, SUP_A, { sku: 'ETCH-37', expiryDays: 400, location: 'خزانة المواد' }),
  I('سنابل ماسية للتوربين (طقم)', 'instruments', 'pack', 8, 4, 15, SUP_B, { sku: 'BUR-DIA', location: 'درج الأدوات' }),
  I('سنابل كاربايد للقبضة البطيئة', 'instruments', 'pack', 4, 3, 12, SUP_B, { sku: 'BUR-CRB', location: 'درج الأدوات' }),
  I('ماصّات لعاب بلاستيكية (100 قطعة)', 'consumables', 'pack', 1, 4, 3, SUP_A, { sku: 'SUC-100', location: 'خزانة المستهلكات' }),
  I('مادة طبع ألجينات (450 غ)', 'materials', 'pack', 4, 3, 9, SUP_A, { sku: 'IMP-ALG', expiryDays: 24, location: 'خزانة المواد', notes: 'تُستهلك العبوة المفتوحة أولاً' }),
  I('مادة طبع سيليكون (بوتي ولايت)', 'materials', 'pack', 3, 2, 45, SUP_A, { sku: 'IMP-SIL', expiryDays: 380, location: 'خزانة المواد' }),
  I('أقماع كوتا بيركا (مقاسات مشكّلة)', 'materials', 'box', 7, 3, 6, SUP_A, { sku: 'END-GP', location: 'خزانة علاج العصب' }),
  I('أقماع ورقية ماصّة', 'materials', 'box', 6, 3, 4, SUP_A, { sku: 'END-PP', location: 'خزانة علاج العصب' }),
  I('مبارد يدوية K-File ‏21 مم', 'instruments', 'pack', 5, 3, 8, SUP_B, { sku: 'END-KF21', location: 'خزانة علاج العصب' }),
  I('مبارد دوّارة (نظام روتاري)', 'instruments', 'pack', 2, 3, 30, SUP_B, { sku: 'END-ROT', location: 'خزانة علاج العصب' }),
  I('هيبوكلوريت الصوديوم 5.25%', 'materials', 'ml', 2000, 1000, 0.01, SUP_A, { sku: 'END-NAOCL', expiryDays: 200, location: 'خزانة علاج العصب' }),
  I('لفافات قطنية', 'consumables', 'pack', 10, 4, 2, SUP_A, { sku: 'CTN-RL', location: 'خزانة المستهلكات' }),
  I('مرايل للمرضى (125 قطعة)', 'consumables', 'pack', 3, 2, 8, SUP_A, { sku: 'BIB-125', location: 'خزانة المستهلكات' }),
  I('أكياس تعقيم ذاتية الإغلاق (200 كيس)', 'consumables', 'box', 2, 3, 9, SUP_B, { sku: 'STR-PCH', location: 'غرفة التعقيم' }),
  I('إسمنت زجاجي شاردي (GIC)', 'materials', 'pack', 3, 2, 22, SUP_A, { sku: 'CEM-GIC', expiryDays: 330, location: 'خزانة المواد' }),
  I('شفرات مشرط رقم 15', 'consumables', 'box', 5, 2, 5, SUP_B, { sku: 'SCL-15', location: 'درج الجراحة' }),
  I('خيوط جراحية حريرية 3-0', 'consumables', 'box', 1, 2, 14, SUP_B, { sku: 'SUT-3-0', expiryDays: 600, location: 'درج الجراحة' }),
  I('مطهّر أسطح كحولي (1 لتر)', 'consumables', 'piece', 4, 2, 6, SUP_B, { sku: 'DIS-1L', expiryDays: 500, location: 'غرفة التعقيم' }),
  I('ورق طباعة A4', 'office', 'pack', 4, 2, 4, SUP_C, { sku: 'OFF-A4', location: 'الاستقبال' }),
]

/** English names, places and notes of the demo stock, for a clinic working in English. */
export const INVENTORY_EN: Record<string, string> = {
  'قفازات لاتكس — مقاس M': 'Latex gloves — size M', 'قفازات نتريل بدون بودرة — مقاس S': 'Powder-free nitrile gloves — size S', 'كمامات طبية ثلاثية الطبقات': 'Three-ply medical masks',
  'أمبولات مخدر ليدوكائين 2% مع أدرينالين (50 أمبولة)': 'Lidocaine 2% with adrenaline cartridges (50)', 'أمبولات مخدر أرتيكائين 4% (50 أمبولة)': 'Articaine 4% cartridges (50)',
  'إبر تخدير قصيرة 30G': 'Short 30G dental needles', 'كومبوزيت ضوئي — طقم ألوان A1–A3.5': 'Light-cure composite — A1–A3.5 kit', 'كومبوزيت سيّال A2': 'Flowable composite A2',
  'مادة رابطة (بوندينغ) الجيل الخامس': 'Fifth-generation bonding agent', 'حمض التخريش 37%': 'Etching acid 37%', 'سنابل ماسية للتوربين (طقم)': 'Diamond burs for the turbine (set)',
  'سنابل كاربايد للقبضة البطيئة': 'Carbide burs for the slow handpiece', 'ماصّات لعاب بلاستيكية (100 قطعة)': 'Plastic saliva ejectors (100)', 'مادة طبع ألجينات (450 غ)': 'Alginate impression material (450 g)',
  'مادة طبع سيليكون (بوتي ولايت)': 'Silicone impression material (putty and light)', 'أقماع كوتا بيركا (مقاسات مشكّلة)': 'Gutta-percha points (assorted)', 'أقماع ورقية ماصّة': 'Paper points',
  'مبارد يدوية K-File ‏21 مم': 'K-files 21 mm', 'مبارد دوّارة (نظام روتاري)': 'Rotary files', 'هيبوكلوريت الصوديوم 5.25%': 'Sodium hypochlorite 5.25%', 'لفافات قطنية': 'Cotton rolls',
  'مرايل للمرضى (125 قطعة)': 'Patient bibs (125)', 'أكياس تعقيم ذاتية الإغلاق (200 كيس)': 'Self-sealing sterilisation pouches (200)', 'إسمنت زجاجي شاردي (GIC)': 'Glass-ionomer cement (GIC)',
  'شفرات مشرط رقم 15': 'Scalpel blades no. 15', 'خيوط جراحية حريرية 3-0': 'Silk sutures 3-0', 'مطهّر أسطح كحولي (1 لتر)': 'Alcohol surface disinfectant (1 l)', 'ورق طباعة A4': 'A4 printing paper',
  'خزانة المستهلكات': 'Consumables cabinet', 'درج الأدوية': 'Medicines drawer', 'خزانة المواد': 'Materials cabinet', 'درج الأدوات': 'Instruments drawer', 'خزانة علاج العصب': 'Endo cabinet',
  'غرفة التعقيم': 'Sterilisation room', 'درج الجراحة': 'Surgery drawer', 'الاستقبال': 'Reception', 'تُستهلك العبوة المفتوحة أولاً': 'Use the opened pack first',
}

// ---- currency -------------------------------------------------------------------------------------

/**
 * Catalogue prices are in USD. Currencies pegged to (or fairly stable against) the dollar get the prices scaled and
 * rounded to a sensible step; any other currency (SYP included) keeps the numbers as they are, and the clinic edits its
 * price list once. Every currency the setup wizard offers is either here or deliberately left out (SYP).
 */
const CURRENCY_SCALE: Record<string, [factor: number, step: number]> = {
  USD: [1, 1], EUR: [0.9, 1], GBP: [0.8, 1],
  SAR: [3.75, 5], AED: [3.67, 5], QAR: [3.64, 5], BHD: [0.376, 0.5], OMR: [0.385, 0.5], KWD: [0.31, 0.5], JOD: [0.71, 0.5],
  EGP: [50, 50], IQD: [1310, 500], TRY: [40, 50], LBP: [89500, 50000],
  MAD: [10, 5], DZD: [135, 100], TND: [3, 1], LYD: [5.5, 5],
}
/**
 * The factor and rounding step for a currency. `decimals` is the clinic's currencyDecimals: a clinic that writes
 * amounts without decimals never gets a fractional step (KWD 0.5 → 1).
 */
export function priceScale(currency?: string, decimals?: number): { factor: number; step: number } {
  const s = CURRENCY_SCALE[(currency || 'USD').toUpperCase()]
  const out = s ? { factor: s[0], step: s[1] } : { factor: 1, step: 1 }
  if (decimals === 0 && out.step < 1) out.step = 1
  return out
}
/** True when seedDefaults() converts the catalogue prices to this currency; otherwise they stay as USD numbers (show t('seed.pricesInUsd')). */
export function scalesPrices(currency?: string): boolean {
  return !!CURRENCY_SCALE[(currency || 'USD').toUpperCase()]
}
/** A USD amount in the clinic currency, rounded to the currency step (never to zero). */
export function scalePrice(usd: number, currency?: string, decimals?: number): number {
  const { factor, step } = priceScale(currency, decimals)
  if (factor === 1 && step === 1) return Math.max(1, Math.round(usd))
  const v = Math.round((usd * factor) / step) * step
  return v > 0 ? Math.round(v * 100) / 100 : step
}
/** Unit costs (inventory) keep cents: scaled, then rounded to 2 decimals. */
export function scaleCost(usd: number, currency?: string): number {
  const { factor } = priceScale(currency)
  return Math.round(usd * factor * 100) / 100
}
