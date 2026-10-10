import { useMemo, useState, type FormEvent } from 'react'
import { Check, KeyRound, Mail, Palette, Phone, ShieldCheck, Stethoscope, UserPlus, UserRound, UserCog } from 'lucide-react'
import { Alert, Avatar, Badge, Button, Field, Input, Modal, Select, Switch, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { db, logActivity } from '@/db'
import { newId, nowISO } from '@/db/ids'
import type { Role, User } from '@/db/types'
import { hashPin, randomHex } from '@/lib/crypto'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { PinField } from '@/features/auth/PinField'
import { displayName, plainName } from '@/features/auth/lib'
import { ROLES, ROLE_TONE, STAFF_COLORS, nextFreeColor, roleAreas, saveBlock, validateStaff, type StaffDraft } from './lib'
import './staff.css'

/** Add (no `user`) or edit a team member. Admin-only page, so any PIN may be (re)set here. */
export default function StaffFormModal({ open, onClose, user, users }: { open: boolean; onClose: () => void; user?: User; users: User[] }) {
  const { t } = useI18n()
  const toast = useToast()
  const session = useSession()
  const { readOnly } = useLicense()
  const editing = !!user
  const isSelf = !!user && user.id === session.user?.id

  const [d, setD] = useState<StaffDraft>(() => user ? {
    name: user.name, title: user.title ?? '', role: user.role, specialty: user.specialty ?? '', phone: user.phone ?? '', email: user.email ?? '',
    color: user.color, active: user.active, pin: '', pin2: '',
  } : {
    name: '', title: '', role: 'doctor', specialty: '', phone: '', email: '', color: nextFreeColor(users), active: true, pin: '', pin2: '',
  })
  const [setPin, setSetPin] = useState(!editing)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof StaffDraft>(k: K, v: StaffDraft[K]) => setD(x => ({ ...x, [k]: v }))

  const others = useMemo(() => users.filter(u => u.id !== user?.id), [users, user?.id])
  const errors = validateStaff(d, setPin, others)
  const err = (f: string) => (tried && errors[f] ? t(errors[f]) : undefined)
  const titles = [{ value: '', label: t('staff.noTitle') }, { value: t('staff.titleAr'), label: t('staff.titleAr') }, { value: t('staff.titleEn'), label: t('staff.titleEn') }]
  if (d.title && !titles.some(o => o.value === d.title)) titles.push({ value: d.title, label: d.title })

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (saving || readOnly) return
    if (Object.keys(errors).length) {
      setTried(true)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.au-staff-form .invalid')?.focus())
      return
    }
    if (user) {
      const block = saveBlock(user, { role: d.role, active: d.active }, users, session.user?.id)
      if (block) { toast.error(block === 'self' ? t('staff.err.selfDeactivate') : t('staff.err.lastAdminRole')); return }
    }
    setSaving(true)
    try {
      const now = nowISO()
      const fields = {
        name: d.name.trim(), title: d.title || undefined, role: d.role, specialty: d.specialty.trim() || undefined,
        phone: d.phone.trim() || undefined, email: d.email.trim() || undefined, color: d.color, active: d.active, updatedAt: now,
      }
      const name = displayName(fields)
      if (user) {
        const patch: Partial<User> = { ...fields }
        if (setPin) { const salt = randomHex(); patch.pinSalt = salt; patch.pinHash = await hashPin(d.pin, salt) }
        await db.users.update(user.id, patch)
        toast.success(t('staff.toast.updated', { name }))
        void logActivity({ type: 'system', action: 'update', entityId: user.id, by: session.user?.id, message: t('staff.act.updated', { name }) })
      } else {
        const salt = randomHex()
        const id = newId()
        await db.users.add({ id, ...fields, pinSalt: salt, pinHash: await hashPin(d.pin, salt), createdAt: now })
        toast.success(t('staff.toast.added', { name }))
        void logActivity({ type: 'system', action: 'create', entityId: id, by: session.user?.id, message: t('staff.act.added', { name }) })
      }
      onClose()
    } catch {
      toast.error(t('error'))
      setSaving(false)
    }
  }

  const preview = d.name.trim() ? displayName(d) : ''
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={editing ? <UserCog /> : <UserPlus />} title={editing ? t('staff.editTitle') : t('staff.addTitle')} subtitle={editing ? undefined : t('staff.addSub')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" type="submit" form="au-staff-form" loading={saving} disabled={readOnly} data-qa="save-member">{editing ? t('saveChanges') : t('staff.saveMember')}</Button>
      </>}>
      <form id="au-staff-form" className="au-staff-form" onSubmit={save} noValidate>
        {readOnly && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}
        <div className="au-preview">
          <Avatar name={plainName(d.name) || '?'} color={d.color} size="lg" />
          <div className="grow">
            <div className={`au-preview-name truncate${preview ? '' : ' au-ph'}`}>{preview || t('staff.name')}</div>
            <div className="row gap-2 mt-1 wrap">
              <Badge tone={ROLE_TONE[d.role]} size="sm">{t(`role.${d.role}`)}</Badge>
              {d.specialty.trim() && <span className="text-sm muted truncate">{d.specialty.trim()}</span>}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title"><UserRound />{t('staff.secBasics')}</div>
          <div className="form-grid">
            <div className="au-name-row">
              <Select label={t('staff.titleLabel')} value={d.title} onChange={e => set('title', e.target.value)} options={titles} name="title" />
              <Input label={t('staff.name')} required value={d.name} onChange={e => set('name', e.target.value)} placeholder={t('staff.namePh')} error={err('name')} name="name" maxLength={60} autoFocus />
            </div>
            <Input label={t('staff.specialty')} value={d.specialty} onChange={e => set('specialty', e.target.value)} placeholder={t('staff.specialtyPh')} iconStart={<Stethoscope />} name="specialty" maxLength={60} />
            <Input label={t('phone')} value={d.phone} onChange={e => set('phone', e.target.value)} placeholder={t('staff.phonePh')} iconStart={<Phone />} dir="ltr" type="tel" inputMode="tel" error={err('phone')} name="phone" maxLength={24} />
            <Input className="span-2" label={t('email')} value={d.email} onChange={e => set('email', e.target.value)} placeholder={t('staff.emailPh')} iconStart={<Mail />} dir="ltr" type="email" inputMode="email" error={err('email')} name="email" maxLength={80} />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title"><ShieldCheck />{t('staff.secRole')}</div>
          <Select label={t('staff.role')} value={d.role} onChange={e => set('role', e.target.value as Role)} options={ROLES.map(r => ({ value: r, label: t(`role.${r}`) }))} name="role" />
          <div className="au-role-box" data-qa="role-box">
            <div>{t(`staff.roleDesc.${d.role}`)}</div>
            <div className="au-can">{t('staff.canDo')}</div>
            <div className="au-area-chips">{roleAreas(d.role).map(a => <Badge key={a} size="sm" icon={<Check />}>{t(`staff.area.${a}`)}</Badge>)}</div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title"><Palette />{t('staff.secLook')}</div>
          <Field hint={t('staff.colorHint')}>
            <div className="au-colors" role="radiogroup" aria-label={t('staff.secLook')}>
              {STAFF_COLORS.map((c, i) => (
                <button key={c} type="button" role="radio" aria-checked={d.color.toUpperCase() === c.toUpperCase()} aria-label={t('staff.colorN', { n: i + 1 })} title={t('staff.colorN', { n: i + 1 })}
                  className="au-color" style={{ ['--swatch' as string]: c }} onClick={() => set('color', c)}>
                  {d.color.toUpperCase() === c.toUpperCase() && <Check />}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="form-section">
          <div className="form-section-title"><KeyRound />{t('staff.secPin')}</div>
          {editing && (
            <label className="au-switch-row">
              <span><span className="au-sw-title">{t('staff.setNewPin')}</span><span className="au-sw-hint" style={{ display: 'block' }}>{t('staff.setNewPinHint')}</span></span>
              <Switch checked={setPin} onChange={e => { setSetPin(e.target.checked); set('pin', ''); set('pin2', '') }} aria-label={t('staff.setNewPin')} />
            </label>
          )}
          {setPin && (
            <div className={`form-grid${editing ? ' au-pin-grid' : ''}`}>
              <PinField label={t('staff.pin')} required hint={t('staff.pinHint')} error={err('pin')} value={d.pin} onChange={v => set('pin', v)} id="staff-pin" />
              <PinField label={t('staff.pin2')} required error={err('pin2')} value={d.pin2} onChange={v => set('pin2', v)} id="staff-pin2" />
            </div>
          )}
        </div>

        {editing && (
          <div className="form-section">
            <label className="au-switch-row">
              <span><span className="au-sw-title">{t('staff.activeLabel')}</span><span className="au-sw-hint" style={{ display: 'block' }}>{isSelf ? t('staff.selfActiveHint') : t('staff.activeHint')}</span></span>
              <Switch checked={d.active} disabled={isSelf} onChange={e => set('active', e.target.checked)} aria-label={t('staff.activeLabel')} />
            </label>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
