// Small building blocks shared by the patients pages, the form and the files tab.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisVertical, HeartPulse, MessageCircle, Phone, Pill, Plus, TriangleAlert, X } from 'lucide-react'
import type { Patient } from '@/db/types'
import { useI18n } from '@/i18n'
import { Badge, type MenuItemDef } from '@/ui'
import { colorFor, formatPhone, whatsappLink } from '@/lib/format'
import { ageFrom } from '@/lib/dates'
import { openExternal, platform } from '@/platform'
import { addChips, hasChip, pluralForm, removeChip } from './lib'
import './patients.css'

/** t() for counted phrases: plural('count', 12) → t('patients.count.many', { n: 12 }). */
export function usePlural() {
  const { t } = useI18n()
  return useCallback((base: string, n: number) => t(`patients.${base}.${pluralForm(n)}`, { n }), [t])
}

/** "ذكر · 34 سنة" */
export function useGenderAge() {
  const { t } = useI18n(); const plural = usePlural()
  return useCallback((p: Pick<Patient, 'gender' | 'birthDate'>) => {
    const age = ageFrom(p.birthDate)
    return [t(p.gender), age !== null ? plural('age', age) : null].filter(Boolean).join(' · ')
  }, [t, plural])
}

/** Initials that read well for Arabic names: titles are skipped and the article "ال" is dropped ("أحمد الخطيب" → "أخ"). */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => p && !/^(د\.?|Dr\.?)$/i.test(p))
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  const strip = (w: string) => w.replace(/^ال(?=\S{2,})/, '')
  return strip(parts[0])[0] + strip(parts[parts.length - 1])[0]
}
/** The UI kit's avatar look, with Arabic-aware initials. */
export function PatientAvatar({ patient, size, className }: { patient: Pick<Patient, 'name' | 'photo' | 'id'>; size?: 'xs' | 'sm' | 'lg' | 'xl'; className?: string }) {
  return (
    <span className={['avatar', size && `avatar-${size}`, className].filter(Boolean).join(' ')} style={{ background: patient.photo ? 'var(--surface-3)' : colorFor(patient.id + patient.name) }} title={patient.name}>
      {patient.photo ? <img src={patient.photo} alt={patient.name} /> : nameInitials(patient.name)}
    </span>
  )
}

/** Opens tel: / WhatsApp links the right way on every host (Electron and Android hand them to the system). */
function external(e: ReactMouseEvent, url: string) {
  e.stopPropagation()
  if (platform() !== 'web') { e.preventDefault(); openExternal(url) }
}
export function ContactButtons({ phone, className }: { phone?: string; className?: string }) {
  const { t } = useI18n()
  if (!phone) return null
  return (
    <span className={['pt-contact', className].filter(Boolean).join(' ')}>
      <a className="pt-icon-link" href={`tel:${phone.replace(/[^\d+]/g, '')}`} title={t('call')} aria-label={t('call')} onClick={e => external(e, `tel:${phone.replace(/[^\d+]/g, '')}`)}><Phone /></a>
      <a className="pt-icon-link wa" href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" title={t('whatsapp')} aria-label={t('whatsapp')} onClick={e => external(e, whatsappLink(phone))}><MessageCircle /></a>
    </span>
  )
}
export function PhoneText({ phone }: { phone?: string }) {
  if (!phone) return <span className="subtle">—</span>
  return <span className="ltr num pt-phone-text">{formatPhone(phone)}</span>
}

/** Allergy (danger) and chronic disease (warning) flags for lists. */
export function MedicalBadges({ patient, withMeds, compact }: { patient: Pick<Patient, 'allergies' | 'chronicDiseases' | 'medications'>; withMeds?: boolean; compact?: boolean }) {
  const { t } = useI18n()
  const a = patient.allergies ?? [], c = patient.chronicDiseases ?? [], m = patient.medications ?? []
  if (!a.length && !c.length && !(withMeds && m.length)) return null
  return (
    <span className="pt-flags">
      {a.length > 0 && <span title={a.join('، ')}><Badge tone="danger" icon={<TriangleAlert />}>{t('patients.allergy')}{!compact && a.length > 1 && <span className="num"> {a.length}</span>}</Badge></span>}
      {c.length > 0 && <span title={c.join('، ')}><Badge tone="warning" icon={<HeartPulse />}>{t('patients.chronic')}{!compact && c.length > 1 && <span className="num"> {c.length}</span>}</Badge></span>}
      {withMeds && m.length > 0 && <span title={m.join('، ')}><Badge tone="info" icon={<Pill />}>{t('patients.medication')}</Badge></span>}
    </span>
  )
}

/** Up to `max` tag badges and a "+n" for the rest. */
export function TagList({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (!tags?.length) return null
  const shown = tags.slice(0, max)
  return (
    <span className="pt-tags">
      {shown.map(tg => <Badge key={tg} tone="primary" size="sm">{tg}</Badge>)}
      {tags.length > max && <span title={tags.slice(max).join('، ')}><Badge size="sm"><span className="num">+{tags.length - max}</span></Badge></span>}
    </span>
  )
}

/**
 * An actions menu that renders in a portal with fixed positioning, so it is never clipped by a scrolling table
 * and flips upward near the bottom of the screen. Clicks inside never reach the row underneath.
 */
export function RowMenu({ items, label }: { items: MenuItemDef[]; label: string }) {
  const { isRTL } = useI18n()
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const close = useCallback(() => { setAnchor(null); setPos(null) }, [])

  useLayoutEffect(() => {
    if (!anchor || !menu.current) return
    const w = menu.current.offsetWidth, h = menu.current.offsetHeight, gap = 6, vw = window.innerWidth, vh = window.innerHeight
    let left = isRTL ? anchor.left : anchor.right - w
    left = Math.max(8, Math.min(left, vw - w - 8))
    let top = anchor.bottom + gap
    if (top + h > vh - 8 && anchor.top - gap - h > 8) top = anchor.top - gap - h
    setPos({ top, left })
  }, [anchor, isRTL])

  useEffect(() => {
    if (!anchor) return
    const outside = (e: Event) => { const n = e.target as Node; if (!menu.current?.contains(n) && !btn.current?.contains(n)) close() }
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    // follow the trigger while the page scrolls; close once it leaves the screen
    const follow = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r || r.bottom < 0 || r.top > window.innerHeight) close()
      else setAnchor(prev => (prev && prev.top === r.top && prev.left === r.left ? prev : r))
    }
    document.addEventListener('mousedown', outside); document.addEventListener('touchstart', outside)
    window.addEventListener('keydown', key); window.addEventListener('resize', close); window.addEventListener('scroll', follow, true)
    return () => {
      document.removeEventListener('mousedown', outside); document.removeEventListener('touchstart', outside)
      window.removeEventListener('keydown', key); window.removeEventListener('resize', close); window.removeEventListener('scroll', follow, true)
    }
  }, [anchor, close])

  return (
    <span className="pt-rowmenu" onClick={e => e.stopPropagation()}>
      <button ref={btn} type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={!!anchor}
        onClick={() => (anchor ? close() : setAnchor(btn.current!.getBoundingClientRect()))}><EllipsisVertical /></button>
      {anchor && createPortal(
        <div ref={menu} className="menu pt-popmenu" role="menu" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }} onClick={e => e.stopPropagation()}>
          {items.map((it, i) => it.sep ? <div key={i} className="menu-sep" /> : it.header ? <div key={i} className="menu-label">{it.header}</div> : (
            <button key={i} type="button" role="menuitem" className={`menu-item${it.danger ? ' danger' : ''}`} disabled={it.disabled} onClick={() => { close(); it.onClick?.() }}>
              {it.icon}<span className="grow">{it.label}</span>
            </button>
          ))}
        </div>, document.body)}
    </span>
  )
}

export type ChipTone = 'danger' | 'warning' | 'info' | 'primary'
/**
 * A list of short values typed one by one: Enter or a comma adds, Backspace on an empty box removes the last,
 * leaving the box keeps what was typed. Optional one-click suggestions below.
 */
export function ChipInput({ value, onChange, placeholder, suggestions, tone = 'primary', id, disabled, label, hint }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[]; tone?: ChipTone; id?: string; disabled?: boolean; label?: ReactNode; hint?: ReactNode
}) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const commit = (raw = text) => { if (raw.trim()) onChange(addChips(value, raw)); setText('') }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === '،') && text.trim()) { e.preventDefault(); commit() }
    else if (e.key === 'Enter') e.preventDefault()
    else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  const left = (suggestions ?? []).filter(s => !hasChip(value, s))
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <div className={`pt-chipbox${disabled ? ' disabled' : ''}`} onClick={() => input.current?.focus()}>
        {value.map(v => (
          <span key={v} className={`pt-chipval tone-${tone}`}>
            {v}
            {!disabled && <button type="button" aria-label={`${t('delete')} ${v}`} onClick={e => { e.stopPropagation(); onChange(removeChip(value, v)) }}><X /></button>}
          </span>
        ))}
        <input ref={input} id={id} value={text} disabled={disabled} placeholder={value.length ? '' : placeholder} onKeyDown={onKey} onBlur={() => commit()}
          onChange={e => { const v = e.target.value; if (/[,،]/.test(v)) commit(v); else setText(v) }} />
      </div>
      {left.length > 0 && !disabled && (
        <div className="pt-suggest">
          {left.map(s => <button key={s} type="button" onClick={() => onChange(addChips(value, s))}><Plus />{s}</button>)}
        </div>
      )}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}
