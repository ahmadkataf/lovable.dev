// Pictures of the guide's topic "staff" (server/guide/topics/staff.ts); the shot API is documented at the top of
// store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin.
// The demo team (u-admin, u-doc2, u-rec, and the demo's second doctor) all have PIN 1234, stored the old way by
// seedAndLogin, so the sign-in screen does not submit by itself after 4 digits: type the PIN, then press Enter.
// Nothing is saved: dialogs are filled and pictured, and the runner restores the page (and data, if it changed) after.

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
const blur = page => page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())

/** On the sign-in screen: Switch user (when shown), then the tile of `id`. */
async function pickUser(page, id) {
  await page.locator('.au-login-card').waitFor()
  const change = page.locator('[data-qa="change-user"]')
  if (await change.isVisible().catch(() => false)) await change.click()
  await page.locator(`[data-user="${id}"]`).click()
  await page.waitForTimeout(300)
}
/** On the sign-in screen: picks `id`, types the PIN and presses Enter, then waits for the app. */
async function signInWithPin(page, helpers, id) {
  await pickUser(page, id)
  await page.keyboard.type(helpers.pin())
  await page.keyboard.press('Enter')
  await page.waitForURL(u => !/#\/login/.test(String(u)), { timeout: 15000 })
  await page.locator('.app-topbar').first().waitFor()
  await helpers.settle(500)
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
 * edges. Its own rounded corners are kept (made transparent).
 */
async function snug(loc) {
  const b = await loc.boundingBox()
  const radius = await loc.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0)
  const x = Math.ceil(b.x), y = Math.ceil(b.y)
  return { el: { x, y, width: Math.floor(b.x + b.width) - x, height: Math.floor(b.y + b.height) - y }, pad: 0, round: radius, grow: false }
}
/** A marker just after the text of the label (in `scope`) whose text is the app's `key`. */
async function label(scope, helpers, key, n) {
  return { n, target: scope.locator('.field-label', { hasText: await helpers.t(key) }).first(), place: 'after-content' }
}

/** Opens the Staff page and waits for the member cards. */
async function open(page, helpers) {
  await helpers.goto('/staff')
  await page.locator('[data-qa="staff-grid"] [data-user]').first().waitFor()
  await helpers.settle(500)
}
/** Opens the ⋮ menu of member `id` and returns the open menu. */
async function memberMenu(page, id) {
  await page.locator(`[data-qa="staff-grid"] [data-user="${id}"] [data-qa="member-menu"]`).click()
  const menu = page.locator('[role="menu"]').last()
  await menu.locator('[role="menuitem"]').first().waitFor()
  return menu
}

export const shots = atRest({
  'staff-overview': async ({ page, helpers }) => {
    // two sign-ins today, so the sign-in log shows how it reads
    await helpers.lock()
    await signInWithPin(page, helpers, 'u-rec')
    await helpers.lock()
    await signInWithPin(page, helpers, 'u-admin')
    await open(page, helpers)
    await rest(page)
    return {}
  },

  'staff-matrix': async ({ page, helpers }) => {
    await open(page, helpers)
    const card = page.locator('[data-qa="matrix"]')
    await helpers.scrollTo(card)
    await rest(page)
    return { el: card, pad: 12 }
  },

  'staff-add': async ({ page, helpers }) => {
    await open(page, helpers)
    await page.locator('[data-qa="add-member"]').click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await dlg.locator('input[name=name]').fill(helpers.pick('رنا سليمان', 'Rana Suleiman'))
    await dlg.locator('select[name=role]').selectOption('assistant')
    await dlg.locator('#staff-pin').fill('2468')
    await dlg.locator('#staff-pin2').fill('2468')
    // the whole dialog: the window grows so its body shows without a scrollbar
    await fitDialog(page, helpers, dlg)
    await blur(page)
    return {
      ...(await snug(dlg)),
      markers: [
        await label(dlg, helpers, 'staff.name', 2),
        await label(dlg, helpers, 'staff.specialty', 3),
        await label(dlg, helpers, 'staff.role', 4),
        { n: 5, target: dlg.locator('.au-colors') },
        { n: 6, target: dlg.locator('[data-qa="save-member"]'), place: 'top' },
      ],
    }
  },

  'staff-menu': async ({ page, helpers }) => {
    await open(page, helpers)
    // a card of the first row, so the open menu stays over the cards (on the last row it would hang over the panels below)
    const menu = await memberMenu(page, 'u-doc2')
    await helpers.settle(400)
    await rest(page)
    return { el: [page.locator('[data-qa="staff-grid"]'), menu], pad: 12 }
  },

  'staff-delete': async ({ page, helpers }) => {
    await open(page, helpers)
    const menu = await memberMenu(page, 'u-doc2')
    await menu.getByRole('menuitem', { name: await helpers.t('staff.deleteMember') }).click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await helpers.settle(800)
    await rest(page)
    return snug(dlg)
  },

  'staff-locked': async ({ page, helpers }) => {
    await helpers.lock()
    await pickUser(page, 'u-doc2')
    for (let i = 0; i < 5; i++) {
      await page.keyboard.type('9999')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(2500)
    }
    await rest(page)
    // the clinic's name and the sign-in card (the rest of the window is empty)
    return { el: [page.locator('.au-login-brand'), page.locator('.au-login-card')], pad: 24 }
  },

  'staff-phone-more': async ({ page, helpers }) => {
    await page.locator('.app-bottomnav .bn-item').last().tap()
    const user = page.locator('.more-user')
    await user.waitFor()
    await helpers.settle(500)
    return {
      markers: [
        { n: 2, target: user.getByRole('button', { name: await helpers.t('nav.lock') }) },
        { n: 3, target: user.getByRole('button', { name: await helpers.t('nav.logout') }) },
      ],
    }
  },

  'staff-forgot': async ({ page, helpers }) => {
    await helpers.lock()
    await pickUser(page, 'u-admin')
    await page.locator('[data-qa="forgot"]').click()
    await page.locator('[data-qa="forgot-box"]').waitFor()
    await helpers.settle(500)
    await rest(page)
    return {
      el: page.locator('.au-login-card'), pad: 16,
      markers: [
        { n: 1, target: page.locator('[data-qa="forgot"]') },
        { n: 2, target: page.locator('.au-device-row button') },
        { n: 3, target: page.locator('[data-qa="have-reset-code"]') },
      ],
    }
  },

  'staff-reset-code': async ({ page, helpers }) => {
    await helpers.lock()
    await pickUser(page, 'u-admin')
    await page.locator('[data-qa="forgot"]').click()
    await page.locator('[data-qa="have-reset-code"]').click()
    const dlg = helpers.dialog()
    await dlg.waitFor()
    await helpers.settle(700)
    await blur(page)
    return {
      ...(await snug(dlg)),
      markers: [
        await label(dlg, helpers, 'auth.reset.codeLabel', 3),
        { n: 3, target: dlg.locator('[data-qa="reset-check"]'), place: 'top' },
      ],
    }
  },
})
