// QA for inventory + expenses (flows, DB assertions, screenshots in RTL/EN/phone). From dental/: npx vite build --outDir /tmp/dist-invexp && QA_DIST=/tmp/dist-invexp QA_PORT=4306 QA_SHOTS=qa-shots/invexp node scripts/qa/invexp.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const errors = []
const fail = (m) => { console.error('ASSERT FAIL:', m); errors.push(m) }
const ok = (c, m) => { if (!c) fail(m); else console.log('ok -', m) }
const watch = (page, tag) => {
  page.on('pageerror', e => errors.push(`[${tag}] pageerror ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console ${m.text()}`) })
}
const noOverflow = async (page, label) => {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }))
  ok(r.sw <= r.w, `${label}: no horizontal overflow (${r.sw} <= ${r.w})`)
}
const noTableScroll = async (page, label) => {
  const r = await page.evaluate(() => [...document.querySelectorAll('.table-wrap')].map(w => [w.scrollWidth, w.clientWidth]))
  ok(r.every(([s, c]) => s <= c + 1), `${label}: tables fit without inner scrolling ${JSON.stringify(r)}`)
}
const go = async (page, hash) => { await page.goto(`${BASE}/index.html#${hash}`); await page.waitForLoadState('networkidle'); await page.waitForTimeout(500) }
const dbq = (page, fn, arg) => page.evaluate(fn, arg)

async function seedInventory(page) {
  await page.evaluate(async () => {
    const db = window.__dentora.db
    const pad = n => String(n).padStart(2, '0')
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
    const now = new Date().toISOString()
    const items = [
      { id: 'it-gloves', name: 'قفازات لاتكس مقاس M', sku: 'GL-M-100', category: 'consumables', unit: 'box', quantity: 3, minQuantity: 5, costPrice: 6.5, supplier: 'شركة الرازي للتجهيزات الطبية', expiryDate: day(420), location: 'خزانة 1 — الرف العلوي' },
      { id: 'it-masks', name: 'كمامات طبية ثلاثية الطبقات', sku: 'MK-50', category: 'consumables', unit: 'box', quantity: 24, minQuantity: 10, costPrice: 3, supplier: 'شركة الرازي للتجهيزات الطبية' },
      { id: 'it-comp', name: 'حشوة كومبوزيت A2', sku: '3M-Z350-A2', category: 'materials', unit: 'أنبوب', quantity: 8, minQuantity: 4, costPrice: 18, supplier: '3M الشرق الأوسط', expiryDate: day(40) },
      { id: 'it-art', name: 'مخدر أرتيكائين 4% مع أدرينالين', sku: 'ART-4', category: 'medications', unit: 'box', quantity: 2, minQuantity: 3, costPrice: 42, supplier: 'فارما ميد', expiryDate: day(20) },
      { id: 'it-needle', name: 'إبر تخدير 27G قصيرة', sku: 'ND-27S', category: 'consumables', unit: 'box', quantity: 0, minQuantity: 2, costPrice: 7, supplier: 'فارما ميد' },
      { id: 'it-kfile', name: 'مبارد عصب K-File رقم 15', sku: 'KF-15', category: 'instruments', unit: 'pack', quantity: 12, minQuantity: 4, costPrice: 9, supplier: 'Dentsply' },
      { id: 'it-naocl', name: 'هيبوكلوريت الصوديوم 5%', category: 'materials', unit: 'ml', quantity: 1500, minQuantity: 500, costPrice: 0.01, supplier: 'فارما ميد' },
      { id: 'it-paper', name: 'ورق طباعة A4', category: 'office', unit: 'pack', quantity: 6, minQuantity: 2, costPrice: 4.5 },
      { id: 'it-alg', name: 'ألجينات للطبعات', sku: 'ALG-500', category: 'materials', unit: 'pack', quantity: 3, minQuantity: 2, costPrice: 12, supplier: 'Zhermack', expiryDate: day(-10) },
      { id: 'it-mirror', name: 'مرآة فموية', category: 'instruments', unit: 'piece', quantity: 30, minQuantity: 10, costPrice: 2 },
      { id: 'it-steril', name: 'جهاز تعقيم بالبخار (أوتوكلاف)', category: 'equipment', unit: 'piece', quantity: 1, minQuantity: 0, costPrice: 850, location: 'غرفة التعقيم' },
      { id: 'it-tray', name: 'أكياس تعقيم ذاتية الإغلاق', category: 'تعقيم', unit: 'pack', quantity: 9, minQuantity: 3, costPrice: 5.5 },
      { id: 'it-old', name: 'كحول طبي 70% (قديم)', category: 'consumables', unit: 'ml', quantity: 0, minQuantity: 0, costPrice: 0.004, active: false },
    ]
    for (const it of items) await db.inventory.put({ active: true, createdAt: now, updatedAt: now, ...it })
    const mv = (itemId, delta, reason, d, note, by) => ({ id: `mv-${itemId}-${d}-${reason}-${Math.random().toString(36).slice(2, 7)}`, itemId, delta, reason, date: day(d), note, by, createdAt: new Date(Date.now() + d * 86400000).toISOString() })
    await db.stock.bulkPut([
      mv('it-gloves', 10, 'initial', -30, undefined, 'u-admin'), mv('it-gloves', -4, 'use', -12, 'العيادة 1', 'u-doc2'), mv('it-gloves', -3, 'use', -3, undefined, 'u-rec'),
      mv('it-art', 5, 'initial', -25, undefined, 'u-admin'), mv('it-art', -3, 'use', -2, 'حالات قلع', 'u-doc2'),
      mv('it-needle', 4, 'initial', -40, undefined, 'u-admin'), mv('it-needle', -4, 'use', -1, undefined, 'u-doc2'),
      mv('it-comp', 6, 'initial', -50, undefined, 'u-admin'), mv('it-comp', 4, 'purchase', -20, 'شركة 3M · INV-5521', 'u-admin'), mv('it-comp', -2, 'use', -6, undefined, 'u-doc2'),
      mv('it-alg', 3, 'initial', -90, undefined, 'u-admin'),
      mv('it-kfile', 12, 'initial', -15, undefined, 'u-admin'),
    ])
  })
}

async function seedExpenses(page) {
  await page.evaluate(async () => {
    const db = window.__dentora.db
    const pad = n => String(n).padStart(2, '0')
    const d = new Date(); const y = d.getFullYear(), m = d.getMonth()
    const at = (mo, day) => { const x = new Date(y, m + mo, day); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
    const now = new Date().toISOString()
    const e = (id, mo, day, category, amount, description, vendor, method, by = 'u-admin') => ({ id, date: at(mo, day), category, amount, description, vendor, method, by, createdAt: now })
    await db.expenses.bulkPut([
      e('ex1', 0, 1, 'rent', 1200, 'إيجار العيادة لشهر تشرين الأول', 'المالك — أبو سامر', 'transfer'),
      e('ex2', 0, 5, 'salaries', 2500, 'رواتب الفريق', undefined, 'cash'),
      e('ex3', 0, 3, 'materials', 340, 'قفازات وكمامات ومواد تعقيم', 'شركة الرازي للتجهيزات الطبية', 'cash', 'u-rec'),
      e('ex4', 0, 7, 'lab', 450, 'تيجان زيركون — 3 حالات', 'مخبر الإتقان', 'transfer', 'u-doc2'),
      e('ex5', 0, 8, 'utilities', 180, 'فاتورة الكهرباء والإنترنت', 'شركة الكهرباء', 'card'),
      e('ex6', 0, 9, 'marketing', 120, 'إعلان ممول على إنستغرام', 'Meta', 'card'),
      e('ex7', 0, 2, 'maintenance', 95, 'صيانة الكرسي رقم 2', 'م. خالد للصيانة', 'cash'),
      e('ex8', 0, 9, 'materials', 65, 'أكياس تعقيم', 'شركة الرازي للتجهيزات الطبية', 'cash', 'u-rec'),
      e('px1', -1, 1, 'rent', 1200, 'إيجار العيادة لشهر أيلول', 'المالك — أبو سامر', 'transfer'),
      e('px2', -1, 5, 'salaries', 2400, 'رواتب الفريق', undefined, 'cash'),
      e('px3', -1, 12, 'materials', 520, 'مواد حشو وتخدير', 'فارما ميد', 'cash'),
      e('px4', -1, 18, 'lab', 300, 'جسر خزفي', 'مخبر الإتقان', 'transfer'),
      e('px5', -1, 20, 'utilities', 150, 'فاتورة الكهرباء', 'شركة الكهرباء', 'card'),
      e('px6', -1, 25, 'taxes', 80, 'رسوم ترخيص سنوية', 'نقابة أطباء الأسنان', 'cash'),
    ])
  })
}

const server = await startServer()
try {
  // ======================= desktop RTL =======================
  {
    const { browser, page } = await openBrowser({})
    watch(page, 'ar')
    await seedAndLogin(page, { lang: 'ar' })
    await page.evaluate(async () => { const db = window.__dentora.db; await db.inventory.clear(); await db.stock.clear(); await db.expenses.clear() })

    // ---- inventory: empty → create with validation ----
    await go(page, '/inventory')
    await shot(page, 'inv-01-empty-ar')
    await page.getByRole('button', { name: 'إضافة أول صنف' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'إضافة الصنف' }).click()
    await page.waitForTimeout(250)
    ok(await page.getByText('هذا الحقل مطلوب').count() > 0, 'item form shows required error')
    await shot(page, 'inv-02-form-validation-ar')
    await page.getByLabel('اسم الصنف').fill('لفافات قطنية')
    await page.locator('.inv-cat-picks .chip', { hasText: 'مستهلكات' }).click()
    await page.getByLabel('الكمية الابتدائية').fill('10')
    await page.getByLabel('حد التنبيه').fill('3')
    await page.getByLabel('سعر التكلفة').fill('2.5')
    await shot(page, 'inv-03-form-filled-ar')
    await page.getByRole('button', { name: 'إضافة الصنف' }).click()
    await page.waitForTimeout(500)
    let created = await dbq(page, async () => { const db = window.__dentora.db; const it = (await db.inventory.toArray())[0]; const mv = await db.stock.toArray(); return { it, mv } })
    ok(created.it?.name === 'لفافات قطنية' && created.it.quantity === 10 && created.it.category === 'consumables' && created.it.minQuantity === 3 && created.it.costPrice === 2.5, 'item created with fields')
    ok(created.mv.length === 1 && created.mv[0].reason === 'initial' && created.mv[0].delta === 10 && created.mv[0].by === 'u-admin', 'initial movement recorded')
    const cottonId = created.it.id

    // delete an item that has only the opening stock
    await page.locator('tr', { hasText: 'لفافات قطنية' }).getByRole('button', { name: 'إجراءات' }).click()
    await page.waitForTimeout(200)
    await shot(page, 'inv-04-row-menu-ar')
    await page.getByRole('menuitem', { name: 'حذف الصنف' }).click()
    await page.waitForTimeout(300)
    await page.locator('.modal').getByRole('button', { name: 'حذف' }).click()
    await page.waitForTimeout(400)
    ok(await dbq(page, async id => (await window.__dentora.db.inventory.get(id)) === undefined && (await window.__dentora.db.stock.where('itemId').equals(id).count()) === 0, cottonId), 'item with only opening stock deleted with its movement')

    // ---- seed realistic data ----
    await seedInventory(page)
    await go(page, '/inventory')
    await shot(page, 'inv-05-list-ar')
    await shot(page, 'inv-05b-list-full-ar', { full: true })
    await noOverflow(page, 'inventory desktop ar')
    await noTableScroll(page, 'inventory desktop ar')
    const stats = await page.locator('.inv-stats .stat-value').allTextContents()
    ok(stats[0].includes('12') && stats[1].includes('3') && stats[2].includes('3'), `stat cards (items 12, low 3, expiring 3): ${stats.join(' | ')}`)

    // quick + movement
    await page.locator('tr', { hasText: 'كمامات طبية' }).locator('.inv-step.add').click()
    await page.waitForTimeout(300)
    await shot(page, 'inv-06-popover-in-ar')
    await page.locator('.inv-popover input[type=number]').fill('6')
    await page.locator('.inv-popover input[placeholder="اختياري"]').fill('دفعة إضافية')
    await page.locator('.inv-popover').getByRole('button', { name: 'تسجيل الحركة' }).click()
    await page.waitForTimeout(500)
    let masks = await dbq(page, async () => { const db = window.__dentora.db; return { q: (await db.inventory.get('it-masks')).quantity, m: await db.stock.where('itemId').equals('it-masks').toArray() } })
    ok(masks.q === 30 && masks.m.length === 1 && masks.m[0].delta === 6 && masks.m[0].reason === 'purchase' && masks.m[0].note === 'دفعة إضافية', 'quick + movement updates quantity and writes movement')

    // quick − movement with not-enough validation
    await page.locator('tr', { hasText: 'قفازات لاتكس' }).locator('.inv-step:not(.add)').click()
    await page.waitForTimeout(300)
    await page.locator('.inv-popover input[type=number]').fill('10')
    await page.waitForTimeout(150)
    ok(await page.locator('.inv-popover').getByText('المتاح 3 فقط').count() === 1, 'not-enough error shown')
    await shot(page, 'inv-07-popover-out-error-ar')
    await page.locator('.inv-popover input[type=number]').fill('2')
    await page.locator('.inv-popover').getByRole('button', { name: 'تسجيل الحركة' }).click()
    await page.waitForTimeout(500)
    ok(await dbq(page, async () => (await window.__dentora.db.inventory.get('it-gloves')).quantity) === 1, 'quick − movement leaves 1')

    // history drawer
    await page.locator('tr', { hasText: 'قفازات لاتكس' }).locator('.inv-item-name').click()
    await page.waitForTimeout(500)
    await shot(page, 'inv-08-drawer-ar')
    ok(await page.locator('.inv-tl-row').count() === 4, 'drawer lists 4 movements for gloves')
    await page.locator('.drawer').getByRole('button', { name: 'إضافة كمية' }).click()
    await page.waitForTimeout(200)
    await shot(page, 'inv-09-drawer-inline-move-ar')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    ok(await page.locator('.drawer').count() === 0, 'drawer closed with Escape')

    // edit item via menu
    await page.locator('tr', { hasText: 'ورق طباعة' }).getByRole('button', { name: 'إجراءات' }).click()
    await page.getByRole('menuitem', { name: 'تعديل' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'inv-10-edit-ar')
    await page.getByLabel('اسم الصنف').fill('ورق طباعة A4 — 80 غ')
    await page.getByLabel('حد التنبيه').fill('3')
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click()
    await page.waitForTimeout(400)
    const paper = await dbq(page, async () => window.__dentora.db.inventory.get('it-paper'))
    ok(paper.name === 'ورق طباعة A4 — 80 غ' && paper.minQuantity === 3 && paper.quantity === 6 && paper.category === 'office', 'item edited, quantity kept')

    // an item with movements offers no delete, only deactivate (its history stays)
    await page.locator('tr', { hasText: 'حشوة كومبوزيت' }).getByRole('button', { name: 'إجراءات' }).click()
    await page.waitForTimeout(200)
    ok(await page.getByRole('menuitem', { name: 'حذف الصنف' }).count() === 0, 'no delete for an item with movements')
    await shot(page, 'inv-11-menu-no-delete-ar')
    await page.getByRole('menuitem', { name: 'إيقاف الصنف' }).click()
    await page.waitForTimeout(400)
    ok((await dbq(page, async () => (await window.__dentora.db.inventory.get('it-comp')).active)) === false, 'item deactivated')

    // filters
    await page.getByText('النقص فقط').click()
    await page.waitForTimeout(300)
    ok(await page.locator('tbody tr').count() === 3, 'low-only filter shows 3 rows')
    await shot(page, 'inv-12-low-only-ar')
    await page.getByText('النقص فقط').click()
    await page.getByText('إظهار الموقوفة').click()
    await page.waitForTimeout(300)
    ok(await page.locator('tbody tr').count() === 13, 'show inactive lists 13')
    await page.getByText('إظهار الموقوفة').click()
    await page.locator('.inv-chips .chip', { hasText: 'مواد' }).first().click()
    await page.waitForTimeout(300)
    ok(await page.locator('tbody tr').count() === 2, 'category chip filters active materials (2)')
    await page.locator('.inv-chips .chip', { hasText: 'كل الفئات' }).click()
    await page.getByPlaceholder('ابحث بالاسم أو الرمز أو المورد…').fill('فارما')
    await page.waitForTimeout(400)
    ok(await page.locator('tbody tr').count() === 3, 'search by supplier')
    await page.getByPlaceholder('ابحث بالاسم أو الرمز أو المورد…').fill('zzzz')
    await page.waitForTimeout(400)
    await shot(page, 'inv-13-no-results-ar')
    await page.getByRole('button', { name: 'مسح التصفية' }).first().click()
    await page.waitForTimeout(300)

    // purchase flow (prefilled with low items through the banner)
    await page.locator('.inv-reorder').getByRole('button').click()
    await page.waitForTimeout(500)
    await shot(page, 'inv-14-purchase-ar')
    const lines = await page.locator('.inv-pl:not(.inv-pl-head)').count()
    ok(lines === 3, `purchase prefilled with 3 low items (${lines})`)
    await page.getByLabel('المورد').fill('فارما ميد')
    await page.getByLabel('رقم الفاتورة').fill('PM-2210')
    await page.getByRole('button', { name: 'إضافة صنف' }).click()
    await page.getByRole('button', { name: 'حفظ الشراء' }).click()
    await page.waitForTimeout(300)
    ok(await page.locator('.inv-pl-error').count() === 1, 'empty purchase row flagged')
    await shot(page, 'inv-15-purchase-error-ar')
    await page.locator('.inv-pl').last().getByRole('button', { name: 'حذف' }).click()
    await page.getByRole('button', { name: 'حفظ الشراء' }).click()
    await page.waitForTimeout(600)
    const pur = await dbq(page, async () => { const db = window.__dentora.db; return { art: await db.inventory.get('it-art'), needle: await db.inventory.get('it-needle'), mv: await db.stock.where('reason').equals('purchase').toArray(), ex: await db.expenses.toArray() } })
    ok(pur.art.quantity === 6 && pur.needle.quantity === 4 && pur.art.supplier === 'فارما ميد', `purchase raised quantities (art ${pur.art.quantity}, needle ${pur.needle.quantity})`)
    ok(pur.mv.filter(m => m.note === 'فارما ميد · PM-2210').length === 3, 'purchase movements with supplier/reference note')
    ok(pur.ex.length === 1 && pur.ex[0].category === 'materials' && pur.ex[0].amount > 0, `purchase recorded as materials expense (${pur.ex[0]?.amount})`)

    // movements tab
    await page.getByRole('tab', { name: /الحركات/ }).click()
    await page.waitForTimeout(500)
    await shot(page, 'inv-16-movements-ar')
    await noOverflow(page, 'movements desktop ar')
    await noTableScroll(page, 'movements desktop ar')

    // CSV export
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير CSV' }).click()])
    ok(/^stock-movements-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), `movements CSV downloaded (${dl.suggestedFilename()})`)
    await page.getByRole('tab', { name: /الأصناف/ }).click()
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير CSV' }).click()])
    ok(/^inventory-\d{4}-\d{2}-\d{2}\.csv$/.test(dl2.suggestedFilename()), `items CSV downloaded (${dl2.suggestedFilename()})`)
    const csv = await (await import('node:fs')).promises.readFile(await dl2.path(), 'utf8')
    ok(csv.charCodeAt(0) === 0xfeff && csv.includes('قفازات لاتكس مقاس M'), 'items CSV has BOM and Arabic rows')

    // ---- expenses ----
    await page.evaluate(async () => window.__dentora.db.expenses.clear())
    await go(page, '/expenses')
    await shot(page, 'exp-01-empty-ar')
    await page.getByRole('button', { name: 'تسجيل أول مصروف' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'تسجيل المصروف' }).click()
    await page.waitForTimeout(250)
    ok(await page.locator('.modal .field-error').count() === 3, 'expense form flags category, amount, description')
    await shot(page, 'exp-02-form-validation-ar')
    await page.getByLabel('الفئة').selectOption('utilities')
    await page.getByLabel('المبلغ').fill('0')
    await page.getByLabel('الوصف').fill('فاتورة المياه')
    await page.getByRole('button', { name: 'تسجيل المصروف' }).click()
    await page.waitForTimeout(250)
    ok(await page.getByText('يجب أن يكون أكبر من صفر').count() === 1, 'amount must be positive')
    await page.getByLabel('المبلغ').fill('45.5')
    await page.getByLabel('الجهة المستفيدة').fill('مؤسسة المياه')
    await shot(page, 'exp-03-form-filled-ar')
    await page.getByLabel('الوصف').press('Enter')
    await page.waitForTimeout(500)
    const ex = await dbq(page, async () => (await window.__dentora.db.expenses.toArray())[0])
    ok(ex && ex.amount === 45.5 && ex.category === 'utilities' && ex.by === 'u-admin' && ex.method === 'cash' && ex.vendor === 'مؤسسة المياه', 'expense created via Enter')
    const act = await dbq(page, async () => (await window.__dentora.db.activity.where('type').equals('expense').toArray()).length)
    ok(act >= 1, 'expense activity logged')

    await seedExpenses(page)
    await go(page, '/expenses')
    await shot(page, 'exp-04-month-ar')
    await shot(page, 'exp-04b-month-full-ar', { full: true })
    await noOverflow(page, 'expenses desktop ar')
    await noTableScroll(page, 'expenses desktop ar')
    const est = await page.locator('.inv-exp-stats .stat-value').allTextContents()
    ok(est[0].includes('4,996'), `period total 4,995.5 shown as 4,996 (${est[0]})`)
    ok((await page.locator('.inv-exp-stats .stat-delta').first().textContent()).includes('%'), 'delta vs previous shown')

    // breakdown click filters
    await page.locator('.inv-exp-bar', { hasText: 'مواد' }).click()
    await page.waitForTimeout(300)
    ok(await page.locator('tbody tr').count() === 2, 'breakdown click filters by category')
    await shot(page, 'exp-05-filtered-ar')
    await page.locator('.inv-exp-bar', { hasText: 'مواد' }).click()

    // edit + delete
    await page.locator('tr', { hasText: 'إعلان ممول' }).getByRole('button', { name: 'تعديل' }).click()
    await page.waitForTimeout(300)
    await page.getByLabel('المبلغ').fill('150')
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click()
    await page.waitForTimeout(400)
    ok((await dbq(page, async () => (await window.__dentora.db.expenses.get('ex6')).amount)) === 150, 'expense edited')
    await page.locator('tr', { hasText: 'صيانة الكرسي' }).getByRole('button', { name: 'حذف' }).click()
    await page.waitForTimeout(300)
    await shot(page, 'exp-06-confirm-delete-ar')
    await page.locator('.modal').getByRole('button', { name: 'حذف' }).click()
    await page.waitForTimeout(400)
    ok((await dbq(page, async () => window.__dentora.db.expenses.get('ex7'))) === undefined, 'expense deleted')

    // previous month + custom range
    await page.getByRole('button', { name: 'الشهر السابق' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'exp-07-prev-month-ar')
    ok(await page.locator('tbody tr').count() === 6, 'previous month lists 6')
    await page.getByRole('tab', { name: 'فترة مخصصة' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'exp-08-custom-ar')
    const [ef, et] = [page.getByLabel('من تاريخ'), page.getByLabel('إلى تاريخ')]
    await ef.fill('2026-10-05'); await et.fill('2026-10-01')
    await page.waitForTimeout(200)
    ok(await page.getByText('اختر فترة صحيحة').count() === 1, 'invalid custom range flagged')
    await et.fill('2026-10-09')
    await page.waitForTimeout(400)
    ok(await page.locator('tbody tr').count() === 5, `custom range 5–9 lists 5 (${await page.locator('tbody tr').count()})`)

    const [dl3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير CSV' }).click()])
    ok(/^expenses-2026-10-05_2026-10-09\.csv$/.test(dl3.suggestedFilename()), `expenses CSV (${dl3.suggestedFilename()})`)
    await browser.close()
  }

  // ======================= desktop EN =======================
  {
    const { browser, page } = await openBrowser({ lang: 'en' })
    watch(page, 'en')
    await seedAndLogin(page, { lang: 'en' })
    await page.evaluate(async () => { const db = window.__dentora.db; await db.inventory.clear(); await db.stock.clear(); await db.expenses.clear() })
    await seedInventory(page); await seedExpenses(page)
    await go(page, '/inventory')
    await shot(page, 'inv-20-list-en')
    await noOverflow(page, 'inventory desktop en')
    await noTableScroll(page, 'inventory desktop en')
    await page.locator('tr', { hasText: 'كمامات طبية' }).locator('.inv-step.add').click()
    await page.waitForTimeout(300)
    await shot(page, 'inv-21-popover-en')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'New item' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'inv-22-form-en')
    await page.keyboard.press('Escape')
    await page.locator('tr', { hasText: 'مخدر أرتيكائين' }).locator('.inv-item-name').click()
    await page.waitForTimeout(400)
    await shot(page, 'inv-23-drawer-en')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Record purchase' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'inv-24-purchase-en')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: /Movements/ }).click()
    await page.waitForTimeout(400)
    await shot(page, 'inv-25-movements-en')
    await go(page, '/expenses')
    await shot(page, 'exp-20-month-en')
    await noOverflow(page, 'expenses desktop en')
    await noTableScroll(page, 'expenses desktop en')
    await shot(page, 'exp-20b-month-en-full', { full: true })
    await page.getByRole('button', { name: 'New expense' }).click()
    await page.waitForTimeout(400)
    await shot(page, 'exp-21-form-en')
    await browser.close()
  }

  // ======================= phone =======================
  {
    const { browser, page } = await openBrowser({ mobile: true, width: 390, height: 844 })
    watch(page, 'phone')
    await seedAndLogin(page, { lang: 'ar' })
    await page.evaluate(async () => { const db = window.__dentora.db; await db.inventory.clear(); await db.stock.clear(); await db.expenses.clear() })
    await go(page, '/inventory')
    await shot(page, 'inv-30-empty-phone')
    await noOverflow(page, 'inventory empty phone')
    await seedInventory(page); await seedExpenses(page)
    await go(page, '/inventory')
    await shot(page, 'inv-31-list-phone')
    await noOverflow(page, 'inventory phone')
    await page.mouse.wheel(0, 700); await page.waitForTimeout(300)
    await shot(page, 'inv-31b-list-phone-scrolled')
    await page.locator('.inv-card', { hasText: 'كمامات طبية' }).locator('.inv-step.add').click()
    await page.waitForTimeout(500)
    await shot(page, 'inv-32-move-sheet-phone')
    await page.locator('.modal input[type=number]').fill('2')
    await page.locator('.modal').getByRole('button', { name: 'تسجيل الحركة' }).click()
    await page.waitForTimeout(500)
    ok((await dbq(page, async () => (await window.__dentora.db.inventory.get('it-masks')).quantity)) === 26, 'phone quick move')
    await page.locator('.inv-card', { hasText: 'قفازات لاتكس' }).locator('.inv-item-name').click()
    await page.waitForTimeout(500)
    await shot(page, 'inv-33-drawer-phone')
    await noOverflow(page, 'drawer phone')
    await page.locator('.drawer').getByRole('button', { name: 'تعديل الصنف' }).click()
    await page.waitForTimeout(500)
    await shot(page, 'inv-34-form-phone')
    await page.locator('.modal-body').evaluate(el => el.scrollTo(0, 9999)); await page.waitForTimeout(200)
    await shot(page, 'inv-34b-form-phone-bottom')
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'تسجيل شراء' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /إضافة الأصناف الناقصة/ }).click()
    await page.waitForTimeout(300)
    await shot(page, 'inv-35-purchase-phone')
    await noOverflow(page, 'purchase phone')
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    await page.getByRole('tab', { name: /الحركات/ }).click()
    await page.waitForTimeout(400)
    await shot(page, 'inv-36-movements-phone')
    await noOverflow(page, 'movements phone')

    await go(page, '/expenses')
    await shot(page, 'exp-30-month-phone')
    await noOverflow(page, 'expenses phone')
    await shot(page, 'exp-30b-month-phone-full', { full: true })
    await page.getByRole('button', { name: 'مصروف جديد' }).click()
    await page.waitForTimeout(500)
    await shot(page, 'exp-31-form-phone')
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    await page.getByRole('tab', { name: 'فترة مخصصة' }).click()
    await page.waitForTimeout(300)
    await shot(page, 'exp-32-custom-phone')
    await noOverflow(page, 'expenses custom phone')

    // read-only (trial expired): create/edit/delete disabled
    await page.evaluate(async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 40 * 86400000).toISOString() }) })
    await go(page, '/inventory')
    await page.waitForTimeout(600)
    ok(await page.getByRole('button', { name: 'صنف جديد' }).isDisabled(), 'read-only: new item disabled')
    ok(await page.locator('.inv-step').count() === 0, 'read-only: no +/- buttons')
    await shot(page, 'inv-37-readonly-phone')
    await go(page, '/expenses')
    ok(await page.getByRole('button', { name: 'مصروف جديد' }).isDisabled(), 'read-only: new expense disabled')
    await browser.close()
  }
} finally { server.kill() }

if (errors.length) { console.error(`\n${errors.length} problem(s):\n` + errors.join('\n')); process.exit(1) }
console.log('\nALL OK')
