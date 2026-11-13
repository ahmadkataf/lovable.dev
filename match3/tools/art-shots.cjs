/**
 * Screenshots every section of the art gallery (gallery.html) into shots/art/*.png so the artwork
 * can be reviewed. Dev tool only.
 *
 *   node tools/art-shots.cjs                 all sections
 *   node tools/art-shots.cjs gems,board      only these gallery parts (gems, board, extras, icons, backdrops, logos, checks)
 *   ART_OUT=some/dir node tools/art-shots.cjs   write the PNGs somewhere else (default shots/art)
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

async function main() {
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
