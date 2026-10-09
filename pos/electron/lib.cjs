// Pure helpers of the Windows shell (no Electron imports, so they are unit-tested with `npm run test:shell`).
'use strict'

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** The MachineGuid out of `reg query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid`. */
function parseMachineGuid(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find(l => /MachineGuid/i.test(l))
  const m = line && line.match(GUID_RE)
  return m ? m[0].toLowerCase() : null
}

/** The IOPlatformUUID out of `ioreg -rd1 -c IOPlatformExpertDevice`. */
function parseIoregUuid(stdout) {
  const line = String(stdout || '').split(/\r?\n/).find(l => /IOPlatformUUID/.test(l))
  const m = line && line.match(GUID_RE)
  return m ? m[0].toLowerCase() : null
}

/** /etc/machine-id: 32 hex characters (or nothing). */
function parseMachineId(text) {
  const s = String(text || '').trim().toLowerCase()
  return /^[0-9a-f]{16,64}$/.test(s) ? s : null
}

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'whatsapp:'])

/** Only web links, mail, phone numbers and WhatsApp may leave the app. */
function isExternalUrlAllowed(url) {
  try {
    const u = new URL(String(url))
    return EXTERNAL_PROTOCOLS.has(u.protocol)
  } catch {
    return false
  }
}

function isFileUrl(url) {
  return typeof url === 'string' && url.startsWith('file:')
}

/** The license file content: 'enc:' + base64 when the OS keychain encrypted it, 'raw:' + text otherwise. */
function encodeLicense(value, encrypt) {
  if (typeof encrypt === 'function') {
    const buf = encrypt(value)
    return 'enc:' + Buffer.from(buf).toString('base64')
  }
  return 'raw:' + value
}

function decodeLicense(text, decrypt) {
  if (typeof text !== 'string' || !text) return null
  if (text.startsWith('raw:')) return text.slice(4) || null
  if (text.startsWith('enc:')) {
    if (typeof decrypt !== 'function') return null
    const value = decrypt(Buffer.from(text.slice(4), 'base64'))
    return value || null
  }
  return null
}

const FILTER_NAMES = {
  csv: 'CSV', json: 'JSON', txt: 'Text', pdf: 'PDF', png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', svg: 'SVG',
  html: 'HTML', zip: 'ZIP', xlsx: 'Excel', kasher: 'Kasher backup', bak: 'Backup',
}

/** "Save as" filters for a file name: its extension first, then "all files". */
function filtersFor(name) {
  const ext = extensionOf(name)
  const filters = []
  if (ext) filters.push({ name: FILTER_NAMES[ext] || ext.toUpperCase(), extensions: [ext] })
  filters.push({ name: 'All files', extensions: ['*'] })
  return filters
}

function extensionOf(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(name || ''))
  return m ? m[1].toLowerCase() : ''
}

/** A file name Windows accepts (no path separators or reserved characters). */
function safeFileName(name) {
  const s = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim()
  return s || 'file'
}

/** Electron print options for a receipt of `widthMm` (58 / 80 mm thermal rolls; A4 width when wider). */
function printOptions(opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const widthMm = Number(o.widthMm) > 0 ? Math.min(Number(o.widthMm), 420) : 80
  const copies = Number.isInteger(o.copies) && o.copies > 0 ? Math.min(o.copies, 20) : 1
  const out = {
    silent: !!o.silent,
    printBackground: true,
    copies,
    margins: { marginType: 'none' },
    pageSize: { width: Math.round(widthMm * 1000), height: 297000 },
  }
  if (typeof o.printer === 'string' && o.printer.trim()) out.deviceName = o.printer.trim()
  return out
}

module.exports = {
  parseMachineGuid, parseIoregUuid, parseMachineId, isExternalUrlAllowed, isFileUrl,
  encodeLicense, decodeLicense, filtersFor, extensionOf, safeFileName, printOptions,
}
