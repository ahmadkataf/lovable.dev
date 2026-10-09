import type { DashboardStats, ReportData } from '../shared/types'
import { computeDashboard, computeReports } from '../shared/stats'
import type { Database } from './db'
import { listLedger, listOrders, listProducts, listTickets } from './db'

export async function dashboard(db: Database): Promise<DashboardStats> {
  const [orders, tickets, products, ledger] = await Promise.all([listOrders(db, { limit: 5000 }), listTickets(db, { limit: 5000 }), listProducts(db, false), listLedger(db)])
  return computeDashboard(orders, tickets, products, ledger)
}

export async function reports(db: Database, from: string, to: string): Promise<ReportData> {
  const [orders, tickets, ledger] = await Promise.all([listOrders(db, { limit: 5000 }), listTickets(db, { limit: 5000 }), listLedger(db, { from, to })])
  return computeReports(orders, tickets, ledger, from, to)
}
