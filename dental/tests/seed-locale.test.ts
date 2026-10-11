// The demo clinic in the clinic's language, lab costs recorded once as expenses, and sequential RX- / LAB- references.
import { db, ensureClinic, resetDatabase, updateClinic } from '../src/db'
import type { Expense, LabOrder, Prescription, User } from '../src/db/types'
import { hashPin } from '../src/lib/crypto'
import { loadDemoData, seedDefaults } from '../src/features/seed/demo'
import { toISODate } from '../src/lib/dates'

const ARABIC = /[؀-ۿ]/
const NOW = new Date(new Date().setHours(13, 0, 0, 0))
type Numbered = { number?: string }

async function clinicIn(lang: 'ar' | 'en'): Promise<void> {
  await resetDatabase()
  await ensureClinic()
  await updateClinic({ name: lang === 'en' ? 'Smile Dental Clinic' : 'عيادة الابتسامة', lang, setupDone: true })
  const at = '2025-01-01T08:00:00.000Z'
  const u: User = { id: 'u-admin', name: lang === 'en' ? 'Dr. Ahmad Khatib' : 'د. أحمد الخطيب', role: 'admin', pinHash: await hashPin('1234', 'qa'), pinSalt: 'qa', color: '#0E8F86', active: true, createdAt: at, updatedAt: at }
  await db.users.put(u)
}

describe('demo clinic in English', () => {
  beforeAll(async () => { await clinicIn('en'); await loadDemoData({ now: NOW }) }, 60_000)

  it('writes activity, invoice lines, plans, notes and prescriptions in English', async () => {
    const [activity, invoices, plans, items, apts, rx, notes, patients, expenses, drugs, stock] = await Promise.all([
      db.activity.toArray(), db.invoices.toArray(), db.plans.toArray(), db.treatments.toArray(), db.appointments.toArray(), db.prescriptions.toArray(),
      db.notes.toArray(), db.patients.toArray(), db.expenses.toArray(), db.drugs.toArray(), db.inventory.toArray(),
    ])
    const arabic = (list: (string | undefined)[]) => list.filter(s => s && ARABIC.test(s))
    expect(arabic(activity.map(a => a.message))).toEqual([])
    expect(arabic(invoices.flatMap(i => i.items.map(l => l.description)))).toEqual([])
    expect(arabic(plans.map(p => p.title))).toEqual([])
    expect(arabic(items.map(i => i.procedureName))).toEqual([])
    expect(arabic(apts.map(a => a.reason))).toEqual([])
    expect(arabic(notes.map(n => n.text))).toEqual([])
    expect(arabic(rx.flatMap(r => [r.diagnosis, r.notes, ...r.items.flatMap(i => [i.name, i.dose, i.frequency, i.duration, i.instructions])]))).toEqual([])
    expect(arabic(patients.flatMap(p => [p.name, p.address, p.occupation, p.notes, p.medicalNotes, p.referredBy, ...p.allergies, ...p.chronicDiseases, ...p.medications, ...p.tags]))).toEqual([])
    expect(arabic(expenses.flatMap(e => [e.description, e.vendor]))).toEqual([])
    expect(arabic(drugs.flatMap(d => [d.form, d.defaultDose, d.defaultFrequency, d.defaultDuration, d.defaultInstructions, d.strength]))).toEqual([])
    expect(arabic(stock.flatMap(i => [i.name, i.supplier, i.location]))).toEqual([])
  })
})

describe('lab costs and references in the demo', () => {
  let labs: (LabOrder & Numbered)[], expenses: Expense[], rx: (Prescription & Numbered)[]
  beforeAll(async () => {
    await clinicIn('ar')
    await loadDemoData({ now: NOW })
    ;[labs, expenses, rx] = await Promise.all([db.labOrders.toArray(), db.expenses.toArray(), db.prescriptions.toArray()])
  }, 60_000)

  it('records each received order once as a lab expense, linked both ways', () => {
    const received = labs.filter(o => (o.status === 'received' || o.status === 'fitted') && o.cost > 0)
    expect(received.length).toBeGreaterThan(3)
    for (const o of received) {
      const e = expenses.find(x => x.id === o.expenseId)!
      expect(e).toMatchObject({ category: 'lab', amount: o.cost, date: o.receivedDate, labOrderId: o.id, vendor: o.labName })
      expect(e.description).toContain(o.number!)
    }
    expect(expenses.filter(e => e.labOrderId).length).toBe(received.length)
    for (const o of labs.filter(x => x.status !== 'received' && x.status !== 'fitted')) expect(o.expenseId).toBeUndefined()
    // months covered by lab orders get no extra settlement: lab costs are not counted twice
    const months = new Set(received.map(o => o.receivedDate!.slice(0, 7)))
    expect(expenses.some(e => e.category === 'lab' && !e.labOrderId && months.has(e.date.slice(0, 7)))).toBe(false)
  })
  it('numbers prescriptions and lab orders in the order they were written, and the counters continue from there', async () => {
    const check = (list: ({ createdAt: string } & Numbered)[], prefix: string) => {
      const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      sorted.forEach((x, i) => expect(x.number).toBe(`${prefix}${String(i + 1).padStart(6, '0')}`))
    }
    check(rx, 'RX-')
    check(labs, 'LAB-')
    expect((await db.settings.get('counter.rx'))?.value).toBe(rx.length + 1)
    expect((await db.settings.get('counter.lab'))?.value).toBe(labs.length + 1)
  })
})

describe('seedDefaults in an English clinic', () => {
  it('writes the drug defaults in English', async () => {
    await clinicIn('en')
    await seedDefaults()
    const drugs = await db.drugs.toArray()
    const amox = drugs.find(d => d.nameEn === 'Amoxicillin')!
    expect(amox).toMatchObject({ form: 'Capsules', defaultDose: '1 capsule', defaultFrequency: 'Every 8 hours', defaultDuration: '5 days' })
    expect(drugs.every(d => !ARABIC.test(`${d.form}${d.defaultDose}${d.defaultFrequency}${d.defaultDuration}${d.defaultInstructions}${d.strength}`))).toBe(true)
    expect(toISODate(NOW)).toMatch(/^\d{4}/)
  })
})
