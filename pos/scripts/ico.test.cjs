// node --test scripts/   (also run by `npm run test:shell`)
'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const { buildIco, parseIco, pngSize } = require('./ico.cjs')

/** A minimal valid PNG (one grey pixel row per line) of the given size, for the tests. */
function tinyPng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size, 0x80)
  for (let y = 0; y < size; y++) raw[y * (size * 4 + 1)] = 0 // filter byte per row
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

test('pngSize reads IHDR', () => {
  assert.deepEqual(pngSize(tinyPng(48)), { width: 48, height: 48 })
  assert.throws(() => pngSize(Buffer.from('not a png at all, really')), /not a PNG/)
})

test('buildIco writes a directory that parses back, with 256 encoded as 0', () => {
  const sizes = [16, 32, 48, 256]
  const pngs = sizes.map(tinyPng)
  const ico = buildIco(pngs)
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 4)
  assert.equal(ico.readUInt8(6 + 3 * 16), 0, '256 is stored as 0')
  const entries = parseIco(ico)
  assert.deepEqual(entries.map(e => e.width), sizes)
  assert.deepEqual(entries.map(e => e.height), sizes)
  for (const [i, e] of entries.entries()) {
    assert.equal(e.bits, 32)
    assert.equal(e.size, pngs[i].length)
    assert.equal(e.png, true)
    assert.ok(ico.subarray(e.offset, e.offset + e.size).equals(pngs[i]), 'entry ' + i + ' holds its PNG')
  }
  // entries are laid out back to back right after the directory
  assert.equal(entries[0].offset, 6 + 16 * sizes.length)
  assert.equal(entries[3].offset + entries[3].size, ico.length)
})

test('buildIco refuses images Windows cannot use', () => {
  assert.throws(() => buildIco([]), /at least one/)
  assert.throws(() => buildIco([tinyPng(512)]), /256x256 or smaller/)
  assert.throws(() => buildIco([Buffer.from('nope')]), /not a PNG/)
})
