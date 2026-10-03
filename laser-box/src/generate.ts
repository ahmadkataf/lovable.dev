// From a template and its numbers to panels laid out on a sheet.
import { buildPanel, applyKerf, Panel } from './joints'
import { layout, Layout } from './layout'
import { Template, Common } from './templates'
import { loopLength } from './geom'
import { MATERIAL_INFO, COLOUR_NAME } from './materials'

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
    const add = tpl.innerAdd(s.t, p)
    for (const k of ['W', 'D', 'H'] as const) if (Number.isFinite(p[k])) p[k] += add[k]
  }
  const finger = s.finger > 0 ? s.finger : autoFinger(s.t, [p.W, p.D, p.H])
  const res = tpl.build(p, { ...s, finger })
  const built = res.panels.map(spec => buildPanel(spec, { t: s.t, finger }))
  // judge the fingers actually cut, not the setting: the count is rounded to an odd number, so they come out narrower or wider
  const errors = [...(res.errors ?? [])], warnings = [...res.warnings]
  const neckMin = Math.max(1, 0.25 * s.t)
  const thin = built.filter(b => b.minFinger < 0.8 * s.t), weak = built.filter(b => b.minFinger >= 0.8 * s.t && b.minFinger < s.t)
  const loose = built.filter(b => b.cornerNeck < neckMin)
  const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
  if (thin.length) errors.push(`أصابع التعشيق في «${thin[0].name}» عرضها ${f1(thin[0].minFinger)} مم فقط، أرقّ من السماكة ${s.t} مم؛ كبّر عرض الأصبع أو القياس.`)
  if (loose.length) errors.push(`أصبع الزاوية في «${loose[0].name}» سيتّصل بشريحة رفيعة وينكسر؛ اجعل عرض الأصبع ${f1(s.t + neckMin + 0.5)} مم أو أكثر (أو اتركه تلقائياً).`)
  if (!thin.length && weak.length) warnings.push(`أصابع «${weak[0].name}» أرقّ قليلاً من السماكة (${f1(weak[0].minFinger)} مم)؛ ستكون ضعيفة.`)
  const panels = built.map(b => applyKerf(b, s.kerf))
  const lay = layout(panels, s.spacing, s.sheetW)
  let cutLength = 0, pieceCount = 0
  for (const pn of panels) { pieceCount += pn.count; for (const l of pn.loops) cutLength += loopLength(l) * pn.count }
  // pieces for other sheets: say which colour (= RDWorks layer) belongs to which material
  const mats = [...new Set(panels.map(p => p.material).filter((m): m is string => !!m))]
  const notes = mats.length ? [...res.notes, `الملف مقسوم حسب الخامة، كلّ خامة في كتلة ولون خاصّ: الأحمر للخامة الأساسية، ${mats.map(m => `${COLOUR_NAME[MATERIAL_INFO[m]?.hex] ?? m} لـ${MATERIAL_INFO[m]?.label ?? m}`).join('، ')}. في RDWorks اقصّ كلّ لوح وحده: شغّل طبقة لونه وأوقف الباقي (Output = No).`] : res.notes
  return { panels, layout: lay, notes, warnings, errors, cutLength, pieceCount, finger }
}
