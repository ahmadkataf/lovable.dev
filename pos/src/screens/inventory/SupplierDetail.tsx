// A supplier: contact, balance, their purchases and payments.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { Phone, MessageCircle, Pencil, Trash2, Plus, HandCoins, Truck } from 'lucide-react'
import { db } from '../../db'
import { useT } from '../../i18n'
import { Avatar, Button, Empty, Spinner, useIsMobile } from '../../components/ui'
import { formatMoney, round } from '../../lib/money'
import { formatDate } from '../../lib/format'
import { platform } from '../../lib/platform'
import type { PurchaseRecord } from '../../lib/purchases'
import { toast, confirmDialog, useSettings, useUser, isAdmin } from '../../state/store'
import { SubHead } from './shared'
import { SupplierModal } from './SuppliersTab'
import { PaySupplierModal } from './PaySupplierModal'
import { PurchaseList } from './PurchasesTab'

export function SupplierDetail() {
  const { id = '' } = useParams()
  const t = useT()
  const nav = useNavigate()
  const c = useSettings().currency
  const admin = isAdmin(useUser())
  const mobile = useIsMobile()
  const [edit, setEdit] = useState(false)
  const [pay, setPay] = useState(false)
  const s = useLiveQuery(async () => (await db.suppliers.get(id)) ?? null, [id])
  const purchases = useLiveQuery(() => db.purchases.where('supplierId').equals(id).reverse().sortBy('createdAt') as Promise<PurchaseRecord[]>, [id], [] as PurchaseRecord[])
  if (s === undefined) return <div className="empty"><Spinner /></div>
  if (s === null) return <div className="page"><SubHead title={t('common.supplier')} back="/inventory/suppliers" /><Empty icon={<Truck size={32} />} title={t('inventory.suppliers.notFound')} /></div>

  const bought = round(purchases.reduce((a, p) => a + p.total, 0), c.decimals)
  const paid = round(purchases.reduce((a, p) => a + p.paid, 0), c.decimals)
  const digits = (s.phone ?? '').replace(/[^0-9]/g, '').replace(/^00/, '')
  const del = async () => {
    const text = s.balance !== 0 ? `${t('inventory.suppliers.deleteText')} ${t('inventory.suppliers.deleteBalance', { v: formatMoney(s.balance, c) })}` : t('inventory.suppliers.deleteText')
    if (!(await confirmDialog({ title: t('inventory.suppliers.deleteTitle'), text, danger: true, okLabel: t('common.delete') }))) return
    await db.suppliers.delete(s.id)
    toast(t('common.deleted'), 'success')
    nav('/inventory/suppliers', { replace: true })
  }
  return (
    <div className="page">
      <SubHead title={s.name} sub={t('inventory.suppliers.since', { d: formatDate(s.createdAt) })} back="/inventory/suppliers" actions={
        <>
          <Button variant="ghost" iconOnly icon={<Pencil size={18} />} onClick={() => setEdit(true)} title={t('common.edit')} aria-label={t('common.edit')} />
          {admin && <Button variant="ghost" iconOnly icon={<Trash2 size={18} />} onClick={() => void del()} title={t('common.delete')} aria-label={t('common.delete')} />}
        </>
      } />
      <div className="page-body narrow col">
        <div className="card pad">
          <div className="row">
            <Avatar name={s.name} size={52} round />
            <div className="grow truncate">
              <div className="bold truncate">{s.name}</div>
              <div className="small muted num">{s.phone ?? t('inventory.suppliers.noPhone')}</div>
            </div>
            {s.phone && (
              <div className="row" style={{ gap: 6 }}>
                <Button variant="soft" iconOnly icon={<Phone size={18} />} onClick={() => platform.openUrl(`tel:${s.phone}`)} title={t('inventory.suppliers.call')} aria-label={t('inventory.suppliers.call')} />
                <Button variant="soft" iconOnly icon={<MessageCircle size={18} />} onClick={() => platform.openUrl(`https://wa.me/${digits}`)} title={t('inventory.suppliers.whatsapp')} aria-label={t('inventory.suppliers.whatsapp')} />
              </div>
            )}
          </div>
          {s.notes && <p className="small muted" style={{ marginTop: 10 }}>{s.notes}</p>}
        </div>
        <div className="stats">
          <div className="stat"><div className="stat-label">{t('inventory.suppliers.balance')}</div><div className={`stat-value num ${s.balance > 0 ? 'inv-warn' : s.balance < 0 ? 'inv-pos' : ''}`}>{formatMoney(s.balance, c)}</div><div className="stat-sub">{s.balance > 0 ? t('inventory.suppliers.weOwe') : s.balance < 0 ? t('inventory.suppliers.owesUs') : t('inventory.suppliers.settled')}</div></div>
          <div className="stat"><div className="stat-label">{t('inventory.suppliers.totalPurchases')}</div><div className="stat-value num">{formatMoney(bought, c)}</div></div>
          <div className="stat"><div className="stat-label">{t('inventory.suppliers.totalPaid')}</div><div className="stat-value num">{formatMoney(paid, c)}</div></div>
        </div>
        <div className="inv-actions-2">
          <Button variant="primary" size={mobile ? 'lg' : 'md'} icon={<Plus size={18} />} onClick={() => nav(`/inventory/purchases/new?supplier=${s.id}`)}>{t('inventory.suppliers.newPurchase')}</Button>
          <Button variant="soft" size={mobile ? 'lg' : 'md'} icon={<HandCoins size={18} />} onClick={() => setPay(true)}>{t('inventory.suppliers.pay')}</Button>
        </div>
        <div className="section-title">{t('inventory.suppliers.purchases')}<span className="faint num">{purchases.length}</span></div>
        {purchases.length === 0 ? <Empty title={t('inventory.suppliers.noPurchases')} /> : <PurchaseList purchases={purchases} />}
      </div>
      <SupplierModal open={edit} onClose={() => setEdit(false)} supplier={s} />
      <PaySupplierModal open={pay} onClose={() => setPay(false)} supplier={s} />
    </div>
  )
}
