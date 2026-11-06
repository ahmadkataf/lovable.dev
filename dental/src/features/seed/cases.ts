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
export interface CaseCtx { rng: Rng; age: number; gender: Gender; penicillinAllergy: boolean; lang?: 'ar' | 'en' }
/** The text of the clinic's language: the demo clinic writes its notes in the language it works in. */
export const L = (c: Pick<CaseCtx, 'lang'>, ar: string, en: string) => (c.lang === 'en' ? en : ar)

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
  if (isPrimary(tooth)) return 'child-filling'
  if (isAnterior(tooth)) return 'comp-anterior'
  if (surfaces.length === 1 && rng.chance(0.12)) return 'amalgam-1'
  return surfaces.length >= 4 ? 'comp-4' : surfaces.length === 3 ? 'comp-3' : surfaces.length === 2 ? 'comp-2' : 'comp-1'
}
export const rctCode = (t: number) => (pos(t) >= 6 ? 'rct-molar' : pos(t) >= 4 ? 'rct-premolar' : 'rct-anterior')
const listTeeth = (teeth: number[], c?: Pick<CaseCtx, 'lang'>) => teeth.join(c?.lang === 'en' ? ', ' : '، ')
const g = (c: CaseCtx, male: string, female: string) => (c.gender === 'female' ? female : male)
const child = (c: CaseCtx) => L(c, g(c, 'الطفل', 'الطفلة'), 'The child')
const pt = (c: CaseCtx) => L(c, g(c, 'المريض', 'المريضة'), 'The patient')
const ptLow = (c: CaseCtx) => L(c, g(c, 'المريض', 'المريضة'), 'the patient')

/** What a completed procedure leaves on the chart. */
export function effectOf(code: string, tooth?: number, surfaces?: ToothSurface[]): Finding | null {
  if (!tooth) return null
  switch (code) {
    case 'comp-1': case 'comp-2': case 'comp-3': case 'comp-4': case 'comp-anterior': case 'amalgam-1': case 'gic': case 'child-filling': case 'diastema':
      return { tooth, condition: 'filled', surfaces: surfaces?.length ? surfaces : ['O'] }
    case 'rct-anterior': case 'rct-premolar': case 'rct-molar': case 'rct-retreat': case 'pulpotomy': case 'pulpectomy':
      return { tooth, condition: 'root_canal' }
    case 'crown-zirconia': case 'crown-emax': case 'crown-pfm': case 'ssc': case 'implant-crown':
      return { tooth, condition: 'crown' }
    case 'bridge-zirconia': return { tooth, condition: 'bridge' }
    case 'ext-simple': case 'ext-surgical': case 'ext-wisdom': case 'ext-root': case 'child-ext':
      return { tooth, condition: 'missing' }
    case 'implant': case 'implant-premium': return { tooth, condition: 'implant' }
    case 'sealant': return { tooth, condition: 'sealant', surfaces: ['O'] }
    case 'veneer-porcelain': case 'veneer-composite': return { tooth, condition: 'veneer' }
    default: return null
  }
}

// ---- cases ------------------------------------------------------------------------------------------

/** A routine check-up and cleaning: one visit, no plan. */
export function checkupCase(c: CaseCtx): CaseDef {
  const kid = c.age < 13
  const items: StepItem[] = kid ? [{ code: 'child-exam' }, { code: 'child-cleaning' }, { code: 'fluoride-varnish' }] : [{ code: 'exam-periodic' }, { code: 'scaling' }]
  if (!kid && c.rng.chance(0.35)) items.push({ code: 'xray-bitewing' })
  const note = kid
    ? L(c, `فحص دوري: ${child(c)} ${g(c, 'متعاون', 'متعاونة')}، لا توجد نخور جديدة. تنظيف وتطبيق فلورايد، وإرشادات للأهل حول التفريش والسكريات.`,
      'Routine check-up: the child was cooperative, no new caries. Cleaning and fluoride varnish; brushing and sugar advice for the parents.')
    : L(c, ...c.rng.pick<[string, string]>([
      ['فحص دوري: لا توجد نخور جديدة. تقليح وتلميع وإرشادات للعناية الفموية.', 'Routine check-up: no new caries. Scaling, polishing and oral hygiene advice.'],
      ['فحص دوري: ترسبات قلحية خفيفة على الأسنان الأمامية السفلية. تقليح وتلميع. المراجعة بعد 6 أشهر.', 'Routine check-up: light calculus on the lower front teeth. Scaling and polishing. Recall in 6 months.'],
      ['فحص دوري وتنظيف. اللثة سليمة. يُنصح باستعمال الخيط يومياً.', 'Check-up and cleaning. Healthy gums. Daily flossing advised.'],
    ]))
  const cleaning = !kid && c.rng.chance(0.4)
  const reason = kid ? L(c, 'فحص دوري للطفل', 'Child check-up') : cleaning ? L(c, 'تنظيف وتلميع', 'Scaling and polishing') : L(c, ...c.rng.pick<[string, string]>([['فحص دوري وتنظيف', 'Check-up and cleaning'], ['مراجعة دورية', 'Routine review']]))
  return { key: 'checkup', doctor: 'general', findings: [], steps: [{ type: cleaning ? 'cleaning' : 'checkup', reason, items, note }] }
}

/** A consultation for a new complaint that needs nothing more today. */
export function consultCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([...MOLARS, ...PREMOLARS])
  const v = c.rng.int(0, 2)
  if (v === 0) return {
    key: 'consult', doctor: 'general', findings: [],
    steps: [{ type: 'consultation', reason: L(c, 'استشارة', 'Consultation'), items: [{ code: 'consult' }, { code: 'xray-opg' }], note: L(c, `${pt(c)} ${g(c, 'يرغب', 'ترغب')} بتقييم عام للأسنان. أُخذت صورة بانورامية ونوقشت الخيارات العلاجية.`, 'The patient asked for a general dental assessment. A panoramic X-ray was taken and the treatment options discussed.') }],
  }
  if (v === 1) return {
    key: 'consult', doctor: 'general', findings: [],
    steps: [{ type: 'consultation', reason: L(c, `حساسية في السن ${t}`, `Sensitivity, tooth ${t}`), items: [{ code: 'exam-emergency' }, { code: 'xray-pa', tooth: t }, { code: 'desensitize' }], rx: 'sensitivity', note: L(c, `حساسية على البارد في السن ${t} بسبب انحسار لثوي خفيف. طُبّق مزيل للحساسية ووُصف معجون مناسب.`, `Cold sensitivity on tooth ${t} from mild gum recession. Desensitiser applied and a suitable toothpaste prescribed.`) }],
  }
  return {
    key: 'consult', doctor: 'general', findings: [],
    steps: [{ type: 'emergency', reason: L(c, 'قرحة فموية مؤلمة', 'Painful mouth ulcer'), items: [{ code: 'exam-emergency' }], rx: 'aphthous', diagnosis: L(c, 'قرحة قلاعية', 'Aphthous ulcer'), note: L(c, 'قرحة قلاعية على الغشاء المخاطي للشفة السفلية. لا علامات خطورة. وُصف معجون موضعي وغسول.', 'Aphthous ulcer on the lower lip mucosa. No warning signs. Topical paste and mouthwash prescribed.') }],
  }
}

/** Fillings over two or three visits. */
export function fillingsCase(c: CaseCtx): CaseDef {
  const n = c.rng.int(2, 4)
  const teeth = c.rng.sample([...MOLARS, ...PREMOLARS, ...(c.rng.chance(0.3) ? [11, 21, 12] : [])], n).sort((a, b) => a - b)
  const plan = teeth.map(t => { const s = surfacesFor(c.rng, t); return { t, s, code: fillingCode(c.rng, t, s) } })
  const first = plan.slice(0, Math.ceil(n / 2)), second = plan.slice(Math.ceil(n / 2))
  const steps: StepDef[] = [
    { type: 'checkup', reason: L(c, 'فحص شامل', 'Full examination'), items: [{ code: 'exam-full' }, { code: 'xray-bitewing' }, ...(c.rng.chance(0.5) ? [{ code: 'scaling' }] : [])], gap: [3, 10],
      note: L(c, `فحص شامل وصور مجنّحة: نخور على الأسنان ${listTeeth(teeth)}. الخطة: حشوات تجميلية على ${second.length ? 'جلستين' : 'جلسة واحدة'}.`,
        `Full examination and bitewings: caries on teeth ${listTeeth(teeth, c)}. Plan: composite fillings over ${second.length ? 'two visits' : 'one visit'}.`) },
    { type: 'treatment', reason: L(c, `حشوات — ${listTeeth(first.map(x => x.t))}`, `Fillings — ${listTeeth(first.map(x => x.t), c)}`), items: first.map(x => ({ code: x.code, tooth: x.t, surfaces: x.s })), gap: [5, 14],
      note: L(c, `حشوات كومبوزيت للأسنان ${listTeeth(first.map(x => x.t))} مع عزل بالقطن ومادة رابطة. الإطباق مضبوط.`, `Composite fillings on teeth ${listTeeth(first.map(x => x.t), c)} with cotton-roll isolation and bonding. Occlusion checked.`) },
  ]
  if (second.length) steps.push({ type: 'treatment', reason: L(c, `حشوات — ${listTeeth(second.map(x => x.t))}`, `Fillings — ${listTeeth(second.map(x => x.t), c)}`), items: second.map(x => ({ code: x.code, tooth: x.t, surfaces: x.s })),
    note: L(c, `حشوات للأسنان ${listTeeth(second.map(x => x.t))}. اكتملت الخطة الترميمية.`, `Fillings on teeth ${listTeeth(second.map(x => x.t), c)}. Restorative plan completed.`) })
  return { key: 'fillings', title: L(c, 'خطة ترميمية — حشوات تجميلية', 'Restorative plan — composite fillings'), doctor: 'general', steps, findings: plan.map(x => ({ tooth: x.t, condition: 'caries', surfaces: x.s })) }
}

/** Painful tooth → root canal over two visits → build-up and crown from the lab. */
export function endoCrownCase(c: CaseCtx): CaseDef {
  const t = c.rng.weighted<number>([[36, 4], [46, 4], [16, 2], [26, 2], [37, 1], [47, 1], [14, 1], [25, 1], [35, 1]])
  const kind = c.rng.weighted<'zr' | 'emax' | 'pfm'>([['zr', 7], ['emax', 1.5], ['pfm', 1.5]])
  const crown = kind === 'zr' ? 'crown-zirconia' : kind === 'emax' ? 'crown-emax' : 'crown-pfm'
  const material = kind === 'zr' ? L(c, 'زيركون', 'Zirconia') : kind === 'emax' ? L(c, 'إيماكس', 'e.max') : L(c, 'خزف على معدن', 'Porcelain fused to metal')
  const shade = c.rng.pick(['A1', 'A2', 'A2', 'A3', 'B1', 'A3.5'])
  const days = c.rng.int(2, 6)
  return {
    key: 'endoCrown', title: L(c, `معالجة لبية وتاج للسن ${t}`, `Root canal and crown, tooth ${t}`), doctor: 'general',
    findings: [{ tooth: t, condition: 'caries', surfaces: ['O', 'D'] }, ...(c.rng.chance(0.35) ? [{ tooth: t, condition: 'abscess' as const }] : [])],
    planNote: L(c, `التاج ${material}، اللون ${shade}.`, `${material} crown, shade ${shade}.`),
    steps: [
      { type: 'emergency', reason: L(c, `ألم شديد في السن ${t}`, `Severe pain, tooth ${t}`), items: [{ code: 'exam-emergency' }, { code: 'xray-pa', tooth: t }, { code: rctCode(t), tooth: t, key: 'rct' }], gap: [4, 8], rx: 'endo',
        diagnosis: L(c, `التهاب لب غير عكوس — السن ${t}`, `Irreversible pulpitis — tooth ${t}`),
        note: L(c, `${pt(c)} ${g(c, 'يشكو', 'تشكو')} من ألم ليلي نابض في السن ${t} منذ ${days} أيام يزداد مع البارد. الفحص: نخر عميق وألم على القرع. التشخيص: التهاب لب غير عكوس. فُتحت الحجرة اللبية ونُظّفت الأقنية ووُضع ضماد وحشوة مؤقتة.`,
          `Throbbing night pain on tooth ${t} for ${days} days, worse with cold. Exam: deep caries, tender to percussion. Diagnosis: irreversible pulpitis. Access cavity, canals cleaned, dressing and temporary filling.`) },
      { type: 'treatment', reason: L(c, `إكمال المعالجة اللبية — السن ${t}`, `Root canal completion — tooth ${t}`), items: [{ code: rctCode(t), tooth: t, key: 'rct' }], gap: [5, 10],
        note: L(c, `تحضير الأقنية آلياً وغسلها بالهيبوكلوريت وحشوها بالكوتا بيركا. الصورة الشعاعية النهائية مرضية. يحتاج السن ${t} إلى تاج.`, `Rotary canal preparation, hypochlorite irrigation and gutta-percha obturation. Final X-ray satisfactory. Tooth ${t} needs a crown.`) },
      { type: 'treatment', reason: L(c, `تحضير السن ${t} للتاج`, `Crown preparation, tooth ${t}`), items: [{ code: 'core-buildup', tooth: t }, { code: crown, tooth: t, key: 'crown' }], gap: [7, 11],
        lab: { type: 'crown', teeth: [t], fitStep: 3, item: 'crown', lab: kind === 'pfm' ? LABS.prosth : LABS.digital, material, shade, cost: kind === 'emax' ? 85 : kind === 'zr' ? 70 : 45, days: [6, 9] },
        note: L(c, `بناء الجذع بالكومبوزيت وتحضير السن ${t} للتاج. طبعة سيليكون، اللون ${shade}. تاج مؤقت.`, `Composite core build-up and crown preparation on tooth ${t}. Silicone impression, shade ${shade}. Temporary crown.`) },
      { type: 'treatment', reason: L(c, `تركيب التاج — السن ${t}`, `Crown fitting — tooth ${t}`), items: [{ code: crown, tooth: t, key: 'crown' }],
        note: L(c, `تجربة التاج: الحواف والتماسات جيدة والإطباق مضبوط. إلصاق نهائي بالإسمنت.`, 'Crown try-in: margins and contacts good, occlusion adjusted. Final cementation.') },
    ],
  }
}

/** Implant in a healed site: consultation → surgery → uncovering and impression → implant crown. */
export function implantCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([36, 46, 46, 16, 26, 35, 45, 15, 25])
  const premium = c.rng.chance(0.3)
  const brand = c.rng.pick(['Straumann ‏4.1×10 مم', 'Nobel ‏4.3×11.5 مم', 'Osstem ‏4.5×10 مم', 'MIS ‏4.2×11.5 مم']).replace(' مم', c.lang === 'en' ? ' mm' : ' مم')
  return {
    key: 'implant', title: L(c, `زراعة سن مكان السن ${t}`, `Implant replacing tooth ${t}`), doctor: 'surgery', long: true,
    findings: [{ tooth: t, condition: 'missing' }],
    planNote: L(c, 'الكلفة والمراحل مشروحة، والتاج بعد 3 أشهر من الزرع.', 'Cost and stages explained; the crown follows 3 months after placement.'),
    steps: [
      { type: 'consultation', reason: L(c, 'استشارة زراعة', 'Implant consultation'), items: [{ code: 'consult' }, { code: 'cbct' }], gap: [7, 20],
        note: ((w: string) => L(c, `فقد السن ${t} منذ سنوات. التصوير المقطعي: عرض العظم ${w} مم وارتفاعه كافٍ. الخطة: زرعة ثم تاج زيركون بعد 3 أشهر.`, `Tooth ${t} lost years ago. CBCT: bone width ${w} mm, height sufficient. Plan: implant, then a zirconia crown after 3 months.`))(c.rng.pick(['6.5', '7', '7.5', '8'])) },
      { type: 'surgery', reason: L(c, `زرع غرسة مكان السن ${t}`, `Implant placement, tooth ${t}`), items: [{ code: premium ? 'implant-premium' : 'implant', tooth: t }], gap: [75, 95], rx: 'implant', diagnosis: L(c, `فقد السن ${t}`, `Missing tooth ${t}`),
        note: L(c, `زرع غرسة ${brand} مكان السن ${t} تحت تخدير موضعي. ثبات أولي ممتاز. خياطة وإرشادات ما بعد الجراحة.`, `${brand} implant placed at tooth ${t} under local anaesthesia. Excellent primary stability. Sutures and post-operative instructions.`) },
      { type: 'treatment', reason: L(c, 'كشف الزرعة وأخذ الطبعة', 'Implant uncovering and impression'), items: [{ code: 'implant-uncover', tooth: t }, { code: 'implant-crown', tooth: t, key: 'icrown' }], gap: [10, 14],
        lab: { type: 'implant_crown', teeth: [t], fitStep: 3, item: 'icrown', lab: LABS.digital, material: L(c, 'زيركون على دعامة تيتانيوم', 'Zirconia on a titanium abutment'), shade: c.rng.pick(['A2', 'A3']), cost: 110, days: [8, 11] },
        note: L(c, 'الاندماج العظمي جيد. كشف الزرعة وتركيب دعامة الشفاء وأخذ طبعة بالنقل.', 'Good osseointegration. Implant uncovered, healing abutment placed and transfer impression taken.') },
      { type: 'treatment', reason: L(c, 'تركيب التاج على الزرعة', 'Implant crown fitting'), items: [{ code: 'implant-crown', tooth: t, key: 'icrown' }], note: L(c, 'تركيب التاج على الزرعة وشدّ البرغي 35 نيوتن.سم. الإطباق مضبوط.', 'Implant crown fitted, screw torqued to 35 Ncm. Occlusion adjusted.') },
    ],
  }
}

/** Impacted wisdom tooth removal. */
export function wisdomCase(c: CaseCtx): CaseDef {
  const t = c.rng.pick([38, 48])
  return {
    key: 'wisdom', title: L(c, `قلع جراحي لضرس العقل ${t}`, `Surgical removal of wisdom tooth ${t}`), doctor: 'surgery',
    findings: [{ tooth: t, condition: 'impacted' }],
    steps: [
      { type: 'consultation', reason: L(c, `ألم خلف الأضراس — السن ${t}`, `Pain behind the molars — tooth ${t}`), items: [{ code: 'consult' }, { code: 'xray-opg' }], gap: [3, 10],
        note: L(c, `التهاب متكرر حول ضرس العقل ${t}. الصورة البانورامية: انطمار أفقي جزئي. الخطة: قلع جراحي.`, `Recurrent pericoronitis around wisdom tooth ${t}. Panoramic X-ray: partial horizontal impaction. Plan: surgical removal.`) },
      { type: 'surgery', reason: L(c, `قلع ضرس العقل ${t}`, `Wisdom tooth removal, ${t}`), items: [{ code: 'ext-wisdom', tooth: t }], gap: [7, 8], rx: 'surgery', diagnosis: L(c, `ضرس عقل منطمر — السن ${t}`, `Impacted wisdom tooth — ${t}`),
        note: L(c, `قلع جراحي للسن ${t} مع إزالة عظم وتقسيم السن. خياطة بخيوط 3-0. وُصف مضاد حيوي ومسكن وكمادات باردة.`, `Surgical removal of tooth ${t} with bone removal and sectioning. 3-0 sutures. Antibiotic, painkiller and cold compresses prescribed.`) },
      { type: 'followup', reason: L(c, 'مراجعة وفك القطب', 'Review and suture removal'), items: [{ code: 'postop-review' }], note: L(c, 'شفاء جيد دون علامات التهاب. فُكّت القطب.', 'Good healing, no sign of infection. Sutures removed.') },
    ],
  }
}

/** Fixed braces with monthly adjustments (orthodontist). */
export function bracesCase(c: CaseCtx): CaseDef {
  const ceramic = c.rng.chance(c.age >= 18 ? 0.5 : 0.2)
  const wires = c.lang === 'en'
    ? ['NiTi 0.016', 'NiTi 0.018', 'NiTi 0.016×0.022', 'stainless steel 0.017×0.025', 'stainless steel 0.019×0.025 with class II elastics', 'stainless steel 0.019×0.025']
    : ['NiTi ‏0.016', 'NiTi ‏0.018', 'NiTi ‏0.016×0.022', 'ستانلس ‏0.017×0.025', 'ستانلس ‏0.019×0.025 مع مطاط صنف II', 'ستانلس ‏0.019×0.025']
  const issue = L(c, ...c.rng.pick<[string, string]>([['سوء إطباق صنف II مع ازدحام أمامي', 'Class II malocclusion with anterior crowding'], ['ازدحام شديد في الفك السفلي', 'Severe lower crowding'],
    ['عضة عميقة مع بروز الثنايا العلوية', 'Deep bite with proclined upper incisors'], ['تباعد بين الأسنان الأمامية', 'Spacing between the front teeth']]))
  const steps: StepDef[] = [
    { type: 'consultation', reason: L(c, 'استشارة تقويم', 'Orthodontic consultation'), items: [{ code: 'ortho-consult' }, { code: 'xray-opg' }], gap: [7, 14],
      note: L(c, `${issue}. أُخذت الطبعات والصور. الخطة: تقويم ثابت ${ceramic ? 'خزفي' : 'معدني'} للفكين لمدة 18–24 شهراً.`, `${issue}. Impressions and photos taken. Plan: ${ceramic ? 'ceramic' : 'metal'} fixed braces on both arches for 18–24 months.`) },
    { type: 'orthodontic', reason: L(c, 'تركيب التقويم الثابت', 'Fixed braces bonding'), items: [{ code: ceramic ? 'braces-ceramic' : 'braces-metal' }], gap: [26, 34],
      note: L(c, 'إلصاق الحاصرات على الفكين وتركيب سلك NiTi ‏0.014. شُرحت طريقة العناية بالتقويم والأطعمة الممنوعة.', 'Brackets bonded on both arches, NiTi 0.014 wire placed. Brace care and foods to avoid explained.') },
  ]
  for (const w of wires) steps.push({ type: 'orthodontic', reason: L(c, 'جلسة شد التقويم', 'Brace adjustment'), items: [{ code: 'ortho-adjust' }], gap: [26, 34],
    note: L(c, 'تبديل السلك إلى ', 'Wire changed to ') + w + '. ' + L(c, ...c.rng.pick<[string, string]>([[`التعاون جيد والصحة الفموية ممتازة.`, 'Good cooperation and excellent oral hygiene.'], [`${pt(c)} ${g(c, 'ملتزم', 'ملتزمة')} بالمطاط.`, 'Wearing the elastics as asked.'],
      ['التهاب لثة خفيف — تأكيد على التفريش.', 'Mild gingivitis — brushing reinforced.'], ['التقدم ممتاز.', 'Excellent progress.']])) })
  return { key: 'braces', title: L(c, 'تقويم ثابت للفكين', 'Fixed braces, both arches'), doctor: 'ortho', long: true, findings: [], steps, planNote: L(c, 'الدفع على أقساط شهرية.', 'Paid in monthly instalments.') }
}

/** Clear aligners (orthodontist, lab-made). */
export function alignersCase(c: CaseCtx): CaseDef {
  return {
    key: 'aligners', title: L(c, 'تقويم شفاف (Aligners)', 'Clear aligners'), doctor: 'ortho', long: true, findings: [],
    steps: [
      { type: 'consultation', reason: L(c, 'استشارة تقويم شفاف', 'Clear aligner consultation'), items: [{ code: 'ortho-consult' }, { code: 'aligners', key: 'aligners' }], gap: [18, 24],
        lab: { type: 'aligner', teeth: [], fitStep: 1, item: 'aligners', lab: LABS.ortho, material: L(c, 'قوالب شفافة — 20 مرحلة', 'Clear aligners — 20 stages'), cost: 450, days: [14, 18] },
        note: L(c, 'ازدحام خفيف في الفكين. مسح رقمي وصور، وأُرسلت الخطة الرقمية إلى المخبر.', 'Mild crowding on both arches. Digital scan and photos; the digital plan was sent to the lab.') },
      { type: 'orthodontic', reason: L(c, 'تسليم القوالب الشفافة', 'Aligner delivery'), items: [{ code: 'aligners', key: 'aligners' }], gap: [40, 50],
        note: L(c, 'تسليم المجموعة الأولى من القوالب وإلصاق الأزرار. ارتداء 22 ساعة يومياً وتبديل القالب كل أسبوعين.', 'First set of aligners delivered and attachments bonded. Wear 22 hours a day, change aligners every two weeks.') },
      { type: 'orthodontic', reason: L(c, 'متابعة التقويم الشفاف', 'Aligner review'), items: [{ code: 'ortho-adjust' }], gap: [40, 50], note: L(c, 'التتبع جيد. تسليم المجموعة الثانية.', 'Good tracking. Second set delivered.') },
      { type: 'orthodontic', reason: L(c, 'متابعة التقويم الشفاف', 'Aligner review'), items: [{ code: 'ortho-adjust' }], note: L(c, 'تقدم ممتاز وفق الخطة.', 'Excellent progress, on plan.') },
    ],
  }
}

/** Porcelain veneers on the upper front teeth. */
export function veneersCase(c: CaseCtx): CaseDef {
  const teeth = c.rng.chance(0.35) ? [13, 12, 11, 21, 22, 23] : [12, 11, 21, 22]
  const items = teeth.map(t => ({ code: 'veneer-porcelain', tooth: t, key: `v${t}` }))
  return {
    key: 'veneers', title: L(c, 'تجميل الابتسامة — قشور خزفية', 'Smile makeover — porcelain veneers'), doctor: 'general',
    findings: teeth.filter(() => c.rng.chance(0.4)).map(t => ({ tooth: t, condition: 'filled' as const, surfaces: ['M'] as ToothSurface[] })),
    steps: [
      { type: 'consultation', reason: L(c, 'استشارة تجميلية', 'Cosmetic consultation'), items: [{ code: 'consult' }, { code: 'smile-design' }], gap: [7, 14],
        note: L(c, `تصميم ابتسامة رقمي ومعاينة النتيجة مع ${ptLow(c)}. اختير اللون BL2 وعدد القشور ${teeth.length}.`, `Digital smile design reviewed with the patient. Shade BL2, ${teeth.length} veneers.`) },
      { type: 'treatment', reason: L(c, 'تحضير القشور الخزفية', 'Veneer preparation'), items, gap: [10, 14],
        lab: { type: 'veneer', teeth, fitStep: 2, item: `v${teeth[0]}`, lab: LABS.digital, material: L(c, 'إيماكس', 'e.max'), shade: 'BL2', cost: 90 * teeth.length, days: [8, 11] },
        note: L(c, `تحضير محافظ للأسنان ${listTeeth(teeth)} وطبعة رقمية. قشور مؤقتة.`, `Conservative preparation of teeth ${listTeeth(teeth, c)} and a digital impression. Temporary veneers.`) },
      { type: 'treatment', reason: L(c, 'إلصاق القشور الخزفية', 'Veneer bonding'), items, note: L(c, 'إلصاق القشور بإسمنت راتنجي ضوئي. النتيجة ممتازة.', 'Veneers bonded with light-cured resin cement. Excellent result.') },
    ],
  }
}

export function whiteningCase(c: CaseCtx): CaseDef {
  const home = c.rng.chance(0.4)
  return {
    key: 'whitening', title: L(c, 'تبييض الأسنان', 'Teeth whitening'), doctor: 'general', findings: [],
    steps: [
      { type: 'cleaning', reason: L(c, 'تنظيف قبل التبييض', 'Cleaning before whitening'), items: [{ code: 'scaling' }], gap: [5, 10], note: L(c, 'تقليح وتلميع قبل التبييض. اللون الحالي A3.', 'Scaling and polishing before whitening. Current shade A3.') },
      { type: 'treatment', reason: L(c, 'تبييض الأسنان', 'Teeth whitening'), items: [{ code: 'whitening-office' }, ...(home ? [{ code: 'whitening-home' }] : [])], rx: c.rng.chance(0.5) ? 'sensitivity' : undefined,
        note: L(c, `تبييض في العيادة على 3 جلسات × 15 دقيقة، وتغيّر اللون من A3 إلى B1${home ? '، مع قوالب منزلية للمتابعة' : ''}. تجنّب المشروبات الملوّنة 48 ساعة.`,
          `In-office whitening, 3 × 15-minute cycles, shade A3 to B1${home ? ', with home trays to follow' : ''}. Avoid coloured drinks for 48 hours.`) },
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
    { type: 'checkup', reason: L(c, 'فحص أسنان الطفل', "Child's dental exam"), items: [{ code: 'child-exam' }, { code: 'child-cleaning' }, { code: 'fluoride-varnish' }], gap: [5, 12],
      note: L(c, `${kid} ${g(c, 'متعاون', 'متعاونة')}. نخر عميق في السن ${deep} ونخور في ${listTeeth(others)}. تطبيق فلورايد. الخطة: بتر لب وتاج ستانلس ستيل ثم حشوات.`,
        `Cooperative child. Deep caries on tooth ${deep} and caries on ${listTeeth(others, c)}. Fluoride varnish. Plan: pulpotomy and a stainless steel crown, then fillings.`) },
    { type: 'treatment', reason: L(c, `بتر لب السن ${deep}`, `Pulpotomy, tooth ${deep}`), items: [{ code: 'pulpotomy', tooth: deep }, { code: 'ssc', tooth: deep }], gap: [7, 14],
      note: L(c, `بتر لب السن ${deep} تحت تخدير موضعي وتغطيته بتاج ستانلس ستيل. ${kid} ${g(c, 'تحمّل', 'تحمّلت')} الجلسة جيداً.`, `Pulpotomy on tooth ${deep} under local anaesthesia, covered with a stainless steel crown. The child coped well.`) },
    { type: 'treatment', reason: L(c, 'حشوات أسنان لبنية', 'Primary tooth fillings'), items: [...fills.map(f => ({ code: 'child-filling', tooth: f.t, surfaces: f.s })), ...sealants.map(t => ({ code: 'sealant', tooth: t }))],
      note: L(c, `حشوات للأسنان ${listTeeth(others)}${sealants.length ? ` وسادّ شقوق للأرحاء ${listTeeth(sealants)}` : ''}.`, `Fillings on teeth ${listTeeth(others, c)}${sealants.length ? ` and fissure sealants on molars ${listTeeth(sealants, c)}` : ''}.`) },
  ]
  const findings: Finding[] = [{ tooth: deep, condition: 'caries', surfaces: ['O', 'D'] }, ...fills.map(f => ({ tooth: f.t, condition: 'caries' as const, surfaces: f.s }))]
  if (c.age >= 7 && c.rng.chance(0.6)) {
    const loose = c.rng.pick([71, 81, 72, 82])
    findings.push({ tooth: loose, condition: 'mobile' })
    steps[2].gap = [10, 20]
    steps.push({ type: 'treatment', reason: L(c, `قلع سن لبني متحرك — ${loose}`, `Loose primary tooth extraction — ${loose}`), items: [{ code: 'child-ext', tooth: loose }], note: L(c, `قلع السن اللبني ${loose} المتحرك لإفساح المجال للسن الدائم.`, `Loose primary tooth ${loose} extracted to make room for the permanent tooth.`) })
  }
  return { key: 'pediatric', title: L(c, 'علاج أسنان الطفل', "Child's dental treatment"), doctor: 'general', steps, findings }
}

export function perioCase(c: CaseCtx): CaseDef {
  const findings: Finding[] = c.age > 50 ? [{ tooth: 31, condition: 'mobile' }, { tooth: 41, condition: 'mobile' }] : []
  return {
    key: 'perio', title: L(c, 'علاج اللثة — تجريف وتسوية جذور', 'Gum treatment — scaling and root planing'), doctor: 'general', long: true, findings,
    steps: [
      { type: 'checkup', reason: L(c, 'نزف لثوي', 'Bleeding gums'), items: [{ code: 'exam-full' }, { code: 'xray-opg' }], gap: [5, 10],
        note: L(c, `نزف عند التفريش ورائحة فم. جيوب لثوية 4–6 مم في المناطق الخلفية. التشخيص: التهاب نسج داعمة مزمن. الخطة: تجريف وتسوية جذور على جلستين.`,
          'Bleeding on brushing and bad breath. 4–6 mm pockets in the posterior areas. Diagnosis: chronic periodontitis. Plan: scaling and root planing over two visits.') },
      { type: 'treatment', reason: L(c, 'تجريف الفك العلوي', 'Upper jaw root planing'), items: [{ code: 'srp-quadrant', label: L(c, 'الربع العلوي الأيمن', 'upper right quadrant') }, { code: 'srp-quadrant', label: L(c, 'الربع العلوي الأيسر', 'upper left quadrant') }], gap: [7, 14], rx: 'perio',
        note: L(c, 'تجريف وتسوية جذور للربعين العلويين تحت تخدير موضعي. إرشادات التفريش والخيط.', 'Scaling and root planing of both upper quadrants under local anaesthesia. Brushing and flossing instructions.') },
      { type: 'treatment', reason: L(c, 'تجريف الفك السفلي', 'Lower jaw root planing'), items: [{ code: 'srp-quadrant', label: L(c, 'الربع السفلي الأيسر', 'lower left quadrant') }, { code: 'srp-quadrant', label: L(c, 'الربع السفلي الأيمن', 'lower right quadrant') }], gap: [60, 90],
        note: L(c, 'تجريف وتسوية جذور للربعين السفليين. تحسّن واضح في الفك العلوي.', 'Scaling and root planing of both lower quadrants. Clear improvement in the upper jaw.') },
      { type: 'checkup', reason: L(c, 'صيانة لثوية', 'Periodontal maintenance'), items: [{ code: 'perio-maint' }], note: L(c, 'الجيوب تراجعت إلى 3 مم. صيانة لثوية كل 3 أشهر.', 'Pockets down to 3 mm. Periodontal maintenance every 3 months.') },
    ],
  }
}

/** Three-unit zirconia bridge over a missing tooth. */
export function bridgeCase(c: CaseCtx): CaseDef {
  const pontic = c.rng.pick([36, 46, 25, 15, 35, 45])
  const units = [pontic - 1, pontic, pontic + 1]
  const shade = c.rng.pick(['A2', 'A3'])
  const items = units.map(t => ({ code: 'bridge-zirconia', tooth: t, key: `b${t}` }))
  return {
    key: 'bridge', title: L(c, `جسر ثابت ${units[0]}–${units[2]}`, `Fixed bridge ${units[0]}–${units[2]}`), doctor: 'general',
    findings: [{ tooth: pontic, condition: 'missing' }, { tooth: units[0], condition: 'filled', surfaces: ['O', 'D'] }],
    steps: [
      { type: 'consultation', reason: L(c, `تعويض السن ${pontic}`, `Replacing tooth ${pontic}`), items: [{ code: 'consult' }, { code: 'xray-opg' }], gap: [5, 12],
        note: L(c, `فقد السن ${pontic} منذ سنوات. ${pt(c)} لا ${g(c, 'يرغب', 'ترغب')} بالزرع. الخطة: جسر زيركون ثلاثي الوحدات ${units[0]}–${units[2]}.`, `Tooth ${pontic} lost years ago. The patient does not want an implant. Plan: three-unit zirconia bridge ${units[0]}–${units[2]}.`) },
      { type: 'treatment', reason: L(c, 'تحضير دعامتي الجسر', 'Bridge abutment preparation'), items, gap: [8, 12],
        lab: { type: 'bridge', teeth: units, fitStep: 2, item: `b${units[0]}`, lab: LABS.digital, material: L(c, 'زيركون', 'Zirconia'), shade, cost: 210, days: [8, 11] },
        note: L(c, `تحضير السنين ${units[0]} و${units[2]} وطبعة سيليكون، اللون ${shade}. جسر مؤقت.`, `Teeth ${units[0]} and ${units[2]} prepared, silicone impression, shade ${shade}. Temporary bridge.`) },
      { type: 'treatment', reason: L(c, 'تركيب الجسر', 'Bridge fitting'), items, note: L(c, 'تجربة الجسر وإلصاقه نهائياً. شُرح استعمال خيط الجسور.', 'Bridge tried in and permanently cemented. Use of bridge floss explained.') },
    ],
  }
}

export function dentureCase(c: CaseCtx): CaseDef {
  const upper = c.rng.chance(0.6)
  const arch = upper ? [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27] : [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37]
  const label = upper ? L(c, 'علوي', 'upper') : L(c, 'سفلي', 'lower')
  return {
    key: 'denture', title: L(c, `طقم كامل ${label}`, `Complete ${label} denture`), doctor: 'general',
    findings: arch.map(t => ({ tooth: t, condition: 'missing' as const })),
    steps: [
      { type: 'consultation', reason: L(c, `طقم ${label}`, `${upper ? 'Upper' : 'Lower'} denture`), items: [{ code: 'exam-full' }, { code: 'xray-opg' }], gap: [5, 10], note: L(c, `فقد كامل للأسنان في الفك ${label}. الخطة: طقم كامل أكريلي.`, `Fully edentulous ${label} jaw. Plan: complete acrylic denture.`) },
      { type: 'treatment', reason: L(c, 'طبعات الطقم', 'Denture impressions'), items: [{ code: 'denture-full', key: 'dent', label }], gap: [6, 9],
        lab: { type: 'denture_full', teeth: [], fitStep: 3, item: 'dent', lab: LABS.prosth, material: L(c, 'أكريل حراري', 'Heat-cured acrylic'), shade: 'A3', cost: 120, days: [14, 18] },
        note: L(c, 'طبعات أولية ونهائية بالحواف الوظيفية.', 'Primary and final impressions with functional borders.') },
      { type: 'treatment', reason: L(c, 'تجربة الأسنان', 'Teeth try-in'), items: [{ code: 'denture-full', key: 'dent', label }], gap: [6, 9], note: L(c, 'تسجيل العلاقة الفكية وتجربة الأسنان على الشمع. المظهر مقبول.', 'Jaw relation recorded and wax try-in. Appearance accepted.') },
      { type: 'treatment', reason: L(c, 'تسليم الطقم', 'Denture delivery'), items: [{ code: 'denture-full', key: 'dent', label }], gap: [5, 8], note: L(c, 'تسليم الطقم وشرح طريقة الاستعمال والتنظيف.', 'Denture delivered; use and cleaning explained.') },
      { type: 'followup', reason: L(c, 'تعديل الطقم', 'Denture adjustment'), items: [{ code: 'denture-adjust' }], note: L(c, 'تعديل نقاط ضغط بسيطة. الثبات جيد.', 'Minor pressure spots relieved. Good retention.') },
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
      { type: 'emergency', reason: L(c, `تورم وألم — السن ${t}`, `Swelling and pain — tooth ${t}`), items: [{ code: 'exam-emergency' }, { code: 'xray-pa', tooth: t }, { code: 'abscess-drain', tooth: t }], gap: [3, 6], rx: 'abscess',
        diagnosis: L(c, `خراج ذروي حاد — السن ${t}`, `Acute apical abscess — tooth ${t}`), note: L(c, `تورم مؤلم حول السن ${t} منذ يومين. السن غير قابل للترميم. شق وتفجير الخراج ووصف مضاد حيوي. القلع بعد زوال التورم.`, `Painful swelling around tooth ${t} for two days. The tooth cannot be restored. Incision and drainage, antibiotic prescribed. Extraction once the swelling settles.`) },
      { type: 'surgery', reason: L(c, `قلع السن ${t}`, `Extraction, tooth ${t}`), items: [{ code: c.rng.chance(0.6) ? 'ext-simple' : 'ext-surgical', tooth: t }], rx: 'postExtraction',
        note: L(c, `قلع السن ${t} بعد زوال الالتهاب. إرشادات ما بعد القلع.`, `Tooth ${t} extracted after the infection settled. Post-extraction instructions.`) },
    ],
  }
}

export function nightGuardCase(c: CaseCtx): CaseDef {
  return {
    key: 'nightGuard', doctor: 'general', title: L(c, 'واقٍ ليلي للصرير', 'Night guard for bruxism'),
    findings: [11, 21, 31, 41].map(t => ({ tooth: t, condition: 'attrition' as const })),
    steps: [
      { type: 'checkup', reason: L(c, 'صرير ليلي وألم في الفك', 'Night grinding and jaw pain'), items: [{ code: 'exam-full' }, { code: 'night-guard', key: 'ng' }], gap: [7, 10],
        lab: { type: 'night_guard', teeth: [], fitStep: 1, item: 'ng', lab: LABS.prosth, material: L(c, 'أكريل صلب', 'Hard acrylic'), cost: 35, days: [5, 8] },
        note: L(c, `${pt(c)} ${g(c, 'يشكو', 'تشكو')} من ألم صباحي في عضلات المضغ. سحل على الأسنان الأمامية. طبعات لواقٍ ليلي.`, 'Morning pain in the chewing muscles. Attrition on the front teeth. Impressions for a night guard.') },
      { type: 'followup', reason: L(c, 'تسليم الواقي الليلي', 'Night guard delivery'), items: [{ code: 'night-guard', key: 'ng' }], note: L(c, 'تسليم الواقي الليلي وضبط الإطباق.', 'Night guard delivered and occlusion adjusted.') },
    ],
  }
}

/** A treatment the patient was offered but has not started (draft plan) or turned down (cancelled plan). */
export function proposalCase(c: CaseCtx, declined: boolean): CaseDef {
  const v = c.rng.int(0, 2)
  if (v === 0) {
    const t = c.rng.pick([36, 46, 26])
    return { key: declined ? 'declined' : 'proposal', title: L(c, `زراعة سن مكان السن ${t} (اقتراح)`, `Implant replacing tooth ${t} (proposal)`), doctor: 'surgery', findings: [], steps: [], planNote: declined ? L(c, `${pt(c)} ${g(c, 'فضّل', 'فضّلت')} تأجيل الزراعة لأسباب مادية.`, 'The patient chose to postpone the implant for financial reasons.') : L(c, `بانتظار موافقة ${ptLow(c)}.`, 'Awaiting the patient’s approval.'),
      proposal: [{ code: 'cbct' }, { code: 'implant', tooth: t }, { code: 'implant-crown', tooth: t }] }
  }
  if (v === 1) return { key: declined ? 'declined' : 'proposal', title: L(c, 'تبييض وقشور تجميلية (اقتراح)', 'Whitening and cosmetic veneers (proposal)'), doctor: 'general', findings: [], steps: [], planNote: declined ? L(c, `أُلغيت الخطة بطلب ${ptLow(c)}.`, 'Plan cancelled at the patient’s request.') : L(c, 'عُرضت الكلفة، والقرار بعد الأعياد.', 'Cost presented; decision after the holidays.'),
    proposal: [{ code: 'whitening-office' }, { code: 'veneer-porcelain', tooth: 11 }, { code: 'veneer-porcelain', tooth: 21 }] }
  return { key: declined ? 'declined' : 'proposal', title: L(c, 'تقويم شفاف (اقتراح)', 'Clear aligners (proposal)'), doctor: 'ortho', findings: [], steps: [], planNote: declined ? L(c, `${pt(c)} ${g(c, 'اختار', 'اختارت')} التقويم الثابت في مكان آخر.`, 'The patient chose fixed braces elsewhere.') : L(c, 'بانتظار الموافقة على الكلفة.', 'Awaiting approval of the cost.'),
    proposal: [{ code: 'ortho-consult' }, { code: 'aligners' }] }
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
