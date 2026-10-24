// A ceiling decor for a recessed light opening in a gypsum-board false ceiling (the customer's picture: a rectangular
// frame band of Islamic rosettes all round, and an octagon medallion in the middle; the room: two rectangular recesses
// with fluorescent tubes). The decor is laid into the opening and its outer rim rests on the gypsum board, so the sizes
// the user gives are the decor's whole OUTSIDE size, the rest on the gypsum included.
//
// Construction: four separate strips, `band` wide, meeting at the corners on 45° mitres (trapezoids: top and bottom
// PW long outside and PW − 2·band inside, the sides PH / PH − 2·band). The outer `ov` of each strip rests on the gypsum
// and stays solid; the pattern fills the visible part. Inside the frame: a solid field panel with the octagon
// medallion cut into its middle (or the medallion as a separate piece, or nothing). Corner plates glued behind the
// mitres and, with the field, strips glued behind the inner joints hold it together; all of them sit on solid wood.
//
// The band: rosettes of 16 teardrop petals round a centre dot inside a dashed ring, a column of almonds between two
// rosettes, kites where the rings meet the edges, and a frieze of almonds and dots along both edges. Every strip is
// symmetric about its middle and carries a whole number of rosettes between its corners; each corner holds a rosette
// centred on the mitre whose two halves sit one in each strip: the petal on the mitre and its centre dot give way to
// a solid diagonal bar, so the mitre runs through wood only and the corner is a mirror image about it.
//
// Strip coordinates: u along the outer edge from the strip's first corner, v from the outer edge inward; the mitres
// are u = v and u = L − v. Frame coordinates (for the tests and pictures): x right, y down from the outer top-left
// corner; the strips run clockwise round the frame (top: x = u, y = v; right: x = PW − v, y = u; bottom: x = PW − u,
// y = PH − v; left: x = v, y = PH − u).
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, polyLoop, circle, round3, arcInfo, signedArea } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const intP = (key: string, label: string, min: number, max: number, hint?: string, options?: string[]): ParamDef => ({ key, label, min, max, step: 1, int: true, ...(hint ? { hint } : {}), ...(options ? { options } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const up5 = (v: number) => Math.ceil(v * 2 - 1e-6) / 2
const down5 = (v: number) => Math.floor(v * 2 + 1e-6) / 2

/** How far each glue strip behind the field's joint reaches onto the strip and onto the field (mm). */
export const CLEAT_REACH = 10

const PARAMS: ParamDef[] = [
  mm('PW', 'العرض الكلّي للديكور', 300, 2440, 'مقاس الفتحة مع الركبة على الجبس (من الخارج): 1400 للأول و1380 للثاني'),
  mm('PH', 'الطول الكلّي للديكور', 300, 2440, 'مقاس الفتحة مع الركبة على الجبس (من الخارج): 1050 للأول و1080 للثاني'),
  mm('ov', 'الركبة على الجبس', 0, 200, 'كم يرتكز كلّ طرف من الديكور على لوح الجبسن بورد؛ تبقى خشباً مصمتاً ولا تظهر من تحت'),
  mm('band', 'عرض الإطار', 60, 600, 'من الحافّة الخارجية للديكور إلى حافّته الداخلية، والركبة على الجبس منه'),
  intP('center', 'الوسط', 1, 3, '1 = لوح وسط يملأ الإطار وفي وسطه المثمّن (كالصورة)، 2 = المثمّن قطعة منفصلة تُلصق في الوسط، 3 = الإطار فقط', ['لوح وسط بالمثمّن', 'مثمّن منفصل', 'إطار فقط']),
  mm('med', 'قطر المثمّن', 150, 1200, 'بين ضلعين متقابلين'),
  { ...mm('web', 'أقلّ خشب بين فتحتين', 2, 8, 'بين كلّ فتحتين، وبين الفتحة والحافّة؛ 3 مم يكفي للـMDF'), step: 0.5 },
  { ...mm('fit', 'خلوص اللوح الأوسط', 0, 2, 'بين اللوح الأوسط والإطار من كلّ جهة'), step: 0.1 },
  intP('cleats', 'قطع التدعيم', 0, 1, '1 = قطع تُلصق خلف الزوايا وخلف وصلة اللوح الأوسط، من نفس اللوح'),
  intP('back', 'لوح أكريليك أوبال', 0, 1, '1 = لوح أكريليك أبيض حليبي بمقاس الديكور فوقه يوزّع ضوء النيون'),
  mm('sheetL', 'طول لوح الخشب', 300, 3000, 'اللوح الكامل 2440 × 1220'),
  mm('sheetW', 'عرض لوح الخشب', 300, 2000),
  intP('n', 'عدد الديكورات', 1, 10),
]

const DEFAULTS = { PW: 1400, PH: 1050, ov: 30, band: 170, center: 1, med: 450, web: 3, fit: 0.2, cleats: 1, back: 0, sheetL: 2440, sheetW: 1220, n: 1 }

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
const bbOf = (pts: P2[]) => {
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
 * Big enough to cut cleanly (on the convex shapes it is used on): 2 mm across and 4 mm², so that even the laser's path,
 * a kerf inside the hole, stays over 1.5 mm across and 3 mm².
 */
const MIN_W = 2, MIN_A = 4
const cuttable = (pc: Piece) => areaAbs(pc.poly) >= MIN_A && widthOf(pc.poly) >= MIN_W

/** A shape moved by (dx, dy) (arcs keep their bulges). */
const moved = (pts: Vtx[], dx: number, dy: number): Vtx[] => pts.map(v => ({ ...v, x: v.x + dx, y: v.y + dy }))
/** Mirror in the line x = m (the bulges change side). */
const mirrored = (pts: Vtx[], m: number): Vtx[] => pts.map(v => ({ ...v, x: 2 * m - v.x, ...(v.b ? { b: -v.b } : {}) }))
const rounded = (pts: Vtx[]): Vtx[] => pts.map(v => ({ ...v, x: round3(v.x), y: round3(v.y) }))

// ------------------------------------------------------------------ the rosette

/** One shape of the pattern: its loop, a fine polygon of it, and where it sits (for halving and mirroring). */
export interface Piece { pts: Vtx[]; poly: P2[]; c: P2; key: string }
const piece = (pts: Vtx[], c: P2, key: string): Piece => ({ pts, poly: sample(pts), c, key })

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
 * The shapes between two rosettes (rings of outer radius R, centres p apart) in a band 2H wide, in coordinates from
 * the waist (the middle between them) and the band's centre line: the frieze along both edges (a dot over the waist,
 * almonds a fifth of the pitch apart), a column of two almonds and two dots across the waist, and four kites where
 * the rings meet the frieze. Each set is shrunk until it keeps `web` from the rings, the band's edges and the sets
 * before it, or left out.
 */
export function waistUnit(p: number, H: number, R: number, web: number): Piece[] {
  const placed: Piece[] = []
  const rings = [{ x: -p / 2, y: 0 }, { x: p / 2, y: 0 }]
  const fits = (set: Piece[]) => set.every(pc =>
    pc.poly.every((q, i) => Math.abs(q.y) <= H + 1e-6 && rings.every(r => segPt(r, q, pc.poly[(i + 1) % pc.poly.length]) >= R + web - 1e-6))
    && placed.every(o => clear(pc.poly, o.poly, web))) && set.every((a, i) => set.every((b, j) => j <= i || clear(a.poly, b.poly, web)))
  const tryAdd = (make: (s: number) => Piece[], minS = 0.45) => {
    for (let s = 1; s >= minS - 1e-9; s -= 0.05) {
      const set = make(s)
      if (!set.every(cuttable)) break // smaller still would only be slivers
      if (set.length && fits(set)) { placed.push(...set); return s }
    }
    return 0
  }
  const both = (f: (sy: number) => Piece[]) => [...f(-1), ...f(1)]
  // the frieze: dots over the waist, touching the band's edge
  const rE = 0.07 * H
  tryAdd(s => both(sy => { const c = { x: 0, y: sy * (H - rE * s) }; return [piece(circ(c, rE * s), c, `fd${sy}`)] }))
  // and almonds at ±p/5, ±2p/5
  const hE = 0.075 * H, aE = Math.min(0.085 * p, (0.2 * p - 1.2 * web) / 2 - 0.1)
  if (aE > 2) tryAdd(s => both(sy => [-2, -1, 1, 2].map(j => {
    const c = { x: (j * p) / 5, y: sy * (H - hE * s) }
    return piece(lens(c, 0, aE * s, hE * s), c, `fa${sy}${j}`)
  })))
  // the column: an almond each side of a bar across the waist, and a dot beyond it
  const g = p - 2 * R, wA = Math.min(0.07 * H, g / 2 - web), yA = 0.26 * H, aA = 0.15 * H
  if (wA > 0.75) tryAdd(s => both(sy => { const c = { x: 0, y: sy * yA }; return [piece(lens(c, Math.PI / 2, aA * s, wA * s), c, `ca${sy}`)] }))
  const rO = Math.min(0.075 * H, g / 2 - web), yO = 0.56 * H
  if (rO > 0.75) tryAdd(s => both(sy => { const c = { x: 0, y: sy * yO }; return [piece(circ(c, rO * s), c, `cd${sy}`)] }))
  // the kites: almonds along the rings, where they come near the frieze
  const aK = 0.11 * H, wK = 0.045 * H
  tryAdd(s => both(sy => [-1, 1].map(sx => {
    const r = rings[sx < 0 ? 0 : 1], ang0 = Math.atan2(sy * 0.72 * H, -sx * p / 2), c = add(r, R + web + wK + 0.6 * web, ang0)
    return piece(lens(c, ang0 + Math.PI / 2, aK * s, wK * s), c, `k${sy}${sx}`)
  })), 0.5)
  return placed
}

// ------------------------------------------------------------------ the frame's layout

/** The rosettes' ring radius and their step, of the pattern's width (the picture: rings nearly touching, filling the band). */
export const ROSE = { R: 0.38, p: 0.9 }

/** Everything the pieces are sized on; shared by the build and the tests. */
export function frameGeom(p: Record<string, number>) {
  const center = Math.min(3, Math.max(1, Math.round(p.center))), field = center === 1
  const { PW, PH, ov, band: b, web, fit } = p
  // with the field, the strip keeps a solid rail along its inner edge for the glue strip behind the joint
  const rail = field ? CLEAT_REACH + web : web
  const v0 = ov + web, v1 = b - rail, Wp = v1 - v0, H = Wp / 2, vc = (v0 + v1) / 2
  const R = ROSE.R * Wp, dims = Wp > 0 ? rosetteDims(R, web) : null
  const p0 = ROSE.p * Wp, pHard = 2 * R + 2 * web
  const S1 = PW - 2 * vc, S2 = PH - 2 * vc
  // a whole number of steps between the corner rosettes on each strip, the two steps as close to each other (the
  // corners are mirror images) and to the picture's step as they can be
  let best: { n1: number; n2: number; score: number } | null = null
  const ns = (S: number) => { const out: number[] = []; for (let k = Math.max(1, Math.floor(S / (1.6 * p0))); k <= Math.max(1, Math.ceil(S / (0.7 * p0))) && k < 400; k++) if (S / k >= pHard) out.push(k); return out }
  if (dims && S1 > 0 && S2 > 0) for (const n1 of ns(S1)) for (const n2 of ns(S2)) {
    const a = S1 / n1, c = S2 / n2, score = Math.abs(Math.log(a / p0)) + Math.abs(Math.log(c / p0)) + 3 * Math.abs(Math.log(a / c))
    if (!best || score < best.score - 1e-12) best = { n1, n2, score }
  }
  const n1 = best?.n1 ?? 0, n2 = best?.n2 ?? 0
  const p1 = n1 ? S1 / n1 : 0, p2 = n2 ? S2 / n2 : 0
  const Wf = round3(PW - 2 * b - 2 * fit), Hf = round3(PH - 2 * b - 2 * fit)
  return { center, field, PW, PH, ov, b, web, fit, rail, v0, v1, Wp, H, vc, R, dims, p0, pHard, S1, S2, n1, n2, p1, p2, Wf, Hf }
}
export type FrameGeom = ReturnType<typeof frameGeom>

/** The trapezoid of a strip L long outside (u along the outer edge, v inward). */
export const stripOutline = (L: number, b: number): P2[] => [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L - b, y: b }, { x: b, y: b }]

/**
 * The pattern of a strip L long whose step is p (the strips it meets at its corners step pOther): the first half
 * (corner rosette, rosettes, the shapes between them), kept only where they clear both mitres by `web` — near the
 * corner for both steps, so the two strips meeting there drop the same shapes — and mirrored onto the second half.
 */
export function stripPieces(g: FrameGeom, L: number, p: number, pOther: number): Piece[] {
  return mirrorHalf(stripHalf(g, L, p, pOther), L / 2)
}

function stripHalf(g: FrameGeom, L: number, p: number, pOther: number): Piece[] {
  const { vc, H, R, web } = g, d = g.dims!
  const n = Math.round((L - 2 * vc) / p), mid = L / 2, eps = 1e-6
  const half: Piece[] = []
  const take = (pc: Piece) => { if (pc.c.x <= mid + eps) half.push(pc) }
  for (const pc of rosette({ x: vc, y: vc }, d, web, true, 'C')) take(pc)
  for (let i = 1; i < n; i++) for (const pc of rosette({ x: vc + i * p, y: vc }, d, web, false, `r${i}`)) take(pc)
  const unit = waistUnit(p, H, R, web), other = waistUnit(pOther, H, R, web)
  const at = (pc: Piece, w: number): Piece => ({ pts: moved(pc.pts, w, vc), poly: pc.poly.map(q => ({ x: q.x + w, y: q.y + vc })), c: { x: pc.c.x + w, y: pc.c.y + vc }, key: pc.key })
  for (let i = -1; i < n; i++) {
    const w = vc + (i + 0.5) * p
    if (w - p / 2 > mid + eps) break
    for (const pc0 of unit) {
      const pc = at(pc0, w)
      if (pc.c.x > mid + eps || !inStrip(g, pc, L)) continue
      if (i <= 0) {
        // the same shape on the strip across the corner (its own step) must clear the mitre too
        const o = other.find(q => q.key === pc0.key)
        if (!o || !inStrip(g, at(o, vc + (i + 0.5) * pOther), Infinity)) continue
      }
      half.push(pc)
    }
  }
  return half
}

/** Clear of both mitres by `web`, and inside the pattern's band. */
const inStrip = (g: FrameGeom, pc: Piece, L: number) => pc.poly.every(q => q.x - q.y >= g.web * Math.SQRT2 - 1e-6 && L - q.x - q.y >= g.web * Math.SQRT2 - 1e-6 && q.y >= g.v0 - 1e-6 && q.y <= g.v1 + 1e-6)

/** The first half and its mirror image in the strip's middle (a shape on the middle is its own mirror). */
function mirrorHalf(half: Piece[], mid: number): Piece[] {
  const out = [...half]
  for (const pc of half) if (pc.c.x < mid - 1e-6) out.push({ pts: mirrored(pc.pts, mid), poly: pc.poly.map(q => ({ x: 2 * mid - q.x, y: q.y })), c: { x: 2 * mid - pc.c.x, y: pc.c.y }, key: pc.key })
  return out
}

/**
 * Both strips' patterns. Round each corner rosette, toward the outer and the inner corner, a kite each side of the
 * mitre (`CORNER_KITE` off it) stands in for the kites the mitre took: shrunk until it clears both strips' shapes, or
 * left out — the same on both strips, so the corner stays a mirror image.
 */
export function framePieces(g: FrameGeom): { top: Piece[]; side: Piece[] } {
  const ht = stripHalf(g, g.PW, g.p1, g.p2), hs = stripHalf(g, g.PH, g.p2, g.p1)
  const { vc, H, R, web } = g, c0 = { x: vc, y: vc }
  const aK = 0.11 * H, wK = 0.045 * H, rK = R + web + wK + 0.6 * web
  // both whole strips (on a short strip the far half and the far corner's kites come close too)
  const ft = mirrorHalf(ht, g.PW / 2), fs = mirrorHalf(hs, g.PH / 2), Lmin = Math.min(g.PW, g.PH)
  const twin = (pc: Piece, L: number) => pc.poly.map(q => ({ x: L - q.x, y: q.y }))
  const kites: Piece[] = []
  for (const ang of [-3 * Math.PI / 4 + CORNER_KITE, Math.PI / 4 - CORNER_KITE]) {
    for (let s = 1; s >= 0.5 - 1e-9; s -= 0.05) {
      const cc = add(c0, rK - wK * (1 - s), ang), pc = piece(lens(cc, ang + Math.PI / 2, aK * s, wK * s), cc, `K${ang > 0 ? 1 : -1}`)
      if (!cuttable(pc)) break
      if (!inStrip(g, pc, Lmin) || pc.poly.some((q, i) => segPt(c0, q, pc.poly[(i + 1) % pc.poly.length]) < R + web - 1e-6)) continue
      const clearOf = (o: P2[]) => clear(pc.poly, o, web)
      if (ft.every(o => clearOf(o.poly)) && fs.every(o => clearOf(o.poly)) && [g.PW, g.PH].every(L => clearOf(twin(pc, L)))
        && kites.every(o => clearOf(o.poly) && [g.PW, g.PH].every(L => clearOf(twin(o, L))))) { kites.push(pc); break }
    }
  }
  ht.push(...kites); hs.push(...kites)
  return { top: mirrorHalf(ht, g.PW / 2), side: mirrorHalf(hs, g.PH / 2) }
}
/** How far round the corner rosette from the mitre its corner kites sit (radians). */
const CORNER_KITE = (17 * Math.PI) / 180

/** Strip coordinates → frame coordinates for the strip on side s (0 top, 1 right, 2 bottom, 3 left). */
export function toFrame(g: { PW: number; PH: number }, s: number, q: P2): P2 {
  return s === 0 ? { x: q.x, y: q.y } : s === 1 ? { x: g.PW - q.y, y: q.x } : s === 2 ? { x: g.PW - q.x, y: g.PH - q.y } : { x: q.y, y: g.PH - q.x }
}

// ------------------------------------------------------------------ the octagon medallion

const dirOf = (a: number): P2 => ({ x: Math.cos(a), y: Math.sin(a) })
const dot = (a: P2, b: P2) => a.x * b.x + a.y * b.y
/** The convex polygon of the points q with n·(q − c) ≥ d for every half-plane [n, d] (n unit), from a big square. */
function clipConvex(c: P2, size: number, hs: [P2, number][]): P2[] {
  let poly: P2[] = [{ x: c.x - size, y: c.y - size }, { x: c.x + size, y: c.y - size }, { x: c.x + size, y: c.y + size }, { x: c.x - size, y: c.y + size }]
  for (const [nv, d] of hs) {
    const f = (q: P2) => dot(nv, { x: q.x - c.x, y: q.y - c.y }) - d, out: P2[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b)
      if (fa >= 0) out.push(a)
      if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }) }
    }
    poly = out
    if (poly.length < 3) return []
  }
  return poly
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
const areaAbs = (pts: P2[]) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y } return Math.abs(a / 2) }

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

// ------------------------------------------------------------------ joining pieces

/**
 * The plate glued behind a corner (corner coordinates: x along one outer edge, y along the other, the mitre y = x):
 * an L over the solid rim that rests on the gypsum, `w` wide and `arm` long, and an arm along the mitre over the solid
 * bar between the two halves of the corner rosette, `2·h` wide, ending at e on the diagonal. Null when there is no room.
 */
export function cornerPlate(g: FrameGeom) {
  const w = round3(g.ov + g.web - 1), arm = round3(Math.min(1.5 * g.b, Math.min(g.PW, g.PH) / 2 - 5)), h = g.web - 1
  if (w < 6 || arm < w + 10) return null
  const r2 = Math.SQRT1_2, e = (g.field ? g.b - CLEAT_REACH - 1 : g.b - 1) - h * r2
  const pts: P2[] = [{ x: 0, y: 0 }, { x: arm, y: 0 }, { x: arm, y: w }]
  if (h >= 1.5 && e - h * r2 > w + h * Math.SQRT2 + 5) pts.push({ x: w + h * Math.SQRT2, y: w }, { x: e + h * r2, y: e - h * r2 }, { x: e - h * r2, y: e + h * r2 }, { x: w, y: w + h * Math.SQRT2 })
  else pts.push({ x: w, y: w })
  pts.push({ x: w, y: arm }, { x: 0, y: arm })
  return { w, arm, h, e, pts: pts.map(q => ({ x: round3(q.x), y: round3(q.y) })), diag: pts.length > 7 }
}

/** The narrowest visible band that still holds a rosette: its pattern width Wp (searched on a half-millimetre step). */
export function minPatternWidth(web: number): number {
  for (let w = 20; w < 400; w += 0.5) if (rosetteDims(ROSE.R * w, web)) return w
  return 400
}

// ------------------------------------------------------------------ words

const countWord = (k: number, one: string, two: string, few: string, many: string) => (k === 1 ? one : k === 2 ? two : k <= 10 ? `${k} ${few}` : `${k} ${many}`)
const rosettesWord = (k: number) => countWord(k, 'وردة واحدة', 'وردتان', 'وردات', 'وردة')
const holesWord = (k: number) => countWord(k, 'فتحة واحدة', 'فتحتان', 'فتحات', 'فتحة')
const stripsWord = (k: number) => countWord(k, 'شريحة واحدة', 'شريحتان', 'شرائح', 'شريحة')

// ------------------------------------------------------------------ the build

const holesOf = (pcs: Piece[], dx = 0, dy = 0): Loop[] => pcs.map(pc => polyLoop(rounded(moved(pc.pts, dx, dy)), 'hole'))
/** Do w × h fit the sheet one way or the other? */
const fitsSheet = (w: number, h: number, L: number, W: number) => (w <= L + 1e-9 && h <= W + 1e-9) || (w <= W + 1e-9 && h <= L + 1e-9)

/** The checks; every value they suggest clears its own error. */
export function frameErrors(p: Record<string, number>, g: FrameGeom): string[] {
  const errors: string[] = []
  const { PW, PH, ov, b, web, rail, fit, center } = g, sL = p.sheetL, sW = p.sheetW, co = CLEAT_REACH
  const WpMin = minPatternWidth(web)
  if (g.Wp < WpMin - 1e-9) {
    const bandMin = up5(ov + web + rail + WpMin), ovMax = down5(b - web - rail - WpMin)
    if (ov > 0.4 * b && ovMax >= 0) errors.push(`الركبة على الجبس (${f1(ov)} مم) كبيرة على عرض الإطار (${f1(b)} مم): ${b - ov > 0 ? `يظهر منه ${f1(b - ov)} مم فقط ولا تتّسع فيه وردة` : 'لا يظهر منه شيء'}. اجعل الركبة ${f1(ovMax)} مم على الأكثر، أو عرض الإطار ${f1(bandMin)} مم على الأقل.`)
    else errors.push(`عرض الإطار (${f1(b)} مم) قليل: لا تتّسع وردة في الجزء الظاهر منه. اجعله ${f1(bandMin)} مم على الأقل.`)
    return errors
  }
  // the band too wide: the frame's opening, or the corner rosettes running into each other
  const okAt = (q: Record<string, number>) => { const h = frameGeom({ ...p, ...q }); return h.n1 > 0 && h.n2 > 0 && Math.min(h.PW, h.PH) - 2 * h.b >= MIN_OPEN }
  const okBand = (bb: number) => okAt({ band: bb })
  if (!okBand(b)) {
    let bb = down5(b)
    const bandMin = up5(ov + web + rail + WpMin)
    while (bb >= bandMin && !okBand(bb)) bb -= 0.5
    if (bb >= bandMin) errors.push(`عرض الإطار (${f1(b)} مم) كبير على ديكور ${f1(PW)} × ${f1(PH)} مم: اجعله ${f1(bb)} مم على الأكثر.`)
    else {
      // even the narrowest band is too much: less rest on the gypsum (a narrower band then fits), or a bigger decor
      const bandAt = (o: number) => up5(o + web + rail + WpMin)
      let o = down5(ov) - 0.5
      while (o >= 0 && !okAt({ ov: o, band: bandAt(o) })) o -= 0.5
      let X = up5(Math.min(PW, PH))
      while (X <= SIZE_MAX && !okAt({ PW: Math.max(PW, X), PH: Math.max(PH, X), band: bandMin })) X += 0.5
      const fixes = [
        ...(o >= 0 ? [`اجعل الركبة ${f1(o)} مم على الأكثر`] : []),
        ...(X <= SIZE_MAX ? [`اجعل ${PW < X && PH < X ? 'العرض والطول الكلّيين' : PW < X ? 'العرض الكلّي' : 'الطول الكلّي'} ${f1(X)} مم على الأقل`] : []),
      ]
      errors.push(`الديكور ${f1(PW)} × ${f1(PH)} مم صغير على إطار فيه ركبة ${f1(ov)} مم على الجبس: ${fixes.length ? fixes.join('، أو ') : 'اجعل الركبة 0 مم'}.`)
    }
    return errors
  }
  if (center === 1) {
    const medMax = down5(Math.min(g.Wf, g.Hf) - 2 * (co + web))
    if (p.med > medMax + 1e-9) {
      // or a narrower band, so the field grows round the medallion
      const bb = down5((Math.min(PW, PH) - 2 * fit - 2 * (co + web) - p.med) / 2), bbOk = bb >= up5(ov + web + rail + WpMin) && okBand(bb)
      if (medMax >= 150) errors.push(`المثمّن (${f1(p.med)} مم) أكبر من اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم: اجعله ${f1(medMax)} مم على الأكثر${bbOk ? `، أو اجعل عرض الإطار ${f1(bb)} مم على الأكثر` : ''}.`)
      else {
        errors.push(bbOk
          ? `اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم صغير على المثمّن (${f1(p.med)} مم): اجعل عرض الإطار ${f1(bb)} مم على الأكثر، أو اختر «إطار فقط».`
          : `اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم صغير على مثمّن: اختر «إطار فقط».`)
      }
    }
  } else if (center === 2) {
    const medMax = down5(Math.min(Math.min(PW, PH) - 2 * b - 20, sW))
    if (p.med > medMax + 1e-9) errors.push(medMax >= 150 ? `المثمّن (${f1(p.med)} مم) أكبر من فتحة الإطار${medMax === down5(sW) ? ' أو من اللوح' : ''}: اجعله ${f1(medMax)} مم على الأكثر.` : `فتحة الإطار صغيرة على مثمّن: اختر «إطار فقط».`)
  }
  // every piece on one sheet
  const Lmax = Math.max(PW, PH)
  if (Lmax > sL + 1e-9) errors.push(`الشريحة ${f1(Lmax)} مم أطول من لوح الخشب (${f1(sL)} مم): اجعل ${Math.min(PW, PH) > sL + 1e-9 ? 'العرض والطول الكلّيين' : PW >= PH ? 'العرض الكلّي' : 'الطول الكلّي'} ${f1(down5(sL))} مم على الأكثر.`)
  else if (b > sW + 1e-9) errors.push(`عرض الإطار (${f1(b)} مم) أعرض من لوح الخشب (${f1(sW)} مم): اجعله ${f1(down5(sW))} مم على الأكثر.`)
  else if (center === 1 && !fitsSheet(g.Wf, g.Hf, sL, sW)) {
    const bb = up5(Math.max((Math.max(PW, PH) - 2 * fit - sL) / 2, (Math.min(PW, PH) - 2 * fit - sW) / 2))
    const can = bb <= BAND_MAX && okBand(bb) && p.med <= Math.min(PW, PH) - 2 * bb - 2 * fit - 2 * (co + web)
    errors.push(`اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم لا يتّسع في لوح ${f1(sL)} × ${f1(sW)} مم: ${can ? `اجعل عرض الإطار ${f1(bb)} مم على الأقل، أو ` : ''}اختر «مثمّن منفصل».`)
  }
  if (p.back >= 0.5 && !fitsSheet(PW, PH, sL, sW)) {
    const short = PW <= PH ? 'العرض' : 'الطول'
    errors.push(`لوح الأكريليك ${f1(PW)} × ${f1(PH)} مم أكبر من لوح ${f1(sL)} × ${f1(sW)} مم: ألغِه (0) وضع قماشاً أبيض${Math.max(PW, PH) <= sL + 1e-9 ? `، أو اجعل ${short} الكلّي ${f1(down5(sW))} مم على الأكثر` : ''}.`)
  }
  return errors
}
/** The narrowest opening left inside the frame (mm), the widest band the field takes, the largest decor size. */
const MIN_OPEN = 60, BAND_MAX = 600, SIZE_MAX = 2440

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], notes: string[] = []
  const g = frameGeom(p)
  const { PW, PH, ov, b, web, fit, center, field } = g, n = Math.max(1, Math.round(p.n)), co = CLEAT_REACH, cleats = p.cleats >= 0.5
  if (c.kerf > c.t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  const errors = frameErrors(p, g)
  if (errors.length) return { panels: [], notes, warnings, errors }

  const { top, side } = framePieces(g)
  const panels: PanelSpec[] = [
    { id: 'strip-long', name: 'شريحة الإطار — العلوية والسفلية', w: PW, h: b, shape: [polyLoop(stripOutline(PW, b), 'outer')], holes: holesOf(top), count: 2 * n, note: 'الحافّة الطويلة للخارج، والشطفان على 45°' },
    { id: 'strip-short', name: 'شريحة الإطار — الجانبية', w: PH, h: b, shape: [polyLoop(stripOutline(PH, b), 'outer')], holes: holesOf(side), count: 2 * n, note: 'الحافّة الطويلة للخارج، والشطفان على 45°' },
  ]
  let midHoles = 0
  if (center !== 3) {
    const pcs = medallion({ x: 0, y: 0 }, p.med, web)
    midHoles = pcs.length
    if (field) panels.push({ id: 'field', name: 'اللوح الأوسط مع المثمّن', w: g.Wf, h: g.Hf, holes: holesOf(pcs, g.Wf / 2, g.Hf / 2), count: n })
    else {
      const oc = octagon({ x: 0, y: 0 }, p.med)
      panels.push({ id: 'medallion', name: 'المثمّن', w: p.med, h: p.med, shape: [polyLoop(oc.map(q => ({ x: round3(q.x), y: round3(q.y) })), 'outer')], holes: holesOf(pcs), count: n })
    }
  }
  const plate = cleats ? cornerPlate(g) : null
  if (cleats && !plate) warnings.push(ov + web - 1 < 6 ? `الركبة على الجبس (${f1(ov)} مم) لا تتّسع لقطع الزوايا خلف الشطف: الصق الشطوف بالغراء وثبّتها بشريط من خلف، أو اجعل الركبة ${f1(up5(7 - web))} مم على الأقل.` : 'لا مكان لقطع الزوايا خلف الشطف على هذا المقاس: الصق الشطوف بالغراء وثبّتها بشريط من خلف.')
  if (plate) panels.push({ id: 'corner', name: 'قطعة زاوية خلف الشطف', w: plate.arm, h: plate.arm, shape: [polyLoop(plate.pts, 'outer')], count: 4 * n, note: 'تُلصق خلف الزاوية: الضلعان على الحافّة الخارجية المصمتة والذراع على خط الشطف' })
  const wC = round3(2 * co + fit), lLong = round3(PW - 2 * b + 2 * co), lShort = round3(PH - 2 * b - 2 * fit - 2 * co - 2)
  const inner = cleats && field
  if (inner) {
    panels.push({ id: 'cleat-long', name: 'شريحة تدعيم — طويلة', w: lLong, h: wC, count: 2 * n, note: 'خلف الوصلة العلوية والسفلية: نصفها على الشريحة ونصفها على اللوح الأوسط' })
    if (lShort > 20) panels.push({ id: 'cleat-short', name: 'شريحة تدعيم — قصيرة', w: lShort, h: wC, count: 2 * n, note: 'خلف الوصلة الجانبية، بين الطويلتين' })
  }
  if (p.back >= 0.5) panels.push({ id: 'back', name: 'لوح أكريليك أوبال', w: PW, h: PH, count: n, material: 'white', note: 'أبيض حليبي، فوق الديكور' })

  // -------------------------------------------------------------- notes
  const k1 = g.n1 - 1, k2 = g.n2 - 1, total = 2 * top.length + 2 * side.length + midHoles
  notes.push(
    ov > 0
      ? `الديكور من الخارج ${f1(PW)} × ${f1(PH)} مم والركبة على الجبس محسوبة فيه: يرتكز كلّ طرف ${f1(ov)} مم على لوح الجبسن بورد ويبقى خشباً مصمتاً مخفيّاً، فالفتحة الظاهرة ${f1(PW - 2 * ov)} × ${f1(PH - 2 * ov)} مم.`
      : `الديكور ${f1(PW)} × ${f1(PH)} مم بلا ركبة على الجبس: يظهر كلّه من تحت.`,
    `الإطار أربع شرائح تلتقي بزوايا مشطوفة 45°، عرضها ${f1(b)} مم يظهر منها ${f1(b - ov)} مم. العلوية والسفلية قطعتان متطابقتان: ${f1(PW)} مم من الخارج و${f1(PW - 2 * b)} مم من الداخل، في كلّ منهما ${rosettesWord(k1)} كاملة بينها ${f1(g.p1)} مم. الجانبيتان قطعتان: ${f1(PH)} مم من الخارج و${f1(PH - 2 * b)} مم من الداخل، في كلّ منهما ${rosettesWord(k2)} بينها ${f1(g.p2)} مم.`,
    `في كلّ زاوية وردة على خط الشطف نصفها في كلّ شريحة: البتلة التي على الخط ووسط الوردة يتركان مكانهما لشريط خشب مصمت عرضه ${f1(2 * web)} مم على الأقل يمرّ فيه الشطف، فلا يقطع الشطف أيّ فتحة والزاوية صورة مرآة حوله، والزوايا الأربع متشابهة.`,
  )
  if (field) notes.push(`اللوح الأوسط ${f1(g.Wf)} × ${f1(g.Hf)} مم (خلوص ${f1(fit)} مم من كلّ جهة)، وفي وسطه المثمّن ${f1(p.med)} مم بين ضلعين متقابلين: نجمة من 16 رأساً تخرج منها 16 بتلة طويلة، وحولها نجوم صغيرة ودوائر، وعلى حافّته 16 فتحة شبه منحرف؛ وحوافّ اللوح مصمتة ${f1(co + web)} مم على الأقل.`)
  else if (center === 2) notes.push(`المثمّن قطعة منفصلة ${f1(p.med)} مم بين ضلعين متقابلين: الصقه في وسط سقف التجويف فوق الفتحة (أو على لوح الأكريليك) فيظهر من وسط الإطار.`)
  else notes.push('إطار فقط: الوسط مفتوح ويظهر منه سقف التجويف.')
  if (plate || inner) notes.push(`قطع التدعيم من نفس اللوح، تُلصق من الخلف فوق الخشب المصمت فقط فلا تسدّ أيّ فتحة:${plate ? ` ${4 * n} قطع زاوية على شكل L، ضلعاها ${f1(plate.arm)} مم وعرضهما ${f1(plate.w)} مم على الحافّة التي ترتكز على الجبس${plate.diag ? `، وذراعها عرضه ${f1(2 * plate.h)} مم على خط الشطف` : ''}` : ''}${plate && inner ? '؛' : ''}${inner ? ` ${stripsWord(2 * n)} ${f1(lLong)} × ${f1(wC)} مم${lShort > 20 ? ` و${stripsWord(2 * n)} ${f1(lShort)} × ${f1(wC)} مم` : ''} خلف وصلة اللوح الأوسط، ${f1(co)} مم منها على الحافّة المصمتة للشريحة و${f1(co)} مم على اللوح الأوسط` : ''}.`)
  else if (field) notes.push(`اللوح الأوسط يحتاج دعماً من خلف وصلته: الصق شرائح ${f1(2 * co)} مم نصفها على حافّة الشريحة المصمتة (${f1(co + web)} مم) ونصفها على اللوح الأوسط.`)
  notes.push(
    `عدد الفتحات: ${f1(top.length)} في كلّ شريحة طويلة و${f1(side.length)} في كلّ جانبية${midHoles ? ` و${f1(midHoles)} في المثمّن` : ''} — ${holesWord(total)} في الديكور كلّه.`,
    'في RDWorks اقصّ الفتحات الداخلية أولاً ثم المحيط الخارجي لكلّ قطعة (ترتيب القصّ من الداخل إلى الخارج) حتى لا تتحرّك القطعة قبل أن تكتمل فتحاتها، وثبّت اللوح مستوياً على السرير. الشرائح شبه منحرفة: رتّب كلّ اثنتين على اللوح واحدة مقلوبة بجانب الأخرى فتتداخل أطرافهما المشطوفة ويقلّ الهدر.',
    `التجميع على طاولة مستوية والوجه الظاهر للأسفل: رصّ الشرائح الأربع وألصق الشطوف بغراء الخشب${plate ? ' ثم ألصق قطع الزوايا فوقها' : ''}${field ? `، ثم ضع اللوح الأوسط في مكانه${inner ? ' وألصق شرائح التدعيم فوق وصلته' : ''}` : ''}. اتركه يجفّ تماماً، ثم ادهنه أو رشّه (الوجه وحوافّ الفتحات) قبل التركيب.`,
    `التركيب: أدخل الديكور من الفتحة مائلاً إلى فوق الجبس، ثم أنزله مسطّحاً والوجه المزخرف للأسفل حتى ترتكز حافّته الخارجية${ov > 0 ? ` (${f1(ov)} مم من كلّ جهة)` : ''} على لوح الجبسن بورد.`,
    `ضوء النيون في التجويف فوقه يمرّ من الفتحات؛ لضوء ناعم بلا خطوط ظاهرة ضع فوقه لوح أكريليك أوبال (أبيض حليبي) أو قماشاً أبيض مشدوداً${p.back >= 0.5 ? `، ولوح الأكريليك ${f1(PW)} × ${f1(PH)} مم في الملف بلونه الخاصّ` : ''}.`,
    `الخشب: MDF أو بلاي ${c.t} مم؛ الشرائح طويلة وفتحاتها كثيرة، فالأمتن 4–6 مم.`,
    'لديكوريك: أدخل 1400 × 1050 للأول و1380 × 1080 للثاني كما هما، فالركبة على الجبس محسوبة فيهما.',
  )
  // the rosettes' dashed rings are short cut-outs, not slots: nothing here slots together
  return { panels, notes, warnings, errors, slotted: false }
}

export const CEILING_FRAMES: Template[] = [
  {
    id: 'ceilingframe',
    name: 'ديكور سقف: إطار وردات بزوايا 45 ومثمّن',
    desc: 'ديكور خشب مفرّغ لفتحة إضاءة في سقف جبس (جبسن بورد): إطار من أربع شرائح بزوايا مشطوفة 45° فيه وردات إسلامية من 16 بتلة، وفي الوسط مثمّن بنجمة وبتلات. المقاس هو مقاس الفتحة مع الركبة على الجبس، فيرتكز طرفه على لوح الجبس ويمرّ ضوء النيون من الفتحات. الزخرفة متناظرة حول خط الشطف في كلّ زاوية، ولوح وسط بالمثمّن أو مثمّن منفصل أو إطار فقط، مع قطع تدعيم من نفس اللوح.',
    icon: `<path d="M4 12h56v40H4z"/><path d="M15 23h34v18H15z"/><path d="M4 12l11 11M60 12L49 23M4 52l11-11M60 52L49 41" stroke-width="1.5"/><path d="M28 27h8l4 4v2l-4 4h-8l-4-4v-2z" stroke-width="1.5"/><circle cx="9.5" cy="17.5" r="3" stroke-width="1.2"/><circle cx="21" cy="17.5" r="3" stroke-width="1.2"/><circle cx="32" cy="17.5" r="3" stroke-width="1.2"/><circle cx="43" cy="17.5" r="3" stroke-width="1.2"/><circle cx="54.5" cy="17.5" r="3" stroke-width="1.2"/><circle cx="9.5" cy="32" r="3" stroke-width="1.2"/><circle cx="54.5" cy="32" r="3" stroke-width="1.2"/><circle cx="9.5" cy="46.5" r="3" stroke-width="1.2"/><circle cx="21" cy="46.5" r="3" stroke-width="1.2"/><circle cx="32" cy="46.5" r="3" stroke-width="1.2"/><circle cx="43" cy="46.5" r="3" stroke-width="1.2"/><circle cx="54.5" cy="46.5" r="3" stroke-width="1.2"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]
