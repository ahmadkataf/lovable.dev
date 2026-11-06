// Pictures of the guide's topic "getting-started" (server/guide/topics/getting-started.ts); the shot API is documented
// at the top of store/scripts/guide-shots.mjs. The setup-wizard shots run on a new installation (state 'fresh': an
// empty browser profile on #/setup); the sign-in shots on the demo clinic.

/** The label above a form control: markers for fields go just after its text (on the field they would cover it). */
const labelOf = control => control.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " field ")][1]/*[contains(@class, "field-label")]')
const field = (control, n) => ({ n, target: labelOf(control), place: 'after-content' })
const blur = page => page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())

/** The wizard's current step has faded in (a picture taken during the fade comes out pale). */
async function stepShown(page, helpers, step) {
  await page.locator(`.au-step[data-step="${step}"]`).waitFor()
  // the pointer off the card: after a click it rests on a button, or (once the wizard has turned to English and its
  // layout mirrored) on the other language card, which would then show its hover outline
  await page.mouse.move(2, 2)
  await page.waitForFunction(s => {
    const el = document.querySelector(`.au-step[data-step="${s}"]`)
    return el && el.getAnimations({ subtree: true }).every(a => a.playState !== 'running')
  }, step, { timeout: 5000 }).catch(() => {})
  await helpers.settle(600)
}

/** Step 1: Arabic stays as it is; the English shot picks English. Then on to step 2 when asked. */
async function language(page, helpers, lang, { next = true } = {}) {
  await page.locator('[data-lang="ar"]').waitFor()
  if (lang === 'en') await page.locator('[data-lang="en"]').click()
  await stepShown(page, helpers, 'language')
  if (next) {
    await page.locator('[data-qa="next"]').click()
    await stepShown(page, helpers, 'clinic')
  }
}
async function fillClinic(page, helpers) {
  await page.locator('input[name=clinicName]').fill(helpers.pick('عيادة الابتسامة لطب الأسنان', 'Smile Dental Clinic'))
  await page.locator('input[name=clinicPhone]').fill('0944 123 456')
  await page.locator('input[name=clinicAddress]').fill(helpers.pick('دمشق — المزة، شارع الجلاء', 'Al-Jalaa St, Mezzeh, Damascus'))
}
async function fillOwner(page, helpers) {
  await page.locator('input[name=ownerName]').fill(helpers.pick('أحمد الخطيب', 'Ahmad Al-Khatib'))
  await page.locator('input[name=ownerSpecialty]').fill(helpers.pick('طب الأسنان العام', 'General dentistry'))
  await page.locator('#owner-pin').fill(helpers.pin())
  await page.locator('#owner-pin2').fill(helpers.pin())
}
/** From the wizard's first screen to the given step, filled in as the recipes say. */
async function wizardTo(page, helpers, lang, step) {
  await language(page, helpers, lang)
  await fillClinic(page, helpers)
  if (step === 'clinic') return
  await page.locator('[data-qa="next"]').click()
  await stepShown(page, helpers, 'money')
  if (step === 'money') return
  await page.locator('[data-qa="next"]').click()
  await stepShown(page, helpers, 'owner')
  await fillOwner(page, helpers)
  if (step === 'owner') return
  await page.locator('[data-qa="next"]').click()
  await stepShown(page, helpers, 'review')
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
  'getting-started-overview': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await language(page, helpers, lang, { next: false })
      return {}
    },
  },

  'getting-started-android-welcome': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await language(page, helpers, lang, { next: false })
      return {}
    },
  },

  'getting-started-setup-clinic': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await wizardTo(page, helpers, lang, 'clinic')
      await blur(page)
      await helpers.settle(400)
      return {
        el: page.locator('.au-setup'), pad: 0,
        markers: [
          field(page.locator('input[name=clinicName]'), 2),
          { n: 2, target: page.locator('.au-logo-actions .btn').first() },
        ],
      }
    },
  },

  'getting-started-setup-money': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await wizardTo(page, helpers, lang, 'money')
      await blur(page)
      await helpers.settle(300)
      return {
        el: page.locator('.au-setup'), pad: 0,
        markers: [
          field(page.locator('select[name=currency]'), 3),
          field(page.locator('.au-days'), 4),
        ],
      }
    },
  },

  'getting-started-setup-account': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await wizardTo(page, helpers, lang, 'owner')
      await blur(page)
      await helpers.settle(400)
      return {
        el: page.locator('.au-setup'), pad: 0,
        markers: [
          field(page.locator('input[name=ownerName]'), 1),
          field(page.locator('#owner-pin'), 2),
        ],
      }
    },
  },

  'getting-started-setup-review': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await wizardTo(page, helpers, lang, 'review')
      await page.locator('[data-qa="setup-terms"] input[type=checkbox]').check()
      await blur(page)
      await helpers.settle(600)
      const clinicEdit = page.locator('.au-review-card').first().locator('.au-review-head .au-link')
      return {
        el: page.locator('.au-setup'), pad: 0,
        markers: [
          { n: 3, target: clinicEdit },
          { n: 4, target: page.locator('[data-qa="setup-terms"] .lg-accept') },
          { n: 5, target: page.locator('[data-qa="next"]') },
        ],
      }
    },
  },

  'getting-started-restore-link': {
    state: 'fresh',
    run: async ({ page, lang, helpers }) => {
      await language(page, helpers, lang, { next: false })
      // from the question above the two language cards down to the restore box under them, 24 px around (16 above
      // the question: more would show the bottom of the line above it)
      const q = await page.locator('.au-step-body .au-step-sub').boundingBox()
      const box = await page.locator('.au-restore').boundingBox()
      return {
        clip: { x: box.x - 24, y: q.y - 16, width: box.width + 48, height: box.y + box.height + 24 - (q.y - 16) },
        markers: [{ n: 2, target: page.locator('[data-qa="restore"]') }],
      }
    },
  },

  'getting-started-signin-users': async ({ page, helpers }) => {
    await helpers.signOut()
    await helpers.storage({ 'dentora.lastUser': null })
    await page.locator('.au-tile').first().waitFor()
    await helpers.settle(500)
    return { markers: [{ n: 1, target: page.locator('.au-tile[data-user="u-admin"]') }] }
  },

  'getting-started-signin-pin': async ({ page, helpers }) => {
    await helpers.signOut()
    const tile = page.locator('.au-tile[data-user="u-admin"]')
    if (await tile.isVisible().catch(() => false)) await tile.click()
    await page.locator('.pin-pad').waitFor()
    // the tap on the tile leaves the pointer over the keypad (a key would show as pressed)
    await rest(page)
    await helpers.settle(500)
    return {
      markers: [
        { n: 2, target: page.locator('.pin-pad') },
        { n: 3, target: page.locator('[data-qa="change-user"]') },
        { n: 4, target: page.locator('[data-qa="forgot"]') },
      ],
    }
  },

  'getting-started-first-steps': {
    state: 'fresh',
    timeout: 120000,
    run: async ({ page, lang, helpers }) => {
      await wizardTo(page, helpers, lang, 'review')
      await page.locator('[data-qa="setup-terms"] input[type=checkbox]').check()
      await page.locator('[data-qa="next"]').click()
      await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
      await page.locator('[data-testid="dash-schedule"]').waitFor()
      await helpers.noToasts()
      await helpers.settle(1600)
      await rest(page)
      const nav = to => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
      return {
        markers: [
          { n: 1, target: nav('/settings'), place: 'after-content' },
          { n: 2, target: nav('/procedures'), place: 'after-content' },
          // three rows in a row: 1 and 2 just after their names, 3 at the far end of its row so the markers do not touch
          { n: 3, target: nav('/staff'), place: 'inside-end' },
          // under each button, in the gap above the figure cards (a corner badge would sit between two buttons)
          { n: 4, target: page.locator('[data-testid="dash-new-patient"]'), place: 'bottom', dy: -8 },
          { n: 5, target: page.locator('[data-testid="dash-new-apt"]'), place: 'bottom', dy: -8 },
        ],
      }
    },
  },
})
