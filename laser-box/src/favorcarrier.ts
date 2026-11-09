// A clear acrylic favours carrier (علبة توزيعات بسقف مائل ومقبض), as in the customer's picture and as delivered to
// the customer (favorbox.py): a base reaching 5 mm past the walls with slots for every bottom tab, two trapezoid sides
// (mirror images of each other), a back wall and a low front lip standing between the sides 5 mm inside their back and
// front edges, and a top sloping down to the front with a stadium hand slot in its middle and a stiffening plate glued
// under it. The front is open between the lip and the top for taking the favours. Tab-and-slot joints glued with
// acrylic cement; the baby's name in gold mirror acrylic is added in RDWorks (the app cannot shape Arabic text).
//
// Box coordinates: x along the length (0 at the left side's outer face), y the depth from the front (0) to the back
// (D), z up from the base's top. The sides stand on the base and are H tall at the back and Hf at the front; the top
// lies on their sloping edges, so its underside is the plane z = Hf + k·y. A point on the slope is (u, v): u along it
// from the sides' front top corner, v square to it, outward (y = u·cos a − v·sin a, z = Hf + u·sin a + v·cos a).
//
// Every size of a joint is the one in favorbox.py at the default box; on a smaller box the tabs narrow with it.
import type { Template, ParamDef, BuildResult, Common } from './templates'
import { Loop, Rect, rect, unionRects, stadium, polyLoop, roundCorner, round3 } from './geom'
import type { PanelSpec } from './joints'

type YZ = { y: number; z: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

/** The design's fixed sizes (mm), as in the box delivered to the customer. */
export const CARRIER = {
  /** the back wall and the front lip stand this far inside the sides' back and front edges */
  inset: 5,
  /** the base reaches this far beyond the walls */
  overhang: 5,
  /** the base's corners */
  baseR: 4,
  /** the top's and the plate's corners (and the mouths of the top's slots) are eased this much */
  ease: 1,
  /** the hand slot's width, up the slope */
  handW: 24,
  /** the stiffening plate under the top, up the slope; it stops short of the back wall on a shallow box */
  plate: 70,
  /** the plate's clearance to each side's inner face */
  plateGap: 0.1,
  /** the least front opening between the lip and the top: a hand reaches in for a favour */
  openMin: 40,
  /** the least depth left for the favours between the lip and the back wall */
  innerMin: 50,
  /** the least lip: its end tabs keep 4 mm of acrylic above and below their slots in the sides */
  lipMin: 14,
  /** the back wall's flat top stays this far under the top's underside at its front face (the cement bridges it) */
  backGap: 0.1,
  /** where the sides' three top tabs sit along the slope, as fractions of its length from the front */
  topTabs: [0.18, 0.5, 0.82],
  /** the sides' two bottom tabs, as fractions of the depth */
  baseTabs: [0.25, 0.75],
  /** the back wall's three and the lip's two bottom tabs, as fractions of the inner length */
  backTabs: [0.2, 0.5, 0.8],
  lipTabs: [0.25, 0.75],
}

const PARAMS: ParamDef[] = [
  mm('W', 'الطول', 120, 800, 'من الخارج، بين وجهي الجانبين'),
  mm('D', 'العمق', 80, 500, 'من الأمام إلى الخلف (القاعدة أعمق بـ 10 مم)'),
  mm('H', 'الارتفاع من الخلف', 50, 500, 'ارتفاع الجانبين عند الظهر، من سطح القاعدة إلى تحت السقف'),
  mm('Hf', 'الارتفاع من الأمام', 30, 500, 'ارتفاع الجانبين عند الواجهة، حيث تبدأ حافّة السقف المائل'),
  mm('lip', 'ارتفاع الحافّة الأمامية', 10, 200, 'الواجهة مفتوحة بين الحافّة والسقف لأخذ التوزيعات (40 مم على الأقل)'),
  mm('hand', 'طول فتحة الإيد', 70, 200, 'فتحة مستديرة الطرفين عرضها 24 مم في وسط السقف؛ 100–120 مم لأربع أصابع'),
  { ...mm('fit', 'خلوص الشقوق', 0, 0.5, 'يُضاف لعرض كل شقّ وطوله'), step: 0.05 },
]
const DEFAULTS = { W: 320, D: 180, H: 165, Hf: 105, lip: 35, hand: 110, fit: 0.1 }

/** Every size and place of the design, from its parameters and the sheet's thickness t. */
export function carrierGeom(p: Record<string, number>, t: number) {
  const C = CARRIER, M = C.inset
  const { W, D, H, Hf, lip, hand, fit } = p
  const rise = H - Hf, LS = Math.hypot(D, rise), cs = D / LS, sn = rise / LS, k = rise / D
  const deg = (Math.atan2(rise, D) * 180) / Math.PI
  const Win = W - 2 * t
  /** the top's underside over the depth y */
  const zu = (y: number) => Hf + k * y
  /** a point (u along the slope from the front top corner, v square to it, outward) */
  const at = (u: number, v: number): YZ => ({ y: u * cs - v * sn, z: Hf + u * sn + v * cs })
  // the back wall: a flat top 0.1 mm under the top's underside at its front face, where the underside is lowest
  const backH = Math.round((zu(D - M - t) - C.backGap) * 100) / 100
  // tab widths: the delivered box's on the default box, narrower on a small one
  const twBase = Math.min(30, D / 5), twTop = Math.min(20, LS / 8), twBack = Math.min(20, backH / 6)
  const twLip = Math.max(2, Math.min(20, lip - 8)), twWall = Math.max(1, Math.min(40, Win / 7))
  const topU = C.topTabs.map(f => f * LS)
  const baseY = C.baseTabs.map(f => f * D)
  const backZ = [0.3 * backH, 0.7 * backH], lipZ = lip / 2
  // along the back wall and the lip, from the sides' inner faces
  const backX = C.backTabs.map(f => f * Win), lipX = C.lipTabs.map(f => f * Win)
  // the hand slot in the middle of the top: the full box hangs level from it
  const hu = LS / 2
  // the plate under the top, centred on the hand slot: its lower back corner 1 mm clear of the back wall's front face
  const h2 = Math.min(C.plate / 2, hu, (D - M - t - 1 - t * sn) / cs - hu)
  const plateW = Win - 2 * C.plateGap
  return { W, D, H, Hf, lip, hand, fit, t, M, OV: C.overhang, rise, LS, cs, sn, k, deg, Win, zu, at, backH, twBase, twTop, twBack, twLip, twWall, topU, baseY, backZ, lipZ, backX, lipX, hu, h2, plateW, open: Hf - lip, inner: D - 2 * M - 2 * t, Lb: W + 2 * C.overhang, Db: D + 2 * C.overhang }
}
export type CarrierGeom = ReturnType<typeof carrierGeom>

/** A rectangular hole from x0..x1 × y0..y1. */
const rectHole = (x0: number, y0: number, x1: number, y1: number): Loop => polyLoop([{ x: round3(x0), y: round3(y0) }, { x: round3(x1), y: round3(y0) }, { x: round3(x1), y: round3(y1) }, { x: round3(x0), y: round3(y1) }], 'hole')
/** A slot of w × h (each plus the clearance) centred at (cx, cy). */
const slot = (cx: number, cy: number, w: number, h: number, fit: number) => rectHole(cx - (w + fit) / 2, cy - (h + fit) / 2, cx + (w + fit) / 2, cy + (h + fit) / 2)

/** Round every convex corner of the outlines by r (straight edges only): what easing a cut piece's corners does. */
function easeConvex(loops: Loop[], r: number) {
  for (const l of loops) {
    const n = l.pts.length
    const corners = l.pts.filter((v, i) => { const a = l.pts[(i + n - 1) % n], c = l.pts[(i + 1) % n]; return (v.x - a.x) * (c.y - v.y) - (v.y - a.y) * (c.x - v.x) > 1e-9 }).map(v => ({ x: v.x, y: v.y }))
    for (const v of corners) roundCorner([l], v.x, v.y, r)
  }
}

/** A side's outline in box coordinates (y, z): the trapezoid with two tabs into the base and three into the top. */
function sideOutline(g: CarrierGeom): YZ[] {
  const { D, H, Hf, t } = g
  const pts: YZ[] = [{ y: 0, z: 0 }]
  for (const yc of g.baseY) pts.push({ y: yc - g.twBase / 2, z: 0 }, { y: yc - g.twBase / 2, z: -t }, { y: yc + g.twBase / 2, z: -t }, { y: yc + g.twBase / 2, z: 0 })
  pts.push({ y: D, z: 0 }, { y: D, z: H })
  // down the slope from the back: each tab rises t square to it, flush with the top's upper face
  const a = g.twTop / 2
  for (const u of [...g.topU].reverse()) pts.push(g.at(u + a, 0), g.at(u + a, t), g.at(u - a, t), g.at(u - a, 0))
  pts.push({ y: 0, z: Hf })
  return pts
}

/** The slots in a side, in box coordinates: two for the back wall's end tabs, one for the lip's. */
function sideSlots(g: CarrierGeom): [YZ, YZ][] {
  const { D, M, t, fit } = g
  const box = (yc: number, zc: number, h: number): [YZ, YZ] => [{ y: yc - (t + fit) / 2, z: zc - (h + fit) / 2 }, { y: yc + (t + fit) / 2, z: zc + (h + fit) / 2 }]
  return [...g.backZ.map(z => box(D - M - t / 2, z, g.twBack)), box(M + t / 2, g.lipZ, g.twLip)]
}

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, C = CARRIER
  const vals = ['W', 'D', 'H', 'Hf', 'lip', 'hand'].map(k => p[k])
  if (!vals.every(v => Number.isFinite(v) && v > 0) || !(Number.isFinite(p.fit) && p.fit >= 0)) return { panels: [], notes: [], warnings, errors: ['كل القياسات يجب أن تكون أكبر من الصفر.'] }
  const g = carrierGeom(p, t)
  const { W, D, H, Hf, lip, hand, fit, M, OV, Win, backH } = g

  // -------------------------------------------------------------- what cannot be made
  if (H <= Hf) errors.push(`السقف لا ينحدر نحو الواجهة: الارتفاع من الخلف (${f1(H)} مم) يجب أن يزيد على الارتفاع من الأمام (${f1(Hf)} مم).`)
  if (lip < C.lipMin) errors.push(`الحافّة الأمامية (${f1(lip)} مم) واطئة على لسانيها في الجانبين: ${C.lipMin} مم على الأقل.`)
  if (g.open < C.openMin) errors.push(`الواجهة المفتوحة بين الحافّة الأمامية والسقف ${f1(g.open)} مم فقط؛ تحتاج ${C.openMin} مم على الأقل لتدخل اليد وتأخذ التوزيعات: اخفض الحافّة أو ارفع الارتفاع من الأمام.`)
  if (g.inner < C.innerMin) errors.push(`العمق (${f1(D)} مم) صغير: يبقى للتوزيعات بين الحافّة والظهر ${f1(g.inner)} مم؛ اجعله ${Math.ceil(C.innerMin + 2 * M + 2 * t)} مم على الأقل.`)
  const handMax = Math.floor(Win - 20)
  if (hand > handMax) errors.push(handMax >= 70 ? `فتحة الإيد (${f1(hand)} مم) أطول مما يتّسع له السقف بين الجانبين: أقصاها ${handMax} مم بهذا الطول، أو زد الطول.` : `الطول (${f1(W)} مم) لا يتّسع لفتحة الإيد (${f1(hand)} مم) بين الجانبين: اجعله ${Math.ceil(hand + 20 + 2 * t)} مم على الأقل.`)
  const plateOk = g.h2 >= C.handW / 2 + 8
  if (!plateOk) errors.push('لا يتّسع السقف لقطعة التقوية حول فتحة الإيد قبل أن تصل إلى الظهر: زد العمق.')
  if (t < 2.5) warnings.push(`أكريليك ${t} مم رقيق لعلبة تُحمل من فتحة في سقفها؛ استعمل 3 مم أو أسمك.`)

  // -------------------------------------------------------------- the sides (mirror images)
  const outline = sideOutline(g)
  const yMin = Math.min(0, ...outline.map(q => q.y)), zMax = Math.max(...outline.map(q => q.z))
  // as seen from outside: the right side has the front on the left of the drawing, the left side on the right
  const sidePanel = (id: string, name: string, mirror: boolean): PanelSpec => {
    const map = (q: YZ) => ({ x: round3(mirror ? D - q.y : q.y - yMin), y: round3(zMax - q.z) })
    return {
      id, name, w: round3(D - yMin), h: round3(zMax + t),
      shape: [polyLoop(outline.map(map), 'outer')],
      holes: sideSlots(g).map(([a, b]) => { const A = map(a), B = map(b); return rectHole(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.max(A.x, B.x), Math.max(A.y, B.y)) }),
      note: `${mirror ? 'صورة مرآة للجانب الأيمن' : 'الواجهة على اليسار كما يُرى من الخارج'}: لسانان في القاعدة وثلاثة في السقف، وشقوق الظهر والحافّة`,
    }
  }

  // -------------------------------------------------------------- the back wall and the lip, between the sides
  const wall = (h: number, endZ: number[], endTw: number, botX: number[]): Loop[] => unionRects([
    rect(t, 0, Win, h),
    ...endZ.flatMap(z => [rect(0, h - z - endTw / 2, t, endTw), rect(t + Win, h - z - endTw / 2, t, endTw)]),
    ...botX.map(x => rect(t + x - g.twWall / 2, h, g.twWall, t)),
  ], [])

  // -------------------------------------------------------------- the top: slots open at its ends for the sides' tabs
  const LS = round3(g.LS)
  const notches: Rect[] = g.topU.flatMap(u => [rect(0, u - (g.twTop + fit) / 2, t + fit / 2, g.twTop + fit), rect(W - t - fit / 2, u - (g.twTop + fit) / 2, t + fit / 2, g.twTop + fit)])
  const top = unionRects([rect(0, 0, W, LS)], notches)
  easeConvex(top, C.ease)
  const handFits = hand <= handMax && g.hu >= C.handW / 2 + 8
  const pw = round3(g.plateW), ph = round3(2 * g.h2)
  const plate = pw > 0 && ph > 0 ? unionRects([rect(0, 0, pw, ph)], []) : []
  easeConvex(plate, C.ease)

  // -------------------------------------------------------------- the base: a slot under every bottom tab
  const { Lb, Db } = g
  const base = unionRects([rect(0, 0, Lb, Db)], [])
  easeConvex(base, C.baseR)
  const baseSlots: Loop[] = [
    ...g.baseY.flatMap(y => [slot(OV + t / 2, OV + y, t, g.twBase, fit), slot(OV + W - t / 2, OV + y, t, g.twBase, fit)]),
    ...g.backX.map(x => slot(OV + t + x, OV + D - M - t / 2, g.twWall, t, fit)),
    ...g.lipX.map(x => slot(OV + t + x, OV + M + t / 2, g.twWall, t, fit)),
  ]

  const panels: PanelSpec[] = [
    { id: 'base', name: 'القاعدة', w: Lb, h: Db, shape: base, holes: baseSlots, note: `تبرز ${OV} مم عن الجدران من كل جهة؛ الشقوق لألسنة الجانبين والظهر والحافّة` },
    sidePanel('sideR', 'الجانب الأيمن', false),
    sidePanel('sideL', 'الجانب الأيسر', true),
    { id: 'back', name: 'الظهر', w: W, h: round3(backH + t), shape: wall(backH, g.backZ, g.twBack, g.backX), note: `بين الجانبين على بُعد ${M} مم من حافّتهما الخلفية؛ قمّته تحت السقف` },
    { id: 'lip', name: 'الحافّة الأمامية', w: W, h: round3(lip + t), shape: wall(lip, [g.lipZ], g.twLip, g.lipX), note: `بين الجانبين على بُعد ${M} مم من حافّتهما الأمامية؛ فوقها الواجهة المفتوحة` },
    { id: 'top', name: 'السقف المائل مع فتحة الإيد', w: W, h: LS, shape: top, holes: handFits ? [stadium(W / 2, LS / 2, hand, C.handW)] : [], note: 'شقوق طرفيه لألسنة الجانبين، وفتحة الإيد في وسطه' },
  ]
  if (plate.length) panels.push({ id: 'plate', name: 'تقوية تحت فتحة الإيد', w: pw, h: ph, shape: plate, holes: handFits && plateOk ? [stadium(pw / 2, ph / 2, hand, C.handW)] : [], note: 'تُلصق تحت السقف بين الجانبين، وفتحتها فوق فتحة السقف تماماً' })

  // -------------------------------------------------------------- the assembly seen from the side (x forward, y up)
  const fwd = (ps: YZ[]) => ps.map(q => ({ x: round3(D - q.y), y: round3(q.z) }))
  const yz = (y0: number, z0: number, y1: number, z1: number): YZ[] => [{ y: y0, z: z0 }, { y: y1, z: z0 }, { y: y1, z: z1 }, { y: y0, z: z1 }]
  const sideView = {
    outline: fwd([{ y: 0, z: 0 }, { y: D, z: 0 }, { y: D, z: H }, { y: 0, z: Hf }]),
    pieces: [
      { id: 'base', pts: fwd(yz(-OV, -t, D + OV, 0)) },
      { id: 'back', pts: fwd(yz(D - M - t, 0, D - M, backH)) },
      { id: 'lip', pts: fwd(yz(M, 0, M + t, lip)) },
      { id: 'top', pts: fwd([g.at(0, 0), g.at(g.LS, 0), g.at(g.LS, t), g.at(0, t)]) },
      { id: 'plate', pts: fwd([g.at(g.hu - g.h2, 0), g.at(g.hu + g.h2, 0), g.at(g.hu + g.h2, -t), g.at(g.hu - g.h2, -t)]) },
    ],
  }

  // -------------------------------------------------------------- notes
  const nameW = Math.round((D * 5) / 9), nameH = Math.round(Hf * 0.74)
  const notes = [
    `علبة توزيعات ${f1(W)} × ${f1(D)} مم، ارتفاعها ${f1(H)} مم من الخلف و${f1(Hf)} مم من الأمام (من سطح القاعدة إلى تحت السقف)، على قاعدة ${f1(Lb)} × ${f1(Db)} مم تبرز ${OV} مم من كل جهة. السقف مائل ${f1(g.deg)}° وطوله ${f1(g.LS)} مم، والواجهة مفتوحة ${f1(g.open)} مم بين الحافّة الأمامية (${f1(lip)} مم) والسقف لأخذ التوزيعات.`,
    `القطع كلّها من أكريليك شفّاف ${t} مم: القاعدة، جانبان على شكل شبه منحرف (كلّ منهما صورة مرآة للآخر، مرسومان كما يُريان من الخارج)، الظهر ${f1(Win)} × ${f1(backH)} مم والحافّة الأمامية ${f1(Win)} × ${f1(lip)} مم بين الجانبين على بُعد ${M} مم من حافّتيهما الخلفية والأمامية، السقف ${f1(W)} × ${f1(g.LS)} مم، وقطعة تقوية ${f1(pw)} × ${f1(ph)} مم تحته. الشقوق ${f1(t + fit)} مم عرضاً (السماكة وخلوص ${fit} مم).`,
    `قمّة الظهر أفقية وتحت السقف بـ ${C.backGap} مم عند وجهه الأمامي، فلا ترفع السقف عن الجانبين؛ الغراء يملأ الفراغ الصغير فوقها.`,
    'التجميع: أدخل ألسنة الظهر والحافّة في شقوق الجانبين، وأنزل الجدران الأربعة معاً في شقوق القاعدة، ثم ضع السقف فوقها فتدخل ألسنة الجانبين الثلاثة في الشقوق على طرفيه وتستوي مع سطحه. والقطع مركّبة ألصق كل وصلة بغراء الأكريليك السائل (cement) بإبرة من الداخل: يسري في الشقّ ويلحم القطعتين، فلا تمسحه.',
    `فتحة الإيد ${f1(hand)} × ${C.handW} مم في وسط السقف، فتتعلّق العلبة معتدلة وهي ممتلئة. قطعة التقوية بالفتحة نفسها تُلصق تحت السقف بين الجانبين (بخلوص ${C.plateGap} مم من كل جانب) وفتحتها فوق فتحة السقف تماماً، فتقوّي السقف حيث يُحمل. إن امتلأت العلبة كثيراً فاحملها من تحتها.`,
    `اسم المولود من أكريليك مرآة ذهبي يُضاف في RDWorks أو CorelDRAW، فالبرنامج لا يكتب العربية: اكتب الاسم بخطّ عربي (حتى نحو ${nameW} × ${nameH} مم على الجانب) واقصّه من المرآة الذهبية ووجهها العاكس للأعلى كي لا ينقلب، ثم ألصقه على أحد الجانبين من الخارج بلاصق شفّاف مزدوج الوجه، لا بغراء الأكريليك السائل الذي يُتلف المرآة.`,
    'ورق الحماية: اتركه أثناء القصّ وانزعه قبل اللصق. في RDWorks اقصّ الداخل أولاً (الشقوق وفتحة الإيد قبل المحيط).',
  ]
  return { panels, notes, warnings, errors, slotted: true, sideView }
}

export const FAVOR_CARRIERS: Template[] = [
  {
    id: 'favorcarrier',
    name: 'علبة توزيعات أكريليك بسقف مائل ومقبض',
    desc: 'علبة أكريليك شفّاف لتوزيعات المواليد والأعراس كما في الصورة: قاعدة تبرز 5 مم بشقوق، جانبان على شكل شبه منحرف، ظهر وحافّة أمامية واطئة بينهما، وسقف ينحدر نحو الأمام بفتحة يد للحمل وقطعة تقوية تحتها؛ الواجهة مفتوحة بين الحافّة والسقف لأخذ التوزيعات. ألسنة وشقوق تُلصق بغراء الأكريليك، واسم المولود من المرآة الذهبية يُضاف في RDWorks.',
    icon: `<path d="M6 53h52v4H6z"/><path d="M10 53V31l44-14v36z"/><path d="M25 26.4l14-4.4" stroke-width="4"/><path d="M10 45h9" stroke-width="1.3"/><path d="M36 43l-4-4a2.5 2.5 0 0 1 4-3 2.5 2.5 0 0 1 4 3z" stroke-width="1.3"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    // inner sizes: the length between the sides, the depth between the lip and the back wall; heights are inner already
    innerAdd: t => ({ W: 2 * t, D: 2 * (CARRIER.inset + t), H: 0 }),
    build,
  },
]
