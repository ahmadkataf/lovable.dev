// Dashboard and report figures, computed from plain arrays so the API and the offline preview share one definition.
import type { DashboardStats, LedgerEntry, Order, Product, RepairTicket, ReportData } from './types'

export const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10)
export const COUNTED_ORDER_STATUSES: Order['status'][] = ['confirmed', 'processing', 'shipped', 'delivered']

export function computeDashboard(orders: Order[], tickets: RepairTicket[], products: Product[], ledger: LedgerEntry[]): DashboardStats {
  const today = dayOf(Date.now())
  const month = today.slice(0, 7)
  const ordersByStatus: Record<string, number> = {}
  const ticketsByStatus: Record<string, number> = {}
  let salesToday = 0, salesMonth = 0
  for (const o of orders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1
    if (!COUNTED_ORDER_STATUSES.includes(o.status)) continue
    const d = dayOf(o.createdAt)
    if (d === today) salesToday += o.total
    if (d.startsWith(month)) salesMonth += o.total
  }
  for (const t of tickets) ticketsByStatus[t.status] = (ticketsByStatus[t.status] || 0) + 1
  let incomeMonth = 0, expenseMonth = 0
  for (const l of ledger) if (l.date.startsWith(month)) (l.type === 'income' ? (incomeMonth += l.amount) : (expenseMonth += l.amount))
  const sorted = (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt
  const lowStock = products.filter(p => p.active && p.stock <= 2).slice(0, 10).map(p => ({ id: p.id, name: p.name, stock: p.stock }))
  const demoCount = products.filter(p => p.demo).length + orders.filter(o => o.demo).length + tickets.filter(t => t.demo).length + ledger.filter(l => l.demo).length
  return {
    ordersByStatus, ticketsByStatus, salesToday, salesMonth, incomeMonth, expenseMonth, lowStock,
    recentOrders: [...orders].sort(sorted).slice(0, 6), recentTickets: [...tickets].sort(sorted).slice(0, 6), productCount: products.length, demoCount,
  }
}

export function computeReports(orders: Order[], tickets: RepairTicket[], ledger: LedgerEntry[], from: string, to: string): ReportData {
  const inRange = (d: string) => d >= from && d <= to
  const daily = new Map<string, ReportData['daily'][number]>()
  const monthly = new Map<string, ReportData['monthly'][number]>()
  const bucket = (date: string) => {
    if (!daily.has(date)) daily.set(date, { date, sales: 0, orders: 0, income: 0, expense: 0 })
    const m = date.slice(0, 7)
    if (!monthly.has(m)) monthly.set(m, { month: m, sales: 0, orders: 0, income: 0, expense: 0 })
    return [daily.get(date)!, monthly.get(m)!]
  }
  const top = new Map<string, ReportData['topProducts'][number]>()
  let orderCount = 0
  for (const o of orders) {
    const d = dayOf(o.createdAt)
    if (!inRange(d) || !COUNTED_ORDER_STATUSES.includes(o.status)) continue
    orderCount++
    for (const b of bucket(d)) { b.sales += o.total; b.orders += 1 }
    for (const it of o.items) {
      const t = top.get(it.productId) || { productId: it.productId, name: it.name, qty: 0, revenue: 0 }
      t.qty += it.qty; t.revenue += it.qty * it.price
      top.set(it.productId, t)
    }
  }
  const byCat = new Map<string, ReportData['ledgerByCategory'][number]>()
  let income = 0, expense = 0
  for (const l of ledger) {
    if (!inRange(l.date)) continue
    for (const b of bucket(l.date)) (l.type === 'income' ? (b.income += l.amount) : (b.expense += l.amount))
    l.type === 'income' ? (income += l.amount) : (expense += l.amount)
    const k = `${l.type}:${l.category}`
    const c = byCat.get(k) || { category: l.category, type: l.type, amount: 0 }
    c.amount += l.amount
    byCat.set(k, c)
  }
  const ticketCount = tickets.filter(t => inRange(dayOf(t.createdAt)) && t.status !== 'cancelled').length
  return {
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    topProducts: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    ledgerByCategory: [...byCat.values()].sort((a, b) => b.amount - a.amount),
    totals: { income, expense, orders: orderCount, tickets: ticketCount },
  }
}
