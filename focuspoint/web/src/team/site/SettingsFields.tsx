// Settings shown inside a section editor (SectionSpec.settings): the centre's identity (name, phone, address,
// Instagram, hours) is edited right here, next to the brand texts, and saved through the offline store like
// Settings.tsx does; anything else (booking & payment options) is summarised with a link to its Settings tab.
import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { Settings } from '@shared/types'
import { fmtClock } from '../../format'
import { Icon, Input } from '../../ui'
import { cx, toMin } from '../util'

/** The identity fields this editor can edit, in display order. */
const IDENTITY: { key: 'centre_name' | 'phone' | 'address' | 'instagram' | 'open' | 'close'; label: string; help?: string }[] = [
  { key: 'centre_name', label: 'اسم المركز', help: 'بيطلع بالموقع والإشعارات. بأي نص كـ {name}' },
  { key: 'phone', label: 'رقم الهاتف', help: 'زر الاتصال، والواتساب إذا ما في رقم واتساب تحت. {phone}' },
  { key: 'address', label: 'العنوان', help: 'صفحة التواصل والخريطة. {address}' },
  { key: 'instagram', label: 'إنستغرام', help: 'اسم الحساب بدون @' },
  { key: 'open', label: 'الفتح' },
  { key: 'close', label: 'السكّرة' },
]
export type IdentityKey = (typeof IDENTITY)[number]['key']
export type IdentityDraft = Partial<Record<IdentityKey, string>>

export const identityKeys = (keys: string[] | undefined): IdentityKey[] =>
  IDENTITY.map((f) => f.key).filter((k) => keys?.includes(k))
export const identityFrom = (s: Settings | null, keys: IdentityKey[]): IdentityDraft =>
  Object.fromEntries(keys.map((k) => [k, s ? String(s[k] ?? '') : ''])) as IdentityDraft

/** Same rules as Settings › المركز. Returns {key: Arabic error}. */
export function checkIdentity(d: IdentityDraft): Partial<Record<IdentityKey, string>> {
  const e: Partial<Record<IdentityKey, string>> = {}
  if (d.centre_name !== undefined && d.centre_name.trim().length < 2) e.centre_name = 'اكتب اسم المركز'
  if (d.phone !== undefined && d.phone.trim().length < 6) e.phone = 'رقم الهاتف غير صحيح'
  if (d.open !== undefined && d.close !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(d.open) || !/^\d{2}:\d{2}$/.test(d.close) || toMin(d.open) >= toMin(d.close)) e.open = 'الفتح لازم يكون قبل السكّرة'
  }
  return e
}
/** Trimmed, Instagram without @ — what Settings › المركز stores. */
export function cleanIdentity(d: IdentityDraft): IdentityDraft {
  const c: IdentityDraft = {}
  for (const [k, v] of Object.entries(d) as [IdentityKey, string | undefined][]) c[k] = (v ?? '').trim()
  if (c.instagram !== undefined) c.instagram = c.instagram.replace(/^@/, '')
  return c
}
/** Only the changed fields (after cleaning). */
export function identityPatch(d: IdentityDraft, s: Settings): Partial<Settings> {
  const patch: Partial<Settings> = {}
  for (const [k, v] of Object.entries(cleanIdentity(d)) as [IdentityKey, string][]) if (v !== String(s[k] ?? '')) (patch as Record<string, string>)[k] = v
  return patch
}

export function IdentityCard({ keys, value, saved, onChange, errors }: {
  keys: IdentityKey[]; value: IdentityDraft; saved: IdentityDraft; onChange: (v: IdentityDraft) => void; errors: Partial<Record<IdentityKey, string>>
}) {
  const base = useId()
  const fields = IDENTITY.filter((f) => keys.includes(f.key))
  const hours = fields.filter((f) => f.key === 'open' || f.key === 'close')
  const one = (f: (typeof IDENTITY)[number]) => {
    const id = `${base}-${f.key}`
    const changed = (value[f.key] ?? '') !== (saved[f.key] ?? '')
    const err = errors[f.key]
    const time = f.key === 'open' || f.key === 'close'
    const ltr = time || f.key === 'phone' || f.key === 'instagram'
    return (
      <div key={f.key} className={cx('se-field', err && 'has-error')} data-path={`settings.${f.key}`}>
        <div className="se-field-head">
          <label className="field-label" htmlFor={id}>{f.label}{changed && <span className="se-dot" title="تغيير ما انحفظ" />}</label>
        </div>
        <Input id={id} dir={ltr ? 'ltr' : undefined} type={time ? 'time' : f.key === 'phone' ? 'tel' : 'text'} step={time ? 1800 : undefined}
          inputMode={f.key === 'phone' ? 'tel' : undefined} value={value[f.key] ?? ''} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
        {err ? <span className="field-error" role="alert">{err}</span> : f.help ? <span className="field-hint">{f.help}</span> : null}
      </div>
    )
  }
  return (
    <>
      {fields.filter((f) => !hours.includes(f)).map(one)}
      {hours.length > 0 && (
        <>
          <div className="se-two">{hours.map(one)}</div>
          {value.open && value.close && /^\d{2}:\d{2}$/.test(value.open) && /^\d{2}:\d{2}$/.test(value.close) && (
            <p className="field-hint">مفتوح يومياً من {fmtClock(value.open)} لـ {fmtClock(value.close)}. نفس الساعات بتنطبق عالحجز.</p>
          )}
        </>
      )}
    </>
  )
}

/** Booking & payment options are Settings: a short summary and the way there. */
export function LinkedSettings({ settings }: { settings: Settings | null }) {
  const on = (v: boolean | undefined, d: boolean) => (v ?? d)
  const methods = [on(settings?.shamcash_enabled, true) && 'شام كاش', settings?.allow_pay_on_arrival && 'الدفع عند الوصول'].filter(Boolean).join(' + ')
  return (
    <div className="se-linked">
      {settings && (
        <ul className="se-linked-list">
          <li><Icon name={on(settings.booking_enabled, true) ? 'check' : 'x'} size={16} /> الحجز أونلاين: {on(settings.booking_enabled, true) ? 'شغّال' : 'متوقف'}</li>
          <li><Icon name="cash" size={16} /> طرق الدفع: {methods || '—'}</li>
          <li><Icon name="calendar" size={16} /> الحجز مسموح لـ {settings.booking_horizon_days ?? 14} يوم لقدّام</li>
        </ul>
      )}
      <div className="se-linked-links">
        <Link to="/team/settings" className="btn btn-soft btn-sm"><Icon name="settings" size={16} /> خيارات الحجز</Link>
        <Link to="/team/settings/payment" className="btn btn-soft btn-sm"><Icon name="cash" size={16} /> خيارات الدفع</Link>
      </div>
    </div>
  )
}
