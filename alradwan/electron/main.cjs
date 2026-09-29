// The Windows app: the same web app inside its own window, with a save dialog for backups and Excel files.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

let win = null

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
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url) } })
  win.on('closed', () => { win = null })
}

// the invoice: the normal Windows print dialog, so the thermal or the A4 printer can be chosen
ipcMain.on('print', () => { if (win) win.webContents.print({ silent: false, printBackground: true }, () => {}) })

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

// one copy of the app at a time (a second click on the icon brings the first window forward)
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
}
