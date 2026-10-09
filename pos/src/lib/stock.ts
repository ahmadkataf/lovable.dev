// Every stock change goes through here, so the movement history is always complete.
import Dexie from 'dexie'
import { db } from '../db'
import type { StockMoveType } from '../db/types'
import { uid } from './ids'
import { round } from './money'

export interface StockChange { productId: string; qty: number; type: StockMoveType; refId?: string; note?: string; userId?: string }

/**
 * Applies stock changes (+ in, - out) and writes a StockMove for each. Call inside a db.transaction that
 * covers `products` and `stockMoves`, or on its own (it opens one). Products that do not track stock are skipped.
 */
export async function applyStock(changes: StockChange[], at = Date.now()): Promise<void> {
  const run = async () => {
    for (const c of changes) {
      if (!c.qty) continue
      const p = await db.products.get(c.productId)
      if (!p || !p.trackStock) continue
      const before = p.stock
      const after = round(before + c.qty, 3)
      await db.products.update(p.id, { stock: after, updatedAt: at })
      await db.stockMoves.add({ id: uid(), productId: p.id, qty: round(c.qty, 3), type: c.type, refId: c.refId, note: c.note, before, after, createdAt: at, userId: c.userId })
    }
  }
  if (Dexie.currentTransaction) return run()
  return db.transaction('rw', db.products, db.stockMoves, run)
}

/** Sets the stock to an exact counted value (a stock-take). */
export async function setStock(productId: string, counted: number, userId?: string, note?: string): Promise<void> {
  const p = await db.products.get(productId)
  if (!p) return
  await applyStock([{ productId, qty: round(counted - p.stock, 3), type: 'count', note, userId }])
}

