import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Copy, HelpCircle, KeyRound, Keyboard, Lock, UserX, UsersRound } from 'lucide-react'
import { Avatar, Button, EmptyState, IconBox, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useClinic, useIsDesktop } from '@/app/hooks'
import { ToothIcon } from '@/app/ToothIcon'
import { tPlural } from '@/app/plural'
import { fmtDate } from '@/lib/dates'
import { pinLengthOf } from '@/lib/crypto'
import { appVersion } from '@/platform'
import { todayISO } from '@/db/ids'
import { useLicense } from '@/license/useLicense'
import { copyText } from '@/features/settings/parts'
import { sortStaff } from '@/features/staff/lib'
import {
  FRESH_GUARD, PIN_MAX, PIN_MIN, attemptsLeft, autoSubmitLength, displayName, formatCountdown, greetingKey, isLocked, lockRemaining, normalizeDigits,
  normalizeGuard, plainName, type LoginGuard,
} from './lib'
import { useLoginGuard } from './guardStore'
import { PinDots, PinPad } from './PinPad'
import './auth.css'

const ResetWithCodeModal = lazy(() => import('./ResetWithCodeModal'))

const LAST_USER = 'dentora.lastUser'
const readLS = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const writeLS = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private mode */ } }

/** Pick a user, enter the PIN. Uses useSession().attempt(userId, pin); the lockout is enforced there too. */
export default function LoginPage() {
  const { t, lang } = useI18n()
  const session = useSession()
  const clinic = useClinic()
  const license = useLicense()
  const desktop = useIsDesktop()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/'

  const users = useMemo(() => sortStaff(session.users.filter(u => u.active)), [session.users])
  const [lastId] = useState(() => readLS(LAST_USER))
  const [pickedId, setPickedId] = useState<string | null>(lastId)
  const [choosing, setChoosing] = useState(false)
  const picked = users.length === 1 ? users[0] : users.find(u => u.id === pickedId) ?? null
  const mode: 'none' | 'users' | 'pin' = users.length === 0 ? 'none' : !picked || choosing ? 'users' : 'pin'
  const submitAt = autoSubmitLength(pinLengthOf(picked?.pinHash))

  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState<{ text: string; sub?: string } | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [forgot, setForgot] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  // the lockout of the picked user, as stored (it survives reloads and restarts); the licence clock never runs back
  const stored = useLoginGuard(picked?.id)
  const [now, setNow] = useState(() => license.now())
  const guard: LoginGuard = normalizeGuard(stored ?? FRESH_GUARD, now)
  const locked = isLocked(guard, now)

  // tick while locked; when the lock runs out the stored guard is read again and a fresh round starts
  useEffect(() => {
    if (!locked) return
    const id = window.setInterval(() => setNow(license.now()), 250)
    return () => window.clearInterval(id)
  }, [locked, license])

  const pick = (id: string) => { setPickedId(id); setChoosing(false); setPin(''); setMsg(null); setForgot(false) }

  const submit = useCallback(async (value: string) => {
    if (!picked || busyRef.current || isLocked(guard, license.now())) return
    if (value.length < PIN_MIN) { setMsg({ text: t('auth.login.short') }); setShake(s => s + 1); return }
    busyRef.current = true; setBusy(true)
    let result: { ok: boolean; guard: LoginGuard } = { ok: false, guard }
    try { result = await session.attempt(picked.id, value) } catch { /* counted as a wrong attempt by the session */ }
    if (result.ok) {
      writeLS(LAST_USER, picked.id)
      navigate(from, { replace: true })
      return
    }
    const at = license.now()
    setNow(at)
    setPin(''); setShake(s => s + 1)
    busyRef.current = false; setBusy(false)
    const left = attemptsLeft(result.guard, at)
    setMsg(isLocked(result.guard, at) ? null : {
      text: t('auth.login.wrong'),
      sub: left === 1 ? t('auth.login.left1') : left === 2 ? t('auth.login.left2') : left <= 3 ? t('auth.login.leftN', { n: left }) : undefined,
    })
  }, [picked, guard, session, navigate, from, t, license])

  const press = useCallback((d: string) => {
    if (busyRef.current || locked) return
    setMsg(null)
    setPin(p => (p.length >= PIN_MAX ? p : p + d))
  }, [locked])
  const backspace = useCallback(() => { if (!busyRef.current && !locked) setPin(p => p.slice(0, -1)) }, [locked])
  const clear = useCallback(() => { if (!busyRef.current && !locked) { setPin(''); setMsg(null) } }, [locked])

  // the user's whole PIN typed (4, 5 or 6 digits): no need to press anything
  useEffect(() => { if (pin.length === submitAt) void submit(pin) }, [pin]) // submit is read fresh from this render

  // physical keyboard: digits (Latin or Arabic-Indic), Backspace, Escape/Delete to clear, Enter to sign in
  useEffect(() => {
    if (mode !== 'pin' || resetOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable="true"]')) return
      const d = normalizeDigits(e.key)
      if (/^\d$/.test(d)) { e.preventDefault(); press(d) }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace() }
      else if (e.key === 'Escape' || e.key === 'Delete') clear()
      else if (e.key === 'Enter') {
        // Enter on a focused link/button outside the keypad ("switch user", "forgot PIN?") activates it; anywhere else it signs in
        if (el?.closest('button, a') && !el.closest('.pin-pad')) return
        e.preventDefault(); void submit(pin)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [mode, pin, press, backspace, clear, submit, resetOpen])

  const copyDevice = async () => {
    if (await copyText(license.device)) toast.success(t('auth.login.deviceCopied'))
    else toast.error(t('auth.login.copyFailed'))
  }
  const afterReset = async (userId: string, newPin: string) => {
    setResetOpen(false)
    toast.success(t('auth.reset.done'))
    const ok = await session.login(userId, newPin)
    if (ok) { writeLS(LAST_USER, userId); navigate(from, { replace: true }) }
    else { setPickedId(userId); setChoosing(false); setPin('') }
  }

  const cols = users.length <= 4 ? Math.max(2, users.length) : users.length <= 6 ? 3 : 4
  const greeting = t(greetingKey(new Date().getHours()))
  const lockLeft = formatCountdown(lockRemaining(guard, now))
  const recovery = (
    <div className="au-forgot-box" data-qa="forgot-box">
      {mode !== 'none' && <span>{t('auth.login.forgotStaff')}</span>}
      <span className="muted">{t('auth.login.forgotAdmin')}</span>
      <div className="au-device-row">
        <span className="au-device-label">{t('auth.login.deviceNo')}</span>
        <span className="au-device-no ltr" data-qa="login-device">{license.device || '—'}</span>
        <Button variant="ghost" size="sm" icon={<Copy />} onClick={() => void copyDevice()} disabled={!license.device} aria-label={t('auth.login.copyDevice')} title={t('auth.login.copyDevice')} />
      </div>
      <Button variant="secondary" icon={<KeyRound />} onClick={() => setResetOpen(true)} disabled={!license.device} data-qa="have-reset-code">{t('auth.login.haveCode')}</Button>
    </div>
  )

  return (
    <div className="auth-screen au-login">
      <div className="au-login-brand">
        <div className={`auth-logo${clinic.logo ? ' au-logo-img' : ''}`}>{clinic.logo ? <img src={clinic.logo} alt="" /> : <ToothIcon />}</div>
        <h1 className="au-clinic-name">{clinic.name || t('appName')}</h1>
        <div className="au-today">{greeting} · {fmtDate(todayISO(), lang, 'weekday')}</div>
      </div>

      <div className="auth-card au-login-card" data-mode={mode} style={{ ['--cols' as string]: cols }}>
        {mode === 'none' && (
          <>
            <EmptyState compact icon={<UserX />} title={t('auth.login.noUsers')} description={t('auth.login.noUsersSub')} />
            {recovery}
          </>
        )}

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
              <div className="au-pin-who">
                <div className="au-pin-name" dir="auto">{displayName(picked)}</div>
                <div className="au-pin-role">{t(`role.${picked.role}`)}</div>
              </div>
              {users.length > 1 && <button type="button" className="au-link" onClick={() => { setChoosing(true); setPin(''); setMsg(null) }} data-qa="change-user"><UsersRound />{t('auth.login.changeUser')}</button>}
            </div>
            <div className="au-pin-main">
              <div className="au-pin-title">{t('auth.login.pinTitle')}</div>
              <PinDots length={pin.length} total={pinLengthOf(picked.pinHash)} label={tPlural(t, lang, 'auth.login.dotsLabel', pin.length)} error={!!msg && !pin} shake={shake} />
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
              <button type="button" className="au-link au-forgot" onClick={() => setForgot(f => !f)} aria-expanded={forgot} data-qa="forgot"><HelpCircle />{t('auth.login.forgot')}</button>
              {forgot && recovery}
            </div>
          </div>
        )}
      </div>

      <div className="au-login-foot"><ToothIcon size={14} /><span>{t('appName')}</span><span className="au-dot" /><span>{t('auth.login.version')} <span className="num">{appVersion()}</span></span></div>

      {resetOpen && (
        <Suspense fallback={null}>
          <ResetWithCodeModal device={license.device} users={session.users} now={license.now} onClose={() => setResetOpen(false)} onDone={afterReset} />
        </Suspense>
      )}
    </div>
  )
}
