// Kasher POS — what the page sees as window.pos (the PosElectronBridge contract in src/vite-env.d.ts).
// Runs sandboxed: only ipcRenderer and contextBridge are available here.
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

const VERSION_ARG = '--pos-version='
function readVersion() {
  try {
    const arg = (process.argv || []).find(a => typeof a === 'string' && a.startsWith(VERSION_ARG))
    if (arg) return arg.slice(VERSION_ARG.length)
  } catch { /* argv not available */ }
  try { return String(ipcRenderer.sendSync('pos:version') || '') } catch { return '' }
}

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

function printOptions(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  return {
    printer: typeof o.printer === 'string' ? o.printer : '',
    silent: !!o.silent,
    widthMm: Number(o.widthMm) > 0 ? Number(o.widthMm) : 0,
    copies: Number.isInteger(o.copies) && o.copies > 0 ? o.copies : 1,
  }
}

contextBridge.exposeInMainWorld('pos', {
  platform: 'electron',
  version: readVersion(),
  deviceId: () => call('pos:deviceId'),
  deviceName: () => call('pos:deviceName'),
  saveFile: (name, mime, data, base64) => call('pos:saveFile', String(name ?? ''), String(mime ?? ''), String(data ?? ''), !!base64),
  print: (html, opts) => call('pos:print', String(html ?? ''), printOptions(opts)),
  getPrinters: () => call('pos:getPrinters'),
  licenseGet: () => call('pos:licenseGet'),
  licenseSet: value => call('pos:licenseSet', value === null || value === undefined ? null : String(value)),
  openExternal: url => call('pos:openExternal', String(url ?? '')),
  setFullscreen: on => call('pos:setFullscreen', !!on),
  appSignature: () => call('pos:appSignature'),
})
