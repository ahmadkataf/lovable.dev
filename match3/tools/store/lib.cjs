/**
 * Shared helpers for the store tools (make-graphics.cjs, make-screenshots.cjs, check-kit.cjs).
 * CommonJS, Node 22, no dependencies.
 *
 *   startServer(port)            start `npx vite --port <port> --strictPort` in the match3 directory
 *                                (or reuse a dev server that already answers there); returns { base, stop }
 *   encodeRgbPng(w, h, rgba)     24-bit PNG (colour type 2, NO alpha channel) from RGBA pixels —
 *                                the format Google Play asks for (feature graphic, screenshots)
 *   decodePng(buffer)            8-bit RGB / RGBA PNG → { width, height, channels, data }
 *   pngInfo(buffer)              IHDR fields without decoding the pixels
 *   toOpaqueRgbPng(buffer)       any 8-bit RGB/RGBA PNG → 24-bit PNG without alpha (flattened on `bg`)
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

/** The match3 directory (tools/store/ → ../..). */
const ROOT = path.join(__dirname, '..', '..');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Starts the Vite dev server of the game on `port` and waits until it answers.
 * If something already answers on that port it is reused and left running.
 */
async function startServer(port) {
  const base = 'http://127.0.0.1:' + port + '/';
  // a module every version of the game has; `/` itself is the game page
  const probe = base + 'src/app/brand.ts';
  if (await ping(probe)) return { base, stop: async () => undefined, reused: true };

  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true, // own process group, so stop() can end npx AND the vite process it starts
  });
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  const stop = async () => {
    if (exited) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch (_err) {
      try {
        child.kill('SIGTERM');
      } catch (_err2) {
        // already gone
      }
    }
    for (let i = 0; i < 40 && !exited; i++) await sleep(50);
    if (!exited) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (_err) {
        // already gone
      }
    }
  };
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    if (exited) throw new Error('the dev server exited at once — is port ' + port + ' taken? (npx vite --port ' + port + ' --strictPort)');
    if (await ping(probe)) return { base, stop, reused: false };
  }
  await stop();
  throw new Error('the dev server did not start on port ' + port);
}

// ───────────────────────────── PNG ─────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let crcTable = null;
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** IHDR of a PNG file. colorType: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA. */
function pngInfo(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE) || buf.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('not a PNG file');
  }
  const colorType = buf[25];
  let hasTransparencyChunk = false;
  for (let off = 8; off + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'tRNS') hasTransparencyChunk = true;
    if (type === 'IDAT' || type === 'IEND') break;
    off += 12 + len;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType,
    interlace: buf[28],
    /** true when the file can carry transparency at all (alpha channel or tRNS chunk) */
    hasAlphaChannel: colorType === 4 || colorType === 6 || hasTransparencyChunk,
  };
}

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG. */
function decodePng(buf) {
  const info = pngInfo(buf);
  if (info.bitDepth !== 8 || info.interlace !== 0 || (info.colorType !== 2 && info.colorType !== 6)) {
    throw new Error('unsupported PNG (need 8-bit RGB or RGBA, not interlaced): colour type ' + info.colorType + ', depth ' + info.bitDepth);
  }
  const parts = [];
  for (let off = 8; off + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (type === 'IDAT') parts.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts));
  const channels = info.colorType === 6 ? 4 : 3;
  const stride = info.width * channels;
  const data = Buffer.alloc(stride * info.height);
  for (let y = 0; y < info.height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[dst + x - channels] : 0;
      const b = y > 0 ? data[dst + x - stride] : 0;
      const c = x >= channels && y > 0 ? data[dst + x - stride - channels] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error('bad PNG filter ' + filter);
      data[dst + x] = v & 0xff;
    }
  }
  return { width: info.width, height: info.height, channels, data };
}

/**
 * Encodes RGBA (or RGB) pixels as a 24-bit PNG with NO alpha channel. Semi-transparent pixels are
 * flattened onto `bg` ([r, g, b], default the game's night colour).
 */
function encodeRgbPng(width, height, pixels, channels, bg) {
  const ch = channels || 4;
  const back = bg || [0x14, 0x12, 0x3a];
  if (pixels.length !== width * height * ch) throw new Error('pixel buffer size does not match ' + width + '×' + height + '×' + ch);
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    let o = y * (stride + 1);
    raw[o++] = 0; // filter: none
    let i = y * width * ch;
    for (let x = 0; x < width; x++, i += ch) {
      const a = ch === 4 ? pixels[i + 3] : 255;
      if (a === 255) {
        raw[o++] = pixels[i];
        raw[o++] = pixels[i + 1];
        raw[o++] = pixels[i + 2];
      } else {
        const t = a / 255;
        raw[o++] = Math.round(pixels[i] * t + back[0] * (1 - t));
        raw[o++] = Math.round(pixels[i + 1] * t + back[1] * (1 - t));
        raw[o++] = Math.round(pixels[i + 2] * t + back[2] * (1 - t));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB, no alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Any 8-bit RGB/RGBA PNG → 24-bit PNG without an alpha channel. */
function toOpaqueRgbPng(buf, bg) {
  const img = decodePng(buf);
  return encodeRgbPng(img.width, img.height, img.data, img.channels, bg);
}

function writeFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

module.exports = { ROOT, sleep, ping, startServer, pngInfo, decodePng, encodeRgbPng, toOpaqueRgbPng, writeFile };
