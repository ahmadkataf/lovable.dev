'use strict'
// Dentora — Electron main process (the Windows desktop app). Plain CommonJS: no build step.
//
// The renderer is the same Vite build the browser and Android use (dist/index.html, hash router, file://).
// Everything the web app needs from the machine goes through the preload bridge (electron/preload.cjs) and the
// IPC handlers below, typed in src/platform/index.ts:
//   device-id · save-begin/-chunk/-end/-abort · open-begin/-chunk/-end · print · app-version · open-external
// The plain decisions (window placement, the app's own URL, refused switches, the right-click menu, the device id)
// are in electron/lib.cjs, which tests/native-shell.test.ts checks.
//
// Patient data lives in IndexedDB under app.getPath('userData') (Windows: %APPDATA%\Dentora). The installer never
// deletes that folder, so upgrades and reinstalls keep every record.
//
// Environment switches (all optional):
//   DENTORA_DEV=1           development only (npm run electron:dev): the menu shows Developer Tools (F12 / Ctrl+Shift+I).
//                           Ignored by the installed app, which never opens Developer Tools.
//   DENTORA_USER_DATA=dir   use another data folder (QA runs, a second test clinic on the same PC)
//   DENTORA_DISABLE_GPU=1   or the --disable-gpu switch: software rendering for old graphics drivers (blank window)
// The installed app refuses to start with Chromium's remote debugging or Node's inspector switches
// (--remote-debugging-port, --inspect…), and its Electron fuses switch off ELECTRON_RUN_AS_NODE, NODE_OPTIONS and
// loading code from outside app.asar (electron-builder.yml).

const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, screen, session, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { execFile } = require('node:child_process')
const { pathToFileURL } = require('node:url')
const { fitBounds, sameFileUrl, debugSwitch, contextMenuItems, resolveDeviceId, CSP } = require('./lib.cjs')

const APP_ID = 'com.dentora.app'
// Developer Tools only in a development run (electron .), never in the installed app, whatever the environment says
const DEV = process.env.DENTORA_DEV === '1' && !app.isPackaged
const ROOT = path.join(__dirname, '..')
const INDEX_HTML = path.join(ROOT, 'dist', 'index.html')
// The page is loaded from this URL and IPC is answered only for it. Built by Node (%, #, spaces, Arabic letters in the
// Windows user name or install folder are escaped) and compared by decoded path, never as raw text (lib.cjs).
const APP_URL = pathToFileURL(INDEX_HTML).href
const BG = '#F5F7FA'
const MIN_W = 1024
const MIN_H = 680
const DEFAULT_W = 1360
const DEFAULT_H = 860
const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

// ---- early setup (before 'ready') ----------------------------------------------------------------------------
if (process.env.DENTORA_USER_DATA) app.setPath('userData', path.resolve(process.env.DENTORA_USER_DATA))
// The installed app never runs with a debugging port or an inspector: either would let another program read and change
// the clinic's records, skip the PIN or the licence. Checked before anything else, before Chromium opens any port.
const refusedSwitch = app.isPackaged ? (debugSwitch(process.argv) || ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk', 'js-flags'].find(n => app.commandLine.hasSwitch(n)) || null) : null
if (refusedSwitch) {
  log(`refused to start with --${refusedSwitch}`)
  app.exit(1)
}
if (process.env.DENTORA_DISABLE_GPU === '1' || process.argv.includes('--disable-gpu')) app.disableHardwareAcceleration()
app.setAppUserModelId(APP_ID)

if (refusedSwitch) {
  // app.exit() has already ended the process; nothing below runs
} else if (!app.requestSingleInstanceLock()) {
  // a second launch (double-clicked shortcut while the app is open) just focuses the running window
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
    if (!win) return
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
  })
  app.whenReady().then(onReady).catch(err => {
    log('startup failed', err)
    dialog.showErrorBox('Dentora', String((err && err.stack) || err))
    app.quit()
  })
}

/** @type {BrowserWindow | null} */
let mainWindow = null
let uiLang = /^ar\b/i.test(safeLocale()) ? 'ar' : 'en'

// ---- small helpers -------------------------------------------------------------------------------------------
function safeLocale() { try { return app.getLocale() || '' } catch { return '' } }

function log(...parts) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${parts.map(p => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`
    fs.appendFileSync(path.join(dir, 'main.log'), line)
  } catch { /* logging must never break the app */ }
  if (DEV) console.log('[dentora]', ...parts)
}

/** true for the app's own page (any hash route), false for everything else. */
const isAppUrl = url => sameFileUrl(url, APP_URL, process.platform === 'win32')

/** IPC is answered only for the app's own top-level page, never for viewer windows or frames. */
function assertTrusted(event) {
  const frame = event.senderFrame
  if (!frame || frame.parent || !isAppUrl(frame.url)) throw new Error('Blocked: untrusted sender')
}

async function openExternalSafe(url) {
  let u
  try { u = new URL(String(url)) } catch { return false }
  if (!EXTERNAL_PROTOCOLS.has(u.protocol)) return false
  try { await shell.openExternal(u.href); return true } catch (err) { log('openExternal failed', u.href, err); return false }
}

function iconPath() {
  const ico = path.join(ROOT, 'build', 'icon.ico')
  const png = path.join(ROOT, 'build', 'icon.png')
  if (process.platform === 'win32' && fs.existsSync(ico)) return ico
  return fs.existsSync(png) ? png : undefined
}
function appIcon() {
  const p = iconPath()
  if (!p) return undefined
  const img = nativeImage.createFromPath(p)
  return img.isEmpty() ? undefined : img
}

// ---- strings for the few native surfaces (menu, dialogs) -----------------------------------------------------
const STRINGS = {
  ar: {
    view: 'عرض', zoomIn: 'تكبير', zoomOut: 'تصغير', zoomReset: 'الحجم الطبيعي', fullscreen: 'ملء الشاشة', reload: 'إعادة تحميل', devtools: 'أدوات المطوّر',
    cut: 'قص', copy: 'نسخ', paste: 'لصق', selectAll: 'تحديد الكل',
    saveTitle: 'حفظ الملف', openTitle: 'اختيار ملف', allFiles: 'كل الملفات', supported: 'الملفات المدعومة', fileOf: ext => `ملف ${ext}`,
    saveFailed: 'تعذّر حفظ الملف', openFailed: 'تعذّر فتح الملف', crashed: 'توقفت الواجهة عن العمل عدة مرات. أعد تشغيل Dentora، وإن تكررت المشكلة فتواصل مع الدعم الفني.',
  },
  en: {
    view: 'View', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Actual size', fullscreen: 'Full screen', reload: 'Reload', devtools: 'Developer tools',
    cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all',
    saveTitle: 'Save file', openTitle: 'Choose a file', allFiles: 'All files', supported: 'Supported files', fileOf: ext => `${ext} file`,
    saveFailed: 'The file could not be saved', openFailed: 'The file could not be opened', crashed: 'The window stopped responding several times. Restart Dentora; if it happens again, contact support.',
  },
}
const L = lang => STRINGS[lang === 'en' ? 'en' : lang === 'ar' ? 'ar' : uiLang]

// ---- window state (bounds, maximised, zoom) ------------------------------------------------------------------
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json')
let state = {}
let stateLoaded = false   // a second instance quits before 'ready': it must never overwrite the running app's file
function readState() {
  try { const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); return s && typeof s === 'object' ? s : {} } catch { return {} }
}
function writeState() {
  if (!stateLoaded) return
  try {
    const file = stateFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
    fs.renameSync(tmp, file)
  } catch (err) { log('window state not saved', err) }
}
function captureBounds(win) {
  // a minimised window reports neither its size nor whether it was maximised: keep what was saved before
  if (!win || win.isDestroyed() || win.isMinimized()) return
  const b = win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds()
  Object.assign(state, { x: b.x, y: b.y, width: b.width, height: b.height })
  state.maximized = win.isMaximized() || (win.isFullScreen() && !!state.maximized)
}
let saveTimer = null
function scheduleSave(win) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { captureBounds(win); writeState() }, 600)
}

/** Saved bounds, whole on a connected screen (lib.cjs fitBounds), otherwise a size that suits the primary screen. */
function initialBounds() {
  return fitBounds(state, screen.getAllDisplays(), screen.getPrimaryDisplay().workArea, { minW: MIN_W, minH: MIN_H, defaultW: DEFAULT_W, defaultH: DEFAULT_H })
}

// ---- zoom (Ctrl + / Ctrl - / Ctrl 0 / Ctrl+wheel), remembered between runs ----------------------------------
function setZoom(wc, factor) {
  if (!wc || wc.isDestroyed()) return
  const f = Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], factor))
  wc.setZoomFactor(f)
  if (mainWindow && wc === mainWindow.webContents) { state.zoom = f; scheduleSave(mainWindow) }
}
function zoomStep(wc, dir) {
  if (!wc || wc.isDestroyed()) return
  const cur = wc.getZoomFactor()
  const next = dir > 0 ? ZOOM_STEPS.find(z => z > cur + 0.001) : [...ZOOM_STEPS].reverse().find(z => z < cur - 0.001)
  if (next) setZoom(wc, next)
}
const focusedContents = () => (BrowserWindow.getFocusedWindow() || mainWindow)?.webContents

// ---- application menu (hidden; Alt shows it on Windows) ------------------------------------------------------
function buildMenu() {
  const s = L(uiLang)
  const view = [
    // zoom keys are handled in before-input-event (layout-independent, numpad too); shown here for discoverability
    { label: s.zoomIn, accelerator: 'CmdOrCtrl+Plus', registerAccelerator: false, click: () => zoomStep(focusedContents(), +1) },
    { label: s.zoomOut, accelerator: 'CmdOrCtrl+-', registerAccelerator: false, click: () => zoomStep(focusedContents(), -1) },
    { label: s.zoomReset, accelerator: 'CmdOrCtrl+0', registerAccelerator: false, click: () => setZoom(focusedContents(), 1) },
    { type: 'separator' },
    { label: s.fullscreen, accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11', click: (_i, w) => { const win = w || mainWindow; if (win) win.setFullScreen(!win.isFullScreen()) } },
    { type: 'separator' },
    { label: s.reload, accelerator: 'CmdOrCtrl+R', click: (_i, w) => (w || mainWindow)?.webContents.reload() },
  ]
  if (DEV) view.push({ label: s.devtools, accelerator: 'F12', click: (_i, w) => (w || mainWindow)?.webContents.toggleDevTools() })
  const template = []
  if (process.platform === 'darwin') template.push({ role: 'appMenu' }, { role: 'editMenu' })
  template.push({ label: s.view, submenu: view })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Keyboard shortcuts that must work on every keyboard layout (Arabic included): matched by physical key code. */
function handleShortcuts(wc, event, input) {
  if (input.type !== 'keyDown') return
  const mod = process.platform === 'darwin' ? input.meta : input.control
  if (mod && !input.alt) {
    if (input.code === 'Equal' || input.code === 'NumpadAdd') { event.preventDefault(); zoomStep(wc, +1); return }
    if (input.code === 'Minus' || input.code === 'NumpadSubtract') { event.preventDefault(); zoomStep(wc, -1); return }
    if ((input.code === 'Digit0' || input.code === 'Numpad0') && !input.shift) { event.preventDefault(); setZoom(wc, 1); return }
  }
  if (input.code === 'F5' && !mod) { event.preventDefault(); wc.reload(); return }
  if (DEV && (input.code === 'F12' || (mod && input.shift && input.code === 'KeyI'))) { event.preventDefault(); wc.toggleDevTools() }
}

// ---- security: navigation, new windows, permissions, CSP -----------------------------------------------------
const VIEWER_ALLOWED = url => url === 'about:blank' || url.startsWith('blob:')

function viewerWindowOptions() {
  // in-app viewer for a blob: (x-ray, photo, PDF) or a print window the page writes into; no bridge access
  return {
    width: 1100, height: 800, minWidth: 480, minHeight: 360, autoHideMenuBar: true, backgroundColor: '#FFFFFF', title: 'Dentora', icon: appIcon(),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, plugins: true },
  }
}

function hardenContents(contents) {
  contents.on('will-attach-webview', e => e.preventDefault())
  const guard = (e, url) => {
    if (isAppUrl(url)) return
    e.preventDefault()                      // dropped files, stray links: never leave the app page
    void openExternalSafe(url)              // http(s)/mailto/tel go to the system browser / mail / dialer
  }
  contents.on('will-navigate', guard)
  contents.on('will-redirect', guard)
  contents.setWindowOpenHandler(({ url }) => {
    if (VIEWER_ALLOWED(url)) return { action: 'allow', overrideBrowserWindowOptions: viewerWindowOptions() }
    void openExternalSafe(url)
    return { action: 'deny' }
  })
  contents.on('before-input-event', (e, input) => handleShortcuts(contents, e, input))
  contents.on('zoom-changed', (_e, dir) => zoomStep(contents, dir === 'in' ? +1 : -1))
  // right click: Cut / Copy / Paste / Select all in a field (pasting an activation code from WhatsApp), Copy over text
  contents.on('context-menu', (_e, params) => {
    const items = contextMenuItems(params, L(uiLang))
    if (!items.length) return
    const win = BrowserWindow.fromWebContents(contents) || undefined
    Menu.buildFromTemplate(items).popup({ window: win, x: params.x, y: params.y })
  })
}

function setupSession() {
  const ses = session.defaultSession
  // strict CSP for the app's own pages (file://), the same one index.html carries in its <meta> tag (lib.cjs CSP)
  ses.webRequest.onHeadersReceived({ urls: ['file:///*', 'file://*/*'] }, (details, cb) => {
    const headers = { ...(details.responseHeaders || {}) }
    for (const k of Object.keys(headers)) if (k.toLowerCase() === 'content-security-policy') delete headers[k]
    headers['Content-Security-Policy'] = [CSP]
    cb({ responseHeaders: headers })
  })
  // persistent-storage: navigator.storage.persist() at start-up keeps Chromium from evicting the clinic's records
  const ALLOWED = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'notifications', 'media', 'pointerLock', 'persistent-storage'])
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    const from = (details && (details.requestingUrl || details.securityOrigin)) || wc.getURL()
    cb(ALLOWED.has(permission) && (isAppUrl(from) || String(from).startsWith('file://')))
  })
  ses.setPermissionCheckHandler((_wc, permission, origin) => ALLOWED.has(permission) && (!origin || String(origin).startsWith('file://')))
  noSpellChecker(ses)
}

/** No spell checker: it is off in every window, and on Linux it would download a dictionary from Google at start. */
function noSpellChecker(ses) {
  try {
    ses.setSpellCheckerEnabled(false)
    if (typeof ses.setSpellCheckerLanguages === 'function' && process.platform !== 'darwin') ses.setSpellCheckerLanguages([])
    // anything that still asks for a dictionary asks the app itself, never the internet
    if (typeof ses.setSpellCheckerDictionaryDownloadURL === 'function') ses.setSpellCheckerDictionaryDownloadURL('file:///dentora-no-dictionaries/')
  } catch (err) { log('spell checker not switched off', err) }
}

// ---- the window ----------------------------------------------------------------------------------------------
function createWindow() {
  const { bounds, minW, minH, maximize } = initialBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: minW,
    minHeight: minH,
    show: false,
    title: 'Dentora',
    backgroundColor: BG,
    icon: appIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  })
  mainWindow = win

  let shown = false
  const reveal = () => {
    if (shown || win.isDestroyed()) return
    shown = true
    if (maximize) win.maximize()
    win.show()
    win.focus()
  }
  win.once('ready-to-show', reveal)
  // never leave an invisible window behind (a renderer that cannot paint, a failed load): show it anyway
  const revealTimer = setTimeout(reveal, 10_000)
  win.once('closed', () => clearTimeout(revealTimer))
  // the taskbar and title bar say "Dentora" in both languages (index.html's <title> is the Arabic web title)
  win.on('page-title-updated', e => e.preventDefault())
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, () => scheduleSave(win))
  win.on('close', () => { clearTimeout(saveTimer); captureBounds(win); writeState() })
  win.on('closed', () => { if (mainWindow === win) mainWindow = null })

  const wc = win.webContents
  wc.on('did-finish-load', () => { if (typeof state.zoom === 'number' && state.zoom !== 1) setZoom(wc, state.zoom) })
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => { if (isMainFrame) log('load failed', code, desc, url) })

  // a crashed renderer (out of memory, GPU driver…) reloads itself; three crashes within a minute stop and explain
  let crashes = []
  wc.on('render-process-gone', (_e, details) => {
    log('renderer gone', details)
    if (details.reason === 'clean-exit' || win.isDestroyed()) return
    const now = Date.now()
    crashes = crashes.filter(t => now - t < 60_000).concat(now)
    if (crashes.length <= 3) win.loadURL(APP_URL).catch(err => log('reload after crash failed', err))
    else dialog.showErrorBox('Dentora', L(uiLang).crashed)
  })

  win.loadURL(APP_URL).catch(err => log('load failed', err))
  return win
}

// ---- IPC: the bridge in src/platform/index.ts ----------------------------------------------------------------
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex')

function windowsMachineGuid(timeout) {
  const reg = path.join(process.env.SystemRoot || process.env.windir || 'C:\\Windows', 'System32', 'reg.exe')
  const query = extra => new Promise(resolve => {
    execFile(reg, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', ...extra], { windowsHide: true, timeout }, (err, stdout) => {
      if (err) { log('reg.exe failed', String((err && (err.code || err.message)) || err)); return resolve(null) }
      const m = /MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]{16,})/.exec(String(stdout))
      resolve(m ? m[1].toLowerCase() : null)
    })
  })
  // /reg:64 reads the 64-bit view even from a 32-bit build; plain query as a fallback (32-bit Windows)
  return query(['/reg:64']).then(g => g || query([]))
}

function hostFingerprint() {
  let user = ''
  try { user = os.userInfo().username } catch { /* no passwd entry */ }
  const cpu = (os.cpus()[0] && os.cpus()[0].model) || ''
  const host = os.hostname()
  return host || user || cpu ? `host:${host}|${user}|${cpu}` : null
}

/** This computer's id (hashed, never sent raw). On a first run reg.exe gets a second, longer try (a slow antivirus). */
async function machineId(firstRun) {
  if (process.platform !== 'win32') {
    const h = hostFingerprint()
    return h ? { kind: 'host', id: sha256(`dentora|${h}`) } : null
  }
  for (const timeout of firstRun ? [10_000, 20_000] : [10_000]) {
    const g = await windowsMachineGuid(timeout)
    if (g) return { kind: 'win', id: sha256(`dentora|win:${g}`) }
  }
  return null
}

const deviceFile = () => path.join(app.getPath('userData'), 'device-id.json')
let deviceIdPromise = null
/** Stable for the installation: cached on first use, see resolveDeviceId in lib.cjs. */
function deviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = resolveDeviceId({
      readCache: () => { try { return JSON.parse(fs.readFileSync(deviceFile(), 'utf8')) } catch { return null } },
      writeCache: obj => {
        const file = deviceFile()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(obj, null, 2))
        fs.renameSync(`${file}.tmp`, file)
      },
      // Dentora 1.0 kept a random id here when reg.exe failed
      readLegacy: () => { try { return fs.readFileSync(path.join(app.getPath('userData'), 'device-id'), 'utf8').trim() } catch { return null } },
      machineId,
      randomId: () => crypto.randomBytes(16).toString('hex'),
      log,
    }).then(r => r.id, err => { deviceIdPromise = null; throw err })
  }
  return deviceIdPromise
}

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
  tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif', avif: 'image/avif',
  pdf: 'application/pdf', json: 'application/json', csv: 'text/csv', txt: 'text/plain', md: 'text/markdown', html: 'text/html', xml: 'application/xml',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', dcm: 'application/dicom', stl: 'model/stl',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/x-m4v', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
}
const MIME_GROUPS = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif', 'avif'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'avi'],
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
  text: ['txt', 'csv', 'md'],
}
const mimeOf = file => MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream'

/** 'image/*,.pdf' → dialog filters. Empty or '*' → no filter. */
function filtersFromAccept(accept, s) {
  const exts = new Set()
  for (const raw of String(accept || '').split(',')) {
    const tok = raw.trim().toLowerCase()
    if (!tok) continue
    if (tok === '*' || tok === '*/*') return []
    if (tok.startsWith('.')) { if (/^\.[a-z0-9]{1,10}$/.test(tok)) exts.add(tok.slice(1)); continue }
    const [type, sub] = tok.split('/')
    if (sub === '*') { for (const e of MIME_GROUPS[type] || []) exts.add(e); continue }
    for (const [e, m] of Object.entries(MIME)) if (m === tok) exts.add(e)
  }
  if (!exts.size) return []
  return [{ name: s.supported, extensions: [...exts] }, { name: s.allFiles, extensions: ['*'] }]
}

/** A file name Windows accepts: no path, no reserved characters or device names. */
function safeFileName(name) {
  let n = path.basename(String(name || '').replace(/\\/g, '/'))
  n = n.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/[. ]+$/, '').trim()
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(n)) n = `_${n}`
  return n.slice(0, 180) || 'dentora-file'
}

function dirOrDownloads(dir) {
  try { if (dir && fs.statSync(dir).isDirectory()) return dir } catch { /* gone (USB stick removed) */ }
  return app.getPath('downloads')
}

// ---- chunked saves and opens (see registerIpc) ----------------------------------------------------------------
const MAX_CHUNK = 16 * 1024 * 1024
const saves = new Map()   // id → { owner, fh, part, target, size, crc, quiet, lang, win }
const opens = new Map()   // id → { owner, fh, file, size, lang, win }
const watched = new Set()

function ownSession(map, id, e) {
  const sv = map.get(String(id))
  return sv && sv.owner === e.sender.id ? sv : null
}
async function dropSave(id) {
  const sv = saves.get(String(id))
  if (!sv) return
  saves.delete(String(id))
  await sv.fh.close().catch(() => undefined)
  await fs.promises.unlink(sv.part).catch(() => undefined)
}
async function dropOpen(id) {
  const o = opens.get(String(id))
  if (!o) return
  opens.delete(String(id))
  await o.fh.close().catch(() => undefined)
}
/** A window that goes away (closed, reloaded after a crash) leaves no open file and no half-written part behind. */
function watchOwner(wc) {
  if (watched.has(wc.id)) return
  watched.add(wc.id)
  const owner = wc.id
  const drop = () => {
    for (const [id, sv] of saves) if (sv.owner === owner) void dropSave(id)
    for (const [id, o] of opens) if (o.owner === owner) void dropOpen(id)
  }
  wc.once('destroyed', () => { watched.delete(owner); drop() })
  wc.on('did-start-navigation', (ev, _url, inPlace, isMainFrame) => {
    // Electron passes the details on the event (newer) or as arguments (older): a reload or a new page drops them
    const main = ev && typeof ev.isMainFrame === 'boolean' ? ev.isMainFrame : isMainFrame
    const same = ev && typeof ev.isSameDocument === 'boolean' ? ev.isSameDocument : inPlace
    if (main && !same) drop()
  })
}
const failReason = err => (err && (err.code === 'ENOSPC' || err.code === 'EDQUOT') ? 'space' : 'io')
async function saveFailed(win, s, err, quiet) {
  if (quiet) return   // the page explains it in its own words
  await dialog.showMessageBox(win, { type: 'error', title: 'Dentora', message: s.saveFailed, detail: String((err && err.message) || err) }).catch(() => undefined)
}

// CRC-32 as ZIP and the page compute it (zlib.crc32 in Node 22+; a table version otherwise)
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c } return t })()
function crc32(buf, prev = 0) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf, prev) >>> 0
  let c = ~prev
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}
/** Size and CRC-32 of a file as it is on disk. */
async function fileCrc(file) {
  let crc = 0, size = 0
  for await (const chunk of fs.createReadStream(file, { highWaterMark: 4 * 1024 * 1024 })) { crc = crc32(chunk, crc); size += chunk.length }
  return { crc, size }
}

function registerIpc() {
  // sent by the preload whenever <html lang> changes, so the menu and dialogs follow the app's language
  ipcMain.on('ui-lang', (e, lang) => {
    try { assertTrusted(e) } catch { return }
    if ((lang === 'ar' || lang === 'en') && lang !== uiLang) { uiLang = lang; state.lang = lang; buildMenu(); scheduleSave(mainWindow) }
  })

  ipcMain.handle('device-id', e => { assertTrusted(e); return deviceId() })
  ipcMain.handle('app-version', e => { assertTrusted(e); return app.getVersion() })

  // ---- files in chunks: saving (backups, CSV, PDFs) and opening (backups to restore, x-rays) ------------------
  // A backup can hold gigabytes of x-rays, so files cross IPC in pieces (Uint8Array), never as one string.
  // A save writes "<chosen name>.dentora-part" next to the chosen file, reads it back to check its size and CRC-32
  // against what the page sent, and only then takes the chosen name: a failed save never replaces a good older file.
  ipcMain.handle('save-begin', async (e, name, mime, quiet, lang) => {
    assertTrusted(e)
    const s = L(lang)
    const win = BrowserWindow.fromWebContents(e.sender) || mainWindow
    const file = safeFileName(name)
    const ext = path.extname(file).slice(1).toLowerCase()
    const filters = ext ? [{ name: s.fileOf(ext.toUpperCase()), extensions: [ext] }, { name: s.allFiles, extensions: ['*'] }] : []
    const r = await dialog.showSaveDialog(win, {
      title: s.saveTitle,
      defaultPath: path.join(dirOrDownloads(state.saveDir), file),
      filters,
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    })
    if (r.canceled || !r.filePath) return null
    const target = r.filePath
    const part = `${target}.dentora-part`
    try {
      const fh = await fs.promises.open(part, 'w')
      const id = crypto.randomUUID()
      saves.set(id, { owner: e.sender.id, fh, part, target, size: 0, crc: 0, quiet: !!quiet, lang, win })
      watchOwner(e.sender)
      return { id, name: path.basename(target) }
    } catch (err) {
      log('save-begin failed', part, err)
      await saveFailed(win, s, err, !!quiet)
      return { error: failReason(err) }
    }
  })

  ipcMain.handle('save-chunk', async (e, id, bytes) => {
    assertTrusted(e)
    const sv = ownSession(saves, id, e)
    if (!sv) return { ok: false, reason: 'io', detail: 'unknown save' }
    if (!ArrayBuffer.isView(bytes) || bytes.byteLength > MAX_CHUNK) return { ok: false, reason: 'io', detail: 'bad chunk' }
    const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    try {
      for (let off = 0; off < buf.length;) {
        const { bytesWritten } = await sv.fh.write(buf, off, buf.length - off)
        if (!bytesWritten) throw new Error('write returned 0 bytes')
        off += bytesWritten
      }
      sv.size += buf.length
      sv.crc = crc32(buf, sv.crc)
      return { ok: true }
    } catch (err) {
      log('save-chunk failed', sv.part, err)
      await dropSave(id)
      await saveFailed(sv.win, L(sv.lang), err, sv.quiet)
      return { ok: false, reason: failReason(err), detail: String((err && err.message) || err) }
    }
  })

  ipcMain.handle('save-end', async (e, id, size, crc) => {
    assertTrusted(e)
    const sv = ownSession(saves, id, e)
    if (!sv) return { ok: false, reason: 'io', detail: 'unknown save' }
    saves.delete(String(id))
    try {
      await sv.fh.sync()
      await sv.fh.close()
      // what arrived must be what the page sent, and what is on disk must be what arrived
      if (sv.size !== Number(size) || sv.crc !== (Number(crc) >>> 0)) throw Object.assign(new Error(`received ${sv.size} bytes, page sent ${size}`), { code: 'EVERIFY' })
      const disk = await fileCrc(sv.part)
      if (disk.size !== sv.size || disk.crc !== sv.crc) throw Object.assign(new Error(`disk has ${disk.size} bytes, expected ${sv.size}`), { code: 'EVERIFY' })
      try { await fs.promises.rename(sv.part, sv.target) } catch (err) {
        // the old file is open in another program (Windows): copy over it instead
        if (!['EPERM', 'EBUSY', 'EACCES', 'EXDEV'].includes(err && err.code)) throw err
        await fs.promises.copyFile(sv.part, sv.target)
        await fs.promises.unlink(sv.part).catch(() => undefined)
      }
      state.saveDir = path.dirname(sv.target); scheduleSave(mainWindow)
      return { ok: true, name: path.basename(sv.target) }
    } catch (err) {
      log('save-end failed', sv.target, err)
      await fs.promises.unlink(sv.part).catch(() => undefined)
      await saveFailed(sv.win, L(sv.lang), err, sv.quiet)
      return { ok: false, reason: err && err.code === 'EVERIFY' ? 'verify' : failReason(err), detail: String((err && err.message) || err) }
    }
  })

  ipcMain.handle('save-abort', async (e, id) => {
    assertTrusted(e)
    if (ownSession(saves, id, e)) await dropSave(id)
  })

  ipcMain.handle('open-begin', async (e, accept, lang) => {
    assertTrusted(e)
    const s = L(lang)
    const win = BrowserWindow.fromWebContents(e.sender) || mainWindow
    const r = await dialog.showOpenDialog(win, {
      title: s.openTitle,
      defaultPath: state.openDir && fs.existsSync(state.openDir) ? state.openDir : undefined,
      properties: ['openFile'],
      filters: filtersFromAccept(accept, s),
    })
    const file = !r.canceled && r.filePaths && r.filePaths[0]
    if (!file) return null
    try {
      const fh = await fs.promises.open(file, 'r')
      const { size } = await fh.stat()
      const id = crypto.randomUUID()
      opens.set(id, { owner: e.sender.id, fh, file, size, lang, win })
      watchOwner(e.sender)
      state.openDir = path.dirname(file); scheduleSave(mainWindow)
      return { id, name: path.basename(file), mime: mimeOf(file), size }
    } catch (err) {
      log('open-begin failed', file, err)
      await dialog.showMessageBox(win, { type: 'error', title: 'Dentora', message: s.openFailed, detail: String((err && err.message) || err) })
      return null
    }
  })

  ipcMain.handle('open-chunk', async (e, id, offset, length) => {
    assertTrusted(e)
    const o = ownSession(opens, id, e)
    if (!o) throw new Error('unknown file')
    const at = Math.max(0, Math.floor(Number(offset) || 0))
    const n = Math.max(0, Math.min(MAX_CHUNK, Math.floor(Number(length) || 0), o.size - at))
    if (!n) return new Uint8Array(0)
    try {
      const buf = Buffer.allocUnsafe(n)
      let got = 0
      while (got < n) {
        const { bytesRead } = await o.fh.read(buf, got, n - got, at + got)
        if (!bytesRead) break
        got += bytesRead
      }
      return buf.subarray(0, got)
    } catch (err) {
      log('open-chunk failed', o.file, err)
      await dropOpen(id)
      await dialog.showMessageBox(o.win, { type: 'error', title: 'Dentora', message: L(o.lang).openFailed, detail: String((err && err.message) || err) })
      throw err
    }
  })

  ipcMain.handle('open-end', async (e, id) => {
    assertTrusted(e)
    if (ownSession(opens, id, e)) await dropOpen(id)
  })

  ipcMain.handle('print', e => {
    assertTrusted(e)
    // The window's own colour shows wherever the page does not paint, and printBackground puts it on paper: the page
    // margins of an invoice or a prescription would come out light grey. White while the print job runs.
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && !win.isDestroyed()) win.setBackgroundColor('#FFFFFF')
    const restore = () => { if (win && !win.isDestroyed()) win.setBackgroundColor(BG) }
    return new Promise(resolve => {
      try {
        e.sender.print({ silent: false, printBackground: true }, (ok, reason) => { restore(); if (!ok && reason && reason !== 'cancelled') log('print failed', reason); resolve() })
      } catch (err) { restore(); log('print threw', err); resolve() }
    })
  })

  ipcMain.handle('open-external', async (e, url) => { assertTrusted(e); await openExternalSafe(url) })
}

// ---- lifecycle -----------------------------------------------------------------------------------------------
function onReady() {
  if (!fs.existsSync(INDEX_HTML)) {
    dialog.showErrorBox('Dentora', `dist/index.html is missing. Run "npm run build" first.\n\n${INDEX_HTML}`)
    app.quit()
    return
  }
  state = readState()
  stateLoaded = true
  if (state.lang === 'ar' || state.lang === 'en') uiLang = state.lang
  buildMenu()
  setupSession()
  registerIpc()
  app.on('web-contents-created', (_e, contents) => hardenContents(contents))
  createWindow()
  log(`started v${app.getVersion()} electron ${process.versions.electron} on ${process.platform} ${os.release()}`)
}

// macOS keeps the app alive without windows and reopens one from the dock
app.on('activate', () => { if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit', () => {
  clearTimeout(saveTimer)
  if (mainWindow && !mainWindow.isDestroyed()) captureBounds(mainWindow)
  writeState()
  try { session.defaultSession.flushStorageData() } catch { /* already gone */ }
})
process.on('uncaughtException', err => log('uncaught', err))
process.on('unhandledRejection', err => log('unhandled rejection', err))
