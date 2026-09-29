// The shop's data. Every record carries an id and the time of its last change, so that the devices
// (the shop computer, the phones and the website) can exchange changes and keep the newest one.

export interface Base {
  id: string
  updatedAt: number
  deleted?: boolean
}

export type ProductKind = 'product' | 'service'

export interface Product extends Base {
  code: string            // رقم القطعة / الكود
  barcode?: string
  name: string
  categoryId?: string
  brand?: string          // الماركة / الشركة الصانعة للقطعة
  cars?: string           // السيارات التي تناسبها (نص حر)
  carModelIds?: string[]  // موديلات من دليل السيارات تناسبها هذه القطعة
  oemNumbers?: string     // أرقام القطعة الأصلية والبديلة، مفصولة بفواصل
  unit: string            // قطعة، علبة، لتر…
  cost: number            // سعر الشراء
  price: number           // سعر البيع
  wholesalePrice?: number // سعر الجملة
  minStock: number        // حد التنبيه
  openingStock: number    // الكمية الافتتاحية عند الإضافة
  location?: string       // مكان القطعة في المحل (رف)
  notes?: string
  kind: ProductKind       // خدمة = لا تخضع للمخزون (مثل أجرة تركيب)
  image?: string          // data URL, small
  createdAt: number
}

export interface Category extends Base {
  name: string
}

export interface Customer extends Base {
  name: string
  phone?: string
  car?: string            // سيارة العميل
  vin?: string            // رقم الشاصي
  carModelId?: string     // موديل من دليل السيارات
  plate?: string          // رقم اللوحة
  discountPct?: number    // خصم دائم للعميل (%) يُطبَّق على فواتيره
  address?: string
  notes?: string
  openingBalance: number  // دين سابق عليه (موجب = علينا تحصيله)
  createdAt: number
}

export interface Supplier extends Base {
  name: string
  phone?: string
  address?: string
  notes?: string
  openingBalance: number  // دين سابق له علينا
  createdAt: number
}

export interface InvoiceItem {
  productId?: string
  name: string
  code?: string
  qty: number
  price: number           // سعر الوحدة
  cost: number            // كلفة الوحدة وقت البيع (للربح)
  discount: number        // خصم على السطر بالقيمة
  unit?: string
  kind: ProductKind
}

export type PayStatus = 'paid' | 'partial' | 'unpaid'

export interface Sale extends Base {
  number: number
  type: 'sale' | 'return'
  date: number
  customerId?: string
  customerName: string
  items: InvoiceItem[]
  subtotal: number
  discount: number        // خصم على الفاتورة
  total: number
  paid: number            // المدفوع عند إنشاء الفاتورة
  notes?: string
  userId?: string
  returnOf?: string       // للمرتجع: الفاتورة الأصلية
  rate?: number           // سعر الدولار يوم الفاتورة (ليرة لكل دولار)
  currency?: string       // رمز العملة التي كُتبت بها المبالغ
}

export interface PurchaseItem {
  productId: string
  name: string
  code?: string
  qty: number
  cost: number
}

export interface Purchase extends Base {
  number: number
  type: 'purchase' | 'return'
  date: number
  supplierId?: string
  supplierName: string
  reference?: string      // رقم فاتورة المورد
  items: PurchaseItem[]
  total: number
  paid: number
  notes?: string
  userId?: string
  rate?: number
  currency?: string
}

export type PartyType = 'customer' | 'supplier'

// دفعة: تحصيل من عميل (in) أو دفع لمورد (out)
export interface Payment extends Base {
  date: number
  partyType: PartyType
  partyId: string
  partyName: string
  amount: number
  note?: string
  userId?: string
}

export interface Expense extends Base {
  date: number
  category: string        // إيجار، كهرباء، رواتب…
  amount: number
  note?: string
  userId?: string
}

// حركة يدوية على الصندوق: إيداع (in) أو سحب (out) لا يخص عميلاً أو مورداً
export interface CashEntry extends Base {
  date: number
  direction: 'in' | 'out'
  amount: number
  note?: string
  userId?: string
}

export type MovementReason = 'sale' | 'sale_return' | 'purchase' | 'purchase_return' | 'adjust' | 'opening'

export interface StockMovement extends Base {
  productId: string
  date: number
  qty: number             // + يدخل المخزون، - يخرج
  reason: MovementReason
  refId?: string          // الفاتورة المسببة
  note?: string
  userId?: string
}

export type Role = 'admin' | 'staff'

export interface User extends Base {
  name: string
  pinHash: string
  pinSalt?: string        // موجود = الرقم السري مخزّن بـ PBKDF2 مع ملح؛ غائب = سجل قديم (SHA-256)
  pinIterations?: number
  role: Role
  createdAt: number
}

// دليل السيارات: الموديلات التي يتعامل معها المحل، لتُربط بها القطع
export interface CarModel extends Base {
  make: string            // الشركة: كيا، هيونداي…
  model: string           // الموديل: ريو، إلنترا…
  yearFrom?: number
  yearTo?: number
  engine?: string         // 1.6، 2.0 ديزل…
  notes?: string
}

export type AuditAction = 'create' | 'update' | 'delete' | 'restore' | 'login' | 'settings' | 'stock' | 'backup'

// من فعل ماذا ومتى: كل عملية مهمة تترك أثراً يراه المدير
export interface AuditEntry extends Base {
  date: number
  userId?: string
  userName: string
  action: AuditAction
  collection?: CollectionName
  refId?: string
  summary: string
  device: string
}

export type CurrencyCode = 'SYP' | 'USD'
export type CurrencyDisplay = 'base' | 'other' | 'both'

export interface Settings extends Base {
  shopName: string
  phone?: string
  address?: string
  currency: string        // الاسم المختصر الذي يظهر بجانب الأرقام (رمز العملة الأساسية)
  decimals: number
  baseCurrency: CurrencyCode   // العملة التي تُحفظ بها كل الأسعار والمبالغ
  rate: number                 // كم ليرة سورية يساوي الدولار الواحد
  display: CurrencyDisplay     // ما يظهر على الشاشة: الأساسية، الأخرى، أو كلتاهما
  invoiceFooter?: string
  logo?: string           // data URL
  printSize: 'a4' | '80mm'
  lowStockDefault: number
  theme: 'light' | 'dark' | 'auto'
  setupDone: boolean
  staffSeesCost: boolean  // هل يرى الموظف سعر الشراء والأرباح
  staffEditsPrices: boolean // هل يعدّل الموظف الأسعار والقطع
  autoLockMinutes: number   // قفل البرنامج بعد دقائق من الخمول (0 = لا)
  expenseCategories: string[]
  units: string[]
  sync: { url: string; key: string; enabled: boolean }
}

export interface Collections {
  products: Product
  categories: Category
  customers: Customer
  suppliers: Supplier
  sales: Sale
  purchases: Purchase
  payments: Payment
  expenses: Expense
  cash: CashEntry
  movements: StockMovement
  users: User
  settings: Settings
  audit: AuditEntry
  carModels: CarModel
}

export type CollectionName = keyof Collections
export const COLLECTIONS: CollectionName[] = ['products', 'categories', 'customers', 'suppliers', 'sales', 'purchases', 'payments', 'expenses', 'cash', 'movements', 'users', 'settings', 'audit', 'carModels']
export const COLLECTION_LABELS: Record<CollectionName, string> = { products: 'قطعة', categories: 'تصنيف', customers: 'عميل', suppliers: 'مورد', sales: 'فاتورة بيع', purchases: 'فاتورة شراء', payments: 'دفعة', expenses: 'مصروف', cash: 'حركة صندوق', movements: 'حركة مخزون', users: 'مستخدم', settings: 'الإعدادات', audit: 'سجل', carModels: 'موديل سيارة' }

export const SETTINGS_ID = 'main'

export const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  updatedAt: 0,
  shopName: 'كراج الرضوان',
  phone: '',
  address: '',
  currency: 'ل.س',
  decimals: 0,
  baseCurrency: 'SYP',
  rate: 0,
  display: 'base',
  invoiceFooter: 'شكراً لتعاملكم معنا',
  printSize: 'a4',
  lowStockDefault: 2,
  theme: 'auto',
  setupDone: false,
  staffSeesCost: false,
  staffEditsPrices: true,
  autoLockMinutes: 0,
  expenseCategories: ['إيجار', 'كهرباء', 'رواتب', 'مواصلات', 'ضيافة', 'صيانة', 'أخرى'],
  units: ['قطعة', 'علبة', 'طقم', 'لتر', 'متر', 'كرتونة'],
  sync: { url: '', key: '', enabled: false },
}
