// Pictures of the guide's topic "dashboard" (server/guide/topics/dashboard.ts); the shot API is documented at the top
// of store/scripts/guide-shots.mjs. Every shot starts on the dashboard (#/) of the demo clinic at 11:40 on a Sunday.

/** Waits until every card of the dashboard has loaded (no skeletons) and the charts have drawn. */
async function ready(page, helpers) {
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor()
  await page.locator('[data-testid="dash-revenue"] svg').first().waitFor()
  await page.locator('[data-testid="dash-activity"] .rp-feed-row').first().waitFor()
  await helpers.settle(1600)
}

/**
 * The pointer to a spot where it hovers nothing (desktop: the empty band under the page title; phone: the top edge).
 * The page keeps the pointer where the last shot left it, and a card or button under it shows its hover style.
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

export const shots = atRest({
  'dashboard-overview': async ({ page, helpers }) => {
    await ready(page, helpers)
    return {
      markers: [
        // under each button, in the gap above the figure cards: the buttons sit too close for a marker between them,
        // and a badge on a corner would sit between two buttons
        { n: 1, target: page.locator('[data-testid="dash-new-apt"]'), place: 'bottom', dy: -8 },
        { n: 2, target: page.locator('[data-testid="dash-new-patient"]'), place: 'bottom', dy: -8 },
        { n: 3, target: page.locator('[data-testid="dash-new-payment"]'), place: 'bottom', dy: -8 },
      ],
    }
  },

  'dashboard-stats': async ({ page, helpers }) => {
    await ready(page, helpers)
    return { el: page.locator('.rp-dash-kpis'), pad: 16 }
  },

  'dashboard-schedule': async ({ page, helpers }) => {
    await ready(page, helpers)
    const card = page.locator('[data-testid="dash-schedule"]')
    // the first visit after the Now line that can be checked in, the first one in progress, a scheduled one
    const checkIn = card.locator('li.rp-now ~ li [data-testid="apt-do-arrived"]').first()
    const complete = card.locator('[data-testid="dash-apt"][data-status="in_progress"] [data-testid="apt-do-completed"]').first()
    const confirm = card.locator('[data-testid="apt-do-confirmed"]').first()
    const calendar = card.locator('.card-header a, .card-header button').filter({ hasText: await helpers.t('dashboard.sched.openCalendar') }).first()
    return {
      el: card, pad: 0,
      markers: [
        { n: 1, target: checkIn },
        { n: 2, target: complete },
        { n: 3, target: confirm },
        { n: 4, target: calendar },
      ],
    }
  },

  'dashboard-alerts': async ({ page, helpers }) => {
    await ready(page, helpers)
    return { el: page.locator('[data-testid="dash-alerts"]'), pad: 0 }
  },

  'dashboard-revenue': async ({ page, helpers }) => {
    await ready(page, helpers)
    const card = page.locator('[data-testid="dash-revenue"]')
    await helpers.scrollTo(card, { offset: -8 })
    const svg = card.locator('.card-body svg').first()
    const box = await svg.boundingBox()
    // the tallest day in the last part of the chart (it reads left to right in both languages): try each day there
    // and keep the one whose tooltip shows the largest amount
    const y = box.y + box.height * 0.5
    let best = null
    for (let f = 0.6; f <= 0.97; f += 0.012) {
      await page.mouse.move(box.x + box.width * f, y)
      await page.waitForTimeout(40)
      const v = await card.locator('.rp-tip .rp-tip-val').first().textContent({ timeout: 1000 }).catch(() => null)
      const n = Number(String(v || '').replace(/[^0-9.]/g, ''))
      if (v && (!best || n > best.n)) best = { n, f }
    }
    if (best) await page.mouse.move(box.x + box.width * best.f, y)
    await card.locator('.rp-tip').first().waitFor({ state: 'visible', timeout: 5000 })
    await helpers.settle(300)
    const toggle = card.getByRole('button', { name: await helpers.t('reports.showTable') })
    const reports = card.locator('.card-header button').filter({ hasText: await helpers.t('dashboard.openReports') })
    return {
      el: card, pad: 0,
      markers: [
        { n: 1, target: toggle },
        { n: 2, target: reports },
      ],
    }
  },

  'dashboard-status': async ({ page, helpers }) => {
    await ready(page, helpers)
    return { el: page.locator('[data-testid="dash-status"]'), pad: 0 }
  },

  'dashboard-activity': async ({ page, helpers }) => {
    // the demo clinic's own "Load demo data" entry is not something a clinic would see: leave it out of the picture
    // (the runner restores the database after the shot)
    await helpers.db(async (db, msg) => { await db.activity.filter(a => a.message === msg).delete() }, await helpers.t('settings.bk.act.demo'))
    await helpers.settle(400)
    await ready(page, helpers)
    const card = page.locator('[data-testid="dash-activity"]')
    return {
      el: card, pad: 0,
      markers: [{ n: 1, target: card.locator('a.rp-feed-row').first(), highlight: true, place: 'top-start' }],
    }
  },

  'dashboard-phone': async ({ page, helpers }) => {
    await ready(page, helpers)
    return {}
  },
})
