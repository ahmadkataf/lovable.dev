// Rasterise ../../site/icon.svg into public/icon-192.png, icon-512.png and a
// full-bleed maskable 512 with Playwright's Chromium.
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/icons.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch { /* try next */ }
  }
  throw new Error('playwright not found');
}
const { chromium } = loadPlaywright();
const here = dirname(fileURLToPath(import.meta.url));
const client = join(here, '..');
const svg = readFileSync(join(client, 'public', 'icon.svg'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(size, { maskable } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? Math.round(size * 0.8) : size;
  const pad = Math.round((size - inner) / 2);
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${maskable ? '#f3f7fd' : 'transparent'}">
    <div style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
  </body></html>`);
  const name = maskable ? `icon-${size}-maskable.png` : `icon-${size}.png`;
  await page.screenshot({ path: join(client, 'public', name), omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote public/' + name);
}
await render(192);
await render(512);
await render(512, { maskable: true });
await browser.close();
