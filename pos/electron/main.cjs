// Kasher POS — the Windows shell. One window that serves dist/index.html, plus the bridge the page calls
// through electron/preload.cjs (window.pos). Every handler returns a safe default on failure: the main process never crashes.
'use strict'

const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, session, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const crypto = require('node:crypto')
const { execFile } = require('node:child_process')
const lib = require('./lib.cjs')
const pkg = require('../package.json')

const APP_ID = 'app.kasher.pos'
const PRINT_TIMEOUT_MS = 60000
let win = null
let deviceIdCache = null

// ---------- single instance: a second launch focuses the running window ----------
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
  app.whenReady().then(start).catch(err => {
    console.error('Kasher failed to start', err)
    app.quit()
  })
}

function start() {
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID)
  Menu.setApplicationMenu(null)
  hardenSessions()
  registerIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}

app.on('window-all-closed', () => app.quit())

// ---------- the window ----------
function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f3f5f9',
    title: 'Kasher POS',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: ['--pos-version=' + pkg.version],
    },
  })
  win.once('ready-to-show', () => { if (win && !win.isDestroyed()) win.show() })
  win.on('closed', () => { win = null })

  // F11 toggles fullscreen (the cashier screen likes the whole display)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      win.setFullScreen(!win.isFullScreen())
    }
  })
  // No pinch / ctrl+wheel zoom: the layout is designed for the screen as it is
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  win.webContents.on('did-finish-load', () => { if (win && !win.isDestroyed()) win.setTitle('Kasher POS') })
  win.on('page-title-updated', e => e.preventDefault())

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html')).catch(err => {
    console.error('Cannot load the app page', err)
    dialog.showErrorBox('Kasher POS', 'The app files are missing or damaged. Please reinstall Kasher POS.')
  })
}

/** Every web contents (the main window and the print windows): never leave file: pages, never open popups. */
function hardenSessions() {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, url) => {
      if (lib.isFileUrl(url)) return
      event.preventDefault()
      openExternal(url)
    })
    contents.setWindowOpenHandler(({ url }) => {
      openExternal(url)
      return { action: 'deny' }
    })
    contents.on('will-attach-webview', event => event.preventDefault())
  })
  // The page only needs the camera (barcode scanning with a webcam), fullscreen and the clipboard
  const allowed = new Set(['media', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'display-capture'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
}

function openExternal(url) {
  if (!lib.isExternalUrlAllowed(url)) return Promise.resolve()
  return shell.openExternal(String(url)).catch(() => {})
}

// ---------- the bridge ----------
function handle(channel, fn, fallback) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (err) {
      console.error(channel, err)
      return typeof fallback === 'function' ? fallback() : fallback
    }
  })
}

function registerIpc() {
  ipcMain.on('pos:version', event => { event.returnValue = pkg.version })
  handle('pos:deviceId', deviceId, () => '')
  handle('pos:deviceName', () => os.hostname() || 'Windows PC', 'Windows PC')
  handle('pos:saveFile', saveFile, false)
  handle('pos:print', (html, opts) => printHtml(String(html || ''), opts), false)
  handle('pos:getPrinters', getPrinters, () => [])
  handle('pos:licenseGet', licenseGet, null)
  handle('pos:licenseSet', licenseSet, undefined)
  handle('pos:openExternal', url => openExternal(url), undefined)
  handle('pos:setFullscreen', on => { if (win && !win.isDestroyed()) win.setFullScreen(!!on) }, undefined)
  handle('pos:appSignature', () => 'electron', 'electron')
}

// ---------- device identity ----------
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000, windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
      if (err) reject(err); else resolve(stdout)
    })
  })
}

async function deviceId() {
  if (deviceIdCache) return deviceIdCache
  let id = null
  try {
    if (process.platform === 'win32') {
      id = lib.parseMachineGuid(await run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']))
    } else if (process.platform === 'linux') {
      id = lib.parseMachineId(await fs.promises.readFile('/etc/machine-id', 'utf8'))
    } else if (process.platform === 'darwin') {
      id = lib.parseIoregUuid(await run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']))
    }
  } catch { /* fall back to the stored id */ }
  if (!id) id = await storedDeviceId()
  deviceIdCache = id
  return id
}

/** A UUID kept in userData/device.json for machines without a readable hardware id. */
async function storedDeviceId() {
  const file = path.join(app.getPath('userData'), 'device.json')
  try {
    const saved = JSON.parse(await fs.promises.readFile(file, 'utf8'))
    if (saved && typeof saved.id === 'string' && saved.id.length >= 16) return saved.id
  } catch { /* not there yet */ }
  const id = crypto.randomUUID()
  try {
    await fs.promises.mkdir(path.dirname(file), { recursive: true })
    await fs.promises.writeFile(file, JSON.stringify({ id, createdAt: Date.now() }), 'utf8')
  } catch { /* the id lives for this run only */ }
  return id
}

// ---------- files ----------
async function saveFile(name, _mime, data, base64) {
  const fileName = lib.safeFileName(name)
  const result = await dialog.showSaveDialog(win && !win.isDestroyed() ? win : undefined, {
    title: 'Kasher POS',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: lib.filtersFor(fileName),
  })
  if (result.canceled || !result.filePath) return false
  const content = base64 ? Buffer.from(String(data || ''), 'base64') : String(data || '')
  await fs.promises.writeFile(result.filePath, content, base64 ? undefined : 'utf8')
  return true
}

// ---------- printing ----------
function printHtml(html, opts) {
  return new Promise(resolve => {
    let done = false
    let printer = null
    const finish = ok => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { if (printer && !printer.isDestroyed()) printer.destroy() } catch { /* already gone */ }
      resolve(!!ok)
    }
    const timer = setTimeout(() => finish(false), PRINT_TIMEOUT_MS)
    try {
      printer = new BrowserWindow({
        show: false,
        width: 400,
        height: 800,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
      })
      printer.on('closed', () => finish(false))
      printer.webContents.on('did-fail-load', () => finish(false))
      printer.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          if (done || !printer || printer.isDestroyed()) return
          try {
            printer.webContents.print(lib.printOptions(opts), ok => finish(ok))
          } catch (err) {
            console.error('print', err)
            finish(false)
          }
        }, 150)
      })
      printer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => finish(false))
    } catch (err) {
      console.error('print window', err)
      finish(false)
    }
  })
}

async function getPrinters() {
  const contents = win && !win.isDestroyed() ? win.webContents : null
  if (!contents) return []
  const list = await contents.getPrintersAsync()
  return list.map(p => ({ name: String(p.name), isDefault: !!p.isDefault }))
}

// ---------- the license token, outside the page ----------
function licenseFile() {
  return path.join(app.getPath('userData'), 'license.bin')
}

async function licenseGet() {
  let text
  try { text = await fs.promises.readFile(licenseFile(), 'utf8') } catch { return null }
  const decrypt = safeStorage.isEncryptionAvailable() ? buf => safeStorage.decryptString(buf) : null
  return lib.decodeLicense(text, decrypt)
}

async function licenseSet(value) {
  const file = licenseFile()
  if (value === null || value === undefined || value === '') {
    try { await fs.promises.unlink(file) } catch { /* nothing to delete */ }
    return
  }
  const encrypt = safeStorage.isEncryptionAvailable() ? text => safeStorage.encryptString(text) : null
  await fs.promises.mkdir(path.dirname(file), { recursive: true })
  await fs.promises.writeFile(file, lib.encodeLicense(String(value), encrypt), 'utf8')
}
