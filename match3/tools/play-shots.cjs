/**
 * Screenshots of the play screen for human review → shots/play/*.png
 *
 *   npx vite --port 5184 --strictPort      (in another terminal)
 *   node tools/play-shots.cjs [filter]     e.g. `node tools/play-shots.cjs win` or `… 360-en`
 *   node tools/play-shots.cjs frames [name]   frame-by-frame sequences of every effect
 *                                             → shots/play/frames/<name>-NN.png + <name>-sheet.png
 *                                             (names: match beam nova prism cross bigcross bignova
 *                                              prismall prismbeam cascade finale stars start hammer
 *                                              shuffle lose praise makebeam lowmoves)
 *   node tools/play-shots.cjs sizes           the mid-level scene at every screen size, both languages
 *
 * Every scene is captured at 360×640, 412×915, 800×1280 and 320×480 in English and Arabic (plus
 * two landscape sizes for the mid-level scene), at deviceScaleFactor 2. Mid-animation frames are taken
 * by freezing the screen (setPaused) at a chosen moment, so they are sharp and repeatable.
 * Uses the dev harness play-demo.html; exits non-zero on any console error.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const H = require('../tests/e2e/play-harness.cjs');

const OUT = path.join(__dirname, '..', 'shots', 'play');
const filter = process.argv[2] || '';

const SIZES = [
  { name: '360', w: 360, h: 640 },
  { name: '412', w: 412, h: 915 },
  { name: '800', w: 800, h: 1280 },
  { name: '320', w: 320, h: 480 },
];
const LANDSCAPE = [
  { name: '640x360', w: 640, h: 360 },
  { name: '1280x800', w: 1280, h: 800 },
];
const LANGS = ['en', 'ar'];

const errors = [];

function open(browser, size, lang, query) {
  return H.openHarness(browser, { w: size.w, h: size.h, lang, query, problems: errors, tag: `[${size.name}-${lang}]` });
}

const { idle, freeze, cell, swipe, tapCell } = H;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name + '.png') });
}

/** Freeze at `ms` after now, capture, resume. */
async function frameAt(page, ms, name) {
  await page.waitForTimeout(ms);
  await freeze(page, true);
  await shot(page, name);
  await freeze(page, false);
}

async function hammer(page, c, r) {
  await page.click('[data-booster="hammer"] button');
  await page.waitForTimeout(120);
  await tapCell(page, c, r);
}

const playHints = H.playHints;

/** scene name → async (browser, size, lang, tag) */
const SCENES = {
  async start(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=3');
    await frameAt(page, 520, `start-${tag}`);
    await page.context().close();
  },

  async mid(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(1500);
    await shot(page, `mid-${tag}`);
    // a selected piece
    await tapCell(page, 4, 7);
    await page.waitForTimeout(250);
    await shot(page, `select-${tag}`);
    await page.context().close();
  },

  async goals4(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=goals4&seed=3&tut=0&inv=0');
    await idle(page);
    await page.waitForTimeout(1400);
    await shot(page, `goals4-${tag}`);
    await page.context().close();
  },

  async beam(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=fx&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(1300);
    await hammer(page, 2, 2);
    await frameAt(page, 430, `beam-1-${tag}`);
    await frameAt(page, 70, `beam-2-${tag}`);
    await frameAt(page, 90, `beam-3-${tag}`);
    await page.context().close();
  },

  async nova(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=fx&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(1300);
    await hammer(page, 5, 4);
    await frameAt(page, 440, `nova-1-${tag}`);
    await frameAt(page, 80, `nova-2-${tag}`);
    await frameAt(page, 110, `nova-3-${tag}`);
    await page.context().close();
  },

  async prism(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=fx&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(1300);
    await swipe(page, { c: 6, r: 6 }, { c: 6, r: 5 });
    await frameAt(page, 420, `prism-1-${tag}`);
    await frameAt(page, 130, `prism-2-${tag}`);
    await page.context().close();
  },

  async combo(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(1300);
    await swipe(page, { c: 1, r: 1 }, { c: 2, r: 1 });
    await frameAt(page, 330, `combo-cross-1-${tag}`);
    await frameAt(page, 110, `combo-cross-2-${tag}`);
    await idle(page);
    await page.waitForTimeout(300);
    // prism + prism: the whole board
    const snap = await page.evaluate(() => {
      const s = window.__play.snapshot();
      const out = [];
      for (let i = 0; i < s.cells.length; i++) if (s.cells[i].piece && s.cells[i].piece.kind === 'prism') out.push({ c: i % s.cols, r: Math.floor(i / s.cols) });
      return out;
    });
    const pair = snap.find((a) => snap.some((b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1));
    if (pair) {
      const other = snap.find((b) => Math.abs(pair.c - b.c) + Math.abs(pair.r - b.r) === 1);
      await swipe(page, pair, other);
      await frameAt(page, 420, `combo-all-1-${tag}`);
      await frameAt(page, 180, `combo-all-2-${tag}`);
      await page.waitForFunction(() => window.__play.isIdle() || window.__play.state() !== 'play', null, { timeout: 30000 });
      await frameAt(page, 420, `praise-${tag}`);
    }
    await page.context().close();
  },

  /** idle hint (two gems hop toward each other in a glow) and the low-moves numeral */
  async hint(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=tiny&seed=3&tut=0&inv=0');
    await idle(page);
    await page.waitForTimeout(3250);
    await freeze(page, true);
    await shot(page, `hint-${tag}`);
    await freeze(page, false);
    await page.context().close();
    const low = await open(browser, size, lang, 'level=hard&seed=11&tut=0&inv=3');
    await idle(low);
    await low.waitForTimeout(1300);
    await shot(low, `lowmoves-${tag}`);
    await low.context().close();
  },

  /** "no more moves — shuffling" banner with the pieces swirling */
  async shuffle(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(1300);
    await page.click('[data-booster="shuffle"] button');
    await frameAt(page, 260, `shuffle-${tag}`);
    await page.context().close();
  },

  async target(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(1300);
    await page.click('[data-booster="hammer"] button');
    await page.waitForTimeout(500);
    await shot(page, `target-${tag}`);
    await page.context().close();
  },

  async buy(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=0&coins=2000');
    await idle(page);
    await page.waitForTimeout(1300);
    await page.click('[data-booster="freeSwap"] button');
    await page.waitForTimeout(600);
    await shot(page, `buy-${tag}`);
    await page.context().close();
  },

  async pause(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(1300);
    await page.click('.pl-pause');
    await page.waitForTimeout(600);
    await shot(page, `pause-${tag}`);
    await page.context().close();
  },

  async tip(browser, size, lang, tag) {
    for (const id of size.name === '360' ? ['match', 'beam', 'nova', 'prism', 'combo', 'sand', 'sand2', 'stone', 'lamp', 'chain', 'vine', 'collect'] : ['nova']) {
      const page = await open(browser, size, lang, `level=easy&seed=7&tut=${id}&inv=0`);
      await page.waitForSelector('.k-dialog', { timeout: 10000 });
      await page.waitForTimeout(500);
      await shot(page, `tip-${id}-${tag}`);
      if (id === 'match') {
        await page.click('.k-dialog .k-btn');
        await page.waitForTimeout(900);
        await shot(page, `hand-${tag}`);
      }
      await page.context().close();
    }
  },

  async win(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=easy&seed=11&tut=0&inv=0&fast=1&ads=1');
    await idle(page);
    await playHints(page, 40);
    await page.waitForFunction(() => window.__play.state() === 'finale', null, { timeout: 20000 });
    await frameAt(page, 200, `finale-1-${tag}`);
    await frameAt(page, 260, `finale-2-${tag}`);
    await page.waitForFunction(() => window.__play.state() === 'won', null, { timeout: 20000 });
    await page.waitForTimeout(1700);
    await shot(page, `win-${tag}`);
    await page.context().close();
  },

  async lose(browser, size, lang, tag) {
    const page = await open(browser, size, lang, 'level=hard&seed=11&tut=0&inv=0&fast=1&ads=1&coins=2000&caravan=3');
    await idle(page);
    await playHints(page, 5);
    await page.waitForFunction(() => window.__play.state() === 'lost', null, { timeout: 20000 });
    await page.waitForSelector('.k-dialog', { timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, `lose-${tag}`);
    await page.context().close();
  },
};

// ───────────────────────────── frame sequences ─────────────────────────────

const FRAMES = path.join(OUT, 'frames');

/** A contact sheet of the frames just captured (one image to look at instead of twelve). */
async function sheet(browser, name, files, labels, cols) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const cells = files
    .map((f, i) => {
      const data = fs.readFileSync(f).toString('base64');
      return `<figure><img src="data:image/png;base64,${data}"><figcaption>${labels[i]}</figcaption></figure>`;
    })
    .join('');
  await page.setContent(
    `<style>body{margin:0;background:#0b0920;font:600 13px system-ui;color:#fff6dc}
     .g{display:grid;grid-template-columns:repeat(${cols},1fr);grid-gap:6px;padding:6px}
     figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 4px}</style><div class="g">${cells}</div>`,
  );
  await page.waitForTimeout(100);
  const box = await page.evaluate(() => document.querySelector('.g').getBoundingClientRect().height);
  await page.setViewportSize({ width: 1600, height: Math.ceil(box) });
  await page.screenshot({ path: path.join(FRAMES, name + '-sheet.png') });
  await page.close();
}

/** The board's rectangle on screen plus a margin (the frames show the board, not the whole screen). */
async function boardClip(page, margin) {
  return page.evaluate((m) => {
    const p = window.__play;
    const s = p.snapshot();
    const cell = p.shown().cell;
    const a = p.cell(0, 0);
    const z = p.cell(s.cols - 1, s.rows - 1);
    const x = Math.max(0, a.x - cell / 2 - m);
    const y = Math.max(0, a.y - cell / 2 - m);
    return { x, y, width: Math.min(window.innerWidth, z.x + cell / 2 + m) - x, height: Math.min(window.innerHeight, z.y + cell / 2 + m) - y };
  }, margin);
}

/**
 * Freeze the game, start something, then advance the game clock by hand and capture every step.
 * Returns the game time at which the board was idle again (ms after the trigger), or -1.
 */
/**
 * CSS animations and transitions (banners, the praise word, dialogs, the stars) do not follow the
 * game clock: hold them and move them on by hand, by the same amount.
 */
function stepCss(page, ms) {
  return page.evaluate((dt) => {
    for (const a of document.getAnimations()) {
      if (a.playState === 'running') a.pause();
      if (a.playState === 'paused') a.currentTime = (Number(a.currentTime) || 0) + dt;
    }
  }, ms);
}

async function sequence(browser, page, name, trigger, opts) {
  const o = Object.assign({ frames: 12, step: 50, lead: 0, cols: 6, full: false, margin: 26, css: true }, opts || {});
  await freeze(page, true);
  if (trigger) await trigger();
  if (o.css) await stepCss(page, 0);
  const clip = o.full ? undefined : await boardClip(page, o.margin);
  const files = [];
  const labels = [];
  let t = 0;
  let idleAt = -1;
  for (let i = 0; i < o.frames; i++) {
    const dt = i === 0 ? o.lead : o.step;
    if (dt > 0) {
      // in slices, so that what the game starts on the way (a banner, a dialog) is caught early
      let left = dt;
      while (left > 0) {
        const slice = Math.min(left, 34);
        await page.evaluate((ms) => window.__play.advance(ms), slice);
        if (o.css) await stepCss(page, slice);
        left -= slice;
      }
    }
    t += dt;
    const file = path.join(FRAMES, `${name}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, clip });
    files.push(file);
    labels.push(`${name} · ${t} ms`);
    if (idleAt < 0 && (await page.evaluate(() => window.__play.info() && !window.__play.info().busy && window.__play.state() === 'play'))) idleAt = t;
  }
  await sheet(browser, name, files, labels, o.cols);
  await freeze(page, false);
  return idleAt;
}

/** How long a turn keeps the board busy, in game time (stepped by hand at 60 fps). */
async function measureTurn(page, trigger) {
  await freeze(page, true);
  await trigger();
  let t = 0;
  for (let i = 0; i < 400; i++) {
    const idle = await page.evaluate(() => !window.__play.info().busy);
    if (idle) break;
    await page.evaluate(() => window.__play.advance(1000 / 60));
    t += 1000 / 60;
  }
  await freeze(page, false);
  return Math.round(t);
}

/** In the page: look for a seed of a level whose best move sets off a cascade of at least `want`. */
async function findCascade(page, levelName, want) {
  return page.evaluate(
    async ([name, min]) => {
      const { Game } = await import('/src/engine/index.ts');
      const level = window.__demo.levels[name];
      for (let seed = 1; seed < 4000; seed++) {
        const game = new Game(level, { seed });
        const moves = game.validMoves();
        for (const m of moves) {
          const probe = new Game(level, { seed });
          const res = probe.swap(m.a, m.b);
          let cascade = 0;
          let specials = 0;
          for (const st of res.steps) {
            if (st.type === 'clear' && st.cascade > cascade) cascade = st.cascade;
            if (st.type === 'activate') specials++;
          }
          if (cascade >= min && cascade <= min + 1 && specials === 0) return { seed, move: m, cascade };
        }
      }
      return null;
    },
    [levelName, want],
  );
}

async function findPlainMatch(page) {
  return page.evaluate(async () => {
    const { Game } = await import('/src/engine/index.ts');
    const level = window.__demo.levels.easy;
    for (let seed = 1; seed < 500; seed++) {
      const game = new Game(level, { seed });
      for (const m of game.validMoves()) {
        const probe = new Game(level, { seed });
        const res = probe.swap(m.a, m.b);
        const clears = res.steps.filter((st) => st.type === 'clear');
        if (clears.length === 1 && clears[0].hits.length === 3 && clears[0].created.length === 0 && Math.max(m.a.r, m.b.r) >= 3) return { seed, move: m };
      }
    }
    return null;
  });
}

const FRAME_SCENES = {
  /** the plainest thing there is: three in a row — swap, pop, fall, settle (the feel budget) */
  async match(browser) {
    let page = await open(browser, SIZES[0], 'en', 'level=easy&seed=1&tut=0&inv=0');
    await idle(page);
    const found = await findPlainMatch(page);
    await page.context().close();
    page = await open(browser, SIZES[0], 'en', `level=easy&seed=${found.seed}&tut=0&inv=0`);
    await idle(page);
    await page.waitForTimeout(900);
    const busy = await measureTurn(page, () => page.evaluate((m) => window.__play.swap(m.a, m.b), found.move));
    console.log(`  timing: a plain match-3 gives control back after ${busy} ms of game time (budget 600–900)`);
    await page.context().close();
    page = await open(browser, SIZES[0], 'en', `level=easy&seed=${found.seed}&tut=0&inv=0`);
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'match', () => page.evaluate((m) => window.__play.swap(m.a, m.b), found.move), { frames: 18, step: 50, cols: 6 });
    await page.context().close();
  },

  async beam(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=fx&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'beam', () => page.evaluate(() => window.__play.useBooster('hammer', { c: 2, r: 2 })), { frames: 18, step: 40, lead: 280 });
    await page.context().close();
  },

  async nova(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=fx&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'nova', () => page.evaluate(() => window.__play.useBooster('hammer', { c: 5, r: 4 })), { frames: 18, step: 40, lead: 280 });
    await page.context().close();
  },

  async prism(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=fx&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'prism', () => page.evaluate(() => window.__play.swap({ c: 6, r: 6 }, { c: 6, r: 5 })), { frames: 18, step: 50, lead: 120 });
    await page.context().close();
  },

  /** beam + beam */
  async cross(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'cross', () => page.evaluate(() => window.__play.swap({ c: 6, r: 5 }, { c: 7, r: 5 })), { frames: 18, step: 40, lead: 140 });
    await page.context().close();
  },

  /** beam + nova */
  async bigcross(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'bigcross', () => page.evaluate(() => window.__play.swap({ c: 1, r: 1 }, { c: 2, r: 1 })), { frames: 18, step: 40, lead: 140 });
    await page.context().close();
  },

  /** nova + nova */
  async bignova(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'bignova', () => page.evaluate(() => window.__play.swap({ c: 1, r: 5 }, { c: 2, r: 5 })), { frames: 18, step: 40, lead: 140 });
    await page.context().close();
  },

  /** prism + prism */
  async prismall(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'prismall', () => page.evaluate(() => window.__play.swap({ c: 4, r: 3 }, { c: 5, r: 3 })), { frames: 18, step: 50, lead: 140 });
    await page.context().close();
  },

  /** prism + beam: every gem of the colour becomes a beam, then they all fire */
  async prismbeam(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'prismbeam', () => page.evaluate(() => window.__play.swap({ c: 3, r: 7 }, { c: 4, r: 7 })), { frames: 24, step: 60, lead: 140 });
    await page.context().close();
  },

  /** a cascade of five and more: the chain badge, the climbing pace, the praise word */
  async cascade(browser) {
    let page = await open(browser, SIZES[0], 'en', 'level=easy&seed=1&tut=0&inv=0');
    await idle(page);
    const found = await findCascade(page, 'easy', 5);
    await page.context().close();
    if (!found) throw new Error('no seed with a five-step cascade found');
    console.log(`  cascade: seed ${found.seed}, ${found.cascade} steps`);
    page = await open(browser, SIZES[0], 'en', `level=easy&seed=${found.seed}&tut=0&inv=0`);
    await idle(page);
    await page.waitForTimeout(900);
    const busy = await measureTurn(page, () => page.evaluate((m) => window.__play.swap(m.a, m.b), found.move));
    console.log(`  timing: the ${found.cascade}-step cascade gives control back after ${busy} ms`);
    await page.context().close();
    page = await open(browser, SIZES[0], 'en', `level=easy&seed=${found.seed}&tut=0&inv=0`);
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'cascade', () => page.evaluate((m) => window.__play.swap(m.a, m.b), found.move), { frames: 30, step: 110, cols: 6, full: true });
    await page.context().close();
  },

  /** level start: the pieces drop in under the goal banner */
  async start(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.evaluate(() => {
      window.__demo.pause(true);
      window.__demo.start('mix');
    });
    await sequence(browser, page, 'start', null, { frames: 18, step: 90, cols: 6, full: true });
    await page.context().close();
  },

  async hammer(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'hammer', () => page.evaluate(() => window.__play.useBooster('hammer', { c: 1, r: 3 })), { frames: 12, step: 45 });
    await page.context().close();
  },

  async shuffle(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=mix&seed=7&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'shuffle', () => page.evaluate(() => window.__play.useBooster('shuffle')), { frames: 12, step: 60 });
    await page.context().close();
  },

  /** the end-of-level finale: the banner, moves fly into the board, the specials go off, the dialog */
  async finale(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=easy&seed=11&tut=0&inv=0&ads=1');
    await idle(page);
    for (let i = 0; i < 60 && (await H.state(page)) === 'play'; i++) {
      await H.settled(page);
      if ((await H.state(page)) !== 'play') break;
      const m = await page.evaluate(() => window.__play.hint());
      await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
      await page.waitForTimeout(30);
    }
    await page.waitForFunction(() => window.__play.state() === 'finale', null, { timeout: 30000 });
    await sequence(browser, page, 'finale', null, { frames: 36, step: 120, cols: 6, full: true });
    await page.context().close();
  },

  /** the win dialog: the stars slam in one by one, the coins pop in */
  async stars(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=easy&seed=11&tut=0&inv=0&ads=1');
    await idle(page);
    for (let i = 0; i < 60 && (await H.state(page)) === 'play'; i++) {
      await H.settled(page);
      if ((await H.state(page)) !== 'play') break;
      const m = await page.evaluate(() => window.__play.hint());
      await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
      await page.waitForTimeout(30);
    }
    await page.waitForFunction(() => window.__play.state() === 'finale', null, { timeout: 30000 });
    await page.waitForFunction(() => window.__play.info().finale && window.__play.info().flyers > 0, null, { timeout: 10000 });
    await page.evaluate(() => {
      window.__demo.pause(true);
      window.__play.finish();
    });
    await page.waitForSelector('.k-dialog[data-pl="win"]', { timeout: 8000 });
    await sequence(browser, page, 'stars', null, { frames: 24, step: 70, cols: 8, full: true });
    await page.context().close();
  },

  /** out of moves: the numeral turns red, the board dims, the dialog comes */
  async lose(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=hard&seed=11&tut=0&inv=0&ads=1&coins=2000');
    await idle(page);
    await playHints(page, 2);
    await idle(page);
    const m = await page.evaluate(() => window.__play.hint());
    await sequence(browser, page, 'lose', () => page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m), { frames: 18, step: 100, cols: 6, full: true });
    await page.context().close();
  },

  /** the praise word after a big move */
  async praise(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=combo&seed=5&tut=0&inv=9');
    await idle(page);
    await page.waitForTimeout(900);
    await freeze(page, true);
    await page.evaluate(() => window.__play.swap({ c: 4, r: 3 }, { c: 5, r: 3 }));
    // run the whole turn by hand, then watch the word
    for (let i = 0; i < 400; i++) {
      if (await page.evaluate(() => !!document.querySelector('.pl-praise'))) break;
      await page.evaluate(() => window.__play.advance(50));
    }
    await sequence(browser, page, 'praise', null, { frames: 18, step: 80, cols: 6, full: true });
    await page.context().close();
  },

  /** a straight four: the gems slide together into a new beam (converge, flash, pop-in, landing squash) */
  async makebeam(browser) {
    let page = await open(browser, SIZES[0], 'en', 'level=easy&seed=1&tut=0&inv=0');
    await idle(page);
    const found = await page.evaluate(async () => {
      const { Game } = await import('/src/engine/index.ts');
      const level = window.__demo.levels.easy;
      for (let seed = 1; seed < 3000; seed++) {
        const game = new Game(level, { seed });
        for (const m of game.validMoves()) {
          const res = new Game(level, { seed }).swap(m.a, m.b);
          const clears = res.steps.filter((st) => st.type === 'clear');
          if (clears.length === 1 && clears[0].created.length === 1 && /^beam/.test(clears[0].created[0].piece.kind)) return { seed, move: m };
        }
      }
      return null;
    });
    await page.context().close();
    if (!found) throw new Error('no seed with a plain four-match');
    page = await open(browser, SIZES[0], 'en', `level=easy&seed=${found.seed}&tut=0&inv=0`);
    await idle(page);
    await page.waitForTimeout(900);
    await sequence(browser, page, 'makebeam', () => page.evaluate((m) => window.__play.swap(m.a, m.b), found.move), { frames: 18, step: 45, cols: 6 });
    await page.context().close();
  },

  /** the last moves: the medallion warns (numeral pulses, a warm halo breathes round the ring) */
  async lowmoves(browser) {
    const page = await open(browser, SIZES[0], 'en', 'level=hard&seed=11&tut=0&inv=3');
    await idle(page);
    await page.waitForTimeout(600);
    await sequence(browser, page, 'lowmoves', null, { frames: 12, step: 90, cols: 6, full: true });
    await page.context().close();
  },
};

async function runFrames(only) {
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  for (const name of Object.keys(FRAME_SCENES)) {
    if (only && name !== only) continue;
    try {
      await FRAME_SCENES[name](browser);
      count++;
      console.log('  frames: ' + name);
    } catch (err) {
      errors.push(`[frames ${name}] ${err.message.split('\n')[0]}`);
    }
  }
  await browser.close();
  console.log(`sequences captured: ${count} → ${FRAMES}`);
  if (errors.length > 0) {
    console.log('PROBLEMS:\n' + errors.join('\n'));
    process.exit(1);
  }
}

/** The mid-level scene on every screen the game must fit, both languages: header, board, tray. */
const ALL_SIZES = [
  { name: '320x480', w: 320, h: 480 },
  { name: '360x640', w: 360, h: 640 },
  { name: '360x800', w: 360, h: 800 },
  { name: '412x915', w: 412, h: 915 },
  { name: '600x960', w: 600, h: 960 },
  { name: '800x1280', w: 800, h: 1280 },
  { name: '480x320', w: 480, h: 320 },
  { name: '640x360', w: 640, h: 360 },
  { name: '915x412', w: 915, h: 412 },
  { name: '1280x800', w: 1280, h: 800 },
];

async function runSizes() {
  const dir = path.join(OUT, 'sizes');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  for (const size of ALL_SIZES) {
    for (const lang of LANGS) {
      for (const level of ['mix', 'goals4', 'tiny']) {
        try {
          const page = await open(browser, size, lang, `level=${level}&seed=7&tut=0&inv=3`);
          await idle(page);
          await page.waitForTimeout(1300);
          await page.screenshot({ path: path.join(dir, `${level}-${size.name}-${lang}.png`) });
          await page.context().close();
          count++;
        } catch (err) {
          errors.push(`[sizes ${level} ${size.name}-${lang}] ${err.message.split('\n')[0]}`);
        }
      }
    }
  }
  await browser.close();
  console.log(`size shots: ${count} → ${dir}`);
  if (errors.length > 0) {
    console.log('PROBLEMS:\n' + errors.join('\n'));
    process.exit(1);
  }
}

(async () => {
  if (filter === 'frames') return runFrames(process.argv[3] || '');
  if (filter === 'sizes') return runSizes();
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  for (const scene of Object.keys(SCENES)) {
    for (const size of SIZES) {
      for (const lang of LANGS) {
        const tag = `${size.name}-${lang}`;
        if (filter && !(scene + '-' + tag).includes(filter) && !scene.includes(filter)) continue;
        try {
          await SCENES[scene](browser, size, lang, tag);
          count++;
        } catch (err) {
          errors.push(`[${scene} ${tag}] ${err.message.split('\n')[0]}`);
        }
      }
    }
  }
  // landscape: HUD beside the board
  if (!filter || 'land'.includes(filter) || filter.includes('land')) {
    for (const size of LANDSCAPE) {
      for (const lang of LANGS) {
        try {
          const page = await open(browser, size, lang, 'level=mix&seed=7&tut=0&inv=3');
          await idle(page);
          await page.waitForTimeout(1400);
          await shot(page, `land-${size.name}-${lang}`);
          await page.context().close();
          count++;
        } catch (err) {
          errors.push(`[land ${size.name}-${lang}] ${err.message.split('\n')[0]}`);
        }
      }
    }
  }
  await browser.close();
  console.log(`scenes captured: ${count} → ${OUT}`);
  if (errors.length > 0) {
    console.log('PROBLEMS:\n' + errors.join('\n'));
    process.exit(1);
  }
})();
