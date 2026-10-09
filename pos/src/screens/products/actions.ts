// Database actions shared by the form, the list and the bulk bar.
import { db } from '../../db'
import type { Product } from '../../db/types'
import { cleanBarcode } from '../../lib/barcode'

const SCAN_CAP = 5000

/**
 * Is the product on any receipt, refund or purchase? Scans the most recent 5000 of each; a shop with more history
 * than that is assumed to reference every product (we deactivate instead of deleting, which is always safe).
 */
export async function isProductReferenced(id: string): Promise<boolean> {
  const has = (items: { productId?: string }[]) => items.some(i => i.productId === id)
  if ((await db.sales.count()) > SCAN_CAP) return true
  if (await db.sales.orderBy('createdAt').reverse().limit(SCAN_CAP).filter(s => has(s.items)).first()) return true
  if (await db.refunds.orderBy('createdAt').reverse().limit(SCAN_CAP).filter(r => has(r.items)).first()) return true
  if ((await db.purchases.count()) > SCAN_CAP) return true
  if (await db.purchases.orderBy('createdAt').reverse().limit(SCAN_CAP).filter(p => has(p.items)).first()) return true
  return false
}

export type DeleteOutcome = 'deleted' | 'deactivated' | 'missing'

/** Hard-deletes a product (and its stock moves) when nothing references it, else marks it inactive so history stays intact. */
export async function deleteProduct(id: string): Promise<DeleteOutcome> {
  const p = await db.products.get(id)
  if (!p) return 'missing'
  if (await isProductReferenced(id)) {
    await db.products.update(id, { active: false, updatedAt: Date.now() })
    return 'deactivated'
  }
  await db.transaction('rw', db.products, db.stockMoves, async () => {
    await db.stockMoves.where('productId').equals(id).delete()
    await db.products.delete(id)
  })
  return 'deleted'
}

export interface BarcodeConflict { code: string; product: Product }
/** Which of these barcodes already belong to another product. */
export async function findBarcodeConflicts(codes: string[], exceptId?: string): Promise<BarcodeConflict[]> {
  const clean = [...new Set(codes.map(cleanBarcode).filter(Boolean))]
  if (!clean.length) return []
  const owners = await db.products.where('barcodes').anyOf(clean).toArray()
  const out: BarcodeConflict[] = []
  for (const code of clean) {
    const owner = owners.find(p => p.id !== exceptId && p.barcodes.includes(code))
    if (owner) out.push({ code, product: owner })
  }
  return out
}
