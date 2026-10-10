// Status actions of one lab order (advance to the next step, remake, cancel, delete) with their toasts and activity
// lines, plus the row's action cluster shared by the board and the patient tab.
import { Ban, MoreHorizontal, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react'
import type { LabOrder, LabOrderStatus } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Button, IconButton, Menu, useConfirm, useConfirmDelete, useToast, type MenuItemDef } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { deleteLabOrder, setLabStatus } from './actions'
import { nextStatus } from './lib'
import { STATUS_ICON } from './parts'

export function useLabActions() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()
  const session = useSession()
  const by = session.user?.id

  const move = async (o: LabOrder, status: LabOrderStatus, patientName: string) => {
    const type = t(`labType.${o.type}`)
    const patch = await setLabStatus(o, status, { today: todayISO(), by, message: t('lab.act.status', { type, patient: patientName, status: t(`lab.${status}`) }) })
    if (status === 'remake') toast.success(t('lab.toast.remake'), patch.dueDate ?? o.dueDate ? t('lab.toast.newDue', { date: fmtDate((patch.dueDate ?? o.dueDate)!, lang) }) : undefined)
    else toast.success(t('lab.toast.status', { status: t(`lab.${status}`) }), `${type} · ${patientName}`)
  }
  return {
    advance: async (o: LabOrder, patientName: string) => { const n = nextStatus(o.status); if (n) await move(o, n, patientName) },
    remake: (o: LabOrder, patientName: string) => move(o, 'remake', patientName),
    cancel: async (o: LabOrder, patientName: string) => {
      if (!(await confirm({ title: t('lab.confirm.cancelTitle'), description: t('lab.confirm.cancelDesc'), confirmLabel: t('lab.action.cancel'), danger: true }))) return
      await move(o, 'cancelled', patientName)
    },
    remove: async (o: LabOrder, patientName: string) => {
      const type = t(`labType.${o.type}`)
      if (!(await confirmDelete(t('lab.deleteDesc', { type, patient: patientName })))) return
      await deleteLabOrder(o, { by, message: t('lab.act.deleted', { type, patient: patientName }) })
      toast.success(t('lab.toast.deleted'), `${type} · ${patientName}`)
    },
  }
}

/** The advance button (labelled with the next step) and a menu with the other actions. */
export function LabRowActions({ order, patientName, onEdit, onPrint, compact }: { order: LabOrder; patientName: string; onEdit: () => void; onPrint: () => void; compact?: boolean }) {
  const { t } = useI18n()
  const { readOnly } = useLicense()
  const act = useLabActions()
  const next = nextStatus(order.status)
  const NextIcon = next ? STATUS_ICON[next] : null
  const items: MenuItemDef[] = [
    { label: t('lab.action.print'), icon: <Printer />, onClick: onPrint },
    ...(readOnly ? [] : [
      { label: t('edit'), icon: <Pencil />, onClick: onEdit },
      ...(order.status === 'received' || order.status === 'fitted' || order.status === 'in_progress' ? [{ label: t('lab.action.remake'), icon: <RotateCcw />, onClick: () => void act.remake(order, patientName) }] : []),
      ...(order.status !== 'cancelled' && order.status !== 'fitted' ? [{ label: t('lab.action.cancel'), icon: <Ban />, onClick: () => void act.cancel(order, patientName) }] : []),
      { sep: true },
      { label: t('delete'), icon: <Trash2 />, danger: true, onClick: () => void act.remove(order, patientName) },
    ] as MenuItemDef[]),
  ]
  return (
    <div className="lab-actions" onClick={e => e.stopPropagation()}>
      {next && NextIcon && !readOnly && (
        <Button size="sm" variant="soft" icon={<NextIcon />} onClick={() => void act.advance(order, patientName)} className={`lab-advance lab-advance-${next}`} title={t(`lab.advance.${next}`)}>
          {compact ? undefined : t(`lab.advance.${next}`)}
        </Button>
      )}
      <Menu items={items} trigger={() => <IconButton variant="ghost" size="sm" label={t('more')}><MoreHorizontal /></IconButton>} />
    </div>
  )
}
