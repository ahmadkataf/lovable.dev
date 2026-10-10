// New / edit / duplicate prescription. Used by the prescriptions page and the patient's prescriptions tab.
// After saving, the printable sheet opens in place of the form.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, BookOpen, ClipboardList, Pill, PlusCircle, Search, Stethoscope, Trash2 } from 'lucide-react'
import { db } from '@/db'
import type { Drug, Patient, Prescription, PrescriptionItem } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDoctors } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Alert, Button, Field, IconButton, Input, Modal, Select, Textarea, useToast } from '@/ui'
import {
  type ItemDraft, draftsToItems, durationPresets, emptyItem, FREQUENCY_PRESETS, hasErrors, INSTRUCTION_PRESETS, isBlankItem, itemFromDrug, itemToDraft, searchDrugs,
  validatePrescription, type RxErrors,
} from './lib'
import { savePrescription } from './actions'
import { ComboInput, PatientSelect, Popover } from './parts'
import RxSheetModal from './RxSheet'

export interface RxFormDefaults { patientId?: string; doctorId?: string; diagnosis?: string; notes?: string; items?: PrescriptionItem[] }

interface Props {
  open: boolean
  onClose: () => void
  /** Edit this prescription. */
  prescription?: Prescription
  /** New prescription pre-filled (patient from a profile, or a duplicate's content). */
  defaults?: RxFormDefaults
  /** The patient cannot be changed (opened from the patient's profile). */
  lockPatient?: boolean
  onSaved?: (id: string) => void
  /** Show the printable sheet after saving (default true). */
  showSheet?: boolean
}

export default function PrescriptionFormModal({ open, onClose, prescription, defaults, lockPatient, onSaved, showSheet = true }: Props) {
  const [savedId, setSavedId] = useState<string | null>(null)
  if (!open) return null
  if (savedId) return <RxSheetModal id={savedId} onClose={onClose} />
  return <RxForm onClose={onClose} prescription={prescription} defaults={defaults} lockPatient={lockPatient}
    onSaved={id => { onSaved?.(id); if (showSheet) setSavedId(id); else onClose() }} />
}

function RxForm({ onClose, prescription, defaults, lockPatient, onSaved }: Omit<Props, 'open' | 'showSheet' | 'onSaved'> & { onSaved: (id: string) => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const session = useSession()
  const doctors = useDoctors()
  const editing = !!prescription
  const duplicating = !editing && !!defaults?.items?.length

  const [patient, setPatient] = useState<Patient | undefined>()
  const [doctorId, setDoctorId] = useState(prescription?.doctorId ?? defaults?.doctorId ?? '')
  const [date, setDate] = useState(prescription?.date ?? todayISO())
  const [diagnosis, setDiagnosis] = useState(prescription?.diagnosis ?? defaults?.diagnosis ?? '')
  const [notes, setNotes] = useState(prescription?.notes ?? defaults?.notes ?? '')
  const [items, setItems] = useState<ItemDraft[]>(() => (prescription?.items ?? defaults?.items ?? []).map(itemToDraft))
  const [errors, setErrors] = useState<RxErrors | null>(null)
  const [busy, setBusy] = useState(false)
  const focusKey = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // load the patient of an existing / pre-filled prescription
  const initialPatientId = prescription?.patientId ?? defaults?.patientId
  useEffect(() => {
    if (!initialPatientId) return
    let alive = true
    void db.patients.get(initialPatientId).then(p => { if (alive && p) setPatient(p) })
    return () => { alive = false }
  }, [initialPatientId])

  // default doctor: the signed-in doctor, else the patient's usual doctor, else the first doctor
  useEffect(() => {
    if (doctorId || !doctors.length) return
    const me = session.user
    const pick = (me && doctors.some(d => d.id === me.id) ? me.id : undefined) ?? (patient?.doctorId && doctors.some(d => d.id === patient.doctorId) ? patient.doctorId : undefined) ?? doctors[0].id
    setDoctorId(pick)
  }, [doctors, doctorId, session.user, patient?.doctorId])

  useEffect(() => {
    if (!focusKey.current) return
    const el = listRef.current?.querySelector<HTMLInputElement>(`[data-row="${focusKey.current}"] input[data-f="dose"]`)
    focusKey.current = null
    el?.focus()
  }, [items])

  const update = (key: string, patch: Partial<ItemDraft>) => setItems(list => list.map(i => (i.key === key ? { ...i, ...patch } : i)))
  const remove = (key: string) => setItems(list => list.filter(i => i.key !== key))
  const addDrug = (d: Drug) => setItems(list => [...list.filter(i => !isBlankItem(i)), itemFromDrug(d, lang)])
  const addFree = (name: string) => { const row = emptyItem(name); focusKey.current = row.key; setItems(list => [...list.filter(i => !isBlankItem(i)), row]) }

  const live = errors ? validatePrescription({ patientId: patient?.id, doctorId, date, items }) : null
  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs = validatePrescription({ patientId: patient?.id, doctorId, date, items })
    setErrors(errs)
    if (hasErrors(errs) || !patient) {
      if (errs.items) toast.error(t('prescriptions.form.needItems'))
      return
    }
    setBusy(true)
    try {
      const rows = draftsToItems(items)
      const id = await savePrescription({ patientId: patient.id, doctorId, date, diagnosis, notes, items: rows }, {
        id: prescription?.id, by: session.user?.id,
        message: t(editing ? 'prescriptions.act.updated' : 'prescriptions.act.created', { patient: patient.name, n: rows.length }),
      })
      toast.success(t(editing ? 'prescriptions.toast.updated' : 'prescriptions.toast.created'), patient.name)
      onSaved(id)
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { setBusy(false) }
  }

  const title = editing ? t('prescriptions.form.editTitle') : duplicating ? t('prescriptions.form.duplicateTitle') : t('prescriptions.form.newTitle')
  const allergies = patient?.allergies?.filter(Boolean) ?? []
  const filled = items.filter(i => !isBlankItem(i)).length

  return (
    <Modal open onClose={onClose} size="xl" icon={<Pill />} title={title} subtitle={t('prescriptions.form.subtitle')} className="rx-form-modal" closeOnOverlay={false}
      footer={<>
        <span className="start muted text-sm hide-mobile">{t('prescriptions.form.itemsCount', { n: filled })}</span>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" loading={busy} onClick={() => void submit()} icon={<ClipboardList />}>{editing ? t('saveChanges') : t('prescriptions.form.saveAndPrint')}</Button>
      </>}>
      <form onSubmit={submit} noValidate className="rx-form">
        <div className="form-grid rx-form-top">
          <div className="span-2">
            <PatientSelect value={patient} onChange={setPatient} locked={lockPatient && !!patient} error={live?.patient ? t('v.required') : undefined} autoFocus={!initialPatientId} />
          </div>
          <Select label={t('doctor')} required value={doctorId} onChange={e => setDoctorId(e.target.value)} error={live?.doctor ? t('v.required') : undefined}
            options={doctors.map(d => ({ value: d.id, label: d.name }))} placeholder={doctors.length ? undefined : t('prescriptions.form.noDoctors')} />
          <Input label={t('date')} required type="date" value={date} onChange={e => setDate(e.target.value)} error={live?.date ? t('v.date') : undefined} />
          <div className="span-2">
            <Input label={t('prescriptions.form.diagnosis')} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder={t('prescriptions.form.diagnosisPh')}
              iconStart={<Stethoscope />} maxLength={200} />
          </div>
        </div>

        {allergies.length > 0 && (
          <Alert tone="danger" className="rx-allergy" icon={<AlertTriangle />} title={t('prescriptions.form.allergyTitle')}>
            {allergies.join(lang === 'ar' ? '، ' : ', ')}
          </Alert>
        )}

        <section className="rx-items-ed">
          <div className="rx-items-head">
            <div className="form-section-title"><Pill />{t('prescriptions.form.items')}{filled > 0 && <span className="rx-count num">{filled}</span>}</div>
          </div>
          <DrugSearch onPick={addDrug} onFree={addFree} invalid={!!live?.items} />
          {live?.items && <div className="field-error mt-1">{t('prescriptions.form.needItems')}</div>}

          <div className="rx-rows" ref={listRef}>
            {items.length === 0 ? (
              <div className="rx-rows-empty"><BookOpen />{t('prescriptions.form.noItems')}</div>
            ) : items.map((it, n) => (
              <ItemRow key={it.key} n={n + 1} item={it} onChange={p => update(it.key, p)} onRemove={() => remove(it.key)} nameError={live?.names.includes(it.key)} />
            ))}
          </div>
          <Button variant="ghost" size="sm" icon={<PlusCircle />} onClick={() => addFree('')} className="rx-add-row">{t('prescriptions.form.addRow')}</Button>
        </section>

        <Textarea label={t('notes')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('prescriptions.form.notesPh')} className="rx-notes-input" />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

/** One medicine of the prescription. */
function ItemRow({ n, item, onChange, onRemove, nameError }: { n: number; item: ItemDraft; onChange: (p: Partial<ItemDraft>) => void; onRemove: () => void; nameError?: boolean }) {
  const { t, lang } = useI18n()
  const freq = FREQUENCY_PRESETS[lang], dur = durationPresets(lang), instr = INSTRUCTION_PRESETS[lang]
  return (
    <div className="rx-row" data-row={item.key}>
      <span className="rx-row-no num">{n}</span>
      <div className="rx-row-grid">
        <Input className="rx-f-name" aria-label={t('prescriptions.item.name')} placeholder={t('prescriptions.item.name')} value={item.name} onChange={e => onChange({ name: e.target.value })}
          error={nameError ? t('v.required') : undefined} dir="auto" iconStart={<Pill />} />
        <Input aria-label={t('prescriptions.item.strength')} placeholder={t('prescriptions.item.strengthPh')} value={item.strength} onChange={e => onChange({ strength: e.target.value })} dir="auto" />
        <Input data-f="dose" aria-label={t('prescriptions.item.dose')} placeholder={t('prescriptions.item.dose')} value={item.dose} onChange={e => onChange({ dose: e.target.value })} dir="auto" />
        <ComboInput aria-label={t('prescriptions.item.frequency')} placeholder={t('prescriptions.item.frequency')} value={item.frequency} onChange={v => onChange({ frequency: v })} options={freq} />
        <ComboInput aria-label={t('prescriptions.item.duration')} placeholder={t('prescriptions.item.duration')} value={item.duration} onChange={v => onChange({ duration: v })} options={dur} />
        <ComboInput className="rx-f-instr" aria-label={t('prescriptions.item.instructions')} placeholder={t('prescriptions.item.instructionsPh')} value={item.instructions} onChange={v => onChange({ instructions: v })} options={instr} />
      </div>
      <IconButton variant="ghost" size="sm" label={t('prescriptions.item.remove')} onClick={onRemove} className="rx-row-x"><Trash2 /></IconButton>
    </div>
  )
}

/** Typeahead over the active drugs; Enter on free text adds an unlisted drug. */
function DrugSearch({ onPick, onFree, invalid }: { onPick: (d: Drug) => void; onFree: (name: string) => void; invalid?: boolean }) {
  const { t, lang, pick: pickName } = useI18n()
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const drugs = useLiveQuery(() => db.drugs.toArray(), [])
  // the most prescribed drugs first when nothing is typed
  const usage = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.prescriptions.orderBy('createdAt').reverse().limit(400).each(p => { for (const i of p.items) if (i.drugId) m.set(i.drugId, (m.get(i.drugId) ?? 0) + 1) })
    return m
  }, [])
  const ranked = useMemo(() => {
    const list = drugs ?? []
    if (!usage?.size) return [...list].sort((a, b) => pickName(a.name, a.nameEn).localeCompare(pickName(b.name, b.nameEn)))
    return [...list].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
  }, [drugs, usage, pickName])
  const results = useMemo(() => searchDrugs(ranked, q, 8), [ranked, q])
  const free = q.trim()
  const count = results.length + (free ? 1 : 0)
  useEffect(() => setHi(0), [q])
  const close = useCallback(() => setOpen(false), [])
  const choose = (i: number) => {
    if (i < results.length) onPick(results[i]); else if (free) onFree(free)
    setQ(''); setHi(0)
    input.current?.focus()
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(count - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (count) choose(Math.min(hi, count - 1)) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
  }
  const catalogueEmpty = drugs !== undefined && drugs.filter(d => d.active).length === 0

  return (
    <Field className="rx-drug-search">
      <div ref={wrap}>
        <Input ref={input} iconStart={<Search />} value={q} placeholder={t('prescriptions.form.searchDrug')} autoComplete="off" invalid={invalid} size="lg"
          role="combobox" aria-expanded={open} aria-label={t('prescriptions.form.searchDrug')}
          onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKey} />
      </div>
      <Popover anchor={wrap} open={open && (count > 0 || catalogueEmpty)} onClose={close} maxHeight={380}>
        <div role="listbox" className="rx-opt-list">
          {results.length > 0 && <div className="rx-pop-label">{free ? t('prescriptions.form.catalogue') : usage?.size ? t('prescriptions.form.mostUsed') : t('prescriptions.form.catalogue')}</div>}
          {results.map((d, i) => {
            const name = pickName(d.name, d.nameEn), alt = lang === 'en' ? d.name : d.nameEn
            return (
              <button key={d.id} type="button" role="option" aria-selected={i === hi} className={`rx-opt rx-opt-drug${i === hi ? ' hi' : ''}`} tabIndex={-1}
                onMouseEnter={() => setHi(i)} onClick={() => choose(i)}>
                <span className="rx-opt-icon"><Pill /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="rx-opt-title"><span className="truncate" dir="auto">{name}</span>{d.strength && <span className="rx-opt-strength" dir="auto">{d.strength}</span>}</span>
                  <span className="rx-opt-sub truncate">{[alt !== name ? alt : '', d.form, d.defaultFrequency].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            )
          })}
          {catalogueEmpty && !free && <div className="rx-pop-empty"><BookOpen />{t('prescriptions.form.catalogueEmpty')}</div>}
          {free && (
            <button type="button" role="option" aria-selected={hi === results.length} className={`rx-opt rx-opt-free${hi === results.length ? ' hi' : ''}`} tabIndex={-1}
              onMouseEnter={() => setHi(results.length)} onClick={() => choose(results.length)}>
              <span className="rx-opt-icon"><PlusCircle /></span>
              <span className="grow truncate">{t('prescriptions.form.addFree', { q: free })}</span>
            </button>
          )}
        </div>
      </Popover>
    </Field>
  )
}
