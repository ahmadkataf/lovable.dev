// The shopping cart and its arithmetic. Pure functions: the store and the tests both use them.
import { productPrice, type CustomerTier, type Product, type ProductPack, type TaxSettings, type SaleItem } from '../db/types'
import { round } from './money'

export interface CartLine {
  key: string
  productId?: string
  name: string
  barcode?: string
  unit: string
  price: number           // unit price charged
  originalPrice: number
  qty: number
  cost: number
  discount: number        // line discount amount
  discountPct?: number    // when the discount was given as a percentage
  taxRate: number         // percent
  allowFraction: boolean
  trackStock: boolean
  stock: number           // stock at the time it was added (for warnings), in base units
  note?: string
  unitsPerQty?: number    // a pack line: base units per qty
  packName?: string
}

/** Base units a line takes from stock. */
export const lineUnits = (l: Pick<CartLine, 'qty' | 'unitsPerQty'>): number => round(l.qty * (l.unitsPerQty ?? 1), 3)

export interface Cart {
  lines: CartLine[]
  discount: number        // sale-level discount amount
  discountPct?: number
  customerId?: string
  customerName?: string
  note?: string
  redeemPoints?: number   // loyalty points turned into the sale discount
}

export interface Totals {
  itemCount: number       // sum of quantities
  lineCount: number
  subtotal: number        // sum of line totals (after line discounts)
  discount: number        // sale discount amount
  tax: number
  total: number
  cost: number
  lines: { key: string; net: number; tax: number }[]
}

export const emptyCart = (): Cart => ({ lines: [], discount: 0 })

let keySeq = 0
export const lineKey = (): string => `${Date.now().toString(36)}-${(keySeq++).toString(36)}`

export interface LineOptions {
  /** Sell one of the product's packs instead of the base unit. */
  pack?: ProductPack
  /** Wholesale customers get the wholesale price (packs keep their own price). */
  tier?: CustomerTier | null
}
export function lineFromProduct(p: Product, qty = 1, defaultTaxRate = 0, o: LineOptions = {}): CartLine {
  const pack = o.pack && o.pack.qty > 0 ? o.pack : undefined
  const price = pack ? pack.price : productPrice(p, o.tier)
  return {
    key: lineKey(), productId: p.id, name: p.name, barcode: pack?.barcode || p.barcodes[0], unit: pack ? pack.name : p.unit,
    price, originalPrice: price, qty, cost: pack ? round(p.cost * pack.qty, 4) : p.cost, discount: 0,
    taxRate: p.taxRate ?? defaultTaxRate, allowFraction: pack ? false : p.allowFraction, trackStock: p.trackStock, stock: p.stock,
    unitsPerQty: pack ? pack.qty : undefined, packName: pack?.name,
  }
}

export function lineTotal(l: CartLine, decimals: number): number {
  return round(l.price * l.qty - l.discount, decimals)
}

/** Adds a product: a line with the same product and price grows, anything else is a new line. */
export function addToCart(cart: Cart, line: CartLine): Cart {
  const i = cart.lines.findIndex(l => l.productId && l.productId === line.productId && l.price === line.price && !l.note && !line.note && l.discount === 0 && line.discount === 0
    && (l.unitsPerQty ?? 1) === (line.unitsPerQty ?? 1) && (l.packName ?? '') === (line.packName ?? ''))
  if (i >= 0) {
    const lines = cart.lines.slice()
    lines[i] = { ...lines[i], qty: round(lines[i].qty + line.qty, 3) }
    return { ...cart, lines }
  }
  return { ...cart, lines: [...cart.lines, { ...line, qty: round(line.qty, 3) }] }
}

export function updateLine(cart: Cart, key: string, patch: Partial<CartLine>): Cart {
  return { ...cart, lines: cart.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }
}
export function removeLine(cart: Cart, key: string): Cart {
  return { ...cart, lines: cart.lines.filter(l => l.key !== key) }
}
export function setLineQty(cart: Cart, key: string, qty: number): Cart {
  if (qty <= 0) return removeLine(cart, key)
  return updateLine(cart, key, { qty: round(qty, 3) })
}

/** The sale discount: a percentage of the subtotal, or a fixed amount, never more than the subtotal. */
export function saleDiscount(cart: Cart, subtotal: number, decimals: number): number {
  const d = cart.discountPct !== undefined ? (subtotal * cart.discountPct) / 100 : cart.discount
  return round(Math.min(Math.max(0, d), subtotal), decimals)
}

export function computeTotals(cart: Cart, tax: TaxSettings, decimals: number): Totals {
  const lineTotals = cart.lines.map(l => ({ key: l.key, gross: lineTotal(l, decimals), rate: tax.enabled ? l.taxRate : 0 }))
  const subtotal = round(lineTotals.reduce((s, l) => s + l.gross, 0), decimals)
  const discount = saleDiscount(cart, subtotal, decimals)
  // spread the sale discount over the lines in proportion, so each line's tax is right. Shares are rounded
  // cumulatively, so every line stays within one unit of its exact share and the rounding never piles up
  // on the last line (100 lines of 1 with 50 off: 0/1 each, not 0 … 0, 50)
  let spread = 0, cum = 0
  const lines = lineTotals.map((l, i) => {
    cum += l.gross
    let share = subtotal > 0 ? round(round((cum / subtotal) * discount, decimals) - spread, decimals) : 0
    if (i === lineTotals.length - 1) share = round(discount - spread, decimals)
    spread = round(spread + share, decimals)
    const net = round(l.gross - share, decimals)
    const t = l.rate > 0 ? (tax.inclusive ? round(net - net / (1 + l.rate / 100), decimals) : round(net * (l.rate / 100), decimals)) : 0
    return { key: l.key, net, tax: t }
  })
  const taxTotal = round(lines.reduce((s, l) => s + l.tax, 0), decimals)
  const net = round(subtotal - discount, decimals)
  const total = tax.enabled && !tax.inclusive ? round(net + taxTotal, decimals) : net
  return {
    itemCount: round(cart.lines.reduce((s, l) => s + l.qty, 0), 3),
    lineCount: cart.lines.length,
    subtotal, discount, tax: taxTotal, total,
    cost: round(cart.lines.reduce((s, l) => s + l.cost * l.qty, 0), decimals),
    lines,
  }
}

/** Cart lines as they are stored on a receipt. */
export function toSaleItems(cart: Cart, totals: Totals, decimals: number): SaleItem[] {
  return cart.lines.map(l => {
    const t = totals.lines.find(x => x.key === l.key)
    return {
      productId: l.productId, name: l.name, barcode: l.barcode, unit: l.unit, qty: l.qty,
      price: l.price, originalPrice: l.originalPrice, cost: l.cost, discount: l.discount,
      taxRate: l.taxRate, tax: t?.tax ?? 0, total: lineTotal(l, decimals), note: l.note,
      unitsPerQty: l.unitsPerQty && l.unitsPerQty !== 1 ? l.unitsPerQty : undefined, packName: l.packName,
    }
  })
}
