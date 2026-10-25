// Tapping a room: what is inside, the price for the chosen range, and the one button that matters.
import { useNavigate } from 'react-router-dom'
import type { PublicSettings, Room } from '@shared/types'
import { Badge, Button, Icon, Sheet } from '../ui'
import { dayLabel, durationLabel, fmtClock, fmtSYP } from '../format'
import { contentsList, isValidPick, priceFor, ROOM_TYPE, peopleLabel, type Pick } from '../lib/booking'

export function RoomSheet({ room, pick, busy, offline, settings, onClose }: {
  room: Room | null; pick: Pick | null; busy: boolean; offline: boolean; settings: PublicSettings | undefined; onClose: () => void
}) {
  const navigate = useNavigate()
  const open = !!room
  if (!room) return <Sheet open={false} onClose={onClose}><span /></Sheet>
  const items = contentsList(room.contents)
  const validSlot = !!pick && !!settings && isValidPick(settings, pick)
  const canBook = validSlot && !busy && !offline
  return (
    <Sheet open={open} onClose={onClose} title={room.name}>
      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        <Badge tone="wine">{ROOM_TYPE[room.type]}</Badge>
        <span className="muted small row gap-sm"><Icon name="people" size={16} /> حتى {peopleLabel(room.capacity)}</span>
        {busy && <Badge tone="grey">محجوزة بهذا الوقت</Badge>}
      </div>
      {room.description && <p className="muted small" style={{ marginBottom: 12 }}>{room.description}</p>}
      {items.length > 0 && (
        <div className="contents" style={{ marginBottom: 14 }}>
          {items.map((it) => <span key={it.label} className="contents-item"><Icon name={it.icon} size={16} />{it.label}</span>)}
          {room.contents.notes && <span className="contents-item">{room.contents.notes}</span>}
        </div>
      )}
      {pick && (
        <dl className="kv" style={{ marginBottom: 4 }}>
          <dt>الوقت</dt><dd>{dayLabel(pick.date)} · {fmtClock(pick.time)}</dd>
          <dt>المدة</dt><dd>{durationLabel(pick.minutes)}</dd>
        </dl>
      )}
      <div className="price-line">
        <span className="muted">{pick ? 'السعر' : 'السعر بالساعة'}</span>
        <b>{fmtSYP(pick ? priceFor(room, pick.minutes) : room.price_hour)}</b>
      </div>
      {room.price_day && <p className="muted tiny" style={{ marginTop: 4 }}>اليوم الكامل: {fmtSYP(room.price_day)}</p>}
      {offline && <div className="alert alert-info mt">الحجز يحتاج اتصالاً بالإنترنت. اطّلع على الغرف الآن واحجز عند عودة الاتصال.</div>}
      {busy && !offline && <div className="alert alert-info mt">هذه الغرفة محجوزة بالوقت المختار — غيّر الوقت أو اختر غرفة ثانية.</div>}
      {!validSlot && !offline && <div className="alert alert-info mt">هذا الوقت لم يعد متاحاً — اختر يوماً أو وقتاً آخر.</div>}
      <Button
        block size="lg" className="mt" disabled={!canBook}
        onClick={() => pick && navigate(`/book/${room.id}?date=${pick.date}&start=${pick.time}&minutes=${pick.minutes}`)}
      >
        احجز هالغرفة
      </Button>
    </Sheet>
  )
}
