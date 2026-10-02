// Double-entry accounting, derived from the shop's records. Every sale, purchase, payment, expense and
// stock movement becomes a journal entry on a fixed chart of accounts, so the ledger, the trial balance,
// the income statement and the balance sheet always agree with the invoices — nothing is typed twice.

import type { CashEntry, Customer, Expense, JournalEntry, Payment, Product, Purchase, Sale, StockMovement, Supplier } from '../db/types'

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export interface Account { code: string; name: string; type: AccountType }

export const ACC = {
  cash: '1100', receivable: '1200', inventory: '1300',
  payable: '2100', accrued: '2200',
  equity: '3100', drawings: '3200',
  sales: '4100', salesReturns: '4200', otherIncome: '4900',
  cogs: '5100', expenses: '5200', stockDiff: '5300',
} as const

export const FIXED_ACCOUNTS: Account[] = [
  { code: ACC.cash, name: 'الصندوق', type: 'asset' },
  { code: ACC.receivable, name: 'العملاء (ذمم مدينة)', type: 'asset' },
  { code: ACC.inventory, name: 'المخزون', type: 'asset' },
  { code: ACC.payable, name: 'الموردون (ذمم دائنة)', type: 'liability' },
  { code: ACC.accrued, name: 'مصاريف مستحقة وقروض', type: 'liability' },
  { code: ACC.equity, name: 'رأس المال', type: 'equity' },
  { code: ACC.drawings, name: 'مسحوبات صاحب المحل', type: 'equity' },
  { code: ACC.sales, name: 'المبيعات', type: 'revenue' },
  { code: ACC.salesReturns, name: 'مرتجعات المبيعات', type: 'revenue' },
  { code: ACC.otherIncome, name: 'إيرادات أخرى', type: 'revenue' },
  { code: ACC.cogs, name: 'تكلفة البضاعة المباعة', type: 'expense' },
  { code: ACC.stockDiff, name: 'فروقات الجرد', type: 'expense' },
]

/** Accounts a manual entry may not touch: the cash drawer and the parties' balances come from the Cash, Sales and Purchases screens. */
export const OPERATIONAL_ACCOUNTS: string[] = [ACC.cash, ACC.receivable, ACC.payable]

/** Expense categories get their own accounts under 5200. */
export function expenseAccount(category: string): Account {
  return { code: `${ACC.expenses}:${category}`, name: `مصاريف: ${category}`, type: 'expense' }
}

export interface Line { account: string; debit: number; credit: number; party?: string }
export interface Entry { id: string; date: number; memo: string; lines: Line[]; ref?: { type: 'sale' | 'purchase' | 'payment' | 'expense' | 'cash' | 'movement' | 'opening' | 'journal'; id: string } }

export interface Books { products: Map<string, Product>; customers: Map<string, Customer>; suppliers: Map<string, Supplier>; sales: Map<string, Sale>; purchases: Map<string, Purchase>; payments: Map<string, Payment>; expenses: Map<string, Expense>; cash: Map<string, CashEntry>; movements: Map<string, StockMovement>; journal: Map<string, JournalEntry> }

const r2 = (n: number) => Math.round(n * 100) / 100

/** Every journal entry the records imply, oldest first. */
export function buildJournal(b: Books): Entry[] {
  const out: Entry[] = []
  const E = (id: string, date: number, memo: string, lines: Line[], ref?: Entry['ref']) => { const ls = lines.filter(l => l.debit > 0.004 || l.credit > 0.004).map(l => ({ ...l, debit: r2(l.debit), credit: r2(l.credit) })); if (ls.length) out.push({ id, date, memo, lines: ls, ref }) }

  // opening balances: what the shop started with
  for (const c of b.customers.values()) if (c.openingBalance) E(`open-c-${c.id}`, c.createdAt, `رصيد افتتاحي للعميل ${c.name}`, c.openingBalance > 0 ? [{ account: ACC.receivable, debit: c.openingBalance, credit: 0, party: c.name }, { account: ACC.equity, debit: 0, credit: c.openingBalance }] : [{ account: ACC.equity, debit: -c.openingBalance, credit: 0 }, { account: ACC.receivable, debit: 0, credit: -c.openingBalance, party: c.name }], { type: 'opening', id: c.id })
  for (const s of b.suppliers.values()) if (s.openingBalance) E(`open-s-${s.id}`, s.createdAt, `رصيد افتتاحي للمورد ${s.name}`, s.openingBalance > 0 ? [{ account: ACC.equity, debit: s.openingBalance, credit: 0 }, { account: ACC.payable, debit: 0, credit: s.openingBalance, party: s.name }] : [{ account: ACC.payable, debit: -s.openingBalance, credit: 0, party: s.name }, { account: ACC.equity, debit: 0, credit: -s.openingBalance }], { type: 'opening', id: s.id })
  for (const p of b.products.values()) { const v = (p.openingStock || 0) * (p.cost || 0); if (p.kind === 'product' && v) E(`open-p-${p.id}`, p.createdAt, `رصيد افتتاحي للمخزون: ${p.name}`, [{ account: ACC.inventory, debit: v, credit: 0 }, { account: ACC.equity, debit: 0, credit: v }], { type: 'opening', id: p.id }) }

  for (const s of b.sales.values()) {
    if (s.type === 'quote') continue
    const cost = s.items.reduce((t, i) => t + (i.kind === 'service' ? 0 : (i.cost || 0) * i.qty), 0)
    const due = s.total - s.paid
    if (s.type === 'sale') {
      E(`sale-${s.id}`, s.date, `فاتورة بيع ${s.number} — ${s.customerName}`, [{ account: ACC.cash, debit: s.paid, credit: 0 }, { account: ACC.receivable, debit: due, credit: 0, party: s.customerName }, { account: ACC.sales, debit: 0, credit: s.total }], { type: 'sale', id: s.id })
      if (cost) E(`cogs-${s.id}`, s.date, `تكلفة بضاعة الفاتورة ${s.number}`, [{ account: ACC.cogs, debit: cost, credit: 0 }, { account: ACC.inventory, debit: 0, credit: cost }], { type: 'sale', id: s.id })
    } else {
      E(`ret-${s.id}`, s.date, `مرتجع مبيعات ${s.number} — ${s.customerName}`, [{ account: ACC.salesReturns, debit: s.total, credit: 0 }, { account: ACC.cash, debit: 0, credit: s.paid }, { account: ACC.receivable, debit: 0, credit: due, party: s.customerName }], { type: 'sale', id: s.id })
      if (cost) E(`cogs-${s.id}`, s.date, `إرجاع بضاعة المرتجع ${s.number} إلى المخزون`, [{ account: ACC.inventory, debit: cost, credit: 0 }, { account: ACC.cogs, debit: 0, credit: cost }], { type: 'sale', id: s.id })
    }
  }
  for (const p of b.purchases.values()) {
    const due = p.total - p.paid
    if (p.type === 'purchase') E(`pur-${p.id}`, p.date, `فاتورة شراء ${p.number} — ${p.supplierName}`, [{ account: ACC.inventory, debit: p.total, credit: 0 }, { account: ACC.cash, debit: 0, credit: p.paid }, { account: ACC.payable, debit: 0, credit: due, party: p.supplierName }], { type: 'purchase', id: p.id })
    else E(`pret-${p.id}`, p.date, `مرتجع شراء ${p.number} — ${p.supplierName}`, [{ account: ACC.cash, debit: p.paid, credit: 0 }, { account: ACC.payable, debit: due, credit: 0, party: p.supplierName }, { account: ACC.inventory, debit: 0, credit: p.total }], { type: 'purchase', id: p.id })
  }
  for (const pm of b.payments.values()) {
    if (pm.partyType === 'customer') E(`pay-${pm.id}`, pm.date, `تحصيل من ${pm.partyName}${pm.note ? ` — ${pm.note}` : ''}`, [{ account: ACC.cash, debit: pm.amount, credit: 0 }, { account: ACC.receivable, debit: 0, credit: pm.amount, party: pm.partyName }], { type: 'payment', id: pm.id })
    else E(`pay-${pm.id}`, pm.date, `دفع إلى ${pm.partyName}${pm.note ? ` — ${pm.note}` : ''}`, [{ account: ACC.payable, debit: pm.amount, credit: 0, party: pm.partyName }, { account: ACC.cash, debit: 0, credit: pm.amount }], { type: 'payment', id: pm.id })
  }
  for (const e of b.expenses.values()) E(`exp-${e.id}`, e.date, `مصروف ${e.category}${e.note ? ` — ${e.note}` : ''}`, [{ account: expenseAccount(e.category).code, debit: e.amount, credit: 0 }, { account: ACC.cash, debit: 0, credit: e.amount }], { type: 'expense', id: e.id })
  for (const c of b.cash.values()) {
    if (c.direction === 'in') E(`cash-${c.id}`, c.date, `إيداع في الصندوق${c.note ? ` — ${c.note}` : ''}`, [{ account: ACC.cash, debit: c.amount, credit: 0 }, { account: ACC.equity, debit: 0, credit: c.amount }], { type: 'cash', id: c.id })
    else E(`cash-${c.id}`, c.date, `سحب من الصندوق${c.note ? ` — ${c.note}` : ''}`, [{ account: ACC.drawings, debit: c.amount, credit: 0 }, { account: ACC.cash, debit: 0, credit: c.amount }], { type: 'cash', id: c.id })
  }
  for (const m of b.movements.values()) {
    if (m.reason !== 'adjust') continue
    const p = b.products.get(m.productId); if (!p) continue
    const v = Math.abs(m.qty) * (p.cost || 0); if (!v) continue
    if (m.qty > 0) E(`adj-${m.id}`, m.date, `زيادة جرد: ${p.name} (+${m.qty})`, [{ account: ACC.inventory, debit: v, credit: 0 }, { account: ACC.stockDiff, debit: 0, credit: v }], { type: 'movement', id: m.id })
    else E(`adj-${m.id}`, m.date, `نقص جرد: ${p.name} (${m.qty})`, [{ account: ACC.stockDiff, debit: v, credit: 0 }, { account: ACC.inventory, debit: 0, credit: v }], { type: 'movement', id: m.id })
  }
  for (const j of b.journal.values()) E(`j-${j.id}`, j.date, j.memo, j.lines.map(l => ({ account: l.account, debit: l.debit, credit: l.credit })), { type: 'journal', id: j.id })
  return out.sort((a, b2) => a.date - b2.date || a.id.localeCompare(b2.id))
}

/** All accounts that appear, fixed ones first, with their names. */
export function accountsOf(entries: Entry[], extraCategories: string[] = []): Account[] {
  const m = new Map<string, Account>(FIXED_ACCOUNTS.map(a => [a.code, a]))
  for (const c of extraCategories) m.set(expenseAccount(c).code, expenseAccount(c))
  for (const e of entries) for (const l of e.lines) if (!m.has(l.account)) m.set(l.account, l.account.startsWith(ACC.expenses + ':') ? expenseAccount(l.account.split(':').slice(1).join(':')) : { code: l.account, name: l.account, type: 'expense' })
  return Array.from(m.values()).sort((a, b) => a.code.localeCompare(b.code))
}

export const accountName = (code: string, accounts: Account[]) => accounts.find(a => a.code === code)?.name ?? code

/** Natural balance: debit for assets and expenses, credit for the rest; returned as a signed "balance" in that direction. */
export function natural(type: AccountType, debit: number, credit: number): number { return type === 'asset' || type === 'expense' ? debit - credit : credit - debit }

export interface TrialRow { account: Account; debit: number; credit: number; balance: number }
export function trialBalance(entries: Entry[], accounts: Account[], from: number, to: number): TrialRow[] {
  const sums = new Map<string, { d: number; c: number }>()
  for (const e of entries) { if (e.date < from || e.date > to) continue; for (const l of e.lines) { const s = sums.get(l.account) ?? { d: 0, c: 0 }; s.d += l.debit; s.c += l.credit; sums.set(l.account, s) } }
  return accounts.map(a => { const s = sums.get(a.code) ?? { d: 0, c: 0 }; return { account: a, debit: r2(s.d), credit: r2(s.c), balance: r2(natural(a.type, s.d, s.c)) } }).filter(r => r.debit || r.credit)
}

export interface LedgerRow { entry: Entry; debit: number; credit: number; balance: number }
/** One account's page: its lines in the range with a running balance that starts from everything before the range. */
export function ledger(entries: Entry[], account: Account, from: number, to: number): { opening: number; rows: LedgerRow[]; closing: number } {
  let bal = 0
  for (const e of entries) { if (e.date >= from) break; for (const l of e.lines) if (l.account === account.code) bal += natural(account.type, l.debit, l.credit) }
  const opening = r2(bal)
  const rows: LedgerRow[] = []
  for (const e of entries) {
    if (e.date < from || e.date > to) continue
    let d = 0, c = 0
    for (const l of e.lines) if (l.account === account.code) { d += l.debit; c += l.credit }
    if (!d && !c) continue
    bal += natural(account.type, d, c)
    rows.push({ entry: e, debit: r2(d), credit: r2(c), balance: r2(bal) })
  }
  return { opening, rows, closing: r2(bal) }
}

export interface IncomeStatement { sales: number; returns: number; netSales: number; cogs: number; grossProfit: number; expenses: { name: string; amount: number }[]; totalExpenses: number; stockDiff: number; otherIncome: number; netProfit: number }
export function incomeStatement(entries: Entry[], from: number, to: number): IncomeStatement {
  const sum = (pred: (code: string) => boolean, side: 'd' | 'c') => { let t = 0; for (const e of entries) { if (e.date < from || e.date > to) continue; for (const l of e.lines) if (pred(l.account)) t += side === 'd' ? l.debit : l.credit } return t }
  const sales = sum(c => c === ACC.sales, 'c') - sum(c => c === ACC.sales, 'd')
  const returns = sum(c => c === ACC.salesReturns, 'd') - sum(c => c === ACC.salesReturns, 'c')
  const cogs = sum(c => c === ACC.cogs, 'd') - sum(c => c === ACC.cogs, 'c')
  const byCat = new Map<string, number>()
  for (const e of entries) { if (e.date < from || e.date > to) continue; for (const l of e.lines) if (l.account.startsWith(ACC.expenses + ':')) byCat.set(l.account, (byCat.get(l.account) ?? 0) + l.debit - l.credit) }
  const expenses = Array.from(byCat.entries()).map(([code, amount]) => ({ name: code.split(':').slice(1).join(':'), amount: r2(amount) })).sort((a, b) => b.amount - a.amount)
  const totalExpenses = expenses.reduce((t, x) => t + x.amount, 0)
  const stockDiff = sum(c => c === ACC.stockDiff, 'd') - sum(c => c === ACC.stockDiff, 'c')
  const otherIncome = sum(c => c === ACC.otherIncome, 'c') - sum(c => c === ACC.otherIncome, 'd')
  const netSales = sales - returns, grossProfit = netSales - cogs
  return { sales: r2(sales), returns: r2(returns), netSales: r2(netSales), cogs: r2(cogs), grossProfit: r2(grossProfit), expenses, totalExpenses: r2(totalExpenses), stockDiff: r2(stockDiff), otherIncome: r2(otherIncome), netProfit: r2(grossProfit - totalExpenses - stockDiff + otherIncome) }
}

export interface BalanceSheet { cash: number; receivable: number; inventory: number; totalAssets: number; payable: number; accrued: number; totalLiabilities: number; capital: number; drawings: number; retained: number; totalEquity: number; balanced: boolean }
export function balanceSheet(entries: Entry[], asOf: number): BalanceSheet {
  const bal = (code: string) => { let d = 0, c = 0; for (const e of entries) { if (e.date > asOf) continue; for (const l of e.lines) if (l.account === code) { d += l.debit; c += l.credit } } return { d, c } }
  const a = (code: string) => { const { d, c } = bal(code); return d - c }
  const cr = (code: string) => { const { d, c } = bal(code); return c - d }
  const cash = a(ACC.cash), receivable = a(ACC.receivable), inventory = a(ACC.inventory)
  const payable = cr(ACC.payable), accrued = cr(ACC.accrued), capital = cr(ACC.equity), drawings = a(ACC.drawings)
  const retained = incomeStatement(entries, 0, asOf).netProfit
  const totalAssets = cash + receivable + inventory, totalLiabilities = payable + accrued, totalEquity = capital - drawings + retained
  return { cash: r2(cash), receivable: r2(receivable), inventory: r2(inventory), totalAssets: r2(totalAssets), payable: r2(payable), accrued: r2(accrued), totalLiabilities: r2(totalLiabilities), capital: r2(capital), drawings: r2(drawings), retained: r2(retained), totalEquity: r2(totalEquity), balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.05 }
}

/** Customer debts by age (days since the oldest unpaid invoice), the way banks and accountants like it. */
export interface AgingRow { id: string; name: string; phone?: string; total: number; buckets: [number, number, number, number]; oldestDays: number }
export function agingReport(customers: Map<string, Customer>, sales: Map<string, Sale>, payments: Map<string, Payment>, now = Date.now()): AgingRow[] {
  const rows: AgingRow[] = []
  for (const c of customers.values()) {
    // payments and returns settle the oldest invoices first
    const invoices = Array.from(sales.values()).filter(s => s.customerId === c.id && s.type === 'sale' && s.total - s.paid > 0.004).sort((x, y) => x.date - y.date).map(s => ({ date: s.date, due: s.total - s.paid }))
    let credit = Array.from(payments.values()).filter(p => p.partyType === 'customer' && p.partyId === c.id).reduce((t, p) => t + p.amount, 0) + Array.from(sales.values()).filter(s => s.customerId === c.id && s.type === 'return').reduce((t, s) => t + (s.total - s.paid), 0) - (c.openingBalance > 0 ? 0 : -c.openingBalance)
    let opening = c.openingBalance > 0 ? c.openingBalance : 0
    const settle = (amt: number) => { const used = Math.min(amt, credit); credit -= used; return amt - used }
    opening = settle(opening)
    const buckets: [number, number, number, number] = [0, 0, 0, 0]
    let total = 0, oldest = 0
    const put = (due: number, days: number) => { if (due <= 0.004) return; total += due; oldest = Math.max(oldest, days); buckets[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3] += due }
    if (opening > 0) put(opening, Math.floor((now - c.createdAt) / 86400000))
    for (const inv of invoices) put(settle(inv.due), Math.floor((now - inv.date) / 86400000))
    if (total > 0.004) rows.push({ id: c.id, name: c.name, phone: c.phone, total: r2(total), buckets: buckets.map(r2) as AgingRow['buckets'], oldestDays: oldest })
  }
  return rows.sort((a, b) => b.total - a.total)
}
