import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { logAudit, allowed, recentAudit, setAuditActor } from './audit'
import { DEFAULT_SETTINGS } from '../db/types'

beforeEach(async () => { await db.delete(); await db.open() })

describe('audit', () => {
  it('records who did what, newest first', async () => {
    setAuditActor(() => ({ id: 'u1', name: 'خالد' }))
    await logAudit({ kind: 'refund', detail: '#12', amount: 500 })
    await logAudit({ kind: 'product.delete', detail: 'Milk', user: null })
    const rows = await recentAudit()
    expect(rows.map(r => r.kind)).toEqual(['product.delete', 'refund'])
    expect(rows[1].userName).toBe('خالد'); expect(rows[0].userName).toBeUndefined()
  })
  it('writes after an outer transaction instead of inside it', async () => {
    await db.transaction('rw', db.products, async () => {
      await db.products.add({ id: 'p', name: 'x', barcodes: [], price: 1, cost: 1, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 })
      await logAudit({ kind: 'stock.adjust', detail: 'inside', user: null })
    })
    await new Promise(r => setTimeout(r, 20))
    expect(await db.audit.count()).toBe(1)
  })
  it('lets admins do everything and cashiers what the owner allowed', () => {
    const s = { ...DEFAULT_SETTINGS, permissions: { ...DEFAULT_SETTINGS.permissions, cashierRefund: false } }
    expect(allowed({ role: 'admin' }, s, 'cashierRefund')).toBe(true)
    expect(allowed({ role: 'cashier' }, s, 'cashierRefund')).toBe(false)
    expect(allowed({ role: 'cashier' }, s, 'cashierDiscount')).toBe(true)
    expect(allowed(null, s, 'cashierDiscount')).toBe(false)
  })
})
