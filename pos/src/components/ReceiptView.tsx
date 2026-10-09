// The receipt on screen: a white paper card that mirrors the printed layout (lib/receipt.ts builds the same
// document for the printer, for sharing and for this preview), plus the print / share buttons.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Printer, Share2 } from 'lucide-react'
import type { Sale, Refund, Settings } from '../db/types'
import { useStore, toast } from '../state/store'
import { addMessages, useT } from '../i18n'
import { receiptDoc, printSale, shareSale, type ReceiptLine } from '../lib/receipt'
import { balanceAfterSale } from '../lib/sales'
import { Button } from './ui'
import { BarcodeImage } from './BarcodeImage'
import '../screens/sales/receipt-view.css'

addMessages({
  ar: {
    'receipt.actions.printed': 'أُرسلت الفاتورة إلى الطابعة',
    'receipt.actions.printFailed': 'تعذّرت الطباعة — تحقق من الطابعة',
    'receipt.actions.shared': 'جاهزة للمشاركة',
    'receipt.actions.shareFailed': 'تعذّرت المشاركة',
    'receipt.actions.printCopy': 'طباعة نسخة',
  },
  en: {
    'receipt.actions.printed': 'Sent to the printer',
    'receipt.actions.printFailed': 'Could not print — check the printer',
    'receipt.actions.shared': 'Ready to share',
    'receipt.actions.shareFailed': 'Could not share',
    'receipt.actions.printCopy': 'Print a copy',
  },
})

export interface ReceiptViewProps {
  sale: Sale
  refund?: Refund
  settings?: Settings
  compact?: boolean
  /** Shows the "COPY" banner (a reprint). */
  copy?: boolean
}

function Row({ l }: { l: ReceiptLine }) {
  return (
    <div className={`rv-row ${l.strong ? 'strong' : ''} ${l.big ? 'big' : ''} ${l.small ? 'rv-s' : ''}`}>
      <span className="lbl">{l.label}</span>
      <span className="val num">{l.value}</span>
    </div>
  )
}

export function ReceiptView({ sale, refund, settings, compact, copy }: ReceiptViewProps) {
  const t = useT()
  const storeSettings = useStore(s => s.settings)
  const s = settings ?? storeSettings
  const balanceAfter = useLiveQuery(() => (sale.credit > 0 && !refund ? balanceAfterSale(sale) : Promise.resolve(undefined)), [sale.id, sale.credit, !!refund])
  const doc = receiptDoc(sale, s, { refund, copy, balanceAfter })
  return (
    <div className="rv-wrap">
      <div className={`rv-paper ${compact ? 'compact' : ''}`} data-paper={doc.paper} dir={doc.dir} lang={doc.lang}>
        {!compact && doc.logo && <img className="rv-logo" src={doc.logo} alt="" />}
        <div className="rv-store">{doc.storeName}</div>
        {!compact && doc.storeLines.map((l, i) => <div key={i} className="rv-c rv-s">{l}</div>)}
        {!compact && doc.header && <div className="rv-c rv-s" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{doc.header}</div>}
        {doc.title && <div className="rv-title">{doc.title}</div>}
        {doc.copy && <div className="rv-wm">{t('receipt.copy')}</div>}
        <hr className="rv-rule" />
        {doc.meta.map((l, i) => <Row key={i} l={l} />)}
        <hr className="rv-rule" />
        <div className="rv-items">
          {doc.items.map((i, k) => (
            <div key={k} className="rv-item">
              <div className="name">
                <div>{i.name}</div>
                {i.detail && <div className="sub num">{i.detail}{i.original && <span className="strike">{i.original}</span>}</div>}
                {i.discount && <div className="sub num">{i.discount}</div>}
                {i.note && <div className="sub">{i.note}</div>}
              </div>
              <div className="total num">{i.total}</div>
            </div>
          ))}
        </div>
        <div className="rv-count">{doc.itemCount}</div>
        <hr className="rv-rule" />
        {doc.totals.map((l, i) => <Row key={i} l={l} />)}
        {doc.payments.length > 0 && <div style={{ marginTop: 6 }}>{doc.payments.map((l, i) => <Row key={i} l={l} />)}</div>}
        {doc.extra.map((x, i) => <div key={i} className="rv-s" style={{ marginTop: 4 }}>{x}</div>)}
        {doc.note && <div className="rv-note" style={{ marginTop: 4 }}>{doc.note}</div>}
        {(doc.footer || doc.barcode) && !compact && <hr className="rv-rule" />}
        {!compact && doc.footer && <div className="rv-footer">{doc.footer}</div>}
        {!compact && doc.barcode && <div className="rv-barcode"><BarcodeImage value={doc.barcode} height={40} /></div>}
      </div>
    </div>
  )
}

export interface ReceiptActionsProps {
  sale: Sale
  refund?: Refund
  settings?: Settings
  compact?: boolean
  /** Print as a copy (a reprint from the history). */
  copy?: boolean
  /** The customer's balance after the sale, when the caller already knows it. */
  balanceAfter?: number
}

export function ReceiptActions({ sale, refund, settings, compact, copy, balanceAfter }: ReceiptActionsProps) {
  const t = useT()
  const storeSettings = useStore(s => s.settings)
  const s = settings ?? storeSettings
  const [busy, setBusy] = useState<'print' | 'share' | null>(null)
  const print = async () => {
    setBusy('print')
    try {
      const ok = await printSale(sale, s, { refund, copy, balanceAfter })
      toast(t(ok ? 'receipt.actions.printed' : 'receipt.actions.printFailed'), ok ? 'success' : 'error')
    } catch { toast(t('receipt.actions.printFailed'), 'error') }
    finally { setBusy(null) }
  }
  const share = async () => {
    setBusy('share')
    try {
      const ok = await shareSale(sale, s, { refund, copy, balanceAfter })
      toast(t(ok ? 'receipt.actions.shared' : 'receipt.actions.shareFailed'), ok ? 'success' : 'error')
    } catch { toast(t('receipt.actions.shareFailed'), 'error') }
    finally { setBusy(null) }
  }
  return (
    <div className="rv-actions">
      <Button size={compact ? 'sm' : 'md'} icon={<Printer size={18} />} loading={busy === 'print'} disabled={busy !== null} onClick={() => void print()}>
        {copy ? t('receipt.actions.printCopy') : t('common.print')}
      </Button>
      <Button size={compact ? 'sm' : 'md'} icon={<Share2 size={18} />} loading={busy === 'share'} disabled={busy !== null} onClick={() => void share()}>{t('common.share')}</Button>
    </div>
  )
}
