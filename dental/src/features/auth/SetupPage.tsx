import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react'
import { Button, useConfirm, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { ToothIcon } from '@/app/ToothIcon'
import { db, logActivity, updateClinic } from '@/db'
import { newId, nowISO } from '@/db/ids'
import type { Lang, User } from '@/db/types'
import { hashPin, randomHex } from '@/lib/crypto'
import { onBackButton } from '@/platform'
import { AcceptTerms, acceptTerms } from '@/features/legal'
import { seedDefaults } from '@/features/seed/demo'
import { restartApp, restoreBackup } from '@/features/settings/backup'
import type { ReadResult } from '@/features/settings/backup/archive'
import { BackupProgressModal, backupErrorText, namesLine, useBackupReader } from '@/features/settings/backup/ui'
import {
  CURRENCIES, buildClinicPatch, ownerTitleFor, validateClinicStep, validateMoneyStep, validateOwnerStep,
  type ClinicDraft, type Errors, type MoneyDraft, type OwnerDraft,
} from './lib'
import { ClinicStep, LanguageStep, MoneyStep, OWNER_COLOR, OwnerStep, ReviewStep } from './SetupSteps'
import './auth.css'

const STEPS = ['language', 'clinic', 'money', 'owner', 'review'] as const
const TITLES: Record<(typeof STEPS)[number], [string, string]> = {
  language: ['auth.setup.welcome', 'auth.setup.welcomeSub'],
  clinic: ['auth.clinic.title', 'auth.clinic.desc'],
  money: ['auth.money.title', 'auth.money.desc'],
  owner: ['auth.owner.title', 'auth.owner.desc'],
  review: ['auth.review.title', 'auth.review.desc'],
}

/**
 * First-run wizard: language, clinic, currency/hours/country, the admin user and PIN, then a review where the terms of
 * use and the privacy policy are accepted. Sets clinic.setupDone = true. The Android Back key steps back through it.
 */
export default function SetupPage() {
  const { t, lang, setLang } = useI18n()
  const session = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const userId = useMemo(() => newId(), [])
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleTouched = useRef(false)
  const finishing = useRef(false)   // a second Enter / click while the first finish is still writing must not run it again

  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(0)
  const [tried, setTried] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [clinic, setClinic] = useState<ClinicDraft>({ name: '', phone: '', address: '', email: '' })
  const [money, setMoney] = useState<MoneyDraft>({
    currency: CURRENCIES[0].code, customCode: '', customSymbol: '', decimals: CURRENCIES[0].decimals,
    workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, taxPercent: null,
  })
  const [owner, setOwner] = useState<OwnerDraft>(() => ({ name: '', title: ownerTitleFor(lang), specialty: '', phone: '', pin: '', pin2: '' }))
  const [accepted, setAccepted] = useState(false)

  const errorsOf = (i: number): Errors => (
    i === 1 ? validateClinicStep(clinic) : i === 2 ? validateMoneyStep(money) : i === 3 ? validateOwnerStep(owner)
      : i === STEPS.length - 1 && !accepted ? { terms: 'auth.v.terms' } : {})
  const validUpTo = (i: number) => { for (let s = 0; s < i; s++) if (Object.keys(errorsOf(s)).length) return false; return true }
  const errors = errorsOf(step)
  const err = (f: string) => (tried[step] && errors[f] ? t(errors[f]) : undefined)
  const last = step === STEPS.length - 1
  const key = STEPS[step]

  const go = (i: number) => {
    setStep(i)
    setReached(r => Math.max(r, i))
    window.scrollTo({ top: 0 })
    // a field with autoFocus (the name on the owner step) has already taken focus; otherwise the step's first field gets it
    requestAnimationFrame(() => {
      const body = bodyRef.current
      if (!body || body.contains(document.activeElement)) return
      body.querySelector<HTMLElement>('input:not([type=hidden]), select')?.focus({ preventScroll: true })
    })
  }
  // the Android Back key goes back a step (after closing any open dialog); on the first step it leaves the app
  useEffect(() => onBackButton(() => {
    if (busy || finishing.current) return true
    if (step > 0) { go(step - 1); return true }
    return false
  }), [step, busy])  // eslint-disable-line react-hooks/exhaustive-deps

  const pickLang = (l: Lang) => {
    setLang(l)
    // the owner's title follows the language until it is chosen by hand
    if (!titleTouched.current) setOwner(o => ({ ...o, title: ownerTitleFor(l) }))
  }

  const next = (e?: FormEvent) => {
    e?.preventDefault()
    if (busy || finishing.current) return
    if (Object.keys(errors).length) {
      setTried(m => ({ ...m, [step]: true }))
      requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('.invalid, [aria-invalid="true"]')?.focus())
      return
    }
    if (last) void finish()
    else go(step + 1)
  }

  const finish = async () => {
    if (finishing.current) return
    for (let s = 0; s < STEPS.length; s++) if (Object.keys(errorsOf(s)).length) { setTried(m => ({ ...m, [s]: true })); go(s); return }
    finishing.current = true
    setBusy(true)
    try {
      const now = nowISO()
      const salt = randomHex()
      const user: User = {
        id: userId, name: owner.name.trim(), title: owner.title || undefined, role: 'admin',
        specialty: owner.specialty.trim() || undefined, phone: owner.phone.trim() || undefined,
        pinSalt: salt, pinHash: await hashPin(owner.pin, salt), color: OWNER_COLOR, active: true, createdAt: now, updatedAt: now,
      }
      // clinic + owner land together; setupDone flips last, once the owner is signed in, so the gate goes straight to the dashboard
      await db.transaction('rw', db.clinic, db.users, async () => {
        await updateClinic({ ...buildClinicPatch(lang, clinic, money), setupDone: false })
        await db.users.put(user)
      })
      // the terms of use and the privacy policy the owner accepted on the review step (version and date, by whom)
      await acceptTerms(userId)
      try { await seedDefaults() } catch { /* default procedures/drugs are a convenience; the clinic works without them */ }
      const ok = await session.login(userId, owner.pin)
      await updateClinic({ setupDone: true })
      void logActivity({ type: 'system', action: 'create', entityId: userId, message: t('auth.setup.activity'), by: userId })
      navigate(ok ? '/' : '/login', { replace: true })
    } catch {
      toast.error(t('auth.setup.failed'))
      finishing.current = false
      setBusy(false)
    }
  }

  // Restore from a backup (a reinstall or a new device): the same reading, checks and all-or-nothing restore as
  // Settings → Backup, including password-protected backups. This device keeps its activation and its trial start.
  const applyRestore = async (file: File, r: ReadResult) => {
    const damaged = r.info.damaged
    if (damaged.length) {
      const ok = await confirm({
        title: t('backup.damagedTitle', { n: damaged.length }),
        description: t('backup.damagedDesc', { n: damaged.length, names: namesLine(damaged) }),
        confirmLabel: t('backup.restoreRest'),
      })
      if (!ok) return
    }
    setRestoring(true)
    try {
      await restoreBackup(r.data, { neededBytes: Math.max(file.size, r.info.fileBytes) })
      toast.success(t('auth.restore.done'), t('auth.restore.doneSub'))
      window.setTimeout(() => restartApp('/'), 1200)
    } catch (e) {
      toast.error(backupErrorText(t, e) ?? t('backup.err.failed'))
      setRestoring(false)
    }
  }
  const reader = useBackupReader({ onRead: (file, r) => void applyRestore(file, r), onError: message => toast.error(message) })
  const restore = () => { if (!restoring) void reader.choose() }

  return (
    <div className="auth-screen au-setup-screen">
      <div className="auth-card wide au-setup">
        <div className="au-setup-head">
          <div className="au-brand-mark"><ToothIcon /></div>
          <div className="grow"><div className="au-brand-name">{t('appName')}</div><div className="au-brand-sub">{t('appTagline')}</div></div>
          <div className="au-step-count" data-qa="step-count">{t('auth.setup.stepOf', { n: step + 1, total: STEPS.length })}</div>
        </div>

        <ol className="au-steps" aria-label={t('auth.setup.stepOf', { n: step + 1, total: STEPS.length })}>
          {STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'current' : ''
            const reachable = i < step || (i > step && i <= reached && validUpTo(i))
            return (
              <li key={s} className={state} aria-current={i === step ? 'step' : undefined}>
                <button type="button" disabled={!reachable || busy} onClick={() => go(i)} title={t(`auth.step.${s}`)}>
                  <span className="au-step-dot">{i < step ? <Check /> : <span className="num">{i + 1}</span>}</span>
                  <span className="au-step-label">{t(`auth.step.${s}`)}</span>
                </button>
              </li>
            )
          })}
        </ol>

        <form className="au-setup-form" onSubmit={next} noValidate>
          <div className="au-step" key={step} ref={bodyRef} data-step={key}>
            <h1 className="au-step-title">{t(TITLES[key][0])}</h1>
            <p className="au-step-desc">{t(TITLES[key][1])}</p>
            <div className="au-step-body">
              {key === 'language' && <LanguageStep lang={lang} onPick={pickLang} onRestore={restore} restoring={restoring || reader.busy} />}
              {key === 'clinic' && <ClinicStep value={clinic} onChange={setClinic} err={err} />}
              {key === 'money' && <MoneyStep value={money} onChange={setMoney} err={err} />}
              {key === 'owner' && <OwnerStep value={owner} onChange={setOwner} err={err} onTitleTouched={() => { titleTouched.current = true }} />}
              {key === 'review' && <>
                <ReviewStep lang={lang} clinic={clinic} money={money} owner={owner} onEdit={go} />
                <div className="au-terms" data-qa="setup-terms">
                  <AcceptTerms checked={accepted} onChange={setAccepted} error={err('terms')} links={['terms', 'privacy', 'notices']} />
                </div>
              </>}
            </div>
          </div>
          <div className="au-setup-foot">
            {step > 0 && <Button variant="ghost" size="lg" icon={<ArrowLeft className="au-flip" />} onClick={() => go(step - 1)} disabled={busy} className="au-back">{t('back')}</Button>}
            <Button type="submit" variant="primary" size="lg" className="au-next" loading={busy} disabled={restoring}
              icon={last ? <Rocket /> : undefined} iconEnd={last ? undefined : <ArrowRight className="au-flip" />} data-qa="next">
              {last ? (busy ? t('auth.setup.starting') : t('auth.setup.start')) : t('next')}
            </Button>
          </div>
        </form>
      </div>
      {reader.element}
      <BackupProgressModal open={restoring} title={t('backup.restoring')} state={{ stage: 'apply' }} />
    </div>
  )
}
