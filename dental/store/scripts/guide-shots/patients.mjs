// Pictures of the guide's topic "patients" (server/guide/topics/patients.ts). The shot API is documented at the top
// of store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// Demo patients are found by their file number (the same in both languages; record ids are not).

const exactly = label => new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?\\s*$`)
/** The label (label.field-label) of the field named `label` inside `scope` (the app's text, a required * allowed). */
function labelOf(scope, label) {
  return scope.locator('label.field-label').filter({ hasText: exactly(label) }).first()
}
/** The labelled wrapper (.field) of the field named `label` inside `scope`. */
function field(scope, label) {
  return scope.locator('.field').filter({ has: scope.page().locator('label.field-label').filter({ hasText: exactly(label) }) }).first()
}
/** A marker next to a field's label, just after its text: "② Full name". */
const atLabel = async (n, scope, label) => ({ n, target: labelOf(scope, label), place: 'after-content' })

/** The box of the text typed in an input (window CSS px), for a marker just after it (place 'end'). */
async function typedText(input) {
  return input.evaluate(el => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const tw = ctx.measureText(el.value).width
    const rtl = cs.direction === 'rtl'
    const x = rtl ? r.right - parseFloat(cs.paddingRight) - tw : r.left + parseFloat(cs.paddingLeft)
    return { x, y: r.top + r.height / 2 - 9, width: tw, height: 18 }
  })
}

/**
 * The app keeps the patients list's and the calendar's search, filters and view in sessionStorage for the run, and
 * the runner puts back localStorage only: every shot starts with them cleared (the signed-in user is kept).
 */
async function freshView(page) {
  await page.evaluate(() => { for (const k of Object.keys(sessionStorage)) if (k !== 'dentora.session') sessionStorage.removeItem(k) })
}

/** Opens a demo patient's file (by file number) on `tab` (default the overview), at the top of the page. */
async function openPatient(page, helpers, fileNo, tab) {
  const p = await helpers.patient(String(fileNo))
  await helpers.goto(`/patients/${p.id}${tab ? `?tab=${tab}` : ''}`)
  await page.locator('.pt-hero .pt-hero-name').waitFor()
  await page.locator('.pt-kpis .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(300)
  return p
}

/** The patients list, loaded: rows on screen and the balances read (the third card shows its number). */
async function openList(page, helpers) {
  await helpers.goto('/patients')
  await page.locator('.pt-table tbody tr').first().waitFor()
  await page.locator('.pt-stats .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(300)
}

/**
 * A periapical X-ray of the lower left first molar (tooth 36) with its neighbours, drawn on a canvas in the page and
 * returned as a JPEG for the file chooser ({ name, mimeType, buffer }): radiopaque enamel and filling, dentine, pulp
 * chamber and canals, roots in trabecular bone.
 */
async function xrayFile(page) {
  const b64 = await page.evaluate(() => {
    const w = 600, h = 450
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d')
    let seed = 11
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    // film and bone: darker at the top (air above the crowns), trabecular bone below the cervical line
    g.fillStyle = '#141414'; g.fillRect(0, 0, w, h)
    const bone = g.createLinearGradient(0, 150, 0, h)
    bone.addColorStop(0, 'rgba(120,120,120,0)'); bone.addColorStop(0.2, 'rgba(120,120,120,0.55)'); bone.addColorStop(1, 'rgba(95,95,95,0.65)')
    g.fillStyle = bone; g.fillRect(0, 150, w, h - 150)
    for (let i = 0; i < 1400; i++) {
      const x = rnd() * w, y = 185 + rnd() * (h - 185), r = 2 + rnd() * 7
      g.fillStyle = rnd() < 0.5 ? `rgba(20,20,20,${0.08 + rnd() * 0.12})` : `rgba(190,190,190,${0.05 + rnd() * 0.08})`
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); g.fill()
    }
    // one tooth: crown with cusps, two roots (molar) or one (premolar), pulp and canals
    const tooth = (cx, cw, roots, filling) => {
      const top = 70, cej = 195, apex = 410
      g.save()
      g.filter = 'blur(1.2px)'
      const body = new Path2D()
      body.moveTo(cx - cw * 0.42, cej)
      body.bezierCurveTo(cx - cw * 0.55, 160, cx - cw * 0.52, 100, cx - cw * 0.4, top + 18)
      const cusps = roots === 2 ? [-0.25, 0.25] : [0]
      let x0 = cx - cw * 0.4
      for (const k of cusps) { const x = cx + k * cw; body.quadraticCurveTo(x - cw * 0.12, top - 6, x, top + 4); body.quadraticCurveTo(x + cw * 0.12, top - 6, x + cw * 0.2, top + 16); x0 = x + cw * 0.2 }
      body.lineTo(cx + cw * 0.4, top + 18)
      body.bezierCurveTo(cx + cw * 0.52, 100, cx + cw * 0.55, 160, cx + cw * 0.42, cej)
      // roots
      const rootList = roots === 2 ? [[-0.24, -0.06], [0.24, 0.06]] : [[0, 0]]
      for (const [off, lean] of rootList) {
        const rx = cx + off * cw, rw = roots === 2 ? cw * 0.2 : cw * 0.26
        body.moveTo(rx - rw, cej - 4)
        body.bezierCurveTo(rx - rw * 1.02, 300, rx - rw * 0.55 + lean * 60, apex - 30, rx + lean * 70, apex)
        body.bezierCurveTo(rx + rw * 0.55 + lean * 60, apex - 30, rx + rw * 1.02, 300, rx + rw, cej - 4)
        body.closePath()
      }
      g.fillStyle = 'rgba(200,200,200,0.92)'; g.fill(body)
      // enamel cap
      g.save(); g.clip(body)
      const en = g.createLinearGradient(0, top, 0, 175)
      en.addColorStop(0, 'rgba(245,245,245,1)'); en.addColorStop(0.75, 'rgba(235,235,235,0.9)'); en.addColorStop(1, 'rgba(235,235,235,0)')
      g.fillStyle = en; g.fillRect(cx - cw, top - 20, cw * 2, 160)
      g.restore()
      // pulp chamber and canals
      g.fillStyle = 'rgba(55,55,55,0.85)'; g.strokeStyle = 'rgba(55,55,55,0.85)'; g.lineCap = 'round'
      g.beginPath(); g.roundRect(cx - cw * 0.2, 150, cw * 0.4, 42, 14); g.fill()
      for (const [off, lean] of rootList) {
        const rx = cx + off * cw
        g.lineWidth = 5; g.beginPath(); g.moveTo(rx * 0.7 + cx * 0.3, 185); g.quadraticCurveTo(rx, 300, rx + lean * 66, apex - 14); g.stroke()
      }
      if (filling) {
        g.filter = 'blur(0.6px)'; g.fillStyle = 'rgba(255,255,255,1)'
        g.beginPath(); g.moveTo(cx - cw * 0.3, top + 6); g.lineTo(cx + cw * 0.12, top + 2); g.lineTo(cx + cw * 0.08, 128); g.quadraticCurveTo(cx - cw * 0.1, 140, cx - cw * 0.26, 124); g.closePath(); g.fill()
      }
      g.restore()
    }
    tooth(40, 150, 1, false)
    tooth(300, 200, 2, true)
    tooth(575, 190, 2, false)
    // film grain
    const img = g.getImageData(0, 0, w, h)
    for (let i = 0; i < img.data.length; i += 4) { const n = (rnd() - 0.5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n }
    g.putImageData(img, 0, 0)
    return c.toDataURL('image/jpeg', 0.88).split(',')[1]
  })
  return { name: 'periapical-36.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }
}

/** On #/patients/<id>?tab=files: Upload file → the X-ray → X-ray type, a note and tooth 36 in the dialog. */
async function fillUpload(page, helpers) {
  const file = await xrayFile(page)
  const chooser = page.waitForEvent('filechooser')
  await page.locator('.pt-files').getByRole('button', { name: await helpers.t('patients.files.upload') }).first().click()
  await (await chooser).setFiles(file)
  const dlg = helpers.dialog()
  await dlg.locator('.pt-kind-grid').waitFor()
  await dlg.locator('.pt-kind').filter({ hasText: await helpers.t('fileKind.xray') }).click()
  await dlg.getByLabel(await helpers.t('patients.files.note')).fill(helpers.pick('صورة ذروية قبل المعالجة', 'Periapical X-ray before treatment'))
  await dlg.getByLabel(await helpers.t('patients.files.tooth')).fill('36')
  await dlg.locator('.modal-title').click()
  await dlg.locator('.pt-upload-thumb img').waitFor()
  await helpers.settle(300)
  return dlg
}

const shotList = {
  'patients-list': async ({ page, helpers }) => {
    await openList(page, helpers)
    return {}
  },

  'patients-new-form': async ({ page, helpers }) => {
    await openList(page, helpers)
    const phone = await helpers.db(async (db) => (await db.patients.where('fileNo').equals(60).first())?.phone)
    await page.locator('.page-header').getByRole('button', { name: await helpers.t('patients.newPatient') }).click()
    const dlg = helpers.dialog()
    await dlg.locator('.pt-form').waitFor()
    await dlg.getByLabel(await helpers.t('fullName')).fill(helpers.pick('سامي خالد الحلبي', 'Sami Khaled Halabi'))
    await dlg.getByLabel(await helpers.t('birthDate')).fill('1988-04-02')
    await dlg.getByLabel(await helpers.t('phone'), { exact: true }).fill(phone)
    await dlg.locator('.pt-dup').waitFor()
    await dlg.locator('.modal-title').click()
    await dlg.locator('.modal-body').evaluate(el => { el.scrollTop = 0 })
    await helpers.settle(300)
    return {
      el: dlg, pad: 0,
      markers: [
        await atLabel(2, dlg, await helpers.t('fullName')),
        await atLabel(3, dlg, await helpers.t('birthDate')),
        await atLabel(4, dlg, await helpers.t('phone')),
        { n: 6, target: dlg.locator('.modal-footer .btn-primary') },
      ],
    }
  },

  'patients-medical-form': async ({ page, helpers }) => {
    await openPatient(page, helpers, 44)
    await page.locator('.pt-act-edit').click()
    const dlg = helpers.dialog()
    await dlg.locator('.pt-form').waitFor()
    await helpers.settle(300)
    await dlg.locator('.modal-body').evaluate(body => {
      const sec = body.querySelectorAll('.form-section')[1]
      body.scrollTop = sec.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8
    })
    await helpers.settle(300)
    return {
      el: dlg, pad: 0,
      markers: [
        await atLabel(2, dlg, await helpers.t('patients.allergies')),
        await atLabel(3, dlg, await helpers.t('patients.chronicDiseases')),
        await atLabel(3, dlg, await helpers.t('patients.medications')),
        await atLabel(3, dlg, await helpers.t('patients.bloodType')),
        await atLabel(4, dlg, await helpers.t('patients.medicalNotes')),
        { n: 5, target: dlg.locator('.modal-footer .btn-primary') },
      ],
    }
  },

  'patients-medical-alert': async ({ page, helpers }) => {
    await openPatient(page, helpers, 44)
    return { el: [page.locator('.pt-hero'), page.locator('.pt-alert')], pad: 12 }
  },

  'patients-filters': async ({ page, helpers }) => {
    await openList(page, helpers)
    await page.locator('.pt-search input').fill(helpers.pick('ميس', 'Mais'))
    await page.locator('.pt-filters .segmented').getByRole('tab', { name: await helpers.t('female'), exact: true }).click()
    await page.locator('.pt-resultbar').waitFor()
    await helpers.settle(500)
    const filters = page.locator('.pt-filters')
    return {
      el: [page.locator('.pt-stats'), page.locator('.pt-table')], pad: 12,
      // step 2: the gender switch and the doctor and tag lists, outlined together; its number under the doctor list
      highlights: [[filters.locator('.segmented'), filters.locator('.pt-select')]],
      markers: [
        { n: 1, target: await typedText(page.locator('.pt-search input')), place: 'end' },
        { n: 2, target: filters.locator('.pt-select').first(), place: 'bottom' },
        { n: 3, target: filters.getByRole('button', { name: await helpers.t('sort') }) },
        { n: 4, target: page.locator('.pt-resultbar').getByRole('button', { name: await helpers.t('patients.clearFilters') }) },
      ],
    }
  },

  'patients-filters-phone': async ({ page, helpers }) => {
    await helpers.goto('/patients')
    await page.locator('.pt-card').first().waitFor()
    await page.locator('.pt-filter-btn').click()
    await page.locator('.pt-sheet').waitFor()
    await helpers.settle(600)
    return {}
  },

  'patients-profile': async ({ page, helpers }) => {
    await openPatient(page, helpers, 44)
    return {
      markers: [
        { n: 2, target: page.locator('.pt-kpis'), highlight: true },
        { n: 3, target: page.locator('.pt-hero-actions') },
        { n: 4, target: page.locator('.pt-tabs'), highlight: true },
      ],
    }
  },

  'patients-profile-phone': async ({ page, helpers }) => {
    await openPatient(page, helpers, 42)
    return {}
  },

  'patients-files-upload': async ({ page, helpers }) => {
    await openPatient(page, helpers, 19, 'files')
    await page.locator('.pt-files').waitFor()
    const dlg = await fillUpload(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        await atLabel(3, dlg, await helpers.t('patients.files.kind')),
        await atLabel(4, dlg, await helpers.t('patients.files.note')),
        await atLabel(4, dlg, await helpers.t('patients.files.tooth')),
        { n: 5, target: dlg.locator('.modal-footer .btn-primary') },
      ],
    }
  },

  'patients-files': async ({ page, helpers }) => {
    await openPatient(page, helpers, 19, 'files')
    await page.locator('.pt-files').waitFor()
    const dlg = await fillUpload(page, helpers)
    await dlg.locator('.modal-footer .btn-primary').click()
    await dlg.waitFor({ state: 'detached' })
    await page.locator('.pt-files .pt-file').first().waitFor()
    await helpers.noToasts()
    await helpers.scrollTo(page.locator('.pt-tabs'))
    await helpers.settle(400)
    return {
      markers: [
        { n: 1, target: page.locator('.pt-tabs [role=tab][aria-selected=true], .pt-tabs .active').first(), place: 'end' },
        { n: 2, target: page.locator('.pt-files').getByRole('button', { name: await helpers.t('patients.files.upload') }).first() },
        { n: 6, target: page.getByRole('button', { name: await helpers.t('patients.notes.add') }).first() },
      ],
    }
  },

  'patients-archive': async ({ page, helpers }) => {
    await openList(page, helpers)
    const row = () => page.locator('.pt-table tbody tr').filter({ has: page.locator('.pt-fileno', { hasText: /^#57$/ }) })
    await row().locator('.pt-rowmenu button').click()
    await page.locator('.pt-popmenu').getByRole('menuitem', { name: await helpers.t('archive') }).click()
    await page.locator('.pt-popmenu').waitFor({ state: 'detached' })
    await helpers.noToasts()
    await page.locator('.pt-filters').getByRole('button', { name: await helpers.t('patients.showArchived') }).click()
    await page.locator('.pt-resultbar').waitFor()
    await row().locator('.pt-rowmenu button').click()
    const menu = page.locator('.pt-popmenu')
    await menu.waitFor()
    await helpers.settle(300)
    const mb = await menu.boundingBox()
    const tb = await page.locator('.pt-toolbar').boundingBox()
    return {
      clip: { x: tb.x - 12, y: tb.y - 12, width: tb.width + 24, height: mb.y + mb.height + 40 - (tb.y - 12) },
      markers: [
        { n: 3, target: page.locator('.pt-filters').getByRole('button', { name: await helpers.t('patients.showArchived') }) },
        { n: 4, target: menu.getByRole('menuitem', { name: await helpers.t('restore') }) },
      ],
    }
  },

  'patients-delete-blocked': async ({ page, helpers }) => {
    await openList(page, helpers)
    const row = page.locator('.pt-table tbody tr').filter({ has: page.locator('.pt-fileno', { hasText: /^#57$/ }) })
    await row.locator('.pt-rowmenu button').click()
    await page.locator('.pt-popmenu').getByRole('menuitem', { name: await helpers.t('delete') }).click()
    const dlg = helpers.dialog()
    await dlg.locator('[data-testid=pt-delete-blocked]').waitFor()
    await helpers.settle(300)
    return { el: dlg, pad: 0 }
  },
}

// every shot: the views cleared first; the pointer moved off the page's controls before the picture (no hover states)
export const shots = Object.fromEntries(Object.entries(shotList).map(([id, run]) => [id, async ctx => {
  await freshView(ctx.page)
  const target = await run(ctx)
  await ctx.page.mouse.move(1, 1)
  await ctx.page.waitForTimeout(150)
  return target
}]))
