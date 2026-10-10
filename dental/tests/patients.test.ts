import type { Appointment, Invoice, Patient, Payment } from '../src/db/types'
import {
  addChips, allTags, balancesByPatient, cleanPhone, countByKind, DEFAULT_FILTERS, digitsOnly, fileShape, filterPatients, findDuplicatePhone, fullSearch, guessKind,
  hasActiveFilters, hasChip, isRealDate, isValidEmail, isValidPhone, isValidTooth, lastVisitsByPatient, latestOf, medicalFlags, monthStartISO, nextAppointment, owes,
  patientBalance, patientStats, pluralForm, removeChip, sanitizePhoneInput, sortNotes, sortPatients, upcomingAppointments, validatePatient,
} from '../src/features/patients/lib'

const pt = (p: Partial<Patient>): Patient => ({
  id: 'p', fileNo: 1, name: 'مريض', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false,
  createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z', ...p,
})
const inv = (p: Partial<Invoice>): Pick<Invoice, 'patientId' | 'total' | 'status'> => ({ patientId: 'a', total: 0, status: 'unpaid', ...p })
const pay = (p: Partial<Payment>): Pick<Payment, 'patientId' | 'amount'> => ({ patientId: 'a', amount: 0, ...p })
const apt = (p: Partial<Appointment>): Pick<Appointment, 'patientId' | 'start' | 'status'> => ({ patientId: 'a', start: '2026-10-10T09:00:00.000Z', status: 'scheduled', ...p })

describe('patients: balance', () => {
  it('sums billable invoices minus payments, ignoring drafts and cancelled invoices', () => {
    const invoices = [inv({ total: 100 }), inv({ total: 50, status: 'partial' }), inv({ total: 30, status: 'paid' }), inv({ total: 999, status: 'draft' }), inv({ total: 500, status: 'cancelled' })]
    expect(patientBalance(invoices, [pay({ amount: 60 }), pay({ amount: 20 })])).toBe(100)
    expect(patientBalance([], [])).toBe(0)
    expect(patientBalance([], [pay({ amount: 25 })])).toBe(-25)           // credit on account
    expect(patientBalance([inv({ total: 10 })], [pay({ amount: 15 }), pay({ amount: -5 })])).toBe(0) // refund is a negative payment
    expect(patientBalance([inv({ total: 0.1 }), inv({ total: 0.2 })], [])).toBe(0.3) // no float dust
  })
  it('computes every patient at once', () => {
    const m = balancesByPatient(
      [inv({ patientId: 'a', total: 100 }), inv({ patientId: 'b', total: 40 }), inv({ patientId: 'c', total: 70, status: 'draft' })],
      [pay({ patientId: 'a', amount: 30 }), pay({ patientId: 'd', amount: 10 })],
    )
    expect(m.get('a')).toBe(70)
    expect(m.get('b')).toBe(40)
    expect(m.get('c')).toBeUndefined()
    expect(m.get('d')).toBe(-10)
    expect(owes(m.get('a'))).toBe(true)
    expect(owes(m.get('d'))).toBe(false)
    expect(owes(undefined)).toBe(false)
    expect(owes(0.001)).toBe(false)
  })
})

describe('patients: visits and appointments', () => {
  const now = '2026-10-10T12:00:00.000Z'
  it('last visit is the latest attended appointment that is not in the future', () => {
    const m = lastVisitsByPatient([
      apt({ patientId: 'a', start: '2026-09-01T09:00:00.000Z', status: 'completed' }),
      apt({ patientId: 'a', start: '2026-10-01T09:00:00.000Z', status: 'completed' }),
      apt({ patientId: 'a', start: '2026-10-05T09:00:00.000Z', status: 'cancelled' }),
      apt({ patientId: 'a', start: '2026-10-20T09:00:00.000Z', status: 'completed' }), // future: ignored
      apt({ patientId: 'b', start: '2026-10-10T08:00:00.000Z', status: 'arrived' }),
      apt({ patientId: 'c', start: '2026-10-09T08:00:00.000Z', status: 'no_show' }),
    ], now)
    expect(m.get('a')).toBe('2026-10-01T09:00:00.000Z')
    expect(m.get('b')).toBe('2026-10-10T08:00:00.000Z')
    expect(m.has('c')).toBe(false)
    expect(latestOf(undefined, '2026-01-01', '2025-01-01')).toBe('2026-01-01')
    expect(latestOf(undefined, undefined)).toBeUndefined()
  })
  it('next appointment skips the past, cancelled and no-show', () => {
    const list = [
      apt({ start: '2026-10-09T09:00:00.000Z' }),
      apt({ start: '2026-10-11T09:00:00.000Z', status: 'cancelled' }),
      apt({ start: '2026-10-13T09:00:00.000Z', status: 'confirmed' }),
      apt({ start: '2026-10-12T09:00:00.000Z', status: 'no_show' }),
      apt({ start: '2026-10-15T09:00:00.000Z' }),
    ]
    expect(nextAppointment(list, now)?.start).toBe('2026-10-13T09:00:00.000Z')
    expect(upcomingAppointments(list, now).map(a => a.start)).toEqual(['2026-10-13T09:00:00.000Z', '2026-10-15T09:00:00.000Z'])
    expect(nextAppointment([], now)).toBeUndefined()
  })
})

describe('patients: search', () => {
  const p = pt({ name: 'أحمد محمود الخطيب', phone: '0944123456', phone2: '+963 933 111 222', fileNo: 128, nationalId: '01020304050', email: 'Ahmad@Mail.com' })
  it('matches names Arabic-aware (hamza, ta marbuta, tashkeel) and word by word', () => {
    expect(fullSearch(p, 'احمد')).toBe(true)
    expect(fullSearch(p, 'أَحْمَد')).toBe(true)
    expect(fullSearch(p, 'الخطيب احمد')).toBe(true)
    expect(fullSearch(p, 'سعيد')).toBe(false)
    expect(fullSearch(pt({ name: 'فاطمة' }), 'فاطمه')).toBe(true)
    expect(fullSearch(p, '')).toBe(true)
    expect(fullSearch(p, '   ')).toBe(true)
  })
  it('matches phones on digits, file numbers and national id', () => {
    expect(fullSearch(p, '0944')).toBe(true)
    expect(fullSearch(p, '0944 123 456')).toBe(true)
    expect(fullSearch(p, '٠٩٤٤')).toBe(true)               // Arabic-Indic digits
    expect(fullSearch(p, '933111')).toBe(true)              // second phone
    expect(fullSearch(p, '128')).toBe(true)
    expect(fullSearch(p, '#128')).toBe(true)
    expect(fullSearch(p, '12')).toBe(true)                  // file-number prefix
    expect(fullSearch(p, '77')).toBe(false)                 // too short to search phones
    expect(fullSearch(p, '0102030')).toBe(true)
    expect(fullSearch(p, 'ahmad@mail')).toBe(true)
    expect(fullSearch(p, 'احمد 0944')).toBe(true)
    expect(fullSearch(p, 'احمد 0955')).toBe(false)
  })
})

describe('patients: filters, sorting, stats', () => {
  const list = [
    pt({ id: 'a', fileNo: 1, name: 'بشير', gender: 'male', doctorId: 'd1', tags: ['VIP'], createdAt: '2026-10-02T10:00:00.000Z' }),
    pt({ id: 'b', fileNo: 2, name: 'آمنة', gender: 'female', doctorId: 'd2', tags: ['تقويم'], createdAt: '2026-08-02T10:00:00.000Z', lastVisit: '2026-09-01T10:00:00.000Z' }),
    pt({ id: 'c', fileNo: 3, name: 'جميل', gender: 'male', archived: true, createdAt: '2026-10-03T10:00:00.000Z' }),
    pt({ id: 'd', fileNo: 4, name: 'دانة', gender: 'female', tags: ['VIP', 'تأمين'], createdAt: '2026-09-15T10:00:00.000Z' }),
  ]
  const balances = new Map([['a', 50], ['b', 0], ['c', 80], ['d', 120]])
  const lastVisits = new Map([['a', '2026-10-01T10:00:00.000Z'], ['b', '2026-08-01T10:00:00.000Z']])
  const monthStart = '2026-10-01T00:00:00.000Z'
  const ids = (l: Patient[]) => l.map(p => p.id)
  it('filters by archive view, gender, doctor, tag, quick filters and text', () => {
    const f = DEFAULT_FILTERS
    expect(ids(filterPatients(list, f, { balances, monthStart }))).toEqual(['a', 'b', 'd'])
    expect(ids(filterPatients(list, { ...f, archived: true }, { balances, monthStart }))).toEqual(['c'])
    expect(ids(filterPatients(list, { ...f, gender: 'female' }, { balances, monthStart }))).toEqual(['b', 'd'])
    expect(ids(filterPatients(list, { ...f, doctorId: 'd1' }, { balances, monthStart }))).toEqual(['a'])
    expect(ids(filterPatients(list, { ...f, tag: 'VIP' }, { balances, monthStart }))).toEqual(['a', 'd'])
    expect(ids(filterPatients(list, { ...f, quick: 'new' }, { balances, monthStart }))).toEqual(['a'])
    expect(ids(filterPatients(list, { ...f, quick: 'balance' }, { balances, monthStart }))).toEqual(['a', 'd'])
    expect(ids(filterPatients(list, { ...f, q: 'امنه' }, { balances, monthStart }))).toEqual(['b'])
    expect(hasActiveFilters(f)).toBe(false)
    expect(hasActiveFilters({ ...f, archived: true })).toBe(false)
    expect(hasActiveFilters({ ...f, tag: 'VIP' })).toBe(true)
    expect(hasActiveFilters({ ...f, q: ' x ' })).toBe(true)
  })
  it('sorts by recency, name, last visit (stored or derived) and balance', () => {
    const active = list.filter(p => !p.archived)
    expect(ids(sortPatients(active, 'recent', { balances, lastVisits }))).toEqual(['a', 'd', 'b'])
    expect(ids(sortPatients(active, 'name', { balances, lastVisits }))).toEqual(['b', 'a', 'd'])
    expect(ids(sortPatients(active, 'lastVisit', { balances, lastVisits }))).toEqual(['a', 'b', 'd'])
    expect(ids(sortPatients(active, 'balance', { balances, lastVisits }))).toEqual(['d', 'a', 'b'])
    expect(ids(active)).toEqual(['a', 'b', 'd'])                 // input untouched
  })
  it('counts stats over active files only', () => {
    expect(patientStats(list, balances, monthStart)).toEqual({ total: 3, newThisMonth: 1, withBalance: 2 })
    expect(patientStats([], balances, monthStart)).toEqual({ total: 0, newThisMonth: 0, withBalance: 0 })
    expect(monthStartISO(new Date(2026, 9, 10, 15))).toBe(new Date(2026, 9, 1).toISOString())
  })
  it('lists tags and medical flags', () => {
    expect(allTags(list)).toEqual(['تأمين', 'تقويم', 'VIP'])
    expect(allTags(list, 'en')).toEqual(['VIP', 'تأمين', 'تقويم'])
    expect(medicalFlags({ allergies: ['بنسلين'], chronicDiseases: [], medications: [] })).toEqual({ allergies: true, chronic: false, medications: false, any: true })
    expect(medicalFlags({}).any).toBe(false)
  })
})

describe('patients: validation', () => {
  const today = '2026-10-10'
  it('phones', () => {
    expect(isValidPhone('0944123456')).toBe(true)
    expect(isValidPhone('+963 944 123 456')).toBe(true)
    expect(isValidPhone('0944-123-456')).toBe(true)
    expect(isValidPhone('٠٩٤٤١٢٣٤٥٦')).toBe(true)
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('09441234567890123')).toBe(false)
    expect(isValidPhone('0944abc456')).toBe(false)
    expect(isValidPhone('09+44123456')).toBe(false)
    expect(isValidPhone('')).toBe(false)
    expect(sanitizePhoneInput('٠٩٤٤ abc+12')).toBe('0944 12')
    expect(sanitizePhoneInput('+963-944')).toBe('+963-944')
    expect(cleanPhone(' +963 944-123 456 ')).toBe('+963944123456')
    expect(cleanPhone('0944 123 456')).toBe('0944123456')
    expect(digitsOnly('+٩٦٣ 944')).toBe('963944')
  })
  it('emails and dates', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('name.surname@clinic.sy')).toBe(true)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
    expect(isRealDate('2024-02-29')).toBe(true)
    expect(isRealDate('2026-02-29')).toBe(false)
    expect(isRealDate('2026-1-1')).toBe(false)
  })
  it('the whole form', () => {
    expect(validatePatient({ name: 'سامر', phone: '0944123456' }, today)).toEqual({})
    expect(validatePatient({ name: '', phone: '' }, today)).toEqual({ name: 'v.required', phone: 'v.required' })
    expect(validatePatient({ name: ' س ', phone: '12' }, today)).toEqual({ name: 'patients.v.nameShort', phone: 'v.phone' })
    expect(validatePatient({ name: 'سامر', phone: '0944123456', phone2: 'x', email: 'bad', birthDate: '2030-01-01' }, today))
      .toEqual({ phone2: 'v.phone', email: 'v.email', birthDate: 'patients.v.futureDate' })
    expect(validatePatient({ name: 'سامر', phone: '0944123456', birthDate: '1850-01-01' }, today)).toEqual({ birthDate: 'v.date' })
    expect(validatePatient({ name: 'سامر', phone: '0944123456', birthDate: today }, today)).toEqual({})
  })
  it('finds a duplicate phone on digits, excluding the patient being edited', () => {
    const list = [pt({ id: 'a', name: 'أ', phone: '0944 123 456' }), pt({ id: 'b', name: 'ب', phone: '0933000000', phone2: '0955111222' })]
    expect(findDuplicatePhone(list, '0944123456')?.id).toBe('a')
    expect(findDuplicatePhone(list, '0944123456', 'a')).toBeUndefined()
    expect(findDuplicatePhone(list, '0955-111-222')?.id).toBe('b')
    expect(findDuplicatePhone(list, '094')).toBeUndefined()
  })
})

describe('patients: chips and plurals', () => {
  it('adds comma-separated chips without duplicates', () => {
    expect(addChips([], 'بنسلين')).toEqual(['بنسلين'])
    expect(addChips(['بنسلين'], ' لاتكس ، أسبرين,بنسلين ')).toEqual(['بنسلين', 'لاتكس', 'أسبرين'])
    expect(addChips(['أسبرين'], 'اسبرين')).toEqual(['أسبرين'])
    expect(addChips(['a'], ' ,, ')).toEqual(['a'])
    expect(hasChip(['أسبرين'], 'اسبرين')).toBe(true)
    expect(removeChip(['a', 'b'], 'a')).toEqual(['b'])
  })
  it('follows the Arabic plural categories', () => {
    expect([0, 1, 2, 3, 10, 11, 99, 100, 101, 102, 103, 111, 1000].map(pluralForm))
      .toEqual(['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'other', 'other', 'other', 'few', 'many', 'other'])
  })
})

describe('patients: files and notes', () => {
  it('recognises shapes and guesses kinds', () => {
    expect(fileShape('image/jpeg', 'a.jpg')).toBe('image')
    expect(fileShape('', 'scan.PNG')).toBe('image')
    expect(fileShape('application/pdf', 'x')).toBe('pdf')
    expect(fileShape('', 'report.pdf')).toBe('pdf')
    expect(fileShape('application/zip', 'a.zip')).toBe('other')
    expect(guessKind('image/jpeg', 'OPG_2026.jpg')).toBe('xray')
    expect(guessKind('image/png', 'smile.png')).toBe('photo')
    expect(guessKind('application/pdf', 'consent-form.pdf')).toBe('consent')
    expect(guessKind('application/pdf', 'report.pdf')).toBe('document')
    expect(guessKind('text/plain', 'a.txt')).toBe('other')
  })
  it('validates FDI tooth numbers', () => {
    expect([11, 18, 28, 48, 51, 55, 85].every(isValidTooth)).toBe(true)
    expect([0, 10, 19, 49, 56, 86, 91, 11.5].some(isValidTooth)).toBe(false)
    expect(isValidTooth(null)).toBe(false)
  })
  it('counts by kind and sorts notes newest first', () => {
    expect(countByKind([{ kind: 'xray' }, { kind: 'xray' }, { kind: 'consent' }])).toEqual({ all: 3, xray: 2, photo: 0, document: 0, consent: 1, other: 0 })
    const notes = [
      { id: '1', date: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' },
      { id: '2', date: '2026-10-05', createdAt: '2026-10-05T09:00:00Z' },
      { id: '3', date: '2026-10-05', createdAt: '2026-10-05T11:00:00Z' },
    ]
    expect(sortNotes(notes).map(n => n.id)).toEqual(['3', '2', '1'])
  })
})
