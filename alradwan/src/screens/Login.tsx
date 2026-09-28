import { useState } from 'react'
import { Delete, LogIn } from 'lucide-react'
import { setCurrentUser, useCollection, useSettings } from '../db/store'
import { sha256 } from '../lib/id'
import type { User } from '../db/types'

export function Login() {
  const users = useCollection('users')
  const settings = useSettings()
  const list = Array.from(users.values()).sort((a, b) => (a.role === b.role ? a.createdAt - b.createdAt : a.role === 'admin' ? -1 : 1))
  const [user, setUser] = useState<User | null>(list.length === 1 ? list[0] : null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (p: string) => {
    if (!user || p.length < 4) return
    setBusy(true)
    const h = await sha256(p)
    setBusy(false)
    if (h === user.pinHash) { setCurrentUser(user.id) } else { setErr('الرقم السري غير صحيح'); setPin('') }
  }
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
            {err && <div className="error" style={{ textAlign: 'center', marginBottom: 8 }}>{err}</div>}
            <div className="numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <button key={d} onClick={() => press(d)}>{d}</button>)}
              <button onClick={() => setPin(p => p.slice(0, -1))} aria-label="مسح"><Delete /></button>
              <button onClick={() => press('0')}>0</button>
              <button onClick={() => submit(pin)} disabled={busy || pin.length < 4} style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }} aria-label="دخول"><LogIn /></button>
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
