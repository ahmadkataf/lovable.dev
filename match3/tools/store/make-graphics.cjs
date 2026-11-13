/**
 * Google Play listing graphics, rendered from the game's own art module (src/art/index.ts:
 * createArt().paintBackdrop / emblem / logo / sprite) so the store always shows the game's real art.
 *
 *   node tools/store/make-graphics.cjs            write the feature graphics, check the icon
 *   node tools/store/make-graphics.cjs --force    also re-create icon-512.png from the current emblem
 *
 * Writes into store/graphics/ (STORE_GFX_OUT=<dir> writes somewhere else, e.g. for a preview):
 *   feature-graphic.png      1024×500, English wordmark   — 24-bit PNG, no alpha channel
 *   feature-graphic-ar.png   1024×500, Arabic wordmark    — 24-bit PNG, no alpha channel
 *   icon-512.png             512×512 listing icon, full-bleed square, fully opaque, no rounded
 *                            corners — written here only with --force or when the file is missing.
 *                            Normally tools/android/make-icons.cjs writes it together with the
 *                            launcher icons, so the two always match. Every run compares the file
 *                            with the emblem the game draws today and says so; a stale icon is an
 *                            error (exit code 1) with the command that puts it right.
 *
 * The feature graphic is a BANNER, not a screenshot: it is composed from the game's own art —
 * a world backdrop, the emblem, the wordmark, gem sprites — and shows no board, no button and no
 * interface, so it cannot be taken for gameplay.
 *
 * It starts the game's dev server itself on port 5189 (STORE_PORT; no hot reload) and stops it
 * afterwards; a server already running there is reused. Playwright is the globally installed one
 * (`require('playwright')`); never run "playwright install".
 *
 * Google Play rules these files follow (docs/research/play-policy.md):
 *   - feature graphic: JPEG or 24-bit PNG (no alpha), exactly 1024×500, focal point centred, no
 *     ranking / price / promotional words, no device imagery, no store badges;
 *   - icon: 512×512 PNG, full square (Google Play applies its own mask and shadow), no ranking text.
 *
 * Composition (all numbers in the 1024×500 space, painted at 2× and scaled down; FEATURE below
 * holds every one of them):
 *   the Oasis backdrop, full bleed → a night veil toward the edges and soft rays behind the middle
 *   → a burst of gems to the left and right → the emblem above the wordmark, both large, no small
 *   lettering at all.
 * What must stay readable sits in the middle: the emblem and the wordmark keep inside the central
 * 66 % of the width and 82 % of the height (Play rounds the corners and crops a little on some
 * surfaces); the exact centre falls into the gap between emblem and wordmark, which is where Play
 * puts its play button when a promo video is set. The gems may touch the edges on purpose.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { ROOT, STORE_PORT, startServer, encodeRgbPng, pngInfo, decodePng, writeFile } = require('./lib.cjs');
const { emblemDifference, ICON_MATCH_LIMIT } = require('./icon-check.cjs');

const OUT = process.env.STORE_GFX_OUT ? path.resolve(process.env.STORE_GFX_OUT) : path.join(ROOT, 'store', 'graphics');
const FORCE = process.argv.includes('--force');

const FONT_DIR = '/node_modules/@fontsource-variable/baloo-bhaijaan-2/files/';
/** A blank page on the dev server's origin, with the game's bundled font declared. */
const STAGE_HTML =
  '<!doctype html><meta charset="utf-8"><title>store graphics</title><style>' +
  "@font-face{font-family:'Baloo Bhaijaan 2 Variable';font-style:normal;font-display:block;font-weight:400 800;" +
  'src:url(' + FONT_DIR + "baloo-bhaijaan-2-arabic-wght-normal.woff2) format('woff2-variations');" +
  'unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}' +
  "@font-face{font-family:'Baloo Bhaijaan 2 Variable';font-style:normal;font-display:block;font-weight:400 800;" +
  'src:url(' + FONT_DIR + "baloo-bhaijaan-2-latin-wght-normal.woff2) format('woff2-variations');" +
  'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}' +
  'html,body{margin:0;background:#14123a}</style><body></body>';

/** Layout of the feature graphic, in 1024×500 units. */
const FEATURE = {
  width: 1024,
  height: 500,
  /** supersampling factor */
  scale: 2,
  /** chapter backdrop: the oasis — the first world, and the place the Arabic title names */
  theme: process.env.STORE_GFX_THEME || 'oasis',
  /** strength of the night-coloured veil over the backdrop, 0 (none) … 1 (strong) */
  veil: process.env.STORE_GFX_VEIL ? Number(process.env.STORE_GFX_VEIL) : 0.42,
  /** emblem (launcher artwork): centre and diameter */
  emblem: { cx: 512, cy: 121, size: 186 },
  /** soft rays behind the lockup: centre, reach, number of rays, strength */
  rays: { cx: 512, cy: 156, reach: 560, count: 22, alpha: 0.085 },
  /**
   * The wordmark (cut out of the game's own logo lockup, without the tagline), per language: the
   * top of its lettering, and the box the lettering is fitted into (as wide and as tall as these
   * allow). The Arabic name is four letters, so it is set taller to carry the same weight.
   */
  wordmark: { en: { top: 286, maxWidth: 652, maxHeight: 176 }, ar: { top: 251, maxWidth: 652, maxHeight: 204 } },
  /**
   * Gems: [sprite key, centre x, centre y, size, rotation in degrees], listed back to front.
   * In the wordmark's rows the gems stay left of x = 166 and right of x = 858.
   */
  gems: [
    // left burst
    ['gem2', 276, 178, 68, 16],
    ['gem4', 56, 236, 108, -12],
    ['prism', 152, 100, 132, -8],
    ['nova3', 52, 440, 132, -6],
    ['gem1', 102, 346, 124, 10],
    ['gem0', 168, 470, 96, 12],
    // right burst (deliberately not a mirror image)
    ['gem4', 752, 176, 64, -18],
    ['gem5', 968, 240, 108, 12],
    ['nova0', 876, 102, 124, 8],
    ['beamH1', 972, 440, 132, 6],
    ['gem2', 922, 346, 124, -10],
    ['gem3', 858, 472, 96, -12],
  ],
  /** glints: [x, y, radius, opacity] */
  glints: [
    [330, 66, 13, 0.9],
    [700, 54, 9, 0.8],
    [226, 246, 8, 0.7],
    [806, 250, 10, 0.75],
    [206, 418, 7, 0.65],
    [824, 410, 7, 0.65],
  ],
};

/** Runs inside the page. Returns raw RGBA pixels (base64) per file. */
async function renderInPage(opts) {
  const FONT = '"Baloo Bhaijaan 2 Variable"';
  const mod = await import('/src/art/index.ts');
  const brand = (await import('/src/app/brand.ts')).BRAND;
  const art = mod.createArt();

  // The wordmark must be set in the game's bundled font, never in a fallback.
  const names = brand.name.en + ' ' + brand.name.ar;
  const tags = brand.tagline.en + ' ' + brand.tagline.ar;
  await Promise.all([document.fonts.load('800 40px ' + FONT, names), document.fonts.load('600 20px ' + FONT, tags)]);
  if (!document.fonts.check('800 40px ' + FONT, names) || !document.fonts.check('600 20px ' + FONT, tags)) {
    throw new Error('the bundled font did not load — the wordmark would use a fallback font');
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function toBase64(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let s = '';
    const step = 0x8000;
    for (let i = 0; i < d.length; i += step) s += String.fromCharCode.apply(null, d.subarray(i, i + step));
    return btoa(s);
  }
  /** Scale a canvas down to w×h in halving steps (clean edges for lettering). */
  function downscale(src, w, h) {
    let cur = src;
    while (cur.width / 2 >= w * 1.0001 && cur.width / 2 >= w) {
      const half = canvas(Math.max(w, Math.round(cur.width / 2)), Math.max(h, Math.round(cur.height / 2)));
      const g = half.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, half.width, half.height);
      cur = half;
      if (cur.width === w) break;
    }
    if (cur.width !== w || cur.height !== h) {
      const out = canvas(w, h);
      const g = out.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, w, h);
      cur = out;
    }
    return cur;
  }

  function sparkle(g, x, y, r, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#fffbe6';
    g.beginPath();
    const w = r * 0.16;
    g.moveTo(x, y - r);
    g.quadraticCurveTo(x + w, y - w, x + r, y);
    g.quadraticCurveTo(x + w, y + w, x, y + r);
    g.quadraticCurveTo(x - w, y + w, x - r, y);
    g.quadraticCurveTo(x - w, y - w, x, y - r);
    g.fill();
    g.restore();
  }

  /**
   * The wordmark alone, cut out of the game's logo lockup (emblem on top, wordmark, tagline):
   * the rows between the emblem and the tagline. Returns the canvas and the box of its lettering.
   */
  function wordmark(lang) {
    const logo = art.logo(1200 / window.devicePixelRatio, lang);
    const W = logo.width;
    const data = logo.getContext('2d').getImageData(0, 0, W, logo.height).data;
    const rowInk = (y) => {
      let n = 0;
      for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 96) n++;
      return n;
    };
    // the emptiest row between the wordmark band and the tagline: the cut goes there
    let cut = Math.round(W * 0.79);
    let least = Infinity;
    for (let y = Math.round(W * 0.765); y < Math.round(W * 0.815); y++) {
      const n = rowInk(y);
      if (n < least) {
        least = n;
        cut = y;
      }
    }
    // the top cut: the emptiest row between the emblem's lower rim and the lettering
    let top = Math.round(W * 0.49);
    least = Infinity;
    for (let y = Math.round(W * 0.487); y < Math.round(W * 0.512); y++) {
      const n = rowInk(y);
      if (n < least) {
        least = n;
        top = y;
      }
    }
    const c = canvas(W, cut - top);
    const g = c.getContext('2d');
    g.drawImage(logo, 0, top, W, cut - top, 0, 0, W, cut - top);
    // feather the first and last rows (only the tails of the soft shadow are there)
    g.globalCompositeOperation = 'destination-out';
    const feather = Math.round(W * 0.012);
    const fade = g.createLinearGradient(0, c.height - feather, 0, c.height);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade;
    g.fillRect(0, c.height - feather, W, feather);
    const head = Math.round(W * 0.004);
    const fadeIn = g.createLinearGradient(0, 0, 0, head);
    fadeIn.addColorStop(0, 'rgba(0,0,0,1)');
    fadeIn.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fadeIn;
    g.fillRect(0, 0, W, head);
    // box of the lettering (solid pixels only, not the soft shadow)
    const d2 = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let y0 = c.height;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (d2[(y * c.width + x) * 4 + 3] > 200) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return { canvas: c, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
  }

  function feature(lang) {
    const F = opts.feature;
    const S = F.scale;
    const W = F.width * S;
    const H = F.height * S;
    const c = canvas(W, H);
    const g = c.getContext('2d');

    // 1. the chapter backdrop, full bleed
    art.paintBackdrop(g, F.theme, W, H);

    // 2. a night-coloured veil that deepens toward the edges, a darker pool behind the lettering
    g.save();
    const v = F.veil;
    const veil = g.createRadialGradient(W / 2, H * 0.46, H * 0.2, W / 2, H * 0.5, W * 0.62);
    veil.addColorStop(0, 'rgba(20,18,58,' + (0.08 * v).toFixed(3) + ')');
    veil.addColorStop(0.55, 'rgba(20,18,58,' + (0.36 * v).toFixed(3) + ')');
    veil.addColorStop(1, 'rgba(12,10,40,' + (0.86 * v).toFixed(3) + ')');
    g.fillStyle = veil;
    g.fillRect(0, 0, W, H);
    const pool = g.createRadialGradient(W / 2, H * 0.7, 0, W / 2, H * 0.7, W * 0.4);
    pool.addColorStop(0, 'rgba(14,11,46,' + (0.7 * v).toFixed(3) + ')');
    pool.addColorStop(0.6, 'rgba(14,11,46,' + (0.34 * v).toFixed(3) + ')');
    pool.addColorStop(1, 'rgba(14,11,46,0)');
    g.fillStyle = pool;
    g.translate(W / 2, H * 0.7);
    g.scale(1, 0.5);
    g.translate(-W / 2, -H * 0.7);
    g.fillRect(0, -H, W, H * 3);
    g.restore();

    // 3. soft rays behind the lockup, fading out with distance
    const R = F.rays;
    const rays = canvas(W, H);
    const rg = rays.getContext('2d');
    rg.translate(R.cx * S, R.cy * S);
    rg.fillStyle = 'rgba(255,236,170,' + R.alpha + ')';
    for (let i = 0; i < R.count; i++) {
      const a = (i / R.count) * Math.PI * 2 + 0.07;
      const half = (Math.PI / R.count) * 0.46;
      rg.beginPath();
      rg.moveTo(0, 0);
      rg.lineTo(Math.cos(a - half) * R.reach * S, Math.sin(a - half) * R.reach * S);
      rg.lineTo(Math.cos(a + half) * R.reach * S, Math.sin(a + half) * R.reach * S);
      rg.closePath();
      rg.fill();
    }
    rg.setTransform(1, 0, 0, 1, 0, 0);
    rg.globalCompositeOperation = 'destination-in';
    const mask = rg.createRadialGradient(R.cx * S, R.cy * S, 0, R.cx * S, R.cy * S, R.reach * S);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.45, 'rgba(0,0,0,0.75)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    rg.fillStyle = mask;
    rg.fillRect(0, 0, W, H);
    g.drawImage(rays, 0, 0);
    // warm halo behind the emblem
    const halo = g.createRadialGradient(F.emblem.cx * S, F.emblem.cy * S, 0, F.emblem.cx * S, F.emblem.cy * S, F.emblem.size * S * 1.05);
    halo.addColorStop(0, 'rgba(255,222,130,0.5)');
    halo.addColorStop(0.5, 'rgba(255,214,120,0.16)');
    halo.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);

    // 4. the burst of gems (back to front), each with a soft contact shadow
    for (let i = 0; i < F.gems.length; i++) {
      const [key, x, y, size, deg] = F.gems[i];
      const px = Math.round(size * S);
      const sprite = art.sprite(key, px);
      g.save();
      g.translate(x * S, y * S);
      g.rotate((deg * Math.PI) / 180);
      g.shadowColor = 'rgba(6,4,28,0.6)';
      g.shadowBlur = px * 0.14;
      g.shadowOffsetY = px * 0.06;
      g.drawImage(sprite, -px / 2, -px / 2);
      g.restore();
    }

    // 5. emblem
    const E = Math.round(F.emblem.size * S);
    const emblem = art.emblem(E);
    g.save();
    g.shadowColor = 'rgba(6,4,28,0.6)';
    g.shadowBlur = E * 0.08;
    g.shadowOffsetY = E * 0.03;
    g.drawImage(emblem, Math.round(F.emblem.cx * S - E / 2), Math.round(F.emblem.cy * S - E / 2));
    g.restore();

    // 6. the wordmark, as large as its box allows, its lettering starting at `top`
    const wm = wordmark(lang);
    const M = F.wordmark[lang];
    const k = Math.min((M.maxWidth * S) / wm.box.w, (M.maxHeight * S) / wm.box.h);
    const dx = W / 2 - (wm.box.x + wm.box.w / 2) * k;
    const dy = M.top * S - wm.box.y * k;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(wm.canvas, dx, dy, wm.canvas.width * k, wm.canvas.height * k);
    const placed = { x: (dx + wm.box.x * k) / S, y: (dy + wm.box.y * k) / S, w: (wm.box.w * k) / S, h: (wm.box.h * k) / S };

    // 7. a few glints
    for (let i = 0; i < F.glints.length; i++) sparkle(g, F.glints[i][0] * S, F.glints[i][1] * S, F.glints[i][2] * S, F.glints[i][3]);

    return { canvas: downscale(c, F.width, F.height), wordmark: placed };
  }

  /**
   * Listing icon, full bleed: the emblem's star and jewel as large as the square allows; the round
   * medallion plate is feathered out just beyond the star and its colours continue to the corners,
   * so there is no visible edge, no transparency and nothing for Google Play's mask to cut through.
   */
  function icon(size) {
    const S = 2;
    const N = size * S;
    const c = canvas(N, N);
    const g = c.getContext('2d');
    const E = Math.round(N * 1.36); // star tips (32.6% of the emblem) reach 44% of the icon
    const emblem = art.emblem(E);
    const eg = emblem.getContext('2d');
    // colour of the plate just outside the star, averaged around the circle
    let r = 0;
    let gr = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const d = eg.getImageData(Math.round(E / 2 + Math.cos(a) * E * 0.39), Math.round(E / 2 + Math.sin(a) * E * 0.39), 1, 1).data;
      if (d[3] > 250) {
        r += d[0];
        gr += d[1];
        b += d[2];
        n++;
      }
    }
    const edge = n ? 'rgb(' + Math.round(r / n) + ',' + Math.round(gr / n) + ',' + Math.round(b / n) + ')' : '#201853';
    const bg = g.createRadialGradient(N / 2, N / 2, E * 0.36, N / 2, N / 2, N * 0.74);
    bg.addColorStop(0, edge);
    bg.addColorStop(1, '#14123a');
    g.fillStyle = bg;
    g.fillRect(0, 0, N, N);
    // feather the plate: opaque to 37.5% of the emblem, gone at 40.5% (inside its gold rim)
    const masked = canvas(E, E);
    const mg = masked.getContext('2d');
    mg.drawImage(emblem, 0, 0);
    mg.globalCompositeOperation = 'destination-in';
    const mask = mg.createRadialGradient(E / 2, E / 2, E * 0.375, E / 2, E / 2, E * 0.405);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = mask;
    mg.fillRect(0, 0, E, E);
    g.drawImage(masked, Math.round(N / 2 - E / 2), Math.round(N / 2 - E / 2));
    return downscale(c, size, size);
  }

  const out = {};
  for (const [name, lang] of [
    ['feature-graphic.png', 'en'],
    ['feature-graphic-ar.png', 'ar'],
  ]) {
    const f = feature(lang);
    out[name] = { width: opts.feature.width, height: opts.feature.height, rgba: toBase64(f.canvas), wordmark: f.wordmark };
  }
  // the emblem as the game draws it today, on the game's night colour — the reference the icon is compared with
  const ref = canvas(512, 512);
  const refG = ref.getContext('2d');
  refG.fillStyle = '#14123a';
  refG.fillRect(0, 0, 512, 512);
  refG.drawImage(art.emblem(512), 0, 0);
  out['__emblem__'] = { width: 512, height: 512, rgba: toBase64(ref) };
  if (opts.icon) out['icon-512.png'] = { width: 512, height: 512, rgba: toBase64(icon(512)) };
  return out;
}

/** Fully opaque 512×512 check for an existing icon; returns a problem string or ''. */
function iconProblem(file) {
  try {
    const buf = fs.readFileSync(file);
    const info = pngInfo(buf);
    if (info.width !== 512 || info.height !== 512) return 'is ' + info.width + '×' + info.height + ', not 512×512';
    if (info.colorType === 6) {
      const img = decodePng(buf);
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return 'has transparent pixels';
    }
    return '';
  } catch (err) {
    return 'cannot be read (' + err.message + ')';
  }
}

async function main() {
  const iconFile = path.join(OUT, 'icon-512.png');
  const makeIcon = FORCE || !fs.existsSync(iconFile);
  const server = await startServer(STORE_PORT);
  let files;
  try {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const problems = [];
      page.on('pageerror', (err) => problems.push('page exception: ' + err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push('console error: ' + msg.text());
      });
      const stage = server.base + '__zumurud_store_graphics__.html';
      await page.route(stage, (route) => route.fulfill({ contentType: 'text/html', body: STAGE_HTML }));
      await page.goto(stage, { waitUntil: 'load' });
      files = await page.evaluate(renderInPage, { feature: FEATURE, icon: makeIcon });
      if (problems.length) throw new Error(problems.join('\n'));
    } finally {
      await browser.close();
    }
  } finally {
    await server.stop();
  }

  console.log('make-graphics: writing to ' + path.relative(process.cwd(), OUT));
  const emblem = files['__emblem__'];
  delete files['__emblem__'];
  for (const name of Object.keys(files)) {
    const f = files[name];
    const rgba = Buffer.from(f.rgba, 'base64');
    // Every file is flattened to an opaque 24-bit PNG: nothing here may carry transparency.
    const png = encodeRgbPng(f.width, f.height, rgba, 4);
    const file = path.join(OUT, name);
    writeFile(file, png);
    const info = pngInfo(png);
    let extra = '';
    if (f.wordmark) {
      const w = f.wordmark;
      extra = '  wordmark ' + Math.round(w.w) + '×' + Math.round(w.h) + ' at (' + Math.round(w.x) + ', ' + Math.round(w.y) + ') — ' + Math.round((100 * w.w) / f.width) + ' % of the width';
    }
    console.log('  ' + name + '  ' + info.width + '×' + info.height + '  colour type ' + info.colorType + ' (RGB, no alpha)  ' + png.length + ' bytes' + extra);
  }

  // the listing icon against the emblem the game draws today
  const problem = iconProblem(iconFile);
  if (problem) {
    console.error('  icon-512.png ' + problem + ' — run again with --force to re-create it');
    process.exitCode = 1;
    return;
  }
  const reference = { width: emblem.width, height: emblem.height, channels: 4, data: Buffer.from(emblem.rgba, 'base64') };
  const diff = emblemDifference(decodePng(fs.readFileSync(iconFile)), reference);
  if (diff === null || diff > ICON_MATCH_LIMIT) {
    console.error(
      '  icon-512.png does NOT show the emblem the game draws today (difference ' + (diff === null ? 'not measurable' : diff.toFixed(1)) + ', limit ' + ICON_MATCH_LIMIT + ').\n' +
        '  Re-create the launcher icons and this file together:  node tools/android/make-icons.cjs   (or only this file:  node tools/store/make-graphics.cjs --force)',
    );
    process.exitCode = 1;
  } else {
    console.log('  icon-512.png  ' + (makeIcon ? 're-created' : 'kept') + ': 512×512, fully opaque, shows the emblem the game draws today (difference ' + diff.toFixed(1) + ' of 255, limit ' + ICON_MATCH_LIMIT + ')');
  }
}

main().catch((err) => {
  console.error('make-graphics: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
