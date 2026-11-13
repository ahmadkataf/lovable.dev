/**
 * Google Play phone screenshots, captured from the real game (never mock-ups: Play requires
 * "captured footage of the game itself").
 *
 *   node tools/store/make-screenshots.cjs               all scenes, English and Arabic
 *   node tools/store/make-screenshots.cjs ar            one language
 *   node tools/store/make-screenshots.cjs play shop     only scenes whose name contains a word
 *
 * Writes exactly 1080×1920 (9:16 portrait), 24-bit PNG without an alpha channel, into
 *   store/screenshots/en/01-play.png … 06-title.png
 *   store/screenshots/ar/01-play.png … 06-title.png
 * The numbers are the suggested upload order (the first three are what most people see).
 * Afterwards run `node tools/store/check-kit.cjs screenshots`.
 *
 * It starts the dev server itself (`npx vite --port 5188 --strictPort` in the match3 directory)
 * and stops it afterwards; a server already answering on 5188 is reused and left running.
 * Playwright is the globally installed one; never run "playwright install".
 *
 * ───────────────────────────── STATUS ─────────────────────────────
 * Written while the game shell was still being integrated and NOT RUN YET. It is programmed
 * against the debug hooks below; the lead adjusts the CONTRACT section if a name changed, then
 * runs it. Every hook is used in exactly one helper, so a rename is a one-line change.
 *
 * ───────────────────── DEBUG HOOKS THIS SCRIPT RELIES ON ─────────────────────
 * Page URL parameters (the hooks exist only with ?debug=1 or under the dev server):
 *   debug=1             enables everything below, also in a production build
 *   lang=en|ar          start in this language (not saved)
 *   fakestore=1         simulated store: products come back with prices, purchases and ads succeed
 *                       (the shop screenshot needs priced coin packs; no real store exists in a browser)
 *   save=<base64 json>  start from this save instead of the stored one (base64 or base64url of the
 *                       UTF-8 JSON; nothing is written to real storage) — see makeSave() below
 * Optional, harmless when unknown: still=1 (no ambient animation loops), seed=<n> (level seed),
 * fast=1 (shorter animations), set through EXTRA_QUERY below.
 *
 * window.__booted            true once the first screen is on display
 * window.__app.ctx           the AppContext (src/app/types.ts): profile, levels, store, nav, i18n …
 * window.__app.goto(screen, arg)
 *                            'title' · 'map' ({ focusLevel }) · 'intro' (level number) ·
 *                            'play' (level number) · 'shop'
 * window.__play              the play screen's hooks (src/play/index.ts):
 *     state()                'intro' | 'play' | 'finale' | 'won' | 'lost' | 'none'
 *     isIdle()               true when no animation is running and input is accepted
 *     hint()                 a valid move { a: { c, r }, b: { c, r } } or null
 *     swap(a, b)             plays that move as if the player had swiped it
 *     finish()               skips the end-of-level finale
 *
 * Google Play rules these files follow (docs/research/play-policy.md): JPEG or 24-bit PNG without
 * alpha; each side 320–3840 px and the long side at most twice the short side; at least three
 * 9:16 portrait screenshots of 1080×1920 or larger for a game to be eligible for the large
 * recommendation formats; real in-game footage; no device frame, no fingers, no ranking, price
 * or "download now" wording; at most 8 per device type. Nothing is drawn on top of the captures.
 */
const { chromium } = require('playwright');
const path = require('path');
const { ROOT, startServer, toOpaqueRgbPng, pngInfo, writeFile, sleep } = require('./lib.cjs');

// ───────────────────────────── CONTRACT (adjust here) ─────────────────────────────

const PORT = 5188;
const OUT = path.join(ROOT, 'store', 'screenshots');
/** 360×640 CSS px at 3× = exactly 1080×1920 device pixels. */
const VIEW = { width: 360, height: 640, scale: 3 };
const SHOT = { width: 1080, height: 1920 };
const LANGS = ['en', 'ar'];

/** Query parameters added to every page. */
const BASE_QUERY = { debug: '1', fakestore: '1' };
/** Optional switches (ignored by the game when it does not know them). */
const EXTRA_QUERY = { still: '1' };

/** Levels used for the captures (override: SHOTS_PLAY_LEVEL, SHOTS_WIN_LEVEL). */
const PLAY_LEVEL = Number(process.env.SHOTS_PLAY_LEVEL || 23); // a later level: more to look at than level 1
const WIN_LEVEL = Number(process.env.SHOTS_WIN_LEVEL || 4); // an easy early level the hint player wins quickly
/** The journey shown on the map: levels 1..PROGRESS are won, so the next one is current. */
const PROGRESS = PLAY_LEVEL - 1;
/** Level seeds tried in turn for the win scene (a hint-following player can lose a level). */
const WIN_SEEDS = [11, 7, 3, 21, 42];

const hooks = {
  booted: (page) => page.waitForFunction(() => window.__booted === true || (window.__app && window.__app.ctx), null, { timeout: 30000 }),
  goto: (page, screen, arg) => page.evaluate(([s, a]) => window.__app.goto(s, a), [screen, arg === undefined ? null : arg]),
  playState: (page) => page.evaluate(() => (window.__play ? window.__play.state() : 'none')),
  playIdle: (page) => page.waitForFunction(() => window.__play && (window.__play.isIdle() || window.__play.state() !== 'play'), null, { timeout: 30000 }),
  hint: (page) => page.evaluate(() => window.__play.hint()),
  swap: (page, move) => page.evaluate((m) => window.__play.swap(m.a, m.b), move),
  finish: (page) => page.evaluate(() => (typeof window.__play.finish === 'function' ? window.__play.finish() : undefined)),
};

const today = Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000);

/**
 * A save for a player in mid-journey: levels 1..upTo won with mixed stars, a healthy coin balance,
 * full lives, every booster already introduced, today's daily reward already claimed (so no pop-up
 * covers the screen). Field names follow src/state/types.ts; unknown fields are ignored by the game.
 */
function makeSave(opts) {
  const o = Object.assign({ upTo: PROGRESS, coins: 3450, lives: 5 }, opts || {});
  const levels = {};
  for (let i = 1; i <= o.upTo; i++) levels[i] = { stars: 1 + ((i * 7 + 1) % 3), best: 2400 + ((i * 373) % 4000) };
  const data = {
    version: 1,
    levels,
    coins: o.coins,
    lives: o.lives,
    lifeTimer: 0,
    boosters: { hammer: 3, freeSwap: 2, shuffle: 2, extraMoves: 2, prism: 1, beamNova: 2 },
    settings: { sfx: true, music: true, haptics: true, lang: null },
    dailyDay: today,
    dailyStreak: 3,
    seen: [],
    stats: { played: o.upTo, won: o.upTo, bestCascade: 4, totalScore: o.upTo * 3000 },
    firstDay: today - 30,
    gifted: ['beamNova', 'hammer', 'freeSwap', 'prism', 'shuffle', 'extraMoves'],
    caravan: 0,
  };
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ───────────────────────────── scenes ─────────────────────────────

/** Follow the game's own hints for up to `max` moves; stops when the level is no longer in play. */
async function playHints(page, max) {
  let made = 0;
  for (let i = 0; i < max; i++) {
    await hooks.playIdle(page);
    if ((await hooks.playState(page)) !== 'play') break;
    const move = await hooks.hint(page);
    if (!move) break;
    await hooks.swap(page, move);
    await sleep(150);
    made++;
  }
  await hooks.playIdle(page);
  return made;
}

async function waitPlay(page) {
  await page.waitForFunction(() => window.__play && window.__play.state() === 'play' && window.__play.isIdle(), null, { timeout: 30000 });
}

/**
 * name → { file, query(lang), run(page) }. `run` leaves the page in the state to capture; returning
 * false means "this attempt did not produce the scene" (the win scene then tries its next seed).
 */
const SCENES = [
  {
    name: 'play',
    file: '01-play.png',
    variants: [{}],
    async run(page) {
      await hooks.goto(page, 'play', PLAY_LEVEL);
      await waitPlay(page);
      await playHints(page, 6); // a few moves in: counters have moved, specials are on the board
      if ((await hooks.playState(page)) !== 'play') return false;
      await sleep(900);
      return true;
    },
  },
  {
    name: 'map',
    file: '02-map.png',
    variants: [{}],
    async run(page) {
      await hooks.goto(page, 'map', { focusLevel: PLAY_LEVEL });
      await sleep(1200);
      return true;
    },
  },
  {
    name: 'intro',
    file: '03-level-intro.png',
    variants: [{}],
    async run(page) {
      await hooks.goto(page, 'map', { focusLevel: PLAY_LEVEL });
      await sleep(500);
      await hooks.goto(page, 'intro', PLAY_LEVEL);
      await sleep(1000);
      return true;
    },
  },
  {
    name: 'win',
    file: '04-win.png',
    variants: WIN_SEEDS.map((seed) => ({ seed: String(seed), fast: '1' })),
    async run(page) {
      await hooks.goto(page, 'play', WIN_LEVEL);
      await waitPlay(page);
      await playHints(page, 80);
      const reached = await page
        .waitForFunction(() => ['finale', 'won', 'lost'].includes(window.__play.state()), null, { timeout: 30000 })
        .then(() => true, () => false);
      if (!reached) return false;
      if ((await hooks.playState(page)) === 'lost') return false;
      if ((await hooks.playState(page)) === 'finale') await hooks.finish(page);
      await page.waitForFunction(() => window.__play.state() === 'won', null, { timeout: 20000 });
      await sleep(2600); // the dialog is in, stars and score have finished counting
      return true;
    },
  },
  {
    name: 'shop',
    file: '05-shop.png',
    variants: [{}],
    async run(page) {
      await hooks.goto(page, 'map', { focusLevel: PLAY_LEVEL });
      await sleep(500);
      await hooks.goto(page, 'shop');
      await sleep(1500); // the simulated store has answered with its prices
      return true;
    },
  },
  {
    name: 'title',
    file: '06-title.png',
    variants: [{}],
    async run(page) {
      await hooks.goto(page, 'title');
      await sleep(1000);
      return true;
    },
  },
];

function urlFor(base, lang, extra) {
  const q = Object.assign({}, BASE_QUERY, EXTRA_QUERY, { lang, save: makeSave() }, extra || {});
  return base + '?' + Object.keys(q).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
}

async function main() {
  const words = process.argv.slice(2);
  const langs = LANGS.filter((l) => words.length === 0 || !words.some((w) => LANGS.includes(w)) || words.includes(l));
  const filters = words.filter((w) => !LANGS.includes(w));
  const scenes = SCENES.filter((s) => filters.length === 0 || filters.some((f) => s.name.indexOf(f) >= 0));

  const server = await startServer(PORT);
  const problems = [];
  let written = 0;
  try {
    const browser = await chromium.launch();
    try {
      for (const lang of langs) {
        const context = await browser.newContext({
          viewport: { width: VIEW.width, height: VIEW.height },
          deviceScaleFactor: VIEW.scale,
          hasTouch: true,
          isMobile: true,
          locale: lang === 'ar' ? 'ar' : 'en-US',
        });
        for (const scene of scenes) {
          const label = lang + '/' + scene.file;
          let done = false;
          for (const variant of scene.variants) {
            const page = await context.newPage();
            const pageProblems = [];
            page.on('console', (msg) => {
              if (msg.type() === 'error') pageProblems.push(label + ' [console] ' + msg.text());
            });
            page.on('pageerror', (err) => pageProblems.push(label + ' [exception] ' + err.message));
            try {
              await page.goto(urlFor(server.base, lang, variant), { waitUntil: 'load' });
              await hooks.booted(page);
              if (!(await page.evaluate(() => !!(window.__app && typeof window.__app.goto === 'function')))) {
                throw new Error('window.__app.goto is missing — is ?debug=1 honoured by this build?');
              }
              await sleep(500);
              if (await scene.run(page)) {
                const png = toOpaqueRgbPng(await page.screenshot({ type: 'png' }));
                const info = pngInfo(png);
                if (info.width !== SHOT.width || info.height !== SHOT.height) {
                  throw new Error('captured ' + info.width + '×' + info.height + ', expected ' + SHOT.width + '×' + SHOT.height);
                }
                writeFile(path.join(OUT, lang, scene.file), png);
                console.log('  ' + label + '  ' + info.width + '×' + info.height + '  ' + Math.round(png.length / 1024) + ' KB');
                written++;
                done = true;
              }
            } catch (err) {
              pageProblems.push(label + ' [tool] ' + err.message);
            }
            problems.push(...pageProblems);
            await page.close();
            if (done) break;
          }
          if (!done) problems.push(label + ' was not captured');
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.stop();
  }

  console.log('make-screenshots: ' + written + ' file(s) → ' + path.relative(process.cwd(), OUT));
  if (problems.length) {
    console.log(problems.length + ' problem(s):');
    for (const p of problems.slice(0, 40)) console.log('  ' + p);
    process.exitCode = 1;
  } else {
    console.log('Look at every file before uploading: no dialog half open, no debug overlay, text not clipped.');
  }
}

main().catch((err) => {
  console.error('make-screenshots: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
