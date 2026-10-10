// Building blocks shared by the prescriptions and lab modules: a portal popover anchored to a field, a free-text
// input with presets, the patient picker, the clinic header of printed sheets and the modal print helper.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Search, UserRound, X } from 'lucide-react'
import { db } from '@/db'
import type { Clinic, Patient } from '@/db/types'
import { useI18n } from '@/i18n'
import { Avatar, Button, Field, Input, Skeleton } from '@/ui'
import { formatPhone, matches } from '@/lib/format'
import { print } from '@/platform'
import { ToothIcon } from '@/app/ToothIcon'
import './prescriptions.css'

// ---- popover ------------------------------------------------------------------------------------

/**
 * A dropdown rendered into <body> with fixed positioning under (or above) its anchor, so it is never clipped by a
 * scrolling modal body. Closes on outside press; follows the anchor while the page scrolls.
 */
export function Popover({ anchor, open, onClose, children, className, maxHeight = 300, minWidth = 220 }: {
  anchor: React.RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: ReactNode; className?: string; maxHeight?: number; minWidth?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  const place = useCallback(() => {
    const a = anchor.current
    if (!a) return
    const r = a.getBoundingClientRect()
    const vh = window.innerHeight, vw = window.innerWidth
    const below = vh - r.bottom - 8, above = r.top - 8
    const up = below < Math.min(maxHeight, 200) && above > below
    const width = Math.min(Math.max(r.width, minWidth), vw - 16)
    const rtl = document.documentElement.dir === 'rtl'
    // align with the anchor's start edge, kept inside the viewport
    let left = rtl ? r.right - width : r.left
    left = Math.max(8, Math.min(left, vw - width - 8))
    setStyle({
      position: 'fixed', left, width, zIndex: 300,
      maxHeight: Math.max(120, Math.min(maxHeight, (up ? above : below) - 4)),
      ...(up ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 }),
    })
  }, [anchor, maxHeight, minWidth])
  useLayoutEffect(() => { if (open) place() }, [open, place])
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event) => { if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return; place() }
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return
      onClose()
    }
    window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', place)
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place)
      document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown)
    }
  }, [open, place, onClose, anchor])
  if (!open) return null
  return createPortal(<div ref={ref} className={['rx-pop', className].filter(Boolean).join(' ')} style={style} onMouseDown={e => e.preventDefault()}>{children}</div>, document.body)
}

// ---- free text with presets ---------------------------------------------------------------------

export interface ComboOption { value: string; hint?: ReactNode; swatch?: string }
/**
 * A text input that also offers a list of common values (a "Select + free text"): the chevron opens the full list,
 * typing narrows it; anything typed is kept as is. Enter picks the highlighted option only while the list is open.
 */
export function ComboInput({ value, onChange, options, label, placeholder, error, required, id, className, grid, dir, inputClassName, 'aria-label': ariaLabel }: {
  value: string; onChange: (v: string) => void; options: (string | ComboOption)[]; label?: ReactNode; placeholder?: string; error?: ReactNode; required?: boolean
  id?: string; className?: string; grid?: boolean; dir?: 'ltr' | 'rtl' | 'auto'; inputClassName?: string; 'aria-label'?: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(false)   // narrow the list only after the user typed
  const [hi, setHi] = useState(-1)
  const opts = useMemo(() => {
    const seen = new Set<string>()
    return options.map(o => (typeof o === 'string' ? { value: o } : o)).filter(o => o.value.trim() && !seen.has(o.value) && (seen.add(o.value), true))
  }, [options])
  const shown = useMemo(() => (typed && value.trim() ? opts.filter(o => matches(o.value, value)) : opts), [opts, typed, value])
  const close = useCallback(() => { setOpen(false); setHi(-1) }, [])
  const pick = (v: string) => { onChange(v); setTyped(false); close(); input.current?.focus() }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setTyped(false); setOpen(true) } setHi(h => Math.min(shown.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && open && hi >= 0 && shown[hi]) { e.preventDefault(); pick(shown[hi].value) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); close() }
    else if (e.key === 'Tab') close()
  }
  const control = (
    <div ref={wrap} className={['rx-combo', className].filter(Boolean).join(' ')}>
      <Input ref={input} id={id} value={value} placeholder={placeholder} invalid={!!error} autoComplete="off" dir={dir} className={inputClassName} aria-label={ariaLabel}
        onChange={e => { onChange(e.target.value); setTyped(true); setOpen(true); setHi(-1) }} onKeyDown={onKey}
        iconEnd={<ChevronDown className={open ? 'rx-flip' : undefined} />} onIconEndClick={() => { if (open) close(); else { setTyped(false); setOpen(true); input.current?.focus() } }} />
      <Popover anchor={wrap} open={open && shown.length > 0} onClose={close} className={grid ? 'rx-pop-grid' : undefined}>
        <div role="listbox" className={grid ? 'rx-opt-grid' : 'rx-opt-list'}>
          {shown.map((o, i) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} className={`rx-opt${i === hi ? ' hi' : ''}${o.value === value ? ' sel' : ''}`}
              onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)} tabIndex={-1}>
              {o.swatch && <span className="rx-swatch" style={{ background: o.swatch }} />}
              <span className="grow truncate" dir="auto">{o.value}</span>
              {o.hint && <span className="rx-opt-hint">{o.hint}</span>}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
  if (!label && !error) return control
  return <Field label={label} error={error} required={required} htmlFor={id}>{control}</Field>
}

// ---- patient picker -----------------------------------------------------------------------------

function searchPatients(list: Patient[], q: string, limit = 8): Patient[] {
  const s = q.trim()
  if (!s) return list.slice(0, limit)
  const num = s.replace(/^#/, '')
  const digits = s.replace(/\D/g, '')
  return list.filter(p => matches(p.name, s) || String(p.fileNo) === num || (digits.length >= 3 && (p.phone || '').replace(/\D/g, '').includes(digits))).slice(0, limit)
}

/**
 * Patient field: search by name, file number or phone (Arabic-aware). Once chosen it shows a compact card;
 * `locked` hides the "change" action (forms opened from a patient's profile).
 */
export function PatientSelect({ value, onChange, error, locked, autoFocus }: { value?: Patient; onChange: (p?: Patient) => void; error?: string; locked?: boolean; autoFocus?: boolean }) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const all = useLiveQuery(async () => {
    const list = await db.patients.filter(p => !p.archived).toArray()
    return list.sort((a, b) => (b.lastVisit || b.updatedAt || '').localeCompare(a.lastVisit || a.updatedAt || ''))
  }, [])
  const results = useMemo(() => searchPatients(all ?? [], q), [all, q])
  useEffect(() => setHi(0), [q])
  const close = useCallback(() => setOpen(false), [])
  const pick = (p: Patient) => { onChange(p); setQ(''); setOpen(false) }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(results.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && results[hi]) pick(results[hi]); else setOpen(true) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
  }

  if (value) {
    return (
      <Field label={t('patient')} required>
        <div className="rx-picked">
          <Avatar name={value.name} src={value.photo} size="sm" />
          <div className="grow">
            <div className="rx-picked-name truncate">{value.name}</div>
            <div className="rx-picked-sub"><span className="num">#{value.fileNo}</span>{value.phone && <span className="ltr num">{formatPhone(value.phone)}</span>}</div>
          </div>
          {!locked && <Button size="sm" variant="ghost" icon={<X />} onClick={() => { onChange(undefined); window.setTimeout(() => input.current?.focus(), 30) }}>{t('prescriptions.form.change')}</Button>}
        </div>
      </Field>
    )
  }
  return (
    <Field label={t('patient')} required error={error}>
      <div ref={wrap}>
        <Input ref={input} iconStart={<Search />} value={q} placeholder={t('prescriptions.form.searchPatient')} autoComplete="off" invalid={!!error} autoFocus={autoFocus}
          role="combobox" aria-expanded={open} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKey}
          clearable onClear={() => { setQ(''); input.current?.focus() }} />
      </div>
      <Popover anchor={wrap} open={open} onClose={close} maxHeight={340}>
        <div role="listbox" className="rx-opt-list">
          {all === undefined ? <div className="col gap-2" style={{ padding: 8 }}><Skeleton h={36} /><Skeleton h={36} /></div> : results.length === 0 ? (
            <div className="rx-pop-empty"><UserRound />{all.length === 0 ? t('prescriptions.form.noPatients') : t('noResults')}</div>
          ) : <>
            {!q.trim() && <div className="rx-pop-label">{t('prescriptions.form.recentPatients')}</div>}
            {results.map((p, i) => (
              <button key={p.id} type="button" role="option" aria-selected={i === hi} className={`rx-opt rx-opt-patient${i === hi ? ' hi' : ''}`} tabIndex={-1}
                onMouseEnter={() => setHi(i)} onClick={() => pick(p)}>
                <Avatar name={p.name} src={p.photo} size="xs" />
                <span className="grow truncate strong">{p.name}</span>
                {p.phone && <span className="rx-opt-hint ltr hide-mobile">{formatPhone(p.phone)}</span>}
                <span className="rx-fileno num">#{p.fileNo}</span>
              </button>
            ))}
          </>}
        </div>
      </Popover>
    </Field>
  )
}

// ---- printed sheets ------------------------------------------------------------------------------

/** The clinic name in the reading language, with the other language as a second line. */
export function clinicNames(clinic: Clinic, lang: 'ar' | 'en'): { primary: string; secondary: string } {
  const primary = (lang === 'en' ? clinic.nameEn || clinic.name : clinic.name || clinic.nameEn) || ''
  const secondary = lang === 'en' ? (clinic.nameEn && clinic.name && clinic.name !== clinic.nameEn ? clinic.name : '') : clinic.nameEn && clinic.nameEn !== primary ? clinic.nameEn : ''
  return { primary, secondary }
}

/** Logo, names and contact lines of the clinic, for the top of printed sheets. */
export function SheetClinic({ clinic, compact }: { clinic: Clinic; compact?: boolean }) {
  const { t, lang } = useI18n()
  const { primary, secondary } = clinicNames(clinic, lang)
  return (
    <div className={`rx-clinic${compact ? ' compact' : ''}`}>
      <div className="rx-clinic-logo">{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon size={compact ? 24 : 30} />}</div>
      <div className="rx-clinic-text">
        <div className="rx-clinic-name">{primary || t('appName')}</div>
        {secondary && <div className="rx-clinic-alt" dir="auto">{secondary}</div>}
        {clinic.tagline && !compact && <div className="rx-clinic-tag">{clinic.tagline}</div>}
        <div className="rx-clinic-meta">
          {clinic.address && <span>{clinic.address}</span>}
          {(clinic.phone || clinic.phone2) && <span className="ltr">{[clinic.phone, clinic.phone2].filter(Boolean).map(p => formatPhone(p)).join(' · ')}</span>}
        </div>
      </div>
    </div>
  )
}

/** The prescription mark (℞) drawn as a path, so it renders the same with every font on every device. */
export function RxMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="rx-mark">
      <path d="M9 34V6h10.5a8 8 0 0 1 0 16H9" />
      <path d="M16.5 22 33 38.5" />
      <path d="M23.5 37.5 33.5 27" />
    </svg>
  )
}

/**
 * Prints the sheet shown in the open modal: everything else is hidden for the print (see body.rx-printing in
 * prescriptions.css) and shown again afterwards.
 */
export function printModalSheet() {
  const body = document.body
  body.classList.add('rx-printing')
  const done = () => { body.classList.remove('rx-printing'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  print()
}
/** Clears the print mode when a printable modal closes. */
export function usePrintCleanup(open: boolean) {
  useEffect(() => { if (!open) return; return () => document.body.classList.remove('rx-printing') }, [open])
}
