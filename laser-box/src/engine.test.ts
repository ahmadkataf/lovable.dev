import { describe, it, expect } from 'vitest'
import { unionRects, rect, offsetLoop, circle, signedArea, bbox, loopLength, edgeNotch, roundCorner, loopToPath, arcInfo, Loop } from './geom'
import { buildPanel, fingerCount, edgeCuts } from './joints'
import { TEMPLATES, pivotLid } from './templates'
import { generate, DEFAULT_SETTINGS, autoFinger } from './generate'
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
      expect(d.errors).toEqual([])
      expect(d.pieceCount).toBeGreaterThanOrEqual(3)
      for (const p of d.panels) {
        expect(p.w).toBeGreaterThan(0)
        const outers = p.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l) > 0)
        expect(outers.length, `${tpl.id}/${p.id} should be one piece`).toBe(1)
        for (const l of p.loops) for (const v of l.pts) { expect(Number.isFinite(v.x)).toBe(true); expect(Number.isFinite(v.y)).toBe(true) }
      }
      expect(d.layout.w).toBeLessThanOrEqual(s.sheetW + 1)
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
    expect(sl.panels.find(p => p.id === 'side')!.h - 3 * t - 0.3).toBeCloseTo(50)
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

describe('robustness grid', () => {
  // every template over thickness, kerf, finger, box size and its own parameter ranges; whenever no error is
  // reported the geometry must be sound: one outer loop per panel, no self-intersection, holes inside with margin
  it('generates sound geometry for every template across a parameter grid, or refuses with an error', () => {
    const boxes = [[60, 50, 30], [120, 80, 50], [300, 200, 120]]
    let runs = 0, refused = 0
    for (const tpl of TEMPLATES) {
      const extras = tpl.params.filter(d => !['W', 'D', 'H', 'Dm'].includes(d.key))
      const variants: Record<string, number>[] = [{}]
      for (const def of extras) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
      for (const t of [2, 2.7, 3, 4, 6]) for (const kerf of [0, 0.2]) for (const finger of [0, 12]) for (const [W, D, H] of boxes) for (const inner of [false, true]) for (const v of variants) {
        const params = tpl.id === 'shade' ? { Dm: W, H, ...v } : tpl.id === 'frame' ? { pw: W, ph: D + H, ...v } : { W, D, H, ...v }
        runs++
        let d
        try { d = generate(tpl, params, { ...DEFAULT_SETTINGS, t, kerf, finger, inner }) } catch (e) { throw new Error(`${tpl.id} ${JSON.stringify(params)} t=${t} kerf=${kerf} threw: ${(e as Error).message}`) }
        for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${tpl.id} ${pn.id} non-finite`).toBe(true)
        if (d.errors.length) { refused++; continue }
        const label = `${tpl.id} ${JSON.stringify(params)} t=${t} kerf=${kerf} finger=${finger} inner=${inner}`
        expect(d.layout.w, label).toBeLessThanOrEqual(Math.max(DEFAULT_SETTINGS.sheetW, Math.max(...d.panels.map(p => p.w))) + 1e-6)
        for (const pn of d.panels) {
          expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
          const closed = pn.loops.filter(l => l.closed && l.layer !== 'engrave')
          const outers = closed.filter(l => signedArea(l) > 0)
          expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
          const outer = samplePoly(outers[0], 15)
          expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
          for (const h of closed.filter(l => signedArea(l) < 0)) {
            const hp = samplePoly(h, 20)
            expect(polysOverlap(hp, outer) && !pointIn(hp[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
            // every hole vertex inside the outline, and the outline not closer than 0.8 mm (slots that merge into joints become part of the outline, so they never appear here)
            for (const q of hp) expect(pointIn(q, outer), `${label} ${pn.id} hole vertex outside`).toBe(true)
            expect(polyDistance(hp, outer), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
          }
          for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; expect(Math.hypot(q.x - outer[i].x, q.y - outer[i].y), `${label} ${pn.id} zero-length`).toBeGreaterThan(1e-6) }
        }
        const dxf = toDXF(d.layout)
        expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
      }
    }
    expect(runs).toBeGreaterThan(1000)
    expect(refused).toBeLessThan(runs)
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

// ---------------------------------------------------------------- polygon helpers for the sweep tests
type P = { x: number; y: number }

/** A closed loop with bulges as a dense polygon (arcs sampled every ~3°). */
function samplePoly(l: Loop, stepDeg = 3): P[] {
  const out: P[] = []
  const n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(4, Math.ceil(a.theta / (stepDeg * Math.PI / 180)))
      for (let k = 1; k < m; k++) { const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * k / m; out.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }) }
    }
  }
  return out
}

/** Material intervals of a panel along the vertical line x = X (ray casting on the outer loop). */
function materialAt(l: Loop, X: number): [number, number][] {
  const poly = samplePoly(l), ys: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if ((a.x <= X && b.x > X) || (b.x <= X && a.x > X)) ys.push(a.y + (b.y - a.y) * (X - a.x) / (b.x - a.x))
  }
  ys.sort((u, v) => u - v)
  const iv: [number, number][] = []
  for (let i = 0; i + 1 < ys.length; i += 2) iv.push([Math.round(ys[i] * 1000) / 1000, Math.round(ys[i + 1] * 1000) / 1000])
  return iv
}

const orient = (a: P, b: P, c: P) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function segsCross(a: P, b: P, c: P, d: P): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b)
  return o1 * o2 < -1e-12 && o3 * o4 < -1e-12
}
function pointIn(p: P, poly: P[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < a.x + (b.x - a.x) * (p.y - a.y) / (b.y - a.y)) inside = !inside
  }
  return inside
}
function polysOverlap(A: P[], B: P[]): boolean {
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segsCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true
  return pointIn(A[0], B) || pointIn(B[0], A)
}
function segDist(a: P, b: P, c: P, d: P): number {
  const pd = (p: P, u: P, v: P) => { const l2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2; const tt = l2 ? Math.max(0, Math.min(1, ((p.x - u.x) * (v.x - u.x) + (p.y - u.y) * (v.y - u.y)) / l2)) : 0; return Math.hypot(p.x - (u.x + tt * (v.x - u.x)), p.y - (u.y + tt * (v.y - u.y))) }
  return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b))
}
function polyDistance(A: P[], B: P[]): number {
  let best = Infinity
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) best = Math.min(best, segDist(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length]))
  return best
}

function selfIntersects(poly: P[]): boolean {
  const n = poly.length
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    if (segsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true
  }
  return false
}
