// The prescription as the patient and the pharmacist receive it: a paper-white sheet that prints cleanly in Arabic
// and English, inside a modal with print, WhatsApp, edit and duplicate actions.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Copy, MessageCircle, Pencil, Pill, Printer } from 'lucide-react'
import { db } from '@/db'
import type { Clinic, Drug, Patient, Prescription, User } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Button, Loading, Modal } from '@/ui'
import { ageFrom, fmtDate } from '@/lib/dates'
import { formatPhone, whatsappLink } from '@/lib/format'
import { openExternal } from '@/platform'
import { buildRxText } from './lib'
import { RxMark, SheetClinic, printModalSheet, usePrintCleanup } from './parts'

export function RxSheet({ rx, patient, doctor, clinic, drugs }: { rx: Prescription; patient?: Patient; doctor?: User; clinic: Clinic; drugs?: Map<string, Drug> }) {
  const { t, lang } = useI18n()
  const age = ageFrom(patient?.birthDate)
  const footer = clinic.prescriptionFooter?.trim() || t('prescriptions.sheet.defaultFooter')
  return (
    <article className="print-area rx-sheet" aria-label={t('prescriptions.sheet.title')}>
      <header className="rx-sheet-head">
        <SheetClinic clinic={clinic} />
        {doctor && (
          <div className="rx-doctor">
            <div className="rx-doctor-name">{doctor.name}</div>
            {doctor.specialty && <div className="rx-doctor-spec">{doctor.specialty}</div>}
            {doctor.phone && <div className="rx-doctor-meta ltr">{formatPhone(doctor.phone)}</div>}
          </div>
        )}
      </header>

      <section className="rx-patient">
        <div className="rx-pf rx-pf-name"><span className="rx-k">{t('prescriptions.sheet.patient')}</span><span className="rx-v">{patient?.name ?? '—'}</span></div>
        {age !== null && <div className="rx-pf"><span className="rx-k">{t('age')}</span><span className="rx-v"><span className="num">{age}</span> {t('years')}</span></div>}
        {patient && <div className="rx-pf"><span className="rx-k">{t('gender')}</span><span className="rx-v">{t(patient.gender)}</span></div>}
        {patient && <div className="rx-pf"><span className="rx-k">{t('fileNo')}</span><span className="rx-v num">{patient.fileNo}</span></div>}
        <div className="rx-pf"><span className="rx-k">{t('date')}</span><span className="rx-v">{fmtDate(rx.date, lang)}</span></div>
      </section>

      <div className="rx-main">
        <div className="rx-lead">
          <RxMark />
          {rx.diagnosis && <div className="rx-diagnosis"><span className="rx-k">{t('prescriptions.sheet.diagnosis')}</span><span className="rx-v">{rx.diagnosis}</span></div>}
        </div>

        <ol className="rx-items">
          {rx.items.map((i, n) => {
            const d = i.drugId ? drugs?.get(i.drugId) : undefined
            const alt = d ? [d.nameEn, d.name].find(x => x && x !== i.name && !i.name.includes(x) && (d.name === i.name || d.nameEn === i.name)) : undefined
            const reg = [
              i.dose && { k: t('prescriptions.item.dose'), v: i.dose },
              i.frequency && { k: t('prescriptions.item.frequency'), v: i.frequency },
              i.duration && { k: t('prescriptions.item.duration'), v: i.duration },
            ].filter(Boolean) as { k: string; v: string }[]
            return (
              <li key={i.id} className="rx-item">
                <span className="rx-item-no num">{n + 1}</span>
                <div className="rx-item-body">
                  <div className="rx-item-title">
                    <span className="rx-item-name" dir="auto">{i.name}</span>
                    {i.strength && <span className="rx-item-strength" dir="auto">{i.strength}</span>}
                    {alt && <span className="rx-item-alt" dir="auto">{alt}</span>}
                  </div>
                  {(reg.length > 0 || i.instructions) && (
                    <div className="rx-item-reg">
                      {reg.map(r => <span key={r.k} className="rx-reg"><span className="rx-reg-k">{r.k}</span><span className="rx-reg-v" dir="auto">{r.v}</span></span>)}
                      {i.instructions && <span className="rx-item-instr" dir="auto">{i.instructions}</span>}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {rx.notes && (
          <div className="rx-notes"><span className="rx-k">{t('notes')}</span><p dir="auto">{rx.notes}</p></div>
        )}
      </div>

      <footer className="rx-sheet-foot">
        <div className="rx-foot-text">{footer}</div>
        <div className="rx-sign">
          <div className="rx-sign-line" />
          <div className="rx-sign-label">{t('prescriptions.sheet.signature')}</div>
          {doctor && <div className="rx-sign-name">{doctor.name}</div>}
        </div>
      </footer>
    </article>
  )
}

/** Plain text of a prescription for WhatsApp, in the UI language. */
export function useRxText() {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  return (rx: Prescription, patient?: Patient, doctor?: User) => buildRxText({
    clinicName: (lang === 'en' ? clinic.nameEn || clinic.name : clinic.name || clinic.nameEn) || undefined,
    clinicPhone: clinic.phone ? formatPhone(clinic.phone) : undefined,
    doctorName: doctor?.name, patientName: patient?.name, dateLabel: fmtDate(rx.date, lang, 'long'),
    diagnosis: rx.diagnosis, notes: rx.notes, footer: clinic.prescriptionFooter, items: rx.items,
    labels: { title: t('prescriptions.sheet.title'), patient: t('patient'), doctor: t('doctor'), diagnosis: t('prescriptions.sheet.diagnosis'), notes: t('notes') },
  })
}

/** The sheet of one prescription in a modal: print, WhatsApp, edit, duplicate. */
export default function RxSheetModal({ id, onClose, onEdit, onDuplicate }: { id: string; onClose: () => void; onEdit?: (rx: Prescription) => void; onDuplicate?: (rx: Prescription) => void }) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  const { readOnly } = useLicense()
  const rxText = useRxText()
  usePrintCleanup(true)
  const data = useLiveQuery(async () => {
    const rx = await db.prescriptions.get(id)
    if (!rx) return { rx: null }
    const [patient, doctor] = await Promise.all([db.patients.get(rx.patientId), db.users.get(rx.doctorId)])
    const ids = rx.items.map(i => i.drugId).filter((x): x is string => !!x)
    const drugs = ids.length ? await db.drugs.bulkGet(ids) : []
    return { rx, patient, doctor, drugs: drugs.filter((d): d is Drug => !!d) }
  }, [id])
  const drugMap = useMemo(() => new Map((data?.drugs ?? []).map(d => [d.id, d])), [data?.drugs])
  const rx = data?.rx
  const phone = data?.patient?.phone

  const share = () => { if (rx && phone) openExternal(whatsappLink(phone, rxText(rx, data?.patient, data?.doctor))) }
  const footer = rx ? <>
    <Button variant="ghost" className="start" icon={<MessageCircle />} onClick={share} disabled={!phone} title={phone ? undefined : t('prescriptions.sheet.noPhone')}>{t('whatsapp')}</Button>
    {onDuplicate && !readOnly && <Button variant="ghost" icon={<Copy />} onClick={() => onDuplicate(rx)} className="hide-mobile">{t('duplicate')}</Button>}
    {onEdit && !readOnly && <Button variant="secondary" icon={<Pencil />} onClick={() => onEdit(rx)}>{t('edit')}</Button>}
    <Button variant="primary" icon={<Printer />} onClick={printModalSheet}>{t('print')}</Button>
  </> : undefined

  return (
    <Modal open onClose={onClose} size="lg" className="rx-sheet-modal" icon={<Pill />} title={t('prescriptions.sheet.title')}
      subtitle={rx ? <span className="row gap-1"><CalendarDays size={14} />{fmtDate(rx.date, lang, 'long')}{data?.patient ? ` · ${data.patient.name}` : ''}</span> : undefined} footer={footer}>
      {data === undefined ? <Loading /> : !rx ? <div className="muted text-center" style={{ padding: 32 }}>{t('prescriptions.notFound')}</div>
        : <RxSheet rx={rx} patient={data.patient} doctor={data.doctor} clinic={clinic} drugs={drugMap} />}
    </Modal>
  )
}
