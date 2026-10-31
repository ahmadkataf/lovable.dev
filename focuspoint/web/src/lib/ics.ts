// Build and download an .ics file for a confirmed booking. Its alarm follows settings.reminder_minutes (the push
// reminder): 60 by default, none when reminders are off (0).
import type { Booking, PublicSettings } from '@shared/types'
import { reminderMinutes } from './booking'

type IcsSettings = Pick<PublicSettings, 'centre_name' | 'address' | 'phone'> & Partial<Pick<PublicSettings, 'reminder_minutes'>>

function stamp(iso: string): string { return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '') }
function esc(s: string): string { return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c) }

export function buildIcs(b: Booking, s: IcsSettings | null): string {
  const title = `${s?.centre_name || 'فوكس بوينت'} — ${b.room_name || 'حجز'}`
  const alarm = reminderMinutes(s)
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Focus Point//Booking//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:fp-${b.code}@focuspoint`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.start)}`,
    `DTEND:${stamp(b.end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`رمز الحجز: ${b.code}${s?.phone ? `\nهاتف المركز: ${s.phone}` : ''}`)}`,
    s?.address ? `LOCATION:${esc(s.address)}` : '',
    `URL:${location.origin}/b/${b.id}`,
    ...(alarm > 0 ? ['BEGIN:VALARM', `TRIGGER:-PT${alarm}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM'] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\r\n') + '\r\n'
}

export function downloadIcs(b: Booking, s: IcsSettings | null) {
  const blob = new Blob([buildIcs(b, s)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `focuspoint-${b.code}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
