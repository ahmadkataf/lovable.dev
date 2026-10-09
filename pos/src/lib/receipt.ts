// Receipts: one structured "document" (receiptDoc) rendered three ways — HTML for thermal printers (58/80 mm),
// plain text for WhatsApp / printer apps, and on screen by components/ReceiptView.tsx.
import JsBarcode from 'jsbarcode'
import type { Sale, Refund, Settings, PaymentMethod } from '../db/types'
import { formatMoney, formatQty, round } from './money'
import { formatDateTime } from './format'
import { platform } from './platform'
import { addMessages, t } from '../i18n'
import { balanceAfterSale } from './sales'

addMessages({
  ar: {
    'receipt.number': 'رقم الفاتورة',
    'receipt.date': 'التاريخ',
    'receipt.cashier': 'الكاشير',
    'receipt.customer': 'العميل',
    'receipt.tel': 'هاتف',
    'receipt.taxNumber': 'الرقم الضريبي',
    'receipt.copy': 'نسخة',
    'receipt.refundTitle': 'إرجاع',
    'receipt.originalReceipt': 'الفاتورة الأصلية',
    'receipt.itemCount': '{n} صنف',
    'receipt.lineDiscount': 'خصم',
    'receipt.taxInclusive': 'شامل',
    'receipt.onAccount': 'على الحساب',
    'receipt.balanceAfter': 'الرصيد بعد البيع',
    'receipt.refunded': 'المبلغ المُعاد',
    'receipt.refundMethod': 'طريقة الإرجاع',
    'receipt.refundToAccount': 'خُصم من حساب العميل',
    'receipt.restocked': 'أُعيدت الأصناف إلى المخزون',
    'receipt.reason': 'السبب',
    'receipt.docTitle': 'فاتورة #{n}',
  },
  en: {
    'receipt.number': 'Receipt no.',
    'receipt.date': 'Date',
    'receipt.cashier': 'Cashier',
    'receipt.customer': 'Customer',
    'receipt.tel': 'Tel',
    'receipt.taxNumber': 'Tax no.',
    'receipt.copy': 'COPY',
    'receipt.refundTitle': 'REFUND',
    'receipt.originalReceipt': 'Original receipt',
    'receipt.itemCount': '{n} items',
    'receipt.lineDiscount': 'Discount',
    'receipt.taxInclusive': 'incl.',
    'receipt.onAccount': 'On account',
    'receipt.balanceAfter': 'Balance after',
    'receipt.refunded': 'Refunded',
    'receipt.refundMethod': 'Refunded via',
    'receipt.refundToAccount': 'Taken off the account',
    'receipt.restocked': 'Items returned to stock',
    'receipt.reason': 'Reason',
    'receipt.docTitle': 'Receipt #{n}',
  },
})

export interface ReceiptOptions {
  refund?: Refund
  copy?: boolean
  /** The customer's balance after a sale on credit (printSale / ReceiptView look it up when not given). */
  balanceAfter?: number
}

export interface ReceiptLine { label: string; value: string; strong?: boolean; big?: boolean; small?: boolean }
export interface ReceiptItemRow {
  name: string
  total: string
  /** "2 × 1,000" — shown under the name when the quantity is not 1 or the price was changed. */
  detail?: string
  /** The original unit price when it was overridden. */
  original?: string
  discount?: string
  note?: string
}
export interface ReceiptDoc {
  dir: 'rtl' | 'ltr'
  lang: 'ar' | 'en'
  paper: 58 | 80
  /** The printable width of the paper. */
  widthMm: number
  fontPx: number
  docTitle: string
  logo?: string
  storeName: string
  storeLines: string[]
  header?: string
  /** A banner such as "REFUND"; absent for a normal sale. */
  title?: string
  copy: boolean
  meta: ReceiptLine[]
  itemCount: string
  items: ReceiptItemRow[]
  totals: ReceiptLine[]
  payments: ReceiptLine[]
  extra: string[]
  note?: string
  footer?: string
  /** The receipt number to print as CODE128 (when settings.receipt.showBarcode). */
  barcode?: string
}

export const PRINTABLE_MM: Record<58 | 80, number> = { 58: 48, 80: 72 }

export function methodLabel(m: PaymentMethod): string {
  return t(m === 'cash' ? 'common.cash' : m === 'card' ? 'common.card' : m === 'transfer' ? 'common.transfer' : 'common.credit')
}

/** The receipt as data. Both renderers and the on-screen preview use it, so they never disagree. */
export function receiptDoc(sale: Sale, settings: Settings, opts: ReceiptOptions = {}): ReceiptDoc {
  const c = settings.currency
  const r = settings.receipt
  const money = (n: number) => formatMoney(n, c)
  const paper = r.paper === 58 ? 58 : 80
  const storeLines = [settings.store.address, settings.store.phone ? `${t('receipt.tel')}: ${settings.store.phone}` : '', settings.store.taxNumber ? `${t('receipt.taxNumber')}: ${settings.store.taxNumber}` : '']
    .map(s => (s ?? '').trim()).filter(Boolean)
  const base: ReceiptDoc = {
    dir: settings.lang === 'en' ? 'ltr' : 'rtl',
    lang: settings.lang,
    paper,
    widthMm: PRINTABLE_MM[paper],
    fontPx: paper === 58 ? 12 : 13,
    docTitle: t('receipt.docTitle', { n: sale.number }),
    logo: r.showLogo && settings.store.logo ? settings.store.logo : undefined,
    storeName: settings.store.name.trim() || t('app.name'),
    storeLines,
    header: r.header.trim() || undefined,
    copy: !!opts.copy,
    meta: [],
    itemCount: '',
    items: [],
    totals: [],
    payments: [],
    extra: [],
    footer: r.footer.trim() || undefined,
    barcode: r.showBarcode ? String(sale.number) : undefined,
  }

  if (opts.refund) {
    const f = opts.refund
    base.title = t('receipt.refundTitle')
    base.meta = [
      { label: t('receipt.originalReceipt'), value: `#${f.saleNumber}` },
      { label: t('receipt.date'), value: formatDateTime(f.createdAt) },
      { label: t('receipt.cashier'), value: f.userName },
    ]
    if (sale.customerName) base.meta.push({ label: t('receipt.customer'), value: sale.customerName })
    base.items = f.items.map(i => ({
      name: i.name,
      total: money(i.total),
      detail: i.qty !== 1 || round(i.price * i.qty, c.decimals) !== round(i.total, c.decimals) ? `${formatQty(i.qty)} × ${money(i.price)}` : undefined,
    }))
    base.itemCount = t('receipt.itemCount', { n: f.items.length })
    base.totals = [{ label: t('receipt.refunded'), value: money(f.total), strong: true, big: true }]
    base.payments = [{ label: t('receipt.refundMethod'), value: f.method === 'credit' ? t('receipt.refundToAccount') : methodLabel(f.method) }]
    if (f.restock) base.extra.push(t('receipt.restocked'))
    if (f.reason) base.extra.push(`${t('receipt.reason')}: ${f.reason}`)
    base.barcode = r.showBarcode ? String(f.saleNumber) : undefined
    return base
  }

  base.meta = [
    { label: t('receipt.number'), value: `#${sale.number}`, strong: true },
    { label: t('receipt.date'), value: formatDateTime(sale.createdAt) },
    { label: t('receipt.cashier'), value: sale.userName },
  ]
  if (sale.customerName) base.meta.push({ label: t('receipt.customer'), value: sale.customerName })

  base.items = sale.items.map(i => {
    const overridden = round(i.originalPrice, c.decimals) !== round(i.price, c.decimals)
    const showDetail = i.qty !== 1 || overridden || i.discount > 0
    return {
      name: i.name,
      total: money(i.total),
      detail: showDetail ? `${formatQty(i.qty)} × ${money(i.price)}` : undefined,
      original: overridden ? money(i.originalPrice) : undefined,
      discount: i.discount > 0 ? `${t('receipt.lineDiscount')} -${money(i.discount)}` : undefined,
      note: i.note?.trim() || undefined,
    }
  })
  base.itemCount = t('receipt.itemCount', { n: sale.items.length })

  const taxOn = settings.tax.enabled
  if (sale.discount > 0 || taxOn) base.totals.push({ label: t('common.subtotal'), value: money(sale.subtotal) })
  if (sale.discount > 0) base.totals.push({ label: sale.discountPct !== undefined ? `${t('common.discount')} ${formatQty(sale.discountPct)}%` : t('common.discount'), value: `-${money(sale.discount)}` })
  if (taxOn) {
    const label = settings.tax.label.trim() || t('common.tax')
    base.totals.push({ label: settings.tax.inclusive ? `${label} (${t('receipt.taxInclusive')})` : label, value: money(sale.tax) })
  }
  base.totals.push({ label: t('common.total'), value: money(sale.total), strong: true, big: true })

  for (const p of sale.payments) {
    if (p.method === 'credit') continue
    const amount = p.method === 'cash' ? round(p.amount + sale.change, c.decimals) : p.amount
    base.payments.push({ label: methodLabel(p.method), value: money(amount) })
  }
  if (sale.change > 0) base.payments.push({ label: t('common.change'), value: money(sale.change), strong: true })
  if (sale.credit > 0) {
    base.payments.push({ label: t('receipt.onAccount'), value: money(sale.credit), strong: true })
    if (opts.balanceAfter !== undefined) base.payments.push({ label: t('receipt.balanceAfter'), value: money(opts.balanceAfter) })
  }
  base.note = sale.note?.trim() || undefined
  return base
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

/** The receipt number as a CODE128 SVG string, or '' when there is no DOM (tests, workers). */
export function barcodeSvg(value: string, opts: { height?: number; width?: number; text?: boolean } = {}): string {
  if (typeof document === 'undefined' || typeof XMLSerializer === 'undefined') return ''
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, value, {
      format: 'CODE128', displayValue: opts.text ?? true, height: opts.height ?? 38, width: opts.width ?? 1.6, margin: 0,
      fontSize: 11, textMargin: 2, font: 'monospace', background: '#ffffff', lineColor: '#000000', xmlDocument: document,
    })
    return new XMLSerializer().serializeToString(svg)
  } catch { return '' }
}

function receiptCss(doc: ReceiptDoc): string {
  return `
@page { size: ${doc.paper}mm auto; margin: 0 }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0; background: #fff; color: #000 }
body { width: ${doc.widthMm}mm; margin: 0 auto; font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; font-size: ${doc.fontPx}px; line-height: 1.4; padding: 3mm 0 6mm; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.c { text-align: center } .b { font-weight: 700 } .s { font-size: ${doc.fontPx - 2}px } .xs { font-size: ${doc.fontPx - 3}px }
.store { font-size: ${doc.fontPx + 4}px; font-weight: 800; margin-bottom: 1mm; word-break: break-word }
.logo { display: block; max-width: 40mm; max-height: 22mm; margin: 0 auto 2mm; filter: grayscale(1) contrast(1.2) }
.rule { border: 0; border-top: 1px dashed #000; margin: 2mm 0; height: 0 }
.title { text-align: center; font-size: ${doc.fontPx + 5}px; font-weight: 800; letter-spacing: 1px; margin: 1.5mm 0 }
.wm { text-align: center; font-weight: 800; letter-spacing: 3px; border: 1px solid #000; padding: .5mm 0; margin: 1.5mm 0 }
table { width: 100%; border-collapse: collapse; table-layout: fixed }
td { padding: .4mm 0; vertical-align: top; word-break: break-word }
td.v { text-align: end; white-space: nowrap; width: 38% }
.num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums }
.items td { padding: 1mm 0 }
.items tr + tr td { border-top: 1px dotted #999 }
.sub { font-size: ${doc.fontPx - 2}px; margin-top: .3mm }
.strike { text-decoration: line-through; opacity: .8 }
.big td { font-size: ${doc.fontPx + 6}px; font-weight: 800; padding-top: 1.5mm }
.pay td { padding: .2mm 0 }
.note { white-space: pre-wrap; margin-top: 1mm }
.footer { white-space: pre-wrap; margin-top: 1mm }
.bc { display: block; margin: 2mm auto 0; max-width: 100%; height: auto }
`.trim()
}

/** A complete, self-contained HTML document of the receipt, sized for `settings.receipt.paper` mm paper. */
export function receiptHtml(sale: Sale, settings: Settings, opts: ReceiptOptions = {}): string {
  const doc = receiptDoc(sale, settings, opts)
  const h = escapeHtml
  const line = (l: ReceiptLine, cls = '') => `<tr class="${[l.big ? 'big' : '', l.strong ? 'b' : '', l.small ? 's' : '', cls].filter(Boolean).join(' ')}"><td>${h(l.label)}</td><td class="v num">${h(l.value)}</td></tr>`
  const parts: string[] = []
  if (doc.logo) parts.push(`<img class="logo" src="${h(doc.logo)}" alt="">`)
  parts.push(`<div class="c store">${h(doc.storeName)}</div>`)
  for (const s of doc.storeLines) parts.push(`<div class="c s">${h(s)}</div>`)
  if (doc.header) parts.push(`<div class="c s" style="margin-top:1mm;white-space:pre-wrap">${h(doc.header)}</div>`)
  if (doc.title) parts.push(`<div class="title">${h(doc.title)}</div>`)
  if (doc.copy) parts.push(`<div class="wm">${h(t('receipt.copy'))}</div>`)
  parts.push('<hr class="rule">')
  parts.push(`<table class="meta">${doc.meta.map(l => line(l)).join('')}</table>`)
  parts.push('<hr class="rule">')
  parts.push(`<table class="items">${doc.items.map(i => {
    const subs: string[] = []
    if (i.detail) subs.push(`<div class="sub num">${h(i.detail)}${i.original ? ` <span class="strike">${h(i.original)}</span>` : ''}</div>`)
    if (i.discount) subs.push(`<div class="sub num">${h(i.discount)}</div>`)
    if (i.note) subs.push(`<div class="sub">${h(i.note)}</div>`)
    return `<tr><td>${h(i.name)}${subs.join('')}</td><td class="v num b">${h(i.total)}</td></tr>`
  }).join('')}</table>`)
  parts.push(`<div class="xs" style="margin-top:.5mm">${h(doc.itemCount)}</div>`)
  parts.push('<hr class="rule">')
  parts.push(`<table class="totals">${doc.totals.map(l => line(l)).join('')}</table>`)
  if (doc.payments.length) parts.push(`<table class="pay" style="margin-top:1mm">${doc.payments.map(l => line(l)).join('')}</table>`)
  for (const s of doc.extra) parts.push(`<div class="s">${h(s)}</div>`)
  if (doc.note) parts.push(`<div class="s note">${h(doc.note)}</div>`)
  if (doc.footer || doc.barcode) parts.push('<hr class="rule">')
  if (doc.footer) parts.push(`<div class="c footer">${h(doc.footer)}</div>`)
  if (doc.barcode) {
    const svg = barcodeSvg(doc.barcode)
    if (svg) parts.push(svg.replace('<svg', '<svg class="bc"'))
  }
  return `<!doctype html><html lang="${doc.lang}" dir="${doc.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(doc.docTitle)}</title><style>${receiptCss(doc)}</style></head><body>${parts.join('\n')}</body></html>`
}

/** Pads `left` and `right` apart on one line of `width` characters; wraps the value when it does not fit. */
export function alignLine(left: string, right: string, width: number): string {
  const gap = width - left.length - right.length
  if (gap >= 2) return left + ' '.repeat(gap) + right
  if (left.length + 2 + right.length <= width + 6) return `${left}  ${right}`
  return `${left}\n${' '.repeat(Math.max(0, width - right.length))}${right}`
}

/** The receipt as plain text (for WhatsApp / Bluetooth printer apps). */
export function receiptText(sale: Sale, settings: Settings, opts: ReceiptOptions = {}): string {
  const doc = receiptDoc(sale, settings, opts)
  const width = doc.paper === 58 ? 32 : 42
  const rule = '-'.repeat(width)
  const out: string[] = []
  out.push(`*${doc.storeName}*`)
  out.push(...doc.storeLines)
  if (doc.header) out.push(doc.header)
  if (doc.title) out.push(`*${doc.title}*`)
  if (doc.copy) out.push(`[${t('receipt.copy')}]`)
  out.push(rule)
  for (const m of doc.meta) out.push(`${m.label}: ${m.value}`)
  out.push(rule)
  for (const i of doc.items) {
    if (i.detail) {
      out.push(i.name)
      out.push(alignLine(`  ${i.detail}${i.original ? ` (${i.original})` : ''}`, i.total, width))
    } else {
      out.push(alignLine(`${i.name} ×1`, i.total, width))
    }
    if (i.discount) out.push(`  ${i.discount}`)
    if (i.note) out.push(`  ${i.note}`)
  }
  out.push(doc.itemCount)
  out.push(rule)
  for (const l of doc.totals) out.push(alignLine(l.big ? l.label.toUpperCase() : l.label, l.value, width))
  if (doc.payments.length) out.push('')
  for (const l of doc.payments) out.push(alignLine(l.label, l.value, width))
  out.push(...doc.extra)
  if (doc.note) out.push(`${t('common.note')}: ${doc.note}`)
  if (doc.footer) { out.push(rule); out.push(doc.footer) }
  return out.join('\n')
}

/** The balance to print after a sale on credit: the one given, else the ledger's. */
async function resolveBalance(sale: Sale, opts: { refund?: Refund; balanceAfter?: number }): Promise<number | undefined> {
  if (opts.balanceAfter !== undefined || opts.refund || !(sale.credit > 0)) return opts.balanceAfter
  try { return await balanceAfterSale(sale) } catch { return undefined }
}

export async function printSale(sale: Sale, settings: Settings, opts: { refund?: Refund; silent?: boolean; copy?: boolean; balanceAfter?: number } = {}): Promise<boolean> {
  const balanceAfter = await resolveBalance(sale, opts)
  const html = receiptHtml(sale, settings, { refund: opts.refund, copy: opts.copy, balanceAfter })
  return platform.print(html, {
    printer: settings.receipt.printerName || undefined,
    silent: opts.silent ?? settings.receipt.autoPrint,
    widthMm: settings.receipt.paper,
    copies: Math.max(1, settings.receipt.copies || 1),
  })
}

export async function shareSale(sale: Sale, settings: Settings, opts: ReceiptOptions = {}): Promise<boolean> {
  const balanceAfter = await resolveBalance(sale, opts)
  return platform.share(receiptText(sale, settings, { ...opts, balanceAfter }), t('receipt.docTitle', { n: sale.number }))
}
