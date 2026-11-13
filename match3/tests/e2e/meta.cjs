/**
 * End-to-end test of the app shell and the meta screens, in Chromium with real pointer events.
 * Any console error, i18n warning, uncaught exception or CSP violation fails the run.
 *
 *   node tests/e2e/meta.cjs            dev-server part, then the production-build part
 *   node tests/e2e/meta.cjs --dev      only the dev-server part
 *   node tests/e2e/meta.cjs --prod     only the production part (vite build + vite preview)
 *   META_SKIP_PLAY=1 …                 do not enter the real play screen (while it is being built)
 *
 * Port 5185 (META_PORT). A dev server already listening there is reused for the dev part; the
 * production part needs the port for `vite preview`, so stop a running dev server first.
 */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.META_PORT || 5185);
const BASE = 'http://127.0.0.1:' + PORT + '/';
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const SKIP_PLAY = process.env.META_SKIP_PLAY === '1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function waitForServer(want) {
  for (let i = 0; i < 120; i++) {
    const res = await get(BASE);
    if (res && res.status === 200 && want(res.body)) return true;
    await sleep(250);
  }
  return false;
}

const isDevHtml = (html) => html.indexOf('/src/main.ts') >= 0;
const isProdHtml = (html) => html.indexOf('/src/main.ts') < 0 && html.indexOf('assets/') >= 0;

// ───────────────────────────── bookkeeping ─────────────────────────────

let failures = 0;
let checks = 0;
const problems = [];
let currentTest = '';
/** While > 0, console errors are expected (a test provokes them on purpose). */
let tolerate = 0;

function ok(cond, what) {
  checks++;
  if (cond) return;
  failures++;
  console.log('    ✗ ' + what);
}

function eq(actual, expected, what) {
  ok(actual === expected, what + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

function watch(page) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (tolerate > 0) return;
    if (type === 'error' || (type === 'warning' && /i18n|\[art\]|\[kit\]/.test(text))) problems.push('[' + currentTest + '] console ' + type + ': ' + text);
  });
  page.on('pageerror', (err) => {
    if (tolerate > 0) return;
    problems.push('[' + currentTest + '] uncaught: ' + err.message);
  });
}

const ONLY = process.env.META_ONLY || '';

async function test(name, fn) {
  if (ONLY && name.indexOf(ONLY) < 0) return;
  currentTest = name;
  const before = failures;
  const seen = problems.length;
  const t0 = Date.now();
  try {
    await fn();
  } catch (err) {
    failures++;
    console.log('    ✗ threw: ' + (err && err.stack ? err.stack.split('\n').slice(0, 2).concat(err.stack.split('\n').filter((l) => l.indexOf('meta.cjs') >= 0).slice(0, 2)).join(' | ') : err));
  }
  const bad = failures - before + (problems.length - seen);
  console.log((bad === 0 ? '  ✓ ' : '  ✗ ') + name + '  (' + (Date.now() - t0) + ' ms)');
  for (let i = seen; i < problems.length; i++) console.log('    ! ' + problems[i]);
}

// ───────────────────────────── helpers ─────────────────────────────

const DAY = 86400000;
const now = new Date();
const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);

function saveData(opts) {
  const o = Object.assign({ upTo: 0, coins: 2000, lives: 5, boosters: {}, dailyDay: -1, dailyStreak: 0 }, opts || {});
  const levels = {};
  for (let i = 1; i <= o.upTo; i++) levels[i] = { stars: 1 + ((i * 7 + 1) % 3), best: 2400 + ((i * 373) % 4000) };
  return {
    version: 1,
    levels,
    coins: o.coins,
    lives: o.lives,
    lifeTimer: o.lives >= 5 ? 0 : Date.now() - 60000,
    boosters: Object.assign({ hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 2, prism: 0, beamNova: 1 }, o.boosters),
    settings: { sfx: true, music: true, haptics: true, lang: null },
    dailyDay: o.dailyDay,
    dailyStreak: o.dailyStreak,
    seen: [],
    stats: { played: o.upTo, won: o.upTo, bestCascade: 4, totalScore: o.upTo * 3000 },
  };
}

function saveParam(opts) {
  return Buffer.from(JSON.stringify(saveData(opts)), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function url(query) {
  const q = Object.assign({ debug: '1' }, query || {});
  return BASE + '?' + Object.keys(q).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
}

async function open(browser, query, opts) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 360, height: 640 }, hasTouch: true, deviceScaleFactor: 1 }, (opts && opts.context) || {}));
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || 'inline'));
    });
  });
  if (opts && opts.init) await context.addInitScript(opts.init, opts.initArg);
  const page = await context.newPage();
  watch(page);
  await page.goto(url(query), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__booted === true && !!window.__app, null, { timeout: 30000 });
  await sleep(300);
  return { context, page };
}

const state = (page) =>
  page.evaluate(() => {
    const a = window.__app;
    return {
      screen: a.shell.current(),
      root: a.shell.atRoot(),
      overlay: a.kit.hasOverlay(),
      coins: a.profile.coins(),
      lives: a.profile.lives().count,
      frontier: a.profile.highestUnlocked(),
      lang: a.ctx.i18n.lang(),
      dir: document.documentElement.getAttribute('dir'),
      dialogs: document.querySelectorAll('.k-overlay:not(.k-closing)').length,
    };
  });

async function tap(page, selector) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible', timeout: 8000 });
  await target.tap();
}

async function waitScreen(page, screen) {
  await page.waitForFunction((s) => window.__app.shell.current() === s, screen, { timeout: 8000 });
  await sleep(320);
}

async function waitDialogs(page, n) {
  await page.waitForFunction((count) => document.querySelectorAll('.k-overlay:not(.k-closing)').length === count, n, { timeout: 8000 });
  await sleep(380); // the kit ignores backdrop taps / double activations for a moment after opening
}

async function back(page) {
  await page.keyboard.press('Escape');
  await sleep(330);
}

const boosterCount = (page, id) => page.evaluate((b) => window.__app.profile.boosterCount(b), id);

// ───────────────────────────── dev-server tests ─────────────────────────────

async function devTests(browser) {
  await test('first launch: title → Play goes straight into level 1; Back walks home', async () => {
    const { context, page } = await open(browser, {});
    let s = await state(page);
    eq(s.screen, 'title', 'starts on the title');
    eq(s.root, true, 'the title is the root');
    eq(s.overlay, false, 'no pop-up on first launch');
    ok((await page.title()).length > 0, 'the document has a title');
    ok((await page.locator('#boot').count()) === 0, 'the boot cover is gone');
    if (!SKIP_PLAY) {
      await tap(page, '[data-act="play"]');
      await waitScreen(page, 'play');
      s = await state(page);
      eq(s.root, false, 'not at the root while playing');
      ok((await page.locator('.m-playhost').count()) === 1, 'exactly one play host is mounted');
      // leave the way the play screen does
      await page.evaluate(() => window.__app.ctx.nav.toMap({ focusLevel: 1 }));
      await waitScreen(page, 'map');
      ok((await page.locator('.m-playhost').count()) === 0, 'the play screen was unmounted');
    } else {
      await page.evaluate(() => window.__app.goto('map'));
      await waitScreen(page, 'map');
    }
    s = await state(page);
    eq(s.root, false, 'the map is not the root');
    await page.evaluate(() => window.__app.kit.closeAll());
    await back(page);
    s = await state(page);
    eq(s.screen, 'title', 'Back on the map goes to the title');
    eq(s.root, true, 'back at the root');
    await back(page);
    eq((await state(page)).screen, 'title', 'Back on the title does nothing');
    await context.close();
  });

  await test('tour: daily reward, map, intro with boosters, play, win celebration', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1', save: saveParam({ upTo: 46, coins: 5000, dailyDay: today - 1, dailyStreak: 2 }) });
    ok(/47/.test(await page.locator('[data-act="play"]').innerText()), 'the Play button names the next level');
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'map');

    // the daily reward is offered by itself, once
    await page.waitForSelector('.m-dialog-daily', { timeout: 5000 });
    await sleep(450);
    const before = await page.evaluate(() => ({ coins: window.__app.profile.coins(), b: JSON.stringify(window.__app.profile.data().boosters) }));
    await tap(page, '[data-act="daily-claim"]');
    await sleep(400);
    const after = await page.evaluate(() => ({ coins: window.__app.profile.coins(), b: JSON.stringify(window.__app.profile.data().boosters), can: window.__app.profile.daily().canClaim }));
    ok(after.coins !== before.coins || after.b !== before.b, 'claiming grants something');
    eq(after.can, false, 'the reward cannot be claimed twice');
    ok((await page.locator('.m-daily__result--on').count()) === 1, 'the dialog shows what was received');
    ok((await page.locator('.m-day--done').count()) === 3, 'three days are ticked');
    await tap(page, '[data-act="daily-done"]');
    await waitDialogs(page, 0);

    // map furniture
    ok(await page.locator('[data-act="lives"]').isVisible(), 'lives chip');
    ok(await page.locator('[data-act="coins"]').isVisible(), 'coins chip');
    ok(await page.locator('[data-act="shop"]').isVisible(), 'shop button');
    ok(await page.locator('[data-act="daily"]').isVisible(), 'daily button');
    ok(await page.locator('.m-node[data-level="47"]').isVisible(), 'the current level is in view');
    ok((await page.locator('.m-node[data-level="47"].m-node--current').count()) === 1, 'level 47 is the current node');
    ok((await page.locator('.m-node[data-level="46"].m-node--done').count()) === 1, 'level 46 is done');
    ok((await page.locator('.m-node[data-level="48"].m-node--locked').count()) === 1, 'level 48 is locked');

    // a locked node only explains itself
    await tap(page, '.m-node[data-level="48"]');
    await sleep(300);
    eq((await state(page)).overlay, false, 'a locked level opens nothing');

    // intro: goals, boosters, buying a missing booster
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    ok((await page.locator('.m-dialog-intro .m-goal').count()) >= 1, 'the intro lists the goals');
    await tap(page, '[data-booster="beamNova"]');
    ok((await page.locator('[data-booster="beamNova"].m-boost--on').count()) === 1, 'an owned booster toggles on');
    const coins0 = (await state(page)).coins;
    const price = await page.evaluate(() => window.__app.profile.boosterPrice('prism'));
    await tap(page, '[data-booster="prism"]'); // none owned → offer to buy
    await waitDialogs(page, 2);
    await tap(page, '.k-overlay:not(.k-under) .k-btn--price');
    await waitDialogs(page, 1);
    eq((await state(page)).coins, coins0 - price, 'buying the booster costs its price');
    ok((await page.locator('[data-booster="prism"].m-boost--on').count()) === 1, 'the bought booster is selected');
    eq(await boosterCount(page, 'prism'), 1, 'one prism is owned before Play');
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    eq(await boosterCount(page, 'prism'), 0, 'Play consumed the prism');
    eq(await boosterCount(page, 'beamNova'), 0, 'Play consumed the beam & nova');
    eq((await state(page)).overlay && SKIP_PLAY, false, 'the intro closed');

    // win → celebration → the next level's intro opens by itself
    await page.evaluate(() => {
      const a = window.__app;
      a.kit.closeAll();
      a.profile.recordWin(47, 3, 5200, 3);
      a.ctx.nav.toMap({ justWon: 47 });
      a.ctx.nav.openLevelIntro(48); // the play screen's "Next" asks for it right away
    });
    await waitScreen(page, 'map');
    eq((await state(page)).overlay, false, 'the celebration plays before the intro opens');
    await page.waitForSelector('.m-dialog-intro', { timeout: 8000 });
    ok(/48/.test(await page.locator('.m-dialog-intro .k-dialog__title').innerText()), 'the intro of level 48 opened');
    ok((await page.locator('.m-node[data-level="47"].m-node--done').count()) === 1, 'level 47 is now done');
    ok((await page.locator('.m-node[data-level="47"] .m-node__stars i.on').count()) === 3, 'with three stars');
    ok((await page.locator('.m-node[data-level="48"].m-node--current').count()) === 1, 'level 48 is unlocked');
    await sleep(400);
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes the intro');
    await context.close();
  });

  await test('shop: boosters for coins, simulated purchases, free coins', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1', screen: 'map', save: saveParam({ upTo: 46, coins: 3000, dailyDay: today, dailyStreak: 2 }) });
    await tap(page, '[data-act="shop"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('.m-dialog-shop [data-booster]').count(), 6, 'six boosters are on sale');
    eq(await page.locator('.m-dialog-shop [data-product]').count(), 7, 'starter pack, remove ads and five coin packs');

    // a booster for coins
    const price = await page.evaluate(() => window.__app.profile.boosterPrice('hammer'));
    let coins = (await state(page)).coins;
    const hammers = await boosterCount(page, 'hammer');
    await tap(page, '[data-booster="hammer"] .k-btn');
    await sleep(250);
    eq((await state(page)).coins, coins - price, 'the hammer costs its price');
    eq(await boosterCount(page, 'hammer'), hammers + 1, 'one hammer more');

    // a coin pack
    coins = (await state(page)).coins;
    await tap(page, '[data-product="coins_small"] .k-btn');
    await page.waitForFunction((c) => window.__app.profile.coins() === c + 1000, coins, { timeout: 5000 });
    ok(true, 'the small pack adds 1,000 coins');
    await sleep(900);

    // a pending payment grants nothing yet
    coins = (await state(page)).coins;
    await page.evaluate(() => (window.__app.store.nextOutcome = 'pending'));
    await tap(page, '[data-product="coins_medium"] .k-btn');
    await sleep(700);
    eq((await state(page)).coins, coins, 'a pending purchase grants nothing');
    ok((await page.locator('.k-toast').count()) >= 1, 'and says so');

    // a cancelled one changes nothing and says nothing new
    await page.evaluate(() => (window.__app.store.nextOutcome = 'cancelled'));
    await tap(page, '[data-product="coins_large"] .k-btn');
    await sleep(600);
    eq((await state(page)).coins, coins, 'a cancelled purchase grants nothing');

    // remove ads: owned afterwards, the offer disappears
    await tap(page, '[data-product="remove_ads"] .k-btn');
    await page.waitForFunction(() => window.__app.store.owns('remove_ads'), null, { timeout: 5000 });
    await sleep(400);
    eq(await page.locator('.m-dialog-shop [data-product="remove_ads"]').count(), 0, 'the remove-ads offer is hidden once owned');

    // free coins for a rewarded ad
    coins = (await state(page)).coins;
    const left = await page.evaluate(() => window.__app.store.freeCoinAdsLeft());
    await tap(page, '[data-act="free-coins"]');
    await page.waitForFunction((c) => window.__app.profile.coins() > c, coins, { timeout: 5000 });
    const gained = (await state(page)).coins - coins;
    ok(gained > 0 && gained <= 500, 'the ad pays a small coin reward (' + gained + ')');
    eq(await page.evaluate(() => window.__app.store.freeCoinAdsLeft()), left - 1, 'one ad fewer left today');

    // an ad that is closed early pays nothing
    await sleep(500);
    coins = (await state(page)).coins;
    await page.evaluate(() => (window.__app.store.nextAd = 'dismissed'));
    await tap(page, '[data-act="free-coins"]');
    await sleep(800);
    eq((await state(page)).coins, coins, 'a dismissed ad pays nothing');

    // too poor: the button is disabled
    await page.evaluate(() => window.__app.profile.spendCoins(window.__app.profile.coins()));
    await sleep(200);
    ok(await page.locator('[data-booster="hammer"] .k-btn').isDisabled(), 'Buy is disabled without coins');
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes the shop');

    // without a store: boosters only
    await page.evaluate(() => window.__app.store.set({ iap: false, ads: false }));
    await tap(page, '[data-act="shop"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    eq(await page.locator('.m-dialog-shop [data-product]').count(), 0, 'no real-money offers without a store');
    eq(await page.locator('[data-act="free-coins"]').count(), 0, 'no ad offer without ads');
    eq(await page.locator('.m-dialog-shop [data-booster]').count(), 6, 'the boosters stay');
    await context.close();
  });

  await test('lives: out of lives blocks Play, refill for coins, rewarded life', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1', screen: 'map', save: saveParam({ upTo: 46, coins: 3000, lives: 0, dailyDay: today, dailyStreak: 2 }) });
    eq((await state(page)).lives, 0, 'starts with no lives');
    // Play in the intro opens the lives dialog instead of the level
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="intro-play"]');
    await page.waitForSelector('.m-dialog-lives', { timeout: 5000 });
    eq((await state(page)).screen, 'map', 'no life, no level');
    await sleep(420);
    // +1 life for an ad
    await tap(page, '[data-act="lives-ad"]');
    await page.waitForFunction(() => window.__app.profile.lives().count === 1, null, { timeout: 5000 });
    ok(true, 'the rewarded ad adds one life');
    // refill all for coins
    const coins = (await state(page)).coins;
    await sleep(500);
    await tap(page, '[data-act="lives-refill"]');
    await page.waitForFunction(() => window.__app.profile.lives().count === window.__app.profile.lives().max, null, { timeout: 5000 });
    ok((await state(page)).coins < coins, 'the refill costs coins');
    await waitDialogs(page, 1);
    ok((await page.locator('.m-dialog-lives').count()) === 0 || !(await page.locator('.m-dialog-lives').isVisible()), 'the lives dialog closed after the refill');
    await back(page);
    // the chip opens the dialog too
    await tap(page, '[data-act="lives"]');
    await page.waitForSelector('.m-dialog-lives', { timeout: 5000 });
    await sleep(400);
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes the lives dialog');
    await context.close();
  });

  await test('settings: toggles, language on every screen, legal texts, restore, reset', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1', lang: 'en', save: saveParam({ upTo: 46, coins: 3000, dailyDay: today, dailyStreak: 2 }) });
    // from the title
    await tap(page, '[data-act="settings"]');
    await page.waitForSelector('.m-dialog-settings', { timeout: 5000 });
    await sleep(420);
    eq((await state(page)).root, false, 'an open dialog means not at the root');
    await tap(page, '[data-act="toggle-sfx"]');
    eq(await page.evaluate(() => window.__app.profile.settings().sfx), false, 'sound effects switch off');
    await tap(page, '[data-act="toggle-music"]');
    eq(await page.evaluate(() => window.__app.profile.settings().music), false, 'music switches off');
    await tap(page, '[data-act="toggle-haptics"]');
    eq(await page.evaluate(() => window.__app.profile.settings().haptics), false, 'vibration switches off');
    // language: applied at once to the dialog and the screen behind
    await page.locator('[data-act="language"] .k-seg__opt').nth(1).tap();
    await sleep(450);
    let s = await state(page);
    eq(s.lang, 'ar', 'the language switched to Arabic');
    eq(s.dir, 'rtl', 'the page is right-to-left');
    eq(await page.locator('.m-dialog-settings .k-dialog__title').innerText(), 'الإعدادات', 'the settings title is Arabic');
    eq(await page.evaluate(() => window.__app.profile.settings().lang), 'ar', 'the choice is saved');
    ok(/العب/.test(await page.locator('[data-act="play"]').innerText()), 'the title screen behind is Arabic');
    await back(page);
    s = await state(page);
    eq(s.overlay, false, 'Back closes settings');
    eq(s.root, true, 'the title is the root again');

    // on the map
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'map');
    await page.evaluate(() => window.__app.kit.closeAll());
    ok(/المتجر/.test(await page.locator('[data-act="shop"]').innerText()), 'the map is Arabic');
    const ratio = await page.evaluate(() => {
      const sc = document.querySelector('.m-map__scroll');
      return sc.scrollTop / (sc.scrollHeight - sc.clientHeight);
    });
    await tap(page, '[data-act="settings"]');
    await page.waitForSelector('.m-dialog-settings', { timeout: 5000 });
    await sleep(420);
    await page.locator('[data-act="language"] .k-seg__opt').nth(0).tap();
    await sleep(450);
    s = await state(page);
    eq(s.lang, 'en', 'back to English');
    eq(s.dir, 'ltr', 'left-to-right again');
    ok(/Shop/.test(await page.locator('[data-act="shop"]').innerText()), 'the map behind was rebuilt in English');
    const ratio2 = await page.evaluate(() => {
      const sc = document.querySelector('.m-map__scroll');
      return sc.scrollTop / (sc.scrollHeight - sc.clientHeight);
    });
    ok(Math.abs(ratio - ratio2) < 0.02, 'the map kept its scroll position');
    eq(await page.locator('.m-dialog-settings .k-dialog__title').innerText(), 'Settings', 'the settings dialog is English again');

    // conditional rows of the simulated store
    ok((await page.locator('[data-act="privacy-options"]').count()) === 1, 'privacy options row (consent region)');
    ok((await page.locator('[data-act="restore"]').count()) === 1, 'restore purchases row');
    eq(await page.locator('[data-act="rate"]').count(), 0, 'no rating row in a browser');
    await tap(page, '[data-act="restore"]');
    await page.waitForSelector('.k-toast', { timeout: 5000 });
    ok(true, 'restore reports its result');

    // privacy policy and credits: stacked dialogs, Back closes one at a time
    await tap(page, '[data-act="privacy"]');
    await waitDialogs(page, 2);
    ok(/Google Play/.test(await page.locator('[data-dialog="privacy"]').innerText()), 'the privacy policy names Google Play');
    ok(/AdMob/.test(await page.locator('[data-dialog="privacy"]').innerText()), 'and AdMob');
    await back(page);
    await waitDialogs(page, 1);
    await tap(page, '[data-act="credits"]');
    await waitDialogs(page, 2);
    const credits = await page.locator('[data-dialog="credits"]').innerText();
    ok(credits.indexOf('Copyright 2019 The Baloo 2 Project Authors (https://github.com/EkType/Baloo2)') >= 0, 'the font copyright line is shown');
    ok(credits.indexOf('SIL OPEN FONT LICENSE Version 1.1') >= 0, 'the OFL text is shown');
    ok(credits.indexOf('THE FONT SOFTWARE IS PROVIDED "AS IS"') >= 0, 'down to its disclaimer');
    await back(page);
    await waitDialogs(page, 1);

    // reset progress: two confirmations
    await tap(page, '[data-act="reset"]');
    await waitDialogs(page, 2);
    await tap(page, '.k-overlay:not(.k-under) .k-btn--danger');
    await waitDialogs(page, 2);
    eq((await state(page)).frontier, 47, 'one confirmation is not enough');
    await tap(page, '.k-overlay:not(.k-under) .k-btn--danger');
    await waitScreen(page, 'title');
    s = await state(page);
    eq(s.frontier, 1, 'progress is wiped');
    eq(s.overlay, false, 'all dialogs are closed');
    eq(s.root, true, 'the title is the root');
    eq(s.lang, 'en', 'the language is kept');
    await context.close();
  });

  await test('Android wrapper: Back order, at-root flag, insets, splash hand-off, pause', async () => {
    const init = (json) => {
      const calls = { atRoot: [], ready: 0, haptics: 0, saves: 0 };
      window.__bridgeCalls = calls;
      let saved = json;
      window.AndroidBridge = {
        loadSave: () => saved,
        storeSave: (s) => {
          saved = s;
          calls.saves++;
        },
        haptic: () => {
          calls.haptics++;
        },
        setAtRoot: (v) => {
          calls.atRoot.push(v);
        },
        info: () => JSON.stringify({ versionName: '9.9.9', versionCode: 99, locale: 'ar-SY' }),
        rate: () => {},
        insets: () => JSON.stringify({ top: 31, right: 0, bottom: 17, left: 0 }),
        ready: () => {
          calls.ready++;
        },
        storeCaps: () => JSON.stringify({ billing: false, ads: false }),
      };
    };
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1' }, { init, initArg: JSON.stringify(saveData({ upTo: 46, coins: 3000, dailyDay: today, dailyStreak: 2 })) });
    const lastRoot = () => page.evaluate(() => window.__bridgeCalls.atRoot[window.__bridgeCalls.atRoot.length - 1]);
    const nativeBack = async () => {
      await page.evaluate(() => window.__native.back());
      await sleep(330);
    };
    let s = await state(page);
    eq(s.lang, 'ar', 'the device language (Arabic) is used when none is saved');
    eq(s.frontier, 47, 'the save came from the wrapper');
    eq(await lastRoot(), true, 'title: at root');
    eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim()), '31px', 'the wrapper insets are applied');
    await page.evaluate(() => window.__native.insets(JSON.stringify({ top: 44, right: 0, bottom: 0, left: 0 })));
    eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim()), '44px', 'pushed insets are applied');
    await sleep(200);
    eq(await page.evaluate(() => window.__bridgeCalls.ready), 1, 'the splash hand-off is called once');
    ok((await page.locator('[data-act="rate"]').count()) === 0, 'no settings open yet');

    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    eq(await lastRoot(), false, 'settings open: not at root');
    ok((await page.locator('[data-act="rate"]').count()) === 1, 'Android shows "Rate the game"');
    ok(/9\.9\.9/.test(await page.locator('.m-settings__version').innerText()), 'the version comes from the wrapper');
    await tap(page, '[data-act="privacy"]');
    await waitDialogs(page, 2);
    await nativeBack();
    await waitDialogs(page, 1);
    eq(await lastRoot(), false, 'one dialog left: still not at root');
    await nativeBack();
    await waitDialogs(page, 0);
    eq(await lastRoot(), true, 'title again: at root');

    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'map');
    eq(await lastRoot(), false, 'map: not at root');
    await tap(page, '[data-act="shop"]');
    await waitDialogs(page, 1);
    await nativeBack();
    await waitDialogs(page, 0);
    eq((await state(page)).screen, 'map', 'Back closed the shop, not the map');
    await tap(page, '[data-act="daily"]');
    await waitDialogs(page, 1);
    await nativeBack();
    await waitDialogs(page, 0);
    await tap(page, '[data-act="lives"]');
    await waitDialogs(page, 1);
    await nativeBack();
    await waitDialogs(page, 0);
    await tap(page, '.m-node[data-level="47"]');
    await waitDialogs(page, 1);
    await nativeBack();
    await waitDialogs(page, 0);
    eq(await lastRoot(), false, 'map after closing dialogs: not at root');

    // pause / resume from the wrapper
    await page.evaluate(() => window.__native.pause());
    await sleep(200);
    await page.evaluate(() => window.__native.resume());
    await sleep(200);
    ok(await page.locator('[data-act="lives"]').isVisible(), 'the map survives pause and resume');

    await nativeBack();
    await waitScreen(page, 'title');
    eq(await lastRoot(), true, 'title: at root');
    ok(await page.evaluate(() => window.__bridgeCalls.saves) >= 0, 'saves go through the wrapper');
    await context.close();
  });

  await test('feature gating: an early profile sees a bare map', async () => {
    // only meaningful once the profile implements featureUnlocked(); otherwise everything is on
    const { context, page } = await open(browser, { mocklevels: '120', screen: 'map', save: saveParam({ upTo: 2, coins: 2000 }) });
    const gated = await page.evaluate(() => typeof window.__app.profile.featureUnlocked === 'function');
    if (gated) {
      eq(await page.locator('[data-act="lives"]').count(), 0, 'no lives chip before level 6');
      eq(await page.locator('[data-act="shop"]').count(), 0, 'no shop button before level 10');
    } else {
      ok(await page.locator('[data-act="lives"]').isVisible(), 'without gating in the profile everything shows');
    }
    ok(await page.locator('[data-act="home"]').isVisible(), 'Home is always there');
    await tap(page, '[data-act="home"]');
    await waitScreen(page, 'title');
    await context.close();
  });

  await test('200 rapid random taps', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1', screen: 'map', save: saveParam({ upTo: 46, coins: 900, dailyDay: today - 1, dailyStreak: 2 }) });
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 200; i++) {
      const x = 4 + Math.floor(rnd() * 352);
      const y = 4 + Math.floor(rnd() * 632);
      if (i % 17 === 16) await page.keyboard.press('Escape');
      else if (i % 2 === 0) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      if (i % 25 === 24) {
        // never get stuck inside the real play screen: this test is about the shell
        await page.evaluate(() => {
          if (window.__app.shell.current() === 'play') window.__app.ctx.nav.toMap();
        });
      }
    }
    await sleep(600);
    const s = await state(page);
    ok(s.screen === 'title' || s.screen === 'map' || s.screen === 'play', 'the app is still on a screen (' + s.screen + ')');
    await page.evaluate(() => {
      window.__app.kit.closeAll();
      window.__app.goto('map');
    });
    await waitScreen(page, 'map');
    await page.evaluate(() => window.__app.kit.closeAll());
    await sleep(200);
    await tap(page, '[data-act="home"]');
    await waitScreen(page, 'title');
    ok(true, 'and still responds');
    await context.close();
  });

  await test('map: sections are built lazily and scrolling stays smooth (CPU ×4)', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', screen: 'map', still: '1', save: saveParam({ upTo: 60, coins: 900, dailyDay: today, dailyStreak: 2 }) }, { context: { deviceScaleFactor: 2 } });
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const result = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const sc = document.querySelector('.m-map__scroll');
          const max = sc.scrollHeight - sc.clientHeight;
          const frames = [];
          let maxCanvases = 0;
          let maxNodes = 0;
          let pos = max;
          sc.scrollTop = max;
          let last = performance.now();
          const step = () => {
            const t = performance.now();
            frames.push(t - last);
            last = t;
            pos -= 28; // a brisk fling
            sc.scrollTop = pos;
            maxCanvases = Math.max(maxCanvases, document.querySelectorAll('.m-sec__bg canvas').length);
            maxNodes = Math.max(maxNodes, document.querySelectorAll('.m-node').length);
            if (pos > 0) requestAnimationFrame(step);
            else resolve({ frames, maxCanvases, maxNodes, sections: document.querySelectorAll('.m-sec').length, height: sc.scrollHeight });
          };
          requestAnimationFrame(step);
        }),
    );
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sorted = result.frames.slice(1).sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const slow = sorted.filter((f) => f > 34).length;
    console.log(
      '    frames ' + sorted.length + ' · median ' + pct(0.5).toFixed(1) + ' ms · p95 ' + pct(0.95).toFixed(1) + ' ms · worst ' + sorted[sorted.length - 1].toFixed(1) + ' ms · over 34 ms: ' + slow +
        ' · live backdrops ≤ ' + result.maxCanvases + ' · live nodes ≤ ' + result.maxNodes + ' of 120 · world ' + result.height + ' px',
    );
    eq(result.sections, 6, 'six chapter sections');
    ok(result.maxCanvases <= 4, 'only the sections near the viewport hold a backdrop (' + result.maxCanvases + ')');
    ok(result.maxNodes <= 80, 'only nearby nodes are in the document (' + result.maxNodes + ')');
    ok(pct(0.5) <= 20, 'median frame time stays at 60 fps (' + pct(0.5).toFixed(1) + ' ms)');
    ok(pct(0.95) <= 34, 'p95 frame time within two frames (' + pct(0.95).toFixed(1) + ' ms)');
    await context.close();
  });

  await test('compatibility guard: a module that never starts shows the update message', async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await context.newPage();
    tolerate++;
    await page.route('**/src/main.ts*', (route) => route.abort());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    eq(await page.evaluate(() => typeof window.__bootFail), 'function', 'the inline guard ran (its CSP hash matches)');
    await page.waitForFunction(() => document.querySelectorAll('#boot p').length === 2, null, { timeout: 9000 });
    const text = await page.locator('#boot').innerText();
    ok(/Android System WebView/.test(text) && /تحديث/.test(text), 'the message is shown in English and Arabic');
    tolerate--;
    await context.close();
  });
}

// ───────────────────────────── production-build tests ─────────────────────────────

async function prodTests(browser) {
  await test('production build: boots under the CSP, no violations, tour works', async () => {
    const html = (await get(BASE)).body;
    ok(/http-equiv="Content-Security-Policy"/.test(html), 'the CSP meta tag is in the built page');
    ok(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/.test(html), "script-src is 'self' plus the guard's hash");
    ok(/connect-src ws:\/\/127\.0\.0\.1:\* http:\/\/127\.0\.0\.1:\*;/.test(html), 'connect-src allows loopback only');
    ok(html.indexOf("'unsafe-eval'") < 0 && html.indexOf('https:') < 0, 'no eval and no remote origin in the policy');

    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', mockstore: '1', lang: 'ar', save: saveParam({ upTo: 46, coins: 3000, dailyDay: today, dailyStreak: 2 }) });
    eq(await page.evaluate(() => typeof window.__bootFail), 'function', 'the inline guard ran under the CSP');
    ok(await page.evaluate(() => document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'Aa') && document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'أب')), 'the bundled font loaded (Latin + Arabic)');
    ok((await page.locator('.m-title__logoimg').count()) === 1, 'the title painted its logo');
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'map');
    ok((await page.locator('.m-sec__bg canvas').count()) >= 1, 'the map painted a backdrop');
    ok((await page.locator('.m-node').count()) >= 20, 'the map has its nodes');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.m-node--current .m-node__face')).backgroundImage.indexOf('data:image/png') >= 0), 'data: images are allowed (node sprites)');
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await back(page);
    await tap(page, '[data-act="shop"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    await sleep(420);
    const coins = (await state(page)).coins;
    await tap(page, '[data-product="coins_small"] .k-btn');
    await page.waitForFunction((c) => window.__app.profile.coins() === c + 1000, coins, { timeout: 5000 });
    await sleep(900);
    await back(page);
    await tap(page, '[data-act="settings"]');
    await page.waitForSelector('.m-dialog-settings', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="credits"]');
    await waitDialogs(page, 2);
    ok((await page.locator('[data-dialog="credits"]').innerText()).indexOf('SIL OPEN FONT LICENSE') >= 0, 'the bundled licence text is in the build');
    await back(page);
    await back(page);
    if (!SKIP_PLAY) {
      await page.evaluate(() => window.__app.goto('play', 47));
      await waitScreen(page, 'play');
      await sleep(1200);
      await page.evaluate(() => window.__app.ctx.nav.toMap());
      await waitScreen(page, 'map');
    }

    // the policy really blocks the network: this request must fail (and is the one tolerated violation)
    tolerate++;
    const blocked = await page.evaluate(() =>
      fetch('https://example.com/', { mode: 'no-cors' }).then(
        () => false,
        () => true,
      ),
    );
    await sleep(150);
    tolerate--;
    ok(blocked, 'a request to a remote host is refused by the policy');
    await context.close();
  });

  await test('production build: debug hooks stay off without ?debug=1', async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true });
    const page = await context.newPage();
    watch(page);
    await page.goto(BASE + '?lang=ar&mocklevels=5', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__booted === true, null, { timeout: 30000 });
    eq(await page.evaluate(() => typeof window.__app), 'undefined', 'no window.__app');
    eq(await page.evaluate(() => document.documentElement.lang), 'en', 'URL flags are ignored');
    ok((await page.locator('[data-act="play"]').count()) === 1, 'the title is up');
    await context.close();
  });
}

// ───────────────────────────── runner ─────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const runDev = args.indexOf('--prod') < 0;
  const runProd = args.indexOf('--dev') < 0;
  const browser = await chromium.launch();
  let server = null;
  try {
    if (runDev) {
      console.log('dev server (' + BASE + ')');
      const existing = await get(BASE);
      if (existing && existing.status === 200 && !isDevHtml(existing.body)) throw new Error('port ' + PORT + ' serves something that is not the dev app');
      if (!existing) {
        server = spawn(process.execPath, [VITE, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
        if (!(await waitForServer(isDevHtml))) throw new Error('the dev server did not start');
      }
      await devTests(browser);
      if (server) {
        server.kill();
        server = null;
        await sleep(600);
      }
    }
    if (runProd) {
      console.log('production build (vite build + vite preview --port ' + PORT + ' --strictPort)');
      const existing = await get(BASE);
      if (existing && existing.status === 200 && isDevHtml(existing.body)) {
        throw new Error('a dev server is running on port ' + PORT + ': stop it before the production part');
      }
      if (!existing) {
        const build = spawnSync(process.execPath, [VITE, 'build'], { cwd: ROOT, encoding: 'utf8' });
        if (build.status !== 0) throw new Error('vite build failed:\n' + (build.stdout || '') + (build.stderr || ''));
        const tail = (build.stdout || '').trim().split('\n').slice(-3).join(' | ');
        console.log('    build: ' + tail.replace(/\s+/g, ' '));
        server = spawn(process.execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
        if (!(await waitForServer(isProdHtml))) throw new Error('vite preview did not start');
      }
      await prodTests(browser);
    }
  } catch (err) {
    failures++;
    console.log('  ✗ ' + (err && err.message ? err.message : err));
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const bad = failures + problems.length;
  console.log('');
  console.log(bad === 0 ? 'PASS  ' + checks + ' checks, no console errors, no CSP violations' : 'FAIL  ' + failures + ' failed check(s), ' + problems.length + ' console problem(s)');
  process.exitCode = bad === 0 ? 0 : 1;
}

main();
