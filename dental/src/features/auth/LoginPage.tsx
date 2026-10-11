import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HelpCircle, Keyboard, Lock, UserX, UsersRound } from 'lucide-react'
import { Avatar, Button, EmptyState, IconBox } from '@/ui'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useClinic, useIsDesktop } from '@/app/hooks'
import { ToothIcon } from '@/app/ToothIcon'
import { fmtDate } from '@/lib/dates'
import { appVersion } from '@/platform'
import { todayISO } from '@/db/ids'
import { sortStaff } from '@/features/staff/lib'
import {
  FRESH_GUARD, PIN_MAX, PIN_MIN, attemptsLeft, displayName, formatCountdown, greetingKey, isLocked, lockRemaining, normalizeDigits, normalizeGuard, parseGuard,
  plainName, registerFailure, type LoginGuard,
} from './lib'
import { PinDots, PinPad } from './PinPad'
import './auth.css'

const LAST_USER = 'dentora.lastUser'
const GUARD = 'dentora.loginGuard'
const readLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const writeLS = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private mode */ } }

/** Pick a user, enter the PIN. Uses useSession().login(userId, pin). */
export default function LoginPage() {
  const { t, lang } = useI18n()
  const session = useSession()
  const clinic = useClinic()
  const desktop = useIsDesktop()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/'

  const users = useMemo(() => sortStaff(session.users.filter(u => u.active)), [session.users])
  const [lastId] = useState(() => readLS(LAST_USER))
  const [pickedId, setPickedId] = useState<string | null>(lastId)
  const [choosing, setChoosing] = useState(false)
  const picked = users.length === 1 ? users[0] : users.find(u => u.id === pickedId) ?? null
  const mode: 'none' | 'users' | 'pin' = users.length === 0 ? 'none' : !picked || choosing ? 'users' : 'pin'

  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState<{ text: string; sub?: string } | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [forgot, setForgot] = useState(false)
  const [guard, setGuard] = useState<LoginGuard>(() => parseGuard(readLS(GUARD)))
  const [now, setNow] = useState(() => Date.now())
  const locked = isLocked(guard, now)

  // tick while locked; when the lock runs out, a fresh round of attempts starts
  useEffect(() => {
    if (!locked) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [locked])
  useEffect(() => {
    if (locked || !guard.until) return
    const g = normalizeGuard(guard, Date.now())
    setGuard(g); writeLS(GUARD, g === FRESH_GUARD ? null : JSON.stringify(g)); setMsg(null)
  }, [locked, guard])

  const pick = (id: string) => { setPickedId(id); setChoosing(false); setPin(''); setMsg(null); setForgot(false) }

  const submit = useCallback(async (value: string) => {
    if (!picked || busyRef.current || isLocked(guard, Date.now())) return
    if (value.length < PIN_MIN) { setMsg({ text: t('auth.login.short') }); setShake(s => s + 1); return }
    busyRef.current = true; setBusy(true)
    let ok = false
    try { ok = await session.login(picked.id, value) } catch { /* treated as a failed attempt below */ }
    if (ok) {
      writeLS(GUARD, null); writeLS(LAST_USER, picked.id)
      navigate(from, { replace: true })
      return
    }
    const at = Date.now()
    const g = registerFailure(guard, at)
    setGuard(g); writeLS(GUARD, JSON.stringify(g)); setNow(at)
    setPin(''); setShake(s => s + 1)
    busyRef.current = false; setBusy(false)
    const left = attemptsLeft(g, at)
    setMsg(isLocked(g, at) ? null : {
      text: t('auth.login.wrong'),
      sub: left === 1 ? t('auth.login.left1') : left === 2 ? t('auth.login.left2') : left <= 3 ? t('auth.login.leftN', { n: left }) : undefined,
    })
  }, [picked, guard, session, navigate, from, t])

  const press = useCallback((d: string) => {
    if (busyRef.current || locked) return
    setMsg(null)
    setPin(p => (p.length >= PIN_MAX ? p : p + d))
  }, [locked])
  const backspace = useCallback(() => { if (!busyRef.current && !locked) setPin(p => p.slice(0, -1)) }, [locked])
  const clear = useCallback(() => { if (!busyRef.current && !locked) { setPin(''); setMsg(null) } }, [locked])

  // six digits: no need to press anything
  useEffect(() => { if (pin.length === PIN_MAX) void submit(pin) }, [pin]) // submit is read fresh from this render

  // physical keyboard: digits (Latin or Arabic-Indic), Backspace, Escape/Delete to clear, Enter to sign in
  useEffect(() => {
    if (mode !== 'pin') return
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const d = normalizeDigits(e.key)
      if (/^\d$/.test(d)) { e.preventDefault(); press(d) }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace() }
      else if (e.key === 'Escape' || e.key === 'Delete') clear()
      else if (e.key === 'Enter') {
        // Enter on a focused link/button outside the keypad ("switch user", "forgot PIN?") activates it; anywhere else it signs in
        const el = e.target as HTMLElement | null
        if (el?.closest('button, a') && !el.closest('.pin-pad')) return
        e.preventDefault(); void submit(pin)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [mode, pin, press, backspace, clear, submit])

  const cols = users.length <= 4 ? Math.max(2, users.length) : users.length <= 6 ? 3 : 4
  const greeting = t(greetingKey(new Date().getHours()))
  const lockLeft = formatCountdown(lockRemaining(guard, now))

  return (
    <div className="auth-screen au-login">
      <div className="au-login-brand">
        <div className={`auth-logo${clinic.logo ? ' au-logo-img' : ''}`}>{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon />}</div>
        <h1 className="au-clinic-name">{clinic.name || t('appName')}</h1>
        <div className="au-today">{greeting} · {fmtDate(todayISO(), lang, 'weekday')}</div>
      </div>

      <div className="auth-card au-login-card" data-mode={mode} style={{ ['--cols' as string]: cols }}>
        {mode === 'none' && <EmptyState compact icon={<UserX />} title={t('auth.login.noUsers')} description={t('auth.login.noUsersSub')} />}

        {mode === 'users' && (
          <>
            <div className="au-who-title">{t('auth.login.whoTitle')}</div>
            <div className="au-who-sub">{t('auth.login.whoSub')}</div>
            <div className="user-pick">
              {users.map(u => (
                <button key={u.id} type="button" className={`au-tile${u.id === lastId ? ' au-last' : ''}`} onClick={() => pick(u.id)} data-user={u.id}>
                  <Avatar name={plainName(u.name)} color={u.color} size="lg" />
                  <span className="u-name" dir="auto" title={displayName(u)}>{displayName(u)}</span>
                  <span className="u-role">{t(`role.${u.role}`)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {mode === 'pin' && picked && (
          <div className="au-pin-layout">
            <div className="au-pin-user">
              <Avatar name={plainName(picked.name)} color={picked.color} size="xl" />
              <div className="au-pin-name">{displayName(picked)}</div>
              <div className="au-pin-role">{t(`role.${picked.role}`)}</div>
              {users.length > 1 && <button type="button" className="au-link" onClick={() => { setChoosing(true); setPin(''); setMsg(null) }} data-qa="change-user"><UsersRound />{t('auth.login.changeUser')}</button>}
            </div>
            <div className="au-pin-main">
              <div className="au-pin-title">{t('auth.login.pinTitle')}</div>
              <PinDots length={pin.length} error={!!msg && !pin} shake={shake} />
              <div className="au-pin-msg" aria-live="polite">
                {locked ? (
                  <div className="au-lock" role="alert">
                    <IconBox><Lock /></IconBox>
                    <span>{t('auth.login.locked')}<span className="au-sub">{t('auth.login.lockedFor')} <span className="num">{lockLeft}</span></span></span>
                  </div>
                ) : msg ? (
                  <><span className="au-err" role="alert">{msg.text}</span>{msg.sub && <span className="au-sub">{msg.sub}</span>}</>
                ) : desktop ? (
                  <span className="au-kbd-hint"><Keyboard />{t('auth.login.keyboard')}</span>
                ) : null}
              </div>
              <PinPad onDigit={press} onBack={backspace} onClear={clear} disabled={locked || busy} />
              <Button variant="primary" size="lg" block className="au-submit" disabled={pin.length < PIN_MIN || locked} loading={busy} onClick={() => void submit(pin)} data-qa="submit">
                {t('auth.login.submit')}
              </Button>
            </div>
            <div className="au-forgot-wrap">
              <button type="button" className="au-link au-forgot" onClick={() => setForgot(f => !f)} aria-expanded={forgot}><HelpCircle />{t('auth.login.forgot')}</button>
              {forgot && <div className="au-forgot-box"><span>{t('auth.login.forgotStaff')}</span><span className="muted">{t('auth.login.forgotAdmin')}</span></div>}
            </div>
          </div>
        )}
      </div>

      <div className="au-login-foot"><ToothIcon size={14} /><span>{t('appName')}</span><span className="au-dot" /><span>{t('auth.login.version')} <span className="num">{appVersion()}</span></span></div>
    </div>
  )
}
