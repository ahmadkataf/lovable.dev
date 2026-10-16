// Small views of the lab module: status / due badges, teeth badges, the FDI teeth picker and the status actions.
import type { ReactNode } from 'react'
import { AlertCircle, Ban, CheckCircle2, Clock, Hammer, PackageCheck, PencilLine, RotateCcw, Send } from 'lucide-react'
import type { LabOrder, LabOrderStatus } from '@/db/types'
import { useI18n } from '@/i18n'
import { Badge, toneFor } from '@/ui'
import { addDays, diffDays, fmtDate } from '@/lib/dates'
import { FDI_LOWER_LEFT, FDI_LOWER_RIGHT, FDI_UPPER_LEFT, FDI_UPPER_RIGHT, FDI_UPPER, FDI_LOWER, SHADE_SWATCH, isOverdue, isPending, sortTeeth, teethLabel, toggleTooth } from './lib'
import './lab.css'

export const STATUS_ICON: Record<LabOrderStatus, typeof Send> = {
  draft: PencilLine, sent: Send, in_progress: Hammer, received: PackageCheck, fitted: CheckCircle2, remake: RotateCcw, cancelled: Ban,
}

export function LabStatusBadge({ status, size }: { status: LabOrderStatus; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  const I = STATUS_ICON[status]
  return <Badge tone={toneFor(status)} size={size} icon={<I />} className="lab-status">{t(`lab.${status}`)}</Badge>
}

/** The due date: red when overdue, amber when due within two days, plain otherwise. */
export function DueBadge({ order, today }: { order: LabOrder; today: string }) {
  const { t, lang } = useI18n()
  if (!order.dueDate) return <span className="muted">—</span>
  const label = fmtDate(order.dueDate, lang)
  if (isOverdue(order, today)) {
    const late = diffDays(order.dueDate, today)
    return <span title={t('lab.due.lateBy', { n: late })}><Badge tone="danger" icon={<AlertCircle />} className="lab-due">{label}</Badge></span>
  }
  if (isPending(order) && order.dueDate <= addDays(today, 2)) {
    return <Badge tone="warning" icon={<Clock />} className="lab-due">{order.dueDate === today ? t('today') : order.dueDate === addDays(today, 1) ? t('tomorrow') : label}</Badge>
  }
  return <span className="lab-date">{label}</span>
}

/** Teeth as small numbered chips; long lists are cut with +N. */
export function TeethBadges({ teeth, max = 4, empty }: { teeth: number[]; max?: number; empty?: ReactNode }) {
  const list = sortTeeth(teeth)
  if (!list.length) return <>{empty ?? <span className="muted">—</span>}</>
  return (
    <span className="lab-teeth-badges" dir="ltr">
      {list.slice(0, max).map(n => <span key={n} className="lab-tooth-badge num">{n}</span>)}
      {list.length > max && <span className="lab-tooth-more num" title={list.slice(max).join(', ')}>+{list.length - max}</span>}
    </span>
  )
}

export function ShadeChip({ shade }: { shade?: string }) {
  if (!shade) return <span className="muted">—</span>
  const sw = SHADE_SWATCH[shade.toUpperCase()]
  return <span className="lab-shade">{sw && <span className="lab-shade-sw" style={{ background: sw }} />}<span className="num">{shade}</span></span>
}

/**
 * Compact FDI picker as the dentist faces the patient: upper 18…11 | 21…28, lower 48…41 | 31…38.
 * Always laid out left-to-right (it is an anatomical view, not text).
 */
export function TeethPicker({ value, onChange, readOnly }: { value: number[]; onChange?: (teeth: number[]) => void; readOnly?: boolean }) {
  const { t, lang } = useI18n()
  const set = new Set(value)
  const toggle = (n: number) => { if (!readOnly && onChange) onChange(toggleTooth(value, n)) }
  const btn = (n: number) => (
    <button key={n} type="button" className={`lab-tooth${set.has(n) ? ' on' : ''}`} aria-pressed={set.has(n)} onClick={() => toggle(n)} disabled={readOnly} tabIndex={readOnly ? -1 : 0}>
      <span className="num">{n}</span>
    </button>
  )
  const all = (row: number[]) => row.every(n => set.has(n))
  const setRow = (row: number[]) => onChange?.(all(row) ? sortTeeth(value.filter(n => !row.includes(n))) : sortTeeth([...value, ...row]))
  return (
    <div className={`lab-teeth${readOnly ? ' ro' : ''}`}>
      <div className="lab-teeth-grid" dir="ltr">
        <span className="lab-side lab-side-r">{t('lab.teeth.right')}</span>
        <div className="lab-arch">
          <div className="lab-q lab-q1">{FDI_UPPER_RIGHT.map(btn)}</div>
          <div className="lab-q lab-q2">{FDI_UPPER_LEFT.map(btn)}</div>
        </div>
        <div className="lab-occlusal" />
        <div className="lab-arch">
          <div className="lab-q lab-q4">{FDI_LOWER_RIGHT.map(btn)}</div>
          <div className="lab-q lab-q3">{FDI_LOWER_LEFT.map(btn)}</div>
        </div>
        <span className="lab-side lab-side-l">{t('lab.teeth.left')}</span>
      </div>
      {!readOnly && (
        <div className="lab-teeth-tools">
          <span className="lab-teeth-sel">{value.length ? t('lab.teeth.selected', { list: teethLabel(value, lang) }) : t('lab.teeth.none')}</span>
          <span className="row gap-1">
            <button type="button" className={`lab-chip-btn${all(FDI_UPPER) ? ' on' : ''}`} onClick={() => setRow(FDI_UPPER)}>{t('lab.teeth.upper')}</button>
            <button type="button" className={`lab-chip-btn${all(FDI_LOWER) ? ' on' : ''}`} onClick={() => setRow(FDI_LOWER)}>{t('lab.teeth.lower')}</button>
            {value.length > 0 && <button type="button" className="lab-chip-btn" onClick={() => onChange?.([])}>{t('lab.teeth.clear')}</button>}
          </span>
        </div>
      )}
    </div>
  )
}
