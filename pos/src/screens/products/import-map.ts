// CSV import: guessing which column is which from the headers, and reading one row into a clean record. Pure.
import { parseNumber } from '../../lib/money'
import { cleanBarcode } from '../../lib/barcode'
import { UNIT_KEYS } from './product-utils'

export type ImportField = 'name' | 'barcode' | 'price' | 'cost' | 'stock' | 'category' | 'unit' | 'sku' | 'lowStock' | 'notes'
export const IMPORT_FIELDS: ImportField[] = ['name', 'barcode', 'price', 'cost', 'stock', 'category', 'unit', 'sku', 'lowStock', 'notes']
/** Column index per field; a missing field is not imported. */
export type Mapping = Partial<Record<ImportField, number>>

export interface ImportRow {
  line: number
  name: string
  barcodes: string[]
  sku?: string
  category?: string
  unit?: string
  price?: number
  cost?: number
  stock?: number
  lowStock?: number
  notes?: string
}

const SYNONYMS: Record<ImportField, string[]> = {
  name: ['name', 'product', 'product name', 'item', 'item name', 'title', 'الاسم', 'اسم', 'المنتج', 'اسم المنتج', 'الصنف', 'صنف', 'المادة', 'البضاعة'],
  barcode: ['barcode', 'barcodes', 'ean', 'ean13', 'upc', 'code', 'bar code', 'الباركود', 'باركود', 'الرمز الشريطي', 'رمز شريطي', 'كود المنتج'],
  price: ['price', 'sell price', 'selling price', 'sale price', 'retail', 'retail price', 'unit price', 'السعر', 'سعر', 'سعر البيع', 'سعر المبيع', 'سعر الوحدة', 'المبيع'],
  cost: ['cost', 'cost price', 'purchase price', 'buy price', 'buying price', 'التكلفة', 'تكلفة', 'سعر التكلفة', 'سعر الشراء', 'الشراء', 'الكلفة'],
  stock: ['stock', 'qty', 'quantity', 'inventory', 'on hand', 'in stock', 'المخزون', 'مخزون', 'الكمية', 'كمية', 'العدد', 'الرصيد'],
  category: ['category', 'group', 'department', 'dept', 'الفئة', 'فئة', 'التصنيف', 'تصنيف', 'القسم', 'المجموعة', 'النوع'],
  unit: ['unit', 'uom', 'unit of measure', 'الوحدة', 'وحدة', 'وحدة القياس', 'وحدة البيع'],
  sku: ['sku', 'ref', 'reference', 'item code', 'product code', 'internal code', 'الرمز', 'رمز', 'رمز المنتج', 'كود', 'الكود', 'رقم الصنف'],
  lowStock: ['low stock', 'lowstock', 'min', 'minimum', 'min stock', 'reorder', 'reorder level', 'alert', 'حد التنبيه', 'الحد الأدنى', 'حد ادنى', 'تنبيه', 'حد الطلب'],
  notes: ['notes', 'note', 'description', 'desc', 'comment', 'ملاحظات', 'ملاحظة', 'الوصف', 'وصف', 'تعليق'],
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[_\-.]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Guesses the mapping from the header row. Headers like "name/الاسم" match on either side of the slash. */
export function autoMap(headers: string[]): Mapping {
  const m: Mapping = {}
  const used = new Set<number>()
  const parts = headers.map(h => normHeader(h).split('/').map(x => x.trim()).filter(Boolean))
  // exact matches first (so "sell price" wins over the loose "price" match), then loose ones
  for (const pass of ['exact', 'loose'] as const) {
    for (const field of IMPORT_FIELDS) {
      if (m[field] !== undefined) continue
      const syns = SYNONYMS[field]
      for (let i = 0; i < parts.length; i++) {
        if (used.has(i)) continue
        const hit = pass === 'exact'
          ? parts[i].some(p => syns.includes(p))
          : parts[i].some(p => syns.some(s => s.length >= 3 && (p.includes(s) || s.includes(p)) && p.length >= 3))
        if (hit) { m[field] = i; used.add(i); break }
      }
    }
  }
  return m
}

/** True when the first row looks like a header (text where numbers are expected, or known names). */
export function looksLikeHeader(row: string[]): boolean {
  const map = autoMap(row)
  if (Object.keys(map).length >= 2) return true
  return row.length > 0 && row.every(c => c.trim() === '' || !/^[\d٠-٩.,٫]+$/.test(c.trim()))
    && Object.keys(map).length >= 1
}

/** "1,250.50", "١٬٢٥٠", "1 250 ل.س" → a number; blank or no digits → undefined. */
export function parseAmount(s: string | undefined): number | undefined {
  if (s === undefined || s === null) return undefined
  const txt = String(s).replace(/[٬]/g, ',')
  if (!/[0-9٠-٩۰-۹]/.test(txt)) return undefined
  return parseNumber(txt)
}

const UNIT_WORDS: Record<string, string> = {
  piece: 'piece', pc: 'piece', pcs: 'piece', unit: 'piece', each: 'piece', ea: 'piece', 'قطعة': 'piece', 'قطع': 'piece', 'حبة': 'piece', 'حبه': 'piece', 'عدد': 'piece',
  kg: 'kg', kilo: 'kg', kilogram: 'kg', 'كغ': 'kg', 'كيلو': 'kg', 'كيلوغرام': 'kg', 'كجم': 'kg', 'كلغ': 'kg',
  g: 'g', gram: 'g', gr: 'g', 'غ': 'g', 'غرام': 'g', 'جرام': 'g', 'غم': 'g', 'جم': 'g',
  l: 'l', liter: 'l', litre: 'l', lt: 'l', 'لتر': 'l', 'ليتر': 'l',
  ml: 'ml', 'مل': 'ml', 'ملل': 'ml', 'مليلتر': 'ml',
  m: 'm', meter: 'm', metre: 'm', 'متر': 'm', 'م': 'm',
  box: 'box', 'علبة': 'box', 'علبه': 'box', 'صندوق': 'box',
  pack: 'pack', carton: 'pack', ctn: 'pack', 'كرتونة': 'pack', 'كرتونه': 'pack', 'كرتون': 'pack', 'باكيت': 'pack', 'باكيت ': 'pack',
  dozen: 'dozen', dz: 'dozen', 'دزينة': 'dozen', 'دزينه': 'dozen', 'درزن': 'dozen',
}
/** A unit from a file: known words become unit keys, anything else is kept as free text. */
export function unitFromText(s: string | undefined): string | undefined {
  const v = (s ?? '').trim()
  if (!v) return undefined
  const k = v.toLowerCase().replace(/[ً-ْ]/g, '')
  if ((UNIT_KEYS as readonly string[]).includes(k)) return k
  return UNIT_WORDS[k] ?? v
}

export function splitBarcodes(cell: string | undefined): string[] {
  if (!cell) return []
  const out: string[] = []
  for (const part of String(cell).split(/[|;,\s]+/)) {
    const c = cleanBarcode(part)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

export function parseImportRow(row: string[], mapping: Mapping, line: number): ImportRow {
  const cell = (f: ImportField): string | undefined => {
    const i = mapping[f]
    if (i === undefined) return undefined
    const v = row[i]
    return v === undefined ? undefined : String(v).trim()
  }
  const name = cell('name') ?? ''
  const out: ImportRow = { line, name, barcodes: splitBarcodes(cell('barcode')) }
  const sku = cell('sku'); if (sku) out.sku = sku
  const category = cell('category'); if (category) out.category = category
  const unit = unitFromText(cell('unit')); if (unit) out.unit = unit
  const notes = cell('notes'); if (notes) out.notes = notes
  const price = parseAmount(cell('price')); if (price !== undefined) out.price = price
  const cost = parseAmount(cell('cost')); if (cost !== undefined) out.cost = cost
  const stock = parseAmount(cell('stock')); if (stock !== undefined) out.stock = stock
  const low = parseAmount(cell('lowStock')); if (low !== undefined) out.lowStock = low
  return out
}

/** A mapping can run when it tells us how to recognise a product: a name or a barcode column. */
export function mappingOk(m: Mapping): boolean {
  return m.name !== undefined || m.barcode !== undefined
}
