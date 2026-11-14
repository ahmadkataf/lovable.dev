/**
 * Monkey test of the whole game shell: 1,500 random actions — taps anywhere, taps on whatever can
 * be pressed, double taps, swipes, Back presses, language switches, pause / resume, rotations —
 * across every screen and dialog, on the real levels, with the test store switched on (its
 * purchase sheets and ads get tapped too). The page runs as a browser page (the test store refuses
 * to exist next to an Android bridge), so Back is the Escape key, pause / resume come from the
 * page-visibility events, and what the shell tells the wrapper about "at root" is recorded by
 * wrapping the platform's setAtRoot.
 *
 *   node tests/e2e/meta-monkey.cjs              seed 1
 *   node tests/e2e/meta-monkey.cjs 7 8 9        one run per seed
 *   META_ACTIONS=5000 node tests/e2e/meta-monkey.cjs 3
 *
 * Fails on any console error, uncaught exception, unhandled rejection or CSP violation, and when
 * an invariant breaks on the way (checked every 10 actions): coins and lives sane, one screen
 * mounted, the page direction matching the language, the kit and the DOM agreeing about dialogs,
 * and — the one that closes the app or traps the player when wrong — the wrapper's "at root" flag
 * being exactly "title screen with nothing open". Every 50 actions the monkey is carried to the
 * next place of a fixed tour, so no screen or dialog is left out. Port 5185 (see meta-lib.cjs).
 */
const { chromium } = require('playwright');
const L = require('./meta-lib.cjs');

const run = L.createRunner('meta-monkey.cjs');
const { ok, eq, test, open } = run;
const { sleep, saveData, today } = L;

const ACTIONS = Number(process.env.META_ACTIONS || 1500);

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** The places the monkey is carried to, one every 50 actions (window.__app.goto and friends). */
const TOUR = [
  (a) => a.goto('map'),
  (a) => a.goto('intro', a.profile.highestUnlocked()),
  (a) => a.goto('shop'),
  (a) => a.goto('title'),
  (a) => a.goto('settings'),
  (a) => a.goto('play', a.profile.highestUnlocked()),
  (a) => {
    a.goto('map');
    a.goto('lives');
  },
  (a) => {
    a.goto('map');
    a.goto('daily');
  },
  (a) => {
    // a win, the way the play screen reports it
    const id = a.profile.highestUnlocked();
    a.ctx.nav.toPlay(id, {});
    a.profile.recordWin(id, 3, 5000, 2);
    a.ctx.nav.toMap({ justWon: id });
    a.ctx.nav.openLevelIntro(id + 1);
  },
  (a) => {
    a.goto('map');
    a.goto('shop');
  },
  (a) => a.goto('play', Math.max(1, a.profile.highestUnlocked() - 3)),
  (a) => {
    // out of lives, low on coins
    while (a.profile.lives().count > 0) a.profile.loseLife();
    a.goto('map');
    a.goto('intro', a.profile.highestUnlocked());
  },
  (a) => {
    a.goto('title');
    a.goto('settings');
  },
  (a) => {
    a.profile.grant([{ kind: 'lives' }]);
    a.goto('map');
  },
  (a) => a.goto('play', a.profile.highestUnlocked()),
  (a) => {
    // the shop, scrolled to a random place (offers, coin packs, free coins, boosters)
    a.goto('map');
    a.goto('shop');
    setTimeout(() => {
      const body = document.querySelector('.m-dialog-shop .k-dialog__body');
      if (body) body.scrollTop = (body.scrollHeight - body.clientHeight) * Math.random();
    }, 200);
  },
  (a) => {
    a.goto('map');
    a.goto('unlock', 'prism');
  },
  (a) => {
    // settings with the legal texts on top
    a.goto('title');
    a.goto('settings');
    setTimeout(() => {
      const row = document.querySelector('[data-act="privacy"]');
      if (row) row.click();
    }, 400);
  },
  (a) => {
    // the first level again, as a replay
    a.goto('map', { focusLevel: 1 });
    a.goto('intro', 1);
  },
];

/** Page init: the save in localStorage, the tour, and a switch for the page-visibility state. */
function pageInit(arg) {
  try {
    localStorage.setItem('match3.save.v1', arg.save);
  } catch (e) {
    // the run will notice
  }
  let hidden = false;
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible'), configurable: true });
  window.__setHidden = (value) => {
    if (hidden === value) return;
    hidden = value;
    document.dispatchEvent(new Event('visibilitychange'));
  };
}

async function monkey(browser, seed) {
  const rnd = rng(seed);
  const pick = (n) => Math.floor(rnd() * n);
  const data = saveData({ upTo: 46, coins: 20000, lives: 5, dailyDay: today - 1, dailyStreak: 3, caravan: 1 });
  // the tour steps live in the page (functions cannot be passed by value)
  const init = new Function('arg', 'window.__tourSteps = [' + TOUR.map((fn) => fn.toString()).join(',') + '];\n(' + pageInit.toString() + ')(arg);');
  const { page } = await open(browser, { fakestore: '1', fast: '1', seed: String(seed) }, { init, initArg: { save: JSON.stringify(data) }, context: { viewport: { width: 360, height: 640 } } });
  await page.waitForFunction(() => window.__app.store.iapAvailable(), null, { timeout: 8000 });
  // record what the shell tells the wrapper from now on (it has said "at root" for the title already)
  await page.evaluate(() => {
    const calls = { atRoot: [window.__app.shell.atRoot()] };
    window.__bridgeCalls = calls;
    window.__app.ctx.platform.setAtRoot = (v) => {
      calls.atRoot.push(v);
    };
  });
  let size = { w: 360, h: 640 };
  const stats = { tap: 0, press: 0, double: 0, swipe: 0, back: 0, lang: 0, pause: 0, rotate: 0, carried: 0 };
  const seen = { screens: {}, dialogs: {}, sheets: 0 };
  const start = await page.evaluate(() => ({ coins: window.__app.profile.coins(), frontier: window.__app.profile.highestUnlocked() }));
  let broken = 0;

  const check = async (i) => {
    const got = await page.evaluate(() => {
      const a = window.__app;
      const lives = a.profile.lives();
      const calls = window.__bridgeCalls.atRoot;
      const boosters = a.profile.data().boosters;
      return {
        screen: a.shell.current(),
        mounted: document.querySelectorAll('.m-stage > *').length,
        root: a.shell.atRoot(),
        truth: a.shell.current() === 'title' && !a.kit.hasOverlay(),
        told: calls[calls.length - 1],
        coins: a.profile.coins(),
        lives: lives.count,
        max: lives.max,
        next: lives.nextInMs,
        boostersOk: Object.keys(boosters).every((k) => Number.isInteger(boosters[k]) && boosters[k] >= 0),
        lang: a.ctx.i18n.lang(),
        dir: document.documentElement.getAttribute('dir'),
        htmlLang: document.documentElement.getAttribute('lang'),
        overlays: document.querySelectorAll('.k-overlay:not(.k-closing)').length,
        has: a.kit.hasOverlay(),
        dialogs: Array.from(document.querySelectorAll('.k-overlay:not(.k-closing) .k-dialog')).map((n) => (n.getAttribute('data-dialog') || (/m-dialog-(\w+)/.exec(n.className) || [])[1] || 'other')),
        sheet: document.querySelectorAll('[data-testid="fake-store"], [data-testid="fake-ad"], [data-testid="fake-privacy"]').length,
        currentNodes: document.querySelectorAll('.m-node--current').length,
        sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    seen.screens[got.screen] = (seen.screens[got.screen] || 0) + 1;
    for (const d of got.dialogs) seen.dialogs[d] = (seen.dialogs[d] || 0) + 1;
    seen.sheets += got.sheet;
    const fail = (what) => {
      broken++;
      if (broken <= 12) ok(false, 'after action ' + i + ' (seed ' + seed + '): ' + what + '  ' + JSON.stringify({ screen: got.screen, dialogs: got.dialogs, lang: got.lang }));
    };
    if (!(got.screen === 'title' || got.screen === 'map' || got.screen === 'play')) fail('not on a screen');
    if (got.mounted < 1 || got.mounted > 2) fail(got.mounted + ' screens mounted');
    if (got.root !== got.truth) fail('atRoot() is ' + got.root + ' but the truth is ' + got.truth);
    if (got.told !== got.truth) fail('the wrapper was told atRoot=' + got.told + ' but the truth is ' + got.truth);
    if (!(Number.isInteger(got.coins) && got.coins >= 0)) fail('coins = ' + got.coins);
    if (!(got.lives >= 0 && got.lives <= got.max && got.next >= 0 && got.next <= 30 * 60000)) fail('lives = ' + got.lives + ', next in ' + got.next);
    if (!got.boostersOk) fail('a booster count is not a whole number ≥ 0');
    if (got.dir !== (got.lang === 'ar' ? 'rtl' : 'ltr') || got.htmlLang !== got.lang) fail('direction ' + got.dir + ' / lang ' + got.htmlLang + ' for language ' + got.lang);
    if (got.overlays > 0 !== got.has) fail('kit.hasOverlay() = ' + got.has + ' with ' + got.overlays + ' dialogs in the DOM');
    if (got.currentNodes > 1) fail(got.currentNodes + ' current levels on the map');
    if (got.sideScroll) fail('the page scrolls sideways');
    return got;
  };

  /** A random thing that can be pressed right now (topmost at its centre), as a point. */
  const pressable = () =>
    page.evaluate((r) => {
      const list = [];
      const nodes = document.querySelectorAll('button, [role="radio"], [role="switch"], [data-testid^="fake-"]');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (el.disabled) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 4 || b.height < 4) continue;
        const x = b.left + b.width / 2;
        const y = b.top + b.height / 2;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (top && (top === el || el.contains(top))) list.push({ x, y });
      }
      return list.length ? list[Math.floor(r * list.length)] : null;
    }, rnd());

  for (let i = 1; i <= ACTIONS; i++) {
    const r = rnd();
    try {
      if (r < 0.56) {
        stats.tap++;
        await page.touchscreen.tap(2 + pick(size.w - 4), 2 + pick(size.h - 4));
      } else if (r < 0.74) {
        stats.press++;
        const p = await pressable();
        if (p) await page.touchscreen.tap(p.x, p.y);
      } else if (r < 0.78) {
        stats.double++;
        const x = 2 + pick(size.w - 4);
        const y = 2 + pick(size.h - 4);
        await page.touchscreen.tap(x, y);
        await page.touchscreen.tap(x, y);
      } else if (r < 0.85) {
        stats.swipe++;
        const x = 20 + pick(size.w - 40);
        const y = 60 + pick(size.h - 120);
        const dx = pick(3) === 0 ? 0 : (pick(2) ? 1 : -1) * (30 + pick(60));
        const dy = dx === 0 || pick(2) ? (pick(2) ? 1 : -1) * (30 + pick(200)) : 0;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 2 });
        await page.mouse.move(x + dx, y + dy, { steps: 2 });
        await page.mouse.up();
      } else if (r < 0.895) {
        stats.back++;
        // at the root the SYSTEM handles Back: the app goes to the background and comes back later
        const atRoot = await page.evaluate(() => {
          const calls = window.__bridgeCalls.atRoot;
          if (calls[calls.length - 1] === false) return false;
          window.__setHidden(true);
          window.__setHidden(false);
          return true;
        });
        if (!atRoot) await page.keyboard.press('Escape');
      } else if (r < 0.93) {
        stats.lang++;
        // the same two calls the language control of the settings makes
        await page.evaluate(() => {
          const a = window.__app;
          const next = a.ctx.i18n.lang() === 'ar' ? 'en' : 'ar';
          a.profile.setSetting('lang', next);
          a.ctx.i18n.setLang(next);
        });
      } else if (r < 0.98) {
        stats.pause++;
        await page.evaluate(() => window.__setHidden(true));
        if (pick(2)) await sleep(pick(120));
        await page.evaluate(() => window.__setHidden(false));
      } else {
        stats.rotate++;
        size = size.w === 360 ? { w: 640, h: 360 } : { w: 360, h: 640 };
        await page.setViewportSize({ width: size.w, height: size.h });
      }
    } catch (err) {
      ok(false, 'action ' + i + ' (seed ' + seed + ') threw: ' + String(err && err.message ? err.message : err).split('\n')[0]);
      break;
    }
    if (i % 10 === 0) await check(i);
    if (i % 50 === 0) {
      // carried on to the next place of the tour (whatever is open is closed first, an ad included)
      stats.carried++;
      const step = (i / 50 - 1) % TOUR.length;
      await page.evaluate(async () => {
        const fake = document.querySelector('[data-testid="fake-ad-skip"], [data-testid="fake-ad-close"], [data-testid="fake-cancel"], [data-testid="fake-privacy-close"]');
        if (fake) {
          const all = document.querySelectorAll('[data-testid="fake-ad-skip"], [data-testid="fake-ad-close"], [data-testid="fake-cancel"], [data-testid="fake-privacy-close"]');
          for (let k = 0; k < all.length; k++) if (all[k].style.display !== 'none') all[k].click();
          await new Promise((res) => setTimeout(res, 50));
        }
        window.__app.kit.closeAll();
      });
      await sleep(60);
      await page.evaluate((index) => window.__tourSteps[index](window.__app), step);
      await sleep(450);
      await check(i + ' (carried to place ' + (step + 1) + ')');
    }
  }

  // ── the end: everything closed, the app must still be whole and answer a finger ──
  await page.evaluate(async () => {
    window.__setHidden(false);
    for (let round = 0; round < 6; round++) {
      const all = document.querySelectorAll('[data-testid="fake-ad-skip"], [data-testid="fake-ad-close"], [data-testid="fake-cancel"], [data-testid="fake-privacy-close"]');
      for (let k = 0; k < all.length; k++) if (all[k].style.display !== 'none') all[k].click();
      await new Promise((res) => setTimeout(res, 120));
    }
    const a = window.__app;
    a.kit.closeAll();
    a.profile.setSetting('lang', 'en');
    a.ctx.i18n.setLang('en');
    a.goto('map');
  });
  if (size.w !== 360) await page.setViewportSize({ width: 360, height: 640 });
  await L.waitScreen(page, 'map');
  await sleep(1200);
  await page.evaluate(() => window.__app.kit.closeAll());
  await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 5000 });
  await sleep(400);
  const end = await check('the end');
  eq(end.mounted, 1, 'seed ' + seed + ': at rest one screen is mounted');
  eq(end.overlays, 0, 'seed ' + seed + ': no dialog is left');
  eq(broken, 0, 'seed ' + seed + ': no invariant broke during ' + ACTIONS + ' actions');
  await L.tap(page, '[data-act="settings"]');
  await L.waitDialogs(page, 1);
  await L.back(page);
  await L.waitDialogs(page, 0);
  await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 5000 });
  const level = await page.evaluate(() => window.__app.profile.highestUnlocked());
  await page.evaluate((id) => {
    window.__app.profile.grant([{ kind: 'lives' }]);
    window.__app.goto('play', id);
  }, level);
  await L.waitScreen(page, 'play');
  await page.waitForFunction(() => window.__play.state() === 'play' && window.__play.loop().frozen === 0, null, { timeout: 20000 });
  ok(true, 'seed ' + seed + ': a level still starts and runs');
  await page.evaluate(() => window.__app.ctx.nav.toMap());
  await L.waitScreen(page, 'map');
  await page.evaluate(() => window.__app.kit.closeAll());
  await page.waitForSelector('.k-overlay', { state: 'detached', timeout: 5000 });
  await L.tap(page, '[data-act="home"]');
  await L.waitScreen(page, 'title');
  eq(await page.evaluate(() => window.__bridgeCalls.atRoot[window.__bridgeCalls.atRoot.length - 1]), true, 'seed ' + seed + ': on the title the wrapper is told "at root"');
  const final = await page.evaluate(() => ({ coins: window.__app.profile.coins(), frontier: window.__app.profile.highestUnlocked(), rootCalls: window.__bridgeCalls.atRoot.length }));
  // every screen and the main dialogs were really visited
  for (const s of ['title', 'map', 'play']) ok((seen.screens[s] || 0) > 0, 'seed ' + seed + ': the monkey was on the ' + s + ' screen');
  for (const d of ['intro', 'shop', 'settings', 'lives', 'daily']) ok((seen.dialogs[d] || 0) > 0, 'seed ' + seed + ': the monkey met the ' + d + ' dialog');
  console.log(
    '    seed ' + seed + ': ' + ACTIONS + ' actions — ' + Object.keys(stats).map((k) => stats[k] + ' ' + k).join(', ') +
      '\n      screens at the checks: ' + JSON.stringify(seen.screens) + ' · dialogs: ' + JSON.stringify(seen.dialogs) + ' · store sheets / ads seen: ' + seen.sheets +
      '\n      coins ' + start.coins + ' → ' + final.coins + ' · level ' + start.frontier + ' → ' + final.frontier + ' · at-root changes sent: ' + final.rootCalls,
  );
}

async function main() {
  const seeds = process.argv.slice(2).map(Number).filter((n) => n > 0);
  if (seeds.length === 0) seeds.push(Number(process.env.META_SEED || 1));
  const browser = await chromium.launch();
  let server = null;
  try {
    console.log('monkey (' + L.BASE + ')');
    server = await L.quietDevServer();
    for (const seed of seeds) {
      await test(ACTIONS + ' random actions, seed ' + seed, () => monkey(browser, seed));
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
