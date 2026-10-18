import { useEffect, useState } from 'react'

/** Fields that bring up the on-screen keyboard (not checkboxes, buttons, pickers…). */
export function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  if ((el as HTMLElement).isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA') return !(el as HTMLTextAreaElement).readOnly
  if (tag !== 'INPUT') return false
  const input = el as HTMLInputElement
  if (input.readOnly || input.disabled) return false
  return !/^(checkbox|radio|button|submit|reset|range|color|file|image|hidden|date|time|datetime-local|month|week)$/i.test(input.type)
}

/**
 * Is the on-screen keyboard most likely open? A text field has focus and the visible height dropped well below
 * the tallest height seen at this width (the keyboard takes it: Android resizes the WebView, browsers shrink the
 * visual viewport). Rotating resets the reference height.
 */
export function keyboardLikelyOpen(tallest: number, current: number, typing: boolean): boolean {
  return typing && tallest - current > Math.max(120, tallest * 0.18)
}

/** True while the on-screen keyboard is up (phones and tablets): the shell hides the bottom navigation then. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    let tallest = 0
    let width = 0
    let raf = 0
    const visibleHeight = () => (vv ? vv.height * (vv.scale || 1) : window.innerHeight)
    const update = () => {
      raf = 0
      const w = window.innerWidth
      if (Math.abs(w - width) > 40) { width = w; tallest = 0 }
      const h = visibleHeight()
      tallest = Math.max(tallest, h)
      setOpen(keyboardLikelyOpen(tallest, h, isTextEntry(document.activeElement)))
    }
    const schedule = () => { if (!raf) raf = window.requestAnimationFrame(update) }
    update()
    vv?.addEventListener('resize', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
    }
  }, [])
  return open
}
