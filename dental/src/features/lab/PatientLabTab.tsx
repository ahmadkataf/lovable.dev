import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FlaskConical, Plus } from 'lucide-react'
import { db } from '@/db'
import type { LabOrder } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useIsMobile, useMoney } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Button, Card, CardHeader, EmptyState, Skeleton } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { isOpen, sortOrders } from './lib'
import { DueBadge, LabStatusBadge, ShadeChip, STATUS_ICON, TeethBadges } from './parts'
import { LabRowActions } from './LabRowActions'
import LabOrderFormModal from './LabOrderFormModal'
import LabSlipModal from './LabSlip'
import './lab.css'

/** A tab of the patient profile: the patient's lab orders with add, advance and print. */
export default function PatientLabTab({ patientId }: { patientId: string }) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const mobile = useIsMobile()
  const { readOnly } = useLicense()
  const today = todayISO()
  const data = useLiveQuery(async () => {
    const [orders, patient] = await Promise.all([db.labOrders.where('patientId').equals(patientId).toArray(), db.patients.get(patientId)])
    return { orders, name: patient?.name ?? '' }
  }, [patientId])
  const list = useMemo(() => (data ? sortOrders(data.orders, today) : undefined), [data, today])
  const [form, setForm] = useState<{ order?: LabOrder } | null>(null)
  const [slipId, setSlipId] = useState<string | null>(null)
  const open = list?.filter(isOpen).length ?? 0

  const newBtn = !readOnly && <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setForm({})}>{t('lab.new')}</Button>

  let content
  if (list === undefined) content = <div className="card-body col gap-3">{[0, 1].map(i => <Skeleton key={i} h={72} r={14} />)}</div>
  else if (list.length === 0) {
    content = <EmptyState icon={<FlaskConical />} title={t('lab.tabEmpty.title')} description={t('lab.tabEmpty.desc')}
      actions={!readOnly && <Button variant="primary" icon={<Plus />} onClick={() => setForm({})}>{t('lab.new')}</Button>} />
  } else {
    content = (
      <div className="list lab-plist">
        {list.map(o => {
          const I = STATUS_ICON[o.status]
          return (
            <div key={o.id} className={`list-item clickable lab-pitem lab-st-${o.status}`} onClick={() => (readOnly ? setSlipId(o.id) : setForm({ order: o }))}>
              <span className="lab-pitem-icon"><I /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="lab-pitem-head">
                  <span className="li-main">{t(`labType.${o.type}`)}</span>
                  <TeethBadges teeth={o.teeth} max={6} empty={null} />
                  <LabStatusBadge status={o.status} />
                </div>
                <div className="lab-pitem-meta">
                  <span dir="auto" className="strong">{o.labName}</span>
                  {o.material && <span>{o.material}</span>}
                  {o.shade && <ShadeChip shade={o.shade} />}
                  {o.sentDate && <span>{t('lab.sentOn', { date: fmtDate(o.sentDate, lang) })}</span>}
                  <span className="money">{money(o.cost)}</span>
                </div>
              </div>
              <div className="li-end lab-pitem-end">
                <div className="lab-pitem-due"><span className="lab-k">{o.receivedDate ? t('lab.col.received') : t('lab.col.due')}</span>{o.receivedDate ? <span className="lab-date">{fmtDate(o.receivedDate, lang)}</span> : <DueBadge order={o} today={today} />}</div>
                <LabRowActions order={o} patientName={data?.name ?? ''} onEdit={() => setForm({ order: o })} onPrint={() => setSlipId(o.id)} compact={mobile} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card className="lab-ptab">
      <CardHeader title={t('lab.tabTitle')} icon={<FlaskConical />} subtitle={list?.length ? t('lab.tabCount', { n: list.length, open }) : undefined} actions={list && list.length > 0 ? newBtn : undefined} />
      {content}
      {form && <LabOrderFormModal open lockPatient order={form.order} defaults={form.order ? undefined : { patientId }} onClose={() => setForm(null)} />}
      {slipId && <LabSlipModal id={slipId} onClose={() => setSlipId(null)} />}
    </Card>
  )
}
