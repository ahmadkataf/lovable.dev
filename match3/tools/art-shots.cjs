/**
 * Screenshots every section of the art gallery (gallery.html) into shots/art/*.png so the artwork
 * can be reviewed. Dev tool only.
 *
 *   node tools/art-shots.cjs                 all sections
 *   node tools/art-shots.cjs gems,board      only these gallery parts (gems, board, extras, icons, backdrops, logos, checks)
 *   ART_OUT=some/dir node tools/art-shots.cjs   write the PNGs somewhere else (default shots/art)
 *   node tools/art-shots.cjs --verify        no screenshots: mechanical contract check + render cost
 *
 * Uses the dev server at http://127.0.0.1:5181 (ART_PORT / ART_URL override); if none is running it
 * starts `vite --port 5181 --strictPort` itself and stops it afterwards.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.ART_PORT || 5181);
const URL_BASE = process.env.ART_URL || 'http://127.0.0.1:' + PORT + '/gallery.html';
const OUT = process.env.ART_OUT ? path.resolve(process.env.ART_OUT) : path.join(ROOT, 'shots', 'art');

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

async function ensureServer() {
  if (await ping(URL_BASE)) return null;
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await ping(URL_BASE)) return child;
  }
  child.kill();
  throw new Error('dev server did not start on port ' + PORT);
}

/** Every key the CONTRACT (src/art/types.ts) declares, read from the type unions themselves. */
function contractKeys() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'art', 'types.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const union = (name) => {
    const m = new RegExp('export type ' + name + ' =([\\s\\S]*?);').exec(src);
    if (!m) throw new Error('type ' + name + ' not found in src/art/types.ts');
    const out = [];
    for (const lit of m[1].match(/'[^']+'|`[^`]+`/g) || []) {
      const body = lit.slice(1, -1);
      if (lit[0] === '`') for (let c = 0; c < 6; c++) out.push(body.replace('${Color}', String(c)));
      else out.push(body);
    }
    return out;
  };
  return { sprites: union('SpriteKey'), icons: union('IconKey'), themes: union('ChapterTheme') };
}

/**
 * Mechanical contract check + cost measurement (node tools/art-shots.cjs --verify):
 *  - importing src/art/index.ts and calling createArt() under plain Node must not throw
 *  - every SpriteKey / IconKey of the contract renders without an exception into a canvas of the
 *    right size that is not fully transparent; sprite() returns the same cached canvas for the same
 *    arguments; icon() returns a new canvas each time; iconUrl() is a stable PNG data URL
 *  - paintBackdrop is deterministic (two paints give identical pixels), opaque, and differs per theme
 *  - time to render every sprite at 96 px and every backdrop at 1080×2340 in headless Chromium
 */
async function verify() {
  const failures = [];
  const keys = contractKeys();
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync(
      process.execPath,
      ['-e', "import('./src/art/index.ts').then((m) => { const a = m.createArt(); if (typeof a.sprite !== 'function') throw new Error('no sprite()'); console.log('node-import-ok ' + a.gemColor(2) + ' ' + a.palette('oasis').frame); })"],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    if (out.indexOf('node-import-ok') < 0) failures.push('node import: unexpected output ' + out);
    else console.log('node import + createArt(): ok (' + out.trim() + ')');
  } catch (err) {
    failures.push('node import threw: ' + String(err.stderr || err.message).slice(0, 400));
  }

  const server = await ensureServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 3 });
    page.on('pageerror', (err) => failures.push('page exception: ' + err.message));
    await page.goto(URL_BASE + '?only=none', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__galleryReady === true, null, { timeout: 60000 });
    const res = await page.evaluate((keys) => {
      const fails = [];
      const art = window.__createArt();
      const impl = window.__artKeys;
      const alphaCount = (c) => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      };
      // implementation lists must equal the contract
      const same = (a, b) => a.length === b.length && a.slice().sort().join() === b.slice().sort().join();
      if (!same(keys.sprites, Array.from(impl.sprites))) fails.push('SPRITE_KEYS differs from the SpriteKey contract');
      if (!same(keys.icons, Array.from(impl.icons))) fails.push('ICON_KEYS differs from the IconKey contract');
      const sizes = [20, 36, 96];
      for (const k of keys.sprites) {
        for (const px of sizes) {
          try {
            const c = art.sprite(k, px);
            if (!(c instanceof HTMLCanvasElement)) fails.push('sprite ' + k + ': not a canvas');
            else {
              if (c.width !== px || c.height !== px) fails.push('sprite ' + k + '@' + px + ': size ' + c.width + 'x' + c.height);
              if (alphaCount(c) < px * px * 0.03) fails.push('sprite ' + k + '@' + px + ': (almost) fully transparent');
              if (art.sprite(k, px) !== c) fails.push('sprite ' + k + '@' + px + ': not cached');
            }
          } catch (e) {
            fails.push('sprite ' + k + '@' + px + ' threw: ' + e.message);
          }
        }
      }
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      for (const k of keys.icons.concat(keys.sprites)) {
        try {
          const a = art.icon(k, 24);
          const b = art.icon(k, 24);
          if (a === b) fails.push('icon ' + k + ': icon() returned the same canvas twice');
          if (a.width !== Math.round(24 * dpr) || a.style.width !== '24px') fails.push('icon ' + k + ': backing ' + a.width + ' css ' + a.style.width);
          if (alphaCount(a) < a.width * a.width * 0.03) fails.push('icon ' + k + ': (almost) fully transparent');
          const u = art.iconUrl(k, 24);
          if (typeof u !== 'string' || u.indexOf('data:image/png;base64,') !== 0 || u.length < 200) fails.push('iconUrl ' + k + ': not a PNG data URL');
          if (art.iconUrl(k, 24) !== u) fails.push('iconUrl ' + k + ': not stable');
        } catch (e) {
          fails.push('icon ' + k + ' threw: ' + e.message);
        }
      }
      // gem colours, palettes, logo, emblem
      for (let c = 0; c < 6; c++) if (!/^#[0-9a-f]{6}$/i.test(art.gemColor(c))) fails.push('gemColor ' + c);
      for (const t of keys.themes) {
        const p = art.palette(t);
        if (!p || !p.bgTop || !p.bgBottom || !p.accent || !p.frame) fails.push('palette ' + t);
      }
      for (const lang of ['en', 'ar']) {
        try {
          const l = art.logo(240, lang);
          if (l.style.width !== '240px' || alphaCount(l) < 1000) fails.push('logo ' + lang);
        } catch (e) {
          fails.push('logo ' + lang + ' threw: ' + e.message);
        }
      }
      try {
        const e = art.emblem(192);
        if (e.width !== 192 || e.height !== 192 || alphaCount(e) < 192 * 192 * 0.5) fails.push('emblem');
      } catch (e) {
        fails.push('emblem threw: ' + e.message);
      }
      // backdrops: deterministic, opaque, different per theme
      const sizesB = [[360, 640], [915, 412], [1080, 2340]];
      const firstHash = {};
      for (const t of keys.themes) {
        for (const [w, h] of sizesB) {
          const mk = () => {
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d');
            art.paintBackdrop(g, t, w, h);
            return g.getImageData(0, 0, w, h).data;
          };
          try {
            const a = mk();
            const b = mk();
            let diff = 0;
            let holes = 0;
            let hash = 2166136261;
            for (let i = 0; i < a.length; i++) {
              if (a[i] !== b[i]) diff++;
              if ((i & 3) === 3 && a[i] !== 255) holes++;
              if (i % 97 === 0) hash = Math.imul(hash ^ a[i], 16777619);
            }
            if (diff) fails.push('backdrop ' + t + ' ' + w + 'x' + h + ': two paints differ in ' + diff + ' bytes');
            if (holes) fails.push('backdrop ' + t + ' ' + w + 'x' + h + ': ' + holes + ' pixels not opaque');
            if (w === 360) firstHash[t] = hash >>> 0;
          } catch (e) {
            fails.push('backdrop ' + t + ' threw: ' + e.message);
          }
        }
      }
      const hs = Object.keys(firstHash).map((t) => firstHash[t]);
      if (new Set(hs).size !== hs.length) fails.push('two themes paint the same backdrop');
      // paintBackdrop must leave the context state as it found it
      {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const g = c.getContext('2d');
        g.globalAlpha = 0.5;
        g.fillStyle = '#123456';
        art.paintBackdrop(g, 'bazaar', 64, 64);
        if (g.globalAlpha !== 0.5 || g.fillStyle !== '#123456') fails.push('paintBackdrop leaks context state');
      }

      // ── cost ──
      const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
      const perSprite = {};
      const totals = [];
      for (let run = 0; run < 7; run++) {
        const fresh = window.__createArt();
        let total = 0;
        for (const k of keys.sprites) {
          const t0 = performance.now();
          const c = fresh.sprite(k, 96);
          c.getContext('2d').getImageData(0, 0, 1, 1);
          const dt = performance.now() - t0;
          total += dt;
          (perSprite[k] = perSprite[k] || []).push(dt);
        }
        totals.push(total);
      }
      let worst = '';
      let worstMs = 0;
      for (const k of keys.sprites) {
        const m = median(perSprite[k]);
        if (m > worstMs) {
          worstMs = m;
          worst = k;
        }
      }
      const backdrop = {};
      const big = document.createElement('canvas');
      big.width = 1080;
      big.height = 2340;
      const bg = big.getContext('2d');
      for (const t of keys.themes) {
        const ts = [];
        for (let run = 0; run < 5; run++) {
          const t0 = performance.now();
          art.paintBackdrop(bg, t, 1080, 2340);
          bg.getImageData(0, 0, 1, 1);
          ts.push(performance.now() - t0);
        }
        backdrop[t] = Math.round(median(ts) * 10) / 10;
      }
      const iconT0 = performance.now();
      const fresh2 = window.__createArt();
      for (const k of keys.icons) fresh2.sprite(k, 72).getContext('2d').getImageData(0, 0, 1, 1);
      const iconsMs = performance.now() - iconT0;
      return {
        fails,
        counts: { sprites: keys.sprites.length, icons: keys.icons.length, themes: keys.themes.length },
        cost: {
          allSprites96: Math.round(median(totals) * 10) / 10,
          perSpriteAvg: Math.round((median(totals) / keys.sprites.length) * 100) / 100,
          worstSprite: worst + ' ' + Math.round(worstMs * 100) / 100,
          allIcons72: Math.round(iconsMs * 10) / 10,
          backdrop1080x2340: backdrop,
        },
      };
    }, keys);
    for (const f of res.fails) failures.push(f);
    console.log('contract keys: ' + JSON.stringify(res.counts));
    console.log('cost (ms, headless Chromium): ' + JSON.stringify(res.cost));
    const slow = Object.keys(res.cost.backdrop1080x2340).filter((t) => res.cost.backdrop1080x2340[t] > 150);
    if (slow.length) failures.push('backdrop slower than 150 ms: ' + slow.join(', '));
    if (res.cost.perSpriteAvg > 5) failures.push('sprites slower than 5 ms each on average');
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  if (failures.length) {
    console.log('VERIFY FAILED:\n  ' + failures.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('VERIFY OK');
  }
}

async function main() {
  if (process.argv.indexOf('--verify') >= 0) return verify();
  const only = process.argv[2] && !process.argv[2].startsWith('http') ? process.argv[2] : '';
  fs.mkdirSync(OUT, { recursive: true });
  const server = await ensureServer();
  const browser = await chromium.launch();
  let failed = false;
  try {
    const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') console.log('[page ' + msg.type() + '] ' + msg.text());
    });
    page.on('pageerror', (err) => {
      failed = true;
      console.log('[page exception] ' + err.message);
    });
    await page.goto(URL_BASE + (only ? '?only=' + encodeURIComponent(only) : ''), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__galleryReady === true, null, { timeout: 120000 });
    const errors = await page.$$eval('pre:not(.report)', (list) => list.map((p) => p.textContent));
    for (const e of errors) {
      failed = true;
      console.log(e);
    }
    const sections = await page.$$('[data-shot]');
    for (const s of sections) {
      const name = await s.getAttribute('data-shot');
      const file = path.join(OUT, name + '.png');
      await s.screenshot({ path: file });
      const box = await s.boundingBox();
      console.log('shot ' + name + '.png  ' + Math.round(box.width * 2) + 'x' + Math.round(box.height * 2));
    }
    const checks = await page.evaluate(() => window.__galleryChecks);
    if (checks) {
      console.log(checks.ok ? 'self-checks: all passed' : 'self-checks FAILED:\n  ' + checks.failures.join('\n  '));
      if (checks.notes.length) console.log('  notes: ' + checks.notes.join('; '));
      if (!checks.ok) failed = true;
    }
    const timings = await page.evaluate(() => window.__galleryTimings);
    if (timings && Object.keys(timings).length) console.log('paintBackdrop 1440x3120 ms: ' + JSON.stringify(timings));
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
