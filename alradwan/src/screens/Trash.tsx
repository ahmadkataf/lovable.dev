import { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { audit, bump, putMany, useStore } from '../db/store'
import { saveSale, savePurchase } from '../db/actions'
import type { Base, CollectionName, Customer, Expense, Payment, Product, Purchase, Sale, StockMovement, Supplier, CashEntry } from '../db/types'
import { COLLECTION_LABELS } from '../db/types'
import { fmtDateTime, invoiceNo, money } from '../lib/format'
import { Empty, Tabs } from '../ui/components'
import { useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'

type TrashKind = 'sales' | 'purchases' | 'products' | 'customers' | 'suppliers' | 'payments' | 'expenses' | 'cash'
const KINDS: { id: TrashKind; label: string }[] = [{ id: 'sales', label: 'فواتير' }, { id: 'purchases', label: 'مشتريات' }, { id: 'products', label: 'قطع' }, { id: 'customers', label: 'عملاء' }, { id: 'suppliers', label: 'موردون' }, { id: 'payments', label: 'دفعات' }, { id: 'expenses', label: 'مصاريف' }, { id: 'cash', label: 'صندوق' }]

/** Nothing deleted is really gone: every record is kept and can be brought back by the owner. */
export function Trash() {
  const [kind, setKind] = useState<TrashKind>('sales')
  const [rows, setRows] = useState<Base[]>([])
  const [loading, setLoading] = useState(true)
  const version = useStore(s => s.version)
  const toast = useToast(); const confirm = useConfirm()

  useEffect(() => {
    let alive = true
    setLoading(true)
    db.table<Base>(kind).filter(r => !!r.deleted).toArray().then(list => { if (alive) { setRows(list.sort((a, b) => b.updatedAt - a.updatedAt)); setLoading(false) } })
    return () => { alive = false }
  }, [kind, version])

  const describe = (r: Base): { title: string; sub: string } => {
    switch (kind) {
      case 'sales': { const s = r as Sale; return { title: `${s.type === 'return' ? 'مرتجع' : s.type === 'quote' ? 'عرض سعر' : 'فاتورة'} ${invoiceNo(s.number)} — ${s.customerName}`, sub: `${money(s.total)} · ${s.items.length} صنف · ${fmtDateTime(s.date)}` } }
      case 'purchases': { const p = r as Purchase; return { title: `شراء ${invoiceNo(p.number)} — ${p.supplierName}`, sub: `${money(p.total)} · ${fmtDateTime(p.date)}` } }
      case 'products': { const p = r as Product; return { title: p.name, sub: `${p.code} · بيع ${money(p.price)}` } }
      case 'customers': { const c = r as Customer; return { title: c.name, sub: c.phone ?? '' } }
      case 'suppliers': { const c = r as Supplier; return { title: c.name, sub: c.phone ?? '' } }
      case 'payments': { const p = r as Payment; return { title: `${p.partyType === 'customer' ? 'تحصيل من' : 'دفع إلى'} ${p.partyName}`, sub: `${money(p.amount)} · ${fmtDateTime(p.date)}` } }
      case 'expenses': { const e = r as Expense; return { title: `مصروف ${e.category}`, sub: `${money(e.amount)} · ${fmtDateTime(e.date)}${e.note ? ` · ${e.note}` : ''}` } }
      case 'cash': { const c = r as CashEntry; return { title: c.direction === 'in' ? 'إيداع' : 'سحب', sub: `${money(c.amount)} · ${fmtDateTime(c.date)}` } }
    }
  }

  const restore = async (r: Base) => {
    const d = describe(r)
    if (!(await confirm({ title: `استعادة «${d.title}»؟`, text: kind === 'sales' || kind === 'purchases' ? 'ستعود الفاتورة وأثرها على المخزون والصندوق والحسابات.' : undefined, okText: 'استعادة' }))) return
    try {
      if (kind === 'sales') { const { deleted: _d, ...s } = r as Sale; await saveSale({ ...s }) }
      else if (kind === 'purchases') { const { deleted: _d, ...p } = r as Purchase; await savePurchase({ ...p }) }
      else if (kind === 'products') {
        const moves = await db.table<StockMovement>('movements').filter(m => m.productId === r.id && !!m.deleted).toArray()
        await putMany([{ collection: 'products', record: { ...r, deleted: false } }, ...moves.map(m => ({ collection: 'movements' as CollectionName, record: { ...m, deleted: false } as Base }))])
      } else await putMany([{ collection: kind, record: { ...r, deleted: false } }])
      await audit('restore', `استعادة ${COLLECTION_LABELS[kind]}: ${d.title}`, kind, r.id)
      bump()
      toast.success('تمت الاستعادة')
    } catch (e) { toast.error('تعذّرت الاستعادة: ' + (e as Error).message) }
  }

  return (
    <div className="stack">
      <p className="muted">كل ما حُذف يبقى محفوظاً هنا ويمكن إرجاعه. لا يُحذف شيء نهائياً.</p>
      <Tabs value={kind} onChange={setKind} items={KINDS} small />
      <div className="card">
        {loading ? <div className="muted" style={{ padding: 20 }}>جارٍ التحميل…</div> : rows.length === 0 ? <Empty title="لا محذوفات هنا" icon={<Trash2 />} /> : (
          <div className="list" style={{ padding: '0 14px' }}>
            {rows.map(r => { const d = describe(r); return (
              <div key={r.id} className="list-item">
                <div className="grow"><div className="title">{d.title}</div><div className="sub">{d.sub} · حُذف {fmtDateTime(r.updatedAt)}</div></div>
                <button className="btn sm" onClick={() => restore(r)}><RotateCcw /> استعادة</button>
              </div>
            ) })}
          </div>
        )}
      </div>
    </div>
  )
}
