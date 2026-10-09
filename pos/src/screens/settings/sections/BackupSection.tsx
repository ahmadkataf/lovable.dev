import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, DatabaseBackup, Download, Upload, Trash2, ShieldAlert, Cloud, CloudUpload, CloudDownload, MessageCircle, CheckCircle2 } from 'lucide-react'
import { toast, useStore } from '../../../state/store'
import { useT } from '../../../i18n'
import { Button, Field, Input, Modal, SwitchRow, Badge } from '../../../components/ui'
import { TABLES } from '../../../db'
import { platform } from '../../../lib/platform'
import { pickFile, readFileText } from '../../../lib/csv'
import { formatDateTime, formatDate } from '../../../lib/format'
import { cloudState, uploadBackup, listBackups, restoreBackup, getLastCloudBackup, type CloudSnapshot } from '../../../lib/cloud'
import { DEFAULT_INFO } from '../../../license/types'
import { exportBackup, validateBackup, importBackup, resetAllData, markBackupDone, getLastBackup, backupIsStale, backupFileName, type BackupValidation } from '../../../lib/backup'
import { SectionCard, Note } from '../shared'

type Busy = 'export' | 'read' | 'import' | 'reset' | null

function sizeText(t: (k: string, v?: Record<string, string | number>) => string, bytes: number): string {
  return bytes >= 1048576 ? t('settings.cloud.sizeMb', { n: (bytes / 1048576).toFixed(1) }) : t('settings.cloud.size', { n: Math.max(1, Math.round(bytes / 1024)) })
}

/** The cloud backup card: status of the yearly plan, upload now, daily switch, restore list, or the offer. */
function CloudCard() {
  const t = useT()
  const lic = useStore(s => s.license)
  const auto = useStore(s => s.settings.pos.cloudAuto)
  const update = useStore(s => s.updateSettings)
  const last = useLiveQuery(() => getLastCloudBackup(), [])
  const [busy, setBusy] = useState<'up' | 'list' | 'restore' | null>(null)
  const [list, setList] = useState<CloudSnapshot[] | null>(null)
  const [picked, setPicked] = useState<CloudSnapshot | null>(null)
  const state = cloudState(lic)
  const info = lic.info ?? DEFAULT_INFO
  const price = info.cloudPrice || DEFAULT_INFO.cloudPrice || '35$'

  const up = async () => {
    setBusy('up')
    const r = await uploadBackup()
    setBusy(null)
    if (r.ok) toast(t('settings.cloud.uploaded', { size: sizeText(t, r.size) }), 'success')
    else toast(r.errorText || t(r.error), 'error')
  }
  const openList = async () => {
    setBusy('list')
    const r = await listBackups()
    setBusy(null)
    if (!r.ok) { toast(r.errorText || t(r.error), 'error'); return }
    setList(r.backups)
  }
  const doRestore = async () => {
    if (!picked) return
    setBusy('restore')
    const r = await restoreBackup(picked.id)
    if (!r.ok) { setBusy(null); toast(r.errorText || t(r.error), 'error'); return }
    toast(t('settings.cloud.restored'), 'success')
    setTimeout(() => location.reload(), 700)
  }
  const wa = () => {
    const text = t('settings.cloud.waText', { device: lic.deviceCode })
    platform.openUrl(`https://wa.me/${info.whatsapp}?text=${encodeURIComponent(text)}`)
  }

  const status = state === 'active' ? <Badge kind="primary"><CheckCircle2 size={12} /> {t('settings.cloud.activeUntil', { date: formatDate(lic.cloudUntil ?? 0) })}</Badge>
    : state === 'expired' ? <Badge kind="danger">{t('settings.cloud.expiredAt', { date: formatDate(lic.cloudUntil ?? 0) })}</Badge>
    : state === 'demo' ? <Badge kind="info">{t('settings.cloud.demo')}</Badge>
    : state === 'unlicensed' ? <Badge kind="warn">{t('settings.cloud.unlicensed')}</Badge>
    : <Badge>{t('settings.cloud.notSubscribed')}</Badge>

  return (
    <SectionCard title={t('settings.cloud.title')} icon={<Cloud size={16} />}>
      <div className="row wrap between"><p className="small muted grow">{t('settings.cloud.desc')}</p>{status}</div>
      {state === 'active' && (
        <>
          <SwitchRow label={t('settings.cloud.auto')} desc={t('settings.cloud.autoDesc')} on={auto} onChange={v => void update({ pos: { cloudAuto: v } })} />
          <div className="row wrap between">
            <span className="small faint">{last === undefined ? '' : last ? t('settings.cloud.last', { date: formatDateTime(last) }) : t('settings.cloud.never')}</span>
            <div className="row wrap">
              <Button icon={<CloudDownload size={16} />} loading={busy === 'list'} disabled={!!busy || !lic.online} onClick={() => void openList()}>{t('settings.cloud.restore')}</Button>
              <Button variant="primary" icon={<CloudUpload size={16} />} loading={busy === 'up'} disabled={!!busy || !lic.online} onClick={() => void up()}>{t('settings.cloud.backupNow')}</Button>
            </div>
          </div>
          {!lic.online && <Note kind="warn">{t('settings.cloud.offline')}</Note>}
        </>
      )}
      {state === 'expired' && (
        <div className="row wrap between">
          <Button icon={<CloudDownload size={16} />} loading={busy === 'list'} disabled={!!busy || !lic.online} onClick={() => void openList()}>{t('settings.cloud.restore')}</Button>
          {info.whatsapp && <Button variant="primary" icon={<MessageCircle size={16} />} onClick={wa}>{t('settings.cloud.renewWa')}</Button>}
        </div>
      )}
      {(state === 'none' || state === 'unlicensed') && (
        <div className="col" style={{ gap: 8 }}>
          <ul className="small muted" style={{ paddingInlineStart: 18, listStyle: 'disc' }}>
            <li>{t('settings.cloud.benefit1')}</li><li>{t('settings.cloud.benefit2')}</li><li>{t('settings.cloud.benefit3')}</li>
          </ul>
          <div className="row wrap between">
            <span className="bold">{t('settings.cloud.price', { price })}</span>
            {info.whatsapp && state === 'none' && <Button variant="primary" icon={<MessageCircle size={16} />} onClick={wa}>{t('settings.cloud.subscribeWa')}</Button>}
          </div>
        </div>
      )}

      {list && (
        <Modal open onClose={() => { if (busy !== 'restore') { setList(null); setPicked(null) } }} title={t('settings.cloud.restoreTitle')} noClose={busy === 'restore'} footer={
          <>
            <Button onClick={() => { setList(null); setPicked(null) }} disabled={busy === 'restore'}>{t('common.cancel')}</Button>
            <Button variant="danger" icon={<DatabaseBackup size={16} />} loading={busy === 'restore'} disabled={!picked} onClick={() => void doRestore()}>{t('settings.cloud.restoreThis')}</Button>
          </>
        }>
          <div className="col" style={{ gap: 12 }}>
            <Note kind="warn">{t('settings.cloud.restoreDesc')}</Note>
            {list.length === 0 ? <div className="empty"><p>{t('settings.cloud.noBackups')}</p></div> : (
              <div className="list card flat">
                {list.map(b => (
                  <button key={b.id} type="button" className="list-row" onClick={() => setPicked(b)} style={picked?.id === b.id ? { background: 'var(--primary-soft)' } : undefined}>
                    <Cloud size={18} className={picked?.id === b.id ? '' : 'faint'} />
                    <div className="grow">
                      <div className="title">{formatDateTime(b.at)}</div>
                      <div className="sub">{sizeText(t, b.size)}{b.device ? ` · ${t('settings.cloud.fromDevice', { device: b.device })}` : ''}{b.appVersion ? ` · v${b.appVersion}` : ''}</div>
                    </div>
                    {picked?.id === b.id && <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </SectionCard>
  )
}

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

      <CloudCard />

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
