// Arranges panels on a sheet: rows (shelves) filled right to left up to the sheet width.
import { Panel } from './joints'

export interface Placed { panel: Panel; x: number; y: number; copy: number }
export interface Layout { placed: Placed[]; w: number; h: number }

export function layout(panels: Panel[], spacing: number, sheetW: number): Layout {
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
