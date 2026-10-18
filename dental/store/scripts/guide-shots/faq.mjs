// Pictures of the guide's topic "faq" (server/guide/topics/faq.ts); the shot API is documented at the top of
// store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin, on a
// fresh 7-day trial (the trial started at the fixed clock). The runner hides the trial bar in every picture of the
// guide; the questions here are about that bar, so these shots show it again (a later style sheet wins).
import { NOW } from './_helpers.mjs'

const DAY = 86_400_000

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

/** Shows the trial bar the runner hides (its own style sheet comes later than the runner's, so it wins). */
const showTrialBar = helpers => helpers.css('[data-qa="trial-bar"]{display:flex!important}')
/** The dashboard, drawn (its charts take about a second). */
async function dashboard(page, helpers) {
  await helpers.goto('/')
  await page.locator('[data-testid="dashboard"]').waitFor()
  await page.locator('[data-testid="dash-schedule"]').waitFor()
  await helpers.settle(1200)
}
/**
 * Ends the trial: moves its start 8 days back (in one transaction over every table, as a restore does: outside one
 * the licence guard only lets the start move earlier anyway) and reloads. The runner restores the database after.
 */
async function endTrial(page, helpers) {
  await helpers.db(async (db, iso) => db.transaction('rw', db.tables, () => db.settings.put({ key: 'installedAt', value: iso })), new Date(NOW.getTime() - 8 * DAY).toISOString())
  helpers.changedData()
  await page.reload()
  await helpers.settle(500)
}

export const shots = atRest({
  'faq-trial-bar': async ({ page, helpers }) => {
    await dashboard(page, helpers)
    await showTrialBar(helpers)
    const bar = page.locator('[data-qa="trial-bar"]')
    await bar.waitFor()
    await helpers.settle(300)
    // the top of the window: the sidebar's head, the top bar, the trial bar and the page title under it
    const { width } = page.viewportSize()
    const title = await page.locator('.app-content h1').first().boundingBox().catch(() => null)
    const barBox = await bar.boundingBox()
    const bottom = Math.ceil(Math.max(barBox.y + barBox.height + 96, title ? title.y + title.height + 44 : 0))
    return {
      clip: { x: 0, y: 0, width, height: bottom },
      markers: [{ n: 1, target: bar.locator('button') }],
    }
  },

  'faq-readonly': async ({ page, helpers }) => {
    await endTrial(page, helpers)
    await dashboard(page, helpers)
    await showTrialBar(helpers)
    await page.locator('[data-qa="trial-bar"].expired').waitFor()
    await rest(page)
    await helpers.settle(400)
    return {}
  },

  'faq-clock-behind': async ({ page, helpers }) => {
    // the licence clock remembers the latest time seen: put it three days ahead of the device's clock
    await helpers.storage({ 'dentora.lastSeen': String(NOW.getTime() + 3 * DAY) })
    helpers.changedData()   // the app copies that clock into its settings: put the database back after this shot
    await helpers.goto('/settings/license')
    const card = page.locator('[data-qa="license-status"]')
    await card.waitFor()
    await card.locator('.alert, [role="alert"]').first().waitFor()
    await rest(page)
    await helpers.settle(400)
    return { el: card, pad: 0 }
  },
})
