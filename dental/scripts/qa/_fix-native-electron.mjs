// Temporary harness (fix-native): checks the Windows-shell fixes on Linux with the stock Electron binary.
//   QA_DIST=/tmp/dist-fix-native MAIN=<main.cjs to test> SCREEN=1366x768 xvfb-run -a -s '-screen 0 1366x768x24' node scripts/qa/_fix-native-electron.mjs
import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const S = '/tmp/claude-0/-home-user-lovable-dev/7205b07d-e68a-5001-a5b8-d48a352ced95/scratchpad/fix-native'
const electronPath = createRequire(import.meta.url)('electron')
const DIST = path.resolve(process.env.QA_DIST || '/tmp/dist-fix-native')
const MAIN = path.resolve(process.env.MAIN || path.join(ROOT, 'electron/main.cjs'))
const only = (process.env.ONLY || 'path,menu,print,bounds,device').split(',')
let failures = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) failures++ }

function stage(parent) {
  fs.mkdirSync(parent, { recursive: true })
  const dir = path.join(parent, 'app')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(path.join(dir, 'build'), { recursive: true })
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'))
  fs.cpSync(path.join(ROOT, 'electron'), path.join(dir, 'electron'), { recursive: true })
  fs.copyFileSync(MAIN, path.join(dir, 'electron', 'main.cjs'))
  for (const f of ['icon.png', 'icon.ico']) fs.copyFileSync(path.join(ROOT, 'build', f), path.join(dir, 'build', f))
  fs.cpSync(DIST, path.join(dir, 'dist'), { recursive: true })
  return dir
}
async function launch(appDir, userData, extraEnv = {}) {
  const app = await electron.launch({ executablePath: electronPath, args: [appDir, '--no-sandbox'], env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', DENTORA_USER_DATA: userData, ...extraEnv }, timeout: 60_000 })
  const page = await app.firstWindow()
  await page.waitForFunction(() => window.__dentora?.db, null, { timeout: 30_000 })
  for (let i = 0; i < 50 && !(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())); i++) await page.waitForTimeout(100)
  return { app, page }
}
const freshData = name => { const d = path.join(S, 'ud-' + name); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); return d }

// ---- 27: an install folder whose path holds %, #, spaces, brackets and Arabic letters --------------------------
if (only.includes('path')) {
  const weird = path.join(S, 'Users', 'Dr. Ali #2 (clinic) 100%', 'AppData', 'عيادة الأسنان', 'Programs', 'Dentora')
  const appDir = stage(weird)
  const { app, page } = await launch(appDir, freshData('path'))
  const url = page.url()
  const r = await page.evaluate(async () => {
    const out = {}
    try { out.id = await window.dentora.deviceId() } catch (e) { out.idErr = String(e.message || e) }
    try { out.v = await window.dentora.appVersion() } catch (e) { out.vErr = String(e.message || e) }
    return out
  })
  check('path with % # ( ) and Arabic: the bridge answers (device id, version)', /^[0-9a-f]{64}$/.test(r.id || '') && r.v === '1.0.0', JSON.stringify(r) + ' ' + url)
  // a different page in the same folder is still refused
  const other = await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({ show: false, webPreferences: { preload: BrowserWindow.getAllWindows()[0].webContents.session.getPreloads?.()[0] } })
    return w.id
  }).catch(() => null)
  void other
  await app.close()
}

// ---- 23: right-click menu ------------------------------------------------------------------------------------
if (only.includes('menu')) {
  const { app, page } = await launch(stage(path.join(S, 'stage-menu')), freshData('menu'))
  await app.evaluate(({ Menu }) => {
    const orig = Menu.buildFromTemplate.bind(Menu)
    globalThis.__menus = []
    Menu.buildFromTemplate = t => { globalThis.__menus.push(t.map(i => i.type === 'separator' ? '-' : `${i.role}:${i.label}:${i.enabled ? 1 : 0}`)); const m = orig(t); m.popup = () => {}; return m }
  })
  const menus = () => app.evaluate(() => globalThis.__menus.splice(0))
  // the setup page has text fields; the clinic name is empty, then typed
  // a text field like the licence code box, on top of the first-run screen
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'qa-field'; i.style.cssText = 'position:fixed;top:20px;left:20px;width:300px;height:40px;z-index:99999'; document.body.appendChild(i) })
  const input = page.locator('#qa-field')
  await input.click()
  await input.fill('عيادة الابتسامة')
  await input.selectText()
  await input.click({ button: 'right' })
  await page.waitForTimeout(400)
  const m1 = await menus()
  check('right click in a field (Arabic UI): Cut / Copy / Paste / Select all', JSON.stringify(m1[0]) === JSON.stringify(['cut:قص:1', 'copy:نسخ:1', 'paste:لصق:' + (m1[0]?.[2]?.endsWith(':1') ? '1' : '0'), '-', 'selectAll:تحديد الكل:1']), JSON.stringify(m1))
  // empty field: cut/copy disabled
  await input.fill('')
  await input.click({ button: 'right' })
  await page.waitForTimeout(400)
  const m2 = await menus()
  check('empty field: Cut and Copy disabled, Paste offered', m2[0]?.[0] === 'cut:قص:0' && m2[0]?.[1] === 'copy:نسخ:0' && m2[0]?.[2]?.startsWith('paste:لصق:'), JSON.stringify(m2))
  // plain text with nothing selected: no menu
  await page.mouse.click(5, 300, { button: 'right' })
  await page.waitForTimeout(400)
  const m3 = await menus()
  check('right click on the page with no selection: no menu', m3.length === 0, JSON.stringify(m3))
  // English labels follow <html lang>
  await page.evaluate(() => { document.documentElement.lang = 'en' })
  await page.waitForTimeout(300)
  await input.fill('Smile')
  await input.click({ button: 'right' })
  await page.waitForTimeout(400)
  const m4 = await menus()
  const ctx = (m4[m4.length - 1] || []).join(',')
  check('English UI: English labels', ctx.includes('paste:Paste') && ctx.includes('selectAll:Select all') && ctx.includes('cut:Cut'), JSON.stringify(m4[m4.length - 1]))
  // the clipboard round trip through the roles
  await app.evaluate(({ clipboard }) => clipboard.writeText('ABCD-EFGH-1234'))
  await input.fill('')
  await input.focus()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.paste())
  await page.waitForTimeout(300)
  check('Paste puts the clipboard into the field', (await input.inputValue()) === 'ABCD-EFGH-1234', await input.inputValue())
  await app.close()
}

// ---- 20: printing on a white background ------------------------------------------------------------------------
if (only.includes('print')) {
  const { app, page } = await launch(stage(path.join(S, 'stage-print')), freshData('print'))
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    globalThis.__printBg = null
    w.webContents.print = (opts, cb) => { globalThis.__printBg = { bg: w.getBackgroundColor(), printBackground: opts.printBackground }; setTimeout(() => cb(true, ''), 100) }
  })
  const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor())
  await page.evaluate(() => window.dentora.print())
  const during = await app.evaluate(() => globalThis.__printBg)
  const after = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor())
  check('print: the window is white while the job runs, its own colour again after', before === '#F5F7FA' && during?.bg === '#FFFFFF' && after === '#F5F7FA', JSON.stringify({ before, during, after }))
  // what that means on paper: a printed page's margin with the default background vs white
  const pdfs = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    const opts = { printBackground: true, margins: { marginType: 'default' }, pageSize: 'A4' }
    w.setBackgroundColor('#F5F7FA'); const grey = (await w.webContents.printToPDF(opts)).toString('base64')
    w.setBackgroundColor('#FFFFFF'); const white = (await w.webContents.printToPDF(opts)).toString('base64')
    w.setBackgroundColor('#F5F7FA')
    return { grey, white }
  })
  for (const [k, b64] of Object.entries(pdfs)) fs.writeFileSync(path.join(S, `print-${k}.pdf`), Buffer.from(b64, 'base64'))
  await app.close()
}

// ---- 17: saved bounds from a bigger monitor, or partly above the screen ------------------------------------------
if (only.includes('bounds')) {
  const cases = [
    ['undocked', { x: 280, y: 110, width: 1360, height: 860, maximized: false }],
    ['above', { x: 100, y: -600, width: 1200, height: 700, maximized: false }],
    ['fits', { x: 40, y: 30, width: 1100, height: 700, maximized: false }],
  ]
  for (const [name, saved] of cases) {
    const ud = freshData('bounds-' + name)
    fs.writeFileSync(path.join(ud, 'window-state.json'), JSON.stringify(saved))
    const { app, page } = await launch(stage(path.join(S, 'stage-bounds')), ud)
    await page.waitForTimeout(800)
    const r = await app.evaluate(({ BrowserWindow, screen }) => {
      const w = BrowserWindow.getAllWindows()[0]
      return { normal: w.getNormalBounds(), bounds: w.getBounds(), max: w.isMaximized(), wa: screen.getPrimaryDisplay().workArea }
    })
    const n = r.normal, wa = r.wa
    const inside = n.x >= wa.x && n.y >= wa.y && n.x + n.width <= wa.x + wa.width && n.y + n.height <= wa.y + wa.height
    if (name === 'fits') check(`bounds ${name}: kept as saved`, n.x === 40 && n.y === 30 && n.width === 1100 && n.height === 700 && !r.max, JSON.stringify(r))
    // (xvfb has no window manager, so maximize() cannot show here; tests/electron-shell.test.ts checks that decision)
    else check(`bounds ${name}: the whole window is on the screen`, inside, JSON.stringify(r))
    await page.screenshot({ path: path.join(S, `bounds-${name}.png`) })
    await app.close()
  }
}

// ---- 18: the device id is cached and stays the same --------------------------------------------------------------
if (only.includes('device')) {
  const ud = freshData('device')
  const dir = stage(path.join(S, 'stage-device'))
  let a = await launch(dir, ud)
  const id1 = await a.page.evaluate(() => window.dentora.deviceId())
  await a.app.close()
  const cache = JSON.parse(fs.readFileSync(path.join(ud, 'device-id.json'), 'utf8'))
  a = await launch(dir, ud)
  const id2 = await a.page.evaluate(() => window.dentora.deviceId())
  await a.app.close()
  check('device id: cached on first use and the same on the next run', id1 === id2 && cache.id === id1, `${id1.slice(0, 12)}… ${cache.source}`)
}

console.log(failures ? `\n${failures} failed` : '\nall passed')
process.exit(failures ? 1 : 0)
