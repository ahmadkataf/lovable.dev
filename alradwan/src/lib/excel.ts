// the library is big and rarely needed, so it is fetched the first time a sheet is read or written
const xlsx = () => import('xlsx')
import { can } from '../db/store'
import { notifyError } from './notify'
import { saveFile } from './platform'
import { toNumber } from './format'

// Excel in and out: the shop owner can keep his product list in Excel, bring it in, and get every
// table and report out as a sheet he can print or send.

export async function exportSheet(name: string, rows: Record<string, unknown>[], sheetName = 'ورقة1'): Promise<void> {
  if (!can('exportData')) { notifyError('ليس لديك صلاحية التصدير'); return }
  const XLSX = await xlsx()
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

export interface ImportedProduct { code: string; barcode?: string; oemNumbers?: string; name: string; category?: string; brand?: string; cars?: string; unit?: string; cost: number; price: number; wholesalePrice?: number; minStock?: number; stock?: number; location?: string; notes?: string }

// column names accepted in the imported file (Arabic or English, any of the spellings)
const COLS: Record<keyof ImportedProduct, string[]> = {
  code: ['الكود', 'كود', 'رقم القطعة', 'رقم', 'الرمز', 'رمز', 'كود المادة', 'رمز المادة', 'رقم المادة', 'code', 'sku', 'part', 'part number', 'item code'],
  barcode: ['باركود', 'الباركود', 'بار كود', 'barcode', 'ean', 'upc'],
  oemNumbers: ['oem', 'رقم الأصلي', 'الرقم الأصلي', 'رقم القطعة الأصلي', 'أرقام أصلية', 'oem numbers', 'original'],
  name: ['الاسم', 'اسم', 'اسم القطعة', 'القطعة', 'الصنف', 'اسم الصنف', 'المنتج', 'اسم المنتج', 'المادة', 'اسم المادة', 'البيان', 'name', 'product', 'item', 'description'],
  category: ['التصنيف', 'تصنيف', 'الفئة', 'النوع', 'المجموعة', 'القسم', 'category', 'group'],
  brand: ['الماركة', 'ماركة', 'الشركة', 'brand', 'make'],
  cars: ['السيارة', 'السيارات', 'يناسب', 'الموديل', 'cars', 'car', 'model', 'fits'],
  unit: ['الوحدة', 'وحدة', 'unit'],
  cost: ['سعر الشراء', 'الشراء', 'الكلفة', 'التكلفة', 'سعر التكلفة', 'سعر الكلفة', 'cost', 'buy', 'purchase price'],
  price: ['سعر البيع', 'البيع', 'السعر', 'سعر المبيع', 'المبيع', 'سعر المفرق', 'المفرق', 'price', 'sell', 'sale price'],
  wholesalePrice: ['سعر الجملة', 'الجملة', 'wholesale'],
  minStock: ['حد التنبيه', 'الحد الأدنى', 'min', 'min stock', 'minimum'],
  stock: ['الكمية', 'كمية', 'المخزون', 'الرصيد', 'العدد', 'الكمية المتبقية', 'الكمية الحالية', 'stock', 'qty', 'quantity'],
  location: ['المكان', 'الرف', 'الموقع', 'location', 'shelf'],
  notes: ['ملاحظات', 'ملاحظة', 'notes', 'note'],
}

function normHeader(h: string) { return String(h).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه') }

const DIGITS = /^[\s\d٠-٩۰-۹.,٫٬-]+$/
const isNumberCell = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && DIGITS.test(v) && /[\d٠-٩۰-۹]/.test(v))
const isBarcodeCell = (v: unknown) => /^\d{8,14}$/.test(String(v).trim())
const colName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`)
const LABEL: Partial<Record<keyof ImportedProduct, string>> = { name: 'الاسم', code: 'الكود', barcode: 'الباركود', cost: 'سعر الشراء', price: 'سعر البيع', stock: 'الكمية' }

/** Which column holds what when the file has no column titles (lists exported by other programs often
 *  start straight with the data): the text column is the name, two price columns are the purchase (the
 *  smaller) and the sale price, 8-14 digit numbers are barcodes, a third whole-number column the quantity. */
function guessColumns(data: unknown[][]): Map<keyof ImportedProduct, number> {
  const width = Math.max(0, ...data.map(r => r.length))
  const stats = Array.from({ length: width }, (_, c) => {
    const cells = data.map(r => r[c]).filter(v => String(v ?? '').trim() !== '')
    const n = cells.length || 1
    const nums = cells.filter(isNumberCell)
    return {
      c, filled: cells.length / Math.max(1, data.length),
      text: cells.filter(v => !isNumberCell(v)).length / n, number: nums.length / n,
      barcode: cells.filter(isBarcodeCell).length / n, whole: nums.every(v => Number.isInteger(toNumber(String(v)))),
      length: cells.reduce((t: number, v) => t + String(v).length, 0) / n,
      unique: new Set(cells.map(v => String(v).trim())).size / n,
    }
  }).filter(x => x.filled >= 0.3)
  const map = new Map<keyof ImportedProduct, number>()
  const texts = stats.filter(x => x.text >= 0.6).sort((a, b) => b.length - a.length)
  if (texts[0]) map.set('name', texts[0].c)
  // a short, mostly unique text column beside the name: its code
  const code = texts.slice(1).find(x => x.length <= 16 && x.unique >= 0.9)
  if (code) map.set('code', code.c)
  const barcode = stats.find(x => x.barcode >= 0.6)
  if (barcode) map.set('barcode', barcode.c)
  const numeric = stats.filter(x => x.number >= 0.6 && x !== barcode).sort((a, b) => a.c - b.c)
  if (numeric.length >= 2) {
    const [a, b] = numeric
    // the purchase price is the smaller one in most rows
    let aSmaller = 0, rows = 0
    for (const r of data) { const x = toNumber(String(r[a.c] ?? '')), y = toNumber(String(r[b.c] ?? '')); if (x || y) { rows++; if (x <= y) aSmaller++ } }
    map.set('cost', aSmaller >= rows / 2 ? a.c : b.c); map.set('price', aSmaller >= rows / 2 ? b.c : a.c)
    const qty = numeric.slice(2).find(x => x.whole)
    if (qty) map.set('stock', qty.c)
  } else if (numeric.length === 1) map.set('price', numeric[0].c)
  return map
}

/** Reads a product list from Excel (.xlsx, old .xls), CSV, or the HTML/XML "Excel" files other programs
 *  export. Column titles may be in any of the first rows, in Arabic or English; with no titles at all the
 *  columns are worked out from their contents and `guessed` says how, for the shop to check. */
/** The rows of a sheet file (cells as they are): the sheet with the most rows, since some programs put a cover sheet first. */
async function readSheetRows(file: File): Promise<unknown[][]> {
  const [XLSX, cp] = await Promise.all([xlsx(), import('xlsx/dist/cpexcel.full.mjs')])
  // old .xls files keep their text in a Windows code page
  XLSX.set_cptable(cp)
  const buf = await file.arrayBuffer()
  // an old binary .xls that does not say which code page it uses is taken as Arabic (never a CSV: that is UTF-8)
  const ole = new Uint8Array(buf.slice(0, 4)).join() === '208,207,17,224'
  const wb = XLSX.read(buf, { type: 'array', ...(ole ? { codepage: 1256 } : {}) })
  const sheets = wb.SheetNames.map(n => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '', blankrows: false, raw: true }))
  return sheets.sort((a, b) => b.length - a.length)[0] ?? []
}

/** Whether amounts look written in the given currency: dollar amounts are small and have cents; pounds are big. */
export function amountsLookLike(values: number[], c: 'USD' | 'SYP'): boolean {
  const p = values.map(Math.abs).filter(n => n > 0).sort((a, b) => a - b)
  if (!p.length) return false
  const median = p[Math.floor(p.length / 2)]
  return c === 'USD' ? median < 200 && p.some(n => !Number.isInteger(n)) : median >= 1000
}

export async function readProductsFile(file: File): Promise<{ rows: ImportedProduct[]; headers: string[]; guessed?: string }> {
  const aoa = await readSheetRows(file)
  const keyOf = (cell: unknown): keyof ImportedProduct | null => {
    const nh = normHeader(String(cell ?? ''))
    if (!nh) return null
    for (const key of Object.keys(COLS) as (keyof ImportedProduct)[]) if (COLS[key].some(alias => normHeader(alias) === nh)) return key
    return null
  }
  // the title row: the first of the top rows that names a product column
  let headerAt = -1
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const keys = aoa[i].map(keyOf)
    if (keys.some(k => k === 'name' || k === 'code') && keys.filter(Boolean).length >= 1) { headerAt = i; break }
  }
  let map = new Map<keyof ImportedProduct, number>()
  let headers: string[] = []
  let data: unknown[][]
  let guessed: string | undefined
  if (headerAt >= 0) {
    headers = aoa[headerAt].map(h => String(h ?? ''))
    aoa[headerAt].forEach((h, c) => { const k = keyOf(h); if (k && !map.has(k)) map.set(k, c) })
    data = aoa.slice(headerAt + 1)
  } else {
    data = aoa
    map = guessColumns(data)
    guessed = 'الملف بلا عناوين أعمدة، فقرأناه هكذا: ' + [...map.entries()].sort((a, b) => a[1] - b[1]).map(([k, c]) => `العمود ${colName(c)} = ${LABEL[k] ?? k}`).join('، ') + '. راجع الأسعار قبل الاستيراد.'
  }
  const get = (r: unknown[], k: keyof ImportedProduct) => { const c = map.get(k); return c === undefined ? '' : String(r[c] ?? '').trim() }
  const rows: ImportedProduct[] = []
  for (const r of data) {
    const name = get(r, 'name'); const code = get(r, 'code')
    if (!name && !code) continue
    // a repeated title row or a totals line in the middle of the list
    if (keyOf(name) || /^(المجموع|الإجمالي|total)/i.test(name)) continue
    rows.push({
      code, name: name || code, barcode: get(r, 'barcode') || undefined, oemNumbers: get(r, 'oemNumbers') || undefined, category: get(r, 'category') || undefined,
      brand: get(r, 'brand') || undefined, cars: get(r, 'cars') || undefined, unit: get(r, 'unit') || undefined,
      cost: toNumber(get(r, 'cost')), price: toNumber(get(r, 'price')), wholesalePrice: map.has('wholesalePrice') ? toNumber(get(r, 'wholesalePrice')) : undefined,
      minStock: map.has('minStock') ? toNumber(get(r, 'minStock')) : undefined, stock: map.has('stock') ? toNumber(get(r, 'stock')) : undefined,
      location: get(r, 'location') || undefined, notes: get(r, 'notes') || undefined,
    })
  }
  return { rows, headers, guessed }
}

// ---------- customers and suppliers ----------
/** A customer or supplier read from another program's list. `balance`: what they owe the shop (a debit balance;
 *  negative: the shop owes them). `signKnown`: the file said which side (debit/credit columns or a side column). */
export interface ImportedParty { name: string; phone?: string; address?: string; car?: string; notes?: string; balance: number }
type PartyCol = 'name' | 'phone' | 'address' | 'car' | 'notes' | 'debit' | 'credit' | 'balance' | 'side'
const PARTY_COLS: Record<PartyCol, string[]> = {
  name: ['الاسم', 'اسم', 'اسم الحساب', 'الحساب', 'اسم العميل', 'العميل', 'الزبون', 'اسم الزبون', 'العملاء', 'الزبائن', 'اسم المورد', 'المورد', 'الموردين', 'name', 'customer', 'supplier', 'account', 'account name'],
  phone: ['الهاتف', 'هاتف', 'رقم الهاتف', 'الموبايل', 'موبايل', 'الجوال', 'جوال', 'تلفون', 'التلفون', 'الهاتف المحمول', 'phone', 'mobile', 'tel'],
  address: ['العنوان', 'عنوان', 'المنطقة', 'المدينة', 'address', 'city'],
  car: ['السيارة', 'سيارة', 'car'],
  notes: ['ملاحظات', 'ملاحظة', 'notes', 'note'],
  debit: ['مدين', 'المدين', 'رصيد مدين', 'الرصيد المدين', 'عليه', 'debit', 'dr'],
  credit: ['دائن', 'الدائن', 'رصيد دائن', 'الرصيد الدائن', 'له', 'credit', 'cr'],
  balance: ['الرصيد', 'رصيد', 'الرصيد النهائي', 'الرصيد الحالي', 'الرصيد الختامي', 'صافي الرصيد', 'الدين', 'المبلغ', 'balance', 'amount'],
  side: ['طبيعة الرصيد', 'نوع الرصيد', 'مدين/دائن', 'دائن/مدين', 'الحالة', 'side'],
}
const PARTY_LABEL: Record<PartyCol, string> = { name: 'الاسم', phone: 'الهاتف', address: 'العنوان', car: 'السيارة', notes: 'ملاحظات', debit: 'مدين', credit: 'دائن', balance: 'الرصيد', side: 'مدين/دائن' }
const isPhoneCell = (v: unknown) => /^(\+?963|00963|0)?9\d{8}$|^0\d{8,10}$/.test(String(v ?? '').replace(/[\s\-()]/g, ''))

/** Reads a list of customers or suppliers with their balances (the "account balances" report of another program,
 *  exported to Excel). Column titles in any of the top rows, or none at all: then the text column is the name, a
 *  column of phone numbers the phone, two amount columns debit and credit, one amount column the balance. */
export async function readPartiesFile(file: File): Promise<{ rows: ImportedParty[]; guessed?: string; signKnown: boolean }> {
  const aoa = await readSheetRows(file)
  const keyOf = (cell: unknown): PartyCol | null => {
    const nh = normHeader(String(cell ?? ''))
    if (!nh) return null
    for (const k of Object.keys(PARTY_COLS) as PartyCol[]) if (PARTY_COLS[k].some(a => normHeader(a) === nh)) return k
    return null
  }
  let headerAt = -1
  for (let i = 0; i < Math.min(15, aoa.length); i++) if (aoa[i].map(keyOf).includes('name')) { headerAt = i; break }
  const map = new Map<PartyCol, number>()
  let data: unknown[][]
  let guessed: string | undefined
  if (headerAt >= 0) {
    aoa[headerAt].forEach((h, c) => { const k = keyOf(h); if (k && !map.has(k)) map.set(k, c) })
    data = aoa.slice(headerAt + 1)
  } else {
    data = aoa
    const width = Math.max(0, ...data.map(r => r.length))
    const stats = Array.from({ length: width }, (_, c) => {
      const cells = data.map(r => r[c]).filter(v => String(v ?? '').trim() !== '')
      const n = cells.length || 1
      return { c, filled: cells.length / Math.max(1, data.length), phone: cells.filter(isPhoneCell).length / n, number: cells.filter(isNumberCell).length / n, length: cells.reduce((t: number, v) => t + String(v).length, 0) / n }
    }).filter(x => x.filled >= 0.2)
    const phone = stats.find(x => x.phone >= 0.6)
    if (phone) map.set('phone', phone.c)
    const name = stats.filter(x => x !== phone && x.number < 0.4).sort((a, b) => b.length - a.length)[0]
    if (name) map.set('name', name.c)
    const amounts = stats.filter(x => x !== phone && x.number >= 0.6).sort((a, b) => a.c - b.c)
    // a running number (1, 2, 3…) in the first column is not an amount
    const seq = amounts.find(x => data.every((r, i) => toNumber(String(r[x.c] ?? '')) === i + 1))
    const money = amounts.filter(x => x !== seq)
    if (money.length >= 2) { map.set('debit', money[0].c); map.set('credit', money[1].c) } else if (money.length === 1) map.set('balance', money[0].c)
    guessed = 'الملف بلا عناوين أعمدة، فقرأناه هكذا: ' + [...map.entries()].sort((a, b) => a[1] - b[1]).map(([k, c]) => `العمود ${colName(c)} = ${PARTY_LABEL[k]}`).join('، ') + '. راجع الأرصدة قبل الاستيراد.'
  }
  const get = (r: unknown[], k: PartyCol) => { const c = map.get(k); return c === undefined ? '' : String(r[c] ?? '').trim() }
  const signKnown = (map.has('debit') && map.has('credit')) || map.has('side')
  const rows: ImportedParty[] = []
  for (const r of data) {
    const name = get(r, 'name')
    if (!name || name.length < 2 || isNumberCell(name)) continue
    if (keyOf(name) || /^(المجموع|الإجمالي|اجمالي|المجاميع|total)/i.test(name)) continue
    let balance = 0
    if (map.has('debit') || map.has('credit')) balance = toNumber(get(r, 'debit')) - toNumber(get(r, 'credit'))
    else {
      balance = toNumber(get(r, 'balance'))
      const side = normHeader(get(r, 'side'))
      if (/دائن|له|credit|cr/.test(side)) balance = -Math.abs(balance)
      else if (/مدين|عليه|debit|dr/.test(side)) balance = Math.abs(balance)
    }
    // a mobile number kept as a number in Excel has lost its leading 0
    const phone = get(r, 'phone').replace(/^9\d{8}$/, '0$&')
    rows.push({ name, phone: phone || undefined, address: get(r, 'address') || undefined, car: get(r, 'car') || undefined, notes: get(r, 'notes') || undefined, balance })
  }
  return { rows, guessed, signKnown }
}

export async function downloadProductsTemplate(): Promise<void> {
  await exportSheet('نموذج-استيراد-المنتجات', [
    { 'الكود': 'FLT-001', 'الاسم': 'فلتر زيت', 'التصنيف': 'فلاتر', 'الماركة': 'Bosch', 'السيارات': 'كيا ريو 2012-2017', 'الوحدة': 'قطعة', 'سعر الشراء': 25000, 'سعر البيع': 35000, 'الكمية': 10, 'حد التنبيه': 3, 'المكان': 'رف A1', 'باركود': '', 'OEM': '26300-35503', 'ملاحظات': '' },
    { 'الكود': 'BRK-014', 'الاسم': 'فحمات فرام أمامي', 'التصنيف': 'فرامل', 'الماركة': 'TRW', 'السيارات': 'هيونداي إلنترا 2011-2016', 'الوحدة': 'طقم', 'سعر الشراء': 120000, 'سعر البيع': 160000, 'الكمية': 4, 'حد التنبيه': 2, 'المكان': 'رف B3', 'باركود': '', 'OEM': '58101-3XA20', 'ملاحظات': '' },
  ], 'المنتجات')
}
