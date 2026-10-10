// Movement history of one item: a summary, quick in/out, and every movement with the balance after it.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownToLine, ArrowUpFromLine, History, MapPin, Pencil, Truck } from 'lucide-react'
import { db } from '@/db'
import { todayISO } from '@/db/ids'
import { Button, Drawer, EmptyState, Skeleton } from '@/ui'
import { useI18n } from '@/i18n'
import { useMoney, useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { fmtDate, fmtTime } from '@/lib/dates'
import { isLowStock, itemValue, withRunningBalance, type MoveDirection } from './lib'
import { QuickMoveForm } from './QuickMove'
import { CategoryBadge, ExpiryBadge, ReasonBadge, StockBadge, qtyText, unitLabel, useUnitMoney } from './parts'

export default function MovementsDrawer({ itemId, onClose, onEdit }: { itemId: string | null; onClose: () => void; onEdit?: (id: string) => void }) {
  const { t, lang } = useI18n()
  const money = useMoney()
  const unitMoney = useUnitMoney()
  const users = useUsers(false)
  const { readOnly } = useLicense()
  const [dir, setDir] = useState<MoveDirection | null>(null)
  // undefined while loading, null when the item no longer exists (deleted elsewhere, or a movement of a removed item)
  const item = useLiveQuery(async () => (itemId ? (await db.inventory.get(itemId)) ?? null : undefined), [itemId])
  const moves = useLiveQuery(() => (itemId ? db.stock.where('itemId').equals(itemId).toArray() : []), [itemId])
  const rows = useMemo(() => (item && moves ? withRunningBalance(moves, item.quantity) : []), [item, moves])
  const userName = (id?: string) => users.find(u => u.id === id)?.name
  const today = todayISO()

  const close = () => { setDir(null); onClose() }
  if (!itemId) return null
  const unit = item ? unitLabel(t, item.unit) : ''
  return (
    <Drawer open={!!itemId} onClose={close} title={<span className="row gap-2"><History className="inv-drawer-icon" />{t('inventory.history')}</span>}
      footer={item && onEdit && !readOnly ? <><Button variant="ghost" onClick={close}>{t('close')}</Button><Button variant="secondary" icon={<Pencil />} onClick={() => onEdit(item.id)}>{t('inventory.editItem')}</Button></> : undefined}>
      {item === null ? (
        <EmptyState compact icon={<History />} title={t('inventory.deletedItem')} description={t('inventory.deletedItemDesc')} />
      ) : !item ? (
        <div className="col gap-3"><Skeleton h={96} r={16} /><Skeleton h={56} /><Skeleton h={56} /><Skeleton h={56} /></div>
      ) : (
        <div className="col gap-4">
          <div className={`inv-summary${isLowStock(item) ? ' is-low' : ''}`}>
            <div className="grow">
              <div className="inv-summary-name"><bdi>{item.name}</bdi></div>
              <div className="row wrap gap-2 mt-1">
                <CategoryBadge category={item.category} />
                {item.sku && <span className="inv-sku ltr">{item.sku}</span>}
                <StockBadge item={item} />
                <ExpiryBadge date={item.expiryDate} today={today} />
              </div>
              <div className="inv-summary-meta">
                {item.location && <span className="row gap-1"><MapPin /><bdi>{item.location}</bdi></span>}
                {item.supplier && <span className="row gap-1"><Truck /><bdi>{item.supplier}</bdi></span>}
              </div>
            </div>
            <div className="inv-summary-qty">
              <div className={`inv-big num${isLowStock(item) ? ' inv-text-danger' : ''}`}>{qtyText(item.quantity, lang)}</div>
              <div className="inv-summary-unit">{unit}</div>
              <div className="inv-summary-min">{t('inventory.minLabel', { n: qtyText(item.minQuantity, lang) })}</div>
            </div>
          </div>
          <div className="inv-summary-stats">
            <div><span className="muted">{t('inventory.col.cost')}</span><span className="money">{item.costPrice ? unitMoney(item.costPrice) : '—'}</span></div>
            <div><span className="muted">{t('inventory.col.value')}</span><span className="money">{money(itemValue(item))}</span></div>
            <div><span className="muted">{t('inventory.col.expiry')}</span><span>{item.expiryDate ? fmtDate(item.expiryDate, lang) : '—'}</span></div>
          </div>

          {!readOnly && (dir ? (
            <div className="inv-inline-move">
              <QuickMoveForm key={dir} item={item} initialDir={dir} onDone={() => setDir(null)} onCancel={() => setDir(null)} />
            </div>
          ) : (
            <div className="inv-drawer-actions">
              <Button variant="soft" icon={<ArrowDownToLine />} onClick={() => setDir('in')}>{t('inventory.move.add')}</Button>
              <Button variant="secondary" icon={<ArrowUpFromLine />} onClick={() => setDir('out')} disabled={item.quantity <= 0}>{t('inventory.move.remove')}</Button>
            </div>
          ))}

          <div>
            <div className="inv-section-title">{t('inventory.lastMovements')}{moves && moves.length > 0 && <span className="inv-count num">{moves.length}</span>}</div>
            {!moves ? <div className="col gap-2"><Skeleton h={52} /><Skeleton h={52} /></div>
              : rows.length === 0 ? <EmptyState compact icon={<History />} title={t('inventory.history.empty')} description={t('inventory.history.emptyDesc')} />
              : (
                <div className="inv-timeline">
                  {rows.map(m => (
                    <div key={m.id} className="inv-tl-row">
                      <div className="grow">
                        <div className="row wrap gap-2"><ReasonBadge reason={m.reason} /><span className="inv-tl-date">{fmtDate(m.date, lang)} · {fmtTime(m.createdAt, lang)}</span></div>
                        {(m.note || userName(m.by)) && (
                          <div className="inv-tl-sub">{m.note && <bdi>{m.note}</bdi>}{m.note && userName(m.by) && <span className="inv-dot">·</span>}{userName(m.by) && <span>{userName(m.by)}</span>}</div>
                        )}
                      </div>
                      <div className="inv-tl-end">
                        <div className={`inv-delta num ${m.delta >= 0 ? 'pos' : 'neg'}`}>{m.delta >= 0 ? '+' : '−'}{qtyText(Math.abs(m.delta), lang)}</div>
                        <div className="inv-tl-after">{t('inventory.col.after')}: <span className="num">{qtyText(m.after, lang)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
