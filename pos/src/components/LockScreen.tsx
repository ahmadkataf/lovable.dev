import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [wrong, setWrongState] = useState(false)
  // read by the digit handlers, which must know whether "wrong" is showing at the moment of the tap
  const wrongNow = useRef(false)
  const setWrong = useCallback((v: boolean) => { wrongNow.current = v; setWrongState(v) }, [])

  const len = knownPinLength(picked)
  useEffect(() => {
    if (!picked) return
    if (!picked.pinHash) { login(picked); return }
    const step = pinStep(pin.length, len)
    if (step === 'type') return
    // a check started for fewer digits must not act once more digits were typed (it would wipe them)
    let alive = true
    let wait: ReturnType<typeof setTimeout> | undefined
    let reset: ReturnType<typeof setTimeout> | undefined
    // "wrong" shows for a moment, then the digits are cleared — unless a digit is typed meanwhile (see addDigit)
    const refuse = () => { setWrong(true); beep('error'); reset = setTimeout(() => { setWrong(false); setPin('') }, 600) }
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
    return () => { alive = false; if (wait) clearTimeout(wait); if (reset) clearTimeout(reset) }
  }, [pin, picked, len, login, setWrong])
  const maxDigits = len ?? PIN_MAX

  // A digit typed while "wrong" shows: after a complete PIN it starts a new one; after a PIN of unknown length that
  // was refused for want of more digits, it carries on (the digits are the start of a longer PIN).
  const addDigit = useCallback((d: string) => {
    const restart = wrongNow.current
    setWrong(false)
    setPin(p => (restart && p.length >= maxDigits ? d : p.length < maxDigits ? p + d : p))
  }, [maxDigits, setWrong])
  const backspace = useCallback(() => { setWrong(false); setPin(p => p.slice(0, -1)) }, [setWrong])
  const pick = useCallback((u: typeof picked) => { setWrong(false); setPin(''); setPicked(u) }, [setWrong])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!picked) return
      // Arabic-Indic digits too (an Arabic keyboard layout), as the PIN form accepts them
      const d = e.key.length === 1 ? normalizePin(e.key) : ''
      if (d) addDigit(d)
      else if (e.key === 'Backspace') backspace()
      else if (e.key === 'Escape') pick(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, addDigit, backspace, pick])

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
              <button key={u.id} type="button" className="list-row" onClick={() => pick(u)}>
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
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} type="button" onClick={() => addDigit(k)}>{k}</button>)}
              <button type="button" onClick={() => pick(users.length === 1 ? users[0] : null)} className="accent">{users.length > 1 ? t('lock.switchUser') : 'C'}</button>
              <button type="button" onClick={() => addDigit('0')}>0</button>
              <button type="button" onClick={backspace} aria-label="backspace"><Delete size={22} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
