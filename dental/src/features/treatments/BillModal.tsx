import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ReceiptText } from 'lucide-react'
import type { TreatmentItem } from '@/db/types'
import { logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Button, Checkbox, EmptyState, Modal, useToast } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { invoiceFromItems, itemTotal, tn } from './lib'
import { ToothBadge } from './parts'
import { billItems } from './actions'

/** Completed, unbilled work of a patient → one invoice. Opens the invoice when done. */
export default function BillModal({ open, onClose, patientId, patientName, items }: { open: boolean; onClose: () => void; patientId: string; patientName?: string; items: TreatmentItem[] }) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useSession()
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)          // one invoice per click, however fast the clicks
  useEffect(() => { if (open) setChosen(new Set(items.map(i => i.id))) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const picked = items.filter(i => chosen.has(i.id))
  const preview = useMemo(() => invoiceFromItems(picked, clinic, { date: todayISO(), patientId, makeId: () => '' }), [picked, clinic, patientId]) // eslint-disable-line react-hooks/exhaustive-deps
  const discounts = picked.reduce((a, i) => a + Math.min(i.discount || 0, i.price), 0)
  const gross = picked.reduce((a, i) => a + (i.price || 0), 0)
  const allOn = picked.length === items.length && items.length > 0
  const toggleAll = () => setChosen(allOn ? new Set() : new Set(items.map(i => i.id)))
  const toggle = (id: string) => setChosen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const confirm = async () => {
    if (!picked.length || busy.current) return
    busy.current = true
    setSaving(true)
    try {
      const inv = await billItems(patientId, picked.map(i => i.id), user?.id)
      void logActivity({ type: 'invoice', action: 'create', entityId: inv.id, patientId, by: user?.id, message: t('treatments.log.invoice', { number: inv.number, name: patientName ?? '' }) })
      toast.success(t('treatments.toast.invoiced', { number: inv.number }), money(inv.total))
      onClose()
      navigate('/invoices/' + inv.id)
    } catch (e) {
      toast.error(t('error'), (e as Error)?.message === 'nothing-to-bill' ? t('treatments.bill.nothing') : String((e as Error)?.message ?? e))
    } finally { busy.current = false; setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={<ReceiptText />} title={t('treatments.bill.title')} subtitle={t('treatments.bill.sub')} className="tr-modal"
      footer={<>
        <span className="start text-sm muted">{tn(t, lang, 'treatments.n.items', picked.length)}</span>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" icon={<FileText />} loading={saving} disabled={!picked.length} onClick={() => void confirm()}>{t('treatments.bill.create')}</Button>
      </>}>
      {items.length === 0 ? <EmptyState compact icon={<ReceiptText />} title={t('treatments.bill.nothing')} /> : (
        <div className="col gap-3">
          <div className="tr-bill-list">
            <div className="tr-bill-row tr-bill-all" onClick={toggleAll}>
              <span onClick={e => e.stopPropagation()}><Checkbox checked={allOn} onChange={toggleAll} aria-label={t('selectAll')} /></span>
              <span className="grow strong">{t('selectAll')}</span>
              <span className="text-sm muted">{t('total')}</span>
            </div>
            {items.map(i => (
              <div key={i.id} className={`tr-bill-row${chosen.has(i.id) ? ' on' : ''}`} onClick={() => toggle(i.id)}>
                <span onClick={e => e.stopPropagation()}><Checkbox checked={chosen.has(i.id)} onChange={() => toggle(i.id)} aria-label={i.procedureName} /></span>
                <ToothBadge tooth={i.tooth} surfaces={i.surfaces} size="sm" />
                <span className="grow tr-bill-name">
                  <span className="tr-bill-title">{i.procedureName}</span>
                  {i.completedAt && <span className="text-xs muted">{fmtDate(i.completedAt, lang)}</span>}
                </span>
                <span className="tr-bill-amount">
                  {i.discount > 0 && <span className="money tr-strike">{money(i.price)}</span>}
                  <span className="money">{money(itemTotal(i))}</span>
                </span>
              </div>
            ))}
          </div>
          <dl className="tr-totals">
            {discounts > 0 && <div><dt>{t('treatments.bill.gross')}</dt><dd><span className="money">{money(gross)}</span></dd></div>}
            {discounts > 0 && <div><dt>{t('treatments.bill.discounts')}</dt><dd><span className="money">{money(-discounts)}</span></dd></div>}
            {preview.taxPercent > 0 && <div><dt>{t('subtotal')}</dt><dd><span className="money">{money(preview.subtotal)}</span></dd></div>}
            {preview.taxPercent > 0 && <div><dt>{t('tax')} <span className="num">({preview.taxPercent}%)</span></dt><dd><span className="money">{money(preview.tax)}</span></dd></div>}
            <div className="grand"><dt>{t('total')}</dt><dd><span className="money">{money(preview.total)}</span></dd></div>
          </dl>
        </div>
      )}
    </Modal>
  )
}
