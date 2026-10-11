// Pieces of the backup screens shared by Settings → Backup and the setup wizard's "restore from a backup".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff, FolderOpen, HardDriveDownload, LockKeyhole } from 'lucide-react'
import { Alert, Button, Input, Modal, ProgressBar, Switch } from '@/ui'
import { useI18n } from '@/i18n'
import { formatBytes } from '@/lib/format'
import { pickFile, SaveError } from '@/platform'
import { BACKUP_ACCEPT, BackupError, detectBackup, readBackup, type BackupProgress, type BackupStage, type ReadResult } from './archive'
import { MIN_PASSWORD } from './crypto'
import './backup.css'

type T = (key: string, params?: Record<string, string | number>) => string

/** A value set left to right inside a sentence (file names, sizes): Unicode isolates keep "19.9 MB" from turning
 *  into "MB 19.9" in Arabic. `auto` takes the direction of the value's first letter (Arabic or Latin file names). */
export const ltr = (s: string) => `\u2066${s}\u2069`
export const isolate = (s: string) => `\u2068${s}\u2069`
/** "أشعة 1.jpg، صورة.png…": the names of the damaged files, a few of them. */
export const namesLine = (names: string[]) => names.slice(0, 5).map(isolate).join('، ') + (names.length > 5 ? '…' : '')

/** The message for anything a backup or restore throws; null when the user stopped it. */
export function backupErrorText(t: T, e: unknown): string | null {
  if (e instanceof SaveError) return e.reason === 'aborted' ? null : t(`backup.save.${e.reason}`)
  if (e instanceof BackupError) return t(`backup.err.${e.reason}`)
  if ((e as Error)?.name === 'AbortError') return null
  return t('backup.err.failed')
}

/** What the progress dialog shows: a stage, and bytes (or rows) done out of a total when known. */
export type ProgressState = { stage: BackupStage | 'start' | 'finishing' | 'choose' | 'apply'; done?: number; total?: number }

export function BackupProgressModal({ open, title, state, onStop }: { open: boolean; title: ReactNode; state: ProgressState | null; onStop?: () => void }) {
  const { t } = useI18n()
  const s = state ?? { stage: 'start' as const }
  const measured = (s.stage === 'files' || s.stage === 'decrypt' || s.stage === 'check' || s.stage === 'tables') && !!s.total
  const bytes = s.stage === 'files' || s.stage === 'decrypt' || s.stage === 'check'
  return (
    <Modal open={open} onClose={() => { /* runs to the end, or Stop */ }} closeOnOverlay={false} size="sm">
      <div className="bk-progress" data-qa="backup-progress" aria-live="polite">
        <div className="bk-progress-head">
          <span className="bk-icon"><HardDriveDownload /></span>
          <span className="bk-progress-title">{title}</span>
        </div>
        <div className="bk-progress-stage">
          <span>{t(`backup.stage.${s.stage === 'choose' ? 'chooseAndroid' : s.stage}`)}</span>
          {measured && bytes && <span className="bk-progress-amount">{t('backup.of', { done: ltr(formatBytes(s.done ?? 0)), total: ltr(formatBytes(s.total ?? 0)) })}</span>}
        </div>
        {measured ? <ProgressBar value={s.done ?? 0} max={s.total ?? 1} /> : <div className="bk-indet" role="progressbar" aria-busy="true" />}
        <div className="bk-progress-note">{t('backup.keepOpen')}</div>
        {onStop && <div className="bk-progress-actions"><Button variant="ghost" size="sm" onClick={onStop} data-qa="backup-stop">{t('backup.stop')}</Button></div>}
      </div>
    </Modal>
  )
}

/** A password input with a show/hide button; typed left to right whatever the UI language. */
function PasswordInput(props: { label: ReactNode; value: string; onChange: (v: string) => void; error?: string; hint?: string; autoFocus?: boolean; autoComplete: string; qa: string }) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <Input type={show ? 'text' : 'password'} label={props.label} value={props.value} onChange={e => props.onChange(e.target.value)} error={props.error} hint={props.hint}
      autoComplete={props.autoComplete} autoFocus={props.autoFocus} spellCheck={false} dir="ltr" data-qa={props.qa}
      iconEnd={show ? <EyeOff aria-label={t('backup.hidePassword')} /> : <Eye aria-label={t('backup.showPassword')} />} onIconEndClick={() => setShow(v => !v)} />
  )
}

export interface ProtectDraft { on: boolean; password: string; repeat: string }
export function protectErrors(d: ProtectDraft): { password?: string; repeat?: string } {
  if (!d.on) return {}
  if (d.password.length < MIN_PASSWORD) return { password: 'backup.passwordShort' }
  if (d.repeat !== d.password) return { repeat: 'backup.passwordMismatch' }
  return {}
}

/** "Protect the backup with a password": a switch, then the password twice and the warning that it cannot be recovered. */
export function ProtectFields({ value, onChange, showErrors, disabled }: { value: ProtectDraft; onChange: (d: ProtectDraft) => void; showErrors: boolean; disabled?: boolean }) {
  const { t } = useI18n()
  const err = showErrors ? protectErrors(value) : {}
  return (
    <div className="bk-protect" data-qa="backup-protect">
      <div className="bk-protect-head">
        <Switch checked={value.on} disabled={disabled} onChange={e => onChange({ ...value, on: e.target.checked })} label={t('backup.protect')} data-qa="backup-protect-switch" />
      </div>
      <div className="bk-protect-hint">{t('backup.protectHint')}</div>
      {value.on && (
        <>
          <div className="bk-pass-grid">
            <PasswordInput label={t('backup.password')} value={value.password} onChange={v => onChange({ ...value, password: v })} hint={t('backup.passwordShort')}
              error={err.password ? t(err.password) : undefined} autoComplete="new-password" qa="backup-password" />
            <PasswordInput label={t('backup.password2')} value={value.repeat} onChange={v => onChange({ ...value, repeat: v })}
              error={err.repeat ? t(err.repeat) : undefined} autoComplete="new-password" qa="backup-password2" />
          </div>
          <Alert tone="warning">{t('backup.passwordWarn')}</Alert>
        </>
      )}
    </div>
  )
}

/** Asks for the password of an encrypted backup; shows the decryption progress while it checks it. */
function PasswordPrompt({ open, fileName, error, progress, onSubmit, onClose }: {
  open: boolean; fileName: string; error?: string; progress: BackupProgress | 'start' | null; onSubmit: (password: string) => void; onClose: () => void
}) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  // the typed password is not kept for the next backup opened (the prompt stays mounted)
  useEffect(() => { if (!open) setPassword('') }, [open])
  const busy = progress !== null
  const submit = () => { if (password && !busy) onSubmit(password) }
  return (
    <Modal open={open} onClose={() => { if (!busy) { setPassword(''); onClose() } }} closeOnOverlay={!busy} size="sm" icon={<LockKeyhole />}
      title={t('backup.passwordTitle')} subtitle={t('backup.passwordSub')}
      footer={<>
        <Button variant="ghost" onClick={() => { setPassword(''); onClose() }} disabled={busy}>{t('cancel')}</Button>
        <Button variant="primary" icon={<FolderOpen />} onClick={submit} loading={busy} disabled={!password} data-qa="backup-open">{t('backup.open')}</Button>
      </>}>
      <form className="bk-prompt" onSubmit={e => { e.preventDefault(); submit() }}>
        <div className="bk-file"><span className="bk-icon"><LockKeyhole /></span><div className="grow bk-file-name" dir="ltr">{fileName}</div></div>
        <PasswordInput label={t('backup.password')} value={password} onChange={setPassword} error={error} autoFocus autoComplete="current-password" qa="backup-unlock" />
        {busy && progress !== 'start' && progress && (
          <div className="col gap-2">
            <div className="bk-progress-stage"><span>{t(`backup.stage.${progress.stage}`)}</span></div>
            <ProgressBar value={progress.done} max={progress.total || 1} />
          </div>
        )}
        {busy && progress === 'start' && <div className="bk-indet" role="progressbar" aria-busy="true" />}
      </form>
    </Modal>
  )
}

/**
 * Choosing a backup file: pick → (password, when it is protected) → read and check everything. `onRead` gets the
 * prepared backup; nothing in the database has changed yet. Render `element` once in the page.
 */
export function useBackupReader({ onRead, onError }: { onRead: (file: File, r: ReadResult) => void; onError: (message: string) => void }) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState<{ file: File; error?: string } | null>(null)
  const [progress, setProgress] = useState<BackupProgress | 'start' | null>(null)
  const running = useRef(false)

  const read = async (file: File, password?: string) => {
    if (running.current) return
    running.current = true
    setProgress('start')
    try {
      const r = await readBackup(file, { password, onProgress: p => setProgress(p) })
      setPrompt(null)
      onRead(file, r)
    } catch (e) {
      if (password !== undefined && e instanceof BackupError && e.reason === 'password') setPrompt({ file, error: t('backup.err.password') })
      else { setPrompt(null); const m = backupErrorText(t, e); if (m) onError(m) }
    } finally {
      running.current = false
      setProgress(null)
    }
  }

  const choose = async () => {
    if (running.current) return
    const file = await pickFile(BACKUP_ACCEPT)
    if (!file) return
    let kind
    try { kind = await detectBackup(file) } catch { onError(t('backup.err.read')); return }
    if (kind === 'unknown') { onError(t('backup.err.app')); return }
    if (kind === 'encrypted') { setPrompt({ file }); return }
    await read(file)
  }

  const reading = progress !== null && !prompt
  const p = progress === 'start' || progress === null ? null : progress
  const element = (
    <>
      <PasswordPrompt open={!!prompt} fileName={prompt?.file.name ?? ''} error={prompt?.error} progress={prompt ? progress : null}
        onSubmit={pw => { if (prompt) void read(prompt.file, pw) }} onClose={() => setPrompt(null)} />
      <BackupProgressModal open={reading} title={t('backup.reading')} state={p ? { stage: p.stage, done: p.done, total: p.total } : { stage: 'start' }} />
    </>
  )
  return { choose, element, busy: progress !== null || !!prompt }
}

/** "3 · 12.4 MB": count and size of the patient files in a backup. */
export const filesLine = (t: T, n: number, bytes: number) => t('backup.filesValue', { n, size: ltr(formatBytes(bytes)) })
