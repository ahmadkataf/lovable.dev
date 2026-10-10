import { useRef, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { Alert, Avatar, Badge, Button, Modal, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { db, logActivity } from '@/db'
import { nowISO } from '@/db/ids'
import type { User } from '@/db/types'
import { hashPin, randomHex } from '@/lib/crypto'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { PinField } from '@/features/auth/PinField'
import { displayName, pinError, pinErrorKey, plainName } from '@/features/auth/lib'
import { ROLE_TONE } from './lib'
import './staff.css'

/** An admin sets a new PIN for any member (the "forgot my PIN" path). */
export default function ResetPinModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const session = useSession()
  const { readOnly } = useLicense()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const name = displayName(user)

  const e1 = pinError(pin)
  const e2 = e1 ? null : pinError(pin, pin2)
  const err1 = tried && e1 ? t(pinErrorKey(e1)) : undefined
  const err2 = tried && e2 ? t(pin2 ? pinErrorKey(e2) : 'v.required') : undefined

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (savingRef.current || readOnly) return
    if (e1 || e2) { setTried(true); return }
    savingRef.current = true
    setSaving(true)
    try {
      const salt = randomHex()
      await db.users.update(user.id, { pinSalt: salt, pinHash: await hashPin(pin, salt), updatedAt: nowISO() })
      toast.success(t('staff.toast.pinReset', { name }))
      void logActivity({ type: 'system', action: 'update', entityId: user.id, by: session.user?.id, message: t('staff.act.pinReset', { name }) })
      onClose()
    } catch {
      toast.error(t('error')); savingRef.current = false; setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="sm" icon={<KeyRound />} title={t('staff.resetTitle')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" type="submit" form="au-reset-form" loading={saving} disabled={readOnly} data-qa="save-pin">{t('staff.resetSave')}</Button></>}>
      <form id="au-reset-form" onSubmit={save} noValidate className="col gap-4">
        {readOnly && <Alert tone="warning">{t('trial.readonly')}</Alert>}
        <div className="au-preview">
          <Avatar name={plainName(user.name)} color={user.color} />
          <div className="grow"><div className="strong truncate">{name}</div><div className="text-sm muted">{t('staff.resetSub')}</div></div>
          <Badge tone={ROLE_TONE[user.role]} size="sm">{t(`role.${user.role}`)}</Badge>
        </div>
        <PinField label={t('staff.pin')} required hint={t('staff.pinHint')} error={err1} value={pin} onChange={setPin} autoFocus id="reset-pin" />
        <PinField label={t('staff.pin2')} required error={err2} value={pin2} onChange={setPin2} id="reset-pin2" />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
