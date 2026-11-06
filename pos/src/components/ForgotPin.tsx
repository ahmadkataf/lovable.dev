// "Forgot your PIN?" on the lock screen. Before this a forgotten manager PIN meant uninstalling the app. The shop owner
// proves who they are one of two ways, then sets a new PIN for any account:
//   • the activation code they received when they bought Kaseb (checked against this device's license, offline);
//   • a one-time 6-digit code from the seller, who makes it in the panel from this device's code and the request
//     number shown here (checked online, valid the day it is issued).
// The reset goes to the activity log, so the owner sees it if someone else used it.
import { useMemo, useState, type FormEvent } from 'react'
import { KeyRound, MessageCircle, ShieldCheck } from 'lucide-react'
import { useStore, toast } from '../state/store'
import { useT } from '../i18n'
import { Button, Field, Input, Modal, Seg, Select, useIsMobile } from './ui'
import { db } from '../db'
import type { User } from '../db/types'
import { license } from '../license'
import { cleanCode, formatTyping } from '../license/crypto'
import { DEFAULT_INFO } from '../license/types'
import { hashPin } from '../lib/hash'
import { newResetChallenge } from '../lib/pin'
import { normalizePin, validatePin } from '../screens/settings/users'
import { logAudit } from '../lib/audit'
import { platform } from '../lib/platform'

type How = 'code' | 'seller'

const REQ_KEY = 'kaseb.pinReq'
const today = () => Math.floor(Date.now() / 86400000)
/** This device's pending request number, or a new one (kept until used or two days old). */
function keptChallenge(device: string): string {
  try {
    const v = JSON.parse(localStorage.getItem(REQ_KEY) || 'null') as { d?: string; c?: string; day?: number } | null
    if (v && v.d === device && typeof v.c === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(v.c) && typeof v.day === 'number' && today() - v.day <= 2) return v.c
  } catch { /* none kept */ }
  const c = newResetChallenge()
  try { localStorage.setItem(REQ_KEY, JSON.stringify({ d: device, c, day: today() })) } catch { /* kept for this window only */ }
  return c
}
function dropChallenge(): void { try { localStorage.removeItem(REQ_KEY) } catch { /* nothing kept */ } }

export function ForgotPin({ picked, onClose }: { picked: User; onClose: () => void }) {
  const t = useT()
  const mobile = useIsMobile()
  const lic = useStore(s => s.license)
  const users = useStore(s => s.users)
  const login = useStore(s => s.login)
  const reloadUsers = useStore(s => s.reloadUsers)
  const hasCode = lic.state === 'active' && !!lic.code
  const canSeller = lic.state !== 'demo'
  const [how, setHow] = useState<How>(hasCode ? 'code' : 'seller')
  const [step, setStep] = useState<'verify' | 'reset'>('verify')
  const [via, setVia] = useState<How>('code')
  // the request number survives closing the window or a restart (the seller may answer later on WhatsApp) and is
  // dropped once used; the seller's code is tied to it and valid two days
  const challenge = useMemo(() => keptChallenge(lic.deviceCode), [lic.deviceCode])
  const [actCode, setActCode] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [target, setTarget] = useState(picked.id)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const info = lic.info ?? DEFAULT_INFO

  const verify = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setErr(null)
    if (how === 'code') {
      const typed = cleanCode(actCode)
      if (!typed || typed !== cleanCode(lic.code ?? '')) { setErr(t('forgot.badCode')); return }
      setVia('code'); setStep('reset'); return
    }
    const code = normalizePin(resetCode)
    if (!/^\d{6}$/.test(code)) { setErr(t('license.err.invalid_reset_code')); return }
    setBusy(true)
    try {
      const r = await license.verifyPinReset(challenge, code)
      if (r.ok) { dropChallenge(); setVia('seller'); setStep('reset') }
      else setErr(t(r.error))
    } finally { setBusy(false) }
  }

  const askSeller = () => {
    const wa = (info.whatsapp || DEFAULT_INFO.whatsapp || '').replace(/\D/g, '')
    if (!wa) return
    platform.openUrl(`https://wa.me/${wa}?text=${encodeURIComponent(t('forgot.waText', { device: lic.deviceCode || '—', req: challenge }))}`)
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    const v = validatePin(pin, pin2)
    if (v) { setErr(t(v === 'format' ? 'forgot.pinFormat' : 'forgot.pinMatch')); return }
    const u = users.find(x => x.id === target)
    if (!u) return
    setBusy(true)
    try {
      await db.users.update(u.id, { pinHash: await hashPin(pin), pinLen: pin.length })
      void logAudit({ kind: 'user.pinReset', detail: `${u.name} · ${t(via === 'code' ? 'forgot.byCode' : 'forgot.bySeller')}`, refId: u.id, user: { id: u.id, name: u.name } })
      await reloadUsers()
      const fresh = useStore.getState().users.find(x => x.id === u.id)
      toast(t('forgot.done'), 'success')
      onClose()
      if (fresh) login(fresh)
    } catch { toast(t('common.error'), 'error') }
    finally { setBusy(false) }
  }

  if (step === 'reset') {
    return (
      <Modal open onClose={onClose} size="narrow" full={mobile} title={t('forgot.resetTitle')} footer={
        <>
          <Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" icon={<ShieldCheck size={16} />} loading={busy} onClick={() => void save()}>{t('forgot.save')}</Button>
        </>
      }>
        <form className="col" style={{ gap: 12 }} onSubmit={e => void save(e)}>
          <Field label={t('forgot.account')}>
            <Select value={target} onChange={e => { setTarget(e.target.value); setErr(null) }}>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} — {t(u.role === 'admin' ? 'common.admin' : 'common.cashier')}</option>)}
            </Select>
          </Field>
          <div className="form-grid">
            <Field label={t('forgot.newPin')}>
              <Input type="password" inputMode="numeric" autoComplete="new-password" className="ltr" autoFocus value={pin} maxLength={6} placeholder="••••" invalid={!!err} onChange={e => { setPin(normalizePin(e.target.value)); setErr(null) }} />
            </Field>
            <Field label={t('forgot.confirmPin')}>
              <Input type="password" inputMode="numeric" autoComplete="new-password" className="ltr" value={pin2} maxLength={6} placeholder="••••" invalid={!!err} onChange={e => { setPin2(normalizePin(e.target.value)); setErr(null) }} />
            </Field>
          </div>
          {err ? <span className="xs" style={{ color: 'var(--danger)' }}>{err}</span> : <span className="xs faint">{t('forgot.pinHint')}</span>}
          <button type="submit" hidden />
        </form>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} size="narrow" full={mobile} title={t('forgot.title')} footer={
      canSeller ? (
        <>
          <Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button variant="primary" icon={<KeyRound size={16} />} loading={busy} onClick={() => void verify()}>{t('forgot.verify')}</Button>
        </>
      ) : <Button onClick={onClose}>{t('common.ok')}</Button>
    }>
      {!canSeller ? <p className="muted" style={{ margin: 0 }}>{t('forgot.demo')}</p> : (
        <form className="col" style={{ gap: 12 }} onSubmit={e => void verify(e)}>
          <p className="muted" style={{ margin: 0 }}>{t(picked.role === 'admin' ? 'forgot.intro' : 'forgot.cashierHint')}</p>
          {hasCode && <Seg<How> block value={how} onChange={v => { setHow(v); setErr(null) }} options={[{ value: 'code', label: t('forgot.byCode') }, { value: 'seller', label: t('forgot.bySeller') }]} />}
          {how === 'code' ? (
            <>
              <span className="small muted">{t('forgot.codeText')}</span>
              <Field label={t('forgot.actCode')} error={err ?? undefined}>
                <Input className="ltr mono" autoFocus value={actCode} placeholder="XXXX-XXXX-XXXX" maxLength={14} autoCapitalize="characters" autoComplete="off" invalid={!!err}
                  onChange={e => { setActCode(formatTyping(e.target.value)); setErr(null) }}
                  onPaste={e => { const txt = e.clipboardData.getData('text'); if (!txt) return; e.preventDefault(); const m = txt.toUpperCase().match(/[0-9A-Z]{4}-?[0-9A-Z]{4}-?[0-9A-Z]{4}/); setActCode(formatTyping(m ? m[0] : txt)); setErr(null) }} />
              </Field>
            </>
          ) : (
            <>
              <span className="small muted">{t('forgot.sellerText')}</span>
              <div className="forgot-ids">
                <div><span className="xs faint">{t('forgot.device')}</span><b className="mono" dir="ltr">{lic.deviceCode || '—'}</b></div>
                <div><span className="xs faint">{t('forgot.request')}</span><b className="mono" dir="ltr">{challenge}</b></div>
              </div>
              {(info.whatsapp || DEFAULT_INFO.whatsapp) && <Button variant="soft" icon={<MessageCircle size={16} />} onClick={askSeller}>{t('forgot.sendWa')}</Button>}
              <Field label={t('forgot.resetCode')} error={err ?? undefined}>
                <Input className="ltr mono" inputMode="numeric" value={resetCode} placeholder="000000" maxLength={6} autoComplete="one-time-code" invalid={!!err}
                  onChange={e => { setResetCode(normalizePin(e.target.value)); setErr(null) }}
                  onPaste={e => { const txt = e.clipboardData.getData('text'); if (!txt) return; e.preventDefault(); const d = txt.replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))); const m = d.match(/\d{6}/); setResetCode(m ? m[0] : normalizePin(d)); setErr(null) }} />
              </Field>
            </>
          )}
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  )
}
