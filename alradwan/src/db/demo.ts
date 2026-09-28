import { putMany, useStore } from './store'
import { saveSale, savePurchase } from './actions'
import type { Base, Category, Customer, Product, Supplier } from './types'
import { newId } from '../lib/id'
import { addDays } from '../lib/format'

// Sample data to try the app with: a few parts, customers, suppliers and invoices over the last days.
export async function loadDemoData(): Promise<void> {
  const now = Date.now()
  const cats: Category[] = ['فلاتر', 'فرامل', 'زيوت', 'كهرباء', 'تعليق', 'محرك', 'خدمات'].map(name => ({ id: newId(), updatedAt: 0, name }))
  const cat = (n: string) => cats.find(c => c.name === n)!.id
  const P = (code: string, name: string, category: string, brand: string, cars: string, cost: number, price: number, stock: number, minStock: number, location: string, kind: 'product' | 'service' = 'product', unit = 'قطعة'): Product => ({
    id: newId(), updatedAt: 0, code, name, categoryId: cat(category), brand, cars, unit, cost, price, minStock, openingStock: stock, location, kind, createdAt: now - 86400000 * 30,
  })
  const products: Product[] = [
    P('FLT-001', 'فلتر زيت', 'فلاتر', 'Bosch', 'كيا ريو 2012–2017', 25000, 35000, 14, 4, 'رف A1'),
    P('FLT-002', 'فلتر هواء', 'فلاتر', 'Mann', 'هيونداي إلنترا 2011–2016', 30000, 45000, 7, 3, 'رف A1'),
    P('FLT-003', 'فلتر مكيف', 'فلاتر', 'Mann', 'كيا سيراتو 2014–2018', 28000, 42000, 2, 3, 'رف A2'),
    P('BRK-014', 'فحمات فرام أمامي', 'فرامل', 'TRW', 'هيونداي إلنترا 2011–2016', 120000, 165000, 5, 2, 'رف B3', 'product', 'طقم'),
    P('BRK-015', 'فحمات فرام خلفي', 'فرامل', 'TRW', 'هيونداي إلنترا 2011–2016', 95000, 130000, 1, 2, 'رف B3', 'product', 'طقم'),
    P('BRK-020', 'ديسك فرام أمامي', 'فرامل', 'Brembo', 'كيا سبورتاج 2016–2021', 260000, 340000, 4, 2, 'رف B4'),
    P('OIL-5W30', 'زيت محرك 5W-30 (4 لتر)', 'زيوت', 'Shell', 'جميع السيارات', 180000, 230000, 12, 4, 'رف C1', 'product', 'علبة'),
    P('OIL-10W40', 'زيت محرك 10W-40 (4 لتر)', 'زيوت', 'Castrol', 'جميع السيارات', 150000, 195000, 9, 4, 'رف C1', 'product', 'علبة'),
    P('ELC-101', 'بطارية 60 أمبير', 'كهرباء', 'Varta', 'جميع السيارات', 650000, 800000, 3, 2, 'أرضية D'),
    P('ELC-110', 'بواجي (طقم 4)', 'كهرباء', 'NGK', 'تويوتا كورولا 2008–2013', 60000, 90000, 6, 3, 'رف D2', 'product', 'طقم'),
    P('SUS-201', 'مساعد أمامي', 'تعليق', 'KYB', 'كيا ريو 2012–2017', 210000, 280000, 2, 2, 'رف E1'),
    P('SUS-205', 'كوشوكة مقص', 'تعليق', 'CTR', 'هيونداي أكسنت 2012–2017', 35000, 55000, 10, 4, 'رف E2'),
    P('ENG-301', 'سير تايمنغ', 'محرك', 'Gates', 'هيونداي أكسنت 2012–2017', 140000, 190000, 3, 2, 'رف F1'),
    P('ENG-305', 'طرمبة ماء', 'محرك', 'Aisin', 'تويوتا كورولا 2008–2013', 190000, 250000, 0, 1, 'رف F2'),
    P('SRV-001', 'أجرة تبديل زيت', 'خدمات', '', '', 0, 25000, 0, 0, '', 'service'),
    P('SRV-002', 'أجرة تبديل فحمات', 'خدمات', '', '', 0, 40000, 0, 0, '', 'service'),
  ]
  const customers: Customer[] = [
    { id: newId(), updatedAt: 0, name: 'أبو محمد', phone: '0944 123 456', car: 'كيا ريو 2015', openingBalance: 0, createdAt: now },
    { id: newId(), updatedAt: 0, name: 'ورشة الأمانة', phone: '0933 555 111', car: '', openingBalance: 150000, createdAt: now, notes: 'يشتري بالجملة' },
    { id: newId(), updatedAt: 0, name: 'خالد الحسن', phone: '0955 777 888', car: 'هيونداي إلنترا 2014', openingBalance: 0, createdAt: now },
  ]
  const suppliers: Supplier[] = [
    { id: newId(), updatedAt: 0, name: 'شركة النور لقطع الغيار', phone: '011 223 3444', openingBalance: 0, createdAt: now },
    { id: newId(), updatedAt: 0, name: 'مستودع الشرق', phone: '0999 000 111', openingBalance: 500000, createdAt: now },
  ]
  const entries: { collection: 'categories' | 'products' | 'customers' | 'suppliers'; record: Base }[] = [
    ...cats.map(record => ({ collection: 'categories' as const, record })),
    ...products.map(record => ({ collection: 'products' as const, record })),
    ...customers.map(record => ({ collection: 'customers' as const, record })),
    ...suppliers.map(record => ({ collection: 'suppliers' as const, record })),
  ]
  await putMany(entries)

  const p = (code: string) => products.find(x => x.code === code)!
  const item = (code: string, qty: number, discount = 0) => { const x = p(code); return { productId: x.id, name: x.name, code: x.code, qty, price: x.price, cost: x.cost, discount, unit: x.unit, kind: x.kind } }
  const sales = [
    { d: 6, c: customers[0], items: [item('OIL-5W30', 1), item('FLT-001', 1), item('SRV-001', 1)], paid: 'all' },
    { d: 5, c: customers[1], items: [item('BRK-014', 2), item('BRK-020', 2)], paid: 500000 },
    { d: 4, c: null, items: [item('ELC-110', 1)], paid: 'all' },
    { d: 3, c: customers[2], items: [item('FLT-002', 1), item('FLT-003', 1), item('OIL-10W40', 1)], paid: 'all' },
    { d: 2, c: customers[1], items: [item('SUS-205', 4), item('ENG-301', 1)], paid: 0 },
    { d: 1, c: null, items: [item('ELC-101', 1)], paid: 'all' },
    { d: 0, c: customers[0], items: [item('BRK-015', 1), item('SRV-002', 1)], paid: 'all' },
  ]
  for (const s of sales) {
    const total = s.items.reduce((t, i) => t + i.qty * i.price, 0)
    await saveSale({ type: 'sale', date: addDays(now, -s.d) - 3600000 * (s.d + 1), customerId: s.c?.id, customerName: s.c?.name ?? 'زبون نقدي', items: s.items, discount: 0, paid: s.paid === 'all' ? total : (s.paid as number), notes: '' })
  }
  await savePurchase({ type: 'purchase', date: addDays(now, -7), supplierId: suppliers[0].id, supplierName: suppliers[0].name, reference: 'A-1092', items: [{ productId: p('OIL-5W30').id, name: p('OIL-5W30').name, code: 'OIL-5W30', qty: 6, cost: 180000 }, { productId: p('FLT-001').id, name: p('FLT-001').name, code: 'FLT-001', qty: 10, cost: 25000 }], paid: 1330000, notes: '' })
  await putMany([
    { collection: 'expenses', record: { id: newId(), updatedAt: 0, date: addDays(now, -3), category: 'كهرباء', amount: 75000, note: 'فاتورة الشهر' } as Base },
    { collection: 'expenses', record: { id: newId(), updatedAt: 0, date: addDays(now, -1), category: 'ضيافة', amount: 12000 } as Base },
  ])
  useStore.setState(s => ({ version: s.version + 1 }))
}
