// The panel of one tooth: its drawing (also the surface picker), current findings, the form to record a new one,
// and the tooth's own history. A drawer on desktop, a bottom sheet on the phone.
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { History, ListChecks, Plus, RotateCcw, ShieldCheck, Stethoscope, Trash2, Eraser } from 'lucide-react'
import type { ToothCondition, ToothRecord, ToothSurface } from '@/db/types'
import { useI18n } from '@/i18n'
import { useIsMobile, useUsers } from '@/app/hooks'
import { Badge, Button, Drawer, IconButton, Modal, Textarea, useConfirmDelete, useToast } from '@/ui'
import { fmtDate, fmtTime } from '@/lib/dates'
import { CONDITION_META, SURFACE_CONDITIONS, WHOLE_CONDITIONS, isSurfaceCondition, normalizeSurfaces, toothInfo, toothLabel } from './teeth'
import { activeRecords, surfaceCode, timeline, validateDraft } from './lib'
import { ConditionSwatch, ToothDiagram } from './DentalChart'
import type { useChartActions } from './useChartActions'

export interface ToothPanelProps {
  tooth: number | null
  records: ToothRecord[]
  picked: ToothSurface[]
  setPicked: (s: ToothSurface[]) => void
  canEdit: boolean
  actions: ReturnType<typeof useChartActions>
  onClose: () => void
  onTreat: (n: number) => void
}

// The form state is shared by the body and the footer (they render in different slots of the drawer).
interface FormState { condition: ToothCondition | null; note: string; error: null | 'condition' | 'surfaces'; saving: boolean; tried: boolean }
const EMPTY_FORM: FormState = { condition: null, note: '', error: null, saving: false, tried: false }
type FormApi = { f: FormState; setForm: (p: Partial<FormState>) => void; resetForm: () => void; confirming: MutableRefObject<boolean> }

export default function ToothPanel(props: ToothPanelProps) {
  const isMobile = useIsMobile()
  const { tooth, onClose } = props
  const [f, setF] = useState<FormState>(EMPTY_FORM)
  const setForm = useCallback((p: Partial<FormState>) => setF(cur => ({ ...cur, ...p })), [])
  const resetForm = useCallback(() => setF(EMPTY_FORM), [])
  useEffect(() => { setF(EMPTY_FORM) }, [tooth])
  // Escape reaches every open overlay: while a delete confirmation is up, it must close only the confirmation
  const confirming = useRef(false)
  const close = useCallback(() => { if (!confirming.current) onClose() }, [onClose])
  if (tooth === null) return null
  const api: FormApi = { f, setForm, resetForm, confirming }
  const title = <PanelTitle n={tooth} />
  const footer = <PanelFooter {...props} {...api} n={tooth} />
  const body = <PanelBody {...props} {...api} n={tooth} />
  return isMobile
    ? <Modal open onClose={close} title={title} size="lg" footer={footer}>{body}</Modal>
    : <Drawer open onClose={close} title={title} footer={footer}>{body}</Drawer>
}

function PanelTitle({ n }: { n: number }) {
  const { t, lang } = useI18n()
  const info = toothInfo(n)!
  return (
    <div className="ch-panel-title">
      <span className="ch-tooth-no num">{n}</span>
      <div className="grow">
        <div className="ch-panel-name">{toothLabel(n, lang)}</div>
        <div className="ch-panel-sub">{t(`chart.type.${info.type}`)} · {t(info.primary ? 'chart.primaryTooth' : 'chart.permanentTooth')}</div>
      </div>
    </div>
  )
}

function PanelBody({ n, records, picked, setPicked, canEdit, actions, f, setForm, confirming }: ToothPanelProps & FormApi & { n: number }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const confirmDelete = useConfirmDelete()
  const users = useUsers(false)
  const info = toothInfo(n)!
  const active = useMemo(() => activeRecords(records, n).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)), [records, n])
  const past = useMemo(() => timeline(records, n).filter(r => !r.active || r.condition === 'healthy'), [records, n])
  const userName = (id?: string) => users.find(u => u.id === id)?.name
  const [showPast, setShowPast] = useState(false)

  useEffect(() => { setShowPast(false) }, [n])
  // a failed save scrolls its message into view (the form can be below the fold)
  useEffect(() => {
    if (f.tried && f.error) document.querySelector('.ch-panel .ch-field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [f.tried, f.error])
  const scope = f.condition ? CONDITION_META[f.condition].scope : null
  const surfacesDisabled = !canEdit || scope === 'tooth'

  const toggleSurface = (s: ToothSurface) => {
    if (surfacesDisabled) return
    const next = picked.includes(s) ? picked.filter(x => x !== s) : normalizeSurfaces(n, [...picked, s])
    setPicked(next)
    if (f.error === 'surfaces' && next.length) setForm({ error: null })
  }
  const chooseCondition = (c: ToothCondition) => {
    setForm({ condition: c, error: null })
    if (CONDITION_META[c].scope === 'tooth') setPicked([])
  }
  const del = async (r: ToothRecord) => {
    confirming.current = true
    let ok = false
    try { ok = await confirmDelete(t('chart.confirmDelete')) } finally { window.setTimeout(() => { confirming.current = false }, 0) }
    if (!ok) return
    await actions.remove(r)
    toast.success(t('chart.recordDeleted'))
  }
  const restore = async (r: ToothRecord) => {
    await actions.restore(r)
    toast.success(t('chart.recordRestored'))
  }

  const meta = (r: ToothRecord) => [fmtDate(r.recordedAt, lang), fmtTime(r.recordedAt, lang), userName(r.recordedBy) && t('chart.recordedBy', { name: userName(r.recordedBy)! })].filter(Boolean).join(' · ')
  const surfacesLabel = (r: ToothRecord) => r.surfaces.length ? <span className="ch-surf-code">{surfaceCode(r.surfaces)}</span> : <Badge size="sm">{t('chart.wholeTooth')}</Badge>
  const center: ToothSurface = info.anterior ? 'I' : 'O'

  return (
    <div className="ch-panel">
      <div className="ch-hero">
        <ToothDiagram n={n} records={records} picked={picked} onToggle={canEdit ? toggleSurface : undefined} disabled={surfacesDisabled} />
        <div className="ch-hero-facts">
          <div className="ch-hero-badges">
            {active.length === 0 ? <Badge tone="success" dot>{t('cond.healthy')}</Badge>
              : [...new Set(active.map(r => r.condition))].map(c => <Badge key={c} tone={CONDITION_META[c].tone === 'primary' ? 'primary' : CONDITION_META[c].tone} icon={<ConditionSwatch condition={c} size={14} />}>{t(`cond.${c}`)}</Badge>)}
          </div>
          {canEdit && <div className="ch-hero-help">{scope === 'tooth' ? t('chart.wholeHint') : t('chart.surfacesHint')}</div>}
        </div>
      </div>

      <section>
        <div className="ch-section-title"><ListChecks />{t('chart.current')}</div>
        {active.length === 0 ? (
          <div className="ch-none"><ShieldCheck /><div><div className="ch-none-title">{t('chart.current.none')}</div><div className="ch-none-desc">{t('chart.current.noneDesc')}</div></div></div>
        ) : (
          <div className="ch-records" data-testid="ch-active">
            {active.map(r => (
              <div key={r.id} className="ch-record">
                <ConditionSwatch condition={r.condition} size={20} />
                <div className="ch-record-main">
                  <div className="ch-record-head"><span className="ch-record-name">{t(`cond.${r.condition}`)}</span>{surfacesLabel(r)}</div>
                  {r.note && <div className="ch-record-note">{r.note}</div>}
                  <div className="ch-record-meta">{meta(r)}</div>
                </div>
                {canEdit && <div className="ch-record-actions"><IconButton label={t('chart.deleteRecord')} variant="ghost" size="sm" onClick={() => del(r)}><Trash2 /></IconButton></div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {canEdit && (
        <section className="ch-form">
          <div className="ch-section-title" style={{ marginBottom: 0 }}><Plus />{t('chart.addFinding')}</div>
          <div>
            <div className="ch-group-label">{t('chart.surfaceGroup')}</div>
            <div className="ch-cond-grid" role="group" aria-label={`${t('chart.condition')} — ${t('chart.surfaceGroup')}`}>
              {SURFACE_CONDITIONS.map(c => <CondButton key={c} c={c} active={f.condition === c} onClick={() => chooseCondition(c)} />)}
            </div>
          </div>
          <div>
            <div className="ch-group-label">{t('chart.wholeGroup')}</div>
            <div className="ch-cond-grid" role="group" aria-label={`${t('chart.condition')} — ${t('chart.wholeGroup')}`}>
              {WHOLE_CONDITIONS.map(c => <CondButton key={c} c={c} active={f.condition === c} onClick={() => chooseCondition(c)} />)}
            </div>
          </div>
          <div>
            <div className="ch-group-label">{t('chart.clearGroup')}</div>
            <div className="ch-cond-grid">
              <CondButton c="healthy" active={f.condition === 'healthy'} onClick={() => chooseCondition('healthy')} icon={<Eraser />} />
            </div>
          </div>
          {f.tried && f.error === 'condition' && <div className="ch-field-error" role="alert">{t('chart.v.condition')}</div>}
          <div>
            <div className="ch-group-label">{t('chart.surfaces')}</div>
            <div className="ch-surf-chips" role="group" aria-label={t('chart.surfaces')}>
              {info.surfaces.map(s => (
                <button key={s} type="button" className={['ch-surf-chip', picked.includes(s) && 'is-active'].filter(Boolean).join(' ')} disabled={surfacesDisabled} aria-pressed={picked.includes(s)} onClick={() => toggleSurface(s)}>
                  {t(`surf.${s === center ? center : s}`)}
                </button>
              ))}
            </div>
            {f.tried && f.error === 'surfaces' ? <div className="ch-field-error" role="alert">{t('chart.v.surfaces')}</div>
              : <div className="ch-form-hint">{scope === 'tooth' ? t('chart.wholeHint') : scope === 'clear' ? t('chart.healthyHint') : t('chart.surfacesHint')}</div>}
          </div>
          <Textarea label={t('chart.note')} placeholder={t('chart.notePlaceholder')} value={f.note} rows={2} style={{ minHeight: 64 }}
            onChange={e => setForm({ note: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); document.getElementById('ch-save-finding')?.click() } }} />
        </section>
      )}

      <section>
        <button type="button" className="ch-section-title" style={{ width: '100%' }} onClick={() => setShowPast(v => !v)} aria-expanded={showPast}>
          <History />{t('chart.toothHistory')}<span className="ch-count-pill"><Badge size="sm"><span className="num">{past.length}</span></Badge></span>
        </button>
        {showPast && (past.length === 0 ? <div className="muted text-sm">{t('chart.noToothHistory')}</div> : (
          <div className="ch-records">
            {past.map(r => (
              <div key={r.id} className="ch-record">
                <ConditionSwatch condition={r.condition} size={20} />
                <div className="ch-record-main">
                  <div className="ch-record-head">
                    <span className="ch-record-name">{t(`cond.${r.condition}`)}</span>{r.surfaces.length > 0 && surfacesLabel(r)}
                    <Badge size="sm" tone={r.condition === 'healthy' ? 'success' : 'default'}>{r.condition === 'healthy' ? t('chart.markedHealthy') : t('chart.superseded')}</Badge>
                  </div>
                  {r.note && <div className="ch-record-note">{r.note}</div>}
                  <div className="ch-record-meta">{meta(r)}</div>
                </div>
                {canEdit && (
                  <div className="ch-record-actions">
                    {r.condition !== 'healthy' && <IconButton label={t('chart.restoreRecord')} variant="ghost" size="sm" onClick={() => restore(r)}><RotateCcw /></IconButton>}
                    <IconButton label={t('chart.deleteRecord')} variant="ghost" size="sm" onClick={() => del(r)}><Trash2 /></IconButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}

function CondButton({ c, active, onClick, icon }: { c: ToothCondition; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <button type="button" className={['ch-cond', active && 'is-active'].filter(Boolean).join(' ')} style={{ '--ch-c': c === 'healthy' ? 'var(--success)' : CONDITION_META[c].color } as React.CSSProperties} aria-pressed={active} onClick={onClick} data-cond={c}>
      {icon ?? <ConditionSwatch condition={c} size={18} />}<span>{t(`cond.${c}`)}</span>
    </button>
  )
}

function PanelFooter({ n, picked, setPicked, canEdit, actions, onClose, onTreat, f, setForm, resetForm }: ToothPanelProps & FormApi & { n: number }) {
  const { t } = useI18n()
  const toast = useToast()
  const save = async () => {
    const err = validateDraft({ tooth: n, condition: f.condition ?? undefined, surfaces: picked })
    if (err === 'condition' || err === 'surfaces') { setForm({ error: err, tried: true }); return }
    if (!f.condition) return
    setForm({ saving: true })
    try {
      const cond = f.condition
      const surfaces = isSurfaceCondition(cond) || cond === 'healthy' ? picked : []
      await actions.save({ tooth: n, condition: cond, surfaces, note: f.note })
      toast.success(cond === 'healthy' ? (surfaces.length ? t('chart.clearedSurfaces', { n }) : t('chart.savedHealthy', { n })) : t('chart.savedFinding', { cond: t(`cond.${cond}`), n }))
      resetForm(); setPicked([])
    } catch (e) {
      setForm({ saving: false })
      toast.error(t('error'), String((e as Error)?.message ?? e))
    }
  }
  return (
    <div className="ch-panel-footer">
      <Button variant="soft" icon={<Stethoscope />} onClick={() => onTreat(n)}>{t('chart.treatTooth')}</Button>
      <span className="ch-spacer" />
      {canEdit ? <Button id="ch-save-finding" variant="primary" icon={<Plus />} loading={f.saving} onClick={save}>{t('chart.saveFinding')}</Button>
        : <Button variant="secondary" onClick={onClose}>{t('close')}</Button>}
    </div>
  )
}
