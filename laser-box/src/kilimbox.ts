// A long low box with kilim (Anatolian rug) ornament, after the customer's photos: two finger-jointed trays, the base
// W × D × H open at the top and the lid W × D × hl open at the bottom, sitting on it and hinged at the back with two
// small metal hinges, a clasp at the front, four brass feet and a knob. All the ornament is ENGRAVED, never cut:
//
// - the lid carries a diagonal lattice of rhombi (squares on their points) drawn as thin bands, every full rhombus
//   holding a stepped motif built from unit steps;
// - the base walls carry a band over a rule: a stepped zigzag with stepped triangles under its peaks, triangles
//   hanging from the band's top edge, and the lid's ringed medallion in every valley, scaled to the wall's height.
//
// RDWorks fills closed engrave loops with a scan, and where two loops overlap the fill cancels out, so no two engrave
// loops here ever overlap or touch: the lattice is woven (at every crossing one band runs on and the other stops a
// small gap short of it, alternating like a weave), and every motif or band shape is a closed rectilinear polyline
// (the ring and the chequer are sets of separate pieces), a full step from any other.
//
// Panel coordinates: x to the right, y down; every engraving is drawn on the face that ends up outside.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Rect, rect, unionRects, polyLoop, circle, disc, round3 } from './geom'
import type { PanelSpec, EdgeSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const intP = (key: string, label: string, min: number, max: number, hint?: string, options?: string[]): ParamDef => ({ key, label, min, max, step: 1, int: true, ...(hint ? { hint } : {}), ...(options ? { options } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const SQ2 = Math.SQRT2

/** The gap left at every weave crossing, between motif and lattice, and between any two engraved shapes (mm). */
export const KILIM_GAP = 0.8
/** The smallest unit step of a motif or a band that still engraves as a crisp step (mm). */
const STEP_MIN = 1.5
/** The smallest band unit: the wall band's steps (mm). */
const UNIT_MIN = 1.3
/** The largest band unit, so a tall wall keeps a border rather than one giant band (mm). */
const UNIT_MAX = 5
/** Hinges and clasp: the length of a small box hinge, and the width of a small box clasp (mm). */
const HINGE = 25, CLASP = 20

// ------------------------------------------------------------------ motifs
//
// Each motif sits on a 9 × 9 grid of unit steps centred on the rhombus, inside the stepped diamond |i| + |j| ≤ 4 (the
// largest staircase that fits a rhombus whose sides run at 45°). No mask has a hole or two cells meeting only at a
// corner: motifs 2 and 3 trace to one closed polyline each; motif 1 (the photo's ringed medallion, which as one loop
// would need a hole) is four stepped arcs round a centre dot, a full cell apart; motif 4 is separate squares.

export const MOTIF_MASKS: Record<number, string[]> = {
  // a stepped diamond ring, open at its four tips, round a centre dot
  1: ['.........', '...#.#...', '..##.##..', '.##...##.', '....#....', '.##...##.', '..##.##..', '...#.#...', '.........'],
  // a stepped cross: a plus whose arms end in bars, with short bars across the horizontal arm
  2: ['....#....', '...###...', '....#....', '.#..#..#.', '#########', '.#..#..#.', '....#....', '...###...', '....#....'],
  // ram's horn (koçboynuzu): a bar with four horns curling in towards the middle
  3: ['.........', '...#.#...', '..##.##..', '..#...#..', '#########', '..#...#..', '..##.##..', '...#.#...', '.........'],
}

/** The grid cells (i, j) of a motif, i to the right and j down, both in −4…4. Motif 4 (chequer) is every other cell. */
export function motifCells(motif: number): [number, number][] {
  const out: [number, number][] = []
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) + Math.abs(j) > 4) continue
    const on = motif === 4 ? (i + j) % 2 === 0 : MOTIF_MASKS[motif]?.[j + 4]?.[i + 4] === '#'
    if (on) out.push([i, j])
  }
  return out
}

/** Rectilinear loops from grid cells: cell (i, j) covers [x0 + i·u, x0 + (i + 1)·u] × [y0 + j·u, …], corners rounded to the micron so neighbours merge. */
function cellLoops(cells: [number, number][], x0: number, y0: number, u: number): Loop[] {
  const gx = (i: number) => round3(x0 + i * u), gy = (j: number) => round3(y0 + j * u)
  const rs = cells.map(([i, j]) => rect(gx(i), gy(j), gx(i + 1) - gx(i), gy(j + 1) - gy(j)))
  return unionRects(rs, [])
}

/** The motif centred at (cx, cy) with step s, as engrave loops. */
export function motifLoops(motif: number, cx: number, cy: number, s: number): Loop[] {
  const cells = motifCells(motif)
  if (motif === 4) {
    // the chequer: separate squares, each shrunk so diagonal neighbours keep a gap between their corners
    const e = Math.min(0.3, 0.2 * s)
    return cells.map(([i, j]) => {
      const x0 = round3(cx + (i - 0.5) * s + e), y0 = round3(cy + (j - 0.5) * s + e), x1 = round3(cx + (i + 0.5) * s - e), y1 = round3(cy + (j + 0.5) * s - e)
      return polyLoop([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], 'outer')
    })
  }
  return cellLoops(cells.map(([i, j]) => [i + 4, j + 4] as [number, number]), cx - 4.5 * s, cy - 4.5 * s, s)
}

// ------------------------------------------------------------------ the lattice
//
// Lattice coordinates a = x − y and b = x + y: family A runs along lines a = const, family B along b = const, both P
// apart (P = the rhombus's width from tip to tip). A band lw wide is |a − aᵢ| ≤ lw/√2 in these units. Rhombus centres
// sit at (a_c + iP, b_c + jP), the lines halfway between. At the crossing of Aᵢ and Bⱼ, A runs on when i + j is even
// and B when it is odd; the other band stops KILIM_GAP short of it. So every piece is one straight band (a rectangle
// turned 45°) passing over one crossing, from one gap to the next.

interface Box { x0: number; y0: number; x1: number; y1: number }

/** A convex polygon clipped to an axis-aligned box (Sutherland–Hodgman). */
function clipToBox(poly: P2[], b: Box): P2[] {
  const sides: [(q: P2) => number][] = [[q => q.x - b.x0], [q => b.x1 - q.x], [q => q.y - b.y0], [q => b.y1 - q.y]]
  let out = poly
  for (const [f] of sides) {
    if (!out.length) break
    const inp = out
    out = []
    for (let k = 0; k < inp.length; k++) {
      const p = inp[k], q = inp[(k + 1) % inp.length], fp = f(p), fq = f(q)
      if (fp >= 0) out.push(p)
      if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) }) }
    }
  }
  return out
}

const areaOf = (pts: P2[]) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y }, 0) / 2

/** Distance from a point to a convex polygon (0 inside). */
function distToPoly(c: P2, pts: P2[]): number {
  let inside = true, best = Infinity
  const sgn = Math.sign(areaOf(pts))
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], q = pts[(k + 1) % pts.length], dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy
    if (sgn * (dx * (c.y - p.y) - dy * (c.x - p.x)) < 0) inside = false
    const t = l2 ? Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(c.x - p.x - t * dx, c.y - p.y - t * dy))
  }
  return inside ? 0 : best
}

export interface LidPattern { bands: Loop[]; motifs: Loop[]; full: number; step: number }

/**
 * The lid's lattice and motifs inside box, centred on (cx, cy) (a rhombus centre). keepOut: a disc (the knob) that
 * no band or motif may come near.
 */
export function lidPattern(cx: number, cy: number, P: number, lw: number, motif: number, box: Box, keepOut?: { c: P2; r: number }): LidPattern {
  const hw = lw / SQ2, gw = KILIM_GAP * SQ2, ac = cx - cy, bc = cx + cy
  const step = motifStep(P, lw)
  const iMin = Math.floor((box.x0 - box.y1 - ac) / P) - 2, iMax = Math.ceil((box.x1 - box.y0 - ac) / P) + 2
  const jMin = Math.floor((box.x0 + box.y0 - bc) / P) - 2, jMax = Math.ceil((box.x1 + box.y1 - bc) / P) + 2
  const xy = (a: number, b: number): P2 => ({ x: (a + b) / 2, y: (b - a) / 2 })
  const bands: Loop[] = []
  const add = (a0: number, a1: number, b0: number, b1: number) => {
    let pts = clipToBox([xy(a0, b0), xy(a1, b0), xy(a1, b1), xy(a0, b1)], box).map(q => ({ x: round3(q.x), y: round3(q.y) }))
    pts = pts.filter((q, k) => { const r = pts[(k + 1) % pts.length]; return Math.hypot(r.x - q.x, r.y - q.y) > 0.02 })
    if (pts.length < 3) return
    const A = Math.abs(areaOf(pts))
    // a corner of a band clipped by the margin: drop crumbs and slivers thinner than half the line
    if (A < Math.max(0.5, lw * lw)) return
    const per = pts.reduce((s, q, k) => s + Math.hypot(pts[(k + 1) % pts.length].x - q.x, pts[(k + 1) % pts.length].y - q.y), 0)
    if ((2 * A) / per < 0.25 * lw) return
    if (keepOut && distToPoly(keepOut.c, pts) < keepOut.r + KILIM_GAP) return
    bands.push(polyLoop(pts, 'outer'))
  }
  // line Aᵢ (between rhombus centres i and i + 1) is a = ac + (i + ½)P; it runs over the crossings with even i + j
  for (let i = iMin; i <= iMax; i++) for (let j = jMin; j <= jMax; j++) {
    const a = ac + (i + 0.5) * P, b = bc + (j + 0.5) * P
    if ((((i + j) % 2) + 2) % 2 === 0) add(a - hw, a + hw, b - P + hw + gw, b + P - hw - gw)
    else add(a - P + hw + gw, a + P - hw - gw, b - hw, b + hw)
  }
  const centres = motifCentres(cx, cy, P, lw, box, keepOut)
  return { bands, motifs: centres.flatMap(c => motifLoops(motif, c.x, c.y, step)), full: centres.length, step }
}

/** The centres of the rhombi that get a motif: those whose free inside lies wholly in the box, clear of keepOut. */
export function motifCentres(cx: number, cy: number, P: number, lw: number, box: Box, keepOut?: { c: P2; r: number }): P2[] {
  const hw = lw / SQ2, ac = cx - cy, bc = cx + cy, free = P / 2 - hw, step = motifStep(P, lw)
  const out: P2[] = []
  const iMin = Math.floor((box.x0 - box.y1 - ac) / P) - 1, iMax = Math.ceil((box.x1 - box.y0 - ac) / P) + 1
  const jMin = Math.floor((box.x0 + box.y0 - bc) / P) - 1, jMax = Math.ceil((box.x1 + box.y1 - bc) / P) + 1
  for (let i = iMin; i <= iMax; i++) for (let j = jMin; j <= jMax; j++) {
    const c = { x: (ac + i * P + bc + j * P) / 2, y: (bc + j * P - ac - i * P) / 2 }
    if (c.x - free < box.x0 - 1e-9 || c.x + free > box.x1 + 1e-9 || c.y - free < box.y0 - 1e-9 || c.y + free > box.y1 + 1e-9) continue
    if (keepOut && Math.hypot(c.x - keepOut.c.x, c.y - keepOut.c.y) < keepOut.r + KILIM_GAP + 4.6 * step) continue
    out.push(c)
  }
  return out
}

/** The motif's unit step: a twelfth of the rhombus's width, or less where thick lattice lines leave less room. */
export function motifStep(P: number, lw: number): number {
  return Math.min(P / 12, (P / 2 - lw / SQ2 - KILIM_GAP * SQ2) / 5)
}
/** The narrowest rhombus whose motif still has steps of STEP_MIN. */
export const cellMin = (lw: number) => Math.ceil(Math.max(12 * STEP_MIN, 2 * (5 * STEP_MIN + lw / SQ2 + KILIM_GAP * SQ2)))

// ------------------------------------------------------------------ the wall band
//
// Twelve rows of unit u over a rule, repeating every 14 columns, after the photo's front: a stepped zigzag line (two
// cells thick on every row) rises from valleys on row 10 to peaks on row 4; under every peak stands a stepped
// triangle (widths 1, 3, 5, 7), above every peak a stepped triangle (5, 3, 1) hangs from the band's top edge, and
// every valley holds the photo's medallion up between those triangles: the lid's ringed motif (four stepped arcs
// round a dot, rows 0 to 6). Every shape keeps a full cell from every other, also corner to corner. A medallion sits
// at the middle of the wall, the band is cut off at whole cells at its ends, and a medallion cut by an end is left out.

export const BAND_ROWS = 12
const PERIOD = 14

/** The band's unit for a wall with this much room in height: the same on every wall of the box. */
export const bandUnit = (room: number, ru: number) => Math.min(UNIT_MAX, (room - ru) / BAND_ROWS)

export interface WallBand { loops: Loop[]; u: number; rings: number; h: number }

/** The band of unit u inside [x0, x1] × [y0, y1], centred; null when the wall is too low or too short for it. */
export function wallBand(x0: number, x1: number, y0: number, y1: number, ru: number, u: number): WallBand | null {
  if (!(u >= UNIT_MIN)) return null
  let nc = Math.floor((x1 - x0) / u + 1e-9)
  if (nc % 2 === 0) nc--
  if (nc < 7) return null
  const h = BAND_ROWS * u + ru, top = y0 + (y1 - y0 - h) / 2, left = (x0 + x1) / 2 - (nc * u) / 2
  const gx = (c: number) => round3(left + c * u), gy = (r: number) => round3(top + r * u)
  const cells: Rect[][] = [[], [], []] // the hanging triangles, the zigzag, the triangles under the peaks
  const cell = (c: number, r: number) => rect(gx(c), gy(r), gx(c + 1) - gx(c), gy(r + 1) - gy(r))
  const put = (k: number, c0: number, c1: number, r: number) => { for (let c = Math.max(0, c0); c <= Math.min(nc - 1, c1); c++) cells[k].push(cell(c, r)) }
  const v0 = (nc - 1) / 2, rings: Loop[] = [], ring = motifCells(1)
  let count = 0
  for (let k = -Math.ceil(nc / PERIOD) - 1; k <= Math.ceil(nc / PERIOD) + 1; k++) {
    const a = v0 + PERIOD / 2 + k * PERIOD, v = v0 + k * PERIOD
    put(0, a - 2, a + 2, 0); put(0, a - 1, a + 1, 1); put(0, a, a, 2)
    for (let q = 0; q <= 6; q++) { put(1, a - q - 1, a - q, 4 + q); put(1, a + q, a + q + 1, 4 + q) }
    for (let q = 0; q <= 3; q++) put(2, a - q, a + q, 7 + q)
    if (v - 3 >= 0 && v + 3 <= nc - 1) {
      rings.push(...unionRects(ring.map(([i, j]) => cell(v + i, 3 + j)), []))
      count++
    }
  }
  const yBot = round3(top + BAND_ROWS * u + ru)
  const rule = rect(gx(0), gy(BAND_ROWS), gx(nc) - gx(0), yBot - gy(BAND_ROWS))
  // shapes of one kind stand apart from each other: unionRects traces each on its own
  return { loops: [...unionRects(cells[0], []), ...unionRects(cells[1], []), ...unionRects(cells[2], []), ...unionRects([rule], []), ...rings], u, rings: count, h }
}

/** A short alignment tick for hardware: 0.8 mm wide, from y0 to y1 at x. */
const tick = (x: number, y0: number, y1: number): Loop => polyLoop([{ x: round3(x - 0.4), y: round3(y0) }, { x: round3(x + 0.4), y: round3(y0) }, { x: round3(x + 0.4), y: round3(y1) }, { x: round3(x - 0.4), y: round3(y1) }], 'outer')

// ------------------------------------------------------------------ the box

const MOTIF_NAMES = ['حلقة مدرّجة حول نقطة', 'صليب مدرّج', 'قرن الكبش', 'شطرنج']
/** The knob's screw for a hole of this diameter: the largest metric screw it clears by 0.4 mm (0.5 from M8). */
const SCREWS: [number, string][] = [[10.5, 'M10'], [8.5, 'M8'], [6.4, 'M6'], [5.4, 'M5'], [4.4, 'M4'], [3.4, 'M3'], [2.9, 'M2.5'], [2.4, 'M2']]
const screwFor = (hole: number) => SCREWS.find(([d]) => hole >= d - 1e-9)?.[1]

const PARAMS: ParamDef[] = [
  mm('W', 'الطول', 60, 800, 'طول العلبة من الخارج (الواجهة الأمامية)'),
  mm('D', 'العمق', 50, 600),
  mm('H', 'ارتفاع القاعدة', 20, 300, 'الصينية السفلية من الخارج دون الغطاء؛ الارتفاع الكلّي = هذا + ارتفاع الغطاء'),
  mm('hl', 'ارتفاع الغطاء', 8, 120, 'صينية الغطاء المقلوبة من الخارج؛ لا يقلّ عن أربع سماكات'),
  mm('cell', 'عرض المعيّن', 16, 120, 'في شبكة الغطاء، من رأس المعيّن إلى رأسه؛ الصورة نحو 34 مم'),
  mm('lw', 'عرض خطّ النقش', 0.6, 3, 'خطوط شبكة الغطاء وخطّا شريط الجدار؛ 1–1.5 مم ينقش نظيفاً'),
  intP('motif', 'النقشة داخل المعيّن', 1, 4, 'من وحدات مدرّجة كنقش السجّاد', MOTIF_NAMES),
  intP('lidDeco', 'نقش الغطاء', 0, 1, 'شبكة المعيّنات ونقشاتها على سطح الغطاء'),
  intP('wallDeco', 'شريط الواجهة', 0, 1, 'خطّ متعرّج ومثلثات مدرّجة وحلقات فوق خطّ على الواجهة الأمامية كما في الصورة'),
  intP('around', 'الشريط حول العلبة', 0, 1, 'الشريط نفسه على الجانبين والخلفية أيضاً'),
  intP('marks', 'علامات المفصّلات والقفل', 0, 1, 'خطوط صغيرة محفورة عند طرفي كل مفصّلة وطرفي القفل'),
  intP('feet', 'دوائر الأرجل', 0, 1, 'أربع دوائر محفورة تحت القاعدة لمكان الأرجل النحاسية'),
  mm('knob', 'ثقب المقبض', 0, 12, 'قطر ثقب برغي المقبض في وسط الغطاء: 3.5 لبرغي M3، 4.5 لـM4؛ 0 = بلا مقبض'),
  intP('n', 'العدد', 1, 20),
]
const DEFAULTS = { W: 320, D: 200, H: 50, hl: 16, cell: 34, lw: 1.2, motif: 1, lidDeco: 1, wallDeco: 1, around: 0, marks: 1, feet: 1, knob: 4.5, n: 1 }

/** Where the engraving may go: this far in from a finger-jointed edge, and from a plain edge. */
const jointMargin = (t: number) => t + 1.5
const FLAT_MARGIN = 1.5

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, { W, D, H, hl, cell: P, lw } = p
  const copies = Math.round(p.n), motif = Math.round(p.motif)
  const on = (k: string) => Math.round(p[k]) === 1
  const lidDeco = on('lidDeco'), wallDeco = on('wallDeco'), around = on('around'), marks = on('marks'), feet = on('feet')
  const knob = p.knob > 0 ? p.knob : 0
  const screw = screwFor(knob)
  if (knob && !screw) warnings.push(`ثقب المقبض (${f1(knob)} مم) أضيق من برغي أيّ مقبض؛ اجعله 3.5 مم لبرغي M3 أو 4.5 مم لـM4.`)
  const mJ = jointMargin(t)

  const names: Record<string, string> = { W: 'الطول', D: 'العمق', H: 'ارتفاع القاعدة' }
  for (const k of ['W', 'D', 'H']) if (p[k] < 4 * t) errors.push(`${names[k]} (${f1(p[k])} مم) أصغر من أربع سماكات؛ اجعله ${f1(Math.ceil(4 * t))} مم أو أكثر.`)
  // the lid's walls joint the top over their first t and each other below it in three fingers at least: below 4t those
  // fingers come out thinner than the sheet (with the corner shared the usual way, one of them shrinks to a sliver)
  if (hl < 4 * t - 1e-9) errors.push(`ارتفاع الغطاء (${f1(hl)} مم) أقلّ من أربع سماكات فلا مكان لأصابع التعشيق في زواياه؛ اجعله ${f1(Math.ceil(8 * t) / 2)} مم أو أكثر.`)
  if (lidDeco && P < cellMin(lw)) errors.push(`المعيّن ضيّق على النقشة بخطّ ${f1(lw)} مم: درجاتها تصير أصغر من ${STEP_MIN} مم. اجعل «عرض المعيّن» ${cellMin(lw)} مم أو أكثر، أو أوقف نقش الغطاء.`)
  if (c.kerf > t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  if (errors.length) return { panels: [], notes: [], warnings, errors, slotted: true }

  // ---------------------------------------------------------------- the lid's lattice
  const box = { x0: mJ, y0: mJ, x1: W - mJ, y1: D - mJ }
  const knobR = knob / 2
  const keepOut = knob ? { c: { x: W / 2, y: D / 2 }, r: knobR } : undefined
  const lid = lidDeco ? lidPattern(W / 2, D / 2, P, lw, motif, box, keepOut) : null
  if (lid && !lid.full) {
    // no whole rhombus on the lid, or only the middle one, which the knob takes: the widest rhombus (on the field's
    // 0.5 mm steps) that leaves room for a motif, if any does
    let best = 0
    for (let q = Math.ceil(2 * P) / 2 - 0.5; q >= cellMin(lw) - 1e-9 && !best; q -= 0.5) if (motifCentres(W / 2, D / 2, q, lw, box, keepOut).length) best = q
    const withoutKnob = !!knob && motifCentres(W / 2, D / 2, P, lw, box).length > 0
    const how = [...(best ? [`اجعل «عرض المعيّن» ${f1(best)} مم`] : []), ...(withoutKnob ? ['اجعل «ثقب المقبض» 0'] : [])]
    warnings.push(`لا يتّسع سطح الغطاء لمعيّن كامل بنقشته${withoutKnob ? ' غير الأوسط الذي يشغله المقبض' : ''}، فنُقشت الشبكة وحدها${how.length ? `؛ لتظهر النقشات ${how.join(' أو ')}` : ''}.`)
  }

  // ---------------------------------------------------------------- hardware marks
  const twoHinges = W - 2 * Math.max(W / 5, mJ + 2 + HINGE / 2) >= HINGE + 10
  const hc = twoHinges ? [Math.max(W / 5, mJ + 2 + HINGE / 2), W - Math.max(W / 5, mJ + 2 + HINGE / 2)] : [W / 2]
  if (marks && !twoHinges) warnings.push(`العلبة قصيرة على مفصّلتين ${HINGE} مم؛ عُلّم مكان مفصّلة واحدة في الوسط.`)
  const tickLen = 3
  const baseTicks = (xs: number[]) => xs.map(x => tick(x, FLAT_MARGIN, FLAT_MARGIN + tickLen))
  const lidTickLen = Math.min(tickLen, hl - FLAT_MARGIN - mJ)
  const lidMarks = marks && lidTickLen >= 1.5
  if (marks && !lidMarks) warnings.push('الغطاء منخفض على علامات المفصّلات والقفل فحُذفت منه؛ علّمها على القاعدة فقط.')
  const lidTicks = (xs: number[]) => (lidMarks ? xs.map(x => tick(x, hl - FLAT_MARGIN - lidTickLen, hl - FLAT_MARGIN)) : [])
  const hingeXs = hc.flatMap(x => [x - HINGE / 2, x + HINGE / 2]), claspXs = [W / 2 - CLASP / 2, W / 2 + CLASP / 2]

  // ---------------------------------------------------------------- the wall bands
  const topRoom = marks ? FLAT_MARGIN + tickLen + 1.5 : FLAT_MARGIN + 0.5
  const u = bandUnit(H - mJ - topRoom, lw)
  const bandOf = (w: number) => wallBand(mJ, w - mJ, topRoom, H - mJ, lw, u)
  const frontBand = wallDeco ? bandOf(W) : null, sideBand = wallDeco && around ? bandOf(D) : null
  if (wallDeco && (!frontBand || (around && !sideBand))) {
    const need = Math.ceil(topRoom + mJ + BAND_ROWS * UNIT_MIN + lw)
    warnings.push(frontBand ? 'الجانبان قصيران على شريط الجدار فحُذف منهما.' : `القاعدة منخفضة على شريط الجدار فحُذف؛ ليظهر اجعل «ارتفاع القاعدة» ${need} مم أو أكثر.`)
  }

  // ---------------------------------------------------------------- the pieces
  // The lid's walls are low: shared the usual way, the corner finger of the wall with the male edge would be cut down
  // by the top's joint to a sliver (f − t: 1.5 mm on 3.2 mm with a 14 mm lid). So the top keeps the corner's first t
  // and the walls finger only below it, every finger (hl − t)/3 or wider.
  const lidCorner = (type: 'male' | 'female'): EdgeSpec => ({ type, from: t, len: hl - t })
  const panels: PanelSpec[] = [
    {
      id: 'bottom', name: 'القاعدة', w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male', count: copies,
      ...(feet ? { engrave: [[mJ, mJ], [W - mJ, mJ], [W - mJ, D - mJ], [mJ, D - mJ]].map(([x, y]) => disc(round3(x + (x < W / 2 ? 6.5 : -6.5)), round3(y + (y < D / 2 ? 6.5 : -6.5)), 5)) } : {}),
      note: feet ? 'الدوائر الأربع على وجهها السفلي: مكان الأرجل النحاسية' : 'لوح مصمت تحت الصينية السفلية',
    },
    {
      id: 'front', name: 'الواجهة الأمامية', w: W, h: H, bottom: 'female', left: 'male', right: 'male', count: copies,
      engrave: [...(frontBand?.loops ?? []), ...(marks ? baseTicks(claspXs) : [])],
      note: frontBand ? 'عليها شريط الكليم؛ النقش على وجهها الخارجي' : 'الحافّة العلوية مستقيمة يستقرّ عليها الغطاء',
    },
    {
      id: 'back', name: 'الخلفية', w: W, h: H, bottom: 'female', left: 'male', right: 'male', count: copies,
      engrave: [...(sideBand && frontBand ? frontBand.loops : []), ...(marks ? baseTicks(hingeXs) : [])],
      note: marks ? 'العلامات عند حافّتها العلوية لطرفي كل مفصّلة' : 'المفصّلتان على وجهها الخارجي عند الحافّة العلوية',
    },
    {
      id: 'side', name: 'الجانب', w: D, h: H, bottom: 'female', left: 'female', right: 'female', count: 2 * copies,
      ...(sideBand ? { engrave: sideBand.loops } : {}),
    },
    {
      id: 'lid', name: 'سطح الغطاء', w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male', count: copies,
      ...(knob ? { holes: [circle(round3(W / 2), round3(D / 2), round3(knobR))] } : {}),
      ...(lid ? { engrave: [...lid.bands, ...lid.motifs] } : {}),
      note: lid ? `شبكة المعيّنات منقوشة على وجهه الخارجي${knob ? '، وثقب المقبض في وسطه' : ''}` : knob ? 'ثقب المقبض في وسطه' : 'لوح الغطاء العلوي',
    },
    {
      id: 'lidfront', name: 'واجهة الغطاء', w: W, h: hl, top: 'female', left: lidCorner('male'), right: lidCorner('male'), count: copies,
      ...(marks ? { engrave: lidTicks(claspXs) } : {}),
      note: 'حافّتها السفلية مستقيمة تنطبق على الواجهة الأمامية',
    },
    {
      id: 'lidback', name: 'خلفية الغطاء', w: W, h: hl, top: 'female', left: lidCorner('male'), right: lidCorner('male'), count: copies,
      ...(marks ? { engrave: lidTicks(hingeXs) } : {}),
      note: 'عليها الورقة الثانية لكل مفصّلة',
    },
    { id: 'lidside', name: 'جانب الغطاء', w: D, h: hl, top: 'female', left: lidCorner('female'), right: lidCorner('female'), count: 2 * copies },
  ]
  for (const pn of panels) if (pn.engrave && !pn.engrave.length) delete pn.engrave

  const tot = H + hl
  const notes = [
    `العلبة من الخارج ${f1(W)} × ${f1(D)} مم وارتفاعها ${f1(tot)} مم دون الأرجل: صينية سفلية بارتفاع ${f1(H)} مم مفتوحة من فوق، وصينية غطاء بارتفاع ${f1(hl)} مم مفتوحة من تحت تنطبق عليها حافّة على حافّة. كلتاهما بتعشيق أصابع.`,
    'التجميع: الصق كل صينية وحدها بغراء الخشب: القاعدة مع الواجهة والخلفية والجانبين، ثم سطح الغطاء مع جدرانه القصيرة الأربعة. اجعل الوجه المنقوش من كل قطعة إلى الخارج. بعد جفاف الغراء ضع الغطاء على القاعدة وتأكّد أن الحوافّ متطابقة قبل تركيب المعدن.',
    `المعدن (يُشترى): ${twoHinges ? `مفصّلتان نحاسيتان صغيرتان ${HINGE} مم` : `مفصّلة نحاسية صغيرة ${HINGE} مم`} على الظهر، ورقة على الخلفية وورقة على خلفية الغطاء والمحور على خطّ التقائهما؛ وقفل (مشبك) زخرفي صغير عرضه نحو ${CLASP} مم في وسط الواجهة، قطعته المتحرّكة على واجهة الغطاء والماسك على الواجهة الأمامية. براغيها الصغيرة لا تمسك جيداً في خشب ${f1(t)} مم، فالأضمن لصقها بغراء إيبوكسي أو تثبيتها ببراغي M2 قصيرة بصواميل من الداخل.`,
    ...(marks ? [`العلامات المحفورة: خطّان صغيران عند طرفي كل مفصّلة (${HINGE} مم) على الخلفيتين، وعند طرفي القفل (${CLASP} مم) على الواجهتين؛ ضع القطعة بينهما.`] : []),
    ...(feet ? ['الأرجل: أربع أرجل نحاسية للعلب (ارتفاع 15–20 مم) تحت القاعدة فوق الدوائر المحفورة؛ تُلصق بالإيبوكسي أو تُثبّت ببراغيها القصيرة. الدوائر على الوجه السفلي، فاقلب القاعدة عند التجميع.'] : []),
    ...(knob && screw ? [`المقبض: مقبض نحاسي صغير (قطر قاعدته 15–20 مم) ببرغي ${screw} في الثقب ${f1(knob)} مم في وسط الغطاء، يُشدّ بصامولة من الداخل.`] : []),
    ...(lid ? [`شبكة الغطاء: معيّنات عرضها ${f1(P)} مم بخطّ ${f1(lw)} مم، ${lid.full ? `في كل معيّن كامل منها نقشة «${MOTIF_NAMES[motif - 1]}» بدرجات ${f1(lid.step)} مم (عدد النقشات: ${lid.full})` : 'بلا نقشات داخلها'}. الخطوط منسوجة: عند كل تقاطع يمرّ خطّ ويتوقّف الآخر قبله بـ${KILIM_GAP} مم، حتى لا تتراكب حلقات النقش فيلغي بعضها بعضاً في التعبئة.`] : []),
    ...(frontBand ? [`شريط الجدار فوق خطّ: خطّ متعرّج مدرّج تحت قممه مثلثات مدرّجة وفوقها مثلثات معلّقة، وفي كل وادٍ من وديانه حلقة مدرّجة حول نقطة كالتي على الغطاء (عددها على الواجهة ${frontBand.rings}${sideBand ? `، وعلى كل جانب ${sideBand.rings}، والخلفية مثل الواجهة` : ''})؛ ارتفاعه ${f1(frontBand.h)} مم ودرجته ${f1(frontBand.u)} مم، والحلقة الوسطى في منتصف الواجهة.`] : []),
    'النقش كلّه حلقات مغلقة يملؤها RDWorks بالمسح: اجعل طبقة النقش (الزرقاء) Scan بقدرة منخفضة، مثلاً 250–300 مم/ث و12–18% للخشب 3 مم بفاصل مسح 0.1 مم، ثم القصّ (الأحمر) بعدها. جرّب على قطعة صغيرة أولاً؛ في الأكريليك يكفي أقلّ من ذلك.',
    'لتلوين النقش كما في الصورة (أزرق وأحمر وذهبي): غطِّ اللوح بشريط لاصق ورقي قبل النقش، وبعد النقش ادهن أو رشّ اللون فوق الشريط، وانزعه بعد الجفاف فيبقى اللون في المحفور وحده.',
  ]
  return { panels, notes, warnings, errors, slotted: true }
}

export const KILIM_BOXES: Template[] = [
  {
    id: 'kilimbox',
    name: 'صندوق مسطّح بنقشة الكليم',
    desc: 'صندوق طويل منخفض من صينيتين بتعشيق أصابع: قاعدة مفتوحة من فوق وغطاء مقلوب فوقها بمفصّلتين معدنيتين وقفل في الأمام، على أربع أرجل نحاسية وبمقبض. على الغطاء شبكة معيّنات منقوشة في كل منها نقشة كليم مدرّجة، وعلى الواجهة شريط متعرّج بمثلثات وحلقات مدرّجة كنقش السجّاد.',
    icon: `<path d="M6 22h52v26H6z"/><path d="M6 16h52v6H6z"/><path d="M10 48v4M54 48v4M32 16v-3"/><path d="M8 44h48M10 44l4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6M16 30l3-3 3 3-3 3zM28 30l3-3 3 3-3 3zM40 30l3-3 3 3-3 3z" stroke-width="1.5"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build,
  },
]
