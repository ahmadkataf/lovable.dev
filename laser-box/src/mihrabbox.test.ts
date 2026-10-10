import { describe, it, expect } from 'vitest'
import { MIHRAB_BOXES, archProfile, insetPath } from './mihrabbox'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, segDist } from './testutil'

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
/** Whether two polygons keep at least `min` apart; segment pairs whose boxes are further apart are not measured. */
function keepApart(A: P[], B: P[], min: number): boolean {
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length], x0 = Math.min(a.x, b.x) - min, x1 = Math.max(a.x, b.x) + min, y0 = Math.min(a.y, b.y) - min, y1 = Math.max(a.y, b.y) + min
    for (let j = 0; j < B.length; j++) {
      const c = B[j], d = B[(j + 1) % B.length]
      if (Math.max(c.x, d.x) < x0 || Math.min(c.x, d.x) > x1 || Math.max(c.y, d.y) < y0 || Math.min(c.y, d.y) > y1) continue
      if (segDist(a, b, c, d) < min) return false
    }
  }
  return true
}
/** Distance from a hole to the outline, looking only at outline segments near the hole's box (Infinity when none is within a millimetre). */
function distToOutline(hp: P[], hb: { minX: number; minY: number; maxX: number; maxY: number }, segs: Seg[]): number {
  let best = Infinity
  for (const s of segs) {
    if (s.x1 < hb.minX - 1 || s.x0 > hb.maxX + 1 || s.y1 < hb.minY - 1 || s.y0 > hb.maxY + 1) continue
    for (let i = 0; i < hp.length; i++) best = Math.min(best, segDist(hp[i], hp[(i + 1) % hp.length], s.a, s.b))
  }
  return best
}

describe('the mihrab sweets box', () => {
  it('builds at its defaults on the common sheets: the box, the lid with its lip frame, the gold lozenge and the gold band', () => {
    for (const t of [2.7, 3, 3.2]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort()).toEqual(['back', 'band', 'bottom', 'front', 'lid', 'lip-fb', 'lip-side', 'lozenge', 'side'])
      expect(panel(d, 'side').count).toBe(2)
      expect(panel(d, 'band').material).toBe('gold')
      expect(panel(d, 'lozenge').material).toBe('gold')
      // the back is the wall plus the arch, one outer loop, as wide as the box
      const back = panel(d, 'back')
      expect(back.h).toBeCloseTo(70 + 270, 3)
      expect(back.w).toBeCloseTo(300, 3)
      expect(cutLoops(back).filter(l => signedArea(l) > 0).length).toBe(1)
      // the lid covers the front and the sides and stops at the arch's face
      expect(panel(d, 'lid').w).toBeCloseTo(300, 3)
      expect(panel(d, 'lid').h).toBeCloseTo(220 - t, 3)
      expect(panel(d, 'lip-fb').w).toBeCloseTo(300 - 2 * t - 1, 3)
      expect(panel(d, 'lip-side').w).toBeCloseTo(220 - 2 * t - 1, 3)
      // the knob hole in the lid and the lozenge
      for (const id of ['lid', 'lozenge']) {
        const k = holesOf(panel(d, id)).map(h => bbox([h])).find(b => Math.abs(b.maxX - b.minX - 4) < 1e-6 && Math.abs(b.maxY - b.minY - 4) < 1e-6)
        expect(k, `${id} knob hole`).toBeTruthy()
      }
      // fretted walls, arch and band
      expect(holesOf(panel(d, 'front')).length).toBeGreaterThan(20)
      expect(holesOf(panel(d, 'back')).length).toBeGreaterThan(holesOf(panel(d, 'front')).length + 40)
      expect(holesOf(panel(d, 'band')).length).toBeGreaterThan(20)
    }
  })

  it('a narrow band is engraved rather than fretted, a very narrow one left plain', () => {
    const d = generate(tpl, { band: 11 }, S0)
    expect(d.errors).toEqual([])
    const bd = panel(d, 'band')
    expect(holesOf(bd).length).toBe(0)
    expect(bd.loops.filter(l => l.layer === 'engrave').length).toBeGreaterThan(6)
    expect(d.notes.some(n => n.includes('محفورة'))).toBe(true)
    const d2 = generate(tpl, { band: 6 }, S0)
    expect(d2.errors).toEqual([])
    expect(panel(d2, 'band').loops.length).toBe(1)
  })

  it('copies every panel n times', () => {
    const d = generate(tpl, { n: 3 }, S0)
    expect(d.errors).toEqual([])
    expect(panel(d, 'side').count).toBe(6)
    expect(panel(d, 'back').count).toBe(3)
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
      for (let i = 0; i <= top; i++) { const m = pts[pts.length - 1 - i + (i === 0 ? 0 : 0)]; if (i > 0) { expect(m.x, `${label} mirror`).toBeCloseTo(W - pts[i].x, 6); expect(m.y).toBeCloseTo(pts[i].y, 6) } }
      // vertical at the springing: the first step rises much more than it moves in
      expect(pts[1].y, label).toBeGreaterThan(5 * pts[1].x)
      expect(alpha, label).toBeGreaterThan(0.1)
      expect(alpha, label).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
      // the inset path stays monotone too, and the inner apex lies on the axis below the outer one
      const inner = insetPath(pts, W, 25, 4)
      const it2 = inner.reduce((b, p, i) => (p.y > inner[b].y ? i : b), 0)
      expect(inner[it2].x, label).toBeCloseTo(W / 2, 6)
      expect(inner[it2].y, label).toBeLessThan(A - 24)
      expect(inner[it2].y, label).toBeGreaterThan(A - 1.25 * (25 / Math.sin(alpha)) - 3)
      for (let i = 1; i <= it2; i++) expect(inner[i].x, `${label} inset monotone at ${i}`).toBeGreaterThanOrEqual(inner[i - 1].x - 1e-9)
      expect(inner[0].x, label).toBeCloseTo(25, 0)
      expect(inner[0].y, label).toBe(4)
    }
  })

  it('the gold band follows the arch outline exactly, is as wide as asked, ends above the lid, and its fret keeps 2 mm from both edges', () => {
    for (const [style, band, t] of [[1, 25, 3], [2, 20, 3], [3, 30, 2.7], [1, 18, 4]] as const) {
      const d = generate(tpl, { style, band, lipH: 14 }, { ...S0, t }), label = `style=${style} band=${band}`
      expect(d.errors, label).toEqual([])
      const back = panel(d, 'back'), bd = panel(d, 'band')
      const A = 270, hb = t + 1
      expect(bd.h, label).toBeCloseTo(A - hb, 2)
      expect(bd.w, label).toBeCloseTo(300, 0)
      // the band's legs curve in a hair above its cut-off, so its box is a hair narrower: align the two on their middles
      const dx = (back.w - bd.w) / 2
      const outer = samplePoly(outerOf(bd), 10).map(q => ({ x: q.x + dx, y: q.y })), arch = samplePoly(outerOf(back), 10)
      // every point of the band's outline lies on the arch outline, or on its inner edge one band width in, or on the cut-off line
      const archAbove = arch.filter(q => q.y <= A + 1e-6)
      let onEdge = 0, onInner = 0
      for (const q of outer) {
        if (Math.abs(q.y - (A - hb)) < 1e-6) continue
        let dOut = Infinity
        for (let i = 0; i + 1 < archAbove.length; i++) dOut = Math.min(dOut, polyDistance([q, q], [archAbove[i], archAbove[i + 1]]))
        if (dOut < 0.05) onEdge++
        else if (Math.abs(dOut - band) < 0.3) onInner++
        else throw new Error(`${label}: band outline point (${q.x.toFixed(2)}, ${q.y.toFixed(2)}) is ${dOut.toFixed(2)} from the arch`)
      }
      expect(onEdge, label).toBeGreaterThan(20)
      expect(onInner, label).toBeGreaterThan(20)
      // the fret: inside the band, 2 mm from its edges
      const hs = holesOf(bd)
      expect(hs.length, label).toBeGreaterThan(10)
      for (const h of hs) expect(polyDistance(samplePoly(h, 20), outer), label).toBeGreaterThan(2 - 0.05)
      // the arch's own fret leaves the band zone solid: at least the band plus 2 mm from the arch's edge
      const archHoles = holesOf(back).filter(h => bbox([h]).maxY < A)
      expect(archHoles.length, label).toBeGreaterThan(30)
      for (const h of archHoles) {
        const hp = samplePoly(h, 20)
        let dMin = Infinity
        for (let i = 0; i + 1 < archAbove.length; i++) dMin = Math.min(dMin, polyDistance(hp, [archAbove[i], archAbove[i + 1]]))
        expect(dMin, `${label} arch hole to the edge`).toBeGreaterThan(band + 2 - 0.05)
      }
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

  it('refuses, saying what to change, when the arch is too low or too tall, the band too wide, the lip wrong, or the walls too small for the pattern', () => {
    const e = (p: Record<string, number>, t = 3) => generate(tpl, p, { ...S0, t }).errors
    expect(e({ A: 100 }).some(m => m.includes('منخفض') && m.includes('150'))).toBe(true)
    expect(e({ A: 700 }).some(m => m.includes('طويل') && m.includes('600'))).toBe(true)
    expect(e({ band: 60 }).some(m => m.includes('الشريط') && /\d+ مم أو أقل/.test(m))).toBe(true)
    expect(e({ lipH: 40, H: 40 }).some(m => m.includes('الشفة') && m.includes('33'))).toBe(true)
    expect(e({ H: 32, cell: 30 }).some(m => m.includes('الزخرفة') && /\d/.test(m))).toBe(true)
    // the suggested cell really fits
    const msg = e({ H: 40, cell: 30 }).find(m => m.includes('حجم الزخرفة'))!
    const cell = parseFloat(msg.match(/حجم الزخرفة ([\d.]+) مم/)![1])
    expect(e({ H: 40, cell })).toEqual([])
    expect(e({}, 3)).toEqual([])
  })

  it('the robustness grid: sound geometry for every thickness, kerf and parameter extreme, or a refusal', () => {
    const extras = tpl.params.filter(d => !['W', 'D', 'H'].includes(d.key))
    const variants: Record<string, number>[] = [{}]
    for (const def of extras) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      runs++
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (err) { throw new Error(`${label} threw: ${(err as Error).message}`) }
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${label} ${pn.id} non-finite`).toBe(true)
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
          if (!pointIn(hp[0], outer)) problems.push(`${pn.id} hole outside at ${b.minX.toFixed(1)},${b.minY.toFixed(1)}`)
          const dd = distToOutline(hp, b, segs)
          if (!(dd > 0.8 - 1e-9)) problems.push(`${pn.id} hole ${dd.toFixed(2)} from the edge at ${b.minX.toFixed(1)},${b.minY.toFixed(1)}`)
        }
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i].b, b = hs[j].b
          if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
          if (!keepApart(hs[i].p, hs[j].p, 0.8 - 1e-9)) problems.push(`${pn.id} holes too close at ${a.minX.toFixed(1)},${a.minY.toFixed(1)}`)
        }
        for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (!(Math.hypot(q.x - outer[i].x, q.y - outer[i].y) > 1e-6)) problems.push(`${pn.id} zero-length edge`) }
        if (problems.length > 20) break
      }
      expect(problems, label).toEqual([])
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
    }
    expect(runs).toBeGreaterThan(100)
    expect(refused).toBeLessThan(runs / 2)
  })
})
