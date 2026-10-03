// Ready-made box designs. Every template turns its parameters into panel specs.
import { Loop, rect, circle, disc, stadium, stadiumV, roundedRectHole, rotatedRectHole, roundCorner, edgeNotch, engraveRect, hingeLines, heart, ellipse, archHole, keyhole, polyLoop, peakSegments, round3 } from './geom'
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

const PATTERN_HINT = '1 = دوائر، 2 = شقوق عمودية، 3 = نافذة واحدة، 4 = قلوب، 5 = شبكة معيّنات'

/** The cylinder builder shared by the lamp shade and the round box: two discs with tab slots, and a living-hinge sheet. */
function cylinderBuild(kind: 'shade' | 'roundbox') {
  return (p: Record<string, number>, c: Common): BuildResult => {
    const warnings: string[] = [], errors: string[] = []
    const { H, tabW, fit, seg, bridge, pitch } = p, t = c.t
    const socket = kind === 'shade' ? p.socket : 0
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
    // between neighbouring tabs the edge must be cut through by at least two columns (one each side of the seam),
    // otherwise a solid band runs along the edge and the sheet cannot bend into a cylinder
    const reaches = (edge: (l: Loop) => boolean) => new Set(open.filter(edge).map(l => round3(l.pts[0].x)))
    const lo = reaches(l => Math.min(l.pts[0].y, l.pts[1].y) < t), hi = reaches(l => Math.max(l.pts[0].y, l.pts[1].y) > H + t)
    const thru = [...lo].filter(x => hi.has(x))
    const inGap = (a: number, b: number) => thru.filter(x => x > a && x < b).length
    const bandOk = xs.every((xk, j) => j + 1 < n ? inGap(xk, xs[j + 1]) >= 2 : inGap(xk, L) >= 1 && inGap(0, xs[0]) >= 1)
    if (!bandOk && seg + bridge <= H - 2 * bridge) errors.push('اللسانات متقاربة فلا تبقى بينها قصّات مفصل نافذة كافية، فيبقى شريط مصمت على الحافّة يمنع اللوح من الالتفاف؛ قلّل عدد اللسانات أو عرضها أو الجسر.')
    const panels: PanelSpec[] = [
      ...(kind === 'shade' ? [
        ring('ring-top', 'الحلقة العلوية', socket > 0 ? socket / 2 : 0, 'فتحة الدواية في الوسط وشقوق اللسانات حول المحيط'),
        ring('ring-bottom', 'الحلقة السفلية', Math.max(0, Dm / 2 - 3 * t), 'مفتوحة من الوسط ليخرج الضوء'),
      ] : [
        ring('rim', 'الحافّة العلوية', Math.max(0, Dm / 2 - 3 * t), 'حلقة تقوّي فم العلبة'),
        ring('base', 'القاع', 0, 'قرص مغلق بشقوق اللسانات حول المحيط'),
      ]),
      {
        id: 'sheet', name: 'اللوح الملتفّ (مفصل مرن)', w: L, h: H + 2 * t,
        cuts: [...stripCuts(0), ...stripCuts(H + t)],
        open,
        note: 'يلتفّ حول الحلقتين؛ اللسانات تدخل في شقوقهما',
      },
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
      { key: 'pattern', label: 'الزخرفة', min: 1, max: 5, step: 1, int: true, hint: PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 5, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 5, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'زخرفة الجانبين', min: 0, max: 5, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
      { key: 'pattern', label: 'الزخرفة', min: 0, max: 5, step: 1, int: true, hint: '0 = بلا، ' + PATTERN_HINT },
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
