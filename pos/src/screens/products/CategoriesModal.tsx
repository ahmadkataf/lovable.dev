// The categories manager: add, rename, colour, emoji, reorder and delete.
import { useEffect, useState } from 'react'
import { forbiddenProduct } from '../../lib/policy'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Tag } from 'lucide-react'
import { db } from '../../db'
import type { Category } from '../../db/types'
import { useT } from '../../i18n'
import { Modal, Button, Input, Avatar, Empty, Field } from '../../components/ui'
import { toast, confirmDialog } from '../../state/store'
import { uid } from '../../lib/ids'
import { PRODUCT_COLORS } from './product-utils'
import { SHOP_EMOJIS } from './emoji'

interface Draft { id?: string; name: string; color: string; icon: string }

export function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? []
  const counts = useLiveQuery(async () => {
    const m: Record<string, number> = {}
    await db.products.each(p => { if (p.categoryId) m[p.categoryId] = (m[p.categoryId] ?? 0) + 1 })
    return m
  }, []) ?? {}
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!open) setDraft(null) }, [open])

  const startNew = () => setDraft({ name: '', color: PRODUCT_COLORS[categories.length % PRODUCT_COLORS.length], icon: '' })
  const startEdit = (c: Category) => setDraft({ id: c.id, name: c.name, color: c.color, icon: c.icon ?? '' })

  const save = async () => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return
    if (categories.some(c => c.id !== draft.id && c.name.trim().toLowerCase() === name.toLowerCase())) { toast(t('products.cats.exists'), 'warn'); return }
    if (forbiddenProduct({ name })) { toast(t('policy.tobaccoCategory'), 'error'); return }
    setSaving(true)
    try {
      if (draft.id) {
        await db.categories.update(draft.id, { name, color: draft.color, icon: draft.icon || undefined })
        toast(t('common.saved'), 'success')
      } else {
        const sort = categories.reduce((m, c) => Math.max(m, c.sort), 0) + 1
        await db.categories.add({ id: uid(), name, color: draft.color, icon: draft.icon || undefined, sort, createdAt: Date.now() })
        toast(t('products.categoryCreated'), 'success')
      }
      setDraft(null)
    } catch { toast(t('common.error'), 'error') } finally { setSaving(false) }
  }

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= categories.length) return
    const order = categories.map(c => c.id)
    ;[order[i], order[j]] = [order[j], order[i]]
    await db.transaction('rw', db.categories, async () => {
      for (let k = 0; k < order.length; k++) await db.categories.update(order[k], { sort: k + 1 })
    })
  }

  const remove = async (c: Category) => {
    const n = counts[c.id] ?? 0
    const ok = await confirmDialog({ title: t('products.cats.deleteTitle', { name: c.name }), text: n ? t('products.cats.deleteText', { n }) : t('products.cats.deleteEmpty'), danger: true, okLabel: t('common.delete') })
    if (!ok) return
    try {
      await db.transaction('rw', db.categories, db.products, async () => {
        await db.products.where('categoryId').equals(c.id).modify(p => { delete p.categoryId; p.updatedAt = Date.now() })
        await db.categories.delete(c.id)
      })
      toast(t('common.deleted'), 'success')
      if (draft?.id === c.id) setDraft(null)
    } catch { toast(t('common.error'), 'error') }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('products.cats.title')} footer={<Button variant="primary" onClick={onClose}>{t('common.done')}</Button>}>
      <div className="col">
        {draft ? (
          <div className="card flat pad col pr-cat-editor">
            <div className="row">
              <Avatar name={draft.name || '?'} color={draft.color} emoji={draft.icon || undefined} size={48} />
              <Field label={draft.id ? t('products.cats.rename') : t('products.cats.new')} className="grow">
                <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder={t('products.categoryNamePh')} autoFocus maxLength={40}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void save() } }} />
              </Field>
            </div>
            <div className="pr-swatches">
              {PRODUCT_COLORS.map(c => <button key={c} type="button" className={`pr-swatch ${draft.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })} aria-label={c} />)}
            </div>
            <div className="chips">
              <button type="button" className={`chip ${!draft.icon ? 'on' : ''}`} onClick={() => setDraft({ ...draft, icon: '' })}>{t('common.none')}</button>
              {SHOP_EMOJIS.map(e => <button key={e} type="button" className={`chip pr-emoji-chip ${draft.icon === e ? 'on' : ''}`} onClick={() => setDraft({ ...draft, icon: e })}>{e}</button>)}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button onClick={() => setDraft(null)} disabled={saving}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!draft.name.trim()}>{t('common.save')}</Button>
            </div>
          </div>
        ) : (
          <Button variant="soft" icon={<Plus size={18} />} onClick={startNew}>{t('products.cats.new')}</Button>
        )}

        {categories.length === 0 ? (
          <Empty icon={<Tag size={32} />} title={t('products.cats.empty')} text={t('products.cats.emptyText')} />
        ) : (
          <div className="list card flat">
            {categories.map((c, i) => (
              <div key={c.id} className="list-row">
                <Avatar name={c.name} color={c.color} emoji={c.icon} size={36} />
                <div className="grow truncate">
                  <div className="title truncate">{c.name}</div>
                  <div className="sub">{t('products.cats.count', { n: counts[c.id] ?? 0 })}</div>
                </div>
                <div className="row" style={{ gap: 2 }}>
                  <Button variant="ghost" iconOnly size="sm" icon={<ChevronUp size={16} />} disabled={i === 0} onClick={() => void move(i, -1)} aria-label={t('products.cats.up')} title={t('products.cats.up')} />
                  <Button variant="ghost" iconOnly size="sm" icon={<ChevronDown size={16} />} disabled={i === categories.length - 1} onClick={() => void move(i, 1)} aria-label={t('products.cats.down')} title={t('products.cats.down')} />
                  <Button variant="ghost" iconOnly size="sm" icon={<Pencil size={16} />} onClick={() => startEdit(c)} aria-label={t('common.edit')} title={t('common.edit')} />
                  <Button variant="ghost" iconOnly size="sm" icon={<Trash2 size={16} />} onClick={() => void remove(c)} aria-label={t('common.delete')} title={t('common.delete')} />
                </div>
              </div>
            ))}
          </div>
        )}
        {categories.length > 0 && <p className="xs faint">{t('products.cats.orderHint')}</p>}
      </div>
    </Modal>
  )
}
