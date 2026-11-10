import { describe, it, expect } from 'vitest'
import { ENGAGE_STANDS, standGeom, heartOutline, HEART_INSETS, MIN_W, stripCount } from './engagestand'
import { generate, DEFAULT_SETTINGS, Design } from './generate'
import { signedArea, bbox, polyLoop, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, materialAt, offSheet } from './testutil'

const tpl = ENGAGE_STANDS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type Pn = Design['panels'][number]
type P = { x: number; y: number }
const build = (v: Record<string, number>, s: Partial<typeof DEFAULT_SETTINGS> = {}) => generate(tpl, v, { ...S0, ...s })
const get = (d: Design, id: string) => d.panels.find(x => x.id === id)!
const isCut = (l: Loop) => l.closed && l.layer !== 'engrave'
const outerOf = (pn: Pn) => pn.loops.find(l => isCut(l) && signedArea(l) > 0)!
const holesOf = (pn: Pn) => pn.loops.filter(l => isCut(l) && signedArea(l) < 0)
const geomOf = (v: Record<string, number>, t = 3) => standGeom({ ...tpl.defaults, ...v }, t).g
const near = (a: number, b: number, tol = 1e-3) => Math.abs(a - b) <= tol

/** the tabs of a piece standing on y = bottom: [left, right] x of each, from the vertices at its lowest edge */
function tabs(pn: Pn): { bottom: number; depth: number; xs: [number, number][] } {
  const o = outerOf(pn), b = bbox([o])
  const low = o.pts.filter(v => near(v.y, b.maxY)).map(v => v.x).sort((u, w) => u - w)
  const xs: [number, number][] = []
  for (let i = 0; i + 1 < low.length; i += 2) xs.push([low[i], low[i + 1]])
  // the piece's foot: the highest y (other than the tab bottoms) of the vertices right beside a tab
  const feet = o.pts.filter(v => !near(v.y, b.maxY) && low.some(x => near(v.x, x))).map(v => v.y)
  const bottom = Math.max(...feet)
  return { bottom, depth: b.maxY - bottom, xs }
}
/** the base hole whose box is [x0, x1] × [y0, y1] */
const slotAt = (base: Pn, x0: number, x1: number, y0: number, y1: number) =>
  holesOf(base).find(h => { const b = bbox([h]); return near(b.minX, x0) && near(b.maxX, x1) && near(b.minY, y0) && near(b.maxY, y1) })

describe('engagement stand: the stand delivered to the customer', () => {
  it('matches stand.py at both sizes: sizes, strips, tab places, braces and every slot in the base', () => {
    // numbers from stand.py's report and its DXF files (their outlines grown by half the 0.1 kerf)
    const cases = [
      { W: 500, D: 320, n: 11, ws: 20, g: 12, ttx: [52, 232], braces: [99, 291], arch: [340, 463], panel: [290, 383], brace: [30, 83], heart: [62, 52.74],
        slots: [[99.8, 41.5, 40.2, 3.2], [290.2, 41.5, 40.2, 3.2], [242, 44.5, 40.2, 3.2], [422, 44.5, 40.2, 3.2], [99, 23.5, 3.2, 13.7], [291, 23.5, 3.2, 13.7]] },
      { W: 400, D: 256, n: 11, ws: 16, g: 9.6, ttx: [39.4, 185.6], braces: [79.2, 232.8], arch: [272, 371], panel: [232, 307], brace: [24, 67], heart: [49.6, 41.85],
        slots: [[79.84, 33.5, 32.2, 3.2], [232.16, 33.5, 32.2, 3.2], [191.4, 36.5, 32.2, 3.2], [337.6, 36.5, 32.2, 3.2], [79.2, 18.8, 3.2, 11], [232.8, 18.8, 3.2, 11]] },
    ]
    for (const c of cases) {
      const g = geomOf({ W: c.W })
      expect(g.D).toBeCloseTo(c.D, 6)
      expect(g.n).toBe(c.n)
      expect(g.ws).toBeCloseTo(c.ws, 6)
      expect(g.g).toBeCloseTo(c.g, 6)
      expect(g.ttx[0]).toBeCloseTo(c.ttx[0], 6); expect(g.ttx[1]).toBeCloseTo(c.ttx[1], 6)
      expect(g.braceAt.map(i => g.xs0 + g.strips[i]).map(v => Math.round(v * 1000) / 1000)).toEqual(c.braces)
      const d = build({ W: c.W })
      expect(d.errors).toEqual([])
      expect(d.warnings).toEqual([])
      for (const [id, [w, h]] of [['arch', c.arch], ['panel', c.panel], ['brace', c.brace], ['heart', c.heart]] as const) {
        expect(get(d, id).w, `${c.W} ${id}`).toBeCloseTo(w, 1)
        expect(get(d, id).h, `${c.W} ${id}`).toBeCloseTo(h, 1)
      }
      const base = get(d, 'base')
      expect(base.w).toBeCloseTo(c.W, 6); expect(base.h).toBeCloseTo(c.D, 6)
      expect(holesOf(base)).toHaveLength(6)
      for (const [x, y, w, h] of c.slots) expect(slotAt(base, x - w / 2, x + w / 2, y - h / 2, y + h / 2), `${c.W} slot at ${x}, ${y}`).toBeTruthy()
    }
  })

  it('every tab lands in its slot with the clearance all round, at any size, thickness, clearance and base thickness', () => {
    let runs = 0
    for (const W of [300, 400, 500, 650, 800]) for (const t of [2, 3, 4, 6]) for (const fit of [0, 0.2, 0.5]) for (const tm of [0, 5]) {
      const d = build({ W, fit, tm }, { t }), g = geomOf({ W, fit, tm }, t), lab = `W=${W} t=${t} fit=${fit} tm=${tm}`
      expect(d.errors, lab).toEqual([])
      runs++
      const tb = tm || t, base = get(d, 'base')
      expect(holesOf(base), lab).toHaveLength(6)
      // the strip arch and the panel: tabs tb deep under their foot, each centred in a slot fit wider and longer
      for (const [id, x0, yBack] of [['arch', g.xs0, g.ys], ['panel', g.xt0, g.yt]] as const) {
        const tt = tabs(get(d, id))
        expect(tt.depth, `${lab} ${id} tab depth`).toBeCloseTo(tb, 6)
        expect(tt.xs, `${lab} ${id} tabs`).toHaveLength(2)
        for (const [a, b] of tt.xs) {
          expect(b - a, `${lab} ${id} tab width`).toBeCloseTo(g.tw, 2)
          expect(slotAt(base, x0 + a - fit / 2, x0 + b + fit / 2, yBack - fit / 2, yBack + t + fit / 2), `${lab} ${id} slot for the tab at ${a}`).toBeTruthy()
        }
      }
      // the braces: the upright leg (x = 0) on the arch's back face, the foot running back over the base
      const bt = tabs(get(d, 'brace'))
      expect(bt.depth, `${lab} brace tab depth`).toBeCloseTo(tb, 6)
      expect(bt.xs).toHaveLength(1)
      const [a, b] = bt.xs[0]
      for (const i of g.braceAt) {
        const bx = g.xs0 + g.strips[i]
        expect(slotAt(base, bx - (t + fit) / 2, bx + (t + fit) / 2, g.ys - b - fit / 2, g.ys - a + fit / 2), `${lab} brace slot at ${bx}`).toBeTruthy()
      }
    }
    expect(runs).toBe(120)
  })

  it('the panel stands right in front of the strip arch, its back face on the arch\'s front face, and its slots keep 8 mm of base from the arch\'s', () => {
    for (const W of [300, 333, 360, 400, 450, 500, 575, 700, 800]) for (const t of [2, 3, 6]) for (const fit of [0, 0.2, 1]) {
      const g = geomOf({ W, fit }, t), d = build({ W, fit }, { t }), lab = `W=${W} t=${t} fit=${fit}`
      expect(d.errors, lab).toEqual([])
      expect(g.yt, lab).toBeCloseTo(g.ys + t, 9) // the panel's back face = the arch's front face
      // in front of the arch: most of the panel's width has the arch right behind it, and it stays on the base
      const overlap = Math.min(g.xs0 + g.As, g.xt0 + g.At) - Math.max(g.xs0, g.xt0)
      expect(overlap / g.At, lab).toBeGreaterThan(0.55)
      expect(g.xt0 + g.At, lab).toBeLessThan(g.W - 10)
      // the slots right behind each other: at least 8 mm of base between them along x
      const arch = g.stx.map(x => [g.xs0 + x - (g.tw + fit) / 2, g.xs0 + x + (g.tw + fit) / 2])
      const pan = g.ttx.map(x => [g.xt0 + x - (g.tw + fit) / 2, g.xt0 + x + (g.tw + fit) / 2])
      for (const [p0, p1] of pan) for (const [a0, a1] of arch) expect(Math.max(p0 - a1, a0 - p1), lab).toBeGreaterThanOrEqual(8 - 1e-6)
      // and the panel's tabs 8 mm in from its ends, as near a fifth and four fifths as that allows (whole millimetres)
      for (const [i, f] of [[0, 0.2], [1, 0.8]] as const) {
        expect(g.ttx[i] - g.tw / 2, lab).toBeGreaterThanOrEqual(8 - 1e-9)
        expect(g.At - g.ttx[i] - g.tw / 2, lab).toBeGreaterThanOrEqual(8 - 1e-9)
        const k = g.ttx[i] - f * g.At
        expect(Math.abs(k - Math.round(k)), lab).toBeLessThan(1e-9)
      }
    }
  })

  it('the braces stand on strip centres, wholly on their strip from the base up to their top, 30 × 80 mm at full size', () => {
    for (const W of [300, 400, 500, 800]) for (const [sw, sg] of [[0, 0], [8, 3], [40, 0], [0, 30], [12, 12]]) for (const t of [2, 3, 6]) {
      const v = { W, sw, sg }, g = geomOf(v, t), d = build(v, { t }), lab = `W=${W} sw=${sw} sg=${sg} t=${t}`
      expect(d.errors, lab).toEqual([])
      expect(g.Ls / g.s).toBeCloseTo(30, 9); expect(g.Hb / g.s).toBeCloseTo(80, 9)
      expect(new Set(g.braceAt).size, lab).toBe(2)
      // the strips nearest a quarter and three quarters of the arch
      for (const [k, q] of [[0, 0.25], [1, 0.75]] as const) for (const c of g.strips) expect(Math.abs(g.strips[g.braceAt[k]] - q * g.As), lab).toBeLessThanOrEqual(Math.abs(c - q * g.As) + 1e-9)
      // the arch's material covers the brace's whole width over its whole height, at the strip centre
      const arch = get(d, 'arch'), tt = tabs(arch), o = outerOf(arch), brace = get(d, 'brace')
      expect(brace.h - tt.depth, lab).toBeCloseTo(g.Hb, 3)
      for (const i of g.braceAt) for (const dx of [-t / 2 + 0.01, 0, t / 2 - 0.01]) {
        const iv = materialAt(o, g.strips[i] + dx)
        expect(iv.some(([y0, y1]) => y0 <= tt.bottom - g.Hb + 1e-3 && y1 >= tt.bottom - 1e-3), `${lab} strip ${i} at ${dx}`).toBe(true)
      }
    }
  })

  it('the strips: as many as fit at the width asked, the gaps rounded at their foot at the band\'s top, the tips rounded', () => {
    const d = build({}), g = geomOf({}), arch = get(d, 'arch'), o = outerOf(arch), tt = tabs(arch)
    // just above the band every gap is open, just below it none is
    const across = (y: number) => {
      const xs: number[] = [], poly = samplePoly(o)
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) }
      return xs.sort((u, v) => u - v)
    }
    expect(across(tt.bottom - g.hb - 0.05)).toHaveLength(2 * g.n)
    expect(across(tt.bottom - g.hb + 0.05)).toHaveLength(2)
    const above = across(tt.bottom - g.hb - g.g)
    for (let i = 0; i < g.n; i++) { expect(above[2 * i]).toBeCloseTo(i * (g.ws + g.g), 3); expect(above[2 * i + 1]).toBeCloseTo(i * (g.ws + g.g) + g.ws, 3) }
    // the tips are rounded 1.5 mm: a fillet at each side of every gap, and at the band's two bottom corners; every other
    // corner above the foot is smooth (arcs and lines meeting tangentially), so these are the only small arcs
    const pts = o.pts, n = pts.length
    const radius = (i: number) => { const v = pts[i], q = pts[(i + 1) % n], c = Math.hypot(q.x - v.x, q.y - v.y); return (c * (1 + v.b! ** 2)) / (4 * Math.abs(v.b!)) }
    const small = pts.map((v, i) => (v.b ? radius(i) : Infinity)).filter(r => r < 5)
    expect(small).toHaveLength(2 * (g.n - 1) + 2)
    for (const r of small) expect(r).toBeCloseTo(1.5, 2)
    // where a line meets an arc (the gaps' sides, the arch's sides) they meet tangentially: no kink
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], v = pts[i], q = pts[(i + 1) % n]
      if (v.y >= tt.bottom - 1e-6 || a.y >= tt.bottom - 1e-6) continue
      const dirIn = a.b ? null : Math.atan2(v.y - a.y, v.x - a.x), dirOut = v.b ? null : Math.atan2(q.y - v.y, q.x - v.x)
      if ((dirIn === null) === (dirOut === null)) continue // line–line does not occur above the foot; arc–arc is checked by the radii
      // the arc's tangent at the shared vertex
      const arcFrom = dirIn === null ? a : v, arcTo = dirIn === null ? v : q, b = arcFrom.b!
      const chord = Math.atan2(arcTo.y - arcFrom.y, arcTo.x - arcFrom.x), half = 2 * Math.atan(b) // bulge b = tan(θ/4): the tangent turns θ/2 from the chord at each end
      const tan = dirIn === null ? chord - half : chord + half
      const line = (dirIn ?? dirOut)!
      const diff = Math.atan2(Math.sin(tan - line), Math.cos(tan - line))
      expect(Math.abs(diff), `kink at ${v.x.toFixed(2)},${v.y.toFixed(2)}`).toBeLessThan(2e-3)
    }
    // the strip count follows the strip width asked
    expect(geomOf({ sw: 30 }).n).toBe(Math.floor((340 + 12) / 42))
    expect(geomOf({ sw: 30 }).ws).toBeGreaterThanOrEqual(30)
  })
})

describe('engagement stand: the hearts', () => {
  const layers = (w: number) => ({
    silver: polyLoop(heartOutline(w, 0), 'outer'), white: polyLoop(heartOutline(w, HEART_INSETS.white), 'outer'),
    lineOut: polyLoop(heartOutline(w, HEART_INSETS.lineOut), 'outer'), lineIn: polyLoop(heartOutline(w, HEART_INSETS.lineIn), 'hole'),
  })
  const segD = (q: P, a: P, b: P) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0; return Math.hypot(q.x - a.x - u * dx, q.y - a.y - u * dy) }
  const distTo = (q: P, poly: P[]) => { let b = Infinity; for (let i = 0; i < poly.length; i++) b = Math.min(b, segD(q, poly[i], poly[(i + 1) % poly.length])); return b }

  it('each layer lies inside the one below it at exactly its inset all round (white 3.5 mm in, the line 2.5 mm wide 2.5 mm inside the white)', () => {
    for (const w of [37.2, 49.6, 62, 74.4, 99.2]) {
      const L = layers(w)
      const pairs: [string, Loop, Loop, number][] = [
        ['white in silver', L.white, L.silver, HEART_INSETS.white],
        ['line in white', L.lineOut, L.white, HEART_INSETS.lineOut - HEART_INSETS.white],
        ['line width', L.lineIn, L.lineOut, HEART_INSETS.lineIn - HEART_INSETS.lineOut],
      ]
      for (const [name, inner, outer, gap] of pairs) {
        const pi = samplePoly(inner, 3), po = samplePoly(outer, 3)
        for (const q of pi) {
          expect(pointIn(q, po), `${w} ${name} inside`).toBe(true)
          const dd = distTo(q, po)
          expect(dd, `${w} ${name} at ${q.x.toFixed(2)},${q.y.toFixed(2)}`).toBeGreaterThan(gap - 0.03)
          expect(dd, `${w} ${name} at ${q.x.toFixed(2)},${q.y.toFixed(2)}`).toBeLessThan(gap + 0.03)
        }
        expect(selfIntersects(pi), `${w} ${name} crosses itself`).toBe(false)
      }
      // the silver heart: w wide, on the axis, as tall as the curve (29 for 32 wide) less what the point's 2 mm round takes
      const b = bbox([L.silver])
      expect(b.maxX - b.minX).toBeCloseTo(w, 1)
      expect(b.minX).toBeCloseTo(-w / 2, 1)
      expect(b.maxY - b.minY).toBeGreaterThan((29 / 32) * w - 5)
      expect(b.maxY - b.minY).toBeLessThan((29 / 32) * w - 2)
      expect(bbox([L.white]).maxX - bbox([L.white]).minX).toBeCloseTo(w - 2 * HEART_INSETS.white, 1)
      expect(bbox([L.lineOut]).maxX - bbox([L.lineOut]).minX).toBeCloseTo(w - 2 * HEART_INSETS.lineOut, 1)
      // symmetric about the axis
      for (const v of L.white.pts) expect(L.white.pts.some(u => near(u.x, -v.x) && near(u.y, v.y))).toBe(true)
    }
  })

  it('the notch is a 3 mm round, the silver point a 2 mm round, the layers above it pointed', () => {
    const L = layers(62), rOf = (l: Loop, i: number) => { const v = l.pts[i], q = l.pts[(i + 1) % l.pts.length], c = Math.hypot(q.x - v.x, q.y - v.y); return (c * (1 + v.b! ** 2)) / (4 * Math.abs(v.b!)) }
    const radii = (l: Loop, want: number[]) => {
      const rs = l.pts.map((v, i) => (v.b ? rOf(l, i) : 0)).filter(r => r > 0).sort((a, b) => a - b)
      expect(rs).toHaveLength(want.length)
      rs.forEach((r, i) => expect(r).toBeCloseTo(want[i], 2))
    }
    radii(L.silver, [2, 2, 3, 3]) // each round in two halves, either side of the axis
    radii(L.white, [6.5, 6.5])
    radii(L.lineOut, [9, 9])
    radii(L.lineIn, [11.5, 11.5])
    // the white heart's lowest point is a corner on the axis
    const low = L.white.pts.reduce((a, v) => (v.y > a.y ? v : a))
    expect(low.x).toBeCloseTo(0, 6)
  })

  it('the stand cuts three of each layer: silver and the line from mirror, the white heart from white; none without hearts', () => {
    const d = build({}), g = geomOf({})
    const L = layers(g.hw)
    for (const [id, mat, l] of [['heart', 'mirror', L.silver], ['heart-white', 'white', L.white], ['heart-line', 'mirror', L.lineOut]] as const) {
      const pn = get(d, id), b = bbox([l])
      expect(pn.count).toBe(3)
      expect(pn.material).toBe(mat)
      expect(pn.w).toBeCloseTo(b.maxX - b.minX, 6)
      expect(pn.h).toBeCloseTo(b.maxY - b.minY, 6)
    }
    expect(holesOf(get(d, 'heart-line'))).toHaveLength(1)
    const none = build({ hearts: 0 })
    expect(none.errors).toEqual([])
    expect(none.panels.map(p => p.id)).toEqual(['base', 'arch', 'panel', 'brace'])
    expect(none.notes.join(' ')).not.toContain('القلوب:')
  })
})

describe('engagement stand: soundness, materials, notes and refusals', () => {
  it('every piece is sound across sizes, thicknesses, kerfs and every parameter at its ends, or the design is refused', () => {
    const extras = tpl.params.filter(d => d.key !== 'W')
    const variants: Record<string, number>[] = [{}, { sw: 8, sg: 3 }, { sw: 30, sg: 20 }]
    for (const def of extras) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    for (const W of [MIN_W, 400, 500, 800]) for (const t of [2, 3, 4.5, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      const params = { W, ...v }, lab = `${JSON.stringify(params)} t=${t} kerf=${kerf}`
      const d = generate(tpl, params, { ...DEFAULT_SETTINGS, t, kerf })
      runs++
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y) && (q.b === undefined || Number.isFinite(q.b)), `${lab} ${pn.id} finite`).toBe(true)
      if (d.errors.length) { refused++; continue }
      expect(d.warnings, lab).toEqual([])
      expect(offSheet(d.layout), lab).toEqual([])
      for (const pn of d.panels) {
        const outers = pn.loops.filter(l => isCut(l) && signedArea(l) > 0)
        expect(outers.length, `${lab} ${pn.id} one piece`).toBe(1)
        const outer = samplePoly(outers[0], 10)
        expect(selfIntersects(outer), `${lab} ${pn.id} crosses itself`).toBe(false)
        for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; expect(Math.hypot(q.x - outer[i].x, q.y - outer[i].y), `${lab} ${pn.id} zero-length edge`).toBeGreaterThan(1e-6) }
        const hs = holesOf(pn).map(h => samplePoly(h, 10))
        for (const h of hs) {
          for (const q of h) expect(pointIn(q, outer), `${lab} ${pn.id} hole inside`).toBe(true)
          expect(selfIntersects(h), `${lab} ${pn.id} hole crosses itself`).toBe(false)
          expect(polyDistance(h, outer), `${lab} ${pn.id} hole web`).toBeGreaterThan(2)
        }
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) expect(polyDistance(hs[i], hs[j]), `${lab} ${pn.id} web between holes`).toBeGreaterThan(2.5)
      }
      expect(toDXF(d.layout).match(/NaN|undefined/), lab).toBeNull()
    }
    expect(runs).toBe(4 * 4 * 2 * variants.length)
    expect(refused).toBeLessThan(runs / 4)
  })

  it('cuts the base, the strip arch, the braces and the silver hearts from mirror, the panel and the white hearts from white', () => {
    const d = build({})
    const mats = Object.fromEntries(d.panels.map(p => [p.id, p.material]))
    expect(mats).toEqual({ base: 'mirror', arch: 'mirror', panel: 'white', brace: 'mirror', heart: 'mirror', 'heart-white': 'white', 'heart-line': 'mirror' })
    expect(get(d, 'brace').count).toBe(2)
    expect(d.pieceCount).toBe(1 + 1 + 1 + 2 + 9)
    // the layout puts each material on its own sheets
    for (const pl of d.layout.placed) expect(d.layout.sheets![pl.sheet!].material).toBe(pl.panel.material)
  })

  it('says how to put it together: the panel glued to the arch with UV or gel glue, names added in RDWorks, the base face up, measure the sheets', () => {
    const notes = build({ W: 400 }).notes.join('\n')
    expect(notes).toContain('400 × 256')
    expect(notes).toMatch(/UV/)
    expect(notes).toMatch(/جل/)
    expect(notes).toContain('غراء الأكريليك السائل')
    expect(notes).toContain('RDWorks')
    expect(notes).toContain('CorelDRAW')
    expect(notes).toContain('لا يشكّل الحروف العربية')
    expect(notes).toContain('ووجه المرآة للأعلى')
    expect(notes).toContain('قِس سماكة الألواح')
    expect(notes).toContain('الخطّ الفضّي')
  })

  it('counts the strips with the Arabic number agreement: شرائح for 3 to 10, شريحة from 11', () => {
    expect([1, 2, 3, 10, 11, 99, 100, 101, 103, 110, 111].map(stripCount)).toEqual(['شريحة واحدة', 'شريحتان', '3 شرائح', '10 شرائح', '11 شريحة', '99 شريحة', '100 شريحة', '101 شريحة', '103 شرائح', '110 شرائح', '111 شريحة'])
    for (const [v, n, word] of [[{}, 11, 'شريحة'], [{ sw: 40, sg: 30 }, 5, 'شرائح'], [{ W: 300, sw: 40, sg: 30 }, 3, 'شرائح'], [{ sw: 30, sg: 20 }, 7, 'شرائح'], [{ sw: 25, sg: 12 }, 9, 'شرائح']] as [Record<string, number>, number, string][]) {
      const d = build(v)
      expect(d.errors, JSON.stringify(v)).toEqual([])
      expect(geomOf(v).n).toBe(n)
      expect(get(d, 'arch').note).toMatch(new RegExp(`^${n} ${word} يجمعها`))
      expect(d.notes[0]).toContain(`: ${n} ${word} عرض كلّ منها`)
    }
    expect(build({ W: 300, sw: 100 }).errors.join(' ')).toContain('لا تتّسع إلا شريحة واحدة؛')
    expect(build({ sw: 150 }).errors.join(' ')).toContain('لا تتّسع إلا شريحتان؛')
  })

  it('refuses sizes it cannot make, with the reason', () => {
    const err = (v: Record<string, number>, t = 3) => build(v, { t }).errors.join(' | ')
    expect(err({ W: 200 })).toContain(`${MIN_W} مم`)
    expect(err({ W: 60 })).toContain('عرض القاعدة')
    expect(err({ sw: 4 })).toContain('الشرائح عرضها')
    expect(err({ sw: 7 }, 6)).toContain('الدعامة') // a 6 mm brace on a 7 mm strip
    expect(err({ sg: 2 })).toContain('الفراغ بين الشرائح')
    expect(err({ W: 300, sw: 100 })).toContain('الشرائح عريضة')
    expect(err({ tm: 0.5 })).toContain('سماكة القاعدة')
    for (const v of [{ W: 200 }, { sw: 4 }, { sg: 2 }] as Record<string, number>[]) expect(build(v).panels).toEqual([])
    // each extreme alone still makes a stand at its default size
    for (const def of tpl.params) for (const x of [def.min, def.max]) expect(err({ [def.key]: x }), `${def.key}=${x}`).toBe('')
  })
})
