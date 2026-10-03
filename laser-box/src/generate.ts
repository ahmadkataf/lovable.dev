// From a template and its numbers to panels laid out on a sheet.
import { buildPanel, applyKerf, Panel } from './joints'
import { layout, Layout } from './layout'
import { Template, Common } from './templates'
import { loopLength } from './geom'

export interface Settings extends Common { spacing: number; sheetW: number }

export interface Design {
  panels: Panel[]
  layout: Layout
  notes: string[]
  warnings: string[]
  cutLength: number
  pieceCount: number
}

export const DEFAULT_SETTINGS: Settings = { t: 3, kerf: 0.15, finger: 9, inner: false, spacing: 3, sheetW: 400 }

export function generate(tpl: Template, params: Record<string, number>, s: Settings): Design {
  const p = { ...tpl.defaults, ...params }
  if (s.inner) {
    const add = tpl.innerAdd(s.t)
    p.W += add.W; p.D += add.D; p.H += add.H
  }
  const res = tpl.build(p, s)
  const panels = res.panels.map(spec => applyKerf(buildPanel(spec, { t: s.t, finger: s.finger }), s.kerf))
  const lay = layout(panels, s.spacing, s.sheetW)
  let cutLength = 0, pieceCount = 0
  for (const pn of panels) { pieceCount += pn.count; for (const l of pn.loops) cutLength += loopLength(l) * pn.count }
  return { panels, layout: lay, notes: res.notes, warnings: res.warnings, cutLength, pieceCount }
}
