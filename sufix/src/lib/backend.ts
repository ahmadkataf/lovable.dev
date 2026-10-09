import type { Category, DashboardStats, DroneModel, LedgerEntry, Order, Product, RepairTicket, ReportData, SiteSettings } from '@shared/types'

export type Bootstrap = { settings: SiteSettings; categories: Category[]; products: Product[]; drones: DroneModel[] }
export type NewOrder = { customer: Order['customer']; items: { productId: string; qty: number }[]; zone?: string }
export type NewTicket = { customer: RepairTicket['customer']; deviceType: string; brand: string; model: string; issue: string; accessories?: string; photos?: string[]; estimate?: number }
export type TrackResult = { kind: 'order'; order: Order } | { kind: 'ticket'; ticket: RepairTicket }
export type Backup = { version: 1; exportedAt: number; settings: SiteSettings; categories: Category[]; products: Product[]; orders: Order[]; tickets: RepairTicket[]; ledger: LedgerEntry[] }

export interface Backend {
  bootstrap(): Promise<Bootstrap>
  product(id: string): Promise<Product>
  createOrder(o: NewOrder): Promise<Order>
  orderWhatsapp(id: string): Promise<void>
  createTicket(t: NewTicket): Promise<RepairTicket>
  ticketWhatsapp(id: string): Promise<void>
  track(number: string, phone: string): Promise<TrackResult>
  uploadImage(dataUrl: string): Promise<string>
  admin: {
    status(): Promise<{ setup: boolean; authed: boolean }>
    setup(password: string): Promise<void>
    login(password: string): Promise<void>
    logout(): Promise<void>
    changePassword(current: string, password: string): Promise<void>
    dashboard(): Promise<DashboardStats>
    reports(from: string, to: string): Promise<ReportData>
    products(): Promise<Product[]>
    saveProduct(p: Partial<Product>): Promise<Product>
    deleteProduct(id: string): Promise<void>
    categories(): Promise<Category[]>
    saveCategories(list: Category[]): Promise<Category[]>
    orders(q?: string, status?: string): Promise<Order[]>
    updateOrder(id: string, patch: Record<string, unknown>): Promise<Order>
    deleteOrder(id: string): Promise<void>
    tickets(q?: string, status?: string): Promise<RepairTicket[]>
    createTicket(t: NewTicket): Promise<RepairTicket>
    updateTicket(id: string, patch: Record<string, unknown>): Promise<RepairTicket>
    deleteTicket(id: string): Promise<void>
    ledger(from?: string, to?: string, type?: string): Promise<LedgerEntry[]>
    saveLedger(e: Partial<LedgerEntry>): Promise<LedgerEntry>
    deleteLedger(id: string): Promise<void>
    settings(): Promise<SiteSettings>
    saveSettings(s: SiteSettings): Promise<SiteSettings>
    clearDemo(): Promise<void>
    restoreDemo(): Promise<void>
    exportAll(): Promise<Backup>
    importAll(b: Backup): Promise<void>
  }
}
