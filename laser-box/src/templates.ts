// Ready-made box designs. Every template turns its parameters into panel specs.
import { Loop, rect, circle, stadium, roundCorner, edgeNotch, round3 } from './geom'
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
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'back', name: N.back, w: W, h: H, bottom: 'female', left: 'female', right: 'female' },
        { id: 'front', name: N.front, w: W, h: frontH, bottom: 'female', left: 'male', right: 'male', note: 'أقصر من الخلفية ليمرّ الغطاء فوقها' },
        {
          id: 'side', name: N.side, w: D, h: H, count: 2,
          bottom: 'female', left: { type: 'female', from: 2 * t + slide, len: frontH }, right: 'male',
          cuts: [rect(0, t, D - t, t + slide)], note: 'الشقّ العلوي يستقبل الغطاء',
        },
        {
          id: 'lid', name: N.lid, w: W, h: D - t,
          post: loops => { if (pull > 0 && W > 2 * pull + 4) edgeNotch(loops, W / 2, 0, pull) },
        },
      ]
      return { panels, notes: ['الجانبان: الحافّة الخلفية ذكر (أصابع بارزة) لتبقى الشريحة فوق الشقّ متّصلة بالجسم.', 'الغطاء ينزلق من الأمام؛ حافّته الأمامية مع فتحة الإصبع.'], warnings, errors }
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
    params: [
      ...DIMS,
      mm('tab', 'عرض اللسان', 0, 20, '0 = تلقائياً يساوي السماكة؛ مقطعه مربّع ليدور في الثقب'),
      mm('hc', 'خلوص المفصل', 0.2, 1.5, 'يُضاف لقطر الثقب فوق قُطر مقطع اللسان'),
      mm('gap', 'خلوص الغطاء', 0.2, 2, 'فراغ بين الغطاء والجانبين والخلفية'),
      mm('pull', 'نصف قطر فتحة الإصبع', 0, 30, 'في حافّة الواجهة الأمامية تحت الغطاء'),
    ],
    defaults: { W: 120, D: 80, H: 50, tab: 0, hc: 0.4, gap: 0.5, pull: 8 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
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
      const open: Loop[] = []
      const y0 = lidLen + (Lh - (rows - 1) * pitch) / 2
      const P = seg + bridge
      for (let k = 0; k < rows; k++) {
        const y = y0 + k * pitch
        for (let i = -1; i <= Math.ceil(W / P) + 1; i++) {
          let a = bridge + i * P + (k % 2 ? P / 2 : 0), b = a + seg
          a = Math.max(a, bridge); b = Math.min(b, W - bridge)
          if (b - a >= 2) open.push({ closed: false, pts: [{ x: a, y }, { x: b, y }] })
        }
      }
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
    params: [
      ...DIMS,
      { key: 'N', label: 'فواصل بالعرض', min: 0, max: 20, step: 1, int: true, hint: 'عدد الفواصل الموازية للعمق' },
      { key: 'M', label: 'فواصل بالعمق', min: 0, max: 20, step: 1, int: true, hint: 'عدد الفواصل الموازية للعرض' },
      mm('margin', 'هامش أعلى الشقّ', 3, 50, 'المسافة من الحافّة العلوية إلى بداية شقّ الفاصل'),
      mm('fit', 'خلوص الفواصل', 0, 1, 'يُضاف لعرض الشقوق لتدخل الفواصل بسهولة'),
    ],
    defaults: { W: 180, D: 120, H: 45, N: 2, M: 1, margin: 8, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, fit } = p, t = c.t
      const Nn = Math.round(p.N), Mm = Math.round(p.M)
      const sw = t + fit, hd = H - t
      const margin = Math.min(p.margin, Math.max(2, hd / 3))
      if (margin < p.margin) warnings.push(`هامش الشقّ خُفّض إلى ${margin.toFixed(1)} مم ليناسب الارتفاع.`)
      if (Nn > 0 && (W - 2 * t) / (Nn + 1) < 3 * t) errors.push('الفواصل بالعرض كثيرة جداً لهذا العرض.')
      if (Mm > 0 && (D - 2 * t) / (Mm + 1) < 3 * t) errors.push('الفواصل بالعمق كثيرة جداً لهذا العمق.')
      const xs = Array.from({ length: Nn }, (_, i) => t + (W - 2 * t) * (i + 1) / (Nn + 1))
      const ds = Array.from({ length: Mm }, (_, j) => t + (D - 2 * t) * (j + 1) / (Mm + 1))
      const slotsAt = (pos: number[]) => pos.map(x => rect(x - sw / 2, margin, sw, hd - margin))
      const box = openBox(W, D, H)
      for (const s of box) {
        if (s.id === 'front' || s.id === 'back') s.cuts = slotsAt(xs)
        if (s.id === 'side') s.cuts = slotsAt(ds)
      }
      const panels: PanelSpec[] = [...box]
      if (Nn > 0) panels.push({
        id: 'divN', name: 'فاصل بالعمق', w: D, h: hd, count: Nn,
        cuts: [rect(0, 0, t, margin), rect(D - t, 0, t, margin), ...ds.map(d => rect(d - sw / 2, 0, sw, hd / 2))],
        note: 'يدخل في شقوق الواجهتين؛ شقوق التقاطع من الأعلى',
      })
      if (Mm > 0) panels.push({
        id: 'divM', name: 'فاصل بالعرض', w: W, h: hd, count: Mm,
        cuts: [rect(0, 0, t, margin), rect(W - t, 0, t, margin), ...xs.map(x => rect(x - sw / 2, hd / 2, sw, hd / 2))],
        note: 'يدخل في شقوق الجانبين؛ شقوق التقاطع من الأسفل',
      })
      const notes = [`${(Nn + 1) * (Mm + 1)} خانة. الفواصل تتقاطع بشقوق نصفية (egg-crate) وتُثبّت بأطرافها في الجدران.`]
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
