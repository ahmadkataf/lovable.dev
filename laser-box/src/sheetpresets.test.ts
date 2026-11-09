import { describe, it, expect } from 'vitest'
import { PRESETS } from './sheetpresets-data'
import { bestPreset, presetsFor, placePreset, presetCounts, encodePieces, decodePieces, outlineSig, turnPanel, SheetPreset, PresetPiece } from './sheetpresets'
import { fillSheet, fillLayout, fillMore, FillPart } from './fillsheet'
import { checkSheet, rotatePanel, sampleLoop } from './nest'
import { generate, DEFAULT_SETTINGS, Settings } from './generate'
import { templateById } from './templates'
import { Loop, bbox, signedArea, turnLoops, circle, disc, polyLoop, arcInfo } from './geom'
import { Panel, buildPanel } from './joints'
import { Layout } from './layout'
import { toDXF } from './export'
import { MAIN } from './cost'

const S = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...o })
const ACRYLIC = { kerf: 0.1 }
const byId = (id: string) => PRESETS.find(p => p.id === id)!
const isCut = (l: Loop) => l.layer !== 'engrave' && l.pts.length > 1
const sheet = { w: 1220, h: 2440 }

/** the verified sheets: design, settings, material, and what the sheet delivers */
const CASES: { preset: string; tpl: string; params: Record<string, number>; s: Partial<Settings>; material: string; sets: number; extra?: number }[] = [
  { preset: 'engagestand-500-mirror-8', tpl: 'engagestand', params: {}, s: ACRYLIC, material: 'mirror', sets: 8 },
  { preset: 'engagestand-500-white-25', tpl: 'engagestand', params: {}, s: ACRYLIC, material: 'white', sets: 25 },
  { preset: 'engagestand-400-mirror-13', tpl: 'engagestand', params: { W: 400 }, s: ACRYLIC, material: 'mirror', sets: 13 },
  { preset: 'engagestand-400-white-40', tpl: 'engagestand', params: { W: 400 }, s: ACRYLIC, material: 'white', sets: 40 },
  { preset: 'hexringbox-clear-81', tpl: 'hexringbox', params: { lidType: 2, stop: 100 }, s: ACRYLIC, material: MAIN, sets: 81 },
  { preset: 'hexringbox-mirror-233', tpl: 'hexringbox', params: { lidType: 2, stop: 100 }, s: ACRYLIC, material: 'mirror', sets: 233 },
  { preset: 'hexringbox-mirror-206', tpl: 'hexringbox', params: { lidType: 2, stop: 100 }, s: ACRYLIC, material: 'mirror', sets: 206 },
  { preset: 'favorcarrier-14', tpl: 'favorcarrier', params: {}, s: ACRYLIC, material: MAIN, sets: 14 },
  { preset: 'favorcarrier-15-m4', tpl: 'favorcarrier', params: {}, s: { ...ACRYLIC, margin: 4 }, material: MAIN, sets: 15 },
  { preset: 'woodcomb-405', tpl: 'woodcomb', params: {}, s: { kerf: 0.15 }, material: MAIN, sets: 16, extra: 21 },
  { preset: 'incenselantern-12', tpl: 'incenselantern', params: {}, s: { ...ACRYLIC, t: 2 }, material: MAIN, sets: 12 },
]

const design = (tpl: string, params: Record<string, number>, s: Settings) => {
  const d = generate(templateById(tpl), params, s)
  expect(d.errors).toEqual([])
  return d
}
const mineOf = (panels: Panel[], material: string) => panels.filter(p => (p.material ?? MAIN) === material)

/** a DXF read back: every closed cut entity as a polygon (circles too) and how many entities are on the engrave layer */
function readDXF(text: string) {
  const L = text.split('\n'), pairs: [number, string][] = []
  for (let i = 0; i + 1 < L.length; i += 2) pairs.push([Number(L[i]), L[i + 1]])
  const polys: number[][] = []
  let engrave = 0
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i][0] !== 0) continue
    const kind = pairs[i][1]
    const grab = (j: number) => { const o: Record<number, string> = {}; for (; j < pairs.length && pairs[j][0] !== 0; j++) o[pairs[j][0]] = pairs[j][1]; return o }
    const o = grab(i + 1)
    if (kind === 'CIRCLE' || kind === 'LINE' || kind === 'POLYLINE') {
      if (o[8] === 'ENGRAVE') { engrave++; continue }
      if (!o[8]?.startsWith('CUT')) continue
    }
    if (kind === 'CIRCLE') {
      const cx = +o[10], cy = -o[20], r = +o[40]
      polys.push([...Array(24).keys()].flatMap(k => [cx + r * Math.cos((k * Math.PI) / 12), cy + r * Math.sin((k * Math.PI) / 12)]))
    } else if (kind === 'POLYLINE' && (+o[70] & 1) === 1) {
      const pts: { x: number; y: number; b?: number }[] = []
      let j = i + 1
      while (j < pairs.length && !(pairs[j][0] === 0 && pairs[j][1] === 'SEQEND')) {
        // y back down (the file is y up; its bulges are the app's)
        if (pairs[j][0] === 0 && pairs[j][1] === 'VERTEX') { const v = grab(j + 1); pts.push({ x: +v[10], y: -v[20], b: v[42] ? +v[42] : 0 }) }
        j++
      }
      polys.push(sampleLoop({ pts, closed: true }, 0.05))
    }
  }
  return { polys, engrave }
}

/** the pieces in a set of closed outlines: outlines inside an even number of others (a piece in a hole counts too) */
function countPieces(polys: number[][]): number {
  const bb = polys.map(P => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (let i = 0; i < P.length; i += 2) { a = Math.min(a, P[i]); c = Math.max(c, P[i]); b = Math.min(b, P[i + 1]); d = Math.max(d, P[i + 1]) } return [a, b, c, d] })
  const inside = (P: number[], x: number, y: number) => { let r = false; for (let i = 0, n = P.length / 2, j = n - 1; i < n; j = i++) { const xi = P[2 * i], yi = P[2 * i + 1], xj = P[2 * j], yj = P[2 * j + 1]; if ((yi > y) !== (yj > y) && x < xi + ((xj - xi) * (y - yi)) / (yj - yi)) r = !r } return r }
  const ord = polys.map((_, i) => i).sort((a, b) => bb[a][0] - bb[b][0])
  const depth = polys.map(() => 0)
  for (let u = 0; u < ord.length; u++) for (let v = 0; v < ord.length; v++) {
    const a = ord[u], b = ord[v]
    if (a === b) continue
    if (bb[b][0] > bb[a][0]) break
    // b contains a?
    if (bb[b][2] < bb[a][2] || bb[b][1] > bb[a][1] || bb[b][3] < bb[a][3]) continue
    if (inside(polys[b], polys[a][0], polys[a][1])) depth[a]++
  }
  return depth.filter(d => d % 2 === 0).length
}

/** everything a sheet from a preset promises, checked independently of the code that built it */
function validatePreset(part: FillPart | { sets: number; extra?: number; layout?: Layout; preset?: { id: string } }, panels: Panel[], c: typeof CASES[number], s: Settings) {
  const pr = byId(c.preset), mine = mineOf(panels, c.material)
  expect(part.preset?.id).toBe(c.preset)
  expect(part.sets).toBe(c.sets)
  expect(part.extra ?? 0).toBe(c.extra ?? 0)
  const lay = part.layout!
  // piece counts per panel: sets × the set's count (+ the loose ones)
  const loose = presetCounts(pr, mine).extra
  const want = mine.map((p, i) => p.count * c.sets + loose[i])
  const got = mine.map(p => lay.placed.filter(pl => pl.panel.id === p.id).length)
  expect(got).toEqual(want)
  const n = want.reduce((a, b) => a + b, 0)
  expect(lay.placed.length).toBe(n)
  // the exact check: clean (with the hole gap only where the preset declares it)
  expect(checkSheet(lay.placed, sheet.w, sheet.h, s.spacing, s.margin, undefined, pr.holeGap ? { holeGap: pr.holeGap } : {})).toEqual([])
  // every cut inside the margin, every line on the sheet
  for (const pl of lay.placed) {
    const cb = bbox(pl.panel.loops.filter(isCut)), all = bbox(pl.panel.loops)
    expect(cb.minX + pl.x).toBeGreaterThanOrEqual(s.margin - 0.002)
    expect(cb.minY + pl.y).toBeGreaterThanOrEqual(s.margin - 0.002)
    expect(cb.maxX + pl.x).toBeLessThanOrEqual(sheet.w - s.margin + 0.002)
    expect(cb.maxY + pl.y).toBeLessThanOrEqual(sheet.h - s.margin + 0.002)
    expect(all.minX + pl.x).toBeGreaterThanOrEqual(0)
    expect(all.maxY + pl.y).toBeLessThanOrEqual(sheet.h)
  }
  // no piece mirrored: each placed shape is its panel turned by its angle (every point, up to a shift), and keeps its
  // outline's sense (a mirror image would turn it round)
  const seen = new Set<Panel>()
  for (const pl of lay.placed) {
    if (seen.has(pl.panel)) continue
    seen.add(pl.panel)
    const src = mine.find(p => p.id === pl.panel.id)!, t = turnLoops(src.loops, pl.rot ?? 0)
    const dx = pl.panel.loops[0].pts[0].x - t[0].pts[0].x, dy = pl.panel.loops[0].pts[0].y - t[0].pts[0].y
    pl.panel.loops.forEach((l, i) => l.pts.forEach((v, k) => { expect(Math.abs(v.x - t[i].pts[k].x - dx)).toBeLessThan(1e-9); expect(Math.abs(v.y - t[i].pts[k].y - dy)).toBeLessThan(1e-9); expect(v.b ?? 0).toBe(t[i].pts[k].b ?? 0) }))
    pl.panel.loops.forEach((l, i) => { if (l.closed && isCut(l)) expect(Math.sign(signedArea(l))).toBe(Math.sign(signedArea(src.loops[i]))) })
  }
  // the DXF: exactly the closed cut outlines of all those pieces, and that many pieces read back from it
  const dxf = readDXF(toDXF(lay))
  expect(dxf.polys.length).toBe(lay.placed.reduce((a, pl) => a + pl.panel.loops.filter(l => l.closed && isCut(l)).length, 0))
  expect(countPieces(dxf.polys)).toBe(n)
  expect(dxf.engrave).toBe(lay.placed.reduce((a, pl) => a + pl.panel.loops.filter(l => l.layer === 'engrave').length, 0))
}

/** the mirror sheet's side frames that sit in a lid frame's window (box inside box), and those lid frames */
function inWindows(lay: Layout) {
  const box = (i: number) => { const pl = lay.placed[i]; return [pl.x, pl.y, pl.x + pl.panel.w, pl.y + pl.panel.h] }
  const lids = lay.placed.map((_, i) => i).filter(i => lay.placed[i].panel.id === 'lid-frame')
  const framesIn = new Set<number>(), hosts = new Set<number>()
  lay.placed.forEach((pl, i) => {
    if (pl.panel.id !== 'frame') return
    const f = box(i)
    const h = lids.find(j => { const b = box(j); return f[0] > b[0] && f[1] > b[1] && f[2] < b[2] && f[3] < b[3] })
    if (h !== undefined) { framesIn.add(i); hosts.add(h) }
  })
  return { framesIn, hosts }
}

describe('saved full-sheet layouts', () => {
  for (const c of CASES) {
    it(`${c.preset}: ${c.sets}${c.extra ? ' sets + ' + c.extra : ''}, checked, every piece where it belongs`, () => {
      const s = S(c.s), d = design(c.tpl, c.params, s)
      // the 206 sheet is what the mirror falls back to when the 233 is not used
      const presets = c.preset === 'hexringbox-mirror-206' ? PRESETS.filter(p => p.id !== 'hexringbox-mirror-233') : PRESETS
      const r = fillSheet(d.panels, s, { presets, budgetMs: 2000 })
      const part = r.parts.find(p => p.material === c.material)!
      validatePreset(part, d.panels, c, s)
      // more than the nesting's rows count (the comb: the loose combs on top of the same sets); at a 4 mm margin the
      // rows already reach the favours box's 15
      const got = part.sets * part.pieces + (part.extra ?? 0)
      if (c.preset === 'favorcarrier-15-m4') expect(got).toBeGreaterThanOrEqual(part.estimate * part.pieces)
      else expect(got).toBeGreaterThan(part.estimate * part.pieces)
    })
  }

  it('the mirror frames: 233 (a side frame in every lid frame window) wins over 206, and says why', () => {
    const s = S(ACRYLIC), d = design('hexringbox', { lidType: 2, stop: 100 }, s)
    const mine = mineOf(d.panels, 'mirror')
    expect(presetsFor(mine, sheet, s).map(p => p.id)).toEqual(['hexringbox-mirror-233', 'hexringbox-mirror-206'])
    const fit = bestPreset(mine, sheet, s)!
    expect(fit.preset.id).toBe('hexringbox-mirror-233')
    expect(fit.preset.hint).toMatch(/233 بدل 206/)
    // the gap in the windows as measured on these pieces (the preset declares 2.6 as the least it may be)
    expect(fit.holeGap).toBeCloseTo(2.632, 2)
    // only the frames in the windows are closer than the spacing: at the full spacing exactly those 233 pairs fail
    const { framesIn, hosts } = inWindows(fit.layout)
    expect(framesIn.size).toBe(233)
    const strict = checkSheet(fit.layout.placed, sheet.w, sheet.h, 3, 5)
    expect(strict).toHaveLength(233)
    expect(strict.every(i => framesIn.has(i) || hosts.has(i))).toBe(true)
    // and not one is closer than 2.6 mm
    expect(checkSheet(fit.layout.placed, sheet.w, sheet.h, 2.6, 5)).toEqual([])
  })

  it('every material of the stand and the ring box filled at once, and the phone\'s single DXF holds them all', () => {
    for (const [tpl, params, counts] of [['hexringbox', { lidType: 2, stop: 100 }, [81, 233]], ['engagestand', {}, [8, 25]], ['incenselantern', {}, [12]]] as const) {
      const s = S({ ...ACRYLIC, ...(tpl === 'incenselantern' ? { t: 2 } : {}) }), d = design(tpl, params, s)
      const r = fillSheet(d.panels, s)
      expect(r.parts.map(p => p.sets)).toEqual(counts)
      expect(r.parts.every(p => p.preset)).toBe(true)
      // the share of the sheet inside the outlines counts a frame in a window (a spacer in a collar) once, not twice
      if (tpl === 'hexringbox') { expect(r.parts[0].use).toBeCloseTo(0.791, 2); expect(r.parts[1].use).toBeCloseTo(0.845, 2) }
      const all = fillLayout(r)
      const n = r.parts.reduce((a, p) => a + p.sets * p.pieces, 0)
      expect(all.placed.length).toBe(n)
      expect(countPieces(readDXF(toDXF(all)).polys)).toBe(n)
      all.sheets!.forEach((sh, i) => {
        const on = all.placed.filter(pl => pl.sheet === i).map(pl => ({ panel: pl.panel, x: pl.x - sh.x, y: pl.y - sh.y }))
        const hg = r.parts[i].preset?.holeGap
        expect(checkSheet(on, sh.w, sh.h, s.spacing, s.margin, undefined, hg ? { holeGap: hg } : {})).toEqual([])
      })
    }
  })

  it('the favours box at a 5 mm margin: 14, and a hint that a 4 mm margin gives 15', () => {
    const s = S(ACRYLIC), d = design('favorcarrier', {}, s)
    const p = fillSheet(d.panels, s).parts[0]
    expect(p).toMatchObject({ sets: 14, preset: { id: 'favorcarrier-14' } })
    expect(p.preset!.hint).toMatch(/4 مم/)
    expect(p.preset!.hint).toMatch(/15/)
  })

  it('the comb: 405 combs = 16 sets of 24 + 21, teeth along the grain (half turns only), also with turning off, which it says', () => {
    for (const rotate of [true, false]) {
      const s = S({ kerf: 0.15, rotate }), d = design('woodcomb', {}, s)
      const p = fillSheet(d.panels, s).parts[0]
      expect(p).toMatchObject({ sets: 16, extra: 21, pieces: 24, preset: { id: 'woodcomb-405', unit: 'مشط' } })
      expect(p.sets * p.pieces + p.extra!).toBe(405)
      expect(p.layout!.placed.every(pl => pl.rot === 0 || pl.rot === 180)).toBe(true)
      // turning off: the result counts the half-turned combs (198 of 405); turning on: nothing to say
      expect(p.preset!.halfTurned).toBe(rotate ? undefined : 198)
      expect(p.layout!.placed.filter(pl => pl.rot === 180)).toHaveLength(198)
      // more than the cost box's count in the unit shown (combs): 405 against its 16 (turning off 15) sets of 24
      expect(fillMore(p)).toBe(405 - p.estimate * 24)
      expect(fillMore(p)).toBeGreaterThan(0)
    }
    // the lantern's shelves at 2 mm too: 21 of its 192 pieces half turned, said with turning off
    const s = S({ ...ACRYLIC, t: 2, rotate: false }), p = fillSheet(design('incenselantern', {}, s).panels, s).parts[0]
    expect(p).toMatchObject({ sets: 12, preset: { id: 'incenselantern-12', halfTurned: 21 } })
  })

  it('the comb at any count per set: the 405 combs divide into sets of that many, the rest loose', () => {
    const s = S({ kerf: 0.15 }), c = CASES.find(k => k.preset === 'woodcomb-405')!
    for (const [n, sets, extra] of [[1, 405, 0], [5, 81, 0], [7, 57, 6], [24, 16, 21], [200, 2, 5]] as const) {
      const d = design('woodcomb', { n }, s)
      expect(d.panels).toHaveLength(1)
      expect(d.panels[0].count).toBe(n)
      const p = fillSheet(d.panels, s, { budgetMs: 1000 }).parts[0]
      expect(p.sets * n + (p.extra ?? 0)).toBe(405)
      validatePreset(p, d.panels, { ...c, sets, extra }, s)
    }
  })

  it('a preset whose data cannot be read is skipped: the next preset, or the nesting; never an error', () => {
    const s = S(ACRYLIC), d = design('favorcarrier', {}, s), fav = byId('favorcarrier-14')
    const broken = [fav.pieces.slice(0, -3), fav.pieces + 'A', '*' + fav.pieces, fav.pieces.slice(0, 5) + '*' + fav.pieces.slice(5), '', 'z'.repeat(40), 'A_____________']
    for (const pieces of broken) {
      expect(() => decodePieces(pieces)).toThrow()
      const bad = { ...fav, id: 'broken', pieces }
      for (const rotate of [true, false]) {
        const so = { ...s, rotate }
        expect(presetsFor(d.panels, sheet, so, [bad])).toEqual([])
        expect(bestPreset(d.panels, sheet, so, [bad])).toBeNull()
        expect(placePreset(bad, d.panels)).toBeNull()
        // the next one still applies
        expect(bestPreset(d.panels, sheet, so, [bad, fav])?.preset.id).toBe(rotate ? 'favorcarrier-14' : undefined)
        const r = fillSheet(d.panels, so, { presets: [bad], budgetMs: 600 })
        expect(r.parts[0].preset).toBeUndefined()
        expect(r.parts[0].sets).toBeGreaterThanOrEqual(r.parts[0].estimate)
        expect(r.parts[0].sets).toBeGreaterThan(0)
      }
    }
  })

  it('the mirror\'s 2.63 mm in the windows (as measured) is said, and the spacing everywhere (206) can be asked for, and undone', () => {
    const s = S(ACRYLIC), d = design('hexringbox', { lidType: 2, stop: 100 }, s)
    const near = fillSheet(d.panels, s).parts.find(p => p.material === 'mirror')!
    expect(near).toMatchObject({ sets: 233, preset: { id: 'hexringbox-mirror-233' } })
    expect(near.preset!.holeGap).toBeCloseTo(2.632, 2)
    // the hint names no gap: the result says the measured one (a narrower frame leaves more room, below)
    expect(near.preset!.hint).toMatch(/233 بدل 206/)
    expect(near.preset!.hint).not.toMatch(/\d مم/)
    expect(near.closer).toBeUndefined()
    const r = fillSheet(d.panels, s, { strict: true })
    expect(r.strict).toBe(true)
    const far = r.parts.find(p => p.material === 'mirror')!
    expect(far).toMatchObject({ sets: 206, preset: { id: 'hexringbox-mirror-206' }, closer: { sets: 233 } })
    expect(far.closer!.holeGap).toBeCloseTo(2.632, 2)
    expect(far.preset!.holeGap).toBeUndefined()
    // 3 mm everywhere, holes too
    expect(checkSheet(far.layout!.placed, sheet.w, sheet.h, 3, 5)).toEqual([])
    // the clear sheet has no such choice
    expect(r.parts[0]).toMatchObject({ sets: 81, preset: { id: 'hexringbox-clear-81' } })
    expect(r.parts[0].closer).toBeUndefined()
    // at a 2.5 mm spacing 2.6 mm in the windows is no exception: 233 either way, nothing to say
    const s25 = S({ ...ACRYLIC, spacing: 2.5 })
    for (const strict of [false, true]) {
      const m = fillSheet(d.panels, s25, { strict }).parts.find(p => p.material === 'mirror')!
      expect(m).toMatchObject({ sets: 233, preset: { id: 'hexringbox-mirror-233' } })
      expect(m.preset!.holeGap).toBeUndefined()
      expect(m.closer).toBeUndefined()
    }
  })

  it('a narrower lid frame (wider windows) keeps 3 mm in them: the 233 with nothing to say, strict too; in between, the gap as measured', () => {
    const s = S(ACRYLIC)
    for (const b of [4.5, 4, 3.5]) {
      const d = design('hexringbox', { lidType: 2, stop: 100, b }, s), mine = mineOf(d.panels, 'mirror')
      // the frame width changes only the lid frame's window: the outer outlines, and so the match, stay
      expect(presetsFor(mine, sheet, { ...s, holeGap: false }).map(p => p.id)).toEqual(['hexringbox-mirror-233', 'hexringbox-mirror-206'])
      for (const holeGap of [true, false]) {
        const fit = bestPreset(mine, sheet, { ...s, holeGap })!
        expect(fit.preset.id).toBe('hexringbox-mirror-233')
        expect(fit.holeGap).toBeUndefined()
      }
      for (const strict of [false, true]) {
        const m = fillSheet(d.panels, s, { strict, budgetMs: 600 }).parts.find(p => p.material === 'mirror')!
        expect(m).toMatchObject({ sets: 233, preset: { id: 'hexringbox-mirror-233' } })
        expect(m.preset!.holeGap).toBeUndefined()
        expect(m.closer).toBeUndefined()
        // 3 mm everywhere, the windows too
        expect(checkSheet(m.layout!.placed, sheet.w, sheet.h, 3, 5)).toEqual([])
      }
    }
    // b = 4.8: 2.83 mm in the windows, still below 3: said as measured (not the preset's 2.6), and 206 in strict mode
    const d = design('hexringbox', { lidType: 2, stop: 100, b: 4.8 }, s)
    const near = fillSheet(d.panels, s, { budgetMs: 600 }).parts.find(p => p.material === 'mirror')!
    expect(near.preset!.id).toBe('hexringbox-mirror-233')
    expect(near.preset!.holeGap).toBeCloseTo(2.831, 2)
    const far = fillSheet(d.panels, s, { strict: true, budgetMs: 600 }).parts.find(p => p.material === 'mirror')!
    expect(far).toMatchObject({ sets: 206, preset: { id: 'hexringbox-mirror-206' }, closer: { sets: 233 } })
    expect(far.closer!.holeGap).toBeCloseTo(2.831, 2)
    // a wider frame (narrower windows) is too tight even for the hole gap: 206 either way
    const tight = design('hexringbox', { lidType: 2, stop: 100, b: 5.2 }, s)
    for (const strict of [false, true]) {
      const m = fillSheet(tight.panels, s, { strict, budgetMs: 600 }).parts.find(p => p.material === 'mirror')!
      expect(m).toMatchObject({ sets: 206, preset: { id: 'hexringbox-mirror-206' } })
      expect(m.closer).toBeUndefined()
    }
  })

  it('turning off: a preset that turns pieces a quarter (or 45°) is not used', () => {
    const s = S({ ...ACRYLIC, rotate: false }), d = design('engagestand', { W: 400 }, s)
    expect(presetsFor(mineOf(d.panels, 'white'), sheet, s)).toEqual([])
    expect(presetsFor(mineOf(d.panels, 'mirror'), sheet, s)).toEqual([])
  })

  it('names and poem on the stand (engraved, or cut inside the panel) keep the preset; the file carries them', () => {
    const s = S(ACRYLIC), d = design('engagestand', {}, s)
    // the app does not draw the stand's text (it is added in RDWorks): no parameter for it, so it can never change the
    // pieces. Were it drawn, it would lie inside the white panel: engraved lines, or letters cut through it
    expect(templateById('engagestand').params.map(p => p.key)).toEqual(['W', 'sw', 'sg', 'hearts', 'tm', 'fit'])
    const names: Loop[] = [
      { closed: false, layer: 'engrave', pts: [{ x: 60, y: 150 }, { x: 230, y: 150 }] },
      { closed: true, layer: 'engrave', pts: [{ x: 80, y: 180 }, { x: 210, y: 180 }, { x: 210, y: 200 }, { x: 80, y: 200 }] },
      polyLoop([{ x: 120, y: 230 }, { x: 120, y: 250 }, { x: 170, y: 250 }, { x: 170, y: 230 }], 'hole'),
    ]
    const panels = d.panels.map(p => (p.id === 'panel' ? { ...p, loops: [...p.loops, ...names] } : p))
    expect(outlineSig(mineOf(panels, 'white'))).toEqual(outlineSig(mineOf(d.panels, 'white')))
    const r = fillSheet(panels, s)
    const white = r.parts.find(p => p.material === 'white')!
    expect(white).toMatchObject({ sets: 25, preset: { id: 'engagestand-500-white-25' } })
    validatePreset(white, panels, CASES[1], s)
    expect(readDXF(toDXF(white.layout!)).engrave).toBe(2 * 25)
  })

  it('another size (W 450) or another kerf falls back to the nesting', () => {
    const s = S(ACRYLIC)
    for (const [tpl, params, so] of [['engagestand', { W: 450 }, {}], ['engagestand', {}, { kerf: 0.15 }], ['hexringbox', { lidType: 2, stop: 100 }, { kerf: 0.2 }], ['incenselantern', {}, { t: 3, kerf: 0.1 }]] as const) {
      const ss = { ...s, ...so }, d = design(tpl, params, ss)
      for (const m of new Set(d.panels.map(p => p.material ?? MAIN))) expect(presetsFor(mineOf(d.panels, m), sheet, ss)).toEqual([])
      const r = fillSheet(d.panels, ss, { budgetMs: 600 })
      for (const p of r.parts) { expect(p.preset).toBeUndefined(); expect(p.sets).toBeGreaterThanOrEqual(p.estimate) }
    }
  })

  it('a larger margin or spacing, or another sheet, than the preset keeps: not used', () => {
    const d = design('incenselantern', {}, S({ ...ACRYLIC, t: 2 })), mine = d.panels
    expect(presetsFor(mine, sheet, { margin: 5, spacing: 3 }).map(p => p.id)).toEqual(['incenselantern-12'])
    expect(presetsFor(mine, sheet, { margin: 6, spacing: 3 })).toEqual([])
    expect(presetsFor(mine, sheet, { margin: 5, spacing: 3.5 })).toEqual([])
    expect(presetsFor(mine, { w: 1220, h: 2400 }, { margin: 5, spacing: 3 })).toEqual([])
    // smaller ones are fine (the check confirms it)
    expect(bestPreset(mine, sheet, { margin: 2, spacing: 2 })?.preset.id).toBe('incenselantern-12')
  })

  it('a corrupted preset (one piece shifted) fails the exact check and is dropped: the next preset, or the nesting', () => {
    const shift = (pr: SheetPreset, i: number, dx: number, dy: number): SheetPreset => {
      const list = decodePieces(pr.pieces)
      list[i] = [list[i][0], list[i][1], list[i][2] + dx, list[i][3] + dy]
      return { ...pr, pieces: encodePieces(list) }
    }
    // the favours box: a box pushed 2 mm into its neighbour's 3 mm gap
    const s = S(ACRYLIC), d = design('favorcarrier', {}, s), fav = byId('favorcarrier-14')
    const list = decodePieces(fav.pieces)
    const neighbour = (i: number) => list.findIndex((q, j) => j !== i && Math.abs(q[2] - list[i][2]) > 100 && Math.abs(q[3] - list[i][3]) < 1 && q[1] === list[i][1])
    const i = list.findIndex((_, k) => neighbour(k) >= 0), j = neighbour(i)
    const bad = shift(fav, i, Math.sign(list[j][2] - list[i][2]) * 2, 0)
    expect(placePreset(bad, d.panels)).not.toBeNull()
    expect(checkSheet(placePreset(bad, d.panels)!.placed, 1220, 2440, 3, 5).length).toBeGreaterThan(0)
    const r = fillSheet(d.panels, s, { presets: [bad], budgetMs: 1500 })
    expect(r.parts[0].preset).toBeUndefined()
    expect(r.parts[0].sets).toBeGreaterThanOrEqual(r.parts[0].estimate)
    expect(r.parts[0].sets).toBeLessThan(14)
    // a piece pushed off the margin is caught too
    const off = shift(fav, 0, -10, -10)
    expect(bestPreset(d.panels, sheet, s, [off])).toBeNull()
    // the mirror's 233 with a frame moved 1 mm toward its window's edge (1.6 mm left): 206 is used instead
    const h = design('hexringbox', { lidType: 2, stop: 100 }, s), mirror = mineOf(h.panels, 'mirror'), w233 = byId('hexringbox-mirror-233')
    // (placePreset keeps the decoded order: placed[k] is piece k)
    const k = [...inWindows(placePreset(w233, mirror)!).framesIn][0]
    const bad233 = shift(w233, k, 1, 1)
    expect(bestPreset(mirror, sheet, s, [bad233, byId('hexringbox-mirror-206')])?.preset.id).toBe('hexringbox-mirror-206')
    expect(bestPreset(mirror, sheet, s, [bad233])).toBeNull()
  })

  it('a preset whose counts do not fit the panels is not placed', () => {
    const d = design('favorcarrier', {}, S(ACRYLIC))
    expect(placePreset({ ...byId('favorcarrier-14'), sets: 15 }, d.panels)).toBeNull()
  })

  it('checking 1631 pieces is quick (well under the 2 s a phone may take for the whole fill)', () => {
    const s = S(ACRYLIC), d = design('hexringbox', { lidType: 2, stop: 100 }, s), mine = mineOf(d.panels, 'mirror')
    const t0 = performance.now()
    const fit = bestPreset(mine, sheet, s)!
    const ms = performance.now() - t0
    expect(fit.layout.placed).toHaveLength(1631)
    expect(ms).toBeLessThan(500)
  })
})

describe('the hole gap: a piece inside another piece\'s hole may be closer, only when asked', () => {
  const T = { t: 3, finger: 9 }
  // a 100 mm square frame with a 60 mm square window (20 … 80), and a 50 mm square piece
  const frame = buildPanel({ id: 'frame', name: 'frame', w: 100, h: 100, holes: [polyLoop([{ x: 20, y: 20 }, { x: 20, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 20 }], 'hole')] }, T)
  const small = buildPanel({ id: 'small', name: 'small', w: 50, h: 50 }, T)
  const at = (x: number, y: number) => ({ panel: small, x, y })
  const F = { panel: frame, x: 10, y: 10 }

  it('in the window 2.8 mm from its edge: wrong at the spacing, right with a 2.6 mm hole gap', () => {
    // the window spans 30 … 90 on the sheet; the piece 32.8 … 82.8
    expect(checkSheet([F, at(32.8, 32.8)], 300, 300, 3, 5)).toEqual([1])
    expect(checkSheet([F, at(32.8, 32.8)], 300, 300, 3, 5, undefined, { holeGap: 2.6 })).toEqual([])
    // whichever is listed first
    expect(checkSheet([at(32.8, 32.8), F], 300, 300, 3, 5, undefined, { holeGap: 2.6 })).toEqual([])
    // closer than the hole gap is still wrong
    expect(checkSheet([F, at(32.5, 35)], 300, 300, 3, 5, undefined, { holeGap: 2.6 })).toEqual([1])
  })

  it('outside the frame 2.8 mm from it: wrong with or without the hole gap', () => {
    expect(checkSheet([F, at(112.8, 10)], 300, 300, 3, 5, undefined, { holeGap: 2.6 })).toEqual([1])
    expect(checkSheet([F, at(113, 10)], 300, 300, 3, 5, undefined, { holeGap: 2.6 })).toEqual([])
  })

  it('across the window\'s edge, or on the frame\'s material: wrong', () => {
    expect(checkSheet([F, at(20, 40)], 300, 300, 3, 5, undefined, { holeGap: 2.6 })).toEqual([1])
    const tiny = buildPanel({ id: 'tiny', name: 'tiny', w: 4, h: 4 }, T)
    expect(checkSheet([F, { panel: tiny, x: 13, y: 50 }], 300, 300, 3, 5, undefined, { holeGap: 0.5 })).toEqual([1])
  })

  it('the gap in a hole measured: the least distance there, when below the spacing; nothing else is measured', () => {
    const m = () => ({ holeGap: Infinity })
    for (const pcs of [[F, at(32.8, 32.8)], [at(32.8, 32.8), F]]) {
      const a = m()
      expect(checkSheet(pcs, 300, 300, 3, 5, undefined, { holeGap: 2.6, measure: a })).toEqual([])
      expect(a.holeGap).toBeCloseTo(2.8, 6)
    }
    // measured without the hole gap too, and still wrong
    const b = m()
    expect(checkSheet([F, at(32.8, 32.8)], 300, 300, 3, 5, undefined, { measure: b })).toEqual([1])
    expect(b.holeGap).toBeCloseTo(2.8, 6)
    // the least of several
    const c = m(), small2 = buildPanel({ id: 's2', name: 's2', w: 20, h: 20 }, T)
    const F2 = { panel: frame, x: 150, y: 10 }
    expect(checkSheet([F, at(32.8, 32.8), F2, { panel: small2, x: 172.7, y: 50 }], 300, 300, 3, 5, undefined, { holeGap: 2.6, measure: c })).toEqual([])
    expect(c.holeGap).toBeCloseTo(2.7, 6)
    // 5 mm from the window: nothing below the spacing, left as it was
    const e = m()
    expect(checkSheet([F, at(35, 35)], 300, 300, 3, 5, undefined, { holeGap: 2.6, measure: e })).toEqual([])
    expect(e.holeGap).toBe(Infinity)
    // outside the frame is no hole: not measured, and wrong
    const f = m()
    expect(checkSheet([F, at(112.8, 10)], 300, 300, 3, 5, undefined, { holeGap: 2.6, measure: f })).toEqual([1])
    expect(f.holeGap).toBe(Infinity)
  })

  it('a hole gap no smaller than the spacing changes nothing', () => {
    expect(checkSheet([F, at(32.8, 32.8)], 300, 300, 3, 5, undefined, { holeGap: 3 })).toEqual([1])
    expect(checkSheet([F, at(32.8, 32.8)], 300, 300, 2.5, 5, undefined, { holeGap: 2.6 })).toEqual([])
  })

  it('a round hole: a disc inside a ring', () => {
    const ring = buildPanel({ id: 'ring', name: 'ring', w: 100, h: 100, shape: [disc(50, 50, 50)], holes: [circle(50, 50, 35)] }, T)
    const dsk = buildPanel({ id: 'disc', name: 'disc', w: 64, h: 64, shape: [disc(32, 32, 32)] }, T)
    // the hole has radius 35, the disc 32: 3 mm all round when centred; 0.4 mm off centre leaves 2.6
    const R = { panel: ring, x: 0, y: 0 }
    expect(checkSheet([R, { panel: dsk, x: 18, y: 18 }], 300, 300, 3, 0)).toEqual([])
    expect(checkSheet([R, { panel: dsk, x: 18.4, y: 18 }], 300, 300, 3, 0)).toEqual([1])
    expect(checkSheet([R, { panel: dsk, x: 18.4, y: 18 }], 300, 300, 3, 0, undefined, { holeGap: 2.5 })).toEqual([])
    const g = { holeGap: Infinity }
    expect(checkSheet([R, { panel: dsk, x: 18.4, y: 18 }], 300, 300, 3, 0, undefined, { holeGap: 2.5, measure: g })).toEqual([])
    expect(Math.abs(g.holeGap - 2.6)).toBeLessThan(0.01)
  })
})

describe('turning by any angle, and the packed placements', () => {
  it('quarter turns are exactly rotatePanel\'s; 45°: points turn, bulges stay, circles keep their radius, engraving turns along', () => {
    const d = generate(templateById('favorcarrier'), {}, S(ACRYLIC))
    const box = d.panels[0]
    for (const k of [1, 2, 3]) {
      const a = turnPanel(box, 90 * k).panel, b = rotatePanel(box, k)
      a.loops.forEach((l, i) => l.pts.forEach((v, j) => { const u = b.loops[i].pts[j]; expect(v.x - u.x).toBe(0); expect(v.y - u.y).toBe(0); expect(v.b).toBe(u.b) }))
      expect(a.w - b.w).toBe(0); expect(a.h - b.h).toBe(0)
    }
    const e = generate(templateById('engagestand'), { W: 400 }, S(ACRYLIC))
    const heart = e.panels.find(p => p.id === 'heart-white')!
    const c45 = { ...heart, loops: [...heart.loops, circle(20, 15, 4), { closed: false, layer: 'engrave' as const, pts: [{ x: 5, y: 5 }, { x: 30, y: 5 }] }] }
    const t = turnLoops(c45.loops, 45)
    const r = Math.SQRT1_2
    c45.loops.forEach((l, i) => l.pts.forEach((v, k) => {
      expect(t[i].pts[k].x).toBeCloseTo(v.x * r - v.y * r, 9)
      expect(t[i].pts[k].y).toBeCloseTo(v.x * r + v.y * r, 9)
      expect(t[i].pts[k].b).toBe(v.b)
    }))
    const ci = t[t.length - 2]
    expect(Math.hypot(ci.pts[1].x - ci.pts[0].x, ci.pts[1].y - ci.pts[0].y)).toBeCloseTo(8, 9)
    expect(arcInfo(ci.pts[0], ci.pts[1], ci.pts[0].b!).r).toBeCloseTo(4, 9)
    expect(signedArea(t[0])).toBeCloseTo(signedArea(c45.loops[0]), 6)
    // turned and moved so its outline box starts at (0, 0)
    const tp = turnPanel(c45, 45)
    const ob = bbox(tp.panel.loops.filter(l => l.closed && l.layer !== 'engrave'))
    expect(ob.minX).toBeCloseTo(0, 9); expect(ob.minY).toBeCloseTo(0, 9)
  })

  it('packing round trip: exact to the micrometre, lattice rows as runs', () => {
    const pieces: PresetPiece[] = []
    for (let r = 0; r < 20; r++) for (let c = 0; c < 30; c++) pieces.push([2, 90, Math.round((5 + c * 39.1 + (r % 2) * 19.55) * 1000) / 1000, Math.round((7.123 + r * 41.3333) * 1000) / 1000])
    pieces.push([0, 45, 100.001, -3.5], [1, 0, 0, 0], [1, 359.999, 1219.999, 2439.999])
    const enc = encodePieces(pieces)
    const key = (p: PresetPiece) => p.map(v => Math.round(v * 1000)).join(',')
    expect(decodePieces(enc).map(key).sort()).toEqual(pieces.map(key).sort())
    expect(enc.length).toBeLessThan(400)
  })

  it('the data stays small, and every preset decodes to its count', () => {
    const chars = PRESETS.reduce((a, p) => a + p.pieces.length + JSON.stringify(p.sig).length, 0)
    expect(chars).toBeLessThan(16000)
    for (const pr of PRESETS) {
      const n = pr.sig.reduce((a, s) => a + s[0] * pr.sets, 0) + (pr.extra ?? []).reduce((a, b) => a + b, 0)
      expect(decodePieces(pr.pieces)).toHaveLength(n)
    }
  })
})
