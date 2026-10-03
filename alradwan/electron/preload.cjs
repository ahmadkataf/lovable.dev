const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('garageDesktop', {
  saveFile: (name, base64) => ipcRenderer.invoke('save-file', name, base64),
  print: (mode, size) => ipcRenderer.invoke('print', mode, size),
  deviceId: () => ipcRenderer.invoke('device-id'),
  autoBackup: (name, text) => ipcRenderer.invoke('auto-backup', name, text),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  readBackup: (name) => ipcRenderer.invoke('read-backup', name),
  backupsFolder: () => ipcRenderer.invoke('backups-folder'),
})
