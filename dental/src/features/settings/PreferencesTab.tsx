import { useState, type FormEvent } from 'react'
import { CalendarClock, Check, Hash, Languages, LockKeyhole, Moon, Palette, Sun, Type } from 'lucide-react'
import { Alert, Badge, Button, Chip, Input, Select, Card, CardBody, CardFooter, useToast } from '@/ui'
import { translate, useI18n } from '@/i18n'
import { db, logActivity, updateClinic } from '@/db'
import type { Lang } from '@/db/types'
import { useClinicMaybe } from '@/app/hooks'
import { applyFont, currentFont, FONT_OPTIONS, type FontKey } from '@/app/theme'
import { weekdayName } from '@/lib/dates'
import { toggleDay, WEEK_ORDER } from '@/features/auth/lib'
import {
  DEFAULT_FONT, DURATION_CHOICES, FONT_FAMILIES, FONT_SAMPLE_AMOUNT, LOCK_KEY, LOCK_OPTIONS, SLOT_CHOICES,
  hasErrors, hoursDraftFrom, hoursPerDay, lockMinutes, lockMs, validateHours, type FieldErrors,
} from './lib'
import { LockedNotice, OptionCard, SectionTitle, TabSkeleton, useAccess, useDraft, useErrText, useSingleFlight, useUnsavedGuard } from './parts'

function readLock(): number {
  try { return lockMinutes(localStorage.getItem(LOCK_KEY)) } catch { return lockMinutes(null) }
}
/**
 * Makes a new auto-lock delay count from now instead of from the next sign-in. The session re-reads
 * 'dentora.lockAfter' whenever the signed-in user's record is re-read, so writing that row back unchanged
 * re-arms its inactivity timer. The event is for a session that listens for the change directly.
 */
async function applyLockNow(userId?: string): Promise<void> {
  try { window.dispatchEvent(new CustomEvent('dentora:lockAfter')) } catch { /* old WebView */ }
  if (!userId) return
  try {
    await db.transaction('rw', db.users, async () => { const u = await db.users.get(userId); if (u) await db.users.put(u) })
  } catch { /* the next sign-in picks it up */ }
}

export default function PreferencesTab() {
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const access = useAccess()
  const clinic = useClinicMaybe()
  const [font, setFont] = useState<FontKey>(currentFont)
  const [lock, setLock] = useState<number>(readLock)
  const hours = useDraft(clinic, hoursDraftFrom)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [savingHours, setSavingHours] = useState(false)
  const errText = useErrText()
  const once = useSingleFlight()
  useUnsavedGuard(hours.dirty)

  if (!clinic || !hours.draft) return <TabSkeleton cards={3} />
  const h = hours.draft
  const theme = clinic.theme === 'dark' ? 'dark' : 'light'
  // Language, theme and hours are clinic-wide: administrators only. Font and auto-lock belong to this device.
  const clinicWide = access.isAdmin

  const chooseLang = async (l: Lang) => {
    if (!clinicWide || l === lang) return
    setLang(l)
    await updateClinic({ lang: l })
    toast.success(translate(l, 'settings.pref.langChanged'))
    void logActivity({ type: 'system', action: 'update', message: t('settings.act.prefs'), by: access.userId })
  }
  const chooseTheme = async (theme: 'light' | 'dark') => {
    if (!clinicWide || theme === (clinic.theme === 'dark' ? 'dark' : 'light')) return
    await updateClinic({ theme })
    toast.success(t('settings.pref.themeChanged'))
  }
  const chooseFont = (key: FontKey) => {
    if (key === font) return
    applyFont(key); setFont(key)
    toast.success(t('settings.pref.fontChanged'))
  }
  const chooseLock = (min: number) => {
    if (!access.isAdmin) return
    try { localStorage.setItem(LOCK_KEY, String(lockMs(min))) } catch { /* private mode */ }
    setLock(min)
    void applyLockNow(access.userId)
    toast.success(t('settings.pref.lockSaved'))
  }

  const setHours = (p: Partial<typeof h>) => {
    hours.patch(p)
    if (hasErrors(errors)) setErrors(validateHours({ ...h, ...p }))
  }
  const saveHours = (e?: FormEvent) => {
    e?.preventDefault()
    if (!access.canEdit || !hours.dirty) return
    void once(async () => {
      const errs = validateHours(h)
      setErrors(errs)
      if (hasErrors(errs)) { toast.error(t('settings.fixErrors')); return }
      setSavingHours(true)
      try {
        const next = await updateClinic({ ...h })
        hours.reset(next)
        toast.success(t('settings.savedToast'))
        void logActivity({ type: 'system', action: 'update', message: t('settings.act.hours'), by: access.userId })
      } catch { toast.error(t('settings.saveFailed')) } finally { setSavingHours(false) }
    })
  }

  const minutesLabel = (n: number) => n === 60 ? t('settings.pref.hourOpt') : n === 90 ? t('settings.pref.hoursAndHalf') : n === 120 ? t('settings.pref.twoHours') : t('settings.pref.minutesOpt', { n })
  const lockLabel = (n: number) => n === 0 ? t('settings.pref.lockNever') : n === 60 ? t('settings.pref.lockHour') : t('settings.pref.lockMin', { n })
  const scope = (device: boolean) => <Badge tone={device ? 'outline' : 'default'} size="sm">{t(device ? 'settings.pref.thisDevice' : 'settings.pref.allUsers')}</Badge>
  const perDay = hoursPerDay(h.workStart, h.workEnd)

  return (
    <div className="st-form">
      {!access.isAdmin && <LockedNotice reason="admin" />}

      {/* ---- language ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Languages />} title={t('settings.pref.language')} sub={t('settings.pref.languageSub')} end={scope(false)} />
          <div className="st-options st-options-2" role="radiogroup" aria-label={t('settings.pref.language')}>
            {(['ar', 'en'] as Lang[]).map(l => (
              <OptionCard key={l} active={lang === l} onClick={() => void chooseLang(l)} disabled={!clinicWide} data-lang={l}>
                <span className={`st-glyph${l === 'ar' ? ' ar' : ''}`} lang={l}>{l === 'ar' ? 'ع' : 'En'}</span>
                <span className="st-option-text">
                  <span className="st-option-title" lang={l}>{l === 'ar' ? 'العربية' : 'English'}</span>
                  <span className="st-option-desc">{t(l === 'ar' ? 'settings.pref.arDesc' : 'settings.pref.enDesc')}</span>
                </span>
              </OptionCard>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ---- font ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Type />} title={t('settings.pref.font')} sub={t('settings.pref.fontSub')} end={scope(true)} />
          <div className="st-options st-fonts" role="radiogroup" aria-label={t('settings.pref.font')}>
            {FONT_OPTIONS.map(o => (
              <OptionCard key={o.key} active={font === o.key} onClick={() => chooseFont(o.key)} className="st-font" data-font={o.key}>
                <span className="st-font-head">
                  <span className="st-font-name ltr">{o.label}</span>
                  {o.key === DEFAULT_FONT && <Badge tone="primary" size="sm">{t('settings.pref.fontDefault')}</Badge>}
                </span>
                <span className="st-font-sample" style={{ fontFamily: FONT_FAMILIES[o.key] }} lang="ar" dir="rtl">
                  {o.sample} <span className="st-nowrap">— <span className="num">{FONT_SAMPLE_AMOUNT}</span></span>
                </span>
                {font === o.key && <span className="st-font-current"><Check />{t('settings.pref.fontCurrent')}</span>}
              </OptionCard>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ---- theme ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Palette />} title={t('settings.pref.theme')} sub={t('settings.pref.themeSub')} end={scope(false)} />
          <div className="st-options st-options-2" role="radiogroup" aria-label={t('settings.pref.theme')}>
            {(['light', 'dark'] as const).map(th => (
              <OptionCard key={th} active={theme === th} onClick={() => void chooseTheme(th)} disabled={!clinicWide} className="st-theme" data-theme-option={th}>
                <span className={`st-mock st-mock-${th}`} aria-hidden>
                  <span className="st-mock-side"><i /><i /><i /><i /></span>
                  <span className="st-mock-main"><span className="st-mock-bar" /><span className="st-mock-cards"><i /><i /><i /></span><span className="st-mock-panel" /></span>
                </span>
                <span className="st-theme-label">
                  {th === 'light' ? <Sun /> : <Moon />}
                  <span className="st-option-text">
                    <span className="st-option-title">{t(th)}</span>
                    <span className="st-option-desc">{t(th === 'light' ? 'settings.pref.lightDesc' : 'settings.pref.darkDesc')}</span>
                  </span>
                  {th === 'light' && <Badge tone="success" size="sm">{t('settings.pref.recommended')}</Badge>}
                </span>
              </OptionCard>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* ---- working hours ---- */}
      <Card>
        <form onSubmit={saveHours} noValidate>
          <CardBody>
            <SectionTitle icon={<CalendarClock />} title={t('settings.pref.hours')} sub={t('settings.pref.hoursSub')} end={scope(false)} />
            <div className="col gap-4">
              {access.isAdmin && access.readOnly && <LockedNotice reason="readonly" />}
              <div className="field">
                <span className="field-label">{t('settings.pref.workingDays')}</span>
                <div className={`chips st-days${access.canEdit ? '' : ' st-inert'}`} role="group" aria-label={t('settings.pref.workingDays')}>
                  {WEEK_ORDER.map(d => {
                    const on = h.workingDays.includes(d)
                    return (
                      <Chip key={d} active={on} icon={on ? <Check /> : undefined} onClick={() => access.canEdit && setHours({ workingDays: toggleDay(h.workingDays, d) })} className="st-day">
                        {weekdayName(d, lang)}
                      </Chip>
                    )
                  })}
                </div>
                {errors.workingDays && <div className="field-error" role="alert">{errText(errors.workingDays)}</div>}
              </div>
              <div className="form-grid">
                <Input type="time" label={t('settings.pref.workStart')} value={h.workStart} onChange={e => setHours({ workStart: e.target.value })} error={errText(errors.workStart)} disabled={!access.canEdit} data-qa="work-start" />
                <Input type="time" label={t('settings.pref.workEnd')} value={h.workEnd} onChange={e => setHours({ workEnd: e.target.value })} error={errText(errors.workEnd)} disabled={!access.canEdit} data-qa="work-end" />
                <Select label={t('settings.pref.slot')} hint={t('settings.pref.slotHint')} value={String(h.slotMinutes)} onChange={e => setHours({ slotMinutes: Number(e.target.value) })} disabled={!access.canEdit}
                  options={SLOT_CHOICES.map(n => ({ value: String(n), label: minutesLabel(n) }))} />
                <Select label={t('settings.pref.defaultDuration')} hint={t('settings.pref.defaultDurationHint')} value={String(h.defaultAppointmentMinutes)} onChange={e => setHours({ defaultAppointmentMinutes: Number(e.target.value) })}
                  disabled={!access.canEdit} error={errText(errors.defaultAppointmentMinutes)}
                  options={[...new Set([...DURATION_CHOICES, h.defaultAppointmentMinutes])].sort((a, b) => a - b).map(n => ({ value: String(n), label: minutesLabel(n) }))} />
              </div>
              <div className="st-hours-summary">
                <span><CalendarClock />{t('settings.pref.daysCount', { n: h.workingDays.length })}</span>
                <span>{t('settings.pref.dailyHours', { n: perDay })}</span>
              </div>
            </div>
          </CardBody>
          {access.isAdmin && (
            <CardFooter>
              {hours.dirty && <Button variant="ghost" onClick={() => { hours.reset(); setErrors({}) }} disabled={savingHours}>{t('settings.discard')}</Button>}
              <Button type="submit" variant="primary" loading={savingHours} disabled={!hours.dirty || !access.canEdit} data-qa="save-hours">{t('settings.pref.saveHours')}</Button>
            </CardFooter>
          )}
        </form>
      </Card>

      {/* ---- auto-lock ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<LockKeyhole />} title={t('settings.pref.security')} sub={t('settings.pref.securitySub')} end={scope(true)} />
          <div className="st-lock">
            <Select label={t('settings.pref.lockAfter')} value={String(lock)} onChange={e => chooseLock(Number(e.target.value))} disabled={!access.isAdmin}
              options={LOCK_OPTIONS.map(n => ({ value: String(n), label: lockLabel(n) }))} data-qa="lock-select" />
            <div className="st-lock-current">
              <span className="muted text-sm">{t('settings.pref.lockCurrent')}</span>
              <span className="strong" data-qa="lock-current">{lockLabel(lock)}</span>
            </div>
          </div>
          <div className="text-sm muted mt-3">{t('settings.pref.lockNote')}</div>
          {lock === 0 && <Alert tone="warning" className="mt-3">{t('settings.pref.lockNeverWarn')}</Alert>}
        </CardBody>
      </Card>

      {/* ---- digits ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Hash />} title={t('settings.pref.digits')} />
          <p className="st-note">{t('settings.pref.digitsNote')}</p>
          <div className="st-digits" aria-hidden><span className="num">0 1 2 3 4 5 6 7 8 9</span></div>
        </CardBody>
      </Card>
    </div>
  )
}
