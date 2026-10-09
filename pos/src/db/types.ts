// The data model. Everything lives on the device (IndexedDB through Dexie); money is a plain number
// rounded to the currency's decimals (lib/money.ts). Times are ms since 1970.
export type ID = string

export interface Category {
  id: ID
  name: string
  color: string        // hex, used on cards and chips
  icon?: string        // an emoji
  sort: number
  createdAt: number
}

export interface Product {
  id: ID
  name: string
  barcodes: string[]   // any number of barcodes; the first is the main one
  sku?: string
  categoryId?: ID
  price: number        // selling price
  cost: number         // what it cost us (for profit reports)
  trackStock: boolean
  stock: number
  lowStock: number     // warn when stock <= lowStock; 0 = never
  unit: string         // key in 'unit.*' messages, or free text
  allowFraction: boolean   // weighed goods: 0.25 kg
  taxRate?: number     // percent; undefined = the store default
  color?: string       // card colour when there is no image
  emoji?: string
  image?: string       // small data: URL
  favorite: boolean
  active: boolean
  notes?: string
  expiry?: number      // ms (local midnight): the batch on the shelf expires then; undefined = not tracked
  createdAt: number
  updatedAt: number
}

/** Days until a product expires (negative = expired); null when not tracked. */
export function daysToExpiry(p: Pick<Product, 'expiry'>, now = Date.now()): number | null {
  if (!p.expiry) return null
  return Math.ceil((p.expiry - now) / 86400000)
}
/** Expired or expiring within `within` days. */
export const EXPIRY_WARN_DAYS = 30
export const isExpiring = (p: Pick<Product, 'expiry'>, within = EXPIRY_WARN_DAYS, now = Date.now()): boolean => { const d = daysToExpiry(p, now); return d !== null && d <= within }

export interface Customer {
  id: ID
  name: string
  phone?: string
  address?: string
  notes?: string
  balance: number      // what the customer owes us (debt); negative = we owe them
  createdAt: number
  updatedAt: number
}

export interface Supplier {
  id: ID
  name: string
  phone?: string
  notes?: string
  balance: number      // what we owe the supplier
  createdAt: number
}

export type PaymentMethod = 'cash' | 'card' | 'credit' | 'transfer'
export interface Payment { method: PaymentMethod; amount: number }

export interface SaleItem {
  productId?: ID       // undefined for a custom (typed) line
  name: string
  barcode?: string
  unit: string
  qty: number
  price: number        // unit price actually charged
  originalPrice: number
  cost: number         // unit cost at the time of sale
  discount: number     // line discount amount
  taxRate: number      // percent
  tax: number          // tax amount for the line (after the sale discount was spread)
  total: number        // qty * price - discount (before tax if tax is exclusive)
  note?: string
}

export type SaleStatus = 'completed' | 'refunded' | 'partial'

export interface Sale {
  id: ID
  number: number       // receipt number, grows by one
  createdAt: number
  items: SaleItem[]
  subtotal: number     // sum of line totals
  discount: number     // sale-level discount amount
  discountPct?: number
  tax: number
  total: number        // what the customer pays
  cost: number         // sum of item costs (for profit)
  payments: Payment[]
  paid: number         // cash/card/transfer received
  change: number       // cash handed back
  credit: number       // put on the customer's account
  fx?: FxPayment       // when (part of) the cash came in the second currency
  customerId?: ID
  customerName?: string
  userId: ID
  userName: string
  shiftId?: ID
  status: SaleStatus
  refunded: number     // total refunded so far
  note?: string
}

export interface Refund {
  id: ID
  saleId: ID
  saleNumber: number
  createdAt: number
  items: { productId?: ID; name: string; qty: number; price: number; total: number }[]
  total: number
  method: PaymentMethod   // how the money went back (credit = taken off the customer's debt)
  restock: boolean
  reason?: string
  customerId?: ID
  userId: ID
  userName: string
  shiftId?: ID
}

export type StockMoveType = 'sale' | 'refund' | 'purchase' | 'adjust' | 'initial' | 'import' | 'count'
export interface StockMove {
  id: ID
  productId: ID
  qty: number          // + in, - out
  type: StockMoveType
  refId?: ID           // sale, refund, purchase id
  note?: string
  before: number
  after: number
  createdAt: number
  userId?: ID
}

export interface PurchaseItem { productId: ID; name: string; qty: number; cost: number }
export interface Purchase {
  id: ID
  number: number
  createdAt: number
  supplierId?: ID
  supplierName?: string
  items: PurchaseItem[]
  total: number
  paid: number
  note?: string
  userId: ID
}

export type LedgerType = 'sale' | 'payment' | 'refund' | 'adjust'
export interface LedgerEntry {
  id: ID
  customerId: ID
  type: LedgerType
  amount: number       // + increases the debt (a sale on credit), - decreases it (a payment)
  balanceAfter: number
  refId?: ID
  note?: string
  method?: PaymentMethod
  createdAt: number
  userId: ID
  shiftId?: ID
}

export interface Expense {
  id: ID
  amount: number
  category: string
  note?: string
  createdAt: number
  userId: ID
  shiftId?: ID
}

export interface Shift {
  id: ID
  userId: ID
  userName: string
  openedAt: number
  closedAt?: number
  openingCash: number
  closingCash?: number    // what was counted
  expectedCash?: number   // opening + cash sales - cash refunds + in - out - cash expenses
  cashIn: number
  cashOut: number
  note?: string
  status: 'open' | 'closed'
}

export interface CashMove {
  id: ID
  shiftId: ID
  type: 'in' | 'out'
  amount: number
  note?: string
  createdAt: number
  userId: ID
}

export type Role = 'admin' | 'cashier'
export interface User {
  id: ID
  name: string
  pinHash?: string     // sha256(salt + pin); no PIN = opens without one
  role: Role
  active: boolean
  createdAt: number
}

export interface HeldTicket {
  id: ID
  name: string
  cart: unknown        // a lib/cart Cart
  createdAt: number
  userId: ID
}

export interface KV { key: string; value: unknown }

/** Sensitive actions, kept so the owner can see who did what. */
export type AuditKind =
  | 'sale.discount' | 'sale.priceOverride' | 'refund' | 'product.delete' | 'product.price' | 'stock.adjust'
  | 'user.add' | 'user.change' | 'user.remove' | 'backup.restore' | 'data.reset' | 'shift.close' | 'customer.adjust'
export interface AuditEntry {
  id: ID
  createdAt: number
  userId?: ID
  userName?: string
  kind: AuditKind
  detail: string       // a short sentence in the UI language at the time
  refId?: ID           // the sale / refund / product / shift it concerns
  amount?: number
}

/** What a cashier (role 'cashier') may do; admins may do everything. */
export interface Permissions {
  cashierDiscount: boolean
  cashierPriceOverride: boolean
  cashierRefund: boolean
  cashierSeeCost: boolean
  cashierEditProducts: boolean
  cashierAdjustStock: boolean
  cashierSeeHistory: boolean
}
export const DEFAULT_PERMISSIONS: Permissions = { cashierDiscount: true, cashierPriceOverride: true, cashierRefund: true, cashierSeeCost: false, cashierEditProducts: false, cashierAdjustStock: false, cashierSeeHistory: true }

/** Barcodes printed by a label scale: <prefix><PLU><value><check>, 13 digits. The PLU is the product's barcode. */
export interface ScaleBarcodes {
  enabled: boolean
  prefix: string          // '2' (EAN-13 in-store range) or '20'..'29'
  pluDigits: 4 | 5        // digits of the product code after the prefix
  value: 'weight' | 'price'   // what the 5 value digits mean
  valueDecimals: number   // weight: 3 (grams → kg); price: the currency's decimals (0 for lira)
}
export interface CurrencySettings { code: string; symbol: string; decimals: number; symbolAfter: boolean }
/** A second currency the till accepts (dollars in a lira shop): `rate` primary units per 1 unit of it. Records stay in the primary. */
export interface SecondCurrency extends CurrencySettings { enabled: boolean; rate: number }
/** What was received in the second currency on a sale. */
export interface FxPayment { code: string; symbol: string; symbolAfter: boolean; decimals: number; rate: number; received: number; receivedPrimary: number }
export interface TaxSettings { enabled: boolean; rate: number; inclusive: boolean; label: string }
export interface Settings {
  store: { name: string; phone: string; address: string; logo?: string; taxNumber?: string }
  currency: CurrencySettings
  currency2: SecondCurrency
  tax: TaxSettings
  receipt: {
    header: string
    footer: string
    paper: 58 | 80
    showLogo: boolean
    autoPrint: boolean
    printerName?: string
    copies: number
    showBarcode: boolean   // the receipt number as a barcode
  }
  pos: {
    defaultMethod: PaymentMethod
    quickAmounts: number[]
    allowNegativeStock: boolean
    soundOn: boolean
    vibrate: boolean
    gridSize: 'small' | 'medium' | 'large'
    showStockOnCards: boolean
    requirePin: boolean
    lockAfterMinutes: number   // 0 = never
    askPrintAfterSale: boolean
    cameraScanner: boolean
    cloudAuto: boolean         // daily cloud backup while the cloud plan is active
    scale: ScaleBarcodes       // weight / price embedded barcodes printed by label scales
  }
  permissions: Permissions
  lang: 'ar' | 'en'
  theme: 'light' | 'dark' | 'system'
  onboarded: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  store: { name: '', phone: '', address: '' },
  currency: { code: 'SYP', symbol: 'ل.س', decimals: 0, symbolAfter: true },
  currency2: { enabled: false, code: 'USD', symbol: '$', decimals: 2, symbolAfter: false, rate: 0 },
  tax: { enabled: false, rate: 0, inclusive: true, label: 'ضريبة' },
  receipt: { header: '', footer: 'شكراً لزيارتكم', paper: 80, showLogo: true, autoPrint: false, copies: 1, showBarcode: true },
  pos: {
    defaultMethod: 'cash', quickAmounts: [], allowNegativeStock: true, soundOn: true, vibrate: true,
    gridSize: 'medium', showStockOnCards: true, requirePin: false, lockAfterMinutes: 0, askPrintAfterSale: true, cameraScanner: true, cloudAuto: true,
    scale: { enabled: false, prefix: '2', pluDigits: 5, value: 'weight', valueDecimals: 3 },
  },
  permissions: { ...DEFAULT_PERMISSIONS },
  lang: 'ar',
  theme: 'system',
  onboarded: false,
}

/** Currencies offered in settings; the user can also type any symbol. */
export const CURRENCIES: CurrencySettings[] = [
  { code: 'SYP', symbol: 'ل.س', decimals: 0, symbolAfter: true },
  { code: 'USD', symbol: '$', decimals: 2, symbolAfter: false },
  { code: 'TRY', symbol: '₺', decimals: 2, symbolAfter: false },
  { code: 'EUR', symbol: '€', decimals: 2, symbolAfter: false },
  { code: 'SAR', symbol: 'ر.س', decimals: 2, symbolAfter: true },
  { code: 'AED', symbol: 'د.إ', decimals: 2, symbolAfter: true },
  { code: 'EGP', symbol: 'ج.م', decimals: 2, symbolAfter: true },
  { code: 'IQD', symbol: 'د.ع', decimals: 0, symbolAfter: true },
  { code: 'JOD', symbol: 'د.أ', decimals: 3, symbolAfter: true },
  { code: 'LBP', symbol: 'ل.ل', decimals: 0, symbolAfter: true },
  { code: 'KWD', symbol: 'د.ك', decimals: 3, symbolAfter: true },
  { code: 'QAR', symbol: 'ر.ق', decimals: 2, symbolAfter: true },
  { code: 'MAD', symbol: 'د.م', decimals: 2, symbolAfter: true },
  { code: 'DZD', symbol: 'د.ج', decimals: 2, symbolAfter: true },
  { code: 'TND', symbol: 'د.ت', decimals: 3, symbolAfter: true },
  { code: 'LYD', symbol: 'د.ل', decimals: 3, symbolAfter: true },
  { code: 'YER', symbol: 'ر.ي', decimals: 0, symbolAfter: true },
  { code: 'OMR', symbol: 'ر.ع', decimals: 3, symbolAfter: true },
  { code: 'BHD', symbol: 'د.ب', decimals: 3, symbolAfter: true },
  { code: 'SDG', symbol: 'ج.س', decimals: 2, symbolAfter: true },
]
