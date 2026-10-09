import { describe, it, expect } from 'vitest'
import { setsPerSheet, designCost, projectTotal, sheetsFor, money, matches, normalizeArabic, DEFAULT_PRICING, MAIN, Pricing } from './cost'
import { templateById } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { Panel } from './joints'

const panel = (w: number, h: number, count = 1, material?: string): Panel => ({ id: `${w}x${h}`, name: `${w}×${h}`, loops: [], w, h, count, minFinger: Infinity, cornerNeck: Infinity, ...(material ? { material } : {}) } as Panel)

describe('sheet costing', () => {
  it('nests sets in rows the way the layout does, trying the sheet and the pieces both ways round', () => {
    // 100 × 100 squares with 3 mm between them on a 1220 × 2440 sheet: 11 across, 23 down
    const n = setsPerSheet([panel(100, 100)], 3, { w: 1220, h: 2440 })
    expect(n.sets).toBe(11 * 23)
    expect(n.tooBig).toEqual([])
    // a 2000 mm strip fits only along the sheet's long side
    expect(setsPerSheet([panel(2000, 100)], 3, { w: 1220, h: 2440 }).sets).toBeGreaterThan(0)
    expect(setsPerSheet([panel(2500, 100)], 3, { w: 1220, h: 2440 }).sets).toBe(0)
    expect(setsPerSheet([panel(2500, 100)], 3, { w: 1220, h: 2440 }).tooBig).toEqual(['2500×100'])
    // tiny pieces: counted past the packing cap by how far the rows reach, never past the area bound
    const tiny = setsPerSheet([panel(25, 25, 4)], 2, { w: 1220, h: 2440 })
    expect(tiny.sets).toBeGreaterThan(900)
    expect(tiny.sets).toBeLessThanOrEqual(Math.floor((1220 * 2440) / (4 * 625)))
    // never more than the areas allow
    const big = setsPerSheet([panel(600, 600), panel(50, 50, 4)], 3, { w: 1220, h: 2440 })
    expect(big.sets).toBeLessThanOrEqual(Math.floor((1220 * 2440) / (600 * 600 + 4 * 2500)))
    expect(big.sets).toBe(7) // eight big squares would leave no room for the small ones; with seven they stack beside the last
    // stacking in columns: 30 mm tiles under a tall piece in the same row
    expect(setsPerSheet([panel(100, 300), panel(30, 30, 9)], 2, { w: 400, h: 300 }).sets).toBe(3)  // 3 columns of 9 tiles beside the three tall pieces
    expect(setsPerSheet([panel(100, 300), panel(30, 30, 10)], 2, { w: 400, h: 300 }).sets).toBe(2) // one tile too many for a third set
  })

  it('prices one set as its share of each material\'s sheet, and a quantity by whole sheets', () => {
    const pricing: Pricing = { rate: 10000, currency: 'USD', sheets: { [MAIN]: { w: 122, h: 244, price: 11 }, gold: { w: 60, h: 90, price: 30 } } }
    const c = designCost([panel(100, 100, 2), panel(40, 40, 1, 'gold')], 3, pricing)
    expect(c.parts.map(p => p.material)).toEqual([MAIN, 'gold'])
    const main = c.parts[0], gold = c.parts[1]
    expect(main.nest.sets).toBe(Math.floor((11 * 23) / 2))
    expect(main.perSet).toBeCloseTo(11 / main.nest.sets, 6)
    const across = (L: number) => Math.floor((L + 3) / 43)
    expect(gold.nest.sets).toBe(Math.max(across(600) * across(900), across(900) * across(600)))
    expect(c.perSet).toBeCloseTo(main.perSet + gold.perSet, 6)
    expect(c.problems).toEqual([])
    expect(sheetsFor(main, 1)).toEqual({ sheets: 1, leftover: main.nest.sets - 1 })
    expect(sheetsFor(main, main.nest.sets + 1)).toEqual({ sheets: 2, leftover: main.nest.sets - 1 })
    // a sheet too small for a piece is a problem, not a zero price
    const bad = designCost([panel(1000, 100, 1, 'gold')], 3, pricing)
    expect(bad.parts[0].perSet).toBe(0)
    expect(bad.problems[0]).toContain('أكبر من اللوح')
  })

  it('adds a project up by material, in fractions of sheets and in whole sheets', () => {
    const pricing: Pricing = { ...DEFAULT_PRICING, sheets: { [MAIN]: { w: 100, h: 100, price: 10 } } }
    const a = designCost([panel(500, 500)], 0, pricing)   // 4 per sheet
    const b = designCost([panel(1000, 500)], 0, pricing)  // 2 per sheet
    const t = projectTotal([{ name: 'a', qty: 2, cost: a }, { name: 'b', qty: 3, cost: b }], pricing)
    expect(t.materials[0].fraction).toBeCloseTo(2 / 4 + 3 / 2, 9)
    expect(t.materials[0].sheets).toBe(2)
    expect(t.cost).toBeCloseTo(20, 9)
    expect(t.whole).toBe(20)
  })

  it('shows every price in both currencies from one exchange rate, whichever currency it was typed in', () => {
    expect(money({ ...DEFAULT_PRICING, rate: 12000 }, 11)).toEqual({ usd: 11, syp: 132000 })
    expect(money({ ...DEFAULT_PRICING, rate: 12000, currency: 'SYP' }, 132000)).toEqual({ usd: 11, syp: 132000 })
    expect(money({ ...DEFAULT_PRICING, rate: 0, currency: 'SYP' }, 5).usd).toBe(0)
  })

  it('costs a real design: the mirror tower burner with its mirror and gold sheets', () => {
    const d = generate(templateById('mabkharatower'), {}, { ...DEFAULT_SETTINGS, t: 3.2 })
    const c = designCost(d.panels, 3, DEFAULT_PRICING)
    expect(c.parts.map(p => p.material).sort()).toEqual(['gold', MAIN, 'mirror'])
    for (const p of c.parts) { expect(p.nest.sets).toBeGreaterThan(0); expect(p.perSet).toBeGreaterThan(0) }
    expect(c.perSet).toBeLessThan(22)
    expect(c.problems).toEqual([])
  })

  it('finds products by any spelling of their name', () => {
    expect(normalizeArabic('مبخَرة أكْريليك')).toBe('مبخره اكريليك')
    expect(matches('مبخرة', 'مبخرة برج بالمرايا')).toBe(true)
    expect(matches('مبخره برج', 'مبخرة برج بالمرايا')).toBe(true)
    expect(matches('درع هلال', 'درع الهلال', 'هلال تتّصل به نجمة')).toBe(true)
    expect(matches('كوستر', 'طقم كوسترات بنقشة الزهرة')).toBe(true)
    expect(matches('صينية', 'مبخرة برج')).toBe(false)
    expect(matches('', 'anything')).toBe(true)
  })
})
