import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupProduct } from '../lib/productLookup'

const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('looking a barcode up', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  it('never asks about a shop\'s own codes', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect(await lookupProduct('P-0001')).toBeNull()
    expect(await lookupProduct('2001234567894')).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
  it('reads Open Food Facts, preferring the Arabic name and the first brand', async () => {
    const f = vi.fn(async (url: string) => {
      expect(url).toContain('/api/v2/product/4006381333931.json?product_type=all')
      return answer({ status: 1, product: { product_name: 'Oil filter', product_name_ar: ' فلتر  زيت ', brands: 'Bosch, Bosch Auto', quantity: '1 pc' } })
    })
    vi.stubGlobal('fetch', f)
    const r = await lookupProduct('4006381333931', { image: false })
    expect(r).toEqual({ name: 'فلتر زيت', brand: 'Bosch', quantity: '1 pc', source: 'openfoodfacts', image: undefined })
  })
  it('asks a UPC-A by its 13-digit form and answers null when unknown or offline', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return answer({ status: 0 }) }))
    expect(await lookupProduct('036000291452', { image: false })).toBeNull()
    expect(urls[0]).toContain('/product/0036000291452.json')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await lookupProduct('5449000000996', { image: false })).toBeNull()
  })
  it('asks UPCitemdb through the app when Open Food Facts does not know it, within the daily allowance', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } })
    vi.stubGlobal('fetch', vi.fn(async () => answer({ status: 0 }, 404)))
    const upc = vi.fn(async () => ({ status: 200, body: JSON.stringify({ code: 'OK', total: 1, items: [{ title: 'NGK BKR6E Spark Plug', brand: 'NGK', category: 'Vehicles & Parts > Ignition > Spark Plugs', images: [] }] }) }))
    vi.stubGlobal('window', { garageDesktop: { upcLookup: upc } })
    const r = await lookupProduct('087295469620', { image: false })
    expect(r).toMatchObject({ name: 'NGK BKR6E Spark Plug', brand: 'NGK', category: 'Spark Plugs', source: 'upcitemdb' })
    expect(upc).toHaveBeenCalledWith('0087295469620')
    store.set('alradwan.upcDay', JSON.stringify({ day: new Date().toDateString(), n: 90 }))
    expect(await lookupProduct('4011558744502', { image: false })).toBeNull()
    expect(upc).toHaveBeenCalledTimes(1)
  })
})
