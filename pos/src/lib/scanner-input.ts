// A USB or Bluetooth barcode scanner acts as a keyboard: it types the code very fast and presses Enter.
// This hook listens to the whole document and tells a burst of fast keys from someone typing.
import { useEffect, useRef } from 'react'

export interface WedgeOptions {
  /** Max ms between two characters for them to count as one scan (scanners do 5–30ms). */
  maxGap?: number
  minLength?: number
  enabled?: boolean
}

/**
 * Sets an input's value the way the browser does on typing, so a React controlled input
 * sees the change (plain `el.value = x` would be undone by React on the next render).
 */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value); else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function useBarcodeWedge(onScan: (code: string) => void, opts: WedgeOptions = {}): void {
  const cb = useRef(onScan); cb.current = onScan
  const { maxGap = 60, minLength = 4, enabled = true } = opts
  useEffect(() => {
    if (!enabled) return
    let buf = ''
    let last = 0
    let target: HTMLInputElement | HTMLTextAreaElement | null = null
    let timer: number | undefined
    const reset = () => { buf = ''; target = null; if (timer) { clearTimeout(timer); timer = undefined } }
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const now = performance.now()
      const el = document.activeElement as HTMLElement | null
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      // typed into a field that opts out (e.g. the PIN pad or a barcode box that handles Enter itself)
      if (inField && el.dataset.noWedge !== undefined) return
      if (now - last > maxGap) { buf = ''; target = null }
      last = now
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buf.length >= minLength) {
          const code = buf
          // the scanner typed into a field: take its characters back out
          if (target && target.value.endsWith(code)) setNativeValue(target, target.value.slice(0, -code.length))
          e.preventDefault(); e.stopPropagation()
          reset()
          cb.current(code)
          return
        }
        reset()
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (buf === '' && inField) target = el as HTMLInputElement
        buf += e.key
        if (timer) clearTimeout(timer)
        timer = window.setTimeout(reset, maxGap * 4)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); reset() }
  }, [maxGap, minLength, enabled])
}
