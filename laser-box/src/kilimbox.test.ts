import { describe, it, expect } from 'vitest'
import { KILIM_BOXES, MOTIF_MASKS, motifCells, motifLoops, motifStep, cellMin, wallBand, bandUnit, lidPattern, KILIM_GAP, BAND_ROWS } from './kilimbox'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects, materialAt } from './testutil'

const tpl = KILIM_BOXES[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type L = { closed: boolean; layer?: string; pts: { x: number; y: number; b?: number }[] }
type Pn = { id: string; name: string; w: number; h: number; count: number; loops: L[] }
const cutOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: Pn) => cutOf(pn).filter(l => signedArea(l as never) < 0)
const outerOf = (pn: Pn) => cutOf(pn).find(l => signedArea(l as never) > 0)!
const engOf = (pn: Pn) => pn.loops.filter(l => l.layer === 'engrave')
const get = (d: { panels: Pn[] }, id: string) => d.panels.find(x => x.id === id)!
const bb = (l: L) => bbox([l as never])

/** the gridsuite's soundness checks on the cut loops of one design; the problems found, as text */
function soundness(d: { panels: Pn[]; layout: never }, label: string): string[] {
  const bad: string[] = []
  for (const pn of d.panels) {
    const lab = `${label} ${pn.id}`
    if (!(pn.w > 0)) bad.push(`${lab} width`)
    const outers = cutOf(pn).filter(l => signedArea(l as never) > 0)
    if (outers.length !== 1) { bad.push(`${lab} ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0] as never, 15)
    if (selfIntersects(outer)) bad.push(`${lab} self-intersects`)
    for (const h of holesOf(pn)) {
      const hp = samplePoly(h as never, 20)
      if (hp.some(q => !pointIn(q, outer))) bad.push(`${lab} hole outside`)
      if (polyDistance(hp, outer) <= 0.8 - 1e-9) bad.push(`${lab} hole too close to the edge`)
    }
    for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (Math.hypot(q.x - outer[i].x, q.y - outer[i].y) <= 1e-6) bad.push(`${lab} zero-length edge`) }
    for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push(`${lab} non-finite`)
  }
  const dxf = toDXF(d.layout)
  if (dxf.includes('NaN') || dxf.includes('undefined')) bad.push(`${label} dxf`)
  return bad
}

/** which edges of each piece carry finger joints: [left, top, right, bottom] */
const JOINTED: Record<string, [boolean, boolean, boolean, boolean]> = {
  bottom: [true, true, true, true], lid: [true, true, true, true],
  front: [true, false, true, true], back: [true, false, true, true], side: [true, false, true, true],
  lidfront: [true, true, true, false], lidback: [true, true, true, false], lidside: [true, true, true, false],
}

/**
 * Engraving that RDWorks can scan-fill as drawn: closed simple loops, inside the piece at least 1 mm from its edges
 * and t + 1 from every finger-jointed edge, clear of the holes, and no two loops overlapping, nested or touching.
 */
function engraveProblems(d: { panels: Pn[] }, t: number, label: string, minGap = 0.75): string[] {
  const bad: string[] = []
  for (const pn of d.panels) {
    const eng = engOf(pn)
    if (!eng.length) continue
    const outer = samplePoly(outerOf(pn) as never, 15), holes = holesOf(pn).map(h => ({ p: samplePoly(h as never, 20), b: bb(h) }))
    const [jl, jt, jr, jb] = JOINTED[pn.id]
    const items = eng.map(l => ({ p: samplePoly(l as never, 20), b: bb(l) }))
    for (const [k, it] of items.entries()) {
      const lab = `${label} ${pn.id} engrave #${k}`
      if (!eng[k].closed) bad.push(`${lab} open`)
      if (selfIntersects(it.p)) bad.push(`${lab} self-intersects`)
      for (let i = 0; i < it.p.length; i++) { const q = it.p[(i + 1) % it.p.length]; if (Math.hypot(q.x - it.p[i].x, q.y - it.p[i].y) <= 1e-6) bad.push(`${lab} zero-length edge`) }
      if (it.b.minX < (jl ? t + 1 : 1) - 1e-6 || it.b.minY < (jt ? t + 1 : 1) - 1e-6 || pn.w - it.b.maxX < (jr ? t + 1 : 1) - 1e-6 || pn.h - it.b.maxY < (jb ? t + 1 : 1) - 1e-6) bad.push(`${lab} too near an edge`)
      if (!pointIn(it.p[0], outer)) bad.push(`${lab} outside`)
      for (const h of holes) {
        if (h.b.minX > it.b.maxX + 2 || it.b.minX > h.b.maxX + 2 || h.b.minY > it.b.maxY + 2 || it.b.minY > h.b.maxY + 2) continue
        if (polyDistance(h.p, it.p) <= 0.8 - 1e-9 || pointIn(h.p[0], it.p) || pointIn(it.p[0], h.p)) bad.push(`${lab} over or near a hole`)
      }
    }
    // pairs, swept along x
    const order = items.map((_, k) => k).sort((a, b) => items[a].b.minX - items[b].b.minX)
    for (let ii = 0; ii < order.length; ii++) {
      const A = items[order[ii]]
      for (let jj = ii + 1; jj < order.length; jj++) {
        const B = items[order[jj]]
        if (B.b.minX > A.b.maxX + 1) break
        if (A.b.minY > B.b.maxY + 1 || B.b.minY > A.b.maxY + 1) continue
        const lab = `${label} ${pn.id} engrave #${order[ii]} / #${order[jj]}`
        if (polyDistance(A.p, B.p) <= minGap) bad.push(`${lab} too close`)
        if (pointIn(A.p[0], B.p) || pointIn(B.p[0], A.p)) bad.push(`${lab} nested`)
      }
    }
  }
  return bad
}

describe('the kilim box', () => {
  it('builds at its defaults on every common sheet: two finger-jointed trays, engraved and sound', () => {
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) {
      const label = `t=${t} kerf=${kerf}`
      // the default lid (16 mm) is lower than four 6 mm sheets: that one is refused, a 24 mm lid builds
      const params: Record<string, number> = t === 6 ? { hl: 24 } : {}
      const d = generate(tpl, params, { ...S0, t, kerf }) as never as { panels: Pn[]; errors: string[]; warnings: string[]; layout: never; notes: string[] }
      expect(d.errors, label).toEqual([])
      expect(d.warnings, label).toEqual([])
      expect(d.panels.map(p => p.id).sort(), label).toEqual(['back', 'bottom', 'front', 'lid', 'lidback', 'lidfront', 'lidside', 'side'])
      expect(get(d, 'side').count).toBe(2)
      expect(get(d, 'lidside').count).toBe(2)
      expect(soundness(d, label)).toEqual([])
      expect(engraveProblems(d, t, label)).toEqual([])
      // the lid's lattice and motifs, the front band, the hinge, clasp and feet marks
      expect(engOf(get(d, 'lid')).length, label).toBeGreaterThan(300)
      expect(engOf(get(d, 'front')).length, label).toBeGreaterThan(10)
      expect(engOf(get(d, 'bottom')).length, label).toBe(4)
      expect(engOf(get(d, 'back')).length, label).toBe(4)
      expect(engOf(get(d, 'lidback')).length, label).toBe(4)
      expect(engOf(get(d, 'lidfront')).length, label).toBe(2)
      expect(engOf(get(d, 'side')).length, label).toBe(0)
      // the knob hole at the middle of the lid
      const knob = holesOf(get(d, 'lid'))
      expect(knob.length, label).toBe(1)
      const kb = bb(knob[0]), lid = get(d, 'lid')
      expect(kb.maxX - kb.minX, label).toBeCloseTo(tpl.defaults.knob - kerf, 2)
      expect((kb.minX + kb.maxX) / 2, label).toBeCloseTo(lid.w / 2, 2)
      expect(d.notes.join(' '), label).toContain('مفصّلتان')
    }
  })

  it('sizes the trays: walls H and hl tall, the bottom and lid W × D', () => {
    const d = generate(tpl, {}, S0) as never as { panels: Pn[] }
    const { W, D, H, hl } = tpl.defaults
    for (const [id, w, h] of [['bottom', W, D], ['lid', W, D], ['front', W, H], ['back', W, H], ['side', D, H], ['lidfront', W, hl], ['lidback', W, hl], ['lidside', D, hl]] as const) {
      expect(get(d, id).w, id).toBeCloseTo(w, 3)
      expect(get(d, id).h, id).toBeCloseTo(h, 3)
    }
    // inner sizes: the walls and the bottom are added
    const di = generate(tpl, {}, { ...S0, inner: true }) as never as { panels: Pn[] }
    expect(get(di, 'bottom').w).toBeCloseTo(W + 2 * 3, 3)
    expect(get(di, 'front').h).toBeCloseTo(H + 3, 3)
  })

  it('passes the robustness grid: thickness × kerf × defaults and every parameter at its min and max, or refuses with an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    const bad: string[] = []
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      const d = generate(tpl, v, { ...S0, t, kerf }) as never as { panels: Pn[]; errors: string[]; layout: never }
      runs++
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push(`${label} non-finite`)
      if (d.errors.length) { refused++; continue }
      bad.push(...soundness(d, label))
      // engraving is the same at every kerf: check it once
      if (kerf === 0) bad.push(...engraveProblems(d, t, label))
      if (bad.length > 20) break
    }
    expect(bad).toEqual([])
    expect(runs).toBe(6 * 2 * variants.length)
    expect(refused).toBeLessThan(runs / 4)
  })

  it('refuses what cannot be built, and says what to change', () => {
    const e1 = generate(tpl, { hl: 8 }, { ...S0, t: 3.2 }).errors
    expect(e1.length).toBe(1)
    expect(e1[0]).toContain('ارتفاع الغطاء')
    expect(e1[0]).toContain('13 مم')
    // the value it gives builds, at every thickness, and so does exactly four thicknesses (3 × 3.2 was refused as 9.6)
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) {
      const e = generate(tpl, { hl: 2 * t }, { ...S0, t }).errors
      expect(e.length, `t=${t}`).toBe(1)
      const up = Number(/اجعله ([\d.]+) مم/.exec(e[0])![1])
      expect(generate(tpl, { hl: up }, { ...S0, t }).errors, `t=${t}`).toEqual([])
      expect(generate(tpl, { hl: 4 * t }, { ...S0, t }).errors, `t=${t}`).toEqual([])
    }
    const lw = 1.2, min = cellMin(lw)
    const e2 = generate(tpl, { cell: min - 1, lw }, S0).errors
    expect(e2.length).toBe(1)
    expect(e2[0]).toContain(`${min} مم`)
    expect(generate(tpl, { cell: min, lw }, S0).errors).toEqual([])
    // with the lid plain, a small rhombus is no matter
    expect(generate(tpl, { cell: min - 1, lidDeco: 0 }, S0).errors).toEqual([])
    const e3 = generate(tpl, { W: 60, D: 50, H: 20 }, { ...S0, t: 6, kerf: 0 }).errors
    expect(e3.some(e => e.includes('ارتفاع القاعدة') && e.includes('24'))).toBe(true)
  })

  it('leaves the band out of a wall too low for it, with a warning and no error', () => {
    const d = generate(tpl, { H: 24 }, { ...S0, t: 4 }) as never as { panels: Pn[]; errors: string[]; warnings: string[] }
    expect(d.errors).toEqual([])
    expect(d.warnings.some(w => w.includes('شريط الجدار'))).toBe(true)
    expect(engOf(get(d, 'front')).length).toBe(2) // the clasp's ticks alone
    const up = Number(/(\d+) مم أو أكثر/.exec(d.warnings.find(w => w.includes('شريط الجدار'))!)![1])
    const d2 = generate(tpl, { H: up }, { ...S0, t: 4 }) as never as { panels: Pn[]; warnings: string[] }
    expect(d2.warnings.filter(w => w.includes('شريط الجدار'))).toEqual([])
    expect(engOf(get(d2, 'front')).length).toBeGreaterThan(5)
  })
})

describe('the kilim ornament', () => {
  it('draws each motif inside the stepped diamond: one polyline for the cross and the ram\'s horn, separate pieces a step apart otherwise', () => {
    const s = 3
    for (const m of [1, 2, 3, 4]) {
      const cells = motifCells(m)
      for (const [i, j] of cells) expect(Math.abs(i) + Math.abs(j), `motif ${m}`).toBeLessThanOrEqual(4)
      const loops = motifLoops(m, 50, 50, s)
      expect(loops.length, `motif ${m}`).toBe(m === 1 ? 5 : m === 4 ? cells.length : 1)
      const ps = loops.map(l => samplePoly(l, 20))
      for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) expect(polyDistance(ps[a], ps[b]), `motif ${m}`).toBeGreaterThan(m === 4 ? 0.8 : 0.99 * s)
      // the stepped outline: every edge runs along x or y and is a whole number of steps or the chequer's square
      for (const l of loops) for (let k = 0; k < l.pts.length; k++) { const p = l.pts[k], q = l.pts[(k + 1) % l.pts.length]; expect(Math.abs(p.x - q.x) < 1e-6 || Math.abs(p.y - q.y) < 1e-6).toBe(true) }
      // mirror symmetric both ways, like the rug's motifs
      const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`
      const pts = new Set(loops.flatMap(l => l.pts.map(q => key(q.x, q.y))))
      for (const l of loops) for (const q of l.pts) { expect(pts.has(key(100 - q.x, q.y)), `motif ${m} mirror x`).toBe(true); expect(pts.has(key(q.x, 100 - q.y)), `motif ${m} mirror y`).toBe(true) }
    }
    expect(Object.keys(MOTIF_MASKS).length).toBe(3)
  })

  it('weaves the lattice: bands never meet, every crossing has one band running on, and motifs keep clear of the lines', () => {
    const P = 34, lw = 1.2, box = { x0: 5, y0: 5, x1: 315, y1: 195 }
    const pat = lidPattern(160, 100, P, lw, 1, box)
    expect(pat.step).toBeCloseTo(P / 12, 6)
    expect(pat.full).toBeGreaterThan(50)
    const bands = pat.bands.map(l => samplePoly(l, 20))
    for (const b of bands) for (const q of b) { expect(q.x).toBeGreaterThanOrEqual(box.x0 - 1e-6); expect(q.x).toBeLessThanOrEqual(box.x1 + 1e-6); expect(q.y).toBeGreaterThanOrEqual(box.y0 - 1e-6); expect(q.y).toBeLessThanOrEqual(box.y1 + 1e-6) }
    // the crossing nearest the middle, on the line between the middle rhombus and its right-hand neighbour
    const cx = 160 + P / 2, cy = 100
    const at = bands.filter(b => pointIn({ x: cx, y: cy }, b))
    expect(at.length).toBe(1)
    // its band is a long piece running through the crossing; the other line stops a gap short on both sides
    const near = bands.filter(b => polysOverlap(b, [{ x: cx - 3, y: cy - 3 }, { x: cx + 3, y: cy - 3 }, { x: cx + 3, y: cy + 3 }, { x: cx - 3, y: cy + 3 }]))
    expect(near.length).toBe(3)
    for (const b of near) if (b !== at[0]) expect(polyDistance(b, at[0])).toBeCloseTo(KILIM_GAP, 2)
    // motifs and bands
    const motifs = pat.motifs.map(l => samplePoly(l, 20))
    for (const m of motifs) for (const b of bands) if (Math.abs(m[0].x - b[0].x) < 40 && Math.abs(m[0].y - b[0].y) < 40) expect(polyDistance(m, b)).toBeGreaterThan(KILIM_GAP - 1e-6)
    // thicker lines shrink the motif's step rather than crowd it
    expect(motifStep(P, 3)).toBeLessThan(P / 12)
    expect(motifStep(cellMin(3), 3)).toBeGreaterThanOrEqual(1.5 - 1e-9)
  })

  it('builds the wall band from the photo: a zigzag, triangles above and below, ringed medallions in the valleys, centred and symmetric', () => {
    const u = bandUnit(40, 1.2)
    expect(u).toBeCloseTo((40 - 1.2) / BAND_ROWS, 6)
    const band = wallBand(5, 315, 5, 45, 1.2, u)!
    expect(band.rings).toBe(7)
    expect(band.h).toBeCloseTo(BAND_ROWS * u + 1.2, 6)
    const boxes = band.loops.map(l => bb(l as never))
    for (const b of boxes) { expect(b.minX).toBeGreaterThanOrEqual(5 - 1e-6); expect(b.maxX).toBeLessThanOrEqual(315 + 1e-6); expect(b.minY).toBeGreaterThanOrEqual(5 - 1e-6); expect(b.maxY).toBeLessThanOrEqual(45 + 1e-6) }
    // the photo's ringed medallion at the middle, up in the top rows between the hanging triangles: its dot one step
    // square at the middle, three steps below the band's top; then the whole band mirror symmetric about it
    const top = Math.min(...boxes.map(b => b.minY))
    expect(boxes.some(b => Math.abs((b.minX + b.maxX) / 2 - 160) < 1e-3 && Math.abs(b.maxX - b.minX - u) < 1e-2 && Math.abs(b.minY - top - 3 * u) < 1e-2)).toBe(true)
    // the hanging triangles stand free (no top rule): the band's top row holds 5-step triangles and the rings' tips
    const topRow = boxes.filter(b => Math.abs(b.minY - top) < 1e-3)
    expect(topRow.every(b => b.maxX - b.minX < 5 * u + 1e-2)).toBe(true)
    const key = (x: number, y: number) => `${Math.round(x * 100)},${Math.round(y * 100)}`
    const pts = new Set(band.loops.flatMap(l => l.pts.map(q => key(q.x, q.y))))
    for (const l of band.loops) for (const q of l.pts) expect(pts.has(key(320 - q.x, q.y))).toBe(true)
    // separate shapes keep a whole step apart (the top triangles hang from their rule as one loop)
    const ps = band.loops.map(l => samplePoly(l as never, 20))
    for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) expect(polyDistance(ps[a], ps[b])).toBeGreaterThan(0.99 * u)
    expect(wallBand(5, 315, 5, 45, 1.2, 1.2)).toBeNull()
  })
})

describe('the kilim box hardware', () => {
  it('marks the hinges and the clasp where both trays meet, the feet under the bottom, and drops them when asked', () => {
    const d = generate(tpl, {}, S0) as never as { panels: Pn[] }
    const xs = (id: string) => engOf(get(d, id)).filter(l => { const b = bb(l); return b.maxX - b.minX < 1 }).map(l => { const b = bb(l); return Math.round(((b.minX + b.maxX) / 2) * 100) / 100 }).sort((a, b) => a - b)
    expect(xs('back')).toEqual(xs('lidback'))
    expect(xs('front')).toEqual(xs('lidfront'))
    expect(xs('back').length).toBe(4)
    const h = xs('back')
    expect(h[1] - h[0]).toBeCloseTo(25, 6)
    expect(h[3] - h[2]).toBeCloseTo(25, 6)
    expect(xs('front')[1] - xs('front')[0]).toBeCloseTo(20, 6)
    // ticks run from the meeting edge: the top of the base walls, the bottom of the lid walls
    for (const l of engOf(get(d, 'back'))) expect(bb(l).minY).toBeLessThan(2)
    for (const l of engOf(get(d, 'lidback'))) expect(get(d, 'lidback').h - bb(l).maxY).toBeLessThan(2)
    const feet = engOf(get(d, 'bottom'))
    expect(feet.length).toBe(4)
    for (const f of feet) expect(f.pts.some(q => q.b)).toBe(true)
    const off = generate(tpl, { marks: 0, feet: 0, knob: 0, lidDeco: 0, wallDeco: 0 }, S0) as never as { panels: Pn[] }
    for (const pn of off.panels) { expect(engOf(pn).length, pn.id).toBe(0); expect(holesOf(pn).length, pn.id).toBe(0) }
  })

  it('carries the band round the box when asked, the same height on every wall', () => {
    const d = generate(tpl, { around: 1 }, S0) as never as { panels: Pn[]; warnings: string[] }
    expect(d.warnings).toEqual([])
    const height = (id: string) => { const e = engOf(get(d, id)).filter(l => bb(l).maxX - bb(l).minX > 1); return Math.max(...e.map(l => bb(l).maxY)) - Math.min(...e.map(l => bb(l).minY)) }
    expect(height('side')).toBeCloseTo(height('front'), 6)
    expect(height('back')).toBeCloseTo(height('front'), 6)
    expect(engOf(get(d, 'side')).length).toBeGreaterThan(5)
  })
})

describe('the kilim box review', () => {
  /** material along the jointed strip at one end of a wall (x = t/2 or w − t/2), as [from, to] intervals */
  const strip = (pn: Pn, t: number, end: 'left' | 'right') => materialAt(outerOf(pn) as never, end === 'left' ? t / 2 : pn.w - t / 2)
  const len = (iv: [number, number][]) => iv.reduce((s, [a, b]) => s + b - a, 0)

  it('joins every corner without slivers: each finger at least the sheet thick, and the two walls and the top or bottom fill the corner exactly', () => {
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const hl of [4 * t, 14, 16, 4 * t + 2.5, 30]) for (const H of [Math.max(20, 4 * t), 50]) {
      const label = `t=${t} hl=${hl} H=${H}`
      const d = generate(tpl, { hl, H }, { ...S0, t }) as never as { panels: Pn[]; errors: string[] }
      if (hl < 4 * t - 1e-9) { expect(d.errors.length, label).toBeGreaterThan(0); continue }
      expect(d.errors, label).toEqual([])
      for (const [wall, side, h, shared] of [['lidfront', 'lidside', hl, [0, t]], ['lidback', 'lidside', hl, [0, t]], ['front', 'side', H, [H - t, H]], ['back', 'side', H, [H - t, H]]] as const) {
        for (const end of ['left', 'right'] as const) {
          const a = strip(get(d, wall), t, end), b = strip(get(d, side), t, end)
          // no finger cut down to a sliver by the top's or bottom's joint (it breaks off): the lid's low walls keep every
          // finger the sheet's thickness or more; the base, jointed the house way, keeps the house's corner neck
          const least = wall.startsWith('lid') ? t - 0.01 : Math.max(1.5, 0.3 * t) - 0.01
          for (const [y0, y1] of [...a, ...b]) expect(y1 - y0, `${label} ${wall}/${side} ${end} finger ${y0}–${y1}`).toBeGreaterThan(least)
          // the column of the corner: wall, side and the shared corner of the top or bottom fill it once, no gap, no overlap
          const all = [...a, ...b, [...shared] as [number, number]].sort((p, q) => p[0] - q[0])
          expect(len(all), `${label} ${wall} ${end}`).toBeCloseTo(h, 2)
          for (let k = 1; k < all.length; k++) expect(all[k][0], `${label} ${wall} ${end}`).toBeCloseTo(all[k - 1][1], 2)
          expect(all[0][0]).toBeCloseTo(0, 2)
        }
      }
    }
  })

  it('gives advice for a small lid that actually brings the motifs back', () => {
    const small: Record<string, number>[] = [{ W: 60, D: 50 }, { W: 100, D: 50, cell: 60 }, { cell: 120, D: 80 }, { W: 80, D: 60, cell: 50 }, { W: 60, D: 50, knob: 0, cell: 60 }]
    for (const v of small) {
      const d = generate(tpl, v, { ...S0, t: 3.2 })
      const w = d.warnings.find(x => x.includes('لا يتّسع سطح الغطاء'))
      expect(w, JSON.stringify(v)).toBeTruthy()
      const cell = /«عرض المعيّن» ([\d.]+) مم/.exec(w!), fixes: Record<string, number>[] = []
      if (cell) fixes.push({ cell: Number(cell[1]) })
      if (w!.includes('«ثقب المقبض» 0')) fixes.push({ knob: 0 })
      expect(fixes.length, w).toBeGreaterThan(0)
      for (const f of fixes) {
        const d2 = generate(tpl, { ...v, ...f }, { ...S0, t: 3.2 }) as never as { panels: Pn[]; warnings: string[]; errors: string[]; notes: string[] }
        expect(d2.errors, JSON.stringify(f)).toEqual([])
        expect(d2.warnings.filter(x => x.includes('لا يتّسع سطح الغطاء')), JSON.stringify({ ...v, ...f })).toEqual([])
        expect(d2.notes.join(' ')).toMatch(/عدد النقشات: [1-9]/)
      }
    }
  })

  it('asks for a base tall enough for the band, at every thickness, and that height brings the band back', () => {
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const marks of [0, 1]) {
      const v = { H: Math.max(20, 4 * t), hl: 24, marks }
      const d = generate(tpl, v, { ...S0, t })
      const w = d.warnings.find(x => x.includes('شريط الجدار'))!
      expect(w, `t=${t}`).toBeTruthy()
      const up = Number(/«ارتفاع القاعدة» (\d+) مم/.exec(w)![1])
      const d2 = generate(tpl, { ...v, H: up }, { ...S0, t }) as never as { panels: Pn[]; warnings: string[]; errors: string[] }
      expect(d2.errors).toEqual([])
      expect(d2.warnings.filter(x => x.includes('شريط الجدار')), `t=${t} H=${up}`).toEqual([])
      expect(engOf(get(d2, 'front')).length, `t=${t}`).toBeGreaterThan(20)
    }
  })

  it('names the screw that fits the knob hole, and warns of a hole too small for any', () => {
    const note = (knob: number) => generate(tpl, { knob }, S0).notes.find(n => n.startsWith('المقبض')) ?? ''
    expect(note(3.5)).toContain('M3')
    expect(note(4.5)).toContain('M4')
    expect(note(6.5)).toContain('M6')
    const d = generate(tpl, { knob: 2 }, S0)
    expect(d.warnings.some(w => w.includes('ثقب المقبض') && w.includes('3.5'))).toBe(true)
    expect(note(2)).toBe('')
  })
})
