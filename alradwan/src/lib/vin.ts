// The chassis number (VIN): 17 characters that say who built the car, what it is, and which year.
// The maker, the country, the year and (for the common makes) the model line are read here without
// internet from the tables in vinData.ts; the engine and the exact trim come from the free NHTSA decoder when online.

export interface VinInfo {
  vin: string
  valid: boolean
  make?: string
  model?: string
  year?: number
  engine?: string
  body?: string
  country?: string
  modelYears?: string     // the generation's years, when read from the local tables
  source: 'local' | 'nhtsa'
  error?: string
}

import { MODELS, REGION, WMI, YEAR_CODES } from './vinData'

/** The maker from the longest known prefix of the VIN ("KMHD" before "KMH" before "KM"). */
export function makerOf(vin: string): { make: string; country: string } | undefined {
  for (let n = Math.min(4, vin.length); n >= 1; n--) { const hit = WMI[vin.slice(0, n)]; if (hit) return hit }
  return undefined
}
/** The model line, when the maker's own coding is known to the app. */
export function modelOf(vin: string): { model: string; years?: string } | undefined {
  for (const r of MODELS) if (r.re.test(vin)) return { model: r.model, years: r.years || undefined }
  return undefined
}

export function normalizeVin(v: string): string { return v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IOQ]/g, '') }

/** What can be read without internet: the maker, the country and the model year. */
export function decodeVinLocal(raw: string): VinInfo {
  const vin = normalizeVin(raw)
  const info: VinInfo = { vin, valid: vin.length === 17, source: 'local' }
  if (vin.length < 3) return { ...info, error: 'رقم الشاصي قصير' }
  const maker = makerOf(vin)
  info.make = maker?.make
  info.country = maker?.country ?? REGION.find(([re]) => re.test(vin))?.[1]
  if (vin.length >= 8) { const m = modelOf(vin); if (m) { info.model = m.model; info.modelYears = m.years } }
  if (vin.length >= 10) {
    // the 10th character is the model year; the same letters repeat every 30 years, so pick the run that makes sense now
    const idx = YEAR_CODES.indexOf(vin[9])
    if (idx >= 0) {
      const now = new Date().getFullYear()
      let y = 1980 + idx
      while (y + 30 <= now + 1) y += 30
      info.year = y
    }
  }
  if (!info.valid) info.error = 'رقم الشاصي يجب أن يكون 17 حرفاً ورقماً'
  return info
}

/** The full decode from NHTSA (free, no key). Needs internet; falls back to the local read. */
export async function decodeVin(raw: string): Promise<VinInfo> {
  const local = decodeVinLocal(raw)
  if (!local.valid) return local
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000)
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(local.vin)}?format=json`, { signal: ctl.signal })
    clearTimeout(t)
    if (!res.ok) throw new Error(String(res.status))
    const r = ((await res.json()) as { Results?: Record<string, string>[] }).Results?.[0] ?? {}
    const pick = (k: string) => (r[k] && r[k].trim() && r[k] !== 'Not Applicable' ? r[k].trim() : undefined)
    const make = pick('Make'), model = pick('Model'), year = pick('ModelYear')
    const engine = [pick('DisplacementL') ? `${Number(pick('DisplacementL')).toFixed(1)} لتر` : '', pick('EngineCylinders') ? `${pick('EngineCylinders')} سلندر` : '', pick('FuelTypePrimary') === 'Diesel' ? 'ديزل' : '', pick('EngineModel') ?? ''].filter(Boolean).join(' · ')
    if (!make && !model) return { ...local, source: 'nhtsa', error: local.make ? undefined : 'لم يتعرف المفكّك على هذا الشاصي؛ أدخل بيانات السيارة يدوياً' }
    return { ...local, source: 'nhtsa', make: make ? titleCase(make) : local.make, model: model ?? local.model, year: year ? Number(year) : local.year, engine: engine || undefined, body: pick('BodyClass') ?? undefined }
  } catch {
    return { ...local, error: local.error ?? (local.model ? undefined : 'لا إنترنت: قُرئت الشركة والسنة من الشاصي، والموديل غير معروف محلياً') }
  }
}

function titleCase(s: string) { return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }

/** The picture catalogues, opened on this chassis number (they hold the manufacturers' exploded diagrams). */
export function catalogueLinks(vin: string): { name: string; url: string }[] {
  const v = encodeURIComponent(normalizeVin(vin))
  return [
    { name: 'PartSouq', url: `https://partsouq.com/en/search/all?q=${v}` },
    { name: 'Amayama', url: `https://www.amayama.com/en/search?q=${v}` },
  ]
}

/** A search for an original part number on the web. */
export function oemSearchLink(oem: string): string { return `https://www.google.com/search?q=${encodeURIComponent(oem.trim() + ' part')}` }

/** Splits "12345-2E000, 26300-35503" into clean numbers. */
export function splitOem(s: string | undefined): string[] { return (s ?? '').split(/[,\n;،؛]+/).map(x => x.trim()).filter(Boolean) }
