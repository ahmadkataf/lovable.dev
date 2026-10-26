// Arranges panels on sheets. nestLayout: the true-shape nesting (src/nest.ts) on the sheets bought, every sheet its own
// rectangle, side by side along x. layout: the old rows (shelves) up to a width, kept as the yardstick.
import { Panel } from './joints'
import { nest, NestOpts } from './nest'

export interface Placed { panel: Panel; x: number; y: number; copy: number; /** the sheet it is cut from (nestLayout) */ sheet?: number; /** quarter turns applied, degrees */ rot?: number }
/** a sheet in the drawing: its rectangle (x, y, w, h), and how far its pieces reach from its corner */
export interface SheetBox { x: number; y: number; w: number; h: number; material?: string; used: { w: number; h: number } }
export interface Layout {
  placed: Placed[]
  w: number
  h: number
  groups?: { material?: string; x?: number; w?: number; y: number; h: number }[]
  sheets?: SheetBox[]
  /** pieces too big for their sheet either way round (alone on a sheet made big enough) */
  tooBig?: string[]
  /** pieces turned from the way they were drawn (wood grain) */
  turned?: number
}

/** the gap between two sheets in the drawing, mm */
export const SHEET_GAP = 100

/** Every copy nested on sheets by its true outline; the sheets side by side along x, SHEET_GAP apart, the first at (0, 0). */
export function nestLayout(panels: Panel[], o: NestOpts): Layout {
  const r = nest(panels, o)
  const sheets: SheetBox[] = []
  let x = 0
  for (const sh of r.sheets) { sheets.push({ x, y: 0, w: sh.w, h: sh.h, ...(sh.material ? { material: sh.material } : {}), used: sh.used }); x += sh.w + SHEET_GAP }
  const placed: Placed[] = r.placed.map(p => ({ panel: p.panel, x: sheets[p.sheet].x + p.x, y: p.y, copy: p.copy, sheet: p.sheet, rot: p.rot }))
  const mats = [...new Set(sheets.map(s => s.material ?? ''))]
  const groups = mats.length > 1 ? mats.map(m => { const on = sheets.filter(s => (s.material ?? '') === m), x0 = on[0].x; return { ...(m ? { material: m } : {}), x: x0, w: on[on.length - 1].x + on[on.length - 1].w - x0, y: 0, h: Math.max(...on.map(s => s.h)) } }) : undefined
  return { placed, w: Math.max(0, x - SHEET_GAP), h: Math.max(0, ...sheets.map(s => s.h)), ...(groups ? { groups } : {}), sheets, tooBig: r.tooBig, turned: r.placed.filter(p => p.rot !== 0).length }
}

/** One sheet of a layout as a layout of its own (for a file per sheet). */
export function sheetLayout(lay: Layout, i: number): Layout {
  const sh = lay.sheets?.[i]
  if (!sh) return lay
  return { placed: lay.placed.filter(p => p.sheet === i).map(p => ({ ...p, x: p.x - sh.x, y: p.y - sh.y })), w: sh.w, h: sh.h, sheets: [{ ...sh, x: 0, y: 0 }] }
}

/** the share of the sheets' area the pieces' blocks take (0–1): what is used of what is bought */
export function usedShare(lay: Layout): number {
  const s = lay.sheets ?? []
  const all = s.reduce((a, sh) => a + sh.w * sh.h, 0)
  return all > 0 ? s.reduce((a, sh) => a + Math.min(sh.w, sh.used.w) * Math.min(sh.h, sh.used.h), 0) / all : 0
}

/** Each material in its own block, the main sheet's pieces first, the blocks stacked with a clear gap between them. */
export function layout(panels: Panel[], spacing: number, sheetW: number): Layout {
  const keys = [...new Set(panels.map(p => p.material ?? ''))].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0))
  if (keys.length < 2) return shelf(panels, spacing, sheetW)
  const gap = Math.max(12, 3 * spacing)
  const placed: Placed[] = [], groups: { material?: string; y: number; h: number }[] = []
  let y = 0, w = 0
  for (const k of keys) {
    const l = shelf(panels.filter(p => (p.material ?? '') === k), spacing, sheetW)
    for (const pl of l.placed) placed.push({ ...pl, y: pl.y + y })
    groups.push({ ...(k ? { material: k } : {}), y, h: l.h })
    y += l.h + gap; w = Math.max(w, l.w)
  }
  return { placed, w, h: y - gap, groups }
}

function shelf(panels: Panel[], spacing: number, sheetW: number): Layout {
  const items: { panel: Panel; copy: number }[] = []
  for (const p of panels) for (let i = 0; i < p.count; i++) items.push({ panel: p, copy: i })
  // tall pieces first keeps the rows tidy
  items.sort((a, b) => b.panel.h - a.panel.h || b.panel.w - a.panel.w)
  const placed: Placed[] = []
  let x = 0, y = 0, rowH = 0, maxW = 0
  for (const it of items) {
    const { w, h } = it.panel
    if (x > 0 && x + w > sheetW) { y += rowH + spacing; x = 0; rowH = 0 }
    placed.push({ panel: it.panel, x, y, copy: it.copy })
    x += w + spacing
    rowH = Math.max(rowH, h)
    maxW = Math.max(maxW, x - spacing)
  }
  return { placed, w: maxW, h: y + rowH }
}
