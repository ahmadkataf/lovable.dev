/**
 * Shared helpers for the store tools (make-graphics.cjs, make-screenshots.cjs, check-kit.cjs).
 * CommonJS, Node 22, no dependencies besides the project's own Vite and the global Playwright.
 *
 *   STORE_PORT                   the one port the store tools use for the game's dev server (5189;
 *                                override with the environment variable STORE_PORT)
 *   startServer(port)            the game's Vite dev server on `port`, WITHOUT hot reload and file
 *                                watching (other people edit src/ while a capture runs; a reload in
 *                                the middle would spoil it). A dev server that already answers on
 *                                the port (e.g. `npx vite --port 5189 --strictPort`) is reused and
 *                                left running. Returns { base, stop, reused }.
 *   encodeRgbPng(w, h, rgba)     24-bit PNG (colour type 2, NO alpha channel) from RGBA pixels —
 *                                the format Google Play asks for (feature graphic, screenshots)
 *   decodePng(buffer)            8-bit RGB / RGBA PNG → { width, height, channels, data }
 *   pngInfo(buffer)              IHDR fields without decoding the pixels
 *   toOpaqueRgbPng(buffer)       any 8-bit RGB/RGBA PNG → 24-bit PNG without alpha (flattened on `bg`)
 *   resizeImage(img, w, h)       Lanczos-3 resampling of a decoded image (used to scale a capture
 *                                into its frame — scaling is the only thing done to captured pixels)
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

/** The match3 directory (tools/store/ → ../..). */
const ROOT = path.join(__dirname, '..', '..');

/** The dev-server port of the store tools. */
const STORE_PORT = Number(process.env.STORE_PORT || 5189);

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
 * The game's dev server on `port`. Started in this process through Vite's own API with hot reload
 * and file watching switched off, so the whole run sees one consistent version of the game even
 * while files under src/ are being edited. Stopped by `stop()` (and with the process). If a dev
 * server already answers on the port it is reused as it is and left running.
 */
async function startServer(port) {
  const base = 'http://127.0.0.1:' + port + '/';
  // a module every version of the game has; `/` itself is the game page
  const probe = base + 'src/app/brand.ts';
  if (await ping(probe)) return { base, stop: async () => undefined, reused: true };

  const vite = await import('vite');
  let server;
  try {
    server = await vite.createServer({
      root: ROOT,
      logLevel: 'silent',
      clearScreen: false,
      server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
    });
    await server.listen();
  } catch (err) {
    if (server) await server.close().catch(() => undefined);
    throw new Error('the dev server did not start on port ' + port + ' (' + (err && err.message ? err.message : err) + ')');
  }
  const stop = async () => {
    await server.close().catch(() => undefined);
    for (let i = 0; i < 40; i++) {
      if (!(await ping(probe))) return;
      await sleep(100);
    }
  };
  for (let i = 0; i < 120; i++) {
    if (await ping(probe)) return { base, stop, reused: false };
    await sleep(250);
  }
  await stop();
  throw new Error('the dev server did not answer on port ' + port);
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
  // flatten to RGB first
  const rgb = Buffer.alloc(stride * height);
  for (let i = 0, o = 0, n = width * height; i < n * ch; i += ch) {
    const a = ch === 4 ? pixels[i + 3] : 255;
    if (a === 255) {
      rgb[o++] = pixels[i];
      rgb[o++] = pixels[i + 1];
      rgb[o++] = pixels[i + 2];
    } else {
      const t = a / 255;
      rgb[o++] = Math.round(pixels[i] * t + back[0] * (1 - t));
      rgb[o++] = Math.round(pixels[i + 1] * t + back[1] * (1 - t));
      rgb[o++] = Math.round(pixels[i + 2] * t + back[2] * (1 - t));
    }
  }
  // per row: the PNG filter (none, sub, up, average, Paeth) with the smallest sum of absolute values
  const raw = Buffer.alloc((stride + 1) * height);
  const src = new Uint8Array(rgb.buffer, rgb.byteOffset, rgb.length);
  const t1 = new Uint8Array(stride);
  const t2 = new Uint8Array(stride);
  const t3 = new Uint8Array(stride);
  const t4 = new Uint8Array(stride);
  const zero = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const cur = src.subarray(row, row + stride);
    const prev = y > 0 ? src.subarray(row - stride, row) : zero;
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let s4 = 0;
    for (let x = 0; x < stride; x++) {
      const v = cur[x];
      const b = prev[x];
      let a = 0;
      let c = 0;
      if (x >= 3) {
        a = cur[x - 3];
        c = prev[x - 3];
      }
      const p = a + b - c;
      const pa = p > a ? p - a : a - p;
      const pb = p > b ? p - b : b - p;
      const pc = p > c ? p - c : c - p;
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const f1 = (v - a) & 0xff;
      const f2 = (v - b) & 0xff;
      const f3 = (v - ((a + b) >> 1)) & 0xff;
      const f4 = (v - paeth) & 0xff;
      t1[x] = f1;
      t2[x] = f2;
      t3[x] = f3;
      t4[x] = f4;
      s0 += v < 128 ? v : 256 - v;
      s1 += f1 < 128 ? f1 : 256 - f1;
      s2 += f2 < 128 ? f2 : 256 - f2;
      s3 += f3 < 128 ? f3 : 256 - f3;
      s4 += f4 < 128 ? f4 : 256 - f4;
    }
    let filter = 0;
    let best = s0;
    let pick = cur;
    if (s1 < best) {
      filter = 1;
      best = s1;
      pick = t1;
    }
    if (s2 < best) {
      filter = 2;
      best = s2;
      pick = t2;
    }
    if (s3 < best) {
      filter = 3;
      best = s3;
      pick = t3;
    }
    if (s4 < best) {
      filter = 4;
      pick = t4;
    }
    const o = y * (stride + 1);
    raw[o] = filter;
    raw.set(pick, o + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB, no alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
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

// ───────────────────────────── resampling ─────────────────────────────

function lanczos(x) {
  if (x === 0) return 1;
  if (x <= -3 || x >= 3) return 0;
  const px = Math.PI * x;
  return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
}

/** Per output sample: first source index and normalised weights (Lanczos-3, widened when shrinking). */
function resampleTable(srcN, dstN) {
  const scale = dstN / srcN;
  const support = scale < 1 ? 3 / scale : 3;
  const table = new Array(dstN);
  for (let i = 0; i < dstN; i++) {
    const centre = (i + 0.5) / scale - 0.5;
    const lo = Math.max(0, Math.ceil(centre - support));
    const hi = Math.min(srcN - 1, Math.floor(centre + support));
    const w = new Float64Array(hi - lo + 1);
    let sum = 0;
    for (let k = lo; k <= hi; k++) {
      const v = lanczos(scale < 1 ? (k - centre) * scale : k - centre);
      w[k - lo] = v;
      sum += v;
    }
    for (let k = 0; k < w.length; k++) w[k] /= sum;
    table[i] = { lo, w };
  }
  return table;
}

/**
 * Scales a decoded image ({ width, height, channels, data }) to w×h with a Lanczos-3 filter.
 * Returns an image with the same number of channels. An image that already has the size is
 * returned unchanged.
 */
function resizeImage(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const ch = img.channels;
  const xs = resampleTable(img.width, w);
  const ys = resampleTable(img.height, h);
  // horizontal pass into floats
  const mid = new Float32Array(w * img.height * ch);
  for (let y = 0; y < img.height; y++) {
    const row = y * img.width * ch;
    const out = y * w * ch;
    for (let x = 0; x < w; x++) {
      const t = xs[x];
      for (let c = 0; c < ch; c++) {
        let acc = 0;
        for (let k = 0; k < t.w.length; k++) acc += img.data[row + (t.lo + k) * ch + c] * t.w[k];
        mid[out + x * ch + c] = acc;
      }
    }
  }
  // vertical pass
  const data = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) {
    const t = ys[y];
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < ch; c++) {
        let acc = 0;
        for (let k = 0; k < t.w.length; k++) acc += mid[(t.lo + k) * w * ch + x * ch + c] * t.w[k];
        data[(y * w + x) * ch + c] = acc < 0 ? 0 : acc > 255 ? 255 : Math.round(acc);
      }
    }
  }
  return { width: w, height: h, channels: ch, data };
}

module.exports = { ROOT, STORE_PORT, sleep, ping, startServer, pngInfo, decodePng, encodeRgbPng, toOpaqueRgbPng, resizeImage, writeFile };
