/**
 * The shell under bad conditions: broken environments at boot (no fonts, no audio, no storage,
 * damaged or impossible saves), a WebView-80-like browser, reduced motion, pause / resume in the
 * middle of everything, rotations, navigation storms, double taps — and memory after entering and
 * leaving the map 50 times.
 *
 *   node tests/e2e/meta-robust.cjs
 *   META_ONLY=memory node tests/e2e/meta-robust.cjs
 *
 * Any console error, uncaught exception or CSP violation fails the run. Port 5185 (see meta-lib.cjs).
 */
const { chromium } = require('playwright');
const L = require('./meta-lib.cjs');

const run = L.createRunner('meta-robust.cjs');
const { ok, eq, test, open } = run;
const { sleep, state, tap, waitScreen, waitDialogs, back, saveData, saveParam, today, DAY } = L;

const MID = { upTo: 46, coins: 3000, dailyDay: today, dailyStreak: 2 };

/** What must hold whenever the app has come to rest. */
async function invariants(page, where) {
  const got = await page.evaluate(() => {
    const a = window.__app;
    const lives = a.profile.lives();
    const calls = window.__bridgeCalls;
    return {
      screen: a.shell.current(),
      mounted: document.querySelectorAll('.m-stage > *').length,
      root: a.shell.atRoot(),
      truth: a.shell.current() === 'title' && !a.kit.hasOverlay(),
      told: calls && calls.atRoot.length ? calls.atRoot[calls.atRoot.length - 1] : null,
      coins: a.profile.coins(),
      lives: lives.count,
      max: lives.max,
      next: lives.nextInMs,
      lang: a.ctx.i18n.lang(),
      dir: document.documentElement.getAttribute('dir'),
      htmlLang: document.documentElement.getAttribute('lang'),
      overlays: document.querySelectorAll('.k-overlay:not(.k-closing)').length,
      has: a.kit.hasOverlay(),
      current: document.querySelectorAll('.m-node--current').length,
      sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });
  ok(got.screen === 'title' || got.screen === 'map' || got.screen === 'play', where + ': on a screen (' + got.screen + ')');
  eq(got.mounted, 1, where + ': one screen mounted');
  eq(got.root, got.truth, where + ': atRoot() is "title with nothing open"');
  if (got.told !== null) eq(got.told, got.truth, where + ': the wrapper was told the same');
  ok(Number.isInteger(got.coins) && got.coins >= 0, where + ': coins are a whole number ≥ 0 (' + got.coins + ')');
  ok(got.lives >= 0 && got.lives <= got.max && got.next >= 0 && got.next <= 30 * 60000, where + ': lives within 0…' + got.max + ', wait within 30 minutes');
  eq(got.dir, got.lang === 'ar' ? 'rtl' : 'ltr', where + ': the page direction matches the language');
  eq(got.htmlLang, got.lang, where + ': <html lang> matches the language');
  eq(got.overlays > 0, got.has, where + ': the kit and the DOM agree about open dialogs');
  ok(got.current <= 1, where + ': at most one current level on the map (' + got.current + ')');
  ok(!got.sideScroll, where + ': the page does not scroll sideways');
  return got;
}

/** Title → map → intro → level → back out; settings and language on the way. Works in any language. */
async function tour(page, where, opts) {
  const o = opts || {};
  await invariants(page, where + ' / title');
  await tap(page, '[data-act="settings"]');
  await waitDialogs(page, 1);
  await page.locator('[data-act="language"] .k-seg__opt').nth(1).tap();
  await sleep(400);
  await page.locator('[data-act="language"] .k-seg__opt').nth(0).tap();
  await sleep(400);
  await tap(page, '[data-act="toggle-sfx"]');
  await tap(page, '[data-act="toggle-sfx"]');
  await back(page);
  await waitDialogs(page, 0);
  await page.evaluate(() => window.__app.goto('map'));
  await waitScreen(page, 'map');
  await sleep(700);
  await page.evaluate(() => window.__app.kit.closeAll());
  await sleep(400);
  await invariants(page, where + ' / map');
  if ((await page.locator('[data-act="shop"]').count()) > 0) {
    await tap(page, '[data-act="shop"]');
    await waitDialogs(page, 1);
    await back(page);
    await waitDialogs(page, 0);
  }
  const level = await page.evaluate(() => window.__app.profile.highestUnlocked());
  await page.evaluate((id) => window.__app.goto('intro', id), level);
  await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
  await sleep(420);
  if (o.play !== false) {
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    await page.waitForFunction(() => window.__play && (window.__play.state() === 'play' || document.querySelectorAll('.k-overlay:not(.k-closing)').length > 0), null, { timeout: 20000 });
    await invariants(page, where + ' / play');
    await page.evaluate(() => window.__app.ctx.nav.toMap());
    await waitScreen(page, 'map');
  } else {
    await back(page);
  }
  await page.evaluate(() => window.__app.kit.closeAll());
  await sleep(400);
  await tap(page, '[data-act="home"]');
  await waitScreen(page, 'title');
  await invariants(page, where + ' / title again');
}

const SAVE_KEY = 'match3.save.v1';
const putSave = (v) => {
  try {
    localStorage.setItem('match3.save.v1', v);
  } catch (e) {
    // the test will notice
  }
};

async function tests(browser) {
  // ───────────────────────────── boot ─────────────────────────────

  await test('boot without the font files: refused at once, or never answered', async () => {
    // refused: the fallback font shows, nothing else changes
    run.tolerate++; // the browser logs the failed requests
    let t0 = Date.now();
    let r = await open(browser, { fakestore: '0', fast: '1', save: saveParam(MID) }, { before: (page) => page.route(/\.woff2?(\?|$)/, (route) => route.abort()) });
    run.tolerate--;
    ok(Date.now() - t0 < 6000, 'font files refused: the title is up in ' + (Date.now() - t0) + ' ms');
    eq(await r.page.evaluate(() => document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'Aa')), false, 'the bundled font really is missing');
    ok((await r.page.locator('[data-act="play"]').innerText()).length > 0, 'the Play button has its text (fallback font)');
    run.tolerate++;
    await tour(r.page, 'no font');
    run.tolerate--;
    await r.context.close();
    // never answered: the first paint waits a moment, then goes ahead
    t0 = Date.now();
    // (the page's load event never comes while a font request hangs: do not wait for it)
    r = await open(browser, { fakestore: '0', save: saveParam(MID) }, { waitUntil: 'commit', before: (page) => page.route(/\.woff2?(\?|$)/, () => undefined) });
    const took = Date.now() - t0;
    ok(took < 7000, 'font files hanging: the title is up after ' + took + ' ms (it waits 2.5 s at most)');
    eq((await state(r.page)).screen, 'title', 'on the title');
    await tap(r.page, '[data-act="play"]');
    await waitScreen(r.page, 'map');
    ok(true, 'and the game goes on');
  });

  await test('boot without Web Audio: no AudioContext, one that throws, one that never resumes', async () => {
    const variants = {
      missing: () => {
        Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true, writable: true });
        Object.defineProperty(window, 'webkitAudioContext', { value: undefined, configurable: true, writable: true });
      },
      throwing: () => {
        const Boom = function () {
          throw new Error('audio hardware busy');
        };
        Object.defineProperty(window, 'AudioContext', { value: Boom, configurable: true, writable: true });
        Object.defineProperty(window, 'webkitAudioContext', { value: Boom, configurable: true, writable: true });
      },
      'stuck suspended': () => {
        const Real = window.AudioContext;
        if (!Real) return;
        Real.prototype.resume = function () {
          return Promise.reject(new Error('not allowed'));
        };
      },
    };
    for (const name of Object.keys(variants)) {
      const { page, context } = await open(browser, { fakestore: '0', fast: '1', save: saveParam(MID) }, { init: variants[name] });
      eq((await state(page)).screen, 'title', name + ': the title is up');
      await tour(page, 'audio ' + name);
      await context.close();
    }
  });

  await test('boot without storage: localStorage throws on access, on reading, on writing', async () => {
    const variants = {
      'no localStorage at all': () => {
        Object.defineProperty(window, 'localStorage', {
          get: () => {
            throw new DOMException('The operation is insecure.', 'SecurityError');
          },
          configurable: true,
        });
      },
      'getItem throws': () => {
        Storage.prototype.getItem = function () {
          throw new Error('read failed');
        };
      },
      'setItem throws (storage full)': () => {
        Storage.prototype.setItem = function () {
          throw new DOMException('quota', 'QuotaExceededError');
        };
      },
    };
    for (const name of Object.keys(variants)) {
      const { page, context } = await open(browser, { fakestore: '1', fast: '1', gate: 'off' }, { init: variants[name] });
      const s = await state(page);
      eq(s.screen, 'title', name + ': the title is up');
      eq(s.coins, 2000, name + ': a fresh profile (2,000 coins)');
      // progress lives on in memory: a purchase with coins works and sticks for the session
      await page.evaluate(() => window.__app.goto('map'));
      await waitScreen(page, 'map');
      await sleep(900); // with every feature on, a fresh profile is offered its first daily reward
      await page.evaluate(() => window.__app.kit.closeAll());
      await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 3000 });
      await tap(page, '[data-act="shop"]');
      await page.waitForSelector('.m-dialog-shop', { timeout: 5000 });
      await sleep(420);
      await page.locator('[data-booster="shuffle"] .k-btn').scrollIntoViewIfNeeded();
      await tap(page, '[data-booster="shuffle"] .k-btn');
      await sleep(400);
      eq((await state(page)).coins, 1600, name + ': buying a booster works from memory (2,000 − 400)');
      await back(page);
      await tap(page, '[data-act="home"]');
      await waitScreen(page, 'title');
      await tour(page, 'storage: ' + name);
      eq((await state(page)).coins, 1600, name + ': and the coins are still 1,600 afterwards');
      await context.close();
    }
  });

  await test('boot with a damaged save: garbage, wrong types, truncated, double-encoded', async () => {
    const good = saveData(MID);
    const cases = {
      'not JSON': '{{{{ this is not json',
      'empty string': '',
      'an array': '[1,2,3]',
      'a number': '42',
      null: 'null',
      truncated: JSON.stringify(good).slice(0, 180),
      'double-encoded': JSON.stringify(JSON.stringify(good)),
      'with a byte-order mark': '\uFEFF' + JSON.stringify(good),
      'wrong types everywhere': JSON.stringify({ version: 'x', levels: [1, 2], coins: 'many', lives: {}, lifeTimer: 'soon', boosters: 7, settings: 'loud', dailyDay: null, dailyStreak: -4, seen: {}, stats: 3, firstDay: 'monday', gifted: 'all', caravan: [] }),
      'negative and huge numbers': JSON.stringify(Object.assign({}, good, { coins: -500, lives: 9999, lifeTimer: -1, dailyStreak: 1e12, caravan: -3, boosters: { hammer: -2, freeSwap: 1e15, shuffle: 0.5, extraMoves: 'x', prism: null } })),
      'NaN and Infinity': JSON.stringify(good).replace('"coins":3000', '"coins":1e999').replace('"lives":5', '"lives":-1e999'),
      'levels with nonsense records': JSON.stringify(Object.assign({}, good, { levels: { 1: { stars: 9, best: -1 }, 2: null, 3: 'won', abc: { stars: 2, best: 3 }, 0: { stars: 1, best: 1 }, '-4': { stars: 1, best: 1 }, 5: { stars: 2, best: 2000 } } })),
    };
    for (const name of Object.keys(cases)) {
      const { page, context } = await open(browser, { fakestore: '0', gate: 'off' }, { init: putSave, initArg: cases[name] });
      const s = await invariants(page, name);
      eq(s.screen, 'title', name + ': the title is up');
      await page.evaluate(() => window.__app.goto('map'));
      await waitScreen(page, 'map');
      await sleep(600);
      await page.evaluate(() => window.__app.kit.closeAll());
      await sleep(300);
      await invariants(page, name + ' / map');
      ok((await page.locator('.m-node').count()) >= 10, name + ': the map shows its levels');
      const texts = await page.evaluate(() => Array.from(document.querySelectorAll('.m-top__panel .k-chip__text, .m-chip__count')).map((n) => n.textContent));
      ok(texts.every((t) => !/NaN|undefined|null|Infinity|-/.test(t)), name + ': the counters show sane values (' + texts.join(' · ') + ')');
      const level = await page.evaluate(() => window.__app.profile.highestUnlocked());
      await page.evaluate((id) => window.__app.goto('intro', id), level);
      await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
      ok(true, name + ': the current level (' + level + ') can be opened');
      await context.close();
    }
  });

  await test('boot with a save from the future: levels beyond the last, a newer version, dates ahead', async () => {
    const future = saveData({ upTo: 120, stars: 3, coins: 123456, dailyDay: today + 400, dailyStreak: 9, firstDay: today + 30 });
    for (let id = 121; id <= 140; id++) future.levels[id] = { stars: 3, best: 9999 };
    future.levels['5000'] = { stars: 3, best: 1 };
    future.version = 7;
    future.lives = 2;
    future.lifeTimer = Date.now() + 5 * DAY; // a life timer that starts in the future
    future.someNewField = { nested: true };
    const { page } = await open(browser, { fakestore: '0', lang: 'en', fast: '1' }, { init: putSave, initArg: JSON.stringify(future) });
    const s = await invariants(page, 'future save');
    eq(s.screen, 'title', 'the title is up');
    eq(await page.evaluate(() => window.__app.profile.highestUnlocked()), 120, 'the frontier is capped at the last level (120)');
    eq(await page.evaluate(() => window.__app.profile.totalStars()), 360, 'only the 120 real levels count: 360 stars');
    eq(s.coins, 123456, 'the coins are kept');
    eq(s.lives, 2, 'the lives are kept');
    ok(s.next > 0 && s.next <= 30 * 60000, 'a life timer from the future became a normal wait (' + Math.round(s.next / 1000) + ' s)');
    eq(await page.evaluate(() => window.__app.profile.daily().canClaim), false, 'a daily reward "claimed in the future" cannot be claimed again today');
    eq(await page.locator('[data-act="play"] .k-btn__cap').innerText(), 'Journey complete', 'the title names no level (all are won): it says the journey is complete');
    await tap(page, '[data-act="play"]');
    await waitScreen(page, 'map');
    await sleep(700);
    eq((await state(page)).overlay, false, 'nothing pops up');
    eq(await page.locator('.m-node--current').count(), 0, 'no current level');
    eq(await page.locator('.m-node--locked').count(), 0, 'no locked level in view');
    ok(await page.locator('.m-node[data-level="120"]').isVisible(), 'the map shows the last level');
    ok(await page.locator('.m-cap').isVisible(), 'and the "more levels are on the way" plaque');
    eq(await page.locator('[data-act="coins"] .k-chip__text').innerText(), '123,456', 'six-digit coins are shown in full');
    eq(await page.locator('.m-chip--stars .k-chip__text').innerText(), '360', '360 stars');
    await tap(page, '.m-node[data-level="120"]');
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    await sleep(420);
    await tap(page, '[data-act="intro-play"]');
    await waitScreen(page, 'play');
    ok(true, 'the last level can be replayed');
    await page.evaluate(() => window.__app.ctx.nav.toMap({ focusLevel: 120 }));
    await waitScreen(page, 'map');
    await invariants(page, 'future save / after a level');
  });

  await test('a WebView-80-like browser (newer APIs deleted, inert without effect): the whole tour', async () => {
    const { page } = await open(browser, { fakestore: '1', fast: '1', lang: 'en', save: saveParam({ upTo: 46, coins: 3000, lives: 3, dailyDay: today - 1, dailyStreak: 2 }) }, { init: L.webview80Shim });
    eq(await page.evaluate(() => window.__webview80 === true && typeof [].at === 'undefined' && typeof document.body.replaceChildren === 'undefined' && typeof Object.hasOwn === 'undefined'), true, 'the shim is in place');
    await tour(page, 'webview 80');
    // every dialog of the map
    await page.evaluate(() => window.__app.goto('map'));
    await waitScreen(page, 'map');
    await sleep(900);
    await page.evaluate(() => window.__app.kit.closeAll());
    await sleep(400);
    for (const act of ['lives', 'coins', 'daily', 'settings']) {
      await tap(page, '[data-act="' + act + '"]');
      await waitDialogs(page, 1);
      // with `inert` doing nothing, the dialog itself must keep taps away from the map behind it
      const behind = await page.evaluate(() => {
        const el = document.elementFromPoint(180, 600);
        return !!el && !!el.closest('.k-layer');
      });
      ok(behind, act + ': the map behind the dialog cannot be reached');
      await back(page);
      await waitDialogs(page, 0);
    }
    await page.evaluate(() => {
      window.__app.profile.recordWin(47, 3, 5200, 3);
      window.__app.goto('map', { justWon: 47 });
    });
    await page.waitForSelector('.m-dialog-intro', { timeout: 9000 });
    ok(true, 'the win celebration ran and the next intro opened');
    await invariants(page, 'webview 80 / end');
  });

  await test('reduced motion: no celebration to wait for, everything still works', async () => {
    const { page } = await open(browser, { fakestore: '0', fast: '1', lang: 'en', save: saveParam(MID) }, { context: { reducedMotion: 'reduce' } });
    await tour(page, 'reduced motion');
    await page.evaluate(() => {
      const a = window.__app;
      a.ctx.nav.toPlay(47, {});
      a.profile.recordWin(47, 2, 5200, 3);
      a.ctx.nav.toMap({ justWon: 47 });
      a.ctx.nav.openLevelIntro(48);
    });
    await page.waitForSelector('.m-dialog-intro', { timeout: 5000 });
    eq(await page.locator('.k-overlay:not(.k-closing) .m-dialog-intro').count(), 1, 'the next intro opens at once — exactly one');
    ok(/48/.test(await page.locator('.m-dialog-intro .k-dialog__title').innerText()), 'for level 48');
    ok((await page.locator('.m-node[data-level="47"].m-node--done').count()) === 1, 'level 47 is shown as done');
    await invariants(page, 'reduced motion / after a win');
  });

  // ───────────────────────────── pause / resume ─────────────────────────────

  await test('pause and resume in the middle of everything', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fast: '1', lang: 'en', fakestore: '0' }, { init: L.androidBridge, initArg: JSON.stringify(saveData({ upTo: 46, coins: 3000, lives: 3, dailyDay: today, dailyStreak: 2 })) });
    const pause = () => page.evaluate(() => window.__native.pause());
    const resume = () => page.evaluate(() => window.__native.resume());
    const blink = async (where) => {
      await pause();
      await sleep(150);
      await resume();
      await sleep(150);
      await invariants(page, 'pause/resume ' + where);
    };
    // resume without a pause, pause twice, resume twice
    await resume();
    await pause();
    await pause();
    await resume();
    await resume();
    await invariants(page, 'odd pause / resume calls');
    await blink('on the title');
    // in the middle of the screen change
    await tap(page, '[data-act="play"]');
    await pause();
    await sleep(100);
    await resume();
    await waitScreen(page, 'map');
    await blink('on the map');
    ok(/^\d\d:\d\d$/.test(await page.locator('[data-act="lives"] .k-chip__text').innerText()), 'the lives countdown is running after the resume');
    // with each dialog open
    for (const act of ['lives', 'shop', 'daily', 'settings']) {
      await tap(page, '[data-act="' + act + '"]');
      await waitDialogs(page, 1);
      await blink('with ' + act + ' open');
      eq((await state(page)).dialogs, 1, act + ' is still open after a pause');
      await back(page);
      await waitDialogs(page, 0);
    }
    // paused while a dialog is open; the lives countdown in it goes on after the resume
    await tap(page, '[data-act="lives"]');
    await waitDialogs(page, 1);
    await pause();
    const frozen = await page.locator('.m-lives__clock').innerText();
    await sleep(2300);
    eq(await page.locator('.m-lives__clock').innerText(), frozen, 'paused: the countdown in the lives dialog stands still');
    await resume();
    await sleep(100);
    ok((await page.locator('.m-lives__clock').innerText()) !== frozen, 'resumed: it jumps to the real time at once');
    await back(page);
    await waitDialogs(page, 0);
    // during the win celebration
    await page.evaluate(() => {
      const a = window.__app;
      a.ctx.nav.toPlay(47, {});
      a.profile.recordWin(47, 3, 5200, 3);
      a.ctx.nav.toMap({ justWon: 47 });
    });
    await waitScreen(page, 'map');
    await sleep(500);
    await pause();
    await sleep(300);
    await resume();
    await page.waitForSelector('.m-dialog-intro', { timeout: 9000 });
    ok(true, 'a celebration interrupted by a pause still ends with the next intro');
    await blink('with the intro open');
    // into a level, pause while it builds, resume: it plays
    await tap(page, '[data-act="intro-play"]');
    await pause();
    await sleep(200);
    await resume();
    await waitScreen(page, 'play');
    await page.waitForFunction(() => window.__play.state() === 'play' && window.__play.loop().frozen === 0, null, { timeout: 15000 });
    ok(true, 'a level started across a pause runs');
    await blink('while playing');
    eq(await page.evaluate(() => window.__play.loop().frozen), 0, 'the level is not frozen after the resume');

    // THE CASE THAT FROZE EVERY LATER LEVEL: the level is left while the app is in the background
    // (an ad's result arriving before the resume) — the play screen never heard the resume.
    await pause();
    await page.evaluate(() => window.__app.ctx.nav.toMap({ focusLevel: 48 }));
    await resume();
    await waitScreen(page, 'map');
    await page.evaluate(() => window.__app.kit.closeAll());
    await page.evaluate(() => window.__app.goto('play', 48));
    await waitScreen(page, 'play');
    await page.waitForFunction(() => window.__play.state() === 'play', null, { timeout: 15000 }).catch(() => undefined);
    const loop = await page.evaluate(() => ({ state: window.__play.state(), frozen: window.__play.loop().frozen }));
    eq(loop.frozen, 0, 'a level left during a pause does not leave the next one frozen');
    eq(loop.state, 'play', 'the next level is playable');
    // the same with the level started while paused, and the first level ever created while paused
    await pause();
    await page.evaluate(() => window.__app.ctx.nav.toPlay(48, {}));
    await sleep(300);
    eq(await page.evaluate(() => window.__play.loop().frozen !== 0), true, 'a level started in the background waits');
    await resume();
    await page.waitForFunction(() => window.__play.state() === 'play' && window.__play.loop().frozen === 0, null, { timeout: 15000 });
    ok(true, 'and runs when the app comes back');
    await page.evaluate(() => window.__app.ctx.nav.toMap());
    await waitScreen(page, 'map');
    await invariants(page, 'after all the pauses');
  });

  await test('the play screen is created while the app is paused: it starts when the app returns', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', fast: '1', lang: 'en', fakestore: '0' }, { init: L.androidBridge, initArg: JSON.stringify(saveData(MID)) });
    await page.evaluate(() => {
      window.__native.pause();
      window.__app.ctx.nav.toPlay(47, {});
    });
    await waitScreen(page, 'play');
    await sleep(400);
    eq(await page.evaluate(() => window.__play.loop().frozen !== 0), true, 'created in the background: frozen');
    await page.evaluate(() => window.__native.resume());
    await page.waitForFunction(() => window.__play.state() === 'play' && window.__play.loop().frozen === 0, null, { timeout: 15000 });
    ok(true, 'resumed: it plays');
  });

  // ───────────────────────────── layout changes ─────────────────────────────

  await test('rotation and resizing: the map keeps its place, dialogs stay usable', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', lang: 'ar', fakestore: '0', screen: 'map', save: saveParam({ upTo: 46, coins: 123456, lives: 1, dailyDay: today, dailyStreak: 2 }) });
    const sizes = [
      [640, 360],
      [360, 640],
      [800, 1280],
      [1280, 800],
      [320, 480],
      [412, 915],
      [360, 640],
    ];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(500);
      const info = await page.evaluate(() => {
        const node = document.querySelector('.m-node--current');
        const top = document.querySelector('.m-top').getBoundingClientRect();
        const tray = document.querySelector('.m-tray').getBoundingClientRect();
        const play = document.querySelector('[data-act="map-play"]');
        const r = node ? node.getBoundingClientRect() : null;
        // (the raised Play button stands above the tray's top edge: the lower bound is whichever is higher)
        const trayTop = Math.min(tray.top, play ? play.getBoundingClientRect().top : Infinity);
        return { node: r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null, topBottom: top.bottom, trayTop, vw: window.innerWidth, vh: window.innerHeight, sections: document.querySelectorAll('.m-sec').length };
      });
      ok(!!info.node && info.node.bottom > info.topBottom && info.node.top < info.trayTop && info.node.left >= 0 && info.node.right <= info.vw, w + '×' + h + ': the current level is still on screen after the resize');
      eq(info.sections, 6, w + '×' + h + ': six sections');
      await invariants(page, 'resized to ' + w + '×' + h);
    }
    // with dialogs open
    for (const act of ['shop', 'settings', 'lives', 'daily']) {
      await tap(page, '[data-act="' + act + '"]');
      await waitDialogs(page, 1);
      for (const [w, h] of [
        [640, 360],
        [320, 480],
        [360, 640],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await sleep(350);
        const box = await page.evaluate(() => {
          const d = document.querySelector('.k-overlay:not(.k-closing) .k-dialog').getBoundingClientRect();
          const x = document.querySelector('.k-overlay:not(.k-closing) .k-dialog__x').getBoundingClientRect();
          return { left: d.left, right: d.right, top: d.top, bottom: d.bottom, xl: x.left, xr: x.right, xt: x.top, xb: x.bottom, vw: window.innerWidth, vh: window.innerHeight };
        });
        ok(box.left >= 0 && box.right <= box.vw && box.bottom <= box.vh + 1, act + ' at ' + w + '×' + h + ': the dialog is inside the screen');
        ok(box.xl >= 0 && box.xr <= box.vw && box.xt >= 0 && box.xb <= box.vh, act + ' at ' + w + '×' + h + ': its close button can be reached');
      }
      await tap(page, '.k-overlay:not(.k-closing) .k-dialog__x');
      await waitDialogs(page, 0);
    }
    await invariants(page, 'after the resizes');
  });

  // ───────────────────────────── navigation ─────────────────────────────

  await test('double taps on every way to navigate: one screen, one dialog', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', lang: 'en', fakestore: '0', fast: '1', save: saveParam(MID) });
    const doubleTap = async (selector) => {
      const box = await page.locator(selector).first().boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.touchscreen.tap(x, y);
      await page.touchscreen.tap(x, y);
    };
    const tripleTapSlow = async (selector) => {
      const box = await page.locator(selector).first().boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      for (let i = 0; i < 3; i++) {
        await page.touchscreen.tap(x, y);
        await sleep(130);
      }
    };
    await doubleTap('[data-act="settings"]');
    await sleep(700);
    eq((await state(page)).dialogs, 1, 'title: a double tap on settings opens one dialog');
    await back(page);
    await waitDialogs(page, 0);
    await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 3000 }); // a closed dialog shields taps for a moment
    await doubleTap('[data-act="play"]');
    await waitScreen(page, 'map');
    await sleep(400);
    eq(await page.locator('.m-stage > *').count(), 1, 'a double tap on Play: one map');
    eq((await state(page)).dialogs, 0, 'and nothing opened by the second tap');
    for (const act of ['lives', 'coins', 'settings', 'shop', 'daily']) {
      await doubleTap('[data-act="' + act + '"]');
      await sleep(800);
      eq((await state(page)).dialogs, 1, 'map: a double tap on ' + act + ' opens one dialog');
      await back(page);
      await waitDialogs(page, 0);
      // a closed dialog shields taps for a moment: the next taps must not land on that shield
      await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 3000 });
      await tripleTapSlow('[data-act="' + act + '"]');
      await sleep(800);
      ok((await state(page)).dialogs <= 1, 'map: three taps on ' + act + ' never stack dialogs');
      await page.evaluate(() => window.__app.kit.closeAll());
      await waitDialogs(page, 0);
      await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 3000 });
    }
    // the tray's Play: a double tap opens one intro, of the frontier level (no slow third tap here: the
    // intro's own Play stands right above it, and a deliberate tap there starts the level)
    await doubleTap('[data-act="map-play"]');
    await sleep(800);
    eq((await state(page)).dialogs, 1, 'map: a double tap on the tray\'s Play opens one dialog');
    eq(await page.locator('.m-dialog-intro .k-dialog__title').innerText(), 'Level 47', 'the intro of the level the journey has reached');
    await back(page);
    await waitDialogs(page, 0);
    await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 3000 });
    await doubleTap('.m-node[data-level="47"]');
    await sleep(800);
    eq((await state(page)).dialogs, 1, 'a double tap on a level opens one intro');
    await doubleTap('[data-act="intro-play"]');
    await waitScreen(page, 'play');
    await sleep(500);
    eq(await page.locator('.m-stage > *').count(), 1, 'a double tap on Play in the intro: one level');
    await page.evaluate(() => window.__app.ctx.nav.toMap());
    await waitScreen(page, 'map');
    await doubleTap('[data-act="home"]');
    await waitScreen(page, 'title');
    await sleep(400);
    eq((await state(page)).dialogs, 0, 'a double tap on Home lands on the title without opening settings or starting a level');
    await invariants(page, 'after the double taps');
  });

  await test('a storm of navigation calls ends in a consistent state', async () => {
    const { page } = await open(browser, { mocklevels: '120', gate: 'off', lang: 'en', fast: '1', fakestore: '0' }, { init: L.androidBridge, initArg: JSON.stringify(saveData(MID)) });
    for (let round = 0; round < 6; round++) {
      await page.evaluate((seed) => {
        const a = window.__app;
        const nav = a.ctx.nav;
        let s = seed;
        const rnd = () => {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          return s / 0x7fffffff;
        };
        const actions = [
          () => nav.toMap(),
          () => nav.toMap({ focusLevel: 1 + Math.floor(rnd() * 120) }),
          () => nav.toMap({ justWon: 1 + Math.floor(rnd() * 46) }),
          () => nav.toMap({ justWon: 9999 }),
          () => nav.openLevelIntro(1 + Math.floor(rnd() * 50)),
          () => nav.openLevelIntro(-3),
          () => nav.toPlay(1 + Math.floor(rnd() * 47), {}),
          () => nav.toPlay(100000, {}),
          () => void nav.openShop(),
          () => void nav.openSettings(),
          () => void a.shell.ui.openLives(),
          () => void a.shell.ui.openDaily(),
          () => a.shell.goTitle(),
          () => a.shell.handleBack(),
          () => a.kit.closeAll(),
          () => a.kit.closeTop(),
          () => window.__native.pause(),
          () => window.__native.resume(),
          () => a.ctx.i18n.setLang(rnd() < 0.5 ? 'ar' : 'en'),
        ];
        for (let i = 0; i < 60; i++) actions[Math.floor(rnd() * actions.length)]();
        window.__native.resume();
      }, 1000 + round * 77);
      await sleep(900);
      await page.evaluate(() => window.__app.kit.closeAll());
      await sleep(500);
      await invariants(page, 'storm round ' + (round + 1));
    }
    // and it still answers a finger
    await page.evaluate(() => {
      window.__app.ctx.i18n.setLang('en');
      window.__app.goto('map');
    });
    await waitScreen(page, 'map');
    await sleep(900);
    await page.evaluate(() => window.__app.kit.closeAll());
    await sleep(500);
    await tap(page, '[data-act="shop"]');
    await waitDialogs(page, 1);
    await back(page);
    await tap(page, '[data-act="home"]');
    await waitScreen(page, 'title');
    await invariants(page, 'after the storm');
  });

  // ───────────────────────────── memory ─────────────────────────────

  await test('memory: entering and leaving the map 50 times leaves nothing behind', async () => {
    const { context, page } = await open(browser, { gate: 'off', lang: 'en', fakestore: '0', still: '1', save: saveParam({ upTo: 46, coins: 3000, lives: 3, dailyDay: today, dailyStreak: 2 }) });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const sample = async () => {
      for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
      const { metrics } = await cdp.send('Performance.getMetrics');
      const get = (name) => metrics.filter((m) => m.name === name)[0].value;
      const dom = await page.evaluate(() => ({ all: document.querySelectorAll('*').length, body: document.body.children.length, stage: document.querySelectorAll('.m-stage > *').length, canvases: document.querySelectorAll('canvas').length }));
      return { heap: get('JSHeapUsedSize'), nodes: get('Nodes'), listeners: get('JSEventListeners'), dom };
    };
    /**
     * `base` given: the closing dialogs and departed screens are let go a little after they leave
     * (exit animations, tap shields, timers; measured: the listener count is back to its baseline
     * within about 3 s of a dialog storm), so the reading is repeated — garbage collected each time —
     * until the listener count is back within reach of `base` or has stopped falling, for at most
     * 6 s. A real leak never comes back down, so it still fails.
     */
    const measure = async (base) => {
      await sleep(600); // screens leave the document after their fade
      let m = await sample();
      if (!base) return m;
      const until = Date.now() + 6000;
      let last = Infinity;
      while (m.listeners - base.listeners > 6 && Date.now() < until) {
        if (m.listeners >= last && m.listeners - base.listeners > 6 && Date.now() > until - 3000) break; // stuck: a leak
        last = Math.min(last, m.listeners);
        await sleep(500);
        m = await sample();
      }
      return m;
    };
    /** One round trip: title → map (scroll a little, open and close the intro) → title. */
    const cycle = () =>
      page.evaluate(async () => {
        const a = window.__app;
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        a.ctx.nav.toMap();
        await frame();
        const sc = document.querySelector('.m-map__scroll');
        if (sc) sc.scrollTop = Math.max(0, sc.scrollTop - 400);
        await frame();
        a.ctx.nav.openLevelIntro(47);
        await new Promise((r) => setTimeout(r, 30));
        a.kit.closeAll();
        a.shell.goTitle();
        await frame();
        await new Promise((r) => setTimeout(r, 30));
      });
    for (let i = 0; i < 8; i++) await cycle(); // warm-up: sprite caches fill, the code gets compiled
    const before = await measure();
    for (let i = 0; i < 50; i++) await cycle();
    const after = await measure(before);
    const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
    console.log(
      '    50 round trips: heap ' + mb(before.heap) + ' → ' + mb(after.heap) + ' · DOM nodes (incl. detached) ' + before.nodes + ' → ' + after.nodes + ' · listeners ' + before.listeners + ' → ' + after.listeners +
        ' · elements in the document ' + before.dom.all + ' → ' + after.dom.all,
    );
    eq(after.dom.all, before.dom.all, 'the document holds the same number of elements');
    eq(after.dom.stage, 1, 'one screen mounted');
    eq(after.dom.body, before.dom.body, 'no layer left on <body>');
    ok(after.listeners - before.listeners <= 6, 'no event listeners pile up (' + (after.listeners - before.listeners) + ' more)');
    ok(after.nodes - before.nodes <= 400, 'no detached DOM piles up (' + (after.nodes - before.nodes) + ' more nodes; one map is some 600)');
    ok(after.heap - before.heap <= 2.5 * 1048576, 'the heap does not grow (' + mb(after.heap - before.heap) + ' after 50 maps; one leaked map with its backdrop would be far more)');
    // the same for 30 language switches on the map and 20 rounds of every dialog
    await page.evaluate(() => window.__app.goto('map'));
    await waitScreen(page, 'map');
    const before2 = await measure();
    await page.evaluate(async () => {
      const a = window.__app;
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 30; i++) {
        a.ctx.i18n.setLang(i % 2 === 0 ? 'ar' : 'en');
        await pause(20);
      }
      a.ctx.i18n.setLang('en');
      for (let i = 0; i < 20; i++) {
        void a.ctx.nav.openShop();
        void a.ctx.nav.openSettings();
        void a.shell.ui.openLives();
        void a.shell.ui.openDaily();
        a.ctx.nav.openLevelIntro(47);
        await pause(20);
        a.kit.closeAll();
        await pause(20);
      }
      await pause(500);
    });
    const after2 = await measure(before2);
    console.log('    30 language switches + 20 × every dialog: heap ' + mb(before2.heap) + ' → ' + mb(after2.heap) + ' · listeners ' + before2.listeners + ' → ' + after2.listeners + ' · elements ' + before2.dom.all + ' → ' + after2.dom.all);
    eq(after2.dom.all, before2.dom.all, 'language switches and dialogs: the same number of elements');
    ok(after2.listeners - before2.listeners <= 6, 'no listeners pile up (' + (after2.listeners - before2.listeners) + ' more)');
    ok(after2.heap - before2.heap <= 2.5 * 1048576, 'the heap does not grow (' + mb(after2.heap - before2.heap) + ')');
  });
}

async function main() {
  const browser = await chromium.launch();
  let server = null;
  try {
    console.log('robustness (' + L.BASE + ')');
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

void SAVE_KEY;
main();
