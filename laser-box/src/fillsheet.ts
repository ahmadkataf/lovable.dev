// A whole sheet filled: for every material of a design, the most complete sets its sheet holds (1220 × 2440 by
// default), nested by their true outlines on that one sheet, ready to cut as one file per material. The count starts
// from setsPerSheet (rows, confirmed with the true-shape nesting, the cost box's number); the nesting then confirms it
// with more time and tries one set more, then another (and more while every try places), keeping what it can place,
// all within a time budget. Never a layout that needs a second sheet: a count is only kept with a nesting that put
// every one of its pieces on the one sheet.
import { Panel } from './joints'
import { Layout, Placed, SheetBox, nestLayout, SHEET_GAP } from './layout'
import { setsPerSheet, materialLabel, MAIN, CHECK_MS } from './cost'
import { Settings, sheetFor } from './generate'
import { signedArea } from './geom'

export interface FillPart {
  /** MAIN or the material id */
  material: string
  label: string
  /** the sheet, mm */
  sheet: { w: number; h: number }
  /** pieces in one set */
  pieces: number
  /** complete sets on the one sheet (0: not even one fits) */
  sets: number
  /** what setsPerSheet counted (the cost box's number); sets is this or more, when the nesting placed more */
  estimate: number
  /** the share of the sheet inside the pieces' outlines (0–1): what is not offcut between them */
  use: number
  /** exactly `sets` sets on one sheet at (0, 0); none when not even one set fits */
  layout?: Layout
  /** the names of pieces too big for the sheet either way round */
  tooBig: string[]
}
export interface FillResult { parts: FillPart[]; /** time taken, ms */ ms: number }

/** the time for the whole search, ms (a phone stops on the clock: fewer extra sets tried, never a worse layout) */
export const FILL = { ms: 2000 }
/** the most one nesting gets, ms */
const CALL_MAX = 300

/**
 * One set's areas, mm²: inside the pieces' outlines (what the sheet gives them), and their own material, the outlines
 * less their holes (no sheet holds more sets than this allows: a small piece may sit in a hole, never on material)
 */
function areas(panels: Panel[]): { outline: number; net: number } {
  let outline = 0, net = 0
  for (const p of panels) {
    const cut = p.loops.filter(l => l.closed && l.layer !== 'engrave' && l.pts.length > 1).map(signedArea)
    const o = cut.length ? cut.reduce((s, a) => s + Math.max(0, a), 0) : p.w * p.h
    outline += o * p.count
    net += (cut.length ? Math.max(0, cut.reduce((s, a) => s + a, 0)) : o) * p.count
  }
  return { outline, net }
}

/** For each material of the design (the main sheet first), the most complete sets one sheet holds and their layout. */
export function fillSheet(panels: Panel[], s: Settings, o: { budgetMs?: number } = {}): FillResult {
  const start = Date.now(), budget = Math.max(CHECK_MS, o.budgetMs ?? FILL.ms)
  const live = panels.filter(p => p.count > 0 && p.w > 0 && p.h > 0)
  const keys = [...new Set(live.map(p => p.material ?? MAIN))].sort((a, b) => (a === MAIN ? -1 : b === MAIN ? 1 : 0))
  const parts = keys.map((key, i) => {
    // the time left, shared among the materials still to do
    const allot = Math.max(0, budget - (Date.now() - start)) / (keys.length - i)
    return fillOne(live.filter(p => (p.material ?? MAIN) === key), key, sheetFor(s, key === MAIN ? undefined : key), s, allot)
  })
  return { parts, ms: Date.now() - start }
}

function fillOne(mine: Panel[], key: string, sheet: { w: number; h: number }, s: Settings, allot: number): FillPart {
  const t0 = Date.now()
  const spacing = s.spacing, margin = Math.max(0, s.margin ?? 5), rotate = s.rotate !== false
  const est = setsPerSheet(mine, spacing, sheet, { margin, rotate })
  const part: FillPart = { material: key, label: materialLabel(key), sheet: { ...sheet }, pieces: mine.reduce((a, p) => a + p.count, 0), sets: 0, estimate: est.sets, use: 0, tooBig: est.tooBig }
  if (est.sets <= 0) return part
  // k sets nested on one sheet, or nothing when any piece would need a second one
  const place = (k: number, ms: number): Layout | null => {
    const lay = nestLayout(mine.map(p => ({ ...p, count: p.count * k })), { spacing, margin, sheet: () => sheet, rotate, budgetMs: ms })
    return lay.sheets?.length === 1 && !lay.tooBig?.length && lay.placed.every(pl => pl.sheet === 0) ? lay : null
  }
  const callMs = Math.round(Math.min(CALL_MAX, Math.max(CHECK_MS, allot / 3)))
  const area = areas(mine)
  let k = est.sets
  // the count with more time; failing that, with the very check that confirmed it
  let lay = place(k, callMs) ?? (callMs !== CHECK_MS ? place(k, CHECK_MS) : null)
  if (!lay) {
    // (not seen in practice) the largest count below that does place
    let lo = 0, hi = k
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2), l = place(m, CHECK_MS); if (l) { lo = m; lay = l } else hi = m }
    k = lo
  } else {
    // one set more, then another, while the time lasts and the sheet's area allows it. When both place, the rows
    // were far from the truth (pointed pieces nest head to tail: two triangles in one box): bigger steps while every
    // try places, then halving back to the most that does
    const room = Math.max(0, sheet.w - 2 * margin) * Math.max(0, sheet.h - 2 * margin)
    /** the least count known not to place (at first: one past what the area allows) */
    let hi = area.net > 0 ? Math.floor(room / area.net) + 1 : Number.MAX_SAFE_INTEGER
    let step = 1, placed = 0, failed = false
    while (k + 1 < hi && Date.now() - t0 <= allot) {
      const next = failed ? Math.floor((k + hi) / 2) : Math.min(k + step, hi - 1)
      const more = place(next, callMs)
      if (more) { k = next; lay = more; if (!failed && ++placed >= 2) step *= 2 } else { hi = next; failed = true }
    }
  }
  if (!lay || k <= 0) return part
  return { ...part, sets: k, use: Math.min(1, (area.outline * k) / Math.max(1, sheet.w * sheet.h)), layout: lay }
}

/** Every material's filled sheet in one drawing, side by side SHEET_GAP apart (each material keeps its own colour and layer). */
export function fillLayout(r: FillResult): Layout {
  const placed: Placed[] = [], sheets: SheetBox[] = []
  let x = 0
  for (const p of r.parts) {
    const sh = p.layout?.sheets?.[0]
    if (!p.layout || !sh) continue
    const i = sheets.length
    sheets.push({ ...sh, x, y: 0 })
    for (const pl of p.layout.placed) placed.push({ ...pl, x: pl.x - sh.x + x, y: pl.y - sh.y, sheet: i })
    x += sh.w + SHEET_GAP
  }
  return { placed, w: Math.max(0, x - SHEET_GAP), h: Math.max(0, ...sheets.map(sh => sh.h)), sheets }
}
