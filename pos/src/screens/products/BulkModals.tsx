// Dialogs for the multi-select bar: change prices by % or a fixed amount, move to a category.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { Product } from '../../db/types'
import { useT } from '../../i18n'
import { Modal, Button, Input, Field, Seg, Select, Money } from '../../components/ui'
import { toast, useSettings } from '../../state/store'
import { parseNumber, round } from '../../lib/money'

type Mode = 'pct' | 'amount'
type Dir = 'up' | 'down'

export function newPrice(price: number, mode: Mode, dir: Dir, value: number, decimals: number): number {
  const delta = mode === 'pct' ? (price * value) / 100 : value
  return Math.max(0, round(dir === 'up' ? price + delta : price - delta, decimals))
}

export function BulkPriceModal({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: Product[]; onDone?: () => void }) {
  const t = useT()
  const settings = useSettings()
  const d = settings.currency.decimals
  const [mode, setMode] = useState<Mode>('pct')
  const [dir, setDir] = useState<Dir>('up')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setText(''); setMode('pct'); setDir('up') } }, [open])
  const value = parseNumber(text)
  const valid = text.trim() !== '' && value > 0
  const preview = useMemo(() => products.slice(0, 3).map(p => ({ p, to: newPrice(p.price, mode, dir, value, d) })), [products, mode, dir, value, d])

  const apply = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const now = Date.now()
      await db.transaction('rw', db.products, async () => {
        for (const p of products) await db.products.update(p.id, { price: newPrice(p.price, mode, dir, value, d), updatedAt: now })
      })
      toast(t('products.bulk.priceDone', { n: products.length }), 'success')
      onDone?.(); onClose()
    } catch { toast(t('common.error'), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('products.bulk.priceTitle', { n: products.length })} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => void apply()} disabled={!valid} loading={busy}>{t('products.bulk.apply')}</Button>
      </>
    }>
      <div className="col">
        <Seg block value={dir} onChange={setDir} options={[{ value: 'up', label: t('products.bulk.increase') }, { value: 'down', label: t('products.bulk.decrease') }]} />
        <Seg block value={mode} onChange={setMode} options={[{ value: 'pct', label: t('products.bulk.byPct') }, { value: 'amount', label: t('products.bulk.byAmount') }]} />
        <Field label={mode === 'pct' ? t('products.bulk.pctLabel') : t('products.bulk.amountLabel', { s: settings.currency.symbol })}>
          <Input ltr inputMode="decimal" value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="0" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void apply() } }} />
        </Field>
        {valid && preview.length > 0 && (
          <div className="card flat list">
            {preview.map(({ p, to }) => (
              <div key={p.id} className="list-row" style={{ minHeight: 42 }}>
                <span className="grow truncate small">{p.name}</span>
                <span className="small faint"><Money value={p.price} /></span>
                <span className="small">←</span>
                <span className="bold"><Money value={to} /></span>
              </div>
            ))}
            {products.length > 3 && <div className="list-row xs faint" style={{ minHeight: 32 }}>{t('products.bulk.andMore', { n: products.length - 3 })}</div>}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function BulkCategoryModal({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: Product[]; onDone?: () => void }) {
  const t = useT()
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? []
  const [catId, setCatId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setCatId('') }, [open])

  const apply = async () => {
    setBusy(true)
    try {
      const now = Date.now()
      await db.transaction('rw', db.products, async () => {
        for (const p of products) await db.products.update(p.id, { categoryId: catId || undefined, updatedAt: now })
      })
      toast(t('products.bulk.categoryDone', { n: products.length }), 'success')
      onDone?.(); onClose()
    } catch { toast(t('common.error'), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('products.bulk.categoryTitle', { n: products.length })} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => void apply()} loading={busy}>{t('products.bulk.apply')}</Button>
      </>
    }>
      <Field label={t('common.category')}>
        <Select value={catId} onChange={e => setCatId(e.target.value)} autoFocus>
          <option value="">{t('products.noCategory')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
        </Select>
      </Field>
    </Modal>
  )
}
