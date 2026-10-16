// Chapter 11 "Inventory": the Inventory page, adding an item, quick stock in and out, recording a purchase (restock),
// the movement history and the Movements tab, alerts, search and filters, the row menu and editing, export, the phone.
// Written from server/guide/topics/inventory.ts, in its order. Runs on the demo clinic, signed in as the admin, from
// the dashboard; the changes it saves are the kind a clinic makes (a new box of gloves, 5 boxes received, a delivery
// of the low items). A dialog or drawer a scene opens is closed at the start of the scene that follows, so it stays
// on the screen for the whole of its narration.

const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)
/** A button by its label in either language (the accessible name is the visible text). */
const btn = (scope, ar, en) => scope.getByRole('button', { name: new RegExp(`^(${ar}|${en})$`) })
const modal = page => page.locator('.modal')
const firstRow = page => page.locator('table tbody tr').first()

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}
async function itemsShown(page) {
  await page.locator('.inv-stats .stat-card .stat-value').first().waitFor({ timeout: 15000 })
  await firstRow(page).waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
}
async function closeModal(page, ui) {
  if (await modal(page).count()) {
    await ui.click(btn(page.locator('.modal-footer'), 'إلغاء', 'Cancel'))
    await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
  }
}

export const chapter = {
  slug: 'inventory',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تتابع مواد عيادتك في دنتورا، ويحذّرك البرنامج قبل أن ينفد شيء. افتح «المخزون» من القائمة الجانبية، في قسم «الإدارة».',
        en: 'In this chapter you keep track of your clinic’s supplies in Dentora, and the app warns you before anything runs out. Open Inventory from the sidebar, in the Management section.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2000)
        await ui.click(nav(page, '/inventory'))
        await itemsShown(page)
      },
    },
    {
      id: 'cards',
      say: {
        ar: 'أربع بطاقات في الأعلى: «عدد الأصناف»، و«نقص في المخزون»، و«قاربت على الانتهاء»، و«قيمة المخزون». وتحتها شريط أصفر بالأصناف الناقصة، وزر «تزويد المخزون».',
        en: 'Four cards sit at the top: Items, Low stock, Expiring soon and Stock value. Under them a yellow bar names the low items, with a Restock button.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('.inv-stats'), 1200)
        for (let i = 0; i < 4; i++) await ui.moveTo(page.locator('.inv-stats .stat-card').nth(i), { ms: 350 })
        await ui.point(page.locator('.inv-reorder'), 1400)
        await ui.point(page.locator('.inv-reorder button'), 900)
      },
    },
    {
      id: 'table',
      say: {
        ar: 'ثم تبويبا «الأصناف» و«الحركات». في الجدول لكل صنف رمزه وفئته، و«الكمية» بين زرّي ناقص وزائد، ثم «حد التنبيه» و«سعر التكلفة» و«القيمة» و«المورد» و«الصلاحية».',
        en: 'Then the Items and Movements tabs. In the table each item shows its SKU and category, its Quantity between a minus and a plus button, then Threshold, Cost price, Value, Supplier and Expiry.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('.inv-tabs'), 1100)
        const heads = page.locator('table thead th')
        const n = Math.min(await heads.count(), 7)
        for (let i = 0; i < n; i++) await ui.moveTo(heads.nth(i), { ms: 320 })
        await ui.pause(300)
      },
    },
    {
      id: 'order',
      say: {
        ar: 'القائمة مرتّبة حسب الأولوية: ما نفد أولاً، ثم ما بلغ حد التنبيه بشارة «نقص»، ثم ما قاربت صلاحيته، ثم البقية بالاسم.',
        en: 'The list is sorted by urgency: out of stock first, then items at their alert level with a Low badge, then expiring ones, then the rest by name.',
      },
      run: async ({ page, ui }) => {
        await ui.point(firstRow(page).locator('.inv-item-meta'), 1300)
        await ui.point(page.locator('table tbody tr').nth(1).locator('.inv-item-meta'), 1000)
        await ui.point(page.locator('table tbody tr').nth(2).locator('.inv-item-meta'), 1000)
      },
    },
    {
      id: 'new-open',
      say: {
        ar: 'لإضافة مادة جديدة انقر على «صنف جديد». تضيفها مرة واحدة، ثم تتغير كميتها مع كل شراء أو استهلاك.',
        en: 'To add a new supply, click New item. You add it once; after that its quantity moves with every purchase and every use.',
      },
      run: async ({ page, ui }) => {
        await ui.click(btn(page, 'صنف جديد', 'New item'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(500)
      },
    },
    {
      id: 'new-name',
      say: {
        ar: 'اكتب «اسم الصنف»، واختر «الفئة» بنقرة، مثل «مستهلكات»، وأضف «الرمز» إن كان للصنف رمز.',
        en: 'Type the Item name, pick a Category with one click, such as Consumables, and add the SKU if the item has a code.',
      },
      run: async ({ page, ui, lang }) => {
        const m = modal(page)
        await ui.type(m.getByLabel(/اسم الصنف|Item name/), pick(lang, 'قفازات نتريل مقاس L', 'Nitrile gloves, size L'), { delay: 60 })
        await ui.click(m.locator('.inv-cat-picks .chip', { hasText: /^(مستهلكات|Consumables)$/ }))
        await ui.type(m.getByLabel(/الرمز \(SKU\)|^SKU$/), 'GL-L-100', { delay: 60 })
      },
    },
    {
      id: 'new-stock',
      say: {
        ar: 'اختر «الوحدة»، ثم أدخل «الكمية الابتدائية» الموجودة الآن، و«حد التنبيه»، و«سعر التكلفة» للوحدة، و«تاريخ الانتهاء» إن وُجد.',
        en: 'Choose the Unit, then enter the Opening quantity you have now, the Alert threshold, the Cost price per unit and the Expiry date if there is one.',
      },
      run: async ({ page, ui }) => {
        const m = modal(page)
        await ui.point(m.getByLabel(/^(الوحدة|Unit)$/), 1000)
        await ui.type(m.getByLabel(/الكمية الابتدائية|Opening quantity/), '10', { delay: 90 })
        await ui.type(m.getByLabel(/حد التنبيه|Alert threshold/), '4', { delay: 90 })
        await ui.type(m.getByLabel(/سعر التكلفة|Cost price/), '6', { delay: 90 })
        await ui.point(m.getByLabel(/تاريخ الانتهاء|Expiry date/), 1000)
      },
    },
    {
      id: 'new-save',
      say: {
        ar: 'أكمل «المورد» إن شئت، ثم انقر على «إضافة الصنف». تُسجَّل الكمية الابتدائية باسم «رصيد افتتاحي».',
        en: 'Fill in the Supplier if you like, then click Add item. The opening quantity is recorded as Opening stock.',
      },
      run: async ({ page, ui, lang }) => {
        const m = modal(page)
        await ui.type(m.getByLabel(/^(المورد|Supplier)$/), pick(lang, 'مستودع الشفاء للمواد السنية', 'Al-Shifa Dental Supplies'), { delay: 50 })
        await ui.point(m.getByLabel(/مكان التخزين|Storage location/), 800)
        await ui.click(btn(page.locator('.modal-footer'), 'إضافة الصنف', 'Add item'))
        await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
        await ui.pause(900)
      },
    },
    {
      id: 'move-open',
      say: {
        ar: 'بجانب كل كمية زرّان: ناقص للسحب وزائد للإضافة. انقر على زائد في سطر الصنف الأول.',
        en: 'Next to each quantity there are two buttons: minus to take stock and plus to add stock. Click plus on the first item’s row.',
      },
      run: async ({ page, ui }) => {
        await itemsShown(page)
        await ui.moveTo(firstRow(page).locator('.inv-step').first())
        await ui.point(firstRow(page).locator('.inv-qty'), 1200)
        await ui.click(firstRow(page).locator('.inv-step.add'))
        await page.locator('.inv-popover').waitFor({ timeout: 10000 })
        await ui.pause(400)
      },
    },
    {
      id: 'move-fill',
      say: {
        ar: 'في «حركة مخزون» تبدّل بين «إدخال» و«إخراج». اكتب «الكمية»، واختر «السبب»: «شراء» أو «إرجاع» أو «تسوية»، ومع الإخراج «استهلاك» أو «إتلاف».',
        en: 'In Stock movement you switch between Stock in and Stock out. Type the Quantity and choose the Reason: Purchase, Return or Adjustment; for stock out, Used or Discarded.',
      },
      run: async ({ page, ui }) => {
        const p = page.locator('.inv-popover')
        await ui.point(p.locator('.segmented'), 1100)
        await ui.type(p.locator('input[type="number"]').first(), '5', { delay: 90 })
        await ui.point(p.locator('.inv-reasons'), 1000)
        await ui.click(p.locator('.inv-reasons .chip', { hasText: /^(شراء|Purchase)$/ }))
      },
    },
    {
      id: 'move-save',
      say: {
        ar: 'انظر إلى «الرصيد بعد الحركة»، ثم انقر على «تسجيل الحركة». ولا تنزل الكمية تحت الصفر أبداً.',
        en: 'Check the Balance after, then click Record movement. The quantity never goes below zero.',
      },
      run: async ({ page, ui }) => {
        const p = page.locator('.inv-popover')
        await ui.point(p.locator('.inv-move-summary'), 1400)
        await ui.click(btn(p, 'تسجيل الحركة', 'Record movement'))
        await p.waitFor({ state: 'hidden', timeout: 10000 })
        await ui.pause(900)
      },
    },
    {
      id: 'purchase-open',
      say: {
        ar: 'وحين تصل طلبية انقر على «تزويد المخزون»: تُفتح نافذة «تسجيل شراء» وفيها كل الأصناف الناقصة بكميات مقترحة.',
        en: 'When a delivery arrives, click Restock: the Record purchase window opens with every low item and a suggested quantity.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.inv-reorder button'))
        await modal(page).waitFor({ timeout: 10000 })
        await modal(page).locator('.inv-pl:not(.inv-pl-head)').first().waitFor({ timeout: 10000 })
        await ui.pause(500)
        await ui.point(modal(page).locator('.inv-purchase-lines'), 1400)
      },
    },
    {
      id: 'purchase-fields',
      say: {
        ar: 'تأكد من «تاريخ الشراء»، واكتب «المورد» و«رقم الفاتورة». وفي كل سطر «الصنف» و«الكمية» و«سعر الوحدة» كما في فاتورتك.',
        en: 'Check the Purchase date, and fill in the Supplier and Invoice number. Each line holds the Item, Quantity and Unit price, as on your invoice.',
      },
      run: async ({ page, ui, lang }) => {
        const m = modal(page)
        // the scene before left the dialog scrolled to its lines: back up to the header fields first
        await ui.scrollTo(m.getByLabel(/تاريخ الشراء|Purchase date/))
        await ui.point(m.getByLabel(/تاريخ الشراء|Purchase date/), 900)
        await ui.type(m.getByLabel(/^(المورد|Supplier)$/), pick(lang, 'مستودع الشفاء للمواد السنية', 'Al-Shifa Dental Supplies'), { delay: 50 })
        await ui.type(m.getByLabel(/رقم الفاتورة|Invoice number/), 'F-2291', { delay: 70 })
        await ui.point(m.locator('.inv-pl:not(.inv-pl-head)').first(), 1300)
      },
    },
    {
      id: 'purchase-save',
      say: {
        ar: 'اترك «تسجيل قيمة الشراء في المصروفات» مفعّلاً ليُسجَّل الإجمالي في فئة «مواد». راجع «إجمالي الشراء»، ثم انقر على «حفظ الشراء». ارتفعت الكميات، واختفى الشريط الأصفر.',
        en: 'Leave Record the purchase total as an expense on, so the total is recorded under Materials. Check the Purchase total, then click Save purchase. The quantities went up, and the yellow bar is gone.',
      },
      run: async ({ page, ui }) => {
        const m = modal(page)
        await ui.scrollTo(m.locator('.inv-purchase-expense'))
        await ui.point(m.locator('.inv-purchase-expense'), 1200)
        await ui.point(page.locator('.modal-footer .inv-purchase-total'), 1000)
        await ui.click(btn(page.locator('.modal-footer'), 'حفظ الشراء', 'Save purchase'))
        await modal(page).waitFor({ state: 'hidden', timeout: 15000 })
        await ui.pause(800)
        await ui.point(page.locator('.inv-stats .stat-card').nth(1), 1500)
      },
    },
    {
      id: 'history-open',
      say: {
        ar: 'انقر على سطر أي صنف لتفتح «سجل الحركات»: الكمية الحالية، و«سعر التكلفة» و«القيمة» و«الصلاحية»، وزرّا «إضافة كمية» و«سحب كمية».',
        en: 'Click any item’s row to open its Movement history: the current quantity, Cost price, Value and Expiry, and the Add stock and Take stock buttons.',
      },
      run: async ({ page, ui }) => {
        await ui.click(firstRow(page).locator('.inv-item-name'))
        const d = page.locator('.drawer')
        await d.waitFor({ timeout: 10000 })
        await d.locator('.inv-summary').waitFor({ timeout: 10000 })
        await ui.pause(400)
        await ui.point(d.locator('.inv-summary'), 1200)
        await ui.point(d.locator('.inv-summary-stats'), 900)
        await ui.point(d.locator('.inv-drawer-actions'), 1000)
      },
    },
    {
      id: 'history-list',
      say: {
        ar: 'وتحت «آخر الحركات» كل حركة بسببها وتاريخها ومن سجّلها، و«الرصيد بعدها». وزر «تعديل الصنف» في الأسفل.',
        en: 'Under Recent movements each movement shows its reason, date, who recorded it and the Balance after. The Edit item button sits at the bottom.',
      },
      run: async ({ page, ui }) => {
        const d = page.locator('.drawer')
        await ui.scrollTo(d.locator('.inv-timeline'), { block: 'start' })
        await ui.point(d.locator('.inv-tl-row').nth(0), 1100)
        await ui.point(d.locator('.inv-tl-row').nth(1), 800)
        await ui.point(btn(d.locator('.drawer-footer'), 'تعديل الصنف', 'Edit item'), 1000)
      },
    },
    {
      id: 'movements-tab',
      say: {
        ar: 'تبويب «الحركات» يجمع حركات كل الأصناف، الأحدث أولاً. ابحث فيه، أو اختر سبباً مثل «شراء» لتعرض حركاته وحدها.',
        en: 'The Movements tab gathers the movements of every item, newest first. Search it, or pick one reason such as Purchase to show only those.',
      },
      run: async ({ page, ui }) => {
        const d = page.locator('.drawer')
        await ui.click(d.locator('.drawer-header').getByRole('button', { name: /^(إغلاق|Close)$/ }))
        await d.waitFor({ state: 'hidden', timeout: 10000 })
        await ui.click(page.locator('.inv-tabs').getByRole('tab', { name: /الحركات|Movements/ }))
        await firstRow(page).waitFor({ timeout: 15000 })
        await ui.pause(500)
        await ui.point(page.locator('.inv-search'), 800)
        await ui.click(page.locator('.inv-chips .chip', { hasText: /^(شراء|Purchase)$/ }))
        await ui.pause(1500)
        await ui.click(page.locator('.inv-chips .chip', { hasText: /^(الكل|All)$/ }))
        await ui.pause(300)
      },
    },
    {
      id: 'search',
      say: {
        ar: 'في «الأصناف» ابحث بالاسم أو الرمز أو المورد، وانقر على فئة لتعرض أصنافها وحدها، أو على «كل الفئات» لتعود.',
        en: 'On Items, search by name, SKU or supplier, and click a category to show only its items, or All categories to go back.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(page.locator('.inv-tabs').getByRole('tab', { name: /الأصناف|Items/ }))
        await firstRow(page).waitFor({ timeout: 15000 })
        await ui.type(page.locator('.inv-search input'), pick(lang, 'قفاز', 'glove'), { delay: 90 })
        await ui.pause(1200)
        await ui.click(page.locator('.inv-search .icon-end.clickable'))
        await ui.click(page.locator('.inv-chips .chip', { hasText: /مستهلكات|Consumables/ }))
        await ui.pause(1000)
        await ui.click(page.locator('.inv-chips .chip', { hasText: /^(كل الفئات|All categories)$/ }))
      },
    },
    {
      id: 'expiring',
      say: {
        ar: 'انقر على بطاقة «قاربت على الانتهاء»: يظهر ما قارب انتهاءه بشارة مثل «ينتهي خلال 24 يوماً»، ويحذّرك البرنامج قبل 60 يوماً. ثم «مسح التصفية».',
        en: 'Click the Expiring soon card: expiring stock shows with a badge such as Expires in 24 days, and Dentora warns you 60 days ahead. Then Clear filters.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.inv-stats .stat-card').nth(2))
        await page.locator('.inv-chip-warn').waitFor({ timeout: 10000 })
        await ui.pause(400)
        await ui.point(page.locator('.inv-chip-warn'), 1000)
        await ui.point(firstRow(page).locator('.badge').last(), 1300)
        await ui.pause(2200)
        await ui.click(btn(page, 'مسح التصفية', 'Clear filters'))
        await ui.pause(300)
      },
    },
    {
      id: 'row-menu',
      say: {
        ar: 'في آخر كل سطر زر الخيارات: «سجل الحركات» و«تعديل» و«تسجيل شراء لهذا الصنف» و«إيقاف الصنف»، وهو أفضل من الحذف. انقر على «تعديل».',
        en: 'At the end of each row sits the options button: Movement history, Edit, Record a purchase and Deactivate item, which is better than deleting. Click Edit.',
      },
      run: async ({ page, ui }) => {
        await firstRow(page).waitFor({ timeout: 10000 })
        await ui.click(firstRow(page).locator('.inv-rowmenu button'))
        const menu = page.locator('.inv-portal-menu')
        await menu.waitFor({ timeout: 10000 })
        await ui.pause(400)
        const items = menu.locator('.menu-item')
        const n = await items.count()
        for (let i = 0; i < n; i++) await ui.moveTo(items.nth(i), { ms: 320 })
        await ui.pause(1200)
        await ui.click(menu.getByRole('menuitem', { name: /^(تعديل|Edit)$/ }))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(400)
      },
    },
    {
      id: 'edit',
      say: {
        ar: 'التعديل لا يغيّر الكمية: تبقى «الكمية الحالية» مقفلة لأنها تتغير بحركات المخزون فقط. ومفتاح «صنف نشط» يوقف الصنف أو يعيده.',
        en: 'Editing never changes the quantity: Current quantity stays locked, because it moves only through stock movements. The Active item switch deactivates the item or brings it back.',
      },
      run: async ({ page, ui }) => {
        const m = modal(page)
        await ui.point(m.getByLabel(/الكمية الحالية|Current quantity/), 1600)
        await ui.point(m.locator('.switch').first(), 1200)
      },
    },
    {
      id: 'export',
      say: {
        ar: '«تصدير CSV» يحفظ الجدول كما تراه في ملف يفتحه Excel. على ويندوز تُفتح نافذة حفظ، وعلى أندرويد شاشة الحفظ في النظام.',
        en: 'Export CSV saves the table as you see it, as a file Excel opens. On Windows a save window opens; on Android, the system’s save screen.',
      },
      run: async ({ page, ui }) => {
        await closeModal(page, ui)
        await ui.scrollTo(page.locator('.page-header'))
        await ui.point(btn(page, 'تصدير CSV', 'Export CSV'), 1800)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف تجد «المخزون» تحت «المزيد»، ويصبح كل صنف بطاقة بزرّين كبيرين، وتُفتح نافذة الحركة من أسفل الشاشة.',
        en: 'On a phone, Inventory is under More, each item becomes a card with two large buttons, and the movement box opens from the bottom of the screen.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.moveTo(firstRow(page).locator('.inv-qty'))
        await ui.callout(pick(lang, 'على الهاتف: بطاقات وأزرار كبيرة', 'On a phone: cards with large buttons'), { ms: 2200 })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تضيف الأصناف وتسجّل الحركات والمشتريات وتتابع النقص والصلاحية. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you add items, record movements and purchases, and follow low stock and expiry. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}
