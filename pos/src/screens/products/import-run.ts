// Runs a parsed CSV import against the database: match by barcode, then by exact name; update or create.
// Second-currency rules: a row with `fxPrice` anchors the product (its primary price is derived at the current rate and
// the `price` cell is ignored); a row with only `price` on an anchored product sets the primary price and un-anchors it
// (explicit primary wins); `fxPrice`/`fxCost` without a usable rate → the row is skipped ('noRate').
import { db } from '../../db'
import { forbiddenProduct } from '../../lib/policy'
import type { Category, Product, SecondCurrency } from '../../db/types'
import { uid } from '../../lib/ids'
import { round } from '../../lib/money'
import { derivePrices, fxToPrimary } from '../../lib/fx'
import { applyStock } from '../../lib/stock'
import { t } from '../../i18n'
import type { ImportRow } from './import-map'
import { normalizeText, PRODUCT_COLORS } from './product-utils'

export type SkipReason = 'empty' | 'noName' | 'noPrice' | 'badPrice' | 'policy' | 'noRate'
export interface ImportReport {
  created: number
  updated: number
  categoriesCreated: number
  skipped: { line: number; name: string; reason: SkipReason }[]
}
export interface ImportRunOptions {
  /** Whether a stock column was mapped: only then is stock touched. */
  stockMapped: boolean
  userId?: string
  decimals?: number
  /** The second currency (rate, rounding, decimals): needed for rows that carry `fxPrice` / `fxCost`. Rate 0 or absent → those rows are skipped. */
  currency2?: Pick<SecondCurrency, 'rate' | 'roundTo' | 'roundMode' | 'decimals'>
  onProgress?: (done: number, total: number) => void
}

export function skipReasonText(r: SkipReason): string {
  return t(`products.import.skip.${r}`)
}

export async function runImport(rows: ImportRow[], opts: ImportRunOptions): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, categoriesCreated: 0, skipped: [] }
  const d = opts.decimals ?? 2
  const now = Date.now()
  const c2 = opts.currency2 && opts.currency2.rate > 0 ? opts.currency2 : undefined
  const fd = c2?.decimals ?? 2

  await db.transaction('rw', db.products, db.categories, db.stockMoves, async () => {
    const cats = await db.categories.toArray()
    const byName = new Map<string, Category>(cats.map(c => [normalizeText(c.name), c]))
    let nextSort = cats.reduce((m, c) => Math.max(m, c.sort), 0) + 1
    const categoryFor = async (name: string | undefined): Promise<string | undefined> => {
      if (!name) return undefined
      const key = normalizeText(name)
      if (!key) return undefined
      const found = byName.get(key)
      if (found) return found.id
      const c: Category = { id: uid(), name: name.trim(), color: PRODUCT_COLORS[byName.size % PRODUCT_COLORS.length], sort: nextSort++, createdAt: now }
      await db.categories.add(c)
      byName.set(key, c)
      report.categoriesCreated++
      return c.id
    }

    let done = 0
    for (const row of rows) {
      done++
      const name = row.name.trim()
      const barcodes = row.barcodes
      if (!name && !barcodes.length) { report.skipped.push({ line: row.line, name, reason: 'empty' }); continue }
      if (row.price !== undefined && row.price < 0) { report.skipped.push({ line: row.line, name, reason: 'badPrice' }); continue }
      if (row.fxPrice !== undefined && row.fxPrice < 0) { report.skipped.push({ line: row.line, name, reason: 'badPrice' }); continue }
      const hasFx = row.fxPrice !== undefined || row.fxCost !== undefined
      if (hasFx && !c2) { report.skipped.push({ line: row.line, name, reason: 'noRate' }); continue }
      if (forbiddenProduct({ name, notes: row.notes, sku: row.sku })) { report.skipped.push({ line: row.line, name, reason: 'policy' }); continue }

      let existing: Product | undefined
      if (barcodes.length) existing = await db.products.where('barcodes').anyOf(barcodes).first()
      if (!existing && name) existing = await db.products.where('name').equals(name).first()

      const categoryId = await categoryFor(row.category)

      if (existing) {
        const patch: Partial<Product> = { updatedAt: now }
        const next: Product = { ...existing }
        if (row.fxPrice !== undefined && c2) {
          next.fxPrice = round(row.fxPrice, fd)                       // anchors; the `price` cell is ignored
        } else if (row.price !== undefined) {
          next.price = round(row.price, d)                            // explicit primary wins: un-anchor the selling prices
          delete next.fxPrice; delete next.fxWholesalePrice
          if (next.packs?.some(k => typeof k.fxPrice === 'number')) next.packs = next.packs.map(k => { const { fxPrice: _f, ...rest } = k; return rest })
        }
        if (row.fxCost !== undefined && c2) {
          next.fxCost = round(row.fxCost, fd)
        } else if (row.cost !== undefined) {
          next.cost = round(row.cost, d)
          delete next.fxCost
        }
        if (categoryId) patch.categoryId = categoryId
        if (row.unit) patch.unit = row.unit
        if (row.sku) patch.sku = row.sku
        if (row.notes) patch.notes = row.notes
        if (row.lowStock !== undefined) patch.lowStock = Math.max(0, row.lowStock)
        if (name && !existing.name) patch.name = name
        const extra = barcodes.filter(b => !existing!.barcodes.includes(b))
        if (extra.length) patch.barcodes = [...existing.barcodes, ...extra]
        let stockDiff = 0
        if (opts.stockMapped && row.stock !== undefined) {
          if (!existing.trackStock) patch.trackStock = true
          stockDiff = round(row.stock - existing.stock, 3)
        }
        Object.assign(next, patch)
        if (c2) Object.assign(next, derivePrices(next, c2, d, now) ?? {})
        await db.products.put(next)
        if (stockDiff !== 0) await applyStock([{ productId: existing.id, qty: stockDiff, type: 'import', note: t('products.import.moveNote'), userId: opts.userId }], now)
        report.updated++
      } else {
        if (!name) { report.skipped.push({ line: row.line, name, reason: 'noName' }); continue }
        const fxPrice = row.fxPrice !== undefined && c2 ? round(row.fxPrice, fd) : undefined
        const fxCost = row.fxCost !== undefined && c2 ? round(row.fxCost, fd) : undefined
        if (row.price === undefined && fxPrice === undefined) { report.skipped.push({ line: row.line, name, reason: 'noPrice' }); continue }
        const trackStock = opts.stockMapped && row.stock !== undefined
        const price = fxPrice !== undefined && c2 ? fxToPrimary(fxPrice, c2, d, 'price') : round(row.price ?? 0, d)
        const cost = fxCost !== undefined && c2 ? fxToPrimary(fxCost, c2, d, 'cost') : round(row.cost ?? 0, d)
        const p: Product = {
          id: uid(), name, barcodes, sku: row.sku, categoryId, price, cost,
          ...(fxPrice !== undefined ? { fxPrice } : {}), ...(fxCost !== undefined ? { fxCost } : {}), ...(fxPrice !== undefined || fxCost !== undefined ? { repricedAt: now } : {}),
          trackStock, stock: 0, lowStock: Math.max(0, row.lowStock ?? 0), unit: row.unit ?? 'piece', allowFraction: false,
          favorite: false, active: true, notes: row.notes, createdAt: now, updatedAt: now,
        }
        await db.products.add(p)
        if (trackStock && row.stock) await applyStock([{ productId: p.id, qty: round(row.stock!, 3), type: 'import', note: t('products.import.moveNote'), userId: opts.userId }], now)
        report.created++
      }
      if (opts.onProgress && (done % 25 === 0 || done === rows.length)) opts.onProgress(done, rows.length)
    }
  })
  return report
}
