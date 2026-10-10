// The default catalogue a new clinic starts with: procedures with prices, the drugs dentists prescribe most, and the
// usual consumables. Prices are typical Levant private-clinic prices in USD; pegged currencies are scaled on insert.
import type { ProcedureCategory } from '@/db/types'

export interface ProcedureDef {
  code: string
  name: string
  nameEn: string
  category: ProcedureCategory
  price: number            // USD
  durationMin: number
  toothSpecific: boolean
}

const P = (code: string, name: string, nameEn: string, category: ProcedureCategory, price: number, durationMin: number, toothSpecific = false): ProcedureDef =>
  ({ code, name, nameEn, category, price, durationMin, toothSpecific })

export const DEFAULT_PROCEDURES: ProcedureDef[] = [
  // diagnostic
  P('D0150', 'فحص شامل وخطة علاج', 'Comprehensive oral exam', 'diagnostic', 15, 30),
  P('D0120', 'فحص دوري', 'Periodic oral exam', 'diagnostic', 10, 15),
  P('D0140', 'فحص إسعافي', 'Emergency (limited) exam', 'diagnostic', 10, 15),
  P('D9310', 'استشارة', 'Consultation', 'diagnostic', 15, 30),
  P('D0220', 'صورة شعاعية ذروية', 'Periapical X-ray', 'diagnostic', 5, 10, true),
  P('D0274', 'صور مجنّحة (عضّة)', 'Bitewing X-rays', 'diagnostic', 10, 10),
  P('D0330', 'صورة بانورامية (OPG)', 'Panoramic X-ray', 'diagnostic', 20, 15),
  P('D0367', 'تصوير مقطعي CBCT', 'CBCT scan', 'diagnostic', 70, 20),
  // preventive
  P('D1110', 'تقليح وتلميع', 'Scaling and polishing', 'preventive', 40, 45),
  P('D4355', 'تقليح عميق لكامل الفم', 'Full-mouth debridement', 'preventive', 60, 60),
  P('D1206', 'تطبيق فلورايد (ورنيش)', 'Fluoride varnish', 'preventive', 15, 15),
  P('D1351', 'سادّ شقوق وميازيب', 'Fissure sealant', 'preventive', 15, 15, true),
  P('D9910', 'علاج حساسية الأسنان', 'Desensitizing treatment', 'preventive', 20, 20),
  // restorative
  P('D2391', 'حشوة كومبوزيت — سطح واحد', 'Composite filling — 1 surface', 'restorative', 35, 30, true),
  P('D2392', 'حشوة كومبوزيت — سطحان', 'Composite filling — 2 surfaces', 'restorative', 50, 45, true),
  P('D2393', 'حشوة كومبوزيت — ثلاثة سطوح', 'Composite filling — 3 surfaces', 'restorative', 65, 60, true),
  P('D2394', 'حشوة كومبوزيت — أربعة سطوح أو أكثر', 'Composite filling — 4+ surfaces', 'restorative', 80, 60, true),
  P('D2330', 'حشوة كومبوزيت أمامية', 'Anterior composite filling', 'restorative', 40, 30, true),
  P('D2140', 'حشوة أملغم — سطح واحد', 'Amalgam filling — 1 surface', 'restorative', 25, 30, true),
  P('D2941', 'حشوة زجاجية شاردية (GIC)', 'Glass-ionomer filling', 'restorative', 25, 20, true),
  P('D2940', 'حشوة مؤقتة', 'Temporary filling', 'restorative', 10, 15, true),
  P('D2950', 'بناء جذع بالكومبوزيت', 'Core build-up', 'restorative', 45, 45, true),
  P('D2954', 'وتد ليفي جاهز', 'Prefabricated fiber post', 'restorative', 40, 30, true),
  P('D2643', 'حشوة مخبرية خزفية (أونليه)', 'Ceramic onlay', 'restorative', 180, 60, true),
  // endodontic
  P('D3221', 'فتح وتفريغ إسعافي للعصب', 'Emergency pulpal debridement', 'endodontic', 30, 30, true),
  P('D3310', 'معالجة لبية — سن أمامي', 'Root canal — anterior', 'endodontic', 100, 60, true),
  P('D3320', 'معالجة لبية — ضاحك', 'Root canal — premolar', 'endodontic', 150, 60, true),
  P('D3330', 'معالجة لبية — رحى', 'Root canal — molar', 'endodontic', 200, 90, true),
  P('D3348', 'إعادة معالجة لبية', 'Root canal retreatment', 'endodontic', 250, 90, true),
  // periodontic
  P('D4341', 'تجريف وتسوية جذور (ربع فك)', 'Scaling and root planing (quadrant)', 'periodontic', 50, 45),
  P('D4910', 'صيانة لثوية دورية', 'Periodontal maintenance', 'periodontic', 45, 45),
  P('D4210', 'قطع لثة', 'Gingivectomy', 'periodontic', 40, 30, true),
  P('D4249', 'إطالة تاج سريري', 'Crown lengthening', 'periodontic', 150, 60, true),
  // prosthodontic
  P('D2740', 'تاج زيركون', 'Zirconia crown', 'prosthodontic', 280, 60, true),
  P('D2740E', 'تاج إيماكس (خزف زجاجي)', 'E.max crown', 'prosthodontic', 330, 60, true),
  P('D2750', 'تاج خزف على معدن', 'Porcelain-fused-to-metal crown', 'prosthodontic', 180, 60, true),
  P('D2799', 'تاج مؤقت', 'Temporary crown', 'prosthodontic', 25, 30, true),
  P('D6245', 'وحدة جسر زيركون', 'Zirconia bridge unit', 'prosthodontic', 260, 45, true),
  P('D5110', 'طقم كامل (فك واحد)', 'Complete denture (one arch)', 'prosthodontic', 350, 45),
  P('D5213', 'طقم جزئي هيكلي', 'Cast partial denture', 'prosthodontic', 400, 45),
  P('D5211', 'طقم جزئي أكريلي', 'Acrylic partial denture', 'prosthodontic', 180, 45),
  P('D5410', 'تعديل طقم', 'Denture adjustment', 'prosthodontic', 15, 20),
  // surgical
  P('D7140', 'قلع بسيط', 'Simple extraction', 'surgical', 30, 30, true),
  P('D7210', 'قلع جراحي', 'Surgical extraction', 'surgical', 70, 45, true),
  P('D7240', 'قلع ضرس عقل منطمر', 'Impacted wisdom tooth removal', 'surgical', 120, 60, true),
  P('D7250', 'قلع بقايا جذر', 'Root remnant removal', 'surgical', 45, 30, true),
  P('D7510', 'شق وتفجير خراج', 'Abscess incision and drainage', 'surgical', 30, 20, true),
  P('D7953', 'طعم عظمي للسنخ', 'Socket bone graft', 'surgical', 150, 30, true),
  P('D9930', 'مراجعة بعد الجراحة وفك القطب', 'Post-operative review and suture removal', 'surgical', 10, 15),
  // implant
  P('D6010', 'زرعة سنية', 'Dental implant', 'implant', 650, 90, true),
  P('D6010P', 'زرعة سنية (فئة ممتازة)', 'Premium dental implant', 'implant', 850, 90, true),
  P('D6011', 'كشف الزرعة وتركيب دعامة الشفاء', 'Implant uncovering and healing abutment', 'implant', 40, 30, true),
  P('D6058', 'تاج زيركون على زرعة', 'Zirconia implant crown', 'implant', 320, 45, true),
  P('D7951', 'رفع جيب فكي', 'Sinus lift', 'implant', 400, 90, true),
  P('D6080', 'تنظيف وصيانة الزرعات', 'Implant maintenance', 'implant', 40, 30),
  // orthodontic
  P('D8660', 'استشارة تقويم مع السجلات', 'Orthodontic consultation and records', 'orthodontic', 30, 45),
  P('D8090', 'تقويم ثابت معدني (فكان)', 'Fixed metal braces (both arches)', 'orthodontic', 1200, 90),
  P('D8090C', 'تقويم ثابت خزفي (فكان)', 'Fixed ceramic braces (both arches)', 'orthodontic', 1600, 90),
  P('D8090A', 'تقويم شفاف (Aligners)', 'Clear aligners', 'orthodontic', 1900, 45),
  P('D8670', 'جلسة شد تقويم شهرية', 'Monthly orthodontic adjustment', 'orthodontic', 25, 30),
  P('D8680', 'مثبّت بعد التقويم', 'Retainer after orthodontics', 'orthodontic', 80, 30),
  P('D8210', 'جهاز تقويم متحرك للأطفال', 'Removable appliance (child)', 'orthodontic', 250, 45),
  // pediatric
  P('D0145', 'فحص أسنان الطفل', "Child's dental exam", 'pediatric', 10, 20),
  P('D1120', 'تنظيف أسنان الأطفال', 'Child prophylaxis', 'pediatric', 25, 30),
  P('D2391P', 'حشوة سن لبني', 'Primary tooth filling', 'pediatric', 25, 30, true),
  P('D3220', 'بتر لب سن لبني', 'Pulpotomy (primary tooth)', 'pediatric', 40, 30, true),
  P('D3240', 'معالجة لبية لسن لبني', 'Pulpectomy (primary tooth)', 'pediatric', 60, 45, true),
  P('D2930', 'تاج ستانلس ستيل للأطفال', 'Stainless steel crown', 'pediatric', 50, 30, true),
  P('D7111', 'قلع سن لبني', 'Primary tooth extraction', 'pediatric', 20, 20, true),
  P('D1510', 'حافظ مسافة', 'Space maintainer', 'pediatric', 90, 30, true),
  // cosmetic
  P('D9972', 'تبييض الأسنان في العيادة', 'In-office whitening', 'cosmetic', 220, 90),
  P('D9975', 'تبييض منزلي (قوالب وجل)', 'Take-home whitening kit', 'cosmetic', 150, 30),
  P('D2962', 'قشرة خزفية (فينير)', 'Porcelain veneer', 'cosmetic', 320, 60, true),
  P('D2961', 'فينير كومبوزيت مباشر', 'Direct composite veneer', 'cosmetic', 120, 60, true),
  P('D2335', 'إغلاق فراغ أمامي بالكومبوزيت', 'Diastema closure (composite)', 'cosmetic', 60, 45, true),
  P('DSD', 'تصميم ابتسامة رقمي', 'Digital smile design', 'cosmetic', 100, 45),
  // other
  P('D9944', 'واقي ليلي للصرير', 'Night guard', 'other', 120, 30),
  P('D9110', 'معالجة إسعافية للألم', 'Palliative emergency treatment', 'other', 20, 20, true),
  P('D9450', 'تقرير طبي', 'Medical report', 'other', 10, 15),
]

export interface DrugDef {
  name: string
  nameEn: string
  form: string
  strength: string
  dose: string
  frequency: string
  duration: string
  instructions: string
}
const D = (name: string, nameEn: string, form: string, strength: string, dose: string, frequency: string, duration: string, instructions: string): DrugDef =>
  ({ name, nameEn, form, strength, dose, frequency, duration, instructions })

export const DEFAULT_DRUGS: DrugDef[] = [
  // antibiotics
  D('أموكسيسيلين', 'Amoxicillin', 'كبسولات', '500 mg', 'كبسولة واحدة', 'كل 8 ساعات', '5 أيام', 'بعد الطعام، ويُكمل العلاج كاملاً ولو زال الألم'),
  D('أموكسيسيلين + حمض الكلافولانيك (أوغمنتين)', 'Amoxicillin + Clavulanate (Augmentin)', 'أقراص', '1 g', 'حبة واحدة', 'كل 12 ساعة', '7 أيام', 'في بداية الطعام'),
  D('أموكسيسيلين + حمض الكلافولانيك (أوغمنتين)', 'Amoxicillin + Clavulanate (Augmentin)', 'أقراص', '625 mg', 'حبة واحدة', 'كل 8 ساعات', '5 أيام', 'في بداية الطعام'),
  D('أموكسيسيلين معلّق للأطفال', 'Amoxicillin suspension', 'معلّق فموي', '250 mg / 5 ml', '5 مل', 'كل 8 ساعات', '5 أيام', 'تُرجّ العبوة قبل الاستعمال وتُحفظ في البراد'),
  D('ميترونيدازول (فلاجيل)', 'Metronidazole (Flagyl)', 'أقراص', '500 mg', 'حبة واحدة', 'كل 8 ساعات', '5 أيام', 'بعد الطعام، ويُمنع تناول الكحول أثناء العلاج'),
  D('كليندامايسين', 'Clindamycin', 'كبسولات', '300 mg', 'كبسولة واحدة', 'كل 8 ساعات', '7 أيام', 'مع كوب ماء كامل — بديل عند التحسس من البنسلين'),
  D('أزيثرومايسين', 'Azithromycin', 'أقراص', '500 mg', 'حبة واحدة', 'مرة يومياً', '3 أيام', 'قبل الطعام بساعة أو بعده بساعتين'),
  D('سيفالكسين', 'Cephalexin', 'كبسولات', '500 mg', 'كبسولة واحدة', 'كل 6 ساعات', '5 أيام', 'قبل الطعام أو بعده'),
  D('دوكسيسيكلين', 'Doxycycline', 'كبسولات', '100 mg', 'كبسولة واحدة', 'مرة يومياً', '10 أيام', 'مع كوب ماء كامل، وعدم الاستلقاء بعدها مباشرة'),
  // analgesics and anti-inflammatories
  D('إيبوبروفين', 'Ibuprofen', 'أقراص', '400 mg', 'حبة واحدة', 'كل 8 ساعات عند الألم', '3 أيام', 'بعد الطعام'),
  D('إيبوبروفين', 'Ibuprofen', 'أقراص', '600 mg', 'حبة واحدة', 'كل 8 ساعات', '3 أيام', 'بعد الطعام مباشرة'),
  D('إيبوبروفين شراب للأطفال', 'Ibuprofen syrup', 'شراب', '100 mg / 5 ml', '5 مل', 'كل 8 ساعات عند الألم', '3 أيام', 'بعد الطعام، والجرعة حسب وزن الطفل'),
  D('باراسيتامول', 'Paracetamol', 'أقراص', '500 mg', 'حبة أو حبتان', 'كل 6 ساعات عند اللزوم', 'عند اللزوم', 'لا تتجاوز 8 حبات في اليوم'),
  D('باراسيتامول', 'Paracetamol', 'أقراص فوّارة', '1 g', 'قرص واحد', 'كل 8 ساعات عند الألم', '3 أيام', 'يُذاب في كأس ماء'),
  D('باراسيتامول شراب للأطفال', 'Paracetamol syrup', 'شراب', '120 mg / 5 ml', '5–10 مل', 'كل 6 ساعات عند الحرارة أو الألم', 'عند اللزوم', 'حسب وزن الطفل'),
  D('ديكلوفيناك الصوديوم', 'Diclofenac sodium', 'أقراص', '50 mg', 'حبة واحدة', 'كل 8 ساعات', '3 أيام', 'بعد الطعام'),
  D('ديكلوفيناك البوتاسيوم', 'Diclofenac potassium', 'أقراص', '50 mg', 'حبة واحدة', 'كل 12 ساعة', '3 أيام', 'بعد الطعام'),
  D('كيتوبروفين', 'Ketoprofen', 'كبسولات', '100 mg', 'كبسولة واحدة', 'مرتين يومياً', '3 أيام', 'بعد الطعام مباشرة'),
  D('نابروكسين', 'Naproxen', 'أقراص', '500 mg', 'حبة واحدة', 'مرتين يومياً', '3 أيام', 'بعد الطعام'),
  D('حمض الميفيناميك', 'Mefenamic acid', 'كبسولات', '500 mg', 'كبسولة واحدة', 'كل 8 ساعات', '3 أيام', 'بعد الطعام'),
  D('ديكساميثازون', 'Dexamethasone', 'أقراص', '4 mg', 'حبة واحدة', 'صباحاً', '3 أيام', 'بعد الفطور — لتخفيف الوذمة بعد الجراحة'),
  D('أوميبرازول', 'Omeprazole', 'كبسولات', '20 mg', 'كبسولة واحدة', 'مرة يومياً', 'طوال مدة المسكّن', 'قبل الفطور بنصف ساعة، لحماية المعدة'),
  D('حمض الترانيكساميك', 'Tranexamic acid', 'أقراص', '500 mg', 'حبة واحدة', 'كل 8 ساعات', 'يومان', 'لضبط النزف بعد القلع'),
  // mouthwashes and topical
  D('كلورهيكسيدين غسول فموي', 'Chlorhexidine mouthwash', 'غسول فموي', '0.12%', 'مضمضة 15 مل لمدة 30 ثانية', 'مرتين يومياً', '7 أيام', 'بعد تفريش الأسنان، دون بلع، وعدم الأكل نصف ساعة بعدها'),
  D('كلورهيكسيدين جل', 'Chlorhexidine gel', 'جل فموي', '1%', 'كمية صغيرة على اللثة', 'مرتين يومياً', '10 أيام', 'بعد تنظيف الأسنان'),
  D('بنزيدامين غسول فموي', 'Benzydamine mouthwash', 'غسول فموي', '0.15%', 'مضمضة 15 مل', '3 مرات يومياً', '5 أيام', 'يُستعمل دون تمديد ودون بلع'),
  D('بنزيدامين بخاخ فموي', 'Benzydamine oral spray', 'بخاخ فموي', '0.15%', '4 بخات', '3 مرات يومياً', '5 أيام', 'على المنطقة المؤلمة'),
  D('نيستاتين', 'Nystatin', 'معلّق فموي', '100,000 IU / ml', '1 مل', '4 مرات يومياً', '14 يوماً', 'يُبقى في الفم أطول مدة ممكنة ثم يُبلع'),
  D('ميكونازول جل فموي', 'Miconazole oral gel', 'جل فموي', '2%', 'نصف ملعقة صغيرة', '4 مرات يومياً', '7 أيام', 'بعد الطعام، ويُوضع على الآفات'),
  D('أسيكلوفير كريم', 'Acyclovir cream', 'كريم', '5%', 'طبقة رقيقة', '5 مرات يومياً', '5 أيام', 'على الحويصلات عند أول ظهورها'),
  D('أسيكلوفير', 'Acyclovir', 'أقراص', '400 mg', 'حبة واحدة', '3 مرات يومياً', '5 أيام', 'مع كمية وافرة من الماء'),
  D('تريامسينولون معجون فموي', 'Triamcinolone oral paste', 'معجون فموي', '0.1%', 'كمية صغيرة على القرحة', '3 مرات يومياً', '5 أيام', 'بعد الطعام وقبل النوم دون فرك'),
  D('حمض الهيالورونيك جل', 'Hyaluronic acid gel', 'جل فموي', '0.2%', 'كمية صغيرة على اللثة', '3 مرات يومياً', '7 أيام', 'بعد الطعام، وعدم الأكل نصف ساعة بعدها'),
  D('ليدوكائين جل موضعي', 'Lidocaine gel', 'جل موضعي', '2%', 'كمية صغيرة', 'عند اللزوم', 'عند اللزوم', 'على المنطقة المؤلمة، لا يُستعمل قبل الأكل مباشرة'),
  D('فلورايد جل', 'Fluoride gel', 'جل', '1.23% APF', 'كمية تكفي القالب', 'مرة يومياً قبل النوم', '4 أسابيع', 'يُوضع بالقالب 4 دقائق ثم يُبصق دون مضمضة'),
  D('معجون فلورايد عالي التركيز', 'High-fluoride toothpaste', 'معجون أسنان', '5000 ppm', 'بحجم حبة البازلاء', 'مرتين يومياً', '3 أشهر', 'يُبصق دون مضمضة بعد التفريش'),
  D('معجون أسنان للأسنان الحساسة', 'Sensitivity toothpaste', 'معجون أسنان', '5% نترات البوتاسيوم', 'بحجم حبة البازلاء', 'مرتين يومياً', '4 أسابيع', 'يُترك على الأسنان دقيقة قبل البصق'),
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
