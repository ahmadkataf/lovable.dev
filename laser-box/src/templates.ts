// Ready-made box designs. Every template turns its parameters into panel specs.
import { Loop, rect, circle, disc, stadium, stadiumV, roundedRectHole, rotatedRectHole, roundCorner, edgeNotch, engraveRect, hingeLines, round3 } from './geom'
import { PanelSpec } from './joints'

export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step?: number
  unit?: string
  hint?: string
  /** integer count rather than a length */
  int?: boolean
}

export interface Common { t: number; kerf: number; finger: number; inner: boolean }

export interface BuildResult { panels: PanelSpec[]; notes: string[]; warnings: string[]; errors?: string[] }

export interface Template {
  id: string
  name: string
  desc: string
  icon: string
  params: ParamDef[]
  defaults: Record<string, number>
  /** what to add to W / D / H when the user typed inner dimensions */
  innerAdd: (t: number) => { W: number; D: number; H: number }
  build(p: Record<string, number>, c: Common): BuildResult
}

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const DIMS: ParamDef[] = [mm('W', 'العرض', 20, 2000), mm('D', 'العمق', 20, 2000), mm('H', 'الارتفاع', 10, 2000)]

const N = { bottom: 'القاعدة', top: 'الغطاء', front: 'الواجهة الأمامية', back: 'الواجهة الخلفية', side: 'الجانب', lid: 'الغطاء' }

/** The five panels of an open-top box (outer dimensions). */
function openBox(W: number, D: number, H: number, prefix = '', ids = ''): PanelSpec[] {
  const nm = (s: string) => (prefix ? `${prefix} — ${s}` : s)
  return [
    { id: ids + 'bottom', name: nm(N.bottom), w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
    { id: ids + 'front', name: nm(N.front), w: W, h: H, bottom: 'female', left: 'male', right: 'male' },
    { id: ids + 'back', name: nm(N.back), w: W, h: H, bottom: 'female', left: 'male', right: 'male' },
    { id: ids + 'side', name: nm(N.side), w: D, h: H, bottom: 'female', left: 'female', right: 'female', count: 2 },
  ]
}

const DIM_NAMES: Record<string, string> = { W: 'العرض', D: 'العمق', H: 'الارتفاع' }

function checkBasics(p: Record<string, number>, c: Common, warnings: string[], errors: string[] = []) {
  for (const k of ['W', 'D', 'H']) if (k in p && p[k] < 4 * c.t) errors.push(`${DIM_NAMES[k]} (${p[k]} مم) أصغر من أربع سماكات (${4 * c.t} مم)؛ لا مكان للتعشيق.`)
  if (c.finger < c.t) warnings.push('عرض الأصبع أصغر من سماكة الخامة؛ الأصابع ستكون ضعيفة.')
  if (c.kerf > c.t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
}

/** A finger-pull radius that fits the piece it is cut into. */
const fitPull = (pull: number, edgeLen: number, depthAvail: number) => Math.max(0, Math.min(pull, edgeLen / 6, depthAvail / 2.5))


const HINGE_PARAMS: ParamDef[] = [
  mm('tab', 'عرض اللسان', 0, 20, '0 = تلقائياً يساوي السماكة؛ مقطعه مربّع ليدور في الثقب'),
  mm('hc', 'خلوص المفصل', 0.2, 1.5, 'يُضاف لقطر الثقب فوق قُطر مقطع اللسان'),
  mm('gap', 'خلوص الغطاء', 0.2, 2, 'فراغ بين الغطاء والجانبين والخلفية'),
  mm('pull', 'نصف قطر فتحة الإصبع', 0, 30, 'في حافّة الواجهة الأمامية تحت الغطاء'),
]
const HINGE_DEFAULTS = { tab: 0, hc: 0.4, gap: 0.5, pull: 8 }

/** The six pieces of the pivot-tab lid box; shared by the plain hinged box and the tea box. */
function pivotLidBox(p: Record<string, number>, c: Common, warnings: string[], errors: string[]) {
  const { W, D, H } = p, t = c.t
  const g = pivotLid(p, t)
  const minD = Math.ceil((D - g.earX) + 2 * t + 8), minH = Math.ceil(g.a + 3 * t + 2)
  if (D < minD) errors.push(`العمق (${D} مم) لا يتّسع لأذن المفصل: أقلّ عمق ${minD} مم بهذه السماكة.`)
  if (H < minH) errors.push(`الارتفاع (${H} مم) لا يتّسع لأذن المفصل وثقبها: أقلّ ارتفاع ${minH} مم بهذه السماكة.`)
  if (g.tab > 2 * t) warnings.push('لسان عريض يعني ثقباً كبيراً وخلخلة في الدوران؛ الأفضل أن يساوي السماكة.')
  if (p.hc < 0.2) errors.push('خلوص المفصل أقلّ من 0.2 مم: اللسان لن يدور في الثقب.')
  const pull = fitPull(p.pull, W, H - t)
  const rootR = Math.min(0.4, 0.8 * g.gap) // fillets at the tab roots stay inside the side clearance
  const lidCut = (x: number) => [rect(x, g.earX - g.gap, t + g.gap, g.tabY0 - (g.earX - g.gap)), rect(x, g.tabY1, t + g.gap, g.lidD - g.tabY1)]
  const panels: PanelSpec[] = [
    { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
    {
      id: 'front', name: N.front, w: W, h: H, bottom: 'female', left: 'male', right: 'male',
      post: loops => { if (pull >= 2) edgeNotch(loops, W / 2, 0, pull) },
      note: 'أقصر من الخلفية بسماكة الغطاء، وفيها فتحة الإصبع',
    },
    { id: 'back', name: N.back, w: W, h: H + t, bottom: 'female', left: 'male', right: 'male', note: 'ترتفع إلى مستوى سطح الغطاء' },
    {
      id: 'side', name: N.side, w: D, h: H + g.a, count: 2,
      bottom: 'female', left: { type: 'female', from: g.a, len: H }, right: { type: 'female', from: g.a - t, len: H + t },
      cuts: [rect(0, 0, g.earX, g.a)],
      holes: [circle(g.pivotX, g.a - t / 2, g.holeR)],
      post: loops => { roundCorner(loops, g.earX, 0, g.a); roundCorner(loops, D, 0, Math.min(2, g.a - t)) },
      note: 'أذن خلفية مستديرة فيها ثقب اللسان',
    },
    {
      id: 'lid', name: N.lid, w: W, h: g.lidD,
      cuts: [...lidCut(0), ...lidCut(W - t - g.gap)],
      post: loops => { for (const x of [round3(t + g.gap), round3(W - t - g.gap)]) { roundCorner(loops, x, g.tabY0, rootR); roundCorner(loops, x, g.tabY1, rootR) } },
      note: 'الزاويتان الخلفيتان مقصوصتان ليمرّ بين الأذنين، واللسانان يبرزان منهما',
    },
  ]
  const notes = [
    `اللسان ${g.tab} × ${t} مم يدور في ثقب قطره ${(2 * g.holeR).toFixed(2)} مم (قُطر مقطع اللسان ${Math.hypot(g.tab, t).toFixed(2)} + خلوص ${p.hc}).`,
    `الأذن ترتفع ${g.a.toFixed(1)} مم فوق حافّة الجانب عند الزاوية الخلفية، والغطاء يستقرّ على حوافّ الجانبين والواجهة بعرض الصندوق كاملاً.`,
    'التجميع: ركّب القاعدة والواجهتين على جانب واحد، أدخل لسان الغطاء في ثقبه، ثم أدخل الجانب الثاني بحيث يدخل اللسان في ثقبه مع دخول الأصابع في وقت واحد. لا يحتاج ثنياً ولا غراءً في الغطاء.',
    'الجزء الخلفي من الغطاء خلف المحور يهبط داخل الصندوق عند الفتح، فالخلفية بارتفاع سطح الغطاء ولا تعيقه. لتخفيف الخلخلة برّد حوافّ اللسان قليلاً ليقترب من الدائرة.',
    'الغطاء يفتح بحرّية حتى نحو 140° ثم يستند بطرفه الخلفي على الحافّة الداخلية للخلفية؛ إن أردت أن يقف عند 100° استعمل شريطاً أو مغناطيساً.',
  ]
  return { panels, notes, g }
}

/** Vertical through-slots for dividers, cut into a wall between y0 and y1 at the given positions. */
function addSlots(spec: PanelSpec, pos: number[], y0: number, y1: number, sw: number) {
  spec.cuts = [...(spec.cuts ?? []), ...pos.map(x => rect(x - sw / 2, y0, sw, y1 - y0))]
}

/** Egg-crate dividers: those along the depth get their crossing slots from the top, those along the width from the bottom. */
const FOOT = 1.5 // the wall slots stop this far above the bottom joint, so no sliver is left between a slot and a finger notch

function dividers(W: number, D: number, hd: number, xs: number[], ds: number[], t: number, sw: number, margin: number, tailStep?: { from: number; depth: number }): PanelSpec[] {
  const out: PanelSpec[] = []
  if (xs.length) out.push({
    id: 'divN', name: 'فاصل بالعمق', w: D, h: hd, count: xs.length,
    cuts: [rect(0, 0, t, margin), rect(D - t, 0, t, margin), rect(0, hd - FOOT, t, FOOT), rect(D - t, hd - FOOT, t, FOOT), ...ds.map(d => rect(d - sw / 2, 0, sw, hd / 2)), ...(tailStep ? [rect(tailStep.from, 0, D - tailStep.from, tailStep.depth)] : [])],
    note: tailStep ? 'يدخل في شقوق الواجهتين؛ حافّته العلوية منخفضة عند الخلف ليمرّ ذيل الغطاء' : 'يدخل في شقوق الواجهتين؛ شقوق التقاطع من الأعلى',
  })
  if (ds.length) out.push({
    id: 'divM', name: 'فاصل بالعرض', w: W, h: hd, count: ds.length,
    cuts: [rect(0, 0, t, margin), rect(W - t, 0, t, margin), rect(0, hd - FOOT, t, FOOT), rect(W - t, hd - FOOT, t, FOOT), ...xs.map(x => rect(x - sw / 2, hd / 2, sw, hd / 2))],
    note: 'يدخل في شقوق الجانبين؛ شقوق التقاطع من الأسفل',
  })
  return out
}

const DIVIDER_PARAMS: ParamDef[] = [
  { key: 'N', label: 'فواصل بالعرض', min: 0, max: 20, step: 1, int: true, hint: 'عدد الفواصل الموازية للعمق' },
  { key: 'M', label: 'فواصل بالعمق', min: 0, max: 20, step: 1, int: true, hint: 'عدد الفواصل الموازية للعرض' },
  mm('margin', 'هامش أعلى الشقّ', 3, 50, 'المسافة من الحافّة العلوية إلى بداية شقّ الفاصل'),
  mm('fit', 'خلوص الفواصل', 0, 1, 'يُضاف لعرض الشقوق لتدخل الفواصل بسهولة'),
]

/** Divider positions and the slot width, with the checks both divided boxes share. */
function dividerPlan(p: Record<string, number>, t: number, errors: string[], warnings: string[]) {
  const { W, D, H, fit } = p
  const Nn = Math.round(p.N), Mm = Math.round(p.M)
  const sw = t + fit, hd = H - t
  const margin = Math.min(p.margin, Math.max(2, hd / 3))
  if (margin < p.margin) warnings.push(`هامش الشقّ خُفّض إلى ${margin.toFixed(1)} مم ليناسب الارتفاع.`)
  if (hd - FOOT - margin < 3 * t) errors.push('الارتفاع صغير جداً لشقوق الفواصل.')
  if (Nn > 0 && (W - 2 * t) / (Nn + 1) < 3 * t) errors.push('الفواصل بالعرض كثيرة جداً لهذا العرض.')
  if (Mm > 0 && (D - 2 * t) / (Mm + 1) < 3 * t) errors.push('الفواصل بالعمق كثيرة جداً لهذا العمق.')
  const xs = Array.from({ length: Nn }, (_, i) => t + (W - 2 * t) * (i + 1) / (Nn + 1))
  const ds = Array.from({ length: Mm }, (_, j) => t + (D - 2 * t) * (j + 1) / (Mm + 1))
  return { xs, ds, sw, hd, margin, cells: (Nn + 1) * (Mm + 1) }
}

/** Base box plus a flat lid with a lip frame glued under it that drops inside the walls. */
function lipLidBox(p: Record<string, number>, c: Common, errors: string[]) {
  const { W, D, H, lipH, gap } = p, t = c.t
  const Wl = W - 2 * t - 2 * gap, Dl = D - 2 * t - 2 * gap
  if (lipH < 2 * t + 1) errors.push(`ارتفاع الشفة صغير جداً: يلزم ${2 * t + 1} مم على الأقل.`)
  if (lipH > H - t - 2) errors.push('ارتفاع الشفة أكبر من عمق الصندوق الداخلي.')
  const panels: PanelSpec[] = [
    ...openBox(W, D, H),
    { id: 'lid', name: 'الغطاء — اللوح', w: W, h: D, engrave: [engraveRect(t + gap, t + gap, Wl, Dl)], note: 'الخط الأزرق المحفور يحدّد موضع إطار الشفة على وجهه السفلي' },
    { id: 'lip-fb', name: 'شفة الغطاء — الأمام / الخلف', w: Wl, h: lipH, left: 'male', right: 'male', count: 2 },
    { id: 'lip-side', name: 'شفة الغطاء — الجانب', w: Dl, h: lipH, left: 'female', right: 'female', count: 2 },
  ]
  const notes = [
    `إطار الشفة ${Wl.toFixed(1)} × ${Dl.toFixed(1)} × ${lipH} مم يُلصق تحت اللوح داخل الخط المحفور؛ يدخل في الصندوق بخلوص ${gap} مم من كل جهة.`,
    'الارتفاع الكلّي مع الغطاء = الارتفاع + السماكة.',
  ]
  return { panels, notes, Wl, Dl }
}

export const TEMPLATES: Template[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 'closed',
    name: 'صندوق مغلق',
    desc: 'ستة أوجه بتعشيق أصابع. يُقصّ غطاؤه لاحقاً أو يُترك مغلقاً كمكعّب.',
    icon: `<path d="M12 22 32 12 52 22 32 32z"/><path d="M12 22v22l20 10V32M52 22v22L32 54"/>`,
    params: DIMS,
    defaults: { W: 100, D: 80, H: 60 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: 2 * t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H } = p
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'top', name: N.top, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'frontback', name: `${N.front} / ${N.back}`, w: W, h: H, top: 'female', bottom: 'female', left: 'male', right: 'male', count: 2 },
        { id: 'side', name: N.side, w: D, h: H, top: 'female', bottom: 'female', left: 'female', right: 'female', count: 2 },
      ]
      return { panels, notes: ['كل الأوجه تتعشّق بالأصابع؛ القاعدة والغطاء متطابقان.'], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'open',
    name: 'صندوق مفتوح',
    desc: 'خمسة أوجه، مفتوح من الأعلى. مناسب كصندوق تخزين أو حامل أدوات.',
    icon: `<path d="M12 22 32 12 52 22 32 32z"/><path d="M12 22v22l20 10V32M52 22v22L32 54"/><path d="M18 25l14 7 14-7" stroke-dasharray="2 2"/>`,
    params: DIMS,
    defaults: { W: 120, D: 80, H: 60 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      return { panels: openBox(p.W, p.D, p.H), notes: [], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'sliding',
    name: 'صندوق بغطاء منزلق',
    desc: 'غطاء ينزلق في شقّين جانبيين من الأمام، مع فتحة إصبع لسحبه.',
    icon: `<path d="M12 26 32 16 52 26 32 36z"/><path d="M12 26v18l20 10V36M52 26v18L32 54"/><path d="M4 20 24 10l20 10" stroke-width="2.5"/>`,
    params: [...DIMS, mm('slide', 'خلوص الانزلاق', 0, 2, 'فراغ إضافي في الشق ليتحرك الغطاء بسهولة'), mm('pull', 'نصف قطر فتحة الإصبع', 0, 30)],
    defaults: { W: 120, D: 80, H: 50, slide: 0.3, pull: 8 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: 2 * t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, slide } = p, t = c.t
      const frontH = H - 2 * t - slide
      if (frontH < 2 * t) errors.push(`الارتفاع صغير جداً للغطاء المنزلق: يلزم ${(4 * t + slide).toFixed(1)} مم على الأقل.`)
      const pull = fitPull(p.pull, W, D - t)
      // the rim above the slot hangs from a solid block at the side's top-back corner; the back joint starts below it,
      // so the rim stays attached whatever the finger size
      const slotBottom = 2 * t + slide, jointFrom = slotBottom + Math.max(1, t / 2)
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        {
          id: 'back', name: N.back, w: W, h: H, bottom: 'female', left: { type: 'male', from: jointFrom, len: H - jointFrom }, right: { type: 'male', from: jointFrom, len: H - jointFrom },
          cuts: [rect(0, 0, t, jointFrom), rect(W - t, 0, t, jointFrom)], note: 'زاويتاها العلويتان مقطوعتان ليملأهما الجانبان',
        },
        { id: 'front', name: N.front, w: W, h: frontH, bottom: 'female', left: 'male', right: 'male', note: 'أقصر من الخلفية ليمرّ الغطاء فوقها' },
        {
          id: 'side', name: N.side, w: D, h: H, count: 2,
          bottom: 'female', left: { type: 'female', from: slotBottom, len: frontH }, right: { type: 'female', from: jointFrom, len: H - jointFrom },
          cuts: [rect(0, t, D - t, t + slide)], note: 'الشقّ العلوي يستقبل الغطاء',
        },
        {
          id: 'lid', name: N.lid, w: W, h: D - t,
          post: loops => { if (pull >= 2) edgeNotch(loops, W / 2, 0, pull) },
        },
      ]
      return { panels, notes: ['الشريحة فوق الشقّ متّصلة بجسم الجانب عبر كتلة صلبة في الزاوية الخلفية العلوية، وتعشيق الخلفية يبدأ تحتها.', 'الغطاء ينزلق من الأمام؛ حافّته الأمامية مع فتحة الإصبع.'], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'liftoff',
    name: 'علبة بغطاء منفصل',
    desc: 'قاعدة مفتوحة وغطاء يُلبَس فوقها كعلبة الأحذية.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M8 14 32 2l24 12-24 12z"/><path d="M8 14v6l24 12 24-12v-6"/>`,
    params: [...DIMS, mm('lidH', 'ارتفاع الغطاء', 5, 500), mm('gap', 'خلوص الغطاء', 0, 3, 'فراغ بين القاعدة والغطاء من كل جهة')],
    defaults: { W: 100, D: 70, H: 40, lidH: 20, gap: 0.3 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, lidH, gap } = p, t = c.t
      if (lidH > H) warnings.push('ارتفاع الغطاء أكبر من ارتفاع القاعدة.')
      if (lidH < 2 * t + 2) errors.push(`ارتفاع الغطاء صغير جداً: يلزم ${2 * t + 2} مم على الأقل.`)
      const panels = [...openBox(W, D, H, 'القاعدة', 'base-'), ...openBox(W + 2 * t + 2 * gap, D + 2 * t + 2 * gap, lidH, 'الغطاء', 'lid-')]
      return { panels, notes: ['الغطاء صندوق مفتوح مقلوب أبعاده الداخلية = أبعاد القاعدة الخارجية + الخلوص.'], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'hinged',
    name: 'صندوق بغطاء مفصلي',
    desc: 'ستّ قطع: الغطاء لوح واحد له لسانان يدخلان في ثقبي الجانبين ويدور عليهما. بلا محور ولا براغٍ.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M52 30 40 6l-24 8"/><path d="M52 30 58 20M40 6l18 14"/><circle cx="50" cy="29" r="1.8" fill="currentColor"/>`,
    params: [...DIMS, ...HINGE_PARAMS],
    defaults: { W: 120, D: 80, H: 50, ...HINGE_DEFAULTS },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { panels, notes } = pivotLidBox(p, c, warnings, errors)
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'flex',
    name: 'صندوق بمفصل مرن',
    desc: 'الخلفية والغطاء قطعة واحدة تنثني بشبكة قصّات (living hinge) حول ظهر مستدير.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M52 30c4-10 2-18-8-22"/><path d="M50 24l-4 1M50 20l-5 1M48 15l-5 1M46 11l-5 1" stroke-width="1.5"/>`,
    params: [
      ...DIMS,
      mm('R', 'نصف قطر الانحناء', 6, 80, 'نصف القطر الخارجي للظهر المستدير'),
      mm('seg', 'طول قصّة المفصل', 5, 80), mm('bridge', 'الجسر بين القصّات', 1, 10), mm('pitch', 'المسافة بين الصفوف', 0.6, 6),
      mm('pull', 'نصف قطر فتحة الإصبع', 0, 30),
    ],
    defaults: { W: 100, D: 80, H: 50, R: 15, seg: 20, bridge: 3, pitch: 1.5, pull: 8 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, R, seg, bridge, pitch } = p, t = c.t
      const Rr = R - t
      if (Rr < 2) errors.push(`نصف قطر الانحناء يجب أن يكون أكبر من السماكة + 2 مم (${t + 2} مم).`)
      if (R > Math.min(D, H) - 2 * t) errors.push(`نصف قطر الانحناء كبير بالنسبة للعمق أو الارتفاع: الحدّ ${Math.min(D, H) - 2 * t} مم.`)
      const pull = fitPull(p.pull, W, D - R)
      const Lh = (R - t / 2) * Math.PI / 2 // arc length of the hinge mid-surface
      const lidLen = D - R, backLen = H - R + t
      const rows = Math.floor(Lh / pitch)
      if (rows < 3) errors.push('منطقة المفصل قصيرة جداً لتنثني: زد نصف قطر الانحناء أو قلّل المسافة بين الصفوف.')
      const open: Loop[] = hingeLines(0, lidLen, W, lidLen + Lh, seg, bridge, pitch, 'x')
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'front', name: N.front, w: W, h: H, bottom: 'female', left: 'male', right: 'male' },
        {
          id: 'side', name: N.side, w: D, h: H, count: 2,
          bottom: 'female', left: 'female', right: { type: 'female', from: Rr, len: backLen },
          cuts: [rect(D - t, 0, t, Rr)],
          post: loops => roundCorner(loops, D - t, 0, Rr),
          note: 'الزاوية الخلفية العلوية مستديرة ليلتفّ المفصل حولها',
        },
        {
          id: 'lidback', name: 'الغطاء + المفصل + الخلفية', w: W, h: lidLen + Lh + backLen,
          bottom: 'female', left: { type: 'male', from: lidLen + Lh, len: backLen }, right: { type: 'male', from: lidLen + Lh, len: backLen },
          open,
          post: loops => { if (pull >= 2) edgeNotch(loops, W / 2, 0, pull) },
          note: 'الطرف العلوي هو مقدّمة الغطاء، والسفلي قاعدة الخلفية',
        },
      ]
      const notes = [
        `المفصل المرن: ${rows} صفوف من القصّات بطول ${Lh.toFixed(1)} مم ينثني 90° حول الظهر.`,
        'الغطاء يستقرّ فوق حوافّ الجانبين والواجهة؛ الارتفاع الكلّي = الارتفاع + السماكة.',
        'جرّب المفصل على قطعة صغيرة أولاً: خشب الـ MDF ينكسر أسرع من الأبلكاش.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'organizer',
    name: 'منظّم بفواصل',
    desc: 'صندوق مفتوح بفواصل متقاطعة تدخل في شقوق الجدران. مثالي للأدراج والمجوهرات.',
    icon: `<path d="M12 22 32 12 52 22 32 32z"/><path d="M12 22v22l20 10V32M52 22v22L32 54"/><path d="M22 17v22M42 17v22M19 25.5l26-13" stroke-width="1.5"/>`,
    params: [...DIMS, ...DIVIDER_PARAMS],
    defaults: { W: 180, D: 120, H: 45, N: 2, M: 1, margin: 8, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H } = p, t = c.t
      const d = dividerPlan(p, t, errors, warnings)
      const box = openBox(W, D, H)
      for (const sp of box) {
        if (sp.id === 'front' || sp.id === 'back') addSlots(sp, d.xs, d.margin, d.hd - FOOT, d.sw)
        if (sp.id === 'side') addSlots(sp, d.ds, d.margin, d.hd - FOOT, d.sw)
      }
      const panels = [...box, ...dividers(W, D, d.hd, d.xs, d.ds, t, d.sw, d.margin)]
      const notes = [`${d.cells} خانة. الفواصل تتقاطع بشقوق نصفية (egg-crate) وتُثبّت بأطرافها في الجدران.`]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'tray',
    name: 'صينية بمقابض',
    desc: 'صندوق منخفض مع فتحتي مقبض في الجانبين للحمل.',
    icon: `<path d="M8 30 32 18 56 30 32 42z"/><path d="M8 30v8l24 12V42M56 30v8L32 50"/><path d="M44 29l6-3v4l-6 3z" fill="currentColor" stroke="none"/><path d="M12 29l6 3v4l-6-3z" fill="currentColor" stroke="none"/>`,
    params: [...DIMS, mm('hl', 'طول المقبض', 20, 300), mm('hh', 'ارتفاع المقبض', 10, 60), mm('hm', 'الهامش فوق المقبض', 4, 50)],
    defaults: { W: 220, D: 140, H: 50, hl: 60, hh: 18, hm: 8 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H } = p, t = c.t
      // the handle shrinks to fit the side it is cut into
      const hl = Math.min(p.hl, D - 4 * t), hm = Math.max(3, Math.min(p.hm, (H - t) / 4)), hh = Math.min(p.hh, H - t - hm - 3)
      if (hh < 8 || hl < 15) errors.push(`الجانب (${D} × ${H} مم) أصغر من أن يحمل فتحة مقبض؛ زد الارتفاع أو العمق.`)
      else if (hl < p.hl || hh < p.hh || hm < p.hm) warnings.push(`صُغّر المقبض إلى ${hl.toFixed(0)} × ${hh.toFixed(0)} مم ليناسب الجانب.`)
      const box = openBox(W, D, H)
      const side = box.find(x => x.id === 'side')!
      if (hh >= 8 && hl >= 15) side.holes = [stadium(D / 2, hm + hh / 2, hl, hh)]
      return { panels: box, notes: ['فتحتا المقبض في الجانبين (لوحا العمق).'], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'drawer',
    name: 'صندوق بدرج',
    desc: 'غلاف مغلق مفتوح من الأمام، ودرج ينزلق فيه بفتحة إصبع في واجهته.',
    icon: `<path d="M12 22 32 12 52 22 32 32z"/><path d="M12 22v22l20 10V32M52 22v22L32 54"/><path d="M8 30 28 40v18L8 48z"/><path d="M15 42h6" stroke-width="2.5"/>`,
    params: [...DIMS, mm('gap', 'خلوص الدرج', 0.2, 3, 'فراغ بين الدرج والغلاف من كل جهة'), mm('pull', 'نصف قطر فتحة الإصبع', 0, 30)],
    defaults: { W: 120, D: 100, H: 50, gap: 0.6, pull: 10 },
    innerAdd: t => ({ W: 2 * t, D: t, H: 2 * t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, gap } = p, t = c.t
      const Wd = W - 2 * t - 2 * gap, Dd = D - t - gap, Hd = H - 2 * t - gap
      if (Hd < 3 * t || Wd < 4 * t || Dd < 4 * t) errors.push('الغلاف صغير جداً ليتّسع لدرج بتعشيق أصابع.')
      const pull = fitPull(p.pull, Wd, Hd - t)
      const drawer = openBox(Wd, Dd, Hd, 'الدرج', 'drawer-')
      const front = drawer.find(x => x.id === 'drawer-front')!
      front.post = loops => { if (pull >= 2) edgeNotch(loops, Wd / 2, 0, pull) }
      front.note = 'واجهة الدرج مع فتحة الإصبع'
      const panels: PanelSpec[] = [
        { id: 'shell-plate', name: 'الغلاف — السطح / القاعدة', w: W, h: D, top: 'flat', bottom: 'male', left: 'male', right: 'male', count: 2, note: 'الحافّة الأمامية مستوية (فتحة الدرج)' },
        { id: 'shell-back', name: 'الغلاف — الخلفية', w: W, h: H, top: 'female', bottom: 'female', left: 'male', right: 'male' },
        { id: 'shell-side', name: 'الغلاف — الجانب', w: D, h: H, top: 'female', bottom: 'female', left: 'flat', right: 'female', count: 2 },
        ...drawer,
      ]
      const notes = [
        `الدرج ${Wd.toFixed(1)} × ${Dd.toFixed(1)} × ${Hd.toFixed(1)} مم خارجياً، ينزلق في فراغ الغلاف بخلوص ${gap} مم من كل جهة.`,
        'واجهة الدرج تستقرّ على بُعد الخلوص خلف حافّة الغلاف الأمامية؛ لو أردتها بارزة أضف لوحاً زخرفياً أمامها.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'tissue',
    name: 'علبة مناديل',
    desc: 'صندوق مقلوب: السطح فيه فتحة سحب المناديل، ويُملأ من الأسفل.',
    icon: `<path d="M8 30 32 18 56 30 32 42z"/><path d="M8 30v12l24 12V42M56 30v12L32 54"/><path d="M24 30c4-3 12-3 16 0" stroke-width="2.5"/><path d="M30 28c2-8 4-10 6-6" stroke-width="1.5"/>`,
    params: [...DIMS, mm('slotL', 'طول فتحة السحب', 20, 300), mm('slotW', 'عرض فتحة السحب', 8, 80)],
    defaults: { W: 240, D: 125, H: 90, slotL: 110, slotW: 35 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H } = p, t = c.t
      const slotL = Math.min(p.slotL, W - 4 * t), slotW = Math.min(p.slotW, D - 4 * t)
      if (slotL < 20 || slotW < 8) errors.push('السطح أصغر من أن يحمل فتحة سحب.')
      else if (slotL < p.slotL || slotW < p.slotW) warnings.push(`صُغّرت فتحة السحب إلى ${slotL.toFixed(0)} × ${slotW.toFixed(0)} مم لتناسب السطح.`)
      const box = openBox(W, D, H)
      const top = box.find(x => x.id === 'bottom')!
      top.name = 'السطح (فتحة المناديل)'
      if (slotL >= 20 && slotW >= 8) top.holes = [stadium(W / 2, D / 2, slotL, slotW)]
      const notes = [`يُقلب الصندوق فيصير لوح القاعدة سطحاً بفتحة ${slotL.toFixed(0)} × ${slotW.toFixed(0)} مم، ويُملأ من الجهة المفتوحة في الأسفل. علبة المناديل القياسية 230 × 115 × 80 مم تحتاج فراغاً داخلياً أكبر منها قليلاً.`]
      return { panels: box, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 11
  {
    id: 'lip',
    name: 'صندوق هدايا بغطاء ذي شفة',
    desc: 'غطاء مسطّح تحته إطار يدخل داخل الصندوق فيثبت دون أن يبرز عن الجوانب.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M8 18 32 6l24 12-24 12z"/><path d="M14 21l18 9 18-9M18 23v4M46 23v4M32 30v4" stroke-width="1.5"/>`,
    params: [...DIMS, mm('lipH', 'ارتفاع الشفة', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2, 'فراغ بين إطار الشفة وجدران الصندوق')],
    defaults: { W: 120, D: 90, H: 50, lipH: 10, gap: 0.5 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { panels, notes } = lipLidBox(p, c, errors)
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 12
  {
    id: 'window',
    name: 'صندوق عرض بنافذة',
    desc: 'صندوق هدايا بغطاء ذي شفة، في غطائه نافذة بزوايا مستديرة يُلصق تحتها لوح أكريليك شفّاف.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M8 18 32 6l24 12-24 12z"/><path d="M18 18 32 11l14 7-14 7z" stroke-dasharray="2 1.5"/>`,
    params: [...DIMS, mm('lipH', 'ارتفاع الشفة', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2), mm('wm', 'إطار حول النافذة', 6, 60, 'عرض الخشب الباقي حول النافذة من كل جهة'), mm('wr', 'نصف قطر زوايا النافذة', 0, 30)],
    defaults: { W: 140, D: 100, H: 45, lipH: 10, gap: 0.5, wm: 14, wr: 6 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, wm, wr, gap } = p, t = c.t
      const { panels, notes, Wl, Dl } = lipLidBox(p, c, errors)
      const overlap = Math.min(5, (wm - 2 * t - gap) / 2) // how far the acrylic can reach under the wood, inside the lip frame
      if (overlap < 2) errors.push(`إطار النافذة ضيّق: يلزم ${Math.ceil(2 * t + gap + 4)} مم على الأقل ليبقى مكان لإلصاق الأكريليك داخل الشفة.`)
      const ww = W - 2 * wm, wh = D - 2 * wm
      if (ww < 20 || wh < 20) errors.push('النافذة أصغر من 20 مم؛ قلّل إطارها أو كبّر الصندوق.')
      const lid = panels.find(x => x.id === 'lid')!
      if (ww >= 20 && wh >= 20) lid.holes = [roundedRectHole(wm, wm, ww, wh, Math.min(wr, ww / 2, wh / 2))]
      lid.note = 'النافذة في الوسط، والخط الأزرق موضع إطار الشفة على الوجه السفلي'
      const acrylic = { w: Math.min(ww + 2 * overlap, Wl - 2 * t), h: Math.min(wh + 2 * overlap, Dl - 2 * t) }
      return { panels, notes: [...notes, `لوح الأكريليك الشفّاف: ${acrylic.w.toFixed(1)} × ${acrylic.h.toFixed(1)} مم (النافذة ${ww} × ${wh} + ${overlap.toFixed(1)} مم تداخل من كل جهة)، يُلصق تحت اللوح داخل إطار الشفة. اقصّه من ملف منفصل على لوح أكريليك.`], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 13
  {
    id: 'teabox',
    name: 'صندوق شاي بفواصل',
    desc: 'الصندوق المفصلي نفسه مع فواصل متقاطعة للأكياس والخانات.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M52 30 40 6l-24 8"/><path d="M22 25v14M42 25v14M19 33l26-13" stroke-width="1.5"/><circle cx="50" cy="29" r="1.8" fill="currentColor"/>`,
    params: [...DIMS, ...DIVIDER_PARAMS, ...HINGE_PARAMS],
    defaults: { W: 180, D: 120, H: 60, N: 2, M: 1, margin: 8, fit: 0.2, ...HINGE_DEFAULTS },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D } = p, t = c.t
      const d = dividerPlan(p, t, errors, warnings)
      // the finger notch in the front wall must keep clear of the divider slots
      const pullMax = d.xs.length ? Math.min(...d.xs.map(x => Math.abs(x - W / 2) - d.sw / 2 - 2)) : Infinity
      const { panels: box, notes, g } = pivotLidBox({ ...p, pull: Math.max(0, Math.min(p.pull, pullMax)) }, c, warnings, errors)
      if (p.pull > 0 && pullMax < 2) warnings.push('أُلغيت فتحة الإصبع لأن شقّ فاصل يقع في وسط الواجهة.')
      // the lid's tail dips inside the box behind the pivot: dividers must stay out of that zone
      const tailFrom = round3(g.earX - g.gap - 1)
      const dip = round3(Math.hypot(g.lidD - g.pivotX, t / 2) - t / 2 + 1)
      if (d.ds.some(x => x > tailFrom - 2 * t)) errors.push('فاصل بالعرض يقع تحت مسار ذيل الغطاء عند الفتح؛ قلّل عدد الفواصل بالعمق.')
      for (const sp of box) {
        if (sp.id === 'front') addSlots(sp, d.xs, d.margin, d.hd - FOOT, d.sw)
        if (sp.id === 'back') addSlots(sp, d.xs, t + d.margin, t + d.hd - FOOT, d.sw)
        if (sp.id === 'side') addSlots(sp, d.ds, g.a + d.margin, g.a + d.hd - FOOT, d.sw)
      }
      const panels = [...box, ...dividers(W, D, d.hd, d.xs, d.ds, t, d.sw, d.margin, d.xs.length ? { from: tailFrom, depth: dip } : undefined)]
      return { panels, notes: [`${d.cells} خانة. الفواصل تتقاطع بشقوق نصفية وتُثبّت بأطرافها في الجدران؛ الفواصل بالعمق منخفضة ${dip} مم عند الخلف ليمرّ ذيل الغطاء.`, ...notes], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 14
  {
    id: 'lantern',
    name: 'فانوس مكعّب',
    desc: 'صندوق إضاءة: جوانب مزخرفة بثقوب، فتحة للدواية في القاعدة، وغطاء ذو شفة يُرفع لتبديل المصباح.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><circle cx="20" cy="40" r="1.6"/><circle cx="26" cy="43" r="1.6"/><circle cx="20" cy="46" r="1.6"/><circle cx="44" cy="40" r="1.6"/><circle cx="38" cy="43" r="1.6"/><circle cx="44" cy="46" r="1.6"/><path d="M28 14l4-8 4 8"/>`,
    params: [
      ...DIMS,
      mm('socket', 'قطر فتحة الدواية', 0, 80, 'E27 ≈ 40 مم، E14 ≈ 28 مم؛ 0 = بلا فتحة'),
      mm('vent', 'قطر فتحة التهوية في الغطاء', 0, 150, '0 = بلا فتحة'),
      { key: 'pattern', label: 'الزخرفة', min: 1, max: 3, step: 1, int: true, hint: '1 = شبكة دوائر، 2 = شقوق عمودية، 3 = نافذة كبيرة' },
      mm('cell', 'حجم الثقب', 3, 40, 'قطر الدائرة أو عرض الشقّ'),
      mm('lipH', 'ارتفاع شفة الغطاء', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2),
    ],
    defaults: { W: 100, D: 100, H: 160, socket: 40, vent: 40, pattern: 1, cell: 8, lipH: 10, gap: 0.5 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, socket, vent, cell, lipH } = p, t = c.t
      const pattern = Math.round(p.pattern)
      const { panels, notes } = lipLidBox(p, c, errors)
      if (socket > 0 && socket > Math.min(W, D) - 4 * t - 4) errors.push('فتحة الدواية أكبر من القاعدة.')
      if (vent > 0 && vent > Math.min(W, D) - 4 * t - 4) errors.push('فتحة التهوية أكبر من الغطاء.')
      const bottom = panels.find(x => x.id === 'bottom')!
      if (socket > 0 && socket <= Math.min(W, D) - 4 * t - 4) bottom.holes = [circle(W / 2, D / 2, socket / 2)]
      bottom.note = 'فتحة الدواية في الوسط'
      const lid = panels.find(x => x.id === 'lid')!
      if (vent > 0 && vent <= Math.min(W, D) - 4 * t - 4) lid.holes = [circle(W / 2, D / 2, vent / 2)]
      // the decorative field keeps clear of the finger strips, the lip frame's seat and the bottom joint
      const m = 2 * t + 2, top = Math.max(m, lipH + 2), bottomY = H - t - m
      const field = (w: number) => ({ x0: m, x1: w - m, y0: top, y1: bottomY })
      const holesFor = (w: number): Loop[] => {
        const f = field(w), fw = f.x1 - f.x0, fh = f.y1 - f.y0
        if (fw < cell * 2 || fh < cell * 2) return []
        if (pattern === 3) return [roundedRectHole(f.x0, f.y0, fw, fh, Math.min(4, cell / 2))]
        if (pattern === 2) {
          const pitch = cell * 2, n = Math.max(1, Math.floor((fw - cell) / pitch) + 1), x0 = f.x0 + (fw - (n - 1) * pitch) / 2
          return Array.from({ length: n }, (_, i) => stadiumV(x0 + i * pitch, f.y0 + fh / 2, fh, cell))
        }
        const pitch = cell * 1.7, nx = Math.max(1, Math.floor((fw - cell) / pitch) + 1), ny = Math.max(1, Math.floor((fh - cell) / pitch) + 1)
        const x0 = f.x0 + (fw - (nx - 1) * pitch) / 2, y0 = f.y0 + (fh - (ny - 1) * pitch) / 2
        const out: Loop[] = []
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push(circle(x0 + i * pitch, y0 + j * pitch, cell / 2))
        return out
      }
      for (const sp of panels) {
        if (sp.id === 'front' || sp.id === 'back') sp.holes = holesFor(W)
        if (sp.id === 'side') sp.holes = holesFor(D)
      }
      if (!holesFor(W).length) warnings.push('الجدران أصغر من أن تحمل الزخرفة بهذا الحجم؛ صغّر حجم الثقب أو كبّر الفانوس.')
      return {
        panels,
        notes: [
          'استعمل مصباح LED فقط (لا يسخن)؛ المصابيح المتوهّجة خطر داخل الخشب.',
          'الدواية تُثبّت في فتحة القاعدة بصامولتها والكابل يخرج من الأسفل؛ الغطاء يُرفع لتبديل المصباح.',
          'الزخرفة 1 دوائر، 2 شقوق عمودية، 3 نافذة واحدة تصلح لورق أو أكريليك حليبي من الداخل.',
          ...notes,
        ],
        warnings, errors,
      }
    },
  },
  // ------------------------------------------------------------------ 15
  {
    id: 'shade',
    name: 'أباجورة أسطوانية',
    desc: 'لوح بمفصل مرن يلتفّ حول حلقتين بلسانات؛ القصّات نفسها تسرّب الضوء. للتعليق أو الطاولة.',
    icon: `<ellipse cx="32" cy="14" rx="18" ry="6"/><ellipse cx="32" cy="50" rx="18" ry="6"/><path d="M14 14v36M50 14v36"/><path d="M20 22v8M26 20v12M32 22v8M38 20v12M44 22v8M23 36v8M29 34v12M35 36v8M41 34v12" stroke-width="1.5"/>`,
    params: [
      mm('Dm', 'القطر الخارجي', 40, 600), mm('H', 'الارتفاع', 30, 600),
      mm('socket', 'قطر فتحة الدواية', 0, 80, 'في الحلقة العلوية: E27 ≈ 40 مم، E14 ≈ 28 مم'),
      { key: 'tabs', label: 'عدد اللسانات', min: 3, max: 24, step: 1, int: true, hint: 'في كل حافّة' },
      mm('tabW', 'عرض اللسان', 4, 40), mm('fit', 'خلوص اللسان', 0, 1),
      mm('seg', 'طول قصّة المفصل', 5, 80), mm('bridge', 'الجسر بين القصّات', 1, 10), mm('pitch', 'المسافة بين الصفوف', 0.6, 6),
    ],
    defaults: { Dm: 120, H: 160, socket: 40, tabs: 8, tabW: 10, fit: 0.2, seg: 20, bridge: 3, pitch: 1.5 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { Dm, H, socket, tabW, fit, seg, bridge, pitch } = p, t = c.t
      const n = Math.round(p.tabs)
      const Rmid = Dm / 2 - t / 2           // the sheet's mid-surface
      // rings reach 2t beyond the sheet's outer face, and always 2 mm beyond the slots' outer corners
      const Rring = Math.max(Dm / 2 + 2 * t, Math.hypot(Rmid + (t + fit) / 2, (tabW + fit) / 2) + 2)
      const L = round3(2 * Math.PI * Rmid)  // sheet length = mid-surface circumference
      if (Dm < 8 * t + 10) errors.push('القطر صغير جداً لحلقة بثقب.')
      // a flat tab in a slot on a curved ring: the chord must not stray from the arc by more than the fit
      const sagitta = Rmid - Math.sqrt(Math.max(0, Rmid * Rmid - (tabW / 2) * (tabW / 2)))
      if (sagitta > fit + 0.3) errors.push(`اللسان عريض بالنسبة للقطر (ينحرف ${sagitta.toFixed(2)} مم عن القوس)؛ أقصى عرض نحو ${Math.floor(2 * Math.sqrt(Rmid * Rmid - (Rmid - fit - 0.3) ** 2))} مم.`)
      if (socket > 0 && socket > Dm - 6 * t) errors.push('فتحة الدواية أكبر من الحلقة.')
      if (n * (tabW + 4) > L) errors.push('اللسانات كثيرة أو عريضة بالنسبة للمحيط.')
      if (L > 400) warnings.push(`لوح الأباجورة طوله ${L.toFixed(0)} مم؛ تأكد أن لوحك وآلتك يتّسعان له، أو اقسمه إلى قطعتين وأضف وصلة.`)
      if (pitch > 2) warnings.push('صفوف المفصل متباعدة؛ قد ينكسر عند الانحناء على هذا القطر.')
      const cx = Rring
      const slotAngles = Array.from({ length: n }, (_, k) => (2 * Math.PI * k) / n)
      const slots = slotAngles.map(a => rotatedRectHole(cx + Rmid * Math.cos(a), cx + Rmid * Math.sin(a), tabW + fit, t + fit, a + Math.PI / 2))
      const ring = (id: string, name: string, holeR: number, note: string): PanelSpec => ({
        id, name, w: 2 * Rring, h: 2 * Rring, shape: [disc(cx, cx, Rring)], holes: [...(holeR > 0 ? [circle(cx, cx, holeR)] : []), ...slots], note,
      })
      // the sheet: H tall plus a t-deep tab strip on each edge; the strips are cut away between the tabs
      const xs = Array.from({ length: n }, (_, k) => round3(L * (k + 0.5) / n))
      const stripCuts = (y: number) => {
        const out = [] as ReturnType<typeof rect>[]
        let x = 0
        for (const xk of xs) { out.push(rect(x, y, xk - tabW / 2 - x, t)); x = xk + tabW / 2 }
        out.push(rect(x, y, L - x, t))
        return out
      }
      const panels: PanelSpec[] = [
        ring('ring-top', 'الحلقة العلوية', socket > 0 ? socket / 2 : 0, 'فتحة الدواية في الوسط وشقوق اللسانات حول المحيط'),
        ring('ring-bottom', 'الحلقة السفلية', Math.max(0, Dm / 2 - 3 * t), 'مفتوحة من الوسط ليخرج الضوء'),
        {
          id: 'sheet', name: 'اللوح الملتفّ (مفصل مرن)', w: L, h: H + 2 * t,
          cuts: [...stripCuts(0), ...stripCuts(H + t)],
          open: hingeLines(0, t, L, H + t, seg, bridge, pitch, 'y'),
          note: 'يلتفّ حول الحلقتين؛ اللسانات تدخل في شقوقهما',
        },
      ]
      const notes = [
        `اللوح ${L.toFixed(1)} × ${H} مم ينحني بالمفصل المرن حول الحلقتين (نصف قطر الانحناء الداخلي ${(Dm / 2 - t).toFixed(1)} مم)؛ ${n} لسانات في كل حافّة تدخل في شقوق الحلقات، وطرفا اللوح يلتقيان ويُلصقان.`,
        'الحلقتان أعرض من الأسطوانة بسماكتين لتكوّنا حافّة؛ الحلقة العلوية تحمل الدواية، والسفلية مفتوحة.',
        'استعمل مصباح LED فقط. القصّات نفسها تسرّب خطوط ضوء جميلة؛ لتخفيفها ضع ورقاً من الداخل.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
]

/**
 * Geometry of the pivot-tab lid: where the ear, the pivot hole and the lid's tabs sit.
 * Side-panel coords: y = 0 is the ear top, the rim is at y = a. Every value that becomes an outline
 * vertex is snapped to the 0.001 mm grid the union uses, so later fillets find their corners.
 */
export function pivotLid(p: Record<string, number>, t: number) {
  const tab = p.tab > 0 ? p.tab : t
  const holeR = (Math.hypot(tab, t) + p.hc) / 2
  const webTop = Math.max(2.5, 0.8 * t), webBack = Math.max(2, 0.7 * t) // material left around the hole, growing with thickness
  const a = round3(t / 2 + holeR + webTop)              // ear rise above the rim
  const pivotX = round3(p.D - t - holeR - webBack)      // hole centre, measured from the front face
  const earX = round3(pivotX - t / 2 - a)               // foot of the quarter-round ear; its centre sits t/2 ahead of and below the pivot
  const gap = p.gap
  // the lid's tail swings inside the box; the setback from the back wall keeps ≥ 1 mm between its swept corner and the wall
  const reachLimit = holeR + webBack - 1
  const setback = Math.max(1.5, holeR + webBack - Math.sqrt(Math.max(0, reachLimit * reachLimit - (t / 2) * (t / 2))))
  const lidD = round3(p.D - t - setback)
  const tabY0 = round3(pivotX - tab / 2), tabY1 = round3(pivotX + tab / 2)
  return { tab, holeR, a, pivotX, earX, gap, lidD, tabY0, tabY1, setback, webTop, webBack }
}

export const templateById = (id: string) => TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
