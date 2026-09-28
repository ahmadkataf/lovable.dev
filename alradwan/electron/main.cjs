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

// one copy of the app at a time (a second click on the icon brings the first window forward)
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
}
