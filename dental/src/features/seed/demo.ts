// Default catalogue and realistic demo data.
//   seedDefaults()  — procedures, drugs and inventory for a fresh clinic (idempotent: a table that has rows is skipped).
//   loadDemoData()  — a living clinic: doctors, ~60 patients, ~300 appointments over the last 90 days and the next 21,
//                     charts, treatment plans, invoices and payments, prescriptions, lab work, stock, expenses, notes
//                     and the activity feed. Deterministic (seeded PRNG), so screenshots are reproducible.
// Everything is generated in memory from clinical "cases" (cases.ts) and written in one transaction.
import { db, ensureClinic, getClinic, nextInvoiceNumber } from '@/db'
import { newId, nowISO, todayISO } from '@/db/ids'
import type {
  Activity, Appointment, AppointmentStatus, AppointmentType, Clinic, ClinicalNote, Drug, Expense, ExpenseCategory, Gender, InventoryItem, Invoice, InvoiceItem,
  LabOrder, LabOrderStatus, Patient, Payment, PaymentMethod, Prescription, PrescriptionItem, Procedure, StockMovement, StockReason, ToothRecord, ToothSurface,
  TreatmentItem, TreatmentPlan, User,
} from '@/db/types'
import { hashPin, randomHex } from '@/lib/crypto'
import { addDays, addMonths, combine, diffDays, endOfMonth, fromISODate, minutesToTime, startOfMonth, timeToMinutes, toISODate } from '@/lib/dates'
import { formatMoney, round2 } from '@/lib/format'
import common from '@/i18n/common'
import { DEFAULT_DRUGS, DEFAULT_INVENTORY, DEFAULT_PROCEDURES, priceScale, scaleCost, scalePrice } from './catalog'
import {
  alignersCase, bracesCase, bridgeCase, checkupCase, consultCase, dentureCase, effectOf, emergencyCase, endoCrownCase, fillingsCase, implantCase, nightGuardCase,
  pediatricCase, perioCase, proposalCase, rxFor, veneersCase, whiteningCase, wisdomCase,
  type CaseCtx, type CaseDef, type DoctorRole, type Finding, type StepDef, type StepItem,
} from './cases'
import {
  ALLERGIES, ARABIC_MONTHS, BLOOD_TYPES, BOY_NAMES, CONDITIONS, DEMO_DOCTORS, FAMILY_NAMES, FEMALE_NAMES, GIRL_NAMES, INSURERS, MALE_NAMES, OCCUPATIONS_FEMALE,
  OCCUPATIONS_MALE, PLACES, REFERRALS, type NameEntry,
} from './names'
import { DEMO_SEED, Rng } from './rng'

// ================================================================================================
// seedDefaults
// ================================================================================================

export interface DefaultsCounts { procedures: number; drugs: number; inventory: number }
export interface SeedDefaultsOptions { procedures?: boolean; drugs?: boolean; inventory?: boolean }

/** Fills the procedure list, the drug list and the inventory of a fresh clinic. Tables that already have rows are left alone. */
export async function seedDefaults(opts: SeedDefaultsOptions = {}): Promise<DefaultsCounts> {
  const clinic = await getClinic()
  const cur = clinic.currency, dec = clinic.currencyDecimals
  const now = nowISO(), today = todayISO()
  const out: DefaultsCounts = { procedures: 0, drugs: 0, inventory: 0 }
  await db.transaction('rw', [db.procedures, db.drugs, db.inventory, db.stock], async () => {
    if (opts.procedures !== false && (await db.procedures.count()) === 0) {
      const rows: Procedure[] = DEFAULT_PROCEDURES.map((p, i) => ({
        id: newId(), code: p.code, name: p.name, nameEn: p.nameEn, category: p.category, price: scalePrice(p.price, cur, dec), durationMin: p.durationMin,
        toothSpecific: p.toothSpecific, active: true, sortOrder: (i + 1) * 10, createdAt: now, updatedAt: now,
      }))
      await db.procedures.bulkAdd(rows)
      out.procedures = rows.length
    }
    if (opts.drugs !== false && (await db.drugs.count()) === 0) {
      const rows: Drug[] = DEFAULT_DRUGS.map(d => ({
        id: newId(), name: d.name, nameEn: d.nameEn, form: d.form, strength: d.strength, defaultDose: d.dose, defaultFrequency: d.frequency,
        defaultDuration: d.duration, defaultInstructions: d.instructions, active: true, createdAt: now,
      }))
      await db.drugs.bulkAdd(rows)
      out.drugs = rows.length
    }
    if (opts.inventory !== false && (await db.inventory.count()) === 0) {
      const items: InventoryItem[] = []
      const moves: StockMovement[] = []
      for (const d of DEFAULT_INVENTORY) {
        const item: InventoryItem = {
          id: newId(), name: d.name, category: d.category, sku: d.sku, unit: d.unit, quantity: d.quantity, minQuantity: d.minQuantity,
          costPrice: scaleCost(d.costPrice, cur), supplier: d.supplier, location: d.location, notes: d.notes, active: true, createdAt: now, updatedAt: now,
        }
        if (d.expiryDays !== undefined) item.expiryDate = addDays(today, d.expiryDays)
        items.push(clean(item))
        // the opening quantity is recorded as an 'initial' movement, as the inventory screen does
        moves.push({ id: newId(), itemId: item.id, delta: d.quantity, reason: 'initial', date: today, note: OPENING_NOTE, createdAt: now })
      }
      await db.inventory.bulkAdd(items)
      await db.stock.bulkAdd(moves)
      out.inventory = items.length
    }
  })
  return out
}
const OPENING_NOTE = 'رصيد افتتاحي'

// ================================================================================================
// loadDemoData
// ================================================================================================

export type DemoStep = 'defaults' | 'staff' | 'patients' | 'schedule' | 'billing' | 'saving' | 'done'
export const DEMO_STEPS: DemoStep[] = ['defaults', 'staff', 'patients', 'schedule', 'billing', 'saving', 'done']
export interface DemoOptions {
  onProgress?: (step: DemoStep, index: number, total: number) => void
  /** Generate around this moment instead of now (tests). */
  now?: Date
  seed?: number
  /** Number of patients (default 60). */
  patients?: number
}
export interface DemoCounts {
  skipped: boolean
  users: number; patients: number; appointments: number; teeth: number; plans: number; treatments: number; invoices: number; payments: number
  prescriptions: number; labOrders: number; stock: number; expenses: number; notes: number; activity: number
  ms: number
}
const ZERO: DemoCounts = { skipped: false, users: 0, patients: 0, appointments: 0, teeth: 0, plans: 0, treatments: 0, invoices: 0, payments: 0, prescriptions: 0, labOrders: 0, stock: 0, expenses: 0, notes: 0, activity: 0, ms: 0 }
export const DEMO_PIN = '1234'

/**
 * Adds a realistic clinic to the database, without deleting anything. Does nothing when there are already 3 patients
 * or more (returns { skipped: true }). Creates two doctors when the clinic has fewer than two (PIN 1234).
 */
export async function loadDemoData(opts: DemoOptions = {}): Promise<DemoCounts> {
  const t0 = Date.now()
  let stepNo = 0
  const progress = async (s: DemoStep) => { opts.onProgress?.(s, stepNo++, DEMO_STEPS.length); await new Promise(r => setTimeout(r, 0)) }
  if ((await db.patients.count()) >= 3) return { ...ZERO, skipped: true }

  await progress('defaults')
  await ensureClinic()
  const seeded = await seedDefaults()
  const clinic = await getClinic()

  await progress('staff')
  const nowMs = opts.now ? opts.now.getTime() : Date.now()
  const existingUsers = await db.users.toArray()
  const newUsers = await makeDoctors(existingUsers, nowMs)
  const [procedures, drugs, inventory, stock] = await Promise.all([db.procedures.toArray(), db.drugs.toArray(), db.inventory.toArray(), db.stock.toArray()])

  await progress('patients')
  const g = new Generator({ clinic, users: [...existingUsers, ...newUsers], procedures, drugs, nowMs, seed: opts.seed ?? DEMO_SEED, patients: opts.patients ?? 60 })
  g.patientsAndCases()
  await progress('schedule')
  g.topUps()
  g.clinical()
  await progress('billing')
  g.billing()
  g.expensesAndStock(inventory, stock)
  // catalogue rows created just now get a history that predates the demo
  const backdate = new Date(nowMs - 400 * DAY).toISOString()
  const procRows = seeded.procedures ? procedures.map(p => ({ ...p, createdAt: backdate })) : []
  const drugRows = seeded.drugs ? drugs.map(d => ({ ...d, createdAt: backdate })) : []

  await progress('saving')
  const out = await db.transaction('rw', [db.clinic, db.users, db.patients, db.appointments, db.procedures, db.teeth, db.plans, db.treatments, db.invoices, db.payments,
    db.drugs, db.prescriptions, db.labOrders, db.inventory, db.stock, db.expenses, db.notes, db.activity], async () => {
    if ((await db.patients.count()) >= 3) return null
    // file numbers continue the clinic's sequence
    const c0 = await getClinic()
    const last = await db.patients.orderBy('fileNo').last()
    let fileNo = Math.max(c0.nextFileNumber || 1, (last?.fileNo ?? 0) + 1)
    for (const p of [...g.patients].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))) p.fileNo = fileNo++
    // issued invoice numbers in date order, through the clinic counter
    for (const inv of g.numbered()) inv.number = await nextInvoiceNumber()
    const c1 = await getClinic()
    await db.clinic.put({ ...c1, nextFileNumber: fileNo, updatedAt: nowISO() })
    const activity = g.activityRows()

    if (newUsers.length) await db.users.bulkAdd(newUsers)
    if (procRows.length) await db.procedures.bulkPut(procRows)
    if (drugRows.length) await db.drugs.bulkPut(drugRows)
    await db.patients.bulkAdd(g.patients)
    await db.appointments.bulkAdd(g.appointments)
    await db.plans.bulkAdd(g.plans)
    await db.treatments.bulkAdd(g.treatments)
    await db.teeth.bulkAdd(g.teeth)
    await db.invoices.bulkAdd(g.invoices)
    await db.payments.bulkAdd(g.payments)
    await db.prescriptions.bulkAdd(g.prescriptions)
    await db.labOrders.bulkAdd(g.labOrders)
    await db.notes.bulkAdd(g.notes)
    await db.expenses.bulkAdd(g.expenses)
    if (g.stockPut.length) await db.stock.bulkPut(g.stockPut)
    if (g.inventoryPut.length) await db.inventory.bulkPut(g.inventoryPut)
    await db.activity.bulkAdd(activity)
    return activity.length
  })
  if (out === null) return { ...ZERO, skipped: true }
  await progress('done')
  return {
    skipped: false, users: newUsers.length, patients: g.patients.length, appointments: g.appointments.length, teeth: g.teeth.length, plans: g.plans.length,
    treatments: g.treatments.length, invoices: g.invoices.length, payments: g.payments.length, prescriptions: g.prescriptions.length, labOrders: g.labOrders.length,
    stock: g.stockPut.length, expenses: g.expenses.length, notes: g.notes.length, activity: out, ms: Date.now() - t0,
  }
}

/** Creates 'د. ليلى حداد' (orthodontist) and 'د. سامر عبود' when the clinic has fewer than two doctors. PIN 1234. */
async function makeDoctors(users: User[], nowMs: number): Promise<User[]> {
  const doctors = users.filter(u => u.active && u.role === 'doctor')
  const out: User[] = []
  const at = new Date(nowMs - 400 * DAY).toISOString()
  for (const d of DEMO_DOCTORS) {
    if (doctors.length + out.length >= 2) break
    if (users.some(u => u.name.trim() === d.name)) continue
    const salt = randomHex(8)
    out.push({ id: newId(), name: d.name, role: 'doctor', pinHash: await hashPin(DEMO_PIN, salt), pinSalt: salt, color: d.color, specialty: d.specialty, phone: d.phone, email: d.email, active: true, createdAt: at, updatedAt: at })
  }
  return out
}

// ================================================================================================
// the generator
// ================================================================================================

const MIN = 60_000
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()
function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined || (o[k] as unknown) === '') delete o[k]
  return o
}

interface ToothEvent { at: number; f: Finding; by?: string; itemId?: string }
interface PCtx {
  p: Patient
  age: number
  kid: boolean
  first: string
  father?: string
  allergies: string[]
  vip: boolean
  insured: boolean
  /** The general dentist who does this patient's non-specialist work. */
  usual: string
  isNew: boolean
  /** Referred by another patient (who is picked once everyone's registration date is known). */
  referredByPatient: boolean
  /** false: this patient only had work that leaves nothing on the chart (check-ups, orthodontics, whitening). */
  charted: boolean
  createdMs: number
  usedTeeth: Set<number>
  toothEvents: ToothEvent[]
  runs: CaseRun[]
  bookings: number[]
}
interface ItemRun { key: string; steps: number[]; spec: StepItem; id: string; row?: TreatmentItem }
interface Visit {
  run: CaseRun
  step: number
  date: string
  startMs: number
  endMs: number
  dur: number
  doctorId: string
  status: AppointmentStatus
  historical: boolean
  bookedMs: number
  apt?: Appointment
}
interface CaseRun {
  pc: PCtx
  def: CaseDef
  doctorId: string
  items: Map<string, ItemRun>
  visits: Visit[]
  done: Map<number, Visit>          // successful visit of each step
  active: Map<number, Visit>        // the visit a pending step is booked for
  plan?: TreatmentPlan
  declined?: boolean
}
interface ActivityEvent { at: number; type: Activity['type']; action: Activity['action']; entityId?: string; patientId?: string; by?: string; msg: () => string }

interface GenInput { clinic: Clinic; users: User[]; procedures: Procedure[]; drugs: Drug[]; nowMs: number; seed: number; patients: number }

class Generator {
  readonly rng: Rng
  readonly clinic: Clinic
  readonly nowMs: number
  readonly today: string
  readonly windowStart: string
  readonly windowEnd: string
  /** "Now" for today's schedule: the real time, but at most mid-afternoon so an evening demo still shows a working day. */
  readonly refMs: number
  readonly ws: number
  readonly nSlots: number
  readonly workDays: Set<number>
  readonly practitioners: User[]
  readonly ortho: User
  readonly surgeon: User
  readonly generalists: User[]
  readonly front: User           // books appointments and takes payments
  readonly admin: User
  readonly procByCode = new Map<string, { id?: string; name: string; price: number; duration: number }>()
  readonly drugs: Drug[]
  readonly patientCount: number
  readonly cur: string
  readonly decimals: number
  readonly moneyStep: number

  pcs: PCtx[] = []
  patients: Patient[] = []
  appointments: Appointment[] = []
  plans: TreatmentPlan[] = []
  treatments: TreatmentItem[] = []
  teeth: ToothRecord[] = []
  invoices: Invoice[] = []
  payments: Payment[] = []
  prescriptions: Prescription[] = []
  labOrders: LabOrder[] = []
  notes: ClinicalNote[] = []
  expenses: Expense[] = []
  stockPut: StockMovement[] = []
  inventoryPut: InventoryItem[] = []
  events: ActivityEvent[] = []
  private occupancy = new Map<string, Uint8Array>()
  private patientDays = new Set<string>()
  private chairs = new Map<string, string>()
  private materialDates: string[] = []

  constructor(input: GenInput) {
    this.rng = new Rng(input.seed)
    this.clinic = input.clinic
    this.cur = input.clinic.currency
    this.decimals = input.clinic.currencyDecimals === 0 ? 0 : 2
    this.moneyStep = priceScale(this.cur, this.decimals).step
    this.nowMs = input.nowMs
    this.today = toISODate(new Date(input.nowMs))
    this.windowStart = addDays(this.today, -90)
    this.windowEnd = addDays(this.today, 21)
    let ws = timeToMinutes(input.clinic.workStart || '09:00'), we = timeToMinutes(input.clinic.workEnd || '18:00')
    if (!(we - ws >= 180)) { ws = 9 * 60; we = 18 * 60 }
    this.ws = ws
    this.nSlots = Math.floor((we - ws) / 30)
    this.refMs = Math.min(input.nowMs, this.at(this.today, Math.max(ws + 150, we - 150)))
    this.workDays = new Set(input.clinic.workingDays?.length ? input.clinic.workingDays : [0, 1, 2, 3, 4, 6])
    this.patientCount = input.patients

    const active = input.users.filter(u => u.active)
    this.practitioners = active.filter(u => u.role === 'doctor' || u.role === 'admin').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))
    if (!this.practitioners.length) this.practitioners = active.length ? [active[0]] : []
    const spec = (u: User) => `${u.specialty || ''} ${u.title || ''}`.toLowerCase()
    this.ortho = this.practitioners.find(u => /تقويم|ortho/.test(spec(u))) ?? this.practitioners[Math.min(1, this.practitioners.length - 1)]
    this.surgeon = this.practitioners.find(u => /جراح|زرع|surg|implant/.test(spec(u))) ?? this.practitioners[0]
    const gen = this.practitioners.filter(u => u !== this.ortho)
    this.generalists = gen.length ? gen : this.practitioners
    this.admin = active.find(u => u.role === 'admin') ?? this.practitioners[0]
    this.front = active.find(u => u.role === 'receptionist') ?? this.admin
    this.practitioners.forEach((u, i) => this.chairs.set(u.id, `كرسي ${i + 1}`))

    for (const d of DEFAULT_PROCEDURES) this.procByCode.set(d.code, { name: d.name, price: this.price(d.price), duration: d.durationMin })
    for (const p of input.procedures) if (p.code) this.procByCode.set(p.code, { id: p.id, name: p.name, price: p.price, duration: p.durationMin || this.procByCode.get(p.code)?.duration || 30 })
    this.drugs = input.drugs
  }

  // ---- time helpers ---------------------------------------------------------------------------
  at(date: string, minutes: number): number { return new Date(combine(date, minutesToTime(minutes))).getTime() }
  /** A moment that has already happened (never later than now). */
  past(ms: number, slackMin = 1): number { return Math.min(ms, this.nowMs - slackMin * MIN) }
  /** `ms` if it has already happened, otherwise a random moment between `floor` and now. */
  before(ms: number, floor: number): number {
    if (ms <= this.nowMs - MIN) return ms
    const lo = Math.min(floor, this.nowMs - 2 * MIN)
    return Math.round(lo + (this.nowMs - MIN - lo) * this.rng.range(0.2, 0.95, 0.01))
  }
  /** A time during working hours on `date`, not later than now and not before `floor` (nor before that day began). */
  timeOn(date: string, floor: number): number {
    const lo = Math.max(floor, this.at(date, 0))
    let ms = this.at(date, this.ws + this.rng.int(1, this.nSlots - 1) * 30 + this.rng.int(0, 25))
    if (ms < lo) ms = lo + this.rng.int(1, 20) * MIN
    return this.before(ms, lo)
  }
  /** `date` at `minutes`, or earlier that same day when that moment has not come yet (never before the day began). */
  onDay(date: string, minutes: number): number {
    const ms = this.at(date, minutes)
    if (ms <= this.nowMs - 30 * MIN) return ms
    return Math.max(this.at(date, 0), this.nowMs - this.rng.int(2, 30) * MIN)
  }
  isWorkDay(date: string): boolean { return date === this.today || this.workDays.has(fromISODate(date).getDay()) }
  money(n: number): string { return formatMoney(n, this.clinic, 'ar') }
  price(usd: number): number { return scalePrice(usd, this.cur, this.decimals) }
  /** Rounded to the clinic's minor unit, as the billing screens do (0 or 2 decimals). */
  cents(n: number): number { return this.decimals === 0 ? Math.round(n) : round2(n) }
  roundMoney(n: number, mult = 5): number { const s = this.moneyStep * (this.moneyStep === 1 ? mult : 1); return Math.max(s, Math.round(n / s) * s) }

  // ================================================================================================
  // patients and their cases
  // ================================================================================================
  patientsAndCases(): void {
    const rng = this.rng
    const n = this.patientCount
    // age mix: children (primary/mixed dentition), teenagers, adults, seniors
    const ages: number[] = []
    const kids = Math.round(n * 0.17), teens = Math.round(n * 0.1), seniors = Math.round(n * 0.12)
    for (let i = 0; i < kids; i++) ages.push(rng.int(4, 12))
    for (let i = 0; i < teens; i++) ages.push(rng.int(13, 17))
    for (let i = 0; i < seniors; i++) ages.push(rng.int(65, 75))
    while (ages.length < n) ages.push(rng.chance(0.6) ? rng.int(18, 40) : rng.int(41, 64))
    const order = rng.shuffle(ages)

    const usedNames = new Set<string>(), usedPhones = new Set<string>()
    for (const age of order) this.pcs.push(this.makePatient(age, usedNames, usedPhones))
    for (const pc of this.pcs) pc.charted = rng.chance(0.72)

    // referrals between patients (the referrer is picked in clinical(), among adults who registered earlier)
    for (const pc of this.pcs) if (!pc.p.referredBy && rng.chance(0.15)) pc.referredByPatient = true

    // the cases every demo must show, then the rest by age
    const required: CaseDef['key'][] = ['implant', 'implant', 'implant', 'bridge', 'bridge', 'veneers', 'veneers', 'aligners', 'aligners', 'denture', 'nightGuard',
      'wisdom', 'wisdom', 'perio', 'perio', 'braces', 'braces', 'braces', 'braces', 'emergency', 'emergency', 'endoCrown', 'endoCrown', 'endoCrown', 'endoCrown', 'endoCrown',
      'pediatric', 'pediatric', 'pediatric', 'pediatric', 'whitening', 'fillings', 'fillings', 'fillings']
    const primary = new Map<PCtx, string>()
    const finished = new Set<PCtx>()
    for (const key of required) {
      const candidates = this.pcs.filter(pc => !primary.has(pc) && fits(key, pc) && (pc.charted || CHART_FREE.has(key)))
      if (!candidates.length) continue
      const pc = rng.pick(candidates)
      if (FINISH_ONE.has(key) && ![...finished].some(f => primary.get(f) === key)) finished.add(pc)
      primary.set(pc, key)
    }
    for (const pc of this.pcs) {
      if (primary.has(pc)) continue
      const key = pc.charted ? this.caseForAge(pc.age) : this.chartFreeCase(pc.age)
      primary.set(pc, fits(key, pc) ? key : 'endoCrown')
    }

    // a few patients joined recently (their first visit is within the last month)
    const newcomers = new Set(rng.sample(this.pcs.filter(pc => !['braces', 'aligners', 'implant', 'perio', 'denture'].includes(primary.get(pc)!)), Math.round(n * 0.14)))
    for (const pc of newcomers) pc.isNew = true

    for (const pc of this.pcs) {
      const def = this.buildCase(primary.get(pc)!, pc)
      if (finished.has(pc)) pc.isNew = false
      // the orthodontist is the doctor on file; check-ups, fillings and the like stay with their general dentist (pc.usual)
      if (def.doctor === 'ortho') pc.p.doctorId = this.ortho.id
      this.runCase(pc, def, finished.has(pc) ? this.finishedStart(def) : this.firstDateFor(pc, def))
    }
    // second, smaller cases
    for (const pc of this.pcs) {
      if (!rng.chance(0.3)) continue
      const key = pc.kid ? 'checkup' : rng.weighted<string>([['checkup', 3], ['fillings', 2], ['consult', 2], ['emergency', 1]].filter(([k]) => pc.charted || CHART_FREE.has(k as string)) as [string, number][])
      if (pc.runs.some(r => r.def.key === key)) continue
      const def = this.buildCase(key, pc)
      this.runCase(pc, def, this.firstDateFor(pc, def))
    }
    // earlier work, before the calendar window: the clinic's charts, invoices and payments go back further than its appointments
    for (const pc of this.pcs) {
      if (pc.isNew) continue
      const rounds = pc.kid ? (rng.chance(0.5) ? 1 : 0) : rng.chance(0.4) ? 2 : 1
      for (let i = 0; i < rounds; i++) {
        const options: [string, number][] = pc.kid ? [['checkup', 1], ['pediatric', 1]]
          : [['checkup', 2.5], ['fillings', 2.5], ['endoCrown', 2], ['emergency', 1], ['consult', 0.7], ['whitening', 0.7], ['bridge', 0.4], ['implant', 0.3], ['wisdom', 0.5]]
        const key = rng.weighted(options.filter(([k]) => fits(k, pc) && (pc.charted || CHART_FREE.has(k))))
        if (pc.runs.some(run => run.def.key === key)) continue
        this.runCase(pc, this.buildCase(key, pc), addDays(this.today, -rng.int(78, 182)))
      }
    }
    // proposals (draft plans) and one plan the patient turned down
    const adults = this.pcs.filter(pc => pc.age >= 25 && !pc.isNew)
    rng.sample(adults, 5).forEach((pc, i) => this.runProposal(pc, i === 0))
  }

  private chartFreeCase(age: number): string {
    const r = this.rng
    if (age <= 12) return 'checkup'
    if (age <= 17) return r.weighted([['braces', 3], ['checkup', 2]])
    return r.weighted<string>([['checkup', 4], ['consult', 2], ['whitening', age <= 55 ? 1 : 0], ['aligners', age <= 45 ? 0.6 : 0]])
  }
  private caseForAge(age: number): string {
    const r = this.rng
    if (age <= 10) return r.weighted([['pediatric', 6], ['checkup', 4]])
    if (age <= 12) return r.weighted([['braces', 2], ['checkup', 3]])
    if (age <= 17) return r.weighted([['braces', 5], ['fillings', 3], ['checkup', 2]])
    if (age <= 39) return r.weighted([['fillings', 3], ['endoCrown', 2.5], ['wisdom', 1.5], ['whitening', 1], ['checkup', 2.5], ['consult', 1.2], ['emergency', 1], ['nightGuard', 0.4]])
    if (age <= 64) return r.weighted([['endoCrown', 2.5], ['fillings', 2], ['perio', 1], ['emergency', 1.2], ['checkup', 2], ['consult', 1], ['bridge', 0.4], ['implant', 0.4]])
    return r.weighted([['perio', 1.2], ['emergency', 1.2], ['checkup', 1.5], ['fillings', 1], ['endoCrown', 1], ['consult', 1]])
  }

  private buildCase(key: string, pc: PCtx): CaseDef {
    const c: CaseCtx = { rng: this.rng, age: pc.age, gender: pc.p.gender, penicillinAllergy: pc.allergies.includes('البنسلين') }
    switch (key) {
      case 'implant': return implantCase(c)
      case 'bridge': return bridgeCase(c)
      case 'veneers': return veneersCase(c)
      case 'aligners': return alignersCase(c)
      case 'denture': return dentureCase(c)
      case 'nightGuard': return nightGuardCase(c)
      case 'wisdom': return wisdomCase(c)
      case 'perio': return perioCase(c)
      case 'braces': return bracesCase(c)
      case 'emergency': return emergencyCase(c)
      case 'endoCrown': return endoCrownCase(c)
      case 'pediatric': return pediatricCase(c)
      case 'whitening': return whiteningCase(c)
      case 'fillings': return fillingsCase(c)
      case 'consult': return consultCase(c)
      default: return checkupCase(c)
    }
  }

  /** A start early enough for the whole case to be done by now. */
  private finishedStart(def: CaseDef): string {
    const span = def.steps.slice(0, -1).reduce((a, s) => a + (s.gap?.[1] ?? 14), 0)
    return addDays(this.today, -span - this.rng.int(12, 25))
  }
  /** When the case starts: long treatments may have begun months ago; newcomers started within the last month. */
  private firstDateFor(pc: PCtx, def: CaseDef): string {
    const r = this.rng
    // lab cases have their impressions in the last month, so the lab list has work due around today
    const labStep = def.steps.findIndex(s => s.lab)
    if (labStep >= 0) {
      const offset = def.steps.slice(0, labStep).reduce((a, s) => a + Math.round(((s.gap?.[0] ?? 7) + (s.gap?.[1] ?? 14)) / 2), 0)
      return addDays(this.today, -r.int(1, 24) - offset)
    }
    if (pc.isNew) {
      // about half of the newcomers registered this month (the dashboard counts new patients per month)
      const dayOfMonth = fromISODate(this.today).getDate()
      if (dayOfMonth > 3 && r.chance(0.55)) return addDays(this.today, -r.int(0, Math.min(dayOfMonth - 3, 20)))
      return addDays(this.today, -r.int(0, 26))
    }
    const span = def.steps.slice(0, -1).reduce((a, s) => a + ((s.gap?.[0] ?? 0) + (s.gap?.[1] ?? 0)) / 2, 0)
    const back = def.long ? Math.min(Math.round(span * 0.75), 170) : 55
    return addDays(this.today, -r.int(0, 88 + back) + r.int(0, 1) * r.int(0, 16))
  }

  private makePatient(age: number, usedNames: Set<string>, usedPhones: Set<string>): PCtx {
    const r = this.rng
    const kid = age <= 12
    const gender: Gender = r.chance(0.53) ? 'female' : 'male'
    let first: NameEntry, family: NameEntry, father: NameEntry | undefined, name = ''
    for (let tries = 0; ; tries++) {
      first = r.pick(kid ? (gender === 'female' ? GIRL_NAMES : BOY_NAMES) : gender === 'female' ? FEMALE_NAMES : MALE_NAMES)
      const grp = first[2]
      family = r.pick(FAMILY_NAMES.filter(f => grp === 'n' || f[2] === 'n' || f[2] === grp))
      const famGrp = family[2]
      father = kid || r.chance(0.5) ? r.pick(MALE_NAMES.filter(m => m[0] !== first[0] && (famGrp === 'n' || m[2] === 'n' || m[2] === famGrp))) : undefined
      name = [first[0], father?.[0], family[0]].filter(Boolean).join(' ')
      if (!usedNames.has(name) || tries > 20) break
    }
    usedNames.add(name)
    let phone = ''
    do { phone = `09${r.pick([3, 4, 5, 6, 8, 9])}${String(r.int(0, 9999999)).padStart(7, '0')}` } while (usedPhones.has(phone))
    usedPhones.add(phone)
    const fmt = (d: string) => `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
    const birth = addDays(addMonths(this.today, -age * 12), -r.int(1, 360))
    const place = r.weighted(PLACES.map(p => [p, p.weight] as const))
    const area = r.pick(place.areas)
    const address = r.chance(0.55) ? `${place.city} — ${area}، ${r.pick(place.streets)}` : `${place.city} — ${area}`

    const p: Patient = {
      id: newId(), fileNo: 0, name, gender, birthDate: birth, phone: fmt(phone), address, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false,
      createdAt: '', updatedAt: '',
    }
    if (r.chance(0.15)) p.phone2 = fmt(`09${r.pick([3, 4, 5, 6, 8, 9])}${String(r.int(0, 9999999)).padStart(7, '0')}`)
    if (!kid && r.chance(0.22)) p.email = `${first[1]}.${family[1]}${r.chance(0.4) ? r.int(1, 99) : ''}@${r.pick(['gmail.com', 'gmail.com', 'hotmail.com', 'yahoo.com'])}`
    if (!kid && age >= 18 && r.chance(0.4)) p.nationalId = `0${r.int(1, 14)}`.padStart(3, '0').slice(-2) + String(r.int(0, 999999999)).padStart(9, '0')
    if (age >= 6 && age <= 17) p.occupation = gender === 'female' ? 'طالبة' : 'طالب'
    else if (age >= 18 && age <= 23) p.occupation = gender === 'female' ? 'طالبة جامعية' : 'طالب جامعي'
    else if (age >= 63) p.occupation = r.chance(0.7) ? (gender === 'female' ? 'متقاعدة' : 'متقاعد') : gender === 'female' ? 'ربة منزل' : 'تاجر'
    else if (age >= 24 && r.chance(0.8)) p.occupation = r.pick((gender === 'female' ? OCCUPATIONS_FEMALE : OCCUPATIONS_MALE).filter(o => !/متقاعد|طالب/.test(o)))
    if (r.chance(0.35)) p.bloodType = r.pick(BLOOD_TYPES)

    // medical history
    const allergies: string[] = []
    if (r.chance(kid ? 0.06 : 0.12)) allergies.push(r.weighted(ALLERGIES.map(a => [a, a === 'البنسلين' ? 4 : 1] as const)))
    const diseases = CONDITIONS.filter(c => age >= c.minAge)
    const chronic: typeof CONDITIONS = []
    if (diseases.length && r.chance(age >= 35 ? 0.3 : 0.07)) chronic.push(r.pick(diseases))
    if (age >= 50 && chronic.length && r.chance(0.3)) { const second = r.pick(diseases); if (!chronic.includes(second)) chronic.push(second) }
    p.allergies = allergies
    p.chronicDiseases = chronic.map(c => c.disease)
    p.medications = chronic.flatMap(c => c.meds)
    const medNotes = chronic.map(c => c.note).filter(Boolean) as string[]
    if (medNotes.length) p.medicalNotes = medNotes.join('. ')

    // tags, insurance, referral, notes
    const vip = !kid && r.chance(0.1)
    const insured = !kid && age >= 18 && r.chance(0.2)
    if (vip) p.tags.push('VIP')
    if (insured) {
      p.tags.push('تأمين')
      p.insuranceCompany = r.pick(INSURERS)
      p.insuranceNumber = `${r.pick(['AR', 'UI', 'TS', 'AQ'])}-${r.int(100000, 999999)}`
    }
    if (kid) p.tags.push('أطفال')
    if (r.chance(0.05)) p.tags.push('حساس للألم')
    if (r.chance(0.05)) p.tags.push('قلق من العلاج')
    if (!kid && r.chance(0.1)) p.tags.push('متابعة دورية')
    if (r.chance(0.6)) p.referredBy = r.pick(REFERRALS)
    if (kid) p.notes = `ولي الأمر: ${gender === 'female' ? 'والدها' : 'والده'} ${father?.[0] ?? ''}${r.chance(0.5) ? ' — رقم الهاتف للأم' : ''}`.trim()
    else if (r.chance(0.15)) p.notes = r.pick(['يفضّل المواعيد المسائية', 'يفضّل التواصل عبر واتساب', 'يرجى الاتصال قبل الموعد بيوم', 'يأتي من خارج المدينة — تجميع الجلسات قدر الإمكان'])
    if (p.notes && gender === 'female' && !kid) p.notes = p.notes.replace('يفضّل', 'تفضّل').replace('يأتي', 'تأتي')

    const usual = this.rng.weighted(this.generalists.map(u => [u.id, u === this.surgeon && this.generalists.length > 1 ? 0.5 : 1] as const))
    p.doctorId = usual
    const createdMs = this.at(addDays(this.today, -r.int(100, 720)), this.ws + r.int(0, this.nSlots - 1) * 30)
    return { p, age, kid, first: first[0], father: father?.[0], allergies, vip, insured, usual, isNew: false, referredByPatient: false, charted: true, createdMs, usedTeeth: new Set(), toothEvents: [], runs: [], bookings: [] }
  }

  // ================================================================================================
  // scheduling
  // ================================================================================================
  private occ(date: string, doctorId: string): Uint8Array {
    const k = `${date}|${doctorId}`
    let o = this.occupancy.get(k)
    if (!o) { o = new Uint8Array(this.nSlots); this.occupancy.set(k, o) }
    return o
  }
  private findSlot(date: string, doctorId: string, slots: number, range?: [number, number]): number | null {
    const o = this.occ(date, doctorId)
    const starts = this.rng.shuffle(Array.from({ length: this.nSlots - slots + 1 }, (_, i) => i)).filter(i => !range || (this.ws + i * 30 >= range[0] && this.ws + i * 30 <= range[1]))
    for (const s of starts) {
      let free = true
      for (let k = 0; k < slots; k++) if (o[s + k]) { free = false; break }
      if (free) return s
    }
    return null
  }
  /** Books the first free slot on or after `from` (up to `latest`); exact = that day only. */
  private place(pc: PCtx, doctorId: string, from: string, slots: number, latest: string, exact = false, range?: [number, number]): { date: string; slot: number } | null {
    for (let d = from; d <= latest; d = addDays(d, 1)) {
      if (this.isWorkDay(d) && !this.patientDays.has(`${pc.p.id}|${d}`)) {
        const slot = this.findSlot(d, doctorId, slots, range)
        if (slot !== null) {
          const o = this.occ(d, doctorId)
          for (let k = 0; k < slots; k++) o[slot + k] = 1
          this.patientDays.add(`${pc.p.id}|${d}`)
          return { date: d, slot }
        }
      }
      if (exact) return null
    }
    return null
  }
  private statusFor(date: string, startMs: number, endMs: number, retry: boolean): AppointmentStatus {
    const r = this.rng
    if (date < this.today) {
      if (retry) return 'completed'
      const x = r.float()
      return x < 0.065 ? 'no_show' : x < 0.13 ? 'cancelled' : 'completed'
    }
    if (date === this.today) {
      if (endMs <= this.refMs) return 'completed'
      if (startMs <= this.refMs) return 'in_progress'
      if (startMs - this.refMs <= 45 * MIN) return 'arrived'
      return r.chance(0.6) ? 'confirmed' : 'scheduled'
    }
    if (!retry && r.chance(0.03)) return 'cancelled'
    return diffDays(this.today, date) <= 2 ? (r.chance(0.7) ? 'confirmed' : 'scheduled') : (r.chance(0.25) ? 'confirmed' : 'scheduled')
  }
  private doctorFor(role: DoctorRole, pc: PCtx): string {
    if (role === 'ortho') return this.ortho.id
    if (role === 'surgery') return this.surgeon.id
    return pc.usual
  }
  private visitMinutes(step: StepDef): number {
    const seen = new Set<string>()
    let m = 0
    for (const it of step.items) {
      const k = it.key ?? `${it.code}:${it.tooth}`
      if (seen.has(k)) continue
      seen.add(k)
      m += it.key ? Math.max(20, Math.round((this.procByCode.get(it.code)?.duration ?? 30) * 0.6)) : this.procByCode.get(it.code)?.duration ?? 30
    }
    // to the nearest half hour: an exam with a cleaning is a one-hour visit, not ninety minutes
    return Math.min(120, Math.max(30, Math.round(m / 30) * 30))
  }

  /** Lays one case out on the calendar, visit after visit. */
  runCase(pc: PCtx, def: CaseDef, firstDate: string, exactFirst = false, doctorId?: string, range?: [number, number]): CaseRun | null {
    const r = this.rng
    const run: CaseRun = { pc, def, doctorId: doctorId ?? this.doctorFor(def.doctor, pc), items: new Map(), visits: [], done: new Map(), active: new Map() }
    // treatment items: one per key across the steps
    def.steps.forEach((s, si) => s.items.forEach((it, ii) => {
      const key = it.key ?? `${si}:${ii}`
      const ir = run.items.get(key)
      if (ir) ir.steps.push(si)
      else run.items.set(key, { key, steps: [si], spec: it, id: newId() })
    }))
    let prev: Visit | null = null
    for (let si = 0; si < def.steps.length; si++) {
      const step = def.steps[si]
      let nominal: string
      if (si === 0) nominal = firstDate
      else {
        const gap = def.steps[si - 1].gap ?? [7, 14]
        nominal = addDays(prev!.date, r.int(gap[0], gap[1]))
      }
      const slots = this.visitMinutes(step) / 30
      let retry = false
      let placed = false
      while (!placed) {
        if (nominal > this.windowEnd) break
        if (nominal < this.windowStart) {
          // before the calendar window: it happened, but the clinic has no appointment record for it
          let d = nominal
          while (!this.workDays.has(fromISODate(d).getDay()) || this.patientDays.has(`${pc.p.id}|${d}`)) d = addDays(d, 1)
          if (d >= this.windowStart) { nominal = d; continue }
          this.patientDays.add(`${pc.p.id}|${d}`)
          const startMs = this.at(d, this.ws + r.int(0, this.nSlots - slots) * 30)
          const v: Visit = { run, step: si, date: d, startMs, endMs: startMs + slots * 30 * MIN, dur: slots * 30, doctorId: run.doctorId, status: 'completed', historical: true, bookedMs: startMs - DAY }
          run.visits.push(v); run.done.set(si, v); prev = v; placed = true
          break
        }
        const latest = nominal < this.today ? (addDays(nominal, 10) < this.windowEnd ? addDays(nominal, 10) : this.windowEnd) : this.windowEnd
        const spot = this.place(pc, run.doctorId, nominal, slots, latest, exactFirst && si === 0, si === 0 && !retry ? range : undefined)
        if (!spot) break
        const startMs = this.at(spot.date, this.ws + spot.slot * 30)
        const endMs = startMs + slots * 30 * MIN
        const status = this.statusFor(spot.date, startMs, endMs, retry)
        const v: Visit = { run, step: si, date: spot.date, startMs, endMs, dur: slots * 30, doctorId: run.doctorId, status, historical: false, bookedMs: 0 }
        v.bookedMs = this.bookingTime(v, prev, pc)
        run.visits.push(v)
        if (status === 'cancelled' || status === 'no_show') {
          // the patient comes another day
          retry = true
          nominal = addDays(spot.date, r.int(2, 9))
          continue
        }
        if (status === 'completed') run.done.set(si, v)
        else run.active.set(si, v)
        prev = v
        placed = true
      }
      if (!placed) break
      // a step not done yet blocks the next ones from being "done": they can only be booked later
      if (!run.done.has(si) && si < def.steps.length - 1) {
        // book at most the next visit after a pending one (clinics book one visit ahead)
        if (run.active.has(si) && si + 1 < def.steps.length && r.chance(0.5)) {
          const gap = step.gap ?? [7, 14]
          const nd = addDays(prev!.date, r.int(gap[0], gap[1]))
          if (nd <= this.windowEnd) {
            const s2 = def.steps[si + 1]
            const slots2 = this.visitMinutes(s2) / 30
            const spot = this.place(pc, run.doctorId, nd, slots2, this.windowEnd)
            if (spot) {
              const startMs = this.at(spot.date, this.ws + spot.slot * 30)
              const v2: Visit = { run, step: si + 1, date: spot.date, startMs, endMs: startMs + slots2 * 30 * MIN, dur: slots2 * 30, doctorId: run.doctorId,
                status: diffDays(this.today, spot.date) <= 2 ? 'confirmed' : 'scheduled', historical: false, bookedMs: 0 }
              v2.bookedMs = this.bookingTime(v2, prev, pc)
              run.visits.push(v2); run.active.set(si + 1, v2)
            }
          }
        }
        break
      }
    }
    if (!run.visits.length) return null
    for (const v of run.visits) if (!v.historical) pc.bookings.push(v.bookedMs)
    for (const it of run.items.values()) if (it.spec.tooth) pc.usedTeeth.add(it.spec.tooth)
    for (const f of def.findings) pc.usedTeeth.add(f.tooth)
    pc.runs.push(run)
    return run
  }

  /** When the visit was booked: at the end of the previous visit, a few days before, or the same morning for emergencies. */
  private bookingTime(v: Visit, prev: Visit | null, pc: PCtx): number {
    const r = this.rng
    const step = v.run.def.steps[v.step]
    let t: number
    if (prev && !prev.historical && prev.status !== 'cancelled' && prev.status !== 'no_show' && prev.endMs < v.startMs) t = prev.endMs + r.int(2, 10) * MIN
    else if (step.type === 'emergency') t = v.startMs - r.int(60, 200) * MIN
    else if (pc.isNew && !pc.bookings.length && !prev) t = this.at(addDays(v.date, -r.int(0, 2)), this.ws + r.int(0, this.nSlots - 1) * 30 + r.int(0, 25))
    else t = this.at(addDays(v.date, -r.int(1, 12)), this.ws + r.int(0, this.nSlots - 1) * 30 + r.int(0, 25))
    t = Math.min(t, v.startMs - 30 * MIN)
    if (t > this.nowMs - 5 * MIN) t = this.before(t, Math.max(this.nowMs - r.int(1, 6) * DAY, prev && !prev.historical ? prev.endMs : 0))
    return t
  }

  private runProposal(pc: PCtx, declined: boolean): void {
    const c: CaseCtx = { rng: this.rng, age: pc.age, gender: pc.p.gender, penicillinAllergy: false }
    const def = proposalCase(c, declined)
    const run: CaseRun = { pc, def, doctorId: this.doctorFor(def.doctor, pc), items: new Map(), visits: [], done: new Map(), active: new Map(), declined }
    def.proposal!.forEach((it, i) => run.items.set(`p:${i}`, { key: `p:${i}`, steps: [], spec: it, id: newId() }))
    pc.runs.push(run)
  }

  /** Makes sure today, the coming days and the whole window look like a working clinic (~300 appointments). */
  topUps(): void {
    const r = this.rng
    const quick = (pc: PCtx): CaseDef => {
      const c: CaseCtx = { rng: r, age: pc.age, gender: pc.p.gender, penicillinAllergy: pc.allergies.includes('البنسلين') }
      if (pc.kid || !pc.charted) return pc.kid || r.chance(0.7) ? checkupCase(c) : consultCase(c)
      return r.weighted<() => CaseDef>([[() => checkupCase(c), 5], [() => consultCase(c), 2], [() => fillingsCase(c), 1.5], [() => emergencyCase(c), 1]])()
    }
    const countOn = (d: string) => this.allVisits().filter(v => v.date === d && !v.historical).length
    const all = this.pcs.filter(pc => !pc.p.archived)
    const near = (pc: PCtx, d: string, days: number) => pc.runs.some(run => run.visits.some(v => Math.abs(diffDays(v.date, d)) < days))
    // a newcomer cannot have come before their first visit
    const known = (pc: PCtx, d: string) => !pc.isNew || pc.runs.some(run => run.visits.some(v => v.date <= d))
    const pick = (d: string) => { const ok = all.filter(pc => known(pc, d)); const free = ok.filter(pc => !near(pc, d, 20)); return r.pick(free.length ? free : ok) }
    const busy = (d: string, id: string) => this.occ(d, id).reduce((a, x) => a + x, 0)
    const dentist = (d: string) => { const min = Math.min(...this.generalists.map(u => busy(d, u.id))); return r.pick(this.generalists.filter(u => busy(d, u.id) === min)).id }
    // today: a full day with visits already finished, one in the chair or waiting, and more to come
    const ref = new Date(this.refMs)
    const refMin = ref.getHours() * 60 + ref.getMinutes()      // the local clock (a DST change makes the day 23 or 25 hours long)
    const endMin = this.ws + this.nSlots * 30
    const todays = () => this.allVisits().filter(v => v.date === this.today && !v.historical)
    const want: [(v: Visit) => boolean, number, [number, number]][] = [
      [v => v.status === 'completed', refMin - 90 >= this.ws ? 2 : 0, [this.ws, refMin - 90]],
      [v => v.status === 'arrived' || v.status === 'in_progress', refMin >= this.ws && refMin + 30 < endMin ? 1 : 0, [refMin - 20, refMin + 30]],
      [v => v.status === 'scheduled' || v.status === 'confirmed', refMin + 60 <= endMin - 30 ? 2 : 0, [refMin + 60, endMin - 30]],
    ]
    for (const [is, n, range] of want) {
      for (let guard = 0; todays().filter(is).length < n && guard < 20; guard++) { const pc = pick(this.today); this.runCase(pc, quick(pc), this.today, true, dentist(this.today), range) }
    }
    for (let guard = 0; countOn(this.today) < 10 && guard < 60; guard++) { const pc = pick(this.today); this.runCase(pc, quick(pc), this.today, true, dentist(this.today)) }
    // the coming three weeks: busy next week, fewer bookings further out
    for (let i = 1; i <= 21; i++) {
      const d = addDays(this.today, i)
      if (!this.isWorkDay(d)) continue
      const want = i <= 7 ? 5 : i <= 14 ? 3 : 2
      for (let guard = 0; countOn(d) < want && guard < 30; guard++) { const pc = pick(d); this.runCase(pc, quick(pc), d, true, dentist(d)) }
    }
    // spread recalls over the window until the calendar holds ~300 appointments
    for (let guard = 0; this.allVisits().filter(v => !v.historical).length < 296 && guard < 400; guard++) {
      const d = addDays(this.today, -r.int(1, 89))
      const pc = pick(d)
      this.runCase(pc, quick(pc), d, true)
    }
  }
  private allVisits(): Visit[] { return this.pcs.flatMap(pc => pc.runs.flatMap(run => run.visits)) }

  // ================================================================================================
  // clinical records: patients' dates, appointments, plans, treatment items, chart, notes, prescriptions, lab
  // ================================================================================================
  clinical(): void {
    const r = this.rng
    for (const pc of this.pcs) {
      // when the patient was registered
      const firstBooking = pc.bookings.length ? Math.min(...pc.bookings) : Infinity
      const firstHistorical = Math.min(...pc.runs.flatMap(run => run.visits.filter(v => v.historical).map(v => v.startMs)), Infinity)
      if (pc.isNew && Number.isFinite(firstBooking)) pc.createdMs = firstBooking - r.int(2, 30) * MIN
      pc.createdMs = Math.min(pc.createdMs, firstBooking - 5 * MIN, firstHistorical - 7 * DAY)
      pc.createdMs = this.past(pc.createdMs, 60)
      pc.p.createdAt = iso(pc.createdMs)
      const p = pc.p
      this.events.push({ at: pc.createdMs, type: 'patient', action: 'create', entityId: p.id, patientId: p.id, by: this.front.id, msg: () => `ملف جديد: ${p.name} — رقم الملف ${p.fileNo}` })
    }
    // referrals between patients: by an adult patient who registered earlier
    for (const pc of this.pcs) {
      if (!pc.referredByPatient) continue
      const earlier = this.pcs.filter(o => o !== pc && !o.kid && o.createdMs < pc.createdMs - DAY)
      if (!earlier.length) continue
      const by = r.pick(earlier).p
      pc.p.referredBy = `${by.gender === 'female' ? 'المريضة' : 'المريض'} ${by.name}`
    }
    this.pregnancy()
    for (const pc of this.pcs) for (const run of pc.runs) this.materialise(run)
    for (const pc of this.pcs) this.baselineChart(pc)
    for (const pc of this.pcs) this.applyTeeth(pc)
    this.labWork()
    // last visit and tags that follow from the treatment
    for (const pc of this.pcs) {
      const done = this.appointments.filter(a => a.patientId === pc.p.id && a.status === 'completed').map(a => a.start).sort()
      if (done.length) pc.p.lastVisit = done[done.length - 1]
      if (pc.runs.some(run => ['braces', 'aligners'].includes(run.def.key) && run.visits.length) && !pc.p.tags.includes('تقويم')) pc.p.tags.push('تقويم')
      pc.p.updatedAt = pc.p.lastVisit && pc.p.lastVisit > pc.p.createdAt ? pc.p.lastVisit : pc.p.createdAt
      if (pc.p.updatedAt > iso(this.nowMs)) pc.p.updatedAt = pc.p.createdAt
      this.patients.push(clean(pc.p))
    }
    // one old patient who moved away is archived
    const archive = this.pcs.find(pc => !pc.isNew && pc.age >= 25 && pc.runs.every(run => run.visits.every(v => v.date < addDays(this.today, -20)) && run.active.size === 0 && !run.def.proposal))
    if (archive) { archive.p.archived = true; archive.p.notes = `${archive.p.gender === 'female' ? 'سافرت' : 'سافر'} خارج البلد — الملف مؤرشف` }
  }

  /**
   * One patient is five months pregnant. Her file says X-rays and non-urgent work are postponed, so she is chosen
   * among women of 24–38 with no X-ray, surgery, implant, cosmetic work or prescription in the last five months or booked.
   */
  private pregnancy(): void {
    const since = addDays(this.today, -150)
    const avoided = (code: string) => /^D0[23]|^D7|^D60|^D42[14]|^D99(72|75)$|^D296[12]$|^DSD$/.test(code)
    const clear = (pc: PCtx) => pc.runs.every(run => {
      if (run.def.proposal) return !run.def.proposal.some(it => avoided(it.code))
      return run.visits.every(v => v.date < since || v.status === 'cancelled' || v.status === 'no_show' ||
        (!run.def.steps[v.step].rx && !run.def.steps[v.step].items.some(it => avoided(it.code))))
    })
    const candidates = this.pcs.filter(pc => pc.p.gender === 'female' && pc.age >= 24 && pc.age <= 38 && !pc.p.medications.length && clear(pc))
    if (!candidates.length) return
    const pc = this.rng.pick(candidates)
    pc.p.medicalNotes = [pc.p.medicalNotes, 'حامل في الشهر الخامس — تُؤجَّل الصور الشعاعية والإجراءات غير الضرورية إلى ما بعد الولادة'].filter(Boolean).join('. ')
  }

  /** Turns a case run into appointments, plan, treatment items, notes and prescriptions. */
  private materialise(run: CaseRun): void {
    const r = this.rng
    const { pc, def } = run
    const pid = pc.p.id
    const steps = def.steps
    // appointments
    for (const v of run.visits) {
      if (v.historical) continue
      const step = steps[v.step]
      const created = Math.max(v.bookedMs, pc.createdMs + MIN)
      let updated = created
      switch (v.status) {
        case 'completed': updated = this.before(v.endMs + r.int(2, 20) * MIN, v.endMs); break
        case 'cancelled': updated = created + Math.max(MIN, Math.floor((Math.min(v.startMs, this.nowMs) - created) * r.range(0.3, 0.9, 0.01))); break
        case 'no_show': updated = this.before(v.startMs + 30 * MIN, v.startMs); break
        case 'confirmed': updated = this.before(Math.max(created + MIN, v.startMs - DAY - r.int(0, 300) * MIN), created); break
        case 'arrived': updated = Math.min(v.startMs - r.int(3, 15) * MIN, this.nowMs - r.int(1, 10) * MIN); break
        case 'in_progress': updated = this.before(v.startMs + r.int(1, 5) * MIN, v.startMs); break
        default: updated = created
      }
      if (updated < created) updated = created
      const ids = [...run.items.values()].filter(it => it.steps.includes(v.step)).map(it => it.id)
      const apt: Appointment = clean({
        id: newId(), patientId: pid, doctorId: v.doctorId, date: v.date, start: iso(v.startMs), end: iso(v.endMs), durationMin: v.dur, type: step.type as AppointmentType,
        status: v.status, reason: step.reason, chair: this.chairs.get(v.doctorId), treatmentItemIds: ids, createdAt: iso(created), updatedAt: iso(updated), createdBy: this.front.id,
        notes: v.status === 'cancelled' ? r.pick([`اعتذر${pc.p.gender === 'female' ? 'ت' : ''} بسبب السفر`, 'طلب تأجيل الموعد', 'ظرف طارئ', undefined]) : undefined,
      })
      if (apt.notes === 'طلب تأجيل الموعد' && pc.p.gender === 'female') apt.notes = 'طلبت تأجيل الموعد'
      v.apt = apt
      this.appointments.push(apt)
      const typeLabel = common.ar[`aptType.${apt.type}`] ?? ''
      this.events.push({ at: created, type: 'appointment', action: 'create', entityId: apt.id, patientId: pid, by: this.front.id, msg: () => `موعد جديد: ${pc.p.name} — ${typeLabel}، ${dayLabel(apt.date)}` })
      const f = pc.p.gender === 'female'
      if (v.status === 'completed') this.events.push({ at: updated, type: 'appointment', action: 'status', entityId: apt.id, patientId: pid, by: v.doctorId, msg: () => `انتهت زيارة ${pc.p.name} (${typeLabel})` })
      if (v.status === 'arrived' || v.status === 'in_progress') this.events.push({ at: Math.min(v.startMs - r.int(3, 12) * MIN, this.nowMs - r.int(11, 20) * MIN), type: 'appointment', action: 'status', entityId: apt.id, patientId: pid, by: this.front.id, msg: () => `${f ? 'وصلت' : 'وصل'} ${pc.p.name} إلى العيادة` })
      if (v.status === 'no_show') this.events.push({ at: updated, type: 'appointment', action: 'status', entityId: apt.id, patientId: pid, by: this.front.id, msg: () => `${f ? 'لم تحضر' : 'لم يحضر'} ${pc.p.name} إلى ${f ? 'موعدها' : 'موعده'}` })
      if (v.status === 'cancelled') this.events.push({ at: updated, type: 'appointment', action: 'status', entityId: apt.id, patientId: pid, by: this.front.id, msg: () => `إلغاء موعد ${pc.p.name} — ${dayLabel(apt.date)}` })
    }

    // when the plan was made: at the first exam, or when the first visit was booked
    const first = run.visits.find(v => v.status !== 'cancelled' && v.status !== 'no_show')
    let planMs: number
    if (first) planMs = run.done.get(first.step) === first ? first.startMs + r.int(10, Math.max(11, first.dur - 5)) * MIN : first.bookedMs
    else {
      const anyDone = pc.runs.flatMap(x => [...x.done.values()]).sort((a, b) => b.endMs - a.endMs)[0]
      planMs = anyDone && anyDone.endMs < this.nowMs ? anyDone.endMs - 5 * MIN : this.past(this.at(addDays(this.today, -r.int(3, 40)), this.ws + r.int(2, this.nSlots - 2) * 30), 60)
      planMs = Math.max(planMs, pc.createdMs + 30 * MIN)
    }
    planMs = this.past(Math.max(planMs, pc.createdMs + MIN), 2)

    if (def.title) {
      const plan: TreatmentPlan = { id: newId(), patientId: pid, doctorId: run.doctorId, title: def.title, status: 'draft', notes: def.planNote, createdAt: iso(planMs), updatedAt: iso(planMs) }
      run.plan = plan
      this.events.push({ at: planMs, type: 'treatment', action: 'create', entityId: plan.id, patientId: pid, by: run.doctorId, msg: () => `خطة علاج جديدة: ${plan.title} — ${pc.p.name}` })
    }

    // treatment items
    for (const it of run.items.values()) {
      const proc = this.procByCode.get(it.spec.code)!
      const price = proc.price
      const discount = price >= this.price(150) && r.chance(0.12) ? this.roundMoney(price * 0.1) : 0
      const doneVisits = it.steps.map(s => run.done.get(s)).filter(Boolean) as Visit[]
      const pending = it.steps.filter(s => !run.done.has(s))
      const nextVisit = pending.length ? run.active.get(pending[0]) : undefined
      let created = run.plan ? planMs : Math.min(...it.steps.map(s => {
        const v = run.done.get(s) ?? run.active.get(s)
        return v ? (run.done.get(s) === v ? v.startMs + 5 * MIN : v.bookedMs) : planMs
      }), planMs)
      if (!it.steps.length) created = planMs
      const row: TreatmentItem = {
        id: it.id, patientId: pid, planId: run.plan?.id, procedureId: proc.id, procedureName: it.spec.label ? `${proc.name} — ${it.spec.label}` : proc.name,
        tooth: it.spec.tooth, surfaces: it.spec.surfaces?.length ? [...it.spec.surfaces] : undefined, price, discount, status: 'planned', doctorId: run.doctorId,
        createdAt: iso(created), updatedAt: iso(created),
      }
      if (run.declined) { row.status = 'cancelled'; row.updatedAt = iso(this.past(created + r.int(2, 9) * DAY, 30)) }
      else if (doneVisits.length === it.steps.length && it.steps.length) {
        const last = doneVisits[doneVisits.length - 1]
        row.status = 'completed'
        row.completedAt = iso(last.endMs - r.int(1, 8) * MIN)
        row.appointmentId = last.apt?.id
        row.updatedAt = row.completedAt
      } else if (doneVisits.length) {
        row.status = 'in_progress'
        const last = doneVisits[doneVisits.length - 1]
        row.appointmentId = nextVisit?.apt?.id ?? last.apt?.id
        if (nextVisit) row.plannedDate = nextVisit.date
        row.updatedAt = iso(last.endMs - MIN)
      } else if (nextVisit) {
        row.status = nextVisit.status === 'in_progress' ? 'in_progress' : 'planned'
        row.appointmentId = nextVisit.apt?.id
        row.plannedDate = nextVisit.date
        if (row.status === 'in_progress') row.updatedAt = iso(this.before(nextVisit.startMs + 5 * MIN, nextVisit.startMs))
      }
      if (row.updatedAt < row.createdAt) row.updatedAt = row.createdAt
      it.row = clean(row)
      this.treatments.push(it.row)
      if (row.status === 'completed') {
        const label = `${row.procedureName}${row.tooth ? ` (السن ${row.tooth})` : ''}`
        this.events.push({ at: Date.parse(row.completedAt!), type: 'treatment', action: 'status', entityId: row.id, patientId: pid, by: run.doctorId, msg: () => `إنجاز ${label} — ${pc.p.name}` })
      }
    }
    if (run.plan) {
      const rows = [...run.items.values()].map(it => it.row!)
      const st = rows.map(x => x.status)
      run.plan.status = run.declined ? 'cancelled'
        : st.every(s => s === 'completed') ? 'completed'
        : st.some(s => s === 'completed' || s === 'in_progress') ? 'in_progress'
        : run.visits.length ? 'approved' : 'draft'
      run.plan.updatedAt = rows.reduce((a, x) => (x.updatedAt > a ? x.updatedAt : a), run.plan.createdAt)
      this.plans.push(clean(run.plan))
    }

    // chart: findings at the first exam, then what each completed procedure changed
    const exam = steps.length ? run.done.get(0) : undefined
    if (exam) for (const f of def.findings) pc.toothEvents.push({ at: exam.startMs + r.int(5, 12) * MIN, f, by: exam.doctorId })
    for (const it of run.items.values()) {
      const row = it.row!
      if (row.status !== 'completed') continue
      const eff = effectOf(it.spec.code, it.spec.tooth, it.spec.surfaces)
      if (eff) pc.toothEvents.push({ at: Date.parse(row.completedAt!), f: eff, by: row.doctorId, itemId: row.id })
    }

    // notes and prescriptions of the visits that took place
    for (const v of run.done.values()) {
      const step = steps[v.step]
      const important = step.type === 'emergency' || step.type === 'surgery' || v.step === 0 || !!step.lab || !!step.rx
      if (step.note && (important ? r.chance(0.8) : r.chance(0.2)) && (!v.historical || r.chance(0.4))) {
        const at = iso(Math.min(v.endMs + r.int(1, 15) * MIN, Math.max(v.endMs, this.nowMs)))
        this.notes.push(clean({ id: newId(), patientId: pid, appointmentId: v.apt?.id, doctorId: v.doctorId, date: v.date, text: step.note, createdAt: at, updatedAt: at }))
      }
      if (step.rx) {
        const items = this.rxItems(step.rx, pc)
        if (items.length) {
          const at = v.endMs - r.int(2, 6) * MIN
          const rx: Prescription = clean({ id: newId(), patientId: pid, doctorId: v.doctorId, date: v.date, items, diagnosis: step.diagnosis, createdAt: iso(at), updatedAt: iso(at),
            notes: pc.allergies.length ? `تحسس من ${pc.allergies.join('، ')}` : undefined })
          this.prescriptions.push(rx)
          this.events.push({ at, type: 'prescription', action: 'create', entityId: rx.id, patientId: pid, by: v.doctorId, msg: () => `وصفة طبية: ${pc.p.name}${rx.diagnosis ? ` — ${rx.diagnosis}` : ''}` })
        }
      }
    }
  }

  private rxItems(key: Parameters<typeof rxFor>[0], pc: PCtx): PrescriptionItem[] {
    const refs = rxFor(key, pc.allergies)
    const out: PrescriptionItem[] = []
    for (const [nameEn, strength] of refs) {
      const d = this.drugs.find(x => x.nameEn === nameEn && x.strength === strength && x.active) ?? this.drugs.find(x => x.nameEn === nameEn && x.active)
      const def = DEFAULT_DRUGS.find(x => x.nameEn === nameEn && x.strength === strength)
      if (!d && !def) continue
      out.push(clean({
        id: newId(), drugId: d?.id, name: d?.name ?? def!.name, strength: d?.strength ?? def!.strength,
        dose: d?.defaultDose ?? def!.dose, frequency: d?.defaultFrequency ?? def!.frequency, duration: d?.defaultDuration ?? def!.duration,
        instructions: d?.defaultInstructions ?? def!.instructions,
      }))
    }
    return out
  }

  /** Earlier dental work found at the patient's first exam (fillings, crowns, extracted wisdom teeth…). */
  private baselineChart(pc: PCtx): void {
    const r = this.rng
    const allDone = pc.runs.flatMap(run => [...run.done.values()]).sort((a, b) => a.startMs - b.startMs)
    if (!allDone.length) return
    const at = pc.isNew ? allDone[0].startMs + 4 * MIN : Math.min(pc.createdMs + 25 * MIN, allDone[0].startMs)
    const by = allDone[0].doctorId
    const free = (list: number[]) => list.filter(t => !pc.usedTeeth.has(t))
    const add = (f: Finding) => { pc.usedTeeth.add(f.tooth); pc.toothEvents.push({ at, f, by }) }
    if (!pc.charted || r.chance(0.3)) return
    if (pc.kid) {
      if (r.chance(0.4)) { const t = r.pick(free([51, 61, 52, 62, 53, 63])); if (t) add({ tooth: t, condition: 'caries', surfaces: ['M'] }) }
      return
    }
    if (pc.age < 18) { if (r.chance(0.5)) for (const t of free([36, 46])) add({ tooth: t, condition: 'sealant', surfaces: ['O'] }); return }
    const n = pc.age >= 65 ? r.int(4, 7) : pc.age >= 40 ? r.int(2, 5) : r.int(1, 3)
    for (let i = 0; i < n; i++) {
      const kind = r.weighted<string>([['filled', 5], ['crownRct', 2], ['wisdom', pc.age >= 22 ? 2 : 0], ['missing', pc.age >= 40 ? 2 : 0.3], ['rct', 1], ['attrition', pc.age >= 50 ? 1.5 : 0]])
      if (kind === 'wisdom') { const t = r.pick(free([18, 28, 38, 48])); if (t) add({ tooth: t, condition: 'missing', note: 'قُلع سابقاً' }) }
      else if (kind === 'missing') { const t = r.pick(free([16, 26, 36, 46, 17, 27, 37, 47])); if (t) add({ tooth: t, condition: 'missing' }) }
      else if (kind === 'attrition') { for (const t of free([13, 23, 33, 43]).slice(0, 2)) add({ tooth: t, condition: 'attrition' }) }
      else {
        const t = r.pick(free([16, 26, 36, 46, 17, 27, 37, 47, 14, 15, 24, 25, 34, 35, 44, 45]))
        if (!t) continue
        if (kind === 'filled') add({ tooth: t, condition: 'filled', surfaces: r.pick([['O'], ['M', 'O'], ['O', 'D'], ['M', 'O', 'D']] as ToothSurface[][]) })
        else if (kind === 'rct') { add({ tooth: t, condition: 'root_canal' }); pc.toothEvents.push({ at, f: { tooth: t, condition: 'filled', surfaces: ['M', 'O', 'D'] }, by }) }
        else { add({ tooth: t, condition: 'root_canal' }); pc.toothEvents.push({ at, f: { tooth: t, condition: 'crown' }, by }) }
      }
    }
  }

  /** Replays the chart events in time order, superseding what each new finding replaces (like the chart does). */
  private applyTeeth(pc: PCtx): void {
    const events = pc.toothEvents.sort((a, b) => a.at - b.at)
    const rows: ToothRecord[] = []
    for (const e of events) {
      const surfaces = e.f.surfaces ?? []
      for (const old of rows) if (old.active && old.tooth === e.f.tooth && supersedes(e.f.condition, surfaces, old)) old.active = false
      rows.push(clean({ id: newId(), patientId: pc.p.id, tooth: e.f.tooth, surfaces: [...surfaces], condition: e.f.condition, note: e.f.note, active: true, recordedAt: iso(e.at), recordedBy: e.by, treatmentItemId: e.itemId }))
    }
    this.teeth.push(...rows)
  }

  /** Lab orders for prosthetic work, with statuses that follow the visits (sent → in progress → received → fitted). */
  private labWork(): void {
    const r = this.rng
    const since = addDays(this.today, -75)
    for (const pc of this.pcs) for (const run of pc.runs) {
      run.def.steps.forEach((step, si) => {
        const spec = step.lab
        if (!spec) return
        const prep = run.done.get(si)
        const item = run.items.get(spec.item)?.row
        if (!prep) {
          // impressions are booked: the order is prepared as a draft
          const booked = run.active.get(si)
          if (booked && booked.date > this.today && booked.date <= addDays(this.today, 7) && !this.labOrders.some(o => o.status === 'draft')) {
            const at = this.past(booked.bookedMs + 10 * MIN, 5)
            this.labOrders.push(clean({ id: newId(), patientId: pc.p.id, doctorId: run.doctorId, labName: spec.lab, type: spec.type, teeth: [...spec.teeth], shade: spec.shade, material: spec.material,
              dueDate: addDays(booked.date, spec.days[1]), status: 'draft' as LabOrderStatus, cost: this.price(spec.cost), notes: 'بانتظار أخذ الطبعة', treatmentItemId: item?.id, createdAt: iso(at), updatedAt: iso(at) }))
          }
          return
        }
        if (prep.date < since) return
        const sent = prep.date
        let due = addDays(sent, r.int(spec.days[0], spec.days[1]))
        const fit = run.done.get(spec.fitStep)
        let status: LabOrderStatus
        let received: string | undefined
        if (fit) {
          status = 'fitted'
          if (due > fit.date) due = addDays(fit.date, -1) > sent ? addDays(fit.date, -1) : fit.date
          received = addDays(due, -r.int(0, 1)) > sent ? addDays(due, -r.int(0, 1)) : due
          if (received > fit.date) received = fit.date
        } else if (due < this.today) {
          status = 'received'
          received = addDays(due, r.int(-1, 0)) > sent ? addDays(due, r.int(-1, 0)) : due
        } else status = diffDays(sent, this.today) >= 2 ? 'in_progress' : 'sent'
        const createdAt = this.past(prep.endMs + r.int(5, 30) * MIN, 3)
        const updatedMs = received ? Math.max(createdAt, this.past(this.at(received, this.ws + r.int(2, this.nSlots - 2) * 30), 2)) : status === 'in_progress' ? Math.max(createdAt, this.past(this.at(addDays(sent, 1), this.ws + 120), 2)) : createdAt
        const o: LabOrder = clean({
          id: newId(), patientId: pc.p.id, doctorId: run.doctorId, labName: spec.lab, type: spec.type, teeth: [...spec.teeth], shade: spec.shade, material: spec.material,
          sentDate: sent, dueDate: due, receivedDate: received, status, cost: this.price(spec.cost), notes: spec.notes, treatmentItemId: item?.id,
          createdAt: iso(createdAt), updatedAt: iso(updatedMs),
        })
        this.labOrders.push(o)
        const typeLabel = common.ar[`labType.${o.type}`] ?? ''
        this.events.push({ at: createdAt, type: 'lab', action: 'create', entityId: o.id, patientId: pc.p.id, by: run.doctorId, msg: () => `إرسال ${typeLabel} إلى ${o.labName} — ${pc.p.name}` })
        if (received) this.events.push({ at: updatedMs, type: 'lab', action: 'status', entityId: o.id, patientId: pc.p.id, by: this.front.id, msg: () => `استلام ${typeLabel} من ${o.labName} — ${pc.p.name}` })
      })
    }
    // about a dozen orders: the oldest finished ones are left out
    for (;;) {
      const fitted = this.labOrders.filter(o => o.status === 'fitted').sort((a, b) => (a.sentDate ?? '').localeCompare(b.sentDate ?? ''))
      if (this.labOrders.length <= 12 || fitted.length <= 3) break
      this.labOrders = this.labOrders.filter(o => o !== fitted[0])
      this.events = this.events.filter(e => e.entityId !== fitted[0].id)
    }
    // every status shows up: a just-sent order, one back from the lab, one sent back for a remake
    const open = () => this.labOrders.filter(o => o.status === 'in_progress' && o.type !== 'aligner' && o.type !== 'denture_full')
    if (!this.labOrders.some(o => o.status === 'draft')) {
      const o = open().sort((a, b) => b.sentDate!.localeCompare(a.sentDate!))[0]
      if (o) { o.status = 'draft'; delete o.sentDate; o.notes = 'جاهز للإرسال مع مندوب المخبر'; o.updatedAt = o.createdAt }
    }
    if (!this.labOrders.some(o => o.status === 'received')) {
      const o = open().sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0]
      if (o) { o.status = 'received'; o.receivedDate = this.today > o.sentDate! ? this.today : o.sentDate; o.updatedAt = iso(Math.max(Date.parse(o.createdAt), this.before(this.at(o.receivedDate!, this.ws + 90), Date.parse(o.createdAt)))) }
    }
    if (!this.labOrders.some(o => o.status === 'sent')) {
      const o = open().sort((a, b) => b.sentDate!.localeCompare(a.sentDate!))[0]
      if (o) { o.status = 'sent'; o.updatedAt = o.createdAt }
    }
    const redo = open()[0] ?? this.labOrders.find(o => o.status === 'in_progress' || o.status === 'received')
    if (redo) {
      redo.status = 'remake'
      redo.notes = 'اللون غير مطابق — أُعيد إلى المخبر لتعديل اللون'
      redo.receivedDate = undefined
      delete redo.receivedDate
      if (redo.dueDate! <= this.today) redo.dueDate = addDays(this.today, r.int(2, 5))
    }
    const declined = this.pcs.flatMap(pc => pc.runs.filter(run => run.declined).map(run => ({ pc, run })))[0]
    if (declined) {
      const at = this.past(Date.parse(declined.run.plan?.createdAt ?? iso(this.nowMs - 10 * DAY)) + 20 * MIN, 45)
      const upd = Math.max(at, this.before(at + 2 * DAY, at))
      const t = [...declined.run.items.values()].find(i => i.spec.tooth)?.spec.tooth
      const type = declined.run.def.doctor === 'ortho' ? 'aligner' : declined.run.def.doctor === 'surgery' ? 'implant_crown' : 'veneer'
      this.labOrders.push(clean({ id: newId(), patientId: declined.pc.p.id, doctorId: declined.run.doctorId, labName: type === 'aligner' ? 'مخبر النخبة لأجهزة التقويم' : 'مخبر الشام الرقمي (CAD/CAM)', type,
        teeth: t ? [t] : [], status: 'cancelled' as LabOrderStatus, cost: this.price(type === 'aligner' ? 450 : 110), notes: 'أُلغي الطلب قبل البدء بالعمل', createdAt: iso(at), updatedAt: iso(upd) }))
    }
  }

  // ================================================================================================
  // billing: invoices for completed work, payments, deposits
  // ================================================================================================
  billing(): void {
    const r = this.rng
    interface Group { pc: PCtx; v: Visit; items: TreatmentItem[] }
    const groups: Group[] = []
    for (const pc of this.pcs) for (const run of pc.runs) for (const v of run.done.values()) {
      const items = [...run.items.values()].map(i => i.row!).filter(row => row.status === 'completed' && (v.apt ? row.appointmentId === v.apt.id : !row.appointmentId && Math.abs(Date.parse(row.completedAt!) - v.endMs) < 10 * MIN))
      if (items.length) groups.push({ pc, v, items })
    }
    groups.sort((a, b) => a.v.endMs - b.v.endMs)
    // the newest work: a couple not billed yet, a couple of drafts
    const recent = groups.filter(gr => gr.v.date >= addDays(this.today, -3)).reverse()
    const unbilled = new Set(recent.slice(0, 2))
    const drafts = new Set(groups.filter(gr => !unbilled.has(gr) && gr.v.date >= addDays(this.today, -6) && gr.v.date < this.today).slice(-3, -1))
    const cancelAt = groups.find(gr => gr.v.date <= addDays(this.today, -15) && gr.v.date >= addDays(this.today, -60) && gr.items.length <= 3)

    for (const gr of groups) {
      if (unbilled.has(gr)) continue
      const { pc, v } = gr
      const lines: InvoiceItem[] = gr.items.map(it => clean({ id: newId(), treatmentItemId: it.id, procedureId: it.procedureId, description: it.procedureName, tooth: it.tooth, qty: 1, unitPrice: it.price, discount: it.discount, total: round2(it.price - it.discount) }))
      const createdMs = Math.max(v.endMs + r.int(3, 15) * MIN, ...gr.items.map(i => Date.parse(i.completedAt!) + MIN))
      let issuedMs = createdMs
      if (gr === cancelAt) {
        // issued with a wrong line, cancelled, re-issued a few minutes later (all after the work was done)
        const xray = this.procByCode.get('D0330')!
        const wrong = [...lines.map(l => ({ ...l, id: newId() })), clean({ id: newId(), description: xray.name, procedureId: xray.id, qty: 1, unitPrice: xray.price, discount: 0, total: xray.price })]
        const bad = this.invoice(pc, v, wrong, createdMs, false)
        bad.status = 'cancelled'
        bad.notes = 'أُلغيت لخطأ في البنود (صورة لم تُجرَ) وأُعيد إصدارها'
        bad.updatedAt = iso(Date.parse(bad.createdAt) + 4 * MIN)
        issuedMs = Date.parse(bad.createdAt) + 6 * MIN
      }
      const inv = this.invoice(pc, v, lines, issuedMs, pc.vip)
      for (const it of gr.items) it.invoiceId = inv.id
      if (drafts.has(gr)) { inv.status = 'draft'; inv.number = 'DRAFT'; continue }
      this.collect(pc, inv, issuedMs)
    }
    this.settleAtNextVisit()
    // deposits on account before big treatments
    const big = this.pcs.filter(pc => pc.runs.some(run => ['implant', 'braces', 'aligners', 'veneers'].includes(run.def.key) && run.done.size > 0 && [...run.items.values()].some(i => i.row!.status !== 'completed')))
    for (const pc of r.sample(big, 3)) {
      const run = pc.runs.find(x => ['implant', 'braces', 'aligners', 'veneers'].includes(x.def.key) && x.done.size > 0)!
      const v = [...run.done.values()].sort((a, b) => a.endMs - b.endMs)[0]
      const at = this.past(v.endMs + r.int(5, 20) * MIN, 2)
      const amount = this.price(r.pick([100, 150, 200, 300]))
      const p: Payment = { id: newId(), patientId: pc.p.id, amount, method: r.pick(['cash', 'cash', 'transfer'] as const), date: toISODate(new Date(at)), note: 'دفعة مقدمة على حساب العلاج', receivedBy: this.front.id, createdAt: iso(at) }
      this.payments.push(p)
      this.events.push({ at, type: 'payment', action: 'create', entityId: p.id, patientId: pc.p.id, by: this.front.id, msg: () => `دفعة مقدمة ${this.money(amount)} من ${pc.p.name}` })
    }
  }

  /** Most patients clear what they still owe on a small invoice when they next come in (a week or more later). */
  private settleAtNextVisit(): void {
    const r = this.rng
    for (const pc of this.pcs) {
      const visits = pc.runs.flatMap(run => [...run.done.values()]).sort((a, b) => a.endMs - b.endMs)
      for (const inv of this.invoices) {
        if (inv.patientId !== pc.p.id || (inv.status !== 'unpaid' && inv.status !== 'partial') || inv.total >= this.price(600)) continue
        const next = visits.find(v => v.date >= addDays(inv.date, 7) && v.endMs > Date.parse(inv.updatedAt))
        if (!next || !r.chance(0.8)) continue
        const ms = this.before(next.endMs + r.int(2, 12) * MIN, next.endMs)
        const amount = this.cents(inv.total - inv.paid)
        if (amount <= 0) continue
        const method = r.weighted<PaymentMethod>([['cash', 70], ['card', 15], ['wallet', 10], ['transfer', 5]])
        const pay: Payment = clean({ id: newId(), patientId: pc.p.id, invoiceId: inv.id, amount, method, date: toISODate(new Date(ms)), note: 'تسديد المتبقي من الفاتورة', receivedBy: this.front.id, createdAt: iso(ms),
          reference: method === 'card' ? `**** ${r.int(1000, 9999)}` : method === 'wallet' ? `عملية ${r.int(10000000, 99999999)}` : method === 'transfer' ? `حوالة ${r.int(100000, 999999)}` : undefined })
        this.payments.push(pay)
        inv.paid = this.cents(inv.paid + amount)
        inv.status = 'paid'
        inv.updatedAt = iso(Math.max(Date.parse(inv.updatedAt), ms))
        this.events.push({ at: ms, type: 'payment', action: 'create', entityId: pay.id, patientId: pc.p.id, by: this.front.id, msg: () => `استلام دفعة ${this.money(amount)} (${common.ar[`pay.${method}`] ?? ''}) من ${pc.p.name} — تسديد فاتورة ${inv.number}` })
      }
    }
  }

  private invoice(pc: PCtx, v: Visit, lines: InvoiceItem[], createdMs: number, vip: boolean): Invoice {
    const subtotal = round2(lines.reduce((a, l) => a + l.total, 0))
    const discount = vip ? Math.min(subtotal, this.roundMoney(subtotal * 0.1, 1)) : 0
    const taxPercent = Math.max(0, this.clinic.taxPercent || 0)
    const tax = this.cents(((subtotal - discount) * taxPercent) / 100)
    const total = this.cents(subtotal - discount + tax)
    const at = this.past(createdMs, 1)
    const inv: Invoice = clean({
      id: newId(), number: '', patientId: pc.p.id, doctorId: v.doctorId, date: v.date, dueDate: total >= this.price(500) ? addDays(v.date, 30) : undefined, items: lines, subtotal, discount, taxPercent, tax, total,
      paid: 0, status: 'unpaid', notes: vip ? 'خصم VIP ‏10%' : undefined, createdAt: iso(at), updatedAt: iso(at), createdBy: this.front.id,
    })
    this.invoices.push(inv)
    return inv
  }

  /** How the patient paid: on the day, in instalments, through the insurer, or not yet. */
  private collect(pc: PCtx, inv: Invoice, visitDoneMs: number): void {
    const r = this.rng
    const createdMs = Math.min(visitDoneMs, Date.parse(inv.createdAt))
    const age = diffDays(inv.date, this.today)
    const big = inv.total >= this.price(600)
    let mode: 'paid' | 'partial' | 'unpaid'
    const x = r.float()
    if (big) mode = age > 150 ? 'paid' : x < 0.3 ? 'paid' : 'partial'
    else if (age > 30) mode = x < 0.9 ? 'paid' : x < 0.96 ? 'partial' : 'unpaid'
    else if (age > 7) mode = x < 0.78 ? 'paid' : x < 0.9 ? 'partial' : 'unpaid'
    else mode = x < 0.66 ? 'paid' : x < 0.84 ? 'partial' : 'unpaid'
    const pays: { amount: number; date: string; method: PaymentMethod; ms?: number }[] = []
    const method = (): PaymentMethod => r.weighted<PaymentMethod>([['cash', 64], ['card', 15], ['transfer', 10], ['wallet', 7], ['other', 1]])
    const laterDate = (minDays: number, maxDays: number) => { const d = addDays(inv.date, r.int(minDays, Math.max(minDays, maxDays))); return d > this.today ? this.today : d }
    if (mode === 'paid') {
      if (pc.insured && age >= 12 && r.chance(0.6)) {
        const share = this.roundMoney(inv.total * 0.5)
        if (share < inv.total) {
          pays.push({ amount: round2(inv.total - share), date: inv.date, method: method(), ms: createdMs + r.int(1, 8) * MIN })
          pays.push({ amount: share, date: laterDate(8, Math.min(30, age)), method: 'insurance' })
        } else pays.push({ amount: inv.total, date: inv.date, method: method(), ms: createdMs + r.int(1, 8) * MIN })
      } else if (big) {
        // instalments every month; whatever falls after today is still owed
        let left = inv.total, d = inv.date, k = 0
        const first = this.roundMoney(inv.total * r.range(0.3, 0.45, 0.05))
        pays.push({ amount: first, date: d, method: method(), ms: createdMs + r.int(1, 8) * MIN }); left = round2(left - first)
        while (left > 0 && k++ < 12) {
          d = addDays(d, r.int(26, 34))
          if (d > this.today) break
          const a = left <= this.roundMoney(inv.total * 0.25) ? left : this.roundMoney(inv.total * r.range(0.15, 0.25, 0.05))
          pays.push({ amount: Math.min(a, left), date: d, method: method() }); left = round2(left - Math.min(a, left))
        }
      } else if (age >= 3 && r.chance(0.12)) {
        const first = this.roundMoney(inv.total * 0.5)
        if (first < inv.total) {
          pays.push({ amount: first, date: inv.date, method: method(), ms: createdMs + r.int(1, 8) * MIN })
          pays.push({ amount: round2(inv.total - first), date: laterDate(1, Math.min(age, 20)), method: method() })
        } else pays.push({ amount: inv.total, date: inv.date, method: method(), ms: createdMs + r.int(1, 8) * MIN })
      } else pays.push({ amount: inv.total, date: inv.date, method: method(), ms: createdMs + r.int(1, 8) * MIN })
    } else if (mode === 'partial') {
      let paid = this.roundMoney(inv.total * r.range(0.3, 0.6, 0.05))
      if (paid >= inv.total) paid = this.cents(inv.total / 2)
      pays.push({ amount: paid, date: inv.date, method: method(), ms: createdMs + r.int(1, 8) * MIN })
      if (big) {
        let d = inv.date, left = round2(inv.total - paid)
        for (let k = 0; k < 8; k++) {
          d = addDays(d, r.int(26, 34))
          if (d >= this.today) break
          const a = this.roundMoney(inv.total * 0.1)
          if (a >= left) break
          pays.push({ amount: a, date: d, method: method() }); left = round2(left - a)
        }
      }
    }
    let last = createdMs
    const refFor = (m: PaymentMethod) => m === 'transfer' ? `حوالة ${r.int(100000, 999999)}` : m === 'card' ? `**** ${r.int(1000, 9999)}` : m === 'wallet' ? `عملية ${r.int(10000000, 99999999)}` : m === 'insurance' ? `مطالبة ${r.int(1000, 9999)}` : undefined
    for (const p of pays) {
      let ms = p.ms !== undefined ? this.before(p.ms, createdMs) : this.timeOn(p.date, createdMs + MIN)
      if (ms < createdMs) ms = createdMs
      const pay: Payment = clean({
        id: newId(), patientId: pc.p.id, invoiceId: inv.id, amount: round2(p.amount), method: p.method, date: toISODate(new Date(ms)) < inv.date ? inv.date : toISODate(new Date(ms)),
        reference: refFor(p.method), note: p.method === 'insurance' ? pc.p.insuranceCompany : undefined, receivedBy: this.front.id, createdAt: iso(ms),
      })
      this.payments.push(pay)
      last = Math.max(last, ms)
      const methodLabel = common.ar[`pay.${pay.method}`] ?? ''
      this.events.push({ at: ms, type: 'payment', action: 'create', entityId: pay.id, patientId: pc.p.id, by: this.front.id, msg: () => `استلام دفعة ${this.money(pay.amount)} (${methodLabel}) من ${pc.p.name}` })
    }
    inv.paid = round2(pays.reduce((a, p) => a + round2(p.amount), 0))
    inv.status = inv.paid >= inv.total - 0.005 ? 'paid' : inv.paid > 0.005 ? 'partial' : 'unpaid'
    inv.updatedAt = iso(Math.max(createdMs, last))
    this.events.push({ at: Date.parse(inv.createdAt), type: 'invoice', action: 'create', entityId: inv.id, patientId: pc.p.id, by: this.front.id, msg: () => `فاتورة ${inv.number} بقيمة ${this.money(inv.total)} — ${pc.p.name}` })
  }

  /** Issued (and cancelled) invoices in the order they were numbered. */
  numbered(): Invoice[] {
    return this.invoices.filter(i => i.status !== 'draft').sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  }

  // ================================================================================================
  // expenses and stock
  // ================================================================================================
  expensesAndStock(inventory: InventoryItem[], stock: StockMovement[]): void {
    this.makeExpenses()
    this.makeStock(inventory, stock)
  }

  private makeExpenses(): void {
    const r = this.rng
    const by = this.admin.id
    const add = (category: ExpenseCategory, date: string, usd: number, description: string, extra: Partial<Expense> = {}) => {
      if (date > this.today) return
      const ms = this.onDay(date, this.ws + r.int(2, this.nSlots - 2) * 30)
      const e: Expense = clean({ id: newId(), category, amount: this.price(usd), date, description, method: 'cash' as PaymentMethod, by, createdAt: iso(ms), ...extra })
      this.expenses.push(e)
      this.events.push({ at: ms, type: 'expense', action: 'create', entityId: e.id, by, msg: () => `مصروف: ${e.description} — ${this.money(e.amount)}` })
    }
    const day = (month: string, d: number) => { const last = endOfMonth(month); const x = `${month.slice(0, 8)}${String(d).padStart(2, '0')}`; return x > last ? last : x }
    const staff = this.front.role === 'receptionist' ? this.front.name : 'موظفة الاستقبال'
    // lab bills: what each month's lab work cost
    const labByMonth = new Map<string, number>()
    for (const o of this.labOrders) if (o.receivedDate) labByMonth.set(startOfMonth(o.receivedDate), (labByMonth.get(startOfMonth(o.receivedDate)) ?? 0) + o.cost)
    for (let m = 5; m >= 0; m--) {
      const month = addMonths(startOfMonth(this.today), -m)
      const name = ARABIC_MONTHS[fromISODate(month).getMonth()]
      add('rent', day(month, 1), 400, `إيجار العيادة — ${name}`, { method: 'transfer', vendor: 'مالك العقار' })
      add('utilities', day(month, 5), r.range(40, 70, 5), `اشتراك الأمبيرات (المولّدة) — ${name}`)
      add('marketing', day(month, 3), r.range(30, 60, 5), `إعلان ممول على إنستغرام — ${name}`, { method: 'card', vendor: 'Meta' })
      add('utilities', day(month, 10), 20, `اشتراك الإنترنت — ${name}`, { method: 'wallet' })
      if (m % 2 === 0) add('utilities', day(month, 15), r.range(25, 45, 1), 'فاتورة الكهرباء')
      else add('utilities', day(month, 18), r.range(6, 10, 1), 'فاتورة المياه')
      for (const d of [8, 22]) {
        const date = day(month, d + r.int(-2, 2))
        const vendor = r.pick(['مستودع الشفاء للمواد السنية', 'شركة الرازي للتجهيزات الطبية'])
        add('materials', date, r.range(80, 320, 5), r.pick(['مواد حشو وبوندينغ', 'قفازات وكمامات ومستهلكات', 'مواد طبع وأقماع علاج عصب', 'مخدر وإبر', 'سنابل ومبارد']), { vendor, method: r.chance(0.5) ? 'cash' : 'transfer' })
        if (date <= this.today) this.materialDates.push(date)
      }
      add('other', day(month, 12), r.range(15, 25, 1), 'ضيافة (قهوة وماء ومحارم)')
      add('other', day(month, 19), r.range(10, 18, 1), 'مواد تنظيف وتعقيم للعيادة')
      const endM = endOfMonth(month)
      add('salaries', endM, 180, `راتب المساعدة السنية — ${name}`)
      add('salaries', endM, 150, `راتب ${staff} — ${name}`)
      add('salaries', endM, 60, `أجور التنظيف — ${name}`)
      const labCost = labByMonth.get(month)
      const labUsd = labCost ? labCost / priceScale(this.cur).factor : (m >= 2 ? r.range(120, 320, 10) : 0)
      if (labUsd > 0) add('lab', day(month, 28), labUsd, `تسوية حساب المخابر — ${name}`, { method: 'transfer', vendor: 'مخبر الدقة للتعويضات السنية' })
    }
    const month = (m: number) => addMonths(startOfMonth(this.today), -m)
    add('maintenance', day(month(4), 14), 45, 'صيانة الكمبريسور', { vendor: 'ورشة أبو خليل للتجهيزات' })
    add('maintenance', day(month(2), 9), 60, 'صيانة جهاز التعقيم (الأوتوكلاف)', { vendor: 'شركة الرازي للتجهيزات الطبية' })
    add('maintenance', day(month(1), 20), 35, 'إصلاح قبضة التوربين')
    add('equipment', day(month(4), 6), 180, 'جهاز تصليب ضوئي LED', { vendor: 'شركة الرازي للتجهيزات الطبية', method: 'transfer' })
    add('equipment', day(month(2), 17), 250, 'قبضة توربين جديدة', { vendor: 'شركة الرازي للتجهيزات الطبية', method: 'card' })
    add('taxes', day(month(5), 11), 50, 'رسوم نقابة أطباء الأسنان السنوية')
    add('taxes', day(month(3), 7), 40, 'رسوم ترخيص البلدية')
    add('marketing', day(month(3), 21), 45, 'طباعة بطاقات مواعيد وبروشورات', { vendor: 'مطبعة الفجر' })
    add('other', day(month(1), 4), 12, 'قرطاسية')
    this.expenses.sort((a, b) => a.date.localeCompare(b.date))
  }

  /** Six months of stock history for the catalogue items, ending at their current quantity. */
  private makeStock(inventory: InventoryItem[], stock: StockMovement[]): void {
    const r = this.rng
    const start = addDays(this.today, -180)
    const byItem = new Map<string, StockMovement[]>()
    for (const m of stock) { const l = byItem.get(m.itemId) ?? []; l.push(m); byItem.set(m.itemId, l) }
    const purchaseDates = this.materialDates.length ? this.materialDates : [addDays(this.today, -150), addDays(this.today, -90), addDays(this.today, -30)]
    const sorted = [...inventory].sort((a, b) => a.name.localeCompare(b.name))
    let expiredDone = false, adjustDone = false
    for (const item of sorted) {
      const moves = byItem.get(item.id) ?? []
      // only items whose history is just the opening balance (untouched since they were created)
      const opening = moves.length === 1 && moves[0].reason === 'initial' && moves[0].delta === item.quantity ? moves[0] : moves.length === 0 ? null : undefined
      if (opening === undefined || item.quantity <= 0) continue
      const big = item.unit === 'ml' || item.unit === 'g'
      const rate = big ? r.range(300, 500, 50) : Math.max(1, Math.round(Math.max(1, item.minQuantity) * r.range(0.6, 1.2, 0.1)))   // per month
      type Ev = { date: string; delta: number; reason: StockReason; note?: string }
      const evs: Ev[] = []
      for (let d = addDays(start, r.int(5, 14)); d < this.today; d = addDays(d, r.int(10, 20))) {
        const u = big ? r.range(100, 200, 50) : Math.max(1, Math.round(rate / 2 * r.range(0.5, 1.5, 0.5)))
        evs.push({ date: d, delta: -u, reason: 'use', note: r.chance(0.3) ? 'صرف للعيادة' : undefined })
      }
      for (const d of r.sample(purchaseDates.filter(x => x < this.today && x > start), r.int(2, 4))) {
        const p = big ? r.range(1000, 2000, 500) : Math.max(1, Math.round(rate * r.range(1.5, 3, 0.5)))
        evs.push({ date: d, delta: p, reason: 'purchase', note: item.supplier ? `فاتورة ${item.supplier}` : undefined })
      }
      if (!expiredDone && item.expiryDate && item.expiryDate <= addDays(this.today, 60)) {
        evs.push({ date: addDays(this.today, -r.int(10, 25)), delta: -1, reason: 'expired', note: 'عبوة مفتوحة انتهت صلاحيتها' }); expiredDone = true
      } else if (!adjustDone && item.unit === 'box' && item.category === 'consumables') {
        evs.push({ date: addDays(this.today, -r.int(20, 40)), delta: -1, reason: 'adjust', note: 'تصحيح بعد الجرد' }); adjustDone = true
      }
      // walk back from today's quantity; a purchase that would make the past balance negative never happened
      evs.sort((a, b) => b.date.localeCompare(a.date))
      let bal = item.quantity
      const kept: Ev[] = []
      for (const e of evs) {
        if (e.delta > 0 && bal - e.delta < 1) continue
        bal -= e.delta
        kept.push(e)
      }
      const openMs = this.at(start, this.ws + 60)
      const by = this.admin.id
      const initial: StockMovement = clean({ id: opening?.id ?? newId(), itemId: item.id, delta: bal, reason: 'initial' as StockReason, date: start, note: OPENING_NOTE, by, createdAt: iso(openMs) })
      this.stockPut.push(initial)
      let lastMs = openMs
      const sameDay = new Map<string, number>()
      for (const e of kept.reverse()) {
        const k = sameDay.get(e.date) ?? 0
        sameDay.set(e.date, k + 1)
        const ms = this.at(e.date, this.ws + 30 + k * 45 + r.int(0, 20))
        lastMs = Math.max(lastMs, ms)
        const m: StockMovement = clean({ id: newId(), itemId: item.id, delta: e.delta, reason: e.reason, date: e.date, note: e.note, by, createdAt: iso(ms) })
        this.stockPut.push(m)
        if (e.reason === 'purchase' && e.date >= addDays(this.today, -14)) this.events.push({ at: ms, type: 'inventory', action: 'other', entityId: item.id, by, msg: () => `شراء مواد: ${item.name} (+${e.delta})` })
      }
      this.inventoryPut.push({ ...item, createdAt: iso(openMs), updatedAt: iso(Math.max(lastMs, openMs)) })
    }
  }

  // ================================================================================================
  // activity feed (built after the invoices got their numbers)
  // ================================================================================================
  activityRows(): Activity[] {
    const from = this.nowMs - 14 * DAY
    return this.events
      .filter(e => e.at >= from && e.at <= this.nowMs)
      .sort((a, b) => a.at - b.at)
      .slice(-180)
      .map(e => clean({ id: newId(), type: e.type, action: e.action, entityId: e.entityId, patientId: e.patientId, message: e.msg(), at: iso(e.at), by: e.by }))
  }
}

// ---- helpers ------------------------------------------------------------------------------------

/** Of these, the first case of each kind is completed by today. */
const FINISH_ONE = new Set(['implant', 'bridge', 'denture', 'pediatric'])
/** Cases that leave nothing on the dental chart. */
const CHART_FREE = new Set(['checkup', 'consult', 'whitening', 'braces', 'aligners'])

/** Age and medical history allow this case (no implants for patients on bisphosphonates). */
function fits(key: string, pc: PCtx): boolean {
  if (!eligible(key, pc.age)) return false
  if (key === 'implant' && pc.p.medications.some(m => BISPHOSPHONATE.test(m))) return false
  return true
}
const BISPHOSPHONATE = /أليندرونات|ريسيدرونات|زوليدرونات/

function eligible(key: string, age: number): boolean {
  switch (key) {
    case 'implant': return age >= 25 && age <= 72
    case 'bridge': return age >= 30
    case 'veneers': return age >= 22 && age <= 55
    case 'aligners': return age >= 16 && age <= 45
    case 'denture': return age >= 62
    case 'nightGuard': return age >= 25 && age <= 60
    case 'wisdom': return age >= 18 && age <= 40
    case 'perio': return age >= 35
    case 'braces': return age >= 11 && age <= 35
    case 'emergency': return age >= 15
    case 'endoCrown': return age >= 16
    case 'pediatric': return age <= 10           // primary molars are shed from about 10–12
    case 'whitening': return age >= 20 && age <= 55
    case 'fillings': return age >= 13
    default: return true
  }
}

const SURFACE = new Set(['caries', 'filled', 'sealant', 'fracture'])
const FLAG = new Set(['to_extract', 'mobile', 'abscess', 'attrition', 'other'])
/** The chart's rule, simplified: does a new finding make an older active record of the same tooth obsolete? */
function supersedes(next: Finding['condition'], surfaces: ToothSurface[], old: ToothRecord): boolean {
  if (SURFACE.has(next)) return SURFACE.has(old.condition) ? old.surfaces.some(s => surfaces.includes(s)) : old.condition === 'missing' || old.condition === 'implant'
  if (next === old.condition) return true
  switch (next) {
    case 'missing': case 'implant': return true
    case 'impacted': return !SURFACE.has(old.condition) && !FLAG.has(old.condition)
    case 'crown': case 'bridge': case 'veneer':
      if (['crown', 'bridge', 'veneer', 'missing', 'impacted', 'to_extract'].includes(old.condition)) return true
      if (SURFACE.has(old.condition)) return next === 'veneer' ? old.surfaces.includes('B') : true
      return false
    case 'root_canal': return ['missing', 'implant', 'impacted', 'to_extract', 'abscess'].includes(old.condition)
    default: return old.condition === 'missing'
  }
}

/** 'الأحد 12 تشرين الأول' — short, natural day label for activity messages. */
function dayLabel(date: string): string {
  const d = fromISODate(date)
  const wd = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d.getDay()]
  return `${wd} ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`
}
