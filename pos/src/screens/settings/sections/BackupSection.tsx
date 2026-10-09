import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, DatabaseBackup, Download, Upload, Trash2, ShieldAlert } from 'lucide-react'
import { toast } from '../../../state/store'
import { useT } from '../../../i18n'
import { Button, Field, Input, Modal } from '../../../components/ui'
import { TABLES } from '../../../db'
import { platform } from '../../../lib/platform'
import { pickFile, readFileText } from '../../../lib/csv'
import { formatDateTime } from '../../../lib/format'
import { exportBackup, validateBackup, importBackup, resetAllData, markBackupDone, getLastBackup, backupIsStale, backupFileName, type BackupValidation } from '../../../lib/backup'
import { SectionCard, Note } from '../shared'

type Busy = 'export' | 'read' | 'import' | 'reset' | null

export default function BackupSection() {
  const t = useT()
  const last = useLiveQuery(() => getLastBackup(), [])
  const [busy, setBusy] = useState<Busy>(null)
  const [pending, setPending] = useState<{ json: string; v: BackupValidation } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [word, setWord] = useState('')
  const stale = last !== undefined && backupIsStale(last)

  const doExport = async () => {
    setBusy('export')
    try {
      const json = await exportBackup()
      const ok = await platform.saveFile(backupFileName(), 'application/json', json)
      if (ok) { await markBackupDone(); toast(t('settings.backup.exported'), 'success') }
    } catch { toast(t('settings.backup.exportFailed'), 'error') }
    finally { setBusy(null) }
  }

  const pickRestore = async () => {
    const f = await pickFile('.json,application/json')
    if (!f) return
    setBusy('read')
    try {
      const text = await readFileText(f)
      const v = validateBackup(text)
      if (!v.ok) { toast(t(`settings.backup.err.${v.error ?? 'invalid_json'}`), 'error'); return }
      setPending({ json: text, v })
    } catch { toast(t('settings.backup.err.read'), 'error') }
    finally { setBusy(null) }
  }

  const doImport = async () => {
    if (!pending) return
    setBusy('import')
    try {
      await importBackup(pending.json)
      toast(t('settings.backup.restored'), 'success')
      setPending(null)
      setTimeout(() => location.reload(), 700)
    } catch { toast(t('settings.backup.restoreFailed'), 'error'); setBusy(null) }
  }

  const resetWord = t('settings.backup.reset.word')
  const doReset = async () => {
    if (word.trim() !== resetWord) return
    setBusy('reset')
    try {
      await resetAllData()
      toast(t('settings.backup.reset.done'), 'success')
      setResetOpen(false)
      setTimeout(() => location.reload(), 700)
    } catch { toast(t('settings.backup.reset.failed'), 'error'); setBusy(null) }
  }

  return (
    <>
      {stale && (
        <div className="banner warn" style={{ borderRadius: 'var(--radius)' }}>
          <AlertTriangle size={18} />
          <span className="grow">{t(last ? 'settings.backup.stale' : 'settings.backup.staleNever')}</span>
        </div>
      )}

      <SectionCard title={t('settings.backup.export.title')} icon={<Download size={16} />}>
        <p className="small muted">{t('settings.backup.export.desc')}</p>
        <div className="row wrap between">
          <span className="small faint">{last === undefined ? '' : last ? t('settings.backup.last', { date: formatDateTime(last) }) : t('settings.backup.never')}</span>
          <Button variant="primary" icon={<Download size={16} />} loading={busy === 'export'} disabled={!!busy} onClick={() => void doExport()}>{t('settings.backup.export.btn')}</Button>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.backup.restore.title')} icon={<Upload size={16} />}>
        <p className="small muted">{t('settings.backup.restore.desc')}</p>
        <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
          <Button icon={<Upload size={16} />} loading={busy === 'read'} disabled={!!busy} onClick={() => void pickRestore()}>{busy === 'read' ? t('settings.backup.reading') : t('settings.backup.restore.btn')}</Button>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.backup.danger')} icon={<ShieldAlert size={16} />} className="danger-zone">
        <div className="bold">{t('settings.backup.reset.title')}</div>
        <p className="small muted">{t('settings.backup.reset.desc')}</p>
        <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
          <Button variant="soft-danger" icon={<Trash2 size={16} />} disabled={!!busy} onClick={() => { setWord(''); setResetOpen(true) }}>{t('settings.backup.reset.btn')}</Button>
        </div>
      </SectionCard>

      {pending && (
        <Modal open onClose={() => { if (busy !== 'import') setPending(null) }} title={t('settings.backup.restore.confirmTitle')} noClose={busy === 'import'} footer={
          <>
            <Button onClick={() => setPending(null)} disabled={busy === 'import'}>{t('common.cancel')}</Button>
            <Button variant="danger" icon={<DatabaseBackup size={16} />} loading={busy === 'import'} onClick={() => void doImport()}>{t('settings.backup.restore.do')}</Button>
          </>
        }>
          <div className="col" style={{ gap: 12 }}>
            <Note kind="warn">{t('settings.backup.restore.warn')}</Note>
            <div className="small faint">
              {pending.v.exportedAt ? t('settings.backup.restore.from', { date: formatDateTime(pending.v.exportedAt) }) : null}
              {pending.v.appVersion ? <> · <span className="num">{t('settings.backup.restore.fromVersion', { v: pending.v.appVersion })}</span></> : null}
            </div>
            <div className="backup-counts">
              {TABLES.map(name => (
                <div key={name} className={`cnt ${pending.v.counts[name] === 0 ? 'zero' : ''}`}>
                  <span>{t(`settings.backup.table.${name}`)}</span><b>{pending.v.counts[name]}</b>
                </div>
              ))}
            </div>
            <div className="row between small bold"><span>{t('settings.backup.total')}</span><span className="num">{t('settings.backup.rows', { n: pending.v.total })}</span></div>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Modal open onClose={() => { if (busy !== 'reset') setResetOpen(false) }} title={t('settings.backup.reset.confirmTitle')} size="narrow" noClose={busy === 'reset'} footer={
          <>
            <Button onClick={() => setResetOpen(false)} disabled={busy === 'reset'}>{t('common.cancel')}</Button>
            <Button variant="danger" icon={<Trash2 size={16} />} loading={busy === 'reset'} disabled={word.trim() !== resetWord} onClick={() => void doReset()}>{t('settings.backup.reset.do')}</Button>
          </>
        }>
          <div className="col" style={{ gap: 12 }}>
            <Note kind="warn">{t('settings.backup.reset.desc')} {t('settings.backup.reset.hint')}</Note>
            <Field label={t('settings.backup.reset.type', { word: resetWord })}>
              <Input value={word} onChange={e => setWord(e.target.value)} autoFocus placeholder={resetWord} onKeyDown={e => { if (e.key === 'Enter') void doReset() }} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
