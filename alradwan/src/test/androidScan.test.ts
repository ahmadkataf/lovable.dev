import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const emitScan = vi.fn(async () => true)
vi.mock('../lib/scan', () => ({ emitScan }))

// the Android app talks to the page through window events; a bare EventTarget stands in for the window
const win = new EventTarget() as EventTarget & { GarageAndroid?: Record<string, unknown> }
vi.stubGlobal('window', win)

const { startAndroidScanners, symbologyName, upcLookupNative, useAndroidInputs } = await import('../lib/androidScan')
const fire = (name: string, detail: unknown) => win.dispatchEvent(new CustomEvent(name, { detail }))

describe('Android built-in scanners', () => {
  beforeAll(() => { startAndroidScanners(); startAndroidScanners() })
  afterEach(() => { emitScan.mockClear(); delete win.GarageAndroid; vi.useRealTimers() })

  it('hands a vendor broadcast to the scan bus once, named after the brand', () => {
    fire('garage-scan', { text: '6291041500213', source: 'intent', action: 'com.symbol.datawedge', symbology: 'LABEL-TYPE-EAN13', vendor: 'Zebra' })
    expect(emitScan).toHaveBeenCalledTimes(1)
    expect(emitScan).toHaveBeenCalledWith({ text: '6291041500213', source: 'android', symbology: 'EAN-13', device: 'قارئ Zebra' })
    fire('garage-scan', { text: 'ABC-123', source: 'intent', action: 'scan.rcv.message', symbology: '3', vendor: null })
    expect(emitScan).toHaveBeenLastCalledWith({ text: 'ABC-123', source: 'android', symbology: undefined, device: 'القارئ المدمج' })
    fire('garage-scan', { text: '' })
    expect(emitScan).toHaveBeenCalledTimes(2)
  })

  it('names the vendor symbology only when it is obvious', () => {
    expect(symbologyName('LABEL-TYPE-EAN13')).toBe('EAN-13')
    expect(symbologyName('LABEL-TYPE-CODE128')).toBe('Code 128')
    expect(symbologyName('LABEL-TYPE-QRCODE')).toBe('QR Code')
    expect(symbologyName('UPC-A')).toBe('UPC-A')
    expect(symbologyName('GS1_DATAMATRIX')).toBe('GS1 DataMatrix')
    expect(symbologyName('d')).toBeUndefined()
    expect(symbologyName('17')).toBeUndefined()
    expect(symbologyName(null)).toBeUndefined()
  })

  it('keeps the list of plugged-in keyboard devices', () => {
    fire('garage-input-devices', [{ id: 7, descriptor: 'abc', name: 'Barcode Scanner', vendorId: 0x0c2e, productId: 0x0b61, alphabetic: true, external: true }])
    expect(useAndroidInputs.getState().list.map(d => d.name)).toEqual(['Barcode Scanner'])
    expect(useAndroidInputs.getState().lastChange).not.toBeNull()
  })

  it('looks a barcode up through the app and resolves on its own answer', async () => {
    const upcLookup = vi.fn((code: string, id: string) => {
      expect(code).toBe('036000291452')
      expect(id).toMatch(/^[a-z0-9]{1,32}$/)
      fire('garage-upc', { id: 'someone-else', status: 500, body: '' })
      setTimeout(() => fire('garage-upc', { id, status: 200, body: '{"code":"OK"}' }), 0)
    })
    win.GarageAndroid = { upcLookup }
    expect(await upcLookupNative('036000291452')).toEqual({ status: 200, body: '{"code":"OK"}' })
    expect(upcLookup).toHaveBeenCalledTimes(1)
  })

  it('answers null without the bridge, for a bad code, or after 12 s of silence', async () => {
    expect(await upcLookupNative('036000291452')).toBeNull()
    const upcLookup = vi.fn()
    win.GarageAndroid = { upcLookup }
    expect(await upcLookupNative('12-34')).toBeNull()
    expect(upcLookup).not.toHaveBeenCalled()
    vi.useFakeTimers()
    const p = upcLookupNative('4006381333931')
    vi.advanceTimersByTime(11999)
    let settled = false
    void p.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    vi.advanceTimersByTime(1)
    expect(await p).toBeNull()
    // the late answer finds no listener
    const id = upcLookup.mock.calls[0][1] as string
    expect(() => fire('garage-upc', { id, status: 200, body: '{}' })).not.toThrow()
  })
})
