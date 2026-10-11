import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Copy, FilePlus2, Pill, Printer, Stethoscope } from 'lucide-react'
import { db } from '@/db'
import type { Prescription, User } from '@/db/types'
import { useI18n } from '@/i18n'
import { useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Button, Card, CardHeader, EmptyState, IconButton, Skeleton } from '@/ui'
import { fromISODate } from '@/lib/dates'
import { todayISO } from '@/db/ids'
import { duplicateDefaults, itemsSummary, sortPrescriptions } from './lib'
import PrescriptionFormModal, { type RxFormDefaults } from './PrescriptionFormModal'
import RxSheetModal, { useDayHint } from './RxSheet'
import './prescriptions.css'

const PAGE = 10

/** A tab of the patient profile: the patient's prescriptions, newest first, with print and "duplicate as new". */
export default function PatientPrescriptionsTab({ patientId }: { patientId: string }) {
  const { t, lang } = useI18n()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const userMap = useMemo(() => new Map<string, User>(users.map(u => [u.id, u])), [users])
  const list = useLiveQuery(async () => sortPrescriptions(await db.prescriptions.where('patientId').equals(patientId).toArray()), [patientId])
  const [form, setForm] = useState<{ prescription?: Prescription; defaults?: RxFormDefaults } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const dayHintOf = useDayHint()
  const today = todayISO()
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', { month: 'short' }), [lang])

  const newBtn = !readOnly && <Button variant="primary" size="sm" icon={<FilePlus2 />} onClick={() => setForm({ defaults: { patientId } })}>{t('prescriptions.new')}</Button>

  let content
  if (list === undefined) content = <div className="card-body col gap-3">{[0, 1, 2].map(i => <Skeleton key={i} h={64} r={14} />)}</div>
  else if (list.length === 0) {
    content = <EmptyState icon={<Pill />} title={t('prescriptions.tabEmpty.title')} description={t('prescriptions.tabEmpty.desc')}
      actions={!readOnly && <Button variant="primary" icon={<FilePlus2 />} onClick={() => setForm({ defaults: { patientId } })}>{t('prescriptions.new')}</Button>} />
  } else {
    content = (
      <div className="list rx-plist">
        {list.slice(0, shown).map(rx => {
          const d = fromISODate(rx.date)
          const s = itemsSummary(rx.items, 4)
          return (
            <div key={rx.id} className="list-item clickable rx-pitem" onClick={() => setOpenId(rx.id)}>
              <div className="rx-datebox"><span className="rx-datebox-d num">{d.getDate()}</span><span className="rx-datebox-m">{monthFmt.format(d)}</span><span className="rx-datebox-y num">{d.getFullYear()}</span></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="rx-pitem-head">
                  <span className="li-main truncate">{rx.diagnosis || t('prescriptions.sheet.title')}</span>
                  {dayHintOf(rx.date, today) && <span className="rx-pitem-when">{dayHintOf(rx.date, today)}</span>}
                </div>
                <div className="rx-sum mt-1">
                  {s.names.map((n, i) => <span key={i} className="rx-sum-pill" dir="auto">{n}</span>)}
                  {s.more > 0 && <span className="rx-sum-more num">+{s.more}</span>}
                </div>
                <div className="li-sub row gap-1 mt-1"><Stethoscope size={13} />{userMap.get(rx.doctorId)?.name ?? '—'}<span className="muted">·</span>{t('prescriptions.itemsN', { n: rx.items.length })}</div>
              </div>
              <div className="li-end rx-actions" onClick={e => e.stopPropagation()}>
                <IconButton variant="ghost" size="sm" label={t('prescriptions.openPrint')} onClick={() => setOpenId(rx.id)}><Printer /></IconButton>
                {!readOnly && <IconButton variant="ghost" size="sm" label={t('prescriptions.duplicateAsNew')} onClick={() => setForm({ defaults: duplicateDefaults(rx) })}><Copy /></IconButton>}
              </div>
            </div>
          )
        })}
        {list.length > shown && <div className="rx-more"><Button size="sm" variant="ghost" onClick={() => setShown(n => n + PAGE * 2)}>{t('prescriptions.showMore', { n: list.length - shown })}</Button></div>}
      </div>
    )
  }

  return (
    <Card className="rx-ptab">
      <CardHeader title={t('prescriptions.title')} icon={<Pill />} subtitle={list?.length ? t('prescriptions.countN', { n: list.length }) : undefined} actions={list && list.length > 0 ? newBtn : undefined} />
      {content}
      {form && <PrescriptionFormModal open lockPatient prescription={form.prescription} defaults={form.defaults} onClose={() => setForm(null)} />}
      {openId && <RxSheetModal id={openId} onClose={() => setOpenId(null)} onEdit={rx => { setOpenId(null); setForm({ prescription: rx }) }} onDuplicate={rx => { setOpenId(null); setForm({ defaults: duplicateDefaults(rx) }) }} />}
    </Card>
  )
}
