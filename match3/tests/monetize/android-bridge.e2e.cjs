/**
 * The Android path of the store inside the real app, with a pretend wrapper (Playwright, run by hand):
 *
 *   node tests/monetize/android-bridge.e2e.cjs [http://127.0.0.1:5186]
 *
 * A `window.AndroidBridge` with the monetisation methods is injected before the page loads; the
 * script then plays the wrapper's part by calling `window.__native.store(json)`. Checks that the app
 * asks for products and a restore at start, that a purchase is saved (through the bridge) BEFORE it
 * is finished, and that the browser test store cannot appear — not even with ?fakestore=1.
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5186';
let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok || detail === undefined ? '' : '  → ' + JSON.stringify(detail)));
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(() => {
    const calls = (window.__calls = []);
    window.__save = '';
    window.AndroidBridge = {
      loadSave: () => window.__save,
      storeSave: (json) => {
        window.__save = json;
        calls.push('storeSave');
      },
      haptic: () => {},
      setAtRoot: () => {},
      info: () => JSON.stringify({ versionName: '1.0.0', versionCode: 1, locale: 'en-US' }),
      rate: () => {},
      storeCaps: () => '{"billing":true,"ads":true}',
      storeSync: () => calls.push('storeSync'),
      iapQuery: (json) => calls.push('iapQuery:' + json),
      iapBuy: (id) => calls.push('iapBuy:' + id),
      iapFinish: (token) => calls.push('iapFinish:' + token + ':' + (JSON.parse(window.__save).shop.tokens.indexOf(token) >= 0 ? 'saved' : 'NOT-saved')),
      iapRestore: () => calls.push('iapRestore'),
      adShowRewarded: (placement) => calls.push('adShowRewarded:' + placement),
      adShowInterstitial: () => calls.push('adShowInterstitial'),
      adPrivacyOptions: () => calls.push('adPrivacyOptions'),
    };
  });
  await page.goto(BASE + '/?debug=1&fakestore=1&screen=map&still=1');
  await page.waitForFunction(() => window.__app && window.__app.store, null, { timeout: 15000 });
  const emit = (event) => page.evaluate((json) => window.__native.store(json), JSON.stringify(event));
  const calls = () => page.evaluate(() => window.__calls.filter((c) => c !== 'storeSave').map((c) => (c.indexOf('iapQuery:') === 0 ? 'iapQuery' : c)));

  check('platform is Android', (await page.evaluate(() => window.__app.ctx.platform.info().platform)) === 'android');
  check('the hooks of platform and store share window.__native', await page.evaluate(() => ['back', 'pause', 'resume', 'store'].every((n) => typeof window.__native[n] === 'function')));
  check('asks for sync, products and a restore at start', JSON.stringify(await calls()) === JSON.stringify(['storeSync', 'iapQuery', 'iapRestore']), await calls());
  const query = await page.evaluate(() => JSON.parse(window.__calls.filter((c) => c.indexOf('iapQuery:') === 0)[0].slice(9)));
  check('the query lists the 7 products with their kinds', query.length === 7 && query[0].id === 'coins_small' && query[0].kind === 'consumable' && query[6].kind === 'entitlement', query);
  check('nothing offered before prices arrive', await page.evaluate(() => !window.__app.store.iapAvailable()));

  await emit({ type: 'products', products: [{ id: 'coins_small', price: '٣٫٩٩ ر.س' }, { id: 'remove_ads', price: '١١٫٩٩ ر.س' }] });
  await emit({ type: 'ads', canRequestAds: true, rewardedReady: true, interstitialReady: true, privacyOptionsRequired: true });
  check('prices are the wrapper’s own strings', (await page.evaluate(() => window.__app.store.products().map((p) => p.info.price).join(' | '))) === '٣٫٩٩ ر.س | ١١٫٩٩ ر.س');
  check('ads available, privacy entry required', await page.evaluate(() => window.__app.store.adsAvailable() && window.__app.store.privacyOptionsRequired()));

  await page.evaluate(() => {
    window.__out = null;
    window.__app.store.buy('coins_small').then((v) => (window.__out = v));
  });
  check('buy goes to the bridge — no TEST STORE overlay, even with ?fakestore=1', (await calls()).slice(-1)[0] === 'iapBuy:coins_small' && (await page.$('[data-testid="fake-store"]')) === null);
  const coins = await page.evaluate(() => window.__app.profile.coins());
  await emit({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'GPA.3312-0000-1111-22222' });
  await page.waitForFunction(() => window.__out !== null);
  check('purchased, +1,000 coins', (await page.evaluate(() => window.__out)) === 'purchased' && (await page.evaluate(() => window.__app.profile.coins())) === coins + 1000);
  const tail = await page.evaluate(() => window.__calls.slice(-2));
  check('saved through the bridge, THEN finished', tail[0] === 'storeSave' && tail[1] === 'iapFinish:GPA.3312-0000-1111-22222:saved', tail);
  await emit({ type: 'purchase', id: 'coins_small', state: 'purchased', token: 'GPA.3312-0000-1111-22222' });
  check('delivered again: finished again, not granted again', (await calls()).slice(-1)[0] === 'iapFinish:GPA.3312-0000-1111-22222:saved' && (await page.evaluate(() => window.__app.profile.coins())) === coins + 1000);

  await emit({ type: 'owned', ids: ['remove_ads'] });
  check('restore: owns remove_ads', await page.evaluate(() => window.__app.store.owns('remove_ads')));
  const garbage = await page.evaluate(() => {
    try {
      for (const junk of ['', '{', 'null', '[]', '{"type":"purchase"}', '{"type":"x"}', undefined, 5, {}]) window.__native.store(junk);
      return 'ok';
    } catch (err) {
      return String(err);
    }
  });
  check('garbage events never throw into the wrapper', garbage === 'ok', garbage);
  check('no page errors', errors.length === 0, errors);

  await browser.close();
  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
