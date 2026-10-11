import { useMemo, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity as ActivityIcon, BadgeCheck, Briefcase, CalendarClock, CalendarPlus, Droplet, FileText, FlaskConical, HeartPulse, IdCard, Mail, MapPin, NotebookPen, Pencil, Phone, Pill,
  Receipt, ShieldPlus, StickyNote, TriangleAlert, UserPlus, Users, Wallet, Contact,
} from 'lucide-react'
import { db } from '@/db'
import type { Activity, Appointment, Patient } from '@/db/types'
import { useI18n } from '@/i18n'
import { useUsers } from '@/app/hooks'
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Skeleton, toneFor } from '@/ui'
import { dateOf, diffDays, fmtDate, fmtTime, relativeDay, timeAgo, today } from '@/lib/dates'
import { formatPhone } from '@/lib/format'
import { upcomingAppointments } from './lib'

const ACT_ICON: Record<string, ReactNode> = {
  patient: <UserPlus />, appointment: <CalendarClock />, treatment: <ActivityIcon />, invoice: <Receipt />, payment: <Wallet />, prescription: <Pill />, lab: <FlaskConical />,
}

export default function PatientOverview({ patient, appointments, onEdit, onBook }: { patient: Patient; appointments?: Appointment[]; onEdit?: () => void; onBook?: () => void }) {
  const { t, lang } = useI18n()
  const users = useUsers(false)
  const userName = (id?: string) => users.find(u => u.id === id)?.name
  const activity = useLiveQuery(async () => (await db.activity.where('patientId').equals(patient.id).reverse().sortBy('at')).slice(0, 10), [patient.id])
  const upcoming = useMemo(() => (appointments ? upcomingAppointments(appointments).slice(0, 4) : undefined), [appointments])
  const allergies = patient.allergies ?? [], chronic = patient.chronicDiseases ?? [], meds = patient.medications ?? []
  const hasMedical = !!patient.bloodType || allergies.length + chronic.length + meds.length > 0 || !!patient.medicalNotes
  const editBtn = onEdit && <Button size="sm" variant="ghost" icon={<Pencil />} onClick={onEdit}>{t('edit')}</Button>

  const contactRows: [ReactNode, string, ReactNode][] = []
  if (patient.phone) contactRows.push([<Phone />, t('phone'), <span className="ltr num">{formatPhone(patient.phone)}</span>])
  if (patient.phone2) contactRows.push([<Phone />, t('phone2'), <span className="ltr num">{formatPhone(patient.phone2)}</span>])
  if (patient.email) contactRows.push([<Mail />, t('email'), <span className="ltr">{patient.email}</span>])
  if (patient.address) contactRows.push([<MapPin />, t('address'), patient.address])
  if (patient.nationalId) contactRows.push([<IdCard />, t('patients.nationalId'), <span className="ltr num">{patient.nationalId}</span>])
  if (patient.occupation) contactRows.push([<Briefcase />, t('patients.occupation'), patient.occupation])
  if (patient.insuranceCompany) contactRows.push([<ShieldPlus />, t('patients.insuranceCompany'), patient.insuranceCompany])
  if (patient.insuranceNumber) contactRows.push([<BadgeCheck />, t('patients.insuranceNumber'), <span className="ltr num">{patient.insuranceNumber}</span>])
  if (patient.referredBy) contactRows.push([<Users />, t('patients.referredBy'), patient.referredBy])

  return (
    <div className="pt-overview">
      <div className="pt-col">
        <Card>
          <CardHeader icon={<HeartPulse />} title={t('patients.medicalInfo')} actions={editBtn} />
          <CardBody>
            {!hasMedical ? <EmptyState compact icon={<HeartPulse />} title={t('patients.noMedical')} description={t('patients.noMedicalDesc')} /> : (
              <div className="pt-info">
                <InfoItem icon={<Droplet />} label={t('patients.bloodType')}>{patient.bloodType ? <span className="ltr strong">{patient.bloodType}</span> : <span className="subtle">{t('patients.bloodTypeUnknown')}</span>}</InfoItem>
                <InfoItem icon={<TriangleAlert />} label={t('patients.allergies')}>{allergies.length ? <span className="pt-badges">{allergies.map(a => <Badge key={a} tone="danger">{a}</Badge>)}</span> : <span className="subtle">{t('patients.noneRecorded')}</span>}</InfoItem>
                <InfoItem icon={<HeartPulse />} label={t('patients.chronicDiseases')}>{chronic.length ? <span className="pt-badges">{chronic.map(a => <Badge key={a} tone="warning">{a}</Badge>)}</span> : <span className="subtle">{t('patients.noneRecorded')}</span>}</InfoItem>
                <InfoItem icon={<Pill />} label={t('patients.medications')}>{meds.length ? <span className="pt-badges">{meds.map(a => <Badge key={a} tone="info">{a}</Badge>)}</span> : <span className="subtle">{t('patients.noneRecorded')}</span>}</InfoItem>
                {patient.medicalNotes && <InfoItem wide icon={<NotebookPen />} label={t('patients.medicalNotes')}><p className="pt-prewrap">{patient.medicalNotes}</p></InfoItem>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Contact />} title={t('patients.contactInfo')} actions={editBtn} />
          <CardBody>
            {contactRows.length === 0 ? <EmptyState compact icon={<Contact />} title={t('patients.noContact')} /> : (
              <div className="pt-info">
                {contactRows.map(([icon, label, value], i) => <InfoItem key={i} icon={icon} label={label}>{value}</InfoItem>)}
              </div>
            )}
            <div className="pt-added muted text-sm">{t('patients.addedOn')} {fmtDate(patient.createdAt, lang, 'long')}</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<StickyNote />} title={t('patients.notesCard')} actions={editBtn} />
          <CardBody>
            {patient.notes ? <p className="pt-prewrap">{patient.notes}</p> : <div className="subtle">{t('patients.noNotes')}</div>}
          </CardBody>
        </Card>
      </div>

      <div className="pt-col">
        <Card>
          <CardHeader icon={<CalendarClock />} title={t('patients.upcoming')} actions={onBook && <Button size="sm" variant="ghost" icon={<CalendarPlus />} onClick={onBook}>{t('patients.bookAppointment')}</Button>} />
          {upcoming === undefined ? <CardBody><Skeleton h={48} /><Skeleton className="mt-2" h={48} /></CardBody>
            : upcoming.length === 0 ? <EmptyState compact icon={<CalendarClock />} title={t('patients.noUpcomingList')} actions={onBook && <Button variant="primary" size="sm" icon={<CalendarPlus />} onClick={onBook}>{t('patients.bookAppointment')}</Button>} />
            : (
              <div className="list">
                {upcoming.map(a => {
                  const d = new Date(a.start)
                  return (
                    <div key={a.id} className="list-item pt-apt">
                      <span className="pt-apt-date"><span className="pt-apt-day num">{d.getDate()}</span><span className="pt-apt-mon">{weekdayShort(d, lang)}</span></span>
                      <div className="grow">
                        <div className="li-main">{nearDay(a.start, lang) ?? fmtDate(a.start, lang, 'long')}</div>
                        <div className="li-sub"><bdi className="tnum">{fmtTime(a.start, lang)}</bdi> · {t(`aptType.${a.type}`)}{userName(a.doctorId) ? <> · <bdi>{userName(a.doctorId)}</bdi></> : null}</div>
                      </div>
                      <Badge tone={toneFor(a.status)} dot>{t(`apt.${a.status}`)}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
        </Card>

        <Card>
          <CardHeader icon={<ActivityIcon />} title={t('patients.recentActivity')} />
          {activity === undefined ? <CardBody><Skeleton h={14} /><Skeleton className="mt-3" h={14} /><Skeleton className="mt-3" w="70%" h={14} /></CardBody>
            : activity.length === 0 ? <EmptyState compact icon={<ActivityIcon />} title={t('patients.noActivity')} />
            : (
              <ol className="pt-timeline">
                {activity.map((a: Activity) => (
                  <li key={a.id} className="pt-tl-item">
                    <span className={`pt-tl-icon act-${a.type}`}>{ACT_ICON[a.type] ?? <FileText />}</span>
                    <div className="grow">
                      <div className="pt-tl-msg"><span className="strong">{t(`patients.actType.${a.type}`)}</span> · {t(`patients.act.${a.action}`)}{a.message ? <> — <span className="pt-tl-text">{a.message}</span></> : null}</div>
                      <div className="pt-tl-meta">{timeAgo(a.at, lang)}{userName(a.by) ? ` · ${userName(a.by)}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
        </Card>
      </div>
    </div>
  )
}

const weekdayFmt = new Map<string, Intl.DateTimeFormat>()
function weekdayShort(d: Date, lang: 'ar' | 'en'): string {
  let f = weekdayFmt.get(lang)
  if (!f) { f = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', { weekday: 'short' }); weekdayFmt.set(lang, f) }
  return f.format(d)
}
/** "Today" / "Tomorrow" when that close, otherwise undefined. */
function nearDay(iso: string, lang: 'ar' | 'en'): string | undefined {
  const diff = diffDays(today(), dateOf(iso))
  return diff === 0 || diff === 1 ? relativeDay(dateOf(iso), lang) : undefined
}

function InfoItem({ icon, label, children, wide }: { icon: ReactNode; label: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`pt-info-item${wide ? ' wide' : ''}`}>
      <div className="pt-info-label">{icon}{label}</div>
      <div className="pt-info-value">{children}</div>
    </div>
  )
}
