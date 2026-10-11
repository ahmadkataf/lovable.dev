// Pieces of the chart tab: summary strip, history timeline, print sheet.
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { History, RotateCcw, Trash2, X } from 'lucide-react'
import type { Patient, ToothRecord } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic, useUsers } from '@/app/hooks'
import { Badge, Button, Card, Chip, EmptyState, IconButton, Skeleton } from '@/ui'
import { ageFrom, dateOf, fmtDate, fmtTime, today } from '@/lib/dates'
import { CONDITION_META, type Dentition } from './teeth'
import { chartSummary, findingsTable, surfaceCode, timeline } from './lib'
import { ConditionSwatch, DentalChart } from './DentalChart'

// ---- summary --------------------------------------------------------------------------------------
const STAT_KEYS = ['caries', 'filled', 'crown', 'missing', 'implant', 'root_canal'] as const

export function ChartStats({ records }: { records: ToothRecord[] | undefined }) {
  const { t } = useI18n()
  const s = useMemo(() => chartSummary(records ?? []), [records])
  if (!records) {
    return (
      <div className="ch-stats" aria-busy="true">
        {STAT_KEYS.map(k => <div key={k} className="ch-stat"><div className="ch-stat-top"><Skeleton w={34} h={24} /><Skeleton w={34} h={34} r={10} /></div><Skeleton w="60%" h={12} /></div>)}
        <div className="ch-dmft"><Skeleton w="60%" h={14} /><Skeleton h={6} /><Skeleton w="80%" h={12} /></div>
      </div>
    )
  }
  const parts = [
    { key: 'd', v: s.dmft.d, c: CONDITION_META.caries.color, label: t('chart.dmft.d') },
    { key: 'm', v: s.dmft.m, c: 'var(--text-4)', label: t('chart.dmft.m') },
    { key: 'f', v: s.dmft.f, c: CONDITION_META.filled.color, label: t('chart.dmft.f') },
  ]
  return (
    <div className="ch-stats" data-testid="ch-stats">
      {STAT_KEYS.map(k => (
        <div key={k} className="ch-stat" data-stat={k} style={{ '--ch-c': CONDITION_META[k].color } as React.CSSProperties}>
          <div className="ch-stat-top">
            <span className={['ch-stat-value num', s[k] === 0 && 'is-zero'].filter(Boolean).join(' ')}>{s[k]}</span>
            <span className="ch-stat-icon"><ConditionSwatch condition={k} size={20} /></span>
          </div>
          <div className="ch-stat-label">{t(`chart.stat.${k}`)}</div>
        </div>
      ))}
      <div className="ch-dmft" title={t('chart.dmft.hint')} data-testid="ch-dmft">
        <div className="ch-dmft-head">
          <span className="ch-dmft-title">{t('chart.dmft')}</span>
          <span className="ch-dmft-total num">{s.dmft.total}</span>
        </div>
        <div className="ch-dmft-bar" dir="ltr">
          {s.dmft.total === 0 ? <span style={{ flexGrow: 1, background: 'var(--surface-3)' }} />
            : parts.filter(p => p.v > 0).map(p => <span key={p.key} style={{ flexGrow: p.v, background: p.c }} />)}
        </div>
        <div className="ch-dmft-parts">
          {parts.map(p => <span key={p.key} className="ch-dmft-part"><span className="ch-dot" style={{ '--ch-c': p.c } as React.CSSProperties} />{p.label}<b className="num">{p.v}</b></span>)}
        </div>
      </div>
    </div>
  )
}

// ---- history --------------------------------------------------------------------------------------
export function HistoryCard({ records, tooth, onlyTooth, setOnlyTooth, canEdit, onRestore, onDelete, onClose, onSelectTooth, onStart }: {
  records: ToothRecord[]; tooth: number | null; onlyTooth: boolean; setOnlyTooth: (v: boolean) => void; canEdit: boolean
  onRestore: (r: ToothRecord) => void; onDelete: (r: ToothRecord) => void; onClose: () => void; onSelectTooth: (n: number) => void; onStart: () => void
}) {
  const { t, lang } = useI18n()
  const users = useUsers(false)
  const list = useMemo(() => timeline(records, onlyTooth && tooth !== null ? tooth : undefined), [records, onlyTooth, tooth])
  const days = useMemo(() => {
    const out: { day: string; rows: ToothRecord[] }[] = []
    for (const r of list) { const d = dateOf(r.recordedAt); const last = out[out.length - 1]; if (last && last.day === d) last.rows.push(r); else out.push({ day: d, rows: [r] }) }
    return out
  }, [list])
  const userName = (id?: string) => users.find(u => u.id === id)?.name
  const dayLabel = (d: string) => (d === today() ? `${t('today')} · ${fmtDate(d, lang)}` : fmtDate(d, lang, 'long'))

  return (
    <Card className="ch-history rise-in" data-testid="ch-history">
      <div className="ch-history-head">
        <div>
          <h3>{t('chart.history.title')}</h3>
          <p>{t('chart.history.subtitle')}</p>
        </div>
        <div className="row gap-2 wrap">
          {tooth !== null && (
            <div className="chips">
              <Chip active={!onlyTooth} onClick={() => setOnlyTooth(false)}>{t('chart.history.all')}</Chip>
              <Chip active={onlyTooth} onClick={() => setOnlyTooth(true)}>{t('chart.history.only', { n: tooth })}</Chip>
            </div>
          )}
          <IconButton label={t('chart.hideHistory')} variant="ghost" size="sm" onClick={onClose}><X /></IconButton>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<History />} title={t('chart.history.empty')} description={t('chart.history.emptyDesc')}
          actions={canEdit ? <Button variant="primary" onClick={onStart}>{t('chart.empty.action')}</Button> : undefined} />
      ) : (
        <div className="ch-timeline">
          {days.map(g => (
            <div key={g.day}>
              <div className="ch-day">{dayLabel(g.day)}</div>
              {g.rows.map(r => {
                const isHealthy = r.condition === 'healthy'
                const status = isHealthy ? <Badge size="sm" tone="success">{t('chart.markedHealthy')}</Badge>
                  : r.active ? <Badge size="sm" tone="primary" dot>{t('chart.currentBadge')}</Badge> : <Badge size="sm">{t('chart.superseded')}</Badge>
                return (
                  <div key={r.id} className={['ch-tl', !r.active && 'is-inactive'].filter(Boolean).join(' ')} data-record={r.id}>
                    <button type="button" className="ch-tl-mark num" onClick={() => onSelectTooth(r.tooth)} title={t('chart.toothN', { n: r.tooth })}>{r.tooth}</button>
                    <div className="ch-tl-main">
                      <div className="ch-tl-head">
                        <ConditionSwatch condition={r.condition} size={16} />
                        <span className="ch-tl-name">{t(`cond.${r.condition}`)}</span>
                        {r.surfaces.length > 0 ? <span className="ch-surf-code">{surfaceCode(r.surfaces)}</span> : !isHealthy && <Badge size="sm">{t('chart.wholeTooth')}</Badge>}
                        {status}
                      </div>
                      {r.note && <div className="ch-record-note">{r.note}</div>}
                      <div className="ch-record-meta">{[fmtTime(r.recordedAt, lang), userName(r.recordedBy) && t('chart.recordedBy', { name: userName(r.recordedBy)! })].filter(Boolean).join(' · ')}</div>
                    </div>
                    {canEdit && (
                      <div className="ch-tl-actions">
                        {!r.active && !isHealthy && <IconButton label={t('chart.restoreRecord')} variant="ghost" size="sm" onClick={() => onRestore(r)}><RotateCcw /></IconButton>}
                        <IconButton label={t('chart.deleteRecord')} variant="ghost" size="sm" onClick={() => onDelete(r)}><Trash2 /></IconButton>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---- print ----------------------------------------------------------------------------------------
/** The printable sheet: rendered into <body> while printing, alone on the page (see .ch-printing in chart.css). */
export function PrintSheet({ patient, records, dentition, onDone }: { patient: Patient | null | undefined; records: ToothRecord[]; dentition: Dentition; onDone: () => void }) {
  const { t, lang, dir, pick } = useI18n()
  const clinic = useClinic()
  const users = useUsers(false)
  const rows = useMemo(() => findingsTable(records), [records])
  useEffect(() => {
    document.body.classList.add('ch-printing')
    const done = () => { document.body.classList.remove('ch-printing'); onDone() }
    window.addEventListener('afterprint', done)
    return () => { window.removeEventListener('afterprint', done); document.body.classList.remove('ch-printing') }
  }, [onDone])
  const age = ageFrom(patient?.birthDate)
  return createPortal(
    <div className="ch-print-sheet print-area" dir={dir} lang={lang}>
      <div className="ch-print-head">
        <div>
          <div className="ch-print-clinic">{pick(clinic.name, clinic.nameEn) || t('appName')}</div>
          <div className="ch-print-title">{t('chart.print.title')}</div>
        </div>
        <dl className="ch-print-meta">
          {patient && <><dt>{t('patient')}</dt><dd>{patient.name}</dd><dt>{t('fileNo')}</dt><dd className="num">{patient.fileNo}</dd></>}
          {age !== null && <><dt>{t('chart.print.age')}</dt><dd className="num">{age}</dd></>}
          <dt>{t('chart.print.printedOn')}</dt><dd>{fmtDate(today(), lang)}</dd>
        </dl>
      </div>
      <div className="ch-print-chart"><DentalChart records={records} dentition={dentition} interactive={false} readOnly /></div>
      <div className="ch-print-h">{t('chart.print.findings')}</div>
      {rows.length === 0 ? <p>{t('chart.print.none')}</p> : (
        <table className="ch-print-table">
          <thead><tr><th>{t('chart.col.tooth')}</th><th>{t('chart.col.condition')}</th><th>{t('chart.col.surfaces')}</th><th>{t('chart.col.note')}</th><th>{t('chart.col.date')}</th><th>{t('chart.col.by')}</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="num"><b>{r.tooth}</b></td>
                <td><span className="ch-print-cond"><ConditionSwatch condition={r.condition} size={14} />{t(`cond.${r.condition}`)}</span></td>
                <td><span className="ltr">{surfaceCode(r.surfaces) || t('chart.wholeTooth')}</span></td>
                <td>{r.note ?? ''}</td>
                <td>{fmtDate(r.recordedAt, lang)}</td>
                <td>{users.find(u => u.id === r.recordedBy)?.name ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>, document.body)
}
