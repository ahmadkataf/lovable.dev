// A classic door skin with a laser-engraved line drawing, traced from the customer's photo ('doorvase'): an outer
// rectangle; a tall top panel with a curved bottom holding a vase on a turned stem with a bouquet (two six-petal flowers
// and buds), long leaves curling down both sides, a heart-shaped loop between two lilies on scrolling stems, C-scrolls
// and acanthus at the foot and a drop leaf; a narrow curved band; a lower panel with an acanthus ornament. The lines are
// engraved on the engraving layer as single laser passes; the door panel's outline is the red alignment frame.
//
// The lines have two weights, as on the photo: bold (the ornaments' outlines, each double line's inner line) and fine
// (veins, petal lines, the vase's flutes, the stem's rings, small curls; the outer rectangle and each double line's
// outer line). A bold stroke is engraved as `thick` laser lines side by side, lw apart and centred on the traced line,
// a fine one as `thin` (one by default); the burns of neighbouring lines just touch. Strokes the trace split at a
// corner or a tip (two ends meeting) are joined first, so their lines run on round it, rounded outside and cleared
// inside, as one groove; a right-hand copy is engraved as its partner's mirror image. The strokes go in an order where a
// stroke that ends on another comes after it; each line stops lw short of every line already there, so where strokes
// meet the later one's lines end at the earlier one's edge, no wood is burnt twice and no gap is left.
//
// How the drawing was measured (the photo: 780 × 1040 px, the left door skin about 300 px wide):
// - the outer engraved rectangle's sides were located to sub-pixel accuracy (edge positions fitted along each side)
//   and the photo was warped onto a straight rectangle (a perspective transform plus a smooth correction for the
//   slightly bowed skin, which leaves the four sides straight to about 0.2 px);
// - its proportions: a pinhole camera with a gently bent panel, fitted to the four sides, gives height / width 2.64
//   whatever the focal length (the photo is taken almost square on); 2.65 was used. As a check, the margins between the
//   outer rectangle and the panels (54 units across, 58 down, on a frame 1000 wide) and the spacing of the double lines
//   (18 across, 17.7–19 down) come out nearly the same both ways, as such lines are drawn;
// - the drawing is mirror-symmetric: the rectified photo was averaged with its mirror image about the centre line
//   (found to 0.5 px), the lines extracted (background flattening, black-hat filter, hysteresis threshold, wood grain
//   streaks removed), skeletonised and turned into polylines, broken strokes merged, spurs dropped, the strokes snapped
//   to the centre of the photo's line and fitted with smoothing splines that keep the sharp tips; the left half was
//   traced and mirrored. Every stroke was then checked over the photo, zoomed region by region, and corrected by hand
//   where the photo shows more (junctions, slivers where two lines run into one tip, faint tails): on a 590 mm drawing
//   the traced lines lie on the middle of the photo's lines to 0.3 mm on average, 95% within 1 mm and all within
//   2.2 mm, where a line shows about 4 mm wide in the photo;
// - the weights: across every stroke the photo's darkness was sampled, and a line of width w blurred by the camera
//   (one blur and one burn darkness for the whole photo, fitted to the long straight frame lines) fitted to each
//   stroke's median profile, both mirror halves pooled: the widths fall in two clear groups, about 2.8 mm and 4.8 mm
//   on the 590 mm drawing (thin below 3.8 mm). Strokes that change along their length (an outline running on
//   into an inner line) were split where they do, and the photo was checked stroke by stroke where the measure was
//   unsure (short strokes, tips where two lines run together). A second, independent measure on the unwarped photo
//   (the darkness integrated across each line, so blur does not matter) gives the same two groups with no stroke in
//   between (fine at most 2.0, bold at least 2.3, in mm × darkness; the frame's fine lines 1.5, bold ones 2.7), and the
//   drop above the heart bold above the heart's arms but fine below them;
// - the structural lines were rebuilt as clean geometry fitted to the trace: straight lines, and circular arcs (the
//   top panel's bottom and the band's top concentric, the band's bottom and the lower panel's top concentric).
//
// At another size the structure is rebuilt for DW × DH: line spacings, margins and the arcs' radii scale with the width
// (so the arcs keep their sag), the band stays at the same fraction of the height, and the panels take up the rest.
// Each ornament is scaled uniformly (never stretched) to fit its panel as in the photo, centred across, and any height
// it does not need is shared equally above and below it.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, round3, loopLength, offsetLoop, arcInfo } from './geom'
import { REF_W, REF_H, REF, TOP, LOW, FRAME_W, Stroke } from './doorvase-art'

type P2 = { x: number; y: number }
type Arc = readonly [number, number]

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

/** the drawing keeps this much of the panel all round */
export const EDGE = 10
/** narrower than this the ornament's finest gaps (under a millimetre) would close up */
export const MIN_DW = 250
/** height / width of the drawing: the photo's is 2.65 */
export const ASPECT: readonly [number, number] = [2, 3.6]
/** the band's middle (between the top panel's bottom and the lower panel's top) as a fraction of the drawing's height */
const BAND_Y = (REF.topOutBot[0] + REF.lowOutTop[0]) / 2
const BAND = BAND_Y / REF_H
/** the closest the two lines of a double line come, centre to centre, on the reference frame */
const DOUBLE = Math.min(REF.xi - REF.xo, REF.topI - REF.topO, REF.botO - REF.botI, REF.topOutBot[0] - REF.topInBot[0], REF.bandInTop[0] - REF.bandOutTop[0], REF.bandOutBot[0] - REF.bandInBot[0], REF.lowInTop[0] - REF.lowOutTop[0])
/** wood kept between the engraving of a double line's two lines */
export const WOOD = 2

// ------------------------------------------------------------------ the ornaments, mirrored once

/** one whole stroke in the reference frame: its centre line, and per segment whether it is bold (several laser lines) */
export interface ArtStroke {
  pts: Float64Array; closed: boolean; bold: Uint8Array; /** strokes and their mirror images share a unit */ unit: number
  /** the right-hand copy of a stroke: its left partner's mirror image, run backwards */
  mirror?: boolean
}

/** Each stroke of a group as a whole polyline in the reference frame: the left half and its mirror image. */
function expand(group: Stroke[], unit0: number): ArtStroke[] {
  const out: ArtStroke[] = []
  const mir = (p: number[]) => { const q: number[] = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(REF_W - p[i], p[i + 1]); return q }
  group.forEach((s, u) => {
    const n = s.p.length / 2, nSeg = s.k !== 's' && s.closed ? n : n - 1
    const bold = new Uint8Array(nSeg).fill(s.w === 'b' ? 1 : 0)
    for (let i = 0; s.f && i + 1 < s.f.length; i += 2) bold.fill(0, s.f[i], s.f[i + 1])
    const unit = unit0 + u
    if (s.k === 'c') { out.push({ pts: Float64Array.from(s.p), closed: false, bold, unit }); return }
    // a mirrored stroke runs backwards: its segment j is the original's n − 2 − j (a closed one's closing segment stays last)
    const back = Uint8Array.from({ length: nSeg }, (_, j) => bold[j < n - 1 ? n - 2 - j : j])
    if (s.k === 'p') { out.push({ pts: Float64Array.from(s.p), closed: !!s.closed, bold, unit }, { pts: Float64Array.from(mir(s.p)), closed: !!s.closed, bold: back, unit }); return }
    // across the axis: the left half ends on the axis, the right half is its mirror (the shared axis point once);
    // a closed one starts on the axis too, and the loop closes there. Segment n − 1 + j is the original's n − 2 − j.
    const m = mir(s.p).slice(2)
    const pts = Float64Array.from([...s.p, ...(s.closed ? m.slice(0, -2) : m)])
    const all = new Uint8Array(2 * n - 2)
    for (let j = 0; j < 2 * n - 2; j++) all[j] = bold[j < n - 1 ? j : 2 * n - 3 - j]
    out.push({ pts, closed: !!s.closed, bold: all, unit })
  })
  return out
}

/**
 * The order the strokes are engraved in. Where a stroke ends on another (a T-junction), the one running through is
 * drawn first, so the ending one's lines stop at its lines and it stays whole; otherwise bold strokes before fine ones
 * and longer before shorter. A stroke and its mirror image go together.
 */
function drawingOrder(all: ArtStroke[]): number[] {
  const units = new Map<number, number[]>()
  all.forEach((s, i) => { const u = units.get(s.unit); if (u) u.push(i); else units.set(s.unit, [i]) })
  const len = (s: ArtStroke) => { let L = 0; for (let i = 2; i < s.pts.length; i += 2) L += Math.hypot(s.pts[i] - s.pts[i - 2], s.pts[i + 1] - s.pts[i - 1]); return L }
  const rank = new Map<number, number>()
  for (const [u, ids] of units) rank.set(u, (ids.some(i => all[i].bold.some(b => b)) ? 1e6 : 0) + len(all[ids[0]]))
  // which stroke each open end lies on: within 0.6 mm of another stroke's line, away from that stroke's own ends
  const after = new Map<number, Set<number>>()
  const near = (q: P2, s: ArtStroke) => {
    let d = Infinity, at = 0, L = 0, best = 0
    const n = s.pts.length / 2, m = s.closed ? n : n - 1
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n, ax = s.pts[2 * i], ay = s.pts[2 * i + 1], bx = s.pts[2 * j], by = s.pts[2 * j + 1]
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, l = Math.sqrt(l2)
      const t = l2 ? Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.y - ay) * dy) / l2)) : 0
      const dd = Math.hypot(q.x - ax - t * dx, q.y - ay - t * dy)
      if (dd < d) { d = dd; at = L + t * l }
      L += l
    }
    best = s.closed ? Infinity : Math.min(at, L - at)
    return { d, fromEnd: best }
  }
  const box = all.map(s => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < s.pts.length; i += 2) { x0 = Math.min(x0, s.pts[i]); x1 = Math.max(x1, s.pts[i]); y0 = Math.min(y0, s.pts[i + 1]); y1 = Math.max(y1, s.pts[i + 1]) } return [x0 - 1, y0 - 1, x1 + 1, y1 + 1] })
  all.forEach(s => {
    if (s.closed) return
    const n = s.pts.length / 2
    for (const k of [0, n - 1]) {
      const q = { x: s.pts[2 * k], y: s.pts[2 * k + 1] }
      all.forEach((o, j) => {
        if (o.unit === s.unit || q.x < box[j][0] || q.x > box[j][2] || q.y < box[j][1] || q.y > box[j][3]) return
        const r = near(q, o)
        if (r.d < 0.6 && r.fromEnd > 1.5) { const a = after.get(s.unit) ?? new Set<number>(); a.add(o.unit); after.set(s.unit, a) }
      })
    }
  })
  // Kahn's order, the highest-ranked free unit first; a cycle is broken at its highest-ranked unit
  const left = new Set(units.keys()), order: number[] = []
  while (left.size) {
    let pick = -1, pr = -Infinity, any = -1, ar = -Infinity
    for (const u of left) {
      const r = rank.get(u)!
      if (r > ar) { ar = r; any = u }
      if (![...(after.get(u) ?? [])].some(v => left.has(v)) && r > pr) { pr = r; pick = u }
    }
    const u = pick >= 0 ? pick : any
    left.delete(u); order.push(...units.get(u)!)
  }
  return order
}

/**
 * Strokes that end where another ends (the trace split an outline at a corner or a tip) joined into one, so its laser
 * lines run on round the corner (rounded outside, cleared inside) instead of stopping square against each other with
 * a notch between. Where three or more ends meet, the pair of the same weight that runs on most smoothly is joined and
 * the others end on it. The joined stroke takes the lowest unit of its parts (a stroke and its mirror image still share one).
 */
function chain(strokes: ArtStroke[]): ArtStroke[] {
  const TOL = 0.5, N = strokes.length
  // end 2i is stroke i's start, 2i + 1 its end
  const at = (e: number) => { const s = strokes[e >> 1].pts, k = e & 1 ? s.length - 2 : 0; return { x: s[k], y: s[k + 1] } }
  /** unit vector from an end back into its stroke (over its first 2 mm or so, for a steady direction) */
  const inward = (e: number) => {
    const s = strokes[e >> 1].pts, n = s.length / 2, a = at(e)
    let q = a
    for (let j = 1; j < n; j++) { const k = e & 1 ? n - 1 - j : j; q = { x: s[2 * k], y: s[2 * k + 1] }; if (Math.hypot(q.x - a.x, q.y - a.y) >= 2) break }
    const l = Math.hypot(q.x - a.x, q.y - a.y) || 1
    return { x: (q.x - a.x) / l, y: (q.y - a.y) / l }
  }
  const wAt = (e: number) => { const b = strokes[e >> 1].bold; return b[e & 1 ? b.length - 1 : 0] }
  // every pair of open ends that meet, scored: same weight first, then the smallest turn from one into the other
  const cells = new Map<number, number[]>(), key = (x: number, y: number) => Math.floor(x / TOL) * 100003 + Math.floor(y / TOL)
  for (let e = 0; e < 2 * N; e++) {
    if (strokes[e >> 1].closed) continue
    const q = at(e), k = key(q.x, q.y), c = cells.get(k)
    if (c) c.push(e); else cells.set(k, [e])
  }
  const pairs: { a: number; b: number; score: number }[] = []
  for (let a = 0; a < 2 * N; a++) {
    if (strokes[a >> 1].closed) continue
    const pa = at(a), cx = Math.floor(pa.x / TOL), cy = Math.floor(pa.y / TOL)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const b of cells.get((cx + dx) * 100003 + cy + dy) ?? []) {
      if (b <= a) continue
      const pb = at(b)
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > TOL || (b >> 1 === a >> 1 && strokes[a >> 1].pts.length < 8)) continue
      const ua = inward(a), ub = inward(b)
      pairs.push({ a, b, score: (wAt(a) === wAt(b) ? 0 : 10) + Math.acos(Math.max(-1, Math.min(1, -(ua.x * ub.x + ua.y * ub.y)))) })
    }
  }
  pairs.sort((u, v) => u.score - v.score || u.a - v.a || u.b - v.b)
  // the best pairs first, each end joined once
  const mate = new Int32Array(2 * N).fill(-1)
  for (const { a, b } of pairs) if (mate[a] < 0 && mate[b] < 0) { mate[a] = b; mate[b] = a }
  // walk each chain from a free end (a ring of strokes from any), each stroke turned to run on from the one before
  const seen = new Uint8Array(N), out: ArtStroke[] = []
  const walk = (first: number) => {
    const p: number[] = [], b: number[] = []
    let e = first, unit = Infinity, closed = false
    for (;;) {
      const i = e >> 1, s = strokes[i], n = s.pts.length / 2
      seen[i] = 1; unit = Math.min(unit, s.unit)
      const fwd = (e & 1) === 0, q: number[] = []
      for (let k = 0; k < n; k++) { const m = fwd ? k : n - 1 - k; q.push(s.pts[2 * m], s.pts[2 * m + 1]) }
      const bs = Array.from(s.bold); if (!fwd) bs.reverse()
      if (p.length) { p[p.length - 2] = (p[p.length - 2] + q[0]) / 2; p[p.length - 1] = (p[p.length - 1] + q[1]) / 2; p.push(...q.slice(2)) } else p.push(...q)
      b.push(...bs)
      const out_ = e ^ 1, next = mate[out_]
      if (next < 0) break
      if (seen[next >> 1]) { closed = true; p[0] = (p[0] + p[p.length - 2]) / 2; p[1] = (p[1] + p[p.length - 1]) / 2; p.length -= 2; break }
      e = next
    }
    out.push({ pts: Float64Array.from(p), closed, bold: Uint8Array.from(b), unit })
  }
  for (let i = 0; i < N; i++) {
    if (seen[i]) continue
    if (strokes[i].closed) { seen[i] = 1; out.push(strokes[i]); continue }
    // go back to the chain's free end
    let e = 2 * i, guard = 0
    while (mate[e] >= 0 && !(mate[e] >> 1 === i && guard > 0) && guard++ < N) e = mate[e] ^ 1
    walk(mate[e] >= 0 ? 2 * i : e)
  }
  // a stroke on the right runs as its left partner's mirror image backwards (as expand gives it), so that both are
  // engraved alike: the same lines on the same sides, in mirrored order
  const mean = (s: ArtStroke) => { let x = 0; for (let k = 0; k < s.pts.length; k += 2) x += s.pts[k]; return (2 * x) / s.pts.length }
  const mirrorOf = (s: ArtStroke, o: ArtStroke, back: boolean) => {
    const n = s.pts.length
    if (o === s || o.pts.length !== n) return false
    const k = back ? n - 2 : 0
    return Math.abs(REF_W - o.pts[k] - s.pts[0]) < 1e-6 && Math.abs(o.pts[k + 1] - s.pts[1]) < 1e-6
  }
  for (let i = 0; i < out.length; i++) {
    const s = out[i]
    if (s.closed || mean(s) <= REF_W / 2 + 1e-6 || !out.some(o => mirrorOf(s, o, false))) continue
    const n = s.pts.length / 2, p = new Float64Array(2 * n)
    for (let k = 0; k < n; k++) { p[2 * k] = s.pts[2 * (n - 1 - k)]; p[2 * k + 1] = s.pts[2 * (n - 1 - k) + 1] }
    out[i] = { ...s, pts: p, bold: Uint8Array.from(s.bold).reverse() }
  }
  // which are right-hand copies: their partner's last point mirrors their first
  return out.map(s => ({ ...s, mirror: mean(s) > REF_W / 2 + 1e-6 && out.some(o => mirrorOf(s, o, true)) }))
}

let ART: { top: ArtStroke[]; low: ArtStroke[]; order: number[] } | null = null
/** the ornaments in the reference frame and the order they are engraved in (indices into [...top, ...low]), worked out once */
export function art() {
  if (!ART) { const top = chain(expand(TOP, 0)), low = chain(expand(LOW, TOP.length)); ART = { top, low, order: drawingOrder([...top, ...low]) } }
  return ART
}

// ------------------------------------------------------------------ the layout

/** Bulge of the arc from p to q through m (b > 0 bows to the right of p → q on screen, as in geom.ts). */
function bulgeThrough(p: P2, q: P2, m: P2): number {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy)
  const s = ((m.x - (p.x + q.x) / 2) * -dy + (m.y - (p.y + q.y) / 2) * dx) / L
  return (2 * s) / L
}

export interface DoorLayout {
  /** mm per reference mm for the line work */
  g: number
  /** the structural lines (closed), the drawing's top-left corner at the origin */
  frame: Loop[]
  /** each ornament: its scale and where the reference frame's point (x, y) lands: (DW / 2 + (x − REF_W / 2)·s, y0 + (y − ref)·s) */
  top: { s: number; y0: number; ref: number }
  low: { s: number; y0: number; ref: number }
}

/** The structure of a DW × DH drawing and where its ornaments go (no checks: see errorsOf). */
export function layout(DW: number, DH: number): DoorLayout {
  const g = DW / REF_W, cx = DW / 2
  const Y = (yRef: number) => BAND * DH + (yRef - BAND_Y) * g
  const arc = (a: Arc) => ({ ya: Y(a[0]), R: a[1] * g })
  const yOn = (a: { ya: number; R: number }, x: number) => a.ya - a.R + Math.sqrt(Math.max(0, a.R * a.R - (x - cx) ** 2))
  const v = (x: number, y: number, b?: number): Vtx => (b ? { x: round3(x), y: round3(y), b } : { x: round3(x), y: round3(y) })
  /** an arc's vertex at x0 running to DW − x0 (or back), with its bulge */
  const along = (a: { ya: number; R: number }, x0: number, x1: number): Vtx => {
    const p = { x: x0, y: yOn(a, x0) }, q = { x: x1, y: yOn(a, x1) }
    return v(p.x, p.y, bulgeThrough(p, q, { x: cx, y: a.ya }))
  }
  const xs = [REF.xo * g, REF.xi * g]
  const topY = [REF.topO * g, REF.topI * g], botY = [DH - (REF_H - REF.botO) * g, DH - (REF_H - REF.botI) * g]
  const A = {
    topBot: [arc(REF.topOutBot), arc(REF.topInBot)], bandTop: [arc(REF.bandOutTop), arc(REF.bandInTop)],
    bandBot: [arc(REF.bandOutBot), arc(REF.bandInBot)], lowTop: [arc(REF.lowOutTop), arc(REF.lowInTop)],
  }
  const frame: Loop[] = [{ closed: true, layer: 'engrave', pts: [v(0, 0), v(DW, 0), v(DW, DH), v(0, DH)] }]
  for (const i of [0, 1]) {
    const x0 = xs[i], x1 = DW - xs[i]
    // the top panel: straight top and sides, its bottom an arc (right to left)
    frame.push({ closed: true, layer: 'engrave', pts: [v(x0, topY[i]), v(x1, topY[i]), along(A.topBot[i], x1, x0), v(x0, yOn(A.topBot[i], x0))] })
    // the band: an arc on top (left to right), the sides, an arc below (right to left)
    frame.push({ closed: true, layer: 'engrave', pts: [along(A.bandTop[i], x0, x1), v(x1, yOn(A.bandTop[i], x1)), along(A.bandBot[i], x1, x0), v(x0, yOn(A.bandBot[i], x0))] })
    // the lower panel: an arc on top (left to right), straight sides and bottom
    frame.push({ closed: true, layer: 'engrave', pts: [along(A.lowTop[i], x0, x1), v(x1, yOn(A.lowTop[i], x1)), v(x1, botY[i]), v(x0, botY[i])] })
  }
  // the ornaments: as large as in the photo (g) unless the panel is relatively lower; the spare height shared above and below
  const place = (refTop: number, refBot: number, newTop: number, newBot: number) => {
    const H0 = refBot - refTop, H1 = newBot - newTop, s = Math.min(g, H1 / H0)
    return { s, y0: newTop + (H1 - H0 * s) / 2, ref: refTop }
  }
  return {
    g, frame,
    top: place(REF.topI, REF.topInBot[0], topY[1], A.topBot[1].ya),
    low: place(REF.lowInTop[0], REF.botI, A.lowTop[1].ya, botY[1]),
  }
}

/** The ornament lines of a layout, the drawing's top-left corner at (ox, oy). */
export function ornament(L: DoorLayout, DW: number, ox = 0, oy = 0): Loop[] {
  const out: Loop[] = [], cx = DW / 2 + ox
  for (const [grp, at] of [[art().top, L.top], [art().low, L.low]] as const) {
    const y0 = at.y0 + oy - at.ref * at.s
    for (const st of grp) {
      const pts: Vtx[] = [], p = st.pts
      for (let i = 0; i < p.length; i += 2) pts.push({ x: round3(cx + (p[i] - REF_W / 2) * at.s), y: round3(y0 + p[i + 1] * at.s) })
      out.push({ closed: st.closed, layer: 'engrave', pts })
    }
  }
  return out
}

// ------------------------------------------------------------------ the laser lines

/** Segments filed in 2 mm cells, each with a tag (its arc position along its line, for a line's own segments). */
export class Grid {
  private cells = new Map<number, number[]>()
  /** per segment: its start, its direction, 1 / its length², its tag */
  private s: number[] = []
  add(ax: number, ay: number, bx: number, by: number, tag = 0) {
    const k = this.s.length / 6, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
    this.s.push(ax, ay, dx, dy, l2 > 1e-18 ? 1 / l2 : 0, tag)
    for (let cx = Math.floor(Math.min(ax, bx) / 2); cx <= Math.floor(Math.max(ax, bx) / 2); cx++)
      for (let cy = Math.floor(Math.min(ay, by) / 2); cy <= Math.floor(Math.max(ay, by) / 2); cy++) {
        const key = cx * 100003 + cy, c = this.cells.get(key)
        if (c) c.push(k); else this.cells.set(key, [k])
      }
  }
  addLine(pts: P2[], closed: boolean) {
    for (let i = 0; i + 1 < pts.length; i++) this.add(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (closed && pts.length > 2) this.add(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y)
  }
  /** whether a segment comes within r of (qx, qy), counting only segments tagged lo..hi */
  near(qx: number, qy: number, r: number, lo = -Infinity, hi = Infinity) {
    const s = this.s, r2 = r * r
    for (let cx = Math.floor((qx - r) / 2), cx1 = Math.floor((qx + r) / 2); cx <= cx1; cx++)
      for (let cy = Math.floor((qy - r) / 2), cy1 = Math.floor((qy + r) / 2); cy <= cy1; cy++) {
        const c = this.cells.get(cx * 100003 + cy)
        if (c) for (let i = 0; i < c.length; i++) {
          const o = 6 * c[i], t = s[o + 5]
          if (t < lo || t > hi) continue
          const ex = qx - s[o], ey = qy - s[o + 1], dx = s[o + 2], dy = s[o + 3]
          let u = (ex * dx + ey * dy) * s[o + 4]
          u = u < 0 ? 0 : u > 1 ? 1 : u
          const fx = ex - u * dx, fy = ey - u * dy
          if (fx * fx + fy * fy < r2) return true
        }
      }
    return false
  }
}

/**
 * A run of a centre line moved sideways by d (left of travel on screen for d > 0): edges moved parallel, corners
 * mitred on the inside and rounded on the outside of sharp turns (the burn of a round spot), the ends cut square.
 * A ring is the whole closed line.
 */
function offsetRun(V: P2[], ring: boolean, d: number): P2[] {
  const n = V.length, m = ring ? n : n - 1
  const nx: number[] = [], ny: number[] = []
  for (let i = 0; i < m; i++) {
    const a = V[i], b = V[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l > 1e-9) { nx.push((b.y - a.y) / l); ny.push(-(b.x - a.x) / l) } else { nx.push(nx[i - 1] ?? 0); ny.push(ny[i - 1] ?? 0) }
  }
  if (!d) return V.slice()
  const out: P2[] = []
  for (let i = 0; i < n; i++) {
    const p = V[i], i0 = ring ? (i - 1 + m) % m : i - 1, i1 = ring ? i % m : i
    if (i0 < 0 || i1 >= m) { const k = i0 < 0 ? i1 : i0; out.push({ x: p.x + nx[k] * d, y: p.y + ny[k] * d }); continue }
    const c = nx[i0] * nx[i1] + ny[i0] * ny[i1], turnIn = (nx[i0] * -ny[i1] + ny[i0] * nx[i1]) * d // > 0: d's side is the inside
    if (c > 0.5) { out.push({ x: p.x + ((nx[i0] + nx[i1]) / (1 + c)) * d, y: p.y + ((ny[i0] + ny[i1]) / (1 + c)) * d }); continue }
    if (turnIn > 0) {
      // inside a sharp turn: the mitre, unless it would reach past the neighbouring edges (then both edges' ends,
      // and the bit between, too close to the centre line, is cleared later)
      const back = Math.abs(d) * Math.sqrt(Math.max(0, (1 - c) / (1 + c)))
      const la = Math.hypot(p.x - V[(i - 1 + n) % n].x, p.y - V[(i - 1 + n) % n].y), lb = Math.hypot(V[(i + 1) % n].x - p.x, V[(i + 1) % n].y - p.y)
      if (1 + c > 1e-6 && back < Math.min(la, lb)) out.push({ x: p.x + ((nx[i0] + nx[i1]) / (1 + c)) * d, y: p.y + ((ny[i0] + ny[i1]) / (1 + c)) * d })
      else out.push({ x: p.x + nx[i0] * d, y: p.y + ny[i0] * d }, { x: p.x + nx[i1] * d, y: p.y + ny[i1] * d })
      continue
    }
    // outside a sharp turn: round, every 15° or so
    const a0 = Math.atan2(ny[i0] * Math.sign(d), nx[i0] * Math.sign(d))
    let da = Math.atan2(ny[i1] * Math.sign(d), nx[i1] * Math.sign(d)) - a0
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    const k = Math.max(2, Math.ceil(Math.abs(da) / 0.26))
    for (let j = 0; j <= k; j++) out.push({ x: p.x + Math.cos(a0 + (da * j) / k) * Math.abs(d), y: p.y + Math.sin(a0 + (da * j) / k) * Math.abs(d) })
  }
  return out
}

/** Points every `step` mm or closer along a polyline (its vertices kept), with their arc positions. */
function dense(pts: P2[], step: number): { q: P2[]; s: number[] } {
  const q: P2[] = [pts[0]], s: number[] = [0]
  let L = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.y - a.y), k = Math.max(1, Math.ceil(l / step))
    for (let j = 1; j <= k; j++) { q.push({ x: a.x + ((b.x - a.x) * j) / k, y: a.y + ((b.y - a.y) * j) / k }); s.push(L + (l * j) / k) }
    L += l
  }
  return { q, s }
}

/** Drop points on the straight line through their neighbours, and points closer than 0.08 mm to the one before. */
function tidy(pts: P2[]): P2[] {
  const out: P2[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i], a = out[out.length - 1]
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.08) { if (i === pts.length - 1 && out.length > 1) out[out.length - 1] = b; continue }
    if (out.length > 1 && i + 1 < pts.length) {
      const o = out[out.length - 2]
      if (Math.abs((a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)) < 1e-7 * Math.hypot(b.x - o.x, b.y - o.y) && (a.x - o.x) * (b.x - a.x) + (a.y - o.y) * (b.y - a.y) > 0) out[out.length - 1] = b
      else out.push(b)
    } else out.push(b)
  }
  return out
}
/** The parts of a polyline outside `blocked`, the edges found by halving; only its first `head` mm is tested. */
function clipBy(pts: P2[], blocked: (x: number, y: number) => boolean, head: number): P2[][] {
  const out: P2[][] = []
  let cur: P2[] = [], was = true, L = 0, i = 0
  const at = (a: P2, b: P2, m: number) => ({ x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m })
  const edge = (a: P2, b: P2, fromIn: boolean) => {
    let lo = 0, hi = 1
    for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2, q = at(a, b, m); if (blocked(q.x, q.y) === fromIn) lo = m; else hi = m }
    return at(a, b, fromIn ? hi : lo)
  }
  for (; i < pts.length && L <= head; i++) {
    if (i > 0) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    const d = i > 0 ? dense([pts[i - 1], pts[i]], 0.25).q : [pts[0]]
    for (let j = i > 0 ? 1 : 0; j < d.length; j++) {
      const inside = blocked(d[j].x, d[j].y), prev = d[j - 1] ?? d[j]
      if (j + i > 0 && was && !inside) cur = [edge(prev, d[j], true)]
      if (j + i > 0 && !was && inside) { cur.push(edge(prev, d[j], false)); out.push(cur); cur = [] }
      if (!inside && (j === d.length - 1 || cur.length === 0 || j === 0)) cur.push(d[j])
      was = inside
    }
  }
  // past the head nothing is tested (the line's own rule kept it r away from its earlier pieces there)
  if (was) cur = []
  for (; i < pts.length; i++) cur.push(pts[i])
  if (cur.length) out.push(cur)
  return out
}
const pathLen = (p: P2[]) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return L }

/** a stroke ready to engrave: its centre line in mm and the number of laser lines on each of its segments */
export interface Weighted {
  pts: P2[]; closed: boolean; n: number[]
  /** walk its lines from the far end (a right-hand copy, so that it is engraved as its partner's mirror image) */
  rev?: boolean
}

/**
 * The laser lines of some strokes, engraved in the order given, each stroke's lines lw apart and centred on its centre
 * line. Every line stops lw short of the lines drawn before it (earlier strokes', its own stroke's, and its own further
 * back), so no wood is burnt twice and the burns just touch; where a stroke runs too close to another, or to itself,
 * for all its lines, the lines that do not fit stop there. `drawn` holds what is engraved already and gets these lines.
 */
/** how far a line turns before it can come back near itself (2 acos ⅓: a line turning less, 3 lw on, is lw away at least) */
const FOLD = 2.46
export function engraveStrokes(strokes: Weighted[], lw: number, drawn: Grid): Loop[] {
  const out: Loop[] = [], r = lw - 0.01, lag = 3 * lw, step = 0.5
  const v = (q: P2): Vtx => ({ x: round3(q.x), y: round3(q.y) })
  for (const st of strokes) {
    const P = st.pts, nV = P.length, nS = st.n.length
    const centre = new Grid()
    centre.addLine(P, st.closed)
    // the offsets: those of every line count on the stroke, the centre first, then outwards
    const ds: number[] = []
    for (const n of new Set(st.n)) for (let k = 0; k < n; k++) { const d = (k - (n - 1) / 2) * lw; if (!ds.some(e => Math.abs(e - d) < 1e-9)) ds.push(d) }
    ds.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
    for (const d of ds) {
      const on = st.n.map(n => Math.abs(d) <= ((n - 1) / 2) * lw + 1e-9 && Math.abs((d / lw + (n - 1) / 2) - Math.round(d / lw + (n - 1) / 2)) < 1e-6)
      if (!on.some(Boolean)) continue
      // runs of segments carrying this line: [first segment, segment count]
      const runs: [number, number][] = []
      const ring = st.closed && on.every(Boolean)
      if (ring) runs.push([0, nS])
      else {
        const start = st.closed ? on.indexOf(false) : 0
        let run: [number, number] | null = null
        for (let j = 0; j < nS; j++) {
          const i = (start + j) % nS
          if (!on[i]) { run = null; continue }
          if (run) run[1]++
          else { run = [i, 1]; runs.push(run) }
        }
      }
      for (const [a, k] of runs) {
        const V0 = ring ? P : Array.from({ length: k + 1 }, (_, j) => P[(a + j) % nV])
        // a right-hand copy runs backwards: its lines are walked the other way, as its partner's are (the same line)
        const V = st.rev ? V0.slice().reverse() : V0
        const off = offsetRun(V, ring, st.rev ? -d : d)
        const line = ring ? [...off, off[0]] : off
        const { q, s } = dense(line, step), L = s[s.length - 1]
        // how far the line has turned by each point: a stretch further back can come within r of it only once the
        // line has turned through FOLD since (a line turning less keeps 3 lw back at least lw away)
        const turn = new Float64Array(q.length)
        for (let i = 1; i + 1 < q.length; i++) {
          const ax = q[i].x - q[i - 1].x, ay = q[i].y - q[i - 1].y, bx = q[i + 1].x - q[i].x, by = q[i + 1].y - q[i].y
          turn[i] = turn[i - 1] + Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by))
        }
        turn[q.length - 1] = turn[Math.max(0, q.length - 2)]
        const folds = ring || turn[q.length - 1] >= FOLD
        let back = -1, reach = -Infinity
        const self = new Grid()
        // a line's own earlier stretch counts once it is lag back along the line (round a ring, lag either way)
        const blocked = (x: number, y: number, at: number) =>
          drawn.near(x, y, r) || (Math.abs(d) > lw + 1e-9 && centre.near(x, y, Math.abs(d) - 0.02)) ||
          (ring ? self.near(x, y, r, at - L + lag, at - lag) : reach > -Infinity && self.near(x, y, r, -Infinity, Math.min(at - lag, reach)))
        /** a short straight join from a to b passes nothing it should not */
        const clear = (a: P2, b: P2, at: number) => {
          const k = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.1)
          for (let j = 1; j < k; j++) if (blocked(a.x + ((b.x - a.x) * j) / k, a.y + ((b.y - a.y) * j) / k, at)) return false
          return true
        }
        const pieces: { p: P2[]; s0: number; s1: number }[] = []
        let cur: P2[] = [], cs = 0, was = blocked(q[0].x, q[0].y, 0), cut = was
        if (!was) cur = [q[0]]
        // the point between q[i − 1] and q[i] where blocked changes, found by halving
        const edge = (i: number, fromIn: boolean) => {
          let lo = 0, hi = 1
          for (let it = 0; it < 12; it++) {
            const m = (lo + hi) / 2, x = q[i - 1].x + (q[i].x - q[i - 1].x) * m, y = q[i - 1].y + (q[i].y - q[i - 1].y) * m
            if (blocked(x, y, s[i - 1] + (s[i] - s[i - 1]) * m) === fromIn) lo = m; else hi = m
          }
          const m = fromIn ? hi : lo
          return { p: { x: q[i - 1].x + (q[i].x - q[i - 1].x) * m, y: q[i - 1].y + (q[i].y - q[i - 1].y) * m }, s: s[i - 1] + (s[i] - s[i - 1]) * m }
        }
        for (let i = 1; i < q.length; i++) {
          while (!ring && back + 1 < i && turn[i] - turn[back + 1] >= FOLD) back++
          reach = back >= 0 ? s[back] : -Infinity
          const inside = blocked(q[i].x, q[i].y, s[i])
          if (was && !inside) {
            const e = edge(i, true), prev = pieces[pieces.length - 1]
            cur = [e.p]; cs = e.s
            // back within lw of the piece just left (round a cleared loop at a sharp corner): that piece goes on from its
            // nearest point instead, the loop's start dropped
            if (prev && prev.s1 > e.s - lag - 0.5) {
              let best = -1, bd = lw
              for (let k = prev.p.length - 1; k >= 0 && k >= prev.p.length - 2 - (lag + 0.5) / step * 2; k--) {
                const dd = Math.hypot(prev.p[k].x - e.p.x, prev.p[k].y - e.p.y)
                if (dd < bd) { bd = dd; best = k }
              }
              if (best >= 0 && clear(prev.p[best], e.p, e.s)) { pieces.pop(); cur = prev.p.slice(0, best + 1); cur.push(e.p); cs = prev.s0 }
            }
          }
          if (!was && inside) {
            const e = edge(i, false), last = cur[cur.length - 1]
            cur.push(e.p); if (folds) self.add(last.x, last.y, e.p.x, e.p.y, e.s)
            pieces.push({ p: cur, s0: cs, s1: e.s }); cur = []; cut = true
          }
          if (!inside) { const last = cur[cur.length - 1]; cur.push(q[i]); if (last && folds) self.add(last.x, last.y, q[i].x, q[i].y, s[i]) }
          was = inside
        }
        if (cur.length) pieces.push({ p: cur, s0: cs, s1: L })
        if (!cut) { const t = tidy(ring ? off : line); out.push({ closed: ring, layer: 'engrave', pts: t.map(v) }); drawn.addLine(t, ring); continue }
        // pieces of the line that nearly meet again (round a cleared corner) join up; a ring's first and last too
        const joined: P2[][] = []
        for (const pc of pieces) {
          const prev = joined[joined.length - 1], e = prev?.[prev.length - 1]
          if (e && Math.hypot(pc.p[0].x - e.x, pc.p[0].y - e.y) < lw && clear(e, pc.p[0], pc.s0)) prev.push(...pc.p); else joined.push(pc.p.slice())
        }
        if (ring && joined.length > 1 && pieces[0].s0 === 0 && pieces[pieces.length - 1].s1 === L) joined[0] = [...joined.pop()!, ...joined[0].slice(1)]
        // the pieces are separate lines on the laser: a later one stops r short of the earlier ones too
        const mine = new Grid(), kept: P2[][] = []
        for (const pc of joined) for (const part of kept.length ? clipBy(pc, (x, y) => mine.near(x, y, r), lag + 1) : [pc]) {
          if (pathLen(part) < 0.5) continue
          const t = tidy(part)
          if (t.length < 2) continue
          kept.push(t); mine.addLine(t, false)
        }
        // a ring cleared at one place only and joined round again is a loop
        const loop = ring && kept.length === 1 && Math.hypot(kept[0][0].x - kept[0][kept[0].length - 1].x, kept[0][0].y - kept[0][kept[0].length - 1].y) < lw
        if (loop && kept[0].length > 3 && Math.hypot(kept[0][0].x - kept[0][kept[0].length - 1].x, kept[0][0].y - kept[0][kept[0].length - 1].y) < 0.08) kept[0].pop()
        for (const t of kept) { out.push({ closed: loop, layer: 'engrave', pts: t.map(v) }); drawn.addLine(t, loop) }
      }
    }
  }
  return out
}

/** A loop with its arcs as points (every 3° or so), for the spacing grid. */
function sampleLoop(l: Loop): P2[] {
  const out: P2[] = [], n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b && (i < n - 1 || l.closed)) {
      const a = arcInfo(p, q, p.b), m = Math.max(4, Math.ceil(a.theta / 0.05))
      for (let k = 1; k < m; k++) { const t = a.a0 + (a.ccw ? -1 : 1) * (a.theta * k) / m; out.push({ x: a.c.x + a.r * Math.cos(t), y: a.c.y + a.r * Math.sin(t) }) }
    }
  }
  return out
}

/** the laser lines' spacing, and how many make a bold and a fine line */
export interface Counts { lw: number; bold: number; fine: number }

/**
 * Every laser line of the door: the structural lines (each as its count of parallel loops, the arcs true arcs) and the
 * ornaments' strokes in their drawing order; the drawing's top-left corner at (ox, oy).
 */
export function engraveDoor(L: DoorLayout, DW: number, ox: number, oy: number, c: Counts): Loop[] {
  const drawn = new Grid(), out: Loop[] = []
  const count = (w: 'b' | 'f') => (w === 'b' ? c.bold : c.fine)
  L.frame.forEach((l, i) => {
    const n = count(i === 0 ? FRAME_W.rect : i <= 3 ? FRAME_W.outer : FRAME_W.inner)
    for (let k = 0; k < n; k++) {
      const d = (k - (n - 1) / 2) * c.lw, o = d ? offsetLoop(l, d) : l
      const pts = o.pts.map(q => ({ ...q, x: round3(q.x + ox), y: round3(q.y + oy) }))
      const line: Loop = { closed: true, layer: 'engrave', pts }
      out.push(line); drawn.addLine(sampleLoop(line), true)
    }
  })
  out.push(...engraveStrokes(weighted(L, DW, ox, oy, c), c.lw, drawn))
  return out
}

/** The ornaments' strokes in their drawing order, placed as ornament() places them, with their line counts. */
export function weighted(L: DoorLayout, DW: number, ox: number, oy: number, c: Counts): Weighted[] {
  const A = art(), all = [...A.top, ...A.low], cx = DW / 2 + ox
  return A.order.map(i => {
    const st = all[i], at = i < A.top.length ? L.top : L.low, y0 = at.y0 + oy - at.ref * at.s, pts: P2[] = []
    for (let k = 0; k < st.pts.length; k += 2) pts.push({ x: cx + (st.pts[k] - REF_W / 2) * at.s, y: y0 + st.pts[k + 1] * at.s })
    return { pts, closed: st.closed, n: Array.from(st.bold, b => (b ? c.bold : c.fine)), rev: !!st.mirror }
  })
}

// ------------------------------------------------------------------ the template

export function errorsOf(p: Record<string, number>): string[] {
  const { PW, PH, DW, DH, dy, lw } = p, errors: string[] = []
  if (DW < MIN_DW) errors.push(`الرسمة صغيرة على تفاصيلها الدقيقة: اجعل عرضها ${MIN_DW} مم على الأقل.`)
  const [a0, a1] = ASPECT
  if (DH < a0 * DW) errors.push(`الرسمة عريضة بالنسبة لارتفاعها فتضيق حشواتها: اجعل ارتفاعها ${Math.ceil(a0 * DW)} مم على الأقل${DH / a0 >= MIN_DW ? `، أو عرضها ${Math.floor(DH / a0)} مم على الأكثر` : ''}.`)
  if (DH > a1 * DW) errors.push(`الرسمة طويلة بالنسبة لعرضها: اجعل ارتفاعها ${Math.floor(a1 * DW)} مم على الأكثر، أو عرضها ${Math.ceil(DH / a1)} مم على الأقل.`)
  if (DW > PW - 2 * EDGE) errors.push(`الرسمة أعرض من لوح الباب: اجعل عرضها ${Math.floor(PW - 2 * EDGE)} مم على الأكثر، أو عرض اللوح ${Math.ceil(DW + 2 * EDGE)} مم على الأقل.`)
  if (DH > PH - 2 * EDGE) errors.push(`الرسمة أطول من لوح الباب: اجعل ارتفاعها ${Math.floor(PH - 2 * EDGE)} مم على الأكثر، أو ارتفاع اللوح ${Math.ceil(DH + 2 * EDGE)} مم على الأقل.`)
  else {
    const lim = (PH - DH) / 2 - EDGE
    if (Math.abs(dy) > lim + 1e-9) errors.push(`تحريك الرسمة ${dy < 0 ? '−' : ''}${f1(Math.abs(dy))} مم يُخرجها عن لوح الباب: اجعله بين −${Math.floor(lim)} و${Math.floor(lim)} مم.`)
  }
  // each line of a double line is its count of laser lines wide; WOOD has to stay between them
  const count = (w: 'b' | 'f') => Math.round(w === 'b' ? p.thick : p.thin), nO = count(FRAME_W.outer), nI = count(FRAME_W.inner)
  const gap = (DOUBLE * DW) / REF_W, need = ((nO + nI) / 2) * lw + WOOD
  if (DW >= MIN_DW && need > gap + 1e-9) {
    const lwMax = Math.floor((gap - WOOD) / ((nO + nI) / 2) / 0.05 + 1e-9) * 0.05, kMax = Math.floor(2 * (gap - WOOD) / lw + 1e-9) - nO
    const ask = [lwMax >= 0.1 ? `«المسافة بين خطوط الليزر» ${Math.round(lwMax * 100) / 100} مم على الأكثر` : '', FRAME_W.inner === 'b' && kMax >= 1 ? `«خطوط الخط العريض» ${kMax} على الأكثر` : '', `عرض الرسمة ${Math.ceil((need / DOUBLE) * REF_W)} مم على الأقل`].filter(Boolean)
    errors.push(`خطّا الإطار المزدوج لا يتّسعان لخطوط الليزر هذه (بين منتصفيهما ${f1(gap)} مم ويبقى بينهما ${WOOD} مم من الخشب على الأقل): اجعل ${ask.join('، أو ')}.`)
  }
  return errors
}

function build(p: Record<string, number>, _c: Common): BuildResult {
  const warnings: string[] = []
  const errors = errorsOf(p)
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  const { PW, PH, DW, DH, dy, lw } = p, n = Math.max(1, Math.round(p.n)), bold = Math.round(p.thick), fine = Math.round(p.thin)
  const ox = (PW - DW) / 2, oy = (PH - DH) / 2 + dy
  const L = layout(DW, DH)
  const engrave = engraveDoor(L, DW, ox, oy, { lw, bold, fine })
  const len = engrave.reduce((s, l) => s + loopLength(l), 0)
  const pct = (s: number) => Math.round((s / L.g) * 100)
  const lines = (k: number) => (k === 1 ? 'خطّ واحد' : k === 2 ? 'خطّان' : `${k} خطوط`)
  const notes = [
    `الرسمة ${f1(DW)} × ${f1(DH)} مم في وسط لوح الباب ${f1(PW)} × ${f1(PH)} مم: ${f1(ox)} مم من كل جانب، ${f1(oy)} مم من فوق و${f1(PH - oy - DH)} مم من تحت.`,
    `الخطوط بسماكتين كما في الصورة: العريضة ${lines(bold)} ليزر${bold > 1 ? ` بينها ${lw} مم (عرض الخط نحو ${f1(bold * lw)} مم)` : ''}، وهي حواف الزهور والبراعم والأوراق والمزهرية وساقها والقلب والزنبقتين والالتفافات وأوراق الأكانثس، والخط الداخلي لكل إطار مزدوج؛ والرفيعة ${lines(fine)}${fine > 1 ? ` بينها ${lw} مم` : ''}، وهي عروق الأوراق والبتلات وخطوط المزهرية الداخلية وحلقات الساق ولفّات الالتفافات الصغيرة وأسفل القطرة فوق القلب، والمستطيل الخارجي والخط الخارجي لكل إطار مزدوج.`,
    `الحفر كلّه على الطبقة الزرقاء خطوطاً مفردة: في RDWorks اجعلها طبقة Cut واحدة بقدرة الحفر وسرعته عندك (لا Scan)، وجرّبها على قطعة من نفس الخشب. «المسافة بين خطوط الليزر» هي عرض ما يحرقه رأس الليزر عندك: إن كان أعرض أو أرفع من ${lw} مم فاكتب عرضه الحقيقي فتلتحم الخطوط المتجاورة ولا يتداخل حرقها.`,
    'حيث يلتقي خطّان تتوقّف خطوط اللاحق قبل خطوط السابق بمسافة خطّ واحد، فلا يُحرق مكان مرّتين ولا تبقى فجوة؛ وعند الزوايا والرؤوس المدبّبة تلتفّ الخطوط حولها خطّاً متّصلاً؛ وحيث تضيق المسافة بين خطّين عن خطوطهما كلّها يُحفر منها ما يتّسع فقط.',
    'الإطار الأحمر حدود لوح الباب للمحاذاة فقط: اجعله Output = No، إلا إن أردت قصّ اللوح نفسه.',
    `طول خطوط الحفر نحو ${(len / 1000).toFixed(1)} م${n > 1 ? ` لكل باب (${n} أبواب)` : ''}.`,
    'لباب آخر: اكتب عرض لوح الباب وارتفاعه، وعرض الرسمة وارتفاعها؛ الإطارات والأقواس تُبنى من جديد بنسب الصورة، والزخارف تكبر وتصغر بنسبة واحدة دون مطّ وتتوسّط حشواتها. «تحريك الرسمة» يرفعها (بالسالب) أو ينزلها عن وسط اللوح.',
  ]
  if (pct(L.top.s) < 99 || pct(L.low.s) < 99) notes.push(`الحشوات أقصر نسبةً من الصورة، فصغرت الزخارف لتتّسع: العلوية ${pct(L.top.s)}% والسفلية ${pct(L.low.s)}% من مقاس الصورة على هذا العرض.`)
  return {
    panels: [{ id: 'door', name: 'لوح الباب', w: PW, h: PH, engrave, count: n, note: 'الرسمة على طبقة الحفر الزرقاء؛ الإطار الأحمر حدود اللوح' }],
    notes, warnings, errors: [],
  }
}

const PARAMS: ParamDef[] = [
  mm('PW', 'عرض لوح الباب', 300, 1500, 'قشرة الباب كاملة، والإطار الأحمر بحدودها'),
  mm('PH', 'ارتفاع لوح الباب', 600, 3000),
  mm('DW', 'عرض الرسمة', 200, 1400, 'عرض المستطيل الخارجي المحفور؛ 600 مم في رسمة الزبون'),
  mm('DH', 'ارتفاع الرسمة', 400, 2900, 'ارتفاع المستطيل الخارجي المحفور؛ 1660 مم في رسمة الزبون'),
  mm('dy', 'تحريك الرسمة', -1000, 1000, 'عن وسط اللوح: بالسالب للأعلى وبالموجب للأسفل'),
  { key: 'thick', label: 'خطوط الخط العريض', min: 1, max: 7, step: 1, int: true, hint: 'كم خطّ ليزر متلاصق في الخطوط العريضة: حواف الزخارف والخط الداخلي لكل إطار مزدوج' },
  { key: 'thin', label: 'خطوط الخط الرفيع', min: 1, max: 5, step: 1, int: true, hint: 'كم خطّ ليزر في الخطوط الرفيعة: العروق والتفاصيل الداخلية والمستطيل الخارجي' },
  { key: 'lw', label: 'المسافة بين خطوط الليزر', min: 0.1, max: 1, step: 0.05, unit: 'مم', hint: 'عرض ما يحرقه رأس الليزر: 3 خطوط بـ0.4 مم تعطي خطاً عريضاً نحو 1.2 مم' },
  { key: 'n', label: 'عدد الأبواب', min: 1, max: 20, step: 1, int: true },
]

const DEFAULTS = { PW: 915, PH: 2130, DW: 600, DH: 1660, dy: 0, thick: 3, thin: 1, lw: 0.4, n: 1 }

const DESC = 'رسمة حفر ليزر لباب كلاسيك منقولة بدقّة عن صورة الزبون: حشوة علوية بقاعدة مقوّسة فيها مزهرية على ساق مخروطة تحمل باقة ورود (وردتان بستّ بتلات وبراعم) وأوراق طويلة تلتفّ على الجانبين، وفوقها حلقة كالقلب بين زنبقتين، وتحتها التفافات وأوراق أكانثس؛ ثم شريط مقوّس، وحشوة سفلية فيها زخرفة أوراق متناظرة. خطوط حفر رفيعة على الطبقة الزرقاء في وسط لوح الباب، والمقاس يتغيّر دون مطّ الزخارف.'

const ICON = `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v34q-13 4-26 0z" stroke-width="1.3"/><path d="M19 43.5q13 4 26 0v4q-13 3-26 0z" stroke-width="1.1"/><path d="M19 50q13 3 26 0v7H19z" stroke-width="1.2"/><path d="M29 22h6l-1.5 5h-3zM32 27v7M30 34h4" stroke-width="1"/><path d="M32 22c-3-3-6-2-7-5M32 22c3-3 6-2 7-5M32 21v-5M30 13c0-3 4-3 4 0l-2 3z" stroke-width="0.9"/><path d="M29 54c1-2 5-2 6 0M26 55c2-3 4-1 6-3 2 2 4 0 6 3" stroke-width="0.9"/>`

export const DOOR_VASE: Template[] = [
  { id: 'doorvase', name: 'باب كلاسيك: مزهرية وورود', desc: DESC, icon: ICON, params: PARAMS, defaults: DEFAULTS, innerAdd: () => ({ W: 0, D: 0, H: 0 }), build },
]
