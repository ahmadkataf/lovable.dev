const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('garageDesktop', {
  saveFile: (name, base64) => ipcRenderer.invoke('save-file', name, base64),
  print: (mode, size) => ipcRenderer.invoke('print', mode, size),
  deviceId: () => ipcRenderer.invoke('device-id'),
  autoBackup: (name, text) => ipcRenderer.invoke('auto-backup', name, text),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  readBackup: (name) => ipcRenderer.invoke('read-backup', name),
  backupsFolder: () => ipcRenderer.invoke('backups-folder'),
  // product names for a barcode from UPCitemdb (asked by the app, not the page)
  upcLookup: (code) => ipcRenderer.invoke('upc-lookup', code),
  // another shop program's database on this computer (الأمين): find it, read its materials
  sqlPrograms: (args) => ipcRenderer.invoke('sql-programs', args),
  // barcode scanners: the app's own device list instead of the browser's chooser
  scanners: {
    inventory: () => ipcRenderer.invoke('scanner-inventory'),
    onChoose: (cb) => { const f = (_e, req) => cb(req); ipcRenderer.on('scanner:choose', f); return () => ipcRenderer.removeListener('scanner:choose', f) },
    choose: (kind, id) => ipcRenderer.send('scanner:choice', kind, id || null),
  },
})
