// CSV import wizard: pick a file → check the column mapping and a preview → run → report.
import { useEffect, useMemo, useState } from 'react'
import { FileUp, Download, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import { useT } from '../../i18n'
import { Modal, Button, Select, SwitchRow, Spinner, Field } from '../../components/ui'
import { toast, useSettings, useUser } from '../../state/store'
import { parseCsv, pickFile, readFileText, saveCsv } from '../../lib/csv'
import { formatNumber } from '../../lib/money'
import { autoMap, looksLikeHeader, mappingOk, parseImportRow, IMPORT_FIELDS, type ImportField, type Mapping } from './import-map'
import { runImport, skipReasonText, type ImportReport } from './import-run'
import { templateCsv } from './product-utils'

type Step = 'pick' | 'map' | 'running' | 'done'

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const settings = useSettings()
  const user = useUser()
  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<Mapping>({})
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState<ImportReport | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setStep('pick'); setRows([]); setMapping({}); setReport(null); setFileName('') } }, [open])

  const pick = async () => {
    setBusy(true)
    try {
      const f = await pickFile('.csv,text/csv,text/plain')
      if (!f) return
      const text = await readFileText(f)
      const parsed = parseCsv(text)
      if (!parsed.length) { toast(t('products.import.emptyFile'), 'error'); return }
      const header = looksLikeHeader(parsed[0])
      setFileName(f.name); setRows(parsed); setHasHeader(header)
      setMapping(header ? autoMap(parsed[0]) : {})
      setStep('map')
    } catch { toast(t('products.import.readFailed'), 'error') }
    finally { setBusy(false) }
  }
  const template = async () => {
    const ok = await saveCsv('kaseb-products-template.csv', templateCsv())
    if (ok) toast(t('products.import.templateSaved'), 'success')
  }

  const columns = rows[0] ?? []
  const headerLabels = useMemo(() => columns.map((h, i) => (hasHeader && h.trim() ? h.trim() : t('products.import.column', { n: i + 1 }))), [columns, hasHeader, t])
  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader])
  const firstLine = hasHeader ? 2 : 1
  const preview = useMemo(() => dataRows.slice(0, 5).map((r, i) => parseImportRow(r, mapping, i + firstLine)), [dataRows, mapping, firstLine])
  const ok = mappingOk(mapping)

  const run = async () => {
    const parsedRows = dataRows.map((r, i) => parseImportRow(r, mapping, i + firstLine))
    setProgress({ done: 0, total: parsedRows.length })
    setStep('running')
    try {
      const rep = await runImport(parsedRows, {
        stockMapped: mapping.stock !== undefined, userId: user?.id, decimals: settings.currency.decimals,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setReport(rep); setStep('done')
      toast(t('products.import.doneToast', { c: rep.created, u: rep.updated }), 'success')
    } catch { toast(t('common.error'), 'error'); setStep('map') }
  }

  const setField = (f: ImportField, v: string) => setMapping(m => {
    const n = { ...m }
    if (v === '') delete n[f]
    else { const idx = Number(v); for (const k of IMPORT_FIELDS) if (n[k] === idx) delete n[k]; n[f] = idx }
    return n
  })
  const fmt = (n: number | undefined) => (n === undefined ? '' : formatNumber(n, 3, { trim: true }))

  const footer = step === 'pick' ? <Button onClick={onClose}>{t('common.cancel')}</Button>
    : step === 'map' ? <><Button onClick={() => setStep('pick')}>{t('common.back')}</Button><Button variant="primary" icon={<FileUp size={18} />} disabled={!ok || !dataRows.length} onClick={() => void run()}>{t('products.import.run', { n: dataRows.length })}</Button></>
    : step === 'done' ? <Button variant="primary" onClick={onClose}>{t('common.done')}</Button>
    : undefined

  return (
    <Modal open={open} onClose={step === 'running' ? () => undefined : onClose} title={t('products.import.title')} size="wide" noClose={step === 'running'} footer={footer}>
      {step === 'pick' && (
        <div className="col">
          <p className="muted small">{t('products.import.intro')}</p>
          <ul className="pr-import-tips small muted">
            <li>{t('products.import.tip1')}</li>
            <li>{t('products.import.tip2')}</li>
            <li>{t('products.import.tip3')}</li>
          </ul>
          <div className="row wrap">
            <Button variant="primary" size="lg" icon={<FileSpreadsheet size={20} />} loading={busy} onClick={() => void pick()}>{t('products.import.pickFile')}</Button>
            <Button size="lg" icon={<Download size={20} />} onClick={() => void template()}>{t('products.import.template')}</Button>
          </div>
        </div>
      )}
      {step === 'map' && (
        <div className="col">
          <div className="row between wrap">
            <span className="small"><b>{fileName}</b> · {t('products.import.rows', { n: dataRows.length })}</span>
          </div>
          <SwitchRow label={t('products.import.hasHeader')} on={hasHeader} onChange={v => { setHasHeader(v); setMapping(v ? autoMap(rows[0] ?? []) : {}) }} />
          <div className="form-grid pr-map-grid">
            {IMPORT_FIELDS.map(f => (
              <Field key={f} label={t(`products.import.field.${f}`)}>
                <Select value={mapping[f] === undefined ? '' : String(mapping[f])} onChange={e => setField(f, e.target.value)}>
                  <option value="">{t('products.import.notMapped')}</option>
                  {headerLabels.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          {!ok && <div className="banner warn"><AlertTriangle size={16} />{t('products.import.needKey')}</div>}
          {mapping.stock !== undefined && <div className="banner warn"><AlertTriangle size={16} />{t('products.import.stockWarn')}</div>}
          <div className="section-title">{t('products.import.preview')}</div>
          <div className="table-wrap">
            <table className="table pr-preview">
              <thead><tr><th>{t('common.name')}</th><th>{t('common.barcode')}</th><th className="num">{t('common.price')}</th><th className="num">{t('common.cost')}</th><th className="num">{t('products.stock')}</th><th>{t('common.category')}</th><th>{t('products.unit')}</th></tr></thead>
              <tbody>
                {preview.map(r => (
                  <tr key={r.line}>
                    <td>{r.name || <span className="faint">—</span>}</td>
                    <td className="num">{r.barcodes.join(', ')}</td>
                    <td className="num">{fmt(r.price)}</td>
                    <td className="num">{fmt(r.cost)}</td>
                    <td className="num">{fmt(r.stock)}</td>
                    <td>{r.category}</td>
                    <td>{r.unit}</td>
                  </tr>
                ))}
                {!preview.length && <tr><td colSpan={7} className="faint center">{t('products.import.noRows')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {step === 'running' && (
        <div className="empty">
          <Spinner />
          <h3>{t('products.import.running')}</h3>
          <p className="num">{progress.done} / {progress.total}</p>
        </div>
      )}
      {step === 'done' && report && (
        <div className="col">
          <div className="empty" style={{ padding: '16px 0 4px' }}>
            <div className="ico" style={{ color: 'var(--primary)' }}><CheckCircle2 size={36} /></div>
            <h3>{t('products.import.doneTitle')}</h3>
          </div>
          <div className="stats">
            <div className="stat"><div className="stat-label">{t('products.import.created')}</div><div className="stat-value num">{report.created}</div></div>
            <div className="stat"><div className="stat-label">{t('products.import.updated')}</div><div className="stat-value num">{report.updated}</div></div>
            <div className="stat"><div className="stat-label">{t('products.import.skipped')}</div><div className="stat-value num">{report.skipped.length}</div></div>
            {report.categoriesCreated > 0 && <div className="stat"><div className="stat-label">{t('products.import.newCategories')}</div><div className="stat-value num">{report.categoriesCreated}</div></div>}
          </div>
          {report.skipped.length > 0 && (
            <div className="card flat">
              <div className="list">
                {report.skipped.slice(0, 30).map((s, i) => (
                  <div key={i} className="list-row" style={{ minHeight: 40 }}>
                    <span className="badge">{t('products.import.line', { n: s.line })}</span>
                    <span className="grow truncate">{s.name || <span className="faint">—</span>}</span>
                    <span className="small muted">{skipReasonText(s.reason)}</span>
                  </div>
                ))}
                {report.skipped.length > 30 && <div className="list-row small faint">{t('products.import.moreSkipped', { n: report.skipped.length - 30 })}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
