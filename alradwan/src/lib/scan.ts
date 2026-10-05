// One road for every barcode, whatever read it: a keyboard-type scanner (USB or Bluetooth), the camera, a
// serial/COM or USB-HID scanner on Windows, or the built-in scanner of an Android POS terminal. Every source
// calls emitScan(); screens and dialogs subscribe with useScan(). The newest, highest-priority subscriber
// that returns true has handled the scan.
import { useEffect, useRef } from 'react'
import { create } from 'zustand'

export type ScanSource = 'keyboard' | 'camera' | 'serial' | 'hid' | 'android' | 'manual'
export interface Scan {
  /** the decoded text, with the scanner's own prefix (AIM id) and terminators removed */
  text: string
  source: ScanSource
  /** symbology when known (camera, AIM prefix, HID/Android scanners): 'EAN-13', 'Code 128', 'QR Code'… */
  symbology?: string
  /** which device read it (shown on the scanner page) */
  device?: string
  at: number
}

// ------------------------------------------------------------------------------------------- settings
export interface ScannerConfig {
  /** listen for keyboard-type scanners everywhere in the app */
  keyboard: boolean
  /** a scanner types each character faster than this on average (milliseconds) */
  maxAvgMs: number
  /** a pause longer than this ends a reading */
  maxGapMs: number
  /** shorter readings are treated as typing */
  minLength: number
  /** accept readings that end without Enter/Tab (some scanners send no terminator) */
  noSuffix: boolean
  beep: boolean
  vibrate: boolean
}
const CONFIG_KEY = 'alradwan.scanner'
export const DEFAULT_SCANNER: ScannerConfig = { keyboard: true, maxAvgMs: 45, maxGapMs: 100, minLength: 4, noSuffix: true, beep: true, vibrate: true }
export function readScannerConfig(): ScannerConfig {
  try { return { ...DEFAULT_SCANNER, ...(JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') as Partial<ScannerConfig>) } } catch { return { ...DEFAULT_SCANNER } }
}
export function writeScannerConfig(c: Partial<ScannerConfig>): ScannerConfig {
  const next = { ...readScannerConfig(), ...c }
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  useScanStatus.setState({ config: next })
  return next
}

// ------------------------------------------------------------------------------------------- status
export interface ScanStatus {
  config: ScannerConfig
  last: Scan | null
  /** when a keyboard-type scanner was last recognised (it cannot be listed before it reads something) */
  keyboardSeen: number | null
  /** readings per source since the app opened */
  counts: Partial<Record<ScanSource, number>>
}
export const useScanStatus = create<ScanStatus>(() => ({ config: readScannerConfig(), last: null, keyboardSeen: null, counts: {} }))

// ------------------------------------------------------------------------------------------- the bus
type Handler = (s: Scan) => boolean | void | Promise<boolean | void>
interface Sub { id: number; fn: Handler; priority: number }
let subs: Sub[] = []
let nextId = 1

/** Priorities: dialogs that own a field (20) > screens that use every scan, like a sale (10) >
 *  the app-wide fallback that opens or creates the product (0). Within a priority, the newest wins. */
export const SCAN_PRIORITY = { dialog: 20, screen: 10, fallback: 0 } as const

export function onScan(fn: Handler, priority: number = SCAN_PRIORITY.screen): () => void {
  const id = nextId++
  subs.push({ id, fn, priority })
  return () => { subs = subs.filter(s => s.id !== id) }
}

/** Subscribes a component; the latest handler is always used (no re-subscribing on every render). */
export function useScan(fn: Handler, opts?: { enabled?: boolean; priority?: number }) {
  const ref = useRef(fn)
  ref.current = fn
  const enabled = opts?.enabled ?? true
  const priority = opts?.priority ?? SCAN_PRIORITY.screen
  useEffect(() => {
    if (!enabled) return
    return onScan(s => ref.current(s), priority)
  }, [enabled, priority])
}

const AIM: Record<string, string> = {
  A: 'Code 39', C: 'Code 128', d: 'Data Matrix', E: 'EAN/UPC', e: 'GS1 DataBar', F: 'Codabar', G: 'Code 93',
  H: 'Code 11', I: 'ITF', L: 'PDF417', M: 'MSI', Q: 'QR Code', U: 'MaxiCode', z: 'Aztec', X: 'Other',
}
const ARABIC_DIGITS = /[٠-٩۰-۹]/g

/** Cleans what a scanner sent: AIM symbology prefix (]E0, ]C1…), CR/LF, Arabic-Indic digits. */
export function cleanScanText(raw: string): { text: string; symbology?: string } {
  let text = raw.replace(/[\r\n]+$/g, '').replace(/^[\r\n]+/, '')
  text = text.replace(ARABIC_DIGITS, d => String((d.charCodeAt(0) & 0xf)))
  let symbology: string | undefined
  const m = /^\]([A-Za-z])([0-9A-Za-z])/.exec(text)
  if (m && AIM[m[1]]) {
    symbology = AIM[m[1]]
    if (m[1] === 'E') symbology = m[2] === '4' ? 'EAN-8' : 'EAN-13 / UPC'
    if (m[1] === 'C' && m[2] === '1') symbology = 'GS1-128'
    if (m[1] === 'd' && m[2] === '2') symbology = 'GS1 DataMatrix'
    if (m[1] === 'Q' && m[2] === '3') symbology = 'GS1 QR Code'
    text = text.slice(3)
  }
  return { text: text.trim(), symbology }
}

let audio: AudioContext | null = null
/** The good-read beep (or the error buzz) and a short vibration, as the settings ask. */
export function scanFeedback(ok: boolean) {
  const c = useScanStatus.getState().config
  if (c.vibrate) { try { navigator.vibrate?.(ok ? 40 : [60, 60, 60]) } catch { /* not supported */ } }
  if (!c.beep) return
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = ok ? 1650 : 330
    g.gain.value = 0.07
    o.connect(g); g.connect(audio.destination)
    o.start(); o.stop(audio.currentTime + (ok ? 0.08 : 0.22))
  } catch { /* no sound */ }
}

/** Hands a reading to the screens. Returns whether something used it. */
export async function emitScan(input: { text: string; source: ScanSource; symbology?: string; device?: string; quiet?: boolean }): Promise<boolean> {
  const { text, symbology } = cleanScanText(input.text)
  if (!text) return false
  const scan: Scan = { text, source: input.source, symbology: input.symbology || symbology, device: input.device, at: Date.now() }
  useScanStatus.setState(s => ({ last: scan, counts: { ...s.counts, [scan.source]: (s.counts[scan.source] ?? 0) + 1 }, keyboardSeen: scan.source === 'keyboard' ? scan.at : s.keyboardSeen }))
  const order = [...subs].sort((a, b) => b.priority - a.priority || b.id - a.id)
  for (const s of order) {
    try { if (await s.fn(scan)) { if (!input.quiet) scanFeedback(true); return true } } catch (e) { console.error('scan handler', e) }
  }
  scanFeedback(false)
  return false
}

// ------------------------------------------------------------------------------------------- keyboard-type scanners
// A USB/Bluetooth scanner in its default mode pretends to be a keyboard: it "types" the code very fast and
// presses Enter. We recognise that burst anywhere in the app. Keys are read by their physical position
// (KeyboardEvent.code), so an Arabic keyboard layout does not turn "ABC-123" into Arabic letters.
const US: Record<string, [string, string]> = {
  Backquote: ['`', '~'], Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
  Semicolon: [';', ':'], Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], Space: [' ', ' '], IntlBackslash: ['\\', '|'],
  Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'], Digit6: ['6', '^'], Digit7: ['7', '&'], Digit8: ['8', '*'], Digit9: ['9', '('], Digit0: ['0', ')'],
  NumpadDecimal: ['.', '.'], NumpadAdd: ['+', '+'], NumpadSubtract: ['-', '-'], NumpadMultiply: ['*', '*'], NumpadDivide: ['/', '/'],
}
for (let i = 0; i < 26; i++) { const c = String.fromCharCode(97 + i); US[`Key${c.toUpperCase()}`] = [c, c.toUpperCase()] }
for (let i = 0; i < 10; i++) US[`Numpad${i}`] = [String(i), String(i)]

/** The character a key would give on a US layout, or null for non-character keys. */
export function usChar(code: string, shift: boolean): string | null {
  const p = US[code]
  return p ? p[shift ? 1 : 0] : null
}

interface Stroke { key: string; us: string | null; t: number }
type Editable = HTMLInputElement | HTMLTextAreaElement
interface Snapshot { el: Editable; value: string; start: number | null; end: number | null }

const isEditable = (el: Element | null): el is Editable =>
  !!el && ((el instanceof HTMLInputElement && /^(text|search|tel|url|email|number|)$/i.test(el.type)) || el instanceof HTMLTextAreaElement) && !(el as Editable).readOnly && !(el as Editable).disabled

/** Sets a field's value the way React notices (controlled inputs ignore plain .value writes). */
export function setFieldValue(el: Editable, value: string, caret?: number) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  if (caret !== undefined) { try { el.setSelectionRange(caret, caret) } catch { /* number inputs */ } }
}

/** Puts text into the focused field at the caret, as if typed. */
export function insertIntoField(el: Editable, text: string) {
  let start = el.value.length, end = el.value.length
  try { start = el.selectionStart ?? start; end = el.selectionEnd ?? end } catch { /* number inputs have no selection */ }
  setFieldValue(el, el.value.slice(0, start) + text + el.value.slice(end), start + text.length)
}

/** The focused text field, if any (where a keyboard scanner's characters land). */
export function focusedField(): Editable | null {
  const el = document.activeElement
  return isEditable(el) ? el : null
}

let strokes: Stroke[] = []
let snapshot: Snapshot | null = null
let idle: ReturnType<typeof setTimeout> | null = null
let started = false

const reset = () => { strokes = []; snapshot = null; if (idle) { clearTimeout(idle); idle = null } }

function textOf(list: Stroke[]): string {
  // one non-Latin character means the layout is not English: read every key by its position
  const foreign = list.some(s => !/^[\x20-\x7e\x1d]$/.test(s.key))
  return list.map(s => (foreign ? s.us ?? s.key : s.key)).join('')
}
function looksScanned(cfg: ScannerConfig): boolean {
  if (strokes.length < cfg.minLength) return false
  const span = strokes[strokes.length - 1].t - strokes[0].t
  return span / (strokes.length - 1) <= cfg.maxAvgMs
}
function finish() {
  const text = textOf(strokes)
  // nothing listens (the lock screen, the first-run setup): the characters stay where they were typed
  if (!subs.length) { reset(); return }
  // take back what the scanner typed into the field: the reading is delivered whole, correctly decoded
  const snap = snapshot
  if (snap && document.contains(snap.el) && snap.el.value !== snap.value) {
    setFieldValue(snap.el, snap.value)
    try { if (snap.start !== null && snap.end !== null) snap.el.setSelectionRange(snap.start, snap.end) } catch { /* number inputs */ }
  }
  reset()
  void emitScan({ text, source: 'keyboard' })
}

function onKeyDown(e: KeyboardEvent) {
  const cfg = useScanStatus.getState().config
  if (!cfg.keyboard || e.isComposing) return
  const t = e.timeStamp || performance.now()
  const target = e.target as Element | null
  // never on a PIN/password field: a fast typist's PIN must not become a "scan"
  if (target instanceof HTMLInputElement && target.type === 'password') { reset(); return }
  if (target instanceof HTMLElement && target.closest('[data-noscan]')) { reset(); return }
  if (e.key === 'Enter' || e.key === 'Tab' || e.code === 'NumpadEnter') {
    if (subs.length && strokes.length && t - strokes[strokes.length - 1].t <= cfg.maxGapMs && looksScanned(cfg)) {
      e.preventDefault(); e.stopImmediatePropagation()
      finish()
    } else reset()
    return
  }
  // a modifier pressed on its own (the Ctrl of Ctrl+], the Shift of a capital) is part of a reading, not a break
  if (/^(Shift|Control|Alt|AltGraph|Meta|CapsLock)$/.test(e.key)) return
  // GS1 group separator: scanners send it as Ctrl+] (ASCII 29)
  if (e.ctrlKey && !e.altKey && (e.code === 'BracketRight' || e.key === ']') && strokes.length) {
    strokes.push({ key: '\x1d', us: '\x1d', t }); e.preventDefault(); return
  }
  if (e.ctrlKey || e.metaKey || e.repeat) { reset(); return }
  if (e.altKey && !e.getModifierState?.('AltGraph')) { reset(); return }
  const single = e.key.length === 1 ? e.key.replace(/[٠-٩۰-۹]/, d => String(d.charCodeAt(0) & 0xf)) : ''
  const us = usChar(e.code, e.shiftKey)
  if (!single && !us) {
    // Shift/CapsLock/arrows: only a non-modifier key breaks a reading
    if (!/^(Shift|CapsLock|Control|Alt|AltGraph|Meta|Unidentified|Dead|Process)$/.test(e.key)) reset()
    return
  }
  const prev = strokes[strokes.length - 1]
  if (prev && t - prev.t > cfg.maxGapMs) reset()
  if (!strokes.length) {
    const el = focusedField()
    let start: number | null = null, end: number | null = null
    if (el) { try { start = el.selectionStart; end = el.selectionEnd } catch { /* number inputs */ } }
    snapshot = el ? { el, value: el.value, start, end } : null
  }
  strokes.push({ key: single || us || '', us, t })
  if (idle) clearTimeout(idle)
  idle = setTimeout(() => {
    idle = null
    // a scanner set to send no Enter: the reading ends with the pause
    if (cfg.noSuffix && looksScanned(cfg)) finish(); else reset()
  }, cfg.maxGapMs + 30)
}

/** Starts listening for keyboard-type scanners (once, for the life of the app). */
export function startKeyboardScanner() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('keydown', onKeyDown, true)
}

/** For tests: forget the current partial reading. */
export const _resetKeyboardScanner = reset
