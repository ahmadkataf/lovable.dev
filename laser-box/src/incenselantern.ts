// A stepped pyramid incense box (بوكس مبخرة هرمي بدرجات), as delivered to the customer (lantern.py): clear acrylic only,
// no text and no decoration. A square base; four trapezoid sides leaning in (a truncated pyramid); on top a stepped
// top of square steps, each of one or more sheets, with a round hole through every sheet for the incense burner.
//
// Two opposite sides (front and back) are full width; the other two stand between them, narrower so their slanted
// edges sit on the wide sides' inside faces with a small clearance. Two hidden locating pieces make it go together
// square: a plate glued on the base inside the sides' foot, and a ring glued under the bottom step that drops inside
// the sides' top. A gluing aid disc, a little smaller than the hole, lines the holes up while the steps are glued.
//
// Sizes are outside sizes. The base is W square; the sides' outside faces rise from its edges to a square `top` wide at
// the height H (measured upright), so a side is HS = √(H² + d²) long on its face, d = (W − top) / 2. A sheet t thick
// takes t · HS / H measured level, so the wide sides' inside faces lie y_in(z) = (d·z + t·HS) / H in from the base's
// edge at the height z. The narrow sides are 2 t·HS/H + 2 clearances narrower than the wide ones at the foot and at the
// top, both HS long. The locating plate keeps the clearance off the inside faces at its top (z = t), the ring at the
// sides' top (z = H). The bottom step reaches `ov` past the sides' top on every side, each step `inset` in from the one
// under it. Every outside corner is rounded 0.8 mm (lantern.py opens each piece by 0.8 mm); inside corners stay sharp.
import type { Template, ParamDef, BuildResult, Common } from './templates'
import { Loop, Pt, Vtx, polyLoop, circle, disc, rotatedRectHole } from './geom'
import type { PanelSpec } from './joints'

const mm = (key: string, label: string, min: number, max: number, step: number, hint?: string): ParamDef => ({ key, label, min, max, step, unit: 'مم', ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const f2 = (v: number) => (Math.round(v * 100) / 100).toString()

/** The design's fixed sizes (mm), as in the box delivered to the customer. */
export const LANTERN = {
  /** the locating ring under the top: its width */
  ring: 8,
  /** the ring narrows to make room for a big hole, down to this */
  ringMin: 4,
  /** and keeps this far off the hole's edge */
  ringClear: 1,
  /** acrylic kept round the hole on the top step, each side */
  web: 8,
  /** the gluing aid disc is this much smaller across than the hole */
  discLess: 0.4,
  /** every outside corner is rounded this much */
  ease: 0.8,
  /** the most the sides may lean in (degrees): steeper, the box is too low for the difference between base and top */
  leanMax: 45,
}

/** "n steps" / "n sheets" with the Arabic number agreement (one, two, 3 to 10 plural) */
const steps = (n: number) => (n === 1 ? 'درجة واحدة' : n === 2 ? 'درجتان' : `${n} درجات`)
export const sheets = (n: number) => (n === 1 ? 'طبقة واحدة' : n === 2 ? 'طبقتان' : `${n} طبقات`)

const PARAMS: ParamDef[] = [
  mm('W', 'عرض القاعدة', 60, 600, 0.5, 'القاعدة مربّعة، من الخارج؛ الجوانب تقف على حافّتها'),
  mm('top', 'عرض الجوانب من فوق', 30, 600, 0.5, 'من الخارج؛ أصغر من القاعدة فتميل الجوانب للداخل'),
  mm('H', 'ارتفاع الجوانب', 30, 600, 0.5, 'عمودياً من سطح القاعدة إلى راس الجوانب، تحت الدرجات'),
  { key: 'steps', label: 'عدد درجات الراس', min: 1, max: 8, step: 1, int: true, hint: 'درجات مربّعة، الكبيرة تحت' },
  mm('ov', 'بروز الدرجة السفلى', 0, 30, 0.5, 'عن راس الجوانب من كل جهة'),
  mm('inset', 'تدرّج الدرجات', 1, 20, 0.5, 'كل درجة أصغر من التي تحتها بهذا من كل جهة'),
  { key: 'per', label: 'طبقات كل درجة', min: 1, max: 4, step: 1, int: true, hint: 'كما في الصورة: طبقتان 2 مم، فحافّة كل درجة 4 مم' },
  mm('hole', 'قطر فتحة المبخرة', 20, 150, 0.5, 'فتحة دائرية في كل طبقات الراس، في الوسط'),
  mm('clr', 'خلوص الجانبين الضيّقين', 0, 1, 0.05, 'بين حدّيهما المائلين والوجه الداخلي للجانبين العريضين'),
  mm('loc', 'خلوص صفيحتي التثبيت', 0, 1, 0.05, 'بين صفيحة القاعدة وحلقة الراس والوجه الداخلي للجوانب'),
]
const DEFAULTS = { W: 150, top: 105, H: 165, steps: 4, ov: 6, inset: 5, per: 2, hole: 60, clr: 0.1, loc: 0.2 }

/** Every size of the design, from its parameters (outside sizes) and the sheet's thickness t. */
export function lanternGeom(p: Record<string, number>, t: number) {
  const C = LANTERN
  const { W, top, H, ov, inset, hole, clr, loc } = p
  const N = Math.max(1, Math.round(p.steps)), per = Math.max(1, Math.round(p.per))
  const d = (W - top) / 2, HS = Math.hypot(H, d), k = HS / H
  /** the wide sides' inside faces at the height z above the base's top, in from the base's edge */
  const yIn = (z: number) => (d * z + t * HS) / H
  const narrowLess = 2 * t * k + 2 * clr
  const ringOut = W - 2 * yIn(H) - 2 * loc
  return {
    W, top, H, t, d, HS, k, lean: Math.atan2(d, H), leanDeg: (Math.atan2(d, H) * 180) / Math.PI, yIn,
    /** the wide sides (front and back): full width at the foot, `top` at the top, HS on the face */
    wide: { bot: W, top, h: HS },
    /** the narrow sides (left and right), between the wide ones */
    narrow: { bot: W - narrowLess, top: top - narrowLess, h: HS },
    narrowLess,
    /** the locating plate on the base, square */
    plate: W - 2 * yIn(t) - 2 * loc,
    /** the locating ring under the top: its outside size, and its width (narrowed for a big hole) */
    ringOut, ringW: Math.min(C.ring, (ringOut - hole) / 2 - C.ringClear),
    /** the steps' sizes, bottom to top; each `per` sheets */
    steps: Array.from({ length: N }, (_, i) => top + 2 * ov - 2 * inset * i), N, per, hole,
    disc: hole - C.discLess,
    /** from the floor to the top of the top step */
    total: t + H + N * per * t,
  }
}
export type LanternGeom = ReturnType<typeof lanternGeom>

/** A convex polygon (clockwise on screen) with every corner rounded r: an arc tangent to both edges, whatever the angle. */
function easedPolygon(cs: Pt[], r: number): Vtx[] {
  const n = cs.length, out: Vtx[] = []
  cs.forEach((v, i) => {
    const a = cs[(i + n - 1) % n], b = cs[(i + 1) % n]
    const l1 = Math.hypot(v.x - a.x, v.y - a.y), l2 = Math.hypot(b.x - v.x, b.y - v.y)
    const u1 = { x: (v.x - a.x) / l1, y: (v.y - a.y) / l1 }, u2 = { x: (b.x - v.x) / l2, y: (b.y - v.y) / l2 }
    const turn = Math.atan2(Math.abs(u1.x * u2.y - u1.y * u2.x), u1.x * u2.x + u1.y * u2.y), take = r * Math.tan(turn / 2)
    // a convex corner of an outline drawn clockwise on screen: the arc bows to the left of travel (a negative bulge)
    out.push({ x: v.x - u1.x * take, y: v.y - u1.y * take, b: -Math.tan(turn / 4) }, { x: v.x + u2.x * take, y: v.y + u2.y * take })
  })
  return out
}

/** A trapezoid `bot` wide at the bottom and `top` at the top, h tall, its corners eased. */
const trapezoid = (bot: number, top: number, h: number): Loop => {
  const ins = (bot - top) / 2
  return polyLoop(easedPolygon([{ x: ins, y: 0 }, { x: bot - ins, y: 0 }, { x: bot, y: h }, { x: 0, y: h }], LANTERN.ease), 'outer')
}
/** A square s wide, its corners eased. */
const square = (s: number): Loop => polyLoop(easedPolygon([{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }], LANTERN.ease), 'outer')

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, C = LANTERN
  const pos = ['W', 'top', 'H', 'hole', 'inset', 'steps', 'per'], nonNeg = ['ov', 'clr', 'loc']
  if (!pos.every(k => Number.isFinite(p[k]) && p[k] > 0) || !nonNeg.every(k => Number.isFinite(p[k]) && p[k] >= 0)) return { panels: [], notes: [], warnings, errors: ['كل القياسات يجب أن تكون أكبر من الصفر.'] }
  const g = lanternGeom(p, t)
  const { W, top, H, N, per, hole } = g

  // -------------------------------------------------------------- what cannot be made
  if (top > W) errors.push(`عرض الجوانب من فوق (${f1(top)} مم) أكبر من القاعدة (${f1(W)} مم): الجوانب تميل للداخل، فاجعله أصغر من القاعدة.`)
  else if (g.leanDeg > C.leanMax + 1e-9) errors.push(`الجوانب تميل ${f1(g.leanDeg)}°، أكثر من ${C.leanMax}°: البوكس واطئ على الفرق بين القاعدة وراس الجوانب. ارفع الجوانب إلى ${Math.ceil(g.d / Math.tan((C.leanMax * Math.PI) / 180) - 1e-9)} مم على الأقل، أو قرّب عرضها من فوق من عرض القاعدة.`)
  // the top step keeps C.web of acrylic round the hole
  const sTop = g.steps[N - 1], holeMax = Math.floor(sTop - 2 * C.web + 1e-9)
  if (sTop < hole + 2 * C.web - 1e-9) {
    errors.push(holeMax >= 20
      ? `الدرجة العليا (${f1(sTop)} مم) صغيرة على فتحة ${f1(hole)} مم: يلزم حول الفتحة ${C.web} مم من الأكريليك من كل جهة، فأصغر درجة ${f1(hole + 2 * C.web)} مم. صغّر الفتحة إلى ${holeMax} مم، أو قلّل عدد الدرجات أو تدرّجها.`
      : `${steps(N)} بتدرّج ${f1(p.inset)} مم لا تتّسع فوق جوانب عرضها من فوق ${f1(top)} مم: الدرجة العليا ${f1(sTop)} مم، ويلزم ${f1(hole + 2 * C.web)} مم لفتحة ${f1(hole)} مم. قلّل عدد الدرجات أو تدرّجها، أو زد بروز الدرجة السفلى.`)
  }
  // the ring between the sides' top and the hole
  if (top <= W && g.ringW < C.ringMin - 1e-9) {
    const ringHoleMax = Math.floor(g.ringOut - 2 * (C.ringMin + C.ringClear) + 1e-9)
    errors.push(`حلقة التثبيت لا تتّسع بين راس الجوانب والفتحة: يبقى لها ${f1(Math.max(0, g.ringW))} مم، ويلزم ${C.ringMin} مم على الأقل. ${ringHoleMax >= 20 ? `صغّر الفتحة إلى ${ringHoleMax} مم، أو كبّر` : 'كبّر'} عرض الجوانب من فوق.`)
  }
  if (errors.length) return { panels: [], notes: [], warnings, errors, slotted: false }
  if (t < 1.5) warnings.push(`أكريليك ${t} مم رقيق على هذا البوكس: جوانبه تنثني وتنكسر. صُمّم على أكريليك شفّاف 2 مم.`)
  if (t > 3) warnings.push(`أكريليك ${t} مم سميك على هذا البوكس: صُمّم على أكريليك شفّاف 2 مم، وعلى ${t} مم يثقل وتطلع حافّة كل درجة ${f1(per * t)} مم.`)

  // -------------------------------------------------------------- the pieces
  const { wide, narrow, plate, ringOut, ringW } = g
  const stepPanels: PanelSpec[] = g.steps.map((s, i) => ({
    id: `step${i + 1}`, name: `طبقة الراس ${i + 1}`, w: s, h: s, count: per, shape: [square(s)], holes: [circle(s / 2, s / 2, hole / 2)],
    note: `${N === 1 ? 'الدرجة' : i === 0 ? 'الدرجة السفلى' : i === N - 1 ? 'الدرجة العليا' : `الدرجة ${i + 1}`}: ${sheets(per)} ${f1(s)} × ${f1(s)} مم`,
  }))
  const panels: PanelSpec[] = [
    { id: 'wide', name: 'جانب عريض (أمامي وخلفي)', w: wide.bot, h: wide.h, count: 2, shape: [trapezoid(wide.bot, wide.top, wide.h)], note: 'بعرض القاعدة كاملاً' },
    { id: 'narrow', name: 'جانب ضيّق (أيمن وأيسر)', w: narrow.bot, h: narrow.h, count: 2, shape: [trapezoid(narrow.bot, narrow.top, narrow.h)], note: 'يدخل بين الجانبين العريضين' },
    { id: 'base', name: 'القاعدة', w: W, h: W, shape: [square(W)] },
    { id: 'plate', name: 'صفيحة تثبيت القاعدة', w: plate, h: plate, shape: [square(plate)], note: 'تُلصق في وسط القاعدة، والجوانب تقف حولها' },
    ...stepPanels,
    { id: 'ring', name: 'حلقة تثبيت الراس', w: ringOut, h: ringOut, shape: [square(ringOut)], holes: [rotatedRectHole(ringOut / 2, ringOut / 2, ringOut - 2 * ringW, ringOut - 2 * ringW, 0)], note: 'تُلصق تحت الدرجة السفلى في وسطها' },
    { id: 'disc', name: 'قرص مساعد للتلزيق', w: g.disc, h: g.disc, shape: [disc(g.disc / 2, g.disc / 2, g.disc / 2)], note: 'يصفّ فتحات الطبقات وقت اللصق، ثم يُخرج' },
  ]

  // -------------------------------------------------------------- notes
  const notes = [
    `بوكس مبخرة من أكريليك شفّاف ${t} مم فقط، بلا كتابة ولا زخرفة: قاعدة ${f1(W)} × ${f1(W)} مم، وأربعة جوانب شبه منحرفة تميل للداخل ${f1(g.leanDeg)}° (هرم مقطوع) ارتفاعها ${f1(H)} مم وعرضها من فوق ${f1(top)} مم، وفوقها راس من ${steps(N)} مربّعة (${g.steps.map(f1).join('، ')} مم)، كل درجة ${sheets(per)}، وفي كل طبقة فتحة ${f1(hole)} مم في الوسط للمبخرة. الدرجة السفلى تبرز ${f1(p.ov)} مم عن راس الجوانب من كل جهة. الارتفاع الكلّي ${f1(g.total)} مم.`,
    `الجانبان العريضان (الأمامي والخلفي) بعرض القاعدة كاملاً، والجانبان الضيّقان (الأيمن والأيسر) يدخلان بينهما: أضيق بـ ${f2(g.narrowLess)} مم، فيستند حدّاهما المائلان على الوجه الداخلي للعريضين بخلوص ${f2(p.clr)} مم من كل جهة.`,
    `صفيحة التثبيت (${f1(plate)} × ${f1(plate)} مم) تُلصق في وسط القاعدة، والجوانب تقف حولها فيخرج البوكس مربّعاً. حلقة التثبيت (${f1(ringOut)} مم من الخارج، عرضها ${f1(ringW)} مم) تُلصق تحت الدرجة السفلى في وسطها، فتدخل في راس الجوانب ولا يزحط الراس.`,
    'التركيب بغراء الأكريليك السائل (cement): 1) الصق صفيحة التثبيت في وسط القاعدة. 2) أوقف الجانبين العريضين على القاعدة لاصقين بالصفيحة، ثم الضيّقين بينهما، والصق الزوايا من الداخل. 3) الراس: رصّ الطبقات من الكبيرة إلى الصغيرة والصقها، والقرص المساعد في فتحاتها لتأتي على بعضها في الوسط، ثم أخرج القرص. 4) الصق حلقة التثبيت تحت الدرجة السفلى في وسطها، وضع الراس على الجوانب: الصقه، أو اتركه بلا لصق ليُرفع.',
    'تنبيه: الأكريليك يلين على حرارة 80–100°م. لا تضع فحماً داخل البوكس أبداً. استعمل مبخرة كهربائية أو مبخرة للزينة، وأبعد الجزء الساخن منها عن الأكريليك.',
    ...(t >= 2.5 && t <= 3 && per > 1 ? [`صُمّم على أكريليك 2 مم، فحافّة كل درجة 4 مم كما في الصورة؛ على ${t} مم تطلع ${f1(per * t)} مم، فاجعل «طبقات كل درجة» 1 إن أردتها أنحف.`] : []),
  ]
  return { panels, notes, warnings, errors, slotted: false }
}

export const INCENSE_LANTERNS: Template[] = [
  {
    id: 'incenselantern',
    name: 'بوكس مبخرة هرمي بدرجات',
    desc: 'بوكس مبخرة من أكريليك شفّاف فقط، بلا كتابة ولا زخرفة: قاعدة مربّعة وأربعة جوانب شبه منحرفة تميل للداخل (هرم مقطوع)، جانبان عريضان والآخران بينهما، وفوقها راس مدرّج من درجات مربّعة في كل طبقاته فتحة دائرية للمبخرة. صفيحة تثبيت على القاعدة وحلقة تحت الراس تجعلانه يُركّب مربّعاً، وقرص مساعد يصفّ الفتحات وقت اللصق.',
    icon: `<path d="M7 54h50v4H7z"/><path d="M9 54 17 27h30l8 27"/><path d="M13 27v-4h38v4M17 23v-4h30v4M21 19v-4h22v4M25 15v-4h14v4" stroke-width="1.6"/><path d="M28 11v16M36 11v16" stroke-width="1" stroke-dasharray="2 2"/><path d="M32 8c-2-2 2-3 0-6" stroke-width="1.4"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]
