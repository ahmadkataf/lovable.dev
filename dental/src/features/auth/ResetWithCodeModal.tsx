import { useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react'
import { Alert, Button, Modal, Select, Textarea } from '@/ui'
import { useI18n } from '@/i18n'
import type { User } from '@/db/types'
import { CODE_CHARS, cleanCode, extractCode, formatCode } from '@/license/core'
import { PinField } from './PinField'
import { applyPinReset, checkReset } from './resetPin'
import { displayName, pinError, pinErrorKey, sortAdminsForReset } from './lib'
import './auth.css'

/**
 * "Forgot your PIN?" for the clinic's admin: paste the reset code the seller sent for this device, then choose
 * a new PIN. `onDone` signs in with it.
 */
export default function ResetWithCodeModal({ device, users, now, onClose, onDone }: {
  device: string; users: User[]; now: () => number; onClose: () => void; onDone: (userId: string, pin: string) => Promise<void>
}) {
  const { t } = useI18n()
  const admins = useMemo(() => sortAdminsForReset(users), [users])
  const [step, setStep] = useState<'code' | 'pin'>('code')
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState<string | null>(null)
  const [userId, setUserId] = useState(admins[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const busyRef = useRef(false)

  const e1 = pinError(pin)
  const e2 = e1 ? null : pinError(pin, pin2)
  const err1 = tried && e1 ? t(pinErrorKey(e1)) : undefined
  const err2 = tried && e2 ? t(pin2 ? pinErrorKey(e2) : 'v.required') : undefined

  const onCode = (raw: string) => {
    // a whole pasted message is reduced to its code; while typing by hand every character is kept
    const c = extractCode(raw)
    setCode(formatCode(c.slice(0, CODE_CHARS))); setCodeErr(null)
  }
  const check = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busyRef.current) return
    if (cleanCode(code).length !== CODE_CHARS) { setCodeErr(t('auth.reset.err.format')); return }
    busyRef.current = true; setBusy(true)
    try {
      const r = await checkReset(device, code, now())
      if (r.ok) { setStep('pin'); setCodeErr(null) } else setCodeErr(t(`auth.reset.err.${r.reason}`))
    } catch { setCodeErr(t('auth.reset.err.format')) } finally { busyRef.current = false; setBusy(false) }
  }
  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busyRef.current) return
    if (e1 || e2 || !userId) { setTried(true); return }
    busyRef.current = true; setBusy(true); setFailed(false)
    try {
      const r = await applyPinReset({ device, code, userId, pin, now: now(), activityMessage: name => t('auth.reset.activity', { name }) })
      if (!r.ok) { setStep('code'); setCodeErr(t(`auth.reset.err.${r.reason}`)); return }
      await onDone(userId, pin)
    } catch { setFailed(true) } finally { busyRef.current = false; setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} size="sm" icon={<KeyRound />} title={t('auth.reset.title')} subtitle={t('auth.reset.sub')}
      footer={step === 'code'
        ? <><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" type="submit" form="au-reset-code" loading={busy} data-qa="reset-check">{t('auth.reset.check')}</Button></>
        : <><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" type="submit" form="au-reset-pin" loading={busy} icon={<ShieldCheck />} data-qa="reset-save">{t('auth.reset.save')}</Button></>}>
      {step === 'code' ? (
        <form id="au-reset-code" onSubmit={check} noValidate className="col gap-3">
          <div className="au-reset-device"><span className="muted">{t('auth.login.deviceNo')}</span><span className="ltr strong" data-qa="reset-device">{device}</span></div>
          <Textarea label={t('auth.reset.codeLabel')} value={code} onChange={e => onCode(e.target.value)} placeholder={t('auth.reset.codePh')} dir="ltr"
            autoComplete="off" autoCapitalize="characters" spellCheck={false} rows={5} className="au-reset-input" autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void check() } }}
            error={codeErr ?? undefined} hint={codeErr ? undefined : t('auth.reset.codeHint')} data-qa="reset-code" />
        </form>
      ) : (
        <form id="au-reset-pin" onSubmit={save} noValidate className="col gap-4">
          <Alert tone="success" icon={<CheckCircle2 />}>{t('auth.reset.valid')}</Alert>
          {failed && <Alert tone="danger">{t('auth.reset.failed')}</Alert>}
          {admins.length > 1 && (
            <Select label={t('auth.reset.who')} value={userId} onChange={e => setUserId(e.target.value)} name="admin"
              options={admins.map(u => ({ value: u.id, label: displayName(u) }))} />
          )}
          {admins.length === 1 && <div className="au-reset-device"><span className="muted">{t('auth.reset.who')}</span><span className="strong" dir="auto">{displayName(admins[0])}</span></div>}
          <PinField label={t('auth.reset.newPin')} required hint={t('auth.pin.hint')} error={err1} value={pin} onChange={setPin} autoFocus id="reset-new-pin" />
          <PinField label={t('auth.reset.newPin2')} required error={err2} value={pin2} onChange={setPin2} id="reset-new-pin2" />
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  )
}
