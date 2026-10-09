// Runs a parsed CSV import against the database: match by barcode, then by exact name; update or create.
import { db } from '../../db'
import type { Category, Product } from '../../db/types'
import { uid } from '../../lib/ids'
import { round } from '../../lib/money'
import { applyStock } from '../../lib/stock'
import { t } from '../../i18n'
import type { ImportRow } from './import-map'
import { normalizeText, PRODUCT_COLORS } from './product-utils'

export type SkipReason = 'empty' | 'noName' | 'noPrice' | 'badPrice'
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
  onProgress?: (done: number, total: number) => void
}

export function skipReasonText(r: SkipReason): string {
  return t(`products.import.skip.${r}`)
}

export async function runImport(rows: ImportRow[], opts: ImportRunOptions): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, categoriesCreated: 0, skipped: [] }
  const d = opts.decimals ?? 2
  const now = Date.now()

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

      let existing: Product | undefined
      if (barcodes.length) existing = await db.products.where('barcodes').anyOf(barcodes).first()
      if (!existing && name) existing = await db.products.where('name').equals(name).first()

      const categoryId = await categoryFor(row.category)

      if (existing) {
        const patch: Partial<Product> = { updatedAt: now }
        if (row.price !== undefined) patch.price = round(row.price, d)
        if (row.cost !== undefined) patch.cost = round(row.cost, d)
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
        await db.products.update(existing.id, patch)
        if (stockDiff !== 0) await applyStock([{ productId: existing.id, qty: stockDiff, type: 'import', note: t('products.import.moveNote'), userId: opts.userId }], now)
        report.updated++
      } else {
        if (!name) { report.skipped.push({ line: row.line, name, reason: 'noName' }); continue }
        if (row.price === undefined) { report.skipped.push({ line: row.line, name, reason: 'noPrice' }); continue }
        const trackStock = opts.stockMapped && row.stock !== undefined
        const p: Product = {
          id: uid(), name, barcodes, sku: row.sku, categoryId, price: round(row.price, d), cost: round(row.cost ?? 0, d),
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
