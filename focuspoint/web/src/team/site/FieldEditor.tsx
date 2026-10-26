// One field of a section, whatever its kind (FieldSpec from CONTENT_SECTIONS), plus the list widget (cards with
// add / remove / move up-down; an item's fields come from `spec.item`). Nothing here knows a section by name.
import { useEffect, useRef, useState } from 'react'
import { fillTemplate, type FieldSpec, type Photo } from '@shared/content'
import { Button, Icon } from '../../ui'
import { Confirm } from '../common'
import { cx } from '../util'
import { ColorField, FieldShell, IconField, LinkField, NumberField, SelectField, TextField, ToggleField, useEditor, type WidgetProps } from './fields'
import { ImageField, ImagesField } from './ImageField'
import { isObj, newListItem, type Obj } from './value'

export interface FieldEditorProps extends WidgetProps {
  /** today's default for this field («الأصل» on images); undefined inside list items */
  def?: unknown
}

export function FieldEditor(props: FieldEditorProps) {
  const { spec, path, value, onChange, def } = props
  switch (spec.kind) {
    case 'text': case 'longtext': return <TextField {...props} />
    case 'link': return <LinkField {...props} />
    case 'toggle': return <ToggleField {...props} />
    case 'number': return <NumberField {...props} />
    case 'select': return <SelectField {...props} />
    case 'icon': return <IconField {...props} />
    case 'color': return <ColorField {...props} />
    case 'image':
      return (
        <FieldShell spec={spec} path={path} value={value}>
          <ImageField value={isObj(value) ? (value as unknown as Photo) : null} onChange={onChange} optional={!!spec.optional}
            def={def === undefined ? undefined : isObj(def) ? (def as unknown as Photo) : null} />
        </FieldShell>
      )
    case 'images': return <GalleryField {...props} />
    case 'list': return <ListField {...props} />
    default: return null
  }
}

function GalleryField({ spec, path, value, onChange }: FieldEditorProps) {
  const { error } = useEditor()
  return (
    <FieldShell spec={spec} path={path} value={value}>
      <ImagesField value={Array.isArray(value) ? (value as Photo[]) : []} onChange={onChange} max={spec.maxItems ?? 12} pathPrefix={path} errorPath={error?.owner} />
    </FieldShell>
  )
}

// ---------- list ----------
let keySeq = 0
const newKey = () => `k${++keySeq}`

/** First words of an item for its folded header. */
function summary(spec: FieldSpec, item: Obj, i: number, vars: Record<string, string> = {}): string {
  for (const sf of spec.item ?? []) {
    const v = item[sf.key]
    if ((sf.kind === 'text' || sf.kind === 'longtext') && typeof v === 'string' && v.trim()) return fillTemplate(v.replace(/\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim(), vars)
    if (sf.kind === 'select' && typeof v === 'string') return sf.options?.find((o) => o.value === v)?.label ?? v
  }
  return `عنصر ${i + 1}`
}

function ListField({ spec, path, value, onChange }: FieldEditorProps) {
  const { error, isChanged, vars } = useEditor()
  const items: Obj[] = Array.isArray(value) ? value.map((x) => (isObj(x) ? x : {})) : []
  // Stable keys so an unfolded card stays unfolded when it moves.
  const keys = useRef<string[]>([])
  if (keys.current.length !== items.length) keys.current = items.map((_, i) => keys.current[i] ?? newKey())
  const [open, setOpen] = useState<Set<string>>(() => new Set(items.length <= 2 ? keys.current : []))
  const [removing, setRemoving] = useState<number | null>(null)
  const max = spec.fixed ? items.length : spec.maxItems ?? 20
  const min = spec.fixed ? items.length : spec.minItems ?? 0
  const compact = !!spec.fixed || (spec.item ?? []).every((sf) => sf.kind === 'toggle' || sf.kind === 'select' || sf.kind === 'icon')

  // A validation error inside an item unfolds that item.
  const errIdx = error && error.owner.startsWith(`${path}.`) ? Number(error.owner.slice(path.length + 1).split('.')[0]) : NaN
  useEffect(() => {
    if (Number.isInteger(errIdx) && keys.current[errIdx]) setOpen((s) => new Set(s).add(keys.current[errIdx] as string))
  }, [errIdx, error])

  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = items.slice(), ks = keys.current.slice()
    ;[next[i], next[j]] = [next[j] as Obj, next[i] as Obj]
    ;[ks[i], ks[j]] = [ks[j] as string, ks[i] as string]
    keys.current = ks
    onChange(next)
  }
  function add() {
    if (items.length >= max) return
    const k = newKey()
    keys.current = [...keys.current, k]
    setOpen((s) => new Set(s).add(k))
    onChange([...items, newListItem(spec, value)])
  }
  function remove(i: number) {
    keys.current = keys.current.filter((_, k) => k !== i)
    onChange(items.filter((_, k) => k !== i))
    setRemoving(null)
  }
  const setItem = (i: number, key: string, v: unknown) => { const next = items.slice(); next[i] = { ...items[i], [key]: v }; onChange(next) }

  return (
    <FieldShell spec={spec} path={path} value={value}>
      <ol className={cx('se-list', compact && 'is-compact')}>
        {items.map((item, i) => {
          const k = keys.current[i] as string
          const isOpen = compact || open.has(k)
          const itemPath = `${path}.${i}`
          return (
            <li key={k} className={cx('se-item', isOpen && 'is-open', error?.owner.startsWith(`${itemPath}.`) && 'has-error')} data-path={itemPath}>
              <div className="se-item-head">
                <span className="se-num" aria-hidden="true">{i + 1}</span>
                {compact ? (
                  <span className="se-item-title">{summary(spec, item, i, vars)}</span>
                ) : (
                  <button type="button" className="se-item-toggle" aria-expanded={isOpen} onClick={() => toggle(k)}>
                    <span className="se-item-title">{summary(spec, item, i, vars)}</span>
                    {isChanged(itemPath, item) && <span className="se-dot" title="تغيير ما انحفظ" />}
                    <Icon name="back" size={18} className="se-chev" />
                  </button>
                )}
                <div className="se-item-tools">
                  <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`${i + 1} لفوق`} title="لفوق"><Icon name="arrowUp" size={18} /></button>
                  <button type="button" className="icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`${i + 1} لتحت`} title="لتحت"><Icon name="arrowDown" size={18} /></button>
                  {!spec.fixed && <button type="button" className="icon-btn se-danger" disabled={items.length <= min} onClick={() => setRemoving(i)} aria-label={`حذف ${i + 1}`} title="حذف"><Icon name="trash" size={18} /></button>}
                </div>
              </div>
              {isOpen && (
                <div className={cx('se-item-body', compact && 'is-compact')}>
                  {(spec.item ?? []).filter((sf) => !(compact && sf.readonly)).map((sf) => (
                    // compact rows: the sub-fields' help is shown once under the list, not on every row
                    <FieldEditor key={sf.key} spec={compact ? { ...sf, help: undefined } : sf} path={`${itemPath}.${sf.key}`} value={item[sf.key]} onChange={(v) => setItem(i, sf.key, v)} />
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {compact && (spec.item ?? []).filter((sf) => sf.help).map((sf) => <p key={sf.key} className="field-hint">«{sf.label}»: {sf.help}</p>)}
      {!spec.fixed && (
        <div className="se-list-foot">
          <Button variant="soft" onClick={add} disabled={items.length >= max}><Icon name="plus" size={18} /> إضافة</Button>
          <span className="muted tiny">{items.length >= max ? `وصلت للحد الأقصى (${max})` : `${items.length} من ${max}`}</span>
        </div>
      )}
      <Confirm open={removing !== null} title="حذف هالعنصر؟" danger confirmLabel="حذف"
        body={<>«{removing !== null && items[removing] ? summary(spec, items[removing] as Obj, removing) : ''}» رح ينحذف من القائمة. ما بيتغيّر شي بالموقع قبل ما تضغط «حفظ».</>}
        onClose={() => setRemoving(null)} onConfirm={() => removing !== null && remove(removing)} />
    </FieldShell>
  )
}
