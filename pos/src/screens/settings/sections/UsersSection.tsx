import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, KeyRound, Lock, Plus, Trash2, Users, UserX } from 'lucide-react'
import { useStore, toast, confirmDialog } from '../../../state/store'
import { useT } from '../../../i18n'
import { Avatar, Badge, Button, Empty, Field, Input, Modal, Seg, Spinner, SwitchRow } from '../../../components/ui'
import { db } from '../../../db'
import type { Role, User } from '../../../db/types'
import { hashPin } from '../../../lib/hash'
import { uid } from '../../../lib/ids'
import { SectionCard, Note } from '../shared'
import { deleteBlock, deactivateBlock, demoteBlock, normalizePin, validatePin } from '../users'

export default function UsersSection() {
  const t = useT()
  const me = useStore(s => s.user)
  const requirePin = useStore(s => s.settings.pos.requirePin)
  const all = useLiveQuery(() => db.users.toArray(), [])
  const users = useMemo(() => (all ?? []).slice().sort((a, b) => Number(b.active) - Number(a.active) || (a.role === b.role ? a.createdAt - b.createdAt : a.role === 'admin' ? -1 : 1)), [all])
  const [editing, setEditing] = useState<User | null | 'new'>(null)

  return (
    <>
      <div className="row between">
        <span className="small faint">{all ? t('settings.users.count', { n: all.length }) : ''}</span>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>{t('settings.users.add')}</Button>
      </div>
      <div className="card list">
        {!all ? <div className="row" style={{ justifyContent: 'center', padding: 24 }}><Spinner /></div>
          : users.length === 0 ? <Empty icon={<Users size={32} />} title={t('settings.users.empty')} />
          : users.map(u => (
            <button key={u.id} type="button" className="list-row user-row" onClick={() => setEditing(u)}>
              <Avatar name={u.name} round />
              <div className="grow">
                <div className="title row" style={{ gap: 6 }}>{u.name}{me?.id === u.id && <Badge kind="accent">{t('settings.users.you')}</Badge>}</div>
                <div className="role">
                  <Badge kind={u.role === 'admin' ? 'primary' : undefined}>{t(u.role === 'admin' ? 'common.admin' : 'common.cashier')}</Badge>
                  {u.pinHash ? <Badge kind="info"><Lock size={11} /> {t('settings.users.pinSet')}</Badge> : <Badge>{t('settings.users.noPin')}</Badge>}
                  {!u.active && <Badge kind="danger"><UserX size={11} /> {t('common.inactive')}</Badge>}
                </div>
              </div>
            </button>
          ))}
      </div>

      <SectionCard title={t('settings.users.pinInfo.title')} icon={<KeyRound size={16} />}>
        <p className="small muted">{t('settings.users.pinInfo.text')}</p>
        <div className="row wrap">
          <Badge kind={requirePin ? 'primary' : 'warn'}>{t(requirePin ? 'settings.users.pinInfo.on' : 'settings.users.pinInfo.off')}</Badge>
          <Link to="/settings/pos" className="small bold row" style={{ gap: 2 }}>{t('settings.users.pinInfo.link')}<ChevronLeft size={14} className="chev" /></Link>
        </div>
      </SectionCard>

      {editing !== null && <UserModal user={editing === 'new' ? null : editing} users={users} me={me} onClose={() => setEditing(null)} />}
    </>
  )
}

type PinMode = 'keep' | 'set' | 'remove'

function UserModal({ user, users, me, onClose }: { user: User | null; users: User[]; me: User | null; onClose: () => void }) {
  const t = useT()
  const reloadUsers = useStore(s => s.reloadUsers)
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState<Role>(user?.role ?? 'cashier')
  const [active, setActive] = useState(user?.active ?? true)
  const [pinMode, setPinMode] = useState<PinMode>(user?.pinHash ? 'keep' : 'set')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState<{ name?: string; pin?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const isMe = !!user && user.id === me?.id
  const delBlock = user ? deleteBlock(users, user, me?.id) : 'self'
  const deactBlock = user ? deactivateBlock(users, user, me?.id) : null
  const demote = user ? demoteBlock(users, user) : null
  const blockText = (b: 'self' | 'lastAdmin' | null, selfKey: string) => (b === 'lastAdmin' ? t('settings.users.err.lastAdmin') : b === 'self' ? t(selfKey) : undefined)

  const save = async () => {
    const e: { name?: string; pin?: string } = {}
    if (!name.trim()) e.name = t('settings.users.err.name')
    const wantsPin = pinMode === 'set' && (pin.length > 0 || pin2.length > 0)
    if (wantsPin) {
      const v = validatePin(pin, pin2)
      if (v) e.pin = t(v === 'format' ? 'settings.users.err.pinFormat' : 'settings.users.err.pinMatch')
    }
    if (Object.keys(e).length) { setErr(e); return }
    if (role === 'cashier' && user?.role === 'admin' && demote) { toast(t('settings.users.err.lastAdmin'), 'error'); return }
    if (!active && user?.active && deactBlock) { toast(blockText(deactBlock, 'settings.users.err.selfDeactivate') ?? '', 'error'); return }
    setSaving(true)
    try {
      let pinHash: string | undefined = user?.pinHash
      if (pinMode === 'remove') pinHash = undefined
      else if (wantsPin) pinHash = await hashPin(pin)
      const row: User = { id: user?.id ?? uid(), name: name.trim(), role, active, createdAt: user?.createdAt ?? Date.now() }
      if (pinHash) row.pinHash = pinHash
      await db.users.put(row)
      await reloadUsers()
      toast(t('settings.users.saved'), 'success')
      onClose()
    } catch { toast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!user || delBlock) return
    const ok = await confirmDialog({ title: t('settings.users.delete'), text: `${user.name} — ${t('settings.users.deleteText')}`, okLabel: t('common.delete'), danger: true })
    if (!ok) return
    try {
      await db.users.delete(user.id)
      await reloadUsers()
      toast(t('settings.users.deleted'), 'success')
      onClose()
    } catch { toast(t('common.error'), 'error') }
  }

  const pinInput = (v: string, set: (s: string) => void, label: string, autoFocus?: boolean) => (
    <Field label={label}>
      <Input type="password" inputMode="numeric" autoComplete="new-password" className="ltr" value={v} maxLength={6} placeholder="••••" autoFocus={autoFocus}
        onChange={e => { set(normalizePin(e.target.value)); setErr(null) }} invalid={!!err?.pin} onKeyDown={e => { if (e.key === 'Enter') void save() }} />
    </Field>
  )

  return (
    <Modal open onClose={onClose} title={user ? t('settings.users.edit') : t('settings.users.add')} footer={
      <>
        {user && !delBlock && <Button variant="soft-danger" icon={<Trash2 size={16} />} onClick={() => void remove()} disabled={saving} style={{ flex: '0 0 auto' }} aria-label={t('settings.users.delete')} iconOnly />}
        <Button onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => void save()} loading={saving}>{t('common.save')}</Button>
      </>
    }>
      <div className="col" style={{ gap: 14 }}>
        <Field label={t('settings.users.name')} error={err?.name}>
          <Input value={name} onChange={e => { setName(e.target.value); setErr(null) }} placeholder={t('settings.users.namePh')} maxLength={40} invalid={!!err?.name} autoFocus={!user} onKeyDown={e => { if (e.key === 'Enter') void save() }} />
        </Field>
        <Field label={t('settings.users.role')} hint={demote && role === 'admin' ? t('settings.users.err.lastAdmin') : t(role === 'admin' ? 'settings.users.roleAdminDesc' : 'settings.users.roleCashierDesc')}>
          <Seg<Role> block value={role} onChange={v => { if (v === 'cashier' && demote) { toast(t('settings.users.err.lastAdmin'), 'warn'); return } setRole(v) }}
            options={[{ value: 'admin', label: t('common.admin') }, { value: 'cashier', label: t('common.cashier') }]} />
        </Field>

        <div className="col" style={{ gap: 8 }}>
          <span className="label">{t('settings.users.pin')} <span className="faint" style={{ fontWeight: 400 }}>— {t('settings.users.pinHint')}</span></span>
          {pinMode === 'keep' && (
            <div className="row wrap">
              <Badge kind="info"><Lock size={11} /> {t('settings.users.pinCurrent')}</Badge>
              <Button size="sm" onClick={() => setPinMode('set')}>{t('settings.users.pinChange')}</Button>
              <Button size="sm" variant="soft-danger" onClick={() => setPinMode('remove')}>{t('settings.users.pinRemove')}</Button>
            </div>
          )}
          {pinMode === 'remove' && (
            <div className="row wrap">
              <Badge kind="warn">{t('settings.users.pinRemoved')}</Badge>
              <Button size="sm" onClick={() => setPinMode('keep')}>{t('settings.users.pinKeep')}</Button>
            </div>
          )}
          {pinMode === 'set' && (
            <>
              <div className="form-grid">
                {pinInput(pin, setPin, t('settings.users.pinNew'), !!user)}
                {pinInput(pin2, setPin2, t('settings.users.pinConfirm'))}
              </div>
              {err?.pin ? <span className="xs" style={{ color: 'var(--danger)' }}>{err.pin}</span> : <span className="xs faint">{t('settings.users.pinNoneDesc')}</span>}
              {user?.pinHash && <div><Button size="sm" variant="ghost" onClick={() => { setPinMode('keep'); setPin(''); setPin2('') }}>{t('settings.users.pinKeep')}</Button></div>}
            </>
          )}
        </div>

        <SwitchRow label={t('settings.users.active')} desc={active && deactBlock ? blockText(deactBlock, 'settings.users.err.selfDeactivate') : t('settings.users.activeDesc')} on={active} onChange={setActive} disabled={active && !!deactBlock} />
        {user && delBlock && !isMe && <Note kind="warn">{t('settings.users.err.lastAdmin')}</Note>}
      </div>
    </Modal>
  )
}
