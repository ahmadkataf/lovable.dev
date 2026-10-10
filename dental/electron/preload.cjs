'use strict'
// Dentora — preload bridge. Runs sandboxed with context isolation: the page sees only window.dentora below,
// exactly the ElectronBridge interface in src/platform/index.ts (every method returns a Promise).
const { contextBridge, ipcRenderer } = require('electron')

// dialogs and the (hidden) menu speak the app's current language: read it from <html lang>
const uiLang = () => (document.documentElement && document.documentElement.lang === 'en' ? 'en' : 'ar')

contextBridge.exposeInMainWorld('dentora', {
  platform: 'electron',
  deviceId: () => ipcRenderer.invoke('device-id'),
  saveFile: (name, mime, base64) => ipcRenderer.invoke('save-file', String(name ?? ''), String(mime ?? ''), String(base64 ?? ''), uiLang()),
  openFile: accept => ipcRenderer.invoke('open-file', String(accept ?? ''), uiLang()),
  print: () => ipcRenderer.invoke('print'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  openExternal: url => ipcRenderer.invoke('open-external', String(url ?? '')),
})

// keep the native menu in step with the language the clinic picked
window.addEventListener('DOMContentLoaded', () => {
  let last = ''
  const report = () => { const l = uiLang(); if (l !== last) { last = l; ipcRenderer.send('ui-lang', l) } }
  report()
  new MutationObserver(report).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
})
