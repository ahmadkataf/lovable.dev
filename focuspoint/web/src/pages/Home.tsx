// Home: pick when, see the plan coloured by availability, tap a room. One screen, one job.
import { useEffect, useMemo, useState } from 'react'
import type { PublicSettings, Room } from '@shared/types'
import logoUrl from '@shared/logo.svg'
import { useCached } from '../lib/data'
import { useOnline } from '../offline'
import { addDays, addMinutes, fmtClock, fmtSYP, fromLocal, todayLocal } from '../format'
import { Badge, Card, Icon, Select, Spinner } from '../ui'
import { PlanView } from '../plan/PlanView'
import { RoomSheet } from '../components/RoomSheet'
import { InstallHint } from '../components/InstallHint'
import { blocks, contentsIcons, defaultPick, durationsFor, overlaps, peopleLabel, ROOM_ICON, ROOM_TYPE, slotsFor, type Availability, type Pick } from '../lib/booking'
import { durationLabel } from '../format'

const WD_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function Home() {
  const online = useOnline()
  const settingsQ = useCached<PublicSettings>('/v1/settings')
  const roomsQ = useCached<Room[]>('/v1/rooms')
  const settings = settingsQ.data
  const rooms = useMemo(() => (roomsQ.data || []).filter((r) => r.active).sort((a, b) => a.sort - b.sort), [roomsQ.data])

  const [pick, setPick] = useState<Pick | null>(null)
  useEffect(() => { if (settings && !pick) setPick(defaultPick(settings)) }, [settings, pick])

  const availQ = useCached<Availability[]>(pick ? `/v1/availability?date=${pick.date}` : null, { pollMs: 60_000 })
  const [selected, setSelected] = useState<Room | null>(null)

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

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(todayLocal(), i)), [])
  const slots = useMemo(() => (settings && pick ? slotsFor(settings, pick.date) : []), [settings, pick])
  const durations = useMemo(() => (settings && pick ? durationsFor(settings, pick.time) : []), [settings, pick])

  // Keep the pick valid when the date or the time changes.
  useEffect(() => {
    if (!settings || !pick) return
    if (slots.length && !slots.includes(pick.time)) { setPick({ ...pick, time: slots[0] }); return }
    if (durations.length && !durations.includes(pick.minutes)) setPick({ ...pick, minutes: durations.includes(120) ? 120 : durations[durations.length - 1] })
  }, [settings, pick, slots, durations])

  const offlineData = settingsQ.fromCache || roomsQ.fromCache || availQ.fromCache || !online
  const loading = (settingsQ.loading || roomsQ.loading) && !settings
  const failed = !settings && !!settingsQ.error

  return (
    <div className="stack">
      <div className="hero">
        <img src={logoUrl} alt="Focus Point" className="hero-logo" width={56} height={56} />
        <div>
          <h1 className="hero-title">احجز مكانك بدرعا</h1>
          <p className="hero-sub">{settings ? `يومياً ${fmtClock(settings.open)} – ${fmtClock(settings.close)}` : 'مساحة عمل مشتركة · فوكس بوينت'}</p>
        </div>
      </div>

      {loading && <div className="center" style={{ padding: 40 }}><Spinner /></div>}
      {failed && (
        <Card><div className="alert alert-info">ما قدرنا نجيب بيانات المركز. تأكد من الاتصال وحاول مرة ثانية.</div></Card>
      )}

      {settings && pick && (
        <>
          <Card>
            <div className="chips" role="radiogroup" aria-label="اليوم">
              {days.map((d, i) => {
                const [y, m, dd] = d.split('-').map(Number)
                const wd = new Date(Date.UTC(y, m - 1, dd)).getUTCDay()
                return (
                  <button key={d} type="button" role="radio" aria-checked={d === pick.date} className={`chip${d === pick.date ? ' is-active' : ''}`} onClick={() => setPick({ ...pick, date: d })}>
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
              <PlanView
                plan={settings.plan}
                rooms={rooms}
                selectedId={selected?.id ?? null}
                status={(r) => (!r.active ? 'inactive' : busyIds.has(r.id) ? 'busy' : 'free')}
                onSelect={(r) => setSelected(r)}
              />
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
                  <span className="room-swatch"><Icon name={ROOM_ICON[r.type]} size={22} /></span>
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
            {rooms.length === 0 && !roomsQ.loading && <Card><p className="muted text-center">لا توجد غرف متاحة حالياً.</p></Card>}
          </div>

          <InstallHint />
        </>
      )}

      <RoomSheet room={selected} pick={pick} busy={!!selected && busyIds.has(selected.id)} offline={offlineData} settings={settings} onClose={() => setSelected(null)} />
    </div>
  )
}
