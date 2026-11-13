/**
 * Google Play listing graphics, rendered from the game's own art module (src/art/index.ts:
 * createArt().paintBackdrop / emblem / logo / sprite) so the store always shows the game's real art.
 *
 *   node tools/store/make-graphics.cjs            write the files listed below
 *   node tools/store/make-graphics.cjs --force    also re-create icon-512.png if it already exists
 *
 * Writes into store/graphics/ (STORE_GFX_OUT=<dir> writes somewhere else, e.g. for a preview):
 *   feature-graphic.png      1024×500, English wordmark   — 24-bit PNG, no alpha channel
 *   feature-graphic-ar.png   1024×500, Arabic wordmark    — 24-bit PNG, no alpha channel
 *   icon-512.png             512×512 listing icon, full-bleed square, fully opaque, no rounded
 *                            corners — ONLY if the file does not exist yet (tools/android/make-icons.cjs
 *                            normally writes it together with the launcher icons, so both match)
 *
 * The script starts the dev server itself (`npx vite --port 5188 --strictPort` in the match3
 * directory) and stops it afterwards; if a server already answers on 5188 it is reused and left
 * running. Playwright is the globally installed one (`require('playwright')`); never run
 * "playwright install".
 *
 * Google Play rules these files follow (docs/research/play-policy.md):
 *   - feature graphic: JPEG or 24-bit PNG (no alpha), exactly 1024×500, focal point centred, no
 *     ranking / price / promotional words, no device imagery, no store badges;
 *   - icon: 512×512 PNG, full square (Google Play applies its own mask and shadow), no ranking text.
 *
 * Composition of the feature graphic (all sizes in the 1024×500 space, painted at 2× and scaled
 * down for clean edges). FEATURE below holds every number, so the layout is easy to tune:
 *   backdrop of one chapter → soft scrims so the lettering stands clear → the emblem on top of the
 *   wordmark and tagline (the lower half of the game's own logo lockup, drawn larger than in the
 *   stock lockup so the name reads at thumbnail size) → a pile of gems in each lower corner.
 * Everything that carries meaning stays inside the middle of the canvas; the gem piles may touch
 * the edges on purpose (they are decoration and may be cropped by rounded store cards).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { ROOT, startServer, encodeRgbPng, pngInfo, decodePng, writeFile } = require('./lib.cjs');

const PORT = 5188;
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
  /** chapter backdrop: the oasis — the first chapter, and the place the Arabic title names */
  theme: process.env.STORE_GFX_THEME || 'oasis',
  /** strength of the night-coloured veil over the backdrop, 0 (none) … 1 (strong) */
  veil: process.env.STORE_GFX_VEIL ? Number(process.env.STORE_GFX_VEIL) : 0.38,
  /** emblem (launcher artwork): centre and diameter */
  emblem: { cx: 512, cy: 122, size: 198 },
  /** logo lockup the wordmark and tagline are taken from: its width and where its lower half goes */
  lockup: { width: 620, top: 227 },
  /**
   * Gems: [sprite key, centre x, centre y, size, rotation in degrees], listed back to front.
   * The piles stay left of x = 240 and right of x = 784 so they never touch the tagline's ornaments.
   */
  gems: [
    // left pile
    ['gem4', 66, 300, 96, -12],
    ['gem1', 158, 330, 104, 10],
    ['nova3', 78, 410, 136, -6],
    ['gem0', 170, 436, 112, 12],
    // right pile
    ['gem5', 958, 300, 96, 12],
    ['gem2', 866, 330, 104, -10],
    ['beamH1', 940, 410, 136, 6],
    ['gem3', 846, 436, 112, -12],
    // floating accents near the top corners (deliberately not mirrored)
    ['prism', 118, 104, 112, -8],
    ['gem2', 222, 190, 62, 16],
    ['nova0', 908, 114, 104, 8],
    ['gem4', 800, 186, 62, -18],
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

  function feature(lang) {
    const F = opts.feature;
    const S = F.scale;
    const W = F.width * S;
    const H = F.height * S;
    const c = canvas(W, H);
    const g = c.getContext('2d');

    // 1. the chapter backdrop, full bleed
    art.paintBackdrop(g, F.theme, W, H);

    // 2. scrims: a night-coloured veil that deepens toward the edges, plus a darker pool behind the lettering
    g.save();
    const veil = g.createRadialGradient(W / 2, H * 0.46, H * 0.2, W / 2, H * 0.5, W * 0.62);
    const v = F.veil;
    veil.addColorStop(0, 'rgba(20,18,58,' + (0.1 * v).toFixed(3) + ')');
    veil.addColorStop(0.55, 'rgba(20,18,58,' + (0.34 * v).toFixed(3) + ')');
    veil.addColorStop(1, 'rgba(12,10,40,' + (0.78 * v).toFixed(3) + ')');
    g.fillStyle = veil;
    g.fillRect(0, 0, W, H);
    const pool = g.createRadialGradient(W / 2, H * 0.66, 0, W / 2, H * 0.66, W * 0.36);
    pool.addColorStop(0, 'rgba(14,11,46,' + (0.62 * v).toFixed(3) + ')');
    pool.addColorStop(0.6, 'rgba(14,11,46,' + (0.3 * v).toFixed(3) + ')');
    pool.addColorStop(1, 'rgba(14,11,46,0)');
    g.fillStyle = pool;
    g.save();
    g.translate(W / 2, H * 0.66);
    g.scale(1, 0.52);
    g.translate(-W / 2, -H * 0.66);
    g.fillRect(0, -H, W, H * 3);
    g.restore();
    // warm halo behind the emblem
    const halo = g.createRadialGradient(F.emblem.cx * S, F.emblem.cy * S, 0, F.emblem.cx * S, F.emblem.cy * S, F.emblem.size * S * 0.95);
    halo.addColorStop(0, 'rgba(255,222,130,0.42)');
    halo.addColorStop(0.5, 'rgba(255,214,120,0.14)');
    halo.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    g.restore();

    // 3. gem piles (back to front), each with a soft contact shadow
    for (let i = 0; i < F.gems.length; i++) {
      const [key, x, y, size, deg] = F.gems[i];
      const px = Math.round(size * S);
      const sprite = art.sprite(key, px);
      g.save();
      g.translate(x * S, y * S);
      g.rotate((deg * Math.PI) / 180);
      g.shadowColor = 'rgba(6,4,28,0.55)';
      g.shadowBlur = px * 0.12;
      g.shadowOffsetY = px * 0.05;
      g.drawImage(sprite, -px / 2, -px / 2);
      g.restore();
    }

    // 4. emblem
    const E = Math.round(F.emblem.size * S);
    const emblem = art.emblem(E);
    g.save();
    g.shadowColor = 'rgba(6,4,28,0.6)';
    g.shadowBlur = E * 0.08;
    g.shadowOffsetY = E * 0.03;
    g.drawImage(emblem, Math.round(F.emblem.cx * S - E / 2), Math.round(F.emblem.cy * S - E / 2));
    g.restore();

    // 5. wordmark + tagline: the lower half of the game's own logo lockup
    const LW = F.lockup.width * S;
    const logo = art.logo(LW / window.devicePixelRatio, lang);
    const sy = Math.round(logo.width * 0.5);
    const sh = logo.height - sy;
    const dw = LW;
    const dh = Math.round((sh / logo.width) * LW);
    g.drawImage(logo, 0, sy, logo.width, sh, Math.round(W / 2 - dw / 2), Math.round(F.lockup.top * S), dw, dh);

    // 6. a few glints
    const glints = [
      [322, 70, 13, 0.9],
      [706, 58, 9, 0.8],
      [258, 300, 8, 0.7],
      [770, 292, 10, 0.75],
      [120, 232, 7, 0.7],
      [906, 236, 7, 0.7],
    ];
    for (let i = 0; i < glints.length; i++) sparkle(g, glints[i][0] * S, glints[i][1] * S, glints[i][2] * S, glints[i][3]);

    return downscale(c, F.width, F.height);
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
  out['feature-graphic.png'] = { width: opts.feature.width, height: opts.feature.height, rgba: toBase64(feature('en')) };
  out['feature-graphic-ar.png'] = { width: opts.feature.width, height: opts.feature.height, rgba: toBase64(feature('ar')) };
  if (opts.icon) out['icon-512.png'] = { width: 512, height: 512, rgba: toBase64(icon(512)) };
  return out;
}

/** Fully opaque 32-bit PNG check for an existing icon; returns a problem string or ''. */
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
  const server = await startServer(PORT);
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
  for (const name of Object.keys(files)) {
    const f = files[name];
    const rgba = Buffer.from(f.rgba, 'base64');
    // Every file is flattened to an opaque 24-bit PNG: nothing here may carry transparency.
    const png = encodeRgbPng(f.width, f.height, rgba, 4);
    const file = path.join(OUT, name);
    writeFile(file, png);
    const info = pngInfo(png);
    console.log('  ' + name + '  ' + info.width + '×' + info.height + '  colour type ' + info.colorType + ' (RGB, no alpha)  ' + png.length + ' bytes');
  }
  if (!makeIcon) {
    const problem = iconProblem(iconFile);
    if (problem) {
      console.error('  icon-512.png exists but ' + problem + ' — run again with --force to re-create it');
      process.exitCode = 1;
    } else {
      console.log('  icon-512.png  kept (already there: 512×512, fully opaque). Use --force to re-create it here.');
    }
  }
}

main().catch((err) => {
  console.error('make-graphics: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
