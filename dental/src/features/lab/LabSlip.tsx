// The slip that travels with the impression to the lab: what to make, for which teeth, in which shade and by when.
// Only the patient's name is printed (no phone, no medical data).
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, FlaskConical, Printer } from 'lucide-react'
import { db } from '@/db'
import type { Clinic, LabOrder, Patient, User } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { Button, Loading, Modal } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { SheetClinic, printModalSheet, usePrintCleanup } from '@/features/prescriptions/parts'
import { ShadeChip, TeethPicker } from './parts'
import { teethLabel } from './lib'

export function LabSlip({ order, patient, doctor, clinic }: { order: LabOrder; patient?: Patient; doctor?: User; clinic: Clinic }) {
  const { t, lang } = useI18n()
  const ref = order.id.slice(-6).toUpperCase()
  const facts: { k: string; v: React.ReactNode; strong?: boolean }[] = [
    { k: t('lab.slip.patient'), v: patient?.name ?? '—', strong: true },
    { k: t('lab.slip.doctor'), v: doctor?.name ?? '—' },
    { k: t('lab.slip.type'), v: t(`labType.${order.type}`), strong: true },
    { k: t('lab.slip.shade'), v: <ShadeChip shade={order.shade} /> },
    { k: t('lab.slip.material'), v: order.material || '—' },
    { k: t('lab.slip.sent'), v: order.sentDate ? fmtDate(order.sentDate, lang, 'long') : '—' },
  ]
  return (
    <article className="print-area lab-slip" aria-label={t('lab.slip.title')}>
      <header className="lab-slip-head">
        <SheetClinic clinic={clinic} compact />
        <div className="lab-slip-doc">
          <div className="lab-slip-title">{t('lab.slip.title')}</div>
          <div className="lab-slip-ref"><span>{t('lab.slip.ref')}</span><span className="num">{ref}</span></div>
        </div>
      </header>

      <section className="lab-slip-to">
        <div>
          <div className="lab-k">{t('lab.slip.to')}</div>
          <div className="lab-slip-lab"><bdi>{order.labName || '—'}</bdi></div>
        </div>
        <div className="lab-slip-due">
          <CalendarClock />
          <div>
            <div className="lab-k">{t('lab.slip.due')}</div>
            <div className="lab-slip-due-v">{order.dueDate ? fmtDate(order.dueDate, lang, 'long') : '—'}</div>
          </div>
        </div>
      </section>

      <dl className="lab-slip-facts">
        {facts.map(f => <div key={f.k} className={f.strong ? 'strong' : undefined}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}
      </dl>

      <section className="lab-slip-teeth">
        <div className="lab-slip-sec-head">
          <span className="lab-k">{t('lab.slip.teeth')}</span>
          <span className="lab-slip-teeth-list num">{order.teeth.length ? teethLabel(order.teeth, lang) : t('lab.slip.noTeeth')}</span>
        </div>
        <TeethPicker value={order.teeth} readOnly />
      </section>

      {order.notes && (
        <section className="lab-slip-notes"><div className="lab-k">{t('lab.slip.notes')}</div><p dir="auto">{order.notes}</p></section>
      )}

      <footer className="lab-slip-sign">
        <div><div className="lab-sign-line" /><span>{t('lab.slip.doctorSign')}</span></div>
        <div><div className="lab-sign-line" /><span>{t('lab.slip.labSign')}</span></div>
      </footer>
    </article>
  )
}

export default function LabSlipModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n()
  const clinic = useClinic()
  usePrintCleanup(true)
  const data = useLiveQuery(async () => {
    const order = await db.labOrders.get(id)
    if (!order) return { order: null }
    const [patient, doctor] = await Promise.all([db.patients.get(order.patientId), order.doctorId ? db.users.get(order.doctorId) : Promise.resolve(undefined)])
    return { order, patient, doctor }
  }, [id])
  return (
    <Modal open onClose={onClose} size="lg" className="lab-slip-modal" icon={<FlaskConical />} title={t('lab.slip.title')}
      subtitle={data?.order ? `${t(`labType.${data.order.type}`)} · ${data.order.labName}` : undefined}
      footer={data?.order ? <>
        <Button variant="ghost" onClick={onClose}>{t('close')}</Button>
        <Button variant="primary" icon={<Printer />} onClick={printModalSheet}>{t('print')}</Button>
      </> : undefined}>
      {data === undefined ? <Loading /> : !data.order ? <div className="muted text-center" style={{ padding: 32 }}>{t('lab.notFound')}</div>
        : <LabSlip order={data.order} patient={data.patient} doctor={data.doctor} clinic={clinic} />}
    </Modal>
  )
}
