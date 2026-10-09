// One purchase invoice (or a supplier payment): items, totals, print, pay the supplier, delete (admin).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, Trash2, HandCoins, ShoppingBag, Truck } from 'lucide-react'
import { db } from '../../db'
import { useT } from '../../i18n'
import { Badge, Button, Empty, Spinner, useIsMobile } from '../../components/ui'
import { formatMoney, formatQty, round } from '../../lib/money'
import { formatDateTime } from '../../lib/format'
import { deletePurchase, isSupplierPayment, purchaseRemaining, type PurchaseRecord } from '../../lib/purchases'
import { toast, confirmDialog, useSettings, useUser, isAdmin } from '../../state/store'
import { SubHead, unitLabel, useProductsMap } from './shared'
import { PaySupplierModal } from './PaySupplierModal'
import { printPurchase } from './print'

export function PurchaseDetail() {
  const { id = '' } = useParams()
  const t = useT()
  const nav = useNavigate()
  const user = useUser()
  const admin = isAdmin(user)
  const settings = useSettings()
  const c = settings.currency
  const mobile = useIsMobile()
  const [pay, setPay] = useState(false)
  const p = useLiveQuery(async () => ((await db.purchases.get(id)) as PurchaseRecord | undefined) ?? null, [id])
  const supplier = useLiveQuery(async () => (p?.supplierId ? (await db.suppliers.get(p.supplierId)) ?? null : null), [p?.supplierId])
  const userName = useLiveQuery(async () => (p ? (await db.users.get(p.userId))?.name : undefined), [p?.userId])
  const products = useProductsMap()
  if (p === undefined) return <div className="empty"><Spinner /></div>
  if (p === null) return <div className="page"><SubHead title={t('inventory.tab.purchases')} back="/inventory/purchases" /><Empty icon={<ShoppingBag size={32} />} title={t('inventory.detail.notFound')} /></div>

  const payment = isSupplierPayment(p)
  const remaining = purchaseRemaining(p, c.decimals)
  const title = payment ? t('inventory.detail.paymentTitle', { n: p.number }) : t('inventory.detail.title', { n: p.number })
  const del = async () => {
    if (!user) return
    if (!(await confirmDialog({ title: t('inventory.detail.delete'), text: payment ? t('inventory.detail.deletePaymentText') : t('inventory.detail.deleteText'), danger: true, okLabel: t('common.delete') }))) return
    try {
      await deletePurchase(p.id, user, c.decimals)
      toast(t('common.deleted'), 'success')
      nav('/inventory/purchases', { replace: true })
    } catch { toast(t('common.error'), 'error') }
  }
  return (
    <div className="page">
      <SubHead title={title} sub={`${formatDateTime(p.createdAt)}${userName ? ` · ${userName}` : ''}`} back="/inventory/purchases" actions={
        <>
          <Button variant="ghost" iconOnly icon={<Printer size={18} />} onClick={() => void printPurchase(p, settings, supplier)} title={t('common.print')} aria-label={t('common.print')} />
          {admin && <Button variant="ghost" iconOnly icon={<Trash2 size={18} />} onClick={() => void del()} title={t('common.delete')} aria-label={t('common.delete')} />}
        </>
      } />
      <div className="page-body narrow col">
        <div className="card pad col" style={{ gap: 8 }}>
          <div className="row">
            <span className={`inv-move-ico ${payment ? 'pay' : 'in'}`}>{payment ? <HandCoins size={18} /> : <ShoppingBag size={18} />}</span>
            <div className="grow truncate">
              <div className="xs faint">{t('common.supplier')}</div>
              {p.supplierId ? <button type="button" className="inv-link bold" onClick={() => nav(`/inventory/suppliers/${p.supplierId}`)}><Truck size={14} /> {p.supplierName}</button> : <div className="bold">{t('inventory.purchases.noSupplier')}</div>}
            </div>
            {p.method && <Badge kind="info">{t('common.' + p.method)}</Badge>}
            {p.shiftId && <Badge>{t('inventory.form.drawer')}</Badge>}
          </div>
          {p.note && <div className="small muted">{p.note}</div>}
        </div>

        {!payment && (
          mobile ? (
            <div className="card list">
              {p.items.map((i, k) => {
                const prod = products?.get(i.productId)
                return (
                  <div key={k} className="list-row">
                    <span className="grow truncate"><span className="title truncate">{i.name}</span><span className="sub num">{formatQty(i.qty)} {unitLabel(prod?.unit ?? '')} × {formatMoney(i.cost, c)}</span></span>
                    <span className="end num bold">{formatMoney(round(i.qty * i.cost, c.decimals), c)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>{t('inventory.moves.product')}</th><th className="num">{t('common.qty')}</th><th className="num">{t('inventory.form.unitCost')}</th><th className="num">{t('common.total')}</th></tr></thead>
                <tbody>
                  {p.items.map((i, k) => (
                    <tr key={k}>
                      <td className="num muted">{k + 1}</td>
                      <td className="bold">{i.name}</td>
                      <td className="num">{formatQty(i.qty)} {unitLabel(products?.get(i.productId)?.unit ?? '')}</td>
                      <td className="num">{formatMoney(i.cost, c)}</td>
                      <td className="num bold">{formatMoney(round(i.qty * i.cost, c.decimals), c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        <div className="card pad col inv-totals">
          {!payment && <div className="row between inv-total-line"><span>{t('common.total')}</span><span className="num inv-big">{formatMoney(p.total, c)}</span></div>}
          <div className="row between"><span className="muted">{payment ? t('inventory.pay.amount') : t('common.paid')}</span><span className={`num bold ${payment ? 'inv-pos' : ''}`}>{formatMoney(p.paid, c)}</span></div>
          {!payment && <div className="row between"><span className="muted">{t('common.remaining')}</span><span className={`num bold ${remaining > 0 ? 'inv-warn' : ''}`}>{formatMoney(remaining, c)}</span></div>}
          {supplier && <div className="row between"><span className="muted">{t('inventory.suppliers.balance')}</span><span className={`num ${supplier.balance > 0 ? 'inv-warn' : ''}`}>{formatMoney(supplier.balance, c)}</span></div>}
        </div>

        <div className="inv-actions-2">
          <Button variant="outline" size="lg" icon={<Printer size={18} />} onClick={() => void printPurchase(p, settings, supplier)}>{t('common.print')}</Button>
          {supplier && (remaining > 0 || supplier.balance > 0) && <Button variant="primary" size="lg" icon={<HandCoins size={18} />} onClick={() => setPay(true)}>{t('inventory.detail.pay')}</Button>}
        </div>
      </div>
      {supplier && <PaySupplierModal open={pay} onClose={() => setPay(false)} supplier={supplier} />}
    </div>
  )
}
