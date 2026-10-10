// From a template and its numbers to panels laid out on a sheet.
import { buildPanel, applyKerf, Panel } from './joints'
import { layout, Layout } from './layout'
import { Template, Common } from './templates'
import { loopLength, signedArea, bbox } from './geom'
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

/** 9.600000000000001 → 9.6 in the texts shown to the user (two decimals at most, so a minimum is never rounded below itself by more than 0.005) */
const tidy = (s: string) => s.replace(/\d+\.\d{3,}/g, m => String(Math.round(parseFloat(m) * 100) / 100))

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
  // an engraved line past its piece's outline would burn the bed or the next piece: say so (a door arch on a wide board, say)
  const stray = built.find(b => { const box = bbox(b.loops.filter(l => l.layer !== 'engrave')), e = bbox(b.loops.filter(l => l.layer === 'engrave')); return b.loops.some(l => l.layer === 'engrave') && (e.minX < box.minX - 0.5 || e.minY < box.minY - 0.5 || e.maxX > box.maxX + 0.5 || e.maxY > box.maxY + 0.5) })
  if (stray) errors.push(`النقش يخرج عن حدود «${stray.name}» بهذه المقاسات: غيّر القياسات (مثلاً اجعل اللوح أطول من عرضه).`)
  const panels = built.map(b => applyKerf(b, s.kerf))
  const lay = layout(panels, s.spacing, s.sheetW)
  let cutLength = 0, pieceCount = 0
  for (const pn of panels) { pieceCount += pn.count; for (const l of pn.loops) cutLength += loopLength(l) * pn.count }
  // pieces for other sheets: say which colour (= RDWorks layer) belongs to which material
  const mats = [...new Set(panels.map(p => p.material).filter((m): m is string => !!m))]
  const notes = mats.length ? [...res.notes, `الملف مقسوم حسب الخامة، كلّ خامة في كتلة ولون خاصّ: الأحمر للخامة الأساسية، ${mats.map(m => `${COLOUR_NAME[MATERIAL_INFO[m]?.hex] ?? m} لـ${MATERIAL_INFO[m]?.label ?? m}`).join('، ')}. في RDWorks اقصّ كلّ لوح وحده: شغّل طبقة لونه وأوقف الباقي (Output = No).`] : res.notes
  // anything that slots together is sized on the thickness entered: say so, since a «3 mm» sheet is often 3.3
  // (finger joints, or a slot hole about as wide as the stock and longer than it is wide)
  const isSlot = (l: { closed: boolean; layer?: string; pts: { x: number; y: number }[] }) => {
    if (!l.closed || l.layer === 'engrave' || signedArea(l as never) >= 0) return false
    const b = bbox([l as never]), a = b.maxX - b.minX, c = b.maxY - b.minY, short = Math.min(a, c), long = Math.max(a, c)
    return short > 0.8 * s.t && short < s.t + 1 && long > 1.5 * short
  }
  const slotted = !!res.slotted || built.some(b => Number.isFinite(b.minFinger) || b.loops.some(isSlot))
  const fitNote = slotted ? [`الشقوق والأصابع مقاسة على سماكة ${s.t} مم بالضبط مع خلوص صغير: قِس لوحك (وفي أكثر من مكان) وأدخل سماكته الحقيقية قبل القصّ، أو اقصّ «اختبار التعشيق» من قسم المعايرة أولاً.`] : []
  return { panels, layout: lay, notes: [...notes, ...fitNote].map(tidy), warnings: warnings.map(tidy), errors: errors.map(tidy), cutLength, pieceCount, finger }
}
