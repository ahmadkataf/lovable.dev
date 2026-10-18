// Row actions menu rendered in a portal with fixed positioning, so scrolling table wrappers never clip it.
// Uses the kit's .menu/.menu-item styles. (A shared Popover/portal Menu in the UI kit would make this redundant.)
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { useEscapeLayer, type MenuItemDef } from '@/ui'
import { useI18n } from '@/i18n'

/** `items` may be a function, called when the menu opens (e.g. to check one item's history then, not for every row). */
export function RowMenu({ items: source, label, size = 'sm' }: { items: MenuItemDef[] | (() => MenuItemDef[] | Promise<MenuItemDef[]>); label: string; size?: 'sm' | 'md' }) {
  const { isRTL } = useI18n()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MenuItemDef[]>(() => (typeof source === 'function' ? [] : source))
  // a lazily built menu stays hidden until this opening's items are in (no empty box, no jump, no stale entry)
  const [ready, setReady] = useState(typeof source !== 'function')
  useEffect(() => {
    if (typeof source !== 'function') { setItems(source); setReady(true); return }
    if (!open) { setReady(false); return }
    let alive = true
    void Promise.resolve(source()).then(list => { if (alive) { setItems(list); setReady(true) } })
    return () => { alive = false }
  }, [open, source])
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      const r = btn.current?.getBoundingClientRect(); if (!r) return
      const w = menu.current?.offsetWidth ?? 220, h = menu.current?.offsetHeight ?? 240
      // the menu opens towards the reading start, aligned with the button's end edge
      let left = isRTL ? r.left : r.right - w
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8)
      let top = r.bottom + 6
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6)
      setPos({ top, left })
    }
    place()
    // follow the button while the page scrolls (closing on scroll would also fire on the scroll that brought it into view)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, isRTL, items.length, ready])

  // Escape and the Android Back key close the menu first (the kit's layer stack), never the dialog or drawer under it
  useEscapeLayer(open ? () => setOpen(false) : undefined)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent | TouchEvent) => {
      const n = e.target as Node
      if (menu.current?.contains(n) || btn.current?.contains(n)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', down); document.addEventListener('touchstart', down)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down) }
  }, [open])

  return (
    <span className="inv-rowmenu" onClick={e => e.stopPropagation()}>
      <button ref={btn} type="button" className={`btn btn-ghost btn-icon${size === 'sm' ? ' btn-sm' : ''}`} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <MoreVertical />
      </button>
      {open && createPortal(
        <div ref={menu} className="menu inv-portal-menu" role="menu" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos && ready ? 'visible' : 'hidden' }} onClick={() => setOpen(false)}>
          {items.map((it, i) => it.sep ? <div key={i} className="menu-sep" /> : it.header ? <div key={i} className="menu-label">{it.header}</div> : (
            <button key={i} type="button" role="menuitem" className={`menu-item${it.danger ? ' danger' : ''}`} disabled={it.disabled} onClick={e => { e.stopPropagation(); setOpen(false); it.onClick?.() }}>
              {it.icon}<span className="grow">{it.label}</span>
            </button>
          ))}
        </div>, document.body)}
    </span>
  )
}
