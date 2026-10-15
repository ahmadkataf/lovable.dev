// Pictures of the guide's topic "backup" (server/guide/topics/backup.ts); the shot API is documented at the top of
// store/scripts/guide-shots.mjs. Every shot starts on the dashboard of the demo clinic, signed in as the admin, with
// no backup taken yet (the runner restores the database after a shot that exported one, so the order of the shots
// does not matter).
// The shots run in a browser: an export downloads the file at once (instead of the Windows or Android save screen),
// and the Backup tab adds a blue note about the browser's storage that the Windows and Android apps never show, which
// is hidden here. A restore or an erase is never confirmed: the dialogs are pictured and the runner reloads the page.
import fs from 'node:fs'
import path from 'node:path'
import { tmpDir } from './_helpers.mjs'

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

/** Opens Settings → Backup & data with the browser-only storage note hidden. */
async function open(page, helpers) {
  await helpers.goto('/settings/backup')
  await page.locator('[data-qa="export-backup"]').waitFor()
  await page.locator('[data-qa="last-backup"]').waitFor()
  await helpers.css('.st-backup-hero .alert-info{display:none!important}')
  await helpers.settle(400)
}

/** Clicks Export backup and keeps the downloaded file (in the run's work folder); returns its path. */
async function exportBackup(page, helpers, name) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('[data-qa="export-backup"]').click(),
  ])
  // a folder per language and shot, so the file keeps the name the app gave it (the restore dialogs show it)
  const dir = path.join(tmpDir(), 'backups', `${helpers.lang}-${name}`)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, download.suggestedFilename())
  await download.saveAs(file)
  // the app reads the file back and says "saved" when it is whole
  await page.locator('.toast-stack .toast-success').first().waitFor({ timeout: 30000 })
  return { file, name: download.suggestedFilename() }
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
/** The label of the field that holds `control`, for a marker just after its text (on the field it would cover what is typed). */
const labelOf = (page, control) => page.locator('.field', { has: control }).locator('.field-label').first()

/** Turns "Protect the backup with a password" on or off (the app remembers the choice on this device). */
async function setProtect(page, on) {
  const input = page.locator('[data-qa="backup-protect-switch"]')
  if ((await input.isChecked()) !== on) await page.locator('label.switch', { has: input }).click()
  if (on) await page.locator('[data-qa="backup-password"]').waitFor()
}

/** Gives `file` to the app's file chooser opened by Choose backup file. */
async function chooseBackup(page, file) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 20000 }),
    page.locator('[data-qa="choose-backup"]').click(),
  ])
  await chooser.setFiles(file)
}

export const shots = atRest({
  'backup-overview': async ({ page, helpers }) => {
    await open(page, helpers)
    return {}
  },

  'backup-saved': async ({ page, helpers }) => {
    await open(page, helpers)
    await exportBackup(page, helpers, 'saved')
    await page.locator('.st-backup-hero .alert-success').waitFor()
    await rest(page)
    await helpers.settle(300)
    return {
      markers: [
        { n: 2, target: page.locator('[data-qa="export-backup"]') },
        { n: 4, target: page.locator('.toast-stack .toast-success').first() },
      ],
    }
  },

  'backup-protect': async ({ page, helpers }) => {
    await open(page, helpers)
    await setProtect(page, true)
    await page.locator('[data-qa="backup-password"]').fill('Smile-2026')
    await page.locator('[data-qa="backup-password2"]').fill('Smile-2026')
    await blur(page)
    await rest(page)
    await helpers.settle(300)
    return {
      el: page.locator('.st-backup-hero'), pad: 12,
      markers: [
        { n: 1, target: page.locator('label.switch', { has: page.locator('[data-qa="backup-protect-switch"]') }), place: 'after-content' },
        { n: 2, target: labelOf(page, page.locator('[data-qa="backup-password"]')), place: 'after-content' },
        { n: 2, target: labelOf(page, page.locator('[data-qa="backup-password2"]')), place: 'after-content' },
        { n: 3, target: page.locator('[data-qa="export-backup"]'), place: 'end' },
      ],
    }
  },

  'backup-restore-confirm': async ({ page, helpers }) => {
    await open(page, helpers)
    const { file } = await exportBackup(page, helpers, 'restore')
    await helpers.noToasts()
    await chooseBackup(page, file)
    const dlg = helpers.dialog()
    await dlg.locator('[data-qa="restore-summary"]').waitFor({ timeout: 30000 })
    await helpers.settle(500)
    await dlg.locator('[data-qa="confirm-word"]').fill(await helpers.t('settings.bk.replaceWord'))
    await blur(page)
    await rest(page)
    await helpers.settle(300)
    return {
      ...(await snug(dlg)),
      markers: [
        { n: 4, target: dlg.locator('[data-qa="restore-summary"]'), place: 'top-start' },
        { n: 5, target: labelOf(page, dlg.locator('[data-qa="confirm-word"]')), place: 'after-content' },
        { n: 5, target: dlg.locator('[data-qa="confirm-danger"]'), place: 'top' },
      ],
    }
  },

  'backup-password-prompt': async ({ page, helpers }) => {
    await open(page, helpers)
    await setProtect(page, true)
    await page.locator('[data-qa="backup-password"]').fill('Smile-2026')
    await page.locator('[data-qa="backup-password2"]').fill('Smile-2026')
    const { file } = await exportBackup(page, helpers, 'protected')
    await setProtect(page, false)
    await helpers.noToasts()
    await chooseBackup(page, file)
    const dlg = helpers.dialog()
    const box = dlg.locator('[data-qa="backup-unlock"]')
    await box.waitFor({ timeout: 20000 })
    await box.fill('smile-2025')
    await dlg.locator('[data-qa="backup-open"]').click()
    await dlg.locator('.field-error').waitFor({ timeout: 20000 })
    await blur(page)
    await rest(page)
    await helpers.settle(400)
    return {
      ...(await snug(dlg)),
      markers: [
        { n: 3, target: labelOf(page, box), place: 'after-content' },
        { n: 3, target: dlg.locator('[data-qa="backup-open"]'), place: 'top' },
      ],
    }
  },

  'backup-phone': async ({ page, helpers }) => {
    await open(page, helpers)
    const card = page.locator('.st-form .card', { has: page.locator('[data-qa="choose-backup"]') })
    await helpers.scrollTo(card)
    return {
      markers: [{ n: 3, target: page.locator('[data-qa="choose-backup"]'), place: 'end' }],
    }
  },

  'backup-erase': async ({ page, helpers }) => {
    await open(page, helpers)
    await exportBackup(page, helpers, 'erase')
    await helpers.noToasts()
    await page.locator('[data-qa="reset-all"]').click()
    const dlg = helpers.dialog()
    await dlg.locator('[data-qa="confirm-word"]').waitFor()
    await helpers.settle(500)
    await dlg.locator('[data-qa="confirm-word"]').fill(await helpers.t('settings.bk.resetWord'))
    await blur(page)
    await rest(page)
    await helpers.settle(300)
    return {
      ...(await snug(dlg)),
      markers: [
        { n: 2, target: dlg.locator('.modal-footer .start button'), place: 'top' },
        { n: 3, target: labelOf(page, dlg.locator('[data-qa="confirm-word"]')), place: 'after-content' },
        { n: 3, target: dlg.locator('[data-qa="confirm-danger"]'), place: 'top' },
      ],
    }
  },
})
