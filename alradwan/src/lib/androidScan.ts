// The Android app's side of barcode scanning: the built-in scanner of a POS terminal or rugged phone (Sunmi,
// Zebra, Honeywell, Urovo, Newland…) arrives as a 'garage-scan' window event from MainActivity, the keyboard-type
// scanners plugged in (USB/Bluetooth) as 'garage-input-devices', and a UPCitemdb answer as 'garage-upc'.
import { create } from 'zustand'
import { emitScan } from './scan'

/** A keyboard-class device Android sees (a USB/Bluetooth scanner in keyboard mode is one). */
export interface AndroidInputDevice {
  id: number
  /** stable for the same device across reconnects */
  descriptor: string
  name: string
  vendorId: number
  productId: number
  alphabetic: boolean
  /** null before Android 10 */
  external: boolean | null
}

/** What MainActivity's bridge offers for scanning (older app builds may lack any of it). */
interface ScanBridge {
  inputDevices?(): string
  upcLookup?(code: string, id: string): void
}
interface ScanDetail { text?: unknown; symbology?: unknown; vendor?: unknown }
interface UpcDetail { id?: unknown; status?: unknown; body?: unknown }

const bridge = (): ScanBridge | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { GarageAndroid?: ScanBridge }).GarageAndroid

export const useAndroidInputs = create<{ list: AndroidInputDevice[]; lastChange: number | null }>(() => ({ list: [], lastChange: null }))

/** The keyboard-class devices plugged in now (empty outside the Android app). */
export function androidInputDevices(): AndroidInputDevice[] {
  try {
    const j = bridge()?.inputDevices?.()
    const list: unknown = j ? JSON.parse(j) : []
    return Array.isArray(list) ? (list as AndroidInputDevice[]) : []
  } catch { return [] }
}

const NAMES: Record<string, string> = {
  EAN13: 'EAN-13', EAN8: 'EAN-8', UPCA: 'UPC-A', UPCE: 'UPC-E', UPCE0: 'UPC-E', UPCE1: 'UPC-E',
  CODE128: 'Code 128', GS1128: 'GS1-128', EAN128: 'GS1-128', UCCEAN128: 'GS1-128', CODE39: 'Code 39', CODE93: 'Code 93',
  CODE11: 'Code 11', CODABAR: 'Codabar', I2OF5: 'ITF', ITF: 'ITF', ITF14: 'ITF-14', INTERLEAVED2OF5: 'ITF', MSI: 'MSI',
  QRCODE: 'QR Code', QR: 'QR Code', GS1QRCODE: 'GS1 QR Code', DATAMATRIX: 'Data Matrix', GS1DATAMATRIX: 'GS1 DataMatrix',
  PDF417: 'PDF417', AZTEC: 'Aztec', AZTECCODE: 'Aztec', MAXICODE: 'MaxiCode', GS1DATABAR: 'GS1 DataBar', RSS14: 'GS1 DataBar',
}

/** A readable symbology from the vendor's type ('LABEL-TYPE-EAN13' → 'EAN-13'); numeric vendor codes stay unknown. */
export function symbologyName(type: unknown): string | undefined {
  if (typeof type !== 'string') return undefined
  const key = type.toUpperCase().replace(/^LABEL-TYPE-/, '').replace(/[^A-Z0-9]/g, '')
  return NAMES[key]
}

let started = false
/** Starts listening to the Android app's scanners (once, for the life of the app). */
export function startAndroidScanners(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('garage-scan', e => {
    const d = ((e as CustomEvent).detail ?? {}) as ScanDetail
    if (typeof d.text !== 'string' || !d.text) return
    const vendor = typeof d.vendor === 'string' && d.vendor ? d.vendor : null
    void emitScan({ text: d.text, source: 'android', symbology: symbologyName(d.symbology), device: vendor ? 'قارئ ' + vendor : 'القارئ المدمج' })
  })
  window.addEventListener('garage-input-devices', e => {
    const list: unknown = (e as CustomEvent).detail
    useAndroidInputs.setState({ list: Array.isArray(list) ? (list as AndroidInputDevice[]) : [], lastChange: Date.now() })
  })
  useAndroidInputs.setState({ list: androidInputDevices() })
}

/** Asks UPCitemdb through the Android app (12 s at most); null when the app cannot or did not answer. */
export function upcLookupNative(code: string): Promise<{ status: number; body: string } | null> {
  const b = bridge()
  if (!b?.upcLookup || !/^[0-9]{8,14}$/.test(code)) return Promise.resolve(null)
  const id = Math.random().toString(36).slice(2, 14) || 'upc'
  return new Promise(resolve => {
    const done = (r: { status: number; body: string } | null) => {
      clearTimeout(timer)
      window.removeEventListener('garage-upc', onAnswer)
      resolve(r)
    }
    const onAnswer = (e: Event) => {
      const d = ((e as CustomEvent).detail ?? {}) as UpcDetail
      if (d.id !== id) return
      done({ status: typeof d.status === 'number' ? d.status : 0, body: typeof d.body === 'string' ? d.body : '' })
    }
    window.addEventListener('garage-upc', onAnswer)
    const timer = setTimeout(() => done(null), 12000)
    try { b.upcLookup!(code, id) } catch { done(null) }
  })
}
