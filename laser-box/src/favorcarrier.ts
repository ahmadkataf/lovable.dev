// A clear acrylic favours box shaped like a tent (علبة توزيعات أكريليك خيمة بفتحة إيد), as the customer described it
// and as delivered to the customer (favortent.py): ONE piece of acrylic heat-bent on a strip heater along four lines.
// The two long walls lean in from the base's edges and close on each other at the top, like a tent (a pyramid in
// section), each with the same stadium hand slot near its top edge and centred in the length, so the hand goes through
// both; the two ends are low vertical lips, open above, where the favours are taken out. The walls' top corners are
// rounded, the corners where two bends meet are relieved, and every other corner of the outline is rounded 1 mm
// (favortent.py closes and opens the outline by 1 mm). The lips are glued to the walls inside with acrylic cement, the
// seam at the top with gel cement under a decoration strip; the baby's name in gold is added in RDWorks (the app cannot
// shape Arabic text).
//
// The lean: the walls' outside faces rise from the base's outside edges, leaning in by b, and the inside corners of
// their top edges (cut square to the wall) meet the middle less half the top gap at the height H:
// H·tan b + t·cos b = D/2 − gap/2. A wall is then H / cos b long outside and its bend turns 90° + b; the lips' bends 90°.
//
// Flat lengths by the neutral-axis method: an inside bend radius ri and the neutral axis at mid-thickness, so a bend
// turning θ takes a band BA = θ·(ri + t/2) of the flat sheet and its outside setback is SB = (ri + t)·tan(θ/2). A wall
// S long outside is S − SB flat beyond its band, and the base is W − 2·SB(90°) by D − 2·SB(wall) between the bands. The
// bend lines (on the engraving layer) run along the middle of each band and 8 mm past the sheet.
//
// Sheet coordinates as favortent.py draws it: x right, y up, the base's flat part from (0, 0) to (xb, yb), the front
// wall below the base, the back wall above it and the lips left and right. A point x along the box lies at x − SB(90°);
// a point of a lip y from the box's front edge (outside) at y − SB(wall) across. The panel is the same drawing with y
// turned down the screen: X = x − xMin, Y = yMax − y.
import type { Template, ParamDef, BuildResult, Common } from './templates'
import { Loop, Vtx, stadium, polyLoop } from './geom'
import type { PanelSpec } from './joints'

type XY = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const deg = (rad: number) => (rad * 180) / Math.PI

/** The design's fixed sizes (mm), as in the box delivered to the customer. */
export const CARRIER = {
  /** the lips' clearance to the walls' inside faces, each side */
  clear: 0.2,
  /** the bend lines run this far past the sheet */
  overrun: 8,
  /** every corner of the outline but the walls' and lips' top corners: the inside ones and those at the corner reliefs */
  ease: 1,
  /** the lips' top corners are rounded this share of the walls' */
  lipShare: 0.5,
  /** the most the walls may lean in (degrees): steeper, the box is too low for its depth */
  leanMax: 45,
  /** the hand slots keep this far from the lips' inner faces */
  slotSide: 10,
  /** and their lowest point this far above the wall's bend band: the heater softens a band either side of the line */
  slotLow: 10,
  /** the least base between the bend bands, each way */
  baseMin: 20,
  /** the lips stand at least this far above their bend band */
  lipMin: 10,
  /** the least width of a lip at its top: room for its rounded corners */
  lipTopMin: 2,
  /** the test strip for the bend allowance: its width and each leg's flat length beyond the bend band */
  strip: { w: 40, leg: 60 },
  /** the angle gauge for the walls: a right triangle with this leg at the angle */
  gaugeLeg: 50,
}

const PARAMS: ParamDef[] = [
  mm('W', 'الطول', 100, 800, 'طول الجدارين المائلين، من الخارج'),
  mm('D', 'العمق من تحت', 60, 500, 'عرض القاعدة من الخارج، من حافّة الجدار الأمامي إلى الخلفي'),
  mm('H', 'الارتفاع', 60, 500, 'حيث يلتقي الجداران من فوق'),
  mm('He', 'ارتفاع الجانبين', 20, 300, 'حافّتان واطئتان مفتوحتان من فوق، منهما تُؤخذ التوزيعات'),
  mm('gap', 'الفراغ بين الجدارين من فوق', 0, 10, 'بين وجهيهما الداخليين حيث يلتقيان'),
  mm('hand', 'طول فتحة الإيد', 60, 200, 'الفتحة نفسها في الجدارين، في منتصف الطول'),
  mm('handH', 'ارتفاع فتحة الإيد', 15, 40, 'فتحة مستديرة الطرفين'),
  mm('handTop', 'بُعد الفتحة عن الحافّة العليا', 8, 60, 'على الجدار المائل'),
  mm('ri', 'نصف قطر الثني الداخلي', 0.5, 10, 'منه يُحسب طول الثني؛ صحّحه بشريحة التجربة'),
  mm('rc', 'تدوير زوايا الجدارين', 2, 30, 'زواياهما العليا، وزوايا الجانبين نصفه'),
]
const DEFAULTS = { W: 300, D: 150, H: 160, He: 45, gap: 1, hand: 95, handH: 24, handTop: 16, ri: 2, rc: 10 }

/** The walls' lean (radians): their inside top corners meet the middle less half the gap at the height H; 0 when the walls touch upright. */
export function tentLean(H: number, D: number, gap: number, t: number): number {
  const f = (b: number) => H * Math.tan(b) + t * Math.cos(b) - (D / 2 - gap / 2)
  if (!(f(0) < 0)) return 0
  let lo = 0, hi = 1.5
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid }
  return (lo + hi) / 2
}

/** Every size and place of the design, from its parameters (outside sizes) and the sheet's thickness t. */
export function carrierGeom(p: Record<string, number>, t: number) {
  const C = CARRIER
  const { W, D, H, He, gap, hand, handH, handTop, ri, rc } = p
  const lean = tentLean(H, D, gap, t), turnW = Math.PI / 2 + lean
  // the neutral-axis method: a bend turning θ takes a band θ·(ri + t/2) of the flat sheet; a leg measured outside is
  // (ri + t)·tan(θ/2) longer than its flat part beyond the band
  const BAof = (th: number) => th * (ri + t / 2), SBof = (th: number) => (ri + t) * Math.tan(th / 2)
  const BA = BAof(Math.PI / 2), SB = SBof(Math.PI / 2), BAw = BAof(turnW), SBw = SBof(turnW)
  const S = H / Math.cos(lean) // a wall's outside length, from the base's outside edge to its top edge
  const re = C.lipShare * rc
  // the base between the bands, a wall's and a lip's flat part beyond its band
  const xb = W - 2 * SB, yb = D - 2 * SBw, sw = S - SBw, he = He - SB
  /** the front wall's inside face at the height z, from the box's front edge (outside) */
  const yIn = (z: number) => z * Math.tan(lean) + t / Math.cos(lean)
  /** a lip across at the height z, between the walls' inside faces less the clearance, in sheet coordinates */
  const lipAt = (z: number) => ({ lo: yIn(z) + C.clear - SBw, hi: D - yIn(z) - C.clear - SBw })
  // the walls run the full length (box x 0..W)
  const fx0 = -SB, fx1 = W - SB
  const xMin = -BA - he, xMax = xb + BA + he, yMin = -BAw - sw, yMax = yb + BAw + sw
  // the hand slots: centred in the length, their centre this far down each wall from its top edge
  const sc = handTop + handH / 2
  const slotX = W / 2 - SB, slotFront = yMin + sc, slotBack = yMax - sc
  // the bend lines along the middle of each band, in the order to bend them; never past the drawing's extent
  const cx = (x: number) => Math.min(xMax, Math.max(xMin, x)), cy = (y: number) => Math.min(yMax, Math.max(yMin, y))
  const lines: { n: number; deg: number; a: XY; b: XY }[] = [
    { n: 1, deg: deg(turnW), a: { x: cx(fx0 - C.overrun), y: -BAw / 2 }, b: { x: cx(fx1 + C.overrun), y: -BAw / 2 } },
    { n: 2, deg: deg(turnW), a: { x: cx(fx0 - C.overrun), y: yb + BAw / 2 }, b: { x: cx(fx1 + C.overrun), y: yb + BAw / 2 } },
    { n: 3, deg: 90, a: { x: -BA / 2, y: cy(-C.overrun) }, b: { x: -BA / 2, y: cy(yb + C.overrun) } },
    { n: 4, deg: 90, a: { x: xb + BA / 2, y: cy(-C.overrun) }, b: { x: xb + BA / 2, y: cy(yb + C.overrun) } },
  ]
  /** a point of the sheet drawing on the panel (y down) */
  const toPanel = (q: XY): XY => ({ x: q.x - xMin, y: yMax - q.y })
  return {
    W, D, H, He, gap, hand, handH, handTop, ri, rc, t, lean, leanDeg: deg(lean), wallDeg: deg(turnW), insideDeg: 90 - deg(lean),
    BA, SB, BAw, SBw, S, re, xb, yb, sw, he, yIn, lipAt, lipTop: D - 2 * (yIn(He) + C.clear), fx0, fx1, xMin, xMax, yMin, yMax,
    flatW: xMax - xMin, flatH: yMax - yMin, sc, slotX, slotFront, slotBack, lines, toPanel,
  }
}
export type CarrierGeom = ReturnType<typeof carrierGeom>

/**
 * A polygon with each corner rounded by its own radius (an arc tangent to both edges, whatever the angle). Where two
 * fillets would overlap on a short edge (between a bend band and the lip beside it) both shrink in proportion to share it.
 */
function rounded(cs: { x: number; y: number; r: number }[]): Vtx[] {
  const n = cs.length, at = (i: number) => cs[(i + n) % n]
  const dir = (a: XY, b: XY) => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / l, y: (b.y - a.y) / l, l } }
  const corner = cs.map((v, i) => {
    const u1 = dir(at(i - 1), v), u2 = dir(v, at(i + 1))
    const cross = u1.x * u2.y - u1.y * u2.x, turn = Math.atan2(Math.abs(cross), u1.x * u2.x + u1.y * u2.y)
    // a right turn on screen is a convex corner of an outline drawn clockwise: its arc bows to the left of travel
    return { u1, u2, turn, convex: cross > 0, take: v.r * Math.tan(turn / 2) }
  })
  const fit = (d: number, other: number, L: number) => (d + other > L ? (L * d) / (d + other) : d)
  const out: Vtx[] = []
  cs.forEach((v, i) => {
    const c = corner[i], prev = corner[(i + n - 1) % n], next = corner[(i + 1) % n]
    const d = Math.min(fit(c.take, prev.take, c.u1.l), fit(c.take, next.take, c.u2.l))
    if (!(d > 0) || !(c.turn > 1e-9)) { out.push({ x: v.x, y: v.y }); return }
    const b = Math.tan(c.turn / 4)
    out.push({ x: v.x - c.u1.x * d, y: v.y - c.u1.y * d, b: c.convex ? -b : b }, { x: v.x + c.u2.x * d, y: v.y + c.u2.y * d })
  })
  return out
}

/** The one piece's outline on the panel: clockwise on screen from the back wall's top left corner. */
function outline(g: CarrierGeom): Loop {
  const { BA, BAw, xb, yb, sw, he, SB, He, fx0, fx1, rc, re } = g, e = CARRIER.ease
  const yTop = yb + BAw + sw, yLow = -BAw - sw, xL = -BA - he, xR = xb + BA + he
  const bot = g.lipAt(SB), top = g.lipAt(He)
  const cs: [number, number, number][] = [
    // the back wall, its top corners rounded; the corner relief at its right foot
    [fx0, yTop, rc], [fx1, yTop, rc], [fx1, yb + BAw, e], [xb, yb + BAw, e], [xb, yb, e],
    // the right lip, narrowing as it rises between the leaning walls
    [xb + BA, yb, e], [xb + BA, bot.hi, e], [xR, top.hi, re], [xR, top.lo, re], [xb + BA, bot.lo, e], [xb + BA, 0, e], [xb, 0, e],
    // the front wall
    [xb, -BAw, e], [fx1, -BAw, e], [fx1, yLow, rc], [fx0, yLow, rc], [fx0, -BAw, e], [0, -BAw, e], [0, 0, e],
    // the left lip
    [-BA, 0, e], [-BA, bot.lo, e], [xL, top.lo, re], [xL, top.hi, re], [-BA, bot.hi, e], [-BA, yb, e], [0, yb, e], [0, yb + BAw, e], [fx0, yb + BAw, e],
  ]
  return polyLoop(rounded(cs.map(([x, y, r]) => ({ ...g.toPanel({ x, y }), r }))), 'outer')
}

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, C = CARRIER
  const keys = ['W', 'D', 'H', 'He', 'hand', 'handH', 'handTop', 'ri', 'rc']
  if (!keys.every(k => Number.isFinite(p[k]) && p[k] > 0) || !(Number.isFinite(p.gap) && p.gap >= 0)) return { panels: [], notes: [], warnings, errors: ['كل القياسات يجب أن تكون أكبر من الصفر.'] }
  // inner sizes: the length, depth and height come in with the thickness added; the lips' too
  const g = carrierGeom(c.inner ? { ...p, He: p.He + t } : p, t)
  const { W, D, H, He, gap, hand, handH, handTop, ri, rc, SB, BA, BAw, re } = g

  // -------------------------------------------------------------- what cannot be made
  const Wmin = Math.ceil(2 * SB + C.baseMin)
  if (W < Wmin) errors.push(`الطول (${f1(W)} مم) صغير على الثنيتين: أقلّه ${Wmin} مم بهذه السماكة ونصف قطر الثني.`)
  const steep = g.leanDeg > C.leanMax
  if (steep) {
    const k = Math.tan((C.leanMax * Math.PI) / 180), cs = Math.cos((C.leanMax * Math.PI) / 180)
    const Hmin = Math.ceil((D / 2 - gap / 2 - t * cs) / k), Dmax = Math.floor(2 * (H * k + t * cs) + gap)
    errors.push(`الجداران لا يلتقيان من فوق إلا بميل ${f1(g.leanDeg)}°، أكثر من ${C.leanMax}°: العلبة واطئة على عمقها. ارفعها إلى ${Hmin} مم أو قلّل العمق إلى ${Dmax} مم.`)
  }
  if (g.yb < C.baseMin) errors.push(`العمق (${f1(D)} مم) صغير: لا يبقى من القاعدة بين ثنيتي الجدارين إلا ${f1(g.yb)} مم، ويلزم ${C.baseMin} مم على الأقل.`)
  const HeMin = Math.ceil(SB + Math.max(C.lipMin, re + C.ease))
  if (He < HeMin) errors.push(`الجانبان (${f1(He)} مم) واطئان على الثني: أقلّ ارتفاع لهما ${HeMin} مم بهذه السماكة ونصف قطر الثني.`)
  else if (!steep && g.lipTop < 2 * re + C.lipTopMin) {
    const HeMax = g.lean > 0 ? Math.floor(((D - 2 * C.clear - 2 * re - C.lipTopMin) / 2 - t / Math.cos(g.lean)) / Math.tan(g.lean)) : 0
    errors.push(`الجانبان (${f1(He)} مم) أعلى مما يتّسع بين الجدارين المائلين: أقصى ارتفاع لهما ${HeMax} مم بهذه القياسات.`)
  }
  // the slot keeps clear of the lips and of the rounded top corners, and of the wall's bend
  const side = Math.max(t + C.slotSide, rc + 3), handMax = Math.floor(W - 2 * side)
  if (hand > W - 2 * side) errors.push(handMax >= 60 ? `فتحة الإيد (${f1(hand)} مم) أطول مما يتّسع له الجدار: أقصاها ${handMax} مم بهذا الطول، أو زد الطول.` : `الطول (${f1(W)} مم) لا يتّسع لفتحة الإيد (${f1(hand)} مم): اجعله ${Math.ceil(hand + 2 * side)} مم على الأقل.`)
  const low = g.sw - handTop - handH
  if (!steep && low < C.slotLow) errors.push(`فتحة الإيد قريبة من ثني الجدار: يبقى تحتها ${f1(low)} مم من الجدار المستقيم، ويلزم ${C.slotLow} مم على الأقل؛ ارفع العلبة أو صغّر الفتحة أو قرّبها من الحافّة العليا.`)
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  if (t < 2.5) warnings.push(`أكريليك ${t} مم رقيق لعلبة تُحمل من فتحتي الإيد؛ استعمل 3 مم.`)
  if (t > 4) warnings.push(`أكريليك ${t} مم سميك على سخّان السلك: يحتاج تسخيناً أطول ومن الوجهين؛ الأنسب 3 مم.`)

  // -------------------------------------------------------------- the one piece
  const wDeg = Math.round(g.wallDeg), inDeg = Math.round(g.insideDeg)
  const slots = [g.slotFront, g.slotBack].map(y => { const q = g.toPanel({ x: g.slotX, y }); return stadium(q.x, q.y, hand, handH) })
  const bends: Loop[] = g.lines.map(l => ({ closed: false, layer: 'engrave', pts: [g.toPanel(l.a), g.toPanel(l.b)] }))
  const panels: PanelSpec[] = [{
    id: 'box', name: 'العلبة — قطعة واحدة تُثنى', w: g.flatW, h: g.flatH, shape: [outline(g)], holes: slots, engrave: bends,
    note: `الأحمر قصّ، والخطوط الزرقاء أماكن الثني: 1 و2 للجدارين ${wDeg}°، و3 و4 للجانبين 90°`,
  }]

  // -------------------------------------------------------------- notes
  const { leg, w: stripW } = C.strip
  const gauge = C.gaugeLeg * Math.tan((g.insideDeg * Math.PI) / 180)
  const notes = [
    `علبة على شكل خيمة (هرم في المقطع) من قطعة أكريليك شفّاف واحدة ${t} مم تُثنى بالحرارة على أربعة خطوط: قاعدتها ${f1(W)} × ${f1(D)} مم من الخارج، والجداران الطويلان يميلان للداخل ${f1(g.leanDeg)}° ويلتقيان من فوق على ارتفاع ${f1(H)} مم (بينهما ${f1(gap)} مم). الجانبان حافّتان واطئتان ${f1(He)} مم مفتوحتان من فوق، ومنهما تُؤخذ التوزيعات. القطعة المفرودة ${f1(g.flatW)} × ${f1(g.flatH)} مم.`,
    `في كلّ جدار فتحة الإيد نفسها ${f1(hand)} × ${f1(handH)} مم في منتصف الطول، على بُعد ${f1(handTop)} مم من حافّته العليا، فتتقابل الفتحتان وتدخل اليد من الاثنتين معاً. لا تملأ العلبة حتى الفتحتين.`,
    `الخطوط الزرقاء أماكن الثني: ضع القطعة والخطوط للأعلى والسخّان تحت الخطّ تماماً (الخطّ في وسط السخّان)، واثنِ للأعلى. الترتيب: 1 الجدار الأمامي (الخطّ الأسفل في الرسم) ${wDeg}°، فتبقى الزاوية من الداخل بين القاعدة والجدار ${inDeg}°؛ 2 الخلفي مثله؛ 3 الجانب الأيسر 90°؛ 4 الجانب الأيمن 90°. بعد 1 و2 يجب أن يلتقي الجداران من فوق: إن بقي بينهما فراغ أو ركب أحدهما على الآخر فصحّح الزاوية قليلاً وأنت تسخّن.`,
    `ثبّت كلّ ثنية على مقياس زاوية حتى تبرد: ${inDeg}° من الداخل للجدارين، و90° للجانبين. مقياس الجدارين مثلّث قائم ضلعاه ${C.gaugeLeg} و${f1(gauge)} مم تقصّه من بقايا اللوح، والزاوية بين ضلع الـ ${C.gaugeLeg} والوتر.`,
    'السخّان (سلك) على 150–180 درجة: سخّن 30–60 ثانية لأكريليك 3 مم حتى يلين، ثم اثنِ.',
    `طول الثني محسوب بنصف قطر داخلي ${f1(ri)} مم: ثنية الجدار تأخذ ${f1(BAw)} مم من القطعة المفرودة وثنية الجانب ${f1(BA)} مم. جرّبه أولاً على شريحة: ارسم في RDWorks مستطيلاً ${stripW} × ${f1(2 * leg + BA)} مم بخطّ في منتصفه، واثنها 90° على الخطّ؛ كلّ ضلع من الخارج يجب أن يطلع ${f1(leg + SB)} مم. إن طلع أطول فزِد «نصف قطر الثني الداخلي»، وإن طلع أقصر فأنقصه.`,
    `الجانبان يقفان بين وجهي الجدارين الداخليين بخلوص ${CARRIER.clear} مم من كل جهة. الصقهما بالجدارين من الداخل بغراء الأكريليك السائل (cement)، والخطّ الذي يلتقي فيه الجداران من فوق بغراء جل (gel)، ثم غطّه بشريطة زينة.`,
    'ورق الحماية: اتركه وقت القصّ. علّم الخطوط الزرقاء قبل القصّ الأحمر بقصّ خفيف جداً يعلّم على الورق ولا يصل للأكريليك، أو أوقف طبقتها (Output = No) وعلّم أطراف الخطوط بقلم.',
    'اسم المولود بالذهبي يُضاف في RDWorks، فالبرنامج لا يكتب العربية: من مرآة ذهبية تُلصق على الجدار الأمامي بلاصق شفّاف مزدوج الوجه. وإن حفرته على الوجه الداخلي للأمامي (وجه الخطوط) فاعكسه بالمرآة ورأسه نحو حافّة الجدار العليا، فيُقرأ صحيحاً من الخارج.',
  ]
  return { panels, notes, warnings, errors, slotted: false }
}

export const FAVOR_CARRIERS: Template[] = [
  {
    id: 'favorcarrier',
    name: 'علبة توزيعات أكريليك خيمة بفتحة إيد، تُثنى بالحرارة',
    desc: 'علبة أكريليك شفّاف على شكل خيمة كما وصفها الزبون، من قطعة واحدة تُثنى على سخّان سلك على أربعة خطوط: قاعدة، وجداران طويلان يميلان للداخل ويلتقيان من فوق، في كلّ منهما فتحة الإيد نفسها قرب حافّته العليا فتمرّ اليد من الاثنتين، وجانبان واطئان مفتوحان من فوق تُؤخذ منهما التوزيعات؛ زوايا الجدارين العليا مدوّرة. خطوط الثني على طبقة الحفر الزرقاء، والجانبان يُلصقان بغراء الأكريليك، واسم المولود بالذهبي يُضاف في RDWorks.',
    icon: `<path d="M6 54h40l12-8"/><path d="M6 54 21 16h27l10 30"/><path d="M46 54 48 16"/><path d="M47.4 44.5l8.6-6.2" stroke-width="1.4"/><path d="M26.5 22h10a2.5 2.5 0 0 1 0 5h-10a2.5 2.5 0 0 1 0-5z" stroke-width="1.6"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    // inner sizes: the length and depth between the walls at the base, the heights from the base's top (the lips' in build)
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build,
  },
]
