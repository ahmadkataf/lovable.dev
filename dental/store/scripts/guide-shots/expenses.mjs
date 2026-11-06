// Pictures of the guide's topic "expenses" (server/guide/topics/expenses.ts); the shot API is documented at the top
// of store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin.
// With the clock on 11 Oct 2026 the page opens on October 2026. Nothing is saved: dialogs are filled and pictured.

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

/** The .field in `scope` whose label is the app's text `key`. */
async function fieldOf(page, scope, helpers, key) {
  return scope.locator('.field', { has: page.locator('.field-label', { hasText: await helpers.t(key) }) }).first()
}
/** A marker just after the text of the label of the field whose label is the app's `key`. */
async function label(scope, helpers, key, n) {
  return { n, target: scope.locator('.field-label', { hasText: await helpers.t(key) }).first(), place: 'after-content' }
}

/**
 * A dialog as a capture target, its box rounded inwards to whole CSS px: a centred dialog often sits half a pixel
 * off the grid, and the capture (which rounds outwards) would then show a hairline of the dimmed page along its
 * edges. Its own rounded corners are kept (made transparent).
 */
async function snug(loc) {
  const b = await loc.boundingBox()
  const radius = await loc.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0)
  const x = Math.ceil(b.x), y = Math.ceil(b.y)
  return { el: { x, y, width: Math.floor(b.x + b.width) - x, height: Math.floor(b.y + b.height) - y }, pad: 0, round: radius, grow: false }
}

/** Opens Expenses (October 2026) and waits until the cards, the breakdown and the log are drawn. */
async function open(page, helpers) {
  await helpers.goto('/expenses')
  await page.locator('.inv-exp-stats .stat-card .money').first().waitFor()
  await page.locator('.inv-exp-bars .inv-exp-bar, .inv-exp-groups .inv-exp-group').first().waitFor()
  await helpers.settle(600)
}

export const shots = atRest({
  'expenses-overview': async ({ page, helpers }) => {
    await open(page, helpers)
    return {}
  },

  'expenses-new': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('.page-header').getByRole('button', { name: await helpers.t('expenses.newExpense') }).click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await (await fieldOf(page, dlg, helpers, 'expenses.field.category')).locator('select').selectOption('utilities')
    await (await fieldOf(page, dlg, helpers, 'expenses.field.amount')).locator('input').fill('48')
    await (await fieldOf(page, dlg, helpers, 'expenses.field.description')).locator('input').fill(helpers.pick('فاتورة كهرباء شهر تشرين الأول', 'October electricity bill'))
    await (await fieldOf(page, dlg, helpers, 'expenses.field.vendor')).locator('input').fill(helpers.pick('مؤسسة الكهرباء', 'Electricity company'))
    await helpers.settle(300)
    await blur(page)
    return {
      ...(await snug(dlg)),
      markers: [
        await label(dlg, helpers, 'expenses.field.category', 2),
        await label(dlg, helpers, 'expenses.field.amount', 3),
        await label(dlg, helpers, 'expenses.field.description', 4),
        await label(dlg, helpers, 'expenses.field.vendor', 5),
        { n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'expenses-period': async ({ page, helpers }) => {
    await open(page, helpers)
    const bar = page.locator('.inv-exp-period')
    await bar.getByRole('tab', { name: await helpers.t('expenses.period.custom') }).click()
    await page.locator('.inv-exp-range input').first().waitFor()
    await helpers.settle(600)
    await rest(page)
    const title = await page.locator('.page-header').boundingBox()
    const stats = await page.locator('.inv-exp-stats').boundingBox()
    return {
      clip: { x: stats.x - 12, y: title.y - 12, width: stats.width + 24, height: stats.y + stats.height + 12 - (title.y - 12) },
      markers: [
        { n: 2, target: page.locator('.inv-exp-range') },
        { n: 3, target: bar.getByRole('tab', { name: await helpers.t('expenses.period.month') }) },
      ],
    }
  },

  'expenses-breakdown': async ({ page, helpers }) => {
    await open(page, helpers)
    const lab = page.locator('.inv-exp-bars .inv-exp-bar').first()
    await lab.click()
    await page.locator('.inv-exp-bar.active').waitFor()
    await helpers.settle(600)
    await rest(page)
    // the breakdown and the whole log under it, down to its "Total of results" line (the window grows for it)
    return {
      el: [page.locator('.inv-exp-breakdown'), page.locator('.inv-exp-tfoot')], pad: 12,
      markers: [
        { n: 1, target: page.locator('.inv-exp-bar.active') },
        { n: 2, target: page.locator('.inv-exp-search input'), place: 'inside-end' },
        { n: 3, target: page.locator('.inv-exp-catsel select, select.inv-exp-catsel').first() },
      ],
    }
  },

  'expenses-lab-edit': async ({ page, helpers }) => {
    await open(page, helpers)
    const row = page.locator('.inv-exp-page table tbody tr', { has: page.locator('.inv-exp-lab') }).first()
    await row.locator('.inv-exp-desc').click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await helpers.settle(500)
    await blur(page)
    return snug(dlg)
  },

  'expenses-phone': async ({ page, helpers }) => {
    await open(page, helpers)
    await helpers.scrollTo(page.locator('.inv-exp-groups .inv-exp-group').first())
    return {}
  },
})
