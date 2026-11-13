/**
 * Screenshot tool for the app shell and the meta screens (dev only).
 *
 *   node tools/meta-shots.cjs                 every scene, every size, both languages → shots/meta/*.png
 *   node tools/meta-shots.cjs map intro       only scenes whose name contains one of the words
 *   META_SIZES=360 META_LANGS=ar node tools/meta-shots.cjs shop
 *
 * Scenes: title, map at the start / mid-journey (level 47 current) / near the end / finished,
 * level intro (plain, hard, replay), lives at 0, shop with the simulated store and without,
 * settings, privacy policy, credits, daily reward, new booster, and the post-win celebration.
 * Sizes: 360×640, 412×915, 800×1280 (+ 320×480 and landscape 640×360 for the key scenes),
 * English and Arabic, deviceScaleFactor 2.
 *
 * Uses the dev server at http://127.0.0.1:5185 (META_PORT overrides); starts one if none is running.
 * The scenes run on a generated 120-level list (?mocklevels=120) with every feature unlocked
 * (?gate=off) unless META_REAL=1 is set.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.META_PORT || 5185);
const BASE = 'http://127.0.0.1:' + PORT + '/';
const OUT = path.join(ROOT, 'shots', 'meta');
const REAL = process.env.META_REAL === '1';

const SIZES = [
  { w: 360, h: 640, key: true },
  { w: 412, h: 915, key: true },
  { w: 800, h: 1280, key: true },
  { w: 320, h: 480, key: false },
  { w: 640, h: 360, key: false },
];
const LANGS = ['en', 'ar'];

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
  if (await ping(BASE)) return null;
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await ping(BASE)) return child;
  }
  child.kill();
  throw new Error('dev server did not start on port ' + PORT);
}

/** A save with levels 1..upTo won (stars vary), as the base64 the ?save= flag takes. */
function save(opts) {
  const o = Object.assign({ upTo: 0, coins: 2000, lives: 5, lifeAgoMs: 0, boosters: {}, dailyDay: -1, dailyStreak: 0 }, opts || {});
  const levels = {};
  for (let i = 1; i <= o.upTo; i++) levels[i] = { stars: 1 + ((i * 7 + 1) % 3), best: 2400 + ((i * 373) % 4000) };
  const data = {
    version: 1,
    levels,
    coins: o.coins,
    lives: o.lives,
    lifeTimer: o.lives >= 5 ? 0 : Date.now() - o.lifeAgoMs,
    boosters: Object.assign({ hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 2, prism: 0, beamNova: 1 }, o.boosters),
    settings: { sfx: true, music: true, haptics: true, lang: null },
    dailyDay: o.dailyDay,
    dailyStreak: o.dailyStreak,
    seen: [],
    stats: { played: o.upTo, won: o.upTo, bestCascade: 4, totalScore: o.upTo * 3000 },
    // a player who started a while ago and has met every booster (no "new booster" pop-ups, daily reward open)
    firstDay: today - 30,
    gifted: o.gifted || ['beamNova', 'hammer', 'freeSwap', 'prism', 'shuffle', 'extraMoves'],
    caravan: o.caravan || 0,
  };
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const today = Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000);

/**
 * Scenes. `query` = extra URL parameters; `run(page)` drives the app to the state to capture;
 * `after(page, shoot)` may take further captures (shoot(suffix)).
 */
const SCENES = [
  { name: 'title', key: true, query: {}, run: async () => {} },
  { name: 'title-returning', key: false, query: { save: save({ upTo: 46 }) }, run: async () => {} },
  { name: 'map-start', key: true, query: { screen: 'map', save: save({ upTo: 0, dailyDay: today, dailyStreak: 1 }) }, run: async () => {} },
  { name: 'map-early', key: false, query: { screen: 'map', save: save({ upTo: 3, dailyDay: today, dailyStreak: 1 }), gate: 'on' }, run: async () => {} },
  { name: 'map-mid', key: true, query: { screen: 'map', save: save({ upTo: 46, coins: 12850, lives: 3, lifeAgoMs: 400000, dailyDay: today, dailyStreak: 3 }) }, run: async () => {} },
  { name: 'map-chapter-seam', key: false, query: { screen: 'map', save: save({ upTo: 39, coins: 950, dailyDay: today, dailyStreak: 3 }) }, run: async () => {} },
  { name: 'map-end', key: true, query: { screen: 'map', save: save({ upTo: 117, coins: 70450, dailyDay: today - 1, dailyStreak: 3 }) }, run: async (page) => closeAll(page) },
  { name: 'map-finished', key: false, query: { screen: 'map', save: save({ upTo: 120, coins: 3210, dailyDay: today, dailyStreak: 3 }) }, run: async () => {} },
  {
    name: 'intro',
    key: true,
    query: { screen: 'map', save: save({ upTo: 46, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('intro', 47));
    },
  },
  {
    name: 'intro-hard',
    key: true,
    query: { screen: 'map', save: save({ upTo: 47, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('intro', 48));
      await sleep(500);
      await page.click('[data-booster="beamNova"]');
    },
  },
  {
    name: 'intro-replay',
    key: false,
    query: { screen: 'map', save: save({ upTo: 46, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('intro', 33));
    },
  },
  {
    name: 'lives-empty',
    key: true,
    query: { screen: 'map', mockstore: '1', save: save({ upTo: 46, lives: 0, lifeAgoMs: 500000, coins: 1200, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('lives'));
    },
  },
  {
    name: 'lives-some',
    key: false,
    query: { screen: 'map', save: save({ upTo: 46, lives: 3, lifeAgoMs: 100000, coins: 1200, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('lives'));
    },
  },
  {
    name: 'shop-store',
    key: true,
    query: { screen: 'map', mockstore: '1', save: save({ upTo: 46, coins: 1250, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('shop'));
    },
    after: async (page, shoot) => {
      for (const [suffix, f] of [
        ['-2', 0.42],
        ['-3', 1],
      ]) {
        await page.evaluate((frac) => {
          const body = document.querySelector('.m-dialog-shop .k-dialog__body');
          if (body) body.scrollTop = (body.scrollHeight - body.clientHeight) * frac;
        }, f);
        await sleep(250);
        await shoot(suffix);
      }
    },
  },
  {
    name: 'shop-plain',
    key: true,
    query: { screen: 'map', save: save({ upTo: 46, coins: 540, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('shop'));
    },
  },
  {
    name: 'settings',
    key: true,
    query: { mockstore: '1', save: save({ upTo: 46 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('settings'));
    },
    after: async (page, shoot) => {
      await page.evaluate(() => {
        const body = document.querySelector('.m-dialog-settings .k-dialog__body');
        if (body) body.scrollTop = body.scrollHeight;
      });
      await sleep(250);
      await shoot('-2');
    },
  },
  {
    name: 'privacy',
    key: true,
    query: { save: save({ upTo: 46 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('settings'));
      await sleep(400);
      await page.click('[data-act="privacy"]');
    },
  },
  {
    name: 'credits',
    key: true,
    query: { save: save({ upTo: 46 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('settings'));
      await sleep(400);
      await page.click('[data-act="credits"]');
    },
  },
  {
    name: 'daily',
    key: true,
    query: { screen: 'map', save: save({ upTo: 46, dailyDay: today - 1, dailyStreak: 3 }) },
    run: async () => {
      await sleep(700); // offered by itself
    },
    after: async (page, shoot) => {
      await page.click('[data-act="daily-claim"]');
      await sleep(700);
      await shoot('-claimed');
    },
  },
  {
    name: 'unlock',
    key: false,
    query: { screen: 'map', save: save({ upTo: 7, dailyDay: today, dailyStreak: 1 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.goto('unlock', 'hammer'));
    },
  },
  {
    name: 'celebrate',
    key: true,
    query: { screen: 'map', save: save({ upTo: 46, dailyDay: today, dailyStreak: 3 }), still: '0' },
    run: async (page) => {
      await page.evaluate(() => {
        window.__app.profile.recordWin(47, 3, 5200, 3);
        window.__app.goto('map', { justWon: 47 });
      });
      await sleep(1250); // the stars have popped, the lantern is on its way
    },
    after: async (page, shoot) => {
      await sleep(900);
      await shoot('-2');
      await sleep(1700);
      await shoot('-3');
    },
  },
];

async function closeAll(page) {
  await page.evaluate(() => window.__app.kit.closeAll());
}

function urlFor(scene, lang) {
  const q = Object.assign({ debug: '1', still: '1', lang }, REAL ? {} : { mocklevels: '120', gate: 'off' }, scene.query);
  if (q.gate === 'on') delete q.gate;
  if (q.still === '0') delete q.still;
  const parts = [];
  for (const k of Object.keys(q)) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
  return BASE + '?' + parts.join('&');
}

async function main() {
  const filters = process.argv.slice(2);
  const sizeFilter = (process.env.META_SIZES || '').split(',').filter(Boolean);
  const langFilter = (process.env.META_LANGS || '').split(',').filter(Boolean);
  const server = await ensureServer();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];
  let count = 0;
  try {
    for (const size of SIZES) {
      if (sizeFilter.length && sizeFilter.indexOf(String(size.w)) < 0) continue;
      const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, hasTouch: true });
      for (const lang of LANGS) {
        if (langFilter.length && langFilter.indexOf(lang) < 0) continue;
        for (const scene of SCENES) {
          if (filters.length && !filters.some((f) => scene.name.indexOf(f) >= 0)) continue;
          if (!size.key && !scene.key && !filters.length) continue;
          const page = await context.newPage();
          const label = scene.name + '-' + size.w + '-' + lang;
          page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.type() === 'warning') problems.push(label + ' [console ' + msg.type() + '] ' + msg.text());
          });
          page.on('pageerror', (err) => problems.push(label + ' [exception] ' + err.message));
          try {
            await page.goto(urlFor(scene, lang), { waitUntil: 'load' });
            await page.waitForFunction(() => window.__booted === true, null, { timeout: 30000 });
            await sleep(450);
            await scene.run(page);
            await sleep(650);
            const shoot = async (suffix) => {
              await page.screenshot({ path: path.join(OUT, scene.name + (suffix || '') + '-' + size.w + '-' + lang + '.png') });
              count++;
            };
            await shoot('');
            if (scene.after) await scene.after(page, shoot);
          } catch (err) {
            problems.push(label + ' [tool] ' + err.message);
          }
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  console.log(count + ' screenshots → ' + path.relative(ROOT, OUT));
  if (problems.length) {
    console.log(problems.length + ' problem(s):');
    for (const p of problems.slice(0, 40)) console.log('  ' + p);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
