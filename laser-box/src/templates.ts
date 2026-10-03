// Ready-made box designs. Every template turns its parameters into panel specs.
import { Loop, rect, circle, stadium, roundCorner, edgeNotch } from './geom'
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

export interface BuildResult { panels: PanelSpec[]; notes: string[]; warnings: string[] }

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

function checkBasics(p: Record<string, number>, c: Common, warnings: string[]) {
  for (const k of ['W', 'D', 'H']) if (k in p && p[k] < 4 * c.t) warnings.push(`القياس ${k} صغير جداً بالنسبة لسماكة الخامة.`)
  if (c.finger < c.t) warnings.push('عرض الأصبع أصغر من سماكة الخامة؛ الأصابع ستكون ضعيفة.')
  if (c.kerf > c.t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H } = p
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'top', name: N.top, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'frontback', name: `${N.front} / ${N.back}`, w: W, h: H, top: 'female', bottom: 'female', left: 'male', right: 'male', count: 2 },
        { id: 'side', name: N.side, w: D, h: H, top: 'female', bottom: 'female', left: 'female', right: 'female', count: 2 },
      ]
      return { panels, notes: ['كل الأوجه تتعشّق بالأصابع؛ القاعدة والغطاء متطابقان.'], warnings }
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      return { panels: openBox(p.W, p.D, p.H), notes: [], warnings }
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H, slide, pull } = p, t = c.t
      const frontH = H - 2 * t - slide
      if (frontH < 2 * t) warnings.push('الارتفاع صغير جداً لاستيعاب الغطاء المنزلق.')
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
      return { panels, notes: ['الجانبان: الحافّة الخلفية ذكر (أصابع بارزة) لتبقى الشريحة فوق الشقّ متّصلة بالجسم.', 'الغطاء ينزلق من الأمام؛ حافّته الأمامية مع فتحة الإصبع.'], warnings }
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H, lidH, gap } = p, t = c.t
      if (lidH > H) warnings.push('ارتفاع الغطاء أكبر من ارتفاع القاعدة.')
      const panels = [...openBox(W, D, H, 'القاعدة', 'base-'), ...openBox(W + 2 * t + 2 * gap, D + 2 * t + 2 * gap, lidH, 'الغطاء', 'lid-')]
      return { panels, notes: ['الغطاء صندوق مفتوح مقلوب أبعاده الداخلية = أبعاد القاعدة الخارجية + الخلوص.'], warnings }
    },
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'hinged',
    name: 'صندوق بغطاء مفصلي',
    desc: 'يفتح ويُغلق على محور خشبي (عود) يمرّ في أذنين خلف الصندوق. يدور بحرّية دون أن يصطدم بالخلفية.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M52 30 40 6l-24 8"/><path d="M52 30 58 20M40 6l18 14"/><circle cx="50" cy="29" r="1.8" fill="currentColor"/>`,
    params: [...DIMS, mm('lidH', 'ارتفاع الغطاء', 8, 500), mm('pin', 'قطر المحور', 1.5, 10, 'عود خشبي أو سيخ خيزران أو قضيب أكريليك'), mm('gap', 'خلوص الغطاء', 0, 2, 'فراغ بين جانب الغطاء وجانب القاعدة ليدور بسهولة')],
    defaults: { W: 120, D: 80, H: 50, lidH: 30, pin: 3, gap: 0.3 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H, lidH, pin, gap } = p, t = c.t
      // The pivot sits e behind the back face and e below the rim, inside a rounded ear on every side panel.
      // The ear stays within e·√2 of the pivot, which is the closest the lid's back panel ever comes, so nothing collides.
      const e = pin / 2 + 2.5, r = 1.25 * e, ear = e + r, neck = 2 * t
      if (H < ear + 2 * t + 2) warnings.push('ارتفاع القاعدة صغير جداً لأذن المفصل.')
      if (lidH < neck + 2 * t + 2) warnings.push('ارتفاع الغطاء صغير جداً لأذن المفصل.')
      const W2 = W + 2 * t + 2 * gap
      const earRect = (y: number) => rect(D - t, y, e + r + t, ear)
      const panels: PanelSpec[] = [
        { id: 'base-bottom', name: 'القاعدة — القاعدة', w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'base-front', name: 'القاعدة — الواجهة الأمامية', w: W, h: H, bottom: 'female', left: 'male', right: 'male' },
        {
          id: 'base-back', name: 'القاعدة — الواجهة الخلفية', w: W, h: H,
          bottom: 'female', left: { type: 'male', from: ear, len: H - ear }, right: { type: 'male', from: ear, len: H - ear },
          cuts: [rect(0, 0, t, ear), rect(W - t, 0, t, ear)], note: 'زاويتاها العلويتان مقطوعتان ليملأهما الجانبان',
        },
        {
          id: 'base-side', name: 'القاعدة — الجانب', w: D, h: H, count: 2,
          bottom: 'female', left: 'female', right: { type: 'female', from: ear, len: H - ear },
          adds: [earRect(0)],
          holes: [circle(D + e, e, (pin + 0.3) / 2)],
          post: loops => { roundCorner(loops, D + e + r, 0, r); roundCorner(loops, D + e + r, ear, r) },
          note: 'أذن خلفية مستديرة فيها ثقب المحور',
        },
        { id: 'lid-top', name: 'الغطاء — السطح', w: W2, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        { id: 'lid-front', name: 'الغطاء — الأمام', w: W2, h: lidH, top: 'female', left: 'male', right: 'male' },
        {
          id: 'lid-back', name: 'الغطاء — الخلف', w: W2, h: lidH,
          top: 'female', left: { type: 'male', from: 0, len: lidH - neck }, right: { type: 'male', from: 0, len: lidH - neck },
          cuts: [rect(0, lidH - neck, t, neck), rect(W2 - t, lidH - neck, t, neck)],
        },
        {
          id: 'lid-side', name: 'الغطاء — الجانب', w: D, h: lidH, count: 2,
          top: 'female', left: { type: 'female', from: 0, len: lidH }, right: { type: 'female', from: 0, len: lidH - neck },
          adds: [earRect(lidH)],
          holes: [circle(D + e, lidH + e, (pin + 0.1) / 2)],
          post: loops => { roundCorner(loops, D + e + r, lidH, r); roundCorner(loops, D + e + r, lidH + ear, r); roundCorner(loops, D - t, lidH + ear, r) },
          note: 'يركب خارج جانب القاعدة، وأذنه تنطبق على أذن القاعدة',
        },
      ]
      const notes = [
        `جانبا الغطاء يركبان خارج جانبي القاعدة (بخلوص ${gap} مم)، وأذنا الغطاء تنطبقان على أذني القاعدة خلف الصندوق.`,
        `المحور: عود بقطر ${pin} مم وطول ${W2.toFixed(1)} مم يمرّ خلف الصندوق في الثقوب الأربعة (أو عودان قصيران، واحد لكل جهة).`,
        'ثقب الغطاء أضيق ليثبت العود فيه، وثقب القاعدة أوسع قليلاً ليدور. الغطاء يدور بحرّية إلى الخلف دون أن يصطدم بالخلفية.',
        'عرض الغطاء الخارجي = عرض القاعدة + 2 × السماكة + 2 × الخلوص.',
      ]
      return { panels, notes, warnings }
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H, R, seg, bridge, pitch, pull } = p, t = c.t
      const Rr = R - t
      if (Rr < 2) warnings.push('نصف قطر الانحناء يجب أن يكون أكبر من السماكة + 2 مم.')
      if (R > Math.min(D, H) - 2 * t) warnings.push('نصف قطر الانحناء كبير بالنسبة للعمق أو الارتفاع.')
      const Lh = (R - t / 2) * Math.PI / 2 // arc length of the hinge mid-surface
      const lidLen = D - R, backLen = H - R + t
      const rows = Math.floor(Lh / pitch)
      if (rows < 3) warnings.push('منطقة المفصل قصيرة: زد نصف قطر الانحناء أو قلّل المسافة بين الصفوف.')
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
          post: loops => { if (pull > 0 && W > 2 * pull + 4) edgeNotch(loops, W / 2, 0, pull) },
          note: 'الطرف العلوي هو مقدّمة الغطاء، والسفلي قاعدة الخلفية',
        },
      ]
      const notes = [
        `المفصل المرن: ${rows} صفوف من القصّات بطول ${Lh.toFixed(1)} مم ينثني 90° حول الظهر.`,
        'الغطاء يستقرّ فوق حوافّ الجانبين والواجهة؛ الارتفاع الكلّي = الارتفاع + السماكة.',
        'جرّب المفصل على قطعة صغيرة أولاً: خشب الـ MDF ينكسر أسرع من الأبلكاش.',
      ]
      return { panels, notes, warnings }
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H, margin, fit } = p, t = c.t
      const Nn = Math.round(p.N), Mm = Math.round(p.M)
      const sw = t + fit, hd = H - t
      if (margin >= hd - 2) warnings.push('هامش الشقّ كبير بالنسبة للارتفاع.')
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
      return { panels, notes, warnings }
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
      const warnings: string[] = []
      checkBasics(p, c, warnings)
      const { W, D, H, hl, hh, hm } = p, t = c.t
      if (hm + hh > H - t - 4) warnings.push('المقبض لا يتّسع في ارتفاع الجانب.')
      if (hl > D - 4 * t) warnings.push('المقبض أطول من اللازم بالنسبة للعمق.')
      const box = openBox(W, D, H)
      const side = box.find(x => x.id === 'side')!
      side.holes = [stadium(D / 2, hm + hh / 2, hl, hh)]
      return { panels: box, notes: ['فتحتا المقبض في الجانبين (لوحا العمق).'], warnings }
    },
  },
]

export const templateById = (id: string) => TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
