// Pictures of the guide's topic "appointments" (server/guide/topics/appointments.ts). The shot API is documented at
// the top of store/scripts/guide-shots.mjs; the helpers in guide-shots/_helpers.mjs (makeHelpers).
//
// The demo's Sunday 11 October 2026 (the fixed clock): Reem Murad (#3) in progress with Dr. Ahmad Al-Khatib at 11:00,
// Laith Michel Homsi (#40) with Dr. Samer Abboud 11:30–12:30, George Issa (#17) confirmed at 2:00 pm, Charbel Ghassan
// Taweel (#39) scheduled at 3:30 pm; Dr. Laila Haddad has nothing that day. Patients are found by file number (the
// same in both languages), doctors by their fixed id or their name in the database.

const exactly = label => new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?\\s*$`)
/** A marker next to a field's label, just after its text: "③ Doctor". */
const atLabel = (n, scope, label) => ({ n, target: scope.locator('label.field-label').filter({ hasText: exactly(label) }).first(), place: 'after-content' })

const patientName = (helpers, fileNo) => helpers.db(async (db, n) => (await db.patients.where('fileNo').equals(n).first())?.name, fileNo)
const doctorId = (helpers, re) => helpers.db(async (db, src) => (await db.users.toArray()).find(u => new RegExp(src).test(u.name))?.id, re)

/** The calendar in `view` on today, loaded. */
async function openCalendar(page, helpers, view) {
  await helpers.goto(`/appointments?view=${view}`)
  await page.locator('.apt-cal').waitFor()
  await page.locator('.apt-body .skeleton').first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  await helpers.settle(view === 'day' || view === 'week' ? 1500 : 600)
}

/** Day view: the slot button of `doctor`'s column at hh:mm. */
async function slot(page, doctorName, hhmm) {
  const heads = page.locator('.apt-tg-head')
  const n = await heads.count()
  let col = -1
  for (let i = 0; i < n; i++) if ((await heads.nth(i).innerText()).includes(doctorName)) { col = i; break }
  if (col < 0) throw new Error(`no column for ${doctorName}`)
  return page.locator('.apt-tg-col').nth(col).locator('button.apt-slot').filter({ has: page.locator('.apt-slot-hint', { hasText: hhmm }) }).first()
}

/** Day view → Dr. Laila Haddad's 12:00 slot → Lama Mazen Dabbagh (#6) and a reason: the new appointment form, filled. */
async function newForm(page, helpers) {
  await openCalendar(page, helpers, 'day')
  const laila = await helpers.db(async db => (await db.users.get('u-doc2'))?.name)
  const s = await slot(page, laila, '12:00')
  await s.scrollIntoViewIfNeeded()
  await s.click()
  const dlg = helpers.dialog()
  await dlg.locator('.apt-form').waitFor()
  const lama = await patientName(helpers, 6)
  await dlg.locator('.apt-picker input').fill(helpers.pick('لمى', 'Lama'))
  await dlg.locator('.apt-drop-item').filter({ hasText: lama }).first().click()
  await dlg.locator('.apt-picked').waitFor()
  await dlg.getByLabel(await helpers.t('appointments.reason')).fill(helpers.pick('ألم في الضرس', 'Toothache'))
  await dlg.locator('.modal-title').click()
  await helpers.settle(400)
  return dlg
}

/** The list (Agenda) view, and the details of Charbel Ghassan Taweel's 3:30 pm appointment (#39). */
async function openDetails(page, helpers) {
  await openCalendar(page, helpers, 'list')
  const name = await patientName(helpers, 39)
  await page.locator('.apt-arow').filter({ has: page.locator('.apt-arow-name', { hasText: name }) }).first().click()
  const dlg = helpers.dialog()
  await dlg.locator('.apt-det').waitFor()
  await helpers.settle(400)
  return dlg
}

const shotList = {
  'appointments-day': async ({ page, helpers }) => {
    await openCalendar(page, helpers, 'day')
    const reem = await patientName(helpers, 3)
    return {
      markers: [
        { n: 1, target: page.locator('.apt-nav') },
        { n: 1, target: page.locator('.apt-datepick') },
        { n: 2, target: page.locator('.apt-chips') },
        { n: 3, target: page.locator('.apt-status-menu button').first() },
        { n: 4, target: page.locator('.apt-ev').filter({ hasText: reem }).first() },
      ],
    }
  },

  'appointments-form': async ({ page, helpers }) => {
    const dlg = await newForm(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        atLabel(2, dlg, await helpers.t('patient')),
        atLabel(3, dlg, await helpers.t('doctor')),
        atLabel(3, dlg, await helpers.t('date')),
        atLabel(3, dlg, await helpers.t('appointments.form.time')),
        atLabel(4, dlg, await helpers.t('duration')),
        atLabel(4, dlg, await helpers.t('type')),
        { n: 5, target: dlg.locator('.modal-footer .btn-primary') },
      ],
    }
  },

  'appointments-conflict': async ({ page, helpers }) => {
    const dlg = await newForm(page, helpers)
    const samer = await doctorId(helpers, 'سامر|Samer')
    await dlg.getByLabel(await helpers.t('doctor')).selectOption(samer)
    const box = dlg.locator('.apt-conflict')
    await box.waitFor()
    await dlg.locator('.modal-title').click()
    await helpers.settle(400)
    // the patient card and the warning both in view
    await dlg.locator('.modal-body').evaluate((body) => {
      const w = body.querySelector('.apt-conflict').getBoundingClientRect(), b = body.getBoundingClientRect()
      if (w.bottom > b.bottom - 8) body.scrollTop += w.bottom - b.bottom + 16
    })
    await helpers.settle(300)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 1, target: box.locator('.alert-title, strong').first(), place: 'after-content' },
        { n: 2, target: box.getByRole('button') },
      ],
    }
  },

  'appointments-details': async ({ page, helpers }) => {
    const dlg = await openDetails(page, helpers)
    return {
      el: dlg, pad: 0,
      markers: [
        { n: 2, target: dlg.locator('.apt-det-actions .apt-det-label'), place: 'after-content' },
        { n: 3, target: dlg.locator('.apt-act-cancelled') },
        { n: 3, target: dlg.locator('.apt-act-no_show') },
      ],
    }
  },

  'appointments-agenda': async ({ page, helpers }) => {
    await openCalendar(page, helpers, 'list')
    const reem = await patientName(helpers, 3)
    const george = await patientName(helpers, 17)
    const today = page.locator('.apt-ag-day.today')
    const rows = today.locator('.apt-arow')
    const first = rows.filter({ hasText: reem }).first()
    // the day's header sticks under the top bar: the first row of the picture goes just below it
    await helpers.scrollTo(first)
    const head = await today.locator('.apt-ag-head').boundingBox(), row = await first.boundingBox()
    if (row.y < head.y + head.height + 12) await helpers.scrollTo(first, { offset: -(head.y + head.height + 12 - row.y) })
    await page.mouse.move(1, 1)
    const georgeRow = rows.filter({ hasText: george }).first()
    // rows 8 px apart: a 6 px margin above the first row keeps the row before it out of the picture
    const a = await first.boundingBox(), z = await rows.last().boundingBox()
    return {
      clip: { x: a.x - 12, y: a.y - 6, width: a.width + 24, height: z.y + z.height + 12 - (a.y - 6) },
      markers: [{ n: 4, target: georgeRow.locator('.apt-arow-actions .btn').first() }],
    }
  },

  'appointments-reminder': async ({ page, helpers }) => {
    const dlg = await openDetails(page, helpers)
    const label = dlg.locator('.apt-det-actions .apt-det-label')
    const lb = await label.boundingBox(), db = await dlg.boundingBox()
    // the block above the label (the reason for the visit) stays out of the picture
    const above = await label.evaluate(el => { const prev = el.closest('.apt-det-actions')?.previousElementSibling; return prev ? prev.getBoundingClientRect().bottom : null })
    const top = Math.max(lb.y - 16, above != null ? above + 4 : -1)
    const radius = await dlg.evaluate(el => parseFloat(getComputedStyle(el).borderBottomLeftRadius) || 0)
    // from the "Update status" label to the bottom of the dialog, with the dialog's own rounded corners
    return {
      el: { x: db.x, y: top, width: db.width, height: db.y + db.height - top }, pad: 0, round: radius,
      markers: [{ n: 2, target: dlg.locator('.apt-remind-title'), place: 'after-content' }],
    }
  },

  'appointments-edit': async ({ page, helpers }) => {
    const dlg = await openDetails(page, helpers)
    await dlg.locator('.modal-footer').getByRole('button', { name: await helpers.t('edit') }).click()
    const form = helpers.dialog()
    await form.locator('.apt-form').waitFor()
    await page.waitForTimeout(200)
    await page.evaluate(() => document.activeElement?.blur())
    await helpers.settle(400)
    return {
      el: form, pad: 0,
      markers: [
        atLabel(2, form, await helpers.t('date')),
        atLabel(2, form, await helpers.t('appointments.form.time')),
        { n: 3, target: form.locator('.modal-footer .btn-primary') },
        { n: 4, target: form.locator('.modal-footer').getByRole('button', { name: await helpers.t('delete') }) },
      ],
    }
  },

  'appointments-patient-tab': async ({ page, helpers }) => {
    const p = await helpers.patient('44')
    await helpers.goto(`/patients/${p.id}?tab=appointments`)
    await page.locator('.apt-ptab-stats').waitFor()
    await helpers.settle(400)
    // the tab bar right under the top bar (it sticks there): room below the card to scroll that far
    await helpers.css('.app-main { padding-bottom: 160px !important; }')
    await helpers.scrollTo(page.locator('.pt-tabs'), { offset: 12 })
    return {
      markers: [
        { n: 1, target: page.locator('.pt-tabs [role=tab][aria-selected=true], .pt-tabs .active').first() },
        { n: 2, target: page.locator('.apt-ptab').getByRole('button', { name: await helpers.t('nav.newAppointment') }).first() },
        { n: 3, target: page.locator('.apt-trow.next').first() },
      ],
    }
  },

  'appointments-phone': async ({ page, helpers }) => {
    await openCalendar(page, helpers, 'day')
    await helpers.scrollTop()
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
