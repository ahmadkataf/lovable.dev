import Dexie, { type Table } from 'dexie'
import type {
  Category, Product, Customer, Supplier, Sale, Refund, StockMove, Purchase, LedgerEntry, Expense, Shift, CashMove, User, HeldTicket, KV, Settings,
} from './types'
import { DEFAULT_SETTINGS } from './types'
import { uid } from '../lib/ids'

export class KasherDB extends Dexie {
  products!: Table<Product, string>
  categories!: Table<Category, string>
  customers!: Table<Customer, string>
  suppliers!: Table<Supplier, string>
  sales!: Table<Sale, string>
  refunds!: Table<Refund, string>
  stockMoves!: Table<StockMove, string>
  purchases!: Table<Purchase, string>
  ledger!: Table<LedgerEntry, string>
  expenses!: Table<Expense, string>
  shifts!: Table<Shift, string>
  cashMoves!: Table<CashMove, string>
  users!: Table<User, string>
  heldTickets!: Table<HeldTicket, string>
  kv!: Table<KV, string>

  constructor(name = 'kasher') {
    super(name)
    this.version(1).stores({
      products: 'id, name, *barcodes, sku, categoryId, updatedAt, favorite, active, stock',
      categories: 'id, sort, name',
      customers: 'id, name, phone, updatedAt, balance',
      suppliers: 'id, name',
      sales: 'id, number, createdAt, customerId, userId, shiftId, status',
      refunds: 'id, saleId, createdAt, userId, shiftId, customerId',
      stockMoves: 'id, productId, createdAt, type, refId',
      purchases: 'id, number, createdAt, supplierId',
      ledger: 'id, customerId, createdAt, type, refId, shiftId',
      expenses: 'id, createdAt, category, shiftId',
      shifts: 'id, status, openedAt, userId',
      cashMoves: 'id, shiftId, createdAt',
      users: 'id, name, active',
      heldTickets: 'id, createdAt, userId',
      kv: 'key',
    })
  }
}

export const db = new KasherDB()

/** Every table, for backups. Keep in the order they should be restored. */
export const TABLES = ['categories', 'products', 'customers', 'suppliers', 'users', 'shifts', 'cashMoves', 'sales', 'refunds', 'stockMoves', 'purchases', 'ledger', 'expenses', 'heldTickets', 'kv'] as const
export type TableName = (typeof TABLES)[number]

const SETTINGS_KEY = 'settings'

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get(SETTINGS_KEY)
  return mergeSettings(row?.value as Partial<Settings> | undefined)
}
/** Fills in anything a stored (older) settings object lacks. */
export function mergeSettings(s?: Partial<Settings>): Settings {
  const d = DEFAULT_SETTINGS
  return {
    ...d, ...s,
    store: { ...d.store, ...s?.store },
    currency: { ...d.currency, ...s?.currency },
    tax: { ...d.tax, ...s?.tax },
    receipt: { ...d.receipt, ...s?.receipt },
    pos: { ...d.pos, ...s?.pos },
  }
}
export async function saveSettings(s: Settings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value: s })
}

/** The next receipt / purchase number: 'sale', 'purchase'. Safe inside or outside a transaction. */
export async function nextNumber(key: string): Promise<number> {
  return db.transaction('rw', db.kv, async () => {
    const k = `counter:${key}`
    const row = await db.kv.get(k)
    const n = ((row?.value as number | undefined) ?? 0) + 1
    await db.kv.put({ key: k, value: n })
    return n
  })
}

/** Called once at start: the admin user exists, and settings exist. */
export async function ensureDefaults(): Promise<void> {
  const users = await db.users.count()
  if (users === 0) {
    await db.users.add({ id: uid(), name: 'المدير', role: 'admin', active: true, createdAt: Date.now() })
  }
  const s = await db.kv.get(SETTINGS_KEY)
  if (!s) await saveSettings(DEFAULT_SETTINGS)
}
