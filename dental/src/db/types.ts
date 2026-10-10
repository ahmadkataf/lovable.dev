// Dentora data model. Every record lives in IndexedDB (Dexie) on the device; a backup is the JSON of all tables.
// Dates: calendar dates are 'YYYY-MM-DD' strings, instants are ISO strings (new Date().toISOString()).
// Money: plain numbers in the clinic currency (no cents handling beyond 2 decimals).

export type ID = string
export type ISODate = string      // 'YYYY-MM-DD'
export type ISOTime = string      // ISO 8601 instant

export type Lang = 'ar' | 'en'
export type Role = 'admin' | 'doctor' | 'assistant' | 'receptionist'
export type Gender = 'male' | 'female'

export interface Clinic {
  id: 'clinic'
  name: string
  nameEn?: string
  tagline?: string
  phone?: string
  phone2?: string
  email?: string
  address?: string
  website?: string
  logo?: string                   // data URL (PNG/JPEG/SVG), small
  currency: string                // ISO code, e.g. 'USD', 'SYP', 'SAR'
  currencySymbol: string          // '$', 'ل.س', 'ر.س'
  currencyDecimals: number        // 0 or 2
  lang: Lang
  theme: 'light' | 'dark'
  workingDays: number[]           // 0 = Sunday … 6 = Saturday
  workStart: string               // 'HH:MM'
  workEnd: string                 // 'HH:MM'
  slotMinutes: number             // calendar grid step: 15 | 20 | 30 | 60
  defaultAppointmentMinutes: number
  taxPercent: number              // 0 if none
  invoicePrefix: string           // 'INV-'
  nextInvoiceNumber: number
  nextFileNumber: number          // next patient file number
  invoiceFooter?: string
  prescriptionFooter?: string
  setupDone: boolean
  createdAt: ISOTime
  updatedAt: ISOTime
}

export interface User {
  id: ID
  name: string
  role: Role
  pinHash: string                 // SHA-256(salt + pin) hex
  pinSalt: string
  color: string                   // hex, used for the calendar and avatar
  specialty?: string
  phone?: string
  email?: string
  title?: string                  // 'د.' / 'Dr.'
  active: boolean
  createdAt: ISOTime
  updatedAt: ISOTime
}

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export interface Patient {
  id: ID
  fileNo: number
  name: string                    // full name as written
  gender: Gender
  birthDate?: ISODate
  phone?: string
  phone2?: string
  email?: string
  address?: string
  nationalId?: string
  occupation?: string
  bloodType?: BloodType
  allergies: string[]
  chronicDiseases: string[]
  medications: string[]
  medicalNotes?: string
  notes?: string
  tags: string[]
  referredBy?: string
  insuranceCompany?: string
  insuranceNumber?: string
  photo?: string                  // data URL
  doctorId?: ID                   // usual doctor
  archived: boolean
  createdAt: ISOTime
  updatedAt: ISOTime
  lastVisit?: ISOTime
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type AppointmentType = 'checkup' | 'consultation' | 'treatment' | 'followup' | 'cleaning' | 'emergency' | 'surgery' | 'orthodontic' | 'other'
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show']
export const APPOINTMENT_TYPES: AppointmentType[] = ['checkup', 'consultation', 'treatment', 'followup', 'cleaning', 'emergency', 'surgery', 'orthodontic', 'other']

export interface Appointment {
  id: ID
  patientId: ID
  doctorId: ID
  date: ISODate                   // day of the appointment (for fast queries)
  start: ISOTime
  end: ISOTime
  durationMin: number
  type: AppointmentType
  status: AppointmentStatus
  reason?: string
  notes?: string
  chair?: string
  treatmentItemIds?: ID[]         // planned work for this visit
  createdAt: ISOTime
  updatedAt: ISOTime
  createdBy?: ID
}

export type ProcedureCategory = 'diagnostic' | 'preventive' | 'restorative' | 'endodontic' | 'periodontic' | 'prosthodontic' | 'surgical' | 'orthodontic' | 'pediatric' | 'cosmetic' | 'implant' | 'other'
export const PROCEDURE_CATEGORIES: ProcedureCategory[] = ['diagnostic', 'preventive', 'restorative', 'endodontic', 'periodontic', 'prosthodontic', 'surgical', 'orthodontic', 'pediatric', 'cosmetic', 'implant', 'other']

export interface Procedure {
  id: ID
  code?: string
  name: string
  nameEn?: string
  category: ProcedureCategory
  price: number
  durationMin?: number
  toothSpecific: boolean          // needs a tooth number
  color?: string
  active: boolean
  sortOrder?: number
  createdAt: ISOTime
  updatedAt: ISOTime
}

/** Tooth numbering follows FDI: adult 11–48, primary 51–85. Surfaces: M D O B L I (incisal) and R (root). */
export type ToothSurface = 'M' | 'D' | 'O' | 'B' | 'L' | 'I' | 'R'
export type ToothCondition = 'healthy' | 'caries' | 'filled' | 'crown' | 'missing' | 'implant' | 'root_canal' | 'bridge' | 'veneer' | 'fracture' | 'to_extract' | 'impacted' | 'sealant' | 'mobile' | 'abscess' | 'attrition' | 'other'
export const TOOTH_CONDITIONS: ToothCondition[] = ['healthy', 'caries', 'filled', 'crown', 'missing', 'implant', 'root_canal', 'bridge', 'veneer', 'fracture', 'to_extract', 'impacted', 'sealant', 'mobile', 'abscess', 'attrition', 'other']

export interface ToothRecord {
  id: ID
  patientId: ID
  tooth: number                   // FDI number
  surfaces: ToothSurface[]        // empty = whole tooth
  condition: ToothCondition
  note?: string
  active: boolean                 // false when superseded (history keeps the row)
  recordedAt: ISOTime
  recordedBy?: ID
  treatmentItemId?: ID            // the work that fixed / caused this state
}

export type TreatmentStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface TreatmentPlan {
  id: ID
  patientId: ID
  doctorId?: ID
  title: string
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  createdAt: ISOTime
  updatedAt: ISOTime
}

export interface TreatmentItem {
  id: ID
  patientId: ID
  planId?: ID
  procedureId?: ID
  procedureName: string           // snapshot, so renaming a procedure never rewrites history
  tooth?: number
  surfaces?: ToothSurface[]
  price: number
  discount: number                // absolute amount
  status: TreatmentStatus
  doctorId?: ID
  appointmentId?: ID
  invoiceId?: ID                  // set once billed
  notes?: string
  plannedDate?: ISODate
  completedAt?: ISOTime
  createdAt: ISOTime
  updatedAt: ISOTime
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled'
export interface InvoiceItem {
  id: ID
  treatmentItemId?: ID
  procedureId?: ID
  description: string
  tooth?: number
  qty: number
  unitPrice: number
  discount: number                // absolute amount for the line
  total: number                   // qty * unitPrice - discount
}
export interface Invoice {
  id: ID
  number: string                  // 'INV-000123'
  patientId: ID
  doctorId?: ID
  date: ISODate
  dueDate?: ISODate
  items: InvoiceItem[]
  subtotal: number
  discount: number                // invoice-level discount
  taxPercent: number
  tax: number
  total: number
  paid: number                    // cached sum of payments
  status: InvoiceStatus
  notes?: string
  createdAt: ISOTime
  updatedAt: ISOTime
  createdBy?: ID
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'insurance' | 'wallet' | 'other'
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'insurance', 'wallet', 'other']
export interface Payment {
  id: ID
  patientId: ID
  invoiceId?: ID                  // undefined = payment on account (credit)
  amount: number                  // negative = refund
  method: PaymentMethod
  date: ISODate
  reference?: string
  note?: string
  receivedBy?: ID
  createdAt: ISOTime
}

export interface Drug {
  id: ID
  name: string
  nameEn?: string
  form?: string                   // tablet, capsule, syrup, mouthwash, gel…
  strength?: string               // '500 mg'
  defaultDose?: string
  defaultFrequency?: string
  defaultDuration?: string
  defaultInstructions?: string
  active: boolean
  createdAt: ISOTime
}
export interface PrescriptionItem {
  id: ID
  drugId?: ID
  name: string
  strength?: string
  dose: string
  frequency: string
  duration: string
  instructions?: string
}
export interface Prescription {
  id: ID
  patientId: ID
  doctorId: ID
  date: ISODate
  items: PrescriptionItem[]
  diagnosis?: string
  notes?: string
  createdAt: ISOTime
  updatedAt: ISOTime
}

export type LabOrderType = 'crown' | 'bridge' | 'veneer' | 'inlay_onlay' | 'denture_full' | 'denture_partial' | 'implant_crown' | 'night_guard' | 'retainer' | 'aligner' | 'post_core' | 'other'
export type LabOrderStatus = 'draft' | 'sent' | 'in_progress' | 'received' | 'fitted' | 'remake' | 'cancelled'
export const LAB_ORDER_TYPES: LabOrderType[] = ['crown', 'bridge', 'veneer', 'inlay_onlay', 'denture_full', 'denture_partial', 'implant_crown', 'night_guard', 'retainer', 'aligner', 'post_core', 'other']
export const LAB_ORDER_STATUSES: LabOrderStatus[] = ['draft', 'sent', 'in_progress', 'received', 'fitted', 'remake', 'cancelled']
export interface LabOrder {
  id: ID
  patientId: ID
  doctorId?: ID
  labName: string
  type: LabOrderType
  teeth: number[]
  shade?: string
  material?: string
  sentDate?: ISODate
  dueDate?: ISODate
  receivedDate?: ISODate
  status: LabOrderStatus
  cost: number
  notes?: string
  treatmentItemId?: ID
  createdAt: ISOTime
  updatedAt: ISOTime
}

export interface InventoryItem {
  id: ID
  name: string
  category: string                // free text / preset: consumables, instruments, materials, medications, office
  sku?: string
  unit: string                    // piece, box, pack, ml, g
  quantity: number
  minQuantity: number
  costPrice?: number
  supplier?: string
  expiryDate?: ISODate
  location?: string
  notes?: string
  active: boolean
  createdAt: ISOTime
  updatedAt: ISOTime
}
export type StockReason = 'purchase' | 'use' | 'adjust' | 'expired' | 'return' | 'initial'
export interface StockMovement {
  id: ID
  itemId: ID
  delta: number                   // + in, - out
  reason: StockReason
  date: ISODate
  note?: string
  by?: ID
  createdAt: ISOTime
}

export type ExpenseCategory = 'rent' | 'salaries' | 'materials' | 'lab' | 'equipment' | 'utilities' | 'marketing' | 'maintenance' | 'taxes' | 'other'
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['rent', 'salaries', 'materials', 'lab', 'equipment', 'utilities', 'marketing', 'maintenance', 'taxes', 'other']
export interface Expense {
  id: ID
  category: ExpenseCategory
  amount: number
  date: ISODate
  description: string
  method?: PaymentMethod
  vendor?: string
  by?: ID
  createdAt: ISOTime
}

export type FileKind = 'xray' | 'photo' | 'document' | 'consent' | 'other'
export interface PatientFile {
  id: ID
  patientId: ID
  kind: FileKind
  name: string
  mime: string
  size: number
  data: Blob
  thumb?: string                  // small data URL for images
  note?: string
  tooth?: number
  createdAt: ISOTime
  by?: ID
}

export interface ClinicalNote {
  id: ID
  patientId: ID
  appointmentId?: ID
  doctorId?: ID
  date: ISODate
  text: string
  createdAt: ISOTime
  updatedAt: ISOTime
}

export type ActivityType = 'patient' | 'appointment' | 'treatment' | 'invoice' | 'payment' | 'prescription' | 'lab' | 'inventory' | 'expense' | 'system'
export interface Activity {
  id: ID
  type: ActivityType
  action: 'create' | 'update' | 'delete' | 'status' | 'login' | 'backup' | 'other'
  entityId?: ID
  patientId?: ID
  message: string                 // short, in the clinic language at the time
  at: ISOTime
  by?: ID
}

/** Key–value store for everything that is not a table: license, session, UI preferences, counters. */
export interface Setting { key: string; value: unknown }

export interface BackupFile {
  app: 'dentora'
  version: number                 // schema version
  exportedAt: ISOTime
  tables: Record<string, unknown[]>
}
