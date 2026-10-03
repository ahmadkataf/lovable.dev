import { describe, it, expect } from 'vitest'
import { unionRects, rect, offsetLoop, circle, signedArea, bbox, loopLength, edgeNotch, roundCorner, loopToPath, arcInfo, Loop } from './geom'
import { buildPanel, fingerCount, edgeCuts } from './joints'
import { TEMPLATES } from './templates'
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
  it('the hinged lid is wider than the base by two thicknesses', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'hinged')!, { W: 120, gap: 0.3 }, { ...s, kerf: 0 })
    expect(d.panels.find(p => p.id === 'lid-top')!.w).toBeCloseTo(120 + 2 * s.t + 0.6)
    const lidSide = d.panels.find(p => p.id === 'lid-side')!, baseSide = d.panels.find(p => p.id === 'base-side')!
    expect(lidSide.loops.some(l => l.pts.length === 2)).toBe(true) // the pin hole
    // both ears reach the same distance behind the back face, and both pivots line up on the rim
    const e = 3 / 2 + 2.5, r = 1.25 * e
    expect(lidSide.w).toBeCloseTo(80 + e + r)
    expect(baseSide.w).toBeCloseTo(80 + e + r)
    const hole = (p: typeof lidSide) => { const [a, b] = p.loops.find(l => l.pts.length === 2)!.pts; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
    expect(hole(baseSide).y + 30).toBeCloseTo(hole(lidSide).y) // base hole e below the rim, lid hole e below the lid's bottom edge
    expect(hole(baseSide).x).toBeCloseTo(hole(lidSide).x)
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
