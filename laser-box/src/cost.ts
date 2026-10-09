// What a design costs in sheets: how many complete sets of its pieces one sheet yields (nested the way the layout
// nests them, in whichever way round the sheet and the pieces fit best), and from that the price of one set, of a
// quantity, and of a whole project of several designs. Every sheet has its own size and price (the main sheet, then
// one per other material: mirror, gold, clear…), and prices are kept in one currency and shown in two.
import { Panel } from './joints'
import { MATERIAL_INFO } from './materials'

/** a sheet as bought: its size in centimetres and its price in the input currency */
export interface SheetSpec { w: number; h: number; price: number }
export type Currency = 'USD' | 'SYP'
export interface Pricing {
  /** Syrian pounds per dollar, today */
  rate: number
  /** the currency the sheet prices are typed in */
  currency: Currency
  /** by material id; MAIN for the design's main sheet */
  sheets: Record<string, SheetSpec>
}
export const MAIN = 'main'
export const DEFAULT_SHEET: SheetSpec = { w: 122, h: 244, price: 11 }
export const DEFAULT_PRICING: Pricing = { rate: 11000, currency: 'USD', sheets: { [MAIN]: { ...DEFAULT_SHEET } } }

/** the sheet for a material, the default when none was set */
export const sheetOf = (p: Pricing, material: string): SheetSpec => p.sheets[material] ?? { ...DEFAULT_SHEET }
export const materialLabel = (material: string) => (material === MAIN ? 'اللوح الأساسي' : MATERIAL_INFO[material]?.label ?? material)

/** both currencies from a price typed in the input currency */
export function money(p: Pricing, v: number): { usd: number; syp: number } {
  const usd = p.currency === 'USD' ? v : p.rate > 0 ? v / p.rate : 0
  return { usd, syp: usd * p.rate }
}
export const fmtUsd = (v: number) => `$${(Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: v >= 100 ? 0 : 2, maximumFractionDigits: 2 })}`
export const fmtSyp = (v: number) => `${Math.round(v).toLocaleString('en-US')} ل.س`
/** "$3.67 · 40,370 ل.س" */
export const fmtBoth = (p: Pricing, usd: number) => `${fmtUsd(usd)} · ${fmtSyp(usd * p.rate)}`

export interface Nesting {
  /** complete sets of the pieces one sheet yields */
  sets: number
  /** the pieces' own area, one set, mm² */
  area: number
  /** the sheet's area, mm² */
  sheetArea: number
  /** the sheet turned (its long side across) or the pieces turned, whichever packed best */
  turned: boolean
  /** pieces that do not fit the sheet in any orientation */
  tooBig: string[]
}

/**
 * How many complete sets of these pieces one sheet holds. k sets are packed in rows started by the tallest pieces,
 * as the layout does, and then better than the layout: a shorter piece goes into a column under a piece already in
 * the row, and a piece that finds no new row goes into any row with room left. The largest k whose every piece
 * finds a place is the answer, tried with the sheet both ways round and the pieces upright or turned; the best kept.
 * A lower bound a real nesting program may beat a little, never an overestimate.
 */
export function setsPerSheet(panels: Panel[], spacing: number, sheetMm: { w: number; h: number }): Nesting {
  const types = panels.filter(p => p.count > 0 && p.w > 0 && p.h > 0)
  const area = types.reduce((s, p) => s + p.w * p.h * p.count, 0)
  const sheetArea = sheetMm.w * sheetMm.h
  const fitsSomehow = (p: Panel) => (p.w <= sheetMm.w && p.h <= sheetMm.h) || (p.h <= sheetMm.w && p.w <= sheetMm.h)
  const tooBig = types.filter(p => !fitsSomehow(p)).map(p => p.name)
  if (!types.length || tooBig.length || area <= 0) return { sets: 0, area, sheetArea, turned: false, tooBig }
  // never more sets than the areas allow; and never more pieces than a page can pack in a blink: past the cap the
  // count is extrapolated from the height the capped packing used (rows repeat down the sheet)
  const perSet = types.reduce((s, p) => s + p.count, 0)
  const bound = Math.max(1, Math.floor(sheetArea / area))
  const cap = Math.max(1, Math.min(bound, Math.floor(1500 / perSet)))
  type It = { w: number; h: number; i: number }
  // every piece of k sets placed? and how far down the sheet the rows reach
  const pack = (k: number, W: number, H: number, rot: boolean): { ok: boolean; usedH: number } => {
    const items: It[] = []
    types.forEach((p, i) => { const w = rot ? p.h : p.w, h = rot ? p.w : p.h; for (let c = 0; c < p.count * k; c++) items.push({ w, h, i }) })
    items.sort((a, b) => b.h - a.h || b.w - a.w)
    // a row is as tall as its first piece; each piece put in a row heads a column that shorter pieces stack in
    type Col = { w: number; free: number }
    type Row = { y: number; h: number; x: number; cols: Col[] }
    const rows: Row[] = []
    const stack = (it: It) => {
      for (const r of rows) {
        if (it.h > r.h) continue
        for (const c of r.cols) if (it.w <= c.w && it.h <= r.y + r.h - c.free) { c.free += it.h + spacing; return true }
      }
      return false
    }
    const append = (it: It) => {
      for (const r of rows) if (it.h <= r.h && r.x + it.w <= W) { r.cols.push({ w: it.w, free: r.y + it.h + spacing }); r.x += it.w + spacing; return true }
      return false
    }
    const newRow = (it: It) => {
      const last = rows[rows.length - 1], y = last ? last.y + last.h + spacing : 0
      if (it.w > W || y + it.h > H) return false
      rows.push({ y, h: it.h, x: it.w + spacing, cols: [{ w: it.w, free: y + it.h + spacing }] })
      return true
    }
    for (const it of items) {
      const cur = rows[rows.length - 1]
      if (cur && it.h <= cur.h && cur.x + it.w <= W) { cur.cols.push({ w: it.w, free: cur.y + it.h + spacing }); cur.x += it.w + spacing; continue }
      if (!(stack(it) || append(it) || newRow(it))) return { ok: false, usedH: H }
    }
    const last = rows[rows.length - 1]
    return { ok: true, usedH: last ? last.y + last.h : 0 }
  }
  let best = 0, turned = false
  for (const [W, H, sheetTurned] of [[sheetMm.w, sheetMm.h, false], [sheetMm.h, sheetMm.w, true]] as const) {
    for (const rot of [false, true]) {
      if (!pack(1, W, H, rot).ok) continue
      // the largest k that packs, by halving between a k that does and one that does not
      let lo = 1, hi = cap
      const top = pack(cap, W, H, rot)
      if (top.ok) lo = cap
      else while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (pack(m, W, H, rot).ok) lo = m; else hi = m }
      let sets = lo
      if (top.ok && cap < bound && top.usedH > 0) sets = Math.min(bound, Math.floor((cap * H) / (top.usedH + spacing)))
      if (sets > best) { best = sets; turned = sheetTurned || rot }
    }
  }
  return { sets: Math.min(best, bound), area, sheetArea, turned, tooBig }
}

export interface MaterialCost {
  material: string
  label: string
  sheet: SheetSpec
  nest: Nesting
  /** pieces of one set on this sheet */
  pieces: number
  /** one set's share of the sheet, in the input currency (0 when nothing fits) */
  perSet: number
}
export interface DesignCost {
  parts: MaterialCost[]
  /** one set, all its sheets, in the input currency */
  perSet: number
  /** materials whose pieces do not fit their sheet */
  problems: string[]
}

/** The cost of one set of a design: each material's pieces on their own sheet. */
export function designCost(panels: Panel[], spacing: number, pricing: Pricing): DesignCost {
  const mats = [...new Set(panels.map(p => p.material ?? MAIN))]
  const parts: MaterialCost[] = mats.map(m => {
    const mine = panels.filter(p => (p.material ?? MAIN) === m), sheet = sheetOf(pricing, m)
    const nest = setsPerSheet(mine, spacing, { w: sheet.w * 10, h: sheet.h * 10 })
    return { material: m, label: materialLabel(m), sheet, nest, pieces: mine.reduce((s, p) => s + p.count, 0), perSet: nest.sets > 0 ? sheet.price / nest.sets : 0 }
  })
  const problems = parts.filter(p => p.nest.sets === 0).map(p => `${p.label}: ${p.nest.tooBig.length ? `«${p.nest.tooBig[0]}» أكبر من اللوح (${p.sheet.w} × ${p.sheet.h} سم)` : 'القطع لا تتّسع على لوح واحد'}`)
  return { parts, perSet: parts.reduce((s, p) => s + p.perSet, 0), problems }
}

/** For a quantity: whole sheets to buy per material (every set on one sheet, the rest of the last sheet left over). */
export function sheetsFor(part: MaterialCost, qty: number): { sheets: number; leftover: number } {
  if (part.nest.sets <= 0 || qty <= 0) return { sheets: 0, leftover: 0 }
  const sheets = Math.ceil(qty / part.nest.sets)
  return { sheets, leftover: sheets * part.nest.sets - qty }
}

export interface ProjectLine { name: string; qty: number; cost: DesignCost }
export interface ProjectTotal {
  /** per material: the sets wanted as a fraction of sheets, and whole sheets to buy */
  materials: { material: string; label: string; sheet: SheetSpec; fraction: number; sheets: number; cost: number; whole: number }[]
  /** proportional cost of everything, in the input currency */
  cost: number
  /** buying whole sheets */
  whole: number
}

/** A project of several designs: the sheets they share, added up by material. */
export function projectTotal(lines: ProjectLine[], pricing: Pricing): ProjectTotal {
  const by = new Map<string, number>()
  for (const l of lines) for (const p of l.cost.parts) if (p.nest.sets > 0) by.set(p.material, (by.get(p.material) ?? 0) + l.qty / p.nest.sets)
  const materials = [...by].map(([material, fraction]) => {
    const sheet = sheetOf(pricing, material), sheets = Math.ceil(fraction - 1e-9)
    return { material, label: materialLabel(material), sheet, fraction, sheets, cost: fraction * sheet.price, whole: sheets * sheet.price }
  })
  return { materials, cost: materials.reduce((s, m) => s + m.cost, 0), whole: materials.reduce((s, m) => s + m.whole, 0) }
}

/** Arabic text made comparable for searching: no diacritics or tatweel, one alef, one yaa, one haa. */
export function normalizeArabic(s: string): string {
  return s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim()
}
/** every word of the query somewhere in the text */
export function matches(query: string, ...texts: string[]): boolean {
  const q = normalizeArabic(query).split(' ').filter(Boolean)
  if (!q.length) return true
  const hay = normalizeArabic(texts.join(' '))
  return q.every(w => hay.includes(w))
}
