import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Clock, KeyRound, Mail, MoreVertical, Pencil, Phone, ShieldAlert, Stethoscope, Trash2, UserCheck, UserPlus, UserX, UsersRound } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, Menu, PageHeader, Segmented, Skeleton, Switch, useConfirm, useToast, type MenuItemDef } from '@/ui'
import { useI18n } from '@/i18n'
import { db, logActivity } from '@/db'
import { nowISO } from '@/db/ids'
import type { User } from '@/db/types'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { formatPhone } from '@/lib/format'
import { timeAgo, fmtDateTime } from '@/lib/dates'
import { displayName, plainName } from '@/features/auth/lib'
import { ROLE_TONE, deactivateBlock, deleteBlock, filterStaff, lastLoginMap, sortStaff, type StaffFilter } from './lib'
import StaffFormModal from './StaffFormModal'
import ResetPinModal from './ResetPinModal'
import { PermissionsMatrix, SignInLog } from './StaffPanels'
import './staff.css'

export default function StaffPage() {
  const { t } = useI18n()
  const session = useSession()
  if (!session.can('staff')) {
    return (
      <div className="page">
        <Card><EmptyState icon={<ShieldAlert />} title={t('staff.noPermission')} description={t('staff.noPermissionSub')} actions={<Button variant="primary" to="/">{t('staff.backHome')}</Button>} /></Card>
      </div>
    )
  }
  return <StaffManager />
}

function StaffManager() {
  const { t, lang } = useI18n()
  const session = useSession()
  const toast = useToast()
  const confirm = useConfirm()
  const { readOnly } = useLicense()
  const selfId = session.user?.id

  const users = useLiveQuery(() => db.users.toArray(), [])
  const logins = useLiveQuery(() => db.activity.orderBy('at').reverse().filter(a => a.type === 'system' && a.action === 'login').limit(400).toArray(), [])
  const [filter, setFilter] = useState<StaffFilter>('all')
  const [form, setForm] = useState<{ user?: User } | null>(null)
  const [pinFor, setPinFor] = useState<User | null>(null)

  const all = useMemo(() => sortStaff(users ?? []), [users])
  const shown = filterStaff(all, filter)
  const last = useMemo(() => lastLoginMap(logins ?? []), [logins])
  const counts = { all: all.length, active: all.filter(u => u.active).length, inactive: all.filter(u => !u.active).length }

  const setActive = async (u: User, active: boolean) => {
    if (readOnly) return
    if (!active) {
      const block = deactivateBlock(u, all, selfId)
      if (block) { toast.error(block === 'self' ? t('staff.err.selfDeactivate') : t('staff.err.lastAdminDeactivate')); return }
    }
    const name = displayName(u)
    await db.users.update(u.id, { active, updatedAt: nowISO() })
    toast.success(active ? t('staff.toast.activated', { name }) : t('staff.toast.deactivated', { name }))
    void logActivity({ type: 'system', action: 'status', entityId: u.id, by: selfId, message: active ? t('staff.act.activated', { name }) : t('staff.act.deactivated', { name }) })
  }

  const remove = async (u: User) => {
    if (readOnly) return
    const block = deleteBlock(u, all, selfId)
    if (block) { toast.error(block === 'self' ? t('staff.err.selfDelete') : t('staff.err.lastAdminDelete')); return }
    const [a, tr, rx] = await Promise.all([
      db.appointments.where('doctorId').equals(u.id).count(),
      db.treatments.where('doctorId').equals(u.id).count(),
      db.prescriptions.where('doctorId').equals(u.id).count(),
    ])
    const linked = a + tr + rx
    const name = displayName(u)
    const ok = await confirm({
      title: t('staff.deleteTitle', { name }), danger: true,
      description: <>{t('staff.deleteDesc')}{linked > 0 && <><br /><br />{t('staff.deleteHistory', { n: linked })}</>}</>,
    })
    if (!ok) return
    await db.users.delete(u.id)
    toast.success(t('staff.toast.deleted', { name }))
    void logActivity({ type: 'system', action: 'delete', entityId: u.id, by: selfId, message: t('staff.act.deleted', { name }) })
  }

  const menu = (u: User): MenuItemDef[] => [
    { label: t('edit'), icon: <Pencil />, onClick: () => setForm({ user: u }), disabled: readOnly },
    { label: t('staff.resetPin'), icon: <KeyRound />, onClick: () => setPinFor(u), disabled: readOnly },
    u.active
      ? { label: t('staff.deactivate'), icon: <UserX />, onClick: () => void setActive(u, false), disabled: readOnly || u.id === selfId }
      : { label: t('staff.activate'), icon: <UserCheck />, onClick: () => void setActive(u, true), disabled: readOnly },
    { sep: true },
    { label: t('staff.deleteMember'), icon: <Trash2 />, danger: true, onClick: () => void remove(u), disabled: readOnly || u.id === selfId },
  ]

  return (
    <div className="page">
      <PageHeader title={t('staff.title')} subtitle={t('staff.subtitle')}
        actions={<Button variant="primary" icon={<UserPlus />} onClick={() => setForm({})} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined} data-qa="add-member">{t('staff.add')}</Button>} />

      {users && all.length > 0 && (
        <div className="au-staff-toolbar">
          <Segmented<StaffFilter> value={filter} onChange={setFilter} options={[
            { value: 'all', label: <>{t('staff.filterAll')} <span className="count num">{counts.all}</span></> },
            { value: 'active', label: <>{t('staff.filterActive')} <span className="count num">{counts.active}</span></> },
            { value: 'inactive', label: <>{t('staff.filterInactive')} <span className="count num">{counts.inactive}</span></> },
          ]} />
        </div>
      )}

      {!users ? (
        <div className="au-staff-grid">
          {[0, 1, 2].map(i => (
            <Card key={i} className="au-member-skel">
              <div className="row gap-3"><Skeleton w={56} h={56} r={28} /><div className="grow col gap-2"><Skeleton w="60%" h={16} /><Skeleton w="35%" h={12} /></div></div>
              <Skeleton w="70%" h={12} /><Skeleton w="50%" h={12} />
            </Card>
          ))}
        </div>
      ) : all.length === 0 ? (
        <Card><EmptyState icon={<UsersRound />} title={t('staff.empty')} description={t('staff.emptySub')} actions={<Button variant="primary" icon={<UserPlus />} onClick={() => setForm({})} disabled={readOnly}>{t('staff.add')}</Button>} /></Card>
      ) : shown.length === 0 ? (
        <Card><EmptyState compact icon={<UsersRound />} title={t('staff.emptyFilter')} description={t('staff.emptyFilterSub')} actions={<Button variant="secondary" onClick={() => setFilter('all')}>{t('staff.filterAll')}</Button>} /></Card>
      ) : (
        <div className="au-staff-grid" data-qa="staff-grid">
          {shown.map(u => {
            const self = u.id === selfId
            const seen = last[u.id]
            return (
              <Card key={u.id} className={`au-member${u.active ? '' : ' au-off'}`} style={{ ['--member-color' as string]: u.color }} data-user={u.id}>
                <div className="au-member-top">
                  <Avatar name={plainName(u.name)} color={u.color} size="lg" />
                  <div className="au-member-id">
                    <div className="au-member-name"><span>{displayName(u)}</span>{self && <Badge tone="accent" size="sm">{t('staff.you')}</Badge>}</div>
                    <div className="au-member-badges">
                      <Badge tone={ROLE_TONE[u.role]}>{t(`role.${u.role}`)}</Badge>
                      {!u.active && <Badge dot>{t('staff.deactivated')}</Badge>}
                    </div>
                  </div>
                  <Menu className="au-member-menu" items={menu(u)} trigger={() => <Button variant="ghost" size="sm" icon={<MoreVertical />} aria-label={t('staff.options')} title={t('staff.options')} data-qa="member-menu" />} />
                </div>
                <div className="au-member-meta">
                  <div className="row"><Stethoscope />{u.specialty ? <span className="truncate">{u.specialty}</span> : <span className="au-empty-meta">{t('staff.noSpecialty')}</span>}</div>
                  {u.phone && <div className="row"><Phone /><a className="ltr" href={`tel:${u.phone.replace(/\s+/g, '')}`}>{formatPhone(u.phone)}</a></div>}
                  {u.email && <div className="row"><Mail /><span className="ltr truncate">{u.email}</span></div>}
                </div>
                <div className="au-member-foot">
                  <span className="row" title={seen ? fmtDateTime(seen, lang) : undefined}><Clock /><span className="truncate">{seen ? t('staff.lastLogin', { when: timeAgo(seen, lang) }) : t('staff.neverLoggedIn')}</span></span>
                  <Switch checked={u.active} disabled={readOnly || (self && u.active)} onChange={e => void setActive(u, e.target.checked)} aria-label={t('staff.activeSwitch')} title={self ? t('staff.selfActiveHint') : t('staff.activeSwitch')} data-qa="active-switch" />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <div className="au-staff-lower">
        <PermissionsMatrix />
        <SignInLog rows={logins?.slice(0, 30)} users={all} />
      </div>

      {form && <StaffFormModal open onClose={() => setForm(null)} user={form.user} users={all} />}
      {pinFor && <ResetPinModal user={pinFor} onClose={() => setPinFor(null)} />}
    </div>
  )
}
