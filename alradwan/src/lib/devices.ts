// Barcode scanners that are not keyboards: USB scanners in "HID POS" mode (read through WebHID) and scanners
// that talk over a COM port: USB virtual COM, RS-232 adapters and Bluetooth serial (read through Web Serial).
// On Windows the app trusts known scanners on its own, so they connect whenever they are plugged in; other
// ports are linked once from the scanner settings. Keyboard-mode scanners need none of this (see scan.ts).
import { create } from 'zustand'
import { emitScan } from './scan'

// ------------------------------------------------------------------------------------------- minimal typings
interface HIDReportItem { usages?: number[]; usageMinimum?: number; usageMaximum?: number; isRange?: boolean; reportSize: number; reportCount: number }
interface HIDReportInfo { reportId: number; items?: HIDReportItem[] }
interface HIDCollectionInfo { usagePage?: number; usage?: number; inputReports?: HIDReportInfo[]; children?: HIDCollectionInfo[] }
export interface HIDDevice extends EventTarget {
  opened: boolean; vendorId: number; productId: number; productName: string; collections: HIDCollectionInfo[]
  open(): Promise<void>; close(): Promise<void>; forget?(): Promise<void>
}
interface HIDInputReportEvent extends Event { device: HIDDevice; reportId: number; data: DataView }
interface HID extends EventTarget { getDevices(): Promise<HIDDevice[]>; requestDevice(o: { filters: { usagePage?: number; vendorId?: number }[] }): Promise<HIDDevice[]> }
export interface SerialPort extends EventTarget {
  readable: ReadableStream<Uint8Array> | null
  writable?: WritableStream<Uint8Array> | null
  getInfo(): { usbVendorId?: number; usbProductId?: number; bluetoothServiceClassId?: number | string }
  open(o: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string; flowControl?: string; bufferSize?: number }): Promise<void>
  close(): Promise<void>; forget?(): Promise<void>
}
interface Serial extends EventTarget { getPorts(): Promise<SerialPort[]>; requestPort(o?: object): Promise<SerialPort> }
interface USBDevice { vendorId: number; productId: number; productName?: string; manufacturerName?: string; configuration?: { interfaces: { alternate: { interfaceClass: number; interfaceSubclass: number; interfaceProtocol: number } }[] } | null; configurations?: { interfaces: { alternates: { interfaceClass: number; interfaceSubclass: number; interfaceProtocol: number }[] }[] }[] }
interface USB extends EventTarget { getDevices(): Promise<USBDevice[]> }
const nav = () => (typeof navigator === 'undefined' ? {} : navigator) as Navigator & { hid?: HID; serial?: Serial; usb?: USB }
export const canUseHid = () => !!nav().hid
export const canUseSerial = () => !!nav().serial

// ------------------------------------------------------------------------------------------- known scanners
/** USB vendor ids of barcode scanner makers (USB-IF list). Used to name devices and to trust their COM ports. */
export const SCANNER_VENDORS: Record<number, string> = {
  0x0536: 'Honeywell', 0x0c2e: 'Honeywell (Metrologic)', 0x23d0: 'Honeywell (Youjie)', 0x05e0: 'Zebra (Symbol)', 0x05f9: 'Datalogic',
  0x080c: 'Datalogic', 0x1dc2: 'Datalogic', 0x1eab: 'Newland', 0x24ea: 'Zebex', 0x065a: 'Opticon', 0x08d7: 'Opticon', 0x2415: 'CipherLab',
  0x11fa: 'Code', 0x067e: 'Intermec', 0x2745: 'Unitech', 0x08fb: 'Socket Mobile', 0x27dd: 'Mindeo', 0x0581: 'Tera', 0x324f: 'Sunmi', 0x32c3: 'Newland',
}
/** USB-to-serial chips: an RS-232 scanner through an adapter, where the speed (baud) matters. */
const SERIAL_CHIPS: Record<number, string> = { 0x1a86: 'CH340', 0x067b: 'Prolific', 0x0403: 'FTDI', 0x10c4: 'CP210x' }
const NAME_HINT = /scan|barcode|bar code|imager|honeywell|zebra|symbol|datalogic|newland|opticon|zebex|cipherlab|netum|eyoyo|inateck|tera|mindeo|sunmi/i
const hex4 = (n?: number) => (n ?? 0).toString(16).padStart(4, '0').toUpperCase()

// ------------------------------------------------------------------------------------------- device list (settings page)
export type DeviceKind = 'hid' | 'serial' | 'usb'
export interface ScannerDevice {
  id: string
  kind: DeviceKind
  name: string
  /** what the scanner is doing: reading here, seen but typing as a keyboard, or a problem */
  state: 'connected' | 'connecting' | 'keyboard' | 'error' | 'off'
  detail?: string
  reads: number
}
export const useDevices = create<{ list: ScannerDevice[] }>(() => ({ list: [] }))
function upsert(d: Partial<ScannerDevice> & { id: string }) {
  useDevices.setState(s => {
    const i = s.list.findIndex(x => x.id === d.id)
    if (i < 0) return { list: [...s.list, { kind: 'usb', name: d.id, state: 'connecting', reads: 0, ...d } as ScannerDevice] }
    const list = [...s.list]; list[i] = { ...list[i], ...d }; return { list }
  })
}
const dropDevice = (id: string) => useDevices.setState(s => ({ list: s.list.filter(x => x.id !== id) }))
const countRead = (id: string) => useDevices.setState(s => ({ list: s.list.map(x => (x.id === id ? { ...x, reads: x.reads + 1 } : x)) }))

// devices the user switched off (kept per computer)
const OFF_KEY = 'alradwan.scanners.off'
const offList = (): string[] => { try { return JSON.parse(localStorage.getItem(OFF_KEY) || '[]') } catch { return [] } }
export function setDeviceOff(id: string, off: boolean) {
  const l = new Set(offList()); if (off) l.add(id); else l.delete(id)
  try { localStorage.setItem(OFF_KEY, JSON.stringify([...l])) } catch { /* private mode */ }
}
export const isDeviceOff = (id: string) => offList().includes(id)

function decodeBytes(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return new TextDecoder('windows-1252').decode(bytes) }
}

// ------------------------------------------------------------------------------------------- HID POS (usage page 0x8C)
const PAGE = 0x8c
const U = (id: number) => (PAGE << 16) | id
const DECODED = U(0xfe), CONTINUED = U(0xff), SYM = [U(0xfb), U(0xfc), U(0xfd)]
type Role = 'data' | 'sym' | 'cont' | 'other'
interface Field { bit: number; size: number; role: Role; symIndex?: number }
interface Layout { reportId: number; fields: Field[]; lenField?: Field }

export function hidIsScanner(d: { collections?: HIDCollectionInfo[] }): boolean {
  const walk = (c: HIDCollectionInfo[] = []): boolean => c.some(x => x.usagePage === PAGE || walk(x.children))
  return walk(d.collections)
}

/** Where the barcode sits in the device's own report description (HID POS Usage Tables, Scanned Data Report). */
export function hidLayouts(d: { collections?: HIDCollectionInfo[] }): Layout[] {
  const out: Layout[] = []
  const walk = (cs: HIDCollectionInfo[] = []) => {
    for (const c of cs) {
      for (const r of c.inputReports ?? []) {
        let bit = 0
        const fields: Field[] = []
        for (const it of r.items ?? []) {
          for (let k = 0; k < it.reportCount; k++) {
            const usage = it.isRange ? Math.min((it.usageMinimum ?? 0) + k, it.usageMaximum ?? 0) : (it.usages?.[k] ?? it.usages?.[(it.usages?.length ?? 1) - 1] ?? 0)
            const si = SYM.indexOf(usage)
            fields.push({ bit, size: it.reportSize, role: usage === DECODED ? 'data' : usage === CONTINUED ? 'cont' : si >= 0 ? 'sym' : 'other', symIndex: si >= 0 ? si : undefined })
            bit += it.reportSize
          }
        }
        if (!fields.some(f => f.role === 'data')) continue
        // Honeywell puts a length byte (with no barcode usage) just before the symbology bytes
        const firstSym = fields.findIndex(f => f.role === 'sym' || f.role === 'data')
        const prev = firstSym > 0 ? fields[firstSym - 1] : undefined
        out.push({ reportId: r.reportId, fields, lenField: prev && prev.role === 'other' && prev.size === 8 ? prev : undefined })
      }
      walk(c.children)
    }
  }
  walk(d.collections)
  return out
}

const bitsAt = (v: DataView, bit: number, size: number): number => {
  let n = 0
  for (let i = 0; i < size; i++) { const b = bit + i, byte = b >> 3; if (byte >= v.byteLength) break; if ((v.getUint8(byte) >> (b & 7)) & 1) n |= 1 << i }
  return n
}

/** One input report → its piece of the barcode. Exported for tests. */
export function readHidReport(layouts: Layout[], reportId: number, v: DataView): { bytes: Uint8Array; aim: string; more: boolean } | null {
  const lay = layouts.find(l => l.reportId === reportId)
  if (lay) {
    const data: number[] = [], sym = ['', '', '']
    let more = false, contSeen = false
    for (const f of lay.fields) {
      if (f.role === 'data' && f.size === 8) data.push(bitsAt(v, f.bit, 8))
      else if (f.role === 'sym' && f.symIndex !== undefined) { const c = bitsAt(v, f.bit, f.size); if (c) sym[f.symIndex] = String.fromCharCode(c) }
      // the first bit of the "Decode Data Continued" field; the rest of its byte is padding
      else if (f.role === 'cont' && !contSeen) { more = bitsAt(v, f.bit, 1) !== 0; contSeen = true }
    }
    const len = lay.lenField ? bitsAt(v, lay.lenField.bit, 8) : 0
    let n = len > 0 && len <= data.length ? len : data.length
    if (!(len > 0 && len <= data.length)) while (n > 0 && data[n - 1] === 0) n--
    const aim = sym[0] === ']' ? sym.join('') : ''
    return { bytes: Uint8Array.from(data.slice(0, n)), aim, more }
  }
  // no description: the Honeywell layout (len, "]" + 2-char AIM id, data …, continued bit in byte 62)
  if (reportId === 2 && v.byteLength >= 5) {
    const off = v.getUint8(1) === 0x5d ? 0 : v.getUint8(2) === 0x5d ? 1 : -1
    if (off < 0) return null
    const len = v.getUint8(0)
    const start = 4 + off
    const bytes = new Uint8Array(v.buffer, v.byteOffset + start, Math.max(0, Math.min(len, v.byteLength - start)))
    const aim = String.fromCharCode(v.getUint8(1 + off), v.getUint8(2 + off), v.getUint8(3 + off))
    return { bytes: Uint8Array.from(bytes), aim, more: v.byteLength > 62 && (v.getUint8(62) & 1) === 1 }
  }
  return null
}

const hidOpen = new WeakSet<HIDDevice>()
// the report listener of each open device: switching a scanner off and on again must not add a second one
const hidHandlers = new WeakMap<HIDDevice, EventListener>()
function dropHidHandler(d: HIDDevice) { const h = hidHandlers.get(d); if (h) { d.removeEventListener('inputreport', h); hidHandlers.delete(d) } }
const hidId = (d: HIDDevice) => `hid:${hex4(d.vendorId)}:${hex4(d.productId)}`
async function openHid(d: HIDDevice) {
  const id = hidId(d)
  const name = d.productName || SCANNER_VENDORS[d.vendorId] || 'قارئ باركود USB'
  if (isDeviceOff(id)) { upsert({ id, kind: 'hid', name, state: 'off' }); return }
  if (hidOpen.has(d)) return
  hidOpen.add(d)
  upsert({ id, kind: 'hid', name, state: 'connecting', detail: 'USB HID POS' })
  try {
    if (!d.opened) await d.open()
    const layouts = hidLayouts(d)
    let parts: number[] = [], aim = '', flush: ReturnType<typeof setTimeout> | null = null
    const done = () => {
      if (flush) { clearTimeout(flush); flush = null }
      if (!parts.length) return
      const text = aim + decodeBytes(Uint8Array.from(parts)).replace(/[\r\n]+$/, '')
      parts = []; aim = ''
      countRead(id)
      void emitScan({ text, source: 'hid', device: name })
    }
    dropHidHandler(d)
    const onReport: EventListener = e => {
      const ev = e as HIDInputReportEvent
      const piece = readHidReport(layouts, ev.reportId, ev.data)
      if (!piece) return
      if (!parts.length) aim = piece.aim
      parts.push(...piece.bytes)
      // a long code comes in several reports; wait for the last one (or a short pause)
      if (piece.more) { if (flush) clearTimeout(flush); flush = setTimeout(done, 200) } else done()
    }
    hidHandlers.set(d, onReport)
    d.addEventListener('inputreport', onReport)
    upsert({ id, state: 'connected', detail: 'USB HID POS' })
  } catch (e) {
    hidOpen.delete(d)
    upsert({ id, state: 'error', detail: (e as Error).message || 'تعذّر فتح الجهاز' })
  }
}

// ------------------------------------------------------------------------------------------- serial (COM / Bluetooth)
const BAUDS = [9600, 115200, 19200, 38400, 57600]
const BAUD_KEY = 'alradwan.scanners.baud'
// A USB port is named by its vendor and product; a plain COM or Bluetooth port has nothing stable the page can
// see (the browser lists ports in a random order), so it gets a name for this session only and nothing about
// it (switched off, speed) is remembered under that name: switching it off forgets the port instead.
const sessionIds = new WeakMap<SerialPort, string>()
let nextSerial = 1
const serialId = (p: SerialPort) => {
  const x = p.getInfo()
  if (x.usbVendorId) return `serial:${hex4(x.usbVendorId)}:${hex4(x.usbProductId)}`
  let id = sessionIds.get(p)
  if (!id) { id = `serial:${x.bluetoothServiceClassId ? 'bt' : 'com'}:${nextSerial++}`; sessionIds.set(p, id) }
  return id
}
const persistent = (id: string) => !/^serial:(com|bt):/.test(id)
const serialPorts = new Map<string, SerialPort>()
const savedBaud = (id: string): number | undefined => { if (!persistent(id)) return undefined; try { return (JSON.parse(localStorage.getItem(BAUD_KEY) || '{}') as Record<string, number>)[id] } catch { return undefined } }
const saveBaud = (id: string, b: number) => { if (!persistent(id)) return; try { const m = JSON.parse(localStorage.getItem(BAUD_KEY) || '{}'); m[id] = b; localStorage.setItem(BAUD_KEY, JSON.stringify(m)) } catch { /* private mode */ } }
/** Zebra scanners in SSI mode wrap each reading in a packet ([length][0xF3][source 0][status][type][data…]
 *  [checksum ×2]) and wait for an acknowledgement. 'wait' = looks like one but is not complete yet. */
export function ssiPacket(b: number[]): { size: number; data: number[]; more: boolean } | 'wait' | null {
  const L = b[0]
  if (b.length === 0 || L < 5 || (b.length > 1 && b[1] !== 0xf3) || (b.length > 2 && b[2] !== 0x00)) return null
  if (b.length < L + 2) return 'wait'
  let sum = 0
  for (let i = 0; i < L; i++) sum += b[i]
  if (((sum + ((b[L] << 8) | b[L + 1])) & 0xffff) !== 0) return null
  return { size: L + 2, data: b.slice(5, L), more: (b[3] & 0x02) !== 0 }
}
const SSI_ACK = Uint8Array.of(0x04, 0xd0, 0x04, 0x00, 0xff, 0x28)

/** Whole UTF-8 text (an Arabic QR code) is a reading even though its bytes are not plain ASCII. */
const isUtf8 = (b: Uint8Array) => { try { new TextDecoder('utf-8', { fatal: true }).decode(b); return true } catch { return false } }
const serialOpen = new Map<SerialPort, { id: string; close: () => Promise<void> }>()

/** Printable share of a reading: a wrong speed (baud) turns text into noise. */
const printable = (b: Uint8Array) => b.length ? Array.from(b).filter(c => (c >= 0x20 && c < 0x7f) || c === 0x1d || c === 0x09 || c >= 0xa0).length / b.length : 1

async function openSerial(p: SerialPort) {
  const info = p.getInfo()
  const id = serialId(p)
  serialPorts.set(id, p)
  const vendor = info.usbVendorId !== undefined ? SCANNER_VENDORS[info.usbVendorId] : undefined
  const chip = info.usbVendorId !== undefined ? SERIAL_CHIPS[info.usbVendorId] : undefined
  const name = vendor ? `قارئ ${vendor} (COM)` : info.bluetoothServiceClassId ? 'قارئ بلوتوث (منفذ تسلسلي)' : chip ? `قارئ عبر محوّل ${chip}` : 'قارئ على منفذ COM'
  if (isDeviceOff(id)) { upsert({ id, kind: 'serial', name, state: 'off' }); return }
  if (serialOpen.has(p)) return
  // USB virtual COM and Bluetooth ignore the speed; an RS-232 scanner behind an adapter needs the right one
  const tryBauds = chip || (!vendor && !info.bluetoothServiceClassId) ? [savedBaud(id) ?? 9600, ...BAUDS.filter(b => b !== (savedBaud(id) ?? 9600))] : [9600]
  let attempt = 0
  let closing = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  const close = async () => { closing = true; try { await reader?.cancel() } catch { /* ignore */ } try { await p.close() } catch { /* ignore */ } serialOpen.delete(p) }
  serialOpen.set(p, { id, close })
  upsert({ id, kind: 'serial', name, state: 'connecting' })
  const run = async (): Promise<void> => {
    const baud = tryBauds[attempt % tryBauds.length]
    try { await p.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none', bufferSize: 4096 }) }
    catch (e) { serialOpen.delete(p); upsert({ id, state: 'error', detail: /already open|in use|busy|access/i.test((e as Error).message) ? 'المنفذ مستخدم من برنامج آخر' : (e as Error).message }); return }
    upsert({ id, state: 'connected', detail: tryBauds.length > 1 ? `سرعة ${baud}` : undefined })
    let buf: number[] = [], idle: ReturnType<typeof setTimeout> | null = null, noise = 0, wrongBaud = false
    let pending: number[] = [], ssi: number[] = []
    const emitText = (bytes: Uint8Array) => { countRead(id); void emitScan({ text: decodeBytes(bytes), source: 'serial', device: name }) }
    const ack = () => { try { const w = p.writable?.getWriter(); if (w) void w.write(SSI_ACK).catch(() => {}).finally(() => w.releaseLock()) } catch { /* read-only port */ } }
    // bytes in: SSI packets are unwrapped and acknowledged, plain text is cut at CR/LF
    const take = () => {
      while (pending.length) {
        // a packet only starts between readings, never in the middle of text
        const pk = buf.length ? null : ssiPacket(pending)
        if (pk === 'wait') return
        if (pk) {
          pending.splice(0, pk.size); ack(); ssi.push(...pk.data)
          if (!pk.more) { emitText(Uint8Array.from(ssi)); ssi = [] }
          continue
        }
        const b = pending.shift()!
        if (b === 0x0d || b === 0x0a) flush(); else buf.push(b)
      }
    }
    const flush = () => {
      if (idle) { clearTimeout(idle); idle = null }
      if (!buf.length) return
      const bytes = Uint8Array.from(buf); buf = []
      if (!isUtf8(bytes) && printable(bytes) < 0.8) { if (++noise >= 2 && tryBauds.length > 1) { wrongBaud = true; void reader?.cancel() } return }
      noise = 0
      if (tryBauds.length > 1) saveBaud(id, baud)
      emitText(bytes)
    }
    try {
      while (p.readable && !closing) {
        reader = p.readable.getReader()
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            pending.push(...value)
            take()
            // scanners set to send no Enter: the reading ends with a short pause
            if (idle) clearTimeout(idle)
            idle = setTimeout(() => { buf.push(...pending); pending = []; flush() }, 80)
          }
        } catch (e) {
          // a framing, parity or overrun error is not the end: the port gives a new stream to read from;
          // framing and parity errors usually mean a wrong speed
          const n = (e as Error).name
          if (!/Framing|Parity|Break|BufferOverrun/.test(n)) throw e
          if (/Framing|Parity/.test(n) && tryBauds.length > 1 && ++noise >= 2) wrongBaud = true
        } finally { reader.releaseLock() }
        if (wrongBaud) break
      }
    } catch { /* unplugged: the 'disconnect' event cleans up */ }
    if (idle) clearTimeout(idle)
    try { await p.close() } catch { /* ignore */ }
    if (wrongBaud && !closing && attempt + 1 < tryBauds.length * 2) { attempt++; return run() }
    if (!closing) { serialOpen.delete(p); upsert({ id, state: wrongBaud ? 'error' : 'off', detail: wrongBaud ? 'لم تُعرف سرعة المنفذ — راجع إعدادات القارئ' : 'انفصل' }) }
  }
  void run()
}

// ------------------------------------------------------------------------------------------- USB list (names keyboard-mode scanners)
function usbMode(d: USBDevice): 'keyboard' | 'com' | 'hidpos' | null {
  const alts = (d.configurations ?? []).flatMap(c => c.interfaces.flatMap(i => i.alternates))
  if (alts.some(a => a.interfaceClass === 2 || a.interfaceClass === 0x0a)) return 'com'
  if (alts.some(a => a.interfaceClass === 3 && a.interfaceSubclass === 1 && a.interfaceProtocol === 1)) return 'keyboard'
  if (alts.some(a => a.interfaceClass === 3)) return 'hidpos'
  return null
}
async function listUsb() {
  const usb = nav().usb
  if (!usb) return
  try {
    for (const d of await usb.getDevices()) {
      const vendor = SCANNER_VENDORS[d.vendorId]
      const label = [d.manufacturerName, d.productName].filter(Boolean).join(' ')
      if (!vendor && !NAME_HINT.test(label)) continue
      const mode = usbMode(d)
      const id = `usb:${hex4(d.vendorId)}:${hex4(d.productId)}`
      // read through HID POS or COM already: listed there
      if (useDevices.getState().list.some(x => x.id.endsWith(`${hex4(d.vendorId)}:${hex4(d.productId)}`) && x.kind !== 'usb')) continue
      upsert({ id, kind: 'usb', name: label || `قارئ ${vendor}`, state: mode === 'keyboard' ? 'keyboard' : 'connecting', detail: mode === 'keyboard' ? 'وضع لوحة المفاتيح — يعمل تلقائياً' : mode === 'com' ? 'وضع COM' : 'USB' })
    }
  } catch { /* not allowed here */ }
}

// ------------------------------------------------------------------------------------------- start / link
/** The Android app hands over what a built-in scanner read (Zebra, Honeywell, Sunmi, Urovo, Newland…). */
export interface AndroidScanner { maker: string; model: string; scanner: string | null }
export function androidScanner(): AndroidScanner | null {
  try { const j = window.GarageAndroid?.scannerInfo?.(); return j ? (JSON.parse(j) as AndroidScanner) : null } catch { return null }
}

let started = false
export async function startDeviceScanners() {
  if (started) return
  started = true
  const { hid, serial, usb } = nav()
  if (hid) {
    try { for (const d of await hid.getDevices()) if (hidIsScanner(d)) void openHid(d) } catch { /* not allowed */ }
    hid.addEventListener('connect', e => { const d = (e as unknown as { device: HIDDevice }).device; if (hidIsScanner(d)) void openHid(d) })
    hid.addEventListener('disconnect', e => { const d = (e as unknown as { device: HIDDevice }).device; hidOpen.delete(d); dropHidHandler(d); upsert({ id: hidId(d), state: 'off', detail: 'انفصل' }) })
  }
  if (serial) {
    try { (await serial.getPorts()).forEach(p => void openSerial(p)) } catch { /* not allowed */ }
    serial.addEventListener('connect', e => { void openSerial(e.target as unknown as SerialPort) })
    serial.addEventListener('disconnect', e => {
      const p = e.target as unknown as SerialPort
      const s = serialOpen.get(p)
      if (s) void s.close().then(() => upsert({ id: s.id, state: 'off', detail: 'انفصل' }))
    })
  }
  if (usb) {
    await listUsb()
    usb.addEventListener('connect', () => void listUsb())
    usb.addEventListener('disconnect', () => { useDevices.setState(s => ({ list: s.list.filter(x => x.kind !== 'usb') })); void listUsb() })
  }
}

/** Links a USB scanner in HID POS mode (needs a click: the device list then appears). */
export async function linkHidScanner(): Promise<boolean> {
  const hid = nav().hid
  if (!hid) return false
  const ds = await hid.requestDevice({ filters: [{ usagePage: PAGE }] })
  for (const d of ds) { setDeviceOff(hidId(d), false); await openHid(d) }
  return ds.length > 0
}
/** Links a scanner on a COM port: USB virtual COM, RS-232 adapter or Bluetooth serial (needs a click). */
export async function linkSerialScanner(): Promise<boolean> {
  const serial = nav().serial
  if (!serial) return false
  const p = await serial.requestPort()
  setDeviceOff(serialId(p), false)
  await openSerial(p)
  return true
}

/** Stops reading a device and keeps it off on this computer (it can be switched back on). A plain COM or
 *  Bluetooth port, which has no lasting name, is forgotten instead: it can be linked again from the list. */
export async function turnDeviceOff(id: string) {
  for (const [, s] of serialOpen) if (s.id === id) await s.close()
  if (!persistent(id)) {
    const p = serialPorts.get(id)
    serialPorts.delete(id)
    try { await p?.forget?.() } catch { /* older browsers keep it */ }
    dropDevice(id)
    return
  }
  setDeviceOff(id, true)
  const hid = nav().hid
  if (hid) for (const d of await hid.getDevices()) if (hidId(d) === id) { hidOpen.delete(d); dropHidHandler(d); try { await d.close() } catch { /* ignore */ } }
  upsert({ id, state: 'off', detail: 'موقوف' })
}
export async function turnDeviceOn(id: string) {
  setDeviceOff(id, false)
  const { hid, serial } = nav()
  if (hid) for (const d of await hid.getDevices()) if (hidId(d) === id) await openHid(d)
  if (serial) for (const p of await serial.getPorts()) if (serialId(p) === id) void openSerial(p)
}
export const forgetDevice = (id: string) => dropDevice(id)

/** Windows app: every HID device plugged in, so a scanner in keyboard mode (USB or Bluetooth) is named too. */
export async function desktopInventory(): Promise<number> {
  const inv = typeof window !== 'undefined' ? window.garageDesktop?.scanners : undefined
  if (!inv) { await listUsb(); return useDevices.getState().list.length }
  const list = await inv.inventory()
  for (const d of list) {
    if (!(d.scanner || NAME_HINT.test(d.name))) continue
    const id = `hid:${hex4(d.vendorId)}:${hex4(d.productId)}`
    // a scanner read through HID POS keeps its own row (with its on/off switch), whatever its state
    if (useDevices.getState().list.some(x => x.id === id && x.kind !== 'usb')) continue
    upsert({ id, kind: 'usb', name: d.name || SCANNER_VENDORS[d.vendorId ?? 0] || 'قارئ باركود', state: d.keyboard ? 'keyboard' : 'connecting', detail: d.keyboard ? 'وضع لوحة المفاتيح — يعمل تلقائياً' : 'USB' })
  }
  await listUsb()
  return useDevices.getState().list.length
}
