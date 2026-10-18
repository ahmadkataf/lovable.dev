// Pictures of the guide's topic "interface" (server/guide/topics/interface.ts); the shot API is documented at the top
// of store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin.

const NEW_BUTTON = '.topbar-actions .btn-primary.hide-mobile'

/** The notifications group (.ntf-group) titled with the app's text `key`. */
async function group(page, helpers, key) {
  const title = await helpers.t(key)
  return page.locator('.ntf-group').filter({ has: page.locator('.ntf-head-title', { hasText: title }) }).first()
}

/** Waits until the dashboard behind a whole-window picture has drawn its cards. */
async function dashboardReady(page, helpers) {
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor()
  await page.locator('[data-testid="dash-revenue"] svg').first().waitFor()
  await helpers.settle(1200)
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
  'interface-overview': async ({ page, helpers }) => {
    await helpers.goto('/patients')
    await page.locator('.table tbody tr, .pt-card').first().waitFor()
    await helpers.settle(600)
    return {
      markers: [
        { n: 1, target: page.locator('.app-sidebar .nav-item[href$="/patients"]') },
        { n: 2, target: page.locator('.topbar-search') },
        { n: 3, target: page.locator(NEW_BUTTON) },
        { n: 4, target: page.getByRole('button', { name: await helpers.t('nav.notifications') }) },
        { n: 5, target: page.locator('.sidebar-user') },
      ],
    }
  },

  'interface-user-menu': async ({ page, helpers }) => {
    await dashboardReady(page, helpers)
    await page.locator('.sidebar-user').click()
    const lock = page.getByRole('menuitem', { name: await helpers.t('nav.lock') })
    await lock.waitFor()
    await rest(page)
    await helpers.settle(300)
    // the sidebar from the Management group down, and the menu that opens over it
    const side = await page.locator('.app-sidebar').boundingBox()
    const groupTop = await page.locator('.app-sidebar .nav-group', { hasText: await helpers.t('nav.management') }).boundingBox()
    const menu = await page.locator('[role="menu"]').last().boundingBox()
    const x1 = Math.min(side.x, menu.x), x2 = Math.max(side.x + side.width, menu.x + menu.width)
    const y1 = Math.min(groupTop.y, menu.y) - 6
    return {
      clip: { x: x1, y: y1, width: x2 - x1, height: side.y + side.height - y1 },
      markers: [
        { n: 1, target: page.locator('.collapse-btn') },
        { n: 2, target: page.locator('.sidebar-user') },
        { n: 3, target: lock },
      ],
    }
  },

  'interface-collapsed': async ({ page, helpers }) => {
    await dashboardReady(page, helpers)
    await page.locator('.collapse-btn').click()
    await page.locator('.app.collapsed').waitFor()
    await helpers.settle(500)
    // the pointer away from the sidebar: in this version the page name that should show beside a hovered icon is cut
    // off by the sidebar's edge (.nav scrolls, so it clips what sticks out), which would look like a glitch
    await rest(page)
    await helpers.settle(400)
    return {}
  },

  'interface-search-start': async ({ page, helpers }) => {
    await helpers.storage({ 'dentora.search.recent': null })
    await dashboardReady(page, helpers)
    await page.keyboard.press('Control+K')
    const panel = page.locator('.srch-panel')
    await panel.waitFor()
    await helpers.settle(500)
    return {
      el: panel, pad: 16,
      markers: [{ n: 1, target: panel.locator('.srch-input') }],
    }
  },

  'interface-search-results': async ({ page, helpers }) => {
    await dashboardReady(page, helpers)
    await page.keyboard.press('Control+K')
    const panel = page.locator('.srch-panel')
    await panel.waitFor()
    await page.keyboard.type(helpers.pick('سامر', 'Samer'), { delay: 40 })
    await panel.locator('.srch-item.active').waitFor()
    await helpers.settle(900)
    return {
      el: panel, pad: 0,
      markers: [
        { n: 2, target: panel.locator('.srch-group-title').first() },
        { n: 3, target: panel.locator('.srch-item.active') },
      ],
    }
  },

  'interface-new-menu': async ({ page, helpers }) => {
    // opened from Settings, whose page header has nothing under the menu (on the dashboard, its own three buttons
    // would show cut off on both sides of the menu)
    await helpers.goto('/settings/clinic')
    await page.locator('[data-qa="tab-clinic"] .card').first().waitFor()
    const button = page.locator(NEW_BUTTON)
    await button.click()
    const menu = page.locator('[role="menu"]').last()
    await menu.waitFor()
    await rest(page)
    await helpers.settle(300)
    return {
      el: [button, menu, page.locator('.topbar-actions')], pad: 16,
      markers: [
        { n: 1, target: button },
        { n: 2, target: menu.getByRole('menuitem').first() },
      ],
    }
  },

  'interface-notifications': async ({ page, helpers }) => {
    await dashboardReady(page, helpers)
    const bell = page.getByRole('button', { name: await helpers.t('nav.notifications') })
    await bell.click()
    await page.locator('.ntf-group').first().waitFor()
    await rest(page)
    await helpers.settle(900)
    const today = await group(page, helpers, 'search.g.today')
    const unconfirmed = await group(page, helpers, 'search.g.unconfirmed')
    return {
      // the open panel covers the bell (it sits on the same side of the top bar): 1 marks the panel the bell opened
      markers: [
        { n: 1, target: page.locator('.drawer .drawer-title'), place: 'after-content' },
        { n: 2, target: today.locator('.ntf-row').first() },
        { n: 3, target: unconfirmed.locator('.ntf-action').first(), highlight: true },
        { n: 4, target: page.locator('.ntf-more').first(), place: 'after-content' },
      ],
    }
  },

  'interface-phone-home': async ({ page, helpers }) => {
    await dashboardReady(page, helpers)
    await helpers.settle(300)
    return {
      markers: [
        { n: 1, target: page.locator('.app-bottomnav'), place: 'top-start' },
        { n: 2, target: page.locator('.app-bottomnav .bn-item').last() },
        { n: 3, target: page.locator('.topbar-actions .show-mobile') },
      ],
    }
  },

  'interface-phone-more': async ({ page, helpers }) => {
    await dashboardReady(page, helpers)
    await page.locator('.app-bottomnav .bn-item').last().click()
    await page.locator('.more-user').waitFor()
    await helpers.settle(500)
    return { markers: [{ n: 2, target: page.locator('.more-user'), highlight: true, place: 'top-start' }] }
  },

  'interface-dark': async ({ page, helpers }) => {
    await helpers.goto('/settings/preferences')
    await page.locator('[data-theme-option="dark"]').click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' || document.documentElement.classList.contains('dark'), null, { timeout: 5000 }).catch(() => {})
    await helpers.noToasts()
    await helpers.goto('/')
    await rest(page)
    await dashboardReady(page, helpers)
    await helpers.settle(500)
    return {}
  },

  'interface-shortcuts': async ({ page, helpers }) => {
    await helpers.goto('/settings/about')
    const title = await helpers.t('settings.about.shortcuts')
    const card = page.locator('.st-form .card, .st-content .card').filter({ has: page.locator('.st-section-title', { hasText: title }) }).first()
    await card.waitFor()
    return { el: card, pad: 0 }
  },
})
