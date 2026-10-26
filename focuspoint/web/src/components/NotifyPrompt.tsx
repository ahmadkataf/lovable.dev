// A one-time, dismissable invitation to turn on notifications (after the first booking, and on /mine).
// Texts: content.booking.notify_title + notify_prompt / notify_prompt_mine ({reminder} = settings.reminder_minutes;
// the …_no_reminder wording when reminders are off).
import { useState } from 'react'
import type { PublicSettings } from '@shared/types'
import { Button, Card, Icon, useToast } from '../ui'
import { canOfferPush, enablePush } from '../lib/push'
import { setFlag } from '../lib/store'
import { useCached } from '../lib/data'
import { ContentText, hasText, useBookingCopy } from './ContentText'

export function NotifyPrompt({ where = 'booking' }: { where?: 'booking' | 'mine' }) {
  const [visible, setVisible] = useState(() => canOfferPush())
  const [busy, setBusy] = useState(false)
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  const copy = useBookingCopy()
  const toast = useToast()
  if (!visible) return null
  const text = copy.text(where === 'mine' ? 'notify_prompt_mine' : 'notify_prompt')

  async function enable() {
    setBusy(true)
    try {
      const r = await enablePush(settings?.vapid_public_key || '')
      if (r === 'granted') toast.show('تم تفعيل الإشعارات', 'ok')
      else if (r === 'denied') toast.show('ما تم السماح بالإشعارات — بتقدر تفعّلها من إعدادات المتصفح', 'info')
      else toast.show('الإشعارات غير متاحة على هذا الجهاز', 'info')
    } catch { toast.show('ما قدرنا نفعّل الإشعارات الآن', 'error') } finally { setBusy(false); setVisible(false) }
  }
  function later() { setFlag('fp_push_asked'); setVisible(false) }

  return (
    <Card>
      <div className="prompt-card">
        <span className="prompt-ico"><Icon name="bell" size={20} /></span>
        <div className="grow">
          <div className="strong" style={{ color: 'var(--plum)' }}><ContentText text={copy.text('notify_title')} vars={copy.vars} /></div>
          {hasText(text) && <p className="muted small"><ContentText text={text} vars={copy.vars} /></p>}
          <div className="row gap mt-sm">
            <Button size="sm" onClick={enable} loading={busy}>فعّل الإشعارات</Button>
            <Button size="sm" variant="ghost" onClick={later}>لاحقاً</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
