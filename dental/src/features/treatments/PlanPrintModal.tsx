import { useEffect } from 'react'
import { Printer } from 'lucide-react'
import type { Patient, TreatmentItem, TreatmentPlan, User } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { ToothIcon } from '@/app/ToothIcon'
import { Button, Modal } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { formatPhone, round2 } from '@/lib/format'
import { print } from '@/platform'
import { itemTotal, planTotals, surfaceCode } from './lib'
import { nameOf } from './parts'

/** Prints only the sheet of this modal: everything else on the page is hidden for the print. */
function printSheet() {
  const body = document.body
  body.classList.add('tr-printing')
  const done = () => { body.classList.remove('tr-printing'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  print()
}

/** The plan as a printable estimate the patient can take home and sign. */
export default function PlanPrintModal({ open, onClose, plan, items, patient, users }: {
  open: boolean; onClose: () => void; plan: TreatmentPlan; items: TreatmentItem[]; patient?: Patient; users: User[]
}) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  useEffect(() => { if (!open) return; return () => document.body.classList.remove('tr-printing') }, [open])

  const lines = items.filter(i => i.status !== 'cancelled')
  const totals = planTotals(items)
  const taxPercent = Math.max(0, clinic.taxPercent || 0)
  const tax = round2((totals.total * taxPercent) / 100)
  const grand = round2(totals.total + tax)
  const doctor = nameOf(users, plan.doctorId)
  const clinicName = (lang === 'en' ? clinic.nameEn || clinic.name : clinic.name || clinic.nameEn) || t('appName')
  const clinicAlt = lang === 'en' ? (clinic.name !== clinicName ? clinic.name : '') : clinic.nameEn
  const showSurfaces = lines.some(i => i.surfaces?.length)
  const showDiscount = lines.some(i => i.discount > 0)

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={<Printer />} title={t('treatments.print.title')} subtitle={plan.title} className="tr-print-modal"
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('close')}</Button>
        <Button variant="primary" icon={<Printer />} onClick={printSheet}>{t('print')}</Button>
      </>}>
      <article className="tr-sheet print-area">
        <header className="tr-sheet-head">
          <div className="tr-sheet-clinic">
            <div className="tr-sheet-logo">{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon size={30} />}</div>
            <div>
              <div className="tr-sheet-name">{clinicName}</div>
              {clinicAlt && <div className="tr-sheet-alt"><bdi>{clinicAlt}</bdi></div>}
              <div className="tr-sheet-contact">
                {clinic.address && <span>{clinic.address}</span>}
                {(clinic.phone || clinic.phone2) && <span className="ltr">{[clinic.phone, clinic.phone2].filter(Boolean).map(p => formatPhone(p)).join(' · ')}</span>}
                {clinic.email && <span className="ltr">{clinic.email}</span>}
              </div>
            </div>
          </div>
          <div className="tr-sheet-doc">
            <div className="tr-sheet-doc-title">{t('treatments.print.docTitle')}</div>
            <div className="tr-sheet-doc-date">{fmtDate(todayISO(), lang, 'long')}</div>
          </div>
        </header>

        <section className="tr-sheet-facts">
          <div><span>{t('patient')}</span><strong>{patient?.name ?? '—'}</strong></div>
          <div><span>{t('fileNo')}</span><strong>{patient ? <span className="num">#{patient.fileNo}</span> : '—'}</strong></div>
          <div><span>{t('treatments.plan.titleLabel')}</span><strong>{plan.title}</strong></div>
          <div><span>{t('doctor')}</span><strong>{doctor || '—'}</strong></div>
        </section>

        <table className="tr-sheet-table">
          <thead>
            <tr>
              <th className="c">#</th>
              <th>{t('treatments.col.procedure')}</th>
              <th className="c">{t('tooth')}</th>
              {showSurfaces && <th className="c">{t('treatments.col.surfaces')}</th>}
              <th className="e">{t('price')}</th>
              {showDiscount && <th className="e">{t('discount')}</th>}
              <th className="e">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? <tr><td colSpan={7} className="c muted">{t('treatments.plan.noItems')}</td></tr> : lines.map((i, n) => (
              <tr key={i.id}>
                <td className="c num">{n + 1}</td>
                <td>{i.procedureName}{i.notes && <div className="tr-sheet-note">{i.notes}</div>}</td>
                <td className="c num">{i.tooth ?? '—'}</td>
                {showSurfaces && <td className="c ltr">{surfaceCode(i.surfaces) || '—'}</td>}
                <td className="e"><span className="money">{money(i.price)}</span></td>
                {showDiscount && <td className="e">{i.discount > 0 ? <span className="money">{money(-i.discount)}</span> : '—'}</td>}
                <td className="e strong"><span className="money">{money(itemTotal(i))}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tr-sheet-bottom">
          <div className="tr-sheet-notes">
            {plan.notes && <><div className="tr-sheet-label">{t('notes')}</div><p>{plan.notes}</p></>}
            <p className="tr-sheet-disclaimer">{t('treatments.print.disclaimer')}</p>
          </div>
          <dl className="tr-sheet-totals">
            <div><dt>{t('subtotal')}</dt><dd><span className="money">{money(totals.subtotal)}</span></dd></div>
            {totals.discount > 0 && <div><dt>{t('discount')}</dt><dd><span className="money">{money(-totals.discount)}</span></dd></div>}
            {taxPercent > 0 && <div><dt>{t('tax')} <span className="num">({taxPercent}%)</span></dt><dd><span className="money">{money(tax)}</span></dd></div>}
            <div className="grand"><dt>{t('treatments.print.estimate')}</dt><dd><span className="money">{money(grand)}</span></dd></div>
          </dl>
        </div>

        <footer className="tr-sheet-sign">
          <div><span className="tr-sign-line" /><span>{t('treatments.print.patientSign')}</span></div>
          <div><span className="tr-sign-line" /><span>{t('treatments.print.doctorSign')}</span></div>
        </footer>
      </article>
    </Modal>
  )
}
