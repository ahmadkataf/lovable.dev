/**
 * Economy flows of the meta screens, counted to the coin (docs/DESIGN.md §5 and §7), on the REAL
 * levels, the real profile and the test store of src/monetize — plus everything that depends on
 * the clock (lives coming back, the daily reward across midnight), driven with a fake clock.
 *
 *   node tests/e2e/meta-economy.cjs
 *   META_ONLY=daily node tests/e2e/meta-economy.cjs
 *
 * Every flow states the exact numbers before and after. Any console error, uncaught exception or
 * CSP violation fails the run. Port 5185 (see meta-lib.cjs).
 */
const { chromium } = require('playwright');
const L = require('./meta-lib.cjs');

const run = L.createRunner('meta-economy.cjs');
const { ok, eq, test, open } = run;
const { sleep, state, tap, waitScreen, waitDialogs, back, boosterCount, saveData, saveParam, today, fakeSheet, fakeAd, DAY } = L;

const PRICES = { hammer: 650, freeSwap: 600, shuffle: 400, extraMoves: 500, prism: 800, beamNova: 650 };
const NO_BOOSTERS = { hammer: 0, freeSwap: 0, shuffle: 0, extraMoves: 0, prism: 0, beamNova: 0 };

const inventory = (page) => page.evaluate(() => Object.assign({}, window.__app.profile.data().boosters));
const coinsOf = (page) => page.evaluate(() => window.__app.profile.coins());
const toastTexts = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.k-toast:not(.k-out) .k-toast__text')).map((n) => n.textContent));
const waitStore = (page) => page.waitForFunction(() => window.__app.store.iapAvailable() && window.__app.store.rewardedReady(), null, { timeout: 8000 });
const openShop = async (page) => {
  await tap(page, '[data-act="shop"]');
  await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
  await sleep(420);
};
/** Two taps on the same spot, as fast as a finger can. */
const doubleTap = async (page, selector) => {
  const box = await page.locator(selector).first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
};

/** A fixed instant for the clock tests: 10 March 2026, 09:00 local time. */
const T0 = new Date(2026, 2, 10, 9, 0, 0).getTime();
const dayOf = (ms) => L.dayNumber(ms);
const nextMidnight = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

async function tests(browser) {
  await test('shop boosters: each costs exactly its price; a price out of reach charges nothing', async () => {
    const total = Object.keys(PRICES).reduce((sum, id) => sum + PRICES[id], 0); // 3,600
    const { page } = await open(browser, { fakestore: '0', screen: 'map', save: saveParam({ upTo: 46, coins: total + 399, boosters: NO_BOOSTERS, dailyDay: today, dailyStreak: 2 }) });
    await openShop(page);
    let expected = total + 399;
    for (const id of ['hammer', 'freeSwap', 'shuffle', 'beamNova', 'prism', 'extraMoves']) {
      eq(await page.locator('[data-booster="' + id + '"] .k-price').innerText(), String(PRICES[id]), id + ': the shop shows the price ' + PRICES[id]);
      await page.locator('[data-booster="' + id + '"] .k-btn').scrollIntoViewIfNeeded();
      await tap(page, '[data-booster="' + id + '"] .k-btn');
      await sleep(420);
      expected -= PRICES[id];
      eq(await coinsOf(page), expected, id + ': coins after buying');
      eq(await boosterCount(page, id), 1, id + ': one in the inventory');
      eq((await page.locator('[data-booster="' + id + '"] .k-qty').innerText()).replace(/[^\d]/g, ''), '1', id + ': the card shows ×1');
    }
    eq(expected, 399, 'six boosters cost 3,600 coins in all');
    eq(await page.locator('.m-dialog-shop .m-shop__balance .k-chip__text').innerText(), '399', 'the balance in the shop shows 399');
    eq(await page.locator('.m-brow--short').count(), 6, 'with 399 coins every booster is out of reach');
    await sleep(1800); // let the "bought" toasts leave
    const before = await inventory(page);
    for (const id of ['shuffle', 'hammer']) {
      await page.locator('[data-booster="' + id + '"] .k-btn').scrollIntoViewIfNeeded();
      await tap(page, '[data-booster="' + id + '"] .k-btn');
      await sleep(450);
    }
    eq(await coinsOf(page), 399, 'pressing Buy without enough coins charges nothing');
    eq(JSON.stringify(await inventory(page)), JSON.stringify(before), 'and gives nothing');
    ok((await toastTexts(page)).indexOf('Not enough coins') >= 0, 'it says "Not enough coins"');
    // a double tap buys one, not two
    await page.evaluate(() => window.__app.profile.addCoins(1001)); // 1,400: two shuffles would fit
    await sleep(900);
    await page.locator('[data-booster="shuffle"] .k-btn').scrollIntoViewIfNeeded();
    await doubleTap(page, '[data-booster="shuffle"] .k-btn');
    await sleep(500);
    eq(await coinsOf(page), 1000, 'a double tap on Buy buys once (1,400 − 400)');
    eq(await boosterCount(page, 'shuffle'), 2, 'one more shuffle');
  });

  await test('level intro: choosing is free, Play takes exactly the chosen boosters, the Caravan gives its own', async () => {
    // level 47 with a Caravan of 2 wins (free beam & nova + prism); owned: 1 beam & nova, 0 prism, 2 extra moves
    const { page } = await open(browser, { fakestore: '0', screen: 'map', fast: '1', save: saveParam({ upTo: 46, coins: 1000, caravan: 2, boosters: { hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 2, prism: 0, beamNova: 1 }, dailyDay: today, dailyStreak: 2 }) });
    const moves = await page.evaluate(() => window.__app.ctx.levels[46].moves);
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('.m-caravan__gift').count(), 2, 'the Caravan of two wins brings two gifts');
    // toggling on / off / on costs nothing
    for (let i = 0; i < 3; i++) await tap(page, '[data-booster="extraMoves"]');
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 2, prism: 0, beamNova: 1 }), 'choosing a booster does not take it yet');
    ok((await page.locator('[data-booster="extraMoves"].m-boost--on').count()) === 1, 'extra moves are chosen');
    // none owned → buy one for 800: chosen
    await tap(page, '[data-booster="prism"]');
    await waitDialogs(page, 2);
    eq(await page.locator('.k-overlay:not(.k-under) .k-price').innerText(), '800', 'the offer states the price 800');
    await tap(page, '.k-overlay:not(.k-under) .k-btn--price');
    await waitDialogs(page, 1);
    eq(await coinsOf(page), 200, 'buying the prism costs 800 (1,000 → 200)');
    eq(await boosterCount(page, 'prism'), 1, 'one prism owned');
    // not enough for another one: cancelled offers and a failed purchase change nothing
    await tap(page, '[data-booster="prism"]'); // chosen → toggles off
    await tap(page, '[data-booster="prism"]'); // owned → toggles on, no offer
    eq(await page.locator('.k-overlay:not(.k-closing)').count(), 1, 'an owned booster is toggled, not offered again');
    // closing the intro takes nothing
    await back(page);
    await waitDialogs(page, 0);
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 2, prism: 1, beamNova: 1 }), 'closing the intro takes no booster');
    // again, and a double tap on Play
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('.m-boost--on').count(), 0, 'a new intro starts with nothing chosen');
    await tap(page, '[data-booster="extraMoves"]');
    await tap(page, '[data-booster="prism"]');
    await doubleTap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 1, prism: 0, beamNova: 1 }), 'Play took one extra moves and one prism — once, and not the beam & nova the Caravan brought');
    eq(await coinsOf(page), 200, 'starting a level costs no coins');
    await page.waitForFunction(() => window.__play.state() === 'play', null, { timeout: 15000 });
    eq(await page.evaluate(() => window.__play.snapshot().movesLeft), moves + 3, 'the level starts with 3 extra moves (' + moves + ' + 3)');
    eq((await state(page)).lives, 5, 'starting a level costs no life');
  });

  await test('a level that cannot be opened gives the chosen boosters back', async () => {
    const { page } = await open(browser, { fakestore: '0', screen: 'map', save: saveParam({ upTo: 46, coins: 1000, boosters: { extraMoves: 2, prism: 1, beamNova: 1 }, dailyDay: today, dailyStreak: 2 }) });
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-booster="extraMoves"]');
    await tap(page, '[data-booster="prism"]');
    // break the level's definition: the play screen will refuse it
    await page.evaluate(() => {
      const level = window.__app.ctx.levels[46];
      const cols = level.cols;
      window.__repairLevel = () => Object.defineProperty(level, 'cols', { value: cols, configurable: true, writable: true, enumerable: true });
      Object.defineProperty(level, 'cols', {
        get: () => {
          throw new Error('test: this level is broken');
        },
        configurable: true,
        enumerable: true,
      });
    });
    const before = await inventory(page);
    run.tolerate++;
    await tap(page, '[data-act="intro-play"]');
    await sleep(900);
    run.tolerate--;
    const s = await state(page);
    eq(s.screen, 'map', 'the player is back on the map');
    eq(JSON.stringify(await inventory(page)), JSON.stringify(before), 'the chosen boosters are back in the inventory');
    eq(s.coins, 1000, 'no coins were lost');
    eq(s.lives, 5, 'no life was lost');
    ok((await toastTexts(page)).some((t) => /could not be opened/.test(t)), 'a message explains it');
    eq(await page.locator('.m-stage > *').count(), 1, 'one screen is mounted');
    // repaired: the same level starts normally
    await page.evaluate(() => window.__repairLevel());
    await tap(page, '.m-node[data-level="47"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    ok(true, 'and the level opens once it is whole again');
  });

  await test('lives: refill costs exactly 900 — or nothing; an ad gives exactly one; three ads a day', async () => {
    const { page } = await open(browser, { fakestore: '1', screen: 'map', save: saveParam({ upTo: 46, coins: 899, lives: 0, lifeAgoMs: 1000, dailyDay: today, dailyStreak: 2 }) });
    await waitStore(page);
    await tap(page, '[data-act="lives"]');
    await page.waitForSelector('.m-dialog-lives', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('[data-act="lives-refill"] .k-price').innerText(), '900', 'the refill states its price: 900');
    // 899 coins: no refill, nothing charged, the shop is offered
    await tap(page, '[data-act="lives-refill"]');
    await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
    let s = await state(page);
    eq(s.coins, 899, 'with 899 coins the refill charges nothing');
    eq(s.lives, 0, 'and refills nothing');
    ok((await toastTexts(page)).indexOf('Not enough coins') >= 0, 'it says "Not enough coins" and opens the shop');
    await sleep(420);
    await back(page);
    await waitDialogs(page, 1);
    // an ad watched to the end: exactly one life
    const left0 = await page.evaluate(() => window.__app.store.rewardedLeft('freeLife'));
    eq(left0, 3, 'three "free life" ads are allowed today');
    await tap(page, '[data-act="lives-ad"]');
    await fakeAd(page, true);
    await page.waitForFunction(() => window.__app.profile.lives().count === 1, null, { timeout: 5000 });
    await sleep(500);
    s = await state(page);
    eq(s.lives, 1, 'a watched ad gives exactly one life');
    eq(s.coins, 899, 'and costs nothing');
    // an ad closed early: nothing
    await tap(page, '[data-act="lives-ad"]');
    await fakeAd(page, false);
    await sleep(700);
    eq((await state(page)).lives, 1, 'an ad closed early gives no life');
    eq(await page.evaluate(() => window.__app.store.rewardedLeft('freeLife')), 2, "and does not use up one of today's ads");
    ok((await toastTexts(page)).some((t) => /closed early/.test(t)), 'the player is told why');
    // the other two of today
    for (let i = 2; i <= 3; i++) {
      await sleep(600);
      await tap(page, '[data-act="lives-ad"]');
      await fakeAd(page, true);
      await page.waitForFunction((n) => window.__app.profile.lives().count === n, i, { timeout: 5000 });
    }
    await sleep(500);
    eq((await state(page)).lives, 3, 'three watched ads: three lives');
    eq(await page.locator('[data-act="lives-ad"]:visible').count(), 0, 'after three ads the offer is gone for today');
    ok(await page.locator('[data-act="lives-refill"]').isVisible(), 'the refill for coins stays');
    // exactly 900 coins: refill to five, 0 coins left, the dialog closes
    await page.evaluate(() => window.__app.profile.addCoins(1));
    await sleep(700);
    await tap(page, '[data-act="lives-refill"]');
    await waitDialogs(page, 0);
    s = await state(page);
    eq(s.coins, 0, 'the refill costs exactly 900 (900 → 0)');
    eq(s.lives, 5, 'and fills all five lives');
    eq(await page.locator('[data-act="lives"] .k-chip__text').innerText(), 'Full', 'the map shows "Full"');
    await sleep(900); // the coin counter counts down
    eq(await page.locator('[data-act="coins"] .k-chip__text').innerText(), '0', 'and 0 coins');
  });

  await test('free coins: 50 per watched ad, nothing for one closed early, three a day', async () => {
    const { page } = await open(browser, { fakestore: '1', screen: 'map', save: saveParam({ upTo: 46, coins: 7, dailyDay: today, dailyStreak: 2 }) });
    await waitStore(page);
    await openShop(page);
    eq(await page.locator('[data-act="free-coins"] .k-btn__label').innerText(), '+50', 'the button states the reward: +50');
    ok(/3 left today/.test(await page.locator('.m-shop__freecard').innerText()), 'three are left today');
    await tap(page, '[data-act="free-coins"]');
    await fakeAd(page, false);
    await sleep(700);
    eq(await coinsOf(page), 7, 'an ad closed early pays nothing');
    ok(/3 left today/.test(await page.locator('.m-shop__freecard').innerText()), 'and still three are left');
    for (let i = 1; i <= 3; i++) {
      await sleep(500);
      await tap(page, '[data-act="free-coins"]');
      await fakeAd(page, true);
      await page.waitForFunction((c) => window.__app.profile.coins() === c, 7 + 50 * i, { timeout: 5000 });
      ok(true, 'ad ' + i + ': ' + (7 + 50 * i) + ' coins');
    }
    await sleep(900);
    eq(await coinsOf(page), 157, 'three ads paid 150 coins in all (7 → 157)');
    ok(/No more today/.test(await page.locator('.m-shop__freecard').innerText()), 'the card says "No more today"');
    ok(await page.locator('[data-act="free-coins"]').isDisabled(), 'and the button is off');
    eq(await page.locator('.m-dialog-shop .m-shop__balance .k-chip__text').innerText(), '157', 'the balance shows 157');
  });

  await test('purchases: granted once per purchase; pending grants later; the starter pack once for ever', async () => {
    // a real save in localStorage, so a reload proves nothing is granted twice
    const init = (json) => {
      try {
        if (!localStorage.getItem('match3.save.v1')) localStorage.setItem('match3.save.v1', json);
      } catch (e) {
        // no storage: the test will notice
      }
    };
    const { page } = await open(browser, { fakestore: '1', screen: 'map' }, { init, initArg: JSON.stringify(saveData({ upTo: 46, coins: 0, boosters: NO_BOOSTERS, dailyDay: today, dailyStreak: 2 })) });
    await waitStore(page);
    await openShop(page);
    // a double tap starts one purchase (the store is watched, and answers "cancelled" a moment later)
    await page.evaluate(() => {
      const store = window.__app.store;
      const real = store.buy;
      window.__buyCalls = 0;
      store.buy = (id) => {
        window.__buyCalls++;
        return new Promise((resolve) => setTimeout(() => resolve('cancelled'), 700));
      };
      window.__restoreBuy = () => {
        store.buy = real;
      };
    });
    await doubleTap(page, '[data-product="coins_small"] .k-btn');
    await sleep(350);
    await page.locator('[data-product="coins_small"] .k-btn').tap({ force: true }).catch(() => undefined); // a third, impatient tap
    await sleep(900);
    eq(await page.evaluate(() => window.__buyCalls), 1, 'a double tap on the price (and a third while it is busy) starts one purchase');
    await page.evaluate(() => window.__restoreBuy());
    eq(await coinsOf(page), 0, 'nothing granted by a cancelled purchase');
    await tap(page, '[data-product="coins_small"] .k-btn');
    await fakeSheet(page, 'buy');
    await page.waitForFunction(() => window.__app.profile.coins() > 0, null, { timeout: 8000 });
    await sleep(900);
    eq(await coinsOf(page), 1000, 'the small pack: exactly 1,000 coins');
    ok((await toastTexts(page)).some((t) => /Thank you/.test(t)), 'with a thank-you');
    // a second one is a second purchase
    await tap(page, '[data-product="coins_small"] .k-btn');
    await fakeSheet(page, 'buy');
    await page.waitForFunction(() => window.__app.profile.coins() === 2000, null, { timeout: 8000 });
    ok(true, 'bought again: 2,000');
    await sleep(900);
    // pending: nothing now
    await tap(page, '[data-product="coins_medium"] .k-btn');
    await fakeSheet(page, 'pending');
    await sleep(800);
    eq(await coinsOf(page), 2000, 'a pending payment grants nothing yet');
    ok((await toastTexts(page)).some((t) => /pending/i.test(t)), 'and is announced as pending');
    ok(!(await toastTexts(page)).some((t) => /Thank you|complete\./.test(t)), 'not as a completed purchase');
    // the starter pack
    await page.locator('[data-product="starter_pack"] .k-btn').scrollIntoViewIfNeeded();
    await tap(page, '[data-product="starter_pack"] .k-btn');
    await fakeSheet(page, 'buy');
    await page.waitForFunction(() => window.__app.store.owns('starter_pack'), null, { timeout: 8000 });
    await sleep(900);
    eq(await coinsOf(page), 6000, 'the starter pack: 4,000 coins (2,000 → 6,000)');
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 3, shuffle: 0, extraMoves: 0, prism: 2, beamNova: 0 }), 'plus 3 hammers, 3 free swaps and 2 prisms');
    eq(await page.locator('.m-dialog-shop [data-product="starter_pack"]').count(), 0, 'its offer is gone');
    eq(await page.locator('.m-dialog-shop [data-product="remove_ads"]').count(), 0, 'and so is "remove ads", which it includes');
    eq(await page.locator('.m-dialog-shop [data-product]').count(), 5, 'the five coin packs stay');
    await back(page);
    // "restore purchases" completes the pending payment (the test store settles it then): exactly 5,500
    await tap(page, '[data-act="settings"]');
    await page.waitForSelector('.m-dialog-settings', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="restore"]');
    await page.waitForFunction(() => window.__app.profile.coins() === 11500, null, { timeout: 8000 });
    ok(true, 'the pending pack arrives with the next restore: 5,500 coins (6,000 → 11,500)');
    await sleep(1200);
    await tap(page, '[data-act="restore"]');
    await sleep(1500);
    eq(await coinsOf(page), 11500, 'restoring again grants nothing more');
    // reload: the same numbers, nothing delivered a second time
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__booted === true && !!window.__app, null, { timeout: 30000 });
    await waitStore(page);
    await sleep(1500);
    eq(await coinsOf(page), 11500, 'after a restart: still 11,500 coins');
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 3, shuffle: 0, extraMoves: 0, prism: 2, beamNova: 0 }), 'and the same boosters');
    eq(await page.evaluate(() => window.__app.store.owns('starter_pack')), true, 'the starter pack is still owned');
    await openShop(page);
    eq(await page.locator('.m-dialog-shop [data-product="starter_pack"]').count(), 0, 'and still not on offer');
  });

  await test('booster gifts: each unlock is given once, in order, with its amount', async () => {
    // level 19 reached with nothing given yet: all six boosters unlock at once (never so in real play)
    const { page } = await open(browser, { fakestore: '0', screen: 'map', save: saveParam({ upTo: 18, coins: 0, boosters: NO_BOOSTERS, gifted: [], dailyDay: today, dailyStreak: 1 }) });
    const seen = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForSelector('.k-overlay:not(.k-closing):not(.k-under) [data-dialog="unlock"], .k-overlay:not(.k-closing):not(.k-under)[data-x]', { timeout: 5000 }).catch(() => undefined);
      await page.waitForFunction(() => document.querySelectorAll('.k-overlay:not(.k-closing) .m-dialog-unlock').length === 1, null, { timeout: 5000 });
      await sleep(420);
      seen.push((await page.locator('.k-overlay:not(.k-closing) .m-unlock__name').innerText()) + ' ' + (await page.locator('.k-overlay:not(.k-closing) .m-unlock__qty').innerText()));
      await tap(page, '.k-overlay:not(.k-closing) .k-dialog__foot .k-btn');
      await sleep(450);
    }
    eq(seen.join(', '), 'Beam & Nova ×2, Hammer ×3, Free Swap ×3, Prism ×2, Shuffle ×3, Extra Moves ×2', 'the six introductions, in unlock order');
    await sleep(600);
    eq((await state(page)).overlay, false, 'then nothing more');
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 2, beamNova: 2 }), 'the inventory holds exactly the gifts');
    await page.evaluate(() => window.__app.goto('map'));
    await sleep(900);
    eq((await state(page)).overlay, false, 'coming back to the map gives nothing again');
    eq(JSON.stringify(await inventory(page)), JSON.stringify({ hammer: 3, freeSwap: 3, shuffle: 3, extraMoves: 2, prism: 2, beamNova: 2 }), 'the inventory is unchanged');
  });

  await test('a win on the map: coins and stars count up to the exact totals', async () => {
    const { page } = await open(browser, { fakestore: '0', screen: 'map', save: saveParam({ upTo: 46, stars: 2, coins: 500, dailyDay: today, dailyStreak: 2 }) });
    const hard = await page.evaluate(() => window.__app.ctx.levels[46].hard === true);
    eq(await page.locator('[data-act="coins"] .k-chip__text').innerText(), '500', 'before: 500 coins');
    eq(await page.locator('.m-chip--stars .k-chip__text').innerText(), '92', 'before: 92 stars');
    const summary = await page.evaluate(() => {
      const a = window.__app;
      a.ctx.nav.toPlay(47, {});
      const result = a.profile.recordWin(47, 3, 5200, 3);
      a.ctx.nav.toMap({ justWon: 47 });
      return result;
    });
    const reward = (20 + 10 * 3) * (hard ? 2 : 1);
    eq(summary.coinsEarned, reward, 'a first clear with 3 stars pays ' + reward + ' coins');
    await waitScreen(page, 'map');
    eq(await coinsOf(page), 500 + reward, 'the profile holds 500 + ' + reward);
    await page.waitForFunction((want) => document.querySelector('[data-act="coins"] .k-chip__text').textContent === want, String(500 + reward), { timeout: 5000 });
    eq(await page.locator('.m-chip--stars .k-chip__text').innerText(), '95', 'the star counter shows 95');
    await page.evaluate(() => window.__app.kit.closeAll());
    // replaying it for the same stars pays nothing
    const again = await page.evaluate(() => window.__app.profile.recordWin(47, 3, 5300, 3).coinsEarned);
    eq(again, 0, 'winning it again with the same stars pays nothing');
    eq(await coinsOf(page), 500 + reward, 'coins unchanged');
  });

  // ───────────────────────────── the clock ─────────────────────────────

  await test('lives come back every 30 minutes: second by second, never negative, also across pause and a clock set back', async () => {
    const data = saveData({ upTo: 46, coins: 100, lives: 0, lifeAgoMs: 60000, dailyDay: dayOf(T0), dailyStreak: 2, now: T0 });
    const { page } = await open(browser, { fakestore: '0', screen: 'map', lang: 'en' }, { clock: T0, init: androidBridgeSave, initArg: JSON.stringify(data) });
    const chip = () => page.evaluate(() => ({ text: document.querySelector('[data-act="lives"] .k-chip__text').textContent, count: document.querySelector('[data-act="lives"] .m-chip__count').textContent }));
    const toSeconds = (text) => {
      const m = /^(\d\d):(\d\d)$/.exec(text);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    // (read in the middle of a second: the text follows the clock within a few milliseconds)
    await page.clock.pauseAt(T0 + 5500);
    let c = await chip();
    eq(c.count, '0', 'no lives');
    eq(c.text, '28:55', 'a minute and 5.5 seconds into the wait the counter shows 28:55');
    // 90 seconds, one at a time: the counter goes down by exactly one each time
    let previous = toSeconds(c.text);
    let steady = true;
    const seen = [];
    for (let i = 0; i < 90; i++) {
      await page.clock.runFor(1000);
      c = await chip();
      const now = toSeconds(c.text);
      if (now !== previous - 1) {
        steady = false;
        seen.push(c.text);
      }
      previous = now;
    }
    ok(steady, 'over 90 seconds the countdown loses exactly one second per second' + (steady ? '' : ' (odd steps at ' + seen.slice(0, 5).join(', ') + ')'));
    eq(c.text, '27:25', 'and stands at 27:25');
    // inside a second the text does not change
    await page.clock.runFor(400);
    eq((await chip()).text, '27:25', 'it changes only when a whole second is over');
    await page.clock.runFor(200);
    eq((await chip()).text, '27:24', 'then at once');

    // while the app is in the background nothing ticks; coming back shows the right time at once
    await page.evaluate(() => window.__native.pause());
    await page.clock.runFor(5000);
    eq((await chip()).text, '27:24', 'paused: the counter stands still');
    await page.clock.fastForward(10 * 60000 - 5000);
    eq((await chip()).text, '27:24', 'also over ten minutes');
    await page.evaluate(() => window.__native.resume());
    eq((await chip()).text, '17:24', 'resumed: it shows the real time left, at once');

    // the life arrives exactly when the 30 minutes are over
    await page.clock.fastForward(17 * 60000 + 23000);
    await page.clock.runFor(10);
    c = await chip();
    eq(c.count + ' ' + c.text, '0 00:01', 'one second before: still 0 lives, 00:01');
    await page.clock.runFor(990);
    c = await chip();
    eq(c.count + ' ' + c.text, '1 30:00', 'the first life arrives on time, and the next 30 minutes begin');
    eq((await state(page)).lives, 1, 'the profile agrees: 1 life');

    // the lives dialog follows along
    await page.clock.resume();
    await tap(page, '[data-act="lives"]');
    await page.waitForSelector('.m-dialog-lives', { timeout: 5000 });
    await sleep(420);
    eq(await page.locator('.m-dialog-lives .k-dialog__title').innerText(), 'Lives', 'with a life the dialog is called "Lives"');
    eq(await page.locator('.m-lives__count').innerText(), '1', 'and shows 1');
    await page.clock.pauseAt(T0 + 31 * 60000 + 500);
    await page.clock.runFor(10);
    eq(await page.locator('.m-lives__clock').innerText(), '28:00', '31 minutes in, the next life is 28:00 away');
    await page.clock.runFor(2000);
    eq(await page.locator('.m-lives__clock').innerText(), '27:58', 'and the dialog counts down with the clock');
    await page.clock.fastForward(30 * 60000);
    await page.clock.runFor(10);
    eq(await page.locator('.m-lives__count').innerText(), '2', 'a life arrives while the dialog is open: 2');
    // three more half hours: full
    await page.clock.fastForward(90 * 60000);
    await page.clock.runFor(10);
    eq(await page.locator('.m-lives__count').innerText(), '5', 'two and a half hours after the start: 5 lives');
    ok(/full/i.test(await page.locator('.m-lives__status').innerText()), 'the dialog says the lives are full');
    eq(await page.locator('[data-act="lives-refill"]:visible').count(), 0, 'and offers no refill');
    c = await chip();
    eq(c.count + ' ' + c.text, '5 Full', 'the map shows 5 · Full');
    // full lives never exceed the maximum, however long the wait
    await page.clock.fastForward(DAY);
    await page.clock.runFor(10);
    eq((await state(page)).lives, 5, 'a day later: still 5, never more');

    // the device clock set back by two days: no free lives, no negative or endless wait
    await page.evaluate(() => {
      const a = window.__app;
      a.kit.closeAll();
      a.profile.loseLife();
      a.profile.loseLife();
    });
    await page.clock.runFor(1000);
    eq((await chip()).count, '3', 'two lives lost: 3');
    await page.clock.setSystemTime(T0 - 2 * DAY);
    await page.clock.runFor(1500);
    c = await chip();
    eq(c.count, '3', 'clock set back two days: still 3 lives');
    ok(toSeconds(c.text) > 0 && toSeconds(c.text) <= 1800, 'the wait is a normal one, at most 30:00 (' + c.text + ')');
    await page.clock.fastForward(30 * 60000);
    await page.clock.runFor(10);
    eq((await chip()).count, '4', 'and a life still comes after 30 minutes');
  });

  await test('daily reward: a whole week across midnights, to the coin; a missed day starts over', async () => {
    const data = saveData({ upTo: 46, coins: 0, boosters: NO_BOOSTERS, dailyDay: -1, dailyStreak: 0, now: T0 });
    const { page } = await open(browser, { fakestore: '0', screen: 'map', lang: 'en' }, { clock: T0, init: androidBridgeSave, initArg: JSON.stringify(data) });
    const claim = async () => {
      await page.waitForSelector('[data-act="daily-claim"]', { timeout: 5000 });
      await sleep(420);
      await doubleTap(page, '[data-act="daily-claim"]'); // a double tap must claim once
      await sleep(500);
    };
    const expectDay = async (label, coins, boosters) => {
      eq(await coinsOf(page), coins, label + ': coins');
      eq(JSON.stringify(await inventory(page)), JSON.stringify(Object.assign({}, NO_BOOSTERS, boosters)), label + ': boosters');
      eq(await page.evaluate(() => window.__app.profile.daily().canClaim), false, label + ': cannot be claimed again today');
      eq(await page.locator('[data-act="daily-claim"]').count(), 0, label + ': the Claim button is gone');
      ok(await page.locator('.m-daily__wait').isVisible(), label + ': the dialog counts down to the next day');
    };
    // day 1 is offered by itself on reaching the map
    await page.waitForSelector('.m-dialog-daily', { timeout: 5000 });
    eq(await page.locator('.m-day--today').getAttribute('data-day'), '1', 'the first reward is day 1');
    await claim();
    await expectDay('day 1', 100, {});
    eq(await page.locator('[data-act="daily"] .k-badge').count(), 0, 'no "!" on the tray button after claiming');

    // The dialog stays open over midnight: the countdown ends and Claim comes back by itself.
    const week = [
      ['day 2', 100, { hammer: 1 }],
      ['day 3', 250, { hammer: 1 }],
      ['day 4', 250, { hammer: 1, shuffle: 1, freeSwap: 1 }],
      ['day 5', 450, { hammer: 1, shuffle: 1, freeSwap: 1 }],
      ['day 6', 450, { hammer: 1, shuffle: 1, freeSwap: 1, beamNova: 1 }],
      ['day 7', 950, { hammer: 1, shuffle: 1, freeSwap: 1, beamNova: 1, prism: 1 }],
    ];
    let now = T0;
    for (let i = 0; i < week.length; i++) {
      const [label, coins, boosters] = week[i];
      // one second before midnight: still nothing to claim
      const midnight = nextMidnight(now);
      await page.clock.pauseAt(midnight - 1000);
      await page.clock.runFor(500);
      eq(await page.evaluate(() => window.__app.profile.daily().canClaim), false, label + ': not yet at 23:59:59');
      await page.clock.runFor(1500);
      now = midnight + 1000;
      eq(await page.evaluate(() => window.__app.profile.daily().canClaim), true, label + ': claimable right after midnight');
      await page.clock.resume();
      if (i % 2 === 0) {
        // the open dialog switches to Claim by itself
        await page.waitForSelector('[data-act="daily-claim"]', { timeout: 5000 });
      } else {
        // closed and reopened from the tray, whose badge shows "!"
        await page.evaluate(() => window.__app.kit.closeAll());
        await page.waitForSelector('[data-act="daily"] .k-badge', { timeout: 5000 });
        await sleep(400);
        await tap(page, '[data-act="daily"]');
      }
      eq(await page.locator('.m-day--today').getAttribute('data-day'), String(i + 2), label + ': the strip highlights day ' + (i + 2));
      eq(await page.locator('.m-day--done').count(), i + 1, label + ': ' + (i + 1) + ' day(s) ticked');
      await claim();
      await expectDay(label, coins, boosters);
    }
    eq(await page.evaluate(() => window.__app.profile.daily().streak), 7, 'a streak of 7 days');

    // day 8: the cycle starts again at day 1, the streak goes on
    await page.clock.pauseAt(nextMidnight(now) + 60000);
    now = nextMidnight(now) + 60000;
    await page.clock.resume();
    await page.waitForSelector('[data-act="daily-claim"]', { timeout: 5000 });
    eq(await page.locator('.m-day--today').getAttribute('data-day'), '1', 'day 8 is day 1 of the next round');
    await claim();
    await expectDay('day 8', 1050, { hammer: 1, shuffle: 1, freeSwap: 1, beamNova: 1, prism: 1 });
    eq(await page.evaluate(() => window.__app.profile.daily().streak), 8, 'the streak is 8');

    // a missed day: back to day 1 with a streak of 1 (the second reward of the round is not given)
    await page.clock.pauseAt(now + 2 * DAY);
    now += 2 * DAY;
    await page.clock.resume();
    await page.waitForSelector('[data-act="daily-claim"]', { timeout: 5000 });
    eq(await page.locator('.m-day--today').getAttribute('data-day'), '1', 'after a missed day the round starts over at day 1');
    eq(await page.locator('.m-day--done').count(), 0, 'no day is ticked');
    await claim();
    await expectDay('after a missed day', 1150, { hammer: 1, shuffle: 1, freeSwap: 1, beamNova: 1, prism: 1 });
    eq(await page.evaluate(() => window.__app.profile.daily().streak), 1, 'the streak is 1 again');

    // the clock set back to yesterday: nothing to claim, nothing lost
    await page.clock.setSystemTime(now - DAY);
    await page.clock.runFor(1500);
    eq(await page.evaluate(() => window.__app.profile.daily().canClaim), false, 'a clock set back a day cannot claim again');
    eq(await coinsOf(page), 1150, 'coins unchanged');
  });

  await test('daily reward for a booster that is still locked is paid as 150 coins', async () => {
    // level 4 reached (no booster unlocked), second day of the round: "1 hammer" → 150 coins
    const data = saveData({ upTo: 3, coins: 10, boosters: NO_BOOSTERS, gifted: [], dailyDay: dayOf(T0) - 1, dailyStreak: 1, now: T0 });
    const { page } = await open(browser, { fakestore: '0', screen: 'map', lang: 'en', save: L.encodeSave(data) }, { clock: T0 });
    await page.waitForSelector('.m-dialog-daily', { timeout: 5000 });
    await sleep(450);
    eq(await page.locator('.m-day--today').getAttribute('data-day'), '2', 'day 2 is up');
    eq(await page.locator('.m-day--today .m-reward__n').innerText(), '150', 'the strip already shows 150 coins instead of the locked hammer');
    await tap(page, '[data-act="daily-claim"]');
    await sleep(500);
    eq(await coinsOf(page), 160, '150 coins are paid (10 → 160)');
    eq(await boosterCount(page, 'hammer'), 0, 'and no hammer');
    ok(/150 coins/.test(await page.locator('.m-daily__result').innerText()), 'the dialog says what was received: 150 coins');
  });

  await test('the daily reward is not offered on the first day, and appears with the second', async () => {
    const data = saveData({ upTo: 12, coins: 10, dailyDay: -1, dailyStreak: 0, firstDay: dayOf(T0), now: T0 });
    const { page } = await open(browser, { fakestore: '0', screen: 'map', lang: 'en' }, { clock: T0, init: androidBridgeSave, initArg: JSON.stringify(data) });
    await sleep(900);
    eq(await page.locator('[data-act="daily"]').count(), 0, 'first day: no daily button');
    eq((await state(page)).overlay, false, 'and no pop-up');
    // midnight passes while the map is showing: the button appears, with its "!"
    await page.clock.pauseAt(nextMidnight(T0) + 2000);
    await page.clock.runFor(1500);
    await page.clock.resume();
    await page.waitForSelector('[data-act="daily"]', { timeout: 5000 });
    ok((await page.locator('[data-act="daily"] .k-badge').count()) === 1, 'second day: the daily button is there, with its "!"');
    eq(await page.locator('.m-stage > *').count(), 1, 'the map was rebuilt in place (one screen)');
    await tap(page, '[data-act="daily"]');
    await page.waitForSelector('[data-act="daily-claim"]', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="daily-claim"]');
    await sleep(400);
    eq(await coinsOf(page), 110, 'day 1 pays 100 coins (10 → 110)');
  });
}

/** A minimal Android bridge that only holds the save (so the profile uses the page's — fake — clock with a real save). */
function androidBridgeSave(json) {
  let saved = json;
  window.AndroidBridge = {
    loadSave: () => saved,
    storeSave: (s) => {
      saved = s;
    },
    haptic: () => {},
    setAtRoot: () => {},
    info: () => JSON.stringify({ versionName: '1.0.0', versionCode: 1, locale: 'en-US' }),
    rate: () => {},
  };
}

async function main() {
  const browser = await chromium.launch();
  let server = null;
  try {
    console.log('economy & clock (' + L.BASE + ')');
    server = await L.quietDevServer();
    await tests(browser);
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
