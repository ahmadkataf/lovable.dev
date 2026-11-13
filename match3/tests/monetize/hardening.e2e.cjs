/**
 * Money paths in a real browser (Playwright, run by hand — not part of `npm test`):
 *
 *   npx vite --port 5186 --strictPort &                      (dev server)
 *   node tests/monetize/hardening.e2e.cjs [http://127.0.0.1:5186] [screenshot-dir]
 *
 *   npx vite build --outDir <dir> && npx vite preview --outDir <dir> --port 5186 --strictPort &
 *   node tests/monetize/hardening.e2e.cjs                    (the same script; it notices the production bundle)
 *
 * What it proves:
 *  1. The browser test store, driven through the GAME'S OWN SHOP (not through a debug hook): a coin
 *     pack, "pay later", cancel, an entitlement, a rewarded ad watched and one closed early — and a
 *     reload, after which nothing is granted twice and nothing is lost.
 *  2. A pretend Android wrapper around the real app: a wrapper whose storeSave silently keeps
 *     nothing must NOT see iapFinish; multi-quantity; "already owned" is not ownership; a purchase
 *     screen that closes without a word frees the shop after 30 s.
 *  3. Where the test store may exist: never with the Android bridge, never in an Android WebView,
 *     and in a production bundle only with ?fakestore=1 — without it everything is unavailable.
 * Exits with code 1 when a check fails.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:5186';
const SHOTS = process.argv[3] || '';
const DAY = 86400000;
const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36';

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
}

/** A player who reached level 30 and first played ten days ago. */
function saveParam() {
  const levels = {};
  for (let id = 1; id <= 29; id++) levels[id] = { stars: 1, best: 0 };
  const save = { version: 1, levels, coins: 2000, firstDay: Math.floor(Date.now() / DAY) - 10 };
  return Buffer.from(JSON.stringify(save), 'utf8').toString('base64');
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}

async function boot(page, query) {
  await page.goto(BASE + '/?' + query);
  await page.waitForFunction(() => window.__app && window.__app.store, null, { timeout: 20000 });
}

const coins = (page) => page.evaluate(() => window.__app.profile.coins());
const account = (page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('match3.fakestore.v1') || 'null'));

/** Start a store call in the page and keep its promise under a name. */
async function start(page, name, expr) {
  await page.evaluate(([n, e]) => {
    window.__t = window.__t || {};
    window.__t[n] = null;
    Promise.resolve(eval(e)).then((v) => (window.__t[n] = { v }));
  }, [name, expr]);
}
async function result(page, name, timeout) {
  await page.waitForFunction((n) => window.__t[n] !== null, name, { timeout: timeout || 10000 });
  return page.evaluate((n) => window.__t[n].v, name);
}
const pending = (page, name) => page.evaluate((n) => window.__t[n] === null, name);

// ───────────────────────────── 1. the test store through the game's shop ─────────────────────────────

async function shopJourney(browser, isDev) {
  console.log('\n1. the test store, through the game’s own shop');
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const query = 'debug=1&fakestore=1&screen=map&still=1&lang=en&save=' + encodeURIComponent(saveParam());
  await boot(page, query);
  await page.evaluate(() => window.localStorage.removeItem('match3.fakestore.v1'));
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.store && window.__app.store.iapAvailable(), null, { timeout: 20000 });
  await page.waitForFunction(() => window.__app.profile.claimUnlocks().length === 0);
  const hammer0 = await page.evaluate(() => window.__app.profile.boosterCount('hammer'));
  await page.evaluate(() => window.__app.goto('shop'));
  await page.waitForSelector('[data-product="coins_small"] button');
  const shopText = () => page.evaluate(() => (document.querySelector('.m-dialog-shop') || document.body).innerText);

  // the price on the game's button is the store's own string
  const shown = await page.evaluate(() => Array.from(document.querySelectorAll('[data-product]')).map((el) => el.getAttribute('data-product') + '=' + el.querySelector('button').textContent.trim()).join(' '));
  check('every offer shows the store’s price string', shown === 'starter_pack=US$1.99 remove_ads=US$2.99 coins_small=US$0.99 coins_medium=US$4.99 coins_large=US$9.99 coins_xl=US$19.99 coins_mega=US$49.99', shown);

  // a coin pack: Buy
  await page.click('[data-product="coins_small"] button');
  await page.waitForSelector('[data-testid="fake-store"]');
  const sheet = await page.textContent('[data-testid="fake-store"]');
  check('the TEST STORE sheet names the product and the same price', sheet.indexOf('TEST STORE') >= 0 && sheet.indexOf('coins_small') >= 0 && sheet.indexOf('US$0.99') >= 0, sheet);
  check('nothing is granted while the sheet is open', (await coins(page)) === 2000);
  await shot(page, 'shop-sheet');
  await page.click('[data-testid="fake-buy"]');
  await page.waitForFunction(() => window.__app.profile.coins() === 3000, null, { timeout: 5000 });
  check('Buy → +1,000 coins, exactly once', (await coins(page)) === 3000);
  await page.waitForFunction(() => (document.querySelector('.m-dialog-shop') || document.body).innerText.indexOf('3,000') >= 0, null, { timeout: 5000 });
  check('the shop shows the new balance', (await shopText()).indexOf('3,000') >= 0);
  await page.waitForFunction(() => {
    const a = JSON.parse(window.localStorage.getItem('match3.fakestore.v1') || 'null');
    return a && a.open.length === 0;
  }, null, { timeout: 5000 });
  check('the purchase was finished (consumed) with the pretend account', (await account(page)).open.length === 0);
  check('…after it was saved: the stored save has the token', await page.evaluate(() => window.__app.profile.shop().tokens.length === 1 && window.__app.profile.purchaseSaved !== undefined));
  await shot(page, 'shop-bought');

  // a coin pack: Cancel
  await page.click('[data-product="coins_mega"] button');
  await page.waitForSelector('[data-testid="fake-store"]');
  await page.click('[data-testid="fake-cancel"]');
  await page.waitForSelector('[data-testid="fake-store"]', { state: 'detached' });
  await page.waitForTimeout(300);
  check('Cancel → nothing granted', (await coins(page)) === 3000);

  // the starter pack: Pay later (pending) — nothing yet
  await page.click('[data-product="starter_pack"] button');
  await page.waitForSelector('[data-testid="fake-store"]');
  await page.click('[data-testid="fake-pending"]');
  await page.waitForSelector('[data-testid="fake-store"]', { state: 'detached' });
  await page.waitForTimeout(400);
  check('Pay later → pending: no coins, no boosters, not owned', (await coins(page)) === 3000 && (await page.evaluate(() => window.__app.profile.boosterCount('hammer'))) === hammer0 && !(await page.evaluate(() => window.__app.store.owns('starter_pack'))));
  check('…and the player does not count as a payer yet', (await page.evaluate(() => window.__app.profile.shop().owned.length)) === 0);

  // remove ads: Buy
  await page.click('[data-product="remove_ads"] button');
  await page.waitForSelector('[data-testid="fake-store"]');
  await page.click('[data-testid="fake-buy"]');
  await page.waitForFunction(() => window.__app.store.owns('remove_ads'), null, { timeout: 5000 });
  check('remove_ads bought → owned, no coins', (await coins(page)) === 3000);
  await page.waitForFunction(() => document.querySelector('[data-product="remove_ads"]') === null, null, { timeout: 5000 }).catch(() => {});
  check('the shop no longer sells what is owned', (await page.$('[data-product="remove_ads"]')) === null);
  for (const n of ['i1', 'i2', 'i3', 'i4']) await start(page, n, 'window.__app.store.maybeShowInterstitial()');
  check('an owner never gets an interstitial', (await result(page, 'i4')) === false && (await page.$('[data-testid="fake-ad"]')) === null);

  // a rewarded ad from the shop: watched to the end
  await page.click('[data-act="free-coins"]');
  await page.waitForSelector('[data-testid="fake-ad"]');
  check('the TEST AD says what it is for', (await page.textContent('[data-testid="fake-ad"]')).indexOf('freeCoins') >= 0);
  check('no reward while the ad runs', (await coins(page)) === 3000);
  await page.waitForSelector('[data-testid="fake-ad-close"]', { state: 'visible' });
  await page.click('[data-testid="fake-ad-close"]');
  await page.waitForFunction(() => window.__app.profile.coins() === 3050, null, { timeout: 5000 });
  check('watched → +50 coins, 2 left today', (await coins(page)) === 3050 && (await page.evaluate(() => window.__app.store.freeCoinAdsLeft())) === 2);
  // …and one closed early
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-act="free-coins"]');
    return b && !b.disabled && b.getAttribute('aria-busy') !== 'true';
  }, null, { timeout: 5000 }).catch(() => {});
  await page.click('[data-act="free-coins"]');
  await page.waitForSelector('[data-testid="fake-ad-skip"]', { state: 'visible' });
  await page.click('[data-testid="fake-ad-skip"]');
  await page.waitForSelector('[data-testid="fake-ad"]', { state: 'detached' });
  await page.waitForTimeout(400);
  check('closed early → no coins, still 2 left', (await coins(page)) === 3050 && (await page.evaluate(() => window.__app.store.freeCoinAdsLeft())) === 2);
  await shot(page, 'shop-after');

  // a reload: the same pretend account, the profile back to the save in the URL ("a reinstall")
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.store && window.__app.store.iapAvailable(), null, { timeout: 20000 });
  await page.waitForFunction(() => window.__app.store.owns('remove_ads') && window.__app.store.owns('starter_pack'), null, { timeout: 8000 });
  await page.waitForFunction(() => window.__app.profile.claimUnlocks().length === 0);
  check('after a reload: remove_ads is restored; the pending starter pack has completed and is granted now', (await coins(page)) === 2000 + 4000 && (await page.evaluate(() => window.__app.profile.boosterCount('hammer'))) === hammer0 + 3, await coins(page));
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.store && window.__app.store.iapAvailable(), null, { timeout: 20000 });
  await page.waitForFunction(() => window.__app.store.owns('starter_pack'), null, { timeout: 8000 });
  await page.waitForFunction(() => window.__app.profile.claimUnlocks().length === 0);
  await page.waitForTimeout(500);
  check('…and once more: restored without a second helping', (await coins(page)) === 2000 && (await page.evaluate(() => window.__app.profile.boosterCount('hammer'))) === hammer0, await coins(page));
  check('the consumed coin pack never comes back', (await account(page)).open.length === 0 && (await account(page)).pending.length === 0, await account(page));
  check('no page errors', errors.length === 0, errors);
  await context.close();

  // the real save (localStorage), no ?save=: bought once, kept across a reload, finished
  const real = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const p2 = await real.newPage();
  await boot(p2, 'debug=1&fakestore=1&screen=map&still=1');
  await p2.waitForFunction(() => window.__app.store.iapAvailable(), null, { timeout: 20000 });
  await start(p2, 'b', "window.__app.store.buy('coins_medium')");
  await p2.waitForSelector('[data-testid="fake-buy"]');
  await p2.click('[data-testid="fake-buy"]');
  check('real save: purchased', (await result(p2, 'b')) === 'purchased' && (await coins(p2)) === 7500);
  check('real save: the token is in localStorage before the account lets go of the purchase', await p2.evaluate(() => JSON.parse(window.localStorage.getItem('match3.save.v1')).shop.tokens.length === 1 && JSON.parse(window.localStorage.getItem('match3.fakestore.v1')).open.length === 0));
  await p2.reload();
  await p2.waitForFunction(() => window.__app && window.__app.store && window.__app.store.iapAvailable(), null, { timeout: 20000 });
  await p2.waitForTimeout(600);
  check('real save: 7,500 coins after a reload — kept, and not granted again', (await coins(p2)) === 7500, await coins(p2));
  await real.close();
  void isDev;
}

// ───────────────────────────── 2. a pretend Android wrapper ─────────────────────────────

function installWrapper() {
  const calls = (window.__calls = []);
  window.__save = '';
  window.__dropSaves = false;
  window.AndroidBridge = {
    loadSave: () => window.__save,
    storeSave: (json) => {
      // a wrapper that fails: the call returns normally and nothing is kept
      if (!window.__dropSaves) window.__save = json;
      calls.push(window.__dropSaves ? 'storeSave(dropped)' : 'storeSave');
    },
    haptic: () => {},
    setAtRoot: () => {},
    info: () => JSON.stringify({ versionName: '1.0.0', versionCode: 1, locale: 'en-US' }),
    rate: () => {},
    storeCaps: () => '{"billing":true,"ads":true}',
    storeSync: () => calls.push('storeSync'),
    iapQuery: (json) => calls.push('iapQuery:' + json),
    iapBuy: (id) => calls.push('iapBuy:' + id),
    iapFinish: (token) => {
      let saved = false;
      try {
        saved = JSON.parse(window.__save).shop.tokens.indexOf(token) >= 0;
      } catch (e) {
        saved = false;
      }
      calls.push('iapFinish:' + token + ':' + (saved ? 'saved' : 'NOT-saved'));
    },
    iapRestore: () => calls.push('iapRestore'),
    adShowRewarded: (placement) => calls.push('adShowRewarded:' + placement),
    adShowInterstitial: () => calls.push('adShowInterstitial'),
    adPrivacyOptions: () => calls.push('adPrivacyOptions'),
  };
}

async function androidJourney(browser) {
  console.log('\n2. a pretend Android wrapper around the real app');
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.clock.install();
  await page.addInitScript(installWrapper);
  await boot(page, 'debug=1&fakestore=1&screen=map&still=1');
  const emit = (event) => page.evaluate((json) => window.__native.store(json), JSON.stringify(event));
  const calls = () => page.evaluate(() => window.__calls.filter((c) => c.indexOf('storeSave') !== 0).map((c) => (c.indexOf('iapQuery:') === 0 ? 'iapQuery' : c)));
  const finishes = async () => (await calls()).filter((c) => c.indexOf('iapFinish:') === 0);

  check('the real store, not the test store (even with ?fakestore=1)', JSON.stringify((await calls()).slice(0, 3)) === JSON.stringify(['storeSync', 'iapQuery', 'iapRestore']), await calls());
  await emit({ type: 'products', products: [{ id: 'coins_small', price: '٣٫٩٩ ر.س' }, { id: 'coins_medium', price: '١٨٫٩٩ ر.س' }, { id: 'coins_mega', price: '١٨٩٫٩٩ ر.س' }, { id: 'remove_ads', price: '١١٫٩٩ ر.س' }] });
  await emit({ type: 'ads', canRequestAds: true, rewardedReady: true, interstitialReady: true, privacyOptionsRequired: false });
  const before = await coins(page);

  // DEFECT (fixed): the wrapper holds a save, and then its storeSave keeps nothing — without throwing
  await page.evaluate(() => window.__app.profile.markSeen('e2e.played-a-bit'));
  check('the wrapper holds a save of its own', await page.evaluate(() => window.__save.length > 0 && JSON.parse(window.__save).shop.tokens.length === 0));
  await page.evaluate(() => (window.__dropSaves = true));
  await start(page, 'mega', "window.__app.store.buy('coins_mega')");
  await emit({ type: 'purchase', id: 'coins_mega', state: 'purchased', token: 'GPA.9999-MEGA' });
  check('a purchase arrives while the wrapper’s storage is failing: the buyer is told, the coins are there', (await result(page, 'mega')) === 'purchased' && (await coins(page)) === before + 70000);
  check('…the save did not reach the wrapper (only the mirror copy in the WebView has it)', await page.evaluate(() => JSON.parse(window.__save).shop.tokens.length === 0 && JSON.parse(window.localStorage.getItem('match3.save.v1')).shop.tokens.length === 1));
  check('…so the purchase is NOT finished (it would be consumed and lost at the next start)', (await finishes()).length === 0, await finishes());
  await emit({ type: 'purchase', id: 'coins_mega', state: 'purchased', token: 'GPA.9999-MEGA' });
  check('delivered again: still not finished, not granted twice', (await finishes()).length === 0 && (await coins(page)) === before + 70000);
  // storage recovers; the next ordinary save carries the grant; the next delivery finishes it
  await page.evaluate(() => (window.__dropSaves = false));
  await page.evaluate(() => window.__app.profile.markSeen('e2e.recovered'));
  await emit({ type: 'purchase', id: 'coins_mega', state: 'purchased', token: 'GPA.9999-MEGA' });
  check('storage recovered: finished now — with the grant in the wrapper’s save', JSON.stringify(await finishes()) === JSON.stringify(['iapFinish:GPA.9999-MEGA:saved']), await finishes());
  check('…and still granted exactly once', (await coins(page)) === before + 70000);

  // several units in one purchase
  await emit({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'GPA.3x', quantity: 3 });
  check('quantity 3 of the 1,000-coin pack → +3,000', (await coins(page)) === before + 73000, await coins(page));

  // "already owned" is not ownership
  await start(page, 'ra', "window.__app.store.buy('remove_ads')");
  await emit({ type: 'purchase', id: 'remove_ads', state: 'alreadyOwned' });
  check('"alreadyOwned" answers the buyer…', (await result(page, 'ra')) === 'alreadyOwned');
  check('…records nothing, and asks the store for a listing', !(await page.evaluate(() => window.__app.store.owns('remove_ads'))) && (await calls()).slice(-1)[0] === 'iapRestore', (await calls()).slice(-2));
  await emit({ type: 'owned', ids: [], complete: true });
  check('the listing says "not owned" (the payment is pending): still not owned', !(await page.evaluate(() => window.__app.store.owns('remove_ads'))));
  await emit({ type: 'owned', ids: ['remove_ads'], complete: true });
  check('a listing that has it: owned', await page.evaluate(() => window.__app.store.owns('remove_ads')));

  // a purchase screen that closes without a word
  const restoresBefore = (await calls()).filter((c) => c === 'iapRestore').length;
  await start(page, 'silent', "window.__app.store.buy('coins_medium')");
  await page.evaluate(() => window.__native.pause()); // Google Play's sheet covers the game
  await page.clock.fastForward(120000);
  check('while the sheet is up, the purchase stays open', await pending(page, 'silent'));
  await page.evaluate(() => window.__native.resume()); // …and closes without any event
  await page.clock.fastForward(29000);
  check('29 s after the return: still waiting', await pending(page, 'silent'));
  await page.clock.fastForward(2000);
  check('31 s after the return: the buyer is answered ("error")', (await result(page, 'silent')) === 'error');
  check('…a listing was asked for', (await calls()).filter((c) => c === 'iapRestore').length === restoresBefore + 1);
  await start(page, 'next', "window.__app.store.buy('coins_small')");
  await page.waitForTimeout(100);
  check('…and the shop takes the next purchase at once', (await calls()).slice(-1)[0] === 'iapBuy:coins_small', (await calls()).slice(-2));
  await emit({ type: 'purchase', id: 'coins_small', state: 'cancelled' });
  // the silent payment did go through: the listing delivers it
  await emit({ type: 'purchase', id: 'coins_medium', state: 'purchased', token: 'GPA.late' });
  check('the late payment is granted and finished like any other', (await coins(page)) === before + 78500 && (await finishes()).slice(-1)[0] === 'iapFinish:GPA.late:saved', [await coins(page), await finishes()]);

  check('every finish found its grant in the wrapper’s save', (await finishes()).every((c) => /:saved$/.test(c)), await finishes());
  check('no TEST STORE / TEST AD overlay ever appeared', (await page.$('[data-testid^="fake-"]')) === null);
  check('no page errors', errors.length === 0, errors);
  await context.close();
}

// ───────────────────────────── 3. where the test store may exist ─────────────────────────────

async function offCheck(page) {
  return page.evaluate(async () => {
    const s = window.__app.store;
    const flat = !s.iapAvailable() && !s.adsAvailable() && s.products().length === 0 && !s.rewardedReady() && s.freeCoinAdsLeft() === 0 && !s.privacyOptionsRequired() && !s.owns('remove_ads');
    const buy = await s.buy('coins_small');
    const ad = await s.showRewarded('freeCoins');
    const inter = await s.maybeShowInterstitial();
    const restored = await s.restore();
    return flat && buy === 'unavailable' && ad === 'unavailable' && inter === false && restored === 0 && document.querySelector('[data-testid^="fake-"]') === null;
  });
}

async function whereItLives(browser, isDev) {
  console.log('\n3. where the test store may exist (' + (isDev ? 'dev server' : 'production bundle') + ')');
  const save = '&save=' + encodeURIComponent(saveParam());

  // an Android WebView without the bridge: an app all the same
  let context = await browser.newContext({ viewport: { width: 390, height: 780 }, userAgent: WEBVIEW_UA });
  let page = await context.newPage();
  await boot(page, 'debug=1&fakestore=1&screen=map&still=1' + save);
  await page.waitForTimeout(400);
  check('Android WebView user agent + ?fakestore=1: everything unavailable', await offCheck(page));
  await context.close();

  context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  page = await context.newPage();
  await boot(page, 'debug=1&fakestore=0&screen=map&still=1' + save);
  await page.waitForTimeout(400);
  check('?fakestore=0: everything unavailable', await offCheck(page));

  await boot(page, 'debug=1&screen=map&still=1' + save);
  await page.waitForTimeout(400);
  if (isDev) {
    check('dev server, no flag: the test store (a developer convenience)', await page.evaluate(() => window.__app.store.iapAvailable()));
  } else {
    check('PRODUCTION bundle, no flag: everything unavailable, every request answered', await offCheck(page));
    await page.evaluate(() => window.__app.goto('shop'));
    await page.waitForTimeout(900);
    check('…and the game’s shop offers nothing for real money and no ad', (await page.$('[data-product]')) === null && (await page.$('[data-act="free-coins"]')) === null);
    await shot(page, 'production-shop-no-store');
    for (const odd of ['fakestore=true', 'fakestore=yes', 'fakestore=11', 'fakestore', 'FAKESTORE=1', 'fakestore=1x', 'xfakestore=1']) {
      await boot(page, 'debug=1&screen=map&still=1&' + odd + save);
      await page.waitForTimeout(250);
      check('PRODUCTION bundle, ?' + odd + ': everything unavailable', await offCheck(page));
    }
    await boot(page, 'debug=1&fakestore=1&screen=map&still=1' + save);
    await page.waitForFunction(() => window.__app.store.iapAvailable(), null, { timeout: 8000 }).catch(() => {});
    check('PRODUCTION bundle, ?fakestore=1 in a browser: the test store (as designed)', await page.evaluate(() => window.__app.store.iapAvailable()));
  }
  await context.close();

  // the bridge exists: the real path, whatever the URL says
  context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  page = await context.newPage();
  await page.addInitScript(installWrapper);
  await boot(page, 'debug=1&fakestore=1&screen=map&still=1');
  await page.waitForTimeout(300);
  check('with the Android bridge + ?fakestore=1: the wrapper is asked, nothing is offered until IT answers', await page.evaluate(() => window.__calls.indexOf('iapRestore') >= 0 && !window.__app.store.iapAvailable() && window.__app.store.products().length === 0));
  await context.close();

  // a wrapper built without purchases: nothing at all
  context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  page = await context.newPage();
  await page.addInitScript(() => {
    window.__save = '';
    window.AndroidBridge = { loadSave: () => window.__save, storeSave: (json) => (window.__save = json), haptic: () => {}, setAtRoot: () => {}, info: () => '{}', rate: () => {} };
  });
  await boot(page, 'debug=1&fakestore=1&screen=map&still=1');
  await page.waitForTimeout(300);
  check('an Android bridge without the store methods + ?fakestore=1: everything unavailable', await offCheck(page));
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  const probe = await browser.newPage();
  await probe.goto(BASE + '/');
  const isDev = await probe.evaluate(() => !!document.querySelector('script[src*="@vite/client"]'));
  await probe.close();
  console.log(isDev ? 'dev server at ' + BASE : 'production bundle at ' + BASE);

  await shopJourney(browser, isDev);
  await androidJourney(browser);
  await whereItLives(browser, isDev);

  await browser.close();
  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
