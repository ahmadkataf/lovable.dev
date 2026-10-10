// After the sale: the big check, the change to hand back, the receipt number, print / share, new sale.
import { useEffect } from 'react'
import { Check, Receipt } from 'lucide-react'
import type { Sale, Settings } from '../../db/types'
import { formatMoney, round } from '../../lib/money'
import { currencyForCode } from '../../lib/fx'
import { useT } from '../../i18n'
import { Modal, Button } from '../../components/ui'
import { ReceiptView, ReceiptActions } from '../../components/ReceiptView'

export function DoneDialog({ sale, balanceAfter, settings, showKbd, onClose }: { sale: Sale; balanceAfter?: number; settings: Settings; showKbd: boolean; onClose: () => void }) {
  const t = useT()
  const c = settings.currency
  // the total in the second currency at the rate the sale was valued at
  const c2 = sale.rate && sale.rate > 0 && settings.currency2.enabled ? currencyForCode(sale.rateCode, settings) : null
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const el = document.activeElement as HTMLElement | null
      if (el && el.closest('.modal') && el.tagName === 'BUTTON' && el.dataset.newSale === undefined) return   // print / share buttons take their own Enter
      e.preventDefault(); onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <Modal open onClose={onClose} title={t('sales.doneTitle')} size="narrow" footer={
      <Button variant="primary" size="lg" block autoFocus data-new-sale="" icon={<Receipt size={18} />} onClick={onClose}>
        {t('sales.doneNew')} {showKbd && <span className="kbd">Enter</span>}
      </Button>
    }>
      <div className="done-head">
        <div className="done-check"><Check size={40} strokeWidth={3} /></div>
        {sale.change > 0 && (
          <>
            <div className="done-change-lbl">{t('sales.doneChange')}</div>
            <div className="done-change num">{formatMoney(sale.change, c)}</div>
          </>
        )}
        <div className="done-no">{t('sales.doneReceipt', { n: sale.number })} · <span className="num">{formatMoney(sale.total, c)}</span></div>
        {c2 && <div className="done-fx small muted num">≈ {formatMoney(round(sale.total / sale.rate!, c2.decimals), c2)}</div>}
        <ReceiptActions sale={sale} settings={settings} balanceAfter={balanceAfter} />
      </div>
      <div className="done-receipt">
        <ReceiptView sale={sale} settings={settings} compact />
      </div>
    </Modal>
  )
}
