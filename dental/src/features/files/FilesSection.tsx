import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronLeft, ChevronRight, Download, FileText, FolderOpen, ImageOff, Paperclip, ScanLine, Signature, Trash, Upload, File as FileIcon } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { FileKind, PatientFile } from '@/db/types'
import { newId, nowISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Badge, Button, Card, CardHeader, Chip, EmptyState, Field, IconButton, Input, Modal, NumberInput, Select, Skeleton, Textarea, useConfirmDelete, useToast, type Tone } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { formatBytes } from '@/lib/format'
import { imageToDataUrl, pickFile, platform, saveFile } from '@/platform'
import { countByKind, fileShape, guessKind, isValidTooth, MAX_FILE_MB } from '@/features/patients/lib'
import './files.css'

export const FILE_KINDS: FileKind[] = ['xray', 'photo', 'document', 'consent', 'other']
export const KIND_ICON: Record<FileKind, ReactNode> = { xray: <ScanLine />, photo: <Camera />, document: <FileText />, consent: <Signature />, other: <Paperclip /> }
export const KIND_TONE: Record<FileKind, Tone> = { xray: 'purple', photo: 'pink', document: 'info', consent: 'success', other: 'default' }
const ACCEPT = 'image/*,.pdf,application/pdf'

/** An object URL for a blob that lives as long as the component shows it (created and revoked in the same effect, so StrictMode's re-run cannot leave a revoked URL behind). */
function useObjectUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export default function FilesSection({ patientId }: { patientId: string }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const { readOnly } = useLicense()
  const [kind, setKind] = useState<FileKind | 'all'>('all')
  const [pending, setPending] = useState<File | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const files = useLiveQuery(async () => (await db.files.where('patientId').equals(patientId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [patientId])
  const counts = useMemo(() => countByKind(files ?? []), [files])
  const shown = useMemo(() => (files ?? []).filter(f => kind === 'all' || f.kind === kind), [files, kind])
  useEffect(() => { if (kind !== 'all' && files && counts[kind] === 0) setKind('all') }, [counts, kind, files])

  const accept = (f: File | null | undefined) => {
    if (!f) return
    if (fileShape(f.type, f.name) === 'other') { toast.error(t('patients.files.unsupported')); return }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { toast.error(t('patients.files.tooLarge', { max: MAX_FILE_MB })); return }
    setPending(f)
  }
  const choose = async () => accept(await pickFile(ACCEPT))
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (!readOnly) accept(e.dataTransfer.files?.[0]) }
  const index = shown.findIndex(f => f.id === previewId)

  const uploadBtn = <Button variant="primary" size="sm" icon={<Upload />} onClick={choose} disabled={readOnly}>{t('patients.files.upload')}</Button>
  return (
    <Card className={`pt-files${dragging ? ' dragging' : ''}`}
      onDragOver={e => { if (!readOnly && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false) }} onDrop={onDrop}>
      <CardHeader icon={<FolderOpen />} title={t('patients.files.title')} subtitle={t('patients.files.subtitle')} actions={files && files.length > 0 ? uploadBtn : undefined} />
      {files === undefined ? (
        <div className="pt-files-body"><div className="pt-files-grid">{[0, 1, 2, 3].map(i => <div key={i} className="pt-file"><Skeleton className="pt-file-thumb" h="auto" r={0} /><div className="pt-file-body"><Skeleton w="70%" h={12} /><Skeleton className="mt-2" w="40%" h={10} /></div></div>)}</div></div>
      ) : files.length === 0 ? (
        <EmptyState icon={<FolderOpen />} title={t('patients.files.empty.title')} description={t('patients.files.empty.desc')} actions={<>{uploadBtn}</>} />
      ) : (
        <div className="pt-files-body">
          <div className="pt-kind-chips">
            <Chip active={kind === 'all'} onClick={() => setKind('all')}>{t('all')}<span className="pt-chip-count num">{counts.all}</span></Chip>
            {FILE_KINDS.filter(k => counts[k] > 0).map(k => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)} icon={KIND_ICON[k]}>{t(`fileKind.${k}`)}<span className="pt-chip-count num">{counts[k]}</span></Chip>
            ))}
          </div>
          <div className="pt-files-grid">
            {shown.map(f => (
              <button key={f.id} type="button" className="pt-file" onClick={() => setPreviewId(f.id)}>
                <span className="pt-file-thumb">
                  {f.thumb ? <img src={f.thumb} alt="" loading="lazy" /> : <span className={`pt-file-doc shape-${fileShape(f.mime, f.name)}`}><FileIcon /><span className="pt-file-ext">{(f.name.split('.').pop() || '').toUpperCase().slice(0, 4)}</span></span>}
                  <span className="pt-file-kind"><Badge tone={KIND_TONE[f.kind]} icon={KIND_ICON[f.kind]}>{t(`fileKind.${f.kind}`)}</Badge></span>
                  {f.tooth && <span className="pt-file-tooth"><span className="num">{f.tooth}</span></span>}
                </span>
                <span className="pt-file-body">
                  <span className="pt-file-name truncate"><bdi>{f.note || f.name}</bdi></span>
                  <span className="pt-file-meta"><span className="pt-nowrap">{fmtDate(f.createdAt, lang)}</span><span className="num pt-file-size">{formatBytes(f.size)}</span></span>
                </span>
              </button>
            ))}
          </div>
          {!readOnly && <button type="button" className="pt-dropzone hide-mobile" onClick={choose}><Upload />{t('patients.files.dropHint')}</button>}
        </div>
      )}

      {pending && <UploadModal file={pending} patientId={patientId} onClose={() => setPending(null)} onSaved={k => setKind(cur => (cur === 'all' || cur === k ? cur : 'all'))} />}
      {previewId && index >= 0 && (
        <PreviewModal file={shown[index]} onClose={() => setPreviewId(null)}
          onPrev={index > 0 ? () => setPreviewId(shown[index - 1].id) : undefined}
          onNext={index < shown.length - 1 ? () => setPreviewId(shown[index + 1].id) : undefined}
          position={shown.length > 1 ? `${index + 1} / ${shown.length}` : undefined} />
      )}
    </Card>
  )
}

function KindPicker({ value, onChange }: { value: FileKind; onChange: (k: FileKind) => void }) {
  const { t } = useI18n()
  return (
    <div className="pt-kind-grid" role="radiogroup">
      {FILE_KINDS.map(k => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={`pt-kind${value === k ? ' active' : ''}`} onClick={() => onChange(k)}>
          {KIND_ICON[k]}<span>{t(`fileKind.${k}`)}</span>
        </button>
      ))}
    </div>
  )
}

function UploadModal({ file, patientId, onClose, onSaved }: { file: File; patientId: string; onClose: () => void; onSaved?: (kind: FileKind) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const session = useSession()
  const [kind, setKind] = useState<FileKind>(() => guessKind(file.type, file.name))
  const [name, setName] = useState(file.name)
  const [note, setNote] = useState('')
  const [tooth, setTooth] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false) // clicks/Enter in the same frame must not store the file twice
  const [tried, setTried] = useState(false)
  const image = fileShape(file.type, file.name) === 'image'
  const url = useObjectUrl(image ? file : null)
  const toothError = tooth !== null && !isValidTooth(tooth) ? t('patients.files.toothInvalid') : undefined
  const nameError = tried && !name.trim() ? t('v.required') : undefined

  const save = async () => {
    setTried(true)
    if (busy.current || toothError || !name.trim()) return
    busy.current = true
    setSaving(true)
    try {
      const thumb = image ? await imageToDataUrl(file, 240).catch(() => undefined) : undefined
      const id = newId()
      const mime = file.type || (fileShape(file.type, file.name) === 'pdf' ? 'application/pdf' : 'application/octet-stream')
      const rec: PatientFile = { id, patientId, kind, name: name.trim(), mime, size: file.size, data: file, thumb, note: note.trim() || undefined, tooth: tooth ?? undefined, createdAt: nowISO(), by: session.user?.id }
      await db.files.add(rec)
      void logActivity({ type: 'file', action: 'create', entityId: id, patientId, message: t('patients.files.logUpload', { name: rec.name }), by: session.user?.id })
      toast.success(t('patients.files.uploaded'), rec.name)
      onSaved?.(kind) // a new x-ray must not stay hidden behind a "photos" filter
      onClose()
    } catch {
      toast.error(t('patients.files.uploadFailed'))
      busy.current = false
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('patients.files.add')} icon={<Upload />} size="md" closeOnOverlay={false}
      footer={<><Button variant="ghost" onClick={onClose}>{t('cancel')}</Button><Button variant="primary" icon={<Upload />} loading={saving} onClick={save}>{t('patients.files.save')}</Button></>}>
      <form className="col gap-4" onSubmit={e => { e.preventDefault(); void save() }}>
        <div className="pt-upload-file">
          <span className="pt-upload-thumb">{url ? <img src={url} alt="" /> : <FileText />}</span>
          <div className="grow"><div className="strong truncate"><bdi>{file.name}</bdi></div><div className="muted text-sm"><span className="num">{formatBytes(file.size)}</span></div></div>
        </div>
        <Field label={t('patients.files.kind')}><KindPicker value={kind} onChange={setKind} /></Field>
        <Input label={t('patients.files.name')} value={name} onChange={e => setName(e.target.value)} error={nameError} dir="auto" />
        <div className="form-grid">
          <div className="span-2"><Textarea label={t('patients.files.note')} value={note} onChange={e => setNote(e.target.value)} placeholder={t('patients.files.notePlaceholder')} rows={2} /></div>
          <NumberInput label={t('patients.files.tooth')} value={tooth} onChange={setTooth} decimals={0} error={toothError} placeholder="11–48" hint={!toothError ? t('patients.files.toothHint') : undefined} />
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

function PreviewModal({ file, onClose, onPrev, onNext, position }: { file: PatientFile; onClose: () => void; onPrev?: () => void; onNext?: () => void; position?: string }) {
  const { t, lang, isRTL } = useI18n()
  const toast = useToast()
  const session = useSession()
  const users = useUsers(false)
  const confirmDelete = useConfirmDelete()
  const { readOnly } = useLicense()
  const shape = fileShape(file.mime, file.name)
  const url = useObjectUrl(file.data instanceof Blob ? file.data : null)
  const [kind, setKind] = useState<FileKind>(file.kind)
  const [note, setNote] = useState(file.note ?? '')
  const [tooth, setTooth] = useState<number | null>(file.tooth ?? null)
  const [saving, setSaving] = useState(false)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setKind(file.kind); setNote(file.note ?? ''); setTooth(file.tooth ?? null); setBroken(false) }, [file.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = kind !== file.kind || note.trim() !== (file.note ?? '') || (tooth ?? undefined) !== file.tooth
  const toothError = tooth !== null && !isValidTooth(tooth) ? t('patients.files.toothInvalid') : undefined
  const by = users.find(u => u.id === file.by)?.name

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return
      if (e.key === 'ArrowLeft') (isRTL ? onNext : onPrev)?.()
      if (e.key === 'ArrowRight') (isRTL ? onPrev : onNext)?.()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onPrev, onNext, isRTL])

  const save = async () => {
    if (toothError || !dirty || saving) return
    setSaving(true)
    try {
      await db.files.update(file.id, { kind, note: note.trim() || undefined, tooth: tooth ?? undefined })
      toast.success(t('patients.files.noteSaved'))
    } catch {
      toast.error(t('patients.saveFailed'))
    } finally { setSaving(false) }
  }
  const download = async () => { if (file.data instanceof Blob && await saveFile(file.name, file.data)) toast.success(t('patients.files.downloaded')) }
  const remove = async () => {
    if (!(await confirmDelete(t('patients.files.deleteConfirm')))) return
    try {
      await db.files.delete(file.id)
      void logActivity({ type: 'file', action: 'delete', entityId: file.id, patientId: file.patientId, message: t('patients.files.logDelete', { name: file.name }), by: session.user?.id })
      toast.success(t('patients.files.deleted'), file.name)
      onClose()
    } catch {
      toast.error(t('patients.deleteFailed'))
    }
  }
  const Prev = isRTL ? ChevronRight : ChevronLeft, Next = isRTL ? ChevronLeft : ChevronRight
  // an inline PDF needs the browser's viewer (desktop Chrome / Electron); Android WebView and headless browsers get the download fallback
  const canFrame = shape === 'pdf' && platform() !== 'android' && (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false

  return (
    <Modal open onClose={onClose} size="xl" icon={KIND_ICON[file.kind]} title={<span className="truncate"><bdi>{file.name}</bdi></span>}
      subtitle={<>{t(`fileKind.${file.kind}`)} · {fmtDate(file.createdAt, lang, 'long')}{position && <> · <span className="num">{position}</span></>}</>}
      footer={<>
        <Button variant="danger-soft" className="start" icon={<Trash />} onClick={remove} disabled={readOnly}>{t('delete')}</Button>
        <Button icon={<Download />} onClick={download}>{t('patients.files.download')}</Button>
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty || readOnly || !!toothError}>{t('saveChanges')}</Button>
      </>}>
      <div className="pt-preview">
        <div className={`pt-stage shape-${shape}`}>
          {shape === 'image' && url && !broken ? <img src={url} alt={file.name} onError={() => setBroken(true)} />
            : canFrame && url ? <iframe src={url} title={file.name} />
            : (
              <div className="pt-stage-fallback">
                {broken ? <ImageOff /> : <FileText />}
                <div>{t('patients.files.pdfFallback')}</div>
                <Button variant="primary" icon={<Download />} onClick={download}>{t('patients.files.download')}</Button>
              </div>
            )}
          {onPrev && <IconButton label={t('previous')} className="pt-stage-nav prev" onClick={onPrev}><Prev /></IconButton>}
          {onNext && <IconButton label={t('next')} className="pt-stage-nav next" onClick={onNext}><Next /></IconButton>}
        </div>
        <div className="pt-preview-side">
          <Field label={t('patients.files.kind')}>
            <Select value={kind} onChange={e => setKind(e.target.value as FileKind)} disabled={readOnly} options={FILE_KINDS.map(k => ({ value: k, label: t(`fileKind.${k}`) }))} />
          </Field>
          <NumberInput label={t('patients.files.tooth')} value={tooth} onChange={setTooth} decimals={0} error={toothError} disabled={readOnly} placeholder="—" />
          <Textarea label={t('patients.files.note')} value={note} onChange={e => setNote(e.target.value)} placeholder={t('patients.files.notePlaceholder')} rows={4} disabled={readOnly} />
          <dl className="pt-file-facts">
            <dt>{t('patients.files.size')}</dt><dd><span className="num">{formatBytes(file.size)}</span></dd>
            <dt>{t('date')}</dt><dd>{fmtDate(file.createdAt, lang)}</dd>
            {by && <><dt>{t('patients.files.uploadedBy')}</dt><dd>{by}</dd></>}
          </dl>
        </div>
      </div>
    </Modal>
  )
}
