// Arranges panels on a sheet: rows (shelves) filled right to left up to the sheet width.
import { Panel } from './joints'

export interface Placed { panel: Panel; x: number; y: number; copy: number }
export interface Layout { placed: Placed[]; w: number; h: number; groups?: { material?: string; y: number; h: number }[] }

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
