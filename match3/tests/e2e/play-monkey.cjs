/**
 * Monkey torture test of the play screen (dev harness play-demo.html, REAL pointer events).
 *
 *   npx vite --port 5184 --strictPort            (in another terminal)
 *   node tests/e2e/play-monkey.cjs [levels] [seed]      defaults: 30 levels, seed 1
 *
 * A seeded monkey plays `levels` random levels end to end on the fast setting: hinted moves,
 * random swipes in every direction (also off the board and into blockers), taps, rapid bursts
 * made while the board is still resolving, every booster (use, cancel, buy when empty), pause /
 * resume / restart / quit, Back presses at any moment, app pause / resume in the middle of an
 * animation, resizes and rotations, real multi-touch (a second finger while the first holds a
 * gem, a touch cancelled in mid-drag), levels started twice or over a running one, the lose dialog
 * (coins, video, shop, retry, give up) and the win dialog (finale skipped or not, double coins).
 *
 * The oracle is independent of the screen's own bookkeeping:
 *  - after every action that leaves the board idle, the RENDERER's model (window.__play.model():
 *    which piece is drawn on which cell, at which size) must equal the ENGINE's snapshot, every
 *    piece standing at rest, and the header must show the engine's moves, score and goals;
 *  - coins, lives and boosters in the saved profile must have changed exactly as docs/DESIGN.md §5
 *    allows for what the monkey did (prices and rewards are restated here, not read from the app);
 *  - a move is spent exactly when the gesture was a valid swap by the engine's own list of moves;
 *  - when a level is left, nothing may be left running (frames, tweens, timers, dialogs, flyers).
 * Any console error / warning, page error or unhandled rejection fails the run (the screen warns
 * in dev builds whenever it had to snap the picture to the engine).
 */
const { chromium } = require('playwright');
const H = require('./play-harness.cjs');

const LEVELS = Math.max(1, Number(process.argv[2]) || 30);
const SEED = Number(process.argv[3]) || 1;
const VERBOSE = process.env.MONKEY_VERBOSE === '1';

// ───────────────────────────── the rules, restated (docs/DESIGN.md §5) ─────────────────────────────

const PRICE = { hammer: 650, freeSwap: 600, shuffle: 400 };
const CONTINUE_PRICE = [900, 1900, 2900];
const COIN_MOVES = 5;
const AD_MOVES = 3;
const MAX_LIVES = 5;
const firstClear = (stars) => 20 + 10 * stars;
const replay = (prev, stars) => 10 * Math.max(0, stars - prev);

const SIZES = [
  [320, 480],
  [360, 640],
  [360, 760],
  [412, 915],
  [800, 1280],
  [640, 360],
  [915, 412],
  [1280, 800],
  [480, 320],
];
const HARNESS_LEVELS = ['mix', 'easy', 'hard', 'fx', 'combo', 'lamp', 'vine', 'holes', 'tiny', 'goals4'];

// ───────────────────────────── seeded randomness ─────────────────────────────

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(SEED * 7919 + 13);
const int = (n) => Math.floor(rnd() * n);
const pick = (list) => list[int(list.length)];
const chance = (p) => rnd() < p;

// ───────────────────────────── bookkeeping ─────────────────────────────

const problems = [];
const stats = {
  levels: 0,
  actions: 0,
  boardChecks: 0,
  moves: 0,
  invalid: 0,
  bursts: 0,
  boosters: 0,
  buys: 0,
  pauses: 0,
  backs: 0,
  appPauses: 0,
  resizes: 0,
  restarts: 0,
  quits: 0,
  wins: 0,
  losses: 0,
  continues: 0,
  ads: 0,
  retries: 0,
  giveUps: 0,
  skips: 0,
  doubles: 0,
  rapidStarts: 0,
  touches: 0,
};
const trail = [];
function note(what) {
  trail.push(what);
  if (trail.length > 40) trail.shift();
  if (VERBOSE) console.log('    · ' + what);
}

class Failure extends Error {}
function fail(what) {
  throw new Failure(what);
}
function must(cond, what) {
  if (!cond) fail(what);
}

/** What the saved profile must contain. */
const ledger = { coins: 0, lives: 0, boosters: { hammer: 0, freeSwap: 0, shuffle: 0 }, records: {} };

async function readSave(page) {
  return page.evaluate(() => window.__demo.save());
}

async function syncLedger(page) {
  const s = await readSave(page);
  ledger.coins = s.coins;
  ledger.lives = s.lives;
  ledger.boosters = { hammer: s.boosters.hammer, freeSwap: s.boosters.freeSwap, shuffle: s.boosters.shuffle };
  ledger.records = {};
  for (const id of Object.keys(s.levels)) ledger.records[id] = s.levels[id].stars;
}

async function checkEconomy(page, where, ctx) {
  if (ctx) {
    // the profile is credited the moment the engine reports the win
    const o = await observe(page);
    if (o.status === 'won') creditWin(o, ctx);
  }
  const s = await readSave(page);
  const got = { coins: s.coins, lives: s.lives, hammer: s.boosters.hammer, freeSwap: s.boosters.freeSwap, shuffle: s.boosters.shuffle };
  const want = { coins: ledger.coins, lives: ledger.lives, hammer: ledger.boosters.hammer, freeSwap: ledger.boosters.freeSwap, shuffle: ledger.boosters.shuffle };
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${where}: economy — saved ${JSON.stringify(got)}, allowed ${JSON.stringify(want)}`);
}

// ───────────────────────────── observing the page ─────────────────────────────

function observe(page) {
  return page.evaluate(() => {
    const p = window.__play;
    const info = p.info();
    const open = document.querySelectorAll('.k-overlay.k-open');
    const top = open.length > 0 ? open[open.length - 1] : null;
    let dialog = null;
    if (top) {
      const panel = top.querySelector('.k-dialog');
      const title = top.querySelector('.k-dialog__title');
      const act = (name) => {
        const b = top.querySelector('[data-action="' + name + '"]');
        if (!b) return null;
        const shown = b.getClientRects().length > 0 && getComputedStyle(b).display !== 'none';
        return { disabled: !!b.disabled, shown };
      };
      dialog = {
        name: (panel && panel.dataset.pl) || (title && /harness/i.test(title.textContent) ? 'shop' : 'other'),
        booster: (panel && panel.dataset.booster) || null,
        arming: top.classList.contains('k-arming'),
        locked: !!(panel && panel.classList.contains('pl-locked')),
        actions: {
          continue: act('continue'),
          adContinue: act('adContinue'),
          shop: act('shop'),
          retry: act('retry'),
          giveUp: act('giveUp'),
          double: act('double'),
          next: act('next'),
          map: act('map'),
          buy: act('buy'),
        },
        price: (() => {
          const n = top.querySelector('[data-action="continue"] .k-price, [data-action="buy"] .k-price');
          return n ? Number(n.textContent.replace(/[^\d]/g, '')) : null;
        })(),
        count: open.length,
      };
    }
    const s = p.snapshot();
    return {
      state: p.state(),
      idle: p.isIdle(),
      level: p.level(),
      info,
      dialog,
      closing: !!document.querySelector('.k-overlay.k-closing'),
      moves: s ? s.movesLeft : -1,
      status: s ? s.status : 'none',
      stars: s ? s.stars : 0,
      frozen: p.loop().frozen,
      boosters: Array.prototype.map.call(document.querySelectorAll('.pl-boost'), (n) => n.dataset.booster),
    };
  });
}

/** Wait until the page is in a state the monkey can act on. */
async function settle(page, timeout = 40000) {
  await page.waitForFunction(
    () => {
      const p = window.__play;
      const st = p.state();
      if (st === 'none') return true;
      if (document.querySelector('.k-overlay.k-closing')) return false;
      const open = document.querySelectorAll('.k-overlay.k-open');
      if (open.length > 0) {
        const top = open[open.length - 1];
        const panel = top.querySelector('.k-dialog');
        return !top.classList.contains('k-arming') && !(panel && panel.classList.contains('pl-locked'));
      }
      if (st === 'play') return p.isIdle();
      if (st === 'finale') return true;
      return false; // intro / won / lost: something is about to appear
    },
    null,
    { timeout },
  );
}

/** The renderer's model against the engine's snapshot + the header against both. Only while idle. */
async function checkBoard(page, where) {
  // let the last cosmetic tweens (landing squash, score roll, goal flyers) run out
  await page
    .waitForFunction(() => !window.__play.isIdle() || (window.__play.loop().tweens === 0 && window.__play.info().flyers === 0), null, { timeout: 8000 })
    .catch(() => undefined);
  const result = await page.evaluate(() => {
    const p = window.__play;
    if (!p.isIdle()) return { skip: 'not idle' };
    if (p.loop().tweens !== 0) return { skip: 'tweens still running' };
    const s = p.snapshot();
    const m = p.model();
    const info = p.info();
    const errs = [];
    const say = (t) => {
      if (errs.length < 12) errs.push(t);
    };
    if (m.cols !== s.cols || m.rows !== s.rows) say(`size ${m.cols}×${m.rows} ≠ ${s.cols}×${s.rows}`);
    const byId = new Map();
    for (const piece of m.pieces) {
      if (piece.dying) say(`piece ${piece.id} is still leaving`);
      if (byId.has(piece.id)) say(`piece ${piece.id} is drawn twice`);
      byId.set(piece.id, piece);
    }
    let expected = 0;
    const sel = info.selection;
    for (let i = 0; i < s.cells.length; i++) {
      const cell = s.cells[i];
      const c = i % s.cols;
      const r = Math.floor(i / s.cols);
      if ((m.exists[i] === 1) !== cell.exists) say(`cell ${c},${r} exists: shown ${m.exists[i]}, engine ${cell.exists}`);
      if (m.sand[i] !== cell.sand) say(`sand at ${c},${r}: shown ${m.sand[i]}, engine ${cell.sand}`);
      const piece = cell.exists ? cell.piece : null;
      if (!piece) {
        if (m.grid[i] !== -1) say(`cell ${c},${r} is empty in the engine but shows piece ${m.grid[i]}`);
        continue;
      }
      expected++;
      if (m.grid[i] !== piece.id) say(`cell ${c},${r}: shows ${m.grid[i]}, engine has ${piece.id}`);
      const v = byId.get(piece.id);
      if (!v) {
        say(`piece ${piece.id} (${piece.kind}) at ${c},${r} is not drawn`);
        continue;
      }
      if (v.kind !== piece.kind || v.color !== piece.color || v.hp !== piece.hp || v.chained !== piece.chained)
        say(`piece ${piece.id}: drawn ${v.kind}/${v.color}/hp${v.hp}/${v.chained ? 'chained' : 'free'}, engine ${piece.kind}/${piece.color}/hp${piece.hp}/${piece.chained ? 'chained' : 'free'}`);
      if (Math.abs(v.x - c) > 0.001 || Math.abs(v.y - r) > 0.001) say(`piece ${piece.id} drawn at ${v.x},${v.y}, stands on ${c},${r}`);
      const held = sel && sel.c === c && sel.r === r;
      const scale = held ? 1.12 : 1;
      if (Math.abs(v.sx - scale) > 0.005 || Math.abs(v.sy - scale) > 0.005) say(`piece ${piece.id} at ${c},${r} has scale ${v.sx.toFixed(3)}×${v.sy.toFixed(3)} (want ${scale})`);
      if (Math.abs(v.ox) > 0.005 || Math.abs(v.oy) > 0.005) say(`piece ${piece.id} at ${c},${r} is offset by ${v.ox.toFixed(3)},${v.oy.toFixed(3)}`);
      if (v.rot !== 0) say(`piece ${piece.id} at ${c},${r} is rotated`);
      if (v.alpha < 0.995) say(`piece ${piece.id} at ${c},${r} has alpha ${v.alpha.toFixed(2)}`);
      if (v.flash > 0.005) say(`piece ${piece.id} at ${c},${r} still glows (${v.flash.toFixed(2)})`);
      if (v.lift !== !!held) say(`piece ${piece.id} at ${c},${r} lift=${v.lift}`);
      if (v.clipped) say(`piece ${piece.id} at ${c},${r} is still clipped`);
      if (Math.abs(v.chainAlpha - (piece.chained ? 1 : 0)) > 0.005) say(`piece ${piece.id} at ${c},${r} chain alpha ${v.chainAlpha.toFixed(2)}`);
    }
    if (m.pieces.length !== expected) say(`${m.pieces.length} pieces drawn, engine has ${expected}`);
    if (m.dim > 0.01) say(`the board is still dimmed (${m.dim.toFixed(2)})`);
    if (m.targeting !== (info.targeting !== null)) say(`targeting veil ${m.targeting} but targeting=${info.targeting}`);
    if ((m.selection !== null) !== (sel !== null)) say('selection ring out of step');

    // header
    const digits = (t) => Number(String(t).replace(/[^\d]/g, ''));
    const movesText = document.querySelector('.pl-moves__n').textContent;
    if (Number(movesText) !== s.movesLeft) say(`header moves "${movesText}", engine ${s.movesLeft}`);
    const scoreText = document.querySelector('.pl-score__n').textContent;
    if (digits(scoreText) !== s.score) say(`header score "${scoreText}", engine ${s.score}`);
    const chips = document.querySelectorAll('.pl-goals .pl-goal');
    if (chips.length !== s.goals.length) say(`${chips.length} goal chips, ${s.goals.length} goals`);
    for (let i = 0; i < s.goals.length && i < chips.length; i++) {
      const g = s.goals[i];
      const done = chips[i].classList.contains('pl-goal--done');
      if (done !== g.done) say(`goal ${i} done: shown ${done}, engine ${g.done}`);
      if (!g.done) {
        const n = digits(chips[i].querySelector('.pl-goal__n').textContent);
        if (n !== g.target - g.current) say(`goal ${i} shows ${n}, engine has ${g.target - g.current} to go`);
      }
    }
    const shown = p.shown();
    if (shown.moves !== s.movesLeft || shown.score !== s.score) say(`screen bookkeeping moves ${shown.moves} / score ${shown.score}, engine ${s.movesLeft} / ${s.score}`);
    if (info.flyers !== 0) say(`${info.flyers} flyers left over the header`);

    // geometry: the board must lie inside the stage, clear of the header and the tray
    const cols = s.cols;
    const rows = s.rows;
    const a = p.cell(0, 0);
    const z = p.cell(cols - 1, rows - 1);
    const half = shown.cell / 2;
    const root = document.querySelector('.pl-root');
    const box = root.getBoundingClientRect();
    const hud = document.querySelector('.pl-hud').getBoundingClientRect();
    const ring = document.querySelector('.pl-moves__ring').getBoundingClientRect();
    const tray = document.querySelector('.pl-tray');
    const trayBox = tray && getComputedStyle(tray).display !== 'none' ? tray.getBoundingClientRect() : null;
    if (a.x - half < box.left - 0.5 || z.x + half > box.right + 0.5 || a.y - half < box.top - 0.5 || z.y + half > box.bottom + 0.5) say('the board leaves the screen');
    if (root.classList.contains('pl-land')) {
      const rtl = document.documentElement.dir === 'rtl';
      if (!rtl && a.x - half < hud.right - 0.5) say('the board overlaps the side panel');
      if (rtl && z.x + half > hud.left + 0.5) say('the board overlaps the side panel');
    } else {
      if (a.y - half < Math.max(hud.bottom, ring.bottom) - 0.5) say(`the board (top ${(a.y - half).toFixed(1)}) overlaps the header (bottom ${Math.max(hud.bottom, ring.bottom).toFixed(1)})`);
      if (trayBox && z.y + half > trayBox.top + 0.5) say(`the board (bottom ${(z.y + half).toFixed(1)}) overlaps the tray (top ${trayBox.top.toFixed(1)})`);
    }
    if (shown.cell < 22) say(`cells are only ${shown.cell} px`);
    return { errs };
  });
  if (result.skip) return false;
  stats.boardChecks++;
  if (result.errs.length > 0) fail(`${where}: the picture differs from the engine\n      ` + result.errs.join('\n      '));
  // booster badges = saved inventory = ledger
  const badges = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.pl-boost').forEach((n) => {
      const b = n.querySelector('.k-badge');
      out[n.dataset.booster] = b ? b.textContent.trim() : '';
    });
    return out;
  });
  for (const id of Object.keys(badges)) {
    const want = ledger.boosters[id] > 0 ? String(ledger.boosters[id]) : '+';
    if (badges[id] !== want) fail(`${where}: booster badge ${id} shows "${badges[id]}", inventory is ${ledger.boosters[id]}`);
  }
  return true;
}

// ───────────────────────────── gestures ─────────────────────────────

async function geometry(page) {
  return page.evaluate(() => {
    const p = window.__play;
    const s = p.snapshot();
    const o = p.cell(0, 0);
    const cell = p.shown().cell;
    return {
      cols: s.cols,
      rows: s.rows,
      cell,
      x0: o.x - cell / 2,
      y0: o.y - cell / 2,
      cells: s.cells.map((c) => (c.exists ? { piece: c.piece ? { kind: c.piece.kind, color: c.piece.color, chained: c.piece.chained } : null, sand: c.sand } : null)),
      valid: p.validMoves(),
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

const cellAt = (g, x, y) => {
  const c = Math.floor((x - g.x0) / g.cell);
  const r = Math.floor((y - g.y0) / g.cell);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return null;
  return g.cells[r * g.cols + c] ? { c, r } : null;
};
const centre = (g, c, r) => ({ x: g.x0 + (c + 0.5) * g.cell, y: g.y0 + (r + 0.5) * g.cell });
const pieceAt = (g, pos) => (pos && pos.c >= 0 && pos.r >= 0 && pos.c < g.cols && pos.r < g.rows && g.cells[pos.r * g.cols + pos.c] ? g.cells[pos.r * g.cols + pos.c].piece : null);
const pickable = (g, pos) => {
  const p = pieceAt(g, pos);
  return !!p && !p.chained && p.kind !== 'stone' && p.kind !== 'vine';
};
const isValid = (g, a, b) => g.valid.some((m) => (m.a.c === a.c && m.a.r === a.r && m.b.c === b.c && m.b.r === b.r) || (m.a.c === b.c && m.a.r === b.r && m.b.c === a.c && m.b.r === a.r));
const adjacent = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1;

const clampX = (g, x) => Math.max(1, Math.min(g.vw - 2, x));
const clampY = (g, y) => Math.max(1, Math.min(g.vh - 2, y));

/** A raw drag between two screen points. Returns what the input layer must make of it. */
async function rawSwipe(page, g, from, to) {
  const x0 = clampX(g, from.x);
  const y0 = clampY(g, from.y);
  const x1 = clampX(g, to.x);
  const y1 = clampY(g, to.y);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 * 2 + x1) / 3, (y0 * 2 + y1) / 3, { steps: 2 });
  await page.mouse.move(x1, y1, { steps: 2 });
  await page.mouse.up();
  const a = cellAt(g, x0, y0);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (!a || (ax === 0 && ay === 0)) return { a, b: null, commit: false };
  const horizontal = ax >= ay;
  const amount = Math.min(1, (horizontal ? ax : ay) / g.cell);
  const b = horizontal ? { c: a.c + (dx > 0 ? 1 : -1), r: a.r } : { c: a.c, r: a.r + (dy > 0 ? 1 : -1) };
  return { a, b, commit: amount >= 0.45, amount };
}

function randomPointNearBoard(g) {
  const pad = 1.3 * g.cell;
  return { x: g.x0 - pad + rnd() * (g.cols * g.cell + 2 * pad), y: g.y0 - pad + rnd() * (g.rows * g.cell + 2 * pad) };
}

// ───────────────────────────── chaos that must never change the outcome ─────────────────────────────

async function resize(page) {
  const [w, h] = pick(SIZES);
  await page.setViewportSize({ width: w, height: h });
  // the page sees the new size (and gets its resize event, dispatched with the next frame) a moment
  // later — on a loaded machine late enough for the geometry check to look at the old layout
  await page.waitForFunction(([vw, vh]) => window.innerWidth === vw && window.innerHeight === vh, [w, h], { timeout: 5000 });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  stats.resizes++;
  note(`resize ${w}×${h}`);
}

async function appPause(page) {
  await page.evaluate(() => window.__demo.pause(true));
  const frozen = await page.evaluate(() => window.__play.loop());
  must(frozen.frozen !== 0 && !frozen.running, 'the loop keeps running while the app is paused');
  await page.waitForTimeout(40 + int(220));
  const still = await page.evaluate(() => window.__play.loop());
  must(still.tweens === frozen.tweens, 'animation advanced while the app was paused');
  if (chance(0.3)) {
    // a swipe while paused must do nothing at all
    const g = await geometry(page);
    const a = centre(g, int(g.cols), int(g.rows));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + g.cell, a.y, { steps: 2 });
    await page.mouse.up();
  }
  await page.evaluate(() => window.__demo.pause(false));
  stats.appPauses++;
  note('app pause / resume');
}

async function chaos(page) {
  const roll = rnd();
  if (roll < 0.4) await resize(page);
  else if (roll < 0.8) await appPause(page);
  else {
    await resize(page);
    await appPause(page);
  }
}

// ───────────────────────────── dialogs ─────────────────────────────

async function clickAction(page, name) {
  await page.locator('.k-overlay.k-open').last().locator(`[data-action="${name}"]`).click();
}

async function back(page) {
  stats.backs++;
  return page.evaluate(() => window.__demo.back());
}

/** Reward the win that the engine has just reported (the profile is credited the moment it is won). */
function creditWin(o, ctx) {
  if (ctx.credited) return;
  ctx.credited = true;
  const stars = Math.max(1, Math.min(3, o.stars));
  const prev = ledger.records[String(o.level)] || 0;
  ctx.reward = prev > 0 ? replay(prev, stars) : firstClear(stars);
  ctx.stars = stars;
  ledger.coins += ctx.reward;
  if (stars > prev) ledger.records[String(o.level)] = stars;
  stats.wins++;
  note(`won level ${o.level} with ${stars}★ → +${ctx.reward} coins`);
}

async function handleDialog(page, o, ctx) {
  const d = o.dialog;
  switch (d.name) {
    case 'tip': {
      if (chance(0.3)) await back(page);
      else await clickAction(page, 'ok');
      note('tip closed');
      return;
    }
    case 'pause': {
      stats.pauses++;
      must(o.frozen !== 0, 'the game is not frozen behind the pause dialog');
      const roll = rnd();
      if (roll < 0.1) {
        const setting = pick(['sfx', 'music', 'haptics']);
        await page.locator(`.k-overlay.k-open [data-setting="${setting}"]`).click();
        note('pause: toggled ' + setting);
      } else if (roll < 0.5) {
        await clickAction(page, 'resume');
        note('pause: resume');
      } else if (roll < 0.62) {
        await back(page);
        note('pause: back');
      } else if (o.status === 'won') {
        // paused during the winning cascade: the level is won already, restart / quit just resume
        await clickAction(page, roll < 0.8 ? 'restart' : 'quit');
        note('pause on a won level: ' + (roll < 0.8 ? 'restart' : 'quit') + ' → resumes');
        await page.waitForFunction(() => window.__play.loop().frozen === 0, null, { timeout: 3000 });
        must((await observe(page)).state !== 'none', 'a won level was thrown away from the pause dialog');
      } else if (roll < 0.8) {
        ctx.leaving = 'restart';
        ctx.costly = o.info.movesMade > 0;
        await clickAction(page, 'restart');
        note('pause: restart' + (ctx.costly ? ' (costly)' : ''));
        if (!ctx.costly) {
          stats.restarts++;
          ctx.restarted();
        }
      } else {
        ctx.leaving = 'quit';
        ctx.costly = o.info.movesMade > 0;
        await clickAction(page, 'quit');
        note('pause: quit' + (ctx.costly ? ' (costly)' : ''));
        if (!ctx.costly) stats.quits++;
      }
      return;
    }
    case 'confirm': {
      must(ctx.leaving === 'restart' || ctx.leaving === 'quit', 'a confirm dialog nobody asked for');
      must(ctx.costly, 'leaving without a move made must not ask (it costs nothing)');
      const roll = rnd();
      if (roll < 0.6) {
        if (!o.info.lifeTaken) ledger.lives = Math.max(0, ledger.lives - 1);
        await clickAction(page, 'yes');
        note(`confirm ${ctx.leaving}: yes → lives ${ledger.lives}`);
        if (ctx.leaving === 'restart') {
          stats.restarts++;
          ctx.restarted();
        } else stats.quits++;
      } else if (roll < 0.85) {
        await clickAction(page, 'no');
        note('confirm: keep playing');
      } else {
        await back(page);
        note('confirm: back');
      }
      ctx.leaving = null;
      return;
    }
    case 'buy': {
      const id = d.booster;
      must(PRICE[id] !== undefined, 'buy dialog for an unknown booster ' + id);
      must(ledger.boosters[id] === 0, `buy dialog although ${ledger.boosters[id]} ${id} are owned`);
      must(d.price === PRICE[id], `price of ${id} shown ${d.price}, rule ${PRICE[id]}`);
      const canBuy = ledger.coins >= PRICE[id];
      must(d.actions.buy && d.actions.buy.disabled === !canBuy, `buy button disabled=${d.actions.buy && d.actions.buy.disabled} with ${ledger.coins} coins`);
      const roll = rnd();
      if (canBuy && roll < 0.55) {
        const before = await boardKey(page);
        ledger.coins -= PRICE[id];
        ledger.boosters[id] += 1;
        await clickAction(page, 'buy');
        stats.buys++;
        note(`bought ${id} → coins ${ledger.coins}`);
        if (id === 'shuffle') {
          // used at once
          await settle(page);
          const after = await boardKey(page);
          if (after !== before) {
            ledger.boosters.shuffle -= 1;
            stats.boosters++;
          }
        }
      } else if (d.actions.shop && d.actions.shop.shown && roll < 0.75) {
        await clickAction(page, 'shop');
        note('buy: to the shop');
      } else {
        await back(page);
        note('buy: closed');
      }
      return;
    }
    case 'shop': {
      // the harness' stand-in for the coin shop
      const top = page.locator('.k-overlay.k-open').last();
      if (chance(0.6)) {
        ledger.coins += 5000;
        await top.locator('.k-btn', { hasText: '+5000' }).click();
        note('shop: +5000');
      } else {
        await top.locator('.k-btn', { hasText: 'Close' }).click();
        note('shop: closed');
      }
      return;
    }
    case 'lose': {
      if (!ctx.lostSeen) {
        ctx.lostSeen = true;
        stats.losses++;
      }
      must(o.state === 'lost', 'lose dialog in state ' + o.state);
      const a = d.actions;
      const used = o.info.continues;
      if (used < CONTINUE_PRICE.length) {
        must(a.continue !== null, 'no coin continue although only ' + used + ' were used');
        must(d.price === CONTINUE_PRICE[used], `continue ${used + 1} costs ${d.price}, rule ${CONTINUE_PRICE[used]}`);
        must(a.continue.disabled === ledger.coins < CONTINUE_PRICE[used], `continue button disabled=${a.continue.disabled} with ${ledger.coins} coins`);
      } else must(a.continue === null, 'a fourth continue is offered');
      must((a.adContinue !== null) === (ctx.adsMode !== null && !o.info.adUsed), `video continue shown=${a.adContinue !== null} (ads ${ctx.adsMode}, used ${o.info.adUsed})`);
      // Back must not dismiss a result dialog
      if (chance(0.15)) {
        await back(page);
        await page.waitForTimeout(80);
        must((await observe(page)).dialog, 'Back dismissed the lose dialog');
      }
      const roll = rnd();
      const m0 = o.moves;
      if (a.continue && !a.continue.disabled && roll < 0.3) {
        ledger.coins -= CONTINUE_PRICE[used];
        await clickAction(page, 'continue');
        await settle(page);
        const now = await observe(page);
        must(now.state === 'play' && now.moves === m0 + COIN_MOVES, `coin continue: moves ${m0} → ${now.moves}, state ${now.state}`);
        must(now.info.continues === used + 1, 'continue not counted');
        ctx.lostSeen = false;
        stats.continues++;
        note(`continue for ${CONTINUE_PRICE[used]} → coins ${ledger.coins}`);
      } else if (a.adContinue && roll < 0.5) {
        const before = await page.evaluate(() => window.__demo.log.ads.length);
        await clickAction(page, 'adContinue');
        // while the video is asked for, no other choice may be taken
        if (chance(0.5)) await page.locator('.k-overlay.k-open').last().locator('[data-action="giveUp"]').click({ force: true, timeout: 1000 }).catch(() => undefined);
        await page.waitForFunction((n) => window.__demo.log.ads.length > n, before, { timeout: 5000 });
        await page.waitForTimeout(380);
        await settle(page);
        const now = await observe(page);
        if (ctx.adsMode === '1') {
          must(now.state === 'play' && now.moves === m0 + AD_MOVES, `video continue: moves ${m0} → ${now.moves}, state ${now.state}`);
          must(now.info.adUsed, 'video continue not marked as used');
          ctx.lostSeen = false;
        } else {
          must(now.state === 'lost' && now.moves === m0, 'a video that was not earned changed the level');
        }
        stats.ads++;
        note('video continue (' + ctx.adsMode + ')');
      } else if (a.shop && a.shop.shown && roll < 0.62) {
        await clickAction(page, 'shop');
        note('lose: to the shop');
      } else if (roll < 0.82) {
        if (!o.info.lifeTaken) ledger.lives = Math.max(0, ledger.lives - 1);
        await clickAction(page, 'retry');
        stats.retries++;
        note(`retry → lives ${ledger.lives}`);
        ctx.restarted();
      } else {
        if (!o.info.lifeTaken) ledger.lives = Math.max(0, ledger.lives - 1);
        await clickAction(page, 'giveUp');
        stats.giveUps++;
        note(`give up → lives ${ledger.lives}`);
      }
      return;
    }
    case 'win': {
      creditWin(o, ctx);
      must(o.state === 'won', 'win dialog in state ' + o.state);
      const a = d.actions;
      must((a.double !== null) === (ctx.adsMode !== null && ctx.reward > 0), `double-coins button shown=${a.double !== null} (ads ${ctx.adsMode}, reward ${ctx.reward})`);
      if (!ctx.winChecked) {
        ctx.winChecked = true;
        // the stars slam in one by one and the score counts up to the engine's final score
        await page.waitForTimeout(350 + ctx.stars * 320);
        const shown = await page.evaluate(() => ({
          stars: document.querySelectorAll('.pl-win .k-star.k-on').length,
          coins: (() => {
            const n = document.querySelector('.pl-win__coinsn');
            return n ? Number(n.textContent.replace(/[^\d]/g, '')) : 0;
          })(),
          moves: window.__play.snapshot().movesLeft,
        }));
        must(shown.stars === ctx.stars, `win dialog shows ${shown.stars} stars, engine ${ctx.stars}`);
        must(shown.coins === ctx.reward, `win dialog shows +${shown.coins} coins, rule ${ctx.reward}`);
        must(shown.moves === 0, 'the end bonus left moves unused');
        await page.waitForTimeout(450);
        const score = await page.evaluate(() => [Number(document.querySelector('.pl-win__scoren').textContent.replace(/[^\d]/g, '')), window.__play.snapshot().score]);
        must(score[0] === score[1], `win dialog score ${score[0]}, engine ${score[1]}`);
        await checkWonBoard(page);
      }
      const roll = rnd();
      if (a.double && !a.double.disabled && !ctx.doubled && roll < 0.45) {
        const before = await page.evaluate(() => window.__demo.log.ads.length);
        await clickAction(page, 'double');
        // leaving while the video is asked for must wait for its answer
        if (chance(0.5)) await page.locator('.k-overlay.k-open').last().locator('[data-action="next"]').click({ force: true, timeout: 1000 }).catch(() => undefined);
        await page.waitForFunction((n) => window.__demo.log.ads.length > n, before, { timeout: 5000 });
        await page.waitForTimeout(380);
        must((await observe(page)).state === 'won', 'the win dialog was left while the video was pending');
        if (ctx.adsMode === '1') {
          ledger.coins += ctx.reward;
          ctx.doubled = true;
          await page.waitForFunction(() => document.querySelector('[data-action="double"]').disabled, null, { timeout: 3000 });
        }
        stats.doubles++;
        note('double coins (' + ctx.adsMode + ')');
      } else if (roll < 0.7) {
        await clickAction(page, 'next');
        note('win: next');
        ctx.left = 'next';
      } else if (roll < 0.9) {
        await clickAction(page, 'map');
        note('win: map');
        ctx.left = 'map';
      } else {
        await back(page);
        note('win: back');
        ctx.left = 'map';
      }
      return;
    }
    default:
      fail('an unknown dialog is open: ' + JSON.stringify(d));
  }
}

/** After the finale the picture must equal the engine too. */
async function checkWonBoard(page) {
  const errs = await page.evaluate(() => {
    const p = window.__play;
    const s = p.snapshot();
    const m = p.model();
    const out = [];
    const byId = new Map(m.pieces.map((x) => [x.id, x]));
    for (let i = 0; i < s.cells.length; i++) {
      const piece = s.cells[i].exists ? s.cells[i].piece : null;
      if (!piece) {
        if (m.grid[i] !== -1) out.push('ghost at ' + i);
        continue;
      }
      const v = byId.get(piece.id);
      if (!v || m.grid[i] !== piece.id || v.kind !== piece.kind || v.color !== piece.color) out.push('cell ' + i + ' differs');
    }
    if (m.pieces.filter((x) => !x.dying).length !== s.cells.filter((c) => c.exists && c.piece).length) out.push('piece count');
    if (p.info().flyers !== 0) out.push(p.info().flyers + ' sparks left over the header');
    const moves = document.querySelector('.pl-moves__n').textContent;
    if (Number(moves) !== 0) out.push('header moves ' + moves);
    const score = Number(document.querySelector('.pl-score__n').textContent.replace(/[^\d]/g, ''));
    if (score !== s.score) out.push('header score ' + score + ' ≠ ' + s.score);
    return out.slice(0, 8);
  });
  if (errs.length > 0) fail('after the finale the picture differs from the engine: ' + errs.join('; '));
}

function boardKey(page) {
  return page.evaluate(() => {
    const s = window.__play.snapshot();
    return s ? s.cells.map((c) => (c.piece ? c.piece.id + ':' + c.piece.kind + ':' + c.piece.hp + (c.piece.chained ? 'c' : '') : '-') + c.sand).join(',') : '';
  });
}

// ───────────────────────────── actions on an idle board ─────────────────────────────

async function hintMove(page, o, withChaos) {
  const h = await page.evaluate(() => window.__play.hint());
  must(h, 'the engine has no move on an idle board');
  const m0 = o.moves;
  const turns0 = await page.evaluate(() => window.__play.turns());
  // (tap-tap only from a clean slate: with a gem already selected the first tap would mean something else)
  const taps = chance(0.3) && !o.info.selection;
  if (taps) await H.tapTap(page, h.a, h.b);
  else await H.swipe(page, h.a, h.b);
  note(`hint ${taps ? 'tap-tap' : 'swipe'} ${h.a.c},${h.a.r}→${h.b.c},${h.b.r}`);
  let extra = 0;
  if (withChaos) {
    const roll = rnd();
    if (roll < 0.35) {
      await page.waitForTimeout(int(140));
      await chaos(page);
    } else if (roll < 0.55) {
      // Back in the middle of the turn: the pause dialog freezes the animation; it is handled next
      await page.waitForTimeout(int(120));
      await back(page);
      note('back mid-turn');
    } else {
      // swipes made while the board resolves: one is remembered at a time and played when the board has settled
      stats.bursts++;
      const n = 1 + int(3);
      for (let i = 0; i < n; i++) {
        const g = await geometry(page);
        const from = randomPointNearBoard(g);
        const dir = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        const len = g.cell * (0.3 + rnd() * 1.2);
        await rawSwipe(page, g, from, { x: from.x + dir[0] * len, y: from.y + dir[1] * len });
        extra++;
        await page.waitForTimeout(int(60));
      }
      note('burst of ' + n);
    }
  }
  await settle(page);
  const now = await observe(page);
  const turns1 = await page.evaluate(() => window.__play.turns());
  stats.moves++;
  if (now.dialog && now.dialog.name === 'pause') return; // frozen mid-turn: judged after the dialog
  must(turns1 > turns0 || now.state !== 'play', 'the hinted move did not start a turn');
  if (now.state === 'play' || now.state === 'lost' || now.state === 'finale' || now.state === 'won') {
    const spent = m0 - now.moves;
    if (now.status === 'won') return; // the end bonus has already used the remaining moves
    if (extra === 0) must(spent === 1, `a valid move ${JSON.stringify(h)} spent ${spent} moves (state ${now.state}, selection before ${JSON.stringify(o.info.selection)})`);
    // (each swipe of the burst may be remembered and played in its turn — one at a time — when it was valid by then)
    else must(spent >= 1 && spent <= 1 + extra, `a valid move plus ${extra} swipes made while the board resolved spent ${spent} moves`);
  }
}

async function randomSwipe(page, o) {
  const g = await geometry(page);
  const from = chance(0.8) ? centre(g, int(g.cols), int(g.rows)) : randomPointNearBoard(g);
  const dir = pick([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 0.4], [-0.3, 1], [0.7, -0.6]]);
  const len = g.cell * (0.1 + rnd() * 1.6);
  const turns0 = await page.evaluate(() => window.__play.turns());
  const made = await rawSwipe(page, g, from, { x: from.x + dir[0] * len, y: from.y + dir[1] * len });
  const sel = o.info.selection;
  let expectValid = false;
  if (made.a && made.commit && made.b && pickable(g, made.a) && pickable(g, made.b)) expectValid = isValid(g, made.a, made.b);
  // a drag below the commit distance is a cancelled drag, never a tap-tap swap
  await page.waitForTimeout(30);
  await settle(page);
  const now = await observe(page);
  const turns1 = await page.evaluate(() => window.__play.turns());
  if (now.status === 'won') {
    must(expectValid, 'a swipe that is not a valid move won the level');
    return;
  }
  const spent = o.moves - now.moves;
  must(spent === (expectValid ? 1 : 0), `swipe ${JSON.stringify(made)} (valid by the engine: ${expectValid}) spent ${spent} moves; selection was ${JSON.stringify(sel)}`);
  if (expectValid) {
    must(turns1 > turns0, 'a valid swipe did not play a turn');
    stats.moves++;
  } else stats.invalid++;
}

async function randomTap(page, o) {
  const g = await geometry(page);
  const at = chance(0.85) ? centre(g, int(g.cols), int(g.rows)) : randomPointNearBoard(g);
  const x = clampX(g, at.x);
  const y = clampY(g, at.y);
  // never on a control: taps on the header / tray are their own actions
  const onControl = await page.evaluate(([px, py]) => {
    const e = document.elementFromPoint(px, py);
    return !!(e && e.closest && e.closest('button'));
  }, [x, y]);
  if (onControl) return;
  const cell = cellAt(g, x, y);
  const sel = o.info.selection;
  const expectValid = !!(cell && sel && adjacent(sel, cell) && pickable(g, sel) && pickable(g, cell) && isValid(g, sel, cell));
  await page.mouse.click(x, y);
  await page.waitForTimeout(30);
  await settle(page);
  const now = await observe(page);
  if (now.status === 'won') {
    must(expectValid, 'a tap that is not a valid tap-tap move won the level');
    return;
  }
  const spent = o.moves - now.moves;
  must(spent === (expectValid ? 1 : 0), `tap on ${JSON.stringify(cell)} with selection ${JSON.stringify(sel)} spent ${spent} moves (valid: ${expectValid})`);
  if (expectValid) stats.moves++;
}

/**
 * Real touch points (Chrome DevTools Protocol): a finger rests on a gem while a second finger
 * swipes somewhere else — or the system takes the touch away in mid-drag. Only the first finger
 * counts, a cancelled drag is no move, and everything must be back at rest afterwards.
 */
async function multiTouch(page, o) {
  if (!page.__cdp) page.__cdp = await page.context().newCDPSession(page);
  const client = page.__cdp;
  const g = await geometry(page);
  const cellA = { c: int(g.cols), r: int(g.rows) };
  const a = centre(g, cellA.c, cellA.r);
  const b0 = centre(g, int(g.cols), int(g.rows));
  const dir = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  const b1 = { x: clampX(g, b0.x + dir[0] * g.cell), y: clampY(g, b0.y + dir[1] * g.cell) };
  const pt = (p, id) => ({ x: Math.round(p.x), y: Math.round(p.y), id });
  const send = (type, touchPoints) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
  const sel = o.info.selection;
  let expectValid = false;
  if (chance(0.6)) {
    // two fingers: the first holds, the second swipes, the second lifts, the first lifts (= a tap of the first)
    await send('touchStart', [pt(a, 1)]);
    await send('touchStart', [pt(a, 1), pt(b0, 2)]);
    await send('touchMove', [pt(a, 1), pt({ x: (b0.x + b1.x) / 2, y: (b0.y + b1.y) / 2 }, 2)]);
    await send('touchMove', [pt(a, 1), pt(b1, 2)]);
    await send('touchEnd', [pt(a, 1)]);
    await send('touchEnd', []);
    expectValid = !!(g.cells[cellA.r * g.cols + cellA.c] && sel && adjacent(sel, cellA) && pickable(g, sel) && pickable(g, cellA) && isValid(g, sel, cellA));
    note(`two fingers: hold ${cellA.c},${cellA.r}, swipe elsewhere`);
  } else {
    // a drag the system cancels half way
    await send('touchStart', [pt(a, 1)]);
    await send('touchMove', [pt({ x: a.x + dir[0] * g.cell * 0.4, y: a.y + dir[1] * g.cell * 0.4 }, 1)]);
    await send('touchMove', [pt({ x: a.x + dir[0] * g.cell * 0.9, y: a.y + dir[1] * g.cell * 0.9 }, 1)]);
    await send('touchCancel', []);
    note(`touch cancelled in mid-drag from ${cellA.c},${cellA.r}`);
  }
  await page.waitForTimeout(40);
  await settle(page);
  const now = await observe(page);
  if (now.status === 'won') {
    must(expectValid, 'a touch that is not a valid move won the level');
    return;
  }
  const spent = o.moves - now.moves;
  must(spent === (expectValid ? 1 : 0), `touch gesture on ${JSON.stringify(cellA)} (selection ${JSON.stringify(sel)}) spent ${spent} moves, expected ${expectValid ? 1 : 0}`);
  if (expectValid) stats.moves++;
  stats.touches++;
}

async function boosterButton(page, o) {
  if (o.boosters.length === 0) return;
  const id = pick(o.boosters);
  const before = await boardKey(page);
  await page.locator(`[data-booster="${id}"] button`).click();
  note('booster button ' + id + ' (' + ledger.boosters[id] + ')');
  if (ledger.boosters[id] <= 0) {
    await settle(page);
    const now = await observe(page);
    must(now.dialog && now.dialog.name === 'buy' && now.dialog.booster === id, 'an empty booster did not offer to buy one');
    return;
  }
  if (id === 'shuffle') {
    await page.waitForTimeout(30);
    await settle(page);
    const after = await boardKey(page);
    const now = await observe(page);
    if (after !== before) {
      ledger.boosters.shuffle -= 1;
      stats.boosters++;
      must(now.moves === o.moves || now.status === 'won', 'the shuffle cost a move');
    }
    return;
  }
  await page.waitForFunction((want) => window.__play.info().targeting === want, id, { timeout: 3000 });
  must(await page.evaluate(() => !!document.querySelector('.pl-target')), 'no targeting banner');
}

async function targetingAction(page, o) {
  const id = o.info.targeting;
  const g = await geometry(page);
  const roll = rnd();
  if (roll < 0.1) {
    await page.locator('.pl-target .k-btn').click();
    await page.waitForFunction(() => window.__play.info().targeting === null, null, { timeout: 3000 });
    note('targeting: cancel button');
    return;
  }
  if (roll < 0.2) {
    must(await back(page), 'Back was not consumed while targeting');
    must((await observe(page)).info.targeting === null, 'Back did not cancel targeting');
    note('targeting: back');
    return;
  }
  if (roll < 0.26) {
    await appPause(page);
    return;
  }
  const before = await boardKey(page);
  const m0 = o.moves;
  let accepted = false;
  if (id === 'hammer') {
    const at = chance(0.9) ? centre(g, int(g.cols), int(g.rows)) : randomPointNearBoard(g);
    const x = clampX(g, at.x);
    const y = clampY(g, at.y);
    const onCanvas = await page.evaluate(([px, py]) => {
      const e = document.elementFromPoint(px, py);
      return !!(e && e.classList && e.classList.contains('pl-board'));
    }, [x, y]);
    if (!onCanvas) return;
    const cell = cellAt(g, x, y);
    if (cell) {
      const c = g.cells[cell.r * g.cols + cell.c];
      accepted = !((c.piece === null || c.piece.kind === 'lamp') && c.sand === 0);
    }
    await page.mouse.click(x, y);
    note(`hammer on ${JSON.stringify(cell)} → ${accepted ? 'hit' : 'nothing'}`);
  } else {
    const a = { c: int(g.cols), r: int(g.rows) };
    const dir = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const b = { c: a.c + dir[0], r: a.r + dir[1] };
    const pa = centre(g, a.c, a.r);
    const pb = centre(g, b.c, b.r);
    const made = await rawSwipe(page, g, pa, pb);
    const A = pieceAt(g, made.a);
    const B = made.b ? pieceAt(g, made.b) : null;
    const sameThing = A && B && A.kind === B.kind && A.color === B.color && (A.kind === 'gem' || A.kind === 'lamp');
    accepted = !!(made.a && made.b && made.commit && pickable(g, made.a) && pickable(g, made.b) && !sameThing);
    note(`free swap ${JSON.stringify(made.a)}→${JSON.stringify(made.b)} → ${accepted ? 'done' : 'refused'}`);
  }
  await page.waitForTimeout(30);
  await settle(page);
  const after = await boardKey(page);
  const now = await observe(page);
  if (accepted) {
    ledger.boosters[id] -= 1;
    stats.boosters++;
    must(after !== before || now.status === 'won', `an accepted ${id} left the board unchanged`);
    must(now.info === null || now.info.targeting === null, 'targeting still on after the booster was used');
    must(now.status === 'won' || now.moves === m0, `the ${id} cost a move`);
  } else {
    must(after === before, `a refused ${id} changed the board`);
    must(now.moves === m0, `a refused ${id} cost a move`);
    must(now.info.targeting === id, 'a refused booster ended targeting');
  }
}

async function playAction(page, o, ctx) {
  if (o.info.targeting) return targetingAction(page, o);
  if (ctx.touch && chance(0.12)) return multiTouch(page, o);
  const roll = rnd();
  if (roll < 0.4) return hintMove(page, o, false);
  if (roll < 0.52) return hintMove(page, o, true);
  if (roll < 0.66) return randomSwipe(page, o);
  if (roll < 0.74) return randomTap(page, o);
  if (roll < 0.86) return boosterButton(page, o);
  if (roll < 0.9) {
    await page.locator('.pl-pause').click();
    note('pause button');
    return undefined;
  }
  if (roll < 0.94) {
    must(await back(page), 'Back was not consumed in play');
    note('back in play');
    return undefined;
  }
  if (roll < 0.97) return chaos(page);
  // an outside stop + start over the running level (the shell's toPlay on a level already up)
  stats.rapidStarts++;
  note('level started over itself');
  await startLevel(page, ctx.key, ctx, true);
  return undefined;
}

// ───────────────────────────── one level ─────────────────────────────

async function startLevel(page, key, ctx, again) {
  ctx.credited = false;
  ctx.lostSeen = false;
  ctx.winChecked = false;
  ctx.doubled = false;
  ctx.leaving = null;
  ctx.left = null;
  const mode = int(4);
  await page.evaluate(
    ([k, m]) => {
      const d = window.__demo;
      if (m === 0) {
        d.start(k);
        d.start(k); // twice at once
      } else if (m === 1) {
        d.stop();
        d.start(k);
      } else d.start(k);
    },
    [key, again ? 2 : mode],
  );
  if (!again && mode === 3) {
    // … and once more while the pieces are still dropping in
    await page.waitForTimeout(30 + int(200));
    await page.evaluate((k) => window.__demo.start(k), key);
  }
}

async function playLevel(page, key, env) {
  const ctx = { key, adsMode: env.ads, touch: !!env.touch, restarted: () => undefined };
  ctx.restarted = () => {
    ctx.credited = false;
    ctx.lostSeen = false;
    ctx.winChecked = false;
    ctx.doubled = false;
  };
  if (ledger.lives === 0) {
    await page.evaluate(() => window.__demo.profile.grant([{ kind: 'lives' }]));
    ledger.lives = MAX_LIVES;
  }
  const navBefore = await page.evaluate(() => window.__demo.log.nav.length);
  await startLevel(page, key, ctx, false);
  note(`── level ${key} (${env.tag})`);
  await checkEconomy(page, 'level start', null);

  const MAX_STEPS = 90;
  let left = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    await settle(page);
    const o = await observe(page);
    stats.actions++;
    if (o.state === 'none') {
      left = true;
      break;
    }
    if (o.status === 'won') creditWin(o, ctx);
    if (o.dialog) {
      await handleDialog(page, o, ctx);
      await page.waitForTimeout(30);
      await settle(page);
      await checkEconomy(page, 'after dialog ' + o.dialog.name, ctx);
      continue;
    }
    if (o.state === 'finale') {
      const roll = rnd();
      if (roll < 0.3) {
        const g = await geometry(page);
        await page.mouse.click(clampX(g, g.vw / 2), clampY(g, g.vh * 0.6));
        stats.skips++;
        note('finale skipped by a tap');
      } else if (roll < 0.45) {
        await back(page);
        stats.skips++;
        note('finale skipped by Back');
      } else if (roll < 0.6) await chaos(page);
      await page.waitForFunction(() => window.__play.state() !== 'finale', null, { timeout: 15000 });
      continue;
    }
    // idle play
    await checkBoard(page, `level ${key}, step ${step}`);
    await playAction(page, o, ctx);
    await settle(page);
    await checkEconomy(page, `level ${key}, step ${step}`, ctx);
    const after = await observe(page);
    if (after.state === 'play' && after.idle && !after.dialog) await checkBoard(page, `level ${key}, after step ${step}`);
  }

  if (!left) {
    // enough: leave through pause → quit, whatever is on screen
    for (let guard = 0; guard < 30 && !left; guard++) {
      await settle(page);
      const o = await observe(page);
      if (o.state === 'none') {
        left = true;
        break;
      }
      if (o.status === 'won') creditWin(o, ctx);
      if (o.dialog) {
        const d = o.dialog;
        if (d.name === 'pause') {
          ctx.leaving = 'quit';
          ctx.costly = o.info.movesMade > 0;
          await clickAction(page, 'quit');
          if (!ctx.costly) stats.quits++;
        } else if (d.name === 'confirm') {
          if (!o.info.lifeTaken) ledger.lives = Math.max(0, ledger.lives - 1);
          await clickAction(page, 'yes');
          stats.quits++;
        } else if (d.name === 'lose') {
          if (!o.info.lifeTaken) ledger.lives = Math.max(0, ledger.lives - 1);
          await clickAction(page, 'giveUp');
          stats.giveUps++;
        } else if (d.name === 'win') {
          await clickAction(page, 'map');
        } else if (d.name === 'shop') {
          await page.locator('.k-overlay.k-open').last().locator('.k-btn', { hasText: 'Close' }).click();
        } else await back(page);
      } else if (o.state === 'finale') {
        await back(page);
        await page.waitForFunction(() => window.__play.state() !== 'finale', null, { timeout: 15000 });
      } else if (o.info && o.info.targeting) await back(page);
      else await back(page);
      await page.waitForTimeout(40);
    }
  }
  must(left, 'could not leave the level');
  await checkEconomy(page, 'after level ' + key, null);

  // nothing may be left running
  const rest = await page.evaluate(() => ({ loop: window.__play.loop(), over: document.querySelectorAll('.pl-over > *').length, fly: document.querySelectorAll('.pl-fly > *').length, target: document.querySelectorAll('.pl-target').length }));
  must(!rest.loop.running && rest.loop.tweens === 0 && rest.loop.timers === 0 && rest.loop.dialogs === 0 && rest.loop.frozen === 0, 'left running after the level: ' + JSON.stringify(rest.loop));
  must(rest.over === 0 && rest.fly === 0 && rest.target === 0, 'left on screen after the level: ' + JSON.stringify(rest));
  const nav = await page.evaluate((n) => window.__demo.log.nav.slice(n), navBefore);
  must(nav.some((l) => l.indexOf('toMap') === 0), 'the level was left without going to the map: ' + JSON.stringify(nav));
  if (ctx.left === 'next') must(nav.some((l) => l.indexOf('openLevelIntro') === 0), 'Next did not ask for the next level');
  const note2 = await page.evaluate(() => localStorage.getItem('match3.attempt.v1'));
  must(note2 === null, 'an open-attempt note was left behind by an orderly exit: ' + note2);
  stats.levels++;
}

// ───────────────────────────── run ─────────────────────────────

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  let failed = null;
  const ENVS = [
    { tag: 'en · videos earned', lang: 'en', ads: '1', query: 'inv=2&coins=6000&ads=1&tut=0' },
    { tag: 'ar · videos not earned', lang: 'ar', ads: 'fail', query: 'inv=1&coins=2500&ads=fail&tut=0' },
    { tag: 'en · no videos, tips on', lang: 'en', ads: null, query: 'inv=0&coins=1200' },
    { tag: 'ar · videos earned, touch', lang: 'ar', ads: '1', query: 'inv=3&coins=20000&ads=1&tut=0', touch: true },
  ];
  const perEnv = Math.ceil(LEVELS / ENVS.length);
  let played = 0;
  try {
    for (let e = 0; e < ENVS.length && played < LEVELS; e++) {
      const env = ENVS[e];
      const [w, h] = pick(SIZES);
      const page = await H.openHarness(browser, { w, h, lang: env.lang, query: `level=none&fast=1&seed=${SEED * 100 + e}&${env.query}`, problems, tag: `[${env.tag}]`, dpr: pick([1, 2, 3]), touch: !!env.touch });
      await syncLedger(page);
      for (let i = 0; i < perEnv && played < LEVELS; i++) {
        const key = chance(0.45) ? pick(HARNESS_LEVELS) : String(1 + int(120));
        const before = stats.actions;
        const tl = Date.now();
        await playLevel(page, key, env);
        played++;
        console.log(`  ✓ level ${String(key).padEnd(6)} ${env.tag.padEnd(26)} ${String(stats.actions - before).padStart(3)} steps  ${((Date.now() - tl) / 1000).toFixed(1)} s`);
        if (problems.length > 0) fail('console problems');
      }
      await page.context().close();
    }
  } catch (err) {
    failed = err;
  }
  await browser.close();
  console.log('\n  ' + Object.keys(stats).map((k) => `${k} ${stats[k]}`).join(' · '));
  if (problems.length > 0) console.log('\nCONSOLE PROBLEMS (' + problems.length + '):\n  ' + problems.slice(0, 12).join('\n  '));
  if (failed) {
    console.log('\nlast actions:\n  ' + trail.slice(-25).join('\n  '));
    console.log('\n' + (failed instanceof Failure ? 'FAILED: ' + failed.message : failed.stack || failed.message));
  }
  if (failed || problems.length > 0) {
    console.log(`\nplay monkey: FAILED (seed ${SEED}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    process.exit(1);
  }
  console.log(`\nplay monkey: PASSED — ${stats.levels} levels, ${stats.boardChecks} picture-vs-engine checks, seed ${SEED}, ${((Date.now() - t0) / 1000).toFixed(0)} s, 0 console errors / warnings`);
})();
