// Plain-JSON helpers for the editor's draft: dot-path get/set (immutable), deep equality, and where a validation
// error belongs in the form. Section values are JSON objects shaped by CONTENT_SECTIONS (shared/content.ts).
import type { FieldSpec, SectionSpec } from '@shared/content'

export type Obj = Record<string, unknown>
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))

export function getAt(o: unknown, path: string): unknown {
  if (!path) return o
  let cur = o
  for (const k of path.split('.')) {
    if (isObj(cur)) cur = cur[k]
    else if (Array.isArray(cur) && /^\d+$/.test(k)) cur = cur[Number(k)]
    else return undefined
  }
  return cur
}

/** A copy of `o` with `path` set to `v` (objects along the path are copied, never mutated). */
export function setAt<T>(o: T, path: string, v: unknown): T {
  const [k, ...rest] = path.split('.')
  const base: Obj = isObj(o) ? { ...o } : {}
  base[k as string] = rest.length ? setAt(base[k as string], rest.join('.'), v) : v
  return base as T
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined), kb = Object.keys(b).filter((k) => b[k] !== undefined)
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]))
  }
  return false
}

/** A draft restored from this device may predate a schema change: every field missing from it takes the saved value. */
export function repairDraft(spec: SectionSpec, draft: unknown, saved: unknown): unknown {
  let out: unknown = isObj(draft) ? draft : clone(saved)
  for (const g of spec.groups) {
    for (const f of g.fields) {
      const d = getAt(out, f.key)
      const s = getAt(saved, f.key)
      const okType = f.kind === 'list' || f.kind === 'images' ? Array.isArray(d)
        : f.kind === 'image' ? d === null || isObj(d)
          : f.kind === 'toggle' ? typeof d === 'boolean'
            : f.kind === 'number' ? typeof d === 'number'
              : typeof d === 'string'
      if (!okType) out = setAt(out, f.key, clone(s))
    }
  }
  return out
}

/** Where an error path ("hero.chips.1.text", "hero.photo.src", "gallery.photos.3") is shown: the group to open, the
 *  field wrapper (data-path) that gets the message, and, inside a list, the item to unfold. */
export interface ErrorSpot { group: number; owner: string; label: string }
export function locateError(spec: SectionSpec, path: string): ErrorSpot | null {
  for (let gi = 0; gi < spec.groups.length; gi++) {
    for (const f of spec.groups[gi]!.fields) {
      if (path !== f.key && !path.startsWith(`${f.key}.`)) continue
      const rest = path === f.key ? '' : path.slice(f.key.length + 1)
      if (f.kind === 'list' && rest) {
        const [idx, ...sub] = rest.split('.')
        const subPath = sub.join('.')
        const sf = (f.item ?? []).find((s) => subPath === s.key || subPath.startsWith(`${s.key}.`))
        if (sf && /^\d+$/.test(idx ?? '')) return { group: gi, owner: `${f.key}.${idx}.${sf.key}`, label: `${f.label} ${Number(idx) + 1} › ${sf.label}` }
        if (/^\d+$/.test(idx ?? '')) return { group: gi, owner: `${f.key}.${idx}`, label: `${f.label} ${Number(idx) + 1}` }
      }
      if (f.kind === 'images' && rest) {
        const idx = rest.split('.')[0] ?? ''
        if (/^\d+$/.test(idx)) return { group: gi, owner: `${f.key}.${idx}`, label: `${f.label} › الصورة ${Number(idx) + 1}` }
      }
      return { group: gi, owner: f.key, label: f.label }
    }
  }
  return null
}

/** A fresh list item: empty texts, the first option, the icon of the first default item (or a neutral one). */
export function newListItem(f: FieldSpec, defaults: unknown): Obj {
  const first = Array.isArray(defaults) && isObj(defaults[0]) ? defaults[0] : {}
  const item: Obj = {}
  for (const sf of f.item ?? []) {
    switch (sf.kind) {
      case 'toggle': item[sf.key] = true; break
      case 'number': item[sf.key] = sf.min ?? 0; break
      case 'select': item[sf.key] = sf.options?.[0]?.value ?? ''; break
      case 'icon': item[sf.key] = typeof first[sf.key] === 'string' ? first[sf.key] : 'sparkle'; break
      case 'image': item[sf.key] = null; break
      case 'images': case 'list': item[sf.key] = []; break
      case 'color': item[sf.key] = typeof first[sf.key] === 'string' ? first[sf.key] : '#7b1e2e'; break
      default: item[sf.key] = ''
    }
  }
  return item
}
