'use strict'
// Dentora — preload bridge. Runs sandboxed with context isolation: the page sees only window.dentora below,
// exactly the ElectronBridge interface in src/platform/index.ts (every method returns a Promise).
const { contextBridge, ipcRenderer } = require('electron')

// dialogs and the (hidden) menu speak the app's current language: read it from <html lang>
const uiLang = () => (document.documentElement && document.documentElement.lang === 'en' ? 'en' : 'ar')

// Printing goes through the main process (webContents.print, the system print dialog). Pages that hide the app
// while a sheet prints restore it on 'afterprint'; Chromium fires it after a real print, but not when printing
// fails before it starts (no printer, a driver error). Make sure the page always gets one.
function print() {
  let after = false
  const seen = () => { after = true }
  window.addEventListener('afterprint', seen)
  return ipcRenderer.invoke('print').then(() => undefined, () => undefined).finally(() => {
    window.removeEventListener('afterprint', seen)
    if (!after) window.dispatchEvent(new Event('afterprint'))
  })
}

// Files move in chunks of bytes (a backup can be gigabytes): save-begin opens the save dialog, save-chunk appends,
// save-end checks size + CRC-32 against the disk and puts the file in place; open-* reads a chosen file piece by piece.
const bytes = b => (ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(0))

contextBridge.exposeInMainWorld('dentora', {
  platform: 'electron',
  deviceId: () => ipcRenderer.invoke('device-id'),
  saveBegin: (name, mime, quiet) => ipcRenderer.invoke('save-begin', String(name ?? ''), String(mime ?? ''), !!quiet, uiLang()),
  saveChunk: (id, chunk) => ipcRenderer.invoke('save-chunk', String(id ?? ''), bytes(chunk)),
  saveEnd: (id, size, crc) => ipcRenderer.invoke('save-end', String(id ?? ''), Number(size), Number(crc)),
  saveAbort: id => ipcRenderer.invoke('save-abort', String(id ?? '')),
  openBegin: accept => ipcRenderer.invoke('open-begin', String(accept ?? ''), uiLang()),
  openChunk: (id, offset, length) => ipcRenderer.invoke('open-chunk', String(id ?? ''), Number(offset), Number(length)),
  openEnd: id => ipcRenderer.invoke('open-end', String(id ?? '')),
  print,
  appVersion: () => ipcRenderer.invoke('app-version'),
  openExternal: url => ipcRenderer.invoke('open-external', String(url ?? '')),
})

// Ctrl+P prints the current screen, as it does in a browser (Electron has no built-in shortcut for it).
// Matched by physical key so it works on the Arabic layout too; a page that handles Ctrl+P itself
// (preventDefault) keeps the shortcut.
window.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.code !== 'KeyP' || e.repeat) return
  setTimeout(() => { if (!e.defaultPrevented) void print() }, 0)
})

// keep the native menu in step with the language the clinic picked
window.addEventListener('DOMContentLoaded', () => {
  let last = ''
  const report = () => { const l = uiLang(); if (l !== last) { last = l; ipcRenderer.send('ui-lang', l) } }
  report()
  new MutationObserver(report).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
})
