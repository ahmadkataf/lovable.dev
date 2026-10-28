// جرد: count what is on the shelves, see the difference against the system, apply it as 'count' moves.
// The session is saved in db.kv 'stocktake.draft' so it survives a reload.
import { useEffect, useState } from 'react'
import { ClipboardCheck, X, Check, Trash2 } from 'lucide-react'
import { db } from '../../db'
import type { Product } from '../../db/types'
import { useT } from '../../i18n'
import { Badge, Button, Empty, Field, Input, Modal, Spinner, useIsMobile } from '../../components/ui'
import { setStock } from '../../lib/stock'
import { formatQty } from '../../lib/money'
import { formatDate } from '../../lib/format'
import { toast, confirmDialog, useUser } from '../../state/store'
import { addCountLine, countDiff, countSummary, signedQty, type CountLine } from './logic'
import { NumPadSheet, ProductAvatar, ProductPicker, unitLabel, useProductsMap, type PickVia } from './shared'

const DRAFT_KEY = 'stocktake.draft'
interface Draft { lines: CountLine[]; note: string; startedAt: number }
const EMPTY: Draft = { lines: [], note: '', startedAt: 0 }

export function StockTakeTab() {
  const t = useT()
  const user = useUser()
  const mobile = useIsMobile()
  const products = useProductsMap()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void db.kv.get(DRAFT_KEY).then(row => {
      if (!alive) return
      const dr = row?.value as Draft | undefined
      if (dr && Array.isArray(dr.lines)) setDraft({ lines: dr.lines, note: dr.note ?? '', startedAt: dr.startedAt ?? 0 })
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (!loaded) return
    const h = window.setTimeout(() => { if (draft.lines.length) void db.kv.put({ key: DRAFT_KEY, value: draft }); else void db.kv.delete(DRAFT_KEY) }, 400)
    return () => clearTimeout(h)
  }, [loaded, draft])

  const systemOf = (id: string) => products?.get(id)?.stock ?? 0
  const summary = countSummary(draft.lines, systemOf)
  const editLine = editId ? draft.lines.find(l => l.productId === editId) : undefined

  const onPick = (p: Product, via: PickVia) => {
    setDraft(d => ({ ...d, startedAt: d.startedAt || Date.now(), lines: via === 'scan' ? addCountLine(d.lines, p, 1, 'increment') : d.lines.some(l => l.productId === p.id) ? d.lines : addCountLine(d.lines, p, 0) }))
    if (via !== 'scan') setEditId(p.id)
  }
  const setCounted = (id: string, counted: number) => setDraft(d => ({ ...d, lines: d.lines.map(l => (l.productId === id ? { ...l, counted } : l)) }))
  const remove = (id: string) => setDraft(d => ({ ...d, lines: d.lines.filter(l => l.productId !== id) }))
  const cancel = async () => {
    if (!(await confirmDialog({ title: t('inventory.count.cancel'), text: t('inventory.count.cancelText'), danger: true, okLabel: t('inventory.count.cancel') }))) return
    setDraft(EMPTY)
    await db.kv.delete(DRAFT_KEY)
  }
  const apply = async () => {
    if (busy) return
    setBusy(true)
    try {
      const note = draft.note.trim() || t('inventory.count.defaultNote', { d: formatDate(Date.now()) })
      await db.transaction('rw', db.products, db.stockMoves, async () => {
        for (const l of draft.lines) await setStock(l.productId, l.counted, user?.id, note)
      })
      await db.kv.delete(DRAFT_KEY)
      setDraft(EMPTY)
      setConfirmOpen(false)
      toast(summary.withDiff ? t('inventory.count.applied', { n: summary.withDiff }) : t('inventory.count.noDiff'), 'success')
    } catch { toast(t('common.error'), 'error') } finally { setBusy(false) }
  }

  if (!loaded || !products) return <div className="empty"><Spinner /></div>
  const diffLines = draft.lines.filter(l => countDiff(l, systemOf(l.productId)) !== 0)

  return (
    <div className="col">
      <div className="card pad col" style={{ gap: 8 }}>
        <div className="row"><ClipboardCheck size={20} className="faint" /><div className="grow"><div className="bold">{t('inventory.count.title')}</div><div className="small muted">{t('inventory.count.intro')}</div></div></div>
        <ProductPicker onPick={onPick} onlyTracked autoFocus={!mobile} placeholder={t('inventory.form.searchPh')} />
      </div>

      {draft.lines.length === 0 ? (
        <Empty icon={<ClipboardCheck size={32} />} title={t('inventory.count.empty')} text={t('inventory.count.emptyText')} />
      ) : (
        <>
          <div className="card list">
            {draft.lines.map(l => {
              const p = products.get(l.productId)
              const system = systemOf(l.productId)
              const diff = countDiff(l, system)
              return (
                <div key={l.productId} className="list-row">
                  {!mobile && <ProductAvatar p={p ?? { name: l.name }} size={36} />}
                  <span className="grow truncate">
                    <span className="title truncate">{p?.name ?? l.name}</span>
                    <span className="sub num">{t('inventory.count.system')}: {formatQty(system)} {unitLabel(l.unit)}</span>
                  </span>
                  <button type="button" className="inv-count-btn num" onClick={() => setEditId(l.productId)} aria-label={t('inventory.count.enterQty')}>{formatQty(l.counted)}</button>
                  <span className="inv-diff">{diff === 0 ? <Badge>{t('inventory.count.matches')}</Badge> : <Badge kind={diff > 0 ? 'primary' : 'danger'} className="num">{signedQty(diff)}</Badge>}</span>
                  <Button variant="ghost" iconOnly icon={<X size={18} />} onClick={() => remove(l.productId)} aria-label={t('common.delete')} />
                </div>
              )
            })}
          </div>
          <div className="inv-sticky">
            <div className="inv-summary grow">
              <span className="small"><span className="faint">{t('inventory.count.items', { n: summary.items })}</span></span>
              <span className="small"><b className="num">{summary.withDiff}</b> <span className="faint">{t('inventory.count.withDiff')}</span></span>
              {summary.plus > 0 && <span className="small num inv-pos">+{formatQty(summary.plus)}</span>}
              {summary.minus > 0 && <span className="small num inv-neg">-{formatQty(summary.minus)}</span>}
            </div>
            <Button variant="ghost" icon={<Trash2 size={18} />} iconOnly={mobile} onClick={() => void cancel()} title={t('inventory.count.cancel')}>{t('inventory.count.cancel')}</Button>
            <Button variant="primary" size="lg" icon={<Check size={18} />} onClick={() => setConfirmOpen(true)}>{t('inventory.count.apply')}</Button>
          </div>
        </>
      )}

      {editLine && (
        <NumPadSheet open onClose={() => setEditId(null)} title={editLine.name} initial={editLine.counted} decimals={editLine.allowFraction ? 3 : 0} allowZero
          suffix={unitLabel(editLine.unit)} hint={`${t('inventory.count.system')}: ${formatQty(systemOf(editLine.productId))}`} confirmLabel={t('common.done')}
          onConfirm={n => setCounted(editLine.productId, n)} />
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('inventory.count.confirmTitle')} footer={
        <>
          <Button onClick={() => setConfirmOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={busy} onClick={() => void apply()}>{diffLines.length ? t('inventory.count.apply') : t('inventory.count.finish')}</Button>
        </>
      }>
        <div className="col">
          {diffLines.length === 0 ? <p className="muted">{t('inventory.count.noDiff')}</p> : (
            <>
              <p className="muted small">{t('inventory.count.confirmText', { n: diffLines.length })}</p>
              <div className="card flat list">
                {diffLines.map(l => {
                  const system = systemOf(l.productId)
                  const diff = countDiff(l, system)
                  return (
                    <div key={l.productId} className="list-row inv-mini-row">
                      <span className="grow truncate">{l.name}</span>
                      <span className="num muted small">{formatQty(system)} → {formatQty(l.counted)}</span>
                      <Badge kind={diff > 0 ? 'primary' : 'danger'} className="num">{signedQty(diff)}</Badge>
                    </div>
                  )
                })}
              </div>
              <div className="inv-summary">
                {summary.plus > 0 && <span><span className="faint">{t('inventory.count.plus')}</span> <b className="num inv-pos">+{formatQty(summary.plus)}</b></span>}
                {summary.minus > 0 && <span><span className="faint">{t('inventory.count.minus')}</span> <b className="num inv-neg">-{formatQty(summary.minus)}</b></span>}
              </div>
            </>
          )}
          <Field label={t('inventory.count.note')}><Input value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} placeholder={t('inventory.count.notePh')} /></Field>
        </div>
      </Modal>
    </div>
  )
}
