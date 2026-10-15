// Pictures of the guide's topic "chart" (server/guide/topics/chart.ts). The shot API is documented at the top of
// store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// The chart patient is demo file #19 (the same file number in both languages; record ids differ). Every shot starts
// from the demo's own chart: the runner restores the database after a shot that wrote to it.

/** Opens patient #19 on the Dental chart tab, the chart drawn and its figures loaded. */
async function openChart(page, helpers) {
  const p = await helpers.patient('19')
  await helpers.goto(`/patients/${p.id}?tab=chart`)
  await page.locator('[data-testid="chart-tab"] .ch-card').waitFor()
  await page.locator('[data-tooth="36"]').first().waitFor()
  await page.locator('.ch-tab .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(400)
  return p
}
const exactly = label => new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?\\s*$`)
const tooth = (page, n) => page.locator(`.ch-canvas [data-tooth="${n}"]`).first()

/** The profile's tab bar 6 px under the top bar, as the "chart" screen of store/scripts/shoot.mjs. */
const underTopBar = (page, helpers) => helpers.scrollTo(page.locator('.pt-tabs'), { offset: -6 })

/** Opens a tooth's panel and waits for it to finish sliding in. */
async function openTooth(page, helpers, n) {
  await tooth(page, n).click()
  const panel = helpers.dialog()
  await panel.locator('.ch-panel').waitFor()
  await helpers.settle(600)
  return panel
}

/** The print rules of the app's style sheets, as one screen style sheet (the print preview without print media). */
async function printRulesOnScreen(page) {
  await page.evaluate(() => {
    let css = ''
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const r of rules) if (r instanceof CSSMediaRule && /\bprint\b/.test(r.media.mediaText)) for (const inner of r.cssRules) if (!(inner instanceof CSSPageRule)) css += inner.cssText + '\n'
    }
    const s = document.createElement('style'); s.dataset.guide = 'print'; s.textContent = css; document.head.appendChild(s)
  })
}

const shotList = {
  'chart-overview': async ({ page, helpers }) => {
    await openChart(page, helpers)
    await underTopBar(page, helpers)
    return {}
  },

  'chart-tooth-current': async ({ page, helpers }) => {
    await openChart(page, helpers)
    await underTopBar(page, helpers)
    // tooth 11, not 36: the panel covers the chart's end side (the left half in Arabic, the right half in English),
    // and the central incisors are the teeth left in view in both languages
    const panel = await openTooth(page, helpers, 11)
    return {
      markers: [
        { n: 1, target: tooth(page, 11), place: 'bottom' },
        { n: 2, target: panel.locator('.ch-section-title').first() , place: 'after-content' },
      ],
    }
  },

  'chart-tooth-form': async ({ page, helpers }) => {
    await openChart(page, helpers)
    await underTopBar(page, helpers)
    const panel = await openTooth(page, helpers, 46)
    await panel.locator('.ch-cond[data-cond="caries"]').click()
    const chip = s => panel.locator('.ch-surf-chip').filter({ hasText: `(${s})` })
    await chip('O').click()
    await chip('D').click()
    const note = panel.locator('.ch-form textarea')
    await note.fill(helpers.pick('تسوس عميق قريب من اللب', 'Deep caries close to the pulp'))
    await panel.locator('.ch-panel-title').click().catch(() => {})
    await helpers.settle(500)
    return {
      el: panel, pad: 0,
      markers: [
        { n: 3, target: panel.locator('.ch-cond[data-cond="caries"]') },
        { n: 4, target: panel.locator('.ch-group-label').filter({ hasText: exactly(await helpers.t('chart.surfaces')) }), place: 'after-content' },
        { n: 5, target: panel.locator('.ch-form label.field-label').filter({ hasText: exactly(await helpers.t('chart.note')) }), place: 'after-content' },
        { n: 6, target: panel.locator('.drawer-footer .btn-primary') },
      ],
    }
  },

  'chart-quick-paint': async ({ page, helpers }) => {
    await openChart(page, helpers)
    const paintTab = page.locator('.ch-toolbar .segmented').first().getByRole('tab', { name: await helpers.t('chart.mode.paint') })
    await paintTab.click()
    await page.locator('[data-testid="ch-paint-hint"]').waitFor()
    await page.locator('.ch-chip[data-cond="filled"]').click()
    await page.locator('.ch-canvas [data-tooth="47"] [data-s="O"]').first().click()
    await page.locator('.ch-canvas [data-tooth="47"] [data-s="M"]').first().click()
    await page.locator('.ch-chip[data-cond="crown"]').click()
    await tooth(page, 45).click()
    await helpers.noToasts()
    await page.mouse.move(1, 1)
    await helpers.settle(500)
    await helpers.scrollTo(page.locator('.ch-card'))
    return {
      el: page.locator('.ch-card'), pad: 0,
      markers: [
        { n: 1, target: paintTab },
        { n: 2, target: page.locator('.ch-chip[data-cond="crown"]') },
        { n: 3, target: tooth(page, 45) },
        { n: 5, target: page.locator('[data-testid="ch-paint-hint"] button') },
      ],
    }
  },

  'chart-history': async ({ page, helpers }) => {
    await openChart(page, helpers)
    await page.locator('.ch-toolbar').getByRole('button', { name: await helpers.t('chart.history') }).click()
    const card = page.locator('[data-testid="ch-history"]')
    await card.waitFor()
    await helpers.settle(500)
    const abscess = card.locator('.ch-tl.is-inactive').filter({ has: page.locator('.ch-tl-mark', { hasText: /^36$/ }) }).filter({ has: page.locator('.ch-tl-name', { hasText: await helpers.t('cond.abscess') }) }).first()
    await abscess.waitFor()
    await helpers.scrollTo(card)
    await page.mouse.move(1, 1)
    const day = abscess.locator('xpath=..')
    const cb = await card.boundingBox(), db = await day.boundingBox()
    const height = db.y + db.height + 12 - cb.y
    if (cb.y + height > 900) await helpers.viewport({ width: 1440, height: Math.ceil(cb.y + height + 24) })
    const cb2 = await card.boundingBox(), db2 = await day.boundingBox()
    return {
      clip: { x: cb2.x - 12, y: cb2.y - 12, width: cb2.width + 24, height: db2.y + db2.height + 12 - (cb2.y - 12) },
      markers: [
        { n: 2, target: abscess.locator('.ch-tl-head .badge').last() },
        { n: 4, target: abscess.getByRole('button', { name: await helpers.t('chart.restoreRecord') }) },
      ],
    }
  },

  'chart-print': async ({ page, helpers }) => {
    await openChart(page, helpers)
    await page.evaluate(() => { window.print = () => {} })
    await page.locator('.ch-toolbar').getByRole('button', { name: await helpers.t('chart.printChart') }).click()
    const sheet = page.locator('.ch-print-sheet')
    await sheet.waitFor({ state: 'attached' })
    await printRulesOnScreen(page)
    // the page's margin (@page 12 mm) around the sheet, on white paper
    await helpers.css('body.ch-printing { padding: 45px !important; background: #fff !important; }')
    await helpers.viewport({ width: 794, height: 1123 })
    await sheet.waitFor()
    await helpers.settle(500)
    return { el: sheet, pad: 24 }
  },

  'chart-phone': async ({ page, helpers, lang }) => {
    // in English the toolbar (Permanent / Mixed / Primary, History, Print, zoom) needs 369 px where a 390 px phone has
    // 324: the zoom button is cut off at the card's edge. The English picture is taken on a 440 px wide phone so the
    // button the text describes shows whole (reported as an app layout issue).
    if (lang === 'en') await helpers.viewport({ width: 440, height: 952 })
    await openChart(page, helpers)
    await helpers.scrollTo(page.locator('.ch-card'))
    return {}
  },

  'chart-phone-tooth': async ({ page, helpers }) => {
    await openChart(page, helpers)
    await helpers.scrollTo(page.locator('.ch-card'))
    await tooth(page, 36).scrollIntoViewIfNeeded()
    const panel = helpers.dialog()
    await tooth(page, 36).click()
    await panel.locator('.ch-panel').waitFor()
    await helpers.settle(700)
    return {}
  },
}

/**
 * The app keeps the patients list's and the calendar's view in sessionStorage for the run, and the runner puts back
 * localStorage only: every shot starts with them cleared (the signed-in user is kept).
 */
async function freshView(page) {
  await page.evaluate(() => { for (const k of Object.keys(sessionStorage)) if (k !== 'dentora.session') sessionStorage.removeItem(k) })
}
// every shot: the views cleared first; the pointer moved off the page's controls before the picture (no hover states)
export const shots = Object.fromEntries(Object.entries(shotList).map(([id, run]) => [id, async ctx => {
  await freshView(ctx.page)
  const target = await run(ctx)
  await ctx.page.mouse.move(1, 1)
  await ctx.page.waitForTimeout(150)
  return target
}]))
