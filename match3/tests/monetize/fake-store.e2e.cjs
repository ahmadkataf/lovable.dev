/**
 * The browser test store in a real browser (Playwright, run by hand — not part of `npm test`):
 *
 *   npx vite --port 5186 --strictPort &
 *   node tests/monetize/fake-store.e2e.cjs [http://127.0.0.1:5186] [screenshot-dir]
 *
 * It works against a production bundle too (`vite build` + `vite preview`), which is the steadier
 * choice while other people edit the tree: the dev server reloads the page on every file change.
 *
 * Drives the store through the app's debug hook (`window.__app.store`) and answers the TEST STORE /
 * TEST AD overlays by their data-testid, at a phone size and at 320×480, in English and Arabic.
 * Exits with code 1 when a check fails.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:5186';
const SHOTS = process.argv[3] || '';
const DAY = 86400000;

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
}

/** A player who reached level 30 and first played ten days ago. */
function saveParam(extra) {
  const levels = {};
  for (let id = 1; id <= 29; id++) levels[id] = { stars: 1, best: 0 };
  const save = Object.assign({ version: 1, levels, coins: 2000, firstDay: Math.floor(Date.now() / DAY) - 10 }, extra || {});
  return Buffer.from(JSON.stringify(save), 'utf8').toString('base64');
}

async function open(browser, viewport, query) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(BASE + '/?' + query);
  await page.waitForFunction(() => window.__app && window.__app.store && window.__app.store.iapAvailable(), null, { timeout: 15000 });
  return { context, page, errors };
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

/** Start a store call in the page and keep its promise under a name. */
async function start(page, name, expr) {
  await page.evaluate(([n, e]) => {
    window.__t = window.__t || {};
    window.__t[n] = null;
    Promise.resolve(eval(e)).then((v) => (window.__t[n] = { v }));
  }, [name, expr]);
}

async function result(page, name) {
  await page.waitForFunction((n) => window.__t[n] !== null, name, { timeout: 10000 });
  return page.evaluate((n) => window.__t[n].v, name);
}

/** The overlay must cover the viewport, sit on top, and keep its buttons inside the screen. */
async function overlayOk(page, rootId, buttonIds) {
  return page.evaluate(([id, ids]) => {
    const root = document.querySelector('[data-testid="' + id + '"]');
    if (!root) return 'no ' + id;
    const r = root.getBoundingClientRect();
    if (r.width < window.innerWidth || r.height < window.innerHeight) return 'does not cover the viewport';
    if (getComputedStyle(root).direction !== 'ltr') return 'not left-to-right';
    for (const b of ids) {
      const el = root.querySelector('[data-testid="' + b + '"]');
      if (!el) return 'no ' + b;
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue; // hidden for now
      if (box.left < 0 || box.right > window.innerWidth || box.top < 0 || box.bottom > window.innerHeight) return b + ' is off screen';
      if (box.height < 48) return b + ' is smaller than 48 px';
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (top !== el) return b + ' is covered by ' + (top && top.tagName);
    }
    return 'ok';
  }, [rootId, buttonIds]);
}

async function run(browser, label, viewport, lang) {
  console.log('\n' + label);
  const query = 'debug=1&fakestore=1&screen=map&still=1&lang=' + lang + '&save=' + encodeURIComponent(saveParam());
  const { context, page, errors } = await open(browser, viewport, query);
  await page.evaluate(() => window.localStorage.removeItem('match3.fakestore.v1'));
  const coins = () => page.evaluate(() => window.__app.profile.coins());
  const boosters = () => page.evaluate(() => ['hammer', 'freeSwap', 'prism'].map((id) => window.__app.profile.boosterCount(id)));
  // The shell hands out the booster introduction gifts when the map opens: wait for them, then take the baseline.
  await page.waitForFunction(() => window.__app.profile.claimUnlocks().length === 0);
  const boosters0 = await boosters();

  check('7 products with test prices', (await page.evaluate(() => window.__app.store.products().map((p) => p.info.price).join(' '))) === 'US$0.99 US$4.99 US$9.99 US$19.99 US$49.99 US$1.99 US$2.99');
  check('ads available, rewarded ready', await page.evaluate(() => window.__app.store.adsAvailable() && window.__app.store.rewardedReady()));

  // interstitial: third finished level, shown as a TEST AD that can only be closed after the countdown
  await start(page, 'i1', 'window.__app.store.maybeShowInterstitial()');
  await start(page, 'i2', 'window.__app.store.maybeShowInterstitial()');
  check('no interstitial for the first two levels', (await result(page, 'i1')) === false && (await result(page, 'i2')) === false);
  const t0 = Date.now();
  await start(page, 'i3', 'window.__app.store.maybeShowInterstitial()');
  await page.waitForSelector('[data-testid="fake-ad"]');
  check('TEST AD overlay (interstitial)', (await overlayOk(page, 'fake-ad', ['fake-ad-skip', 'fake-ad-close'])) === 'ok', await overlayOk(page, 'fake-ad', ['fake-ad-skip', 'fake-ad-close']));
  check('labelled TEST AD', (await page.textContent('[data-testid="fake-ad"]')).indexOf('TEST AD') >= 0);
  check('close button hidden during the countdown', !(await page.isVisible('[data-testid="fake-ad-close"]')));
  await shot(page, label + '-ad-countdown');
  await page.waitForSelector('[data-testid="fake-ad-close"]', { state: 'visible' });
  const waited = Date.now() - t0; // since the ad was requested (the checks above took part of it)
  check('countdown of about 1.5 s', waited >= 1500 && waited < 4000, waited);
  check('close button usable after the countdown', (await overlayOk(page, 'fake-ad', ['fake-ad-close'])) === 'ok', await overlayOk(page, 'fake-ad', ['fake-ad-close']));
  await shot(page, label + '-ad-close');
  await page.click('[data-testid="fake-ad-close"]');
  check('interstitial shown and closed → true', (await result(page, 'i3')) === true);
  check('overlay removed', (await page.$('[data-testid="fake-ad"]')) === null);

  // rewarded: refused for ten minutes of interstitial? no — rewarded ads are always allowed
  await start(page, 'r1', "window.__app.store.showRewarded('freeCoins')");
  await page.waitForSelector('[data-testid="fake-ad-close"]', { state: 'visible' });
  await page.click('[data-testid="fake-ad-close"]');
  check('rewarded watched to the end → earned', (await result(page, 'r1')) === 'earned');
  check('2 free-coin ads left', (await page.evaluate(() => window.__app.store.freeCoinAdsLeft())) === 2);
  await start(page, 'r2', "window.__app.store.showRewarded('freeCoins')");
  await page.waitForSelector('[data-testid="fake-ad-skip"]', { state: 'visible' });
  await page.click('[data-testid="fake-ad-skip"]');
  check('rewarded closed early → dismissed', (await result(page, 'r2')) === 'dismissed');
  check('still 2 free-coin ads left', (await page.evaluate(() => window.__app.store.freeCoinAdsLeft())) === 2);

  // purchases
  const before = await coins();
  await start(page, 'b1', "window.__app.store.buy('coins_small')");
  await page.waitForSelector('[data-testid="fake-store"]');
  check('TEST STORE overlay', (await overlayOk(page, 'fake-store', ['fake-buy', 'fake-pending', 'fake-cancel'])) === 'ok', await overlayOk(page, 'fake-store', ['fake-buy', 'fake-pending', 'fake-cancel']));
  const text = await page.textContent('[data-testid="fake-store"]');
  check('labelled TEST STORE, with product and price', text.indexOf('TEST STORE') >= 0 && text.indexOf('coins_small') >= 0 && text.indexOf('US$0.99') >= 0, text);
  await shot(page, label + '-store');
  await page.click('[data-testid="fake-buy"]');
  check('Buy → purchased', (await result(page, 'b1')) === 'purchased');
  check('+1,000 coins', (await coins()) === before + 1000, await coins());
  await start(page, 'b2', "window.__app.store.buy('coins_mega')");
  await page.waitForSelector('[data-testid="fake-store"]');
  await page.click('[data-testid="fake-cancel"]');
  check('Cancel → cancelled, nothing granted', (await result(page, 'b2')) === 'cancelled' && (await coins()) === before + 1000);
  await start(page, 'b3', "window.__app.store.buy('starter_pack')");
  await page.waitForSelector('[data-testid="fake-store"]');
  await page.click('[data-testid="fake-buy"]');
  check('starter pack → purchased', (await result(page, 'b3')) === 'purchased');
  const got = await boosters();
  check('4,000 coins + 3 hammer + 3 freeSwap + 2 prism', (await coins()) === before + 5000 && got.map((n, i) => n - boosters0[i]).join() === '3,3,2', got);
  await start(page, 'b4', "window.__app.store.buy('starter_pack')");
  check('a second starter pack → alreadyOwned', (await result(page, 'b4')) === 'alreadyOwned');
  await start(page, 'b5', "window.__app.store.buy('coins_large')");
  await page.waitForSelector('[data-testid="fake-store"]');
  await page.click('[data-testid="fake-pending"]');
  check('Pay later → pending, nothing granted', (await result(page, 'b5')) === 'pending' && (await coins()) === before + 5000);

  // an owner never sees an interstitial; rewarded ads stay
  for (const n of ['o1', 'o2', 'o3', 'o4']) await start(page, n, 'window.__app.store.maybeShowInterstitial()');
  check('no interstitial for an owner', (await result(page, 'o4')) === false && (await page.$('[data-testid="fake-ad"]')) === null);
  check('rewarded ads still offered', await page.evaluate(() => window.__app.store.rewardedReady()));

  // privacy options
  await start(page, 'p1', 'window.__app.store.showPrivacyOptions()');
  await page.waitForSelector('[data-testid="fake-privacy-close"]');
  check('TEST PRIVACY OPTIONS overlay', (await overlayOk(page, 'fake-privacy', ['fake-privacy-close'])) === 'ok');
  await page.click('[data-testid="fake-privacy-close"]');
  await result(page, 'p1');

  // the app's own shop on top of the test store (somebody else's screen: only that it opens and lists prices)
  await page.evaluate(() => window.__app.goto('shop'));
  await page.waitForTimeout(700);
  check('the shop shows the store prices', (await page.evaluate(() => document.body.innerText)).indexOf('US$0.99') >= 0);
  await shot(page, label + '-shop');

  // "reinstall": the same pretend account, a fresh profile → the starter pack is restored without its goodies,
  // and the pending payment completes
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.store && window.__app.store.iapAvailable(), null, { timeout: 15000 });
  await page.waitForFunction(() => window.__app.store.owns('starter_pack'), null, { timeout: 5000 });
  check('restored after a reload: owns the starter pack', true);
  await page.waitForFunction(() => window.__app.profile.claimUnlocks().length === 0);
  await page.waitForFunction(() => window.__app.profile.coins() !== 2000, null, { timeout: 5000 });
  check('…without a second helping, plus the pending 12,000 coins', (await coins()) === 2000 + 12000 && (await boosters()).join() === boosters0.join(), [await coins(), await boosters()]);

  check('no page errors', errors.length === 0, errors);
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 'phone-en', { width: 390, height: 780 }, 'en');
  await run(browser, 'small-ar', { width: 320, height: 480 }, 'ar');
  await run(browser, 'landscape-en', { width: 780, height: 360 }, 'en');

  // ?fakestore=0 turns the test store off (also under the dev server); a production bundle without
  // the flag has no store at all
  console.log('\nflags');
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  const off = () => page.evaluate(() => !window.__app.store.iapAvailable() && !window.__app.store.adsAvailable() && window.__app.store.products().length === 0);
  await page.goto(BASE + '/?debug=1&fakestore=0&screen=map&still=1');
  await page.waitForFunction(() => window.__app && window.__app.store, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  check('?fakestore=0: everything unavailable', await off());
  await page.goto(BASE + '/?debug=1&screen=map&still=1');
  await page.waitForFunction(() => window.__app && window.__app.store, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const dev = await page.evaluate(() => !!document.querySelector('script[src*="@vite/client"]'));
  check(dev ? 'dev server without a flag: the test store' : 'production bundle without a flag: everything unavailable', (await off()) === !dev);
  await context.close();

  await browser.close();
  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
