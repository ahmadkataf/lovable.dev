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
  /** the key that ended a keyboard-type reading (given back to a field the reading is typed into) */
  terminator?: 'Enter' | 'Tab'
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
  /** the scanner types in the same keyboard language as the computer: read the typed characters, not key positions */
  layoutKeys: boolean
  beep: boolean
  vibrate: boolean
}
const CONFIG_KEY = 'alradwan.scanner'
// Wired USB scanners type a key every 1-10 ms, Bluetooth ones 15-50 ms with the odd stall; people far slower.
export const DEFAULT_SCANNER: ScannerConfig = { keyboard: true, maxAvgMs: 60, maxGapMs: 120, minLength: 4, noSuffix: true, layoutKeys: false, beep: true, vibrate: true }
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
/** true: handled. 'reject': this screen decided against it (an unknown code it may not create): nobody else
 *  gets it, so it is never typed into a price or quantity box behind the message. */
type HandlerResult = boolean | void | 'reject'
type Handler = (s: Scan) => HandlerResult | Promise<HandlerResult>
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

// ISO/IEC 15424 symbology identifiers ("]" + code letter + modifier) that scanners can put before a reading
const AIM: Record<string, string> = {
  A: 'Code 39', B: 'Telepen', C: 'Code 128', D: 'Code One', E: 'EAN/UPC', F: 'Codabar', G: 'Code 93', H: 'Code 11', I: 'ITF',
  J: 'DotCode', K: 'Code 16K', L: 'PDF417', M: 'MSI', N: 'Anker', O: 'Codablock', P: 'Plessey', Q: 'QR Code', R: 'Straight 2 of 5',
  S: 'Industrial 2 of 5', T: 'Code 49', U: 'MaxiCode', X: 'Other', Z: 'Keyboard', c: 'Channel Code', d: 'Data Matrix', e: 'GS1 DataBar',
  g: 'Grid Matrix', h: 'Han Xin', o: 'OCR', p: 'PosiCode', s: 'SuperCode', z: 'Aztec',
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
    if (m[1] === 'E') symbology = m[2] === '4' ? 'EAN-8' : m[2] === '3' ? 'EAN-13 + add-on' : 'EAN-13 / UPC'
    if (m[1] === 'C' && m[2] === '1') symbology = 'GS1-128'
    if (m[1] === 'd' && m[2] === '2') symbology = 'GS1 DataMatrix'
    if (m[1] === 'Q' && m[2] === '3') symbology = 'GS1 QR Code'
    text = text.slice(3)
    // ]E3: the 13-digit number followed by a 2- or 5-digit add-on (magazines, books): the product is the 13 digits
    if (m[1] === 'E' && m[2] === '3' && /^\d{15}$|^\d{18}$/.test(text.trim())) text = text.trim().slice(0, 13)
    if (m[1] === 'I' && m[2] === '1') symbology = 'ITF-14'
    if (m[1] === 'J' && m[2] === '1') symbology = 'GS1 DotCode'
  }
  return { text: text.trim(), symbology }
}

let audio: AudioContext | null = null
/** The good-read beep (or the error buzz) and a short vibration, as the settings ask. A reading also counts
 *  as activity for the screen lock (hands-free camera scanning touches nothing). */
export function scanFeedback(ok: boolean) {
  try { window.dispatchEvent(new Event('alradwan-activity')) } catch { /* no window */ }
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

let lastEmit = { text: '', source: '', at: 0 }

/** Hands a reading to the screens. Returns whether something used it. */
export async function emitScan(input: { text: string; source: ScanSource; symbology?: string; device?: string; terminator?: 'Enter' | 'Tab'; quiet?: boolean }): Promise<boolean> {
  const { text, symbology } = cleanScanText(input.text)
  if (!text) return false
  // a POS phone may send each reading twice (as keys and as a broadcast): the second copy is dropped
  const now = Date.now()
  if (text === lastEmit.text && input.source !== lastEmit.source && now - lastEmit.at < 800 && [input.source, lastEmit.source].every(x => x === 'keyboard' || x === 'android')) return true
  lastEmit = { text, source: input.source, at: now }
  const scan: Scan = { text, source: input.source, symbology: input.symbology || symbology, device: input.device, terminator: input.terminator, at: Date.now() }
  useScanStatus.setState(s => ({ last: scan, counts: { ...s.counts, [scan.source]: (s.counts[scan.source] ?? 0) + 1 }, keyboardSeen: scan.source === 'keyboard' ? scan.at : s.keyboardSeen }))
  const order = [...subs].sort((a, b) => b.priority - a.priority || b.id - a.id)
  for (const s of order) {
    try {
      const r = await s.fn(scan)
      if (r === 'reject') { scanFeedback(false); return false }
      if (r) { if (!input.quiet) scanFeedback(true); return true }
    } catch (e) { console.error('scan handler', e) }
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
// Alt held while numpad digits are typed: a character the scanner's keyboard lacks (keypad emulation)
let altDigits = ''
// an Android keyboard app took the key (keyCode 229): its character arrives as text right after
let imeKeyAt = -1e9
// a whole reading typed in one go (Android POS "keyboard output"): the Enter that follows belongs to it
let swallowEnterUntil = 0
// when a key was last pressed (a person typing on an Android keyboard app also produces text in one go)
let lastKeyAt = -1e9
// only Android POS phones "type" a whole reading as text; elsewhere text in one go is a paste, dictation or autofill
const textReadings = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

const reset = () => { strokes = []; snapshot = null; altDigits = ''; if (idle) { clearTimeout(idle); idle = null } }
const foldDigits = (k: string) => k.replace(/[٠-٩۰-۹]/g, d => String(d.charCodeAt(0) & 0xf))

/** A scanner types as if on a US keyboard: each key is read by its position, so an Arabic (or French)
 *  layout cannot change what was scanned. The typed character is used only for keys with no position
 *  (Android keyboard apps, virtual wedges), or when the scanner was set to the same language as Windows. */
function textOf(list: Stroke[], byLayout: boolean): string {
  return list.map(s => (byLayout ? s.key || s.us : s.us ?? s.key) ?? '').join('')
}
function gaps(): number[] { const g: number[] = []; for (let i = 1; i < strokes.length; i++) g.push(strokes[i].t - strokes[i - 1].t); return g }
const mean = (g: number[]) => g.reduce((a, b) => a + b, 0) / g.length
/** Ended by Enter/Tab: fast on average and for most keys (one Bluetooth hiccup is fine). */
function scannedWithEnd(cfg: ScannerConfig): boolean {
  if (strokes.length < cfg.minLength) return false
  const g = gaps()
  return g.length > 0 && mean(g) <= cfg.maxAvgMs && [...g].sort((a, b) => a - b)[g.length >> 1] <= cfg.maxAvgMs * 2 / 3
}
/** Ended by silence: it must look even more like a machine (a fast typist rolls 2-3 keys, never 6). */
function scannedWithoutEnd(cfg: ScannerConfig): boolean {
  if (strokes.length < Math.max(6, cfg.minLength)) return false
  const g = gaps()
  return mean(g) <= cfg.maxAvgMs * 0.6 && Math.max(...g) <= cfg.maxGapMs * 2 / 3
}
/** The keys so far already look typed by a machine (decides whether Ctrl+]/F8… belong to a reading). */
const machineSoFar = (cfg: ScannerConfig) => strokes.length >= 2 && mean(gaps()) <= cfg.maxAvgMs

function begin() {
  if (snapshot) return
  const el = focusedField()
  let start: number | null = null, end: number | null = null
  if (el) { try { start = el.selectionStart; end = el.selectionEnd } catch { /* number inputs */ } }
  snapshot = el ? { el, value: el.value, start, end } : null
}
function push(key: string, us: string | null, t: number, cfg: ScannerConfig) {
  const prev = strokes[strokes.length - 1]
  if (prev && t - prev.t > cfg.maxGapMs) reset()
  if (!strokes.length) begin()
  strokes.push({ key, us, t })
  arm(cfg)
}
/** The pause that ends a reading with no Enter (restarted by every key of the reading, modifiers included). */
function arm(cfg: ScannerConfig) {
  if (idle) clearTimeout(idle)
  idle = setTimeout(() => {
    idle = null
    // an Alt + numpad character is still being typed: wait for it
    if (altDigits) { arm(cfg); return }
    // a scanner set to send no Enter: the reading ends with the pause
    if (cfg.noSuffix && scannedWithoutEnd(cfg)) finish(); else reset()
  }, cfg.maxGapMs + 30)
}
function finish(terminator?: 'Enter' | 'Tab') {
  const text = textOf(strokes, useScanStatus.getState().config.layoutKeys)
  // nothing listens (the lock screen, the first-run setup): the characters stay where they were typed
  if (!subs.length) { reset(); return }
  // take back what the scanner typed into the field: the reading is delivered whole, correctly decoded
  const snap = snapshot
  if (snap && document.contains(snap.el) && snap.el.value !== snap.value) {
    setFieldValue(snap.el, snap.value)
    try { if (snap.start !== null && snap.end !== null) snap.el.setSelectionRange(snap.start, snap.end) } catch { /* number inputs */ }
  }
  reset()
  void emitScan({ text, source: 'keyboard', terminator })
}
/** Enter, Tab or Ctrl+J at the end of a burst: a reading if it was fast enough; the key itself is kept from the page. */
function terminator(e: KeyboardEvent, t: number, cfg: ScannerConfig) {
  if (subs.length && strokes.length && t - strokes[strokes.length - 1].t <= cfg.maxGapMs && scannedWithEnd(cfg)) {
    e.preventDefault(); e.stopImmediatePropagation()
    finish(e.key === 'Tab' ? 'Tab' : 'Enter')
  } else reset()
}

const blocked = (target: EventTarget | null) =>
  // never on a PIN/password field: a fast typist's PIN must not become a "scan"
  (target instanceof HTMLInputElement && target.type === 'password') || (target instanceof HTMLElement && !!target.closest('[data-noscan]'))

let replaying = false
/** Gives a field the Enter (or Tab) that ended a reading typed into it, so what the field does on Enter (read
 *  a VIN, pick a match) still happens, as when the scanner typed into it directly. */
export function replayTerminator(el: HTMLElement, key: 'Enter' | 'Tab' | undefined) {
  if (!key) return
  replaying = true
  try { el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true })) } finally { replaying = false }
}

function onKeyDown(e: KeyboardEvent) {
  if (replaying) return
  const cfg = useScanStatus.getState().config
  if (!cfg.keyboard || e.isComposing) return
  const t = e.timeStamp || performance.now()
  lastKeyAt = t
  if (blocked(e.target)) { reset(); return }
  if (e.key === 'Enter' || e.key === 'Tab' || e.code === 'NumpadEnter') {
    if (t < swallowEnterUntil) { swallowEnterUntil = 0; e.preventDefault(); e.stopImmediatePropagation(); return }
    terminator(e, t, cfg)
    return
  }
  // the key went to an Android keyboard app; its character follows as text (onBeforeInput)
  if (e.key === 'Unidentified' || e.keyCode === 229) { imeKeyAt = t; return }
  // a modifier pressed on its own (the Ctrl of Ctrl+], the Shift of a capital) is part of a reading, not a break
  if (/^(Shift|Control|Alt|AltGraph|Meta|CapsLock|Dead|Process)$/.test(e.key)) { if (strokes.length) arm(cfg); return }
  // Alt + numpad digits: one character, decided when Alt is let go (onKeyUp)
  if (e.altKey && !e.ctrlKey && /^Numpad\d$/.test(e.code)) { altDigits += e.code.slice(6); if (strokes.length) arm(cfg); return }
  // control characters inside a reading: GS1's group separator and friends, as scanners type them
  if (machineSoFar(cfg)) {
    const ctl = e.ctrlKey && !e.altKey && !e.metaKey
    const c = ctl && (e.code === 'BracketRight' || e.key === ']') ? '\x1d'      // Zebra, Netum: Ctrl+]
      : !e.ctrlKey && !e.altKey && e.key === 'F8' ? '\x1d'                       // Honeywell default
      : (ctl && e.code === 'Digit6') || (!e.ctrlKey && !e.altKey && e.key === 'F9') ? '\x1e'
      : ctl && e.code === 'KeyD' ? '\x04' : null
    if (c) { push(c, c, t, cfg); e.preventDefault(); e.stopImmediatePropagation(); return }
    if (ctl && e.code === 'KeyJ') { terminator(e, t, cfg); return }
  }
  if (e.ctrlKey || e.metaKey || e.repeat) { reset(); return }
  if (e.altKey && !e.getModifierState?.('AltGraph')) { reset(); return }
  const single = e.key.length === 1 ? foldDigits(e.key) : ''
  let us = usChar(e.code, e.shiftKey)
  // a capital without Shift while Caps Lock is off comes from a program typing, not from a key: trust it
  if (us && single && /^[a-z]$/i.test(single) && single.toLowerCase() === us && single !== us && !e.getModifierState?.('CapsLock')) us = single
  // arrows, F-keys, Escape…: the reading is over
  if (!single && !us) { reset(); return }
  push(single || us || '', us, t, cfg)
}

function onKeyUp(e: KeyboardEvent) {
  if (!altDigits || (e.key !== 'Alt' && e.code !== 'AltLeft' && e.code !== 'AltRight')) return
  const cfg = useScanStatus.getState().config
  const digits = altDigits
  altDigits = ''
  const n = parseInt(digits, 10)
  const t = e.timeStamp || performance.now()
  if (n === 13 || n === 10) { terminator(e, t, cfg); return }
  let c = ''
  if (n > 0 && n < 128) c = String.fromCharCode(n)
  // above 127 with a leading zero Windows uses the ANSI code page (Arabic Windows: 1256)
  else if (n < 256 && digits.startsWith('0')) { try { c = new TextDecoder('windows-1256').decode(Uint8Array.of(n)) } catch { /* no decoder */ } }
  if (c) push(c, c, t, cfg)
}

/** Android: a keyboard app (IME) swallows a hardware scanner's keys and hands over text instead, and the
 *  built-in scanners of POS phones "type" a whole reading at once. Both come through here. */
function onBeforeInput(ev: Event) {
  const e = ev as InputEvent
  const cfg = useScanStatus.getState().config
  if (!cfg.keyboard || !subs.length || e.inputType !== 'insertText' || !e.data) return
  if (blocked(e.target)) return
  const t = e.timeStamp || performance.now()
  if (e.data.length === 1) {
    if (t - imeKeyAt < 80) push(foldDigits(e.data), null, t, cfg)
    return
  }
  const data = e.data
  if (!textReadings() || t - lastKeyAt < 300) return
  if (strokes.length || data.length < cfg.minLength || !/^[\x1d\x20-\x7e٠-٩۰-۹]+$/.test(data) || !/[0-9٠-٩۰-۹]/.test(data) || data.trim() !== data) return
  // keep the field as it was (when the browser will not let us stop the typing, put it back right after)
  const el = focusedField()
  const before = el ? { el, value: el.value } : null
  e.preventDefault()
  if (before) setTimeout(() => { if (document.contains(before.el) && before.el.value !== before.value) setFieldValue(before.el, before.value) }, 0)
  swallowEnterUntil = t + 400
  void emitScan({ text: foldDigits(data), source: 'keyboard' })
}

/** Starts listening for keyboard-type scanners (once, for the life of the app). */
export function startKeyboardScanner() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('beforeinput', onBeforeInput, true)
}

/** For tests: forget the current partial reading. */
export const _resetKeyboardScanner = reset
