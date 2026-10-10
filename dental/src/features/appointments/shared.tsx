// Building blocks shared by the calendar, the dialogs and the patient tab.
import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { Appointment, AppointmentStatus, Clinic, Lang, Patient, User } from '@/db/types'
import { nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Badge, toneFor, useConfirmDelete, useToast } from '@/ui'
import { colorFor, whatsappLink } from '@/lib/format'
import { fmtDate, fmtTime, fromISODate } from '@/lib/dates'
import { openExternal, platform } from '@/platform'
import { nextLastVisit, pluralForm, type CalView } from './lib'
import './appointments.css'

/** An appointment with its patient and doctor resolved, as the views render it. */
export interface AptRow extends Appointment { patient?: Patient; doctor?: User }

// ---- plurals -------------------------------------------------------------------------------------
/** "5 مواعيد" / "5 appointments" */
export function useCountLabel() {
  const { t } = useI18n()
  return useCallback((n: number) => t(`appointments.count.${pluralForm(n)}`, { n }), [t])
}

// ---- people --------------------------------------------------------------------------------------
/** Initials that read well for Arabic names: titles are skipped and the article "ال" is dropped. */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(p => p && !/^(د\.?|Dr\.?)$/i.test(p))
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2)
  const strip = (w: string) => w.replace(/^ال(?=\S{2,})/, '')
  return strip(parts[0])[0] + strip(parts[parts.length - 1])[0]
}
export function PersonAvatar({ name, color, photo, size, className }: { name: string; color?: string; photo?: string; size?: 'xs' | 'sm' | 'lg' | 'xl'; className?: string }) {
  return (
    <span className={['avatar', size && `avatar-${size}`, className].filter(Boolean).join(' ')} style={{ background: photo ? 'var(--surface-3)' : color || colorFor(name) }} title={name} aria-hidden="true">
      {photo ? <img src={photo} alt="" /> : nameInitials(name)}
    </span>
  )
}
/** Same colour as the patients module (id + name), so a patient looks the same everywhere. */
export function PatientAvatar({ patient, size }: { patient?: Pick<Patient, 'id' | 'name' | 'photo'>; size?: 'xs' | 'sm' | 'lg' | 'xl' }) {
  const { t } = useI18n()
  if (!patient) return <PersonAvatar name={t('unknown')} color="var(--text-4)" size={size} />
  return <PersonAvatar name={patient.name} photo={patient.photo} color={colorFor(patient.id + patient.name)} size={size} />
}
export function doctorColor(d?: Pick<User, 'id' | 'color' | 'name'>): string {
  if (!d) return 'var(--text-4)'
  return d.color || colorFor(d.id + d.name)
}
export function DocDot({ doctor, className }: { doctor?: Pick<User, 'id' | 'color' | 'name'>; className?: string }) {
  return <span className={['apt-dot', className].filter(Boolean).join(' ')} style={{ background: doctorColor(doctor) }} aria-hidden="true" />
}

export function StatusBadge({ status, size }: { status: AppointmentStatus; size?: 'sm' | 'lg' }) {
  const { t } = useI18n()
  return <Badge tone={toneFor(status)} size={size} dot>{t(`apt.${status}`)}</Badge>
}

/** CSS variables that colour an appointment: the doctor's colour and the status accent. */
export function aptVars(a: Pick<Appointment, 'status'> & { doctor?: User }): CSSProperties {
  return { ['--doc' as string]: doctorColor(a.doctor), ['--st' as string]: `var(--st-${a.status})` }
}

// ---- contact -------------------------------------------------------------------------------------
const telOf = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
/** tel: and WhatsApp links that work on every host (Electron and Android hand them to the system). */
export function ContactButtons({ phone, size = 'md', className }: { phone?: string; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useI18n()
  if (!phone) return null
  const external = (e: ReactMouseEvent, url: string) => {
    e.stopPropagation()
    if (platform() !== 'web') { e.preventDefault(); openExternal(url) }
  }
  return (
    <span className={['apt-contact', size === 'sm' && 'sm', className].filter(Boolean).join(' ')}>
      <a className="apt-icon-link" href={telOf(phone)} title={t('call')} aria-label={t('call')} onClick={e => external(e, telOf(phone))}><Phone /></a>
      <a className="apt-icon-link wa" href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" title={t('whatsapp')} aria-label={t('whatsapp')}
        onClick={e => { e.preventDefault(); e.stopPropagation(); openExternal(whatsappLink(phone)) }}><MessageCircle /></a>
    </span>
  )
}

// ---- time & text ---------------------------------------------------------------------------------
const LOCALE = (lang: Lang) => (lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB')
const dayMonth = new Map<Lang, Intl.DateTimeFormat>()
/** "16 تشرين الأول" / "16 October" (no year). */
export function fmtDayMonth(d: string, lang: Lang): string {
  let f = dayMonth.get(lang)
  if (!f) { f = new Intl.DateTimeFormat(LOCALE(lang), { day: 'numeric', month: 'long' }); dayMonth.set(lang, f) }
  return f.format(fromISODate(d))
}
const monShort = new Map<Lang, Intl.DateTimeFormat>()
/** Short month name for date blocks ("تشرين الأول" is long in Arabic; English gets "Oct"). */
export function fmtMonthShort(d: string, lang: Lang): string {
  let f = monShort.get(lang)
  if (!f) { f = new Intl.DateTimeFormat(LOCALE(lang), { month: 'short' }); monShort.set(lang, f) }
  return f.format(fromISODate(d))
}
/** "10 – 16 تشرين الأول 2026", or "28 أيلول – 4 تشرين الأول 2026" across months. */
export function fmtSpan(from: string, to: string, lang: Lang): string {
  if (from === to) return fmtDate(from, lang, 'long')
  if (from.slice(0, 4) !== to.slice(0, 4)) return `${fmtDate(from, lang, 'long')} – ${fmtDate(to, lang, 'long')}`
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))} – ${fmtDate(to, lang, 'long')}`
  return `${fmtDayMonth(from, lang)} – ${fmtDate(to, lang, 'long')}`
}
/** "9:30 ص – 10:00 ص" */
export function fmtTimeRange(a: Pick<Appointment, 'start' | 'end'>, lang: Lang): string {
  return `${fmtTime(a.start, lang)} – ${fmtTime(a.end, lang)}`
}
/** "30 دقيقة", "ساعة", "ساعة ونصف"… */
export function useDurationLabel() {
  const { t } = useI18n()
  return useCallback((n: number) => {
    const key = `appointments.dur.${n}`
    const s = t(key)
    return s === `dur.${n}` ? t('appointments.dur.n', { n }) : s
  }, [t])
}
export function clinicName(c: Pick<Clinic, 'name' | 'nameEn'>, lang: Lang): string {
  return (lang === 'en' ? c.nameEn || c.name : c.name || c.nameEn) || ''
}

/** Re-renders every `ms` (for the red "now" line). */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

// ---- actions -------------------------------------------------------------------------------------
/** Status changes, deletion and the WhatsApp reminder, with activity log and toasts. */
export function useAptActions() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const session = useSession()
  const confirmDelete = useConfirmDelete()
  const clinic = useClinic()
  const by = session.user?.id

  const when = (a: Pick<Appointment, 'date' | 'start'>) => `${fmtDate(a.date, lang)} ${fmtTime(a.start, lang)}`

  const setStatus = async (a: Appointment, status: AppointmentStatus, patientName = '') => {
    const now = nowISO()
    await db.transaction('rw', db.appointments, db.patients, async () => {
      await db.appointments.update(a.id, { status, updatedAt: now })
      if (status === 'completed') {
        const p = await db.patients.get(a.patientId)
        if (p) {
          const lv = nextLastVisit(p.lastVisit, a.start)
          if (lv !== p.lastVisit) await db.patients.update(p.id, { lastVisit: lv })
        }
      }
    })
    void logActivity({ type: 'appointment', action: 'status', entityId: a.id, patientId: a.patientId, message: t('appointments.act.status', { name: patientName, status: t(`apt.${status}`), when: when(a) }), by })
    toast.success(t('appointments.statusToast', { status: t(`apt.${status}`) }), patientName || undefined)
  }

  /** Asks first; resolves true when deleted. Links from treatments and notes are cleared, not left dangling. */
  const remove = async (a: Appointment, patientName = '') => {
    if (!(await confirmDelete(t('appointments.deleteConfirm')))) return false
    await db.transaction('rw', db.appointments, db.treatments, db.notes, async () => {
      await db.appointments.delete(a.id)
      await db.treatments.where('appointmentId').equals(a.id).modify(x => { delete x.appointmentId })
      await db.notes.where('appointmentId').equals(a.id).modify(x => { delete x.appointmentId })
    })
    void logActivity({ type: 'appointment', action: 'delete', entityId: a.id, patientId: a.patientId, message: t('appointments.act.deleted', { name: patientName, when: when(a) }), by })
    toast.success(t('appointments.deletedToast'), patientName || undefined)
    return true
  }

  const reminderText = (a: Pick<Appointment, 'date' | 'start'>, patient: Pick<Patient, 'name'>) =>
    t('appointments.reminderMsg', { name: patient.name, clinic: clinicName(clinic, lang), date: fmtDate(a.date, lang, 'weekday'), time: fmtTime(a.start, lang) })

  const remind = (a: Appointment, patient?: Patient) => {
    if (!patient?.phone) { toast.warning(t('appointments.noPhone')); return }
    openExternal(whatsappLink(patient.phone, reminderText(a, patient)))
    void logActivity({ type: 'appointment', action: 'other', entityId: a.id, patientId: a.patientId, message: t('appointments.act.reminded', { name: patient.name, when: when(a) }), by })
  }

  return { setStatus, remove, remind, reminderText }
}

// ---- view state ----------------------------------------------------------------------------------
export interface CalState { view: CalView; date: string; doctorIds: string[]; status: import('./lib').StatusFilter }
