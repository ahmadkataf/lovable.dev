// Pictures of the guide's topic "prescriptions" (server/guide/topics/prescriptions.ts). The shot API is documented at
// the top of store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// Demo patients are found by their file number or name (record ids differ between runs and languages); the English
// clinic's drug list is the same list in English. Nothing here saves: every dialog stays open for the picture.

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


/** The prescriptions page, loaded (tab 'list' or 'drugs'). */
async function openPage(page, helpers, tab = 'list') {
  await helpers.goto(tab === 'drugs' ? '/prescriptions?tab=drugs' : '/prescriptions')
  await page.locator('.rx-page table tbody tr, .rx-page .rx-mcard').first().waitFor()
  await helpers.settle(300)
}

/** New prescription for the demo patient whose name is typed (Arabic, English); the patient picked from the list. */
async function newRx(page, helpers, name) {
  await openPage(page, helpers)
  await button(page.locator('.page-header').first(), await helpers.t('prescriptions.new')).click()
  const dlg = await dialogReady(page, helpers)
  await dlg.locator('input[role="combobox"]').first().fill(name)
  await page.locator('.rx-opt-patient').filter({ hasText: name }).first().click()
  await dlg.locator('.rx-picked').waitFor()
  return dlg
}
/** Types in the drug search and presses Enter (adds the first drug found). */
async function addDrug(page, dlg, text) {
  const search = dlg.locator('.rx-drug-search input')
  await search.fill(text)
  await page.locator('.rx-opt-drug').first().waitFor()
  await page.waitForTimeout(150)
  await search.press('Enter')
  await page.waitForTimeout(250)
}
const diagnosis = dlg => dlg.locator('.rx-form-top input').last()

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
  'prescriptions-list': async ({ page, helpers }) => {
    await openPage(page, helpers)
    return {}
  },

  'prescriptions-form': async ({ page, helpers }) => {
    const dlg = await newRx(page, helpers, helpers.pick('حسام مارديني', 'Hussam Mardini'))
    await diagnosis(dlg).fill(helpers.pick('خراج ذروي حاد — السن 37', 'Acute apical abscess — tooth 37'))
    await addDrug(page, dlg, helpers.pick('أموكسيسيلين', 'Amoxicillin'))
    await addDrug(page, dlg, helpers.pick('إيبوبروفين', 'Ibuprofen'))
    await blur(page)
    await fitDialog(page, helpers, 1250)
    // the suggestion list closed (blur), so both medicine lines show whole with their dose fields under marker 5
    await page.locator('.rx-opt-drug').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    await dlg.locator('.rx-row').nth(1).waitFor()
    await page.waitForTimeout(300)
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(2, dlg, await helpers.t('patient')),
        atLabel(3, dlg, await helpers.t('doctor')),
        atLabel(3, dlg, await helpers.t('date')),
        atLabel(3, dlg, await helpers.t('prescriptions.form.diagnosis')),
        { n: 4, target: dlg.locator('.rx-drug-search input') },
        // on the first line's grid of fields, not beside the Medicines count badge (it would read as a marker)
        { n: 5, target: dlg.locator('.rx-row').first() },
        { n: 6, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },

  'prescriptions-allergy': async ({ page, helpers }) => {
    const dlg = await newRx(page, helpers, helpers.pick('لمى مازن', 'Lama Mazen'))
    await diagnosis(dlg).fill(helpers.pick('التهاب لب حاد في السن 36', 'Acute pulpitis, tooth 36'))
    await addDrug(page, dlg, helpers.pick('أموكس', 'Amox'))
    await addDrug(page, dlg, helpers.pick('باراسيتامول', 'Paracetamol'))
    await dlg.locator('.modal-title').click()
    await blur(page)
    await fitDialog(page, helpers, 1250)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 1, target: dlg.locator('.rx-allergy'), place: 'after-content' },
        { n: 3, target: dlg.locator('.rx-row-warn').first() },
      ],
    }
  },

  'prescriptions-allergy-confirm': async ({ page, helpers }) => {
    const dlg = await newRx(page, helpers, helpers.pick('لمى مازن', 'Lama Mazen'))
    await diagnosis(dlg).fill(helpers.pick('التهاب لب حاد في السن 36', 'Acute pulpitis, tooth 36'))
    await addDrug(page, dlg, helpers.pick('أموكس', 'Amox'))
    await addDrug(page, dlg, helpers.pick('باراسيتامول', 'Paracetamol'))
    await dlg.locator('.modal-title').click()
    await dlg.locator('.modal-footer .btn-primary').click()
    const confirm = page.locator('[role="dialog"]').last()
    await confirm.filter({ hasText: await helpers.t('prescriptions.allergy.confirmTitle') }).waitFor()
    await page.waitForTimeout(350)
    return {
      el: confirm, pad: 0,
      markers: [
        { n: 4, target: button(confirm, await helpers.t('prescriptions.allergy.review')), place: 'top' },
        { n: 4, target: button(confirm, await helpers.t('prescriptions.allergy.confirmSave')), place: 'top' },
      ],
    }
  },

  'prescriptions-sheet': async ({ page, helpers }) => {
    await openPage(page, helpers)
    await page.locator('.rx-page table tbody tr').first().locator('td').first().click()
    const dlg = await dialogReady(page, helpers)
    await blur(page)
    await fitDialog(page, helpers)
    const foot = dlg.locator('.modal-footer')
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: foot.locator('.btn-primary'), place: 'top' },
        { n: 3, target: button(foot, await helpers.t('whatsapp')), place: 'top' },
        { n: 4, target: button(foot, await helpers.t('edit')), place: 'top' },
        { n: 4, target: button(foot, await helpers.t('duplicate')), place: 'top' },
      ],
    }
  },

  'prescriptions-phone': async ({ page, helpers }) => {
    await openPage(page, helpers)
    await page.locator('.rx-mcard').first().click()
    await helpers.dialog().waitFor()
    await page.waitForTimeout(700)   // the sheet slides up
    await helpers.settle(200)
    return {}
  },

  'prescriptions-patient-tab': async ({ page, helpers }) => {
    await openTab(page, helpers, 18, 'prescriptions')
    await page.locator('.rx-ptab .rx-pitem').first().waitFor()
    const item = page.locator('.rx-ptab .rx-pitem').first()
    return {
      markers: [
        { n: 1, target: page.locator('.pt-tabs [role="tab"]').filter({ hasText: await helpers.t('patients.tab.prescriptions') }).first(), place: 'bottom' },   // on the blank top of the card under it
        { n: 2, target: item.locator('.rx-actions button').nth(0) },
        { n: 3, target: item.locator('.rx-actions button').nth(1) },
        { n: 4, target: button(page.locator('.rx-ptab'), await helpers.t('prescriptions.new')) },
      ],
    }
  },

  'prescriptions-drugs': async ({ page, helpers }) => {
    await openPage(page, helpers, 'drugs')
    const row = page.locator('.rx-page table tbody tr').first()
    return {
      markers: [
        { n: 2, target: button(page.locator('.rx-page'), await helpers.t('prescriptions.drugs.add')), place: 'top' },
        { n: 4, target: row.locator('.rx-drug-cell') },
        // table cells are painted white, which the automatic placement reads as content: places set by hand
        { n: 5, target: row.locator('.switch'), place: 'start' },
        { n: 5, target: row.locator('.rx-del'), place: 'top' },
      ],
    }
  },

  'prescriptions-drug-form': async ({ page, helpers }) => {
    await openPage(page, helpers, 'drugs')
    await page.locator('.rx-page table tbody tr').filter({ hasText: helpers.pick('أموكسيسيلين', 'Amoxicillin') }).first().locator('td').first().click()
    const dlg = await dialogReady(page, helpers)
    await blur(page)
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(2, dlg, await helpers.t('prescriptions.drugs.name')),
        atLabel(2, dlg, await helpers.t('prescriptions.drugs.nameEn')),
        atLabel(2, dlg, await helpers.t('prescriptions.drugs.form')),
        atLabel(2, dlg, await helpers.t('prescriptions.drugs.strength')),
        { n: 3, target: dlg.locator('.form-section-title').filter({ hasText: await helpers.t('prescriptions.drugs.defaults') }), place: 'after-content' },
        { n: 4, target: dlg.locator('.modal-footer .btn-primary'), place: 'top' },
      ],
    }
  },
})
