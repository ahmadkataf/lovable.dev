import { describe, it, expect } from 'vitest'
import { MIHRAB_BOXES, archProfile, insetPath } from './mihrabbox'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, segDist, segsCross, materialAt } from './testutil'

const tpl = MIHRAB_BOXES[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type Pn = { id: string; loops: Loop[]; w: number; h: number; count: number; material?: string }
const cutLoops = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: Pn) => cutLoops(pn).filter(l => signedArea(l) < 0)
const outerOf = (pn: Pn) => cutLoops(pn).find(l => signedArea(l) > 0)!
const panel = (d: { panels: Pn[] }, id: string) => d.panels.find(p => p.id === id)!
type P = { x: number; y: number }
type Seg = { a: P; b: P; x0: number; x1: number; y0: number; y1: number }
const segsOf = (poly: P[]): Seg[] => poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; return { a, b, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) } })
/** Distance between two segments, 0 when they cross (testutil's segDist measures only from the end points). */
const segD = (a: P, b: P, c: P, d: P) => (segsCross(a, b, c, d) ? 0 : segDist(a, b, c, d))
/** Whether two polygons keep at least `min` apart; segment pairs whose boxes are further apart are not measured. */
function keepApart(A: P[], B: P[], min: number): boolean {
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length], x0 = Math.min(a.x, b.x) - min, x1 = Math.max(a.x, b.x) + min, y0 = Math.min(a.y, b.y) - min, y1 = Math.max(a.y, b.y) + min
    for (let j = 0; j < B.length; j++) {
      const c = B[j], d = B[(j + 1) % B.length]
      if (Math.max(c.x, d.x) < x0 || Math.min(c.x, d.x) > x1 || Math.max(c.y, d.y) < y0 || Math.min(c.y, d.y) > y1) continue
      if (segD(a, b, c, d) < min) return false
    }
  }
  return true
}
/** Distance from a hole to the outline, looking only at outline segments near the hole's box (Infinity when none is within a millimetre). */
function distToOutline(hp: P[], hb: { minX: number; minY: number; maxX: number; maxY: number }, segs: Seg[]): number {
  let best = Infinity
  for (const s of segs) {
    if (s.x1 < hb.minX - 1 || s.x0 > hb.maxX + 1 || s.y1 < hb.minY - 1 || s.y0 > hb.maxY + 1) continue
    for (let i = 0; i < hp.length; i++) best = Math.min(best, segD(hp[i], hp[(i + 1) % hp.length], s.a, s.b))
  }
  return best
}
/** Distance from a point to a polyline. */
const toLine = (q: P, line: P[]) => { let m = Infinity; for (let i = 0; i + 1 < line.length; i++) m = Math.min(m, segDist(q, q, line[i], line[i + 1])); return m }
/** Distance from a polygon to an open polyline. */
const toPolyline = (hp: P[], line: P[]) => { let m = Infinity; for (let j = 0; j + 1 < line.length; j++) for (let i = 0; i < hp.length; i++) m = Math.min(m, segD(hp[i], hp[(i + 1) % hp.length], line[j], line[j + 1])); return m }
/** The arch outline of the back panel (y down, apex at 0) as an open line from one springing over the apex to the other. */
function archLine(back: Pn, A: number): P[] {
  const P = samplePoly(outerOf(back), 10), n = P.length, up = P.map(q => q.y <= A + 1e-6)
  const s = up.findIndex((u, i) => u && !up[(i - 1 + n) % n]), out: P[] = []
  for (let k = 0; k < n && up[(s + k) % n]; k++) out.push(P[(s + k) % n])
  return out
}

/** The numbers an error message asks for, as parameters (the first way out it offers, or the box height with `alt`). */
function suggestion(msg: string, alt = false): Record<string, number> | null {
  const n = (re: RegExp) => { const m = msg.match(re); return m ? parseFloat(m[1]) : NaN }
  const out: Record<string, number> = {}
  if (msg.includes('المحراب منخفض لشكله')) out.A = n(/اجعل ارتفاعه ([\d.]+) مم على الأقل/)
  else if (msg.includes('المحراب طويل')) out.A = n(/اجعل ارتفاعه ([\d.]+) مم أو أقل/)
  else if (msg.includes('ارفع المحراب إلى')) { out.A = n(/ارفع المحراب إلى ([\d.]+)/); const b = n(/عرض الشريط ([\d.]+)/); if (!isNaN(b)) out.band = b }
  else if (msg.includes('الشريط الذهبي عريض')) out.band = n(/اجعل عرضه ([\d.]+) مم أو أقل/)
  else if (msg.includes('اجعل ارتفاع الشفة')) out.lipH = n(/اجعل ارتفاع الشفة ([\d.]+)/)
  else if (msg.includes('ارتفاع الشفة أكبر')) out.lipH = n(/اجعله ([\d.]+) مم أو أقل/)
  else if (msg.includes('حجم الزخرفة') && !alt) out.cell = n(/اجعل حجم الزخرفة ([\d.]+)/)
  else if (msg.includes('ارفع العلبة إلى')) out.H = n(/ارفع العلبة إلى ([\d.]+)/)
  else if (msg.includes('المقبض')) out.knob = n(/اجعله ([\d.]+) مم أو أقل/)
  else return null
  return Object.values(out).some(isNaN) ? null : out
}

// the outline of the arch in the customer's front photo (pixels): the left edge's x at each row, springing at y = 1190, apex at y = 866, x 287 … 751
const PHOTO = { base: 1190, apex: 866, left: 287, right: 751, rows: [[875, 506], [880, 495], [890, 472], [900, 454], [910, 437], [920, 421], [930, 408], [950, 384], [970, 365], [1000, 341], [1030, 323], [1060, 309], [1100, 296], [1130, 290], [1160, 287]] }
/** RMS distance (as a fraction of the width) between an arch style and the photo's outline, at the photo's proportion. */
function photoFit(style: number): number {
  const W = PHOTO.right - PHOTO.left, A = PHOTO.base - PHOTO.apex
  const { pts } = archProfile(style, W, A)
  const top = pts.findIndex(q => q.y >= A - 1e-9), L = pts.slice(0, top + 1)
  let err = 0
  for (const [y, x] of PHOTO.rows) {
    const h = PHOTO.base - y
    const i = L.findIndex((q, k) => k > 0 && L[k - 1].y <= h && q.y >= h)
    const u = (h - L[i - 1].y) / (L[i].y - L[i - 1].y), xi = L[i - 1].x + u * (L[i].x - L[i - 1].x)
    err += (xi - (x - PHOTO.left)) ** 2
  }
  return Math.sqrt(err / PHOTO.rows.length) / W
}

describe('the mihrab sweets box', () => {
  it('builds at its defaults on the common sheets: the box, the lid with its lip frame, the gold lozenge and the gold band', () => {
    for (const t of [2.7, 3, 3.2]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort()).toEqual(['back', 'band', 'bottom', 'front', 'lid', 'lip-fb', 'lip-side', 'lozenge', 'side'])
      expect(panel(d, 'side').count).toBe(2)
      expect(panel(d, 'lip-fb').count).toBe(2)
      expect(panel(d, 'lip-side').count).toBe(2)
      expect(panel(d, 'band').material).toBe('gold')
      expect(panel(d, 'lozenge').material).toBe('gold')
      for (const id of ['bottom', 'front', 'back', 'side', 'lid', 'lip-fb', 'lip-side']) expect(panel(d, id).material, id).toBeUndefined()
      // the back is the wall plus the arch, one outer loop, as wide as the box
      const back = panel(d, 'back')
      expect(back.h).toBeCloseTo(70 + 210, 3)
      expect(back.w).toBeCloseTo(300, 3)
      expect(cutLoops(back).filter(l => signedArea(l) > 0).length).toBe(1)
      // the lid covers the front and the sides and stops at the arch's face
      expect(panel(d, 'lid').w).toBeCloseTo(300, 3)
      expect(panel(d, 'lid').h).toBeCloseTo(220 - t, 3)
      expect(panel(d, 'lip-fb').w).toBeCloseTo(300 - 2 * t - 1, 3)
      expect(panel(d, 'lip-side').w).toBeCloseTo(220 - 2 * t - 1, 3)
      // fretted walls, arch and band; the band is one frame (its opening is a hole)
      expect(holesOf(panel(d, 'front')).length).toBeGreaterThan(20)
      expect(holesOf(panel(d, 'back')).length).toBeGreaterThan(holesOf(panel(d, 'front')).length + 40)
      expect(holesOf(panel(d, 'band')).length).toBeGreaterThan(20)
      expect(holesOf(panel(d, 'lozenge')).length).toBeGreaterThan(20)
    }
  })

  it('follows the photo: a pointed arch (two arcs, no reverse curve) about 0.7 of the width tall, a wide band, a lozenge across half the lid', () => {
    const p = tpl.defaults
    // the pointed style matches the photo's outline within 2 % of the width; the onion (ogee) style does not
    expect(photoFit(2)).toBeLessThan(0.02)
    expect(photoFit(1)).toBeGreaterThan(2 * photoFit(2))
    expect(p.style).toBe(2)
    expect(p.A / p.W).toBeGreaterThan(0.6)
    expect(p.A / p.W).toBeLessThan(0.8)
    // the band about an eighth of the width (the photo's is 40 mm on 300), the lozenge about half the lid's width
    expect(p.band / p.W).toBeGreaterThan(0.1)
    const d = generate(tpl, {}, S0)
    expect(panel(d, 'lozenge').w / p.W).toBeGreaterThan(0.45)
  })

  it('a narrow band is engraved rather than fretted, a very narrow one left plain', () => {
    const d = generate(tpl, { band: 11 }, S0)
    expect(d.errors).toEqual([])
    const bd = panel(d, 'band')
    expect(holesOf(bd).length).toBe(1) // the opening only
    expect(bd.loops.filter(l => l.layer === 'engrave').length).toBeGreaterThan(6)
    expect(d.notes.some(n => n.includes('محفورة'))).toBe(true)
    const d2 = generate(tpl, { band: 6 }, S0)
    expect(d2.errors).toEqual([])
    expect(panel(d2, 'band').loops.length).toBe(2)
  })

  it('copies every panel n times', () => {
    const d = generate(tpl, { n: 3 }, S0)
    expect(d.errors).toEqual([])
    expect(panel(d, 'side').count).toBe(6)
    expect(panel(d, 'back').count).toBe(3)
    expect(panel(d, 'band').count).toBe(3)
    expect(panel(d, 'lip-fb').count).toBe(6)
  })

  it('the arch: symmetric, x-monotone on each side, apex at the middle, vertical at the springing, for every style and proportion', () => {
    for (const style of [1, 2, 3]) for (const [W, A] of [[300, 150], [300, 270], [300, 600], [100, 200], [600, 300]]) {
      const { pts, alpha } = archProfile(style, W, A)
      const label = `style=${style} W=${W} A=${A}`
      const top = pts.reduce((b, p, i) => (p.y > pts[b].y ? i : b), 0)
      expect(pts[top].x, label).toBeCloseTo(W / 2, 6)
      expect(pts[top].y, label).toBeCloseTo(A, 6)
      expect(pts[0]).toEqual({ x: 0, y: 0 })
      expect(pts[pts.length - 1].x, label).toBeCloseTo(W, 6)
      for (let i = 1; i <= top; i++) { expect(pts[i].x, `${label} x-monotone at ${i}`).toBeGreaterThanOrEqual(pts[i - 1].x - 1e-9); expect(pts[i].y, `${label} rising at ${i}`).toBeGreaterThan(pts[i - 1].y) }
      for (let i = 1; i <= top; i++) { const m = pts[pts.length - 1 - i]; expect(m.x, `${label} mirror`).toBeCloseTo(W - pts[i].x, 6); expect(m.y).toBeCloseTo(pts[i].y, 6) }
      // vertical at the springing: the first step rises much more than it moves in
      expect(pts[1].y, label).toBeGreaterThan(5 * pts[1].x)
      expect(alpha, label).toBeGreaterThan(0.1)
      expect(alpha, label).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
      // the inset path stays monotone too, the inner apex lies on the axis below the outer one, and no edge is a sliver
      const inner = insetPath(pts, W, 25, 4)
      const it2 = inner.reduce((b, p, i) => (p.y > inner[b].y ? i : b), 0)
      expect(inner[it2].x, label).toBeCloseTo(W / 2, 6)
      expect(inner[it2].y, label).toBeLessThan(A - 24)
      expect(inner[it2].y, label).toBeGreaterThan(A - 1.25 * (25 / Math.sin(alpha)) - 3)
      for (let i = 1; i <= it2; i++) expect(inner[i].x, `${label} inset monotone at ${i}`).toBeGreaterThanOrEqual(inner[i - 1].x - 1e-9)
      for (let i = 1; i < inner.length; i++) expect(Math.hypot(inner[i].x - inner[i - 1].x, inner[i].y - inner[i - 1].y), `${label} edge ${i}`).toBeGreaterThan(0.3 - 1e-9)
      expect(inner[0].x, label).toBeCloseTo(25, 0)
      expect(inner[0].y, label).toBe(4)
    }
  })

  it('the gold band is one frame on the arch outline exactly: a bar across its foot, the opening one band width in, its fret 2 mm from every edge', () => {
    for (const [style, band, t] of [[2, 40, 3], [1, 25, 3], [2, 20, 3], [3, 30, 2.7], [1, 18, 4]] as const) {
      const d = generate(tpl, { style, band, lipH: 14 }, { ...S0, t }), label = `style=${style} band=${band}`
      expect(d.errors, label).toEqual([])
      const back = panel(d, 'back'), bd = panel(d, 'band')
      const A = 210, hb = t + 14 + 1, bar = 4
      expect(bd.h, label).toBeCloseTo(A - hb, 2)
      // as wide as the arch at the band's foot (the legs curve in a hair above the springing)
      const prof = archProfile(style, 300, A).pts, k = prof.findIndex(q => q.y >= hb), xFoot = prof[k - 1].x + ((hb - prof[k - 1].y) * (prof[k].x - prof[k - 1].x)) / (prof[k].y - prof[k - 1].y)
      expect(bd.w, label).toBeCloseTo(300 - 2 * xFoot, 2)
      expect(cutLoops(bd).filter(l => signedArea(l) > 0).length, label).toBe(1)
      // the band's legs curve in a hair above its foot, so its box is a hair narrower: align the two on their middles
      const dx = (back.w - bd.w) / 2, arch = archLine(back, A)
      const outer = samplePoly(outerOf(bd), 10).map(q => ({ x: q.x + dx, y: q.y }))
      // the outline lies on the arch outline, or on the foot line
      let onEdge = 0
      for (const q of outer) {
        if (Math.abs(q.y - (A - hb)) < 1e-6) continue
        const dOut = toLine(q, arch)
        if (dOut > 0.05) throw new Error(`${label}: band outline point (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) is ${dOut.toFixed(2)} from the arch`)
        onEdge++
      }
      expect(onEdge, label).toBeGreaterThan(20)
      // the opening: one band width from the arch outline, or on the bar's top line, the bar's width above the foot
      const holes = holesOf(bd).map(h => samplePoly(h, 10).map(q => ({ x: q.x + dx, y: q.y })))
      const tall = (h: P[]) => Math.max(...h.map(q => q.y)) - Math.min(...h.map(q => q.y))
      const opening = holes.reduce((a, b) => (tall(b) > tall(a) ? b : a))
      let onInner = 0
      for (const q of opening) {
        if (Math.abs(q.y - (A - hb - bar)) < 1e-6) continue
        const dOut = toLine(q, arch)
        if (Math.abs(dOut - band) > 0.3) throw new Error(`${label}: opening point (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) is ${dOut.toFixed(2)} from the arch`)
        onInner++
      }
      expect(onInner, label).toBeGreaterThan(20)
      expect(Math.max(...opening.map(q => q.y)), label).toBeCloseTo(A - hb - bar, 3)
      // the fret: inside the band, 2 mm from its outline and from the opening
      const fret = holes.filter(h => h !== opening)
      expect(fret.length, label).toBeGreaterThan(10)
      for (const h of fret) {
        expect(polyDistance(h, outer), label).toBeGreaterThan(2 - 0.05)
        expect(polyDistance(h, opening), label).toBeGreaterThan(2 - 0.05)
      }
      // the arch's own fret shows through the opening: the band plus 2 mm from the arch's edge, 2 mm above the bar
      const archHoles = holesOf(back).filter(h => bbox([h]).maxY < A)
      expect(archHoles.length, label).toBeGreaterThan(20)
      for (const h of archHoles) {
        const hp = samplePoly(h, 20)
        expect(toPolyline(hp, arch), `${label} arch hole to the edge`).toBeGreaterThan(band + 2 - 0.05)
        expect(bbox([h]).maxY, `${label} arch hole above the bar`).toBeLessThanOrEqual(A - hb - bar - 2 + 1e-6)
      }
    }
  })

  it('the lid lifts straight out: the band and its bar end above the lid lifted by its lip, and the lid butts against the arch', () => {
    for (const t of [2, 3.2, 6]) for (const lipH of [4, 10, 25]) {
      const label = `t=${t} lipH=${lipH}`
      const d = generate(tpl, { lipH, H: 90, A: 210 }, { ...S0, t })
      expect(d.errors, label).toEqual([])
      // the band's foot above the walls' top edge; the lid's top face is t above it, and the lid rises lipH before its lip clears the walls
      const foot = 210 - panel(d, 'band').h
      expect(foot, label).toBeGreaterThanOrEqual(t + lipH + 1 - 1e-6)
      // the lid reaches from the front face to the arch's face: the back wall is t thick
      expect(panel(d, 'lid').h, label).toBeCloseTo(220 - t, 6)
      expect(panel(d, 'lid').w, label).toBeCloseTo(300, 6)
      // the lip frame fits inside the walls with the clearance on every side, and is no deeper than the box
      expect(panel(d, 'lip-fb').w + 2 * t + 2 * 0.5, label).toBeCloseTo(300, 6)
      expect(panel(d, 'lip-fb').h, label).toBeLessThanOrEqual(90 - t - 4)
      expect(d.notes.some(n => n.includes(`${lipH + 1} مم فوق سطح الغطاء`)), label).toBe(true)
    }
  })

  it('the back panel keeps the walls\' finger joints: the same fingers as the front on its sides and foot, the bottom\'s fingers opposite', () => {
    for (const t of [2, 3, 6]) {
      const d = generate(tpl, { A: 210 }, { ...S0, t })
      const back = panel(d, 'back'), front = panel(d, 'front'), A = back.h - 70
      expect(A, `t=${t}`).toBeCloseTo(210, 6)
      for (const X of [t / 2, 300 - t / 2]) {
        const f = materialAt(outerOf(front), X)
        const b = materialAt(outerOf(back), X).map(([a, c]) => [Math.max(0, a - A), c - A]).filter(([, c]) => c > 0)
        expect(b.length, `t=${t} X=${X}`).toBe(f.length)
        b.forEach(([a, c], i) => { expect(a, `t=${t}`).toBeCloseTo(f[i][0], 2); expect(c, `t=${t}`).toBeCloseTo(f[i][1], 2) })
        // the top finger runs on up into the arch's leg
        expect(materialAt(outerOf(back), X)[0][0], `t=${t}`).toBeLessThan(A - 1)
      }
      // the foot: back and front cut alike, the bottom panel's edge the other way round (and both ends kept on the bottom)
      const row = (pn: Pn, Y: number) => { const P = samplePoly(outerOf(pn)), xs: number[] = []; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; if ((a.y <= Y && c.y > Y) || (c.y <= Y && a.y > Y)) xs.push(a.x + (c.x - a.x) * (Y - a.y) / (c.y - a.y)) } return xs.sort((u, v) => u - v) }
      const rb = row(back, back.h - t / 2), rf = row(front, 70 - t / 2), rB = row(panel(d, 'bottom'), t / 2)
      expect(rb.length, `t=${t}`).toBe(rf.length)
      rb.forEach((x, i) => expect(x).toBeCloseTo(rf[i], 3))
      expect(rB.length).toBe(rf.length + 2)
      rf.forEach((x, i) => expect(rB[i + 1]).toBeCloseTo(x, 3))
    }
  })

  it('the knob holes line up: centred in the lid and in the lozenge, which sits on its engraved outline, both a hair wider than the screw', () => {
    for (const [W, D, knob] of [[300, 220, 4], [150, 110, 6], [500, 160, 3]]) {
      const label = `W=${W} D=${D} knob=${knob}`
      const d = generate(tpl, { W, D, knob, A: Math.round(0.7 * W), band: Math.round(W / 8) }, S0)
      expect(d.errors, label).toEqual([])
      const lid = panel(d, 'lid'), loz = panel(d, 'lozenge')
      const hole = (pn: Pn) => holesOf(pn).map(h => bbox([h])).find(b => Math.abs(b.maxX - b.minX - knob - 0.4) < 1e-6 && Math.abs(b.maxY - b.minY - knob - 0.4) < 1e-6)!
      const hl = hole(lid), hz = hole(loz)
      expect(hl, `${label} lid hole`).toBeTruthy()
      expect(hz, `${label} lozenge hole`).toBeTruthy()
      expect((hl.minX + hl.maxX) / 2, label).toBeCloseTo(W / 2, 6)
      expect((hl.minY + hl.maxY) / 2, label).toBeCloseTo((D - 3) / 2, 6)
      // the lozenge's hole in the middle of the piece, and the piece the same as the outline engraved round the lid's hole
      expect((hz.minX + hz.maxX) / 2, label).toBeCloseTo(loz.w / 2, 3)
      expect((hz.minY + hz.maxY) / 2, label).toBeCloseTo(loz.h / 2, 3)
      const e = bbox(lid.loops.filter(l => l.layer === 'engrave'))
      expect(e.maxX - e.minX, label).toBeCloseTo(loz.w, 3)
      expect(e.maxY - e.minY, label).toBeCloseTo(loz.h, 3)
      expect((e.minX + e.maxX) / 2, label).toBeCloseTo((hl.minX + hl.maxX) / 2, 3)
      expect((e.minY + e.maxY) / 2, label).toBeCloseTo((hl.minY + hl.maxY) / 2, 3)
      // the lozenge lies on the lid with room round it
      expect(e.minX, label).toBeGreaterThan(5)
      expect(e.minY, label).toBeGreaterThan(5)
      expect(e.maxY, label).toBeLessThan(lid.h - 5)
      // its fret is the lattice centred on the knob: every hole has its mirror image through the centre
      const cs = holesOf(loz).map(h => { const b = bbox([h]); return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } })
      expect(cs.length, label).toBeGreaterThan(8)
      for (const c of cs) expect(cs.some(o => Math.hypot(o.x + c.x - loz.w, o.y + c.y - loz.h) < 0.05), `${label} mirror of ${c.x.toFixed(1)},${c.y.toFixed(1)}`).toBe(true)
      // and centred on its small four-pointed star: the four big eight-pointed stars sit on the diagonals round the knob
      // (a rounding error once counted one row less and slid the lattice half a tile, a star's points into the knob)
      const stars = holesOf(loz).filter(h => bbox([h]).maxX - bbox([h]).minX > knob + 1).sort((a, b) => signedArea(a) - signedArea(b)).slice(0, 4)
      for (const h of stars) { const b = bbox([h]), dx = Math.abs((b.minX + b.maxX) / 2 - loz.w / 2), dy = Math.abs((b.minY + b.maxY) / 2 - loz.h / 2); expect(dx, label).toBeGreaterThan(3); expect(dx - dy, label).toBeCloseTo(0, 1) }
    }
  })

  it('the walls keep solid margins round the fret: 2t + 2 from every edge and the lip zone at the top', () => {
    for (const t of [3, 4]) {
      const d = generate(tpl, { lipH: 14 }, { ...S0, t })
      expect(d.errors).toEqual([])
      for (const id of ['front', 'side']) {
        const pn = panel(d, id), hs = holesOf(pn)
        expect(hs.length, id).toBeGreaterThan(10)
        for (const h of hs) {
          const b = bbox([h])
          expect(b.minX, `${id} left`).toBeGreaterThanOrEqual(2 * t + 2 - 1e-6)
          expect(b.maxX, `${id} right`).toBeLessThanOrEqual(pn.w - 2 * t - 2 + 1e-6)
          expect(b.minY, `${id} top (lip zone)`).toBeGreaterThanOrEqual(14 + 2 - 1e-6)
          expect(b.maxY, `${id} bottom`).toBeLessThanOrEqual(70 - 2 * t - 2 + 1e-6)
        }
      }
    }
  })

  it('refuses, saying what to change and to what, and the values it gives really fix the design', () => {
    const e = (p: Record<string, number>, t = 3) => generate(tpl, p, { ...S0, t }).errors
    expect(e({ A: 100 }).some(m => m.includes('منخفض') && m.includes('150'))).toBe(true)
    expect(e({ A: 700 }).some(m => m.includes('طويل') && m.includes('600'))).toBe(true)
    expect(e({ band: 60 }).some(m => m.includes('الشريط') && /\d+ مم أو أقل/.test(m))).toBe(true)
    expect(e({ lipH: 40, H: 40 }).some(m => m.includes('الشفة') && m.includes('33'))).toBe(true)
    expect(e({ H: 32, cell: 30 }).some(m => m.includes('الزخرفة') && /\d/.test(m))).toBe(true)
    expect(e({}, 3)).toEqual([])
    // the box height it asks for takes the pattern at the cell chosen (it once asked for a height that only fitted a 6 mm cell)
    for (const [H, cell, lipH] of [[30, 12, 10], [40, 30, 10], [45, 12, 20]]) {
      const msg = e({ H, cell, lipH }).find(m => m.includes('ارفع العلبة إلى'))!
      expect(msg, `H=${H} cell=${cell}`).toBeTruthy()
      expect(e({ H: suggestion(msg, true)!.H, cell, lipH }), `H=${H} cell=${cell}`).toEqual([])
    }
    // every refusal at the extremes and in random mixes is mended within three rounds by doing what the messages say
    const variants: Record<string, number>[] = []
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let seed = 777
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    for (let k = 0; k < 40; k++) {
      const v: Record<string, number> = {}
      for (const def of [...tpl.params].sort(() => rnd() - 0.5).slice(0, 4)) { const st = def.step ?? 1; v[def.key] = Math.round((def.min + rnd() * (def.max - def.min)) / st) * st }
      variants.push(v)
    }
    let refused = 0
    for (const v of variants) for (const t of [2, 6]) for (const alt of [false, true]) {
      if (!e(v, t).length) continue
      refused++
      let p = { ...v }, errs = e(p, t)
      for (let round = 0; round < 3 && errs.length; round++) {
        for (const m of errs) { const s = suggestion(m, alt); expect(s, `${JSON.stringify(v)} t=${t}: no value in «${m}»`).not.toBeNull(); p = { ...p, ...s } }
        errs = e(p, t)
      }
      expect(errs, `${JSON.stringify(v)} t=${t} after ${JSON.stringify(p)}`).toEqual([])
    }
    expect(refused).toBeGreaterThan(20)
  })

  it('builds the defaults in well under 150 ms', () => {
    generate(tpl, {}, DEFAULT_SETTINGS)
    const times: number[] = []
    for (let i = 0; i < 5; i++) { const t0 = performance.now(); generate(tpl, {}, DEFAULT_SETTINGS); times.push(performance.now() - t0) }
    expect(times.sort((a, b) => a - b)[2]).toBeLessThan(150)
  })

  it('the robustness grid: sound geometry for every thickness, kerf and parameter extreme (sizes included), or a refusal', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    // the width at its ends with an arch and a band in proportion, so the extreme widths are built rather than refused
    variants.push({ W: 100, A: 70, band: 12 }, { W: 600, A: 420, band: 60 })
    let runs = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      runs++
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (err) { throw new Error(`${label} threw: ${(err as Error).message}`) }
      let finite = true
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) finite = false
      expect(finite, `${label} non-finite`).toBe(true)
      if (d.errors.length) { refused++; continue }
      // plain checks in the hot loops (an expect per hole pair would cost more than the geometry), one assertion per run
      const problems: string[] = []
      for (const pn of d.panels) {
        if (!(pn.w > 0)) problems.push(`${pn.id} width`)
        const closed = cutLoops(pn), outers = closed.filter(l => signedArea(l) > 0)
        if (outers.length !== 1) { problems.push(`${pn.id} ${outers.length} outer loops`); continue }
        const outer = samplePoly(outers[0], 15), segs = segsOf(outer)
        if (selfIntersects(outer)) problems.push(`${pn.id} self-intersects`)
        const hs = closed.filter(l => signedArea(l) < 0).map(h => ({ p: samplePoly(h, 20), b: bbox([h]) }))
        // a hole with one vertex inside and no outline segment within 0.8 mm lies wholly inside with that margin
        for (const { p: hp, b } of hs) {
          if (selfIntersects(hp)) problems.push(`${pn.id} hole self-intersects at ${b.minX.toFixed(1)},${b.minY.toFixed(1)}`)
          if (!pointIn(hp[0], outer)) problems.push(`${pn.id} hole outside at ${b.minX.toFixed(1)},${b.minY.toFixed(1)}`)
          const dd = distToOutline(hp, b, segs)
          if (!(dd > 0.8 - 1e-9)) problems.push(`${pn.id} hole ${dd.toFixed(2)} from the edge at ${b.minX.toFixed(1)},${b.minY.toFixed(1)}`)
        }
        // holes apart, and none inside another (the fret inside the band's opening would fall out)
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i].b, b = hs[j].b
          if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
          if (!keepApart(hs[i].p, hs[j].p, 0.8 - 1e-9)) problems.push(`${pn.id} holes too close at ${a.minX.toFixed(1)},${a.minY.toFixed(1)}`)
          else if (pointIn(hs[i].p[0], hs[j].p) || pointIn(hs[j].p[0], hs[i].p)) problems.push(`${pn.id} hole inside a hole at ${a.minX.toFixed(1)},${a.minY.toFixed(1)}`)
        }
        for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (!(Math.hypot(q.x - outer[i].x, q.y - outer[i].y) > 1e-6)) problems.push(`${pn.id} zero-length edge`) }
        if (problems.length > 20) break
      }
      expect(problems, label).toEqual([])
      if (kerf) { const dxf = toDXF(d.layout); expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false) }
    }
    expect(runs).toBeGreaterThan(300)
    expect(refused).toBeLessThan(runs / 3)
  })
})
