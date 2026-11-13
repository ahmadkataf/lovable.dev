/**
 * Driving the REAL game for the store captures (used by make-screenshots.cjs).
 *
 * Everything here goes through what a player has: the page of the game itself (src/main.ts), a save
 * that stands for normal progress (`?save=`), taps on the game's own buttons, and swipes passed to
 * the play screen's own move entry point (`window.__play.swap`, the function a finger swipe ends in).
 * Nothing is drawn over the game, no test level is used, and the store is switched OFF
 * (`fakestore=0`): the browser has no Google Play, so the game shows exactly what it shows without a
 * store — coins and boosters, never a made-up price.
 *
 * URL flags used (src/ui/flags.ts, src/play/index.ts): debug=1 (the hooks), lang, save, seed (the
 * level's random seed, so a capture can be repeated and audited), still=1 on the title and the map
 * (their idle sparkle loops stand still), fast=1 only while a level is played through to its result.
 *
 *   makeSave(opts)                    a save for a player who has cleared levels 1..reached
 *   openGame(browser, opts)           a page with the game booted            → page
 *   startLevel(page, level, picks)    map → level intro → (tap boosters) → Play, as a player does
 *   planMoment(page, spec)            look ahead with the game's own engine for a move worth showing
 *   burst(page, trigger, opts)        genuine frames of the running effect   → [{ png, t }]
 */
const { sleep } = require('./lib.cjs');

const DAY = 86400000;

/** Local-calendar day number of an instant (the same rule as src/state `localDayNumber`). */
function dayNumber(ms) {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

const TIP_IDS = ['match', 'collect', 'beam', 'nova', 'prism', 'combo', 'sand', 'sand2', 'stone', 'lamp', 'chain', 'vine'];

/** Stars of an already cleared level: a believable mix (about half 3★, a third 2★, the rest 1★). */
function starsFor(level) {
  const v = (level * 37 + ((level * level) % 11) * 5) % 20;
  return v < 10 ? 3 : v < 17 ? 2 : 1;
}

/**
 * A save for a player in mid-journey (field names: src/state/types.ts SaveData):
 * levels 1..reached cleared with mixed stars, every tip seen, every booster introduced.
 *   reached       last cleared level (the next one is the player's current level)
 *   coins, lives  balance and lives (5 = full)
 *   boosters      inventory
 *   caravan       wins in a row (the Caravan streak)
 *   daily         'claimed' (today's gift already taken — nothing pops up) or 'ready' (a gift waits)
 *   dailyStreak   days claimed in a row before today
 */
function makeSave(opts) {
  const o = Object.assign({ reached: 46, coins: 3450, lives: 5, boosters: {}, caravan: 0, daily: 'claimed', dailyStreak: 3 }, opts || {});
  const now = Date.now();
  const today = dayNumber(now);
  const levels = {};
  let total = 0;
  for (let i = 1; i <= o.reached; i++) {
    const stars = starsFor(i);
    levels[i] = { stars, best: 3000 + ((i * 373) % 4000) + stars * 1500 };
    total += levels[i].best;
  }
  return {
    version: 1,
    levels,
    coins: o.coins,
    lives: o.lives,
    lifeTimer: o.lives >= 5 ? 0 : now - 400000,
    boosters: Object.assign({ hammer: 3, freeSwap: 2, shuffle: 2, extraMoves: 2, prism: 2, beamNova: 2 }, o.boosters),
    settings: { sfx: true, music: true, haptics: true, lang: null },
    dailyDay: o.daily === 'ready' ? today - 1 : today,
    dailyStreak: o.dailyStreak,
    seen: TIP_IDS.map((id) => 'tut.' + id),
    stats: { played: o.reached + 9, won: o.reached, bestCascade: 6, totalScore: total },
    firstDay: today - 30,
    gifted: ['beamNova', 'hammer', 'freeSwap', 'prism', 'shuffle', 'extraMoves'],
    caravan: o.caravan,
  };
}

function encodeSave(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function gameUrl(base, query) {
  const q = Object.assign({ debug: '1', fakestore: '0' }, query || {});
  return base + '?' + Object.keys(q).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
}

/**
 * Opens the game in a fresh browser context and waits until its first screen is up.
 *   opts: { base, lang, device: { w, h, scale }, save (object), query: { seed, still, fast, screen }, problems: [] }
 */
async function openGame(browser, opts) {
  const d = opts.device;
  const context = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.scale,
    hasTouch: true,
    isMobile: true,
    locale: opts.lang === 'ar' ? 'ar' : 'en-US',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const tag = opts.tag || '';
  if (opts.problems) {
    page.on('console', (msg) => {
      if (msg.type() === 'error') opts.problems.push(tag + ' [console] ' + msg.text());
    });
    page.on('pageerror', (err) => opts.problems.push(tag + ' [exception] ' + err.message));
  }
  const query = Object.assign({ lang: opts.lang }, opts.query || {});
  if (opts.save) query.save = encodeSave(opts.save);
  await page.goto(gameUrl(opts.base, query), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__booted === true && !!window.__app && typeof window.__app.goto === 'function', null, { timeout: 45000 });
  // the bundled font must be the one on screen, never a fallback
  await page.evaluate(() => document.fonts.ready);
  await sleep(400);
  return page;
}

async function closeGame(page) {
  await page.context().close();
}

const goto = (page, screen, arg) => page.evaluate(([s, a]) => window.__app.goto(s, a), [screen, arg === undefined ? null : arg]);

/** Waits until the play screen accepts a move (the board has settled). */
async function waitPlayable(page, timeout) {
  await page.waitForFunction(() => window.__play && window.__play.state() === 'play' && window.__play.isIdle(), null, { timeout: timeout || 45000 });
}

/**
 * Starts a level the way a player does: the level's intro dialog, a tap on each start booster in
 * `picks` (e.g. ['beamNova', 'prism']), then the Play button. Returns the start boosters the level
 * really began with (picked ones + what the Caravan brings).
 */
async function startLevel(page, level, picks) {
  await goto(page, 'map', { focusLevel: level });
  await sleep(500);
  await page.evaluate(() => window.__app.kit.closeAll());
  await sleep(250);
  await goto(page, 'intro', level);
  await page.waitForSelector('[data-dialog="intro"] [data-act="intro-play"]', { timeout: 15000 });
  await sleep(500);
  for (const id of picks || []) {
    await page.click('[data-dialog="intro"] [data-booster="' + id + '"]');
    await sleep(150);
  }
  const boosters = await page.evaluate((ids) => {
    const out = {};
    for (const id of ids) out[id] = true;
    const caravan = window.__app.profile.caravanBoosters();
    for (const id of Object.keys(caravan)) if (caravan[id]) out[id] = true;
    return out;
  }, picks || []);
  await page.click('[data-dialog="intro"] [data-act="intro-play"]');
  await waitPlayable(page);
  return boosters;
}

/**
 * Looks ahead with the game's own engine (src/engine — the same code the play screen runs, same
 * level, same seed, same start boosters) for a short line of play that ends in a move worth
 * showing. Nothing is changed on screen; the moves found are then really played.
 *
 *   spec: { level, boosters: {…}, seeds: [n, …], depth: moves in the line (1..3), wish: name, min: score }
 *   → { seed, moves: [{ a, b }, …], score, stats } — the best line of the first seed that reaches `min`,
 *     otherwise the best line of all seeds.
 *
 * Wishes (what the last move of the line should be):
 *   'beam'      a beam fires along its line and sets off more (chain reaction)
 *   'cross'     a swap of two specials (beam + beam, beam + nova, nova + nova)
 *   'prism'     a prism swapped with a special: every gem of one colour turns into that special
 *   'cascade'   a long chain of falls and matches (praise word on screen)
 *   'calm'      nothing — the opening position itself (score = how many specials stand on the board)
 */
async function planMoment(page, spec) {
  return page.evaluate(async (s) => {
    const { Game } = await import('/src/engine/index.ts');
    const level = window.__app.world.levels[s.level - 1];
    if (!level || level.id !== s.level) throw new Error('level ' + s.level + ' is not in the shipped level list');
    const isSpecial = (k) => k === 'beamH' || k === 'beamV' || k === 'nova' || k === 'prism';

    function stats(result, before) {
      const out = { fx: {}, fxCount: 0, cascades: 0, pieces: 0, created: 0, firstFx: [], status: result.snapshot.status, specialsLeft: 0, cells: before.cells.length };
      let firstActivate = true;
      for (const step of result.steps) {
        if (step.type === 'activate') {
          for (const fx of step.fx) {
            out.fx[fx.kind] = (out.fx[fx.kind] || 0) + 1;
            out.fxCount++;
            if (firstActivate) out.firstFx.push(fx.kind);
          }
          firstActivate = false;
        } else if (step.type === 'transform' && step.reason === 'prismCombo') {
          out.fx.prismCombo = (out.fx.prismCombo || 0) + 1;
          out.transformed = step.changes.length;
        } else if (step.type === 'clear') {
          if (step.cascade > out.cascades) out.cascades = step.cascade;
          for (const hit of step.hits) if (hit.result === 'removed' || hit.result === 'activated') out.pieces++;
          out.created += step.created.length;
        }
      }
      for (const cell of result.snapshot.cells) if (cell.piece && isSpecial(cell.piece.kind)) out.specialsLeft++;
      return out;
    }

    function score(wish, st, moveIndex) {
      if (st.status !== 'playing') return -1;
      const n = (k) => st.fx[k] || 0;
      const beams = n('beamH') + n('beamV');
      let v = -1;
      if (wish === 'beam') {
        // a single beam opens the move (not a swap combo), and it sets off other specials
        if (st.firstFx.length === 1 && (st.firstFx[0] === 'beamH' || st.firstFx[0] === 'beamV') && !n('cross') && !n('bigCross') && !n('prismAll') && !n('prismCombo')) {
          v = 20 + 14 * Math.min(4, st.fxCount - 1) + Math.min(30, st.pieces) + 4 * Math.min(3, st.specialsLeft);
        }
      } else if (wish === 'cross') {
        if (n('bigCross')) v = 100;
        else if (n('bigNova')) v = 80;
        else if (n('cross')) v = 60;
        if (v > 0) v += 6 * Math.min(4, st.fxCount - 1) + 3 * Math.min(3, st.specialsLeft) + Math.min(20, st.pieces / 3);
      } else if (wish === 'prism') {
        if (n('prismCombo')) v = 60 + Math.min(30, 3 * (st.transformed || 0)) + 3 * Math.min(3, st.specialsLeft);
      } else if (wish === 'cascade') {
        if (st.cascades >= 3 && !n('prismAll')) v = 12 * Math.min(8, st.cascades) + Math.min(30, st.pieces) + 5 * Math.min(4, st.created) + 4 * Math.min(4, st.fxCount);
      }
      // sooner is better: the counters still look like the start of a level
      return v < 0 ? v : v - 2 * moveIndex;
    }

    let best = null;
    for (const seed of s.seeds) {
      const root = new Game(level, { seed, boosters: s.boosters });
      if (s.wish === 'calm') {
        let specials = 0;
        for (const cell of root.snapshot().cells) if (cell.piece && isSpecial(cell.piece.kind)) specials++;
        const cand = { seed, moves: [], score: specials, stats: { specials } };
        if (!best || cand.score > best.score) best = cand;
        if (cand.score >= s.min) return cand;
        continue;
      }
      const visit = (game, line) => {
        const before = game.snapshot();
        for (const move of game.validMoves()) {
          const next = game.clone();
          const result = next.swap(move.a, move.b);
          if (!result.accepted) continue;
          const st = stats(result, before);
          const v = score(s.wish, st, line.length);
          if (v > 0 && (!best || v > best.score)) best = { seed, moves: line.concat([move]), score: v, stats: st };
          // look further only along quiet moves (they keep the specials on the board)
          if (line.length + 1 < s.depth && st.status === 'playing' && st.fxCount === 0 && st.cascades <= 2) visit(next, line.concat([move]));
        }
      };
      visit(root, []);
      if (best && best.score >= s.min) return best;
    }
    return best;
  }, spec);
}

/** The board on screen must be the one the look-ahead was made on (same level, seed and boosters). */
async function boardMatches(page, spec, seed) {
  return page.evaluate(
    async ([s, sd]) => {
      const { Game } = await import('/src/engine/index.ts');
      const level = window.__app.world.levels[s.level - 1];
      const want = new Game(level, { seed: sd, boosters: s.boosters }).snapshot();
      const got = window.__play.snapshot();
      if (!got || got.cells.length !== want.cells.length) return false;
      for (let i = 0; i < got.cells.length; i++) {
        const a = got.cells[i].piece;
        const b = want.cells[i].piece;
        if (!a !== !b) return false;
        if (a && (a.kind !== b.kind || a.color !== b.color || a.chained !== b.chained)) return false;
      }
      return true;
    },
    [spec, seed],
  );
}

/** Plays one move through the play screen's own entry point and waits for the board to settle. */
async function playMove(page, move) {
  await page.evaluate((m) => window.__play.swap(m.a, m.b), move);
  await sleep(120);
  await waitPlayable(page);
}

const setPaused = (page, on) => page.evaluate((v) => window.__app.shell.setPaused(v), on);

/**
 * Genuine frames of a running effect. `trigger` starts it (a move); then, `count` times: let the
 * game run for `step` ms of real time, hold it (the app's own pause, as when a phone call comes
 * in), take the screenshot, let it run on. Nothing is stepped by hand: canvas and HUD animate
 * together exactly as on a device. Returns [{ png, t }] with t = ms of running time since the trigger.
 */
async function burst(page, trigger, opts) {
  const o = Object.assign({ lead: 150, step: 60, count: 14 }, opts || {});
  const frames = [];
  await trigger();
  let t = 0;
  for (let i = 0; i < o.count; i++) {
    const wait = i === 0 ? o.lead : o.step;
    const t0 = Date.now();
    await sleep(wait);
    await setPaused(page, true);
    t += Date.now() - t0;
    const png = await page.screenshot({ type: 'png' });
    frames.push({ png, t });
    await setPaused(page, false);
  }
  return frames;
}

module.exports = {
  dayNumber,
  starsFor,
  makeSave,
  encodeSave,
  gameUrl,
  openGame,
  closeGame,
  goto,
  waitPlayable,
  startLevel,
  planMoment,
  boardMatches,
  playMove,
  setPaused,
  burst,
};
