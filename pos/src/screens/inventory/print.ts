// Printable documents of this module (a purchase invoice). Self-contained HTML for platform.print().
import type { Settings, Supplier } from '../../db/types'
import { t, isRtl } from '../../i18n'
import { formatMoney, formatQty } from '../../lib/money'
import { formatDateTime } from '../../lib/format'
import { platform } from '../../lib/platform'
import { isSupplierPayment, purchaseRemaining, type PurchaseRecord } from '../../lib/purchases'
import { fxCurrency, fxRemaining } from './logic'

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] ?? ch))

/** Wraps a body in a complete, direction-aware document. `widthMm` narrows it for thermal paper. */
export function htmlDoc(title: string, body: string, o: { widthMm?: number } = {}): string {
  const rtl = isRtl()
  const width = o.widthMm ? `${o.widthMm}mm` : '190mm'
  const pad = o.widthMm ? '2mm' : '10mm'
  return `<!doctype html><html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#111;margin:0;padding:${pad};font-size:${o.widthMm ? 12 : 13}px;line-height:1.45}
  .doc{max-width:${width};margin:0 auto}
  h1{font-size:${o.widthMm ? 16 : 20}px;margin:0 0 4px} h2{font-size:14px;margin:12px 0 4px}
  .muted{color:#666} .num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums} .center{text-align:center}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{padding:5px 6px;border-bottom:1px solid #ddd;text-align:start;vertical-align:top} th{background:#f3f3f3;font-size:11px}
  td.num,th.num{text-align:end}
  .tot{display:flex;justify-content:space-between;padding:3px 0} .tot.big{font-size:16px;font-weight:700;border-top:2px solid #111;margin-top:6px;padding-top:6px}
  .head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;margin-top:8px}
  .line{border-top:1px dashed #999;margin:8px 0}
  .sub{display:block;font-size:10px;color:#666;font-weight:400}
  @media print{body{padding:0}}
  </style></head><body><div class="doc">${body}</div></body></html>`
}

export function purchaseHtml(p: PurchaseRecord, settings: Settings, supplier?: Supplier | null): string {
  const c = settings.currency
  const payment = isSupplierPayment(p)
  const fx = p.fx
  const fc = fx ? fxCurrency(fx) : undefined
  const title = payment ? t('inventory.detail.paymentTitle', { n: p.number }) : t('inventory.detail.title', { n: p.number })
  /** The invoice's own currency, with the primary equivalent under it on second-currency invoices. */
  const dual = (primary: number, inFx?: number) => (fx && fc ? `${formatMoney(inFx ?? 0, fc)}<span class="sub num">${formatMoney(primary, c)}</span>` : formatMoney(primary, c))
  const rows = p.items.map((i, k) => `<tr><td class="num">${k + 1}</td><td>${esc(i.name)}</td><td class="num">${formatQty(i.qty)}</td><td class="num">${fx && fc && typeof i.fxCost === 'number' ? dual(i.cost, i.fxCost) : formatMoney(i.cost, c)}</td><td class="num">${dual(i.qty * i.cost, fx ? i.qty * (i.fxCost ?? 0) : undefined)}</td></tr>`).join('')
  const method = p.method ? t('common.' + p.method) : ''
  const supplierFx = supplier?.fxBalance ?? 0
  const body = `
  <div class="head">
    <div><h1>${esc(settings.store.name || t('app.name'))}</h1><div class="muted">${esc(settings.store.address)}${settings.store.phone ? ` · <span class="num">${esc(settings.store.phone)}</span>` : ''}</div></div>
    <div style="text-align:end"><h1>${esc(title)}</h1><div class="muted num">${formatDateTime(p.createdAt)}</div></div>
  </div>
  <div class="grid">
    <div><span class="muted">${t('common.supplier')}:</span> ${esc(p.supplierName ?? t('inventory.purchases.noSupplier'))}</div>
    ${supplier?.phone ? `<div><span class="muted">${t('common.phone')}:</span> <span class="num">${esc(supplier.phone)}</span></div>` : '<div></div>'}
    ${method ? `<div><span class="muted">${t('inventory.form.method')}:</span> ${esc(method)}</div>` : ''}
    ${fx ? `<div class="num">${esc(t('inventory.purchase.rate', { cur: fx.symbol, rate: formatMoney(fx.rate, c) }))}</div>` : ''}
    ${p.note ? `<div><span class="muted">${t('common.note')}:</span> ${esc(p.note)}</div>` : ''}
  </div>
  ${payment ? '' : `<table><thead><tr><th>#</th><th>${t('inventory.moves.product')}</th><th class="num">${t('common.qty')}</th><th class="num">${t('inventory.form.unitCost')}</th><th class="num">${t('common.total')}</th></tr></thead><tbody>${rows}</tbody></table>`}
  <div style="margin-top:10px;max-width:280px;margin-inline-start:auto">
    ${payment ? '' : `<div class="tot big"><span>${t('common.total')}</span><span class="num">${dual(p.total, fx?.total)}</span></div>`}
    <div class="tot${payment ? ' big' : ''}"><span>${t('common.paid')}</span><span class="num">${dual(p.paid, fx?.paid)}</span></div>
    ${payment ? '' : `<div class="tot"><span>${t('common.remaining')}</span><span class="num">${dual(purchaseRemaining(p, c.decimals), fx ? fxRemaining(fx) : undefined)}</span></div>`}
    ${supplier ? `<div class="tot muted"><span>${t('inventory.suppliers.balance')}</span><span class="num">${formatMoney(supplier.balance, c)}</span></div>` : ''}
    ${supplier && (fx || supplierFx !== 0) ? `<div class="tot muted"><span>${esc(t('inventory.supplier.fxBalance', { cur: fc?.symbol ?? settings.currency2.symbol }))}</span><span class="num">${formatMoney(supplierFx, fc ?? settings.currency2)}</span></div>` : ''}
  </div>`
  return htmlDoc(title, body)
}

export async function printPurchase(p: PurchaseRecord, settings: Settings, supplier?: Supplier | null): Promise<boolean> {
  return platform.print(purchaseHtml(p, settings, supplier))
}
