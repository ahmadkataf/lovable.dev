// node --test electron/   (also run by `npm run test:shell`)
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const lib = require('./lib.cjs')

test('parseMachineGuid reads the GUID out of reg query output', () => {
  const out = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\r\n    MachineGuid    REG_SZ    5A1B2C3D-4E5F-6071-8293-A4B5C6D7E8F9\r\n\r\n'
  assert.equal(lib.parseMachineGuid(out), '5a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9')
  assert.equal(lib.parseMachineGuid('ERROR: The system was unable to find the specified registry key or value.'), null)
  assert.equal(lib.parseMachineGuid(''), null)
  assert.equal(lib.parseMachineGuid(undefined), null)
})

test('parseIoregUuid reads IOPlatformUUID', () => {
  const out = '+-o MacBookPro  <class IOPlatformExpertDevice>\n  {\n    "IOPlatformUUID" = "9F0C1A2B-3D4E-5F60-7182-93A4B5C6D7E8"\n    "IOPlatformSerialNumber" = "C02XXXX"\n  }'
  assert.equal(lib.parseIoregUuid(out), '9f0c1a2b-3d4e-5f60-7182-93a4b5c6d7e8')
  assert.equal(lib.parseIoregUuid('"IOPlatformSerialNumber" = "C02XXXX"'), null)
})

test('parseMachineId accepts /etc/machine-id and rejects junk', () => {
  assert.equal(lib.parseMachineId('b08dfa6083e7567a1921a715000001fb\n'), 'b08dfa6083e7567a1921a715000001fb')
  assert.equal(lib.parseMachineId('not an id'), null)
  assert.equal(lib.parseMachineId(''), null)
})

test('isExternalUrlAllowed lets only web, mail, phone and WhatsApp links out', () => {
  for (const ok of ['https://kasher.app', 'http://example.com/x?y=1', 'mailto:a@b.c', 'tel:+963900000000', 'whatsapp://send?text=hi']) {
    assert.equal(lib.isExternalUrlAllowed(ok), true, ok)
  }
  for (const bad of ['file:///C:/Windows/system.ini', 'javascript:alert(1)', 'ms-settings:', 'smb://server/share', 'not a url', '', null]) {
    assert.equal(lib.isExternalUrlAllowed(bad), false, String(bad))
  }
})

test('isFileUrl', () => {
  assert.equal(lib.isFileUrl('file:///C:/app/dist/index.html#/sales'), true)
  assert.equal(lib.isFileUrl('https://x.y'), false)
  assert.equal(lib.isFileUrl(undefined), false)
})

test('license encoding round-trips with and without encryption', () => {
  const enc = text => Buffer.from(Buffer.from(text, 'utf8').map(b => b ^ 0x5a))
  const dec = buf => Buffer.from(buf.map(b => b ^ 0x5a)).toString('utf8')
  const token = 'eyJ2IjoxfQ.c2ln'
  const stored = lib.encodeLicense(token, enc)
  assert.ok(stored.startsWith('enc:'))
  assert.notEqual(stored.slice(4), token)
  assert.equal(lib.decodeLicense(stored, dec), token)
  const raw = lib.encodeLicense(token, null)
  assert.equal(raw, 'raw:' + token)
  assert.equal(lib.decodeLicense(raw, dec), token)
  assert.equal(lib.decodeLicense(raw, null), token)
  // encrypted file but the keychain is gone: nothing instead of garbage
  assert.equal(lib.decodeLicense(stored, null), null)
  assert.equal(lib.decodeLicense('', dec), null)
  assert.equal(lib.decodeLicense('garbage', dec), null)
  assert.equal(lib.decodeLicense('raw:', dec), null)
})

test('filtersFor builds a filter for the extension then all files', () => {
  assert.deepEqual(lib.filtersFor('sales-2026-10.csv'), [{ name: 'CSV', extensions: ['csv'] }, { name: 'All files', extensions: ['*'] }])
  assert.deepEqual(lib.filtersFor('backup.kasher'), [{ name: 'Kasher backup', extensions: ['kasher'] }, { name: 'All files', extensions: ['*'] }])
  assert.deepEqual(lib.filtersFor('noext'), [{ name: 'All files', extensions: ['*'] }])
  assert.equal(lib.filtersFor('x.XyZ')[0].name, 'XYZ')
})

test('safeFileName strips what Windows refuses', () => {
  assert.equal(lib.safeFileName('report: 10/2026 <v1>?.csv'), 'report- 10-2026 -v1--.csv')
  assert.equal(lib.safeFileName('   '), 'file')
  assert.equal(lib.safeFileName('نسخة احتياطية.json'), 'نسخة احتياطية.json')
})

test('printOptions maps the page-side options to Electron print options', () => {
  const o = lib.printOptions({ printer: 'XP-58', silent: true, widthMm: 58, copies: 2 })
  assert.equal(o.deviceName, 'XP-58')
  assert.equal(o.silent, true)
  assert.equal(o.copies, 2)
  assert.deepEqual(o.pageSize, { width: 58000, height: 297000 })
  assert.deepEqual(o.margins, { marginType: 'none' })
  const d = lib.printOptions({})
  assert.equal('deviceName' in d, false)
  assert.equal(d.silent, false)
  assert.equal(d.copies, 1)
  assert.equal(d.pageSize.width, 80000)
  assert.equal(lib.printOptions(undefined).copies, 1)
  assert.equal(lib.printOptions({ copies: 0, widthMm: -5, printer: '   ' }).pageSize.width, 80000)
  assert.equal(lib.printOptions({ copies: 999 }).copies, 20)
})
