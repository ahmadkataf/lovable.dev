/**
 * End-to-end test of the play screen in a real browser, driven with REAL pointer events
 * (page.mouse) through the dev harness play-demo.html.
 *
 *   npx vite --port 5184 --strictPort      (in another terminal)
 *   node tests/e2e/play.cjs
 *
 * Covers: a level played to a win (finale, win dialog, stars / coins bookkeeping, double-coins
 * video, Next), a level played to a loss (continue for coins, continue for a video — once —, retry
 * and give up with the life lost exactly once per attempt), every in-level booster (targeting,
 * cancel with Back, buying one when empty), pause / resume (dialog, Back, app pause in the middle
 * of an animation), resize + orientation change mid-level, an invalid swap, the tutorial tip, and
 * repeated start / stop; plus the regressions of the QA pass (pieces left askew by gestures, a
 * swipe lost at the end of a turn, leftovers of a skipped finale, choices made while a rewarded
 * video is pending, a pause that outlives its level, the app being closed in mid-level).
 * The monkey (tests/e2e/play-monkey.cjs) covers random play. It FAILS on any console error or warning, page error or unhandled
 * rejection (the screen warns when it had to snap the board to the engine's state).
 */
const { chromium } = require('playwright');
const H = require('./play-harness.cjs');

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

const save = (page) => page.evaluate(() => window.__demo.save());
const snap = (page) =>
  page.evaluate(() => {
    const s = window.__play.snapshot();
    return s && { moves: s.movesLeft, score: s.score, status: s.status, stars: s.stars, goals: s.goals.map((g) => ({ cur: g.current, target: g.target, done: g.done })) };
  });
const shown = (page) => page.evaluate(() => window.__play.shown());
const loop = (page) => page.evaluate(() => window.__play.loop());
const log = (page) => page.evaluate(() => window.__demo.log);
const hudMoves = (page) => page.evaluate(() => Number(document.querySelector('.pl-moves__n').textContent));
const num = (text) => Number(String(text).replace(/[^\d]/g, ''));
const waitState = (page, s, timeout = 30000) => page.waitForFunction((want) => window.__play.state() === want, s, { timeout });

async function hudInSync(page, where) {
  const s = await snap(page);
  const h = await shown(page);
  eq(h.moves, s.moves, `${where}: moves shown = engine`);
  eq(h.score, s.score, `${where}: score shown = engine`);
  eq(await hudMoves(page), s.moves, `${where}: moves numeral in the header`);
}

async function section(name, fn) {
  const t0 = Date.now();
  await fn();
  console.log(`  ✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

// ───────────────────────────── scenarios ─────────────────────────────

async function winFlow(browser) {
  const page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=easy&seed=11&tut=0&inv=0&fast=1&ads=1', problems, tag: '[win]' });
  await H.idle(page);
  const before = await save(page);
  const levelId = await page.evaluate(() => window.__play.level());
  ok(before.stats.played >= 1, 'the attempt was recorded at start');
  await hudInSync(page, 'start');

  const made = await H.playHints(page, 60, async (i) => {
    if ((await H.state(page)) === 'play') await hudInSync(page, 'after move ' + (i + 1));
  });
  ok(made > 0, 'moves were made');
  await page.waitForFunction(() => ['finale', 'won'].includes(window.__play.state()), null, { timeout: 30000 });
  eq((await snap(page)).status, 'won', 'engine reports the win');

  // the finale is skippable by a tap anywhere, and capped anyway
  const t0 = Date.now();
  await page.waitForTimeout(350);
  if ((await H.state(page)) === 'finale') await page.mouse.click(180, 400);
  await waitState(page, 'won', 8000);
  ok(Date.now() - t0 < 6000, 'finale ended within its cap');
  await page.waitForSelector('.pl-win', { timeout: 5000 });

  const final = await snap(page);
  ok(final.stars >= 1 && final.stars <= 3, 'stars 1..3');
  eq(final.moves, 0, 'end bonus used every remaining move');
  await page.waitForTimeout(400 + final.stars * 320);
  eq(await page.locator('.pl-win .k-star.k-on').count(), final.stars, 'stars shown in the win dialog');
  await page.waitForTimeout(700);
  eq(num(await page.locator('.pl-win__scoren').textContent()), final.score, 'score counted up to the final score');

  const reward = await page.evaluate((stars) => window.__demo.levelReward(0, stars), final.stars);
  let after = await save(page);
  eq(after.levels[String(levelId)], { stars: final.stars, best: final.score }, 'level record saved');
  eq(after.coins, before.coins + reward, 'coins for the first clear');
  eq(after.lives, before.lives, 'winning costs no life');
  eq(after.stats.won, before.stats.won + 1, 'win counted');
  eq(num(await page.locator('.pl-win__coinsn').textContent()), reward, 'coins shown');

  // double coins by rewarded video: once
  await page.click('[data-action="double"]');
  await page.waitForFunction(() => document.querySelector('[data-action="double"]').disabled, null, { timeout: 5000 });
  after = await save(page);
  eq(after.coins, before.coins + reward * 2, 'coins doubled exactly once');
  eq((await log(page)).ads, ['doubleReward'], 'one rewarded video shown');

  await page.click('[data-action="next"]');
  await page.waitForFunction(() => window.__demo.log.nav.some((l) => l.indexOf('openLevelIntro') === 0), null, { timeout: 5000 });
  const l = await log(page);
  ok(l.nav.includes(`toMap {"justWon":${levelId}}`), 'navigated to the map with justWon');
  ok(l.nav.includes(`openLevelIntro ${levelId + 1}`), 'next level intro requested');
  eq(l.interstitials, 1, 'interstitial slot offered once on the way out');
  eq(await H.state(page), 'none', 'screen stopped after leaving');
  const lp = await loop(page);
  eq([lp.running, lp.tweens, lp.timers, lp.dialogs], [false, 0, 0, 0], 'nothing left running after leaving');
  await page.context().close();
}

async function loseFlow(browser) {
  const page = await H.openHarness(browser, { w: 412, h: 915, query: 'level=hard&seed=11&tut=0&inv=0&fast=1&ads=1&coins=9000', problems, tag: '[lose]' });
  await H.idle(page);
  const before = await save(page);
  const levelId = await page.evaluate(() => window.__play.level());
  const lives0 = before.lives;

  await H.playHints(page, 10);
  await waitState(page, 'lost');
  await page.waitForSelector('[data-action="giveUp"]', { timeout: 5000 });
  eq((await save(page)).lives, lives0, 'no life lost while the lose dialog offers to continue');
  ok((await page.locator('.pl-dlg__goals .pl-goal').count()) >= 1, 'the dialog shows what is still missing');
  const missing = num(await page.locator('.pl-dlg__goals .pl-goal__n').first().textContent());
  const s0 = await snap(page);
  eq(missing, s0.goals[0].target - s0.goals[0].cur, 'the missing amount is the true one');

  // continue for coins
  await page.waitForTimeout(700); // result-dialog buttons ignore input for 600 ms
  const price = num(await page.locator('[data-action="continue"] .k-price').textContent());
  const coinMoves = num(await page.locator('[data-action="continue"] .k-btn__cap, [data-action="continue"] .k-btn__label').first().textContent());
  ok(price > 0 && coinMoves > 0, 'continue offer states its price and moves');
  await page.click('[data-action="continue"]');
  await H.idle(page);
  let now = await save(page);
  eq(now.coins, before.coins - price, 'continue charged its price');
  eq(now.lives, lives0, 'continuing costs no life');
  eq((await snap(page)).moves, coinMoves, 'moves granted by the continue');
  await hudInSync(page, 'after the coin continue');

  // lose again → continue by rewarded video (once per attempt)
  await H.playHints(page, 12);
  await waitState(page, 'lost');
  await page.waitForSelector('[data-action="adContinue"]', { timeout: 5000 });
  const price2 = num(await page.locator('[data-action="continue"] .k-price').textContent());
  ok(price2 > price, 'the second continue costs more');
  const adMoves = num(await page.locator('[data-action="adContinue"] .k-btn__label').textContent());
  await page.waitForTimeout(700);
  await page.click('[data-action="adContinue"]');
  await H.idle(page);
  eq((await snap(page)).moves, adMoves, 'moves granted by the video');
  eq((await log(page)).ads, ['extraMoves'], 'one rewarded video shown');
  eq((await save(page)).coins, before.coins - price, 'the video continue is free');

  // lose a third time: no second video; retry costs exactly one life and restarts
  await H.playHints(page, 12);
  await waitState(page, 'lost');
  await page.waitForSelector('[data-action="retry"]', { timeout: 5000 });
  eq(await page.locator('[data-action="adContinue"]').count(), 0, 'the video continue is offered once per attempt');
  await page.waitForTimeout(700);
  await page.click('[data-action="retry"]');
  await H.idle(page);
  now = await save(page);
  eq(now.lives, lives0 - 1, 'retry cost one life');
  eq(now.stats.played, before.stats.played + 1, 'the retry is a new attempt');
  eq((await snap(page)).moves, 3, 'the level restarted');
  eq(await page.locator('.k-overlay.k-open').count(), 0, 'no dialog left open');

  // lose once more and give up: one more life, then the map
  await H.playHints(page, 10);
  await waitState(page, 'lost');
  await page.waitForSelector('[data-action="giveUp"]', { timeout: 5000 });
  await page.waitForTimeout(700);
  await page.click('[data-action="giveUp"]');
  await page.waitForFunction(() => window.__demo.log.nav.some((l) => l.indexOf('toMap') === 0), null, { timeout: 5000 });
  now = await save(page);
  eq(now.lives, lives0 - 2, 'giving up cost exactly one more life');
  const l = await log(page);
  ok(l.nav.includes(`toMap {"focusLevel":${levelId}}`), 'back on the map at the level');
  eq(l.interstitials, 1, 'interstitial slot offered once after giving up');
  eq(now.levels[String(levelId)], undefined, 'no win recorded');
  await page.context().close();
}

async function boosters(browser) {
  const page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=mix&seed=7&tut=0&inv=1&fast=1&coins=9000', problems, tag: '[boosters]' });
  await H.idle(page);
  const cells = () =>
    page.evaluate(() => {
      const s = window.__play.snapshot();
      return s.cells.map((c) => (c.piece ? c.piece.id : -1));
    });
  const info = () =>
    page.evaluate(() => {
      const s = window.__play.snapshot();
      return { cols: s.cols, rows: s.rows, cells: s.cells.map((c) => (c.exists && c.piece ? { kind: c.piece.kind, chained: c.piece.chained, color: c.piece.color, id: c.piece.id } : null)), valid: window.__play.validMoves() };
    });
  const count = async (id) => (await save(page)).boosters[id];
  const moves0 = (await snap(page)).moves;

  // hammer: targeting mode, Back cancels it, then a tap smashes a gem
  await page.click('[data-booster="hammer"] button');
  await page.waitForSelector('.pl-target', { timeout: 3000 });
  ok(await page.evaluate(() => document.querySelector('.pl-root').classList.contains('pl-targeting')), 'HUD dimmed while targeting');
  ok(await page.evaluate(() => window.__demo.back()), 'Back is consumed');
  eq(await page.locator('.pl-target').count(), 0, 'Back cancelled targeting');
  eq(await count('hammer'), 1, 'cancelling costs nothing');
  await page.waitForTimeout(400); // kit buttons ignore a second press within 350 ms
  await page.click('[data-booster="hammer"] button');
  await page.waitForSelector('.pl-target');
  let b = await info();
  const gemAt = b.cells.findIndex((c) => c && c.kind === 'gem' && !c.chained);
  const before = await cells();
  ok(await H.turn(page, () => H.tapCell(page, gemAt % b.cols, Math.floor(gemAt / b.cols))), 'the hammer tap started a turn');
  ok(JSON.stringify(await cells()) !== JSON.stringify(before), 'the hammer changed the board');
  eq(await count('hammer'), 0, 'hammer consumed');
  eq((await snap(page)).moves, moves0, 'the hammer costs no move');
  eq(await page.locator('.pl-target').count(), 0, 'targeting ended');

  // free swap: two neighbours that would not match
  await page.click('[data-booster="freeSwap"] button');
  await page.waitForSelector('.pl-target');
  b = await info();
  const movable = (c) => c && !c.chained && c.kind === 'gem';
  const isValid = (i, j) => b.valid.some((m) => (m.a.r * b.cols + m.a.c === i && m.b.r * b.cols + m.b.c === j) || (m.a.r * b.cols + m.a.c === j && m.b.r * b.cols + m.b.c === i));
  let pair = null;
  for (let i = 0; i < b.cells.length && !pair; i++) {
    const j = i + 1;
    if (j % b.cols === 0) continue;
    if (movable(b.cells[i]) && movable(b.cells[j]) && b.cells[i].color !== b.cells[j].color && !isValid(i, j)) pair = [i, j];
  }
  ok(pair, 'found a non-matching pair for the free swap');
  const ids = [b.cells[pair[0]].id, b.cells[pair[1]].id];
  ok(await H.turn(page, () => H.swipe(page, { c: pair[0] % b.cols, r: Math.floor(pair[0] / b.cols) }, { c: pair[1] % b.cols, r: Math.floor(pair[1] / b.cols) })), 'the free swap started a turn');
  eq(await count('freeSwap'), 0, 'free swap consumed');
  eq((await snap(page)).moves, moves0, 'the free swap costs no move');
  const afterSwap = await cells();
  ok(afterSwap[pair[0]] !== ids[0] || afterSwap[pair[1]] !== ids[1], 'the two pieces moved');

  // shuffle: immediate
  const beforeShuffle = await cells();
  ok(await H.turn(page, () => page.click('[data-booster="shuffle"] button')), 'the shuffle started a turn');
  eq(await count('shuffle'), 0, 'shuffle consumed');
  ok(JSON.stringify(await cells()) !== JSON.stringify(beforeShuffle), 'the board was shuffled');
  eq((await snap(page)).moves, moves0, 'the shuffle costs no move');
  await hudInSync(page, 'after the boosters');

  // empty booster → buy one for coins, then it is ready to use
  const coins0 = (await save(page)).coins;
  await page.click('[data-booster="hammer"] button');
  await page.waitForSelector('[data-action="buy"]', { timeout: 3000 });
  const price = num(await page.locator('[data-action="buy"] .k-price').textContent());
  await page.click('[data-action="buy"]');
  await page.waitForSelector('.pl-target', { timeout: 3000 });
  eq((await save(page)).coins, coins0 - price, 'the booster was paid for');
  eq(await count('hammer'), 1, 'one hammer bought (used only when the engine accepts)');
  await H.idle(page);
  b = await info();
  const gem2 = b.cells.findIndex((c) => c && c.kind === 'gem' && !c.chained);
  ok(await H.turn(page, () => H.tapCell(page, gem2 % b.cols, Math.floor(gem2 / b.cols))), 'the bought hammer started a turn');
  eq(await count('hammer'), 0, 'bought hammer consumed');

  // an invalid swap costs nothing
  b = await info();
  let bad = null;
  for (let i = 0; i < b.cells.length && !bad; i++) {
    const j = i + 1;
    if (j % b.cols === 0) continue;
    if (movable(b.cells[i]) && movable(b.cells[j]) && !isValid2(b, i, j)) bad = [i, j];
  }
  ok(bad, 'found an invalid swap');
  const beforeBad = await cells();
  ok(await H.turn(page, () => H.swipe(page, { c: bad[0] % b.cols, r: Math.floor(bad[0] / b.cols) }, { c: bad[1] % b.cols, r: Math.floor(bad[1] / b.cols) })), 'the rejected swap was animated');
  eq(await cells(), beforeBad, 'an invalid swap changes nothing');
  eq((await snap(page)).moves, moves0, 'an invalid swap costs no move');
  await page.context().close();
}

function isValid2(b, i, j) {
  return b.valid.some((m) => (m.a.r * b.cols + m.a.c === i && m.b.r * b.cols + m.b.c === j) || (m.a.r * b.cols + m.a.c === j && m.b.r * b.cols + m.b.c === i));
}

async function pauseAndResize(browser) {
  const page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=mix&seed=9&tut=0&inv=2', problems, tag: '[pause]' });
  await H.idle(page);

  // pause button → dialog; the game is frozen; a toggle writes the setting; resume
  await page.click('.pl-pause');
  await page.waitForSelector('[data-setting="sfx"]', { timeout: 3000 });
  ok((await loop(page)).frozen !== 0, 'frozen while paused');
  await page.click('[data-setting="music"]');
  eq((await save(page)).settings.music, false, 'music toggle saved');
  await page.click('[data-setting="music"]');
  eq((await save(page)).settings.music, true, 'music toggle saved back');
  await page.locator('.k-dialog .k-btn', { hasText: 'Resume' }).click();
  await page.waitForFunction(() => window.__play.loop().frozen === 0 && window.__play.isIdle(), null, { timeout: 3000 });

  // Back opens the pause dialog, Back again closes it
  ok(await page.evaluate(() => window.__demo.back()), 'Back consumed');
  await page.waitForSelector('[data-setting="sfx"]', { timeout: 3000 });
  ok(await page.evaluate(() => window.__demo.back()), 'Back consumed again');
  await page.waitForFunction(() => window.__play.loop().frozen === 0 && window.__play.isIdle(), null, { timeout: 3000 });
  eq(await page.locator('.k-overlay.k-open').count(), 0, 'pause dialog closed');

  // the app goes to the background in the middle of a turn, comes back, and the turn finishes
  let h = await page.evaluate(() => window.__play.hint());
  await H.swipe(page, h.a, h.b);
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__demo.pause(true));
  const frozenLoop = await loop(page);
  ok(!frozenLoop.running && frozenLoop.frozen !== 0, 'animation loop stopped while the app is paused');
  const tweens = frozenLoop.tweens;
  await page.waitForTimeout(400);
  eq((await loop(page)).tweens, tweens, 'nothing advances while paused');
  await page.evaluate(() => window.__demo.pause(false));
  await H.idle(page);
  await hudInSync(page, 'after pause / resume mid-turn');

  // rotate to landscape in the middle of a turn, then play there
  h = await page.evaluate(() => window.__play.hint());
  await H.swipe(page, h.a, h.b);
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 640, height: 360 });
  await H.idle(page);
  ok(await page.evaluate(() => document.querySelector('.pl-root').classList.contains('pl-land')), 'landscape layout');
  const box = await page.evaluate(() => {
    const c = document.querySelector('.pl-board').getBoundingClientRect();
    const hud = document.querySelector('.pl-hud').getBoundingClientRect();
    return { cw: c.width, ch: c.height, hudRight: hud.right, canvasLeft: c.left, cell: window.__play.shown().cell };
  });
  ok(box.hudRight <= box.canvasLeft + 1, 'HUD sits beside the board in landscape');
  ok(box.cell * 9 <= box.ch + 0.5 && box.cell >= 24, 'board fits the landscape stage');
  const m0 = (await snap(page)).moves;
  h = await page.evaluate(() => window.__play.hint());
  await H.turn(page, () => H.swipe(page, h.a, h.b));
  eq((await snap(page)).moves, m0 - 1, 'a real swipe works after the rotation');

  // and back to a tall phone
  await page.setViewportSize({ width: 412, height: 915 });
  await page.waitForTimeout(150);
  ok(!(await page.evaluate(() => document.querySelector('.pl-root').classList.contains('pl-land'))), 'portrait layout again');
  const fit = await page.evaluate(() => {
    const s = window.__play.shown();
    const a = window.__play.cell(0, 0);
    const z = window.__play.cell(8, 8);
    return { cell: s.cell, left: a.x - s.cell / 2, right: z.x + s.cell / 2, bottom: z.y + s.cell / 2, tray: document.querySelector('.pl-tray').getBoundingClientRect().top, hud: document.querySelector('.pl-hud').getBoundingClientRect().bottom, top: a.y - s.cell / 2 };
  });
  ok(fit.left >= 0 && fit.right <= 412, 'board inside the screen width');
  ok(fit.top >= fit.hud - 1 && fit.bottom <= fit.tray + 1, 'board between header and tray');
  ok(fit.cell >= 42, 'board uses the width (cell ' + fit.cell + ')');
  h = await page.evaluate(() => window.__play.hint());
  await H.turn(page, () => H.tapTap(page, h.a, h.b));
  eq((await snap(page)).moves, m0 - 2, 'tap-tap works after rotating back');
  await hudInSync(page, 'after the rotations');

  // idle: the loop sleeps
  await page.waitForTimeout(1800);
  const idleLoop = await loop(page);
  eq(idleLoop.running, false, 'no animation frames while idle');
  await page.context().close();
}

async function tutorialAndCycles(browser) {
  const page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=easy&seed=4&tut=match&inv=0', problems, tag: '[tutorial]' });
  await page.waitForSelector('.k-dialog .pl-tip__art', { timeout: 8000 });
  eq(await H.state(page), 'intro', 'play waits for the tip');
  await page.locator('.k-dialog .k-btn').click();
  await H.idle(page);
  ok((await save(page)).seen.includes('tut.match'), 'the tip is remembered as seen');
  const h = await page.evaluate(() => window.__play.hint());
  const m0 = (await snap(page)).moves;
  await H.turn(page, () => H.swipe(page, h.a, h.b));
  eq((await snap(page)).moves, m0 - 1, 'the guided first move works');

  // start / stop again and again: nothing is left running, and the screen still plays
  for (let i = 0; i < 12; i++) {
    await page.evaluate((k) => window.__demo.start(['mix', 'fx', 'easy', 'lamp'][k % 4]), i);
    await page.waitForTimeout(i % 3 === 0 ? 30 : 160);
    await page.evaluate(() => window.__demo.stop());
  }
  const l = await loop(page);
  eq([l.running, l.tweens, l.timers, l.dialogs, l.frozen], [false, 0, 0, 0, 0], 'clean after 12 start / stop cycles');
  eq(await page.locator('.pl-over > *').count(), 0, 'no banner left behind');
  await page.evaluate(() => window.__demo.start('easy'));
  await H.idle(page);
  const made = await H.playHints(page, 2);
  eq(made, 2, 'plays normally after the cycles');
  await page.context().close();
}

/** Pieces of the renderer's model that do not stand at rest (size, offset, lift). */
const askew = (page) =>
  page.evaluate(() =>
    window.__play
      .model()
      .pieces.filter((p) => p.dying || Math.abs(p.sx - 1) > 0.005 || Math.abs(p.sy - 1) > 0.005 || Math.abs(p.ox) > 0.005 || Math.abs(p.oy) > 0.005 || p.lift || p.flash > 0.005)
      .map((p) => ({ id: p.id, x: p.x, y: p.y, sx: p.sx, ox: p.ox, lift: p.lift })),
  );
const quiet = (page) => page.waitForFunction(() => window.__play.loop().tweens === 0, null, { timeout: 5000 });

/** Regressions found by the QA pass: gestures that left pieces askew, lost swipes, leftovers of a skipped finale, ads, app pause. */
async function hardening(browser) {
  // ── tap-tap (valid and invalid) leaves every piece at rest ──
  let page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=easy&seed=11&tut=0&inv=3', problems, tag: '[gestures]' });
  await H.idle(page);
  const pairs = () =>
    page.evaluate(() => {
      const s = window.__play.snapshot();
      const v = window.__play.validMoves();
      const valid = (a, b) => v.some((m) => (m.a.c === a.c && m.a.r === a.r && m.b.c === b.c && m.b.r === b.r) || (m.a.c === b.c && m.a.r === b.r && m.b.c === a.c && m.b.r === a.r));
      let bad = null;
      let same = null;
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c + 1 < s.cols; c++) {
          const a = { c, r };
          const b = { c: c + 1, r };
          const A = s.cells[r * s.cols + c].piece;
          const B = s.cells[r * s.cols + c + 1].piece;
          if (!bad && !valid(a, b)) bad = { a, b };
          if (!same && A && B && A.kind === 'gem' && B.kind === 'gem' && A.color === B.color) same = { a, b };
        }
      }
      return { bad, same };
    });
  let found = await pairs();
  await H.turn(page, () => H.tapTap(page, found.bad.a, found.bad.b));
  await quiet(page);
  eq(await askew(page), [], 'an invalid tap-tap swap leaves every piece at rest');
  let h = await page.evaluate(() => window.__play.hint());
  await H.turn(page, () => H.tapTap(page, h.a, h.b));
  await quiet(page);
  eq(await askew(page), [], 'a valid tap-tap swap leaves every piece at rest');

  // ── a free swap the engine refuses (two identical gems): nothing stays displaced, nothing is consumed ──
  found = await pairs();
  ok(found.same, 'two identical neighbours exist');
  await page.click('[data-booster="freeSwap"] button');
  await page.waitForSelector('.pl-target');
  const inv0 = (await save(page)).boosters.freeSwap;
  await H.swipe(page, found.same.a, found.same.b);
  await page.waitForTimeout(250);
  await quiet(page);
  eq(await askew(page), [], 'a refused free swap leaves every piece at rest');
  eq((await save(page)).boosters.freeSwap, inv0, 'a refused free swap is not consumed');
  ok(await page.evaluate(() => window.__play.info().targeting === 'freeSwap'), 'still targeting after a refused swap');
  await page.evaluate(() => window.__demo.back());

  // ── a partial drag let go, a drag against the edge, a tap on / off: all back at rest ──
  const p0 = await H.cell(page, 0, 3);
  const cellPx = (await shown(page)).cell;
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  await page.mouse.move(p0.x + cellPx * 0.3, p0.y, { steps: 3 }); // below the commit distance
  await page.mouse.up();
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  await page.mouse.move(p0.x - cellPx, p0.y, { steps: 3 }); // against the board edge
  await page.mouse.up();
  await H.tapCell(page, 2, 2);
  await H.tapCell(page, 2, 2);
  await page.waitForTimeout(250);
  await quiet(page);
  eq(await askew(page), [], 'cancelled drags and a select / deselect leave every piece at rest');

  // ── a swipe begun while the board resolves and let go after it settled is played, not lost ──
  h = await page.evaluate(() => window.__play.hint());
  await H.swipe(page, h.a, h.b);
  await page.waitForTimeout(120);
  ok(!(await page.evaluate(() => window.__play.isIdle())), 'the board is resolving');
  const hold = await H.cell(page, 3, 5);
  await page.mouse.move(hold.x, hold.y);
  await page.mouse.down();
  await page.mouse.move(hold.x + cellPx, hold.y, { steps: 3 });
  await H.idle(page);
  const turns0 = await page.evaluate(() => window.__play.turns());
  await page.mouse.up();
  await page.waitForFunction((t) => window.__play.turns() > t, turns0, { timeout: 3000 });
  await H.idle(page);
  ok(!(await page.evaluate(() => window.__play.info().buffered)), 'no stale buffered swipe is kept');
  await quiet(page);
  eq(await askew(page), [], 'at rest after the late swipe');
  await page.context().close();

  // ── a skipped finale leaves no spark over the header; the win is saved before the show ──
  page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=easy&seed=11&tut=0&inv=0&ads=1', problems, tag: '[finale]' });
  await H.idle(page);
  const lvl = await page.evaluate(() => window.__play.level());
  for (let i = 0; i < 60 && (await H.state(page)) === 'play'; i++) {
    await H.settled(page);
    if ((await H.state(page)) !== 'play') break;
    const m = await page.evaluate(() => window.__play.hint());
    await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
    await page.waitForTimeout(40);
  }
  await waitState(page, 'finale');
  ok((await save(page)).levels[String(lvl)], 'the win is in the profile the moment the level is won (before the finale plays)');
  await page.waitForFunction(() => window.__play.info().finale && window.__play.info().flyers > 0, null, { timeout: 10000 });
  await page.mouse.click(180, 420);
  eq(await H.state(page), 'won', 'a tap during the end bonus skips it at once');
  eq(await page.evaluate(() => window.__play.info().flyers), 0, 'no spark is left in flight after skipping the finale');
  eq(await page.evaluate(() => window.__play.model().pieces.filter((p) => p.dying).length), 0, 'the board jumped to its final state');

  // ── while a rewarded video is asked for, the dialog cannot be left; the reward is paid once ──
  await page.waitForSelector('.k-dialog[data-pl="win"]:not(.pl-locked)', { timeout: 5000 });
  const coins0 = (await save(page)).coins;
  const reward = num(await page.locator('.pl-win__coinsn').textContent());
  await page.click('[data-action="double"]');
  await page.locator('[data-action="next"]').click({ force: true });
  await page.locator('[data-action="map"]').click({ force: true });
  await page.evaluate(() => window.__demo.back());
  eq(await H.state(page), 'won', 'Next / Map / Back wait while the video is pending');
  await page.waitForFunction(() => document.querySelector('[data-action="double"]').disabled, null, { timeout: 5000 });
  eq((await save(page)).coins, coins0 + reward, 'the doubled coins are paid exactly once');
  eq((await log(page)).nav.filter((l) => l.indexOf('toMap') === 0).length, 0, 'the map was not opened under the video');
  await page.waitForTimeout(400); // kit buttons ignore a second press within 350 ms
  await page.click('[data-action="map"]');
  await page.waitForFunction(() => window.__play.state() === 'none', null, { timeout: 5000 });

  // ── the app is paused while a level is left (an ad over the map): the next level is not frozen ──
  await page.evaluate(() => window.__demo.start('easy'));
  await H.idle(page);
  await page.evaluate(() => {
    window.__demo.pause(true); // Activity.onPause …
    window.__demo.stop(); // … the level is left while paused; its resume goes to the screen then on display
    window.__demo.start('tiny');
  });
  await H.idle(page, 8000);
  eq((await loop(page)).frozen, 0, 'a level started after a pause that was never "resumed" for this screen is not frozen');
  h = await page.evaluate(() => window.__play.hint());
  ok(await H.turn(page, () => H.swipe(page, h.a, h.b)), 'and it plays');
  await page.context().close();

  // ── same for the lose dialog: other choices wait for the video's answer ──
  page = await H.openHarness(browser, { w: 360, h: 640, query: 'level=hard&seed=11&tut=0&inv=0&fast=1&ads=1&coins=9000', problems, tag: '[lose-ad]' });
  await H.idle(page);
  await H.playHints(page, 10);
  await waitState(page, 'lost');
  await page.waitForSelector('.k-dialog[data-pl="lose"]:not(.pl-locked)', { timeout: 5000 });
  const before = await save(page);
  await page.click('[data-action="adContinue"]');
  await page.locator('[data-action="continue"]').click({ force: true });
  await page.locator('[data-action="giveUp"]').click({ force: true });
  await page.locator('[data-action="retry"]').click({ force: true });
  await H.idle(page);
  const after = await save(page);
  eq([after.coins, after.lives], [before.coins, before.lives], 'coins and lives untouched by taps made while the video was pending');
  eq((await snap(page)).moves, 3, 'the video continue was granted (+3 moves)');
  await page.context().close();
}

/** Closing the app in the middle of a level costs the life at the next start — once, and only then. */
async function appKilled(browser) {
  const url = (query) => `${H.BASE}?lang=en&mute=1&keep=1&tut=0&inv=0&${query}`;
  const ready = (page) => page.waitForFunction(() => window.__demo && window.__demo.ready, null, { timeout: 30000 });
  const page = await H.openHarness(browser, { w: 360, h: 640, query: 'keep=1&level=easy&seed=11&tut=0&inv=0', problems, tag: '[killed]' });
  await H.idle(page);
  const lives0 = (await save(page)).lives;
  const noteOf = () => page.evaluate(() => localStorage.getItem('match3.attempt.v1'));

  // closed before any move: nothing to pay
  eq(await noteOf(), null, 'no note before the first move');
  await page.goto(url('level=easy&seed=11'));
  await ready(page);
  await H.idle(page);
  eq((await save(page)).lives, lives0, 'closing the app before the first move costs nothing');

  // one move, then the app is killed
  let h = await page.evaluate(() => window.__play.hint());
  await H.turn(page, () => H.swipe(page, h.a, h.b));
  ok(await noteOf(), 'the attempt is noted once a move was made');
  await page.goto(url('level=none'));
  await ready(page);
  await page.evaluate(() => window.__demo.start('easy'));
  await H.idle(page);
  eq((await save(page)).lives, lives0 - 1, 'the abandoned attempt cost its life at the next start');
  eq(await noteOf(), null, 'and the note is gone');

  // … exactly once
  await page.goto(url('level=none'));
  await ready(page);
  await page.evaluate(() => window.__demo.start('easy'));
  await H.idle(page);
  eq((await save(page)).lives, lives0 - 1, 'it is not charged a second time');

  // leaving through the pause dialog pays at once and leaves no note
  h = await page.evaluate(() => window.__play.hint());
  await H.turn(page, () => H.swipe(page, h.a, h.b));
  await page.click('.pl-pause');
  await page.click('[data-action="quit"]');
  await page.click('.k-dialog[data-pl="confirm"] [data-action="yes"]');
  await page.waitForFunction(() => window.__play.state() === 'none', null, { timeout: 5000 });
  eq((await save(page)).lives, lives0 - 2, 'quitting cost one life');
  eq(await noteOf(), null, 'no note after an orderly exit');
  await page.goto(url('level=none'));
  await ready(page);
  await page.evaluate(() => window.__demo.start('easy'));
  await H.idle(page);
  eq((await save(page)).lives, lives0 - 2, 'and nothing more at the next start');

  // killed during the finale: the level is won, no life is taken
  const lvl = await page.evaluate(() => window.__play.level());
  for (let i = 0; i < 60 && (await H.state(page)) === 'play'; i++) {
    await H.settled(page);
    if ((await H.state(page)) !== 'play') break;
    const m = await page.evaluate(() => window.__play.hint());
    await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
    await page.waitForTimeout(40);
  }
  await waitState(page, 'finale');
  eq(await noteOf(), null, 'a won level leaves no note');
  await page.goto(url('level=none'));
  await ready(page);
  const s = await save(page);
  ok(s.levels[String(lvl)], 'the win survived the app being closed during the finale');
  await page.evaluate(() => window.__demo.start('easy'));
  await H.idle(page);
  eq((await save(page)).lives, lives0 - 2, 'no life taken for a level that was won');
  await page.context().close();
}

(async () => {
  const browser = await chromium.launch();
  let failed = null;
  try {
    await section('win: finale, dialog, bookkeeping, double coins, next', () => winFlow(browser));
    await section('lose: continues, retry, give up, lives', () => loseFlow(browser));
    await section('boosters: hammer, free swap, shuffle, buy, invalid swap', () => boosters(browser));
    await section('pause / resume, rotation mid-turn, idle loop', () => pauseAndResize(browser));
    await section('tutorial tip, start / stop cycles', () => tutorialAndCycles(browser));
    await section('hardening: gestures at rest, late swipe, skipped finale, pending videos, pause across levels', () => hardening(browser));
    await section('app closed mid-level: the life is charged once at the next start', () => appKilled(browser));
  } catch (err) {
    failed = err;
  }
  await browser.close();
  if (problems.length > 0) {
    console.log('\nCONSOLE PROBLEMS (' + problems.length + '):\n  ' + problems.slice(0, 20).join('\n  '));
  }
  if (failed) console.log('\n' + (failed.stack || failed.message));
  if (failed || problems.length > 0) {
    console.log('\nplay e2e: FAILED');
    process.exit(1);
  }
  console.log(`\nplay e2e: PASSED — ${checks} checks, 0 console errors / warnings`);
})();
