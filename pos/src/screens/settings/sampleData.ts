// Sample products for the onboarding "try it" button: 4 categories, 12 products, in the current language.
import { db } from '../../db'
import type { Category, Product } from '../../db/types'
import { uid } from '../../lib/ids'
import { applyStock } from '../../lib/stock'
import { makeInternalEan13 } from '../../lib/barcode'
import { round } from '../../lib/money'
import type { Lang } from '../../i18n'

interface SampleCategory { ar: string; en: string; color: string; icon: string }
interface SampleProduct { ar: string; en: string; cat: number; price: number; cost: number; stock: number; emoji: string; unit?: string; fraction?: boolean }

export const SAMPLE_CATEGORIES: SampleCategory[] = [
  { ar: 'مشروبات', en: 'Drinks', color: '#3b6cf6', icon: '🥤' },
  { ar: 'ألبان', en: 'Dairy', color: '#0e9f6e', icon: '🧀' },
  { ar: 'معلّبات', en: 'Canned', color: '#e9a007', icon: '🥫' },
  { ar: 'منظّفات', en: 'Cleaning', color: '#8b5cf6', icon: '🧴' },
]
/** Prices are "units": they are scaled for zero-decimal currencies (×1000) so demo amounts look right. */
export const SAMPLE_PRODUCTS: SampleProduct[] = [
  { ar: 'مياه معدنية 1.5 لتر', en: 'Mineral water 1.5 L', cat: 0, price: 1.5, cost: 1.1, stock: 48, emoji: '💧' },
  { ar: 'كولا 330 مل', en: 'Cola 330 ml', cat: 0, price: 2.5, cost: 1.9, stock: 60, emoji: '🥤' },
  { ar: 'عصير برتقال 1 لتر', en: 'Orange juice 1 L', cat: 0, price: 6, cost: 4.5, stock: 14, emoji: '🧃' },
  { ar: 'حليب كامل الدسم 1 لتر', en: 'Whole milk 1 L', cat: 1, price: 7.5, cost: 6.2, stock: 22, emoji: '🥛' },
  { ar: 'لبن رائب 1 كغ', en: 'Yogurt 1 kg', cat: 1, price: 6.5, cost: 5.2, stock: 5, emoji: '🥣' },
  { ar: 'جبنة بيضاء', en: 'White cheese', cat: 1, price: 32, cost: 26, stock: 3, emoji: '🧀', unit: 'kg', fraction: true },
  { ar: 'تونة 160 غ', en: 'Tuna 160 g', cat: 2, price: 9, cost: 7.2, stock: 30, emoji: '🐟' },
  { ar: 'فول مدمس 400 غ', en: 'Fava beans 400 g', cat: 2, price: 4.5, cost: 3.4, stock: 12, emoji: '🥫' },
  { ar: 'معجون طماطم 800 غ', en: 'Tomato paste 800 g', cat: 2, price: 11, cost: 8.8, stock: 17, emoji: '🍅' },
  { ar: 'مسحوق غسيل 3 كغ', en: 'Laundry powder 3 kg', cat: 3, price: 38, cost: 31, stock: 6, emoji: '🧺' },
  { ar: 'سائل جلي 1 لتر', en: 'Dish soap 1 L', cat: 3, price: 9.5, cost: 7.3, stock: 25, emoji: '🧴' },
  { ar: 'مناديل ورقية', en: 'Tissues', cat: 3, price: 5, cost: 3.8, stock: 40, emoji: '🧻' },
]

/** Builds the rows (pure): categories first, then products pointing at them. */
export function buildSampleRows(lang: Lang, decimals: number, now = Date.now()): { categories: Category[]; products: Product[]; stocks: number[] } {
  const unit = decimals === 0 ? 1000 : 1
  const money = (n: number) => round(n * unit, decimals)
  const categories: Category[] = SAMPLE_CATEGORIES.map((c, i) => ({ id: uid(), name: c[lang], color: c.color, icon: c.icon, sort: i, createdAt: now }))
  const products: Product[] = SAMPLE_PRODUCTS.map((p, i) => ({
    id: uid(), name: p[lang], barcodes: [makeInternalEan13(100 + i)], price: money(p.price), cost: money(p.cost),
    trackStock: true, stock: 0, lowStock: 5, unit: p.unit ?? 'piece', allowFraction: !!p.fraction,
    categoryId: categories[p.cat].id, color: categories[p.cat].color, emoji: p.emoji, favorite: i < 4, active: true,
    createdAt: now, updatedAt: now,
  }))
  return { categories, products, stocks: SAMPLE_PRODUCTS.map(p => p.stock) }
}

/** Inserts the sample set in one transaction (stock through applyStock so the movement history is complete). Returns how many products. */
export async function insertSampleProducts(lang: Lang, decimals: number, userId?: string): Promise<number> {
  const now = Date.now()
  const { categories, products, stocks } = buildSampleRows(lang, decimals, now)
  await db.transaction('rw', db.categories, db.products, db.stockMoves, async () => {
    // reuse a category with the same name (the button pressed twice, or a restored store)
    const existing = await db.categories.toArray()
    const byName = new Map(existing.map(c => [c.name, c]))
    for (const c of categories) {
      const e = byName.get(c.name)
      if (e) { for (const p of products) if (p.categoryId === c.id) { p.categoryId = e.id; p.color = e.color } }
      else await db.categories.add(c)
    }
    await db.products.bulkAdd(products)
    await applyStock(products.map((p, i) => ({ productId: p.id, qty: stocks[i], type: 'initial' as const, userId })), now)
  })
  return products.length
}
