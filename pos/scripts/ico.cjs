// A Windows .ico file out of PNG images (PNG-compressed entries are valid since Windows Vista).
// Layout: ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per image + the PNG files back to back.
'use strict'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Width and height read from a PNG's IHDR chunk. */
function pngSize(png) {
  if (!Buffer.isBuffer(png) || png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG')
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

/**
 * @param {Buffer[]} pngs square PNG images, each at most 256x256
 * @returns {Buffer} the .ico file
 */
function buildIco(pngs) {
  if (!Array.isArray(pngs) || pngs.length === 0) throw new Error('an icon needs at least one image')
  if (pngs.length > 0xffff) throw new Error('too many images')
  const entries = pngs.map(png => {
    const { width, height } = pngSize(png)
    if (width > 256 || height > 256) throw new Error('icon images must be 256x256 or smaller, got ' + width + 'x' + height)
    return { png, width, height }
  })
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length
  entries.forEach((e, i) => {
    const o = i * 16
    dir.writeUInt8(e.width >= 256 ? 0 : e.width, o) // 0 means 256
    dir.writeUInt8(e.height >= 256 ? 0 : e.height, o + 1)
    dir.writeUInt8(0, o + 2) // colours in palette (none)
    dir.writeUInt8(0, o + 3) // reserved
    dir.writeUInt16LE(1, o + 4) // colour planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(e.png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += e.png.length
  })
  return Buffer.concat([header, dir, ...entries.map(e => e.png)])
}

/** Reads the directory of an .ico back (used by the tests and to check a generated file). */
function parseIco(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 6) throw new Error('not an ico')
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('not an ico')
  const count = buf.readUInt16LE(4)
  const images = []
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16
    const w = buf.readUInt8(o), h = buf.readUInt8(o + 1)
    const size = buf.readUInt32LE(o + 8), offset = buf.readUInt32LE(o + 12)
    const data = buf.subarray(offset, offset + size)
    images.push({ width: w === 0 ? 256 : w, height: h === 0 ? 256 : h, bits: buf.readUInt16LE(o + 6), size, offset, png: data.subarray(0, 8).equals(PNG_SIGNATURE) })
  }
  return images
}

module.exports = { buildIco, parseIco, pngSize }
