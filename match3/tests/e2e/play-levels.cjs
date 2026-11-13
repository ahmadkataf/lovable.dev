/**
 * Every mechanic, to a win and to a loss: each harness level of play-demo.html (all blockers
 * together, lamps, vines and chains, holes, four goals, specials and special pairs, the smallest
 * board …) and a sample of the game's own levels are played once with moves to spare — until the
 * win dialog — and once with two moves only — until the lose dialog. Real pointer events on the
 * fast setting; after every move the picture must equal the engine (window.__play.model() vs
 * snapshot(), header included).
 *
 *   npx vite --port 5184 --strictPort            (in another terminal)
 *   node tests/e2e/play-levels.cjs
 */
const { chromium } = require('playwright');
const H = require('./play-harness.cjs');

const HARNESS = ['mix', 'easy', 'hard', 'fx', 'combo', 'lamp', 'vine', 'holes', 'tiny', 'goals4'];
const REAL = ['1', '7', '13', '19', '26', '34', '47', '58', '66', '79', '93', '108', '120'];
const problems = [];
let checks = 0;

function ok(cond, what) {
  checks++;
  if (!cond) throw new Error('FAILED: ' + what);
}

async function same(page, where) {
  const diff = await H.pictureProblems(page);
  if (diff === null) return;
  checks++;
  if (diff.length > 0) throw new Error(`FAILED: ${where}: the picture differs from the engine\n   ` + diff.join('\n   '));
}

const save = (page) => page.evaluate(() => window.__demo.save());

/** Hinted moves — a real swipe or tap-tap now and then, the debug hook otherwise (speed) — until the level leaves 'play'. */
async function playOut(page, name, max) {
  for (let i = 0; i < max; i++) {
    await H.settled(page, 90000);
    if ((await H.state(page)) !== 'play') return i;
    const m = await page.evaluate(() => window.__play.hint());
    ok(m, name + ': the engine always has a move while the level is on');
    if (i % 4 === 0) await H.turn(page, () => H.swipe(page, m.a, m.b), 20000);
    else if (i % 4 === 2) await H.turn(page, () => H.tapTap(page, m.a, m.b), 20000);
    else {
      const turns = await page.evaluate(() => window.__play.turns());
      await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
      await page.waitForFunction((t) => window.__play.turns() > t || window.__play.state() !== 'play', turns, { timeout: 20000 });
      await H.settled(page, 90000);
    }
    if ((await H.state(page)) === 'play') await same(page, `${name}, move ${i + 1}`);
  }
  return max;
}

async function toWin(page, key) {
  const level = await page.evaluate((k) => {
    const d = window.__demo;
    const def = d.levels[k] || d.ctx.levels[Number(k) - 1];
    const scoreOnly = def.goals.every((g) => g.kind === 'score');
    // moves to spare (a level decided by score alone is over when its moves are: keep it short, and within reach)
    d.startWith(k, scoreOnly ? { moves: 30, goals: [{ kind: 'score', target: 500 }], stars: [500, def.stars[1] > 500 ? def.stars[1] : 1000, def.stars[2] > 1000 ? def.stars[2] : 2000] } : { moves: 99 });
    return { id: def.id, scoreOnly };
  }, key);
  await H.idle(page);
  await same(page, key + ' at the start');
  const before = await save(page);
  await playOut(page, key + ' (to win)', 120);
  let state = await H.state(page);
  // out of moves before the goals were met: buy the continues (the harness is rich), then go on
  for (let c = 0; c < 3 && state === 'lost'; c++) {
    await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="lose"]:not(.pl-locked)', { timeout: 10000 });
    await page.click('[data-action="continue"]');
    await H.idle(page);
    await playOut(page, key + ' (after a continue)', 20);
    state = await H.state(page);
  }
  ok(state === 'finale' || state === 'won', `${key}: played to the win (state ${state})`);
  const t0 = Date.now();
  await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="win"]:not(.pl-locked)', { timeout: 20000 });
  ok(Date.now() - t0 < 9000, key + ': the finale is over within its cap');
  const s = await page.evaluate(() => {
    const snap = window.__play.snapshot();
    return { stars: snap.stars, moves: snap.movesLeft, score: snap.score, goals: snap.goals.every((g) => g.done), status: snap.status };
  });
  ok(s.status === 'won' && s.goals, key + ': every goal met');
  ok(s.moves === 0, key + ': the end bonus spent the remaining moves');
  const after = await save(page);
  ok(after.lives === before.lives, key + ': winning costs no life');
  ok(after.coins >= before.coins, key + ': coins do not go down by winning');
  ok(after.levels[String(level.id)] && after.levels[String(level.id)].best >= s.score, key + ': the win is recorded');
  await page.waitForTimeout(400 + Math.max(1, s.stars) * 320);
  ok((await page.locator('.pl-win .k-star.k-on').count()) === Math.max(1, s.stars), key + ': stars shown = stars earned');
  await page.click('[data-action="map"]');
  await page.waitForFunction(() => window.__play.state() === 'none', null, { timeout: 8000 });
}

async function toLoss(page, key) {
  await page.evaluate((k) => {
    const d = window.__demo;
    const def = d.levels[k] || d.ctx.levels[Number(k) - 1];
    // two moves, and goals that two moves cannot meet
    const goals = def.goals.every((g) => g.kind === 'score') ? [{ kind: 'score', target: 900000 }] : def.goals;
    const stars = def.goals.every((g) => g.kind === 'score') ? [900000, 950000, 990000] : def.stars;
    d.startWith(k, { moves: 2, goals, stars });
  }, key);
  await H.idle(page);
  const before = await save(page);
  await playOut(page, key + ' (to lose)', 4);
  const state = await H.state(page);
  if (state !== 'lost') {
    // two moves were enough after all (a lucky cascade): fine, leave through the win dialog
    await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="win"]:not(.pl-locked)', { timeout: 20000 });
    await page.click('[data-action="map"]');
    await page.waitForFunction(() => window.__play.state() === 'none', null, { timeout: 8000 });
    return false;
  }
  await page.waitForSelector('.k-overlay.k-open:not(.k-arming) .k-dialog[data-pl="lose"]:not(.pl-locked)', { timeout: 10000 });
  const missing = await page.evaluate(() => {
    const s = window.__play.snapshot();
    return { open: s.goals.filter((g) => !g.done).length, chips: document.querySelectorAll('.pl-dlg__goals .pl-goal').length, movesShown: document.querySelector('.pl-moves__n').textContent, out: document.querySelector('.pl-moves').classList.contains('pl-moves--out') };
  });
  ok(missing.chips === missing.open, `${key}: the lose dialog lists the ${missing.open} unmet goals (shows ${missing.chips})`);
  ok(missing.movesShown === '0' && missing.out, key + ': the moves numeral shows 0, marked as out');
  ok((await save(page)).lives === before.lives, key + ': no life taken while the dialog is open');
  await page.click('[data-action="giveUp"]');
  await page.waitForFunction(() => window.__play.state() === 'none', null, { timeout: 8000 });
  ok((await save(page)).lives === Math.max(0, before.lives - 1), key + ': giving up cost exactly one life');
  return true;
}

(async () => {
  const browser = await chromium.launch();
  let failed = null;
  let wins = 0;
  let losses = 0;
  try {
    for (const [i, lang] of ['en', 'ar'].entries()) {
      const page = await H.openHarness(browser, { w: i === 0 ? 360 : 412, h: i === 0 ? 640 : 915, lang, query: `level=none&fast=1&seed=${21 + i}&tut=0&inv=0&coins=90000`, problems, tag: `[levels ${lang}]` });
      const keys = lang === 'en' ? HARNESS.concat(REAL.filter((_, k) => k % 2 === 0)) : HARNESS.filter((_, k) => k % 3 === 0).concat(REAL.filter((_, k) => k % 2 === 1));
      for (const key of keys) {
        const t0 = Date.now();
        await page.evaluate(() => window.__demo.profile.grant([{ kind: 'lives' }]));
        await toWin(page, key);
        wins++;
        const lost = await toLoss(page, key);
        if (lost) losses++;
        console.log(`  ✓ ${String(key).padEnd(7)} [${lang}] won, ${lost ? 'lost' : 'won again (2 moves were enough)'}  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        if (problems.length > 0) throw new Error('console problems');
      }
      await page.context().close();
    }
  } catch (err) {
    failed = err;
  }
  await browser.close();
  if (problems.length > 0) console.log('\nCONSOLE PROBLEMS (' + problems.length + '):\n  ' + problems.slice(0, 12).join('\n  '));
  if (failed) console.log('\n' + (failed.stack || failed.message));
  if (failed || problems.length > 0) {
    console.log('\nplay levels: FAILED');
    process.exit(1);
  }
  console.log(`\nplay levels: PASSED — ${wins} wins, ${losses} losses, ${checks} checks, 0 console errors / warnings`);
})();
