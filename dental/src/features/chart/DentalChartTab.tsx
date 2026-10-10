import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eraser, EyeOff, History, Info, Lock, MousePointer2, Paintbrush, Printer, Sparkles, UserX, ZoomIn, ZoomOut } from 'lucide-react'
import { db } from '@/db'
import type { ToothCondition, ToothRecord, ToothSurface } from '@/db/types'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useIsMobile } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { ToothIcon } from '@/app/ToothIcon'
import { print } from '@/platform'
import { Alert, Button, Card, EmptyState, IconBox, IconButton, Segmented, Skeleton, useConfirmDelete, useToast } from '@/ui'
import { ageFrom } from '@/lib/dates'
import { CONDITION_META, LEGEND_ORDER, isValidTooth, type Dentition } from './teeth'
import { activeRecords, conditionCounts, dentitionForAge, inDentition } from './lib'
import { ConditionSwatch, DentalChart } from './DentalChart'
import { ChartStats, HistoryCard, PrintSheet } from './ChartParts'
import ToothPanel from './ToothPanel'
import { useChartActions } from './useChartActions'
import './chart.css'

type Mode = 'select' | 'paint'

/** A tab of the patient profile. Receives the patient id and renders its own data. */
export default function DentalChartTab({ patientId }: { patientId: string }) {
  // keyed: moving to another patient starts from a clean state (dentition by that patient's age, nothing selected)
  return <ChartTab key={patientId} patientId={patientId} />
}

function ChartTab({ patientId }: { patientId: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const session = useSession()
  const license = useLicense()
  const isMobile = useIsMobile()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()
  const actions = useChartActions(patientId)
  const canEdit = !license.readOnly && session.can('clinical')

  const records = useLiveQuery(() => db.teeth.where('patientId').equals(patientId).toArray(), [patientId])
  const patient = useLiveQuery(() => db.patients.get(patientId).then(p => p ?? null), [patientId])

  const suggested = useMemo<Dentition>(() => dentitionForAge(ageFrom(patient?.birthDate)), [patient?.birthDate])
  const [dentition, setDentition] = useState<Dentition | null>(null)
  useEffect(() => { if (patient !== undefined && dentition === null) setDentition(suggested) }, [patient, suggested, dentition])
  const shown: Dentition = dentition ?? suggested

  const [mode, setMode] = useState<Mode>('select')
  const [paint, setPaint] = useState<ToothCondition | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [picked, setPicked] = useState<ToothSurface[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [onlyTooth, setOnlyTooth] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [printing, setPrinting] = useState(0)          // 0 = idle, otherwise the number of the print request

  // deep link: #/patients/:id?tab=chart&tooth=16 opens that tooth once. The param is then dropped, otherwise it would
  // ride along when the user switches tabs and the treatments tab would open "add item" for that tooth.
  useEffect(() => {
    if (params.get('tab') !== 'chart' || !params.has('tooth')) return
    const n = Number(params.get('tooth'))
    if (isValidTooth(n)) { setMode('select'); setPaint(null); setSelected(n); setPicked([]) }
    setParams(p => { const x = new URLSearchParams(p); x.delete('tooth'); return x }, { replace: true })
  }, [params, setParams])
  useEffect(() => { if (!canEdit && mode === 'paint') setMode('select') }, [canEdit, mode])

  const list = records ?? []
  const counts = useMemo(() => conditionCounts(list), [list])
  const active = useMemo(() => activeRecords(list), [list])
  const hidden = useMemo(() => active.some(r => !inDentition(r.tooth, shown)), [active, shown])

  const openTooth = useCallback((n: number, s?: ToothSurface) => { setSelected(n); setPicked(s ? [s] : []) }, [])
  const closeTooth = useCallback(() => { setSelected(null); setPicked([]) }, [])
  const onPaint = useCallback(async (n: number, surfaces: ToothSurface[]) => {
    if (!paint || !canEdit) return
    try { await actions.paint(n, surfaces, paint) } catch (e) { toast.error(t('error'), String((e as Error)?.message ?? e)) }
  }, [paint, canEdit, actions, toast, t])
  const startPaint = (c?: ToothCondition) => { if (!canEdit) return; setMode('paint'); setPaint(c ?? paint ?? 'caries'); setSelected(null); setPicked([]) }
  const restore = async (r: ToothRecord) => { await actions.restore(r); toast.success(t('chart.recordRestored')) }
  const remove = async (r: ToothRecord) => { if (await confirmDelete(t('chart.confirmDelete'))) { await actions.remove(r); toast.success(t('chart.recordDeleted')) } }
  const onTreat = (n: number) => navigate(`/patients/${patientId}?tab=treatments&tooth=${n}`)
  // a counter rather than a flag: a host that never fires 'afterprint' (the Android print adapter) must still print again
  const doPrint = useCallback(() => setPrinting(n => n + 1), [])
  const printDone = useCallback(() => setPrinting(0), [])
  useEffect(() => { if (printing) { const id = window.setTimeout(() => print(), 120); return () => window.clearTimeout(id) } }, [printing])

  if (patient === null) {
    return <Card><EmptyState icon={<UserX />} title={t('chart.notFound')} description={t('chart.notFoundDesc')} actions={<Button variant="primary" to="/patients">{t('nav.patients')}</Button>} /></Card>
  }

  const loading = records === undefined || patient === undefined
  const paintMeta = paint ? CONDITION_META[paint] : null
  const paintHint = !paint ? t('chart.paintPick')
    : paintMeta!.scope === 'clear' ? t('chart.paintClear')
    : t(paintMeta!.scope === 'surface' ? 'chart.paintSurface' : 'chart.paintWhole', { cond: t(`cond.${paint}`) })

  return (
    <div className="ch-tab" data-testid="chart-tab">
      {/* nothing recorded yet: the empty banner speaks instead of a row of zeros, and the chart moves up */}
      {(loading || list.length > 0) && <ChartStats records={loading ? undefined : list} />}

      <Card className="ch-card">
        <div className="ch-card-head">
          <div className="ch-card-title">
            <IconBox><ToothIcon size={22} /></IconBox>
            <div style={{ minWidth: 0 }}>
              <h3>{t('chart.title')}</h3>
              <p>{mode === 'paint' ? t('chart.paintSubtitle') : t('chart.subtitle')}</p>
            </div>
          </div>
          <div className="ch-toolbar no-print">
            {canEdit && (
              <Segmented<Mode> value={mode} onChange={m => (m === 'paint' ? startPaint() : (setMode('select'), setPaint(null)))}
                options={[{ value: 'select', label: t('chart.mode.select'), icon: <MousePointer2 /> }, { value: 'paint', label: t('chart.mode.paint'), icon: <Paintbrush /> }]} />
            )}
            <div className="ch-toolbar-group">
              <Segmented<Dentition> value={shown} onChange={setDentition}
                options={(['adult', 'mixed', 'primary'] as Dentition[]).map(d => ({ value: d, label: <span title={d === suggested ? t('chart.suggestedForAge') : undefined}>{t(`chart.dent.${d}`)}{d === suggested && <span className="ch-suggested" aria-hidden="true" />}</span> }))} />
              <Button variant={showHistory ? 'soft' : 'secondary'} size="sm" icon={<History />} onClick={() => setShowHistory(v => !v)} aria-pressed={showHistory} aria-label={t('chart.history')} title={t('chart.history')}>
                {!isMobile && t('chart.history')}
              </Button>
              <Button variant="secondary" size="sm" icon={<Printer />} onClick={doPrint} disabled={loading} aria-label={t('chart.printChart')} title={t('chart.printChart')}>{!isMobile && t('print')}</Button>
              {isMobile && <IconButton label={zoom ? t('chart.zoomOut') : t('chart.zoomIn')} variant={zoom ? 'soft' : 'secondary'} size="sm" onClick={() => setZoom(z => !z)}>{zoom ? <ZoomOut /> : <ZoomIn />}</IconButton>}
            </div>
          </div>
        </div>

        <div className="ch-card-body">
          {license.readOnly ? <Alert tone="warning" icon={<Lock />}>{t('trial.readonly')}</Alert>
            : !session.can('clinical') ? <div className="ch-hint is-muted"><EyeOff /><span className="grow">{t('chart.viewOnly')}</span></div> : null}

          {mode === 'paint' && (
            <div className="ch-hint is-paint" style={paint ? ({ '--ch-c': paint === 'healthy' ? 'var(--success)' : paintMeta!.color } as React.CSSProperties) : undefined} data-testid="ch-paint-hint">
              {paint ? (paint === 'healthy' ? <Eraser /> : <ConditionSwatch condition={paint} size={18} />) : <Info />}
              <span className="grow">{paintHint}</span>
              <Button size="sm" variant="secondary" onClick={() => { setMode('select'); setPaint(null) }}>{t('chart.stopPaint')}</Button>
            </div>
          )}

          {!loading && list.length === 0 && mode === 'select' && (
            <div className="ch-empty" data-testid="ch-empty">
              <span className="ch-empty-icon"><Sparkles /></span>
              <div className="grow">
                <div className="ch-empty-title">{t('chart.empty.title')}</div>
                <div className="ch-empty-desc">{t('chart.empty.desc')}</div>
              </div>
              {canEdit && <Button variant="primary" icon={<Paintbrush />} onClick={() => startPaint('caries')}>{t('chart.empty.action')}</Button>}
            </div>
          )}

          {hidden && shown !== 'mixed' && (
            <div className="ch-hint is-muted"><Info /><span className="grow">{t('chart.hiddenFindings')}</span><Button size="sm" variant="secondary" onClick={() => setDentition('mixed')}>{t('chart.showMixed')}</Button></div>
          )}

          <div className={['ch-canvas', zoom && isMobile && 'is-zoomed'].filter(Boolean).join(' ')} dir="ltr">
            {loading ? <Skeleton className="ch-loading" /> : (
              <DentalChart records={list} dentition={shown} selected={selected ?? undefined} selectedSurfaces={picked}
                onToothClick={n => openTooth(n)} onSurfaceClick={(n, s) => openTooth(n, s)}
                paintCondition={mode === 'paint' ? paint : null} onPaint={onPaint} readOnly={!canEdit} legend={false} />
            )}
          </div>

          <div className="ch-palette no-print">
            <div className="ch-palette-title">{mode === 'paint' ? t('chart.paletteTitle') : t('chart.legend')}</div>
            <div className="ch-chips" role={mode === 'paint' ? 'radiogroup' : undefined} aria-label={t('chart.legend')}>
              {mode === 'paint' && (
                <button type="button" className={['ch-chip', paint === 'healthy' && 'is-active'].filter(Boolean).join(' ')} style={{ '--ch-c': 'var(--success)' } as React.CSSProperties}
                  role="radio" aria-checked={paint === 'healthy'} onClick={() => setPaint('healthy')} data-cond="healthy">
                  <Eraser />{t('chart.eraser')}
                </button>
              )}
              {LEGEND_ORDER.map(c => {
                const n = counts[c]
                const interactive = canEdit
                return (
                  <button key={c} type="button" className={['ch-chip', mode === 'paint' && paint === c && 'is-active', !interactive && 'is-static', mode === 'select' && n === 0 && 'is-dim'].filter(Boolean).join(' ')}
                    style={{ '--ch-c': CONDITION_META[c].color } as React.CSSProperties} disabled={!interactive} data-cond={c}
                    role={mode === 'paint' ? 'radio' : undefined} aria-checked={mode === 'paint' ? paint === c : undefined} title={interactive && mode === 'select' ? t('chart.paintWith') : undefined}
                    onClick={() => (mode === 'paint' ? setPaint(c) : startPaint(c))}>
                    <ConditionSwatch condition={c} size={18} />
                    {t(`cond.${c}`)}
                    {n > 0 && <span className="ch-count num">{n}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {showHistory && !loading && (
        <HistoryCard records={list} tooth={selected} onlyTooth={onlyTooth} setOnlyTooth={setOnlyTooth} canEdit={canEdit}
          onRestore={restore} onDelete={remove} onClose={() => setShowHistory(false)} onSelectTooth={n => { setMode('select'); setPaint(null); openTooth(n) }} onStart={() => startPaint('caries')} />
      )}

      <ToothPanel tooth={mode === 'select' ? selected : null} records={list} picked={picked} setPicked={setPicked} canEdit={canEdit} actions={actions} onClose={closeTooth} onTreat={onTreat} />
      {printing > 0 && <PrintSheet patient={patient} records={list} dentition={shown} onDone={printDone} />}
    </div>
  )
}
