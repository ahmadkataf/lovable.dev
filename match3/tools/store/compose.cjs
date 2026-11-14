/**
 * Lays out the upload files of the store screenshots (used by make-screenshots.cjs).
 *
 * An upload file is: a plain background in the game's own indigo with a soft glow, ONE short caption
 * in the game's font (Baloo Bhaijaan 2), and the capture of the real game — scaled down as a whole
 * (Lanczos, in lib.cjs), its corners masked round, a gold line around it. The captured pixels are
 * not touched in any other way: the scaled capture is placed 1:1, pixel for pixel, and
 * check-kit.cjs proves it by scaling the raw capture again and comparing it with the upload file.
 *
 *   openStage(browser)                 a blank page with the game's bundled font → page
 *   fitCaptions(page, specs)           the one font size that fits every caption of a set
 *   composeFinal(page, spec)           → { png (24-bit, no alpha), measure }
 *   contactSheet(page, rows, title)    → png of every upload file side by side
 */
const fs = require('fs');
const path = require('path');
const { ROOT, toOpaqueRgbPng, encodeRgbPng } = require('./lib.cjs');

const FONT_DIR = path.join(ROOT, 'node_modules', '@fontsource-variable', 'baloo-bhaijaan-2', 'files');
const FONT_FAMILY = 'Baloo Bhaijaan 2 Variable';

/** The game's palette (docs/DESIGN.md §3). */
const PALETTE = {
  night: '#14123a',
  indigo: '#231f5c',
  violet: '#3a2a7a',
  gold: '#f5c95a',
  lightGold: '#ffe7a3',
  brass: '#b8862e',
  cream: '#fff6dc',
  ink: '#120e3a',
};

function fontCss() {
  const face = (file, range) =>
    "@font-face{font-family:'" + FONT_FAMILY + "';font-style:normal;font-display:block;font-weight:400 800;" +
    "src:url(data:font/woff2;base64," + fs.readFileSync(path.join(FONT_DIR, file)).toString('base64') + ") format('woff2-variations');" +
    'unicode-range:' + range + '}';
  return (
    face('baloo-bhaijaan-2-arabic-wght-normal.woff2', 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC') +
    face('baloo-bhaijaan-2-latin-wght-normal.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')
  );
}

const STAGE_HTML =
  '<!doctype html><meta charset="utf-8"><title>store screenshot stage</title><style>' +
  fontCss() +
  'html,body{margin:0;background:' + PALETTE.night + '}' +
  '#stage{position:relative;overflow:hidden}' +
  '#glow,#vignette{position:absolute;left:0;top:0;right:0;bottom:0}' +
  "#cap{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'" + FONT_FAMILY + "';font-weight:800;text-align:center}" +
  '.line{position:relative;display:grid;white-space:nowrap}' +
  '.line>span{grid-area:1/1}' +
  '.edge{color:' + PALETTE.ink + ';-webkit-text-stroke-color:' + PALETTE.ink + '}' +
  '.face{position:relative}' +
  '.l1 .face{color:' + PALETTE.cream + '}' +
  '.l2 .face{color:' + PALETTE.gold + ';background:linear-gradient(180deg,' + PALETTE.lightGold + ' 18%,' + PALETTE.gold + ' 62%,#e9a93a 96%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}' +
  '#frame{position:absolute}' +
  '#shot{position:absolute;display:block}' +
  '</style><body><div id="stage"><div id="glow"></div><div id="vignette"></div><div id="cap"></div><div id="frame"><img id="shot" alt=""></div></div></body>';

async function openStage(browser) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 2560 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(STAGE_HTML, { waitUntil: 'load' });
  const ok = await page.evaluate(async (family) => {
    const sample = 'Zumurud زمرد 120';
    await document.fonts.load("800 60px '" + family + "'", sample);
    return document.fonts.check("800 60px '" + family + "'", sample);
  }, FONT_FAMILY);
  if (!ok) throw new Error('the bundled font did not load — captions would use a fallback font');
  return page;
}

/** Geometry of an upload file of W×H that shows a capture of rawW×rawH. All numbers are whole pixels. */
function geometry(layout, device, rawW, rawH) {
  const W = device.width;
  const H = device.height;
  const shotW = Math.round(layout.shot[device.id] * W);
  const shotH = Math.round((shotW * rawH) / rawW);
  const line = Math.max(3, Math.round(layout.line * W));
  const bottom = Math.round(layout.bottom * W);
  const radius = Math.round(layout.radius * W);
  const x = Math.round((W - shotW) / 2);
  const y = H - bottom - line - shotH;
  return {
    W,
    H,
    shot: { x, y, w: shotW, h: shotH },
    frame: { x: x - line, y: y - line, w: shotW + 2 * line, h: shotH + 2 * line },
    line,
    radius,
    /** everything above the frame */
    band: y - line,
    gap: Math.round(layout.gap * W),
  };
}

/** Runs in the page: builds the caption and returns its measured boxes. */
function layCaption(spec) {
  const cap = document.getElementById('cap');
  cap.innerHTML = '';
  cap.setAttribute('dir', spec.lang === 'ar' ? 'rtl' : 'ltr');
  cap.setAttribute('lang', spec.lang);
  cap.style.top = spec.pad + 'px';
  cap.style.height = spec.band - spec.gap - spec.pad + 'px';
  cap.style.fontSize = spec.fontSize + 'px';
  cap.style.lineHeight = String(spec.lineHeight);
  const stroke = Math.max(2, Math.round(spec.fontSize * 0.085));
  const boxes = [];
  spec.lines.forEach((text, i) => {
    const line = document.createElement('div');
    line.className = 'line l' + (i + 1);
    const edge = document.createElement('span');
    edge.className = 'edge';
    edge.textContent = text;
    edge.style.webkitTextStrokeWidth = stroke * 2 + 'px';
    edge.style.textShadow = '0 ' + Math.round(spec.fontSize * 0.07) + 'px 0 #120e3a, 0 ' + Math.round(spec.fontSize * 0.1) + 'px ' + Math.round(spec.fontSize * 0.16) + 'px rgba(6,4,30,0.55)';
    const face = document.createElement('span');
    face.className = 'face';
    face.textContent = text;
    line.appendChild(edge);
    line.appendChild(face);
    cap.appendChild(line);
    const r = face.getBoundingClientRect();
    boxes.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  });
  return { boxes, stroke };
}

/**
 * The largest font size (px) at which every caption of the set fits its band: no line wider than
 * `maxLine` × W, the block no taller than the band. One size for the whole set.
 *   specs: [{ lang, lines, geo }]   → font size in px
 */
async function fitCaptions(page, specs, layout) {
  let size = Infinity;
  for (const spec of specs) {
    const geo = spec.geo;
    const pad = Math.round(geo.gap * 1.15);
    const lh = layout.lineHeight[spec.lang];
    let font = Math.floor(layout.font[spec.lang] * geo.W);
    // height: the lines must fit between the top padding and the gap above the frame
    font = Math.min(font, Math.floor((geo.band - geo.gap - pad) / (spec.lines.length * lh)));
    await page.setViewportSize({ width: geo.W, height: geo.H });
    const widest = await page.evaluate(
      ([fn, s]) => {
        // eslint-disable-next-line no-new-func
        const lay = new Function('return (' + fn + ')')();
        const out = lay(s);
        return Math.max.apply(null, out.boxes.map((b) => b.w));
      },
      [layCaption.toString(), { lang: spec.lang, lines: spec.lines, pad, band: geo.band, gap: geo.gap, fontSize: font, lineHeight: lh }],
    );
    const limit = layout.maxLine * geo.W;
    if (widest > limit) font = Math.floor((font * limit) / widest);
    size = Math.min(size, font);
  }
  return size;
}

/**
 * One upload file.
 *   spec: { geo, lang, lines, tint, fontSize, lineHeight, shotPng (Buffer: the capture already scaled to geo.shot) }
 *   → { png, measure: { captionBox: { x, y, w, h }, captionShare, bandShare, fontSize } }
 */
async function composeFinal(page, spec) {
  const geo = spec.geo;
  await page.setViewportSize({ width: geo.W, height: geo.H });
  const pad = Math.round(geo.gap * 1.15);
  const measure = await page.evaluate(
    async ([fn, s, g, palette, shotUrl, tint]) => {
      const stage = document.getElementById('stage');
      stage.style.width = g.W + 'px';
      stage.style.height = g.H + 'px';
      // plain background: the game's indigo, a little lighter at the top
      stage.style.background = 'linear-gradient(180deg,#2a2272 0%,#1f1a58 ' + Math.round((100 * g.band) / g.H + 6) + '%,' + palette.night + ' 100%)';
      // a soft glow in the colour of the world on show, behind the caption
      const glow = document.getElementById('glow');
      glow.style.background =
        'radial-gradient(ellipse ' + Math.round(g.W * 0.72) + 'px ' + Math.round(g.band * 1.15) + 'px at 50% ' + Math.round(g.band * 0.42) + 'px,' + tint + '8c 0%,' + tint + '38 48%,' + tint + '00 100%)';
      const vignette = document.getElementById('vignette');
      vignette.style.background = 'radial-gradient(ellipse ' + Math.round(g.W * 0.95) + 'px ' + Math.round(g.H * 0.75) + 'px at 50% 46%,rgba(8,6,32,0) 55%,rgba(8,6,32,0.5) 100%)';

      const frame = document.getElementById('frame');
      frame.style.left = g.frame.x + 'px';
      frame.style.top = g.frame.y + 'px';
      frame.style.width = g.frame.w + 'px';
      frame.style.height = g.frame.h + 'px';
      frame.style.borderRadius = g.radius + g.line + 'px';
      frame.style.background = 'linear-gradient(180deg,' + palette.lightGold + ' 0%,' + palette.gold + ' 40%,' + palette.brass + ' 100%)';
      const rim = Math.max(2, Math.round(g.line * 0.5));
      frame.style.boxShadow = '0 0 0 ' + rim + 'px ' + palette.ink + ',0 ' + Math.round(g.W * 0.016) + 'px ' + Math.round(g.W * 0.05) + 'px rgba(4,2,22,0.6)';

      const shot = document.getElementById('shot');
      shot.style.left = g.line + 'px';
      shot.style.top = g.line + 'px';
      shot.style.width = g.shot.w + 'px';
      shot.style.height = g.shot.h + 'px';
      shot.style.borderRadius = g.radius + 'px';
      await new Promise((resolve, reject) => {
        shot.onload = () => resolve();
        shot.onerror = () => reject(new Error('the capture did not load'));
        shot.src = shotUrl;
      });
      if (shot.naturalWidth !== g.shot.w || shot.naturalHeight !== g.shot.h) throw new Error('the capture is ' + shot.naturalWidth + '×' + shot.naturalHeight + ', its place is ' + g.shot.w + '×' + g.shot.h);

      // eslint-disable-next-line no-new-func
      const lay = new Function('return (' + fn + ')')();
      const out = lay(s);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const b of out.boxes) {
        x0 = Math.min(x0, b.x - out.stroke);
        y0 = Math.min(y0, b.y);
        x1 = Math.max(x1, b.x + b.w + out.stroke);
        y1 = Math.max(y1, b.y + b.h);
      }
      await document.fonts.ready;
      return { captionBox: { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) } };
    },
    [
      layCaption.toString(),
      { lang: spec.lang, lines: spec.lines, pad, band: geo.band, gap: geo.gap, fontSize: spec.fontSize, lineHeight: spec.lineHeight },
      geo,
      PALETTE,
      'data:image/png;base64,' + spec.shotPng.toString('base64'),
      spec.tint,
    ],
  );
  const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: geo.W, height: geo.H } });
  const png = toOpaqueRgbPng(shot);
  measure.captionShare = (measure.captionBox.w * measure.captionBox.h) / (geo.W * geo.H);
  measure.bandShare = geo.band / geo.H;
  measure.fontSize = spec.fontSize;
  return { png, measure };
}

/**
 * Every upload file of one language side by side, small — for a quick look.
 *   rows: [{ label, cell: { w, h }, items: [{ file, label }] }]
 */
async function contactSheet(browser, rows, title) {
  const gap = 18;
  const width = Math.max.apply(null, rows.map((r) => r.items.length * (r.cell.w + gap) + gap));
  const context = await browser.newContext({ viewport: { width, height: 200 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const html =
    '<!doctype html><meta charset="utf-8"><style>' + fontCss() +
    "body{margin:0;background:#0f0d2c;color:#c9c2e6;font:600 17px '" + FONT_FAMILY + "',sans-serif}" +
    'h1{margin:0;padding:16px ' + gap + 'px 0;font-size:24px;color:#ffe7a3}h2{margin:0;padding:14px ' + gap + 'px 6px;font-size:18px;color:#fff6dc}' +
    '.row{display:flex;gap:' + gap + 'px;padding:0 ' + gap + 'px 10px}.cell img{display:block;border-radius:6px}.cell div{padding-top:4px;font-size:14px}' +
    '</style><body><h1>' + title + '</h1>' +
    rows
      .map(
        (r) =>
          '<h2>' + r.label + '</h2><div class="row">' +
          r.items
            .map(
              (it) =>
                '<div class="cell"><img width="' + r.cell.w + '" height="' + r.cell.h + '" src="data:image/png;base64,' + fs.readFileSync(it.file).toString('base64') + '"><div>' + it.label + '</div></div>',
            )
            .join('') +
          '</div>',
      )
      .join('') +
    '</body>';
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all(Array.from(document.images).map((img) => (img.decode ? img.decode().catch(() => undefined) : undefined))));
  const png = toOpaqueRgbPng(await page.screenshot({ type: 'png', fullPage: true }));
  await context.close();
  return png;
}

module.exports = { PALETTE, FONT_FAMILY, openStage, geometry, fitCaptions, composeFinal, contactSheet, encodeRgbPng };
