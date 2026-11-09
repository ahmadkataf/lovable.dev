// A whole sheet filled: for every material of a design, the most complete sets its sheet holds (1220 × 2440 by
// default), nested by their true outlines on that one sheet, ready to cut as one file per material. The count starts
// from setsPerSheet (rows, confirmed with the true-shape nesting, the cost box's number); the nesting then confirms it
// with more time and tries one set more, then another (and more while every try places), keeping what it can place,
// all within a time budget. Never a layout that needs a second sheet: a count is only kept with a nesting that put
// every one of its pieces on the one sheet.
//
// For the designs people cut most there are saved layouts (sheetpresets.ts) that beat the nesting by far (81 ring boxes
// against 71, 233 mirror frame sets against 188). One is used when it was made for the very outlines of the material's
// pieces and passes the exact check again on them; the nesting then has one try at a set more, and is used only when
// it places that many. With turning off a saved layout may still half turn pieces (the grain stays on its axis), and
// the result says how many; asked for the spacing everywhere (strict), none that needs a piece closer in a hole on
// these very pieces (the gap is measured, never taken from the preset: wider holes may keep the spacing there too).
import { Panel } from './joints'
import { Layout, Placed, SheetBox, nestLayout, SHEET_GAP } from './layout'
import { setsPerSheet, materialLabel, MAIN, CHECK_MS } from './cost'
import { Settings, sheetFor } from './generate'
import { Loop, signedArea } from './geom'
import { sampleLoop } from './nest'
import { bestPreset, SheetPreset } from './sheetpresets'
import { PRESETS } from './sheetpresets-data'

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
  /**
   * one sheet at (0, 0) holding exactly `sets` sets, and with a saved layout its `extra` loose pieces too (the comb: 16
   * sets of 24 and 21 more, 405 combs); none when not even one set fits
   */
  layout?: Layout
  /** the names of pieces too big for the sheet either way round */
  tooBig: string[]
  /** loose pieces beyond the sets: a saved layout that fills the sheet's last gaps with single pieces (21 more combs) */
  extra?: number
  /**
   * the saved layout used (sheetpresets.ts), checked again on the design's own pieces; none: the nesting's own.
   * holeGap: set when it puts pieces in another's hole closer than the spacing on these very pieces: the least gap
   * measured there, mm (2.632 for the ring box's frames at b = 5; none at b = 4.5, whose wider windows keep 3.13);
   * halfTurned: with turning off, how many of its pieces it half turns (the grain stays on its axis)
   */
  preset?: { id: string; hint?: string; unit?: string; holeGap?: number; halfTurned?: number }
  /** (strict) the sets a saved layout gives with pieces in holes closer than the spacing: holeGap from their host, as measured */
  closer?: { sets: number; holeGap: number }
}
export interface FillResult { parts: FillPart[]; /** time taken, ms */ ms: number; /** the spacing kept everywhere, holes too */ strict?: boolean }

/** the time for the whole search, ms (a phone stops on the clock: fewer extra sets tried, never a worse layout) */
export const FILL = { ms: 2000 }
/** the most one nesting gets, ms */
const CALL_MAX = 300

/**
 * One set's own material, mm²: the outlines less their holes (no sheet holds more sets than this allows: a small piece
 * may sit in a hole, never on material)
 */
function netArea(panels: Panel[]): number {
  let net = 0
  for (const p of panels) {
    const cut = p.loops.filter(l => l.closed && l.layer !== 'engrave' && l.pts.length > 1).map(signedArea)
    net += (cut.length ? Math.max(0, cut.reduce((s, a) => s + a, 0)) : p.w * p.h) * p.count
  }
  return net
}

/**
 * The share of the sheet inside the pieces' outlines (0–1): every piece's outline, less the pieces that sit in another
 * piece's hole (a spacer in a collar's opening, a frame in a window), which lie inside their host's outline already.
 */
function coverShare(lay: Layout, sheetArea: number): number {
  const geo = new Map<Panel, { area: number; poly: number[] } | null>()
  const of = (p: Panel) => {
    if (!geo.has(p)) {
      const cut = p.loops.filter(l => l.closed && l.layer !== 'engrave' && l.pts.length > 1)
      const outer = cut.reduce<Loop | null>((a, l) => (!a || Math.abs(signedArea(l)) > Math.abs(signedArea(a)) ? l : a), null)
      geo.set(p, outer ? { area: cut.reduce((s, l) => s + Math.max(0, signedArea(l)), 0), poly: sampleLoop(outer, 0.05) } : null)
    }
    return geo.get(p)
  }
  const pcs = lay.placed.map(pl => ({ pl, g: of(pl.panel), bb: [pl.x, pl.y, pl.x + pl.panel.w, pl.y + pl.panel.h] }))
  const ord = pcs.map((_, i) => i).sort((a, b) => pcs[a].bb[0] - pcs[b].bb[0])
  let area = 0
  for (let u = 0; u < ord.length; u++) {
    const A = pcs[ord[u]]
    if (!A.g) { area += A.pl.panel.w * A.pl.panel.h; continue }
    // a host's box starts no further right than this piece's
    let inside = false
    const x = A.g.poly[0] + A.pl.x, y = A.g.poly[1] + A.pl.y
    for (let v = 0; v < ord.length && !inside; v++) {
      const B = pcs[ord[v]]
      if (B.bb[0] > A.bb[0]) break
      if (v === u || !B.g || B.bb[1] > A.bb[1] || B.bb[2] < A.bb[2] || B.bb[3] < A.bb[3]) continue
      const P = B.g.poly, px = x - B.pl.x, py = y - B.pl.y
      for (let i = 0, n = P.length / 2, j = n - 1; i < n; j = i++) {
        const xi = P[2 * i], yi = P[2 * i + 1], xj = P[2 * j], yj = P[2 * j + 1]
        if ((yi > py) !== (yj > py) && px < xi + ((xj - xi) * (py - yi)) / (yj - yi)) inside = !inside
      }
    }
    if (!inside) area += A.g.area
  }
  return Math.min(1, area / Math.max(1, sheetArea))
}

/**
 * For each material of the design (the main sheet first), the most complete sets one sheet holds and their layout.
 * strict: the spacing everywhere, also between a piece and the hole it sits in (no saved layout that needs its holeGap).
 */
export function fillSheet(panels: Panel[], s: Settings, o: { budgetMs?: number; strict?: boolean; /** the saved layouts to choose from (tests) */ presets?: SheetPreset[] } = {}): FillResult {
  const start = Date.now(), budget = Math.max(CHECK_MS, o.budgetMs ?? FILL.ms)
  const live = panels.filter(p => p.count > 0 && p.w > 0 && p.h > 0)
  const keys = [...new Set(live.map(p => p.material ?? MAIN))].sort((a, b) => (a === MAIN ? -1 : b === MAIN ? 1 : 0))
  const parts = keys.map((key, i) => {
    // the time left, shared among the materials still to do
    const allot = Math.max(0, budget - (Date.now() - start)) / (keys.length - i)
    return fillOne(live.filter(p => (p.material ?? MAIN) === key), key, sheetFor(s, key === MAIN ? undefined : key), s, allot, o.presets ?? PRESETS, !!o.strict)
  })
  return { parts, ms: Date.now() - start, ...(o.strict ? { strict: true } : {}) }
}

function fillOne(mine: Panel[], key: string, sheet: { w: number; h: number }, s: Settings, allot: number, presets: SheetPreset[], strict: boolean): FillPart {
  const part = fillCore(mine, key, sheet, s, allot, presets, strict)
  if (strict) {
    // the spacing kept in the holes too: what a saved layout that needs pieces closer in their holes gives, to offer it
    // back (none when its holes keep the spacing on these pieces: then strict has it already)
    const loose = bestPreset(mine, sheet, { margin: Math.max(0, s.margin ?? 5), spacing: s.spacing, rotate: s.rotate !== false }, presets)
    if (loose?.holeGap !== undefined && loose.sets > part.sets) part.closer = { sets: loose.sets, holeGap: loose.holeGap }
  }
  return part
}

function fillCore(mine: Panel[], key: string, sheet: { w: number; h: number }, s: Settings, allot: number, presets: SheetPreset[], strict: boolean): FillPart {
  const t0 = Date.now()
  const spacing = s.spacing, margin = Math.max(0, s.margin ?? 5), rotate = s.rotate !== false
  const est = setsPerSheet(mine, spacing, sheet, { margin, rotate })
  const part: FillPart = { material: key, label: materialLabel(key), sheet: { ...sheet }, pieces: mine.reduce((a, p) => a + p.count, 0), sets: 0, estimate: est.sets, use: 0, tooBig: est.tooBig }
  // a saved layout made for exactly these outlines, that passes the exact check on these very pieces
  const pre = bestPreset(mine, sheet, { margin, spacing, rotate, holeGap: !strict }, presets)
  if (est.sets <= 0 && !pre) return part
  // k sets nested on one sheet, or nothing when any piece would need a second one
  const place = (k: number, ms: number): Layout | null => {
    const lay = nestLayout(mine.map(p => ({ ...p, count: p.count * k })), { spacing, margin, sheet: () => sheet, rotate, budgetMs: ms })
    return lay.sheets?.length === 1 && !lay.tooBig?.length && lay.placed.every(pl => pl.sheet === 0) ? lay : null
  }
  const callMs = Math.round(Math.min(CALL_MAX, Math.max(CHECK_MS, allot / 3)))
  const net = netArea(mine)
  const room = Math.max(0, sheet.w - 2 * margin) * Math.max(0, sheet.h - 2 * margin)
  /** one past the most sets the sheet's area allows */
  const cap = net > 0 ? Math.floor(room / net) + 1 : Number.MAX_SAFE_INTEGER
  let k = est.sets
  let lay: Layout | null = null
  if (pre) {
    // the nesting has one try at a set more than the saved layout, and is used only when it places that many
    const more = pre.sets + 1 < cap ? place(pre.sets + 1, callMs) : null
    if (!more) {
      const { id, hint, unit } = pre.preset
      // a hole gap only when these pieces need it (as measured); half turns only matter with turning off
      const holeGap = pre.holeGap
      const halfTurned = rotate ? 0 : pre.layout.placed.filter(pl => pl.rot).length
      return {
        ...part, sets: pre.sets, ...(pre.extra ? { extra: pre.extra } : {}), use: coverShare(pre.layout, sheet.w * sheet.h), layout: pre.layout,
        preset: { id, ...(hint ? { hint } : {}), ...(unit ? { unit } : {}), ...(holeGap !== undefined ? { holeGap } : {}), ...(halfTurned ? { halfTurned } : {}) },
      }
    }
    k = pre.sets + 1; lay = more
  } else {
    // the count with more time; failing that, with the very check that confirmed it
    lay = place(k, callMs) ?? (callMs !== CHECK_MS ? place(k, CHECK_MS) : null)
  }
  if (!lay) {
    // (not seen in practice) the largest count below that does place
    let lo = 0, hi = k
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2), l = place(m, CHECK_MS); if (l) { lo = m; lay = l } else hi = m }
    k = lo
  } else {
    // one set more, then another, while the time lasts and the sheet's area allows it. When both place, the rows
    // were far from the truth (pointed pieces nest head to tail: two triangles in one box): bigger steps while every
    // try places, then halving back to the most that does
    /** the least count known not to place (at first: one past what the area allows) */
    let hi = cap
    let step = 1, placed = 0, failed = false
    while (k + 1 < hi && Date.now() - t0 <= allot) {
      const next = failed ? Math.floor((k + hi) / 2) : Math.min(k + step, hi - 1)
      const more = place(next, callMs)
      if (more) { k = next; lay = more; if (!failed && ++placed >= 2) step *= 2 } else { hi = next; failed = true }
    }
  }
  if (!lay || k <= 0) return part
  return { ...part, sets: k, use: coverShare(lay, sheet.w * sheet.h), layout: lay }
}

/**
 * How many more the fill gives than the cost box's count (setsPerSheet's sets), in the unit its count is shown in: sets,
 * or with loose pieces single pieces (the comb: 405 combs against 16 × 24 = 384, 21 more; with turning off the table's
 * 15 × 24 = 360, 45 more). 0 or less: no more.
 */
export function fillMore(p: FillPart): number {
  return p.extra ? p.sets * p.pieces + p.extra - p.estimate * p.pieces : p.sets - p.estimate
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
