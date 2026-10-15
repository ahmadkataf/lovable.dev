// Pictures of the guide's topic "reports" (server/guide/topics/reports.ts); the shot API is documented at the top
// of store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin;
// the runner opens the reports on Last month (September 2026), as store/scripts/shoot.mjs does.

/**
 * The pointer to a spot where it hovers nothing (desktop: the empty band under the page title; phone: the top edge).
 * The page keeps the pointer where the last shot left it, and a chart under it shows its tooltip.
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

/** Opens a reports tab and waits for its data and charts (they draw for about a second after the data). */
async function open(page, helpers, tab = 'financial') {
  await helpers.goto(tab === 'financial' ? '/reports' : `/reports?tab=${tab}`)
  await page.locator('[data-testid="reports-page"]').waitFor()
  await waitDrawn(page, helpers)
}
async function waitDrawn(page, helpers) {
  await page.waitForFunction(() => !document.querySelector('[data-testid="reports-page"] [aria-busy="true"], [data-testid="reports-page"] .skeleton'), null, { timeout: 15000 }).catch(() => {})
  await helpers.settle(1600)
}

export const shots = atRest({
  'reports-overview': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('[data-testid="chart-revenue"] svg').first().waitFor()
    return {}
  },

  'reports-period': async ({ page, helpers }) => {
    await open(page, helpers)
    const bar = page.locator('[data-testid="rp-periodbar"]')
    await bar.getByRole('tab', { name: await helpers.t('reports.preset.custom') }).click()
    await page.locator('[data-testid="rp-from"]').waitFor()
    await bar.locator('select').selectOption('u-doc2')
    await waitDrawn(page, helpers)
    await rest(page)
    const head = await page.locator('.rp-page .page-header').boundingBox()
    const tabs = await page.locator('.rp-tabs').boundingBox()
    const box = await bar.boundingBox()
    return {
      clip: { x: box.x - 12, y: head.y - 12, width: box.width + 24, height: tabs.y + tabs.height + 12 - (head.y - 12) },
      markers: [
        { n: 1, target: bar.locator('.segmented') },
        { n: 2, target: bar.locator('select') },
        { n: 3, target: page.locator('.rp-tabs') },
      ],
    }
  },

  'reports-expenses-table': async ({ page, helpers }) => {
    await open(page, helpers)
    const card = page.locator('[data-testid="table-expenses"]')
    await helpers.scrollTo(card)
    await rest(page)
    return { el: card, pad: 12 }
  },

  'reports-phone': async ({ page, helpers }) => {
    await open(page, helpers)
    return {}
  },

  'reports-appointments': async ({ page, helpers }) => {
    await open(page, helpers, 'appointments')
    await helpers.scrollTo(page.locator('.rp-tabs'))
    await rest(page)
    await helpers.settle(400)
    return {}
  },

  'reports-outstanding': async ({ page, helpers }) => {
    await open(page, helpers, 'outstanding')
    const row = page.locator('[data-testid="table-outstanding"] tbody tr').first()
    await row.waitFor()
    return {
      markers: [
        { n: 1, target: page.locator('.rp-tabs .tab.active') },
        { n: 2, target: row.locator('.rp-namecell a').first(), place: 'after-content' },
        { n: 3, target: row.locator('.rp-wa') },
      ],
    }
  },

  'reports-table-toggle': async ({ page, helpers }) => {
    await open(page, helpers)
    const card = page.locator('[data-testid="chart-revenue"]')
    await card.locator('.card-header button').click()
    await card.locator('table').waitFor()
    await helpers.settle(600)
    await rest(page)
    return { el: card, pad: 12 }
  },
})
