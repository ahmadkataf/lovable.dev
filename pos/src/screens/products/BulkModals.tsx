// Dialogs for the multi-select bar: change prices by % or a fixed amount, convert pricing to / from the second
// currency, move to a category. The arithmetic lives in product-utils (bulkPricePatch / anchorProduct).
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle } from 'lucide-react'
import { db } from '../../db'
import { isFxPriced, type Product } from '../../db/types'
import { useT } from '../../i18n'
import { Modal, Button, Input, Field, Seg, Select, Money } from '../../components/ui'
import { toast, useSettings } from '../../state/store'
import { parseNumber, formatMoney } from '../../lib/money'
import { formatRate } from '../../lib/fx'
import { bulkPricePatch, anchorProduct, newPrice, type BulkPriceMode as Mode, type BulkDir as Dir } from './product-utils'

export { newPrice }

export function BulkPriceModal({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: Product[]; onDone?: () => void }) {
  const t = useT()
  const settings = useSettings()
  const d = settings.currency.decimals
  const c2 = settings.currency2
  const fx = c2.enabled && c2.rate > 0 ? c2 : undefined
  const [mode, setMode] = useState<Mode>('pct')
  const [dir, setDir] = useState<Dir>('up')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setText(''); setMode('pct'); setDir('up') } }, [open])
  const value = parseNumber(text)
  const valid = text.trim() !== '' && value > 0
  // a fixed amount cannot apply to a product anchored in the second currency: those are skipped (use percent)
  const anchoredCount = useMemo(() => (fx ? products.filter(p => isFxPriced(p)).length : 0), [products, fx])
  const skipped = mode === 'amount' ? anchoredCount : 0
  const preview = useMemo(() => products.map(p => ({ p, patch: bulkPricePatch(p, mode, dir, value, d, fx) })).filter(x => x.patch).slice(0, 3), [products, mode, dir, value, d, fx])
  const applicable = products.length - skipped

  const apply = async () => {
    if (!valid || !applicable) return
    setBusy(true)
    try {
      const now = Date.now()
      let n = 0
      await db.transaction('rw', db.products, async () => {
        for (const p of products) {
          const patch = bulkPricePatch(p, mode, dir, value, d, fx, now)
          if (!patch) continue
          await db.products.update(p.id, { ...patch, updatedAt: now })
          n++
        }
      })
      toast(t('products.bulk.priceDone', { n }), 'success')
      if (skipped) toast(t('products.bulk.fxSkipped', { n: skipped, cur: c2.symbol }), 'warn')
      onDone?.(); onClose()
    } catch { toast(t('common.error'), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('products.bulk.priceTitle', { n: products.length })} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => void apply()} disabled={!valid || !applicable} loading={busy}>{t('products.bulk.apply')}</Button>
      </>
    }>
      <div className="col">
        <Seg block value={dir} onChange={setDir} options={[{ value: 'up', label: t('products.bulk.increase') }, { value: 'down', label: t('products.bulk.decrease') }]} />
        <Seg block value={mode} onChange={setMode} options={[{ value: 'pct', label: t('products.bulk.byPct') }, { value: 'amount', label: t('products.bulk.byAmount') }]} />
        <Field label={mode === 'pct' ? t('products.bulk.pctLabel') : t('products.bulk.amountLabel', { s: settings.currency.symbol })}>
          <Input ltr inputMode="decimal" value={text} onChange={e => setText(e.target.value)} autoFocus placeholder="0" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void apply() } }} />
        </Field>
        {skipped > 0 && (
          <div className="banner warn"><AlertTriangle size={16} />{applicable ? t('products.bulk.fxSkipped', { n: skipped, cur: c2.symbol }) : t('products.bulk.fxAll', { cur: c2.symbol })}</div>
        )}
        {valid && preview.length > 0 && (
          <div className="card flat list">
            {preview.map(({ p, patch }) => (
              <div key={p.id} className="list-row" style={{ minHeight: 42 }}>
                <span className="grow truncate small">{p.name}{fx && isFxPriced(p) && <span className="xs faint num"> {formatMoney(p.fxPrice!, c2)} → {formatMoney(patch!.fxPrice ?? p.fxPrice!, c2)}</span>}</span>
                <span className="small faint"><Money value={p.price} /></span>
                <span className="small">←</span>
                <span className="bold"><Money value={patch!.price ?? p.price} /></span>
              </div>
            ))}
            {applicable > 3 && <div className="list-row xs faint" style={{ minHeight: 32 }}>{t('products.bulk.andMore', { n: applicable - 3 })}</div>}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Convert the selection's pricing: to the second currency (anchors at today's rate) or back to the primary (anchors dropped). Admin only. */
export function BulkAnchorModal({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: Product[]; onDone?: () => void }) {
  const t = useT()
  const settings = useSettings()
  const d = settings.currency.decimals
  const c2 = settings.currency2
  const rateOk = c2.enabled && c2.rate > 0
  const [to, setTo] = useState<'secondary' | 'primary'>('secondary')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setTo(rateOk ? 'secondary' : 'primary') }, [open, rateOk])
  const main = settings.currency.symbol
  // what each product becomes; products already in the target currency are left alone
  const plan = useMemo(() => products
    .filter(p => (to === 'secondary' ? !isFxPriced(p) : isFxPriced(p) || typeof p.fxCost === 'number'))
    .map(p => ({ p, next: anchorProduct(p, to, c2, d) }))
    .filter((x): x is { p: Product; next: Product } => !!x.next), [products, to, c2, d])
  const preview = plan.slice(0, 3)

  const apply = async () => {
    if (!plan.length) return
    setBusy(true)
    try {
      const now = Date.now()
      await db.transaction('rw', db.products, async () => {
        const rows = plan.map(({ p }) => anchorProduct(p, to, c2, d, now)).filter((x): x is Product => !!x).map(x => ({ ...x, updatedAt: now }))
        await db.products.bulkPut(rows)
      })
      toast(t('products.bulk.convertDone', { n: plan.length }), 'success')
      onDone?.(); onClose()
    } catch { toast(t('common.error'), 'error') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('products.bulk.convertTitle', { n: products.length })} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={() => void apply()} disabled={!plan.length} loading={busy}>{t('products.bulk.apply')}</Button>
      </>
    }>
      <div className="col">
        <Seg block value={to} onChange={setTo} options={[{ value: 'secondary', label: t('products.bulk.toSecondary', { cur: c2.symbol }) }, { value: 'primary', label: t('products.bulk.toPrimary', { main }) }]} />
        {to === 'secondary' && !rateOk ? (
          <div className="banner warn"><AlertTriangle size={16} />{t('products.fxNoRate')}</div>
        ) : (
          <p className="small muted">{to === 'secondary' ? t('products.bulk.toSecondaryNote', { cur: c2.symbol, rate: formatRate(c2.rate, settings), main }) : t('products.bulk.toPrimaryNote', { main })}</p>
        )}
        {preview.length > 0 && (
          <div className="card flat list pr-anchor-preview">
            {preview.map(({ p, next }) => (
              <div key={p.id} className="list-row">
                <span className="grow truncate small">{p.name}</span>
                {to === 'secondary' ? (
                  <>
                    <span className="small faint"><Money value={p.price} /></span>
                    <span className="small">←</span>
                    <span className="bold num">{formatMoney(next.fxPrice ?? 0, c2)}</span>
                    {next.price !== p.price && <span className="xs faint"><Money value={next.price} /></span>}
                  </>
                ) : (
                  <>
                    <span className="small faint num">{typeof p.fxPrice === 'number' ? formatMoney(p.fxPrice, c2) : '—'}</span>
                    <span className="small">←</span>
                    <span className="bold"><Money value={next.price} /></span>
                  </>
                )}
              </div>
            ))}
            {plan.length > 3 && <div className="list-row xs faint" style={{ minHeight: 32 }}>{t('products.bulk.andMore', { n: plan.length - 3 })}</div>}
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
