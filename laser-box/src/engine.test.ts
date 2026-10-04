import { describe, it, expect } from 'vitest'
import { unionRects, rect, offsetLoop, circle, signedArea, bbox, loopLength, edgeNotch, roundCorner, loopToPath, arcInfo, hingeLines, heart, Loop } from './geom'
import { buildPanel, fingerCount, edgeCuts } from './joints'
import { TEMPLATES, pivotLid, CATEGORIES } from './templates'
import { generate, DEFAULT_SETTINGS, autoFinger } from './generate'
import { toDXF, toSVG, toAI } from './export'
import { samplePoly, materialAt, pointIn, polysOverlap, polyDistance, segsCross, P } from './testutil'

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
      expect(d.errors).toEqual([])
      expect(d.pieceCount).toBeGreaterThanOrEqual(1) // a clock face or a cross-lapped tree is one or two pieces
      for (const p of d.panels) {
        expect(p.w).toBeGreaterThan(0)
        const outers = p.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l) > 0)
        expect(outers.length, `${tpl.id}/${p.id} should be one piece`).toBe(1)
        for (const l of p.loops) for (const v of l.pts) { expect(Number.isFinite(v.x)).toBe(true); expect(Number.isFinite(v.y)).toBe(true) }
      }
      expect(d.layout.w).toBeLessThanOrEqual(Math.max(s.sheetW, ...d.panels.map(p => p.w)) + 1) // a door panel is wider than the default sheet
      expect(d.cutLength).toBeGreaterThan(0)
    })
  }
  it('a box too small for its hinge is refused with the minimum sizes, and tiny boxes get small fingers', () => {
    const hinged = TEMPLATES.find(t => t.id === 'hinged')!
    const d = generate(hinged, { W: 30, D: 23, H: 10 }, { ...s, t: 2.5, kerf: 0.1 })
    expect(d.errors.length).toBeGreaterThanOrEqual(2)
    expect(d.errors.join(' ')).toMatch(/أقلّ عمق \d+ مم/)
    expect(d.errors.join(' ')).toMatch(/أقلّ ارتفاع \d+ مم/)
    expect(d.finger).toBeCloseTo(5) // 2 × 2.5, since 10 / 5 would be thinner than two thicknesses
    const big = generate(hinged, { W: 300, D: 200, H: 120 }, { ...s, t: 3 })
    expect(big.errors).toEqual([])
    expect(big.finger).toBeCloseTo(9)
    const mid = generate(TEMPLATES.find(t => t.id === 'open')!, { W: 60, D: 40, H: 35 }, { ...s, t: 3 })
    expect(mid.finger).toBeCloseTo(7) // 35 / 5
    expect(autoFinger(3, [10, 10, 10])).toBeCloseTo(6)
    // the finger notch shrinks to fit a low front wall instead of cutting through it
    const low = generate(hinged, { W: 60, D: 40, H: 18, pull: 8 }, { ...s, t: 2.5, kerf: 0 })
    const front = low.panels.find(p => p.id === 'front')!
    const arc = front.loops[0].pts.find(v => v.b)!
    expect(arc).toBeDefined()
    const info = arcInfo(arc, front.loops[0].pts[front.loops[0].pts.indexOf(arc) + 1], arc.b!)
    expect(info.r).toBeLessThanOrEqual((18 - 2.5) / 2.5 + 1e-9)
    // a sliding-lid box lower than four thicknesses is refused, not silently mangled
    expect(generate(TEMPLATES.find(t => t.id === 'sliding')!, { W: 60, D: 40, H: 12 }, { ...s, t: 3 }).errors.join(' ')).toMatch(/الارتفاع صغير/)
  })

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
  it('the pivot lid has six pieces, tabs inside the ear holes, and the GENERATED outlines clear each other through 110° of opening', () => {
    const tpl = TEMPLATES.find(t => t.id === 'hinged')!
    for (const [t, W, D, H] of [[3, 120, 80, 50], [2.7, 60, 40, 25], [6, 300, 200, 120]] as const) {
      const p = { ...tpl.defaults, W, D, H }
      const d = generate(tpl, p, { ...s, t, kerf: 0 })
      expect(d.errors, `${t}mm ${W}×${D}×${H}`).toEqual([])
      expect(d.pieceCount).toBe(6)
      const g = pivotLid(p, t)
      expect(g.tab).toBe(t)
      expect(2 * g.holeR).toBeCloseTo(Math.hypot(t, t) + 0.4)
      // the tab's corners stay inside the hole while it turns
      expect(Math.hypot(g.tab, t) / 2).toBeLessThan(g.holeR)
      // webs around the hole: to the ear top, to the ear's rounded front, to the back joint strip
      expect(g.a - t / 2 - g.holeR).toBeGreaterThanOrEqual(g.webTop - 1e-3)
      expect(Math.hypot(g.pivotX - (g.earX + g.a), (g.a - t / 2) - g.a) + g.holeR).toBeLessThan(g.a - 1.5)
      expect(g.pivotX + g.holeR).toBeLessThanOrEqual(D - t - g.webBack + 1e-3)

      const side = d.panels.find(x => x.id === 'side')!, lid = d.panels.find(x => x.id === 'lid')!
      const sideOuter = side.loops.find(l => l.closed && signedArea(l) > 0)!
      const lidOuter = lid.loops.find(l => l.closed && signedArea(l) > 0)!
      // the ear fillet really is in the outline: an arc of radius a that ends on the rim at the ear's foot
      const fillets = sideOuter.pts.map((v, i) => (v.b ? arcInfo(v, sideOuter.pts[(i + 1) % sideOuter.pts.length], v.b) : null)).filter(Boolean) as ReturnType<typeof arcInfo>[]
      expect(fillets.some(f => Math.abs(f.r - g.a) < 1e-3 && Math.abs(f.c.x - (g.earX + g.a)) < 2e-3 && Math.abs(f.c.y - g.a) < 2e-3), 'ear fillet missing').toBe(true)
      expect(side.h).toBeCloseTo(H + g.a)
      const hole = side.loops.find(l => l.pts.length === 2)!
      expect((hole.pts[0].y + hole.pts[1].y) / 2).toBeCloseTo(g.a - t / 2)
      expect(lid.w).toBeCloseTo(W)
      expect(lid.h).toBeCloseTo(g.lidD)
      for (const l of [sideOuter, lidOuter]) for (let i = 0; i < l.pts.length; i++) { const q = l.pts[(i + 1) % l.pts.length]; expect(Math.hypot(q.x - l.pts[i].x, q.y - l.pts[i].y), 'zero-length segment').toBeGreaterThan(1e-6) }

      // --- sweep on the generated geometry. Side view, y down, pivot at (pivotX, a - t/2); opening lifts the front.
      const S = samplePoly(sideOuter)
      const earPlane = materialAt(lidOuter, 1e-3).filter(([y0, y1]) => !(y0 < g.pivotX && g.pivotX < y1)) // the tab lives in the hole, test it separately
      expect(earPlane.length).toBe(1)
      expect(earPlane[0][1]).toBeCloseTo(g.earX - g.gap, 2)
      const centre = materialAt(lidOuter, W / 2)
      expect(centre).toEqual([[0, g.lidD]])
      const tabIv = materialAt(lidOuter, 1e-3).find(([y0, y1]) => y0 < g.pivotX && g.pivotX < y1)!
      expect(tabIv[0]).toBeCloseTo(g.tabY0, 2); expect(tabIv[1]).toBeCloseTo(g.tabY1, 2)
      const axis = { x: g.pivotX, y: g.a - t / 2 }
      const rot = (pt: { x: number; y: number }, th: number) => { const u = pt.x - axis.x, v = pt.y - axis.y; return { x: axis.x + u * Math.cos(th) - v * Math.sin(th), y: axis.y + u * Math.sin(th) + v * Math.cos(th) } }
      const rectPoly = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
      const lidWide = rectPoly(earPlane[0][0], g.a - t, earPlane[0][1], g.a)
      const lidCentre = rectPoly(centre[0][0], g.a - t, centre[0][1], g.a)
      const backWall = rectPoly(D - t, g.a - t, D, H + g.a), frontWall = rectPoly(0, g.a, t, H + g.a)
      let minClear = Infinity
      for (let deg = 1; deg <= 110; deg += 0.5) {
        const th = deg * Math.PI / 180
        const wide = lidWide.map(q => rot(q, th)), mid = lidCentre.map(q => rot(q, th))
        for (const [piece, obstacle, name] of [[wide, S, 'side/ear'], [mid, backWall, 'back wall'], [mid, frontWall, 'front wall']] as const) {
          expect(polysOverlap(piece, obstacle), `lid hits the ${name} at ${deg}° (t=${t})`).toBe(false)
          if (deg >= 5) minClear = Math.min(minClear, polyDistance(piece, obstacle))
        }
      }
      expect(minClear, `clearance t=${t}`).toBeGreaterThan(0.3)
    }
  })

  it('the stay-open hinged lid swings freely up to its stop angle, touches the posts there, and cannot go further', () => {
    const tpl = TEMPLATES.find(t => t.id === 'hinged90')!
    for (const [t, W, D, H] of [[3, 120, 80, 50], [2.7, 80, 60, 35], [6, 300, 200, 120]] as const) for (const stop of [90, 93, 95]) {
      const p = { ...tpl.defaults, W, D, H, stop }
      const d = generate(tpl, p, { ...s, t, kerf: 0 })
      expect(d.errors, `${t}mm ${stop}°`).toEqual([])
      expect(d.pieceCount).toBe(6)
      const g = pivotLid(p, t)
      const side = d.panels.find(x => x.id === 'side')!, lid = d.panels.find(x => x.id === 'lid')!
      const o = side.h - H - g.a // how far the side was moved down to make room for the post
      expect(o).toBeGreaterThan(t)
      const S = samplePoly(side.loops.find(l => l.closed && signedArea(l) > 0)!)
      const lidOuter = lid.loops.find(l => l.closed && signedArea(l) > 0)!
      const ear = materialAt(lidOuter, 1e-3).filter(([y0, y1]) => !(y0 < g.pivotX && g.pivotX < y1))[0]
      const axis = { x: g.pivotX, y: g.a - t / 2 + o }
      const rot = (pt: { x: number; y: number }, th: number) => { const u = pt.x - axis.x, v = pt.y - axis.y; return { x: axis.x + u * Math.cos(th) - v * Math.sin(th), y: axis.y + u * Math.sin(th) + v * Math.cos(th) } }
      const wide = [{ x: ear[0], y: g.a - t + o }, { x: ear[1], y: g.a - t + o }, { x: ear[1], y: g.a + o }, { x: ear[0], y: g.a + o }]
      const at = (deg: number) => wide.map(q => rot(q, deg * Math.PI / 180))
      for (let deg = 1; deg <= stop - 0.5; deg += 0.5) expect(polysOverlap(at(deg), S), `lid hits the side at ${deg}° (t=${t}, stop ${stop})`).toBe(false)
      expect(polyDistance(at(stop), S), `touches the post at ${stop}°`).toBeLessThan(0.05)
      expect(polysOverlap(at(stop + 1.5), S), `the post stops it past ${stop}°`).toBe(true)
    }
  })

  it('the flex hinge has score lines in the hinge zone only', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'flex')!, { D: 80, R: 15 }, { ...s, kerf: 0 })
    const piece = d.panels.find(p => p.id === 'lidback')!
    const lines = piece.loops.filter(l => !l.closed)
    expect(lines.length).toBeGreaterThan(20)
    for (const l of lines) { expect(l.pts[0].y).toBeGreaterThan(80 - 15); expect(l.pts[0].y).toBeLessThan(80 - 15 + 25) }
  })
})

describe('review fixes', () => {
  it('fingers: the count is the nearest odd one, and a corner finger on a sliver is refused', async () => {
    const { fingerCount } = await import('./joints')
    expect(fingerCount(60, 6)).toBe(11) // 60/6 = 10 → 11 (5.45) is nearer than 9 (6.67)
    expect(fingerCount(50, 6)).toBe(9)
    const bad = generate(TEMPLATES.find(t => t.id === 'open')!, { W: 60, D: 50, H: 30 }, { ...DEFAULT_SETTINGS, t: 6, finger: 6 })
    expect(bad.errors.join(' ')).toMatch(/أصبع الزاوية|أرقّ من السماكة/)
    for (const b of bad.panels) expect(b.loops.filter(l => l.closed && signedArea(l) > 0).length).toBeGreaterThanOrEqual(1)
  })
  it('the ear keeps at least 4 mm (1.5 t) of material around the pivot hole, and more on request', () => {
    const tpl = TEMPLATES.find(t => t.id === 'hinged')!
    const g = pivotLid({ ...tpl.defaults }, 3)
    expect(g.webTop).toBeCloseTo(4.5)
    expect(g.webBack).toBeCloseTo(4.5)
    expect(pivotLid({ ...tpl.defaults, web: 6 }, 3).webTop).toBe(6)
    expect(pivotLid({ ...tpl.defaults }, 2).webTop).toBe(4)
  })
  it('living hinges cut every other row out through the edges, so no solid spine remains', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'flex')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    const lb = d.panels.find(p => p.id === 'lidback')!
    const lines = lb.loops.filter(l => !l.closed)
    expect(lines.some(l => Math.min(l.pts[0].x, l.pts[1].x) < 0)).toBe(true)
    expect(lines.some(l => Math.max(l.pts[0].x, l.pts[1].x) > 100)).toBe(true) // W = 100
    // the finger pull moved to the front wall, under the lid's edge
    expect(d.panels.find(p => p.id === 'front')!.loops[0].pts.some(v => v.b)).toBe(true)
    const shade = generate(TEMPLATES.find(t => t.id === 'shade')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    const sheet = shade.panels.find(p => p.id === 'sheet')!
    const cols = sheet.loops.filter(l => !l.closed)
    const xs = cols.map(l => l.pts[0].x)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(4) // a solid margin at each end for the glued seam
    expect(cols.some(l => Math.min(l.pts[0].y, l.pts[1].y) < 3 + 1e-6)).toBe(true)
  })
  it('handles and slots never grow wider than the panel they are cut in', () => {
    const tray = generate(TEMPLATES.find(t => t.id === 'tray')!, { W: 100, D: 50, H: 80, hl: 20, hh: 50 }, { ...DEFAULT_SETTINGS, kerf: 0 })
    if (!tray.errors.length) {
      const side = tray.panels.find(p => p.id === 'side')!
      const hole = side.loops.find(l => signedArea(l) < 0)!
      const bb = bbox([hole])
      expect(bb.minX).toBeGreaterThan(3)
      expect(bb.maxX).toBeLessThan(47)
    }
    const tissue = generate(TEMPLATES.find(t => t.id === 'tissue')!, { W: 60, D: 125, H: 90, slotL: 20, slotW: 80 }, { ...DEFAULT_SETTINGS, kerf: 0 })
    const top = tissue.panels.find(p => p.id === 'bottom')!
    const bb = bbox([top.loops.find(l => signedArea(l) < 0)!])
    expect(bb.maxX - bb.minX).toBeCloseTo(20)
    expect(bb.maxY - bb.minY).toBeCloseTo(80)
  })
  it('inner dimensions mean the usable space for the drawer and sliding boxes', () => {
    const t = 3
    const dr = generate(TEMPLATES.find(x => x.id === 'drawer')!, { W: 120, D: 100, H: 50, gap: 0.6 }, { ...DEFAULT_SETTINGS, t, kerf: 0, inner: true })
    const front = dr.panels.find(p => p.id === 'drawer-front')!, side = dr.panels.find(p => p.id === 'drawer-side')!
    expect(front.w - 2 * t).toBeCloseTo(120)
    expect(side.w - 2 * t).toBeCloseTo(100)
    expect(front.h - t).toBeCloseTo(50)
    const sl = generate(TEMPLATES.find(x => x.id === 'sliding')!, { W: 120, D: 80, H: 50, slide: 0.3 }, { ...DEFAULT_SETTINGS, t, kerf: 0, inner: true })
    expect(sl.panels.find(p => p.id === 'side')!.h - (5 + 2 * t) - 0.3).toBeCloseTo(50) // a 5 mm strip over the slot, the lid, the floor
  })
  it('the sliding lid: the slot takes the lid with clearance, the lid clears the front wall, and every joint mates', () => {
    for (const t of [2, 3, 4, 6]) for (const [W, D, H] of [[120, 80, 50], [200, 150, 80], [60, 50, 30]]) {
      const d = generate(TEMPLATES.find(x => x.id === 'sliding')!, { W, D, H }, { ...DEFAULT_SETTINGS, t, kerf: 0 })
      if (d.errors.length) continue
      const rim = Math.max(t, 5), slide = 0.3
      const side = d.panels.find(p => p.id === 'side')!, front = d.panels.find(p => p.id === 'front')!, lid = d.panels.find(p => p.id === 'lid')!, back = d.panels.find(p => p.id === 'back')!
      const o = side.loops[0].pts
      // the slot: open at the front edge, rim above it, t + slide tall, running back to the back wall's inner face
      expect(o.some(v => Math.abs(v.x) < 1e-6 && Math.abs(v.y - rim) < 1e-6), `${t} ${W}x${D}x${H} slot top`).toBe(true)
      // (the slot's floor runs into the front joint's top notch when the edge starts with one, so it may end at x = t)
      expect(o.some(v => (Math.abs(v.x) < 1e-6 || Math.abs(v.x - t) < 1e-6) && Math.abs(v.y - (rim + t + slide)) < 1e-6), `${t} slot bottom`).toBe(true)
      expect(o.some(v => Math.abs(v.x - (D - t)) < 1e-6 && Math.abs(v.y - rim) < 1e-6), `${t} slot end`).toBe(true)
      // the lid fills the slot's length and the box's width; the front wall's top is level with the slot's floor
      expect(lid.h).toBeCloseTo(D - t); expect(lid.w).toBeCloseTo(W)
      expect(front.h).toBeCloseTo(H - (rim + t + slide))
      // the back wall rises to the top, its top corners cut as tall as the side's solid block above the back joint
      expect(back.h).toBeCloseTo(H)
      const jointFrom = rim + t + slide + Math.max(1, t / 2)
      expect(back.loops[0].pts.some(v => Math.abs(v.x - t) < 1e-6 && Math.abs(v.y - jointFrom) < 1e-6), `${t} back corner`).toBe(true)
      // the rim hangs from one piece of material, and no realized finger is thinner than the stock allows
      expect(side.loops.filter(l => signedArea(l) > 0)).toHaveLength(1)
    }
  })
  it('the picture frame stacks into one outline, holds the photo in an open-topped slot, and its stand plugs into the back', () => {
    const d = generate(TEMPLATES.find(x => x.id === 'frame')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    expect(d.errors).toEqual([])
    const ids = d.panels.map(p => p.id)
    expect(ids).toEqual(expect.arrayContaining(['front', 'front-top', 'spacer', 'back', 'stand']))
    const front = d.panels.find(p => p.id === 'front')!, spacer = d.panels.find(p => p.id === 'spacer')!, back = d.panels.find(p => p.id === 'back')!
    expect(spacer.w).toBeCloseTo(front.w); expect(back.h).toBeCloseTo(front.h)
    // spacer: a U, one piece, open at the top across the photo width
    const su = spacer.loops.filter(l => signedArea(l) > 0)
    expect(su).toHaveLength(1)
    expect(su[0].pts.filter(v => Math.abs(v.y) < 1e-6).length).toBeGreaterThanOrEqual(4)
    // the stand's tabs are as long as the back is thick, and the back has two slots for them
    const stand = d.panels.find(p => p.id === 'stand')!
    expect(stand.loops).toHaveLength(1)
    expect(bbox(stand.loops).minX).toBeCloseTo(0)
    expect(back.loops.filter(l => signedArea(l) < 0).length).toBe(3) // keyhole + two slots
    expect(d.panels.find(p => p.id === 'front-top')!.loops.some(l => l.layer === 'engrave')).toBe(true)
  })
})

describe('house, fence and lattice designs', () => {
  it('the tea house gables are pentagons whose roof plates and locating triangles fit the slope', () => {
    const t = 3
    const d = generate(TEMPLATES.find(x => x.id === 'teahouse')!, {}, { ...DEFAULT_SETTINGS, t, kerf: 0 })
    expect(d.errors).toEqual([])
    const front = d.panels.find(p => p.id === 'front')!
    const outer = front.loops.find(l => signedArea(l) > 0)!
    const apex = outer.pts.find(v => Math.abs(v.y) < 1e-6)!
    expect(apex.x).toBeCloseTo(45) // W/2
    expect(outer.pts.filter(v => Math.abs(v.y) < 1e-6)).toHaveLength(1)
    const key = d.panels.find(p => p.id === 'roof-key')!
    // the locating triangle has the gable's slope: its height over half its base equals g / (W/2)
    expect(key.h / (key.w / 2)).toBeCloseTo(45 / 45, 3)
    expect(key.w).toBeCloseTo(90 - 2 * t - 1)
    const ra = d.panels.find(p => p.id === 'roof-a')!, rb = d.panels.find(p => p.id === 'roof-b')!
    expect(ra.w - rb.w).toBeCloseTo(t)
    expect(rb.w).toBeCloseTo(Math.hypot(45, 45) + 8)
  })
  it('fence pickets come to a point and the side walls leave the corner to the front posts', () => {
    const d = generate(TEMPLATES.find(x => x.id === 'fence')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    expect(d.errors).toEqual([])
    const fb = d.panels.find(p => p.id === 'frontback')!, side = d.panels.find(p => p.id === 'side')!
    const tips = (pn: typeof fb) => pn.loops[0].pts.filter(v => Math.abs(v.y) < 1e-6)
    expect(tips(fb).length).toBeGreaterThanOrEqual(8)
    expect(Math.min(...tips(fb).map(v => v.x))).toBeLessThan(10) // a post right at the corner
    expect(Math.min(...tips(side).map(v => v.x))).toBeGreaterThan(3) // the side starts after the corner
  })
  it('the diamond lattice keeps bars of at least 2.5 mm between its holes', () => {
    const d = generate(TEMPLATES.find(x => x.id === 'decobox')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    const front = d.panels.find(p => p.id === 'front')!
    const holes = front.loops.filter(l => signedArea(l) < 0).map(l => samplePoly(l))
    expect(holes.length).toBeGreaterThan(10)
    let min = Infinity
    for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) min = Math.min(min, polyDistance(holes[i], holes[j]))
    expect(min).toBeGreaterThanOrEqual(2.5 - 1e-6)
  })
})

describe('second review fixes', () => {
  const T = (id: string) => TEMPLATES.find(x => x.id === id)!
  const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
  const outerOf = (pn: { loops: Loop[] }) => pn.loops.find(l => l.closed && l.layer !== 'engrave' && signedArea(l) > 0)!
  const holesOf = (pn: { loops: Loop[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l) < 0)
  // x positions of hinge columns that run out through both edges (lo and hi are the edges' coordinates)
  const throughCols = (lines: Loop[], lo: number, hi: number) => {
    const a = new Set(lines.filter(l => Math.min(l.pts[0].y, l.pts[1].y) < lo).map(l => Math.round(l.pts[0].x * 1000)))
    return [...new Set(lines.filter(l => Math.max(l.pts[0].y, l.pts[1].y) > hi).map(l => Math.round(l.pts[0].x * 1000)))].filter(x => a.has(x)).map(x => x / 1000)
  }

  it('through rows of a living hinge reach both edges whatever the length, and always keep a bridge', () => {
    for (let along = 30; along <= 160; along += 0.7) {
      const lines = hingeLines(0, 0, 30, along, 18, 3, 1.5, 'y', { through: true })
      const cols = [...new Set(lines.map(l => Math.round(l.pts[0].x * 1000)))].sort((a, b) => a - b)
      const thru = throughCols(lines, 0, along)
      expect(thru.length, `along ${along}`).toBe(Math.floor(cols.length / 2))
      for (const x of thru) expect(lines.filter(l => Math.abs(l.pts[0].x - x) < 1e-6).length, `along ${along}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('the round box sheet is cut through its edges between every pair of tabs, at every height, or refused', () => {
    for (let H = 30; H <= 200; H += 1) {
      const d = generate(T('roundbox'), { H }, S0)
      if (d.errors.length) continue
      const sheet = d.panels.find(p => p.id === 'sheet')!
      const L = sheet.w, n = 8, t = S0.t
      const thru = throughCols(sheet.loops.filter(l => !l.closed), t, H + t)
      const xs = Array.from({ length: n }, (_, k) => L * (k + 0.5) / n)
      for (let k = 0; k + 1 < n; k++) expect(thru.filter(x => x > xs[k] && x < xs[k + 1]).length, `H ${H} gap ${k}`).toBeGreaterThanOrEqual(2)
    }
    const crowded = generate(T('roundbox'), { tabs: 16, tabW: 8, bridge: 7 }, S0)
    expect(crowded.errors.join(' ')).toMatch(/شريط مصمت/)
  })

  it('the tea house roof plates meet at the ridge without a gap or an overlap, at any slope', () => {
    for (const [W, g, t] of [[90, 15, 3], [90, 30, 3], [90, 45, 3], [90, 70, 3], [90, 120, 3], [90, 150, 3], [200, 20, 3], [120, 40, 6], [120, 100, 6]]) {
      const d = generate(T('teahouse'), { W, D: 100, g }, { ...S0, t })
      expect(d.errors, `${W} ${g} ${t}`).toEqual([])
      const steep = Math.atan2(g, W / 2) > Math.PI / 4 + 1e-9
      const La = d.panels.find(p => p.id === 'roof-a')!.w, Lb = d.panels.find(p => p.id === 'roof-b')!.w
      // cross-section, apex at the origin, y up; each plate's underside lies on its gable slope, eaves overhanging ov
      const th = Math.atan2(g, W / 2), Ls = Math.hypot(W / 2, g), ov = 8
      const plate = (sx: number, len: number) => {
        const u = { x: sx * Math.cos(th), y: -Math.sin(th) }, n = { x: sx * Math.sin(th), y: Math.cos(th) } // u down the slope, n out of the roof
        const end = Ls + ov - len // the upper end, measured down the slope from the apex (negative = past it)
        const at = (s: number, v: number) => ({ x: s * u.x + v * n.x, y: s * u.y + v * n.y })
        const local = (q: P) => ({ s: q.x * u.x + q.y * u.y, v: q.x * n.x + q.y * n.y })
        return { end, at, local, corners: [at(end, 0), at(end, t), at(Ls + ov, t), at(Ls + ov, 0)], inside: (q: P) => { const l = local(q); return Math.min(l.s - end, Ls + ov - l.s, l.v, t - l.v) > 1e-3 } }
      }
      const A = plate(-1, La), B = plate(1, Lb)
      for (const q of B.corners) expect(A.inside(q), `${W} ${g}: short plate inside the long one`).toBe(false)
      for (const q of A.corners) expect(B.inside(q), `${W} ${g}: long plate inside the short one`).toBe(false)
      // the long plate's end comes down onto the short plate's top face: up to 45° the ridge is closed from outside;
      // steeper, the short plate stops at the apex and the open V-groove is reported
      const q = B.local(A.at(A.end, 0))
      expect(q.v, `${W} ${g}: ridge seam`).toBeCloseTo(t, 2)
      if (!steep) expect(q.s).toBeGreaterThanOrEqual(B.end - 0.01)
      else {
        expect(Math.abs(B.end)).toBeLessThan(0.01)
        const groove = B.end - q.s
        if (groove >= 0.6) expect(Math.abs(Number(d.warnings.join(" ").match(/عرضه نحو ([\d.]+)/)![1]) - groove)).toBeLessThan(0.1)
      }
      // and the short plate is pushed right up against the long one's underside
      expect(Math.min(...[B.at(B.end, 0), B.at(B.end, t)].map(c => Math.abs(A.local(c).v))), `${W} ${g}: short plate reaches`).toBeLessThan(0.01)
    }
  })

  it('the tea house slot lets a whole bag out, and the roof carries no marks on its visible face', () => {
    const d = generate(T('teahouse'), {}, S0)
    const slot = holesOf(d.panels.find(p => p.id === 'front')!).map(l => bbox([l])).sort((a, b) => (b.maxX - b.minX) - (a.maxX - a.minX))[0]
    expect(slot.maxX - slot.minX).toBeGreaterThanOrEqual(72 + 2)
    expect(d.panels.find(p => p.id === 'roof-a')!.loops.filter(l => l.layer === 'engrave').every(l => !l.closed)).toBe(true)
    expect(generate(T('teahouse'), { W: 80 }, S0).errors.join(' ')).toMatch(/أضيق من الكيس/)
  })

  it('the frame stand holds the tilt: refused when the frame would stand upright or tip back', () => {
    expect(generate(T('frame'), {}, S0).errors).toEqual([])
    expect(generate(T('frame'), { tilt: 5 }, S0).errors.join(' ')).toMatch(/على الأقل/)
    const a4 = { pw: 210, ph: 297 }
    expect(generate(T('frame'), { ...a4, tilt: 20 }, S0).errors).toEqual([])
    expect(generate(T('frame'), { ...a4, tilt: 30 }, S0).errors.join(' ')).toMatch(/أو أقل/)
  })

  it('large frame corners shrink to keep 3 mm round every window, and every layer has the same outline', () => {
    const d = generate(T('frame'), { border: 14, step: 5, ocr: 30, wr: 0 }, S0)
    expect(d.errors).toEqual([])
    expect(d.warnings.join(' ')).toMatch(/صُغّرت/)
    const front = d.panels.find(p => p.id === 'front')!
    for (const pn of d.panels.filter(p => p.id !== 'stand')) {
      const o = samplePoly(outerOf(pn))
      for (const h of holesOf(pn)) expect(polyDistance(samplePoly(h), o), pn.id).toBeGreaterThan(3 - 0.05)
      // nothing of any layer sticks out past the front's rounded corners
      const fo = samplePoly(outerOf(front))
      for (const q of o) expect(pointIn(q, fo) || polyDistance([q], fo) < 1e-3, `${pn.id} ${q.x},${q.y}`).toBe(true)
    }
  })

  it('an arch window is arched, or squared, in every layer together, so the outer layer never covers the photo window', () => {
    const flat = generate(T('frame'), { pw: 180, ph: 98, shape: 2 }, S0)
    expect(flat.warnings.join(' ')).toMatch(/مستطيلة/)
    for (const d of [flat, generate(T('frame'), { pw: 120, ph: 160, shape: 2 }, S0)]) {
      const win = (id: string) => holesOf(d.panels.find(p => p.id === id)!)[0]
      const inner = samplePoly(win('front')), outer = samplePoly(win('front-top'))
      for (const q of inner) expect(pointIn(q, outer)).toBe(true)
      expect(polyDistance(inner, outer)).toBeGreaterThan(5 - 0.05) // step 5 all round
    }
  })

  it('the basket handle has a hole a hand fits through, with wood all round it', () => {
    for (const W of [80, 120, 180, 300]) for (const handleH of [40, 60, 100, 160]) {
      const d = generate(T('basket'), { W, handleH }, S0)
      if (d.errors.length) continue
      const hd = d.panels.find(p => p.id === 'handle')!
      const hole = holesOf(hd)[0], b = bbox([hole])
      expect(b.maxY - b.minY, `${W} ${handleH}`).toBeGreaterThanOrEqual(25 - 1e-6)
      expect(b.minY, `${W} ${handleH}: bar above the hole`).toBeGreaterThanOrEqual(12 - 1e-6)
      expect(polyDistance(samplePoly(hole), samplePoly(outerOf(hd))), `${W} ${handleH}`).toBeGreaterThan(8 - 0.1)
      if (b.maxX - b.minX < 70) expect(d.warnings.join(' ')).toMatch(/فتحة اليد/)
    }
  })

  it('small fixes: napkin minimum depth, fence belt fingers and slender pickets, lidded box height', () => {
    const t = 3, sep = 35, fit = 0.2, need = Math.ceil(sep + 2 * t + fit + 12)
    expect(generate(T('napkin'), { D: need - 1 }, S0).errors.join(' ')).toContain(String(need))
    expect(generate(T('napkin'), { D: need }, S0).errors).toEqual([])
    const thick = { ...S0, t: 6 }
    const low = generate(T('fence'), { H: 32 + 22 }, thick)
    expect(low.errors.join(' ')).toMatch(/الحزام/)
    const H = Number(low.errors.join(' ').match(/الارتفاع (\d+)/)![1])
    expect(generate(T('fence'), { H }, thick).errors).toEqual([])
    expect(generate(T('fence'), { H: 213, picket: 5, pgap: 3, pickH: 200 }, S0).warnings.join(' ')).toMatch(/نحيلة/)
    const deco = generate(T('decobox'), {}, S0)
    expect(deco.notes.join(' ')).toContain('103.8')
  })

  it('the Illustrator 8 layer header has the 13 operands Illustrator 8 writes', () => {
    const ai = toAI(generate(T('lip'), {}, S0).layout)
    expect(ai).toMatch(/\n1 1 1 1 0 0 1 0 255 0 0 0 50 Lb\n\(Cut\) Ln\n/)
    expect(ai).toContain('/Lb {13 {pop} repeat} bind def')
  })
})

describe('design picker', () => {
  it('lists every design in exactly one group', () => {
    const ids = CATEGORIES.flatMap(c => c.ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(TEMPLATES.map(t => t.id).sort())
  })
})

describe('legged chest and star lattice', () => {
  it('the floor tabs meet the wall slots, the legs reach the floor, and the stars keep 2.5 mm bars', () => {
    const tpl = TEMPLATES.find(x => x.id === 'chest')!
    const d = generate(tpl, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    expect(d.errors).toEqual([])
    const fb = d.panels.find(p => p.id === 'frontback')!, floor = d.panels.find(p => p.id === 'floor')!
    const outer = fb.loops.find(l => l.closed && signedArea(l) > 0)!
    // two legs touch the floor line, nothing between them does
    const bottom = outer.pts.filter(v => Math.abs(v.y - fb.h) < 1e-6).map(v => v.x)
    expect(Math.min(...bottom)).toBeLessThan(1); expect(Math.max(...bottom)).toBeGreaterThan(fb.w - 1)
    expect(bottom.filter(x => x > 40 && x < fb.w - 40)).toEqual([])
    // the floor's tabs on its front edge sit exactly under the wall's slots
    const slots = fb.loops.filter(l => l.closed && signedArea(l) < 0).map(l => bbox([l])).filter(b => Math.abs(b.maxY - b.minY - 3 - 0.15) < 0.01)
    const tabs = floor.loops[0].pts.filter(v => Math.abs(v.y) < 1e-6).map(v => v.x).sort((a, b) => a - b)
    expect(slots.length).toBe(tabs.length / 2)
    slots.sort((a, b) => a.minX - b.minX).forEach((sl, i) => { expect((sl.minX + sl.maxX) / 2).toBeCloseTo((tabs[2 * i] + tabs[2 * i + 1]) / 2, 2); expect(sl.maxX - sl.minX).toBeCloseTo(tabs[2 * i + 1] - tabs[2 * i] + 0.15, 2) })
    const stars = fb.loops.filter(l => l.closed && signedArea(l) < 0 && l.pts.length >= 4).map(l => samplePoly(l))
    let min = Infinity
    for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) min = Math.min(min, polyDistance(stars[i], stars[j]))
    expect(min).toBeGreaterThanOrEqual(2.5 - 1e-6)
  })
})

describe('cat money box', () => {
  const tpl = TEMPLATES.find(x => x.id === 'catbank')!
  it('builds nine pieces, and its twist lock passes the notches, then holds behind the wall a quarter turn later', () => {
    const d = generate(tpl, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    expect(d.errors).toEqual([])
    expect(d.pieceCount).toBe(9)
    const res = tpl.build({ ...tpl.defaults }, { ...DEFAULT_SETTINGS, finger: 9 })
    const spec = (id: string) => res.panels.find(p => p.id === id)!
    const hole = samplePoly(spec('back').holes![0]), key = samplePoly(spec('lock-key').shape![0])
    const spacer = samplePoly(spec('lock-spacer').shape![0]), cap = spec('lock-cap').shape![0]
    const c = bbox([spec('back').shape![0]]), cx = (c.minX + c.maxX) / 2, cy = (c.minY + c.maxY) / 2
    // through the notches with the fit all round
    for (const q of key) expect(pointIn(q, hole)).toBe(true)
    expect(polyDistance(key, hole)).toBeGreaterThan(0.2 - 0.01)
    for (const q of spacer) expect(pointIn(q, hole)).toBe(true)
    // turned 90° the keys lie over solid wall, so the plug cannot come out
    const turned = key.map(q => ({ x: cx - (q.y - cy), y: cy + (q.x - cx) }))
    const out = turned.filter(q => !pointIn(q, hole))
    expect(out.length).toBeGreaterThanOrEqual(4) // both ears' outer corners
    for (const q of out) expect(Math.hypot(q.x - cx, q.y - cy)).toBeGreaterThan(44 / 2 + 3) // 3 mm or more over the wall
    // the cap covers the opening and its notches
    const capR = (bbox([cap]).maxX - bbox([cap]).minX) / 2
    expect(Math.max(...hole.map(q => Math.hypot(q.x - cx, q.y - cy)))).toBeLessThan(capR)
  })
  it('keeps the coin slot in a band of the sheet free of hinge cuts, and refuses legs too short to clear the face', () => {
    const d = generate(tpl, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    const sheet = d.panels.find(p => p.id === 'sheet')!
    const slot = bbox([sheet.loops.find(l => l.closed && signedArea(l) < 0)!])
    expect(slot.maxY - slot.minY).toBeCloseTo(34, 1)
    const mid = (slot.minX + slot.maxX) / 2
    expect(Math.abs(mid - sheet.w / 2)).toBeLessThan(0.01)
    for (const l of sheet.loops.filter(l => !l.closed)) expect(Math.abs(l.pts[0].x - mid)).toBeGreaterThanOrEqual(2 + 6 - 1e-6)
    expect(generate(tpl, { legH: 10 }, DEFAULT_SETTINGS).errors.join(' ')).toMatch(/الأرجل/)
    expect(generate(tpl, { hole: 90, Dm: 90 }, DEFAULT_SETTINGS).errors.join(' ')).toMatch(/فتحة الإخراج/)
  })
})

describe('hexagonal ring box', () => {
  const tpl = TEMPLATES.find(x => x.id === 'hexringbox')!
  it('walls meet on the inner corners without overlapping, frames bridge the corners, and the base slots take the wall tabs', () => {
    const r3 = Math.sqrt(3)
    for (const t of [2, 3, 4]) for (const S of [50, 62, 100]) {
      const d = generate(tpl, { S }, { ...DEFAULT_SETTINGS, t, kerf: 0 })
      expect(d.errors, `t=${t} S=${S}`).toEqual([])
      const wall = d.panels.find(p => p.id === 'wall')!, frame = d.panels.find(p => p.id === 'frame')!, base = d.panels.find(p => p.id === 'base')!
      const sIn = (S - 2 * t) / r3, sOut = S / r3, tf = tpl.defaults.tf
      expect(wall.w).toBeCloseTo(sIn, 2); expect(frame.w).toBeCloseTo(sOut, 2); expect(wall.count).toBe(6); expect(frame.count).toBe(6)
      // top view: each wall a t-thick strip on its side, each frame a tf-thick strip on the outer face
      const strip = (k: number, len: number, r0: number, r1: number) => {
        const ph = (k + 0.5) * Math.PI / 3, n = { x: Math.cos(ph), y: Math.sin(ph) }, u = { x: -n.y, y: n.x }
        return [[-len / 2, r0], [len / 2, r0], [len / 2, r1], [-len / 2, r1]].map(([a, r]) => ({ x: a * u.x + r * n.x, y: a * u.y + r * n.y }))
      }
      for (let k = 0; k < 6; k++) {
        const A = strip(k, sIn, S / 2 - t, S / 2), B = strip((k + 1) % 6, sIn, S / 2 - t, S / 2)
        const shrink = (P: P[]) => { const cx = P.reduce((s, q) => s + q.x, 0) / 4, cy = P.reduce((s, q) => s + q.y, 0) / 4; return P.map(q => ({ x: cx + (q.x - cx) * 0.9999, y: cy + (q.y - cy) * 0.9999 })) }
        expect(polysOverlap(shrink(A), shrink(B)), `walls ${k} overlap`).toBe(false)
        // the inner corners coincide
        expect(Math.min(...[A[0], A[1]].flatMap(a => [B[0], B[1]].map(bq => Math.hypot(a.x - bq.x, a.y - bq.y))))).toBeLessThan(1e-3)
        const FA = strip(k, sOut, S / 2, S / 2 + tf), FB = strip((k + 1) % 6, sOut, S / 2, S / 2 + tf)
        expect(polysOverlap(shrink(FA), shrink(FB)), `frames ${k} overlap`).toBe(false)
        expect(Math.min(...[FA[0], FA[1]].flatMap(a => [FB[0], FB[1]].map(bq => Math.hypot(a.x - bq.x, a.y - bq.y))))).toBeLessThan(1e-3)
      }
      // the base slots sit on the walls' mid-planes, sized for the tabs plus the fit
      const AFb = S + 2 * tpl.defaults.ov, c = { x: AFb / r3, y: AFb / 2 }
      const slots = base.loops.filter(l => l.closed && signedArea(l) < 0)
      const tabs = (() => { const ys = wall.loops[0].pts; const bottom = Math.max(...ys.map(v => v.y)); return ys.filter(v => Math.abs(v.y - bottom) < 1e-6).length / 2 })()
      expect(slots.length).toBe(6 * tabs)
      for (const sl of slots) {
        const cx = sl.pts.reduce((s, q) => s + q.x, 0) / 4, cy = sl.pts.reduce((s, q) => s + q.y, 0) / 4
        const ph = Math.round((Math.atan2(cy - c.y, cx - c.x) / (Math.PI / 3)) - 0.5) + 0.5
        const nrm = (cx - c.x) * Math.cos(ph * Math.PI / 3) + (cy - c.y) * Math.sin(ph * Math.PI / 3)
        expect(nrm).toBeCloseTo(S / 2 - t / 2, 2)
      }
      // the collar repeats the base's slots, so the walls are held at both ends; the lip drops into its opening
      const collar = d.panels.find(p => p.id === 'collar')!
      expect(collar.loops.filter(l => l.closed && signedArea(l) < 0).length).toBe(6 * tabs + 1)
      expect(wall.h).toBeCloseTo(tpl.defaults.H + 2 * t, 3)
      expect(d.panels.find(p => p.id === 'lip')!.h).toBeCloseTo(S - 2 * t - 6 - 2 * tpl.defaults.gap, 2)
      // the frames are cut from the mirror sheet, in their own block
      expect(frame.material).toBe('mirror'); expect(d.panels.find(p => p.id === 'lid-frame')!.material).toBe('mirror')
      const mirrorTop = Math.min(...d.layout.placed.filter(q => q.panel.material === 'mirror').map(q => q.y))
      const clearBottom = Math.max(...d.layout.placed.filter(q => !q.panel.material).map(q => q.y + q.panel.h))
      expect(mirrorTop).toBeGreaterThan(clearBottom + 10)
    }
  })
})

describe('layout', () => {
  it('at kerf 0 and 0.2 every piece is drawn inside its own slot and on the sheet', () => {
    for (const tpl of TEMPLATES) for (const kerf of [0, 0.2]) {
      const d = generate(tpl, {}, { ...DEFAULT_SETTINGS, kerf })
      for (const pl of d.layout.placed) {
        const cut = pl.panel.loops.filter(l => l.closed && l.layer !== 'engrave')
        const b = bbox(cut)
        expect(b.minX, `${tpl.id} ${pl.panel.id} kerf ${kerf}`).toBeGreaterThan(-1e-6); expect(b.minY).toBeGreaterThan(-1e-6)
        expect(b.maxX).toBeLessThan(pl.panel.w + 1e-6); expect(b.maxY).toBeLessThan(pl.panel.h + 1e-6)
        const all = bbox(pl.panel.loops)
        expect(pl.x + all.maxX, `${tpl.id} ${pl.panel.id} off the sheet`).toBeLessThan(d.layout.w + 0.31)
        expect(pl.y + all.maxY).toBeLessThan(d.layout.h + 0.31)
      }
    }
  })
})

describe('DXF arcs', () => {
  it('every DXF bulge, read the standard way (counter-clockwise positive, y up), traces the same arc as the design', () => {
    for (const id of ['frame', 'hinged', 'hinged90', 'engagement', 'basket', 'chest', 'catbank', 'keyholder']) {
      const d = generate(TEMPLATES.find(t => t.id === id)!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
      const lines = toDXF(d.layout).split('\n'), H = d.layout.h
      const polys: { x: number; y: number; b: number }[][] = []
      let entity = ''
      for (let i = 0; i < lines.length - 1; i += 2) {
        const code = lines[i].trim(), val = lines[i + 1].trim()
        if (code === '0') entity = val
        if (code === '0' && val === 'POLYLINE') polys.push([])
        else if (code === '0' && val === 'VERTEX') polys[polys.length - 1].push({ x: NaN, y: NaN, b: 0 })
        const cur = polys[polys.length - 1]?.[polys[polys.length - 1].length - 1]
        if (!cur || code === '0' || entity !== 'VERTEX') continue
        if (code === '10') cur.x = +val; else if (code === '20') cur.y = +val; else if (code === '42') cur.b = +val
      }
      const mids: P[] = []
      for (const pl of d.layout.placed) for (const l of pl.panel.loops) l.pts.forEach((p, i) => {
        if (!p.b) return
        const a = arcInfo(p, l.pts[(i + 1) % l.pts.length], p.b), m = a.a0 + (a.ccw ? -1 : 1) * a.theta / 2
        mids.push({ x: a.c.x + a.r * Math.cos(m) + pl.x, y: a.c.y + a.r * Math.sin(m) + pl.y })
      })
      let n = 0
      for (const poly of polys) poly.forEach((p, i) => {
        if (!p.b) return
        const q = poly[(i + 1) % poly.length], c = Math.hypot(q.x - p.x, q.y - p.y), s = p.b * c / 2
        // a counter-clockwise arc bows to the right of its chord
        const mx = (p.x + q.x) / 2 + ((q.y - p.y) / c) * s, my = (p.y + q.y) / 2 - ((q.x - p.x) / c) * s
        const best = Math.min(...mids.map(v => Math.hypot(v.x - mx, v.y - (H - my))))
        expect(best, `${id}: DXF arc ${n} bows the wrong way`).toBeLessThan(0.01)
        n++
      })
      expect(n, id).toBeGreaterThan(0)
    }
  })
})

describe('materials in the cut files', () => {
  it('a second material gets its own layer and colour in SVG, DXF and AI, and its own block on the sheet', () => {
    const d = generate(TEMPLATES.find(x => x.id === 'hexringbox')!, {}, { ...DEFAULT_SETTINGS })
    const svg = toSVG(d.layout), dxf = toDXF(d.layout), ai = toAI(d.layout)
    expect(svg).toContain('<g id="cut-mirror" fill="none" stroke="#00a000"')
    expect(dxf).toContain('CUT-MIRROR')
    expect(ai).toMatch(/0 160 0 0 50 Lb\n\(Cut mirror\) Ln/)
    expect(ai).toContain('%AI5_NumLayers: 2')
    expect(d.notes.join(' ')).toMatch(/الأخضر/)
    expect(d.layout.groups?.length).toBe(2)
  })
  it('the frame border must keep glue land on the wall beyond the corner groove', () => {
    const tpl = TEMPLATES.find(x => x.id === 'hexringbox')!
    expect(generate(tpl, { b: 2 }, { ...DEFAULT_SETTINGS, t: 4 }).errors.join(' ')).toMatch(/أضيق من أن يُلصق/)
    expect(generate(tpl, { b: 4 }, { ...DEFAULT_SETTINGS, t: 3 }).errors).toEqual([])
  })
})

describe('engagement set', () => {
  const tpl = TEMPLATES.find(x => x.id === 'engagement')!
  const dims = (l: Loop) => { const [a, b, c] = l.pts; return [Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - b.x, c.y - b.y)].sort((x, y) => x - y) }
  it('the mirror and its braces plug through every base layer into slots of their own size', () => {
    for (const t of [2, 3, 4]) for (const layers of [1, 2, 3]) {
      const d = generate(tpl, { layers }, { ...DEFAULT_SETTINGS, t, kerf: 0 })
      expect(d.errors, `t=${t} layers=${layers}`).toEqual([])
      const mirror = d.panels.find(p => p.id === 'mirror')!, brace = d.panels.find(p => p.id === 'brace')!, top = d.panels.find(p => p.id === 'base-top')!
      const L = layers * t
      // the mirror's tabs hang L below its flat bottom; the brace's tab L below its foot
      const my = mirror.loops[0].pts.map(v => v.y), by = brace.loops[0].pts.map(v => v.y)
      expect(Math.max(...my) - Math.max(...my.filter(y => y < Math.max(...my) - 1e-6))).toBeCloseTo(L, 3)
      expect(Math.max(...by) - Math.max(...by.filter(y => y < Math.max(...by) - 1e-6))).toBeCloseTo(L, 3)
      const slots = top.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l) < 0).map(dims)
      expect(slots.length).toBe(4)
      // two slots for the mirror's tabs (t thick), two for the braces (t thick), each 0.15 wider than its tab
      const mirrorTab = (() => { const xs = mirror.loops[0].pts.filter(v => Math.abs(v.y - Math.max(...my)) < 1e-6).map(v => v.x).sort((a, b) => a - b); return xs[1] - xs[0] })()
      const braceTab = (() => { const xs = brace.loops[0].pts.filter(v => Math.abs(v.y - Math.max(...by)) < 1e-6).map(v => v.x).sort((a, b) => a - b); return xs[1] - xs[0] })()
      expect(slots.filter(([a, b]) => Math.abs(a - t - 0.15) < 1e-3 && Math.abs(b - mirrorTab - 0.15) < 1e-3).length).toBe(2)
      expect(slots.filter(([a, b]) => Math.abs(a - t - 0.15) < 1e-3 && Math.abs(b - braceTab - 0.15) < 1e-3).length).toBe(2)
      expect(d.panels.find(p => p.id === 'base-under')?.count ?? 0).toBe(layers - 1)
    }
  })
  it('the engraved mirror border stays 5 mm or more inside the mirror at every size, flat bottom included', () => {
    for (const Dd of [150, 200, 250, 300, 400, 500]) {
      const d = generate(tpl, { Dd, W: Dd + 100, border: 1 }, { ...DEFAULT_SETTINGS, kerf: 0 })
      const mirror = d.panels.find(p => p.id === 'mirror')!
      const outer = samplePoly(mirror.loops.find(l => l.closed && l.layer !== 'engrave' && signedArea(l) > 0)!)
      const border = samplePoly(mirror.loops.find(l => l.layer === 'engrave')!)
      for (const q of border) expect(pointIn(q, outer), `Dd ${Dd}`).toBe(true)
      expect(polyDistance(border, outer), `Dd ${Dd}`).toBeGreaterThan(5)
    }
  })
  it('each ring box takes its insert with clearance, the ring hangs clear of the floor, and the placement marks do not overlap', () => {
    const t = 3, d = generate(tpl, {}, { ...DEFAULT_SETTINGS, t, kerf: 0 })
    const p = tpl.defaults, rbD = p.rbW - 5
    const insert = d.panels.find(x => x.id === 'ring-insert')!, spacer = d.panels.find(x => x.id === 'ring-spacer')!
    expect(insert.w).toBeCloseTo(p.rbW - 2 * t - 1); expect(insert.h).toBeCloseTo(rbD - 2 * t - 1)
    expect(spacer.count).toBe(4); expect(insert.count).toBe(2)
    // a ring up to 22 mm across with a 7 mm stone rests in the 14 mm slit: it needs R + sqrt(R² − 7²) + 7 above the insert
    const above = 11 + Math.sqrt(121 - 49) + 7
    expect(t + spacer.h + t + above + 1).toBeCloseTo(p.rbH, 2) // floor, spacer, insert, the ring and its stone, 1 mm, the lid
    expect(spacer.h).toBeGreaterThanOrEqual(5)
    expect(d.panels.filter(x => x.id.startsWith('ring-') && !['ring-insert', 'ring-spacer'].includes(x.id)).every(x => (x.count ?? 1) % 2 === 0)).toBe(true)
    const top = d.panels.find(x => x.id === 'base-top')!
    const engr = top.loops.filter(l => l.layer === 'engrave')
    const marks = engr.filter(l => l.closed).map(l => samplePoly(l))
    expect(marks.length).toBe(2) // one rectangle per ring box
    expect(engr.filter(l => !l.closed).length).toBe(6) // a cross for the heart and for each square
    for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) expect(polysOverlap(marks[i], marks[j])).toBe(false)
    // the heart's cross lies well inside the heart piece placed on its mark
    const hw = p.hw, cx = top.w / 2, crossY = engr.filter(l => !l.closed && Math.abs(l.pts[0].x - l.pts[1].x) < 1e-6 && Math.abs(l.pts[0].x - cx) < 1e-3)
    expect(crossY.length).toBe(1)
    const hy = (crossY[0].pts[0].y + crossY[0].pts[1].y) / 2
    const heartPoly = samplePoly(heart(cx, hy, hw))
    for (const l of engr.filter(l => !l.closed && Math.hypot((l.pts[0].x + l.pts[1].x) / 2 - cx, (l.pts[0].y + l.pts[1].y) / 2 - hy) < 1e-3)) for (const v of l.pts) expect(pointIn(v, heartPoly)).toBe(true)
    expect(generate(tpl, { rings: 1 }, { ...DEFAULT_SETTINGS, kerf: 0 }).panels.find(x => x.id === 'base-top')!.loops.filter(l => l.layer === 'engrave' && l.closed).length).toBe(1)
    // every mark lies in front of the mirror's slots
    const slotY = Math.min(...top.loops.filter(l => l.layer !== 'engrave' && signedArea(l) < 0).flatMap(l => l.pts.map(v => v.y)))
    for (const mk of engr) expect(Math.max(...mk.pts.map(v => v.y))).toBeLessThan(slotY - 5)
    expect(generate(tpl, { W: 260 }, { ...DEFAULT_SETTINGS, kerf: 0 }).errors.join(' ')).toMatch(/أعرض من القاعدة|أضيق/)
  })
})

describe('commercial designs: parts that mate', () => {
  const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
  const T = (id: string) => TEMPLATES.find(x => x.id === id)!
  const holes = (pn: { loops: Loop[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l) < 0)
  // a rectangular slot's two side lengths, short first
  const dims = (l: Loop) => { const [a, b, c] = l.pts; return [Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - b.x, c.y - b.y)].sort((x, y) => x - y) }
  // a tabbed plate's tab height: the span of its outline at x = 0
  const tabSpan = (pn: { loops: Loop[] }) => { const ys = pn.loops[0].pts.filter(v => Math.abs(v.x) < 1e-6).map(v => v.y); return Math.max(...ys) - Math.min(...ys) }
  it('every stand plate fits a slot of its own size in the sides', () => {
    for (const id of ['phonestand', 'bookstand']) {
      const d = generate(T(id), {}, S0)
      expect(d.errors).toEqual([])
      const slots = holes(d.panels.find(p => p.id === 'side')!).map(dims)
      for (const pid of ['lip', 'brace', 'foot']) {
        const span = tabSpan(d.panels.find(p => p.id === pid)!)
        expect(slots.some(([a, b]) => Math.abs(a - (3 + 0.15)) < 1e-3 && Math.abs(b - (span + 0.15)) < 1e-3), `${id} ${pid}`).toBe(true)
      }
    }
  })
  it('the cross-lapped trees and the headphone column meet at half height', () => {
    for (const id of ['mugtree', 'jewelrytree']) {
      const d = generate(T(id), {}, S0), H = T(id).defaults.H
      const a = d.panels.find(p => p.id === 'tree-a')!, b = d.panels.find(p => p.id === 'tree-b')!
      expect(a.loops[0].pts.some(v => Math.abs(v.y - H / 2) < 1e-6)).toBe(true)
      expect(b.loops[0].pts.some(v => Math.abs(v.y - H / 2) < 1e-6)).toBe(true)
    }
    const res = T('headphone').build({ ...T('headphone').defaults }, { ...S0, finger: 9 })
    const H = 260, t = 3, A = res.panels.find(p => p.id === 'post-a')!, B = res.panels.find(p => p.id === 'post-b')!
    const aSlot = A.cuts!.find(r => r.w < 4 && r.y > 0)!, bSlot = B.cuts!.find(r => r.w < 4 && r.y === 0)!
    expect((H + t) - aSlot.y).toBeCloseTo(H / 2)             // A's slot reaches from the base up to H/2
    expect((H - 10) - (bSlot.y + bSlot.h)).toBeCloseTo(H / 2) // B's slot reaches from its top down to H/2
  })
  it('the spice rack sides carry a rail slot just above every shelf, and the key board has a slot for every peg and tab', () => {
    const d = generate(T('spicerack'), {}, S0)
    const side = d.panels.find(p => p.id === 'side')!
    expect(side.count).toBe(2) // one piece twice: the second is moved across, not flipped
    const rails = holes(side).map(l => bbox([l]))
    expect(rails.filter(b => b.maxY < 10).length).toBe(3) // near the front edge: two shelves and the bottom board
    expect(d.panels.find(p => p.id === 'rail')!.count).toBe(3)
    const k = generate(T('keyholder'), {}, S0)
    const board = holes(k.panels.find(p => p.id === 'board')!)
    expect(board.length).toBe(2 + 2 + 2 + 5) // keyholes, shelf tabs, brackets, pegs
    expect(k.panels.find(p => p.id === 'peg')!.count).toBe(5)
  })
})

describe('export', () => {
  it('writes Illustrator 8 (PostScript) with exact point sizes, a red cut layer, a blue engrave layer and arcs as curves', () => {
    const d = generate(TEMPLATES.find(t => t.id === 'frame')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    const ai = toAI(d.layout, 'f.ai')
    expect(ai.startsWith('%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator(R) 8.0')).toBe(true)
    expect(ai).toContain('%AI5_FileFormat 4.0')
    const hi = ai.match(/%%HiResBoundingBox: 0 0 ([\d.]+) ([\d.]+)/)!
    expect(Number(hi[1]) * 25.4 / 72).toBeCloseTo(d.layout.w, 2)
    expect(Number(hi[2]) * 25.4 / 72).toBeCloseTo(d.layout.h, 2)
    expect(ai).toContain('(Cut) Ln\n0 1 1 0 K')
    expect(ai).toContain('(Engrave) Ln\n1 1 0 0 K')
    expect(ai).not.toMatch(/NaN|undefined/)
    expect(ai.trim().endsWith('%%EOF')).toBe(true)
    // a lone circle (the shade's socket hole) becomes exactly four Bézier quarters
    const sh = generate(TEMPLATES.find(t => t.id === 'shade')!, {}, { ...DEFAULT_SETTINGS, kerf: 0 })
    const one = { ...sh.layout, placed: [{ ...sh.layout.placed[0], panel: { ...sh.layout.placed[0].panel, loops: [circle(50, 50, 20)] } }] }
    const body = toAI(one).split('(Cut) Ln')[1]
    expect((body.match(/ C$/gm) ?? []).length).toBe(4)
  })

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


describe('wedding designs', () => {
  const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
  const T = (id: string) => TEMPLATES.find(x => x.id === id)!
  const cutLoops = (pn: { loops: Loop[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
  const outerOf = (pn: { loops: Loop[] }) => cutLoops(pn).find(l => signedArea(l) > 0)!
  const holesOf = (pn: { loops: Loop[] }) => cutLoops(pn).filter(l => signedArea(l) < 0)
  // where a horizontal line y = Y crosses a closed loop, left to right
  const crossings = (l: Loop, Y: number) => {
    const poly = samplePoly(l, 1), xs: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]
      if ((a.y <= Y && b.y > Y) || (b.y <= Y && a.y > Y)) xs.push(a.x + (b.x - a.x) * (Y - a.y) / (b.y - a.y))
    }
    return xs.sort((u, v) => u - v)
  }
  const extent = (l: Loop, Y: number) => { const xs = crossings(l, Y); return xs[xs.length - 1] - xs[0] }

  it('the cake topper keeps its frame exactly b wide all round, the notch included, and its band splits the hole', () => {
    for (const [W, b, band, stakes] of [[150, 7, 22, 2], [80, 4, 0, 1], [250, 15, 40, 2], [100, 6, 12, 1], [60, 3, 0, 2]]) {
      const d = generate(T('caketopper'), { W, b, band, stakes }, S0)
      expect(d.errors, `W${W} b${b}`).toEqual([])
      const pn = d.panels[0], outer = samplePoly(outerOf(pn), 1), holes = holesOf(pn)
      expect(holes.length, `W${W} band${band}`).toBe(band > 0 ? (holes.length === 2 ? 2 : 1) : 1)
      for (const h of holes) {
        const dist = polyDistance(samplePoly(h, 1), outer)
        expect(dist, `W${W} b${b} frame`).toBeGreaterThan(b - 0.05)
        expect(dist, `W${W} b${b} frame`).toBeLessThan(b + 0.05)
      }
      if (band > 0 && holes.length === 2) expect(polyDistance(samplePoly(holes[0], 1), samplePoly(holes[1], 1))).toBeCloseTo(band, 2)
      // the lobes top out at y = 0; below the heart's tip the stakes: two pieces of material, or one
      const bb = bbox([outerOf(pn)])
      expect(bb.minY).toBeCloseTo(0, 6)
      expect(crossings(outerOf(pn), bb.maxY - 20).length).toBe(2 * stakes)
    }
    expect(generate(T('caketopper'), { W: 80, b: 16 }, S0).errors.length).toBeGreaterThan(0)
    expect(generate(T('caketopper'), { band: 5 }, S0).errors.length).toBeGreaterThan(0)
  })

  it('the guest frame: one outline for every layer, hearts pass the drop slot, the window shows only the cavity, and nail heads have room', () => {
    for (const win of [1, 2, 3]) {
      const p = { W: 300, H: 400, b: 30, bt: 70, hw: 45, win, layers: 2 }
      const d = generate(T('guestframe'), p, S0)
      expect(d.errors).toEqual([])
      for (const id of ['front', 'glass', 'spacer', 'back']) {
        const bb = bbox([outerOf(d.panels.find(x => x.id === id)!)])
        expect([bb.minX, bb.minY, bb.maxX, bb.maxY].map(v => Math.round(v * 1000) / 1000 + 0), id).toEqual([0, 0, 300, 400])
      }
      const spacer = d.panels.find(x => x.id === 'spacer')!, heartPn = d.panels.find(x => x.id === 'heart')!
      // the drop slot at the top of the spacer: wider than the heart by 10 mm; the cavity is two thicknesses deep for a one-thickness heart
      const xs = crossings(outerOf(spacer), 10)
      expect(xs.length).toBe(4)
      expect(xs[2] - xs[1]).toBeCloseTo(heartPn.w + 10, 2)
      expect(spacer.count * 3 - 3).toBeGreaterThanOrEqual(1.5)
      // every point of the window lies inside the cavity, and away from the frame's edge
      const front = d.panels.find(x => x.id === 'front')!, wnd = samplePoly(holesOf(front)[0], 2)
      for (const q of wnd) { expect(q.x).toBeGreaterThanOrEqual(30 - 1e-6); expect(q.x).toBeLessThanOrEqual(270 + 1e-6); expect(q.y).toBeGreaterThanOrEqual(70 - 1e-6); expect(q.y).toBeLessThanOrEqual(370 + 1e-6) }
      if (win === 2) {
        // the heart window's notch is rounded: wood stays 3 mm around the point where the lobes meet
        const hw = Math.min(240, 300 / 0.95), cusp = { x: 150, y: 70 + 300 / 2 - 0.225 * hw }
        expect(Math.min(...wnd.map(q => Math.hypot(q.x - cusp.x, q.y - cusp.y)))).toBeGreaterThan(2.9)
      }
      // each keyhole in the back sits inside a pocket of every spacer layer
      const back = d.panels.find(x => x.id === 'back')!, pockets = holesOf(spacer).map(h => samplePoly(h, 5))
      expect(holesOf(back).length).toBe(2)
      for (const kh of holesOf(back)) for (const q of samplePoly(kh, 5)) expect(pockets.some(pk => pointIn(q, pk)), 'keyhole in pocket').toBe(true)
    }
    expect(generate(T('guestframe'), { layers: 2 }, { ...S0, t: 1 }).errors.length).toBeGreaterThan(0) // 2 mm cavity for a 1 mm heart: too tight
  })

  it('the sweets stand: every plate slides down over the narrower column and rests on a ledge, and the base takes the tab', () => {
    for (const [tiers, gap, ledge, shape] of [[3, 110, 8, 1], [2, 80, 6, 2], [4, 120, 10, 1]]) {
      const p: Record<string, number> = { ...T('sweetstand').defaults, tiers, gap, ledge, shape, D1: 400 }, t = 3, fit = p.fit
      const d = generate(T('sweetstand'), p, S0)
      expect(d.errors).toEqual([])
      const colA = outerOf(d.panels.find(x => x.id === 'column-a')!), colB = outerOf(d.panels.find(x => x.id === 'column-b')!)
      const z = (j: number) => (j - 1) * gap + (j - 2) * t, top = z(tiers) + t + p.topH, Hc = top + t
      const plusSpan = (j: number) => { const h = holesOf(d.panels.find(x => x.id === `plate-${j}`)!)[0]; const bb = bbox([h]); return bb.maxX - bb.minX }
      for (const col of [colA, colB]) {
        // the base: the tab is the hole's size, the column above it 6 mm wider each side
        expect(plusSpan(1)).toBeCloseTo(extent(col, Hc - t / 2) + fit, 3)
        expect(extent(col, Hc - t - 0.5) - extent(col, Hc - t / 2)).toBeCloseTo(12, 3)
        for (let j = 2; j <= tiers; j++) {
          const seat = top - z(j)
          expect(plusSpan(j), `plate ${j}`).toBeCloseTo(extent(col, seat - 0.5) + fit, 3)  // its own section passes through the hole
          expect(extent(col, seat + 0.5) - extent(col, seat - 0.5), `ledge ${j}`).toBeCloseTo(2 * ledge, 3) // and rests on the wider one below
          for (let y = 1; y < seat - 0.5; y += 5) expect(extent(col, y) + fit).toBeLessThanOrEqual(plusSpan(j) + 1e-6) // everything above passes
        }
      }
      // the halving slots meet at half height
      expect(colA.pts.some(v => Math.abs(v.y - Hc / 2) < 1e-3)).toBe(true)
      expect(colB.pts.some(v => Math.abs(v.y - Hc / 2) < 1e-3)).toBe(true)
      expect(bbox([colA]).maxY).toBeCloseTo(Hc, 3)
    }
  })

  it('table numbers: one plate per number, gold digits counted, guides hidden under them, tabs through every base layer', () => {
    const d = generate(T('tablenumbers'), { from: 8, n: 3, num: 2, layers: 2 }, S0)
    expect(d.errors).toEqual([])
    expect(d.panels.filter(x => x.id.startsWith('plate-')).map(x => x.id)).toEqual(['plate-8', 'plate-9', 'plate-10'])
    const digits = Object.fromEntries(d.panels.filter(x => x.id.startsWith('digit-')).map(x => [x.id, x.count]))
    expect(digits).toEqual({ 'digit-0': 1, 'digit-1': 1, 'digit-8': 1, 'digit-9': 1 })
    for (const x of d.panels.filter(q => q.id.startsWith('digit-'))) expect(x.material).toBe('mirror')
    expect(holesOf(d.panels.find(x => x.id === 'digit-8')!).length).toBe(2)
    const plate = d.panels.find(x => x.id === 'plate-10')!, outline = samplePoly(outerOf(plate), 2)
    const guides = plate.loops.filter(l => l.layer === 'engrave')
    expect(guides.length).toBe(2)
    const H = T('tablenumbers').defaults.H
    for (const g of guides) for (const q of samplePoly(g, 5)) { expect(pointIn(q, outline)).toBe(true); expect(q.y).toBeLessThan(H - 8) }
    // a guide is 1 mm inside its gold digit: smaller than the piece, so it hides under it
    const g8 = d.panels.find(x => x.id === 'plate-8')!.loops.find(l => l.layer === 'engrave')!, p8 = outerOf(d.panels.find(x => x.id === 'digit-8')!)
    expect(Math.abs(signedArea(g8))).toBeLessThan(Math.abs(signedArea(p8)))
    const gb = bbox([g8]), pb = bbox([p8])
    expect(pb.maxX - pb.minX - (gb.maxX - gb.minX)).toBeCloseTo(2, 3)
    // the tabs: as long as the base stack, as wide as the slots less the clearance
    const base = d.panels.find(x => x.id === 'base-top')!, under = d.panels.find(x => x.id === 'base-under')!
    expect(base.count).toBe(3); expect(under.count).toBe(3)
    const slot = bbox([holesOf(base)[0]]), tabs = crossings(outerOf(plate), H + 3)
    expect(tabs.length).toBe(4)
    expect(tabs[1] - tabs[0] + 0.15).toBeCloseTo(slot.maxX - slot.minX, 3)
    expect(bbox([outerOf(plate)]).maxY - H).toBeCloseTo(2 * 3, 3)
    // engraved style: the counters are engraved too
    const e = generate(T('tablenumbers'), { from: 8, n: 1, num: 1 }, S0)
    expect(e.panels.find(x => x.id === 'plate-8')!.loops.filter(l => l.layer === 'engrave').length).toBe(3)
    expect(e.panels.some(x => x.id.startsWith('digit-'))).toBe(false)
  })

  it('every gold digit, at any plate size, is one piece with its counters: none, or one in 0 6 9, two in 8', () => {
    // every size from 70 to 220 mm in half millimetres, single digits and the 1 and 0 of three-digit numbers (their digits are smaller)
    for (let W = 70; W <= 220; W += 0.5) for (const from of [0, 100]) {
      const d = generate(T('tablenumbers'), { W, H: 320, Db: 90, shape: 2, from, n: 10, num: 2 }, S0)
      expect(d.errors).toEqual([])
      for (let dg = 0; dg <= 9; dg++) {
        const pn = d.panels.find(x => x.id === `digit-${dg}`)
        if (!pn) continue
        expect(cutLoops(pn).filter(l => signedArea(l) > 0).length, `W${W} digit ${dg}`).toBe(1)
        expect(holesOf(pn).length, `W${W} digit ${dg} counters`).toBe(dg === 8 ? 2 : [0, 6, 9].includes(dg) ? 1 : 0)
      }
    }
  })

  it('the guest frame warns when the cavity cannot hold the hearts asked for', () => {
    expect(generate(T('guestframe'), {}, S0).warnings).toEqual([])
    const w = generate(T('guestframe'), { W: 200, H: 250, b: 15, bt: 30, hw: 45, layers: 2, n: 300 }, S0).warnings
    expect(w.some(m => m.includes('يتّسع'))).toBe(true)
  })

  it('favour boxes multiply by the count, and the heart window sits inside the lip frame over the clear plate', () => {
    const d = generate(T('favorbox'), { W: 60, D: 60, H: 45, n: 12, win: 2 }, S0)
    expect(d.errors).toEqual([])
    const cnt = (id: string) => d.panels.find(x => x.id === id)!.count
    expect([cnt('bottom'), cnt('front'), cnt('back'), cnt('side'), cnt('lid'), cnt('lip-fb'), cnt('lip-side'), cnt('window')]).toEqual([12, 12, 12, 24, 12, 24, 24, 12])
    const t = 3, gap = 0.4, open = 60 - 2 * t - 2 * gap - 2 * t // the lip frame's opening
    const win = d.panels.find(x => x.id === 'window')!
    expect(win.w).toBeCloseTo(open - 1, 3)
    expect(win.material).toBe('clear')
    const lo = (60 - (open - 1)) / 2
    for (const q of samplePoly(holesOf(d.panels.find(x => x.id === 'lid')!)[0], 3)) {
      expect(q.x).toBeGreaterThan(lo + 2); expect(q.x).toBeLessThan(60 - lo - 2)
      expect(q.y).toBeGreaterThan(lo + 2); expect(q.y).toBeLessThan(60 - lo - 2)
    }
  })

  it('kerf on a heart outline closes its cleft where the grown lobes cross, instead of a bevel that crosses itself', () => {
    const cases: [string, Record<string, number>, string][] = [['caketopper', { W: 150 }, 'topper'], ['caketopper', { W: 300 }, 'topper'], ['engagement', { hw: 120, W: 600, D: 250 }, 'heart'], ['keychains', { shape: 3, S: 80 }, 'keychain']]
    for (const [id, params, pid] of cases) for (const kerf of [0.2, 0.4]) {
      const d = generate(T(id), params, { ...DEFAULT_SETTINGS, kerf })
      expect(d.errors, id).toEqual([])
      const o = outerOf(d.panels.find(x => x.id === pid)!)
      const poly = samplePoly(o, 3), n = poly.length
      let crossed = false
      for (let i = 0; i < n && !crossed; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) { crossed = true; break } }
      expect(crossed, `${id} ${JSON.stringify(params)} kerf ${kerf}`).toBe(false)
    }
    // the cleft's new bottom: where two circles of radius r + kerf/2, 2r apart, cross
    const d = generate(T('caketopper'), { W: 150 }, { ...DEFAULT_SETTINGS, kerf: 0.2 }), o = outerOf(d.panels[0])
    const r = 37.5, cleft = o.pts.filter(v => Math.abs(v.x - (75 + 0.1)) < 0.01 && v.y < 50)
    expect(cleft.length).toBe(1)
    expect(cleft[0].y).toBeCloseTo(0.1 + r - Math.sqrt((r + 0.1) ** 2 - r * r), 3)
  })

  // points of two different engraving lines, sampled every `step`, never closer than `min`
  const closestApart = (lines: Loop[], step: number) => {
    const grid = new Map<string, { x: number; y: number; id: number }[]>()
    lines.forEach((l, id) => {
      const pts = l.closed ? [...l.pts, l.pts[0]] : l.pts
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
        for (let j = 0; j <= k; j++) { const q = { x: a.x + (b.x - a.x) * j / k, y: a.y + (b.y - a.y) * j / k, id }; const key = `${Math.floor(q.x)},${Math.floor(q.y)}`; (grid.get(key) ?? grid.set(key, []).get(key)!).push(q) }
      }
    })
    let closest = Infinity
    for (const [key, pts] of grid) {
      const [cx, cy] = key.split(',').map(Number)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) for (const p of pts) if (p.id !== q.id) closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y))
    }
    return closest
  }

  it('the door panel from the photo: the frame, three circles and three bars, each n lines lw apart', () => {
    for (const [gw, lw] of [[10, 2], [10, 1], [6, 2]]) {
      const d = generate(T('doorpanel'), { gw, lw }, S0)
      expect(d.errors, `gw${gw} lw${lw}`).toEqual([])
      const pn = d.panels[0], lines = pn.loops.filter(l => l.layer === 'engrave')
      expect(pn.loops.filter(l => l.layer !== 'engrave').length).toBe(1) // the panel's outline, for alignment
      const bb = bbox([outerOf(pn)])
      expect([bb.maxX - bb.minX, bb.maxY - bb.minY]).toEqual([600, 1060])
      const n = Math.round(gw / lw)
      expect(lines.filter(l => l.closed && l.pts.length === 4).length).toBe(n) // the frame's rectangles
      expect(lines.filter(l => l.closed && l.pts.length > 4).length).toBe(3 * n) // three circles
      expect(lines.filter(l => !l.closed && l.pts.length === 2).length).toBe(3 * n) // three bars
    }
    expect(generate(T('doorpanel'), { gw: 30 }, S0).errors.length).toBeGreaterThan(0)
  })

  it('every door design: no two laser lines burn the same wood, where grooves meet included, and every groove has its n lines', () => {
    const doors = [...CATEGORIES.find(c => c.id === 'doorsmodern')!.ids, ...CATEGORIES.find(c => c.id === 'doorsarab')!.ids]
    expect(doors.length).toBe(17)
    for (const id of doors) for (const [gw, lw] of [[10, 2], [12, 1.5]]) {
      const d = generate(T(id), { gw, lw }, S0)
      expect(d.errors, `${id} gw${gw} lw${lw}`).toEqual([])
      const lines = d.panels[0].loops.filter(l => l.layer === 'engrave')
      // the frame is drawn first and never clipped: n whole rectangles
      expect(lines.filter(l => l.closed && l.pts.length === 4 && l.pts[0].x < 50 && l.pts[0].y < 50).length, id).toBe(Math.round(gw / lw))
      expect(closestApart(lines, 0.2), `${id} gw${gw} lw${lw}`).toBeGreaterThan(lw - 0.11) // round spots lw wide: they touch, never overlap
    }
  })

  it('the door hanger: a round hole for the handle, or with the slit a channel of its width out to the edge, in every shape', () => {
    for (const shape of [1, 2, 3]) {
      const plain = generate(T('doorhanger'), { shape }, S0).panels[0]
      const h = holesOf(plain)
      expect(h.length, `shape ${shape}`).toBe(1)
      const hb = bbox(h)
      expect(hb.maxX - hb.minX).toBeCloseTo(38, 6)
      const d = generate(T('doorhanger'), { shape, slit: 1, sw: 20 }, S0)
      expect(d.errors).toEqual([])
      const pn = d.panels[0]
      expect(holesOf(pn).length).toBe(0) // the hole opens into the outline through the slit
      const iv = materialAt(outerOf(pn), 99.5) // just inside the right edge
      expect(iv.length).toBe(2)
      expect(iv[1][0] - iv[0][1], `shape ${shape} slit`).toBeCloseTo(20, 2)
      expect(materialAt(outerOf(pn), 50)[0][0], `shape ${shape} top`).toBeCloseTo(0, 6) // nothing cut away at the top
    }
    expect(generate(T('doorhanger'), { W: 60, hole: 50 }, S0).errors.length).toBeGreaterThan(0)
    expect(generate(T('doorhanger'), { slit: 1, sw: 36 }, S0).errors.length).toBeGreaterThan(0)
  })

  it('the wedding group lists the engagement set, the ring box and the five wedding designs', () => {
    expect(CATEGORIES.find(c => c.id === 'wedding')!.ids).toEqual(['engagement', 'hexringbox', 'caketopper', 'guestframe', 'sweetstand', 'tablenumbers', 'favorbox'])
  })
})
