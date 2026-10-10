// Pure inventory logic: no React, no Dexie. Covered by tests/inventory.test.ts.
import type { ID, ISODate, InventoryItem, StockMovement, StockReason } from '@/db/types'
import { diffDays } from '@/lib/dates'
import { round2 } from '@/lib/format'

/** Category presets offered in the form and as filter chips; stored as the key, shown through t('inventory.cat.<key>'). */
export const CATEGORY_PRESETS = ['consumables', 'instruments', 'materials', 'medications', 'office', 'equipment'] as const
export type CategoryPreset = typeof CATEGORY_PRESETS[number]
export const UNITS = ['piece', 'box', 'pack', 'ml', 'g', 'other'] as const
export const STOCK_REASONS: StockReason[] = ['purchase', 'use', 'adjust', 'expired', 'return', 'initial']
/** Items expiring within this many days count as "expiring soon". */
export const EXPIRY_SOON_DAYS = 60

export const isPresetCategory = (c: string): c is CategoryPreset => (CATEGORY_PRESETS as readonly string[]).includes(c)

/** Low when the quantity has reached the alert threshold (an item with threshold 0 is low only when empty). */
export function isLowStock(item: Pick<InventoryItem, 'quantity' | 'minQuantity'>): boolean {
  return item.quantity <= Math.max(0, item.minQuantity || 0)
}
export const isOutOfStock = (item: Pick<InventoryItem, 'quantity'>) => item.quantity <= 0

export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired'
/** How to flag an expiry date: expired (before today), soon (within `soonDays`), ok, or none when there is no date. */
export function expiryState(date: ISODate | undefined | null, today: ISODate, soonDays = EXPIRY_SOON_DAYS): ExpiryState {
  if (!date) return 'none'
  const days = diffDays(today, date)
  if (days < 0) return 'expired'
  if (days <= soonDays) return 'soon'
  return 'ok'
}
/** Days until the expiry date (negative when already expired), null without a date. */
export function daysToExpiry(date: ISODate | undefined | null, today: ISODate): number | null {
  return date ? diffDays(today, date) : null
}

export const itemValue = (item: Pick<InventoryItem, 'quantity' | 'costPrice'>) => round2(Math.max(0, item.quantity) * (item.costPrice || 0))
/** Σ quantity × costPrice over the given items. */
export function stockValue(items: Pick<InventoryItem, 'quantity' | 'costPrice'>[]): number {
  return round2(items.reduce((a, i) => a + itemValue(i), 0))
}

export interface InventoryStats { count: number; low: number; expiring: number; value: number }
/** The four stat cards. Inactive items are left out. */
export function inventoryStats(items: InventoryItem[], today: ISODate): InventoryStats {
  const active = items.filter(i => i.active)
  return {
    count: active.length,
    low: active.filter(isLowStock).length,
    expiring: active.filter(i => { const s = expiryState(i.expiryDate, today); return s === 'soon' || s === 'expired' }).length,
    value: stockValue(active),
  }
}

export interface ItemFilters { q?: string; category?: string; lowOnly?: boolean; showInactive?: boolean }
export function filterItems(items: InventoryItem[], f: ItemFilters, match: (hay: string | undefined, needle: string) => boolean): InventoryItem[] {
  const q = (f.q || '').trim()
  return items.filter(i => {
    if (!f.showInactive && !i.active) return false
    if (f.category && i.category !== f.category) return false
    if (f.lowOnly && !isLowStock(i)) return false
    if (q && !(match(i.name, q) || match(i.sku, q) || match(i.supplier, q) || match(i.category, q) || match(i.location, q))) return false
    return true
  })
}

/** Items first by urgency (out of stock, low, expiring) then by name, so the list reads like a to-do. */
export function sortItems(items: InventoryItem[], today: ISODate): InventoryItem[] {
  const rank = (i: InventoryItem) => (!i.active ? 5 : isOutOfStock(i) ? 0 : isLowStock(i) ? 1 : expiryState(i.expiryDate, today) === 'expired' ? 2 : expiryState(i.expiryDate, today) === 'soon' ? 3 : 4)
  return [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

/** The distinct categories in use that are not presets (so the chips and the datalist can offer them). */
export function customCategories(items: Pick<InventoryItem, 'category'>[]): string[] {
  const set = new Set<string>()
  for (const i of items) { const c = (i.category || '').trim(); if (c && !isPresetCategory(c)) set.add(c) }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export type MoveDirection = 'in' | 'out'
export const REASONS_IN: StockReason[] = ['purchase', 'return', 'adjust']
export const REASONS_OUT: StockReason[] = ['use', 'expired', 'adjust']
export const directionOf = (delta: number): MoveDirection => (delta < 0 ? 'out' : 'in')
/** The signed delta of a quick movement: a positive amount in the chosen direction. */
export function signedDelta(amount: number, direction: MoveDirection): number { return direction === 'out' ? -Math.abs(amount) : Math.abs(amount) }

export type MoveError = 'amount' | 'notEnough' | null
/** Validation of a quick movement against the current quantity: stock never goes below zero. */
export function validateMove(amount: number | null | undefined, direction: MoveDirection, quantity: number): MoveError {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return 'amount'
  if (direction === 'out' && amount > quantity) return 'notEnough'
  return null
}

export interface MovementRow extends StockMovement { after: number }
/** Newest first, each row annotated with the quantity after it, derived backwards from the current quantity. */
export function withRunningBalance(movements: StockMovement[], currentQuantity: number): MovementRow[] {
  const sorted = [...movements].sort((a, b) => (b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt))
  let after = currentQuantity
  return sorted.map(m => { const row = { ...m, after }; after = round2(after - m.delta); return row })
}

/** Purchase rows as typed in the purchase modal. */
export interface PurchaseLine { itemId: ID; quantity: number | null; costPrice: number | null }
export type PurchaseLineError = 'item' | 'duplicate' | 'quantity' | null
export function validatePurchase(lines: PurchaseLine[]): { ok: boolean; errors: PurchaseLineError[] } {
  const seen = new Set<ID>()
  const errors = lines.map(l => {
    if (!l.itemId) return 'item' as const
    if (seen.has(l.itemId)) return 'duplicate' as const
    seen.add(l.itemId)
    if (l.quantity === null || !Number.isFinite(l.quantity) || l.quantity <= 0) return 'quantity' as const
    return null
  })
  return { ok: lines.length > 0 && errors.every(e => e === null), errors }
}
export const purchaseTotal = (lines: PurchaseLine[]) => round2(lines.reduce((a, l) => a + (l.quantity || 0) * (l.costPrice || 0), 0))

/** RFC-4180 CSV with a BOM so Excel opens Arabic text correctly. */
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')
}
