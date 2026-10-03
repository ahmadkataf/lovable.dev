import { describe, it, expect } from 'vitest'
import { unionRects, rect, offsetLoop, circle, signedArea, bbox, loopLength, edgeNotch, roundCorner, loopToPath, arcInfo, Loop } from './geom'
import { buildPanel, fingerCount, edgeCuts } from './joints'
import { TEMPLATES, pivotLid } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { toDXF, toSVG } from './export'

const area = (l: Loop) => Math.abs(signedArea(l))

describe('rectilinear union', () => {
  it('a plain rectangle gives one clockwise loop with 4 points', () => {
    const [l] = unionRects([rect(0, 0, 100, 50)], [])
    expect(l.pts).toHaveLength(4)
    expect(signedArea(l)).toBeGreaterThan(0) // clockwise on screen ⇒ positive shoelace with y down
    expect(area(l)).toBeCloseTo(5000)
  })
  it('a notch at a corner merges into the outline', () => {
    const [l] = unionRects([rect(0, 0, 100, 50)], [rect(0, 0, 10, 3)])
    expect(l.pts).toHaveLength(6)
    expect(area(l)).toBeCloseTo(5000 - 30)
  })
  it('an inner slot becomes a hole with opposite orientation', () => {
    const loops = unionRects([rect(0, 0, 100, 50)], [rect(40, 20, 20, 10)])
    expect(loops).toHaveLength(2)
    const outer = loops.find(l => signedArea(l) > 0)!, hole = loops.find(l => signedArea(l) < 0)!
    expect(area(outer)).toBeCloseTo(5000)
    expect(area(hole)).toBeCloseTo(200)
  })
  it('diagonally touching cells stay separate loops', () => {
    const loops = unionRects([rect(0, 0, 10, 10), rect(10, 10, 10, 10)], [])
    expect(loops).toHaveLength(2)
    for (const l of loops) expect(l.pts).toHaveLength(4)
  })
})

describe('finger joints', () => {
  it('finger count is odd and at least 3', () => {
    expect(fingerCount(100, 9) % 2).toBe(1)
    expect(fingerCount(10, 9)).toBe(3)
    expect(fingerCount(90, 9)).toBe(11)
  })
  it('male and female cuts on the same edge are complementary', () => {
    const o = { t: 3, finger: 9 }
    const male = edgeCuts('top', { type: 'male' }, 90, 50, o), female = edgeCuts('top', { type: 'female' }, 90, 50, o)
    expect(male.length + female.length).toBe(11)
    const xs = [...male, ...female].map(r => r.x).sort((a, b) => a - b)
    for (let i = 0; i < xs.length; i++) expect(xs[i]).toBeCloseTo(i * 90 / 11)
  })
  it('a male panel keeps its corners, a female panel loses them', () => {
    const o = { t: 3, finger: 9 }
    const male = buildPanel({ id: 'a', name: 'a', w: 90, h: 60, top: 'male', right: 'male', bottom: 'male', left: 'male' }, o)
    const female = buildPanel({ id: 'b', name: 'b', w: 90, h: 60, top: 'female', right: 'female', bottom: 'female', left: 'female' }, o)
    expect(male.loops).toHaveLength(1)
    expect(female.loops).toHaveLength(1)
    expect(male.loops[0].pts.some(p => p.x === 0 && p.y === 0)).toBe(true)
    expect(female.loops[0].pts.some(p => p.x === 0 && p.y === 0)).toBe(false)
    // together they lose the four joint strips, except the corner cubes which the female notches share
    expect(area(male.loops[0]) + area(female.loops[0])).toBeCloseTo(2 * 90 * 60 - (2 * 90 * 3 + 2 * 60 * 3) + 4 * 3 * 3)
  })
})

describe('arcs and offsets', () => {
  it('kerf offset grows an outer rectangle and shrinks a hole', () => {
    const [outer] = unionRects([rect(0, 0, 100, 50)], [])
    const big = offsetLoop(outer, 0.1)
    const bb = bbox([big])
    expect(bb.maxX - bb.minX).toBeCloseTo(100.2)
    expect(bb.maxY - bb.minY).toBeCloseTo(50.2)
    const hole = circle(10, 10, 5)
    expect(loopLength(hole)).toBeCloseTo(2 * Math.PI * 5)
    const small = offsetLoop(hole, 0.1)
    expect(loopLength(small)).toBeCloseTo(2 * Math.PI * 4.9)
    const sb = bbox([small])
    expect(sb.maxX - sb.minX).toBeCloseTo(9.8)
  })
  it('an edge notch is trimmed consistently by the offset', () => {
    const loops = unionRects([rect(0, 0, 100, 50)], [])
    edgeNotch(loops, 50, 0, 8)
    expect(loops[0].pts).toHaveLength(6)
    const off = offsetLoop(loops[0], 0.1)
    const bb = bbox([off])
    expect(bb.minY).toBeCloseTo(-0.1)
    // the notch arc keeps its centre and gets a radius of 7.9
    const i = off.pts.findIndex(p => p.b)
    const info = arcInfo(off.pts[i], off.pts[i + 1], off.pts[i].b!)
    expect(info.r).toBeCloseTo(7.9)
    expect(info.c.x).toBeCloseTo(50)
    expect(info.c.y).toBeCloseTo(0)
    expect(bb.maxY).toBeCloseTo(50.1)
  })
  it('a fillet rounds a convex corner and keeps the length shorter', () => {
    const loops = unionRects([rect(0, 0, 100, 50)], [])
    const before = loopLength(loops[0])
    roundCorner(loops, 0, 0, 5)
    expect(loops[0].pts).toHaveLength(5)
    expect(loopLength(loops[0])).toBeCloseTo(before - 10 + Math.PI * 5 / 2)
    expect(loopToPath(loops[0])).toContain('A5 5 0 0 1')
  })
})

describe('templates', () => {
  const s = { ...DEFAULT_SETTINGS }
  for (const tpl of TEMPLATES) {
    it(`${tpl.id} builds closed loops with no warnings at its defaults`, () => {
      const d = generate(tpl, {}, s)
      expect(d.warnings).toEqual([])
      expect(d.panels.length).toBeGreaterThan(3)
      for (const p of d.panels) {
        expect(p.w).toBeGreaterThan(0)
        const outers = p.loops.filter(l => l.closed && signedArea(l) > 0)
        expect(outers.length, `${tpl.id}/${p.id} should be one piece`).toBe(1)
        for (const l of p.loops) for (const v of l.pts) { expect(Number.isFinite(v.x)).toBe(true); expect(Number.isFinite(v.y)).toBe(true) }
      }
      expect(d.layout.w).toBeLessThanOrEqual(s.sheetW + 1)
      expect(d.cutLength).toBeGreaterThan(0)
    })
  }
  it('inner dimensions add the material thickness', () => {
    const open = TEMPLATES.find(t => t.id === 'open')!
    const outer = generate(open, { W: 100, D: 80, H: 50 }, { ...s, inner: false })
    const inner = generate(open, { W: 100, D: 80, H: 50 }, { ...s, inner: true })
    const bottomO = outer.panels.find(p => p.id === 'bottom')!, bottomI = inner.panels.find(p => p.id === 'bottom')!
    expect(bottomI.w - bottomO.w).toBeCloseTo(2 * s.t)
  })
  it('the sliding lid slot leaves the rim attached to the side', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'sliding')!, {}, s)
    const side = d.panels.find(p => p.id === 'side')!
    expect(side.loops.filter(l => signedArea(l) > 0)).toHaveLength(1)
  })
  it('the pivot lid has six pieces, tabs inside the ear holes, and clears everything through 110° of opening', () => {
    const tpl = TEMPLATES.find(t => t.id === 'hinged')!
    const t = 3, W = 120, D = 80, H = 50
    const p = { ...tpl.defaults, W, D, H }
    const d = generate(tpl, p, { ...s, t, kerf: 0 })
    expect(d.pieceCount).toBe(6)
    const g = pivotLid(p, t)
    expect(g.tab).toBe(t)
    expect(2 * g.holeR).toBeCloseTo(Math.hypot(3, 3) + 0.4)
    // the hole keeps clear of the ear top, the ear's rounded front and the back joint strip
    expect(g.a - t / 2 - g.holeR).toBeGreaterThanOrEqual(2.5 - 1e-9)
    expect(Math.hypot(g.pivotX - (g.earX + g.a), (g.a - t / 2) - g.a) + g.holeR).toBeLessThan(g.a - 1.5)
    expect(g.pivotX + g.holeR).toBeLessThanOrEqual(D - t - 2 + 1e-9)
    // the lid: full width, two tabs reaching the outer faces, notches between
    const lid = d.panels.find(x => x.id === 'lid')!
    expect(lid.w).toBeCloseTo(W)
    expect(lid.h).toBeCloseTo(g.lidD)
    const outer = lid.loops.find(l => signedArea(l) > 0)!
    const xsAtTab = outer.pts.filter(v => Math.abs(v.y - g.tabY0) < 2e-3 || Math.abs(v.y - g.tabY1) < 2e-3).map(v => v.x)
    expect(xsAtTab).toContain(0)
    expect(xsAtTab).toContain(W)
    expect(xsAtTab.some(x => Math.abs(x - (t + g.gap)) < 2e-3)).toBe(true)
    // side panel: hole centre t/2 above the rim, ear rises a above it
    const side = d.panels.find(x => x.id === 'side')!
    expect(side.h).toBeCloseTo(H + g.a)
    const hole = side.loops.find(l => l.pts.length === 2)!
    expect((hole.pts[0].y + hole.pts[1].y) / 2).toBeCloseTo(g.a - t / 2)

    // --- sweep: side view, y down, pivot at (pivotX, a - t/2); opening lifts the front (depth 0)
    const axis = { x: g.pivotX, y: g.a - t / 2 }
    const rot = (pt: { x: number; y: number }, th: number) => {
      const u = pt.x - axis.x, v = pt.y - axis.y
      return { x: axis.x + u * Math.cos(th) - v * Math.sin(th), y: axis.y + u * Math.sin(th) + v * Math.cos(th) }
    }
    const rectPoly = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
    // the ear with its quarter-round front, sampled slightly oversize to stay conservative
    const ear: { x: number; y: number }[] = [{ x: g.earX, y: g.a }]
    for (let k = 0; k <= 24; k++) { const ang = Math.PI + (Math.PI / 2) * k / 24; ear.push({ x: g.earX + g.a + (g.a + 0.05) * Math.cos(ang), y: g.a + (g.a + 0.05) * Math.sin(ang) }) }
    ear.push({ x: D, y: 0 }, { x: D, y: g.a })
    const sideBody = rectPoly(0, g.a, D, H + g.a)
    const backWall = rectPoly(D - t, g.a - t, D, H + g.a)
    const frontWall = rectPoly(0, g.a, t, H + g.a)
    const lidWide = rectPoly(0, g.a - t, g.earX - g.gap, g.a)         // exists in the ear planes
    const lidNarrow = rectPoly(g.earX - g.gap, g.a - t, g.lidD, g.a)  // exists between the ears only
    const overlapDepth = (A: { x: number; y: number }[], B: { x: number; y: number }[]) => {
      let best = Infinity
      for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
        const p0 = P[i], p1 = P[(i + 1) % P.length], nx = p1.y - p0.y, ny = -(p1.x - p0.x), len = Math.hypot(nx, ny)
        if (len < 1e-12) continue
        const proj = (Q: { x: number; y: number }[]) => Q.map(q => (q.x * nx + q.y * ny) / len)
        const a = proj(A), b = proj(B)
        const ov = Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b))
        best = Math.min(best, ov)
      }
      return best // ≤ 0 means separated by at least -best
    }
    let minClear = Infinity
    for (let deg = 1; deg <= 110; deg += 0.5) {
      const th = deg * Math.PI / 180
      const wide = lidWide.map(q => rot(q, th)), narrow = lidNarrow.map(q => rot(q, th))
      for (const [piece, obstacle, name] of [[wide, ear, 'ear'], [wide, sideBody, 'side'], [narrow, backWall, 'back'], [narrow, frontWall, 'front'], [wide, frontWall, 'front']] as const) {
        const ov = overlapDepth(piece, obstacle)
        expect(ov, `lid hits the ${name} at ${deg}°`).toBeLessThanOrEqual(1e-6)
        if (deg >= 5) minClear = Math.min(minClear, -ov)
      }
    }
    expect(minClear).toBeGreaterThan(0.3) // at least 0.3 mm of air everywhere past 5°
  })
  it('the flex hinge has score lines in the hinge zone only', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'flex')!, { D: 80, R: 15 }, { ...s, kerf: 0 })
    const piece = d.panels.find(p => p.id === 'lidback')!
    const lines = piece.loops.filter(l => !l.closed)
    expect(lines.length).toBeGreaterThan(20)
    for (const l of lines) { expect(l.pts[0].y).toBeGreaterThan(80 - 15); expect(l.pts[0].y).toBeLessThan(80 - 15 + 25) }
  })
})

describe('export', () => {
  it('writes SVG in millimetres and a DXF with circles, lines and polylines', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'hinged')!, {}, DEFAULT_SETTINGS)
    const svg = toSVG(d.layout, { labels: true })
    expect(svg).toMatch(/width="[\d.]+mm"/)
    expect(svg).toContain('<path d="M')
    const dxf = toDXF(d.layout)
    expect(dxf).toContain('AC1009')
    expect(dxf).toContain('CIRCLE')
    expect(dxf).toContain('POLYLINE')
    expect(dxf.trim().endsWith('EOF')).toBe(true)
    const flex = generate(TEMPLATES.find(t => t.id === 'flex')!, {}, DEFAULT_SETTINGS)
    expect(toDXF(flex.layout)).toContain('\nLINE\n')
  })
})

describe('zip', () => {
  it('writes a stored archive with the right signatures and CRC', async () => {
    const { makeZip, crc32 } = await import('./zip')
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const z = makeZip([{ name: 'a.dxf', data: 'hello' }])
    const dv = new DataView(z.buffer)
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
    expect(dv.getUint32(z.length - 22, true)).toBe(0x06054b50)
    expect(z.length).toBe(30 + 5 + 5 + 46 + 5 + 22)
  })
})
