// The chassis number (VIN): 17 characters that say who built the car, what it is, and which year.
// Part of it can be read here without internet (the maker and the year); the rest (model, engine)
// comes from the free NHTSA decoder when the device is online.

export interface VinInfo {
  vin: string
  valid: boolean
  make?: string
  model?: string
  year?: number
  engine?: string
  body?: string
  country?: string
  source: 'local' | 'nhtsa'
  error?: string
}

// the first three characters (WMI) → the maker; the common ones in the region
const WMI: [RegExp, string][] = [
  [/^KMH|^KMF|^KM8|^KMJ|^KMC|^KMT/, 'هيونداي'], [/^KNA|^KND|^KNC|^KNE|^KNM/, 'كيا'], [/^KL[1-8]|^KLA|^KLY/, 'شيفروليه (دايو)'], [/^KPT|^KPA/, 'سانغ يونغ'],
  [/^JT|^JTD|^JTE|^JTF|^JTG|^JTH|^JTJ|^JTK|^JTL|^JTM|^JTN|^4T1|^4T3|^5TD|^5TF|^2T1|^SB1/, 'تويوتا'], [/^JTH|^JTJ|^2T2/, 'لكزس'], [/^JN|^1N4|^1N6|^3N1|^5N1|^SJN/, 'نيسان'], [/^JHM|^JHL|^1HG|^2HG|^19X|^SHH/, 'هوندا'],
  [/^JM|^1YV|^3MZ/, 'مازدا'], [/^JMB|^JA3|^JA4|^MMB|^MMC/, 'ميتسوبيشي'], [/^JS|^JSA|^TSM/, 'سوزوكي'], [/^JF|^4S3|^4S4/, 'سوبارو'],
  [/^WDB|^WDC|^WDD|^WDF|^W1K|^W1N|^W1V|^4JG/, 'مرسيدس'], [/^WBA|^WBS|^WBX|^WBY|^5UX/, 'بي إم دبليو'], [/^WAU|^WA1|^WUA/, 'أودي'], [/^WVW|^WVG|^WV1|^WV2|^1VW|^3VW|^9BW/, 'فولكس واجن'],
  [/^WP0|^WP1/, 'بورشه'], [/^VF1|^VF2/, 'رينو'], [/^VF3|^VF7/, 'بيجو'], [/^VF7|^VF8/, 'ستروين'], [/^ZFA|^ZFF/, 'فيات'], [/^SAL|^SAJ/, 'لاند روفر / جاكوار'],
  [/^1G1|^1GC|^2G1|^3G1|^1GN|^1GB|^KL4/, 'شيفروليه'], [/^1G6|^1GY/, 'كاديلاك'], [/^1GM|^1G2|^1G3|^1G4|^1G5/, 'جنرال موتورز'], [/^1FA|^1FT|^1FM|^1FD|^3FA|^WF0|^NM0/, 'فورد'],
  [/^1C3|^1C4|^1C6|^2C3|^3C4|^3C6|^1B3|^2B3|^3D4/, 'كرايسلر / دودج / جيب'], [/^LSG|^LSV|^LGB|^LFV|^LVS|^LZW|^LGX|^LJD|^LVV|^LB3|^LDC|^L6T|^LGW|^LNB|^LVG|^LSJ|^LRW|^LJ1|^LZG|^LMG/, 'صيني'],
  [/^MA1|^MA3|^MAL|^MAT|^MB1|^MBH|^MBJ|^MC2|^MEE|^MAJ|^MAK|^MBK/, 'هندي'], [/^NLE|^NLH|^NM4/, 'تركي'], [/^X|^Z7/, 'روسي'], [/^YV1|^YV4/, 'فولفو'], [/^TMB/, 'سكودا'], [/^VSS/, 'سيات'],
]
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'
const REGION: [RegExp, string][] = [[/^[J]/, 'اليابان'], [/^[K]/, 'كوريا'], [/^[L]/, 'الصين'], [/^[M]/, 'الهند / تايلاند'], [/^[S]/, 'بريطانيا'], [/^[T]/, 'تشيكيا / سويسرا'], [/^[V]/, 'فرنسا / إسبانيا'], [/^[W]/, 'ألمانيا'], [/^[X-Z]/, 'أوروبا'], [/^[1-5]/, 'أمريكا الشمالية'], [/^[6-7]/, 'أستراليا'], [/^[8-9]/, 'أمريكا الجنوبية']]

export function normalizeVin(v: string): string { return v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IOQ]/g, '') }

/** What can be read without internet: the maker, the country and the model year. */
export function decodeVinLocal(raw: string): VinInfo {
  const vin = normalizeVin(raw)
  const info: VinInfo = { vin, valid: vin.length === 17, source: 'local' }
  if (vin.length < 3) return { ...info, error: 'رقم الشاصي قصير' }
  info.make = WMI.find(([re]) => re.test(vin))?.[1]
  info.country = REGION.find(([re]) => re.test(vin))?.[1]
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
    return { ...local, source: 'nhtsa', make: make ? titleCase(make) : local.make, model: model ?? undefined, year: year ? Number(year) : local.year, engine: engine || undefined, body: pick('BodyClass') ?? undefined }
  } catch {
    return { ...local, error: local.error ?? 'لا إنترنت: قُرئت الشركة والسنة فقط من الشاصي' }
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
