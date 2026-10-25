// "Add to home screen": the native prompt on Android/Chrome, a short how-to on iOS Safari.
import { useEffect, useState } from 'react'
import { Button, Card, Icon } from '../ui'
import { isIOS, isStandalone } from '../lib/push'
import { flag, setFlag } from '../lib/store'

const SNOOZE_DAYS = 14
let deferred: BeforeInstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e })
}

function snoozed(): boolean {
  const v = flag('fp_install_dismissed')
  return !!v && Date.now() - Number(v) < SNOOZE_DAYS * 86_400_000
}

export function InstallHint() {
  const [, bump] = useState(0)
  const [hidden, setHidden] = useState(() => snoozed() || (typeof window !== 'undefined' && isStandalone()))
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener('beforeinstallprompt', on)
    window.addEventListener('appinstalled', () => setHidden(true))
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  if (hidden) return null
  const ios = isIOS()
  if (!deferred && !ios) return null

  const dismiss = () => { setFlag('fp_install_dismissed', String(Date.now())); setHidden(true) }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null
    if (outcome === 'accepted') setHidden(true)
    else dismiss()
  }

  return (
    <Card>
      <div className="prompt-card">
        <span className="prompt-ico"><Icon name="download" size={20} /></span>
        <div className="grow">
          <div className="strong" style={{ color: 'var(--plum)' }}>ثبّت فوكس بوينت على جهازك</div>
          {ios && !deferred
            ? <p className="muted small">من Safari: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».</p>
            : <p className="muted small">يفتح كتطبيق، أسرع، ويشتغل حتى بدون إنترنت.</p>}
          <div className="row gap mt-sm">
            {deferred && <Button size="sm" onClick={install}>تثبيت</Button>}
            <Button size="sm" variant="ghost" onClick={dismiss}>{deferred ? 'لاحقاً' : 'فهمت'}</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
