import { useEffect, useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { useStore } from '../state/store'
import { useT } from '../i18n'
import { checkPin } from '../lib/hash'
import { Avatar } from './ui'
import { beep } from '../lib/audio'
import icon from '/icon.svg'

/** Who is at the till: pick a user, type the PIN. A user without a PIN opens with one tap. */
export function LockScreen() {
  const t = useT()
  const users = useStore(s => s.users)
  const login = useStore(s => s.login)
  const settings = useStore(s => s.settings)
  const [picked, setPicked] = useState(users.length === 1 ? users[0] : null)
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)

  useEffect(() => {
    if (!picked) return
    if (!picked.pinHash) { login(picked); return }
    if (pin.length >= 4) {
      void checkPin(pin, picked.pinHash).then(ok => {
        if (ok) { beep('tap'); login(picked) }
        else { setWrong(true); beep('error'); setTimeout(() => { setWrong(false); setPin('') }, 600) }
      })
    }
  }, [pin, picked, login])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!picked) return
      if (/^\d$/.test(e.key)) setPin(p => (p.length < 6 ? p + e.key : p))
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1))
      else if (e.key === 'Escape') { setPicked(null); setPin('') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

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
              {[0, 1, 2, 3].map(i => <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? (wrong ? 'var(--danger)' : 'var(--primary)') : 'var(--line-2)', transition: 'background .15s' }} />)}
            </div>
            <div className="numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} type="button" onClick={() => setPin(p => (p.length < 6 ? p + k : p))}>{k}</button>)}
              <button type="button" onClick={() => { setPicked(users.length === 1 ? users[0] : null); setPin('') }} className="accent">{users.length > 1 ? t('lock.switchUser') : 'C'}</button>
              <button type="button" onClick={() => setPin(p => (p.length < 6 ? p + '0' : p))}>0</button>
              <button type="button" onClick={() => setPin(p => p.slice(0, -1))} aria-label="backspace"><Delete size={22} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
