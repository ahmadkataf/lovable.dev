// Clinical scenarios for the demo clinic. A case is what really happens to a patient over several visits:
// the steps (visits) with the procedures done at each, the findings charted at the first exam, the prescription
// and the lab work. demo.ts places the steps on the calendar and derives appointments, treatment items, the chart,
// invoices and the rest from them, so everything stays consistent.
import type { AppointmentType, Gender, LabOrderType, ToothCondition, ToothSurface } from '@/db/types'
import type { Rng } from './rng'
import { LABS } from './names'

export type DoctorRole = 'ortho' | 'surgery' | 'general'
export interface Finding { tooth: number; condition: ToothCondition; surfaces?: ToothSurface[]; note?: string }
export interface StepItem {
  code: string
  tooth?: number
  surfaces?: ToothSurface[]
  /** Items sharing a key across steps are one treatment item done over several visits (root canal, crown, denture…). */
  key?: string
  /** Appended to the procedure name (e.g. the quadrant). */
  label?: string
}
export interface LabSpec {
  type: LabOrderType
  teeth: number[]
  fitStep: number              // the step at which the work is fitted
  item: string                 // key of the treatment item the lab work belongs to
  lab: string
  material?: string
  shade?: string
  cost: number                 // USD
  days: [number, number]       // lab turnaround
  notes?: string
}
export type RxKey = 'endo' | 'surgery' | 'implant' | 'abscess' | 'postExtraction' | 'child' | 'perio' | 'sensitivity' | 'aphthous'
export interface StepDef {
  type: AppointmentType
  reason: string
  items: StepItem[]
  gap?: [number, number]       // days until the next step
  rx?: RxKey
  diagnosis?: string
  note?: string
  lab?: LabSpec
}
export interface CaseDef {
  key: string
  title?: string               // plan title; none = loose items without a plan
  doctor: DoctorRole
  steps: StepDef[]
  findings: Finding[]          // charted at the first visit
  long?: boolean               // may have started before the 90-day window
  planNote?: string
  /** Items of a plan that has no visits yet (a proposal, or one the patient turned down). */
  proposal?: StepItem[]
}
export interface CaseCtx { rng: Rng; age: number; gender: Gender; penicillinAllergy: boolean }

// ---- teeth ------------------------------------------------------------------------------------------
export const MOLARS = [36, 46, 16, 26, 37, 47, 17, 27]
export const PREMOLARS = [14, 15, 24, 25, 34, 35, 44, 45]
export const ANTERIORS = [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43]
export const PRIMARY_MOLARS = [54, 55, 64, 65, 74, 75, 84, 85]
const pos = (t: number) => t % 10
const isAnterior = (t: number) => pos(t) <= 3
const isPrimary = (t: number) => t >= 51

const POSTERIOR_SURFACES: ToothSurface[][] = [['O'], ['O'], ['M', 'O'], ['O', 'D'], ['M', 'O', 'D'], ['O', 'B'], ['M', 'O', 'D', 'B']]
const ANTERIOR_SURFACES: ToothSurface[][] = [['M'], ['D'], ['M', 'I'], ['B'], ['D', 'I']]
export function surfacesFor(rng: Rng, tooth: number): ToothSurface[] {
  return [...rng.pick(isAnterior(tooth) ? ANTERIOR_SURFACES : POSTERIOR_SURFACES)]
}
export function fillingCode(rng: Rng, tooth: number, surfaces: ToothSurface[]): string {
  if (isPrimary(tooth)) return 'D2391P'
  if (isAnterior(tooth)) return 'D2330'
  if (surfaces.length === 1 && rng.chance(0.12)) return 'D2140'
  return surfaces.length >= 4 ? 'D2394' : surfaces.length === 3 ? 'D2393' : surfaces.length === 2 ? 'D2392' : 'D2391'
}
export const rctCode = (t: number) => (pos(t) >= 6 ? 'D3330' : pos(t) >= 4 ? 'D3320' : 'D3310')
const listTeeth = (teeth: number[]) => teeth.join('، ')
const g = (c: CaseCtx, male: string, female: string) => (c.gender === 'female' ? female : male)
const child = (c: CaseCtx) => g(c, 'الطفل', 'الطفلة')
const pt = (c: CaseCtx) => g(c, 'المريض', 'المريضة')

/** What a completed procedure leaves on the chart. */
export function effectOf(code: string, tooth?: number, surfaces?: ToothSurface[]): Finding | null {
  if (!tooth) return null
  switch (code) {
    case 'D2391': case 'D2392': case 'D2393': case 'D2394': case 'D2330': case 'D2140': case 'D2941': case 'D2391P': case 'D2335':
      return { tooth, condition: 'filled', surfaces: surfaces?.length ? surfaces : ['O'] }
    case 'D3310': case 'D3320': case 'D3330': case 'D3348': case 'D3220': case 'D3240':
      return { tooth, condition: 'root_canal' }
    case 'D2740': case 'D2740E': case 'D2750': case 'D2930': case 'D6058':
      return { tooth, condition: 'crown' }
    case 'D6245': return { tooth, condition: 'bridge' }
    case 'D7140': case 'D7210': case 'D7240': case 'D7250': case 'D7111':
      return { tooth, condition: 'missing' }
    case 'D6010': case 'D6010P': return { tooth, condition: 'implant' }
    case 'D1351': return { tooth, condition: 'sealant', surfaces: ['O'] }
    case 'D2962': case 'D2961': return { tooth, condition: 'veneer' }
    default: return null
  }
}

// ---- cases ------------------------------------------------------------------------------------------

/** A routine check-up and cleaning: one visit, no plan. */
export function checkupCase(c: CaseCtx): CaseDef {
  const kid = c.age < 13
  const items: StepItem[] = kid ? [{ code: 'D0145' }, { code: 'D1120' }, { code: 'D1206' }] : [{ code: 'D0120' }, { code: 'D1110' }]
  if (!kid && c.rng.chance(0.35)) items.push({ code: 'D0274' })
  const note = kid
    ? `فحص دوري: ${child(c)} ${g(c, 'متعاون', 'متعاونة')}، لا توجد نخور جديدة. تنظيف وتطبيق فلورايد، وإرشادات للأهل حول التفريش والسكريات.`
    : c.rng.pick([
      'فحص دوري: لا توجد نخور جديدة. تقليح وتلميع وإرشادات للعناية الفموية.',
      'فحص دوري: ترسبات قلحية خفيفة على الأسنان الأمامية السفلية. تقليح وتلميع. المراجعة بعد 6 أشهر.',
      'فحص دوري وتنظيف. اللثة سليمة. يُنصح باستعمال الخيط يومياً.',
    ])
  const cleaning = !kid && c.rng.chance(0.4)
  const reason = kid ? 'فحص دوري للطفل' : cleaning ? 'تنظيف وتلميع' : c.rng.pick(['فحص دوري وتنظيف', 'مراجعة دورية'])
  return { key: 'checkup', doctor: 'general', findings: [], steps: [{ type: cleaning ? 'cleaning' : 'checkup', reason, items, note }] }
}

/** A consultation for a new complaint that needs nothing more today. */
export function consultCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([...MOLARS, ...PREMOLARS])
  const v = c.rng.int(0, 2)
  if (v === 0) return {
    key: 'consult', doctor: 'general', findings: [],
    steps: [{ type: 'consultation', reason: 'استشارة', items: [{ code: 'D9310' }, { code: 'D0330' }], note: `${pt(c)} ${g(c, 'يرغب', 'ترغب')} بتقييم عام للأسنان. أُخذت صورة بانورامية ونوقشت الخيارات العلاجية.` }],
  }
  if (v === 1) return {
    key: 'consult', doctor: 'general', findings: [],
    steps: [{ type: 'consultation', reason: `حساسية في السن ${t}`, items: [{ code: 'D0140' }, { code: 'D0220', tooth: t }, { code: 'D9910' }], rx: 'sensitivity', note: `حساسية على البارد في السن ${t} بسبب انحسار لثوي خفيف. طُبّق مزيل للحساسية ووُصف معجون مناسب.` }],
  }
  return {
    key: 'consult', doctor: 'general', findings: [],
    steps: [{ type: 'emergency', reason: 'قرحة فموية مؤلمة', items: [{ code: 'D0140' }], rx: 'aphthous', diagnosis: 'قرحة قلاعية', note: 'قرحة قلاعية على الغشاء المخاطي للشفة السفلية. لا علامات خطورة. وُصف معجون موضعي وغسول.' }],
  }
}

/** Fillings over two or three visits. */
export function fillingsCase(c: CaseCtx): CaseDef {
  const n = c.rng.int(2, 4)
  const teeth = c.rng.sample([...MOLARS, ...PREMOLARS, ...(c.rng.chance(0.3) ? [11, 21, 12] : [])], n).sort((a, b) => a - b)
  const plan = teeth.map(t => { const s = surfacesFor(c.rng, t); return { t, s, code: fillingCode(c.rng, t, s) } })
  const first = plan.slice(0, Math.ceil(n / 2)), second = plan.slice(Math.ceil(n / 2))
  const steps: StepDef[] = [
    { type: 'checkup', reason: 'فحص شامل', items: [{ code: 'D0150' }, { code: 'D0274' }, ...(c.rng.chance(0.5) ? [{ code: 'D1110' }] : [])], gap: [3, 10],
      note: `فحص شامل وصور مجنّحة: نخور على الأسنان ${listTeeth(teeth)}. الخطة: حشوات تجميلية على ${second.length ? 'جلستين' : 'جلسة واحدة'}.` },
    { type: 'treatment', reason: `حشوات — ${listTeeth(first.map(x => x.t))}`, items: first.map(x => ({ code: x.code, tooth: x.t, surfaces: x.s })), gap: [5, 14],
      note: `حشوات كومبوزيت للأسنان ${listTeeth(first.map(x => x.t))} مع عزل بالقطن ومادة رابطة. الإطباق مضبوط.` },
  ]
  if (second.length) steps.push({ type: 'treatment', reason: `حشوات — ${listTeeth(second.map(x => x.t))}`, items: second.map(x => ({ code: x.code, tooth: x.t, surfaces: x.s })),
    note: `حشوات للأسنان ${listTeeth(second.map(x => x.t))}. اكتملت الخطة الترميمية.` })
  return { key: 'fillings', title: 'خطة ترميمية — حشوات تجميلية', doctor: 'general', steps, findings: plan.map(x => ({ tooth: x.t, condition: 'caries', surfaces: x.s })) }
}

/** Painful tooth → root canal over two visits → build-up and crown from the lab. */
export function endoCrownCase(c: CaseCtx): CaseDef {
  const t = c.rng.weighted<number>([[36, 4], [46, 4], [16, 2], [26, 2], [37, 1], [47, 1], [14, 1], [25, 1], [35, 1]])
  const kind = c.rng.weighted<'zr' | 'emax' | 'pfm'>([['zr', 7], ['emax', 1.5], ['pfm', 1.5]])
  const crown = kind === 'zr' ? 'D2740' : kind === 'emax' ? 'D2740E' : 'D2750'
  const material = kind === 'zr' ? 'زيركون' : kind === 'emax' ? 'إيماكس' : 'خزف على معدن'
  const shade = c.rng.pick(['A1', 'A2', 'A2', 'A3', 'B1', 'A3.5'])
  const days = c.rng.int(2, 6)
  return {
    key: 'endoCrown', title: `معالجة لبية وتاج للسن ${t}`, doctor: 'general',
    findings: [{ tooth: t, condition: 'caries', surfaces: ['O', 'D'] }, ...(c.rng.chance(0.35) ? [{ tooth: t, condition: 'abscess' as const }] : [])],
    planNote: `التاج ${material}، اللون ${shade}.`,
    steps: [
      { type: 'emergency', reason: `ألم شديد في السن ${t}`, items: [{ code: 'D0140' }, { code: 'D0220', tooth: t }, { code: rctCode(t), tooth: t, key: 'rct' }], gap: [4, 8], rx: 'endo',
        diagnosis: `التهاب لب غير عكوس — السن ${t}`,
        note: `${pt(c)} ${g(c, 'يشكو', 'تشكو')} من ألم ليلي نابض في السن ${t} منذ ${days} أيام يزداد مع البارد. الفحص: نخر عميق وألم على القرع. التشخيص: التهاب لب غير عكوس. فُتحت الحجرة اللبية ونُظّفت الأقنية ووُضع ضماد وحشوة مؤقتة.` },
      { type: 'treatment', reason: `إكمال المعالجة اللبية — السن ${t}`, items: [{ code: rctCode(t), tooth: t, key: 'rct' }], gap: [5, 10],
        note: `تحضير الأقنية آلياً وغسلها بالهيبوكلوريت وحشوها بالكوتا بيركا. الصورة الشعاعية النهائية مرضية. يحتاج السن ${t} إلى تاج.` },
      { type: 'treatment', reason: `تحضير السن ${t} للتاج`, items: [{ code: 'D2950', tooth: t }, { code: crown, tooth: t, key: 'crown' }], gap: [7, 11],
        lab: { type: 'crown', teeth: [t], fitStep: 3, item: 'crown', lab: kind === 'pfm' ? LABS.prosth : LABS.digital, material, shade, cost: kind === 'emax' ? 85 : kind === 'zr' ? 70 : 45, days: [6, 9] },
        note: `بناء الجذع بالكومبوزيت وتحضير السن ${t} للتاج. طبعة سيليكون، اللون ${shade}. تاج مؤقت.` },
      { type: 'treatment', reason: `تركيب التاج — السن ${t}`, items: [{ code: crown, tooth: t, key: 'crown' }],
        note: `تجربة التاج: الحواف والتماسات جيدة والإطباق مضبوط. إلصاق نهائي بالإسمنت.` },
    ],
  }
}

/** Implant in a healed site: consultation → surgery → uncovering and impression → implant crown. */
export function implantCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([36, 46, 46, 16, 26, 35, 45, 15, 25])
  const premium = c.rng.chance(0.3)
  const brand = c.rng.pick(['Straumann ‏4.1×10 مم', 'Nobel ‏4.3×11.5 مم', 'Osstem ‏4.5×10 مم', 'MIS ‏4.2×11.5 مم'])
  return {
    key: 'implant', title: `زراعة سن مكان السن ${t}`, doctor: 'surgery', long: true,
    findings: [{ tooth: t, condition: 'missing' }],
    planNote: 'الكلفة والمراحل مشروحة، والتاج بعد 3 أشهر من الزرع.',
    steps: [
      { type: 'consultation', reason: 'استشارة زراعة', items: [{ code: 'D9310' }, { code: 'D0367' }], gap: [7, 20],
        note: `فقد السن ${t} منذ سنوات. التصوير المقطعي: عرض العظم ${c.rng.pick(['6.5', '7', '7.5', '8'])} مم وارتفاعه كافٍ. الخطة: زرعة ثم تاج زيركون بعد 3 أشهر.` },
      { type: 'surgery', reason: `زرع غرسة مكان السن ${t}`, items: [{ code: premium ? 'D6010P' : 'D6010', tooth: t }], gap: [75, 95], rx: 'implant', diagnosis: `فقد السن ${t}`,
        note: `زرع غرسة ${brand} مكان السن ${t} تحت تخدير موضعي. ثبات أولي ممتاز. خياطة وإرشادات ما بعد الجراحة.` },
      { type: 'treatment', reason: 'كشف الزرعة وأخذ الطبعة', items: [{ code: 'D6011', tooth: t }, { code: 'D6058', tooth: t, key: 'icrown' }], gap: [10, 14],
        lab: { type: 'implant_crown', teeth: [t], fitStep: 3, item: 'icrown', lab: LABS.digital, material: 'زيركون على دعامة تيتانيوم', shade: c.rng.pick(['A2', 'A3']), cost: 110, days: [8, 11] },
        note: 'الاندماج العظمي جيد. كشف الزرعة وتركيب دعامة الشفاء وأخذ طبعة بالنقل.' },
      { type: 'treatment', reason: 'تركيب التاج على الزرعة', items: [{ code: 'D6058', tooth: t, key: 'icrown' }], note: 'تركيب التاج على الزرعة وشدّ البرغي 35 نيوتن.سم. الإطباق مضبوط.' },
    ],
  }
}

/** Impacted wisdom tooth removal. */
export function wisdomCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([38, 48])
  return {
    key: 'wisdom', title: `قلع جراحي لضرس العقل ${t}`, doctor: 'surgery',
    findings: [{ tooth: t, condition: 'impacted' }],
    steps: [
      { type: 'consultation', reason: `ألم خلف الأضراس — السن ${t}`, items: [{ code: 'D9310' }, { code: 'D0330' }], gap: [3, 10],
        note: `التهاب متكرر حول ضرس العقل ${t}. الصورة البانورامية: انطمار أفقي جزئي. الخطة: قلع جراحي.` },
      { type: 'surgery', reason: `قلع ضرس العقل ${t}`, items: [{ code: 'D7240', tooth: t }], gap: [7, 8], rx: 'surgery', diagnosis: `ضرس عقل منطمر — السن ${t}`,
        note: `قلع جراحي للسن ${t} مع إزالة عظم وتقسيم السن. خياطة بخيوط 3-0. وُصف مضاد حيوي ومسكن وكمادات باردة.` },
      { type: 'followup', reason: 'مراجعة وفك القطب', items: [{ code: 'D9930' }], note: 'شفاء جيد دون علامات التهاب. فُكّت القطب.' },
    ],
  }
}

/** Fixed braces with monthly adjustments (orthodontist). */
export function bracesCase(c: CaseCtx): CaseDef {
  const ceramic = c.rng.chance(c.age >= 18 ? 0.5 : 0.2)
  const wires = ['NiTi ‏0.016', 'NiTi ‏0.018', 'NiTi ‏0.016×0.022', 'ستانلس ‏0.017×0.025', 'ستانلس ‏0.019×0.025 مع مطاط صنف II', 'ستانلس ‏0.019×0.025']
  const issue = c.rng.pick(['سوء إطباق صنف II مع ازدحام أمامي', 'ازدحام شديد في الفك السفلي', 'عضة عميقة مع بروز الثنايا العلوية', 'تباعد بين الأسنان الأمامية'])
  const steps: StepDef[] = [
    { type: 'consultation', reason: 'استشارة تقويم', items: [{ code: 'D8660' }, { code: 'D0330' }], gap: [7, 14],
      note: `${issue}. أُخذت الطبعات والصور. الخطة: تقويم ثابت ${ceramic ? 'خزفي' : 'معدني'} للفكين لمدة 18–24 شهراً.` },
    { type: 'orthodontic', reason: 'تركيب التقويم الثابت', items: [{ code: ceramic ? 'D8090C' : 'D8090' }], gap: [26, 34],
      note: 'إلصاق الحاصرات على الفكين وتركيب سلك NiTi ‏0.014. شُرحت طريقة العناية بالتقويم والأطعمة الممنوعة.' },
  ]
  for (const w of wires) steps.push({ type: 'orthodontic', reason: 'جلسة شد التقويم', items: [{ code: 'D8670' }], gap: [26, 34],
    note: `تبديل السلك إلى ${w}. ${c.rng.pick([`التعاون جيد والصحة الفموية ممتازة.`, `${pt(c)} ${g(c, 'ملتزم', 'ملتزمة')} بالمطاط.`, 'التهاب لثة خفيف — تأكيد على التفريش.', 'التقدم ممتاز.'])}` })
  return { key: 'braces', title: 'تقويم ثابت للفكين', doctor: 'ortho', long: true, findings: [], steps, planNote: 'الدفع على أقساط شهرية.' }
}

/** Clear aligners (orthodontist, lab-made). */
export function alignersCase(_c: CaseCtx): CaseDef {
  return {
    key: 'aligners', title: 'تقويم شفاف (Aligners)', doctor: 'ortho', long: true, findings: [],
    steps: [
      { type: 'consultation', reason: 'استشارة تقويم شفاف', items: [{ code: 'D8660' }, { code: 'D8090A', key: 'aligners' }], gap: [18, 24],
        lab: { type: 'aligner', teeth: [], fitStep: 1, item: 'aligners', lab: LABS.ortho, material: 'قوالب شفافة — 20 مرحلة', cost: 450, days: [14, 18] },
        note: 'ازدحام خفيف في الفكين. مسح رقمي وصور، وأُرسلت الخطة الرقمية إلى المخبر.' },
      { type: 'orthodontic', reason: 'تسليم القوالب الشفافة', items: [{ code: 'D8090A', key: 'aligners' }], gap: [40, 50],
        note: 'تسليم المجموعة الأولى من القوالب وإلصاق الأزرار. ارتداء 22 ساعة يومياً وتبديل القالب كل أسبوعين.' },
      { type: 'orthodontic', reason: 'متابعة التقويم الشفاف', items: [{ code: 'D8670' }], gap: [40, 50], note: 'التتبع جيد. تسليم المجموعة الثانية.' },
      { type: 'orthodontic', reason: 'متابعة التقويم الشفاف', items: [{ code: 'D8670' }], note: 'تقدم ممتاز وفق الخطة.' },
    ],
  }
}

/** Porcelain veneers on the upper front teeth. */
export function veneersCase(c: CaseCtx): CaseDef {
  const teeth = c.rng.chance(0.35) ? [13, 12, 11, 21, 22, 23] : [12, 11, 21, 22]
  const items = teeth.map(t => ({ code: 'D2962', tooth: t, key: `v${t}` }))
  return {
    key: 'veneers', title: 'تجميل الابتسامة — قشور خزفية', doctor: 'general',
    findings: teeth.filter(() => c.rng.chance(0.4)).map(t => ({ tooth: t, condition: 'filled' as const, surfaces: ['M'] as ToothSurface[] })),
    steps: [
      { type: 'consultation', reason: 'استشارة تجميلية', items: [{ code: 'D9310' }, { code: 'DSD' }], gap: [7, 14],
        note: `تصميم ابتسامة رقمي ومعاينة النتيجة مع ${pt(c)}. اختير اللون BL2 وعدد القشور ${teeth.length}.` },
      { type: 'treatment', reason: 'تحضير القشور الخزفية', items, gap: [10, 14],
        lab: { type: 'veneer', teeth, fitStep: 2, item: `v${teeth[0]}`, lab: LABS.digital, material: 'إيماكس', shade: 'BL2', cost: 90 * teeth.length, days: [8, 11] },
        note: `تحضير محافظ للأسنان ${listTeeth(teeth)} وطبعة رقمية. قشور مؤقتة.` },
      { type: 'treatment', reason: 'إلصاق القشور الخزفية', items, note: 'إلصاق القشور بإسمنت راتنجي ضوئي. النتيجة ممتازة.' },
    ],
  }
}

export function whiteningCase(c: CaseCtx): CaseDef {
  const home = c.rng.chance(0.4)
  return {
    key: 'whitening', title: 'تبييض الأسنان', doctor: 'general', findings: [],
    steps: [
      { type: 'cleaning', reason: 'تنظيف قبل التبييض', items: [{ code: 'D1110' }], gap: [5, 10], note: 'تقليح وتلميع قبل التبييض. اللون الحالي A3.' },
      { type: 'treatment', reason: 'تبييض الأسنان', items: [{ code: 'D9972' }, ...(home ? [{ code: 'D9975' }] : [])], rx: c.rng.chance(0.5) ? 'sensitivity' : undefined,
        note: `تبييض في العيادة على 3 جلسات × 15 دقيقة، وتغيّر اللون من A3 إلى B1${home ? '، مع قوالب منزلية للمتابعة' : ''}. تجنّب المشروبات الملوّنة 48 ساعة.` },
    ],
  }
}

/** A child: exam and fluoride, pulpotomy + stainless steel crown, fillings and sealants. */
export function pediatricCase(c: CaseCtx): CaseDef {
  const deep = c.rng.pick([84, 85, 74, 75, 54, 64])
  const others = c.rng.sample(PRIMARY_MOLARS.filter(t => t !== deep), c.rng.int(1, 2)).sort((a, b) => a - b)
  const fills = others.map(t => ({ t, s: c.rng.pick([['O'], ['O', 'D'], ['M', 'O']] as ToothSurface[][]) }))
  const sealants = c.age >= 6 ? [36, 46].filter(() => c.rng.chance(0.8)) : []
  const kid = child(c)
  const steps: StepDef[] = [
    { type: 'checkup', reason: 'فحص أسنان الطفل', items: [{ code: 'D0145' }, { code: 'D1120' }, { code: 'D1206' }], gap: [5, 12],
      note: `${kid} ${g(c, 'متعاون', 'متعاونة')}. نخر عميق في السن ${deep} ونخور في ${listTeeth(others)}. تطبيق فلورايد. الخطة: بتر لب وتاج ستانلس ستيل ثم حشوات.` },
    { type: 'treatment', reason: `بتر لب السن ${deep}`, items: [{ code: 'D3220', tooth: deep }, { code: 'D2930', tooth: deep }], gap: [7, 14],
      note: `بتر لب السن ${deep} تحت تخدير موضعي وتغطيته بتاج ستانلس ستيل. ${kid} ${g(c, 'تحمّل', 'تحمّلت')} الجلسة جيداً.` },
    { type: 'treatment', reason: 'حشوات أسنان لبنية', items: [...fills.map(f => ({ code: 'D2391P', tooth: f.t, surfaces: f.s })), ...sealants.map(t => ({ code: 'D1351', tooth: t }))],
      note: `حشوات للأسنان ${listTeeth(others)}${sealants.length ? ` وسادّ شقوق للأرحاء ${listTeeth(sealants)}` : ''}.` },
  ]
  const findings: Finding[] = [{ tooth: deep, condition: 'caries', surfaces: ['O', 'D'] }, ...fills.map(f => ({ tooth: f.t, condition: 'caries' as const, surfaces: f.s }))]
  if (c.age >= 7 && c.rng.chance(0.6)) {
    const loose = c.rng.pick([71, 81, 72, 82])
    findings.push({ tooth: loose, condition: 'mobile' })
    steps[2].gap = [10, 20]
    steps.push({ type: 'treatment', reason: `قلع سن لبني متحرك — ${loose}`, items: [{ code: 'D7111', tooth: loose }], note: `قلع السن اللبني ${loose} المتحرك لإفساح المجال للسن الدائم.` })
  }
  return { key: 'pediatric', title: 'علاج أسنان الطفل', doctor: 'general', steps, findings }
}

export function perioCase(c: CaseCtx): CaseDef {
  const findings: Finding[] = c.age > 50 ? [{ tooth: 31, condition: 'mobile' }, { tooth: 41, condition: 'mobile' }] : []
  return {
    key: 'perio', title: 'علاج اللثة — تجريف وتسوية جذور', doctor: 'general', long: true, findings,
    steps: [
      { type: 'checkup', reason: 'نزف لثوي', items: [{ code: 'D0150' }, { code: 'D0330' }], gap: [5, 10],
        note: `نزف عند التفريش ورائحة فم. جيوب لثوية 4–6 مم في المناطق الخلفية. التشخيص: التهاب نسج داعمة مزمن. الخطة: تجريف وتسوية جذور على جلستين.` },
      { type: 'treatment', reason: 'تجريف الفك العلوي', items: [{ code: 'D4341', label: 'الربع العلوي الأيمن' }, { code: 'D4341', label: 'الربع العلوي الأيسر' }], gap: [7, 14], rx: 'perio',
        note: 'تجريف وتسوية جذور للربعين العلويين تحت تخدير موضعي. إرشادات التفريش والخيط.' },
      { type: 'treatment', reason: 'تجريف الفك السفلي', items: [{ code: 'D4341', label: 'الربع السفلي الأيسر' }, { code: 'D4341', label: 'الربع السفلي الأيمن' }], gap: [60, 90],
        note: 'تجريف وتسوية جذور للربعين السفليين. تحسّن واضح في الفك العلوي.' },
      { type: 'checkup', reason: 'صيانة لثوية', items: [{ code: 'D4910' }], note: 'الجيوب تراجعت إلى 3 مم. صيانة لثوية كل 3 أشهر.' },
    ],
  }
}

/** Three-unit zirconia bridge over a missing tooth. */
export function bridgeCase(c: CaseCtx): CaseDef {
  const pontic = c.rng.pick([36, 46, 25, 15, 35, 45])
  const units = [pontic - 1, pontic, pontic + 1]
  const shade = c.rng.pick(['A2', 'A3'])
  const items = units.map(t => ({ code: 'D6245', tooth: t, key: `b${t}` }))
  return {
    key: 'bridge', title: `جسر ثابت ${units[0]}–${units[2]}`, doctor: 'general',
    findings: [{ tooth: pontic, condition: 'missing' }, { tooth: units[0], condition: 'filled', surfaces: ['O', 'D'] }],
    steps: [
      { type: 'consultation', reason: `تعويض السن ${pontic}`, items: [{ code: 'D9310' }, { code: 'D0330' }], gap: [5, 12],
        note: `فقد السن ${pontic} منذ سنوات. ${pt(c)} لا ${g(c, 'يرغب', 'ترغب')} بالزرع. الخطة: جسر زيركون ثلاثي الوحدات ${units[0]}–${units[2]}.` },
      { type: 'treatment', reason: 'تحضير دعامتي الجسر', items, gap: [8, 12],
        lab: { type: 'bridge', teeth: units, fitStep: 2, item: `b${units[0]}`, lab: LABS.digital, material: 'زيركون', shade, cost: 210, days: [8, 11] },
        note: `تحضير السنين ${units[0]} و${units[2]} وطبعة سيليكون، اللون ${shade}. جسر مؤقت.` },
      { type: 'treatment', reason: 'تركيب الجسر', items, note: 'تجربة الجسر وإلصاقه نهائياً. شُرح استعمال خيط الجسور.' },
    ],
  }
}

export function dentureCase(c: CaseCtx): CaseDef {
  const upper = c.rng.chance(0.6)
  const arch = upper ? [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27] : [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]
  const label = upper ? 'علوي' : 'سفلي'
  return {
    key: 'denture', title: `طقم كامل ${label}`, doctor: 'general',
    findings: arch.map(t => ({ tooth: t, condition: 'missing' as const })),
    steps: [
      { type: 'consultation', reason: `طقم ${label}`, items: [{ code: 'D0150' }, { code: 'D0330' }], gap: [5, 10], note: `فقد كامل للأسنان في الفك ${label}. الخطة: طقم كامل أكريلي.` },
      { type: 'treatment', reason: 'طبعات الطقم', items: [{ code: 'D5110', key: 'dent', label }], gap: [6, 9],
        lab: { type: 'denture_full', teeth: [], fitStep: 3, item: 'dent', lab: LABS.prosth, material: 'أكريل حراري', shade: 'A3', cost: 120, days: [14, 18] },
        note: 'طبعات أولية ونهائية بالحواف الوظيفية.' },
      { type: 'treatment', reason: 'تجربة الأسنان', items: [{ code: 'D5110', key: 'dent', label }], gap: [6, 9], note: 'تسجيل العلاقة الفكية وتجربة الأسنان على الشمع. المظهر مقبول.' },
      { type: 'treatment', reason: 'تسليم الطقم', items: [{ code: 'D5110', key: 'dent', label }], gap: [5, 8], note: 'تسليم الطقم وشرح طريقة الاستعمال والتنظيف.' },
      { type: 'followup', reason: 'تعديل الطقم', items: [{ code: 'D5410' }], note: 'تعديل نقاط ضغط بسيطة. الثبات جيد.' },
    ],
  }
}

/** Abscess drained, then the hopeless tooth is extracted. */
export function emergencyCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([...MOLARS.slice(0, 6), 14, 24])
  return {
    key: 'emergency', doctor: 'general',
    findings: [{ tooth: t, condition: 'abscess' }, { tooth: t, condition: 'to_extract' }],
    steps: [
      { type: 'emergency', reason: `تورم وألم — السن ${t}`, items: [{ code: 'D0140' }, { code: 'D0220', tooth: t }, { code: 'D7510', tooth: t }], gap: [3, 6], rx: 'abscess',
        diagnosis: `خراج ذروي حاد — السن ${t}`, note: `تورم مؤلم حول السن ${t} منذ يومين. السن غير قابل للترميم. شق وتفجير الخراج ووصف مضاد حيوي. القلع بعد زوال التورم.` },
      { type: 'surgery', reason: `قلع السن ${t}`, items: [{ code: c.rng.chance(0.6) ? 'D7140' : 'D7210', tooth: t }], rx: 'postExtraction',
        note: `قلع السن ${t} بعد زوال الالتهاب. إرشادات ما بعد القلع.` },
    ],
  }
}

export function nightGuardCase(c: CaseCtx): CaseDef {
  return {
    key: 'nightGuard', doctor: 'general', title: 'واقي ليلي للصرير',
    findings: [11, 21, 31, 41].map(t => ({ tooth: t, condition: 'attrition' as const })),
    steps: [
      { type: 'checkup', reason: 'صرير ليلي وألم في الفك', items: [{ code: 'D0150' }, { code: 'D9944', key: 'ng' }], gap: [7, 10],
        lab: { type: 'night_guard', teeth: [], fitStep: 1, item: 'ng', lab: LABS.prosth, material: 'أكريل صلب', cost: 35, days: [5, 8] },
        note: `${pt(c)} ${g(c, 'يشكو', 'تشكو')} من ألم صباحي في عضلات المضغ. تآكل على الأسنان الأمامية. طبعات لواقٍ ليلي.` },
      { type: 'followup', reason: 'تسليم الواقي الليلي', items: [{ code: 'D9944', key: 'ng' }], note: 'تسليم الواقي الليلي وضبط الإطباق.' },
    ],
  }
}

/** A treatment the patient was offered but has not started (draft plan) or turned down (cancelled plan). */
export function proposalCase(c: CaseCtx, declined: boolean): CaseDef {
  const v = c.rng.int(0, 2)
  if (v === 0) {
    const t = c.rng.pick([36, 46, 26])
    return { key: declined ? 'declined' : 'proposal', title: `زراعة سن مكان السن ${t} (اقتراح)`, doctor: 'surgery', findings: [], steps: [], planNote: declined ? `${pt(c)} ${g(c, 'فضّل', 'فضّلت')} تأجيل الزراعة لأسباب مادية.` : `بانتظار موافقة ${pt(c)}.`,
      proposal: [{ code: 'D0367' }, { code: 'D6010', tooth: t }, { code: 'D6058', tooth: t }] }
  }
  if (v === 1) return { key: declined ? 'declined' : 'proposal', title: 'تبييض وقشور تجميلية (اقتراح)', doctor: 'general', findings: [], steps: [], planNote: declined ? `أُلغيت الخطة بطلب ${pt(c)}.` : 'عُرضت الكلفة، والقرار بعد الأعياد.',
    proposal: [{ code: 'D9972' }, { code: 'D2962', tooth: 11 }, { code: 'D2962', tooth: 21 }] }
  return { key: declined ? 'declined' : 'proposal', title: 'تقويم شفاف (اقتراح)', doctor: 'ortho', findings: [], steps: [], planNote: declined ? `${pt(c)} ${g(c, 'اختار', 'اختارت')} التقويم الثابت في مكان آخر.` : 'بانتظار الموافقة على الكلفة.',
    proposal: [{ code: 'D8660' }, { code: 'D8090A' }] }
}

// ---- prescriptions ----------------------------------------------------------------------------------

/** Drugs by [English name, strength] as in the catalogue. */
type DrugRef = readonly [nameEn: string, strength: string]
const AMOX: DrugRef = ['Amoxicillin', '500 mg']
const AUG: DrugRef = ['Amoxicillin + Clavulanate (Augmentin)', '1 g']
const CLINDA: DrugRef = ['Clindamycin', '300 mg']
const METRO: DrugRef = ['Metronidazole (Flagyl)', '500 mg']
const IBU4: DrugRef = ['Ibuprofen', '400 mg']
const IBU6: DrugRef = ['Ibuprofen', '600 mg']
const PARA: DrugRef = ['Paracetamol', '500 mg']
const PARA1: DrugRef = ['Paracetamol', '1 g']
const DEXA: DrugRef = ['Dexamethasone', '4 mg']
const CHX: DrugRef = ['Chlorhexidine mouthwash', '0.12%']
const HYAL: DrugRef = ['Hyaluronic acid gel', '0.2%']
export const RX: Record<RxKey, DrugRef[]> = {
  endo: [AMOX, IBU4],
  surgery: [AUG, IBU6, DEXA, CHX],
  implant: [AUG, IBU6, CHX, HYAL],
  abscess: [AMOX, METRO, IBU4],
  postExtraction: [PARA1, CHX],
  child: [['Amoxicillin suspension', '250 mg / 5 ml'], ['Paracetamol syrup', '120 mg / 5 ml']],
  perio: [CHX, METRO],
  sensitivity: [['Sensitivity toothpaste', '5% نترات البوتاسيوم'], ['High-fluoride toothpaste', '5000 ppm']],
  aphthous: [['Triamcinolone oral paste', '0.1%'], ['Benzydamine mouthwash', '0.15%']],
}
/** The patient's allergies change the prescription: no penicillins, no NSAIDs. */
export function rxFor(key: RxKey, allergies: string[]): DrugRef[] {
  const pen = allergies.includes('البنسلين')
  const nsaid = allergies.includes('الإيبوبروفين') || allergies.includes('الأسبرين')
  const out: DrugRef[] = []
  for (const d of RX[key]) {
    let x = d
    if (pen && (d === AMOX || d === AUG)) x = CLINDA
    if (pen && d[0] === 'Amoxicillin suspension') continue
    if (nsaid && (d === IBU4 || d === IBU6)) x = PARA
    if (!out.includes(x)) out.push(x)
  }
  return out
}
