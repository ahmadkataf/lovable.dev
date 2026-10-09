// Types shared by the site, the admin panel and the API.

export type ProductSpec = { label: string; value: string }

export interface Product {
  id: string
  name: string
  slug?: string
  brand: string
  category: string // category id
  /** drone models the part fits, e.g. ["mini-4-pro"]; empty for a stand-alone product */
  compatible: string[]
  price: number
  oldPrice?: number
  stock: number
  sku?: string
  short: string
  description: string
  specs: ProductSpec[]
  images: string[] // urls (/api/images/<id> or absolute)
  /** fallback illustration key when there is no photo */
  illustration: IllustrationKey
  featured: boolean
  active: boolean
  tags: string[]
  demo?: boolean
  createdAt: number
  updatedAt: number
}

export type IllustrationKey =
  | 'drone' | 'drone-fpv' | 'drone-pro' | 'battery' | 'propeller' | 'motor' | 'gimbal' | 'controller'
  | 'charger' | 'cable' | 'phone' | 'screen' | 'filter' | 'case' | 'arm' | 'tool' | 'laptop' | 'box'

export interface Category {
  id: string
  name: string
  description?: string
  icon: IllustrationKey
  parent?: string
  sort: number
  demo?: boolean
}

export interface DroneModel {
  id: string
  name: string
  series: string
  year?: number
  type: 'consumer' | 'fpv' | 'pro' | 'enterprise' | 'agri'
}

export interface CartItem {
  productId: string
  name: string
  price: number
  qty: number
  image?: string
  illustration?: IllustrationKey
}

export type OrderStatus = 'new' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface Customer {
  name: string
  phone: string
  city: string
  address: string
  notes?: string
}

export interface Order {
  id: string
  number: number
  customer: Customer
  items: CartItem[]
  subtotal: number
  shipping: number
  total: number
  currency: string
  status: OrderStatus
  whatsappSent: boolean
  adminNotes?: string
  history: { status: OrderStatus; at: number; note?: string }[]
  demo?: boolean
  createdAt: number
  updatedAt: number
}

export type TicketStatus = 'received' | 'diagnosing' | 'quoted' | 'repairing' | 'ready' | 'delivered' | 'cancelled'

export interface RepairTicket {
  id: string
  number: number
  customer: Customer
  deviceType: string // drone | phone | laptop | other
  brand: string
  model: string
  issue: string
  accessories?: string
  photos: string[]
  status: TicketStatus
  estimate?: number
  finalCost?: number
  partsCost?: number
  technicianNotes?: string
  whatsappSent: boolean
  history: { status: TicketStatus; at: number; note?: string }[]
  demo?: boolean
  createdAt: number
  updatedAt: number
}

export type LedgerType = 'income' | 'expense'

export interface LedgerEntry {
  id: string
  type: LedgerType
  amount: number
  currency: string
  category: string
  note: string
  date: string // YYYY-MM-DD
  ref?: { kind: 'order' | 'ticket'; id: string; number: number }
  demo?: boolean
  createdAt: number
}

export interface SiteSettings {
  siteName: string
  tagline: string
  logoImage?: string
  primaryColor: string
  accentColor: string
  theme: 'dark' | 'light'
  whatsapp: string // international digits, e.g. 963912345678
  phone: string
  email: string
  address: string
  city: string
  workingHours: string
  mapUrl?: string
  social: { facebook?: string; instagram?: string; telegram?: string; tiktok?: string; youtube?: string }
  currency: { code: string; symbol: string }
  secondaryCurrency: { enabled: boolean; code: string; symbol: string; rate: number }
  announcement: { enabled: boolean; text: string }
  hero: { eyebrow: string; title: string; highlight: string; subtitle: string; cta1: string; cta2: string; image?: string; stats: { value: string; label: string }[] }
  sections: {
    categories: boolean; featured: boolean; services: boolean; brands: boolean; why: boolean; testimonials: boolean; faq: boolean; cta: boolean
  }
  services: { title: string; description: string; icon: IllustrationKey; price?: string }[]
  why: { title: string; description: string }[]
  testimonials: { name: string; text: string; city?: string; rating: number }[]
  faq: { q: string; a: string }[]
  about: { title: string; body: string }
  footerText: string
  shipping: { note: string; freeAbove?: number; zones: { name: string; fee: number }[] }
  repair: { intro: string; deviceTypes: string[]; brands: string[] }
  seo: { title: string; description: string }
  demoCleared: boolean
}

export interface DashboardStats {
  ordersByStatus: Record<string, number>
  ticketsByStatus: Record<string, number>
  salesToday: number
  salesMonth: number
  incomeMonth: number
  expenseMonth: number
  lowStock: { id: string; name: string; stock: number }[]
  recentOrders: Order[]
  recentTickets: RepairTicket[]
  productCount: number
  demoCount: number
}

export interface ReportData {
  daily: { date: string; sales: number; orders: number; income: number; expense: number }[]
  monthly: { month: string; sales: number; orders: number; income: number; expense: number }[]
  topProducts: { productId: string; name: string; qty: number; revenue: number }[]
  ledgerByCategory: { category: string; type: LedgerType; amount: number }[]
  totals: { income: number; expense: number; orders: number; tickets: number }
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: 'جديد', color: '#3b82f6' },
  confirmed: { label: 'مؤكّد', color: '#8b5cf6' },
  processing: { label: 'قيد التجهيز', color: '#f59e0b' },
  shipped: { label: 'تم الشحن', color: '#06b6d4' },
  delivered: { label: 'تم التسليم', color: '#22c55e' },
  cancelled: { label: 'ملغى', color: '#ef4444' },
}

export const TICKET_STATUS: Record<TicketStatus, { label: string; color: string }> = {
  received: { label: 'تم الاستلام', color: '#3b82f6' },
  diagnosing: { label: 'قيد الفحص', color: '#8b5cf6' },
  quoted: { label: 'بانتظار موافقة العميل', color: '#f59e0b' },
  repairing: { label: 'قيد الإصلاح', color: '#f97316' },
  ready: { label: 'جاهز للاستلام', color: '#22c55e' },
  delivered: { label: 'تم التسليم', color: '#10b981' },
  cancelled: { label: 'ملغى', color: '#ef4444' },
}

export const ORDER_FLOW: OrderStatus[] = ['new', 'confirmed', 'processing', 'shipped', 'delivered']
export const TICKET_FLOW: TicketStatus[] = ['received', 'diagnosing', 'quoted', 'repairing', 'ready', 'delivered']

export const LEDGER_CATEGORIES = {
  income: ['مبيعات', 'صيانة', 'خدمات', 'أخرى'],
  expense: ['شراء بضاعة', 'قطع غيار', 'رواتب', 'إيجار', 'شحن', 'تسويق', 'فواتير', 'أخرى'],
}

export const DEVICE_TYPES = ['درون', 'هاتف', 'لابتوب', 'كاميرا / جيمبال', 'جهاز آخر']
