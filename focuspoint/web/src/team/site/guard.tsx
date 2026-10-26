// Unsaved-changes guard for the editor. The app uses <BrowserRouter> (no data router, so no useBlocker): while the
// form is dirty, clicks on in-app links are caught in the capture phase (before React Router sees them) and confirmed,
// and the browser asks before a reload / tab close. A back-swipe cannot be stopped this way; the draft is kept on the
// device anyway (state.ts), so nothing typed is lost.
import { useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { Confirm } from '../common'

export function useLeaveGuard(dirty: boolean): { ask: (to: string) => boolean; dialog: ReactElement } {
  const navigate = useNavigate()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return                     // leaving the app: beforeunload asks
      if (url.pathname === location.pathname && url.search === location.search) return
      e.preventDefault()
      e.stopPropagation()
      setPending(url.pathname + url.search + url.hash)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  /** For buttons that navigate: true = go ahead now, false = the dialog is asking first. */
  const ask = (to: string) => { if (!dirty) return true; setPending(to); return false }

  const dialog = (
    <Confirm open={pending !== null} title="في تعديلات ما انحفظت" confirmLabel="اطلع"
      body={<>التعديلات ما وصلت عالموقع لسا. منخليها كمسودة على هالجهاز، وبترجع بتلاقيها هون لتكمّل وتحفظ.</>}
      onClose={() => setPending(null)}
      onConfirm={() => { const to = pending; setPending(null); if (to) navigate(to) }} />
  )
  return { ask, dialog }
}
