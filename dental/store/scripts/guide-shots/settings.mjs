// Pictures of the guide's topic "settings" (server/guide/topics/settings.ts); the shot API is documented at the top
// of store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin.

/** The settings card (.card inside the open section) that holds `inner` (a selector or locator). */
function cardWith(page, inner) {
  return page.locator('.st-form .card').filter({ has: typeof inner === 'string' ? page.locator(inner) : inner })
}
/** The settings card whose section title is the app's text `key`. */
async function cardTitled(page, helpers, key) {
  const title = await helpers.t(key)
  return page.locator('.st-form .card').filter({ has: page.locator('.st-section-title', { hasText: title }) }).first()
}
/** Opens a settings section and waits until its form is there. */
async function open(page, helpers, tab) {
  await helpers.goto(`/settings/${tab}`)
  await page.locator(`[data-qa="tab-${tab}"] .st-form, [data-qa="tab-${tab}"] .card`).first().waitFor()
  await helpers.settle(400)
}
/**
 * The label above a form control (its .field's .field-label). Markers for fields go just after the label's text: on
 * the field itself they would cover what is typed in it, and beside it they would sit on the next field.
 */
const labelOf = control => control.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " field ")][1]/*[contains(@class, "field-label")]')
const field = (control, n) => ({ n, target: labelOf(control), place: 'after-content' })
/** The title of a settings card, for a marker just after it. */
const titled = (card, n) => ({ n, target: card.locator('.st-section-title'), place: 'after-content' })
const blur = page => page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())

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
  'settings-overview': async ({ page, helpers }) => {
    await open(page, helpers, 'clinic')
    const tagline = page.getByLabel(await helpers.t('settings.clinic.tagline'))
    await tagline.fill(helpers.pick('تجميل وزراعة الأسنان', 'Cosmetic & implant dentistry'))
    await blur(page)
    await page.locator('[data-qa="savebar"].dirty').waitFor()
    await helpers.settle(400)
    return {
      markers: [
        { n: 1, target: page.locator('.app-sidebar .nav-item[href$="/settings"]') },
        { n: 2, target: page.locator('.st-nav'), place: 'top-start', dy: 6 },
        { n: 3, target: page.locator('[data-qa="save"]') },
      ],
    }
  },

  'settings-phone': async ({ page, helpers }) => {
    await open(page, helpers, 'clinic')
    return {}
  },

  'settings-clinic-identity': async ({ page, helpers }) => {
    await open(page, helpers, 'clinic')
    const card = cardWith(page, '[data-qa="logo-box"]')
    return {
      el: card, pad: 0,
      markers: [
        { n: 2, target: page.locator('[data-qa="pick-logo"]'), place: 'end' },
        field(page.locator('[data-qa="clinic-name"]'), 3),
      ],
    }
  },

  'settings-clinic-preview': async ({ page, helpers }) => {
    await open(page, helpers, 'clinic')
    const contact = cardWith(page, '[data-qa="clinic-phone"]')
    const preview = cardWith(page, '[data-qa="invoice-preview"]')
    return {
      el: [contact, preview], pad: 0, round: 0,
      markers: [
        field(page.locator('[data-qa="clinic-phone"]'), 4),
        field(page.locator('[data-qa="clinic-country"]'), 5),
        titled(preview, 6),
      ],
    }
  },

  'settings-billing-currency': async ({ page, helpers }) => {
    await open(page, helpers, 'billing')
    const preview = page.locator('[data-qa="billing-preview"]')
    const currency = cardWith(page, '[data-qa="currency"]')
    const decimals = currency.locator('.segmented, [role="radiogroup"]').first()
    return {
      el: [preview, currency], pad: 0, round: 0,
      markers: [
        field(page.locator('[data-qa="currency"]'), 2),
        field(page.locator('[data-qa="currency-symbol"]'), 3),
        field(decimals, 4),
      ],
    }
  },

  'settings-billing-numbering': async ({ page, helpers }) => {
    await open(page, helpers, 'billing')
    const numbering = cardWith(page, '[data-qa="tax"]')
    const notes = await cardTitled(page, helpers, 'settings.bill.print')
    const footer = notes.locator('textarea').first()
    return {
      el: [numbering, notes], pad: 0, round: 0,
      markers: [
        field(page.locator('[data-qa="tax"]'), 1),
        field(page.locator('[data-qa="tax-number"]'), 2),
        field(page.locator('[data-qa="prefix"]'), 3),
        field(page.locator('[data-qa="next-invoice"]'), 4),
        field(footer, 5),
      ],
    }
  },

  'settings-preferences-language': async ({ page, helpers }) => {
    await open(page, helpers, 'preferences')
    const language = cardWith(page, '[data-lang]')
    const months = cardWith(page, '[data-qa="month-style"]')
    return {
      el: [language, months], pad: 0, round: 0,
      markers: [
        titled(language, 2),
        titled(months, 3),
      ],
    }
  },

  'settings-preferences-font': async ({ page, helpers }) => {
    await open(page, helpers, 'preferences')
    const font = cardWith(page, '[data-font="cairo"]')
    const look = cardWith(page, '[data-theme-option="dark"]')
    return {
      el: [font, look], pad: 0, round: 0,
      markers: [
        { n: 4, target: page.locator('[data-font="cairo"]') },
        { n: 5, target: page.locator('[data-theme-option="dark"]') },
      ],
    }
  },

  'settings-preferences-hours': async ({ page, helpers }) => {
    await open(page, helpers, 'preferences')
    const card = cardWith(page, '[data-qa="save-hours"]')
    const friday = card.locator('.st-day').filter({ hasText: helpers.pick('الجمعة', 'Friday') })
    await helpers.scrollTo(card)
    await friday.click()
    await page.locator('[data-qa="save-hours"]:not([disabled])').waitFor()
    await rest(page)
    await blur(page)
    await helpers.settle(300)
    const selects = card.locator('select')
    return {
      el: card, pad: 0,
      markers: [
        { n: 1, target: friday },
        field(page.locator('[data-qa="work-start"]'), 2),
        field(selects.nth(0), 3),
        field(selects.nth(1), 4),
        { n: 5, target: page.locator('[data-qa="save-hours"]') },
      ],
    }
  },

  'settings-auto-lock': async ({ page, helpers }) => {
    await open(page, helpers, 'preferences')
    const card = cardWith(page, '[data-qa="lock-select"]')
    return {
      el: card, pad: 0,
      markers: [
        field(page.locator('[data-qa="lock-select"]'), 1),
        { n: 2, target: page.locator('[data-qa="lock-current"]') },
      ],
    }
  },

  'settings-about-help': async ({ page, helpers }) => {
    await open(page, helpers, 'about')
    return {
      el: page.locator('[data-qa="about-help"]'), pad: 0,
      markers: [{ n: 2, target: page.locator('[data-qa="about-guide"]') }],
    }
  },
  'settings-about': async ({ page, helpers }) => {
    await open(page, helpers, 'about')
    const card = cardWith(page, '[data-qa="about-legal"]')
    return {
      el: card, pad: 0,
      markers: [{ n: 3, target: page.locator('[data-qa="about-privacy"]') }],
    }
  },
})
