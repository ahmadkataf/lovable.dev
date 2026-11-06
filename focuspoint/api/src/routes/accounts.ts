// The admin's accounts (الحسابات): the month's income (paid bookings + other income), expenses, net, and what is
// still owed to the centre (إلي) or by it (عليّ). Bookings are the source of booking income — nothing is typed twice:
// a booking counts in the month it was paid (paid_at). The ledger table holds everything else.
import type { AccountsMonth, Booking, Currency, LedgerEntry, LedgerKind, Money } from '../../../shared/types'
import { BOOKING_SELECT, toBooking, type BookingRow } from '../db'
import { HttpError, json, readJson } from '../http'
import { idParam, requireUser, route, type Route } from '../router'
import { loadSettings } from '../settings'
import { isDateString, localDayRange, localParts } from '../tz'
import { oneOf, optionalString, requireInt, requireString } from '../validate'

const KINDS: readonly LedgerKind[] = ['expense', 'income', 'payable', 'receivable']
const CURRENCIES: readonly Currency[] = ['SYP', 'USD']
const zero = (): Money => ({ SYP: 0, USD: 0 })
const add = (m: Money, c: Currency | null | undefined, n: number) => { m[c === 'USD' ? 'USD' : 'SYP'] += n }
const PAID_STATUSES = `('confirmed','completed')`

/** First day of the month after "YYYY-MM". */
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function validateEntry(body: Record<string, unknown>, mode: 'create' | 'patch'): Partial<LedgerEntry> {
  const out: Partial<LedgerEntry> = {}
  const has = (k: string) => mode === 'create' || body[k] !== undefined
  if (has('kind')) out.kind = oneOf(body.kind, KINDS, 'invalid_kind')
  if (has('category')) out.category = body.category === undefined ? 'other' : requireString(body.category, 'invalid_category', 1, 40)
  if (has('amount')) out.amount = requireInt(body.amount, 'invalid_amount', 0, 1_000_000_000)
  if (has('currency')) out.currency = body.currency === undefined ? 'SYP' : oneOf(body.currency, CURRENCIES, 'invalid_currency')
  if (has('date')) { if (!isDateString(body.date)) throw new HttpError(400, 'invalid_date'); out.date = body.date }
  if (body.party !== undefined || mode === 'create') out.party = optionalString(body.party, 'invalid_party', 80)
  if (body.note !== undefined || mode === 'create') out.note = optionalString(body.note, 'invalid_note', 300)
  return out
}

/** Which money group a paid booking belongs to (shown as «حسب النوع»). */
function kindKey(b: Pick<Booking, 'kind' | 'tier'>): AccountsMonth['by_kind'][number]['key'] {
  if (b.kind === 'week' || b.kind === 'month') return 'subscription'
  if (b.tier === 'org') return 'hall_org'
  if (b.tier === 'gov') return 'hall_gov'
  return 'hourly'
}

/** The month summary from its rows (pure — unit-tested). */
export function summarise(month: string, paid: Booking[], entries: LedgerEntry[], from: string, to: string,
  owedBookings: Booking[], openEntries: LedgerEntry[]): AccountsMonth {
  const bookingsIncome = zero(), other = zero(), expenses = zero()
  const rooms = new Map<string, { amount: Money; bookings: number }>()
  const kinds = new Map<AccountsMonth['by_kind'][number]['key'], { amount: Money; bookings: number }>()
  for (const b of paid) {
    add(bookingsIncome, b.currency, b.price)
    const r = rooms.get(b.room_name ?? String(b.room_id)) ?? { amount: zero(), bookings: 0 }
    add(r.amount, b.currency, b.price); r.bookings++; rooms.set(b.room_name ?? String(b.room_id), r)
    const k = kinds.get(kindKey(b)) ?? { amount: zero(), bookings: 0 }
    add(k.amount, b.currency, b.price); k.bookings++; kinds.set(kindKey(b), k)
  }
  const cats = new Map<string, Money>()
  const settledIn = (e: LedgerEntry) => e.settled_at !== null && e.settled_at >= from && e.settled_at < to
  const datedIn = (e: LedgerEntry) => e.date >= month + '-01' && e.date < nextMonth(month) + '-01'
  for (const e of entries) {
    if ((e.kind === 'expense' && datedIn(e)) || (e.kind === 'payable' && settledIn(e))) {
      add(expenses, e.currency, e.amount)
      const m = cats.get(e.category) ?? zero(); add(m, e.currency, e.amount); cats.set(e.category, m)
    }
    if ((e.kind === 'income' && datedIn(e)) || (e.kind === 'receivable' && settledIn(e))) add(other, e.currency, e.amount)
  }
  const total: Money = { SYP: bookingsIncome.SYP + other.SYP, USD: bookingsIncome.USD + other.USD }
  const owedTotal = zero(), oweTotal = zero()
  for (const b of owedBookings) add(owedTotal, b.currency, b.price)
  const owedEntries = openEntries.filter((e) => e.kind === 'receivable')
  const oweEntries = openEntries.filter((e) => e.kind === 'payable')
  for (const e of owedEntries) add(owedTotal, e.currency, e.amount)
  for (const e of oweEntries) add(oweTotal, e.currency, e.amount)
  const byAmount = (a: { amount: Money }, b: { amount: Money }) => (b.amount.SYP + b.amount.USD * 10000) - (a.amount.SYP + a.amount.USD * 10000)
  return {
    month,
    income: { bookings: bookingsIncome, other, total },
    expenses,
    net: { SYP: total.SYP - expenses.SYP, USD: total.USD - expenses.USD },
    by_room: [...rooms].map(([room, v]) => ({ room, ...v })).sort(byAmount),
    by_kind: [...kinds].map(([key, v]) => ({ key, ...v })).sort(byAmount),
    by_category: [...cats].map(([category, amount]) => ({ category, amount })).sort(byAmount),
    entries: entries.filter((e) => datedIn(e) || settledIn(e)),
    owed_to_me: { bookings: owedBookings, entries: owedEntries, total: owedTotal },
    i_owe: { entries: oweEntries, total: oweTotal },
  }
}

async function getEntry(db: D1Database, id: number): Promise<LedgerEntry> {
  const e = await db.prepare('SELECT * FROM ledger WHERE id = ?').bind(id).first<LedgerEntry>()
  if (!e) throw new HttpError(404, 'entry_not_found')
  return e
}

export const accountRoutes: Route[] = [
  route('GET', '/v1/admin/accounts', 'admin', async (c) => {
    const { timezone } = await loadSettings(c.env.DB, c.env)
    const month = c.url.searchParams.get('month') || localParts(c.now, timezone).date.slice(0, 7)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'invalid_month')
    const from = localDayRange(`${month}-01`, timezone).from.toISOString()
    const to = localDayRange(`${nextMonth(month)}-01`, timezone).from.toISOString()
    const db = c.env.DB
    const [paid, entries, owed, open] = await Promise.all([
      // paid in the month: confirmed/finished, or confirmed and cancelled later (the money stays; a refund is an expense)
      db.prepare(`${BOOKING_SELECT} WHERE (b.status IN ${PAID_STATUSES} OR (b.status = 'cancelled' AND b.verified_by IS NOT NULL)) AND b.method != 'free' AND b.price > 0 AND b.paid_at >= ? AND b.paid_at < ? ORDER BY b.paid_at LIMIT 5000`)
        .bind(from, to).all<BookingRow>(),
      db.prepare(`SELECT * FROM ledger WHERE (date >= ? AND date < ?) OR (settled_at >= ? AND settled_at < ?) ORDER BY date DESC, id DESC LIMIT 2000`)
        .bind(`${month}-01`, `${nextMonth(month)}-01`, from, to).all<LedgerEntry>(),
      // owed to the centre: confirmed (or finished) bookings nobody has paid yet («على الحساب»)
      db.prepare(`${BOOKING_SELECT} WHERE b.status IN ${PAID_STATUSES} AND b.method != 'free' AND b.price > 0 AND b.paid_at IS NULL ORDER BY b.start LIMIT 500`).all<BookingRow>(),
      db.prepare(`SELECT * FROM ledger WHERE kind IN ('payable','receivable') AND settled_at IS NULL ORDER BY date LIMIT 500`).all<LedgerEntry>(),
    ])
    return json(summarise(month, paid.results.map(toBooking), entries.results, from, to, owed.results.map(toBooking), open.results))
  }),

  route('POST', '/v1/admin/ledger', 'admin', async (c) => {
    const user = requireUser(c)
    const e = validateEntry(await readJson(c.req), 'create') as LedgerEntry
    const iso = c.now.toISOString()
    const res = await c.env.DB.prepare(
      `INSERT INTO ledger (kind, category, amount, currency, date, party, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(e.kind, e.category, e.amount, e.currency, e.date, e.party, e.note, user.id, iso, iso).run()
    return json(await getEntry(c.env.DB, Number(res.meta.last_row_id)), 201)
  }),

  route('PATCH', '/v1/admin/ledger/:id', 'admin', async (c) => {
    const id = idParam(c)
    const body = await readJson(c.req)
    const cur = await getEntry(c.env.DB, id)
    const p = { ...cur, ...validateEntry(body, 'patch') }
    // settled: true → paid now (counts in this month); false → open again
    let settled = cur.settled_at
    if (body.settled !== undefined) {
      if (typeof body.settled !== 'boolean') throw new HttpError(400, 'invalid_settled')
      settled = body.settled ? (cur.settled_at ?? c.now.toISOString()) : null
    }
    if (p.kind !== 'payable' && p.kind !== 'receivable') settled = null
    await c.env.DB.prepare(`UPDATE ledger SET kind = ?, category = ?, amount = ?, currency = ?, date = ?, party = ?, note = ?, settled_at = ?, updated_at = ? WHERE id = ?`)
      .bind(p.kind, p.category, p.amount, p.currency, p.date, p.party, p.note, settled, c.now.toISOString(), id).run()
    return json(await getEntry(c.env.DB, id))
  }),

  route('DELETE', '/v1/admin/ledger/:id', 'admin', async (c) => {
    const id = idParam(c)
    await getEntry(c.env.DB, id)
    await c.env.DB.prepare('DELETE FROM ledger WHERE id = ?').bind(id).run()
    return json({ ok: true })
  }),

  // Record (or undo) the payment of a confirmed booking — a hall booked «على الحساب» paid later, for example.
  route('POST', '/v1/team/bookings/:id/paid', 'team', async (c) => {
    const id = idParam(c)
    const body = await readJson(c.req)
    if (typeof body.paid !== 'boolean') throw new HttpError(400, 'invalid_paid')
    // Undoing a recorded payment changes the books: admin only. Recording keeps the first payment date.
    if (!body.paid && requireUser(c).role !== 'admin') throw new HttpError(403, 'forbidden')
    const iso = c.now.toISOString()
    const res = await c.env.DB.prepare(`UPDATE bookings SET paid_at = ${body.paid ? 'COALESCE(paid_at, ?)' : '?'}, updated_at = ? WHERE id = ? AND status IN ${PAID_STATUSES}`)
      .bind(body.paid ? iso : null, iso, id).run()
    if (res.meta.changes === 0) throw new HttpError(409, 'illegal_transition')
    const row = await c.env.DB.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).bind(id).first<BookingRow>()
    return json(toBooking(row!))
  }),
]

