// Tooth metadata for the dental chart (FDI / ISO 3950 numbering).
// Adult: 11–18, 21–28, 31–38, 41–48. Primary: 51–55, 61–65, 71–75, 81–85.
// Quadrants: 1/5 upper right · 2/6 upper left · 3/7 lower left · 4/8 lower right (the patient's sides).
import type { Lang, ToothCondition, ToothSurface } from '@/db/types'
import { translate } from '@/i18n'

export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'
export type Arch = 'upper' | 'lower'
export type Dentition = 'adult' | 'primary' | 'mixed'
/** The patient's side. Upper-right teeth are drawn on the viewer's left, as on every paper chart. */
export type Side = 'right' | 'left'

export interface ToothInfo {
  n: number
  quadrant: number              // 1–8
  arch: Arch
  side: Side
  pos: number                   // 1 = central incisor … 8 = third molar (1–5 for primary teeth)
  type: ToothType
  primary: boolean
  anterior: boolean             // incisors and canines: incisal edge (I) instead of occlusal (O)
  surfaces: ToothSurface[]      // clickable surfaces, root last
}

const ADULT_TYPES: ToothType[] = ['incisor', 'incisor', 'canine', 'premolar', 'premolar', 'molar', 'molar', 'molar']
const PRIMARY_TYPES: ToothType[] = ['incisor', 'incisor', 'canine', 'molar', 'molar']

export const ANTERIOR_SURFACES: ToothSurface[] = ['M', 'D', 'I', 'B', 'L', 'R']
export const POSTERIOR_SURFACES: ToothSurface[] = ['M', 'D', 'O', 'B', 'L', 'R']
/** Canonical order used when storing and displaying surfaces. */
export const SURFACE_ORDER: ToothSurface[] = ['M', 'O', 'I', 'D', 'B', 'L', 'R']

export function isValidTooth(n: number): boolean {
  if (!Number.isInteger(n)) return false
  const q = Math.floor(n / 10), p = n % 10
  if (q >= 1 && q <= 4) return p >= 1 && p <= 8
  if (q >= 5 && q <= 8) return p >= 1 && p <= 5
  return false
}
export function isPrimary(n: number): boolean { return isValidTooth(n) && n >= 51 }

const cache = new Map<number, ToothInfo>()
/** Metadata of one tooth, or null for a number that is not an FDI tooth. */
export function toothInfo(n: number): ToothInfo | null {
  if (!isValidTooth(n)) return null
  const hit = cache.get(n)
  if (hit) return hit
  const quadrant = Math.floor(n / 10), pos = n % 10
  const primary = quadrant >= 5
  const q = primary ? quadrant - 4 : quadrant
  const type = (primary ? PRIMARY_TYPES : ADULT_TYPES)[pos - 1]
  const anterior = type === 'incisor' || type === 'canine'
  const info: ToothInfo = {
    n, quadrant, pos, type, primary, anterior,
    arch: q <= 2 ? 'upper' : 'lower',
    side: q === 1 || q === 4 ? 'right' : 'left',
    surfaces: anterior ? ANTERIOR_SURFACES : POSTERIOR_SURFACES,
  }
  cache.set(n, info)
  return info
}

const range = (q: number, count: number, reverse: boolean) => {
  const out: number[] = []
  for (let i = 1; i <= count; i++) out.push(q * 10 + i)
  return reverse ? out.reverse() : out
}

/** The rows of the chart as the viewer sees them: patient's right on the viewer's left. */
export const ROWS = {
  upperAdult: [...range(1, 8, true), ...range(2, 8, false)],      // 18 … 11 | 21 … 28
  lowerAdult: [...range(4, 8, true), ...range(3, 8, false)],      // 48 … 41 | 31 … 38
  upperPrimary: [...range(5, 5, true), ...range(6, 5, false)],    // 55 … 51 | 61 … 65
  lowerPrimary: [...range(8, 5, true), ...range(7, 5, false)],    // 85 … 81 | 71 … 75
} as const

export const ADULT_TEETH: number[] = [...ROWS.upperAdult, ...ROWS.lowerAdult]
export const PRIMARY_TEETH: number[] = [...ROWS.upperPrimary, ...ROWS.lowerPrimary]

/** Every tooth shown for a dentition, upper row first, in chart order. */
export function toothsOf(dentition: Dentition): number[] {
  if (dentition === 'adult') return [...ADULT_TEETH]
  if (dentition === 'primary') return [...PRIMARY_TEETH]
  return [...ROWS.upperAdult, ...ROWS.upperPrimary, ...ROWS.lowerPrimary, ...ROWS.lowerAdult]
}
/** Alias with the usual spelling. */
export const teethOf = toothsOf

/** The row (as drawn) that contains this tooth. */
export function rowOf(n: number): readonly number[] {
  const i = toothInfo(n)
  if (!i) return []
  if (i.arch === 'upper') return i.primary ? ROWS.upperPrimary : ROWS.upperAdult
  return i.primary ? ROWS.lowerPrimary : ROWS.lowerAdult
}

/** Adjacent teeth in the same arch (across the midline too: 11 ↔ 21). Used to join bridge units. */
export function neighbours(n: number): number[] {
  const row = rowOf(n)
  const k = row.indexOf(n)
  if (k < 0) return []
  const out: number[] = []
  if (k > 0) out.push(row[k - 1])
  if (k < row.length - 1) out.push(row[k + 1])
  return out
}
export function areNeighbours(a: number, b: number): boolean { return neighbours(a).includes(b) }

/** The surfaces this tooth can have, with O and I mapped to the right one for its type, deduped, in canonical order. */
export function normalizeSurfaces(n: number, surfaces: readonly ToothSurface[]): ToothSurface[] {
  const info = toothInfo(n)
  if (!info) return []
  const set = new Set<ToothSurface>()
  for (const s of surfaces) {
    const mapped: ToothSurface = s === 'O' && info.anterior ? 'I' : s === 'I' && !info.anterior ? 'O' : s
    if (info.surfaces.includes(mapped)) set.add(mapped)
  }
  return SURFACE_ORDER.filter(s => set.has(s))
}

// ---- names ---------------------------------------------------------------------------------------
const NAME_KEY: Record<string, string> = {
  'a1': 'central', 'a2': 'lateral', 'a3': 'canine', 'a4': 'premolar1', 'a5': 'premolar2', 'a6': 'molar1', 'a7': 'molar2', 'a8': 'molar3',
  'p1': 'pCentral', 'p2': 'pLateral', 'p3': 'pCanine', 'p4': 'pMolar1', 'p5': 'pMolar2',
}
/** Grammatical gender of the Arabic name (الثنية، الرباعية، الرحى are feminine; الناب، الضاحك، ضرس العقل masculine). */
const MASCULINE = new Set(['canine', 'premolar1', 'premolar2', 'molar3', 'pCanine'])
export function quadrantKey(n: number): 'UR' | 'UL' | 'LL' | 'LR' {
  const i = toothInfo(n)
  if (!i) return 'UR'
  return i.arch === 'upper' ? (i.side === 'right' ? 'UR' : 'UL') : (i.side === 'right' ? 'LR' : 'LL')
}

/** "الرحى الأولى العلوية اليمنى" / "Upper right first molar". */
export function toothLabel(n: number, lang: Lang): string {
  const i = toothInfo(n)
  if (!i) return String(n)
  const key = NAME_KEY[(i.primary ? 'p' : 'a') + i.pos]
  const name = translate(lang, `chart.tn.${key}`)
  const pos = translate(lang, `chart.qpos.${quadrantKey(n)}.${MASCULINE.has(key) ? 'm' : 'f'}`)
  return translate(lang, 'chart.toothName', { name, pos })
}
/** "السن 16" / "Tooth 16". */
export function toothShort(n: number, lang: Lang): string { return translate(lang, 'chart.toothN', { n }) }

// ---- conditions ----------------------------------------------------------------------------------
/**
 * How a condition is drawn and how it behaves when recorded.
 *  scope  'surface' → recorded on surfaces (caries, fillings, sealants, fractures)
 *         'tooth'   → recorded on the whole tooth
 *         'clear'   → healthy: clears what it overlaps, never stays active
 *  layer  (whole-tooth only) decides what a new record replaces — see supersedes() in lib.ts:
 *         'replace' the tooth itself is gone / replaced (missing, implant, impacted)
 *         'restoration' covers the crown (crown, bridge, veneer)
 *         'endo' lives in the root (root canal)
 *         'flag' a remark that stacks with everything (to extract, mobile, abscess, attrition, other)
 *  glyph  what the chart draws for it.
 */
export type ConditionScope = 'surface' | 'tooth' | 'clear'
export type ConditionLayer = 'surface' | 'replace' | 'restoration' | 'endo' | 'flag' | 'clear'
export type ConditionGlyph = 'none' | 'fill' | 'cross' | 'screw' | 'outline' | 'bar' | 'band' | 'root' | 'strike' | 'hatch' | 'badge'
export interface ConditionMeta { color: string; scope: ConditionScope; layer: ConditionLayer; glyph: ConditionGlyph; tone: 'danger' | 'info' | 'warning' | 'success' | 'purple' | 'pink' | 'orange' | 'default' | 'accent' | 'primary' }

// Tokens exist for most conditions; the few without a dedicated token fall back to a semantic colour.
const tok = (c: ToothCondition, fallback?: string) => fallback ? `var(--tooth-${c}, ${fallback})` : `var(--tooth-${c})`
export const CONDITION_META: Record<ToothCondition, ConditionMeta> = {
  healthy: { color: tok('healthy'), scope: 'clear', layer: 'clear', glyph: 'none', tone: 'success' },
  caries: { color: tok('caries'), scope: 'surface', layer: 'surface', glyph: 'fill', tone: 'danger' },
  filled: { color: tok('filled'), scope: 'surface', layer: 'surface', glyph: 'fill', tone: 'info' },
  sealant: { color: tok('sealant'), scope: 'surface', layer: 'surface', glyph: 'fill', tone: 'success' },
  fracture: { color: tok('fracture'), scope: 'surface', layer: 'surface', glyph: 'fill', tone: 'orange' },
  crown: { color: tok('crown'), scope: 'tooth', layer: 'restoration', glyph: 'outline', tone: 'warning' },
  bridge: { color: tok('bridge'), scope: 'tooth', layer: 'restoration', glyph: 'bar', tone: 'info' },
  veneer: { color: tok('veneer'), scope: 'tooth', layer: 'restoration', glyph: 'band', tone: 'primary' },
  root_canal: { color: tok('root_canal'), scope: 'tooth', layer: 'endo', glyph: 'root', tone: 'pink' },
  missing: { color: tok('missing'), scope: 'tooth', layer: 'replace', glyph: 'cross', tone: 'default' },
  implant: { color: tok('implant'), scope: 'tooth', layer: 'replace', glyph: 'screw', tone: 'purple' },
  impacted: { color: tok('impacted'), scope: 'tooth', layer: 'replace', glyph: 'hatch', tone: 'default' },
  to_extract: { color: tok('to_extract'), scope: 'tooth', layer: 'flag', glyph: 'strike', tone: 'danger' },
  mobile: { color: tok('mobile', 'var(--warning)'), scope: 'tooth', layer: 'flag', glyph: 'badge', tone: 'warning' },
  abscess: { color: tok('abscess', 'var(--danger)'), scope: 'tooth', layer: 'flag', glyph: 'badge', tone: 'danger' },
  attrition: { color: tok('attrition', 'var(--orange)'), scope: 'tooth', layer: 'flag', glyph: 'badge', tone: 'orange' },
  other: { color: tok('other', 'var(--text-3)'), scope: 'tooth', layer: 'flag', glyph: 'badge', tone: 'default' },
}

export const SURFACE_CONDITIONS: ToothCondition[] = ['caries', 'filled', 'sealant', 'fracture']
export const WHOLE_CONDITIONS: ToothCondition[] = ['crown', 'root_canal', 'bridge', 'veneer', 'implant', 'missing', 'to_extract', 'impacted', 'mobile', 'abscess', 'attrition', 'other']
/** Legend / palette order. */
export const LEGEND_ORDER: ToothCondition[] = ['caries', 'filled', 'sealant', 'fracture', 'crown', 'root_canal', 'bridge', 'veneer', 'implant', 'missing', 'to_extract', 'impacted', 'mobile', 'abscess', 'attrition', 'other']

export const isSurfaceCondition = (c: ToothCondition) => CONDITION_META[c].scope === 'surface'
export const isWholeCondition = (c: ToothCondition) => CONDITION_META[c].scope === 'tooth'
