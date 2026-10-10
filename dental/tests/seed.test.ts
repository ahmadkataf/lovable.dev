import 'fake-indexeddb/auto'
import { db, ensureClinic, getClinic, resetDatabase, updateClinic } from '../src/db'
import { PROCEDURE_CATEGORIES } from '../src/db/types'
import type { Appointment, ClinicalNote, Expense, Invoice, LabOrder, Patient, Payment, Prescription, StockMovement, ToothRecord, TreatmentItem, TreatmentPlan, User } from '../src/db/types'
import { hashPin, verifyPin } from '../src/lib/crypto'
import { addDays, addMonths, startOfMonth, timeToMinutes, toISODate } from '../src/lib/dates'
import { todayISO } from '../src/db/ids'
import { round2 } from '../src/lib/format'
import { DEFAULT_DRUGS, DEFAULT_INVENTORY, DEFAULT_PROCEDURES, scalePrice } from '../src/features/seed/catalog'
import { DEMO_PIN, loadDemoData, seedDefaults, type DemoCounts } from '../src/features/seed/demo'
import { mulberry32, Rng } from '../src/features/seed/rng'
import { DEMO_STEPS } from '../src/features/seed/demo'
import seedStrings from '../src/i18n/modules/seed'
import { translate } from '../src/i18n'

/**
 * Generate around 13:00 today, so today's schedule has finished, current and coming visits whatever the real time.
 * SEED_NOW=2026-10-16T08:00 npx vitest run tests/seed.test.ts — replays the suite at another moment.
 */
const NOW = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date(new Date().setHours(13, 0, 0, 0))
const TODAY = toISODate(NOW)
const ARABIC = /[\u0600-\u06FF]/
/** The demo's clock for today's schedule: now, but no later than 15:30 (an evening demo still shows a working day). */
const REF = Math.min(NOW.getTime(), new Date(NOW).setHours(15, 30, 0, 0))
const localDate = (iso: string) => toISODate(new Date(iso))
const localMinutes = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }

async function addUser(name: string, role: User['role'], specialty?: string): Promise<User> {
  const at = '2025-01-01T08:00:00.000Z'
  const u: User = { id: `u-${role}-${name.length}`, name, role, pinHash: await hashPin('1234', 'qa'), pinSalt: 'qa', color: '#0E8F86', specialty, active: true, createdAt: at, updatedAt: at }
  await db.users.put(u)
  return u
}
/** The same starting point as the QA helper: an admin dentist and a receptionist. */
async function freshClinic(): Promise<void> {
  await resetDatabase()
  await ensureClinic()
  await updateClinic({ name: 'عيادة الابتسامة لطب الأسنان', setupDone: true })
  await addUser('د. أحمد الخطيب', 'admin', 'طب الأسنان العام')
  await addUser('سارة يوسف', 'receptionist')
}

describe('seed: PRNG', () => {
  it('mulberry32 is deterministic and uniform enough', () => {
    const a = mulberry32(42), b = mulberry32(42)
    const xs = Array.from({ length: 1000 }, () => a())
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()))
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThan(1)
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean).toBeGreaterThan(0.45); expect(mean).toBeLessThan(0.55)
  })
  it('helpers stay in range', () => {
    const r = new Rng(7)
    for (let i = 0; i < 500; i++) {
      const n = r.int(3, 5); expect(n).toBeGreaterThanOrEqual(3); expect(n).toBeLessThanOrEqual(5)
    }
    expect(r.sample([1, 2, 3, 4, 5], 3)).toHaveLength(3)
    expect(new Set(r.sample([1, 2, 3, 4, 5], 5)).size).toBe(5)
    expect(r.weighted([['a', 0], ['b', 1]])).toBe('b')
  })
})

describe('seed: strings', () => {
  it('ar and en have the same keys, and every progress step has a label', () => {
    expect(Object.keys(seedStrings.ar).sort()).toEqual(Object.keys(seedStrings.en).sort())
    for (const step of DEMO_STEPS) for (const lang of ['ar', 'en'] as const) expect(seedStrings[lang][`step.${step}`]).toBeTruthy()
    expect(translate('ar', 'seed.summary', { patients: 60, appointments: 300, invoices: 200, payments: 250 })).toBe('المرضى: 60 · المواعيد: 300 · الفواتير: 200 · الدفعات: 250')
    expect(translate('en', 'seed.step.billing')).toBe('Issuing invoices and recording payments')
  })
})

describe('seed: default catalogue', () => {
  beforeEach(async () => { await resetDatabase(); await ensureClinic() })

  it('seedDefaults twice yields no duplicates', async () => {
    const first = await seedDefaults()
    expect(first).toEqual({ procedures: DEFAULT_PROCEDURES.length, drugs: DEFAULT_DRUGS.length, inventory: DEFAULT_INVENTORY.length })
    const second = await seedDefaults()
    expect(second).toEqual({ procedures: 0, drugs: 0, inventory: 0 })
    const [procs, drugs, items, moves] = await Promise.all([db.procedures.toArray(), db.drugs.toArray(), db.inventory.toArray(), db.stock.toArray()])
    expect(procs).toHaveLength(DEFAULT_PROCEDURES.length)
    expect(drugs).toHaveLength(DEFAULT_DRUGS.length)
    expect(items).toHaveLength(DEFAULT_INVENTORY.length)
    expect(new Set(procs.map(p => p.code)).size).toBe(procs.length)
    expect(new Set(procs.map(p => p.name)).size).toBe(procs.length)
    expect(new Set(drugs.map(d => `${d.name}|${d.strength}`)).size).toBe(drugs.length)
    expect(new Set(items.map(i => i.name)).size).toBe(items.length)
    // the opening quantity is an 'initial' movement, as the inventory screen records it
    expect(moves).toHaveLength(items.length)
    for (const i of items) expect(moves.find(m => m.itemId === i.id)).toMatchObject({ reason: 'initial', delta: i.quantity })
  })

  it('skips only the tables that already have rows, and honours the options', async () => {
    await db.procedures.add({ id: 'mine', name: 'إجراء خاص', category: 'other', price: 5, toothSpecific: false, active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
    const out = await seedDefaults({ inventory: false })
    expect(out).toEqual({ procedures: 0, drugs: DEFAULT_DRUGS.length, inventory: 0 })
    expect(await db.procedures.count()).toBe(1)
    expect(await db.inventory.count()).toBe(0)
  })

  it('procedures: ~70 with Arabic and English names, every category, regional prices', async () => {
    await seedDefaults()
    const procs = await db.procedures.toArray()
    expect(procs.length).toBeGreaterThanOrEqual(65)
    for (const p of procs) {
      expect(p.name).toMatch(ARABIC)
      expect(p.nameEn).toMatch(/[A-Za-z]/)
      expect(p.price).toBeGreaterThan(0)
      expect(p.durationMin).toBeGreaterThan(0)
      expect(p.active).toBe(true)
      expect(typeof p.sortOrder).toBe('number')
    }
    for (const c of PROCEDURE_CATEGORIES) expect(procs.some(p => p.category === c)).toBe(true)
    const price = (code: string) => procs.find(p => p.code === code)!.price
    const within = (code: string, lo: number, hi: number) => { expect(price(code)).toBeGreaterThanOrEqual(lo); expect(price(code)).toBeLessThanOrEqual(hi) }
    within('D9310', 10, 20); within('D0150', 10, 20)
    within('D1110', 30, 60)
    for (const c of ['D2391', 'D2392', 'D2393', 'D2394']) within(c, 30, 80)
    expect(price('D2391')).toBeLessThan(price('D2393'))
    within('D3310', 100, 250); within('D3330', 100, 250); expect(price('D3310')).toBeLessThan(price('D3330'))
    within('D2740', 200, 400)
    within('D7140', 25, 80); within('D7210', 25, 80)
    within('D6010', 500, 900)
    within('D9972', 150, 300)
    within('D8090', 1000, 2000)
    within('D2962', 250, 400)
    expect(procs.filter(p => p.category === 'pediatric').length).toBeGreaterThanOrEqual(5)
    expect(procs.find(p => p.code === 'D2392')!.toothSpecific).toBe(true)
    expect(procs.find(p => p.code === 'D1110')!.toothSpecific).toBe(false)
  })

  it('drugs: dentists\' usual prescriptions with Arabic defaults', async () => {
    await seedDefaults()
    const drugs = await db.drugs.toArray()
    expect(drugs.length).toBeGreaterThanOrEqual(30)
    for (const d of drugs) {
      expect(d.name).toMatch(ARABIC)
      for (const f of [d.form, d.defaultDose, d.defaultFrequency, d.defaultDuration, d.defaultInstructions]) expect(f).toMatch(ARABIC)
      expect(d.strength).toBeTruthy()
    }
    for (const en of ['Amoxicillin', 'Metronidazole (Flagyl)', 'Clindamycin', 'Azithromycin', 'Ibuprofen', 'Paracetamol', 'Diclofenac sodium', 'Ketoprofen', 'Chlorhexidine mouthwash',
      'Benzydamine mouthwash', 'Nystatin', 'Acyclovir', 'Dexamethasone', 'Hyaluronic acid gel', 'Fluoride gel', 'Sensitivity toothpaste']) expect(drugs.some(d => d.nameEn === en)).toBe(true)
    expect(drugs.find(d => d.nameEn === 'Amoxicillin' && d.strength === '500 mg')).toMatchObject({ defaultFrequency: 'كل 8 ساعات', defaultDuration: '5 أيام' })
  })

  it('inventory: units, minimums, some low stock and one near expiry', async () => {
    await seedDefaults()
    const items = await db.inventory.toArray()
    expect(items.length).toBeGreaterThanOrEqual(25)
    const low = items.filter(i => i.quantity <= i.minQuantity)
    expect(low.length).toBeGreaterThanOrEqual(3)
    expect(low.length).toBeLessThan(items.length / 2)
    const soon = items.filter(i => i.expiryDate && i.expiryDate <= addDays(todayISO(), 60))
    expect(soon).toHaveLength(1)
    for (const i of items) {
      expect(['piece', 'box', 'pack', 'ml', 'g', 'other']).toContain(i.unit)
      expect(['consumables', 'instruments', 'materials', 'medications', 'office', 'equipment']).toContain(i.category)
      expect(i.costPrice).toBeGreaterThan(0)
    }
  })

  it('scales prices for currencies pegged to the dollar', async () => {
    expect(scalePrice(15, 'USD')).toBe(15)
    expect(scalePrice(15, 'SAR')).toBe(55)
    expect(scalePrice(280, 'SAR') % 5).toBe(0)
    expect(scalePrice(15, 'XYZ')).toBe(15)
    await updateClinic({ currency: 'SAR', currencySymbol: 'ر.س' })
    await seedDefaults()
    const consult = (await db.procedures.toArray()).find(p => p.code === 'D9310')!
    expect(consult.price).toBe(55)
  })
})

describe('seed: demo data', () => {
  let counts: DemoCounts
  let users: User[], patients: Patient[], apts: Appointment[], plans: TreatmentPlan[], items: TreatmentItem[], invoices: Invoice[], payments: Payment[]
  let teeth: ToothRecord[], rx: Prescription[], labs: LabOrder[], stock: StockMovement[], expenses: Expense[], notes: ClinicalNote[]

  beforeAll(async () => {
    await freshClinic()
    counts = await loadDemoData({ now: NOW })
    ;[users, patients, apts, plans, items, invoices, payments, teeth, rx, labs, stock, expenses, notes] = await Promise.all([
      db.users.toArray(), db.patients.toArray(), db.appointments.toArray(), db.plans.toArray(), db.treatments.toArray(), db.invoices.toArray(), db.payments.toArray(),
      db.teeth.toArray(), db.prescriptions.toArray(), db.labOrders.toArray(), db.stock.toArray(), db.expenses.toArray(), db.notes.toArray(),
    ])
  }, 60_000)

  it('returns counts that match the tables', async () => {
    expect(counts.skipped).toBe(false)
    expect(counts.patients).toBe(60)
    expect(patients).toHaveLength(60)
    expect(apts).toHaveLength(counts.appointments)
    expect(counts.appointments).toBeGreaterThanOrEqual(270)
    expect(counts.appointments).toBeLessThanOrEqual(330)
    expect(invoices).toHaveLength(counts.invoices)
    expect(payments).toHaveLength(counts.payments)
    expect(counts.labOrders).toBeGreaterThanOrEqual(8)
    expect(counts.labOrders).toBeLessThanOrEqual(20)
    expect(counts.expenses).toBeGreaterThanOrEqual(70)
    expect(counts.expenses).toBeLessThanOrEqual(90)
    expect(counts.prescriptions).toBeGreaterThan(20)
    expect(counts.notes).toBeGreaterThan(30)
    expect(counts.activity).toBeGreaterThan(50)
    expect(await db.activity.count()).toBe(counts.activity)
    expect(counts.ms).toBeLessThan(20_000)
  })

  it('creates the two demo doctors with PIN 1234 when the clinic has fewer than two', async () => {
    const created = users.filter(u => u.name === 'د. ليلى حداد' || u.name === 'د. سامر عبود')
    expect(created).toHaveLength(2)
    expect(counts.users).toBe(2)
    for (const u of created) {
      expect(u.role).toBe('doctor')
      expect(await verifyPin(DEMO_PIN, u.pinSalt, u.pinHash)).toBe(true)
    }
    expect(created.find(u => u.name === 'د. ليلى حداد')!.specialty).toContain('تقويم')
  })

  it('every appointment has an existing patient and doctor, inside working hours and the window', () => {
    const pid = new Set(patients.map(p => p.id))
    const doctors = new Set(users.filter(u => u.role === 'doctor' || u.role === 'admin').map(u => u.id))
    for (const a of apts) {
      expect(pid.has(a.patientId)).toBe(true)
      expect(doctors.has(a.doctorId)).toBe(true)
      expect(localDate(a.start)).toBe(a.date)
      expect(localMinutes(a.start)).toBeGreaterThanOrEqual(timeToMinutes('09:00'))
      expect(localMinutes(a.end)).toBeLessThanOrEqual(timeToMinutes('18:00'))
      expect(localMinutes(a.start) % 30).toBe(0)
      expect((Date.parse(a.end) - Date.parse(a.start)) / 60_000).toBe(a.durationMin)
      expect(a.date >= addDays(TODAY, -90) && a.date <= addDays(TODAY, 21)).toBe(true)
      expect(a.createdAt <= a.updatedAt).toBe(true)
      expect(Date.parse(a.createdAt)).toBeLessThan(Date.parse(a.start))
      expect(Date.parse(a.createdAt)).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('no overlapping appointments per doctor, and one visit per patient per day', () => {
    const byDoctor = new Map<string, Appointment[]>()
    for (const a of apts) byDoctor.set(a.doctorId, [...(byDoctor.get(a.doctorId) ?? []), a])
    for (const list of byDoctor.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start))
      for (let i = 1; i < list.length; i++) expect(Date.parse(list[i].start)).toBeGreaterThanOrEqual(Date.parse(list[i - 1].end))
    }
    const days = apts.map(a => `${a.patientId}|${a.date}`)
    expect(new Set(days).size).toBe(days.length)
  })

  it('statuses follow the calendar: past done, today mixed, future booked', () => {
    for (const a of apts) {
      if (a.date < TODAY) expect(['completed', 'cancelled', 'no_show']).toContain(a.status)
      if (a.date > TODAY) expect(['scheduled', 'confirmed', 'cancelled']).toContain(a.status)
    }
    const today = apts.filter(a => a.date === TODAY)
    expect(today.length).toBeGreaterThanOrEqual(8)
    const st = new Set(today.map(a => a.status))
    if (REF >= new Date(NOW).setHours(11, 0, 0, 0)) {
      expect(st.has('completed')).toBe(true)
      expect(st.has('scheduled') || st.has('confirmed')).toBe(true)
      expect(today.some(a => a.status === 'arrived' || a.status === 'in_progress')).toBe(true)
    }
    for (const a of today) {
      if (a.status === 'completed') expect(Date.parse(a.end)).toBeLessThanOrEqual(REF)
      if (a.status === 'scheduled' || a.status === 'confirmed') expect(Date.parse(a.start)).toBeGreaterThan(REF)
    }
    const past = apts.filter(a => a.date < TODAY)
    expect(past.filter(a => a.status === 'completed').length / past.length).toBeGreaterThan(0.75)
    expect(past.some(a => a.status === 'cancelled')).toBe(true)
    expect(past.some(a => a.status === 'no_show')).toBe(true)
    expect(apts.filter(a => a.date > TODAY).length).toBeGreaterThanOrEqual(25)
    expect(new Set(apts.map(a => a.type)).size).toBeGreaterThanOrEqual(7)
  })

  it('invoice totals equal the sum of their items, and paid equals the sum of their payments', () => {
    for (const inv of invoices) {
      for (const it of inv.items) expect(it.total).toBe(round2(it.qty * it.unitPrice - it.discount))
      const subtotal = round2(inv.items.reduce((a, i) => a + i.total, 0))
      expect(inv.subtotal).toBe(subtotal)
      expect(inv.total).toBe(round2(subtotal - inv.discount + inv.tax))
      expect(inv.total).toBeGreaterThan(0)
      const paid = round2(payments.filter(p => p.invoiceId === inv.id).reduce((a, p) => a + p.amount, 0))
      expect(inv.paid).toBe(paid)
    }
  })

  it('invoice statuses are consistent with the money', () => {
    for (const inv of invoices) {
      if (inv.status === 'draft') { expect(inv.number).toBe('DRAFT'); expect(inv.paid).toBe(0); continue }
      if (inv.status === 'cancelled') { expect(inv.paid).toBe(0); continue }
      if (inv.paid >= inv.total - 0.005) expect(inv.status).toBe('paid')
      else if (inv.paid > 0.005) expect(inv.status).toBe('partial')
      else expect(inv.status).toBe('unpaid')
    }
    const st = new Set(invoices.map(i => i.status))
    for (const s of ['paid', 'partial', 'unpaid', 'draft', 'cancelled'] as const) expect(st.has(s)).toBe(true)
    expect(invoices.filter(i => i.status === 'cancelled')).toHaveLength(1)
    expect(invoices.filter(i => i.status === 'draft').length).toBeGreaterThanOrEqual(1)
    expect(invoices.filter(i => i.status === 'draft').length).toBeLessThanOrEqual(4)
  })

  it('issued invoices are numbered in sequence and date order through the clinic counter', async () => {
    const issued = invoices.filter(i => i.status !== 'draft').sort((a, b) => a.number.localeCompare(b.number))
    issued.forEach((inv, i) => expect(inv.number).toBe(`INV-${String(i + 1).padStart(6, '0')}`))
    for (let i = 1; i < issued.length; i++) expect(issued[i].date >= issued[i - 1].date).toBe(true)
    expect((await getClinic()).nextInvoiceNumber).toBe(issued.length + 1)
  })

  it('payments come after their invoice, on or before today; some are on account', () => {
    const inv = new Map(invoices.map(i => [i.id, i]))
    for (const p of payments) {
      expect(p.amount).toBeGreaterThan(0)
      expect(p.date <= TODAY).toBe(true)
      expect(Date.parse(p.createdAt)).toBeLessThanOrEqual(NOW.getTime())
      if (!p.invoiceId) continue
      const i = inv.get(p.invoiceId)!
      expect(i).toBeTruthy()
      expect(p.patientId).toBe(i.patientId)
      expect(p.date >= i.date).toBe(true)
      expect(p.createdAt >= i.createdAt).toBe(true)
    }
    expect(payments.some(p => !p.invoiceId)).toBe(true)
    const methods = new Set(payments.map(p => p.method))
    for (const m of ['cash', 'card', 'transfer', 'insurance'] as const) expect(methods.has(m)).toBe(true)
  })

  it('treatment items with an invoice are on that invoice, billed on or after completion', () => {
    const inv = new Map(invoices.map(i => [i.id, i]))
    const aptById = new Map(apts.map(a => [a.id, a]))
    for (const t of items) {
      expect(t.createdAt <= t.updatedAt).toBe(true)
      if (t.status === 'completed') expect(t.completedAt).toBeTruthy()
      if (t.appointmentId) expect(aptById.get(t.appointmentId)?.patientId).toBe(t.patientId)
      if (!t.invoiceId) continue
      const i = inv.get(t.invoiceId)!
      expect(i.items.some(l => l.treatmentItemId === t.id)).toBe(true)
      expect(i.patientId).toBe(t.patientId)
      expect(i.status).not.toBe('cancelled')
      expect(t.status).toBe('completed')
      expect(i.date >= localDate(t.completedAt!)).toBe(true)
    }
    for (const s of ['planned', 'in_progress', 'completed', 'cancelled'] as const) expect(items.some(t => t.status === s)).toBe(true)
    expect(items.some(t => t.status === 'completed' && !t.invoiceId)).toBe(true)          // recent work not billed yet
  })

  it('plans: every status, consistent with their items, linked to doctors and appointments', () => {
    for (const s of ['draft', 'approved', 'in_progress', 'completed', 'cancelled'] as const) expect(plans.some(p => p.status === s)).toBe(true)
    for (const p of plans) {
      const its = items.filter(t => t.planId === p.id)
      expect(its.length).toBeGreaterThan(0)
      expect(p.doctorId).toBeTruthy()
      if (p.status === 'completed') expect(its.every(t => t.status === 'completed')).toBe(true)
      if (p.status === 'cancelled') expect(its.every(t => t.status === 'cancelled')).toBe(true)
      if (p.status === 'in_progress') expect(its.some(t => t.status === 'completed' || t.status === 'in_progress')).toBe(true)
    }
    expect(items.filter(t => t.planId && t.appointmentId).length).toBeGreaterThan(100)
    // orthodontic patients are followed by the orthodontist
    const leila = users.find(u => u.name === 'د. ليلى حداد')!
    const braces = plans.filter(p => p.title === 'تقويم ثابت للفكين')
    expect(braces.length).toBeGreaterThan(0)
    for (const p of braces) expect(p.doctorId).toBe(leila.id)
    expect(patients.filter(p => p.doctorId === leila.id).length).toBeGreaterThanOrEqual(braces.length)
  })

  it('patients: Levantine names, phones, ages 4–75, file numbers in registration order', async () => {
    const names = patients.map(p => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const p of patients) {
      expect(p.name).toMatch(ARABIC)
      expect(p.phone).toMatch(/^09\d{2} \d{3} \d{3}$/)
      expect(p.address).toMatch(/^(دمشق|ريف دمشق|حلب|حمص|اللاذقية) — /)
      expect(p.createdAt <= p.updatedAt).toBe(true)
      expect(p.photo).toBeUndefined()
      const age = new Date(TODAY).getFullYear() - new Date(p.birthDate!).getFullYear()
      expect(age).toBeGreaterThanOrEqual(4); expect(age).toBeLessThanOrEqual(76)
    }
    const kids = patients.filter(p => new Date(TODAY).getFullYear() - new Date(p.birthDate!).getFullYear() <= 12)
    expect(kids.length).toBeGreaterThanOrEqual(6)
    expect(kids.every(k => k.tags.includes('أطفال'))).toBe(true)
    const medical = patients.filter(p => p.allergies.length || p.chronicDiseases.length || p.medications.length)
    expect(medical.length / patients.length).toBeGreaterThan(0.12)
    expect(medical.length / patients.length).toBeLessThan(0.4)
    expect(patients.some(p => p.insuranceCompany && p.tags.includes('تأمين'))).toBe(true)
    expect(patients.some(p => p.tags.includes('VIP'))).toBe(true)
    expect(patients.some(p => p.referredBy)).toBe(true)
    // some patients registered recently, several of them this month (the dashboard's "new patients")
    expect(patients.filter(p => p.createdAt >= new Date(Date.parse(TODAY) - 30 * 86_400_000).toISOString()).length).toBeGreaterThanOrEqual(4)
    if (new Date(NOW).getDate() >= 8) expect(patients.filter(p => localDate(p.createdAt) >= startOfMonth(TODAY)).length).toBeGreaterThanOrEqual(2)
    // file numbers 1..60 follow the registration date; the clinic counter continues after them
    const byFile = [...patients].sort((a, b) => a.fileNo - b.fileNo)
    byFile.forEach((p, i) => expect(p.fileNo).toBe(i + 1))
    for (let i = 1; i < byFile.length; i++) expect(byFile[i].createdAt >= byFile[i - 1].createdAt).toBe(true)
    expect((await getClinic()).nextFileNumber).toBe(61)
  })

  it('patients: registered before their first booking; lastVisit is the latest completed visit', () => {
    for (const p of patients) {
      const mine = apts.filter(a => a.patientId === p.id)
      for (const a of mine) expect(p.createdAt <= a.createdAt).toBe(true)
      const done = mine.filter(a => a.status === 'completed').map(a => a.start).sort()
      expect(p.lastVisit).toBe(done.length ? done[done.length - 1] : undefined)
    }
  })

  it('dental chart: ~70% of patients, children on primary teeth, history kept', () => {
    const charted = new Set(teeth.map(t => t.patientId))
    expect(charted.size / patients.length).toBeGreaterThan(0.55)
    expect(charted.size / patients.length).toBeLessThan(0.9)
    const byId = new Map(items.map(t => [t.id, t]))
    const kids = new Set(patients.filter(p => new Date(TODAY).getFullYear() - new Date(p.birthDate!).getFullYear() <= 12).map(p => p.id))
    expect(teeth.some(t => kids.has(t.patientId) && t.tooth >= 51)).toBe(true)
    for (const t of teeth) {
      const q = Math.floor(t.tooth / 10), u = t.tooth % 10
      expect((q >= 1 && q <= 4 && u >= 1 && u <= 8) || (q >= 5 && q <= 8 && u >= 1 && u <= 5)).toBe(true)
      if (t.treatmentItemId) expect(byId.get(t.treatmentItemId)?.status).toBe('completed')
    }
    // no duplicate active findings on the same tooth
    const seen = new Set<string>()
    for (const t of teeth.filter(x => x.active)) {
      const k = `${t.patientId}|${t.tooth}|${t.condition}|${t.surfaces.join('')}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
    }
    for (const c of ['caries', 'filled', 'crown', 'missing', 'root_canal', 'implant', 'bridge'] as const) expect(teeth.some(t => t.condition === c)).toBe(true)
    expect(teeth.some(t => !t.active)).toBe(true)
  })

  it('prescriptions use the drug list and respect penicillin allergy', () => {
    const allergic = new Set(patients.filter(p => p.allergies.includes('البنسلين')).map(p => p.id))
    for (const r of rx) {
      expect(r.items.length).toBeGreaterThan(0)
      for (const i of r.items) { expect(i.dose).toBeTruthy(); expect(i.frequency).toBeTruthy(); expect(i.duration).toBeTruthy(); expect(i.drugId).toBeTruthy() }
      if (allergic.has(r.patientId)) for (const i of r.items) expect(i.name).not.toMatch(/أموكسيسيلين/)
    }
  })

  it('lab orders: crowns, bridges, aligners in various statuses, due around today', () => {
    const st = new Set(labs.map(l => l.status))
    expect(st.size).toBeGreaterThanOrEqual(5)
    for (const t of ['crown', 'aligner'] as const) expect(labs.some(l => l.type === t)).toBe(true)
    const open = labs.filter(l => !['fitted', 'cancelled'].includes(l.status))
    expect(open.length).toBeGreaterThanOrEqual(3)
    const days = (d: string) => Math.abs((Date.parse(d) - Date.parse(TODAY)) / 86_400_000)
    for (const l of open) if (l.dueDate) expect(days(l.dueDate)).toBeLessThanOrEqual(30)
    for (const l of labs) {
      if (l.dueDate) expect(days(l.dueDate)).toBeLessThanOrEqual(90)
      if (l.sentDate && l.receivedDate) expect(l.receivedDate >= l.sentDate).toBe(true)
      if (l.status === 'fitted' || l.status === 'received') expect(l.receivedDate).toBeTruthy()
      if (l.treatmentItemId) expect(items.some(t => t.id === l.treatmentItemId)).toBe(true)
      expect(l.cost).toBeGreaterThan(0)
    }
  })

  it('stock history sums to the current quantity and never goes negative', async () => {
    const inventory = await db.inventory.toArray()
    for (const item of inventory) {
      const moves = stock.filter(m => m.itemId === item.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      expect(moves.length).toBeGreaterThan(3)
      expect(round2(moves.reduce((a, m) => a + m.delta, 0))).toBe(item.quantity)
      let bal = 0
      for (const m of moves) { bal = round2(bal + m.delta); expect(bal).toBeGreaterThanOrEqual(0) }
      expect(item.createdAt <= item.updatedAt).toBe(true)
    }
    const reasons = new Set(stock.map(m => m.reason))
    for (const r of ['initial', 'purchase', 'use'] as const) expect(reasons.has(r)).toBe(true)
  })

  it('expenses: ~80 over six months, rent every month', () => {
    const from = addMonths(startOfMonth(TODAY), -5)
    for (const e of expenses) { expect(e.date >= from && e.date <= TODAY).toBe(true); expect(e.amount).toBeGreaterThan(0); expect(e.description).toMatch(ARABIC) }
    expect(new Set(expenses.map(e => e.date.slice(0, 7))).size).toBe(6)
    expect(expenses.filter(e => e.category === 'rent')).toHaveLength(6)
    for (const c of ['rent', 'salaries', 'materials', 'lab', 'utilities'] as const) expect(expenses.some(e => e.category === c)).toBe(true)
  })

  it('notes and the activity feed are Arabic and in the past', async () => {
    for (const n of notes) expect(n.text).toMatch(ARABIC)
    const act = await db.activity.toArray()
    for (const a of act) {
      expect(a.message).toMatch(ARABIC)
      expect(Date.parse(a.at)).toBeLessThanOrEqual(NOW.getTime())
      expect(Date.parse(a.at)).toBeGreaterThan(NOW.getTime() - 15 * 86_400_000)
    }
    expect(new Set(act.map(a => a.type)).size).toBeGreaterThanOrEqual(5)
    expect(act.some(a => a.type === 'invoice' && /INV-\d{6}/.test(a.message))).toBe(true)
  })

  it('every row has createdAt <= updatedAt', async () => {
    for (const rows of [patients, apts, plans, items, invoices, rx, labs, notes] as { createdAt: string; updatedAt: string }[][]) {
      for (const r of rows) expect(r.createdAt <= r.updatedAt).toBe(true)
    }
  })

  it('does nothing once the clinic has patients', async () => {
    const again = await loadDemoData({ now: NOW })
    expect(again.skipped).toBe(true)
    expect(await db.patients.count()).toBe(60)
    expect(await db.appointments.count()).toBe(apts.length)
  })
})

describe('seed: demo data is deterministic and additive', () => {
  const fingerprint = async () => {
    const pts = (await db.patients.orderBy('fileNo').toArray()).map(p => `${p.fileNo}:${p.name}:${p.birthDate}:${p.phone}`)
    const name = new Map((await db.patients.toArray()).map(p => [p.id, p.name]))
    const apts = (await db.appointments.toArray()).map(a => `${a.start}|${a.status}|${name.get(a.patientId)}|${a.reason}`).sort()
    const invs = (await db.invoices.toArray()).map(i => `${i.number}|${i.date}|${i.total}|${i.paid}|${i.status}|${name.get(i.patientId)}`).sort()
    return { pts, apts, invs }
  }

  it('the same day and the same clinic give the same data', async () => {
    await freshClinic(); await loadDemoData({ now: NOW })
    const a = await fingerprint()
    await freshClinic(); await loadDemoData({ now: NOW })
    const b = await fingerprint()
    expect(b.pts).toEqual(a.pts)
    expect(b.apts).toEqual(a.apts)
    expect(b.invs).toEqual(a.invs)
  }, 60_000)

  it('keeps existing rows, continues the counters and only adds the missing doctor', async () => {
    await resetDatabase(); await ensureClinic()
    await addUser('د. أحمد الخطيب', 'admin')
    await addUser('د. ليلى حداد', 'doctor', 'تقويم الأسنان')
    const at = '2026-01-05T10:00:00.000Z'
    for (const n of [1, 2]) await db.patients.add({ id: `p${n}`, fileNo: n, name: `مريض موجود ${n}`, gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: at, updatedAt: at })
    await updateClinic({ nextFileNumber: 3, nextInvoiceNumber: 41 })
    const out = await loadDemoData({ now: NOW })
    expect(out.skipped).toBe(false)
    expect(out.users).toBe(1)
    expect((await db.users.toArray()).filter(u => u.name === 'د. ليلى حداد')).toHaveLength(1)
    expect((await db.users.toArray()).some(u => u.name === 'د. سامر عبود')).toBe(true)
    expect(await db.patients.count()).toBe(62)
    expect(await db.patients.get('p1')).toBeTruthy()
    const files = (await db.patients.toArray()).map(p => p.fileNo).sort((a, b) => a - b)
    expect(files).toEqual(Array.from({ length: 62 }, (_, i) => i + 1))
    const numbers = (await db.invoices.toArray()).filter(i => i.status !== 'draft').map(i => i.number).sort()
    expect(numbers[0]).toBe('INV-000041')
    const c = await getClinic()
    expect(c.nextFileNumber).toBe(63)
    expect(c.nextInvoiceNumber).toBe(41 + numbers.length)
    // the orthodontic work goes to the orthodontist
    const leila = (await db.users.toArray()).find(u => u.name === 'د. ليلى حداد')!
    const ortho = (await db.appointments.toArray()).filter(a => a.type === 'orthodontic')
    expect(ortho.length).toBeGreaterThan(0)
    expect(ortho.every(a => a.doctorId === leila.id)).toBe(true)
  }, 60_000)

  it('reports progress through every step', async () => {
    await freshClinic()
    const steps: string[] = []
    await loadDemoData({ now: NOW, onProgress: s => steps.push(s) })
    expect(steps).toEqual(['defaults', 'staff', 'patients', 'schedule', 'billing', 'saving', 'done'])
  }, 60_000)
})
