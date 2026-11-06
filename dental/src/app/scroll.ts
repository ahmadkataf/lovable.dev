import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const RESTORE_FRAMES = 60          // about a second: lists render a moment after the route changes
const STOP_ON = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/**
 * Where a screen opens: a new screen (a link, the menu, a redirect) opens at its top; Back and Forward return to
 * where that screen was left, as a browser does. A ?tab= change on the same screen keeps its place. The saved
 * position is applied once the page is tall enough for it (lists load and render after the route changes), unless
 * the user scrolls or taps first.
 */
export function useScrollReset(): void {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const current = useRef(location.key)

  // remember each history entry's position as it is scrolled (by the time the route changes, the next screen is
  // already in the page, so it cannot be read then)
  useEffect(() => {
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual' } catch { /* not allowed: harmless */ }
    let raf = 0
    const save = () => { raf = 0; positions.current.set(current.current, window.scrollY) }
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(save) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) window.cancelAnimationFrame(raf) }
  }, [])

  useLayoutEffect(() => {
    current.current = location.key
    const target = navType === 'POP' ? positions.current.get(location.key) ?? 0 : 0
    window.scrollTo(0, 0)
    if (target <= 0) return
    let raf = 0
    let frames = 0
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf)
      raf = 0
      STOP_ON.forEach(e => window.removeEventListener(e, stop, true))
    }
    const step = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max >= target || ++frames > RESTORE_FRAMES) { window.scrollTo(0, Math.min(target, Math.max(0, max))); stop(); return }
      raf = window.requestAnimationFrame(step)
    }
    STOP_ON.forEach(e => window.addEventListener(e, stop, { capture: true, passive: true }))
    raf = window.requestAnimationFrame(step)
    return stop
    // only a change of screen: ?tab= on the same screen keeps its place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
}
