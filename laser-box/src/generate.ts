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
  /** problems that make the design unusable: the files should not be cut */
  errors: string[]
  cutLength: number
  pieceCount: number
  /** the finger width actually used (auto when the setting is 0) */
  finger: number
}

/** finger = 0 means automatic: between two and three thicknesses, and never more than a fifth of the smallest dimension */
export const DEFAULT_SETTINGS: Settings = { t: 3, kerf: 0.15, finger: 0, inner: false, spacing: 3, sheetW: 400 }

export function autoFinger(t: number, dims: number[]): number {
  const smallest = Math.min(...dims.filter(v => Number.isFinite(v) && v > 0), Infinity)
  const byDim = Number.isFinite(smallest) ? smallest / 5 : 3 * t
  return Math.round(Math.max(2 * t, Math.min(3 * t, byDim)) * 10) / 10
}

export function generate(tpl: Template, params: Record<string, number>, s: Settings): Design {
  const p = { ...tpl.defaults, ...params }
  if (s.inner) {
    const add = tpl.innerAdd(s.t)
    for (const k of ['W', 'D', 'H'] as const) if (Number.isFinite(p[k])) p[k] += add[k]
  }
  const finger = s.finger > 0 ? s.finger : autoFinger(s.t, [p.W, p.D, p.H])
  const res = tpl.build(p, { ...s, finger })
  const panels = res.panels.map(spec => applyKerf(buildPanel(spec, { t: s.t, finger }), s.kerf))
  const lay = layout(panels, s.spacing, s.sheetW)
  let cutLength = 0, pieceCount = 0
  for (const pn of panels) { pieceCount += pn.count; for (const l of pn.loops) cutLength += loopLength(l) * pn.count }
  return { panels, layout: lay, notes: res.notes, warnings: res.warnings, errors: res.errors ?? [], cutLength, pieceCount, finger }
}
