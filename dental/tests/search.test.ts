import { highlightRanges, indexPatient, invoiceNumberMatch, looksLikeNumber, plural, pushRecent, rankPatients, removeRecent, scoreLabel, scorePatient, splitHighlight, type SearchPatient } from '../src/features/search/lib'
import {
  birthdaysToday, computeAlerts, expiringItems, expiryState, importantIds, isBirthday, isLowStock, isOverdueInvoice, labDue, lowStockItems,
  monthsBetween, overdueInvoices, recallPatients, remainingToday, unconfirmedTomorrow, unseenCount,
} from '../src/features/search/alerts'
import { translate } from '../src/i18n'
import { combine } from '../src/lib/dates'
import type { Appointment, InventoryItem, Invoice, LabOrder, Patient } from '../src/db/types'

const P = (id: string, name: string, fileNo: number, extra: Partial<SearchPatient> = {}): SearchPatient => ({ id, name, fileNo, ...extra })
const people = [
  P('a', 'أحمد الخطيب', 12, { phone: '0944123456', lastVisit: '2026-09-01T10:00:00.000Z' }),
  P('b', 'محمد أحمدي', 120, { phone: '0933555777' }),
  P('c', 'فاطمة الزهراء', 3, { phone: '0955000111', nationalId: '01020304050' }),
  P('d', 'عبد الله إبراهيم', 45, { archived: true }),
  P('e', 'Ahmad Khatib', 7, { phone: '+963944999888' }),
  P('f', 'إبراهيم سعيد', 50),
]
const index = people.map(indexPatient)
const ids = (q: string) => rankPatients(index, q).map(r => r.item.id)

describe('patient ranking', () => {
  it('is Arabic-aware (hamza, ta marbuta, article, digits)', () => {
    expect(ids('احمد')[0]).toBe('a')                 // أحمد without hamza, whole first word beats "أحمدي"
    expect(ids('احمد')).toContain('b')
    expect(ids('فاطمه')).toEqual(['c'])
    expect(ids('خطيب')[0]).toBe('a')                 // matches the word after its article "ال"
    expect(ids('١٢')[0]).toBe('a')                   // Arabic-Indic digits
    expect(ids('ahmad')).toEqual(['e'])
  })
  it('ranks an exact file number first, then prefixes', () => {
    expect(ids('12').slice(0, 2)).toEqual(['a', 'b'])
    expect(ids('#3')[0]).toBe('c')
  })
  it('matches phones with or without the country code, and national ids', () => {
    expect(ids('0944').sort()).toEqual(['a', 'e'])
    expect(ids('0944999888')).toEqual(['e'])
    expect(ids('123456')).toEqual(['a'])             // the end of a phone
    expect(ids('0102030')).toEqual(['c'])
  })
  it('requires every word to match', () => {
    expect(ids('أحمد 0944')).toEqual(['a'])
    expect(ids('أحمد 0933')).toEqual(['b'])
    expect(ids('أحمد زهراء')).toEqual([])
  })
  it('finds compound names written without a space and keeps archived files below active ones', () => {
    expect(ids('عبدالله')).toEqual(['d'])
    expect(ids('ابراهيم')).toEqual(['f', 'd'])
    expect(scorePatient(indexPatient(people[3]), 'ابراهيم')).toBeGreaterThan(0)
  })
  it('returns nothing for an empty query and honours the limit', () => {
    expect(ids('   ')).toEqual([])
    expect(rankPatients(index, 'ا', 2)).toHaveLength(2)
  })
})

describe('invoice numbers, labels, highlighting, recents', () => {
  it('matches invoice numbers by serial, prefix and text', () => {
    expect(invoiceNumberMatch('INV-000123', '123')).toBe(3)
    expect(invoiceNumberMatch('INV-000123', '#123')).toBe(3)
    expect(invoiceNumberMatch('INV-000123', 'inv-000123')).toBe(3)
    expect(invoiceNumberMatch('INV-000123', '12')).toBe(2)
    expect(invoiceNumberMatch('INV-000123', '23')).toBe(1)
    expect(invoiceNumberMatch('INV-000123', '9')).toBe(0)
    expect(invoiceNumberMatch('INV-000123', 'in')).toBe(0)
    expect(looksLikeNumber('INV-12')).toBe(true)
    expect(looksLikeNumber('أحمد')).toBe(false)
  })
  it('scores page labels in both languages', () => {
    expect(scoreLabel(['المواعيد', 'Appointments'], 'موا')).toBeGreaterThan(0)
    expect(scoreLabel(['المواعيد', 'Appointments'], 'appo')).toBeGreaterThan(0)
    expect(scoreLabel(['المواعيد', 'Appointments'], 'فواتير')).toBe(0)
  })
  it('highlights matches in the original text', () => {
    expect(highlightRanges('أحمد الخطيب', 'احمد')).toEqual([[0, 4]])
    expect(highlightRanges('فاطمة الزهراء', 'فاطمه')).toEqual([[0, 5]])
    const voweled = 'مُحَمَّد'
    expect(highlightRanges(voweled, 'محمد')).toEqual([[0, voweled.length]])
    expect(splitHighlight('Ahmad Khatib', 'kha')).toEqual([{ text: 'Ahmad ', hit: false }, { text: 'Kha', hit: true }, { text: 'tib', hit: false }])
    expect(splitHighlight('#12', '12')).toEqual([{ text: '#', hit: false }, { text: '12', hit: true }])
  })
  it('keeps at most six recent searches, newest first, deduplicated', () => {
    let list: string[] = []
    for (const q of ['أحمد', 'فاطمة', 'INV-1', '0944', 'محمد', 'سارة', 'ليلى']) list = pushRecent(list, q)
    expect(list).toHaveLength(6)
    expect(list[0]).toBe('ليلى')
    list = pushRecent(list, '  احمد ')
    expect(list[0]).toBe('احمد')
    expect(list.filter(x => x === 'أحمد')).toHaveLength(0)
    expect(removeRecent(list, 'ليلي')).not.toContain('ليلى')
    expect(pushRecent(list, '   ')).toEqual(list)
  })
  it('uses real Arabic plural forms', () => {
    const ar = (k: string, p?: Record<string, string | number>) => translate('ar', k, p)
    const en = (k: string, p?: Record<string, string | number>) => translate('en', k, p)
    expect(plural(ar, 'ar', 'search.days', 1)).toBe('يوم واحد')
    expect(plural(ar, 'ar', 'search.days', 2)).toBe('يومين')
    expect(plural(ar, 'ar', 'search.days', 5)).toBe('5 أيام')
    expect(plural(ar, 'ar', 'search.days', 11)).toBe('11 يوماً')
    expect(plural(ar, 'ar', 'search.months', 7)).toBe('7 أشهر')
    expect(plural(en, 'en', 'search.days', 1)).toBe('1 day')
    expect(plural(en, 'en', 'search.days', 3)).toBe('3 days')
  })
})

// ---- alerts --------------------------------------------------------------------------------------------
const TODAY = '2026-10-10'
const inv = (id: string, o: Partial<Invoice>): Invoice => ({
  id, number: `INV-${id}`, patientId: 'p1', date: '2026-10-01', items: [], subtotal: 100, discount: 0, taxPercent: 0, tax: 0, total: 100, paid: 0, status: 'unpaid',
  createdAt: '', updatedAt: '', ...o,
})
const item = (id: string, o: Partial<InventoryItem>): InventoryItem => ({ id, name: id, category: 'materials', unit: 'box', quantity: 10, minQuantity: 2, active: true, createdAt: '', updatedAt: '', ...o })
const lab = (id: string, o: Partial<LabOrder>): LabOrder => ({ id, patientId: 'p1', labName: 'مخبر النور', type: 'crown', teeth: [11], status: 'sent', cost: 0, createdAt: '', updatedAt: '', ...o })
const apt = (id: string, date: string, time: string, status: Appointment['status'], patientId = 'p1', minutes = 30): Appointment => {
  const start = combine(date, time)
  return { id, patientId, doctorId: 'u1', date, start, end: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(), durationMin: minutes, type: 'checkup', status, createdAt: '', updatedAt: '' }
}
const pat = (id: string, o: Partial<Patient> = {}): Patient => ({ id, fileNo: 1, name: id, gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: '', updatedAt: '', ...o })

describe('overdue invoices', () => {
  it('uses the due date when there is one', () => {
    expect(isOverdueInvoice(inv('1', { dueDate: '2026-10-09' }), TODAY)).toBe(true)
    expect(isOverdueInvoice(inv('1', { dueDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdueInvoice(inv('1', { dueDate: '2026-11-01', date: '2026-01-01' }), TODAY)).toBe(false)
  })
  it('falls back to 30 days after the invoice date', () => {
    expect(isOverdueInvoice(inv('1', { date: '2026-09-10' }), TODAY)).toBe(false)   // exactly 30 days
    expect(isOverdueInvoice(inv('1', { date: '2026-09-09' }), TODAY)).toBe(true)    // 31 days
  })
  it('only counts unpaid / partial invoices that still have money due', () => {
    const old = { date: '2026-01-01' }
    expect(isOverdueInvoice(inv('1', { ...old, status: 'partial', paid: 40 }), TODAY)).toBe(true)
    expect(isOverdueInvoice(inv('1', { ...old, status: 'partial', paid: 100 }), TODAY)).toBe(false)
    for (const status of ['paid', 'draft', 'cancelled'] as const) expect(isOverdueInvoice(inv('1', { ...old, status }), TODAY)).toBe(false)
  })
  it('lists the most overdue first with the total due', () => {
    const r = overdueInvoices([
      inv('a', { dueDate: '2026-10-05', total: 200, paid: 50, status: 'partial' }),
      inv('b', { date: '2026-08-01' }),
      inv('c', { dueDate: '2026-12-01' }),
    ], TODAY)
    expect(r.list.map(x => x.invoice.id)).toEqual(['b', 'a'])
    expect(r.list[0]).toMatchObject({ basis: 'age', days: 70, due: 100 })
    expect(r.list[1]).toMatchObject({ basis: 'dueDate', days: 5, due: 150 })
    expect(r.totalDue).toBe(250)
  })
})

describe('inventory alerts', () => {
  it('flags low and out-of-stock items, out first', () => {
    expect(isLowStock(item('x', { quantity: 2, minQuantity: 2 }))).toBe(true)
    expect(isLowStock(item('x', { quantity: 3, minQuantity: 2 }))).toBe(false)
    expect(isLowStock(item('x', { quantity: 0, minQuantity: 2, active: false }))).toBe(false)
    const list = lowStockItems([item('low', { quantity: 1, minQuantity: 5 }), item('ok', {}), item('out', { quantity: 0, minQuantity: 3 })])
    expect(list.map(i => i.id)).toEqual(['out', 'low'])
  })
  it('expiry windows: expired, today, within 30 days, beyond', () => {
    expect(expiryState(item('x', { expiryDate: '2026-10-09' }), TODAY)).toEqual({ kind: 'expired', days: -1 })
    expect(expiryState(item('x', { expiryDate: TODAY }), TODAY)).toEqual({ kind: 'expiring', days: 0 })
    expect(expiryState(item('x', { expiryDate: '2026-11-09' }), TODAY)).toEqual({ kind: 'expiring', days: 30 })
    expect(expiryState(item('x', { expiryDate: '2026-11-10' }), TODAY)).toBeNull()
    expect(expiryState(item('x', { expiryDate: '2026-10-01', quantity: 0 }), TODAY)).toBeNull()   // nothing left to throw away
    expect(expiryState(item('x', { expiryDate: '2026-10-01', active: false }), TODAY)).toBeNull()
    expect(expiryState(item('x', {}), TODAY)).toBeNull()
    const list = expiringItems([item('soon', { expiryDate: '2026-10-20' }), item('gone', { expiryDate: '2026-09-01' }), item('far', { expiryDate: '2027-01-01' })], TODAY)
    expect(list.map(x => x.item.id)).toEqual(['gone', 'soon'])
  })
})

describe('lab work and appointments', () => {
  it('lab orders due today or late, only while still out', () => {
    const r = labDue([
      lab('late', { dueDate: '2026-10-07' }),
      lab('today', { dueDate: TODAY, status: 'in_progress' }),
      lab('back', { dueDate: '2026-10-01', status: 'received' }),
      lab('later', { dueDate: '2026-10-11' }),
      lab('nodate', {}),
    ], TODAY)
    expect(r.map(x => [x.order.id, x.kind, x.days])).toEqual([['late', 'overdue', 3], ['today', 'today', 0]])
  })
  it('remaining appointments today: arrived, ongoing and later ones, by time', () => {
    const now = new Date(2026, 9, 10, 10, 0)
    const list = remainingToday([
      apt('ended', TODAY, '09:00', 'scheduled'),
      apt('ongoing', TODAY, '09:45', 'confirmed'),
      apt('later', TODAY, '11:00', 'scheduled'),
      apt('waiting', TODAY, '08:00', 'arrived'),
      apt('cancelled', TODAY, '12:00', 'cancelled'),
      apt('done', TODAY, '10:30', 'completed'),
      apt('tomorrow', '2026-10-11', '09:00', 'scheduled'),
    ], now)
    expect(list.map(a => a.id)).toEqual(['waiting', 'ongoing', 'later'])
  })
  it('unconfirmed appointments are tomorrow\'s scheduled ones', () => {
    const list = unconfirmedTomorrow([
      apt('u2', '2026-10-11', '12:00', 'scheduled'), apt('u1', '2026-10-11', '09:00', 'scheduled'),
      apt('c', '2026-10-11', '10:00', 'confirmed'), apt('t', TODAY, '15:00', 'scheduled'),
    ], TODAY)
    expect(list.map(a => a.id)).toEqual(['u1', 'u2'])
  })
})

describe('recall and birthdays', () => {
  it('counts whole calendar months', () => {
    expect(monthsBetween('2026-03-01', TODAY)).toBe(7)
    expect(monthsBetween('2026-03-15', TODAY)).toBe(6)
    expect(monthsBetween('2025-10-10', TODAY)).toBe(12)
  })
  it('recalls patients whose last completed visit is over six months old and who have nothing booked', () => {
    const patients = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(id => pat(id, { archived: id === 'E' }))
    const apts = [
      apt('a1', '2026-03-01', '10:00', 'completed', 'A'),
      apt('b1', '2026-05-01', '10:00', 'completed', 'B'),                       // recent enough
      apt('c1', '2025-01-01', '10:00', 'completed', 'C'), apt('c2', '2026-10-20', '10:00', 'scheduled', 'C'), // already booked
      apt('d1', '2025-12-01', '10:00', 'completed', 'D'), apt('d2', '2026-10-20', '10:00', 'cancelled', 'D'), // cancelled booking does not count
      apt('e1', '2025-01-01', '10:00', 'completed', 'E'),                       // archived
      apt('f1', '2025-01-01', '10:00', 'no_show', 'F'),                         // never completed
      apt('g1', '2026-04-10', '10:00', 'completed', 'G'),                       // exactly six months: not yet
      apt('h1', '2026-04-09', '10:00', 'completed', 'H'), apt('h0', '2024-01-01', '10:00', 'completed', 'H'),
    ]
    const r = recallPatients(patients, apts, TODAY)
    expect(r.list.map(x => x.patient.id)).toEqual(['H', 'A', 'D'])
    expect(r.total).toBe(3)
    expect(r.list[1]).toMatchObject({ lastVisit: '2026-03-01', months: 7 })
    expect(r.list[0].lastVisit).toBe('2026-04-09')
    expect(recallPatients(patients, apts, TODAY, { limit: 2 })).toMatchObject({ total: 3 })
    expect(recallPatients(patients, apts, TODAY, { limit: 2 }).list).toHaveLength(2)
  })
  it('caps the recall list at ten', () => {
    const patients = Array.from({ length: 14 }, (_, i) => pat(`p${i}`))
    const apts = patients.map((p, i) => apt(`a${i}`, `2025-0${(i % 9) + 1}-01`, '10:00', 'completed', p.id))
    const r = recallPatients(patients, apts, TODAY)
    expect(r.list).toHaveLength(10)
    expect(r.total).toBe(14)
  })
  it('birthdays today, with 29 February on 28 February in common years', () => {
    expect(isBirthday('1990-10-10', TODAY)).toBe(true)
    expect(isBirthday('1990-10-11', TODAY)).toBe(false)
    expect(isBirthday('2000-02-29', '2027-02-28')).toBe(true)
    expect(isBirthday('2000-02-29', '2028-02-28')).toBe(false)
    expect(isBirthday(undefined, TODAY)).toBe(false)
    const list = birthdaysToday([pat('x', { birthDate: '1990-10-10' }), pat('y', { birthDate: '1990-10-10', archived: true }), pat('z', { birthDate: TODAY }), pat('w', { birthDate: '1985-01-02' })], TODAY)
    expect(list.map(b => [b.patient.id, b.age])).toEqual([['x', 36]])
  })
})

describe('important alerts and the red dot', () => {
  it('collects overdue invoices, low stock, late lab work and unconfirmed tomorrow', () => {
    const list = importantIds({
      invoices: [inv('i1', { date: '2026-01-01' }), inv('i2', {})],
      items: [item('s1', { quantity: 0 }), item('s2', {})],
      labOrders: [lab('l1', { dueDate: '2026-10-01' }), lab('l2', { dueDate: TODAY })],
      appointments: [apt('a1', '2026-10-11', '09:00', 'scheduled'), apt('a2', '2026-10-11', '10:00', 'confirmed')],
    }, TODAY)
    expect(list.sort()).toEqual(['apt:a1', 'inv:i1', 'lab:l1', 'stock:s1'])
    expect(unseenCount(list, new Set(['inv:i1', 'stock:s1']))).toBe(2)
    expect(unseenCount(list, new Set(list))).toBe(0)
  })
  it('computeAlerts puts everything together and keeps the patients it mentions', () => {
    const now = new Date(2026, 9, 10, 10, 0)
    const patients = [pat('p1', { name: 'سارة', birthDate: '1995-10-10', gender: 'female' }), pat('p2'), pat('p3')]
    const a = computeAlerts({
      upcoming: [apt('t1', TODAY, '11:00', 'scheduled', 'p2'), apt('u1', '2026-10-11', '09:00', 'scheduled', 'p3')],
      completed: [apt('old', '2025-10-01', '10:00', 'completed', 'p1')],
      invoices: [inv('i1', { date: '2026-01-01', patientId: 'p2' })],
      items: [item('s1', { quantity: 1, minQuantity: 2, expiryDate: '2026-10-15' })],
      labOrders: [lab('l1', { dueDate: '2026-10-09', patientId: 'p3' })],
      patients,
    }, now)
    expect(a.today).toBe(TODAY)
    expect(a.todayApts.map(x => x.id)).toEqual(['t1'])
    expect(a.unconfirmed.map(x => x.id)).toEqual(['u1'])
    expect(a.overdue.totalDue).toBe(100)
    expect(a.lowStock).toHaveLength(1)
    expect(a.expiry).toHaveLength(1)
    expect(a.lab[0].kind).toBe('overdue')
    expect(a.recall.list.map(x => x.patient.id)).toEqual(['p1'])
    expect(a.birthdays.map(x => x.age)).toEqual([31])
    expect([...a.patients.keys()].sort()).toEqual(['p1', 'p2', 'p3'])
    expect(a.important.sort()).toEqual(['apt:u1', 'inv:i1', 'lab:l1', 'stock:s1'])
  })
})
