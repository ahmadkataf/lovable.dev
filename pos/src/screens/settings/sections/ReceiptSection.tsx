import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, FileText, RefreshCw } from 'lucide-react'
import { useStore, toast } from '../../../state/store'
import { useT } from '../../../i18n'
import { Button, Field, Select, Seg, SwitchRow, Textarea } from '../../../components/ui'
import type { Settings } from '../../../db/types'
import { platform } from '../../../lib/platform'
import { printSale } from '../../../lib/receipt'
import { formatMoney } from '../../../lib/money'
import { useDraft, SaveBar, SectionCard, Note } from '../shared'
import { sampleSale } from '../sample'

type ReceiptSettings = Settings['receipt']

export default function ReceiptSection() {
  const t = useT()
  const settings = useStore(s => s.settings)
  const user = useStore(s => s.user)
  const updateSettings = useStore(s => s.updateSettings)
  const d = useDraft<ReceiptSettings>(settings.receipt, async draft => updateSettings({ receipt: { ...draft, header: draft.header.trim(), footer: draft.footer.trim(), printerName: draft.printerName ?? '' } }))
  const [printers, setPrinters] = useState<{ name: string; isDefault: boolean }[] | null>(null)
  const [printing, setPrinting] = useState(false)

  const loadPrinters = async () => { setPrinters(null); setPrinters(await platform.getPrinters()) }
  useEffect(() => { if (platform.isDesktop) void loadPrinters() }, [])

  const testPrint = async () => {
    setPrinting(true)
    try {
      const s: Settings = { ...settings, receipt: d.draft }
      const ok = await printSale(sampleSale(s, user), s, { silent: false })
      toast(ok ? t('settings.receipt.testPrinted') : t('settings.receipt.testFailed'), ok ? 'success' : 'error')
    } catch { toast(t('settings.receipt.testFailed'), 'error') }
    finally { setPrinting(false) }
  }

  const c = settings.currency
  const sample = [[t('settings.receipt.sample.item1'), 2, 1.5], [t('settings.receipt.sample.item2'), 1, 3.25], [t('settings.receipt.sample.item3'), 1, 7.5]] as const
  const unit = c.decimals === 0 ? 1000 : 1
  const previewTotal = sample.reduce((a, [, q, p]) => a + q * p * unit, 0)

  return (
    <>
      <SectionCard title={t('settings.receipt.text')} icon={<FileText size={16} />}>
        <div className="form-grid">
          <Field label={t('settings.receipt.header')} span2>
            <Textarea value={d.draft.header} onChange={e => d.patch({ header: e.target.value })} placeholder={t('settings.receipt.headerPh')} rows={2} maxLength={200} style={{ minHeight: 64 }} />
          </Field>
          <Field label={t('settings.receipt.footer')} span2>
            <Textarea value={d.draft.footer} onChange={e => d.patch({ footer: e.target.value })} placeholder={t('settings.receipt.footerPh')} rows={2} maxLength={200} style={{ minHeight: 64 }} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.receipt.paper')} icon={<Printer size={16} />}>
        <div className="paper-row">
          <div className="col grow" style={{ gap: 4 }}>
            <Seg<'58' | '80'> block value={String(d.draft.paper) as '58' | '80'} onChange={v => d.patch({ paper: Number(v) as 58 | 80 })}
              options={[{ value: '58', label: t('settings.receipt.paper58') }, { value: '80', label: t('settings.receipt.paper80') }]} />
            <SwitchRow label={t('settings.receipt.showLogo')} desc={settings.store.logo ? t('settings.receipt.showLogoDesc') : <Link to="/settings/store">{t('settings.receipt.noLogo')}</Link>} on={d.draft.showLogo} onChange={v => d.patch({ showLogo: v })} />
            <SwitchRow label={t('settings.receipt.showBarcode')} desc={t('settings.receipt.showBarcodeDesc')} on={d.draft.showBarcode} onChange={v => d.patch({ showBarcode: v })} />
          </div>
          <div className="col" style={{ alignItems: 'center', gap: 6 }}>
            <div className={`paper-preview w${d.draft.paper}`} aria-hidden>
              {d.draft.showLogo && (settings.store.logo ? <img className="pp-logo" src={settings.store.logo} alt="" /> : <div className="pp-logo-ph" />)}
              <div className="pp-center pp-title">{settings.store.name || t('settings.receipt.previewStore')}</div>
              {d.draft.header && <div className="pp-center pp-muted pp-hdr">{d.draft.header}</div>}
              <div className="pp-sep" />
              {sample.map(([name, q, p]) => <div key={name} className="pp-line"><span className="truncate">{name} ×{q}</span><span>{formatMoney(q * p * unit, c, { symbol: false })}</span></div>)}
              <div className="pp-sep" />
              <div className="pp-line pp-total"><span>{t('settings.receipt.previewTotal')}</span><span>{formatMoney(previewTotal, c)}</span></div>
              {d.draft.showBarcode && <div className="pp-barcode" />}
              {d.draft.footer && <div className="pp-center pp-muted pp-hdr">{d.draft.footer}</div>}
            </div>
            <span className="xs faint">{t('settings.receipt.preview')}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t('settings.receipt.printing')} icon={<Printer size={16} />}>
        <SwitchRow label={t('settings.receipt.autoPrint')} desc={t(`settings.receipt.autoPrintDesc.${platform.kind}`)} on={d.draft.autoPrint} onChange={v => d.patch({ autoPrint: v })} />
        <div className="form-grid">
          <Field label={t('settings.receipt.copies')}>
            <Seg<'1' | '2' | '3'> block value={String(Math.min(3, Math.max(1, d.draft.copies))) as '1' | '2' | '3'} onChange={v => d.patch({ copies: Number(v) })}
              options={[{ value: '1', label: <span className="num">1</span> }, { value: '2', label: <span className="num">2</span> }, { value: '3', label: <span className="num">3</span> }]} />
          </Field>
          {platform.isDesktop && (
            <Field label={t('settings.receipt.printer')} hint={printers && printers.length === 0 ? t('settings.receipt.printerNone') : undefined}>
              <div className="row">
                <Select value={d.draft.printerName ?? ''} onChange={e => d.patch({ printerName: e.target.value })} className="grow">
                  <option value="">{t('settings.receipt.printerDefault')}</option>
                  {printers?.map(p => <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' ★' : ''}</option>)}
                  {d.draft.printerName && printers && !printers.some(p => p.name === d.draft.printerName) && <option value={d.draft.printerName}>{d.draft.printerName}</option>}
                </Select>
                <Button iconOnly icon={<RefreshCw size={16} />} loading={printers === null} onClick={() => void loadPrinters()} aria-label={t('common.retry')} />
              </div>
            </Field>
          )}
        </div>
        <div className="row wrap">
          <Button variant="soft" icon={<Printer size={16} />} loading={printing} onClick={() => void testPrint()}>{t('settings.receipt.testPrint')}</Button>
        </div>
        {!platform.isDesktop && (
          <Note kind="info"><b>{t('settings.receipt.androidHelp.title')}</b><br />{t('settings.receipt.androidHelp.text')}</Note>
        )}
        {platform.isDesktop && <Note>{t('settings.receipt.androidHelp.title')}: {t('settings.receipt.androidHelp.text')}</Note>}
      </SectionCard>

      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => void d.save()} onReset={d.reset} />
    </>
  )
}
