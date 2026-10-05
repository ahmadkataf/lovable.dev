// A scanned box fills in its own product: the name and brand other shops gave the same barcode, or what Open
// Food Facts / Open Products Facts and UPCitemdb know about it, with a picture. The shop's server asks them
// and remembers every answer; when that server cannot be reached the app asks Open Food Facts itself.
// Only real product numbers (EAN/UPC/GTIN) are looked up or shared, never a shop's own codes.
import { API_URL } from './platform'
import { licenseDevice, licenseToken } from './license'
import { publicGtin } from './gs1'
import { shortGtin } from './productMatch'
import { shrinkImage } from './image'
import { useStore } from '../db/store'
import type { Product } from '../db/types'

export type LookupSource = 'shops' | 'openfoodfacts' | 'upcitemdb'
export interface LookupResult {
  name: string
  brand?: string
  category?: string
  quantity?: string
  /** a small picture (data URL), when one was found */
  image?: string
  source: LookupSource
  /** how many shops named it this way (shared catalogue) */
  shops?: number
}

export const SOURCE_LABEL: Record<LookupSource, string> = { shops: 'محلات أخرى تستخدم البرنامج', openfoodfacts: 'Open Food Facts', upcitemdb: 'UPCitemdb' }

const OFF = 'https://world.openfoodfacts.org/api/v2/product/'
const OFF_FIELDS = 'product_name,product_name_ar,product_name_en,generic_name,brands,quantity,image_front_small_url'
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')

async function getJson(url: string, ms: number): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } })
    let data: Record<string, unknown> | null = null
    try { data = await r.json() } catch { /* not json */ }
    return { status: r.status, data }
  } finally { clearTimeout(t) }
}
async function picture(url: string, ms = 8000): Promise<string | undefined> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok || !/^image\//.test(r.headers.get('content-type') ?? 'image/')) return undefined
    return await shrinkImage(await r.blob())
  } catch { return undefined } finally { clearTimeout(t) }
}

/** The shop's server: the shared catalogue, its cache and both outside databases. null = could not ask. */
async function viaServer(code: string, withImage: boolean): Promise<LookupResult | false | null> {
  if (!API_URL) return null
  let device = ''
  try { device = await licenseDevice() } catch { return null }
  const q = `code=${encodeURIComponent(code)}&device=${device}`
  let res
  try { res = await getJson(`${API_URL}/api/catalog/lookup?${q}`, 12000) } catch { return null }
  const d = res.data
  if (res.status !== 200 || !d || typeof d.found !== 'boolean') return null
  if (!d.found) return d.retry ? null : false
  const name = clean(d.name, 120)
  if (!name) return false
  const source = (['shops', 'openfoodfacts', 'upcitemdb'] as const).find(s => s === d.source) ?? 'openfoodfacts'
  return {
    name, brand: clean(d.brand, 60) || undefined, category: clean(d.category, 60) || undefined, quantity: clean(d.quantity, 40) || undefined, source,
    shops: typeof d.shops === 'number' ? d.shops : undefined,
    image: withImage && d.image ? await picture(`${API_URL}/api/catalog/image?${q}`) : undefined,
  }
}

/** Open Food Facts straight from the app (it allows that); it sends non-food products to its sister sites. */
async function viaOpenFoodFacts(code: string, withImage: boolean): Promise<LookupResult | null> {
  const { status, data } = await getJson(`${OFF}${code}.json?product_type=all&fields=${OFF_FIELDS}`, 9000)
  const p = status === 200 && data && data.status === 1 ? (data.product as Record<string, unknown> | undefined) : undefined
  if (!p) return null
  const name = clean(p.product_name_ar, 120) || clean(p.product_name, 120) || clean(p.product_name_en, 120) || clean(p.generic_name, 120)
  if (!name) return null
  const img = clean(p.image_front_small_url, 500)
  return {
    name, brand: clean(p.brands, 200).split(',')[0]?.trim().slice(0, 60) || undefined, quantity: clean(p.quantity, 40) || undefined, source: 'openfoodfacts',
    image: withImage && /^https:\/\//.test(img) ? await picture(img) : undefined,
  }
}

// UPCitemdb allows each internet address 100 free lookups a day: keep well under it
const UPC_KEY = 'alradwan.upcDay'
const UPC_PER_DAY = 90
function upcLeft(): boolean {
  try { const d = JSON.parse(localStorage.getItem(UPC_KEY) || '{}') as { day?: string; n?: number }; return d.day !== new Date().toDateString() || (d.n ?? 0) < UPC_PER_DAY } catch { return true }
}
function upcUsed() {
  try { const day = new Date().toDateString(); const d = JSON.parse(localStorage.getItem(UPC_KEY) || '{}') as { day?: string; n?: number }; localStorage.setItem(UPC_KEY, JSON.stringify({ day, n: d.day === day ? (d.n ?? 0) + 1 : 1 })) } catch { /* private mode */ }
}
/** UPCitemdb answers programs, not web pages: the Windows app (main process) or the Android app asks it. */
let nativeUpc: ((code: string) => Promise<{ status: number; body: string } | null>) | null = null
export function setNativeUpc(fn: typeof nativeUpc) { nativeUpc = fn }
async function viaUpcItemDb(code: string, withImage: boolean): Promise<LookupResult | null> {
  const ask = (typeof window !== 'undefined' && window.garageDesktop?.upcLookup) || nativeUpc
  if (!ask || !upcLeft()) return null
  const res = await ask(code)
  if (!res) return null
  if (res.status !== 0) upcUsed()
  if (res.status !== 200) return null
  let d: { items?: Record<string, unknown>[] } | null = null
  try { d = JSON.parse(res.body) } catch { return null }
  const it = Array.isArray(d?.items) ? d!.items[0] : null
  const name = clean(it?.title, 120)
  if (!it || !name) return null
  const img = Array.isArray(it.images) ? (it.images as unknown[]).find((u): u is string => typeof u === 'string' && /^https:\/\//.test(u)) : undefined
  return {
    name, brand: clean(it.brand, 60) || undefined, category: clean(it.category, 200).split('>').pop()?.trim().slice(0, 60) || undefined, source: 'upcitemdb',
    // shop sites often refuse pictures to other pages; then there is simply no picture
    image: withImage && img ? await picture(img) : undefined,
  }
}

const memo = new Map<string, Promise<LookupResult | null>>()

/** What the world knows about a barcode, or null (not a product number, unknown, or no internet). */
export function lookupProduct(code: string, opts: { image?: boolean } = {}): Promise<LookupResult | null> {
  const g = publicGtin(code)
  if (!g) return Promise.resolve(null)
  const key = `${g}|${opts.image !== false}`
  let p = memo.get(key)
  if (!p) {
    const digits = shortGtin(g).length < 13 && shortGtin(g).length !== 8 ? g.slice(1) : shortGtin(g)
    p = (async () => {
      const withImage = opts.image !== false
      // the shop's server first (the shared catalogue, its memory, Open Food Facts and UPCitemdb)
      const s = await viaServer(digits, withImage).catch(() => null)
      if (s) return s
      // it looked everywhere and found nothing
      if (s === false) return null
      // no server, or it could not ask everyone: the app asks Open Food Facts and UPCitemdb itself
      return (await viaOpenFoodFacts(digits, withImage).catch(() => null)) ?? viaUpcItemDb(digits, withImage).catch(() => null)
    })()
    memo.set(key, p)
    // a failure (no internet) may be retried later; an answer is kept for the session
    void p.then(r => { if (!r) setTimeout(() => memo.delete(key), 60000) })
  }
  return p
}

/** Whether this shop looks barcodes up (on unless switched off in the scanner settings). */
export const lookupEnabled = () => useStore.getState().cfg.barcodeLookup !== false

// ------------------------------------------------------------------------------------------- sharing names
const SHARED_KEY = 'alradwan.catalogShared'
let sharing: Promise<void> | null = null
let again = false

/** Sends the names of products with a real barcode, changed since the last time, to the shared catalogue:
 *  barcode, name, brand, category and unit only — never prices, quantities or anything about the shop.
 *  Only from activated copies, and only while the shop allows it. */
export function shareCatalogChanges(): Promise<void> {
  if (sharing) { again = true; return sharing }
  sharing = (async () => {
    try {
      const st = useStore.getState()
      if (!API_URL || st.cfg.shareCatalog === false) return
      const token = licenseToken()
      if (!token) return
      const device = await licenseDevice()
      let since = 0
      try { since = Number(localStorage.getItem(SHARED_KEY)) || 0 } catch { /* private mode */ }
      const cats = st.categories as unknown as Map<string, { name: string }>
      const items: { code: string; name: string; brand?: string; category?: string; unit?: string }[] = []
      let newest = since
      for (const p of (st.products as unknown as Map<string, Product>).values()) {
        if ((p.updatedAt ?? 0) <= since) continue
        newest = Math.max(newest, p.updatedAt ?? 0)
        const name = p.name?.trim() ?? ''
        // a placeholder name ("قطعة 629…") teaches nobody anything
        if (name.length < 2 || /^قطعة\s+\d+$/.test(name)) continue
        for (const b of (p.barcode ?? '').split(/[,\n;،؛]+/).map(x => x.trim()).filter(Boolean)) {
          if (!publicGtin(b)) continue
          items.push({ code: b, name: name.slice(0, 120), brand: p.brand?.trim().slice(0, 60) || undefined, category: p.categoryId ? cats.get(p.categoryId)?.name?.slice(0, 60) : undefined, unit: p.unit?.slice(0, 60) || undefined })
        }
      }
      for (let i = 0; i < items.length; i += 50) {
        const r = await fetch(`${API_URL}/api/catalog/contribute`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, device, items: items.slice(i, i + 50) }) })
        if (!r.ok) return
      }
      try { localStorage.setItem(SHARED_KEY, String(newest)) } catch { /* private mode */ }
    } catch { /* offline: next time */ } finally {
      sharing = null
      if (again) { again = false; setTimeout(() => void shareCatalogChanges(), 5000) }
    }
  })()
  return sharing
}
