/**
 * Promotional ad creatives for use OUTSIDE the store listing (social posts, paid ads).
 * Everything is rendered from the game itself: the board frames are taken from the real game
 * running real levels (the play screen's own canvas, mid-move), the "worlds" tiles are real captures
 * of the level map, and logo, emblem, backdrops and gem sprites come from the game's art module
 * (src/art/index.ts: createArt()). Nothing is drawn by hand except the frame around a tile, the ring
 * around a lens, a few glints, and the lettering (set in the game's bundled font).
 *
 *   node tools/store/make-promo.cjs                 render all 30 images (PNG + JPEG) and the manifest
 *   node tools/store/make-promo.cjs A ar 1080x1920  only what matches every word given
 *                                                   (concept A|B|C, language en|ar, size WxH)
 *   node tools/store/make-promo.cjs --check         no rendering: verify the files that exist
 *                                                   (pixel sizes, formats, weights) and the ad copy
 *                                                   sheets (character limits, counts, forbidden wording)
 *   node tools/store/make-promo.cjs --write-counts  rewrite the counted lengths in AD-COPY.md and
 *                                                   SOCIAL-CAPTIONS.md, then check
 *
 * Output (PROMO_OUT=<dir> writes somewhere else, e.g. for a preview):
 *   store/promo/png/<lang>/zumurud-<concept>-<W>x<H>-<lang>.png   24-bit PNG, no alpha channel
 *   store/promo/jpg/<lang>/zumurud-<concept>-<W>x<H>-<lang>.jpg   JPEG, at most 1 MB
 *   store/promo/manifest.json                                      what each file is, its hook, its weight
 *
 * Concepts (each in five sizes and two languages):
 *   A-hero-board   one real board at the instant a Beam + Nova combination fires, logo, hook
 *   B-worlds       the six chapters of the real level map, in journey order, logo, hook
 *   C-specials     Beam, Nova and Prism firing in the real game, seen through three lenses
 * Sizes: 1080×1080, 1080×1350, 1080×1920, 1200×628, 1200×1200.
 *
 * How the real game is captured
 *   The dev server is started here (`npx vite --port 5190 --strictPort` in the match3 directory) and
 *   stopped afterwards; one that already answers on 5190 is reused and left running. The game is
 *   opened with its debug switches (?debug=1&lang=…&still=1&gate=off&seed=N&save=…, src/ui/flags.ts)
 *   and driven through window.__app / window.__play (src/main.ts, src/play/index.ts). The page clock
 *   is Playwright's, paused: a frame is taken an exact number of milliseconds after the move, so a
 *   run always shows the same instant. Math.random is seeded for the same reason (sparks).
 *   A scene names the level, the seed and the move; if the level data changed and the seed no longer
 *   gives the scene, another seed is searched with the game's own engine.
 *
 * Rules these files follow (docs/research/play-policy.md, naming-ip.md, and the ad platforms):
 *   no other game, app or brand is named, shown or imitated; no ranking, price or promotion wording
 *   and no call to action in the lettering; the lettering is short and large; real game footage only;
 *   the line "Available on Google Play" is plain text in the game's own font — Google's badge artwork
 *   is NOT drawn or imitated here (the owner adds the official badge, see store/promo/README.md).
 *
 * Playwright is the globally installed one (`require('playwright')`); never run "playwright install".
 * PROMO_CACHE=<dir> keeps the captures between runs (layout work); leave it unset for a real run.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, startServer, pngInfo, writeFile } = require('./lib.cjs');

const PORT = 5190;
const OUT = process.env.PROMO_OUT ? path.resolve(process.env.PROMO_OUT) : path.join(ROOT, 'store', 'promo');
const CACHE = process.env.PROMO_CACHE ? path.resolve(process.env.PROMO_CACHE) : null;
const ARGS = process.argv.slice(2);
const CHECK_ONLY = ARGS.includes('--check') || ARGS.includes('--write-counts');
const WRITE_COUNTS = ARGS.includes('--write-counts');
const WORDS = ARGS.filter((a) => !a.startsWith('--'));

const LANGS = ['en', 'ar'];
const CONCEPTS = [
  { id: 'A', slug: 'A-hero-board' },
  { id: 'B', slug: 'B-worlds' },
  { id: 'C', slug: 'C-specials' },
];
const SIZES = [
  { id: '1080x1080', w: 1080, h: 1080, shape: 'square' },
  { id: '1080x1350', w: 1080, h: 1350, shape: 'portrait' },
  { id: '1080x1920', w: 1080, h: 1920, shape: 'story' },
  { id: '1200x628', w: 1200, h: 628, shape: 'landscape' },
  { id: '1200x1200', w: 1200, h: 1200, shape: 'square' },
];
/** Largest JPEG written (bytes); the PNG must stay under what Google Ads accepts for an image asset. */
const JPG_MAX = 1000000;
const PNG_MAX = 5 * 1024 * 1024;

/**
 * The lettering on the images. Hooks are 2–6 words, true of the game as it is, with no ranking,
 * price or promotion word and no call to action. Arabic follows the game's own vocabulary
 * (src/i18n/strings/common.ts): مرحلة, جواهر, شعاع, نوفا, منشور; digits are Western, as in the game.
 */
const COPY = {
  en: {
    dir: 'ltr',
    A: { hook: ['Match gems.', 'Light the night.'] },
    B: { hook: ['Six worlds.', '120 levels.'] },
    C: { labels: ['Beam.', 'Nova.', 'Prism.'] },
    store: 'Available on Google Play',
    alt: {
      A: 'A board of gems in Zumurud as a Beam and a Nova fire together in a cross of light. Text: Match gems. Light the night.',
      B: 'The six chapters of the Zumurud level map side by side, from the oasis to the starlit sky. Text: Six worlds. 120 levels.',
      C: 'Three close-ups of the Zumurud board: a Beam clearing a row, a Nova blast and a Prism clearing one colour. Text: Beam. Nova. Prism.',
    },
  },
  ar: {
    dir: 'rtl',
    A: { hook: ['طابِق الجواهر', 'وأضِئ الليل'] },
    B: { hook: ['ستة عوالم', '120 مرحلة'] },
    C: { labels: ['شعاع', 'نوفا', 'منشور'] },
    store: 'متوفّرة على Google Play',
    alt: {
      A: 'لوحة جواهر في لعبة زمرد لحظة انطلاق شعاع ونوفا معًا في تقاطع من الضوء. النص: طابِق الجواهر وأضِئ الليل.',
      B: 'فصول خريطة المراحل الستة في لعبة زمرد متجاورة، من الواحة إلى سماء النجوم. النص: ستة عوالم، 120 مرحلة.',
      C: 'ثلاث لقطات مقرّبة من لوحة زمرد: شعاع يمسح صفًّا، ونوفا تنفجر، ومنشور يزيل لونًا كاملًا. النص: شعاع، نوفا، منشور.',
    },
  },
};

// ───────────────────────────── scenes captured from the real game ─────────────────────────────

/** Viewport of the play captures: a large phone, 3 device pixels per CSS pixel (the game's cap). */
const PLAY_VIEW = { w: 600, h: 1066, dsf: 3 };
/** Start boosters of every board scene: the game's own "Prism" and "Beam & Nova" head starts. */
const BOOSTERS = { prism: true, beamNova: true };

/**
 * A scene = which level, a seed, the move to play and the instant to take (ms after the move).
 * The level is chosen by what it contains, not by its number, because the level order is still
 * being tuned: `pick: 'rich'` = the 8×8 level with lamps, chains and stones and nothing else in the
 * way (today level 78, in the Palace chapter); `pick: 'plain'` = the 8×8 level of nothing but gems
 * in six colours (today level 50, in the Bazaar chapter; it comes with two beams and a nova of its own). `prefer` is the level / seed / move the
 * frames were chosen with; when it no longer gives the scene, the game's own engine searches
 * another seed (see probeScene). The backdrop of the image is the chapter that level belongs to.
 * `want`: 'combo' = a beam and a nova side by side in the middle of the board are swapped, the
 * prism stands outside the blast; 'single' = the move fires exactly one special of that kind.
 */
const SCENES = {
  hero: { pick: 'rich', prefer: { level: 78, seed: 3765, a: { c: 3, r: 4 }, b: { c: 4, r: 4 } }, at: 512, want: { type: 'combo' } },
  beam: { pick: 'plain', prefer: { level: 50, seed: 899, a: { c: 4, r: 4 }, b: { c: 4, r: 5 } }, at: 592, want: { type: 'single', fx: 'beamH' } },
  nova: { pick: 'plain', prefer: { level: 50, seed: 13, a: { c: 3, r: 3 }, b: { c: 4, r: 3 } }, at: 560, want: { type: 'single', fx: 'nova' } },
  prism: { pick: 'plain', prefer: { level: 50, seed: 3495, a: { c: 4, r: 2 }, b: { c: 4, r: 3 } }, at: 560, want: { type: 'single', fx: 'prism' } },
};

/** Map tiles: CSS size of the part of the map that is kept (between the top bar and the tray). */
const MAP_TILES = {
  grid: { cssW: 320, cssH: 330 }, // square formats, 3 × 2
  tall: { cssW: 320, cssH: 420 }, // portrait and story, 3 × 2
  strip: { cssW: 320, cssH: 700 }, // landscape, 6 × 1
};
/** The level each chapter's tile is centred on (one per chapter, in journey order). */
const MAP_FOCUS = [9, 29, 49, 69, 89, 109];
const MAP_DSF = 3;

/** A fixed moment for the paused page clock: 13 Nov 2026, 10:00 in Kuwait (UTC+3). */
const CLOCK_T0 = Date.UTC(2026, 10, 13, 7, 0, 0);
const CLOCK_ZONE = 'Asia/Kuwait';
const CLOCK_DAY = Math.floor(Date.UTC(2026, 10, 13) / 86400000);

/** Stand-in for Vite's dev client: styles are injected, hot reloads are not (other people edit this tree). */
const VITE_CLIENT_STUB = `
const sheets = new Map();
export function updateStyle(id, content) {
  let s = sheets.get(id);
  if (!s) {
    s = document.createElement('style');
    s.setAttribute('type', 'text/css');
    s.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(s);
    sheets.set(id, s);
  }
  s.textContent = content;
}
export function removeStyle(id) {
  const s = sheets.get(id);
  if (s) { s.remove(); sheets.delete(id); }
}
export function createHotContext() {
  const noop = () => {};
  return { data: {}, accept: noop, acceptExports: noop, dispose: noop, prune: noop, invalidate: noop, on: noop, off: noop, send: noop };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay {}
`;

/**
 * A save for a player near the end of the journey: levels 1..119 won (mostly three stars), every
 * booster met, today's daily reward claimed, sound off. Field names: src/state/types.ts.
 */
function saveParam() {
  const levels = {};
  for (let i = 1; i <= 119; i++) levels[i] = { stars: i % 5 === 2 ? 2 : 3, best: 2400 + ((i * 373) % 4000) };
  const data = {
    version: 1,
    levels,
    coins: 3450,
    lives: 5,
    lifeTimer: 0,
    boosters: { hammer: 3, freeSwap: 2, shuffle: 2, extraMoves: 2, prism: 2, beamNova: 2 },
    settings: { sfx: false, music: false, haptics: false, lang: null },
    dailyDay: CLOCK_DAY,
    dailyStreak: 3,
    seen: [],
    stats: { played: 119, won: 119, bestCascade: 4, totalScore: 119 * 3000 },
    firstDay: CLOCK_DAY - 30,
    gifted: ['beamNova', 'hammer', 'freeSwap', 'prism', 'shuffle', 'extraMoves'],
    caravan: 0,
  };
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const problems = [];

async function openGame(browser, base, o) {
  const context = await browser.newContext({
    viewport: { width: o.w, height: o.h },
    deviceScaleFactor: o.dsf,
    hasTouch: true,
    isMobile: true,
    locale: o.lang === 'ar' ? 'ar' : 'en-US',
    timezoneId: CLOCK_ZONE,
  });
  const page = await context.newPage();
  await page.route('**/@vite/client', (route) => route.fulfill({ contentType: 'application/javascript', body: VITE_CLIENT_STUB }));
  const tag = '[' + o.tag + '] ';
  page.on('console', (msg) => {
    const type = msg.type();
    if ((type === 'error' || type === 'warning') && !/willReadFrequently/.test(msg.text())) problems.push(tag + 'console.' + type + ': ' + msg.text());
  });
  page.on('pageerror', (err) => problems.push(tag + 'page exception: ' + err.message));
  // the same sparks on every run
  await page.addInitScript(() => {
    let s = 0x9e3779b9;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.clock.install({ time: CLOCK_T0 });
  const q = Object.assign({ debug: '1', lang: o.lang, still: '1', gate: 'off', fakestore: '0', save: saveParam() }, o.query || {});
  await page.goto(base + '?' + Object.keys(q).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&'), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__booted === true && !!window.__app, null, { timeout: 30000 });
  if (!(await page.evaluate(() => typeof window.__app.goto === 'function'))) throw new Error('window.__app.goto is missing — is ?debug=1 honoured by this build?');
  // from here on time only moves when this script says so
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 40);
  return { context, page };
}

/**
 * Runs in a page of the dev server: which level, seed and move give the scene? The game's own
 * level data and engine decide; nothing is assumed about level numbers.
 */
async function probeScene(arg) {
  const { LEVELS, chapterOf } = await import('/src/levels/index.ts');
  const { Game } = await import('/src/engine/index.ts');
  const isBeam = (k) => k === 'beamH' || k === 'beamV';
  const count = (level, chars) => {
    let n = 0;
    for (const row of level.pieces) for (const ch of row) if (chars.indexOf(ch) >= 0) n++;
    return n;
  };
  const sand = (level) => (level.floor ? level.floor.join('').replace(/0/g, '').length : 0);
  /** How well a level suits the scene; the best one is used. */
  function score(level) {
    if (level.tutorial !== undefined) return -100; // a tip would open over the board
    const square = level.cols === 8 && level.rows === 8 ? 4 : level.cols === level.rows ? 2 : 0;
    const lamps = count(level, 'L');
    const chains = count(level, 'c');
    const stones = count(level, '123');
    const vines = count(level, 'v');
    const holes = count(level, '_');
    const placed = count(level, 'HVNP');
    if (arg.pick === 'rich') {
      return square + (lamps >= 2 ? 3 : 0) + (chains >= 2 ? 2 : 0) + (stones >= 2 ? 2 : 0) - (vines ? 3 : 0) - (holes ? 3 : 0) - (sand(level) ? 1 : 0) - (placed ? 2 : 0) - (level.colors < 5 ? 2 : 0);
    }
    // special pieces the level itself puts on the board are welcome here: more of them to see
    return square + (level.colors === 6 ? 3 : level.colors === 5 ? 1 : 0) - 2 * Math.min(6, lamps + chains + stones + vines + holes) - (sand(level) ? 2 : 0);
  }
  const pieceAt = (s, p) => {
    const cell = s.cells[p.r * s.cols + p.c];
    return cell && cell.piece ? cell.piece : null;
  };
  /** The move for this level and seed, or null. `fixed` = the move must be this one. */
  function tryIt(level, seed, fixed) {
    const g0 = new Game(level, { seed, boosters: arg.boosters });
    const s = g0.snapshot();
    const cx = (s.cols - 1) / 2;
    const cy = (s.rows - 1) / 2;
    if (arg.want.type === 'combo') {
      const specials = [];
      s.cells.forEach((cell, i) => {
        if (cell.piece && (isBeam(cell.piece.kind) || cell.piece.kind === 'nova' || cell.piece.kind === 'prism')) specials.push({ c: i % s.cols, r: Math.floor(i / s.cols), kind: cell.piece.kind, chained: cell.piece.chained });
      });
      const prism = specials.find((p) => p.kind === 'prism');
      for (const beam of specials.filter((p) => isBeam(p.kind) && !p.chained)) {
        for (const nova of specials.filter((p) => p.kind === 'nova' && !p.chained)) {
          if (Math.abs(beam.c - nova.c) + Math.abs(beam.r - nova.r) !== 1) continue;
          for (const [a, b] of [[nova, beam], [beam, nova]]) {
            // the blast is centred on b: three rows and three columns
            if (Math.max(Math.abs(b.c - cx), Math.abs(b.r - cy)) > 0.5) continue;
            if (!prism || Math.abs(prism.c - b.c) <= 1 || Math.abs(prism.r - b.r) <= 1) continue;
            if (fixed && (a.c !== fixed.a.c || a.r !== fixed.a.r || b.c !== fixed.b.c || b.r !== fixed.b.r)) continue;
            if (!g0.canSwap({ c: a.c, r: a.r }, { c: b.c, r: b.r })) continue;
            return { a: { c: a.c, r: a.r }, b: { c: b.c, r: b.r }, focus: { c: b.c, r: b.r }, color: -1 };
          }
        }
      }
      return null;
    }
    const moves = fixed ? [fixed] : g0.validMoves();
    for (const m of moves) {
      const pa = pieceAt(s, m.a);
      const pb = pieceAt(s, m.b);
      if (!pa || !pb) continue;
      const prismSwap = pa.kind === 'prism' || pb.kind === 'prism';
      if ((arg.want.fx === 'prism') !== prismSwap) continue;
      const g = new Game(level, { seed, boosters: arg.boosters });
      const turn = g.swap(m.a, m.b);
      if (!turn.accepted) continue;
      const acts = turn.steps.filter((x) => x.type === 'activate');
      const total = acts.reduce((n, x) => n + x.fx.length, 0);
      if (total !== 1 || acts[0].fx[0].kind !== arg.want.fx) continue;
      const firstFall = turn.steps.findIndex((x) => x.type === 'fall');
      if (firstFall >= 0 && turn.steps.indexOf(acts[0]) > firstFall) continue;
      const fx = acts[0].fx[0];
      if (Math.max(Math.abs(fx.at.c - cx), Math.abs(fx.at.r - cy)) > 0.5) continue;
      // a prism should have plenty to clear, or the picture is thin
      if (arg.want.fx === 'prism' && fx.targets.length < 12) continue;
      return { a: m.a, b: m.b, focus: { c: fx.at.c, r: fx.at.r }, color: fx.color };
    }
    return null;
  }
  const ranked = LEVELS.map((level) => ({ level, score: score(level) })).sort((x, y) => y.score - x.score || x.level.id - y.level.id);
  const best = ranked[0].score;
  const done = (level, seed, hit, searched) => ({ ok: true, level: level.id, theme: chapterOf(level.id).theme, cols: level.cols, rows: level.rows, seed, a: hit.a, b: hit.b, focus: hit.focus, color: hit.color, searched });
  // the frames were chosen with this level, seed and move: keep them while they still hold
  const preferred = ranked.find((x) => x.level.id === arg.prefer.level);
  if (preferred && preferred.score === best) {
    const hit = tryIt(preferred.level, arg.prefer.seed, { a: arg.prefer.a, b: arg.prefer.b });
    if (hit) return done(preferred.level, arg.prefer.seed, hit, false);
  }
  for (const entry of ranked.slice(0, 8)) {
    for (let seed = 1; seed <= 12000; seed++) {
      const hit = tryIt(entry.level, seed, null);
      if (hit) return done(entry.level, seed, hit, true);
    }
  }
  return { ok: false, why: 'no level and seed give the scene' };
}

/** One board scene from the real game → { png, meta }. */
async function captureBoard(browser, base, name, scene, stagePage) {
  const found = await stagePage.evaluate(probeScene, { pick: scene.pick, prefer: scene.prefer, want: scene.want, boosters: BOOSTERS });
  if (!found.ok) throw new Error('scene "' + name + '": ' + found.why);
  if (found.searched) console.log('  note: scene "' + name + '": level ' + scene.prefer.level + ' with seed ' + scene.prefer.seed + ' no longer gives it (the level data changed) — using level ' + found.level + ', seed ' + found.seed + '. LOOK at the result.');
  const { context, page } = await openGame(browser, base, { lang: 'en', w: PLAY_VIEW.w, h: PLAY_VIEW.h, dsf: PLAY_VIEW.dsf, tag: name, query: { seed: String(found.seed) } });
  try {
    await page.evaluate(([n, b]) => window.__app.ctx.nav.toPlay(n, b), [found.level, BOOSTERS]);
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) {
      await page.clock.runFor(100);
      ready = await page.evaluate(() => !!window.__play && window.__play.state() === 'play' && window.__play.isIdle() && !document.querySelector('.k-overlay'));
    }
    if (!ready) throw new Error('scene "' + name + '": level ' + found.level + ' did not become playable');
    // where the board sits in the canvas: the frame is opaque, its soft shadow is not
    const geo = await page.evaluate(() => {
      const c = document.querySelector('.pl-board');
      const box = c.getBoundingClientRect();
      const scale = c.width / box.width;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width;
      let y0 = c.height;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] >= 250) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      const snap = window.__play.snapshot();
      const first = window.__play.cell(0, 0);
      const cell = window.__play.shown().cell * scale;
      return {
        width: c.width,
        height: c.height,
        board: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
        cell,
        origin: { x: (first.x - box.left) * scale - cell / 2, y: (first.y - box.top) * scale - cell / 2 },
        cols: snap.cols,
        rows: snap.rows,
      };
    });
    const accepted = await page.evaluate(([a, b]) => window.__play.swap(a, b), [found.a, found.b]);
    if (accepted === false) throw new Error('scene "' + name + '": the game refused the move');
    await page.clock.runFor(scene.at);
    const url = await page.evaluate(() => document.querySelector('.pl-board').toDataURL('image/png'));
    const meta = Object.assign({ level: found.level, theme: found.theme, seed: found.seed, move: { a: found.a, b: found.b }, at: scene.at, focus: found.focus, color: found.color }, geo);
    return { png: Buffer.from(url.split(',')[1], 'base64'), meta };
  } finally {
    await context.close();
  }
}

/** The six chapters of the real level map, cropped between the top bar and the tray → [png × 6]. */
async function captureMap(browser, base, lang, kind) {
  const tile = MAP_TILES[kind];
  const CHROME = 200; // room for the top bar and the tray, which are cut off
  const { context, page } = await openGame(browser, base, { lang, w: tile.cssW, h: tile.cssH + CHROME, dsf: MAP_DSF, tag: 'map-' + kind + '-' + lang, query: { screen: 'map' } });
  const out = [];
  try {
    await page.clock.runFor(1500);
    for (const focus of MAP_FOCUS) {
      await page.evaluate((n) => window.__app.goto('map', { focusLevel: n }), focus);
      await page.clock.runFor(2500);
      const free = await page.evaluate(() => {
        const top = document.querySelector('.m-top');
        const tray = document.querySelector('.m-tray');
        const overlay = document.querySelector('.k-overlay');
        if (!top || !tray) return null;
        return { from: top.getBoundingClientRect().bottom, to: tray.getBoundingClientRect().top, overlay: !!overlay };
      });
      if (!free) throw new Error('the map screen has no .m-top / .m-tray (src/ui changed?)');
      if (free.overlay) throw new Error('a dialog covers the map (level ' + focus + ', ' + lang + ')');
      const room = free.to - free.from;
      if (room < tile.cssH) throw new Error('the map leaves ' + room + ' CSS px between bar and tray, the tile needs ' + tile.cssH);
      const y = Math.round(free.from + (room - tile.cssH) / 2);
      out.push(await page.screenshot({ type: 'png', clip: { x: 0, y, width: tile.cssW, height: tile.cssH } }));
    }
  } finally {
    await context.close();
  }
  return out;
}

// ───────────────────────────── the stage (runs in the page) ─────────────────────────────

const FONT_DIR = '/node_modules/@fontsource-variable/baloo-bhaijaan-2/files/';
/** A blank page on the dev server's origin, with the game's bundled font declared. */
const STAGE_HTML =
  '<!doctype html><meta charset="utf-8"><title>promo stage</title><style>' +
  "@font-face{font-family:'Baloo Bhaijaan 2 Variable';font-style:normal;font-display:block;font-weight:400 800;" +
  'src:url(' + FONT_DIR + "baloo-bhaijaan-2-arabic-wght-normal.woff2) format('woff2-variations');" +
  'unicode-range:U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC}' +
  "@font-face{font-family:'Baloo Bhaijaan 2 Variable';font-style:normal;font-display:block;font-weight:400 800;" +
  'src:url(' + FONT_DIR + "baloo-bhaijaan-2-latin-wght-normal.woff2) format('woff2-variations');" +
  'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}' +
  'html,body{margin:0;background:#14123a}</style><body></body>';

/**
 * Layouts, in design units: 1080 wide for the square, portrait and story formats (1200×1200 is the
 * square layout scaled), 1200×628 for the landscape one. Positions are written for left-to-right;
 * for Arabic the page mirrors them (x → width − x, start ↔ end, rotations negated).
 *
 *   lock   logo lockup: emblem + wordmark. mode 'h' side by side (h = emblem diameter), 'v' stacked
 *          (d = emblem diameter). `ax` is the anchor: the centre (align 'center') or the start edge.
 *   hook   lines of the hook: top `y`, anchor `ax`, widest line `w`, room `h`, largest font size `max`
 *   store  the "Available on Google Play" text line: anchor, centre line `cy`, font size
 *   gems   decoration: [sprite key, x, y, size, rotation°]
 *
 * Story format (1080×1920): logo and lettering stay between y = 269 and y = 1248 and 65 px away from
 * the sides — the part of a story / reel that the apps' own buttons and captions leave free.
 */
const LAYOUT = {
  A: {
    theme: 'palace', // used only if the capture does not name its chapter
    square: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 28, h: 104 },
      hook: { ax: 540, align: 'center', y: 144, w: 960, h: 216, max: 100 },
      board: { cx: 540, y: 372, size: 624 },
      store: { ax: 540, align: 'center', cy: 1042, size: 31 },
      gems: [
        ['gem0', 100, 520, 132, -14],
        ['gem3', 984, 470, 118, 12],
        ['nova4', 104, 838, 150, 10],
        ['gem1', 988, 800, 140, -10],
        ['gem2', 152, 690, 72, 18],
        ['gem5', 940, 640, 74, -16],
      ],
    },
    portrait: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 40, h: 116 },
      hook: { ax: 540, align: 'center', y: 176, w: 980, h: 252, max: 116 },
      board: { cx: 540, y: 448, size: 800 },
      store: { ax: 540, align: 'center', cy: 1306, size: 33 },
      gems: [
        ['gem0', 64, 560, 124, -14],
        ['gem3', 1020, 520, 118, 12],
        ['nova4', 62, 1150, 140, 10],
        ['gem1', 1022, 1120, 130, -10],
      ],
    },
    story: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 284, h: 116 },
      hook: { ax: 540, align: 'center', y: 418, w: 930, h: 236, max: 112 },
      store: { ax: 540, align: 'center', cy: 696, size: 33 },
      board: { cx: 540, y: 756, size: 830 },
      gems: [
        ['gem0', 120, 1716, 190, -12],
        ['nova1', 420, 1776, 170, 8],
        ['beamH5', 700, 1716, 180, -6],
        ['gem4', 960, 1786, 170, 14],
      ],
    },
    landscape: {
      lock: { mode: 'h', ax: 56, align: 'start', y: 92, h: 96 },
      hook: { ax: 56, align: 'start', y: 216, w: 520, h: 196, max: 84 },
      store: { ax: 56, align: 'start', cy: 470, size: 27, ornaments: 'end' },
      board: { cx: 884, y: 44, size: 540 },
      gems: [
        ['gem0', 560, 560, 96, -14],
        ['gem3', 588, 96, 80, 12],
      ],
    },
  },
  B: {
    theme: 'stars',
    square: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 28, h: 104 },
      hook: { ax: 540, align: 'center', y: 144, w: 960, h: 216, max: 100 },
      tiles: { x: 40, y: 380, cols: 3, rows: 2, w: 320, h: 302, gap: 20, kind: 'grid', stagger: 0 },
      store: { ax: 540, align: 'center', cy: 1042, size: 31 },
    },
    portrait: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 40, h: 116 },
      hook: { ax: 540, align: 'center', y: 176, w: 980, h: 252, max: 116 },
      tiles: { x: 40, y: 446, cols: 3, rows: 2, w: 320, h: 404, gap: 20, kind: 'tall', stagger: 0 },
      store: { ax: 540, align: 'center', cy: 1308, size: 33 },
    },
    story: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 284, h: 116 },
      hook: { ax: 540, align: 'center', y: 418, w: 930, h: 236, max: 112 },
      store: { ax: 540, align: 'center', cy: 696, size: 33 },
      tiles: { x: 65, y: 756, cols: 3, rows: 2, w: 303, h: 396, gap: 20.5, kind: 'tall', stagger: 0 },
    },
    landscape: {
      lock: { mode: 'h', ax: 48, align: 'start', y: 40, h: 92 },
      hook: { ax: 1152, align: 'end', y: 20, w: 640, h: 136, max: 60 },
      store: { ax: 1152, align: 'end', cy: 178, size: 25, ornaments: 'start' },
      tiles: { x: 40, y: 212, cols: 6, rows: 1, w: 173.33, h: 380, gap: 16, kind: 'strip', stagger: 14 },
    },
  },
  C: {
    theme: 'bazaar', // used only if the capture does not name its chapter
    square: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 34, h: 108 },
      lenses: { d: 328, centres: [[194, 470], [540, 470], [886, 470]], label: { dy: 300, max: 92, w: 300 }, badge: 0.4, row: true },
      store: { ax: 540, align: 'center', cy: 1042, size: 31 },
      gems: [
        ['gem2', 90, 965, 120, -12],
        ['gem4', 992, 968, 116, 14],
      ],
    },
    portrait: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 40, h: 116 },
      lenses: { d: 380, centres: [[262, 400], [818, 742], [262, 1084]], label: { side: 556, max: 132, w: 470 }, badge: 0.36 },
      store: { ax: 540, align: 'center', cy: 1308, size: 33 },
    },
    story: {
      lock: { mode: 'h', ax: 540, align: 'center', y: 284, h: 116 },
      store: { ax: 540, align: 'center', cy: 440, size: 31 },
      lenses: { d: 340, centres: [[262, 650], [818, 925], [262, 1200]], label: { side: 556, max: 128, w: 460 }, badge: 0.38 },
      gems: [
        ['beamH5', 190, 1590, 240, -8],
        ['prism', 540, 1660, 310, 6],
        ['nova1', 890, 1590, 240, 10],
        ['gem2', 330, 1820, 150, 14],
        ['gem0', 760, 1830, 150, -12],
      ],
    },
    landscape: {
      lock: { mode: 'v', ax: 196, align: 'center', y: 96, d: 190 },
      lenses: { d: 250, centres: [[520, 222], [790, 222], [1060, 222]], label: { dy: 222, max: 62, w: 240 }, badge: 0.4, row: true },
      store: { ax: 790, align: 'center', cy: 566, size: 26 },
    },
  },
};

/** Installs window.__promo in the stage page. */
async function setupStage(opts) {
  const FONT = '"Baloo Bhaijaan 2 Variable"';
  const artMod = await import('/src/art/index.ts');
  const util = await import('/src/art/util.ts');
  const PAL = util.PAL;
  const art = artMod.createArt();

  // every string must be set in the game's bundled font, never in a fallback
  const sample = opts.sample;
  await Promise.all([document.fonts.load('800 40px ' + FONT, sample), document.fonts.load('700 40px ' + FONT, sample), document.fonts.load('600 40px ' + FONT, sample)]);
  for (const w of ['800', '700', '600']) {
    if (!document.fonts.check(w + ' 40px ' + FONT, sample)) throw new Error('the bundled font did not load — the lettering would use a fallback font');
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('could not load ' + url));
      im.src = url;
    });
  }
  const images = {};
  for (const name of opts.images) images[name] = await loadImage('/__promo_capture__/' + name + '.png');
  const meta = opts.meta;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function goldGradient(g, x0, y0, x1, y1) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#fff3c4');
    gr.addColorStop(0.4, PAL.gold);
    gr.addColorStop(0.75, '#c58c2c');
    gr.addColorStop(1, PAL.goldLight);
    return gr;
  }
  function glint(g, x, y, r, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#fffbe6';
    g.beginPath();
    util.sparkle(g, x, y, r, 0.16);
    g.fill();
    g.restore();
  }

  // ── the logo, taken apart: the emblem and the wordmark of the game's own lockup ──
  const wordmarks = {};
  function wordmark(lang) {
    if (wordmarks[lang]) return wordmarks[lang];
    const LW = 2000;
    const logo = art.logo(LW / window.devicePixelRatio, lang);
    const W = logo.width;
    const d = logo.getContext('2d').getImageData(0, 0, W, logo.height).data;
    const rowInk = (y) => {
      let n = 0;
      for (let x = 0; x < W; x += 2) n += d[(y * W + x) * 4 + 3];
      return n;
    };
    // the emptiest row between emblem and wordmark, and between wordmark and tagline
    const gap = (from, to) => {
      let best = from;
      let ink = Infinity;
      for (let y = Math.round(W * from); y <= Math.round(W * to); y++) {
        const n = rowInk(y);
        if (n < ink) {
          ink = n;
          best = y;
        }
      }
      return best;
    };
    const top = gap(0.485, 0.53);
    const bottom = gap(0.745, 0.8);
    let x0 = W;
    let x1 = -1;
    let y0 = bottom;
    let y1 = top;
    for (let y = top; y < bottom; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) throw new Error('the logo has no wordmark where it is expected');
    const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
    out.getContext('2d').drawImage(logo, -x0, -y0);
    wordmarks[lang] = out;
    return out;
  }

  /** One design: a 2× canvas in design units, the list of lettering boxes, the mirror for Arabic. */
  function makeStage(job) {
    const S = 2;
    const landscape = job.shape === 'landscape';
    const k = landscape ? job.w / 1200 : job.w / 1080;
    const DW = job.w / k;
    const DH = job.h / k;
    const c = canvas(job.w * S, job.h * S);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.scale(S * k, S * k);
    const rtl = job.dir === 'rtl';
    const st = {
      c,
      g,
      S,
      k,
      DW,
      DH,
      rtl,
      lang: job.lang,
      texts: [],
      /** mirror an x position for right-to-left */
      mx: (x) => (rtl ? DW - x : x),
      /** 'start' | 'center' | 'end' → canvas textAlign-like 'left' | 'center' | 'right' */
      side: (align) => (align === 'center' ? 'center' : (align === 'start') !== rtl ? 'left' : 'right'),
    };
    return st;
  }

  function paintBackdrop(st, theme) {
    // the game paints its backdrop in device pixels: give it the 2× canvas, unscaled
    const g = st.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    art.paintBackdrop(g, theme, st.c.width, st.c.height);
    g.restore();
  }

  /** A night-coloured veil, strongest at `cy` (design units), so the lettering stands clear. */
  function veil(st, x, y, w, h, strength) {
    const g = st.g;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(16,13,48,' + strength.toFixed(3) + ')');
    gr.addColorStop(0.62, 'rgba(16,13,48,' + (strength * 0.72).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(16,13,48,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  }

  function drawGems(st, list) {
    const g = st.g;
    for (const [key, x, y, size, deg] of list || []) {
      const px = Math.round(size * st.S * st.k);
      const sprite = art.sprite(key, px);
      g.save();
      g.translate(st.mx(x), y);
      g.rotate(((st.rtl ? -deg : deg) * Math.PI) / 180);
      g.shadowColor = 'rgba(6,4,28,0.55)';
      g.shadowBlur = size * 0.14 * st.S * st.k;
      g.shadowOffsetY = size * 0.06 * st.S * st.k;
      g.drawImage(sprite, -size / 2, -size / 2, size, size);
      g.restore();
    }
  }

  /** Logo lockup. Returns its box { x, y, w, h }. */
  function drawLockup(st, L) {
    const g = st.g;
    const wm = wordmark(st.lang);
    const ratio = wm.width / wm.height;
    let box;
    if (L.mode === 'h') {
      const E = L.h;
      // the Arabic wordmark is a compact, tall shape: it gets more height than the Latin one
      const wh = E * (st.lang === 'ar' ? 0.98 : 0.66);
      const ww = wh * ratio;
      const gapW = E * 0.16;
      const total = E + gapW + ww;
      const side = st.side(L.align);
      const ax = st.mx(L.ax);
      const left = side === 'center' ? ax - total / 2 : side === 'left' ? ax : ax - total;
      const ex = st.rtl ? left + ww + gapW : left;
      const wx = st.rtl ? left : left + E + gapW;
      const wy = L.y + (E - wh) / 2 + (st.lang === 'ar' ? E * 0.02 : E * 0.03);
      drawEmblem(st, ex, L.y, E);
      g.drawImage(wm, wx, wy, ww, wh);
      st.texts.push({ what: 'wordmark', x: wx, y: wy, w: ww, h: wh });
      box = { x: left, y: L.y, w: total, h: E };
    } else {
      const E = L.d;
      const ww = E * (st.lang === 'ar' ? 1.25 : 1.75);
      const wh = ww / ratio;
      const ax = st.mx(L.ax);
      drawEmblem(st, ax - E / 2, L.y, E);
      const wy = L.y + E + E * 0.06;
      g.drawImage(wm, ax - ww / 2, wy, ww, wh);
      st.texts.push({ what: 'wordmark', x: ax - ww / 2, y: wy, w: ww, h: wh });
      box = { x: ax - Math.max(E, ww) / 2, y: L.y, w: Math.max(E, ww), h: E * 1.06 + wh };
    }
    return box;
  }
  function drawEmblem(st, x, y, size) {
    const g = st.g;
    const px = Math.round(size * st.S * st.k);
    const emblem = art.emblem(px);
    g.save();
    g.shadowColor = 'rgba(6,4,28,0.6)';
    g.shadowBlur = size * 0.1 * st.S * st.k;
    g.shadowOffsetY = size * 0.04 * st.S * st.k;
    g.drawImage(emblem, x, y, size, size);
    g.restore();
  }

  /**
   * Lettering. One line of text with a dark outline and a soft shadow. `tone`: 'cream' | 'gold'.
   * Returns the ink box in design units and records it.
   */
  function drawLine(st, text, x, baseline, size, o) {
    const g = st.g;
    g.save();
    g.font = (o.weight || '800') + ' ' + size + 'px ' + FONT;
    g.direction = st.rtl ? 'rtl' : 'ltr';
    g.textAlign = o.align;
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    const m = g.measureText(text);
    const box = { what: o.what || 'hook', text, x: x - m.actualBoundingBoxLeft, y: baseline - m.actualBoundingBoxAscent, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
    // shadow + outline
    g.save();
    g.shadowColor = 'rgba(5,3,26,0.6)';
    g.shadowBlur = size * 0.16 * st.S * st.k;
    g.shadowOffsetY = size * 0.06 * st.S * st.k;
    g.strokeStyle = PAL.night;
    g.lineWidth = size * (o.outline === undefined ? 0.17 : o.outline);
    g.strokeText(text, x, baseline + size * 0.02);
    g.restore();
    if (o.tone === 'gold') {
      g.strokeStyle = '#7a4c10';
      g.lineWidth = size * 0.055;
      g.strokeText(text, x, baseline + size * 0.03);
      const gr = g.createLinearGradient(0, box.y, 0, box.y + box.h);
      gr.addColorStop(0, '#fffdf0');
      gr.addColorStop(0.3, '#ffe68f');
      gr.addColorStop(0.5, '#ffd25c');
      gr.addColorStop(0.56, '#f6b93e');
      gr.addColorStop(1, '#e0902a');
      g.fillStyle = gr;
    } else {
      const gr = g.createLinearGradient(0, box.y, 0, box.y + box.h);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, PAL.cream);
      g.fillStyle = gr;
    }
    g.fillText(text, x, baseline);
    g.restore();
    st.texts.push(box);
    return box;
  }
  function fitSize(st, lines, weight, maxW, maxSize) {
    const g = st.g;
    g.save();
    g.font = weight + ' 100px ' + FONT;
    g.direction = st.rtl ? 'rtl' : 'ltr';
    let widest = 1;
    for (const line of lines) widest = Math.max(widest, g.measureText(line).width);
    g.restore();
    return Math.min(maxSize, Math.floor((maxW / widest) * 100));
  }
  /** The hook: first line cream, the rest gold. Fitted to its width `w` and its room `h`. */
  function drawHook(st, H, lines) {
    const ar = st.lang === 'ar';
    // one line of Arabic stands taller (alif, lam) and hangs lower (waw, kasra) than Latin capitals
    const up = ar ? 0.92 : 0.8;
    const lead = ar ? 1.2 : 1.02;
    const down = ar ? 0.46 : 0.26;
    const tall = up + lead * (lines.length - 1) + down;
    let size = fitSize(st, lines, '800', H.w, H.max);
    if (H.h) size = Math.min(size, Math.floor(H.h / tall));
    const x = st.mx(H.ax);
    const align = st.side(H.align);
    // centred in its room
    let y = H.y + (H.h ? (H.h - tall * size) / 2 : 0) + size * up;
    lines.forEach((line, i) => {
      drawLine(st, line, x, y, size, { align, tone: i === 0 ? 'cream' : 'gold', what: 'hook' });
      y += size * lead;
    });
    return size;
  }

  /** "Available on Google Play": plain text in the game's font between two small gold ornaments. */
  function drawStore(st, T, text) {
    if (!T || T.hidden) return;
    const g = st.g;
    const size = T.size;
    const align = st.side(T.align);
    const x = st.mx(T.ax);
    const box = drawLine(st, text, x, T.cy + size * 0.34, size, { align, tone: 'cream', weight: '700', outline: 0.2, what: 'store line' });
    const oy = T.cy + size * 0.02;
    const rule = size * 1.5;
    const gapW = size * 0.5;
    const orn = (from, to) => {
      g.save();
      g.strokeStyle = util.rgba(PAL.gold, 0.9);
      g.lineWidth = Math.max(1.5, size * 0.085);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(from, oy);
      g.lineTo(to, oy);
      g.stroke();
      g.fillStyle = PAL.goldLight;
      g.beginPath();
      util.poly(g, util.khatamPts(to, oy, size * 0.36, -Math.PI / 2));
      g.fill();
      g.restore();
    };
    // ornaments on both sides, or only on the reading-start / reading-end side of the text
    const which = T.ornaments || 'both';
    const startIsLeft = !st.rtl;
    const left = which === 'both' || (which === 'start') === startIsLeft;
    const right = which === 'both' || (which === 'start') !== startIsLeft;
    if (left) orn(box.x - gapW, box.x - gapW - rule);
    if (right) orn(box.x + box.w + gapW, box.x + box.w + gapW + rule);
  }

  // ── concept A: the hero board ──
  function drawA(st, job) {
    const g = st.g;
    const L = opts.layout.A[job.shape];
    const copy = job.copy;
    paintBackdrop(st, meta.hero.theme || opts.layout.A.theme);
    const cap = meta.hero;
    const B = L.board;
    const bx = st.mx(B.cx) - B.size / 2;
    const scale = B.size / cap.board.w;
    const bh = cap.board.h * scale;
    const cx = bx + B.size / 2;
    const cy = B.y + bh / 2;

    // night veil behind the lettering, and a quiet pool of shade under the board
    if (job.shape === 'landscape') {
      const gr = g.createLinearGradient(st.rtl ? st.DW : 0, 0, st.rtl ? st.DW * 0.4 : st.DW * 0.6, 0);
      gr.addColorStop(0, 'rgba(16,13,48,0.62)');
      gr.addColorStop(0.7, 'rgba(16,13,48,0.34)');
      gr.addColorStop(1, 'rgba(16,13,48,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, st.DW, st.DH);
    } else {
      // strongest behind the lettering, gone at the top edge (story) and under the board's top
      const from = job.shape === 'story' ? 0 : -200;
      const to = B.y + 90;
      const gr = g.createLinearGradient(0, from, 0, to);
      gr.addColorStop(0, 'rgba(16,13,48,0)');
      gr.addColorStop(0.42, 'rgba(16,13,48,0.5)');
      gr.addColorStop(0.8, 'rgba(16,13,48,0.44)');
      gr.addColorStop(1, 'rgba(16,13,48,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, st.DW, to);
    }
    const halo = g.createRadialGradient(cx, cy, B.size * 0.2, cx, cy, B.size * 0.86);
    halo.addColorStop(0, 'rgba(150,190,255,0.42)');
    halo.addColorStop(0.55, 'rgba(120,150,255,0.16)');
    halo.addColorStop(1, 'rgba(120,150,255,0)');
    g.fillStyle = halo;
    g.fillRect(cx - B.size, cy - B.size, B.size * 2, B.size * 2);

    drawGems(st, L.gems);

    // the board, straight from the game's canvas (its own frame, shadow and light)
    g.save();
    g.shadowColor = 'rgba(6,4,28,0.5)';
    g.shadowBlur = B.size * 0.05 * st.S * st.k;
    g.shadowOffsetY = B.size * 0.02 * st.S * st.k;
    g.drawImage(images.hero, bx - cap.board.x * scale, B.y - cap.board.y * scale, cap.width * scale, cap.height * scale);
    g.restore();

    drawLockup(st, L.lock);
    drawHook(st, L.hook, copy.A.hook);
    drawStore(st, L.store, copy.store);

    const gl = job.shape === 'landscape' ? [] : [[bx - 26, B.y + 40, 13, 0.85], [bx + B.size + 22, B.y + bh - 60, 11, 0.8], [bx + B.size + 30, B.y + 120, 8, 0.7], [bx - 30, B.y + bh - 150, 8, 0.7]];
    for (const [x, y, r, a] of gl) glint(g, x, y, r, a);
  }

  // ── concept B: the six worlds of the level map ──
  function drawTile(st, im, x, y, w, h, r) {
    const g = st.g;
    // drop shadow
    g.save();
    g.shadowColor = 'rgba(4,3,22,0.65)';
    g.shadowBlur = 26 * st.S * st.k;
    g.shadowOffsetY = 10 * st.S * st.k;
    g.fillStyle = PAL.night;
    rrect(g, x, y, w, h, r);
    g.fill();
    g.restore();
    // the capture, cover-fitted
    g.save();
    rrect(g, x, y, w, h, r);
    g.clip();
    const s = Math.max(w / im.width, h / im.height);
    const dw = im.width * s;
    const dh = im.height * s;
    g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    // a little depth at the rim
    const rim = g.createLinearGradient(0, y, 0, y + h);
    rim.addColorStop(0, 'rgba(10,8,40,0.22)');
    rim.addColorStop(0.14, 'rgba(10,8,40,0)');
    rim.addColorStop(0.86, 'rgba(10,8,40,0)');
    rim.addColorStop(1, 'rgba(10,8,40,0.3)');
    g.fillStyle = rim;
    g.fillRect(x, y, w, h);
    g.restore();
    // gold frame, as on the game's panels
    g.save();
    g.lineWidth = 7;
    g.strokeStyle = '#2a1a06';
    rrect(g, x, y, w, h, r);
    g.stroke();
    g.lineWidth = 4.2;
    g.strokeStyle = goldGradient(g, x, y, x + w, y + h);
    rrect(g, x, y, w, h, r);
    g.stroke();
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(255,246,220,0.55)';
    rrect(g, x + 3.4, y + 3.4, w - 6.8, h - 6.8, Math.max(2, r - 3.4));
    g.stroke();
    g.restore();
  }
  function drawB(st, job) {
    const g = st.g;
    const L = opts.layout.B[job.shape];
    paintBackdrop(st, opts.layout.B.theme);
    const T = L.tiles;
    // deepen the sky so the six tiles are the brightest thing on the page
    g.fillStyle = 'rgba(12,10,44,0.36)';
    g.fillRect(0, 0, st.DW, st.DH);
    const glow = g.createRadialGradient(st.DW / 2, T.y + (T.rows * T.h) / 2, 40, st.DW / 2, T.y + (T.rows * T.h) / 2, st.DW * 0.75);
    glow.addColorStop(0, 'rgba(120,96,220,0.34)');
    glow.addColorStop(1, 'rgba(120,96,220,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, st.DW, st.DH);

    for (let i = 0; i < 6; i++) {
      const col = i % T.cols;
      const row = Math.floor(i / T.cols);
      // journey order follows the reading direction
      const visualCol = st.rtl ? T.cols - 1 - col : col;
      const x = T.x + visualCol * (T.w + T.gap);
      const y = T.y + row * (T.h + T.gap) + (T.stagger ? (col % 2 === 0 ? T.stagger : -T.stagger) : 0);
      drawTile(st, images['map-' + T.kind + '-' + st.lang + '-' + i], x, y, T.w, T.h, Math.min(30, T.w * 0.12));
    }
    drawLockup(st, L.lock);
    drawHook(st, L.hook, job.copy.B.hook);
    drawStore(st, L.store, job.copy.store);
    if (job.shape !== 'landscape') {
      glint(g, 70, L.hook.y + 30, 12, 0.85);
      glint(g, st.DW - 84, L.hook.y + 150, 10, 0.8);
      glint(g, st.DW - 150, L.lock.y + 20, 7, 0.7);
    }
  }

  // ── concept C: the three special pieces, each firing in the real game ──
  function drawLens(st, name, cx, cy, d, cells, badgeKey, badgeScale, badgeSide) {
    const g = st.g;
    const cap = meta[name];
    const im = images[name];
    const fx = cap.origin.x + (cap.focus.c + 0.5 + (cap.shift ? cap.shift.c : 0)) * cap.cell;
    const fy = cap.origin.y + (cap.focus.r + 0.5 + (cap.shift ? cap.shift.r : 0)) * cap.cell;
    const sr = (cells / 2) * cap.cell;
    const r = d / 2;
    g.save();
    g.shadowColor = 'rgba(4,3,22,0.7)';
    g.shadowBlur = d * 0.09 * st.S * st.k;
    g.shadowOffsetY = d * 0.035 * st.S * st.k;
    g.fillStyle = '#1a1650';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.drawImage(im, fx - sr, fy - sr, sr * 2, sr * 2, cx - r, cy - r, d, d);
    // glass: a soft shade at the rim
    const shade = g.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
    shade.addColorStop(0, 'rgba(8,6,36,0)');
    shade.addColorStop(1, 'rgba(8,6,36,0.38)');
    g.fillStyle = shade;
    g.fillRect(cx - r, cy - r, d, d);
    g.restore();
    // gold ring
    g.save();
    g.lineWidth = d * 0.05;
    g.strokeStyle = '#2a1a06';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = d * 0.034;
    g.strokeStyle = goldGradient(g, cx - r, cy - r, cx + r, cy + r);
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = Math.max(1, d * 0.006);
    g.strokeStyle = 'rgba(255,246,220,0.6)';
    g.beginPath();
    g.arc(cx, cy, r - d * 0.02, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    // the piece itself, as the game draws it, on the rim
    const bs = d * badgeScale;
    const ang = badgeSide === 0 ? Math.PI * 0.5 : badgeSide > 0 ? Math.PI * 0.25 : Math.PI * 0.75;
    const bx = cx + Math.cos(ang) * r * 0.98;
    const by = cy + Math.sin(ang) * r * 0.98;
    const px = Math.round(bs * st.S * st.k);
    g.save();
    g.shadowColor = 'rgba(4,3,22,0.7)';
    g.shadowBlur = bs * 0.16 * st.S * st.k;
    g.shadowOffsetY = bs * 0.06 * st.S * st.k;
    g.drawImage(art.sprite(badgeKey, px), bx - bs / 2, by - bs / 2, bs, bs);
    g.restore();
  }
  function drawC(st, job) {
    const g = st.g;
    const L = opts.layout.C[job.shape];
    paintBackdrop(st, meta.beam.theme || opts.layout.C.theme);
    // the lanterns keep their light: only a thin shade overall, a little more behind the logo
    g.fillStyle = 'rgba(16,10,46,0.14)';
    g.fillRect(0, 0, st.DW, st.DH);
    if (job.shape !== 'landscape') veil(st, 0, 0, st.DW, L.lock.y + L.lock.h + 120, 0.34);
    drawGems(st, L.gems);

    const order = ['beam', 'nova', 'prism'];
    // the badge on each lens is the very piece that fires in it
    const tint = (c, fallback) => (typeof c === 'number' && c >= 0 && c <= 5 ? c : fallback);
    const badges = { beam: 'beamH' + tint(meta.beam.color, 5), nova: 'nova' + tint(meta.nova.color, 1), prism: 'prism' };
    const cells = { beam: 4.3, nova: 4.6, prism: 4.9 };
    const Z = L.lenses;
    const zig = Z.label.side !== undefined;
    for (let i = 0; i < 3; i++) {
      const name = order[i];
      const cx = st.mx(Z.centres[i][0]);
      const cy = Z.centres[i][1];
      // the piece badge: under a lens of a row, on the outer lower side of a lens of the zig-zag
      const outer = Z.row ? 0 : cx < st.DW / 2 ? -1 : 1;
      drawLens(st, name, cx, cy, Z.d, cells[name], badges[name], Z.badge, outer);
      const text = job.copy.C.labels[i];
      const size = fitSize(st, job.copy.C.labels, '800', Z.label.w, Z.label.max);
      if (zig) {
        // label beside the lens, in the free half
        const lx = cx < st.DW / 2 ? cx + Z.label.side - Z.d / 2 + 30 : cx - Z.label.side + Z.d / 2 - 30;
        drawLine(st, text, lx, cy + size * 0.3, size, { align: 'center', tone: i === 1 ? 'gold' : 'cream', what: 'hook' });
      } else {
        drawLine(st, text, cx, cy + Z.label.dy, size, { align: 'center', tone: i === 1 ? 'gold' : 'cream', what: 'hook' });
      }
    }
    drawLockup(st, L.lock);
    drawStore(st, L.store, job.copy.store);
  }

  function finish(st, job) {
    // 2× → 1×
    const out = canvas(job.w, job.h);
    const og = out.getContext('2d');
    og.imageSmoothingEnabled = true;
    og.imageSmoothingQuality = 'high';
    og.drawImage(st.c, 0, 0, job.w, job.h);
    const data = og.getImageData(0, 0, job.w, job.h).data;
    let opaque = true;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) {
        opaque = false;
        break;
      }
    }
    let s = '';
    const step = 0x8000;
    for (let i = 0; i < data.length; i += step) s += String.fromCharCode.apply(null, data.subarray(i, i + step));
    // JPEG: the best quality that stays under the limit
    let jpeg = null;
    let quality = 0;
    for (const q of [0.95, 0.92, 0.9, 0.87, 0.84, 0.8, 0.76, 0.72, 0.66, 0.6]) {
      const url = out.toDataURL('image/jpeg', q);
      const b64 = url.slice(url.indexOf(',') + 1);
      const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
      jpeg = b64;
      quality = q;
      if (bytes <= job.jpgMax) break;
    }
    // lettering boxes in output pixels
    const texts = st.texts.map((t) => ({ what: t.what, text: t.text || '', x: Math.round(t.x * st.k), y: Math.round(t.y * st.k), w: Math.round(t.w * st.k), h: Math.round(t.h * st.k) }));
    return { width: job.w, height: job.h, rgba: btoa(s), opaque, jpeg, quality, texts };
  }

  window.__promo = {
    render(job) {
      const st = makeStage(job);
      if (job.concept === 'A') drawA(st, job);
      else if (job.concept === 'B') drawB(st, job);
      else drawC(st, job);
      return finish(st, job);
    },
  };
  return true;
}

// ───────────────────────────── PNG / JPEG helpers ─────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function pngChunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}
/**
 * RGBA pixels (all opaque) → 24-bit PNG without an alpha channel. Each row takes the PNG filter
 * that leaves the smallest residue, which keeps a painted image far smaller than unfiltered rows.
 */
function encodePng24(width, height, rgba) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  for (let y = 0; y < height; y++) {
    let i = y * width * 4;
    for (let x = 0; x < stride; x += 3, i += 4) {
      cur[x] = rgba[i];
      cur[x + 1] = rgba[i + 1];
      cur[x + 2] = rgba[i + 2];
    }
    const sums = [0, 0, 0, 0, 0];
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? cur[x - 3] : 0;
      const b = prev[x];
      const c = x >= 3 ? prev[x - 3] : 0;
      const v = cur[x];
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const f = [v, (v - a) & 255, (v - b) & 255, (v - ((a + b) >> 1)) & 255, (v - paeth) & 255];
      for (let k = 0; k < 5; k++) {
        cand[k][x] = f[k];
        sums[k] += f[k] < 128 ? f[k] : 256 - f[k];
      }
    }
    let best = 0;
    for (let k = 1; k < 5; k++) if (sums[k] < sums[best]) best = k;
    const o = y * (stride + 1);
    raw[o] = best;
    cand[best].copy(raw, o + 1);
    cur.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB, no alpha
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

/** Width and height of a baseline / progressive JPEG (from its start-of-frame marker). */
function jpegInfo(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG file');
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) throw new Error('bad JPEG marker');
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7), components: buf[off + 9] };
    }
    off += 2 + len;
  }
  throw new Error('JPEG has no frame header');
}

function fileName(concept, size, lang, ext) {
  return 'zumurud-' + concept.slug + '-' + size.id + '-' + lang + '.' + ext;
}

// ───────────────────────────── check mode ─────────────────────────────

/** Wording that must not appear on an image, in an ad text or in a caption. */
const BANNED = {
  en: ['best', '#1', 'no. 1', 'number one', 'top', 'new', 'free', 'discount', 'sale', 'million downloads', 'download now', 'play now', 'install now', 'get it now', 'app of the year', "editor's choice", 'popular', 'award', 'guaranteed', 'addictive'],
  ar: ['الأفضل', 'أفضل', 'رقم 1', 'رقم واحد', '#1', 'مجان', 'جديد', 'خصم', 'تخفيض', 'عرض خاص', 'حمّل الآن', 'حمل الآن', 'العب الآن', 'نزّل الآن', 'ثبّت الآن', 'الأكثر', 'الأشهر', 'جائزة', 'مضمون', 'إدمان'],
};
/** Names and vocabulary of other games: read from the naming research, never spelled out here. */
function otherGamesVocabulary() {
  const file = path.join(ROOT, 'docs', 'research', 'naming-ip.md');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const out = new Set();
  const add = (chunk) => {
    for (const raw of chunk.split(/,| plus | or |, and the praise words | and the praise words /)) {
      const w = raw.replace(/['"`.()]/g, '').trim().toLowerCase();
      if (w && w.length >= 3 && w.split(' ').length <= 3) out.add(w);
    }
  };
  const keepOut = /^- Keep these words out of[^:]*:(.*)$/m.exec(text);
  if (keepOut) add(keepOut[1]);
  const tokens = /no third-party brand tokens \(([^)]*)\)/.exec(text);
  if (tokens) add(tokens[1]);
  const shortened = /Never shorten the name to "([^"]+)" or "([^"]+)"/.exec(text);
  if (shortened) add(shortened[1] + ',' + shortened[2]);
  return out.size ? Array.from(out) : null;
}
function wordHit(text, word) {
  const lower = text.toLowerCase();
  const w = word.toLowerCase();
  if (/^[a-z]/.test(w) && /[a-z]$/.test(w)) return new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])').test(lower);
  return lower.indexOf(w) >= 0;
}
/** Problems of one piece of ad wording (not the hashtags of a caption: those are checked apart). */
function wordingProblems(text, lang, others) {
  const out = [];
  for (const w of BANNED[lang]) if (wordHit(text, w)) out.push('forbidden wording "' + w + '"');
  if (lang === 'en') for (const w of BANNED.ar) if (wordHit(text, w)) out.push('forbidden wording "' + w + '"');
  if (lang === 'ar') for (const w of BANNED.en) if (wordHit(text, w)) out.push('forbidden wording "' + w + '"');
  for (const w of others || []) if (wordHit(text, w)) out.push('vocabulary of another game: "' + w + '"');
  if (/\p{Extended_Pictographic}/u.test(text)) out.push('emoji or pictograph');
  if (/([!?*★☆~])\1/.test(text)) out.push('repeated punctuation');
  const caps = text.match(/\b[A-Z]{3,}\b/g);
  if (caps) out.push('word in capitals: ' + caps.join(', '));
  return out;
}

function runCheck() {
  let failures = 0;
  const ok = (m) => console.log('  ok    ' + m);
  const fail = (m) => {
    failures++;
    console.log('  FAIL  ' + m);
  };
  const others = otherGamesVocabulary();
  console.log('make-promo --check: ' + path.relative(process.cwd(), OUT));
  if (others) ok('vocabulary of other games: ' + others.length + ' words and phrases read from docs/research/naming-ip.md');
  else console.log('  note  docs/research/naming-ip.md not found: other games\' vocabulary is not checked');

  // 1. images
  let seen = 0;
  for (const lang of LANGS) {
    for (const concept of CONCEPTS) {
      for (const size of SIZES) {
        const png = path.join(OUT, 'png', lang, fileName(concept, size, lang, 'png'));
        const jpg = path.join(OUT, 'jpg', lang, fileName(concept, size, lang, 'jpg'));
        if (!fs.existsSync(png)) {
          fail('missing ' + path.relative(OUT, png));
        } else {
          const buf = fs.readFileSync(png);
          const info = pngInfo(buf);
          const good = info.width === size.w && info.height === size.h && info.bitDepth === 8 && info.colorType === 2 && !info.hasAlphaChannel && buf.length <= PNG_MAX;
          if (good) seen++;
          else fail(path.relative(OUT, png) + ': ' + info.width + '×' + info.height + ', colour type ' + info.colorType + ', ' + buf.length + ' bytes (want ' + size.w + '×' + size.h + ', 24-bit RGB, at most ' + PNG_MAX + ' bytes)');
        }
        if (!fs.existsSync(jpg)) {
          fail('missing ' + path.relative(OUT, jpg));
        } else {
          const buf = fs.readFileSync(jpg);
          const info = jpegInfo(buf);
          const good = info.width === size.w && info.height === size.h && info.components === 3 && buf.length <= JPG_MAX;
          if (good) seen++;
          else fail(path.relative(OUT, jpg) + ': ' + info.width + '×' + info.height + ', ' + buf.length + ' bytes (want ' + size.w + '×' + size.h + ', at most ' + JPG_MAX + ' bytes)');
        }
      }
    }
  }
  if (seen === LANGS.length * CONCEPTS.length * SIZES.length * 2) ok('images: ' + seen + ' files, every one at its exact pixel size; PNG 24-bit without alpha and under ' + PNG_MAX + ' bytes, JPEG at most ' + JPG_MAX + ' bytes');

  // 2. the lettering on the images
  for (const lang of LANGS) {
    const c = COPY[lang];
    const pieces = [c.A.hook.join(' '), c.B.hook.join(' '), c.C.labels.join(' ')];
    pieces.forEach((text, i) => {
      const words = text.split(/\s+/).filter(Boolean).length;
      const probs = wordingProblems(text, lang, others);
      if (words < 2 || words > 6) probs.push(words + ' words (a hook has 2 to 6)');
      if (probs.length) fail('hook ' + 'ABC'[i] + ' (' + lang + ') "' + text + '": ' + probs.join('; '));
      else ok('hook ' + 'ABC'[i] + ' (' + lang + '): "' + text + '" — ' + words + ' words');
    });
    const probs = wordingProblems(c.store.replace('Google Play', ''), lang, others);
    if (probs.length) fail('store line (' + lang + '): ' + probs.join('; '));
  }

  // 3. manifest: lettering share of each image
  const manifestFile = path.join(OUT, 'manifest.json');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    let worst = 0;
    let worstName = '';
    for (const f of manifest.images) {
      if (f.letteringShare > worst) {
        worst = f.letteringShare;
        worstName = f.png;
      }
    }
    if (manifest.images.length !== 30) fail('manifest.json lists ' + manifest.images.length + ' images, not 30');
    if (worst >= 0.2) fail('lettering covers ' + (worst * 100).toFixed(1) + '% of ' + worstName + ' (must stay well under 20%)');
    else ok('lettering (logo wordmark + hook + store line, as boxes): at most ' + (worst * 100).toFixed(1) + '% of an image (' + worstName + ')');
  } else {
    fail('manifest.json is missing (run the tool without --check)');
  }

  // 4. the copy sheets: every row "| id | text | n / limit |" is counted again
  for (const name of ['AD-COPY.md', 'SOCIAL-CAPTIONS.md']) {
    const file = path.join(OUT, name);
    if (!fs.existsSync(file)) {
      fail(name + ' is missing');
      continue;
    }
    let src = fs.readFileSync(file, 'utf8');
    const rowRe = /^\| *`([A-Za-z0-9.-]+)` *\| (.*?) \| *(\d+) *\/ *(\d+) *\|$/gm;
    let m;
    let rows = 0;
    let bad = 0;
    const edits = [];
    const ids = new Set();
    while ((m = rowRe.exec(src))) {
      const [whole, id, cell, stated, limitText] = m;
      rows++;
      const text = cell.replace(/<br\s*\/?>/g, '\n').replace(/\\\|/g, '|').trim();
      const lang = /(^|[.-])ar([.-]|$)/i.test(id) ? 'ar' : 'en';
      const points = Array.from(text).length;
      const limit = Number(limitText);
      if (ids.has(id)) {
        bad++;
        fail(name + ' ' + id + ': the id is used twice');
      }
      ids.add(id);
      if (points > limit || text.length > limit) {
        bad++;
        fail(name + ' ' + id + ': ' + points + ' characters (' + text.length + ' UTF-16 units) is over the limit of ' + limit);
      }
      if (Number(stated) !== points) {
        if (WRITE_COUNTS) edits.push([whole, whole.replace(/\| *\d+ *\/ *\d+ *\|$/, '| ' + points + ' / ' + limit + ' |')]);
        else {
          bad++;
          fail(name + ' ' + id + ': the sheet says ' + stated + ' but the text has ' + points + ' characters (run with --write-counts)');
        }
      }
      // hashtags are names, not wording: check the sentence without them
      const sentence = text.replace(/#[\p{L}\p{N}_]+/gu, ' ');
      const probs = wordingProblems(sentence, lang, others);
      const tags = text.match(/#[\p{L}\p{N}_]+/gu) || [];
      for (const tag of tags) for (const w of others || []) if (tag.toLowerCase().replace('#', '').replace(/_/g, ' ').indexOf(w) >= 0 && w.length > 3) probs.push('hashtag ' + tag + ' carries the vocabulary of another game');
      if (/^[A-Z]-?(G|TT)/i.test(id) || /^(G|TT)[.-]/i.test(id)) {
        if (/[#{}]/.test(text)) probs.push('"#", "{" or "}" in a Google / TikTok ad text');
      }
      if (probs.length) {
        bad++;
        fail(name + ' ' + id + ': ' + probs.join('; '));
      }
    }
    if (edits.length) {
      for (const [from, to] of edits) src = src.replace(from, to);
      fs.writeFileSync(file, src);
      console.log('  note  ' + name + ': ' + edits.length + ' count(s) rewritten');
    }
    if (rows === 0) fail(name + ': no counted rows found');
    else if (bad === 0) ok(name + ': ' + rows + ' texts counted (Unicode code points), every one within its limit and free of forbidden wording');
  }

  console.log(failures === 0 ? 'make-promo --check: all good' : 'make-promo --check: ' + failures + ' problem(s)');
  if (failures) process.exitCode = 1;
}

// ───────────────────────────── main ─────────────────────────────

function selected(kind, id) {
  const pool = kind === 'concept' ? CONCEPTS.map((c) => c.id) : kind === 'lang' ? LANGS : SIZES.map((s) => s.id);
  const asked = WORDS.filter((w) => pool.includes(w));
  return asked.length === 0 || asked.includes(id);
}

async function main() {
  if (CHECK_ONLY) return runCheck();
  const unknown = WORDS.filter((w) => !CONCEPTS.some((c) => c.id === w) && !LANGS.includes(w) && !SIZES.some((s) => s.id === w));
  if (unknown.length) throw new Error('unknown word(s): ' + unknown.join(', ') + ' — use A|B|C, en|ar, ' + SIZES.map((s) => s.id).join('|'));

  const jobs = [];
  for (const lang of LANGS) for (const concept of CONCEPTS) for (const size of SIZES) if (selected('lang', lang) && selected('concept', concept.id) && selected('size', size.id)) jobs.push({ lang, concept, size });
  if (jobs.length === 0) throw new Error('nothing selected');
  const need = (id) => jobs.some((j) => j.concept.id === id);

  const { chromium } = require('playwright');
  const server = await startServer(PORT);
  console.log('make-promo: dev server ' + server.base + (server.reused ? ' (already running — left running)' : ' (started here)'));
  const captures = {}; // name → png Buffer
  const meta = {}; // name → geometry of a board capture
  const results = [];
  try {
    const browser = await chromium.launch();
    try {
      const stageContext = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
      const stage = await stageContext.newPage();
      stage.on('pageerror', (err) => problems.push('[stage] page exception: ' + err.message));
      stage.on('console', (msg) => {
        if (msg.type() === 'error') problems.push('[stage] console error: ' + msg.text());
      });
      await stage.route('**/@vite/client', (route) => route.fulfill({ contentType: 'application/javascript', body: VITE_CLIENT_STUB }));
      const stageUrl = server.base + '__zumurud_promo_stage__.html';
      await stage.route(stageUrl, (route) => route.fulfill({ contentType: 'text/html', body: STAGE_HTML }));
      await stage.route(server.base + '__promo_capture__/*', (route) => {
        const name = decodeURIComponent(route.request().url().split('/').pop()).replace(/\.png$/, '');
        if (captures[name]) route.fulfill({ contentType: 'image/png', body: captures[name] });
        else route.fulfill({ status: 404, body: 'no capture ' + name });
      });
      await stage.goto(stageUrl, { waitUntil: 'load' });

      // ── captures from the real game ──
      const cached = (name) => CACHE && fs.existsSync(path.join(CACHE, name + '.png'));
      const boardScenes = [];
      if (need('A')) boardScenes.push('hero');
      if (need('C')) boardScenes.push('beam', 'nova', 'prism');
      for (const name of boardScenes) {
        if (cached(name) && fs.existsSync(path.join(CACHE, name + '.json'))) {
          captures[name] = fs.readFileSync(path.join(CACHE, name + '.png'));
          meta[name] = JSON.parse(fs.readFileSync(path.join(CACHE, name + '.json'), 'utf8'));
          continue;
        }
        const shot = await captureBoard(browser, server.base, name, SCENES[name], stage);
        captures[name] = shot.png;
        meta[name] = shot.meta;
        console.log('  captured ' + name + ': level ' + shot.meta.level + ', seed ' + shot.meta.seed + ', ' + shot.meta.at + ' ms after the move, canvas ' + shot.meta.width + '×' + shot.meta.height);
        if (CACHE) {
          writeFile(path.join(CACHE, name + '.png'), shot.png);
          writeFile(path.join(CACHE, name + '.json'), JSON.stringify(shot.meta));
        }
      }
      if (need('B')) {
        const kinds = new Set();
        for (const j of jobs) if (j.concept.id === 'B') kinds.add(LAYOUT.B[j.size.shape].tiles.kind);
        for (const lang of LANGS.filter((l) => jobs.some((j) => j.concept.id === 'B' && j.lang === l))) {
          for (const kind of kinds) {
            const names = MAP_FOCUS.map((_, i) => 'map-' + kind + '-' + lang + '-' + i);
            if (names.every(cached)) {
              for (const n of names) captures[n] = fs.readFileSync(path.join(CACHE, n + '.png'));
              continue;
            }
            const shots = await captureMap(browser, server.base, lang, kind);
            shots.forEach((png, i) => {
              captures[names[i]] = png;
              if (CACHE) writeFile(path.join(CACHE, names[i] + '.png'), png);
            });
            console.log('  captured the level map (' + lang + ', ' + kind + '): 6 chapters, ' + MAP_TILES[kind].cssW * MAP_DSF + '×' + MAP_TILES[kind].cssH * MAP_DSF + ' px each');
          }
        }
      }

      // ── compose ──
      const sample = LANGS.map((l) => [COPY[l].A.hook.join(' '), COPY[l].B.hook.join(' '), COPY[l].C.labels.join(' '), COPY[l].store].join(' ')).join(' ');
      await stage.evaluate(setupStage, { images: Object.keys(captures), meta, layout: LAYOUT, sample });
      for (const job of jobs) {
        const res = await stage.evaluate((j) => window.__promo.render(j), {
          concept: job.concept.id,
          lang: job.lang,
          dir: COPY[job.lang].dir,
          copy: COPY[job.lang],
          shape: job.size.shape,
          w: job.size.w,
          h: job.size.h,
          jpgMax: JPG_MAX,
        });
        if (!res.opaque) throw new Error(fileName(job.concept, job.size, job.lang, 'png') + ': the image has transparent pixels');
        results.push({ job, res });
      }
    } finally {
      await browser.close();
    }
  } finally {
    await server.stop();
  }
  if (problems.length) throw new Error('the game or the stage reported problems:\n  ' + problems.slice(0, 20).join('\n  '));

  // ── write ──
  console.log('make-promo: writing to ' + path.relative(process.cwd(), OUT));
  const listed = [];
  for (const { job, res } of results) {
    const rgba = Buffer.from(res.rgba, 'base64');
    const png = encodePng24(res.width, res.height, rgba);
    const jpg = Buffer.from(res.jpeg, 'base64');
    const pngRel = path.join('png', job.lang, fileName(job.concept, job.size, job.lang, 'png'));
    const jpgRel = path.join('jpg', job.lang, fileName(job.concept, job.size, job.lang, 'jpg'));
    writeFile(path.join(OUT, pngRel), png);
    writeFile(path.join(OUT, jpgRel), jpg);
    const pi = pngInfo(png);
    const ji = jpegInfo(jpg);
    if (pi.width !== job.size.w || pi.height !== job.size.h || ji.width !== job.size.w || ji.height !== job.size.h) throw new Error(pngRel + ': wrong pixel size written');
    if (png.length > PNG_MAX) throw new Error(pngRel + ' is ' + png.length + ' bytes, over ' + PNG_MAX);
    if (jpg.length > JPG_MAX) throw new Error(jpgRel + ' is ' + jpg.length + ' bytes, over ' + JPG_MAX);
    const area = res.texts.reduce((n, t) => n + t.w * t.h, 0);
    const share = area / (res.width * res.height);
    const words = job.concept.id === 'C' ? COPY[job.lang].C.labels : COPY[job.lang][job.concept.id].hook;
    listed.push({
      png: pngRel.split(path.sep).join('/'),
      jpg: jpgRel.split(path.sep).join('/'),
      concept: job.concept.slug,
      language: job.lang,
      width: res.width,
      height: res.height,
      pngBytes: png.length,
      jpgBytes: jpg.length,
      jpgQuality: res.quality,
      hook: words.join(' '),
      storeLine: COPY[job.lang].store,
      altText: COPY[job.lang].alt[job.concept.id],
      letteringShare: Math.round(share * 1000) / 1000,
    });
    console.log('  ' + pngRel + '  ' + pi.width + '×' + pi.height + '  png ' + Math.round(png.length / 1024) + ' KB · jpg ' + Math.round(jpg.length / 1024) + ' KB (q ' + res.quality + ') · lettering ' + (share * 100).toFixed(1) + '%');
  }
  if (jobs.length === LANGS.length * CONCEPTS.length * SIZES.length) {
    const manifest = {
      game: 'Zumurud (com.zumurud.game)',
      note: 'Made by tools/store/make-promo.cjs from the game itself. letteringShare = boxes of the wordmark, the hook and the store line divided by the image area.',
      scenes: Object.keys(meta).map((name) => ({ scene: name, level: meta[name].level, seed: meta[name].seed, move: meta[name].move, msAfterMove: meta[name].at })),
      mapTiles: { focusLevels: MAP_FOCUS, sizesCssPx: MAP_TILES },
      images: listed,
    };
    writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log('  manifest.json  ' + listed.length + ' images');
  } else {
    console.log('  (partial run: manifest.json is only rewritten by a full run)');
  }
}

main().catch((err) => {
  console.error('make-promo: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
