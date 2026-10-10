// Customers: Arabic-friendly search and sorting, the balance words, WhatsApp / phone links, the account
// statement (CSV rows + a printable HTML page) and the payment voucher. Pure, tested; no database here.
import type { Customer, CurrencySettings, LedgerEntry, LedgerType, Settings } from '../db/types'
import { formatMoney, round } from './money'
import { formatDate, formatDateTime } from './format'
import { escapeHtml } from './receipt'
import { addMessages, t } from '../i18n'

addMessages({
  ar: {
    'customers.type.sale': 'بيع آجل',
    'customers.type.payment': 'دفعة',
    'customers.type.refund': 'إرجاع',
    'customers.type.adjust': 'تعديل رصيد',
    'customers.balance.owes': 'عليه',
    'customers.balance.has': 'له',
    'customers.balance.zero': 'لا شيء',
    'customers.reminder.owes': 'مرحباً {name}،\nنودّ تذكيركم بأن الرصيد المستحق عليكم لدى {store} هو {amount}.\nنشكر لكم تعاونكم.',
    'customers.reminder.has': 'مرحباً {name}،\nلديكم رصيد لصالحكم لدى {store} قدره {amount}.\nشكراً لكم.',
    'customers.reminder.zero': 'مرحباً {name}،\nحسابكم لدى {store} مسدّد بالكامل. شكراً لثقتكم.',
    'customers.statement.title': 'كشف حساب',
    'customers.statement.customer': 'العميل',
    'customers.statement.period': 'الفترة',
    'customers.statement.all': 'كل الفترات',
    'customers.statement.printedAt': 'طُبع في',
    'customers.statement.date': 'التاريخ',
    'customers.statement.desc': 'البيان',
    'customers.statement.debit': 'عليه',
    'customers.statement.credit': 'له',
    'customers.statement.balance': 'الرصيد',
    'customers.statement.opening': 'رصيد أول الفترة',
    'customers.statement.closing': 'الرصيد النهائي',
    'customers.statement.noEntries': 'لا توجد حركات في هذه الفترة',
    'customers.statement.receipt': 'فاتورة',
    'customers.voucher.title': 'إيصال قبض',
    'customers.voucher.refundTitle': 'إشعار إرجاع',
    'customers.voucher.adjustTitle': 'إشعار تعديل رصيد',
    'customers.voucher.received': 'استلمنا من',
    'customers.voucher.amount': 'المبلغ',
    'customers.voucher.method': 'طريقة الدفع',
    'customers.voucher.balanceAfter': 'الرصيد بعد العملية',
    'customers.voucher.by': 'المستلم',
    'customers.voucher.signature': 'التوقيع',
  },
  en: {
    'customers.type.sale': 'Credit sale',
    'customers.type.payment': 'Payment',
    'customers.type.refund': 'Refund',
    'customers.type.adjust': 'Adjustment',
    'customers.balance.owes': 'Owes',
    'customers.balance.has': 'In credit',
    'customers.balance.zero': 'Settled',
    'customers.reminder.owes': 'Hello {name},\nA friendly reminder that your outstanding balance at {store} is {amount}.\nThank you.',
    'customers.reminder.has': 'Hello {name},\nYou have a credit of {amount} at {store}.\nThank you.',
    'customers.reminder.zero': 'Hello {name},\nYour account at {store} is fully settled. Thank you.',
    'customers.statement.title': 'Account statement',
    'customers.statement.customer': 'Customer',
    'customers.statement.period': 'Period',
    'customers.statement.all': 'All time',
    'customers.statement.printedAt': 'Printed',
    'customers.statement.date': 'Date',
    'customers.statement.desc': 'Description',
    'customers.statement.debit': 'Debit',
    'customers.statement.credit': 'Credit',
    'customers.statement.balance': 'Balance',
    'customers.statement.opening': 'Opening balance',
    'customers.statement.closing': 'Closing balance',
    'customers.statement.noEntries': 'No entries in this period',
    'customers.statement.receipt': 'Receipt',
    'customers.voucher.title': 'Payment receipt',
    'customers.voucher.refundTitle': 'Refund note',
    'customers.voucher.adjustTitle': 'Balance adjustment',
    'customers.voucher.received': 'Received from',
    'customers.voucher.amount': 'Amount',
    'customers.voucher.method': 'Paid by',
    'customers.voucher.balanceAfter': 'Balance after',
    'customers.voucher.by': 'Received by',
    'customers.voucher.signature': 'Signature',
  },
})

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Lower-case, no diacritics, unified alef / yaa / taa-marbuta, western digits, single spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, ch => String(AR_DIGITS.indexOf(ch)))
    .replace(/[۰-۹]/g, ch => String(FA_DIGITS.indexOf(ch)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Only the digits of a phone number, western. */
export function phoneDigits(s: string | undefined): string {
  return normalizeText(s ?? '').replace(/\D/g, '')
}

/** Name (Arabic-insensitive) or phone (digits) match, every word of the query. */
export function matchesCustomer(c: Pick<Customer, 'name' | 'phone'>, query: string): boolean {
  const tokens = normalizeText(query).split(' ').filter(Boolean)
  if (!tokens.length) return true
  const name = normalizeText(c.name)
  const phone = phoneDigits(c.phone)
  return tokens.every(tk => name.includes(tk) || (/^\d+$/.test(tk) && phone.includes(tk)))
}

export type CustomerSort = 'name' | 'debt' | 'recent'
export function sortCustomers(list: Customer[], sort: CustomerSort): Customer[] {
  const out = list.slice()
  if (sort === 'debt') out.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'ar'))
  else if (sort === 'recent') out.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
  else out.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  return out
}

export interface CustomerStats { count: number; debtors: number; totalDebt: number; totalCredit: number }
/** Head numbers: how many owe us, how much in all, and what we owe them. */
export function customerStats(list: Customer[], decimals: number): CustomerStats {
  let debtors = 0, totalDebt = 0, totalCredit = 0
  for (const c of list) {
    if (c.balance > 0) { debtors++; totalDebt += c.balance }
    else if (c.balance < 0) totalCredit += -c.balance
  }
  return { count: list.length, debtors, totalDebt: round(totalDebt, decimals), totalCredit: round(totalCredit, decimals) }
}

export type BalanceKind = 'owes' | 'has' | 'zero'
export const balanceKind = (balance: number): BalanceKind => (balance > 0 ? 'owes' : balance < 0 ? 'has' : 'zero')

export function telUrl(phone: string): string {
  const plus = phone.trim().startsWith('+') ? '+' : ''
  return `tel:${plus}${phoneDigits(phone)}`
}
/** wa.me wants the international number without "+" or "00". */
export function whatsappUrl(phone: string, text?: string): string {
  const digits = phoneDigits(phone).replace(/^00/, '')
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** The WhatsApp reminder, in the app's language. */
export function reminderText(o: { storeName: string; customerName: string; balance: number; currency: CurrencySettings }): string {
  const kind = balanceKind(o.balance)
  return t(`customers.reminder.${kind}`, { name: o.customerName, store: o.storeName, amount: formatMoney(Math.abs(o.balance), o.currency) })
}

export const ledgerTypeLabel = (type: LedgerType): string => t(`customers.type.${type}`)

/** The entries between from and to (inclusive), oldest first, and the balance just before them. */
export function statementSlice(entries: LedgerEntry[], from?: number, to?: number): { rows: LedgerEntry[]; opening: number } {
  const sorted = entries.slice().sort((a, b) => a.createdAt - b.createdAt)
  const before = from !== undefined ? sorted.filter(e => e.createdAt < from) : []
  const opening = before.length ? before[before.length - 1].balanceAfter : 0
  const rows = sorted.filter(e => (from === undefined || e.createdAt >= from) && (to === undefined || e.createdAt <= to))
  return { rows, opening }
}

function entryDescription(e: LedgerEntry, receipts?: Map<string, number>): string {
  const parts = [ledgerTypeLabel(e.type)]
  if (e.method && e.type === 'payment') parts.push(methodWord(e.method))
  const n = e.refId ? receipts?.get(e.refId) : undefined
  if (n !== undefined) parts.push(`${t('customers.statement.receipt')} #${n}`)
  // the sale / refund writers put "#12" in the note; it is already shown as the receipt number
  if (e.note && !(n !== undefined && /^#\d+$/.test(e.note))) parts.push(e.note)
  return parts.join(' · ')
}
function methodWord(m: NonNullable<LedgerEntry['method']>): string {
  return t(m === 'cash' ? 'common.cash' : m === 'card' ? 'common.card' : m === 'transfer' ? 'common.transfer' : 'common.credit')
}

export interface StatementInput {
  customer: Customer
  entries: LedgerEntry[]
  settings: Settings
  from?: number
  to?: number
  /** refId (sale / refund id) → receipt number, for "Receipt #12" in the description. */
  receipts?: Map<string, number>
}

/** The statement as spreadsheet rows (header, opening, entries, closing). */
export function statementRows(input: StatementInput): (string | number)[][] {
  const { rows, opening } = statementSlice(input.entries, input.from, input.to)
  const c = input.settings.currency
  const out: (string | number)[][] = [[
    t('customers.statement.date'), t('customers.statement.desc'), t('customers.statement.debit'), t('customers.statement.credit'), t('customers.statement.balance'),
  ]]
  if (input.from !== undefined) out.push([formatDate(input.from), t('customers.statement.opening'), '', '', round(opening, c.decimals)])
  for (const e of rows) out.push([formatDateTime(e.createdAt), entryDescription(e, input.receipts), e.amount > 0 ? e.amount : '', e.amount < 0 ? -e.amount : '', e.balanceAfter])
  const closing = rows.length ? rows[rows.length - 1].balanceAfter : opening
  out.push(['', t('customers.statement.closing'), '', '', round(closing, c.decimals)])
  return out
}

function docCss(): string {
  return `
* { box-sizing: border-box }
html, body { margin: 0; padding: 0; background: #fff; color: #111 }
body { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 13px; line-height: 1.5; padding: 14mm 12mm }
@page { size: A4; margin: 0 }
.head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px }
.store { font-size: 20px; font-weight: 800 } .s { font-size: 12px; color: #444 }
h1 { font-size: 18px; margin: 0 0 2px } .meta { margin-bottom: 12px } .meta div { margin: 1px 0 }
table { width: 100%; border-collapse: collapse } th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: start; vertical-align: top }
th { background: #f2f2f2; font-size: 12px } td.n, th.n { text-align: end; white-space: nowrap; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums }
tr.open td { color: #444; font-style: italic } tr.close td { font-weight: 800; border-top: 2px solid #111; border-bottom: 0; font-size: 14px }
.owes { color: #b4232a } .has { color: #0b7a4b }
.box { border: 1px solid #111; border-radius: 6px; padding: 12px 14px; margin: 10px 0 } .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0 }
.big { font-size: 22px; font-weight: 800 } .sig { display: flex; justify-content: space-between; margin-top: 36px } .sig div { width: 40%; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 12px }
.foot { margin-top: 14px; font-size: 11px; color: #666; text-align: center }
`.trim()
}

/** A printable A4 statement: store header, customer, period, the entries with a running balance, the final balance. */
export function statementHtml(input: StatementInput): string {
  const { customer, settings } = input
  const c = settings.currency
  const h = escapeHtml
  const money = (n: number) => formatMoney(n, c)
  const { rows, opening } = statementSlice(input.entries, input.from, input.to)
  const closing = rows.length ? rows[rows.length - 1].balanceAfter : opening
  const dir = settings.lang === 'en' ? 'ltr' : 'rtl'
  const storeLines = [settings.store.address, settings.store.phone ? `${t('receipt.tel')}: ${settings.store.phone}` : ''].map(s => (s ?? '').trim()).filter(Boolean)
  const period = input.from !== undefined || input.to !== undefined
    ? `${input.from !== undefined ? formatDate(input.from) : '…'} – ${input.to !== undefined ? formatDate(input.to) : '…'}`
    : t('customers.statement.all')
  const balCls = (n: number) => (n > 0 ? 'owes' : n < 0 ? 'has' : '')
  const body = rows.length
    ? rows.map(e => `<tr><td class="n">${h(formatDateTime(e.createdAt))}</td><td>${h(entryDescription(e, input.receipts))}</td><td class="n">${e.amount > 0 ? h(money(e.amount)) : ''}</td><td class="n">${e.amount < 0 ? h(money(-e.amount)) : ''}</td><td class="n ${balCls(e.balanceAfter)}">${h(money(e.balanceAfter))}</td></tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#666">${h(t('customers.statement.noEntries'))}</td></tr>`
  return `<!doctype html><html lang="${settings.lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(t('customers.statement.title'))} – ${h(customer.name)}</title><style>${docCss()}</style></head><body>
<div class="head"><div><div class="store">${h(settings.store.name.trim() || t('app.name'))}</div>${storeLines.map(l => `<div class="s">${h(l)}</div>`).join('')}</div>
<div><h1>${h(t('customers.statement.title'))}</h1><div class="s">${h(t('customers.statement.printedAt'))}: <span class="n">${h(formatDateTime(Date.now()))}</span></div></div></div>
<div class="meta"><div><b>${h(t('customers.statement.customer'))}:</b> ${h(customer.name)}${customer.phone ? ` · <span class="n">${h(customer.phone)}</span>` : ''}</div>${customer.address ? `<div class="s">${h(customer.address)}</div>` : ''}<div><b>${h(t('customers.statement.period'))}:</b> <span class="n">${h(period)}</span></div></div>
<table><thead><tr><th>${h(t('customers.statement.date'))}</th><th>${h(t('customers.statement.desc'))}</th><th class="n">${h(t('customers.statement.debit'))}</th><th class="n">${h(t('customers.statement.credit'))}</th><th class="n">${h(t('customers.statement.balance'))}</th></tr></thead>
<tbody>${input.from !== undefined ? `<tr class="open"><td class="n">${h(formatDate(input.from))}</td><td>${h(t('customers.statement.opening'))}</td><td></td><td></td><td class="n ${balCls(opening)}">${h(money(opening))}</td></tr>` : ''}${body}
<tr class="close"><td></td><td>${h(t('customers.statement.closing'))} (${h(t(`customers.balance.${balanceKind(closing)}`))})</td><td></td><td></td><td class="n ${balCls(closing)}">${h(money(Math.abs(closing)))}</td></tr></tbody></table>
<div class="foot">${h(settings.store.name.trim() || t('app.name'))} · ${h(t('app.name'))}</div>
</body></html>`
}

/** A small printable voucher for one ledger entry (a payment, a refund to the account, an adjustment). */
export function voucherHtml(o: { customer: Customer; entry: LedgerEntry; settings: Settings; userName?: string }): string {
  const { customer, entry, settings } = o
  const c = settings.currency
  const h = escapeHtml
  const title = t(entry.type === 'payment' ? 'customers.voucher.title' : entry.type === 'refund' ? 'customers.voucher.refundTitle' : 'customers.voucher.adjustTitle')
  const dir = settings.lang === 'en' ? 'ltr' : 'rtl'
  const rows: [string, string][] = [
    [t('customers.statement.date'), formatDateTime(entry.createdAt)],
    [t('customers.voucher.received'), customer.name + (customer.phone ? ` (${customer.phone})` : '')],
    [t('customers.voucher.amount'), formatMoney(Math.abs(entry.amount), c)],
  ]
  if (entry.method && entry.type === 'payment') rows.push([t('customers.voucher.method'), methodWord(entry.method)])
  if (entry.note) rows.push([t('common.note'), entry.note])
  rows.push([`${t('customers.voucher.balanceAfter')} (${t(`customers.balance.${balanceKind(entry.balanceAfter)}`)})`, formatMoney(Math.abs(entry.balanceAfter), c)])
  if (o.userName) rows.push([t('customers.voucher.by'), o.userName])
  return `<!doctype html><html lang="${settings.lang}" dir="${dir}"><head><meta charset="utf-8"><title>${h(title)}</title><style>${docCss()} body { max-width: 120mm; margin: 0 auto }</style></head><body>
<div class="head"><div><div class="store">${h(settings.store.name.trim() || t('app.name'))}</div>${settings.store.phone ? `<div class="s">${h(t('receipt.tel'))}: <span class="n">${h(settings.store.phone)}</span></div>` : ''}</div><div><h1>${h(title)}</h1></div></div>
<div class="box">${rows.map(([k, v], i) => `<div class="row"><span>${h(k)}</span><span class="n ${i === 2 ? 'big' : ''}">${h(v)}</span></div>`).join('')}</div>
<div class="sig"><div>${h(t('customers.voucher.by'))}</div><div>${h(t('customers.voucher.signature'))}</div></div>
</body></html>`
}
