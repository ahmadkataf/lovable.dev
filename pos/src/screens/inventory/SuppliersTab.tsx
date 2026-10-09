// الموردون: the list, and the add / edit dialog (also used inline from the purchase form).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../../db'
import type { Supplier } from '../../db/types'
import { useT, useLang } from '../../i18n'
import { Avatar, Button, Empty, Field, Input, Modal, SearchInput, Spinner, Textarea } from '../../components/ui'
import { formatMoney, round } from '../../lib/money'
import { uid } from '../../lib/ids'
import { toast, useSettings, useUser, isAdmin } from '../../state/store'
import { normalize } from './logic'

export function SuppliersTab() {
  const t = useT()
  const nav = useNavigate()
  const lang = useLang()
  const c = useSettings().currency
  const admin = isAdmin(useUser())
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(false)
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [])
  if (!suppliers) return <div className="empty"><Spinner /></div>
  const list = suppliers.filter(s => !q.trim() || normalize(s.name).includes(normalize(q)) || (s.phone ?? '').includes(q.trim()))
  const owed = round(suppliers.reduce((s, x) => s + Math.max(0, x.balance), 0), c.decimals)
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight
  return (
    <div className="col">
      <div className="inv-toolbar">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder={t('inventory.suppliers.search')} noWedge />
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdd(true)}>{t('inventory.suppliers.add')}</Button>
      </div>
      {admin && suppliers.length > 0 && (
        <div className="stats">
          <div className="stat"><div className="stat-label">{t('inventory.suppliers.totalBalance')}</div><div className={`stat-value num ${owed > 0 ? 'inv-warn' : ''}`}>{formatMoney(owed, c)}</div></div>
          <div className="stat"><div className="stat-label">{t('inventory.suppliers.count')}</div><div className="stat-value num">{suppliers.length}</div></div>
        </div>
      )}
      {suppliers.length === 0 ? (
        <Empty icon={<Truck size={32} />} title={t('inventory.suppliers.empty')} text={t('inventory.suppliers.emptyText')} action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdd(true)}>{t('inventory.suppliers.add')}</Button>} />
      ) : list.length === 0 ? <Empty title={t('common.noResults')} /> : (
        <div className="card list">
          {list.map(s => (
            <button key={s.id} type="button" className="list-row" onClick={() => nav(`/inventory/suppliers/${s.id}`)}>
              <Avatar name={s.name} round />
              <span className="grow truncate"><span className="title truncate">{s.name}</span><span className="sub num">{s.phone ?? ''}</span></span>
              <span className="end">
                {s.balance > 0 ? <><span className="num bold inv-warn">{formatMoney(s.balance, c)}</span><span className="sub">{t('inventory.suppliers.weOwe')}</span></>
                  : s.balance < 0 ? <><span className="num bold inv-pos">{formatMoney(-s.balance, c)}</span><span className="sub">{t('inventory.suppliers.owesUs')}</span></>
                  : <span className="sub">{t('inventory.suppliers.settled')}</span>}
              </span>
              <Chevron size={18} className="faint" />
            </button>
          ))}
        </div>
      )}
      <SupplierModal open={add} onClose={() => setAdd(false)} onSaved={s => nav(`/inventory/suppliers/${s.id}`)} />
    </div>
  )
}

/** Add or edit a supplier (name is required). */
export function SupplierModal({ open, onClose, supplier, onSaved }: { open: boolean; onClose: () => void; supplier?: Supplier; onSaved?: (s: Supplier) => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setName(supplier?.name ?? ''); setPhone(supplier?.phone ?? ''); setNotes(supplier?.notes ?? ''); setBusy(false) } }, [open, supplier])
  const save = async () => {
    if (!name.trim()) { toast(t('inventory.suppliers.errName'), 'error'); return }
    setBusy(true)
    try {
      const row: Supplier = {
        id: supplier?.id ?? uid(), name: name.trim(), phone: phone.trim() || undefined, notes: notes.trim() || undefined,
        balance: supplier?.balance ?? 0, createdAt: supplier?.createdAt ?? Date.now(),
      }
      await db.suppliers.put(row)
      toast(t('common.saved'), 'success')
      onClose()
      onSaved?.(row)
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={supplier ? t('inventory.suppliers.edit') : t('inventory.suppliers.add')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={busy} onClick={() => void save()}>{t('common.save')}</Button>
      </>
    }>
      <div className="col">
        <Field label={t('common.name')}><Input value={name} onChange={e => setName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') void save() }} /></Field>
        <Field label={t('common.phone')} hint={t('common.optional')}><Input ltr inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <Field label={t('common.notes')}><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></Field>
      </div>
    </Modal>
  )
}
