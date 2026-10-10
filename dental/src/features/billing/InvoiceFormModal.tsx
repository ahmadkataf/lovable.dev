// Create or edit an invoice: patient, doctor, dates, lines (from completed treatments, from the procedure list, or free),
// invoice discount and tax, live totals. A draft keeps the DRAFT number; issuing takes the next real number.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertCircle, Check, ClipboardList, FilePlus2, Link2, ListPlus, Plus, Receipt, Search, Stethoscope, Trash2, X } from 'lucide-react'
import { db, logActivity } from '@/db'
import { newId, todayISO } from '@/db/ids'
import type { Invoice, Procedure, TreatmentItem } from '@/db/types'
import { PROCEDURE_CATEGORIES } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic, useDoctors, useIsMobile, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { fmtDate } from '@/lib/dates'
import { matches } from '@/lib/format'
import { Alert, Badge, Button, Checkbox, IconButton, Input, Loading, Modal, NumberInput, Select, Textarea, useToast } from '@/ui'
import { saveInvoice } from './actions'
import { computeTotals, hasErrors, lineTotal, toDraftLines, toInvoiceItems, validateInvoice, type DraftLine, type LineErrors } from './lib'
import { Money, PatientPicker, ltr } from './shared'
import './billing.css'

export interface InvoiceFormModalProps {
  open: boolean
  onClose: () => void
  /** Pre-selects the patient of a new invoice. */
  patientId?: string
  /** Edits this invoice. */
  invoiceId?: string
  onSaved?: (inv: Invoice, mode: 'draft' | 'issue') => void
}

export default function InvoiceFormModal(props: InvoiceFormModalProps) {
  const { t } = useI18n()
  const existing = useLiveQuery(async (): Promise<Invoice | null> => (props.invoiceId ? (await db.invoices.get(props.invoiceId)) ?? null : null), [props.invoiceId])
  if (!props.open) return null
  if (existing === undefined) return <Modal open onClose={props.onClose} size="xl" title={t('billing.editInvoice')}><Loading /></Modal>
  return <InvoiceForm {...props} existing={existing} />
}

const lineKey = () => newId()

function InvoiceForm({ onClose, patientId: initialPatient, existing, onSaved }: InvoiceFormModalProps & { existing: Invoice | null }) {
  const { t, pick } = useI18n()
  const clinic = useClinic()
  const money = useMoney()
  const doctors = useDoctors()
  const session = useSession()
  const toast = useToast()
  const license = useLicense()
  const isMobile = useIsMobile()
  const isEdit = !!existing
  const isIssued = !!existing && existing.status !== 'draft'

  const [patientId, setPatientId] = useState(existing?.patientId ?? initialPatient ?? '')
  const [doctorId, setDoctorId] = useState(existing?.doctorId ?? (session.user && (session.user.role === 'doctor' || session.user.role === 'admin') ? session.user.id : ''))
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '')
  const [lines, setLines] = useState<DraftLine[]>(() => (existing ? toDraftLines(existing.items) : []))
  const [discount, setDiscount] = useState<number | null>(existing ? existing.discount || null : null)
  const [taxPercent, setTaxPercent] = useState<number | null>(existing ? existing.taxPercent : null)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [panel, setPanel] = useState<'treatments' | 'procedures' | null>(!existing && initialPatient ? 'treatments' : null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'issue' | null>(null)
  const focusKey = useRef<string | null>(null)

  // the clinic's tax rate is the default of a new invoice (it may load after the first render)
  useEffect(() => { if (!existing && taxPercent === null && clinic.taxPercent) setTaxPercent(clinic.taxPercent) }, [clinic.taxPercent, existing, taxPercent])

  const patient = useLiveQuery(() => (patientId ? db.patients.get(patientId) : undefined), [patientId])
  // a new invoice follows the patient's usual doctor
  useEffect(() => { if (!existing && patient?.doctorId && doctors.some(d => d.id === patient.doctorId)) setDoctorId(patient.doctorId) }, [patient?.id])

  const treatments = useLiveQuery(
    () => (patientId ? db.treatments.where('patientId').equals(patientId).filter(tr => tr.status === 'completed' && (!tr.invoiceId || tr.invoiceId === existing?.id)).toArray() : Promise.resolve([] as TreatmentItem[])),
    [patientId, existing?.id],
  )
  const usedTreatments = useMemo(() => new Set(lines.map(l => l.treatmentItemId).filter(Boolean)), [lines])
  const available = useMemo(() => (treatments ?? []).filter(tr => !usedTreatments.has(tr.id)).sort((a, b) => (a.completedAt || a.createdAt).localeCompare(b.completedAt || b.createdAt)), [treatments, usedTreatments])

  const totals = computeTotals(lines.map(l => ({ qty: l.qty || 0, unitPrice: l.unitPrice || 0, discount: l.discount || 0 })), discount || 0, taxPercent || 0)
  const errors = validateInvoice({ patientId, date, lines, discount, taxPercent })
  const show = submitted

  const changePatient = (id: string) => {
    if (id !== patientId) setLines(ls => ls.filter(l => !l.treatmentItemId))   // treatments belong to the previous patient
    setPatientId(id)
    if (id && panel === null && !isEdit) setPanel('treatments')
  }
  const update = (key: string, patch: Partial<DraftLine>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => setLines(ls => ls.filter(l => l.key !== key))
  const addLines = (add: DraftLine[]) => setLines(ls => [...ls, ...add])
  const addFree = () => {
    const key = lineKey()
    focusKey.current = key
    addLines([{ key, description: '', tooth: null, qty: 1, unitPrice: null, discount: null }])
    setPanel(null)
  }
  useEffect(() => {
    if (!focusKey.current) return
    const el = document.querySelector<HTMLInputElement>(`[data-line="${focusKey.current}"] input`)
    focusKey.current = null
    el?.focus()
  }, [lines])

  const run = async (mode: 'draft' | 'issue') => {
    setSubmitted(true)
    if (hasErrors(errors)) {
      setTimeout(() => document.querySelector('.bl-form .invalid, .bl-form .field-error, .bl-form .alert-danger')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30)
      return
    }
    setSaving(mode)
    try {
      const inv = await saveInvoice(
        { patientId, doctorId: doctorId || undefined, date, dueDate: dueDate || undefined, items: toInvoiceItems(lines, () => newId()), discount: discount || 0, taxPercent: taxPercent || 0, notes },
        { id: existing?.id, mode, userId: session.user?.id },
      )
      const name = patient?.name ?? ''
      const message = mode === 'draft' ? t('billing.act.draftCreated', { patient: name })
        : isIssued ? t('billing.act.invoiceUpdated', { number: ltr(inv.number), patient: name })
        : t('billing.act.invoiceCreated', { number: ltr(inv.number), patient: name })
      void logActivity({ type: 'invoice', action: isEdit ? 'update' : 'create', entityId: inv.id, patientId, message, by: session.user?.id })
      toast.success(mode === 'draft' ? t('billing.draftSaved') : isIssued ? t('billing.invoiceUpdated') : t('billing.invoiceIssued'), mode === 'issue' ? <><span className="num">{inv.number}</span> · <span className="money">{money(inv.total)}</span></> : undefined)
      onSaved?.(inv, mode)
      onClose()
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { setSaving(null) }
  }

  const ro = license.readOnly
  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} className="start">{t('cancel')}</Button>
      {!isIssued && <Button variant="secondary" icon={<FilePlus2 />} loading={saving === 'draft'} disabled={ro || !!saving} onClick={() => run('draft')}>{t('billing.saveDraft')}</Button>}
      <Button variant="primary" icon={isIssued ? <Check /> : <Receipt />} loading={saving === 'issue'} disabled={ro || !!saving} onClick={() => run('issue')}>{isIssued ? t('saveChanges') : t('billing.issue')}</Button>
    </>
  )
  const title = isEdit ? (isIssued ? `${t('billing.editInvoice')} · ${existing!.number}` : t('billing.editInvoice')) : t('billing.newInvoice')

  return (
    <Modal open onClose={onClose} size="xl" title={title} icon={<Receipt />} footer={footer} closeOnOverlay={false}>
      <div className="bl-form">
        {ro && <Alert tone="warning">{t('trial.readonly')}</Alert>}
        <div className="bl-form-top">
          <PatientPicker value={patientId} onChange={changePatient} error={show && errors.patient ? t('billing.v.patient') : undefined} locked={isIssued} />
          <Select label={t('doctor')} value={doctorId} onChange={e => setDoctorId(e.target.value)} placeholder="—"
            options={doctors.map(d => ({ value: d.id, label: d.name }))} />
          <Input type="date" label={t('billing.issueDate')} value={date} onChange={e => setDate(e.target.value)} required error={show && errors.date ? t('v.date') : undefined} />
          <Input type="date" label={t('billing.dueDate')} value={dueDate} min={date} onChange={e => setDueDate(e.target.value)} hint={!dueDate ? t('optional') : undefined} />
        </div>

        <section>
          <div className="bl-section-head">
            <div className="bl-section-title"><ClipboardList />{t('billing.items')}{lines.length > 0 && <span className="bl-count num">{lines.length}</span>}</div>
            <div className="bl-add-btns">
              <Button size="sm" variant="soft" className={panel === 'treatments' ? 'is-on' : ''} icon={<Stethoscope />} onClick={() => setPanel(p => (p === 'treatments' ? null : 'treatments'))}>
                {t('billing.addFromTreatments')}{patientId && available.length > 0 && <span className="bl-count num">{available.length}</span>}
              </Button>
              <Button size="sm" variant="soft" className={panel === 'procedures' ? 'is-on' : ''} icon={<ListPlus />} onClick={() => setPanel(p => (p === 'procedures' ? null : 'procedures'))}>{t('billing.addFromProcedures')}</Button>
              <Button size="sm" variant="soft" icon={<Plus />} onClick={addFree}>{t('billing.addFreeLine')}</Button>
            </div>
          </div>

          {panel === 'treatments' && <TreatmentsPanel patientId={patientId} items={available} loading={!!patientId && treatments === undefined} onAdd={add => { addLines(add); setPanel(null) }} onClose={() => setPanel(null)} />}
          {panel === 'procedures' && <ProceduresPanel lines={lines} onAdd={p => addLines([{ key: lineKey(), procedureId: p.id, description: pick(p.name, p.nameEn), tooth: null, qty: 1, unitPrice: p.price, discount: null }])} onClose={() => setPanel(null)} />}

          <div className={`bl-lines${show && errors.items ? ' invalid' : ''}`}>
            {lines.length > 0 && (
              <div className="bl-lines-head" aria-hidden>
                <span>#</span><span>{t('billing.lineDescription')}</span><span>{t('tooth')}</span><span>{t('qty')}</span><span>{t('unitPrice')}</span><span>{t('discount')}</span><span className="bl-end">{t('billing.lineTotal')}</span><span />
              </div>
            )}
            {lines.length === 0 ? (
              show && errors.items
                ? <div className="bl-lines-empty is-error" role="alert"><AlertCircle />{t('billing.v.items')}<span className="text-xs muted">{t('billing.noItems')}</span></div>
                : <div className="bl-lines-empty"><ClipboardList />{t('billing.noItems')}</div>
            ) : lines.map((l, i) => (
              <LineRow key={l.key} index={i} line={l} errors={show ? errors.lines[l.key] : undefined} size={isMobile ? 'md' : 'sm'} currency={clinic.currencySymbol}
                onChange={patch => update(l.key, patch)} onRemove={() => remove(l.key)} />
            ))}
          </div>
        </section>

        <div className="bl-form-bottom">
          <Textarea label={t('notes')} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('billing.notesPlaceholder')} rows={4} />
          <div className="bl-totals-panel" aria-label={t('billing.totals')}>
            <div className="bl-tp-row"><span>{t('subtotal')}</span><Money value={totals.subtotal} /></div>
            <div className="bl-tp-row">
              <span>{t('billing.invoiceDiscount')}</span>
              <div className="bl-tp-input"><NumberInput size="sm" value={discount} onChange={setDiscount} min={0} placeholder="0" invalid={show && !!errors.discount} aria-label={t('billing.invoiceDiscount')} /></div>
            </div>
            {show && errors.discount && <div className="bl-tp-err">{t('billing.v.discount')}</div>}
            <div className="bl-tp-row">
              <span>{t('billing.taxPercent')}</span>
              <div className="bl-tp-input"><NumberInput size="sm" value={taxPercent} onChange={setTaxPercent} min={0} max={100} placeholder="0" addon="%" invalid={show && !!errors.tax} aria-label={t('billing.taxPercent')} /></div>
            </div>
            {totals.tax > 0 && <div className="bl-tp-row"><span>{t('tax')}</span><Money value={totals.tax} /></div>}
            <div className="bl-tp-row bl-tp-total"><span>{t('total')}</span><Money value={totals.total} /></div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function LineRow({ index, line, errors, size, currency, onChange, onRemove }: { index: number; line: DraftLine; errors?: LineErrors; size: 'sm' | 'md'; currency: string; onChange: (p: Partial<DraftLine>) => void; onRemove: () => void }) {
  const { t } = useI18n()
  const total = lineTotal(line.qty || 0, line.unitPrice || 0, line.discount || 0)
  const msgs = [
    errors?.description && t('billing.v.description'),
    errors?.qty && `${t('qty')}: ${t('v.positive')}`,
    errors?.unitPrice && `${t('unitPrice')}: ${t('v.number')}`,
    errors?.discount === 'tooBig' ? t('billing.v.lineDiscount') : errors?.discount ? `${t('discount')}: ${t('v.number')}` : null,
    errors?.tooth && t('billing.v.tooth'),
  ].filter(Boolean)
  return (
    <div className="bl-line" data-line={line.key}>
      <span className="bl-line-no num">{index + 1}</span>
      <div className="bl-line-desc bl-a-desc">
        <Input size={size} label={t('billing.lineDescription')} value={line.description} onChange={e => onChange({ description: e.target.value })} invalid={!!errors?.description} placeholder={t('billing.lineDescription')} />
        {line.treatmentItemId && <span className="bl-line-tag"><Link2 />{t('billing.fromTreatment')}</span>}
      </div>
      <div className="bl-a-tooth"><NumberInput size={size} label={t('tooth')} decimals={0} value={line.tooth} onChange={n => onChange({ tooth: n })} invalid={!!errors?.tooth} placeholder="—" /></div>
      <div className="bl-a-qty"><NumberInput size={size} label={t('qty')} decimals={0} min={1} value={line.qty} onChange={n => onChange({ qty: n })} invalid={!!errors?.qty} /></div>
      <div className="bl-a-price"><NumberInput size={size} label={`${t('unitPrice')} (${currency})`} value={line.unitPrice} min={0} onChange={n => onChange({ unitPrice: n })} invalid={!!errors?.unitPrice} placeholder="0" /></div>
      <div className="bl-a-disc"><NumberInput size={size} label={t('discount')} value={line.discount} min={0} onChange={n => onChange({ discount: n })} invalid={!!errors?.discount} placeholder="0" /></div>
      <div className="bl-line-total"><Money value={total} strong /></div>
      <div className="bl-a-rm"><IconButton label={t('billing.removeLine')} size={size === 'sm' ? 'sm' : 'md'} variant="ghost" className="bl-menu-btn" onClick={onRemove}><Trash2 /></IconButton></div>
      {msgs.length > 0 && <div className="bl-line-err" role="alert">{msgs.join(' · ')}</div>}
    </div>
  )
}

function TreatmentsPanel({ patientId, items, loading, onAdd, onClose }: { patientId: string; items: TreatmentItem[]; loading: boolean; onAdd: (l: DraftLine[]) => void; onClose: () => void }) {
  const { t, lang } = useI18n()
  // everything is ticked by default, including treatments that load after the panel opens
  const [sel, setSel] = useState<Set<string>>(() => new Set())
  const seen = useRef(new Set<string>())
  useEffect(() => {
    const fresh = items.filter(i => !seen.current.has(i.id))
    if (!fresh.length) return
    fresh.forEach(i => seen.current.add(i.id))
    setSel(s => new Set([...s, ...fresh.map(i => i.id)]))
  }, [items])
  const toggle = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const chosen = items.filter(i => sel.has(i.id))
  const add = () => onAdd(chosen.map(tr => ({ key: lineKey(), treatmentItemId: tr.id, procedureId: tr.procedureId, description: tr.procedureName, tooth: tr.tooth ?? null, qty: 1, unitPrice: tr.price, discount: tr.discount || null })))
  return (
    <div className="bl-panel">
      <div className="bl-panel-head">
        <div className="strong row gap-2"><Stethoscope size={16} />{t('billing.addFromTreatments')}</div>
        <div className="row gap-2">
          {items.length > 1 && <Button size="sm" variant="ghost" onClick={() => setSel(s => (s.size === items.length ? new Set() : new Set(items.map(i => i.id))))}>{sel.size === items.length ? t('clear') : t('selectAll')}</Button>}
          <IconButton label={t('close')} size="sm" variant="ghost" onClick={onClose}><X /></IconButton>
        </div>
      </div>
      {!patientId ? <div className="bl-panel-empty">{t('billing.selectPatientFirst')}</div>
        : loading ? <Loading />
        : items.length === 0 ? <div className="bl-panel-empty">{t('billing.noTreatments')}</div>
        : (
          <>
            <div className="bl-panel-list">
              {items.map(tr => (
                <div key={tr.id} className="bl-panel-item">
                  <Checkbox checked={sel.has(tr.id)} onChange={() => toggle(tr.id)} label={
                    <span className="col" style={{ gap: 0 }}>
                      <span className="bl-proc-name">{tr.procedureName}</span>
                      <span className="bl-proc-meta">
                        {tr.tooth && <Badge size="sm" tone="primary">{t('tooth')} <span className="num">{tr.tooth}</span></Badge>}
                        {tr.completedAt && <span>{t('billing.completedOn')} {fmtDate(tr.completedAt, lang)}</span>}
                      </span>
                    </span>
                  } />
                  <span className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
                    <Money value={tr.price - (tr.discount || 0)} strong />
                    {tr.discount > 0 && <span className="text-xs muted"><s><Money value={tr.price} kind="muted" /></s></span>}
                  </span>
                </div>
              ))}
            </div>
            <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
              <Button size="sm" variant="primary" icon={<Plus />} disabled={!chosen.length} onClick={add}>{t('billing.addSelected', { n: chosen.length })}</Button>
            </div>
          </>
        )}
    </div>
  )
}

function ProceduresPanel({ lines, onAdd, onClose }: { lines: DraftLine[]; onAdd: (p: Procedure) => void; onClose: () => void }) {
  const { t, pick } = useI18n()
  const [q, setQ] = useState('')
  const procedures = useLiveQuery(() => db.procedures.filter(p => p.active).toArray(), [])
  const list = useMemo(() => {
    const order = (c: string) => PROCEDURE_CATEGORIES.indexOf(c as any)
    return (procedures ?? [])
      .filter(p => !q.trim() || matches(`${p.name} ${p.nameEn ?? ''} ${p.code ?? ''}`, q))
      .sort((a, b) => order(a.category) - order(b.category) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
  }, [procedures, q])
  const count = (id: string) => lines.filter(l => l.procedureId === id).length
  return (
    <div className="bl-panel">
      <div className="bl-panel-head">
        <div className="grow" style={{ maxWidth: 420 }}><Input size="sm" iconStart={<Search />} value={q} onChange={e => setQ(e.target.value)} placeholder={t('billing.searchProcedures')} autoFocus clearable onClear={() => setQ('')} /></div>
        <IconButton label={t('close')} size="sm" variant="ghost" onClick={onClose}><X /></IconButton>
      </div>
      <div className="bl-panel-list">
        {procedures === undefined ? <Loading />
          : list.length === 0 ? <div className="bl-panel-empty">{t('billing.noProcedures')}</div>
          : list.map(p => {
            const n = count(p.id)
            return (
              <button key={p.id} type="button" className="bl-panel-item" onClick={() => onAdd(p)}>
                <span className="grow">
                  <span className="bl-proc-name">{pick(p.name, p.nameEn)}</span>
                  <span className="bl-proc-meta">
                    {p.code && <span className="num">{p.code}</span>}
                    <span>{t(`cat.${p.category}`)}</span>
                    {n > 0 && <span className="bl-proc-added"><Check />{n > 1 ? <span className="num">×{n}</span> : t('billing.added')}</span>}
                  </span>
                </span>
                <Money value={p.price} strong />
                <Plus size={18} className="muted" />
              </button>
            )
          })}
      </div>
      <div className="text-xs muted mt-2">{t('billing.procedureHint')}</div>
    </div>
  )
}
