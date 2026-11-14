/**
 * The play screen inside the REAL app (src/main.ts: shell, levels, profile, store) — not the
 * harness. Driven with real pointer events through the debug hooks of a dev build:
 *   /?debug=1&fast=1&seed=N&lang=ar|en    window.__app.goto('play', level)    window.__play
 *
 *   npx vite --port 5184 --strictPort            (in another terminal)
 *   node tests/e2e/play-app.cjs
 *
 * Covers what only the integration can show: a level won and left through the shell (map + the
 * next level's intro), a level lost and given up (one life, back on the map), the Back button
 * through the shell at every stage, the app pausing while a level is left (the next level must not
 * start frozen), a level abandoned by closing the app (its life is charged at the next start),
 * Arabic / RTL, and picture = engine after every move. Fails on any console error or warning.
 */
const { chromium } = require('playwright');
const H = require('./play-harness.cjs');

const ORIGIN = (process.env.PLAY_URL || 'http://127.0.0.1:5184/play-demo.html').replace(/play-demo\.html.*$/, '');
const problems = [];
let checks = 0;

function ok(cond, what) {
  checks++;
  if (!cond) throw new Error('FAILED: ' + what);
}
function eq(actual, expected, what) {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`FAILED: ${what} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function openApp(context, query, tag) {
  const page = await context.newPage();
  // no hot reload while the test runs (other people edit this tree) — see play-harness.cjs
  await page.route('**/@vite/client', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const sheets = new Map();
export function updateStyle(id, content) { let s = sheets.get(id); if (!s) { s = document.createElement('style'); s.setAttribute('data-vite-dev-id', id); document.head.appendChild(s); sheets.set(id, s); } s.textContent = content; }
export function removeStyle(id) { const s = sheets.get(id); if (s) { s.remove(); sheets.delete(id); } }
export function createHotContext() { const n = () => {}; return { data: {}, accept: n, acceptExports: n, dispose: n, prune: n, invalidate: n, on: n, off: n, send: n }; }
export function injectQuery(url) { return url; }
export class ErrorOverlay {}`,
    }),
  );
  page.on('console', (m) => {
    const type = m.type();
    if (type === 'error' || type === 'warning') problems.push(`${tag} console.${type}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`));
  await page.goto(`${ORIGIN}?debug=1&fast=1&fakestore=0&${query}`);
  await page.waitForFunction(() => window.__app && window.__booted, null, { timeout: 30000 });
  return page;
}

const profile = (page) =>
  page.evaluate(() => {
    const p = window.__app.profile;
    const d = p.data();
    return { coins: p.coins(), lives: p.lives().count, levels: Object.keys(d.levels).length, played: d.stats.played };
  });
const screen = (page) => page.evaluate(() => window.__app.shell.current());
const back = (page) => page.evaluate(() => window.__app.shell.handleBack());
const noOverlay = (page) => page.waitForFunction(() => !document.querySelector('.k-overlay'), null, { timeout: 8000 });

async function enter(page, level) {
  await page.evaluate((id) => window.__app.goto('play', id), level);
  await page.waitForFunction((id) => window.__play && window.__play.level() === id, level, { timeout: 10000 });
  // a level with something new opens with its tip
  await page.waitForFunction(() => window.__play.isIdle() || document.querySelector('.k-dialog[data-pl="tip"]'), null, { timeout: 15000 });
  if (await page.locator('.k-dialog[data-pl="tip"]').count()) {
    await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="tip"]');
    await page.click('.k-dialog[data-pl="tip"] [data-action="ok"]');
  }
  try {
    await H.idle(page, 15000);
  } catch (err) {
    const what = await page.evaluate(() => ({
      state: window.__play.state(),
      idle: window.__play.isIdle(),
      loop: window.__play.loop(),
      screen: window.__app.shell.current(),
      overlays: Array.prototype.map.call(document.querySelectorAll('.k-overlay'), (o) => o.className + ' | ' + ((o.querySelector('.k-dialog') || {}).className || '') + ' | ' + ((o.querySelector('.k-dialog__title') || {}).textContent || '')),
    }));
    throw new Error('level ' + level + ' did not become idle: ' + JSON.stringify(what));
  }
}

/** The renderer's model must equal the engine's snapshot (ids on cells, kinds, at rest). */
async function pictureIsEngine(page, where) {
  await page.waitForFunction(() => !window.__play.isIdle() || window.__play.loop().tweens === 0, null, { timeout: 8000 }).catch(() => undefined);
  const errs = await page.evaluate(() => {
    const p = window.__play;
    if (!p.isIdle() || p.loop().tweens !== 0) return null;
    const s = p.snapshot();
    const m = p.model();
    const out = [];
    const byId = new Map(m.pieces.map((x) => [x.id, x]));
    for (let i = 0; i < s.cells.length; i++) {
      const piece = s.cells[i].exists ? s.cells[i].piece : null;
      if (!piece) {
        if (m.grid[i] !== -1) out.push('ghost on cell ' + i);
        continue;
      }
      const v = byId.get(piece.id);
      if (!v || m.grid[i] !== piece.id || v.kind !== piece.kind || v.color !== piece.color || v.hp !== piece.hp || v.chained !== piece.chained) out.push('cell ' + i + ' differs');
      else if (v.dying || Math.abs(v.sx - 1) > 0.005 || Math.abs(v.ox) > 0.005 || Math.abs(v.oy) > 0.005 || v.lift || v.flash > 0.005) out.push('cell ' + i + ' not at rest');
      if (m.sand[i] !== s.cells[i].sand) out.push('sand on cell ' + i);
    }
    if (Number(document.querySelector('.pl-moves__n').textContent) !== s.movesLeft) out.push('header moves');
    if (Number(document.querySelector('.pl-score__n').textContent.replace(/[^\d]/g, '')) !== s.score) out.push('header score');
    return out.slice(0, 6);
  });
  if (errs) eq(errs, [], where + ': picture = engine');
}

/** Play with real swipes until the level leaves 'play'. `pick`: which valid move to take. */
async function play(page, max, pick) {
  for (let i = 0; i < max; i++) {
    await H.settled(page);
    if ((await H.state(page)) !== 'play') return;
    const m = await page.evaluate((how) => {
      const p = window.__play;
      if (how === 'best') return p.hint();
      const all = p.validMoves();
      return all[all.length - 1] || p.hint();
    }, pick);
    if (!m) return;
    await H.turn(page, () => H.swipe(page, m.a, m.b));
    if ((await H.state(page)) === 'play') await pictureIsEngine(page, 'move ' + (i + 1));
  }
}

async function section(name, fn) {
  const t0 = Date.now();
  await fn();
  console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

(async () => {
  const browser = await chromium.launch();
  let failed = null;
  try {
    for (const lang of ['en', 'ar']) {
      await section(`[${lang}] win → Next: map and the next level's intro; lose → give up: one life; Back at every stage`, async () => {
        const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
        const page = await openApp(context, `lang=${lang}&seed=7&gate=off&screen=map`, `[app ${lang}]`);
        // a player who has cleared 30 levels and owns boosters
        await page.evaluate(() => {
          const p = window.__app.profile;
          for (let i = 1; i <= 30; i++) p.recordWin(i, 2, 1000, 0);
          if (p.claimUnlocks) p.claimUnlocks(); // the booster gifts of those levels, without their dialogs
          p.addBooster('hammer', 2);
        });
        eq(await page.evaluate(() => document.documentElement.dir), lang === 'ar' ? 'rtl' : 'ltr', 'page direction');
        const before = await profile(page);

        // ── a level played to the win ──
        await enter(page, 3);
        eq(await screen(page), 'play', 'the shell shows the play screen');
        const box = await page.evaluate(() => {
          const r = (sel) => document.querySelector(sel).getBoundingClientRect();
          return { pause: r('.pl-pause').left, goals: r('.pl-goals').left, score: r('.pl-score').left };
        });
        ok(lang === 'ar' ? box.pause < box.goals : box.pause > box.goals, 'the header is mirrored in Arabic only');
        await pictureIsEngine(page, 'level start');

        // Back: pause dialog; Back again closes it; the game goes on
        ok(await back(page), 'Back is consumed in play');
        await page.waitForSelector('.k-dialog[data-pl="pause"]');
        ok((await page.evaluate(() => window.__play.loop().frozen)) !== 0, 'frozen behind the pause dialog');
        ok(await back(page), 'Back closes the pause dialog');
        await noOverlay(page);
        eq(await page.evaluate(() => window.__play.loop().frozen), 0, 'running again');
        eq(await screen(page), 'play', 'still in the level');

        // Back while a booster is aiming cancels the aiming, nothing else
        await page.click('[data-booster="hammer"] button');
        await page.waitForSelector('.pl-target');
        ok(await back(page), 'Back is consumed while targeting');
        eq(await page.locator('.pl-target').count(), 0, 'targeting cancelled');
        eq(await page.locator('.k-overlay.k-open').count(), 0, 'and no dialog opened');

        await play(page, 80, 'best');
        await page.waitForFunction(() => ['finale', 'won'].includes(window.__play.state()), null, { timeout: 30000 });
        await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="win"]:not(.pl-locked)', { timeout: 20000 });
        const afterWin = await profile(page);
        eq(afterWin.lives, before.lives, 'winning costs no life');
        ok(afterWin.coins >= before.coins, 'coins never go down on a win');
        await page.click('[data-action="next"]');
        await page.waitForFunction(() => window.__app.shell.current() === 'map', null, { timeout: 8000 });
        eq(await page.evaluate(() => window.__play.state()), 'none', 'the play screen stopped');
        const rest = await page.evaluate(() => window.__play.loop());
        eq([rest.running, rest.tweens, rest.timers, rest.dialogs, rest.frozen], [false, 0, 0, 0, 0], 'nothing of the level left running');
        // the shell follows up with the next level's intro (after the map's celebration); entering a level closes whatever is up
        await page.waitForSelector('.k-overlay.k-open .k-dialog', { timeout: 15000 });

        // ── a level played badly to the loss, then given up ──
        await enter(page, 30);
        const lives0 = (await profile(page)).lives;
        await play(page, 80, 'worst');
        const st = await H.state(page);
        if (st === 'lost') {
          await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="lose"]:not(.pl-locked)', { timeout: 10000 });
          ok(await back(page), 'Back is consumed on the lose dialog');
          await page.waitForTimeout(150);
          eq(await page.locator('.k-dialog[data-pl="lose"]').count(), 1, 'Back does not dismiss the lose dialog');
          eq((await profile(page)).lives, lives0, 'no life is taken while the dialog still offers to continue');
          await page.click('[data-action="giveUp"]');
          await page.waitForFunction(() => window.__app.shell.current() === 'map', null, { timeout: 8000 });
          eq((await profile(page)).lives, lives0 - 1, 'giving up cost exactly one life');
        } else {
          // (the worst moves happened to win it) leave through the dialog
          await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="win"]:not(.pl-locked)', { timeout: 20000 });
          await page.click('[data-action="map"]');
          await page.waitForFunction(() => window.__app.shell.current() === 'map', null, { timeout: 8000 });
        }

        // ── quit through pause after a move: confirm, one life, the map ──
        await enter(page, 12);
        const lives1 = (await profile(page)).lives;
        const m = await page.evaluate(() => window.__play.hint());
        await H.turn(page, () => H.swipe(page, m.a, m.b));
        if ((await H.state(page)) === 'play') {
          await page.click('.pl-pause');
          await page.click('.k-dialog[data-pl="pause"] [data-action="quit"]');
          await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="confirm"]');
          await page.click('.k-dialog[data-pl="confirm"] [data-action="yes"]');
          await page.waitForFunction(() => window.__app.shell.current() === 'map', null, { timeout: 8000 });
          eq((await profile(page)).lives, lives1 - 1, 'quitting after a move cost exactly one life');
        }
        await context.close();
      });
    }

    await section('the app pauses while a level is left (an ad over the map): the next level is not frozen', async () => {
      const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
      const page = await openApp(context, 'lang=en&seed=3&gate=off&screen=map', '[app pause]');
      await page.evaluate(() => {
        const p = window.__app.profile;
        for (let i = 1; i <= 20; i++) p.recordWin(i, 2, 1000, 0);
        if (p.claimUnlocks) p.claimUnlocks();
      });
      await enter(page, 5);
      await page.evaluate(() => {
        const app = window.__app;
        app.shell.setPaused(true); // Activity.onPause (a full-screen ad opens)
        app.goto('map'); // the level is left while the app is paused
        app.shell.setPaused(false); // Activity.onResume reaches the map, not the play screen
      });
      await page.waitForFunction(() => window.__app.shell.current() === 'map');
      await enter(page, 6);
      eq(await page.evaluate(() => window.__play.loop().frozen), 0, 'the next level runs');
      const m = await page.evaluate(() => window.__play.hint());
      ok(await H.turn(page, () => H.swipe(page, m.a, m.b)), 'and takes a move');
      // paused and resumed in the middle of a turn, through the shell
      const m2 = await page.evaluate(() => window.__play.hint());
      if (m2 && (await H.state(page)) === 'play') {
        await H.swipe(page, m2.a, m2.b);
        await page.evaluate(() => window.__app.shell.setPaused(true));
        const frozen = await page.evaluate(() => window.__play.loop());
        ok(frozen.frozen !== 0 && !frozen.running, 'the shell pauses the level');
        await page.evaluate(() => window.__app.shell.setPaused(false));
        await H.settled(page);
        if ((await H.state(page)) === 'play') await pictureIsEngine(page, 'after a pause in mid-turn');
      }
      await context.close();
    });

    await section('a level abandoned by closing the app costs its life at the next start, once', async () => {
      const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
      let page = await openApp(context, 'lang=en&seed=3&gate=off&screen=map', '[app killed]');
      await page.evaluate(() => {
        const p = window.__app.profile;
        for (let i = 1; i <= 20; i++) p.recordWin(i, 2, 1000, 0);
        if (p.claimUnlocks) p.claimUnlocks();
      });
      await enter(page, 9);
      const lives0 = (await profile(page)).lives;
      const m = await page.evaluate(() => window.__play.hint());
      await H.turn(page, () => H.swipe(page, m.a, m.b));
      ok(await page.evaluate(() => localStorage.getItem('match3.attempt.v1') !== null), 'the open attempt is noted');
      await page.close(); // the app is killed in mid-level
      page = await openApp(context, 'lang=en&seed=3&gate=off&screen=map', '[app killed 2]');
      eq((await profile(page)).lives, lives0, 'nothing is charged before the player enters a level again (the play screen settles it)');
      await enter(page, 9);
      eq((await profile(page)).lives, lives0 - 1, 'the abandoned attempt cost its life');
      await page.close();
      page = await openApp(context, 'lang=en&seed=3&gate=off&screen=map', '[app killed 3]');
      await enter(page, 9);
      eq((await profile(page)).lives, lives0 - 1, 'and it is charged only once');
      await context.close();
    });
  } catch (err) {
    failed = err;
  }
  await browser.close();
  if (problems.length > 0) console.log('\nCONSOLE PROBLEMS (' + problems.length + '):\n  ' + problems.slice(0, 20).join('\n  '));
  if (failed) console.log('\n' + (failed.stack || failed.message));
  if (failed || problems.length > 0) {
    console.log('\nplay in the app: FAILED');
    process.exit(1);
  }
  console.log(`\nplay in the app: PASSED — ${checks} checks, 0 console errors / warnings`);
})();
