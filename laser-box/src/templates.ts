// Ready-made box designs. Every template turns its parameters into panel specs.
import { Loop, rect, circle, disc, stadium, stadiumV, roundedRectHole, rotatedRectHole, roundCorner, edgeNotch, engraveRect, hingeLines, heart, ellipse, archHole, keyhole, polyLoop, peakSegments, oriented, round3 } from './geom'
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

export interface BuildResult { panels: PanelSpec[]; notes: string[]; warnings: string[]; errors?: string[] }

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
function pivotLidBox(p: Record<string, number>, c: Common, warnings: string[], errors: string[]) {
  const { W, D, H } = p, t = c.t
  const g = pivotLid(p, t)
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
    `الأذن ترتفع ${g.a.toFixed(1)} مم فوق حافّة الجانب، ويبقى حول الثقب جدار ${g.webTop.toFixed(1)} مم من كل جهة. الغطاء يستقرّ على حوافّ الجانبين والواجهة بعرض الصندوق كاملاً.`,
    'في الأكريليك: استعمل الأكريليك المصبوب (cast) لا المبثوق، لا تُدخل اللسان بالقوة، وإن ضاق صنفر زواياه قليلاً. يمكنك زيادة «جدار الأذن» إلى 5–6 مم.',
    'التجميع: ركّب القاعدة والواجهتين على جانب واحد، أدخل لسان الغطاء في ثقبه، ثم أدخل الجانب الثاني بحيث يدخل اللسان في ثقبه مع دخول الأصابع في وقت واحد. لا يحتاج ثنياً ولا غراءً في الغطاء.',
    'الجزء الخلفي من الغطاء خلف المحور يهبط داخل الصندوق عند الفتح، فالخلفية بارتفاع سطح الغطاء ولا تعيقه. لتخفيف الخلخلة برّد حوافّ اللسان قليلاً ليقترب من الدائرة.',
    'الغطاء يفتح بحرّية حتى نحو 140° ثم يستند بطرفه الخلفي على الحافّة الداخلية للخلفية؛ إن أردت أن يقف عند 100° استعمل شريطاً أو مغناطيساً.',
  ]
  return { panels, notes, g }
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

const PATTERN_HINT = '1 = دوائر، 2 = شقوق عمودية، 3 = نافذة واحدة، 4 = قلوب، 5 = شبكة معيّنات، 6 = نجوم ثمانية'

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
    params: [...DIMS, mm('slide', 'خلوص الانزلاق', 0.2, 2, 'فراغ إضافي في الشق ليتحرك الغطاء بسهولة'), mm('pull', 'حجم فتحة الإبهام', 0, 30, 'فتحة قرب الحافّة الأمامية للغطاء يُسحب بها')],
    defaults: { W: 120, D: 80, H: 50, slide: 0.3, pull: 8 },
    innerAdd: (t, p) => ({ W: 2 * t, D: 2 * t, H: 3 * t + (p.slide ?? 0.3) }),
    build(p, c) {
      const warnings: string[] = [], errors: string[] = []
      checkBasics(p, c, warnings, errors)
      const { W, D, H, slide } = p, t = c.t
      const frontH = H - 2 * t - slide
      if (frontH < 2 * t) errors.push(`الارتفاع صغير جداً للغطاء المنزلق: يلزم ${(4 * t + slide).toFixed(1)} مم على الأقل.`)
      const pull = Math.max(0, Math.min(p.pull, (W - 4 * t) / 5, (D - t) / 5))
      // the rim above the slot hangs from a solid block at the side's top-back corner; the back joint starts below it,
      // so the rim stays attached whatever the finger size
      const slotBottom = 2 * t + slide, jointFrom = slotBottom + Math.max(1, t / 2)
      if (H - jointFrom - t < 2 * t) errors.push(`الارتفاع صغير جداً لتعشيق الخلفية تحت الشقّ: يلزم ${Math.ceil(jointFrom + 3 * t)} مم على الأقل.`)
      if ((D - t) / t > 40) warnings.push(`الشريحة فوق شقّ الغطاء طويلة جداً بالنسبة لسماكتها (${(D - t).toFixed(0)} × ${t} مم) وقد تنكسر؛ استعمل خامة أسمك أو عمقاً أقلّ.`)
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
          // a thumb hole near the front edge: press the thumb in and pull the lid towards you
          id: 'lid', name: N.lid, w: W, h: D - t,
          holes: pull >= 4 ? [stadium(W / 2, Math.max(t + 2, 4) + 0.75 * pull, 2.5 * pull, 1.5 * pull)] : [],
        },
      ]
      return { panels, notes: ['الشريحة فوق الشقّ متّصلة بجسم الجانب عبر كتلة صلبة في الزاوية الخلفية العلوية، وتعشيق الخلفية يبدأ تحتها.', 'الغطاء ينزلق من الأمام؛ ضع إبهامك في الفتحة القريبة من حافّته واسحبه نحوك.'], warnings, errors }
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
      { key: 'pattern', label: 'الزخرفة', min: 1, max: 6, step: 1, int: true, hint: PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 6, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 6, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'زخرفة الجانبين', min: 0, max: 6, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 6, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 6, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
  { id: 'box', name: 'صناديق', ids: ['closed', 'open', 'sliding', 'liftoff', 'hinged', 'flex', 'lip', 'window', 'drawer', 'roundbox', 'crate'] },
  { id: 'gift', name: 'هدايا وديكور', ids: ['chest', 'catbank', 'decobox', 'jewelry', 'moneybox', 'teahouse', 'frame', 'basket', 'fence', 'clock'] },
  { id: 'kitchen', name: 'مطبخ وتقديم', ids: ['carrier', 'mugtree', 'spicerack', 'bedtray', 'tray', 'teabox', 'tissue'] },
  { id: 'office', name: 'مكتب وتنظيم', ids: ['organizer', 'phonestand', 'bookstand', 'headphone', 'keyholder', 'wallshelf', 'jewelrytree'] },
  { id: 'home', name: 'بيت وحديقة', ids: ['planter', 'petfeeder', 'birdhouse', 'incense', 'napkin'] },
  { id: 'light', name: 'إضاءة ورمضان', ids: ['ramadanlantern', 'ramadanornaments', 'lantern', 'shade'] },
  { id: 'bulk', name: 'بالجملة', ids: ['keychains', 'coasters'] },
]
/** the newest designs get a badge in the picker */
export const NEW_IDS = ['crate', 'carrier', 'jewelry', 'moneybox', 'planter', 'petfeeder', 'incense', 'bedtray', 'phonestand', 'bookstand', 'headphone', 'keyholder', 'wallshelf', 'spicerack', 'coasters', 'clock', 'keychains', 'ramadanornaments', 'mugtree', 'jewelrytree', 'birdhouse', 'ramadanlantern']

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
  { key: 'pattern', label: 'الزخرفة', min: 0, max: 6, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
    const Lb = T.x + Math.max(20, 0.3 * T.y)
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
    back.name = 'اللوح الخلفي'; back.holes = [keyhole(Math.min(60, W / 4), 22, 4, 4, 7), keyhole(W - Math.min(60, W / 4), 22, 4, 4, 7)]
    back.note = 'فتحتا التعليق في الأعلى'
    for (const b of box) if (b.id === 'front' || b.id === 'back') { b.name = 'اللوح العلوي / السفلي'; b.id = 'board-' + b.id }
    addSlots(side, d.ds, d.margin, d.hd - FOOT, d.sw, d.vfit)
    const panels: PanelSpec[] = [...box.filter(b => b !== side)]
    const shelves = [...d.ds, H - t / 2] // every shelf plus the bottom board carry a rail
    const gaps = [d.ds[0] ?? H, ...d.ds.slice(1).map((v, i) => v - d.ds[i]), H - (d.ds[d.ds.length - 1] ?? 0)]
    if (rails && Math.min(...gaps) < railH + 3 * t + 20) errors.push(`المسافة بين الرفوف أصغر من أن تحمل حاجزاً بارتفاع ${railH} مم؛ قلّل الرفوف أو ارتفاع الحاجز.`)
    if (rails) {
      const s = shoulder(railH), rc = (x: number) => x - t / 2 - railH / 2 - 1, rm = 4
      const railSlots = (mirror: boolean) => shelves.map(x => { const xc = rc(x); return rotatedRectHole(round3(mirror ? H - xc : xc), round3(rm + (t + fit) / 2), railH - 2 * s + fit, t + fit, 0) })
      panels.push(
        { ...side, id: 'side-l', name: 'الجانب الأيسر', count: 1, holes: railSlots(false), note: 'الحواجز فوق الرفوف عند الحافّة الأمامية' },
        { ...side, id: 'side-r', name: 'الجانب الأيمن', count: 1, holes: railSlots(true), note: 'صورة مرآة للأيسر' },
        tabPlate('rail', 'الحاجز الأمامي', W, railH, t, s, { count: shelves.length, note: 'يمنع العلب من السقوط' }),
      )
    } else panels.push(side)
    panels.push(...dividers(W, H, d.hd, [], d.ds, t, d.sw, d.margin).map(x => ({ ...x, name: 'رف أوسط', note: 'يدخل في شقوق الجانبين' })))
    const notes = [
      `${d.ds.length + 1} ${d.ds.length ? 'طوابق' : 'طابق'} بعمق ${D} مم؛ يُعلّق بمسمارين في فتحتَي اللوح الخلفي.`,
      rails ? 'ثبّت الجانب الأيسر بحيث تكون شقوق الحواجز فوق شقوق الرفوف، والأيمن صورته في المرآة.' : '',
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
      return { panels, notes: [`${4 * lv * 2} أكواب: ${lv} ${lv > 1 ? 'طوابق' : 'طابق'} في كل لوح، ذراعان في كل طابق، والأذرع متعامدة بين اللوحين.`, 'أدخل اللوح ذا الشقّ السفلي فوق ذي الشقّ العلوي حتى تتساوى قمّتاهما، والصق عند التقاطع.'], warnings, errors }
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
      return { panels, notes: ['الحزوز في أعلى الأذرع للقلائد والأساور، والثقوب الصغيرة للأقراط ذات المشبك.', 'ركّب اللوحين متقاطعين والصق؛ ضع تحتها صحناً صغيراً للخواتم إن شئت.'], warnings, errors }
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

TEMPLATES.push(...MORE)
