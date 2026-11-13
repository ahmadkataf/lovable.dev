/**
 * Screenshot tool for the app shell and the meta screens (dev only).
 *
 *   node tools/meta-shots.cjs                 every scene, every size, both languages → shots/meta/*.png
 *   node tools/meta-shots.cjs map intro       only scenes whose name contains one of the words
 *   META_SIZES=360,1280 META_LANGS=ar node tools/meta-shots.cjs shop
 *   node tools/meta-shots.cjs --sheets        also build contact sheets (one per scene: every size × language) → shots/meta/sheets
 *
 * Scenes: title (first run / returning / finished), the map at the start / gated / mid-journey /
 * chapter seam / near the end / finished / with a six-digit coin count and no lives, the level intro
 * (plain, hard, replay, three goals, Caravan, everything at once, no lives), buying one booster,
 * lives (0 / some / full), the shop with the test store (three scroll positions), without a store,
 * without coins, settings, privacy policy, credits, the two reset confirmations, daily reward (claim,
 * claimed, day 7, waiting), new booster, journey complete, toasts with long texts, and the post-win
 * celebration.
 * Sizes: 320×480, 360×640, 412×915, 640×360 (landscape), 800×1280, 1280×800 — English and Arabic,
 * deviceScaleFactor 2.
 *
 * Runs on the real 120 levels with every feature unlocked (?gate=off); the store scenes use the test
 * store of src/monetize (?fakestore=1). Serves a production build of the current sources on port
 * 5185 (META_PORT) — pages load much faster than from the dev server, and it is what ships — with
 * the debug switches on (?debug=1). META_DEV=1 uses the dev server instead (the one that is already
 * running on the port, or its own without hot reload).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const L = require('../tests/e2e/meta-lib.cjs');

const ROOT = L.ROOT;
const OUT = path.join(ROOT, 'shots', 'meta');
const SHEETS = path.join(OUT, 'sheets');
const { sleep, today } = L;

const SIZES = [
  { w: 320, h: 480 },
  { w: 360, h: 640 },
  { w: 412, h: 915 },
  { w: 640, h: 360 },
  { w: 800, h: 1280 },
  { w: 1280, h: 800 },
];
const LANGS = ['en', 'ar'];

const save = (opts) => L.saveParam(opts);
const go = (page, screen, arg) => page.evaluate(([s, a]) => window.__app.goto(s, a), [screen, arg]);
const closeAll = (page) => page.evaluate(() => window.__app.kit.closeAll());
const scrollBody = (page, selector, frac) =>
  page.evaluate(
    ([sel, f]) => {
      const body = document.querySelector(sel + ' .k-dialog__body');
      if (body) body.scrollTop = (body.scrollHeight - body.clientHeight) * f;
    },
    [selector, frac],
  );
const waitStore = (page) => page.waitForFunction(() => window.__app.store.iapAvailable() && window.__app.store.rewardedReady(), null, { timeout: 8000 }).catch(() => undefined);

const MID = { upTo: 46, coins: 12850, lives: 3, lifeAgoMs: 400000, dailyDay: today, dailyStreak: 3 };

/**
 * Scenes. `query` = extra URL parameters; `run(page)` drives the app to the state to capture;
 * `after(page, shoot)` may take further captures (shoot(suffix)).
 */
const SCENES = [
  { name: 'title', query: {}, run: async () => {} },
  { name: 'title-returning', query: { save: save({ upTo: 46 }) }, run: async () => {} },
  { name: 'title-finished', query: { save: save({ upTo: 120, stars: 3 }) }, run: async () => {} },

  { name: 'map-start', query: { screen: 'map', save: save({ upTo: 0, dailyDay: today, dailyStreak: 1 }) }, run: async () => {} },
  { name: 'map-early', query: { screen: 'map', gate: 'on', save: save({ upTo: 3, dailyDay: today, dailyStreak: 1, gifted: [] }) }, run: async () => {} },
  { name: 'map-mid', query: { screen: 'map', save: save(MID) }, run: async () => {} },
  { name: 'map-chapter-seam', query: { screen: 'map', save: save({ upTo: 39, coins: 950, dailyDay: today, dailyStreak: 3 }) }, run: async () => {} },
  { name: 'map-end', query: { screen: 'map', save: save({ upTo: 117, coins: 70450, dailyDay: today - 1, dailyStreak: 3 }) }, run: async (page) => closeAll(page) },
  { name: 'map-finished', query: { screen: 'map', save: save({ upTo: 120, stars: 3, coins: 3210, dailyDay: today, dailyStreak: 3 }) }, run: async () => {} },
  { name: 'map-rich-nolives', query: { screen: 'map', save: save({ upTo: 101, stars: 3, coins: 987654, lives: 0, lifeAgoMs: 1000, dailyDay: today - 1, dailyStreak: 6 }) }, run: async (page) => closeAll(page) },

  { name: 'intro', query: { screen: 'map', save: save({ upTo: 16, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'intro', 17) },
  {
    name: 'intro-hard',
    query: { screen: 'map', save: save({ upTo: 26, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await go(page, 'intro', 27);
      await sleep(500);
      await page.click('[data-booster="beamNova"]');
    },
  },
  { name: 'intro-replay', query: { screen: 'map', save: save({ upTo: 46, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'intro', 33) },
  { name: 'intro-3goals', query: { screen: 'map', save: save({ upTo: 58, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'intro', 59) },
  { name: 'intro-caravan', query: { screen: 'map', save: save({ upTo: 71, caravan: 2, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'intro', 72) },
  {
    // everything at once: hard, three goals, a full Caravan, a replay, six-digit best score
    name: 'intro-max',
    query: { screen: 'map', save: save({ upTo: 110, caravan: 5, coins: 100, boosters: { extraMoves: 0, prism: 12, beamNova: 0 }, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => window.__app.profile.recordWin(100, 2, 123456, 4));
      await go(page, 'intro', 100);
    },
  },
  { name: 'intro-nolives', query: { screen: 'map', save: save({ upTo: 46, lives: 0, lifeAgoMs: 500000, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'intro', 47) },
  { name: 'intro-first', query: { screen: 'map', gate: 'on', save: save({ upTo: 1, gifted: [], dailyDay: today, dailyStreak: 1 }) }, run: (page) => go(page, 'intro', 2) },
  {
    name: 'buy-one',
    query: { screen: 'map', save: save({ upTo: 46, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await go(page, 'intro', 47);
      await sleep(500);
      await page.click('[data-booster="prism"]');
    },
  },

  {
    name: 'lives-empty',
    query: { screen: 'map', fakestore: '1', save: save({ upTo: 46, lives: 0, lifeAgoMs: 500000, coins: 1200, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await waitStore(page);
      await go(page, 'lives');
    },
  },
  { name: 'lives-some', query: { screen: 'map', save: save({ upTo: 46, lives: 3, lifeAgoMs: 100000, coins: 1200, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'lives') },
  { name: 'lives-full', query: { screen: 'map', save: save({ upTo: 46, coins: 1200, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'lives') },

  {
    name: 'shop-store',
    query: { screen: 'map', fakestore: '1', save: save({ upTo: 46, coins: 1250, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await waitStore(page);
      await go(page, 'shop');
    },
    after: async (page, shoot) => {
      for (const [suffix, f] of [
        ['-2', 0.36],
        ['-3', 0.68],
        ['-4', 1],
      ]) {
        await scrollBody(page, '.m-dialog-shop', f);
        await sleep(250);
        await shoot(suffix);
      }
    },
  },
  { name: 'shop-plain', query: { screen: 'map', save: save({ upTo: 46, coins: 540, dailyDay: today, dailyStreak: 3 }) }, run: (page) => go(page, 'shop') },
  {
    name: 'shop-rich',
    query: { screen: 'map', fakestore: '1', save: save({ upTo: 46, coins: 987654, boosters: { hammer: 128, freeSwap: 99, shuffle: 0, extraMoves: 1000, prism: 7, beamNova: 12 }, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await waitStore(page);
      await go(page, 'shop');
      await sleep(400);
      await scrollBody(page, '.m-dialog-shop', 1);
    },
  },
  { name: 'shop-early', query: { screen: 'map', gate: 'on', save: save({ upTo: 9, coins: 2210, gifted: ['beamNova', 'hammer'], dailyDay: today, dailyStreak: 1 }) }, run: (page) => go(page, 'shop') },

  {
    name: 'settings',
    query: { fakestore: '1', save: save({ upTo: 46 }) },
    run: async (page) => {
      await waitStore(page);
      await go(page, 'settings');
    },
    after: async (page, shoot) => {
      await scrollBody(page, '.m-dialog-settings', 1);
      await sleep(250);
      await shoot('-2');
    },
  },
  {
    name: 'privacy',
    query: { save: save({ upTo: 46 }) },
    run: async (page) => {
      await go(page, 'settings');
      await sleep(400);
      await page.click('[data-act="privacy"]');
    },
  },
  {
    name: 'credits',
    query: { save: save({ upTo: 46 }) },
    run: async (page) => {
      await go(page, 'settings');
      await sleep(400);
      await page.click('[data-act="credits"]');
    },
  },
  {
    name: 'reset',
    query: { save: save({ upTo: 46 }) },
    run: async (page) => {
      await go(page, 'settings');
      await sleep(400);
      await page.click('[data-act="reset"]');
    },
    after: async (page, shoot) => {
      await sleep(400);
      await page.click('.k-overlay:not(.k-under) .k-btn--danger');
      await sleep(700);
      await shoot('-2');
    },
  },

  {
    name: 'daily',
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
    name: 'daily-day7',
    query: { screen: 'map', save: save({ upTo: 46, dailyDay: today - 1, dailyStreak: 6 }) },
    run: async () => {
      await sleep(700);
    },
    after: async (page, shoot) => {
      await page.click('[data-act="daily-claim"]');
      await sleep(700);
      await shoot('-claimed');
    },
  },
  { name: 'unlock', query: { screen: 'map', save: save({ upTo: 7, dailyDay: today, dailyStreak: 1 }) }, run: (page) => go(page, 'unlock', 'hammer') },
  { name: 'unlock-long', query: { screen: 'map', save: save({ upTo: 13, dailyDay: today, dailyStreak: 1 }) }, run: (page) => go(page, 'unlock', 'freeSwap') },
  {
    name: 'finished',
    query: { screen: 'map', still: '0', save: save({ upTo: 119, stars: 3, dailyDay: today, dailyStreak: 3 }) },
    run: async (page) => {
      await page.evaluate(() => {
        window.__app.profile.recordWin(120, 3, 9100, 3);
        window.__app.goto('map', { justWon: 120 });
      });
      await page.waitForSelector('.k-dialog--medal', { timeout: 8000 });
    },
  },
  {
    name: 'toasts',
    query: { screen: 'map', save: save(MID) },
    run: async (page) => {
      await page.evaluate(() => {
        const a = window.__app;
        const t = (k, v) => a.ctx.i18n.t(k, v);
        a.kit.toast(t('meta.shop.pending'), { icon: 'info', duration: 60000 });
        a.kit.toast(t('meta.ad.closed'), { icon: 'adVideo', duration: 60000 });
        a.kit.toast(t('meta.map.lockedToast', { n: 119 }), { icon: 'lock', duration: 60000 });
      });
    },
  },
  {
    name: 'celebrate',
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

function urlFor(scene, lang) {
  // fakestore=0 unless the scene asks for the test store (under the dev server it would switch itself on)
  const q = Object.assign({ still: '1', lang, fakestore: '0', gate: 'off' }, scene.query);
  if (q.gate === 'on') delete q.gate;
  if (q.still === '0') delete q.still;
  return L.url(q);
}

/** One PNG per scene shot: every size × language side by side, labelled. */
async function buildSheets(browser, names) {
  fs.mkdirSync(SHEETS, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  let made = 0;
  for (const name of names) {
    for (const lang of LANGS) {
      const cells = [];
      for (const size of SIZES) {
        const file = path.join(OUT, name + '-' + size.w + '-' + lang + '.png');
        if (!fs.existsSync(file)) continue;
        // shown at one screenshot pixel = 0.5 px (the screenshots are 2×), i.e. at CSS size
        cells.push('<figure><img src="data:image/png;base64,' + fs.readFileSync(file).toString('base64') + '" width="' + size.w + '" height="' + size.h + '"><figcaption>' + size.w + '×' + size.h + '</figcaption></figure>');
      }
      if (cells.length === 0) continue;
      await page.setContent(
        '<html><body style="margin:0;background:#222;color:#eee;font:14px sans-serif"><div id="s" style="display:inline-flex;flex-wrap:wrap;align-items:flex-start;padding:10px;max-width:3400px">' +
          '<style>figure{margin:6px}figcaption{padding:3px 0}img{display:block}</style>' +
          cells.join('') +
          '</div></body></html>',
      );
      const box = await page.locator('#s').boundingBox();
      await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
      await page.locator('#s').screenshot({ path: path.join(SHEETS, name + '-' + lang + '.png') });
      made++;
    }
  }
  await page.close();
  return made;
}

async function main() {
  const args = process.argv.slice(2);
  const sheets = args.indexOf('--sheets') >= 0;
  const sheetsOnly = args.indexOf('--sheets-only') >= 0;
  const filters = args.filter((a) => a.indexOf('--') !== 0);
  const sizeFilter = (process.env.META_SIZES || '').split(',').filter(Boolean);
  const langFilter = (process.env.META_LANGS || '').split(',').filter(Boolean);
  let server = null;
  if (!sheetsOnly) {
    const running = await L.get(L.BASE);
    if (process.env.META_DEV === '1' || (running && running.status === 200)) server = await L.quietDevServer();
    else {
      server = await L.previewServer();
      console.log('build: ' + server.buildLog);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];
  const shotNames = [];
  let count = 0;
  try {
    for (const size of SIZES) {
      if (sheetsOnly) break;
      if (sizeFilter.length && sizeFilter.indexOf(String(size.w)) < 0) continue;
      const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, hasTouch: true });
      for (const lang of LANGS) {
        if (langFilter.length && langFilter.indexOf(lang) < 0) continue;
        for (const scene of SCENES) {
          if (filters.length && !filters.some((f) => scene.name.indexOf(f) >= 0)) continue;
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
            await sleep(700);
            const shoot = async (suffix) => {
              const name = scene.name + (suffix || '');
              await page.screenshot({ path: path.join(OUT, name + '-' + size.w + '-' + lang + '.png') });
              if (shotNames.indexOf(name) < 0) shotNames.push(name);
              count++;
            };
            await shoot('');
            if (scene.after) await scene.after(page, shoot);
          } catch (err) {
            problems.push(label + ' [tool] ' + err.message.split('\n')[0]);
          }
          await page.close();
        }
      }
      await context.close();
    }
    if (sheets || sheetsOnly) {
      let names = shotNames;
      if (sheetsOnly) {
        const all = fs.readdirSync(OUT).filter((f) => /-\d+-(en|ar)\.png$/.test(f)).map((f) => f.replace(/-\d+-(en|ar)\.png$/, ''));
        names = all.filter((n, i) => all.indexOf(n) === i && (!filters.length || filters.some((f) => n.indexOf(f) >= 0)));
      }
      const made = await buildSheets(browser, names);
      console.log(made + ' contact sheets → ' + path.relative(ROOT, SHEETS));
    }
  } finally {
    await browser.close();
    if (server) await server.stop();
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
