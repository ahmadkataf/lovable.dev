// Real screenshots of the site at phone size (3x) for the promo.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs'
const base = 'http://localhost:8791'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ar' })
const p = await ctx.newPage()
const go = async (u) => { await p.goto(base + u, { waitUntil: 'networkidle' }); await p.evaluate(() => { document.querySelector('.wa-float')?.remove(); document.querySelector('.announce')?.remove() }); await p.waitForTimeout(400) }
await go('/'); await p.screenshot({ path: 'shots/home-full.png', fullPage: true }); await p.screenshot({ path: 'shots/home.png' })
await go('/shop?category=drones'); await p.screenshot({ path: 'shots/shop.png' })
await go('/product/demo_p_0002'); await p.screenshot({ path: 'shots/product.png' })
await go('/dji'); await p.screenshot({ path: 'shots/dji.png' })
await go('/product/demo_p_0002'); await p.click('text=أضف إلى السلة'); await go('/cart'); await p.screenshot({ path: 'shots/cart.png' })
await p.click('text=متابعة الطلب'); await p.waitForTimeout(300)
await p.fill('input[autocomplete="name"]', 'محمد الخطيب'); await p.fill('input[autocomplete="tel"]', '0933123456'); await p.fill('input[placeholder*="المدينة"]', 'حلب، الفرقان، شارع النيل')
await p.evaluate(() => { document.querySelector('.wa-float')?.remove() }); await p.screenshot({ path: 'shots/checkout.png' })
await p.click('text=تسجيل الطلب والمتابعة'); await p.waitForURL(/\/order\//); await p.waitForTimeout(500)
await p.evaluate(() => { document.querySelector('.wa-float')?.remove(); document.querySelector('.announce')?.remove() })
await p.screenshot({ path: 'shots/order.png' })
await go('/repair'); await p.screenshot({ path: 'shots/repair.png' })
await go('/track?number=1003&phone=0'); await p.screenshot({ path: 'shots/track.png' })
// admin on a tablet-ish width so the dashboard reads well
const ctx2 = await b.newContext({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 2 })
const a = await ctx2.newPage()
await a.goto(base + '/admin', { waitUntil: 'networkidle' }); await a.fill('input[type=password]', 'secret123'); await a.click('button:has-text("دخول")'); await a.waitForSelector('text=لوحة التحكم'); await a.waitForTimeout(800)
await a.screenshot({ path: 'shots/admin.png' })
await a.goto(base + '/admin/reports', { waitUntil: 'networkidle' }); await a.waitForTimeout(800); await a.screenshot({ path: 'shots/admin-reports.png' })
await b.close()
console.log('done')
