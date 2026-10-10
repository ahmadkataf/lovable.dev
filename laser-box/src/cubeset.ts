// A set of clear acrylic cubes with white lids, a small standing badge on every lid, all in a low black tray.
//
// Every cube is five finger-jointed panels (solvent-glued acrylic). Its lid is a flat plate the size of the cube with a
// lip frame glued underneath that drops inside the walls; a slot near the plate's back edge takes the foot of a blank
// badge (the user adds the text in RDWorks). The tray is an open finger-jointed box the whole block of cubes sits in,
// with optional egg-crate dividers that stand in slots cut through the tray's base.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, Rect, rect, polyLoop, rotatedRectHole, engraveRect, bulgeFromAngles, bbox, round3 } from './geom'
import type { PanelSpec } from './joints'

type P = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const up5 = (v: number) => Math.ceil(v * 2) / 2

// ------------------------------------------------------------------ the badge (topper)
//
// Screen coordinates (y down), the body centred on the origin, the foot hanging below it. Every outline is one loop of
// lines and true arcs; the loop is handed to polyLoop, which orients it as an outer contour.

const at = (c: P, r: number, a: number): P => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
const angOf = (c: P, p: P) => Math.atan2(p.y - c.y, p.x - c.x)
/** bulge of the arc p → q round the centre c; `ccw` when the screen angle decreases along the way */
const arcB = (p: P, q: P, c: P, ccw: boolean) => bulgeFromAngles(angOf(c, p), angOf(c, q), ccw)
const V = (p: P, b?: number): Vtx => ({ x: round3(p.x), y: round3(p.y), ...(b ? { b } : {}) })

/** Style 1: a cloud medallion, nine scallops round an ellipse that is cut flat at the bottom (the photo's gold badge). */
function cloudBadge(tw: number, ft: number, fh: number): Vtx[] {
  const s = 0.07 * tw, rx = tw / 2 - s, ry = 0.435 * tw, yb = 0.72 * ry, N = 9
  const phi0 = Math.asin(yb / ry), sweep = Math.PI + 2 * phi0
  // cusps from the right end of the base, over the top, to the left end (counter-clockwise on screen)
  const cusps: P[] = Array.from({ length: N + 1 }, (_, i) => { const phi = phi0 - (sweep * i) / N; return { x: rx * Math.cos(phi), y: ry * Math.sin(phi) } })
  // the scallops bow outward (to the right of travel) by the sag s; the two at the base ends are flattened just enough
  // that their tangent at the base never dips below it, so the badge stands on its base line
  const pts: Vtx[] = cusps.map((p, i) => {
    if (i >= N) return V(p)
    const q = cusps[i + 1], chord = Math.hypot(q.x - p.x, q.y - p.y), b = (2 * s) / chord
    const cap = i === 0 || i === N - 1 ? 0.98 * Math.tan(Math.atan2(Math.abs(q.y - p.y), Math.abs(q.x - p.x)) / 2) : Infinity
    return V(p, Math.min(b, cap))
  })
  pts.push(V({ x: -ft / 2, y: yb }), V({ x: -ft / 2, y: yb + fh }), V({ x: ft / 2, y: yb + fh }), V({ x: ft / 2, y: yb }))
  return pts
}

/** Style 2: a rounded rectangle (the photo's silver badge, simplified), clockwise on screen. */
function plateBadge(tw: number, ft: number, fh: number): Vtx[] {
  const th = 0.72 * tw, r = 0.12 * tw, k = -Math.tan(Math.PI / 8), x0 = -tw / 2, y0 = -th / 2, x1 = tw / 2, y1 = th / 2
  return [
    V({ x: x0 + r, y: y0 }), V({ x: x1 - r, y: y0 }, k), V({ x: x1, y: y0 + r }), V({ x: x1, y: y1 - r }, k), V({ x: x1 - r, y: y1 }),
    V({ x: ft / 2, y: y1 }), V({ x: ft / 2, y: y1 + fh }), V({ x: -ft / 2, y: y1 + fh }), V({ x: -ft / 2, y: y1 }),
    V({ x: x0 + r, y: y1 }, k), V({ x: x0, y: y1 - r }), V({ x: x0, y: y0 + r }, k),
  ]
}

/** Style 3: a crescent lying on its back cradling a round plate, a star on top of the plate; clockwise on screen. */
function crescentBadge(tw: number, ft: number, fh: number, tipW: number): Vtx[] {
  const R = tw / 2, Ri = 0.78 * R, d = 0.35 * R, rd = 0.68 * R, cy = -0.19 * R
  const Co: P = { x: 0, y: 0 }, Ci: P = { x: 0, y: -d }, C: P = { x: 0, y: cy }
  // the horns, blunted where they are tipW wide (a knife-sharp acrylic tip melts)
  const yh = (Ri * Ri - R * R - d * d) / (2 * d)
  const width = (y: number) => Math.sqrt(Math.max(0, R * R - y * y)) - Math.sqrt(Math.max(0, Ri * Ri - (y + d) * (y + d)))
  let lo = yh, hi = yh + 0.5 * R
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (width(m) < tipW) lo = m; else hi = m }
  const yt = hi, xo = Math.sqrt(R * R - yt * yt), xi = Math.sqrt(Ri * Ri - (yt + d) * (yt + d))
  const Hro: P = { x: xo, y: yt }, Hri: P = { x: xi, y: yt }, Hlo: P = { x: -xo, y: yt }, Hli: P = { x: -xi, y: yt }
  // where the plate sinks into the crescent's inner edge
  const yq = (Ri * Ri - rd * rd - d * d + cy * cy) / (2 * (d + cy)), xq = Math.sqrt(rd * rd - (yq - cy) * (yq - cy))
  const Ql: P = { x: -xq, y: yq }, Qr: P = { x: xq, y: yq }
  // the star, a quarter of its radius sunk into the plate's top
  const rs = 0.24 * R, ri = 0.47 * rs, Cs: P = { x: 0, y: cy - rd + 0.3 * rs }
  const star: P[] = Array.from({ length: 10 }, (_, k) => at(Cs, k % 2 ? ri : rs, -Math.PI / 2 + (k * Math.PI) / 5))
  const inside = (p: P) => Math.hypot(p.x - C.x, p.y - C.y) < rd
  const cross = (A: P, B: P): P => {
    const dx = B.x - A.x, dy = B.y - A.y, fx = A.x - C.x, fy = A.y - C.y
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - rd * rd, disc = Math.sqrt(Math.max(0, b * b - 4 * a * c))
    const u = [(-b - disc) / (2 * a), (-b + disc) / (2 * a)].find(v => v >= -1e-9 && v <= 1 + 1e-9) ?? 0
    return { x: A.x + u * dx, y: A.y + u * dy }
  }
  let iL = -1, iR = -1
  for (let k = 0; k < 10; k++) { const a = inside(star[k]), b = inside(star[(k + 1) % 10]); if (a && !b) iL = k; if (!a && b) iR = k }
  const Sl = cross(star[(iL + 1) % 10], star[iL]), Sr = cross(star[iR], star[(iR + 1) % 10])
  const starRun: P[] = []
  for (let k = (iL + 1) % 10; k !== (iR + 1) % 10; k = (k + 1) % 10) starRun.push(star[k])
  // the foot
  const yf = Math.sqrt(R * R - (ft * ft) / 4)
  const Fr: P = { x: ft / 2, y: yf }, Fl: P = { x: -ft / 2, y: yf }
  return [
    V(Ql, arcB(Ql, Sl, C, false)), ...starRun.length ? [V(Sl), ...starRun.slice(0, -1).map(p => V(p)), V(starRun[starRun.length - 1])] : [V(Sl)],
    V(Sr, arcB(Sr, Qr, C, false)),
    V(Qr, arcB(Qr, Hri, Ci, true)), V(Hri), V(Hro, arcB(Hro, Fr, Co, false)),
    V(Fr), V({ x: ft / 2, y: R + fh }), V({ x: -ft / 2, y: R + fh }), V(Fl, arcB(Fl, Hlo, Co, false)),
    V(Hlo), V(Hli, arcB(Hli, Ql, Ci, true)),
  ]
}

/** The badge outline for a style, scaled so the body is exactly tw wide, the foot (ft wide, fh tall) under it. */
export function badgeLoop(style: number, tw: number, ft: number, fh: number, tipW: number): { loop: Loop; bodyW: number; bodyH: number } {
  const make = (w: number) => (style === 2 ? plateBadge(w, ft, fh) : style === 3 ? crescentBadge(w, ft, fh, tipW) : cloudBadge(w, ft, fh))
  // the cloud's widest scallop is not exactly on the ellipse's axis: measure, then rescale
  const b0 = bbox([{ closed: true, pts: make(tw) }]), w0 = b0.maxX - b0.minX
  const pts = make((tw * tw) / w0)
  const loop = polyLoop(pts, 'outer'), b = bbox([loop])
  return { loop, bodyW: round3(b.maxX - b.minX), bodyH: round3(b.maxY - b.minY - fh) }
}

// ------------------------------------------------------------------ the template

const PARAMS: ParamDef[] = [
  mm('a', 'ضلع المكعّب', 40, 150, 'من الخارج؛ الغطاء بالمقاس نفسه'),
  mm('h', 'ارتفاع المكعّب', 0, 200, '0 = مكعّب تامّ (يساوي الضلع)'),
  { key: 'rows', label: 'صفوف المكعّبات', min: 1, max: 4, step: 1, int: true, hint: 'بالعمق' },
  { key: 'cols', label: 'مكعّبات في الصفّ', min: 1, max: 6, step: 1, int: true, hint: 'بالعرض' },
  mm('gapC', 'المسافة بين المكعّبات', 0, 15, 'داخل الصينية؛ مع الفواصل تلزم سماكة الفاصل وزيادة'),
  { ...mm('play', 'خلوص المكعّبات في الصينية', 0, 5, 'من كل جهة بين كتلة المكعّبات وجدار الصينية'), step: 0.1 },
  mm('trayH', 'ارتفاع الصينية', 10, 80, 'جدرانها تخفي أسفل المكعّبات'),
  mm('lipH', 'ارتفاع شفة الغطاء', 0, 40, '0 = تلقائي: ثلاث سماكات (8 مم على الأقل)'),
  { ...mm('gap', 'خلوص الغطاء', 0.2, 2, 'بين إطار الشفة وجدران المكعّب من كل جهة'), step: 0.1 },
  { key: 'topper', label: 'لافتة على الغطاء', min: 0, max: 1, step: 1, int: true, hint: 'لوحة ذهبية صغيرة واقفة في شقّ في مؤخّرة كل غطاء' },
  { key: 'style', label: 'شكل اللافتة', min: 1, max: 3, step: 1, int: true, options: ['سحابة مموّجة', 'مستطيل مستدير', 'هلال ونجمة'], hint: '1 = سحابة مموّجة بقاعدة مستقيمة كالصورة، 2 = لوحة مستطيلة بزوايا مستديرة، 3 = هلال يحتضن قرصاً فوقه نجمة' },
  mm('tw', 'عرض اللافتة', 16, 80, 'النصّ يُضاف في RDWorks'),
  { ...mm('tm', 'سماكة لوح اللافتة', 0, 10, '0 = كاللوح الأساسي. المرآة الذهبية غالباً 2 أو 3 مم: أدخل سماكتها المقيسة ليضبط الشقّ عليها'), step: 0.1 },
  { ...mm('fit', 'خلوص الشقوق', 0, 0.6, 'يُضاف لعرض شقّ اللافتة وشقوق الفواصل وطولها'), step: 0.05 },
  { key: 'div', label: 'فواصل في الصينية', min: 0, max: 1, step: 1, int: true, hint: 'شرائح واطئة بين المكعّبات تقف في شقوق قاعدة الصينية' },
  { key: 'n', label: 'عدد الأطقم', min: 1, max: 10, step: 1, int: true },
]

const DEFAULTS = { a: 80, h: 0, rows: 2, cols: 3, gapC: 2, play: 1, trayH: 25, lipH: 0, gap: 0.5, topper: 1, style: 1, tw: 34, tm: 0, fit: 0.2, div: 0, n: 1 }

const STYLE_NAME = ['', 'سحابة مموّجة', 'مستطيل مستدير الزوايا', 'هلال ونجمة']

/** Everything the panels are sized on; shared by the build and the tests. */
export function cubeGeom(p: Record<string, number>, t: number) {
  const a = p.a, h = p.h > 0 ? p.h : a
  const rows = Math.max(1, Math.round(p.rows)), cols = Math.max(1, Math.round(p.cols)), n = Math.max(1, Math.round(p.n))
  const lipH = p.lipH > 0 ? p.lipH : up5(Math.max(3 * t, 8))
  const tm = p.tm > 0 ? p.tm : t
  const sw = round3(tm + p.fit), ft = round3(Math.min(10, Math.max(4, 0.3 * p.tw))), fh = round3(t + 1)
  const yb = round3(Math.max(2 * t + p.gap + 2.5 + sw / 2, Math.min(15, 0.2 * a)))
  const Wi = round3(cols * a + (cols - 1) * p.gapC + 2 * p.play), Di = round3(rows * a + (rows - 1) * p.gapC + 2 * p.play)
  const Wl = round3(a - 2 * t - 2 * p.gap)
  return { a, h, rows, cols, n, lipH, tm, sw, ft, fh, yb, Wi, Di, Wo: round3(Wi + 2 * t), Do: round3(Di + 2 * t), Wl, hd: round3(p.trayH - t), swD: round3(t + p.fit), tl: round3(Math.min(20, Math.max(8, 0.4 * a))) }
}

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = [], notes: string[] = []
  const t = c.t, g = cubeGeom(p, t)
  const { a, h, rows, cols, n, lipH, tm, sw, ft, fh, yb, Wi, Di, Wo, Do, Wl, hd, swD, tl } = g
  const topper = Math.round(p.topper) > 0, div = Math.round(p.div) > 0, style = Math.min(3, Math.max(1, Math.round(p.style)))
  const perSet = rows * cols, N = perSet * n

  // -------------------------------------------------------------- checks
  if (c.kerf > t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  if (a < 4 * t) errors.push(`ضلع المكعّب (${a} مم) أصغر من أربع سماكات (${4 * t} مم)؛ لا مكان للتعشيق. اجعله ${4 * t} مم على الأقل.`)
  const hMin = up5(Math.max(4 * t, lipH + t + 2))
  if (h < hMin) errors.push(`ارتفاع المكعّب (${f1(h)} مم) قليل: يلزم ${f1(hMin)} مم على الأقل ليتعشّق وتدخل فيه شفة الغطاء (${f1(lipH)} مم).`)
  if (lipH < 3 * t) errors.push(`ارتفاع الشفة (${f1(lipH)} مم) صغير جداً: يلزم ${f1(3 * t)} مم على الأقل لتعشيق زوايا الإطار (أو 0 ليُحسب تلقائياً).`)
  if (Wl < 3 * t) errors.push(`المكعّب ضيّق على إطار الشفة: كبّر الضلع إلى ${f1(up5(5 * t + 2 * p.gap))} مم على الأقل.`)
  if (p.trayH < 3 * t) errors.push(`ارتفاع الصينية (${p.trayH} مم) أقلّ من ثلاث سماكات: اجعله ${f1(3 * t)} مم على الأقل لتتعشّق زواياها.`)
  if (topper) {
    // the slot: clear of the lip strip behind it, short of the plate's middle, and the plate wide enough round it
    const aMinSlot = up5(Math.max(2 * (yb + sw / 2) + 2, ft + p.fit + 2 * (2 * t + p.gap + 2.5)))
    if (a < aMinSlot) errors.push(`المكعّب صغير على شقّ اللافتة خلف إطار الشفة: كبّر الضلع إلى ${f1(aMinSlot)} مم على الأقل، أو أطفئ «لافتة على الغطاء».`)
    if (p.tm > 0 && p.tm < 1) errors.push('لوح اللافتة أرقّ من 1 مم لا يقف في شقّ: اجعل سماكته 1 مم على الأقل (أو 0 ليكون كاللوح الأساسي).')
    if (p.tw > 0.75 * a) warnings.push(`اللافتة (${p.tw} مم) عريضة على غطاء ${a} مم؛ الأجمل ألّا تتجاوز ${f1(Math.floor(0.6 * a))} مم.`)
  }
  if (div) {
    const need = up5(t + p.fit + 1)
    if (perSet === 1) warnings.push('مكعّب واحد لا يحتاج فواصل؛ لم يُقصّ أيّ فاصل.')
    else {
      if (p.gapC < need) errors.push(`المسافة بين المكعّبات (${p.gapC} مم) لا تتّسع لفاصل بسماكة ${t} مم وخلوصه: اجعلها ${f1(need)} مم على الأقل، أو أطفئ الفواصل.`)
      if (hd < 6) errors.push(`الصينية واطئة على الفواصل: اجعل ارتفاعها ${f1(t + 6)} مم على الأقل.`)
      if (tl + p.fit + 2 * (t + 2.5) > a) errors.push(`المكعّب صغير على ألسنة الفواصل: كبّر الضلع إلى ${f1(up5(tl + p.fit + 2 * t + 5))} مم على الأقل.`)
    }
  }

  // -------------------------------------------------------------- the cube (clear) and its lid (white)
  const cube = (id: string, name: string, s: Partial<PanelSpec>): PanelSpec => ({ id, name: `المكعّب — ${name}`, w: a, h, material: 'clear', count: N, ...s } as PanelSpec)
  const panels: PanelSpec[] = [
    cube('cube-bottom', 'القاعدة', { h: a, top: 'male', right: 'male', bottom: 'male', left: 'male' }),
    cube('cube-front', 'الواجهة الأمامية', { bottom: 'female', left: 'male', right: 'male' }),
    cube('cube-back', 'الواجهة الخلفية', { bottom: 'female', left: 'male', right: 'male' }),
    cube('cube-side', 'الجانب', { bottom: 'female', left: 'female', right: 'female', count: 2 * N }),
    {
      id: 'lid', name: 'الغطاء — اللوح', w: a, h: a, material: 'white', count: N,
      engrave: [engraveRect(t + p.gap, t + p.gap, Wl, Wl)],
      holes: topper ? [rotatedRectHole(a / 2, yb, round3(ft + p.fit), sw, 0)] : [],
      note: topper ? `الخط المحفور يحدّد موضع إطار الشفة على وجهه السفلي؛ الشقّ ${f1(ft + p.fit)} × ${sw} مم لقدم اللافتة على بُعد ${f1(yb)} مم من الحافّة الخلفية` : 'الخط المحفور يحدّد موضع إطار الشفة على وجهه السفلي',
    },
    { id: 'lip-fb', name: 'الغطاء — شفة الأمام / الخلف', w: Wl, h: lipH, left: 'male', right: 'male', count: 2 * N, material: 'white' },
    { id: 'lip-side', name: 'الغطاء — شفة الجانب', w: Wl, h: lipH, left: 'female', right: 'female', count: 2 * N, material: 'white' },
  ]

  // -------------------------------------------------------------- the badge (gold)
  let badge: ReturnType<typeof badgeLoop> | undefined
  if (topper && !errors.length) {
    badge = badgeLoop(style, p.tw, ft, fh, Math.max(0.8, 0.04 * p.tw))
    panels.push({
      id: 'topper', name: `اللافتة — ${STYLE_NAME[style]}`, w: badge.bodyW, h: badge.bodyH + fh, shape: [badge.loop], material: 'gold', count: N,
      note: `فارغة للنصّ؛ القدم ${f1(ft)} × ${f1(fh)} مم تدخل في شقّ الغطاء`,
    })
  }

  // -------------------------------------------------------------- the tray (main sheet) and its dividers
  const cx = (k: number) => t + p.play + k * (a + p.gapC) + a / 2                       // centre of column k (base coordinates)
  const bx = (j: number) => t + p.play + (j + 1) * a + j * p.gapC + p.gapC / 2        // boundary between columns j and j+1
  const baseSlots: Loop[] = []
  const strips: PanelSpec[] = []
  if (div && perSet > 1 && !errors.length) {
    // dividers along the depth (between columns) take their crossing slots from the top, those along the width from the
    // bottom; every strip stands on tabs t tall through the base, one tab under the middle of each cell it passes
    const strip = (id: string, name: string, L: number, cells: number[], crossings: number[], fromTop: boolean, count: number): PanelSpec => {
      const cuts: Rect[] = []
      let x = 0
      for (const cc of cells) { cuts.push(rect(x, hd, cc - tl / 2 - x, t)); x = cc + tl / 2 }
      cuts.push(rect(x, hd, L - x, t))
      for (const xc of crossings) cuts.push(fromTop ? rect(xc - swD / 2, 0, swD, hd / 2) : rect(xc - swD / 2, hd / 2, swD, hd / 2))
      return { id, name, w: L, h: round3(hd + t), count, cuts: cuts.filter(r => r.w > 1e-6), note: fromTop ? 'شقوق التقاطع من الأعلى، والألسنة السفلية في شقوق القاعدة' : 'شقوق التقاطع من الأسفل، والألسنة السفلية في شقوق القاعدة' }
    }
    const Ln = round3(Di - 1), Lm = round3(Wi - 1)
    const off = t + 0.5 // a strip starts half a millimetre from the wall's inner face
    if (cols > 1) {
      strips.push(strip('div-long', 'فاصل طولي (بين الأعمدة)', Ln, Array.from({ length: rows }, (_, k) => round3(cx(k) - off)), Array.from({ length: rows - 1 }, (_, i) => round3(bx(i) - off)), true, (cols - 1) * n))
      for (let j = 0; j < cols - 1; j++) for (let k = 0; k < rows; k++) baseSlots.push(rotatedRectHole(round3(bx(j)), round3(cx(k)), swD, round3(tl + p.fit), 0))
    }
    if (rows > 1) {
      strips.push(strip('div-wide', 'فاصل عرضي (بين الصفوف)', Lm, Array.from({ length: cols }, (_, k) => round3(cx(k) - off)), Array.from({ length: cols - 1 }, (_, j) => round3(bx(j) - off)), false, (rows - 1) * n))
      for (let i = 0; i < rows - 1; i++) for (let k = 0; k < cols; k++) baseSlots.push(rotatedRectHole(round3(cx(k)), round3(bx(i)), round3(tl + p.fit), swD, 0))
    }
  }
  panels.push(
    { id: 'tray-bottom', name: 'الصينية — القاعدة', w: Wo, h: Do, top: 'male', right: 'male', bottom: 'male', left: 'male', count: n, holes: baseSlots, note: baseSlots.length ? 'شقوق ألسنة الفواصل' : undefined },
    { id: 'tray-front', name: 'الصينية — الواجهة الأمامية', w: Wo, h: p.trayH, bottom: 'female', left: 'male', right: 'male', count: n },
    { id: 'tray-back', name: 'الصينية — الواجهة الخلفية', w: Wo, h: p.trayH, bottom: 'female', left: 'male', right: 'male', count: n },
    { id: 'tray-side', name: 'الصينية — الجانب', w: Do, h: p.trayH, bottom: 'female', left: 'female', right: 'female', count: 2 * n },
    ...strips,
  )

  // -------------------------------------------------------------- notes
  const totalH = round3(t + h + t + (badge ? badge.bodyH : 0))
  notes.push(
    `${perSet} مكعّبات أكريليك شفّاف ${a} × ${a} × ${f1(h)} مم (${rows} × ${cols}) بتعشيق أصابع، لكلّ مكعّب غطاء أبيض ${a} × ${a} مم بإطار شفة تحته${topper ? `، ولافتة ذهبية «${STYLE_NAME[style]}» ${badge ? `${f1(badge.bodyW)} × ${f1(badge.bodyH)} مم` : ''} واقفة في مؤخّرة الغطاء` : ''}، والكلّ في صينية ${f1(Wo)} × ${f1(Do)} × ${p.trayH} مم. ارتفاع الطقم كاملاً نحو ${f1(totalH)} مم.`,
    `الخامات: أكريليك شفّاف مصبوب (cast) ${t} مم للمكعّبات، أبيض ${t} مم للأغطية${topper ? `، مرآة ذهبية أو فضية ${f1(tm)} مم للافتات` : ''}، وأسود ${t} مم للصينية (أو MDF مدهون أسود). غراء أكريليك سائل (كلوروفورم أو دايكلوروميثان) مع إبرة أو محقنة، وصنفرة ناعمة للحواف.`,
    'المكعّب: ركّب القاعدة والواجهتين والجانبين جافّة بالأصابع، تأكّد من التربيع، ثم مرّر الغراء السائل بالإبرة على خطوط التعشيق من الداخل فيسحبه التشرّب إلى داخل الوصلة. انزع الورق الواقي عن حوافّ اللصق فقط واتركه على الوجوه حتى النهاية.',
    `الغطاء: ألصق إطار الشفة (شريحتان ${f1(Wl)} × ${f1(lipH)} مم بأصابع ذكر وشريحتان بأصابع أنثى، تتعشّق في الزوايا) تحت اللوح داخل الخط المحفور؛ ينزل الإطار داخل المكعّب بخلوص ${p.gap} مم من كل جهة فيثبت الغطاء ولا ينزلق. سطح الغطاء بمقاس المكعّب تماماً.`,
  )
  if (topper) notes.push(
    `اللافتة: أدخل قدمها (${f1(ft)} × ${f1(tm)} مم) في شقّ الغطاء من الأعلى؛ تنزل ${f1(fh)} مم وتبرز نحو 1 مم تحت اللوح فضع عليها نقطة غراء من الأسفل. الشقّ في وسط اللوح على بُعد ${f1(yb)} مم من الحافّة الخلفية: أدخله في RDWorks كما هو ولا تُدِر الغطاء عند التركيب.`,
    'اللافتة فارغة من النصّ: أضف «عيد مبارك» أو الاسم في RDWorks داخل الشكل، نقشاً أو قصّاً. على المرآة الذهبية انقش من الوجه الخلفي بنصّ معكوس (يزيل طبقة المرآة فيظهر النصّ من الأمام)، أو اقصّ الأحرف من لوح آخر وألصقها.',
  )
  notes.push(`الصينية: قاعدة وأربعة جدران بتعشيق أصابع، داخلها ${f1(Wi)} × ${f1(Di)} مم = ${cols} × ${a} + ${cols - 1} × ${p.gapC} + خلوص ${p.play} مم من كل جهة بالعرض، و${rows} × ${a} + ${rows - 1} × ${p.gapC} + الخلوص بالعمق؛ جدرانها ${p.trayH} مم تخفي أسفل المكعّبات. في الأكريليك الأسود الصق بالغراء السائل، وفي الـMDF بغراء الخشب ثم ادهن.`)
  if (strips.length) notes.push(
    `الفواصل: شرائح ارتفاعها ${f1(hd)} مم (بمستوى حافّة الصينية) تقف في شقوق القاعدة بألسنة ${f1(tl)} × ${t} مم تظهر من تحتها بمستوى سطحها، وتتشابك ببعضها بشقوق نصفية: الطولية شقوقها من الأعلى والعرضية من الأسفل. التجميع: أدخل ألسنة الفواصل في القاعدة وشبّكها، ثم ركّب الجدران الأربعة على القاعدة، ونقطة غراء على كل لسان.`,
  )
  else notes.push('التجميع الأخير: ضع المكعّبات في الصينية متلاصقة بالمسافة المحدّدة، وأغطيتها عليها واللافتات إلى الخلف كما في الصورة. بلا فواصل تبقى المكعّبات حرّة الحركة قليلاً بقدر الخلوص.')
  return { panels, notes, warnings, errors, slotted: true }
}

export const CUBE_SETS: Template[] = [
  {
    id: 'cubeset',
    name: 'طقم مكعّبات أكريليك على صينية',
    desc: 'مكعّبات أكريليك شفّاف بتعشيق أصابع، لكلّ مكعّب غطاء أبيض بإطار شفة ولافتة ذهبية صغيرة واقفة في مؤخّرته (فارغة لتضيف نصّك)، والكلّ في صينية سوداء واطئة كما في الصورة؛ مع فواصل اختيارية بين المكعّبات.',
    icon: `<path d="M4 44h56v12H4z"/><rect x="8" y="22" width="14" height="22"/><rect x="25" y="22" width="14" height="22"/><rect x="42" y="22" width="14" height="22"/><path d="M8 22h14M25 22h14M42 22h14" stroke-width="3"/><path d="M12 20a3 3 0 1 1 6 0 3 3 0 1 1-6 0M29 20a3 3 0 1 1 6 0 3 3 0 1 1-6 0M46 20a3 3 0 1 1 6 0 3 3 0 1 1-6 0" stroke-width="1.2"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]
