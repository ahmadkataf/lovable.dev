// /book — pick when, see the plan coloured by availability, tap a room. One screen, one job.
// `?room=<id>` (from the site's «احجز» buttons) opens that room's sheet as soon as the rooms are loaded.
// Texts: content.booking.intro_* / no_rooms. With online booking switched off (settings.booking_enabled = false) the
// page shows content.booking.closed_* (or settings.booking_closed_message) and WhatsApp / call buttons instead.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { intlPhone, whatsappLink } from '@shared/content'
import type { PublicSettings, Room } from '@shared/types'
import { useCached } from '../lib/data'
import { useOnline } from '../offline'
import { addDays, addMinutes, fmtClock, fmtSYP, fromLocal, todayLocal } from '../format'
import { Badge, Card, Icon, Select, Spinner } from '../ui'
import { PlanView } from '../plan/PlanView'
import { RoomSheet } from '../components/RoomSheet'
import { RoomSwatch } from '../components/RoomPhotos'
import { InstallHint } from '../components/InstallHint'
import { ContentText, hasText, useBookTitle, useBookingCopy, type Vars } from '../components/ContentText'
import { blocks, bookingOpen, contentsIcons, defaultPick, durationsFor, firstBookableDate, horizonDays, overlaps, peopleLabel, pickFor, ROOM_TYPE, slotsFor, type Availability, type Pick } from '../lib/booking'
import { durationLabel } from '../format'

const WD_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function BookHome() {
  const online = useOnline()
  const settingsQ = useCached<PublicSettings>('/v1/settings')
  const roomsQ = useCached<Room[]>('/v1/rooms')
  const settings = settingsQ.data
  const rooms = useMemo(() => (roomsQ.data || []).filter((r) => r.active).sort((a, b) => a.sort - b.sort), [roomsQ.data])
  const copy = useBookingCopy()
  useBookTitle()
  const closed = !!settings && !bookingOpen(settings)

  const [pick, setPick] = useState<Pick | null>(null)
  useEffect(() => { if (settings && !pick) setPick(defaultPick(settings)) }, [settings, pick])

  const availQ = useCached<Availability[]>(pick && !closed ? `/v1/availability?date=${pick.date}` : null, { pollMs: 60_000 })
  const [selected, setSelected] = useState<Room | null>(null)

  // Preselect the room named by ?room=<id> once, then drop the param so closing the sheet does not reopen it.
  const [params, setParams] = useSearchParams()
  const roomParam = params.get('room')
  useEffect(() => {
    if (!roomParam || !rooms.length) return
    const r = rooms.find((x) => String(x.id) === roomParam)
    if (r && !closed) setSelected(r)
    const next = new URLSearchParams(params)
    next.delete('room')
    setParams(next, { replace: true })
  }, [roomParam, rooms, params, setParams, closed])

  const range = useMemo(() => {
    if (!pick) return null
    const start = fromLocal(pick.date, pick.time)
    return { start, end: addMinutes(start, pick.minutes) }
  }, [pick])

  const busyIds = useMemo(() => {
    const set = new Set<number>()
    if (!range || !availQ.data) return set
    for (const a of availQ.data) if (blocks(a) && overlaps(a.start, a.end, range.start, range.end)) set.add(a.room_id)
    return set
  }, [availQ.data, range])

  // "Today" moves at midnight and the next free slot moves every half hour: re-evaluate once a minute.
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 60_000); return () => window.clearInterval(t) }, [])
  const today = useMemo(() => todayLocal(), [tick])
  const horizon = horizonDays(settings)
  const days = useMemo(() => Array.from({ length: horizon }, (_, i) => addDays(today, i)), [today, horizon])
  const slots = useMemo(() => (settings && pick ? slotsFor(settings, pick.date) : []), [settings, pick, tick])
  const durations = useMemo(() => (settings && pick ? durationsFor(settings, pick.time) : []), [settings, pick])
  const todayHasSlots = useMemo(() => (settings ? slotsFor(settings, today).length > 0 : true), [settings, today, tick])

  // Keep the pick valid: when the chosen date has no start left (the centre closed for today), move to the next
  // bookable day; otherwise snap the time and the duration to what is offered.
  useEffect(() => {
    if (!settings || !pick) return
    if (slots.length === 0) {
      const next = firstBookableDate(settings, addDays(pick.date, 1))
      if (next !== pick.date) setPick(pickFor(settings, next))
      return
    }
    if (!slots.includes(pick.time)) { setPick({ ...pick, time: slots[0] }); return }
    if (durations.length && !durations.includes(pick.minutes)) setPick({ ...pick, minutes: durations.includes(120) ? 120 : durations[durations.length - 1] })
  }, [settings, pick, slots, durations])

  const offlineData = settingsQ.fromCache || roomsQ.fromCache || availQ.fromCache || !online
  const loading = (settingsQ.loading || roomsQ.loading) && !settings
  const failed = !settings && !!settingsQ.error

  return (
    <div className="stack">
      <div className="hero">
        <span className="tile-icon brand sm" aria-hidden="true"><Icon name="calendar" size={22} /></span>
        <div>
          <h1 className="hero-title"><ContentText text={copy.text('intro_title')} vars={copy.vars} /></h1>
          {hasText(copy.text(settings ? 'intro_hours' : 'intro_fallback')) && (
            <p className="hero-sub"><ContentText text={copy.text(settings ? 'intro_hours' : 'intro_fallback')} vars={copy.vars} /></p>
          )}
        </div>
      </div>

      {loading && <div className="center" style={{ padding: 40 }}><Spinner /></div>}
      {failed && (
        <Card><div className="alert alert-info">ما قدرنا نجيب بيانات المركز. تأكد من الاتصال وحاول مرة ثانية.</div></Card>
      )}

      {closed && settings && <BookingClosed settings={settings} whatsapp={copy.content.brand.whatsapp} title={copy.text('closed_title')} text={copy.text('closed_text')} vars={copy.vars} />}

      {settings && pick && !closed && (
        <>
          <Card>
            <div className="chips date-strip" role="radiogroup" aria-label="اليوم">
              {days.map((d, i) => {
                const [y, m, dd] = d.split('-').map(Number)
                const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay()
                const closed = i === 0 && !todayHasSlots   // after closing time "today" has nothing left to book
                return (
                  <button key={d} type="button" role="radio" aria-checked={d === pick.date} disabled={closed} title={closed ? 'انتهى الدوام اليوم' : undefined}
                    className={`chip${d === pick.date ? ' is-active' : ''}${closed ? ' is-closed' : ''}`} onClick={() => setPick({ ...pick, date: d })}>
                    <small>{i === 0 ? 'اليوم' : i === 1 ? 'غداً' : WD_SHORT[wd]}</small><b>{dd}</b>
                  </button>
                )
              })}
            </div>
            <div className="row gap mt-sm">
              <label className="grow">
                <span className="sr-only">الوقت</span>
                <Select value={pick.time} onChange={(e) => setPick({ ...pick, time: e.target.value })} disabled={!slots.length}>
                  {slots.length === 0 && <option value={pick.time}>انتهى الدوام اليوم</option>}
                  {slots.map((t) => <option key={t} value={t}>{fmtClock(t)}</option>)}
                </Select>
              </label>
              <label className="grow">
                <span className="sr-only">المدة</span>
                <Select value={pick.minutes} onChange={(e) => setPick({ ...pick, minutes: Number(e.target.value) })} disabled={!durations.length}>
                  {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
                </Select>
              </label>
            </div>
          </Card>

          {rooms.some((r) => r.plan) && (
            <Card>
              <div className="plan-wrap">
                <PlanView
                  plan={settings.plan}
                  rooms={rooms}
                  selectedId={selected?.id ?? null}
                  status={(r) => (!r.active ? 'inactive' : busyIds.has(r.id) ? 'busy' : 'free')}
                  onSelect={(r) => setSelected(r)}
                />
              </div>
              <p className="plan-hint">اسحب المخطط يميناً ويساراً لتشوف كل المساحات</p>
              <div className="legend">
                <span><i className="legend-dot" /> متاحة</span>
                <span><i className="legend-dot busy" /> محجوزة</span>
                {availQ.loading && <span className="row gap-sm"><Spinner size="sm" /> تحديث</span>}
              </div>
            </Card>
          )}

          <div className="room-list">
            {rooms.map((r) => {
              const busy = busyIds.has(r.id)
              return (
                <button key={r.id} type="button" className={`room-card${busy ? ' is-busy' : ''}${selected?.id === r.id ? ' is-selected' : ''}`} onClick={() => setSelected(r)}>
                  <RoomSwatch room={r} />
                  <span>
                    <span className="room-name">{r.name}</span>
                    <span className="room-meta">
                      <span>{ROOM_TYPE[r.type]}</span>
                      <span className="row gap-sm"><Icon name="people" size={14} /> {peopleLabel(r.capacity)}</span>
                      <span className="room-icons">{contentsIcons(r.contents).slice(0, 4).map((i) => <Icon key={i} name={i} size={16} />)}</span>
                    </span>
                  </span>
                  <span className="room-price">
                    {busy ? <Badge tone="grey">محجوزة</Badge> : <><b>{fmtSYP(r.price_hour)}</b><span>بالساعة</span></>}
                  </span>
                </button>
              )
            })}
            {rooms.length === 0 && !roomsQ.loading && <Card><p className="muted text-center"><ContentText text={copy.text('no_rooms')} vars={copy.vars} /></p></Card>}
          </div>

          <InstallHint />
        </>
      )}

      <RoomSheet room={closed ? null : selected} pick={pick} busy={!!selected && busyIds.has(selected.id)} offline={offlineData} settings={settings} onClose={() => setSelected(null)} />
    </div>
  )
}

/**
 * Online booking switched off: the admin's message (settings.booking_closed_message, else content.booking.closed_text)
 * and the ways to reach the centre. Bookings already made keep working (/mine, /b/:id and paying a held booking).
 */
function BookingClosed({ settings, whatsapp, title, text, vars }: { settings: PublicSettings; whatsapp: string; title: string; text: string; vars: Vars }) {
  const message = settings.booking_closed_message?.trim() || text
  const phone = settings.phone || String(vars.phone ?? '')
  const wa = intlPhone(whatsapp || phone) ? whatsappLink(whatsapp || phone) : ''
  const tel = phone.replace(/[^\d+]/g, '')
  return (
    <Card>
      <div className="status-hero">
        <span className="status-mark wait"><Icon name="clock" size={32} /></span>
        <h2 className="h2"><ContentText text={title} vars={vars} /></h2>
        {hasText(message) && <p className="muted small mt-sm" style={{ whiteSpace: 'pre-line' }}><ContentText text={message} vars={vars} /></p>}
        <div className="row gap wrap mt" style={{ justifyContent: 'center' }}>
          {wa && <a className="btn btn-primary" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={18} /> واتساب</a>}
          {tel && <a className="btn btn-soft" href={`tel:${tel}`}><Icon name="phone" size={18} /> اتصل بنا</a>}
        </div>
      </div>
    </Card>
  )
}
