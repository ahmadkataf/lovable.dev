// A small dropdown built on the kit's .menu class: closes on outside click and Escape, keyboard friendly.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'

export interface MenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  onClick: () => void
  checked?: boolean
  danger?: boolean
  disabled?: boolean
  /** A thin line above this item. */
  separator?: boolean
}

export function Menu({ trigger, items, className = '' }: { trigger: (open: boolean, toggle: () => void) => ReactNode; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open])
  return (
    <div ref={ref} className={`pr-menu-wrap ${className}`}>
      {trigger(open, () => setOpen(o => !o))}
      {open && (
        <div className="menu" role="menu">
          {items.map(it => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className={`${it.danger ? 'danger' : ''} ${it.separator ? 'sep' : ''}`}
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick() }}
            >
              {it.icon}
              <span className="grow">{it.label}</span>
              {it.checked && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
