// The calendar's views: the time grid (day columns per doctor, week columns per day), the month grid,
// the agenda list, and the phone layouts (day list, time strip, week strip).
import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Activity, Ban, CheckCheck, ChevronRight, CircleCheck, MessageCircle, Plus, UserCheck, UserX } from 'lucide-react'
import type { AppointmentStatus, Lang } from '@/db/types'
import { useI18n } from '@/i18n'
import { Button, IconButton } from '@/ui'
import { formatPhone } from '@/lib/format'
import { fmtDate, fmtTime, fromISODate, minutesToTime, relativeDay, diffDays, today as todayISO } from '@/lib/dates'
import { groupByDate, layoutColumns, minutesOfDay, monthGrid, nextStep, durationOf, isWorkingDay, slotIsBusy } from './lib'
import { aptVars, DocDot, PatientAvatar, StatusBadge, useCountLabel, useDurationLabel, type AptRow } from './shared'

const ST_ICON: Partial<Record<AppointmentStatus, ReactNode>> = {
  confirmed: <CheckCheck />, arrived: <UserCheck />, in_progress: <Activity />, completed: <CircleCheck />, cancelled: <Ban />, no_show: <UserX />,
}
const LOCALE = (lang: Lang) => (lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB')
const dowCache = new Map<string, Intl.DateTimeFormat>()
/** Weekday of a date: long, short or narrow ("السبت" / "Sat" / "S"). */
export function dowName(date: string, lang: Lang, width: 'long' | 'short' | 'narrow' = 'short'): string {
  const k = lang + width
  let f = dowCache.get(k)
  if (!f) { f = new Intl.DateTimeFormat(LOCALE(lang), { weekday: width }); dowCache.set(k, f) }
  return f.format(fromISODate(date))
}
const dayNum = (d: string) => Number(d.slice(8))
const onKeyActivate = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }

// ===== time grid ==================================================================================
export interface GridColumn {
  key: string
  date: string
  doctorId?: string
  head: ReactNode
  headStyle?: CSSProperties
  items: AptRow[]
  off?: boolean          // the clinic is closed that day
}
interface TimeGridProps {
  columns: GridColumn[]
  startMin: number
  endMin: number
  step: number
  pxPerMin: number
  workStart: number
  workEnd: number
  compact?: boolean      // week view: narrower columns, shorter cards
  readOnly?: boolean
  now: Date
  scrollKey: string      // scroll to "now" / the first appointment when this changes
  onSlot: (date: string, time: string, doctorId?: string) => void
  onOpen: (row: AptRow) => void
}

export function TimeGrid({ columns, startMin, endMin, step, pxPerMin, workStart, workEnd, compact, readOnly, now, scrollKey, onSlot, onOpen }: TimeGridProps) {
  const { t, lang } = useI18n()
  const scrollRef = useRef<HTMLDivElement>(null)
  const total = (endMin - startMin) * pxPerMin
  const slotH = step * pxPerMin
  const slots = useMemo(() => { const out: number[] = []; for (let m = startMin; m < endMin; m += step) out.push(m); return out }, [startMin, endMin, step])
  const hours = useMemo(() => { const out: number[] = []; for (let m = Math.ceil(startMin / 60) * 60; m <= endMin; m += 60) out.push(m); return out }, [startMin, endMin])
  const todayStr = todayISO()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const showNow = columns.some(c => c.date === todayStr) && nowMin >= startMin && nowMin <= endMin
  const nowTop = (nowMin - startMin) * pxPerMin

  // first paint of a date: bring "now" or the first appointment into view
  const firstItem = useMemo(() => Math.min(...columns.flatMap(c => c.items.map(i => minutesOfDay(i.start)))), [columns])
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let target = 0
    if (showNow) target = nowTop - 120
    else if (Number.isFinite(firstItem)) target = (firstItem - startMin) * pxPerMin - 40
    el.scrollTop = Math.max(0, target)
  }, [scrollKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const gridStyle = { ['--tg-cols' as string]: columns.length, ['--tg-colmin' as string]: compact ? '112px' : '200px', ['--slot-h' as string]: `${slotH}px` } as CSSProperties

  return (
    <div className={`apt-tg${compact ? ' compact' : ''}${readOnly ? ' ro' : ''}`} style={gridStyle}>
      <div className="apt-tg-scroll" ref={scrollRef}>
        <div className="apt-tg-inner">
          <div className="apt-tg-corner" />
          {columns.map((c, i) => <div key={c.key} className={`apt-tg-head${c.date === todayStr && compact ? ' today' : ''}${c.off ? ' off' : ''}${i === columns.length - 1 ? ' last' : ''}`} style={c.headStyle}>{c.head}</div>)}

          <div className="apt-tg-gutter">
            <div className="apt-tg-in" style={{ height: total }}>
              {hours.filter(m => !showNow || Math.abs(m - nowMin) >= 12).map(m => <span key={m} className="apt-tg-hour apt-tm" style={{ top: (m - startMin) * pxPerMin }}>{fmtTime(minutesToTime(m), lang)}</span>)}
              {showNow && <span className="apt-tg-nowlabel apt-tm" style={{ top: nowTop }}>{fmtTime(now, lang)}</span>}
            </div>
          </div>

          {columns.map((c, ci) => {
            const placed = layoutColumns(c.items)
            return (
              <div key={c.key} className={`apt-tg-col${c.off ? ' off' : ''}${ci === columns.length - 1 ? ' last' : ''}`}>
                <div className="apt-tg-in" style={{ height: total }}>
                  {slots.map(m => {
                    const kind = m % 60 === 0 ? 'hour' : m % 30 === 0 ? 'half' : 'q'
                    const off = c.off || m < workStart || m >= workEnd
                    const time = minutesToTime(m)
                    const cls = `apt-slot ${kind}${off ? ' off' : ''}${step >= 60 ? ' long' : ''}`
                    if (readOnly) return <div key={m} className={cls} style={{ height: slotH }} />
                    return (
                      <button key={m} type="button" className={cls} style={{ height: slotH }} onClick={() => onSlot(c.date, time, c.doctorId)}
                        aria-label={t('appointments.addAt', { time: `${fmtDate(c.date, lang, 'weekday')} ${fmtTime(time, lang)}` })}>
                        <span className="apt-slot-hint"><Plus />{fmtTime(time, lang)}</span>
                      </button>
                    )
                  })}
                  {placed.map(({ item, col, cols }) => {
                    const top = (minutesOfDay(item.start) - startMin) * pxPerMin
                    const height = Math.max(durationOf(item), 10) * pxPerMin
                    return <EventCard key={item.id} row={item} top={top} height={height} col={col} cols={cols} compact={compact} onOpen={onOpen} />
                  })}
                  {showNow && (!compact || c.date === todayStr) && <div className={`apt-now${ci === 0 || compact ? ' dot' : ''}`} style={{ top: nowTop }} aria-hidden="true" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EventCard({ row, top, height, col, cols, compact, onOpen }: { row: AptRow; top: number; height: number; col: number; cols: number; compact?: boolean; onOpen: (r: AptRow) => void }) {
  const { t, lang } = useI18n()
  const h = height - 2
  const size = h < 30 ? 's' : h < 52 || (compact && cols > 1) ? 'm' : 'l'
  const narrow = compact && cols > 1
  const name = row.patient?.name ?? t('appointments.deletedPatient')
  const title = `${fmtTime(row.start, lang)} – ${fmtTime(row.end, lang)} · ${name} · ${t(`aptType.${row.type}`)} · ${t(`apt.${row.status}`)}${row.doctor ? ` · ${row.doctor.name}` : ''}`
  const style = { top: top + 1, height: h, ['--c' as string]: col, ['--n' as string]: cols, ...aptVars(row) } as CSSProperties
  return (
    <button type="button" className={`apt-ev size-${size} is-${row.status}${narrow ? ' narrow' : ''}`} style={style} title={title} onClick={e => { e.stopPropagation(); onOpen(row) }}>
      {size === 's' ? (
        <span className="apt-ev-line"><span className="apt-ev-time apt-tm">{fmtTime(row.start, lang)}</span><span className="apt-ev-name">{name}</span></span>
      ) : size === 'm' ? (
        <>
          <span className="apt-ev-name">{name}</span>
          <span className="apt-ev-sub"><span className="apt-tm">{fmtTime(row.start, lang)}</span>{!compact && <> · {t(`aptType.${row.type}`)}</>}</span>
        </>
      ) : (
        <>
          <span className="apt-ev-time apt-tm">{fmtTime(row.start, lang)} – {fmtTime(row.end, lang)}</span>
          <span className="apt-ev-name">{name}</span>
          <span className="apt-ev-sub">{t(`aptType.${row.type}`)}{row.reason && !compact ? <> · {row.reason}</> : null}</span>
        </>
      )}
      {ST_ICON[row.status] && size !== 's' && !narrow && <span className="apt-ev-st" title={t(`apt.${row.status}`)}>{ST_ICON[row.status]}</span>}
    </button>
  )
}

// ===== month ======================================================================================
export function MonthView({ date, rows, workingDays, mobile, onDay, onOpen }: { date: string; rows: AptRow[]; workingDays: number[]; mobile: boolean; onDay: (d: string) => void; onOpen: (r: AptRow) => void }) {
  const { t, lang } = useI18n()
  const weeks = useMemo(() => monthGrid(date), [date])
  const byDate = useMemo(() => new Map(groupByDate(rows).map(g => [g.date, g.items])), [rows])
  const month = date.slice(0, 7)
  const todayStr = todayISO()
  return (
    <div className={`apt-month${mobile ? ' mobile' : ''}`} style={{ ['--weeks' as string]: weeks.length } as CSSProperties}>
      {weeks[0].map(d => <div key={d} className="apt-month-dow">{dowName(d, lang, mobile ? 'narrow' : 'long')}</div>)}
      {weeks.flat().map(d => {
        const items = byDate.get(d) ?? []
        const cls = ['apt-mcell', d.slice(0, 7) !== month && 'out', d === todayStr && 'today', !isWorkingDay(d, workingDays) && 'off', items.length > 0 && 'has'].filter(Boolean).join(' ')
        const label = `${fmtDate(d, lang, 'weekday')} — ${items.length}`
        return (
          <div key={d} className={cls} role="button" tabIndex={0} aria-label={label} onClick={() => onDay(d)} onKeyDown={onKeyActivate(() => onDay(d))}>
            <div className="apt-mcell-top">
              <span className="apt-mday num">{dayNum(d)}</span>
              {mobile && items.length > 0 && <span className="apt-mcount num">{items.length}</span>}
            </div>
            {mobile ? (
              <div className="apt-mdots">{items.slice(0, 4).map(r => <span key={r.id} className="apt-mdot" style={aptVars(r)} />)}</div>
            ) : (
              <>
                {items.slice(0, 3).map(r => (
                  <button key={r.id} type="button" className={`apt-mchip is-${r.status}`} style={aptVars(r)} onClick={e => { e.stopPropagation(); onOpen(r) }}
                    title={`${fmtTime(r.start, lang)} · ${r.patient?.name ?? ''} · ${t(`apt.${r.status}`)}`}>
                    <span className="apt-mchip-time apt-tm">{fmtTime(r.start, lang)}</span>
                    <span className="apt-mchip-name">{r.patient?.name ?? t('appointments.deletedPatient')}</span>
                  </button>
                ))}
                {items.length > 3 && <span className="apt-mmore">{t('appointments.moreN', { n: items.length - 3 })}</span>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ===== agenda =====================================================================================
export function AgendaView({ rows, mobile, readOnly, onOpen, onStep, onRemind }: {
  rows: AptRow[]; mobile: boolean; readOnly?: boolean
  onOpen: (r: AptRow) => void; onStep: (r: AptRow, s: AppointmentStatus) => void; onRemind: (r: AptRow) => void
}) {
  const { lang } = useI18n()
  const countLabel = useCountLabel()
  const groups = useMemo(() => groupByDate(rows), [rows])
  const todayStr = todayISO()
  return (
    <div className="apt-agenda">
      {groups.map(g => {
        const rel = Math.abs(diffDays(todayStr, g.date)) <= 1 ? relativeDay(g.date, lang) : null
        return (
          <section key={g.date} className={`apt-ag-day${g.date === todayStr ? ' today' : ''}`}>
            <header className="apt-ag-head">
              <span className="apt-ag-num num">{dayNum(g.date)}</span>
              <span className="grow">
                <span className="apt-ag-dow">{dowName(g.date, lang, 'long')}{rel && <span className="apt-ag-rel">{rel}</span>}</span>
                <span className="apt-ag-month">{fmtDate(g.date, lang, 'long')}</span>
              </span>
              <span className="apt-ag-count">{countLabel(g.items.length)}</span>
            </header>
            <div className="apt-ag-list">
              {g.items.map(r => mobile
                ? <MobileItem key={r.id} row={r} onOpen={onOpen} showDoctor />
                : <AgendaRow key={r.id} row={r} readOnly={readOnly} onOpen={onOpen} onStep={onStep} onRemind={onRemind} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function AgendaRow({ row, readOnly, onOpen, onStep, onRemind }: { row: AptRow; readOnly?: boolean; onOpen: (r: AptRow) => void; onStep: (r: AptRow, s: AppointmentStatus) => void; onRemind: (r: AptRow) => void }) {
  const { t, lang } = useI18n()
  const durLabel = useDurationLabel()
  const step = nextStep(row.status)
  const p = row.patient
  const canRemind = !!p?.phone && (row.status === 'scheduled' || row.status === 'confirmed') && row.date >= todayISO()
  return (
    <div className={`apt-arow is-${row.status}`} style={aptVars(row)} role="button" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={onKeyActivate(() => onOpen(row))}>
      <div className="apt-arow-time">
        <span className="apt-arow-start apt-tm">{fmtTime(row.start, lang)}</span>
        <span className="apt-arow-dur">{durLabel(row.durationMin)}</span>
      </div>
      <div className="apt-arow-patient">
        <PatientAvatar patient={p} size="sm" />
        <span className="grow">
          <span className="apt-arow-name truncate">{p?.name ?? t('appointments.deletedPatient')}</span>
          <span className="apt-arow-sub">{p?.phone ? <span className="ltr num">{formatPhone(p.phone)}</span> : <span className="subtle">—</span>}</span>
        </span>
      </div>
      <div className="apt-arow-doc truncate"><DocDot doctor={row.doctor} /><bdi className="truncate">{row.doctor?.name ?? t('unknown')}</bdi></div>
      <div className="apt-arow-type truncate">{t(`aptType.${row.type}`)}{row.reason && <span className="apt-arow-reason truncate">{row.reason}</span>}</div>
      <div className="apt-arow-status"><StatusBadge status={row.status} /></div>
      <div className="apt-arow-actions" onClick={e => e.stopPropagation()}>
        {!readOnly && step && <Button size="sm" variant={step === 'completed' ? 'success' : step === 'in_progress' ? 'primary' : 'soft'} onClick={() => onStep(row, step)}>{t(`appointments.action.${step}`)}</Button>}
        {!readOnly && canRemind && <IconButton size="sm" variant="ghost" label={t('appointments.reminder')} className="apt-wa-btn" onClick={() => onRemind(row)}><MessageCircle /></IconButton>}
        <IconButton size="sm" variant="ghost" label={t('details')} className="apt-flip" onClick={() => onOpen(row)}><ChevronRight /></IconButton>
      </div>
    </div>
  )
}

// ===== phone ======================================================================================
/** One appointment as a tappable card: the time on the start side, the patient and status on the card. */
export function MobileItem({ row, onOpen, showDoctor = true }: { row: AptRow; onOpen: (r: AptRow) => void; showDoctor?: boolean }) {
  const { t, lang } = useI18n()
  const durLabel = useDurationLabel()
  return (
    <button type="button" className={`apt-mitem is-${row.status}`} style={aptVars(row)} onClick={() => onOpen(row)}>
      <span className="apt-mitem-time">
        <span className="apt-tm">{fmtTime(row.start, lang)}</span>
        <small>{durLabel(row.durationMin)}</small>
      </span>
      <span className="apt-mitem-card">
        <span className="apt-mitem-top">
          <span className="apt-mitem-name">{row.patient?.name ?? t('appointments.deletedPatient')}</span>
          <StatusBadge status={row.status} size="sm" />
        </span>
        <span className="apt-mitem-sub">
          <span>{t(`aptType.${row.type}`)}</span>
          {showDoctor && row.doctor && <><span className="sep">·</span><DocDot doctor={row.doctor} /><bdi className="truncate">{row.doctor.name}</bdi></>}
        </span>
      </span>
    </button>
  )
}

export function DayList({ rows, onOpen, showDoctor }: { rows: AptRow[]; onOpen: (r: AptRow) => void; showDoctor?: boolean }) {
  return <div className="apt-daylist">{rows.map(r => <MobileItem key={r.id} row={r} onOpen={onOpen} showDoctor={showDoctor} />)}</div>
}

/** Horizontal strip of the day's slots: tap a time to book it. Busy slots are marked, not blocked. */
export function TimeStrip({ date, slots, rows, step, readOnly, onPick }: { date: string; slots: string[]; rows: AptRow[]; step: number; readOnly?: boolean; onPick: (time: string) => void }) {
  const { t, lang } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const isToday = date === todayISO()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!isToday) { el.scrollLeft = 0; return }
    const now = new Date(); const m = now.getHours() * 60 + now.getMinutes()
    const idx = slots.findIndex(s => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm >= m })
    const btn = el.children[Math.max(0, idx)] as HTMLElement | undefined
    if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'start' })
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps
  if (readOnly || slots.length === 0) return null
  return (
    <div className="apt-strip-wrap">
      <div className="apt-strip-label">{t('appointments.tapToBook')}</div>
      <div className="apt-strip" ref={ref}>
        {slots.map(s => {
          const busy = slotIsBusy(rows, date, s, step)
          return (
            <button key={s} type="button" className={`apt-strip-slot${busy ? ' busy' : ''}`} onClick={() => onPick(s)} aria-label={t('appointments.addAt', { time: fmtTime(s, lang) })}>
              {busy ? <span className="apt-strip-dot" /> : <Plus />}
              <span className="apt-tm">{fmtTime(s, lang)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Seven day chips with counts (phone week view). */
export function WeekStrip({ days, selected, counts, workingDays, onPick }: { days: string[]; selected: string; counts: Map<string, number>; workingDays: number[]; onPick: (d: string) => void }) {
  const { lang } = useI18n()
  const todayStr = todayISO()
  return (
    <div className="apt-wstrip" role="tablist">
      {days.map(d => {
        const n = counts.get(d) ?? 0
        const cls = ['apt-wday', d === selected && 'sel', d === todayStr && 'today', !isWorkingDay(d, workingDays) && 'off'].filter(Boolean).join(' ')
        return (
          <button key={d} type="button" role="tab" aria-selected={d === selected} className={cls} onClick={() => onPick(d)}>
            <span className="apt-wday-dow">{dowName(d, lang, 'short')}</span>
            <span className="apt-wday-num num">{dayNum(d)}</span>
            <span className={`apt-wday-count num${n ? '' : ' zero'}`}>{n || '·'}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Week header cell: weekday, day number (today in a circle) and the count; opens that day. */
export function WeekHead({ date, count, off, onOpen }: { date: string; count: number; off: boolean; onOpen: () => void }) {
  const { t, lang } = useI18n()
  return (
    <button type="button" className="apt-whead" onClick={onOpen} title={fmtDate(date, lang, 'weekday')}>
      <span className="apt-whead-dow">{dowName(date, lang, 'short')}</span>
      <span className="apt-whead-num num">{dayNum(date)}</span>
      <span className="apt-whead-sub">{off ? t('appointments.closed') : count ? <span className="num">{count}</span> : <span className="subtle">—</span>}</span>
    </button>
  )
}

