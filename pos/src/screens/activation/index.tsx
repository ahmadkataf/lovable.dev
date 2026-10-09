// /activation: the device code, the license state, the code input, the trial, the WhatsApp purchase and the
// seller's message. Full-screen (lock-screen) when the app is blocked, a normal page when `embedded`.
import './i18n'
import './activation.css'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Copy, KeyRound, CheckCircle2, Clock, AlertTriangle, WifiOff, ShieldAlert, Ban, RefreshCw, MessageCircle, ArrowLeftRight, Sparkles, Hourglass, MonitorSmartphone } from 'lucide-react'
import icon from '/icon.svg'
import { useT } from '../../i18n'
import { toast, confirmDialog, useStore, useUser, isAdmin } from '../../state/store'
import { platform } from '../../lib/platform'
import { formatDate, formatDateTime, daysBetween } from '../../lib/format'
import { Button, Input, useIsMobile } from '../../components/ui'
import { license } from '../../license'
import { PolicyBanner } from '../../components/PolicyBanner'
import { DEFAULT_INFO, type LicenseStatus } from '../../license/types'
import { cleanCode, formatTyping } from '../../license/crypto'

type Busy = 'activate' | 'trial' | 'check' | 'release' | null
type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'

/** navigator.onLine, kept current. */
function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return on
}

function describe(lic: LicenseStatus, t: (k: string, v?: Record<string, string | number>) => string): { tone: Tone; icon: ReactNode; title: string; text: string } {
  const sz = 22
  switch (lic.state) {
    case 'demo': return { tone: 'info', icon: <Sparkles size={sz} />, title: t('activation.state.demo.title'), text: t('activation.state.demo.text') }
    case 'none': return { tone: 'neutral', icon: <KeyRound size={sz} />, title: t('activation.state.none.title'), text: t('activation.state.none.text') }
    case 'trial': {
      const n = lic.expiresAt ? Math.max(0, daysBetween(Date.now(), lic.expiresAt)) : 0
      return { tone: 'warn', icon: <Hourglass size={sz} />, title: n === 0 ? t('activation.state.trialLast.title') : t('activation.state.trial.title', { n }), text: t('activation.state.trial.text') }
    }
    case 'active': return { tone: 'ok', icon: <CheckCircle2 size={sz} />, title: lic.expiresAt ? t('activation.state.activeUntil.title', { date: formatDate(lic.expiresAt) }) : t('activation.state.active.title'), text: t('activation.state.active.text') }
    case 'expired': return { tone: 'bad', icon: <Clock size={sz} />, title: t('activation.state.expired.title'), text: t('activation.state.expired.text') }
    case 'revoked': return { tone: 'bad', icon: <Ban size={sz} />, title: t('activation.state.revoked.title'), text: t('activation.state.revoked.text') }
    case 'locked': return { tone: 'warn', icon: <WifiOff size={sz} />, title: t('activation.state.locked.title'), text: t('activation.state.locked.text') }
    case 'tampered': return { tone: 'bad', icon: <ShieldAlert size={sz} />, title: t('activation.state.tampered.title'), text: t('activation.state.tampered.text') }
  }
}

export default function ActivationScreen({ embedded }: { embedded?: boolean }) {
  const t = useT()
  const lic = useStore(s => s.license)
  const user = useUser()
  const mobile = useIsMobile()
  const online = useOnline()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [showError, setShowError] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const info = lic.info ?? DEFAULT_INFO
  const demo = lic.state === 'demo'
  const state = describe(lic, t)
  const showForm = !demo && lic.state !== 'active'
  const showTrial = lic.state === 'none' && info.trialDays > 0
  const showBuy = !demo && lic.state !== 'active'
  const canRelease = lic.state === 'active' && (!embedded || isAdmin(user))
  const error = localError ?? (showError && lic.error ? (lic.errorText && lic.error === 'license.err.unknown' ? lic.errorText : t(lic.error)) : null)

  // fresh price / WhatsApp / message when we can get them; the cached copy shows meanwhile
  useEffect(() => { if (!demo && online) void license.fetchInfo() }, [demo, online])
  useEffect(() => { if (showForm && !mobile) inputRef.current?.focus() }, [showForm, mobile])

  const copyCode = async () => {
    if (!lic.deviceCode) return
    toast((await platform.copy(lic.deviceCode)) ? t('activation.copied') : t('common.error'), 'success')
  }
  const activate = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    if (!cleanCode(code)) { setLocalError(t('license.err.invalid_code')); inputRef.current?.focus(); return }
    setBusy('activate'); setLocalError(null); setShowError(true)
    try {
      const s = await license.activate(code)
      if (s.state === 'active' || s.state === 'trial') { toast(t('activation.activated'), 'success'); setCode(''); setShowError(false) }
    } finally { setBusy(null) }
  }
  const trial = async () => {
    if (busy) return
    setBusy('trial'); setLocalError(null); setShowError(true)
    try {
      const s = await license.startTrial()
      if (s.state === 'trial') { toast(t('activation.trialStarted'), 'success'); setShowError(false) }
    } finally { setBusy(null) }
  }
  const check = async () => {
    if (busy) return
    setBusy('check'); setLocalError(null); setShowError(false)
    try {
      const before = lic.state
      const s = await license.check()
      if (s.error && (s.error === 'license.err.network' || s.state === before || s.state === 'locked')) toast(t(s.error), s.error === 'license.err.network' ? 'warn' : 'error')
      else if (s.state === 'active' || s.state === 'trial') toast(t('activation.checked'), 'success')
      else if (s.error) toast(t(s.error), 'error')
    } finally { setBusy(null) }
  }
  const release = async () => {
    if (busy) return
    if (!(await confirmDialog({ title: t('activation.releaseTitle'), text: t('activation.releaseText'), danger: true, okLabel: t('activation.releaseOk') }))) return
    setBusy('release'); setLocalError(null); setShowError(false)
    try {
      const s = await license.release()
      if (s.state === 'none') toast(t('activation.released'), 'success')
      else toast(t(s.error ?? 'common.error'), 'error')
    } finally { setBusy(null) }
  }
  const buy = () => {
    const text = t('activation.waText', { code: lic.deviceCode })
    platform.openUrl(`https://wa.me/${info.whatsapp}?text=${encodeURIComponent(text)}`)
  }

  const body = (
    <>
      <section className="act-device">
        <div className="act-device-label">{t('activation.deviceCode')}</div>
        <div className="act-device-row">
          <span className="act-device-code num" dir="ltr">{lic.deviceCode || '—'}</span>
          <Button variant="soft" size={mobile ? 'md' : 'sm'} icon={<Copy size={16} />} onClick={() => void copyCode()} disabled={!lic.deviceCode}>{t('common.copy')}</Button>
        </div>
        <div className="act-device-hint">{t('activation.deviceHint')}</div>
      </section>

      <section className={`act-state ${state.tone}`} aria-live="polite">
        <span className="act-state-ico">{state.icon}</span>
        <div className="grow">
          <h2>{state.title}</h2>
          <p>{state.text}</p>
          {!demo && lic.state !== 'none' && (
            <div className="act-state-meta">
              {lic.code && <span className="num">{t('activation.code', { code: lic.code })}</span>}
              {(lic.state === 'active' || lic.state === 'trial') && (lic.expiresAt ? <span>{t('activation.expires', { date: formatDate(lic.expiresAt) })}</span> : lic.state === 'active' ? <span>{t('activation.lifetime')}</span> : null)}
              <span>{lic.lastCheck ? t('activation.lastCheck', { time: formatDateTime(lic.lastCheck) }) : t('activation.neverChecked')}</span>
              <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} loading={busy === 'check' || (lic.checking && !busy)} disabled={!!busy && busy !== 'check'} onClick={() => void check()}>{t('activation.checkNow')}</Button>
            </div>
          )}
        </div>
      </section>

      {!demo && (!online || !lic.online) && <div className="banner warn act-offline"><WifiOff size={16} /> {t(online ? 'license.err.network' : 'activation.offline')}</div>}

      {!demo && <PolicyBanner terms />}

      {showForm && (
        <form className="act-form" onSubmit={e => void activate(e)}>
          <label className="label" htmlFor="act-code">{t('activation.codeLabel')}</label>
          <div className="act-code-row">
            <Input id="act-code" ref={inputRef} className="act-code-input" ltr value={code} placeholder="XXXX-XXXX-XXXX" inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={14} invalid={!!error}
              onChange={e => { setCode(formatTyping(e.target.value)); setLocalError(null); setShowError(false) }}
              onPaste={e => { const txt = e.clipboardData.getData('text'); if (txt) { e.preventDefault(); setCode(formatTyping(txt)); setLocalError(null); setShowError(false) } }} />
            <Button type="submit" variant="primary" icon={<KeyRound size={18} />} loading={busy === 'activate'} disabled={!!busy && busy !== 'activate'}>{t('license.activate')}</Button>
          </div>
          {error && <div className="act-error" role="alert"><AlertTriangle size={15} /><span>{error}</span></div>}
        </form>
      )}

      {showTrial && (
        <>
          <div className="act-or">{t('common.optional')}</div>
          <Button variant="soft" size="lg" block icon={<Sparkles size={18} />} loading={busy === 'trial'} disabled={!!busy && busy !== 'trial'} onClick={() => void trial()}>
            {info.trialDays === 1 ? t('activation.trialOne') : t('activation.trial', { n: info.trialDays })}
          </Button>
        </>
      )}

      {showBuy && (
        <section className="act-buy">
          <div className="act-price">{t('activation.price')}: <span className="num">{info.price || DEFAULT_INFO.price}</span> — {t('activation.priceLine')}</div>
          <div className="act-price small muted">{t('activation.cloudLine', { price: info.cloudPrice || DEFAULT_INFO.cloudPrice || '35$' })}</div>
          {info.whatsapp && <Button className="act-wa" size="lg" block icon={<MessageCircle size={18} />} onClick={buy}>{t('activation.buyWa')}</Button>}
        </section>
      )}

      {!demo && info.message?.trim() && <div className="act-message"><b>{t('activation.sellerMessage')}</b>{info.message.trim()}</div>}

      {canRelease && <Button variant="ghost" block icon={<ArrowLeftRight size={16} />} loading={busy === 'release'} disabled={!!busy && busy !== 'release'} onClick={() => void release()}>{t('activation.release')}</Button>}

      <footer className="act-foot">
        <span className="num">{t('activation.version', { v: platform.appVersion(), b: __POS_BUILD__ || 'dev' })}</span>
        <span><MonitorSmartphone size={11} /> {t(`activation.platform.${platform.kind}`)}</span>
      </footer>
    </>
  )

  if (embedded) {
    return (
      <div className="page act-page">
        <div className="page-head"><h1>{t('nav.activation')}</h1></div>
        <div className="page-body narrow"><div className="card act-card">{body}</div></div>
      </div>
    )
  }
  return (
    <div className="lock-screen act-screen">
      <div className="card act-card">
        <header className="act-brand">
          <img src={icon} alt="" />
          <h1>{t('app.name')}</h1>
          <p>{t('app.tagline')}</p>
        </header>
        {body}
      </div>
    </div>
  )
}
