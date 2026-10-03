import { useEffect, useState } from 'react'
import { Delete, KeyRound, LogIn } from 'lucide-react'
import { audit, put, setCurrentUser, useCollection, useSettings } from '../db/store'
import { hashPin, verifyPin } from '../lib/crypto'
import { checkRecovery } from '../lib/recovery'
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
  const [recover, setRecover] = useState(false)
  const [rCode, setRCode] = useState(''); const [rPin, setRPin] = useState(''); const [rPin2, setRPin2] = useState('')
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
  // the owner forgot the PIN: the recovery code written down at setup sets a new one (same lockout as wrong PINs)
  const resetWithCode = async () => {
    setErr('')
    const lock = lockState()
    if (lock.until > Date.now()) { setLockedUntil(lock.until); return }
    if (!settings.recovery) { setErr('لم يُنشأ رمز استرجاع لهذا البرنامج. استعد نسخة احتياطية، أو تواصل مع البائع.'); return }
    if (rPin.length < 4 || rPin !== rPin2) { setErr('الرقم السري الجديد 4 أرقام على الأقل، ومطابق في الحقلين'); return }
    setBusy(true)
    const ok = await checkRecovery(rCode, settings.recovery)
    if (!ok) {
      setBusy(false)
      const fails = lock.fails + 1
      const until = fails >= 5 ? Date.now() + 30000 * 2 ** Math.min(6, fails - 5) : 0
      saveLock({ fails, until }); if (until) setLockedUntil(until)
      setErr(`رمز الاسترجاع غير صحيح (${Math.min(fails, 5)} من 5)`); return
    }
    const admin = user?.role === 'admin' ? user : list.find(u => u.role === 'admin')
    if (!admin) { setBusy(false); setErr('لا يوجد مدير في البرنامج.'); return }
    const h = await hashPin(rPin)
    await put('users', { ...admin, pinHash: h.hash, pinSalt: h.salt, pinIterations: h.iterations })
    setBusy(false)
    saveLock({ fails: 0, until: 0 })
    setCurrentUser(admin.id)
    audit('update', `إعادة ضبط الرقم السري للمدير ${admin.name} برمز الاسترجاع`, 'users', admin.id).catch(() => {})
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
          <p className="muted">{recover ? 'استرجاع الدخول برمز الاسترجاع' : user ? `أهلاً ${user.name} — أدخل الرقم السري` : 'من أنت؟'}</p>
        </div>
        {recover && (
          <div className="stack">
            <p className="help">اكتب رمز الاسترجاع الذي ظهر عند تجهيز البرنامج (12 حرفاً ورقماً)، ثم اختر رقماً سرياً جديداً للمدير.</p>
            <input className="input mono" dir="ltr" placeholder="XXXX-XXXX-XXXX" value={rCode} onChange={e => { setErr(''); setRCode(e.target.value.toUpperCase()) }} autoFocus autoCapitalize="characters" spellCheck={false} />
            <input className="input" type="password" inputMode="numeric" dir="ltr" placeholder="الرقم السري الجديد" value={rPin} onChange={e => setRPin(e.target.value.replace(/\D/g, '').slice(0, 8))} />
            <input className="input" type="password" inputMode="numeric" dir="ltr" placeholder="تأكيد الرقم السري" value={rPin2} onChange={e => setRPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={e => { if (e.key === 'Enter') resetWithCode() }} />
            {locked ? <div className="error">محاولات كثيرة خاطئة — انتظر {wait} ثانية</div> : err && <div className="error">{err}</div>}
            <button className="btn primary block" onClick={resetWithCode} disabled={busy || locked}><KeyRound /> تعيين الرقم السري والدخول</button>
            <button className="btn ghost block" onClick={() => { setRecover(false); setErr('') }}>رجوع</button>
          </div>
        )}
        {!recover && !user && (
          <div className="users-grid">
            {list.map(u => <button key={u.id} onClick={() => setUser(u)}><span className={`avatar ${u.role === 'admin' ? 'tone-accent' : 'tone-info'}`}>{u.name.slice(0, 1)}</span>{u.name}<small className="muted">{u.role === 'admin' ? 'مدير' : 'موظف'}</small></button>)}
          </div>
        )}
        {!recover && user && (
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
            {user.role === 'admin'
              ? <button className="btn ghost block mt" onClick={() => { setRecover(true); setErr(''); setPin('') }}>نسيت الرقم السري؟</button>
              : <p className="help mt" style={{ textAlign: 'center' }}>نسيت رقمك؟ يغيّره لك المدير من الإعدادات.</p>}
          </>
        )}
      </div>
    </div>
  )
}
