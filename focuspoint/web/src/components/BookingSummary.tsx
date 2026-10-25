// The compact "what you are booking" card used on the booking form and the booking page.
import type { Room } from '@shared/types'
import { Icon } from '../ui'
import { dayLabel, durationLabel, fmtRange, fmtSYP, toLocalParts } from '../format'
import { ROOM_ICON, ROOM_TYPE, peopleLabel } from '../lib/booking'

export function BookingSummary({ room, roomName, start, end, minutes, people, price, code }: {
  room?: Room | null; roomName?: string; start: string; end: string; minutes: number; people?: number | null; price: number; code?: string
}) {
  return (
    <div>
      <div className="summary-head">
        <span className="room-swatch"><Icon name={room ? ROOM_ICON[room.type] : 'door'} size={22} /></span>
        <div className="grow">
          <div className="room-name">{room?.name || roomName || 'غرفة'}</div>
          {room && <div className="muted small">{ROOM_TYPE[room.type]} · حتى {peopleLabel(room.capacity)}</div>}
        </div>
      </div>
      <dl className="kv">
        <dt>اليوم</dt><dd>{dayLabel(toLocalParts(start).date)}</dd>
        <dt>الوقت</dt><dd>{fmtRange(start, end)}</dd>
        <dt>المدة</dt><dd>{durationLabel(minutes)}</dd>
        {people ? <><dt>الأشخاص</dt><dd>{peopleLabel(people)}</dd></> : null}
        {code ? <><dt>رمز الحجز</dt><dd className="num" style={{ letterSpacing: '0.12em' }}>{code}</dd></> : null}
      </dl>
      <div className="price-line"><span className="muted">السعر</span><b>{fmtSYP(price)}</b></div>
    </div>
  )
}
