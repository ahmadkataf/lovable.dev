// Tapping a room: its photos (when it has some), what is inside, the price for the chosen range, and the one button
// that matters.
import { useNavigate } from 'react-router-dom'
import type { PublicSettings, Room } from '@shared/types'
import { Badge, Button, Icon, Sheet } from '../ui'
import { dayLabel, durationLabel, fmtClock } from '../format'
import { fmtMoney } from '@shared/pricing'
import { contentsList, isValidPick, KIND_LABEL, priceFor, pricing, ROOM_TYPE, peopleLabel, roomPhotos, type Pick } from '../lib/booking'
import { RoomPhotos } from './RoomPhotos'

export function RoomSheet({ room, pick, mode = 'hourly', seatsFree, busy, offline, settings, onClose }: {
  room: Room | null; pick: Pick | null; mode?: 'hourly' | 'week' | 'month'; seatsFree?: number
  busy: boolean; offline: boolean; settings: PublicSettings | undefined; onClose: () => void
}) {
  const navigate = useNavigate()
  const open = !!room
  if (!room) return <Sheet open={false} onClose={onClose}><span /></Sheet>
  const items = contentsList(room.contents)
  const sub = mode !== 'hourly'
  const validSlot = !!pick && !!settings && (sub ? true : isValidPick(settings, pick))
  const p = pricing(settings)
  const desk = room.type === 'desk', hall = room.type === 'meeting' || room.type === 'hall'
  const canBook = validSlot && !busy && !offline
  return (
    <Sheet open={open} onClose={onClose} title={room.name}>
      <RoomPhotos key={room.id} photos={roomPhotos(room)} />
      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        <Badge tone="wine">{ROOM_TYPE[room.type]}</Badge>
        <span className="muted small row gap-sm"><Icon name="people" size={16} /> حتى {peopleLabel(room.capacity)}</span>
        {busy && <Badge tone="grey">{desk ? 'ممتلئة بهذا الوقت' : 'محجوزة بهذا الوقت'}</Badge>}
        {!busy && desk && !sub && seatsFree !== undefined && <Badge tone="green">باقي {seatsFree} {seatsFree === 1 ? 'مقعد' : 'مقاعد'}</Badge>}
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
          {sub ? <><dt>النوع</dt><dd>{KIND_LABEL[mode]}</dd><dt>يبدأ</dt><dd>{dayLabel(pick.date)}</dd></>
            : <><dt>الوقت</dt><dd>{dayLabel(pick.date)} · {fmtClock(pick.time)}</dd><dt>المدة</dt><dd>{durationLabel(pick.minutes)}</dd></>}
        </dl>
      )}
      {sub ? (
        <div className="price-line"><span className="muted">السعر</span><b>{fmtMoney(mode === 'week' ? p.sub_week_price : p.sub_month_price)}</b></div>
      ) : hall ? (
        <div className="price-tiers" style={{ marginTop: 8 }}>
          <span>الجهات الخاصة والمنظمات: <b className="money">{fmtMoney(p.hall_org_usd_hour, 'USD')}</b> بالساعة</span>
          <span>الجهات الحكومية: <b className="money">{fmtMoney(p.hall_gov_hour)}</b> بالساعة</span>
          <span className="muted tiny">الكورسات الشخصية: {p.course_share_percent}% من قيمة الكورس بالاتفاق مع المركز</span>
          <span className="muted tiny">بتختار الجهة بالخطوة الجاية.</span>
        </div>
      ) : desk ? (
        <>
          <div className="price-line"><span className="muted">للشخص {pick ? `(${durationLabel(pick.minutes)})` : 'بالساعة'}</span>
            <b>{fmtMoney(pick ? Math.round((pick.minutes / 60) * room.price_hour) : room.price_hour)}</b></div>
          <p className="muted tiny" style={{ marginTop: 4 }}>{fmtMoney(room.price_hour)} للشخص بالساعة · بتختار عدد المقاعد بالخطوة الجاية.</p>
        </>
      ) : (
        <>
          <div className="price-line">
            <span className="muted">{pick ? 'السعر' : 'السعر بالساعة'}</span>
            <b>{fmtMoney(pick ? priceFor(room, pick.minutes) : room.price_hour)}</b>
          </div>
          {room.price_day ? <p className="muted tiny" style={{ marginTop: 4 }}>اليوم الكامل: {fmtMoney(room.price_day)}</p> : null}
        </>
      )}
      {offline && <div className="alert alert-info mt">الحجز يحتاج اتصالاً بالإنترنت. اطّلع على الغرف الآن واحجز عند عودة الاتصال.</div>}
      {busy && !offline && <div className="alert alert-info mt">{desk ? 'كل المقاعد محجوزة بالوقت المختار — غيّر الوقت.' : 'هذه الغرفة محجوزة بالوقت المختار — غيّر الوقت أو اختر غرفة ثانية.'}</div>}
      {!validSlot && !offline && <div className="alert alert-info mt">هذا الوقت لم يعد متاحاً — اختر يوماً أو وقتاً آخر.</div>}
      <Button
        block size="lg" className="mt" disabled={!canBook}
        onClick={() => pick && navigate(sub ? `/book/${room.id}?kind=${mode}&date=${pick.date}` : `/book/${room.id}?date=${pick.date}&start=${pick.time}&minutes=${pick.minutes}`)}
      >
        {sub ? 'اشترك' : desk ? 'احجز مقعدك' : hall ? 'احجز القاعة' : 'احجز هالغرفة'}
      </Button>
    </Sheet>
  )
}
