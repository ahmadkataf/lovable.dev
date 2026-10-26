// A ceiling decor for a recessed light opening in a gypsum-board false ceiling (the customer's picture: a rectangular
// frame band of Islamic rosettes all round, and an octagon medallion in the middle; the room: two rectangular recesses
// with fluorescent tubes). The decor is laid into the opening and its outer rim rests on the gypsum board, so the sizes
// the user gives are the decor's whole OUTSIDE size, the rest on the gypsum included.
//
// Two constructions ('kind'): one board PW × PH with every cut-out in it (the default, when the sheet holds it), or
// four separate strips, `band` wide, meeting at the corners on 45° mitres (trapezoids: top and bottom PW long outside
// and PW − 2·band inside, the sides PH / PH − 2·band) with a field panel inside, corner plates and glue strips behind.
// Either way the outer `ov` rests on the gypsum and stays solid, the band carries the frame's pattern, and its corners
// meet on the 45° diagonals: each corner motif is split by a solid diagonal bar 2·web wide (the mitre in the strips,
// the same bar on the board, optionally with a line engraved along it), so each corner is a mirror image about it.
//
// Two patterns ('style'): 1, the picture's: rosettes of 16 teardrop petals in a dashed ring, almonds and dots between
// them and along both edges, an octagon medallion; 2, 8-point stars (khatam: two squares drawn as straps) with crosses
// between them and diamonds along both edges, a round medallion with a 12-point star. With 'fill' the field inside the
// band is a lattice of the same family round the medallion (rosettes on a staggered grid with four-point fillers, or
// stars and crosses), clipped a strap short of the band, the medallion and the field's edges: no plain area is left.
//
// Strip coordinates: u along the outer edge from the strip's first corner, v from the outer edge inward; the mitres
// are u = v and u = L − v. Frame coordinates (the board's, and for the tests and pictures): x right, y down from the
// outer top-left corner; the strips run clockwise round the frame (top: x = u, y = v; right: x = PW − v, y = u;
// bottom: x = PW − u, y = PH − v; left: x = v, y = PH − u).
//
// 'sizeIs' 2 reads PW × PH as the window inside the frame (the outside is then PW + 2·band by PH + 2·band). 'mid' adds
// a middle strip across the window at its middle, perpendicular to the long sides and as long as the window's short
// side, butt-joined (square ends) to the long strips' inner edges: the long strips then take an even number of steps
// so a motif sits on its axis, and its own motifs continue that column from one long strip's motif to the other's
// (the short strips' steps), with a solid bar 2·sw wide over each joint. Its own coordinates: u along it from the
// window's edge (0 … Lm), v across (0 … midW). The band's straps (sw) grow with it: a 30 cm rosette cut with 3 mm
// straps is lace that breaks, so sw = max(web, STRAP · visible band).
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, polyLoop, circle, round3, arcInfo, signedArea } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const intP = (key: string, label: string, min: number, max: number, hint?: string, options?: string[]): ParamDef => ({ key, label, min, max, step: 1, int: true, ...(hint ? { hint } : {}), ...(options ? { options } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const up5 = (v: number) => Math.ceil(v * 2 - 1e-6) / 2
const down5 = (v: number) => Math.floor(v * 2 + 1e-6) / 2
const pick = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))
/**
 * A pure function's result by key, from a small cache: the patterns are worked out again only when their inputs
 * change (the app builds again on every keystroke). The results are shared, so nothing may change them.
 */
function memo<T>(cache: Map<string, T>, key: string, make: () => T): T {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const v = make()
  if (cache.size >= 16) cache.delete(cache.keys().next().value as string)
  cache.set(key, v)
  return v
}
const FRAMES = new Map<string, { top: Piece[]; side: Piece[] }>(), MEDS = new Map<string, Piece[]>(), LATS = new Map<string, Piece[]>(), MIDS = new Map<string, Piece[]>()

/** The band's straps as a share of its visible width (at least web): 7.6 mm in a 380 mm band, web in the usual ones. */
export const STRAP = 0.02

/** How far each glue strip behind the field's joint reaches onto the strip and onto the field (mm). */
export const CLEAT_REACH = 10

/** The options' labels, as the errors and notes name them. */
export const KIND_LABELS = ['قطعة واحدة', 'أربع شرائح بزوايا 45 ولوح وسط']
export const STYLE_LABELS = ['وردات ومثمّن (كالصورة)', 'نجوم ثمانية ودائرة']
export const CENTER_LABELS = ['مفرّغة في الوسط', 'قطعة منفصلة', 'بلا زخرفة وسطى']
export const SIZE_LABELS = ['مقاس الديكور من الخارج', 'مقاس الفتحة داخل الإطار']

const PARAMS: ParamDef[] = [
  intP('sizeIs', 'المقاس', 1, 2, '1 = العرض والطول مقاس الديكور كلّه من الخارج (مع الركبة على الجبس)، 2 = مقاس الفتحة داخل الإطار، فيكون الديكور من الخارج أكبر بعرض الإطار من كلّ جهة', SIZE_LABELS),
  mm('PW', 'العرض', 300, 2440, 'حسب «المقاس»: الديكور من الخارج، أو الفتحة داخل الإطار (1400 للأول و1380 للثاني)'),
  mm('PH', 'الطول', 300, 2440, 'حسب «المقاس»: الديكور من الخارج، أو الفتحة داخل الإطار (1050 للأول و1080 للثاني)'),
  mm('ov', 'الركبة على الجبس', 0, 200, 'كم يرتكز كلّ طرف من الديكور على لوح الجبسن بورد؛ تبقى خشباً مصمتاً ولا تظهر من تحت'),
  mm('band', 'عرض الإطار', 60, 600, 'من الحافّة الخارجية للديكور إلى حافّته الداخلية، والركبة على الجبس منه'),
  intP('kind', 'القطع', 1, 2, '1 = الديكور كلّه قطعة واحدة من لوح واحد (إن اتّسع له اللوح)، 2 = أربع شرائح تلتقي بزوايا 45° ولوح وسط، للديكور الأكبر من اللوح', KIND_LABELS),
  intP('style', 'النقشة', 1, 2, '1 = وردات من 16 بتلة ومثمّن في الوسط كالصورة، 2 = نجوم ثمانية (خاتم) وصلبان ودائرة في الوسط فيها نجمة من 12 رأساً', STYLE_LABELS),
  intP('center', 'الزخرفة الوسطى', 1, 3, 'في القطعة الواحدة: 1 = مفرّغة في اللوح، 2 = قطعة منفصلة تُلصق على وسط مصمت فتبرز، 3 = بلا زخرفة وسطى. في الشرائح: 1 = لوح وسط فيه الزخرفة، 2 = الزخرفة وحدها تُلصق في الوسط، 3 = إطار فقط', CENTER_LABELS),
  mm('med', 'قطر الزخرفة الوسطى', 150, 1200, 'المثمّن بين ضلعين متقابلين، والدائرة قطرها'),
  intP('fill', 'نقش الوسط كلّه', 0, 1, '1 = شبكة زخرفة تملأ الوسط حول الزخرفة الوسطى فلا تبقى مساحة سادة، 0 = الوسط سادة'),
  mm('fcell', 'خليّة شبكة الوسط', 30, 250, 'المسافة بين وردة الشبكة والحشوة التي بجانبها (أو بين النجمة والصليب)'),
  intP('mid', 'شريحة وسطى', 0, 1, '1 = شريحة مزخرفة تقطع الفتحة من منتصف الضلع الطويل إلى المقابل، طرفاها مستقيمان بلا شطف يلتقيان بالشريحتين الطويلتين، ونقشتها تكمل نقشتهما (مع «بلا زخرفة وسطى» / «إطار فقط»)'),
  mm('midW', 'عرض الشريحة الوسطى', 0, 600, '0 = بعرض الإطار الظاهر'),
  intP('line', 'خطّ الزاوية', 0, 1, 'في القطعة الواحدة: 1 = حفر خطّ رفيع على شريط الخشب المائل في كلّ زاوية (خطّ التقاء الـ45°)'),
  { ...mm('web', 'أقلّ خشب بين فتحتين', 2, 8, 'بين كلّ فتحتين، وبين الفتحة والحافّة؛ 3 مم يكفي للـMDF'), step: 0.5 },
  { ...mm('fit', 'خلوص اللوح الأوسط', 0, 2, 'في الشرائح: بين اللوح الأوسط والإطار من كلّ جهة'), step: 0.1 },
  intP('cleats', 'قطع التدعيم', 0, 1, 'في الشرائح: 1 = قطع تُلصق خلف الزوايا وخلف وصلة اللوح الأوسط، من نفس اللوح'),
  intP('back', 'لوح أكريليك أوبال', 0, 1, '1 = لوح أكريليك أبيض حليبي بمقاس الديكور فوقه يوزّع ضوء النيون'),
  mm('sheetL', 'طول لوح الخشب', 300, 3000, 'اللوح الكامل 2440 × 1220'),
  mm('sheetW', 'عرض لوح الخشب', 300, 2000),
  intP('n', 'عدد الديكورات', 1, 10),
]

const DEFAULTS = { sizeIs: 1, PW: 1400, PH: 1050, ov: 30, band: 170, kind: 1, style: 1, center: 1, med: 450, fill: 1, fcell: 70, mid: 0, midW: 0, line: 0, web: 3, fit: 0.2, cleats: 1, back: 0, sheetL: 2440, sheetW: 1220, n: 1 }

// ------------------------------------------------------------------ shapes (loops with arcs)

const add = (c: P2, r: number, a: number): P2 => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) })
/** The vertex that starts an arc of radius r round c from angle a0 to angle a1 (either way round, under a full turn). */
const arcV = (c: P2, r: number, a0: number, a1: number): Vtx => ({ ...add(c, r, a0), b: Math.tan((a0 - a1) / 4) })

/** A teardrop: a tip circle (radius rt, r1 from c along phi) and a head circle (rh at r2), joined by tangents. */
function petal(c: P2, phi: number, r1: number, rt: number, r2: number, rh: number): Vtx[] {
  const T = add(c, r1, phi), H = add(c, r2, phi), q = Math.PI / 2 + Math.asin((rh - rt) / (r2 - r1))
  return [add(T, rt, phi + q), arcV(H, rh, phi + q, phi - q), add(H, rh, phi - q), arcV(T, rt, phi - q, phi + q - 2 * Math.PI)]
}
/**
 * An almond: two arcs between tips a either side of c along ang, w its half-width; each arc in two at its crown, so
 * the crowns are corners of the outline (an almond set to touch a line touches it exactly, also in the checks).
 */
function lens(c: P2, ang: number, a: number, w: number): Vtx[] {
  const b = Math.tan(Math.atan(w / a) / 2), n = { x: Math.sin(ang), y: -Math.cos(ang) }
  return [{ ...add(c, a, ang), b }, { x: c.x + w * n.x, y: c.y + w * n.y, b }, { ...add(c, -a, ang), b }, { x: c.x - w * n.x, y: c.y - w * n.y, b }]
}
/** A piece of ring between radii ri and ro, from angle a0 to a1 (a0 < a1), radial ends. */
const ringPiece = (c: P2, ri: number, ro: number, a0: number, a1: number): Vtx[] => [arcV(c, ro, a0, a1), add(c, ro, a1), arcV(c, ri, a1, a0), add(c, ri, a0)]
/** The part of a disc beyond a chord: the points z with (z − c)·n ≥ d, n the unit normal at angle psi. */
function discCap(c: P2, r: number, psi: number, d: number): Vtx[] {
  const al = Math.acos(d / r)
  return [arcV(c, r, psi - al, psi + al), add(c, r, psi + al)]
}
const circ = (c: P2, r: number): Vtx[] => circle(c.x, c.y, r).pts

/**
 * A shape as a polygon that holds all of it, for the clearance checks: an arc that bows outward becomes the corners of
 * its tangent polygon (points on the arc would cut its bows off and pass a web up to a few tenths too thin), an arc
 * that bows inward its chords.
 */
function sample(pts: Vtx[], stepDeg = 12): P2[] {
  const out: P2[] = [], n = pts.length, sa = Math.sign(signedArea({ pts, closed: true }))
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(2, Math.ceil(a.theta / ((stepDeg * Math.PI) / 180))), dir = a.ccw ? -1 : 1
      const at = (ang: number, r: number) => ({ x: a.c.x + r * Math.cos(ang), y: a.c.y + r * Math.sin(ang) })
      if (Math.sign(p.b) * sa < 0) for (let k = 0; k < m; k++) out.push(at(a.a0 + (dir * a.theta * (2 * k + 1)) / (2 * m), a.r / Math.cos(a.theta / (2 * m))))
      else for (let k = 1; k < m; k++) out.push(at(a.a0 + (dir * a.theta * k) / m, a.r))
    }
  }
  return out
}
/**
 * A shape as a polygon that lies inside it, what a clipped shape is cut as: an arc that bows outward becomes chords
 * between points on it, an arc that bows inward the sides of its tangent polygon (chords there would cut into the wood
 * and thin a web by their sagitta).
 */
function within(pts: Vtx[], stepDeg = 6): P2[] {
  const out: P2[] = [], n = pts.length, sa = Math.sign(signedArea({ pts, closed: true }))
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(2, Math.ceil(a.theta / ((stepDeg * Math.PI) / 180))), dir = a.ccw ? -1 : 1
      const at = (ang: number, r: number) => ({ x: a.c.x + r * Math.cos(ang), y: a.c.y + r * Math.sin(ang) })
      if (Math.sign(p.b) * sa < 0) for (let k = 1; k < m; k++) out.push(at(a.a0 + (dir * a.theta * k) / m, a.r))
      else for (let k = 0; k < m; k++) out.push(at(a.a0 + (dir * a.theta * (2 * k + 1)) / (2 * m), a.r / Math.cos(a.theta / (2 * m))))
    }
  }
  return out
}
function inPoly(q: P2, pts: P2[]): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y)) c = !c
  }
  return c
}
function segPt(p: P2, a: P2, b: P2): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
/** The gap between two polygons (0 when they overlap). */
function gapOf(A: P2[], B: P2[]): number {
  if (inPoly(A[0], B) || inPoly(B[0], A)) return 0
  let d = Infinity
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    const a = A[i], a2 = A[(i + 1) % A.length], b = B[j], b2 = B[(j + 1) % B.length]
    d = Math.min(d, segPt(a, b, b2), segPt(b, a, a2))
    if (d <= 0) return 0
  }
  return d
}
type Box = { x0: number; x1: number; y0: number; y1: number }
const bbOf = (pts: P2[]): Box => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const q of pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y }
  return { x0, x1, y0, y1 }
}
/** At least `d` apart? (boxes first) */
function clear(A: P2[], B: P2[], d: number): boolean {
  const a = bbOf(A), b = bbOf(B)
  if (a.x0 > b.x1 + d || b.x0 > a.x1 + d || a.y0 > b.y1 + d || b.y0 > a.y1 + d) return true
  return gapOf(A, B) >= d - 1e-9
}

/**
 * Big enough to cut cleanly: 2 mm across and 4 mm², and still 3 mm² once the laser's path, a kerf of 0.2 inside the
 * hole, has taken its 0.1 mm off every side.
 */
const MIN_W = 2, MIN_A = 4
const cuttable = (pc: Piece) => { const a = areaAbs(pc.poly); return a >= MIN_A && a - 0.1 * perimeter(pc.poly) >= 3.05 && widthOf(hull(pc.poly)) >= MIN_W }

/** A shape moved by (dx, dy) (arcs keep their bulges). */
const moved = (pts: Vtx[], dx: number, dy: number): Vtx[] => pts.map(v => ({ ...v, x: v.x + dx, y: v.y + dy }))
/** Mirror in the line x = m (the bulges change side). */
const mirrored = (pts: Vtx[], m: number): Vtx[] => pts.map(v => ({ ...v, x: 2 * m - v.x, ...(v.b ? { b: -v.b } : {}) }))
const rounded = (pts: Vtx[]): Vtx[] => pts.map(v => ({ ...v, x: round3(v.x), y: round3(v.y) }))

/** One shape of the pattern: its loop, a fine polygon of it, and where it sits (for halving and mirroring). */
export interface Piece { pts: Vtx[]; poly: P2[]; c: P2; key: string }
const piece = (pts: Vtx[], c: P2, key: string): Piece => ({ pts, poly: sample(pts), c, key })
const centroid = (pts: P2[]): P2 => pts.reduce((a, z) => ({ x: a.x + z.x / pts.length, y: a.y + z.y / pts.length }), { x: 0, y: 0 })
/** A straight-sided shape as a piece (sitting at its corners' mean unless told). */
const polyPiece = (pts: P2[], key: string, c = centroid(pts)): Piece => ({ pts: pts.map(q => ({ x: q.x, y: q.y })), poly: pts, c, key })
/** A piece moved, or mirrored in y = x (the corner's diagonal), or turned by a about o. */
const movePc = (pc: Piece, dx: number, dy: number, key = pc.key): Piece => ({ pts: moved(pc.pts, dx, dy), poly: pc.poly.map(q => ({ x: q.x + dx, y: q.y + dy })), c: { x: pc.c.x + dx, y: pc.c.y + dy }, key })
function turnPc(pc: Piece, o: P2, a: number, key = pc.key): Piece {
  const co = Math.cos(a), si = Math.sin(a), f = (q: P2) => ({ x: o.x + (q.x - o.x) * co - (q.y - o.y) * si, y: o.y + (q.x - o.x) * si + (q.y - o.y) * co })
  return { pts: pc.pts.map(v => ({ ...v, ...f(v) })), poly: pc.poly.map(f), c: f(pc.c), key }
}
/** Mirrors of a piece in x = mx and/or y = my (around 0 for the field's lattice). */
function flipPc(pc: Piece, fx: boolean, fy: boolean): Piece {
  const f = (q: P2) => ({ x: fx ? -q.x : q.x, y: fy ? -q.y : q.y }), flip = fx !== fy
  return { pts: pc.pts.map(v => ({ ...v, ...f(v), ...(v.b && flip ? { b: -v.b } : {}) })), poly: pc.poly.map(f), c: f(pc.c), key: pc.key }
}

// ------------------------------------------------------------------ polygons: half-planes, insets, clipping, slivers

const dirOf = (a: number): P2 => ({ x: Math.cos(a), y: Math.sin(a) })
const dot = (a: P2, b: P2) => a.x * b.x + a.y * b.y
const cross2 = (o: P2, a: P2, b: P2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
/** The signed area (positive when the corners run counter-clockwise in x-right, y-up terms). */
const polyArea = (pts: P2[]) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y } return a / 2 }
const areaAbs = (pts: P2[]) => Math.abs(polyArea(pts))
const ccw = (pts: P2[]) => (polyArea(pts) < 0 ? [...pts].reverse() : pts)
const perimeter = (pts: P2[]) => pts.reduce((s, q, i) => s + Math.hypot(pts[(i + 1) % pts.length].x - q.x, pts[(i + 1) % pts.length].y - q.y), 0)

/** The convex polygon of the points q with n·(q − c) ≥ d for every half-plane [n, d] (n unit), from a big square. */
function clipConvex(c: P2, size: number, hs: [P2, number][]): P2[] {
  let poly: P2[] = [{ x: c.x - size, y: c.y - size }, { x: c.x + size, y: c.y - size }, { x: c.x + size, y: c.y + size }, { x: c.x - size, y: c.y + size }]
  for (const [nv, d] of hs) {
    poly = clipHalf(poly, nv, d + dot(nv, c))
    if (poly.length < 3) return []
  }
  return poly
}
/** A convex polygon cut to the half-plane n·q ≥ d. */
function clipHalf(poly: P2[], nv: P2, d: number): P2[] {
  const f = (q: P2) => dot(nv, q) - d, out: P2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b)
    if (fa >= 0) out.push(a)
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }) }
  }
  return out.length >= 3 ? dropShort(tidyPoly(out)) : []
}
/**
 * The corners left out whose edge would vanish when the kerf takes up to 0.15 mm off the hole's sides (an edge
 * shorter than d·(tan(τ₁/2) + tan(τ₂/2)), τ the turns at its ends): the kerf's offset would cross itself there. Of the
 * two ends the gentler turn goes, so a real corner stays.
 */
function dropShort(pts: P2[], d = 0.15): P2[] {
  let out = pts
  const sg = Math.sign(polyArea(pts)) || 1
  for (let guard = 0; guard < 400 && out.length > 3; guard++) {
    const n = out.length, turn = (i: number) => {
      const a = out[(i + n - 1) % n], b = out[i], c = out[(i + 1) % n], e1 = { x: b.x - a.x, y: b.y - a.y }, e2 = { x: c.x - b.x, y: c.y - b.y }
      return sg * Math.atan2(e1.x * e2.y - e1.y * e2.x, e1.x * e2.x + e1.y * e2.y)
    }
    const tau = out.map((_, i) => turn(i)), grow = (t: number) => (t > 0 ? Math.tan(Math.min(t, 3.1) / 2) : 0)
    let worst = -1, wv = 0
    for (let i = 0; i < n; i++) {
      const a = out[i], b = out[(i + 1) % n], len = Math.hypot(b.x - a.x, b.y - a.y), need = d * (grow(tau[i]) + grow(tau[(i + 1) % n])) + 0.02
      if (len < need && need - len > wv) { wv = need - len; worst = i }
    }
    if (worst < 0) break
    // a convex corner goes before a reflex one: leaving out a convex corner cuts a sliver off the shape, leaving out a
    // reflex one fills a notch, and the shape would grow into the web beside it
    const j = (worst + 1) % n, cw = tau[worst] > 0, cj = tau[j] > 0
    const drop = cw !== cj ? (cw ? worst : j) : Math.abs(tau[worst]) <= Math.abs(tau[j]) ? worst : j
    out = out.filter((_, k) => k !== drop)
  }
  return out
}
/** A star of k points (outer radius ro at angles a0 + j·2π/k, inner ri between them). */
const starPts = (c: P2, k: number, ro: number, ri: number, a0: number): Vtx[] => Array.from({ length: 2 * k }, (_, j) => add(c, j % 2 ? ri : ro, a0 + (j * Math.PI) / k))
/** Narrowest width of a convex polygon (its smallest extent across any edge direction). */
function widthOf(pts: P2[]): number {
  let w = Infinity
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l < 1e-9) continue
    const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l
    let m = 0
    for (const q of pts) m = Math.max(m, Math.abs((q.x - a.x) * nx + (q.y - a.y) * ny))
    w = Math.min(w, m)
  }
  return w
}
/** The convex hull (counter-clockwise). */
function hull(pts: P2[]): P2[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y), lo: P2[] = [], hi: P2[] = []
  for (const p of s) { while (lo.length >= 2 && cross2(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && cross2(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p) }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)]
}
/** Repeated corners and corners on a straight line (or doubling back) left out. */
function tidyPoly(pts: P2[], eps = 1e-7): P2[] {
  let out = pts.filter((q, i) => { const r = pts[(i + 1) % pts.length]; return Math.hypot(r.x - q.x, r.y - q.y) > eps })
  for (let again = true; again && out.length > 3;) {
    again = false
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length], l = Math.hypot(c.x - a.x, c.y - a.y)
      if (l < eps || Math.abs(cross2(a, b, c)) / l < eps) { out = out.filter((_, j) => j !== i); again = true; break }
    }
  }
  return out
}
function segsCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o1 = cross2(a, b, c), o2 = cross2(a, b, d), o3 = cross2(c, d, a), o4 = cross2(c, d, b)
  return o1 * o2 < -1e-12 && o3 * o4 < -1e-12
}
/** Do two edges that do not share a corner cross? */
function selfCross(pts: P2[]): boolean {
  const n = pts.length
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    if (segsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true
  }
  return false
}
/** The counter-clockwise polygon moved d inward along every edge (mitred corners); null when an edge turns over or it crosses itself. */
function insetPoly(pts: P2[], d: number): P2[] | null {
  const n = pts.length, L: { p: P2; u: P2 }[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l < 1e-9) return null
    const u = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
    L.push({ p: { x: a.x - u.y * d, y: a.y + u.x * d }, u })
  }
  const out: P2[] = []
  for (let i = 0; i < n; i++) {
    const A = L[(i + n - 1) % n], B = L[i], den = A.u.x * B.u.y - A.u.y * B.u.x
    if (Math.abs(den) < 1e-9) { out.push(B.p); continue }
    const t = ((B.p.x - A.p.x) * B.u.y - (B.p.y - A.p.y) * B.u.x) / den
    out.push({ x: A.p.x + t * A.u.x, y: A.p.y + t * A.u.y })
  }
  for (let i = 0; i < n; i++) { const a = out[i], b = out[(i + 1) % n]; if ((b.x - a.x) * L[i].u.x + (b.y - a.y) * L[i].u.y <= 1e-9) return null }
  return selfCross(out) ? null : out
}

/**
 * The parts of the simple counter-clockwise polygon P inside the convex region Q (its corners counter-clockwise) when
 * `keep`, or outside it, each counter-clockwise: P's boundary walked through its crossings with Q's, the pieces of Q's
 * boundary between them added (forward when keeping, backward when removing). Null when the answer would have a hole.
 */
export function clipPoly(P: P2[], Q: P2[], keep: boolean): P2[][] | null {
  const m = Q.length, n = P.length
  const hs = Q.map((a, k) => { const b = Q[(k + 1) % m], l = Math.hypot(b.x - a.x, b.y - a.y), nv = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; return { nv, d: dot(nv, a), a, u: { x: (b.x - a.x) / l, y: (b.y - a.y) / l }, l } })
  const cum: number[] = []
  let per = 0
  for (const h of hs) { cum.push(per); per += h.l }
  const f = (k: number, q: P2) => dot(hs[k].nv, q) - hs[k].d
  const sOf = (q: P2, k: number) => {
    if (k < 0) { let best = Infinity; for (let j = 0; j < m; j++) { const v = Math.abs(f(j, q)); if (v < best) { best = v; k = j } } }
    return cum[k] + Math.max(0, Math.min(hs[k].l, dot(hs[k].u, { x: q.x - hs[k].a.x, y: q.y - hs[k].a.y })))
  }
  // each edge's stretch inside Q (Cyrus–Beck), with the sides of Q it enters and leaves by
  const iv: ({ t0: number; t1: number; k0: number; k1: number } | null)[] = []
  for (let i = 0; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n]
    let t0 = 0, t1 = 1, k0 = -1, k1 = -1, ok = true
    for (let k = 0; k < m && ok; k++) {
      const fp = f(k, p), fq = f(k, q)
      if (fp < 0 && fq < 0) ok = false
      else if (fp < 0) { const t = fp / (fp - fq); if (t > t0) { t0 = t; k0 = k } }
      else if (fq < 0) { const t = fp / (fp - fq); if (t < t1) { t1 = t; k1 = k } }
    }
    iv.push(ok && t1 - t0 > 1e-12 ? { t0, t1, k0, k1 } : null)
  }
  type X = { i: number; t: number; q: P2; s: number; enter: boolean }
  const xs: X[] = []
  const at = (i: number, t: number) => { const p = P[i], q = P[(i + 1) % n]; return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) } }
  for (let i = 0; i < n; i++) {
    const r = iv[i]
    if (!r) continue
    const prev = iv[(i + n - 1) % n], next = iv[(i + 1) % n]
    if (r.t0 > 1e-12 || !(prev && prev.t1 >= 1 - 1e-12)) { const q = at(i, r.t0); xs.push({ i, t: r.t0, q, s: sOf(q, r.k0), enter: true }) }
    if (r.t1 < 1 - 1e-12 || !(next && next.t0 <= 1e-12)) { const q = at(i, r.t1); xs.push({ i, t: r.t1, q, s: sOf(q, r.k1), enter: false }) }
  }
  if (!xs.length) {
    const inQ = (q: P2) => hs.every((_, k) => f(k, q) > 1e-9), outQ = (q: P2) => hs.some((_, k) => f(k, q) < -1e-9)
    const pin = P.some(inQ) && !P.some(outQ)
    if (pin) return keep ? [P] : []
    if (inPoly(centroid(Q), P)) return keep ? [Q] : null
    return keep ? [] : [P]
  }
  for (let j = 0; j < xs.length; j++) if (xs[j].enter === xs[(j + 1) % xs.length].enter) return null
  // the stretches of P's boundary that are kept: from an entry to the next exit (keeping), or from an exit to the next entry
  const chains: { from: X; to: X; pts: P2[] }[] = []
  for (let j = 0; j < xs.length; j++) {
    const a = xs[j], b = xs[(j + 1) % xs.length]
    if (a.enter !== keep) continue
    const pts: P2[] = [a.q]
    for (let i = (a.i + 1) % n, guard = 0; guard <= n; i = (i + 1) % n, guard++) {
      if (i === (b.i + 1) % n && (b.i !== a.i || b.t > a.t || guard > 0)) break
      pts.push(P[i])
    }
    pts.push(b.q)
    chains.push({ from: a, to: b, pts })
  }
  const mod = (v: number) => ((v % per) + per) % per
  const out: P2[][] = []
  const used = new Set<number>()
  for (let c0 = 0; c0 < chains.length; c0++) {
    if (used.has(c0)) continue
    const loop: P2[] = []
    for (let c = c0, guard = 0; !used.has(c) && guard <= chains.length; guard++) {
      used.add(c)
      const ch = chains[c]
      loop.push(...ch.pts)
      // along Q's boundary to the next chain's start: forward when keeping, backward when removing
      const s0 = ch.to.s
      let best = -1, bd = Infinity
      chains.forEach((o, k) => { const dd = keep ? mod(o.from.s - s0) : mod(s0 - o.from.s); if (dd < bd) { bd = dd; best = k } })
      const corners = Q.map((q, k) => ({ q, dd: keep ? mod(cum[k] - s0) : mod(s0 - cum[k]) })).filter(z => z.dd > 1e-9 && z.dd < bd - 1e-9).sort((a, b) => a.dd - b.dd)
      loop.push(...corners.map(z => z.q))
      c = best
    }
    const tp = dropShort(tidyPoly(loop))
    if (tp.length >= 3 && areaAbs(tp) > 1e-6) out.push(ccw(tp))
  }
  return out.some(selfCross) ? null : out
}

/**
 * Is a clipped shape fit to cut: 4 mm² (3 after a 0.2 kerf), 2 mm across, and nowhere a stretch over 3 mm long that
 * is under 2 mm wide (a sliver left along a clipping line)?
 */
function clipOk(pts: P2[]): boolean {
  const a = areaAbs(pts)
  if (a < MIN_A || a - 0.1 * perimeter(pts) < 3.05 || widthOf(hull(pts)) < MIN_W) return false
  return !thinRun(pts, MIN_W, 3)
}
/**
 * Along the boundary, a run longer than `run` where the way straight across to the other side is under w. The run
 * starts again at a sharp corner (over 40°): a pointed corner narrows to nothing but is no sliver.
 */
function thinRun(pts: P2[], w: number, run: number): boolean {
  const n = pts.length
  let cur = 0
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l < 1e-9) continue
    const z = pts[(i + n - 1) % n], lz = Math.hypot(a.x - z.x, a.y - z.y)
    if (lz > 1e-9 && ((a.x - z.x) * (b.x - a.x) + (a.y - z.y) * (b.y - a.y)) / (l * lz) < Math.cos((40 * Math.PI) / 180)) cur = 0
    const nv = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }, k = Math.max(1, Math.ceil(l / 0.4))
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k, s = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
      let r = Infinity
      for (let e = 0; e < n; e++) {
        if (e === i) continue
        const c = pts[e], d = pts[(e + 1) % n], ex = d.x - c.x, ey = d.y - c.y, den = nv.x * ey - nv.y * ex
        if (Math.abs(den) < 1e-12) continue
        const tr = ((c.x - s.x) * ey - (c.y - s.y) * ex) / den, te = ((c.x - s.x) * nv.y - (c.y - s.y) * nv.x) / den
        if (tr > 1e-6 && te >= -1e-9 && te <= 1 + 1e-9 && tr < r) r = tr
      }
      if (r < w) { cur += l / k; if (cur > run) return true } else { cur = 0; if (pass === 1) return false }
    }
  }
  return false
}

// ------------------------------------------------------------------ the rosette (style 1)

const SIN16 = Math.sin(Math.PI / 16)

/** The rosette's measures for a ring of outer radius R, or null when its petals would be too small to cut. */
export function rosetteDims(R: number, web: number) {
  const tr = Math.max(2, 0.07 * R), Ri = R - tr
  const rc = 0.21 * R, rt = Math.max(0.8, 0.02 * R), gap = 1.1 * web
  const r1 = Math.max(rc + web + rt, (gap / 2 + rt) / SIN16)
  const outer = Ri - web
  // the head as big as the gap to the next petal allows: 2·r2·sin(π/16) − 2·rh = gap with r2 + rh = outer
  const rh = (SIN16 * outer - gap / 2) / (1 + SIN16), r2 = outer - rh
  // the ring's bridges, in line with the wood between the petals, `bw` wide at the ring's inner edge
  const bw = Math.max(web, 0.08 * R), dB = Math.asin(Math.min(1, bw / 2 / Ri))
  const ok = rc >= 1.5 && rh >= Math.max(rt + 0.3, 1.2) && r2 - r1 >= 2 * rh && (Math.PI / 16 - dB) * Ri >= 2
  return ok ? { R, Ri, tr, rc, r1, rt, r2, rh, dB } : null
}
export type RosetteDims = NonNullable<ReturnType<typeof rosetteDims>>

/**
 * A rosette at c: the centre dot, 16 petals (one along +u) and 16 pieces of the dashed ring. With `mitre` it is the
 * corner rosette on the line u = v through c: only the pieces on this strip's side (u − v ≥ web·√2 from c) are kept,
 * the petals on the mitre go, the dot becomes the half beyond `web` from it, and the ring pieces on the mitre are cut
 * `web` short of it.
 */
function rosette(c: P2, d: RosetteDims, web: number, mitre = false, tag = 'r'): Piece[] {
  const out: Piece[] = [], s = Math.PI / 16 - d.dB, Q = Math.PI / 4
  const side = (pc: Piece) => pc.poly.every(q => q.x - c.x - (q.y - c.y) >= web * Math.SQRT2 - 1e-6)
  if (!mitre) out.push(piece(circ(c, d.rc), c, `${tag}dot`))
  else if (d.rc - web >= MIN_W) out.push(piece(discCap(c, d.rc, -Q, web), c, `${tag}dot`))
  for (let k = 0; k < 16; k++) {
    const phi = (k * Math.PI) / 8
    const onMitre = mitre && (k === 2 || k === 10)
    if (!onMitre) out.push(piece(petal(c, phi, d.r1, d.rt, d.r2, d.rh), add(c, (d.r1 + d.r2) / 2, phi), `${tag}p${k}`))
    if (!onMitre) out.push(piece(ringPiece(c, d.Ri, d.R, phi - s, phi + s), add(c, d.R, phi), `${tag}a${k}`))
    else {
      // the ring piece on the mitre, cut web short of it on this side
      const e = Math.asin(Math.min(1, web / d.Ri)), a0 = k === 2 ? Q - s : -3 * Q + e, a1 = k === 2 ? Q - e : -3 * Q + s
      if ((a1 - a0) * d.Ri >= 2.5) out.push(piece(ringPiece(c, d.Ri, d.R, a0, a1), add(c, d.R, (a0 + a1) / 2), `${tag}a${k}`))
    }
  }
  return mitre ? out.filter(side) : out
}

// ------------------------------------------------------------------ between two rosettes

/**
 * The scales a waist unit placed its sets at, by name (0: left out). The units at a corner are made with `caps`, the
 * smaller scale of each set on the two strips meeting there, so both carry the same shapes and the corner stays a
 * mirror image (left alone, a set that fits one strip's step at full size and the other's only shrunk breaks it).
 */
export type Unit = Piece[] & { scales: Record<string, number> }
/** Adds a set of shapes at the largest scale (from its cap down to minS, in twentieths) at which `fits` takes it. */
function unitAdder(placed: Piece[], fits: (set: Piece[]) => boolean, caps?: Record<string, number>) {
  const scales: Record<string, number> = {}
  const tryAdd = (name: string, make: (s: number) => Piece[], minS = 0.45) => {
    scales[name] = 0
    for (let k = Math.round((1 - (caps ? caps[name] ?? 0 : 1)) * 20); 1 - k / 20 >= minS - 1e-9; k++) {
      const s = 1 - k / 20, set = make(s)
      if (!set.every(cuttable)) break // smaller still would only be slivers
      if (set.length && fits(set)) { placed.push(...set); scales[name] = s; return s }
    }
    return 0
  }
  return { tryAdd, unit: () => Object.assign(placed, { scales }) as Unit }
}

/**
 * The shapes between two rosettes (rings of outer radius R, centres p apart) in a band 2H wide, in coordinates from
 * the waist (the middle between them) and the band's centre line: the frieze along both edges (a dot over the waist,
 * almonds a fifth of the pitch apart), a column of two almonds and two dots across the waist, and four kites where
 * the rings meet the frieze. Each set is shrunk until it keeps `web` from the rings, the band's edges and the sets
 * before it, or left out.
 */
export function waistUnit(p: number, H: number, R: number, web: number, caps?: Record<string, number>): Unit {
  const placed: Piece[] = []
  const rings = [{ x: -p / 2, y: 0 }, { x: p / 2, y: 0 }]
  const fits = (set: Piece[]) => set.every(pc =>
    pc.poly.every((q, i) => Math.abs(q.y) <= H + 1e-6 && rings.every(r => segPt(r, q, pc.poly[(i + 1) % pc.poly.length]) >= R + web - 1e-6))
    && placed.every(o => clear(pc.poly, o.poly, web))) && set.every((a, i) => set.every((b, j) => j <= i || clear(a.poly, b.poly, web)))
  const { tryAdd, unit } = unitAdder(placed, fits, caps)
  const both = (f: (sy: number) => Piece[]) => [...f(-1), ...f(1)]
  // the frieze: dots over the waist, touching the band's edge
  const rE = 0.07 * H
  tryAdd('fd', s => both(sy => { const c = { x: 0, y: sy * (H - rE * s) }; return [piece(circ(c, rE * s), c, `fd${sy}`)] }))
  // and almonds at ±p/5, ±2p/5
  const hE = 0.075 * H, aE = Math.min(0.085 * p, (0.2 * p - 1.2 * web) / 2 - 0.1)
  if (aE > 2) tryAdd('fa', s => both(sy => [-2, -1, 1, 2].map(j => {
    const c = { x: (j * p) / 5, y: sy * (H - hE * s) }
    return piece(lens(c, 0, aE * s, hE * s), c, `fa${sy}${j}`)
  })))
  // the column: an almond each side of a bar across the waist, and a dot beyond it
  const g = p - 2 * R, wA = Math.min(0.07 * H, g / 2 - web), yA = 0.26 * H, aA = 0.15 * H
  if (wA > 0.75) tryAdd('ca', s => both(sy => { const c = { x: 0, y: sy * yA }; return [piece(lens(c, Math.PI / 2, aA * s, wA * s), c, `ca${sy}`)] }))
  const rO = Math.min(0.075 * H, g / 2 - web), yO = 0.56 * H
  if (rO > 0.75) tryAdd('cd', s => both(sy => { const c = { x: 0, y: sy * yO }; return [piece(circ(c, rO * s), c, `cd${sy}`)] }))
  // the kites: almonds along the rings, where they come near the frieze
  const aK = 0.11 * H, wK = 0.045 * H
  tryAdd('k', s => both(sy => [-1, 1].map(sx => {
    const r = rings[sx < 0 ? 0 : 1], ang0 = Math.atan2(sy * 0.72 * H, -sx * p / 2), c = add(r, R + web + wK + 0.6 * web, ang0)
    return piece(lens(c, ang0 + Math.PI / 2, aK * s, wK * s), c, `k${sy}${sx}`)
  })), 0.5)
  return unit()
}

// ------------------------------------------------------------------ the 8-point star (style 2)

/** The band star's tip radius and its step, of the pattern's width. */
export const STAR = { R: 0.36, p: 0.96 }
const Q8 = Math.PI / 4
const neg = (v: P2): P2 => ({ x: -v.x, y: -v.y })
/** A diamond (corners along the axes) round c, a across and h up and down from it. */
const diamond = (c: P2, a: number, h: number): P2[] => [{ x: c.x + a, y: c.y }, { x: c.x, y: c.y + h }, { x: c.x - a, y: c.y }, { x: c.x, y: c.y - h }]

/**
 * The star's measures, tips at radius R (on the straps' middle lines): the straps `s` it is drawn with (at least
 * `sk`·R), both squares' half-size h, the inner star's half-size h2, the points' height, and (in a band 2H wide) the
 * diamonds along the band's edges. Null when a piece would be too small to cut.
 */
export function starDims(R: number, H: number, web: number, sk = 0.045) {
  const s = Math.max(web, sk * R), h = R / Math.SQRT2, e = s / 2, h2 = 0.55 * h
  const tip = R * (1 - Math.SQRT1_2) - s * (Math.SQRT1_2 + 0.5) // a point's height, from its base to its tip
  const kite = (h - e - (h2 + e)) / Math.cos(Math.PI / 8) // a kite's length, from the inner star's notch to the octagon's corner
  const hD = 0.13 * H, aD = 0.09 * H
  const ok = tip >= 2.6 && kite >= 4 && (h2 - e) * Math.SQRT2 >= 4 && H - (R - s / Math.SQRT2) >= web + 2
  return ok ? { R, s, h, e, h2, tip, hD, aD } : null
}
export type StarDims = NonNullable<ReturnType<typeof starDims>>

/**
 * The star at c: two squares (one square to the axes, one turned 45°, both of half-size h) drawn as straps s wide.
 * The cut-outs: the eight points (each a triangle of one square beyond the other's side), and inside the octagon that
 * is in both squares a smaller star of the same make and eight kites between its points, the straps between them
 * running along the rays through the points. Each piece sits on its own axis, so the star is a mirror image about
 * every line through c at a multiple of 22.5°.
 */
function starPieces(c: P2, d: StarDims, tag: string): Piece[] {
  const { R, h, e, h2 } = d, N = (k: number) => dirOf(k * Q8), out: Piece[] = []
  out.push(piece(starPts(c, 8, (h2 - e) * Math.SQRT2, (h2 - e) / Math.cos(Math.PI / 8), 0), c, `${tag}s`))
  for (let k = 0; k < 8; k++) {
    const tri = clipConvex(c, 2 * R, [[neg(N(k - 1)), -(h - e)], [neg(N(k + 1)), -(h - e)], [N(k), h + e]])
    if (tri.length >= 3) out.push(polyPiece(tri, `${tag}t${k}`, add(c, (h + e + R - e * Math.SQRT2) / 2, k * Q8)))
    const kite = clipConvex(c, 2 * R, [[N(k), h2 + e], [N(k + 1), h2 + e], [neg(N(k)), -(h - e)], [neg(N(k + 1)), -(h - e)], [dirOf(k * Q8 + Math.PI / 2), e], [dirOf((k + 1) * Q8 - Math.PI / 2), e]])
    if (kite.length >= 3) out.push(polyPiece(kite, `${tag}k${k}`, add(c, (h2 + h) / 2 / Math.cos(Math.PI / 8), (k + 0.5) * Q8)))
  }
  return out.filter(cuttable)
}

/**
 * The corner star on the line u = v through c (the mitre, or the board's diagonal): its pieces on this strip's side,
 * those across the line cut `web` short of it (kept when still big enough), so a bar 2·web wide runs along it.
 */
function starOnMitre(c: P2, d: StarDims, web: number, tag: string): Piece[] {
  const n = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, side = (q: P2) => dot(n, { x: q.x - c.x, y: q.y - c.y })
  const out: Piece[] = []
  for (const pc of starPieces(c, d, tag)) {
    const lo = Math.min(...pc.poly.map(side)), hi = Math.max(...pc.poly.map(side))
    if (lo >= web - 1e-9) { out.push(pc); continue }
    if (hi <= web) continue
    // the half beyond web: a big square cut to that side, and the piece (the inner star is not convex) clipped to it
    const box = clipHalf([{ x: c.x - 4 * d.R, y: c.y - 4 * d.R }, { x: c.x + 4 * d.R, y: c.y - 4 * d.R }, { x: c.x + 4 * d.R, y: c.y + 4 * d.R }, { x: c.x - 4 * d.R, y: c.y + 4 * d.R }], n, web + dot(n, c))
    for (const cut of clipPoly(ccw(pc.poly), ccw(box), true) ?? []) if (clipOk(cut)) out.push(polyPiece(cut, pc.key))
  }
  return out
}

/**
 * The cross between two stars p apart (the khatam's cross): a square of half-size a round c with a notch in each
 * side, the notches' sides parallel to the neighbouring stars' points and a strap from them (xn from c to a notch's
 * bottom), the same notch over and under.
 */
function khatamCross(c: P2, a: number, xn: number): P2[] {
  const out: P2[] = [], g = a - xn
  for (let k = 0; k < 4; k++) {
    const ax = dirOf((k * Math.PI) / 2), ay = dirOf((k * Math.PI) / 2 + Math.PI / 2), at = (u: number, v: number) => ({ x: c.x + u * ax.x + v * ay.x, y: c.y + u * ax.y + v * ay.y })
    out.push(at(a, -a), ...(g > 1e-6 ? [at(a, -g), at(xn, 0), at(a, g)] : []))
  }
  return out
}

/**
 * The shapes between two stars (centres p apart) in a band 2H wide, in coordinates from the waist and the band's
 * centre line: diamonds along both edges (over the waist, a quarter step either side, and over each star), the
 * khatam's cross at the waist, and a diamond in the notch over and under it. Each set is shrunk until it keeps `web`
 * from the stars, the band's edges and the sets before it, or left out.
 */
export function waistUnit2(p: number, H: number, d: StarDims, web: number, caps?: Record<string, number>): Unit {
  const stars = [...starPieces({ x: -p / 2, y: 0 }, d, 'A'), ...starPieces({ x: p / 2, y: 0 }, d, 'B')]
  const placed: Piece[] = []
  const fits = (set: Piece[]) => set.every(pc => pc.poly.every(q => Math.abs(q.y) <= H + 1e-6) && stars.every(o => clear(pc.poly, o.poly, web)) && placed.every(o => clear(pc.poly, o.poly, web)))
    && set.every((a, i) => set.every((b, j) => j <= i || clear(a.poly, b.poly, web)))
  const { tryAdd, unit } = unitAdder(placed, fits, caps)
  const both = (f: (sy: number) => Piece[]) => [...f(-1), ...f(1)]
  const { hD, aD, R, h, e } = d
  const edge = (js: number[], tag: string) => (s: number) => both(sy => js.map(j => { const c = { x: (j * p) / 4, y: sy * (H - hD * s) }; return polyPiece(diamond(c, aD * s, hD * s), `${tag}${sy}${j}`, c) }))
  tryAdd('e', edge([-1, 0, 1], 'e'))
  tryAdd('f', edge([2], 'f')) // over the star: in each unit only on its right, so the next unit does not repeat it
  // the cross: its notches a strap off the stars' points; as wide as the stars' corner points allow
  const xn = p / 2 - R - e * Math.SQRT2, a0 = Math.min(p / 2 - (h - e) - web, H - 2 * hD - 2 * web)
  let top = 0
  if (xn >= 2 && a0 - xn >= 4) {
    const s = tryAdd('x', s => { const a = xn + (a0 - xn) * s; return [polyPiece(khatamCross({ x: 0, y: 0 }, a, xn), 'x', { x: 0, y: 0 })] }, 0.3)
    if (s) top = xn
  }
  // a diamond in the notch over and under the cross (a square turned 45°, its lower sides a strap off the notch's)
  const y0 = (top || 0) + 2 * e * Math.SQRT2, room = H - 2 * hD - web - y0
  if (room > 6) tryAdd('y', s => both(sy => { const hq = (room / 2) * s, c = { x: 0, y: sy * (y0 + hq) }; return [polyPiece(diamond(c, hq, hq), `y${sy}`, c)] }), 0.3)
  return unit()
}

// ------------------------------------------------------------------ the frame's layout

/** The rosettes' ring radius and their step, of the pattern's width (the picture: rings nearly touching, filling the band). */
export const ROSE = { R: 0.38, p: 0.9 }
/** The least room between two rings of the band (of its pattern width): the picture's, near enough. */
export const WAIST = 0.12

/** Everything the pieces are sized on; shared by the build and the tests. */
export function frameGeom(p: Record<string, number>) {
  const kind = pick(p.kind ?? 1, 1, 2), style = pick(p.style ?? 1, 1, 2), center = pick(p.center, 1, 3)
  // the field panel of the strips (kind 2 with the medallion's board)
  const field = kind === 2 && center === 1
  const { ov, band: b, web, fit } = p
  const sizeIs = pick(p.sizeIs ?? 1, 1, 2), PW = sizeIs === 2 ? p.PW + 2 * b : p.PW, PH = sizeIs === 2 ? p.PH + 2 * b : p.PH
  // the band's straps, thicker in a wide band (the motif grows with it)
  const sw = Math.max(web, Math.round(STRAP * (b - ov) * 10) / 10)
  // with the field panel, the strip keeps a solid rail along its inner edge for the glue strip behind the joint
  const rail = field ? CLEAT_REACH + web : sw
  const v0 = ov + sw, v1 = b - rail, Wp = v1 - v0, H = Wp / 2, vc = (v0 + v1) / 2
  const M = style === 1 ? ROSE : STAR, R0 = M.R * Wp
  const dims0 = style === 1 && Wp > 0 ? rosetteDims(R0, sw) : null
  const sdims = style === 2 && Wp > 0 ? starDims(R0, H, sw) : null
  const p0 = M.p * Wp, pHard = style === 1 ? 2 * R0 + 2 * sw : 2 * R0 + sw
  const S1 = PW - 2 * vc, S2 = PH - 2 * vc
  // the middle strip: across the window from one long strip to the other (wide: the top and bottom ones are long)
  const mid = (p.mid ?? 0) >= 0.5, wide = PW >= PH
  // a whole number of steps between the corner motifs on each strip, the two steps as close to each other (the
  // corners are mirror images) and to the picture's step as they can be; with the middle strip, an even number on
  // the long strips (a motif on its axis) when there is one
  let best: { n1: number; n2: number; score: number } | null = null
  const ns = (S: number) => { const out: number[] = []; for (let k = Math.max(1, Math.floor(S / (1.6 * p0))); k <= Math.max(1, Math.ceil(S / (0.7 * p0))) && k < 400; k++) if (S / k >= pHard) out.push(k); return out }
  if ((dims0 || sdims) && S1 > 0 && S2 > 0) for (const n1 of ns(S1)) for (const n2 of ns(S2)) {
    const a = S1 / n1, c = S2 / n2, odd = mid && (wide ? n1 : n2) % 2 === 1
    const score = Math.abs(Math.log(a / p0)) + Math.abs(Math.log(c / p0)) + 3 * Math.abs(Math.log(a / c)) + (odd ? 100 : 0)
    if (!best || score < best.score - 1e-12) best = { n1, n2, score }
  }
  const n1 = best?.n1 ?? 0, n2 = best?.n2 ?? 0
  const p1 = n1 ? S1 / n1 : 0, p2 = n2 ? S2 / n2 : 0
  // a tight step (as the middle strip's even count makes) shrinks the rosettes, all alike, so each waist keeps
  // WAIST · Wp between two rings for its shapes (left as they are when the smaller ones could not be cut)
  const Rw = n1 && n2 ? (Math.min(p1, p2) - WAIST * Wp) / 2 : R0, dimsW = style === 1 && Rw < R0 ? rosetteDims(Rw, sw) : null
  const R = dimsW ? Rw : R0, dims = dimsW ?? dims0
  // the middle strip's width, length, pattern (its own half width Hm, the band's motif) and steps: the short strips'
  // count, or fewer when its first motif would not clear the joint by sw
  const midW = mid ? round3((p.midW ?? 0) > 0 ? p.midW : b - ov) : 0, Lm = mid ? round3((wide ? PH : PW) - 2 * b) : 0
  const Hm = midW / 2 - sw, Ss = wide ? S2 : S1, nShort = wide ? n2 : n1
  const mdims = mid && style === 2 && Hm > 0 && R > 0 ? starDims(R, Hm, sw) : null
  let nm = 0
  if (mid && Hm >= R && (style === 1 ? dims : mdims)) for (let k = nShort; k >= 1; k--) { const q = Ss / k; if (k === 1 || (q >= pHard && vc + q - R >= b + sw - 1e-9)) { nm = k; break } }
  const qm = nm ? Ss / nm : 0
  // the field inside the band: the board's middle (kind 1) or the field panel (kind 2), and its solid margin
  const Wf = kind === 1 ? round3(PW - 2 * b) : round3(PW - 2 * b - 2 * fit), Hf = kind === 1 ? round3(PH - 2 * b) : round3(PH - 2 * b - 2 * fit)
  // (on the board a solid line 3·web wide parts the band from the field, so the frame still reads as a frame)
  const fm = kind === 1 ? 2 * web : CLEAT_REACH + web
  const fill = (p.fill ?? 0) >= 0.5 && (kind === 1 || field)
  return { kind, style, center, field, fill, sizeIs, PW, PH, ov, b, web, sw, fit, rail, v0, v1, Wp, H, vc, R, dims, sdims, p0, pHard, S1, S2, n1, n2, p1, p2, Wf, Hf, fm, mid, wide, midW, Lm, Hm, mdims, nm, qm }
}
export type FrameGeom = ReturnType<typeof frameGeom>

/** The trapezoid of a strip L long outside (u along the outer edge, v inward). */
export const stripOutline = (L: number, b: number): P2[] => [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L - b, y: b }, { x: b, y: b }]

/** The motif at c (a rosette or a star; with `mitre` the corner one on the line u = v through c). */
const motifAt = (g: FrameGeom, c: P2, mitre: boolean, tag: string): Piece[] =>
  g.style === 1 ? rosette(c, g.dims!, g.sw, mitre, tag) : mitre ? starOnMitre(c, g.sdims!, g.sw, tag) : starPieces(c, g.sdims!, tag)
/** The shapes between two motifs p apart. */
const unitOf = (g: FrameGeom, p: number, caps?: Record<string, number>): Unit => (g.style === 1 ? waistUnit(p, g.H, g.R, g.sw, caps) : waistUnit2(p, g.H, g.sdims!, g.sw, caps))
/**
 * The units at a corner for the two steps meeting there: each set at the smaller of its two scales, so both strips carry
 * it alike (worked out again until both take every set at the same scale).
 */
function cornerUnits(g: FrameGeom, p: number, pOther: number): [Unit, Unit] {
  let a = unitOf(g, p), b = unitOf(g, pOther)
  for (let k = 0; k < 4; k++) {
    const names = new Set([...Object.keys(a.scales), ...Object.keys(b.scales)])
    if ([...names].every(n => (a.scales[n] ?? 0) === (b.scales[n] ?? 0))) break
    const caps = Object.fromEntries([...names].map(n => [n, Math.min(a.scales[n] ?? 0, b.scales[n] ?? 0)]))
    a = unitOf(g, p, caps); b = unitOf(g, pOther, caps)
  }
  return [a, b]
}

/**
 * The pattern of a strip L long whose step is p (the strips it meets at its corners step pOther): the first half
 * (corner motif, motifs, the shapes between them), kept only where they clear both mitres by `web` — near the
 * corner for both steps, so the two strips meeting there drop the same shapes — and mirrored onto the second half.
 */
export function stripPieces(g: FrameGeom, L: number, p: number, pOther: number): Piece[] {
  return mirrorHalf(stripHalf(g, L, p, pOther), L / 2)
}

function stripHalf(g: FrameGeom, L: number, p: number, pOther: number): Piece[] {
  const { vc } = g
  const n = Math.round((L - 2 * vc) / p), mid = L / 2, eps = 1e-6
  const half: Piece[] = []
  const take = (pc: Piece) => { if (pc.c.x <= mid + eps) half.push(pc) }
  for (const pc of motifAt(g, { x: vc, y: vc }, true, 'C')) take(pc)
  for (let i = 1; i < n; i++) for (const pc of motifAt(g, { x: vc + i * p, y: vc }, false, `r${i}`)) take(pc)
  const unit = unitOf(g, p), [corner, other] = cornerUnits(g, p, pOther)
  for (let i = -1; i < n; i++) {
    const w = vc + (i + 0.5) * p
    if (w - p / 2 > mid + eps) break
    for (const pc0 of i <= 0 ? corner : unit) {
      const pc = movePc(pc0, w, vc)
      if (pc.c.x > mid + eps || !inStrip(g, pc, L)) continue
      if (i <= 0) {
        // the same shape on the strip across the corner (its own step) must clear the mitre too
        const o = other.find(q => q.key === pc0.key)
        if (!o || !inStrip(g, movePc(o, vc + (i + 0.5) * pOther, vc), Infinity)) continue
      }
      half.push(pc)
    }
  }
  return half
}

/** Clear of both mitres by `web`, and inside the pattern's band. */
const inStrip = (g: FrameGeom, pc: Piece, L: number) => pc.poly.every(q => q.x - q.y >= g.sw * Math.SQRT2 - 1e-6 && L - q.x - q.y >= g.sw * Math.SQRT2 - 1e-6 && q.y >= g.v0 - 1e-6 && q.y <= g.v1 + 1e-6)

/** The first half and its mirror image in the strip's middle (a shape on the middle is its own mirror). */
function mirrorHalf(half: Piece[], mid: number): Piece[] {
  const out = [...half]
  for (const pc of half) if (pc.c.x < mid - 1e-6) out.push({ pts: mirrored(pc.pts, mid), poly: pc.poly.map(q => ({ x: 2 * mid - q.x, y: q.y })), c: { x: 2 * mid - pc.c.x, y: pc.c.y }, key: pc.key })
  return out
}

/**
 * Both strips' patterns. Round each corner rosette (style 1), toward the outer and the inner corner, a kite each side
 * of the mitre (`CORNER_KITE` off it) stands in for the kites the mitre took: shrunk until it clears both strips'
 * shapes, or left out — the same on both strips, so the corner stays a mirror image.
 */
export function framePieces(g: FrameGeom): { top: Piece[]; side: Piece[] } {
  return memo(FRAMES, [g.style, g.PW, g.PH, g.ov, g.b, g.web, g.sw, g.rail, g.n1, g.n2].join('|'), () => framePiecesOf(g))
}
function framePiecesOf(g: FrameGeom): { top: Piece[]; side: Piece[] } {
  const ht = stripHalf(g, g.PW, g.p1, g.p2), hs = stripHalf(g, g.PH, g.p2, g.p1)
  if (g.style === 1) {
    const { vc, H, R, sw: web } = g, c0 = { x: vc, y: vc }
    const aK = 0.11 * H, wK = 0.045 * H, rK = R + web + wK + 0.6 * web
    // both whole strips (on a short strip the far half and the far corner's kites come close too)
    const ft = mirrorHalf(ht, g.PW / 2), fs = mirrorHalf(hs, g.PH / 2), Lmin = Math.min(g.PW, g.PH)
    const twin = (pc: P2[], L: number) => pc.map(q => ({ x: L - q.x, y: q.y }))
    const kites: Piece[] = []
    for (const ang of [-3 * Math.PI / 4 + CORNER_KITE, Math.PI / 4 - CORNER_KITE]) {
      for (let s = 1; s >= 0.5 - 1e-9; s -= 0.05) {
        const cc = add(c0, rK - wK * (1 - s), ang), pc = piece(lens(cc, ang + Math.PI / 2, aK * s, wK * s), cc, `K${ang > 0 ? 1 : -1}`)
        if (!cuttable(pc)) break
        if (!inStrip(g, pc, Lmin) || pc.poly.some((q, i) => segPt(c0, q, pc.poly[(i + 1) % pc.poly.length]) < R + web - 1e-6)) continue
        const clearOf = (o: P2[]) => clear(pc.poly, o, web)
        if (ft.every(o => clearOf(o.poly)) && fs.every(o => clearOf(o.poly)) && [g.PW, g.PH].every(L => clearOf(twin(pc.poly, L)))
          && kites.every(o => clearOf(o.poly) && [g.PW, g.PH].every(L => clearOf(twin(o.poly, L))))) { kites.push(pc); break }
      }
    }
    ht.push(...kites); hs.push(...kites)
  }
  return { top: mirrorHalf(ht, g.PW / 2), side: mirrorHalf(hs, g.PH / 2) }
}
/** How far round the corner rosette from the mitre its corner kites sit (radians). */
const CORNER_KITE = (17 * Math.PI) / 180

/** Strip coordinates → frame coordinates for the strip on side s (0 top, 1 right, 2 bottom, 3 left). */
export function toFrame(g: { PW: number; PH: number }, s: number, q: P2): P2 {
  return s === 0 ? { x: q.x, y: q.y } : s === 1 ? { x: g.PW - q.y, y: q.x } : s === 2 ? { x: g.PW - q.x, y: g.PH - q.y } : { x: q.y, y: g.PH - q.x }
}
/** A strip's piece in frame coordinates (turning keeps a loop's sense, so its arcs keep their bulges). */
function pieceToFrame(g: { PW: number; PH: number }, s: number, pc: Piece): Piece {
  return { pts: pc.pts.map(v => ({ ...v, ...toFrame(g, s, v) })), poly: pc.poly.map(q => toFrame(g, s, q)), c: toFrame(g, s, pc.c), key: pc.key }
}

/**
 * The middle strip's pattern in its own coordinates (u along it from the window's edge, v across): the column of
 * motifs from the long strip's motif on its axis (u = vc − b) to the opposite one, nm steps of qm, with the shapes
 * between them; only what clears the strip's edges and both joints by sw is kept, so each joint runs through a solid
 * bar 2·sw wide (the long strip's pattern stops sw short of its inner edge). Symmetric about both its centre lines.
 */
export function midPieces(g: FrameGeom): Piece[] {
  if (!g.mid || !g.nm) return []
  return memo(MIDS, [g.style, g.b, g.ov, g.sw, g.midW, g.Lm, g.vc, g.R, g.nm, g.qm].join('|'), () => {
    const { b, vc, sw, midW, Lm, nm, qm } = g, gm: FrameGeom = { ...g, H: g.Hm, sdims: g.style === 2 ? g.mdims : g.sdims }
    const c0 = vc - b, yc = midW / 2, out: Piece[] = []
    const keep = (pc: Piece) => pc.poly.every(q => q.x >= sw - 1e-6 && q.x <= Lm - sw + 1e-6 && q.y >= sw - 1e-6 && q.y <= midW - sw + 1e-6)
    for (let j = 1; j < nm; j++) for (const pc of motifAt(gm, { x: c0 + j * qm, y: yc }, false, `m${j}`)) if (keep(pc)) out.push(pc)
    const unit = unitOf(gm, qm)
    for (let j = 0; j < nm; j++) for (const pc0 of unit) { const pc = movePc(pc0, c0 + (j + 0.5) * qm, yc); if (keep(pc)) out.push(pc) }
    return out
  })
}
/** Middle strip coordinates → frame coordinates (a turn by 90° when it runs down a wide frame: arcs keep their bulges). */
export function midToFrame(g: { PW: number; PH: number; b: number; midW: number; wide: boolean }, q: P2): P2 {
  return g.wide ? { x: g.PW / 2 + g.midW / 2 - q.y, y: g.b + q.x } : { x: g.b + q.x, y: g.PH / 2 - g.midW / 2 + q.y }
}
const midPieceToFrame = (g: FrameGeom, pc: Piece): Piece => ({ pts: pc.pts.map(v => ({ ...v, ...midToFrame(g, v) })), poly: pc.poly.map(q => midToFrame(g, q)), c: midToFrame(g, pc.c), key: pc.key })

/** The narrowest visible band that still holds a motif: its pattern width Wp (searched on a half-millimetre step). */
export function minPatternWidth(web: number, style = 1): number {
  for (let w = 20; w < 400; w += 0.5) if (style === 1 ? rosetteDims(ROSE.R * w, web) : starDims(STAR.R * w, w / 2, web)) return w
  return 400
}

// ------------------------------------------------------------------ the octagon medallion (style 1)

/** The medallion's measures for an octagon `med` across flats. */
export function medDims(med: number, web: number) {
  const A = med / 2, s = Math.max(web, 0.018 * med), sb = Math.max(s, 0.05 * A), tt = 0.08 * A
  return { A, s, sb, tt, aOut: A - sb, aIn: A - sb - tt, Az: A - sb - tt - s }
}

/**
 * The medallion's cut-outs round c (the wood is the network of straps `s` wide between them): a 16-point star in the
 * middle, 16 long kites radiating from it, small stars between the kites' tips, round cells beyond the tips and
 * between them, small stars toward the octagon's corners, and a ring of 16 trapezoids inside the octagon's solid
 * border. Each ring is shrunk until it keeps `s` from the rest and stays inside the octagon, or left out.
 */
export function medallion(c: P2, med: number, web: number): Piece[] {
  const m = medDims(med, web), { A, s, aOut, aIn, Az } = m, out: Piece[] = [], Q = Math.PI / 8, q = Math.PI / 16
  const N = Array.from({ length: 8 }, (_, k) => dirOf((k * Math.PI) / 4))
  const inZone = (pc: Piece, lim: number) => pc.poly.every(z => N.every(nv => dot(nv, { x: z.x - c.x, y: z.y - c.y }) <= lim + 1e-6))
  const good = (pts: P2[]) => pts.length >= 3 && widthOf(pts) >= MIN_W && areaAbs(pts) >= MIN_A
  const poly = (pts: P2[], key: string): Piece => piece(pts, pts.reduce((a, z) => ({ x: a.x + z.x / pts.length, y: a.y + z.y / pts.length }), { x: 0, y: 0 }), key)
  // the trapezoids: each side in two, between the side's middle and the octagon's corners
  for (let k = 0; k < 8; k++) for (const h of [-1, 1]) {
    const nu = (k * Math.PI) / 4, Nn = dirOf(nu), T = dirOf(nu + Math.PI / 2), beta = nu + h * Q
    const pts = clipConvex(c, 2 * A, [[Nn, aIn], [{ x: -Nn.x, y: -Nn.y }, -aOut], [{ x: T.x * h, y: T.y * h }, s / 2], [dirOf(beta - h * Math.PI / 2), s / 2]])
    if (good(pts)) out.push(poly(pts, `t${k}${h}`))
  }
  // the star (its points along the straps between the kites) and the kites
  const rs = 0.13 * A, rv = 0.62 * rs, rc = MED.tip * A, tau = (MED.tau * Math.PI) / 180
  const star = starPts(c, 16, rs, rv, q)
  if (rv >= s && inZone(piece(star, c, 's'), Az)) out.push(piece(star, c, 'star'))
  const kites: Piece[] = []
  for (let k = 0; k < 16; k++) {
    const phi = k * 2 * q, V = add(c, rv, phi), hs: [P2, number][] = []
    for (const h of [-1, 1]) {
      hs.push([dirOf(phi + h * q - h * Math.PI / 2), s / 2]) // the strap along the ray at phi ± π/16
      const P = add(c, rs, phi + h * q), e = { x: P.x - V.x, y: P.y - V.y }, l = Math.hypot(e.x, e.y)
      let nv = { x: -e.y / l, y: e.x / l }
      if (dot(nv, { x: V.x - c.x, y: V.y - c.y }) < 0) nv = { x: -nv.x, y: -nv.y }
      hs.push([nv, dot(nv, { x: V.x - c.x, y: V.y - c.y }) + s]) // s beyond the star's edge
      const mv = dirOf(phi + h * (Math.PI / 2 - tau))
      hs.push([{ x: -mv.x, y: -mv.y }, -rc * Math.cos(Math.PI / 2 - tau)]) // the tip
    }
    const pts = clipConvex(c, 2 * A, hs)
    if (good(pts)) kites.push(poly(pts, `k${k}`))
  }
  if (kites.length === 16 && kites.every(pc => inZone(pc, Az))) out.push(...kites)
  // the rings beyond the kites, each shrunk to fit
  const fitRing = (make: (k: number, sc: number) => Piece | null, ks: number[]) => {
    for (let sc = 1; sc >= 0.45 - 1e-9; sc -= 0.05) {
      const set = ks.map(k => make(k, sc)).filter((x): x is Piece => !!x)
      if (set.length !== ks.length) continue
      if (set.every(pc => inZone(pc, Az) && out.every(o => clear(pc.poly, o.poly, s))) && set.every((a, i) => set.every((b2, j) => j <= i || clear(a.poly, b2.poly, s)))) { out.push(...set); return }
    }
  }
  const all = Array.from({ length: 16 }, (_, k) => k), even = all.filter(k => k % 2 === 0), odd = all.filter(k => k % 2 === 1)
  const ro = MED.rB * A
  fitRing((k, sc) => { const cc = add(c, MED.dB * A, (2 * k + 1) * q); return piece(starPts(cc, 8, ro * sc, 0.55 * ro * sc, (2 * k + 1) * q), cc, `b${k}`) }, all)
  const rC = MED.rC * A, dC = rc + s + rC
  fitRing((k, sc) => { const cc = add(c, dC, 2 * k * q); return piece(circ(cc, rC * sc), cc, `cc${k}`) }, all)
  const rD = MED.rD * A
  fitRing((k, sc) => { const cc = add(c, MED.dD * A, (2 * k + 1) * q); return piece(circ(cc, rD * sc), cc, `d${k}`) }, all)
  // toward the octagon's corners (the kites at odd k point at them) and its sides (even k)
  const rE = MED.rE * A
  fitRing((k, sc) => { const cc = add(c, Az / Math.cos(Q) - rE * 1.6, 2 * k * q); return piece(starPts(cc, 8, rE * sc, 0.55 * rE * sc, 2 * k * q), cc, `e${k}`) }, odd)
  fitRing((k, sc) => { const cc = add(c, Az - rE * 1.1, 2 * k * q); return piece(circ(cc, rE * 0.8 * sc), cc, `f${k}`) }, even)
  return out
}

/** The medallion's proportions (of the apothem): the kites' tip and tip angle, and the rings' sizes and radii. */
const MED = { tip: 0.6, tau: 42, rB: 0.065, dB: 0.6, rC: 0.06, rD: 0.055, dD: 0.77, rE: 0.05 }

/** The octagon outline, `med` across flats (flat sides top, bottom, left and right). */
export const octagon = (c: P2, med: number): P2[] => Array.from({ length: 8 }, (_, k) => add(c, med / 2 / Math.cos(Math.PI / 8), Math.PI / 8 + (k * Math.PI) / 4))

// ------------------------------------------------------------------ the round medallion (style 2)

/** The round medallion's measures for a diameter med: straps s, the solid outer circle sb, the ring of arcs. */
export function medDims2(med: number, web: number) {
  const A = med / 2, s = Math.max(web, 0.018 * med), sb = Math.max(s, 0.05 * A), tA = Math.max(3, 0.06 * A)
  return { A, s, sb, tA, rO1: A - sb, rO0: A - sb - tA }
}
/** Its proportions (of the radius): the star's points and inner corners, the kites' tips and tip angle. */
const MED2 = { rs: 0.19, rv: 0.62, tip: 0.66, tau: 36 }

/**
 * The round medallion's cut-outs round c (the wood is the straps s wide between them and a solid outer circle): a
 * 12-point star in the middle, 12 kites radiating from it between straps along the rays through the star's points,
 * a ring of 12 cells (each between two kites' tips, out to a circle a strap inside the arcs), and a ring of 24 arcs
 * inside the outer circle, bridged on every strap. One sector is drawn and turned twelve times. A ring whose pieces
 * would be too small to cut is left out.
 */
export function medallion2(c: P2, med: number, web: number): Piece[] {
  const { A, s, rO0, rO1 } = medDims2(med, web), q = Math.PI / 12, tau = (MED2.tau * Math.PI) / 180, out: Piece[] = []
  const ok = (pts: P2[]) => pts.length >= 3 && cuttable(polyPiece(pts, ''))
  const turned = (pc: Piece, k: number) => turnPc(pc, c, 2 * k * q, `${pc.key}${k}`)
  const rs = MED2.rs * A, rv = MED2.rv * rs, rK = MED2.tip * A
  const star = starPts(c, 12, rs, rv, q)
  if (rv >= s + 1 && ok(star)) out.push(piece(star, c, 'star'))
  // the tip lines of the kite on the axis at angle phi: m(h)·(z − c) ≤ rK·sin τ
  const tipN = (phi: number, h: number) => dirOf(phi + h * (Math.PI / 2 - tau))
  // the kite on the axis at angle 0
  const hk: [P2, number][] = []
  for (const h of [-1, 1]) {
    hk.push([dirOf(h * q - (h * Math.PI) / 2), s / 2]) // the strap along the ray at ±15°
    const V = add(c, rv, 0), P = add(c, rs, h * q), e = { x: P.x - V.x, y: P.y - V.y }, l = Math.hypot(e.x, e.y)
    let nv = { x: -e.y / l, y: e.x / l }
    if (dot(nv, { x: V.x - c.x, y: V.y - c.y }) < 0) nv = neg(nv)
    hk.push([nv, dot(nv, { x: V.x - c.x, y: V.y - c.y }) + s]) // s beyond the star's edge
    hk.push([neg(tipN(0, h)), -rK * Math.sin(tau)])
  }
  const kite = clipConvex(c, 2 * A, hk)
  const kitesOk = ok(kite) && kite.every(z => Math.hypot(z.x - c.x, z.y - c.y) <= rO0 - s)
  if (kitesOk) for (let k = 0; k < 12; k++) out.push(turned(polyPiece(kite, 'k', add(c, rK / 2, 0)), k))
  // the cell between the kites on the axes at 0 and 30°: beyond both their tips, between the straps on those axes,
  // inside two chords that touch the circle a strap inside the arcs
  const cell = clipConvex(c, 2 * A, [
    [tipN(0, 1), rK * Math.sin(tau) + s], [tipN(2 * q, -1), rK * Math.sin(tau) + s],
    [dirOf(Math.PI / 2), s / 2], [dirOf(2 * q - Math.PI / 2), s / 2],
    [neg(dirOf(q / 2)), -(rO0 - s) * Math.cos(q / 2)], [neg(dirOf((3 * q) / 2)), -(rO0 - s) * Math.cos(q / 2)],
  ])
  if (kitesOk && ok(cell)) for (let k = 0; k < 12; k++) out.push(turned(polyPiece(cell, 'c', add(c, (rK + rO0) / 2, q)), k))
  // the arcs: two to a sector, bridged s wide (at their inner edge) on the axes and on the rays
  const dB = Math.asin(Math.min(1, s / 2 / rO0))
  if ((q - 2 * dB) * rO0 >= 3 && rO1 - rO0 >= MIN_W) for (let j = 0; j < 24; j++) {
    const a0 = j * q + dB, a1 = (j + 1) * q - dB
    out.push(piece(ringPiece(c, rO0, rO1, a0, a1), add(c, (rO0 + rO1) / 2, (j + 0.5) * q), `a${j}`))
  }
  return out
}

/** The medallion's outline (style 1 an octagon `med` across flats, style 2 a circle `med` across) moved out by `grow`, as a polygon that holds it. */
function medOutline(style: number, c: P2, med: number, grow: number): P2[] {
  if (style === 1) return octagon(c, med + 2 * grow)
  const n = 48, r = (med / 2 + grow) / Math.cos(Math.PI / n)
  return Array.from({ length: n }, (_, k) => add(c, r, (k * 2 * Math.PI) / n))
}
/** The medallion's pieces for the style. */
function medPieces(style: number, c: P2, med: number, web: number): Piece[] {
  const o = { x: 0, y: 0 }, pcs = memo(MEDS, [style, med, web].join('|'), () => (style === 1 ? medallion(o, med, web) : medallion2(o, med, web)))
  return pcs.map(pc => movePc(pc, c.x, c.y))
}

// ------------------------------------------------------------------ the field's lattice

/** The lattice rosettes' ring radius, of the cell (their rings nearly touch their diagonal neighbours, as in the band). */
export const LAT = { R: 0.594, sk: 0.12 }
/** The lattice star's measures (style 2): tips at cell/√2, so neighbouring stars meet tip to tip across the diagonal. */
const latStar = (fc: number, web: number) => starDims(fc * Math.SQRT1_2, fc, web, LAT.sk)
/** The lattice rosette's measures (style 1). */
const latRose = (fc: number, web: number) => rosetteDims(LAT.R * fc, web)

/**
 * The shapes between four lattice rosettes (rings of outer radius R a cell away along the axes) round c: a small
 * 8-point star, and four almonds along the diagonals into the gaps between the rings, each a half web short of the
 * gap's middle (where the next filler's almond comes from the other side). Each set shrinks until it keeps `web`.
 */
function fillerSet(c: P2, fc: number, R: number, web: number, tag: string): Piece[] {
  const rings = [0, 1, 2, 3].map(k => sample(circ(add(c, fc, (k * Math.PI) / 2), R)))
  const free = fc - R - web, placed: Piece[] = []
  const fits = (set: Piece[]) => set.every(pc => rings.every(r => clear(pc.poly, r, web)) && placed.every(o => clear(pc.poly, o.poly, web)))
  const rs = 0.62 * free
  for (let s = 1; s >= 0.4 - 1e-9; s -= 0.05) {
    const st = piece(starPts(c, 8, rs * s, 0.52 * rs * s, Math.PI / 8), c, `${tag}s`)
    if (!cuttable(st)) break
    if (fits([st])) { placed.push(st); break }
  }
  const r0 = (placed.length ? Math.max(...placed[0].poly.map(q => Math.hypot(q.x - c.x, q.y - c.y))) : 0) + web, r1 = fc * Math.SQRT1_2 - web / 2
  for (let s = 1; s >= 0.3 - 1e-9; s -= 0.05) {
    const a = (r1 - r0) / 2, w = 0.3 * a * s, set = [1, 3, 5, 7].map(k => { const cc = add(c, (r0 + r1) / 2, (k * Math.PI) / 4); return piece(lens(cc, (k * Math.PI) / 4, a, w), cc, `${tag}a${k}`) })
    if (a < 3 || !set.every(cuttable)) break
    if (fits(set)) { placed.push(...set); break }
  }
  return placed
}

/** The cross between four lattice stars (style 2): the square cell less the four stars' points, a half strap in. */
function crossTile(c: P2, fc: number, d: StarDims, key: string): Piece | null {
  const a = fc / 2, t = fc * (1 - Math.SQRT1_2), g = a - t // the stars' tips reach t from c; the notches are g wide each side
  const raw: P2[] = []
  for (let k = 0; k < 4; k++) {
    const ax = dirOf((k * Math.PI) / 2), ay = dirOf((k * Math.PI) / 2 + Math.PI / 2), at = (u: number, v: number) => ({ x: c.x + u * ax.x + v * ay.x, y: c.y + u * ax.y + v * ay.y })
    raw.push(at(a, -a), at(a, -g), at(t, 0), at(a, g))
  }
  const ins = insetPoly(ccw(raw), d.s / 2)
  if (!ins) return null
  const pc = polyPiece(ins, key, c)
  return cuttable(pc) ? pc : null
}

/** The two motifs of the lattice round 0 (on the cells whose i + j is even, and odd), or null when they cannot be cut. */
function latticeMotifs(style: number, fc: number, web: number): { even: Piece[]; odd: Piece[] } | null {
  const o = { x: 0, y: 0 }
  if (style === 1) {
    const d = latRose(fc, web)
    if (!d) return null
    const odd = fillerSet(o, fc, d.R, web, 'f')
    return odd.length ? { even: rosette(o, d, web, false, 'r'), odd } : null
  }
  const d = latStar(fc, web), x = d && crossTile(o, fc, d, 'x')
  return d && x ? { even: starPieces(o, d, 's'), odd: [x] } : null
}

/** The smallest lattice cell (searched on a half-millimetre step) whose motifs can be cut, for the style. */
export function minCell(style: number, web: number): number {
  for (let fc = 20; fc < 400; fc += 0.5) if (latticeMotifs(style, fc, web)) return fc
  return 400
}

/**
 * The lattice filling a field W × H centred on 0: style 1 rosettes on the cells whose i + j is even and fillers on
 * the others, style 2 stars and crosses the same way, so it is centred on the medallion and a mirror image about both
 * centre lines. It keeps `margin` from the field's edges and `web` outside `keepOut` (the medallion's outline); a
 * shape across those lines is clipped to them, and kept only where still fit to cut. Worked out on one quarter and
 * mirrored onto the others.
 */
export function fieldLattice(style: number, W: number, H: number, margin: number, fc: number, web: number, keepOut: P2[] | null): Piece[] {
  const X = W / 2 - margin, Y = H / 2 - margin, motifs = latticeMotifs(style, fc, web)
  if (X <= MIN_W || Y <= MIN_W || !motifs) return []
  const rect: P2[] = [{ x: -X, y: -Y }, { x: X, y: -Y }, { x: X, y: Y }, { x: -X, y: Y }]
  const Q = keepOut ? ccw(keepOut) : null
  const qr = Q ? Math.max(...Q.map(z => Math.hypot(z.x, z.y))) : 0, qin = Q ? Math.min(...Q.map((z, i) => segPt({ x: 0, y: 0 }, z, Q[(i + 1) % Q.length]))) : 0
  const quarter: Piece[] = []
  const keep = (pc: Piece) => {
    if (pc.c.x < -1e-6 || pc.c.y < -1e-6) return
    const b = bbOf(pc.poly)
    if (b.x0 > X || b.y0 > Y) return
    const inRect = b.x1 <= X + 1e-9 && b.y1 <= Y + 1e-9 && b.x0 >= -X - 1e-9 && b.y0 >= -Y - 1e-9
    let dMin = Infinity, dMax = 0
    if (Q) for (const z of pc.poly) { const r = Math.hypot(z.x, z.y); if (r < dMin) dMin = r; if (r > dMax) dMax = r }
    if (Q && dMax <= qin) return
    if (inRect && dMin >= qr) { quarter.push(pc); return }
    // across an edge or near the medallion: cut as straight lines, clipped
    const P = ccw(within(pc.pts))
    let parts: P2[][] | null = [P]
    if (!inRect) parts = clipAll(parts, rect, true)
    if (parts && Q && dMin < qr) parts = clipAll(parts, Q, false)
    if (!parts) return
    if (parts.length === 1 && parts[0] === P) { quarter.push(pc); return } // nothing was cut off
    // parts of one shape left too close to each other (a notch cut off near its bottom): the smaller goes, or both
    // when they are alike (mirror images of each other, so the field stays a mirror image)
    const ok = parts.filter(clipOk), area = ok.map(areaAbs), drop = new Set<number>()
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) if (!clear(ok[i], ok[j], web)) {
      if (area[i] > 1.01 * area[j]) drop.add(j)
      else if (area[j] > 1.01 * area[i]) drop.add(i)
      else { drop.add(i); drop.add(j) }
    }
    ok.forEach((pts, i) => { if (!drop.has(i)) quarter.push(polyPiece(pts, `${pc.key}~`, pc.c)) })
  }
  const nI = Math.ceil(X / fc) + 1, nJ = Math.ceil(Y / fc) + 1
  for (let i = 0; i <= nI; i++) for (let j = 0; j <= nJ; j++) for (const pc of (i + j) % 2 === 0 ? motifs.even : motifs.odd) keep(movePc(pc, i * fc, j * fc, `L${i}.${j}${pc.key}`))
  const half = [...quarter, ...quarter.filter(pc => pc.c.x > 1e-6).map(pc => flipPc(pc, true, false))]
  return [...half, ...half.filter(pc => pc.c.y > 1e-6).map(pc => flipPc(pc, false, true))]
}
/** Every part clipped (null when a clip fails: the shape is left out). */
function clipAll(parts: P2[][], Q: P2[], keep: boolean): P2[][] | null {
  const out: P2[][] = []
  for (const P of parts) { const r = clipPoly(P, Q, keep); if (!r) return null; out.push(...r) }
  return out
}

// ------------------------------------------------------------------ joining pieces (the strips)

/**
 * The plate glued behind a corner (corner coordinates: x along one outer edge, y along the other, the mitre y = x):
 * an L over the solid rim that rests on the gypsum, `w` wide and `arm` long, and an arm along the mitre over the solid
 * bar between the two halves of the corner motif, `2·h` wide, ending at e on the diagonal. Null when there is no room.
 */
export function cornerPlate(g: FrameGeom) {
  const w = round3(g.ov + g.sw - 1), arm = round3(Math.min(1.5 * g.b, Math.min(g.PW, g.PH) / 2 - 5)), h = g.sw - 1
  if (w < 6 || arm < w + 10) return null
  const r2 = Math.SQRT1_2, e = (g.field ? g.b - CLEAT_REACH - 1 : g.b - 1) - h * r2
  const pts: P2[] = [{ x: 0, y: 0 }, { x: arm, y: 0 }, { x: arm, y: w }]
  if (h >= 1.5 && e - h * r2 > w + h * Math.SQRT2 + 5) pts.push({ x: w + h * Math.SQRT2, y: w }, { x: e + h * r2, y: e - h * r2 }, { x: e - h * r2, y: e + h * r2 }, { x: w, y: w + h * Math.SQRT2 })
  else pts.push({ x: w, y: w })
  pts.push({ x: w, y: arm }, { x: 0, y: arm })
  return { w, arm, h, e, pts: pts.map(q => ({ x: round3(q.x), y: round3(q.y) })), diag: pts.length > 7 }
}

// ------------------------------------------------------------------ words

const countWord = (k: number, one: string, two: string, few: string, many: string) => (k === 1 ? one : k === 2 ? two : k <= 10 ? `${k} ${few}` : `${k} ${many}`)
const rosettesWord = (k: number) => countWord(k, 'وردة واحدة', 'وردتان', 'وردات', 'وردة')
const starsWord = (k: number) => countWord(k, 'نجمة واحدة', 'نجمتان', 'نجوم', 'نجمة')
const holesWord = (k: number) => countWord(k, 'فتحة واحدة', 'فتحتان', 'فتحات', 'فتحة')
const stripsWord = (k: number) => countWord(k, 'شريحة واحدة', 'شريحتان', 'شرائح', 'شريحة')
const quote = (s: string) => `«${s}»`

// ------------------------------------------------------------------ the checks

const holesOf = (pcs: Piece[], dx = 0, dy = 0): Loop[] => pcs.map(pc => polyLoop(rounded(moved(pc.pts, dx, dy)), 'hole'))
/** Do w × h fit the sheet one way or the other? */
const fitsSheet = (w: number, h: number, L: number, W: number) => (w <= L + 1e-9 && h <= W + 1e-9) || (w <= W + 1e-9 && h <= L + 1e-9)
/** The narrowest opening left inside the frame (mm), the widest band the field takes, the largest decor size. */
const MIN_OPEN = 60, BAND_MAX = 600, SIZE_MAX = 2440
/** The medallion's name for the style (with the article), and the motif the band is made of. */
const medName = (style: number) => (style === 1 ? 'المثمّن' : 'الدائرة')
const motifName = (style: number) => (style === 1 ? 'وردة' : 'نجمة')

/** The checks; every value they suggest clears its own error. */
export function frameErrors(p: Record<string, number>, g: FrameGeom): string[] {
  const errors: string[] = []
  const { PW, PH, ov, b, web, rail, fit, center, kind, style } = g, sL = p.sheetL, sW = p.sheetW, co = CLEAT_REACH
  const WpMin = minPatternWidth(web, style), mn = medName(style), make = style === 1 ? 'اجعله' : 'اجعلها'
  // with sizeIs 2 the sizes the user typed are the window's (the outside is 2·band more), and the fixes name those
  const win = g.sizeIs === 2, iW = p.PW, iH = p.PH, toIn = (v: number) => (win ? v - 2 * b : v)
  const sizeW = win ? { both: 'عرض الفتحة وطولها', w: 'عرض الفتحة', h: 'طول الفتحة' } : { both: 'العرض والطول الكلّيين', w: 'العرض الكلّي', h: 'الطول الكلّي' }
  // the narrowest band holding a motif (its straps sw grow with it, so searched)
  let bandMin = up5(ov + web + (g.field ? CLEAT_REACH + web : web) + WpMin)
  while (bandMin < BAND_MAX && frameGeom({ ...p, band: bandMin }).Wp < WpMin - 1e-9) bandMin += 0.5
  if (g.Wp < WpMin - 1e-9) {
    let ovMax = down5(b - web - rail - WpMin)
    while (ovMax >= 0 && frameGeom({ ...p, ov: ovMax }).Wp < WpMin - 1e-9) ovMax -= 0.5
    if (ov > 0.4 * b && ovMax >= 0) errors.push(`الركبة على الجبس (${f1(ov)} مم) كبيرة على عرض الإطار (${f1(b)} مم): ${b - ov > 0 ? `يظهر منه ${f1(b - ov)} مم فقط ولا تتّسع فيه ${motifName(style)}` : 'لا يظهر منه شيء'}. اجعل الركبة ${f1(ovMax)} مم على الأكثر، أو عرض الإطار ${f1(bandMin)} مم على الأقل.`)
    else errors.push(`عرض الإطار (${f1(b)} مم) قليل: لا تتّسع ${motifName(style)} في الجزء الظاهر منه. اجعله ${f1(bandMin)} مم على الأقل.`)
    return errors
  }
  // the band too wide: the frame's opening, or the corner motifs running into each other
  const okAt = (q: Record<string, number>) => { const h = frameGeom({ ...p, ...q }); return h.n1 > 0 && h.n2 > 0 && Math.min(h.PW, h.PH) - 2 * h.b >= MIN_OPEN }
  const okBand = (bb: number) => okAt({ band: bb })
  if (!okBand(b)) {
    let bb = down5(b)
    while (bb >= bandMin && !okBand(bb)) bb -= 0.5
    if (bb >= bandMin) errors.push(`عرض الإطار (${f1(b)} مم) كبير على ديكور ${f1(PW)} × ${f1(PH)} مم: اجعله ${f1(bb)} مم على الأكثر.`)
    else {
      // even the narrowest band is too much: less rest on the gypsum (a narrower band then fits), or a bigger decor
      const bandAt = (o: number) => { let bb = up5(o + web + rail + WpMin); while (bb < BAND_MAX && frameGeom({ ...p, ov: o, band: bb }).Wp < WpMin - 1e-9) bb += 0.5; return bb }
      let o = down5(ov) - 0.5
      while (o >= 0 && !okAt({ ov: o, band: bandAt(o) })) o -= 0.5
      let X = up5(Math.min(iW, iH))
      while (X <= SIZE_MAX && !okAt({ PW: Math.max(iW, X), PH: Math.max(iH, X), band: bandMin })) X += 0.5
      const fixes = [
        ...(o >= 0 ? [`اجعل الركبة ${f1(o)} مم على الأكثر`] : []),
        ...(X <= SIZE_MAX ? [`اجعل ${iW < X && iH < X ? sizeW.both : iW < X ? sizeW.w : sizeW.h} ${f1(X)} مم على الأقل`] : []),
      ]
      errors.push(`الديكور ${f1(PW)} × ${f1(PH)} مم صغير على إطار فيه ركبة ${f1(ov)} مم على الجبس: ${fixes.length ? fixes.join('، أو ') : 'اجعل الركبة 0 مم'}.`)
    }
    return errors
  }
  // the medallion in the middle
  const none = quote(kind === 1 ? CENTER_LABELS[2] : 'إطار فقط')
  if (kind === 1 && center !== 3) {
    const medMax = down5(Math.min(Math.min(g.Wf, g.Hf) - 2 * g.fm, center === 2 ? Math.min(sL, sW) : Infinity))
    if (p.med > medMax + 1e-9) {
      // or a narrower band, so the middle grows round the medallion
      const bb = down5((Math.min(PW, PH) - 2 * g.fm - p.med) / 2), bbOk = !win && bb >= bandMin && okBand(bb) && p.med <= (center === 2 ? Math.min(sL, sW) : Infinity)
      if (medMax >= 150) errors.push(`${mn} (${f1(p.med)} مم) أكبر من وسط الديكور ${f1(g.Wf)} × ${f1(g.Hf)} مم${center === 2 && medMax === down5(Math.min(sL, sW)) ? ' أو من اللوح' : ''}: ${make} ${f1(medMax)} مم على الأكثر${bbOk ? `، أو اجعل عرض الإطار ${f1(bb)} مم على الأكثر` : ''}.`)
      else errors.push(bbOk ? `وسط الديكور ${f1(g.Wf)} × ${f1(g.Hf)} مم صغير على ${mn} (${f1(p.med)} مم): اجعل عرض الإطار ${f1(bb)} مم على الأكثر، أو اختر ${none}.` : `وسط الديكور ${f1(g.Wf)} × ${f1(g.Hf)} مم صغير على ${mn}: اختر ${none}.`)
    }
  } else if (kind === 2 && center === 1) {
    const medMax = down5(Math.min(g.Wf, g.Hf) - 2 * (co + web))
    if (p.med > medMax + 1e-9) {
      const bb = down5((Math.min(PW, PH) - 2 * fit - 2 * (co + web) - p.med) / 2), bbOk = !win && bb >= bandMin && okBand(bb)
      if (medMax >= 150) errors.push(`${mn} (${f1(p.med)} مم) أكبر من اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم: ${make} ${f1(medMax)} مم على الأكثر${bbOk ? `، أو اجعل عرض الإطار ${f1(bb)} مم على الأكثر` : ''}.`)
      else errors.push(bbOk
        ? `اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم صغير على ${mn} (${f1(p.med)} مم): اجعل عرض الإطار ${f1(bb)} مم على الأكثر، أو اختر ${none}.`
        : `اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم صغير على ${mn}: اختر ${none}.`)
    }
  } else if (kind === 2 && center === 2) {
    const medMax = down5(Math.min(Math.min(PW, PH) - 2 * b - 20, sW))
    if (p.med > medMax + 1e-9) errors.push(medMax >= 150 ? `${mn} (${f1(p.med)} مم) أكبر من فتحة الإطار${medMax === down5(sW) ? ' أو من اللوح' : ''}: ${make} ${f1(medMax)} مم على الأكثر.` : `فتحة الإطار صغيرة على ${mn}: اختر ${none}.`)
  }
  // the lattice's cell
  if (g.fill) {
    const fMin = up5(minCell(style, web))
    if (p.fcell < fMin - 1e-9) errors.push(`خليّة شبكة الوسط (${f1(p.fcell)} مم) صغيرة على ${style === 1 ? 'وردات' : 'نجوم'} تُقصّ بخشب ${f1(web)} مم بينها: اجعلها ${f1(fMin)} مم على الأقل، أو ألغِ نقش الوسط (0).`)
  }
  // the middle strip: no medallion where it runs, room for its motif across it, an opening each side of it
  if (g.mid) {
    const winL = round3((g.wide ? PW : PH) - 2 * b), wMax = down5(Math.min(BAND_MAX, winL - 2 * MIN_OPEN)), off = '، أو ألغِ الشريحة الوسطى (0)'
    let wMin = up5(2 * (g.R + g.sw))
    while (wMin <= wMax && !frameGeom({ ...p, midW: wMin }).nm) wMin += 0.5
    if (center !== 3) errors.push(`الشريحة الوسطى تمرّ في مكان ${mn}: اختر ${none}${off}.`)
    else if (g.midW > wMax + 1e-9) errors.push(wMax >= wMin ? `الشريحة الوسطى (${f1(g.midW)} مم) عريضة على فتحة ${f1(winL)} مم: اجعل عرض الشريحة الوسطى ${f1(wMax)} مم على الأكثر${off}.` : `الفتحة ${f1(winL)} مم ضيّقة على شريحة وسطى: ألغِ الشريحة الوسطى (0).`)
    else if (!g.nm) errors.push(wMin <= wMax ? `الشريحة الوسطى (${f1(g.midW)} مم) ضيّقة على ${motifName(style)} الإطار: اجعل عرض الشريحة الوسطى ${f1(wMin)} مم على الأقل${off}.` : `الفتحة ${f1(winL)} مم ضيّقة على شريحة وسطى فيها ${motifName(style)} الإطار: ألغِ الشريحة الوسطى (0).`)
    else if (kind === 2 && !fitsSheet(g.Lm, g.midW, sL, sW)) errors.push(`الشريحة الوسطى ${f1(g.Lm)} × ${f1(g.midW)} مم لا تتّسع في لوح ${f1(sL)} × ${f1(sW)} مم: اجعل عرض الشريحة الوسطى ${f1(down5(Math.min(sW, wMax)))} مم على الأكثر${off}.`)
  }
  // every piece on one sheet
  if (kind === 1) {
    if (!fitsSheet(PW, PH, sL, sW)) {
      // the largest size that fits, the way round that keeps more of it; or the strips, when they fit
      const ways = [[Math.min(PW, sL), Math.min(PH, sW)], [Math.min(PW, sW), Math.min(PH, sL)]].map(([w, h]) => [down5(toIn(w)), down5(toIn(h))])
      const [w, h] = ways[0][0] * ways[0][1] >= ways[1][0] * ways[1][1] ? ways[0] : ways[1]
      const q2 = { ...p, kind: 2 }, stripsOk = frameErrors(q2, frameGeom(q2)).length === 0
      const size = w < iW - 1e-9 && h < iH - 1e-9 ? `اجعل${win ? ' الفتحة' : 'ه'} ${f1(w)} × ${f1(h)} مم على الأكثر` : w < iW - 1e-9 ? `اجعل ${sizeW.w} ${f1(w)} مم على الأكثر` : `اجعل ${sizeW.h} ${f1(h)} مم على الأكثر`
      errors.push(`الديكور قطعةً واحدة ${f1(PW)} × ${f1(PH)} مم لا يتّسع في لوح ${f1(sL)} × ${f1(sW)} مم: ${size}${stripsOk ? `، أو اختر ${quote(KIND_LABELS[1])}` : ''}.`)
    }
  } else {
    const Lmax = Math.max(PW, PH)
    if (Lmax > sL + 1e-9) errors.push(`الشريحة ${f1(Lmax)} مم أطول من لوح الخشب (${f1(sL)} مم): اجعل ${Math.min(PW, PH) > sL + 1e-9 ? sizeW.both : PW >= PH ? sizeW.w : sizeW.h} ${f1(down5(toIn(sL)))} مم على الأكثر.`)
    else if (b > sW + 1e-9) errors.push(`عرض الإطار (${f1(b)} مم) أعرض من لوح الخشب (${f1(sW)} مم): اجعله ${f1(down5(sW))} مم على الأكثر.`)
    else if (center === 1 && !fitsSheet(g.Wf, g.Hf, sL, sW)) {
      const bb = up5(Math.max((Math.max(PW, PH) - 2 * fit - sL) / 2, (Math.min(PW, PH) - 2 * fit - sW) / 2))
      const can = !win && bb <= BAND_MAX && okBand(bb) && p.med <= Math.min(PW, PH) - 2 * bb - 2 * fit - 2 * (co + web)
      errors.push(`اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم لا يتّسع في لوح ${f1(sL)} × ${f1(sW)} مم: ${can ? `اجعل عرض الإطار ${f1(bb)} مم على الأقل، أو ` : ''}اختر ${quote(CENTER_LABELS[1])}.`)
    }
  }
  if (p.back >= 0.5 && !fitsSheet(PW, PH, sL, sW)) {
    const short = PW <= PH ? sizeW.w : sizeW.h
    errors.push(`لوح الأكريليك ${f1(PW)} × ${f1(PH)} مم أكبر من لوح ${f1(sL)} × ${f1(sW)} مم: ألغِه (0) وضع قماشاً أبيض${Math.max(PW, PH) <= sL + 1e-9 && toIn(sW) >= 300 ? `، أو اجعل ${short} ${f1(down5(toIn(sW)))} مم على الأكثر` : ''}.`)
  }
  return errors
}

// ------------------------------------------------------------------ the build

/** What the build cuts, for the tests and the pictures: the band's, the medallion's and the lattice's cut-outs. */
export function decorPieces(p: Record<string, number>, g = frameGeom(p)) {
  const { top, side } = framePieces(g)
  const center = g.kind === 1 ? { x: g.PW / 2, y: g.PH / 2 } : { x: g.Wf / 2, y: g.Hf / 2 }
  const medHere = g.center === 1 // cut into the board (kind 1) or the field panel (kind 2)
  const med = medHere && (g.kind === 1 || g.field) ? medPieces(g.style, center, p.med, g.web) : []
  const keepOut = g.center !== 3 ? medOutline(g.style, { x: 0, y: 0 }, p.med, g.web) : null
  const latOf = (W: number, H: number, ko: P2[] | null) => memo(LATS, [g.style, W, H, g.fm, p.fcell, g.web, ko ? p.med : 0].join('|'), () => fieldLattice(g.style, W, H, g.fm, p.fcell, g.web, ko))
  // the middle strip (its own coordinates), and on the board the lattice either side of it
  const mid = midPieces(g)
  let lat: Piece[] = []
  if (g.fill && g.mid && g.kind === 1) {
    const Wh = g.wide ? round3((g.Wf - g.midW) / 2) : g.Wf, Hh = g.wide ? g.Hf : round3((g.Hf - g.midW) / 2), one = latOf(Wh, Hh, null)
    const at = g.wide ? [{ x: g.b + Wh / 2, y: g.PH / 2 }, { x: g.PW - g.b - Wh / 2, y: g.PH / 2 }] : [{ x: g.PW / 2, y: g.b + Hh / 2 }, { x: g.PW / 2, y: g.PH - g.b - Hh / 2 }]
    lat = at.flatMap(c => one.map(pc => movePc(pc, c.x, c.y)))
  } else if (g.fill) lat = latOf(g.Wf, g.Hf, keepOut).map(pc => movePc(pc, center.x, center.y))
  return { top, side, med, lat, center, mid }
}

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], notes: string[] = []
  const g = frameGeom(p)
  const { PW, PH, ov, b, web, fit, center, field, kind, style } = g, n = Math.max(1, Math.round(p.n)), co = CLEAT_REACH, cleats = p.cleats >= 0.5
  if (c.kerf > c.t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  const errors = frameErrors(p, g)
  if (errors.length) return { panels: [], notes, warnings, errors }

  const { top, side, med, lat, mid } = decorPieces(p, g)
  const mn = medName(style), panels: PanelSpec[] = []
  const medShape = (): Loop => polyLoop(style === 1 ? octagon({ x: 0, y: 0 }, p.med).map(q => ({ x: round3(q.x), y: round3(q.y) })) : circ({ x: 0, y: 0 }, p.med / 2), 'outer')
  const medPiece = () => { const pcs = medPieces(style, { x: 0, y: 0 }, p.med, web); panels.push({ id: 'medallion', name: style === 1 ? 'المثمّن' : 'الدائرة', w: p.med, h: p.med, shape: [medShape()], holes: holesOf(pcs), count: n }); return pcs.length }
  let sepHoles = 0, total = 0
  if (kind === 1) {
    const band = [0, 1, 2, 3].flatMap(s => (s % 2 ? side : top).map(pc => pieceToFrame(g, s, pc)))
    const all = [...band, ...mid.map(pc => midPieceToFrame(g, pc)), ...med, ...lat]
    total = all.length
    // the 45° meeting lines, on the solid bars across the corners
    const engrave: Loop[] = p.line >= 0.5 ? [[0, 0, 1, 1], [PW, 0, -1, 1], [PW, PH, -1, -1], [0, PH, 1, -1]].map(([x, y, sx, sy]) => ({ closed: false, layer: 'engrave' as const, pts: [{ x, y }, { x: round3(x + sx * b), y: round3(y + sy * b) }] })) : []
    panels.push({ id: 'board', name: 'الديكور — قطعة واحدة', w: PW, h: PH, holes: holesOf(all), ...(engrave.length ? { engrave } : {}), count: n, note: 'الوجه المزخرف للأسفل' })
    if (center === 2) sepHoles = medPiece()
  } else {
    panels.push(
      { id: 'strip-long', name: 'شريحة الإطار — العلوية والسفلية', w: PW, h: b, shape: [polyLoop(stripOutline(PW, b), 'outer')], holes: holesOf(top), count: 2 * n, note: 'الحافّة الطويلة للخارج، والشطفان على 45°' },
      { id: 'strip-short', name: 'شريحة الإطار — الجانبية', w: PH, h: b, shape: [polyLoop(stripOutline(PH, b), 'outer')], holes: holesOf(side), count: 2 * n, note: 'الحافّة الطويلة للخارج، والشطفان على 45°' },
    )
    total = 2 * top.length + 2 * side.length
    if (g.mid) {
      panels.push({ id: 'strip-mid', name: 'الشريحة الوسطى', w: g.Lm, h: g.midW, holes: holesOf(mid), count: n, note: 'طرفاها مستقيمان بلا شطف، يلتصقان بالحافّة الداخلية للشريحتين الطويلتين في منتصفهما' })
      total += mid.length
    }
    if (field) { panels.push({ id: 'field', name: `اللوح الأوسط مع ${mn}`, w: g.Wf, h: g.Hf, holes: holesOf([...med, ...lat]), count: n }); total += med.length + lat.length }
    else if (center === 2) sepHoles = medPiece()
  }
  total += sepHoles
  const plate = kind === 2 && cleats ? cornerPlate(g) : null
  if (kind === 2 && cleats && !plate) warnings.push(ov + g.sw - 1 < 6 ? `الركبة على الجبس (${f1(ov)} مم) لا تتّسع لقطع الزوايا خلف الشطف: الصق الشطوف بالغراء وثبّتها بشريط من خلف، أو اجعل الركبة ${f1(up5(7 - web))} مم على الأقل.` : 'لا مكان لقطع الزوايا خلف الشطف على هذا المقاس: الصق الشطوف بالغراء وثبّتها بشريط من خلف.')
  if (plate) panels.push({ id: 'corner', name: 'قطعة زاوية خلف الشطف', w: plate.arm, h: plate.arm, shape: [polyLoop(plate.pts, 'outer')], count: 4 * n, note: 'تُلصق خلف الزاوية: الضلعان على الحافّة الخارجية المصمتة والذراع على خط الشطف' })
  // behind each joint of the middle strip, a plate over the solid bar there (sw − 1 each side of the joint)
  const mPlate = kind === 2 && cleats && g.mid ? round3(2 * (g.sw - 1)) : 0
  if (mPlate >= 6) panels.push({ id: 'mid-plate', name: 'قطعة تدعيم خلف وصلة الشريحة الوسطى', w: g.midW, h: mPlate, count: 2 * n, note: 'تُلصق من الخلف على الوصلة: نصفها على الخشب المصمت من الشريحة الطويلة ونصفها على الشريحة الوسطى' })
  const wC = round3(2 * co + fit), lLong = round3(PW - 2 * b + 2 * co), lShort = round3(PH - 2 * b - 2 * fit - 2 * co - 2)
  const inner = kind === 2 && cleats && field
  if (inner) {
    panels.push({ id: 'cleat-long', name: 'شريحة تدعيم — طويلة', w: lLong, h: wC, count: 2 * n, note: 'خلف الوصلة العلوية والسفلية: نصفها على الشريحة ونصفها على اللوح الأوسط' })
    if (lShort > 20) panels.push({ id: 'cleat-short', name: 'شريحة تدعيم — قصيرة', w: lShort, h: wC, count: 2 * n, note: 'خلف الوصلة الجانبية، بين الطويلتين' })
  }
  if (p.back >= 0.5) panels.push({ id: 'back', name: 'لوح أكريليك أوبال', w: PW, h: PH, count: n, material: 'white', note: 'أبيض حليبي، فوق الديكور' })

  // -------------------------------------------------------------- notes
  const k1 = g.n1 - 1, k2 = g.n2 - 1, mw = style === 1 ? rosettesWord : starsWord, motif = motifName(style)
  const winLong = round3((g.wide ? PW : PH) - 2 * b), winShort = round3((g.wide ? PH : PW) - 2 * b), across = g.wide ? 'الضلع العلوي إلى السفلي' : 'الضلع الأيسر إلى الأيمن'
  const midMotifs = g.nm > 1 ? `على محورها ${mw(g.nm - 1)} بينها ${f1(g.qm)} مم، و` : ''
  const midWords = g.mid ? `${kind === 1 ? `شريحة وسطى من نفس اللوح عرضها ${f1(g.midW)} مم تقطع الوسط` : `الشريحة الوسطى ${f1(g.Lm)} × ${f1(g.midW)} مم تقطع الفتحة`} من منتصف ${across}${kind === 1 ? '' : '، طرفاها مستقيمان بلا شطف يلتقيان بالحافّة الداخلية للشريحتين الطويلتين'}، وعلى كلّ ${kind === 1 ? 'طرف' : 'وصلة'} شريط خشب مصمت ${f1(2 * g.sw)} مم لا تقطعه فتحة. ${midMotifs}في منتصف كلّ ضلع طويل ${motif} على محورها نفسه، فتكمل نقشتُها نقشةَ الإطار من طرف إلى طرف والرسمة صورة مرآة حولها.` : ''
  if (g.sizeIs === 2) notes.push(`الفتحة داخل الإطار ${f1(p.PW)} × ${f1(p.PH)} مم كما أدخلتها، والإطار ${f1(b)} مم من كلّ جهة، فالديكور من الخارج ${f1(PW)} × ${f1(PH)} مم.`)
  const bandWords = `في كلّ من الضلعين الطويلين ${mw(k1)} كاملة بينها ${f1(g.p1)} مم، وفي كلّ من القصيرين ${mw(k2)} بينها ${f1(g.p2)} مم`
  // the medallion as it is cut: a small one leaves out the rings too small to cut, and the words leave them out too
  const has = (re: RegExp) => medPieces(style, { x: 0, y: 0 }, p.med, web).some(pc => re.test(pc.key))
  const nPetal = style === 1 ? 16 : 12, petals = has(/^k\d/), starW = has(/^star$/) ? `نجمة من ${nPetal} رأساً${petals ? ` تخرج منها ${nPetal} بتلة${style === 1 ? ' طويلة' : ''}` : ''}` : petals ? `${nPetal} بتلة${style === 1 ? ' طويلة تلتقي في وسطه' : ' تلتقي في وسطها'}` : ''
  const ring1 = style === 1 ? [has(/^(b|e)\d/) ? 'نجوم صغيرة' : '', has(/^(cc|d|f)\d/) ? 'دوائر' : ''].filter(Boolean).join(' و') : has(/^c\d/) ? '12 خليّة' : ''
  const rimW = style === 1 ? (has(/^t\d/) ? 'وعلى حافّته 16 فتحة شبه منحرف داخل إطار مصمت' : 'داخل إطار مصمت') : `${has(/^a\d/) ? `${ring1 ? 'ثم ' : 'وحولها '}24 قوساً صغيراً ` : ''}داخل إطار دائري مصمت`
  const medWords = `${mn} ${style === 1 ? `${f1(p.med)} مم بين ضلعين متقابلين` : `قطرها ${f1(p.med)} مم`}: ${[starW, ring1 ? `وحولها ${ring1}` : ''].filter(Boolean).join('، ')}${style === 1 ? '، ' : ' '}${rimW}`
  const fillWords = g.fill
    ? `الوسط كلّه منقوش لا تبقى فيه مساحة سادة: ${style === 1 ? 'وردات صغيرة من 16 بتلة على شبكة متخالفة، بين كلّ أربع منها نجمة ثمانية وأربع لوزات' : 'نجوم ثمانية متشابكة (خاتم) بين كلّ أربع منها صليب، على خطوط خشب متّصلة'}، خليّتها ${f1(p.fcell)} مم، تملأ ${kind === 1 ? 'وسط الديكور' : 'اللوح الأوسط'} حول ${center === 3 ? 'مركزه' : mn} وتُقصّ عند ${center === 3 ? '' : `شريط خشب حوله و`}حافّته المصمتة (${f1(g.fm)} مم).`
    : `الوسط سادة (نقش الوسط 0)؛ اجعله 1 لتملأه شبكة زخرفة.`
  notes.push(ov > 0
    ? `الديكور من الخارج ${f1(PW)} × ${f1(PH)} مم والركبة على الجبس محسوبة فيه: يرتكز كلّ طرف ${f1(ov)} مم على لوح الجبسن بورد ويبقى خشباً مصمتاً مخفيّاً، فالفتحة الظاهرة ${f1(PW - 2 * ov)} × ${f1(PH - 2 * ov)} مم.`
    : `الديكور ${f1(PW)} × ${f1(PH)} مم بلا ركبة على الجبس: يظهر كلّه من تحت.`)
  if (kind === 1) {
    notes.push(
      `الديكور قطعة واحدة ${f1(PW)} × ${f1(PH)} مم تُقصّ من لوح واحد، بلا وصلات. الإطار بعرض ${f1(b)} مم يظهر منه ${f1(b - ov)} مم: ${bandWords}.`,
      `في كلّ زاوية ${motif} على القطر يقسمها شريط خشب مصمت عرضه ${f1(2 * g.sw)} مم على الأقل على خطّ الـ45°، فتلتقي الأضلاع الأربعة على 45° والزاوية صورة مرآة حوله، والزوايا الأربع متشابهة${p.line >= 0.5 ? '؛ وعلى كلّ شريط خطّ رفيع محفور يُبرز التقاء الـ45° (في RDWorks طبقة الحفر بقوّة خفيفة)' : ''}.`,
      ...(g.mid ? [midWords] : []),
      center === 1 ? `في الوسط ${medWords}، مفرّغ${style === 1 ? '' : 'ة'} في اللوح.` : center === 2 ? `${medWords}، قطعة منفصلة تُلصق بغراء الخشب على الوسط المصمت من الوجه الظاهر فتبرز عنه ويظهر الخشب من فتحاتها.` : 'بلا زخرفة وسطى.',
      fillWords,
      `عدد الفتحات: ${holesWord(total - sepHoles)} في القطعة${sepHoles ? ` و${holesWord(sepHoles)} في ${mn}` : ''}.`,
      'في RDWorks اقصّ الفتحات أولاً ثم المحيط الخارجي (ترتيب القصّ من الداخل إلى الخارج) حتى لا تتحرّك القطعة قبل أن تكتمل فتحاتها؛ ثبّت اللوح مستوياً على السرير بأوزان على حوافّه المصمتة، وانزع القطع الصغيرة الساقطة قبل أن تعلق تحت الرأس.',
      `بعد القصّ ادهنه أو رشّه (الوجه وحوافّ الفتحات) واتركه يجفّ.`,
      `التركيب: الديكور أكبر من الفتحة، فأدخله من الفتحة مائلاً (حرفاً أوّلاً) إلى فوق الجبس، ثم أنزله مسطّحاً والوجه المزخرف للأسفل حتى ترتكز حافّته${ov > 0 ? ` (${f1(ov)} مم من كلّ جهة)` : ''} على لوح الجبسن بورد. إن كان التجويف فوق الجبس قليل الارتفاع فلا يمرّ مائلاً: اختر ${quote(KIND_LABELS[1])} فتدخل القطع واحدة واحدة.`,
    )
  } else {
    notes.push(
      `الإطار أربع شرائح تلتقي بزوايا مشطوفة 45°، عرضها ${f1(b)} مم يظهر منها ${f1(b - ov)} مم. العلوية والسفلية قطعتان متطابقتان: ${f1(PW)} مم من الخارج و${f1(PW - 2 * b)} مم من الداخل، في كلّ منهما ${mw(k1)} كاملة بينها ${f1(g.p1)} مم. الجانبيتان قطعتان: ${f1(PH)} مم من الخارج و${f1(PH - 2 * b)} مم من الداخل، في كلّ منهما ${mw(k2)} بينها ${f1(g.p2)} مم.`,
      `في كلّ زاوية ${motif} على خط الشطف نصفها في كلّ شريحة: ما يقع على الخط يترك مكانه لشريط خشب مصمت عرضه ${f1(2 * g.sw)} مم على الأقل يمرّ فيه الشطف، فلا يقطع الشطف أيّ فتحة والزاوية صورة مرآة حوله، والزوايا الأربع متشابهة.`,
    )
    if (field) notes.push(`اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم (خلوص ${f1(fit)} مم من كلّ جهة)، وفي وسطه ${medWords}؛ وحوافّ اللوح مصمتة ${f1(co + web)} مم على الأقل.`, fillWords)
    else if (center === 2) notes.push(`${medWords}، قطعة منفصلة: الصقها في وسط سقف التجويف فوق الفتحة (أو على لوح الأكريليك) فتظهر من وسط الإطار.`)
    else if (g.mid) notes.push(midWords, `إطار فقط: فتحتان ${f1(round3((winLong - g.midW) / 2))} × ${f1(winShort)} مم على جانبي الشريحة الوسطى يظهر منهما سقف التجويف.`)
    else notes.push('إطار فقط: الوسط مفتوح ويظهر منه سقف التجويف.')
    if (plate || inner || mPlate >= 6) notes.push(`قطع التدعيم من نفس اللوح، تُلصق من الخلف فوق الخشب المصمت فقط فلا تسدّ أيّ فتحة:${plate ? ` ${4 * n} قطع زاوية على شكل L، ضلعاها ${f1(plate.arm)} مم وعرضهما ${f1(plate.w)} مم على الحافّة الخارجية المصمتة${plate.diag ? `، وذراعها عرضه ${f1(2 * plate.h)} مم على خط الشطف` : ''}` : ''}${mPlate >= 6 ? `${plate ? '؛' : ''} ${stripsWord(2 * n)} ${f1(g.midW)} × ${f1(mPlate)} مم على وصلتي الشريحة الوسطى` : ''}${(plate || mPlate >= 6) && inner ? '؛' : ''}${inner ? ` ${stripsWord(2 * n)} ${f1(lLong)} × ${f1(wC)} مم${lShort > 20 ? ` و${stripsWord(2 * n)} ${f1(lShort)} × ${f1(wC)} مم` : ''} خلف وصلة اللوح الأوسط، ${f1(co)} مم منها على الحافّة المصمتة للشريحة و${f1(co)} مم على اللوح الأوسط` : ''}.`)
    else if (field) notes.push(`اللوح الأوسط يحتاج دعماً من خلف وصلته: الصق شرائح ${f1(2 * co)} مم نصفها على حافّة الشريحة المصمتة (${f1(co + web)} مم) ونصفها على اللوح الأوسط.`)
    notes.push(
      `عدد الفتحات: ${f1(top.length)} في كلّ شريحة طويلة و${f1(side.length)} في كلّ جانبية${g.mid ? ` و${f1(mid.length)} في الشريحة الوسطى` : ''}${field ? ` و${f1(med.length + lat.length)} في اللوح الأوسط` : sepHoles ? ` و${f1(sepHoles)} في ${mn}` : ''} — ${holesWord(total)} في الديكور كلّه.`,
      'في RDWorks اقصّ الفتحات الداخلية أولاً ثم المحيط الخارجي لكلّ قطعة (ترتيب القصّ من الداخل إلى الخارج) حتى لا تتحرّك القطعة قبل أن تكتمل فتحاتها، وثبّت اللوح مستوياً على السرير. الشرائح شبه منحرفة: رتّب كلّ اثنتين على اللوح واحدة مقلوبة بجانب الأخرى فتتداخل أطرافهما المشطوفة ويقلّ الهدر.',
      `التجميع على طاولة مستوية والوجه الظاهر للأسفل: رصّ الشرائح الأربع وألصق الشطوف بغراء الخشب${g.mid ? '، ثم الشريحة الوسطى بين الطويلتين في منتصفهما وطرفاها على حافّتيهما الداخليتين' : ''}${plate || mPlate >= 6 ? ' ثم ألصق قطع التدعيم فوقها' : ''}${field ? `، ثم ضع اللوح الأوسط في مكانه${inner ? ' وألصق شرائح التدعيم فوق وصلته' : ''}` : ''}. اتركه يجفّ تماماً، ثم ادهنه أو رشّه (الوجه وحوافّ الفتحات) قبل التركيب.`,
      ov > 0 ? `التركيب: أدخل الديكور من الفتحة مائلاً إلى فوق الجبس، ثم أنزله مسطّحاً والوجه المزخرف للأسفل حتى ترتكز حافّته الخارجية (${f1(ov)} مم من كلّ جهة) على لوح الجبسن بورد.`
        : `التركيب: بلا ركبة على الجبس فالإطار كلّه ظاهر: ثبّته تحت سقف الجبس حول الفتحة${g.sizeIs === 2 ? ` (حافّته الداخلية على حافّة الفتحة ${f1(p.PW)} × ${f1(p.PH)} مم)` : ''} بغراء ومسامير رفيعة في الخشب المصمت فقط، أو ركّب الشرائح واحدة واحدة.`,
    )
  }
  notes.push(
    `ضوء النيون في التجويف فوقه يمرّ من الفتحات؛ لضوء ناعم بلا خطوط ظاهرة ضع فوقه لوح أكريليك أوبال (أبيض حليبي) أو قماشاً أبيض مشدوداً${p.back >= 0.5 ? `، ولوح الأكريليك ${f1(PW)} × ${f1(PH)} مم في الملف بلونه الخاصّ` : ''}.`,
    `الخشب: MDF أو بلاي ${c.t} مم؛ ${kind === 1 ? 'القطعة كبيرة وفتحاتها كثيرة' : 'الشرائح طويلة وفتحاتها كثيرة'}، فالأمتن 4–6 مم.`,
    g.sizeIs === 2 ? 'المقاس مقاس الفتحة داخل الإطار: 1400 × 1050 للأول و1380 × 1080 للثاني.' : 'المقاس مقاس الديكور من الخارج والركبة على الجبس محسوبة فيه؛ إن كان مقاسك مقاس الفتحة داخل الإطار فاختر «مقاس الفتحة داخل الإطار» في «المقاس».',
  )
  // the rosettes' dashed rings and the stars' points are short cut-outs, not slots: nothing here slots together
  return { panels, notes, warnings, errors, slotted: false }
}

const ICON1 = `<path d="M4 12h56v40H4z"/><path d="M15 23h34v18H15z"/><path d="M4 12l11 11M60 12L49 23M4 52l11-11M60 52L49 41" stroke-width="1.5"/><path d="M28 27h8l4 4v2l-4 4h-8l-4-4v-2z" stroke-width="1.5"/><circle cx="9.5" cy="17.5" r="3" stroke-width="1.2"/><circle cx="21" cy="17.5" r="3" stroke-width="1.2"/><circle cx="32" cy="17.5" r="3" stroke-width="1.2"/><circle cx="43" cy="17.5" r="3" stroke-width="1.2"/><circle cx="54.5" cy="17.5" r="3" stroke-width="1.2"/><circle cx="9.5" cy="32" r="3" stroke-width="1.2"/><circle cx="54.5" cy="32" r="3" stroke-width="1.2"/><circle cx="9.5" cy="46.5" r="3" stroke-width="1.2"/><circle cx="21" cy="46.5" r="3" stroke-width="1.2"/><circle cx="32" cy="46.5" r="3" stroke-width="1.2"/><circle cx="43" cy="46.5" r="3" stroke-width="1.2"/><circle cx="54.5" cy="46.5" r="3" stroke-width="1.2"/>`
const star8 = (x: number, y: number, r: number) => `<path d="M${x - r} ${y - r}h${2 * r}v${2 * r}h${-2 * r}z M${x} ${y - 1.41 * r}l${1.41 * r} ${1.41 * r}l${-1.41 * r} ${1.41 * r}l${-1.41 * r} ${-1.41 * r}z" stroke-width="1"/>`
const ICON2 = `<path d="M4 12h56v40H4z"/><path d="M15 23h34v18H15z"/><path d="M4 12l11 11M60 12L49 23M4 52l11-11M60 52L49 41" stroke-width="1.5"/><circle cx="32" cy="32" r="6.5" stroke-width="1.5"/><path d="M32 27.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2z" stroke-width="1"/>${[15.5, 26.5, 37.5, 48.5].map(x => star8(x, 17.5, 2.2) + star8(x, 46.5, 2.2)).join('')}${star8(9.5, 32, 2.2)}${star8(54.5, 32, 2.2)}`

const DESC1 = 'ديكور خشب مفرّغ لفتحة إضاءة في سقف جبس (جبسن بورد): إطار فيه وردات إسلامية من 16 بتلة تلتقي زواياه على 45°، وفي الوسط مثمّن بنجمة وبتلات، والوسط كلّه منقوش بشبكة وردات صغيرة فلا تبقى مساحة سادة. قطعة واحدة من لوح واحد (أو أربع شرائح بزوايا مشطوفة 45° ولوح وسط للديكور الأكبر من اللوح). المقاس هو مقاس الفتحة مع الركبة على الجبس، فيرتكز طرفه على لوح الجبس ويمرّ ضوء النيون من الفتحات.'
const DESC2 = 'ديكور سقف خشب مفرّغ لفتحة إضاءة في سقف جبس (جبسن بورد): إطار من نجوم ثمانية متشابكة (خاتم) بينها صلبان ومعيّنات تلتقي زواياه على 45°، وفي الوسط دائرة فيها نجمة من 12 رأساً وبتلات وخلايا، والوسط كلّه شبكة نجوم وصلبان فلا تبقى مساحة سادة. قطعة واحدة من لوح واحد (أو أربع شرائح بزوايا 45° ولوح وسط). المقاس مقاس الفتحة مع الركبة على الجبس، ويمرّ ضوء الإضاءة من الفتحات.'

export const CEILING_FRAMES: Template[] = [
  { id: 'ceilingframe', name: 'ديكور سقف: إطار وردات بزوايا 45 ومثمّن', desc: DESC1, icon: ICON1, params: PARAMS, defaults: DEFAULTS, innerAdd: () => ({ W: 0, D: 0, H: 0 }), build },
  { id: 'ceilingframe2', name: 'ديكور سقف: إطار نجوم ثمانية ودائرة', desc: DESC2, icon: ICON2, params: PARAMS, defaults: { ...DEFAULTS, style: 2 }, innerAdd: () => ({ W: 0, D: 0, H: 0 }), build },
]
