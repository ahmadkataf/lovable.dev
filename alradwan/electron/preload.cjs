const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('garageDesktop', {
  saveFile: (name, base64) => ipcRenderer.invoke('save-file', name, base64),
  print: () => ipcRenderer.send('print'),
})
