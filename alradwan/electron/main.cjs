// The Windows app: the same web app inside its own window, with a save dialog for backups and Excel files.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu, net } = require('electron')
const path = require('path')
const fs = require('fs')

let win = null

// only web, mail and phone links leave the app (never ms-msdt:, file: or other handlers)
function openOutside(url) { if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url) }

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'كراج الرضوان',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  })
  Menu.setApplicationMenu(null)
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  // WhatsApp and other outside links open in the browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); openOutside(url) } })
  win.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media' || permission === 'clipboard-read'))
  setupScanners(win.webContents.session)
  win.on('closed', () => { win = null })
}

// ---- barcode scanners that are not keyboards: USB scanners in HID POS mode (WebHID) and scanners on a COM
// port: USB virtual COM, RS-232 adapters, Bluetooth serial (Web Serial). The page reads them itself; here the
// app decides which devices it may open. Scanners are trusted on sight (the HID POS scanner page, or a COM
// port of a scanner maker); any other port only once it is picked from the app's own list, and that choice is
// kept in scanners.json so it reconnects on every start. A printer or a scale on another COM port is never
// opened unless the shop picks it.
const SCANNER_VIDS = new Set([0x0536, 0x0c2e, 0x23d0, 0x05e0, 0x05f9, 0x080c, 0x1dc2, 0x1eab, 0x24ea, 0x065a, 0x08d7, 0x2415, 0x11fa, 0x067e, 0x2745, 0x08fb, 0x27dd, 0x0581, 0x324f, 0x32c3])
const scannersFile = () => path.join(app.getPath('userData'), 'scanners.json')
let scannerStore = null
function scanners() {
  if (!scannerStore) {
    try { scannerStore = JSON.parse(fs.readFileSync(scannersFile(), 'utf8')) } catch { scannerStore = {} }
    if (!Array.isArray(scannerStore.hid)) scannerStore.hid = []
    if (!Array.isArray(scannerStore.serial)) scannerStore.serial = []
  }
  return scannerStore
}
function saveScanners() { try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(scannersFile(), JSON.stringify(scannerStore)) } catch {} }
const hasScannerPage = d => (function walk(cs) { return (cs || []).some(c => c.usagePage === 0x8c || walk(c.children)) })(d && d.collections)
const sameHid = (h, d) => h.vendorId === d.vendorId && h.productId === d.productId && (!h.serialNumber || h.serialNumber === d.serialNumber)
const vidOf = id => { const m = /VID_([0-9A-F]{4})/i.exec(id || ''); return m ? parseInt(m[1], 16) : -1 }
let choosing = { hid: null, serial: null }
let inventory = null
function setupScanners(ses) {
  ses.setDevicePermissionHandler(({ deviceType, origin, device }) => {
    if (origin !== 'file://') return false
    // listing USB devices only names a scanner in keyboard mode; Windows lets no page open them
    if (deviceType === 'usb') return true
    if (deviceType === 'hid') return hasScannerPage(device) || scanners().hid.some(h => sameHid(h, device))
    if (deviceType === 'serial') {
      const id = device.device_instance_id || ''
      return scanners().serial.some(s => s.id === id) || SCANNER_VIDS.has(vidOf(id))
    }
    return false
  })
  // the page asked for a device (a click on «ربط قارئ»): it shows its own Arabic list and answers here
  const ask = (kind, list, pick, cancel) => {
    if (choosing[kind]) choosing[kind].finish(null)
    const timer = setTimeout(() => finish(null), 120000)
    const finish = id => { clearTimeout(timer); if (choosing[kind] && choosing[kind].finish === finish) choosing[kind] = null; if (id) pick(id); else cancel() }
    choosing[kind] = { finish }
    if (win) win.webContents.send('scanner:choose', { kind, list })
    else finish(null)
  }
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault()
    const list = details.deviceList.map(d => ({ id: d.deviceId, name: d.name, vendorId: d.vendorId, productId: d.productId, scanner: hasScannerPage(d) || SCANNER_VIDS.has(d.vendorId), keyboard: (d.collections || []).some(c => c.usagePage === 1 && c.usage === 6) }))
    if (inventory) { const done = inventory; inventory = null; done(list); callback(); return }
    ask('hid', list, id => {
      const d = details.deviceList.find(x => x.deviceId === id)
      if (!d) return callback()
      // remembered before the grant: with a permission handler installed, opening the device asks it again
      const st = scanners()
      if (!st.hid.some(h => sameHid(h, d))) { st.hid.push({ vendorId: d.vendorId, productId: d.productId, serialNumber: d.serialNumber, name: d.name }); saveScanners() }
      callback(d.deviceId)
    }, () => callback())
  })
  ses.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault()
    const list = portList.map(p => ({ id: p.portId, name: [p.portName, p.displayName].filter(Boolean).join(' — '), vendorId: p.vendorId ? Number(p.vendorId) : undefined, productId: p.productId ? Number(p.productId) : undefined, scanner: SCANNER_VIDS.has(Number(p.vendorId)) }))
    ask('serial', list, id => {
      const p = portList.find(x => x.portId === id)
      if (!p) return callback('')
      const st = scanners()
      if (p.deviceInstanceId && !st.serial.some(s => s.id === p.deviceInstanceId)) { st.serial.push({ id: p.deviceInstanceId, name: p.displayName || p.portName }); saveScanners() }
      callback(p.portId)
    }, () => callback(''))
  })
  ses.on('hid-device-revoked', (_e, details) => { const d = details && details.device; if (!d) return; const st = scanners(); st.hid = st.hid.filter(h => !sameHid(h, d)); saveScanners() })
  ses.on('serial-port-revoked', (_e, details) => { const id = details && details.port && details.port.deviceInstanceId; if (!id) return; const st = scanners(); st.serial = st.serial.filter(s => s.id !== id); saveScanners() })
}
ipcMain.on('scanner:choice', (_e, kind, id) => { const c = choosing[kind === 'serial' ? 'serial' : 'hid']; if (c) c.finish(id || null) })
// every HID device plugged in, keyboards and Bluetooth scanners included: names what is connected
ipcMain.handle('scanner-inventory', async () => {
  if (!win) return []
  return new Promise(resolve => {
    const timer = setTimeout(() => { inventory = null; resolve([]) }, 5000)
    inventory = list => { clearTimeout(timer); resolve(list) }
    // the second argument makes this count as a click, which the device request needs
    win.webContents.executeJavaScript('navigator.hid ? navigator.hid.requestDevice({ filters: [] }).then(() => 1, () => 0) : 0', true)
      .catch(() => 0).then(() => { if (inventory) { clearTimeout(timer); inventory = null; resolve([]) } })
  })
})

// Printing. The system print dialog is modal and on Windows it can open behind a maximized window, which
// looks like the app froze. So the default is a preview: the page is rendered to a PDF (with the print
// stylesheet, exactly as it would print) and shown in its own window, whose toolbar prints or saves it.
// 'direct' keeps the old behaviour for shops with a thermal printer that want one click.
const os = require('os')
app.setAppUserModelId('com.alradwan.garage')
ipcMain.handle('print', async (_e, mode, size) => {
  if (!win) return false
  if (mode === 'direct') {
    return new Promise(resolve => win.webContents.print({ silent: false, printBackground: true }, (ok, reason) => resolve(ok ? true : reason || false)))
  }
  try {
    const receipt = size === '80mm'
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: receipt ? { width: 3.15, height: 11.7 } : 'A4', margins: receipt ? { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 } : undefined, preferCSSPageSize: false })
    const dir = path.join(os.tmpdir(), 'alradwan-print'); fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `print-${Date.now()}.pdf`)
    fs.writeFileSync(file, pdf)
    const viewer = new BrowserWindow({ width: receipt ? 520 : 900, height: 900, parent: win, title: 'معاينة الطباعة — كراج الرضوان', autoHideMenuBar: true, webPreferences: { plugins: true, contextIsolation: true, nodeIntegration: false, sandbox: true } })
    viewer.setMenuBarVisibility(false)
    viewer.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    viewer.webContents.on('will-navigate', e => e.preventDefault())
    await viewer.loadURL('file://' + file.replace(/\\/g, '/'))
    viewer.on('closed', () => { try { fs.unlinkSync(file) } catch {} })
    return true
  } catch (e) { return String(e && e.message || e) }
})

ipcMain.handle('save-file', async (_e, name, base64) => {
  if (!win) return false
  const ext = path.extname(name).replace('.', '')
  const filters = ext === 'xlsx' ? [{ name: 'Excel', extensions: ['xlsx'] }] : ext === 'json' ? [{ name: 'نسخة احتياطية', extensions: ['json'] }] : [{ name: 'ملف', extensions: [ext || '*'] }]
  const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return true
})

// ---- silent daily backups in the app's own folder (the last 14 are kept)
const backupsDir = () => path.join(app.getPath('userData'), 'backups')
const safeName = name => path.basename(String(name)).replace(/[^\w.\-\u0600-\u06FF]/g, '_')
ipcMain.handle('auto-backup', async (_e, name, text) => {
  try {
    fs.mkdirSync(backupsDir(), { recursive: true })
    fs.writeFileSync(path.join(backupsDir(), safeName(name)), String(text))
    const files = fs.readdirSync(backupsDir()).filter(f => f.startsWith('auto-')).sort()
    for (const f of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(backupsDir(), f))
    return true
  } catch { return false }
})
ipcMain.handle('list-backups', async () => {
  try {
    fs.mkdirSync(backupsDir(), { recursive: true })
    return fs.readdirSync(backupsDir()).filter(f => f.endsWith('.json')).map(f => { const st = fs.statSync(path.join(backupsDir(), f)); return { name: f, size: st.size, mtime: st.mtimeMs } }).sort((a, b) => b.mtime - a.mtime)
  } catch { return [] }
})
ipcMain.handle('read-backup', async (_e, name) => {
  try { return fs.readFileSync(path.join(backupsDir(), safeName(name)), 'utf8') } catch { return null }
})
ipcMain.handle('backups-folder', async () => backupsDir())

// UPCitemdb's free product lookup answers programs but not web pages, and counts lookups per internet address,
// so the shop's own computer asks it (a shared server would use up the daily allowance). Only that one address.
ipcMain.handle('upc-lookup', async (_e, code) => {
  if (!/^\d{8,14}$/.test(String(code))) return null
  try {
    const r = await net.fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    return { status: r.status, body: (await r.text()).slice(0, 262144) }
  } catch { return { status: 0, body: '' } }
})

// a random id kept in the app's folder: the same after updates, different on another computer
ipcMain.handle('device-id', async () => {
  const f = path.join(app.getPath('userData'), 'device.id')
  try { const v = fs.readFileSync(f, 'utf8').trim(); if (v) return v } catch {}
  const id = require('crypto').randomBytes(16).toString('hex')
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(f, id) } catch {}
  return id
})

// one copy of the app at a time (a second click on the icon brings the first window forward)
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
}
