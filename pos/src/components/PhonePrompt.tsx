// The shop's phone became required in 1.0.3 (printed on receipts; the seller follows up with shops on the free trial).
// A shop set up before that, without a valid number, is asked once — by an admin, after the first-run wizard.
import { useState, type FormEvent } from 'react'
import { Phone } from 'lucide-react'
import { useStore, useUser, isAdmin, toast } from '../state/store'
import { useT } from '../i18n'
import { Button, Field, Input, Modal, useIsMobile } from './ui'
import { validPhone } from '../lib/phone'

export function PhonePrompt() {
  const settings = useStore(s => s.settings)
  const license = useStore(s => s.license)
  const user = useUser()
  // the web demo has no seller to talk to; a cashier may not know the shop's number
  if (!settings.onboarded || license.state === 'demo' || !isAdmin(user) || validPhone(settings.store.phone)) return null
  return <Ask initial={settings.store.phone} />
}

function Ask({ initial }: { initial: string }) {
  const t = useT()
  const mobile = useIsMobile()
  const updateSettings = useStore(s => s.updateSettings)
  const [phone, setPhone] = useState(initial)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!validPhone(phone)) { setErr(t('settings.store.phoneRequired')); return }
    setSaving(true)
    try { await updateSettings({ store: { phone: phone.trim() } }); toast(t('phonePrompt.saved'), 'success') }
    catch { toast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }
  return (
    <Modal open noClose onClose={() => {}} size="narrow" full={mobile} title={t('phonePrompt.title')}
      footer={<Button variant="primary" size="lg" block icon={<Phone size={18} />} loading={saving} onClick={() => void save()}>{t('common.save')}</Button>}>
      <form className="col" style={{ gap: 12 }} onSubmit={e => void save(e)}>
        <p className="muted" style={{ margin: 0 }}>{t('phonePrompt.text')}</p>
        <Field label={t('settings.store.phone')} error={err ?? undefined}>
          <Input ltr inputMode="tel" autoFocus value={phone} onChange={e => { setPhone(e.target.value); setErr(null) }} placeholder="09xx xxx xxx" maxLength={30} invalid={!!err} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
