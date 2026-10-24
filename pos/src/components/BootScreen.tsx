import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import { useStore } from '../state/store'
import { useT, t as tr } from '../i18n'
import { Button } from './ui'
import { errorReport, logError, restartApp } from '../lib/recovery'
import { platform } from '../lib/platform'

const SLOW_MS = 12000

const looksLikeStorage = (e: { name: string; message: string }): boolean =>
  /quota|full disk|no space|NoSpace/i.test(`${e.name} ${e.message}`)

function CopyDetails({ extra }: { extra?: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" className="recover-link" onClick={() => { void platform.copy(errorReport(extra)).then(ok => setCopied(ok)) }}>
      {copied ? t('boot.copied') : t('boot.copy')}
    </button>
  )
}

/** The actions row with "Restart the app". A restart drops the open cart (it lives only in memory) and the app's
 *  confirm dialog is not mounted behind these cards, so when the cart has items the card itself asks first.
 *  `others` are the card's other buttons (retry, back to sales); `restartFirst` puts the restart first and primary. */
function RestartActions({ others, restartFirst = true, small }: { others?: ReactNode; restartFirst?: boolean; small?: boolean }) {
  const t = useT()
  const cartItems = useStore(s => s.cart.lines.length)
  const [asking, setAsking] = useState(false)
  const size = small ? undefined : 'lg'
  if (asking) {
    return (
      <div className="recover-ask" role="alert">
        <p>{t('restart.cartText')}</p>
        <div className="recover-actions">
          <Button variant="danger" size={size} icon={<RotateCcw size={18} />} onClick={() => void restartApp()}>{t('boot.restart')}</Button>
          <Button size={size} onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
        </div>
      </div>
    )
  }
  const restart = (
    <Button key="restart" variant={restartFirst ? 'primary' : undefined} size={size} icon={<RotateCcw size={small ? 16 : 18} />}
      onClick={() => { if (cartItems > 0) setAsking(true); else void restartApp() }}>{t('boot.restart')}</Button>
  )
  return <div className="recover-actions">{restartFirst ? <>{restart}{others}</> : <>{others}{restart}</>}</div>
}

/** The first screen: a spinner while the shop's data opens; after a while a way out; if opening fails, why and what to do. */
export function BootScreen() {
  const t = useT()
  const err = useStore(s => s.bootError)
  const retry = useStore(s => s.retryBoot)
  const [slow, setSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  useEffect(() => { const id = setTimeout(() => setSlow(true), SLOW_MS); return () => clearTimeout(id) }, [])

  // slow, not failed: the start goes on in the background and opens the app by itself; "try again" would only wait
  // behind it, so the one action is a restart
  if (err && err.name === 'BootTimeout') {
    return (
      <div className="lock-screen">
        <div className="recover-card" role="status">
          <span className="spinner" />
          <h2>{t('boot.stillTitle')}</h2>
          <p>{t('boot.stillText')}</p>
          <RestartActions />
          <CopyDetails extra={`boot: ${err.name}: ${err.message}`} />
        </div>
      </div>
    )
  }
  if (err) {
    const retryBtn = (
      <Button key="retry" variant={err.lost ? 'primary' : undefined} size="lg" loading={retrying} onClick={() => { setRetrying(true); void retry().finally(() => setRetrying(false)) }}>{t('common.retry')}</Button>
    )
    return (
      <div className="lock-screen">
        <div className="recover-card" role="alert">
          <div className="recover-ico"><AlertTriangle size={28} /></div>
          <h2>{t(err.lost ? 'boot.lostTitle' : 'boot.failTitle')}</h2>
          <p>{t(looksLikeStorage(err) ? 'boot.failStorage' : err.lost ? 'boot.lostText' : 'boot.failText')}</p>
          {/* lost mid-session: "try again" keeps the open cart, so it comes first */}
          <RestartActions others={retryBtn} restartFirst={!err.lost} />
          <CopyDetails extra={`${err.lost ? 'lost' : 'boot'}: ${err.name}: ${err.message}`} />
          <code className="recover-code">{err.name}: {err.message}</code>
        </div>
      </div>
    )
  }
  return (
    <div className="lock-screen">
      <div className="col center" style={{ alignItems: 'center' }}>
        <span className="spinner" />
        <span className="muted small">{t('common.loading')}</span>
        {slow && (
          <div className="recover-slow">
            <p>{t('boot.slow')}</p>
            <RestartActions small />
          </div>
        )}
      </div>
    </div>
  )
}

/** A screen that throws (a database query failing mid-session, a bug) shows a way out instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { logError('render', error); if (info?.componentStack) logError('render-stack', new Error(info.componentStack.split('\n').slice(0, 4).join(' | '))) }
  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div className="lock-screen">
        <div className="recover-card" role="alert">
          <div className="recover-ico"><AlertTriangle size={28} /></div>
          <h2>{tr('crash.title')}</h2>
          <p>{tr('crash.text')}</p>
          <RestartActions restartFirst={false} others={
            <Button key="home" variant="primary" size="lg" icon={<Home size={18} />} onClick={() => { try { location.hash = '#/' } catch { /* ignore */ } this.setState({ error: null }) }}>{tr('crash.home')}</Button>
          } />
          <CopyDetails extra={`render: ${e.name}: ${e.message}`} />
          <code className="recover-code">{e.name}: {e.message}</code>
        </div>
      </div>
    )
  }
}
