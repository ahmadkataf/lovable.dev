import type { Appointment, Expense, InventoryItem, Invoice, LabOrder, Patient, Payment, Procedure, TreatmentItem } from '../src/db/types'
import {
  ageBands, appointmentStats, appointmentsByDoctor, appointmentsSeries, avgInvoice, bucketKey, buckets, byCategory, byDoctor, byMethod, chooseUnit, csvCell, delta,
  expensesByCategory, foldOther, genderSplit, greetingKey, invoicedTotal, isISODate, labDue, lowStock, newPatientsByMonth, nextStatuses, normalizeRange, nowIndex,
  outstandingByPatient, outstandingTotal, overdueInvoices, patientsInScope, patientsSeen, periodDays, previousPeriod, profit, referralSources, resolvePeriod, revenueByDay,
  revenueByMonth, seriesBy, statusCounts, toCSV, topProcedures, topSpenders, totalOf, treatmentsOverTime, unconfirmedTomorrow, untilToday, wholeMonths, workingMinutes,
} from '../src/features/reports/queries'
import { arcPath, barPath, compactNumber, countTicks, donutAngles, labelStride, monotonePath, niceTicks, share, textWidth } from '../src/features/reports/chartMath'

const T = '2026-10-01T09:00:00.000Z'
const pay = (p: Partial<Payment>): Payment => ({ id: Math.random().toString(36).slice(2), patientId: 'p1', amount: 0, method: 'cash', date: '2026-10-01', createdAt: T, ...p })
const inv = (p: Partial<Invoice>): Invoice => ({
  id: Math.random().toString(36).slice(2), number: 'INV-1', patientId: 'p1', date: '2026-10-01', items: [], subtotal: 0, discount: 0, taxPercent: 0, tax: 0, total: 0, paid: 0,
  status: 'unpaid', createdAt: T, updatedAt: T, ...p,
})
const apt = (p: Partial<Appointment>): Appointment => ({
  id: Math.random().toString(36).slice(2), patientId: 'p1', doctorId: 'd1', date: '2026-10-05', start: '2026-10-05T09:00:00.000Z', end: '2026-10-05T09:30:00.000Z', durationMin: 30,
  type: 'checkup', status: 'scheduled', createdAt: T, updatedAt: T, ...p,
})
const pat = (p: Partial<Patient>): Patient => ({
  id: Math.random().toString(36).slice(2), fileNo: 1, name: 'X', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: T, updatedAt: T, ...p,
})
const tr = (p: Partial<TreatmentItem>): TreatmentItem => ({
  id: Math.random().toString(36).slice(2), patientId: 'p1', procedureName: 'Filling', price: 100, discount: 0, status: 'completed', createdAt: T, updatedAt: T, ...p,
})

describe('reports: periods', () => {
  it('resolves presets around today', () => {
    expect(resolvePeriod('month', '2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(resolvePeriod('lastMonth', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(resolvePeriod('lastMonth', '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(resolvePeriod('quarter', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2026-02-28' })
    expect(resolvePeriod('year', '2026-10-10')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(resolvePeriod('custom', '2026-10-10', { from: '2026-09-15', to: '2026-10-02' })).toEqual({ from: '2026-09-15', to: '2026-10-02' })
  })
  it('normalises a custom range: swaps reversed ends, ignores invalid ones', () => {
    expect(normalizeRange('2026-10-20', '2026-10-01', '2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-20' })
    expect(normalizeRange('2026-02-30', '2026-03-05', '2026-10-10')).toEqual({ from: '2026-03-05', to: '2026-03-05' })
    expect(normalizeRange('', '', '2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2028-02-29')).toBe(true)
    expect(isISODate('2026-1-01')).toBe(false)
  })
  it('previous period: same number of calendar months, or the same number of days', () => {
    expect(previousPeriod({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(previousPeriod({ from: '2026-03-01', to: '2026-03-31' })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(previousPeriod({ from: '2026-08-01', to: '2026-10-31' })).toEqual({ from: '2026-05-01', to: '2026-07-31' })
    expect(previousPeriod({ from: '2026-10-05', to: '2026-10-11' })).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(wholeMonths({ from: '2026-01-01', to: '2026-12-31' })).toBe(12)
    expect(wholeMonths({ from: '2026-01-02', to: '2026-12-31' })).toBe(0)
    expect(periodDays({ from: '2026-10-01', to: '2026-10-31' })).toBe(31)
  })
  it('clips a period at today only when today falls inside it', () => {
    expect(untilToday({ from: '2026-10-01', to: '2026-10-31' }, '2026-10-10')).toEqual({ from: '2026-10-01', to: '2026-10-10' })
    expect(untilToday({ from: '2026-09-01', to: '2026-09-30' }, '2026-10-10')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(untilToday({ from: '2026-11-01', to: '2026-11-30' }, '2026-10-10')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
  it('delta: % change, null when there is no base', () => {
    expect(delta(150, 100)).toBe(50)
    expect(delta(50, 100)).toBe(-50)
    expect(delta(1, 3)).toBe(-66.7)
    expect(delta(0, 0)).toBeNull()
    expect(delta(10, 0)).toBeNull()
    expect(delta(-50, -100)).toBe(50)
  })
})

describe('reports: buckets & series', () => {
  it('chooses day / week / month by length', () => {
    expect(chooseUnit({ from: '2026-10-01', to: '2026-10-31' })).toBe('day')
    expect(chooseUnit({ from: '2026-01-01', to: '2026-12-31' })).toBe('month')
    expect(chooseUnit({ from: '2026-08-01', to: '2026-10-31' }, { dayUpTo: 31, weekUpTo: 190 })).toBe('week')
  })
  it('buckets cover the period and clip the ends', () => {
    expect(buckets({ from: '2026-10-01', to: '2026-10-03' }, 'day').map(b => b.key)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    const weeks = buckets({ from: '2026-10-01', to: '2026-10-31' }, 'week')
    expect(weeks[0]).toEqual({ key: '2026-09-26', from: '2026-10-01', to: '2026-10-02' })   // weeks start on Saturday
    expect(weeks[weeks.length - 1].to).toBe('2026-10-31')
    expect(buckets({ from: '2026-11-15', to: '2027-02-10' }, 'month').map(b => b.key)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(bucketKey('2026-10-10', 'week')).toBe('2026-10-10')
    expect(bucketKey('2026-10-09', 'week')).toBe('2026-10-03')
  })
  it('sums into zero-filled buckets and ignores items outside the period', () => {
    const items = [{ d: '2026-10-01', v: 5 }, { d: '2026-10-01', v: 2.5 }, { d: '2026-10-03', v: 1 }, { d: '2026-11-01', v: 99 }]
    expect(seriesBy(items, x => x.d, x => x.v, { from: '2026-10-01', to: '2026-10-03' }, 'day').map(p => p.value)).toEqual([7.5, 0, 1])
  })
})

describe('reports: money', () => {
  const payments = [
    pay({ date: '2026-10-01', amount: 100, method: 'cash' }), pay({ date: '2026-10-01', amount: 50, method: 'card' }),
    pay({ date: '2026-10-03', amount: 200, method: 'transfer' }), pay({ date: '2026-10-03', amount: -30, method: 'cash' }),   // refund
    pay({ date: '2026-11-15', amount: 70, method: 'wallet' }),
  ]
  it('revenue by day / month (refunds reduce it)', () => {
    expect(revenueByDay(payments, '2026-10-01', '2026-10-03').map(p => p.value)).toEqual([150, 0, 170])
    expect(revenueByMonth(payments, '2026-10-01', '2026-11-30').map(p => [p.key, p.value])).toEqual([['2026-10', 320], ['2026-11', 70]])
    expect(totalOf(payments)).toBe(390)
  })
  it('by method keeps the fixed method order', () => {
    expect(byMethod(payments).map(m => [m.method, m.value, m.count])).toEqual([['cash', 70, 2], ['card', 50, 1], ['transfer', 200, 1], ['wallet', 70, 1]])
  })
  it('by doctor: invoiced in the period, collected through the invoice doctor', () => {
    const i1 = inv({ id: 'i1', doctorId: 'd1', total: 300, date: '2026-10-02' })
    const i2 = inv({ id: 'i2', doctorId: 'd2', total: 100, date: '2026-09-20' })      // older invoice, paid this month
    const i3 = inv({ id: 'i3', doctorId: 'd2', total: 80, status: 'cancelled', date: '2026-10-02' })
    const rows = byDoctor([i1, i2, i3], [pay({ invoiceId: 'i1', amount: 200 }), pay({ invoiceId: 'i2', amount: 100 }), pay({ amount: 40 })],
      [{ id: 'd1', name: 'Dr A', color: '#111111' }, { id: 'd2', name: 'Dr B', color: '#222222' }], { from: '2026-10-01', to: '2026-10-31' })
    expect(rows.map(r => [r.doctorId, r.invoiced, r.invoices, r.collected])).toEqual([['d1', 300, 1, 200], ['d2', 0, 0, 100], ['', 0, 0, 40]])
    expect(rows[0].name).toBe('Dr A')
  })
  it('by category: invoice lines through their procedure, net of the invoice discount', () => {
    const procs: Pick<Procedure, 'id' | 'category'>[] = [{ id: 'fill', category: 'restorative' }, { id: 'rct', category: 'endodontic' }]
    const i = inv({
      subtotal: 400, discount: 40, total: 360,
      items: [
        { id: 'a', procedureId: 'fill', description: 'Filling', qty: 2, unitPrice: 100, discount: 0, total: 200 },
        { id: 'b', treatmentItemId: 't-rct', description: 'RCT', qty: 1, unitPrice: 150, discount: 0, total: 150 },
        { id: 'c', description: 'Free text', qty: 1, unitPrice: 50, discount: 0, total: 50 },
      ],
    })
    const cats = byCategory([i, inv({ status: 'draft', subtotal: 100, total: 100, items: [{ id: 'x', procedureId: 'fill', description: '', qty: 1, unitPrice: 100, discount: 0, total: 100 }] })],
      procs, [{ id: 't-rct', procedureId: 'rct' }])
    expect(cats.map(c => [c.category, c.value, c.count])).toEqual([['restorative', 180, 2], ['endodontic', 135, 1], ['other', 45, 1]])
  })
  it('average invoice and invoiced total skip drafts and cancelled invoices', () => {
    const list = [inv({ total: 100 }), inv({ total: 300, status: 'paid' }), inv({ total: 999, status: 'draft' }), inv({ total: 999, status: 'cancelled' })]
    expect(avgInvoice(list)).toBe(200)
    expect(invoicedTotal(list)).toBe(400)
    expect(avgInvoice([])).toBe(0)
  })
  it('expenses by category, largest first; profit and margin', () => {
    const ex = [{ category: 'rent', amount: 500 }, { category: 'materials', amount: 120 }, { category: 'materials', amount: 80 }, { category: 'other', amount: 0 }] as Pick<Expense, 'category' | 'amount'>[]
    expect(expensesByCategory(ex).map(e => [e.category, e.value, e.count])).toEqual([['rent', 500, 1], ['materials', 200, 2]])
    expect(profit(1000, 700)).toEqual({ revenue: 1000, expenses: 700, profit: 300, margin: 30 })
    expect(profit(0, 50)).toEqual({ revenue: 0, expenses: 50, profit: -50, margin: null })
  })
  it('outstanding per patient: issued invoices − all payments, debts only, largest first', () => {
    const invoices = [inv({ patientId: 'a', total: 300 }), inv({ patientId: 'a', total: 100, status: 'draft' }), inv({ patientId: 'b', total: 50 }), inv({ patientId: 'c', total: 80 })]
    const payments = [pay({ patientId: 'a', amount: 100, date: '2026-09-01' }), pay({ patientId: 'a', amount: 50, date: '2026-10-02' }), pay({ patientId: 'b', amount: 70, date: '2026-10-01' })]
    const rows = outstandingByPatient(invoices, payments)
    expect(rows.map(r => [r.patientId, r.invoiced, r.paid, r.due, r.lastPayment ?? null])).toEqual([['a', 300, 150, 150, '2026-10-02'], ['c', 80, 0, 80, null]])
    expect(outstandingTotal(invoices, payments)).toEqual({ total: 230, patients: 2 })   // b's credit never offsets the others
    expect(outstandingByPatient(invoices, payments, [{ id: 'c' }]).map(r => r.patientId)).toEqual(['c'])
  })
  it('top spenders', () => {
    const s = topSpenders([pay({ patientId: 'a', amount: 10 }), pay({ patientId: 'b', amount: 50 }), pay({ patientId: 'a', amount: 15 }), pay({ patientId: 'c', amount: -5 })], 2)
    expect(s).toEqual([{ patientId: 'b', paid: 50, payments: 1 }, { patientId: 'a', paid: 25, payments: 2 }])
  })
})

describe('reports: patients', () => {
  it('new patients by month (by file opening date)', () => {
    const list = [pat({ createdAt: '2026-08-10T12:00:00.000Z' }), pat({ createdAt: '2026-10-02T12:00:00.000Z' }), pat({ createdAt: '2026-10-20T12:00:00.000Z' })]
    expect(newPatientsByMonth(list, '2026-08-01', '2026-10-31').map(p => p.value)).toEqual([1, 0, 2])
  })
  it('age bands at a date, unknown birth dates apart', () => {
    const at = new Date(2026, 9, 10)
    const r = ageBands([{ birthDate: '2020-01-01' }, { birthDate: '2008-10-10' }, { birthDate: '2008-10-11' }, { birthDate: '1990-05-05' }, { birthDate: '1950-01-01' }, {}, { birthDate: 'garbage' }], at)
    expect(r.bands.map(b => [b.id, b.count])).toEqual([['0-17', 2], ['18-29', 1], ['30-44', 1], ['45-59', 0], ['60+', 1]])
    expect(r.unknown).toBe(2)
  })
  it('gender split and referral sources (Arabic-insensitive grouping)', () => {
    expect(genderSplit([pat({ gender: 'male' }), pat({ gender: 'female' }), pat({ gender: 'female' })])).toEqual({ male: 1, female: 2 })
    const r = referralSources([{ referredBy: 'فيسبوك' }, { referredBy: ' فيسبوك ' }, { referredBy: 'صديق' }, { referredBy: '' }, {}], 5)
    expect(r.rows).toEqual([{ source: 'فيسبوك', count: 2 }, { source: 'صديق', count: 1 }])
    expect(r.none).toBe(2)
  })
  it('patients in scope: visited in the period or registered in it', () => {
    const a = pat({ id: 'a', createdAt: '2025-01-01T12:00:00.000Z' }), b = pat({ id: 'b', createdAt: '2026-10-03T12:00:00.000Z' }), c = pat({ id: 'c', createdAt: '2025-01-01T12:00:00.000Z' })
    const apts = [apt({ patientId: 'a', status: 'completed' }), apt({ patientId: 'c', status: 'cancelled' })]
    expect(patientsInScope([a, b, c], apts, { from: '2026-10-01', to: '2026-10-31' }).map(p => p.id)).toEqual(['a', 'b'])
    expect(patientsSeen([apt({ patientId: 'a', status: 'completed' }), apt({ patientId: 'a', status: 'arrived' }), apt({ patientId: 'b', status: 'no_show' })])).toBe(1)
  })
})

describe('reports: appointments', () => {
  const list = [
    apt({ status: 'completed', durationMin: 30 }), apt({ status: 'completed', durationMin: 60 }), apt({ status: 'no_show', durationMin: 30 }),
    apt({ status: 'cancelled', durationMin: 45 }), apt({ status: 'scheduled', durationMin: 0, start: '2026-10-05T10:00:00.000Z', end: '2026-10-05T10:20:00.000Z' }),
  ]
  it('counts, no-show rate and utilisation', () => {
    const s = appointmentStats(list, 280)
    expect(s.total).toBe(5)
    expect(s.booked).toBe(4)
    expect(s.completed).toBe(2)
    expect(s.cancelled).toBe(1)
    expect(s.noShow).toBe(1)
    expect(s.noShowRate).toBe(25)
    expect(s.completionRate).toBe(50)
    expect(s.bookedMinutes).toBe(140)        // the 20-minute visit comes from start/end
    expect(s.utilisation).toBe(50)
    expect(appointmentStats([]).noShowRate).toBe(0)
    expect(appointmentStats(list).utilisation).toBeNull()
    expect(statusCounts(list).completed).toBe(2)
  })
  it('working minutes count only working days', () => {
    // 2026-10-01 is a Thursday; Friday (5) is off
    expect(workingMinutes({ from: '2026-10-01', to: '2026-10-07' }, { workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '17:00' })).toBe(6 * 480)
    expect(workingMinutes({ from: '2026-10-02', to: '2026-10-02' }, { workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '17:00' })).toBe(0)
    expect(workingMinutes({ from: '2026-10-01', to: '2026-10-01' }, { workingDays: [4], workStart: '18:00', workEnd: '09:00' })).toBe(0)
  })
  it('per doctor rows, busiest first, listed doctors without appointments included', () => {
    const rows = appointmentsByDoctor([...list, apt({ doctorId: 'd2', status: 'completed', durationMin: 30 })], [{ id: 'd1', name: 'A' }, { id: 'd2', name: 'B' }, { id: 'd3', name: 'C' }], 600)
    expect(rows.map(r => [r.doctorId, r.booked, r.completed, r.noShows, r.utilisation])).toEqual([['d1', 4, 2, 1, 23.3], ['d2', 1, 1, 0, 5], ['d3', 0, 0, 0, 0]])
  })
  it('series of booked appointments per day (cancelled excluded)', () => {
    expect(appointmentsSeries(list, { from: '2026-10-04', to: '2026-10-05' }, 'day').map(p => p.value)).toEqual([0, 4])
  })
})

describe('reports: treatments', () => {
  const list = [
    tr({ procedureId: 'fill', procedureName: 'Filling', price: 60, completedAt: '2026-10-02T10:00:00.000Z', createdAt: '2026-09-28T10:00:00.000Z' }),
    tr({ procedureId: 'fill', procedureName: 'Filling', price: 60, discount: 10, completedAt: '2026-10-03T10:00:00.000Z', createdAt: '2026-10-03T08:00:00.000Z' }),
    tr({ procedureId: 'crown', procedureName: 'Crown', price: 350, completedAt: '2026-10-04T10:00:00.000Z', createdAt: '2026-10-01T10:00:00.000Z' }),
    tr({ procedureName: 'Custom splint', price: 80, completedAt: '2026-10-04T11:00:00.000Z', createdAt: '2026-10-04T08:00:00.000Z' }),
    tr({ procedureId: 'crown', procedureName: 'Crown', price: 350, status: 'planned', createdAt: '2026-10-02T10:00:00.000Z' }),
    tr({ procedureId: 'fill', procedureName: 'Filling', status: 'cancelled', createdAt: '2026-10-02T10:00:00.000Z' }),
  ]
  it('ranks completed procedures by count or by value', () => {
    expect(topProcedures(list).map(r => [r.name, r.count, r.value])).toEqual([['Filling', 2, 110], ['Crown', 1, 350], ['Custom splint', 1, 80]])
    expect(topProcedures(list, { by: 'value', limit: 2 }).map(r => r.name)).toEqual(['Crown', 'Filling'])
  })
  it('planned (added) vs completed per bucket', () => {
    const r = treatmentsOverTime(list, { from: '2026-10-01', to: '2026-10-04' }, 'day')
    expect(r.map(p => [p.key, p.planned, p.completed])).toEqual([['2026-10-01', 1, 0], ['2026-10-02', 1, 1], ['2026-10-03', 1, 1], ['2026-10-04', 1, 2]])
  })
})

describe('reports: dashboard helpers', () => {
  it('overdue invoices: past the due date, or 30 days old without one', () => {
    const list = [
      inv({ total: 100, paid: 40, status: 'partial', dueDate: '2026-10-01' }), inv({ total: 50, status: 'unpaid', date: '2026-08-01' }),
      inv({ total: 50, status: 'unpaid', date: '2026-09-25' }), inv({ total: 80, status: 'paid', dueDate: '2026-01-01' }), inv({ total: 10, status: 'unpaid', dueDate: '2026-10-10' }),
    ]
    expect(overdueInvoices(list, '2026-10-10')).toEqual({ count: 2, total: 110 })
  })
  it('low stock, lab work due, unconfirmed tomorrow', () => {
    const items = [{ quantity: 0, minQuantity: 2, active: true }, { quantity: 5, minQuantity: 5, active: true }, { quantity: 9, minQuantity: 2, active: true }, { quantity: 0, minQuantity: 2, active: false }] as InventoryItem[]
    expect(lowStock(items)).toHaveLength(2)
    const labs = [{ status: 'sent', dueDate: '2026-10-09' }, { status: 'in_progress', dueDate: '2026-10-10' }, { status: 'received', dueDate: '2026-10-01' }, { status: 'sent', dueDate: '2026-10-11' }, { status: 'sent' }] as LabOrder[]
    expect(labDue(labs, '2026-10-10')).toEqual({ late: 1, today: 1 })
    const apts = [apt({ date: '2026-10-11', status: 'scheduled' }), apt({ date: '2026-10-11', status: 'confirmed' }), apt({ date: '2026-10-12', status: 'scheduled' })]
    expect(unconfirmedTomorrow(apts, '2026-10-10')).toHaveLength(1)
  })
  it('quick status steps, the now line, greetings', () => {
    expect(nextStatuses('scheduled')).toEqual(['confirmed', 'arrived'])
    expect(nextStatuses('arrived')).toEqual(['in_progress'])
    expect(nextStatuses('in_progress')).toEqual(['completed'])
    expect(nextStatuses('completed')).toEqual([])
    const day = [{ start: '2026-10-10T08:00:00.000Z' }, { start: '2026-10-10T10:00:00.000Z' }]
    expect(nowIndex(day, '2026-10-10T07:00:00.000Z')).toBe(0)
    expect(nowIndex(day, '2026-10-10T09:00:00.000Z')).toBe(1)
    expect(nowIndex(day, '2026-10-10T12:00:00.000Z')).toBe(2)
    expect(nowIndex([], '2026-10-10T12:00:00.000Z')).toBe(-1)
    expect(greetingKey(8)).toBe('goodMorning')
    expect(greetingKey(15)).toBe('dashboard.goodAfternoon')
    expect(greetingKey(19)).toBe('goodEvening')
    expect(greetingKey(2)).toBe('goodEvening')
  })
  it('folds a long tail into "other"', () => {
    const r = foldOther([{ id: 'a', value: 5 }, { id: 'b', value: 3 }, { id: 'c', value: 2 }, { id: 'd', value: 1 }], 3, (value) => ({ id: 'other', value }))
    expect(r).toEqual([{ id: 'a', value: 5 }, { id: 'b', value: 3 }, { id: 'other', value: 3 }])
  })
})

describe('reports: CSV', () => {
  it('quotes when needed and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('-12.5')).toBe('-12.5')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(null)).toBe('')
    expect(toCSV([['المريض', 'المستحق'], ['محمد', 150]])).toBe('المريض,المستحق\r\nمحمد,150')
  })
})

describe('reports: chart maths', () => {
  it('nice ticks and integer ticks', () => {
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100])
    expect(niceTicks(1234)).toEqual([0, 500, 1000, 1500])
    expect(niceTicks(0)).toEqual([0, 1])
    expect(countTicks(3)).toEqual([0, 1, 2, 3])
    expect(countTicks(9).every(Number.isInteger)).toBe(true)
  })
  it('compact numbers', () => {
    expect(compactNumber(950)).toBe('950')
    expect(compactNumber(1250)).toBe('1.3K')
    expect(compactNumber(12000)).toBe('12K')
    expect(compactNumber(2_500_000)).toBe('2.5M')
    expect(compactNumber(-1500)).toBe('-1.5K')
    expect(compactNumber(2.5)).toBe('2.5')
  })
  it('label stride never lets labels collide', () => {
    expect(labelStride(31, 800, 14)).toBe(1)
    expect(labelStride(31, 620, 14)).toBe(2)
    expect(labelStride(31, 300, 14)).toBe(3)
    expect(labelStride(1, 300, 14)).toBe(1)
    expect(textWidth('12', 10)).toBeCloseTo(12)
  })
  it('paths', () => {
    expect(monotonePath([])).toBe('')
    expect(monotonePath([[0, 0], [10, 10]])).toBe('M0,0L10,10')
    const d = monotonePath([[0, 10], [10, 0], [20, 0], [30, 10]])
    expect(d.startsWith('M0,10C')).toBe(true)
    expect(d.match(/C/g)).toHaveLength(3)
    // flat stretch stays flat: control points of the middle segment keep y = 0
    expect(d.split('C')[2].split(' ').slice(0, 2).every(p => p.endsWith(',0'))).toBe(true)
    expect(barPath(0, 0, 10, 0)).toBe('')
    expect(barPath(0, 10, 10, 20)).toBe('M0,30V14Q0,10 4,10H6Q10,10 10,14V30Z')
  })
  it('donut angles keep gaps and cover the circle', () => {
    const a = donutAngles([1, 1, 2], 0.1)
    const covered = a.reduce((s, [x, y]) => s + (y - x), 0)
    expect(covered + 0.3).toBeCloseTo(Math.PI * 2)
    expect(a[2][1] - a[2][0]).toBeCloseTo(2 * (a[0][1] - a[0][0]))
    expect(donutAngles([0, 5], 0.1)[1]).toEqual([0, Math.PI * 2])
    expect(arcPath(50, 50, 40, 30, 0, Math.PI / 2)).toMatch(/^M50,10A40,40 0 0 1 90,50L80,50A30,30 0 0 0 50,20Z$/)
    expect(arcPath(50, 50, 40, 30, 0, Math.PI * 2).match(/M/g)).toHaveLength(2)
    expect(share(1, 3)).toBe(33.3)
    expect(share(1, 0)).toBe(0)
  })
})
