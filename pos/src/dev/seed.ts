// Sample data for screenshots and demos. Loaded only with ?qa=1 in the URL (see main.tsx); never part of normal use.
import { db, saveSettings, loadSettings, nextNumber } from '../db'
import type { Product, Category, Customer, Sale, SaleItem, PaymentMethod } from '../db/types'
import { uid } from '../lib/ids'
import { applyStock } from '../lib/stock'
import { applyLedger } from '../lib/ledger'
import { round } from '../lib/money'

const CATS: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: 'مشروبات', color: '#3b6cf6', icon: '🥤', sort: 0 },
  { name: 'ألبان وأجبان', color: '#0e9f6e', icon: '🧀', sort: 1 },
  { name: 'معلّبات', color: '#e9a007', icon: '🥫', sort: 2 },
  { name: 'منظّفات', color: '#8b5cf6', icon: '🧴', sort: 3 },
  { name: 'خضار وفواكه', color: '#16a34a', icon: '🍎', sort: 4 },
]
const PRODUCTS: [string, number, number, number, string, number, string?, boolean?][] = [
  // name, price, cost, stock, category, barcode seed, emoji, fraction
  ['مياه معدنية 1.5 لتر', 1500, 1100, 48, 'مشروبات', 1, '💧'],
  ['بيبسي 330 مل', 2500, 1900, 60, 'مشروبات', 2, '🥤'],
  ['عصير برتقال 1 لتر', 6000, 4500, 14, 'مشروبات', 3, '🧃'],
  ['شاي أسود 200 غ', 12000, 9500, 9, 'مشروبات', 4, '🍵'],
  ['حليب كامل الدسم 1 لتر', 7500, 6200, 22, 'ألبان وأجبان', 5, '🥛'],
  ['لبن رائب 1 كغ', 6500, 5200, 5, 'ألبان وأجبان', 6, '🥣'],
  ['جبنة بيضاء', 32000, 26000, 3, 'ألبان وأجبان', 7, '🧀', true],
  ['بيض (طبق 30)', 45000, 39000, 11, 'ألبان وأجبان', 8, '🥚'],
  ['تونة 160 غ', 9000, 7200, 30, 'معلّبات', 9, '🐟'],
  ['فول مدمس 400 غ', 4500, 3400, 0, 'معلّبات', 10, '🥫'],
  ['معجون طماطم 800 غ', 11000, 8800, 17, 'معلّبات', 11, '🍅'],
  ['مسحوق غسيل 3 كغ', 38000, 31000, 6, 'منظّفات', 12, '🧺'],
  ['سائل جلي 1 لتر', 9500, 7300, 25, 'منظّفات', 13, '🧴'],
  ['مناديل ورقية', 5000, 3800, 40, 'منظّفات', 14, '🧻'],
  ['بندورة', 4000, 3000, 25, 'خضار وفواكه', 15, '🍅', true],
  ['موز', 9000, 7000, 12, 'خضار وفواكه', 16, '🍌', true],
  ['تفاح أحمر', 8000, 6200, 18, 'خضار وفواكه', 17, '🍎', true],
  ['بطاطا', 3000, 2200, 60, 'خضار وفواكه', 18, '🥔', true],
]
const CUSTOMERS = [['أبو محمد', '0944123456'], ['أم خالد', '0933555777'], ['مطعم الشام', '0112223344'], ['سامر حداد', '0988111222'], ['لينا عيسى', '']]

function ean(seed: number): string {
  const body = '629' + String(100000 + seed * 7919).padStart(9, '0').slice(0, 9)
  let s = 0
  for (let i = 0; i < 12; i++) s += Number(body[i]) * (i % 2 === 0 ? 1 : 3)
  return body + ((10 - (s % 10)) % 10)
}
let rnd = 7
const rand = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff }
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]

export async function seed(): Promise<void> {
  if ((await db.products.count()) > 0) return
  const now = Date.now()
  const s = await loadSettings()
  s.store = { name: 'سوبرماركت الأمل', phone: '0944 123 456', address: 'دمشق — المزة، شارع الجلاء' }
  s.onboarded = true
  s.receipt.footer = 'شكراً لزيارتكم — نتمنى لكم يوماً سعيداً'
  await saveSettings(s)
  const admin = (await db.users.toArray())[0]
  const cashier = { id: uid(), name: 'خالد', role: 'cashier' as const, active: true, createdAt: now - 30 * 864e5 }
  await db.users.add(cashier)

  const cats = CATS.map(c => ({ ...c, id: uid(), createdAt: now }))
  await db.categories.bulkAdd(cats)
  const byName = Object.fromEntries(cats.map(c => [c.name, c]))
  const stocks: number[] = []
  const products: Product[] = PRODUCTS.map(([name, price, cost, stock, cat, seedN, emoji, frac], i) => {
    stocks.push(stock)
    return {
      id: uid(), name, barcodes: [ean(seedN)], price, cost, trackStock: true, stock: 0, lowStock: 5, unit: frac ? 'kg' : 'piece',
      allowFraction: !!frac, categoryId: byName[cat].id, color: byName[cat].color, emoji, favorite: i < 4, active: true,
      createdAt: now - 40 * 864e5, updatedAt: now - 40 * 864e5,
    }
  })
  await db.products.bulkAdd(products)
  await applyStock(products.map((p, i) => ({ productId: p.id, qty: stocks[i], type: 'initial' as const, note: 'رصيد افتتاحي', userId: admin.id })), now - 40 * 864e5)

  const customers: Customer[] = CUSTOMERS.map(([name, phone]) => ({ id: uid(), name, phone: phone || undefined, balance: 0, createdAt: now - 20 * 864e5, updatedAt: now - 20 * 864e5 }))
  await db.customers.bulkAdd(customers)

  // a closed shift last week and an open one today
  const shiftOld = { id: uid(), userId: cashier.id, userName: cashier.name, openedAt: now - 7 * 864e5, closedAt: now - 7 * 864e5 + 9 * 36e5, openingCash: 50000, closingCash: 412000, expectedCash: 415000, cashIn: 0, cashOut: 20000, status: 'closed' as const }
  const shiftOpen = { id: uid(), userId: admin.id, userName: admin.name, openedAt: new Date().setHours(8, 30, 0, 0), openingCash: 100000, cashIn: 0, cashOut: 0, status: 'open' as const }
  await db.shifts.bulkAdd([shiftOld, shiftOpen])

  // 14 days of sales
  const live = await db.products.toArray()
  for (let day = 13; day >= 0; day--) {
    const count = 3 + Math.floor(rand() * 6)
    for (let k = 0; k < count; k++) {
      const at = new Date(now - day * 864e5); at.setHours(9 + Math.floor(rand() * 11), Math.floor(rand() * 60), 0, 0)
      const n = 1 + Math.floor(rand() * 4)
      const chosen = new Set<Product>()
      while (chosen.size < n) chosen.add(pick(live))
      const items: SaleItem[] = [...chosen].map(p => {
        const qty = p.allowFraction ? round(0.5 + rand() * 2, 2) : 1 + Math.floor(rand() * 3)
        return { productId: p.id, name: p.name, barcode: p.barcodes[0], unit: p.unit, qty, price: p.price, originalPrice: p.price, cost: p.cost, discount: 0, taxRate: 0, tax: 0, total: round(p.price * qty, 0) }
      })
      const subtotal = items.reduce((a, i) => a + i.total, 0)
      const cost = round(items.reduce((a, i) => a + i.cost * i.qty, 0), 0)
      const customer = rand() < 0.3 ? pick(customers) : undefined
      const method: PaymentMethod = customer && rand() < 0.5 ? 'credit' : rand() < 0.8 ? 'cash' : 'card'
      const credit = method === 'credit' ? subtotal : 0
      const paid = method === 'credit' ? 0 : method === 'cash' ? Math.ceil(subtotal / 5000) * 5000 : subtotal
      const sale: Sale = {
        id: uid(), number: await nextNumber('sale'), createdAt: at.getTime(), items, subtotal, discount: 0, tax: 0, total: subtotal, cost,
        payments: method === 'credit' ? [] : [{ method, amount: subtotal }], paid: method === 'credit' ? 0 : subtotal, change: method === 'cash' ? paid - subtotal : 0, credit,
        customerId: customer?.id, customerName: customer?.name, userId: rand() < 0.5 ? admin.id : cashier.id, userName: rand() < 0.5 ? admin.name : cashier.name,
        shiftId: day === 0 ? shiftOpen.id : day === 7 ? shiftOld.id : undefined, status: 'completed', refunded: 0,
      }
      await db.sales.add(sale)
      await applyStock(items.map(i => ({ productId: i.productId!, qty: -i.qty, type: 'sale' as const, refId: sale.id })), sale.createdAt)
      if (credit > 0 && customer) await applyLedger({ customerId: customer.id, type: 'sale', amount: credit, refId: sale.id, userId: sale.userId }, 0, sale.createdAt)
    }
  }
  // a payment from a customer
  const debtor = (await db.customers.toArray()).find(c => c.balance > 0)
  if (debtor) await applyLedger({ customerId: debtor.id, type: 'payment', amount: -Math.min(debtor.balance, 20000), method: 'cash', userId: admin.id, shiftId: shiftOpen.id }, 0, now - 36e5)
  await db.expenses.bulkAdd([
    { id: uid(), amount: 150000, category: 'إيجار', createdAt: now - 10 * 864e5, userId: admin.id },
    { id: uid(), amount: 35000, category: 'كهرباء وماء', createdAt: now - 4 * 864e5, userId: admin.id },
    { id: uid(), amount: 8000, category: 'نقل', note: 'توصيل بضاعة', createdAt: now - 2 * 36e5, userId: admin.id, shiftId: shiftOpen.id },
  ])
}

export function install(): void {
  ;(window as any).__kasherSeed = async () => { await seed(); location.reload() }
  void db.products.count().then(n => { if (n === 0) void seed().then(() => location.reload()) })
}
