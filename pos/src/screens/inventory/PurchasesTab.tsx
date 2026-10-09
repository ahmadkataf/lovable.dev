// المشتريات: invoices and supplier payments in one sequence, newest first.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, ShoppingBag, HandCoins } from 'lucide-react'
import { db } from '../../db'
import { useT } from '../../i18n'
import { Badge, Button, Empty, SearchInput, Spinner } from '../../components/ui'
import { formatMoney, round } from '../../lib/money'
import { formatDay, formatTime, startOfMonth } from '../../lib/format'
import { isSupplierPayment, purchaseRemaining, type PurchaseRecord } from '../../lib/purchases'
import { useSettings, useUser, isAdmin } from '../../state/store'
import { normalize } from './logic'

export function PurchasesTab() {
  const t = useT()
  const nav = useNavigate()
  const c = useSettings().currency
  const admin = isAdmin(useUser())
  const [q, setQ] = useState('')
  const purchases = useLiveQuery(() => db.purchases.orderBy('createdAt').reverse().limit(500).toArray() as Promise<PurchaseRecord[]>, [])
  if (!purchases) return <div className="empty"><Spinner /></div>
  const s = normalize(q)
  const list = purchases.filter(p => !s || String(p.number).includes(s) || normalize(p.supplierName ?? '').includes(s) || normalize(p.note ?? '').includes(s))
  const monthStart = startOfMonth(Date.now())
  const monthTotal = round(purchases.filter(p => p.createdAt >= monthStart).reduce((a, p) => a + p.total, 0), c.decimals)
  const unpaid = round(purchases.reduce((a, p) => a + Math.max(0, purchaseRemaining(p, c.decimals)), 0), c.decimals)
  return (
    <div className="col">
      <div className="inv-toolbar">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder={t('inventory.purchases.search')} noWedge />
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => nav('/inventory/purchases/new')}>{t('inventory.purchases.new')}</Button>
      </div>
      {admin && purchases.length > 0 && (
        <div className="stats">
          <div className="stat"><div className="stat-label">{t('inventory.purchases.monthTotal')}</div><div className="stat-value num">{formatMoney(monthTotal, c)}</div></div>
          <div className="stat"><div className="stat-label">{t('inventory.purchases.unpaid')}</div><div className={`stat-value num ${unpaid > 0 ? 'inv-warn' : ''}`}>{formatMoney(unpaid, c)}</div></div>
        </div>
      )}
      {purchases.length === 0 ? (
        <Empty icon={<ShoppingBag size={32} />} title={t('inventory.purchases.empty')} text={t('inventory.purchases.emptyText')} action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => nav('/inventory/purchases/new')}>{t('inventory.purchases.new')}</Button>} />
      ) : list.length === 0 ? <Empty title={t('common.noResults')} /> : <PurchaseList purchases={list} />}
    </div>
  )
}

/** Rows of purchases / supplier payments; tapping one opens it. */
export function PurchaseList({ purchases }: { purchases: PurchaseRecord[] }) {
  const t = useT()
  const nav = useNavigate()
  const c = useSettings().currency
  return (
    <div className="card list">
      {purchases.map(p => {
        const payment = isSupplierPayment(p)
        const remaining = purchaseRemaining(p, c.decimals)
        return (
          <button key={p.id} type="button" className="list-row" onClick={() => nav(`/inventory/purchases/${p.id}`)}>
            <span className={`inv-move-ico ${payment ? 'pay' : 'in'}`}>{payment ? <HandCoins size={18} /> : <ShoppingBag size={18} />}</span>
            <span className="grow truncate">
              <span className="title truncate"><span className="num">#{p.number}</span> · {p.supplierName ?? t('inventory.purchases.noSupplier')}</span>
              <span className="sub truncate">{formatDay(p.createdAt)} {formatTime(p.createdAt)} · {payment ? t('inventory.purchases.payment') : t('inventory.purchases.items', { n: p.items.length })}{p.method ? ` · ${t('common.' + p.method)}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
            </span>
            <span className="end">
              <span className={`num bold ${payment ? 'inv-pos' : ''}`}>{formatMoney(payment ? p.paid : p.total, c)}</span>
              {!payment && (remaining > 0 ? <Badge kind="warn">{t('inventory.purchases.remaining', { v: formatMoney(remaining, c) })}</Badge> : <Badge kind="primary">{t('inventory.purchases.paidFull')}</Badge>)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
