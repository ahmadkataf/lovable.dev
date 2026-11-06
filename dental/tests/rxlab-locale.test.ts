// Prescriptions: drug-allergy warnings, the doctor's title, RX- references. Lab: one expense per received order,
// kept in step with the order, and LAB- references.
import { db, resetDatabase, ensureClinic } from '../src/db'
import type { Expense, LabOrder, Prescription } from '../src/db/types'
import { allergyConflicts, buildRxText, doctorLabel, drugClasses } from '../src/features/prescriptions/lib'
import { ensureRefs, formatRef, planNumbers, resetRefsCheck, takeRef } from '../src/features/prescriptions/numbers'
import { savePrescription } from '../src/features/prescriptions/actions'
import { deleteLabOrder, saveLabOrder, setLabStatus, type LabInput } from '../src/features/lab/actions'
import { labExpenseDue } from '../src/features/lab/lib'
import { translate } from '../src/i18n'

type N = { number?: string }

describe('drug–allergy warnings', () => {
  it('maps drugs and allergies to their families in Arabic and English', () => {
    expect(drugClasses('أموكسيسيلين 500')).toEqual(['penicillin'])
    expect(drugClasses('Amoxicillin + Clavulanate (Augmentin)')).toEqual(['penicillin'])
    expect(drugClasses('البنسلين')).toEqual(['penicillin'])
    expect(drugClasses('الأسبرين')).toEqual(['nsaid'])
    expect(drugClasses('إيبوبروفين شراب للأطفال')).toEqual(['nsaid'])
    expect(drugClasses('ليدوكائين جل موضعي')).toEqual(['localAnaesthetic'])
    expect(drugClasses('Sulfa drugs')).toEqual(['sulfonamide'])
    // a sulfate salt is not a sulfa drug
    expect(drugClasses('Morphine sulfate')).toEqual(['opioid'])
    expect(drugClasses('كبريتات الحديد سلفات')).toEqual([])
    expect(drugClasses('اللاتكس')).toEqual([])
  })
  it('flags a medicine that conflicts with an allergy on the file, and penicillin → cephalosporin cross-reactions', () => {
    const amox = { name: 'أموكسيسيلين', drug: { name: 'أموكسيسيلين', nameEn: 'Amoxicillin' } }
    expect(allergyConflicts(amox, ['بنسلين'])).toEqual([{ allergy: 'بنسلين', drug: 'أموكسيسيلين', cls: 'penicillin' }])
    expect(allergyConflicts(amox, ['البنسلين', 'اللاتكس'])).toHaveLength(1)
    expect(allergyConflicts({ name: 'Augmentin 1 g' }, ['Penicillin'])[0].cls).toBe('penicillin')
    expect(allergyConflicts({ name: 'Ibuprofen 400 mg' }, ['الأسبرين'])[0].cls).toBe('nsaid')
    expect(allergyConflicts({ name: 'Diclofenac sodium' }, ['مضادات الالتهاب'])[0].cls).toBe('nsaid')
    expect(allergyConflicts({ name: 'سيفالكسين' }, ['البنسلين'])).toEqual([{ allergy: 'البنسلين', drug: 'سيفالكسين', cls: 'cephalosporin', related: true }])
    // the allergy names this very drug, even when the app knows no family for it
    expect(allergyConflicts({ name: 'Benzydamine mouthwash' }, ['Benzydamine'])).toHaveLength(1)
    // no conflict
    expect(allergyConflicts({ name: 'Paracetamol' }, ['البنسلين', 'الأسبرين'])).toEqual([])
    expect(allergyConflicts({ name: 'Clindamycin' }, ['Penicillin'])).toEqual([])
    expect(allergyConflicts({ name: '' }, ['Penicillin'])).toEqual([])
    expect(translate('ar', 'prescriptions.allergy.family', { allergy: 'البنسلين', family: translate('ar', 'prescriptions.family.penicillin') })).toBe('يتعارض مع تحسس المريض من «البنسلين» (من البنسلينات)')
  })
  it('prints the doctor with the title, once', () => {
    expect(doctorLabel({ name: 'أحمد الخطيب', title: 'د.' })).toBe('د. أحمد الخطيب')
    expect(doctorLabel({ name: 'د. أحمد الخطيب', title: 'د.' })).toBe('د. أحمد الخطيب')
    expect(doctorLabel({ name: 'Sara Haddad', title: 'Dr.' })).toBe('Dr. Sara Haddad')
    expect(doctorLabel({ name: 'Dr Sara Haddad', title: 'Dr.' })).toBe('Dr Sara Haddad')
    expect(doctorLabel({ name: 'سارة', title: '' })).toBe('سارة')
    expect(doctorLabel(undefined)).toBe('')
  })
})

describe('RX- and LAB- references', () => {
  beforeEach(async () => { await resetDatabase(); await ensureClinic(); resetRefsCheck() })
  it('numbers older records in creation order after the highest reference in use', () => {
    const rows = [{ id: 'b', createdAt: '2026-02-01' }, { id: 'a', createdAt: '2026-01-01' }, { id: 'c', createdAt: '2026-03-01', number: 'RX-000007' }]
    expect(planNumbers(rows, 'RX-', 0)).toEqual({ updates: [{ id: 'a', number: 'RX-000008' }, { id: 'b', number: 'RX-000009' }], next: 10 })
    expect(formatRef('LAB-', 42)).toBe('LAB-000042')
  })
  it('gives new prescriptions the next reference, after numbering the ones saved before', async () => {
    const at = (d: string) => `${d}T10:00:00.000Z`
    await db.prescriptions.bulkAdd([
      { id: 'old2', patientId: 'p', doctorId: 'd', date: '2026-02-01', items: [], createdAt: at('2026-02-01'), updatedAt: at('2026-02-01') },
      { id: 'old1', patientId: 'p', doctorId: 'd', date: '2026-01-01', items: [], createdAt: at('2026-01-01'), updatedAt: at('2026-01-01') },
    ])
    const id = await savePrescription({ patientId: 'p', doctorId: 'd', date: '2026-03-01', items: [{ id: 'i', name: 'Paracetamol', dose: '1', frequency: '', duration: '' }] }, { message: 'x' })
    const all = await db.prescriptions.toArray() as (Prescription & N)[]
    expect(Object.fromEntries(all.map(r => [r.id, r.number]))).toEqual({ old1: 'RX-000001', old2: 'RX-000002', [id]: 'RX-000003' })
    expect(await takeRef('rx')).toBe('RX-000004')
    // the backfill runs once per database
    await db.prescriptions.add({ id: 'late', patientId: 'p', doctorId: 'd', date: '2026-03-02', items: [], createdAt: at('2026-03-02'), updatedAt: at('2026-03-02') })
    resetRefsCheck(); await ensureRefs('rx')
    expect(((await db.prescriptions.get('late')) as Prescription & N).number).toBeUndefined()
  })
  it('puts the reference on the WhatsApp text', () => {
    const text = buildRxText({ dateLabel: '1 Oct 2026', ref: 'RX-000012', items: [], labels: { title: 'Prescription', patient: 'P', doctor: 'D', diagnosis: 'Dx', notes: 'N' } })
    expect(text.split('\n')[0]).toBe('Prescription RX-000012 — 1 Oct 2026')
  })
})

describe('lab order costs in the expenses', () => {
  beforeEach(async () => { await resetDatabase(); await ensureClinic(); resetRefsCheck() })
  const input = (p: Partial<LabInput> = {}): LabInput => ({ patientId: 'p1', labName: 'مخبر الدقة', type: 'crown', teeth: [36], status: 'sent', cost: 70, sentDate: '2026-09-01', ...p })
  const opts = { by: 'u1', message: 'm', expenseDesc: 'تاج — سارة ({ref})' }
  const expenses = () => db.expenses.toArray() as Promise<Expense[]>

  it('knows when an order costs the clinic', () => {
    expect(labExpenseDue({ status: 'received', cost: 70 })).toBe(true)
    expect(labExpenseDue({ status: 'fitted', cost: 70 })).toBe(true)
    expect(labExpenseDue({ status: 'received', cost: 0 })).toBe(false)
    expect(labExpenseDue({ status: 'sent', cost: 70 })).toBe(false)
    expect(labExpenseDue({ status: 'remake', cost: 70, expenseId: 'e' })).toBe(true)
    expect(labExpenseDue({ status: 'remake', cost: 70 })).toBe(false)
    expect(labExpenseDue({ status: 'cancelled', cost: 70, expenseId: 'e' })).toBe(false)
  })
  it('creates one expense when the work comes back, keeps it in step, and removes it with the order', async () => {
    const id = await saveLabOrder(input(), opts)
    expect(await expenses()).toHaveLength(0)
    const order = (await db.labOrders.get(id))! as LabOrder & N
    expect(order.number).toBe('LAB-000001')
    await setLabStatus(order, 'received', { ...opts, today: '2026-09-08' })
    let list = await expenses()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ category: 'lab', amount: 70, date: '2026-09-08', labOrderId: id, vendor: 'مخبر الدقة', by: 'u1', description: 'تاج — سارة (LAB-000001)' })
    const withExpense = (await db.labOrders.get(id))!
    expect(withExpense.expenseId).toBe(list[0].id)
    // fitting it does not record the cost twice
    await setLabStatus(withExpense, 'fitted', { ...opts, today: '2026-09-10' })
    expect(await expenses()).toHaveLength(1)
    // the cost is corrected in the form: the expense follows
    const fitted = (await db.labOrders.get(id))!
    await saveLabOrder({ ...input({ status: 'fitted', cost: 85, receivedDate: fitted.receivedDate }) }, { ...opts, id })
    list = await expenses()
    expect(list).toHaveLength(1)
    expect(list[0].amount).toBe(85)
    expect(((await db.labOrders.get(id))! as LabOrder & N).number).toBe('LAB-000001')
    // sent back as a remake: the work was paid, the expense stays
    await setLabStatus((await db.labOrders.get(id))!, 'remake', { ...opts, today: '2026-09-12' })
    expect(await expenses()).toHaveLength(1)
    // deleting the order deletes its expense
    await deleteLabOrder((await db.labOrders.get(id))!, opts)
    expect(await expenses()).toHaveLength(0)
  })
  it('a cost of zero, a cancelled order or one sent back by mistake has no expense', async () => {
    const id = await saveLabOrder(input({ status: 'received', receivedDate: '2026-09-05' }), opts)
    expect(await expenses()).toHaveLength(1)
    await saveLabOrder(input({ status: 'received', receivedDate: '2026-09-05', cost: 0 }), { ...opts, id })
    expect(await expenses()).toHaveLength(0)
    expect((await db.labOrders.get(id))!.expenseId).toBeUndefined()
    await saveLabOrder(input({ status: 'received', receivedDate: '2026-09-05', cost: 50 }), { ...opts, id })
    expect(await expenses()).toHaveLength(1)
    await setLabStatus((await db.labOrders.get(id))!, 'in_progress', { ...opts, today: '2026-09-06' })
    expect(await expenses()).toHaveLength(0)
  })
})
