// /team/bookings — الحجوزات: a day grid (rooms × hours) and a filterable list; tap anything for the booking sheet.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Booking, BookingStatus } from '@shared/types'
import { addDays, dayLabel, fmtRange, fmtSYP, fmtTime, normalisePhone, statusLabel, todayLocal, toLocalParts } from '../format'
import { Badge, Button, Card, Empty, Icon, Input, Segmented, Select, Spinner } from '../ui'
import { BookingSheet } from './BookingSheet'
import { ManualBookingSheet, type ManualPreset } from './ManualBookingSheet'
import { PageHead, roomColor } from './common'
import { useRooms, useStore } from './store'
import { isLive, localDate, sortByStart, STATUSES, toHHMM, toMin } from './util'

type ViewMode = 'day' | 'list'

export function Bookings() {
  const { ready, view } = useStore()
  const rooms = useRooms()
  const [mode, setMode] = useState<ViewMode>('day')
  const [date, setDate] = useState(todayLocal())
  const [selected, setSelected] = useState<Booking | null>(null)
  const [manual, setManual] = useState<ManualPreset | null>(null)
  const current = selected ? view.bookings.find((b) => b.id === selected.id) ?? null : null

  if (!ready) return <div className="center center-pad"><Spinner /></div>

  return (
    <>
      <PageHead title="الحجوزات">
        <Segmented<ViewMode> options={[{ value: 'day', label: 'اليوم' }, { value: 'list', label: 'قائمة' }]} value={mode} onChange={setMode} />
        <Button onClick={() => setManual({ date })}><Icon name="plus" size={18} /> حجز</Button>
      </PageHead>

      {mode === 'day' ? (
        <>
          <DateNav date={date} onChange={setDate} />
          {rooms.length === 0 ? <Empty title="لا توجد قاعات" hint="أضف القاعات من قسم القاعات." /> : (
            <DayGrid date={date} onPick={setSelected} onEmpty={(room_id, time) => setManual({ room_id, date, time })} />
          )}
        </>
      ) : (
        <ListView onPick={setSelected} />
      )}

      <BookingSheet booking={current} onClose={() => setSelected(null)} />
      <ManualBookingSheet open={!!manual} onClose={() => setManual(null)} preset={manual ?? undefined} />
    </>
  )
}

function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <div className="row between gap mb wrap">
      <div className="datenav">
        <button type="button" className="icon-btn" onClick={() => onChange(addDays(date, -1))} aria-label="اليوم السابق"><Icon name="back" style={{ transform: 'scaleX(-1)' }} /></button>
        <Input type="date" dir="ltr" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="التاريخ" />
        <button type="button" className="icon-btn" onClick={() => onChange(addDays(date, 1))} aria-label="اليوم التالي"><Icon name="back" /></button>
      </div>
      <div className="row gap">
        <span className="datenav label">{dayLabel(date)}</span>
        {date !== todayLocal() && <Button size="sm" variant="ghost" onClick={() => onChange(todayLocal())}>اليوم</Button>}
      </div>
    </div>
  )
}

/** Rooms × hours grid for one day. Blocks are positioned by minutes from opening; empty cells open a prefilled walk-in. */
function DayGrid({ date, onPick, onEmpty }: { date: string; onPick: (b: Booking) => void; onEmpty: (roomId: number, time: string) => void }) {
  const { view } = useStore()
  const rooms = useRooms()
  const s = view.settings
  const open = toMin(s?.open ?? '09:00'), close = toMin(s?.close ?? '23:00')
  const hours = Math.max(1, Math.ceil((close - open) / 60))
  // Hour columns fill the available width on desktop (min 64px each → horizontal scroll on phones).
  const wrapRef = useRef<HTMLDivElement>(null)
  const [HOUR_W, setHourW] = useState(72)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const roomW = window.innerWidth < 640 ? 92 : 128
      setHourW(Math.max(64, Math.min(120, Math.floor((el.clientWidth - roomW - 2) / hours))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hours])
  const dayBookings = useMemo(() => view.bookings.filter((b) => localDate(b.start) === date && (isLive(b.status) || b.status === 'completed')), [view.bookings, date])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t) }, [])
  const nowParts = toLocalParts(new Date(now).toISOString())
  const nowX = nowParts.date === date ? ((toMin(nowParts.time) - open) / 60) * HOUR_W : null
  const pos = (iso: string) => ((toMin(toLocalParts(iso).time) - open) / 60) * HOUR_W

  return (
    <div className="grid-wrap" ref={wrapRef}>
      <div className="grid" style={{ gridTemplateColumns: `var(--room-w) ${hours * HOUR_W}px`, ['--hour-w' as string]: `${HOUR_W}px` }}>
        <div className="grid-corner" />
        <div className="grid-hours" style={{ gridTemplateColumns: `repeat(${hours}, ${HOUR_W}px)` }}>
          {Array.from({ length: hours }, (_, i) => <div key={i} className="grid-hour">{toHHMM(open + i * 60)}</div>)}
        </div>
        {rooms.map((room) => (
          <RoomRow key={room.id} name={room.name} color={roomColor(room.color)} hours={hours} hourW={HOUR_W} nowX={nowX}
            onEmpty={(i) => onEmpty(room.id, toHHMM(open + i * 60))}>
            {dayBookings.filter((b) => b.room_id === room.id).map((b) => {
              const left = pos(b.start), width = Math.max(HOUR_W / 4, pos(b.end) - left)
              const hold = b.status !== 'confirmed' && b.status !== 'completed'
              return (
                <button key={b.id} type="button" className={`grid-block${hold ? ' is-hold' : ''}${b.status === 'completed' ? ' is-dim' : ''}`}
                  style={{ insetInlineStart: left, width, background: roomColor(room.color) }} onClick={() => onPick(b)}
                  title={`${b.customer_name} · ${fmtRange(b.start, b.end)}`}>
                  <b>{b.customer_name}</b>
                  <small className="num">{fmtTime(b.start)}{width >= HOUR_W ? ` – ${fmtTime(b.end)}` : ''}</small>
                </button>
              )
            })}
          </RoomRow>
        ))}
      </div>
    </div>
  )
}

function RoomRow({ name, color, hours, hourW, nowX, onEmpty, children }: { name: string; color: string; hours: number; hourW: number; nowX: number | null; onEmpty: (hourIndex: number) => void; children: React.ReactNode }) {
  return (
    <>
      <div className="grid-roomhead"><span className="dot" style={{ background: color }} /><span>{name}</span></div>
      <div className="grid-row" style={{ width: hours * hourW }}>
        {Array.from({ length: hours }, (_, i) => <button key={i} type="button" className="cell" style={{ insetInlineStart: i * hourW }} onClick={() => onEmpty(i)} aria-label={`حجز جديد ${toHHMM(i * 60)}`} />)}
        {children}
        {nowX !== null && nowX >= 0 && nowX <= hours * hourW && <div className="grid-now" style={{ insetInlineStart: nowX }} />}
      </div>
    </>
  )
}

/** Filterable list over the cached bookings (last 90 days + everything upcoming). */
function ListView({ onPick }: { onPick: (b: Booking) => void }) {
  const { view } = useStore()
  const rooms = useRooms(false)
  const [q, setQ] = useState('')
  const [date, setDate] = useState('')
  const [roomId, setRoomId] = useState<number>(0)
  const [status, setStatus] = useState<BookingStatus | 'live' | ''>('live')

  const list = useMemo(() => {
    const phone = normalisePhone(q)
    const text = q.trim().toLowerCase()
    return view.bookings.filter((b) => {
      if (date && localDate(b.start) !== date) return false
      if (roomId && b.room_id !== roomId) return false
      if (status === 'live' ? !isLive(b.status) : status && b.status !== status) return false
      if (text) {
        const hit = b.customer_name.toLowerCase().includes(text) || b.code.toLowerCase() === text || (b.payment_ref ?? '').includes(text)
          || b.customer_phone.includes(phone ?? text)
        if (!hit) return false
      }
      return true
    }).sort(status === 'live' || date ? sortByStart : (a, b) => -sortByStart(a, b)).slice(0, 300)
  }, [view.bookings, q, date, roomId, status])

  return (
    <>
      <div className="filters">
        <div className="wide" style={{ position: 'relative' }}>
          <Input placeholder="بحث بالاسم أو الهاتف أو الرمز" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
        </div>
        <Input type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} aria-label="التاريخ" />
        <Select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))} aria-label="القاعة">
          <option value={0}>كل القاعات</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | 'live' | '')} aria-label="الحالة">
          <option value="live">الحجوزات الفعّالة</option>
          <option value="">كل الحالات</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s).text}</option>)}
        </Select>
      </div>
      {list.length === 0 ? (
        <Empty title="لا نتائج" hint="غيّر الفلاتر أو ابحث بكلمة أخرى." />
      ) : (
        <div className="list">
          {list.map((b) => {
            const st = statusLabel(b.status)
            return (
              <button key={b.id} type="button" className="brow" onClick={() => onPick(b)}>
                <span className="bar" style={{ background: roomColor(view.rooms.find((r) => r.id === b.room_id)?.color) }} />
                <span>
                  <span className="t">{b.customer_name} <span className="muted small num">· {b.customer_phone}</span></span>
                  <span className="s" style={{ display: 'block' }}>{b.room_name} · {dayLabel(localDate(b.start))} · <span className="num">{fmtRange(b.start, b.end)}</span></span>
                </span>
                <span className="e"><b>{fmtSYP(b.price)}</b><Badge tone={st.tone}>{st.text}</Badge></span>
              </button>
            )
          })}
        </div>
      )}
      {list.length >= 300 && <p className="muted small text-center mt">تظهر أول 300 نتيجة — ضيّق البحث.</p>}
      <Card className="mt"><div className="inline-note"><Icon name="cloud" size={16} />القائمة تعرض حجوزات آخر 90 يوماً وكل الحجوزات القادمة، وتعمل دون اتصال.</div></Card>
    </>
  )
}
