// Pictures of the guide's topic "inventory" (server/guide/topics/inventory.ts); the shot API is documented at the top
// of store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin.
// Nothing is saved: dialogs are filled and pictured, and the runner restores the page (and data, if it changed) after.

/**
 * The pointer to a spot where it hovers nothing (desktop: the empty band under the page title; phone: the top edge).
 * The page keeps the pointer where the last shot left it, and a row or button under it shows its hover style.
 */
const rest = page => {
  const { width } = page.viewportSize()
  return width > 600 ? page.mouse.move(720, 150) : page.mouse.move(Math.round(width / 2), 2)
}
/** Every shot starts with the pointer at rest. */
const atRest = shots => Object.fromEntries(Object.entries(shots).map(([id, s]) => {
  const run = typeof s === 'function' ? s : s.run
  const wrapped = async ctx => { await rest(ctx.page); return run(ctx) }
  return [id, typeof s === 'function' ? wrapped : { ...s, run: wrapped }]
}))
const blur = page => page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())

/** The label above a form control in `scope` whose text is the app's `key`, for a marker just after its text. */
async function label(scope, helpers, key, n) {
  const text = await helpers.t(key)
  return { n, target: scope.locator('.field-label', { hasText: text }).first(), place: 'after-content' }
}

/**
 * Makes the window tall enough for the open dialog to show its whole body without a scrollbar (the guide shows a
 * dialog cropped, so the window's size is not seen), then scrolls the body back to its top.
 */
async function fitDialog(page, helpers, dlg) {
  for (let i = 0; i < 3; i++) {
    const extra = await dlg.locator('.modal-body').evaluate(el => el.scrollHeight - el.clientHeight)
    if (extra <= 1) break
    const vp = page.viewportSize()
    await helpers.viewport({ width: vp.width, height: vp.height + extra + 4 })
  }
  await dlg.locator('.modal-body').evaluate(el => { el.scrollTop = 0 })
  await helpers.settle(300)
}

/**
 * A dialog as a capture target, its box rounded inwards to whole CSS px: a centred dialog often sits half a pixel
 * off the grid, and the capture (which rounds outwards) would then show a hairline of the dimmed page along its
 * edges. Its own rounded corners are kept (made transparent). The window is already sized for it (fitDialog).
 */
async function snug(loc) {
  const b = await loc.boundingBox()
  const radius = await loc.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0)
  const x = Math.ceil(b.x), y = Math.ceil(b.y)
  return { el: { x, y, width: Math.floor(b.x + b.width) - x, height: Math.floor(b.y + b.height) - y }, pad: 0, round: radius, grow: false }
}

/** Opens Inventory on the Items tab and waits until the stat cards and the first row (or card) are there. */
async function open(page, helpers) {
  await helpers.goto('/inventory')
  await page.locator('.inv-stats .stat-card .num').first().waitFor()
  await page.locator('.inv-page table tbody tr, .inv-cards .inv-card').first().waitFor()
  await helpers.settle(500)
}
const firstRow = page => page.locator('.inv-page table tbody tr').first()

export const shots = atRest({
  'inventory-overview': async ({ page, helpers }) => {
    await open(page, helpers)
    return {}
  },

  'inventory-new-item': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('.page-header').getByRole('button', { name: await helpers.t('inventory.newItem') }).click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    const input = async key => dlg.locator('.field', { has: page.locator('.field-label', { hasText: await helpers.t(key) }) }).locator('input').first()
    await (await input('inventory.field.name')).fill(helpers.pick('قفازات نتريل مقاس L', 'Nitrile gloves, size L'))
    await dlg.locator('.inv-cat-picks .chip, .inv-cat-picks button').filter({ hasText: await helpers.t('inventory.cat.consumables') }).first().click()
    await (await input('inventory.field.initialQty')).fill('10')
    await (await input('inventory.field.minQuantity')).fill('4')
    await (await input('inventory.field.costPrice')).fill('6')
    await blur(page)
    await fitDialog(page, helpers, dlg)
    return {
      ...(await snug(dlg)),
      markers: [
        await label(dlg, helpers, 'inventory.field.name', 2),
        await label(dlg, helpers, 'inventory.field.category', 3),
        await label(dlg, helpers, 'inventory.field.unit', 4),
        await label(dlg, helpers, 'inventory.field.initialQty', 5),
        { n: 6, target: dlg.locator('.modal-footer .btn-primary') },
      ],
    }
  },

  'inventory-quick-move': async ({ page, helpers }) => {
    await open(page, helpers)
    const add = firstRow(page).locator('.inv-step.add')
    await add.click()
    const pop = page.locator('.inv-popover')
    await pop.waitFor()
    await pop.locator('input').first().fill('5')
    await helpers.settle(300)
    return {
      markers: [
        { n: 1, target: add, place: 'bottom' },
        await label(pop, helpers, 'inventory.move.amount', 2),
        { n: 3, target: pop.locator('.inv-reasons') },
        { n: 4, target: pop.locator('.inv-move-actions .btn-primary') },
      ],
    }
  },

  'inventory-purchase': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('.inv-reorder button').click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await dlg.locator('.inv-pl:not(.inv-pl-head)').first().waitFor()
    const input = async key => dlg.locator('.field', { has: page.locator('.field-label', { hasText: await helpers.t(key) }) }).locator('input').first()
    await (await input('inventory.purchase.supplier')).fill(helpers.pick('مستودع الشفاء للمواد السنية', 'Al-Shifa Dental Supplies'))
    await (await input('inventory.purchase.reference')).fill('F-2291')
    await fitDialog(page, helpers, dlg)
    await helpers.settle(300)
    await blur(page)
    const line = dlg.locator('.inv-pl:not(.inv-pl-head)').first()
    return {
      ...(await snug(dlg)),
      markers: [
        await label(dlg, helpers, 'inventory.purchase.date', 2),
        { n: 3, target: line.locator('.inv-pl-cell').first().locator('input'), place: 'inside-end' },
        { n: 4, target: dlg.locator('.inv-purchase-expense .switch, .inv-purchase-expense label').first(), place: 'after-content' },
        { n: 5, target: dlg.locator('.modal-footer .btn-primary') },
      ],
    }
  },

  'inventory-history': async ({ page, helpers }) => {
    await open(page, helpers)
    await firstRow(page).locator('td').first().click()
    await page.locator('.drawer').waitFor()
    await helpers.settle(700)
    return {}
  },

  'inventory-movements': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('.inv-tabs').getByRole('tab', { name: await helpers.t('inventory.tab.movements') }).click()
    await page.locator('.inv-page table tbody tr').first().waitFor()
    await helpers.settle(900)
    return {}
  },

  'inventory-expiring': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('.inv-stats .stat-card').nth(2).click()
    const chip = page.locator('.inv-chip-warn')
    await chip.waitFor()
    await helpers.settle(600)
    await rest(page)
    return {
      markers: [
        { n: 1, target: page.locator('.inv-search input'), place: 'inside-end' },
        { n: 2, target: page.locator('.inv-chips .chip').first() },
        { n: 3, target: page.locator('.inv-stats .stat-card').nth(2) },
        { n: 3, target: chip },
        { n: 4, target: page.locator('.inv-foot .inv-link-btn') },
      ],
    }
  },

  'inventory-row-menu': async ({ page, helpers }) => {
    await open(page, helpers)
    await firstRow(page).locator('.inv-rowmenu button').click()
    const menu = page.locator('.inv-portal-menu')
    await menu.locator('.menu-item').first().waitFor()
    await helpers.settle(600)
    // from the table's header to the end of the row the menu ends over (a whole row, not half of one)
    const head = await page.locator('.inv-page table thead').boundingBox()
    const m = await menu.boundingBox()
    const rows = await page.locator('.inv-page table tbody tr').evaluateAll(trs => trs.map(tr => tr.getBoundingClientRect().bottom))
    const bottom = rows.find(b => b >= m.y + m.height + 12) ?? m.y + m.height + 24
    return { clip: { x: head.x - 12, y: head.y - 12, width: head.width + 24, height: bottom + 1 - (head.y - 12) } }
  },

  'inventory-phone': async ({ page, helpers }) => {
    await open(page, helpers)
    await helpers.scrollTo(page.locator('.inv-cards .inv-card').first())
    return {}
  },

  'inventory-phone-move': async ({ page, helpers }) => {
    await open(page, helpers)
    const card = page.locator('.inv-cards .inv-card').first()
    await helpers.scrollTo(card)
    await card.locator('.inv-step.add').tap()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await helpers.settle(500)
    await dlg.locator('input').first().fill('5')
    await blur(page)
    await helpers.settle(300)
    return {}
  },
})
