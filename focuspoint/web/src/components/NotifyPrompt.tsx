// A one-time, dismissable invitation to turn on notifications (after the first booking, and on /mine).
import { useState } from 'react'
import type { PublicSettings } from '@shared/types'
import { Button, Card, Icon, useToast } from '../ui'
import { canOfferPush, enablePush } from '../lib/push'
import { setFlag } from '../lib/store'
import { useCached } from '../lib/data'

export function NotifyPrompt({ text = 'خبّرك أول ما يتأكد حجزك، ونذكّرك قبله بساعة.' }: { text?: string }) {
  const [visible, setVisible] = useState(() => canOfferPush())
  const [busy, setBusy] = useState(false)
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  const toast = useToast()
  if (!visible) return null

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
          <div className="strong" style={{ color: 'var(--plum)' }}>فعّل الإشعارات</div>
          <p className="muted small">{text}</p>
          <div className="row gap mt-sm">
            <Button size="sm" onClick={enable} loading={busy}>فعّل الإشعارات</Button>
            <Button size="sm" variant="ghost" onClick={later}>لاحقاً</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
