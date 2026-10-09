// A USB or Bluetooth barcode scanner acts as a keyboard: it types the code very fast and presses Enter.
// This hook listens to the whole document and tells a burst of fast keys from someone typing.
import { useEffect, useRef } from 'react'

export interface WedgeOptions {
  /** Max ms between two characters for them to count as one scan (scanners do 5–30ms). */
  maxGap?: number
  minLength?: number
  enabled?: boolean
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
      const now = performance.now()
      const el = document.activeElement as HTMLElement | null
      const inField = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      // typed into a field that opts out (e.g. the PIN pad or the search box handles Enter itself)
      if (inField && el.dataset.noWedge !== undefined) return
      if (now - last > maxGap) { buf = ''; target = null }
      last = now
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (buf.length >= minLength) {
          const code = buf
          // the scanner typed into a field: take its characters back out
          if (target && target.value.endsWith(code)) target.value = target.value.slice(0, -code.length)
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
