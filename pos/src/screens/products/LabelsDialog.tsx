// Print price labels for one or many products: pick the label size and copies, then send to the printer.
import { useMemo, useState } from 'react'
import { Printer, AlertTriangle } from 'lucide-react'
import type { Product } from '../../db/types'
import { useT } from '../../i18n'
import { Modal, Button, Field, Select, NumberInput, SwitchRow, Seg } from '../../components/ui'
import { toast, useSettings } from '../../state/store'
import { LABEL_SIZES, countLabels, printLabels, type LabelSize, type LabelPriceMode } from '../../lib/labels'

const STORAGE = 'kaseb.labels.size'
const PRICE_MODE_KEY = 'kaseb.labels.priceMode'
const PRICE_MODES: LabelPriceMode[] = ['primary', 'secondary', 'both']

export function LabelsDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const t = useT()
  const settings = useSettings()
  const [size, setSize] = useState<LabelSize>(() => { try { return (localStorage.getItem(STORAGE) as LabelSize) || '50x30' } catch { return '50x30' } })
  const [copies, setCopies] = useState(1)
  const [showStore, setShowStore] = useState(true)
  const [priceMode, setPriceMode] = useState<LabelPriceMode>(() => { try { const v = localStorage.getItem(PRICE_MODE_KEY) as LabelPriceMode; return PRICE_MODES.includes(v) ? v : 'primary' } catch { return 'primary' } })
  const [busy, setBusy] = useState(false)
  const c2 = settings.currency2
  // the price-mode choice only matters when something could print in the second currency
  const fxLabels = c2.enabled && (c2.pricing || products.some(p => typeof p.fxPrice === 'number'))
  const mode: LabelPriceMode = fxLabels ? priceMode : 'primary'

  const items = useMemo(() => products.map(p => ({ name: p.name, price: p.price, fxPrice: p.fxPrice, barcode: p.barcodes[0] ?? '', copies: Math.max(1, Math.floor(copies)) })), [products, copies])
  const noBarcode = products.filter(p => !p.barcodes.length).length
  const total = countLabels(items)

  const print = async () => {
    setBusy(true)
    try {
      try { localStorage.setItem(STORAGE, size); localStorage.setItem(PRICE_MODE_KEY, mode) } catch { /* ignore */ }
      const ok = await printLabels(items, settings, { size, showStore, priceMode: mode })
      if (ok) { toast(t('products.labels.sent', { n: total }), 'success'); onClose() }
      else toast(t('products.labels.failed'), 'error')
    } catch { toast(t('products.labels.failed'), 'error') }
    finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('products.labels.title')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" icon={<Printer size={18} />} loading={busy} onClick={() => void print()} disabled={!products.length}>{t('products.labels.print', { n: total })}</Button>
      </>
    }>
      <div className="col">
        <p className="muted small">{t('products.labels.count', { n: products.length })}</p>
        <Field label={t('products.labels.size')}>
          <Select value={size} onChange={e => setSize(e.target.value as LabelSize)}>
            {LABEL_SIZES.map(s => <option key={s.id} value={s.id}>{s.id === 'a4' ? t('products.labels.a4') : t('products.labels.roll', { w: s.w, h: s.h })}</option>)}
          </Select>
        </Field>
        <Field label={t('products.labels.copies')}>
          <NumberInput value={copies} onChange={n => setCopies(Math.min(200, Math.max(1, Math.floor(n))))} decimals={0} min={1} max={200} />
        </Field>
        {fxLabels && (
          <Field label={t('products.labels.priceMode')}>
            <Seg block value={priceMode} onChange={setPriceMode} options={[
              { value: 'primary', label: settings.currency.symbol },
              { value: 'secondary', label: c2.symbol },
              { value: 'both', label: t('products.labels.both') },
            ]} />
          </Field>
        )}
        <SwitchRow label={t('products.labels.showStore')} on={showStore} onChange={setShowStore} disabled={!settings.store.name.trim()} />
        {noBarcode > 0 && <div className="banner warn"><AlertTriangle size={16} />{t('products.labels.noBarcode', { n: noBarcode })}</div>}
      </div>
    </Modal>
  )
}
