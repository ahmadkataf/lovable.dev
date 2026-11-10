import { describe, it, expect } from 'vitest'
import { fillSheet, fillLayout, FillPart, FillResult } from './fillsheet'
import { setsPerSheet, MAIN } from './cost'
import { checkSheet } from './nest'
import { templateById } from './templates'
import { generate, DEFAULT_SETTINGS, Settings, sheetFor } from './generate'
import { buildPanel, Panel } from './joints'
import { polyLoop } from './geom'
import { toDXF } from './export'
import { offSheet } from './testutil'
import { PRESETS } from './sheetpresets-data'
import { presetCounts } from './sheetpresets'

const S = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...o })
const keyOf = (p: Panel) => p.material ?? MAIN

/**
 * Everything a filled sheet promises, checked independently: one sheet only, of the settings' size; exactly `sets`
 * complete sets, every copy of every piece of the material and nothing else; every cut inside the margin and no two
 * pieces closer than the spacing (the exact check on the outlines); the count at least what setsPerSheet counted.
 */
function validate(part: FillPart, panels: Panel[], s: Settings) {
  const mine = panels.filter(p => keyOf(p) === part.material && p.count > 0)
  const sheet = sheetFor(s, part.material === MAIN ? undefined : part.material)
  expect(part.sheet).toEqual(sheet)
  expect(part.pieces).toBe(mine.reduce((a, p) => a + p.count, 0))
  const est = setsPerSheet(mine, s.spacing, sheet, { margin: s.margin, rotate: s.rotate })
  expect(part.estimate).toBe(est.sets)
  expect(part.sets).toBeGreaterThanOrEqual(est.sets)
  expect(part.sets).toBeGreaterThan(0)
  const lay = part.layout!
  expect(lay).toBeDefined()
  // one sheet, never a second
  expect(lay.sheets).toHaveLength(1)
  expect(lay.sheets![0]).toMatchObject({ x: 0, y: 0, w: sheet.w, h: sheet.h })
  expect(lay.tooBig ?? []).toEqual([])
  expect(lay.placed.every(pl => pl.sheet === 0)).toBe(true)
  // exactly `sets` sets: every piece of the material count × sets times (and a saved layout's loose pieces), and only those
  const extra = part.preset ? presetCounts(PRESETS.find(pr => pr.id === part.preset!.id)!, mine).extra : []
  const want = new Map<string, number>()
  mine.forEach((p, i) => want.set(p.id, (want.get(p.id) ?? 0) + p.count * part.sets + (extra[i] ?? 0)))
  const got = new Map<string, number>()
  for (const pl of lay.placed) got.set(pl.panel.id, (got.get(pl.panel.id) ?? 0) + 1)
  expect(got).toEqual(want)
  expect(lay.placed.length).toBe(part.pieces * part.sets + (part.extra ?? 0))
  expect(part.extra ?? 0).toBe(extra.reduce((a, b) => a + b, 0))
  // materials kept apart: nothing from another material's sheet
  expect(lay.placed.every(pl => keyOf(pl.panel) === part.material)).toBe(true)
  // inside the margin, no overlaps, the spacing kept, on the true outlines (a saved layout that declares it: a piece in
  // another's hole may be holeGap from it)
  const holeGap = part.preset?.holeGap
  expect(checkSheet(lay.placed.map(pl => ({ panel: pl.panel, x: pl.x, y: pl.y })), sheet.w, sheet.h, s.spacing, s.margin, undefined, holeGap !== undefined ? { holeGap } : {})).toEqual([])
  expect(offSheet(lay)).toEqual([])
  expect(part.use).toBeGreaterThan(0)
  expect(part.use).toBeLessThanOrEqual(1)
  // turning off keeps the grain: nothing turned; only a saved layout may half turn pieces, and then it says how many
  if (s.rotate === false) expect(lay.placed.every(pl => (pl.rot ?? 0) % 180 === 0)).toBe(true)
  if (s.rotate === false && !part.preset) expect(lay.placed.every(pl => !pl.rot)).toBe(true)
  if (part.preset) expect(part.preset.halfTurned ?? 0).toBe(s.rotate === false ? lay.placed.filter(pl => pl.rot).length : 0)
}

function validateAll(r: FillResult, panels: Panel[], s: Settings) {
  // one part per material, the main sheet first, each its own
  const mats = [...new Set(panels.filter(p => p.count > 0).map(keyOf))]
  expect(r.parts.map(p => p.material).sort()).toEqual([...mats].sort())
  if (mats.includes(MAIN)) expect(r.parts[0].material).toBe(MAIN)
  for (const part of r.parts) validate(part, panels, s)
}

describe('a whole sheet filled', () => {
  const cases: [string, Record<string, number>, Partial<Settings>][] = [
    ['engagestand', {}, {}],
    ['engagestand', { W: 400 }, {}],
    ['hexringbox', { lidType: 2, stop: 100 }, {}],
    ['favorcarrier', {}, {}],
    ['woodcomb', {}, {}],
    ['incenselantern', {}, { t: 2 }],
  ]
  for (const [id, params, so] of cases) {
    it(`${id} ${JSON.stringify(params)}: the most complete sets on one sheet, per material`, () => {
      const s = S(so)
      const d = generate(templateById(id), params, s)
      expect(d.errors).toEqual([])
      const r = fillSheet(d.panels, s, { budgetMs: 2000 })
      validateAll(r, d.panels, s)
      // the rows' count, or one or two more where the nesting placed them (a saved layout may give far more)
      for (const part of r.parts) if (!part.preset) expect(part.sets - part.estimate).toBeLessThanOrEqual(2)
      // each material's file holds only its own cuts: the main sheet on CUT, a mirror sheet on CUT-MIRROR
      for (const part of r.parts) {
        const dxf = toDXF(part.layout!)
        const layers = new Set([...dxf.matchAll(/\n8\n(CUT[^\n]*)\n/g)].map(m => m[1]))
        expect([...layers]).toEqual([part.material === MAIN ? 'CUT' : `CUT-${part.material.toUpperCase()}`])
      }
    })
  }

  it('places more than the rows count when the nesting proves it (pointed pieces nest head to tail)', () => {
    const poly = (id: string, pts: [number, number][]): Panel =>
      buildPanel({ id, name: id, w: 0, h: 0, count: 1, shape: [polyLoop(pts.map(([x, y]) => ({ x, y })), 'outer')] }, { t: 3, finger: 9 })
    const s = S()
    const panels = [poly('tri', [[0, 0], [500, 0], [0, 500]])]
    const r = fillSheet(panels, s, { budgetMs: 3000 })
    validateAll(r, panels, s)
    expect(r.parts[0].sets).toBeGreaterThan(r.parts[0].estimate)
  })

  it('a sheet of its own for another material, and no turning when turning is off', () => {
    const s = S({ rotate: false, matSheets: { mirror: { w: 900, h: 600 } } })
    const d = generate(templateById('engagestand'), { W: 400 }, s)
    const r = fillSheet(d.panels, s, { budgetMs: 1200 })
    validateAll(r, d.panels, s)
    expect(r.parts.find(p => p.material === 'mirror')!.layout!.sheets![0]).toMatchObject({ w: 900, h: 600 })
  })

  it('a short time budget still gives the confirmed count, never less', () => {
    const s = S({ t: 2 })
    const d = generate(templateById('incenselantern'), {}, s)
    const r = fillSheet(d.panels, s, { budgetMs: 1 })
    validateAll(r, d.panels, s)
  })

  it('a piece bigger than the sheet: nothing to cut, and says which', () => {
    const big = { id: 'big', name: 'لوح كبير', loops: [], w: 2500, h: 100, count: 1, minFinger: Infinity, cornerNeck: Infinity } as Panel
    const r = fillSheet([big], S())
    expect(r.parts).toHaveLength(1)
    expect(r.parts[0]).toMatchObject({ material: MAIN, sets: 0, estimate: 0, use: 0, tooBig: ['لوح كبير'] })
    expect(r.parts[0].layout).toBeUndefined()
    expect(fillLayout(r).placed).toEqual([])
  })

  it('every material in one drawing (the phone saves one file): sheets side by side, each piece on its own sheet', () => {
    const s = S()
    const d = generate(templateById('hexringbox'), { lidType: 2, stop: 100 }, s)
    const r = fillSheet(d.panels, s, { budgetMs: 800 })
    const all = fillLayout(r)
    expect(all.sheets).toHaveLength(r.parts.length)
    expect(all.placed.length).toBe(r.parts.reduce((a, p) => a + p.pieces * p.sets, 0))
    expect(offSheet(all)).toEqual([])
    all.sheets!.forEach((sh, i) => {
      const on = all.placed.filter(pl => pl.sheet === i)
      expect(on.every(pl => keyOf(pl.panel) === r.parts[i].material)).toBe(true)
      expect(checkSheet(on.map(pl => ({ panel: pl.panel, x: pl.x - sh.x, y: pl.y - sh.y })), sh.w, sh.h, s.spacing, s.margin)).toEqual([])
    })
  })
})
