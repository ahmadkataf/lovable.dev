import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen, Pencil, Plus, Trash } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { ClinicalNote } from '@/db/types'
import { newId, nowISO, todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDoctors, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Avatar, Button, Card, CardHeader, EmptyState, IconButton, Input, Kbd, Modal, Select, Skeleton, Textarea, useConfirmDelete, useToast } from '@/ui'
import { fmtDate, timeAgo } from '@/lib/dates'
import { colorFor } from '@/lib/format'
import { sortNotes } from '@/features/patients/lib'
import { useGuardedClose } from '@/features/patients/parts'
import './files.css'

export default function NotesSection({ patientId }: { patientId: string }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const session = useSession()
  const users = useUsers(false)
  const confirmDelete = useConfirmDelete()
  const { readOnly } = useLicense()
  const [editing, setEditing] = useState<ClinicalNote | 'new' | null>(null)
  const raw = useLiveQuery(() => db.notes.where('patientId').equals(patientId).toArray(), [patientId])
  const notes = useMemo(() => (raw ? sortNotes(raw) : undefined), [raw])
  const canWrite = session.can('clinical') && !readOnly
  const user = (id?: string) => users.find(u => u.id === id)

  const remove = async (n: ClinicalNote) => {
    if (!(await confirmDelete(t('patients.notes.deleteConfirm')))) return
    await db.notes.delete(n.id)
    toast.success(t('patients.notes.deleted'))
  }
  const addBtn = session.can('clinical') && <Button size="sm" variant="soft" icon={<Plus />} onClick={() => setEditing('new')} disabled={!canWrite}>{t('patients.notes.add')}</Button>

  return (
    <Card className="pt-notes">
      <CardHeader icon={<NotebookPen />} title={t('patients.notes.title')} subtitle={t('patients.notes.subtitle')} actions={notes && notes.length > 0 ? addBtn : undefined} />
      {notes === undefined ? (
        <div className="pt-note"><Skeleton w={36} h={36} r={18} /><div className="grow col gap-2"><Skeleton w="30%" h={12} /><Skeleton h={12} /><Skeleton w="70%" h={12} /></div></div>
      ) : notes.length === 0 ? (
        <EmptyState icon={<NotebookPen />} title={t('patients.notes.empty.title')} description={t('patients.notes.empty.desc')} actions={addBtn || undefined} />
      ) : (
        <ol className="pt-note-list">
          {notes.map(n => {
            const doc = user(n.doctorId)
            const name = doc?.name ?? t('patients.notes.unknownDoctor')
            return (
              <li key={n.id} className="pt-note">
                <Avatar name={name} size="sm" color={doc?.color || colorFor(name)} />
                <div className="grow">
                  <div className="pt-note-head">
                    <span className="strong">{name}</span>
                    <span className="pt-note-date">{fmtDate(n.date, lang, 'long')}</span>
                    {n.updatedAt !== n.createdAt && <span className="subtle text-xs" title={fmtDate(n.updatedAt, lang)}>· {t('patients.notes.edited')} {timeAgo(n.updatedAt, lang)}</span>}
                    {canWrite && (
                      <span className="pt-note-actions">
                        <IconButton size="sm" variant="ghost" label={t('edit')} onClick={() => setEditing(n)}><Pencil /></IconButton>
                        <IconButton size="sm" variant="ghost" label={t('delete')} onClick={() => void remove(n)}><Trash /></IconButton>
                      </span>
                    )}
                  </div>
                  <p className="pt-note-text" dir="auto">{n.text}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {editing && <NoteModal patientId={patientId} note={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function NoteModal({ patientId, note, onClose }: { patientId: string; note?: ClinicalNote; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const session = useSession()
  const doctors = useDoctors()
  const me = session.user
  const [date, setDate] = useState(note?.date ?? todayISO())
  const [doctorId, setDoctorId] = useState(note?.doctorId ?? (me && (me.role === 'doctor' || me.role === 'admin') ? me.id : ''))
  const [text, setText] = useState(note?.text ?? '')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false) // a second Ctrl+Enter / click before the first save lands must not add the note twice
  const dirty = text.trim() !== (note?.text ?? '').trim() || date !== (note?.date ?? todayISO()) || (!!note && doctorId !== (note.doctorId ?? ''))
  const requestClose = useGuardedClose(dirty, onClose, busy)
  const textError = tried && !text.trim() ? t('v.required') : undefined
  const dateError = tried && !date ? t('v.required') : undefined

  const save = async () => {
    setTried(true)
    if (busy.current || !text.trim() || !date) return
    busy.current = true
    setSaving(true)
    try {
      const now = nowISO()
      const id = note?.id ?? newId()
      if (note) await db.notes.update(note.id, { date, doctorId: doctorId || undefined, text: text.trim(), updatedAt: now })
      else await db.notes.add({ id, patientId, date, doctorId: doctorId || undefined, text: text.trim(), createdAt: now, updatedAt: now })
      void logActivity({ type: 'patient', action: note ? 'update' : 'other', entityId: id, patientId, message: `${t('patients.notes.logged')}: ${text.trim().slice(0, 60)}`, by: me?.id })
      toast.success(t('patients.notes.saved'))
      onClose()
    } catch {
      toast.error(t('patients.saveFailed'))
      busy.current = false
      setSaving(false)
    }
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save() } }
  const doctorOptions = [{ value: '', label: t('patients.notes.unknownDoctor') }, ...doctors.map(d => ({ value: d.id, label: d.name }))]

  return (
    <Modal open onClose={() => void requestClose()} size="md" closeOnOverlay={false} icon={<NotebookPen />} title={note ? t('patients.notes.edit') : t('patients.notes.add')}
      footer={<>
        <span className="start subtle text-xs hide-mobile"><Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> {t('patients.notes.toSave')}</span>
        <Button variant="ghost" onClick={() => void requestClose()}>{t('cancel')}</Button>
        <Button variant="primary" onClick={save} loading={saving}>{t('save')}</Button>
      </>}>
      <div className="col gap-4" onKeyDown={onKey}>
        <div className="form-grid">
          <Input label={t('date')} type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} error={dateError} required />
          <Select label={t('doctor')} value={doctorId} onChange={e => setDoctorId(e.target.value)} options={doctorOptions} />
        </div>
        <Textarea label={t('patients.notes.text')} required value={text} onChange={e => setText(e.target.value)} placeholder={t('patients.notes.placeholder')} rows={7} error={textError} dir="auto" />
      </div>
    </Modal>
  )
}
