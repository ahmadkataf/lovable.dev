import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search, UserPlus, UserRound, X } from 'lucide-react'
import { db, logActivity, nextFileNumber } from '@/db'
import type { Gender, Patient } from '@/db/types'
import { newId, nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useDebounced } from '@/app/hooks'
import { Alert, Button, Field, Input, Segmented, Skeleton, useEscapeLayer, useToast } from '@/ui'
import { formatPhone } from '@/lib/format'
import { cleanPhone, isValidPhone } from '@/features/patients/lib'
import { indexSearch, phoneOwner, usePatientIndex, usePatientPhotos } from '@/features/patients/directory'
import { quickPatientFromQuery, searchPatients } from './lib'
import { PatientAvatar } from './shared'

/** A row of the dropdown: from the shared index (slim) or from an index query (a full record). */
type Hit = Pick<Patient, 'id' | 'name' | 'fileNo' | 'phone' | 'phone2'> & { photo?: string }

interface Props {
  value?: Patient
  onChange: (p?: Patient) => void
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Patient field of the appointment form: a search box with a dropdown (name, file number or phone, Arabic-aware, max 8),
 * a "new patient" quick form (name, phone, gender), and a chip once a patient is chosen.
 */
export default function PatientPicker({ value, onChange, error, disabled, autoFocus }: Props) {
  const { t } = useI18n()
  const toast = useToast()
  const session = useSession()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [quick, setQuick] = useState<{ name: string; phone: string; gender: Gender } | null>(null)
  const [qErr, setQErr] = useState<{ name?: string; phone?: string }>({})
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)   // a repeated Enter / double click must not create the patient twice
  // a patient that was created keeps the lock until the quick form closes (a second Enter handled before the
  // re-render must not create a twin); opening the quick form again releases it
  const quickOpen = quick !== null
  useEffect(() => { if (quickOpen) busyRef.current = false }, [quickOpen])

  // Thousands of files: the dropdown never reads the whole table on open. Index queries answer at once (newest files,
  // file number, start of the phone or of the name); the shared patient index, read once in the background, then adds
  // the Arabic-aware matches anywhere in the name and in second phones.
  const index = usePatientIndex(open)
  const active = useMemo(() => (index ? index.list.filter(p => !p.archived).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)) : undefined), [index])
  const [fast, setFast] = useState<{ q: string; list: Hit[] }>()
  useEffect(() => {
    if (!open || active) return
    let alive = true
    void indexSearch(q, 8).then(list => { if (alive) setFast({ q, list }) }).catch(() => undefined)
    return () => { alive = false }
  }, [open, q, active])
  const found: Hit[] = useMemo(() => (active ? searchPatients(active, q, 8) : fast?.list ?? []), [active, fast, q])
  // photos only for the few rows on screen (the shared index carries none)
  const photos = usePatientPhotos(open ? found.map(p => p.id) : [])
  const results = useMemo(() => found.map(p => ({ ...p, photo: photos.get(p.id) ?? (p as { photo?: string }).photo })), [found, photos])
  const ready = !!active || fast?.q === q
  useEffect(() => setHi(0), [q])

  // the Android Back key (and Escape from outside the field) closes the list or the quick-add card first, not the dialog
  useEscapeLayer(open && !value ? () => setOpen(false) : undefined)
  useEscapeLayer(quick ? () => setQuick(null) : undefined)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent | TouchEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [open])
  useEffect(() => { if (quick) window.setTimeout(() => nameRef.current?.focus(), 30) }, [quick !== null]) // eslint-disable-line react-hooks/exhaustive-deps
  // the same soft warning as the full form when the number already belongs to another file (families share phones)
  const quickPhone = useDebounced(quick?.phone ?? '', 250)
  const [dup, setDup] = useState<{ phone: string; name: string; fileNo: number } | null>(null)
  useEffect(() => {
    let alive = true
    if (!quickPhone.trim()) { setDup(null); return }
    void phoneOwner(quickPhone).then(p => { if (alive) setDup(p ? { phone: quickPhone, name: p.name, fileNo: p.fileNo } : null) }).catch(() => undefined)
    return () => { alive = false }
  }, [quickPhone])

  // the shared index holds a slim copy: hand the form the full, current record
  const pick = async (p: Hit) => { const full = await db.patients.get(p.id); if (full) { onChange(full); setQ(''); setOpen(false) } }
  const startQuick = () => { const f = quickPatientFromQuery(q); setQuick({ ...f, gender: 'male' }); setQErr({}); setOpen(false) }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length + 1 // + the "new patient" row
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => (h + 1) % count) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setHi(h => (h - 1 + count) % count) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      if (hi < results.length) void pick(results[hi]); else startQuick()
    } else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
  }

  const createQuick = async () => {
    if (!quick || busyRef.current) return
    const name = quick.name.trim().replace(/\s+/g, ' ')
    // the same rules as the full patient form: the phone is optional, and a real number when given
    const phone = quick.phone.trim() ? cleanPhone(quick.phone) : ''
    const errs: { name?: string; phone?: string } = {}
    if (name.length < 2) errs.name = t('v.required')
    if (quick.phone.trim() && !isValidPhone(quick.phone)) errs.phone = t('v.phone')
    setQErr(errs)
    if (errs.name || errs.phone) return
    busyRef.current = true
    setBusy(true)
    try {
      const fileNo = await nextFileNumber()
      const now = nowISO()
      const p: Patient = {
        id: newId(), fileNo, name, gender: quick.gender, phone: phone || undefined,
        allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now,
      }
      await db.patients.add(p)
      void logActivity({ type: 'patient', action: 'create', entityId: p.id, patientId: p.id, message: p.name, by: session.user?.id })
      toast.success(t('appointments.form.patientCreated'), `${p.name} · #${p.fileNo}`)
      setQuick(null); setQ('')
      onChange(p)
    } catch {
      busyRef.current = false
      toast.error(t('error'), t('tryAgain'))
    } finally { setBusy(false) }
  }
  const quickKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void createQuick() }
    if (e.key === 'Escape') { e.stopPropagation(); setQuick(null) }
  }

  if (value) {
    return (
      <Field label={t('patient')} required>
        <div className="apt-picked">
          <PatientAvatar patient={value} />
          <div className="grow">
            <div className="apt-picked-name truncate" dir="auto" title={value.name}>{value.name}</div>
            <div className="apt-picked-sub"><span className="num">#{value.fileNo}</span>{value.phone && <span className="ltr num">{formatPhone(value.phone)}</span>}</div>
          </div>
          {!disabled && (
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => { onChange(undefined); window.setTimeout(() => inputRef.current?.focus(), 30) }}>{t('appointments.form.change')}</Button>
          )}
        </div>
      </Field>
    )
  }

  if (quick) {
    return (
      <div className="apt-quick" onKeyDown={quickKey}>
        <div className="apt-quick-head">
          <span className="apt-quick-icon"><UserPlus /></span>
          <div className="grow">
            <div className="apt-quick-title">{t('appointments.form.quickTitle')}</div>
            <div className="apt-quick-sub">{t('appointments.form.quickHint')}</div>
          </div>
          <Button size="sm" variant="ghost" icon={<X />} onClick={() => setQuick(null)} aria-label={t('cancel')} />
        </div>
        <div className="form-grid">
          <Input ref={nameRef} label={t('fullName')} required value={quick.name} error={qErr.name} autoComplete="off"
            onChange={e => { setQuick({ ...quick, name: e.target.value }); if (qErr.name) setQErr({ ...qErr, name: undefined }) }} />
          <Input label={t('phone')} type="tel" inputMode="tel" dir="ltr" className="num" value={quick.phone} error={qErr.phone} placeholder="09xx xxx xxx" autoComplete="off"
            onChange={e => { setQuick({ ...quick, phone: e.target.value.replace(/[^\d+\s()-]/g, '') }); if (qErr.phone) setQErr({ ...qErr, phone: undefined }) }} />
          {dup && dup.phone === quick.phone && <Alert tone="warning" className="span-2">{t('patients.duplicatePhone', { name: dup.name, fileNo: dup.fileNo })}</Alert>}
          <Field label={t('gender')} className="span-2">
            <Segmented<Gender> value={quick.gender} onChange={g => setQuick({ ...quick, gender: g })}
              options={[{ value: 'male', label: t('male') }, { value: 'female', label: t('female') }]} />
          </Field>
        </div>
        <div className="apt-quick-foot">
          <Button variant="ghost" onClick={() => setQuick(null)}>{t('cancel')}</Button>
          <Button variant="primary" icon={<UserPlus />} loading={busy} onClick={() => void createQuick()}>{t('appointments.form.createPatient')}</Button>
        </div>
      </div>
    )
  }

  return (
    <Field label={t('patient')} required error={error}>
      <div className="apt-picker" ref={wrapRef}>
        <Input ref={inputRef} iconStart={<Search />} value={q} placeholder={t('appointments.form.searchPatient')} autoComplete="off" invalid={!!error} disabled={disabled}
          autoFocus={autoFocus} role="combobox" aria-expanded={open} aria-autocomplete="list"
          onChange={e => { setQ(e.target.value); setOpen(true) }} onClick={() => setOpen(true)} onKeyDown={onKey}
          clearable onClear={() => { setQ(''); inputRef.current?.focus() }} />
        {open && !disabled && (
          <div className="apt-drop" role="listbox">
            {!ready ? (
              <div className="apt-drop-pad col gap-2"><Skeleton h={36} /><Skeleton h={36} /></div>
            ) : (
              <>
                {results.length > 0 && <div className="apt-drop-label">{q.trim() ? t('appointments.form.results') : t('appointments.form.recent')}</div>}
                {results.map((p, i) => (
                  <button key={p.id} type="button" role="option" aria-selected={i === hi} className={`apt-drop-item${i === hi ? ' hi' : ''}`}
                    onMouseEnter={() => setHi(i)} onMouseDown={e => e.preventDefault()} onClick={() => void pick(p)}>
                    <PatientAvatar patient={p} size="sm" />
                    <span className="grow">
                      <span className="apt-drop-name truncate" dir="auto">{p.name}</span>
                      <span className="apt-drop-sub"><span className="num">#{p.fileNo}</span>{p.phone && <span className="ltr num">{formatPhone(p.phone)}</span>}</span>
                    </span>
                  </button>
                ))}
                {results.length === 0 && (
                  <div className="apt-drop-empty"><UserRound />{!q.trim() ? t('appointments.form.noPatientsYet') : t('appointments.form.noPatientFound')}</div>
                )}
                <button type="button" className={`apt-drop-item apt-drop-new${hi === results.length ? ' hi' : ''}`} onMouseEnter={() => setHi(results.length)}
                  onMouseDown={e => e.preventDefault()} onClick={startQuick}>
                  <span className="apt-drop-plus"><UserPlus /></span>
                  <span className="grow apt-drop-name truncate">{q.trim() ? t('appointments.form.addAsNew', { q: q.trim() }) : t('appointments.form.newPatient')}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Field>
  )
}
