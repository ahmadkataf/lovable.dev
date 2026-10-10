import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CalendarDays, CheckCircle2, DatabaseBackup, Download, FileJson, FolderOpen, HardDrive, Receipt, RotateCcw, ShieldCheck, Sparkles, Trash2, Users } from 'lucide-react'
import { Alert, Button, Card, CardBody, Modal, ProgressBar, Skeleton, useConfirm, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import { db, getSetting, logActivity, SCHEMA_VERSION } from '@/db'
import type { BackupFile } from '@/db/types'
import { pickFile } from '@/platform'
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { DEMO_STEPS, loadDemoData, type DemoStep } from '@/features/seed/demo'
import { backupAgeDays, backupHealth, parseBackup, type BackupSummary } from './lib'
import { eraseEverything, exportBackupFile, restartApp, restoreBackup } from './backup'
import { SectionTitle, TypeToConfirm, useAccess } from './parts'

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
  const [restore, setRestore] = useState<{ file: string; data: BackupFile; summary: BackupSummary } | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [demo, setDemo] = useState<{ step: DemoStep; index: number } | null>(null)

  const health = lastBackup === undefined ? null : backupHealth(lastBackup)
  const age = backupAgeDays(lastBackup)

  const doExport = async () => {
    setExporting(true)
    try {
      const name = await exportBackupFile(t('settings.bk.act.backup'), access.userId)
      if (name) toast.success(t('settings.bk.exported'), t('settings.bk.exportedDesc', { file: name }))
    } catch { toast.error(t('settings.bk.exportFailed')) } finally { setExporting(false) }
  }

  const chooseBackup = async () => {
    setRestoreError(null)
    const file = await pickFile('.json,application/json')
    if (!file) return
    let text = ''
    try { text = await file.text() } catch { setRestoreError(t('settings.bk.err.json')); return }
    const r = parseBackup(text, SCHEMA_VERSION)
    if (!r.ok) { setRestoreError(t(`settings.bk.err.${r.reason}`)); return }
    setRestore({ file: file.name, data: r.data, summary: r.summary })
  }
  const doRestore = async () => {
    if (!restore) return
    setBusy(true)
    try {
      await restoreBackup(restore.data)
      toast.success(t('settings.bk.restored'), t('settings.bk.restoredDesc'))
      window.setTimeout(() => restartApp('/'), 900)
    } catch {
      setBusy(false)
      toast.error(t('settings.bk.restoreFailed'))
    }
  }

  const doReset = async () => {
    setBusy(true)
    try {
      await eraseEverything()
      toast.success(t('settings.bk.resetDone'))
      window.setTimeout(() => restartApp('/setup'), 700)
    } catch { setBusy(false); toast.error(t('error')) }
  }

  const loadDemo = async () => {
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
  }

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
          <div className="st-actions">
            <Button variant="primary" size="lg" icon={<Download />} loading={exporting} onClick={doExport} data-qa="export-backup">{t('settings.bk.export')}</Button>
            {access.readOnly && <span className="text-sm muted">{t('settings.bk.readonlyExport')}</span>}
          </div>
        </CardBody>
      </Card>

      {/* ---- restore ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<RotateCcw />} title={t('settings.bk.restore')} sub={t('settings.bk.restoreDesc')} tone="info" />
          {restoreError && <div className="mb-4" data-qa="restore-error"><Alert tone="danger">{restoreError}</Alert></div>}
          <Button variant="secondary" icon={<FolderOpen />} onClick={chooseBackup} disabled={access.readOnly} title={access.readOnly ? t('trial.readonly') : undefined} data-qa="choose-backup">{t('settings.bk.chooseFile')}</Button>
        </CardBody>
      </Card>

      {/* ---- demo data ---- */}
      <Card>
        <CardBody>
          <SectionTitle icon={<Sparkles />} title={t('settings.bk.demoTitle')} sub={t('seed.loadDemoDesc')} tone="success" />
          {counts !== undefined && !canDemo && <div className="mb-4" data-qa="demo-blocked"><Alert tone="info">{t('settings.bk.demoBlocked', { n: counts.patients })}</Alert></div>}
          <Button variant="soft" icon={<Sparkles />} onClick={loadDemo} disabled={!canDemo || access.readOnly} data-qa="load-demo">{t('seed.loadDemo')}</Button>
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
      <TypeToConfirm open={!!restore} onClose={() => setRestore(null)} title={t('settings.bk.confirmTitle')} subtitle={t('settings.bk.confirmSub')} icon={<RotateCcw />}
        word={t('settings.bk.replaceWord')} confirmLabel={t('settings.bk.restoreBtn')} busy={busy} onConfirm={doRestore}>
        {restore && (
          <>
            <div className="st-file-card">
              <span className="st-file-icon"><FileJson /></span>
              <div className="grow">
                <div className="strong truncate st-file-name"><span className="ltr">{restore.file}</span></div>
                <div className="text-sm muted">{restore.summary.exportedAt ? fmtDateTime(restore.summary.exportedAt, lang) : t('unknown')}</div>
              </div>
            </div>
            <dl className="st-summary" data-qa="restore-summary">
              {restore.summary.clinicName && <div><dt>{t('settings.bk.clinic')}</dt><dd>{restore.summary.clinicName}</dd></div>}
              <div><dt>{t('patients')}</dt><dd className="num">{formatNumber(restore.summary.patients, lang)}</dd></div>
              <div><dt>{t('nav.appointments')}</dt><dd className="num">{formatNumber(restore.summary.appointments, lang)}</dd></div>
              <div><dt>{t('nav.billing')}</dt><dd className="num">{formatNumber(restore.summary.invoices, lang)}</dd></div>
              <div><dt>{t('settings.bk.totalRows')}</dt><dd className="num">{formatNumber(restore.summary.rows, lang)}</dd></div>
            </dl>
            <Alert tone="danger">{t('settings.bk.replaceWarn')}</Alert>
          </>
        )}
      </TypeToConfirm>

      {/* ---- reset confirmation ---- */}
      <TypeToConfirm open={resetOpen} onClose={() => setResetOpen(false)} title={t('settings.bk.resetTitle')} icon={<AlertTriangle />}
        word={t('settings.bk.resetWord')} confirmLabel={t('settings.bk.resetBtn')} busy={busy} onConfirm={doReset}
        footerStart={<Button variant="secondary" icon={<Download />} onClick={doExport} loading={exporting} disabled={busy}>{t('settings.bk.exportFirst')}</Button>}>
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
