import { describe, it, expect } from 'vitest'
import { CUBE_SETS, badgeLoop, cubeGeom } from './cubeset'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects } from './testutil'

const tpl = CUBE_SETS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type L = { closed: boolean; layer?: string; pts: { x: number; y: number; b?: number }[] }
const cut = (pn: { loops: L[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: { loops: L[] }) => cut(pn).filter(l => signedArea(l as never) < 0)
const outerOf = (pn: { loops: L[] }) => cut(pn).find(l => signedArea(l as never) > 0)!
const box = (l: L) => { const b = bbox([l as never]); return { x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY, w: b.maxX - b.minX, h: b.maxY - b.minY } }
const by = (d: ReturnType<typeof generate>, id: string) => d.panels.find(p => p.id === id)!

describe('the acrylic cube set on a tray', () => {
  it('builds at its defaults on the common sheets: six cubes, lids with lip frames, six badges, the tray', () => {
    for (const t of [2.7, 3, 3.2, 4]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort()).toEqual(['cube-back', 'cube-bottom', 'cube-front', 'cube-side', 'lid', 'lip-fb', 'lip-side', 'topper', 'tray-back', 'tray-bottom', 'tray-front', 'tray-side'])
      for (const id of ['cube-bottom', 'cube-front', 'cube-back']) { expect(by(d, id).count, id).toBe(6); expect(by(d, id).material, id).toBe('clear') }
      expect(by(d, 'cube-side').count).toBe(12)
      for (const id of ['lid', 'lip-fb', 'lip-side']) expect(by(d, id).material, id).toBe('white')
      expect(by(d, 'lid').count).toBe(6)
      expect(by(d, 'lip-fb').count).toBe(12)
      expect(by(d, 'topper').material).toBe('gold')
      expect(by(d, 'topper').count).toBe(6)
      for (const id of ['tray-bottom', 'tray-front', 'tray-back', 'tray-side']) expect(by(d, id).material, id).toBeUndefined()
      // the tray's inside holds the block of cubes with the play round it
      const base = by(d, 'tray-bottom')
      expect(base.w).toBeCloseTo(3 * 80 + 2 * 2 + 2 * 1 + 2 * t, 3)
      expect(base.h).toBeCloseTo(2 * 80 + 1 * 2 + 2 * 1 + 2 * t, 3)
      // a low tray, as in the photo: its walls hide about the bottom fifth of the cubes
      expect(by(d, 'tray-front').h).toBeCloseTo(18, 3)
      expect(d.notes.join(' ')).toMatch(/كلوروفورم|غراء أكريليك/)
    }
  })

  it('the lid: a plate the size of the cube, a lip frame that drops inside the walls with the clearance, the badge slot in the middle', () => {
    for (const t of [2.7, 3.2, 4]) for (const v of [{}, { a: 60, gap: 1 }, { a: 120, tm: 2 }, { tw: 20 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = cubeGeom(p, t), lid = by(d, 'lid')
      expect(lid.w, label).toBeCloseTo(p.a, 3)
      expect(lid.h, label).toBeCloseTo(p.a, 3)
      expect(by(d, 'lip-fb').w, label).toBeCloseTo(p.a - 2 * t - 2 * p.gap, 3)
      expect(by(d, 'lip-side').w, label).toBeCloseTo(p.a - 2 * t - 2 * p.gap, 3)
      expect(by(d, 'lip-fb').h, label).toBeCloseTo(g.lipH, 3)
      expect(g.lipH, label).toBeGreaterThanOrEqual(3 * t)
      const slots = holesOf(lid)
      expect(slots.length, label).toBe(1)
      const s = box(slots[0])
      expect(s.h, `${label} slot width`).toBeCloseTo((p.tm > 0 ? p.tm : t) + p.fit, 3)
      expect(s.w, `${label} slot length`).toBeCloseTo(g.ft + p.fit, 3)
      expect((s.x0 + s.x1) / 2, `${label} centred`).toBeCloseTo(p.a / 2, 3)
      // the badges stand in the middle of the lids in the photo (not at the back edge), the slot parallel to the front
      expect((s.y0 + s.y1) / 2, `${label} in the middle`).toBeCloseTo(p.a / 2, 3)
      expect(s.w, `${label} along the front`).toBeGreaterThan(s.h)
      // inside the lip frame with 2 mm to spare on every side (the foot pokes out under the plate there)
      const inner = 2 * t + p.gap
      expect(Math.min(s.x0, s.y0, p.a - s.x1, p.a - s.y1), `${label} clear of the lip`).toBeGreaterThanOrEqual(inner + 2 - 1e-9)
      // the badge's foot is the slot's size less the fit, and as tall as the plate plus a millimetre
      const top = by(d, 'topper'), o = outerOf(top).pts, yMax = Math.max(...o.map(q => q.y))
      const footPts = o.filter(q => Math.abs(q.y - yMax) < 1e-6)
      expect(footPts.length, label).toBe(2)
      expect(Math.abs(footPts[0].x - footPts[1].x), `${label} foot width`).toBeCloseTo(g.ft, 3)
      const body = o.filter(q => q.y < yMax - 1e-6)
      expect(yMax - Math.max(...body.map(q => q.y)), `${label} foot height`).toBeCloseTo(t + 1, 3)
      expect(top.w, `${label} badge width`).toBeCloseTo(p.tw, 2)
    }
  })

  it('every badge style is one clean outline: exactly as wide as asked, the body standing flat on its base line, the foot centred under it', () => {
    for (const style of [1, 2, 3]) for (const tw of [16, 34, 80]) for (const t of [2, 3.2, 6]) {
      const ft = Math.min(10, Math.max(4, 0.3 * tw)), fh = t + 1, label = `style=${style} tw=${tw} t=${t}`
      const b = badgeLoop(style, tw, ft, fh, Math.max(0.8, 0.04 * tw))
      expect(signedArea(b.loop), label).toBeGreaterThan(0)
      const poly = samplePoly(b.loop, 4)
      expect(selfIntersects(poly), `${label} self-intersects`).toBe(false)
      const bb = bbox([b.loop])
      expect(bb.maxX - bb.minX, `${label} width`).toBeCloseTo(tw, 2)
      expect(b.bodyH, label).toBeGreaterThan(0.5 * tw)
      expect(b.bodyH, label).toBeLessThan(1.1 * tw)
      // nothing of the body hangs below its base line (where it stands on the lid): only the foot is lower
      const base = bb.maxY - fh
      for (const q of poly) if (Math.abs(q.x - (bb.minX + bb.maxX) / 2) > ft / 2 + 1e-6) expect(q.y, `${label} body below the base`).toBeLessThanOrEqual(base + 1e-6)
      // the foot: two vertical edges ft apart, centred
      const foot = b.loop.pts.filter(q => Math.abs(q.y - bb.maxY) < 1e-6).map(q => q.x).sort((u, v) => u - v)
      expect(foot.length, label).toBe(2)
      expect(foot[1] - foot[0], label).toBeCloseTo(ft, 3)
      expect((foot[0] + foot[1]) / 2, `${label} foot centred`).toBeCloseTo((bb.minX + bb.maxX) / 2, 1)
      // no material tip sharper than a blunt horn: every vertex of the sampled outline keeps its neighbours apart
      for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; expect(Math.hypot(q.x - poly[i].x, q.y - poly[i].y), `${label} zero-length`).toBeGreaterThan(1e-6) }
    }
    // the three styles differ
    const ws = [1, 2, 3].map(s => badgeLoop(s, 34, 10, 4.2, 1.36).bodyH)
    expect(new Set(ws.map(v => Math.round(v))).size).toBe(3)
  })

  it('dividers: strips on tabs through base slots of their size, one tab under every cell, half-lap crossings at the cube boundaries', () => {
    for (const t of [2.7, 3.2, 4]) for (const v of [{ div: 1, gapC: 6 }, { div: 1, gapC: 6, rows: 3, cols: 4 }, { div: 1, gapC: 8, rows: 1, cols: 3 }, { div: 1, gapC: 8, rows: 2, cols: 1, a: 60 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = cubeGeom(p, t), base = by(d, 'tray-bottom'), slots = holesOf(base).map(box)
      const long = d.panels.find(x => x.id === 'div-long'), wide = d.panels.find(x => x.id === 'div-wide')
      expect(!!long, label).toBe(g.cols > 1)
      expect(!!wide, label).toBe(g.rows > 1)
      if (long) expect(long.count, label).toBe(g.cols - 1)
      if (wide) expect(wide.count, label).toBe(g.rows - 1)
      expect(slots.length, label).toBe((g.cols - 1) * g.rows + (g.rows - 1) * g.cols)
      for (const s of slots) {
        expect(Math.min(s.w, s.h), `${label} slot width`).toBeCloseTo(t + p.fit, 3)
        expect(Math.max(s.w, s.h), `${label} slot length`).toBeCloseTo(g.tl + p.fit, 3)
        // well inside the base: past the fingers with 2 mm to spare
        expect(Math.min(s.x0, s.y0, base.w - s.x1, base.h - s.y1), `${label} slot margin`).toBeGreaterThan(t + 2)
      }
      // a slot sits on every boundary between cubes, under the middle of the cell
      const cx = (k: number) => t + p.play + k * (p.a + p.gapC) + p.a / 2, bx = (j: number) => t + p.play + (j + 1) * p.a + j * p.gapC + p.gapC / 2
      for (let j = 0; j < g.cols - 1; j++) for (let k = 0; k < g.rows; k++) expect(slots.some(s => Math.abs((s.x0 + s.x1) / 2 - bx(j)) < 1e-3 && Math.abs((s.y0 + s.y1) / 2 - cx(k)) < 1e-3), `${label} long slot ${j},${k}`).toBe(true)
      for (let i = 0; i < g.rows - 1; i++) for (let k = 0; k < g.cols; k++) expect(slots.some(s => Math.abs((s.y0 + s.y1) / 2 - bx(i)) < 1e-3 && Math.abs((s.x0 + s.x1) / 2 - cx(k)) < 1e-3), `${label} wide slot ${i},${k}`).toBe(true)
      // each strip: tabs t tall on its bottom edge, as many as the cells it crosses, each as long as the slot less the fit
      for (const [strip, cells] of [[long, g.rows], [wide, g.cols]] as const) {
        if (!strip) continue
        const o = outerOf(strip).pts, yMax = Math.max(...o.map(q => q.y))
        const tabs: number[] = []
        for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.abs(a.y - yMax) < 1e-6 && Math.abs(b.y - yMax) < 1e-6) tabs.push(Math.abs(b.x - a.x)) }
        expect(tabs.length, `${label} ${strip.id} tabs`).toBe(cells)
        for (const w of tabs) expect(w, `${label} ${strip.id} tab length`).toBeCloseTo(g.tl, 3)
        expect(strip.h, `${label} ${strip.id} height`).toBeCloseTo(p.trayH - t + t, 3)
        // the strip fits between the walls with half a millimetre each end
        expect(strip.w, `${label} ${strip.id} length`).toBeCloseTo((strip.id === 'div-long' ? g.Di : g.Wi) - 1, 3)
      }
      // crossing slots: the long strips from the top, the wide ones from the bottom, each half the body deep and t + fit wide
      if (long && wide) {
        const o = outerOf(long).pts, yMin = Math.min(...o.map(q => q.y))
        const topNotches = o.filter((q, i) => Math.abs(q.y - yMin) > 1e-6 && Math.abs(o[(i + 1) % o.length].y - q.y) < 1e-6 && q.y < yMin + g.hd / 2 + 1e-6 && q.y > yMin + 1e-6)
        expect(topNotches.length, `${label} top notches`).toBe(g.rows - 1)
        expect(topNotches[0].y - yMin, `${label} notch depth`).toBeCloseTo(g.hd / 2, 3)
      }
      expect(d.notes.join(' '), label).toMatch(/الفواصل/)
    }
  })

  it('refuses with a clear Arabic instruction when the pieces cannot be cut or assembled', () => {
    const err = (v: Record<string, number>, t = 3.2) => generate(tpl, v, { ...S0, t }).errors.join(' | ')
    expect(err({ a: 40 }, 6)).toMatch(/شقّ اللافتة|ضلع/)
    expect(err({ a: 40, topper: 0 }, 6)).toBe('')
    expect(err({ h: 12 })).toMatch(/ارتفاع المكعّب/)
    expect(err({ lipH: 5 })).toMatch(/الشفة/)
    expect(err({ trayH: 10 }, 4)).toMatch(/الصينية/)
    expect(err({ div: 1 })).toMatch(/المسافة بين المكعّبات.*4\.5/)
    expect(err({ div: 1, gapC: 6 })).toBe('')
    expect(err({ div: 1, gapC: 6, trayH: 8 }, 2.7)).toMatch(/الصينية/)
    expect(err({ tm: 0.5 })).toMatch(/اللافتة/)
    // one cube and dividers on: nothing to divide, a warning only
    const d = generate(tpl, { div: 1, rows: 1, cols: 1 }, S0)
    expect(d.errors).toEqual([])
    expect(d.warnings.join()).toMatch(/فواصل/)
    expect(d.panels.some(p => p.id.startsWith('div'))).toBe(false)
  })

  it('a cube height of 0 means a true cube, a badge sheet of its own thickness sets the slot, n multiplies every count', () => {
    const d = generate(tpl, { h: 0, a: 70 }, S0)
    expect(by(d, 'cube-front').h).toBeCloseTo(70, 3)
    const d2 = generate(tpl, { h: 50, a: 70 }, S0)
    expect(by(d2, 'cube-front').h).toBeCloseTo(50, 3)
    expect(by(d2, 'cube-bottom').h).toBeCloseTo(70, 3)
    const d3 = generate(tpl, { tm: 2 }, S0)
    expect(box(holesOf(by(d3, 'lid'))[0]).h).toBeCloseTo(2.2, 3)
    expect(d3.notes.join(' ')).toMatch(/2 مم للافتات/)
    const d4 = generate(tpl, { n: 3, rows: 1, cols: 2 }, S0)
    expect(by(d4, 'cube-bottom').count).toBe(6)
    expect(by(d4, 'tray-bottom').count).toBe(3)
    expect(by(d4, 'tray-side').count).toBe(6)
    expect(by(d4, 'lip-side').count).toBe(12)
    const d5 = generate(tpl, { topper: 0 }, S0)
    expect(d5.panels.some(p => p.id === 'topper')).toBe(false)
    expect(holesOf(by(d5, 'lid')).length).toBe(0)
  })

  it('every error names a value on the field’s step that, once entered, clears it (3 × 3.2 used to ask for 9.6 and still refuse 9.6)', () => {
    // error text → the field its value belongs to
    const rules: [RegExp, string][] = [
      [/ارتفاع المكعّب .*يلزم ([\d.]+)/, 'h'], [/ارتفاع الشفة .*يلزم ([\d.]+)/, 'lipH'], [/كبّر الضلع إلى ([\d.]+)/, 'a'], [/ضلع المكعّب .*اجعله ([\d.]+)/, 'a'],
      [/ارتفاع الصينية .*اجعله ([\d.]+)/, 'trayH'], [/اجعل ارتفاعها ([\d.]+)/, 'trayH'], [/اجعلها ([\d.]+) مم على الأقل، أو أطفئ الفواصل/, 'gapC'], [/اجعل سماكته ([\d.]+)/, 'tm'],
    ]
    const cases: Record<string, number>[] = [{ h: 12 }, { h: 30, lipH: 30 }, { lipH: 5 }, { lipH: 4 }, { trayH: 10 }, { a: 40 }, { a: 40, tm: 10 }, { a: 45, gap: 2 }, { tm: 0.5 }, { div: 1 }, { div: 1, gapC: 3, trayH: 10 }, { div: 1, a: 40, gapC: 2 }, { a: 40, h: 20 }]
    let refusedOnce = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const v of cases) {
      let p: Record<string, number> = { ...v }, fixed = false
      for (let round = 0; round < 4 && !fixed; round++) {
        const errs = generate(tpl, p, { ...S0, t }).errors
        if (!errs.length) { fixed = true; break }
        if (round === 0) refusedOnce++
        // the generic too-thin-finger notice of generate() rides along with the design's own error that causes it
        const own = errs.filter(e => !/^أصابع التعشيق في|^أصبع الزاوية/.test(e))
        expect(own.length, `${JSON.stringify(p)} t=${t}: only ${errs.join(' | ')}`).toBeGreaterThan(0)
        for (const e of own) {
          const hit = rules.map(([re, key]) => [e.match(re), key] as const).find(([m]) => m)
          expect(hit, `${JSON.stringify(v)} t=${t}: no value to set in «${e}»`).toBeTruthy()
          const val = +hit![0]![1], def = tpl.params.find(q => q.key === hit![1])!
          expect(Math.abs(val / (def.step ?? 1) - Math.round(val / (def.step ?? 1))), `${e}: ${val} is off the field's step`).toBeLessThan(1e-6)
          expect(val, `${e}: beyond the field`).toBeLessThanOrEqual(def.max)
          p = { ...p, [hit![1]]: val }
        }
      }
      expect(fixed, `${JSON.stringify(v)} t=${t} → ${JSON.stringify(p)} still refused`).toBe(true)
    }
    expect(refusedOnce).toBeGreaterThan(40)
  })

  it('finger joints mate: along every joint exactly one of the two pieces fills the shared corner column', () => {
    const at = (pn: { loops: L[] }, x: number, y: number) => pointIn({ x, y }, samplePoly(outerOf(pn) as never, 10))
    for (const t of [2, 3.2, 6]) for (const v of [{}, { h: 120, a: 60 }, { lipH: 30, h: 100 }, { trayH: 40, rows: 1, cols: 4 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, d = generate(tpl, p, { ...S0, t }), label = `${JSON.stringify(v)} t=${t}`
      expect(d.errors, label).toEqual([])
      // [piece A, its column as a function of the position u along the joint, piece B, its column, joint length]
      const pairs: [string, (u: number) => [number, number], string, (u: number) => [number, number]][] = []
      for (const [pre, base] of [['cube', 'cube-bottom'], ['tray', 'tray-bottom']]) {
        const B = by(d, base), F = by(d, `${pre}-front`), S = by(d, `${pre}-side`)
        pairs.push([base, u => [u, t / 2], `${pre}-front`, u => [u, F.h - t / 2]])                  // base top edge ↔ front bottom
        pairs.push([base, u => [t / 2, u], `${pre}-side`, u => [u, S.h - t / 2]])                   // base left edge ↔ side bottom
        pairs.push([`${pre}-front`, u => [t / 2, u], `${pre}-side`, u => [t / 2, u]])              // front end ↔ side end, up the wall
        // the bottom t of that column is the base's own corner square, which neither wall reaches
        expect(at(B, t / 2, t / 2), `${label} ${base} corner`).toBe(true)
        expect(at(F, t / 2, F.h - t / 2) || at(S, t / 2, S.h - t / 2), `${label} ${pre} walls in the base's corner`).toBe(false)
      }
      pairs.push(['lip-fb', u => [t / 2, u], 'lip-side', u => [t / 2, u]])
      for (const [a, fa, b, fb] of pairs) {
        const A = by(d, a), Bp = by(d, b)
        const len = a.endsWith('bottom') ? (fa(0)[0] === t / 2 ? A.h : A.w) : Math.min(A.h, Bp.h) - (a.startsWith('lip') ? 0 : t)
        for (let k = 0; k < 97; k++) {
          const u = ((k + 0.5) / 97) * len
          const inA = at(A, ...fa(u)), inB = at(Bp, ...fb(u))
          // a finger boundary passes within 0.05 mm: skip, either answer is right there
          if (at(A, ...fa(u + 0.05)) !== inA || at(A, ...fa(u - 0.05)) !== inA) continue
          expect(inA !== inB, `${label} ${a} ↔ ${b} at ${u.toFixed(2)}`).toBe(true)
        }
      }
    }
  })

  it('notes: final assembly with or without dividers, several sets named; warnings for a tray that buries the cubes or outgrows the bed', () => {
    const d = generate(tpl, { div: 1, gapC: 6 }, S0)
    expect(d.notes.join(' ')).toMatch(/التجميع الأخير.*خانته/)
    expect(d.notes.join(' ')).toMatch(/الطولية .*أولاً/)
    expect(generate(tpl, {}, S0).notes.join(' ')).toMatch(/التجميع الأخير/)
    expect(generate(tpl, { n: 3 }, S0).notes.join(' ')).toMatch(/3 أطقم: 18 من المكعّبات/)
    expect(generate(tpl, { rows: 1, cols: 1 }, S0).notes[0]).toMatch(/^مكعّب أكريليك شفّاف/)
    expect(generate(tpl, {}, S0).warnings).toEqual([])
    expect(generate(tpl, { trayH: 50 }, S0).warnings.join()).toMatch(/أكثر من نصف ارتفاع المكعّب.*18 مم/)
    expect(generate(tpl, { cols: 6, a: 120 }, S0).warnings.join()).toMatch(/سرير آلتك/)
  })

  it('builds at its defaults in well under 150 ms', () => {
    for (let i = 0; i < 3; i++) generate(tpl, {}, { ...DEFAULT_SETTINGS, t: 3.2 })
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) generate(tpl, {}, { ...DEFAULT_SETTINGS, t: 3.2 })
    expect((performance.now() - t0) / 5).toBeLessThan(150)
  })

  it('robustness grid: every thickness, kerf and parameter extreme either refuses with an error or cuts sound geometry', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    // the dividers only fit with a wider gap: their extremes once more with room for them
    variants.push({ div: 1, gapC: 8 }, { div: 1, gapC: 8, rows: 4, cols: 6 }, { div: 1, gapC: 15, a: 150 }, { style: 2, tw: 80 }, { style: 3, tw: 16 }, { style: 3, tw: 80, a: 150 }, { div: 1, gapC: 6, a: 40, trayH: 80 })
    // and a few random combinations of three or four parameters at once (fixed seed), half of them with dividers
    let seed = 20261010
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    for (let i = 0; i < 16; i++) {
      const v: Record<string, number> = {}
      for (const def of [...tpl.params].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 2))) { const st = def.int ? 1 : def.step ?? 1; v[def.key] = Math.round(Math.round((def.min + rnd() * (def.max - def.min)) / st) * st * 1000) / 1000 }
      if (i % 2) { v.div = 1; v.gapC = Math.max(v.gapC ?? 0, 7.5) }
      variants.push(v)
    }
    let runs = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      runs++
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (e) { throw new Error(`${JSON.stringify(v)} t=${t} kerf=${kerf} threw: ${(e as Error).message}`) }
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${pn.id} non-finite`).toBe(true)
      if (d.errors.length) { refused++; continue }
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      for (const pn of d.panels) {
        expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
        const closed = cut(pn), outers = closed.filter(l => signedArea(l as never) > 0)
        expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
        const outer = samplePoly(outers[0] as never, 15)
        expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
        const hs = closed.filter(l => signedArea(l as never) < 0).map(h => ({ p: samplePoly(h as never, 20), b: bbox([h as never]) }))
        for (const h of hs) {
          expect(polysOverlap(h.p, outer) && !pointIn(h.p[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
          for (const q of h.p) expect(pointIn(q, outer), `${label} ${pn.id} hole vertex outside`).toBe(true)
          expect(polyDistance(h.p, outer), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
        }
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i].b, b = hs[j].b
          if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
          expect(polyDistance(hs[i].p, hs[j].p), `${label} ${pn.id} holes too close`).toBeGreaterThan(0.8 - 1e-9)
        }
        for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; expect(Math.hypot(q.x - outer[i].x, q.y - outer[i].y), `${label} ${pn.id} zero-length`).toBeGreaterThan(1e-6) }
      }
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
    }
    expect(runs).toBeGreaterThan(300)
    expect(refused).toBeLessThan(runs / 3)
  })
})
