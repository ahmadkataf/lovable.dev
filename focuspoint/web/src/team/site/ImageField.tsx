// Image widgets: one photo (preview, «تغيير الصورة», alt text, «إزالة» / «الأصل») and a gallery (add / remove /
// reorder, a size limit). A picked file is shrunk in the browser (./image) and uploaded to POST /v1/admin/media with
// a progress bar; the value only changes once the upload succeeded, so a failed upload never leaves a broken picture.
// Used by the site editor and by the room sheet (Rooms.tsx: «الصور», ≤8).
import { useId, useRef, useState, type ChangeEvent } from 'react'
import type { Photo } from '@shared/types'
import { useOnline } from '../../offline'
import { Button, Icon, Input } from '../../ui'
import { cx } from '../util'
import { ImageError, prepareImage } from './image'
import { mediaUrl, siteErrorText, uploadMedia } from './media'
import { deepEqual } from './value'

type Phase = { kind: 'idle' } | { kind: 'preparing'; label: string } | { kind: 'uploading'; label: string; progress: number }

/** Shrink + upload one file; reports progress through setPhase. Throws Arabic errors. */
async function uploadFile(file: File, alt: string, setPhase: (p: Phase) => void, label = ''): Promise<Photo> {
  setPhase({ kind: 'preparing', label: label || 'عم نجهّز الصورة…' })
  const img = await prepareImage(file)
  setPhase({ kind: 'uploading', label: label || 'عم نرفع الصورة…', progress: 0 })
  const res = await uploadMedia(img.blob, img.w, img.h, (p) => setPhase({ kind: 'uploading', label: label || 'عم نرفع الصورة…', progress: p }))
  return { src: res.src, alt, w: res.w || img.w, h: res.h || img.h }
}
const errorText = (err: unknown) => (err instanceof ImageError ? err.message : siteErrorText(err))

const isPhoto = (v: unknown): v is Photo => !!v && typeof v === 'object' && typeof (v as Photo).src === 'string'

function Thumb({ photo, className }: { photo: Photo | null; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  if (!photo) return <div className={cx('se-thumb is-empty', className)}><Icon name="image" size={28} /><span>بلا صورة</span></div>
  if (broken === photo.src) return <div className={cx('se-thumb is-empty', className)}><Icon name="image" size={28} /><span>ما قدرنا نعرض الصورة</span></div>
  return (
    <div className={cx('se-thumb', className)}>
      <img src={mediaUrl(photo.small || photo.src)} alt={photo.alt} width={photo.w} height={photo.h} loading="lazy" decoding="async" onError={() => setBroken(photo.src)} />
    </div>
  )
}

function Progress({ phase }: { phase: Phase }) {
  if (phase.kind === 'idle') return null
  const pct = phase.kind === 'uploading' ? Math.round(phase.progress * 100) : null
  return (
    <div className="se-progress" role="status" aria-live="polite">
      <span className="spinner spinner-sm" aria-hidden="true" />
      <span>{phase.label}{pct !== null ? ` ${pct}%` : ''}</span>
      {pct !== null && <span className="se-bar"><span style={{ width: `${pct}%` }} /></span>}
    </div>
  )
}

/** A hidden file input inside a button-styled label (opens the camera / gallery chooser on phones). */
function PickButton({ label, onFiles, multiple = false, disabled, variant = 'soft' }: { label: string; onFiles: (f: File[]) => void; multiple?: boolean; disabled?: boolean; variant?: 'soft' | 'primary' }) {
  const id = useId()
  function change(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  return (
    <label htmlFor={id} className={cx('btn', `btn-${variant}`, 'btn-md', 'se-pick', disabled && 'is-disabled')} aria-disabled={disabled || undefined}>
      <Icon name="image" size={18} /> {label}
      <input id={id} type="file" accept="image/*" multiple={multiple} className="se-file" disabled={disabled} onChange={change} />
    </label>
  )
}

export interface ImageFieldProps {
  value: Photo | null
  onChange: (v: Photo | null) => void
  /** null allowed («إزالة») */
  optional?: boolean
  /** today's default, for «الأصل»; undefined hides the button */
  def?: Photo | null
}

/** One photo. */
export function ImageField({ value, onChange, optional = false, def }: ImageFieldProps) {
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const altId = useId()
  const photo = isPhoto(value) ? value : null
  const latest = useRef(photo)
  latest.current = photo
  const busy = phase.kind !== 'idle'

  async function pick(files: File[]) {
    const file = files[0]
    if (!file) return
    setError(null)
    try {
      const p = await uploadFile(file, '', setPhase)
      onChange({ ...p, alt: latest.current?.alt ?? '' })     // keeps an alt text typed while the upload ran
    } catch (err) { setError(errorText(err)) } finally { setPhase({ kind: 'idle' }) }
  }
  const showDefault = def !== undefined && !deepEqual(photo, def ?? null)
  return (
    <div className="se-image">
      <div className="se-image-row">
        <Thumb photo={photo} className="se-thumb-lg" />
        <div className="se-image-actions">
          <PickButton label={photo ? 'تغيير الصورة' : 'إضافة صورة'} onFiles={pick} disabled={busy || !online} />
          {optional && photo && <Button variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}><Icon name="trash" size={16} /> إزالة</Button>}
          {showDefault && <Button variant="ghost" size="sm" disabled={busy} onClick={() => onChange(def ?? null)}><Icon name="undo" size={16} /> الأصل</Button>}
        </div>
      </div>
      <Progress phase={phase} />
      {!online && <p className="se-note"><Icon name="cloudOff" size={14} /> رفع الصور يحتاج إنترنت</p>}
      {error && <div className="alert alert-error mt-sm" role="alert">{error}</div>}
      {photo && (
        <div className="se-alt">
          <label className="field-label" htmlFor={altId}>وصف الصورة</label>
          <Input id={altId} value={photo.alt} maxLength={200} placeholder="شو بتبيّن الصورة؟ مثال: قاعة الاجتماعات مع الشاشة"
            onChange={(e) => onChange({ ...photo, alt: e.target.value })} />
          <span className="field-hint">لقارئ الشاشة ولـ Google، وبيطلع تحت الصورة بالمعرض.</span>
        </div>
      )}
    </div>
  )
}

export interface ImagesFieldProps {
  value: Photo[]
  onChange: (v: Photo[]) => void
  max?: number
  /** data-path prefix of each photo (`${prefix}.${i}`), so a validation error can point at one photo */
  pathPrefix?: string
  errorPath?: string | null
}

/** A list of photos: add (several at once), remove, move up/down, alt text per photo. */
export function ImagesField({ value, onChange, max = 12, pathPrefix, errorPath }: ImagesFieldProps) {
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const photos = Array.isArray(value) ? value.filter(isPhoto) : []
  const latest = useRef(photos)
  latest.current = photos
  const busy = phase.kind !== 'idle'
  const room = max - photos.length

  async function add(files: File[]) {
    setError(null)
    const take = files.slice(0, Math.max(0, max - latest.current.length))
    const skipped = files.length - take.length
    try {
      for (let i = 0; i < take.length; i++) {
        const label = take.length > 1 ? `صورة ${i + 1} من ${take.length}…` : ''
        const p = await uploadFile(take[i] as File, '', setPhase, label)
        const next = [...latest.current, p]
        latest.current = next
        onChange(next)
      }
      if (skipped > 0) setError(`الحد الأقصى ${max} صور — ما انضافت ${skipped}`)
    } catch (err) { setError(errorText(err)) } finally { setPhase({ kind: 'idle' }) }
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= photos.length) return
    const next = photos.slice()
    ;[next[i], next[j]] = [next[j] as Photo, next[i] as Photo]
    onChange(next)
  }
  const replace = async (i: number, files: File[]) => {
    const file = files[0]
    if (!file) return
    setError(null)
    try {
      const p = await uploadFile(file, photos[i]?.alt ?? '', setPhase)
      const next = latest.current.slice()
      next[i] = p
      onChange(next)
    } catch (err) { setError(errorText(err)) } finally { setPhase({ kind: 'idle' }) }
  }

  return (
    <div className="se-gallery">
      {photos.length === 0 && <p className="muted small">ما في صور بعد.</p>}
      <ol className="se-gallery-list">
        {photos.map((p, i) => (
          <li key={`${p.src}-${i}`} className={cx('se-gitem', errorPath === `${pathPrefix}.${i}` && 'has-error')} data-path={pathPrefix ? `${pathPrefix}.${i}` : undefined}>
            <Thumb photo={p} />
            <div className="se-gitem-body">
              <Input value={p.alt} maxLength={200} placeholder="وصف الصورة" aria-label={`وصف الصورة ${i + 1}`}
                onChange={(e) => { const next = photos.slice(); next[i] = { ...p, alt: e.target.value }; onChange(next) }} />
              <div className="se-gitem-actions">
                <span className="se-num" aria-hidden="true">{i + 1}</span>
                <button type="button" className="icon-btn" disabled={i === 0 || busy} onClick={() => move(i, -1)} aria-label={`الصورة ${i + 1} لقدّام`} title="لقدّام"><Icon name="arrowUp" size={18} /></button>
                <button type="button" className="icon-btn" disabled={i === photos.length - 1 || busy} onClick={() => move(i, 1)} aria-label={`الصورة ${i + 1} لورا`} title="لورا"><Icon name="arrowDown" size={18} /></button>
                <ReplaceButton disabled={busy || !online} onFiles={(f) => void replace(i, f)} index={i} />
                <button type="button" className="icon-btn se-danger" disabled={busy} onClick={() => onChange(photos.filter((_, k) => k !== i))} aria-label={`حذف الصورة ${i + 1}`} title="حذف"><Icon name="trash" size={18} /></button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Progress phase={phase} />
      {error && <div className="alert alert-error mt-sm" role="alert">{error}</div>}
      <div className="se-gallery-foot">
        <PickButton label="إضافة صور" multiple onFiles={(f) => void add(f)} disabled={busy || !online || room <= 0} />
        <span className="muted tiny">{photos.length} من {max}</span>
      </div>
      {!online && <p className="se-note"><Icon name="cloudOff" size={14} /> رفع الصور يحتاج إنترنت</p>}
    </div>
  )
}

function ReplaceButton({ onFiles, disabled, index }: { onFiles: (f: File[]) => void; disabled?: boolean; index: number }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('icon-btn', 'se-pick-icon', disabled && 'is-disabled')} title="تغيير" aria-label={`تغيير الصورة ${index + 1}`}>
      <Icon name="edit" size={18} />
      <input id={id} type="file" accept="image/*" className="se-file" disabled={disabled}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) onFiles(f) }} />
    </label>
  )
}
