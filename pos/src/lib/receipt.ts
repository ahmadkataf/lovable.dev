// PLACEHOLDER — the sales module replaces this file with the real receipt renderer (thermal 58/80 mm).
import type { Sale, Refund, Settings } from '../db/types'
import { formatMoney } from './money'
import { platform } from './platform'

/** A complete, self-contained HTML document of the receipt, sized for `settings.receipt.paper` mm paper. */
export function receiptHtml(sale: Sale, settings: Settings, opts: { refund?: Refund; copy?: boolean } = {}): string {
  const c = settings.currency
  const rows = sale.items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>${formatMoney(i.total, c)}</td></tr>`).join('')
  return `<!doctype html><html dir="rtl"><body><h3>${settings.store.name}</h3><table>${rows}</table><b>${formatMoney(sale.total, c)}</b>${opts.refund ? '' : ''}</body></html>`
}
/** The receipt as plain text (for WhatsApp / Bluetooth printer apps). */
export function receiptText(sale: Sale, settings: Settings): string {
  const c = settings.currency
  return [settings.store.name, ...sale.items.map(i => `${i.name} x${i.qty} = ${formatMoney(i.total, c)}`), `= ${formatMoney(sale.total, c)}`].join('\n')
}
export async function printSale(sale: Sale, settings: Settings, opts: { refund?: Refund; silent?: boolean } = {}): Promise<boolean> {
  return platform.print(receiptHtml(sale, settings, opts), { printer: settings.receipt.printerName, silent: opts.silent ?? settings.receipt.autoPrint, widthMm: settings.receipt.paper, copies: settings.receipt.copies })
}
export async function shareSale(sale: Sale, settings: Settings): Promise<boolean> {
  return platform.share(receiptText(sale, settings))
}
