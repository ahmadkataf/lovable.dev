import { useEffect, useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { useStore } from '../state/store'
import { useT } from '../i18n'
import { checkPin } from '../lib/hash'
import { knownPinLength, pinStep, pinDots, PIN_MAX, PIN_WAIT_MS } from '../lib/pin'
import { db } from '../db'
import { normalizePin } from '../screens/settings/users'
import { Avatar } from './ui'
import { beep } from '../lib/audio'
import icon from '/icon.svg'

/** A PIN set before 1.0.2 has no stored length: keep it once the PIN was right, so next time the screen asks for
 *  exactly that many digits. */
async function rememberPinLength(id: string, n: number): Promise<void> {
  try {
    await db.users.update(id, { pinLen: n })
    await useStore.getState().reloadUsers()
  } catch { /* not important: the screen keeps trying 4 to 6 digits */ }
}

/** Who is at the till: pick a user, type the PIN (4 to 6 digits). A user without a PIN opens with one tap. */
export function LockScreen() {
  const t = useT()
  const users = useStore(s => s.users)
  const login = useStore(s => s.login)
  const settings = useStore(s => s.settings)
  const [picked, setPicked] = useState(users.length === 1 ? users[0] : null)
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)

  const len = knownPinLength(picked)
  useEffect(() => {
    if (!picked) return
    if (!picked.pinHash) { login(picked); return }
    const step = pinStep(pin.length, len)
    if (step === 'type') return
    // a check started for fewer digits must not act once more digits were typed (it would wipe them)
    let alive = true
    let wait: ReturnType<typeof setTimeout> | undefined
    const refuse = () => { setWrong(true); beep('error'); setTimeout(() => { setWrong(false); setPin('') }, 600) }
    void checkPin(pin, picked.pinHash).then(ok => {
      if (!alive) return
      if (ok) {
        beep('tap')
        if (!len) void rememberPinLength(picked.id, pin.length)
        login(picked)
      } else if (step === 'check') refuse()
      // length unknown: these digits may be the start of a longer PIN — say "wrong" only if no more come
      else wait = setTimeout(() => { if (alive) refuse() }, PIN_WAIT_MS)
    })
    return () => { alive = false; if (wait) clearTimeout(wait) }
  }, [pin, picked, len, login])
  const maxDigits = len ?? PIN_MAX

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!picked) return
      // Arabic-Indic digits too (an Arabic keyboard layout), as the PIN form accepts them
      const d = e.key.length === 1 ? normalizePin(e.key) : ''
      if (d) setPin(p => (p.length < maxDigits ? p + d : p))
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1))
      else if (e.key === 'Escape') { setPicked(null); setPin('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, maxDigits])

  return (
    <div className="lock-screen">
      <div className="card pad col" style={{ width: 'min(100%, 380px)', alignItems: 'stretch', gap: 16 }}>
        <div className="col" style={{ alignItems: 'center', gap: 6 }}>
          <img src={icon} alt="" style={{ width: 56, height: 56, borderRadius: 16 }} />
          <h2>{settings.store.name || t('app.name')}</h2>
        </div>
        {!picked ? (
          <div className="list">
            {users.map(u => (
              <button key={u.id} type="button" className="list-row" onClick={() => setPicked(u)}>
                <Avatar name={u.name} round />
                <div className="grow"><div className="title">{u.name}</div><div className="sub">{t(u.role === 'admin' ? 'common.admin' : 'common.cashier')}</div></div>
                {u.pinHash && <Lock size={16} className="faint" />}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'center' }}><Avatar name={picked.name} round /><span className="bold">{picked.name}</span></div>
            <div className="center muted small">{wrong ? <span style={{ color: 'var(--danger)' }}>{t('lock.wrong')}</span> : t('lock.title')}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 12 }} aria-label="pin">
              {Array.from({ length: pinDots(pin.length, len) }, (_, i) => i).map(i => <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? (wrong ? 'var(--danger)' : 'var(--primary)') : 'var(--line-2)', transition: 'background .15s' }} />)}
            </div>
            <div className="numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} type="button" onClick={() => setPin(p => (p.length < maxDigits ? p + k : p))}>{k}</button>)}
              <button type="button" onClick={() => { setPicked(users.length === 1 ? users[0] : null); setPin('') }} className="accent">{users.length > 1 ? t('lock.switchUser') : 'C'}</button>
              <button type="button" onClick={() => setPin(p => (p.length < maxDigits ? p + '0' : p))}>0</button>
              <button type="button" onClick={() => setPin(p => p.slice(0, -1))} aria-label="backspace"><Delete size={22} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
