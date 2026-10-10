// Small building blocks shared by the billing screens: status/method badges, the period bar, the patient picker,
// the clinic identity printed on every sheet, and the print helper for sheets shown inside a modal.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, Banknote, CalendarRange, CircleDollarSign, CreditCard, Search, ShieldAlert, ShieldCheck, Smartphone, UserRound, type LucideIcon } from 'lucide-react'
import { db } from '@/db'
import { todayISO } from '@/db/ids'
import type { Clinic, InvoiceStatus, Patient, PaymentMethod } from '@/db/types'
import { useI18n } from '@/i18n'
import { useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { ToothIcon } from '@/app/ToothIcon'
import { fmtDate } from '@/lib/dates'
import { formatPhone, matches } from '@/lib/format'
import { print } from '@/platform'
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Segmented, toneFor, type Tone } from '@/ui'
import { normalizePeriod, PERIOD_PRESETS, presetPeriod, type Period, type PeriodPreset } from './lib'
import './billing.css'

// ---- access ------------------------------------------------------------------------------------

/** Billing screens are for roles with the 'billing' permission (admin, doctors, reception); others see this instead. */
export function BillingGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const session = useSession()
  if (session.can('billing')) return <>{children}</>
  return (
    <div className="page">
      <Card><EmptyState icon={<ShieldAlert />} title={t('billing.noPermission')} description={t('billing.noPermissionDesc')} actions={<Button variant="primary" to="/">{t('billing.backHome')}</Button>} /></Card>
    </div>
  )
}

// ---- badges & money ---------------------------------------------------------------------------

/**
 * Isolates a left-to-right fragment (an amount, an invoice number) inside a translated sentence so it reads correctly
 * in Arabic, and keeps it on one line (no break inside "INV-000001" or between an amount and its currency).
 */
/** A plain bidi isolate for text that leaves the screen (activity feed, WhatsApp): no invisible joiners inside it. */
export const iso = (s: string | number) => `\u2066${s}\u2069`
export const ltr = (s: string | number) => `\u2066${String(s).replace(/ /g, '\u00a0').replace(/-/g, '\u2060-\u2060')}\u2069`
/** 'YYYY-MM-DD' → 'DD/MM/YYYY' for dense printed tables (plain digits, no locale direction marks). */
export const shortDate = (d: string) => { const [y, m, day] = d.slice(0, 10).split('-'); return `${day}/${m}/${y}` }

export function StatusBadge({ status, size }: { status: InvoiceStatus; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  return <Badge tone={toneFor(status)} size={size} dot>{t(`inv.${status}`)}</Badge>
}

export const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { cash: Banknote, card: CreditCard, transfer: ArrowLeftRight, insurance: ShieldCheck, wallet: Smartphone, other: CircleDollarSign }
export const METHOD_TONE: Record<PaymentMethod, Tone> = { cash: 'success', card: 'info', transfer: 'accent', insurance: 'purple', wallet: 'orange', other: 'default' }
export function MethodBadge({ method, size }: { method: PaymentMethod; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  const I = METHOD_ICON[method] ?? CircleDollarSign
  return <Badge tone={METHOD_TONE[method] ?? 'default'} size={size} icon={<I />}>{t(`pay.${method}`)}</Badge>
}

/** A money amount; `due` paints positive amounts red, `signed` paints negatives red. */
export function Money({ value, kind, className, strong }: { value: number; kind?: 'due' | 'signed' | 'muted'; className?: string; strong?: boolean }) {
  const money = useMoney()
  const cls = ['money', kind === 'due' && value > 0.004 && 'neg', kind === 'due' && Math.abs(value) <= 0.004 && 'bl-money-muted', kind === 'signed' && value < 0 && 'neg', kind === 'muted' && 'bl-money-muted', strong && 'bl-money-strong', className].filter(Boolean).join(' ')
  return <span className={cls}>{money(value)}</span>
}

// ---- period bar -------------------------------------------------------------------------------

const PERIOD_LABEL: Record<PeriodPreset, string> = { today: 'today', week: 'thisWeek', month: 'thisMonth', lastMonth: 'lastMonth', custom: 'custom' }

/**
 * The selected period of one screen, remembered per device (the preset, and the dates of a custom range).
 * Returns [period to query (a custom range put the right way round), setter, the range exactly as typed].
 * The date fields show what was typed: while a year is being keyed in, the half-typed date must not jump fields.
 */
export function usePeriod(screen: string, initial: PeriodPreset = 'month'): [Period, (p: Period) => void, Period] {
  const key = `dentora.billing.period.${screen}`
  const [raw, setRaw] = useState<Period>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        const s = JSON.parse(stored) as Period
        if (s.preset === 'custom') return normalizePeriod(s)
        if (PERIOD_PRESETS.includes(s.preset)) return presetPeriod(s.preset, todayISO())
      }
    } catch { /* ignore */ }
    return presetPeriod(initial, todayISO())
  })
  const effective = useMemo(() => (raw.preset === 'custom' ? normalizePeriod(raw) : raw), [raw])
  const set = (next: Period) => {
    setRaw(next)
    try { localStorage.setItem(key, JSON.stringify(next.preset === 'custom' ? normalizePeriod(next) : next)) } catch { /* ignore */ }
  }
  return [effective, set, raw]
}

export function PeriodBar({ value, onChange, end }: { value: Period; onChange: (p: Period) => void; end?: ReactNode }) {
  const { t, lang } = useI18n()
  const shown = value.preset === 'custom' ? normalizePeriod(value) : value
  const same = shown.from === shown.to
  return (
    <div className="bl-period">
      <div className="bl-scroll-x">
        <Segmented<PeriodPreset> value={value.preset} onChange={p => onChange(p === 'custom' ? { ...value, preset: 'custom' } : presetPeriod(p, todayISO()))}
          options={PERIOD_PRESETS.map(p => ({ value: p, label: t(PERIOD_LABEL[p]) }))} />
      </div>
      {value.preset === 'custom' && (
        <div className="bl-range">
          <Input type="date" size="sm" aria-label={t('from')} value={value.from} onChange={e => e.target.value && onChange({ ...value, from: e.target.value })} />
          <span className="muted">–</span>
          <Input type="date" size="sm" aria-label={t('to')} value={value.to} onChange={e => e.target.value && onChange({ ...value, to: e.target.value })} />
        </div>
      )}
      <div className="bl-period-label">
        <CalendarRange />
        <span>{same ? fmtDate(shown.from, lang, 'long') : `${fmtDate(shown.from, lang)} – ${fmtDate(shown.to, lang)}`}</span>
      </div>
      {end && <div className="bl-period-end">{end}</div>}
    </div>
  )
}

// ---- patient picker ---------------------------------------------------------------------------

/** Search-as-you-type patient field. Shows the chosen patient as a card with a "change" button. */
export function PatientPicker({ value, onChange, error, locked, label }: { value: string; onChange: (id: string) => void; error?: ReactNode; locked?: boolean; label?: ReactNode }) {
  const { t } = useI18n()
  const patients = useLiveQuery(() => db.patients.toArray(), [])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const selected = useMemo(() => patients?.find(p => p.id === value), [patients, value])

  const results = useMemo(() => {
    const list = (patients ?? []).filter(p => !p.archived)
    const s = q.trim()
    if (!s) return [...list].sort((a, b) => (b.lastVisit || b.updatedAt || '').localeCompare(a.lastVisit || a.updatedAt || '')).slice(0, 6)
    const digits = s.replace(/\s+/g, '')
    return list.filter(p => matches(p.name, s) || String(p.fileNo) === digits.replace(/^#/, '') || (!!p.phone && /\d{3,}/.test(digits) && p.phone.replace(/\s+/g, '').includes(digits))).slice(0, 8)
  }, [patients, q])
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [open])

  const pick = (p: Patient) => { onChange(p.id); setQ(''); setOpen(false) }

  if (selected) {
    return (
      <Field label={label ?? t('patient')} error={error}>
        <div className="bl-picked">
          <Avatar name={selected.name} src={selected.photo} size="sm" />
          <div className="grow">
            <div className="strong truncate">{selected.name}</div>
            <div className="text-xs muted row gap-2"><span>{t('fileNo')} <span className="num">{selected.fileNo}</span></span>{selected.phone && <><span className="subtle">·</span><span className="ltr">{formatPhone(selected.phone)}</span></>}</div>
          </div>
          {!locked && <Button size="sm" variant="ghost" onClick={() => { onChange(''); setTimeout(() => input.current?.focus(), 30) }}>{t('billing.changePatient')}</Button>}
        </div>
      </Field>
    )
  }
  return (
    <Field label={label ?? t('patient')} error={error} required>
      <div className="bl-picker" ref={box}>
        <Input ref={input} value={q} placeholder={t('billing.searchPatient')} iconStart={<Search />} invalid={!!error} autoComplete="off"
          onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter') { e.preventDefault(); if (open && results[active]) pick(results[active]) }
            else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
          }} />
        {open && patients && (
          <div className="bl-dropdown" role="listbox">
            {!q.trim() && results.length > 0 && <div className="bl-dropdown-label">{t('billing.recentPatients')}</div>}
            {results.length === 0 ? (
              <div className="bl-dropdown-empty"><UserRound />{t('billing.noPatients')}</div>
            ) : results.map((p, i) => (
              <button key={p.id} type="button" role="option" aria-selected={i === active} className={`bl-option${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(p)}>
                <Avatar name={p.name} src={p.photo} size="xs" />
                <span className="grow truncate strong">{p.name}</span>
                {p.phone && <span className="text-xs muted ltr hide-mobile">{formatPhone(p.phone)}</span>}
                <span className="bl-fileno num">#{p.fileNo}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  )
}

// ---- printed sheets ---------------------------------------------------------------------------

/** The clinic identity at the top of every printed sheet: logo, bilingual name, contact lines. */
export function ClinicIdentity({ clinic }: { clinic: Clinic }) {
  const { t, lang } = useI18n()
  const primary = (lang === 'en' ? clinic.nameEn || clinic.name : clinic.name || clinic.nameEn) || t('appName')
  const secondary = lang === 'en' ? (clinic.nameEn && clinic.name !== clinic.nameEn ? clinic.name : '') : clinic.nameEn
  return (
    <div className="bl-clinic">
      <div className="bl-clinic-logo">{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon size={30} />}</div>
      <div className="bl-clinic-text">
        <div className="bl-clinic-name">{primary}</div>
        {secondary && <div className="bl-clinic-alt" dir="auto">{secondary}</div>}
        {clinic.tagline && <div className="bl-clinic-tag">{clinic.tagline}</div>}
        <div className="bl-clinic-meta">
          {clinic.address && <span>{clinic.address}</span>}
          {(clinic.phone || clinic.phone2) && <span className="ltr">{[clinic.phone, clinic.phone2].filter(Boolean).map(p => formatPhone(p)).join(' · ')}</span>}
          {clinic.email && <span className="ltr">{clinic.email}</span>}
          {clinic.website && <span className="ltr">{clinic.website}</span>}
        </div>
      </div>
    </div>
  )
}

/** Clinic identity on the start side, the document title, number and key facts on the end side. */
export function SheetHeader({ clinic, title, number, facts }: { clinic: Clinic; title: ReactNode; number?: ReactNode; facts?: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <header className="bl-sheet-head">
      <ClinicIdentity clinic={clinic} />
      <div className="bl-doc">
        <div className="bl-doc-title">{title}</div>
        {number && <div className="bl-doc-no">{number}</div>}
        {facts && facts.length > 0 && (
          <dl className="bl-doc-facts">
            {facts.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
          </dl>
        )}
      </div>
    </header>
  )
}

/**
 * Prints the sheet of an open modal: the app behind it is hidden for the print and shown again afterwards.
 * (The invoice page prints directly: its sheet is the page.)
 */
export function printModalSheet() {
  const body = document.body
  body.classList.add('bl-printing')
  const done = () => { body.classList.remove('bl-printing'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  print()
}
/** Clears the modal print mode when a printable modal closes. */
export function usePrintCleanup(open: boolean) {
  useEffect(() => { if (!open) return; return () => document.body.classList.remove('bl-printing') }, [open])
}
