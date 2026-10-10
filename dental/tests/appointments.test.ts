import type { Appointment, AppointmentStatus, Patient } from '../src/db/types'
import { combine } from '../src/lib/dates'
import {
  blocksTime, ceilMinutes, countByDate, durationOf, endFrom, findConflicts, generateSlots, gridBounds, groupByDate, isUpcoming, isValidDate, isValidTime,
  isWorkingDay, layoutColumns, matchesDoctor, matchesStatus, minutesOfDay, monthGrid, nextFreeSlot, nextLastVisit, nextStep, overlaps, patientSummary, pluralForm,
  pxPerMinute, quickPatientFromQuery, searchPatients, shiftDate, slotIsBusy, snapMinutes, STATUS_ACTIONS, viewRange, weekDates, withinHours,
} from '../src/features/appointments/lib'

const D = '2026-10-10' // a Saturday
const at = (time: string, date = D) => combine(date, time)
const span = (from: string, to: string, date = D) => ({ start: at(from, date), end: at(to, date) })
let seq = 0
const apt = (from: string, to: string, p: Partial<Appointment> = {}): Appointment => ({
  id: `a${++seq}`, patientId: 'p1', doctorId: 'd1', date: p.date ?? D, start: at(from, p.date ?? D), end: at(to, p.date ?? D),
  durationMin: 30, type: 'checkup', status: 'scheduled', createdAt: '', updatedAt: '', ...p,
})

describe('appointments: intervals', () => {
  it('detects overlaps with half-open intervals', () => {
    expect(overlaps(span('10:00', '10:30'), span('10:15', '10:45'))).toBe(true)
    expect(overlaps(span('10:00', '11:00'), span('10:15', '10:30'))).toBe(true)   // contained
    expect(overlaps(span('10:00', '10:30'), span('10:30', '11:00'))).toBe(false)  // touching edges
    expect(overlaps(span('10:30', '11:00'), span('10:00', '10:30'))).toBe(false)
    expect(overlaps(span('10:00', '10:30'), span('11:00', '11:30'))).toBe(false)
    expect(overlaps(span('10:00', '10:30', '2026-10-10'), span('10:00', '10:30', '2026-10-11'))).toBe(false) // another day
  })
  it('derives end, duration and minutes of day', () => {
    const s = at('09:45')
    expect(endFrom(s, 30)).toBe(at('10:15'))
    expect(endFrom(s, 120)).toBe(at('11:45'))
    expect(durationOf(span('09:00', '10:30'))).toBe(90)
    expect(minutesOfDay(at('13:20'))).toBe(13 * 60 + 20)
  })
  it('only live statuses block time', () => {
    const blocking = (['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed'] as AppointmentStatus[]).every(blocksTime)
    expect(blocking).toBe(true)
    expect(blocksTime('cancelled')).toBe(false)
    expect(blocksTime('no_show')).toBe(false)
  })
  it('finds conflicts for the same doctor only, ignoring itself and cancelled ones', () => {
    const list = [
      apt('10:00', '10:30', { id: 'x' }),
      apt('10:15', '11:00', { id: 'y', doctorId: 'd2' }),
      apt('10:00', '10:30', { id: 'z', status: 'cancelled' }),
      apt('10:20', '10:50', { id: 'w', status: 'confirmed' }),
      apt('10:30', '11:00', { id: 'v' }),
    ]
    const c = findConflicts({ ...span('10:10', '10:40'), doctorId: 'd1' }, list)
    expect(c.map(a => a.id)).toEqual(['x', 'w', 'v'])
    expect(findConflicts({ id: 'x', ...span('10:00', '10:30'), doctorId: 'd1' }, list).map(a => a.id)).toEqual(['w'])
    expect(findConflicts({ ...span('12:00', '12:30'), doctorId: 'd1' }, list)).toEqual([])
  })
})

describe('appointments: slots', () => {
  it('generates slots from start to end (exclusive)', () => {
    expect(generateSlots('09:00', '11:00', 30)).toEqual(['09:00', '09:30', '10:00', '10:30'])
    expect(generateSlots('09:00', '10:00', 20)).toEqual(['09:00', '09:20', '09:40'])
    expect(generateSlots('09:00', '09:50', 15)).toEqual(['09:00', '09:15', '09:30', '09:45'])
    expect(generateSlots('18:00', '09:00', 30)).toEqual([])
    expect(generateSlots('09:00', '10:00', 0)).toHaveLength(2) // a bad step falls back to 30
  })
  it('snaps clicks to the grid', () => {
    expect(snapMinutes(9 * 60 + 47, 15)).toBe(9 * 60 + 45)
    expect(snapMinutes(9 * 60 + 29, 30)).toBe(9 * 60)
    expect(snapMinutes(9 * 60 + 30, 30)).toBe(9 * 60 + 30)
    expect(ceilMinutes(9 * 60 + 1, 30)).toBe(9 * 60 + 30)
  })
  const hours = { workStart: '09:00', workEnd: '12:00', slotMinutes: 30 }
  it('finds the next free slot that fits the duration', () => {
    const busy = [span('09:00', '09:30'), span('09:30', '10:15'), span('11:00', '11:30')]
    expect(nextFreeSlot([], D, 30, hours)).toBe('09:00')
    expect(nextFreeSlot(busy, D, 30, hours)).toBe('10:30')         // 10:15 is not on the grid
    expect(nextFreeSlot(busy, D, 60, hours)).toBe(null)            // 10:30–11:30 hits 11:00, 11:30–12:30 is past closing
    expect(nextFreeSlot(busy, D, 30, hours, '11:05')).toBe('11:30') // starts searching from a time, rounded up
    expect(nextFreeSlot(busy, D, 30, hours, '07:00')).toBe('10:30') // never before opening
    expect(nextFreeSlot([span('09:00', '12:00')], D, 15, hours)).toBe(null)
  })
  it('marks busy slots', () => {
    const list = [apt('09:30', '10:15'), apt('11:00', '11:30', { status: 'cancelled' })]
    expect(slotIsBusy(list, D, '09:00', 30)).toBe(false)
    expect(slotIsBusy(list, D, '09:30', 30)).toBe(true)
    expect(slotIsBusy(list, D, '10:00', 30)).toBe(true)
    expect(slotIsBusy(list, D, '10:30', 30)).toBe(false)
    expect(slotIsBusy(list, D, '11:00', 30)).toBe(false) // cancelled frees the slot
  })
  it('checks working days and hours', () => {
    expect(isWorkingDay('2026-10-10', [0, 1, 2, 3, 4, 6])).toBe(true)   // Saturday
    expect(isWorkingDay('2026-10-16', [0, 1, 2, 3, 4, 6])).toBe(false)  // Friday
    expect(withinHours('09:00', 30, '09:00', '18:00')).toBe(true)
    expect(withinHours('17:45', 30, '09:00', '18:00')).toBe(false)
    expect(withinHours('08:30', 30, '09:00', '18:00')).toBe(false)
    expect(withinHours('17:30', 30, '09:00', '18:00')).toBe(true)
  })
  it('validates times and dates', () => {
    expect(isValidTime('09:30')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('9:30')).toBe(false)
    expect(isValidDate('2026-02-28')).toBe(true)
    expect(isValidDate('2026-02-30')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})

describe('appointments: day grid layout', () => {
  it('gives lone events the full width', () => {
    const p = layoutColumns([apt('09:00', '09:30'), apt('10:00', '10:30')])
    expect(p.map(x => [x.col, x.cols])).toEqual([[0, 1], [0, 1]])
  })
  it('puts overlapping events side by side and reuses freed columns', () => {
    const a = apt('09:00', '10:00', { id: 'A' }), b = apt('09:15', '09:45', { id: 'B' }), c = apt('09:45', '10:30', { id: 'C' }), d = apt('11:00', '11:30', { id: 'D' })
    const byId = Object.fromEntries(layoutColumns([d, c, b, a]).map(x => [x.item.id, [x.col, x.cols]]))
    expect(byId.A).toEqual([0, 2])
    expect(byId.B).toEqual([1, 2])
    expect(byId.C).toEqual([1, 2])   // B ended at 09:45: C takes its column
    expect(byId.D).toEqual([0, 1])   // a new cluster
  })
  it('handles three-way overlaps and chains', () => {
    const p = layoutColumns([apt('09:00', '10:00', { id: 'A' }), apt('09:00', '09:30', { id: 'B' }), apt('09:10', '09:40', { id: 'C' })])
    const byId = Object.fromEntries(p.map(x => [x.item.id, [x.col, x.cols]]))
    expect(byId.A).toEqual([0, 3]); expect(byId.B).toEqual([1, 3]); expect(byId.C).toEqual([2, 3])
    expect(layoutColumns([])).toEqual([])
  })
  it('widens the grid to show appointments outside working hours', () => {
    expect(gridBounds('09:00', '18:00', [])).toEqual({ startMin: 540, endMin: 1080 })
    expect(gridBounds('09:00', '18:00', [span('08:15', '08:45'), span('18:30', '19:10')])).toEqual({ startMin: 480, endMin: 1200 })
    expect(gridBounds('09:30', '17:15', [])).toEqual({ startMin: 540, endMin: 1080 })
  })
  it('scales slots to a readable height', () => {
    expect(Math.round(pxPerMinute(30) * 30)).toBe(52)
    expect(pxPerMinute(15) * 15).toBe(30)
    expect(pxPerMinute(0)).toBeCloseTo(52 / 30)
  })
})

describe('appointments: ranges', () => {
  it('computes the range of every view (week starts on Saturday)', () => {
    expect(viewRange('day', D)).toEqual({ from: D, to: D })
    expect(viewRange('week', '2026-10-14')).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(viewRange('month', '2026-10-14')).toEqual({ from: '2026-09-26', to: '2026-11-06' })
    expect(viewRange('list', D)).toEqual({ from: D, to: '2026-10-23' })
  })
  it('moves by a day, week, month or agenda page', () => {
    expect(shiftDate('day', D, 1)).toBe('2026-10-11')
    expect(shiftDate('week', D, -1)).toBe('2026-10-03')
    expect(shiftDate('month', '2026-01-31', 1)).toBe('2026-02-01') // never skips February
    expect(shiftDate('list', D, 1)).toBe('2026-10-24')
  })
  it('builds month and week grids', () => {
    const g = monthGrid('2026-10-14')
    expect(g).toHaveLength(6)
    expect(g[0][0]).toBe('2026-09-26')
    expect(g.every(r => r.length === 7)).toBe(true)
    expect(monthGrid('2026-02-01')).toHaveLength(5)
    expect(weekDates('2026-10-16')).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])
  })
})

describe('appointments: grouping, filters, status flow', () => {
  it('groups by day in time order', () => {
    const list = [apt('11:00', '11:30', { id: 'b' }), apt('09:00', '09:30', { id: 'c', date: '2026-10-12' }), apt('09:00', '09:30', { id: 'a' })]
    const g = groupByDate(list)
    expect(g.map(x => x.date)).toEqual([D, '2026-10-12'])
    expect(g[0].items.map(a => a.id)).toEqual(['a', 'b'])
    expect(countByDate(list).get(D)).toBe(2)
  })
  it('filters by status and doctor', () => {
    expect(matchesStatus('cancelled', 'all')).toBe(true)
    expect(matchesStatus('cancelled', 'active')).toBe(false)
    expect(matchesStatus('arrived', 'active')).toBe(true)
    expect(matchesStatus('arrived', 'confirmed')).toBe(false)
    expect(matchesDoctor('d1', [])).toBe(true)
    expect(matchesDoctor('d1', ['d2'])).toBe(false)
  })
  it('offers the right status actions', () => {
    expect(STATUS_ACTIONS.scheduled).toEqual(['confirmed', 'arrived', 'cancelled', 'no_show'])
    expect(STATUS_ACTIONS.arrived).toEqual(['in_progress'])
    expect(STATUS_ACTIONS.in_progress).toEqual(['completed'])
    expect(STATUS_ACTIONS.completed).toEqual(['scheduled'])
    expect(STATUS_ACTIONS.cancelled).toEqual(['scheduled'])
    expect(nextStep('scheduled')).toBe('confirmed')
    expect(nextStep('confirmed')).toBe('arrived')
    expect(nextStep('arrived')).toBe('in_progress')
    expect(nextStep('in_progress')).toBe('completed')
    expect(nextStep('completed')).toBe(null)
    expect(nextStep('cancelled')).toBe(null)
  })
  it('never moves the last visit backwards', () => {
    expect(nextLastVisit(undefined, at('10:00'))).toBe(at('10:00'))
    expect(nextLastVisit(at('09:00', '2026-10-01'), at('10:00'))).toBe(at('10:00'))
    expect(nextLastVisit(at('09:00', '2026-10-20'), at('10:00'))).toBe(at('09:00', '2026-10-20'))
  })
})

describe('appointments: patient tab', () => {
  it('splits upcoming and past and counts visits', () => {
    const list = [
      apt('09:00', '09:30', { id: 'today-open' }),
      apt('08:00', '08:30', { id: 'today-done', status: 'completed' }),
      apt('10:00', '10:30', { id: 'future', date: '2026-10-20' }),
      apt('10:00', '10:30', { id: 'old', date: '2026-09-01', status: 'completed' }),
      apt('10:00', '10:30', { id: 'missed', date: '2026-09-15', status: 'no_show' }),
      apt('10:00', '10:30', { id: 'future-cancelled', date: '2026-10-12', status: 'cancelled' }),
    ]
    const s = patientSummary(list, D)
    expect(s.upcoming.map(a => a.id)).toEqual(['today-open', 'future-cancelled', 'future'])
    expect(s.past.map(a => a.id)).toEqual(['today-done', 'missed', 'old'])
    expect(s.visits).toBe(2)
    expect(s.noShows).toBe(1)
    expect(s.cancelled).toBe(1)
    expect(s.total).toBe(6)
    expect(s.next?.id).toBe('today-open')
    expect(isUpcoming({ date: '2026-10-09', status: 'scheduled' }, D)).toBe(false)
  })
})

describe('appointments: text', () => {
  it('picks the Arabic plural class', () => {
    expect([0, 1, 2, 3, 10, 11, 16, 99, 100, 103, 111].map(pluralForm)).toEqual(['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'many', 'many', 'few', 'many'])
  })
})

describe('appointments: patient picker', () => {
  const p = (name: string, fileNo: number, phone?: string): Pick<Patient, 'name' | 'fileNo' | 'phone' | 'phone2'> => ({ name, fileNo, phone })
  const list = [p('أحمد محمود الخطيب', 1, '0944123456'), p('فاطمة الزهراء العلي', 2, '0933456789'), p('محمد أحمد', 12, '+963 955 111 222'), p('إيمان سعيد', 21)]
  it('matches Arabic names ignoring hamza variants, best first', () => {
    expect(searchPatients(list, 'احمد').map(x => x.fileNo)).toEqual([1, 12])   // starts-with before word match
    expect(searchPatients(list, 'ايمان').map(x => x.fileNo)).toEqual([21])
    expect(searchPatients(list, 'الزهراء').map(x => x.fileNo)).toEqual([2])
    expect(searchPatients(list, 'فاطمه العلي').map(x => x.fileNo)).toEqual([2])   // ta-marbuta + several words
  })
  it('matches file numbers and phone digits', () => {
    expect(searchPatients(list, '12')[0].fileNo).toBe(12)
    expect(searchPatients(list, '0944').map(x => x.fileNo)).toEqual([1])
    expect(searchPatients(list, '955 111').map(x => x.fileNo)).toEqual([12])
    expect(searchPatients(list, 'zzz')).toEqual([])
  })
  it('limits results and returns the first ones for an empty query', () => {
    const many = Array.from({ length: 20 }, (_, i) => p(`مريض ${i}`, i + 1))
    expect(searchPatients(many, 'مريض')).toHaveLength(8)
    expect(searchPatients(many, '', 5)).toHaveLength(5)
  })
  it('splits a typed query into quick-create fields', () => {
    expect(quickPatientFromQuery('سامر')).toEqual({ name: 'سامر', phone: '' })
    expect(quickPatientFromQuery('0944 555 666')).toEqual({ name: '', phone: '0944 555 666' })
    expect(quickPatientFromQuery('12')).toEqual({ name: '12', phone: '' })
  })
})
