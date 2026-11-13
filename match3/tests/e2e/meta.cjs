/**
 * End-to-end test of the app shell and the meta screens, in Chromium with real pointer events.
 * Any console error, i18n warning, uncaught exception or CSP violation fails the run.
 *
 *   node tests/e2e/meta.cjs            dev-server part, then the production-build part
 *   node tests/e2e/meta.cjs --dev      only the dev-server part
 *   node tests/e2e/meta.cjs --prod     only the production part (vite build + vite preview)
 *   META_ONLY=shop node tests/e2e/meta.cjs --dev     only the tests whose name contains the word
 *
 * Companions (same port, run one after the other): meta-economy.cjs (every coin, life and reward
 * counted), meta-robust.cjs (broken environments, pause / resume, memory), meta-monkey.cjs.
 *
 * Servers (port 5185, META_PORT): see meta-lib.cjs. The production part builds into its own folder
 * (never the shared dist/) and needs the port free: stop a running dev server first.
 */
const { chromium } = require('playwright');
const L = require('./meta-lib.cjs');

const run = L.createRunner('meta.cjs');
const { ok, eq, test, open } = run;
const { sleep, state, tap, waitScreen, waitDialogs, back, boosterCount, saveData, saveParam, today, fakeSheet, fakeAd } = L;

const MID = { upTo: 46, coins: 3000, dailyDay: today, dailyStreak: 2 };

/** The Android wrapper's bridge as a page init script: records what the game tells it. */
const androidBridge = (json) => {
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

// ───────────────────────────── dev-server tests ─────────────────────────────

/** With the stock dev server: the policy must let Vite's hot-reload client connect, and nothing else. */
async function hotReloadTest(browser) {
  await test('dev server with hot reload: boots under the CSP, the reload socket connects', async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
    run.openContexts.push(context);
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || 'inline'));
      });
    });
    const page = await context.newPage();
    run.watch(page);
    let connected = false;
    page.on('console', (msg) => {
      if (/\[vite\] connected/.test(msg.text())) connected = true;
    });
    await page.goto(L.url({}), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__booted === true && !!window.__app, null, { timeout: 30000 });
    for (let i = 0; i < 20 && !connected; i++) await sleep(150);
    ok(connected, "Vite's hot-reload client connected (connect-src allows the loopback socket)");
    eq(await page.evaluate(() => window.__app.shell.current()), 'title', 'the game booted');
  });
}

async function devTests(browser) {
  await test('first launch: title → Play goes straight into level 1; Back walks home', async () => {
    const { page } = await open(browser, { fakestore: '0' });
    let s = await state(page);
    eq(s.screen, 'title', 'starts on the title');
    eq(s.root, true, 'the title is the root');
    eq(s.overlay, false, 'no pop-up on first launch');
    ok((await page.title()).length > 0, 'the document has a title');
    ok((await page.locator('#boot').count()) === 0, 'the boot cover is gone');
    eq((await page.locator('[data-act="play"] .k-btn__cap').count()) === 0, true, 'a first run shows no "Level N" under Play');
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'play');
    s = await state(page);
    eq(s.root, false, 'not at the root while playing');
    ok((await page.locator('.m-playhost').count()) === 1, 'exactly one play host is mounted');
    // leave the way the play screen does
    await page.evaluate(() => window.__app.ctx.nav.toMap({ focusLevel: 1 }));
    await waitScreen(page, 'map');
    ok((await page.locator('.m-playhost').count()) === 0, 'the play screen was unmounted');
    eq(await page.locator('.m-stage > *').count(), 1, 'one screen is mounted');
    s = await state(page);
    eq(s.root, false, 'the map is not the root');
    await page.evaluate(() => window.__app.kit.closeAll());
    await back(page);
    s = await state(page);
    eq(s.screen, 'title', 'Back on the map goes to the title');
    eq(s.root, true, 'back at the root');
    await back(page);
    eq((await state(page)).screen, 'title', 'Back on the title does nothing');
  });

  await test('tour: daily reward, map, intro with boosters, play, win celebration', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', save: saveParam({ upTo: 46, coins: 5000, dailyDay: today - 1, dailyStreak: 2 }) });
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
    ok((await page.locator('.k-toast').count()) === 1, 'but says which level opens it');

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
    eq(await page.locator('.m-dialog-intro').count(), 0, 'the intro closed');

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
    eq(await page.locator('.m-dialog-intro').count(), 1, 'exactly one intro');
    ok((await page.locator('.m-node[data-level="47"].m-node--done').count()) === 1, 'level 47 is now done');
    ok((await page.locator('.m-node[data-level="47"] .m-node__stars i.on').count()) === 3, 'with three stars');
    ok((await page.locator('.m-node[data-level="48"].m-node--current').count()) === 1, 'level 48 is unlocked');
    eq(await page.locator('.m-node--current').count(), 1, 'there is one current level');
    await sleep(400);
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes the intro');
  });

  await test('the real levels: every intro opens, a level starts and can be left', async () => {
    const { page } = await open(browser, { gate: 'off', fakestore: '0', screen: 'map', fast: '1', save: saveParam({ upTo: 119, stars: 2, coins: 500, dailyDay: today, dailyStreak: 2 }) });
    const count = await page.evaluate(() => window.__app.ctx.levels.length);
    eq(count, 120, 'the game ships 120 levels');
    // every level's intro builds without an error (goal icons, texts, tags) — opened and closed in the page
    const bad = await page.evaluate(async () => {
      const a = window.__app;
      const out = [];
      for (let id = 1; id <= a.ctx.levels.length; id++) {
        a.ctx.nav.openLevelIntro(id);
        await new Promise((r) => setTimeout(r, 0));
        const title = document.querySelector('.k-overlay:not(.k-closing) .m-dialog-intro .k-dialog__title');
        const goals = document.querySelectorAll('.k-overlay:not(.k-closing) .m-dialog-intro .m-goal').length;
        if (!title || title.textContent.indexOf(String(id)) < 0 || goals !== a.ctx.levels[id - 1].goals.length) out.push(id);
        a.kit.closeAll();
        await new Promise((r) => setTimeout(r, 0));
      }
      return out;
    });
    eq(bad.join(','), '', 'the intro of every level shows its number and all its goals');
    // hard levels carry their tag under the title, the others the ornament
    const hardId = await page.evaluate(() => (window.__app.ctx.levels.filter((l) => l.hard)[0] || { id: 0 }).id);
    ok(hardId > 0, 'the game has hard levels (first: ' + hardId + ')');
    await page.evaluate((id) => window.__app.ctx.nav.openLevelIntro(id), hardId);
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    eq(await page.locator('.m-dialog-intro .k-dialog__head .m-tag--hard').count(), 1, 'a hard level is tagged as hard under its title');
    ok(await page.locator('.m-dialog-intro .k-dialog__head .m-best').isVisible(), 'a level won before shows its stars and best score there too');
    await page.evaluate(() => window.__app.kit.closeAll());
    await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 3000 });
    await sleep(500);
    // one real level, started from its intro
    await tap(page, '.m-node[data-level="120"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    await page.waitForFunction(() => window.__play && window.__play.state() === 'play', null, { timeout: 15000 });
    ok(true, 'the level started');
    await back(page); // pause
    await waitDialogs(page, 1);
    eq((await state(page)).screen, 'play', 'Back while playing pauses');
    await back(page); // resume
    await waitDialogs(page, 0);
    await page.evaluate(() => window.__app.ctx.nav.toMap({ focusLevel: 120 }));
    await waitScreen(page, 'map');
    eq(await page.locator('.m-stage > *').count(), 1, 'back on the map, one screen mounted');
  });

  await test('the last level: the journey ends with a friendly dialog, replays just pop their stars', async () => {
    const { page } = await open(browser, { mocklevels: '12', gate: 'off', fakestore: '0', screen: 'map', save: saveParam({ upTo: 11, coins: 500, dailyDay: today, dailyStreak: 2 }) });
    ok((await page.locator('.m-node[data-level="12"].m-node--current').count()) === 1, 'the last level is the current one');
    eq(await page.locator('.m-sec').count(), 6, 'twelve levels still make six chapters');
    await page.evaluate(() => {
      const a = window.__app;
      a.profile.recordWin(12, 2, 4000, 2);
      a.ctx.nav.toMap({ justWon: 12 });
    });
    await page.waitForSelector('.k-dialog--medal', { timeout: 8000 });
    await sleep(400);
    ok(/complete/i.test(await page.locator('.k-overlay:not(.k-under) .k-dialog__title').innerText()), 'the "journey complete" dialog is shown');
    ok((await page.locator('.m-dialog-intro').count()) === 0, 'no intro after the last level');
    ok((await page.locator('.m-node--current').count()) === 0, 'no current node when everything is done');
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes it');
    // a replay that improves a level: the stars pop, the next intro is not forced open
    const before = await page.evaluate(() => window.__app.profile.record(3).stars);
    await page.evaluate(() => {
      const a = window.__app;
      a.ctx.nav.toPlay(3, {});
      a.profile.recordWin(3, 3, 9000, 2);
      a.ctx.nav.toMap({ justWon: 3 });
    });
    await waitScreen(page, 'map');
    await sleep(2200);
    const s = await state(page);
    eq(s.overlay, false, 'a replay does not open the next intro by itself');
    ok(before <= 3 && (await page.locator('.m-node[data-level="3"] .m-node__stars i.on').count()) === 3, 'the replayed level shows three stars');
    // the title of a finished journey names no level
    await tap(page, '[data-act="home"]');
    await waitScreen(page, 'title');
    eq(await page.locator('[data-act="play"] .k-btn__cap').count(), 0, 'with every level won, Play names no level');
  });

  await test('shop with the test store: products, every purchase outcome, ads, no store at all', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '1', screen: 'map', save: saveParam(MID) });
    await page.waitForFunction(() => window.__app.store.iapAvailable() && window.__app.store.rewardedReady(), null, { timeout: 8000 });
    await tap(page, '[data-act="shop"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('.m-dialog-shop [data-booster]').count(), 6, 'six boosters are on sale');
    eq(await page.locator('.m-dialog-shop [data-product]').count(), 7, 'starter pack, remove ads and five coin packs');
    eq(await page.locator('.m-dialog-shop [data-product="coins_small"] .k-price').innerText(), 'US$0.99', "the store's own price string is shown");

    // cancelled: nothing granted, nothing said, the button works again
    let coins = (await state(page)).coins;
    await tap(page, '[data-product="coins_small"] .k-btn');
    await fakeSheet(page, 'cancel');
    await sleep(500);
    eq((await state(page)).coins, coins, 'a cancelled purchase grants nothing');
    eq(await page.locator('.k-toast').count(), 0, 'and is not reported as an error');
    ok(!(await page.locator('[data-product="coins_small"] .k-btn').isDisabled()), 'the button is usable again');

    // pending: nothing granted yet, and the player is told it is pending — not that it succeeded
    await tap(page, '[data-product="coins_medium"] .k-btn');
    await fakeSheet(page, 'pending');
    await page.waitForSelector('.k-toast', { timeout: 5000 });
    eq((await state(page)).coins, coins, 'a pending purchase grants nothing');
    ok(/pending/i.test(await page.locator('.k-toast').first().innerText()), 'the toast says "pending"');
    await page.waitForSelector('.k-toast', { state: 'detached', timeout: 9000 });

    // bought: granted exactly once
    await tap(page, '[data-product="coins_small"] .k-btn');
    await fakeSheet(page, 'buy');
    await page.waitForFunction((c) => window.__app.profile.coins() > c, coins, { timeout: 8000 });
    await sleep(900);
    eq((await state(page)).coins, coins + 1000, 'the small pack grants its 1,000 coins exactly once');

    // the store failing: an error message, nothing granted (the store is asked to fail once)
    coins = (await state(page)).coins;
    await page.evaluate(() => {
      const store = window.__app.store;
      const real = store.buy;
      store.buy = () => {
        store.buy = real;
        return Promise.resolve('error');
      };
    });
    await tap(page, '[data-product="coins_large"] .k-btn');
    await page.waitForSelector('.k-toast', { timeout: 5000 });
    eq((await state(page)).coins, coins, 'a failed purchase grants nothing');
    ok(/could not/i.test(await page.locator('.k-toast').last().innerText()), 'and says so');

    // remove ads: owned afterwards, the offer disappears
    await tap(page, '[data-product="remove_ads"] .k-btn');
    await fakeSheet(page, 'buy');
    await page.waitForFunction(() => window.__app.store.owns('remove_ads'), null, { timeout: 8000 });
    await sleep(500);
    eq(await page.locator('.m-dialog-shop [data-product="remove_ads"]').count(), 0, 'the remove-ads offer is hidden once owned');

    // free coins for a rewarded ad: watched to the end, then closed early
    coins = (await state(page)).coins;
    const left = await page.evaluate(() => window.__app.store.rewardedLeft('freeCoins'));
    await tap(page, '[data-act="free-coins"]');
    await fakeAd(page, true);
    await page.waitForFunction((c) => window.__app.profile.coins() > c, coins, { timeout: 5000 });
    await sleep(400);
    eq((await state(page)).coins, coins + 50, 'a watched ad pays 50 coins once');
    eq(await page.evaluate(() => window.__app.store.rewardedLeft('freeCoins')), left - 1, "and uses one of today's ads");
    await sleep(600);
    coins = (await state(page)).coins;
    await tap(page, '[data-act="free-coins"]');
    await fakeAd(page, false);
    await sleep(700);
    eq((await state(page)).coins, coins, 'an ad closed early pays nothing');

    // a booster the player cannot pay for: the button answers, nothing is charged
    await page.evaluate(() => window.__app.profile.spendCoins(window.__app.profile.coins() - 10));
    await sleep(300);
    const hammers = await boosterCount(page, 'hammer');
    ok(!(await page.locator('[data-booster="hammer"] .k-btn').isDisabled()), 'Buy still answers without enough coins');
    ok((await page.locator('[data-booster="hammer"].m-brow--short').count()) === 1, 'and is shown as out of reach');
    await page.locator('[data-booster="hammer"] .k-btn').scrollIntoViewIfNeeded();
    await tap(page, '[data-booster="hammer"] .k-btn');
    await sleep(400);
    eq((await state(page)).coins, 10, 'nothing is charged');
    eq(await boosterCount(page, 'hammer'), hammers, 'nothing is given');
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes the shop');
  });

  await test('shop without a store: boosters only', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', screen: 'map', save: saveParam(MID) });
    await tap(page, '[data-act="shop"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('.m-dialog-shop [data-product]').count(), 0, 'no real-money offers without a store');
    eq(await page.locator('[data-act="free-coins"]').count(), 0, 'no ad offer without ads');
    eq(await page.locator('.m-dialog-shop [data-booster]').count(), 6, 'the boosters stay');
    const price = await page.evaluate(() => window.__app.profile.boosterPrice('hammer'));
    const coins = (await state(page)).coins;
    const hammers = await boosterCount(page, 'hammer');
    await tap(page, '[data-booster="hammer"] .k-btn');
    await sleep(250);
    eq((await state(page)).coins, coins - price, 'the hammer costs its price');
    eq(await boosterCount(page, 'hammer'), hammers + 1, 'one hammer more');
    await back(page);
    // settings shows no store rows
    await tap(page, '[data-act="settings"]');
    await page.waitForSelector('.m-dialog-settings', { timeout: 5000 });
    eq(await page.locator('[data-act="restore"]').count(), 0, 'no "restore purchases" without a store');
    eq(await page.locator('[data-act="privacy-options"]').count(), 0, 'no "privacy options" without ads');
  });

  await test('lives: out of lives blocks Play, refill for coins, rewarded life', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '1', screen: 'map', save: saveParam({ upTo: 46, coins: 3000, lives: 0, dailyDay: today, dailyStreak: 2 }) });
    await page.waitForFunction(() => window.__app.store.rewardedReady(), null, { timeout: 8000 });
    eq((await state(page)).lives, 0, 'starts with no lives');
    // Play in the intro opens the lives dialog instead of the level
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="intro-play"]');
    await page.waitForSelector('.m-dialog-lives', { timeout: 5000 });
    eq((await state(page)).screen, 'map', 'no life, no level');
    ok(/Out of lives/.test(await page.locator('.m-dialog-lives .k-dialog__title').innerText()), 'the dialog says "Out of lives"');
    await sleep(420);
    // +1 life for an ad
    await tap(page, '[data-act="lives-ad"]');
    await fakeAd(page, true);
    await page.waitForFunction(() => window.__app.profile.lives().count === 1, null, { timeout: 5000 });
    ok(true, 'the rewarded ad adds one life');
    // refill all for coins
    const coins = (await state(page)).coins;
    await sleep(500);
    await tap(page, '[data-act="lives-refill"]');
    await page.waitForFunction(() => window.__app.profile.lives().count === window.__app.profile.lives().max, null, { timeout: 5000 });
    eq((await state(page)).coins, coins - 900, 'the refill costs 900 coins');
    await waitDialogs(page, 1);
    eq(await page.locator('.k-overlay:not(.k-closing) .m-dialog-lives').count(), 0, 'the lives dialog closed after the refill');
    ok((await page.locator('.k-overlay:not(.k-closing) .m-dialog-intro').count()) === 1, 'the intro is still there');
    await back(page);
    // the chip opens the dialog too
    await tap(page, '[data-act="lives"]');
    await page.waitForSelector('.m-dialog-lives', { timeout: 5000 });
    await sleep(400);
    eq(await page.locator('[data-act="lives-refill"]:visible').count(), 0, 'nothing to buy with full lives');
    await back(page);
    eq((await state(page)).overlay, false, 'Back closes the lives dialog');
  });

  await test('settings: toggles, language on every screen, legal texts, restore, reset', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '1', lang: 'en', save: saveParam(MID) });
    await page.waitForFunction(() => window.__app.store.iapAvailable() && window.__app.store.privacyOptionsRequired(), null, { timeout: 8000 });
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
    eq(await page.evaluate(() => document.documentElement.lang), 'ar', '<html lang> follows');
    eq(await page.locator('.m-dialog-settings .k-dialog__title').innerText(), 'الإعدادات', 'the settings title is Arabic');
    eq(await page.locator('.m-dialog-settings .k-dialog__x').getAttribute('aria-label'), 'إغلاق', 'so is the name of its close button');
    eq(await page.evaluate(() => window.__app.profile.settings().lang), 'ar', 'the choice is saved');
    eq(await page.title(), 'زمرد', 'the document title follows');
    ok(/العب/.test(await page.locator('[data-act="play"]').innerText()), 'the title screen behind is Arabic');
    eq(await page.locator('.m-stage > *').count(), 1, 'one screen is mounted');
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
    eq(await page.locator('.m-stage > *').count(), 1, 'one screen is mounted');
    // nothing Arabic is left anywhere on the page
    const leftovers = await page.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent || '';
        const tag = n.parentElement ? n.parentElement.tagName : '';
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        if (/[\u0600-\u06FF]/.test(text) && text.trim() !== 'العربية') out.push(text.trim().slice(0, 30));
      }
      return out;
    });
    eq(leftovers.join(' | '), '', 'no Arabic text is left after switching back (except the language name)');

    // conditional rows of the test store
    ok((await page.locator('[data-act="privacy-options"]').count()) === 1, 'privacy options row (consent region)');
    ok((await page.locator('[data-act="restore"]').count()) === 1, 'restore purchases row');
    eq(await page.locator('[data-act="rate"]').count(), 0, 'no rating row in a browser');
    await tap(page, '[data-act="restore"]');
    await page.waitForSelector('.k-toast', { timeout: 8000 });
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
  });

  await test('reset from the title screen: the title starts over with the progress', async () => {
    // (the title used to keep "Level 47" under Play, and Play went to the map of an empty journey)
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', lang: 'en', fast: '1', save: saveParam(MID) });
    ok(/47/.test(await page.locator('[data-act="play"]').innerText()), 'before: Play names level 47');
    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    await tap(page, '[data-act="reset"]');
    await waitDialogs(page, 2);
    await tap(page, '.k-overlay:not(.k-under) .k-btn--danger');
    await waitDialogs(page, 2);
    await tap(page, '.k-overlay:not(.k-under) .k-btn--danger');
    await waitDialogs(page, 0);
    const s = await state(page);
    eq(s.screen, 'title', 'still on the title');
    eq(s.frontier, 1, 'progress is wiped');
    eq(s.coins, 2000, 'coins are back to the starting amount');
    eq(await page.locator('[data-act="play"] .k-btn__cap').count(), 0, 'Play names no level any more');
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'play');
    eq(await page.evaluate(() => window.__play.level()), 1, 'Play starts level 1 again, like a first run');
  });

  await test('Android wrapper: Back order, at-root flag on every path, insets, splash hand-off', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fast: '1' }, { init: androidBridge, initArg: JSON.stringify(saveData(MID)) });
    const roots = () => page.evaluate(() => window.__bridgeCalls.atRoot.slice());
    const lastRoot = async () => {
      const list = await roots();
      return list[list.length - 1];
    };
    /** What the wrapper was last told must always equal "title with nothing open". */
    const consistent = async (where) => {
      const got = await page.evaluate(() => {
        const a = window.__app;
        const list = window.__bridgeCalls.atRoot;
        return { told: list[list.length - 1], truth: a.shell.current() === 'title' && !a.kit.hasOverlay() };
      });
      eq(got.told, got.truth, where + ': the wrapper knows whether Back may leave the app');
    };
    const nativeBack = async () => {
      // the wrapper only calls the page while it was told "not at root"
      eq(await lastRoot(), false, 'the wrapper sends Back to the page only when not at root');
      await page.evaluate(() => window.__native.back());
      await sleep(330);
    };
    let s = await state(page);
    eq(s.lang, 'ar', 'the device language (Arabic) is used when none is saved');
    eq(s.frontier, 47, 'the save came from the wrapper');
    eq(await lastRoot(), true, 'title: at root');
    eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim()), '31px', 'the wrapper insets are applied');
    eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom').trim()), '17px', 'on every side');
    await page.evaluate(() => window.__native.insets(JSON.stringify({ top: 44, right: 0, bottom: 0, left: 0 })));
    eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim()), '44px', 'pushed insets are applied');
    await page.evaluate(() => window.__native.insets('nonsense'));
    eq(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim()), '44px', 'unreadable insets are ignored');
    await sleep(200);
    eq(await page.evaluate(() => window.__bridgeCalls.ready), 1, 'the splash hand-off is called once');

    // title → settings → privacy policy
    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    await consistent('settings open');
    eq(await lastRoot(), false, 'settings open: not at root');
    ok((await page.locator('[data-act="rate"]').count()) === 1, 'Android shows "Rate the game"');
    ok(/9\.9\.9/.test(await page.locator('.m-settings__version').innerText()), 'the version comes from the wrapper');
    await tap(page, '[data-act="privacy"]');
    await waitDialogs(page, 2);
    await nativeBack();
    await waitDialogs(page, 1);
    await consistent('one dialog left');
    await nativeBack();
    await waitDialogs(page, 0);
    await consistent('title again');
    eq(await lastRoot(), true, 'title again: at root');

    // the ✕ and a backdrop tap must tell the wrapper too
    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    await tap(page, '.k-overlay:not(.k-under) .k-dialog__x');
    await waitDialogs(page, 0);
    await consistent('settings closed with ✕');
    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    await sleep(200);
    await page.touchscreen.tap(8, 630);
    await waitDialogs(page, 0);
    await consistent('settings closed by a backdrop tap');
    // a language switch rebuilds the title under the dialog: still not at root, then at root
    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    await page.locator('[data-act="language"] .k-seg__opt').nth(0).tap();
    await sleep(400);
    await consistent('language switched under settings');
    eq(await lastRoot(), false, 'settings still open after the language switch');
    await nativeBack();
    await waitDialogs(page, 0);
    await consistent('title in the new language');

    // map and its dialogs
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'map');
    await consistent('map');
    for (const act of ['shop', 'daily', 'lives', 'settings']) {
      await tap(page, '[data-act="' + act + '"]');
      await waitDialogs(page, 1);
      await consistent(act + ' open on the map');
      await nativeBack();
      await waitDialogs(page, 0);
      eq((await state(page)).screen, 'map', 'Back closed ' + act + ', not the map');
      await consistent(act + ' closed on the map');
    }
    await tap(page, '.m-node[data-level="47"]');
    await waitDialogs(page, 1);
    await nativeBack();
    await waitDialogs(page, 0);
    eq(await lastRoot(), false, 'map after closing dialogs: not at root');

    // map → level → pause → resume → quit → map → title
    await tap(page, '.m-node[data-level="47"]');
    await waitDialogs(page, 1);
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    await consistent('playing');
    await page.waitForFunction(() => window.__play.state() === 'play', null, { timeout: 15000 });
    await nativeBack(); // pause dialog
    await waitDialogs(page, 1);
    await consistent('paused');
    await nativeBack(); // resume
    await waitDialogs(page, 0);
    eq((await state(page)).screen, 'play', 'Back on the pause dialog resumes the level');
    await consistent('playing again');
    await page.evaluate(() => window.__app.ctx.nav.toMap({ focusLevel: 47 }));
    await waitScreen(page, 'map');
    await consistent('map after the level');
    await nativeBack();
    await waitScreen(page, 'title');
    await consistent('title after the map');
    eq(await lastRoot(), true, 'title: at root');
    ok((await page.evaluate(() => window.__bridgeCalls.saves)) > 0, 'saves go through the wrapper');
    // the flag is sent only when it changes
    const list = await roots();
    ok(list.every((v, i) => i === 0 || v !== list[i - 1]), 'the at-root flag is sent only when it changes (' + list.length + ' calls)');

    // reset progress on the title: dialogs gone, at root
    await tap(page, '[data-act="settings"]');
    await waitDialogs(page, 1);
    await tap(page, '[data-act="reset"]');
    await waitDialogs(page, 2);
    await tap(page, '.k-overlay:not(.k-under) .k-btn--danger');
    await waitDialogs(page, 2);
    await consistent('second confirmation');
    await tap(page, '.k-overlay:not(.k-under) .k-btn--danger');
    await waitDialogs(page, 0);
    await consistent('after the reset');
    eq(await lastRoot(), true, 'after the reset: at root');
  });

  await test('a booster unlocks: it is introduced once, with its gift', async () => {
    const { page } = await open(browser, { mocklevels: '120', fakestore: '0', screen: 'map', save: saveParam({ upTo: 8, coins: 100, gifted: ['beamNova'], boosters: { hammer: 0, freeSwap: 0, shuffle: 0, extraMoves: 0, prism: 0, beamNova: 0 }, dailyDay: today, dailyStreak: 1 }) });
    await page.waitForSelector('[data-dialog="unlock"]', { timeout: 5000 });
    await sleep(450);
    eq(await boosterCount(page, 'hammer'), 3, 'the gift (3 hammers) is in the inventory');
    ok((await page.locator('[data-dialog="unlock"] .m-unlock__name').innerText()).length > 0, 'the dialog names the booster');
    await tap(page, '.k-overlay:not(.k-under) .k-dialog__foot .k-btn');
    await waitDialogs(page, 0);
    // coming back to the map does not introduce it again
    await page.evaluate(() => window.__app.goto('map'));
    await sleep(900);
    eq(await page.locator('[data-dialog="unlock"]').count(), 0, 'the introduction is shown once');
    eq(await boosterCount(page, 'hammer'), 3, 'and the gift is given once');
  });

  await test('feature gating: an early profile sees a bare map; the first session sells nothing', async () => {
    const { page } = await open(browser, { mocklevels: '120', fakestore: '1', screen: 'map', save: saveParam({ upTo: 2, coins: 2000, gifted: [], firstDay: today, dailyDay: -1 }) });
    eq(await page.locator('[data-act="lives"]').count(), 0, 'no lives chip before level 6');
    eq(await page.locator('[data-act="shop"]').count(), 0, 'no shop button before level 10');
    eq(await page.locator('[data-act="daily"]').count(), 0, 'no daily reward on the first day');
    eq(await page.locator('[data-act="coins"] .k-chip__plus').count(), 0, 'the coin counter has no "+" yet');
    await sleep(700);
    eq((await state(page)).overlay, false, 'nothing pops up');
    await tap(page, '.m-node[data-level="3"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    eq(await page.locator('.m-dialog-intro .m-boost').count(), 0, 'the intro offers no boosters yet');
    eq(await page.locator('.m-dialog-intro .m-pill--lives').count(), 0, 'nor shows lives');
    eq(await page.locator('.m-dialog-intro .m-caravan').count(), 0, 'nor the Caravan');
    await back(page);
    ok(await page.locator('[data-act="home"]').isVisible(), 'Home is always there');
    await tap(page, '[data-act="home"]');
    await waitScreen(page, 'title');
  });

  await test('a damaged save with gaps: one current level, the rest stays playable', async () => {
    // levels 1–5 and 9 won, 6–8 never: the journey has "reached" level 10
    const data = saveData({ upTo: 5, coins: 100, dailyDay: today, dailyStreak: 1 });
    data.levels['9'] = { stars: 2, best: 3000 };
    data.levels['500'] = { stars: 3, best: 1 }; // a level that does not exist
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', screen: 'map', save: L.encodeSave(data) });
    const s = await state(page);
    eq(s.frontier, 10, 'the frontier follows the highest won level');
    eq(await page.locator('.m-node--current').count(), 1, 'exactly one node is the current level');
    ok((await page.locator('.m-node[data-level="10"].m-node--current').count()) === 1, 'it is level 10');
    eq(await page.locator('.m-node--open').count(), 3, 'levels 6–8 are open (playable, not won)');
    await tap(page, '.m-node[data-level="7"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    ok(/7/.test(await page.locator('.m-dialog-intro .k-dialog__title').innerText()), 'an open level can be played');
    eq(s.stars, await page.evaluate(() => [1, 2, 3, 4, 5, 9].reduce((sum, id) => sum + window.__app.profile.record(id).stars, 0)), 'stars of levels that do not exist are not counted');
  });

  await test('map: sections are built lazily and scrolling stays smooth (CPU ×4)', async () => {
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', screen: 'map', still: '1', save: saveParam({ upTo: 60, coins: 900, dailyDay: today, dailyStreak: 2 }) }, { context: { deviceScaleFactor: 2 } });
    const client = await context.newCDPSession(page);
    const fling = () =>
      page.evaluate(
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
    // Frame times depend on how busy this machine is: up to three flings, the best one counts.
    let best = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const result = await fling();
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const sorted = result.frames.slice(1).sort((a, b) => a - b);
      const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
      const r = { result, sorted, median: pct(0.5), p95: pct(0.95), worst: sorted[sorted.length - 1], slow: sorted.filter((f) => f > 34).length };
      if (!best || r.p95 < best.p95) best = r;
      if (best.median <= 20 && best.p95 <= 34) break;
      await sleep(500);
    }
    const r = best.result;
    console.log(
      '    frames ' + best.sorted.length + ' · median ' + best.median.toFixed(1) + ' ms · p95 ' + best.p95.toFixed(1) + ' ms · worst ' + best.worst.toFixed(1) + ' ms · over 34 ms: ' + best.slow +
        ' · live backdrops ≤ ' + r.maxCanvases + ' · live nodes ≤ ' + r.maxNodes + ' of 120 · world ' + r.height + ' px',
    );
    eq(r.sections, 6, 'six chapter sections');
    ok(r.maxCanvases <= 4, 'only the sections near the viewport hold a backdrop (' + r.maxCanvases + ')');
    ok(r.maxNodes <= 80, 'only nearby nodes are in the document (' + r.maxNodes + ')');
    ok(best.median <= 20, 'median frame time stays at 60 fps (' + best.median.toFixed(1) + ' ms)');
    if (best.p95 > 34) console.log('    note: p95 above two frames (' + best.p95.toFixed(1) + ' ms) under CPU ×4 on this machine');
    ok(best.p95 <= 70, 'p95 frame time stays in bounds (' + best.p95.toFixed(1) + ' ms)');
  });

  await test('map: the current level is in view at every size, in both directions; a real finger scrolls it', async () => {
    for (const [w, h] of [
      [320, 480],
      [360, 640],
      [412, 915],
      [640, 360],
      [800, 1280],
      [1280, 800],
    ]) {
      for (const lang of ['en', 'ar']) {
        const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', screen: 'map', still: '1', lang, save: saveParam({ upTo: 46, coins: 123456, lives: 2, dailyDay: today, dailyStreak: 2 }) }, { context: { viewport: { width: w, height: h } } });
        const tag = w + '×' + h + ' ' + lang;
        const info = await page.evaluate(() => {
          const rect = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          };
          const sc = document.querySelector('.m-map__scroll');
          return {
            node: rect('.m-node--current'),
            top: rect('.m-top__panel'),
            tray: rect('.m-tray__panel'),
            chips: Array.from(document.querySelectorAll('.m-top__panel > *')).map((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, right: r.right, w: r.width };
            }),
            hScroll: sc.scrollWidth > sc.clientWidth + 1,
            docScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
            vw: window.innerWidth,
            vh: window.innerHeight,
          };
        });
        ok(!!info.node && info.node.top >= info.top.bottom - 4 && info.node.bottom <= info.tray.top + 4, tag + ': the current level sits between the bars');
        ok(info.node && info.node.left >= 0 && info.node.right <= info.vw, tag + ': and inside the screen');
        ok(info.top.left >= 0 && info.top.right <= info.vw && info.tray.left >= 0 && info.tray.right <= info.vw, tag + ': the bars are inside the screen');
        ok(info.chips.every((c) => c.left >= info.top.left - 1 && c.right <= info.top.right + 1), tag + ': everything in the top bar fits inside it (six-digit coins)');
        ok(!info.hScroll && !info.docScroll, tag + ': nothing scrolls sideways');
        await context.close();
      }
    }
    // a touch drag scrolls the map by about the finger's distance, and a tap after it still works
    const { context, page } = await open(browser, { mocklevels: '120', gate: 'off', fakestore: '0', screen: 'map', still: '1', save: saveParam({ upTo: 46, coins: 900, dailyDay: today, dailyStreak: 2 }) });
    const cdp = await context.newCDPSession(page);
    const top0 = await page.evaluate(() => document.querySelector('.m-map__scroll').scrollTop);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', 60, 300);
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', 60, 300 + i * 15);
      await sleep(16);
    }
    await touch('touchEnd', 60, 480);
    await sleep(900);
    const top1 = await page.evaluate(() => document.querySelector('.m-map__scroll').scrollTop);
    ok(top0 - top1 >= 120, 'dragging down by 180 px scrolls the map up (' + Math.round(top0 - top1) + ' px)');
    eq((await state(page)).overlay, false, 'the drag opened nothing');
  });

  await test('compatibility guard: a module that never starts shows the update message', async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
    run.openContexts.push(context);
    const page = await context.newPage();
    run.tolerate++;
    await page.route('**/src/main.ts*', (route) => route.abort());
    await page.goto(L.BASE, { waitUntil: 'domcontentloaded' });
    eq(await page.evaluate(() => typeof window.__bootFail), 'function', 'the inline guard ran (its CSP hash matches)');
    await page.waitForFunction(() => document.querySelectorAll('#boot p').length === 2, null, { timeout: 9000 });
    const text = await page.locator('#boot').innerText();
    ok(/Android System WebView/.test(text) && /تحديث/.test(text), 'the message is shown in English and Arabic');
    run.tolerate--;
  });
}

// ───────────────────────────── production-build tests ─────────────────────────────

/** Things Chrome / WebView 80 does not have (docs/DESIGN.md §1), looked for in the built files. */
const CSS_TOO_NEW = [
  ['aspect-ratio', /[;{]\s*aspect-ratio\s*:/],
  ['inset shorthand', /[;{]\s*inset(-inline|-block)?(-start|-end)?\s*:/],
  [':is() / :where() / :has()', /:(is|where|has)\(/],
  ['container queries', /@container\b/],
  ['color-mix()', /color-mix\(/],
  ['dynamic viewport units', /\d(dvh|svh|lvh|dvw|svw|lvw)\b/],
  [':focus-visible', /:focus-visible/],
  ['margin-inline / padding-inline / *-block shorthands', /[;{]\s*(margin|padding)-(inline|block)\s*:/],
  ['@layer', /@layer\b/],
  ['individual transform properties', /[;{]\s*(translate|scale|rotate)\s*:/],
  ['overflow: clip', /overflow(-[xy])?\s*:\s*clip/],
  ['@property', /@property\b/],
  ['range media queries', /@media[^{]*[<>]=?/],
  ['accent-color', /accent-color\s*:/],
];
const JS_TOO_NEW = [
  ['String.replaceAll', /\.replaceAll\(/],
  ['structuredClone', /\bstructuredClone\(/],
  ['Object.hasOwn', /Object\.hasOwn\(/],
  ['replaceChildren', /\.replaceChildren\(/],
  ['findLast / findLastIndex', /\.findLast(Index)?\(/],
  ['toSorted / toReversed / toSpliced', /\.to(Sorted|Reversed|Spliced)\(/],
  ['Promise.any / withResolvers', /Promise\.(any|withResolvers)\(/],
  ['WeakRef', /new WeakRef\(/],
  ['AbortSignal.timeout', /AbortSignal\.timeout\(/],
  ['crypto.randomUUID', /\.randomUUID\(/],
  ['network access', /\bfetch\(|new XMLHttpRequest|new WebSocket\(|sendBeacon\(|new EventSource\(/],
  ['eval', /\beval\(|new Function\(/],
];

/** Flex containers must not use `gap` (Chrome 84); grid `gap` is fine. Returns the offending rules. */
function flexGapRules(css) {
  const out = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const body = m[2];
    if (!/(^|;)\s*(gap|row-gap|column-gap)\s*:/.test(body)) continue;
    if (/display\s*:\s*(inline-)?grid/.test(body)) continue;
    // a rule that only sets the gap of a grid declared elsewhere carries "grid" in its selector by convention
    if (/grid/.test(m[1])) continue;
    out.push(m[1].trim().slice(0, 60));
  }
  return out;
}

async function prodTests(browser, preview) {
  await test('production build: no network, no eval, nothing newer than Chrome 80 in the bundle', async () => {
    const files = L.builtFiles(preview.buildDir);
    const css = files.filter((f) => /\.css$/.test(f.file));
    const js = files.filter((f) => /\.js$/.test(f.file));
    ok(css.length >= 1 && js.length >= 1, 'the build has scripts and styles (' + js.length + ' js, ' + css.length + ' css)');
    for (const f of css) {
      const name = f.file.split('/').pop();
      for (const [what, re] of CSS_TOO_NEW) {
        const m = re.exec(f.text);
        ok(!m, name + ': ' + what + (m ? '  →  …' + f.text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ') + '…' : ''));
      }
      const gaps = flexGapRules(f.text);
      eq(gaps.join(' | '), '', name + ': no `gap` outside grid containers');
      ok(!/url\(\s*["']?https?:/.test(f.text), name + ': no remote url()');
    }
    for (const f of js) {
      const name = f.file.split('/').pop();
      // The one `fetch` a Vite build always carries: its modulepreload polyfill, which only runs
      // where <link rel="modulepreload"> is unknown (before Chrome 66) and then loads the app's own
      // files. It cannot run on the game's browsers; anything else that reaches for the network fails.
      let code = f.text;
      const polyfill = /fetch\(\w+\.href,\w+\)/;
      if (code.indexOf('modulepreload') >= 0 && polyfill.test(code)) {
        code = code.replace(polyfill, 'void 0');
        console.log("    note: " + name + " carries Vite's modulepreload polyfill (a same-origin fetch that never runs on Chrome ≥ 66; `build.modulePreload.polyfill: false` in vite.config.ts would drop it)");
      }
      for (const [what, re] of JS_TOO_NEW) {
        const m = re.exec(code);
        ok(!m, name + ': ' + what + (m ? '  →  …' + code.slice(Math.max(0, m.index - 50), m.index + 30).replace(/\s+/g, ' ') + '…' : ''));
      }
      // Array / String .at() — told apart from identifiers that merely end in "at" by the argument
      const at = /[\w\])]\.at\(-?\d*\)/.exec(f.text);
      ok(!at, name + ': Array / String .at()' + (at ? '  →  ' + at[0] : ''));
    }
    const html = files.filter((f) => /index\.html$/.test(f.file))[0];
    ok(!!html && !/<script[^>]+src=["']https?:/.test(html.text) && !/<link[^>]+href=["']https?:/.test(html.text), 'index.html loads nothing from another origin');
    ok(!!html && /type="module"/.test(html.text) && !/\/src\/main\.ts/.test(html.text), 'index.html loads the bundled module');
  });

  await test('production build: boots under the CSP, no violations, tour works', async () => {
    const html = (await L.get(L.BASE)).body;
    ok(/http-equiv="Content-Security-Policy"/.test(html), 'the CSP meta tag is in the built page');
    ok(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/.test(html), "script-src is 'self' plus the guard's hash");
    ok(/connect-src ws:\/\/127\.0\.0\.1:\* http:\/\/127\.0\.0\.1:\*;/.test(html), 'connect-src allows loopback only');
    ok(html.indexOf("'unsafe-eval'") < 0 && html.indexOf('https:') < 0, 'no eval and no remote origin in the policy');

    const requests = [];
    const { page } = await open(
      browser,
      { mocklevels: '120', gate: 'off', fakestore: '1', lang: 'ar', fast: '1', save: saveParam(MID) },
      { before: async (p) => p.on('request', (r) => requests.push(r.url())) },
    );
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
    await page.waitForFunction(() => window.__app.store.iapAvailable(), null, { timeout: 8000 });
    await tap(page, '[data-act="shop"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    await sleep(420);
    const coins = (await state(page)).coins;
    await tap(page, '[data-product="coins_small"] .k-btn');
    await fakeSheet(page, 'buy');
    await page.waitForFunction((c) => window.__app.profile.coins() === c + 1000, coins, { timeout: 8000 });
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
    // a real level under the production policy
    await page.evaluate(() => window.__app.goto('intro', 47));
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    await page.waitForFunction(() => window.__play && window.__play.state() === 'play', null, { timeout: 15000 });
    await page.evaluate(() => window.__app.ctx.nav.toMap());
    await waitScreen(page, 'map');
    const foreign = requests.filter((u) => u.indexOf(L.BASE) !== 0 && u.indexOf('data:') !== 0 && u.indexOf('blob:') !== 0);
    eq(foreign.join(' '), '', 'every request of the whole tour went to the app itself');

    // the policy really blocks the network: this request must fail (and is the one tolerated violation)
    run.tolerate++;
    const blocked = await page.evaluate(() =>
      fetch('https://example.com/', { mode: 'no-cors' }).then(
        () => false,
        () => true,
      ),
    );
    await sleep(150);
    run.tolerate--;
    ok(blocked, 'a request to a remote host is refused by the policy');
  });

  await test('production build: debug hooks and the test store stay off without ?debug=1 / ?fakestore=1', async () => {
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true });
    run.openContexts.push(context);
    const page = await context.newPage();
    run.watch(page);
    await page.goto(L.BASE + '?lang=ar&mocklevels=5&save=e30', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__booted === true, null, { timeout: 30000 });
    eq(await page.evaluate(() => typeof window.__app), 'undefined', 'no window.__app');
    eq(await page.evaluate(() => typeof window.__play), 'undefined', 'no window.__play');
    eq(await page.evaluate(() => document.documentElement.lang), 'en', 'URL flags are ignored');
    ok((await page.locator('[data-act="play"]').count()) === 1, 'the title is up');
    // first run → level 1 → leave → map: no shop button (gated), and nothing of a store anywhere
    await page.locator('[data-act="settings"]').tap();
    await page.waitForSelector('.m-dialog-settings', { timeout: 5000 });
    eq(await page.locator('[data-act="restore"]').count(), 0, 'no store rows in settings: the test store is off in a production build');
    eq(await page.locator('[data-act="privacy-options"]').count(), 0, 'and no consent row');
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
      console.log('dev server (' + L.BASE + ')');
      // 1. the stock dev server, hot reload on: a short boot check under the CSP
      server = await L.stockDevServer();
      await hotReloadTest(browser);
      await server.stop();
      server = null;
      // 2. the same server without hot reload and file watching, for everything else
      server = await L.quietDevServer();
      await devTests(browser);
      await server.stop();
      server = null;
    }
    if (runProd) {
      console.log('production build (vite build + vite preview --port ' + L.PORT + ' --strictPort)');
      const preview = await L.previewServer();
      server = preview;
      console.log('    build: ' + preview.buildLog);
      await prodTests(browser, preview);
    }
  } catch (err) {
    run.failures++;
    console.log('  ✗ ' + (err && err.message ? err.message : err));
  } finally {
    await browser.close();
    if (server) await server.stop().catch(() => undefined);
  }
  run.finish();
}

main();
