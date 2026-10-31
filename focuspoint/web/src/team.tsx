// Team session (staff/admin). Customers never log in; only the team does, with phone + password.
// The token lives in localStorage ('fp_team_token') and api.ts attaches it automatically.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@shared/types'
import { api, ApiError, errorMessage, TOKEN_KEY } from './api'
import { normalisePhone } from './format'
import { Button, Card, Field, Input, Spinner, OfflineBar } from './ui'
import logoUrl from '@shared/logo.svg'
import { unlinkTeamPush } from './team/push'

const USER_KEY = 'fp_team_user'

export interface TeamContextValue {
  user: User | null
  token: string | null
  ready: boolean
  isAdmin: boolean
  login(phone: string, password: string): Promise<void>
  logout(): void
  refresh(): Promise<void>
}

const TeamContext = createContext<TeamContextValue | null>(null)

function readStored<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null } catch { return null }
}
function write(key: string, value: string | null) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } })
  const [user, setUser] = useState<User | null>(() => (token ? readStored<User>(USER_KEY) : null))
  const [ready, setReady] = useState(false)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const logout = useCallback(() => {
    write(TOKEN_KEY, null)
    write(USER_KEY, null)
    setToken(null)
    setUser(null)
    void unlinkTeamPush()   // after the token is gone: this phone stops getting the team's alerts
  }, [])

  const refresh = useCallback(async () => {
    if (!tokenRef.current) { setUser(null); return }
    try {
      const me = await api.get<User>('/v1/team/me')
      setUser(me)
      write(USER_KEY, JSON.stringify(me))
    } catch (err) {
      // Offline or server trouble: keep the cached account so the panel still works. Only a rejected token logs out.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) logout()
    }
  }, [logout])

  const login = useCallback(async (phone: string, password: string) => {
    const p = normalisePhone(phone)
    if (!p) throw new ApiError('رقم الهاتف غير صحيح (09XXXXXXXX)', 400)
    if (!password) throw new ApiError('أدخل كلمة المرور', 400)
    const res = await api.post<{ token: string; user: User }>('/v1/team/login', { phone: p, password })
    write(TOKEN_KEY, res.token)
    write(USER_KEY, JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
  }, [])

  useEffect(() => {
    let alive = true
    refresh().finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [refresh])

  const value = useMemo<TeamContextValue>(() => ({
    user, token, ready, isAdmin: user?.role === 'admin' && !user.disabled, login, logout, refresh,
  }), [user, token, ready, login, logout, refresh])

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error('useTeam must be used inside <TeamProvider>')
  return ctx
}

/** Renders children only for a signed-in team member; otherwise shows the login screen inline. */
export function RequireTeam({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, ready, isAdmin } = useTeam()
  if (!ready) return <div className="center" style={{ padding: 48 }}><Spinner /></div>
  if (!user) return <TeamLogin />
  if (adminOnly && !isAdmin) {
    return (
      <div className="container container-narrow" style={{ paddingTop: 48 }}>
        <Card>
          <h2 className="h2">هذه الصفحة للمدير فقط</h2>
          <p className="muted">حسابك لا يملك صلاحية الوصول إلى هنا.</p>
        </Card>
      </div>
    )
  }
  return <>{children}</>
}

function TeamLogin() {
  const { login } = useTeam()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try { await login(phone, password) } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <div className="login-screen">
      <OfflineBar />
      <form className="login-card" onSubmit={submit} noValidate>
        <img src={logoUrl} alt="" width={64} height={64} className="login-logo" />
        <h1 className="h1" style={{ marginBottom: 4 }}>فريق العمل</h1>
        <p className="muted" style={{ marginBottom: 20 }}>سجّل الدخول لإدارة الحجوزات</p>
        <Field label="رقم الهاتف">
          <Input type="tel" inputMode="tel" autoComplete="username" dir="ltr" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
        </Field>
        <Field label="كلمة المرور" error={error ?? undefined}>
          <Input type={show ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 18px', fontSize: 14 }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> إظهار كلمة المرور
        </label>
        <Button type="submit" block size="lg" loading={busy}>دخول</Button>
        <a href="/book" className="login-back muted">← رجوع إلى صفحة الحجز</a>
      </form>
    </div>
  )
}
