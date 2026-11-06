// Pictures of the guide's topic "treatments" (server/guide/topics/treatments.ts). The shot API is documented at the
// top of store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// Demo patients are found by their file number (the same in both languages; record ids are not), plans by their
// place on the tab (the demo's plan titles differ between the languages). Nothing here saves: every dialog is left
// open for the picture, and the runner reloads the page before the next shot. treatments-chart-update completes one
// item (the runner restores the database after it).

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exactly = label => new RegExp(`^\\s*${esc(label)}\\s*\\*?\\s*$`)
/** The labelled wrapper (.field) of the field named `label` inside `scope`. */
const field = (scope, label) => scope.locator('.field').filter({ has: scope.page().locator('label.field-label').filter({ hasText: exactly(label) }) }).first()
/** The label (label.field-label) of the field named `label` inside `scope`. */
const labelOf = (scope, label) => scope.locator('label.field-label').filter({ hasText: exactly(label) }).first()
/** A marker just after a field's label text: "② Price". */
const atLabel = (n, scope, label) => ({ n, target: labelOf(scope, label), place: 'after-content' })
/** Takes the focus off the dialog's fields (no focus ring or selected text in the picture). */
const blur = page => page.evaluate(() => document.activeElement?.blur?.())
/** A thin box down the middle of everything `loc` matches: a marker placed 'bottom' or 'top' of it is centred on them. */
async function middleOf(loc) {
  const boxes = (await Promise.all((await loc.all()).map(l => l.boundingBox()))).filter(Boolean)
  const x1 = Math.min(...boxes.map(b => b.x)), x2 = Math.max(...boxes.map(b => b.x + b.width))
  const y1 = Math.min(...boxes.map(b => b.y)), y2 = Math.max(...boxes.map(b => b.y + b.height))
  return { x: (x1 + x2) / 2 - 1, y: y1, width: 2, height: y2 - y1 }
}
/** A button by its visible text (icons have no text; a count badge after the text is allowed). */
const button = (scope, text) => scope.locator('button, a.btn').filter({ hasText: new RegExp(`^\\s*${esc(text)}\\s*\\d*\\s*$`) }).first()

/** Opens a demo patient's file (by file number) on its Treatments tab, the tab bar just under the top bar. */
async function openTab(page, helpers, fileNo, { scroll = true } = {}) {
  const p = await helpers.patient(String(fileNo))
  await helpers.goto(`/patients/${p.id}?tab=treatments`)
  await page.locator('.pt-hero .pt-hero-name').waitFor()
  await page.locator('.tr-tab .tr-stats .stat-card').first().waitFor()
  await page.locator('.tr-tab .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(300)
  if (scroll) await helpers.scrollTo(page.locator('.pt-tabs'))
  return p
}
/** The plan card whose title is `title` (one of two strings: Arabic, English), or the n-th card. */
const planCard = (page, which) => typeof which === 'number' ? page.locator('section.tr-plan').nth(which) : page.locator('section.tr-plan').filter({ has: page.locator('.tr-plan-title').filter({ hasText: which }) }).first()
/** The row of the plan's items table whose tooth is `tooth`. */
const itemRow = (card, tooth) => card.locator('tbody tr').filter({ has: card.page().locator('.tr-tooth .num').filter({ hasText: new RegExp(`^${tooth}$`) }) }).first()

/**
 * Makes the window just tall enough for the open dialog to show whole (up to `cap` CSS px), as on a taller screen:
 * the dialog then needs no inner scrolling and its footer sits right under its content. The runner puts the window
 * size back after the shot.
 */
async function fitDialog(page, helpers, cap = 1100) {
  const { width, height } = page.viewportSize()
  await helpers.viewport({ width, height: 2400 })
  const h = await helpers.dialog().evaluate(e => e.getBoundingClientRect().height)
  await helpers.viewport({ width, height: Math.min(cap, Math.max(height, Math.ceil(h) + 48)) })
  await page.waitForTimeout(200)
}

async function dialogReady(page, helpers) {
  const dlg = helpers.dialog()
  await dlg.waitFor()
  await page.waitForTimeout(350)   // the opening animation
  return dlg
}

/**
 * Every shot ends with the mouse in an empty corner of the window (bottom, on the side away from the sidebar), so
 * no row, tab or button shows its hover colour from an earlier click.
 */
function restMouse(shots) {
  for (const [id, s] of Object.entries(shots)) {
    const run = typeof s === 'function' ? s : s.run
    const wrapped = async ctx => {
      const target = await run(ctx)
      if (ctx.device === 'desktop') {
        const { width, height } = ctx.page.viewportSize()
        await ctx.page.mouse.move(ctx.lang === 'ar' ? 3 : width - 3, height - 3)
        await ctx.page.waitForTimeout(150)
      }
      return target
    }
    shots[id] = typeof s === 'function' ? wrapped : { ...s, run: wrapped }
  }
  return shots
}

export const shots = restMouse({
  'treatments-overview': async ({ page, helpers }) => {
    await openTab(page, helpers, 55)
    return {}
  },

  // the plan's five items and its totals: a phone a little taller than the guide's 844 px shows them all, the first
  // item just under the top bar and the totals above the bottom bar (none cut in half)
  'treatments-phone': {
    viewport: { width: 390, height: 880 },
    run: async ({ page, helpers }) => {
      await openTab(page, helpers, 55, { scroll: false })
      await helpers.scrollTo(page.locator('section.tr-plan').first().locator('.tr-mitem').first(), { offset: -4 })
      return {}
    },
  },

  'treatments-new-plan': async ({ page, helpers }) => {
    await openTab(page, helpers, 23)
    await button(page.locator('.tr-tab-actions'), await helpers.t('treatments.plan.new')).click()
    const dlg = await dialogReady(page, helpers)
    // the title field is focused (autoFocus): its caret is hidden by the capture
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(2, dlg, await helpers.t('treatments.plan.titleLabel')),
        { n: 2, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'treatments-add-item': async ({ page, helpers }) => {
    await openTab(page, helpers, 23)
    const card = planCard(page, /48/)
    await card.scrollIntoViewIfNeeded()
    await button(card.locator('.tr-plan-bar'), await helpers.t('treatments.plan.addItem')).click()
    const dlg = await dialogReady(page, helpers)
    await dlg.locator('.tr-picker input').fill(helpers.pick('سطحان', '2 surfaces'))
    await dlg.locator('.tr-pick').filter({ hasText: helpers.pick('كومبوزيت', 'Composite') }).first().click()
    await dlg.locator('button[data-tooth="36"]').click()
    await dlg.locator('button[data-tooth="37"]').click()
    const chips = dlg.locator('.tr-surfaces .chip')
    await chips.filter({ hasText: await helpers.t('surf.M') }).click()
    await chips.filter({ hasText: await helpers.t('surf.O') }).click()
    await blur(page)
    await fitDialog(page, helpers)
    await dlg.locator('.modal-body').evaluate(el => { el.scrollTop = 0 })
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 3, target: dlg.locator('.tr-chosen'), place: 'bottom' },
        { n: 4, target: await middleOf(dlg.locator('button[data-tooth="36"], button[data-tooth="37"]')), place: 'bottom' },
        atLabel(5, dlg, await helpers.t('treatments.item.surfaces')),
        atLabel(5, dlg, await helpers.t('treatments.item.pricePerTooth')),
        { n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'treatments-plan-card': async ({ page, helpers }) => {
    await openTab(page, helpers, 19)
    const card = page.locator('section.tr-plan.st-draft').first()
    await card.waitFor()
    const row = card.locator('tbody tr').first()
    await helpers.css('.tr-tab-actions .btn{box-shadow:none!important}')   // its shadow would show in the margin above the card
    // the row's buttons sit close together: the markers go above them, in the empty actions column of the header
    return {
      el: card, pad: 12,
      markers: [
        { n: 1, target: button(card.locator('.tr-plan-bar'), await helpers.t('treatments.plan.approve')), place: 'top' },
        { n: 2, target: button(row, await helpers.t('treatments.act.start')), place: 'top' },
        { n: 3, target: button(row, await helpers.t('treatments.act.complete')), place: 'top' },
        { n: 5, target: row.locator('.menu-anchor button'), place: 'top' },
      ],
    }
  },

  'treatments-chart-update': async ({ page, helpers }) => {
    await openTab(page, helpers, 27)
    const card = page.locator('section.tr-plan').filter({ has: page.locator('tbody tr .tr-tooth .num').filter({ hasText: /^25$/ }) }).first()
    const row = itemRow(card, 25)
    await row.scrollIntoViewIfNeeded()
    await button(row, await helpers.t('treatments.act.complete')).click()
    const dlg = await dialogReady(page, helpers)
    await blur(page)
    await helpers.noToasts()
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(4, dlg, await helpers.t('treatments.chart.condition')),
        { n: 4, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'treatments-quick': async ({ page, helpers }) => {
    await openTab(page, helpers, 23)
    await button(page.locator('.tr-tab-actions'), await helpers.t('treatments.quick')).click()
    const dlg = await dialogReady(page, helpers)
    const search = dlg.locator('.tr-picker input')
    await search.fill(helpers.pick('بسيط', 'Simple'))
    await search.press('Enter')
    await dlg.locator('button[data-tooth="47"]').click()
    await blur(page)
    await fitDialog(page, helpers)
    await dlg.locator('.modal-body').evaluate(el => { el.scrollTop = 0 })
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: dlg.locator('.tr-chosen'), place: 'bottom' },
        { n: 2, target: dlg.locator('button[data-tooth="47"]'), place: 'bottom' },
        atLabel(3, dlg, await helpers.t('price')),
        { n: 4, target: dlg.locator('.modal-footer .btn').last(), place: 'top' },
      ],
    }
  },

  'treatments-bill': async ({ page, helpers }) => {
    await openTab(page, helpers, 31)
    await button(page.locator('.tr-tab-actions'), await helpers.t('treatments.bill.button')).click()
    const dlg = await dialogReady(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: dlg.locator('.tr-bill-all') },
        { n: 3, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'treatments-estimate': async ({ page, helpers }) => {
    await openTab(page, helpers, 55)
    const card = page.locator('section.tr-plan').first()
    await button(card.locator('.tr-plan-bar'), await helpers.t('treatments.plan.print')).click()
    const dlg = await dialogReady(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: dlg.locator('.tr-sheet-totals .grand') },
        { n: 3, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'treatments-register': async ({ page, helpers }) => {
    await helpers.goto('/treatments')
    await page.locator('.tr-page .tr-stats .stat-card .money').first().waitFor()
    await page.locator('.tr-page .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    await helpers.settle(300)
    return {
      markers: [
        { n: 2, target: page.locator('.tr-filters input.tr-search, .tr-filters .tr-search input').first(), place: 'inside-end' },
        { n: 3, target: page.locator('.tr-filters .switch') },
        { n: 4, target: button(page.locator('.page-header, .tr-page'), await helpers.t('treatments.exportCsv')) },
      ],
    }
  },

  'treatments-procedures': async ({ page, helpers }) => {
    await helpers.goto('/procedures')
    await page.locator('table tbody tr').first().waitFor()
    await helpers.settle(300)
    return {
      markers: [
        { n: 1, target: button(page, await helpers.t('treatments.proc.new')), place: 'bottom' },
        { n: 3, target: page.locator('table tbody tr').first().locator('.menu-anchor button') },
        { n: 4, target: button(page, await helpers.t('treatments.bulk.button')) },
      ],
    }
  },

  'treatments-bulk-price': async ({ page, helpers }) => {
    await helpers.goto('/procedures')
    await page.locator('table tbody tr').first().waitFor()
    await page.locator('.chip').filter({ hasText: await helpers.t('cat.restorative') }).first().click()
    await button(page, await helpers.t('treatments.bulk.button')).click()
    const dlg = await dialogReady(page, helpers)
    await field(dlg, await helpers.t('treatments.bulk.round')).locator('select').selectOption('5')
    await blur(page)
    await page.waitForTimeout(200)
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(4, dlg, await helpers.t('treatments.bulk.direction')),
        atLabel(4, dlg, await helpers.t('treatments.bulk.mode')),
        atLabel(4, dlg, await helpers.t('treatments.bulk.value')),
        atLabel(4, dlg, await helpers.t('treatments.bulk.round')),
        { n: 5, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },
})
