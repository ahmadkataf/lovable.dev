// Pictures of the guide's topic "billing" (server/guide/topics/billing.ts). The shot API is documented at the top of
// store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// Demo patients are found by their file number and invoices by their number (the same in both languages; record ids
// are not). Nothing here saves: every dialog stays open for the picture and the runner reloads the page after it.

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exactly = label => new RegExp(`^\\s*${esc(label)}\\s*\\*?\\s*$`)
/** The label (label.field-label) of the field named `label` inside `scope`. */
const labelOf = (scope, label) => scope.locator('label.field-label').filter({ hasText: exactly(label) }).first()
/** A marker just after a field's label text: "② Amount". */
const atLabel = (n, scope, label, extra = {}) => ({ n, target: labelOf(scope, label), place: 'after-content', ...extra })
/** A button by its visible text (icons have no text; a count after the text is allowed). */
const button = (scope, text) => scope.locator('button, a.btn').filter({ hasText: new RegExp(`^\\s*${esc(text)}\\s*\\(?\\d*\\)?\\s*$`) }).first()
/** Takes the focus off the fields (no focus ring or selected text in the picture). */
const blur = page => page.evaluate(() => document.activeElement?.blur?.())

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

/**
 * A dialog whose content scrolls (a long statement): makes the window a little shorter so the dialog's scrolling
 * area ends exactly under a whole table row instead of cutting one in half.
 */
async function endOnRow(page, helpers, rows) {
  const dlg = helpers.dialog()
  const gap = await dlg.evaluate((el, sel) => {
    const body = el.querySelector('.modal-body').getBoundingClientRect()
    const bottoms = [...el.querySelectorAll(sel)].map(r => r.getBoundingClientRect().bottom).filter(b => b <= body.bottom - 1)
    return bottoms.length ? body.bottom - Math.max(...bottoms) : 0
  }, rows)
  if (gap > 1) {
    const { width, height } = page.viewportSize()
    await helpers.viewport({ width, height: Math.floor(height - gap + 1) })
    await page.waitForTimeout(200)
  }
}

async function dialogReady(page, helpers) {
  const dlg = helpers.dialog()
  await dlg.waitFor()
  await page.waitForTimeout(350)   // the opening animation
  await helpers.settle(200)
  return dlg
}

/** Opens a period of the invoices or payments page ('today', 'thisMonth'…) and waits for its figures. */
async function period(page, helpers, key) {
  await page.locator('.bl-period .segmented button').filter({ hasText: exactly(await helpers.t(key)) }).click()
  await helpers.settle(400)
  await page.locator('.bl-stats .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
}

/** Opens invoice `number` (e.g. 'INV-000287'), at the top of its page. */
async function openInvoice(page, helpers, number) {
  const id = await helpers.db(async (db, n) => (await db.invoices.where('number').equals(n).first())?.id, number)
  if (!id) throw new Error(`no demo invoice ${number}`)
  await helpers.goto(`/invoices/${id}`)
  await page.locator('.bl-summary').waitFor()
  await helpers.settle(300)
}
const INV = 'INV-000287'

/** The invoice form for demo patient `name` (Arabic, English), with the From treatments panel open. */
async function invoiceForm(page, helpers) {
  await helpers.goto('/invoices')
  await button(page.locator('.page-header, .page').first(), await helpers.t('billing.newInvoice')).click()
  const dlg = await dialogReady(page, helpers)
  const name = helpers.pick('غادة خوري', 'Ghada Khoury')
  await dlg.locator('.bl-picker input').fill(name)
  await dlg.locator('.bl-option').filter({ hasText: name }).first().click()
  await dlg.locator('.bl-picked').waitFor()
  await dlg.locator('.bl-panel .bl-panel-item').first().waitFor()
  await helpers.settle(200)
  return dlg
}

/** Opens a patient's file (by file number) on `tab`, the tab bar just under the top bar. */
async function openTab(page, helpers, fileNo, tab, { offset = 0 } = {}) {
  const p = await helpers.patient(String(fileNo))
  await helpers.goto(`/patients/${p.id}?tab=${tab}`)
  await page.locator('.pt-hero .pt-hero-name').waitFor()
  await page.locator('.bl-tab .bl-stats .stat-card').first().waitFor()
  await page.locator('.bl-tab .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(300)
  await helpers.scrollTo(page.locator('.pt-tabs'), { offset })
  return p
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
  'billing-invoices': async ({ page, helpers }) => {
    await helpers.goto('/invoices')
    await period(page, helpers, 'thisMonth')
    await page.locator('.bl-table tbody tr').first().waitFor()
    await helpers.settle(300)
    return {}
  },

  'billing-invoice-form': async ({ page, helpers }) => {
    const dlg = await invoiceForm(page, helpers)
    await blur(page)
    await fitDialog(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: dlg.locator('.bl-picked') },
        { n: 3, target: dlg.locator('.bl-panel .btn-primary') },
        { n: 4, target: button(dlg, await helpers.t('billing.addFromProcedures')), place: 'top' },
        { n: 4, target: button(dlg, await helpers.t('billing.addFreeLine')), place: 'top' },
        { n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'billing-invoice-lines': async ({ page, helpers }) => {
    const dlg = await invoiceForm(page, helpers)
    await dlg.locator('.bl-panel .btn-primary').click()
    await button(dlg, await helpers.t('billing.addFromProcedures')).click()
    await dlg.locator('.bl-panel input').fill(helpers.pick('فلورايد', 'Fluoride'))
    await dlg.locator('.bl-panel .bl-panel-item').filter({ hasText: helpers.pick('ورنيش', 'varnish') }).first().click()
    await dlg.locator('.bl-panel .bl-panel-head button[aria-label]').last().click()
    await dlg.locator('.bl-panel').waitFor({ state: 'detached' })
    await dlg.locator('.bl-totals-panel input').first().fill('5')
    await blur(page)
    await fitDialog(page, helpers)
    const line = dlg.locator('.bl-line').first()
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 5, target: [line.locator('.bl-a-tooth'), line.locator('.bl-a-disc')], place: 'bottom' },
        { n: 5, target: dlg.locator('.bl-totals-panel .bl-tp-row').nth(1).locator('span').first(), place: 'end' },
        { n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
        { n: 6, target: dlg.locator('.modal-footer .btn-secondary'), place: 'top' },
      ],
    }
  },

  'billing-invoice-page': async ({ page, helpers }) => {
    await openInvoice(page, helpers, INV)
    const actions = page.locator('.page-header').first()
    return {
      markers: [
        { n: 1, target: button(actions, await helpers.t('billing.recordPayment')) },
        { n: 2, target: button(actions, await helpers.t('print')), place: 'bottom' },
        { n: 3, target: button(actions, await helpers.t('whatsapp')), place: 'bottom' },
        { n: 4, target: actions.locator('.menu-anchor button'), place: 'bottom' },
      ],
    }
  },

  'billing-payment': async ({ page, helpers }) => {
    await openInvoice(page, helpers, INV)
    await button(page.locator('.page-header').first(), await helpers.t('billing.recordPayment')).click()
    const dlg = await dialogReady(page, helpers)
    await dlg.locator('.bl-amount input').fill('700')
    await blur(page)
    await fitDialog(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 3, target: dlg.locator('.bl-target.active') },
        atLabel(4, dlg, await helpers.t('amount')),
        atLabel(4, dlg, await helpers.t('billing.method')),
        { n: 5, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'billing-receipt': async ({ page, helpers }) => {
    await helpers.goto('/payments')
    await period(page, helpers, 'today')
    const row = page.locator('.bl-table tbody tr').filter({ hasText: 'R-000378' }).first()
    await row.locator('button').first().click()
    const dlg = await dialogReady(page, helpers)
    await fitDialog(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [{ n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' }],
    }
  },

  'billing-refund': async ({ page, helpers }) => {
    await openInvoice(page, helpers, INV)
    await page.locator('.page-header').first().locator('.menu-anchor button').click()
    await page.getByRole('menuitem', { name: await helpers.t('billing.refundOnInvoice') }).click()
    const dlg = await dialogReady(page, helpers)
    await dlg.locator('.bl-amount input').fill('100')
    await blur(page)
    // the whole dialog (every paid invoice of the patient) is too tall for one picture: from "Refund from" down
    await helpers.viewport({ width: 1440, height: 1180 })
    await dlg.locator('.modal-body').evaluate(body => {
      const label = [...body.querySelectorAll('.bl-label')].pop()
      body.scrollTop += label.getBoundingClientRect().top - body.getBoundingClientRect().top - 16
    })
    await page.waitForTimeout(300)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 3, target: dlg.locator('.bl-amount .field-hint') },
        { n: 4, target: dlg.locator('.bl-credit-note') },
        { n: 5, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'billing-payments': async ({ page, helpers }) => {
    await helpers.goto('/payments')
    await period(page, helpers, 'today')
    await page.locator('.bl-table tbody tr').first().waitFor()
    await helpers.settle(300)
    return {
      markers: [
        { n: 2, target: page.locator('.bl-filters .bl-search input'), place: 'inside-end' },
        { n: 2, target: page.locator('.bl-filters .bl-by select') },
        { n: 2, target: page.locator('.bl-filters .bl-chips') },
        { n: 3, target: page.locator('.bl-table tbody tr').first().locator('button').first(), place: 'start' },
        { n: 4, target: button(page.locator('.page-header').first(), await helpers.t('billing.payments.cashReport')) },
      ],
    }
  },

  'billing-cash-report': async ({ page, helpers }) => {
    await helpers.goto('/payments')
    await period(page, helpers, 'today')
    await button(page.locator('.page-header').first(), await helpers.t('billing.payments.cashReport')).click()
    const dlg = await dialogReady(page, helpers)
    await fitDialog(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [{ n: 4, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' }],
    }
  },

  'billing-account': async ({ page, helpers }) => {
    // a little of the patient's header above the tabs leaves room for the marker of the Account tab
    await openTab(page, helpers, 19, 'billing', { offset: -56 })
    const acts = page.locator('.bl-tab-actions')
    return {
      markers: [
        { n: 1, target: page.locator('.pt-tabs [role="tab"]').filter({ hasText: await helpers.t('patients.tab.billing') }).first(), place: 'top' },
        { n: 2, target: button(acts, await helpers.t('billing.newInvoice')) },
        { n: 2, target: button(acts, await helpers.t('nav.newPayment')) },
        { n: 3, target: button(acts, await helpers.t('billing.account.statement')) },
      ],
    }
  },

  'billing-statement': async ({ page, helpers }) => {
    await openTab(page, helpers, 19, 'billing')
    await button(page.locator('.bl-tab-actions'), await helpers.t('billing.account.statement')).click()
    const dlg = await dialogReady(page, helpers)
    await fitDialog(page, helpers)
    await endOnRow(page, helpers, 'tbody tr')
    return {
      el: dlg, pad: 0,
      markers: [{ n: 4, target: dlg.locator('.modal-footer .btn-primary'), place: 'start' }],
    }
  },

  'billing-phone': async ({ page, helpers }) => {
    await openInvoice(page, helpers, INV)
    return {}
  },
})
