// The compact "what you are booking" card used on the booking form and the booking page.
import type { BookingKind, Currency, Room } from '@shared/types'
import { fmtMoney } from '@shared/pricing'
import { dayLabel, durationLabel, fmtRange, toLocalParts } from '../format'
import { KIND_LABEL, ROOM_TYPE, peopleLabel } from '../lib/booking'
import { RoomSwatch } from './RoomPhotos'

export function BookingSummary({ room, roomName, start, end, minutes, people, seats, kind = 'hourly', price, currency = 'SYP', priceHint, code, thumb = false }: {
  room?: Room | null; roomName?: string; start: string; end: string; minutes: number; people?: number | null
  seats?: number; kind?: BookingKind
  price: number | null; currency?: Currency
  /** Shown in place of the price while it cannot be computed yet (e.g. the training hall before the group is chosen). */
  priceHint?: string
  code?: string
  /** Show the room's first photo in place of its icon (when it has photos). */
  thumb?: boolean
}) {
  const sub = kind !== 'hourly'
  return (
    <div>
      <div className="summary-head">
        <RoomSwatch room={room} photo={thumb} />
        <div className="grow">
          <div className="room-name">{room?.name || roomName || 'غرفة'}</div>
          {room && <div className="muted small">{ROOM_TYPE[room.type]} · حتى {peopleLabel(room.capacity)}</div>}
        </div>
      </div>
      <dl className="kv">
        {sub ? (
          <>
            <dt>النوع</dt><dd>{KIND_LABEL[kind]}</dd>
            <dt>من</dt><dd>{dayLabel(toLocalParts(start).date)}</dd>
            <dt>إلى</dt><dd>{dayLabel(toLocalParts(end).date)}</dd>
            <dt>الوقت</dt><dd>كل يوم طول الدوام</dd>
          </>
        ) : (
          <>
            <dt>اليوم</dt><dd>{dayLabel(toLocalParts(start).date)}</dd>
            <dt>الوقت</dt><dd>{fmtRange(start, end)}</dd>
            <dt>المدة</dt><dd>{durationLabel(minutes)}</dd>
          </>
        )}
        {seats ? <><dt>المقاعد</dt><dd>{seats === 1 ? 'مقعد واحد' : seats === 2 ? 'مقعدين' : `${seats} مقاعد`}</dd></>
          : people ? <><dt>الأشخاص</dt><dd>{peopleLabel(people)}</dd></> : null}
        {code ? <><dt>رمز الحجز</dt><dd className="num" style={{ letterSpacing: '0.12em' }}>{code}</dd></> : null}
      </dl>
      <div className="price-line"><span className="muted">السعر</span>{price !== null ? <b>{fmtMoney(price, currency)}</b> : <span className="muted small">{priceHint || '—'}</span>}</div>
    </div>
  )
}
