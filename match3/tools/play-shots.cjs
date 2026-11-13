/**
 * Screenshots of the play screen for human review → shots/play/*.png
 *
 *   npx vite --port 5184 --strictPort      (in another terminal)
 *   node tools/play-shots.cjs [filter]     e.g. `node tools/play-shots.cjs win` or `… 360-en`
 *
 * Every scene is captured at 360×640, 412×915 and 800×1280 in English and Arabic (plus two
 * landscape sizes for the mid-level scene), at deviceScaleFactor 2. Mid-animation frames are taken
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
    const page = await open(browser, size, lang, 'level=hard&seed=11&tut=0&inv=0&fast=1&ads=1&coins=2000');
    await idle(page);
    await playHints(page, 5);
    await page.waitForFunction(() => window.__play.state() === 'lost', null, { timeout: 20000 });
    await page.waitForSelector('.k-dialog', { timeout: 10000 });
    await page.waitForTimeout(700);
    await shot(page, `lose-${tag}`);
    await page.context().close();
  },
};

(async () => {
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
