// /team/plan — المخطط: the floor plan editor. Plain SVG + pointer events, no drawing libraries.
// Rooms (from room.plan), walls/corridor blocks and labels can be dragged, resized (8 handles) and nudged with the
// arrow keys; everything snaps to a 20-unit grid. Saving queues room_upsert / settings_patch ops, so it works offline.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Plan, PlanRect, Room } from '@shared/types'
import { Button, Card, Empty, Field, Icon, Input, Spinner, useToast } from '../ui'
import { Confirm, PageHead } from './common'
import { store, useStore } from './store'
import { cx, describeError } from './util'

const GRID = 20
const MIN_SIZE = 40
type Label = Plan['labels'][number]
interface Doc { width: number; height: number; walls: PlanRect[]; labels: Label[]; rooms: Record<number, PlanRect | null> }
type Sel = { kind: 'room'; id: number } | { kind: 'wall'; i: number } | { kind: 'label'; i: number } | null
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
interface Drag { sel: NonNullable<Sel>; mode: 'move' | Handle; sx: number; sy: number; orig: PlanRect | Label; moved: boolean }

const snap = (v: number) => Math.round(v / GRID) * GRID
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function docFrom(plan: Plan, rooms: Room[]): Doc {
  const r: Record<number, PlanRect | null> = {}
  for (const room of rooms) r[room.id] = room.plan ? { ...room.plan } : null
  return { width: plan.width, height: plan.height, walls: plan.walls.map((w) => ({ ...w })), labels: plan.labels.map((l) => ({ ...l })), rooms: r }
}
const intersects = (a: PlanRect, b: PlanRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
/** First grid spot where a w×h rectangle does not overlap rooms or walls. */
function freeSpot(doc: Doc, w: number, h: number): PlanRect {
  const taken = [...Object.values(doc.rooms).filter((r): r is PlanRect => !!r), ...doc.walls]
  for (let y = GRID; y + h <= doc.height; y += GRID) for (let x = GRID; x + w <= doc.width; x += GRID) {
    const c = { x, y, w, h }
    if (!taken.some((t) => intersects(c, t))) return c
  }
  return { x: GRID, y: GRID, w, h }
}

export function PlanEditor() {
  const { ready, view, sync } = useStore()
  const toast = useToast()
  const settings = view.settings
  const [doc, setDoc] = useState<Doc | null>(null)
  const [base, setBase] = useState<Doc | null>(null)
  const [undo, setUndo] = useState<Doc[]>([])
  const [redo, setRedo] = useState<Doc[]>([])
  const [sel, setSel] = useState<Sel>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)

  // Load the editor once settings and rooms are available; re-seed only while the document is untouched.
  useEffect(() => {
    if (!settings) return
    const fresh = docFrom(settings.plan, view.rooms)
    if (!doc || (base && same(doc, base))) { setDoc(fresh); setBase(fresh) }
    else setBase(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, view.rooms])

  const dirty = !!doc && !!base && !same(doc, base)
  const commit = useCallback((next: Doc) => {
    setDoc((cur) => { if (cur) setUndo((u) => [...u.slice(-49), cur]); return next })
    setRedo([])
  }, [])
  const update = useCallback((fn: (d: Doc) => Doc) => setDoc((cur) => (cur ? fn(cur) : cur)), [])

  const doUndo = useCallback(() => { setUndo((u) => { const prev = u[u.length - 1]; if (!prev) return u; setDoc((cur) => { if (cur) setRedo((r) => [...r, cur]); return prev }); return u.slice(0, -1) }) }, [])
  const doRedo = useCallback(() => { setRedo((r) => { const next = r[r.length - 1]; if (!next) return r; setDoc((cur) => { if (cur) setUndo((u) => [...u, cur]); return next }); return r.slice(0, -1) }) }, [])

  // ---- geometry ----
  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg || !doc) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    const scale = r.width / doc.width
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale }
  }, [doc])

  const rectOf = (d: Doc, s: NonNullable<Sel>): PlanRect | Label | null =>
    s.kind === 'room' ? d.rooms[s.id] ?? null : s.kind === 'wall' ? d.walls[s.i] ?? null : d.labels[s.i] ?? null
  const setRect = (d: Doc, s: NonNullable<Sel>, r: PlanRect | Label): Doc => {
    if (s.kind === 'room') return { ...d, rooms: { ...d.rooms, [s.id]: r as PlanRect } }
    if (s.kind === 'wall') { const walls = d.walls.slice(); walls[s.i] = r as PlanRect; return { ...d, walls } }
    const labels = d.labels.slice(); labels[s.i] = r as Label; return { ...d, labels }
  }

  function startDrag(e: RPointerEvent, s: NonNullable<Sel>, mode: Drag['mode']) {
    if (!doc) return
    e.stopPropagation()
    e.preventDefault()
    const orig = rectOf(doc, s)
    if (!orig) return
    setSel(s)
    const p = toSvg(e.clientX, e.clientY)
    dragRef.current = { sel: s, mode, sx: p.x, sy: p.y, orig: { ...orig }, moved: false }
    svgRef.current?.setPointerCapture(e.pointerId)
    svgRef.current?.focus()
  }
  function onMove(e: RPointerEvent) {
    const d = dragRef.current
    if (!d) return
    const p = toSvg(e.clientX, e.clientY)
    const dx = p.x - d.sx, dy = p.y - d.sy
    if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return
    d.moved = true
    update((cur) => {
      const o = d.orig
      if (d.sel.kind === 'label') {
        const l = o as Label
        return setRect(cur, d.sel, { ...l, x: clamp(snap(l.x + dx), 0, cur.width), y: clamp(snap(l.y + dy), 0, cur.height) })
      }
      const r = o as PlanRect
      let { x, y, w, h } = r
      if (d.mode === 'move') {
        x = clamp(snap(r.x + dx), 0, cur.width - r.w)
        y = clamp(snap(r.y + dy), 0, cur.height - r.h)
      } else {
        const m = d.mode
        if (m.includes('e')) w = clamp(snap(r.w + dx), MIN_SIZE, cur.width - r.x)
        if (m.includes('s')) h = clamp(snap(r.h + dy), MIN_SIZE, cur.height - r.y)
        if (m.includes('w')) { const nx = clamp(snap(r.x + dx), 0, r.x + r.w - MIN_SIZE); w = r.w + (r.x - nx); x = nx }
        if (m.includes('n')) { const ny = clamp(snap(r.y + dy), 0, r.y + r.h - MIN_SIZE); h = r.h + (r.y - ny); y = ny }
      }
      return setRect(cur, d.sel, { x, y, w, h })
    })
  }
  function endDrag(e: RPointerEvent) {
    const d = dragRef.current
    dragRef.current = null
    try { svgRef.current?.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
    if (!d || !d.moved || !doc) return
    // Record the pre-drag document for undo (the live doc already holds the result).
    const before = setRect(doc, d.sel, d.orig)
    setUndo((u) => [...u.slice(-49), before])
    setRedo([])
  }

  // ---- keyboard ----
  function onKey(e: React.KeyboardEvent) {
    if (!doc) return
    const meta = e.ctrlKey || e.metaKey
    if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return }
    if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return }
    if (!sel) return
    const step = e.shiftKey ? GRID * 5 : GRID
    const r = rectOf(doc, sel)
    if (!r) return
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return }
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    if (!dx && !dy) return
    e.preventDefault()
    const w = 'w' in r ? r.w : 0, h = 'h' in r ? r.h : 0
    commit(setRect(doc, sel, { ...r, x: clamp(r.x + dx, 0, doc.width - w), y: clamp(r.y + dy, 0, doc.height - h) }))
  }

  // ---- edits from the side panel ----
  function removeSel() {
    if (!doc || !sel) return
    if (sel.kind === 'room') commit({ ...doc, rooms: { ...doc.rooms, [sel.id]: null } })
    else if (sel.kind === 'wall') commit({ ...doc, walls: doc.walls.filter((_, i) => i !== sel.i) })
    else commit({ ...doc, labels: doc.labels.filter((_, i) => i !== sel.i) })
    setSel(null)
  }
  function addWall() {
    if (!doc) return
    const spot = freeSpot(doc, 200, 60)
    commit({ ...doc, walls: [...doc.walls, spot] })
    setSel({ kind: 'wall', i: doc.walls.length })
  }
  function addLabel() {
    if (!doc) return
    commit({ ...doc, labels: [...doc.labels, { x: snap(doc.width / 2), y: snap(doc.height / 2), text: 'تسمية' }] })
    setSel({ kind: 'label', i: doc.labels.length })
  }
  function placeRoom(room: Room) {
    if (!doc) return
    const spot = freeSpot(doc, 160, 120)
    commit({ ...doc, rooms: { ...doc.rooms, [room.id]: spot } })
    setSel({ kind: 'room', id: room.id })
  }
  function resize(k: 'width' | 'height', v: number) {
    if (!doc) return
    const size = clamp(Math.round(v), 200, 5000)
    commit({ ...doc, [k]: size })
  }
  async function save() {
    if (!doc || !base || !settings) return
    try {
      const ops: Promise<unknown>[] = []
      for (const room of view.rooms) {
        const next = doc.rooms[room.id] ?? null
        if (!same(next, room.plan)) ops.push(store.upsertRoom({ id: room.id, name: room.name, plan: next }))
      }
      const plan: Plan = { width: doc.width, height: doc.height, walls: doc.walls, labels: doc.labels }
      if (!same(plan, settings.plan)) ops.push(store.patchSettings({ plan }, 'تعديل المخطط'))
      await Promise.all(ops)
      setBase(doc)
      setUndo([]); setRedo([])
      toast.show(sync.online ? 'تم حفظ المخطط' : 'حُفظ المخطط على الجهاز — سيُرسَل عند الاتصال', 'ok')
    } catch (err) { toast.show(describeError(err), 'error') }
  }

  const roomsById = useMemo(() => new Map(view.rooms.map((r) => [r.id, r])), [view.rooms])
  if (!ready) return <div className="center center-pad"><Spinner /></div>
  if (!settings || !doc) return <Empty title="المخطط غير متاح بعد" hint="يحتاج أول اتصال بالإنترنت لتحميل الإعدادات." />

  const unplaced = view.rooms.filter((r) => !doc.rooms[r.id])
  const W = doc.width, H = doc.height
  const fs = Math.max(10, Math.min(W, H) / 40)    // font size in plan units
  const hs = Math.max(6, Math.min(W, H) / 70)     // handle size
  const selRect = sel ? rectOf(doc, sel) : null

  return (
    <>
      <PageHead title="المخطط" sub="اسحب للتحريك، المقابض للتحجيم، الأسهم للتعديل الدقيق">
        <Button variant="ghost" size="sm" disabled={undo.length === 0} onClick={doUndo}>تراجع</Button>
        <Button variant="ghost" size="sm" disabled={redo.length === 0} onClick={doRedo}>إعادة</Button>
        <Button onClick={save} disabled={!dirty}><Icon name="check" size={18} /> حفظ</Button>
      </PageHead>

      <div className="pe">
        <div>
          <div className="pe-toolbar">
            <Button size="sm" variant="soft" onClick={addWall}><Icon name="plus" size={16} /> حائط / ممر</Button>
            <Button size="sm" variant="soft" onClick={addLabel}><Icon name="plus" size={16} /> تسمية</Button>
            <span className="sep" />
            {sel && <Button size="sm" variant="danger" onClick={removeSel}><Icon name="trash" size={16} /> {sel.kind === 'room' ? 'إزالة من المخطط' : 'حذف'}</Button>}
            {dirty && <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>إلغاء التغييرات</Button>}
          </div>
          <div className="pe-canvas">
            <svg ref={svgRef} className="pe-svg" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: `${W} / ${H}` }} tabIndex={0}
              onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKey}
              onPointerDown={() => setSel(null)} role="application" aria-label="محرر المخطط">
              <defs>
                <pattern id="pe-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" className="gridline" strokeWidth={1} />
                </pattern>
              </defs>
              <rect x={0} y={0} width={W} height={H} className="floor" />
              <rect x={0} y={0} width={W} height={H} fill="url(#pe-grid)" pointerEvents="none" />
              {doc.walls.map((w, i) => (
                <rect key={`w${i}`} x={w.x} y={w.y} width={w.w} height={w.h} rx={4} className={cx('wall', sel?.kind === 'wall' && sel.i === i && 'is-selected')}
                  onPointerDown={(e) => startDrag(e, { kind: 'wall', i }, 'move')} />
              ))}
              {Object.entries(doc.rooms).map(([idStr, r]) => {
                if (!r) return null
                const id = Number(idStr), room = roomsById.get(id)
                if (!room) return null
                const selected = sel?.kind === 'room' && sel.id === id
                return (
                  <g key={id} onPointerDown={(e) => startDrag(e, { kind: 'room', id }, 'move')}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} className={cx('room', !room.active && 'is-inactive')} style={room.color ? { stroke: room.color } : undefined} />
                    <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (r.h > fs * 3 ? fs * 0.5 : 0)} fontSize={fs} textAnchor="middle" dominantBaseline="central" className="room-text">{room.name}</text>
                    {r.h > fs * 3 && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fs * 0.9} fontSize={fs * 0.75} textAnchor="middle" dominantBaseline="central" className="room-cap">{room.capacity} أشخاص</text>}
                    {selected && <rect x={r.x - 2} y={r.y - 2} width={r.w + 4} height={r.h + 4} rx={7} className="sel" />}
                  </g>
                )
              })}
              {doc.labels.map((l, i) => (
                <text key={`l${i}`} x={l.x} y={l.y} fontSize={fs * 0.85} textAnchor="middle" dominantBaseline="central" className={cx('label', sel?.kind === 'label' && sel.i === i && 'is-selected')}
                  onPointerDown={(e) => startDrag(e, { kind: 'label', i }, 'move')}>{l.text}</text>
              ))}
              {sel && sel.kind !== 'label' && selRect && 'w' in selRect && (
                <Handles r={selRect} size={hs} onStart={(e, h) => startDrag(e, sel, h)} />
              )}
            </svg>
          </div>
          <p className="pe-hint mt-sm">الشبكة 20 وحدة · الأبعاد الحالية {W} × {H} · Delete يحذف العنصر المحدد · Ctrl+Z تراجع</p>
        </div>

        <div className="stack">
          {sel && selRect && (
            <Card className="pe-props">
              <div className="card-title">{sel.kind === 'room' ? roomsById.get(sel.id)?.name : sel.kind === 'wall' ? 'حائط / ممر' : 'تسمية'}</div>
              {sel.kind === 'label' && (
                <Field label="النص"><Input value={(selRect as Label).text} maxLength={40} onChange={(e) => commit(setRect(doc, sel, { ...(selRect as Label), text: e.target.value }))} /></Field>
              )}
              <div className="pe-size">
                <Field label="X"><Input type="number" dir="ltr" value={selRect.x} onChange={(e) => commit(setRect(doc, sel, { ...selRect, x: clamp(Number(e.target.value) || 0, 0, W) }))} /></Field>
                <Field label="Y"><Input type="number" dir="ltr" value={selRect.y} onChange={(e) => commit(setRect(doc, sel, { ...selRect, y: clamp(Number(e.target.value) || 0, 0, H) }))} /></Field>
                {'w' in selRect && (
                  <>
                    <Field label="العرض"><Input type="number" dir="ltr" value={selRect.w} onChange={(e) => commit(setRect(doc, sel, { ...selRect, w: clamp(Number(e.target.value) || MIN_SIZE, MIN_SIZE, W) }))} /></Field>
                    <Field label="الارتفاع"><Input type="number" dir="ltr" value={selRect.h} onChange={(e) => commit(setRect(doc, sel, { ...selRect, h: clamp(Number(e.target.value) || MIN_SIZE, MIN_SIZE, H) }))} /></Field>
                  </>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="card-title">قاعات غير موضوعة ({unplaced.length})</div>
            {unplaced.length === 0 ? <p className="muted small">كل القاعات على المخطط.</p> : (
              <div className="pe-list">
                {unplaced.map((r) => (
                  <div key={r.id} className="pe-list-item">
                    <span className="row gap-sm"><span className="dot" style={{ background: r.color ?? '#7b1e2e' }} />{r.name}</span>
                    <Button size="sm" variant="soft" onClick={() => placeRoom(r)}>ضع على المخطط</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="card-title">حجم المخطط</div>
            <div className="pe-size">
              <Field label="العرض" hint="200 – 5000"><Input type="number" dir="ltr" min={200} max={5000} step={GRID} value={W} onChange={(e) => resize('width', Number(e.target.value))} /></Field>
              <Field label="الارتفاع"><Input type="number" dir="ltr" min={200} max={5000} step={GRID} value={H} onChange={(e) => resize('height', Number(e.target.value))} /></Field>
            </div>
          </Card>
        </div>
      </div>

      <Confirm open={confirmReset} title="إلغاء التغييرات؟" danger confirmLabel="نعم، تجاهل" body="سيعود المخطط إلى آخر نسخة محفوظة."
        onClose={() => setConfirmReset(false)} onConfirm={() => { if (base) { setDoc(base); setUndo([]); setRedo([]); setSel(null) } setConfirmReset(false) }} />
    </>
  )
}

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
function Handles({ r, size, onStart }: { r: PlanRect; size: number; onStart: (e: RPointerEvent, h: Handle) => void }) {
  const cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2
  const at: Record<Handle, [number, number]> = {
    nw: [r.x, r.y], n: [cx0, r.y], ne: [r.x + r.w, r.y], e: [r.x + r.w, cy0], se: [r.x + r.w, r.y + r.h], s: [cx0, r.y + r.h], sw: [r.x, r.y + r.h], w: [r.x, cy0],
  }
  const cursor: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
  return (
    <>
      {HANDLES.map((h) => (
        <rect key={h} x={at[h][0] - size / 2} y={at[h][1] - size / 2} width={size} height={size} rx={2} className="handle" style={{ cursor: cursor[h] }}
          onPointerDown={(e) => onStart(e, h)} />
      ))}
    </>
  )
}
