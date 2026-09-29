import { useEffect, useState } from 'react'
import { Delete, LogIn } from 'lucide-react'
import { audit, put, setCurrentUser, useCollection, useSettings } from '../db/store'
import { hashPin, verifyPin } from '../lib/crypto'
import type { User } from '../db/types'

// wrong PINs: after 5 in a row the keypad waits, and the wait doubles each time (kept across reloads)
function lockState(): { fails: number; until: number } { try { return JSON.parse(localStorage.getItem('alradwan.lock') || '{"fails":0,"until":0}') } catch { return { fails: 0, until: 0 } } }
function saveLock(s: { fails: number; until: number }) { localStorage.setItem('alradwan.lock', JSON.stringify(s)) }

export function Login() {
  const users = useCollection('users')
  const settings = useSettings()
  const list = Array.from(users.values()).sort((a, b) => (a.role === b.role ? a.createdAt - b.createdAt : a.role === 'admin' ? -1 : 1))
  const [user, setUser] = useState<User | null>(list.length === 1 ? list[0] : null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(() => lockState().until)
  const [, tick] = useState(0)
  useEffect(() => { if (lockedUntil > Date.now()) { const t = setInterval(() => { tick(x => x + 1); if (Date.now() >= lockedUntil) setLockedUntil(0) }, 1000); return () => clearInterval(t) } }, [lockedUntil])

  const submit = async (p: string) => {
    if (!user || p.length < 4) return
    const lock = lockState()
    if (lock.until > Date.now()) { setLockedUntil(lock.until); return }
    setBusy(true)
    const ok = await verifyPin(p, user)
    if (ok && !user.pinSalt) {
      // an old record: store it the strong way from now on
      const h = await hashPin(p)
      await put('users', { ...user, pinHash: h.hash, pinSalt: h.salt, pinIterations: h.iterations })
    }
    setBusy(false)
    if (ok) {
      saveLock({ fails: 0, until: 0 })
      setCurrentUser(user.id)
      audit('login', `تسجيل دخول ${user.name}`, 'users', user.id).catch(() => {})
    } else {
      const fails = lock.fails + 1
      const until = fails >= 5 ? Date.now() + 30000 * 2 ** Math.min(6, fails - 5) : 0
      saveLock({ fails, until })
      if (until) { setLockedUntil(until); audit('login', `محاولات دخول فاشلة متكررة على حساب ${user.name}`, 'users', user.id).catch(() => {}) }
      setErr(fails >= 5 ? 'محاولات كثيرة خاطئة' : `الرقم السري غير صحيح (${fails} من 5)`); setPin('')
    }
  }
  const locked = lockedUntil > Date.now()
  const wait = Math.ceil((lockedUntil - Date.now()) / 1000)
  const press = (d: string) => { if (pin.length >= 8) return; const p = pin + d; setErr(''); setPin(p) }

  return (
    <div className="login">
      <div className="card pad">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="./icon.svg" alt="" style={{ width: 72, height: 72, borderRadius: 18 }} />
          <h1 style={{ marginTop: 8 }}>{settings.shopName}</h1>
          <p className="muted">{user ? `أهلاً ${user.name} — أدخل الرقم السري` : 'من أنت؟'}</p>
        </div>
        {!user && (
          <div className="users-grid">
            {list.map(u => <button key={u.id} onClick={() => setUser(u)}><span className={`avatar ${u.role === 'admin' ? 'tone-accent' : 'tone-info'}`}>{u.name.slice(0, 1)}</span>{u.name}<small className="muted">{u.role === 'admin' ? 'مدير' : 'موظف'}</small></button>)}
          </div>
        )}
        {user && (
          <>
            <div className="pin-dots">{[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pin.length)).map(i => <span key={i} className={i < pin.length ? 'on' : ''} />)}</div>
            {locked ? <div className="error" style={{ textAlign: 'center', marginBottom: 8 }}>محاولات كثيرة خاطئة — انتظر {wait} ثانية</div> : err && <div className="error" style={{ textAlign: 'center', marginBottom: 8 }}>{err}</div>}
            <div className="numpad" style={locked ? { opacity: .5, pointerEvents: 'none' } : undefined}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => press(d)}>{d}</button>)}
              <button onClick={() => setPin(p => p.slice(0, -1))} aria-label="مسح"><Delete /></button>
              <button onClick={() => press('0')}>0</button>
              <button onClick={() => submit(pin)} disabled={busy || locked || pin.length < 4} style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }} aria-label="دخول"><LogIn /></button>
            </div>
            <input type="password" inputMode="numeric" className="input mt" placeholder="أو اكتب الرقم السري هنا واضغط Enter" value={pin} dir="ltr" autoFocus
              onChange={e => { setErr(''); setPin(e.target.value.replace(/\D/g, '').slice(0, 8)) }} onKeyDown={e => { if (e.key === 'Enter') submit(pin) }} />
            {list.length > 1 && <button className="btn ghost block mt" onClick={() => { setUser(null); setPin('') }}>مستخدم آخر</button>}
          </>
        )}
      </div>
    </div>
  )
}
