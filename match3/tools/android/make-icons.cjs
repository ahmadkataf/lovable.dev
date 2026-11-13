/**
 * Generates every launcher / store icon of the Android app from the game's own emblem
 * (src/art → createArt().emblem(px)), so the icon always matches the art in the game.
 *
 *   1. start the dev server:   npx vite --port 5187 --strictPort      (in the match3 directory)
 *   2. run:                    node tools/android/make-icons.cjs
 *
 * The script starts nothing itself: it opens a blank page on that dev server, imports
 * /src/art/index.ts there and draws with it. ICONS_URL overrides the server address.
 * If the art module cannot be loaded it falls back to a plain placeholder gem and says so loudly
 * (exit code 3), so nobody ships the placeholder by accident.
 *
 * Writes:
 *   android/app/src/main/res/mipmap-<density>/ic_launcher_foreground.png   adaptive foreground, 108dp
 *   android/app/src/main/res/drawable/ic_launcher_background.xml           adaptive background (vector)
 *   android/app/src/main/res/mipmap-<density>/ic_launcher.png              legacy square icon (API 24–25)
 *   android/app/src/main/res/mipmap-<density>/ic_launcher_round.png        legacy round icon  (API 25)
 *   store/graphics/icon-512.png                                            Google Play listing icon
 *   shots/android/icon-preview.png                                         contact sheet to look at
 *
 * drawable/ic_launcher_monochrome.xml (the themed-icon layer) is hand-written and only previewed here.
 *
 * Geometry (adaptive icon, in dp on the 108dp layer canvas): launchers show the middle 72dp through
 * their own mask; only the middle 66dp is guaranteed visible. The emblem's star spans STAR_DP inside
 * that safe zone; the round medallion plate behind it fades out before the edge of the safe zone,
 * so no launcher mask can ever cut through a visible edge. The background layer continues the
 * plate's colours to the corners.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const STORE_ICON = path.join(ROOT, 'store', 'graphics', 'icon-512.png');
const PREVIEW = path.join(ROOT, 'shots', 'android', 'icon-preview.png');
const MONOCHROME_XML = path.join(RES, 'drawable', 'ic_launcher_monochrome.xml');
const BACKGROUND_XML = path.join(RES, 'drawable', 'ic_launcher_background.xml');
const SERVER = (process.env.ICONS_URL || 'http://127.0.0.1:5187').replace(/\/$/, '');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** Shared by the canvas painter (in the page) and the vector background written below. */
const GEOMETRY = {
  layerDp: 108,
  visibleDp: 72,
  /** Tip-to-tip size of the star. The emblem draws it at 60% of its own box. */
  starDp: 58,
  /** Plate fade, as fractions of the emblem box measured from its centre: opaque up to → gone at. */
  fadeFrom: 0.315,
  fadeTo: 0.365,
  /** The emblem's plate gradient (src/art/logo.ts), in emblem units (box = 100), centre offset −8 in y. */
  plate: { dy: -8, r0: 4, r1: 48, stops: [[0, '#5a41b4'], [0.5, '#2f2478'], [1, '#161240']] },
  halo: { r0: 10, r1: 44, color: [255, 214, 120], alpha: 0.5 },
  rays: { count: 16, halfAngle: 0.07, color: [255, 231, 163], alpha: 0.07, lengthDp: 90 },
};

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function hex2(n) {
  return Math.round(n).toString(16).padStart(2, '0').toUpperCase();
}

function fix(n) {
  return String(Math.round(n * 100) / 100);
}

/** The adaptive icon's background layer as a vector drawable: the same paint as paintBackground() below. */
function backgroundVectorXml() {
  const g = GEOMETRY;
  const emblemDp = g.starDp / 0.6;
  const u = emblemDp / 100; // dp per emblem unit
  const c = g.layerDp / 2;
  const plateStops = [
    [g.plate.r0 / g.plate.r1, g.plate.stops[0][1]],
    [(g.plate.r0 + (g.plate.r1 - g.plate.r0) * g.plate.stops[1][0]) / g.plate.r1, g.plate.stops[1][1]],
    [1, g.plate.stops[2][1]],
  ];
  const haloRgb = g.halo.color.map(hex2).join('');
  const rayRgb = g.rays.color.map(hex2).join('');
  let rays = '';
  for (let i = 0; i < g.rays.count; i++) {
    const a = (i / g.rays.count) * Math.PI * 2;
    const x0 = c + Math.cos(a - g.rays.halfAngle) * g.rays.lengthDp;
    const y0 = c + Math.sin(a - g.rays.halfAngle) * g.rays.lengthDp;
    const x1 = c + Math.cos(a + g.rays.halfAngle) * g.rays.lengthDp;
    const y1 = c + Math.sin(a + g.rays.halfAngle) * g.rays.lengthDp;
    rays += `M${c},${c} L${fix(x0)},${fix(y0)} L${fix(x1)},${fix(y1)} Z `;
  }
  const item = (offset, color) => `                    <item android:offset="${fix(offset)}" android:color="${color}" />`;
  return `<?xml version="1.0" encoding="utf-8"?>
<!--
    Adaptive-icon background: the emblem's indigo medallion colours carried to the corners, with
    its faint gold rays. GENERATED by tools/android/make-icons.cjs — edit the script, not this file.
-->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:centerX="${fix(c)}"
                android:centerY="${fix(c + g.plate.dy * u)}"
                android:gradientRadius="${fix(g.plate.r1 * u)}"
                android:type="radial">
${plateStops.map(([o, col]) => item(o, '#FF' + col.slice(1).toUpperCase())).join('\n')}
            </gradient>
        </aapt:attr>
    </path>
    <path
        android:fillColor="#${hex2(g.rays.alpha * 255)}${rayRgb}"
        android:pathData="${rays.trim()}" />
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:centerX="${fix(c)}"
                android:centerY="${fix(c)}"
                android:gradientRadius="${fix(g.halo.r1 * u)}"
                android:type="radial">
${item(0, '#' + hex2(g.halo.alpha * 255) + haloRgb)}
${item(g.halo.r0 / g.halo.r1, '#' + hex2(g.halo.alpha * 255) + haloRgb)}
${item(1, '#00' + haloRgb)}
            </gradient>
        </aapt:attr>
    </path>
</vector>
`;
}

/** Pulls the paths out of the hand-written monochrome vector so the preview shows the real thing. */
function readMonochromePaths() {
  const xml = fs.readFileSync(MONOCHROME_XML, 'utf8');
  const paths = [];
  const re = /<path\b([^>]*)\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    const data = /android:pathData="([^"]+)"/.exec(m[1]);
    if (!data) continue;
    paths.push({ d: data[1].replace(/\s+/g, ' '), evenOdd: /android:fillType="evenOdd"/.test(m[1]) });
  }
  if (paths.length === 0) throw new Error('no <path> found in ' + MONOCHROME_XML);
  return paths;
}

/** Runs inside the page. Returns { files: {name: dataUrl}, placeholder: boolean, error?: string }. */
async function renderInPage({ geometry, densities, monochrome }) {
  const g = geometry;
  let emblem;
  let placeholder = false;
  let error = '';
  try {
    const art = await import('/src/art/index.ts');
    const api = art.createArt();
    emblem = (px) => api.emblem(px);
    const probe = emblem(64);
    if (!(probe instanceof HTMLCanvasElement) || probe.width !== 64) throw new Error('emblem() returned something unexpected');
  } catch (err) {
    placeholder = true;
    error = String(err && err.message ? err.message : err);
    // Plain stand-in so the build still has an icon: a red round gem in a gold eight-pointed star.
    emblem = (px) => {
      const c = document.createElement('canvas');
      c.width = c.height = px;
      const x = c.getContext('2d');
      x.scale(px / 100, px / 100);
      x.fillStyle = '#231f5c';
      x.beginPath();
      x.arc(50, 50, 47, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#f5c95a';
      x.beginPath();
      const k = Math.SQRT1_2 / Math.cos(Math.PI / 8);
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 8;
        const r = i % 2 === 0 ? 30 : 30 * k;
        x.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r);
      }
      x.closePath();
      x.fill();
      x.fillStyle = '#ff4d5e';
      x.beginPath();
      x.arc(50, 50, 14, 0, Math.PI * 2);
      x.fill();
      return c;
    };
  }

  const emblemDp = g.starDp / 0.6;
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h === undefined ? w : h;
    return c;
  };

  /** Foreground layer: `px` = size of the 108dp canvas in pixels. */
  function foreground(px) {
    const s = px / g.layerDp;
    const e = Math.round(emblemDp * s);
    const em = canvas(e);
    const ex = em.getContext('2d');
    ex.drawImage(emblem(e), 0, 0);
    // fade the medallion plate out towards the edge of the safe zone
    const mask = ex.createRadialGradient(e / 2, e / 2, e * g.fadeFrom, e / 2, e / 2, e * g.fadeTo);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ex.globalCompositeOperation = 'destination-in';
    ex.fillStyle = mask;
    ex.fillRect(0, 0, e, e);
    const out = canvas(px);
    out.getContext('2d').drawImage(em, Math.round((px - e) / 2), Math.round((px - e) / 2));
    return out;
  }

  /** Background layer painted into ctx; the 108dp canvas maps to [0, px]. Mirrors the vector drawable. */
  function paintBackground(ctx, px) {
    const s = px / g.layerDp;
    const u = (emblemDp / 100) * s;
    const c = px / 2;
    const plate = ctx.createRadialGradient(c, c + g.plate.dy * u, g.plate.r0 * u, c, c + g.plate.dy * u, g.plate.r1 * u);
    for (const [o, col] of g.plate.stops) plate.addColorStop(o, col);
    ctx.fillStyle = plate;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = 'rgba(' + g.rays.color.join(',') + ',' + g.rays.alpha + ')';
    for (let i = 0; i < g.rays.count; i++) {
      const a = (i / g.rays.count) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(a - g.rays.halfAngle) * g.rays.lengthDp * s, c + Math.sin(a - g.rays.halfAngle) * g.rays.lengthDp * s);
      ctx.lineTo(c + Math.cos(a + g.rays.halfAngle) * g.rays.lengthDp * s, c + Math.sin(a + g.rays.halfAngle) * g.rays.lengthDp * s);
      ctx.closePath();
      ctx.fill();
    }
    const halo = ctx.createRadialGradient(c, c, g.halo.r0 * u, c, c, g.halo.r1 * u);
    halo.addColorStop(0, 'rgba(' + g.halo.color.join(',') + ',' + g.halo.alpha + ')');
    halo.addColorStop(1, 'rgba(' + g.halo.color.join(',') + ',0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, px, px);
  }

  /** Both layers, cropped to the middle `windowDp` and scaled to `px` pixels: what a launcher shows before masking. */
  function composite(px, windowDp) {
    const layerPx = Math.round((px * g.layerDp) / windowDp);
    const layer = canvas(layerPx);
    const lx = layer.getContext('2d');
    paintBackground(lx, layerPx);
    lx.drawImage(foreground(layerPx), 0, 0);
    const out = canvas(px);
    const off = Math.round((layerPx - px) / 2);
    out.getContext('2d').drawImage(layer, -off, -off);
    return out;
  }

  const shapes = {
    circle(ctx, x, y, size) {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    },
    squircle(ctx, x, y, size) {
      const a = size / 2;
      ctx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const t = (i / 128) * Math.PI * 2;
        const cs = Math.cos(t);
        const sn = Math.sin(t);
        const px = x + a + a * Math.sign(cs) * Math.pow(Math.abs(cs), 0.5);
        const py = y + a + a * Math.sign(sn) * Math.pow(Math.abs(sn), 0.5);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    },
    rounded(ctx, x, y, size, radiusFraction) {
      const r = size * (radiusFraction === undefined ? 0.22 : radiusFraction);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + size, y, x + size, y + size, r);
      ctx.arcTo(x + size, y + size, x, y + size, r);
      ctx.arcTo(x, y + size, x, y, r);
      ctx.arcTo(x, y, x + size, y, r);
      ctx.closePath();
    },
  };

  /** `image` masked by a shape, on a transparent `canvasPx` canvas with the shape `shapePx` wide, centred. */
  function masked(image, canvasPx, shapePx, shape, radiusFraction) {
    const out = canvas(canvasPx);
    const ctx = out.getContext('2d');
    const off = (canvasPx - shapePx) / 2;
    ctx.save();
    shapes[shape](ctx, off, off, shapePx, radiusFraction);
    ctx.clip();
    ctx.drawImage(image, off, off, shapePx, shapePx);
    ctx.restore();
    return out;
  }

  /** Themed icon as Android 13+ draws it: the monochrome layer tinted, on a tonal plate. */
  function themed(px, tint, plate) {
    const layerPx = Math.round((px * g.layerDp) / g.visibleDp);
    const layer = canvas(layerPx);
    const lx = layer.getContext('2d');
    lx.fillStyle = plate;
    lx.fillRect(0, 0, layerPx, layerPx);
    lx.save();
    lx.scale(layerPx / g.layerDp, layerPx / g.layerDp);
    lx.fillStyle = tint;
    for (const p of monochrome) lx.fill(new Path2D(p.d), p.evenOdd ? 'evenodd' : 'nonzero');
    lx.restore();
    const out = canvas(px);
    const off = Math.round((layerPx - px) / 2);
    out.getContext('2d').drawImage(layer, -off, -off);
    return out;
  }

  const files = {};
  for (const [name, scale] of Object.entries(densities)) {
    files['mipmap-' + name + '/ic_launcher_foreground.png'] = foreground(Math.round(108 * scale)).toDataURL('image/png');
    const legacy = Math.round(48 * scale);
    // Legacy launcher icons (48dp): the same picture a launcher would show, masked by hand.
    const roundShape = Math.round(44 * scale);
    const squareShape = Math.round(40 * scale);
    files['mipmap-' + name + '/ic_launcher_round.png'] = masked(composite(roundShape, g.visibleDp), legacy, roundShape, 'circle').toDataURL('image/png');
    files['mipmap-' + name + '/ic_launcher.png'] = masked(composite(squareShape, g.visibleDp), legacy, squareShape, 'rounded', 0.2).toDataURL('image/png');
  }
  // Google Play: full-bleed square, opaque, no rounded corners, no shadow (Play masks it itself).
  files['store-icon'] = composite(512, g.visibleDp).toDataURL('image/png');

  // ── contact sheet ──
  const sizes = [192, 96, 48];
  const columns = [
    ['circle mask', (px) => masked(composite(px, g.visibleDp), px, px, 'circle')],
    ['squircle mask', (px) => masked(composite(px, g.visibleDp), px, px, 'squircle')],
    ['rounded square', (px) => masked(composite(px, g.visibleDp), px, px, 'rounded', 0.22)],
    ['legacy round', (px) => masked(composite(Math.round((px * 44) / 48), g.visibleDp), px, Math.round((px * 44) / 48), 'circle')],
    ['legacy square', (px) => masked(composite(Math.round((px * 40) / 48), g.visibleDp), px, Math.round((px * 40) / 48), 'rounded', 0.2)],
    ['themed (light)', (px) => masked(themed(px, '#1d3a6e', '#d6e3ff'), px, px, 'circle')],
    ['themed (dark)', (px) => masked(themed(px, '#c9d8ff', '#2b3a57'), px, px, 'circle')],
    ['Play (30% corners)', (px) => masked(composite(px, g.visibleDp), px, px, 'rounded', 0.3)],
  ];
  const cellW = 216;
  const sheetW = cellW * columns.length + 24;
  const rowsH = sizes.reduce((sum, s) => sum + s + 28, 0);
  const sheet = canvas(sheetW, rowsH + 56 + 250);
  const sx = sheet.getContext('2d');
  // wallpaper-like backdrop, half light and half dark, so both kinds of home screen are shown
  sx.fillStyle = '#e9e6f2';
  sx.fillRect(0, 0, sheetW, sheet.height);
  sx.fillStyle = '#1b1b22';
  sx.fillRect(0, 56 + sizes[0] + 28, sheetW, sizes[1] + 28);
  sx.font = '600 15px system-ui, sans-serif';
  sx.textAlign = 'center';
  columns.forEach(([label, make], i) => {
    const cx = 12 + cellW * i + cellW / 2;
    sx.fillStyle = '#222';
    sx.fillText(label, cx, 30);
    let y = 56;
    for (const size of sizes) {
      sx.drawImage(make(size), Math.round(cx - size / 2), y);
      y += size + 28;
    }
  });
  // bottom strip: the raw layers
  const stripY = 56 + rowsH + 10;
  sx.fillStyle = '#222';
  sx.textAlign = 'left';
  sx.fillText('foreground on checker / on the splash colour / background layer / both layers 108dp with safe zone (66dp) and visible area (72dp)', 16, stripY + 14);
  const layerPx = 216;
  const fg = foreground(layerPx);
  const y0 = stripY + 24;
  for (let yy = 0; yy < layerPx; yy += 12) {
    for (let xx = 0; xx < layerPx; xx += 12) {
      sx.fillStyle = ((xx + yy) / 12) % 2 === 0 ? '#ffffff' : '#c8c8c8';
      sx.fillRect(16 + xx, y0 + yy, 12, 12);
    }
  }
  sx.drawImage(fg, 16, y0);
  sx.fillStyle = '#14123a';
  sx.fillRect(16 + 232, y0, layerPx, layerPx);
  sx.drawImage(fg, 16 + 232, y0);
  const bg = canvas(layerPx);
  paintBackground(bg.getContext('2d'), layerPx);
  sx.drawImage(bg, 16 + 464, y0);
  sx.drawImage(bg, 16 + 696, y0);
  sx.drawImage(fg, 16 + 696, y0);
  sx.strokeStyle = 'rgba(255,255,255,0.8)';
  sx.lineWidth = 1;
  for (const dp of [66, 72]) {
    sx.beginPath();
    sx.arc(16 + 696 + layerPx / 2, y0 + layerPx / 2, (dp / g.layerDp) * layerPx * 0.5, 0, Math.PI * 2);
    sx.stroke();
  }
  // the 48px icons again at 4× (nearest neighbour) to judge legibility
  sx.imageSmoothingEnabled = false;
  [0, 1, 5].forEach((col, i) => {
    sx.drawImage(columns[col][1](48), 16 + 940 + i * 208, y0, 192, 192);
  });
  sx.imageSmoothingEnabled = true;
  sx.fillStyle = '#222';
  sx.fillText('48px ×4', 16 + 940, y0 + 210);
  files.preview = sheet.toDataURL('image/png');

  return { files, placeholder, error };
}

async function main() {
  if (!(await ping(SERVER + '/src/art/index.ts'))) {
    console.error(
      'make-icons: no dev server at ' + SERVER + '\n' +
        '  start one first:  (cd ' + ROOT + ' && npx vite --port 5187 --strictPort)',
    );
    process.exit(2);
  }
  const monochrome = readMonochromePaths();
  const browser = await chromium.launch();
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('[page exception] ' + err.message));
    const blank = SERVER + '/__zumurud_icons__.html';
    await page.route(blank, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>icons</title><body></body>' }),
    );
    await page.goto(blank, { waitUntil: 'load' });
    result = await page.evaluate(renderInPage, { geometry: GEOMETRY, densities: DENSITIES, monochrome });
  } finally {
    await browser.close();
  }

  const write = (file, dataUrl) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('  ' + path.relative(ROOT, file) + '  ' + fs.statSync(file).size + ' bytes');
  };
  console.log('make-icons: writing');
  for (const [name, dataUrl] of Object.entries(result.files)) {
    if (name === 'store-icon') write(STORE_ICON, dataUrl);
    else if (name === 'preview') write(PREVIEW, dataUrl);
    else write(path.join(RES, name), dataUrl);
  }
  fs.writeFileSync(BACKGROUND_XML, backgroundVectorXml());
  console.log('  ' + path.relative(ROOT, BACKGROUND_XML));

  if (result.placeholder) {
    console.error(
      '\nmake-icons: WARNING — the art module could not be used (' + result.error + ').\n' +
        '  The icons were drawn from a PLACEHOLDER gem. Re-run this script once src/art renders the emblem.',
    );
    process.exit(3);
  }
  console.log('make-icons: done (emblem from src/art). Look at ' + path.relative(ROOT, PREVIEW));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
