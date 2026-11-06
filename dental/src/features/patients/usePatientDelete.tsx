// Deleting a patient file, shared by the patients list and the profile. A file with money history (issued invoices
// or payments) is never deleted: past revenue, closed cash days and reports must not change after the fact. The user
// gets a clear explanation and is offered to archive the file instead.
import { useCallback, useState, type ReactNode } from 'react'
import { Archive, ShieldAlert } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Patient } from '@/db/types'
import { nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Alert, Button, Modal, useConfirmDelete, useToast } from '@/ui'
import { deletePatientCascade, hasMoneyHistory, moneyHistory, PatientHasMoneyHistory, type MoneyHistory } from './data'
import { usePlural } from './parts'

type Who = Pick<Patient, 'id' | 'name' | 'archived'>
/** A name inside a sentence of the other language keeps its own direction (first-strong isolate). */
const isolate = (s: string) => `\u2068${s}\u2069`

export function usePatientDelete(): { remove: (p: Who, opts?: { beforeDelete?: () => void }) => Promise<boolean>; dialog: ReactNode } {
  const { t } = useI18n()
  const toast = useToast()
  const session = useSession()
  const { readOnly } = useLicense()
  const confirmDelete = useConfirmDelete()
  const plural = usePlural()
  const [blocked, setBlocked] = useState<{ patient: Who; history: MoneyHistory } | null>(null)
  const [archiving, setArchiving] = useState(false)

  const records = useCallback((h: MoneyHistory) => [h.invoices ? plural('invoicesN', h.invoices) : '', h.payments ? plural('paymentsN', h.payments) : '']
    .filter(Boolean).join(t('patients.deleteBlocked.and')), [plural, t])

  const remove = useCallback(async (p: Who, opts?: { beforeDelete?: () => void }) => {
    let history: MoneyHistory
    try { history = await moneyHistory(p.id) } catch { toast.error(t('patients.deleteFailed')); return false }
    if (hasMoneyHistory(history)) { setBlocked({ patient: p, history }); return false }
    if (!(await confirmDelete(t('patients.deleteConfirm')))) return false
    opts?.beforeDelete?.()
    try {
      await deletePatientCascade(p.id)
      void logActivity({ type: 'patient', action: 'delete', entityId: p.id, message: p.name, by: session.user?.id })
      toast.success(t('patients.deletedToast'), p.name)
      return true
    } catch (e) {
      // a payment recorded between the check and the delete: nothing was deleted
      if (e instanceof PatientHasMoneyHistory) toast.warning(t('patients.deleteBlocked.title'), t('patients.deleteBlocked.why', { name: isolate(p.name), records: records(e.history) }))
      else toast.error(t('patients.deleteFailed'))
      return false
    }
  }, [confirmDelete, records, session.user?.id, t, toast])

  const archive = async () => {
    if (!blocked || archiving) return
    const { patient } = blocked
    setArchiving(true)
    try {
      await db.patients.update(patient.id, { archived: true, updatedAt: nowISO() })
      void logActivity({ type: 'patient', action: 'status', entityId: patient.id, patientId: patient.id, message: `${patient.name} — ${t('archive')}`, by: session.user?.id })
      toast.success(t('patients.archivedToast'), patient.name)
      setBlocked(null)
    } catch {
      toast.error(t('patients.saveFailed'))
    } finally { setArchiving(false) }
  }

  const close = () => setBlocked(null)
  const canArchive = !!blocked && !blocked.patient.archived && !readOnly
  const dialog = blocked && (
    <Modal open onClose={close} size="sm" icon={<ShieldAlert className="pt-blocked-icon" />} title={t('patients.deleteBlocked.title')}
      footer={<>
        <Button variant={canArchive ? 'ghost' : 'primary'} onClick={close}>{t('close')}</Button>
        {canArchive && <Button variant="primary" icon={<Archive />} loading={archiving} onClick={() => void archive()} data-autofocus>{t('patients.deleteBlocked.archive')}</Button>}
      </>}>
      <div className="col gap-3 pt-blocked" data-testid="pt-delete-blocked">
        <p>{t('patients.deleteBlocked.why', { name: isolate(blocked.patient.name), records: records(blocked.history) })}</p>
        <Alert tone="info" icon={<Archive />}>{blocked.patient.archived ? t('patients.deleteBlocked.alreadyArchived') : t('patients.deleteBlocked.archiveHint')}</Alert>
      </div>
    </Modal>
  )
  return { remove, dialog }
}
