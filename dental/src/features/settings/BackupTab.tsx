import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CalendarDays, CheckCircle2, DatabaseBackup, Download, FileArchive, FolderOpen, HardDrive, LockKeyhole, Receipt, RotateCcw, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react'
import { Alert, Badge, Button, Card, CardBody, Modal, ProgressBar, Skeleton, useConfirm, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { db, getSetting, logActivity, requestPersistentStorage } from '@/db'
import { isAndroid, platform } from '@/platform'
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/dates'
import { formatBytes, formatNumber } from '@/lib/format'
import { DEMO_STEPS, loadDemoData, type DemoStep } from '@/features/seed/demo'
import { backupAgeDays, backupHealth } from './lib'
import { eraseEverything, exportBackupFile, restartApp, restoreBackup } from './backup'
import type { ReadResult } from './backup/archive'
import { BackupProgressModal, backupErrorText, filesLine, isolate, ltr, namesLine, ProtectFields, protectErrors, useBackupReader, type ProgressState, type ProtectDraft } from './backup/ui'
import { SectionTitle, TypeToConfirm, useAccess, useSingleFlight } from './parts'

// remembers only whether the clinic protects its backups (never the password)
const PROTECT_KEY = 'dentora.backup.protect'
const readProtectPref = () => { try { return localStorage.getItem(PROTECT_KEY) === '1' } catch { return false } }
const writeProtectPref = (on: boolean) => { try { localStorage.setItem(PROTECT_KEY, on ? '1' : '0') } catch { /* private mode */ } }

export default function BackupTab() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const access = useAccess()
  const lastBackup = useLiveQuery(() => getSetting<string | null>('lastBackupAt', null), [])
  const counts = useLiveQuery(async () => {
    const [patients, appointments, invoices] = await Promise.all([db.patients.count(), db.appointments.count(), db.invoices.count()])
    return { patients, appointments, invoices }
  }, [])
  const [exporting, setExporting] = useState(false)
  const [exportState, setExportState] = useState<ProgressState | null>(null)
  const exportAbort = useRef<AbortController | null>(null)
  const [protect, setProtectState] = useState<ProtectDraft>(() => ({ on: readProtectPref(), password: '', repeat: '' }))
  const [protectTried, setProtectTried] = useState(false)
  const setProtect = (d: ProtectDraft) => { if (d.on !== protect.on) writeProtectPref(d.on); setProtectState(d) }
  const [restore, setRestore] = useState<{ file: string; size: number; result: ReadResult } | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [demo, setDemo] = useState<{ step: DemoStep; index: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const once = useSingleFlight()
  const reader = useBackupReader({
    onRead: (file, result) => setRestore({ file: file.name, size: file.size, result }),
    onError: message => setRestoreError(message),
  })
  useEffect(() => { if (platform() === 'web') void requestPersistentStorage().then(setPersisted) }, [])

  const health = lastBackup === undefined ? null : backupHealth(lastBackup)
  const age = backupAgeDays(lastBackup)

  const doExport = () => once(async () => {
    const invalid = protectErrors(protect)
    if (protect.on && (invalid.password || invalid.repeat)) {
      setProtectTried(true)
      if (resetOpen) toast.error(t(invalid.password ?? invalid.repeat ?? 'backup.passwordShort'))
      return
    }
    const ctrl = new AbortController()
    exportAbort.current = ctrl
    setExporting(true)
    setExportState({ stage: 'start' })
    try {
      const r = await exportBackupFile(t('settings.bk.act.backup'), access.userId, {
        password: protect.on ? protect.password : undefined,
        signal: ctrl.signal,
        onProgress: p => setExportState({ stage: p.stage, done: p.done, total: p.total }),
        onFinishing: () => setExportState({ stage: isAndroid() ? 'choose' : 'finishing' }),
      })
      if (r) {
        toast.success(t('settings.bk.exported'), <><bdi>{t('backup.savedDesc', { file: isolate(r.name), size: ltr(formatBytes(r.bytes)) })}</bdi>{protect.on && <><br />{t('backup.savedEncrypted')}</>}</>)
        setProtectState(p => ({ ...p, password: '', repeat: '' }))
        setProtectTried(false)
      }
    } catch (e) {
      const m = backupErrorText(t, e)
      if (m) toast.error(t('settings.bk.exportFailed'), m)
      else toast.info(t('backup.stopped'))
    } finally {
      exportAbort.current = null
      setExportState(null)
      setExporting(false)
    }
  })

  const chooseBackup = () => { setRestoreError(null); void reader.choose() }
  // Restore and reset end with a reload, so after success they stay busy (and locked) until the page goes away.
  const doRestore = () => once(async () => {
    if (!restore || busy) return
    setBusy(true)
    setApplying(true)
    try {
      const r = await restoreBackup(restore.result.data, { neededBytes: Math.max(restore.size, restore.result.info.fileBytes) })
      toast.success(t('settings.bk.restored'), r.skippedFiles ? `${t('backup.restoredSkipped', { n: r.skippedFiles })} ${t('settings.bk.restoredDesc')}` : t('settings.bk.restoredDesc'))
      await new Promise<void>(res => window.setTimeout(res, 900))
      restartApp('/')
    } catch (e) {
      setApplying(false)
      setBusy(false)
      toast.error(backupErrorText(t, e) ?? t('backup.err.failed'))
    }
  })

  const doReset = () => once(async () => {
    if (busy) return
    setBusy(true)
    try {
      await eraseEverything()
      toast.success(t('settings.bk.resetDone'))
      await new Promise<void>(r => window.setTimeout(r, 700))
      restartApp('/setup')
    } catch { setBusy(false); toast.error(t('error')) }
  })

  const loadDemo = () => once(async () => {
    const ok = await confirm({ title: t('seed.loadDemo'), description: <>{t('seed.loadDemoConfirm')}<br /><br />{t('seed.demoDoctors')}</>, confirmLabel: t('seed.loadDemo') })
    if (!ok) return
    setDemo({ step: DEMO_STEPS[0], index: 0 })
    try {
      const r = await loadDemoData({ onProgress: (step, index) => setDemo({ step, index }) })
      setDemo(null)
      if (r.skipped) { toast.info(t('seed.alreadyHasData')); return }
      toast.success(t('seed.done'), t('seed.summary', { patients: r.patients, appointments: r.appointments, invoices: r.invoices, payments: r.payments }))
      void logActivity({ type: 'system', action: 'other', message: t('settings.bk.act.demo'), by: access.userId })
    } catch {
      setDemo(null)
      toast.error(t('seed.failed'))
    }
  })

  const stats = [
    { icon: <Users />, label: t('patients'), value: counts?.patients },
    { icon: <CalendarDays />, label: t('nav.appointments'), value: counts?.appointments },
    { icon: <Receipt />, label: t('nav.billing'), value: counts?.invoices },
  ]
  const canDemo = counts !== undefined && counts.patients < 3

  return (
    <div className="st-form">
      {/* ---- export ---- */}
      <Card className="st-backup-hero">
        <CardBody>
          <div className="st-hero">
            <span className="st-hero-icon"><HardDrive /></span>
            <div className="grow">
              <h2 className="st-hero-title">{t('settings.bk.heroTitle')}</h2>
              <p className="st-hero-desc">{t('settings.bk.heroDesc')}</p>
            </div>
          </div>
          <div className="st-backup-stats">
            {stats.map((s, i) => (
              <div key={i} className="st-stat">
                <span className="st-stat-icon">{s.icon}</span>
                <span className="st-stat-text"><span className="st-stat-label">{s.label}</span>
                  {s.value === undefined ? <Skeleton w={40} h={18} /> : <span className="st-stat-value num">{formatNumber(s.value, lang)}</span>}
                </span>
              </div>
            ))}
            <div className="st-stat">
              <span className="st-stat-icon"><DatabaseBackup /></span>
              <span className="st-stat-text"><span className="st-stat-label">{t('settings.bk.last')}</span>
                {lastBackup === undefined ? <Skeleton w={90} h={18} /> : <span className="st-stat-value sm" data-qa="last-backup">{lastBackup ? fmtDate(lastBackup, lang) : t('settings.bk.neverShort')}</span>}
              </span>
            </div>
          </div>
          {health === 'never' && <Alert tone="warning" title={t('settings.bk.neverTitle')} className="mt-4">{t('settings.bk.neverDesc')}</Alert>}
          {health === 'old' && <Alert tone="warning" title={t('settings.bk.oldTitle', { n: age ?? 0 })} className="mt-4">{t('settings.bk.oldDesc')}</Alert>}
          {health === 'ok' && lastBackup && <Alert tone="success" title={t('settings.bk.okTitle')} className="mt-4">{t('settings.bk.okDesc', { when: timeAgo(lastBackup, lang) })}</Alert>}
          {persisted === false && <Alert tone="info" className="mt-4">{t('backup.persistNote')}</Alert>}
          <ProtectFields value={protect} onChange={setProtect} showErrors={protectTried} disabled={exporting} />
          <div className="st-actions">
            <Button variant="primary" size="lg" icon={protect.on ? <LockKeyhole /> : <Download />} loading={exporting} onClick={() => void doExport()} data-qa="export-backup">{t('settings.bk.export')}</Button>
            {access.readOnly && <span className="text-sm muted">{t('settings.bk.readonlyExport')}</span>}
          </div>
        </CardBody>
      </Card>

      {/* ---- restore ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<RotateCcw />} title={t('settings.bk.restore')} sub={t('settings.bk.restoreDesc')} tone="info" />
          {restoreError && <div className="mb-4" data-qa="restore-error"><Alert tone="danger">{restoreError}</Alert></div>}
          <Button variant="secondary" icon={<FolderOpen />} onClick={chooseBackup} loading={reader.busy && !restore} disabled={access.readOnly} title={access.readOnly ? t('trial.readonly') : undefined} data-qa="choose-backup">{t('settings.bk.chooseFile')}</Button>
        </CardBody>
      </Card>

      {/* ---- demo data ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Sparkles />} title={t('settings.bk.demoTitle')} sub={t('seed.loadDemoDesc')} tone="success" />
          {counts !== undefined && !canDemo && <div className="mb-4" data-qa="demo-blocked"><Alert tone="info">{t('settings.bk.demoBlocked', { n: counts.patients })}</Alert></div>}
          <Button variant="soft" icon={<Sparkles />} onClick={() => void loadDemo()} disabled={!canDemo || access.readOnly} data-qa="load-demo">{t('seed.loadDemo')}</Button>
        </CardBody>
      </Card>

      {/* ---- danger zone ---- */}
      <Card className="st-danger-zone">
        <CardBody>
          <SectionTitle icon={<AlertTriangle />} title={t('settings.bk.danger')} tone="danger" />
          <div className="st-danger-row">
            <div className="grow">
              <div className="strong">{t('settings.bk.reset')}</div>
              <div className="text-sm muted">{t('settings.bk.resetDesc')}</div>
            </div>
            <Button variant="danger-soft" icon={<Trash2 />} onClick={() => setResetOpen(true)} disabled={access.readOnly} data-qa="reset-all">{t('settings.bk.resetBtn')}</Button>
          </div>
        </CardBody>
      </Card>

      {/* ---- restore confirmation ---- */}
      <TypeToConfirm open={!!restore && !applying} onClose={() => setRestore(null)} title={t('settings.bk.confirmTitle')} subtitle={t('settings.bk.confirmSub')} icon={<RotateCcw />}
        word={t('settings.bk.replaceWord')} confirmLabel={t('settings.bk.restoreBtn')} busy={busy} onConfirm={() => void doRestore()}>
        {restore && (
          <>
            <div className="st-file-card">
              <span className="st-file-icon">{restore.result.info.encrypted ? <LockKeyhole /> : <FileArchive />}</span>
              <div className="grow">
                <div className="strong truncate st-file-name"><span className="ltr">{restore.file}</span></div>
                <div className="text-sm muted">{restore.result.summary.exportedAt ? <bdi>{fmtDateTime(restore.result.summary.exportedAt, lang)}</bdi> : t('unknown')}</div>
              </div>
              {restore.result.info.encrypted && <Badge tone="success" icon={<LockKeyhole />}>{t('backup.encrypted')}</Badge>}
            </div>
            <dl className="st-summary" data-qa="restore-summary">
              {restore.result.summary.clinicName && <div><dt>{t('settings.bk.clinic')}</dt><dd dir="auto">{restore.result.summary.clinicName}</dd></div>}
              <div><dt>{t('patients')}</dt><dd className="num">{formatNumber(restore.result.summary.patients, lang)}</dd></div>
              <div><dt>{t('nav.appointments')}</dt><dd className="num">{formatNumber(restore.result.summary.appointments, lang)}</dd></div>
              <div><dt>{t('nav.billing')}</dt><dd className="num">{formatNumber(restore.result.summary.invoices, lang)}</dd></div>
              <div><dt>{t('backup.files')}</dt><dd className="num" data-qa="restore-files">{filesLine(t, restore.result.info.files, restore.result.info.fileBytes)}</dd></div>
              <div><dt>{t('settings.bk.totalRows')}</dt><dd className="num">{formatNumber(restore.result.summary.rows, lang)}</dd></div>
            </dl>
            {restore.result.info.damaged.length > 0 && (
              <Alert tone="warning" title={t('backup.damagedTitle', { n: restore.result.info.damaged.length })}>
                {t('backup.damagedDesc', { n: restore.result.info.damaged.length, names: namesLine(restore.result.info.damaged) })}
              </Alert>
            )}
            <Alert tone="danger">{t('settings.bk.replaceWarn')}</Alert>
          </>
        )}
      </TypeToConfirm>
      {reader.element}
      <BackupProgressModal open={exportState !== null} title={t('backup.exporting')} state={exportState}
        onStop={exportState && exportState.stage !== 'finishing' && exportState.stage !== 'choose' ? () => exportAbort.current?.abort() : undefined} />
      <BackupProgressModal open={applying} title={t('backup.restoring')} state={{ stage: 'apply' }} />

      {/* ---- reset confirmation ---- */}
      <TypeToConfirm open={resetOpen} onClose={() => setResetOpen(false)} title={t('settings.bk.resetTitle')} icon={<AlertTriangle />}
        word={t('settings.bk.resetWord')} confirmLabel={t('settings.bk.resetBtn')} busy={busy} onConfirm={() => void doReset()}
        footerStart={<Button variant="secondary" icon={<Download />} onClick={() => void doExport()} loading={exporting} disabled={busy}>{t('settings.bk.exportFirst')}</Button>}>
        <Alert tone="danger">{t('settings.bk.resetWarn')}</Alert>
        {health && health !== 'never' && lastBackup && (
          <div className="st-file-card">
            <span className="st-file-icon ok"><ShieldCheck /></span>
            <div className="grow"><div className="text-sm muted">{t('settings.bk.last')}</div><div className="strong">{fmtDateTime(lastBackup, lang)}</div></div>
          </div>
        )}
      </TypeToConfirm>

      {/* ---- demo progress ---- */}
      <Modal open={!!demo} onClose={() => { /* runs to the end */ }} closeOnOverlay={false} size="sm">
        {demo && (
          <div className="col gap-3 st-demo" data-qa="demo-progress">
            <div className="st-demo-head"><span className="st-section-icon tone-success"><Sparkles /></span><span className="st-section-title">{t('seed.loading')}</span></div>
            <ProgressBar value={demo.index + 1} max={DEMO_STEPS.length} />
            <ul className="st-steps">
              {DEMO_STEPS.filter(s => s !== 'done').map((s, i) => (
                <li key={s} className={i < demo.index ? 'done' : i === demo.index ? 'now' : ''}>
                  {i < demo.index ? <CheckCircle2 /> : <span className="st-step-dot" />}{t(`seed.step.${s}`)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
