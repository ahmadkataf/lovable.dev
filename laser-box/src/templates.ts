// Ready-made box designs. Every template turns its parameters into panel specs.
import { Loop, Pt, Rect, rect, unionRects, offsetLoop, circle, disc, stadium, stadiumV, roundedRectHole, rotatedRectHole, roundCorner, edgeNotch, engraveRect, hingeLines, heart, ellipse, archHole, keyhole, polyLoop, peakSegments, oriented, signedArea, round3 } from './geom'
import { PanelSpec, fingerCount } from './joints'

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

export interface BuildResult { panels: PanelSpec[]; notes: string[]; warnings: string[]; errors?: string[]; /** pieces slot into each other (edge slots the outline hides from detection) */ slotted?: boolean }

export interface Template {
  id: string
  name: string
  desc: string
  icon: string
  params: ParamDef[]
  defaults: Record<string, number>
  /** what to add to W / D / H when the user typed inner dimensions (p holds the template's other parameters) */
  innerAdd: (t: number, p: Record<string, number>) => { W: number; D: number; H: number }
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
  if (c.kerf > c.t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
}

/** A finger-pull radius that fits the piece it is cut into. */
const fitPull = (pull: number, edgeLen: number, depthAvail: number) => Math.max(0, Math.min(pull, edgeLen / 6, depthAvail / 2.5))


const HINGE_PARAMS: ParamDef[] = [
  mm('web', 'جدار الأذن حول الثقب', 0, 15, '0 = تلقائي: 1.5 × السماكة ولا يقلّ عن 4 مم. زِده للأكريليك (5–6 مم)'),
  mm('tab', 'عرض اللسان', 0, 20, '0 = تلقائياً يساوي السماكة؛ مقطعه مربّع ليدور في الثقب'),
  mm('hc', 'خلوص المفصل', 0.2, 1.5, 'يُضاف لقطر الثقب فوق قُطر مقطع اللسان'),
  mm('gap', 'خلوص الغطاء', 0.2, 2, 'فراغ بين الغطاء والجانبين والخلفية'),
  mm('pull', 'نصف قطر فتحة الإصبع', 0, 30, 'في حافّة الواجهة الأمامية تحت الغطاء'),
]
const HINGE_DEFAULTS = { web: 0, tab: 0, hc: 0.4, gap: 0.5, pull: 8 }

/** The six pieces of the pivot-tab lid box; shared by the plain hinged box and the tea box. */
function pivotLidBox(p: Record<string, number>, c: Common, warnings: string[], errors: string[], stopDeg?: number) {
  const { W, D, H } = p, t = c.t
  const g = pivotLid(p, t)
  // an optional stop: a post on each side's ear, behind the pivot, whose top front corner the lid's back face meets at
  // stopDeg; the whole side is drawn o lower so the post fits above the ear
  let o = 0, xf = D
  if (stopDeg !== undefined) {
    const d = ((stopDeg - 90) * Math.PI) / 180, py = g.a - t / 2
    const s = t / 2 + g.a + g.gap + Math.max(10, Math.min(20, 0.3 * (g.earX - g.gap))) // along the lid, inside its full-width part
    const yt = py + (t / 2) * Math.sin(d) - s * Math.cos(d)
    xf = round3(g.pivotX + (t / 2) * Math.cos(d) + s * Math.sin(d))
    o = round3(-yt)
    const post = D - xf, need = Math.max(5, 1.5 * t)
    if (post < need) errors.push(`العمود الخلفي الذي يسند الغطاء رفيع (${post.toFixed(1)} مم) بهذه الزاوية؛ قلّل زاوية التوقّف أو زد «جدار الأذن».`)
  }
  const minD = Math.ceil((D - g.earX) + 2 * t + 8), minH = Math.ceil(g.a + 3 * t + 2)
  if (D < minD) errors.push(`العمق (${D} مم) لا يتّسع لأذن المفصل: أقلّ عمق ${minD} مم بهذه السماكة.`)
  if (H < minH) errors.push(`الارتفاع (${H} مم) لا يتّسع لأذن المفصل وثقبها: أقلّ ارتفاع ${minH} مم بهذه السماكة.`)
  if (g.tab > 2 * t) warnings.push('لسان عريض يعني ثقباً كبيراً وخلخلة في الدوران؛ الأفضل أن يساوي السماكة.')
  if (p.hc < 0.2) errors.push('خلوص المفصل أقلّ من 0.2 مم: اللسان لن يدور في الثقب.')
  if (g.webTop < 3) warnings.push(`جدار الأذن ${g.webTop} مم رقيق؛ الأكريليك ينكسر عنده. اجعله 4 مم أو أكثر.`)
  const pullX = p.pullX ?? W / 2
  const pull = fitPull(p.pull, W, H - t)
  const rootR = Math.min(0.4, 0.8 * g.gap) // fillets at the tab roots stay inside the side clearance
  const lidCut = (x: number) => [rect(x, g.earX - g.gap, t + g.gap, g.tabY0 - (g.earX - g.gap)), rect(x, g.tabY1, t + g.gap, g.lidD - g.tabY1)]
  const panels: PanelSpec[] = [
    { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
    {
      id: 'front', name: N.front, w: W, h: H, bottom: 'female', left: 'male', right: 'male',
      post: loops => { if (pull >= 2) edgeNotch(loops, pullX, 0, pull) },
      note: pull >= 2 ? 'أقصر من الخلفية بسماكة الغطاء، وفيها فتحة الإصبع' : 'أقصر من الخلفية بسماكة الغطاء',
    },
    { id: 'back', name: N.back, w: W, h: H + t, bottom: 'female', left: 'male', right: 'male', note: 'ترتفع إلى مستوى سطح الغطاء' },
    {
      id: 'side', name: N.side, w: D, h: H + g.a + o, count: 2,
      bottom: 'female', left: { type: 'female', from: g.a + o, len: H }, right: { type: 'female', from: g.a - t + o, len: H + t },
      cuts: [rect(0, 0, g.earX, g.a + o), ...(o > 0 ? [rect(g.earX, 0, xf - g.earX, o)] : [])],
      holes: [circle(g.pivotX, g.a - t / 2 + o, g.holeR)],
      post: loops => { roundCorner(loops, g.earX, o, g.a); roundCorner(loops, D, 0, Math.min(2, g.a - t)) },
      note: o > 0 ? 'أذن خلفية فيها ثقب اللسان، وفوقها عمود يسند الغطاء المفتوح' : 'أذن خلفية مستديرة فيها ثقب اللسان',
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
    `الأذن ترتفع ${g.a.toFixed(1)} مم فوق حافّة الجانب، ويبقى حول الثقب جدار ${g.webTop.toFixed(1)} مم من كل جهة. الغطاء يستقرّ على حوافّ الجانبين والواجهة بعرض الصندوق كاملاً.`,
    'في الأكريليك: استعمل الأكريليك المصبوب (cast) لا المبثوق، لا تُدخل اللسان بالقوة، وإن ضاق صنفر زواياه قليلاً. يمكنك زيادة «جدار الأذن» إلى 5–6 مم.',
    'التجميع: ركّب القاعدة والواجهتين على جانب واحد، أدخل لسان الغطاء في ثقبه، ثم أدخل الجانب الثاني بحيث يدخل اللسان في ثقبه مع دخول الأصابع في وقت واحد. لا يحتاج ثنياً ولا غراءً في الغطاء.',
    'الجزء الخلفي من الغطاء خلف المحور يهبط داخل الصندوق عند الفتح، فالخلفية بارتفاع سطح الغطاء ولا تعيقه. لتخفيف الخلخلة برّد حوافّ اللسان قليلاً ليقترب من الدائرة.',
    stopDeg !== undefined
      ? `الغطاء يفتح حتى ${stopDeg}° فيستند ظهره على العمودين فوق أذني الجانبين ويبقى مفتوحاً وحده${stopDeg > 90 ? ' (مائلاً قليلاً للخلف فلا يسقط)' : '؛ عند 90° تماماً يتوازن فوق المحور وقد ينغلق بلمسة، فالأفضل 93–95°'}.`
      : 'الغطاء يفتح بحرّية حتى نحو 140° ثم يستند بطرفه الخلفي على الحافّة الداخلية للخلفية؛ إن أردت أن يقف عند 100° استعمل شريطاً أو مغناطيساً.',
  ]
  return { panels, notes, g, o, xf }
}

/** Vertical through-slots for dividers, cut into a wall between y0 and y1 at the given positions. */
function addSlots(spec: PanelSpec, pos: number[], y0: number, y1: number, sw: number, vfit = 0) {
  spec.cuts = [...(spec.cuts ?? []), ...pos.map(x => rect(x - sw / 2, y0 - vfit, sw, y1 - y0 + 2 * vfit))]
}

/** Egg-crate dividers: those along the depth get their crossing slots from the top, those along the width from the bottom. */
const FOOT = 1.5 // the wall slots stop this far above the bottom joint, so no sliver is left between a slot and a finger notch

function dividers(W: number, D: number, hd: number, xs: number[], ds: number[], t: number, sw: number, margin: number, tailStep?: { from: number; depth: number }): PanelSpec[] {
  const out: PanelSpec[] = []
  if (xs.length) out.push({
    id: 'divN', name: 'فاصل بالعمق', w: D, h: hd, count: xs.length,
    cuts: [rect(0, 0, t, margin), rect(D - t, 0, t, margin), rect(0, hd - FOOT, t, FOOT), rect(D - t, hd - FOOT, t, FOOT), ...ds.map(d => rect(d - sw / 2, 0, sw, hd / 2)), ...(tailStep ? [rect(tailStep.from, 0, D - t - tailStep.from, tailStep.depth)] : [])],
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
  return { xs, ds, sw, hd, margin, vfit: fit / 2, cells: (Nn + 1) * (Mm + 1) }
}

/** The strip above a sliding lid's slot: at least 5 mm, never thinner than the stock. */
const slidingRim = (t: number, rim: number) => (rim > 0 ? Math.max(rim, t) : Math.max(t, 5))

/** Base box plus a flat lid with a lip frame glued under it that drops inside the walls. */
function lipLidBox(p: Record<string, number>, c: Common, errors: string[], above = 0) {
  const { W, D, H, lipH, gap } = p, t = c.t
  const Wl = W - 2 * t - 2 * gap, Dl = D - 2 * t - 2 * gap
  if (lipH < 3 * t) errors.push(`ارتفاع الشفة صغير جداً: يلزم ${3 * t} مم على الأقل لتعشيق زوايا الإطار.`)
  if (lipH > H - t - 2) errors.push('ارتفاع الشفة أكبر من عمق الصندوق الداخلي.')
  const panels: PanelSpec[] = [
    ...openBox(W, D, H),
    { id: 'lid', name: 'الغطاء — اللوح', w: W, h: D, engrave: [engraveRect(t + gap, t + gap, Wl, Dl)], note: 'الخط الأزرق المحفور يحدّد موضع إطار الشفة على وجهه السفلي' },
    { id: 'lip-fb', name: 'شفة الغطاء — الأمام / الخلف', w: Wl, h: lipH, left: 'male', right: 'male', count: 2 },
    { id: 'lip-side', name: 'شفة الغطاء — الجانب', w: Dl, h: lipH, left: 'female', right: 'female', count: 2 },
  ]
  const notes = [
    `إطار الشفة ${Wl.toFixed(1)} × ${Dl.toFixed(1)} × ${lipH} مم يُلصق تحت اللوح داخل الخط المحفور؛ يدخل في الصندوق بخلوص ${gap} مم من كل جهة.`,
    `الارتفاع الكلّي مع الغطاء ${Math.round((H + t + above) * 10) / 10} مم${above > 0 ? ' مع المقبض' : ''}.`,
  ]
  return { panels, notes, Wl, Dl }
}

/** Decorative holes filling the field [x0,x1]×[y0,y1]: 1 circles, 2 vertical slots, 3 one window, 4 hearts. */
function pattern(kind: number, x0: number, y0: number, x1: number, y1: number, cell: number, skip?: (x: number) => boolean): Loop[] {
  const fw = x1 - x0, fh = y1 - y0
  if (fw < cell * 2 || fh < cell * 2) return []
  if (kind === 3) return [roundedRectHole(x0, y0, fw, fh, Math.min(4, cell / 2))]
  const out: Loop[] = []
  if (kind === 7) return rosettes(x0, y0, x1, y1, cell, skip)
  if (kind === 6) {
    // eight-pointed stars (two squares crossed) on a square grid, a small square hole where four stars meet;
    // the stars' facing points stay a bar apart, the bar at least 2.5 mm
    const bar = Math.max(2.5, cell * 0.16), P = cell + bar, R = cell / 2, Ri = R * Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8)
    const nx = Math.floor((fw - cell) / P) + 1, ny = Math.floor((fh - cell) / P) + 1
    if (nx < 1 || ny < 1) return out
    const sx = x0 + (fw - (nx - 1) * P) / 2, sy = y0 + (fh - (ny - 1) * P) / 2
    const star = (cx: number, cy: number): Loop => polyLoop(Array.from({ length: 16 }, (_, k) => {
      const a = (k * Math.PI) / 8, r = k % 2 ? Ri : R
      return { x: round3(cx + r * Math.cos(a)), y: round3(cy + r * Math.sin(a)) }
    }), 'hole')
    const sq = (Math.SQRT1_2 * P - R - bar) / Math.SQRT2 // half-side of the square between four stars
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = sx + i * P, y = sy + j * P
      if (skip && skip(x)) continue
      out.push(star(x, y))
      if (sq >= 1.2 && i + 1 < nx && j + 1 < ny && !(skip && skip(x + P / 2))) out.push(rotatedRectHole(x + P / 2, y + P / 2, 2 * sq, 2 * sq, 0))
    }
    return out
  }
  if (kind === 5) {
    // a diagonal lattice: diamonds cell wide, separated by bars at least 2.5 mm wide, every other row shifted half a step
    const bar = Math.max(2.5, cell * 0.18), P = cell + bar * Math.SQRT2, side = cell / Math.SQRT2
    const cols = Math.floor((fw - cell) / P), rows = Math.floor((fh - cell) / (P / 2))
    if (cols < 0 || rows < 0) return out
    const sx = x0 + (fw - cols * P) / 2, sy = y0 + (fh - rows * (P / 2)) / 2
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols - (j % 2); i++) {
      const x = sx + i * P + (j % 2 ? P / 2 : 0), y = sy + j * (P / 2)
      if (skip && skip(x)) continue
      out.push(rotatedRectHole(x, y, side, side, Math.PI / 4))
    }
    return out
  }
  if (kind === 2) {
    const pitch = cell * 2, n = Math.max(1, Math.floor((fw - cell) / pitch) + 1), sx = x0 + (fw - (n - 1) * pitch) / 2
    for (let i = 0; i < n; i++) { const x = sx + i * pitch; if (!skip || !skip(x)) out.push(stadiumV(x, y0 + fh / 2, fh, cell)) }
    return out
  }
  const pitch = kind === 4 ? cell * 1.45 : cell * 1.7
  const nx = Math.max(1, Math.floor((fw - cell) / pitch) + 1), ny = Math.max(1, Math.floor((fh - cell) / pitch) + 1)
  const sx = x0 + (fw - (nx - 1) * pitch) / 2, sy = y0 + (fh - (ny - 1) * pitch) / 2
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = sx + i * pitch, y = sy + j * pitch
    if (skip && skip(x)) continue
    out.push(kind === 4 ? heart(x, y, cell) : circle(x, y, cell / 2))
  }
  return out
}

const PATTERN_HINT = '1 = دوائر، 2 = شقوق عمودية، 3 = نافذة واحدة، 4 = قلوب، 5 = شبكة معيّنات، 6 = نجوم ثمانية، 7 = نجوم ووردات إسلامية متشابكة'
/**
 * Islamic eight-fold rosettes in strapwork: Hankin's method on the 4.8.8 tiling (octagons at a square lattice of
 * period 3·cell, squares between). From each edge's midpoint two rays leave at the contact angle and stop where they
 * meet the rays of the neighbouring edges; the faces between them are an eight-pointed star in every octagon, a
 * four-pointed star in every square, and a six-sided petal round every tiling vertex. Each face, clipped to the field,
 * is shrunk by half the strap width and cut out, so straps of even width are left between them.
 */
function rosettes(x0: number, y0: number, x1: number, y1: number, cell: number, skip?: (x: number) => boolean): Loop[] {
  // the period is stretched so a whole number of rosettes spans the width: both sides then run through star centres,
  // as in a cut border. Rows are whole too, the spare height left solid above and below
  const nx = Math.max(1, Math.round((x1 - x0) / (3 * cell))), Pd = (x1 - x0) / nx, ny = Math.floor((y1 - y0) / Pd)
  if (ny < 1) return []
  const w = Math.max(2.5, 0.075 * Pd), th = (67.5 * Math.PI) / 180
  const ys = (y0 + y1) / 2 - (ny * Pd) / 2, ye = ys + ny * Pd
  y0 = ys; y1 = ye
  type V = { x: number; y: number }
  const rot = (v: V, a: number) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) })
  const meet = (p: V, u: V, q: V, v: V) => { const den = u.x * v.y - u.y * v.x, k = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den; return { x: p.x + k * u.x, y: p.y + k * u.y } }
  const key = (v: V) => `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)}`
  const faces: V[][] = []
  const around = new Map<string, { at: V; pts: V[] }>()
  // the tiles, counter-clockwise in a y-up frame (the turn is the same on screen, mirrored, so the faces still close)
  const tiles: V[][] = []
  const R8 = 0.5 / Math.cos(Math.PI / 8), s4 = 0.5 - 0.5 * Math.tan(Math.PI / 8)
  for (let i = -1; i <= nx + 1; i++) for (let j = -1; j <= ny + 1; j++) {
    tiles.push(Array.from({ length: 8 }, (_, k) => ({ x: i + R8 * Math.cos(Math.PI / 8 + (k * Math.PI) / 4), y: j + R8 * Math.sin(Math.PI / 8 + (k * Math.PI) / 4) })))
    tiles.push([{ x: i + 0.5 + s4, y: j + 0.5 }, { x: i + 0.5, y: j + 0.5 + s4 }, { x: i + 0.5 - s4, y: j + 0.5 }, { x: i + 0.5, y: j + 0.5 - s4 }])
  }
  for (const T of tiles) {
    const n = T.length, M = T.map((a, k) => { const b = T[(k + 1) % n]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } })
    const star: V[] = []
    for (let k = 0; k < n; k++) {
      // the corner T[k+1], between edge k and edge k+1: both rays lean towards it, turned inwards by the contact angle
      const a = T[k], b = T[(k + 1) % n], c = T[(k + 2) % n]
      const e0 = { x: b.x - a.x, y: b.y - a.y }, e1 = { x: b.x - c.x, y: b.y - c.y }
      const X = meet(M[k], rot(e0, th), M[(k + 1) % n], rot(e1, -th))
      star.push(M[k], X)
      const g = around.get(key(b)) ?? { at: b, pts: [] }
      g.pts.push(X, M[k], M[(k + 1) % n])
      around.set(key(b), g)
    }
    faces.push(star)
  }
  for (const { at, pts } of around.values()) {
    if (pts.length < 9) continue // a vertex on the rim of the tiles generated
    const uniq = [...new Map(pts.map(v => [key(v), v])).values()]
    faces.push(uniq.sort((u, v) => Math.atan2(u.y - at.y, u.x - at.x) - Math.atan2(v.y - at.y, v.x - at.x)))
  }
  const out: Loop[] = []
  const toField = (v: V) => ({ x: x0 + v.x * Pd, y: ys + v.y * Pd })
  const clip = (poly: V[]) => {
    let pts = poly
    for (const [ax, sg, lim] of [['x', 1, x0], ['x', -1, x1], ['y', 1, y0], ['y', -1, y1]] as const) {
      const inside = (v: V) => sg * (v[ax] - lim) >= 0, res: V[] = []
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length]
        if (inside(a)) res.push(a)
        if (inside(a) !== inside(b)) { const u = (lim - a[ax]) / (b[ax] - a[ax]); res.push({ x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) }) }
      }
      pts = res
      if (pts.length < 3) return []
    }
    return pts
  }
  const area = (p: V[]) => p.reduce((sum, a, k) => { const b = p[(k + 1) % p.length]; return sum + a.x * b.y - b.x * a.y }, 0) / 2
  const crosses = (p: V[]) => {
    const n = p.length
    for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) {
      if (a === 0 && b === n - 1) continue
      const P1 = p[a], P2 = p[(a + 1) % n], Q1 = p[b], Q2 = p[(b + 1) % n]
      const d = (o: V, q: V, r: V) => (q.x - o.x) * (r.y - o.y) - (q.y - o.y) * (r.x - o.x)
      if (d(P1, P2, Q1) * d(P1, P2, Q2) < 0 && d(Q1, Q2, P1) * d(Q1, Q2, P2) < 0) return true
    }
    return false
  }
  for (const f of faces) {
    const fp = clip(f.map(toField))
    if (fp.length < 3) continue
    const dedup = fp.filter((v, k) => Math.hypot(v.x - fp[(k + 1) % fp.length].x, v.y - fp[(k + 1) % fp.length].y) > 1e-6)
    if (dedup.length < 3) continue
    const A = area(dedup), ins = offsetPolyline(dedup, true, A > 0 ? -w / 2 : w / 2)
    // a face clipped to a sliver collapses when shrunk: keep only holes that stay simple, the same way round, and roomy
    const Ai = area(ins)
    if (Math.sign(Ai) !== Math.sign(A) || Math.abs(Ai) < 4 || crosses(ins)) continue
    let room = Infinity
    for (let a = 0; a < ins.length; a++) for (let b = 0; b < ins.length; b++) {
      if (b === a || (b + 1) % ins.length === a) continue
      const q = ins[a], P1 = ins[b], P2 = ins[(b + 1) % ins.length], dx = P2.x - P1.x, dy = P2.y - P1.y, l2 = dx * dx + dy * dy
      const u = Math.max(0, Math.min(1, ((q.x - P1.x) * dx + (q.y - P1.y) * dy) / l2))
      room = Math.min(room, Math.hypot(q.x - P1.x - u * dx, q.y - P1.y - u * dy))
    }
    // inside the field by the strap's half width (clipped faces were cut at the field's edge)
    if (room < 1.2 || ins.some(v => v.x < x0 + w / 2 - 1e-6 || v.x > x1 - w / 2 + 1e-6 || v.y < y0 + w / 2 - 1e-6 || v.y > y1 - w / 2 + 1e-6)) continue
    const mx = ins.reduce((sum, v) => sum + v.x, 0) / ins.length
    if (skip && skip(mx)) continue
    out.push(polyLoop(ins.map(v => ({ x: round3(v.x), y: round3(v.y) })), 'hole'))
  }
  return out
}


/**
 * A living-hinge cylinder: two end discs with tab slots, and the sheet that wraps round them. Shared by the lamp
 * shade, the round box and the cat money box. `solid` keeps a band of the sheet free of hinge cuts (for a coin slot).
 */
function cylinderCore(p: Record<string, number>, c: Common, warnings: string[], errors: string[], socket = 0, solid?: { x: number; w: number }) {
    const { H, tabW, fit, seg, bridge, pitch } = p, t = c.t
    // H is already the clear height between the rings; in inner mode Dm is the inside diameter
    const Dm = p.Dm + (c.inner ? 2 * t : 0)
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
    if (L > 400) warnings.push(`اللوح الملتفّ طوله ${L.toFixed(0)} مم؛ تأكد أن لوحك وآلتك يتّسعان له، أو اقسمه إلى قطعتين وأضف وصلة.`)
    if (pitch > 2) warnings.push('صفوف المفصل متباعدة؛ قد ينكسر عند الانحناء على هذا القطر.')
    if (pitch - c.kerf < 1) warnings.push('الصفوف متقاربة جداً: الشريحة بينها أرقّ من 1 مم وقد تحترق أو تنقطع.')
    if (seg + bridge > H - 2 * bridge) errors.push('طول قصّة المفصل أكبر من الارتفاع.')
    const cx = Rring
    const slotAngles = Array.from({ length: n }, (_, k) => (2 * Math.PI * k) / n)
    const slots = slotAngles.map(a => rotatedRectHole(cx + Rmid * Math.cos(a), cx + Rmid * Math.sin(a), tabW + fit, t + fit, a + Math.PI / 2))
    const ring = (id: string, name: string, holeR: number, note: string): PanelSpec => ({
      id, name, w: 2 * Rring, h: 2 * Rring, shape: [disc(cx, cx, Rring)], holes: [...(holeR > 0 ? [circle(cx, cx, holeR)] : []), ...slots], note,
    })
    // the sheet: H tall plus a t-deep tab strip on each edge; the strips are cut away between the tabs
    const xs = Array.from({ length: n }, (_, k) => round3(L * (k + 0.5) / n))
    const seam = Math.max(4, 2 * pitch)
    const stripCuts = (y: number) => {
      const out = [] as ReturnType<typeof rect>[]
      let x = 0
      for (const xk of xs) { out.push(rect(x, y, xk - tabW / 2 - x, t)); x = xk + tabW / 2 }
      out.push(rect(x, y, L - x, t))
      return out
    }
    // solid margins at both ends for the glued seam; columns run out through the edges except under the tabs
    const open = hingeLines(seam, t, L - seam, H + t, seg, bridge, pitch, 'y', { through: true, keepEdge: r => xs.some(xk => Math.abs(seam + r - xk) < tabW / 2 + bridge) })
      .filter(l => !solid || Math.abs(l.pts[0].x - solid.x) >= solid.w / 2)
    // between neighbouring tabs the edge must be cut through by at least two columns (one each side of the seam),
    // otherwise a solid band runs along the edge and the sheet cannot bend into a cylinder
    const reaches = (edge: (l: Loop) => boolean) => new Set(open.filter(edge).map(l => round3(l.pts[0].x)))
    const lo = reaches(l => Math.min(l.pts[0].y, l.pts[1].y) < t), hi = reaches(l => Math.max(l.pts[0].y, l.pts[1].y) > H + t)
    const thru = [...lo].filter(x => hi.has(x))
    const inGap = (a: number, b: number) => thru.filter(x => x > a && x < b).length
    const bandOk = xs.every((xk, j) => j + 1 < n ? inGap(xk, xs[j + 1]) >= 2 : inGap(xk, L) >= 1 && inGap(0, xs[0]) >= 1)
    if (!bandOk && seg + bridge <= H - 2 * bridge) errors.push('اللسانات متقاربة فلا تبقى بينها قصّات مفصل نافذة كافية، فيبقى شريط مصمت على الحافّة يمنع اللوح من الالتفاف؛ قلّل عدد اللسانات أو عرضها أو الجسر.')
    const sheet = (holes: Loop[] = []): PanelSpec => ({
      id: 'sheet', name: 'اللوح الملتفّ (مفصل مرن)', w: L, h: H + 2 * t,
      cuts: [...stripCuts(0), ...stripCuts(H + t)], open, holes,
      note: 'يلتفّ حول الحلقتين؛ اللسانات تدخل في شقوقهما',
    })
    return { Dm, Rmid, Rring, L, cx, seam, slots, ring, sheet }
}

/** The lamp shade and the round box: two discs and a wrapped living-hinge sheet. */
function cylinderBuild(kind: 'shade' | 'roundbox') {
  return (p: Record<string, number>, c: Common): BuildResult => {
    const warnings: string[] = [], errors: string[] = []
    const { H } = p, t = c.t
    const socket = kind === 'shade' ? p.socket : 0
    const { Dm, L, seam, ring, sheet } = cylinderCore(p, c, warnings, errors, socket)
    const panels: PanelSpec[] = [
      ...(kind === 'shade' ? [
        ring('ring-top', 'الحلقة العلوية', socket > 0 ? socket / 2 : 0, 'فتحة الدواية في الوسط وشقوق اللسانات حول المحيط'),
        ring('ring-bottom', 'الحلقة السفلية', Math.max(0, Dm / 2 - 3 * t), 'مفتوحة من الوسط ليخرج الضوء'),
      ] : [
        ring('rim', 'الحافّة العلوية', Math.max(0, Dm / 2 - 3 * t), 'حلقة تقوّي فم العلبة'),
        ring('base', 'القاع', 0, 'قرص مغلق بشقوق اللسانات حول المحيط'),
      ]),
      sheet(),
    ]
    const notes = [
      `اللوح ${L.toFixed(1)} × ${(H + 2 * t).toFixed(1)} مم (منها ${t} مم لسانات في كل حافّة) ينحني بالمفصل المرن حول الحلقتين؛ الارتفاع بين الحلقتين ${H} مم والقطر الخارجي ${Dm} مم.`,
      `ألصق اللسانات في شقوق الحلقتين، وطرفا اللوح يلتقيان ويُلصقان؛ تركتُ عند كل طرف ${seam} مم بلا قصّات لهذا اللصق.`,
      ...(kind === 'shade' ? [
        'الحلقتان أعرض من الأسطوانة بسماكتين لتكوّنا حافّة؛ الحلقة العلوية تحمل الدواية، والسفلية مفتوحة.',
        'استعمل مصباح LED فقط. القصّات نفسها تسرّب خطوط ضوء جميلة؛ لتخفيفها ضع ورقاً من الداخل.',
      ] : [
        'القاع قرص مغلق والحافّة العلوية حلقة مفتوحة؛ كلاهما أعرض من الجدار بسماكتين فيكوّنان إطاراً.',
        'للحلويات الملفوفة أو الهدايا؛ قصّات المفصل تُظهر ما في الداخل، فبطّنها بورق ملوّن إن أردت.',
      ]),
    ]
    return { panels, notes, warnings, errors }
  }
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
    params: [...DIMS, mm('slide', 'خلوص الانزلاق', 0.2, 2, 'فراغ إضافي في الشق ليتحرك الغطاء بسهولة'), mm('pull', 'حجم فتحة الإبهام', 0, 30, 'فتحة قرب الحافّة الأمامية للغطاء يُسحب بها'), mm('rim', 'سماكة الشريحة فوق الشقّ', 0, 15, '0 = تلقائي: 5 مم، أو سماكة الخامة إن كانت أكبر')],
    defaults: { W: 120, D: 80, H: 50, slide: 0.3, pull: 8, rim: 0 },
    innerAdd: (t, p) => ({ W: 2 * t, D: 2 * t, H: slidingRim(t, p.rim ?? 0) + 2 * t + (p.slide ?? 0.3) }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, slide } = p, t = c.t
      // the strip above the slot hangs from the back corner only, so it is made thicker than the stock when the stock is thin
      const rim = slidingRim(t, p.rim)
      const slotBottom = rim + t + slide, frontH = H - slotBottom
      if (frontH < 2 * t) errors.push(`الارتفاع صغير جداً للغطاء المنزلق: يلزم ${(slotBottom + 2 * t).toFixed(1)} مم على الأقل.`)
      const pull = Math.max(0, Math.min(p.pull, (W - 4 * t) / 5, (D - t) / 5))
      // the rim above the slot hangs from a solid block at the side's top-back corner; the back joint starts below it,
      // so the rim stays attached whatever the finger size
      const jointFrom = slotBottom + Math.max(1, t / 2)
      if (H - jointFrom - t < 2 * t) errors.push(`الارتفاع صغير جداً لتعشيق الخلفية تحت الشقّ: يلزم ${Math.ceil(jointFrom + 3 * t)} مم على الأقل.`)
      if ((D - t) / rim > 25) warnings.push(`الشريحة فوق شقّ الغطاء طويلة بالنسبة لسماكتها (${(D - t).toFixed(0)} × ${rim} مم) وقد تنكسر؛ زد سماكة الشريحة إلى ${Math.ceil((D - t) / 25)} مم أو قلّل العمق.`)
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
          cuts: [rect(0, rim, D - t, t + slide)], note: 'الشقّ العلوي يستقبل الغطاء',
        },
        {
          // a thumb hole near the front edge: press the thumb in and pull the lid towards you
          id: 'lid', name: N.lid, w: W, h: D - t,
          holes: pull >= 4 ? [stadium(W / 2, Math.max(t + 2, 4) + 0.75 * pull, 2.5 * pull, 1.5 * pull)] : [],
        },
      ]
      return { panels, notes: [
        `الشقّ ${(t + slide).toFixed(1)} مم لغطاء سماكته ${t} مم؛ قِس سماكة لوحك الحقيقية بالكاليبر قبل القصّ (الأبلكاش 3 مم يأتي أحياناً 2.7 أو 3.2) واكتبها في سماكة الخامة.`,
        `الشريحة فوق الشقّ ${rim} مم متّصلة بجسم الجانب عبر كتلة صلبة في الزاوية الخلفية العلوية، وتعشيق الخلفية يبدأ تحتها. لا ترفع الصندوق من غطائه.`,
        'الغطاء ينزلق من الأمام؛ ضع إبهامك في الفتحة القريبة من حافّته واسحبه نحوك. اقصّ الغطاء أولاً وجرّبه في شقّ جانب واحد قبل قصّ الباقي.',
      ], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'liftoff',
    name: 'علبة بغطاء منفصل',
    desc: 'قاعدة مفتوحة وغطاء يُلبَس فوقها كعلبة الأحذية.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M8 14 32 2l24 12-24 12z"/><path d="M8 14v6l24 12 24-12v-6"/>`,
    params: [...DIMS, mm('lidH', 'ارتفاع الغطاء', 5, 500), mm('gap', 'خلوص الغطاء', 0.2, 3, 'فراغ بين القاعدة والغطاء من كل جهة')],
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
  {
    id: 'hinged90',
    name: 'صندوق بغطاء مفصلي يقف مفتوحاً',
    desc: 'نفس الصندوق المفصلي بستّ قطع، وفوق أذني الجانبين عمودان يسند عليهما الغطاء عند 90–95° فيبقى مفتوحاً.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M48 28V6l-6 3v18" stroke-width="2"/><path d="M54 30V14h-4" stroke-width="3"/><circle cx="50" cy="29" r="1.8" fill="currentColor"/>`,
    params: [...DIMS, ...HINGE_PARAMS, { key: 'stop', label: 'زاوية توقّف الغطاء', min: 90, max: 100, step: 1, unit: '°', hint: '90 = عمودي تماماً؛ 93–95 يميل قليلاً للخلف فيبقى ثابتاً' }],
    defaults: { W: 120, D: 80, H: 50, ...HINGE_DEFAULTS, stop: 95 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { panels, notes } = pivotLidBox(p, c, warnings, errors, p.stop)
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
      const pull = fitPull(p.pull, W, H - t)
      const Lh = (R - t / 2) * Math.PI / 2 // arc length of the hinge mid-surface
      const lidLen = D - R, backLen = H - R + t
      const rows = Math.floor(Lh / pitch)
      if (rows < 3) errors.push('منطقة المفصل قصيرة جداً لتنثني: زد نصف قطر الانحناء أو قلّل المسافة بين الصفوف.')
      else if (rows < 6 || R - t / 2 < 3 * t) warnings.push(`المفصل قصير (${rows} صفوف، نصف قطر ${(R - t / 2).toFixed(1)} مم) وقد يتشقّق؛ نصف قطر ${Math.ceil(3.5 * t + t / 2)} مم أو أكثر أأمن.`)
      if (seg + bridge > W - 2 * bridge) errors.push('طول قصّة المفصل أكبر من عرض الصندوق.')
      if (bridge >= seg / 2) warnings.push('الجسور طويلة بالنسبة للقصّات؛ المفصل سيكون قاسياً. قلّل الجسر أو أطل القصّة.')
      if (pitch - c.kerf < 1) warnings.push('الصفوف متقاربة جداً: الشريحة بينها أرقّ من 1 مم وقد تحترق أو تنقطع.')
      const open: Loop[] = hingeLines(0, lidLen, W, lidLen + Lh, seg, bridge, pitch, 'x', { through: true })
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        {
          id: 'front', name: N.front, w: W, h: H, bottom: 'female', left: 'male', right: 'male',
          post: loops => { if (pull >= 2) edgeNotch(loops, W / 2, 0, pull) }, note: 'فتحة الإصبع تحت حافّة الغطاء',
        },
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
          note: 'الطرف العلوي هو مقدّمة الغطاء، والسفلي قاعدة الخلفية',
        },
      ]
      const notes = [
        `المفصل المرن: ${rows} صفوف من القصّات بطول ${Lh.toFixed(1)} مم ينثني 90° حول الظهر؛ الصفوف المتناوبة تخرج من الحافّتين حتى لا يبقى شريط صلب يمنع الانثناء.`,
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
        if (sp.id === 'front' || sp.id === 'back') addSlots(sp, d.xs, d.margin, d.hd - FOOT, d.sw, d.vfit)
        if (sp.id === 'side') addSlots(sp, d.ds, d.margin, d.hd - FOOT, d.sw, d.vfit)
      }
      const panels = [...box, ...dividers(W, D, d.hd, d.xs, d.ds, t, d.sw, d.margin)]
      const notes = [
        `${d.cells} خانة. الفواصل تتقاطع بشقوق نصفية (egg-crate) وتُثبّت بأطرافها في شقوق الجدران.`,
        'الفواصل محبوسة بعد التجميع: ركّب القاعدة والواجهتين مع الفواصل بالعمق، أنزل الفواصل بالعرض فوقها، ثم أدخل الجانبين جانبياً في النهاية، ولا تلصق قبل أن يدخل كل شيء.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'tray',
    name: 'صينية بمقابض',
    desc: 'صندوق منخفض مع فتحتي مقبض في الجانبين للحمل.',
    icon: `<path d="M8 30 32 18 56 30 32 42z"/><path d="M8 30v8l24 12V42M56 30v8L32 50"/><path d="M44 29l6-3v4l-6 3z" fill="currentColor" stroke="none"/><path d="M12 29l6 3v4l-6-3z" fill="currentColor" stroke="none"/>`,
    params: [...DIMS, mm('hl', 'طول المقبض', 20, 300), mm('hh', 'ارتفاع المقبض', 12, 60), mm('hm', 'الهامش فوق المقبض', 4, 50)],
    defaults: { W: 220, D: 140, H: 50, hl: 60, hh: 18, hm: 8 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H } = p, t = c.t
      // the handle shrinks to fit the side it is cut into
      // the hole's real extent: a stadium never gets taller than it is long, so its width is always hl
      const hl = Math.min(p.hl, D - 4 * t), hm = Math.max(3, Math.min(p.hm, (H - t) / 4)), hh = Math.min(p.hh, H - t - hm - 3, hl)
      const ok = hh >= 12 && hl >= 25
      if (!ok) errors.push(`الجانب (${D} × ${H} مم) أصغر من أن يحمل فتحة مقبض تدخلها الأصابع (12 × 25 مم على الأقل)؛ زد الارتفاع أو العمق.`)
      else if (hl < p.hl || hh < p.hh || hm < p.hm) warnings.push(`صُغّر المقبض إلى ${hl.toFixed(0)} × ${hh.toFixed(0)} مم ليناسب الجانب.`)
      const box = openBox(W, D, H)
      const side = box.find(x => x.id === 'side')!
      if (ok) side.holes = [stadium(D / 2, hm + hh / 2, hl, hh)]
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
    innerAdd: (t, p) => ({ W: 4 * t + 2 * (p.gap ?? 0.6), D: 3 * t + (p.gap ?? 0.6), H: 3 * t + (p.gap ?? 0.6) }),
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
        `الدرج ${Wd.toFixed(1)} × ${Dd.toFixed(1)} × ${Hd.toFixed(1)} مم خارجياً (فراغه الداخلي ${(Wd - 2 * t).toFixed(1)} × ${(Dd - 2 * t).toFixed(1)} × ${(Hd - t).toFixed(1)} مم). خلوصه ${gap} مم من كل جانب عرضاً، و${gap} مم إجمالاً في الارتفاع والعمق.`,
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
      // slotL runs along the width, slotW along the depth; whichever is longer becomes the stadium's length
      if (slotL >= 20 && slotW >= 8) top.holes = [slotW > slotL ? stadiumV(W / 2, D / 2, slotW, slotL) : stadium(W / 2, D / 2, slotL, slotW)]
      const iw = W - 2 * t, id_ = D - 2 * t, ih = H - t
      if (iw < 232 || id_ < 117 || ih < 82) warnings.push(`الفراغ الداخلي ${iw.toFixed(0)} × ${id_.toFixed(0)} × ${ih.toFixed(0)} مم لا يتّسع لعلبة المناديل القياسية 230 × 115 × 80 مم.`)
      const notes = [`يُقلب الصندوق فيصير لوح القاعدة سطحاً بفتحة ${slotL.toFixed(0)} × ${slotW.toFixed(0)} مم، ويُملأ من الجهة المفتوحة في الأسفل.`]
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
      const overlap = Math.floor(Math.min(5, (wm - 2 * t - gap) / 2) * 2) / 2 // how far the acrylic reaches under the wood (0.5 mm steps), inside the lip frame
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
      // the finger notch goes in the middle of the cell nearest the box centre, clear of the divider slots
      const bounds = [t, ...d.xs, W - t]
      const cells = bounds.slice(1).map((b, i) => ({ c: (bounds[i] + b) / 2, half: (b - bounds[i]) / 2 - (i > 0 ? d.sw / 2 : 0) }))
      const cell = cells.reduce((best, k) => (Math.abs(k.c - W / 2) < Math.abs(best.c - W / 2) ? k : best))
      const { panels: box, notes, g } = pivotLidBox({ ...p, pullX: cell.c, pull: Math.max(0, Math.min(p.pull, cell.half - 2)) }, c, warnings, errors)
      // the lid's tail dips inside the box behind the pivot: dividers must stay out of that zone
      const tailFrom = round3(g.earX - g.gap - 1)
      const dip = round3(Math.hypot(g.lidD - g.pivotX, t / 2) - t / 2 + 1)
      if (d.ds.some(x => x + d.sw / 2 > tailFrom - 1)) errors.push('فاصل بالعرض يقع تحت مسار ذيل الغطاء عند الفتح؛ قلّل عدد الفواصل بالعمق.')
      for (const sp of box) {
        if (sp.id === 'front') addSlots(sp, d.xs, d.margin, d.hd - FOOT, d.sw, d.vfit)
        if (sp.id === 'back') addSlots(sp, d.xs, t + d.margin, t + d.hd - FOOT, d.sw, d.vfit)
        if (sp.id === 'side') addSlots(sp, d.ds, g.a + d.margin, g.a + d.hd - FOOT, d.sw, d.vfit)
      }
      const panels = [...box, ...dividers(W, D, d.hd, d.xs, d.ds, t, d.sw, d.margin, d.xs.length ? { from: tailFrom, depth: dip } : undefined)]
      const divNotes: string[] = []
      if (d.xs.length || d.ds.length) divNotes.push(`${d.cells} خانة${d.xs.length && d.ds.length ? '؛ الفواصل تتقاطع بشقوق نصفية' : ''}، وتُثبّت أطرافها في شقوق الجدران.`)
      if (d.xs.length) divNotes.push(`الفواصل بالعمق منخفضة ${dip.toFixed(1)} مم عند الخلف ليمرّ ذيل الغطاء عند الفتح.`)
      if (d.xs.length || d.ds.length) divNotes.push('التجميع مع الفواصل: أدخل الواجهتين على أطراف الفواصل بالعمق، ضع هذه المجموعة على القاعدة، أنزل الفواصل بالعرض فوقها، ثم أدخل جانباً، ضع الغطاء بلسانه في ثقبه، وأدخل الجانب الثاني أخيراً.')
      return { panels, notes: [...divNotes, ...notes], warnings, errors }
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
      { key: 'pattern', label: 'الزخرفة', min: 1, max: 7, step: 1, int: true, hint: PATTERN_HINT },
      mm('cell', 'حجم الثقب', 3, 40, 'قطر الدائرة أو عرض الشقّ أو القلب'),
      mm('lipH', 'ارتفاع شفة الغطاء', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2),
      mm('foot', 'ارتفاع القاعدة المرتفعة', 0, 40, 'إطار تحت القاعدة يرفع الفانوس فوق صامولة الدواية، مع فتحة للكابل؛ 0 = بلا'),
    ],
    defaults: { W: 100, D: 100, H: 160, socket: 40, vent: 40, pattern: 1, cell: 8, lipH: 10, gap: 0.5, foot: 15 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, socket, vent, cell, lipH, foot } = p, t = c.t
      const kind = Math.round(p.pattern)
      const { panels, notes } = lipLidBox(p, c, errors)
      if (socket > 0 && socket > Math.min(W, D) - 4 * t - 4) errors.push('فتحة الدواية أكبر من القاعدة.')
      if (vent > 0 && vent > Math.min(W, D) - 4 * t - 4) errors.push('فتحة التهوية أكبر من الغطاء.')
      const bottom = panels.find(x => x.id === 'bottom')!
      if (socket > 0 && socket <= Math.min(W, D) - 4 * t - 4) { bottom.holes = [circle(W / 2, D / 2, socket / 2)]; bottom.note = 'فتحة الدواية في الوسط' }
      const lid = panels.find(x => x.id === 'lid')!
      if (vent > 0 && vent <= Math.min(W, D) - 4 * t - 4) lid.holes = [circle(W / 2, D / 2, vent / 2)]
      // the decorative field keeps clear of the finger strips, the lip frame's seat and the bottom joint
      const m = 2 * t + 2, top = Math.max(m, lipH + 2), bottomY = H - t - m
      const holesFor = (w: number): Loop[] => pattern(kind, m, top, w - m, bottomY, cell)
      for (const sp of panels) {
        if (sp.id === 'front' || sp.id === 'back') sp.holes = holesFor(W)
        if (sp.id === 'side') sp.holes = holesFor(D)
      }
      const plainW = !holesFor(W).length, plainD = !holesFor(D).length
      if (plainW || plainD) warnings.push(`${plainW && plainD ? 'كل الجدران' : plainW ? 'الواجهتان' : 'الجانبان'} أصغر من أن تحمل الزخرفة بهذا الحجم وستبقى بلا ثقوب؛ صغّر حجم الثقب أو كبّر الفانوس.`)
      // a raised base: a frame glued under the bottom plate, so the lamp holder's nut and the cable have room
      const lampNotes: string[] = []
      if (foot > 0) {
        if (foot < 3 * t + 1) errors.push(`ارتفاع القاعدة المرتفعة صغير: يلزم ${3 * t + 1} مم على الأقل، أو 0 لإلغائها.`)
        const Wf = W - 2 * t, Df = D - 2 * t, cable = Math.min(5, foot / 2 - 1, Wf / 6)
        bottom.engrave = [engraveRect(t, t, Wf, Df)]
        panels.push(
          { id: 'foot-front', name: 'القاعدة المرتفعة — الأمام', w: Wf, h: foot, left: 'male', right: 'male' },
          { id: 'foot-back', name: 'القاعدة المرتفعة — الخلف (فتحة الكابل)', w: Wf, h: foot, left: 'male', right: 'male', post: loops => { if (cable >= 2.5) edgeNotch(loops, Wf / 2, foot, cable) } },
          { id: 'foot-side', name: 'القاعدة المرتفعة — الجانب', w: Df, h: foot, left: 'female', right: 'female', count: 2 },
        )
        lampNotes.push(`القاعدة المرتفعة إطار ${Wf.toFixed(0)} × ${Df.toFixed(0)} × ${foot} مم يُلصق تحت القاعدة داخل الخط المحفور، وفي قطعته الخلفية فتحة يخرج منها الكابل.`)
      } else lampNotes.push('بلا قاعدة مرتفعة: صامولة الدواية تبرز تحت القاعدة، فعلّق الفانوس أو ضعه على قاعدة.')
      return {
        panels,
        notes: [
          'استعمل مصباح LED فقط (لا يسخن)؛ المصابيح المتوهّجة خطر داخل الخشب.',
          'الدواية تُثبّت في فتحة القاعدة بصامولتها؛ الغطاء يُرفع لتبديل المصباح.',
          ...lampNotes,
          'الزخرفة 1 دوائر، 2 شقوق عمودية، 3 نافذة واحدة تصلح لورق أو أكريليك حليبي من الداخل، 4 قلوب.',
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
    build: cylinderBuild('shade'),
  },
  // ------------------------------------------------------------------ 16
  {
    id: 'frame',
    name: 'فريم صور تقليدي',
    desc: 'إطار بطبقات: واجهة بدرجة زخرفية، فاصل تنزلق فيه الصورة من الأعلى، ظهر بفتحة تعليق وحامل مائل.',
    icon: `<rect x="10" y="6" width="44" height="52" rx="2"/><rect x="17" y="13" width="30" height="38" rx="1.5"/><rect x="21" y="17" width="22" height="30"/><path d="M24 40l6-8 5 6 3-3 5 5" stroke-width="1.5"/>`,
    params: [
      mm('pw', 'عرض الصورة', 30, 600, '10×15 سم = 102 × 152 مم، 13×18 = 127 × 178، A4 = 210 × 297'),
      mm('ph', 'ارتفاع الصورة', 30, 600),
      mm('border', 'عرض الإطار', 10, 150, 'الخشب الظاهر حول الصورة'),
      mm('ov', 'تغطية حافّة الصورة', 2, 20, 'كم يغطي الإطار من أطراف الصورة'),
      mm('step', 'درجة الحافّة', 0, 20, 'طبقة أمامية ثانية نافذتها أوسع، تعطي شكل الإطار التقليدي المتدرّج؛ 0 = بلا'),
      { key: 'shape', label: 'شكل النافذة', min: 1, max: 3, step: 1, int: true, hint: '1 = مستطيل، 2 = قوس، 3 = بيضاوي' },
      mm('wr', 'نصف قطر زوايا النافذة', 0, 40), mm('ocr', 'زوايا الإطار الخارجية', 0, 30),
      mm('glass', 'سماكة لوح الأكريليك الأمامي', 0, 6, 'يُقصّ من أكريليك شفّاف بحجم الصورة؛ 0 = بلا'),
      { key: 'deco', label: 'خط زخرفي محفور', min: 0, max: 1, step: 1, int: true, hint: '1 = خطّان محفوران حول النافذة وداخل الحافّة' },
      { key: 'hang', label: 'فتحة تعليق', min: 0, max: 1, step: 1, int: true },
      { key: 'stand', label: 'حامل خلفي', min: 0, max: 1, step: 1, int: true },
      { key: 'tilt', label: 'ميل الحامل', min: 5, max: 30, step: 1, unit: '°' },
    ],
    defaults: { pw: 102, ph: 152, border: 30, ov: 5, step: 5, shape: 1, wr: 4, ocr: 3, glass: 2, deco: 1, hang: 1, stand: 1, tilt: 15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { pw, ph, border, ov, glass, tilt } = p, t = c.t
      const step = p.step, shape = Math.round(p.shape)
      const ww = pw - 2 * ov, wh = ph - 2 * ov
      const Wo = round3(ww + 2 * border), Ho = round3(wh + 2 * border)
      if (border - ov < 6) errors.push(`الإطار أضيق من أن يمسك الصورة: عرض الإطار يجب أن يزيد على التغطية بـ 6 مم على الأقل (${ov + 6} مم).`)
      if (ww < 20 || wh < 20) errors.push('النافذة أصغر من 20 مم؛ قلّل التغطية أو كبّر الصورة.')
      const topStep = step > 0 && border - step >= 8
      if (step > 0 && !topStep) warnings.push('الدرجة أعرض من أن تبقى حولها حافّة؛ أُلغيت الطبقة الأمامية الثانية.')
      // the window shape is decided once, from the photo window, so every layer's window is concentric with it
      const arch = shape === 2 && wh > ww / 2 + 5
      if (shape === 2 && !arch) warnings.push('النافذة أعرض من أن تُقوَّس (يلزم أن يزيد ارتفاعها على نصف عرضها بـ 5 مم)؛ صارت مستطيلة.')
      const win = (x: number, y: number, w: number, h: number): Loop => {
        if (shape === 3) return ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 'hole')
        if (arch) return archHole(x, y, w, h)
        return roundedRectHole(x, y, w, h, Math.min(p.wr, w / 2, h / 2))
      }
      // the spacer holds the photo (and the acrylic cover): open at the top so the photo slides in
      const layers = Math.max(1, Math.ceil((glass + 0.5) / t))
      const ox = round3((Wo - pw - 1) / 2), oy = round3((Ho - ph - 1) / 2)
      // one outer corner radius for every layer, so the glued stack stays flush: no larger than the spacer's arms,
      // and small enough to leave 3 mm between the corner arc and each window's corner
      const cornerOf = (w: number, h: number) => shape === 3 ? Math.min(w, h) / 2 : arch ? 0 : Math.min(p.wr, w / 2, h / 2)
      const ocrFor = (inset: number, wr: number) => wr + (Math.SQRT2 * inset - 3) / (Math.SQRT2 - 1)
      const ocrMax = Math.min(ox - 0.5, ocrFor(Math.min(ox, oy), 0), ocrFor(border, cornerOf(ww, wh)),
        topStep ? ocrFor(border - step, cornerOf(ww + 2 * step, wh + 2 * step)) : Infinity)
      const ocr = Math.max(0, Math.min(p.ocr, Math.floor(ocrMax * 10) / 10))
      if (ocr < p.ocr) warnings.push(`زوايا الإطار الخارجية صُغّرت إلى ${ocr} مم لتبقى بينها وبين النافذة حافّة كافية.`)
      const rounded = (loops: Loop[]) => { if (ocr > 0) for (const [x, y] of [[0, 0], [Wo, 0], [Wo, Ho], [0, Ho]]) roundCorner(loops, x, y, ocr) }
      const deco = (gapIn: number): Loop[] => {
        if (!p.deco) return []
        const d = Math.min(4, (gapIn - 4) / 2)
        return [
          { ...win(gapIn - d, gapIn - d, Wo - 2 * gapIn + 2 * d, Ho - 2 * gapIn + 2 * d), layer: 'engrave' as const },
          { ...roundedRectHole(4, 4, Wo - 8, Ho - 8, Math.max(1, ocr - 2)), layer: 'engrave' as const },
        ]
      }
      const panels: PanelSpec[] = [
        { id: 'front', name: topStep ? 'الواجهة — الطبقة الداخلية' : 'الواجهة', w: Wo, h: Ho, post: rounded, holes: [win(border, border, ww, wh)], engrave: topStep ? [] : deco(border), note: 'تمسك أطراف الصورة' },
      ]
      if (topStep) panels.push({ id: 'front-top', name: 'الواجهة — الطبقة الخارجية', w: Wo, h: Ho, post: rounded, holes: [win(border - step, border - step, ww + 2 * step, wh + 2 * step)], engrave: deco(border - step), note: 'نافذتها أوسع بالدرجة فتظهر الحافّة متدرّجة' })
      panels.push({ id: 'spacer', name: 'الفاصل (مجرى الصورة)', w: Wo, h: Ho, count: layers, cuts: [rect(ox, 0, pw + 1, oy + ph + 1)], post: rounded, note: 'مفتوح من الأعلى لتنزلق فيه الصورة' })
      // the back: a keyhole in the empty band above the photo (the nail head sits in the spacer's slot), and the stand's slots
      const backHoles: Loop[] = []
      if (p.hang) {
        if (oy >= 19) backHoles.push(keyhole(Wo / 2, oy * 0.6, 4, 4, 7))
        else warnings.push('لا مكان لفتحة التعليق فوق الصورة؛ كبّر عرض الإطار أو علّقه بعلّاقة لاصقة.')
      }
      const hb = round3(Math.min(0.45 * Ho, 150)), tabL = Math.min(8, hb / 5), slots = [0.3, 0.75].map(k => round3(hb * k))
      const th = (tilt * Math.PI) / 180, b = 0.6 * hb
      const stack = (topStep ? 2 : 1) * t + layers * t + t
      if (p.stand) {
        // leaning back by θ the frame pivots on its rear bottom edge, and its centre of mass (half the height up, half the
        // stack in front of the back) must fall behind that edge, yet short of the stand's foot, or it stands up or tips over
        const R = Math.hypot(Ho, stack) / 2, phi = Math.atan2(stack, Ho), deg = (a: number) => (a * 180) / Math.PI
        const lo = Math.max(3, 0.03 * Ho), hi = 0.85 * b
        const behind = R * Math.sin(th - phi)
        if (behind < lo) errors.push(`بهذا الميل لا يستند الإطار إلى حامله بل يقف عمودياً (إطار سميك أو قصير)؛ اجعل الميل ${Math.ceil(deg(phi + Math.asin(Math.min(1, lo / R))))}° على الأقل.`)
        else if (behind > hi) errors.push(`بهذا الميل ينقلب الإطار إلى الخلف فوق قدم الحامل؛ اجعل الميل ${Math.floor(deg(phi + Math.asin(Math.min(1, hi / R))))}° أو أقل.`)
      }
      if (p.stand) for (const yc of slots) backHoles.push(rotatedRectHole(Wo / 2, Ho - hb + yc, t + 0.2, tabL + 0.2, 0))
      panels.push({ id: 'back', name: 'الظهر', w: Wo, h: Ho, post: rounded, holes: backHoles, note: p.stand ? 'فتحة التعليق في الأعلى وشقّا الحامل في الأسفل' : 'الظهر' })
      if (p.stand) {
        // the stand: a brace perpendicular to the back, its two tabs plugged into the back's slots; its foot edge lies on the table
        const pts = [
          { x: t, y: 0 }, { x: t + b * Math.cos(th), y: hb - b * Math.sin(th) }, { x: t, y: hb },
          ...[...slots].reverse().flatMap(yc => [{ x: t, y: yc + tabL / 2 }, { x: 0, y: yc + tabL / 2 }, { x: 0, y: yc - tabL / 2 }, { x: t, y: yc - tabL / 2 }]),
        ].map(v => ({ x: round3(v.x), y: round3(v.y) }))
        panels.push({ id: 'stand', name: 'الحامل', w: t + b * Math.cos(th), h: hb, shape: [polyLoop(pts, 'outer')], note: `لسانا الحامل يدخلان في شقّي الظهر؛ يميل الإطار ${tilt}°` })
      }
      const notes = [
        `الإطار ${Wo.toFixed(0)} × ${Ho.toFixed(0)} مم، سماكته ${stack.toFixed(1)} مم. النافذة ${ww.toFixed(0)} × ${wh.toFixed(0)} مم وتغطّي ${ov} مم من كل طرف من الصورة.`,
        `الترتيب من الخلف: الظهر، ثم الفاصل (${layers} ${layers > 1 ? 'طبقات' : 'طبقة'})، ثم الواجهة${topStep ? '، ثم الطبقة الخارجية' : ''}. ألصقها فوق بعض والحواف متطابقة.`,
        `الصورة ${pw} × ${ph} مم تنزلق من الأعلى في مجرى الفاصل (فراغه ${pw + 1} × ${ph + 1} مم).`,
      ]
      if (glass > 0) notes.push(`لوح الحماية: اقصّ لوح أكريليك شفّاف ${pw} × ${ph} مم بسماكة ${glass} مم، ويدخل أمام الصورة في المجرى نفسه.`)
      if (p.deco) notes.push('الخطوط الزرقاء حفر زخرفي على وجه الواجهة؛ شغّلها كطبقة حفر (Engrave/Score) بقدرة منخفضة.')
      if (p.stand) notes.push(`الحامل يُلصق بلسانيه في شقّي الظهر، ويستقرّ طرفه على الطاولة فيميل الإطار ${tilt}° إلى الخلف.`)
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 17
  {
    id: 'basket',
    name: 'سلة هدايا بقلوب ومقبض',
    desc: 'سلة مفتوحة جدرانها مزخرفة، يقطعها مقبض مستدير يُحمل باليد ويقسمها خانتين.',
    icon: `<path d="M10 34h44l-4 22H14z"/><path d="M18 34c0-18 28-18 28 0"/><path d="M24 26c2-8 14-8 16 0" stroke-width="1.5"/><path d="M22 44c0-2 3-2 3 0 0-2 3-2 3 0l-3 3zM36 44c0-2 3-2 3 0 0-2 3-2 3 0l-3 3z" fill="currentColor" stroke="none"/>`,
    params: [
      ...DIMS,
      mm('handleH', 'ارتفاع المقبض فوق الحافّة', 0, 200, '0 = بلا مقبض'),
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 7, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
      mm('cell', 'حجم الزخرفة', 5, 40),
      mm('margin', 'هامش أعلى شقّ المقبض', 3, 50), mm('fit', 'خلوص الشقّ', 0, 1),
    ],
    defaults: { W: 180, D: 120, H: 70, handleH: 70, pattern: 4, cell: 14, margin: 8, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, handleH, cell, fit } = p, t = c.t
      const kind = Math.round(p.pattern)
      const hd = H - t, sw = t + fit, margin = Math.min(p.margin, Math.max(2, hd / 3))
      if (handleH > 0 && handleH < 40) errors.push('ارتفاع المقبض قليل لتدخله اليد: 40 مم على الأقل، أو 0 بلا مقبض.')
      if (handleH > 0 && hd - FOOT - margin < 3 * t) errors.push('الارتفاع صغير جداً لشقّي المقبض.')
      const box = openBox(W, D, H)
      const fm = 2 * t + 2, top = 6, bot = H - t - fm
      const slotSkip = (x: number) => handleH > 0 && Math.abs(x - D / 2) < sw / 2 + cell / 2 + 2
      for (const sp of box) {
        if (kind > 0 && (sp.id === 'front' || sp.id === 'back')) sp.holes = pattern(kind, fm, top, W - fm, bot, cell)
        if (sp.id === 'side') {
          if (kind > 0) sp.holes = pattern(kind === 3 ? 1 : kind, fm, top, D - fm, bot, cell, slotSkip)
          if (handleH > 0) addSlots(sp, [D / 2], margin, hd - FOOT, sw, fit / 2)
        }
      }
      const panels: PanelSpec[] = [...box]
      if (handleH > 0) {
        const cl = t + 0.3, r = Math.min(handleH * 0.8, (W - 2 * cl) / 2 - 5)
        // a hole a hand goes through: 25–30 mm tall under a bar of at least 12 mm, as near 80 mm wide as the handle
        // allows while keeping 8 mm of wood between its ends and the rounded shoulders
        const hh = Math.min(30, Math.max(25, handleH * 0.4)), yc = Math.max(12, (handleH - hh) * 0.4) + hh / 2
        const webAt = (hw: number) => {
          const ex = W / 2 - hw / 2 + hh / 2, ax = cl + r, ay = r
          return (ex < ax && yc < ay ? r - Math.hypot(ex - ax, yc - ay) : Math.min(yc, ex - cl)) - hh / 2
        }
        let hw = Math.min(100, Math.max(80, (W - 2 * cl) * 0.45))
        while (hw > hh + 2 && webAt(hw) < 8) hw -= 1
        if (hw < 70) warnings.push(`فتحة اليد في المقبض ضيقة (${hw.toFixed(0)} × ${hh.toFixed(0)} مم) لا تتّسع لأربع أصابع؛ كبّر العرض.`)
        panels.push({
          id: 'handle', name: 'المقبض', w: W, h: handleH + hd,
          cuts: [rect(0, 0, cl, handleH + margin), rect(W - cl, 0, cl, handleH + margin), rect(0, handleH + hd - FOOT, t, FOOT), rect(W - t, handleH + hd - FOOT, t, FOOT)],
          holes: [stadium(W / 2, yc, hw, hh)],
          post: loops => { roundCorner(loops, round3(cl), 0, r); roundCorner(loops, round3(W - cl), 0, r) },
          note: 'يقف في منتصف السلة، وطرفاه في شقّي الجانبين',
        })
      }
      const notes = [
        handleH > 0 ? 'المقبض يقسم السلة خانتين؛ ركّب القاعدة والواجهتين، أنزل المقبض في الوسط، ثم أدخل الجانبين جانبياً فيدخل طرفا المقبض في شقّيهما، والصق.' : 'سلة مفتوحة بلا مقبض.',
        kind > 0 ? 'الزخرفة تبتعد عن أصابع التعشيق وعن شقّ المقبض؛ في الأكريليك اجعل حجم الزخرفة 10 مم أو أكثر.' : 'جدران بلا زخرفة.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 18
  {
    id: 'napkin',
    name: 'حامل مناديل',
    desc: 'قاعدة ولوحان متقابلان مزخرفان بزوايا مستديرة، يدخلان في شقوق القاعدة بلسانات.',
    icon: `<path d="M8 50h48v6H8z"/><path d="M16 50V24c0-8 10-12 16-12s16 4 16 12v26"/><path d="M22 50V28c0-5 6-8 10-8s10 3 10 8v22" stroke-width="1.5"/><path d="M29 32c0-2 3-2 3 0 0-2 3-2 3 0l-3 3z" fill="currentColor" stroke="none"/>`,
    params: [
      mm('W', 'الطول', 60, 400), mm('D', 'عمق القاعدة', 40, 200), mm('H', 'ارتفاع اللوحين', 40, 300),
      mm('sep', 'المسافة بين اللوحين', 10, 100, 'سماكة رزمة المناديل'),
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 7, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
      mm('cell', 'حجم الزخرفة', 5, 40), mm('fit', 'خلوص الشقّ', 0, 1),
    ],
    defaults: { W: 170, D: 80, H: 110, sep: 35, pattern: 4, cell: 14, fit: 0.2 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, sep, cell, fit } = p, t = c.t
      const kind = Math.round(p.pattern)
      const inset = 5, Wu = round3(W - 2 * inset), tabL = round3(Math.min(25, Wu * 0.18))
      const tabX = [0.25, 0.75].map(k => round3(Wu * k))
      const planes = [D / 2 - sep / 2 - t / 2, D / 2 + sep / 2 + t / 2]
      if (planes[0] - (t + fit) / 2 < 6) errors.push(`القاعدة ضيقة على هذه المسافة: يلزم عمق ${Math.ceil(sep + 2 * t + fit + 12)} مم على الأقل.`)
      const R = Math.min(Wu / 4, H / 3)
      const holes = kind > 0 ? pattern(kind, Math.max(12, R * 0.7), 12, Wu - Math.max(12, R * 0.7), H - 15, cell) : []
      const panels: PanelSpec[] = [
        {
          id: 'base', name: 'القاعدة', w: W, h: D,
          holes: planes.flatMap(y => tabX.map(x => rotatedRectHole(inset + x, y, tabL + fit, t + fit, 0))),
          post: loops => { for (const [x, y] of [[0, 0], [W, 0], [W, D], [0, D]]) roundCorner(loops, x, y, Math.min(6, D / 6)) },
          note: 'شقوق اللسانات بين اللوحين',
        },
        {
          id: 'upright', name: 'اللوح القائم', w: Wu, h: H + t, count: 2,
          // a t-deep strip under the panel, cut away everywhere except the two tabs
          cuts: [rect(0, H, tabX[0] - tabL / 2, t), rect(tabX[0] + tabL / 2, H, tabX[1] - tabX[0] - tabL, t), rect(tabX[1] + tabL / 2, H, Wu - tabX[1] - tabL / 2, t)],
          holes,
          post: loops => { roundCorner(loops, 0, 0, R); roundCorner(loops, Wu, 0, R) },
          note: 'لسانان في الأسفل يدخلان في شقوق القاعدة',
        },
      ]
      return {
        panels,
        notes: [
          `اللوحان ${Wu} × ${H} مم يقفان متقابلين وبينهما ${sep} مم للمناديل؛ ألصق لساناتهما في شقوق القاعدة.`,
          'المناديل المطوية مربّعة عادةً 160 × 160 مم مطويّة إلى النصف؛ اجعل الطول أكبر من عرضها بـ 10 مم.',
        ],
        warnings, errors,
      }
    },
  },
  // ------------------------------------------------------------------ 19
  {
    id: 'teahouse',
    name: 'بيت الشاي',
    desc: 'موزّع أكياس شاي على شكل بيت: سقف جمالوني يُرفع للتعبئة، قلب في الجملون، وفتحة في الأسفل تُسحب منها الأكياس.',
    icon: `<path d="M10 28 32 8l22 20"/><path d="M14 26v30h36V26"/><path d="M20 48h24v6H20z"/><path d="M29 20c0-2 3-2 3 0 0-2 3-2 3 0l-3 3z" fill="currentColor" stroke="none"/>`,
    params: [
      mm('W', 'العرض', 50, 300), mm('D', 'العمق', 50, 300), mm('H', 'ارتفاع الجدار', 50, 400, 'حتى بداية السقف'),
      mm('g', 'ارتفاع الجملون', 15, 150, 'من حافّة الجدار إلى قمّة السقف'),
      mm('ov', 'بروز السقف', 0, 30), mm('slotH', 'ارتفاع فتحة الأكياس', 10, 40),
      mm('bag', 'عرض كيس الشاي', 30, 150, 'المغلّفات عادةً 65–75 مم؛ الفتحة والداخل يتّسعان له'),
      mm('gap', 'خلوص السقف', 0.2, 2),
      { key: 'pattern', label: 'زخرفة الجانبين', min: 0, max: 7, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
      mm('cell', 'حجم الزخرفة', 5, 40),
    ],
    defaults: { W: 90, D: 90, H: 120, g: 45, ov: 8, slotH: 18, bag: 72, gap: 0.5, pattern: 4, cell: 12 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const t = c.t, W = round3(p.W), D = round3(p.D), H = round3(p.H), g = round3(p.g)
      const { ov, slotH, gap, cell, bag } = p
      const kind = Math.round(p.pattern)
      if (H < slotH + 6 * t + 20) errors.push(`الجدار قصير على فتحة الأكياس: يلزم ${Math.ceil(slotH + 6 * t + 20)} مم على الأقل.`)
      // the bags lie flat inside and the bottom one slides out through the front slot, which must be wider than a bag
      const web = Math.max(4, t), slotX = t + web, slotW = round3(W - 2 * slotX)
      if (slotW < bag + 2) errors.push(`فتحة الأكياس (${slotW.toFixed(0)} مم) أضيق من الكيس: يلزم عرض ${Math.ceil(bag + 2 + 2 * slotX)} مم على الأقل.`)
      if (D - 2 * t < bag + 1) errors.push(`العمق من الداخل أصغر من الكيس: يلزم عمق ${Math.ceil(bag + 1 + 2 * t)} مم على الأقل.`)
      // the roof: two plates resting on the gables' slopes, joined at the ridge; two triangles under it
      // (just inside the front and back walls) keep it in place, so it lifts off for refilling
      const Ls = Math.hypot(W / 2, g), th = Math.atan2(g, W / 2)
      // at the ridge the short plate butts under the long one. Square-cut ends meet exactly when the long plate runs
      // t/sin 2θ past the apex and, on a slope under 45°, the short one stops t·cot 2θ short of it (at 45° both terms are t and 0)
      const over = t / Math.sin(2 * th), short = th < Math.PI / 4 ? t / Math.tan(2 * th) : 0
      // steeper than 45° the short plate cannot pass the apex (its lower corner would run into the long plate), so a
      // V-groove t·|cot 2θ| wide stays open along the ridge; the locating triangles still hold the two plates together
      const groove = th > Math.PI / 4 ? -t / Math.tan(2 * th) : 0
      if (groove >= 0.5) warnings.push(`السقف أشدّ انحداراً من 45°، فيبقى على طول القمّة شقّ على شكل V عرضه نحو ${groove.toFixed(1)} مم (القصّ المستقيم لا يغلقه، ومثلّثا التثبيت يمسكان اللوحين). لقمّة مغلقة اجعل ارتفاع الجملون ${Math.floor(W / 2)} مم أو أقل.`)
      const Wi = W - 2 * t - 2 * gap, hi = (g * Wi) / W
      if (hi < 8) errors.push('الجملون منخفض جداً ليحمل مثلّثَي تثبيت السقف؛ زد ارتفاعه.')
      const gable = (id: string, name: string, front: boolean): PanelSpec => {
        const holes: Loop[] = []
        const hr = Math.min(g * 0.55, W * 0.3)
        if (hr >= 10) holes.push(heart(W / 2, g * 0.6, hr))
        const slotTop = g + H - t - 2 - slotH // 2 mm above the floor, so the bottom bag slides out
        if (front) holes.push(roundedRectHole(slotX, slotTop, slotW, slotH, 3))
        return {
          id, name, w: W, h: g + H,
          bottom: 'female', left: { type: 'male', from: g, len: H }, right: { type: 'male', from: g, len: H },
          cuts: [rect(0, 0, W, g)], holes,
          post: loops => peakSegments(loops, g, 0),
          note: front ? 'الواجهة: قلب في الجملون وفتحة الأكياس في الأسفل' : 'الخلف: قلب في الجملون',
        }
      }
      const fm = 2 * t + 2
      const sideHoles = kind > 0 ? pattern(kind, fm, 8, D - fm, H - t - fm, cell) : []
      const shingles = (len: number): Loop[] => {
        const out: Loop[] = []
        for (let x = 10; x < len - 4; x += 10) out.push({ closed: false, layer: 'engrave', pts: [{ x, y: 3 }, { x, y: D + 2 * ov - 3 }] })
        return out
      }
      const La = round3(Ls + ov + over), Lb = round3(Ls + ov - short), keyAt = ov + t + gap
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        gable('front', N.front, true), gable('back', N.back, false),
        { id: 'side', name: N.side, w: D, h: H, bottom: 'female', left: 'female', right: 'female', count: 2, holes: sideHoles },
        { id: 'roof-a', name: 'السقف — اللوح الطويل', w: La, h: D + 2 * ov, engrave: shingles(La), note: 'يتجاوز القمّة ليغطّي طرف اللوح القصير' },
        { id: 'roof-b', name: 'السقف — اللوح القصير', w: Lb, h: D + 2 * ov, engrave: shingles(Lb), note: 'طرفه العلوي يدخل تحت اللوح الطويل عند القمّة' },
        {
          id: 'roof-key', name: 'مثلّث تثبيت السقف', w: Wi, h: hi, count: 2,
          shape: [polyLoop([{ x: 0, y: round3(hi) }, { x: round3(Wi / 2), y: 0 }, { x: round3(Wi), y: round3(hi) }], 'outer')],
          note: `يُلصق في زاوية السقف من الداخل على بُعد ${keyAt.toFixed(1)} مم من الحافّة`,
        },
      ]
      const notes = [
        `البيت ${W} × ${D} مم، جداره ${H} مم والجملون ${g} مم؛ الارتفاع الكلّي نحو ${Math.round(H + g + t)} مم.`,
        'الأكياس تُرصّ داخل البيت فوق بعضها، ويُسحب الكيس السفلي من الفتحة الأمامية.',
        `السقف: ضع اللوحين على الجملونين، وادفع القصير إلى أعلى حتى يلتقي طرفه باللوح الطويل، واجعل بروز الطويل عند حافّته السفلية مثل بروز القصير (${ov} مم)، ثم ألصقهما عند القمّة.`,
        `بعد الجفاف اقلب السقف على الطاولة، وأنزل مثلّثَي التثبيت في زاويته من الداخل، كلّ واحد على بُعد ${keyAt.toFixed(1)} مم من حافّة السقف الجانبية، وألصقهما؛ يقعان داخل الواجهة والخلف تماماً، فيُرفع السقف كاملاً للتعبئة.`,
        'الخطوط الزرقاء على السقف حفر يشبه القرميد؛ شغّلها بقدرة منخفضة.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 20
  {
    id: 'fence',
    name: 'صندوق السياج',
    desc: 'سلة مفتوحة جدرانها أعمدة سياج مدبّبة فوق حزام متين، وعمود في كل زاوية.',
    icon: `<path d="M10 56h44"/><path d="M12 56V22l3-4 3 4v34M22 56V22l3-4 3 4v34M32 56V22l3-4 3 4v34M42 56V22l3-4 3 4v34" stroke-width="1.5"/><path d="M10 40h44"/>`,
    params: [
      ...DIMS,
      mm('picket', 'عرض العمود', 5, 40), mm('pgap', 'الفراغ بين الأعمدة', 3, 40),
      mm('pickH', 'طول الأعمدة', 10, 200, 'فوق الحزام، مع الرأس'), mm('point', 'الرأس المدبّب', 0, 20, '0 = رؤوس مستوية'),
    ],
    defaults: { W: 160, D: 110, H: 75, picket: 10, pgap: 6, pickH: 32, point: 6 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, picket, pgap } = p, t = c.t
      const pickH = round3(p.pickH), point = round3(Math.min(p.point, picket * 0.9, pickH - 4))
      // the belt's corner fingers: the bottom one also loses the base's notch, so it must reach well past the thickness
      const neck = Math.max(1.5, 0.3 * t), rail = H - pickH, rf = rail / fingerCount(rail, c.finger)
      if (rail < 3 * t + 4 || rf - t < neck) errors.push(`الحزام تحت الأعمدة ضيّق على أصابع التعشيق: اجعل الارتفاع ${Math.ceil(pickH + Math.max(3 * t + 4, 3 * (t + neck)))} مم أو أكثر، أو قصّر الأعمدة${rf - t < neck && rail >= 3 * (t + neck) ? '، أو كبّر عرض الأصبع' : ''}.`)
      if (p.point > picket * 0.9) warnings.push('الرأس المدبّب أطول من عرض العمود؛ قُصّر.')
      // pickets spread over [a, b] with one at each end
      let thinnest = Infinity
      const gaps = (a: number, b: number): ReturnType<typeof rect>[] => {
        const len = b - a, n = Math.max(2, Math.round((len + pgap) / (picket + pgap)))
        const pw = (len - (n - 1) * pgap) / n
        if (pw < 4) return []
        thinnest = Math.min(thinnest, pw)
        return Array.from({ length: n - 1 }, (_, i) => rect(round3(a + (i + 1) * pw + i * pgap), 0, round3(pgap), pickH))
      }
      const wall = (id: string, name: string, w: number, male: boolean, count: number): PanelSpec => {
        const ends = male ? [] : [rect(0, 0, t, pickH), rect(w - t, 0, t, pickH)] // the corner post belongs to the front and back walls
        const span = male ? gaps(0, w) : gaps(t, w - t)
        if (!span.length) errors.push('الأعمدة أعرض من الجدار؛ صغّر عرض العمود أو الفراغ.')
        return {
          id, name, w, h: H, count, bottom: 'female',
          left: { type: male ? 'male' : 'female', from: pickH, len: H - pickH }, right: { type: male ? 'male' : 'female', from: pickH, len: H - pickH },
          cuts: [...(point > 0 ? [rect(0, 0, w, point)] : []), ...span, ...ends],
          post: loops => { if (point > 0) peakSegments(loops, point, 0, 2) },
        }
      }
      const panels: PanelSpec[] = [
        { id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' },
        wall('frontback', `${N.front} / ${N.back}`, W, true, 2),
        wall('side', N.side, D, false, 2),
      ]
      if (pickH > 15 * thinnest) warnings.push(`الأعمدة نحيلة (${thinnest.toFixed(1)} × ${pickH} مم) وتنكسر بسهولة؛ عرّضها أو قصّرها (الطول حتى 15 ضعف العرض).`)
      return { panels, notes: ['الواجهتان تحملان عمود الزاوية، والجانبان يبدأان بعده؛ الحزام السفلي يحمل التعشيق.'], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 21
  {
    id: 'decobox',
    name: 'صندوق مزخرف بغطاء',
    desc: 'صندوق هدايا جدرانه وغطاؤه شبكة زخرفية، بغطاء ذي شفة ومقبض اختياري فوقه.',
    icon: `<path d="M12 30 32 20 52 30 32 40z"/><path d="M12 30v14l20 10V40M52 30v14L32 54"/><path d="M17 36l4 2M17 42l4 2M24 40l4 2M24 46l4 2M43 36l4-2M43 42l4-2M36 40l4-2M36 46l4-2" stroke-width="1.5"/><path d="M26 25c0-6 12-6 12 0" stroke-width="2.5"/>`,
    params: [
      ...DIMS,
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 7, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
      mm('cell', 'حجم الزخرفة', 5, 40),
      { key: 'lidDeco', label: 'زخرفة الغطاء', min: 0, max: 1, step: 1, int: true },
      { key: 'handle', label: 'مقبض فوق الغطاء', min: 0, max: 1, step: 1, int: true },
      mm('lipH', 'ارتفاع الشفة', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2), mm('fit', 'خلوص شقّي المقبض', 0, 1),
    ],
    defaults: { W: 160, D: 110, H: 70, pattern: 5, cell: 12, lidDeco: 1, handle: 1, lipH: 10, gap: 0.5, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, cell, lipH, gap, fit } = p, t = c.t
      const kind = Math.round(p.pattern)
      const handle = p.handle > 0
      const hw = round3(Math.min(W * 0.55, 100)), hH = round3(Math.min(36, Math.max(24, hw * 0.35))), tabL = round3(Math.min(18, hw / 5))
      const { panels, notes } = lipLidBox(p, c, errors, handle ? hH : 0)
      const fm = 2 * t + 2, top = lipH + 2, bot = H - t - fm
      if (kind > 0) for (const sp of panels) {
        if (sp.id === 'front' || sp.id === 'back') sp.holes = pattern(kind, fm, top, W - fm, bot, cell)
        if (sp.id === 'side') sp.holes = pattern(kind, fm, top, D - fm, bot, cell)
      }
      const lid = panels.find(x => x.id === 'lid')!
      const lidHoles: Loop[] = []
      const m = 2 * t + gap + 3 // inside the lip frame
      const tabX = [round3(hw * 0.2), round3(hw * 0.8)]
      if (handle) for (const x of tabX) lidHoles.push(rotatedRectHole(W / 2 - hw / 2 + x, D / 2, tabL + fit, t + fit, 0))
      if (p.lidDeco > 0 && kind > 0) {
        const band = handle ? (t + fit) / 2 + cell / 2 + 4 : 0
        if (handle) lidHoles.push(...pattern(kind, m, m, W - m, D / 2 - band, cell), ...pattern(kind, m, D / 2 + band, W - m, D - m, cell))
        else lidHoles.push(...pattern(kind, m, m, W - m, D - m, cell))
      }
      lid.holes = lidHoles
      if (handle) {
        const R = Math.min(hH * 0.7, hw / 4)
        panels.push({
          id: 'handle', name: 'مقبض الغطاء', w: hw, h: hH + t,
          cuts: [rect(0, hH, tabX[0] - tabL / 2, t), rect(tabX[0] + tabL / 2, hH, tabX[1] - tabX[0] - tabL, t), rect(tabX[1] + tabL / 2, hH, hw - tabX[1] - tabL / 2, t)],
          holes: hH >= 24 ? [stadium(hw / 2, hH * 0.5, Math.min(hw * 0.5, 70), Math.min(14, hH * 0.42))] : [],
          post: loops => { roundCorner(loops, 0, 0, R); roundCorner(loops, hw, 0, R) },
          note: 'لسانا المقبض يدخلان في شقّي الغطاء',
        })
      }
      const extra = [
        kind > 0 ? 'الزخرفة تبتعد عن أصابع التعشيق وعن موضع الشفة؛ في الأكريليك اجعل حجمها 10 مم أو أكثر.' : '',
        handle ? 'المقبض: ألصق لسانيه في شقّي الغطاء.' : '',
        p.lidDeco > 0 && kind > 0 ? 'زخرفة الغطاء داخل إطار الشفة، فلا تتعارض مع لصقه.' : '',
      ].filter(Boolean)
      return { panels, notes: [...extra, ...notes], warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 22
  {
    id: 'roundbox',
    name: 'علبة دائرية',
    desc: 'علبة أسطوانية: جدار بمفصل مرن يلتفّ حول قاع مغلق وحافّة علوية، بلسانات في شقوقهما.',
    icon: `<ellipse cx="32" cy="16" rx="20" ry="7"/><path d="M12 16v30c0 4 9 7 20 7s20-3 20-7V16"/><path d="M18 24v14M24 26v14M30 26v14M36 26v14M42 26v14M48 24v14" stroke-width="1.5"/>`,
    params: [
      mm('Dm', 'القطر الخارجي', 40, 600), mm('H', 'الارتفاع', 30, 600),
      { key: 'tabs', label: 'عدد اللسانات', min: 3, max: 24, step: 1, int: true, hint: 'في كل حافّة' },
      mm('tabW', 'عرض اللسان', 4, 40), mm('fit', 'خلوص اللسان', 0, 1),
      mm('seg', 'طول قصّة المفصل', 5, 80), mm('bridge', 'الجسر بين القصّات', 1, 10), mm('pitch', 'المسافة بين الصفوف', 0.6, 6),
    ],
    defaults: { Dm: 120, H: 80, tabs: 8, tabW: 10, fit: 0.2, seg: 18, bridge: 3, pitch: 1.5 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build: cylinderBuild('roundbox'),
  },
  // ------------------------------------------------------------------ 23
  {
    id: 'chest',
    name: 'صندوق مزخرف بأرجل',
    desc: 'صندوق بجدران مخرّمة يقف على أربع أرجل منحنية هي امتداد زواياه، بقاع معلّق على لسانات وغطاء مخرّم ذي شفة.',
    icon: `<path d="M10 20h44v8H10z"/><path d="M12 28v20h40V28"/><path d="M12 48v8c3 0 5-3 6-6h28c1 3 3 6 6 6v-8" stroke-width="2"/><path d="M20 34l3 3-3 3-3-3zM32 34l3 3-3 3-3-3zM44 34l3 3-3 3-3-3z" stroke-width="1.5"/><path d="M18 24h28" stroke-width="1.5"/>`,
    params: [
      ...DIMS.map(d => d.key === 'H' ? { ...d, hint: 'ارتفاع الجسم فوق الأرجل' } : d),
      mm('legH', 'طول الأرجل', 8, 80), mm('legW', 'عرض الرجل', 10, 60),
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 7, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
      mm('cell', 'حجم الزخرفة', 6, 40),
      { key: 'lidDeco', label: 'زخرفة الغطاء', min: 0, max: 1, step: 1, int: true },
      mm('lipH', 'ارتفاع الشفة', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2), mm('fit', 'خلوص لسانات القاع', 0, 1),
    ],
    defaults: { W: 200, D: 130, H: 100, legH: 22, legW: 24, pattern: 6, cell: 16, lidDeco: 1, lipH: 10, gap: 0.5, fit: 0.15 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, legH, cell, lipH, gap, fit } = p, t = c.t
      const kind = Math.round(p.pattern)
      const Ht = round3(H + legH)
      // the walls run down past the floor to make the legs; the floor hangs on tabs through slots just above them
      const web = Math.max(4, 1.5 * t), lw = Math.max(p.legW, 3 * t + 4)
      if (legH < web + 8) errors.push(`الأرجل قصيرة: ${Math.ceil(web + 8)} مم على الأقل.`)
      if (2 * lw + 20 > Math.min(W, D)) errors.push(`الأرجل عريضة على هذا الصندوق: أقصى عرض ${Math.floor((Math.min(W, D) - 20) / 2)} مم.`)
      if (lipH < 3 * t) errors.push(`ارتفاع الشفة صغير جداً: يلزم ${3 * t} مم على الأقل لتعشيق زوايا الإطار.`)
      if (lipH > H - 2 * t - 4) errors.push('ارتفاع الشفة أكبر من عمق الصندوق.')
      // floor tabs: two per edge (three on long edges), clear of the corner joints
      const tabsOn = (len: number) => {
        const inner = len - 2 * t, tw = round3(Math.min(30, Math.max(8, inner * 0.14)))
        const ks = inner > 220 ? [0.2, 0.5, 0.8] : [0.25, 0.75]
        return { tw, xs: ks.map(k => round3(t + inner * k)) }
      }
      const tw = tabsOn(W), td = tabsOn(D)
      const strip = (len: number, tabs: { tw: number; xs: number[] }, at: (a: number, b: number) => ReturnType<typeof rect>) => {
        const out: ReturnType<typeof rect>[] = []
        let a = 0
        for (const x of tabs.xs) { out.push(at(a, x - tabs.tw / 2)); a = x + tabs.tw / 2 }
        out.push(at(a, len))
        return out
      }
      const floor: PanelSpec = {
        id: 'floor', name: 'القاع (معلّق باللسانات)', w: W, h: D,
        cuts: [
          ...strip(W, tw, (a, b) => rect(a, 0, b - a, t)), ...strip(W, tw, (a, b) => rect(a, D - t, b - a, t)),
          ...strip(D, td, (a, b) => rect(0, a, t, b - a)), ...strip(D, td, (a, b) => rect(W - t, a, t, b - a)),
        ],
        note: 'لساناته تدخل في شقوق الجدران فوق الأرجل',
      }
      const slotY = round3(H - t / 2)
      const wall = (id: string, name: string, w: number, male: boolean, tabs: { tw: number; xs: number[] }, count: number): PanelSpec => {
        const holes = tabs.xs.map(x => rotatedRectHole(x, slotY, tabs.tw + fit, t + fit, 0))
        if (kind > 0) {
          const fm = 2 * t + 2
          holes.push(...pattern(kind, fm, lipH + 3, w - fm, H - t - fm, cell))
        }
        const apronTop = round3(H + web)
        return {
          id, name, w, h: Ht, count,
          left: male ? 'male' : 'female', right: male ? 'male' : 'female',
          cuts: [rect(lw, apronTop, w - 2 * lw, Ht - apronTop)],
          holes,
          // curved brackets: the apron's top corners rounded deep, the feet's outer corners softened
          post: loops => {
            const r = Math.min(Ht - apronTop - 1, (w - 2 * lw) / 3)
            roundCorner(loops, round3(lw), apronTop, r); roundCorner(loops, round3(w - lw), apronTop, r)
          },
        }
      }
      // the lid: a plate with a lip frame glued under it (as the lidded gift box)
      const Wl = W - 2 * t - 2 * gap, Dl = D - 2 * t - 2 * gap
      const m = 2 * t + gap + 3
      const lidHoles = p.lidDeco > 0 && kind > 0 ? pattern(kind, m, m, W - m, D - m, cell) : []
      const panels: PanelSpec[] = [
        floor,
        wall('frontback', `${N.front} / ${N.back}`, W, true, tw, 2),
        wall('side', N.side, D, false, td, 2),
        { id: 'lid', name: 'الغطاء — اللوح', w: W, h: D, holes: lidHoles, engrave: [engraveRect(t + gap, t + gap, Wl, Dl)], note: 'الخط المحفور موضع إطار الشفة على وجهه السفلي' },
        { id: 'lip-fb', name: 'شفة الغطاء — الأمام / الخلف', w: Wl, h: lipH, left: 'male', right: 'male', count: 2 },
        { id: 'lip-side', name: 'شفة الغطاء — الجانب', w: Dl, h: lipH, left: 'female', right: 'female', count: 2 },
      ]
      const notes = [
        `الصندوق ${W} × ${D} مم، جسمه ${H} مم فوق أرجل ${legH} مم؛ الارتفاع الكلّي مع الغطاء ${Math.round((Ht + t) * 10) / 10} مم.`,
        'التركيب: ركّب الواجهتين مع جانب واحد، أنزل القاع فتدخل لساناته في الشقوق، ثم أدخل الجانب الثاني؛ تعشيق الزوايا يمتدّ في الأرجل فتصبح أعمدة متينة.',
        `إطار الشفة ${Wl.toFixed(1)} × ${Dl.toFixed(1)} × ${lipH} مم يُلصق تحت الغطاء داخل الخط المحفور، ويدخل في الصندوق بخلوص ${gap} مم.`,
        kind > 0 ? 'الزخرفة الهندسية تبتعد عن التعشيق والشقوق؛ في الأكريليك اجعل حجمها 12 مم أو أكثر. الزخارف العربية المرسومة يدوياً تُستورد في RDWorks فوق القطعة.' : 'جدران بلا زخرفة.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  // ------------------------------------------------------------------ 24
  {
    id: 'catbank',
    name: 'حصّالة القطّة بقفل الذيل',
    desc: 'قطّة أسطوانية مستلقية على أرجلها: شقّ للنقود في ظهرها، وتُفتح من الخلف بلفّ ذيلها ربع دورة (قفل بايونيت).',
    icon: `<circle cx="22" cy="32" r="14"/><path d="M11 22l2-10 7 6M33 22l-2-10-7 6"/><path d="M22 18h26a14 14 0 0 1 0 28H22"/><path d="M36 18v-5" stroke-width="2.5"/><path d="M18 30h.1M26 30h.1" stroke-width="3"/><path d="M28 50v6M44 50v6" stroke-width="2.5"/><path d="M58 30c5-2 4-9-1-8" stroke-width="2"/>`,
    params: [
      mm('Dm', 'قطر الجسم', 80, 300), mm('H', 'طول الجسم', 80, 400),
      mm('slotL', 'طول شقّ النقود', 20, 80, 'يكفي 34 مم للقطع حتى 30 مم وللورقة المطويّة'),
      mm('slotW', 'عرض شقّ النقود', 2.5, 8),
      mm('hole', 'فتحة إخراج النقود', 30, 90, 'في الظهر، يسدّها قفل يُدار بالذيل'),
      mm('legH', 'طول الأرجل', 10, 60),
      { key: 'tabs', label: 'عدد اللسانات', min: 3, max: 24, step: 1, int: true, hint: 'في كل حافّة' },
      mm('tabW', 'عرض اللسان', 4, 40), mm('fit', 'خلوص اللسان والقفل', 0, 1),
      mm('seg', 'طول قصّة المفصل', 5, 80), mm('bridge', 'الجسر بين القصّات', 1, 10), mm('pitch', 'المسافة بين الصفوف', 0.6, 6),
    ],
    defaults: { Dm: 120, H: 150, slotL: 34, slotW: 4, hole: 44, legH: 20, tabs: 6, tabW: 10, fit: 0.2, seg: 18, bridge: 3, pitch: 1.5 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { H, slotL, slotW, fit, legH } = p, t = c.t
      const Dm0 = p.Dm + (c.inner ? 2 * t : 0)
      const r3 = (v: { x: number; y: number }) => ({ x: round3(v.x), y: round3(v.y) })
      // the coin slot runs along the cat's back, in a band of the sheet left without hinge cuts
      const L0 = 2 * Math.PI * (Dm0 / 2 - t / 2), zone = { x: round3(L0 / 2), w: slotW + 2 * Math.max(6, 2 * t) }
      const { Dm, Rmid, Rring, L, cx, seam, slots, sheet } = cylinderCore(p, c, warnings, errors, 0, zone)
      if (slotL > H - 20) errors.push(`شقّ النقود أطول من الجسم؛ أقصاه ${Math.floor(H - 20)} مم.`)
      // the lock: a round opening with two notches in the back disc; a plug of three discs (a keyed disc that passes the
      // notches, a spacer as thick as the wall, a cap) is turned a quarter turn by the tail so the keys sit behind the wall
      const rh = p.hole / 2, e = Math.max(8, p.hole * 0.22), d = Math.max(4, t + 1)
      if (rh + d + 3 > Dm / 2 - t) errors.push(`فتحة الإخراج كبيرة على هذا القطر؛ أقصاها ${Math.floor(2 * (Dm / 2 - t - d - 3))} مم.`)
      const keyed = (r: number, half: number, reach: number, as: 'outer' | 'hole'): Loop => {
        const dl = Math.asin(Math.min(0.99, half / r)), pts: { x: number; y: number }[] = []
        for (const E of [0, Math.PI]) {
          const a0 = E + dl, a1 = E + Math.PI - dl, steps = Math.ceil((a1 - a0) / (Math.PI / 60))
          for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps; pts.push({ x: cx + r * Math.cos(a), y: cx + r * Math.sin(a) }) }
          // the next notch, centred on the angle E + π, its sides parallel
          const F = E + Math.PI, u = { x: Math.cos(F), y: Math.sin(F) }, v = { x: -Math.sin(F), y: Math.cos(F) }
          const at = (a: number, b: number) => ({ x: cx + a * u.x + b * v.x, y: cx + a * u.y + b * v.y })
          pts.push(at(reach, -half), at(reach, half))
        }
        return polyLoop(pts.map(r3), as)
      }
      // the face: the back disc's outline with two pointed ears; eyes and a heart nose cut, mouth and whiskers engraved
      const earAt = (32 * Math.PI) / 180, earHalf = (14 * Math.PI) / 180, earLen = 0.2 * Dm
      const tipAt = (side: number) => { const a = -Math.PI / 2 + side * (earAt - 0.08); return r3({ x: cx + (Rring + earLen) * Math.cos(a), y: cx + (Rring + earLen) * Math.sin(a) }) }
      const tips = [tipAt(-1), tipAt(1)]
      const faceOutline = (): Loop => {
        const pts: { x: number; y: number }[] = [], up = -Math.PI / 2
        const arc = (a0: number, a1: number) => { const k = Math.ceil((a1 - a0) / (Math.PI / 60)); for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; pts.push({ x: cx + Rring * Math.cos(a), y: cx + Rring * Math.sin(a) }) } }
        arc(up + earAt + earHalf, up - earAt - earHalf + 2 * Math.PI) // the round of the head, right ear to left ear the long way
        pts.push(tips[0])
        arc(up - earAt + earHalf, up + earAt - earHalf)                 // between the ears
        pts.push(tips[1])
        return polyLoop(pts.map(r3), 'outer')
      }
      const er = Math.max(3, 0.04 * Dm), ey = cx - 0.12 * Dm, ex = 0.19 * Dm, ny = cx + 0.05 * Dm, nw = Math.max(8, 0.1 * Dm)
      const mouthY = ny + 0.475 * nw, mw = 0.07 * Dm
      const line = (x0: number, y0: number, x1: number, y1: number): Loop => ({ closed: false, pts: [r3({ x: x0, y: y0 }), r3({ x: x1, y: y1 })] })
      const whiskers = [-1, 1].flatMap(sd => [-0.04, 0, 0.04].map(k => line(cx + sd * 0.12 * Dm, ny + k * Dm * 0.6, cx + sd * 0.3 * Dm, ny + k * Dm * 1.6)))
      const mouth: Loop[] = [-1, 1].map(sd => ({ closed: false, pts: [r3({ x: cx, y: mouthY }), { ...r3({ x: cx + sd * mw, y: mouthY }) }].map((v, i) => i === 0 ? { ...v, b: sd * 0.6 } : v) }))
      // the inside of each ear, engraved: the ear triangle shrunk towards its middle
      const innerEars: Loop[] = [-1, 1].map((side, i) => {
        const at = (a: number) => ({ x: cx + Rring * Math.cos(a), y: cx + Rring * Math.sin(a) })
        const E = -Math.PI / 2 + side * earAt, tri = [at(E - earHalf), tips[i], at(E + earHalf)]
        const g = { x: (tri[0].x + tri[1].x + tri[2].x) / 3, y: (tri[0].y + tri[1].y + tri[2].y) / 3 }
        return { closed: true, pts: tri.map(v => r3({ x: g.x + 0.5 * (v.x - g.x), y: g.y + 0.5 * (v.y - g.y) })) }
      })
      const face: PanelSpec = {
        id: 'face', name: 'الوجه (الأمام)', w: 2 * Rring, h: Rring + cx + earLen, shape: [faceOutline()],
        holes: [circle(cx - ex, ey, er), circle(cx + ex, ey, er), heart(cx, ny, nw), ...slots],
        engrave: [...whiskers, ...mouth, ...innerEars],
        note: 'أذنان مدبّبتان، عينان وأنف مقصوصة، وفم وشوارب محفورة',
      }
      // shift so the ears sit inside the panel: the outline reaches earLen above the disc
      const lift = (l: Loop): Loop => ({ ...l, pts: l.pts.map(v => ({ ...v, y: round3(v.y + earLen) })) })
      const facePanel: PanelSpec = { ...face, shape: face.shape!.map(lift), holes: face.holes!.map(lift), engrave: face.engrave!.map(lift),
        post: loops => { for (const q of tips) roundCorner(loops, q.x, round3(q.y + earLen), Math.max(2, 0.025 * Dm)) } }
      const back: PanelSpec = {
        id: 'back', name: 'الظهر (الخلف)', w: 2 * Rring, h: 2 * Rring, shape: [disc(cx, cx, Rring)],
        holes: [keyed(rh, e / 2, rh + d, 'hole'), ...slots], note: 'فتحة الإخراج بشقّين يمرّ منهما مفتاح القفل',
      }
      const capR = rh + 8, tw = Math.max(6, 2 * t)
      const plug = (id: string, name: string, shape: Loop, holes: Loop[], note: string): PanelSpec => ({ id, name, w: 2 * Rring, h: 2 * Rring, shape: [shape], holes, note })
      const bayonet = plug('lock-key', 'القفل — المفتاح', keyed(rh - fit, e / 2 - fit, rh + d - fit, 'outer'), [], 'يدخل من الشقّين ثم يُدار ربع دورة خلف الجدار')
      const spacer = plug('lock-spacer', 'القفل — الوسط', disc(cx, cx, rh - fit), [], 'بسماكة الجدار، يدور داخل الفتحة')
      const cap = plug('lock-cap', 'القفل — الغطاء', disc(cx, cx, capR), [rotatedRectHole(cx, cx, tw + fit, t + fit, 0)], 'يبقى خارج الظهر، وفيه شقّ الذيل')
      // the tail: a curl on a stem, its foot glued on the cap and a tab in the cap's slot; it is the lock's handle
      const Ro = 2.2 * tw, Ri = Ro - tw, stem = Ro + 3, sh = 4, ft = 3 // the curl stays clear above the foot
      const tail: { x: number; y: number }[] = []
      const C = { x: 0, y: 0 }, x0 = C.x + Ri, yF = C.y + stem
      tail.push({ x: x0, y: yF + ft + t }, { x: x0 + tw, y: yF + ft + t }, { x: x0 + tw, y: yF + ft }, { x: x0 + tw + sh, y: yF + ft }, { x: x0 + tw + sh, y: yF }, { x: x0 + tw, y: yF })
      const ring = (r: number, a0: number, a1: number) => { const k = Math.ceil(Math.abs(a1 - a0) / (Math.PI / 36)); for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; tail.push({ x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a) }) } }
      ring(Ro, 0, -1.5 * Math.PI)
      const capC = { x: C.x, y: C.y + (Ri + Ro) / 2 }
      for (let i = 1; i < 12; i++) { const a = Math.PI / 2 - (Math.PI * i) / 12; tail.push({ x: capC.x + (tw / 2) * Math.cos(a), y: capC.y + (tw / 2) * Math.sin(a) }) }
      ring(Ri, -1.5 * Math.PI, 0)
      tail.push({ x: x0, y: yF }, { x: x0 - sh, y: yF }, { x: x0 - sh, y: yF + ft }, { x: x0, y: yF + ft })
      const tx = Math.min(...tail.map(v => v.x)), ty = Math.min(...tail.map(v => v.y)), tailPts = tail.map(v => r3({ x: v.x - tx, y: v.y - ty }))
      const tailPanel: PanelSpec = { id: 'tail', name: 'الذيل (مقبض القفل)', w: Math.max(...tailPts.map(v => v.x)), h: Math.max(...tailPts.map(v => v.y)), shape: [polyLoop(tailPts, 'outer')], note: 'لسانه في شقّ غطاء القفل؛ لفّه ربع دورة للفتح' }
      // two cradles hold the body; each has two legs that reach below the discs
      const R = Dm / 2 + 0.3, dc = Math.min(0.25 * Dm, R), ch = Math.sqrt(R * R - (R - dc) ** 2), m = Math.max(8, 2 * t)
      const belly = Math.max(8, 2 * t), lw = Math.max(10, 0.14 * Dm), Wc = round3(2 * ch + 2 * m), Hc = round3(dc + legH)
      if (legH < Rring - Dm / 2 + 5) errors.push(`الأرجل أقصر من حافّة الوجه والظهر: اجعلها ${Math.ceil(Rring - Dm / 2 + 5)} مم على الأقل.`)
      if (legH - belly < 5) errors.push(`الأرجل قصيرة: ${Math.ceil(belly + 5)} مم على الأقل.`)
      const cradlePts = [
        { x: 0, y: 0 }, { x: m, y: 0, b: dc / ch }, { x: Wc - m, y: 0 }, { x: Wc, y: 0 }, { x: Wc, y: Hc },
        { x: Wc - lw, y: Hc }, { x: Wc - lw, y: dc + belly }, { x: lw, y: dc + belly }, { x: lw, y: Hc }, { x: 0, y: Hc },
      ].map(v => ({ ...r3(v), ...(v.b ? { b: v.b } : {}) }))
      const cradle: PanelSpec = {
        id: 'legs', name: 'الأرجل (مهد الجسم)', w: Wc, h: Hc, count: 2, shape: [polyLoop(cradlePts, 'outer')],
        post: loops => { roundCorner(loops, 0, Hc, 3); roundCorner(loops, Wc, Hc, 3) },
        note: 'تُلصق تحت الجسم عند ربعه الأمامي والخلفي',
      }
      const panels: PanelSpec[] = [facePanel, back, sheet([stadiumV(zone.x, t + H / 2, slotL, slotW)]), cradle, bayonet, spacer, cap, tailPanel]
      const notes = [
        `الجسم أسطوانة قطرها ${Dm} مم وطولها ${H} مم؛ اللوح الملتفّ ${L.toFixed(0)} مم يدخل بلساناته في شقوق الوجه والظهر، وطرفاه يلتقيان تحت البطن (${seam} مم بلا قصّات لكلٍّ منهما).`,
        `شقّ النقود ${slotL} × ${slotW} مم في وسط شريط بلا قصّات على الظهر: لفّ اللوح بحيث يقع الشقّ في الأعلى والوصلة في الأسفل.`,
        'القفل: ألصق الغطاء والوسط والمفتاح فوق بعضها والمراكز متطابقة، والذيل في شقّ الغطاء. أدخل المفتاح من الشقّين في فتحة الظهر ثم لفّ الذيل ربع دورة فيقفل؛ لإخراج النقود لفّه ربع دورة وأخرجه.',
        'ألصق مهدَي الأرجل تحت الجسم عند ربعه الأمامي والخلفي، والأذنان إلى الأعلى.',
        `فتحة الإخراج ${p.hole} مم تكفي لأكبر قطعة نقود؛ لا تلصق القفل بالظهر.`,
      ]
      void Rmid
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
  // material left around the hole on every side. The first acrylic test broke with 2–2.5 mm webs, so the default is
  // now 1.5 × t and never under 4 mm; brittle acrylic can go further with the 'web' parameter
  const web = p.web > 0 ? p.web : Math.max(4, 1.5 * t)
  const webTop = web, webBack = web
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

/** The picker's groups, in the order they are shown; every template belongs to exactly one. */
export const CATEGORIES: { id: string; name: string; ids: string[] }[] = [
  { id: 'box', name: 'صناديق', ids: ['closed', 'open', 'sliding', 'liftoff', 'hinged', 'hinged90', 'flex', 'lip', 'window', 'drawer', 'roundbox', 'crate'] },
  { id: 'shop', name: 'ستاندات عرض للمحلات', ids: ['displaystand'] },
  { id: 'wedding', name: 'أعراس وخطوبة', ids: ['fabricset', 'engagement', 'hexringbox', 'nikahtray', 'hennatray', 'welcomesign', 'placecards', 'invitebox', 'caketopper', 'guestframe', 'sweetstand', 'tablenumbers', 'favorbox'] },
  { id: 'gift', name: 'هدايا وديكور', ids: ['chest', 'catbank', 'decobox', 'jewelry', 'moneybox', 'teahouse', 'frame', 'basket', 'fence', 'clock'] },
  { id: 'kitchen', name: 'مطبخ وتقديم', ids: ['carrier', 'mugtree', 'spicerack', 'bedtray', 'tray', 'teabox', 'tissue'] },
  { id: 'office', name: 'مكتب وتنظيم', ids: ['organizer', 'phonestand', 'bookstand', 'headphone', 'keyholder', 'wallshelf', 'jewelrytree'] },
  { id: 'doorsmodern', name: 'أبواب مودرن', ids: ['doorpanel', 'doormodern', 'doorwaves', 'doorframes', 'doordiagonal', 'doorblocks', 'doororbit', 'doorchevron'] },
  { id: 'doorsarab', name: 'أبواب عربي وكلاسيك', ids: ['doormihrab', 'doorkhatam', 'doormashrabiya', 'doorstars', 'doorandalus', 'doorstar', 'doorarch', 'doorclassic', 'doordiamond'] },
  { id: 'mabakher', name: 'مباخر', ids: ['mabkhara', 'mabkharatower', 'incense'] },
  { id: 'home', name: 'بيت وحديقة', ids: ['doorhanger', 'planter', 'petfeeder', 'birdhouse', 'napkin'] },
  { id: 'light', name: 'إضاءة ورمضان', ids: ['ramadanlantern', 'ramadanornaments', 'lantern', 'shade'] },
  { id: 'tools', name: 'معايرة', ids: ['fittest'] },
  { id: 'bulk', name: 'بالجملة', ids: ['keychains', 'coasters'] },
]
/** the newest designs get a badge in the picker */
export const NEW_IDS = ['displaystand', 'fabricset', 'mabkharatower', 'mabkhara', 'fittest', 'nikahtray', 'hennatray', 'welcomesign', 'placecards', 'invitebox', 'doorhanger', 'doordiagonal', 'doorblocks', 'doororbit', 'doorchevron', 'doormihrab', 'doorkhatam', 'doormashrabiya', 'doorstars', 'doorandalus', 'doorpanel', 'doorclassic', 'doorarch', 'doordiamond', 'doorwaves', 'doorstar', 'doormodern', 'doorframes', 'caketopper', 'guestframe', 'sweetstand', 'tablenumbers', 'favorbox', 'hexringbox', 'engagement', 'hinged90', 'crate', 'carrier', 'jewelry', 'moneybox', 'planter', 'petfeeder', 'incense', 'bedtray', 'phonestand', 'bookstand', 'headphone', 'keyholder', 'wallshelf', 'spicerack', 'coasters', 'clock', 'keychains', 'ramadanornaments', 'mugtree', 'jewelrytree', 'birdhouse', 'ramadanlantern']

// ====================================================================== more designs, built from the shared parts

/**
 * Walls that run down past the floor into four curved legs (the corner joints continue down the legs), an optional
 * floor hung on tabs through slots just above the apron, and an optional top plate jointed into the walls.
 */
function leggedBody(p: Record<string, number>, c: Common, warnings: string[], errors: string[], o: { floor: boolean; top: boolean; patTop: number; handles?: boolean }) {
  checkBasics(p, c, warnings, errors)
  const { W, D, H, legH, cell } = p, t = c.t, fit = p.fit ?? 0.15
  const kind = Math.round(p.pattern ?? 0)
  const Ht = round3(H + legH)
  const web = Math.max(4, 1.5 * t), lw = Math.max(p.legW, 3 * t + 4)
  if (legH < web + 8) errors.push(`الأرجل قصيرة: ${Math.ceil(web + 8)} مم على الأقل.`)
  if (2 * lw + 20 > Math.min(W, D)) errors.push(`الأرجل عريضة على هذا الحجم: أقصى عرض ${Math.floor((Math.min(W, D) - 20) / 2)} مم.`)
  const tabsOn = (len: number) => {
    const inner = len - 2 * t, tw = round3(Math.min(30, Math.max(8, inner * 0.14)))
    return { tw, xs: (inner > 220 ? [0.2, 0.5, 0.8] : [0.25, 0.75]).map(k => round3(t + inner * k)) }
  }
  const tw = tabsOn(W), td = tabsOn(D)
  const strip = (len: number, tabs: { tw: number; xs: number[] }, at: (a: number, b: number) => ReturnType<typeof rect>) => {
    const out: ReturnType<typeof rect>[] = []
    let a = 0
    for (const x of tabs.xs) { out.push(at(a, x - tabs.tw / 2)); a = x + tabs.tw / 2 }
    out.push(at(a, len))
    return out
  }
  const panels: PanelSpec[] = []
  if (o.floor) panels.push({
    id: 'floor', name: 'القاع (معلّق باللسانات)', w: W, h: D,
    cuts: [
      ...strip(W, tw, (a, b) => rect(a, 0, b - a, t)), ...strip(W, tw, (a, b) => rect(a, D - t, b - a, t)),
      ...strip(D, td, (a, b) => rect(0, a, t, b - a)), ...strip(D, td, (a, b) => rect(W - t, a, t, b - a)),
    ],
    note: 'لساناته تدخل في شقوق الجدران فوق الأرجل',
  })
  const slotY = round3(H - t / 2), fm = 2 * t + 2
  // hand holes in the sides, under the top edge
  const hh = 25, hwOf = (w: number) => Math.min(90, w - 2 * lw)
  const handleY = (o.top ? t : 0) + 6 + hh / 2
  if (o.handles && (H - (o.floor ? t : 0) < handleY + hh / 2 + 6 || hwOf(D) < 50)) errors.push('الجدار أصغر من أن تُفتح فيه فتحة يد (يلزم ارتفاع نحو 45 مم وعرض جانب يتّسع لـ 50 مم).')
  const wall = (id: string, name: string, w: number, male: boolean, tabs: { tw: number; xs: number[] }, count: number, side: boolean): PanelSpec => {
    const holes = o.floor ? tabs.xs.map(x => rotatedRectHole(x, slotY, tabs.tw + fit, t + fit, 0)) : []
    let top = o.patTop
    if (side && o.handles) { holes.push(stadium(w / 2, handleY, hwOf(w), hh)); top = Math.max(top, handleY + hh / 2 + 6) }
    if (kind > 0) holes.push(...pattern(kind, fm, top, w - fm, (o.floor ? H - t : H) - fm, cell))
    const apronTop = round3(H + web)
    return {
      id, name, w, h: Ht, count, top: o.top ? 'female' : undefined,
      left: male ? 'male' : 'female', right: male ? 'male' : 'female',
      cuts: [rect(lw, apronTop, w - 2 * lw, Ht - apronTop)], holes,
      // curved brackets: the apron's top corners rounded deep
      post: loops => { const r = Math.min(Ht - apronTop - 1, (w - 2 * lw) / 3); roundCorner(loops, round3(lw), apronTop, r); roundCorner(loops, round3(w - lw), apronTop, r) },
    }
  }
  panels.push(wall('frontback', `${N.front} / ${N.back}`, W, true, tw, 2, false), wall('side', N.side, D, false, td, 2, true))
  if (o.top) panels.push({ id: 'top', name: 'السطح العلوي', w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male' })
  return { panels, Ht, kind }
}
const LEG_PARAMS: ParamDef[] = [mm('legH', 'طول الأرجل', 8, 300), mm('legW', 'عرض الرجل', 10, 80)]
const PATTERN_PARAMS = (): ParamDef[] => [
  { key: 'pattern', label: 'الزخرفة', min: 0, max: 7, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
  mm('cell', 'حجم الزخرفة', 6, 40),
]

/** Hand holes and divider slots for a plate that rises above the walls as a carrying handle (as the gift basket). */
function handlePlate(W: number, handleH: number, hd: number, margin: number, t: number, warnings: string[]): PanelSpec {
  const cl = t + 0.3, r = Math.min(handleH * 0.8, (W - 2 * cl) / 2 - 5)
  const hh = Math.min(30, Math.max(25, handleH * 0.4)), yc = Math.max(12, (handleH - hh) * 0.4) + hh / 2
  const webAt = (hw: number) => {
    const ex = W / 2 - hw / 2 + hh / 2, ax = cl + r, ay = r
    return (ex < ax && yc < ay ? r - Math.hypot(ex - ax, yc - ay) : Math.min(yc, ex - cl)) - hh / 2
  }
  let hw = Math.min(100, Math.max(80, (W - 2 * cl) * 0.45))
  while (hw > hh + 2 && webAt(hw) < 8) hw -= 1
  if (hw < 70) warnings.push(`فتحة اليد في المقبض ضيقة (${hw.toFixed(0)} × ${hh.toFixed(0)} مم)؛ كبّر العرض.`)
  return {
    id: 'handle', name: 'المقبض (فاصل أوسط)', w: W, h: handleH + hd,
    cuts: [rect(0, 0, cl, handleH + margin), rect(W - cl, 0, cl, handleH + margin), rect(0, handleH + hd - FOOT, t, FOOT), rect(W - t, handleH + hd - FOOT, t, FOOT)],
    holes: [stadium(W / 2, yc, hw, hh)],
    post: loops => { roundCorner(loops, round3(cl), 0, r); roundCorner(loops, round3(W - cl), 0, r) },
    note: 'يقف في منتصف الحامل، وطرفاه في شقّي الجانبين',
  }
}

const MORE: Template[] = [
  {
    id: 'crate',
    name: 'صندوق تخزين بفتحتَي يد',
    desc: 'صندوق مفتوح متين بفتحة يد في كل جانب، لترتيب الرفوف والخزائن وللتقديم؛ زخرفة اختيارية في الواجهتين.',
    icon: `<path d="M10 22h44v32H10z"/><path d="M22 30h20" stroke-width="5" stroke-linecap="round"/><path d="M10 22l4-6h36l4 6"/>`,
    params: [...DIMS, ...PATTERN_PARAMS()],
    defaults: { W: 300, D: 200, H: 150, pattern: 0, cell: 14 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, cell } = p, t = c.t
      const kind = Math.round(p.pattern)
      const box = openBox(W, D, H)
      const hh = 26, hw = Math.min(100, D - 4 * t - 30), yc = Math.max(14, H * 0.18) + hh / 2
      if (hw < 60 || H - t - (yc + hh / 2) < 10) errors.push('الصندوق أصغر من أن تُفتح فيه فتحة يد (عمق 100 مم وارتفاع 70 مم على الأقل).')
      const fm = 2 * t + 2
      for (const sp of box) {
        if (sp.id === 'side') sp.holes = [stadium(D / 2, yc, hw, hh)]
        if (kind > 0 && (sp.id === 'front' || sp.id === 'back')) sp.holes = pattern(kind, fm, fm, W - fm, H - t - fm, cell)
      }
      return { panels: box, notes: ['فتحتا اليد في الجانبين تحت الحافّة؛ للأحمال الثقيلة استعمل خشباً 4 مم أو أكثر.', 'يُرصّ بعضه فوق بعض إذا تساوت القياسات.'], warnings, errors }
    },
  },
  {
    id: 'carrier',
    name: 'حامل عبوات بمقبض',
    desc: 'حامل لزجاجات العصير أو الحليب أو الشاي: خانات بفواصل متقاطعة ومقبض أوسط يُحمل باليد.',
    icon: `<path d="M10 32h44v22H10z"/><path d="M18 32c0-16 28-16 28 0"/><path d="M24 26c3-6 13-6 16 0" stroke-width="1.5"/><path d="M24 32v22M40 32v22" stroke-width="1.5"/>`,
    params: [
      ...DIMS,
      { key: 'N', label: 'فواصل بالعرض', min: 0, max: 8, step: 1, int: true, hint: 'عدد الفواصل التي تقطع المقبض' },
      mm('handleH', 'ارتفاع المقبض فوق الحافّة', 40, 200), mm('margin', 'هامش أعلى الشقّ', 3, 50), mm('fit', 'خلوص الشقّ', 0, 1),
    ],
    defaults: { W: 210, D: 140, H: 100, N: 2, handleH: 70, margin: 8, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, handleH, fit } = p, t = c.t
      const Nn = Math.round(p.N), sw = t + fit, hd = H - t
      const margin = Math.min(p.margin, Math.max(2, hd / 3))
      if (hd - FOOT - margin < 3 * t) errors.push('الارتفاع صغير جداً لشقوق الفواصل.')
      if (Nn > 0 && (W - 2 * t) / (Nn + 1) < 3 * t) errors.push('الفواصل كثيرة جداً لهذا العرض.')
      const xs = Array.from({ length: Nn }, (_, i) => round3(t + (W - 2 * t) * (i + 1) / (Nn + 1)))
      const box = openBox(W, D, H)
      for (const sp of box) {
        if (sp.id === 'front' || sp.id === 'back') addSlots(sp, xs, margin, hd - FOOT, sw, fit / 2)
        if (sp.id === 'side') addSlots(sp, [D / 2], margin, hd - FOOT, sw, fit / 2)
      }
      const handle = handlePlate(W, handleH, hd, margin, t, warnings)
      // the handle takes the crossing slots from below, the dividers from above
      handle.cuts = [...handle.cuts!, ...xs.map(x => rect(x - sw / 2, handleH + hd / 2, sw, hd / 2))]
      const panels: PanelSpec[] = [...box, handle]
      if (Nn > 0) panels.push({
        id: 'divN', name: 'فاصل بالعمق', w: D, h: hd, count: Nn,
        cuts: [rect(0, 0, t, margin), rect(D - t, 0, t, margin), rect(0, hd - FOOT, t, FOOT), rect(D - t, hd - FOOT, t, FOOT), rect(D / 2 - sw / 2, 0, sw, hd / 2)],
        note: 'يدخل في شقوق الواجهتين ويتقاطع مع المقبض',
      })
      const cw = (W - 2 * t - Nn * t) / (Nn + 1), cd = (D - 3 * t) / 2
      return { panels, notes: [`${2 * (Nn + 1)} خانة، كلّ خانة نحو ${cw.toFixed(0)} × ${cd.toFixed(0)} مم.`, 'ركّب القاعدة والواجهتين مع الفواصل، أنزل المقبض فوقها، ثم أدخل الجانبين فيدخل طرفا المقبض في شقّيهما، والصق.'], warnings, errors }
    },
  },
  {
    id: 'jewelry',
    name: 'صندوق مجوهرات بفواصل',
    desc: 'صندوق بغطاء ذي شفة وخانات منخفضة للخواتم والأقراط والساعات؛ يُبطَّن بالمخمل.',
    icon: `<path d="M10 24h44v30H10z"/><path d="M8 18h48v6H8z"/><path d="M10 40h44M28 40v14M44 40v14" stroke-width="1.5"/><circle cx="20" cy="47" r="3" stroke-width="1.5"/>`,
    params: [...DIMS, ...DIVIDER_PARAMS.filter(d => d.key !== 'margin'), mm('lipH', 'ارتفاع الشفة', 4, 40), mm('gap', 'خلوص الشفة', 0.2, 2), ...PATTERN_PARAMS()],
    defaults: { W: 220, D: 150, H: 70, N: 2, M: 1, fit: 0.2, lipH: 10, gap: 0.5, pattern: 0, cell: 12 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, lipH, gap, cell } = p, t = c.t
      const { panels, notes } = lipLidBox(p, c, errors)
      // the dividers stop under the lid's lip frame
      const hd = round3(H - t - lipH - 2), dm = 3
      const d = dividerPlan({ ...p, H: hd + t, margin: dm }, t, errors, warnings)
      const y0 = H - t - hd
      for (const sp of panels) {
        if (sp.id === 'front' || sp.id === 'back') addSlots(sp, d.xs, y0 + dm, H - t - FOOT, d.sw, d.vfit)
        if (sp.id === 'side') addSlots(sp, d.ds, y0 + dm, H - t - FOOT, d.sw, d.vfit)
      }
      const kind = Math.round(p.pattern), m = 2 * t + gap + 3
      if (kind > 0) panels.find(x => x.id === 'lid')!.holes = pattern(kind, m, m, W - m, D - m, cell)
      panels.push(...dividers(W, D, hd, d.xs, d.ds, t, d.sw, dm))
      return { panels, notes: [`${d.cells} خانة بارتفاع ${hd} مم، تحت شفة الغطاء.`, 'بطّن الخانات بقماش مخمل أو لبّاد لاصق قبل وضع المجوهرات.', ...notes], warnings, errors }
    },
  },
  {
    id: 'moneybox',
    name: 'صندوق العيدية والاقتراحات',
    desc: 'صندوق بغطاء ذي شفة وفي الغطاء شقّ للبطاقات والنقود: للأعراس والعيدية والتبرعات وصندوق اقتراحات المحلّات.',
    icon: `<path d="M10 24h44v30H10z"/><path d="M8 18h48v6H8z"/><path d="M22 21h20" stroke-width="3"/><path d="M24 36h16v10H24z" stroke-width="1.5"/>`,
    params: [...DIMS, mm('slotL', 'طول الشقّ', 30, 200, 'بطاقة دعوة 120–160، نقود مطويّة 80'), mm('slotW', 'عرض الشقّ', 3, 15), mm('lipH', 'ارتفاع الشفة', 4, 40), mm('gap', 'خلوص الشفة', 0.2, 2), ...PATTERN_PARAMS()],
    defaults: { W: 220, D: 160, H: 160, slotL: 130, slotW: 6, lipH: 12, gap: 0.5, pattern: 0, cell: 14 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, slotL, slotW, lipH, cell } = p, t = c.t
      const { panels, notes } = lipLidBox(p, c, errors)
      // the slot lies inside the lip frame
      const inner = W - 4 * t - 2 * p.gap - 8
      if (slotL > inner) errors.push(`الشقّ أطول من الغطاء: أقصاه ${Math.floor(inner)} مم.`)
      if (slotW > D - 4 * t - 10) errors.push('الشقّ أعرض من الغطاء.')
      const lid = panels.find(x => x.id === 'lid')!
      lid.holes = [stadium(W / 2, D / 2, slotL, slotW)]
      lid.engrave = [...(lid.engrave ?? []), engraveRect(W / 2 - slotL / 2 - 5, D / 2 - slotW / 2 - 5, slotL + 10, slotW + 10)]
      const kind = Math.round(p.pattern), fm = 2 * t + 2
      if (kind > 0) for (const sp of panels) if (sp.id === 'front') sp.holes = pattern(kind, fm, lipH + 4, W - fm, H - t - fm, cell)
      return { panels, notes: ['الشقّ في وسط الغطاء داخل إطار الشفة، ويُفتح الغطاء لإخراج المحتوى؛ للقفل ألصق الغطاء أو اربطه بشريطة.', 'اكتب الاسم أو المناسبة على الواجهة بالحفر في RDWorks.', ...notes], warnings, errors }
    },
  },
  {
    id: 'planter',
    name: 'حوض نباتات بأرجل',
    desc: 'حوض مزخرف يقف على أرجل منحنية، بقاع معلّق فيه ثقوب تصريف؛ يُبطّن بكيس أو يوضع فيه أصيص.',
    icon: `<path d="M12 30h40v16H12z"/><path d="M12 46v8M52 46v8M12 54c4 0 6-4 8-8M52 54c-4 0-6-4-8-8" stroke-width="2"/><path d="M26 30c-2-8 0-14 6-18 6 4 8 10 6 18" stroke-width="1.5"/><path d="M32 12v18" stroke-width="1.5"/>`,
    params: [...DIMS.map(d => d.key === 'H' ? { ...d, hint: 'ارتفاع الحوض فوق الأرجل' } : d), ...LEG_PARAMS, ...PATTERN_PARAMS(), mm('fit', 'خلوص لسانات القاع', 0, 1)],
    defaults: { W: 300, D: 140, H: 120, legH: 40, legW: 28, pattern: 2, cell: 10, fit: 0.15 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { panels } = leggedBody(p, c, warnings, errors, { floor: true, top: false, patTop: 2 * c.t + 2 })
      const floor = panels.find(x => x.id === 'floor')!, t = c.t
      const fx = p.W - 2 * t, fy = p.D - 2 * t
      const nx = Math.max(1, Math.floor(fx / 50)), ny = Math.max(1, Math.floor(fy / 50))
      floor.holes = Array.from({ length: nx * ny }, (_, k) => circle(round3(t + fx * ((k % nx) + 0.5) / nx), round3(t + fy * (Math.floor(k / nx) + 0.5) / ny), 3))
      return { panels, notes: ['بطّن الحوض بكيس بلاستيك أو ضع فيه أصيصاً؛ الخشب لا يتحمّل الماء المباشر. ادهنه بورنيش مائي.', 'ثقوب التصريف في القاع تمنع تجمّع الماء.'], warnings, errors }
    },
  },
  {
    id: 'petfeeder',
    name: 'حامل أوعية للقطط والكلاب',
    desc: 'طاولة صغيرة على أرجل بسطح فيه فتحات لأوعية الأكل والماء، ترفعها لراحة رقبة الحيوان.',
    icon: `<path d="M8 22h48v8H8z"/><path d="M10 30v24M54 30v24M10 54c4 0 6-6 8-10h28c2 4 4 10 8 10" stroke-width="2"/><ellipse cx="22" cy="22" rx="8" ry="3"/><ellipse cx="42" cy="22" rx="8" ry="3"/>`,
    params: [
      ...DIMS.map(d => d.key === 'H' ? { ...d, hint: 'ارتفاع الجسم فوق الأرجل' } : d), ...LEG_PARAMS,
      { key: 'bowls', label: 'عدد الأوعية', min: 1, max: 3, step: 1, int: true },
      mm('bowl', 'قطر فتحة الوعاء', 60, 250, 'قطر جسم الوعاء تحت حافّته البارزة'),
      ...PATTERN_PARAMS(),
    ],
    defaults: { W: 320, D: 170, H: 70, legH: 40, legW: 28, bowls: 2, bowl: 125, pattern: 0, cell: 14 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t
      const { panels } = leggedBody(p, c, warnings, errors, { floor: false, top: true, patTop: 2 * t + 2 })
      const n = Math.round(p.bowls), b = p.bowl, gapX = (p.W - 2 * t - n * b) / (n + 1)
      if (gapX < 12) errors.push(`الأوعية لا تتّسع في هذا العرض: يلزم ${Math.ceil(n * b + (n + 1) * 12 + 2 * t)} مم على الأقل.`)
      if (b + 24 > p.D - 2 * t) errors.push(`العمق أصغر من الوعاء: يلزم ${Math.ceil(b + 24 + 2 * t)} مم على الأقل.`)
      const top = panels.find(x => x.id === 'top')!
      if (!errors.length) top.holes = Array.from({ length: n }, (_, k) => circle(round3(t + gapX + b / 2 + k * (b + gapX)), round3(p.D / 2), b / 2))
      return { panels, notes: [`الأوعية تُعلَّق بحافّتها في الفتحات (قطر ${b} مم)؛ قِس جسم الوعاء تحت الحافّة البارزة.`, 'ارتفاع السطح يُختار بحسب الحيوان: القطط نحو 10 سم، الكلاب الصغيرة 15–20 سم.'], warnings, errors }
    },
  },
  {
    id: 'incense',
    name: 'مبخرة مزخرفة',
    desc: 'مبخرة بجدران مخرّمة بنجوم ثمانية على أرجل، وفي سطحها فتحة لوعاء الفحم المعدني.',
    icon: `<path d="M16 24h32v24H16z"/><path d="M12 20h40v4H12z"/><path d="M16 48v6M48 48v6" stroke-width="2.5"/><path d="M28 14c0-4 4-4 4-8M34 16c0-4 4-4 4-8" stroke-width="1.5"/><path d="M26 32l3 3-3 3-3-3zM38 32l3 3-3 3-3-3z" stroke-width="1.5"/>`,
    params: [...DIMS.map(d => d.key === 'H' ? { ...d, hint: 'ارتفاع الجسم فوق الأرجل' } : d), ...LEG_PARAMS, mm('cup', 'قطر فتحة الوعاء المعدني', 30, 150), ...PATTERN_PARAMS(), mm('fit', 'خلوص لسانات القاع', 0, 1)],
    defaults: { W: 120, D: 120, H: 90, legH: 22, legW: 22, cup: 70, pattern: 6, cell: 12, fit: 0.15 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t
      const { panels } = leggedBody(p, c, warnings, errors, { floor: true, top: true, patTop: 2 * t + 2 })
      if (p.cup + 16 > Math.min(p.W, p.D) - 2 * t) errors.push(`فتحة الوعاء أكبر من السطح: أقصاها ${Math.floor(Math.min(p.W, p.D) - 2 * t - 16)} مم.`)
      else {
        const top = panels.find(x => x.id === 'top')!
        top.holes = [circle(p.W / 2, p.D / 2, p.cup / 2)]
        top.engrave = [{ ...circle(p.W / 2, p.D / 2, p.cup / 2 + 4) }]
      }
      return { panels, notes: ['استعمل وعاءً معدنياً بحافّة تستند على السطح، ولا تضع الفحم على الخشب مباشرة؛ اترك فراغاً تحت الوعاء.', 'الزخرفة المخرّمة تُخرج الدخان وتُظهر توهّج الجمر.'], warnings, errors }
    },
  },
  {
    id: 'bedtray',
    name: 'صينية فطور بأرجل',
    desc: 'صينية تقديم بحافّة ومقبضين، تقف على أرجل للفطور في السرير أو كطاولة صغيرة.',
    icon: `<path d="M6 26h52v10H6z"/><path d="M12 31h8M44 31h8" stroke-width="3" stroke-linecap="round"/><path d="M8 36v18M56 36v18M8 54c4 0 6-8 8-14h32c2 6 4 14 8 14" stroke-width="2"/>`,
    params: [...DIMS.map(d => d.key === 'H' ? { ...d, hint: 'ارتفاع الحافّة' } : d), ...LEG_PARAMS, ...PATTERN_PARAMS(), mm('fit', 'خلوص لسانات القاع', 0, 1)],
    defaults: { W: 400, D: 280, H: 55, legH: 170, legW: 40, pattern: 0, cell: 14, fit: 0.15 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { panels } = leggedBody(p, c, warnings, errors, { floor: true, top: false, patTop: 2 * c.t + 2, handles: true })
      return { panels, notes: ['فتحتا اليد في الجانبين؛ استعمل خشباً 4–6 مم لصينية بهذا الحجم.', 'ارتفاع الأرجل 15–20 سم يناسب الجلوس في السرير.'], warnings, errors }
    },
  },
]

/** A plate whose two ends are tabs (t long) between shoulders s high: it spans between two panels through their slots. */
const tabPlate = (id: string, name: string, len: number, h: number, t: number, s: number, extra: Partial<PanelSpec> = {}): PanelSpec => ({
  id, name, w: len, h, ...extra,
  cuts: [rect(0, 0, t, s), rect(0, h - s, t, s), rect(len - t, 0, t, s), rect(len - t, h - s, t, s), ...(extra.cuts ?? [])],
})
const shoulder = (h: number) => round3(Math.max(2, Math.min(6, 0.15 * h)))

/** Phone, tablet and book stands: two side profiles joined by three tabbed plates. */
function standBuild(kind: 'phone' | 'book') {
  return (p: Record<string, number>, c: Common): BuildResult => {
    const warnings: string[] = [], errors: string[] = []
    const { W, H, devT, lip, fit } = p, t = c.t
    const a = (p.ang * Math.PI) / 180
    if (W < 8 * t + 20) errors.push(`العرض صغير: ${Math.ceil(8 * t + 20)} مم على الأقل.`)
    // the profile, y up: a lip at the front, a ledge the device stands on, the slope it leans on, a foot behind
    const lipT = t + 6, hb = Math.max(10, 3 * t), ledge = devT / Math.sin(a) + 1
    const S = { x: lipT + ledge, y: hb }, u = { x: Math.cos(a), y: Math.sin(a) }
    const T = { x: S.x + H * u.x, y: S.y + H * u.y }
    // the back edge runs from the top down to the foot; it is pushed back until the brace slot under the slope keeps
    // 2.5 mm of wood on its far side too (steep, short rests leave a thin profile otherwise)
    const n0 = { x: -Math.sin(a), y: Math.cos(a) }, ins = 4 + t / 2, c2 = { x: S.x + (H / 2) * u.x - ins * n0.x, y: S.y + (H / 2) * u.y - ins * n0.y }
    const half2 = (Math.min(0.5 * H, 80) - 2 * shoulder(Math.min(0.5 * H, 80)) + fit) / 2, halfT = (t + fit) / 2
    const corners = [-1, 1].flatMap(i => [-1, 1].map(j => ({ x: c2.x + i * half2 * u.x + j * halfT * n0.x, y: c2.y + i * half2 * u.y + j * halfT * n0.y })))
    const clear = (lb: number) => Math.min(...corners.map(q => ((lb - T.x) * (T.y - q.y) - (0 - T.y) * (T.x - q.x)) / Math.hypot(lb - T.x, T.y) * -1))
    let Lb = T.x + Math.max(20, 0.3 * T.y)
    for (let k = 0; k < 200 && clear(Lb) < 2.5; k++) Lb += 1
    const Hp = Math.max(T.y, hb + lip)
    const Y = (v: { x: number; y: number }) => ({ x: round3(v.x), y: round3(Hp - v.y) })
    const profile = polyLoop([{ x: 0, y: 0 }, { x: Lb, y: 0 }, T, S, { x: lipT, y: hb }, { x: lipT, y: hb + lip }, { x: 0, y: hb + lip }].map(Y), 'outer')
    // the three cross plates and their slots in the profile
    const hL = hb + lip - 6, h2 = Math.min(0.5 * H, 80), h3 = Math.min(0.5 * (Lb - S.x), 60)
    if (h2 < 14 || h3 < 14) errors.push('المسند قصير جداً للألواح العرضية؛ زد طوله.')
    const n = { x: -Math.sin(a), y: Math.cos(a) }, inset = 4 + t / 2
    const C2 = { x: S.x + (H / 2) * u.x - inset * n.x, y: S.y + (H / 2) * u.y - inset * n.y }
    const sl = (h: number) => h - 2 * shoulder(h) + fit
    const holes = [
      rotatedRectHole(round3(lipT / 2), round3(Hp - (hb + lip) / 2), t + fit, sl(hL), 0),
      rotatedRectHole(round3(C2.x), round3(Hp - C2.y), sl(h2), t + fit, -a),
      rotatedRectHole(round3((S.x + Lb) / 2), round3(Hp - 3 - t / 2), sl(h3), t + fit, 0),
    ]
    const panels: PanelSpec[] = [
      { id: 'side', name: 'الجانب', w: round3(Lb), h: round3(Hp), count: 2, shape: [profile], holes, post: loops => { roundCorner(loops, 0, round3(Hp - hb - lip), 2) }, note: 'المسند المائل يحمل الجهاز، والحافّة الأمامية تمنعه من الانزلاق' },
      tabPlate('lip', 'اللوح الأمامي (الحافّة)', W, hL, t, shoulder(hL), { note: 'يقف في عمود الحافّة الأمامية' }),
      tabPlate('brace', 'دعامة المسند', W, h2, t, shoulder(h2), { note: 'موازية للمسند تحته بقليل' }),
      tabPlate('foot', 'دعامة القاعدة', W, h3, t, shoulder(h3), { note: 'أفقية فوق الأرض' }),
    ]
    const notes = [
      `الميل ${p.ang}° عن الأفق، وسماكة الجهاز مع الغطاء حتى ${devT} مم؛ ارتفاع الحافّة الأمامية ${lip} مم.`,
      'أدخل ألسنة الألواح الثلاثة في شقوق أحد الجانبين، ثم ركّب الجانب الثاني والصق.',
      kind === 'phone' ? 'الكابل يمرّ بين الجانبين تحت الجهاز.' : 'للمصحف والكتب: اجعل سماكة الجهاز بسماكة الكتاب المفتوح.',
    ]
    return { panels, notes, warnings, errors }
  }
}
const STAND_PARAMS: ParamDef[] = [
  mm('W', 'العرض', 40, 500), mm('H', 'طول المسند المائل', 50, 400),
  { key: 'ang', label: 'زاوية الميل', min: 45, max: 80, step: 1, unit: '°' },
  mm('devT', 'سماكة الجهاز أو الكتاب', 5, 60), mm('lip', 'ارتفاع الحافّة الأمامية', 8, 50), mm('fit', 'خلوص الشقوق', 0, 1),
]

/** Wall shelves and spice racks: an open box on its back with shelves in slots, and optional front rails. */
function shelfBuild(kind: 'shelf' | 'spice') {
  return (p: Record<string, number>, c: Common): BuildResult => {
    const warnings: string[] = [], errors: string[] = []
    checkBasics(p, c, warnings, errors)
    const { W, H, D, railH, fit } = p, t = c.t
    const rails = Math.round(p.rails) > 0
    // openBox(W, H, D): its bottom is the back board, its front and back walls the top and bottom boards
    const box = openBox(W, H, D)
    const d = dividerPlan({ W, D: H, H: D, N: 0, M: p.M, margin: p.margin, fit }, t, errors, warnings)
    const back = box.find(x => x.id === 'bottom')!, side = box.find(x => x.id === 'side')!
    // the hanging keyholes sit under the top board, clear of the joints
    if (H < 2 * t + 40 || W < 2 * t + 50) errors.push(`الرف صغير على فتحتي التعليق: ارتفاع ${Math.ceil(2 * t + 40)} وعرض ${Math.ceil(2 * t + 50)} مم على الأقل.`)
    const kx = Math.max(t + 12, Math.min(60, W / 4)), ky = t + 18
    back.name = 'اللوح الخلفي'; back.holes = [keyhole(kx, ky, 4, 4, 7), keyhole(W - kx, ky, 4, 4, 7)]
    back.note = 'فتحتا التعليق في الأعلى'
    for (const b of box) if (b.id === 'front' || b.id === 'back') { b.name = 'اللوح العلوي / السفلي'; b.id = 'board-' + b.id }
    addSlots(side, d.ds, d.margin, d.hd - FOOT, d.sw, d.vfit)
    const panels: PanelSpec[] = [...box.filter(b => b !== side)]
    const shelves = [...d.ds, H - t / 2] // every shelf plus the bottom board carry a rail
    const gaps = [d.ds[0] ?? H, ...d.ds.slice(1).map((v, i) => v - d.ds[i]), H - (d.ds[d.ds.length - 1] ?? 0)]
    if (rails && Math.min(...gaps) < railH + 3 * t + 20) errors.push(`المسافة بين الرفوف أصغر من أن تحمل حاجزاً بارتفاع ${railH} مم؛ قلّل الرفوف أو ارتفاع الحاجز.`)
    if (rails) {
      const s = shoulder(railH), rc = (x: number) => x - t / 2 - railH / 2 - 1, rm = 4
      // two identical sides: the second is the same piece moved across (its other face outward), so both match
      const railSlots = shelves.map(x => rotatedRectHole(round3(rc(x)), round3(rm + (t + fit) / 2), railH - 2 * s + fit, t + fit, 0))
      panels.push(
        { ...side, holes: railSlots, note: 'شقوق الحواجز فوق شقوق الرفوف عند الحافّة الأمامية' },
        tabPlate('rail', 'الحاجز الأمامي', W, railH, t, s, { count: shelves.length, note: 'يمنع العلب من السقوط' }),
      )
    } else panels.push(side)
    panels.push(...dividers(W, H, d.hd, [], d.ds, t, d.sw, d.margin).map(x => ({ ...x, name: 'رف أوسط', note: 'يدخل في شقوق الجانبين' })))
    const notes = [
      `${d.ds.length + 1} ${d.ds.length ? 'طوابق' : 'طابق'} بعمق ${D} مم؛ يُعلّق بمسمارين في فتحتَي اللوح الخلفي.`,
      rails ? 'ضع الجانبين بالاتجاه نفسه: شقوق الحواجز فوق شقوق الرفوف وعند الحافّة الأمامية في كليهما (الجانب الثاني يُنقل كما هو دون قلبه رأساً على عقب).' : '',
      kind === 'spice' ? 'برطمانات البهارات القياسية بقطر 45–55 مم: اجعل العمق 60–90 مم.' : 'للأحمال الثقيلة استعمل خشباً 6 مم واربط اللوح الخلفي بأكثر من مسمار.',
    ].filter(Boolean)
    return { panels, notes, warnings, errors }
  }
}

MORE.push(
  {
    id: 'phonestand',
    name: 'حامل جوال وتابلت',
    desc: 'حامل مكتبي مائل للجوال أو التابلت، بحافّة أمامية ومسند وجانبين؛ يُجمَّع بالألسنة دون غراء تقريباً.',
    icon: `<path d="M14 54h36"/><path d="M18 54V44h6l14-30h6L30 54"/><path d="M24 44l14-30" stroke-width="1.5"/><path d="M38 14l8 2-12 32" stroke-width="2.5"/>`,
    params: STAND_PARAMS,
    defaults: { W: 80, H: 110, ang: 65, devT: 12, lip: 14, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build: standBuild('phone'),
  },
  {
    id: 'bookstand',
    name: 'حامل مصحف وكتب',
    desc: 'حامل كبير مائل للمصحف أو كتب الطبخ أو اللوحات، بحافّة أمامية عريضة تمسك الصفحات.',
    icon: `<path d="M8 54h48"/><path d="M12 54V46h6l14-32h6L24 54"/><path d="M20 30c6-4 14-4 18 0M22 38c6-4 12-4 16 0" stroke-width="1.5"/><path d="M38 14l8 2-12 32" stroke-width="2.5"/>`,
    params: STAND_PARAMS,
    defaults: { W: 260, H: 200, ang: 62, devT: 35, lip: 22, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build: standBuild('book'),
  },
  {
    id: 'headphone',
    name: 'حامل سماعات',
    desc: 'عمود متقاطع متين على قاعدة، فوقه سرج مستدير تُعلَّق عليه السماعات.',
    icon: `<path d="M14 54h36"/><path d="M28 54V16h8v38" /><path d="M18 14h28" stroke-width="5" stroke-linecap="round"/><path d="M22 14c0-10 20-10 20 0" stroke-width="1.5"/>`,
    params: [mm('H', 'ارتفاع العمود', 120, 450), mm('W', 'عرض العمود', 40, 120), mm('B', 'قياس القاعدة', 90, 300), mm('L', 'طول السرج', 60, 200), mm('fit', 'خلوص الشقوق', 0, 1)],
    defaults: { H: 260, W: 60, B: 150, L: 110, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { H, W, B, L, fit } = p, t = c.t, sw = t + fit
      if (B < W + 30) errors.push(`القاعدة أصغر من العمود: ${Math.ceil(W + 30)} مم على الأقل.`)
      if (W < t + 30) errors.push(`العمود ضيق: ${Math.ceil(t + 30)} مم على الأقل.`)
      const tb = round3(Math.min(12, W * 0.2)), tx = [round3(W * 0.2), round3(W * 0.8)], Ws = 40, ttop = round3(Math.min(20, W * 0.35, Ws - 12))
      // two plates cross-lapped into an X column: A runs to the saddle, B stops 10 mm under it
      const bottomStrip = (w: number, y: number) => [rect(0, y, tx[0] - tb / 2, t), rect(tx[0] + tb / 2, y, tx[1] - tx[0] - tb, t), rect(tx[1] + tb / 2, y, w - tx[1] - tb / 2, t)]
      const Hb = H - 10
      const A: PanelSpec = {
        id: 'post-a', name: 'العمود — اللوح الطويل', w: W, h: H + 2 * t,
        cuts: [rect(0, 0, W / 2 - ttop / 2, t), rect(W / 2 + ttop / 2, 0, W / 2 - ttop / 2, t), ...bottomStrip(W, H + t), rect(W / 2 - sw / 2, t + H / 2, sw, H / 2 + t)],
        note: 'شقّه من الأسفل، ولسانه العلوي في السرج',
      }
      const Bp: PanelSpec = {
        id: 'post-b', name: 'العمود — اللوح القصير', w: W, h: Hb + t,
        cuts: [...bottomStrip(W, Hb), rect(W / 2 - sw / 2, 0, sw, Hb - H / 2)],
        note: 'شقّه من الأعلى ويتقاطع مع الطويل',
      }
      const cx = B / 2, cy = B / 2, off = (x: number) => x - W / 2
      const base: PanelSpec = {
        id: 'base', name: 'القاعدة', w: B, h: B,
        holes: [...tx.map(x => rotatedRectHole(round3(cx + off(x)), cy, tb + fit, t + fit, 0)), ...tx.map(x => rotatedRectHole(cx, round3(cy + off(x)), t + fit, tb + fit, 0))],
        post: loops => { for (const [x, y] of [[0, 0], [B, 0], [B, B], [0, B]]) roundCorner(loops, x, y, 12) },
        note: 'شقوق على شكل صليب لألسنة العمود',
      }
      const saddle: PanelSpec = {
        id: 'saddle', name: 'السرج', w: L, h: Ws, holes: [rotatedRectHole(L / 2, Ws / 2, t + fit, ttop + fit, 0)],
        post: loops => { for (const [x, y] of [[0, 0], [L, 0], [L, Ws], [0, Ws]]) roundCorner(loops, x, y, Ws / 2 - 0.5) },
        note: 'تستقرّ عليه طوق السماعات',
      }
      return { panels: [base, A, Bp, saddle], notes: ['ركّب اللوحين متقاطعين (X)، أدخل ألسنتهما في شقوق القاعدة، ثم ضع السرج على اللسان العلوي والصق.', 'العمود المتقاطع لا يتمايل؛ لسماعات ثقيلة اجعل القاعدة 180 مم أو أكثر.'], warnings, errors }
    },
  },
  {
    id: 'keyholder',
    name: 'لوحة مفاتيح جدارية برف',
    desc: 'لوحة تُعلَّق على الجدار بخطّافات للمفاتيح ورفّ صغير للنظارات والرسائل، تُجمَّع بالألسنة.',
    icon: `<path d="M8 10h48v44H8z"/><path d="M12 22h40" stroke-width="3"/><path d="M18 34v6c0 2 3 2 3 0M30 34v6c0 2 3 2 3 0M42 34v6c0 2 3 2 3 0" stroke-width="2"/><circle cx="20" cy="15" r="1.5"/><circle cx="44" cy="15" r="1.5"/>`,
    params: [mm('W', 'العرض', 150, 600), mm('H', 'الارتفاع', 100, 400), { key: 'pegs', label: 'عدد الخطّافات', min: 2, max: 12, step: 1, int: true }, { key: 'shelf', label: 'رف علوي', min: 0, max: 1, step: 1, int: true }, mm('Ds', 'عمق الرف', 30, 120), mm('fit', 'خلوص الشقوق', 0, 1)],
    defaults: { W: 300, H: 190, pegs: 5, shelf: 1, Ds: 60, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { W, H, Ds, fit } = p, t = c.t
      const n = Math.round(p.pegs), shelfOn = Math.round(p.shelf) > 0
      const holes: Loop[] = [keyhole(40, 16, 4, 4, 7), keyhole(W - 40, 16, 4, 4, 7)]
      const panels: PanelSpec[] = []
      let yp = 40
      if (shelfOn) {
        const ys = 34, Ws = W - 20, tw = round3(Math.min(30, 0.15 * Ws)), sx = [round3(Ws * 0.25), round3(Ws * 0.75)]
        const a = Ds - 6, b = Math.min(a, 50), a1 = round3(a * 0.3), a2 = round3(a * 0.7), b1 = round3(b * 0.25), b2 = round3(b * 0.65)
        const bx = [15, Ws - 15]
        for (const x of sx) holes.push(rotatedRectHole(round3(10 + x), round3(ys + t / 2), tw + fit, t + fit, 0))
        for (const x of bx) holes.push(rotatedRectHole(round3(10 + x), round3(ys + t + (b1 + b2) / 2), t + fit, b2 - b1 + fit, 0))
        panels.push({
          id: 'shelf', name: 'الرف', w: Ws, h: Ds + t,
          cuts: [rect(0, 0, sx[0] - tw / 2, t), rect(sx[0] + tw / 2, 0, sx[1] - sx[0] - tw, t), rect(sx[1] + tw / 2, 0, Ws - sx[1] - tw / 2, t)],
          holes: bx.map(x => rotatedRectHole(x, round3(t + (a1 + a2) / 2), t + fit, a2 - a1 + fit, 0)),
          post: loops => { roundCorner(loops, 0, round3(Ds + t), 6); roundCorner(loops, Ws, round3(Ds + t), 6) },
          note: 'ألسنته الخلفية في اللوح، وشقّاه للدعامتين',
        })
        const bracket = polyLoop([
          { x: 0, y: 0 }, { x: a1, y: 0 }, { x: a1, y: -t }, { x: a2, y: -t }, { x: a2, y: 0 }, { x: a, y: 0 }, { x: 0, y: b },
          { x: 0, y: b2 }, { x: -t, y: b2 }, { x: -t, y: b1 }, { x: 0, y: b1 },
        ].map(v => ({ x: round3(v.x + t), y: round3(v.y + t) })), 'outer')
        panels.push({ id: 'bracket', name: 'دعامة الرف', w: round3(a + t), h: round3(b + t), count: 2, shape: [bracket], note: 'تحت الرف، لسان في اللوح ولسان في الرف' })
        yp = ys + t + b + 16
      }
      const ph = 10, pL = 40, hk = 8
      if (yp + hk + ph + 16 > H) errors.push(`اللوحة قصيرة على الرف والخطّافات: ${Math.ceil(yp + hk + ph + 16)} مم على الأقل.`)
      if ((W - 80) / Math.max(1, n - 1) < 22) errors.push('الخطّافات كثيرة على هذا العرض.')
      for (let k = 0; k < n; k++) holes.push(rotatedRectHole(round3(n === 1 ? W / 2 : 40 + (W - 80) * k / (n - 1)), round3(yp + hk + ph / 2), t + fit, ph - 3 + fit, 0))
      panels.unshift({ id: 'board', name: 'اللوحة', w: W, h: H, holes, post: loops => { for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) roundCorner(loops, x, y, 10) }, note: 'فتحتا التعليق في الأعلى' })
      panels.push({
        id: 'peg', name: 'خطّاف', w: t + pL, h: hk + ph, count: n,
        cuts: [rect(0, 0, t + pL - ph, hk), rect(0, hk, t, 1.5), rect(0, hk + ph - 1.5, t, 1.5)],
        post: loops => { roundCorner(loops, round3(t + pL - ph), 0, ph / 2 - 0.5); roundCorner(loops, round3(t + pL), 0, ph / 2 - 0.5) },
        note: 'لسانه في شقّ اللوحة، وطرفه مرفوع يمسك الحلقة',
      })
      return { panels, notes: ['ألصق الخطّافات بألسنتها في الشقوق، ثم الرف ودعامتيه؛ علّق اللوحة بمسمارين في فتحتي التعليق.', 'اكتب «مفاتيح» أو اسم العائلة على اللوحة بالحفر في RDWorks.'], warnings, errors }
    },
  },
  {
    id: 'wallshelf',
    name: 'رف حائط',
    desc: 'رف جداري بلوح خلفي وجانبين ورفوف أوسط في شقوق، يُعلّق بفتحتين.',
    icon: `<path d="M10 10h44v44H10z"/><path d="M10 28h44M10 42h44" stroke-width="3"/><circle cx="22" cy="14" r="1.5"/><circle cx="42" cy="14" r="1.5"/>`,
    params: [mm('W', 'العرض', 80, 800), mm('H', 'الارتفاع', 80, 800), mm('D', 'العمق', 40, 300), { key: 'M', label: 'رفوف أوسط', min: 0, max: 8, step: 1, int: true }, { key: 'rails', label: 'حاجز أمامي', min: 0, max: 1, step: 1, int: true }, mm('railH', 'ارتفاع الحاجز', 10, 60), mm('margin', 'هامش أعلى الشقّ', 3, 50), mm('fit', 'خلوص الشقوق', 0, 1)],
    defaults: { W: 400, H: 300, D: 140, M: 1, rails: 0, railH: 25, margin: 8, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: t, H: 2 * t }),
    build: shelfBuild('shelf'),
  },
  {
    id: 'spicerack',
    name: 'رف بهارات',
    desc: 'رف جداري بطوابق وحاجز أمامي عند كل رف يمنع البرطمانات من السقوط؛ للمطبخ والعطور والطلاء.',
    icon: `<path d="M12 8h40v48H12z"/><path d="M12 24h40M12 40h40" stroke-width="2.5"/><path d="M12 20h40M12 36h40M12 52h40" stroke-width="1.2"/><path d="M18 14h6v6h-6zM30 14h6v6h-6zM18 30h6v6h-6z" stroke-width="1.2"/>`,
    params: [mm('W', 'العرض', 80, 800), mm('H', 'الارتفاع', 80, 800), mm('D', 'العمق', 40, 300), { key: 'M', label: 'رفوف أوسط', min: 0, max: 8, step: 1, int: true }, { key: 'rails', label: 'حاجز أمامي', min: 0, max: 1, step: 1, int: true }, mm('railH', 'ارتفاع الحاجز', 10, 60), mm('margin', 'هامش أعلى الشقّ', 3, 50), mm('fit', 'خلوص الشقوق', 0, 1)],
    defaults: { W: 300, H: 400, D: 80, M: 2, rails: 1, railH: 25, margin: 6, fit: 0.2 },
    innerAdd: t => ({ W: 2 * t, D: t, H: 2 * t }),
    build: shelfBuild('spice'),
  },
)

/** A closed polygon from sampled points (dense enough that controllers treat it as a curve). */
const ring = (cx: number, cy: number, r: number, n = 96) => Array.from({ length: n }, (_, k) => ({ x: cx + r * Math.cos((2 * Math.PI * k) / n), y: cy + r * Math.sin((2 * Math.PI * k) / n) }))
const starPts = (cx: number, cy: number, R: number, Ri: number, points: number, rot = -Math.PI / 2) =>
  Array.from({ length: 2 * points }, (_, k) => { const a = rot + (k * Math.PI) / points, r = k % 2 ? Ri : R; return { x: round3(cx + r * Math.cos(a)), y: round3(cy + r * Math.sin(a)) } })
const engraveLoop = (pts: { x: number; y: number }[]): Loop => ({ closed: true, layer: 'engrave', pts: pts.map(v => ({ x: round3(v.x), y: round3(v.y) })) })

/** Two flat pieces cross-lapped into an X: A takes its slot from the top, B from the bottom; arms on both sides. */
function crossTree(p: Record<string, number>, c: Common, o: { arms: (piece: 0 | 1) => number[]; aL: number; aw: number; hook: number; notches?: number; holes?: boolean }) {
  const { H, fit } = p, t = c.t, sw = t + fit
  const tw = Math.max(36, t + 24), fh = Math.max(18, 4 * t), w = round3(Math.max(p.F, tw + 2 * o.aL + 2)), cx = w / 2
  const piece = (k: 0 | 1): PanelSpec => {
    const cuts: ReturnType<typeof rect>[] = [], holes: Loop[] = [], tips: [number, number][] = []
    const ys = o.arms(k)
    const fx0 = round3(cx - p.F / 2), fx1 = round3(cx + p.F / 2)
    // everything beside the trunk above the foot goes, except the arms (and their hooks)
    for (const side of [-1, 1]) {
      const xin = side < 0 ? cx - tw / 2 : cx + tw / 2, xout = xin + side * o.aL
      const lo = Math.min(xin, xout), hi = Math.max(xin, xout)
      const edge0 = side < 0 ? 0 : hi, edge1 = side < 0 ? lo : w // beyond the arm's end
      const bands: [number, number][] = ys.map((y): [number, number] => [y - o.hook, y + o.aw]).sort((a, b) => a[0] - b[0])
      let y = 0
      const sideRect = (y0: number, y1: number) => { if (y1 > y0) cuts.push(side < 0 ? rect(0, y0, cx - tw / 2, y1 - y0) : rect(cx + tw / 2, y0, w - cx - tw / 2, y1 - y0)) }
      for (const [b0, b1] of bands) {
        sideRect(y, b0)
        const ya = b0 + o.hook
        if (edge1 > edge0) cuts.push(rect(edge0, b0, edge1 - edge0, b1 - b0)) // past the arm's end
        if (o.hook > 0) {
          // the hook rises at the arm's outer end
          const hx0 = side < 0 ? lo : hi - o.aw, hx1 = hx0 + o.aw
          if (side < 0) cuts.push(rect(hx1, b0, xin - hx1, o.hook)); else cuts.push(rect(xin, b0, hx0 - xin, o.hook))
          tips.push([round3(hx0), round3(b0)], [round3(hx1), round3(b0)])
        }
        for (let j = 0; j < (o.notches ?? 0); j++) { const nx = lo + ((j + 1) * (hi - lo)) / ((o.notches ?? 0) + 1); cuts.push(rect(round3(nx - 1.5), ya, 3, 2.5)) }
        if (o.holes) { const m = Math.floor((hi - lo - 10) / 6); for (let j = 0; j < m; j++) holes.push(circle(round3(lo + 8 + j * 6 + ((hi - lo - 10) - (m - 1) * 6 - 6) / 2), round3(ya + o.aw / 2 + 1.25), 1.1)) }
        y = b1
      }
      sideRect(y, H - fh)
      // the foot is narrower than the piece when the arms reach further
      if (side < 0 && fx0 > 0) cuts.push(rect(0, H - fh, fx0, fh))
      if (side > 0 && fx1 < w) cuts.push(rect(fx1, H - fh, w - fx1, fh))
    }
    cuts.push(k === 0 ? rect(cx - sw / 2, 0, sw, H / 2) : rect(cx - sw / 2, H / 2, sw, H / 2))
    return {
      id: k === 0 ? 'tree-a' : 'tree-b', name: k === 0 ? 'الجذع — شقّه من الأعلى' : 'الجذع — شقّه من الأسفل', w, h: H, cuts, holes,
      post: loops => { for (const [x, y] of tips) roundCorner(loops, x, y, o.aw / 2 - 0.5); roundCorner(loops, fx0, round3(H - fh), fh / 2); roundCorner(loops, fx1, round3(H - fh), fh / 2) },
      note: k === 0 ? 'يتقاطع مع الثاني على شكل X' : 'يدخل في شقّ الأول من الأسفل',
    }
  }
  return [piece(0), piece(1)]
}

MORE.push(
  {
    id: 'coasters',
    name: 'طقم كوسترات مع حامل',
    desc: 'كوسترات مستديرة أو مربّعة بنقش محفور، وحامل صغير يحفظها؛ هدية مطلوبة وسريعة القصّ.',
    icon: `<circle cx="24" cy="26" r="14"/><path d="M24 16l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" stroke-width="1.5"/><path d="M36 38h20v16H36z"/><path d="M38 38v-6h16v6" stroke-width="1.5"/>`,
    params: [mm('Dm', 'قطر الكوستر', 70, 150), { key: 'shape', label: 'الشكل', min: 1, max: 2, step: 1, int: true, hint: '1 = دائري، 2 = مربّع بزوايا مستديرة' }, { key: 'n', label: 'العدد', min: 1, max: 12, step: 1, int: true }, { key: 'deco', label: 'نقش محفور', min: 0, max: 1, step: 1, int: true }, { key: 'holder', label: 'حامل', min: 0, max: 1, step: 1, int: true }],
    defaults: { Dm: 100, shape: 1, n: 6, deco: 1, holder: 1 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const { Dm } = p, t = c.t, n = Math.round(p.n), sq = Math.round(p.shape) === 2, R = Dm / 2
      const deco: Loop[] = Math.round(p.deco) > 0 ? [engraveLoop(ring(R, R, R - 5)), engraveLoop(starPts(R, R, 0.36 * Dm, 0.36 * Dm * 0.765, 8, 0)), engraveLoop(starPts(R, R, 0.2 * Dm, 0.2 * Dm * 0.765, 8, Math.PI / 8))] : []
      const coaster: PanelSpec = sq
        ? { id: 'coaster', name: 'كوستر', w: Dm, h: Dm, count: n, engrave: deco, post: loops => { for (const [x, y] of [[0, 0], [Dm, 0], [Dm, Dm], [0, Dm]]) roundCorner(loops, x, y, 12) } }
        : { id: 'coaster', name: 'كوستر', w: Dm, h: Dm, count: n, shape: [disc(R, R, R)], engrave: deco }
      const panels: PanelSpec[] = [coaster]
      if (Math.round(p.holder) > 0) {
        const W = round3(Dm + 2 * t + 3), H = round3(Math.max(n * t + 5, 4 * t + 2)), r = round3(Math.min(16, (H - t) * 0.7, W / 4))
        const box = openBox(W, W, H)
        for (const sp of box) if (sp.id === 'front') sp.post = loops => edgeNotch(loops, W / 2, 0, r)
        panels.push(...box.map(b => ({ ...b, name: 'الحامل — ' + b.name })))
      }
      return { panels, notes: [`${n} كوستر بقطر ${Dm} مم${Math.round(p.holder) > 0 ? '، وحامل بفتحة إصبع في الأمام لسحبها' : ''}.`, 'ادهنها بورنيش مقاوم للماء أو اقصّها من أكريليك؛ اكتب اسماً أو شعاراً في الوسط بالحفر في RDWorks.'], warnings, errors }
    },
  },
  {
    id: 'clock',
    name: 'ساعة حائط',
    desc: 'وجه ساعة دائري أو مربّع بعلامات الساعات مقصوصة أو محفورة، وثقب لماكينة الكوارتز.',
    icon: `<circle cx="32" cy="32" r="22"/><path d="M32 14v5M32 45v5M14 32h5M45 32h5" stroke-width="2.5"/><path d="M32 32V22M32 32l7 5" stroke-width="2"/>`,
    params: [mm('Dm', 'القطر', 150, 600), { key: 'shape', label: 'الشكل', min: 1, max: 2, step: 1, int: true, hint: '1 = دائري، 2 = مربّع' }, mm('hole', 'ثقب الماكينة', 6, 12, 'معظم ماكينات الكوارتز 7.5–8 مم'), { key: 'marks', label: 'العلامات', min: 1, max: 2, step: 1, int: true, hint: '1 = مقصوصة، 2 = محفورة' }, { key: 'deco', label: 'نقش محفور', min: 0, max: 1, step: 1, int: true }],
    defaults: { Dm: 300, shape: 1, hole: 8, marks: 1, deco: 1 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p) {
      const warnings: string[] = [], errors: string[] = []
      const { Dm, hole } = p, R = Dm / 2, sq = Math.round(p.shape) === 2, cut = Math.round(p.marks) === 1
      const marks: Loop[] = Array.from({ length: 12 }, (_, k) => {
        const a = (k * Math.PI) / 6 - Math.PI / 2, big = k % 3 === 0, L = (big ? 0.12 : 0.06) * R, wM = Math.max(3, (big ? 0.035 : 0.022) * R), rc = R - 0.06 * R - L / 2
        return rotatedRectHole(round3(R + rc * Math.cos(a)), round3(R + rc * Math.sin(a)), L, wM, a)
      })
      const engrave: Loop[] = [...(cut ? [] : marks.map(m => ({ ...m, layer: 'engrave' as const }))), ...(Math.round(p.deco) > 0 ? [engraveLoop(ring(R, R, R - 0.03 * R, 160)), engraveLoop(starPts(R, R, 0.6 * R, 0.6 * R * 0.765, 8, 0)), engraveLoop(ring(R, R, 0.6 * R * 0.765 * 0.92, 160))] : [])]
      const face: PanelSpec = {
        id: 'face', name: 'وجه الساعة', w: Dm, h: Dm, holes: [circle(R, R, hole / 2), ...(cut ? marks : [])], engrave,
        ...(sq ? { post: (loops: Loop[]) => { for (const [x, y] of [[0, 0], [Dm, 0], [Dm, Dm], [0, Dm]]) roundCorner(loops, x, y, 0.08 * Dm) } } : { shape: [disc(R, R, R)] }),
      }
      return { panels: [face], notes: ['ركّب ماكينة كوارتز بعمود طوله أكبر من سماكة الخشب بـ 3 مم على الأقل، وعقاربها بطول نحو 0.4 و0.3 من القطر.', 'الماكينة فيها علّاقة؛ أضف اسماً أو شعاراً بالحفر في RDWorks.'], warnings, errors }
    },
  },
  {
    id: 'keychains',
    name: 'ميداليات مفاتيح بالجملة',
    desc: 'ميداليات بأشكال مختلفة بثقب للحلقة وإطار محفور، تُقصّ بالعشرات لتُكتب عليها الأسماء والشعارات.',
    icon: `<circle cx="20" cy="24" r="10"/><circle cx="20" cy="18" r="2"/><path d="M38 14h16v20H38z"/><circle cx="46" cy="18" r="2"/><path d="M22 44c0-4 6-4 6 0 0-4 6-4 6 0l-6 8z"/>`,
    params: [mm('S', 'المقاس', 25, 80), { key: 'shape', label: 'الشكل', min: 1, max: 5, step: 1, int: true, hint: '1 = دائرة، 2 = مستطيل، 3 = قلب، 4 = نجمة، 5 = سداسي' }, { key: 'n', label: 'العدد', min: 1, max: 60, step: 1, int: true }, mm('hole', 'ثقب الحلقة', 3, 6), { key: 'border', label: 'إطار محفور', min: 0, max: 1, step: 1, int: true }],
    defaults: { S: 45, shape: 1, n: 12, hole: 4.5, border: 1 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p) {
      const warnings: string[] = [], errors: string[] = []
      const { S, hole } = p, kind = Math.round(p.shape), n = Math.round(p.n), cx = S / 2, rh = hole / 2, b = Math.round(p.border) > 0
      let shape: Loop, h = S, hx = cx, hy = rh + 3.5, border: Loop[] = []
      if (kind === 2) {
        h = round3(S * 0.62)
        shape = { closed: true, pts: [] }
        border = b ? [{ ...roundedRectHole(3, 3, S - 6, h - 6, 4), layer: 'engrave' }] : []
      } else if (kind === 3) {
        h = round3(0.95 * S); shape = oriented(heart(cx, h / 2, S), 'outer'); hx = cx - S / 4; hy = h / 2 - 0.225 * S
        if (S / 4 - rh < 3) errors.push(`القلب صغير على ثقب الحلقة: ${Math.ceil(4 * (rh + 3))} مم على الأقل.`)
      } else if (kind === 4) {
        shape = polyLoop(starPts(cx, cx, S / 2, S / 4.2, 5), 'outer'); hy = cx
        if (S / 4.2 * Math.cos(Math.PI / 5) - rh < 2.5) errors.push(`النجمة صغيرة على ثقب الحلقة: ${Math.ceil(4.2 * (rh + 2.5) / Math.cos(Math.PI / 5))} مم على الأقل.`)
      } else if (kind === 5) {
        const R = S / 2; h = round3(S * Math.sqrt(3) / 2)
        shape = polyLoop(starPts(cx, h / 2, R, R, 3, 0), 'outer'); hy = rh + 3.5
        border = b ? [engraveLoop(starPts(cx, h / 2, R - 3 / Math.cos(Math.PI / 6), R - 3 / Math.cos(Math.PI / 6), 3, 0))] : []
      } else {
        shape = disc(cx, cx, cx)
        border = b ? [engraveLoop(ring(cx, cx, cx - 3))] : []
      }
      if (kind !== 3 && kind !== 4 && b) hy = Math.max(hy, 3 + rh + 3)
      const panel: PanelSpec = {
        id: 'keychain', name: 'ميدالية', w: S, h, count: n, holes: [circle(round3(hx), round3(hy), rh)], engrave: border,
        ...(kind === 2 ? { post: (loops: Loop[]) => { for (const [x, y] of [[0, 0], [S, 0], [S, h], [0, h]]) roundCorner(loops, x, y, 6) } } : { shape: [shape] }),
      }
      return { panels: [panel], notes: [`${n} ميدالية؛ الحلقات المعدنية تُشترى بالجملة.`, 'اكتب الأسماء أو الشعار داخل الإطار المحفور في RDWorks، ثم اقصّ دفعة واحدة. الأكريليك الملوّن والخشب كلاهما مناسب.'], warnings, errors }
    },
  },
  {
    id: 'ramadanornaments',
    name: 'زينة رمضان: هلال ونجمة',
    desc: 'أهلّة ونجوم معلّقة بثقوب للخيط، لتزيين البيوت والمحلّات في رمضان والعيد؛ تُقصّ بالجملة.',
    icon: `<path d="M30 12a20 20 0 1 0 14 34 16 16 0 1 1-14-34z"/><path d="M48 14l2 5 5 .5-4 3.5 1 5-4-3-4 3 1-5-4-3.5 5-.5z" stroke-width="1.5"/>`,
    params: [mm('S', 'المقاس', 50, 400), { key: 'n', label: 'عدد الأهلّة', min: 0, max: 30, step: 1, int: true }, { key: 'ns', label: 'عدد النجوم', min: 0, max: 30, step: 1, int: true }, mm('hole', 'ثقب الخيط', 2, 6)],
    defaults: { S: 140, n: 4, ns: 4, hole: 3.5 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p) {
      const warnings: string[] = [], errors: string[] = []
      const { S, hole } = p, n = Math.round(p.n), ns = Math.round(p.ns), R = S / 2, rh = hole / 2
      if (n + ns === 0) errors.push('اختر هلالاً أو نجمة واحدة على الأقل.')
      const panels: PanelSpec[] = []
      if (n > 0) {
        // inside the circle (R, centre C1) and outside a smaller circle shifted towards the opening
        const c2 = { x: 0.32 * R, y: -0.12 * R }, r2 = 0.78 * R, dd = Math.hypot(c2.x, c2.y)
        const aC = Math.atan2(c2.y, c2.x), half = Math.acos((R * R + dd * dd - r2 * r2) / (2 * R * dd))
        const A1 = aC - half, B1 = aC + half // the cusps, seen from C1
        const pts: { x: number; y: number }[] = []
        const steps = 120
        for (let i = 0; i <= steps; i++) { const a = B1 + ((2 * Math.PI - 2 * half) * i) / steps; pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) }) }
        const pA = { x: R * Math.cos(A1), y: R * Math.sin(A1) }, pB = { x: R * Math.cos(B1), y: R * Math.sin(B1) }
        const a2A = Math.atan2(pA.y - c2.y, pA.x - c2.x), a2B = Math.atan2(pB.y - c2.y, pB.x - c2.x)
        let sweep = a2B - a2A; while (sweep <= 0) sweep += 2 * Math.PI
        // back along the inner circle from A to B, the way that runs inside the outer circle
        const inner: { x: number; y: number }[] = []
        for (let i = 1; i < steps; i++) { const a = a2A - ((2 * Math.PI - sweep) * i) / steps; inner.push({ x: c2.x + r2 * Math.cos(a), y: c2.y + r2 * Math.sin(a) }) }
        const outline = [...pts, ...inner].map(v => ({ x: round3(v.x + R), y: round3(v.y + R) }))
        // the hanging hole where the crescent is thick enough, as near the top as possible
        let hp = { x: 0, y: 0 }
        for (let deg = -100; deg >= -175; deg -= 2) {
          const a = (deg * Math.PI) / 180, u = { x: Math.cos(a), y: Math.sin(a) }
          const bq = u.x * c2.x + u.y * c2.y, d2 = bq + Math.sqrt(bq * bq - (dd * dd - r2 * r2))
          if (R - d2 >= hole + 6) { hp = { x: R + ((R + d2) / 2) * u.x, y: R + ((R + d2) / 2) * u.y }; break }
        }
        if (!hp.x) errors.push(`الهلال صغير على ثقب الخيط: ${Math.ceil(2 * (hole + 6) / 0.55)} مم على الأقل.`)
        else panels.push({ id: 'crescent', name: 'هلال', w: S, h: S, count: n, shape: [polyLoop(outline, 'outer')], holes: [circle(round3(hp.x), round3(hp.y), rh)] })
      }
      if (ns > 0) {
        const Rs = 0.4 * S, Ri = Rs * 0.5
        if (Ri * Math.cos(Math.PI / 5) * 0.6 - rh < 2) errors.push('النجمة صغيرة على ثقب الخيط.')
        panels.push({ id: 'star', name: 'نجمة', w: 2 * Rs, h: 2 * Rs, count: ns, shape: [polyLoop(starPts(Rs, Rs, Rs, Ri, 5), 'outer')], holes: [circle(round3(Rs), round3(Rs - Ri * 0.55), rh)] })
      }
      return { panels, notes: ['علّقها بخيط ذهبي أو نايلون شفّاف؛ الأكريليك الذهبي والمرآة يعطيان لمعة جميلة.', 'للبيع بالجملة: كبّر العدد ليملأ اللوح كاملاً.'], warnings, errors }
    },
  },
  {
    id: 'mugtree',
    name: 'شجرة أكواب',
    desc: 'حامل أكواب من لوحين متقاطعين (X) بأذرع مرفوعة الأطراف، يقف على المطبخ ويحمل 4 أكواب أو أكثر.',
    icon: `<path d="M30 8h4v42h-4z"/><path d="M14 54h36" stroke-width="3"/><path d="M30 20H16v-4M34 20h14v-4M30 34H18v-4M34 34h12v-4" stroke-width="2"/>`,
    params: [mm('H', 'الارتفاع', 200, 600), mm('F', 'عرض القاعدة', 120, 400), mm('arm', 'طول الذراع', 40, 120), { key: 'levels', label: 'الطوابق في كل لوح', min: 1, max: 3, step: 1, int: true, hint: 'كل طابق = 4 أكواب' }, mm('fit', 'خلوص التقاطع', 0, 1)],
    defaults: { H: 330, F: 220, arm: 75, levels: 1, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t, aw = Math.max(12, 3 * t), hook = 14, fh = Math.max(18, 4 * t), step = 55, lv = Math.round(p.levels)
      const yLow = p.H - fh - 125 // a mug about 11 cm tall hangs clear of the foot
      const top = yLow - (2 * lv - 1) * step - hook
      if (top < 15) errors.push(`الارتفاع لا يكفي لـ ${lv} ${lv > 1 ? 'طوابق' : 'طابق'}: ${Math.ceil(p.H - top + 15)} مم على الأقل.`)
      const panels = crossTree(p, c, { arms: k => Array.from({ length: lv }, (_, j) => round3(yLow - (2 * j + k) * step)), aL: p.arm, aw, hook })
      return { panels, notes: [`${4 * lv * 2} أكواب: ${lv} ${lv > 1 ? 'طوابق' : 'طابق'} في كل لوح، ذراعان في كل طابق، والأذرع متعامدة بين اللوحين.`, 'أدخل اللوح ذا الشقّ السفلي فوق ذي الشقّ العلوي حتى تتساوى قمّتاهما، والصق عند التقاطع.'], warnings, errors, slotted: true }
    },
  },
  {
    id: 'jewelrytree',
    name: 'شجرة مجوهرات',
    desc: 'لوحان متقاطعان بأذرع فيها حزوز للقلائد والأساور وثقوب صغيرة للأقراط؛ تقف على التسريحة.',
    icon: `<path d="M30 8h4v42h-4z"/><path d="M16 54h32" stroke-width="3"/><path d="M30 18H18M34 18h12M30 30H14M34 30h16" stroke-width="3"/><path d="M20 20v6M44 20v6M18 32v6" stroke-width="1.2"/>`,
    params: [mm('H', 'الارتفاع', 150, 500), mm('F', 'عرض القاعدة', 100, 300), mm('arm', 'طول الذراع', 30, 100), { key: 'levels', label: 'الطوابق في كل لوح', min: 1, max: 4, step: 1, int: true }, mm('fit', 'خلوص التقاطع', 0, 1)],
    defaults: { H: 260, F: 160, arm: 55, levels: 2, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t, aw = 14, fh = Math.max(18, 4 * t), lv = Math.round(p.levels)
      const span = p.H - fh - 70, step = span / (2 * lv)
      if (step < aw + 14) errors.push(`الارتفاع لا يكفي لـ ${lv} طوابق: ${Math.ceil((aw + 14) * 2 * lv + fh + 70)} مم على الأقل.`)
      const panels = crossTree(p, c, { arms: k => Array.from({ length: lv }, (_, j) => round3(20 + (2 * j + k) * step)), aL: p.arm, aw, hook: 0, notches: Math.max(1, Math.floor(p.arm / 18)), holes: true })
      return { panels, notes: ['الحزوز في أعلى الأذرع للقلائد والأساور، والثقوب الصغيرة للأقراط ذات المشبك.', 'ركّب اللوحين متقاطعين والصق؛ ضع تحتها صحناً صغيراً للخواتم إن شئت.'], warnings, errors, slotted: true }
    },
  },
  {
    id: 'birdhouse',
    name: 'بيت عصافير',
    desc: 'بيت عصافير بسقف جمالوني يُرفع للتنظيف، فتحة دخول ومجثم، ثقوب تهوية وتصريف، ويُعلّق على الجدار.',
    icon: `<path d="M10 28 32 8l22 20"/><path d="M14 26v28h36V26"/><circle cx="32" cy="36" r="5"/><path d="M32 44v5" stroke-width="2.5"/>`,
    params: [mm('W', 'العرض', 80, 250), mm('D', 'العمق', 80, 250), mm('H', 'ارتفاع الجدار', 80, 300), mm('g', 'ارتفاع الجملون', 25, 120), mm('ov', 'بروز السقف', 0, 30), mm('entry', 'قطر فتحة الدخول', 25, 50, 'العصافير الصغيرة 28–32، الأكبر 38–45'), { key: 'perch', label: 'ثقب المجثم', min: 0, max: 1, step: 1, int: true }, mm('gap', 'خلوص السقف', 0.2, 2)],
    defaults: { W: 130, D: 130, H: 150, g: 60, ov: 14, entry: 32, perch: 1, gap: 0.5 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const house = TEMPLATES.find(x => x.id === 'teahouse')!
      const res = house.build({ W: p.W, D: p.D, H: p.H, g: p.g, ov: p.ov, gap: p.gap, slotH: 10, bag: 30, pattern: 0, cell: 12 }, c)
      const errors = (res.errors ?? []).filter(e => !/كيس|الأكياس/.test(e)), warnings = res.warnings
      const t = c.t, { W, D, H, g, entry } = p
      const ey = g + Math.max(H * 0.3, entry / 2 + 12)
      if (entry / 2 + 2 * t + 6 > W / 2) errors.push(`فتحة الدخول أعرض من الواجهة: أقصاها ${Math.floor(2 * (W / 2 - 2 * t - 6))} مم.`)
      if (ey + entry / 2 + (p.perch ? 22 : 0) > g + H - t - 10) errors.push('الجدار قصير على فتحة الدخول والمجثم.')
      const panels = res.panels
      const front = panels.find(x => x.id === 'front')!, back = panels.find(x => x.id === 'back')!, bottom = panels.find(x => x.id === 'bottom')!, side = panels.find(x => x.id === 'side')!
      front.holes = [circle(W / 2, round3(ey), entry / 2), ...(p.perch ? [circle(W / 2, round3(ey + entry / 2 + 14), 3.25)] : [])]
      front.note = 'فتحة الدخول وتحتها ثقب المجثم (عود 6 مم)'
      back.holes = [keyhole(W / 2, round3(g + 18), 4, 4, 7)]; back.note = 'فتحة تعليق على الجدار'
      bottom.holes = [[16, 16], [W - 16, 16], [W - 16, D - 16], [16, D - 16]].map(([x, y]) => circle(x, y, 2.5))
      side.holes = [circle(D / 2 - 15, 12, 3), circle(D / 2 + 15, 12, 3)]
      return { panels, notes: ['اترك الخشب بلا دهان من الداخل؛ ادهن الخارج بورنيش مائي آمن.', 'المجثم عود خشبي 6 مم يُلصق في ثقبه. علّق البيت بمسمار في فتحة الظهر بعيداً عن الشمس المباشرة.', 'السقف يُرفع كاملاً لتنظيف البيت بعد كل موسم؛ مثلّثا التثبيت يُلصقان تحته كما في بيت الشاي.', ...res.notes.filter(n => /السقف|مثلّث/.test(n) && !/الأكياس/.test(n))], warnings, errors }
    },
  },
  {
    id: 'ramadanlantern',
    name: 'فانوس رمضان',
    desc: 'فانوس بنوافذ قوسية في جدرانه الأربع، تاج فوق الغطاء وحلقة للتعليق؛ تضيئه شمعة LED أو دواية.',
    icon: `<path d="M18 24h28v28H18z"/><path d="M14 20h36v4H14zM22 14h20v6H22z"/><circle cx="32" cy="8" r="4"/><path d="M24 50V36a8 8 0 0 1 16 0v14" stroke-width="1.5"/>`,
    params: [...DIMS, mm('socket', 'قطر فتحة الدواية', 0, 80, '0 = بلا (شمعة LED)'), mm('lipH', 'ارتفاع شفة الغطاء', 4, 60), mm('gap', 'خلوص الشفة', 0.2, 2), mm('foot', 'ارتفاع القاعدة المرتفعة', 0, 40), mm('ringD', 'قطر حلقة التعليق', 25, 80), mm('fit', 'خلوص الشقّ', 0, 1)],
    defaults: { W: 120, D: 120, H: 200, socket: 0, lipH: 10, gap: 0.5, foot: 0, ringD: 44, fit: 0.15 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const lantern = TEMPLATES.find(x => x.id === 'lantern')!
      const res = lantern.build({ ...p, vent: 0, pattern: 3, cell: 8 }, c)
      const errors = [...(res.errors ?? [])], warnings = res.warnings.filter(w => !/الزخرفة/.test(w))
      const t = c.t, { W, D, H, lipH, ringD, fit } = p
      const m = 2 * t + 2, top = Math.max(m, lipH + 2) + 4, bot = H - t - m - 4
      const arch = (w: number): Loop[] => {
        const x0 = m + 4, ww = w - 2 * x0, hh = bot - top
        if (ww < 20 || hh < 30) return []
        return [hh > ww / 2 + 5 ? archHole(x0, top, ww, hh) : roundedRectHole(x0, top, ww, hh, 4)]
      }
      for (const sp of res.panels) {
        if (sp.id === 'front' || sp.id === 'back') sp.holes = arch(W)
        if (sp.id === 'side') sp.holes = arch(D)
      }
      // the crown: a smaller plate glued on the lid, and a ring standing in its slot
      const Wc = round3(Math.max(40, Math.min(W, D) * 0.6)), tw = round3(Math.min(14, ringD * 0.35)), Rr = ringD / 2, rw = Math.max(6, 2 * t)
      const phi = Math.asin(tw / 2 / Rr), pts: { x: number; y: number }[] = []
      for (let i = 0; i <= 80; i++) { const a = Math.PI / 2 + phi + ((2 * Math.PI - 2 * phi) * i) / 80; pts.push({ x: Rr + Rr * Math.cos(a), y: Rr + Rr * Math.sin(a) }) }
      pts.push({ x: Rr + tw / 2, y: 2 * Rr + t }, { x: Rr - tw / 2, y: 2 * Rr + t })
      res.panels.push(
        { id: 'crown', name: 'التاج', w: Wc, h: Wc, holes: [rotatedRectHole(Wc / 2, Wc / 2, tw + fit, t + fit, 0)], post: loops => { for (const [x, y] of [[0, 0], [Wc, 0], [Wc, Wc], [0, Wc]]) roundCorner(loops, x, y, Wc / 6) }, note: 'يُلصق في وسط الغطاء' },
        { id: 'hang', name: 'حلقة التعليق', w: ringD, h: round3(ringD + t), shape: [polyLoop(pts.map(v => ({ x: round3(v.x), y: round3(v.y) })), 'outer')], holes: [circle(Rr, Rr, Rr - rw)], note: 'لسانها في شقّ التاج' },
      )
      return { panels: res.panels, notes: ['النوافذ القوسية تُغطّى من الداخل بورق ملوّن أو أكريليك حليبي أو قماش شفّاف.', 'التاج يُلصق في وسط الغطاء والحلقة في شقّه؛ يُرفع الغطاء لوضع شمعة LED أو تبديل المصباح. لا تستعمل شمعة حقيقية.', ...res.notes.filter(n => !/الزخرفة/.test(n))], warnings, errors }
    },
  },
)

/**
 * Room a ring needs in a box whose insert holds it in a slit shorter than the ring: the ring rests on the slit, its
 * centre sqrt(R² − (slit/2)²) above the insert, so above the insert it needs R + that + the stone; below the insert's
 * top it sinks R − that. Sized for the largest usual engagement ring: 22 mm across, a 7 mm stone.
 */
function ringRoom(slitL: number, t: number) {
  const R = 11, stone = 7, c = Math.sqrt(Math.max(0, R * R - (slitL / 2) ** 2))
  return { above: R + c + stone, sink: R - c, minSpacer: Math.max(5, R - c - t + 2) }
}

/**
 * A circle of radius R centred at (cx, cy), cut flat along y = yc below the centre, with tabs hanging L below the flat
 * at the given centres. The two arcs are real bulges (a mirror edge must not show facets); their sense is picked by area.
 */
function flatDisc(cx: number, cy: number, R: number, yc: number, tabs: number[], tw: number, L: number): Loop {
  const c = Math.sqrt(R * R - (yc - cy) ** 2), xl = round3(cx - c), xr = round3(cx + c)
  const sweep = Math.atan2(yc - cy, c) + Math.PI / 2, k = Math.tan(sweep / 4)
  const make = (b: number): Loop => {
    const pts: { x: number; y: number; b?: number }[] = [{ x: xl, y: round3(yc) }]
    for (const x of [...tabs].sort((a, b2) => a - b2)) pts.push({ x: round3(x - tw / 2), y: round3(yc) }, { x: round3(x - tw / 2), y: round3(yc + L) }, { x: round3(x + tw / 2), y: round3(yc + L) }, { x: round3(x + tw / 2), y: round3(yc) })
    pts.push({ x: xr, y: round3(yc), b }, { x: round3(cx), y: round3(cy - R), b })
    return { closed: true, pts }
  }
  const a = make(k), bb = make(-k)
  return oriented(Math.abs(signedArea(a)) > Math.abs(signedArea(bb)) ? a : bb, 'outer')
}

/**
 * The outline of heart(cx, cy, w) grown by d all round: lobes of radius w/4 + d meeting above the notch, the sides moved
 * out by d with a rounded join at the lobes and a pointed tip. Sampled finely (≤ 2°) so it cuts as smoothly as an arc.
 */
function heartOffset(cx: number, cy: number, w: number, d: number): Loop {
  const r = w / 4, top = cy - w * 0.225, T = { x: cx, y: top + w * 0.7 }, Rp = r + d
  const len = Math.hypot(2 * r, 0.7 * w), sinA = (2 * r) / len
  const nR = { x: (0.7 * w) / len, y: (2 * r) / len } // outward normal of the right side (down and to the right)
  const pts: { x: number; y: number }[] = [{ x: cx, y: T.y + d / sinA }]
  const arc = (c: { x: number; y: number }, rad: number, a0: number, a1: number) => {
    const k = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 90)))
    for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; pts.push({ x: c.x + rad * Math.cos(a), y: c.y + rad * Math.sin(a) }) }
  }
  const h = Math.sqrt(Rp * Rp - r * r)
  arc({ x: cx + 2 * r, y: top }, d, Math.atan2(nR.y, nR.x), 0)              // round the right corner
  arc({ x: cx + r, y: top }, Rp, 0, Math.atan2(-h, -r))                       // over the right lobe to the notch
  arc({ x: cx - r, y: top }, Rp, Math.atan2(-h, r), -Math.PI)                 // over the left lobe
  arc({ x: cx - 2 * r, y: top }, d, Math.PI, Math.PI - Math.atan2(nR.y, nR.x)) // round the left corner
  const out = pts.filter((v, i) => i === 0 || Math.hypot(v.x - pts[i - 1].x, v.y - pts[i - 1].y) > 1e-4)
  return polyLoop(out.map(v => ({ x: round3(v.x), y: round3(v.y) })), 'outer')
}

MORE.push({
  id: 'engagement',
  name: 'طقم خطوبة: مرآة وقاعدة وعلبتا محابس',
  desc: 'مرآة دائرية تقف على قاعدة بطبقتين، علبتا محابس بغطاء يقف مفتوحاً وحشوة بشقّ للمحبس، قلب ومربّعان للأسماء والتاريخ.',
  icon: `<circle cx="32" cy="24" r="17"/><path d="M8 46h48v6H8z"/><path d="M12 38h10v8H12zM42 38h10v8H42z"/><path d="M12 38l3-6h7v6M42 38l3-6h7v6" stroke-width="1.5"/><path d="M29 42c0-2 3-2 3 0 0-2 3-2 3 0l-3 3z" fill="currentColor" stroke="none"/><path d="M24 22h16M26 27h12" stroke-width="1.2"/>`,
  params: [
    mm('Dd', 'قطر المرآة', 150, 500), mm('W', 'عرض القاعدة', 200, 600), mm('D', 'عمق القاعدة', 100, 300),
    { key: 'layers', label: 'طبقات القاعدة', min: 1, max: 3, step: 1, int: true, hint: 'ألسنة المرآة والدعامتين تنفذ فيها كلّها' },
    { key: 'rings', label: 'علب المحابس', min: 0, max: 2, step: 1, int: true },
    mm('rbW', 'عرض علبة المحبس', 45, 80), mm('rbH', 'ارتفاع علبة المحبس', 38, 70), mm('slitW', 'عرض شقّ المحبس', 1.5, 4, 'سماكة حلقة المحبس مع خلوص بسيط'),
    mm('slitL', 'طول شقّ المحبس', 8, 30, 'أقصر قليلاً من قطر المحبس الخارجي (17–22 مم) فيجلس فيه واقفاً'),
    mm('hw', 'عرض القلب', 0, 120, '0 = بلا قلب'), mm('sq', 'مقاس المربّع', 0, 80, 'مربّعان للأسماء أو التاريخ؛ 0 = بلا'),
    { key: 'backing', label: 'طبقة إطار تحت القلب والمربّعين', min: 0, max: 1, step: 1, int: true, hint: 'قطعة أكبر بـ 3–4 مم من كل جهة بلون مختلف، كما في الصورة' },
    { key: 'marks', label: 'علامات مواضع القطع', min: 0, max: 1, step: 1, int: true, hint: 'خطوط محفورة على القاعدة تحت كل قطعة تماماً، فتختفي بعد اللصق' },
    { key: 'border', label: 'إطار محفور على المرآة', min: 0, max: 1, step: 1, int: true },
    mm('fit', 'خلوص الشقوق', 0, 1),
  ],
  defaults: { Dd: 300, W: 400, D: 170, layers: 2, rings: 2, rbW: 55, rbH: 45, slitW: 2.5, slitL: 14, hw: 60, sq: 42, backing: 1, marks: 1, border: 0, fit: 0.15 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, { W, D, Dd, fit } = p
    const n = Math.round(p.layers), L = round3(n * t), R = Dd / 2
    const rings = Math.round(p.rings), back = Math.round(p.backing) > 0
    if (Dd > W - 10) errors.push(`المرآة أعرض من القاعدة: اجعل عرض القاعدة ${Math.ceil(Dd + 10)} مم على الأقل.`)
    // the mirror: flat along a chord at the bottom, two tabs through every base layer
    const ch = round3(0.22 * Dd), cut = R - Math.sqrt(R * R - ch * ch), yc = round3(2 * R - cut)
    const tw = round3(Math.min(30, Math.max(10, 0.25 * ch))), tabX = [round3(R - 0.6 * ch), round3(R + 0.6 * ch)]
    const mirror: PanelSpec = {
      id: 'mirror', name: 'المرآة الدائرية', w: Dd, h: round3(yc + L), shape: [flatDisc(R, R, R, yc, tabX, tw, L)],
      // the border follows the mirror's outline 10 mm in, along the flat bottom too
      engrave: Math.round(p.border) > 0 ? [{ ...flatDisc(R, R, R - 10, yc - 10, [], 0, 0), layer: 'engrave' as const }] : [],
      note: 'تُكتب عليها الآية والأسماء بالحفر في RDWorks',
    }
    // two braces behind it, perpendicular, their front edges glued to its back
    const db = round3(Math.max(40, 0.18 * Dd)), hb = round3(0.42 * Dd), b0 = round3(0.25 * db), b1 = round3(0.75 * db)
    const brace: PanelSpec = {
      id: 'brace', name: 'دعامة المرآة', w: db, h: round3(hb + L), count: 2,
      shape: [polyLoop([{ x: 0, y: 0 }, { x: 0, y: hb }, { x: b0, y: hb }, { x: b0, y: round3(hb + L) }, { x: b1, y: round3(hb + L) }, { x: b1, y: hb }, { x: db, y: hb }, { x: 6, y: 0 }], 'outer')],
      note: 'حافّتها العمودية تُلصق على ظهر المرآة، ولسانها في شقّ القاعدة',
    }
    // the base: the mirror stands near the back, everything else in a row in front of it
    const m = 10, mf = 12, yd = round3(D - m - db - t / 2)
    const slots: Loop[] = [
      ...tabX.map(x => rotatedRectHole(round3(W / 2 + x - R), yd, tw + fit, t + fit, 0)),
      ...[-1, 1].map(sd => rotatedRectHole(round3(W / 2 + sd * 0.35 * ch), round3(yd + t / 2 + (b0 + b1) / 2), t + fit, b1 - b0 + fit, 0)),
    ]
    const rbW = p.rbW, rbD = round3(rbW - 5), rbH = p.rbH
    // the heart's backing grows it 4 mm all round (its tip a little more, being pointed)
    const hTip = 4 / (0.5 / Math.hypot(0.5, 0.7))
    const hwF = p.hw > 0 ? p.hw + (back ? 8 : 0) : 0, hhF = p.hw > 0 ? 0.95 * p.hw + (back ? 4 + hTip : 0) : 0, hcY = mf + (back ? 4 : 0) + 0.475 * p.hw
    const sqF = p.sq > 0 ? p.sq + (back ? 6 : 0) : 0
    const front = yd - t / 2 - mf
    const deepest = Math.max(rings > 0 ? rbD + 8 : 0, hhF, sqF)
    if (deepest + 5 > front) errors.push(`القاعدة غير عميقة بما يكفي للقطع أمام المرآة: اجعل العمق ${Math.ceil(D + deepest + 5 - front)} مم على الأقل.`)
    const xRing = round3(m + 4 + rbW / 2)
    const sqX = round3(hwF > 0 ? hwF / 2 + 8 + sqF / 2 : sqF / 2 + 5) // with no heart the squares keep 10 mm between them
    const rowHalf = (sqF > 0 ? sqX + sqF / 2 : hwF / 2) + 6
    if (rings > 0 && W / 2 - rowHalf < xRing + rbW / 2) errors.push(`القاعدة أضيق من أن تتّسع للعلبتين والقلب والمربّعين في صفّ واحد: اجعل العرض ${Math.ceil(2 * (rowHalf + m + 4 + rbW))} مم على الأقل.`)
    if (rings === 0 && W / 2 - rowHalf < m) errors.push(`القاعدة أضيق من القلب والمربّعين: اجعل العرض ${Math.ceil(2 * (rowHalf + m))} مم على الأقل.`)
    // placement marks: a rectangle 3 mm inside each box's footprint, a small cross at the centre of the heart and of each
    // square; all of them lie well inside the pieces, so they disappear once the pieces are glued
    const ringXs = rings === 2 ? [xRing, W - xRing] : rings === 1 ? [xRing] : []
    const cross = (x: number, y: number, a: number): Loop[] => [
      { closed: false, layer: 'engrave', pts: [{ x: round3(x - a), y: round3(y) }, { x: round3(x + a), y: round3(y) }] },
      { closed: false, layer: 'engrave', pts: [{ x: round3(x), y: round3(y - a) }, { x: round3(x), y: round3(y + a) }] },
    ]
    const marks: Loop[] = []
    if (Math.round(p.marks) > 0) {
      for (const x of ringXs) marks.push(engraveRect(round3(x - rbW / 2 + 3), round3(mf + 3), rbW - 6, rbD - 6))
      if (hwF > 0) marks.push(...cross(W / 2, hcY, Math.min(6, hwF / 6)))
      if (sqF > 0) for (const sd of [-1, 1]) marks.push(...cross(W / 2 + sd * sqX, mf + sqF / 2, Math.min(6, sqF / 5)))
    }
    const rounded = (w: number, h: number, r: number) => (loops: Loop[]) => { for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) roundCorner(loops, x, y, r) }
    const panels: PanelSpec[] = [
      mirror, brace,
      { id: 'base-top', name: 'القاعدة — الطبقة العليا', w: W, h: D, holes: slots, engrave: marks, post: rounded(W, D, 14), note: 'شقّا ألسنة المرآة وشقّا الدعامتين' },
      ...(n > 1 ? [{ id: 'base-under', name: 'القاعدة — الطبقة السفلى', w: W, h: D, count: n - 1, material: 'black', holes: slots.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v })) })), post: rounded(W, D, 14), note: 'الشقوق نفسها لتنفذ فيها الألسنة' }] : []),
    ]
    if (p.hw > 0) {
      const hp = oriented(heart(p.hw / 2, 0.95 * p.hw / 2, p.hw), 'outer')
      panels.push({ id: 'heart', name: 'القلب', w: p.hw, h: round3(0.95 * p.hw), shape: [hp], note: 'رأسه المدبّب نحو الأمام؛ تُحفر عليه الحروف الأولى' })
      // the border is a true 4 mm offset of the heart, so it stays 4 mm wide at the notch between the lobes too
      if (back) panels.push({ id: 'heart-back', name: 'إطار القلب', w: hwF, h: round3(hhF), material: 'black', shape: [heartOffset(p.hw / 2 + 4, 0.95 * p.hw / 2 + 4, p.hw, 4)], note: 'يُلصق تحت القلب بلون مختلف' })
    }
    if (p.sq > 0) {
      panels.push({ id: 'square', name: 'مربّع الاسم', w: p.sq, h: p.sq, count: 2, material: 'white', post: rounded(p.sq, p.sq, 4), note: 'لاسم أو تاريخ' })
      if (back) panels.push({ id: 'square-back', name: 'إطار المربّع', w: sqF, h: sqF, count: 2, material: 'black', post: rounded(sqF, sqF, 7), note: 'يُلصق تحت المربّع' })
    }
    const ringNotes: string[] = []
    if (rings > 0) {
      // each ring box is the stay-open hinged box, with an insert: a plate with a slit for the ring, on two spacers
      const box = TEMPLATES.find(x => x.id === 'hinged90')!
      const rb = box.build({ W: rbW, D: rbD, H: rbH, ...HINGE_DEFAULTS, stop: 95 }, c)
      // the box's own messages name its controls; here they are the ring-box size and the material thickness
      const own = (msg: string) => 'علبة المحبس: ' + msg.replace(/«[^»]*»/g, 'عرض العلبة أو ارتفاعها').replace(/زاوية التوقّف/g, 'قياس العلبة')
      for (const e of rb.errors ?? []) errors.push(own(e))
      for (const w of rb.warnings) warnings.push(own(w))
      for (const pn of rb.panels) panels.push({ ...pn, id: 'ring-' + pn.id, name: 'علبة المحبس — ' + pn.name, count: (pn.count ?? 1) * rings, material: 'white' })
      ringNotes.push(...rb.notes.map(nt => 'علبة المحبس: ' + nt))
      // the insert sits as high as the ring allows: the lid rests on the rim (rbH), the floor's top is t up
      const room = ringRoom(p.slitL, t)
      const Wp = round3(rbW - 2 * t - 1), Dp = round3(rbD - 2 * t - 1), hs = round3(rbH - t - t - room.above - 1)
      if (hs < room.minSpacer) errors.push(`علبة المحبس قصيرة على المحبس: يلزم ارتفاع ${Math.ceil(2 * t + room.minSpacer + room.above + 1)} مم (محبس حتى 22 مم بحجر 7 مم يجلس في الشقّ ويُغلق فوقه الغطاء).`)
      const slitL = p.slitL
      if (slitL > Wp - 10) errors.push(`شقّ المحبس أطول من الحشوة: أقصاه ${Math.floor(Wp - 10)} مم.`)
      panels.push(
        { id: 'ring-insert', name: 'علبة المحبس — الحشوة', w: Wp, h: Dp, count: rings, material: 'white', holes: slitL <= Wp - 10 ? [stadium(Wp / 2, Dp / 2, slitL, p.slitW)] : [], note: 'شقّها يمسك حلقة المحبس واقفاً' },
        { id: 'ring-spacer', name: 'علبة المحبس — حامل الحشوة', w: Wp, h: Math.max(hs, 1), count: 2 * rings, material: 'white', note: 'اثنان على حافّتيهما عند الأمام والخلف تحت الحشوة' },
      )
    }
    const notes = [
      `المرآة ${Dd} مم تقف بلسانيها في شقوق القاعدة (${n} ${n > 1 ? 'طبقات' : 'طبقة'})، وتسندها من الخلف دعامتان تُلصق حافّتاهما على ظهرها.`,
      'الآية والأسماء والتاريخ: صمّمها في RDWorks أو CorelDRAW وضعها فوق المرآة. لكتابة بيضاء مطفية كما في الصورة احفر على الوجه الأمامي للمرآة (بعد نزع ورق الحماية عنه) بقدرة منخفضة. الحفر على الظهر المطليّ (والتصميم معكوس) يجعل الحروف شفّافة يُرى ما خلفها، فتظهر الدعامتان خلف الأسطر السفلى.',
      ...(rings > 0 ? [`${rings === 2 ? 'علبتا المحابس' : 'علبة المحبس'} ${rbW} × ${rbD} × ${rbH} مم بغطاء مفصلي يقف مفتوحاً عند 95°، وفي كلّ علبة حشوة بشقّ ${p.slitW} × ${p.slitL} مم يجلس فيه المحبس واقفاً، فوق حاملين؛ لإمساك أنعم ألصق على الحشوة شريط مخمل واقطع الشقّ فيه.`] : []),
      `الترتيب على القاعدة من اليسار: ${[...(rings > 0 ? ['علبة'] : []), ...(sqF > 0 ? ['مربّع'] : []), ...(hwF > 0 ? ['القلب'] : []), ...(sqF > 0 ? ['مربّع'] : []), ...(rings > 1 ? ['علبة'] : [])].join('، ')}؛ ${Math.round(p.marks) > 0 ? 'العلامات المحفورة (مستطيل لكل علبة، وإشارة + لمركز القلب وكل مربّع) تختفي تحت القطع.' : 'ضعها بالترتيب أمام المرآة.'}`,
      'المرآة والطبقة العليا للقاعدة والقلب والدعامتان من أكريليك مرآة (فضّي أو ذهبي)، والعلب والمربّعان من أكريليك أبيض، والإطارات والطبقة السفلى من أسود، كما في الصورة. kerf الأكريليك عادةً 0.1 مم.',
      ...ringNotes,
    ]
    return { panels, notes, warnings, errors }
  },
})

/** A regular hexagon by its width across flats, flats top and bottom, centred at (cx, cy). */
const hexPts = (cx: number, cy: number, af: number) => { const rc = af / Math.sqrt(3); return Array.from({ length: 6 }, (_, k) => ({ x: round3(cx + rc * Math.cos((k * Math.PI) / 3)), y: round3(cy + rc * Math.sin((k * Math.PI) / 3)) })) }

MORE.push({
  id: 'hexringbox',
  name: 'علبة محبس سداسية بإطارات',
  desc: 'علبة سداسية من أكريليك شفّاف: ستّ جدران بين قاعدة وطوق علوي بارزين، غطاء يُرفع بشفة داخلية، حشوة بشقّ للمحبس، وإطارات أوفست ذهبية أو فضية على كل جهة وعلى الغطاء.',
  icon: `<path d="M20 14h24l10 9-10 9H20l-10-9z"/><path d="M10 23v22l10 9h24l10-9V23"/><path d="M20 32v22M44 32v22" stroke-width="1.5"/><path d="M23 37h18v13H23z" stroke-width="1.3"/><path d="M24 18h16l6 5-6 5H24l-6-5z" stroke-width="1.3"/>`,
  params: [
    mm('S', 'عرض السداسي بين ضلعين متقابلين', 40, 160, 'قياس الجدران من الخارج؛ علبة المحبس العادية 55–65 مم'),
    mm('H', 'ارتفاع الجدران', 25, 120),
    mm('ov', 'بروز القاعدة والطوق والغطاء', 2, 10, 'تبرز عن الجدران بهذا القدر، فيقع الإطار بينها'),
    mm('b', 'عرض الإطار', 2, 15), mm('tf', 'سماكة لوح الإطار', 0.5, 4, 'أكريليك مرآة ذهبي أو فضي، عادةً 1–2 مم'),
    { key: 'lipL', label: 'طبقات شفة الغطاء', min: 1, max: 2, step: 1, int: true, hint: 'حلقة سداسية تُلصق تحت الغطاء وتدخل بين الجدران' },
    mm('gap', 'خلوص الشفة', 0.2, 1),
    { key: 'insert', label: 'حشوة المحبس', min: 0, max: 1, step: 1, int: true }, mm('slitW', 'عرض شقّ المحبس', 1.5, 4),
    mm('slitL', 'طول شقّ المحبس', 8, 30, 'أقصر قليلاً من قطر المحبس الخارجي (17–22 مم) فيجلس فيه واقفاً'),
    mm('fit', 'خلوص الشقوق', 0, 0.5),
  ],
  defaults: { S: 62, H: 40, ov: 3, b: 5, tf: 2, lipL: 1, gap: 0.3, insert: 1, slitW: 2.5, slitL: 14, fit: 0.1 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, { S, H, ov, b, tf, gap, fit } = p, r3 = Math.sqrt(3)
    // square-cut walls meeting at 120°: each is as wide as the inner hexagon's side, so their inner corners meet on the
    // inner vertices and nothing overlaps. Square ends touch only along that line, so the walls are held by tabs at both
    // ends instead: into the base and into a collar ring on top, which makes the six walls one closed, aligned tube.
    // The outer V left at each corner is hidden by the frames, which are as wide as the outer side (their back corners
    // meet on the outer vertices)
    const sOut = S / r3, sIn = round3((S - 2 * t) / r3), AFb = S + 2 * ov
    if (sIn < 12) errors.push(`السداسي صغير على هذه السماكة: ${Math.ceil(12 * r3 + 2 * t)} مم على الأقل.`)
    if (tf + 0.5 > ov) warnings.push(`الإطار (${tf} مم) أسمك من بروز القاعدة والطوق (${ov} مم)؛ سيبرز خارجهما. زد البروز إلى ${Math.ceil(tf + 0.5)} مم.`)
    const fw = round3(sOut), fh = round3(H - 1)
    if (fw - 2 * b < 6 || fh - 2 * b < 6) errors.push(`الإطار عريض على هذه الجهة: أقصى عرض ${Math.floor(Math.min(fw, fh) / 2 - 3)} مم.`)
    // each frame's side borders reach t/√3 past its wall, over the corner groove; what is left rests on the wall
    const land = b - t / r3
    if (land < 1.5) errors.push(`الإطار أضيق من أن يُلصق: حافّته الجانبية تمتدّ ${(t / r3).toFixed(1)} مم فوق أخدود الزاوية؛ اجعل عرض الإطار ${Math.ceil(t / r3 + 1.5)} مم على الأقل.`)
    // walls: H between base and collar, plus a t-deep strip of tabs at each end
    const tabs = sIn >= 28 ? [0.27, 0.73] : [0.5], tw = round3(Math.min(12, sIn * (tabs.length > 1 ? 0.24 : 0.4)))
    const tx = tabs.map(k => round3(sIn * k))
    const strip: ReturnType<typeof rect>[] = []
    for (const y of [0, H + t]) {
      let x0 = 0
      for (const x of tx) { strip.push(rect(x0, y, x - tw / 2 - x0, t)); x0 = x + tw / 2 }
      strip.push(rect(x0, y, sIn - x0, t))
    }
    // base slots: the walls' mid-planes lie ov + t/2 inside the base's edge, on every side
    const cb = { x: AFb / r3, y: AFb / 2 }, rm = S / 2 - t / 2
    const slots: Loop[] = []
    for (let k = 0; k < 6; k++) {
      const ph = ((k + 0.5) * Math.PI) / 3, ux = -Math.sin(ph), uy = Math.cos(ph)
      for (const x of tx) { const off = x - sIn / 2; slots.push(rotatedRectHole(round3(cb.x + rm * Math.cos(ph) + off * ux), round3(cb.y + rm * Math.sin(ph) + off * uy), tw + fit, t + fit, ph + Math.PI / 2)) }
    }
    const hexPanel = (id: string, name: string, af: number, holes: Loop[], note: string, count = 1): PanelSpec => ({ id, name, w: round3(2 * af / r3), h: round3(af), count, shape: [polyLoop(hexPts(af / r3, af / 2, af), 'outer')], holes, note })
    const ring = (af: number, afIn: number) => polyLoop(hexPts(af / r3, af / 2, afIn), 'hole')
    // the collar: the base's outline with the same slots and an opening 3 mm inside the walls; the lid sits on it and
    // its lip, a hexagonal ring, drops into the opening
    const AFin = S - 2 * t, AFc = round3(AFin - 6), lo = round3(AFc - 2 * gap), lw = Math.max(3, 1.2 * t), li = round3(lo - 2 * lw)
    if (li < 10) errors.push('السداسي صغير على شفة الغطاء.')
    const lipL = Math.round(p.lipL)
    const panels: PanelSpec[] = [
      hexPanel('base', 'القاعدة', AFb, slots, 'تبرز عن الجدران من كل جهة؛ الشقوق لألسنة الجدران'),
      { id: 'wall', name: 'الجدار', w: sIn, h: round3(H + 2 * t), count: 6, cuts: strip, note: 'ستّة متماثلة، بألسنة في الأعلى والأسفل؛ زواياها الداخلية تلتقي' },
      { ...hexPanel('collar', 'الطوق العلوي', AFb, [...slots.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v })) })), ring(AFb, AFc)], 'تدخل فيه ألسنة الجدران العلوية فتثبت أطرافها؛ يجلس عليه الغطاء') },
      hexPanel('lid', 'الغطاء', AFb, [], 'بقياس القاعدة نفسه'),
      hexPanel('lip', 'شفة الغطاء', lo, [ring(lo, li)], 'تُلصق تحت الغطاء في وسطه وتدخل في فتحة الطوق', lipL),
      { id: 'frame', name: 'إطار الجهة (ذهبي/فضي)', w: fw, h: fh, count: 6, material: 'mirror', holes: [roundedRectHole(b, b, fw - 2 * b, fh - 2 * b, 0)], note: 'يُلصق على الجدار من الخارج' },
      { ...hexPanel('lid-frame', 'إطار الغطاء (ذهبي/فضي)', round3(AFb - 2), [ring(round3(AFb - 2), round3(AFb - 2 - 2 * b))], 'يُلصق على الغطاء من الأعلى'), material: 'mirror' },
    ]
    if (Math.round(p.insert) > 0) {
      // a hexagonal plate with a slit on two spacers along opposite walls (put in before the collar); the ring's stone
      // keeps 12 mm under the lip, which hangs from the lid resting on the collar's top
      // the lid rests on the collar's top (H + t); the insert sits as high as the ring allows under it, and the lip ring
      // is clear of the ring as long as its opening is wider than the ring
      const room = ringRoom(p.slitL, t)
      const ai = round3(AFin - 1), hs = round3(H + t - t - room.above - 1), sl = round3(sIn - 1.2 * t - 1), slitL = p.slitL
      if (li < 16) errors.push('فتحة شفة الغطاء أضيق من رأس المحبس؛ كبّر السداسي أو قلّل السماكة.')
      if (slitL > ai / r3 - 6) errors.push(`شقّ المحبس أطول من الحشوة: أقصاه ${Math.floor(ai / r3 - 6)} مم.`)
      if (hs < room.minSpacer) errors.push(`الجدران قصيرة على المحبس والحشوة: ارتفاع ${Math.ceil(room.minSpacer + room.above + 1)} مم على الأقل، أو ألغِ الحشوة.`)
      panels.push(
        { ...hexPanel('insert', 'حشوة المحبس', ai, [stadium(ai / r3, ai / 2, slitL, p.slitW)], 'شقّها يمسك حلقة المحبس واقفاً'), w: round3(2 * ai / r3) },
        { id: 'spacer', name: 'حامل الحشوة', w: sl, h: Math.max(1, hs), count: 2, note: 'اثنان واقفان على حافّتيهما عند جدارين متقابلين' },
      )
    }
    const notes = [
      `العلبة ${S} مم بين ضلعين متقابلين (${(2 * S / r3).toFixed(1)} مم بين زاويتين)، والجدران ${H} مم بين القاعدة والطوق؛ القاعدة والطوق والغطاء ${AFb} مم. الارتفاع الكلّي مع الغطاء ${(H + 3 * t).toFixed(1)} مم.`,
      'ورق الحماية: اتركه أثناء القصّ، ثم انزعه قبل اللصق عن كل وجه سيُلصق أو سيُختم داخل العلبة: وجه القاعدة العلوي، وجهَي الطوق، أطراف الجدران ووجهيها، وجهَي الغطاء، الشفة، الحشوة وحامليها، وظهر الإطارات. اترك ورق الوجه الأمامي للإطارات حتى النهاية، وامسك القطع الشفّافة بقفّازات.',
      'التجميع: أدخل ألسنة الجدران الستّة في شقوق القاعدة وضع الطوق على ألسنتها العلوية بلا غراء ليستقيم كل شيء، ثم ألصق ألسنة القاعدة والزوايا بغراء الأكريليك السائل (يتسرّب في الشقّ) من الداخل عبر فتحة الطوق. بعد الجفاف ارفع الطوق، انزع ورق الحماية عن الوجوه الداخلية للجدران وعن الحشوة وحامليها، ضع الحاملين والحشوة في الداخل، ثم ألصق الطوق أخيراً.',
      `الإطارات ${fw.toFixed(1)} × ${fh} مم بعرض ${b} مم: ألصق كلّاً منها في وسط جهته بين القاعدة والطوق، فيلتقي طرفاه بطرفَي الإطارين المجاورين عند الزاوية ويخفيان أخدودها. على المرآة استعمل لاصقاً شفّافاً لا يذيب طلاء ظهرها (UV أو لاصق جِل)، لا غراء الأكريليك السائل.`,
      `الغطاء: ألصق الشفة تحته في الوسط، على بُعد ${((AFb - lo) / 2).toFixed(1)} مم من حافّته من كل جهة، ثم إطار الغطاء فوقه. الشفة تدخل في فتحة الطوق بخلوص ${gap} مم فيُفتح الغطاء ويُغلق بنعومة.`,
      'الجدران والقاعدة والطوق والغطاء والشفة والحشوة من أكريليك شفّاف (kerf نحو 0.1 مم)، والإطارات من أكريليك مرآة ذهبي أو فضي.',
    ]
    return { panels, notes, warnings, errors }
  },
})

// ------------------------------------------------------------------ wedding

/** Bulge of the arc from p to q about c that passes through m (b > 0 bows to the right of p → q, see geom.ts). */
function arcBulge(p: Pt, q: Pt, c: Pt, m: Pt): number {
  const tau = 2 * Math.PI, norm = (a: number) => ((a % tau) + tau) % tau, ang = (v: Pt) => Math.atan2(v.y - c.y, v.x - c.x)
  const plus = norm(ang(q) - ang(p)), theta = norm(ang(m) - ang(p)) < plus ? plus : tau - plus
  const side = -(m.x - p.x) * (q.y - p.y) + (m.y - p.y) * (q.x - p.x)
  return Math.sign(side) * Math.tan(theta / 4)
}

/**
 * The geometry of heart(cx, cy, w) and of the same heart eroded by b, the hole of a heart frame b wide: the lobes shrink
 * to radius w/4 − b about the same centres, the sides move in by b and meet at a tip 1.72 b above the outer one, and the
 * notch between the lobes becomes an arc of radius b about it (b of material all round, the notch included).
 */
function heartFrame(cx: number, cy: number, w: number, b: number) {
  const r = w / 4, top = cy - 0.225 * w, tipY = top + 0.7 * w, rho = r - b
  const len = Math.hypot(2 * r, 0.7 * w), d = { x: -2 * r / len, y: 0.7 * w / len }, nIn = { x: -0.7 * w / len, y: -2 * r / len }
  const A = { x: cx + 2 * r + b * nIn.x, y: top + b * nIn.y } // the right side moved in, running down along d
  const xAt = (y: number) => A.x + ((y - A.y) / d.y) * d.x
  const T = { x: cx, y: A.y + ((cx - A.x) / d.x) * d.y }
  // where the shrunk right lobe meets the moved side: the intersection nearer the corner
  const C = { x: cx + r, y: top }, f = { x: A.x - C.x, y: A.y - C.y }, fd = f.x * d.x + f.y * d.y
  const disc = fd * fd - (f.x * f.x + f.y * f.y) + rho * rho
  const s1 = -fd - Math.sqrt(Math.max(0, disc))
  const PR = { x: A.x + s1 * d.x, y: A.y + s1 * d.y }, PL = { x: 2 * cx - PR.x, y: PR.y }
  const JR = { x: cx + b, y: top }, JL = { x: cx - b, y: top }
  const bR = arcBulge(PR, JR, C, { x: cx + r, y: top - rho })
  const bN = arcBulge(JR, JL, { x: cx, y: top }, { x: cx, y: top + b })
  const bL = arcBulge(JL, PL, { x: cx - r, y: top }, { x: cx - r, y: top - rho })
  const v = (p: Pt, bb?: number) => ({ x: round3(p.x), y: round3(p.y), ...(bb ? { b: bb } : {}) })
  /** the eroded heart; with a band [y0, y1] across it, the part above the band and (when given) the part below */
  const holes = (band?: [number, number], lower = true): Loop[] => {
    if (!band) return [polyLoop([v(T), v(PR, bR), v(JR, bN), v(JL, bL), v(PL)], 'hole')]
    const [y0, y1] = band
    const out = [polyLoop([v({ x: xAt(y0), y: y0 }), v(PR, bR), v(JR, bN), v(JL, bL), v(PL), v({ x: 2 * cx - xAt(y0), y: y0 })], 'hole')]
    if (lower) out.push(polyLoop([v(T), v({ x: xAt(y1), y: y1 }), v({ x: 2 * cx - xAt(y1), y: y1 })], 'hole'))
    return out
  }
  return { r, top, tipY, rho, T, PR, ok: disc > 0 && rho > 0, holes, xAt, bandTop: top + b }
}

/** heart(cx, cy, w) as an outline with one stake under its tip, or two hanging from its sides spread ±sx; sw wide, the points L below the tip. */
function stakedHeart(cx: number, cy: number, w: number, stakes: number, sx: number, sw: number, L: number): Loop {
  const r = w / 4, top = cy - 0.225 * w, tipY = top + 0.7 * w, yE = tipY + L, pl = sw
  const yOf = (hw: number) => tipY - (hw * 0.7 * w) / (2 * r) // where the heart is ±hw wide
  const v = (x: number, y: number, b?: number) => ({ x: round3(x), y: round3(y), ...(b ? { b } : {}) })
  const lobes = [v(cx + 2 * r, top, 1), v(cx, top, 1), v(cx - 2 * r, top)]
  // counter-clockwise on screen (polyLoop turns it round): up the right side, over the lobes, down the left
  const pts = stakes === 1
    ? [v(cx, yE), v(cx + sw / 2, yE - pl), v(cx + sw / 2, yOf(sw / 2)), ...lobes, v(cx - sw / 2, yOf(sw / 2)), v(cx - sw / 2, yE - pl)]
    : [
      v(cx, tipY), v(cx + sx - sw, yOf(sx - sw)), v(cx + sx - sw, yE - pl), v(cx + sx - sw / 2, yE), v(cx + sx, yE - pl), v(cx + sx, yOf(sx)),
      ...lobes,
      v(cx - sx, yOf(sx)), v(cx - sx, yE - pl), v(cx - sx + sw / 2, yE), v(cx - sx + sw, yE - pl), v(cx - sx + sw, yOf(sx - sw)),
    ]
  return polyLoop(pts, 'outer')
}

/** Rectangles of the digit d in a gw × gh box at (x0, y0), strokes s wide: seven segments, and a 1 with a flag and a foot. */
function digitRects(d: number, x0: number, y0: number, gw: number, gh: number, s: number): Rect[] {
  // by corners, so strokes that meet edge to edge use the very same coordinate and merge into one piece
  const R = (xa: number, ya: number, xb: number, yb: number) => { const x = round3(x0 + xa), y = round3(y0 + ya); return rect(x, y, round3(x0 + xb) - x, round3(y0 + yb) - y) }
  if (d === 1) { const L = gw / 2 - s / 2, Rr = gw / 2 + s / 2; return [R(L, 0, Rr, gh), R(L - 0.28 * gw, 0, L, s), R(gw / 2 - 0.36 * gw, gh - s, gw / 2 + 0.36 * gw, gh)] }
  const m0 = (gh - s) / 2, m1 = (gh + s) / 2
  const seg: Record<string, Rect> = {
    a: R(0, 0, gw, s), b: R(gw - s, 0, gw, m1), c: R(gw - s, m0, gw, gh), d: R(0, gh - s, gw, gh), e: R(0, m0, s, gh), f: R(0, 0, s, m1), g: R(0, m0, gw, m1),
  }
  return [...['abcdef', '', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'][d]].map(k => seg[k])
}

/** A number as outlines, its corners softly rounded, centred on (cx, cy) with digits gh tall: one loop list per digit. */
function numberGlyphs(num: number, cx: number, cy: number, gh: number): { digit: number; loops: Loop[] }[] {
  const ds = String(num).split('').map(Number), gw = 0.56 * gh, s = 0.15 * gh, gap = 0.16 * gh
  const total = ds.length * gw + (ds.length - 1) * gap
  return ds.map((dg, i) => {
    const loops = unionRects(digitRects(dg, cx - total / 2 + i * (gw + gap), cy - gh / 2, gw, gh, s), [])
    for (const l of loops) for (const q of l.pts.map(p => ({ x: p.x, y: p.y }))) roundCorner([l], q.x, q.y, 0.3 * s)
    return { digit: dg, loops }
  })
}
/** An Arabic count: one, two (dual), three to ten (plural), eleven and up (singular accusative). */
const arCount = (n: number, [one, two, few, many]: [string, string, string, string]) => n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`
const numberWidth = (num: number, gh: number) => { const n = String(num).length; return n * 0.56 * gh + (n - 1) * 0.16 * gh }

MORE.push(
  {
    id: 'caketopper',
    name: 'توبر كيك العرس',
    desc: 'قلب مفرّغ بإطار ثابت العرض وشريط في وسطه لأسماء العروسين، على عودين (أو عود واحد) يُغرزان في الكيك؛ يُقصّ عادةً من أكريليك مرآة ذهبي.',
    icon: `<path d="M32 46 14 28a9 9 0 0 1 18-10 9 9 0 0 1 18 10z"/><path d="M20 27h24v6H20z" stroke-width="1.5"/><path d="M26 40v18M38 40v18" stroke-width="2.5"/>`,
    params: [
      mm('W', 'عرض القلب', 60, 300), mm('b', 'عرض الإطار', 3, 20, 'ثابت حول القلب كلّه، حتى عند الشقّ بين الفصّين'),
      mm('band', 'ارتفاع شريط الأسماء', 0, 60, '0 = قلب مفرّغ بلا شريط'),
      { key: 'stakes', label: 'عدد العيدان', min: 1, max: 2, step: 1, int: true }, mm('sw', 'عرض العود', 4, 12), mm('L', 'طول العود تحت القلب', 60, 160, 'الجزء المغروز في الكيك (4–6 سم) مع ما يظهر فوقه'),
      { key: 'n', label: 'العدد', min: 1, max: 20, step: 1, int: true },
    ],
    defaults: { W: 150, b: 7, band: 22, stakes: 2, sw: 6, L: 75, n: 1 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p) {
      const warnings: string[] = [], errors: string[] = []
      const { W, b, sw, L } = p, band = p.band, stakes = Math.round(p.stakes), n = Math.round(p.n)
      const cx = W / 2, cy = W / 4 + 0.225 * W // the lobes touch y = 0
      const hf = heartFrame(cx, cy, W, b)
      if (hf.rho < 5 || !hf.ok) errors.push(`الإطار عريض على هذا القلب: أقصاه ${Math.max(0, Math.floor(W / 4 - 5))} مم، أو كبّر القلب.`)
      const sx = Math.max(0.2 * W, sw + 3)
      if (stakes === 2 && sx > 0.4 * W) errors.push(`القلب ضيّق على عودين بهذا العرض: كبّر القلب إلى ${Math.ceil((sw + 3) / 0.4)} مم أو اختر عوداً واحداً.`)
      // the band crosses the heart where its hole has straight sides, below the notch; it sits a third of the way down
      let holes: Loop[] = [], bandAt: [number, number] | undefined
      if (!errors.length) {
        if (band > 0 && band < 8) errors.push('شريط الأسماء أرفع من 8 مم: لا يتّسع لحروف واضحة ويضعف؛ اجعله 8 مم أو أكثر، أو 0 لإلغائه.')
        else if (band > 0) {
          const lo = hf.bandTop + 2, hi = hf.T.y - 2
          if (lo + band > hi) errors.push(`شريط الأسماء أعرض من القلب: أقصاه ${Math.max(0, Math.floor(hi - lo))} مم.`)
          else {
            const mid = Math.min(Math.max(hf.top + 0.32 * W, lo + band / 2), hi - band / 2)
            bandAt = [round3(mid - band / 2), round3(mid + band / 2)]
          }
        }
        if (!errors.length) holes = hf.holes(bandAt, !!bandAt && hf.T.y - bandAt[1] >= 12)
      }
      const outline = stakedHeart(cx, cy, W, stakes, sx, sw, L)
      const panels: PanelSpec[] = [{ id: 'topper', name: 'التوبر', w: W, h: round3(W / 4 + 0.7 * W + L), count: n, shape: [outline], holes, note: bandAt ? 'الأسماء تُحفر على الشريط' : 'قلب مفرّغ' }]
      const notes = [
        `القلب ${W} مم عرضاً و${(0.95 * W).toFixed(0)} مم ارتفاعاً بإطار ${b} مم، و${stakes === 2 ? 'عودان' : 'عود'} بعرض ${sw} مم ينزل ${L} مم تحت رأس القلب؛ اغرز منه 4–6 سم في الكيك فيرتفع القلب ${Math.max(0, Math.round((L - 50) / 10))} سم تقريباً فوق سطحه.`,
        ...(bandAt ? [`شريط الأسماء ${band} مم: اكتب الاسمين أو «Mr & Mrs» في RDWorks ووسّطها على الشريط. على أكريليك المرآة احفر على الوجه الأمامي بقدرة منخفضة فتظهر الحروف بيضاء مطفية.`] : []),
        'أكريليك مرآة ذهبي 3 مم هو الأشيع للتوبر (والخشب 3 مم يصلح أيضاً). اترك ورق الحماية حتى التسليم، ولفّ طرف العود بشريط طعام قبل غرزه.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  {
    id: 'guestframe',
    name: 'لوحة قلوب الضيوف (دفتر توقيعات)',
    desc: 'إطار بنافذة قلب أو قوس خلفها لوح أكريليك شفّاف وتجويف؛ يوقّع كل ضيف على قلب صغير ويُسقطه من فتحة في الأعلى فيتجمّع خلف الزجاج ذكرى للعروسين.',
    icon: `<rect x="10" y="8" width="44" height="50" rx="3"/><path d="M32 50 20 38a6 6 0 0 1 12-7 6 6 0 0 1 12 7z" stroke-width="1.5"/><path d="M27 8h10" stroke-width="3"/><path d="M28 1l4 4 4-4" stroke-width="1.5"/><path d="M16 17h32" stroke-width="1.2"/>`,
    params: [
      mm('W', 'عرض اللوحة', 200, 700), mm('H', 'ارتفاع اللوحة', 250, 900), mm('b', 'عرض الإطار', 15, 80, 'الجانبان والأسفل'),
      mm('bt', 'عرض الإطار العلوي', 30, 200, 'أعرض من الباقي لتُحفر عليه أسماء العروسين والتاريخ'),
      { key: 'win', label: 'شكل النافذة', min: 1, max: 3, step: 1, int: true, hint: '1 = مستطيل، 2 = قلب، 3 = قوس' },
      { key: 'layers', label: 'طبقات التجويف', min: 2, max: 4, step: 1, int: true, hint: 'عمق التجويف بعدد السماكات؛ القلوب بسماكة واحدة فتسقط بسهولة' },
      mm('hw', 'عرض القلب الصغير', 25, 80), { key: 'n', label: 'عدد القلوب', min: 0, max: 300, step: 1, int: true },
      { key: 'deco', label: 'خط زخرفي حول النافذة', min: 0, max: 1, step: 1, int: true },
      { key: 'hang', label: 'فتحتا تعليق', min: 0, max: 1, step: 1, int: true }, mm('ocr', 'زوايا اللوحة', 0, 30),
    ],
    defaults: { W: 300, H: 400, b: 30, bt: 70, win: 2, layers: 2, hw: 45, n: 60, deco: 1, hang: 1, ocr: 6 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t, { W, H, b, bt, hw } = p, layers = Math.round(p.layers), win = Math.round(p.win), n = Math.round(p.n)
      const ww = W - 2 * b, wh = H - bt - b
      if (ww < 80 || wh < 80) errors.push(`النافذة أصغر من 80 مم: اجعل العرض ${Math.ceil(2 * b + 80)} مم والارتفاع ${Math.ceil(bt + b + 80)} مم على الأقل، أو صغّر الإطار.`)
      // the drop slot: as wide as a heart plus 10 mm, as deep as the cavity; a heart is one thickness, so 1.5 mm to spare
      const slot = round3(hw + 10)
      if (layers * t - t < 1.5) errors.push(`التجويف (${layers * t} مم) لا يترك للقلب خلوصاً كافياً: زد طبقات التجويف.`)
      if (slot > ww - 20) errors.push(`فتحة الإسقاط (${slot} مم) أعرض من التجويف: صغّر القلب الصغير أو كبّر اللوحة.`)
      if (n > 0 && hw - 4 * t < 8) errors.push(`القلب الصغير صغير على التوقيع وسيضعف: ${Math.ceil(4 * t + 8)} مم على الأقل.`)
      // roughly how many hearts the cavity holds: its volume over a heart's (0.546 hw² × t), about 60 % packed
      const fits = Math.floor((0.6 * ww * wh * layers) / (0.546 * hw * hw))
      if (n > fits && !errors.length) warnings.push(`التجويف يتّسع لنحو ${fits} قلباً فقط من هذا المقاس، لا ${n}: زد طبقات التجويف أو صغّر القلب أو كبّر اللوحة.`)
      const ocr = Math.max(0, Math.min(p.ocr, b - 4))
      const rounded = (loops: Loop[]) => { if (ocr > 0) for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) roundCorner(loops, x, y, ocr) }
      // the window, and the engraved line 5 mm outside it
      const archOk = wh > ww / 2 + 5
      if (win === 3 && !archOk) warnings.push('النافذة أعرض من أن تُقوَّس؛ صارت مستطيلة.')
      let windowLoop: Loop, decoLoop: Loop | null = null
      if (win === 2) {
        const hwW = Math.min(ww, wh / 0.95), hcy = bt + wh / 2
        // the heart shrunk by 3 mm: its notch is rounded, so no hair-thin point of wood is left between the lobes
        windowLoop = heartFrame(W / 2, hcy, hwW, 3).holes()[0]
        if (p.deco) decoLoop = heartOffset(W / 2, hcy, hwW, Math.min(5, b / 3) - 3) // the window is the heart less 3 mm
      } else if (win === 3 && archOk) {
        windowLoop = archHole(b, bt, ww, wh)
        if (p.deco) { const g = Math.min(5, b / 3); decoLoop = archHole(b - g, bt - g, ww + 2 * g, wh + 2 * g) }
      } else {
        windowLoop = roundedRectHole(b, bt, ww, wh, 8)
        if (p.deco) { const g = Math.min(5, b / 3); decoLoop = roundedRectHole(b - g, bt - g, ww + 2 * g, wh + 2 * g, 8 + g) }
      }
      // keyholes in the back, high in the top border; the spacers get a pocket there for the nail head
      const holes: Loop[] = [], pockets: Rect[] = []
      let keyGap = 0
      if (Math.round(p.hang) > 0) {
        const yk = (bt + 7) / 2, xk = W / 2 + Math.max(W / 4, slot / 2 + 12)
        if (bt < 32 || xk + 11 > W - b / 2) warnings.push('لا مكان لفتحتي التعليق في الإطار العلوي؛ كبّره أو ضع اللوحة على حامل لوحات.')
        else {
          for (const x of [W - xk, xk]) { holes.push(keyhole(round3(x), round3(yk), 4, 4, 7)); pockets.push(rect(round3(x - 7), round3(yk - 13), 14, 19)) }
          keyGap = round3(2 * xk - W)
        }
      }
      const panels: PanelSpec[] = [
        { id: 'front', name: 'الإطار الأمامي', w: W, h: H, post: rounded, holes: [windowLoop], engrave: decoLoop ? [{ ...decoLoop, layer: 'engrave' }] : [], note: 'تُحفر أسماء العروسين والتاريخ على الإطار العلوي' },
        { id: 'glass', name: 'لوح الأكريليك الشفّاف', w: W, h: H, post: rounded, material: 'clear', note: 'بين الإطار الأمامي والتجويف' },
        {
          id: 'spacer', name: 'طبقة التجويف', w: W, h: H, count: layers, post: rounded,
          cuts: [rect(b, bt, ww, wh), rect(round3(W / 2 - slot / 2), 0, slot, bt + 1), ...pockets], note: 'الفتحة في أعلاها مجرى القلوب',
        },
        { id: 'back', name: 'الظهر', w: W, h: H, post: rounded, holes, note: holes.length ? 'فتحتا التعليق في الأعلى' : 'الظهر' },
      ]
      if (n > 0) panels.push({ id: 'heart', name: 'قلب التوقيع', w: hw, h: round3(0.95 * hw), count: n, shape: [oriented(heart(hw / 2, 0.475 * hw, hw), 'outer')], note: 'يوقّع عليه الضيف ويُسقطه من الفتحة' })
      const notes = [
        `اللوحة ${W} × ${H} مم، سماكة طبقاتها الخشبية ${((layers + 2) * t).toFixed(1)} مم يُضاف إليها لوح الأكريليك. التجويف ${ww} × ${wh} مم بعمق ${(layers * t).toFixed(1)} مم، وفتحة الإسقاط في الحافّة العلوية ${slot} × ${(layers * t).toFixed(1)} مم.`,
        `الترتيب من الأمام: الإطار الأمامي، لوح الأكريليك، طبقات التجويف (${arCount(layers, ['طبقة', 'طبقتان', 'طبقات', 'طبقة'])})، الظهر. انزع ورق الحماية عن الأكريليك، ثم ألصق الطبقات والحواف متطابقة؛ الأكريليك بلاصق شفّاف على حافّته فقط، وأبقِ مجرى الفتحة نظيفاً من الغراء.`,
        ...(n > 0 ? [`${arCount(n, ['قلب واحد', 'قلبان', 'قلوب', 'قلباً'])} بعرض ${hw} مم بسماكة الخشب نفسها، وفتحة الإسقاط أعرض منها بـ 10 مم. ضع بجانب اللوحة قلماً وصحناً للقلوب.`] : []),
        ...(keyGap > 0 ? [`فتحتا التعليق بينهما ${keyGap} مم؛ دقّ مسمارين على هذا البعد، أو ضع اللوحة على حامل لوحات (easel).`] : ['ضع اللوحة على حامل لوحات (easel) في مدخل القاعة.']),
      ]
      return { panels, notes, warnings, errors }
    },
  },
  {
    id: 'sweetstand',
    name: 'ستاند حلويات بطوابق',
    desc: 'صحون مستديرة أو مربّعة متدرّجة على عمود من لوحين متقاطعين: كل صحن ينزلق من الأعلى ويستقرّ على كتف في العمود؛ ينفكّ ويُخزّن مسطّحاً. للكب كيك والحلويات والتوزيعات.',
    icon: `<path d="M8 54h48M14 38h36M20 22h24" stroke-width="3"/><path d="M32 54V10" stroke-width="3"/><circle cx="32" cy="8" r="2"/>`,
    params: [
      { key: 'tiers', label: 'عدد الطوابق', min: 2, max: 4, step: 1, int: true, hint: 'مع القاعدة' },
      mm('D1', 'قطر القاعدة (الصحن السفلي)', 180, 450), mm('step', 'نقصان القطر لكل طابق', 0, 120),
      mm('gap', 'الارتفاع بين الطوابق', 60, 250, 'الفراغ الصافي فوق كل صحن: ارتفاع الكب كيك أو الحلويات مع 2 سم'),
      { key: 'shape', label: 'شكل الصحون', min: 1, max: 2, step: 1, int: true, hint: '1 = دائري، 2 = مربّع بزوايا مدوّرة' },
      mm('topH', 'بروز العمود فوق الصحن الأعلى', 20, 120), mm('ledge', 'عرض كتف الصحن', 6, 15, 'ما يستند عليه كل صحن من كل جهة من العمود'),
      { key: 'deco', label: 'حلقة محفورة على الصحون', min: 0, max: 1, step: 1, int: true }, mm('fit', 'خلوص الشقوق', 0, 0.5),
    ],
    defaults: { tiers: 3, D1: 320, step: 70, gap: 110, shape: 1, topH: 40, ledge: 8, deco: 1, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t, { D1, step, gap, topH, ledge, fit } = p, k = Math.round(p.tiers), sq = Math.round(p.shape) === 2
      const sw = round3(t + fit)
      // the column's widths, top down: the top section, then one ledge wider on each side below every plate; the tab
      // through the base is 6 mm narrower each side than the section standing on it
      const w: number[] = [] // w[j]: the section above plate j (j = 1 is the base), j = 1..k
      w[k] = round3(Math.max(24, t + 16 + fit))
      for (let j = k - 1; j >= 1; j--) w[j] = round3(w[j + 1] + 2 * ledge)
      const w0 = round3(w[1] - 12)
      // heights from the base's top surface up: plate j (2..k) rests at z[j]
      const z: number[] = []
      z[1] = 0
      for (let j = 2; j <= k; j++) z[j] = round3((j - 1) * gap + (j - 2) * t)
      const top = round3(z[k] + t + topH), Hc = round3(top + t) // the column, from its top to the tab's end under the base
      const Dj = (j: number) => round3(D1 - (j - 1) * step)
      for (let j = 1; j <= k; j++) {
        const span = j === 1 ? w0 : w[j]
        if (Dj(j) < Math.max(100, span + 50)) { errors.push(`الصحن ${j === 1 ? 'السفلي' : `رقم ${j}`} صغير (${Dj(j)} مم): كبّر القاعدة أو قلّل النقصان، فأصغر صحن يلزمه ${Math.max(100, Math.ceil(span + 50))} مم.`); break }
      }
      if (D1 < 0.6 * Hc) errors.push(`الستاند عالٍ على قاعدته وقد ينقلب: اجعل قطر القاعدة ${Math.ceil(0.6 * Hc)} مم على الأقل أو قلّل الارتفاع بين الطوابق.`)
      // the column: two identical profiles, one slotted from the top to half height, the other from the bottom
      const W1 = w[1], cx = W1 / 2
      const yOf = (zz: number) => round3(top - zz)
      const sides: Rect[] = []
      const band = (y0: number, y1: number, wd: number) => { if (wd < W1 - 1e-9) for (const x of [0, cx + wd / 2]) sides.push(rect(round3(x), y0, round3((W1 - wd) / 2), round3(y1 - y0))) }
      band(0, yOf(z[k]), w[k])
      for (let j = k - 1; j >= 1; j--) band(yOf(z[j + 1]), yOf(z[j]), w[j])
      band(yOf(0), Hc, w0)
      const rTop = Math.max(0, Math.min(6, (w[k] - sw) / 2 - 1.5))
      const column = (id: string, name: string, fromTop: boolean): PanelSpec => ({
        id, name, w: W1, h: Hc, cuts: [...sides, fromTop ? rect(round3(cx - sw / 2), 0, sw, round3(Hc / 2)) : rect(round3(cx - sw / 2), round3(Hc / 2), sw, round3(Hc / 2))],
        post: loops => { if (rTop > 0) for (const x of [cx - w[k] / 2, cx + w[k] / 2]) roundCorner(loops, round3(x), 0, rTop) },
        note: fromTop ? 'يتقاطع مع الثاني على شكل +' : 'يدخل في شقّ الأول من الأسفل',
      })
      // each plate: a + shaped hole as wide as the column above its shoulder, plus the clearance
      const plus = (cxp: number, cyp: number, span: number): Loop => {
        const a = round3((span + fit) / 2), h = round3(sw / 2)
        return polyLoop([[h, -a], [-h, -a], [-h, -h], [-a, -h], [-a, h], [-h, h], [-h, a], [h, a], [h, h], [a, h], [a, -h], [h, -h]].map(([x, y]) => ({ x: round3(cxp + x), y: round3(cyp + y) })), 'hole')
      }
      const panels: PanelSpec[] = [column('column-a', 'العمود — شقّه من الأعلى', true), column('column-b', 'العمود — شقّه من الأسفل', false)]
      for (let j = 1; j <= k; j++) {
        const D = Dj(j), R = D / 2
        if (D <= 0) break
        const engrave: Loop[] = Math.round(p.deco) > 0 && R > 40 ? [sq ? { ...roundedRectHole(10, 10, D - 20, D - 20, Math.max(2, 0.1 * D - 10)), layer: 'engrave' } : { ...circle(R, R, R - 10), layer: 'engrave' }] : []
        panels.push({
          id: `plate-${j}`, name: j === 1 ? 'القاعدة (الصحن السفلي)' : `الصحن ${j}`, w: D, h: D, holes: [plus(R, R, j === 1 ? w0 : w[j])], engrave,
          ...(sq ? { post: (loops: Loop[]) => { for (const [x, y] of [[0, 0], [D, 0], [D, D], [0, D]]) roundCorner(loops, x, y, 0.1 * D) } } : { shape: [disc(R, R, R)] }),
          note: j === 1 ? 'لسان العمود ينفذ فيها' : `يستقرّ على كتف العمود على ارتفاع ${(z[j] + t).toFixed(0)} مم`,
        })
      }
      const notes = [
        `${arCount(k, ['طابق', 'طابقان', 'طوابق', 'طابقاً'])}: ${Array.from({ length: k }, (_, i) => Dj(i + 1)).join('، ')} مم، بينها ${gap} مم صافية. الارتفاع الكلّي ${(Hc).toFixed(0)} مم.`,
        'التجميع: أدخل اللوحين المتقاطعين في بعضهما (+)، ثم أدخل لسان العمود السفلي في فتحة القاعدة، ثم أنزل الصحون من الأعلى بالترتيب من الأكبر إلى الأصغر؛ كل صحن يمرّ فوق الأجزاء الأضيق ويستقرّ على كتفه. لا يحتاج غراء، وينفكّ للتخزين.',
        `كل صحن يستند على أربعة أكتاف عرضها ${ledge} مم. للحلويات الخفيفة يكفي 3 مم، وللأثقل (كيك حقيقي) استعمل 4–6 مم وكتفاً أعرض. غطِّ الصحون الخشبية بورق حلويات أو اقصّها من أكريليك.`,
      ]
      return { panels, notes, warnings, errors, slotted: true }
    },
  },
  {
    id: 'tablenumbers',
    name: 'أرقام طاولات العرس',
    desc: 'لوحات بأرقام متسلسلة تقف على قواعد بطبقات: الرقم محفور، أو مقصوص من أكريليك مرآة ذهبي ليُلصق على اللوحة. يقصّ لكل طاولة رقمها تلقائياً.',
    icon: `<path d="M18 48V20a14 14 0 0 1 28 0v28z"/><path d="M10 48h44v6H10z"/><path d="M27 24h10v4H27zM33 28h4v12h-4M27 36h10v4H27z" stroke-width="1.3"/>`,
    params: [
      mm('W', 'عرض اللوحة', 70, 220), mm('H', 'ارتفاع اللوحة فوق القاعدة', 100, 320),
      { key: 'shape', label: 'شكل اللوحة', min: 1, max: 2, step: 1, int: true, hint: '1 = قوس، 2 = مستطيل بزوايا مدوّرة' },
      { key: 'from', label: 'أول رقم', min: 0, max: 200, step: 1, int: true }, { key: 'n', label: 'عدد الطاولات', min: 1, max: 40, step: 1, int: true },
      { key: 'num', label: 'الرقم', min: 0, max: 2, step: 1, int: true, hint: '0 = بلا رقم، 1 = محفور (اجعل طبقته Scan في RDWorks فيمتلئ)، 2 = قطع مرآة ذهبية تُلصق' },
      mm('Db', 'عمق القاعدة', 40, 160), { key: 'layers', label: 'طبقات القاعدة', min: 1, max: 3, step: 1, int: true }, mm('fit', 'خلوص الشقوق', 0, 0.5),
    ],
    defaults: { W: 110, H: 180, shape: 1, from: 1, n: 10, num: 2, Db: 60, layers: 2, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t, { W, H, Db, fit } = p, arch = Math.round(p.shape) === 1, n = Math.round(p.n), from = Math.round(p.from), style = Math.round(p.num)
      const layers = Math.round(p.layers), L = round3(layers * t)
      if (W < 50) errors.push('اللوحة ضيّقة: 50 مم على الأقل.')
      if (H < (arch ? W / 2 + 30 : 60)) errors.push(`اللوحة قصيرة على عرضها: اجعل ارتفاعها ${Math.ceil(arch ? W / 2 + 30 : 60)} مم على الأقل.`)
      if (Db < Math.max(40, 0.28 * H)) errors.push(`القاعدة قصيرة على اللوحة وقد تنقلب: اجعل عمقها ${Math.ceil(Math.max(40, 0.28 * H))} مم على الأقل.`)
      // two tabs through every base layer
      const tw = round3(Math.min(30, Math.max(10, 0.2 * W))), tabX = [round3(0.25 * W), round3(0.75 * W)]
      const v = (x: number, y: number, b?: number) => ({ x: round3(x), y: round3(y), ...(b ? { b } : {}) })
      const bottom = [v(0, H), ...tabX.flatMap(x => [v(x - tw / 2, H), v(x - tw / 2, H + L), v(x + tw / 2, H + L), v(x + tw / 2, H)]), v(W, H)]
      const outline = arch ? polyLoop([v(0, W / 2), ...bottom, v(W, W / 2, 1)], 'outer') : polyLoop([v(0, 0), ...bottom, v(W, 0)], 'outer')
      const rTop = arch ? 0 : Math.min(12, W / 6)
      // the number: as tall as the face allows, centred on the face below the arch
      const last = from + n - 1, widest = Math.max(...Array.from({ length: n }, (_, i) => numberWidth(from + i, 1)))
      // the face the number may use: below the arch's narrow top (or 8 mm under a square top), 8 mm above the base
      const ya = arch ? 0.3 * W : 8, yb = H - 8
      const gh = round3(Math.min(0.45 * H, (0.76 * W) / widest, 110, yb - ya))
      const cy = round3(Math.min(Math.max(arch ? Math.max(W / 2, H * 0.52) : H / 2, ya + gh / 2), yb - gh / 2))
      if (style > 0 && 0.15 * gh < 3) errors.push(`الأرقام صغيرة (خطّها أرفع من 3 مم): كبّر اللوحة.`)
      const panels: PanelSpec[] = []
      const digitCount = new Map<number, { loops: Loop[]; count: number }>()
      for (let i = 0; i < n; i++) {
        const num = from + i
        const glyphs = style > 0 ? numberGlyphs(num, W / 2, cy, gh) : []
        const engrave: Loop[] = []
        for (const g of glyphs) {
          if (style === 1) for (const l of g.loops) engrave.push({ ...l, layer: 'engrave' })
          else {
            // the gold digit's placement line, 1 mm inside its outline, so it hides under the glued piece
            for (const l of g.loops.filter(l2 => signedArea(l2) > 0)) engrave.push({ ...offsetLoop(l, -1), layer: 'engrave' })
            const e = digitCount.get(g.digit)
            if (e) e.count++; else digitCount.set(g.digit, { loops: numberGlyphs(g.digit, 0, 0, gh)[0].loops, count: 1 })
          }
        }
        panels.push({
          id: style > 0 ? `plate-${num}` : 'plate', name: style > 0 ? `لوحة الطاولة ${num}` : 'لوحة الطاولة', w: W, h: round3(H + L), count: style > 0 ? 1 : n,
          shape: [outline], engrave, post: rTop > 0 ? (loops: Loop[]) => { roundCorner(loops, 0, 0, rTop); roundCorner(loops, W, 0, rTop) } : undefined,
          note: style === 2 ? 'الخطوط المحفورة مواضع قطع الرقم الذهبية' : 'لسانا اللوحة في شقّي القاعدة',
        })
        if (style === 0) break
      }
      for (const [dg, e] of [...digitCount].sort((a, b) => a[0] - b[0])) {
        const outer = e.loops.filter(l => signedArea(l) > 0), holes = e.loops.filter(l => signedArea(l) < 0)
        panels.push({ id: `digit-${dg}`, name: `الرقم ${dg} (ذهبي)`, w: round3(0.56 * gh), h: gh, count: e.count, material: 'mirror', shape: outer, holes, note: 'يُلصق على موضعه المحفور' })
      }
      // the base: a little wider than the plate, its slots through every layer, the plate standing in the middle of its depth
      const Wb = round3(W + 24), rb = Math.min(12, Db / 2 - 0.5)
      const slots = tabX.map(x => rotatedRectHole(round3(Wb / 2 + x - W / 2), round3(Db / 2), tw + fit, round3(t + fit), 0))
      const roundB = (loops: Loop[]) => { for (const [x, y] of [[0, 0], [Wb, 0], [Wb, Db], [0, Db]]) roundCorner(loops, x, y, rb) }
      panels.push({ id: 'base-top', name: 'القاعدة — الطبقة العليا', w: Wb, h: Db, count: n, holes: slots, post: roundB, note: 'شقّا لساني اللوحة' })
      if (layers > 1) panels.push({ id: 'base-under', name: 'القاعدة — الطبقة السفلى', w: Wb, h: Db, count: n * (layers - 1), holes: slots.map(l => ({ ...l, pts: l.pts.map(q => ({ ...q })) })), post: roundB, note: 'الشقوق نفسها لتنفذ فيها الألسنة' })
      const notes = [
        `${arCount(n, ['لوحة واحدة', 'لوحتان', 'لوحات', 'لوحة'])}${n > 1 ? ` من ${from} إلى ${last}` : ` رقمها ${from}`}، كل لوحة ${W} × ${H} مم تقف بلسانيها في قاعدة ${Wb} × ${Db} مم (${arCount(layers, ['طبقة واحدة', 'طبقتان', 'طبقات', 'طبقة'])}) والألسنة تصل أسفلها.`,
        ...(style === 1 ? ['الأرقام على طبقة الحفر الزرقاء: في RDWorks اجعلها Scan (حفر ممتلئ) فتظهر الأرقام مملوءة، أو Cut بقدرة منخفضة لحفر خطّي.'] : []),
        ...(style === 2 ? [`الأرقام الذهبية (${arCount([...digitCount.values()].reduce((s, e) => s + e.count, 0), ['قطعة واحدة', 'قطعتان', 'قطع', 'قطعة'])}) في كتلة خاصة لأكريليك المرآة؛ ألصق كل رقم على موضعه المحفور بلاصق جِل أو UV لا يذيب طلاء المرآة.`] : []),
        'اكتب «Table» أو اسمَي العروسين فوق الرقم بالحفر في RDWorks. للّوحات البيضاء استعمل أكريليك أبيض والأرقام ذهبية، وللخشب احفر الرقم.',
      ]
      return { panels, notes, warnings, errors }
    },
  },
  {
    id: 'favorbox',
    name: 'علب توزيعات العرس',
    desc: 'علب صغيرة بغطاء ذي شفة فيه نافذة قلب (مكشوفة أو خلفها أكريليك شفّاف) للشوكولا والملبّس، تُقصّ بالعشرات في لوح واحد.',
    icon: `<path d="M14 28h36v26H14z"/><path d="M11 22h42v6H11z"/><path d="M32 30 26 24a3.5 3.5 0 0 1 6-3 3.5 3.5 0 0 1 6 3z" stroke-width="1.3"/><path d="M20 38h24v8H20z" stroke-width="1.2"/>`,
    params: [
      ...DIMS.map(d => ({ ...d, min: 30 })), mm('lipH', 'ارتفاع الشفة', 6, 30), mm('gap', 'خلوص الشفة', 0.2, 1.5),
      { key: 'win', label: 'نافذة الغطاء', min: 0, max: 2, step: 1, int: true, hint: '0 = بلا، 1 = قلب مفرّغ، 2 = قلب خلفه أكريليك شفّاف' },
      { key: 'tag', label: 'إطار محفور للأسماء على الواجهة', min: 0, max: 1, step: 1, int: true },
      { key: 'n', label: 'العدد', min: 1, max: 60, step: 1, int: true },
    ],
    defaults: { W: 60, D: 60, H: 45, lipH: 10, gap: 0.4, win: 2, tag: 1, n: 12 },
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const t = c.t, { W, D, H } = p, n = Math.round(p.n), win = Math.round(p.win)
      const { panels, notes, Wl, Dl } = lipLidBox(p, c, errors)
      // the heart sits in the lip frame's opening, which is where the clear plate goes (glued under the lid)
      const ow = Wl - 2 * t, od = Dl - 2 * t
      const extra: PanelSpec[] = []
      if (win > 0) {
        const hwH = round3(0.8 * Math.min(ow, od / 0.95))
        if (hwH < 15) errors.push(`الغطاء صغير على نافذة القلب: اجعل العرض والعمق ${Math.ceil((15 / 0.8) + 2 * t + 2 * t + 2 * p.gap)} مم على الأقل، أو ألغِ النافذة.`)
        else {
          // a rounded notch, as on the guest frame: no hair-thin point between the lobes
          panels.find(x => x.id === 'lid')!.holes = [heartFrame(W / 2, D / 2, hwH, Math.min(2, hwH / 12)).holes()[0]]
          if (win === 2) extra.push({ id: 'window', name: 'نافذة الأكريليك', w: round3(ow - 1), h: round3(od - 1), material: 'clear', note: 'تُلصق تحت الغطاء داخل إطار الشفة فتغطي القلب' })
        }
      }
      if (Math.round(p.tag) > 0) {
        const tw = W - 2 * t - 12, th = Math.min(16, (H - t) / 3)
        if (tw >= 20 && th >= 8) panels.find(x => x.id === 'front')!.engrave = [engraveRect(round3((W - tw) / 2), round3((H - t - th) / 2), round3(tw), round3(th))]
      }
      for (const sp of [...panels, ...extra]) sp.count = (sp.count ?? 1) * n
      return {
        panels: [...panels, ...extra],
        notes: [
          `${arCount(n, ['علبة واحدة', 'علبتان', 'علب', 'علبة'])} ${W} × ${D} × ${H} مم${win > 0 ? ' بنافذة قلب في الغطاء' : ''}.`,
          ...notes,
          ...(win === 2 ? [`نافذة الأكريليك ${(ow - 1).toFixed(1)} × ${(od - 1).toFixed(1)} مم تُلصق تحت الغطاء داخل إطار الشفة (بعد لصق الإطار) فيُرى ما في العلبة ولا يخرج.`] : []),
          ...(Math.round(p.tag) > 0 ? ['الإطار المحفور على الواجهة لاسمَي العروسين أو التاريخ؛ أضف النصّ في RDWorks.'] : []),
        ],
        warnings, errors,
      }
    },
  },
)

// ------------------------------------------------------------------ door panels
//
// A door panel is engraved, not cut: every groove is n laser lines lw apart (each line burns about lw), so the groove
// is n × lw wide. Grooves are drawn in order, and one that runs into an earlier groove stops at that groove's edge,
// so no wood is burnt twice and the depth stays even. The red outline is the panel itself, for alignment.

type P2 = { x: number; y: number }
const quad = (a: P2, c: P2, b: P2, t: number): P2 => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y })
const segDist2 = (p: P2, a: P2, b: P2) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const k = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy)
}
const polyDist = (p: P2, pl: P2[]) => { let d = Infinity; for (let i = 0; i + 1 < pl.length; i++) d = Math.min(d, segDist2(p, pl[i], pl[i + 1])); return d }
/** polyDist(·, pl) < r, quickly: runs of 16 segments are skipped when their box is further than r */
function nearPolyline(pl: P2[], r: number) {
  const boxes: { i: number; x0: number; x1: number; y0: number; y1: number }[] = []
  for (let i = 0; i + 1 < pl.length; i += 16) {
    const run = pl.slice(i, Math.min(pl.length, i + 17))
    boxes.push({ i, x0: Math.min(...run.map(q => q.x)) - r, x1: Math.max(...run.map(q => q.x)) + r, y0: Math.min(...run.map(q => q.y)) - r, y1: Math.max(...run.map(q => q.y)) + r })
  }
  return { test: (q: P2) => boxes.some(bx => q.x >= bx.x0 && q.x <= bx.x1 && q.y >= bx.y0 && q.y <= bx.y1 && polyDist(q, pl.slice(bx.i, Math.min(pl.length, bx.i + 17))) < r),
    dist: (q: P2, within: number) => { let d = Infinity; for (const bx of boxes) if (q.x >= bx.x0 - within && q.x <= bx.x1 + within && q.y >= bx.y0 - within && q.y <= bx.y1 + within) d = Math.min(d, polyDist(q, pl.slice(bx.i, Math.min(pl.length, bx.i + 17)))); return d } }
}
/** Points every `step` mm along a polyline (the vertices kept). */
function densify(pts: P2[], step: number): P2[] {
  const out: P2[] = []
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let j = 0; j < k; j++) out.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k })
  }
  out.push(pts[pts.length - 1])
  return out
}
/** Drop points that lie on the straight line through their neighbours. */
function dropCollinear(pts: P2[]): P2[] {
  const out: P2[] = [pts[0]]
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1]
    if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 1e-6 * Math.hypot(c.x - a.x, c.y - a.y)) out.push(b)
  }
  out.push(pts[pts.length - 1])
  return out
}
/** The polyline moved sideways by d (to the left of travel on screen when d > 0), corners mitred. */
function offsetPolyline(pts: P2[], closed: boolean, d: number): P2[] {
  const n = pts.length, seg = (i: number) => { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y); return { a, b, nx: (b.y - a.y) / l, ny: -(b.x - a.x) / l } }
  const segs = Array.from({ length: closed ? n : n - 1 }, (_, i) => seg(i))
  const at = (s: ReturnType<typeof seg>, p: P2) => ({ x: p.x + s.nx * d, y: p.y + s.ny * d })
  const out: P2[] = []
  for (let i = 0; i < n; i++) {
    const s0 = closed ? segs[(i - 1 + n) % n] : segs[i - 1], s1 = closed ? segs[i % n] : segs[i]
    if (!s0) { out.push(at(s1, pts[i])); continue }
    if (!s1) { out.push(at(s0, pts[i])); continue }
    // the two moved edges meet on the bisector, 1 / cos(half the turn) further out
    const bx = s0.nx + s1.nx, by = s0.ny + s1.ny, k = (s0.nx * s1.nx + s0.ny * s1.ny + 1) / 2
    out.push(k > 1e-9 ? { x: pts[i].x + (bx / 2 / k) * d, y: pts[i].y + (by / 2 / k) * d } : at(s1, pts[i]))
  }
  return out
}
/** Parts of the polyline pts outside the region `blocked`, the boundary found to 0.01 mm by halving. */
function clipPolyline(pts: P2[], blocked: (p: P2) => boolean): P2[][] {
  const out: P2[][] = []
  let cur: P2[] = []
  const edge = (a: P2, b: P2, aIn: boolean) => { let lo = 0, hi = 1; for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2, q = { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }; if (blocked(q) === aIn) lo = m; else hi = m } const m = (lo + hi) / 2; return { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m } }
  let was = false
  for (let i = 0; i < pts.length; i++) {
    const inside = blocked(pts[i])
    if (i > 0) {
      if (was && !inside) cur = [edge(pts[i - 1], pts[i], true)]
      if (!was && inside) { cur.push(edge(pts[i - 1], pts[i], false)); out.push(cur); cur = [] }
    }
    if (!inside) cur.push(pts[i])
    was = inside
  }
  if (cur.length) out.push(cur)
  return out.filter(s => s.length > 1 && s.reduce((L, p, i) => (i ? L + Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : 0), 0) > 1)
}

/** Short segments filed in 4 mm cells, to ask quickly whether a point comes within r of any of them. */
class SegGrid {
  private cells = new Map<string, [P2, P2][]>()
  add(pl: P2[]) {
    const pts = densify(pl, 3)
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1]
      for (let cx = Math.floor(Math.min(a.x, b.x) / 4); cx <= Math.floor(Math.max(a.x, b.x) / 4); cx++)
        for (let cy = Math.floor(Math.min(a.y, b.y) / 4); cy <= Math.floor(Math.max(a.y, b.y) / 4); cy++) {
          const k = `${cx},${cy}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push([a, b])
        }
    }
  }
  near(q: P2, r: number) {
    for (let cx = Math.floor((q.x - r) / 4); cx <= Math.floor((q.x + r) / 4); cx++)
      for (let cy = Math.floor((q.y - r) / 4); cy <= Math.floor((q.y + r) / 4); cy++)
        for (const [a, b] of this.cells.get(`${cx},${cy}`) ?? []) if (segDist2(q, a, b) < r) return true
    return false
  }
}

/** A groove's centre line: a polyline, closed or open (open ends are cut square). */
interface Groove { pts: P2[]; closed: boolean }
const circleG = (c: P2, r: number): Groove => { const N = Math.max(48, Math.ceil(2 * Math.PI * r)); return { closed: true, pts: Array.from({ length: N }, (_, k) => ({ x: c.x + r * Math.cos((2 * Math.PI * k) / N), y: c.y + r * Math.sin((2 * Math.PI * k) / N) })) } }
const rectG = (x0: number, y0: number, x1: number, y1: number): Groove => ({ closed: true, pts: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] })
const lineG = (...pts: P2[]): Groove => ({ closed: false, pts })
/** A window with a round top: x0..x1 wide, the arch's springing at ys, the bottom at y1. */
const archG = (x0: number, ys: number, x1: number, y1: number): Groove => {
  const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, k = Math.max(24, Math.ceil(Math.PI * r))
  return { closed: true, pts: [{ x: x0, y: y1 }, { x: x0, y: ys }, ...Array.from({ length: k - 1 }, (_, i) => { const a = Math.PI + (Math.PI * (i + 1)) / k; return { x: cx + r * Math.cos(a), y: ys + r * Math.sin(a) } }), { x: x1, y: ys }, { x: x1, y: y1 }] }
}

/**
 * Engraving lines for the grooves (the frame first), and the problems found: grooves that come closer than 5 mm of wood
 * without meeting, or a closed groove too small for its width.
 */
function engraveGrooves(grooves: Groove[], gw: number, lw: number): { lines: Loop[]; tight: number } {
  const n = Math.max(1, Math.round(gw / lw)), offs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * lw), g = (n * lw) / 2
  const paths = grooves.map(gr => (gr.closed ? [...gr.pts, gr.pts[0]] : gr.pts))
  const fine = paths.map(pl => densify(pl, 1))
  const near = fine.map(pl => nearPolyline(pl, g))
  // spacing: two grooves either meet (their centre lines cross or touch) or keep 5 mm of wood between them
  let tight = Infinity
  for (let i = 0; i < grooves.length; i++) {
    const coarse = densify(paths[i], 2)
    for (let j = i + 1; j < grooves.length; j++) {
      let dmin = Infinity
      for (const q of coarse) dmin = Math.min(dmin, near[j].dist(q, 2 * g + 5))
      if (dmin > 1.5 && dmin < Infinity) tight = Math.min(tight, dmin - 2 * g)
    }
    if (grooves[i].closed) {
      const c = grooves[i].pts.reduce((s, q) => ({ x: s.x + q.x / grooves[i].pts.length, y: s.y + q.y / grooves[i].pts.length }), { x: 0, y: 0 })
      tight = Math.min(tight, polyDist(c, paths[i]) - g)
    }
  }
  // a later groove's lines stop one line width from every line already drawn (their burns then touch, never overlap);
  // that is the edge of the earlier groove, mitred corners included
  const lines: Loop[] = [], drawn = new SegGrid()
  const v3 = (q: P2) => ({ x: round3(q.x), y: round3(q.y) })
  grooves.forEach((gr, k) => {
    const blocked = (q: P2) => drawn.near(q, lw - 1e-6)
    const mine: P2[][] = []
    for (const d of offs) {
      const off = offsetPolyline(gr.pts, gr.closed, d)
      const ring = gr.closed ? [...off, off[0]] : off
      const dense = densify(ring, 0.5)
      if (k === 0 || !dense.some(blocked)) { lines.push({ closed: gr.closed, layer: 'engrave', pts: (gr.closed ? off : ring).map(v3) }); mine.push(ring); continue }
      for (const s of clipPolyline(dense, blocked)) { const pts = dropCollinear(s); lines.push({ closed: false, layer: 'engrave', pts: pts.map(v3) }); mine.push(pts) }
    }
    for (const pl of mine) drawn.add(pl)
  })
  return { lines, tight }
}

/** the panel, its frame's centre line m in (fw × fh), positions as fractions of it, and the scale against a 600 × 1060 door */
interface DoorFrame { PW: number; PH: number; m: number; fw: number; fh: number; X: (u: number) => number; Y: (v: number) => number; sc: number }

/** A door panel template: the frame groove, then the design's grooves (u across and v down the frame, 0..1). */
function doorTemplate(t: { id: string; name: string; desc: string; icon: string; extra?: ParamDef[]; defaults?: Record<string, number>; design: (f: DoorFrame, p: Record<string, number>) => Groove[] }): Template {
  return {
    id: t.id, name: t.name, desc: t.desc, icon: t.icon,
    params: [
      mm('PW', 'عرض اللوح', 300, 1200), mm('PH', 'ارتفاع اللوح', 600, 2400), mm('m', 'بُعد الإطار عن الحافّة', 15, 200, 'إلى منتصف حفرة الإطار'),
      mm('gw', 'عرض الحفرة', 2, 30), { key: 'lw', label: 'المسافة بين خطوط الليزر', min: 0.3, max: 5, step: 0.1, unit: 'مم', hint: 'عرض الخط الذي يحرقه رأس الليزر: 10 مم بخطوط 2 مم = خمسة خطوط' },
      ...(t.extra ?? []),
    ],
    defaults: { PW: 600, PH: 1060, m: 40, gw: 10, lw: 2, ...(t.defaults ?? {}) },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p) {
      const warnings: string[] = [], errors: string[] = []
      const { PW, PH, m, lw } = p
      const n = Math.max(1, Math.round(p.gw / lw)), gw = n * lw, g = gw / 2, lines = arCount(n, ['خطّ واحد', 'خطّان', 'خطوط', 'خطّاً'])
      if (Math.abs(gw - p.gw) > 0.05) warnings.push(`عرض الحفرة ${p.gw} مم لا يقسم على ${lw} مم: ستكون ${lines} بعرض ${gw.toFixed(1)} مم.`)
      if (m - g < 5) errors.push(`الإطار قريب من حافّة اللوح: اجعل بُعده ${Math.ceil(g + 5)} مم على الأقل.`)
      const fw = PW - 2 * m, fh = PH - 2 * m
      if (fw < 150 || fh < 300) errors.push('اللوح صغير على هذه النقشة بعد الإطار.')
      const f: DoorFrame = { PW, PH, m, fw, fh, X: u => m + u * fw, Y: v => m + v * fh, sc: Math.min(fw / 520, fh / 980) }
      let engrave: Loop[] = []
      if (!errors.length) {
        const res = engraveGrooves([rectG(m, m, PW - m, PH - m), ...t.design(f, p)], gw, lw)
        if (res.tight < 5) errors.push(`الحفر متقاربة أو متداخلة بهذه القياسات (يبقى بينها ${Math.max(0, res.tight).toFixed(1)} مم): صغّر عرض الحفرة أو كبّر اللوح.`)
        else engrave = res.lines
      }
      const len = engrave.reduce((L, l) => L + l.pts.reduce((s, q, i) => (i ? s + Math.hypot(q.x - l.pts[i - 1].x, q.y - l.pts[i - 1].y) : 0), 0) + (l.closed ? Math.hypot(l.pts[0].x - l.pts[l.pts.length - 1].x, l.pts[0].y - l.pts[l.pts.length - 1].y) : 0), 0)
      return {
        panels: [{ id: 'door', name: 'لوح الباب', w: PW, h: PH, engrave, note: 'النقشة على طبقة الحفر الزرقاء؛ الإطار الأحمر حدود اللوح' }],
        notes: [
          `اللوح ${PW} × ${PH} مم، كل حفرة بعرض ${gw.toFixed(1)} مم من ${lines} ليزر${n > 1 ? ` بينها ${lw} مم` : ''}. طول خطوط الحفر نحو ${(len / 1000).toFixed(1)} م.`,
          'في RDWorks: الطبقة الزرقاء هي النقشة، شغّلها بوضع Cut بقدرة وسرعة الحفر عندك. الطبقة الحمراء حدود اللوح للمحاذاة فقط: اجعلها Output = No (إلا إن أردت قصّ اللوح نفسه).',
          'حيث تصل حفرة إلى أخرى تتوقّف خطوطها عند حافّتها، فلا يُحرق مكان مرّتين ويبقى عمق الحفر متساوياً.',
          'إذا كان رأس الليزر يحرق خطاً أعرض أو أرفع، اجعل «المسافة بين خطوط الليزر» بعرضه الحقيقي.',
        ],
        warnings, errors,
      }
    },
  }
}

/**
 * The customer's photo laid out on a 600 × 1060 door (its frame 520 × 980): the circles in mm of that frame (scaled with
 * the door), the curves and bars as fractions of the frame (u across, v down).
 */
const DOOR = {
  circles: [[166, 166, 78], [166, 335, 57], [166, 464, 41]], // centre x, y and radius
  curves: [[0.5, 0.42, 0.16], [0.34, 0.74, 0.47]],           // control point (u, v) and the end's height on the right side
  bars: [[0.56, 0.73], [0.4, 0.82], [0.24, 0.91]],            // start (u) and height (v); they run to the right side
}
const curveG = (a: P2, c: P2, b: P2): Groove => { const N = Math.max(50, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y))); return lineG(...Array.from({ length: N + 1 }, (_, i) => quad(a, c, b, i / N))) }
/** Concentric copies of a closed groove, each `gap` further in (as long as it stays at least 40 mm across). */
const insetRect = (x0: number, y0: number, x1: number, y1: number, gap: number) => (x1 - x0 > 2 * gap + 40 && y1 - y0 > 2 * gap + 40 ? [rectG(x0 + gap, y0 + gap, x1 - gap, y1 - gap)] : [])

MORE.push(
  doorTemplate({
    id: 'doorpanel', name: 'باب مودرن: دوائر وأقواس',
    desc: 'إطار وثلاث دوائر وقوسان من الزاوية وثلاثة خطوط، كما في صورة الزبون.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><circle cx="26" cy="14" r="4" stroke-width="1.5"/><circle cx="26" cy="22" r="3" stroke-width="1.5"/><circle cx="26" cy="28" r="2" stroke-width="1.5"/><path d="M19 57C24 38 32 22 45 16M19 57C26 44 34 36 45 30M33 46h12M29 50h16M25 54h20" stroke-width="1.5"/>`,
    extra: [{ key: 'circles', label: 'عدد الدوائر', min: 0, max: 3, step: 1, int: true }, { key: 'curves', label: 'عدد الأقواس', min: 0, max: 2, step: 1, int: true }, { key: 'bars', label: 'عدد الخطوط الأفقية', min: 0, max: 3, step: 1, int: true }],
    defaults: { circles: 3, curves: 2, bars: 3 },
    design: ({ PW, PH, m, X, Y, sc }, p) => {
      const S = { x: m, y: PH - m }
      return [
        ...DOOR.curves.slice(0, Math.round(p.curves)).map(([u, v, e]) => curveG(S, { x: X(u), y: Y(v) }, { x: PW - m, y: Y(e) })),
        ...DOOR.bars.slice(0, Math.round(p.bars)).map(([u, v]) => lineG({ x: X(u), y: Y(v) }, { x: PW - m, y: Y(v) })),
        ...DOOR.circles.slice(0, Math.round(p.circles)).map(([x, y, r]) => circleG({ x: X(0) + x * sc, y: Y(0) + y * sc }, r * sc)),
      ]
    },
  }),
  doorTemplate({
    id: 'doorclassic', name: 'باب كلاسيك: ثلاث حشوات',
    desc: 'ثلاث حشوات (طويلة، صغيرة، طويلة) كلٌّ منها بحفرتين متداخلتين كالأبواب الكلاسيكية.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M20 8h24v20H20zM20 31h24v6H20zM20 40h24v16H20z" stroke-width="1.5"/><path d="M23 11h18v14H23zM23 43h18v10H23z" stroke-width="1.2"/>`,
    extra: [{ key: 'double', label: 'حفرة ثانية داخل كل حشوة', min: 0, max: 1, step: 1, int: true }],
    defaults: { double: 1 },
    design: ({ fw, fh, X, Y }, p) => {
      const a = 0.12 * fw, c = 0.07 * fw, panels: [number, number][] = [[a, 0.43 * fh], [0.48 * fh, 0.58 * fh], [0.63 * fh, fh - a]]
      return panels.flatMap(([y0, y1]) => {
        const r = [X(0) + a, Y(0) + y0, X(1) - a, Y(0) + y1] as const
        return [rectG(...r), ...(Math.round(p.double) > 0 ? insetRect(...r, c) : [])]
      })
    },
  }),
  doorTemplate({
    id: 'doorarch', name: 'باب كلاسيك: قوس',
    desc: 'حشوة علوية بقوس نصف دائري وداخلها قوس ثانٍ، وتحتها حشوة مستطيلة بإطارين.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M21 38V18a11 11 0 0 1 22 0v20z" stroke-width="1.5"/><path d="M24 35V18a8 8 0 0 1 16 0v17z" stroke-width="1.2"/><path d="M21 42h22v14H21z" stroke-width="1.5"/><path d="M24 45h16v8H24z" stroke-width="1.2"/>`,
    design: ({ fw, X, Y }) => {
      const a = 0.12 * fw, c = 0.07 * fw, x0 = X(0) + a, x1 = X(1) - a, r = (x1 - x0) / 2
      const top = Y(0) + a, ys = top + r, y1 = Y(0.64), b0 = Y(0.69), b1 = Y(1) - a
      return [archG(x0, ys, x1, y1), ...(y1 - ys > 2 * c + 20 ? [archG(x0 + c, ys, x1 - c, y1 - c)] : []), rectG(x0, b0, x1, b1), ...insetRect(x0, b0, x1, b1, c)]
    },
  }),
  doorTemplate({
    id: 'doordiamond', name: 'باب كلاسيك: معيّنات',
    desc: 'معيّن كبير في الوسط وداخله معيّن، تخرج من جانبيه حفرتان إلى الإطار، ومعيّنان صغيران فوقه وتحته.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M32 20 43 32 32 44 21 32z" stroke-width="1.5"/><path d="M32 25l7 7-7 7-7-7z" stroke-width="1.2"/><path d="M19 32h2M43 32h2" stroke-width="1.5"/><path d="M32 8l5 5-5 5-5-5zM32 46l5 5-5 5-5-5z" stroke-width="1.2"/>`,
    design: ({ fw, fh, X, Y }) => {
      const dia = (cx: number, cy: number, hw: number, hh: number): Groove => ({ closed: true, pts: [{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }] })
      const cx = X(0.5), cy = Y(0.5), hw = 0.36 * fw, hh = 0.2 * fh, k = 0.55
      return [
        dia(cx, cy, hw, hh), dia(cx, cy, k * hw, k * hh),
        lineG({ x: X(0), y: cy }, { x: cx - hw, y: cy }), lineG({ x: cx + hw, y: cy }, { x: X(1), y: cy }),
        dia(cx, Y(0.14), 0.2 * fw, 0.08 * fh), dia(cx, Y(0.86), 0.2 * fw, 0.08 * fh),
      ]
    },
  }),
  doorTemplate({
    id: 'doorwaves', name: 'باب مودرن: أمواج',
    desc: 'حفر متموّجة متوازية تنساب من أعلى الإطار إلى أسفله.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><path d="M26 7c-4 8 4 17 0 25s4 17 0 25M32 7c-4 8 4 17 0 25s4 17 0 25M38 7c-4 8 4 17 0 25s4 17 0 25" stroke-width="1.3"/>`,
    extra: [{ key: 'waves', label: 'عدد الأمواج', min: 1, max: 5, step: 1, int: true }, { key: 'turns', label: 'عدد التموّجات', min: 1, max: 4, step: 1, int: true }],
    defaults: { waves: 3, turns: 2 },
    design: ({ fw, fh, X, Y }, p) => {
      const w = Math.round(p.waves), turns = Math.round(p.turns), A = Math.min(0.08 * fw, 0.4 * fw / (w + 1)), N = Math.ceil(fh / 4)
      return Array.from({ length: w }, (_, i) => lineG(...Array.from({ length: N + 1 }, (_, j) => ({ x: X((i + 1) / (w + 1)) + A * Math.sin(2 * Math.PI * turns * j / N), y: Y(j / N) }))))
    },
  }),
  doorTemplate({
    id: 'doorstar', name: 'باب عربي: نجمة ثمانية وحشوة',
    desc: 'نجمة ثمانية إسلامية في دائرة وفي قلبها دائرة صغيرة، وتحتها حشوة طويلة بإطارين.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><circle cx="32" cy="18" r="10" stroke-width="1.5"/><path d="M32 10l2.5 5.5L40 18l-5.5 2.5L32 26l-2.5-5.5L24 18l5.5-2.5z" stroke-width="1.2"/><path d="M21 33h22v23H21z" stroke-width="1.5"/><path d="M24 36h16v17H24z" stroke-width="1.2"/>`,
    design: ({ fw, X, Y }) => {
      const a = 0.12 * fw, c = 0.07 * fw, R = 0.27 * fw, cx = X(0.5), cy = Y(0) + a + 1.15 * R
      const star: Groove = { closed: true, pts: Array.from({ length: 16 }, (_, k) => { const r = k % 2 ? R * Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8) : R, ang = (k * Math.PI) / 8 - Math.PI / 2; return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) } }) }
      const y0 = cy + 1.15 * R + a, x0 = X(0) + a, x1 = X(1) - a, y1 = Y(1) - a
      return [circleG({ x: cx, y: cy }, 1.15 * R), star, circleG({ x: cx, y: cy }, 0.28 * R), rectG(x0, y0, x1, y1), ...insetRect(x0, y0, x1, y1, c)]
    },
  }),
  doorTemplate({
    id: 'doormodern', name: 'باب مودرن: خطوط عصرية',
    desc: 'حفرة عمودية قرب الجانب تتفرّع منها حفر أفقية متناوبة إلى الإطار، بأسلوب الأبواب الحديثة.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><path d="M28 7v50M19 18h9M28 26h17M19 34h9M28 42h17M19 50h9" stroke-width="1.5"/>`,
    extra: [{ key: 'rungs', label: 'عدد الحفر الأفقية', min: 2, max: 12, step: 1, int: true }, { key: 'pos', label: 'موضع الحفرة العمودية', min: 0.2, max: 0.8, step: 0.05, hint: 'نسبة من العرض: 0.33 = الثلث' }],
    defaults: { rungs: 6, pos: 0.33 },
    design: ({ X, Y }, p) => {
      const k = Math.round(p.rungs), xv = X(p.pos)
      return [lineG({ x: xv, y: Y(0) }, { x: xv, y: Y(1) }), ...Array.from({ length: k }, (_, i) => { const y = Y((i + 1) / (k + 1)); return i % 2 ? lineG({ x: xv, y }, { x: X(1), y }) : lineG({ x: X(0), y }, { x: xv, y }) })]
    },
  }),
  doorTemplate({
    id: 'doorframes', name: 'باب مودرن: إطارات متداخلة',
    desc: 'مستطيلات متداخلة متساوية البعد حتى الوسط، وفي قلبها مربّع مائل كالمعيّن.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19zM22.5 11h19v42h-19zM26 15h12v34H26z" stroke-width="1.3"/><path d="M32 26l4 6-4 6-4-6z" stroke-width="1.2"/>`,
    extra: [{ key: 'rings', label: 'عدد الإطارات الداخلية', min: 1, max: 6, step: 1, int: true }, mm('step', 'المسافة بين الإطارات', 15, 120)],
    defaults: { rings: 3, step: 40 },
    design: ({ X, Y, fw, fh }, p) => {
      const out: Groove[] = []
      for (let i = 1; i <= Math.round(p.rings); i++) { const s = i * p.step; if (fw - 2 * s < 60 || fh - 2 * s < 60) break; out.push(rectG(X(0) + s, Y(0) + s, X(1) - s, Y(1) - s)) }
      const last = out.length * p.step, hw = Math.min(0.25 * (fw - 2 * last), 0.18 * fw)
      if (hw > 20) out.push({ closed: true, pts: [{ x: X(0.5), y: Y(0.5) - 1.6 * hw }, { x: X(0.5) + hw, y: Y(0.5) }, { x: X(0.5), y: Y(0.5) + 1.6 * hw }, { x: X(0.5) - hw, y: Y(0.5) }] })
      return out
    },
  }),
)

/** An eight-pointed star (two squares, one turned 45°), tips R from the centre, the first tip at angle a0. */
const star8G = (c: P2, R: number, a0 = -Math.PI / 2): Groove => ({ closed: true, pts: Array.from({ length: 16 }, (_, k) => { const r = k % 2 ? (R * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8) : R, a = a0 + (k * Math.PI) / 8; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } }) })
/** A pointed (equilateral) arch: each side an arc centred on the opposite springing point; jambs down to y1. */
const pointedArchG = (x0: number, ys: number, x1: number, y1: number): Groove => {
  const w = x1 - x0, k = Math.max(16, Math.ceil(w / 4)), arc = (cx: number, a0: number, a1: number) => Array.from({ length: k }, (_, i) => { const a = a0 + ((a1 - a0) * (i + 1)) / k; return { x: cx + w * Math.cos(a), y: ys + w * Math.sin(a) } })
  return { closed: true, pts: [{ x: x0, y: y1 }, { x: x0, y: ys }, ...arc(x1, Math.PI, (4 * Math.PI) / 3), ...arc(x0, (5 * Math.PI) / 3, 2 * Math.PI).slice(0, -1), { x: x1, y: ys }, { x: x1, y: y1 }] }
}
/** A horseshoe arch: a circle cut by a chord narrower than its diameter (the jambs x0, x1), the jambs down to y1. */
const horseshoeG = (x0: number, ys: number, x1: number, y1: number, phi = Math.PI / 6): Groove => {
  const R = (x1 - x0) / 2 / Math.cos(phi), cx = (x0 + x1) / 2, cy = ys - R * Math.sin(phi), k = Math.max(32, Math.ceil(R))
  // from the left springing point (below the centre, at 180° + φ) over the top to the right one (−φ), y up as usual
  const a0 = Math.PI + phi, sweep = Math.PI + 2 * phi
  return { closed: true, pts: [{ x: x0, y: y1 }, ...Array.from({ length: k + 1 }, (_, i) => { const a = a0 - (sweep * i) / k; return { x: cx + R * Math.cos(a), y: cy - R * Math.sin(a) } }), { x: x1, y: y1 }] }
}
/** The part of segment a–b inside the convex polygon (either orientation), or null. */
function clipToConvex(a: P2, b: P2, poly: P2[]): [P2, P2] | null {
  let t0 = 0, t1 = 1
  const s = Math.sign(poly.reduce((A, p, i) => { const q = poly[(i + 1) % poly.length]; return A + p.x * q.y - q.x * p.y }, 0))
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = -(q.y - p.y) * s, ny = (q.x - p.x) * s // inward normal
    const num = (a.x - p.x) * nx + (a.y - p.y) * ny, den = (b.x - a.x) * nx + (b.y - a.y) * ny
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue }
    const t = -num / den
    if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t)
    if (t0 >= t1) return null
  }
  return [{ x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 }, { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 }]
}
/** Parallel lines at angle `deg` (from horizontal), `count` of them evenly across the polygon, each clipped to it. */
function hatch(poly: P2[], deg: number, count: number, minLen: number): Groove[] {
  const th = (deg * Math.PI) / 180, d = { x: Math.cos(th), y: -Math.sin(th) }, nrm = { x: -d.y, y: d.x }
  const cs = poly.map(p => p.x * nrm.x + p.y * nrm.y), c0 = Math.min(...cs), c1 = Math.max(...cs), big = 1e4
  const out: Groove[] = []
  for (let i = 1; i <= count; i++) {
    const c = c0 + ((c1 - c0) * i) / (count + 1), o = { x: nrm.x * c, y: nrm.y * c }
    const seg = clipToConvex({ x: o.x - d.x * big, y: o.y - d.y * big }, { x: o.x + d.x * big, y: o.y + d.y * big }, poly)
    if (seg && Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y) >= minLen) out.push(lineG(seg[0], seg[1]))
  }
  return out
}
/** Lines at ±45° every `cell` mm across the polygon (a lattice), each clipped to it. */
function lattice(poly: P2[], cell: number, minLen: number): Groove[] {
  const out: Groove[] = []
  for (const sgn of [1, -1]) {
    const d = { x: Math.SQRT1_2, y: sgn * Math.SQRT1_2 }, nrm = { x: -d.y, y: d.x }
    const cs = poly.map(p => p.x * nrm.x + p.y * nrm.y), c0 = Math.min(...cs), c1 = Math.max(...cs)
    const mid = (c0 + c1) / 2, kmax = Math.floor((c1 - c0) / 2 / cell)
    for (let k = -kmax; k <= kmax; k++) {
      const c = mid + k * cell, o = { x: nrm.x * c, y: nrm.y * c }
      const seg = clipToConvex({ x: o.x - d.x * 1e4, y: o.y - d.y * 1e4 }, { x: o.x + d.x * 1e4, y: o.y + d.y * 1e4 }, poly)
      if (seg && Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y) >= minLen) out.push(lineG(seg[0], seg[1]))
    }
  }
  return out
}
/** Where the ray from c at angle a first meets the rectangle x0..x1 × y0..y1 (c inside it). */
const rayToRect = (c: P2, a: number, x0: number, y0: number, x1: number, y1: number): P2 => {
  const dx = Math.cos(a), dy = Math.sin(a), ts = [dx > 1e-9 ? (x1 - c.x) / dx : Infinity, dx < -1e-9 ? (x0 - c.x) / dx : Infinity, dy > 1e-9 ? (y1 - c.y) / dy : Infinity, dy < -1e-9 ? (y0 - c.y) / dy : Infinity]
  const t = Math.min(...ts); return { x: c.x + t * dx, y: c.y + t * dy }
}

MORE.push(
  // ---------------------------------------------------------------- modern doors
  doorTemplate({
    id: 'doordiagonal', name: 'باب مودرن: خطوط مائلة',
    desc: 'حفر متوازية مائلة تقطع اللوح من إطار إلى إطار، بزاوية وعدد تختارهما.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><path d="M19 22 33 7M19 36 45 9M19 50 45 23M26 57l19-20M40 57l5-6" stroke-width="1.5"/>`,
    extra: [{ key: 'lines', label: 'عدد الخطوط', min: 2, max: 12, step: 1, int: true }, { key: 'angle', label: 'الزاوية', min: 20, max: 80, step: 1, unit: '°', hint: 'من الأفق' }],
    defaults: { lines: 5, angle: 60 },
    design: ({ X, Y }, p) => hatch(rectG(X(0), Y(0), X(1), Y(1)).pts, p.angle, Math.round(p.lines), 80),
  }),
  doorTemplate({
    id: 'doorblocks', name: 'باب مودرن: مستطيلات غير متناظرة',
    desc: 'خطّ عمودي يقسم اللوح وخطوط أفقية متبادلة تصنع مستطيلات بأحجام مختلفة.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><path d="M35 7v50M19 21h16M19 43h16M35 15h10M35 32h10M35 49h10M27 43v14" stroke-width="1.5"/>`,
    design: ({ X, Y }) => {
      const xv = X(0.62)
      return [lineG({ x: xv, y: Y(0) }, { x: xv, y: Y(1) }),
        ...[0.28, 0.66].map(v => lineG({ x: X(0), y: Y(v) }, { x: xv, y: Y(v) })),
        ...[0.16, 0.5, 0.84].map(v => lineG({ x: xv, y: Y(v) }, { x: X(1), y: Y(v) })),
        lineG({ x: X(0.3), y: Y(0.66) }, { x: X(0.3), y: Y(1) })]
    },
  }),
  doorTemplate({
    id: 'doororbit', name: 'باب مودرن: دائرة وخط',
    desc: 'دائرتان متّحدتا المركز في الأعلى يخترقهما خطّ عمودي من أعلى اللوح إلى أسفله، وثلاثة خطوط قصيرة في الأسفل.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><circle cx="32" cy="20" r="9" stroke-width="1.5"/><circle cx="32" cy="20" r="5" stroke-width="1.3"/><path d="M32 7v50M19 42h13M19 46h13M19 50h13" stroke-width="1.5"/>`,
    design: ({ fw, X, Y }) => {
      const c = { x: X(0.5), y: Y(0.25) }, R = Math.min(0.34 * fw, 0.42 * (c.y - Y(0)))
      return [circleG(c, R), circleG(c, 0.6 * R), lineG({ x: c.x, y: Y(0) }, { x: c.x, y: Y(1) }), ...[0.7, 0.78, 0.86].map(v => lineG({ x: X(0), y: Y(v) }, { x: c.x, y: Y(v) }))]
    },
  }),
  doorTemplate({
    id: 'doorchevron', name: 'باب مودرن: شيفرون',
    desc: 'حفر على شكل حرف V متتالية من أعلى اللوح إلى أسفله.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><path d="M19 12l13 8 13-8M19 24l13 8 13-8M19 36l13 8 13-8M19 48l13 8 13-8" stroke-width="1.5"/>`,
    extra: [{ key: 'count', label: 'عدد الأشكال', min: 2, max: 10, step: 1, int: true }, { key: 'depth', label: 'عمق الشكل', min: 0.1, max: 0.6, step: 0.05, hint: 'نسبة من العرض' }],
    defaults: { count: 6, depth: 0.35 },
    design: ({ fw, fh, X, Y }, p) => {
      const k = Math.round(p.count), h = p.depth * fw, span = fh - h
      return Array.from({ length: k }, (_, i) => { const y = Y(0) + (span * (i + 1)) / (k + 1); return lineG({ x: X(0), y }, { x: X(0.5), y: y + h }, { x: X(1), y }) })
    },
  }),
  // ---------------------------------------------------------------- Arabic doors
  doorTemplate({
    id: 'doormihrab', name: 'باب عربي: محراب',
    desc: 'قوس مدبّب كقوس المحراب وداخله قوس ثانٍ، وتحته حشوة بإطارين في وسطها نجمة ثمانية.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M21 38V24Q21 13 32 7q11 6 11 17v14z" stroke-width="1.5"/><path d="M24 35V25q0-8 8-13 8 5 8 13v10z" stroke-width="1.2"/><path d="M21 42h22v14H21z" stroke-width="1.5"/><path d="M32 45l1.5 3.5L37 49l-3.5 1.5L32 54l-1.5-3.5L27 49l3.5-.5z" stroke-width="1.1"/>`,
    design: ({ fw, X, Y }) => {
      const a = 0.12 * fw, c = 0.07 * fw, x0 = X(0) + a, x1 = X(1) - a, w = x1 - x0
      const ys = Y(0) + a + 0.87 * w, y1 = Y(0.64), b0 = Y(0.69), b1 = Y(1) - a
      const inner = y1 - ys > c + 30 ? [pointedArchG(x0 + c, ys + 0.3 * c, x1 - c, y1 - c)] : []
      const sr = Math.min((b1 - b0) / 2 - c - 12, (x1 - x0) / 2 - c - 12) * 0.8
      return [pointedArchG(x0, ys, x1, y1), ...inner, rectG(x0, b0, x1, b1), ...insetRect(x0, b0, x1, b1, c), ...(sr > 25 ? [star8G({ x: (x0 + x1) / 2, y: (b0 + b1) / 2 }, sr)] : [])]
    },
  }),
  doorTemplate({
    id: 'doorkhatam', name: 'باب عربي: نجمة بأشعة',
    desc: 'نجمة ثمانية كبيرة في دائرة وسط اللوح، تخرج من الدائرة ثمانية أشعة إلى الإطار.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><circle cx="32" cy="32" r="8" stroke-width="1.5"/><path d="M32 26l1.8 4.2L38 32l-4.2 1.8L32 38l-1.8-4.2L26 32l4.2-1.8z" stroke-width="1.1"/><path d="M32 7v17M32 40v17M19 32h5M40 32h5M26 26l-7-7M38 26l7-7M26 38l-7 7M38 38l7 7" stroke-width="1.3"/>`,
    design: ({ fw, X, Y }) => {
      const c = { x: X(0.5), y: Y(0.5) }, R = 0.28 * fw, Rc = 1.22 * R
      const rays = Array.from({ length: 8 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 4; return lineG({ x: c.x + Rc * Math.cos(a), y: c.y + Rc * Math.sin(a) }, rayToRect(c, a, X(0), Y(0), X(1), Y(1))) })
      return [circleG(c, Rc), star8G(c, R), circleG(c, 0.3 * R), ...rays]
    },
  }),
  doorTemplate({
    id: 'doormashrabiya', name: 'باب عربي: مشربية',
    desc: 'حشوة علوية بقوس تملؤها شبكة معيّنات كالمشربية، وتحتها حشوة بإطارين.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M21 38V18a11 11 0 0 1 22 0v20z" stroke-width="1.5"/><path d="M21 22l16 16M21 30l8 8M24 12l19 19M31 8l12 12M29 38l14-14M21 34l20-20M21 26l13-13" stroke-width="1"/><path d="M21 42h22v14H21z" stroke-width="1.5"/><path d="M24 45h16v8H24z" stroke-width="1.2"/>`,
    extra: [mm('cell', 'حجم خلية الشبكة', 30, 150)],
    defaults: { cell: 60 },
    design: ({ fw, X, Y }, p) => {
      const a = 0.12 * fw, c = 0.07 * fw, x0 = X(0) + a, x1 = X(1) - a, r = (x1 - x0) / 2
      const ys = Y(0) + a + r, y1 = Y(0.64), b0 = Y(0.69), b1 = Y(1) - a, arch = archG(x0, ys, x1, y1)
      return [arch, ...lattice(arch.pts, p.cell, 3 * 10), rectG(x0, b0, x1, b1), ...insetRect(x0, b0, x1, b1, c)]
    },
  }),
  doorTemplate({
    id: 'doorstars', name: 'باب عربي: نجوم متتالية',
    desc: 'نجوم ثمانية في دوائر بعضها فوق بعض، يصل بينها خطّ في الوسط من أعلى اللوح إلى أسفله.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v50H19z" stroke-width="1.5"/><circle cx="32" cy="17" r="6" stroke-width="1.4"/><circle cx="32" cy="32" r="6" stroke-width="1.4"/><circle cx="32" cy="47" r="6" stroke-width="1.4"/><path d="M32 7v4M32 23v3M32 38v3M32 53v4" stroke-width="1.4"/><path d="M32 13l1 2.5 3 1-3 1-1 2.5-1-2.5-3-1 3-1zM32 28l1 2.5 3 1-3 1-1 2.5-1-2.5-3-1 3-1zM32 43l1 2.5 3 1-3 1-1 2.5-1-2.5-3-1 3-1z" stroke-width="1"/>`,
    extra: [{ key: 'count', label: 'عدد النجوم', min: 1, max: 5, step: 1, int: true }],
    defaults: { count: 3 },
    design: ({ fw, fh, X, Y }, p) => {
      const k = Math.round(p.count), Rc = Math.min(0.36 * fw, (fh / k) * 0.36), cx = X(0.5)
      const cs = Array.from({ length: k }, (_, i) => ({ x: cx, y: Y((i + 0.5) / k) }))
      const links = [Y(0), ...cs.flatMap(c => [c.y - Rc, c.y + Rc]), Y(1)]
      const out: Groove[] = []
      for (const c of cs) out.push(circleG(c, Rc), star8G(c, Rc / 1.22), circleG(c, 0.25 * Rc))
      for (let i = 0; i + 1 < links.length; i += 2) if (links[i + 1] - links[i] > 20) out.push(lineG({ x: cx, y: links[i] }, { x: cx, y: links[i + 1] }))
      return out
    },
  }),
  doorTemplate({
    id: 'doorandalus', name: 'باب عربي: قوس أندلسي',
    desc: 'قوس حدوة الحصان الأندلسي وداخله قوس ثانٍ، وتحته حشوة بإطارين.',
    icon: `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M24 38V27a11 11 0 1 1 16 0v11z" stroke-width="1.5"/><path d="M27 35V27a7.5 7.5 0 1 1 10 0v8z" stroke-width="1.2"/><path d="M21 42h22v14H21z" stroke-width="1.5"/><path d="M24 45h16v8H24z" stroke-width="1.2"/>`,
    design: ({ fw, X, Y }) => {
      const a = 0.12 * fw, c = 0.07 * fw, phi = Math.PI / 6
      // the arch's widest point fills the panel; its jambs are narrower by cos 30°
      const R = (X(1) - X(0)) / 2 - a, cx = X(0.5), x0 = cx - R * Math.cos(phi), x1 = cx + R * Math.cos(phi)
      const ys = Y(0) + a + R + R * Math.sin(phi), y1 = Y(0.64), b0 = Y(0.69), b1 = Y(1) - a, Ri = R - c
      const inner = Ri > 40 ? [horseshoeG(cx - Ri * Math.cos(phi), ys, cx + Ri * Math.cos(phi), y1 - c, phi)] : []
      return [horseshoeG(x0, ys, x1, y1, phi), ...inner, rectG(X(0) + a, b0, X(1) - a, b1), ...insetRect(X(0) + a, b0, X(1) - a, b1, c)]
    },
  }),
)

MORE.push({
  id: 'doorhanger',
  name: 'تعليقة مسكة باب',
  desc: 'لوحة تُعلّق على مسكة الباب (كـ«الرجاء عدم الإزعاج» في الفنادق) بثقب للمسكة وشقّ جانبي اختياري للمسكة ذات الذراع، وإطار محفور للكتابة؛ تُقصّ بالجملة.',
  icon: `<path d="M22 6h20a4 4 0 0 1 4 4v46a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z"/><circle cx="32" cy="16" r="6"/><path d="M38 16h8" stroke-width="2"/><rect x="22" y="28" width="20" height="26" rx="2" stroke-width="1.2"/><path d="M25 36h14M25 41h14M25 46h10" stroke-width="1.2"/>`,
  params: [
    mm('W', 'العرض', 60, 200), mm('H', 'الطول', 120, 400),
    { key: 'shape', label: 'الشكل', min: 1, max: 3, step: 1, int: true, hint: '1 = مستطيل بزوايا مدوّرة، 2 = رأس مقوّس، 3 = ذيل مشقوق في الأسفل' },
    mm('hole', 'قطر ثقب المسكة', 20, 60, '38 مم يدخل في أغلب المسكات؛ قِس المسكة عند أعرض نقطة تمرّ منها'),
    mm('top', 'بُعد الثقب عن الأعلى', 8, 60),
    { key: 'slit', label: 'شقّ جانبي للمسكة ذات الذراع', min: 0, max: 1, step: 1, int: true, hint: 'قناة من الثقب إلى الحافّة تدخل منها رقبة المسكة' },
    mm('sw', 'عرض الشقّ', 8, 30, 'أعرض قليلاً من رقبة المسكة'),
    { key: 'frame', label: 'إطار محفور للكتابة', min: 0, max: 1, step: 1, int: true },
    { key: 'n', label: 'العدد', min: 1, max: 60, step: 1, int: true },
  ],
  defaults: { W: 100, H: 250, shape: 1, hole: 38, top: 14, slit: 0, sw: 20, frame: 1, n: 10 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p) {
    const warnings: string[] = [], errors: string[] = []
    const { W, H } = p, shape = Math.round(p.shape), slit = Math.round(p.slit) > 0, R = p.hole / 2, sw = p.sw, n = Math.round(p.n)
    const rc = Math.min(12, W / 8), notch = shape === 3 ? round3(0.14 * W) : 0, cx = W / 2
    if (W - 2 * R < 16) errors.push(`الثقب واسع على هذا العرض: يلزم 8 مم من كل جانب، فاجعل العرض ${Math.ceil(2 * R + 16)} مم على الأقل أو صغّر الثقب.`)
    // the hole: concentric with an arched top; with a slit, low enough that the slit leaves the edge below the corner or arch
    let cy = shape === 2 ? Math.max(W / 2, p.top + R) : p.top + R
    const edgeTop = shape === 2 ? W / 2 : rc
    if (slit) {
      if (sw > 2 * R - 6) errors.push(`الشقّ أعرض من أن يمسك الثقبُ المسكة: أقصاه ${Math.floor(2 * R - 6)} مم.`)
      cy = Math.max(cy, edgeTop + sw / 2 + 3)
    }
    if (cy - R < 8) errors.push('الثقب قريب من الحافّة العليا: 8 مم على الأقل.')
    if (H < cy + R + 40 + notch) errors.push(`التعليقة قصيرة: اجعل طولها ${Math.ceil(cy + R + 40 + notch)} مم على الأقل.`)
    const v = (x: number, y: number, b?: number) => ({ x: round3(x), y: round3(y), ...(b ? { b } : {}) })
    /** an arc from `from` to `to` about c, through `via`: its start (carrying the bulge) and its end */
    const arc = (from: P2, to: P2, c: P2, via: P2) => [v(from.x, from.y, arcBulge(from, to, c, via)), v(to.x, to.y)]
    const k45 = Math.SQRT1_2
    // clockwise on screen from the top-left: top, right side (with the slit), bottom, left side
    const pts: { x: number; y: number; b?: number }[] = []
    if (shape === 2) pts.push(...arc({ x: 0, y: W / 2 }, { x: W, y: W / 2 }, { x: cx, y: W / 2 }, { x: cx, y: 0 }))
    else pts.push(...arc({ x: 0, y: rc }, { x: rc, y: 0 }, { x: rc, y: rc }, { x: rc - rc * k45, y: rc - rc * k45 }), ...arc({ x: W - rc, y: 0 }, { x: W, y: rc }, { x: W - rc, y: rc }, { x: W - rc + rc * k45, y: rc - rc * k45 }))
    let holes: Loop[] = [circle(round3(cx), round3(cy), R)]
    if (slit && !errors.length) {
      const xc = cx + Math.sqrt(R * R - (sw / 2) ** 2)
      pts.push(v(W, cy - sw / 2), ...arc({ x: xc, y: cy - sw / 2 }, { x: xc, y: cy + sw / 2 }, { x: cx, y: cy }, { x: cx - R, y: cy }), v(W, cy + sw / 2))
      holes = []
    }
    if (shape === 3) pts.push(v(W, H), v(cx, H - notch), v(0, H))
    else pts.push(...arc({ x: W, y: H - rc }, { x: W - rc, y: H }, { x: W - rc, y: H - rc }, { x: W - rc + rc * k45, y: H - rc + rc * k45 }), ...arc({ x: rc, y: H }, { x: 0, y: H - rc }, { x: rc, y: H - rc }, { x: rc - rc * k45, y: H - rc + rc * k45 }))
    const outline = polyLoop(pts, 'outer')
    // the writing frame: below the hole, 8 mm in from the sides
    const fy0 = cy + R + 10, fy1 = H - notch - 12
    const engrave: Loop[] = Math.round(p.frame) > 0 && fy1 - fy0 >= 25 ? [{ ...roundedRectHole(8, round3(fy0), W - 16, round3(fy1 - fy0), 6), layer: 'engrave' }] : []
    return {
      panels: [{ id: 'hanger', name: 'التعليقة', w: W, h: H, count: n, shape: [outline], holes, engrave, note: 'تُكتب العبارة داخل الإطار المحفور' }],
      notes: [
        `${arCount(n, ['تعليقة واحدة', 'تعليقتان', 'تعليقات', 'تعليقة'])} ${W} × ${H} مم، ثقب المسكة ${p.hole} مم${slit ? ` وشقّ جانبي بعرض ${sw} مم تدخل منه رقبة المسكة ذات الذراع` : ''}.`,
        'اكتب العبارة في RDWorks داخل الإطار المحفور: «الرجاء عدم الإزعاج»، «أهلاً وسهلاً»، اسم الغرفة أو المحلّ، أو عبارة على الوجهين. يصلح الخشب 3 مم والأكريليك الملوّن.',
        'قِس المسكة قبل القصّ: يجب أن يكون الثقب أوسع من أعرض جزء يمرّ منه (رأس المسكة أو ذراعها).',
      ],
      warnings, errors,
    }
  },
})

// ------------------------------------------------------------------ wedding acrylic, second set

/** A shape in a plate, for spacing checks: a circle, or a box (stadiums and slots by their bounding box). */
type Spot = { c: P2; r: number } | { x0: number; y0: number; x1: number; y1: number }
function spotGap(a: Spot, b: Spot): number {
  const box = (s: Spot) => ('r' in s ? { x0: s.c.x - s.r, y0: s.c.y - s.r, x1: s.c.x + s.r, y1: s.c.y + s.r } : s)
  if ('r' in a && 'r' in b) return Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y) - a.r - b.r
  if ('r' in a || 'r' in b) {
    const c = ('r' in a ? a : b) as { c: P2; r: number }, B = box('r' in a ? b : a)
    return Math.hypot(Math.max(B.x0 - c.c.x, 0, c.c.x - B.x1), Math.max(B.y0 - c.c.y, 0, c.c.y - B.y1)) - c.r
  }
  const A = box(a), B = box(b)
  return Math.hypot(Math.max(B.x0 - A.x1, 0, A.x0 - B.x1), Math.max(B.y0 - A.y1, 0, A.y0 - B.y1))
}
/** The narrowest wood (acrylic) between any two spots and between each spot and a W × D plate's edge. */
function spotsTight(spots: Spot[], W: number, D: number): number {
  let m = Infinity
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i], b = 'r' in s ? { x0: s.c.x - s.r, y0: s.c.y - s.r, x1: s.c.x + s.r, y1: s.c.y + s.r } : s
    m = Math.min(m, b.x0, b.y0, W - b.x1, D - b.y1)
    for (let j = i + 1; j < spots.length; j++) m = Math.min(m, spotGap(s, spots[j]))
  }
  return m
}

/**
 * A layered acrylic tray: a solid base (gold mirror by default), pocket plates whose cut-outs become the recesses, and
 * handle slots through every layer near the short ends. `pockets` gives the recesses (holes) and their spots.
 */
function layeredTray(p: Record<string, number>, c: Common, pockets: (W: number, D: number, hx: number) => { holes: Loop[]; spots: Spot[]; engrave?: Loop[] }, what: string): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const { W, D } = p, t = c.t, layers = Math.round(p.layers), rc = Math.min(p.rc, D / 4, W / 4)
  // handles: a vertical slot near each short end, as wide as fingers need
  const hw = 18, hl = round3(Math.min(0.45 * D, 110)), hx = 14 + hw / 2
  const handles = [hx, W - hx].map(x => stadiumV(round3(x), round3(D / 2), hl, hw))
  const handleSpots: Spot[] = [hx, W - hx].map(x => ({ x0: x - hw / 2, y0: D / 2 - hl / 2, x1: x + hw / 2, y1: D / 2 + hl / 2 }))
  const pk = pockets(W, D, hx + hw / 2)
  const tight = spotsTight([...handleSpots, ...pk.spots], W, D)
  if (tight < 6) errors.push(`الصينية صغيرة على ما فيها: يبقى ${Math.max(0, tight).toFixed(1)} مم فقط بين فتحتين أو عند الحافّة (6 مم على الأقل)؛ كبّر الصينية أو صغّر الفتحات.`)
  const rounded = (loops: Loop[]) => { for (const [x, y] of [[0, 0], [W, 0], [W, D], [0, D]]) roundCorner(loops, x, y, rc) }
  const copy = (ls: Loop[]) => ls.map(l => ({ ...l, pts: l.pts.map(q => ({ ...q })) }))
  const mirror = Math.round(p.mirror) > 0
  const panels: PanelSpec[] = [
    { id: 'base', name: 'القاعدة', w: W, h: D, post: rounded, holes: copy(handles), ...(mirror ? { material: 'mirror' } : {}), note: mirror ? 'أكريليك مرآة: تظهر من خلال الفتحات' : 'القاعدة' },
    { id: 'pocket', name: layers > 1 ? 'طبقة الفتحات' : 'الطبقة العليا', w: W, h: D, count: layers, post: rounded, holes: [...copy(handles), ...pk.holes], engrave: pk.engrave ?? [], note: 'فتحاتها تصير تجاويف فوق القاعدة' },
  ]
  return {
    panels,
    notes: [
      `${what} ${W} × ${D} مم من ${layers + 1} طبقات؛ عمق التجاويف ${(layers * t).toFixed(1)} مم. فتحتا المقبض تنفذان في كل الطبقات.`,
      mirror ? 'القاعدة من أكريليك مرآة ذهبي أو فضي فتلمع في قاع كل تجويف، والطبقة العليا أكريليك أبيض أو شفّاف أو أسود. ألصق الطبقات بلاصق جِل أو UV لا يذيب طلاء المرآة، وابدأ بمحاذاة فتحتي المقبض.' : 'ألصق الطبقات فوق بعضها والحواف متطابقة؛ ابدأ بمحاذاة فتحتي المقبض.',
    ],
    warnings, errors,
  }
}

/**
 * A sign standing on two feet by halving joints: each foot has a slot from the top, the sign one from the bottom, each
 * half the foot's height, so the sign's bottom and the feet stand on the table together and come apart for storage.
 */
function footedSign(p: Record<string, number>, c: Common, o: { id: string; name: string; count: number; footMin: number }): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, { W, fit } = p, shape = Math.round(p.shape), n = o.count
  const s = round3(t + fit), Lf = p.Lf, hf = p.hf, hs = round3(hf / 2)
  const H = shape === 3 ? round3(0.94 * W) : p.H
  if (shape === 1 && H < W / 2 + hs + 10) errors.push(`اللوحة قصيرة على قوسها: اجعل ارتفاعها ${Math.ceil(W / 2 + hs + 10)} مم على الأقل.`)
  if (hf < Math.max(o.footMin, 4 * t)) errors.push(`القدم منخفضة: ${Math.ceil(Math.max(o.footMin, 4 * t))} مم على الأقل.`)
  if (Lf < 0.3 * H) errors.push(`القدم قصيرة على هذا الارتفاع وقد تنقلب اللوحة: اجعل طولها ${Math.ceil(0.3 * H)} مم على الأقل.`)
  if (Lf < 4 * s + 20) errors.push('القدم قصيرة على شقّها.')
  // the feet: under the sides of a flat-bottomed sign, nearer the middle under a round one (its flat is short)
  const R = W / 2, cy = R, chordHalf = shape === 3 ? Math.sqrt(Math.max(0, R * R - (H - cy) ** 2)) : W / 2
  const fx = shape === 3 ? [W / 2 - 0.62 * chordHalf, W / 2 + 0.62 * chordHalf] : [0.2 * W, 0.8 * W]
  if (fx[0] - s / 2 < (shape === 3 ? W / 2 - chordHalf + 6 : 10)) errors.push('اللوحة ضيّقة على القدمين.')
  const v = (x: number, y: number, b?: number) => ({ x: round3(x), y: round3(y), ...(b ? { b } : {}) })
  const bottom: { x: number; y: number; b?: number }[] = []
  const xl = W / 2 - chordHalf, xr = W / 2 + chordHalf
  bottom.push(v(xl, H))
  for (const x of fx) bottom.push(v(x - s / 2, H), v(x - s / 2, H - hs), v(x + s / 2, H - hs), v(x + s / 2, H))
  bottom.push(v(xr, H))
  const rc = Math.min(20, W / 8), k45 = Math.SQRT1_2
  let pts: { x: number; y: number; b?: number }[]
  if (shape === 3) pts = [...bottom.slice(0, -1), v(xr, H, arcBulge({ x: xr, y: H }, { x: xl, y: H }, { x: R, y: cy }, { x: R, y: 0 }))]
  else if (shape === 1) pts = [...bottom, v(W, W / 2, arcBulge({ x: W, y: W / 2 }, { x: 0, y: W / 2 }, { x: R, y: W / 2 }, { x: R, y: 0 })), v(0, W / 2)]
  else pts = [...bottom, v(W, rc, arcBulge({ x: W, y: rc }, { x: W - rc, y: 0 }, { x: W - rc, y: rc }, { x: W - rc + rc * k45, y: rc - rc * k45 })), v(W - rc, 0), v(rc, 0, arcBulge({ x: rc, y: 0 }, { x: 0, y: rc }, { x: rc, y: rc }, { x: rc - rc * k45, y: rc - rc * k45 })), v(0, rc)]
  const outline = polyLoop(pts, 'outer')
  // an engraved border following the shape, clear of the slots
  const g = Math.max(4, Math.min(12, 0.03 * W))
  let border: Loop | null = null
  if (Math.round(p.border) > 0) {
    if (shape === 3) border = { ...flatDisc(R, cy, R - g, H - g - hs, [], 0, 0), layer: 'engrave' }
    else if (shape === 1) { if (H - 2 * g - hs > (W - 2 * g) / 2) border = { ...archHole(g, g, W - 2 * g, H - 2 * g - hs), layer: 'engrave' } }
    else border = { ...roundedRectHole(g, g, W - 2 * g, H - 2 * g - hs, Math.max(2, rc - g)), layer: 'engrave' }
  }
  const panels: PanelSpec[] = [
    { id: o.id, name: o.name, w: W, h: H, count: n, shape: [outline], engrave: border ? [border] : [], note: 'شقّاها من الأسفل يتعاشقان مع القدمين' },
    {
      id: 'foot', name: 'القدم', w: Lf, h: hf, count: 2 * n, cuts: [rect(round3(Lf / 2 - s / 2), 0, s, hs)],
      post: loops => { const r = Math.min(hf / 2 - 0.5, 12); roundCorner(loops, 0, 0, r); roundCorner(loops, Lf, 0, r) }, note: 'شقّها من الأعلى بنصف ارتفاعها',
    },
  ]
  return { panels, notes: [], warnings, errors, slotted: true }
}
const SIGN_SHAPE: ParamDef = { key: 'shape', label: 'الشكل', min: 1, max: 3, step: 1, int: true, hint: '1 = قوس، 2 = مستطيل بزوايا مدوّرة، 3 = دائرة بقاعدة مسطّحة' }

MORE.push(
  {
    id: 'nikahtray',
    name: 'صينية عقد القران (الملكة)',
    desc: 'صينية أكريليك بطبقات: تجويف للقلم وتجويفان للمحبسين ومساحة محفورة للأسماء والتاريخ، فوق قاعدة مرآة ذهبية، بمقبضين.',
    icon: `<rect x="6" y="16" width="52" height="34" rx="5"/><path d="M12 26v14M52 26v14" stroke-width="3"/><circle cx="26" cy="24" r="3"/><circle cx="38" cy="24" r="3"/><path d="M22 32h20" stroke-width="1.2"/><path d="M20 42h24" stroke-width="3"/>`,
    params: [
      mm('W', 'الطول', 220, 500), mm('D', 'العرض', 150, 350), mm('rc', 'زوايا الصينية', 0, 60),
      mm('pen', 'طول تجويف القلم', 100, 200, 'أطول من القلم بـ 10 مم'), mm('penW', 'عرض تجويف القلم', 10, 30),
      mm('ring', 'قطر تجويف المحبس', 18, 40, 'المحبس يجلس فيه'),
      { key: 'layers', label: 'طبقات التجاويف', min: 1, max: 3, step: 1, int: true, hint: 'عمق التجويف بعدد السماكات' },
      { key: 'mirror', label: 'قاعدة مرآة', min: 0, max: 1, step: 1, int: true },
    ],
    defaults: { W: 320, D: 220, rc: 24, pen: 160, penW: 16, ring: 26, layers: 1, mirror: 1 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const res = layeredTray(p, c, (W, D, hzone) => {
        const cx = W / 2, rr = p.ring / 2, ry = 0.28 * D, gapR = Math.max(10, rr)
        const rings = [cx - gapR - rr, cx + gapR + rr].map(x => ({ c: { x, y: ry }, r: rr }))
        const py = 0.76 * D, pen = { x0: cx - p.pen / 2, y0: py - p.penW / 2, x1: cx + p.pen / 2, y1: py + p.penW / 2 }
        // the names: an engraved panel between the rings and the pen
        const ny0 = ry + rr + 10, ny1 = py - p.penW / 2 - 10, nw = Math.min(W - 2 * hzone - 30, 0.62 * W)
        const engrave: Loop[] = ny1 - ny0 >= 20 ? [{ ...roundedRectHole(round3(cx - nw / 2), round3(ny0), round3(nw), round3(ny1 - ny0), 6), layer: 'engrave' }] : []
        return { holes: [...rings.map(r => circle(round3(r.c.x), round3(r.c.y), rr)), stadium(round3(cx), round3(py), p.pen, p.penW)], spots: [...rings, pen], engrave }
      }, 'صينية عقد القران')
      res.notes.push('اكتب الاسمين والتاريخ أو «بارك الله لكما» داخل الإطار المحفور في RDWorks. ضع القلم في تجويفه والمحبسين في تجويفيهما.')
      return res
    },
  },
  {
    id: 'hennatray',
    name: 'صينية الحنّة',
    desc: 'صينية أكريليك بطبقات: تجويف لصحن الحنّة في الوسط وحوله تجاويف للشموع الصغيرة، فوق قاعدة مرآة، بمقبضين.',
    icon: `<rect x="4" y="14" width="56" height="38" rx="6"/><path d="M10 25v16M54 25v16" stroke-width="3"/><circle cx="32" cy="33" r="8"/><circle cx="20" cy="22" r="3"/><circle cx="44" cy="22" r="3"/><circle cx="20" cy="44" r="3"/><circle cx="44" cy="44" r="3"/>`,
    params: [
      mm('W', 'الطول', 250, 600), mm('D', 'العرض', 180, 450), mm('rc', 'زوايا الصينية', 0, 80),
      mm('bowl', 'قطر صحن الحنّة', 60, 250, 'قطر قاعدة الصحن التي تجلس في التجويف'),
      { key: 'candles', label: 'عدد الشموع', min: 0, max: 12, step: 1, int: true }, mm('cd', 'قطر الشمعة', 30, 60, 'شمعة الكوب الصغيرة 38–40 مم'),
      { key: 'layers', label: 'طبقات التجاويف', min: 1, max: 3, step: 1, int: true },
      { key: 'mirror', label: 'قاعدة مرآة', min: 0, max: 1, step: 1, int: true },
    ],
    defaults: { W: 380, D: 270, rc: 30, bowl: 130, candles: 6, cd: 40, layers: 1, mirror: 1 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const res = layeredTray(p, c, (W, D, hzone) => {
        const cx = W / 2, cy = D / 2, rb = p.bowl / 2, rcd = p.cd / 2 + 0.5, k = Math.round(p.candles)
        // the candles on an ellipse halfway between the bowl and the edge (the handles at the ends), first one straight up
        const a = (rb + W / 2 - hzone) / 2, b = (rb + D / 2) / 2
        const cs = Array.from({ length: k }, (_, i) => { const th = -Math.PI / 2 + (2 * Math.PI * i) / k; return { c: { x: cx + a * Math.cos(th), y: cy + b * Math.sin(th) }, r: rcd } })
        return { holes: [circle(round3(cx), round3(cy), rb), ...cs.map(q => circle(round3(q.c.x), round3(q.c.y), q.r))], spots: [{ c: { x: cx, y: cy }, r: rb }, ...cs] }
      }, 'صينية الحنّة')
      res.notes.push('الشموع في كؤوسها المعدنية فقط، ولا تتركها مشتعلة بلا مراقبة: الأكريليك يلين قرب اللهب. صحن الحنّة يجلس في تجويف الوسط.')
      return res
    },
  },
  {
    id: 'welcomesign',
    name: 'لوحة ترحيب بقدمين',
    desc: 'لوحة أكريليك كبيرة بقوس أو مستطيلة أو دائرية لمدخل القاعة، تقف على قدمين بتعشيق نصفي بلا غراء وتُفكّ للتخزين، بإطار محفور.',
    icon: `<path d="M18 50V22a14 14 0 0 1 28 0v28z"/><path d="M14 54h12M38 54h12" stroke-width="3"/><path d="M21 49V23a11 11 0 0 1 22 0v26" stroke-width="1.2"/><path d="M26 30h12M24 36h16M27 42h10" stroke-width="1.3"/>`,
    params: [
      mm('W', 'العرض', 250, 1000), mm('H', 'الارتفاع', 300, 1400, 'للدائرة يُحسب من العرض'), SIGN_SHAPE,
      mm('Lf', 'طول القدم', 80, 500, 'من الأمام إلى الخلف؛ ثلث ارتفاع اللوحة على الأقل'), mm('hf', 'ارتفاع القدم', 20, 120),
      { key: 'border', label: 'إطار محفور', min: 0, max: 1, step: 1, int: true }, mm('fit', 'خلوص الشقوق', 0, 0.5),
    ],
    defaults: { W: 450, H: 620, shape: 1, Lf: 220, hf: 50, border: 1, fit: 0.2 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const res = footedSign(p, c, { id: 'sign', name: 'اللوحة', count: 1, footMin: 30 })
      res.notes.push(
        `اللوحة ${p.W} مم عرضاً، تقف على قدمين بطول ${p.Lf} مم: أدخل شقّ كل قدم في شقّ اللوحة حتى تلامس الأرضَ معاً.`,
        'للوحة بهذا الحجم استعمل أكريليك 5–6 مم (أو 4 مم على الأقل)؛ اختر السماكة نفسها في البرنامج لأن الشقوق تُقاس عليها.',
        'اكتب «أهلاً وسهلاً» أو «Welcome» واسمَي العروسين والتاريخ داخل الإطار المحفور، أو ألصق عليها حروفاً مقصوصة من مرآة ذهبية.',
      )
      return res
    },
  },
  {
    id: 'placecards',
    name: 'كروت أماكن الضيوف',
    desc: 'كروت أكريليك صغيرة بأسماء الضيوف تقف على الطاولة بقدمين صغيرتين متعاشقتين، تُقصّ بالعشرات؛ تصلح أيضاً كأرقام طاولات صغيرة.',
    icon: `<path d="M10 40V24a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v16z"/><path d="M12 44h10M42 44h10" stroke-width="3"/><path d="M18 30h28M22 35h20" stroke-width="1.3"/>`,
    params: [
      mm('W', 'العرض', 50, 200), mm('H', 'الارتفاع', 30, 150, 'للدائرة يُحسب من العرض'), SIGN_SHAPE,
      mm('Lf', 'طول القدم', 20, 80), mm('hf', 'ارتفاع القدم', 10, 30),
      { key: 'border', label: 'إطار محفور', min: 0, max: 1, step: 1, int: true }, { key: 'n', label: 'العدد', min: 1, max: 80, step: 1, int: true }, mm('fit', 'خلوص الشقوق', 0, 0.5),
    ],
    defaults: { W: 90, H: 60, shape: 2, Lf: 36, hf: 14, border: 1, n: 20, fit: 0.15 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const n = Math.round(p.n)
      const res = footedSign(p, c, { id: 'card', name: 'الكرت', count: n, footMin: 10 })
      res.notes.push(`${arCount(n, ['كرت واحد', 'كرتان', 'كروت', 'كرتاً'])} ${p.W} مم بقدمين لكل كرت. اكتب اسم كل ضيف داخل الإطار في RDWorks قبل القصّ، أو بقلم ذهبي بعده.`, 'أكريليك المرآة الذهبي أو الأبيض الأشيع لهذه الكروت؛ اختر سماكته في البرنامج لأن الشقوق تُقاس عليها.')
      return res
    },
  },
  {
    id: 'invitebox',
    name: 'علبة كرت الدعوة',
    desc: 'علبة مسطّحة بغطاء ذي شفة على مقاس كرت الدعوة، بإطار محفور على الغطاء لاسمَي العروسين؛ تُقصّ بالجملة من أكريليك شفّاف أو مرآة.',
    icon: `<path d="M8 24h48v24H8z"/><path d="M6 18h52v6H6z"/><path d="M16 30h32v12H16z" stroke-width="1.3"/><path d="M22 36h20" stroke-width="1.3"/>`,
    params: [
      mm('cw', 'عرض الكرت', 80, 300), mm('ch', 'طول الكرت', 100, 400), mm('depth', 'عمق المحتوى', 4, 60, 'الكرت وحده 3–5 مم؛ مع شوكولا أو هدية أكثر'),
      mm('lipH', 'ارتفاع الشفة', 6, 30), mm('gap', 'خلوص الشفة', 0.2, 1.5),
      { key: 'frame', label: 'إطار محفور على الغطاء', min: 0, max: 1, step: 1, int: true }, { key: 'n', label: 'العدد', min: 1, max: 100, step: 1, int: true },
    ],
    defaults: { cw: 150, ch: 210, depth: 6, lipH: 9, gap: 0.4, frame: 1, n: 10 },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      const t = c.t, n = Math.round(p.n)
      // the card lies under the lip frame: the box is the card plus 1 mm all round, as deep as the contents plus the lip
      const W = round3(p.cw + 2 + 2 * t), D = round3(p.ch + 2 + 2 * t), H = round3(t + p.depth + p.lipH + 1)
      const q = { ...p, W, D, H }
      checkBasics(q, c, warnings, errors)
      const { panels, notes } = lipLidBox(q, c, errors)
      if (Math.round(p.frame) > 0) {
        const lid = panels.find(x => x.id === 'lid')!, m = 2 * t + p.gap + 8
        lid.engrave = [...(lid.engrave ?? []), { ...roundedRectHole(round3(m), round3(m), round3(W - 2 * m), round3(D - 2 * m), 6), layer: 'engrave' }]
      }
      for (const sp of panels) sp.count = (sp.count ?? 1) * n
      return {
        panels,
        notes: [`${arCount(n, ['علبة واحدة', 'علبتان', 'علب', 'علبة'])} ${W} × ${D} × ${H} مم لكرت ${p.cw} × ${p.ch} مم؛ تحت الشفة ${p.depth} مم للكرت وما معه.`, ...notes, 'اكتب اسمَي العروسين والتاريخ داخل الإطار المحفور على الغطاء. للأكريليك الشفّاف انزع ورق الحماية بعد القصّ واستعمل غراء الأكريليك السائل.'],
        warnings, errors,
      }
    },
  },
)

// ------------------------------------------------------------------ calibration

MORE.push({
  id: 'fittest',
  name: 'اختبار التعشيق والسماكة',
  desc: 'مشط بشقوق مفتوحة تتدرّج حول السماكة المُدخلة، وزاوية صغيرة بأصابع تعشيق: اقصّها من قطعة صغيرة من اللوح نفسه قبل أي تصميم، فتعرف السماكة التي تُدخلها فتدخل القطع بضغط اليد دون كسر.',
  icon: `<path d="M6 20h52v24H6z"/><path d="M12 20v8M20 20v8M28 20v8M36 20v8M44 20v8M52 20v8" stroke-width="2.5"/><path d="M11 36h2M19 36h2M27 36h2M35 36h2M43 36h2M51 36h2" stroke-width="1.5"/>`,
  params: [
    { key: 'count', label: 'عدد الشقوق', min: 5, max: 15, step: 1, int: true },
    { key: 'step', label: 'الفرق بين شقّ وآخر', min: 0.05, max: 0.3, step: 0.05, unit: 'مم' },
    { key: 'below', label: 'شقوق أضيق من السماكة', min: 0, max: 6, step: 1, int: true, hint: 'كم شقّاً قبل شقّ السماكة المُدخلة' },
  ],
  defaults: { count: 9, step: 0.1, below: 2 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, k = Math.round(p.count), below = Math.min(Math.round(p.below), k - 1), step = p.step
    const widths = Array.from({ length: k }, (_, i) => round3(t + (i - below) * step))
    if (widths[0] < 0.5) errors.push('الشقّ الأضيق أرفع من 0.5 مم: قلّل «شقوق أضيق من السماكة» أو الفرق بين الشقوق.')
    // the comb: open slots from the top edge, a numbered label under each, teeth at least 2 t wide between them
    const pitch = round3(Math.max(14, widths[k - 1] + 2 * t + 6)), depth = round3(Math.max(12, 3 * t)), m = 8
    const W = round3(2 * m + k * pitch), H = round3(depth + 22)
    const xs = widths.map((_, i) => round3(m + pitch * (i + 0.5)))
    const gh = 7, labels: Loop[] = []
    xs.forEach((x, i) => { for (const g of numberGlyphs(i + 1, x, depth + 4 + gh / 2 + 1, gh)) for (const l of g.loops) labels.push({ ...l, layer: 'engrave' }) })
    // a mark under the slot of the thickness entered
    const xt = xs[below]
    labels.push({ closed: true, layer: 'engrave', pts: [{ x: round3(xt - 3), y: round3(H - 3) }, { x: round3(xt + 3), y: round3(H - 3) }, { x: round3(xt), y: round3(H - 7) }] })
    const panels: PanelSpec[] = [
      { id: 'comb', name: 'مشط الشقوق', w: W, h: H, cuts: widths.map((w, i) => rect(round3(xs[i] - w / 2), 0, w, depth)), engrave: labels, note: 'الرقم تحت كل شقّ؛ المثلّث تحت شقّ السماكة المُدخلة' },
      { id: 'strip', name: 'شريحة التجربة', w: round3(Math.max(60, W / 2)), h: 12, note: 'تُدخل في الشقوق، أو جرّب بأي قطعة من اللوح نفسه' },
      // a small corner with finger joints at the current kerf and finger settings
      { id: 'corner-a', name: 'زاوية التجربة — القطعة الأولى', w: 50, h: 40, right: 'male', note: 'تُركّب مع الثانية على شكل L' },
      { id: 'corner-b', name: 'زاوية التجربة — القطعة الثانية', w: 50, h: 40, left: 'female', note: 'أصابعها تدخل بين أصابع الأولى' },
    ]
    const table = widths.map((w, i) => `${i + 1} = ${w.toFixed(2)}`).join('، ')
    return {
      panels,
      notes: [
        `عرض الشقوق بالترتيب (مم): ${table}. الشقّ ${below + 1} (عليه المثلّث) يساوي السماكة المُدخلة ${t} مم.`,
        'اقصّ هذه القطع من اللوح نفسه الذي ستقصّ منه التصميم، وبإعداد الليزر نفسه. أدخل الشريحة (أو حافّة أي قطعة من اللوح) في الشقوق من الأضيق: الشقّ الذي تدخل فيه بضغط اليد بلا كسر ولا رخاوة، رقمه في الجدول هو السماكة التي تكتبها في «سماكة الخامة». التصاميم تضيف فوقها خلوصاً صغيراً من نفسها.',
        'زاوية التجربة: إن دخلت أصابعها بالقوة فقلّل «عرض الشقّ (kerf)» 0.03–0.05 مم، وإن كانت رخوة فزِده، ثم أعد القصّ. الشقوق والأصابع تتأثر بالـ kerf والسماكة معاً، فاضبط السماكة أولاً.',
        'السماكة تختلف بين الألواح وأحياناً في اللوح نفسه: كرّر الاختبار مع كل لوح جديد.',
      ],
      warnings, errors,
    }
  },
})

// ------------------------------------------------------------------ incense burner stands

/** Where the horizontal line y = Y crosses a closed polygon, left to right. */
function crossX(pts: P2[], Y: number): number[] {
  const xs: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    if ((a.y <= Y && b.y > Y) || (b.y <= Y && a.y > Y)) xs.push(a.x + ((b.x - a.x) * (Y - a.y)) / (b.y - a.y))
  }
  return xs.sort((u, v) => u - v)
}
/** A monotone cubic through (y, x) knots, sampled every mm: a smooth outline down one side. */
function smoothSide(knots: [number, number][]): P2[] {
  const out: P2[] = []
  const n = knots.length, d: number[] = []
  for (let i = 0; i < n; i++) {
    const p = knots[Math.max(0, i - 1)], q = knots[Math.min(n - 1, i + 1)]
    d.push((q[1] - p[1]) / (q[0] - p[0] || 1))
  }
  // flat at the turning points (the waist), so the curve does not overshoot
  for (let i = 1; i < n - 1; i++) if ((knots[i][1] - knots[i - 1][1]) * (knots[i + 1][1] - knots[i][1]) <= 0) d[i] = 0
  for (let i = 0; i + 1 < n; i++) {
    const [y0, x0] = knots[i], [y1, x1] = knots[i + 1], h = y1 - y0, m = Math.max(2, Math.ceil(h))
    for (let k = 0; k < m; k++) {
      const s = k / m, h00 = 2 * s ** 3 - 3 * s * s + 1, h10 = s ** 3 - 2 * s * s + s, h01 = -2 * s ** 3 + 3 * s * s, h11 = s ** 3 - s * s
      out.push({ x: h00 * x0 + h10 * h * d[i] + h01 * x1 + h11 * h * d[i + 1], y: y0 + s * h })
    }
  }
  out.push({ x: knots[n - 1][1], y: knots[n - 1][0] })
  return out
}

MORE.push({
  id: 'mabkhara',
  name: 'مبخرة أكريليك متعاشقة',
  desc: 'لوحان يتعاشقان على شكل X بلا غراء، وصحن المبخرة المعدني يتعلّق بحافّته على أربعة أكتاف بين قرنين، بعيداً عن الأكريليك من تحته ومن جوانبه. ثلاثة أشكال، وكل المقاسات من مقاس صحنك.',
  icon: `<path d="M20 8l4 6h16l4-6M24 14v8l6 8v14l-8 12h20l-8-12V30l6-8v-8" /><path d="M22 14h20" stroke-width="3"/><path d="M27 18h10v5H27z" stroke-width="1.3"/>`,
  params: [
    mm('rd', 'قطر حافّة الصحن', 40, 160, 'قِس الحافّة العليا البارزة من طرف إلى طرف (بالقدمة)'),
    mm('bd', 'قطر جسم الصحن', 30, 150, 'تحت الحافّة مباشرة: الجزء الذي ينزل في الحامل'),
    mm('bh', 'عمق الصحن تحت الحافّة', 10, 80),
    { key: 'style', label: 'الشكل', min: 1, max: 3, step: 1, int: true, hint: '1 = قرون وخصر (كالصورة)، 2 = منحنيات ناعمة، 3 = درجات عربية' },
    mm('H', 'الارتفاع', 100, 350), mm('Wt', 'عرض القرنين', 60, 300), mm('Wf', 'عرض القدمين', 60, 300), mm('Ww', 'عرض الخصر', 20, 120),
    mm('gap', 'خلوص حول جسم الصحن', 1, 6, 'هواء بين الصحن الساخن والأكريليك من الجانبين'),
    mm('air', 'هواء تحت الصحن', 8, 40, 'بين قاع الصحن وأقرب أكريليك تحته'),
    { key: 'n', label: 'العدد', min: 1, max: 30, step: 1, int: true },
    { key: 'test', label: 'قطعة تجربة الصحن', min: 0, max: 1, step: 1, int: true, hint: 'قطعة صغيرة بشكل مكان الصحن: اقصّها أولاً وجرّب صحنك فيها' },
    mm('fit', 'خلوص شقّ التعشيق', 0, 0.5),
  ],
  defaults: { rd: 72, bd: 60, bh: 25, style: 1, H: 170, Wt: 130, Wf: 120, Ww: 44, gap: 2.5, air: 12, n: 1, test: 1, fit: 0.15 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, { rd, bd, bh, H, Wt, Wf, Ww, gap, air, fit } = p, style = Math.round(p.style), n = Math.round(p.n)
    const s = round3(t + fit), hw = Ww / 2
    // the bowl: its body drops through a notch gap wider than it, its rim rests on the shoulders either side
    const cw = round3(bd + 2 * gap), ys = 12, dn = round3(bh + air), yNB = round3(ys + dn)
    const xi = round3(rd / 2 + 1.5), tw = 8, xw = round3(Math.max(cw / 2 + 9, xi + 2))
    if (bd >= rd) errors.push('قطر جسم الصحن يجب أن يكون أصغر من قطر حافّته (الحافّة هي التي يستند عليها).')
    else if (rd / 2 - cw / 2 < 3) errors.push(`حافّة الصحن لا تستند بما يكفي: تبرز ${(rd / 2 - cw / 2).toFixed(1)} مم فقط عن فتحة الحامل (3 مم على الأقل). قلّل الخلوص حول الجسم، أو تأكد من القياسين.`)
    if (Wt / 2 < xw + 2) errors.push(`القرنان أضيق من الصحن: اجعل عرضهما ${Math.ceil(2 * (xw + 2 + tw))} مم على الأقل.`)
    if (yNB > H / 2 - 12) errors.push(`المبخرة قصيرة على عمق الصحن: اجعل ارتفاعها ${Math.ceil(2 * (yNB + 12))} مم على الأقل.`)
    if (hw < s / 2 + 8) errors.push(`الخصر ضيّق على شقّ التعشيق: اجعله ${Math.ceil(s + 16)} مم على الأقل.`)
    if (Wf < 0.55 * H) errors.push(`القدمان قريبتان على هذا الارتفاع وقد تنقلب: اجعل عرضهما ${Math.ceil(0.55 * H)} مم على الأقل.`)
    // the right half's outer side, from the wing tip down to the foot, in the chosen style
    const yw0 = round3(Math.max(yNB + 16, 0.42 * H)), yw1 = round3(0.74 * H), fw = 12, ah = round3(Math.min(0.17 * H, H / 2 - 14))
    let side: P2[]
    if (style === 2) side = smoothSide([[0, Wt / 2], [yNB + 6, xw], [(yw0 + yw1) / 2, hw], [H - 6, Wf / 2]]).concat([{ x: Wf / 2, y: H }])
    else if (style === 3) side = [
      { x: Wt / 2, y: 0 }, { x: Wt / 2, y: ys + 6 }, { x: xw + 4, y: ys + 6 }, { x: xw + 4, y: yNB + 6 }, { x: hw + 10, y: yNB + 6 }, { x: hw + 10, y: yw0 },
      { x: hw, y: yw0 }, { x: hw, y: yw1 }, { x: hw + 10, y: yw1 }, { x: hw + 10, y: yw1 + 10 }, { x: Wf / 2, y: H - 10 }, { x: Wf / 2, y: H },
    ]
    else side = [
      { x: Wt / 2, y: 0 }, { x: xw, y: yNB + 6 }, { x: hw + 4, y: yw0 }, { x: hw + 4, y: yw0 + 5 }, { x: hw, y: yw0 + 5 },
      { x: hw, y: yw1 - 5 }, { x: hw + 4, y: yw1 - 5 }, { x: hw + 4, y: yw1 }, { x: Wf / 2, y: H - 8 }, { x: Wf / 2, y: H },
    ]
    // the arch between the feet, as a parabola from the foot's inner corner to its apex in the middle
    const xe = Wf / 2 - fw, K = Math.max(8, Math.ceil(xe / 2))
    const arch = Array.from({ length: K + 1 }, (_, i) => { const x = xe * (1 - i / K); return { x, y: H - ah * (1 - (x / xe) ** 2) } })
    const archAt = (x: number) => H - ah * (1 - (x / xe) ** 2)
    // one plate, centred on x = 0: `top` has the halving slot from the notch down, otherwise from the arch up
    const plate = (top: boolean): P2[] => {
      // the arch's points stop short of the middle, and of the slot's edge on the plate slotted from below
      const right: P2[] = [{ x: cw / 2, y: yNB }, { x: cw / 2, y: ys }, { x: xi, y: ys }, { x: Wt / 2 - tw, y: 0 }, ...side, { x: Wf / 2 - fw, y: H }, ...arch.slice(1, -1).filter(q => q.x > (top ? 0.5 : s / 2 + 0.5))]
      const mid = top ? [{ x: s / 2, y: H / 2 }, { x: s / 2, y: yNB }] : [{ x: cw / 2, y: yNB }]
      const bottom = top ? [{ x: 0, y: H - ah }] : [{ x: s / 2, y: archAt(s / 2) }, { x: s / 2, y: H / 2 }, { x: -s / 2, y: H / 2 }, { x: -s / 2, y: archAt(s / 2) }]
      const r = top ? right : right.slice(1)
      const left = [...r].reverse().map(q => ({ x: -q.x, y: q.y }))
      const topClose = top ? [{ x: -s / 2, y: yNB }, { x: -s / 2, y: H / 2 }] : [{ x: -cw / 2, y: yNB }]
      return top ? [...mid, ...r, ...bottom, ...left, ...topClose] : [...mid, ...r, ...bottom, ...left, ...topClose]
    }
    const W0 = Math.max(Wt, Wf) / 2
    const toLoop = (pts: P2[]) => polyLoop(pts.map(q => ({ x: round3(q.x + W0), y: round3(q.y) })), 'outer')
    const A = plate(true), B = plate(false)
    // strength: across every height, each piece of acrylic at least 6 mm wide (the feet's flats excepted at the very bottom)
    if (!errors.length) {
      let thin = Infinity, at = 0
      for (const pl of [A, B]) for (let y = 0.5; y < H - 2; y += 0.5) {
        const xs = crossX(pl, y)
        for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] < thin) { thin = xs[i + 1] - xs[i]; at = y }
      }
      if (thin < 6) errors.push(`في اللوح جزء أرفع من 6 مم (${thin.toFixed(1)} مم على ارتفاع ${at.toFixed(0)} مم من الأعلى): غيّر العرض أو الارتفاع أو مقاس الصحن.`)
    }
    const panels: PanelSpec[] = [
      { id: 'plate-a', name: 'اللوح الأول — شقّه من الأعلى', w: 2 * W0, h: H, count: n, shape: [toLoop(A)], note: 'يُدخل الثاني فيه من الأعلى' },
      { id: 'plate-b', name: 'اللوح الثاني — شقّه من الأسفل', w: 2 * W0, h: H, count: n, shape: [toLoop(B)], note: 'ينزل على الأول حتى تتساوى قاعدتاهما' },
    ]
    if (Math.round(p.test) > 0) {
      const tx = xi + 10, ty = yNB + 10
      panels.push({ id: 'bowl-test', name: 'قطعة تجربة الصحن', w: 2 * tx, h: ty, shape: [polyLoop([
        { x: -tx, y: 0 }, { x: -xi, y: 0 }, { x: -xi, y: ys }, { x: -cw / 2, y: ys }, { x: -cw / 2, y: yNB }, { x: cw / 2, y: yNB }, { x: cw / 2, y: ys }, { x: xi, y: ys }, { x: xi, y: 0 }, { x: tx, y: 0 }, { x: tx, y: ty }, { x: -tx, y: ty },
      ].map(q => ({ x: round3(q.x + tx), y: round3(q.y) })), 'outer')], note: 'جرّب صحنك فيها قبل قصّ المبخرة' })
    }
    return {
      panels,
      notes: [
        `للصحن: حافّة ${rd} مم، جسم ${bd} مم، عمق ${bh} مم. فتحة الحامل ${cw} مم (${gap} مم هواء من كل جانب)، والحافّة تستند ${(rd / 2 - cw / 2).toFixed(1)} مم على كل كتف من الأكتاف الأربعة، وتحت القاع ${air} مم هواء.`,
        'قِس صحنك بالقدمة قبل القصّ: الحافّة العليا من طرف إلى طرف، والجسم تحتها مباشرة، والعمق من الحافّة إلى القاع. ثم اقصّ «قطعة تجربة الصحن» أولاً وضع الصحن فيها: يجب أن ينزل الجسم بلا احتكاك وتستند الحافّة على الكتفين.',
        `التركيب: أنزل اللوح الثاني (شقّه من الأسفل) على الأول (شقّه من الأعلى) متعامدين حتى تتساوى القاعدتان، ثم ضع الصحن. لا غراء. الارتفاع ${H} مم والقدمان ${Wf} مم.`,
        'الحرارة: الأكريليك يلين قرب 80–100°م. استعمل الصحن المعدني دائماً، ولا تترك الفحم يلمس الأكريليك، واستعمل فحم البخور الصغير؛ الهواء حول الصحن وتحته مقصود فلا تقلّله. الأكريليك 4–5 مم أمتن للمبخرة من 3 مم.',
      ],
      warnings, errors, slotted: true,
    }
  },
})

/** Small engraved circles about `pitch` apart round a rectangle: a beaded border. */
function beadBorder(x0: number, y0: number, x1: number, y1: number, r = 1, pitch = 4): Loop[] {
  const out: Loop[] = []
  const side = (ax: number, ay: number, bx: number, by: number) => {
    const k = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / pitch))
    for (let i = 0; i < k; i++) out.push({ ...circle(round3(ax + ((bx - ax) * i) / k), round3(ay + ((by - ay) * i) / k), r), layer: 'engrave' })
  }
  side(x0, y0, x1, y0); side(x1, y0, x1, y1); side(x1, y1, x0, y1); side(x0, y1, x0, y0)
  return out
}
/** x on a side sampled bottom-up (y holding the height), at height z. */
function xAt(pts: P2[], z: number): number {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1]
    if ((a.y - z) * (b.y - z) <= 0 && a.y !== b.y) return a.x + ((b.x - a.x) * (z - a.y)) / (b.y - a.y)
  }
  return pts[z <= pts[0].y ? 0 : pts.length - 1].x
}
/** Shortest distance from q to the polyline pts. */
function distToPolyline(q: P2, pts: P2[]): number {
  let best = Infinity
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
    const u = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(q.x - a.x - u * dx, q.y - a.y - u * dy))
  }
  return best
}


/** The eight-fold rhombus star, point to point D, centred on (cx, cy): eight 45° rhombi round the centre and eight
 * squares in the notches between them (on the axes as diamonds, on the diagonals upright). */
function rhombusStar(cx: number, cy: number, D: number) {
  const a = D / 2 / (1 + Math.SQRT2), u = (k: number) => ({ x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) })
  const at = (x: number, y: number): P2 => ({ x: cx + x, y: cy + y })
  const A = (k: number) => at(a * u(k).x, a * u(k).y)
  const T = (k: number) => at(a * (u(k).x + u(k + 1).x), a * (u(k).y + u(k + 1).y))
  const C = (k: number) => at(a * (1 + Math.SQRT2) * u(k).x, a * (1 + Math.SQRT2) * u(k).y)
  const O = at(0, 0), ks = [0, 1, 2, 3, 4, 5, 6, 7]
  return {
    a,
    outline: ks.flatMap(k => [C(k), T(k)]),
    cells: [...ks.map(k => [O, A(k), T(k), A(k + 1)]), ...ks.map(k => [A(k), T(k), C(k), T(k - 1)])],
    // every line once: the spokes, a V round each square's inner corner, and the outline
    lines: ks.flatMap(k => [[O, A(k)], [T(k - 1), A(k), T(k)]]),
  }
}
/** A closed polygon moved outwards (d > 0) or inwards (d < 0) by |d|, whichever way round it runs. */
const grow = (pts: P2[], d: number) => {
  const A = pts.reduce((sum, p, k) => { const q = pts[(k + 1) % pts.length]; return sum + p.x * q.y - q.x * p.y }, 0)
  return offsetPolyline(pts, true, A > 0 ? d : -d)
}

MORE.push({
  id: 'mabkharatower',
  name: 'مبخرة برج بالمرايا',
  desc: 'برج مربّع: واجهتان من المرآة بإطار وزخرفة محفورة، وجانبان مخرّمان من المرآة فوق لون الجدار. الصحن المعدني يتعلّق بحافّته في السطح، وفوقه قبّة مفتوحة متعاشقة بريشة.',
  icon: `<path d="M20 26h24v32H20z"/><path d="M17 23h30v3H17zM17 58h30v3H17z"/><path d="M24 23c0-9 16-9 16 0" /><path d="M32 14V10M32 2c3 2 3 6 0 8-3-2-3-6 0-8z" stroke-width="1.5"/><path d="M24 30h9v24h-9z" stroke-width="1.3"/><path d="M37 32l3 3-3 3-3-3zM37 44l3 3-3 3-3-3z" stroke-width="1.3"/>`,
  params: [
    mm('S', 'عرض البرج', 70, 250, 'عرض الجدار من الخارج (البرج مربّع)'),
    mm('H', 'ارتفاع الجدران', 100, 500, 'بين القاعدة والسطح'),
    mm('ov', 'بروز القاعدة والسطح', 2, 15, 'عن الجدران من كل جهة'),
    mm('tm', 'سماكة أكريليك المرآة', 1, 5, 'للواجهات والإطار والقبّة: قِسها، فشقوق القبّة عليها'),
    mm('rd', 'قطر حافّة الصحن', 40, 160, 'قِس الحافّة العليا البارزة من طرف إلى طرف (بالقدمة)'),
    mm('bd', 'قطر جسم الصحن', 30, 150, 'تحت الحافّة مباشرة: الجزء الذي ينزل في الفتحة'),
    mm('bh', 'عمق الصحن تحت الحافّة', 10, 120),
    mm('gap', 'خلوص حول جسم الصحن', 1, 6),
    { key: 'pattern', label: 'تخريم الجانبين', min: 1, max: 7, step: 1, int: true, hint: PATTERN_HINT },
    { key: 'cell', label: 'حجم ثقب التخريم', min: 6, max: 40, step: 0.5, unit: 'مم' },
    { key: 'motif', label: 'زخرفة الواجهة', min: 0, max: 4, step: 1, int: true, hint: '0 = إطار فقط، 1 = قلب، 2 = نجمة ثمانية، 3 = محراب، 4 = نجمة المعيّنات؛ تُحفر على المرآة ويمكنك إضافة حرف أو اسم' },
    { key: 'gold', label: 'نجمة المعيّنات قطعة ذهبية', min: 0, max: 1, step: 1, int: true, hint: '1 = تُقصّ من مرآة ذهبية مخرّمة وتُلصق على الواجهة، 0 = تُحفر خطوطاً على الواجهة' },
    { key: 'beads', label: 'حبيبات على الحواف', min: 0, max: 1, step: 1, int: true, hint: 'صفّ دوائر صغيرة محفورة حول الواجهات والإطار' },
    { key: 'dome', label: 'القبّة والريشة', min: 0, max: 1, step: 1, int: true },
    mm('dh', 'ارتفاع القبّة', 45, 120, 'بدون الريشة'),
    { key: 'test', label: 'قطعة تجربة الصحن', min: 0, max: 1, step: 1, int: true },
    { key: 'n', label: 'العدد', min: 1, max: 20, step: 1, int: true },
    mm('fit', 'خلوص الشقوق', 0, 0.5),
  ],
  defaults: { S: 115, H: 250, ov: 5, tm: 2, rd: 65, bd: 52, bh: 20, gap: 2.5, pattern: 7, cell: 12, motif: 4, gold: 1, beads: 1, dome: 1, dh: 60, test: 1, n: 1, fit: 0.15 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, { S, H, ov, tm, rd, bd, bh, gap, cell, fit } = p, n = Math.round(p.n), dome = Math.round(p.dome) > 0
    const P = round3(S + 2 * ov), st = round3(t + fit), s = round3(tm + fit)
    // the bowl: its body drops through the top plate's hole, its rim rests round it
    const cw = round3(bd + 2 * gap)
    if (bd >= rd) errors.push('قطر جسم الصحن يجب أن يكون أصغر من قطر حافّته (الحافّة هي التي يستند عليها).')
    else if (rd / 2 - cw / 2 < 3) errors.push(`حافّة الصحن لا تستند بما يكفي: تبرز ${(rd / 2 - cw / 2).toFixed(1)} مم فقط عن الفتحة (3 مم على الأقل). قلّل الخلوص حول الجسم، أو تأكد من القياسين.`)
    if (cw / 2 + 4 > S / 2 - t) errors.push(`البرج ضيّق على الصحن: اجعل عرضه ${Math.ceil(cw + 8 + 2 * t)} مم على الأقل.`)
    if (bh + 15 > H) errors.push(`الجدران قصيرة على عمق الصحن: اجعلها ${Math.ceil(bh + 15)} مم على الأقل.`)
    if (tm + 0.5 > ov) warnings.push(`المرآة (${tm} مم) أسمك من بروز القاعدة والسطح (${ov} مم)؛ ستبرز خارجهما. زد البروز إلى ${Math.ceil(tm + 0.5)} مم.`)
    // the top frame covers the tab ends; the bowl's rim and the dome's ring sit inside its window
    const bt = round3(ov + t + 2), win = P / 2 - bt
    const tw = 6, band = 14, Ri = round3(rd / 2 + 1.5), Ro = round3(Ri + band), rm = round3(Ri + band / 2)
    if (dome && Ro > win - 1) errors.push(`السطح صغير على حلقة القبّة: اجعل عرض البرج ${Math.ceil(2 * (Ro + 1 + bt - ov))} مم على الأقل، أو ألغِ القبّة.`)
    else if (!dome && rd / 2 + 2 > win) errors.push(`السطح صغير على حافّة الصحن: اجعل عرض البرج ${Math.ceil(2 * (rd / 2 + 2 + bt - ov))} مم على الأقل.`)

    // walls: H between base and top plate, with a t-deep strip of tabs at each end; front and back span the full
    // width, the sides fit between them
    const wallTw = round3(Math.min(16, 0.2 * S)), ks = [0.25, 0.75]
    const strip = (w: number) => {
      const out: ReturnType<typeof rect>[] = []
      for (const y of [0, H + t]) {
        let x0 = 0
        for (const k of ks) { out.push(rect(x0, y, w * k - wallTw / 2 - x0, t)); x0 = w * k + wallTw / 2 }
        out.push(rect(x0, y, w - x0, t))
      }
      return out
    }
    const slots: Loop[] = []
    for (const k of ks) {
      for (const y of [ov + t / 2, ov + S - t / 2]) slots.push(rotatedRectHole(round3(ov + S * k), round3(y), wallTw + fit, st, 0))
      for (const x of [ov + t / 2, ov + S - t / 2]) slots.push(rotatedRectHole(round3(x), round3(ov + t + (S - 2 * t) * k), st, wallTw + fit, 0))
    }
    const copy = (ls: Loop[]) => ls.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v })) }))
    const beads = Math.round(p.beads) > 0
    const ms = round3(Math.min(0.5 * (S - 19), 0.3 * H)), cx = S / 2, cy = H / 2
    const motif = Math.round(p.motif)
    const mark = (l: Loop): Loop => ({ ...l, layer: 'engrave' })
    const motifLoops: Loop[] =
      motif === 1 ? [mark(heart(cx, cy, ms)), mark(heartFrame(cx, cy, ms, 3).holes()[0])]
      : motif === 2 ? [engraveLoop(starPts(cx, cy, ms / 2, (ms / 2) * 0.765, 8, 0)), engraveLoop(starPts(cx, cy, ms / 2 - 6, (ms / 2 - 6) * 0.765, 8, 0))]
      : motif === 3 ? [mark(archHole(cx - 0.35 * ms, cy - 0.65 * ms, 0.7 * ms, 1.3 * ms)), mark(archHole(cx - 0.35 * ms + 4, cy - 0.65 * ms + 4, 0.7 * ms - 8, 1.3 * ms - 8))]
      : []
    // the rhombus star: engraved lines, or a gold strapwork piece (the cells shrunk by half a strap, the outline grown
    // by half a strap) glued over an engraved outline
    const extra: PanelSpec[] = []
    if (motif === 4) {
      const st4 = rhombusStar(cx, cy, round3(Math.min(0.72 * (S - 19), 0.35 * H))), sw4 = round3(Math.max(2.2, 0.16 * st4.a))
      const goldOk = st4.a * Math.SQRT1_2 - sw4 >= 2
      if (Math.round(p.gold) > 0 && !goldOk) warnings.push('الواجهة صغيرة على نجمة المعيّنات الذهبية (ثقوبها أصغر من 2 مم)؛ ستُحفر خطوطاً بدلاً منها. كبّر البرج أو اجعلها محفورة.')
      if (Math.round(p.gold) > 0 && goldOk) {
        const out = grow(st4.outline, sw4 / 2), xs = out.map(q => q.x), ys = out.map(q => q.y)
        const ox = Math.min(...xs), oy = Math.min(...ys), sh = (ps: P2[]) => ps.map(q => ({ x: round3(q.x - ox), y: round3(q.y - oy) }))
        motifLoops.push(engraveLoop(out))
        extra.push({
          id: 'star-gold', name: 'نجمة المعيّنات (مرآة ذهبية)', w: round3(Math.max(...xs) - ox), h: round3(Math.max(...ys) - oy), count: 2 * n, material: 'gold',
          shape: [polyLoop(sh(out), 'outer')], holes: st4.cells.map(c => polyLoop(sh(grow(c, -sw4 / 2)), 'hole')),
          note: 'تُلصق في وسط الواجهة على الخط المحفور',
        })
      } else motifLoops.push(engraveLoop(st4.outline), ...st4.lines.map(l => ({ closed: false, layer: 'engrave' as const, pts: l.map(q => ({ x: round3(q.x), y: round3(q.y) })) })))
    }
    const fw = round3(S + 2 * tm), m = tm + 7
    const filigree = pattern(Math.round(p.pattern), m, 7, fw - m, H - 7, cell)
    if (!filigree.length) warnings.push('الجانبان أصغر من أن يحملا التخريم بهذا الحجم وسيبقيان بلا ثقوب؛ صغّر حجم الثقب.')
    const panels: PanelSpec[] = [
      { id: 'base', name: 'القاعدة', w: P, h: P, count: n, holes: slots, note: 'الشقوق لألسنة الجدران' },
      { id: 'wall-fb', name: 'الجدار — الأمام / الخلف', w: S, h: round3(H + 2 * t), count: 2 * n, cuts: strip(S), note: 'بعرض البرج كاملاً' },
      { id: 'wall-side', name: 'الجدار — الجانب', w: round3(S - 2 * t), h: round3(H + 2 * t), count: 2 * n, cuts: strip(S - 2 * t), note: 'يدخل بين الأمام والخلف' },
      { id: 'top', name: 'السطح (مكان الصحن)', w: P, h: P, count: n, holes: [...copy(slots), circle(P / 2, P / 2, cw / 2)], engrave: [{ ...circle(P / 2, P / 2, rd / 2), layer: 'engrave' }], note: 'الدائرة المحفورة موضع حافّة الصحن' },
      { id: 'top-frame', name: 'إطار السطح (مرآة)', w: P, h: P, count: n, material: 'mirror', holes: [roundedRectHole(bt, bt, P - 2 * bt, P - 2 * bt, 0)], engrave: beads ? beadBorder(bt / 2, bt / 2, P - bt / 2, P - bt / 2) : [], note: 'يُلصق فوق السطح ويخفي أطراف الألسنة' },
      {
        id: 'face', name: 'الواجهة — الأمام / الخلف (مرآة)', w: S, h: H, count: 2 * n, material: 'mirror',
        engrave: [engraveRect(7, 7, S - 14, H - 14), engraveRect(9.5, 9.5, S - 19, H - 19), ...motifLoops, ...(beads ? beadBorder(3.5, 3.5, S - 3.5, H - 3.5) : [])],
        note: 'تُلصق على الجدار بين القاعدة والسطح',
      },
      ...extra,
      { id: 'face-side', name: 'الجانب المخرّم (مرآة)', w: fw, h: H, count: 2 * n, material: 'mirror', holes: filigree, engrave: beads ? beadBorder(tm + 3.5, 3.5, fw - tm - 3.5, H - 3.5) : [], note: `أعرض من الجدار بـ ${tm} مم من كل طرف: يغطّي حافّتي الواجهتين` },
    ]

    // the dome: two mirror profiles cross-lapped at the crown, open between their legs, standing by four tabs in a
    // ring that sits round the bowl's rim. Heights z run up from the ring's top; P2.y holds z while building
    const notes: string[] = []
    if (dome && !errors.length) {
      const hd = p.dh, cb = 16, cr = Math.max(s / 2 + 4.5, 7), lw = 7, Rb = Ro - 1, xi0 = round3(rm - tw / 2 - 3)
      // a bell: a half ellipse swelling a little above the feet, flattened at the crown into a neck cr wide
      const outer = Array.from({ length: Math.ceil(hd) + 1 }, (_, i) => {
        const u = Math.min(1, i / hd)
        return { x: Math.max(cr, Rb * (1 + 0.07 * Math.sin(Math.PI * u)) * Math.sqrt(Math.max(0, 1 - u ** 2.2))), y: u * hd }
      })
      // the opening: the outline moved lw inwards along its normal (so every leg is lw wide), flared out to the feet
      // and closed by a pointed arch at least cb under the top, where the two profiles cross
      const off = outer.map((q, i) => {
        const a = outer[Math.max(0, i - 1)], b = outer[Math.min(outer.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y)
        return { x: q.x - (lw * (b.y - a.y)) / l, y: q.y + (lw * (b.x - a.x)) / l }
      })
      const zc = hd - cb, z1 = 0.55 * hd, x1 = xAt(off, z1)
      const inner: P2[] = []
      for (let z = 0; ; z += 1) {
        const x = Math.min(xAt(off, z), xi0 + 0.8 * z, z <= z1 ? Infinity : x1 * Math.max(0, (zc - z) / (zc - z1)) ** 0.6)
        if (x <= 0.3 || z >= zc) { inner.push({ x: 0, y: Math.min(z, zc) }); break }
        inner.push({ x, y: z })
      }
      const za = inner[inner.length - 1].y, zm = (za + hd) / 2
      const sw = 3, fl = round3(Math.max(24, 0.5 * hd)), fwd = round3(Math.max(6, 0.27 * fl)), z0 = hd + 5, zTip = z0 + fl
      const xL = (u: number) => Math.max(sw, fwd * Math.sin(Math.PI * (0.08 + 0.87 * u)) ** 0.8)
      const leaf = Array.from({ length: 25 }, (_, i) => ({ x: xL(i / 24), y: z0 + (fl * i) / 24 }))
      const foot = (sg: number) => [{ x: sg * xi0, y: 0 }, { x: sg * (rm - tw / 2), y: 0 }, { x: sg * (rm - tw / 2), y: -t }, { x: sg * (rm + tw / 2), y: -t }, { x: sg * (rm + tw / 2), y: 0 }]
      const mir = (ps: P2[]) => ps.map(q => ({ x: -q.x, y: q.y }))
      const profile = (feather: boolean): P2[] => {
        const top = feather
          ? [{ x: sw, y: hd }, ...leaf, ...mir(leaf).reverse(), { x: -sw, y: hd }]
          : [{ x: s / 2, y: hd }, { x: s / 2, y: zm }, { x: -s / 2, y: zm }, { x: -s / 2, y: hd }]
        const inR = feather ? inner.filter(q => q.x > s / 2 + 0.5) : inner.slice(0, -1)
        const apex = feather ? [{ x: -s / 2, y: za }, { x: -s / 2, y: zm }, { x: s / 2, y: zm }, { x: s / 2, y: za }] : [{ x: 0, y: za }]
        return [...foot(1), ...outer, ...top, ...mir(outer).reverse(), ...foot(-1).reverse(), ...mir(inR), ...apex, ...[...inR].reverse()]
      }
      const A = profile(true), B = profile(false)
      // strength: every leg at least 5 mm across, every horizontal section of acrylic at least 4 mm
      const legMin = Math.min(...inner.filter(q => q.y > 0).map(q => distToPolyline(q, outer)))
      let thin = Infinity
      for (const pl of [A, B]) for (let z = -t + 0.5; z < hd - 0.25; z += 0.5) {
        const xs = crossX(pl, z)
        for (let i = 0; i + 1 < xs.length; i += 2) thin = Math.min(thin, xs[i + 1] - xs[i])
      }
      if (legMin < 5 || thin < 4) errors.push(`أرجل القبّة رفيعة (${Math.min(legMin, thin).toFixed(1)} مم): زد ارتفاع القبّة.`)
      const W0 = Math.max(...A.map(q => Math.abs(q.x)))
      const toPanel = (pts: P2[], zt: number) => pts.map(q => ({ x: round3(q.x + W0), y: round3(zt - q.y) }))
      const vane: Loop[] = [{ closed: false, layer: 'engrave', pts: toPanel([{ x: 0, y: z0 }, { x: 0, y: zTip - 3 }], zTip) }]
      for (let z = z0 + 3; z < zTip - 5; z += 3) {
        const u = (z - z0) / fl, x = xL(u), e = 0.75 * Math.min(x, xL(Math.min(1, u + (0.5 * x) / fl)))
        for (const sg of [1, -1]) vane.push({ closed: false, layer: 'engrave', pts: toPanel([{ x: 0, y: z }, { x: sg * e, y: z + 0.5 * e }], zTip) })
      }
      panels.push(
        { id: 'dome-a', name: 'القبّة — اللوح ذو الريشة (مرآة)', w: round3(2 * W0), h: round3(zTip + t), count: n, material: 'mirror', shape: [polyLoop(toPanel(A, zTip), 'outer')], engrave: vane, note: 'شقّه من الداخل إلى الأعلى: يُنزل فوق الثاني' },
        { id: 'dome-b', name: 'القبّة — اللوح الثاني (مرآة)', w: round3(2 * W0), h: round3(hd + t), count: n, material: 'mirror', shape: [polyLoop(toPanel(B, hd), 'outer')], note: 'شقّه من القمّة إلى الأسفل' },
        {
          id: 'dome-ring', name: 'حلقة القبّة', w: round3(2 * Ro), h: round3(2 * Ro), count: n, shape: [disc(Ro, Ro, Ro)],
          holes: [circle(Ro, Ro, Ri), rotatedRectHole(Ro + rm, Ro, tw + fit, s, 0), rotatedRectHole(Ro - rm, Ro, tw + fit, s, 0), rotatedRectHole(Ro, Ro + rm, s, tw + fit, 0), rotatedRectHole(Ro, Ro - rm, s, tw + fit, 0)],
          note: 'تحيط بحافّة الصحن على السطح؛ تدخل فيها ألسنة القبّة الأربعة',
        },
      )
      notes.push(`القبّة: أنزل اللوح ذا الريشة فوق الثاني متعامدين حتى تتساوى قاعدتاهما، ثم أدخل الألسنة الأربعة في شقوق الحلقة (نقطة لاصق UV تثبّتها). الحلقة تجلس على السطح حول حافّة الصحن (فتحتها ${(2 * Ri).toFixed(0)} مم) وتُرفع مع القبّة لوضع الفحم.`)
      notes.push(`الحرارة: القبّة من المرآة وأقرب جزء منها فوق الجمر مباشرة (التاج) على ارتفاع نحو ${Math.round(za + t)} مم فوق السطح. ضعها بعد أن يهدأ الفحم، واستعمل قطعة فحم بخور صغيرة أو مبخرة كهربائية؛ إن سخن التاج فارفع القبّة أو زد ارتفاعها.`)
    }
    if (Math.round(p.test) > 0) {
      const a = round3(cw + 24)
      panels.push({ id: 'bowl-test', name: 'قطعة تجربة الصحن', w: a, h: a, holes: [circle(a / 2, a / 2, cw / 2)], engrave: [{ ...circle(a / 2, a / 2, rd / 2), layer: 'engrave' }], note: 'اقصّها أولاً وجرّب صحنك فيها' })
    }
    return {
      panels,
      notes: [
        `للصحن: حافّة ${rd} مم، جسم ${bd} مم، عمق ${bh} مم. فتحة السطح ${cw} مم (${gap} مم هواء من كل جانب)، والحافّة تستند ${(rd / 2 - cw / 2).toFixed(1)} مم حولها. اقصّ «قطعة تجربة الصحن» أولاً وجرّب صحنك فيها.`,
        `البرج ${S} × ${S} مم والجدران ${H} مم؛ القاعدة والسطح ${P} مم. الجدران من الأكريليك الأساسي (الأسود أو الأبيض يُظهر التخريم)، والواجهات والجانبان وإطار السطح والقبّة من مرآة سماكتها ${tm} مم.`,
        'التجميع: أدخل ألسنة الجدران في شقوق القاعدة (الأمام والخلف من الخارج والجانبان بينهما) وضع السطح على الألسنة العلوية بلا غراء ليستقيم كل شيء، ثم ألصق الزوايا والألسنة بغراء الأكريليك السائل من الداخل عبر فتحة الصحن.',
        'المرايا: ألصق الواجهتين أولاً بين القاعدة والسطح، ثم الجانبين المخرّمين فيغطّيان حافّتيهما، ثم إطار السطح. على المرآة استعمل لاصق UV أو جِل شفّافاً، لا غراء الأكريليك السائل (يذيب طلاءها). اترك ورق الحماية على وجه المرآة حتى النهاية.',
        ...(extra.length ? ['نجمة المعيّنات الذهبية: اقصّها من مرآة ذهبية، وألصقها بلاصق UV أو جِل على الخط المحفور في وسط كل واجهة، بعد نزع ورق الحماية عن ظهرها فقط.'] : []),
        'الحرف أو الاسم: أضفه في RDWorks نصّاً على طبقة الحفر داخل الإطار المحفور للواجهة.',
        ...notes,
        'الأكريليك يلين قرب 80–100°م: استعمل الصحن المعدني دائماً، ولا تترك الفحم يلمس الأكريليك.',
      ],
      warnings, errors, slotted: true,
    }
  },
})

// ------------------------------------------------------------------ fabric-covered engagement set
MORE.push({
  id: 'fabricset',
  name: 'طقم خطوبة للتلبيس بالقماش',
  desc: 'بوكس كبير للورد، فيه بوكس الخواتم بغطاء يُفتح على مفصل من القماش، ومكعّبا الخاتمين بشقّ. كل المقاسات محسوبة مع سماكة الخشب وسماكة القماش من الخارج والداخل، فيدخل كل شيء في مكانه بعد التلبيس.',
  icon: `<path d="M6 34h52v20H6z"/><path d="M20 24h24v18H20z"/><path d="M20 24l3-14h24l-3 14" /><path d="M24 34h6v5h-6zM34 34h6v5h-6z" stroke-width="1.3"/><circle cx="10" cy="32" r="3"/><circle cx="54" cy="32" r="3"/><circle cx="15" cy="30" r="2.5"/><circle cx="49" cy="30" r="2.5"/>`,
  params: [
    mm('W', 'بوكس الخواتم — العرض', 80, 400, 'مقاس الخشب من الخارج، قبل القماش'),
    mm('D', 'بوكس الخواتم — العمق', 60, 300),
    mm('H', 'بوكس الخواتم — ارتفاع الجسم', 25, 150),
    mm('hl', 'ارتفاع الغطاء', 15, 150, 'الغطاء صندوق ضحل بالمقاس نفسه، يُقلب فوق الجسم'),
    mm('Rr', 'سماكة حافّة بوكس الخواتم', 0, 40, 'جدار مزدوج بإطار علوي يُظهر حافّة عريضة؛ 0 = جدار واحد'),
    mm('tf', 'سماكة القماش', 0.3, 4, 'قِسها مع اللاصق: مخمل عادي نحو 1 مم، مع إسفنجة رقيقة 2–3 مم'),
    mm('cs', 'مكعّب الخاتم — العرض', 20, 80, 'مقاس الخشب'),
    mm('ch', 'مكعّب الخاتم — الارتفاع', 15, 80),
    mm('band', 'سماكة حلقة الخاتم', 1, 6, 'الشقّ بعد القماش يكون بهذا العرض'),
    mm('sl', 'طول الشقّ', 8, 30, 'بعد القماش'),
    mm('ringH', 'بروز الخاتم فوق المكعّب', 5, 40, 'ليُغلق الغطاء فوقه'),
    mm('Wb', 'البوكس الكبير — العرض', 150, 1000), mm('Db', 'البوكس الكبير — العمق', 120, 800), mm('Hb', 'البوكس الكبير — الارتفاع', 30, 300),
    mm('Rb', 'سماكة حافّة البوكس الكبير', 0, 60, 'كما في الصورة نحو 15 مم؛ 0 = جدار واحد'),
    { key: 'seat', label: 'حاضنة بوكس الخواتم', min: 0, max: 1, step: 1, int: true, hint: 'إطار منخفض في البوكس الكبير يثبّت بوكس الخواتم في الخلف؛ 0 = خطّ محفور فقط' },
    mm('fh', 'ارتفاع الحاضنة', 6, 60),
    { key: 'n', label: 'عدد الأطقم', min: 1, max: 20, step: 1, int: true },
  ],
  defaults: { W: 175, D: 125, H: 55, hl: 30, tf: 1, cs: 45, ch: 30, band: 2.5, sl: 16, ringH: 20, Wb: 380, Db: 280, Hb: 80, Rr: 10, Rb: 15, seat: 1, fh: 15, n: 1 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, { W, D, H, hl, tf, cs, ch, band, sl, ringH, Wb, Db, Hb, fh } = p, n = Math.round(p.n), seat = Math.round(p.seat) > 0
    const r1 = (v: number) => (Math.round(v * 10) / 10).toString()
    // fabric goes round the outside of every box and lines the inside walls; the floor of the ring box and the inside
    // of its lid get loose boards, each wrapped in fabric, that drop in with 0.5 mm to spare all round
    const clr = 0.5
    // a thick rim: a second, inner set of walls and a flat frame over both, so the wall reads R thick from outside to
    // inside (heights are the finished ones, the frame included). Without it, one wall t thick
    const rimOf = (R: number, what: string) => {
      if (R <= 0) return t
      if (R < 2 * t) errors.push(`سماكة حافّة ${what} إمّا 0 أو ${round3(2 * t)} مم على الأقل (جداران بسماكة ${t}).`)
      return Math.max(R, 2 * t)
    }
    const er = rimOf(p.Rr, 'بوكس الخواتم'), eb = rimOf(p.Rb, 'البوكس الكبير')
    const Wi = W - 2 * er - 2 * tf, Di = D - 2 * er - 2 * tf            // ring box inside, walls lined
    const insW = round3(Wi - 2 * tf - 2 * clr), insD = round3(Di - 2 * tf - 2 * clr)
    const cf = cs + 2 * tf                                              // a cube with its fabric
    const gx = (Wi - 2 * cf) / 3
    if (gx < 8) errors.push(`بوكس الخواتم ضيّق على مكعّبين بالقماش: اجعل عرضه ${Math.ceil(2 * cf + 24 + 2 * t + 2 * tf)} مم على الأقل، أو صغّر المكعّب.`)
    if (Di - cf < 16) errors.push(`بوكس الخواتم قليل العمق على المكعّب بالقماش: اجعل عمقه ${Math.ceil(cf + 16 + 2 * t + 2 * tf)} مم على الأقل.`)
    // heights: the wrapped floor board, the cube on it, the ring standing up out of it, and the wrapped board in the lid
    const ringTop = t + (t + 2 * tf) + (ch + 2 * tf) + ringH, lidIn = H + hl - t - (t + 2 * tf)
    if (ringTop + 2 > lidIn) errors.push(`الغطاء لا يُغلق فوق الخاتم: ينقص ${r1(ringTop + 2 - lidIn)} مم. زد ارتفاع الجسم أو الغطاء، أو قصّر المكعّب.`)
    if (ch + 2 * tf + t + 2 * tf + t > H - 5) warnings.push('المكعّب أعلى من حافّة الجسم تقريباً؛ سيظهر فوقها والغطاء مفتوح.')
    const slitW = round3(band + 2 * tf), slitL = round3(sl + 2 * tf)
    if (slitL > cs - 2 * t - 6) errors.push(`الشقّ أطول من سطح المكعّب: أقصى طول ${Math.floor(cs - 2 * t - 6 - 2 * tf)} مم بعد القماش، أو كبّر المكعّب.`)
    if (ch < 3 * t + 4) errors.push(`المكعّب قصير على هذه السماكة: ${Math.ceil(3 * t + 4)} مم على الأقل.`)
    // the big box: the seat frame, lined inside, holds the ring box in its fabric, against the back wall
    const Wbi = Wb - 2 * eb - 2 * tf, Dbi = Db - 2 * eb - 2 * tf
    const Fw = round3(W + 2 * tf + 2 * clr + 2 * tf + 2 * t), Fd = round3(D + 2 * tf + 2 * clr + 2 * tf + 2 * t)
    const foot = seat ? { w: Fw, d: Fd } : { w: W + 2 * tf, d: D + 2 * tf }
    if (foot.w + 80 > Wbi) errors.push(`البوكس الكبير ضيّق: يلزم 40 مم للورد على كل جانب، فاجعل عرضه ${Math.ceil(foot.w + 80 + 2 * t + 2 * tf)} مم على الأقل.`)
    if (foot.d + 40 > Dbi) errors.push(`البوكس الكبير قليل العمق: يلزم 40 مم للورد أمام بوكس الخواتم، فاجعل عمقه ${Math.ceil(foot.d + 40 + 2 * t + 2 * tf)} مم على الأقل.`)
    if (seat && fh < 3 * t) errors.push(`الحاضنة منخفضة على تعشيق زواياها: ${Math.ceil(3 * t)} مم على الأقل.`)
    if (seat && fh > Math.min(H, Hb) - 5) errors.push('الحاضنة أعلى من اللازم: اجعلها أقصر من بوكس الخواتم والبوكس الكبير.')
    const capR = p.Rr > 0 ? t : 0, capB = p.Rb > 0 ? t : 0
    if (hl - capR - (capR ? t : 0) < 3 * t) errors.push(`الغطاء ضحل على تعشيق زواياه: ${Math.ceil(3 * t + 2 * capR)} مم على الأقل.`)
    if (H - capR - (capR ? t : 0) < 3 * t) errors.push(`جسم بوكس الخواتم قصير على تعشيق زواياه: ${Math.ceil(3 * t + 2 * capR)} مم على الأقل.`)
    if (Hb - capB - (capB ? t : 0) < 3 * t) errors.push(`البوكس الكبير قصير على تعشيق زواياه: ${Math.ceil(3 * t + 2 * capB)} مم على الأقل.`)

    const times = (ps: PanelSpec[]) => ps.map(x => ({ ...x, count: (x.count ?? 1) * n }))
    const fx = round3((Wb - foot.w) / 2), fy = round3(eb + tf)
    // a box of finished height h: the outer box, and with a rim the inner walls standing on its floor and the frame on top
    const box = (w: number, d: number, h: number, R: number, e: number, name: string, ids: string): PanelSpec[] => {
      if (R <= 0) return openBox(w, d, h, name, ids)
      const fw = round3(w - 2 * (e - t)), fd = round3(d - 2 * (e - t)), fh2 = round3(h - 2 * t)
      return [
        ...openBox(w, d, round3(h - t), name, ids),
        { id: ids + 'frame-fb', name: `${name} — الجدار الداخلي، الأمام / الخلف`, w: fw, h: fh2, left: 'male', right: 'male', count: 2, note: 'يقف على الأرضية داخل الجدران' },
        { id: ids + 'frame-side', name: `${name} — الجدار الداخلي، الجانب`, w: fd, h: fh2, left: 'female', right: 'female', count: 2 },
        // the frame in four strips (not one sheet with its middle thrown away), butted at the corners under the fabric
        { id: ids + 'cap-fb', name: `${name} — شريط الحافّة، الأمام / الخلف`, w, h: round3(e), count: 2, note: 'يُلصق فوق الجدارين فيسدّ ما بينهما' },
        { id: ids + 'cap-side', name: `${name} — شريط الحافّة، الجانب`, w: round3(d - 2 * e), h: round3(e), count: 2, note: 'بين شريطي الأمام والخلف' },
      ]
    }
    const big = box(Wb, Db, Hb, p.Rb, eb, 'البوكس الكبير', 'bb-')
    big[0].engrave = [engraveRect(fx, fy, round3(foot.w), round3(foot.d))]
    big[0].note = `الخطّ المحفور مكان ${seat ? 'الحاضنة' : 'بوكس الخواتم'}: اجعل الحافّة القريبة منه هي الخلفية`
    const panels: PanelSpec[] = times([
      ...big,
      ...(seat ? [
        { id: 'seat-fb', name: 'الحاضنة — الأمام / الخلف', w: Fw, h: fh, left: 'male', right: 'male', count: 2 } as PanelSpec,
        { id: 'seat-side', name: 'الحاضنة — الجانب', w: Fd, h: fh, left: 'female', right: 'female', count: 2 } as PanelSpec,
      ] : []),
      ...box(W, D, H, p.Rr, er, 'بوكس الخواتم', 'rb-'),
      ...box(W, D, hl, p.Rr, er, 'غطاء بوكس الخواتم', 'rl-'),
      { id: 'rb-board', name: 'لوح أرضية بوكس الخواتم (يُغلّف بالقماش)', w: insW, h: insD, note: 'يُغلّف ويوضع في القاع، والمكعّبان فوقه' },
      { id: 'rl-board', name: 'لوح الأسماء داخل الغطاء (يُغلّف بالقماش)', w: insW, h: insD, note: 'يُغلّف ويُلصق في سقف الغطاء، وعليه الأسماء الذهبية' },
      { id: 'cube-top', name: 'مكعّب الخاتم — السطح (بالشقّ)', w: cs, h: cs, top: 'male', right: 'male', bottom: 'male', left: 'male', count: 2, holes: [rotatedRectHole(cs / 2, cs / 2, slitL, slitW, 0)], note: 'الشقّ أعرض بسماكتَي القماش: يُدفع القماش فيه' },
      { id: 'cube-bottom', name: 'مكعّب الخاتم — القاعدة', w: cs, h: cs, top: 'male', right: 'male', bottom: 'male', left: 'male', count: 2 },
      { id: 'cube-fb', name: 'مكعّب الخاتم — الأمام / الخلف', w: cs, h: ch, top: 'female', bottom: 'female', left: 'male', right: 'male', count: 4 },
      { id: 'cube-side', name: 'مكعّب الخاتم — الجانب', w: cs, h: ch, top: 'female', bottom: 'female', left: 'female', right: 'female', count: 4 },
    ])
    const fin = (v: number) => r1(v + 2 * tf)
    const rimNote = p.Rr > 0 || p.Rb > 0 ? [`الحافّة العريضة: في كل صندوق جداران، الخارجي بأرضيته والداخلي يقف على الأرضية على بُعد ${p.Rb > 0 ? r1(eb - t) : r1(er - t)} مم منه${p.Rr > 0 && p.Rb > 0 ? ` (${r1(er - t)} مم في بوكس الخواتم)` : ''}، وفوقهما إطار مسطّح من أربعة أشرطة يسدّ ما بينهما. الصق الداخلي ثم الأشرطة (الأمام والخلف بطول الصندوق، والجانبان بينهما)، ثم لفّ القماش من الخارج فوق الإطار إلى الداخل، فتظهر الحافّة بعرض ${p.Rb > 0 ? r1(eb + 2 * tf) : r1(er + 2 * tf)} مم${p.Rr > 0 && p.Rb > 0 ? ` و${r1(er + 2 * tf)} مم` : ''} بالقماش.`] : []
    return {
      panels,
      notes: [
        ...rimNote,
        `المقاسات بعد القماش (${tf} مم): بوكس الخواتم ${fin(W)} × ${fin(D)}، ارتفاعه مغلقاً نحو ${r1(H + hl + 4 * tf)} مم؛ المكعّب ${fin(cs)} × ${fin(cs)} × ${fin(ch)}؛ البوكس الكبير ${fin(Wb)} × ${fin(Db)} × ${fin(Hb)} مم.`,
        `بوكس الخواتم من الداخل بعد تبطين الجدران ${r1(Wi)} × ${r1(Di)} مم. لوحا الأرضية والأسماء ${r1(insW)} × ${r1(insD)} مم: بعد تغليفهما يبقى 0.5 مم من كل جهة فيدخلان بلا ضغط.`,
        `المكعّبان بالقماش ${r1(cf)} مم؛ ضعهما على لوح الأرضية بمسافة ${r1(gx)} مم بين الجدار والمكعّب وبين المكعّبين، و${r1((Di - cf) / 2)} مم من الأمام والخلف، والشقّ موازٍ للواجهة فيظهر الخاتم من الأمام.`,
        `الشقّ مقصوص ${slitW} × ${slitL} مم: بعد دفع القماش فيه من الجهتين يصبح ${band} × ${sl} مم. ادفعه بسكّين رفيعة قبل لصق الغطاء السفلي للمكعّب.`,
        `الخاتم: من أرضية الجسم إلى رأس الخاتم ${r1(ringTop)} مم، ومن أرضية الجسم إلى لوح الأسماء والغطاء مغلق ${r1(lidIn)} مم، فيبقى فوق الخاتم ${r1(lidIn - ringTop)} مم.`,
        `المفصل من القماش: ضع الغطاء مقلوباً خلف الجسم، اترك بين حافّتيهما ${r1(2 * tf + 1)} مم ليثني القماش، والصق شريطاً واحداً من القماش على الظهرين معاً، ثم لبّس الباقي. ليبقى الغطاء مفتوحاً نحو 100° اربط شريطَي ستان بين جانبي الغطاء والجسم من الداخل.`,
        seat ? `الحاضنة: إطار ${r1(Fw)} × ${r1(Fd)} × ${fh} مم يُلصق على الخطّ المحفور في أرضية البوكس الكبير، ملاصقاً للجدار الخلفي بعد تبطينه. من الداخل بعد تبطينه يتّسع لبوكس الخواتم بقماشه مع 0.5 مم من كل جهة.` : 'الخطّ المحفور في أرضية البوكس الكبير مكان بوكس الخواتم بقماشه، ملاصقاً للجدار الخلفي.',
        `الورد حول بوكس الخواتم: ${r1((Wbi - foot.w) / 2)} مم على كل جانب و${r1(Dbi - foot.d)} مم من الأمام. ضع إسفنج الورد (أواسيس) بعد التبطين.`,
        `الأسماء والتاريخ: اكتبها في RDWorks نصّاً بخطّك، واقصّها من أكريليك مرآة ذهبي بعرض ${Math.floor(insW - 30)} مم على الأكثر لتُلصق على لوح الأسماء. وكذلك الكتابة على البوكس الكبير.`,
        `الخشب: MDF أو بلاي ${t} مم. الصق الزوايا بغراء الخشب وانتظر جفافه، ثم صنفر الحواف قبل القماش حتى لا تظهر أصابع التعشيق تحته.`,
      ],
      warnings, errors,
    }
  },
})

// ------------------------------------------------------------------ tiered counter display (shop stand)
function pointInPoly(q: P2, poly: P2[]): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p1 = poly[i], p2 = poly[j]
    if ((p1.y > q.y) !== (p2.y > q.y) && q.x < ((p2.x - p1.x) * (q.y - p1.y)) / (p2.y - p1.y) + p1.x) c = !c
  }
  return c
}
/** 0 when two closed polygons cross or one holds the other, else how far apart they are. */
function polyGap(a: P2[], b: P2[]): number {
  const inside = pointInPoly
  const cross = (p: P2, q: P2, r: P2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length], q1 = b[j], q2 = b[(j + 1) % b.length]
    if (cross(p1, p2, q1) * cross(p1, p2, q2) < 0 && cross(q1, q2, p1) * cross(q1, q2, p2) < 0) return 0
  }
  if (inside(a[0], b) || inside(b[0], a)) return 0
  const closed = (ps: P2[]) => [...ps, ps[0]]
  return Math.min(...a.map(q => distToPolyline(q, closed(b))), ...b.map(q => distToPolyline(q, closed(a))))
}
/** n tabs spread evenly over the length L of a piece's end, each kept `inset` from the ends; [start, end] pairs. */
function tabRuns(L: number, inset: number): [number, number][] {
  const avail = L - 2 * inset
  if (avail < 6) return []
  const n = avail > 130 ? 3 : avail > 60 ? 2 : 1, tl = Math.min(30, (0.62 * avail) / n)
  return Array.from({ length: n }, (_, i) => { const c = inset + (avail * (i + 0.5)) / n; return [round3(c - tl / 2), round3(c + tl / 2)] as [number, number] })
}

MORE.push({
  id: 'displaystand',
  name: 'ستاند عرض مدرّج',
  desc: 'ستاند للمحلات: لوح خلفي بقوس للشعار، ودرجات مائلة كل منها لوح ورفّ عمودي عليه فتستند العلب في زاوية، وواجهة سفلية. كل القطع بألسنة في شقوق الجانبين.',
  icon: `<path d="M12 18c0-10 40-10 40 0v40H12z"/><path d="M16 30l8 0 6 8M24 30v0M18 26l5 10 5-3M28 40l5 10 5-3M38 54h10" stroke-width="1.6"/><path d="M14 58h36" stroke-width="2.5"/>`,
  params: [
    mm('W', 'العرض', 120, 900, 'عرض اللوح الخلفي، وهو العرض الكلّي'),
    mm('H', 'ارتفاع اللوح الخلفي', 150, 1200, 'مع القوس'),
    { key: 'N', label: 'عدد الدرجات', min: 1, max: 6, step: 1, int: true },
    mm('h', 'ارتفاع الدرجة', 40, 250, 'المسافة العمودية بين درجة والتي تليها'),
    { key: 'ang', label: 'ميل الألواح', min: 45, max: 80, step: 1, unit: '°', hint: 'عن الأفق: أكبر = أقرب إلى الوقوف' },
    mm('dl', 'عمق الرفّ', 12, 100, 'الرفّ عمودي على اللوح المائل: أكبر سماكة علبة تقف عليه'),
    mm('hf', 'ارتفاع الواجهة الأمامية', 30, 250, 'من الأرض إلى حافّة الرفّ السفلي'),
    mm('lip', 'حافّة فوق الرفّ السفلي', 0, 40, 'ترتفع الواجهة فوق الرفّ الأخير لتمسك العلب؛ 0 = بلا'),
    mm('ar', 'ارتفاع القوس', 0, 200),
    mm('R', 'تدوير أعلى الجانب', 0, 250, 'نصف قطر الاستدارة من الأمام إلى الحافّة الخلفية'),
    mm('e', 'هامش الجانب', 6, 40, 'عرض الخشب أمام الدرجات في الجانبين'),
    { key: 'base', label: 'قاعدة', min: 0, max: 1, step: 1, int: true, hint: 'لوح سفلي يربط الجانبين' },
    { key: 'n', label: 'العدد', min: 1, max: 30, step: 1, int: true },
    mm('fit', 'خلوص الشقوق', 0, 0.5),
  ],
  defaults: { W: 320, H: 440, N: 3, h: 90, ang: 70, dl: 30, hf: 75, lip: 0, ar: 40, R: 50, e: 12, base: 1, n: 1, fit: 0.15 },
  innerAdd: () => ({ W: 0, D: 0, H: 0 }),
  build(p, c) {
    const warnings: string[] = [], errors: string[] = []
    const t = c.t, { W, H, h, dl, hf, lip, ar, e, fit } = p, N = Math.round(p.N), n = Math.round(p.n), base = Math.round(p.base) > 0
    const al = (p.ang * Math.PI) / 180, sa = Math.sin(al), ca = Math.cos(al)
    const d = { x: ca, y: -sa }, nf = { x: sa, y: ca }                     // down the plate; out of its face
    const add = (a: P2, b: P2, k = 1): P2 => ({ x: a.x + k * b.x, y: a.y + k * b.y })
    const ms = round3(Math.max(6, 2 * t))                                  // the back panel past each side
    const Wi = round3(W - 2 * ms - 2 * t), Wt = round3(Wi + 2 * t)          // between the sides; a piece with its tabs
    if (Wi < 60) errors.push(`العرض صغير: ${Math.ceil(60 + 2 * ms + 2 * t)} مم على الأقل.`)
    // the zigzag, in a side view (x forward from the back panel's face, y up from the floor): plate k's face runs down
    // to the corner V_k, ledge k stands square to it from there, plate k+1 hangs under the ledge's front end
    const Lp = round3((h + dl * ca) / sa - t)                              // a plate's face, so each step drops h
    if (Lp < 25) errors.push('الدرجة قصيرة على هذا العمق والميل: زد ارتفاعها.')
    const D = { x: dl * sa + (t + Lp) * ca, y: dl * ca - (t + Lp) * sa }  // one step of the zigzag (D.y = -h)
    const VN = { x: 0, y: hf - dl * ca }
    // the side: its front edge e beyond the line of the ledges' front corners, its top a round of radius R that comes
    // down into the back edge. The steps stand forward of the back panel by gb, as little as lets the round pass over
    // the top plate's slots with wood to spare
    const R = p.R, inset = round3(Math.max(6, 2 * t)), mclr = 2.5
    const DL0 = Math.hypot(D.x, D.y), u = { x: D.x / DL0, y: D.y / DL0 }, ne = { x: -D.y / DL0, y: D.x / DL0 }
    const zig = (gb: number) => {
      const V1x = gb + t * sa + Lp * ca                                    // plate 1's back corner gb from the back panel
      const V = Array.from({ length: N }, (_, i) => ({ x: V1x + i * D.x, y: VN.y + (N - 1 - i) * -D.y }))
      const E = V.map(v => add(v, nf, dl)), T = V.map(v => add(v, d, -Lp))
      const O = add(E[0], ne, e), lineY = (x: number) => O.y + ((x - O.x) * u.y) / u.x
      const Q = { x: R * (1 + ne.x), y: 0 }; Q.y = lineY(Q.x)
      const C = R > 0.5 ? add(Q, ne, -R) : { x: 0, y: lineY(0) }
      // the side's top from the line over the round into the back edge (without the back tabs)
      const arc: P2[] = []
      if (R > 0.5) {
        const a2 = Math.atan2(ne.y, ne.x), a1 = Math.PI, k = Math.max(8, Math.ceil(((a1 - a2) * R) / 3))
        for (let i = 0; i <= k; i++) { const a = a2 + ((a1 - a2) * i) / k; arc.push({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) }) }
      } else arc.push(C)
      return { V, E, T, lineY, Q, C, arc }
    }
    // plate 1's top slot, at gb = 0 (it moves with the steps)
    const topSlot = (gb: number) => {
      const z = zig(gb), r = tabRuns(Lp, inset)[0] ?? [inset, Lp - inset], at = add(z.T[0], nf, -t / 2)
      const a = (r[1] - r[0] + 0.5) / 2, b = (t + 0.5) / 2, cen = add(at, d, (r[0] + r[1]) / 2), q = { x: -d.y, y: d.x }
      return { z, pts: [add(add(cen, d, -a), q, -b), add(add(cen, d, a), q, -b), add(add(cen, d, a), q, b), add(add(cen, d, -a), q, b)] }
    }
    const clear = (gb: number) => {
      const { z, pts } = topSlot(gb)
      // the outline near the top: down the back edge, the round, and on down the front line well past the slot
      const far = Math.max(...pts.map(q => q.x)) + 50, edge = [{ x: 0, y: -1e4 }, ...[...z.arc].reverse(), { x: far, y: z.lineY(far) }, { x: far, y: -1e4 }]
      // the slot with wood round it, and the plate's top end itself inside the side
      const ends = [z.T[0], add(z.T[0], nf, -t)]
      return pts.every(q => pointInPoly(q, edge) && distToPolyline(q, edge.slice(0, -1)) >= mclr + 1) &&
        ends.every(q => pointInPoly(q, edge) && distToPolyline(q, edge.slice(0, -1)) >= 2)
    }
    let gb = 0
    while (gb < 400 && !clear(gb)) gb += 1
    if (gb >= 400) errors.push('تدوير أعلى الجانب كبير على هذه الدرجات: صغّره.')
    const { V, E, T, lineY, Q, C, arc: top } = zig(gb)
    const EN = E[N - 1], xf = round3(EN.x + t * ca + (lip > 0 ? t : 0))    // the front panel's face
    // the front panel: under the last ledge's front end, or rising lip above it with the ledge butting its back
    const fTop = lip > 0 ? EN.y + lip : V[N - 1].y + (dl - t / sa) * ca - t * sa - 0.2
    const bh = round3(Math.max(5, 1.5 * t)), baseLen = round3(xf - t)
    const low = Math.min(...V.map(v => add(add(v, nf, -t), d, t).y), ...V.map(v => add(v, nf, -t).y))
    if (low < (base ? bh + t : 0) + 3) errors.push(`الواجهة الأمامية منخفضة على الدرجات: اجعلها ${Math.ceil(hf + (base ? bh + t : 0) + 3 - low)} مم أعلى على الأقل.`)
    const mf = round3(Math.max(5, 1.5 * t)), xs = round3(xf + mf)
    // the front edge rises at least to the front panel's top (a lip above the last ledge gets a flat at the front)
    const yF = Math.max(lineY(xs), fTop), xFlat = yF > lineY(xs) + 1e-6 ? O_x(yF) : xs
    function O_x(y: number) { return xs - ((y - lineY(xs)) * u.x) / -u.y }
    if (Q.x > xs - 10 || C.y < 30) errors.push('تدوير أعلى الجانب كبير على عمق الستاند: صغّره.')
    // the round: from where it leaves the front edge, over the top, down into the back edge
    const P1 = { x: 0, y: C.y }
    // the side's tabs into the back panel, along its back edge under the round
    const backTabs = tabRuns(P1.y, inset)
    if (!backTabs.length) errors.push('الجانب قصير من الخلف على ألسنة اللوح الخلفي.')
    const sideOut: P2[] = [{ x: 0, y: 0 }, { x: xs, y: 0 }, { x: xs, y: yF }, ...(xFlat < xs ? [{ x: xFlat, y: yF }] : []), ...top]
    for (const [a, b] of [...backTabs].reverse()) sideOut.push({ x: 0, y: b }, { x: -t, y: b }, { x: -t, y: a }, { x: 0, y: a })
    const ymax = Math.max(...sideOut.map(q => q.y))
    // every piece between the sides: where its centre line runs in the side view, and how long it is
    type Piece = { id: string; name: string; at: P2; dir: P2; len: number; count: number; note: string }
    const pieces: Piece[] = [
      { id: 'plate', name: 'اللوح المائل', at: add(T[0], nf, -t / 2), dir: d, len: Lp, count: N, note: 'تستند عليه العلب' },
      { id: 'ledge', name: 'رفّ الدرجة', at: add(add(V[0], nf, -t), d, t / 2), dir: nf, len: round3(dl + t), count: N, note: 'عمودي على اللوح المائل: تقف عليه العلب' },
      { id: 'front', name: 'الواجهة الأمامية', at: { x: xf - t / 2, y: 0 }, dir: { x: 0, y: 1 }, len: round3(fTop), count: 1, note: 'مكان الرقم أو الشعار الصغير' },
      ...(base ? [{ id: 'base', name: 'القاعدة', at: { x: 0, y: bh + t / 2 }, dir: { x: 1, y: 0 }, len: baseLen, count: 1, note: 'بين اللوح الخلفي والواجهة' }] : []),
    ]
    // a slot for every tab of every piece, at every step of the zigzag
    const slots: P2[][] = []
    const slot = (cen: P2, dir: P2, len: number) => {
      const a = (len + fit) / 2, b = (t + fit) / 2, q = { x: -dir.y, y: dir.x }
      return [add(add(cen, dir, -a), q, -b), add(add(cen, dir, a), q, -b), add(add(cen, dir, a), q, b), add(add(cen, dir, -a), q, b)]
    }
    const shifts = (pc: Piece) => (pc.id === 'plate' || pc.id === 'ledge' ? Array.from({ length: N }, (_, i) => ({ x: i * D.x, y: i * D.y })) : [{ x: 0, y: 0 }])
    const runs = new Map<string, [number, number][]>()
    for (const pc of pieces) {
      const r = tabRuns(pc.len, pc.id === 'ledge' ? Math.max(4, 1.2 * t) : inset)
      if (!r.length) errors.push(`${pc.name} قصير على لسان في الجانب.`)
      runs.set(pc.id, r)
      for (const sh of shifts(pc)) for (const [a, b] of r) slots.push(slot(add(add(pc.at, sh), pc.dir, (a + b) / 2), pc.dir, b - a))
    }
    // strength: every slot clear of the outline and of the others
    if (!errors.length) {
      let gap = Infinity
      const outline = sideOut
      const ring = [...outline, outline[0]]
      for (let i = 0; i < slots.length; i++) {
        // inside the outline (no edge crossing it), then its distance to the edge
        gap = Math.min(gap, polyGap(slots[i], outline) === 0 && slots[i].every(q => pointInPoly(q, outline)) ? Math.min(...slots[i].map(q => distToPolyline(q, ring)), ...outline.map(q => distToPolyline(q, [...slots[i], slots[i][0]]))) : 0)
        for (let j = i + 1; j < slots.length; j++) gap = Math.min(gap, polyGap(slots[i], slots[j]))
      }
      if (gap < 2) errors.push(`في الجانب شقّان متقاربان أو شقّ قريب من الحافّة (${gap.toFixed(1)} مم): زد هامش الجانب أو ارتفاع الدرجة أو عمق الرفّ.`)
    }
    if (H < ymax + ar + 20) errors.push(`اللوح الخلفي قصير: يلزم ${Math.ceil(ymax + ar + 20)} مم على الأقل ليظهر فوق الجانبين.`)
    if (ar > W / 2) errors.push('القوس أعلى من نصف العرض.')
    if (xs < 0.3 * H) warnings.push('الستاند قليل العمق على ارتفاعه وقد ينقلب للخلف؛ زد عمق الرفّ أو عدد الدرجات أو قلّل الارتفاع.')
    // to panel coordinates: x shifted past the tabs, y down from the top
    const Hs = round3(ymax), toSide = (ps: P2[]) => ps.map(q => ({ x: round3(q.x + t), y: round3(Hs - q.y) }))
    const panels: PanelSpec[] = []
    // the back panel: an arch over the full width, slots for the sides' tabs
    const archPts: P2[] = []
    if (ar > 0.5) {
      const Rr = (ar * ar + (W / 2) ** 2) / (2 * ar), cy = Rr, a0 = Math.asin(Math.min(1, W / 2 / Rr)), k = Math.max(12, Math.ceil((2 * a0 * Rr) / 4))
      for (let i = 0; i <= k; i++) { const a = -a0 + (2 * a0 * i) / k; archPts.push({ x: round3(W / 2 + Rr * Math.sin(a)), y: round3(cy - Rr * Math.cos(a)) }) }
    } else archPts.push({ x: 0, y: 0 }, { x: W, y: 0 })
    const backHoles: Loop[] = []
    for (const [a, b] of backTabs) for (const x of [ms, W - ms - t]) backHoles.push(polyLoop([{ x: x - fit / 2, y: H - b - fit / 2 }, { x: x + t + fit / 2, y: H - b - fit / 2 }, { x: x + t + fit / 2, y: H - a + fit / 2 }, { x: x - fit / 2, y: H - a + fit / 2 }].map(q => ({ x: round3(q.x), y: round3(q.y) })), 'hole'))
    panels.push({ id: 'back', name: 'اللوح الخلفي (بالقوس)', w: W, h: H, count: n, shape: [polyLoop([...archPts, { x: W, y: H }, { x: 0, y: H }], 'outer')], holes: backHoles, note: `الشعار فوق الجانبين: مساحة نحو ${Math.floor(W - 30)} × ${Math.floor(H - ymax - ar)} مم` })
    panels.push({ id: 'side', name: 'الجانب', w: round3(xs + t), h: Hs, count: 2 * n, shape: [polyLoop(toSide(sideOut), 'outer')], holes: slots.map(s => polyLoop(toSide(s), 'hole')), note: 'اثنان متماثلان: اقلب أحدهما' })
    for (const pc of pieces) {
      const r = runs.get(pc.id)!, cuts: ReturnType<typeof rect>[] = []
      for (const x of [0, Wt - t]) { let y0 = 0; for (const [a, b] of r) { cuts.push(rect(x, y0, t, a - y0)); y0 = b } cuts.push(rect(x, y0, t, pc.len - y0)) }
      panels.push({ id: pc.id, name: pc.name, w: Wt, h: pc.len, count: pc.count * n, cuts, note: pc.note })
    }
    const r1 = (v: number) => (Math.round(v * 10) / 10).toString()
    return {
      panels,
      notes: [
        `الستاند ${W} مم عرضاً، ${H} مم ارتفاعاً مع القوس، و${r1(xs + t)} مم عمقاً. ${N} ${N > 2 && N < 11 ? 'درجات' : 'درجة'}، كل درجة أخفض من التي فوقها بـ ${h} مم.`,
        `كل درجة لوح مائل ${p.ang}° (وجهه ${r1(Lp)} مم) ورفّ عمودي عليه بعمق ${dl} مم: تقف العلبة على الرفّ وتستند إلى اللوح في الزاوية فلا تنزلق. أكبر سماكة علبة ${dl} مم.`,
        `التركيب: ضع جانباً على الطاولة ووجهه الداخلي للأعلى، أدخل ألسنة الألواح المائلة والرفوف والواجهة${base ? ' والقاعدة' : ''} في شقوقه، ثم أنزل الجانب الثاني فوقها لسان لسان، ثم أدخل ألسنة الجانبين الخلفية في شقوق اللوح الخلفي. نقطة غراء خشب في كل شقّ تثبّت كل شيء.`,
        `الشعار: مساحة اللوح الخلفي فوق الجانبين نحو ${Math.floor(W - 30)} × ${Math.floor(H - ymax - ar)} مم؛ اكتبه في RDWorks واقصّه من أكريليك مرآة ذهبي، وكذلك الرقم على الواجهة الأمامية (ارتفاعها ${r1(fTop)} مم).`,
        'الخشب: MDF بقشرة خشب 3 مم أو بلاي؛ أدخل سماكة لوحك الحقيقية.',
      ],
      warnings, errors, slotted: true,
    }
  },
})

TEMPLATES.push(...MORE)
