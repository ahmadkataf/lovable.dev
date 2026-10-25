// /team/rooms — القاعات: cards, and (admin) a create/edit sheet with contents, prices, colour, active + delete.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Room, RoomContents, RoomType } from '@shared/types'
import { api, ApiError } from '../api'
import { fmtSYP } from '../format'
import { useTeam } from '../team'
import { Badge, Button, Card, Empty, Field, Icon, Input, Select, Sheet, Spinner, Stepper, Textarea, Toggle, useToast } from '../ui'
import { Confirm, PageHead } from './common'
import { store, useStore } from './store'
import { capacityLabel, contentsList, cx, describeError, isTemp, parseInt10, ROOM_TYPE, ROOM_TYPES } from './util'

const SWATCHES = ['#7b1e2e', '#6b7280', '#2f7d4f', '#1f5f8b', '#b26a1b', '#5b4a9b', '#2a7f7a', '#402127']

export function Rooms() {
  const { ready, view } = useStore()
  const { isAdmin } = useTeam()
  const [editing, setEditing] = useState<Room | 'new' | null>(null)
  const rooms = [...view.rooms].sort((a, b) => (a.active === b.active ? a.sort - b.sort || a.id - b.id : b.active - a.active))

  if (!ready) return <div className="center center-pad"><Spinner /></div>

  return (
    <>
      <PageHead title="القاعات" sub={`${rooms.filter((r) => r.active).length} فعّالة`}>
        {isAdmin && (
          <>
            <Link to="/team/plan" className="btn btn-soft btn-md"><Icon name="grid" size={18} /> المخطط</Link>
            <Button onClick={() => setEditing('new')}><Icon name="plus" size={18} /> قاعة</Button>
          </>
        )}
      </PageHead>
      {rooms.length === 0 ? (
        <Empty title="لا توجد قاعات بعد" hint={isAdmin ? 'أضف أول قاعة: اسمها، سعتها، محتوياتها وسعرها.' : 'سيضيف المدير القاعات.'} action={isAdmin ? <Button onClick={() => setEditing('new')}>إضافة قاعة</Button> : undefined} />
      ) : (
        <div className="room-grid">
          {rooms.map((room) => (
            <Card key={room.id} className={cx('rcard', !room.active && 'is-inactive')} padded>
              <button type="button" className="rcard" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => isAdmin && setEditing(room)} disabled={!isAdmin}>
                <div className="rcard-top">
                  <span className="rcard-swatch" style={{ background: room.color ?? '#7b1e2e' }} />
                  <div className="grow">
                    <div className="rcard-name">{room.name}</div>
                    <div className="rcard-type">{ROOM_TYPE[room.type]} · {capacityLabel(room.capacity)}</div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                    {!room.active && <Badge tone="grey">معطّلة</Badge>}
                    {isTemp(room.id) && <Badge tone="gold">بانتظار الإرسال</Badge>}
                    {room.active && !room.plan && <Badge tone="gold">ليست على المخطط</Badge>}
                  </div>
                </div>
                <div className="rcard-meta">
                  <span className="rcard-price">{fmtSYP(room.price_hour)} / ساعة</span>
                  {room.price_day !== null && <span>{fmtSYP(room.price_day)} / يوم</span>}
                </div>
                <div className="rcard-icons" aria-label="المحتويات">
                  {contentsList(room.contents).map((c) => <span key={c.icon} title={c.label}><Icon name={c.icon} size={18} /></span>)}
                </div>
              </button>
            </Card>
          ))}
        </div>
      )}
      <RoomSheet room={editing} onClose={() => setEditing(null)} />
    </>
  )
}

interface Draft {
  name: string; type: RoomType; capacity: number; contents: RoomContents; price_hour: string; price_day: string
  color: string; active: boolean; description: string
}
const blank = (): Draft => ({ name: '', type: 'private', capacity: 4, contents: { chairs: 4, tables: 1, wifi: true, ac: true }, price_hour: '', price_day: '', color: SWATCHES[0], active: true, description: '' })
const fromRoom = (r: Room): Draft => ({
  name: r.name, type: r.type, capacity: r.capacity, contents: { ...r.contents }, price_hour: String(r.price_hour),
  price_day: r.price_day === null ? '' : String(r.price_day), color: r.color ?? SWATCHES[0], active: r.active === 1, description: r.description ?? '',
})

const FLAGS: { key: keyof RoomContents; label: string }[] = [
  { key: 'wifi', label: 'إنترنت' }, { key: 'ac', label: 'تكييف' }, { key: 'screen', label: 'شاشة' },
  { key: 'whiteboard', label: 'لوح أبيض' }, { key: 'projector', label: 'بروجكتر' }, { key: 'coffee', label: 'قهوة' },
]

function RoomSheet({ room, onClose }: { room: Room | 'new' | null; onClose: () => void }) {
  const toast = useToast()
  const { sync } = useStore()
  const [d, setD] = useState<Draft>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => { setD(room && room !== 'new' ? fromRoom(room) : blank()); setErrors({}) }, [room])
  const existing = room && room !== 'new' ? room : null
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  async function save() {
    const e: Record<string, string> = {}
    const name = d.name.trim()
    const ph = parseInt10(d.price_hour), pd = d.price_day.trim() ? parseInt10(d.price_day) : null
    if (name.length < 1 || name.length > 60) e.name = 'اكتب اسم القاعة'
    if (ph === null) e.price_hour = 'أدخل سعر الساعة'
    if (d.price_day.trim() && pd === null) e.price_day = 'سعر اليوم غير صحيح'
    setErrors(e)
    if (Object.keys(e).length) return
    const contents: RoomContents = { chairs: d.contents.chairs, tables: d.contents.tables }
    for (const f of FLAGS) if (d.contents[f.key]) contents[f.key as Exclude<keyof RoomContents, 'chairs' | 'tables' | 'notes'>] = true
    if (d.contents.notes?.trim()) contents.notes = d.contents.notes.trim()
    const patch: Partial<Room> & { id?: number } = {
      name, type: d.type, capacity: d.capacity, contents, price_hour: ph!, price_day: pd, color: d.color, active: d.active ? 1 : 0,
      description: d.description.trim() || null,
    }
    if (existing) patch.id = existing.id
    else { patch.plan = null; patch.sort = 0 }
    try {
      await store.upsertRoom(patch)
      toast.show(existing ? 'تم حفظ القاعة' : 'تمت إضافة القاعة', 'ok')
      onClose()
    } catch (err) { toast.show(describeError(err), 'error') }
  }

  async function remove() {
    if (!existing) return
    setDeleting(true)
    try {
      const res = await api.del<{ ok: true; outcome?: 'deleted' | 'deactivated' }>(`/v1/admin/rooms/${existing.id}`)
      toast.show(res.outcome === 'deactivated' ? 'للقاعة حجوزات سابقة، لذلك عُطّلت بدلاً من حذفها' : 'تم حذف القاعة', 'ok')
      setConfirmDelete(false)
      onClose()
      void store.refetch()   // full pull so the deletion shows up everywhere
    } catch (err) {
      toast.show(err instanceof ApiError && err.offline ? 'الحذف يحتاج اتصالاً بالإنترنت — يمكنك تعطيل القاعة الآن' : describeError(err), 'error')
    } finally { setDeleting(false) }
  }

  return (
    <Sheet open={room !== null} onClose={onClose} title={existing ? `تعديل ${existing.name}` : 'قاعة جديدة'}>
      <Field label="الاسم" error={errors.name}><Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="مثال: قاعة الاجتماعات الكبيرة" /></Field>
      <div className="two">
        <Field label="النوع">
          <Select value={d.type} onChange={(e) => set('type', e.target.value as RoomType)}>
            {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_TYPE[t]}</option>)}
          </Select>
        </Field>
        <Field label="السعة (أشخاص)"><Stepper value={d.capacity} min={1} max={500} onChange={(v) => set('capacity', v)} /></Field>
      </div>
      <div className="two">
        <Field label="سعر الساعة (ل.س)" error={errors.price_hour}><Input dir="ltr" inputMode="numeric" value={d.price_hour} onChange={(e) => set('price_hour', e.target.value)} /></Field>
        <Field label="سعر اليوم (اختياري)" error={errors.price_day} hint="يُطبّق من 8 ساعات"><Input dir="ltr" inputMode="numeric" value={d.price_day} onChange={(e) => set('price_day', e.target.value)} /></Field>
      </div>
      <Card className="mt" padded>
        <div className="card-title">المحتويات</div>
        <div className="stepper-row"><span className="row gap-sm"><Icon name="chair" size={18} /> كراسي</span><Stepper value={d.contents.chairs} min={0} max={500} onChange={(v) => set('contents', { ...d.contents, chairs: v })} /></div>
        <div className="stepper-row"><span className="row gap-sm"><Icon name="table" size={18} /> طاولات</span><Stepper value={d.contents.tables} min={0} max={100} onChange={(v) => set('contents', { ...d.contents, tables: v })} /></div>
        <div className="toggles mt-sm">
          {FLAGS.map((f) => <Toggle key={f.key} label={f.label} checked={!!d.contents[f.key]} onChange={(v) => set('contents', { ...d.contents, [f.key]: v })} />)}
        </div>
        <Field label="ملاحظات المحتويات (اختياري)"><Input value={d.contents.notes ?? ''} onChange={(e) => set('contents', { ...d.contents, notes: e.target.value })} /></Field>
      </Card>
      <Field label="اللون على المخطط">
        <div className="swatches">
          {SWATCHES.map((c) => <button key={c} type="button" className={cx('swatch', d.color === c && 'is-active')} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />)}
          <input type="color" className="swatch-input" value={d.color} onChange={(e) => set('color', e.target.value)} aria-label="لون مخصص" />
        </div>
      </Field>
      <Field label="وصف قصير للزبائن (اختياري)"><Textarea rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
      <div className="mt"><Toggle label="القاعة فعّالة (تظهر للزبائن ويمكن حجزها)" checked={d.active} onChange={(v) => set('active', v)} /></div>

      {existing && !isTemp(existing.id) && (
        <div className="mt">
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} disabled={!sync.online}><Icon name="trash" size={16} /> حذف القاعة</Button>
          <p className="muted tiny" style={{ marginTop: 4 }}>الحذف يحتاج اتصالاً. إذا كانت للقاعة حجوزات سابقة تُعطَّل بدلاً من حذفها حفاظاً على السجل.</p>
        </div>
      )}
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={save}>{existing ? 'حفظ' : 'إضافة القاعة'}</Button>
      </div>
      <Confirm open={confirmDelete} title="حذف القاعة؟" danger confirmLabel="حذف" loading={deleting}
        body={<>ستُحذف <b>{existing?.name}</b> نهائياً إن لم يكن لها أي حجز، وإلا فستُعطَّل فقط.</>}
        onClose={() => setConfirmDelete(false)} onConfirm={remove} />
    </Sheet>
  )
}
