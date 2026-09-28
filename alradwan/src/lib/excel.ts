import * as XLSX from 'xlsx'
import { saveFile } from './platform'
import { toNumber } from './format'

// Excel in and out: the shop owner can keep his product list in Excel, bring it in, and get every
// table and report out as a sheet he can print or send.

export async function exportSheet(name: string, rows: Record<string, unknown>[], sheetName = 'ورقة1'): Promise<void> {
  const ws = XLSX.utils.json_to_sheet(rows)
  // right-to-left sheet and readable column widths
  ws['!cols'] = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(12, Math.min(40, k.length + 6)) }))
  if (!(ws as any)['!views']) (ws as any)['!views'] = [{ rightToLeft: true }]
  const wb = XLSX.utils.book_new()
  ;(wb.Workbook ??= {}).Views = [{ RTL: true }]
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  await saveFile(`${name}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}

export interface ImportedProduct { code: string; barcode?: string; name: string; category?: string; brand?: string; cars?: string; unit?: string; cost: number; price: number; wholesalePrice?: number; minStock?: number; stock?: number; location?: string; notes?: string }

// column names accepted in the imported file (Arabic or English, any of the spellings)
const COLS: Record<keyof ImportedProduct, string[]> = {
  code: ['الكود', 'كود', 'رقم القطعة', 'رقم', 'code', 'sku', 'part', 'part number'],
  barcode: ['باركود', 'الباركود', 'barcode'],
  name: ['الاسم', 'اسم', 'اسم القطعة', 'القطعة', 'الصنف', 'المنتج', 'name', 'product'],
  category: ['التصنيف', 'تصنيف', 'الفئة', 'النوع', 'category'],
  brand: ['الماركة', 'ماركة', 'الشركة', 'brand', 'make'],
  cars: ['السيارة', 'السيارات', 'يناسب', 'الموديل', 'cars', 'car', 'model', 'fits'],
  unit: ['الوحدة', 'وحدة', 'unit'],
  cost: ['سعر الشراء', 'الشراء', 'الكلفة', 'التكلفة', 'cost', 'buy', 'purchase price'],
  price: ['سعر البيع', 'البيع', 'السعر', 'price', 'sell', 'sale price'],
  wholesalePrice: ['سعر الجملة', 'الجملة', 'wholesale'],
  minStock: ['حد التنبيه', 'الحد الأدنى', 'min', 'min stock', 'minimum'],
  stock: ['الكمية', 'كمية', 'المخزون', 'الرصيد', 'stock', 'qty', 'quantity'],
  location: ['المكان', 'الرف', 'الموقع', 'location', 'shelf'],
  notes: ['ملاحظات', 'ملاحظة', 'notes', 'note'],
}

function normHeader(h: string) { return String(h).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه') }

export async function readProductsFile(file: File): Promise<{ rows: ImportedProduct[]; headers: string[] }> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  const headers = Object.keys(raw[0] ?? {})
  const map = new Map<keyof ImportedProduct, string>()
  for (const h of headers) {
    const nh = normHeader(h)
    for (const key of Object.keys(COLS) as (keyof ImportedProduct)[]) {
      if (map.has(key)) continue
      if (COLS[key].some(alias => normHeader(alias) === nh)) { map.set(key, h); break }
    }
  }
  const get = (r: Record<string, unknown>, k: keyof ImportedProduct) => { const h = map.get(k); return h === undefined ? '' : String(r[h] ?? '').trim() }
  const rows: ImportedProduct[] = []
  for (const r of raw) {
    const name = get(r, 'name'); const code = get(r, 'code')
    if (!name && !code) continue
    rows.push({
      code, name: name || code, barcode: get(r, 'barcode') || undefined, category: get(r, 'category') || undefined,
      brand: get(r, 'brand') || undefined, cars: get(r, 'cars') || undefined, unit: get(r, 'unit') || undefined,
      cost: toNumber(get(r, 'cost')), price: toNumber(get(r, 'price')), wholesalePrice: map.has('wholesalePrice') ? toNumber(get(r, 'wholesalePrice')) : undefined,
      minStock: map.has('minStock') ? toNumber(get(r, 'minStock')) : undefined, stock: map.has('stock') ? toNumber(get(r, 'stock')) : undefined,
      location: get(r, 'location') || undefined, notes: get(r, 'notes') || undefined,
    })
  }
  return { rows, headers }
}

export async function downloadProductsTemplate(): Promise<void> {
  await exportSheet('نموذج-استيراد-المنتجات', [
    { 'الكود': 'FLT-001', 'الاسم': 'فلتر زيت', 'التصنيف': 'فلاتر', 'الماركة': 'Bosch', 'السيارات': 'كيا ريو 2012-2017', 'الوحدة': 'قطعة', 'سعر الشراء': 25000, 'سعر البيع': 35000, 'الكمية': 10, 'حد التنبيه': 3, 'المكان': 'رف A1', 'باركود': '', 'ملاحظات': '' },
    { 'الكود': 'BRK-014', 'الاسم': 'فحمات فرام أمامي', 'التصنيف': 'فرامل', 'الماركة': 'TRW', 'السيارات': 'هيونداي إلنترا 2011-2016', 'الوحدة': 'طقم', 'سعر الشراء': 120000, 'سعر البيع': 160000, 'الكمية': 4, 'حد التنبيه': 2, 'المكان': 'رف B3', 'باركود': '', 'ملاحظات': '' },
  ], 'المنتجات')
}
