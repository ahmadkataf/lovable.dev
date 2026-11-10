import { describe, it, expect } from 'vitest'
import { WOOD_COMBS, combRow, combShape, combCount, pyRound, MIN_TOOTH, MIN_GAP, TIP_R, CORNER_R } from './woodcomb'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, arcInfo, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, selfIntersects, offSheet, P } from './testutil'

const tpl = WOOD_COMBS[0]
const D0 = tpl.defaults
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const cutLoops = (pn: { loops: Loop[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const outerOf = (pn: { loops: Loop[] }) => cutLoops(pn).find(l => signedArea(l) > 0)!
/** the wood along the horizontal line y = Y: [left, right] spans, left to right */
function spans(pts: P[], Y: number): [number, number][] {
  const xs: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    if ((a.y <= Y && b.y > Y) || (b.y <= Y && a.y > Y)) xs.push(a.x + ((b.x - a.x) * (Y - a.y)) / (b.y - a.y))
  }
  xs.sort((u, v) => u - v)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]])
  return out
}
/** teeth widths and gap widths halfway down the teeth */
function row(d: ReturnType<typeof generate>, tl: number) {
  const pn = d.panels[0], o = outerOf(pn), s = spans(samplePoly(o, 2), pn.h - tl / 2)
  return { s, teeth: s.map(([a, b]) => b - a), gaps: s.slice(1).map(([a], i) => a - s[i][1]) }
}
const arcs = (l: Loop) => l.pts.flatMap((p, i) => (p.b ? [{ p, q: l.pts[(i + 1) % l.pts.length], ...arcInfo(p, l.pts[(i + 1) % l.pts.length], p.b) }] : []))

describe('wooden comb (woodcomb)', () => {
  it('is the delivered comb at its defaults: 120 × 54 mm, 28 teeth (15 fine, 11 coarse), 24 copies', () => {
    const d = generate(tpl, {}, S0)
    expect(d.errors).toEqual([])
    expect(d.warnings).toEqual([])
    expect(d.panels).toHaveLength(1)
    const pn = d.panels[0]
    expect(pn.w).toBeCloseTo(120, 9)
    expect(pn.h).toBeCloseTo(54, 9) // teeth 30 + the back's 24 in the middle (comb.json: height 54.0)
    expect(pn.count).toBe(24)
    expect(d.pieceCount).toBe(24)
    const r = combRow(120, 4, 2.2, 1.6, 2.8, 2.2)
    expect([r.nf, r.nc]).toEqual([15, 11])
    expect(r.fill).toBeCloseTo(48.2 / 50.1, 12) // (112 − 15·2.2 − 11·2.8) / (1.6·15.5 + 2.2·11.5)
    expect(combShape(D0).teeth).toBe(28)
    expect(row(d, D0.tl).teeth).toHaveLength(28)
  })

  it('cuts every tooth at its width and scales both kinds of gap alike, so the row fills the length exactly', () => {
    const sets: Record<string, number>[] = [{}, { L: 97.5 }, { L: 233, ft: 2, fg: 1.4, ct: 3.4, cg: 2.6, guard: 6 }]
    for (const p of sets) {
      const q: Record<string, number> = { ...D0, ...p }
      const d = generate(tpl, p, S0)
      expect(d.errors, JSON.stringify(p)).toEqual([])
      const { s, teeth, gaps } = row(d, q.tl), r = combRow(q.L, q.guard, q.ft, q.fg, q.ct, q.cg)
      // the guard teeth end flush with the comb's ends, and every tooth and gap adds up to the length
      expect(s[0][0]).toBeCloseTo(0, 6)
      expect(s[s.length - 1][1]).toBeCloseTo(q.L, 6)
      expect(teeth.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)).toBeCloseTo(q.L, 6)
      const want = [q.guard, ...Array(r.nf).fill(q.ft), ...Array(r.nc).fill(q.ct), q.guard]
      expect(teeth.length).toBe(want.length)
      teeth.forEach((w, i) => expect(w, `${JSON.stringify(p)} tooth ${i}`).toBeCloseTo(want[i], 6))
      // the gaps: fine ones, the mean of the two kinds between them, then coarse ones; each kind times the same factor
      const wantG = [...Array(r.nf).fill(q.fg * r.fill), ((q.fg + q.cg) / 2) * r.fill, ...Array(r.nc).fill(q.cg * r.fill)]
      expect(gaps.length).toBe(wantG.length)
      gaps.forEach((w, i) => expect(w, `${JSON.stringify(p)} gap ${i}`).toBeCloseTo(wantG[i], 6))
      expect(r.fineGap / q.fg).toBeCloseTo(r.coarseGap / q.cg, 12)
      // the row itself: from the left guard tooth's inner side to the right one's, exactly
      const last = r.seq[r.seq.length - 1]
      expect(r.seq[0].x).toBe(q.guard)
      expect(last.x + last.w).toBeCloseTo(q.L - q.guard, 9)
    }
  })

  it('keeps the widths as cut: the cut lines sit half a kerf off the wood on every side', () => {
    const kerf = 0.2, a = row(generate(tpl, {}, S0), D0.tl), b = row(generate(tpl, {}, { ...S0, kerf }), D0.tl)
    expect(b.teeth).toHaveLength(a.teeth.length)
    b.teeth.forEach((w, i) => expect(w).toBeCloseTo(a.teeth[i] + kerf, 6))
    b.gaps.forEach((w, i) => expect(w).toBeCloseTo(a.gaps[i] - kerf, 6))
  })

  it('rounds every tooth tip and every gap root (a half circle), and the back\'s top corners 5 mm', () => {
    const d = generate(tpl, {}, S0), pn = d.panels[0], o = outerOf(pn), H = pn.h
    const all = arcs(o)
    // tips: two 0.9 mm quarter circles on every tooth, bowing out (convex), their centres 0.9 mm above the tip line
    const tips = all.filter(a => Math.abs(a.r - TIP_R) < 1e-9)
    expect(tips).toHaveLength(2 * 28)
    for (const a of tips) { expect(a.p.b!).toBeLessThan(0); expect(a.c.y).toBeCloseTo(H - TIP_R, 9); expect(a.theta).toBeCloseTo(Math.PI / 2, 9) }
    // roots: a half circle across every gap, reaching exactly the teeth's length above the tips
    const roots = all.filter(a => a.p.b === 1)
    expect(roots).toHaveLength(27)
    const r = combRow(D0.L, D0.guard, D0.ft, D0.fg, D0.ct, D0.cg), gaps = r.seq.filter(s => s.kind === 'g')
    roots.forEach((a, i) => {
      const g = gaps[gaps.length - 1 - i] // walked right to left
      expect(a.r).toBeCloseTo(g.w / 2, 9)
      expect(a.c.x).toBeCloseTo(g.x + g.w / 2, 9)
      expect(H - (a.c.y - a.r)).toBeCloseTo(D0.tl, 9) // tip to the top of the root = the teeth's length
    })
    // the top corners: 5 mm arcs tangent to the ends (centres 5 mm in) and to the arch
    const corners = all.filter(a => Math.abs(a.r - CORNER_R) < 1e-9)
    expect(corners).toHaveLength(2)
    expect(corners.map(a => a.c.x).sort((u, v) => u - v).map(v => Math.round(v * 1e9) / 1e9)).toEqual([CORNER_R, D0.L - CORNER_R])
    for (const a of corners) {
      expect(a.p.b!).toBeLessThan(0)
      // the end of the arc on the arch: the arch's next chord runs square to the radius there
      const onArch = Math.abs(a.p.x - a.c.x) < Math.abs(a.q.x - a.c.x) ? a.p : a.q, i = o.pts.indexOf(onArch as never)
      const nb = onArch === a.q ? o.pts[(i + 1) % o.pts.length] : o.pts[(i - 1 + o.pts.length) % o.pts.length]
      const ux = nb.x - onArch.x, uy = nb.y - onArch.y, rx = onArch.x - a.c.x, ry = onArch.y - a.c.y
      expect(Math.abs(ux * rx + uy * ry) / Math.hypot(ux, uy) / Math.hypot(rx, ry)).toBeLessThan(0.01)
    }
    // just above the tips a 2.2 mm tooth is narrower by the rounding (0.1 mm up: 2·(0.9 − √(0.9² − 0.8²)))
    const s = spans(samplePoly(o, 0.5), H - 0.1).map(([u, v]) => v - u)
    expect(s[1]).toBeCloseTo(2.2 - 2 * (0.9 - Math.sqrt(0.81 - 0.64)), 3)
    // a tooth narrower than two tip radii gets a half circle for a tip
    const thin = outerOf(generate(tpl, { ft: 1.7 }, S0).panels[0])
    expect(arcs(thin).filter(a => a.p.b === -1 && Math.abs(a.r - 0.85) < 1e-9)).toHaveLength(combRow(D0.L, D0.guard, 1.7, D0.fg, D0.ct, D0.cg).nf)
  })

  it('draws the arch of comb.py: the back he tall at the ends and hm in the middle', () => {
    const o = samplePoly(outerOf(generate(tpl, {}, S0).panels[0]), 1)
    const topAt = (x: number) => { const ys: number[] = []; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) ys.push(a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)) } return Math.min(...ys) }
    // y down from the top of the arch: the back is 24 − 10·(1 − sin(πx/120)) tall at x, measured from the roots at y = 24
    for (const x of [10, 30, 45, 60, 75, 90, 110]) expect(24 - topAt(x), `x=${x}`).toBeCloseTo(14 + 10 * Math.sin((Math.PI * x) / 120), 2)
    // a straight back when the middle is as tall as the ends
    const flat = samplePoly(outerOf(generate(tpl, { hm: 14 }, S0).panels[0]), 1)
    expect(Math.min(...flat.map(q => q.y))).toBeCloseTo(0, 9)
    expect(generate(tpl, { hm: 14 }, S0).panels[0].h).toBeCloseTo(44, 9)
  })

  it('is one sound piece at every kerf and across its settings, or says why not', () => {
    const sets: Record<string, number>[] = [
      {}, { L: 50 }, { L: 300 }, { tl: 10 }, { tl: 60 }, { he: 8, hm: 8 }, { he: 60, hm: 80 }, { he: 8, hm: 80, L: 50 },
      { ft: 1.6, fg: 1.2, ct: 1.6, cg: 1.2 }, { ft: 5, fg: 5, ct: 6, cg: 6 }, { ft: 1.8, ct: 1.8 }, { ft: 1.81 }, { guard: 1.6 }, { guard: 12 },
      { fg: 0.8 }, { ct: 1 }, { L: 50, ct: 6, cg: 6 }, { he: 30, hm: 20 }, { n: 1 }, { n: 200 },
    ]
    let sound = 0
    for (const p of sets) for (const kerf of [0, 0.15, 0.2]) {
      const label = `${JSON.stringify(p)} kerf=${kerf}`
      const d = generate(tpl, p, { ...S0, kerf })
      if (d.errors.length) { expect(d.panels, label).toEqual([]); continue }
      sound++
      expect(d.panels, label).toHaveLength(1)
      const pn = d.panels[0], cut = cutLoops(pn)
      expect(cut, label).toHaveLength(1)
      expect(signedArea(cut[0]), label).toBeGreaterThan(0)
      const poly = samplePoly(cut[0], 15)
      for (const q of poly) expect(Number.isFinite(q.x) && Number.isFinite(q.y), label).toBe(true)
      expect(selfIntersects(poly), `${label} self-intersects`).toBe(false)
      for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; expect(Math.hypot(q.x - poly[i].x, q.y - poly[i].y), `${label} zero-length`).toBeGreaterThan(1e-6) }
      if (kerf === 0) {
        const q = { ...D0, ...p }, { teeth, gaps } = row(d, q.tl)
        expect(Math.min(...teeth), label).toBeGreaterThanOrEqual(MIN_TOOTH - 1e-9)
        expect(Math.min(...gaps), label).toBeGreaterThanOrEqual(MIN_GAP - 1e-9)
      }
      expect(d.pieceCount, label).toBe(Math.round(p.n ?? D0.n))
      expect(offSheet(d.layout), label).toEqual([])
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), label).toBe(false)
    }
    expect(sound).toBeGreaterThan(30)
  })

  it('refuses teeth thinner than 1.6 mm, gaps narrower than 1.2 mm as cut, and a comb too short for its teeth', () => {
    const err = (p: Record<string, number>, s = S0) => generate(tpl, p, s).errors.join(' | ')
    expect(err({ ft: 1.5 })).toMatch(/السنّ الناعم 1\.5 مم أرقّ من 1\.6/)
    expect(err({ ct: 1.5 })).toMatch(/السنّ العريض 1\.5 مم أرقّ من 1\.6/)
    expect(err({ guard: 1.5 })).toMatch(/سنّ الطرف 1\.5 مم أرقّ من 1\.6/)
    expect(err({ ft: 1.6, ct: 1.6, guard: 1.6 })).toBe('')
    expect(err({ fg: 1.1 })).toMatch(/الفراغ بين الأسنان الناعمة .* أضيق من 1\.2/)
    expect(err({ cg: 1.1 })).toMatch(/الفراغ بين الأسنان العريضة .* أضيق من 1\.2/)
    // the gaps that count are the ones after the row is spread over the length: asked 1.25, refused only where squeezed under 1.2
    let squeezed = 0, kept = 0
    for (let L = 60; L <= 200; L += 0.5) {
      const r = combRow(L, 4, 2.2, 1.25, 2.8, 2.2), narrow = r.fineGap < MIN_GAP
      expect(/أضيق من 1\.2/.test(err({ L, fg: 1.25 })), `L=${L}`).toBe(narrow)
      if (narrow) squeezed++; else kept++
    }
    expect(squeezed).toBeGreaterThan(0)
    expect(kept).toBeGreaterThan(0)
    // too short: four teeth of each kind at least, and the message gives the least length that works
    const short = err({ L: 60, ct: 4, cg: 4 })
    expect(short).toMatch(/المشط قصير/)
    const least = Number(/أقلّ طول (\d+) مم/.exec(short)![1])
    expect(least).toBe(Math.ceil(8 + 7 * 8))
    expect(err({ L: least, ct: 4, cg: 4 })).toBe('')
    expect(err({ L: least - 1, ct: 4, cg: 4 })).toMatch(/المشط قصير/)
    // the back must not dip in the middle, nor be thinner than 8 mm
    expect(err({ he: 30, hm: 20 })).toMatch(/أقلّ من الطرفين/)
    expect(err({ he: 6, hm: 24 })).toMatch(/ظهر المشط 6 مم/)
    // a kerf as wide as the gaps leaves the cut lines meeting
    expect(err({}, { ...S0, kerf: 1.4 })).toMatch(/عرض شقّ الليزر/)
  })

  it('starts every tooth and gap at the least that is cut, and each of those builds at the default length', () => {
    const def = (k: string) => tpl.params.find(d => d.key === k)!
    for (const k of ['ft', 'ct', 'guard']) expect(def(k).min, k).toBe(MIN_TOOTH)
    for (const k of ['fg', 'cg']) expect(def(k).min, k).toBe(MIN_GAP)
    for (const k of ['ft', 'ct', 'guard', 'fg']) expect(generate(tpl, { [k]: def(k).min }, S0).errors, k).toEqual([])
    // the coarse gap at its least is squeezed under 1.2 at 120 mm, but builds at the lengths where the row spreads it out
    const q: Record<string, number> = { ...D0, cg: MIN_GAP }
    const roomy = Array.from({ length: 501 }, (_, i) => 50 + i / 2).filter(L => { const r = combRow(L, q.guard, q.ft, q.fg, q.ct, q.cg); return r.nf >= 4 && r.nc >= 4 && Math.min(r.fineGap, r.coarseGap) >= MIN_GAP })
    expect(roomy.length).toBeGreaterThan(50)
    for (const L of roomy.filter((_, i) => i % 10 === 0)) expect(generate(tpl, { cg: MIN_GAP, L }, S0).errors, `L=${L}`).toEqual([])
  })

  it('counts the teeth as comb.py does: Python rounds halves to the even neighbour', () => {
    expect([pyRound(14.5), pyRound(15.5), pyRound(2.4), pyRound(2.6), pyRound(3)]).toEqual([14, 16, 2, 3, 3])
    expect(combRow(124, 4, 2, 2, 2.8, 2.2).nf).toBe(14) // 58 / 4 = 14.5 → 14, as comb.py gets
  })

  it('says what to cut it from, to sand the teeth, and that the name is engraved from RDWorks', () => {
    const d = generate(tpl, {}, S0), notes = d.notes.join(' ')
    expect(notes).toContain('أبلكاش')
    expect(notes).toContain('3 مم')
    expect(notes).toContain('MDF')
    expect(notes).toContain('نعّم الأسنان')
    expect(notes).toContain('RDWorks')
    expect(notes).toContain('السماح بتدوير القطع')
    expect(notes).toContain('اجعل الأسنان على اتجاه عروق الخشب')
    // the count of combs: the noun follows the last two digits
    expect([1, 2, 3, 10, 11, 99, 100, 101, 103, 110, 111, 200].map(combCount)).toEqual(['مشط واحد', 'مشطان', '3 أمشاط', '10 أمشاط', '11 مشطاً', '99 مشطاً', '100 مشط', '101 مشط', '103 أمشاط', '110 أمشاط', '111 مشطاً', '200 مشط'])
    expect(generate(tpl, { n: 200 }, S0).notes[0]).toMatch(/^200 مشط،/)
    expect(notes).toMatch(/^24 مشطاً،/)
    expect(d.panels[0].loops.some(l => l.layer === 'engrave')).toBe(false) // no text drawn: it is added in RDWorks
    expect(generate(tpl, {}, { ...S0, t: 6 }).warnings.join(' ')).toMatch(/الأنسب أبلكاش 3 مم/)
    expect(generate(tpl, {}, { ...S0, t: 2 }).warnings.join(' ')).toMatch(/تنكسر/)
  })
})
