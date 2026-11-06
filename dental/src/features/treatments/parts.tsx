// UI pieces shared by the three screens of the module: badges, the FDI tooth picker, surface chips, the procedure picker.
import { useId, useMemo, useState, type ReactNode } from 'react'
import { Ban, Check, CheckCircle2, CircleDashed, Clock3, Search, Timer, X } from 'lucide-react'
import type { Procedure, ProcedureCategory, ToothSurface, TreatmentStatus, User } from '@/db/types'
import { PROCEDURE_CATEGORIES } from '@/db/types'
import { useI18n } from '@/i18n'
import { useMoney } from '@/app/hooks'
import { ToothIcon } from '@/app/ToothIcon'
import { Badge, Chip, EmptyState, Field, Input, NumberInput, Switch, type NumberInputProps, type Tone } from '@/ui'
import { matches } from '@/lib/format'
import { toothLabel } from '@/features/chart/teeth'
import { isPrimaryTooth, sortProcedures, surfaceCode, surfacesForTeeth, TEETH_GRID, type Dentition, type PlanStatus } from './lib'

// ---- categories -----------------------------------------------------------------------------------

export const CATEGORY_TONE: Record<ProcedureCategory, Tone> = {
  diagnostic: 'info', preventive: 'success', restorative: 'primary', endodontic: 'pink', periodontic: 'orange', prosthodontic: 'warning',
  surgical: 'danger', orthodontic: 'purple', pediatric: 'accent', cosmetic: 'pink', implant: 'purple', other: 'default',
}
/** A colour token per category, for dots and section accents. */
export const CATEGORY_COLOR: Record<ProcedureCategory, string> = {
  diagnostic: 'var(--info)', preventive: 'var(--success)', restorative: 'var(--primary)', endodontic: 'var(--pink)', periodontic: 'var(--orange)', prosthodontic: 'var(--warning)',
  surgical: 'var(--danger)', orthodontic: 'var(--purple)', pediatric: 'var(--accent)', cosmetic: 'var(--tooth-veneer)', implant: 'var(--tooth-implant)', other: 'var(--text-4)',
}
export function CategoryBadge({ category, size }: { category: ProcedureCategory; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  return <Badge tone={CATEGORY_TONE[category]} size={size}>{t(`cat.${category}`)}</Badge>
}
export function CategoryDot({ category, color }: { category?: ProcedureCategory; color?: string }) {
  return <span className="tr-dot" style={{ background: color || (category ? CATEGORY_COLOR[category] : 'var(--text-4)') }} aria-hidden="true" />
}

// ---- statuses -------------------------------------------------------------------------------------

const ITEM_TONE: Record<TreatmentStatus, Tone> = { planned: 'info', in_progress: 'warning', completed: 'success', cancelled: 'default' }
const ITEM_ICON: Record<TreatmentStatus, typeof Check> = { planned: Clock3, in_progress: Timer, completed: CheckCircle2, cancelled: Ban }
export function ItemStatusBadge({ status, size }: { status: TreatmentStatus; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  const I = ITEM_ICON[status]
  return <Badge tone={ITEM_TONE[status]} size={size} icon={<I />}>{t(`tr.${status}`)}</Badge>
}
const PLAN_TONE: Record<PlanStatus, Tone> = { draft: 'default', approved: 'accent', in_progress: 'warning', completed: 'success', cancelled: 'default' }
export function PlanStatusBadge({ status, size }: { status: PlanStatus; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  return <Badge tone={PLAN_TONE[status]} size={size} dot>{t(`plan.${status}`)}</Badge>
}

// ---- teeth ----------------------------------------------------------------------------------------

/** "16" with a tooth icon; surfaces (MOD) after it when given. */
export function ToothBadge({ tooth, surfaces, size }: { tooth?: number; surfaces?: ToothSurface[]; size?: 'sm' }) {
  const { lang } = useI18n()
  if (!tooth) return <span className="muted">—</span>
  const code = surfaceCode(surfaces)
  return (
    <span className={`tr-tooth${size === 'sm' ? ' sm' : ''}`} title={toothLabel(tooth, lang)}>
      <ToothIcon size={size === 'sm' ? 12 : 14} />
      <span className="num">{tooth}</span>
      {code && <span className="tr-tooth-surf ltr">{code}</span>}
    </span>
  )
}

/**
 * Compact FDI picker. Each arch shows the patient's right quadrant on the viewer's left, as on every chart, in both
 * languages (the grid is always laid out left to right). `marked` teeth carry a dot (work already planned on them).
 */
export function ToothGrid({ value, onChange, multi = true, marked, dentition: initial }: { value: number[]; onChange: (teeth: number[]) => void; multi?: boolean; marked?: ReadonlySet<number>; dentition?: Dentition }) {
  const { t, lang } = useI18n()
  const [dentition, setDentition] = useState<Dentition>(initial ?? (value.some(isPrimaryTooth) ? 'primary' : 'adult'))
  const grid = TEETH_GRID[dentition]
  const toggle = (n: number) => {
    if (!multi) { onChange(value[0] === n ? [] : [n]); return }
    onChange(value.includes(n) ? value.filter(x => x !== n) : [...value, n])
  }
  const arch = (rows: readonly (readonly number[])[], which: 'upper' | 'lower') => (
    <div className={`tr-arch tr-arch-${which}`} role="group" aria-label={t(`treatments.teeth.${which}`)}>
      {rows.map((q, qi) => (
        <div key={qi} className={`tr-quad tr-quad-${dentition}`}>
          {q.map(n => {
            const on = value.includes(n)
            return (
              <button key={n} type="button" className={`tr-tbtn${on ? ' on' : ''}`} aria-pressed={on} title={toothLabel(n, lang)} data-tooth={n} onClick={() => toggle(n)}>
                <span className="num">{n}</span>{marked?.has(n) && <span className="tr-tbtn-mark" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
  return (
    <div className="tr-teeth">
      <div className="tr-teeth-bar">
        <Switch checked={dentition === 'primary'} onChange={e => setDentition(e.target.checked ? 'primary' : 'adult')} label={t('treatments.teeth.primary')} />
        <span className="grow" />
        {value.length > 0 && (
          <button type="button" className="tr-linkbtn" onClick={() => onChange([])}><X />{t('treatments.teeth.clear')}</button>
        )}
      </div>
      <div className="tr-teeth-grid" dir="ltr">
        <div className="tr-side-labels" aria-hidden="true"><span>{t('treatments.teeth.right')}</span><span>{t('treatments.teeth.left')}</span></div>
        {arch(grid.upper, 'upper')}
        <div className="tr-occlusal" aria-hidden="true" />
        {arch(grid.lower, 'lower')}
      </div>
    </div>
  )
}

/** Surface chips for the chosen teeth (O only for back teeth, I only for front teeth). */
export function SurfaceChips({ teeth, value, onChange }: { teeth: number[]; value: ToothSurface[]; onChange: (s: ToothSurface[]) => void }) {
  const { t } = useI18n()
  const options = surfacesForTeeth(teeth)
  return (
    <div className="chips tr-surfaces">
      {options.map(s => (
        <Chip key={s} active={value.includes(s)} onClick={() => onChange(value.includes(s) ? value.filter(x => x !== s) : [...value, s])} icon={value.includes(s) ? <Check /> : undefined}>
          {t(`surf.${s}`)}
        </Chip>
      ))}
    </div>
  )
}

// ---- procedure picker -----------------------------------------------------------------------------

/** Searchable list of active procedures with category chips. */
export function ProcedurePicker({ procedures, value, onPick, error }: { procedures: Procedure[]; value?: string; onPick: (p: Procedure) => void; error?: ReactNode }) {
  const { t, pick } = useI18n()
  const money = useMoney()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ProcedureCategory | ''>('')
  const cats = useMemo(() => PROCEDURE_CATEGORIES.filter(c => procedures.some(p => p.category === c)), [procedures])
  const list = useMemo(() => sortProcedures(procedures.filter(p => (!cat || p.category === cat) && (!q || matches(p.name, q) || matches(p.nameEn, q) || matches(p.code, q)))), [procedures, cat, q])
  return (
    <div className={`tr-picker${error ? ' invalid' : ''}`}>
      <div className="tr-picker-head">
        <Input iconStart={<Search />} placeholder={t('treatments.picker.search')} value={q} onChange={e => setQ(e.target.value)} clearable onClear={() => setQ('')} aria-label={t('treatments.picker.search')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (q.trim() && list.length) onPick(list[0]) } }} />
        <div className="tr-chips-scroll">
          <Chip active={!cat} onClick={() => setCat('')}>{t('all')}</Chip>
          {cats.map(c => <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? '' : c)} icon={<CategoryDot category={c} />}>{t(`cat.${c}`)}</Chip>)}
        </div>
      </div>
      <div className="tr-picker-list" role="listbox" aria-label={t('treatments.item.procedure')}>
        {list.length === 0 ? <EmptyState compact icon={<CircleDashed />} title={t('noResults')} description={procedures.length ? t('treatments.picker.noMatch') : t('treatments.picker.noProcedures')} />
          : list.map(p => {
            const on = p.id === value
            const alt = pick(p.nameEn, p.name)
            return (
              <button key={p.id} type="button" role="option" aria-selected={on} className={`tr-pick${on ? ' on' : ''}`} onClick={() => onPick(p)}>
                <CategoryDot category={p.category} color={p.color} />
                <span className="tr-pick-main">
                  <span className="tr-pick-name">{pick(p.name, p.nameEn)}</span>
                  <span className="tr-pick-sub">
                    {p.code && <span className="num">{p.code}</span>}
                    {alt && alt !== pick(p.name, p.nameEn) && <span className="truncate" dir="auto">{alt}</span>}
                  </span>
                </span>
                {p.toothSpecific && <span className="tr-pick-tooth" title={t('treatments.proc.toothSpecific')}><ToothIcon size={14} /></span>}
                <span className="money tr-pick-price">{money(p.price)}</span>
                {on && <span className="tr-pick-check"><Check /></span>}
              </button>
            )
          })}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

// ---- people ---------------------------------------------------------------------------------------

/** Doctor name lookup that also knows deactivated users. */
export function nameOf(users: readonly User[], id?: string): string {
  if (!id) return ''
  return users.find(u => u.id === id)?.name ?? ''
}

// ---- fields ---------------------------------------------------------------------------------------

/**
 * A labelled number input with an addon (currency, %, min). The label sits above the whole group, so the addon box
 * lines up with the input instead of stretching over the label.
 */
export function NumField({ label, required, error, hint, className, ...rest }: Omit<NumberInputProps, 'label' | 'hint' | 'error'> & { label: ReactNode; required?: boolean; error?: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <Field label={label} required={required} error={error} hint={hint} className={['tr-numfield', className].filter(Boolean).join(' ')} htmlFor={id}>
      <NumberInput id={id} invalid={!!error} {...rest} />
    </Field>
  )
}
