// Pictures of the guide's topic "lab" (server/guide/topics/lab.ts). The shot API is documented at the top of
// store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// Demo patients are found by their file number or name (record ids differ between runs and languages), lab orders by
// their patient's file number on the board (#7 in progress, #20 remake, #55 sent, #36 draft on 11 Oct 2026). Nothing
// here saves: every dialog stays open for the picture.

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


/** The lab board, loaded. */
async function openBoard(page, helpers) {
  await helpers.goto('/lab')
  await page.locator('.lab-board table tbody tr').first().waitFor()
  await page.locator('.lab-stats .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(300)
}
/** The board row of the order of demo patient file #`fileNo`. */
const orderRow = (page, fileNo) => page.locator('.lab-board table tbody tr').filter({ has: page.locator('.cell-sub.num').filter({ hasText: new RegExp(`^#${fileNo}$`) }) }).first()

/** New lab order for "Anas Mazen" (#55), filled in as the recipe of lab-form says. */
async function newOrder(page, helpers) {
  await openBoard(page, helpers)
  await button(page.locator('.page-header').first(), await helpers.t('lab.new')).click()
  const dlg = await dialogReady(page, helpers)
  const name = helpers.pick('أنس مازن', 'Anas Mazen')
  await dlg.locator('input[role="combobox"]').first().fill(name)
  await page.locator('.rx-opt-patient').filter({ hasText: name }).first().click()
  await dlg.locator('.rx-picked').waitFor()
  const combo = label => dlg.locator('.field').filter({ has: page.locator('label.field-label').filter({ hasText: label }) }).first().locator('input')
  await combo(exactly(await helpers.t('lab.form.lab'))).fill(helpers.pick('مخبر الشام الرقمي (CAD/CAM)', 'Al-Sham Digital Lab (CAD/CAM)'))
  await combo(await helpers.t('lab.form.shade')).fill('A3')
  await combo(exactly(await helpers.t('lab.form.material'))).fill(helpers.pick('زيركون', 'Zirconia'))
  await dlg.locator('.lab-tooth').filter({ hasText: /^\s*26\s*$/ }).click()
  await dlg.locator('.form-section-title').filter({ hasText: await helpers.t('lab.form.sectionWork') }).click()
  await blur(page)
  await page.waitForTimeout(250)
  return dlg
}

/**
 * Shortens the window so the order form's scrolling body ends just above its "Dates & cost" section (the picture of
 * the first half), or, with `from`, scrolls the body to its end and shortens the window so it starts at that section
 * (the picture of the second half): no field is cut in two at either edge.
 */
async function frame(page, helpers, dlg, { from = false } = {}) {
  const section = dlg.locator('.lab-section').nth(1)
  for (let i = 0; i < 3; i++) {
    await dlg.locator('.modal-body').evaluate((el, end) => { el.scrollTop = end ? el.scrollHeight : 0 }, from)
    await page.waitForTimeout(100)
    const excess = await section.evaluate((sec, start) => {
      const body = sec.closest('.modal-body').getBoundingClientRect(), r = sec.getBoundingClientRect()
      return start ? r.top - body.top - 4 : body.bottom - r.top - 4
    }, from)
    if (Math.abs(excess) < 2) break
    const { width, height } = page.viewportSize()
    await helpers.viewport({ width, height: Math.round(height - excess) })
  }
}

/** Opens a patient's file (by file number) on `tab`, the tab bar just under the top bar (offset: room above it). */
async function openTab(page, helpers, fileNo, tab, { offset = 0 } = {}) {
  const p = await helpers.patient(String(fileNo))
  await helpers.goto(`/patients/${p.id}?tab=${tab}`)
  await page.locator('.pt-hero .pt-hero-name').waitFor()
  await helpers.settle(400)
  await helpers.scrollTo(page.locator('.pt-tabs'), { offset })
  return p
}

export const shots = restMouse({
  'lab-board': async ({ page, helpers }) => {
    await openBoard(page, helpers)
    return {}
  },

  'lab-phone': async ({ page, helpers }) => {
    await helpers.goto('/lab')
    await page.locator('.lab-mcard').first().waitFor()
    await helpers.settle(300)
    await helpers.scrollTo(page.locator('.lab-filters'))
    return {}
  },

  'lab-form': async ({ page, helpers }) => {
    const dlg = await newOrder(page, helpers)
    await frame(page, helpers, dlg)
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(2, dlg, await helpers.t('patient')),
        atLabel(2, dlg, await helpers.t('lab.form.lab')),
        atLabel(3, dlg, await helpers.t('lab.form.type')),
        { n: 3, target: dlg.locator('label.field-label').filter({ hasText: await helpers.t('lab.form.shade') }).first(), place: 'after-content' },
        atLabel(3, dlg, await helpers.t('lab.form.material')),
        { n: 4, target: dlg.locator('.lab-tooth').filter({ hasText: /^\s*26\s*$/ }), place: 'top' },
        { n: 4, target: dlg.locator('.lab-teeth-tools .lab-chip-btn').first(), place: 'start' },
      ],
    }
  },

  'lab-form-dates': async ({ page, helpers }) => {
    const dlg = await newOrder(page, helpers)
    await dlg.locator('.lab-cost input').fill('80')
    const link = dlg.locator('.field').filter({ has: page.locator('label.field-label').filter({ hasText: await helpers.t('lab.form.treatment') }) }).first().locator('select')
    // the plan item "Zirconia crown · 16 — In progress" of this patient
    const value = await link.evaluate(sel => [...sel.options].find(o => o.value && /16/.test(o.textContent) && /زيركون|Zirconia/i.test(o.textContent))?.value)
    if (!value) throw new Error('no zirconia crown on tooth 16 to link the order to')
    await link.selectOption(value)
    await dlg.locator('textarea').fill(helpers.pick('حواف كتف، الصور مرفقة', 'Shoulder margins, photos attached'))
    await blur(page)
    await frame(page, helpers, dlg, { from: true })
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(5, dlg, await helpers.t('lab.form.sent')),
        atLabel(5, dlg, await helpers.t('lab.form.due')),
        { n: 5, target: dlg.locator('.lab-quick-days'), place: 'end' },
        atLabel(6, dlg, await helpers.t('lab.form.cost')),
        { n: 6, target: dlg.locator('label.field-label').filter({ hasText: await helpers.t('lab.form.treatment') }).first(), place: 'after-content' },
        { n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'lab-status': async ({ page, helpers }) => {
    await openBoard(page, helpers)
    const rows = page.locator('.lab-board table tbody tr')
    const advance = fileNo => orderRow(page, fileNo).locator('.lab-advance')
    // the table from its header to the fourth order, with a little of the card's side so the marker of the row menu
    // (the last button of the row) has room beside it
    const head = await page.locator('.lab-board table thead tr').boundingBox()
    const fourth = await rows.nth(3).boundingBox()
    const card = await page.locator('.lab-board').boundingBox()
    const side = 18
    return {
      clip: { x: card.x - side, y: head.y, width: card.width + 2 * side, height: fourth.y + fourth.height - head.y },
      markers: [
        // on the buttons' top corner on the reading side: beside them sits the cost column, close in English
        { n: 1, target: advance(36), place: 'top-start' },
        { n: 2, target: advance(55), place: 'top-start' },
        { n: 3, target: advance(7), place: 'top-start' },
        { n: 5, target: orderRow(page, 20).locator('.menu-anchor button'), place: 'end' },
      ],
    }
  },

  'lab-slip': async ({ page, helpers }) => {
    await openBoard(page, helpers)
    await orderRow(page, 55).locator('.menu-anchor button').click()
    await page.getByRole('menuitem', { name: await helpers.t('lab.action.print') }).click()
    const dlg = await dialogReady(page, helpers)
    await blur(page)
    await fitDialog(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: dlg.locator('.lab-slip-to') },
        { n: 3, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'lab-patient-tab': async ({ page, helpers, lang }) => {
    await openTab(page, helpers, 20, 'lab')
    const item = page.locator('.lab-plist .lab-pitem').first()
    await item.waitFor()
    return {
      markers: [
        { n: 1, target: page.locator('.pt-tabs [role="tab"]').filter({ hasText: await helpers.t('patients.tab.lab') }).first(),
          // under the tab in English is the New lab order button (marker 2): there the marker goes above the tab, a
          // little towards the line's start so it stays clear of the header's "remaining" line
          ...(lang === 'en' ? { place: 'top', dx: -20 } : { place: 'bottom' }) },
        { n: 2, target: button(page.locator('.lab-plist').locator('xpath=ancestor::*[contains(@class,"card")][1]'), await helpers.t('lab.new')), place: 'start' },
        { n: 3, target: item.locator('.lab-advance') },
      ],
    }
  },
})
